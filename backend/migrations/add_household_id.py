"""Add household_id column to users table."""
from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Add household_id column to users table
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN household_id INTEGER"))
        conn.commit()
        print("Added household_id column to users table")
    except Exception as e:
        if "duplicate column" in str(e).lower():
            print("Column already exists")
        else:
            raise e

print("Migration complete!")
