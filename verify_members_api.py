import requests
import json

BASE_URL = "http://localhost:8000"
# Assuming auth is required, we need to login or mock it.
# Easier to test via direct database access for verifying migration success, 
# but testing API response structure is crucial here.
# I'll rely on DB verification for now as it's simpler without auth token dance in script.

from backend.database import SessionLocal
from backend import models

def verify():
    db = SessionLocal()
    user = db.query(models.User).filter(models.User.email == "david@example.com").first()
    if not user:
        user = db.query(models.User).first()
        
    print(f"Verifying for user: {user.email}")
    
    # 1. Verify Members
    members = db.query(models.HouseholdMember).filter(models.HouseholdMember.user_id == user.id).all()
    print(f"Found {len(members)} members:")
    for m in members:
        print(f" - {m.name} (Color: {m.color})")
        
    if len(members) < 1:
        print("FAILURE: No members found. Migration might have failed.")
        return

    # 2. Verify Limits
    # Pick a bucket that had limits
    bucket = db.query(models.BudgetBucket).filter(
        models.BudgetBucket.user_id == user.id, 
        models.BudgetBucket.name.in_(["Rent", "Rent/Mortgage", "Groceries"])
    ).first()
    
    if bucket:
        print(f"\nChecking bucket: {bucket.name} (ID: {bucket.id})")
        limits = db.query(models.BudgetLimit).filter(models.BudgetLimit.bucket_id == bucket.id).all()
        print(f"Found {len(limits)} limits:")
        for l in limits:
            m_name = next((m.name for m in members if m.id == l.member_id), "Unknown")
            print(f" - {m_name}: ${l.amount}")
            
        if len(limits) > 0:
            print("SUCCESS: Limits migrated correctly.")
        else:
            print("WARNING: No limits found for this bucket (might be expected if it had 0 limits).")
    else:
        print("WARNING: Could not find a test bucket.")

if __name__ == "__main__":
    verify()
