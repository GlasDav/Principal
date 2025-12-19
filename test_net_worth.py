import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from datetime import date
import sys
import os

# Add current dir to sys.path
sys.path.append(os.getcwd())

from backend.main import app
from backend.database import Base, get_db
from backend.models import Account, NetWorthSnapshot

# Setup in-memory DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}, 
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def test_net_worth_flow():
    # 1. Init DB
    Base.metadata.create_all(bind=engine)
    
    # 2. Create Accounts
    print("Creating Accounts...")
    res1 = client.post("/net-worth/accounts", json={
        "name": "Savings", "type": "Asset", "category": "Cash"
    })
    assert res1.status_code == 200
    acc1_id = res1.json()["id"]
    
    res2 = client.post("/net-worth/accounts", json={
        "name": "Car Loan", "type": "Liability", "category": "Loan"
    })
    assert res2.status_code == 200
    acc2_id = res2.json()["id"]
    
    print(f"Accounts Created: {acc1_id}, {acc2_id}")
    
    # 3. Submit Snapshot
    print("Submitting Snapshot...")
    today = date.today().isoformat()
    payload = {
        "date": today,
        "balances": [
            {"account_id": acc1_id, "balance": 10000.0}, # +10k Asset
            {"account_id": acc2_id, "balance": 5000.0}   # +5k Liability (Debt)
        ]
    }
    
    res_snap = client.post("/net-worth/snapshot", json=payload)
    if res_snap.status_code != 200:
        print(res_snap.json())
        
    assert res_snap.status_code == 200
    snap_data = res_snap.json()
    
    # 4. Verify Calculations
    # Assets = 10k, Liabilities = 5k, Net Worth = 5k
    print(f"Snapshot Result: {snap_data}")
    assert snap_data["total_assets"] == 10000.0
    assert snap_data["total_liabilities"] == 5000.0
    assert snap_data["net_worth"] == 5000.0
    
    # 5. Verify History
    print("Verifying History...")
    res_hist = client.get("/net-worth/history")
    assert res_hist.status_code == 200
    history = res_hist.json()
    assert len(history) == 1
    assert history[0]["net_worth"] == 5000.0
    
    print("Test Passed!")

if __name__ == "__main__":
    try:
        test_net_worth_flow()
    except Exception as e:
        print(f"Test Failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
