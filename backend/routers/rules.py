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
        priority=rule.priority,
        min_amount=rule.min_amount,
        max_amount=rule.max_amount,
        apply_tags=rule.apply_tags,
        mark_for_review=rule.mark_for_review
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

@router.post("/bulk-delete")
def bulk_delete_rules(rule_ids: List[int], db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Delete multiple rules at once."""
    deleted_count = db.query(models.CategorizationRule).filter(
        models.CategorizationRule.id.in_(rule_ids),
        models.CategorizationRule.user_id == current_user.id
    ).delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "deleted_count": deleted_count}

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
    db_rule.min_amount = rule.min_amount
    db_rule.max_amount = rule.max_amount
    db_rule.apply_tags = rule.apply_tags
    db_rule.mark_for_review = rule.mark_for_review
    
    db.commit()
    db.refresh(db_rule)
    return db_rule


class RulePreviewRequest(schemas.BaseModel):
    """Request schema for previewing matching transactions."""
    keywords: str
    min_amount: float | None = None
    max_amount: float | None = None
    limit: int = 10


class TransactionPreview(schemas.BaseModel):
    """Minimal transaction info for preview."""
    id: int
    date: str
    description: str
    amount: float


class RulePreviewResponse(schemas.BaseModel):
    """Response for rule preview."""
    match_count: int
    sample_transactions: List[TransactionPreview]


@router.post("/preview", response_model=RulePreviewResponse)
def preview_rule(
    request: RulePreviewRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Preview which transactions would match a rule's keywords and amount conditions.
    Returns count of matches and sample transactions (up to limit).
    """
    from ..services.categorizer import Categorizer
    categorizer = Categorizer()
    
    # Get all user transactions
    transactions = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id
    ).all()
    
    # Parse keywords
    keywords = [k.strip().lower() for k in request.keywords.split(",") if k.strip()]
    if not keywords:
        return {"match_count": 0, "sample_transactions": []}
    
    # Find matches
    matches = []
    for txn in transactions:
        # Check amount conditions
        if request.min_amount is not None and abs(txn.amount) < request.min_amount:
            continue
        if request.max_amount is not None and abs(txn.amount) > request.max_amount:
            continue
        
        # Check keywords match
        clean_desc = categorizer.clean_description(txn.raw_description or txn.description).lower()
        if any(k in clean_desc for k in keywords):
            matches.append(txn)
    
    # Return results
    sample = matches[:request.limit]
    return {
        "match_count": len(matches),
        "sample_transactions": [
            {
                "id": t.id,
                "date": t.date.isoformat() if t.date else "",
                "description": t.description,
                "amount": t.amount
            }
            for t in sample
        ]
    }

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
        
        rule = categorizer.apply_rules(clean_desc, rules, amount=txn.amount)
        
        if rule and rule.bucket_id != txn.bucket_id:
            txn.bucket_id = rule.bucket_id
            
            # Apply Tags if present
            if rule.apply_tags:
                txn.tags = rule.apply_tags
                
            # Logically, if we match a rule, we usually verify it.
            # But if "mark_for_review" is True, we explicitly keep it Unverified.
            if rule.mark_for_review:
                txn.is_verified = False
            else:
                txn.is_verified = True
            
            txn.category_confidence = 1.0
            updated_txns.append(txn)
            count += 1
            
    db.commit()
    
    return {"message": f"Successfully updated {count} transactions", "count": count}


class RuleSuggestion(schemas.BaseModel):
    """A suggested rule based on transaction patterns."""
    keywords: str
    suggested_category: str
    sample_transactions: List[TransactionPreview]
    match_count: int
    reason: str


class RuleSuggestionsResponse(schemas.BaseModel):
    """Response containing AI-generated rule suggestions."""
    suggestions: List[RuleSuggestion]


@router.get("/suggestions", response_model=RuleSuggestionsResponse)
def get_rule_suggestions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get AI-suggested rules based on uncategorized or frequently-occurring transaction patterns.
    Analyzes transaction descriptions to find common patterns that could become rules.
    """
    from collections import Counter
    import re
    
    # Get uncategorized transactions
    uncategorized = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.bucket_id == None
    ).limit(200).all()
    
    # Get user's buckets for category suggestions
    buckets = db.query(models.BudgetBucket).filter(
        models.BudgetBucket.user_id == current_user.id
    ).all()
    bucket_names = [b.name for b in buckets]
    
    # Get existing rule keywords to avoid duplicates
    existing_rules = db.query(models.CategorizationRule).filter(
        models.CategorizationRule.user_id == current_user.id
    ).all()
    existing_keywords = set()
    for rule in existing_rules:
        for kw in rule.keywords.split(","):
            existing_keywords.add(kw.strip().lower())
    
    # Extract common merchant/keyword patterns from uncategorized transactions
    from ..services.categorizer import Categorizer
    categorizer = Categorizer()
    
    # Clean descriptions and extract potential keywords
    cleaned_descs = []
    for txn in uncategorized:
        clean = categorizer.clean_description(txn.raw_description or txn.description).lower()
        cleaned_descs.append((txn, clean))
    
    # Find repeated patterns (words appearing 3+ times across different transactions)
    word_counter = Counter()
    word_to_txns = {}
    
    for txn, clean_desc in cleaned_descs:
        # Extract meaningful words (3+ chars, not just numbers)
        words = set(re.findall(r'\b[a-z]{3,}\b', clean_desc))
        for word in words:
            if word not in existing_keywords and len(word) >= 4:
                word_counter[word] += 1
                if word not in word_to_txns:
                    word_to_txns[word] = []
                word_to_txns[word].append(txn)
    
    # Get top patterns (appearing 3+ times)
    suggestions = []
    for keyword, count in word_counter.most_common(10):
        if count < 3:
            continue
        
        sample_txns = word_to_txns[keyword][:3]
        
        # Simple heuristic: suggest a category based on the keyword
        suggested_cat = None
        keyword_lower = keyword.lower()
        
        # Common keyword -> category mappings
        category_hints = {
            "grocery": "Groceries", "supermarket": "Groceries", "coles": "Groceries", "woolworths": "Groceries",
            "uber": "Transport", "lyft": "Transport", "fuel": "Transport", "petrol": "Transport",
            "netflix": "Entertainment", "spotify": "Entertainment", "disney": "Entertainment",
            "restaurant": "Dining Out", "cafe": "Dining Out", "coffee": "Dining Out",
            "pharmacy": "Health", "chemist": "Health", "medical": "Health",
            "insurance": "Insurance", "electricity": "Utilities", "gas": "Utilities", "water": "Utilities",
        }
        
        for hint_kw, hint_cat in category_hints.items():
            if hint_kw in keyword_lower:
                # Check if user has this category
                for bucket in bucket_names:
                    if hint_cat.lower() in bucket.lower() or bucket.lower() in hint_cat.lower():
                        suggested_cat = bucket
                        break
                break
        
        # Default to first bucket if no match
        if not suggested_cat and bucket_names:
            suggested_cat = bucket_names[0]
        
        if suggested_cat:
            suggestions.append(RuleSuggestion(
                keywords=keyword,
                suggested_category=suggested_cat,
                sample_transactions=[
                    TransactionPreview(
                        id=t.id,
                        date=t.date.isoformat() if t.date else "",
                        description=t.description,
                        amount=t.amount
                    ) for t in sample_txns
                ],
                match_count=count,
                reason=f"Found {count} uncategorized transactions containing '{keyword}'"
            ))
    
    return {"suggestions": suggestions[:5]}  # Return top 5 suggestions

