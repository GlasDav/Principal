import sys
sys.path.append('.')

from backend.database import SessionLocal
from backend import models

db = SessionLocal()

# Check for buckets with &amp; in the name
buckets_with_amp = db.query(models.BudgetBucket).filter(
    models.BudgetBucket.name.like('%&amp;%')
).all()

print(f"Buckets with '&amp;': {len(buckets_with_amp)}")
for bucket in buckets_with_amp:
    print(f"  - {bucket.name}")

# Check for buckets with & in the name
buckets_with_ampersand = db.query(models.BudgetBucket).filter(
    models.BudgetBucket.name.like('%&%')
).all()

print(f"\nBuckets with '&': {len(buckets_with_ampersand)}")
for bucket in buckets_with_ampersand:
    print(f"  - {bucket.name}")

db.close()
