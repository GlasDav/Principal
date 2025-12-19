import requests
import os

# Note: This relies on the backend verifying that buckets exist.
# The previous phases should have seeded "Transport" and "Groceries".

url = "http://localhost:8000/ingest/upload"
filepath = "dummy_statement.pdf"

# If dummy doesn't exist, use Test Statement
if not os.path.exists(filepath):
    filepath = "Test Statement.pdf"

if not os.path.exists(filepath):
    print("No test PDF found.")
    exit()

try:
    with open(filepath, "rb") as f:
        print(f"Uploading {filepath}...")
        files = {"file": (filepath, f, "application/pdf")}
        response = requests.post(url, files=files)
        
    if response.status_code == 200:
        data = response.json()
        print(f"Success! {len(data)} transactions.")
        
        # Check specific examples suitable for generic testing
        for txn in data:
            desc = txn['description'].lower()
            cat = txn.get('bucket', {}).get('name') if txn.get('bucket') else "None"
            conf = txn.get('category_confidence', 0)
            
            # Print matched ones for verification
            if conf > 0:
                print(f"[MATCH] {txn['description']} -> {cat} (ID: {txn.get('bucket_id')}) (Conf: {conf})")
            else:
                # Print unmatched generic ones
                if "uber" in desc or "coles" in desc or "woolworths" in desc:
                     print(f"[FAIL] {txn['description']} was NOT matched.")
    else:
        print(f"Failed: {response.status_code}")
        print(response.text)

except Exception as e:
    print(f"Error: {e}")
