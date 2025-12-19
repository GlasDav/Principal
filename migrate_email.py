from sqlalchemy import create_engine, text
import os

DATABASE_URL = "sqlite:///./principal_v5.db"

def migrate():
    print(f"Connecting to {DATABASE_URL}...")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("Migrating username to email...")
        try:
            # Check columns
            result = conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result]
            
            if "username" in columns and "email" not in columns:
                print("Renaming username column to email...")
                # SQLite doesn't support RENAME COLUMN in older versions, but usually does in modern ones.
                # If not, we have to recreate table. Let's try RENAME first.
                try:
                    conn.execute(text("ALTER TABLE users RENAME COLUMN username TO email"))
                    print("Renamed successfully.")
                except Exception as e:
                    print(f"Rename failed ({e}), trying add/copy/drop...")
                    # Manual migration if rename fails (SQLite < 3.25)
                    conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR"))
                    conn.execute(text("UPDATE users SET email = username"))
                    # We can't easily drop column in SQLite without recreating table. 
                    # We'll validly assume modern SQLite for this environment or just ignore the old column.
                    # Strict rename is best.
            
            elif "email" in columns:
                print("Column 'email' already exists.")
                
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
