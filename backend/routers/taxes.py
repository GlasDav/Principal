from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import List, Optional
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(
    prefix="/taxes",
    tags=["taxes"],
)

# 2024 Tax Constants
# 2024-2025 ATO Tax Constants (Stage 3 Tax Cuts)
# Rates: https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents
TAX_DATA_AU_2025 = {
    "Resident": {
        "tax_free_threshold": 18200,
        "medicare_levy_rate": 0.02, # 2%
        "brackets": [
            (0.00, 0, 18200),
            (0.16, 18200, 45000),
            (0.30, 45000, 135000),
            (0.37, 135000, 190000),
            (0.45, 190000, float('inf'))
        ]
    },
    "Non-Resident": {
        "tax_free_threshold": 0,
        "medicare_levy_rate": 0.00, # Non-residents usually exempt
        "brackets": [
            (0.30, 0, 135000),
            (0.37, 135000, 190000),
            (0.45, 190000, float('inf'))
        ]
    }
}

@router.get("/settings", response_model=schemas.TaxSettings)
def get_tax_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    settings = db.query(models.TaxSettings).filter(models.TaxSettings.user_id == current_user.id).first()
    if not settings:
        # Create default
        settings = models.TaxSettings(
            user_id=current_user.id,
            filing_status="Resident" # Default to Resident
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    # Auto-correct legacy US statuses to Resident
    if settings.filing_status not in ["Resident", "Non-Resident"]:
        settings.filing_status = "Resident"
        db.commit()
        
    return settings

@router.put("/settings", response_model=schemas.TaxSettings)
def update_tax_settings(
    settings_update: schemas.TaxSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    settings = db.query(models.TaxSettings).filter(models.TaxSettings.user_id == current_user.id).first()
    if not settings:
        settings = models.TaxSettings(user_id=current_user.id)
        db.add(settings)
    
    for key, value in settings_update.dict(exclude_unset=True).items():
        setattr(settings, key, value)
        
    db.commit()
    db.refresh(settings)
    return settings

@router.get("/estimate", response_model=schemas.TaxEstimation)
def estimate_taxes(
    year: int = Query(default=datetime.now().year),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # 1. Get Settings
    settings = db.query(models.TaxSettings).filter(models.TaxSettings.user_id == current_user.id).first()
    if not settings:
        settings = models.TaxSettings(user_id=current_user.id, filing_status="Resident")
    
    if settings.filing_status not in TAX_DATA_AU_2025:
        status = "Resident" # Fallback
    else:
        status = settings.filing_status

    # 2. Calculate Gross Income for Financial Year (July - June)
    # For simplicity in this tools, we stick to Calendar Year OR user selection
    # Ideally, we should switch to Financial Year logic (July 1 -> June 30)
    # But for this MVP step, we will keep the date range as passing year matching
    # TODO: Implement Financial Year Date Range logic
    
    s_date = datetime(year, 1, 1)
    e_date = datetime(year + 1, 1, 1)
    
    income_query = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.date >= s_date,
        models.Transaction.date < e_date,
        models.Transaction.amount > 0
    )
    
    gross_income = income_query.scalar() or 0.0
    
    # 3. Determine Deductions
    # In AU, 'standard deduction' doesn't exist. There is a tax-free threshold.
    # We treat 'custom_deduction' as work-related expenses input by user.
    deductions = settings.custom_deduction or 0.0
        
    taxable_income = max(0, gross_income - deductions)
    
    # 4. Calculate Tax
    config = TAX_DATA_AU_2025[status]
    brackets = config["brackets"]
    
    total_income_tax = 0.0
    brackets_breakdown = []
    marginal_rate = 0.0
    
    remaining_income = taxable_income
    
    # Calculate Income Tax
    for rate, lower, upper in brackets:
        if taxable_income <= lower:
             continue
        
        if taxable_income > lower:
            # Calculate amount filling this bracket
            # upper can be float('inf')
            
            # The portion of income in this bracket is:
            # min(taxable_income, upper) - lower
            
            income_in_bracket = min(taxable_income, upper) - lower
            tax_in_bracket = income_in_bracket * rate
            total_income_tax += tax_in_bracket
            marginal_rate = rate 
            
            brackets_breakdown.append({
                "rate": rate,
                "min": lower,
                "max": upper if upper != float('inf') else None,
                "tax_for_bracket": tax_in_bracket
            })
            
            if taxable_income <= upper:
                pass # Continue to next? No, technically we keep going to check next brackets, but we won't enter them if income < lower
                
    # 5. Medicare Levy
    # 2% of TAXABLE income (if resident)
    # Note: Low income earners have reductions, but we do simple 2% for now
    medicare_levy = 0.0
    if config["medicare_levy_rate"] > 0 and taxable_income > 26000: # Approx threshold 2024
         medicare_levy = taxable_income * config["medicare_levy_rate"]
         brackets_breakdown.append({
             "rate": config["medicare_levy_rate"],
             "min": 0,
             "max": None,
             "tax_for_bracket": medicare_levy,
             "label": "Medicare Levy"
         })

    total_tax = total_income_tax + medicare_levy
                
    effective_rate = (total_tax / gross_income) if gross_income > 0 else 0.0
    
    return {
        "gross_income": gross_income,
        "deduction": deductions,
        "taxable_income": taxable_income,
        "total_tax": total_tax,
        "effective_rate": effective_rate,
        "marginal_rate": marginal_rate,
        "brackets_breakdown": brackets_breakdown
    }
