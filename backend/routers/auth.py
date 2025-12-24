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
    """Create default accounts and buckets for a new user with hierarchical categories."""
    
    # Default Balance Sheet Accounts
    default_accounts = [
        {"name": "Checking Account", "type": "Asset", "category": "Cash"},
        {"name": "Savings Account", "type": "Asset", "category": "Cash"},
        {"name": "Credit Card", "type": "Liability", "category": "Credit Card"},
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
    
    # === HIERARCHICAL BUDGET CATEGORIES ===
    # Based on Notes file structure
    
    DEFAULT_CATEGORIES = {
        "Income": {
            "icon": "TrendingUp",
            "group": "Income",
            "children": [
                {"name": "Salaries", "icon": "Briefcase"},
                {"name": "Interest", "icon": "TrendingUp"},
                {"name": "Business", "icon": "Building"},
                {"name": "Other Income", "icon": "DollarSign"},
            ]
        },
        "Household Expenses": {
            "icon": "Home",
            "group": "Non-Discretionary",
            "children": [
                {"name": "Gas & Electricity", "icon": "Zap"},
                {"name": "Water", "icon": "Droplet"},
                {"name": "Internet", "icon": "Wifi"},
                {"name": "Mortgage/Rent", "icon": "Home"},
                {"name": "Strata Levies", "icon": "Building"},
                {"name": "Council Rates", "icon": "Landmark"},
                {"name": "Subscriptions", "icon": "CreditCard"},
                {"name": "Maintenance", "icon": "Wrench"},
                {"name": "Household General", "icon": "Home"},
            ]
        },
        "Vehicle": {
            "icon": "Car",
            "group": "Non-Discretionary",
            "children": [
                {"name": "Petrol", "icon": "Fuel"},
                {"name": "Insurance & Registration", "icon": "Shield"},
                {"name": "Vehicle Maintenance", "icon": "Settings"},
            ]
        },
        "Food": {
            "icon": "Utensils",
            "group": "Discretionary",
            "children": [
                {"name": "Groceries", "icon": "ShoppingCart"},
                {"name": "Dining Out", "icon": "Utensils"},
                {"name": "Coffee", "icon": "Coffee"},
                {"name": "Snacks", "icon": "Cookie"},
            ]
        },
        "Lifestyle": {
            "icon": "Heart",
            "group": "Discretionary",
            "children": [
                {"name": "Personal", "icon": "User"},
                {"name": "Homewares", "icon": "Sofa"},
                {"name": "Beauty", "icon": "Sparkles"},
                {"name": "Health & Fitness", "icon": "Dumbbell"},
                {"name": "Clothing", "icon": "Shirt"},
                {"name": "Leisure", "icon": "Film"},
                {"name": "Dates", "icon": "Heart"},
                {"name": "Gifts", "icon": "Gift"},
                {"name": "Parking & Tolls", "icon": "ParkingCircle"},
                {"name": "Public Transport", "icon": "Train"},
                {"name": "Taxi & Rideshare", "icon": "Car"},
            ]
        },
        "Health & Wellness": {
            "icon": "HeartPulse",
            "group": "Non-Discretionary",
            "children": [
                {"name": "Medical", "icon": "Stethoscope"},
                {"name": "Dental", "icon": "Smile"},
                {"name": "Pharmacy", "icon": "Pill"},
                {"name": "Fitness", "icon": "Dumbbell"},
            ]
        },
        "Kids": {
            "icon": "Baby",
            "group": "Discretionary",
            "children": [
                {"name": "Childcare", "icon": "Baby"},
                {"name": "Education", "icon": "GraduationCap"},
                {"name": "Kids Expenses", "icon": "ShoppingBag"},
                {"name": "Activities", "icon": "Gamepad"},
            ]
        },
        "Rollover/Non-Monthly": {
            "icon": "Calendar",
            "group": "Discretionary",
            "children": [
                {"name": "Donations", "icon": "HandHeart"},
                {"name": "Renovations", "icon": "Hammer"},
                {"name": "Travel", "icon": "Plane"},
                {"name": "Major Purchases", "icon": "ShoppingBag"},
            ]
        },
        "Financial": {
            "icon": "Landmark",
            "group": "Non-Discretionary",
            "children": [
                {"name": "Cash & ATM Fees", "icon": "Banknote"},
                {"name": "Financial Fees", "icon": "Building2"},
                {"name": "Investment Contributions", "icon": "TrendingUp"},
                {"name": "Accounting", "icon": "Calculator"},
            ]
        },
        "Other": {
            "icon": "MoreHorizontal",
            "group": "Discretionary",
            "children": [
                {"name": "Work Expenses", "icon": "Briefcase"},
                {"name": "Business Expenses", "icon": "Building"},
                {"name": "Miscellaneous", "icon": "MoreHorizontal"},
                {"name": "Uncategorised", "icon": "HelpCircle"},
            ]
        },
    }
    
    # Create parent categories and their children
    display_order = 0
    total_buckets = 0
    
    for parent_name, config in DEFAULT_CATEGORIES.items():
        # Create parent bucket
        parent_bucket = models.BudgetBucket(
            user_id=user.id,
            name=parent_name,
            icon_name=config.get("icon", "Wallet"),
            group=config.get("group", "Discretionary"),
            display_order=display_order
        )
        db.add(parent_bucket)
        db.flush()  # Get the parent ID
        display_order += 1
        total_buckets += 1
        
        # Create children with parent_id reference
        child_order = 0
        for child in config.get("children", []):
            child_bucket = models.BudgetBucket(
                user_id=user.id,
                name=child["name"],
                icon_name=child.get("icon", "Wallet"),
                group=config.get("group", "Discretionary"),
                parent_id=parent_bucket.id,
                display_order=child_order
            )
            db.add(child_bucket)
            child_order += 1
            total_buckets += 1
    
    # --- SPECIAL BUCKETS (Protected) ---
    # Transfers bucket (excluded from spending analytics)
    db.add(models.BudgetBucket(
        user_id=user.id, name="Transfers", icon_name="ArrowLeftRight",
        group="Non-Discretionary", is_transfer=True, display_order=display_order
    ))
    display_order += 1
    total_buckets += 1
    
    # Investments bucket (excluded from expenses, shown in Sankey)
    db.add(models.BudgetBucket(
        user_id=user.id, name="Investments", icon_name="TrendingUp",
        group="Non-Discretionary", is_investment=True, display_order=display_order
    ))
    display_order += 1
    total_buckets += 1
    
    # One Off bucket (excluded from forecasting - tax payments, large one-time purchases)
    db.add(models.BudgetBucket(
        user_id=user.id, name="One Off", icon_name="Zap",
        group="Non-Discretionary", is_one_off=True, display_order=display_order
    ))
    total_buckets += 1
    
    db.commit()
    logger.info(f"Created default accounts and {total_buckets} hierarchical buckets for user {user.email}")



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
        name=user.name or "You"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create default Household Member
    default_member = models.HouseholdMember(
        user_id=new_user.id,
        name=new_user.name,
        color="#4F46E5", # Indigo-600
        avatar="User"
    )
    db.add(default_member)
    db.commit()
    
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
    
    # Include token_version for session management
    token_version = getattr(user, 'token_version', 0) or 0
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "tv": token_version}, expires_delta=access_token_expires
    )
    refresh_token = auth.create_refresh_token(
        data={"sub": user.email, "tv": token_version}
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
        token_version: int = payload.get("tv", 0)
        if email is None or token_type != "refresh":
            raise credentials_exception
    except auth.JWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise credentials_exception
    
    # Check if token is still valid (not invalidated by "logout everywhere")
    user_token_version = getattr(user, 'token_version', 0) or 0
    if token_version < user_token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": email, "tv": user_token_version}, expires_delta=access_token_expires
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
                name=user_info.get("given_name", "You"),
                is_email_verified=True  # Google already verified this email
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            # Create default Household Member
            default_member = models.HouseholdMember(
                user_id=user.id,
                name=user.name,
                color="#4F46E5",
                avatar="User"
            )
            db.add(default_member)
            db.commit()
            
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


# ============================================
# SESSION MANAGEMENT ENDPOINTS
# ============================================

@router.post("/logout-all", response_model=schemas.MessageResponse)
@limiter.limit("5/minute")
def logout_all_sessions(
    request: Request,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Log out from all devices by invalidating all existing tokens.
    The user will need to log in again on all devices.
    """
    # Increment token version to invalidate all existing tokens
    current_token_version = getattr(current_user, 'token_version', 0) or 0
    current_user.token_version = current_token_version + 1
    db.commit()
    
    logger.info(f"All sessions invalidated for user: {current_user.email}")
    return {"message": "All sessions have been logged out. Please log in again."}


# ============================================
# CHANGE PASSWORD ENDPOINT
# ============================================

@router.post("/change-password", response_model=schemas.MessageResponse)
@limiter.limit("5/minute")
def change_password(
    request: Request,
    body: dict = Body(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Change password for the current user.
    Requires current password for verification.
    """
    current_password = body.get("current_password")
    new_password = body.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password and new password are required"
        )
    
    # Verify current password
    if not auth.verify_password(current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Validate new password strength
    import re
    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long"
        )
    if not re.search(r'[A-Za-z]', new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one letter"
        )
    if not re.search(r'[0-9]', new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one number"
        )
    
    # Update password
    current_user.hashed_password = auth.get_password_hash(new_password)
    
    # Increment token version to log out other sessions (optional security measure)
    current_token_version = getattr(current_user, 'token_version', 0) or 0
    current_user.token_version = current_token_version + 1
    
    db.commit()
    
    logger.info(f"Password changed for user: {current_user.email}")
    return {"message": "Password changed successfully. Please log in again."}


# ============================================
# CHANGE EMAIL ENDPOINT
# ============================================

@router.post("/change-email", response_model=schemas.MessageResponse)
@limiter.limit("3/minute")
def change_email(
    request: Request,
    body: dict = Body(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Change email for the current user.
    Requires password for verification.
    Note: Email verification will be reset.
    """
    password = body.get("password")
    new_email = body.get("new_email")
    
    if not password or not new_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password and new email are required"
        )
    
    # Verify password
    if not auth.verify_password(password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password is incorrect"
        )
    
    # Validate email format
    import re
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, new_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )
    
    # Check if email is already in use
    existing_user = db.query(models.User).filter(models.User.email == new_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already in use"
        )
    
    old_email = current_user.email
    
    # Update email
    current_user.email = new_email
    current_user.is_email_verified = False  # Reset verification status
    
    # Increment token version to log out all sessions
    current_token_version = getattr(current_user, 'token_version', 0) or 0
    current_user.token_version = current_token_version + 1
    
    db.commit()
    
    logger.info(f"Email changed for user from {old_email} to {new_email}")
    return {"message": "Email changed successfully. Please verify your new email and log in again."}


# ============================================
# MULTI-FACTOR AUTHENTICATION (MFA) ENDPOINTS
# ============================================

@router.get("/mfa/status")
def get_mfa_status(
    current_user: models.User = Depends(auth.get_current_user),
):
    """Get current MFA status for the user."""
    return {
        "mfa_enabled": getattr(current_user, 'mfa_enabled', False) or False,
        "has_backup_codes": bool(getattr(current_user, 'mfa_backup_codes', None))
    }


@router.post("/mfa/setup")
@limiter.limit("5/minute")
def setup_mfa(
    request: Request,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Initialize MFA setup. Returns a secret and provisioning URI for authenticator apps.
    User must call /mfa/verify to complete setup.
    """
    try:
        import pyotp
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="MFA not available. Please install pyotp."
        )
    
    # Check if MFA is already enabled
    if getattr(current_user, 'mfa_enabled', False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled. Disable it first to set up again."
        )
    
    # Generate new TOTP secret
    secret = pyotp.random_base32()
    
    # Store the secret (not yet enabled)
    current_user.mfa_secret = secret
    db.commit()
    
    # Create provisioning URI for authenticator apps
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=current_user.email,
        issuer_name="Principal Finance"
    )
    
    # Generate QR code as base64 (optional - client can generate from URI)
    qr_code_base64 = None
    try:
        import qrcode
        import io
        import base64
        
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
    except ImportError:
        pass  # QR code generation is optional
    
    return {
        "secret": secret,
        "provisioning_uri": provisioning_uri,
        "qr_code_base64": qr_code_base64,
        "message": "Scan the QR code with your authenticator app, then verify with a code."
    }


@router.post("/mfa/verify", response_model=schemas.MessageResponse)
@limiter.limit("10/minute")
def verify_mfa_setup(
    request: Request,
    body: dict = Body(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Verify TOTP code to complete MFA setup and enable MFA.
    """
    try:
        import pyotp
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="MFA not available."
        )
    
    code = body.get("code")
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code is required"
        )
    
    # Check if secret exists
    secret = getattr(current_user, 'mfa_secret', None)
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA setup not started. Call /mfa/setup first."
        )
    
    # Verify the TOTP code
    totp = pyotp.TOTP(secret)
    if not totp.verify(code, valid_window=1):  # Allow 30 second window
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please try again."
        )
    
    # Generate backup codes
    backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]
    hashed_codes = [hashlib.sha256(code.encode()).hexdigest() for code in backup_codes]
    
    # Enable MFA and store backup codes
    current_user.mfa_enabled = True
    current_user.mfa_backup_codes = ",".join(hashed_codes)
    
    # Increment token version to require re-login on other devices
    current_token_version = getattr(current_user, 'token_version', 0) or 0
    current_user.token_version = current_token_version + 1
    
    db.commit()
    
    logger.info(f"MFA enabled for user: {current_user.email}")
    
    return {
        "message": "MFA successfully enabled. Save your backup codes securely.",
        "backup_codes": backup_codes  # Only shown once!
    }


@router.post("/mfa/disable", response_model=schemas.MessageResponse)
@limiter.limit("5/minute")
def disable_mfa(
    request: Request,
    body: dict = Body(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Disable MFA. Requires password verification.
    """
    password = body.get("password")
    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required to disable MFA"
        )
    
    # Verify password
    if not auth.verify_password(password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password is incorrect"
        )
    
    # Disable MFA
    current_user.mfa_enabled = False
    current_user.mfa_secret = None
    current_user.mfa_backup_codes = None
    
    db.commit()
    
    logger.info(f"MFA disabled for user: {current_user.email}")
    return {"message": "MFA has been disabled."}


@router.post("/mfa/validate", response_model=schemas.Token)
@limiter.limit("10/minute")
def validate_mfa_code(
    request: Request,
    body: dict = Body(...),
    db: Session = Depends(database.get_db)
):
    """
    Validate MFA code during login. Called after password verification
    when MFA is enabled. Returns tokens if successful.
    """
    try:
        import pyotp
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="MFA not available."
        )
    
    email = body.get("email")
    code = body.get("code")
    mfa_token = body.get("mfa_token")  # Temporary token from login
    
    if not email or not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and code are required"
        )
    
    # Find the user
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Check if MFA is enabled
    if not getattr(user, 'mfa_enabled', False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled for this account"
        )
    
    secret = getattr(user, 'mfa_secret', None)
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="MFA configuration error"
        )
    
    # Try TOTP code first
    totp = pyotp.TOTP(secret)
    is_valid = totp.verify(code, valid_window=1)
    
    # If TOTP fails, try backup codes
    if not is_valid:
        backup_codes = getattr(user, 'mfa_backup_codes', '') or ''
        if backup_codes:
            code_hash = hashlib.sha256(code.upper().encode()).hexdigest()
            codes_list = backup_codes.split(',')
            
            if code_hash in codes_list:
                # Remove used backup code
                codes_list.remove(code_hash)
                user.mfa_backup_codes = ','.join(codes_list)
                db.commit()
                is_valid = True
                logger.info(f"Backup code used for user: {user.email}")
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid verification code"
        )
    
    # Generate tokens
    token_version = getattr(user, 'token_version', 0) or 0
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "tv": token_version},
        expires_delta=access_token_expires
    )
    refresh_token = auth.create_refresh_token(
        data={"sub": user.email, "tv": token_version}
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/mfa/regenerate-backup-codes", response_model=schemas.MessageResponse)
@limiter.limit("3/minute")
def regenerate_backup_codes(
    request: Request,
    body: dict = Body(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Regenerate backup codes. Requires password and current TOTP code.
    """
    try:
        import pyotp
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="MFA not available."
        )
    
    password = body.get("password")
    code = body.get("code")
    
    if not password or not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password and current TOTP code are required"
        )
    
    # Verify password
    if not auth.verify_password(password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password is incorrect"
        )
    
    # Verify TOTP code
    secret = getattr(current_user, 'mfa_secret', None)
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled"
        )
    
    totp = pyotp.TOTP(secret)
    if not totp.verify(code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP code"
        )
    
    # Generate new backup codes
    backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]
    hashed_codes = [hashlib.sha256(code.encode()).hexdigest() for code in backup_codes]
    
    current_user.mfa_backup_codes = ",".join(hashed_codes)
    db.commit()
    
    logger.info(f"Backup codes regenerated for user: {current_user.email}")
    
    return {
        "message": "New backup codes generated. Save them securely.",
        "backup_codes": backup_codes  # Only shown once!
    }
