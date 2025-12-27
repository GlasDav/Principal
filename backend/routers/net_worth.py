from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from ..database import get_db
from .. import models, schemas, auth
from ..services.notification_service import NotificationService
import yfinance as yf

router = APIRouter(
    prefix="/net-worth",
    tags=["net-worth"],
)

# --- Accounts ---

@router.get("/accounts", response_model=List[schemas.Account])
def get_accounts(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    accounts = db.query(models.Account).filter(models.Account.is_active == True, models.Account.user_id == current_user.id).all()
    
    # For Investment accounts, compute balance from holdings
    for acc in accounts:
        if acc.category == 'Investment':
            holdings = db.query(models.InvestmentHolding).filter(models.InvestmentHolding.account_id == acc.id).all()
            acc.balance = sum(h.value for h in holdings)
    
    return accounts

@router.post("/accounts", response_model=schemas.Account)
def create_account(account: schemas.AccountCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_account = models.Account(**account.dict())
    db_account.user_id = current_user.id
    # Ensure targets are passed if in dict
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account

@router.put("/accounts/{account_id}", response_model=schemas.Account)
def update_account(account_id: int, account_update: schemas.AccountCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_account = db.query(models.Account).filter(models.Account.id == account_id, models.Account.user_id == current_user.id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    db_account.name = account_update.name
    db_account.type = account_update.type
    db_account.category = account_update.category
    db_account.is_active = account_update.is_active
    db_account.target_balance = account_update.target_balance
    db_account.target_date = account_update.target_date
    
    # Handle Balance Update (Manual Accounts)
    if account_update.balance is not None:
        db_account.balance = account_update.balance
        
        # Sync with latest snapshot (or create one if none exists)
        latest_snapshot = db.query(models.NetWorthSnapshot).filter(models.NetWorthSnapshot.user_id == current_user.id).order_by(models.NetWorthSnapshot.date.desc()).first()
        
        if not latest_snapshot:
            # Auto-create initial snapshot for today
            from datetime import date as dt_date
            latest_snapshot = models.NetWorthSnapshot(
                date=dt_date.today().replace(day=1),  # First of current month
                user_id=current_user.id,
                total_assets=0,
                total_liabilities=0,
                net_worth=0
            )
            db.add(latest_snapshot)
            db.commit()
            db.refresh(latest_snapshot)
        
        # Now update the balance record
        balance_record = db.query(models.AccountBalance).filter(
            models.AccountBalance.snapshot_id == latest_snapshot.id,
            models.AccountBalance.account_id == account_id
        ).first()
        
        if balance_record:
            balance_record.balance = account_update.balance
        else:
            balance_record = models.AccountBalance(
                snapshot_id=latest_snapshot.id,
                account_id=account_id,
                balance=account_update.balance
            )
            db.add(balance_record)
        
        db.commit() # Commit balance first
        
        # Recalculate Snapshot Totals
        all_balances = db.query(models.AccountBalance).filter(models.AccountBalance.snapshot_id == latest_snapshot.id).all()
        new_assets = 0.0
        new_liabilities = 0.0
        for b in all_balances:
            acct = db.query(models.Account).get(b.account_id)
            if acct:
                if acct.type == "Asset":
                    new_assets += b.balance
                else:
                    new_liabilities += b.balance
        
        latest_snapshot.total_assets = new_assets
        latest_snapshot.total_liabilities = new_liabilities
        latest_snapshot.net_worth = new_assets - new_liabilities
    
    db.commit()
    db.refresh(db_account)
    return db_account

@router.delete("/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_account = db.query(models.Account).filter(models.Account.id == account_id, models.Account.user_id == current_user.id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Soft delete
    db_account.is_active = False
    db.commit()
    return {"ok": True}

# --- Snapshots ---

@router.get("/history", response_model=List[schemas.NetWorthSnapshot])
def get_history(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.NetWorthSnapshot).filter(models.NetWorthSnapshot.user_id == current_user.id).order_by(models.NetWorthSnapshot.date.asc()).all()

@router.post("/snapshot", response_model=schemas.NetWorthSnapshot)
def create_snapshot(snapshot_in: schemas.NetWorthSnapshotCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Check if snapshot exists for date
    existing = db.query(models.NetWorthSnapshot).filter(models.NetWorthSnapshot.date == snapshot_in.date, models.NetWorthSnapshot.user_id == current_user.id).first()
    if existing:
        # For now, simplistic approach: delete old balances and re-calculate
        # Or just reject?
        # Let's delete old one and replace to handle updates easily
        db.delete(existing)
        db.commit()
    
    # Calculate totals
    total_assets = 0.0
    total_liabilities = 0.0
    
    # Create Snapshot
    new_snapshot = models.NetWorthSnapshot(
        date=snapshot_in.date,
        user_id=current_user.id,
        total_assets=0, # placeholder, update after
        total_liabilities=0,
        net_worth=0
    )
    db.add(new_snapshot)
    db.commit()
    db.refresh(new_snapshot)
    
    # Add Balances
    for balance_item in snapshot_in.balances:
        account = db.query(models.Account).filter(models.Account.id == balance_item.account_id, models.Account.user_id == current_user.id).first()
        if not account: continue
        
        # Calculate Logic
        val = balance_item.balance
        if account.type == "Asset":
            total_assets += val
        else:
            total_liabilities += val # Assuming liabilities enter as positive debt? Or negative?
            # Standard: Liabilities are positive numbers representing debt amount. 
            # Net Worth = Assets - Liabilities.
            
        db_balance = models.AccountBalance(
            snapshot_id=new_snapshot.id,
            account_id=account.id,
            balance=val
        )
        db.add(db_balance)
        
    new_snapshot.total_assets = total_assets
    new_snapshot.total_liabilities = total_liabilities
    new_snapshot.net_worth = total_assets - total_liabilities
    
    db.commit()
    db.refresh(new_snapshot)
    
    # Check goal milestones for linked accounts
    NotificationService.check_all_goal_milestones(db, current_user.id)
    
    return new_snapshot

# --- Holdings ---

@router.get("/accounts/{account_id}/holdings", response_model=List[schemas.InvestmentHolding])
def get_holdings(account_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verify account ownership
    account = db.query(models.Account).filter(models.Account.id == account_id, models.Account.user_id == current_user.id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return db.query(models.InvestmentHolding).filter(models.InvestmentHolding.account_id == account_id).all()

# --- Helpers ---

def get_exchange_rate(holding_currency: str, user_currency: str) -> float:
    """
    Robust Exchange Rate Lookup: Foreign -> Home (e.g. USD -> AUD).
    """
    if holding_currency == user_currency:
        return 1.0
        
    exchange_rate = 1.0
    
    # Try direct pair first: e.g. USDAUD=X (Price of 1 USD in AUD)
    fx_symbol_direct = f"{holding_currency}{user_currency}=X"
    
    try:
        fx = yf.Ticker(fx_symbol_direct)
        rate = fx.fast_info.last_price
        
        if rate:
             return rate
             
        # Try inverse pair: e.g. AUDUSD=X (Price of 1 AUD in USD)
        fx_symbol_inv = f"{user_currency}{holding_currency}=X"
        fx_inv = yf.Ticker(fx_symbol_inv)
        rate_inv = fx_inv.fast_info.last_price
        
        if rate_inv:
            return 1.0 / rate_inv
            
        # Final fallback: check for common hardcoded quirks
        if user_currency == "AUD" and holding_currency == "USD":
            # Try standard AUD=X (which is AUDUSD)
            std_pair = yf.Ticker("AUD=X") 
            std_rate = std_pair.fast_info.last_price
            if std_rate:
                return 1.0 / std_rate
    except Exception:
        pass # Return 1.0 on failure
        
    return exchange_rate

@router.post("/accounts/{account_id}/holdings", response_model=schemas.InvestmentHolding)
def create_holding(account_id: int, holding: schemas.InvestmentHoldingCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verify account ownership
    account = db.query(models.Account).filter(models.Account.id == account_id, models.Account.user_id == current_user.id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    db_holding = models.InvestmentHolding(**holding.dict())
    db_holding.account_id = account_id
    
    # Dynamic Currency Check
    user_currency = (current_user.currency_symbol or "AUD").upper().replace("$", "").strip()
    if user_currency in ["A", "AU"]: user_currency = "AUD"
    if user_currency in ["US", "U"]: user_currency = "USD"
    
    # Calculate System Value: Qty * Price * Exchange Rate
    # Fetch Exchange Rate if 1.0 was passed (default) or check match
    if holding.exchange_rate == 1.0 and holding.currency != user_currency:
        rate = get_exchange_rate(holding.currency, user_currency)
        db_holding.exchange_rate = rate
    
    db_holding.value = holding.quantity * holding.price * db_holding.exchange_rate
    
    db.add(db_holding)
    db.commit()
    db.refresh(db_holding)
    
    # Update Snapshot
    update_account_balance_from_holdings(db, current_user.id, account_id)
    
    return db_holding

@router.put("/holdings/{holding_id}", response_model=schemas.InvestmentHolding)
def update_holding(holding_id: int, holding_update: schemas.InvestmentHoldingCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # 1. Get Holding
    db_holding = db.query(models.InvestmentHolding).get(holding_id)
    if not db_holding:
        raise HTTPException(status_code=404, detail="Holding not found")
        
    # 2. Verify Account Ownership Explicitly
    account = db.query(models.Account).get(db_holding.account_id)
    if not account or account.user_id != current_user.id:
         raise HTTPException(status_code=404, detail="Holding not found") # Mask ownership
    
    db_holding.ticker = holding_update.ticker
    db_holding.name = holding_update.name
    db_holding.quantity = holding_update.quantity
    db_holding.price = holding_update.price
    db_holding.cost_basis = holding_update.cost_basis
    db_holding.currency = holding_update.currency
    
    # Dynamic Currency Check
    user_currency = (current_user.currency_symbol or "AUD").upper().replace("$", "").strip()
    if user_currency in ["A", "AU"]: user_currency = "AUD"
    if user_currency in ["US", "U"]: user_currency = "USD"
    
    if holding_update.exchange_rate == 1.0 and holding_update.currency != user_currency:
        rate = get_exchange_rate(holding_update.currency, user_currency)
        db_holding.exchange_rate = rate
    else:
        db_holding.exchange_rate = holding_update.exchange_rate
    
    # Recalculate Value
    db_holding.value = holding_update.quantity * holding_update.price * db_holding.exchange_rate
    
    db.commit()
    db.refresh(db_holding)
    
    # Update Snapshot
    update_account_balance_from_holdings(db, current_user.id, db_holding.account_id)
    
    return db_holding

@router.delete("/holdings/{holding_id}")
def delete_holding(holding_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # 1. Get Holding
    db_holding = db.query(models.InvestmentHolding).get(holding_id)
    if not db_holding:
        raise HTTPException(status_code=404, detail="Holding not found")
        
    # 2. Verify Account Ownership Explicitly
    account = db.query(models.Account).get(db_holding.account_id)
    if not account or account.user_id != current_user.id:
         raise HTTPException(status_code=404, detail="Holding not found")
    
    # Save account_id for snapshot update
    account_id = db_holding.account_id
    
    db.delete(db_holding)
    db.commit()
    
    # Update Snapshot
    update_account_balance_from_holdings(db, current_user.id, account_id)
    
    return {"ok": True}

@router.post("/holdings/refresh-prices")
def refresh_holding_prices(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Updates the price and value of ALL investment holdings for the current user
    using real-time data from Yahoo Finance.
    
    CRITICAL CHANGE: Converts EVERYTHING to User's Home Currency (e.g. AUD).
    """
    # 1. Get all holdings for user
    holdings = db.query(models.InvestmentHolding).join(models.Account).filter(models.Account.user_id == current_user.id).all()
    
    if not holdings:
        return {"message": "No holdings to update", "updated_count": 0}
        
    updated_count = 0
    errors = []
    affected_account_ids = set()
    
    # Clean up currency symbol (remove $)
    raw_symbol = (current_user.currency_symbol or "AUD").upper().replace("$", "").strip()
    user_currency = raw_symbol
    if raw_symbol in ["A", "AU"]: user_currency = "AUD"
    if raw_symbol in ["US", "U"]: user_currency = "USD"
    
    # 2. Iterate and Update (Sequential for now, can optimize with batching later if needed)
    for holding in holdings:
        try:
            ticker_symbol = holding.ticker
            if not ticker_symbol: continue
            
            t = yf.Ticker(ticker_symbol)
            # Use fast_info for speed
            info = t.fast_info
            
            # Fetch Price
            current_price = info.last_price
            if current_price is None:
                # Try fallback to standard info
                current_price = t.info.get('regularMarketPrice') or t.info.get('currentPrice')
                
            if current_price:
                holding.price = current_price
                
                # Update Meta (Currency/Exchange Rate)
                holding_currency = (t.fast_info.currency or "USD").upper()
                holding.currency = holding_currency
                
                # Update Exchange Rate Logic: Foreign -> Home (e.g. USD -> AUD)
                holding.exchange_rate = get_exchange_rate(holding_currency, user_currency)
                
                # Recalculate Value (Quantity * Price * ExchangeRate)
                holding.value = holding.quantity * holding.price * holding.exchange_rate
                updated_count += 1
                affected_account_ids.add(holding.account_id)
            else:
                errors.append(f"Could not fetch price for {ticker_symbol}")
                
        except Exception as e:
             errors.append(f"Error updating {holding.ticker}: {str(e)}")
             
    db.commit()
    
    # 3. Update Snapshots for affected accounts
    for acc_id in affected_account_ids:
        update_account_balance_from_holdings(db, current_user.id, acc_id)
        
    return {
        "ok": True, 
        "updated_count": updated_count, 
        "errors": errors
    }

# --- Helpers ---

def update_account_balance_from_holdings(db: Session, user_id: int, account_id: int):
    """
    Recalculates the total value of holdings for an account and updates 
    the balance in the LATEST Net Worth Snapshot.
    """
    # 1. Calculate Total Holdings Value
    holdings = db.query(models.InvestmentHolding).filter(models.InvestmentHolding.account_id == account_id).all()
    total_value = sum(h.value for h in holdings)
    
    # 2. Find Latest Snapshot
    latest_snapshot = db.query(models.NetWorthSnapshot).filter(models.NetWorthSnapshot.user_id == user_id).order_by(models.NetWorthSnapshot.date.desc()).first()
    
    if not latest_snapshot:
        return # No snapshot to update
        
    # 3. Find or Create AccountBalance in this snapshot
    balance_record = db.query(models.AccountBalance).filter(
        models.AccountBalance.snapshot_id == latest_snapshot.id,
        models.AccountBalance.account_id == account_id
    ).first()
    
    if balance_record:
        balance_record.balance = total_value
    else:
        balance_record = models.AccountBalance(
            snapshot_id=latest_snapshot.id,
            account_id=account_id,
            balance=total_value
        )
        db.add(balance_record)
    
    db.commit() # Commit balance change first
    
    # 4. Recalculate Snapshot Totals (Assets/Liabilities/NetWorth)
    # We need to re-sum ALL balances in this snapshot, because we just changed one
    all_balances = db.query(models.AccountBalance).filter(models.AccountBalance.snapshot_id == latest_snapshot.id).all()
    
    new_assets = 0.0
    new_liabilities = 0.0
    
    for b in all_balances:
        # Fetch account type efficiently. 
        # Note: This N+1 query is acceptable for small number of accounts (~10-20), 
        # but joining is better. For simplicity/speed of impl:
        acct = db.query(models.Account).get(b.account_id)
        if acct:
            if acct.type == "Asset":
                new_assets += b.balance
            else:
                new_liabilities += b.balance
                
    latest_snapshot.total_assets = new_assets
    latest_snapshot.total_liabilities = new_liabilities
    latest_snapshot.net_worth = new_assets - new_liabilities
    
    db.commit()
    
    # Check goal milestones for this update
    NotificationService.check_all_goal_milestones(db, user_id)


