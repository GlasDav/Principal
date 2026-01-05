"""
Seed Demo User with Realistic Data

This script creates a demo account with:
- 12+ months of realistic transaction data (~800-1000 transactions)
- Hierarchical budget categories with limits
- Multiple accounts (bank, investment, super, liability)
- Investment holdings
- Goals at various progress levels
- Subscriptions
- Smart rules

Usage:
    python -m scripts.seed_demo_user
"""

import random
from datetime import datetime, timedelta
from decimal import Decimal
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine
from backend import models
from backend.auth import get_password_hash

# Demo user credentials
DEMO_EMAIL = "demo@principal.finance"
DEMO_PASSWORD = "demo123"
DEMO_NAME = "Demo User"

# Household members
MEMBERS = [
    {"name": "Alex", "color": "#6366f1"},  # Indigo
    {"name": "Sam", "color": "#ec4899"},   # Pink
]

# Hierarchical budget categories
CATEGORIES = [
    # Income
    {"name": "Income", "icon": "Wallet", "group": "Income", "is_shared": True, "children": [
        {"name": "Salary", "icon": "Briefcase", "limit": 0},
        {"name": "Side Income", "icon": "DollarSign", "limit": 0},
        {"name": "Investment Income", "icon": "TrendingUp", "limit": 0},
    ]},
    # Non-Discretionary (Needs)
    {"name": "Housing", "icon": "Home", "group": "Non-Discretionary", "is_shared": True, "children": [
        {"name": "Rent/Mortgage", "icon": "Home", "limit": 2800},
        {"name": "Strata/HOA", "icon": "Building", "limit": 400},
        {"name": "Home Insurance", "icon": "Shield", "limit": 100},
    ]},
    {"name": "Utilities", "icon": "Zap", "group": "Non-Discretionary", "is_shared": True, "children": [
        {"name": "Electricity", "icon": "Zap", "limit": 150},
        {"name": "Gas", "icon": "Flame", "limit": 80},
        {"name": "Water", "icon": "Droplet", "limit": 60},
        {"name": "Internet", "icon": "Wifi", "limit": 90},
        {"name": "Mobile Phone", "icon": "Smartphone", "limit": 120},
    ]},
    {"name": "Groceries", "icon": "ShoppingCart", "group": "Non-Discretionary", "is_shared": True, "limit": 1200},
    {"name": "Transport", "icon": "Car", "group": "Non-Discretionary", "is_shared": False, "children": [
        {"name": "Fuel", "icon": "Fuel", "limit": 200},
        {"name": "Public Transport", "icon": "Train", "limit": 150},
        {"name": "Car Insurance", "icon": "Shield", "limit": 120},
        {"name": "Parking", "icon": "ParkingCircle", "limit": 80},
    ]},
    {"name": "Health", "icon": "Heart", "group": "Non-Discretionary", "is_shared": False, "children": [
        {"name": "Health Insurance", "icon": "Shield", "limit": 280},
        {"name": "Doctor/Medical", "icon": "Stethoscope", "limit": 100},
        {"name": "Pharmacy", "icon": "Pill", "limit": 50},
        {"name": "Gym", "icon": "Dumbbell", "limit": 100},
    ]},
    # Discretionary (Wants)
    {"name": "Food & Drink", "icon": "Utensils", "group": "Discretionary", "is_shared": False, "children": [
        {"name": "Dining Out", "icon": "UtensilsCrossed", "limit": 400},
        {"name": "Coffee & Cafes", "icon": "Coffee", "limit": 150},
        {"name": "Takeaway", "icon": "Package", "limit": 200},
        {"name": "Alcohol", "icon": "Wine", "limit": 100},
    ]},
    {"name": "Entertainment", "icon": "Film", "group": "Discretionary", "is_shared": True, "children": [
        {"name": "Streaming", "icon": "Tv", "limit": 60},
        {"name": "Gaming", "icon": "Gamepad2", "limit": 50},
        {"name": "Movies & Events", "icon": "Ticket", "limit": 100},
        {"name": "Hobbies", "icon": "Palette", "limit": 150},
    ]},
    {"name": "Shopping", "icon": "ShoppingBag", "group": "Discretionary", "is_shared": False, "children": [
        {"name": "Clothing", "icon": "Shirt", "limit": 200},
        {"name": "Electronics", "icon": "Laptop", "limit": 100},
        {"name": "Home & Garden", "icon": "Sofa", "limit": 150},
        {"name": "Gifts", "icon": "Gift", "limit": 100},
    ]},
    {"name": "Travel", "icon": "Plane", "group": "Discretionary", "is_shared": True, "limit": 500},
    {"name": "Personal Care", "icon": "Sparkles", "group": "Discretionary", "is_shared": False, "limit": 150},
    {"name": "Education", "icon": "GraduationCap", "group": "Discretionary", "is_shared": False, "limit": 100},
    {"name": "Pets", "icon": "Cat", "group": "Discretionary", "is_shared": True, "limit": 200},
    # Special Categories
    {"name": "Reimbursable", "icon": "ReceiptText", "group": "Non-Discretionary", "is_shared": False, "limit": 0},
    # Transfers
    {"name": "Transfers", "icon": "ArrowRightLeft", "group": "Transfers", "is_shared": True, "is_transfer": True},
    {"name": "Investments", "icon": "TrendingUp", "group": "Transfers", "is_shared": True, "is_investment": True},
]

# Realistic merchants for transactions
MERCHANTS = {
    "Salary": [("SALARY DEPOSIT - ACME CORP", -6500), ("SALARY DEPOSIT - ACME CORP", -6500)],
    "Side Income": [("FREELANCE PAYMENT", -500), ("ETSY DEPOSIT", -150), ("AIRTASKER", -200)],
    "Rent/Mortgage": [("MORTGAGE PAYMENT - ANZ", 2800)],
    "Strata/HOA": [("STRATA LEVY Q3", 1200)],
    "Electricity": [("ORIGIN ENERGY", 120), ("AGL ELECTRICITY", 150), ("ENERGYAUSTRALIA", 180)],
    "Gas": [("ORIGIN GAS", 60), ("AGL GAS", 80)],
    "Water": [("SYDNEY WATER", 180)],
    "Internet": [("AUSSIE BROADBAND", 89), ("OPTUS INTERNET", 79)],
    "Mobile Phone": [("TELSTRA MOBILE", 65), ("OPTUS MOBILE", 55), ("VODAFONE", 45)],
    "Groceries": [("WOOLWORTHS", 85), ("WOOLWORTHS", 120), ("COLES", 95), ("COLES", 145), 
                  ("ALDI", 75), ("ALDI", 110), ("HARRIS FARM", 45), ("IGA", 35)],
    "Fuel": [("BP FUEL", 65), ("SHELL", 72), ("CALTEX", 58), ("7-ELEVEN FUEL", 45)],
    "Public Transport": [("OPAL TOPUP", 50), ("OPAL AUTOLOAD", 40)],
    "Car Insurance": [("NRMA INSURANCE", 120)],
    "Parking": [("WILSON PARKING", 25), ("SECURE PARKING", 18), ("COUNCIL PARKING", 8)],
    "Health Insurance": [("MEDIBANK PRIVATE", 280), ("BUPA HEALTH", 265)],
    "Doctor/Medical": [("DR SMITH MEDICAL", 85), ("PATHOLOGY AUSTRALIA", 45), ("RADIOLOGY CLINIC", 120)],
    "Pharmacy": [("CHEMIST WAREHOUSE", 35), ("PRICELINE PHARMACY", 28), ("TERRY WHITE", 42)],
    "Gym": [("ANYTIME FITNESS", 55), ("FITNESS FIRST", 75), ("F45 TRAINING", 65)],
    "Dining Out": [("THAI ORCHID RESTAURANT", 65), ("DOMINOS PIZZA", 35), ("SUSHI HUB", 28),
                   ("PANCAKES ON THE ROCKS", 55), ("BILLS CAFE", 85), ("CHIN CHIN", 120)],
    "Coffee & Cafes": [("STARBUCKS", 8), ("CAMPOS COFFEE", 6), ("THE GROUNDS", 12), ("MECCA COFFEE", 5)],
    "Takeaway": [("UBER EATS", 35), ("DOORDASH", 42), ("MENULOG", 28), ("DELIVEROO", 38)],
    "Alcohol": [("DAN MURPHYS", 55), ("BWS", 35), ("VINTAGE CELLARS", 75)],
    "Streaming": [("NETFLIX", 23), ("SPOTIFY", 13), ("DISNEY PLUS", 14), ("STAN", 16)],
    "Gaming": [("STEAM", 25), ("PLAYSTATION", 30), ("XBOX GAME PASS", 16)],
    "Movies & Events": [("EVENT CINEMAS", 42), ("HOYTS", 38), ("TICKETEK", 150)],
    "Hobbies": [("SPOTLIGHT", 45), ("JB HI-FI", 89), ("BUNNINGS", 120)],
    "Clothing": [("UNIQLO", 85), ("ZARA", 120), ("COTTON ON", 55), ("H&M", 75), ("MYER", 150)],
    "Electronics": [("JB HI-FI", 299), ("OFFICEWORKS", 85), ("APPLE STORE", 150)],
    "Home & Garden": [("IKEA", 180), ("BUNNINGS", 95), ("KMART", 55), ("TARGET", 75)],
    "Gifts": [("MYER", 85), ("DAVID JONES", 120), ("AMAZON", 65)],
    "Travel": [("QANTAS", 450), ("VIRGIN AUSTRALIA", 320), ("BOOKING.COM", 580), ("AIRBNB", 420)],
    "Personal Care": [("MECCA", 85), ("SEPHORA", 65), ("HAIRHOUSE", 95)],
    "Education": [("UDEMY", 25), ("COURSERA", 49), ("SKILLSHARE", 15)],
    "Pets": [("PETBARN", 85), ("PET CIRCLE", 65), ("VET CLINIC", 180)],
    "Transfers": [("TRANSFER TO SAVINGS", 500), ("TRANSFER TO JOINT", 1000)],
    "Investments": [("COMMSEC PURCHASE", 500), ("STAKE DEPOSIT", 250)],
}

# Accounts
ACCOUNTS = [
    {"name": "Everyday Account", "type": "Asset", "category": "Cash", "balance": 5500},
    {"name": "Savings Account", "type": "Asset", "category": "Savings", "balance": 45000},
    {"name": "Joint Account", "type": "Asset", "category": "Cash", "balance": 8200},
    {"name": "Investment Portfolio", "type": "Asset", "category": "Investment", "balance": 85000},
    {"name": "Superannuation", "type": "Asset", "category": "Superannuation", "balance": 120000},
    {"name": "Home Loan", "type": "Liability", "category": "Mortgage", "balance": 450000},
]

# Investment holdings
HOLDINGS = [
    {"ticker": "VAS.AX", "name": "Vanguard Australian Shares ETF", "quantity": 150, "price": 90.00, "cost_basis": 85.50},
    {"ticker": "VGS.AX", "name": "Vanguard MSCI Index International", "quantity": 120, "price": 100.00, "cost_basis": 95.00},
    {"ticker": "AAPL", "name": "Apple Inc.", "quantity": 25, "price": 192.00, "cost_basis": 175.00, "currency": "USD"},
    {"ticker": "MSFT", "name": "Microsoft Corporation", "quantity": 15, "price": 413.00, "cost_basis": 380.00, "currency": "USD"},
    {"ticker": "BHP.AX", "name": "BHP Group Limited", "quantity": 100, "price": 45.00, "cost_basis": 42.50},
    {"ticker": "CBA.AX", "name": "Commonwealth Bank", "quantity": 40, "price": 120.00, "cost_basis": 115.00},
    {"ticker": "A200.AX", "name": "BetaShares Australia 200 ETF", "quantity": 200, "price": 135.00, "cost_basis": 130.00},
    {"ticker": "NDQ.AX", "name": "BetaShares NASDAQ 100 ETF", "quantity": 80, "price": 40.00, "cost_basis": 38.00},
]

# Goals
GOALS = [
    {"name": "Emergency Fund", "target_amount": 45000, "current": 36000},  # 80%
    {"name": "Japan Holiday 2026", "target_amount": 6000, "current": 2700},  # 45%
    {"name": "New Car Fund", "target_amount": 50000, "current": 7500},  # 15%
    {"name": "House Deposit", "target_amount": 100000, "current": 45000},  # 45%
]

# Subscriptions (recurring)
SUBSCRIPTIONS = [
    {"name": "Netflix", "amount": 22.99, "frequency": "monthly", "category": "Streaming"},
    {"name": "Spotify Family", "amount": 18.99, "frequency": "monthly", "category": "Streaming"},
    {"name": "Disney+", "amount": 13.99, "frequency": "monthly", "category": "Streaming"},
    {"name": "Anytime Fitness", "amount": 54.95, "frequency": "monthly", "category": "Gym"},
    {"name": "iCloud Storage", "amount": 4.49, "frequency": "monthly", "category": "Electronics"},
    {"name": "Amazon Prime", "amount": 79.00, "frequency": "yearly", "category": "Shopping"},
    {"name": "NRMA Roadside", "amount": 189.00, "frequency": "yearly", "category": "Car Insurance"},
    {"name": "Medibank Private", "amount": 280.00, "frequency": "monthly", "category": "Health Insurance"},
]

# Smart Rules
RULES = [
    {"keyword": "woolworths", "category": "Groceries"},
    {"keyword": "coles", "category": "Groceries"},
    {"keyword": "aldi", "category": "Groceries"},
    {"keyword": "uber eats", "category": "Takeaway"},
    {"keyword": "netflix", "category": "Streaming"},
    {"keyword": "spotify", "category": "Streaming"},
    {"keyword": "bp", "category": "Fuel"},
    {"keyword": "shell", "category": "Fuel"},
    {"keyword": "opal", "category": "Public Transport"},
    {"keyword": "starbucks", "category": "Coffee & Cafes"},
    {"keyword": "salary", "category": "Salary"},
    {"keyword": "dan murphy", "category": "Alcohol"},
    {"keyword": "bunnings", "category": "Home & Garden"},
]


def clear_demo_user(db: Session):
    """Remove existing demo user and all related data."""
    user = db.query(models.User).filter(models.User.email == DEMO_EMAIL).first()
    if user:
        print(f"Removing existing demo user (ID: {user.id})...")
        # Delete related data (cascade should handle most, but be explicit)
        db.query(models.Transaction).filter(models.Transaction.user_id == user.id).delete()
        db.query(models.BudgetBucket).filter(models.BudgetBucket.user_id == user.id).delete()
        db.query(models.Account).filter(models.Account.user_id == user.id).delete()
        db.query(models.Goal).filter(models.Goal.user_id == user.id).delete()
        db.query(models.Subscription).filter(models.Subscription.user_id == user.id).delete()
        db.query(models.CategorizationRule).filter(models.CategorizationRule.user_id == user.id).delete()
        db.query(models.HouseholdMember).filter(models.HouseholdMember.user_id == user.id).delete()
        db.query(models.NetWorthSnapshot).filter(models.NetWorthSnapshot.user_id == user.id).delete()
        db.delete(user)
        db.commit()
        print("Existing demo user removed.")


def create_demo_user(db: Session) -> models.User:
    """Create the demo user account."""
    print("Creating demo user...")
    user = models.User(
        email=DEMO_EMAIL,
        hashed_password=get_password_hash(DEMO_PASSWORD),
        name=DEMO_NAME,
        currency_symbol="$",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"Created demo user: {DEMO_EMAIL} (ID: {user.id})")
    return user


def create_members(db: Session, user_id: int) -> list:
    """Create household members."""
    print("Creating household members...")
    members = []
    for m in MEMBERS:
        member = models.HouseholdMember(
            user_id=user_id,
            name=m["name"],
            color=m["color"],
        )
        db.add(member)
        members.append(member)
    db.commit()
    for m in members:
        db.refresh(m)
    print(f"Created {len(members)} household members")
    return members


def create_categories(db: Session, user_id: int) -> dict:
    """Create hierarchical budget categories. Returns dict mapping name to bucket."""
    print("Creating budget categories...")
    bucket_map = {}
    display_order = 0
    
    for cat in CATEGORIES:
        # Create parent category
        parent = models.BudgetBucket(
            user_id=user_id,
            name=cat["name"],
            icon_name=cat.get("icon", "Wallet"),
            group=cat.get("group", "Discretionary"),
            is_shared=cat.get("is_shared", False),
            is_transfer=cat.get("is_transfer", False),
            is_investment=cat.get("is_investment", False),
            display_order=display_order,
        )
        db.add(parent)
        db.commit()
        db.refresh(parent)
        bucket_map[cat["name"]] = parent
        display_order += 1
        
        # Create children if any
        if "children" in cat:
            child_order = 0
            for child in cat["children"]:
                child_bucket = models.BudgetBucket(
                    user_id=user_id,
                    name=child["name"],
                    icon_name=child.get("icon", "Circle"),
                    group=cat.get("group", "Discretionary"),
                    is_shared=cat.get("is_shared", False),
                    parent_id=parent.id,
                    display_order=child_order,
                )
                db.add(child_bucket)
                db.commit()
                db.refresh(child_bucket)
                bucket_map[child["name"]] = child_bucket
                child_order += 1
                
                # Add budget limit if specified
                if child.get("limit", 0) > 0:
                    # Add limit (will be shared between members in couple mode)
                    limit = models.BudgetLimit(
                        bucket_id=child_bucket.id,
                        member_id=None,  # Shared limit
                        amount=child["limit"],
                    )
                    db.add(limit)
        
        # Add limit for parent if no children but has limit
        if "limit" in cat and cat["limit"] > 0 and "children" not in cat:
            limit = models.BudgetLimit(
                bucket_id=parent.id,
                member_id=None,
                amount=cat["limit"],
            )
            db.add(limit)
    
    db.commit()
    print(f"Created {len(bucket_map)} budget categories")
    return bucket_map


def create_accounts(db: Session, user_id: int) -> dict:
    """Create bank and investment accounts."""
    print("Creating accounts...")
    account_map = {}
    
    for acc in ACCOUNTS:
        account = models.Account(
            user_id=user_id,
            name=acc["name"],
            type=acc["type"],
            category=acc["category"],
            balance=acc["balance"],
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        account_map[acc["name"]] = account
    
    print(f"Created {len(account_map)} accounts")
    return account_map


def create_holdings(db: Session, investment_account_id: int):
    """Create investment holdings."""
    print("Creating investment holdings...")
    
    for h in HOLDINGS:
        exchange_rate = 1.55 if h.get("currency") == "USD" else 1.0
        value = h["quantity"] * h["price"] * exchange_rate
        
        holding = models.InvestmentHolding(
            account_id=investment_account_id,
            ticker=h["ticker"],
            name=h["name"],
            quantity=h["quantity"],
            price=h["price"],
            cost_basis=h.get("cost_basis"),
            value=value,
            currency=h.get("currency", "AUD"),
            exchange_rate=exchange_rate,
        )
        db.add(holding)
    
    db.commit()
    print(f"Created {len(HOLDINGS)} investment holdings")


def create_goals(db: Session, user_id: int, savings_account_id: int):
    """Create savings goals."""
    print("Creating goals...")
    
    for g in GOALS:
        # Set target date based on progress
        progress = g["current"] / g["target_amount"]
        if progress >= 0.8:
            target_date = datetime.now() + timedelta(days=90)
        elif progress >= 0.4:
            target_date = datetime.now() + timedelta(days=365)
        else:
            target_date = datetime.now() + timedelta(days=730)
        
        goal = models.Goal(
            user_id=user_id,
            name=g["name"],
            target_amount=g["target_amount"],
            target_date=target_date.date(),
            linked_account_id=savings_account_id,
        )
        db.add(goal)
    
    db.commit()
    print(f"Created {len(GOALS)} goals")


def create_subscriptions(db: Session, user_id: int, bucket_map: dict):
    """Create subscription records."""
    print("Creating subscriptions...")
    
    for sub in SUBSCRIPTIONS:
        bucket = bucket_map.get(sub["category"])
        subscription = models.Subscription(
            user_id=user_id,
            name=sub["name"],
            amount=sub["amount"],
            frequency=sub["frequency"],
            bucket_id=bucket.id if bucket else None,
            next_due_date=(datetime.now() + timedelta(days=random.randint(1, 30))).date(),
            is_active=True,
        )
        db.add(subscription)
    
    db.commit()
    print(f"Created {len(SUBSCRIPTIONS)} subscriptions")


def create_rules(db: Session, user_id: int, bucket_map: dict):
    """Create smart categorization rules."""
    print("Creating smart rules...")
    priority = 0
    
    for rule in RULES:
        bucket = bucket_map.get(rule["category"])
        if bucket:
            db_rule = models.CategorizationRule(
                user_id=user_id,
                bucket_id=bucket.id,
                keywords=rule["keyword"],
                priority=priority,
            )
            db.add(db_rule)
            priority += 1
    
    db.commit()
    print(f"Created {len(RULES)} smart rules")


def generate_transactions(db: Session, user_id: int, bucket_map: dict, members: list):
    """Generate 12 months of realistic transactions."""
    print("Generating transactions...")
    
    transactions = []
    today = datetime.now()
    
    # Generate for each month
    for months_ago in range(12, -1, -1):  # 12 months ago to now
        month_date = today - timedelta(days=months_ago * 30)
        
        # Salary - twice per month
        salary_bucket = bucket_map.get("Salary")
        if salary_bucket:
            for day in [15, 28]:
                txn_date = month_date.replace(day=min(day, 28))
                transactions.append(models.Transaction(
                    user_id=user_id,
                    date=txn_date,
                    description="SALARY DEPOSIT - ACME CORP",
                    raw_description="SALARY DEPOSIT - ACME CORP",
                    amount=6500,  # Income is positive
                    bucket_id=salary_bucket.id,
                    spender="Joint",
                    is_verified=True,
                ))
        
        # Rent/Mortgage - once per month
        rent_bucket = bucket_map.get("Rent/Mortgage")
        if rent_bucket:
            txn_date = month_date.replace(day=1)
            transactions.append(models.Transaction(
                user_id=user_id,
                date=txn_date,
                description="MORTGAGE PAYMENT - ANZ",
                raw_description="MORTGAGE PAYMENT ANZ HOME LOAN",
                amount=-2800,  # Expense is negative
                bucket_id=rent_bucket.id,
                spender="Joint",
                is_verified=True,
            ))
        
        # Generate random transactions for other categories
        num_txns = random.randint(55, 75)  # Variable transactions per month
        
        # Increase spending in December (holidays)
        if month_date.month == 12:
            num_txns = int(num_txns * 1.4)
        # Decrease in January (recovery)
        elif month_date.month == 1:
            num_txns = int(num_txns * 0.7)
        
        for _ in range(num_txns):
            # Pick a random category with merchants
            category = random.choice([c for c in MERCHANTS.keys() if c not in ["Salary"]])
            merchant_options = MERCHANTS.get(category, [])
            
            if not merchant_options:
                continue
            
            merchant_info = random.choice(merchant_options)
            if isinstance(merchant_info, tuple):
                description, base_amount = merchant_info
            else:
                description = merchant_info
                base_amount = random.randint(10, 100)
            
            # Add some variance to amounts
            variance = random.uniform(0.8, 1.3)
            amount = round(base_amount * variance, 2)
            
            # Determine if expense or income
            if category in ["Salary", "Side Income", "Investment Income"]:
                amount = abs(amount)  # Income is positive
            else:
                amount = -abs(amount)  # Expense is negative
            
            # Random day in month
            day = random.randint(1, 28)
            txn_date = month_date.replace(day=day)
            
            # Assign to random member or Joint
            spender_choice = random.choice(["Joint", members[0].name, members[1].name])
            
            bucket = bucket_map.get(category)
            
            transactions.append(models.Transaction(
                user_id=user_id,
                date=txn_date,
                description=description,
                raw_description=description,
                amount=amount,
                bucket_id=bucket.id if bucket else None,
                spender=spender_choice,
                is_verified=random.random() > 0.1,  # 90% verified
            ))
    
    # Bulk insert
    db.bulk_save_objects(transactions)
    db.commit()
    print(f"Created {len(transactions)} transactions")


def seed_demo_user():
    """Main function to seed demo user with all data."""
    print("\n" + "="*60)
    print("SEEDING DEMO USER")
    print("="*60 + "\n")
    
    db = SessionLocal()
    
    try:
        # Clear existing demo user
        clear_demo_user(db)
        
        # Create demo user
        user = create_demo_user(db)
        
        # Create household members
        members = create_members(db, user.id)
        
        # Create budget categories
        bucket_map = create_categories(db, user.id)
        
        # Create accounts
        account_map = create_accounts(db, user.id)
        
        # Create investment holdings
        investment_account = account_map.get("Investment Portfolio")
        if investment_account:
            create_holdings(db, investment_account.id)
        
        # Create goals
        savings_account = account_map.get("Savings Account")
        if savings_account:
            create_goals(db, user.id, savings_account.id)
        
        # Create subscriptions
        create_subscriptions(db, user.id, bucket_map)
        
        # Create smart rules
        create_rules(db, user.id, bucket_map)
        
        # Generate transactions
        generate_transactions(db, user.id, bucket_map, members)
        
        print("\n" + "="*60)
        print("DEMO USER SEEDING COMPLETE!")
        print("="*60)
        print(f"\nLogin credentials:")
        print(f"  Email: {DEMO_EMAIL}")
        print(f"  Password: {DEMO_PASSWORD}")
        print()
        
    except Exception as e:
        print(f"\nError: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_user()
