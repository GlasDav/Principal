from pydantic import BaseModel, EmailStr, field_validator
from typing import List, Optional
from datetime import datetime, date
import re

# Tags
class TagBase(BaseModel):
    name: str

class TagCreate(TagBase):
    pass

class Tag(TagBase):
    id: int
    class Config:
        from_attributes = True

# BudgetBucket (Moved Up)
class BudgetBucketBase(BaseModel):
    name: str
    icon_name: str = "Wallet"
    monthly_limit_a: float = 0.0
    monthly_limit_b: float = 0.0
    is_shared: bool = False
    group: str = "Discretionary"
    is_rollover: bool = False
    is_transfer: bool = False  # Transfer buckets excluded from spending analytics
    tags: List[str] = []
    target_amount: Optional[float] = None
    target_date: Optional[date] = None

class BudgetBucketCreate(BudgetBucketBase):
    pass

class BudgetBucket(BudgetBucketBase):
    id: int
    tags: List[Tag] = []
    data_class: str = "BudgetBucket"

    class Config:
        from_attributes = True

# Categorization Rules
class RuleBase(BaseModel):
    keywords: str
    bucket_id: int
    priority: int = 0

class RuleCreate(RuleBase):
    pass

class Rule(RuleBase):
    id: int
    user_id: int
    
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

class TransactionCreate(TransactionBase):
    raw_description: Optional[str] = None
    category_confidence: float = 0.0
    is_verified: bool = False

class TransactionSplitCreate(BaseModel):
    items: List[TransactionCreate]

class TransactionConfirm(BaseModel):
    id: int
    bucket_id: Optional[int] = None
    is_verified: bool = True
    spender: Optional[str] = None
    goal_id: Optional[int] = None

class TransactionUpdate(BaseModel):
    bucket_id: Optional[int] = None
    is_verified: Optional[bool] = None
    description: Optional[str] = None
    spender: Optional[str] = None
    goal_id: Optional[int] = None
    parent_transaction_id: Optional[int] = None

class Transaction(TransactionBase):
    id: int
    user_id: int
    raw_description: Optional[str] = None
    category_confidence: float = 0.0
    is_verified: bool = False
    
    bucket: Optional[BudgetBucket] = None  # Relationship

    class Config:
        from_attributes = True

# User
class UserBase(BaseModel):
    email: EmailStr
    is_couple_mode: bool = False
    name_a: str = "You"
    name_b: str = "Partner"
    currency_symbol: str = "$"

class UserCreate(BaseModel):
    """Schema for user registration with validation."""
    email: EmailStr
    password: str
    
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
    is_couple_mode: Optional[bool] = None
    name_a: Optional[str] = None
    name_b: Optional[str] = None
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
    id: int
    buckets: List[BudgetBucket] = []

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

class SubscriptionBase(BaseModel):
    name: str
    amount: float
    frequency: str
    next_due_date: date
    is_active: bool = True
    description_keyword: Optional[str] = None

class SubscriptionCreate(SubscriptionBase):
    pass

class SubscriptionUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    frequency: Optional[str] = None
    next_due_date: Optional[date] = None
    is_active: Optional[bool] = None
    description_keyword: Optional[str] = None

class Subscription(SubscriptionBase):
    id: int
    user_id: int
    
    class Config:
        from_attributes = True

# Goals
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
    user_id: int
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
    user_id: int
    
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

