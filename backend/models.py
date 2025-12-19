from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float, DateTime, Date, LargeBinary, Table
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True) # Renamed from username, now Email
    hashed_password = Column(String) # New: Auth
    is_couple_mode = Column(Boolean, default=False)
    name_a = Column(String, default="You")
    name_b = Column(String, default="Partner")
    currency_symbol = Column(String, default="AUD") # Default: AUD
    
    buckets = relationship("BudgetBucket", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    tax_settings = relationship("TaxSettings", back_populates="user", uselist=False)

class BudgetBucket(Base):
    __tablename__ = "budget_buckets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    icon_name = Column(String, default="Wallet") # New: Lucide icon name
    user_id = Column(Integer, ForeignKey("users.id"))
    monthly_limit_a = Column(Float, default=0.0) # For Individual or Partner A
    monthly_limit_b = Column(Float, default=0.0) # For Partner B (if couple)
    is_shared = Column(Boolean, default=False)
    is_rollover = Column(Boolean, default=False) # New: Sinking Funds
    group = Column(String, default="Discretionary") # 'Discretionary' (Wants) or 'Non-Discretionary' (Needs)
    
    # Goal Fields
    target_amount = Column(Float, nullable=True)
    target_date = Column(Date, nullable=True)
    
    user = relationship("User", back_populates="buckets")
    transactions = relationship("Transaction", back_populates="bucket")
    tags = relationship("Tag", secondary="bucket_tags", back_populates="buckets")

class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    
    buckets = relationship("BudgetBucket", secondary="bucket_tags", back_populates="tags")

# Association Table
bucket_tags = Table(
    "bucket_tags",
    Base.metadata,
    Column("bucket_id", Integer, ForeignKey("budget_buckets.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True)
)

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, index=True)
    description = Column(String) # Final "Display Name"
    raw_description = Column(String) # Original bank text
    amount = Column(Float)
    
    # Categorization Metadata
    category_confidence = Column(Float, default=0.0)
    is_verified = Column(Boolean, default=False)
    
    bucket_id = Column(Integer, ForeignKey("budget_buckets.id"), nullable=True) # Nullable until categorized
    user_id = Column(Integer, ForeignKey("users.id"))
    
    parent_transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True) # Split Logic
    
    
    spender = Column(String, default="Joint")
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=True) # New: Goal Tracking
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True) # Linked Bank Account
    external_id = Column(String, unique=True, nullable=True) # Basiq Transaction ID
    
    account = relationship("Account")

    bucket = relationship("BudgetBucket", back_populates="transactions")
    goal = relationship("Goal", back_populates="transactions")
    user = relationship("User", back_populates="transactions")
    children = relationship("Transaction", backref=backref("parent", remote_side=[id]))

class Account(Base):
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id")) # New: Auth
    name = Column(String, index=True)
    type = Column(String) # "Asset" or "Liability"
    category = Column(String) # e.g. "Cash", "Investment", "Real Estate", "Credit Card"
    is_active = Column(Boolean, default=True)
    connection_id = Column(String, nullable=True) # Basiq Connection/User ID
    
    # Goal Fields
    target_balance = Column(Float, nullable=True)
    target_date = Column(Date, nullable=True)
    
    user = relationship("User") # Relationship
    holdings = relationship("InvestmentHolding", back_populates="account")

class InvestmentHolding(Base):
    __tablename__ = "investment_holdings"
    
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"))
    ticker = Column(String) # e.g. "AAPL"
    name = Column(String)
    quantity = Column(Float)
    price = Column(Float)
    cost_basis = Column(Float, nullable=True)
    currency = Column(String, default="AUD") # Default to AUD for holdings too? Maybe too aggressive, but safer for AU market.
    exchange_rate = Column(Float, default=1.0)
    value = Column(Float) # quantity * price * exchange_rate (cached)
    
    account = relationship("Account", back_populates="holdings")

class NetWorthSnapshot(Base):
    __tablename__ = "net_worth_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id")) # New: Auth
    date = Column(Date, index=True) # First of the month
    total_assets = Column(Float)
    total_liabilities = Column(Float)
    net_worth = Column(Float)
    
    balances = relationship("AccountBalance", back_populates="snapshot")

class AccountBalance(Base):
    __tablename__ = "account_balances"
    
    snapshot_id = Column(Integer, ForeignKey("net_worth_snapshots.id"), primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), primary_key=True)
    balance = Column(Float)
    
    snapshot = relationship("NetWorthSnapshot", back_populates="balances")
    account = relationship("Account")

class CategorizationRule(Base):
    __tablename__ = "categorization_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    bucket_id = Column(Integer, ForeignKey("budget_buckets.id"))
    keywords = Column(String) # Comma separated or regex
    priority = Column(Integer, default=0) # Higher executes first
    
    user = relationship("User")
    bucket = relationship("BudgetBucket")



class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, index=True)
    target_amount = Column(Float)
    target_date = Column(Date, nullable=True)
    linked_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True) # Linked mode

    user = relationship("User")
    linked_account = relationship("Account")
    transactions = relationship("Transaction", back_populates="goal")

class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, index=True)
    amount = Column(Float)
    frequency = Column(String) # Monthly, Weekly, Yearly
    next_due_date = Column(Date)
    is_active = Column(Boolean, default=True)
    description_keyword = Column(String, nullable=True) # For auto-matching transactions
    
    user = relationship("User")

class TaxSettings(Base):
    __tablename__ = "tax_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    filing_status = Column(String, default="Resident") # "Resident" or "Non-Resident"
    use_standard_deduction = Column(Boolean, default=False)
    custom_deduction = Column(Float, default=0.0)
    state = Column(String, default="VIC") # Placeholder for state tax (not really applicable in AU like US, but keep field)
    
    user = relationship("User", back_populates="tax_settings")

# Update User relationship below (handled via back_populates)

