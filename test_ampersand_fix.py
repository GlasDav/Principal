import sys
sys.path.append('.')

from backend.database import SessionLocal
from backend import models
from backend.schemas import BudgetBucket
from pydantic import TypeAdapter

db = SessionLocal()

# Get a bucket with an ampersand
bucket = db.query(models.BudgetBucket).filter(
    models.BudgetBucket.name.like('%&%')
).first()

if bucket:
    print(f"Database value: {bucket.name}")
    
    # Serialize using Pydantic schema (simulating API response)
    adapter = TypeAdapter(BudgetBucket)
    bucket_dict = adapter.dump_python(bucket, mode='json')
    
    print(f"API response value: {bucket_dict['name']}")
    
    if bucket.name == bucket_dict['name']:
        print("\n✅ SUCCESS! Ampersands are displayed correctly")
        print(f"   Both show: '{bucket.name}'")
    else:
        print("\n❌ STILL BROKEN:")
        print(f"   Database: '{bucket.name}'")
        print(f"   API: '{bucket_dict['name']}'")
else:
    print("No buckets with & found")

db.close()
