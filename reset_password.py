import sqlite3
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def reset_password(email="test@gmail.com", new_password="password"):
    conn = sqlite3.connect('principal_v5.db')
    cursor = conn.cursor()
    
    hashed = pwd_context.hash(new_password)
    
    print(f"Resetting password for {email}...")
    cursor.execute("UPDATE users SET hashed_password = ? WHERE email = ?", (hashed, email))
    
    if cursor.rowcount > 0:
        print("Success! Password updated.")
    else:
        print("User not found.")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    reset_password() # Default resets test@gmail.com to "password"
