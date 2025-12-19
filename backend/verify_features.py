from fastapi.testclient import TestClient
from backend.main import app
# from backend.routers import investments # Not strictly needed unless I need to access router directly
import sys

# Add current directory to path if needed (though usually fine within same dir)
# sys.path.append(".")

client = TestClient(app)

def test_investment_history():
    print("\nTesting GET /investments/history ...")
    response = client.get("/investments/history")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success! Returned {len(data)} history records.")
        if data:
            print(f"   Sample: {data[0]}")
    else:
        print(f"❌ Failed: {response.status_code} - {response.text}")

def test_subscriptions():
    print("\nTesting GET /analytics/subscriptions ...")
    response = client.get("/analytics/subscriptions")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success! Returned {len(data)} subscriptions.")
    else:
        print(f"❌ Failed: {response.status_code} - {response.text}")

def test_calendar():
    print("\nTesting GET /analytics/calendar ...")
    # Need dates
    response = client.get("/analytics/calendar?start_date=2024-01-01&end_date=2024-01-31")
    if response.status_code == 200:
         print("✅ Success! Calendar data fetched.")
    else:
         print(f"❌ Failed: {response.status_code} - {response.text}")

if __name__ == "__main__":
    test_investment_history()
    test_subscriptions()
    test_calendar()
