from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
from .. import models, database
from datetime import date

router = APIRouter(
    prefix="/investments",
    tags=["investments"]
)

@router.get("/history", response_model=List[Dict[str, Any]])
def get_investment_history(db: Session = Depends(database.get_db), current_user_id: int = 1): # Hardcoded user for now, as per other routers likely
    """
    Returns historical total value of all Investment accounts.
    """
    
    # Query: Sum balances of Investment accounts grouped by Snapshot Date
    # We join AccountBalance -> Account (to filter category) -> NetWorthSnapshot (for date)
    
    results = db.query(
        models.NetWorthSnapshot.date,
        func.sum(models.AccountBalance.balance).label("total_value")
    ).join(
        models.AccountBalance, models.AccountBalance.snapshot_id == models.NetWorthSnapshot.id
    ).join(
        models.Account, models.AccountBalance.account_id == models.Account.id
    ).filter(
        models.Account.category == "Investment"
    ).group_by(
        models.NetWorthSnapshot.date
    ).order_by(
        models.NetWorthSnapshot.date.asc()
    ).all()
    
    # Format response
    history = [
        {"date": r.date.isoformat(), "value": r.total_value}
        for r in results
    ]
    
    return history
