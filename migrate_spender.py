from backend.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN spender VARCHAR DEFAULT 'Joint'"))
            conn.commit()
            print("Migration successful: Added 'spender' column.")
        except Exception as e:
            print(f"Migration failed (maybe column exists?): {e}")

if __name__ == "__main__":
    migrate()
