from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
import csv
import io
import json
from datetime import datetime

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/export",
    tags=["export"]
)

@router.get("/transactions")
def export_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = Query("csv", enum=["csv", "json"]),
    db: Session = Depends(get_db)
):
    # Base query
    query = db.query(models.Transaction)
    
    # Filter by date if provided
    if start_date:
        query = query.filter(models.Transaction.date >= start_date)
    if end_date:
        query = query.filter(models.Transaction.date <= end_date)
        
    transactions = query.order_by(models.Transaction.date.desc()).all()
    
    if format == "json":
        data = [
            {
                "date": t.date.isoformat() if t.date else None,
                "description": t.description,
                "amount": float(t.amount),
                "category": t.bucket.name if t.bucket else "Uncategorized",
                "account": t.account.name if t.account else "Unknown",
                "type": "income" if t.amount > 0 else "expense",
                "notes": t.notes
            }
            for t in transactions
        ]
        
        # Create a generator-like stream for JSON
        json_str = json.dumps(data, indent=2)
        return StreamingResponse(
            io.StringIO(json_str),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=transactions_export_{datetime.now().strftime('%Y%m%d')}.json"}
        )
        
    else: # CSV
        stream = io.StringIO()
        writer = csv.writer(stream)
        
        # Write header
        writer.writerow(["Date", "Description", "Amount", "Type", "Category", "Account", "Notes"])
        
        # Write data
        for t in transactions:
            writer.writerow([
                t.date,
                t.description,
                t.amount,
                "Income" if t.amount > 0 else "Expense",
                t.bucket.name if t.bucket else "Uncategorized",
                t.account.name if t.account else "Unknown",
                t.notes or ""
            ])
            
        stream.seek(0)
        return StreamingResponse(
            iter([stream.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=transactions_export_{datetime.now().strftime('%Y%m%d')}.csv"}
        )

@router.get("/net-worth")
def export_net_worth(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    # Fetch history
    query = db.query(models.NetWorthSnapshot)
    
    if start_date:
        query = query.filter(models.NetWorthSnapshot.date >= start_date)
    if end_date:
        query = query.filter(models.NetWorthSnapshot.date <= end_date)
        
    snapshots = query.order_by(models.NetWorthSnapshot.date.desc()).all()
    
    stream = io.StringIO()
    writer = csv.writer(stream)
    
    # Header
    writer.writerow(["Date", "Total Net Worth", "Total Assets", "Total Liabilities"])
    
    # Data
    for s in snapshots:
        writer.writerow([
            s.date,
            s.net_worth,
            s.total_assets,
            s.total_liabilities
        ])
        
    stream.seek(0)
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=net_worth_history_{datetime.now().strftime('%Y%m%d')}.csv"}
    )
