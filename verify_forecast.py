from backend.database import SessionLocal, engine
from backend import models
from backend.routers.analytics import get_cash_flow_forecast
from datetime import date, timedelta

def verify():
    db = SessionLocal()
    user = db.query(models.User).filter(models.User.email == "david@example.com").first()
    if not user:
        user = db.query(models.User).first()
        
    print(f"Testing with user: {user.email} (ID: {user.id})")
    
    # 1. Setup Mock Subscriptions
    # Clear existing tests
    db.query(models.Subscription).filter(models.Subscription.name.in_(["Test Salary", "Test Rent"])).delete(synchronize_session=False)
    
    salary = models.Subscription(
        user_id=user.id,
        name="Test Salary",
        amount=5000.0,
        type="Income",
        frequency="Monthly",
        next_due_date=date.today() + timedelta(days=5),
        is_active=True
    )
    
    rent = models.Subscription(
        user_id=user.id,
        name="Test Rent",
        amount=2000.0,
        type="Expense",
        frequency="Monthly",
        next_due_date=date.today() + timedelta(days=10),
        is_active=True
    )
    
    db.add(salary)
    db.add(rent)
    db.commit()
    
    print("Added Test Subscriptions.")
    
    # 2. Setup Mock Account Balance (Verify fix for AttributeError)
    accounts = db.query(models.Account).filter(models.Account.user_id == user.id).all()
    if not accounts:
        # Create a dummy account if none exist
        acc = models.Account(user_id=user.id, name="Test Bank", type="Asset", category="Cash", balance=5000.0)
        db.add(acc)
        db.commit()
        print("Created Test Account with $5000 balance.")
    else:
        for acc in accounts:
            acc.balance = 2000.0 # Set explicit balance
        db.commit()
        print(f"Updated {len(accounts)} accounts to have $2000 balance.")

    # 3. Run Forecast
    print("Running Forecast for 30 days...")
    try:
        # Mocking dependency injection by calling function directly requires args
        # But `current_user` is a dependency.
        # We can just call the logic or use a request context, but honestly,
        # calling the function with manual arguments is Python basic.
        # Wait, `get_cash_flow_forecast` expects `db` and `current_user` as args.
        
        result = get_cash_flow_forecast(
            days=30,
            include_discretionary=True,
            account_id=None,
            db=db,
            current_user=user
        )
        
        print("\n--- Forecast Result ---")
        print(f"Current Balance: ${result['current_balance']:.2f}")
        print(f"Daily Burn Rate: ${result['daily_burn_rate']:.2f}")
        print(f"Min Projected Balance: ${result['min_projected_balance']:.2f}")
        
        forecast = result['forecast']
        print(f"Forecast Points: {len(forecast)}")
        
        # Check specific dates for events
        salary_event_found = False
        rent_event_found = False
        
        for point in forecast:
            if point['events']:
                for e in point['events']:
                    print(f"Date {point['date']}: Event {e['name']} (${e['amount']})")
                    if e['name'] == "Test Salary": salary_event_found = True
                    if e['name'] == "Test Rent": rent_event_found = True
                    
        if salary_event_found and rent_event_found:
            print("SUCCESS: Both Salary and Rent events detected in projection.")
        else:
            print("FAILURE: Missing events.")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        db.query(models.Subscription).filter(models.Subscription.name.in_(["Test Salary", "Test Rent"])).delete(synchronize_session=False)
        db.commit()
        print("Cleanup done.")

if __name__ == "__main__":
    verify()
