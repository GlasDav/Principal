"""
API Keys router for personal API access management.
Users can create, list, and revoke API keys for programmatic access.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import secrets
import hashlib
from pydantic import BaseModel

from .. import models, auth
from ..database import get_db

router = APIRouter(
    prefix="/settings/api-keys",
    tags=["api-keys"],
)


# Schemas
class ApiKeyCreate(BaseModel):
    name: str
    scopes: str = "read"  # Comma-separated: "read", "write", "transactions"
    expires_in_days: Optional[int] = None  # None = never expires


class ApiKeyResponse(BaseModel):
    id: int
    name: str
    key_prefix: str
    scopes: str
    is_active: bool
    created_at: datetime
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ApiKeyCreated(BaseModel):
    """Response when creating a new key - includes the full key (shown once)."""
    id: int
    name: str
    key: str  # Full key shown only once!
    key_prefix: str
    scopes: str
    expires_at: Optional[datetime]


def _generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key.
    Returns: (full_key, key_prefix, key_hash)
    """
    # Generate a secure random key with prefix
    random_part = secrets.token_urlsafe(32)
    full_key = f"pk_live_{random_part}"
    key_prefix = full_key[:16]  # "pk_live_" + 8 random chars
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    
    return full_key, key_prefix, key_hash


def _hash_key(key: str) -> str:
    """Hash an API key for storage/lookup."""
    return hashlib.sha256(key.encode()).hexdigest()


@router.get("/", response_model=List[ApiKeyResponse])
def list_api_keys(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """List all API keys for the current user."""
    keys = db.query(models.ApiKey).filter(
        models.ApiKey.user_id == current_user.id
    ).order_by(models.ApiKey.created_at.desc()).all()
    return keys


@router.post("/", response_model=ApiKeyCreated)
def create_api_key(
    key_data: ApiKeyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Create a new API key.
    The full key is returned ONCE in the response - save it immediately!
    """
    # Limit: Max 10 keys per user
    existing_count = db.query(models.ApiKey).filter(
        models.ApiKey.user_id == current_user.id
    ).count()
    if existing_count >= 10:
        raise HTTPException(status_code=400, detail="Maximum of 10 API keys allowed")
    
    # Generate key
    full_key, key_prefix, key_hash = _generate_api_key()
    
    # Calculate expiry
    expires_at = None
    if key_data.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=key_data.expires_in_days)
    
    # Create DB record
    db_key = models.ApiKey(
        user_id=current_user.id,
        name=key_data.name,
        key_prefix=key_prefix,
        key_hash=key_hash,
        scopes=key_data.scopes,
        expires_at=expires_at
    )
    db.add(db_key)
    db.commit()
    db.refresh(db_key)
    
    # Return with full key (only time it's shown!)
    return ApiKeyCreated(
        id=db_key.id,
        name=db_key.name,
        key=full_key,
        key_prefix=key_prefix,
        scopes=db_key.scopes,
        expires_at=db_key.expires_at
    )


@router.delete("/{key_id}")
def revoke_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Revoke (delete) an API key."""
    key = db.query(models.ApiKey).filter(
        models.ApiKey.id == key_id,
        models.ApiKey.user_id == current_user.id
    ).first()
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    db.delete(key)
    db.commit()
    return {"ok": True, "message": "API key revoked"}


@router.put("/{key_id}/toggle")
def toggle_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Toggle API key active status."""
    key = db.query(models.ApiKey).filter(
        models.ApiKey.id == key_id,
        models.ApiKey.user_id == current_user.id
    ).first()
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    key.is_active = not key.is_active
    db.commit()
    
    return {"ok": True, "is_active": key.is_active}


# ============================================
# API Key Authentication (for external use)
# ============================================

def get_user_by_api_key(
    api_key: str,
    db: Session
) -> Optional[models.User]:
    """
    Validate an API key and return the associated user.
    Updates last_used_at on successful validation.
    """
    if not api_key or not api_key.startswith("pk_"):
        return None
    
    key_hash = _hash_key(api_key)
    
    db_key = db.query(models.ApiKey).filter(
        models.ApiKey.key_hash == key_hash,
        models.ApiKey.is_active == True
    ).first()
    
    if not db_key:
        return None
    
    # Check expiry
    if db_key.expires_at and db_key.expires_at < datetime.utcnow():
        return None
    
    # Update last_used
    db_key.last_used_at = datetime.utcnow()
    db.commit()
    
    return db_key.user
