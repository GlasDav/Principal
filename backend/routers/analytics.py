from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract, case
from typing import List, Optional
from datetime import datetime, timedelta, date
import statistics
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
)

@router.get("/dashboard")
def get_dashboard_data(
    start_date: str = Query(..., description="ISO Date string"), 
    end_date: str = Query(..., description="ISO Date string"),
    spender: str = Query(default="Combined"), # Combined, User A, User B
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    try:
        s_date = datetime.fromisoformat(start_date)
        e_date = datetime.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")
    
    # 1. Get User & Buckets
    user = current_user
    buckets = db.query(models.BudgetBucket).filter(models.BudgetBucket.user_id == user.id).all()
    
    # 2. Optimized Aggregation for Current Range
    # Query: SELECT bucket_id, SUM(amount) FROM transactions WHERE ... GROUP BY bucket_id
    query = db.query(
        models.Transaction.bucket_id, 
        func.sum(models.Transaction.amount)
    ).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= s_date,
        models.Transaction.date <= e_date
    )

    if spender != "Combined":
        query = query.filter(models.Transaction.spender == spender)
        
    # Result: List of (bucket_id, total_amount)
    # Note: We need separate sums for Income vs Expense if we want precise accuracy, 
    # but typically bucket spending is just Sum of Expenses (negative inputs).
    # Let's fetch pure sum. Expenses are negative.
    
    # Actually, for the "Spent" bar, we only care about expenses.
    # Refunds (positive) should offset expenses. 
    # So simple SUM is correct.
    
    results = query.group_by(models.Transaction.bucket_id).all()
    spend_map = {bid: abs(total) if total < 0 else -total for bid, total in results if bid is not None}
    # Note: if total is positive (refunds > expenses), spent is effectively negative? 
    # Or should we treat it as 0 logic? 
    # Standard logic: if total < 0 (net expense), spent = abs(total).
    # if total > 0 (net income/refund), spent = -total (negative spending).
    
    # Refined logic:
    spend_map = {}
    for bid, total in results:
        if bid is None: continue
        # Transaction amount: -100 (expense). Total: -100. Spent: 100.
        spend_map[bid] = -total if total < 0 else 0 
        
    # Hierarchy Rollup: Sum child spending into parent
    # 1. Build children map
    children_map = {b.id: [] for b in buckets}
    for b in buckets:
        if b.parent_id and b.parent_id in children_map:
            children_map[b.parent_id].append(b.id)
            
    # 2. Recursive Rollup
    rollup_spend_map = {}
    
    def calculate_rollup(bid):
        if bid in rollup_spend_map:
            return rollup_spend_map[bid]
            
        # Start with own spending
        total = spend_map.get(bid, 0.0)
        
        # Add children spending
        children = children_map.get(bid, [])
        for child_id in children:
            total += calculate_rollup(child_id)
            
        rollup_spend_map[bid] = total
        return total
        
    # Calculate for all
    for b in buckets:
        calculate_rollup(b.id)
        
    # Use rollup_spend_map for display (updates existing spend_map logic effectively)
    spend_map = rollup_spend_map
        
    # 3. Rollover Logic (Optimized N+1 fix)
    # If any bucket is rollover, we need YTD spending before s_date.
    rollover_map = {} # bid -> rollover_amount
    
    rollover_buckets = [b for b in buckets if b.is_rollover]
    if rollover_buckets and s_date.month > 1:
        ytd_start = datetime(s_date.year, 1, 1)
        
        # Batch Query for YTD Spending (ALL rollover buckets at once)
        rollover_ids = [b.id for b in rollover_buckets]
        
        ytd_results = db.query(
            models.Transaction.bucket_id,
            func.sum(models.Transaction.amount)
        ).filter(
            models.Transaction.user_id == user.id,
            models.Transaction.bucket_id.in_(rollover_ids),
            models.Transaction.date >= ytd_start,
            models.Transaction.date < s_date # Strictly before view start
        ).group_by(models.Transaction.bucket_id).all()
        
        ytd_spend_map = {bid: abs(total) if total < 0 else 0 for bid, total in ytd_results}
        
        # Calculate Rollover
        pre_months = s_date.month - 1
        for b in rollover_buckets:
            pre_limit = (b.monthly_limit_a + b.monthly_limit_b) * pre_months
            pre_spent = ytd_spend_map.get(b.id, 0.0)
            rollover_map[b.id] = max(0, pre_limit - pre_spent)

    # 4. Global Totals (Income vs Expense)
    # Detailed query for totals to ensure we capture everything (even unbucketed)
    # We can do this in one pass or separate. Separate is clean.
    totals_query = db.query(
        func.sum(case((models.Transaction.amount < 0, models.Transaction.amount), else_=0)).label("expenses"),
        func.sum(case((models.Transaction.amount > 0, models.Transaction.amount), else_=0)).label("income")
    ).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= s_date,
        models.Transaction.date <= e_date
    )
    
    if spender != "Combined":
        totals_query = totals_query.filter(models.Transaction.spender == spender)

    # Exclude Transfer buckets from totals
    totals_query = totals_query.filter(
        ~models.Transaction.bucket.has(models.BudgetBucket.is_transfer == True)
    )

    totals_res = totals_query.first()
    total_expenses = abs(totals_res.expenses or 0.0)
    total_income = totals_res.income or 0.0

    # 5. Build Final Response
    final_buckets = []
    
    # Calculate months scalar
    delta_months = (e_date.year - s_date.year) * 12 + (e_date.month - s_date.month) + 1
    delta_months = max(1, delta_months)

    for b in buckets:
        spent = spend_map.get(b.id, 0.0)
        
        base_limit = b.monthly_limit_a + b.monthly_limit_b
        limit = base_limit * delta_months
        
        # Add Rollover if applicable
        if b.id in rollover_map:
             limit += rollover_map[b.id]
        
        if limit > 0:
            percent = (spent / limit) * 100
        else:
            percent = 0 if spent == 0 else 100
            
        final_buckets.append({
            "id": b.id,
            "name": b.name,
            "icon": b.icon_name,
            "group": b.group,
            "is_rollover": b.is_rollover,
            "limit": limit,
            "spent": spent,
            "remaining": limit - spent,
            "percent": percent,
            "is_over": spent > limit,
        })

    return {
        "start_date": start_date,
        "end_date": end_date,
        "buckets": final_buckets,
        "totals": {
            "income": total_income,
            "expenses": total_expenses,
            "net_savings": total_income - total_expenses
        }
    }

@router.get("/history")
def get_analytics_history(
    start_date: str = Query(..., description="ISO Date string"), 
    end_date: str = Query(..., description="ISO Date string"),
    spender: str = Query(default="Combined"), # Combined, User A, User B
    bucket_id: Optional[int] = Query(None),
    group: Optional[str] = Query(None), # Non-Discretionary, Discretionary
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    try:
        s_date = datetime.fromisoformat(start_date)
        e_date = datetime.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")
        
    user = current_user
    if not user: raise HTTPException(status_code=404, detail="User not found")
    
    # helper to iterate months
    def month_year_iter(start, end):
        ym_start = 12 * start.year + start.month - 1
        ym_end = 12 * end.year + end.month - 1
        for ym in range(ym_start, ym_end + 1):
            y, m = divmod(ym, 12)
            yield y, m + 1
            
    # Calculate Limit per month based on filters
    # Note: Using CURRENT limits for history (limitation of current data model)
    buckets_query = db.query(models.BudgetBucket).filter(models.BudgetBucket.user_id == user.id)
    if bucket_id:
        # Hierarchy: Find all descendants of the selected bucket
        # 1. Fetch all hierarchy info for user
        hierarchy = db.query(models.BudgetBucket.id, models.BudgetBucket.parent_id).filter(models.BudgetBucket.user_id == user.id).all()
        
        # 2. Build adjacency list
        adj = {}
        for bid, pid in hierarchy:
            if pid:
                adj.setdefault(pid, []).append(bid)
        
        # 3. BFS traversal to find all descendant IDs
        subtree_ids = {bucket_id}
        queue = [bucket_id]
        while queue:
            curr = queue.pop(0)
            children = adj.get(curr, [])
            for child in children:
                if child not in subtree_ids:
                    subtree_ids.add(child)
                    queue.append(child)
                    
        buckets_query = buckets_query.filter(models.BudgetBucket.id.in_(subtree_ids))
    elif group:
        buckets_query = buckets_query.filter(models.BudgetBucket.group == group)
        
    relevant_buckets = buckets_query.all()
    monthly_limit_total = sum((b.monthly_limit_a + b.monthly_limit_b) for b in relevant_buckets)
    
    # Pre-fetch relevant buckets IDs for txn filtering
    relevant_bucket_ids = [b.id for b in relevant_buckets]
    
    history_data = []
    
    for year, month in month_year_iter(s_date, e_date):
        # Transaction Range for this month
        m_start = datetime(year, month, 1)
        if month == 12:
            m_end = datetime(year + 1, 1, 1)
        else:
            m_end = datetime(year, month + 1, 1)
            
        # Query Txns
        query = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.user_id == user.id,
            models.Transaction.date >= m_start,
            models.Transaction.date < m_end,
            models.Transaction.amount < 0 # Only expenses
        )
        
        if spender != "Combined":
            query = query.filter(models.Transaction.spender == spender)
        
        if bucket_id or group:
             query = query.filter(models.Transaction.bucket_id.in_(relevant_bucket_ids))
        
        # Note: If no filters, we include ALL expenses, even unassigned? 
        # Typically "Performance vs Budget" implies comparing against budgeted buckets.
        # But "Total" usually means "Total Spending".
        # Let's align: matching buckets only.
        if not bucket_id and not group:
             # If "Total", maybe we want everything?
             # For now, let's keep it simple: Filter by ALL known buckets to match Limits.
             # Or just raw total. 
             # Let's use raw total for Spending, but Limit is sum of buckets.
             # This highlights "Unbudgeted" spending which is good to see.
             pass

        # Exclude Transfers from History too
        query = query.filter(
            ~models.Transaction.bucket.has(models.BudgetBucket.is_transfer == True)
        )
             
        spent = query.scalar() or 0.0
        spent = abs(spent)
        
        history_data.append({
            "date": m_start.strftime("%Y-%m-%d"),
            "label": m_start.strftime("%b %Y"),
            "limit": monthly_limit_total,
            "spent": spent
        })
        
    return history_data
        


@router.get("/calendar", response_model=List[schemas.Transaction])
def get_calendar_data(
    start_date: str = Query(..., description="ISO Date string"), 
    end_date: str = Query(..., description="ISO Date string"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    try:
        s_date = datetime.fromisoformat(start_date)
        e_date = datetime.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")
        
    user = current_user
    
    # Fetch all transactions in range
    txns = db.query(models.Transaction)\
        .options(joinedload(models.Transaction.bucket))\
        .filter(
            models.Transaction.user_id == user.id,
            models.Transaction.date >= s_date,
            models.Transaction.date <= e_date
        )\
        .order_by(models.Transaction.date.asc())\
        .all()
        
    return txns


@router.get("/subscriptions", response_model=List[schemas.Subscription])
def get_subscriptions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return db.query(models.Subscription).filter(models.Subscription.user_id == current_user.id).all()

@router.post("/subscriptions", response_model=schemas.Subscription)
def create_subscription(
    sub: schemas.SubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_sub = models.Subscription(**sub.dict(), user_id=current_user.id)
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub

@router.put("/subscriptions/{sub_id}", response_model=schemas.Subscription)
def update_subscription(
    sub_id: int,
    sub_update: schemas.SubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_sub = db.query(models.Subscription).filter(models.Subscription.id == sub_id, models.Subscription.user_id == current_user.id).first()
    if not db_sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
        
    for key, value in sub_update.dict(exclude_unset=True).items():
        setattr(db_sub, key, value)
        
    db.commit()
    db.refresh(db_sub)
    return db_sub

@router.delete("/subscriptions/{sub_id}")
def delete_subscription(
    sub_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_sub = db.query(models.Subscription).filter(models.Subscription.id == sub_id, models.Subscription.user_id == current_user.id).first()
    if not db_sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
        
    db.delete(db_sub)
    db.commit()
    return {"ok": True}

@router.get("/subscriptions/suggested")
def get_suggested_subscriptions(
    exclude_existing: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    user = current_user
    # 0. Get Existing Subscriptions to filter out
    # Use description_keyword for matching (not name) so renamed subscriptions still exclude properly
    existing_keywords = set()
    if exclude_existing:
        subs = db.query(models.Subscription).filter(models.Subscription.user_id == user.id).all()
        for s in subs:
            # Use description_keyword if set, otherwise fall back to name
            keyword = (s.description_keyword or s.name).lower()
            existing_keywords.add(keyword)

    # 1. Fetch last 12 months of expenses
    one_year_ago = datetime.now() - timedelta(days=365)
    
    txns = db.query(models.Transaction).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= one_year_ago,
        models.Transaction.amount < 0
    ).order_by(models.Transaction.date.desc()).all()
    
    # 2. Group by Description text (simple clustering)
    from collections import defaultdict
    groups = defaultdict(list)
    
    for t in txns:
        # Use first 15 chars or similarity? 
        # Let's use clean_description if avail, else raw
        key = t.description.strip().lower()
        groups[key].append(t)
        
    subscriptions = []
    
    for name, items in groups.items():
        if len(items) < 3: continue # Need at least 3 to form pattern
        
        # Check against existing keywords (matches on description_keyword or name)
        if exclude_existing and name in existing_keywords:
            continue
        
        # Sort by date
        items.sort(key=lambda x: x.date)
        
        # Check Amount Consistency
        amounts = [abs(x.amount) for x in items]
        avg_amount = sum(amounts) / len(amounts)
        
        # Allow 15% variance (Utilities often fluctuate) or strict $1 for fixed
        is_consistent_amount = all(abs(a - avg_amount) < (avg_amount * 0.15) for a in amounts) 
        
        if not is_consistent_amount: continue

        # Check Frequency
        dates = [x.date for x in items]
        intervals = []
        for i in range(1, len(dates)):
            delta = (dates[i] - dates[i-1]).days
            intervals.append(delta)
            
        avg_interval = sum(intervals) / len(intervals)
        
        frequency = None
        
        # Ranges
        if 25 <= avg_interval <= 35:
            frequency = "Monthly"
            avg_interval = 30 # normalize
        elif 6 <= avg_interval <= 8:
            frequency = "Weekly"
            avg_interval = 7
        elif 360 <= avg_interval <= 370:
            frequency = "Yearly"
            avg_interval = 365
            
        if frequency:
            # Calculate next due
            last_date = dates[-1]
            next_due = last_date + timedelta(days=int(avg_interval))
            
            # Confidence scoring
            variance_score = sum(abs(a - avg_amount) for a in amounts) / (len(amounts) * avg_amount) # Lower is better
            confidence = "High" if variance_score < 0.05 else "Medium"
            
            subscriptions.append({
                "name": items[0].description, # use display name
                "description_keyword": name, # original search key for future matching
                "amount": avg_amount,
                "frequency": frequency,
                "annual_cost": avg_amount * (12 if frequency == "Monthly" else 52 if frequency == "Weekly" else 1),
                "next_due": next_due,
                "confidence": confidence,
                "last_payment_date": last_date
            })
            
    return subscriptions


@router.get("/debt_projection")
def get_debt_projection(
    current_balance: float = Query(..., gt=0),
    interest_rate: float = Query(..., ge=0), # Annual %
    minimum_payment: float = Query(..., gt=0),
    extra_payment: float = Query(0.0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Logic for Amortization
    # We will simulate two scenarios: Base (Min Payment) and Accelerated (Min + Extra)
    
    def calculate_amortization(bal, rate, payment):
        monthly_rate = (rate / 100) / 12
        schedule = []
        total_interest = 0.0
        months = 0
        
        # Guard against infinite loop if payment < interest
        first_month_interest = bal * monthly_rate
        if payment <= first_month_interest:
             # Just return 1 year projection to show it growing/stagnant
             for i in range(12):
                 interest = bal * monthly_rate
                 principal = payment - interest
                 bal -= principal
                 total_interest += interest
                 schedule.append({"month": i+1, "balance": max(0, bal), "interest": interest, "principal": principal})
             return {"schedule": schedule, "total_interest": float('inf'), "months": float('inf')}

        while bal > 0.01 and months < 360: # Cap at 30 years for safety
            interest = bal * monthly_rate
            principal = payment - interest
            
            if bal < principal: # Final payment
                principal = bal
                payment = interest + principal
            
            bal -= principal
            total_interest += interest
            months += 1
            schedule.append({
                "month": months,
                "balance": max(0, bal),
                "interest": interest, 
                "principal": principal
            })
            
        return {"schedule": schedule, "total_interest": total_interest, "months": months}

    base = calculate_amortization(current_balance, interest_rate, minimum_payment)
    accelerated = calculate_amortization(current_balance, interest_rate, minimum_payment + extra_payment)
    
    return {
        "base_plan": base,
        "accelerated_plan": accelerated,
        "savings": {
            "interest_saved": base["total_interest"] - accelerated["total_interest"] if base["total_interest"] != float('inf') else -1,
            "time_saved_months": base["months"] - accelerated["months"] if base["months"] != float('inf') else -1
        }
    }


@router.get("/anomalies")
def get_anomalies(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    user = current_user
    today = datetime.now()
    
    # 1. Large Transactions (Dynamic Threshold based on last 90 days)
    ninety_days_ago = today - timedelta(days=90)
    
    # Fetch all expenses in last 90 days
    recent_txns = db.query(models.Transaction).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= ninety_days_ago,
        models.Transaction.amount < 0
    ).all()
    
    anomalies = []
    
    if recent_txns:
        amounts = [abs(t.amount) for t in recent_txns]
        if len(amounts) > 1:
            mean_amt = statistics.mean(amounts)
            std_amt = statistics.stdev(amounts)
            # Threshold: Mean + 2 Standard Deviations (approx 95th percentile)
            # Minimum threshold of $100 to avoid noise
            large_threshold = max(200.0, mean_amt + (2 * std_amt))
        else:
            large_threshold = 500.0 # Fallback
            
        # Find large txns in last 30 days
        thirty_days_ago = today - timedelta(days=30)
        for t in recent_txns:
            if t.date >= thirty_days_ago and abs(t.amount) > large_threshold:
                anomalies.append({
                    "type": "large_transaction",
                    "severity": "high" if abs(t.amount) > (mean_amt + 3*std_amt) else "medium",
                    "message": f"Large expense detected: {t.description}",
                    "amount": abs(t.amount),
                    "date": t.date,
                    "details": f"Amount ${abs(t.amount):.0f} exceeds typical range (Threshold: ${large_threshold:.0f})"
                })

    # 2. Category Spikes (Dynamic based on last 6 months)
    # Fetch 6 months history
    six_months_ago = (today.replace(day=1) - timedelta(days=180)).replace(day=1)
    
    hist_txns = db.query(models.Transaction).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= six_months_ago,
        models.Transaction.bucket_id.isnot(None),
        models.Transaction.amount < 0
    ).all()
    
    # Aggregate by Bucket and Month
    bucket_monthly = {} # bid -> { 'yyyy-mm': total }
    from collections import defaultdict
    bucket_monthly = defaultdict(lambda: defaultdict(float))
    
    for t in hist_txns:
        month_key = t.date.strftime("%Y-%m")
        bucket_monthly[t.bucket_id][month_key] += abs(t.amount)
        
    current_month_key = today.strftime("%Y-%m")
    
    # Get Bucket Names
    buckets = {b.id: b.name for b in db.query(models.BudgetBucket).filter(models.BudgetBucket.user_id == user.id).all()}
    
    for bid, months_data in bucket_monthly.items():
        if bid not in buckets: continue
        
        current_val = months_data.get(current_month_key, 0.0)
        if current_val == 0: continue
        
        # Get history values (excluding current month)
        history_vals = [val for m, val in months_data.items() if m != current_month_key]
        
        # If sparsely populated, treat missing months as 0? 
        # Better: compare against available history.
        if not history_vals: continue
        
        # Calculate stats
        avg_val = statistics.mean(history_vals)
        if len(history_vals) > 1:
            std_val = statistics.stdev(history_vals)
            spike_threshold = avg_val + (2 * std_val)
        else:
            spike_threshold = avg_val * 1.5 # Fallback
            
        # Ignore small amounts (< $50 or < 20% over avg)
        if current_val < 50: continue
        
        if current_val > spike_threshold:
            pct = int((current_val / avg_val) * 100) if avg_val > 0 else 100
            
            anomalies.append({
                "type": "category_spike",
                "severity": "high" if current_val > (avg_val + 3 * (std_val if len(history_vals) > 1 else 0)) else "medium",
                "message": f"High spending in '{buckets[bid]}'",
                "amount": current_val,
                "date": today,
                "details": f"{pct}% of average. Spent ${current_val:.0f} vs typical ${avg_val:.0f}."
            })
            
    return anomalies


@router.get("/sankey")
def get_sankey_data(
    start_date: str = Query(..., description="ISO Date string"), 
    end_date: str = Query(..., description="ISO Date string"),
    spender: str = Query(default="Combined"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    try:
        s_date = datetime.fromisoformat(start_date)
        e_date = datetime.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")
        
    user = current_user
    
    # 1. Fetch Totals (Income vs Expenses)
    totals_query = db.query(
        func.sum(case((models.Transaction.amount < 0, models.Transaction.amount), else_=0)).label("expenses"),
        func.sum(case((models.Transaction.amount > 0, models.Transaction.amount), else_=0)).label("income")
    ).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= s_date,
        models.Transaction.date <= e_date
    )
    
    if spender != "Combined":
        totals_query = totals_query.filter(models.Transaction.spender == spender)

    # Exclude Transfer and Investment buckets from expense totals
    totals_query = totals_query.filter(
        ~models.Transaction.bucket.has(models.BudgetBucket.is_transfer == True),
        ~models.Transaction.bucket.has(models.BudgetBucket.is_investment == True)
    )
        
    totals_res = totals_query.first()
    total_expenses = abs(totals_res.expenses or 0.0)
    total_income = totals_res.income or 0.0
    
    # 2. Fetch Expenses Grouped by Bucket
    # Query: SELECT bucket_id, SUM(amount) FROM transactions ... GROUP BY bucket_id
    expense_query = db.query(
        models.Transaction.bucket_id,
        func.sum(models.Transaction.amount)
    ).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= s_date,
        models.Transaction.date <= e_date,
        models.Transaction.amount < 0 # Only expenses
    )
    
    if spender != "Combined":
        expense_query = expense_query.filter(models.Transaction.spender == spender)

    # Exclude Transfer and Investment buckets from expenses
    expense_query = expense_query.filter(
        ~models.Transaction.bucket.has(models.BudgetBucket.is_transfer == True),
        ~models.Transaction.bucket.has(models.BudgetBucket.is_investment == True)
    )
        
    expense_results = expense_query.group_by(models.Transaction.bucket_id).all()
    
    # Map bucket_id -> spent
    bucket_spend = {bid: abs(amt) for bid, amt in expense_results if bid is not None}
    unallocated_spend = sum(abs(amt) for bid, amt in expense_results if bid is None)
    
    # 3. Get Bucket Details for Names/Groups
    buckets = db.query(models.BudgetBucket).filter(models.BudgetBucket.user_id == user.id).all()
    bucket_map = {b.id: b for b in buckets}
    
    # 4. Construct Nodes & Links
    nodes = []
    links = []
    node_indices = {}
    
    def get_node(name):
        if name not in node_indices:
            node_indices[name] = len(nodes)
            nodes.append({"name": name})
        return node_indices[name]
    
    # Root Nodes
    idx_income = get_node("Income")
    # idx_budget removed
    
    # Groups (User requested "Discretionary" vs "Non-Discretionary")
    idx_non_disc = get_node("Non-Discretionary") # Formerly Needs
    idx_disc = get_node("Discretionary")         # Formerly Wants
    idx_uncat = get_node("Uncategorized")
    
    non_disc_total = 0.0
    disc_total = 0.0
    
    # Buckets Logic
    for bid, amount in bucket_spend.items():
        if bid not in bucket_map: continue
        bucket = bucket_map[bid]
        
        idx_b = get_node(bucket.name)
        
        if bucket.group == "Non-Discretionary":
            links.append({"source": idx_non_disc, "target": idx_b, "value": amount})
            non_disc_total += amount
        else:
            links.append({"source": idx_disc, "target": idx_b, "value": amount})
            disc_total += amount
            
    # Uncategorized Logic
    if unallocated_spend > 0:
        links.append({"source": idx_income, "target": idx_uncat, "value": unallocated_spend})
        # Layer 3 for Uncategorized
        links.append({"source": idx_uncat, "target": get_node("Misc"), "value": unallocated_spend})

    # High Level Links (Income -> Groups)
    if non_disc_total > 0:
        links.append({"source": idx_income, "target": idx_non_disc, "value": non_disc_total})
    
    if disc_total > 0:
        links.append({"source": idx_income, "target": idx_disc, "value": disc_total})
        
    # Savings Logic
    # Net Savings in this variable is (Income - Expenses).
    # Since Expenses calculated above EXCLUDE investments, this 'net_savings' currently includes 
    # the money spent on investments + actual cash savings.
    # Because we plot Investments separately (below), we must subtract them here to avoid double counting 
    # and to accurately represent "Cash Savings".
    
    # We need total_investments calculated BEFORE this block or access it.
    # Move Investment Calculation UP or do it here.
    
    # Investment Logic - Query investment transactions separately
    investment_query = db.query(
        func.sum(models.Transaction.amount)
    ).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= s_date,
        models.Transaction.date <= e_date,
        models.Transaction.amount < 0,  # Outgoing money to investments
        models.Transaction.bucket.has(models.BudgetBucket.is_investment == True)
    )
    
    if spender != "Combined":
        investment_query = investment_query.filter(models.Transaction.spender == spender)
    
    investment_res = investment_query.first()
    total_investments = abs(investment_res[0] or 0.0)
    
    
    # Combined Savings & Investments Logic
    # 1. Net Savings (Cash) = Income - Expenses - Investments
    net_savings = total_income - total_expenses - total_investments
    
    # 2. Total Investments calculated above
    
    combined_savings_total = net_savings + total_investments
    
    if combined_savings_total > 0:
        # Parent Node: "Savings & Investments"
        idx_combined = get_node("Savings & Investments")
        
        # Income -> "Savings & Investments"
        links.append({"source": idx_income, "target": idx_combined, "value": combined_savings_total})
        
        # "Savings & Investments" -> "Net Cash Savings" (if > 0)
        if net_savings > 0:
            idx_cash_savings = get_node("Net Cash Savings")
            links.append({"source": idx_combined, "target": idx_cash_savings, "value": net_savings})
            
        # "Savings & Investments" -> "Investments" (if > 0)
        if total_investments > 0:
            idx_investments_bucket = get_node("Investments")
            links.append({"source": idx_combined, "target": idx_investments_bucket, "value": total_investments})
        
    # Filter out unused nodes
    used_indices = set()
    for link in links:
        used_indices.add(link["source"])
        used_indices.add(link["target"])
    
    old_to_new = {}
    new_nodes = []
    
    for i, node in enumerate(nodes):
        if i in used_indices:
            old_to_new[i] = len(new_nodes)
            new_nodes.append(node)
            
    new_links = []
    for link in links:
        new_links.append({
            "source": old_to_new[link["source"]],
            "target": old_to_new[link["target"]],
            "value": link["value"]
        })

    return {"nodes": new_nodes, "links": new_links}


# --- Projections ---

@router.get("/cashflow-projection")
def get_cashflow_projection(
    months: int = 3,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # 1. Get Starting Balance (Cash Accounts)
    # Strategy: Sum "Cash" account balances from LATEST snapshot
    # Fallback: 0 if no snapshot
    
    start_balance = 0.0
    latest_snapshot = db.query(models.NetWorthSnapshot).filter(
        models.NetWorthSnapshot.user_id == current_user.id
    ).order_by(models.NetWorthSnapshot.date.desc()).first()
    
    if latest_snapshot:
        cash_balances = db.query(models.AccountBalance).join(models.Account).filter(
            models.AccountBalance.snapshot_id == latest_snapshot.id,
            models.Account.category == "Cash"
        ).all()
        start_balance = sum(b.balance for b in cash_balances)
        
    # 2. Get Active Subscriptions
    subs = db.query(models.Subscription).filter(
        models.Subscription.user_id == current_user.id,
        models.Subscription.is_active == True
    ).all()
    
    # 3. Simulate Forward
    today = date.today()
    end_date = today + timedelta(days=30 * months)
    
    projection = []
    running_balance = start_balance
    
    # Iterate day by day
    # Optimization: iterate only subscription days? No, we want a daily line chart usually, or at least sparse points.
    # Daily iteration is fast enough for 3-12 months (90-365 iterations).
    
    current_d = today
    while current_d <= end_date:
        daily_flow = 0.0
        
        for sub in subs:
            # Check if sub is due today
            is_due = False
            
            # Base logic on next_due_date
            # Simple assumption: next_due_date is valid anchor.
            # Handle Weekly, Monthly, Yearly
            
            # Normalize dates to avoid years-ago next_due_date issues? 
            # Ideally next_due_date is updated. If not, we project based on intervals from it.
            
            anchor = sub.next_due_date
            if not anchor: continue
            
            if sub.frequency == "Weekly":
                delta = (current_d - anchor).days
                if delta >= 0 and delta % 7 == 0:
                    is_due = True
            elif sub.frequency == "Bi-Weekly": # Every 2 weeks
                delta = (current_d - anchor).days
                if delta >= 0 and delta % 14 == 0:
                    is_due = True
            elif sub.frequency == "Monthly":
                # Matches day of month
                # Handle short months? (e.g. 31st due date in Feb)
                # Simple logic: if anchor.day == current_d.day
                # But if anchor day > current_d month length, it usually processes on last day?
                # MVP: exact day match.
                if current_d.day == anchor.day:
                    pass # Potential match, but need to check if it's in future relative to anchor? 
                    # If anchor is in past, yes.
                    # We assume it repeats monthly from anchor.
                    # Also need to check if current_d >= anchor.
                    if current_d >= anchor:
                         is_due = True
            elif sub.frequency == "Yearly":
                if current_d.month == anchor.month and current_d.day == anchor.day and current_d.year >= anchor.year:
                    is_due = True

            if is_due:
                # Assume amount is expense (positive value). Subtract it.
                # If negative, it adds (income). But typically subs are expenses.
                # TODO: add type to Subscription for distinct income. For now, assume expense.
                if sub.amount > 0:
                    daily_flow -= sub.amount
                else:
                    daily_flow -= sub.amount # Add negative (income) logic if user enters negative numbers?
                    
        running_balance += daily_flow
        
        projection.append({
            "date": current_d.isoformat(),
            "balance": running_balance,
            "flow": daily_flow
        })
        
        current_d += timedelta(days=1)
        
    return projection

@router.get("/networth-projection")
def get_networth_projection(
    months: int = 12,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # 1. Get History
    snapshots = db.query(models.NetWorthSnapshot).filter(
        models.NetWorthSnapshot.user_id == current_user.id
    ).order_by(models.NetWorthSnapshot.date.asc()).all()
    
    if len(snapshots) < 2:
        return [] # Not enough data
        
    # 2. Calculate Growth Rate (Linear Regression or Simple Average)
    # Let's use average monthly growth over the last 6 snapshots (or less)
    
    recent_snapshots = snapshots[-6:] 
    first = recent_snapshots[0]
    last = recent_snapshots[-1]
    
    days_diff = (last.date - first.date).days
    if days_diff == 0:
        return []
        
    net_growth = last.net_worth - first.net_worth
    daily_growth = net_growth / days_diff
    
    # 3. Project
    projection = []
    start_date = last.date
    start_val = last.net_worth
    
    # Generate one point per month
    for i in range(1, months + 1):
        future_date = start_date + timedelta(days=30 * i)
        future_val = start_val + (daily_growth * 30 * i)
        
        projection.append({
            "date": future_date.isoformat(),
            "net_worth": future_val,
            "is_projected": True
        })
        
    return projection


# --- Category History (for budget planning) ---

@router.get("/category-history/{bucket_id}")
def get_category_history(
    bucket_id: int,
    months: int = Query(6, ge=1, le=12, description="Number of months to look back"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get spending history for a specific category over the last N months.
    Useful when setting budget limits to see historical patterns.
    """
    # Verify bucket belongs to user
    bucket = db.query(models.BudgetBucket).filter(
        models.BudgetBucket.id == bucket_id,
        models.BudgetBucket.user_id == current_user.id
    ).first()
    
    if not bucket:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Calculate date range
    end_date = date.today()
    start_date = end_date - timedelta(days=months * 30)
    
    # Get monthly spending for this category
    monthly_data = db.query(
        extract('year', models.Transaction.date).label('year'),
        extract('month', models.Transaction.date).label('month'),
        func.sum(models.Transaction.amount).label('total')
    ).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.bucket_id == bucket_id,
        models.Transaction.date >= start_date,
        models.Transaction.date <= end_date,
        models.Transaction.amount < 0  # Only expenses
    ).group_by('year', 'month').order_by('year', 'month').all()
    
    # Build response with all months (fill gaps with zero)
    history = []
    current = start_date.replace(day=1)
    
    while current <= end_date:
        year, month = current.year, current.month
        
        # Find matching data
        month_total = 0
        for row in monthly_data:
            if int(row.year) == year and int(row.month) == month:
                month_total = abs(float(row.total))
                break
        
        history.append({
            "year": year,
            "month": month,
            "month_name": current.strftime("%b %Y"),
            "amount": round(month_total, 2)
        })
        
        # Move to next month
        if month == 12:
            current = current.replace(year=year + 1, month=1)
        else:
            current = current.replace(month=month + 1)
    
    # Calculate statistics
    amounts = [h["amount"] for h in history if h["amount"] > 0]
    stats = {
        "average": round(sum(amounts) / len(amounts), 2) if amounts else 0,
        "min": round(min(amounts), 2) if amounts else 0,
        "max": round(max(amounts), 2) if amounts else 0,
        "total": round(sum(amounts), 2)
    }
    
    return {
        "bucket_id": bucket_id,
        "bucket_name": bucket.name,
        "months": months,
        "history": history,
        "stats": stats
    }


@router.get("/group-spending")
def get_group_spending(
    start_date: str = Query(..., description="ISO Date string"), 
    end_date: str = Query(..., description="ISO Date string"),
    spender: str = Query(default="Combined"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get spending aggregated by budget group (e.g., Discretionary, Non-Discretionary).
    Supports budget-by-group view.
    """
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Build base query
    query = db.query(
        models.BudgetBucket.group.label('group_name'),
        func.sum(case((models.Transaction.amount < 0, models.Transaction.amount), else_=0)).label('expenses'),
        func.count(models.Transaction.id).label('transaction_count')
    ).join(
        models.Transaction, 
        models.Transaction.bucket_id == models.BudgetBucket.id
    ).filter(
        models.Transaction.user_id == current_user.id,
        models.BudgetBucket.user_id == current_user.id,
        models.Transaction.date >= start,
        models.Transaction.date <= end,
        models.BudgetBucket.is_transfer == False  # Exclude transfers
    )
    
    # Filter by spender if not combined
    if spender and spender != "Combined":
        query = query.filter(models.Transaction.spender == spender)
    
    results = query.group_by(models.BudgetBucket.group).all()
    
    # Build response
    groups = []
    for row in results:
        groups.append({
            "group": row.group_name or "Uncategorized",
            "expenses": round(abs(float(row.expenses or 0)), 2),
            "transaction_count": row.transaction_count
        })
    
    # Sort by expenses descending
    groups.sort(key=lambda x: x["expenses"], reverse=True)
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "spender": spender,
        "groups": groups,
        "total_expenses": round(sum(g["expenses"] for g in groups), 2)
    }

