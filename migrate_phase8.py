from sqlalchemy import create_engine, text
from backend.database import SQLALCHEMY_DATABASE_URL

def migrate():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    with engine.connect() as conn:
        print("Starting Phase 8 Migration...")
        
        # 1. Add is_rollover to BudgetBucket
        try:
            conn.execute(text("ALTER TABLE budget_buckets ADD COLUMN is_rollover BOOLEAN DEFAULT 0"))
            print("Added is_rollover to budget_buckets")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("Column is_rollover already exists.")
            else:
                print(f"Warning adding is_rollover: {e}")

        # 2. Add parent_transaction_id to Transactions
        try:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN parent_transaction_id INTEGER REFERENCES transactions(id)"))
            print("Added parent_transaction_id to transactions")
        except Exception as e:
             if "duplicate column" in str(e).lower():
                print("Column parent_transaction_id already exists.")
             else:
                print(f"Warning adding parent_transaction_id: {e}")

        # 3. Create CategorizationRule Table
        try:
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS categorization_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                bucket_id INTEGER,
                keywords VARCHAR,
                priority INTEGER DEFAULT 0,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(bucket_id) REFERENCES budget_buckets(id)
            )
            """))
            print("Created categorization_rules table")
        except Exception as e:
            print(f"Error creating table: {e}")
            
        conn.commit()
        print("Migration Complete.")

if __name__ == "__main__":
    migrate()
