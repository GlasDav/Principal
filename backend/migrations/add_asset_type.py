import sqlite3
import os

# Database path
DB_PATH = "principal_v5.db"

def migrate():
    print(f"Migrating {DB_PATH}...")
    
    if not os.path.exists(DB_PATH):
        print("Database not found!")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Check existing columns in investment_holdings
    print("\nChecking investment_holdings columns...")
    cursor.execute("PRAGMA table_info(investment_holdings)")
    columns = [row[1] for row in cursor.fetchall()]
    
    # 2. Add asset_type if missing
    if 'asset_type' not in columns:
        print("  Adding asset_type column...")
        # Default to 'Stock' for existing records
        cursor.execute("ALTER TABLE investment_holdings ADD COLUMN asset_type VARCHAR DEFAULT 'Stock'")
        print("  [OK] Added asset_type")
    else:
        print("  [SKIP] asset_type already exists")

    # 3. Add sector if missing
    if 'sector' not in columns:
        print("  Adding sector column...")
        cursor.execute("ALTER TABLE investment_holdings ADD COLUMN sector VARCHAR NULL")
        print("  [OK] Added sector")
    else:
        print("  [SKIP] sector already exists")

    conn.commit()
    conn.close()
    print("\nMigration complete!")

if __name__ == "__main__":
    migrate()
