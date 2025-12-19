import requests

BASE_URL = "http://localhost:8000"

def test_settings_toggle():
    # 1. Login to get token
    login_payload = {"username": "test_script@example.com", "password": "password123"} # Auth expects 'username' field for OAuth2 form, even if it holds email
    # Wait, OAuth2PasswordRequestForm uses 'username' and 'password' fields. 
    # My backend /token endpoint uses OAuth2PasswordRequestForm.
    # So I must send 'username': 'email_address'
    
    print("Logging in...")
    try:
        resp = requests.post(f"{BASE_URL}/auth/token", data=login_payload)
        if resp.status_code != 200:
            print(f"Login Failed: {resp.text}")
            return
        
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get current settings
        print("Fetching settings...")
        r_get = requests.get(f"{BASE_URL}/settings/user", headers=headers)
        current = r_get.json()
        print(f"Current Mode: {current.get('is_couple_mode')}")
        
        # 3. Toggle
        new_mode = not current.get('is_couple_mode')
        print(f"Toggling to: {new_mode}")
        
        # Payload matching UserSettingsUpdate
        payload = {"is_couple_mode": new_mode} 
        
        r_put = requests.put(f"{BASE_URL}/settings/user", json=payload, headers=headers)
        if r_put.status_code == 200:
            print(f"Update Success. New Mode: {r_put.json().get('is_couple_mode')}")
        else:
            print(f"Update Failed: {r_put.status_code} {r_put.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_settings_toggle()
