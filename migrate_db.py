from backend.database import engine, Base
from backend import models
from sqlalchemy import inspect, text

def check_and_migrate():
    inspector = inspect(engine)
    
    # 1. Check if 'goals' table exists
    tables = inspector.get_table_names()
    if 'goals' not in tables:
        print("Creating 'goals' table...")
        models.Goal.__table__.create(engine)
    else:
        print("'goals' table exists.")

    # 2. Check if 'transactions' has 'goal_id'
    columns = [c['name'] for c in inspector.get_columns('transactions')]
    if 'goal_id' not in columns:
        print("Adding 'goal_id' to 'transactions' table...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN goal_id INTEGER REFERENCES goals(id)"))
            conn.commit()
    else:
        print("'goal_id' exists in 'transactions'.")

    # 3. Check if 'subscriptions' table exists (from previous task, just in case)
    if 'subscriptions' not in tables:
        print("Creating 'subscriptions' table...")
        models.Subscription.__table__.create(engine)
    else:
        print("'subscriptions' table exists.")

if __name__ == "__main__":
    check_and_migrate()
