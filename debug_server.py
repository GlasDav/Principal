from fastapi.testclient import TestClient
from backend.main import app
import traceback

def debug():
    client = TestClient(app)
    try:
        print("Sending request to /analytics/dashboard...")
        response = client.get("/analytics/dashboard?start_date=2024-01-01&end_date=2024-12-31&spender=User A")
        print(f"Status: {response.status_code}")
        if response.status_code != 200:
            print("Response:", response.text)
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    debug()
