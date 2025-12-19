import requests

url = "http://localhost:8000/transactions/"

try:
    print("Testing /transactions/...")
    response = requests.get(url)
    
    if response.status_code == 200:
        data = response.json()
        print(f"Success! Fetched {len(data)} transactions.")
        if len(data) > 0:
            print(f"First Txn: {data[0]['description']} ({data[0]['amount']})")
    else:
        print(f"Failed: {response.status_code}")
        print(response.text)

except Exception as e:
    print(f"Error: {e}")
