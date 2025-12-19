import requests
import json

BASE_URL = "http://localhost:8000"

def test_settings_full_payload():
    # 1. Login
    login_payload = {"username": "test_script@example.com", "password": "password123"}
    
    print("Logging in...")
    try:
        resp = requests.post(f"{BASE_URL}/auth/token", data=login_payload)
        if resp.status_code != 200:
            print(f"Login Failed: {resp.text}")
            return
        
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get current settings to mimic frontend "data"
        print("Fetching settings...")
        r_get = requests.get(f"{BASE_URL}/settings/user", headers=headers)
        current = r_get.json()
        print(f"Current Raw: {current}")
        
        # 3. Construct Payload exactly like Frontend
        # const payload = {
        #     is_couple_mode: data.is_couple_mode,
        #     name_a: data.name_a,
        #     name_b: data.name_b,
        #     currency_symbol: data.currency_symbol
        # };
        
        # Simulating toggling mode
        new_mode = not current.get('is_couple_mode')
        
        payload = {
            "is_couple_mode": new_mode,
            "name_a": current.get("name_a"),
            "name_b": current.get("name_b"),
            "currency_symbol": current.get("currency_symbol")
        }
        
        print(f"Sending Payload: {json.dumps(payload, indent=2)}")
        
        r_put = requests.put(f"{BASE_URL}/settings/user", json=payload, headers=headers)
        with open("payload_result.txt", "w") as f:
           f.write(f"Status: {r_put.status_code}\n")
           f.write(f"Response: {r_put.text}\n")
           
        if r_put.status_code == 200:
            print(f"Update Success. New Mode: {r_put.json().get('is_couple_mode')}")
        else:
            print(f"Update Failed: {r_put.status_code}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_settings_full_payload()
