
import sqlite3
import os

DB_PATH = 'principal_v5.db'

def fix_schema():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if 'name' exists
    cursor.execute("PRAGMA table_info(users)")
    cols = [c[1] for c in cursor.fetchall()]
    
    if 'name' not in cols:
        print("Adding 'name' column...")
        cursor.execute("ALTER TABLE users ADD COLUMN name TEXT")
        
        # Migrate name_a to name if name_a exists
        if 'name_a' in cols:
            print("Migrating name_a to name...")
            cursor.execute("UPDATE users SET name = name_a WHERE name_a IS NOT NULL")
            # If name_a is "You" or default, maybe just use it.
            # Also populate empty names
            cursor.execute("UPDATE users SET name = 'User' WHERE name IS NULL")
    else:
        print("'name' column already exists.")

    conn.commit()
    conn.close()
    print("Schema fix complete.")

if __name__ == "__main__":
    fix_schema()
