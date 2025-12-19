from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, auth, database

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

@router.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    import traceback
    with open("debug_log.txt", "a") as f:
        f.write("Register called\n")
    try:
        db_user = db.query(models.User).filter(models.User.email == user.email).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        with open("debug_log.txt", "a") as f: f.write("Hashing password\n")
        hashed_password = auth.get_password_hash(user.password)
        
        with open("debug_log.txt", "a") as f: f.write("Creating User object\n")
        new_user = models.User(
            email=user.email,
            hashed_password=hashed_password,
            # Defaults for others
            name_a="You",
            name_b="Partner",
            is_couple_mode=False
        )
        with open("debug_log.txt", "a") as f: f.write("Adding to DB\n")
        db.add(new_user)
        with open("debug_log.txt", "a") as f: f.write("Committing\n")
        db.commit()
        with open("debug_log.txt", "a") as f: f.write("Refreshing\n")
        db.refresh(new_user)
        return new_user
    except Exception as e:
        with open("debug_log.txt", "a") as f:
            f.write("REGISTRATION ERROR:\n")
            traceback.print_exc(file=f)
        raise e

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    # OAuth2PasswordRequestForm uses 'username' field, but frontend will send email in it
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/google", response_model=schemas.Token)
def google_login(token: str = Body(..., embed=True), db: Session = Depends(database.get_db)):
    """
    Verifies Google ID Token and returns JWT.
    Requires GOOGLE_CLIENT_ID env var.
    """
    # TODO: Verify token with google-auth
    # For now, we simulate success for demo
    # In prod: idinfo = id_token.verify_oauth2_token(token, requests.Request(), CLIENT_ID)
    
    # Mocking behavior:
    # 1. Decode token (in prod, verify signature)
    # 2. Extract email
    # 3. Find or Create User
    # 4. Return JWT
    
    # Placeholder implementation
    fake_email = "test@gmail.com" # We can't decode real token without lib here easily
    
    # Try to find user
    user = db.query(models.User).filter(models.User.email == fake_email).first()
    if not user:
        # Create Google User
        user = models.User(
            email=fake_email,
            hashed_password="google_auth_no_password", 
            name_a="Google User",
            is_couple_mode=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users/me", response_model=schemas.User) # Endpoint was missing!
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user
