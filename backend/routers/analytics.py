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
            limit = sum(l.amount for l in b.limits)
            pre_limit = limit * pre_months
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

    # Resolve spender to member_id for limit filtering
    target_member_id = None
    if spender not in ["Combined", "Joint"]:
        member = db.query(models.HouseholdMember).filter(
            models.HouseholdMember.user_id == user.id, 
            models.HouseholdMember.name == spender
        ).first()
        if member:
            target_member_id = member.id

    for b in buckets:
        spent = spend_map.get(b.id, 0.0)
        
        # Calculate limit based on spender filter
        # - Combined: sum ALL limits (shared + per-member)
        # - Specific member: only their limit OR shared limit
        if spender == "Combined":
            base_limit = sum(l.amount for l in b.limits)
        elif target_member_id is not None:
            # Sum shared limits (member_id is None) + this member's limits
            base_limit = sum(l.amount for l in b.limits if l.member_id is None or l.member_id == target_member_id)
        else:
            # Unknown spender, fallback to shared limits only
            base_limit = sum(l.amount for l in b.limits if l.member_id is None)
        
        limit = base_limit * delta_months
        
        # Add Rollover if applicable
        if b.id in rollover_map:
             limit += rollover_map[b.id]
        
        if limit > 0:
            percent = (spent / limit) * 100
        else:
            percent = 0 if spent == 0 else 100
            
        # Calculate Upcoming Recurring
        # Simple logical check: active subscriptions for this bucket due in this date range
        upcoming_recurring = 0.0
        # This is n+1 if we query inside loop. Let's pre-fetch subscriptions.
        
        # Determine if this is a parent category (has children)
        is_parent = len(children_map.get(b.id, [])) > 0
        
        final_buckets.append({
            "id": b.id,
            "name": b.name,
            "icon": b.icon_name,
            "group": b.group,
            "is_rollover": b.is_rollover,
            "parent_id": b.parent_id,  # Include parent_id for hierarchy filtering
            "is_parent": is_parent,  # True if this bucket has child categories
            "limit": limit,
            "spent": spent,
            "remaining": limit - spent,
            "percent": percent,
            "is_over": spent > limit,
        })

    # Optimization: Pre-fetch subscriptions and map to buckets
    active_subs = db.query(models.Subscription).filter(
        models.Subscription.user_id == user.id,
        models.Subscription.is_active == True,
        models.Subscription.type == "Expense",
        models.Subscription.bucket_id.isnot(None)
    ).all()
    
    subs_by_bucket = {}
    for sub in active_subs:
        # Check if due date is in range
        # Use next_due_date. 
        # If view is "This Month", and next_due_date is in it, it's upcoming.
        if sub.next_due_date >= s_date.date() and sub.next_due_date <= e_date.date():
            subs_by_bucket.setdefault(sub.bucket_id, 0.0)
            subs_by_bucket[sub.bucket_id] += sub.amount
            
    # Update final_buckets with upcoming data
    # We do this after the loop or inside if we moved the fetch up.
    # Let's just iterate and update
    for fb in final_buckets:
        fb["upcoming_recurring"] = subs_by_bucket.get(fb["id"], 0.0)
        # Adjust remaining?
        # "available" budget usually means Limit - Spent.
        # "Upcoming" is just a warning. 
        # But user said "reduce effective available budget".
        # So "Effective Remaining" = Limit - Spent - Upcoming.
        fb["effective_remaining"] = fb["limit"] - fb["spent"] - fb["upcoming_recurring"]

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
    bucket_ids: Optional[str] = Query(None), # Comma-separated bucket IDs
    group: Optional[str] = Query(None), # Non-Discretionary, Discretionary
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    import logging
    logger = logging.getLogger("backend.analytics")
    logger.info(f"History Request: {start_date} to {end_date} for {current_user.email}")

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
    
    # Handle multiple bucket selection (new feature)
    if bucket_ids:
        # Parse comma-separated IDs
        try:
            selected_ids = [int(bid.strip()) for bid in bucket_ids.split(',') if bid.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid bucket_ids format. Use comma-separated integers.")
        
        # Fetch all hierarchy info for user
        hierarchy = db.query(models.BudgetBucket.id, models.BudgetBucket.parent_id).filter(models.BudgetBucket.user_id == user.id).all()
        
        # Build adjacency list
        adj = {}
        for bid, pid in hierarchy:
            if pid:
                adj.setdefault(pid, []).append(bid)
        
        # For each selected bucket, find all descendants
        subtree_ids = set(selected_ids)
        queue = list(selected_ids)
        while queue:
            curr = queue.pop(0)
            children = adj.get(curr, [])
            for child in children:
                if child not in subtree_ids:
                    subtree_ids.add(child)
                    queue.append(child)
        
        buckets_query = buckets_query.filter(models.BudgetBucket.id.in_(subtree_ids))
    elif bucket_id:
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
    
    # Default filters: Exclude Income and Transfers if no specific filter is applied
    if not bucket_id and not bucket_ids and not group:
        buckets_query = buckets_query.filter(
            models.BudgetBucket.group != "Income",
            models.BudgetBucket.is_transfer == False
        )
    
    # OPTIMIZATION: Use smart Python aggregation to avoid double counting limits
    # We eager load limits to perform the sum in application memory
    relevant_buckets = buckets_query.options(joinedload(models.BudgetBucket.limits)).all()
    relevant_bucket_ids = {b.id for b in relevant_buckets}

    monthly_limit_total = 0.0
    
    # Resolve spender to member_id if specific member
    target_member_id = None
    if spender not in ["Combined", "Joint"]:
        member = db.query(models.HouseholdMember).filter(
            models.HouseholdMember.user_id == user.id, 
            models.HouseholdMember.name == spender
        ).first()
        if member:
            target_member_id = member.id

    for b in relevant_buckets:
        # Check if we should skip this bucket's limit to avoid double counting
        should_skip = False
        
        # Case 1: Child bucket whose parent is also in the list AND parent 'owns' the budget
        if b.parent_id and b.parent_id in relevant_bucket_ids:
            # Find parent (optimization: could map beforehand, but relevant_buckets is usually small)
            parent = next((p for p in relevant_buckets if p.id == b.parent_id), None)
            if parent and (parent.is_group_budget or getattr(parent, 'is_shared', False)):
                should_skip = True
        
        if not should_skip and b.limits:
            # Sum limits matching the spender filter
            for l in b.limits:
                if spender == "Combined":
                     monthly_limit_total += l.amount
                elif spender == "Joint":
                    if l.member_id is None: # Shared limit
                        monthly_limit_total += l.amount
                else: # Specific member
                    if l.member_id == target_member_id:
                        monthly_limit_total += l.amount
    
    logger.info(f"Optimized Limit Calc: {monthly_limit_total} across {len(relevant_buckets)} buckets")
    
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
        
        if bucket_id or bucket_ids or group:
             query = query.filter(models.Transaction.bucket_id.in_(relevant_bucket_ids))
        
        # Note: If no filters, we include ALL expenses to match "Total Spending" paradigm
        
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
        
    logger.info(f"History calculation complete. Returning {len(history_data)} months.")
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
    existing_keywords = set()
    if exclude_existing:
        subs = db.query(models.Subscription).filter(models.Subscription.user_id == user.id).all()
        for s in subs:
            keyword = (s.description_keyword or s.name).lower()
            existing_keywords.add(keyword)

    # 1. Fetch last 12 months of transactions
    one_year_ago = datetime.now() - timedelta(days=365)
    
    all_txns = db.query(models.Transaction).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= one_year_ago
    ).order_by(models.Transaction.date.desc()).all()
    
    recommendations = []
    
    # Helper to process a group of transactions
    def process_group(txns_list, txn_type):
        from collections import defaultdict
        groups = defaultdict(list)
        
        for t in txns_list:
            key = t.description.strip().lower()
            groups[key].append(t)
            
        for name, items in groups.items():
            if len(items) < 3: continue 
            
            if exclude_existing and name in existing_keywords:
                continue
            
            # Sort by date
            items.sort(key=lambda x: x.date)
            
            # Check Amount Consistency
            amounts = [abs(x.amount) for x in items]
            avg_amount = sum(amounts) / len(amounts)
            
            # Allow 15% variance
            is_consistent_amount = all(abs(a - avg_amount) < (avg_amount * 0.15) for a in amounts) 
            
            if not is_consistent_amount: continue
    
            # Check Frequency
            dates = [x.date for x in items]
            intervals = [(dates[i] - dates[i-1]).days for i in range(1, len(dates))]
                
            avg_interval = sum(intervals) / len(intervals)
            
            frequency = None
            
            # Ranges
            if 6 <= avg_interval <= 8:
                frequency = "Weekly"
                nom_interval = 7
            elif 13 <= avg_interval <= 15:
                frequency = "Bi-Weekly"
                nom_interval = 14
            elif 25 <= avg_interval <= 35:
                frequency = "Monthly"
                nom_interval = 30
            elif 360 <= avg_interval <= 370:
                frequency = "Yearly"
                nom_interval = 365
                
            if frequency:
                last_date = dates[-1]
                next_due = last_date + timedelta(days=int(nom_interval))
                
                # Confidence
                variance_score = sum(abs(a - avg_amount) for a in amounts) / (len(amounts) * avg_amount)
                confidence = "High" if variance_score < 0.05 else "Medium"
                
                recommendations.append({
                    "name": items[0].description, 
                    "description_keyword": name,
                    "amount": avg_amount,
                    "type": txn_type,
                    "frequency": frequency,
                    "annual_cost": avg_amount * (365/nom_interval),
                    "next_due": next_due,
                    "confidence": confidence,
                    "last_payment_date": last_date
                })

    # Pass 1: Expenses
    expenses = [t for t in all_txns if t.amount < 0]
    process_group(expenses, "Expense")
    
    # Pass 2: Income
    income = [t for t in all_txns if t.amount > 0]
    process_group(income, "Income")
            
    return recommendations


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
    
    # Get bucket IDs to exclude from anomaly detection (transfers and one-offs)
    excluded_bucket_ids = [b.id for b in db.query(models.BudgetBucket).filter(
        models.BudgetBucket.user_id == user.id,
        (models.BudgetBucket.is_transfer == True) | (models.BudgetBucket.is_one_off == True)
    ).all()]
    
    # 1. Large Transactions (Dynamic Threshold based on last 90 days)
    ninety_days_ago = today - timedelta(days=90)
    
    # Fetch all expenses in last 90 days (excluding transfers and one-offs)
    recent_txns = db.query(models.Transaction).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= ninety_days_ago,
        models.Transaction.amount < 0,
        ~models.Transaction.bucket_id.in_(excluded_bucket_ids) if excluded_bucket_ids else True
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
    
    # Aggregate by Bucket and Month (excluding transfers)
    bucket_monthly = {} # bid -> { 'yyyy-mm': total }
    from collections import defaultdict
    bucket_monthly = defaultdict(lambda: defaultdict(float))
    
    for t in hist_txns:
        # Skip transfer buckets and one-offs
        if t.bucket_id in excluded_bucket_ids:
            continue
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



@router.get("/transactions/stats")
def get_transaction_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get high-level statistics about transactions.
    Used for achievements and dashboard summaries.
    """
    total_count = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id
    ).count()
    
    return {"total_count": total_count}


@router.get("/sankey")
def get_sankey_data(
    start_date: str = Query(..., description="ISO Date string"), 
    end_date: str = Query(..., description="ISO Date string"),
    spender: str = Query(default="Combined"),
    exclude_one_offs: bool = Query(default=False),
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

    if exclude_one_offs:
        totals_query = totals_query.filter(
            ~models.Transaction.bucket.has(models.BudgetBucket.is_one_off == True)
        )
        
    totals_res = totals_query.first()
    total_expenses = abs(totals_res.expenses or 0.0)
    total_income = totals_res.income or 0.0
    
    # 2. Fetch NET Spending by Bucket (expenses minus refunds)
    # This allows refunds to offset expenses within the same bucket
    expense_query = db.query(
        models.Transaction.bucket_id,
        func.sum(models.Transaction.amount)  # Sum all transactions (negative = expense, positive = refund)
    ).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= s_date,
        models.Transaction.date <= e_date,
        # Include both expenses AND refunds for expense buckets
        # (we'll filter to only show buckets with net negative later)
    )
    
    if spender != "Combined":
        expense_query = expense_query.filter(models.Transaction.spender == spender)

    # Exclude Transfer and Investment buckets from expense view
    expense_query = expense_query.filter(
        ~models.Transaction.bucket.has(models.BudgetBucket.is_transfer == True),
        ~models.Transaction.bucket.has(models.BudgetBucket.is_investment == True),
        # Also exclude Income group buckets from expense calculation
        ~models.Transaction.bucket.has(models.BudgetBucket.group == "Income")
    )

    if exclude_one_offs:
        expense_query = expense_query.filter(
            ~models.Transaction.bucket.has(models.BudgetBucket.is_one_off == True)
        )
        
    expense_results = expense_query.group_by(models.Transaction.bucket_id).all()
    
    # Map bucket_id -> NET spent (only include buckets with net negative balance)
    # Positive amounts mean more refunds than expenses - these won't show in Sankey
    bucket_spend = {bid: abs(amt) for bid, amt in expense_results if bid is not None and amt is not None and amt < 0}
    unallocated_spend = sum(abs(amt) for bid, amt in expense_results if bid is None and amt is not None and amt < 0)
    
    # 3. Get Bucket Details for Names/Groups
    buckets = db.query(models.BudgetBucket).filter(models.BudgetBucket.user_id == user.id).all()
    bucket_map = {b.id: b for b in buckets}
    
    # 4. Construct Nodes & Links
    nodes = []
    links = []
    node_indices = {}
    node_children = {}  # Track children for each parent node (for drill-down)
    
    def get_node(name, bucket_id=None, group=None):
        if name not in node_indices:
            node_indices[name] = len(nodes)
            nodes.append({"name": name, "bucket_id": bucket_id, "group": group, "children": []})
        return node_indices[name]
    
    # Root Node: Total Income (center of diagram)
    idx_income = get_node("Income")
    
    # --- INCOME BREAKDOWN BY BUCKET ---
    # Query income by bucket to show each income stream
    income_by_bucket_query = db.query(
        models.Transaction.bucket_id,
        func.sum(models.Transaction.amount)
    ).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= s_date,
        models.Transaction.date <= e_date,
        models.Transaction.amount > 0,  # Only income
        ~models.Transaction.bucket.has(models.BudgetBucket.is_transfer == True)
    )
    
    if spender != "Combined":
        income_by_bucket_query = income_by_bucket_query.filter(models.Transaction.spender == spender)
        
    income_results = income_by_bucket_query.group_by(models.Transaction.bucket_id).all()
    
    # Helper to check if a bucket belongs to Income group (check self AND parent)
    def is_income_bucket(bucket):
        if bucket.group == "Income":
            return True
        # Check parent bucket's group (for inherited categories)
        if bucket.parent_id and bucket.parent_id in bucket_map:
            parent = bucket_map[bucket.parent_id]
            if parent.group == "Income":
                return True
        return False
    
    # Track income by category
    income_by_bucket = {}
    other_income_total = 0.0
    
    for bid, amount in income_results:
        if amount is None or amount <= 0:
            continue
            
        if bid is None:
            # Uncategorized income
            other_income_total += amount
        elif bid in bucket_map:
            bucket = bucket_map[bid]
            # Only show buckets from Income group on income side
            if is_income_bucket(bucket):
                income_by_bucket[bucket.name] = income_by_bucket.get(bucket.name, 0) + amount
            # Refunds to expense buckets are now netted in expense calculation
            # so we don't add them to Other Income
    
    # Create income bucket nodes flowing INTO "Income"
    for bucket_name, amount in income_by_bucket.items():
        if amount > 0:
            idx_income_bucket = get_node(bucket_name)
            links.append({"source": idx_income_bucket, "target": idx_income, "value": amount})
    
    # Handle other/uncategorized income
    if other_income_total > 0:
        idx_other_income = get_node("Other Income")
        links.append({"source": idx_other_income, "target": idx_income, "value": other_income_total})
    
    # --- EXPENSE GROUPS (Income -> Groups) ---
    # Create Discretionary FIRST so it appears higher in the diagram
    idx_disc = get_node("Discretionary")         # Formerly Wants
    idx_non_disc = get_node("Non-Discretionary") # Formerly Needs
    idx_uncat = get_node("Uncategorized")
    
    non_disc_total = 0.0
    disc_total = 0.0
    
    # Roll up child spending into parent categories for cleaner visualization
    # This reduces nodes dramatically and fixes potential stack overflow
    parent_spend = {}  # parent_id -> total_amount
    parent_children = {}  # parent_id -> [{name, amount}, ...] for drill-down
    
    # Helper to find root parent bucket
    def get_root_parent(bucket):
        """Find the top-level parent bucket (or self if no parent)"""
        if bucket.parent_id is None:
            return bucket
        parent = bucket_map.get(bucket.parent_id)
        if parent:
            return get_root_parent(parent)
        return bucket
    
    # Aggregate spending into parent categories AND track children
    for bid, amount in bucket_spend.items():
        if bid not in bucket_map: 
            continue
        bucket = bucket_map[bid]
        root = get_root_parent(bucket)
        
        if root.id not in parent_spend:
            parent_spend[root.id] = 0.0
            parent_children[root.id] = []
        parent_spend[root.id] += amount
        
        # Track children (including self if it's not the root)
        if bid != root.id:
            parent_children[root.id].append({
                "name": bucket.name,
                "amount": amount,
                "bucket_id": bid
            })
    
    # Collect parent buckets by group for ordered processing
    disc_buckets = []
    non_disc_buckets = []
    
    for parent_id, amount in parent_spend.items():
        if parent_id not in bucket_map: 
            continue
        bucket = bucket_map[parent_id]
        children = sorted(parent_children.get(parent_id, []), key=lambda x: x["amount"], reverse=True)
        
        if bucket.group == "Non-Discretionary":
            non_disc_buckets.append((bucket.name, amount, parent_id, children))
            non_disc_total += amount
        else:
            disc_buckets.append((bucket.name, amount, parent_id, children))
            disc_total += amount
    
    # Sort by amount descending within each group
    disc_buckets.sort(key=lambda x: x[1], reverse=True)
    non_disc_buckets.sort(key=lambda x: x[1], reverse=True)
    
    # Process Discretionary first (will appear higher in diagram)
    for bucket_name, amount, bucket_id, children in disc_buckets:
        idx_b = get_node(bucket_name, bucket_id=bucket_id, group="Discretionary")
        nodes[idx_b]["children"] = children
        links.append({"source": idx_disc, "target": idx_b, "value": amount})
    
    # Then Non-Discretionary
    for bucket_name, amount, bucket_id, children in non_disc_buckets:
        idx_b = get_node(bucket_name, bucket_id=bucket_id, group="Non-Discretionary")
        nodes[idx_b]["children"] = children
        links.append({"source": idx_non_disc, "target": idx_b, "value": amount})
            
    # Uncategorized Logic
    if unallocated_spend > 0:
        links.append({"source": idx_income, "target": idx_uncat, "value": unallocated_spend})
        # Layer 3 for Uncategorized
        links.append({"source": idx_uncat, "target": get_node("Misc"), "value": unallocated_spend})

    # High Level Links (Income -> Groups) - Discretionary first for visual ordering
    if disc_total > 0:
        links.append({"source": idx_income, "target": idx_disc, "value": disc_total})
    
    if non_disc_total > 0:
        links.append({"source": idx_income, "target": idx_non_disc, "value": non_disc_total})
        
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


# --- Budget Progress (comprehensive view with history and member breakdown) ---

@router.get("/budget-progress")
def get_budget_progress(
    months: int = Query(6, ge=1, le=12, description="Months of history for sparklines"),
    spender: str = Query(default="Combined", description="Filter by spender"),
    start_date: str = Query(None, description="Optional ISO start date for custom period"),
    end_date: str = Query(None, description="Optional ISO end date for custom period"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get comprehensive budget progress data for all categories.
    Includes spending for selected period, N months history, per-member breakdown, and trend.
    """
    user = current_user
    today = date.today()
    
    # Determine period range - use custom dates if provided, otherwise current month
    if start_date and end_date:
        try:
            current_start = date.fromisoformat(start_date)
            current_end = date.fromisoformat(end_date)
            period_label = f"{current_start.strftime('%b %d')} - {current_end.strftime('%b %d, %Y')}"
        except ValueError:
            # Fallback to current month if date parsing fails
            current_start = today.replace(day=1)
            if today.month == 12:
                current_end = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                current_end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
            period_label = current_start.strftime('%B %Y')
    else:
        # Current month range (default)
        current_start = today.replace(day=1)
        if today.month == 12:
            current_end = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            current_end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
        period_label = current_start.strftime('%B %Y')
    
    # History start (N months back)
    history_start = (current_start - timedelta(days=months * 30)).replace(day=1)
    
    # Fetch all buckets (tree structure flattened)
    buckets = db.query(models.BudgetBucket).filter(
        models.BudgetBucket.user_id == user.id,
        models.BudgetBucket.is_transfer == False,
        models.BudgetBucket.is_hidden == False
    ).all()
    
    if not buckets:
        return {"period": {}, "score": 0, "summary": {}, "categories": []}
    
    bucket_ids = [b.id for b in buckets]
    bucket_map = {b.id: b for b in buckets}
    
    # Separate parent vs child buckets - only parent buckets will be shown as cards
    parent_buckets = [b for b in buckets if b.parent_id is None]
    child_buckets = [b for b in buckets if b.parent_id is not None]
    
    # Build parent -> children map for rollup
    children_map = {}
    for child in child_buckets:
        if child.parent_id not in children_map:
            children_map[child.parent_id] = []
        children_map[child.parent_id].append(child)
    
    # Fetch household members for breakdown
    members = db.query(models.HouseholdMember).filter(
        models.HouseholdMember.user_id == user.id
    ).order_by(models.HouseholdMember.id).all()
    member_names = {m.name: m.id for m in members}
    member_colors = {m.name: m.color for m in members}
    
    # Create spender -> member name mapping
    # The Transaction.spender field stores old values like "User A", "User B"
    # Map them to actual member names
    spender_to_member = {}
    legacy_names = ["User A", "User B"]  # Old default names
    for i, legacy_name in enumerate(legacy_names):
        if i < len(members):
            spender_to_member[legacy_name] = members[i].name
    # Also map Joint and actual member names
    spender_to_member["Joint"] = "Joint"
    for m in members:
        spender_to_member[m.name] = m.name
    
    # Fetch per-member limits for all buckets
    all_limits = db.query(models.BudgetLimit).filter(
        models.BudgetLimit.bucket_id.in_(bucket_ids)
    ).all()
    
    # Map: bucket_id -> member_id -> limit_amount
    bucket_member_limits = {}
    member_id_to_name = {m.id: m.name for m in members}
    for limit in all_limits:
        if limit.bucket_id not in bucket_member_limits:
            bucket_member_limits[limit.bucket_id] = {}
        if limit.member_id and limit.member_id in member_id_to_name:
            member_name = member_id_to_name[limit.member_id]
            bucket_member_limits[limit.bucket_id][member_name] = limit.amount
    
    
    # ===== CURRENT MONTH SPENDING =====
    current_query = db.query(
        models.Transaction.bucket_id,
        models.Transaction.spender,
        func.sum(models.Transaction.amount)
    ).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.bucket_id.in_(bucket_ids),
        models.Transaction.date >= current_start,
        models.Transaction.date <= current_end,
        models.Transaction.amount < 0  # Expenses only
    )
    
    if spender != "Combined":
        current_query = current_query.filter(models.Transaction.spender == spender)
    
    current_results = current_query.group_by(
        models.Transaction.bucket_id, 
        models.Transaction.spender
    ).all()
    
    # Aggregate by bucket and by member (using mapped names to avoid duplicates)
    bucket_spent = {}  # bucket_id -> total
    bucket_by_member = {}  # bucket_id -> {mapped_member_name: amount}
    
    for bid, spndr, total in current_results:
        if bid is None:
            continue
        amt = abs(total) if total else 0
        bucket_spent[bid] = bucket_spent.get(bid, 0) + amt
        
        # Map raw spender to actual member name BEFORE aggregating
        mapped_name = spender_to_member.get(spndr, spndr) if spndr else "Unknown"
        
        if bid not in bucket_by_member:
            bucket_by_member[bid] = {}
        bucket_by_member[bid][mapped_name] = bucket_by_member[bid].get(mapped_name, 0) + amt
    
    # ===== HISTORY (last N months) =====
    history_query = db.query(
        models.Transaction.bucket_id,
        extract('year', models.Transaction.date).label('year'),
        extract('month', models.Transaction.date).label('month'),
        func.sum(models.Transaction.amount)
    ).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.bucket_id.in_(bucket_ids),
        models.Transaction.date >= history_start,
        models.Transaction.date < current_start,  # Exclude current month
        models.Transaction.amount < 0
    )
    
    if spender != "Combined":
        history_query = history_query.filter(models.Transaction.spender == spender)
    
    history_results = history_query.group_by(
        models.Transaction.bucket_id, 'year', 'month'
    ).all()
    
    # Build history map: bucket_id -> [{month_name, amount}, ...]
    bucket_history = {}
    for bid, yr, mo, total in history_results:
        if bid is None:
            continue
        if bid not in bucket_history:
            bucket_history[bid] = {}
        key = f"{int(yr)}-{int(mo):02d}"
        bucket_history[bid][key] = abs(total) if total else 0
    
    # Generate month labels for sparkline
    month_labels = []
    current = history_start
    while current < current_start:
        month_labels.append({
            "key": current.strftime("%Y-%m"),
            "label": current.strftime("%b")
        })
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)
    
    # ===== BUILD CATEGORY DATA =====
    # Calculate upcoming recurring expenses
    active_subs = db.query(models.Subscription).filter(
        models.Subscription.user_id == user.id,
        models.Subscription.is_active == True,
        models.Subscription.bucket_id.isnot(None)
    ).all()
    
    bucket_upcoming = {}
    for sub in active_subs:
        if sub.next_due_date and sub.next_due_date > today and sub.next_due_date <= current_end:
            bucket_upcoming[sub.bucket_id] = bucket_upcoming.get(sub.bucket_id, 0) + sub.amount

    categories = []
    on_track = 0
    over_budget = 0
    under_budget = 0
    total_saved = 0.0
    
    # Only iterate parent buckets - child spending/limits will be rolled up
    for b in parent_buckets:
        # Skip income buckets
        if b.group == "Income":
            continue
        
        # Get children for this parent
        children = children_map.get(b.id, [])
        child_ids = [c.id for c in children]
        all_bucket_ids = [b.id] + child_ids
        
        # Roll up spent from parent + all children
        spent = sum(bucket_spent.get(bid, 0) for bid in all_bucket_ids)
        
        # Roll up upcoming from parent + all children
        upcoming = sum(bucket_upcoming.get(bid, 0) for bid in all_bucket_ids)
        
        # Calculate limit based on is_group_budget flag
        # If is_group_budget=True: Budget is set at parent level only (children share this budget)
        # If is_group_budget=False: Budget is sum of child limits (parent is just a container)
        if b.is_group_budget or getattr(b, 'is_shared', False) or not children:
            # Parent-level budget OR Shared budget OR no children - use parent's limits only
            limit = sum(l.amount for l in b.limits) if b.limits else 0
        else:
            # Children have their own budgets - sum only child limits
            limit = 0
            for child in children:
                limit += sum(l.amount for l in child.limits) if child.limits else 0
            # If children have no limits but parent does, fallback to parent
            if limit == 0:
                limit = sum(l.amount for l in b.limits) if b.limits else 0
        
        # Calculate percentage
        if limit > 0:
            percent = (spent / limit) * 100
        else:
            percent = 0 if spent == 0 else 100
        
        # Status
        if limit == 0:
            status = "no_limit"
        elif spent > limit:
            status = "over"
            over_budget += 1
        elif spent > limit * 0.9:
            status = "warning"
            on_track += 1
        else:
            status = "on_track"
            on_track += 1
            if limit > 0:
                total_saved += (limit - spent)
        
        # Build history array for sparkline - aggregate parent + children
        history = []
        hist_amounts = []
        for ml in month_labels:
            amt = sum(bucket_history.get(bid, {}).get(ml["key"], 0) for bid in all_bucket_ids)
            history.append({
                "month": ml["label"],
                "amount": round(amt, 2)
            })
            if amt > 0:
                hist_amounts.append(amt)
        
        # Calculate trend vs average (or vs last month)
        trend = 0
        if hist_amounts:
            avg_hist = sum(hist_amounts) / len(hist_amounts)
            if avg_hist > 0:
                trend = round(((spent - avg_hist) / avg_hist) * 100, 1)
        
        # Member breakdown - aggregate from parent + children
        by_member = []
        combined_member_data = {}
        for bid in all_bucket_ids:
            member_data = bucket_by_member.get(bid, {})
            for member_name, amt in member_data.items():
                combined_member_data[member_name] = combined_member_data.get(member_name, 0) + amt
        
        total_for_pct = sum(combined_member_data.values()) or 1
        
        # Aggregate per-member limits from parent + children
        combined_member_limits = {}
        for bid in all_bucket_ids:
            per_member_limits = bucket_member_limits.get(bid, {})
            for member_name, amt in per_member_limits.items():
                combined_member_limits[member_name] = combined_member_limits.get(member_name, 0) + amt
        
        for member_name, amt in sorted(combined_member_data.items(), key=lambda x: -x[1]):
            # Skip "Joint" in member breakdown as it's not a specific person
            if member_name == "Joint":
                continue
                
            # Get this member's aggregated limit
            member_limit = combined_member_limits.get(member_name, 0)
            if member_limit == 0:
                # If no per-member limit, show as share of total limit
                member_limit = limit / max(1, len(members)) if members else limit
            
            # Calculate member's percent of their limit
            member_percent = (amt / member_limit * 100) if member_limit > 0 else 0
            
            by_member.append({
                "name": member_name,
                "amount": round(amt, 2),
                "percent": round((amt / total_for_pct) * 100, 1),  # % of total spent
                "limit": round(member_limit, 2),
                "limit_percent": round(member_percent, 1),  # % of their individual limit
                "color": member_colors.get(member_name, "#6366f1")
            })
        
        # Build children breakdown for drill-down (optional)
        children_data = []
        for child in children:
            child_spent = bucket_spent.get(child.id, 0)
            child_limit = sum(l.amount for l in child.limits) if child.limits else 0
            if child_spent > 0 or child_limit > 0:
                children_data.append({
                    "id": child.id,
                    "name": child.name,
                    "spent": round(child_spent, 2),
                    "limit": round(child_limit, 2),
                    "percent": round((child_spent / child_limit * 100) if child_limit > 0 else 0, 1)
                })
        children_data.sort(key=lambda x: -x["spent"])
        
        categories.append({
            "id": b.id,
            "name": b.name,
            "icon": b.icon_name,
            "group": b.group,
            "limit": round(limit, 2),
            "spent": round(spent, 2),
            "upcoming": round(upcoming, 2),
            "remaining": round(max(0, limit - spent), 2),
            "percent": round(percent, 1),
            "status": status,
            "trend": trend,
            "history": history,
            "by_member": by_member,
            "children": children_data
        })
    
    # Sort: over budget first, then by percent descending
    categories.sort(key=lambda x: (-1 if x["status"] == "over" else 0, -x["percent"]))
    
    # Calculate overall score (0-100)
    total_cats = on_track + over_budget
    if total_cats > 0:
        base_score = int((on_track / total_cats) * 100)
    else:
        base_score = 100
    
    # Bonus for savings and penalize for overspending
    score = min(100, max(0, base_score))
    
    return {
        "period": {
            "start": current_start.isoformat(),
            "end": current_end.isoformat(),
            "label": period_label
        },
        "score": score,
        "summary": {
            "on_track": on_track,
            "over_budget": over_budget,
            "total_saved": round(total_saved, 2)
        },
        "categories": categories
    }


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


@router.get("/forecast")
def get_cash_flow_forecast(
    days: int = 90,
    include_discretionary: bool = True, # Whether to subtract burn rate
    account_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    user = current_user
    today = datetime.now().date()
    end_date = today + timedelta(days=days)
    
    # 1. Starting Balance
    if account_id:
        acc = db.query(models.Account).filter(models.Account.id == account_id, models.Account.user_id == user.id).first()
        if not acc: raise HTTPException(status_code=404, detail="Account not found")
        current_balance = acc.balance
    else:
        # Sum of all Asset accounts (Bank type or just sum positive ones?)
        # Let's assume all accounts (Credit Cards are negative liabilities) = Net Worth (Liquid)
        # Actually usually Forecast is "Cash Flow". 
        # Including Credit Card Balance (negative) is correct: "Current Net Cash Position".
        accounts = db.query(models.Account).filter(models.Account.user_id == user.id).all()
        current_balance = sum(a.balance for a in accounts) 
        
    # 2. Daily Burn Rate (Variable Spend)
    # Includes Discretionary, Non-Discretionary, and Rollover (irregular expenses)
    # Excludes: transfers, investments, one-off, and income
    daily_burn = 0.0
    daily_income = 0.0
    burn_start = today - timedelta(days=90)
    
    if include_discretionary:
        burn_txns = db.query(models.Transaction).filter(
            models.Transaction.user_id == user.id,
            models.Transaction.date >= burn_start,
            models.Transaction.amount < 0,
            # Exclude Transfers (not real spending)
            ~models.Transaction.bucket.has(models.BudgetBucket.is_transfer == True),
            # Exclude Investments (wealth building, not spending)
            ~models.Transaction.bucket.has(models.BudgetBucket.is_investment == True),
            # Exclude One-Off items (tax, large non-recurring purchases)
            ~models.Transaction.bucket.has(models.BudgetBucket.is_one_off == True)
            # Note: Rollover buckets ARE included (irregular expenses like car rego, annual bills)
        ).all()
        
        # Include ALL expense transactions for accurate cash flow
        # This includes uncategorized transactions too (bucket may be None)
        real_spend = sum(abs(t.amount) for t in burn_txns)
        daily_burn = real_spend / 90
    
    # 2b. Average Daily Income (from last 90 days)
    # Includes all positive transactions except transfers and one-offs
    income_txns = db.query(models.Transaction).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= burn_start,
        models.Transaction.amount > 0,
        # Exclude Transfers (not real income)
        ~models.Transaction.bucket.has(models.BudgetBucket.is_transfer == True),
        # Exclude One-Off items (e.g. tax refunds, insurance payouts)
        ~models.Transaction.bucket.has(models.BudgetBucket.is_one_off == True)
    ).all()
    
    # Include ALL income transactions for accurate cash flow
    total_income = sum(t.amount for t in income_txns)
    daily_income = total_income / 90
    
    # 3. Recurring Items (Future)
    subscriptions = db.query(models.Subscription).filter(
        models.Subscription.user_id == user.id,
        models.Subscription.is_active == True
    ).all()
    
    # 4. Projection Loop
    forecast_data = []
    running_balance = current_balance
    min_balance = running_balance
    
    # Pre-calculate events
    events_by_date = {}
    
    for sub in subscriptions:
        current_due = sub.next_due_date
        
        # Advance to window
        while current_due < today:
             if sub.frequency == "Monthly": current_due += timedelta(days=30)
             elif sub.frequency == "Weekly": current_due += timedelta(days=7)
             elif sub.frequency == "Bi-Weekly": current_due += timedelta(days=14)
             elif sub.frequency == "Yearly": 
                 try: current_due = current_due.replace(year=current_due.year + 1)
                 except: current_due += timedelta(days=365)
             else: current_due += timedelta(days=30)
             
        # Collect events
        while current_due <= end_date:
            if current_due not in events_by_date: events_by_date[current_due] = []
            
            # Logic: Expense = subtract, Income = add
            # Subscription.amount is typically positive magnitude.
            amt = abs(sub.amount)
            if sub.type == "Expense": amt = -amt
            # If type is Income, amt remains positive
            
            events_by_date[current_due].append({
                "name": sub.name,
                "amount": amt,
                "type": sub.type
            })
            
            # Next occurrence
            if sub.frequency == "Monthly": current_due += timedelta(days=30)
            elif sub.frequency == "Weekly": current_due += timedelta(days=7)
            elif sub.frequency == "Bi-Weekly": current_due += timedelta(days=14)
            elif sub.frequency == "Yearly":
                 try: current_due = current_due.replace(year=current_due.year + 1)
                 except: current_due += timedelta(days=365)
            else: current_due += timedelta(days=30)
            
    # Simulate
    forecast_data.append({
        "date": today,
        "balance": running_balance,
        "label": "Today",
        "events": [],
        "is_projected": False
    })
    
    for d in range(1, days + 1):
        f_date = today + timedelta(days=d)
        daily_change = 0.0
        
        # Recurring events (subscriptions - both income and expenses)
        events = events_by_date.get(f_date, [])
        for e in events: daily_change += e["amount"]
        
        # Average daily income (from historical data)
        daily_change += daily_income
        
        # Burn Rate (average daily expenses)
        daily_change -= daily_burn
        
        running_balance += daily_change
        min_balance = min(min_balance, running_balance)
        
        forecast_data.append({
            "date": f_date,
            "balance": running_balance,
            "label": f_date.strftime("%b %d"),
            "events": events,
            "is_projected": True
        })
        
    return {
        "current_balance": current_balance,
        "daily_burn_rate": round(daily_burn, 2),
        "daily_income_rate": round(daily_income, 2),
        "net_daily_rate": round(daily_income - daily_burn, 2),
        "min_projected_balance": round(min_balance, 2),
        "forecast": forecast_data
    }


# --- AI Chat ---

@router.post("/chat", response_model=schemas.ChatResponse)
def chat_with_ai(
    request: schemas.ChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Natural language query about user's finances.
    Uses AI to answer questions based on transaction history, budgets, and accounts.
    """
    from ..services.ai_assistant import get_ai_assistant
    
    assistant = get_ai_assistant()
    result = assistant.answer_query(current_user.id, request.question, db)
    
    return schemas.ChatResponse(
        answer=result.get("answer", "I couldn't process your question."),
        data_points=result.get("data_points", []),
        suggestions=result.get("suggestions", [])
    )


# --- Savings Opportunities ---

@router.get("/savings-opportunities")
def get_savings_opportunities(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Analyze spending patterns and suggest savings opportunities.
    Returns actionable recommendations for reducing spending.
    """
    user = current_user
    today = datetime.now()
    thirty_days_ago = today - timedelta(days=30)
    sixty_days_ago = today - timedelta(days=60)
    
    opportunities = []
    
    # 1. Find categories significantly over budget
    buckets = db.query(models.BudgetBucket).filter(
        models.BudgetBucket.user_id == user.id
    ).all()
    
    bucket_map = {b.id: b for b in buckets}
    
    # Get current month spending by category
    current_spending = db.query(
        models.Transaction.bucket_id,
        func.sum(models.Transaction.amount)
    ).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= thirty_days_ago,
        models.Transaction.amount < 0
    ).group_by(models.Transaction.bucket_id).all()
    
    for bucket_id, total in current_spending:
        if bucket_id not in bucket_map:
            continue
        bucket = bucket_map[bucket_id]
        spent = abs(total)
        
        # Skip transfers, investments, rollover, and one-off buckets
        if bucket.is_transfer or bucket.is_investment or bucket.is_rollover or getattr(bucket, 'is_one_off', False):
            continue
        
        # Get budget limits from member limits
        budget_limit = 0
        if bucket.limits:
            budget_limit = sum(l.amount for l in bucket.limits)
        
        # Check if over budget
        if budget_limit > 0 and spent > budget_limit:
            over_amount = spent - budget_limit
            over_percent = int((over_amount / budget_limit) * 100)
            
            opportunities.append({
                "category": bucket.name,
                "type": "over_budget",
                "potential_savings": round(over_amount, 2),
                "message": f"You're ${over_amount:.0f} ({over_percent}%) over budget in {bucket.name}",
                "action": f"Reduce {bucket.name} spending to save ${over_amount:.0f}/month",
                "severity": "high" if over_percent > 50 else "medium"
            })
    
    # 2. Find unused or underused subscriptions
    subs = db.query(models.Subscription).filter(
        models.Subscription.user_id == user.id,
        models.Subscription.is_active == True,
        models.Subscription.type == "Expense"
    ).all()
    
    # Get all transaction descriptions in last 60 days
    recent_txn_descs = [t.description.lower() for t in db.query(models.Transaction).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= sixty_days_ago
    ).all()]
    
    for sub in subs:
        # Check if subscription keyword appears in transactions
        keyword = (sub.description_keyword or sub.name).lower()
        matched = any(keyword in desc for desc in recent_txn_descs)
        
        if not matched and sub.amount >= 10:  # Only flag subs >= $10
            opportunities.append({
                "category": "Subscriptions",
                "type": "unused_subscription",
                "potential_savings": round(sub.amount * 12, 2),  # Yearly savings
                "message": f"'{sub.name}' ({sub.frequency}) hasn't been used recently",
                "action": f"Consider canceling {sub.name} to save ${sub.amount:.0f}/{sub.frequency.lower()}",
                "severity": "medium" if sub.amount < 50 else "high"
            })
    
    # 3. Find discretionary categories that spiked vs last month
    last_month_spending = db.query(
        models.Transaction.bucket_id,
        func.sum(models.Transaction.amount)
    ).filter(
        models.Transaction.user_id == user.id,
        models.Transaction.date >= sixty_days_ago,
        models.Transaction.date < thirty_days_ago,
        models.Transaction.amount < 0
    ).group_by(models.Transaction.bucket_id).all()
    
    last_month_map = {bid: abs(amt) for bid, amt in last_month_spending if amt}
    
    for bucket_id, total in current_spending:
        if bucket_id not in bucket_map:
            continue
        bucket = bucket_map[bucket_id]
        
        # Only check discretionary categories, skip transfers/investments/rollover/one-off
        if bucket.group != "Discretionary" or bucket.is_transfer or bucket.is_investment or bucket.is_rollover or getattr(bucket, 'is_one_off', False):
            continue
        
        current = abs(total)
        previous = last_month_map.get(bucket_id, 0)
        
        if previous > 0 and current > previous * 1.5:  # 50% increase
            # Skip if this category already has an over_budget opportunity (avoid duplicate)
            if any(o["category"] == bucket.name and o["type"] == "over_budget" for o in opportunities):
                continue
            increase = current - previous
            opportunities.append({
                "category": bucket.name,
                "type": "spending_spike",
                "potential_savings": round(increase, 2),
                "message": f"{bucket.name} spending up {int((increase/previous)*100)}% vs last month",
                "action": f"Return to last month's level to save ${increase:.0f}",
                "severity": "medium"
            })
    
    # Sort by potential savings descending
    opportunities.sort(key=lambda x: x["potential_savings"], reverse=True)
    
    # Calculate total potential savings
    total_savings = sum(o["potential_savings"] for o in opportunities[:10])
    
    return {
        "opportunities": opportunities[:10],  # Top 10
        "total_potential_savings": round(total_savings, 2),
        "count": len(opportunities)
    }
