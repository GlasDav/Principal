
import sqlite3
import os

DB_PATH = 'principal_v5.db'

def verify_registration():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # List last 3 users
    cursor.execute("SELECT id, email, name FROM users ORDER BY id DESC LIMIT 3")
    users = cursor.fetchall()
    
    print("\n--- Last 3 Users ---")
    for u in users:
        uid, email, name = u
        print(f"ID={uid}, Email={email}, Name={name}")
        
        # Check buckets
        cursor.execute("SELECT count(*) FROM budget_buckets WHERE user_id = ?", (uid,))
        buckets = cursor.fetchone()[0]
        
        # Check household members
        cursor.execute("SELECT count(*) FROM household_members WHERE user_id = ?", (uid,))
        members = cursor.fetchone()[0]
        
        print(f"  Buckets: {buckets}, Members: {members}")
    
    conn.close()

if __name__ == "__main__":
    verify_registration()
