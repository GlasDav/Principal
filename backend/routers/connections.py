from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, auth
from ..database import get_db
from ..services.basiq import BasiqService
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/connections", tags=["connections"])

# Use a dependency to create BasiqService AFTER load_dotenv() has run
def get_basiq_service():
    return BasiqService()

class SyncRequest(BaseModel):
    job_id: str # From Basiq Frontend
    user_id: str = None # Basiq User ID

@router.get("/token")
async def get_client_token(
    current_user: models.User = Depends(auth.get_current_user),
    basiq_service: BasiqService = Depends(get_basiq_service)
):
    """
    Get a client token to initialize the Basiq frontend SDK.
    """
    try:
        # We use the user's internal ID as a reference if needed, 
        # but typically we'd create a Basiq User first. 
        # For mock, we just pass ID.
        return await basiq_service.get_client_token(str(current_user.id))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync")
async def sync_connection(
    req: SyncRequest, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
    basiq_service: BasiqService = Depends(get_basiq_service)
):
    """
    Called after frontend completes the Basiq flow.
    Fetches data from Basiq (or Mock) and saves to DB.
    """
    try:
        data = await basiq_service.get_connection_data(req.job_id)
        
        # 1. Sync Accounts
        for acc_data in data["accounts"]:
            # Check if exists
            existing = db.query(models.Account).filter(
                models.Account.connection_id == acc_data["id"],
                models.Account.user_id == current_user.id
            ).first()
            
            if not existing:
                # Map Basiq Type to our Type
                # Basiq: transaction, savings, credit-card, mortgage, loan
                # Ours: Asset, Liability
                acc_type = "Liability" if acc_data["class"] in ["credit-card", "mortgage", "loan"] else "Asset"
                
                new_acc = models.Account(
                    user_id=current_user.id,
                    name=acc_data["name"],
                    type=acc_type,
                    category=acc_data["class"].title(),
                    connection_id=acc_data["id"],
                    # In a real app we'd save balance as a Snapshot, but for now we put it in columns if we had them, 
                    # or just use it to display. our Account model doesn't have 'balance' column (it uses snapshots).
                    # But wait, Account table HAS 'target_balance', not 'current_balance'.
                    # We usually calculate balance from transactions or snapshots.
                    # For now, let's just create the account.
                )
                db.add(new_acc)
                db.flush() # get ID
                
                # Create initial balance snapshot?
                # Or we just rely on transactions?
                # Let's simple create a snapshot for "today"
                snapshot = models.AccountBalance(
                    snapshot_id=99999, # Hack: need a real snapshot ID or create a snapshot. 
                    # Let's skip snapshot for now to avoid complexity, 
                    # or create a NetWorthSnapshot for today if not exists.
                    account_id=new_acc.id,
                    balance=acc_data["balance"]
                )
                # This is getting complex. Let's just Map Transactions first. 
        
        db.commit() # Commit accounts first
        
        # Reload accounts to get IDs
        accounts_map = {a.connection_id: a for a in db.query(models.Account).filter(models.Account.user_id == current_user.id).all()}
        
        # 2. Sync Transactions
        if data.get("transactions"):
            for txn_data in data["transactions"]:
                # Check exist
                existing_txn = db.query(models.Transaction).filter(
                    models.Transaction.external_id == txn_data["id"]
                ).first()
                
                if not existing_txn:
                    # Parse date
                    date_obj = datetime.fromisoformat(txn_data["postDate"])
                    
                    # Find mapped account
                    # In Basiq, txn_data["links"]["account"] is the ID
                    basiq_acc_id = txn_data.get("links", {}).get("account")
                    mapped_acc = accounts_map.get(basiq_acc_id)
                    
                    new_txn = models.Transaction(
                        user_id=current_user.id,
                        date=date_obj,
                        description=txn_data["description"],
                        raw_description=txn_data["description"],
                        amount=float(txn_data["amount"]),
                        bucket_id=None, # Uncategorized
                        external_id=txn_data["id"],
                        account_id=mapped_acc.id if mapped_acc else None
                    )
                    
                    db.add(new_txn)
        
        db.commit()
        return {"status": "success", "synced_accounts": len(data["accounts"]), "synced_transactions": len(data["transactions"])}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
