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

    jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/jwks"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(jwks_url)
            response.raise_for_status()
            _jwks_cache = response.json()
            return _jwks_cache
    except Exception as e:
        logger.error(f"Failed to fetch JWKS from {jwks_url}: {e}")
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

    if not SUPABASE_URL:
         logger.error("Missing SUPABASE_URL env var")
         # We can try falling back to HS256-only if URL is missing but Secret exists
    
    try:
        # 1. Inspect Header to determine Algorithm
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")
        
        payload = None
        
        if alg == "HS256":
            if not SUPABASE_JWT_SECRET:
                logger.error("Missing SUPABASE_JWT_SECRET for HS256 token")
                raise credentials_exception
            
            payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
            
        elif alg == "RS256":
            if not SUPABASE_URL:
                logger.error("Received RS256 token but SUPABASE_URL is not set")
                raise credentials_exception
            
            # Fetch JWKS
            jwks = await get_supabase_jwks(SUPABASE_URL)
            
            # Verify with Key
            payload = jwt.decode(
                token, 
                jwks, 
                algorithms=["RS256"], 
                audience="authenticated",
                # Python-Jose with JWKS dict automatically finds key by 'kid'
            )
            
        else:
            logger.error(f"Unsupported JWT Algorithm: {alg}")
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
