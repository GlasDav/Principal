from backend.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        try:
            # Check if column exists first (SQLite specific check)
            result = conn.execute(text("PRAGMA table_info(subscriptions)")).fetchall()
            columns = [r[1] for r in result]
            
            if 'type' not in columns:
                print("Adding 'type' column to subscriptions table...")
                conn.execute(text("ALTER TABLE subscriptions ADD COLUMN type VARCHAR DEFAULT 'Expense'"))
                conn.commit()
                print("Migration successful.")
            else:
                print("Column 'type' already exists.")
                
        except Exception as e:
            print(f"Error migrating: {e}")

if __name__ == "__main__":
    migrate()
