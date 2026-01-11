from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import date
from ..database import get_db
from .. import models, schemas, auth
from ..services.notification_service import NotificationService
import yfinance as yf
import csv
import io
from collections import defaultdict

router = APIRouter(
    prefix="/net-worth",
    tags=["net-worth"],
)

# --- CSV Import/Export ---

@router.get("/template")
def download_template(current_user: models.User = Depends(auth.get_current_user)):
    """
    Download a CSV template for importing net worth history.
    Template includes example rows showing the expected format.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header row
    writer.writerow(["date", "account_name", "account_type", "account_category", "balance"])
    
    # Example rows to guide the user
    writer.writerow(["01/01/2024", "Savings Account", "Asset", "Cash", "10000.00"])
    writer.writerow(["01/01/2024", "Home Loan", "Liability", "Mortgage", "350000.00"])
    writer.writerow(["01/01/2024", "Brokerage Account", "Asset", "Investment", "25000.00"])
    writer.writerow(["01/02/2024", "Savings Account", "Asset", "Cash", "11500.00"])
    writer.writerow(["01/02/2024", "Home Loan", "Liability", "Mortgage", "349200.00"])
    writer.writerow(["01/02/2024", "Brokerage Account", "Asset", "Investment", "26500.00"])
    
    # Blank row before key
    writer.writerow([])
    
    # Reference key section
    writer.writerow(["# REFERENCE KEY - Delete these rows before importing"])
    writer.writerow(["# account_type options:", "Asset", "Liability", "", ""])
    writer.writerow(["# Asset categories:", "Cash", "Investment", "Superannuation", "Property", "Other"])
    writer.writerow(["# Liability categories:", "Loan", "Mortgage", "Credit Card", "Other", ""])
    writer.writerow(["# date format:", "DD/MM/YYYY", "", "", ""])
    writer.writerow(["# balance:", "Enter as POSITIVE numbers (including liabilities)", "", "", ""])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=net_worth_template.csv"}
    )



# --- Helpers ---

class BalanceUpdate(BaseModel):
    date: date
    balance: float

def recalculate_snapshot(db: Session, snapshot_id: int):
    """
    Recalculates total_assets, total_liabilities, and net_worth for a given snapshot
    based on all account balances associated with it.
    """
    snapshot = db.query(models.NetWorthSnapshot).get(snapshot_id)
    if not snapshot: return

    # Get all balances with account info
    # We join Account to get the type (Asset/Liability)
    results = db.query(models.AccountBalance, models.Account).join(
        models.Account, models.AccountBalance.account_id == models.Account.id
    ).filter(
        models.AccountBalance.snapshot_id == snapshot_id
    ).all()

    total_assets = 0.0
    total_liabilities = 0.0

    for bal, acc in results:
        if acc.type == "Asset":
            total_assets += bal.balance
        else:
            total_liabilities += bal.balance
            
    snapshot.total_assets = total_assets
    snapshot.total_liabilities = total_liabilities
    snapshot.net_worth = total_assets - total_liabilities
    
    db.commit()
    db.refresh(snapshot)

@router.post("/import-history", response_model=schemas.NetWorthImportResult)
def import_history(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Import net worth history from a CSV file.
    
    Expected columns: date, account_name, account_type, account_category, balance
    
    - Creates new accounts if they don't exist
    - Creates/updates snapshots for each unique date
    - Liabilities should be entered as positive numbers (they will be subtracted for net worth)
    """
    errors = []
    created_accounts = 0
    updated_accounts = 0
    imported_snapshots = 0
    
    # Read and decode CSV
    try:
        content = file.file.read().decode('utf-8')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {str(e)}")
    
    reader = csv.DictReader(io.StringIO(content))
    
    # Validate columns
    required_columns = {"date", "account_name", "account_type", "account_category", "balance"}
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or invalid")
    
    missing_columns = required_columns - set(col.strip().lower() for col in reader.fieldnames)
    if missing_columns:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing required columns: {', '.join(missing_columns)}"
        )
    
    # Normalize column names (handle case variations)
    def normalize_row(row):
        return {k.strip().lower(): v.strip() if v else "" for k, v in row.items()}
    
    # Group rows by date
    date_groups = defaultdict(list)
    row_number = 1
    
    for row in reader:
        row_number += 1
        normalized = normalize_row(row)
        
        # Skip empty rows or comment rows (reference key section)
        date_value = normalized.get("date", "")
        if not date_value or date_value.startswith("#"):
            continue
        
        # Validate and parse date (supports dd/mm/yyyy format)
        try:
            from datetime import datetime
            parsed_date = datetime.strptime(date_value, "%d/%m/%Y").date()
        except ValueError:
            errors.append(f"Row {row_number}: Invalid date format '{date_value}'. Use DD/MM/YYYY.")
            continue
        
        # Validate account_type
        account_type = normalized.get("account_type", "").title()
        if account_type not in ["Asset", "Liability"]:
            errors.append(f"Row {row_number}: account_type must be 'Asset' or 'Liability', got '{normalized.get('account_type', '')}'")
            continue
        
        # Validate balance (strip currency symbols and commas)
        try:
            balance_str = normalized.get("balance", "").replace("$", "").replace(",", "").strip()
            if not balance_str:
                errors.append(f"Row {row_number}: Balance is empty")
                continue
            balance = float(balance_str)
        except ValueError:
            errors.append(f"Row {row_number}: Invalid balance '{normalized.get('balance', '')}'")
            continue
        
        account_name = normalized.get("account_name", "").strip()
        if not account_name:
            errors.append(f"Row {row_number}: Account name is empty")
            continue
        
        date_groups[parsed_date].append({
            "account_name": account_name,
            "account_type": account_type,
            "account_category": normalized.get("account_category", "Other").title() or "Other",
            "balance": balance
        })
    
    # Track accounts by name for this user
    account_cache = {}
    existing_accounts = db.query(models.Account).filter(
        models.Account.user_id == current_user.id,
        models.Account.is_active == True
    ).all()
    for acc in existing_accounts:
        account_cache[acc.name.lower()] = acc
    
    # Process each date group
    for snapshot_date, rows in sorted(date_groups.items()):
        # Check for existing snapshot on this date
        existing_snapshot = db.query(models.NetWorthSnapshot).filter(
            models.NetWorthSnapshot.user_id == current_user.id,
            models.NetWorthSnapshot.date == snapshot_date
        ).first()
        
        if existing_snapshot:
            snapshot = existing_snapshot
        else:
            # Create new snapshot
            snapshot = models.NetWorthSnapshot(
                user_id=current_user.id,
                date=snapshot_date,
                total_assets=0,
                total_liabilities=0,
                net_worth=0
            )
            db.add(snapshot)
            db.commit()
            db.refresh(snapshot)
            imported_snapshots += 1
        
        # Process accounts and balances for this date (UPSERT logic)
        for row_data in rows:
            account_key = row_data["account_name"].lower()
            
            # Find or create account
            if account_key in account_cache:
                account = account_cache[account_key]
                # Update category/type if changed
                if account.type != row_data["account_type"] or account.category != row_data["account_category"]:
                    account.type = row_data["account_type"]
                    account.category = row_data["account_category"]
                    updated_accounts += 1
            else:
                # Create new account
                account = models.Account(
                    user_id=current_user.id,
                    name=row_data["account_name"],
                    type=row_data["account_type"],
                    category=row_data["account_category"],
                    balance=row_data["balance"],
                    is_active=True
                )
                db.add(account)
                db.commit()
                db.refresh(account)
                account_cache[account_key] = account
                created_accounts += 1
            
            # Update account's current balance to the latest imported value
            account.balance = row_data["balance"]
            
            # Upsert account balance record (find existing or create new)
            existing_balance = db.query(models.AccountBalance).filter(
                models.AccountBalance.snapshot_id == snapshot.id,
                models.AccountBalance.account_id == account.id
            ).first()
            
            if existing_balance:
                existing_balance.balance = row_data["balance"]
            else:
                balance_record = models.AccountBalance(
                    snapshot_id=snapshot.id,
                    account_id=account.id,
                    balance=row_data["balance"]
                )
                db.add(balance_record)
        
        
        # Recalculate snapshot totals using helper (ensures DB consistency)
        recalculate_snapshot(db, snapshot.id)

        
        db.commit()
    
    return schemas.NetWorthImportResult(
        imported_snapshots=imported_snapshots,
        created_accounts=created_accounts,
        updated_accounts=updated_accounts,
        errors=errors
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


@router.get("/accounts-history")
def get_accounts_history(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Get historical account balances organized by month.
    Returns a matrix of account balances for display in a spreadsheet-style table.
    """
    # Get all snapshots for this user, ordered by date
    snapshots = db.query(models.NetWorthSnapshot).filter(
        models.NetWorthSnapshot.user_id == current_user.id
    ).order_by(models.NetWorthSnapshot.date.asc()).all()
    
    if not snapshots:
        return {"months": [], "dates": [], "accounts": [], "totals": {"assets_by_month": [], "liabilities_by_month": [], "net_worth_by_month": []}}
    
    # Filter to one snapshot per month (the latest one) to avoid column duplication
    snapshots_by_month = {}
    for s in snapshots:
        label = s.date.strftime("%b %y")
        snapshots_by_month[label] = s # Keeps latest due to date sorting
    
    unique_snapshots = list(snapshots_by_month.values())
    months = list(snapshots_by_month.keys())
    dates = [s.date for s in unique_snapshots]
    
    # Get all active accounts for this user
    accounts = db.query(models.Account).filter(
        models.Account.user_id == current_user.id,
        models.Account.is_active == True
    ).order_by(models.Account.type, models.Account.category, models.Account.name).all()
    
    # Build account balance matrix
    account_data = []
    for account in accounts:
        balances = []
        for snapshot in unique_snapshots:
            # Find balance for this account in this snapshot
            balance_record = db.query(models.AccountBalance).filter(
                models.AccountBalance.snapshot_id == snapshot.id,
                models.AccountBalance.account_id == account.id
            ).first()
            
            balances.append(balance_record.balance if balance_record else None)
        
        account_data.append({
            "id": account.id,
            "name": account.name,
            "type": account.type,
            "category": account.category,
            "balances_by_month": balances
        })
    
    # Calculate totals by month
    assets_by_month = []
    liabilities_by_month = []
    net_worth_by_month = []
    
    for snapshot in unique_snapshots:
        assets_by_month.append(snapshot.total_assets)
        liabilities_by_month.append(snapshot.total_liabilities)
        net_worth_by_month.append(snapshot.net_worth)
    
    return {
        "months": months,
        "dates": dates,
        "accounts": account_data,
        "totals": {
            "assets_by_month": assets_by_month,
            "liabilities_by_month": liabilities_by_month,
            "net_worth_by_month": net_worth_by_month
        }
    }


@router.post("/accounts", response_model=schemas.Account)
def create_account(account: schemas.AccountCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_account = models.Account(**account.dict())
    db_account.user_id = current_user.id
    # Ensure targets are passed if in dict
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account
    return db_account

@router.patch("/accounts/{account_id}/balance", response_model=schemas.NetWorthSnapshot)
def update_account_balance_history(
    account_id: int, 
    update: BalanceUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Updates the balance of an account for a specific month (snapshot).
    Creates the snapshot if it doesn't exist.
    Recalculates totals.
    Return the updated Snapshot.
    """
    # 1. Verify Account
    account = db.query(models.Account).filter(models.Account.id == account_id, models.Account.user_id == current_user.id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # 2. Find or Create Snapshot for the date (normalized to day 1, or exact date?)
    # Generally snapshots are monthly, often stored as YYYY-MM-01 or specific date.
    # The frontend usually passes the exact date key from the column.
    # Let's trust the date passed.
    
    snapshot = db.query(models.NetWorthSnapshot).filter(
        models.NetWorthSnapshot.user_id == current_user.id,
        models.NetWorthSnapshot.date == update.date
    ).first()
    
    if not snapshot:
        # Create new snapshot
        new_snapshot = models.NetWorthSnapshot(
            user_id=current_user.id,
            date=update.date,
            total_assets=0,
            total_liabilities=0,
            net_worth=0
        )
        db.add(new_snapshot)
        db.commit()
        db.refresh(new_snapshot)
        snapshot = new_snapshot
        
        # --- CARRY FORWARD LOGIC (New Snapshot via PATCH) ---
        prev_snapshot = db.query(models.NetWorthSnapshot)\
            .filter(models.NetWorthSnapshot.user_id == current_user.id,
                    models.NetWorthSnapshot.date < update.date)\
            .order_by(models.NetWorthSnapshot.date.desc())\
            .first()
            
        if prev_snapshot:
            prev_bals = db.query(models.AccountBalance).filter(models.AccountBalance.snapshot_id == prev_snapshot.id).all()
            for pb in prev_bals:
                # Don't overwrite the account we are about to update
                if pb.account_id != account_id:
                     db.add(models.AccountBalance(
                         snapshot_id=snapshot.id,
                         account_id=pb.account_id,
                         balance=pb.balance
                     ))
            db.commit()
    
    # 3. Update/Create Balance Record for THIS account
    balance_record = db.query(models.AccountBalance).filter(
        models.AccountBalance.snapshot_id == snapshot.id,
        models.AccountBalance.account_id == account_id
    ).first()
    
    if balance_record:
        balance_record.balance = update.balance
    else:
        balance_record = models.AccountBalance(
            snapshot_id=snapshot.id,
            account_id=account_id,
            balance=update.balance
        )
        db.add(balance_record)
    
    db.commit()
    
    # 4. Recalculate
    recalculate_snapshot(db, snapshot.id)
    
    return snapshot

@router.post("/recalculate-all")
def recalculate_all_snapshots(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Force recalculation of all snapshot totals based on underlying balances.
    Performs 'Gap Filling' (Carry Forward) to fix missing data in historical snapshots.
    """
    # 1. Get all snapshots ordered by Date
    snapshots = db.query(models.NetWorthSnapshot)\
        .filter(models.NetWorthSnapshot.user_id == current_user.id)\
        .order_by(models.NetWorthSnapshot.date.asc())\
        .all()
        
    last_known = {}
    total_repaired = 0
    count = 0
    
    for s in snapshots:
        # Get current balances for this snapshot
        bals = db.query(models.AccountBalance).filter(models.AccountBalance.snapshot_id == s.id).all()
        current_map = {b.account_id: b.balance for b in bals}
        
        # 1. Update 'Last Known' with data present in this snapshot
        for aid, val in current_map.items():
            last_known[aid] = val
            
        # 2. Fill Gaps: If we know an account has a balance but it's missing here, carry it forward
        for aid, known_val in last_known.items():
            if aid not in current_map:
                # GAP DETECTED - Insert carry-forward balance
                db.add(models.AccountBalance(
                    snapshot_id=s.id,
                    account_id=aid,
                    balance=known_val
                ))
                total_repaired += 1
        
        db.commit() # Commit repairs for this snapshot
        
        # 3. Recalculate Totals (now uses repaired data)
        recalculate_snapshot(db, s.id)
        count += 1
        
    return {"recalculated": count, "repaired_entries": total_repaired}

@router.get("/debug-data")
def debug_net_worth_data(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Diagnostic endpoint to inspect snapshot data state.
    Returns details about present, zero-valued, and missing account records for each snapshot.
    """
    snapshots = db.query(models.NetWorthSnapshot)\
        .filter(models.NetWorthSnapshot.user_id == current_user.id)\
        .order_by(models.NetWorthSnapshot.date.asc())\
        .all()
        
    results = []
    
    # Get all active accounts to detect missing ones
    all_accounts = db.query(models.Account).filter(models.Account.user_id == current_user.id).all()
    all_acct_dict = {a.id: a.name for a in all_accounts}
    
    for s in snapshots:
        bals = db.query(models.AccountBalance).filter(models.AccountBalance.snapshot_id == s.id).all()
        bal_map = {b.account_id: b.balance for b in bals}
        
        missing = []
        zeros = []
        present = []
        
        for aid, name in all_acct_dict.items():
            if aid not in bal_map:
                missing.append(name)
            elif bal_map[aid] == 0:
                zeros.append(name)
            else:
                present.append(f"{name}: {bal_map[aid]}")
                
        results.append({
            "date": s.date,
            "net_worth": s.net_worth,
            "total_assets": s.total_assets,
            "record_count": len(bals),
            "present_str": ", ".join(present),
            "zeros_str": ", ".join(zeros),
            "missing_str": ", ".join(missing)
        })
        
    return results

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
        db.delete(existing)
        db.commit()
    
    # Create Snapshot (empty initially)
    new_snapshot = models.NetWorthSnapshot(
        date=snapshot_in.date,
        user_id=current_user.id,
        total_assets=0,
        total_liabilities=0,
        net_worth=0
    )
    db.add(new_snapshot)
    db.commit()
    db.refresh(new_snapshot)
    
    # --- CARRY FORWARD LOGIC ---
    # Find Previous Snapshot to carry forward balances
    prev_snapshot = db.query(models.NetWorthSnapshot)\
        .filter(models.NetWorthSnapshot.user_id == current_user.id,
                models.NetWorthSnapshot.date < snapshot_in.date)\
        .order_by(models.NetWorthSnapshot.date.desc())\
        .first()

    final_balances = {}

    # 1. Load from Previous Snapshot
    if prev_snapshot:
        prev_bals = db.query(models.AccountBalance).filter(models.AccountBalance.snapshot_id == prev_snapshot.id).all()
        for pb in prev_bals:
            final_balances[pb.account_id] = pb.balance
            
    # 2. Override with Incoming Data
    for b_in in snapshot_in.balances:
        final_balances[b_in.account_id] = b_in.balance
        
    # 3. Write to DB
    for acc_id, val in final_balances.items():
        # Verify account ownership (implicit via prev_snapshot/input, but good to be safe if strict)
        # We assume prev_snapshot data is valid. Input data verified below individually if needed.
        # For speed/simplicity we trust the IDs are valid for the user or won't be queried if they aren't.
        # But let's check existence to avoid foreign key errors if account was deleted?
        # AccountBalance has FK to Account.
        
        db_balance = models.AccountBalance(
             snapshot_id=new_snapshot.id,
             account_id=acc_id,
             balance=val
        )
        db.add(db_balance)
        
    db.commit()
    
    # Recalculate Totals
    recalculate_snapshot(db, new_snapshot.id)
    db.refresh(new_snapshot)
    
    # Notifications
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


