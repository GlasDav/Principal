import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import sys
import os

# Add current dir to sys.path so backend imports work
sys.path.append(os.getcwd())

from sqlalchemy.pool import StaticPool
from backend.main import app
from backend.database import Base, get_db
from backend.models import User, Transaction

# Setup test DB
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

def test_update_spender():
    # 1. Init DB
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # 2. Add Test Data
    user = User(username="testuser", name_a="A", name_b="B")
    db.add(user)
    db.commit()
    db.refresh(user)

    txn = Transaction(
        date=datetime.now(), 
        description="Test Txn", 
        amount=-50.0, 
        user_id=user.id,
        spender="Joint"
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    
    print(f"Initial State: Spender={txn.spender}")

    # 3. Call API
    # Note: Pydantic model TransactionUpdate expects optional fields
    response = client.put(f"/transactions/{txn.id}", json={"spender": "User A"})
    
    if response.status_code != 200:
        print(f"Response Error: {response.text}")
        
    assert response.status_code == 200
    data = response.json()
    print(f"Response Data: {data}")
    assert data["spender"] == "User A"
    
    # 4. Verify DB
    db.expire_all() # Ensure we fetch fresh data
    txn_refreshed = db.query(Transaction).filter(Transaction.id == txn.id).first()
    print(f"DB State: Spender={txn_refreshed.spender}")
    assert txn_refreshed.spender == "User A"
    
    db.close()
    
if __name__ == "__main__":
    try:
        test_update_spender()
        print("Test passed!")
    except Exception as e:
        print(f"Test Failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
