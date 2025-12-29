"""
Fix invalid currency codes in database.

Changes 'A$' to 'AUD' for all users with invalid currency symbols.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import User

def main():
    db = SessionLocal()
    try:
        # Find users with invalid currency codes
        users = db.query(User).filter(User.currency_symbol == 'A$').all()
        
        print(f"Found {len(users)} users with currency_symbol='A$'")
        
        for user in users:
            print(f"  Updating user {user.id} ({user.email}): 'A$' -> 'AUD'")
            user.currency_symbol = 'AUD'
        
        db.commit()
        print(f"✅ Successfully updated {len(users)} users")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
