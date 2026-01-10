from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime, timedelta
from .. import models, schemas, database, auth

router = APIRouter(
    prefix="/goals",
    tags=["Goals"]
)

@router.get("", response_model=List[schemas.Goal])
def get_goals(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    goals = db.query(models.Goal).filter(models.Goal.user_id == current_user.id).all()
    
    # Calculate current_amount for each goal
    for goal in goals:
        if goal.linked_account_id:
            # Linked Mode: Fetch latest balance from NetWorthSnapshot (if available)
            # This is complex because we need the snapshot history. 
            # Simplified approach: Check if Account has a "holdings" value or sum transactions?
            # Actually, `Account` model doesn't store balance. `AccountBalance` table does.
            # Let's get the LATEST snapshot for this user.
            latest_snapshot = db.query(models.NetWorthSnapshot)\
                .filter(models.NetWorthSnapshot.user_id == current_user.id)\
                .order_by(models.NetWorthSnapshot.date.desc())\
                .first()
            
            goal.current_amount = 0.0
            if latest_snapshot:
                # Find balance for this account
                # We need to query AccountBalance directly
                balance_entry = db.query(models.AccountBalance)\
                    .filter(
                        models.AccountBalance.snapshot_id == latest_snapshot.id,
                        models.AccountBalance.account_id == goal.linked_account_id
                    ).first()
                if balance_entry:
                    goal.current_amount = balance_entry.balance
        else:
            # Manual Mode: Sum of linked transactions
            # Note: Transactions can be negative (spending) or positive (income).
            # Usually users link POSITIVE transfers/savings to a goal.
            # But if they link expenses, it might be weird.
            # We will simple Sum(amount). If it's a "Savings Goal", we expect positive transfers in.
            # Logic: Sum(amount) of all transactions linked to this goal.
            total = db.query(func.sum(models.Transaction.amount))\
                .filter(
                    models.Transaction.goal_id == goal.id, 
                    models.Transaction.user_id == current_user.id
                ).scalar()
            goal.current_amount = total if total else 0.0

    return goals

@router.post("/", response_model=schemas.Goal)
def create_goal(
    goal: schemas.GoalCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_goal = models.Goal(**goal.dict(), user_id=current_user.id)
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

@router.put("/{goal_id}", response_model=schemas.Goal)
def update_goal(
    goal_id: int,
    goal_update: schemas.GoalUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_goal = db.query(models.Goal).filter(models.Goal.id == goal_id, models.Goal.user_id == current_user.id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    for key, value in goal_update.dict(exclude_unset=True).items():
        setattr(db_goal, key, value)
    
    db.commit()
    db.refresh(db_goal)
    return db_goal

@router.delete("/{goal_id}")
def delete_goal(
    goal_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_goal = db.query(models.Goal).filter(models.Goal.id == goal_id, models.Goal.user_id == current_user.id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Unlink transactions before deleting
    db.query(models.Transaction).filter(models.Transaction.goal_id == goal_id).update({"goal_id": None})
    
    db.delete(db_goal)
    db.commit()
    return {"ok": True}


# ==========================================
# CATEGORY GOALS (Streak-based Spending Limits)
# ==========================================

@router.post("/category", response_model=schemas.CategoryGoal)
def create_category_goal(
    goal: schemas.CategoryGoalCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Check if a goal already exists for this bucket?
    # Let's allow one per bucket for now.
    existing = db.query(models.CategoryGoal).filter(
        models.CategoryGoal.bucket_id == goal.bucket_id,
        models.CategoryGoal.user_id == current_user.id
    ).first()
    
    if existing:
        # Update existing?
        existing.target_amount = goal.target_amount
        # Reset start date on major change? Let's keep start date unless explicitly requested.
        # existing.start_date = func.now() 
        db.commit()
        db.refresh(existing)
        return existing
        
    db_goal = models.CategoryGoal(
        user_id=current_user.id,
        bucket_id=goal.bucket_id,
        target_amount=goal.target_amount
    )
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

@router.get("/category")
def get_category_goals(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    goals = db.query(models.CategoryGoal).filter(models.CategoryGoal.user_id == current_user.id).all()
    
    results = []
    
    # Pre-fetch buckets to get default limits if target_amount is None
    # Optimized: eager load buckets in the query above?
    # Let's just iterate, N+1 is acceptable for small number of goals (usually < 10)
    
    today = date.today()
    
    for g in goals:
        # Determine Target
        target = g.target_amount
        if target is None:
            # Fetch bucket limit
            # Only user's limit? Or shared?
            # Default to sum of limits for simplicity or just the user's share if we can distinguish.
            # Using total bucket limit logic from analytics would be ideal but complex here.
            # Simple fallback:
            bucket = g.bucket
            if bucket and bucket.limits:
                target = sum(l.amount for l in bucket.limits)
            else:
                target = 0.0
                
        # Calculate Streak
        # Logic: Iterate backwards from Last Month.
        # Current month doesn't count for streak until it's over? 
        # Or does it break the streak immediately if broken?
        # Let's say: Streak = Number of *completed* months in a row ending last month where target was met.
        # + Current status: "On Track" or "Failed" for this month.
        
        streak = 0
        current_status = "On Track"
        
        # Check current month first (partial)
        from sqlalchemy import func
        from datetime import datetime
        
        # Helper for monthly spend
        def get_monthly_spend(month_start, month_end):
            total = db.query(func.sum(models.Transaction.amount))\
                .filter(
                    models.Transaction.user_id == current_user.id,
                    models.Transaction.bucket_id == g.bucket_id,
                    models.Transaction.date >= month_start,
                    models.Transaction.date < month_end,
                    models.Transaction.amount < 0 # Expenses only
                ).scalar()
            return abs(total) if total else 0.0

        # Current Month
        cm_start = date(today.year, today.month, 1)
        cm_next = date(today.year + 1, 1, 1) if today.month == 12 else date(today.year, today.month + 1, 1)
        
        current_spend = get_monthly_spend(cm_start, cm_next)
        if current_spend > target:
            current_status = "Failed"
            
        # Backwards Streak
        # Max check 12 months?
        check_date = cm_start
        
        for _ in range(12): # Limit to 1 year streak check for performance
            # Go back one month
            if check_date.month == 1:
                check_date = date(check_date.year - 1, 12, 1)
            else:
                check_date = date(check_date.year, check_date.month - 1, 1)
                
            # If before start_date, stop
            if check_date < g.start_date:
                break
                
            # Calculate range
            curr_next = date(check_date.year + 1, 1, 1) if check_date.month == 12 else date(check_date.year, check_date.month + 1, 1)
            
            spent = get_monthly_spend(check_date, curr_next)
            if spent <= target:
                streak += 1
            else:
                break # Streak broken
                
        results.append({
            "id": g.id,
            "bucket_id": g.bucket_id,
            "bucket_name": g.bucket.name if g.bucket else "Unknown",
            "bucket_icon": g.bucket.icon_name if g.bucket else "Wallet",
            "target_amount": target,
            "streak_months": streak,
            "current_month_status": current_status,
            "current_month_spend": current_spend,
            "start_date": g.start_date
        })
        
    return results

# Existing Endpoints below...
@router.get("/{goal_id}/history")
def get_goal_history(
    goal_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id, models.Goal.user_id == current_user.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
        
    history = []
    
    if goal.linked_account_id:
        # Linked Mode: Fetch history from AccountBalance snapshots
        # Join NetWorthSnapshot to get the date
        results = db.query(
            models.NetWorthSnapshot.date, 
            models.AccountBalance.balance
        ).join(
            models.AccountBalance, 
            models.AccountBalance.snapshot_id == models.NetWorthSnapshot.id
        ).filter(
            models.NetWorthSnapshot.user_id == current_user.id,
            models.AccountBalance.account_id == goal.linked_account_id
        ).order_by(models.NetWorthSnapshot.date.asc()).all()
        
        for date, balance in results:
            history.append({"date": date.strftime("%Y-%m-%d"), "amount": balance})
            
    else:
        # Manual Mode: Cumulative sum of linked transactions
        transactions = db.query(models.Transaction)\
            .filter(
                models.Transaction.goal_id == goal.id,
                models.Transaction.user_id == current_user.id
            )\
            .order_by(models.Transaction.date.asc())\
            .all()
            
        current_total = 0.0
        # Group by date to avoid multiple points per day (optional, but cleaner)
        grouped_by_date = {}
        
        for txn in transactions:
            d = txn.date.strftime("%Y-%m-%d")
            if d not in grouped_by_date:
                grouped_by_date[d] = 0.0
            grouped_by_date[d] += txn.amount
            
        # Create cumulative series
        sorted_dates = sorted(grouped_by_date.keys())
        for d in sorted_dates:
            current_total += grouped_by_date[d]
            history.append({"date": d, "amount": current_total})
            
    return history
