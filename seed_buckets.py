from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine
from backend import models

def seed_buckets():
    db: Session = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == 1).first()
        if not user:
            print("User ID 1 not found. Creating...")
            user = models.User(username="Owner", id=1)
            db.add(user)
            db.commit()
            db.refresh(user)
            
        # Default Buckets and Tags (Migrated from categorizer.py)
        # Default Buckets and Tags (Migrated from categorizer.py)
        defaults = [
            {"name": "Rent/Mortgage", "icon": "Home", "limit": 1500, "group": "Non-Discretionary", "tags": ["rent", "mortgage", "strata"]},
            {"name": "Groceries", "icon": "Utensils", "limit": 800, "group": "Non-Discretionary", "tags": ["woolworths", "coles", "aldi", "harris farm", "iga"]},
            {"name": "Utilities", "icon": "Zap", "limit": 200, "group": "Non-Discretionary", "tags": ["electricity", "water", "gas", "internet", "telstra"]},
            {"name": "Transport", "icon": "Car", "limit": 150, "group": "Non-Discretionary", "tags": ["uber", "opal", "fuel", "bp", "shell"]},
            {"name": "Health", "icon": "Heart", "limit": 150, "group": "Non-Discretionary", "tags": ["chemist", "doctor", "dentist", "gym"]},
            {"name": "Dining Out", "icon": "Coffee", "limit": 300, "group": "Discretionary", "tags": ["restaurant", "cafe", "bar", "mcdonalds", "kfc"]},
            {"name": "Entertainment", "icon": "Film", "limit": 100, "group": "Discretionary", "tags": ["netflix", "spotify", "cinema", "ticketek"]},
            {"name": "Shopping", "icon": "ShoppingBag", "limit": 400, "group": "Discretionary", "tags": ["amazon", "kmart", "target", "myer", "uniqlo"]},
            {"name": "Travel", "icon": "Plane", "limit": 0, "group": "Discretionary", "tags": ["flight", "hotel", "airbnb", "booking.com"]}
        ]
        
        for b in defaults:
            # 1. Ensure Bucket Exists
            bucket = db.query(models.BudgetBucket).filter(
                models.BudgetBucket.user_id == user.id,
                models.BudgetBucket.name == b["name"]
            ).first()
            
            if not bucket:
                print(f"Creating bucket: {b['name']}")
                bucket = models.BudgetBucket(
                    user_id=user.id,
                    name=b["name"],
                    monthly_limit_a=b["limit"],
                    icon_name=b["icon"],
                    is_shared=True,
                    monthly_limit_b=0,
                    group=b.get("group", "Discretionary")
                )
                db.add(bucket)
                db.commit() # Commit to get ID for relationships
                db.refresh(bucket)
            else:
                print(f"Bucket {b['name']} exists. Updating group.")
                bucket.group = b.get("group", "Discretionary")
                bucket.icon_name = b.get("icon", "Wallet")
                db.commit()
                
            # 2. Process Tags
            existing_tags = [t.name for t in bucket.tags]
            for tag_name in b["tags"]:
                if tag_name not in existing_tags:
                    # Check if Tag object exists globally
                    db_tag = db.query(models.Tag).filter(models.Tag.name == tag_name).first()
                    if not db_tag:
                         print(f"  Creating Tag: {tag_name}")
                         db_tag = models.Tag(name=tag_name)
                         db.add(db_tag)
                         db.commit()
                         db.refresh(db_tag)
                    
                    if db_tag not in bucket.tags:
                         print(f"  Linking Tag '{tag_name}' to Bucket '{b['name']}'")
                         bucket.tags.append(db_tag)
            
            db.commit()

        print("Seeding complete.")
        
    finally:
        db.close()

if __name__ == "__main__":
    seed_buckets()
