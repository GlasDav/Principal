
import sys
import os
import secrets
from fastapi import Request

# Add parent directory to path
sys.path.append(os.getcwd())

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base, SQLALCHEMY_DATABASE_URL
from backend import models, schemas
from backend.routers.auth import register

def debug_register_crash():
    # Setup DB
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    
    # Mock Request
    class MockRequest:
        pass
    
    request = MockRequest()
    
    # Random Email
    email = f"debug_user_{secrets.token_hex(4)}@test.com"
    user_data = schemas.UserCreate(
        email=email,
        password="password123",
        name="Debug User"
    )
    
    print(f"Attempting to register: {email}")
    
    try:
        new_user = register(request, user_data, db)
        print("Registration SUCCESS!")
        print(f"User ID: {new_user.id}")
        
    except Exception as e:
        print("\n!!! CAUGHT EXCEPTION !!!")
        print(f"Type: {type(e)}")
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        db.close()

if __name__ == "__main__":
    debug_register_crash()
