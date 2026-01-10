from datetime import datetime, timedelta
from typing import Optional
import logging
import os

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from .database import get_db
from . import models, schemas

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

# CONSTANTS - Environment Configuration
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    # In development, allow a default but warn loudly
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise RuntimeError("SECRET_KEY environment variable is required in production")
    else:
        SECRET_KEY = "dev-only-insecure-key-do-not-use-in-production"
        logger.warning("⚠️  Using insecure default SECRET_KEY - set SECRET_KEY env var for production!")

ALGORITHM = "HS256"
# Short lived access token (e.g. 60 mins)
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
# Long lived refresh token (e.g. 7 days)
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    # SUPABASE JWT SECRET
    SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

    try:
        # 1. Try Legacy Token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_version: int = payload.get("tv", 0)
    except JWTError:
        # 2. Try Supabase Token (if configured)
        if SUPABASE_JWT_SECRET:
            try:
                # Supabase tokens use HS256 and have 'authenticated' audience
                #options = {"verify_aud": False} # Sometimes aud is missing or array?
                payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
                email = payload.get("email")
                # Supabase token doesn't use our versioning system, so we accept it as valid 
                # (or we could fetch user.token_version and ignore it, but let's treat external auth as Source of Truth)
                token_version = 999999 # Treat as always valid/different
                
                # IMPORTANT: Supabase token 'sub' is the UUID. 'email' is the email.
                # We need EMAIL to lookup the legacy user (Int ID).
                if not email:
                     # Fallback to fetching user from Supabase API if email not in token? 
                     # Usually email is in token.
                     raise credentials_exception
            except JWTError:
                raise credentials_exception
        else:
            raise credentials_exception

    if email is None:
        raise credentials_exception

    # Query User (Legacy ID) by Email
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        # Auto-create user if they exist in Supabase but not in Legacy?
        # For now, raise error. We rely on the migration script.
        raise credentials_exception
    
    # Check if token is still valid (Legacy only)
    # If it was a Supabase token (token_version = 999999), we skip this check
    user_token_version = getattr(user, 'token_version', 0) or 0
    if token_version != 999999 and token_version < user_token_version:
        logger.warning(f"Token invalidated for user {email} - token_version mismatch")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

