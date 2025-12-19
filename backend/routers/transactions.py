from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract
from typing import List, Optional
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(
    prefix="/transactions",
    tags=["transactions"],
)

@router.get("/", response_model=List[schemas.Transaction])
def get_transactions(
    skip: int = 0,
    limit: int = 100,
    bucket_id: Optional[int] = None,
    verified: Optional[bool] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    query = db.query(models.Transaction).options(joinedload(models.Transaction.bucket)).filter(models.Transaction.user_id == current_user.id)
    
    if bucket_id is not None:
        query = query.filter(models.Transaction.bucket_id == bucket_id)
        
    if verified is not None:
        query = query.filter(models.Transaction.is_verified == verified)
        
    # Date filtering
    if month is not None:
        query = query.filter(extract('month', models.Transaction.date) == month)
    
    if year is not None:
        query = query.filter(extract('year', models.Transaction.date) == year)
    
    query = query.order_by(models.Transaction.date.desc())
    return query.offset(skip).limit(limit).all()

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
        
    if update.bucket_id is not None:
        txn.bucket_id = update.bucket_id
    if update.is_verified is not None:
        txn.is_verified = update.is_verified
    if update.description is not None:
        txn.description = update.description
    if update.spender is not None:
        txn.spender = update.spender
        
    db.commit()
    db.refresh(txn)
    
    # Reload to ensure bucket relation is fresh
    txn = db.query(models.Transaction).options(joinedload(models.Transaction.bucket)).filter(models.Transaction.id == txn.id).first()
    return txn

@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    txn = db.query(models.Transaction).filter(models.Transaction.id == transaction_id, models.Transaction.user_id == current_user.id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    db.delete(txn)
    db.commit()
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
    
    # 3. Create children
    for item in split_data.items:
        child = models.Transaction(
            date=original.date, # Inherit date
            description=item.description,
            raw_description=original.raw_description, # Keep lineage
            amount=item.amount,
            bucket_id=item.bucket_id,
            user_id=current_user.id,
            spender=original.spender,
            is_verified=True, # Explicitly created, so verified
            parent_transaction_id=original.id # Link to parent
        )
        db.add(child)
        created_transactions.append(child)
        
    # 4. Update parent (optional: mark as verified or keep as container)
    original.is_verified = True
    
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
