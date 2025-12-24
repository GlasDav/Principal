from backend.database import SessionLocal
from backend import models
from backend.routers.analytics import get_suggested_subscriptions

def verify():
    db = SessionLocal()
    # Mock user object
    user = db.query(models.User).filter(models.User.email == "david@example.com").first()
    if not user:
        user = db.query(models.User).first()
        
    print(f"Testing with user: {user.email}")
    
    # Call the function
    suggestions = get_suggested_subscriptions(exclude_existing=False, db=db, current_user=user)
    
    print(f"Found {len(suggestions)} suggestions.")
    
    income_found = False
    for s in suggestions:
        print(f"- {s['name']}: {s['amount']} ({s['type']})")
        if s['type'] == 'Income' and 'Salary' in s['name']:
            income_found = True
            
    if income_found:
        print("SUCCESS: Salary detected as Income!")
    else:
        print("FAILURE: Salary not found or incorrect type.")

if __name__ == "__main__":
    verify()
