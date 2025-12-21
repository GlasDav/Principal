import logging
import shutil
import os
import tempfile
import hashlib

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


def generate_transaction_hash(user_id: int, date, raw_description: str, amount: float) -> str:
    """
    Generate a unique fingerprint for duplicate detection.
    Uses: user_id + date + raw_description + absolute amount
    """
    date_str = date.isoformat() if hasattr(date, 'isoformat') else str(date)
    key = f"{user_id}|{date_str}|{raw_description.lower().strip()}|{abs(round(amount, 2))}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


async def validate_file_size(file: UploadFile) -> bytes:
    """Read and validate file size. Returns file content if valid."""
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB."
        )
    return content

def process_transactions_preview(extracted_data, user, db, spender, skip_duplicates=True):
    """
    Categorize transactions for preview WITHOUT saving to database.
    Uses a multi-stage approach:
    1. Duplicate detection (if skip_duplicates=True)
    2. User's smart rules (highest priority)
    3. Bucket tags/keywords
    4. Global keyword matching
    5. AI prediction for remaining uncategorized
    
    Returns: (preview_transactions, duplicate_count)
    Preview transactions are dicts with temp IDs for frontend use.
    """
    from ..services.ai_categorizer import get_ai_categorizer
    
    # === DUPLICATE DETECTION ===
    duplicate_count = 0
    non_duplicate_data = []
    
    if skip_duplicates and extracted_data:
        # Generate hashes for incoming transactions
        incoming_hashes = {}
        for i, data in enumerate(extracted_data):
            txn_hash = generate_transaction_hash(
                user.id, 
                data["date"], 
                data["description"],  # raw description
                data["amount"]
            )
            incoming_hashes[i] = txn_hash
        
        # Fetch existing hashes for this user
        existing_hashes = set(
            h[0] for h in db.query(models.Transaction.transaction_hash)
            .filter(
                models.Transaction.user_id == user.id,
                models.Transaction.transaction_hash.isnot(None)
            ).all()
        )
        
        # Filter out duplicates
        for i, data in enumerate(extracted_data):
            if incoming_hashes[i] not in existing_hashes:
                non_duplicate_data.append((data, incoming_hashes[i]))
            else:
                duplicate_count += 1
        
        logger.info(f"Duplicate detection: {duplicate_count} duplicates skipped, {len(non_duplicate_data)} new transactions")
    else:
        # No duplicate checking - process all
        for data in extracted_data:
            txn_hash = generate_transaction_hash(user.id, data["date"], data["description"], data["amount"])
            non_duplicate_data.append((data, txn_hash))
    
    if not non_duplicate_data:
        return [], duplicate_count
    
    # Fetch Buckets with Tags for Mapping
    buckets = db.query(models.BudgetBucket).options(joinedload(models.BudgetBucket.tags)).filter(models.BudgetBucket.user_id == user.id).all()
    bucket_by_id = {b.id: b for b in buckets}
    
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
    
    for i, (data, txn_hash) in enumerate(non_duplicate_data):
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
        
        # Track result (include hash for later)
        categorization_results.append({
            'bucket_id': bucket_id,
            'confidence': confidence,
            'is_verified': is_verified,
            'clean_desc': clean_desc,
            'txn_hash': txn_hash,
            'raw_data': data
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
    
    # Build preview transactions (NOT saved to DB)
    # Use negative temp IDs to distinguish from real DB IDs
    preview_transactions = []
    for i, result in enumerate(categorization_results):
        data = result['raw_data']
        bucket = bucket_by_id.get(result['bucket_id']) if result['bucket_id'] else None
        
        preview_txn = {
            'id': -(i + 1),  # Negative temp ID
            'date': data["date"].isoformat() if hasattr(data["date"], 'isoformat') else str(data["date"]),
            'description': result['clean_desc'],
            'raw_description': data["description"],
            'amount': data["amount"],
            'bucket_id': result['bucket_id'],
            'bucket': {'id': bucket.id, 'name': bucket.name, 'icon_name': bucket.icon_name} if bucket else None,
            'category_confidence': result['confidence'],
            'is_verified': result['is_verified'],
            'spender': spender,
            'transaction_hash': result['txn_hash']
        }
        preview_transactions.append(preview_txn)
    
    return preview_transactions, duplicate_count

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
    skip_duplicates: bool = Form(True),  # New: duplicate detection
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
    
    # Preview only - no DB save
    preview_txns, duplicate_count = process_transactions_preview(
        extracted_data, current_user, db, spender, skip_duplicates
    )
    
    # Log duplicate info
    if duplicate_count > 0:
        logger.info(f"Skipped {duplicate_count} duplicate transactions during preview")
    
    return preview_txns


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

    # Preview only - no DB save
    preview_txns, duplicate_count = process_transactions_preview(
        extracted_data, current_user, db, spender, skip_duplicates=True
    )
    
    if duplicate_count > 0:
        logger.info(f"Skipped {duplicate_count} duplicate transactions during preview")
    
    return preview_txns


@router.post("/confirm", response_model=List[schemas.Transaction])
def confirm_transactions(updates: List[schemas.TransactionConfirm], db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Bulk confirm transactions.
    - For preview transactions (id < 0): Creates new transactions in DB
    - For existing transactions (id > 0): Updates bucket_id and marks is_verified=True
    """
    from datetime import datetime
    
    confirmed_ids = []
    
    for update in updates:
        if update.id < 0:
            # NEW TRANSACTION FROM PREVIEW - Create in DB
            if not all([update.date, update.description, update.amount is not None]):
                logger.warning(f"Skipping preview transaction {update.id}: missing required fields")
                continue
            
            # Parse date
            try:
                txn_date = datetime.fromisoformat(update.date.replace('Z', '+00:00'))
            except:
                txn_date = datetime.strptime(update.date, "%Y-%m-%d")
            
            # Create new transaction
            db_txn = models.Transaction(
                date=txn_date,
                description=update.description,
                raw_description=update.raw_description or update.description,
                amount=update.amount,
                user_id=current_user.id,
                bucket_id=update.bucket_id,
                is_verified=True,  # User confirmed = verified
                spender=update.spender or "Joint",
                transaction_hash=update.transaction_hash,
                category_confidence=update.category_confidence or 0.0,
                goal_id=update.goal_id
            )
            db.add(db_txn)
            db.flush()  # Get the ID without committing
            confirmed_ids.append(db_txn.id)
            
            # Auto-learning for new transactions
            if db_txn.bucket_id and db_txn.description:
                clean_desc = categorizer.clean_description(db_txn.description)
                if len(clean_desc) >= 3:
                    existing_rule = db.query(models.CategorizationRule).filter(
                        models.CategorizationRule.user_id == current_user.id,
                        models.CategorizationRule.bucket_id == db_txn.bucket_id,
                        models.CategorizationRule.keywords == clean_desc
                    ).first()
                    
                    if not existing_rule:
                        new_rule = models.CategorizationRule(
                            user_id=current_user.id,
                            bucket_id=db_txn.bucket_id,
                            keywords=clean_desc,
                            priority=10
                        )
                        db.add(new_rule)
        else:
            # EXISTING TRANSACTION - Update
            txn = db.query(models.Transaction).filter(
                models.Transaction.id == update.id, 
                models.Transaction.user_id == current_user.id
            ).first()
            
            if txn:
                txn.bucket_id = update.bucket_id
                if update.spender:
                    txn.spender = update.spender
                txn.is_verified = True
                confirmed_ids.append(txn.id)
                
                # Auto-learning for existing transactions
                if txn.bucket_id:
                    clean_desc = categorizer.clean_description(txn.description)
                    if len(clean_desc) >= 3:
                        existing_rule = db.query(models.CategorizationRule).filter(
                            models.CategorizationRule.user_id == current_user.id,
                            models.CategorizationRule.bucket_id == txn.bucket_id,
                            models.CategorizationRule.keywords == clean_desc
                        ).first()
                        
                        if not existing_rule:
                            new_rule = models.CategorizationRule(
                                user_id=current_user.id,
                                bucket_id=txn.bucket_id,
                                keywords=clean_desc,
                                priority=10
                            )
                            db.add(new_rule)
    
    db.commit()
    
    # Return confirmed transactions
    if confirmed_ids:
        results = db.query(models.Transaction)\
            .options(joinedload(models.Transaction.bucket))\
            .filter(models.Transaction.id.in_(confirmed_ids))\
            .all()
        return results
    return []
