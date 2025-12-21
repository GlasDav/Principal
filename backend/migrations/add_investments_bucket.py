import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.database import SessionLocal
from backend import models
db = SessionLocal()
users = db.query(models.User).all()
print(f"Found {len(users)} users")
for user in users:
    existing = db.query(models.BudgetBucket).filter(models.BudgetBucket.user_id == user.id, models.BudgetBucket.name == "Investments").first()
    if existing:
        existing.is_investment = True
        print(f"  Marked existing for {user.email}")
    else:
        b = models.BudgetBucket(user_id=user.id, name="Investments", icon_name="TrendingUp", group="Non-Discretionary", is_investment=True, monthly_limit_a=0.0, monthly_limit_b=0.0)
        db.add(b)
        print(f"  Created for {user.email}")
db.commit()
db.close()
print("Done!")
