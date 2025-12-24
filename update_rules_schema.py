
import sqlite3

DB_PATH = "principal_v5.db"

def migrate():
    print(f"Connecting to {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Adding apply_tags column...")
        cursor.execute("ALTER TABLE categorization_rules ADD COLUMN apply_tags VARCHAR")
    except Exception as e:
        print(f"Error adding apply_tags (might already exist): {e}")

    try:
        print("Adding mark_for_review column...")
        cursor.execute("ALTER TABLE categorization_rules ADD COLUMN mark_for_review BOOLEAN DEFAULT 0")
    except Exception as e:
        print(f"Error adding mark_for_review (might already exist): {e}")

    try:
        print("Adding tags column to transactions...")
        cursor.execute("ALTER TABLE transactions ADD COLUMN tags VARCHAR")
    except Exception as e:
        print(f"Error adding tags to transactions (might already exist): {e}")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
