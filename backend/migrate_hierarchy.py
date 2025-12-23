"""
Database migration script for hierarchical categories.
Adds parent_id and display_order columns to budget_buckets table.
"""
import sqlite3
import os

# Default categories structure from Notes
DEFAULT_CATEGORIES = {
    "Income": {
        "icon": "TrendingUp",
        "group": "Income",
        "children": ["Salaries", "Interest", "Business", "Other Income"]
    },
    "Household Expenses": {
        "icon": "Home",
        "group": "Non-Discretionary",
        "children": ["Gas & Electricity", "Water", "Internet", "Mortgage/Rent", 
                    "Strata Levies", "Council Rates", "Subscriptions", "Maintenance", 
                    "Household General"]
    },
    "Vehicle": {
        "icon": "Car",
        "group": "Non-Discretionary",
        "children": ["Petrol", "Insurance & Registration", "Vehicle Maintenance"]
    },
    "Food": {
        "icon": "Utensils",
        "group": "Discretionary",
        "children": ["Groceries", "Dining Out", "Coffee", "Snacks"]
    },
    "Lifestyle": {
        "icon": "Heart",
        "group": "Discretionary",
        "children": ["Personal", "Homewares", "Beauty", "Health & Fitness", "Clothing",
                    "Leisure", "Dates", "Gifts", "Parking & Tolls", "Public Transport",
                    "Taxi & Rideshare"]
    },
    "Health & Wellness": {
        "icon": "HeartPulse",
        "group": "Non-Discretionary",
        "children": ["Medical", "Dental", "Pharmacy", "Fitness"]
    },
    "Kids": {
        "icon": "Baby",
        "group": "Discretionary",
        "children": ["Childcare", "Education", "Kids Expenses", "Kids Activities"]
    },
    "Rollover/Non-Monthly": {
        "icon": "Calendar",
        "group": "Discretionary",
        "children": ["Donations", "Renovations", "Travel", "Major Purchases"]
    },
    "Financial": {
        "icon": "Landmark",
        "group": "Non-Discretionary",
        "children": ["Cash & ATM Fees", "Financial Fees", "Investment Contributions", "Accounting"]
    },
    "Other": {
        "icon": "MoreHorizontal",
        "group": "Discretionary",
        "children": ["Work Expenses", "Business Expenses", "Miscellaneous", "Uncategorised"]
    }
}


def migrate_database(db_path: str = "principal_v5.db"):
    """Add hierarchy columns to budget_buckets table."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check existing columns
    cursor.execute("PRAGMA table_info(budget_buckets)")
    columns = [col[1] for col in cursor.fetchall()]
    print(f"Existing columns: {columns}")
    
    # Add missing columns
    if 'parent_id' not in columns:
        cursor.execute('ALTER TABLE budget_buckets ADD COLUMN parent_id INTEGER REFERENCES budget_buckets(id)')
        print("Added parent_id column")
    
    if 'display_order' not in columns:
        cursor.execute('ALTER TABLE budget_buckets ADD COLUMN display_order INTEGER DEFAULT 0')
        print("Added display_order column")
    
    conn.commit()
    conn.close()
    print("Migration complete!")


def seed_default_categories(db_path: str = "principal_v5.db", user_id: int = 1):
    """
    Seed default hierarchical categories for a user.
    Only creates if user has no existing buckets.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if user already has buckets
    cursor.execute("SELECT COUNT(*) FROM budget_buckets WHERE user_id = ?", (user_id,))
    count = cursor.fetchone()[0]
    
    if count > 0:
        print(f"User {user_id} already has {count} categories. Skipping seeding.")
        conn.close()
        return
    
    # Create parent categories and their children
    display_order = 0
    for parent_name, config in DEFAULT_CATEGORIES.items():
        # Insert parent
        cursor.execute("""
            INSERT INTO budget_buckets (name, icon_name, user_id, group_name, display_order, parent_id)
            VALUES (?, ?, ?, ?, ?, NULL)
        """, (parent_name, config.get("icon", "Wallet"), user_id, config.get("group", "Discretionary"), display_order))
        
        parent_id = cursor.lastrowid
        display_order += 1
        
        # Insert children
        child_order = 0
        for child_name in config.get("children", []):
            cursor.execute("""
                INSERT INTO budget_buckets (name, icon_name, user_id, group_name, display_order, parent_id)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (child_name, "Wallet", user_id, config.get("group", "Discretionary"), child_order, parent_id))
            child_order += 1
    
    conn.commit()
    conn.close()
    print(f"Seeded {len(DEFAULT_CATEGORIES)} parent categories with children for user {user_id}")


if __name__ == "__main__":
    import sys
    
    db_path = sys.argv[1] if len(sys.argv) > 1 else "principal_v5.db"
    
    print(f"Migrating database: {db_path}")
    migrate_database(db_path)
    
    # Optionally seed categories
    if "--seed" in sys.argv:
        user_id = 1
        if "--user" in sys.argv:
            idx = sys.argv.index("--user")
            user_id = int(sys.argv[idx + 1])
        seed_default_categories(db_path, user_id)
