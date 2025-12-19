import requests

try:
    print("Checking API...")
    res = requests.get("http://localhost:8000/net-worth/accounts")
    print(f"Status: {res.status_code}")
    if res.status_code == 200:
        print(f"Data: {res.json()}")
    else:
        print(f"Error: {res.text}")
except Exception as e:
    print(f"Failed to connect: {e}")
