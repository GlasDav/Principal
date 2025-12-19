import requests

BASE_URL = "http://localhost:8000/net-worth/accounts"

def test_account_lifecycle():
    print("Testing Account Lifecycle...")
    
    # 1. Create
    print("1. Creating Temp Account...")
    res = requests.post(BASE_URL, json={"name": "Temp Test", "type": "Asset", "category": "Other"})
    assert res.status_code == 200
    acc_id = res.json()["id"]
    print(f"   Created ID: {acc_id}")
    
    # 2. Update
    print("2. Updating Account...")
    res = requests.put(f"{BASE_URL}/{acc_id}", json={
        "name": "Updated Test", 
        "type": "Liability", 
        "category": "Loan",
        "is_active": True
    })
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Updated Test"
    assert data["type"] == "Liability"
    print("   Update Verified.")
    
    # 3. Delete
    print("3. Deleting Account...")
    res = requests.delete(f"{BASE_URL}/{acc_id}")
    assert res.status_code == 200
    print("   Delete Verified.")
    
    # 4. Verify Gone
    # Fetch all and ensure not present (since default endpoint filters active=True)
    res = requests.get(BASE_URL)
    accounts = res.json()
    found = any(a["id"] == acc_id for a in accounts)
    assert not found
    print("   Gone from list Verified.")
    
    print("All Lifecycle Tests Passed!")

if __name__ == "__main__":
    try:
        test_account_lifecycle()
    except Exception as e:
        print(f"FAILED: {e}")
