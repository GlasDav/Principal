from backend.database import SessionLocal, engine
from backend import models

def migrate():
    # Create tables if they don't exist
    models.Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    users = db.query(models.User).all()
    
    print(f"Migrating {len(users)} users...")
    
    for user in users:
        print(f"Processing user: {user.email}")
        
        # 1. Create Member A (The Main User)
        member_a = db.query(models.HouseholdMember).filter(
            models.HouseholdMember.user_id == user.id,
            models.HouseholdMember.name == user.name_a
        ).first()
        
        if not member_a:
            member_a = models.HouseholdMember(
                user_id=user.id,
                name=user.name_a,
                color="#6366f1", # Indigo
                avatar="User"
            )
            db.add(member_a)
            db.flush() # Get ID
            print(f"  - Created Member: {user.name_a}")
        else:
            print(f"  - Member exists: {user.name_a}")

        # 2. Create Member B (If Couple Mode)
        member_b = None
        if user.is_couple_mode:
            member_b = db.query(models.HouseholdMember).filter(
                models.HouseholdMember.user_id == user.id,
                models.HouseholdMember.name == user.name_b
            ).first()
            
            if not member_b:
                member_b = models.HouseholdMember(
                    user_id=user.id,
                    name=user.name_b,
                    color="#ec4899", # Pink
                    avatar="User"
                )
                db.add(member_b)
                db.flush()
                print(f"  - Created Member: {user.name_b}")
            else:
                 print(f"  - Member exists: {user.name_b}")

        # 3. Migrate Limits
        buckets = db.query(models.BudgetBucket).filter(models.BudgetBucket.user_id == user.id).all()
        for bucket in buckets:
            # Limit A
            if bucket.monthly_limit_a > 0:
                limit_a = db.query(models.BudgetLimit).filter(
                    models.BudgetLimit.bucket_id == bucket.id,
                    models.BudgetLimit.member_id == member_a.id
                ).first()
                if not limit_a:
                    db.add(models.BudgetLimit(
                        bucket_id=bucket.id,
                        member_id=member_a.id,
                        amount=bucket.monthly_limit_a
                    ))
            
            # Limit B
            if member_b and bucket.monthly_limit_b > 0:
                limit_b = db.query(models.BudgetLimit).filter(
                    models.BudgetLimit.bucket_id == bucket.id,
                    models.BudgetLimit.member_id == member_b.id
                ).first()
                if not limit_b:
                    db.add(models.BudgetLimit(
                        bucket_id=bucket.id,
                        member_id=member_b.id,
                        amount=bucket.monthly_limit_b
                    ))
        
        print(f"  - Migrated limits for {len(buckets)} buckets.")
        
    db.commit()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
