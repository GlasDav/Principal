import logging
import os
import httpx
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Body, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from .. import models, schemas, auth, database

logger = logging.getLogger(__name__)

# Google OAuth Client ID (from environment variable)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "960936173044-v5ufgg0q3hvqlh44u0g8uh70rd9lsd22.apps.googleusercontent.com")

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)


def create_default_user_setup(user: models.User, db: Session):
    """Create default accounts and buckets for a new user."""
    
    # Default Balance Sheet Accounts
    default_accounts = [
        {"name": "Checking Account", "type": "checking", "category": "Cash"},
        {"name": "Savings Account", "type": "savings", "category": "Cash"},
        {"name": "Credit Card", "type": "credit_card", "category": "Credit Card"},
    ]
    
    for account_data in default_accounts:
        account = models.Account(
            user_id=user.id,
            name=account_data["name"],
            type=account_data["type"],
            category=account_data["category"],
            is_active=True
        )
        db.add(account)
    
    # Default "Transfers" bucket (excluded from spending analytics)
    transfers_bucket = models.BudgetBucket(
        user_id=user.id,
        name="Transfers",
        icon_name="ArrowLeftRight",
        group="Non-Discretionary",
        is_transfer=True,  # Key flag to exclude from analytics
        monthly_limit_a=0.0,
        monthly_limit_b=0.0
    )
    db.add(transfers_bucket)
    
    db.commit()
    logger.info(f"Created default accounts and Transfer bucket for user {user.email}")


@router.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    """Register a new user account."""
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    
    new_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        name_a="You",
        name_b="Partner",
        is_couple_mode=False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create default accounts and buckets
    create_default_user_setup(new_user, db)
    
    logger.info(f"New user registered: {user.email}")
    return new_user

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    """Authenticate user and return access/refresh tokens."""
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Failed login attempt for: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    refresh_token = auth.create_refresh_token(
        data={"sub": user.email}
    )
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.post("/refresh", response_model=schemas.Token)
def refresh_token(refresh_token: str = Body(..., embed=True), db: Session = Depends(database.get_db)):
    """Refresh an expired access token using a valid refresh token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = auth.jwt.decode(refresh_token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        if email is None or token_type != "refresh":
            raise credentials_exception
    except auth.JWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise credentials_exception

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.post("/google", response_model=schemas.Token)
async def google_login(token: str = Body(..., embed=True), db: Session = Depends(database.get_db)):
    """
    Google OAuth login - verifies Google access token and creates/returns user.
    """
    try:
        # Use the access token to fetch user info from Google
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code != 200:
                logger.warning(f"Google token verification failed: {response.status_code}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid Google token"
                )
            
            user_info = response.json()
            email = user_info.get("email")
            
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Could not retrieve email from Google"
                )
            
            # Check if email is verified
            if not user_info.get("email_verified", False):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google email not verified"
                )
        
        # Check if user exists
        user = db.query(models.User).filter(models.User.email == email).first()
        
        if not user:
            # Create new user with Google account
            # Generate a random password hash since they'll use Google to login
            import secrets
            random_password = secrets.token_urlsafe(32)
            hashed_password = auth.get_password_hash(random_password)
            
            user = models.User(
                email=email,
                hashed_password=hashed_password,
                name_a=user_info.get("given_name", "You"),
                name_b="Partner",
                is_couple_mode=False
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Create default accounts and buckets for new Google users
            create_default_user_setup(user, db)
            
            logger.info(f"New user registered via Google: {email}")
        else:
            logger.info(f"User logged in via Google: {email}")
        
        # Generate tokens
        access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = auth.create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        refresh_token = auth.create_refresh_token(
            data={"sub": user.email}
        )
        
        return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}
        
    except httpx.RequestError as e:
        logger.error(f"Google API request failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not verify Google token. Please try again."
        )


@router.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    """Get current authenticated user's profile."""
    return current_user
