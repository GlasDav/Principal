from backend.database import SessionLocal
from backend.models import Account

def debug_accounts():
    db = SessionLocal()
    accounts = db.query(Account).all()
    print(f"Total Accounts in DB: {len(accounts)}")
    for acc in accounts:
        print(f"ID: {acc.id}, Name: {acc.name}, Type: {acc.type}, Active: {acc.is_active}")
    db.close()

if __name__ == "__main__":
    debug_accounts()
