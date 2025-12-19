from sqlalchemy import create_engine, Column, Integer, String, Boolean
from sqlalchemy.orm import sessionmaker, declarative_base
import sys

# Standalone definition to avoid import issues
DATABASE_URL = "sqlite:///./principal_v5.db"
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)

def list_users():
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        users = db.query(User).all()
        print(f"\nFound {len(users)} users:")
        print(f"{'ID':<5} {'Email':<30}")
        print("-" * 40)
        for u in users:
            print(f"{u.id:<5} {u.email:<30}")
        print("\n")
    finally:
        db.close()

def delete_user(email):
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            db.delete(user)
            db.commit()
            print(f"User {email} deleted.")
        else:
            print(f"User {email} not found.")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "list":
            list_users()
        elif command == "delete" and len(sys.argv) > 2:
            delete_user(sys.argv[2])
        else:
            print("Usage: python manage_users.py [list | delete <email>]")
    else:
        list_users() 
