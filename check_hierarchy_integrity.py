
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models

def check_integrity():
    db: Session = SessionLocal()
    try:
        buckets = db.query(models.BudgetBucket).all()
        bucket_map = {b.id: b for b in buckets}
        
        issues = []
        
        for b in buckets:
            if b.parent_id:
                parent = bucket_map.get(b.parent_id)
                if not parent:
                    issues.append(f"ORPHAN: {b.name} (ID:{b.id}) has missing parent {b.parent_id}")
                elif b.group != parent.group:
                    issues.append(f"MISMATCH: {b.name} (ID:{b.id}, G:{b.group}) != Parent {parent.name} (ID:{parent.id}, G:{parent.group})")
        
        if issues:
            print(f"Found {len(issues)} issues:")
            for i in issues:
                print(i)
        else:
            print("No hierarchy text integrity issues found.")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_integrity()
