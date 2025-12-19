import requests
import json

BASE_URL = "http://localhost:8000"

def test_register():
    print("Testing Registration...")
    payload = {
        "email": "test_script@example.com",
        "password": "password123"
    }
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Request Failed: {e}")

if __name__ == "__main__":
    test_register()
