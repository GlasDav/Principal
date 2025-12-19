from sqlalchemy import create_engine, text
from backend.database import SQLALCHEMY_DATABASE_URL

def migrate():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    with engine.connect() as conn:
        print("Starting Goals V2 Migration...")
        
        # 1. Add target_balance to Accounts
        try:
            conn.execute(text("ALTER TABLE accounts ADD COLUMN target_balance FLOAT"))
            print("Added target_balance to accounts")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("Column target_balance already exists.")
            else:
                print(f"Warning adding target_balance: {e}")

        # 2. Add target_date to Accounts
        try:
            conn.execute(text("ALTER TABLE accounts ADD COLUMN target_date DATE"))
            print("Added target_date to accounts")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("Column target_date already exists.")
            else:
                print(f"Warning adding target_date: {e}")
            
        conn.commit()
        print("Migration Complete.")

if __name__ == "__main__":
    migrate()
