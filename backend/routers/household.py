"""
Household router for family sharing.
Manages household creation, member invites, and access control.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
import secrets
import hashlib

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(
    prefix="/household",
    tags=["household"],
)


def _generate_invite_token() -> tuple[str, str]:
    """Generate an invite token and its hash."""
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    return token, token_hash


def _hash_token(token: str) -> str:
    """Hash a token for lookup."""
    return hashlib.sha256(token.encode()).hexdigest()


def _ensure_user_has_household(user: models.User, db: Session) -> models.Household:
    """
    Ensure user has a household. Creates one if missing.
    This handles migration from single-user to household model.
    """
    if user.household_id:
        household = db.query(models.Household).filter(
            models.Household.id == user.household_id
        ).first()
        if household:
            return household
    
    # Create personal household
    household = models.Household(
        name=f"{user.name or user.email}'s Household",
        owner_id=user.id
    )
    db.add(household)
    db.flush()  # Get the ID
    
    # Link user to household
    user.household_id = household.id
    
    # Create HouseholdUser record
    hu = models.HouseholdUser(
        household_id=household.id,
        user_id=user.id,
        role="owner",
        status="active",
        joined_at=datetime.utcnow()
    )
    db.add(hu)
    db.commit()
    
    return household


@router.get("/", response_model=schemas.HouseholdWithMembers)
def get_household(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get current user's household with members and pending invites."""
    household = _ensure_user_has_household(current_user, db)
    
    # Get all household users with their user info
    household_users = db.query(models.HouseholdUser).filter(
        models.HouseholdUser.household_id == household.id,
        models.HouseholdUser.status == "active"
    ).all()
    
    members = []
    for hu in household_users:
        user = db.query(models.User).filter(models.User.id == hu.user_id).first()
        members.append(schemas.HouseholdUserResponse(
            id=hu.id,
            household_id=hu.household_id,
            user_id=hu.user_id,
            member_id=hu.member_id,
            role=hu.role,
            status=hu.status,
            invited_at=hu.invited_at,
            joined_at=hu.joined_at,
            user_email=user.email if user else None,
            user_name=user.name if user else None
        ))
    
    # Get pending invites
    invites = db.query(models.HouseholdInvite).filter(
        models.HouseholdInvite.household_id == household.id,
        models.HouseholdInvite.accepted_at == None,
        models.HouseholdInvite.expires_at > datetime.utcnow()
    ).all()
    
    pending_invites = []
    for inv in invites:
        inviter = db.query(models.User).filter(models.User.id == inv.invited_by_id).first()
        pending_invites.append(schemas.HouseholdInviteResponse(
            id=inv.id,
            email=inv.email,
            role=inv.role,
            expires_at=inv.expires_at,
            created_at=inv.created_at,
            accepted_at=inv.accepted_at,
            invited_by_name=inviter.name if inviter else None
        ))
    
    return schemas.HouseholdWithMembers(
        id=household.id,
        name=household.name,
        created_at=household.created_at,
        owner_id=household.owner_id,
        members=members,
        pending_invites=pending_invites
    )


@router.put("/", response_model=schemas.Household)
def update_household(
    data: schemas.HouseholdCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Update household name (owner/admin only)."""
    household = _ensure_user_has_household(current_user, db)
    
    # Check permissions
    hu = db.query(models.HouseholdUser).filter(
        models.HouseholdUser.household_id == household.id,
        models.HouseholdUser.user_id == current_user.id
    ).first()
    
    if not hu or hu.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owner or admin can update household")
    
    print(f"[DEBUG] Updating household {household.id} name from '{household.name}' to '{data.name}'")
    household.name = data.name
    db.commit()
    db.refresh(household)
    print(f"[DEBUG] Household name after save: '{household.name}'")
    
    return household


@router.post("/invite", response_model=schemas.HouseholdInviteResponse)
def invite_member(
    invite: schemas.HouseholdInviteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Invite a new member to the household by email.
    Returns the invite details (token sent via email in production).
    """
    household = _ensure_user_has_household(current_user, db)
    
    # Check permissions
    hu = db.query(models.HouseholdUser).filter(
        models.HouseholdUser.household_id == household.id,
        models.HouseholdUser.user_id == current_user.id
    ).first()
    
    if not hu or hu.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owner or admin can invite members")
    
    # Check if user already in household
    existing_user = db.query(models.User).filter(models.User.email == invite.email).first()
    if existing_user and existing_user.household_id == household.id:
        raise HTTPException(status_code=400, detail="User is already a member of this household")
    
    # Check for existing pending invite
    existing_invite = db.query(models.HouseholdInvite).filter(
        models.HouseholdInvite.household_id == household.id,
        models.HouseholdInvite.email == invite.email,
        models.HouseholdInvite.accepted_at == None,
        models.HouseholdInvite.expires_at > datetime.utcnow()
    ).first()
    
    if existing_invite:
        raise HTTPException(status_code=400, detail="Invite already pending for this email")
    
    # Create invite
    token, token_hash = _generate_invite_token()
    
    db_invite = models.HouseholdInvite(
        household_id=household.id,
        email=invite.email,
        token_hash=token_hash,
        role=invite.role,
        expires_at=datetime.utcnow() + timedelta(days=7),
        invited_by_id=current_user.id
    )
    db.add(db_invite)
    db.commit()
    db.refresh(db_invite)
    
    # TODO: In production, send email with invite link containing token
    # For now, we'll return the token in the response for testing
    print(f"[DEV] Household invite token for {invite.email}: {token}")
    
    return schemas.HouseholdInviteResponse(
        id=db_invite.id,
        email=db_invite.email,
        role=db_invite.role,
        expires_at=db_invite.expires_at,
        created_at=db_invite.created_at,
        accepted_at=db_invite.accepted_at,
        invited_by_name=current_user.name
    )


@router.post("/join")
def join_household(
    request: schemas.JoinHouseholdRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Accept an invite and join a household.
    User's data remains in their old household (if any).
    """
    token_hash = _hash_token(request.token)
    
    # Find invite
    invite = db.query(models.HouseholdInvite).filter(
        models.HouseholdInvite.token_hash == token_hash,
        models.HouseholdInvite.accepted_at == None,
        models.HouseholdInvite.expires_at > datetime.utcnow()
    ).first()
    
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid or expired invite")
    
    # Verify email matches
    if invite.email.lower() != current_user.email.lower():
        raise HTTPException(status_code=400, detail="Invite is for a different email address")
    
    # Check if user already in this household
    if current_user.household_id == invite.household_id:
        raise HTTPException(status_code=400, detail="Already a member of this household")
    
    # Leave old household if any (but keep data there)
    if current_user.household_id:
        old_hu = db.query(models.HouseholdUser).filter(
            models.HouseholdUser.household_id == current_user.household_id,
            models.HouseholdUser.user_id == current_user.id
        ).first()
        if old_hu:
            db.delete(old_hu)
    
    # Join new household
    current_user.household_id = invite.household_id
    
    # Create HouseholdUser record
    hu = models.HouseholdUser(
        household_id=invite.household_id,
        user_id=current_user.id,
        role=invite.role,
        status="active",
        joined_at=datetime.utcnow()
    )
    db.add(hu)
    
    # Mark invite as accepted
    invite.accepted_at = datetime.utcnow()
    
    db.commit()
    
    household = db.query(models.Household).filter(models.Household.id == invite.household_id).first()
    
    return {
        "ok": True,
        "message": f"Successfully joined {household.name}",
        "household_id": household.id
    }


@router.delete("/members/{user_id}")
def remove_member(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Remove a member from the household (owner only)."""
    household = _ensure_user_has_household(current_user, db)
    
    # Check permissions - only owner can remove
    hu = db.query(models.HouseholdUser).filter(
        models.HouseholdUser.household_id == household.id,
        models.HouseholdUser.user_id == current_user.id
    ).first()
    
    if not hu or hu.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can remove members")
    
    # Can't remove yourself as owner
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself. Transfer ownership first.")
    
    # Find target user's membership
    target_hu = db.query(models.HouseholdUser).filter(
        models.HouseholdUser.household_id == household.id,
        models.HouseholdUser.user_id == user_id
    ).first()
    
    if not target_hu:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Remove from household
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if target_user:
        target_user.household_id = None
    
    db.delete(target_hu)
    db.commit()
    
    return {"ok": True, "message": "Member removed"}


@router.put("/members/{user_id}/role")
def update_member_role(
    user_id: int,
    request: schemas.UpdateMemberRoleRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Update a member's role (owner only)."""
    household = _ensure_user_has_household(current_user, db)
    
    # Check permissions - only owner can change roles
    hu = db.query(models.HouseholdUser).filter(
        models.HouseholdUser.household_id == household.id,
        models.HouseholdUser.user_id == current_user.id
    ).first()
    
    if not hu or hu.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can change roles")
    
    # Can't change own role
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    
    # Find target
    target_hu = db.query(models.HouseholdUser).filter(
        models.HouseholdUser.household_id == household.id,
        models.HouseholdUser.user_id == user_id
    ).first()
    
    if not target_hu:
        raise HTTPException(status_code=404, detail="Member not found")
    
    target_hu.role = request.role
    db.commit()
    
    return {"ok": True, "message": f"Role updated to {request.role}"}


@router.delete("/invites/{invite_id}")
def cancel_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Cancel a pending invite."""
    household = _ensure_user_has_household(current_user, db)
    
    invite = db.query(models.HouseholdInvite).filter(
        models.HouseholdInvite.id == invite_id,
        models.HouseholdInvite.household_id == household.id
    ).first()
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    db.delete(invite)
    db.commit()
    
    return {"ok": True, "message": "Invite cancelled"}


@router.post("/leave")
def leave_household(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Leave the current household.
    Owner cannot leave - must transfer ownership first.
    Creates a new personal household for the leaving user.
    """
    if not current_user.household_id:
        raise HTTPException(status_code=400, detail="Not in a household")
    
    household = db.query(models.Household).filter(
        models.Household.id == current_user.household_id
    ).first()
    
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    
    # Check if owner
    if household.owner_id == current_user.id:
        raise HTTPException(
            status_code=400, 
            detail="Owner cannot leave. Transfer ownership first or remove all other members."
        )
    
    # Remove membership
    hu = db.query(models.HouseholdUser).filter(
        models.HouseholdUser.household_id == household.id,
        models.HouseholdUser.user_id == current_user.id
    ).first()
    
    if hu:
        db.delete(hu)
    
    # Clear household_id - new personal household created on next request
    current_user.household_id = None
    db.commit()
    
    return {"ok": True, "message": "Left household successfully"}
