from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any, Optional
from .. import models, database, auth
from datetime import date
import csv
import io

router = APIRouter(
    prefix="/investments",
    tags=["investments"]
)

@router.post("/{account_id}/import")
async def import_holdings_csv(
    account_id: int, 
    file: UploadFile = File(...), 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Imports investment holdings from a CSV file.
    Expected Columns: Ticker/Symbol, Quantity/Qty, Cost Basis/Cost/Total Cost
    Optional: Name, Price
    """
    # 1. Verify Account
    account = db.query(models.Account).filter(models.Account.id == account_id, models.Account.user_id == current_user.id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # 2. Read File
    try:
        contents = await file.read()
        decoded = contents.decode('utf-8-sig') # Handle BOM if present
        reader = csv.DictReader(io.StringIO(decoded))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {str(e)}")

    # 3. Process Rows
    imported_count = 0
    updated_count = 0
    errors = []
    
    # Normalize headers logic could be complex, assume standard case-insensitive matching
    for row in reader:
        # Normalize keys to lowercase
        lower_row = {k.lower().strip(): v for k, v in row.items() if k}
        
        # Extract fields
        ticker = lower_row.get('ticker') or lower_row.get('symbol')
        qty_str = lower_row.get('quantity') or lower_row.get('qty') or lower_row.get('shares')
        cost_str = lower_row.get('cost basis') or lower_row.get('cost') or lower_row.get('total cost') or lower_row.get('value')
        name = lower_row.get('name') or lower_row.get('description')
        price_str = lower_row.get('price') or lower_row.get('rate')
        
        if not ticker or not qty_str:
            continue # Skip invalid rows
            
        try:
            qty = float(str(qty_str).replace(',', '').replace('$', ''))
            cost_basis = float(str(cost_str).replace(',', '').replace('$', '')) if cost_str else None
            price_val = float(str(price_str).replace(',', '').replace('$', '')) if price_str else 0.0
            
            # Check for existing holding
            existing = db.query(models.InvestmentHolding).filter(
                models.InvestmentHolding.account_id == account_id,
                models.InvestmentHolding.ticker == ticker
            ).first()
            
            if existing:
                existing.quantity = qty
                if cost_basis is not None:
                     existing.cost_basis = cost_basis
                if name:
                    existing.name = name
                updated_count += 1
            else:
                new_holding = models.InvestmentHolding(
                    account_id=account_id,
                    ticker=ticker,
                    name=name or ticker,
                    quantity=qty,
                    cost_basis=cost_basis,
                    price=price_val, # Temporary, will refresh
                    currency="USD", # Default, will refresh
                    exchange_rate=1.0,
                    value=qty * price_val
                )
                db.add(new_holding)
                imported_count += 1
                
        except Exception as e:
            errors.append(f"Error importing row {row}: {str(e)}")
            
    db.commit()
    
    # Trigger a background price refresh? Or let user do it.
    # Let's let user do it to avoid timeouts.
    
    # Recalculate Account Balance
    # (Copied helper logic from net_worth.py or just trigger update via simple sum)
    # We really should reuse `net_worth.update_account_balance_from_holdings` but imports circle?
    # No, `net_worth` imports `models`. `investments` imports `models`.
    # We can rely on separate Balance Refresh call or duplication.
    # Simple duplication for safety/speed:
    all_holdings = db.query(models.InvestmentHolding).filter(models.InvestmentHolding.account_id == account_id).all()
    total_val = sum(h.value for h in all_holdings)
    
    # Update latest snapshot balance
    latest_snapshot = db.query(models.NetWorthSnapshot).filter(models.NetWorthSnapshot.user_id == current_user.id).order_by(models.NetWorthSnapshot.date.desc()).first()
    if latest_snapshot:
        bal_rec = db.query(models.AccountBalance).filter(models.AccountBalance.snapshot_id==latest_snapshot.id, models.AccountBalance.account_id==account_id).first()
        if bal_rec:
            bal_rec.balance = total_val
        else:
             db.add(models.AccountBalance(snapshot_id=latest_snapshot.id, account_id=account_id, balance=total_val))
        db.commit()

    return {
        "ok": True,
        "imported": imported_count,
        "updated": updated_count,
        "errors": errors
    }

@router.get("/portfolio", response_model=Dict[str, Any])
def get_portfolio_summary(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Returns high-level portfolio metrics: Total Value, Day Change, Total Return.
    """
    # 1. Get all investment holdings
    holdings = db.query(models.InvestmentHolding).join(models.Account).filter(models.Account.user_id == current_user.id).all()
    
    total_value = 0.0
    total_cost_basis = 0.0
    day_change_value = 0.0 # Estimated based on yesterday's close vs current (using Yahoo data if we stored it, or just current price change)
                           # For now, we only have 'price' (current). We don't store "yesterday's close".
                           # Improvement: We should probably store 'day_change_percent' in the DB during refresh.
                           # BUT, we can calculate Total Return easily.
    
    for h in holdings:
        total_value += h.value
        if h.cost_basis:
            total_cost_basis += (h.cost_basis * h.quantity * h.exchange_rate) # Normalize cost basis to home currency
            
    total_return = total_value - total_cost_basis
    total_return_percent = (total_return / total_cost_basis * 100) if total_cost_basis > 0 else 0
    
    return {
        "total_value": total_value,
        "total_cost_basis": total_cost_basis,
        "total_return": total_return,
        "total_return_percent": total_return_percent,
        "holding_count": len(holdings)
    }

@router.get("/allocation", response_model=Dict[str, List[Dict[str, Any]]])
def get_asset_allocation(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Returns asset allocation breakdown by Asset Type and Sector.
    """
    holdings = db.query(models.InvestmentHolding).join(models.Account).filter(models.Account.user_id == current_user.id).all()
    
    by_type = {}
    by_sector = {}
    total_value = 0.0
    
    for h in holdings:
        val = h.value
        total_value += val
        
        # By Type
        t = h.asset_type or "Unclassified"
        by_type[t] = by_type.get(t, 0) + val
        
        # By Sector
        s = h.sector or "Unclassified"
        by_sector[s] = by_sector.get(s, 0) + val
        
    # Format
    type_data = [{"name": k, "value": v, "percent": (v/total_value*100) if total_value > 0 else 0} for k, v in by_type.items()]
    sector_data = [{"name": k, "value": v, "percent": (v/total_value*100) if total_value > 0 else 0} for k, v in by_sector.items()]
    
    # Sort by value desc
    type_data.sort(key=lambda x: x['value'], reverse=True)
    sector_data.sort(key=lambda x: x['value'], reverse=True)
    
    return {
        "by_type": type_data,
        "by_sector": sector_data
    }

@router.get("/holdings", response_model=List[Dict[str, Any]])
def get_holdings_enhanced(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Returns list of holdings with enhanced metrics (Return %, etc.)
    """
    holdings = db.query(models.InvestmentHolding).join(models.Account).filter(models.Account.user_id == current_user.id).all()
    
    result = []
    for h in holdings:
        cost = (h.cost_basis * h.quantity * h.exchange_rate) if h.cost_basis else 0
        gain = h.value - cost
        gain_percent = (gain / cost * 100) if cost > 0 else 0
        
        result.append({
            "id": h.id,
            "ticker": h.ticker,
            "name": h.name,
            "quantity": h.quantity,
            "price": h.price,
            "value": h.value,
            "currency": h.currency,
            "asset_type": h.asset_type,
            "sector": h.sector,
            "account_name": h.account.name,
            "total_return": gain,
            "total_return_percent": gain_percent,
            "cost_basis": cost
        })
        
    return result

@router.get("/history", response_model=List[Dict[str, Any]])
def get_investment_history(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Returns historical total value of all Investment accounts.
    """
    results = db.query(
        models.NetWorthSnapshot.date,
        func.sum(models.AccountBalance.balance).label("total_value")
    ).join(
        models.AccountBalance, models.AccountBalance.snapshot_id == models.NetWorthSnapshot.id
    ).join(
        models.Account, models.AccountBalance.account_id == models.Account.id
    ).filter(
        models.Account.category == "Investment",
        models.NetWorthSnapshot.user_id == current_user.id
    ).group_by(
        models.NetWorthSnapshot.date
    ).order_by(
        models.NetWorthSnapshot.date.asc()
    ).all()
    
    history = [
        {"date": r.date.isoformat(), "value": r.total_value}
        for r in results
    ]
    
    return history
