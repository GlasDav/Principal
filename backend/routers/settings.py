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

# --- Household Members ---

@router.get("/members", response_model=List[schemas.HouseholdMember])
def get_members(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.HouseholdMember).filter(models.HouseholdMember.user_id == current_user.id).all()

@router.post("/members", response_model=schemas.HouseholdMember)
def create_member(member: schemas.HouseholdMemberCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Limit max members? Maybe 6 for now.
    count = db.query(models.HouseholdMember).filter(models.HouseholdMember.user_id == current_user.id).count()
    if count >= 6:
        raise HTTPException(status_code=400, detail="Maximum of 6 members allowed.")
        
    db_member = models.HouseholdMember(
        user_id=current_user.id,
        name=html.unescape(member.name),
        color=member.color,
        avatar=member.avatar
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

@router.put("/members/{member_id}", response_model=schemas.HouseholdMember)
def update_member(member_id: int, member: schemas.HouseholdMemberCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_member = db.query(models.HouseholdMember).filter(
        models.HouseholdMember.id == member_id,
        models.HouseholdMember.user_id == current_user.id
    ).first()
    
    if not db_member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    db_member.name = html.unescape(member.name)
    db_member.color = member.color
    db_member.avatar = member.avatar
    
    db.commit()
    db.refresh(db_member)
    return db_member

@router.delete("/members/{member_id}")
def delete_member(member_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Cannot delete if transactions/limits exist?
    # For MVP, just delete limits. Transactions would need reassigning, but let's just delete member for now 
    # and cascade limits (via database or manual delete).
    
    db_member = db.query(models.HouseholdMember).filter(
        models.HouseholdMember.id == member_id,
        models.HouseholdMember.user_id == current_user.id
    ).first()
    
    if not db_member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    # Check if only 1 member left?
    count = db.query(models.HouseholdMember).filter(models.HouseholdMember.user_id == current_user.id).count()
    if count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last member.")

    # Delete limits
    db.query(models.BudgetLimit).filter(models.BudgetLimit.member_id == member_id).delete()
    
    db.delete(db_member)
    db.commit()
    return {"ok": True}

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
             .options(joinedload(models.BudgetBucket.tags), joinedload(models.BudgetBucket.limits))\
             .filter(models.BudgetBucket.user_id == user.id)\
             .order_by(models.BudgetBucket.display_order)\
             .all()


@router.get("/buckets/tree")
def get_buckets_tree(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Get buckets organized as a tree structure.
    Returns parent categories with nested children.
    """
    user = current_user
    if not user:
        return []
    
    # Get all buckets for user
    all_buckets = db.query(models.BudgetBucket)\
        .options(joinedload(models.BudgetBucket.tags), joinedload(models.BudgetBucket.limits))\
        .filter(models.BudgetBucket.user_id == user.id)\
        .order_by(models.BudgetBucket.display_order)\
        .all()
    
    # Build tree structure using a map for O(N) lookup
    # First, create all dicts and store in a map
    id_to_dict = {}
    for bucket in all_buckets:
        id_to_dict[bucket.id] = {
            "id": bucket.id,
            "name": bucket.name,
            "icon_name": bucket.icon_name,
            "is_shared": getattr(bucket, 'is_shared', False),
            "is_rollover": getattr(bucket, 'is_rollover', False),
            "is_transfer": getattr(bucket, 'is_transfer', False),
            "is_investment": getattr(bucket, 'is_investment', False),
            "is_hidden": getattr(bucket, 'is_hidden', False),
            "group": bucket.group,
            "parent_id": getattr(bucket, 'parent_id', None),
            "display_order": getattr(bucket, 'display_order', 0),
            "tags": [{"id": t.id, "name": t.name} for t in bucket.tags],
            "limits": [{"member_id": l.member_id, "amount": l.amount} for l in bucket.limits],
            "children": []
        }
    
    tree = []
    for bucket_id, bucket_dict in id_to_dict.items():
        parent_id = bucket_dict["parent_id"]
        if parent_id and parent_id in id_to_dict:
            id_to_dict[parent_id]["children"].append(bucket_dict)
        else:
            tree.append(bucket_dict)
            
    # Sort by display_order within each level, protecting against cycles
    def sort_tree(nodes, visited=None):
        if visited is None:
            visited = set()
            
        nodes.sort(key=lambda x: x.get("display_order", 0))
        for node in nodes:
            node_id = node["id"]
            if node_id in visited:
                continue # Prevent infinite recursion
            visited.add(node_id)
            
            if node["children"]:
                sort_tree(node["children"], visited)
    
    sort_tree(tree)
    return tree


@router.post("/buckets/reorder")
def reorder_buckets(
    order_data: List[dict],  # [{id: int, display_order: int}, ...]
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Update display_order for multiple buckets.
    Expects a list of {id, display_order} objects.
    """
    if not current_user:
        return {"ok": False, "error": "Not authenticated"}
    
    for item in order_data:
        bucket_id = item.get("id")
        new_order = item.get("display_order")
        
        if bucket_id is None or new_order is None:
            continue
            
        bucket = db.query(models.BudgetBucket).filter(
            models.BudgetBucket.id == bucket_id,
            models.BudgetBucket.user_id == current_user.id
        ).first()
        
        if bucket:
            bucket.display_order = new_order
    
    db.commit()
    return {"ok": True}


@router.get("/tags", response_model=List[schemas.Tag])
def get_tags(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Get all unique tags used by the user"""
    # Fetch all tags. Actually, tags are shared in current model, but we want all tags for now.
    # If we want only tags used by user:
    tags = db.query(models.Tag)\
        .join(models.Tag.buckets)\
        .filter(models.BudgetBucket.user_id == current_user.id)\
        .distinct().all()
    return tags


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


def process_limits(db: Session, bucket: models.BudgetBucket, limits_data: List[schemas.BudgetLimitBase]):
    """Helper to sync limits for a bucket"""
    if limits_data is None:
        return
        
    # Clear existing limits (simplest strategy suitable for this scale)
    db.query(models.BudgetLimit).filter(models.BudgetLimit.bucket_id == bucket.id).delete()
    
    for l in limits_data:
        if l.amount > 0:
            db.add(models.BudgetLimit(
                bucket_id=bucket.id,
                member_id=l.member_id,
                amount=l.amount
            ))

import html

@router.post("/buckets", response_model=schemas.BudgetBucket)
def create_bucket(bucket: schemas.BudgetBucketCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Unescape name to prevent double encoding
    clean_name = html.unescape(bucket.name) if bucket.name else bucket.name
    
    db_bucket = models.BudgetBucket(
        name=clean_name,
        icon_name=bucket.icon_name,
        user_id=current_user.id,
        is_shared=bucket.is_shared,
        is_rollover=bucket.is_rollover,
        group=bucket.group,
        target_amount=bucket.target_amount,
        target_date=bucket.target_date,
        parent_id=bucket.parent_id,
        display_order=bucket.display_order
    )
    db.add(db_bucket)
    db.commit()
    db.refresh(db_bucket)
    
    if bucket.tags:
        process_tags(db, db_bucket, bucket.tags)
    
    if bucket.limits:
        process_limits(db, db_bucket, bucket.limits)
        
    db.commit()
    db.refresh(db_bucket)
    return db_bucket

@router.put("/buckets/{bucket_id}", response_model=schemas.BudgetBucket)
def update_bucket(bucket_id: int, bucket: schemas.BudgetBucketCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_bucket = db.query(models.BudgetBucket).filter(models.BudgetBucket.id == bucket_id).first()
    if not db_bucket:
        raise HTTPException(status_code=404, detail="Bucket not found")
    
    # Unescape name 
    clean_name = html.unescape(bucket.name) if bucket.name else bucket.name
    
    db_bucket.name = clean_name
    db_bucket.icon_name = bucket.icon_name
    db_bucket.is_shared = bucket.is_shared
    db_bucket.is_rollover = bucket.is_rollover
    db_bucket.group = bucket.group
    db_bucket.target_amount = bucket.target_amount
    db_bucket.target_date = bucket.target_date
    db_bucket.parent_id = bucket.parent_id
    db_bucket.display_order = bucket.display_order
    
    # Process Tags
    process_tags(db, db_bucket, bucket.tags)
    
    # Process Limits
    if bucket.limits is not None:
        process_limits(db, db_bucket, bucket.limits)
    
    db.commit()
    db.refresh(db_bucket)
    return db_bucket

@router.delete("/buckets/{bucket_id}")
def delete_bucket(bucket_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_bucket = db.query(models.BudgetBucket).filter(models.BudgetBucket.id == bucket_id).first()
    if not db_bucket:
        raise HTTPException(status_code=404, detail="Bucket not found")
    
    # Protect Transfer and Investment buckets from deletion
    if db_bucket.is_transfer:
        raise HTTPException(status_code=400, detail="The Transfers bucket cannot be deleted - it is required for internal transfers.")
    if db_bucket.is_investment:
        raise HTTPException(status_code=400, detail="The Investments bucket cannot be deleted - it is required for investment tracking.")
    
    # Check if this bucket has children - prevent deletion of parent with children
    children = db.query(models.BudgetBucket).filter(models.BudgetBucket.parent_id == bucket_id).count()
    if children > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete category with {children} sub-categories. Delete or move sub-categories first.")
    
    db.delete(db_bucket)
    db.commit()
    return {"ok": True}
