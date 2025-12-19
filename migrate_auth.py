from sqlalchemy import create_engine, text
import os

DATABASE_URL = "sqlite:///./principal_v5.db"

def migrate():
    print(f"Connecting to {DATABASE_URL}...")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("Checking for hashed_password column...")
        try:
            # Check if column exists
            result = conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result]
            
            if "hashed_password" not in columns:
                print("Adding hashed_password column...")
                conn.execute(text("ALTER TABLE users ADD COLUMN hashed_password VARCHAR"))
                print("Column added successfully.")
            else:
                print("Column hashed_password already exists.")
                
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
