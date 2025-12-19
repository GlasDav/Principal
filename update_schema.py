import sqlite3

def migrate():
    db_path = 'principal_v5.db'
    print(f"Connecting to {db_path}...")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 1. Add connection_id to accounts
        try:
            cursor.execute("ALTER TABLE accounts ADD COLUMN connection_id VARCHAR")
            print("Added connection_id to accounts")
        except Exception as e:
            print(f"Skipping accounts (connection_id): {e}")
            
        # 2. Add external_id to transactions
        try:
            cursor.execute("ALTER TABLE transactions ADD COLUMN external_id VARCHAR")
            print("Added external_id to transactions")
        except Exception as e:
            print(f"Skipping transactions (external_id): {e}")

        # 3. Add account_id to transactions
        try:
            cursor.execute("ALTER TABLE transactions ADD COLUMN account_id INTEGER REFERENCES accounts(id)")
            print("Added account_id to transactions")
        except Exception as e:
            print(f"Skipping transactions (account_id): {e}")

        conn.commit()
        conn.close()
        print("Migration complete.")
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
