from backend.database import SessionLocal
from backend.models import Tag, CategorizationRule, BudgetBucket, bucket_tags, User
from sqlalchemy import func

def check_classification_data():
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            print("No user found.")
            return

        print(f"Checking rules for User: {user.email} (ID: {user.id})")

        # 1. Check Tags (Legacy)
        try:
            tag_count = db.query(Tag).count()
            print(f"Total Tags in DB: {tag_count}", flush=True)
            
            # Check association
            buckets_with_tags = db.query(BudgetBucket).join(BudgetBucket.tags).count()
            print(f"Buckets having tags: {buckets_with_tags}", flush=True)

            # List some tags
            tags = db.query(Tag).limit(5).all()
            for t in tags:
                print(f" - Tag: {t.name}", flush=True)
        except Exception as e:
            print(f"Error checking tags: {e}", flush=True)

        # 2. Check Smart Rules
        try:
            rule_count = db.query(CategorizationRule).filter(CategorizationRule.user_id == user.id).count()
            print(f"Total Smart Rules for user: {rule_count}", flush=True)
            
            rules = db.query(CategorizationRule).filter(CategorizationRule.user_id == user.id).limit(5).all()
            for r in rules:
                print(f" - Rule: '{r.keywords}' -> Bucket ID {r.bucket_id}", flush=True)
        except Exception as e:
            print(f"Error checking rules: {e}", flush=True)

    finally:
        db.close()

if __name__ == "__main__":
    check_classification_data()
