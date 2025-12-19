from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract, case
from typing import List, Optional
from datetime import datetime, timedelta
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
        spend_map[bid] = -total if total < 0 else 0 # Don't show negative bars for net income in a bucket
        
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

    # Exclude "Transfer" bucket
    totals_query = totals_query.filter(~models.Transaction.bucket.has(models.BudgetBucket.name == "Transfer"))

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
        buckets_query = buckets_query.filter(models.BudgetBucket.id == bucket_id)
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
        query = query.filter(~models.Transaction.bucket.has(models.BudgetBucket.name == "Transfer"))
             
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
    existing_names = set()
    if exclude_existing:
        subs = db.query(models.Subscription).filter(models.Subscription.user_id == user.id).all()
        existing_names = {s.name.lower() for s in subs}

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
        
        # Check against existing
        if exclude_existing and name in existing_names:
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
    
    # 1. Large Transactions (Last 30 days)
    # Threshold: $500
    thirty_days_ago = today - timedelta(days=30)
    large_txns = db.query(models.Transaction).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= thirty_days_ago,
        models.Transaction.amount <= -500.0 # Expenses < -500
    ).order_by(models.Transaction.date.desc()).all()
    
    anomalies = []
    
    for t in large_txns:
        anomalies.append({
            "type": "large_transaction",
            "severity": "medium",
            "message": f"Large expense detected: {t.description}",
            "amount": abs(t.amount),
            "date": t.date,
            "details": f"Amount exceeds $500 threshold."
        })
        
    # 2. Category Spikes (Current Month vs 3-Month Avg)
    # Current Month
    cm_start = today.replace(day=1)
    
    # 3 Months Prior Range
    avg_end = cm_start
    avg_start = (avg_end - timedelta(days=92)).replace(day=1) # Start of 3 months ago window
    
    # Optimized: Calculate 3-Month Totals Aggregated by Bucket
    # Query: SELECT bucket_id, SUM(ABS(amount)) FROM transactions WHERE ... GROUP BY bucket_id
    historical_totals = db.query(
        models.Transaction.bucket_id,
        func.sum(func.abs(models.Transaction.amount))
    ).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.bucket_id.isnot(None),
        models.Transaction.date >= avg_start,
        models.Transaction.date < avg_end,
        models.Transaction.amount < 0
    ).group_by(models.Transaction.bucket_id).all()
    
    # Calculate Monthly Average (Total / 3)
    cat_avgs = {bid: total / 3.0 for bid, total in historical_totals}
    
    # Current Month Spends Aggregated
    cm_totals_res = db.query(
        models.Transaction.bucket_id,
        func.sum(func.abs(models.Transaction.amount))
    ).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.bucket_id.isnot(None),
        models.Transaction.date >= cm_start,
        models.Transaction.amount < 0
    ).group_by(models.Transaction.bucket_id).all()
    
    cm_totals = {bid: total for bid, total in cm_totals_res}
        
    # Compare
    buckets = {b.id: b for b in db.query(models.BudgetBucket).filter(models.BudgetBucket.user_id == user.id).all()}
    
    for bid, current_spent in cm_totals.items():
        avg = cat_avgs.get(bid, 0.0)
        if avg < 50: continue # Ignore small categories noise
        
        if current_spent > avg * 1.5:
            b_name = buckets[bid].name if bid in buckets else "Unknown"
            pct = int((current_spent / avg) * 100)
            anomalies.append({
                "type": "category_spike",
                "severity": "high" if pct > 200 else "medium",
                "message": f"High spending in '{b_name}'",
                "amount": current_spent,
                "date": today,
                "details": f"{pct}% of average. Spent ${current_spent:.0f} vs avg ${avg:.0f}."
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

    # Exclude Transfers
    totals_query = totals_query.filter(~models.Transaction.bucket.has(models.BudgetBucket.name == "Transfer"))
        
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

    # Exclude Transfers
    expense_query = expense_query.filter(~models.Transaction.bucket.has(models.BudgetBucket.name == "Transfer"))
        
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
    idx_budget = get_node("Budget")
    
    # Link: Income -> Budget
    if total_income > 0:
        links.append({"source": idx_income, "target": idx_budget, "value": total_income})
        
    # Groups
    idx_needs = get_node("Needs")
    idx_wants = get_node("Wants")
    idx_savings = get_node("Savings")
    idx_uncat = get_node("Uncategorized")
    
    needs_total = 0.0
    wants_total = 0.0
    
    # Buckets Logic
    for bid, amount in bucket_spend.items():
        if bid not in bucket_map: continue
        bucket = bucket_map[bid]
        
        idx_b = get_node(bucket.name)
        
        if bucket.group == "Non-Discretionary":
            links.append({"source": idx_needs, "target": idx_b, "value": amount})
            needs_total += amount
        else:
            links.append({"source": idx_wants, "target": idx_b, "value": amount})
            wants_total += amount
            
    # Uncategorized Logic
    if unallocated_spend > 0:
        links.append({"source": idx_uncat, "target": get_node("Misc"), "value": unallocated_spend})
        # Determine if uncat flows from Needs or Wants? Default to Wants or direct from Budget?
        # Let's link Budget -> Uncategorized
        links.append({"source": idx_budget, "target": idx_uncat, "value": unallocated_spend})

    # High Level Links
    if needs_total > 0:
        links.append({"source": idx_budget, "target": idx_needs, "value": needs_total})
    
    if wants_total > 0:
        links.append({"source": idx_budget, "target": idx_wants, "value": wants_total})
        
    # Savings Logic
    # Savings = Income - Expenses
    # Only if Income > Expenses
    net_savings = total_income - total_expenses
    if net_savings > 0:
        links.append({"source": idx_budget, "target": idx_savings, "value": net_savings})
        
    return {"nodes": nodes, "links": links}
