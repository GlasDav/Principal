from backend.database import SessionLocal
from backend import models
import html

def fix_names():
    db = SessionLocal()
    buckets = db.query(models.BudgetBucket).filter(models.BudgetBucket.name.contains("&amp;")).all()
    
    count = 0
    for b in buckets:
        old_name = b.name
        new_name = html.unescape(b.name)
        if old_name != new_name:
            print(f"Renaming: '{old_name}' -> '{new_name}'")
            b.name = new_name
            count += 1
            
    if count > 0:
        db.commit()
        print(f"Successfully fixed {count} bucket names.")
    else:
        print("No encoded names found.")

if __name__ == "__main__":
    fix_names()
