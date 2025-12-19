from backend.database import engine, SessionLocal
from backend import models
from sqlalchemy import text, extract

def check():
    db = SessionLocal()
    try:
        # 1. Check Schema
        print("--- Schema Check ---")
        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(transactions)"))
            columns = [row.name for row in result]
            print(f"Columns: {columns}")
            if "spender" in columns:
                print("SUCCESS: 'spender' column exists.")
            else:
                print("FAILURE: 'spender' column MISSING.")

        # 2. Test Query
        print("\n--- Query Check ---")
        # Try fetching one
        txn = db.query(models.Transaction).first()
        print(f"First Txn Spender: {getattr(txn, 'spender', 'AttributeMissing')}")
        
        # Try Filter
        count = db.query(models.Transaction).filter(models.Transaction.spender == "Joint").count()
        print(f"Joint Count: {count}")
        
        # Try Date Extract
        print("\n--- Extract Check ---")
        count_month = db.query(models.Transaction).filter(extract('month', models.Transaction.date) == 12).count()
        print(f"Month 12 Count: {count_month}")

    except Exception as e:
        print(f"\nCRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check()
