import sqlite3
import os

DB_PATH = "principal_v5.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(subscriptions)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "bucket_id" in columns:
            print("Column 'bucket_id' already exists in 'subscriptions' table.")
        else:
            print("Adding 'bucket_id' column to 'subscriptions' table...")
            cursor.execute("ALTER TABLE subscriptions ADD COLUMN bucket_id INTEGER")
            print("Column added successfully.")
            
        conn.commit()
        print("Migration complete.")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
