from backend.database import SessionLocal
from backend import models

def check_encoding():
    db = SessionLocal()
    buckets = db.query(models.BudgetBucket).filter(models.BudgetBucket.name.contains("&amp;")).all()
    
    if buckets:
        print(f"FOUND {len(buckets)} buckets with '&amp;':")
        for b in buckets:
            print(f"- {b.name} (ID: {b.id})")
    else:
        print("No buckets found with '&amp;' in the name.")

if __name__ == "__main__":
    check_encoding()
