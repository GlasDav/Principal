from datetime import datetime
from typing import Optional, Dict, Any
import logging
import os
import httpx

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from .database import get_db
from . import models

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

# Legacy Secret for internal signing if needed (not for Supabase)
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

# Global Cache for JWKS
_jwks_cache: Dict[str, Any] = {}

async def get_supabase_jwks(supabase_url: str) -> Dict[str, Any]:
    """Fetch and cache JWKS from Supabase."""
    global _jwks_cache
    
    # Simple caching strategy: if populated, return it. 
    # In production, might want TTL, but keys rotate rarely.
    if _jwks_cache:
        return _jwks_cache

    # Try the standard .well-known endpoint first
    jwks_url = f"{supabase_url.rstrip('/')}/.well-known/jwks.json"
    
    # Add API Key to headers just in case (though .well-known is usually public)
    headers = {}
    api_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") # fallback
    if api_key:
        headers["apikey"] = api_key
        
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(jwks_url, headers=headers)
            if response.status_code == 404:
                # Fallback to the other common Supabase path
                jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/jwks"
                response = await client.get(jwks_url, headers=headers)
            
            response.raise_for_status()
            _jwks_cache = response.json()
            return _jwks_cache
    except Exception as e:
        logger.error(f"Failed to fetch JWKS from {jwks_url}: {e}")
        # Clear cache if failed potentially?
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not verify authentication keys"
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
                {"name": "Mobile Phone", "icon": "Smartphone"},
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
    
    display_order = 0
    
    for parent_name, config in DEFAULT_CATEGORIES.items():
        parent_bucket = models.BudgetBucket(
            user_id=user.id,
            name=parent_name,
            icon_name=config.get("icon", "Wallet"),
            group=config.get("group", "Discretionary"),
            display_order=display_order
        )
        db.add(parent_bucket)
        db.flush()
        display_order += 1
        
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
    
    # Special Buckets
    db.add(models.BudgetBucket(
        user_id=user.id, name="Transfers", icon_name="ArrowLeftRight",
        group="Non-Discretionary", is_transfer=True, display_order=display_order
    ))
    display_order += 1
    
    db.add(models.BudgetBucket(
        user_id=user.id, name="Investments", icon_name="TrendingUp",
        group="Non-Discretionary", is_investment=True, display_order=display_order
    ))
    display_order += 1
    
    db.add(models.BudgetBucket(
        user_id=user.id, name="One Off", icon_name="Zap",
        group="Non-Discretionary", is_one_off=True, display_order=display_order
    ))
    display_order += 1
    
    db.add(models.BudgetBucket(
        user_id=user.id, name="Reimbursable", icon_name="ReceiptText",
        group="Non-Discretionary", display_order=display_order
    ))
    
    db.commit()
    logger.info(f"Created default configuration for user {user.email}")


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    
    try:
        # Inspect Header to determine Algorithm
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")
        kid = header.get("kid")
        
        logger.info(f"JWT token algorithm: {alg}, kid: {kid}")
        
        payload = None
        
        # Strategy: Always try HS256 first with the JWT secret (Supabase's standard approach)
        # Only fall back to JWKS if HS256 fails and token uses RS256/ES256
        
        if SUPABASE_JWT_SECRET:
            logger.info(f"Attempting HS256 verification (secret length: {len(SUPABASE_JWT_SECRET)})")
            try:
                payload = jwt.decode(
                    token, 
                    SUPABASE_JWT_SECRET, 
                    algorithms=["HS256"], 
                    audience="authenticated"
                )
                logger.info("JWT verified successfully with HS256")
            except JWTError as hs256_error:
                logger.error(f"HS256 verification failed: {hs256_error}")
                # HS256 failed, try JWKS if algorithm is RS256/ES256
                if alg in ["RS256", "ES256"] and SUPABASE_URL:
                    logger.info(f"Falling back to JWKS for {alg} verification...")
                    try:
                        jwks = await get_supabase_jwks(SUPABASE_URL)
                        payload = jwt.decode(
                            token, 
                            jwks, 
                            algorithms=["RS256", "ES256"], 
                            audience="authenticated",
                        )
                        logger.info(f"JWT verified successfully with {alg} via JWKS")
                    except Exception as jwks_error:
                        logger.error(f"JWKS verification also failed: {jwks_error}")
                        raise credentials_exception
                else:
                    # No fallback available
                    logger.error(f"HS256 failed and no JWKS fallback (alg={alg})")
                    raise credentials_exception
        elif alg in ["RS256", "ES256"] and SUPABASE_URL:
            # No JWT secret, try JWKS directly
            try:
                jwks = await get_supabase_jwks(SUPABASE_URL)
                payload = jwt.decode(
                    token, 
                    jwks, 
                    algorithms=["RS256", "ES256"], 
                    audience="authenticated",
                )
            except Exception as e:
                logger.error(f"JWKS verification failed: {e}")
                raise credentials_exception
        else:
            logger.error(f"No SUPABASE_JWT_SECRET and cannot use JWKS (alg={alg}, URL set={bool(SUPABASE_URL)})")
            raise credentials_exception
        
        if payload is None:
            raise credentials_exception

        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        
        if not user_id:
             raise credentials_exception

    except JWTError as e:
        logger.error(f"JWT Verification failed: {e}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Using JWT auth failed unexpected: {e}")
        raise credentials_exception

    # Query User (from public.profiles)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    if user is None:
        logger.info(f"User {user_id} ({email}) authenticated but not found in profiles. Provisioning JIT...")
        
        # JIT Provisioning
        # 1. Create Profile
        new_user = models.User(
            id=user_id,
            email=email,
            name="User" # Default name
            # currency_symbol defaults to AUD in model
        )
        db.add(new_user)
        try:
            db.commit()
            db.refresh(new_user)
            
            # 2. Setup Default Data
            create_default_user_setup(new_user, db)
            
            return new_user
        except Exception as e:
            logger.error(f"Failed to provision user {user_id}: {e}")
            db.rollback()
            raise credentials_exception
    
    return user
