from backend.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        try:
            # Check if column exists
            result = conn.execute(text("PRAGMA table_info(accounts)")).fetchall()
            columns = [r[1] for r in result]
            
            if 'balance' not in columns:
                print("Adding 'balance' column to accounts table...")
                conn.execute(text("ALTER TABLE accounts ADD COLUMN balance FLOAT DEFAULT 0.0"))
                conn.commit()
                print("Migration successful.")
            else:
                print("Column 'balance' already exists.")
                
        except Exception as e:
            print(f"Error migrating: {e}")

if __name__ == "__main__":
    migrate()
