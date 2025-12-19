from sqlalchemy import create_engine, text
import os

DATABASE_URL = "sqlite:///./principal_v5.db"

def migrate():
    print(f"Connecting to {DATABASE_URL}...")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("Checking for user_id columns in accounts/snapshots...")
        try:
            # Accounts
            result = conn.execute(text("PRAGMA table_info(accounts)"))
            columns = [row[1] for row in result]
            if "user_id" not in columns:
                print("Adding user_id to accounts...")
                conn.execute(text("ALTER TABLE accounts ADD COLUMN user_id INTEGER REFERENCES users(id)"))
                # Default existing to user 1
                conn.execute(text("UPDATE accounts SET user_id = 1 WHERE user_id IS NULL"))
                print("Accounts updated.")
            else:
                print("accounts.user_id exists.")
                
            # Snapshots
            result = conn.execute(text("PRAGMA table_info(net_worth_snapshots)"))
            columns = [row[1] for row in result]
            if "user_id" not in columns:
                print("Adding user_id to net_worth_snapshots...")
                conn.execute(text("ALTER TABLE net_worth_snapshots ADD COLUMN user_id INTEGER REFERENCES users(id)"))
                # Default existing to user 1
                conn.execute(text("UPDATE net_worth_snapshots SET user_id = 1 WHERE user_id IS NULL"))
                print("Snapshots updated.")
            else:
                print("net_worth_snapshots.user_id exists.")
                
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
