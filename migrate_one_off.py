"""
Add is_one_off column to budget_buckets table.
Run this script to add the new column for excluding one-off expenses from forecasting.
"""
import sqlite3
import os

def migrate():
    # Find database file
    db_paths = [
        "principal_v5.db",
        "principal.db",
        "../principal_v5.db"
    ]
    
    db_path = None
    for path in db_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print("Database not found. Skipping migration.")
        return
    
    print(f"Migrating database: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if column already exists
    cursor.execute("PRAGMA table_info(budget_buckets)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if "is_one_off" in columns:
        print("Column 'is_one_off' already exists. Skipping.")
        conn.close()
        return
    
    # Add the new column
    cursor.execute("ALTER TABLE budget_buckets ADD COLUMN is_one_off BOOLEAN DEFAULT 0")
    conn.commit()
    
    print("Added 'is_one_off' column to budget_buckets table.")
    
    # Optionally create the "One Off" bucket for existing users
    cursor.execute("SELECT DISTINCT user_id FROM budget_buckets")
    user_ids = [row[0] for row in cursor.fetchall()]
    
    for user_id in user_ids:
        # Check if One Off bucket already exists
        cursor.execute(
            "SELECT id FROM budget_buckets WHERE user_id = ? AND name = 'One Off'",
            (user_id,)
        )
        if cursor.fetchone():
            continue
        
        # Get max display_order
        cursor.execute(
            "SELECT MAX(display_order) FROM budget_buckets WHERE user_id = ?",
            (user_id,)
        )
        max_order = cursor.fetchone()[0] or 0
        
        # Insert One Off bucket
        cursor.execute(
            """INSERT INTO budget_buckets 
               (user_id, name, icon_name, "group", is_one_off, display_order, is_transfer, is_investment, is_rollover, is_hidden)
               VALUES (?, 'One Off', 'Zap', 'Non-Discretionary', 1, ?, 0, 0, 0, 0)""",
            (user_id, max_order + 1)
        )
        print(f"Created 'One Off' bucket for user {user_id}")
    
    conn.commit()
    conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
