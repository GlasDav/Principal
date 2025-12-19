from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from sqlalchemy.orm import Session, joinedload
from typing import List
import shutil
import os
import tempfile
from ..database import get_db
from .. import models, schemas, auth
from ..services.pdf_parser import parse_pdf
from ..services.categorizer import Categorizer
from ..services.csv_service import parse_preview, process_csv

router = APIRouter(
    prefix="/ingest",
    tags=["ingestion"],
)

categorizer = Categorizer()

def process_and_save_transactions(extracted_data, user, db, spender):
    """
    Shared logic to categorize and save extracted transaction data.
    """
    # Fetch Buckets with Tags for Mapping
    buckets = db.query(models.BudgetBucket).options(joinedload(models.BudgetBucket.tags)).filter(models.BudgetBucket.user_id == user.id).all()
    
    # 1. Build Bucket Map (Name -> ID)
    bucket_map = {b.name.lower(): b.id for b in buckets}
    
    # 2. Build Legacy Rules Map (Tag/Keyword -> Bucket Name)
    rules_map = {}
    for bucket in buckets:
        for tag in bucket.tags:
            rules_map[tag.name.lower()] = bucket.name
            
    # 3. Fetch Smart Rules (Prioritized)
    smart_rules = db.query(models.CategorizationRule).filter(models.CategorizationRule.user_id == user.id).order_by(models.CategorizationRule.priority.desc()).all()

    saved_transactions = []
    for data in extracted_data:
        # Pre-clean description for better matching
        clean_desc = categorizer.clean_description(data["description"])
        
        bucket_id = None
        confidence = 0.0
        is_verified = False
        
        # A. Smart Rules (Highest Priority)
        rule_bucket_id = categorizer.apply_rules(clean_desc, smart_rules)
        if rule_bucket_id:
            bucket_id = rule_bucket_id
            confidence = 1.0
            is_verified = True # Explicit rule match = Verified
        else:
            # B. Legacy Tag Prediction
            predicted_category, conf = categorizer.predict(clean_desc, rules_map)
            if predicted_category:
                bucket_id = bucket_map.get(predicted_category.lower())
                confidence = conf
            else:
                # C. Best Guess (Global Keywords)
                guessed_bucket_id, guess_conf = categorizer.guess_category(clean_desc, bucket_map)
                if guessed_bucket_id:
                    bucket_id = guessed_bucket_id
                    confidence = guess_conf
            
        # Create Transaction Object
        # Note: clean_desc re-calculated or reused? It's reused.
        
        db_txn = models.Transaction(
            date=data["date"],
            description=clean_desc,
            raw_description=data["description"], # Keep original as raw
            amount=data["amount"],
            user_id=user.id,
            category_confidence=confidence,
            bucket_id=bucket_id, # Assign bucket if found
            is_verified=is_verified,
            spender=spender # Use selected spender
        )
        db.add(db_txn)
        saved_transactions.append(db_txn)
    
    db.commit()
    
    # Reload with Eager Loading
    txn_ids = [t.id for t in saved_transactions]
    if txn_ids:
        return db.query(models.Transaction)\
            .options(joinedload(models.Transaction.bucket))\
            .filter(models.Transaction.id.in_(txn_ids))\
            .all()
    return []

@router.post("/csv/preview")
async def preview_csv(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    content = await file.read()
    try:
        return parse_preview(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/csv", response_model=List[schemas.Transaction])
async def ingest_csv(
    file: UploadFile = File(...),
    map_date: str = Form(...),
    map_desc: str = Form(...),
    map_amount: str = Form(None), # Optional now
    map_debit: str = Form(None), # New
    map_credit: str = Form(None), # New
    spender: str = Form("Joint"),
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    content = await file.read()
    mapping = {
        "date": map_date, 
        "description": map_desc, 
        "amount": map_amount,
        "debit": map_debit,
        "credit": map_credit
    }
    
    try:
        extracted_data = process_csv(content, mapping)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    if not extracted_data:
        return []
        
    return process_and_save_transactions(extracted_data, current_user, db, spender)


@router.post("/upload", response_model=List[schemas.Transaction])
def upload_statement(
    file: UploadFile = File(...), 
    spender: str = Form("Joint"),
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Save to temp file for processing
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
        
    try:
        # Parse PDF
        extracted_data = parse_pdf(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")
    finally:
        # Cleanup
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            
    if not extracted_data:
        return []

    if not extracted_data:
        return []

    # Get user
    user = current_user

    return process_and_save_transactions(extracted_data, user, db, spender)


@router.post("/confirm", response_model=List[schemas.Transaction])
def confirm_transactions(updates: List[schemas.TransactionConfirm], db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Bulk confirm transactions.
    Updates bucket_id and marks is_verified=True.
    """
    confirmed_ids = []
    for update in updates:
        txn = db.query(models.Transaction).filter(models.Transaction.id == update.id, models.Transaction.user_id == current_user.id).first()
        if txn:
            original_bucket_id = txn.bucket_id
            
            # Update Transaction
            txn.bucket_id = update.bucket_id
            if update.spender:
                txn.spender = update.spender
            txn.is_verified = True
            confirmed_ids.append(txn.id)
            
            # --- Auto-Learning ---
            # If the user manually assigned a bucket (or changed it), learn this pattern.
            # We skip if the system already had it right (bucket_id didn't change and was high confidence)
            # But here we assume updates contains ALL transactions being confirmed.
            # We only learn if it wasn't already confidently matched to this bucket.
            
            if txn.bucket_id:
                # 1. Clean description
                clean_desc = categorizer.clean_description(txn.description)
                if len(clean_desc) < 3: continue # Skip very short descriptions
                
                # 2. Check if this rule already exists to prevent duplicates
                existing_rule = db.query(models.CategorizationRule).filter(
                    models.CategorizationRule.user_id == current_user.id,
                    models.CategorizationRule.bucket_id == txn.bucket_id,
                    models.CategorizationRule.keywords == clean_desc
                ).first()
                
                if not existing_rule:
                    # 3. Create new Smart Rule
                    # Default priority 10 so it overrides generic tags
                    new_rule = models.CategorizationRule(
                        user_id=current_user.id,
                        bucket_id=txn.bucket_id,
                        keywords=clean_desc,
                        priority=10
                    )
                    db.add(new_rule)
            
    db.commit()
    
    # Return updated transactions
    if confirmed_ids:
        results = db.query(models.Transaction)\
            .options(joinedload(models.Transaction.bucket))\
            .filter(models.Transaction.id.in_(confirmed_ids))\
            .all()
        return results
    return []
