from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from typing import List
import os
import shutil

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
)

# --- User / App Config ---

@router.get("/user", response_model=schemas.User)
def get_user_settings(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    user = current_user
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/user", response_model=schemas.User)
def update_user_settings(settings: schemas.UserSettingsUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    user = current_user
    
    if settings.is_couple_mode is not None:
        user.is_couple_mode = settings.is_couple_mode
    if settings.name_a is not None:
        user.name_a = settings.name_a
    if settings.name_b is not None:
        user.name_b = settings.name_b
    if settings.currency_symbol is not None:
        user.currency_symbol = settings.currency_symbol
        
    db.commit()
    db.refresh(user)
    return user

@router.get("/backup")
def download_backup():
    # Current DB file - make sure this matches database.py
    file_path = "./principal_v5.db" 
    if not os.path.exists(file_path):
             raise HTTPException(status_code=404, detail="Database file not found")
        
    return FileResponse(path=file_path, filename="principal_backup.db", media_type='application/x-sqlite3')

@router.post("/restore")
async def restore_backup(file: UploadFile = File(...), current_user: models.User = Depends(auth.get_current_user)):
    # Verify file extension (basic check)
    if not file.filename.endswith(".db") and not file.filename.endswith(".sqlite"):
         raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .db file.")

    # Target DB path
    db_path = "./principal_v5.db"

    # Create a safety backup of the current DB before overwriting
    if os.path.exists(db_path):
        shutil.copy(db_path, "./principal_v5.db.bak")

    try:
        with open(db_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        # Try to restore from safety backup if anything fails
        if os.path.exists("./principal_v5.db.bak"):
            shutil.copy("./principal_v5.db.bak", db_path)
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")
    
    return {"message": "Database restored successfully"}

# --- Budget Buckets ---

@router.get("/buckets", response_model=List[schemas.BudgetBucket])
def get_buckets(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    user = current_user
    if not user:
        return []
    
    # Pre-populate defaults if empty
    existing_buckets = db.query(models.BudgetBucket).filter(models.BudgetBucket.user_id == user.id).all()
    if not existing_buckets:
        defaults = [
            {"name": "Rent/Mortgage", "is_shared": True, "icon": "Home"},
            {"name": "Groceries", "is_shared": True, "icon": "ShoppingCart"},
            {"name": "Dining Out", "is_shared": False, "icon": "Utensils"},
            {"name": "Utilities", "is_shared": True, "icon": "Zap"},
            {"name": "Transportation", "is_shared": False, "icon": "Car"},
            {"name": "Entertainment", "is_shared": False, "icon": "Film"},
            {"name": "Health", "is_shared": False, "icon": "Heart", "group": "Discretionary"},
            {"name": "Shopping", "is_shared": False, "icon": "ShoppingBag", "group": "Discretionary"},
            {"name": "Transfer", "is_shared": True, "icon": "ArrowRightLeft", "group": "Transfers"},
        ]
        for d in defaults:
            db_bucket = models.BudgetBucket(
                name=d["name"], 
                user_id=user.id,
                is_shared=d["is_shared"],
                icon_name=d["icon"],
                group=d.get("group", "Discretionary")
            )
            db.add(db_bucket)
        db.commit()
    
    # Use joinedload to eagerly load tags
    return db.query(models.BudgetBucket)\
             .options(joinedload(models.BudgetBucket.tags))\
             .filter(models.BudgetBucket.user_id == user.id)\
             .all()

def process_tags(db: Session, bucket: models.BudgetBucket, tag_names: List[str]):
    """Helper to sync tags for a bucket"""
    if tag_names is None:
        return
        
    # Clear existing tags
    bucket.tags = []
    
    for t_name in tag_names:
        t_name = t_name.strip()
        if not t_name: continue
        
        # Check if tag exists
        tag = db.query(models.Tag).filter(models.Tag.name == t_name).first()
        if not tag:
            # Create new tag
            tag = models.Tag(name=t_name)
            db.add(tag)
            db.commit()
            db.refresh(tag)
        
        bucket.tags.append(tag)


@router.post("/buckets", response_model=schemas.BudgetBucket)
def create_bucket(bucket: schemas.BudgetBucketCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_bucket = models.BudgetBucket(
        name=bucket.name,
        icon_name=bucket.icon_name,
        user_id=current_user.id,
        monthly_limit_a=bucket.monthly_limit_a,
        monthly_limit_b=bucket.monthly_limit_b,
        is_shared=bucket.is_shared,
        is_rollover=bucket.is_rollover,
        group=bucket.group,
        target_amount=bucket.target_amount,
        target_date=bucket.target_date
    )
    db.add(db_bucket)
    db.commit()
    db.refresh(db_bucket)
    
    if bucket.tags:
        process_tags(db, db_bucket, bucket.tags)
        db.commit()
        db.refresh(db_bucket)
        
    return db_bucket

@router.put("/buckets/{bucket_id}", response_model=schemas.BudgetBucket)
def update_bucket(bucket_id: int, bucket: schemas.BudgetBucketCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_bucket = db.query(models.BudgetBucket).filter(models.BudgetBucket.id == bucket_id).first()
    if not db_bucket:
        raise HTTPException(status_code=404, detail="Bucket not found")
    
    db_bucket.name = bucket.name
    db_bucket.icon_name = bucket.icon_name
    db_bucket.monthly_limit_a = bucket.monthly_limit_a
    db_bucket.monthly_limit_b = bucket.monthly_limit_b
    db_bucket.is_shared = bucket.is_shared
    db_bucket.is_rollover = bucket.is_rollover
    db_bucket.group = bucket.group
    db_bucket.target_amount = bucket.target_amount
    db_bucket.target_date = bucket.target_date
    
    # Process Tags
    process_tags(db, db_bucket, bucket.tags)
    
    db.commit()
    db.refresh(db_bucket)
    return db_bucket

@router.delete("/buckets/{bucket_id}")
def delete_bucket(bucket_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_bucket = db.query(models.BudgetBucket).filter(models.BudgetBucket.id == bucket_id).first()
    if not db_bucket:
        raise HTTPException(status_code=404, detail="Bucket not found")
    
    db.delete(db_bucket)
    db.commit()
    return {"ok": True}
