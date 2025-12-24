
import requests
import json
import sys
import os

# Add project root to path for imports if needed, but we use requests mostly.
BASE_URL = "http://localhost:8000"

# Mock data
TEST_BUCKET_NAME = "API_TEST_BUCKET"

def run_test():
    # 1. We need a user. We'll use the one from the DB (verify_members_api.py approach) or better, mock a login?
    # Since I don't have login easily scriptable without credentials, I'll assume I can just use the DB to check, 
    # OR I'll rely on the fact that I can't easily hit protected endpoints without a token.
    # But I can use backend/database.py to create data directly and test schema/model constraints.
    
    # Actually, testing the API endpoints is better.
    # I'll try to login mostly. I know 'david@example.com'. 
    # If I can't, I will use `backend.main`'s app with `TestClient` which overrides dependencies?
    # That's complicated to set up in a script.
    
    # Alternative: I'll use the `verify_members_api.py` approach of DB manipulation to simulate what the API does 
    # (using the `process_limits` function) to ensure that logic is sound.
    
    from backend.database import SessionLocal
    from backend import models, schemas
    from backend.routers.settings import process_limits
    
    db = SessionLocal()
    user = db.query(models.User).first()
    if not user:
        print("No user found.")
        return

    print(f"Testing for user: {user.email} (ID: {user.id})")
    
    # 2. Get Members
    members = db.query(models.HouseholdMember).filter(models.HouseholdMember.user_id == user.id).all()
    if not members:
        print("Creating a member...")
        m1 = models.HouseholdMember(user_id=user.id, name="Test Member A", color="#ff0000")
        db.add(m1)
        db.commit()
        db.refresh(m1)
        members = [m1]
    
    member = members[0]
    print(f"Using member: {member.name} (ID: {member.id})")
    
    # 3. Create Bucket
    bucket = models.BudgetBucket(
        user_id=user.id, 
        name=TEST_BUCKET_NAME, 
        group="Discretionary"
    )
    db.add(bucket)
    db.commit()
    db.refresh(bucket)
    print(f"Created bucket: {bucket.name} (ID: {bucket.id})")
    
    # 4. Process Limits (Simulate API call)
    # Payload would be like: limits=[{member_id: X, amount: 100}]
    limit_payload = schemas.BudgetLimitBase(member_id=member.id, amount=150.0)
    
    print("Applying limits...")
    try:
        process_limits(db, bucket, [limit_payload])
        db.commit()
        print("Limits processed successfully.")
    except Exception as e:
        print(f"FAILED to process limits: {e}")
        db.rollback()
        return

    # 5. Verify Limits in DB
    db.refresh(bucket)
    if len(bucket.limits) == 1:
        l = bucket.limits[0]
        if l.member_id == member.id and l.amount == 150.0:
            print("SUCCESS: Limit saved correctly via process_limits.")
        else:
            print(f"FAILURE: Limit data mismatch. Got {l.member_id}: {l.amount}")
    else:
        print(f"FAILURE: Expected 1 limit, found {len(bucket.limits)}")

    # Cleanup
    db.delete(bucket) 
    # Don't delete member as it might be used by other tests/existing data
    db.commit()
    print("Cleanup done.")

if __name__ == "__main__":
    run_test()
