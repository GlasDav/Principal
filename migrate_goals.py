from sqlalchemy import create_engine, text
from backend.database import SQLALCHEMY_DATABASE_URL

def migrate():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    with engine.connect() as conn:
        print("Starting Goals Migration...")
        
        # 1. Add target_amount to BudgetBucket
        try:
            conn.execute(text("ALTER TABLE budget_buckets ADD COLUMN target_amount FLOAT"))
            print("Added target_amount to budget_buckets")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("Column target_amount already exists.")
            else:
                print(f"Warning adding target_amount: {e}")

        # 2. Add target_date to BudgetBucket
        try:
            conn.execute(text("ALTER TABLE budget_buckets ADD COLUMN target_date DATE"))
            print("Added target_date to budget_buckets")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("Column target_date already exists.")
            else:
                print(f"Warning adding target_date: {e}")
            
        conn.commit()
        print("Migration Complete.")

if __name__ == "__main__":
    migrate()
