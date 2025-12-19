from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(
    prefix="/settings/rules",
    tags=["rules"],
)

@router.get("/", response_model=List[schemas.Rule])
def get_rules(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.CategorizationRule).filter(models.CategorizationRule.user_id == current_user.id).order_by(models.CategorizationRule.priority.desc()).all()

@router.post("/", response_model=schemas.Rule)
def create_rule(rule: schemas.RuleCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Validate bucket ownership
    bucket = db.query(models.BudgetBucket).filter(models.BudgetBucket.id == rule.bucket_id, models.BudgetBucket.user_id == current_user.id).first()
    if not bucket:
        raise HTTPException(status_code=400, detail="Invalid bucket ID")

    # Deduplicate and sort keywords
    norm_keywords = ", ".join(sorted(list(set([k.strip() for k in rule.keywords.split(",") if k.strip()]))))

    # Check for duplicates
    existing_rule = db.query(models.CategorizationRule).filter(
        models.CategorizationRule.user_id == current_user.id,
        models.CategorizationRule.keywords == norm_keywords
    ).first()
    
    if existing_rule:
        raise HTTPException(status_code=400, detail="Rule with these keywords already exists")

    db_rule = models.CategorizationRule(
        user_id=current_user.id,
        bucket_id=rule.bucket_id,
        keywords=norm_keywords,
        priority=rule.priority
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    rule = db.query(models.CategorizationRule).filter(models.CategorizationRule.id == rule_id, models.CategorizationRule.user_id == current_user.id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    db.delete(rule)
    db.commit()
    return {"ok": True}

@router.put("/{rule_id}", response_model=schemas.Rule)
def update_rule(rule_id: int, rule: schemas.RuleCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_rule = db.query(models.CategorizationRule).filter(models.CategorizationRule.id == rule_id, models.CategorizationRule.user_id == current_user.id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    # Validate bucket ownership if changing
    if rule.bucket_id != db_rule.bucket_id:
        bucket = db.query(models.BudgetBucket).filter(models.BudgetBucket.id == rule.bucket_id, models.BudgetBucket.user_id == current_user.id).first()
        if not bucket:
            raise HTTPException(status_code=400, detail="Invalid bucket ID")
            
    db_rule.bucket_id = rule.bucket_id
    # Deduplicate keywords
    norm_keywords = ", ".join(sorted(list(set([k.strip() for k in rule.keywords.split(",") if k.strip()]))))

    # Check for duplicates (excluding self)
    existing_rule = db.query(models.CategorizationRule).filter(
        models.CategorizationRule.user_id == current_user.id,
        models.CategorizationRule.keywords == norm_keywords,
        models.CategorizationRule.id != rule_id
    ).first()
    
    if existing_rule:
        raise HTTPException(status_code=400, detail="Rule with these keywords already exists")

    db_rule.bucket_id = rule.bucket_id
    db_rule.keywords = norm_keywords
    db_rule.priority = rule.priority
    
    db.commit()
    db.refresh(db_rule)
    return db_rule

@router.post("/run", response_model=dict)
def run_rules(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Re-applies all categorization rules to existing transactions.
    Only updates transactions that are NOT verified (manual overrides are safe).
    """
    from ..services.categorizer import Categorizer
    categorizer = Categorizer()

    # 1. Fetch all rules
    rules = db.query(models.CategorizationRule).filter(models.CategorizationRule.user_id == current_user.id).order_by(models.CategorizationRule.priority.desc()).all()
    
    # 2. Fetch unverified transactions
    # Optimization: Filter by user_id
    transactions = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.is_verified == False
    ).all()

    count = 0
    updated_txns = []

    for txn in transactions:
        # Use existing categorizer logic
        # We need to clean the description first as categorizer expects it? 
        # Actually categorizer.apply_rules expects the text to search in. 
        # In ingestion.py we pass clean_desc. 
        # Let's clean it here too to match ingestion behavior.
        clean_desc = categorizer.clean_description(txn.raw_description or txn.description)
        
        rule_bucket_id = categorizer.apply_rules(clean_desc, rules)
        
        if rule_bucket_id and rule_bucket_id != txn.bucket_id:
            txn.bucket_id = rule_bucket_id
            # We explicitly matched a rule, so we could mark as verified, 
            # BUT if we mark as verified, future rule runs won't touch it.
            # Maybe that's desired? "I ran the rules, these are now correct".
            # Let's mark as verified to be consistent with ingestion.
            txn.is_verified = True 
            txn.category_confidence = 1.0
            updated_txns.append(txn)
            count += 1
            
    db.commit()
    
    return {"message": f"Successfully updated {count} transactions", "count": count}
