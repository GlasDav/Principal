import requests

url = "http://localhost:8000/ingest/upload"
filepath = "dummy_statement.pdf"

try:
    with open(filepath, "rb") as f:
        print(f"Uploading {filepath} to {url}...")
        files = {"file": (filepath, f, "application/pdf")}
        response = requests.post(url, files=files)
        
    if response.status_code == 200:
        print("Success! Extracted Transactions:")
        for txn in response.json():
            print(f" - {txn['date'][:10]} | {txn['description']} | ${txn['amount']}")
    else:
        print(f"Failed: {response.status_code}")
        print(response.text)

except Exception as e:
    print(f"Error: {e}")
