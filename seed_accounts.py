from backend.database import SessionLocal, engine
from backend.models import Account, Base

def seed_accounts():
    db = SessionLocal()
    
    defaults = [
        {"name": "Cash / Emergency Fund", "type": "Asset", "category": "Cash"},
        {"name": "Stock Date", "type": "Asset", "category": "Investment"},
        {"name": "Other Assets", "type": "Asset", "category": "Other"},
        {"name": "Mortgage", "type": "Liability", "category": "Loan"},
        {"name": "Credit Card", "type": "Liability", "category": "Credit Card"},
        {"name": "Car Loan", "type": "Liability", "category": "Loan"},
        {"name": "Other Liabilities", "type": "Liability", "category": "Other"},
    ]
    
    print("Seeding Accounts...")
    count = 0
    for acc in defaults:
        exists = db.query(Account).filter(Account.name == acc["name"]).first()
        if not exists:
            new_acc = Account(
                name=acc["name"],
                type=acc["type"],
                category=acc["category"]
            )
            db.add(new_acc)
            count += 1
            print(f"Added: {acc['name']}")
    
    db.commit()
    print(f"Done! Added {count} new accounts.")
    db.close()

if __name__ == "__main__":
    seed_accounts()
