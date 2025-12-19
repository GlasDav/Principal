from backend.database import SessionLocal
from backend.models import BudgetBucket
from sqlalchemy.orm import joinedload
from sqlalchemy import text

def test():
    print("Start", flush=True)
    db = SessionLocal()
    try:
        # Raw SQL check first
        print("Checking association table raw...", flush=True)
        res = db.execute(text("SELECT count(*) FROM bucket_tags")).scalar()
        print(f"Rows in bucket_tags: {res}", flush=True)

        # ORM Check
        print("Checking ORM...", flush=True)
        buckets = db.query(BudgetBucket).options(joinedload(BudgetBucket.tags)).limit(5).all()
        print(f"Fetched {len(buckets)} buckets", flush=True)
        for b in buckets:
            print(f"Bucket {b.name} has {len(b.tags)} tags", flush=True)
            
    except Exception as e:
        print(f"Error: {e}", flush=True)
    finally:
        db.close()
        print("End", flush=True)

if __name__ == "__main__":
    test()
