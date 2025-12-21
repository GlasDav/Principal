import logging
import os
import httpx
import secrets
import hashlib
from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Body, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from .. import models, schemas, auth, database

logger = logging.getLogger(__name__)

# Rate limiter - gets limiter from app state
limiter = Limiter(key_func=get_remote_address)

# Google OAuth Client ID (from environment variable)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "960936173044-v5ufgg0q3hvqlh44u0g8uh70rd9lsd22.apps.googleusercontent.com")

# Token expiry settings
PASSWORD_RESET_EXPIRE_HOURS = 1
EMAIL_VERIFICATION_EXPIRE_HOURS = 24

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
@limiter.limit("10/minute")  # Prevent registration spam
def register(request: Request, user: schemas.UserCreate, db: Session = Depends(database.get_db)):
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
@limiter.limit("5/minute")  # Strict rate limit to prevent brute force
def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
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
@limiter.limit("30/minute")  # Allow more refreshes for legitimate session renewal
def refresh_token(request: Request, refresh_token: str = Body(..., embed=True), db: Session = Depends(database.get_db)):
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
@limiter.limit("10/minute")  # Prevent OAuth abuse
async def google_login(request: Request, token: str = Body(..., embed=True), db: Session = Depends(database.get_db)):
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
                is_couple_mode=False,
                is_email_verified=True  # Google already verified this email
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


# ============================================
# PASSWORD RESET ENDPOINTS
# ============================================

def generate_secure_token() -> tuple[str, str]:
    """Generate a secure token and its hash."""
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    return token, token_hash


@router.post("/forgot-password", response_model=schemas.MessageResponse)
@limiter.limit("3/minute")  # Strict rate limit to prevent abuse
def forgot_password(
    request: Request,
    body: schemas.ForgotPasswordRequest,
    db: Session = Depends(database.get_db)
):
    """
    Request a password reset email.
    Always returns success to prevent email enumeration attacks.
    """
    user = db.query(models.User).filter(models.User.email == body.email).first()
    
    if user:
        # Invalidate any existing reset tokens for this user
        db.query(models.PasswordResetToken).filter(
            models.PasswordResetToken.user_id == user.id,
            models.PasswordResetToken.used_at == None
        ).delete()
        
        # Generate new token
        token, token_hash = generate_secure_token()
        expires_at = datetime.utcnow() + timedelta(hours=PASSWORD_RESET_EXPIRE_HOURS)
        
        reset_token = models.PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at
        )
        db.add(reset_token)
        db.commit()
        
        # Log token for development (replace with email service in production)
        logger.info("=" * 60)
        logger.info(f"PASSWORD RESET TOKEN for {body.email}")
        logger.info(f"Token: {token}")
        logger.info(f"Reset URL: http://localhost:5173/reset-password?token={token}")
        logger.info(f"Expires: {expires_at}")
        logger.info("=" * 60)
    else:
        logger.info(f"Password reset requested for non-existent email: {body.email}")
    
    # Always return success to prevent email enumeration
    return {"message": "If an account exists with this email, you will receive a password reset link."}


@router.post("/reset-password", response_model=schemas.MessageResponse)
@limiter.limit("5/minute")
def reset_password(
    request: Request,
    body: schemas.ResetPasswordRequest,
    db: Session = Depends(database.get_db)
):
    """Reset password using a valid reset token."""
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    
    reset_token = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.token_hash == token_hash,
        models.PasswordResetToken.used_at == None,
        models.PasswordResetToken.expires_at > datetime.utcnow()
    ).first()
    
    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Update password
    user = reset_token.user
    user.hashed_password = auth.get_password_hash(body.new_password)
    
    # Mark token as used
    reset_token.used_at = datetime.utcnow()
    
    db.commit()
    
    logger.info(f"Password reset successful for user: {user.email}")
    return {"message": "Password has been reset successfully. You can now log in."}


# ============================================
# EMAIL VERIFICATION ENDPOINTS
# ============================================

@router.post("/verify-email", response_model=schemas.MessageResponse)
@limiter.limit("10/minute")
def verify_email(
    request: Request,
    body: schemas.VerifyEmailRequest,
    db: Session = Depends(database.get_db)
):
    """Verify email using a verification token."""
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    
    verification_token = db.query(models.EmailVerificationToken).filter(
        models.EmailVerificationToken.token_hash == token_hash,
        models.EmailVerificationToken.used_at == None,
        models.EmailVerificationToken.expires_at > datetime.utcnow()
    ).first()
    
    if not verification_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    # Mark user as verified
    user = verification_token.user
    user.is_email_verified = True
    
    # Mark token as used
    verification_token.used_at = datetime.utcnow()
    
    db.commit()
    
    logger.info(f"Email verified for user: {user.email}")
    return {"message": "Email verified successfully!"}


@router.post("/resend-verification", response_model=schemas.MessageResponse)
@limiter.limit("3/minute")
def resend_verification(
    request: Request,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """Resend email verification for the current user."""
    if current_user.is_email_verified:
        return {"message": "Email is already verified."}
    
    # Invalidate existing verification tokens
    db.query(models.EmailVerificationToken).filter(
        models.EmailVerificationToken.user_id == current_user.id,
        models.EmailVerificationToken.used_at == None
    ).delete()
    
    # Generate new token
    token, token_hash = generate_secure_token()
    expires_at = datetime.utcnow() + timedelta(hours=EMAIL_VERIFICATION_EXPIRE_HOURS)
    
    verification_token = models.EmailVerificationToken(
        user_id=current_user.id,
        token_hash=token_hash,
        expires_at=expires_at
    )
    db.add(verification_token)
    db.commit()
    
    # Log token for development (replace with email service in production)
    logger.info("=" * 60)
    logger.info(f"EMAIL VERIFICATION TOKEN for {current_user.email}")
    logger.info(f"Token: {token}")
    logger.info(f"Verify URL: http://localhost:5173/verify-email?token={token}")
    logger.info(f"Expires: {expires_at}")
    logger.info("=" * 60)
    
    return {"message": "Verification email sent. Please check your inbox."}


# ============================================
# ACCOUNT DELETION ENDPOINT
# ============================================

@router.delete("/account", response_model=schemas.MessageResponse)
@limiter.limit("3/minute")
def delete_account(
    request: Request,
    body: schemas.DeleteAccountRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Permanently delete the user account and all associated data.
    Requires password confirmation for security.
    """
    # Verify password
    if not auth.verify_password(body.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password"
        )
    
    user_id = current_user.id
    user_email = current_user.email
    
    # Delete all related data in order (respecting foreign keys)
    # Note: Order matters to avoid FK violations
    
    # Delete password reset tokens
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user_id
    ).delete()
    
    # Delete email verification tokens
    db.query(models.EmailVerificationToken).filter(
        models.EmailVerificationToken.user_id == user_id
    ).delete()
    
    # Delete transactions (need to handle parent-child relationship)
    db.query(models.Transaction).filter(
        models.Transaction.user_id == user_id
    ).delete()
    
    # Delete categorization rules
    db.query(models.CategorizationRule).filter(
        models.CategorizationRule.user_id == user_id
    ).delete()
    
    # Delete subscriptions
    db.query(models.Subscription).filter(
        models.Subscription.user_id == user_id
    ).delete()
    
    # Delete goals
    db.query(models.Goal).filter(
        models.Goal.user_id == user_id
    ).delete()
    
    # Delete tax settings
    db.query(models.TaxSettings).filter(
        models.TaxSettings.user_id == user_id
    ).delete()
    
    # Get account IDs before deleting
    account_ids = [a.id for a in db.query(models.Account).filter(
        models.Account.user_id == user_id
    ).all()]
    
    # Delete investment holdings
    if account_ids:
        db.query(models.InvestmentHolding).filter(
            models.InvestmentHolding.account_id.in_(account_ids)
        ).delete(synchronize_session=False)
    
    # Delete account balances (snapshots first)
    snapshot_ids = [s.id for s in db.query(models.NetWorthSnapshot).filter(
        models.NetWorthSnapshot.user_id == user_id
    ).all()]
    
    if snapshot_ids:
        db.query(models.AccountBalance).filter(
            models.AccountBalance.snapshot_id.in_(snapshot_ids)
        ).delete(synchronize_session=False)
    
    # Delete net worth snapshots
    db.query(models.NetWorthSnapshot).filter(
        models.NetWorthSnapshot.user_id == user_id
    ).delete()
    
    # Delete accounts
    db.query(models.Account).filter(
        models.Account.user_id == user_id
    ).delete()
    
    # Delete budget buckets
    db.query(models.BudgetBucket).filter(
        models.BudgetBucket.user_id == user_id
    ).delete()
    
    # Finally, delete the user
    db.query(models.User).filter(
        models.User.id == user_id
    ).delete()
    
    db.commit()
    
    logger.info(f"Account deleted: {user_email}")
    return {"message": "Your account and all data have been permanently deleted."}
