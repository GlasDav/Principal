from pydantic import BaseModel, EmailStr, field_validator
from typing import List, Optional
from datetime import datetime, date
import re
import html


def sanitize_text(value: Optional[str], max_length: int = 1000) -> Optional[str]:
    """
    Sanitize text input by escaping HTML entities to prevent XSS attacks.
    """
    if value is None:
        return None
    value = value.strip()
    if len(value) > max_length:
        value = value[:max_length]
    # Escape HTML entities
    return html.escape(value, quote=True)


# Tags
class TagBase(BaseModel):
    name: str
    
    @field_validator('name')
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        return sanitize_text(v, max_length=100) or ""

class TagCreate(TagBase):
    pass

class Tag(TagBase):
    id: int
    class Config:
        from_attributes = True

# Budget Limits (Forward declaration for buckets)
class BudgetLimitBase(BaseModel):
    member_id: Optional[int] = None  # None = shared limit for whole household
    amount: float

class BudgetLimitCreate(BudgetLimitBase):
    pass

class BudgetLimit(BudgetLimitBase):
    id: int
    bucket_id: int
    
    class Config:
        from_attributes = True

# BudgetBucket (Moved Up)
class BudgetBucketBase(BaseModel):
    name: str
    icon_name: str = "Wallet"
    group: str = "Discretionary"
    is_rollover: bool = False
    is_shared: bool = False  # Shared between household members
    is_group_budget: bool = False # If True, budget is set at group level
    is_transfer: bool = False  # Transfer buckets excluded from spending analytics
    is_investment: bool = False  # Investment buckets excluded from expenses but shown in Sankey
    is_hidden: bool = False  # Hidden from budget view
    tags: List[str] = []
    limits: List[BudgetLimitBase] = [] # New: Member Limits
    target_amount: Optional[float] = None
    target_date: Optional[date] = None
    parent_id: Optional[int] = None  # Hierarchy: reference to parent category
    display_order: int = 0  # For ordering within parent
    
    
    @field_validator('name', 'icon_name', 'group', mode='before')
    @classmethod
    def sanitize_text_fields(cls, v: str) -> str:
        # Only sanitize on input (when creating/updating buckets)
        # Don't re-escape when reading from database (prevents &amp; display bug)
        if isinstance(v, str):
            return sanitize_text(v, max_length=200) or ""
        return v or ""


class BudgetBucketCreate(BudgetBucketBase):
    pass

class BudgetBucket(BudgetBucketBase):
    id: int
    tags: List[Tag] = []
    data_class: str = "BudgetBucket"

    class Config:
        from_attributes = True

class BudgetBucketWithChildren(BudgetBucket):
    """Bucket with nested children for tree response."""
    children: List["BudgetBucketWithChildren"] = []

# Enable forward reference
BudgetBucketWithChildren.model_rebuild()

# Categorization Rules
class RuleBase(BaseModel):
    keywords: str
    bucket_id: int
    priority: int = 0
    min_amount: Optional[float] = None  # Optional: only match if amount >= min_amount
    max_amount: Optional[float] = None  # Optional: only match if amount <= max_amount
    apply_tags: Optional[str] = None # Optional: comma separated tags
    mark_for_review: bool = False
    assign_to: Optional[str] = None # Optional: family member name to assign
    
    @field_validator('keywords', 'apply_tags')
    @classmethod
    def sanitize_keywords(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=500) or ""

class RuleCreate(RuleBase):
    pass

class Rule(RuleBase):
    id: int
    user_id: str
    
    class Config:
        from_attributes = True

# Transaction
class TransactionBase(BaseModel):
    date: datetime
    description: str
    amount: float
    bucket_id: Optional[int] = None
    goal_id: Optional[int] = None
    spender: str = "Joint"
    external_id: Optional[str] = None
    account_id: Optional[int] = None
    tags: Optional[str] = None # New: Comma separated tags
    notes: Optional[str] = None # User notes
    
    @field_validator('description', 'spender', 'tags', 'notes')
    @classmethod
    def sanitize_text_fields(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=500) or ""

    @field_validator('external_id')
    @classmethod
    def sanitize_external_id(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=200) if v else None

class TransactionCreate(TransactionBase):
    raw_description: Optional[str] = None
    category_confidence: float = 0.0
    is_verified: bool = False
    
    @field_validator('raw_description')
    @classmethod
    def sanitize_raw_description(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=1000) if v else None

class TransactionSplitCreate(BaseModel):
    items: List[TransactionCreate]

class TransactionConfirm(BaseModel):
    id: int  # Negative for preview, positive for existing
    bucket_id: Optional[int] = None
    is_verified: bool = True
    spender: Optional[str] = None
    goal_id: Optional[int] = None
    assigned_to: Optional[str] = None  # For partner review: "A", "B", or None
    tags: Optional[str] = None # New: Tags
    # Fields required for creating new transactions from preview
    date: Optional[str] = None  # ISO date string
    description: Optional[str] = None
    raw_description: Optional[str] = None
    amount: Optional[float] = None
    transaction_hash: Optional[str] = None
    amount: Optional[float] = None
    transaction_hash: Optional[str] = None
    category_confidence: Optional[float] = None
    notes: Optional[str] = None
    
    @field_validator('description', 'raw_description', 'spender', 'assigned_to', 'tags', 'notes')
    @classmethod
    def sanitize_text_fields(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=500) if v else None

class TransactionUpdate(BaseModel):
    date: Optional[datetime] = None
    bucket_id: Optional[int] = None
    is_verified: Optional[bool] = None
    description: Optional[str] = None
    spender: Optional[str] = None
    goal_id: Optional[int] = None
    assigned_to: Optional[str] = None  # For partner review: "A", "B", or None
    parent_transaction_id: Optional[int] = None
    tags: Optional[str] = None
    notes: Optional[str] = None
    
    @field_validator('description', 'spender', 'tags', 'notes')
    @classmethod
    def sanitize_text_fields(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=500) if v else None
    
    @field_validator('assigned_to')
    @classmethod
    def handle_assigned_to(cls, v: Optional[str]) -> Optional[str]:
        # Preserve empty string so we can use it to clear the assignment
        # Empty string "" means "clear", None means "don't change"
        if v == '':
            return ''  # Preserve empty string for clearing
        return sanitize_text(v, max_length=500) if v else None

class Transaction(TransactionBase):
    id: int
    user_id: str
    raw_description: Optional[str] = None
    category_confidence: float = 0.0
    is_verified: bool = False
    assigned_to: Optional[str] = None  # For partner review: "A", "B", or None
    
    bucket: Optional[BudgetBucket] = None  # Relationship

    class Config:
        from_attributes = True

# User
class UserBase(BaseModel):
    email: EmailStr
    currency_symbol: str = "$"

class UserCreate(BaseModel):
    """Schema for user registration with validation."""
    email: EmailStr
    password: str
    name: Optional[str] = "You"
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one number')
        return v

class UserSettingsUpdate(BaseModel):
    currency_symbol: Optional[str] = None
    
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class User(UserBase):
    id: str
    name: Optional[str] = None
    created_at: Optional[datetime] = None
    buckets: List[BudgetBucket] = []
    
    @field_validator('id', mode='before')
    @classmethod
    def serialize_uuid(cls, v):
        """Convert UUID to string if needed"""
        if v is not None and not isinstance(v, str):
            return str(v)
        return v

    class Config:
        from_attributes = True

# Net Worth / Accounts
class AccountBase(BaseModel):
    name: str
    type: str
    category: str
    is_active: bool = True
    target_balance: Optional[float] = None
    target_date: Optional[date] = None
    connection_id: Optional[str] = None
    balance: Optional[float] = 0.0  # Added to support manual updates

class AccountCreate(AccountBase):
    pass

class Account(AccountBase):
    id: int
    class Config:
        from_attributes = True

class InvestmentHoldingBase(BaseModel):
    ticker: str
    name: str
    quantity: float
    price: float
    cost_basis: Optional[float] = None
    currency: str = "USD"
    exchange_rate: float = 1.0
    asset_type: str = "Stock"
    sector: Optional[str] = None

class InvestmentHoldingCreate(InvestmentHoldingBase):
    pass

class InvestmentHolding(InvestmentHoldingBase):
    id: int
    account_id: int
    value: float
    
    class Config:
        from_attributes = True

class AccountBalanceBase(BaseModel):
    account_id: int
    balance: float

class NetWorthSnapshotCreate(BaseModel):
    date: date
    balances: List[AccountBalanceBase]

class NetWorthSnapshot(BaseModel):
    id: int
    date: date
    total_assets: float
    total_liabilities: float
    net_worth: float
    balances: List[AccountBalanceBase] = []
    
    class Config:
        from_attributes = True

# Subscriptions
class SubscriptionBase(BaseModel):
    name: str
    amount: float
    type: str = "Expense" # "Expense" or "Income"
    frequency: str
    next_due_date: date
    is_active: bool = True
    description_keyword: Optional[str] = None
    bucket_id: Optional[int] = None
    parent_id: Optional[int] = None

class SubscriptionCreate(SubscriptionBase):
    pass

class SubscriptionUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    frequency: Optional[str] = None
    next_due_date: Optional[date] = None
    is_active: Optional[bool] = None
    description_keyword: Optional[str] = None
    bucket_id: Optional[int] = None
    parent_id: Optional[int] = None

class Subscription(SubscriptionBase):
    id: int
    user_id: str
    
    class Config:
        from_attributes = True

# Goals
class CategoryGoalBase(BaseModel):
    bucket_id: int
    target_amount: Optional[float] = None
    
class CategoryGoalCreate(CategoryGoalBase):
    pass

class CategoryGoal(CategoryGoalBase):
    id: int
    user_id: str
    start_date: date
    # Optional: include current streak or status in the schema if calculated on read?
    # Or keep it separate. Let's keep the base schema simple.
    
    class Config:
        from_attributes = True

class GoalBase(BaseModel):
    name: str
    target_amount: float
    target_date: Optional[date] = None
    linked_account_id: Optional[int] = None

class GoalCreate(GoalBase):
    pass

class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    target_date: Optional[date] = None
    linked_account_id: Optional[int] = None

class Goal(GoalBase):
    id: int
    user_id: str
    current_amount: Optional[float] = 0.0 # Computed field

    class Config:
        from_attributes = True

# Tax Settings
class TaxSettingsBase(BaseModel):
    filing_status: str = "Single"
    use_standard_deduction: bool = True
    custom_deduction: Optional[float] = 0.0
    state: str = "Federal"

class TaxSettingsUpdate(TaxSettingsBase):
    pass

class TaxSettings(TaxSettingsBase):
    id: int
    user_id: str
    
    class Config:
        from_attributes = True

class TaxBracket(BaseModel):
    rate: float
    min: float
    max: Optional[float]
    tax_for_bracket: float

class TaxEstimation(BaseModel):
    gross_income: float
    deduction: float
    taxable_income: float
    total_tax: float
    effective_rate: float
    marginal_rate: float
    brackets_breakdown: List[TaxBracket]


# Password Reset & Email Verification Schemas
class ForgotPasswordRequest(BaseModel):
    """Request schema for forgot password endpoint."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Request schema for password reset endpoint."""
    token: str
    new_password: str
    
    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one number')
        return v


class VerifyEmailRequest(BaseModel):
    """Request schema for email verification endpoint."""
    token: str


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str


class DeleteAccountRequest(BaseModel):
    """Request schema for account deletion - requires password confirmation."""
    password: str

# Household Members
class HouseholdMemberBase(BaseModel):
    name: str
    color: str = "#6366f1"
    avatar: str = "User"

    @field_validator('name', 'color', 'avatar')
    @classmethod
    def sanitize_member_fields(cls, v: str) -> str:
        return sanitize_text(v, max_length=50) or ""

class HouseholdMemberCreate(HouseholdMemberBase):
    pass

class HouseholdMember(HouseholdMemberBase):
    id: int
    user_id: str
    created_at: datetime
    
    @field_validator('user_id', mode='before')
    @classmethod
    def serialize_uuid(cls, v):
        """Convert UUID to string if needed"""
        if v is not None and not isinstance(v, str):
            return str(v)
        return v
    
    class Config:
        from_attributes = True

# Notifications
class NotificationBase(BaseModel):
    type: str
    message: str
    is_read: bool = False
    meta_data: Optional[str] = None

class NotificationCreate(NotificationBase):
    pass

class Notification(NotificationBase):
    id: int
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# Notification Settings
class NotificationSettingsBase(BaseModel):
    budget_alerts: bool = True
    bill_reminders: bool = True
    goal_milestones: bool = True
    bill_reminder_days: int = 3

class NotificationSettingsUpdate(NotificationSettingsBase):
    pass

class NotificationSettings(NotificationSettingsBase):
    id: int
    user_id: str
    
    class Config:
        from_attributes = True


# AI Chat
class ChatRequest(BaseModel):
    """Request schema for AI chat endpoint."""
    question: str
    
    @field_validator('question')
    @classmethod
    def sanitize_question(cls, v: str) -> str:
        return sanitize_text(v, max_length=500) or ""


class ChatResponse(BaseModel):
    """Response schema for AI chat endpoint."""
    answer: str
    data_points: Optional[List[dict]] = None
    suggestions: Optional[List[str]] = None


# Savings Opportunity
class SavingsOpportunity(BaseModel):
    """A savings opportunity suggestion."""
    category: str
    potential_savings: float
    message: str
    action: str
    severity: str = "medium"  # low, medium, high


# ============================================
# HOUSEHOLD / FAMILY SHARING SCHEMAS
# ============================================

class HouseholdBase(BaseModel):
    name: str = "My Household"
    
    @field_validator('name')
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        return sanitize_text(v, max_length=100) or "My Household"


class HouseholdCreate(HouseholdBase):
    pass


class Household(HouseholdBase):
    id: int
    created_at: datetime
    owner_id: Optional[int] = None
    
    class Config:
        from_attributes = True


class HouseholdUserBase(BaseModel):
    role: str = "member"  # "owner", "admin", "member"


class HouseholdUserResponse(HouseholdUserBase):
    id: int
    household_id: int
    user_id: str
    member_id: Optional[int] = None
    status: str
    invited_at: datetime
    joined_at: Optional[datetime] = None
    # Include user info for display
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class HouseholdInviteCreate(BaseModel):
    email: EmailStr
    role: str = "member"


class HouseholdInviteResponse(BaseModel):
    id: int
    email: str
    role: str
    expires_at: datetime
    created_at: datetime
    accepted_at: Optional[datetime] = None
    invited_by_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class HouseholdWithMembers(Household):
    """Full household info with members list."""
    members: List[HouseholdUserResponse] = []
    pending_invites: List[HouseholdInviteResponse] = []


class JoinHouseholdRequest(BaseModel):
    token: str


class UpdateMemberRoleRequest(BaseModel):
    role: str  # "admin" or "member" (can't change to owner)
    
    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ["admin", "member"]:
            raise ValueError("Role must be 'admin' or 'member'")
        return v

