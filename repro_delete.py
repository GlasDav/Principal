import requests
import sys

BASE_URL = "http://localhost:8000"

def test_delete():
    # 1. Create a dummy transaction to delete
    # We can't easily create one via public API if there's no create endpoint, 
    # but we can list and see if there are any.
    print("Fetching transactions...")
    r = requests.get(f"{BASE_URL}/transactions/")
    r.raise_for_status()
    txns = r.json()
    
    if not txns:
        print("No transactions to test delete with. Please upload a file first or manually add one to DB.")
        sys.exit(0)

    target_id = txns[0]['id']
    print(f"Attempting to batch-delete transaction ID: {target_id}")

    # 2. Call batch delete
    payload = [target_id]
    r = requests.post(f"{BASE_URL}/transactions/batch-delete", json=payload)
    
    if r.status_code != 200:
        print(f"FAILED: Status {r.status_code}")
        print(r.text)
        sys.exit(1)
        
    print(f"Success response: {r.json()}")

    # 3. Verify it's gone
    r = requests.get(f"{BASE_URL}/transactions/")
    txns_after = r.json()
    found = any(t['id'] == target_id for t in txns_after)
    
    if found:
        print("FAILED: Transaction still exists in list!")
    else:
        print("PASSED: Transaction successfully deleted.")

if __name__ == "__main__":
    test_delete()
