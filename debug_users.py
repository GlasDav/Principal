import sqlite3
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def check_users():
    conn = sqlite3.connect('principal_v5.db')
    cursor = conn.cursor()
    
    print("--- Users ---")
    cursor.execute("SELECT id, email, hashed_password FROM users")
    users = cursor.fetchall()
    for u in users:
        print(f"ID: {u[0]}, Email: {u[1]}")
        # print(f"Hash: {u[2]}") # Don't print full hash for privacy, just check len/type
        try:
            is_valid = pwd_context.verify("password", u[2])
            print(f"  Password 'password' valid?: {is_valid}")
        except Exception as e:
            print(f"  Hash verification failed: {e}")
            
    conn.close()

if __name__ == "__main__":
    check_users()
