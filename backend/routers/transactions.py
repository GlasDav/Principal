from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract, or_, func
from typing import List, Optional
from datetime import datetime
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(
    prefix="/transactions",
    tags=["transactions"],
)

@router.get("/", response_model=dict)
def get_transactions(
    skip: int = 0,
    limit: int = 100,
    bucket_id: Optional[int] = None,
    verified: Optional[bool] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    search: Optional[str] = None,
    spender: Optional[str] = None,
    assigned_to: Optional[str] = None, # "ANY" for all assigned, or specific name
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sort_by: Optional[str] = Query(None, regex="^(date|amount|description)$"),
    sort_dir: Optional[str] = Query(None, regex="^(asc|desc)$"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    query = db.query(models.Transaction).options(joinedload(models.Transaction.bucket)).filter(models.Transaction.user_id == current_user.id)
    
    # Search filter (description or raw_description)
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(models.Transaction.description).like(search_term),
                func.lower(models.Transaction.raw_description).like(search_term)
            )
        )
    
    if bucket_id is not None:
        query = query.filter(models.Transaction.bucket_id == bucket_id)
    
    if spender:
        query = query.filter(models.Transaction.spender == spender)

    if assigned_to:
        if assigned_to == "ANY":
            query = query.filter(models.Transaction.assigned_to.isnot(None), models.Transaction.assigned_to != '')
        else:
            query = query.filter(models.Transaction.assigned_to == assigned_to)
        
    if verified is not None:
        query = query.filter(models.Transaction.is_verified == verified)
    
    # Amount range filters
    if min_amount is not None:
        query = query.filter(models.Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(models.Transaction.amount <= max_amount)
        
    # Date filtering
    if month is not None:
        query = query.filter(extract('month', models.Transaction.date) == month)
    
    if year is not None:
        query = query.filter(extract('year', models.Transaction.date) == year)

    if start_date is not None:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(models.Transaction.date >= start_dt)
        except ValueError:
            pass # Ignore invalid dates or handle error
    
    if end_date is not None:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            # Set time to end of day to include all transactions on that date
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
            query = query.filter(models.Transaction.date <= end_dt)
        except ValueError:
            pass
    
    # Get total count before pagination
    total = query.count()
    
    # Sorting
    if sort_by:
        sort_column = getattr(models.Transaction, sort_by)
        if sort_dir == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())
    else:
        # Default sort by date descending
        query = query.order_by(models.Transaction.date.desc())
    
    # DEBUG LOGGING
    print(f"DEBUG: get_transactions called with start_date={start_date}, end_date={end_date}")
    try:
        from sqlalchemy.dialects import postgresql
        # query_str = str(query.statement.compile(dialect=postgresql.dialect()))
        # print(f"DEBUG: Query: {query_str}")
        pass
    except Exception as e:
        print(f"DEBUG: Could not print query: {e}")

    transactions = query.offset(skip).limit(limit).all()
    print(f"DEBUG: Found {len(transactions)} transactions")
    
    # Return with metadata
    return {
        "items": transactions,
        "total": total,
        "skip": skip,
        "limit": limit
    }
    
@router.post("/", response_model=schemas.Transaction)
def create_transaction(
    transaction: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Validate bucket if provided
    if transaction.bucket_id:
        bucket = db.query(models.BudgetBucket).filter(models.BudgetBucket.id == transaction.bucket_id).first()
        if not bucket:
            raise HTTPException(status_code=400, detail="Invalid bucket_id")
    
    # Create new transaction
    db_transaction = models.Transaction(
        date=transaction.date,
        description=transaction.description,
        raw_description=transaction.raw_description or transaction.description,
        amount=transaction.amount,
        bucket_id=transaction.bucket_id,
        user_id=current_user.id,
        spender=transaction.spender,
        goal_id=transaction.goal_id,
        external_id=transaction.external_id,
        account_id=transaction.account_id,
        tags=transaction.tags,
        notes=transaction.notes,
        category_confidence=transaction.category_confidence,
        is_verified=transaction.is_verified
    )
    
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@router.put("/{transaction_id}", response_model=schemas.Transaction)
def update_transaction(
    transaction_id: int,
    update: schemas.TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    txn = db.query(models.Transaction).filter(models.Transaction.id == transaction_id, models.Transaction.user_id == current_user.id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    if update.date is not None:
        txn.date = update.date
    if update.bucket_id is not None:
        txn.bucket_id = update.bucket_id
    if update.is_verified is not None:
        txn.is_verified = update.is_verified
    if update.description is not None:
        txn.description = update.description
    if update.spender is not None:
        txn.spender = update.spender
    if update.notes is not None:
        txn.notes = update.notes
    # Handle assigned_to - check if field was provided (even if empty string or None)
    # Empty string means "clear the assignment"
    if update.assigned_to is not None:
        txn.assigned_to = update.assigned_to if update.assigned_to else None
        
    db.commit()
    db.refresh(txn)
    
    # Reload to ensure bucket relation is fresh
    txn = db.query(models.Transaction).options(joinedload(models.Transaction.bucket)).filter(models.Transaction.id == txn.id).first()
    return txn

@router.get("/pending-review")
def get_pending_review(
    assigned_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get transactions assigned for partner review.
    If assigned_to is specified, filter by that partner ("A" or "B").
    """
    query = db.query(models.Transaction).options(
        joinedload(models.Transaction.bucket)
    ).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.assigned_to.isnot(None),
        models.Transaction.assigned_to != ''  # Also exclude empty strings
    )
    
    if assigned_to:
        query = query.filter(models.Transaction.assigned_to == assigned_to)
    
    transactions = query.order_by(models.Transaction.date.desc()).limit(100).all()
    return {"items": transactions, "count": len(transactions)}

@router.delete("/all")
def delete_all_transactions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Delete ALL transactions for the current user.
    """
    count = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Deleted {count} transactions", "count": count}

@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Delete a transaction by ID."""
    txn = db.query(models.Transaction).filter(models.Transaction.id == transaction_id, models.Transaction.user_id == current_user.id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    db.delete(txn)
    db.commit()
    return {"message": "Transaction deleted"}

@router.post("/{transaction_id}/split", response_model=List[schemas.Transaction])
def split_transaction(
    transaction_id: int, 
    split_data: schemas.TransactionSplitCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # 1. Get original transaction
    original = db.query(models.Transaction).filter(models.Transaction.id == transaction_id, models.Transaction.user_id == current_user.id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    # 2. Validation: Sum of splits must match original (roughly)
    total_split = sum(item.amount for item in split_data.items)
    if abs(total_split - original.amount) > 0.01:
        raise HTTPException(status_code=400, detail=f"Split total ({total_split}) does not match original amount ({original.amount})")
        
    created_transactions = []
    
    # 3. Apply Splits
    # Strategy: Update original transaction to be the first split, create new transactions for the rest.
    
    # First split item -> Updates Original
    first_split = split_data.items[0]
    original.amount = first_split.amount
    original.description = first_split.description
    original.bucket_id = first_split.bucket_id
    original.is_verified = True
    # We don't change date or other metadata on original to preserve history/linkage where possible
    
    created_transactions = [original]
    
    # Remaining split items -> Create New Transactions
    for item in split_data.items[1:]:
        child = models.Transaction(
            date=original.date, # Inherit date
            description=item.description,
            raw_description=original.raw_description, # Keep lineage
            amount=item.amount,
            bucket_id=item.bucket_id,
            user_id=current_user.id,
            spender=original.spender,
            is_verified=True, # Explicitly created, so verified
            parent_transaction_id=original.id # Link to parent (now the first split)
        )
        db.add(child)
        created_transactions.append(child)
        
    db.commit()
    for t in created_transactions:
        db.refresh(t)
        
    return created_transactions

@router.post("/batch-delete")
def batch_delete_transactions(
    transaction_ids: List[int] = Body(...), 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Delete multiple transactions by ID.
    """
    # Verify ownership before delete
    db.query(models.Transaction).filter(
        models.Transaction.id.in_(transaction_ids),
        models.Transaction.user_id == current_user.id
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Deleted {len(transaction_ids)} transactions"}

@router.post("/batch-update")
def batch_update_transactions(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Update multiple transactions at once.
    Body: { "ids": [1,2,3], "bucket_id": 5, "spender": "User A", "is_verified": true }
    """
    transaction_ids = data.get("ids", [])
    if not transaction_ids:
        raise HTTPException(status_code=400, detail="No transaction IDs provided")
    
    # Build update dict with only provided fields
    update_fields = {}
    if "bucket_id" in data:
        update_fields["bucket_id"] = data["bucket_id"]
    if "spender" in data:
        update_fields["spender"] = data["spender"]
    if "is_verified" in data:
        update_fields["is_verified"] = data["is_verified"]
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No update fields provided")
    
    # Update all matching transactions
    count = db.query(models.Transaction).filter(
        models.Transaction.id.in_(transaction_ids),
        models.Transaction.user_id == current_user.id
    ).update(update_fields, synchronize_session=False)
    
    db.commit()
    return {"message": f"Updated {count} transactions", "count": count}
