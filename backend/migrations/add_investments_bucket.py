import sys
import os
import time
# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from backend import models

# Create a new engine with timeout
engine = create_engine("sqlite:///principal_v5.db", connect_args={"timeout": 30})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

db = SessionLocal()
users = db.query(models.User).all()
print(f"Found {len(users)} users")
for user in users:
    try:
        existing = db.query(models.BudgetBucket).filter(models.BudgetBucket.user_id == user.id, models.BudgetBucket.name == "Investments").first()
        if existing:
            existing.is_investment = True
            print(f"  Marked existing for {user.email}")
        else:
            b = models.BudgetBucket(user_id=user.id, name="Investments", icon_name="TrendingUp", group="Non-Discretionary", is_investment=True, monthly_limit_a=0.0, monthly_limit_b=0.0)
            db.add(b)
            print(f"  Created for {user.email}")
        db.commit()
    except Exception as e:
        print(f"  Error for {user.email}: {e}")
        db.rollback()
db.close()
print("Done!")
