import logging
import shutil
import os
import tempfile

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from sqlalchemy.orm import Session, joinedload
from typing import List

from ..database import get_db
from .. import models, schemas, auth
from ..services.pdf_parser import parse_pdf
from ..services.categorizer import Categorizer
from ..services.csv_service import parse_preview, process_csv

logger = logging.getLogger(__name__)

# File upload limits
MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024  # 10MB

router = APIRouter(
    prefix="/ingest",
    tags=["ingestion"],
)

categorizer = Categorizer()


async def validate_file_size(file: UploadFile) -> bytes:
    """Read and validate file size. Returns file content if valid."""
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB."
        )
    return content

def process_and_save_transactions(extracted_data, user, db, spender):
    """
    Shared logic to categorize and save extracted transaction data.
    Uses a multi-stage approach:
    1. User's smart rules (highest priority)
    2. Bucket tags/keywords
    3. Global keyword matching
    4. AI prediction for remaining uncategorized (NEW)
    """
    from ..services.ai_categorizer import get_ai_categorizer
    
    # Fetch Buckets with Tags for Mapping
    buckets = db.query(models.BudgetBucket).options(joinedload(models.BudgetBucket.tags)).filter(models.BudgetBucket.user_id == user.id).all()
    
    # 1. Build Bucket Map (Name -> ID)
    bucket_map = {b.name.lower(): b.id for b in buckets}
    bucket_names = [b.name for b in buckets]  # Keep original casing for AI
    
    # 2. Build Legacy Rules Map (Tag/Keyword -> Bucket Name)
    rules_map = {}
    for bucket in buckets:
        for tag in bucket.tags:
            rules_map[tag.name.lower()] = bucket.name
            
    # 3. Fetch Smart Rules (Prioritized)
    smart_rules = db.query(models.CategorizationRule).filter(models.CategorizationRule.user_id == user.id).order_by(models.CategorizationRule.priority.desc()).all()

    # First pass: Apply rule-based categorization
    pending_transactions = []  # Store (index, data, clean_desc) for AI fallback
    categorization_results = []  # Store (bucket_id, confidence, is_verified) per transaction
    
    for i, data in enumerate(extracted_data):
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
            is_verified = True  # Explicit rule match = Verified
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
        
        # Track result
        categorization_results.append({
            'bucket_id': bucket_id,
            'confidence': confidence,
            'is_verified': is_verified,
            'clean_desc': clean_desc
        })
        
        # If still uncategorized, queue for AI
        if bucket_id is None:
            pending_transactions.append({
                'index': i,
                'description': clean_desc,
                'raw_description': data["description"],
                'amount': data["amount"]
            })
    
    # Second pass: AI categorization for uncategorized transactions
    if pending_transactions and bucket_names:
        ai_categorizer = get_ai_categorizer()
        try:
            ai_predictions = ai_categorizer.categorize_batch_sync(pending_transactions, bucket_names)
            
            # Apply AI predictions
            for txn_data in pending_transactions:
                idx = txn_data['index']
                local_idx = pending_transactions.index(txn_data)
                
                if local_idx in ai_predictions:
                    predicted_bucket, ai_confidence = ai_predictions[local_idx]
                    # Match to bucket ID
                    matched_bucket_id = bucket_map.get(predicted_bucket.lower())
                    if matched_bucket_id:
                        categorization_results[idx]['bucket_id'] = matched_bucket_id
                        categorization_results[idx]['confidence'] = ai_confidence
                        # AI predictions should NOT be auto-verified - user should review
                        categorization_results[idx]['is_verified'] = False
                        
            logger.info(f"AI categorized {len(ai_predictions)}/{len(pending_transactions)} transactions")
        except Exception as e:
            logger.warning(f"AI categorization failed, falling back to uncategorized: {e}")
    
    # Create and save all transactions
    saved_transactions = []
    for i, data in enumerate(extracted_data):
        result = categorization_results[i]
        
        db_txn = models.Transaction(
            date=data["date"],
            description=result['clean_desc'],
            raw_description=data["description"],
            amount=data["amount"],
            user_id=user.id,
            category_confidence=result['confidence'],
            bucket_id=result['bucket_id'],
            is_verified=result['is_verified'],
            spender=spender
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
    """Preview CSV file structure before import."""
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await validate_file_size(file)
    
    try:
        return parse_preview(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("CSV preview failed")
        raise HTTPException(status_code=500, detail="Failed to parse CSV file")

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
async def upload_statement(
    file: UploadFile = File(...), 
    spender: str = Form("Joint"),
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    """Upload and parse a PDF bank statement."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Validate file size
    content = await validate_file_size(file)
    
    # Save to temp file for processing
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(content)
        tmp_path = tmp.name
        
    try:
        extracted_data = parse_pdf(tmp_path)
    except Exception:
        logger.exception("PDF parsing failed")
        raise HTTPException(status_code=500, detail="Failed to parse PDF file")
    finally:
        # Cleanup temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            
    if not extracted_data:
        return []

    return process_and_save_transactions(extracted_data, current_user, db, spender)


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
