from backend.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE budget_buckets ADD COLUMN 'group' VARCHAR DEFAULT 'Discretionary'"))
            conn.commit()
            print("Migration successful: Added 'group' column.")
        except Exception as e:
            print(f"Migration failed (maybe column exists?): {e}")

if __name__ == "__main__":
    migrate()
