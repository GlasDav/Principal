"""
Migration script to reorganize existing flat budget categories into hierarchical structure.
This creates parent categories and assigns existing child categories to them.
"""
import sqlite3
import os

# Mapping of existing child categories to their new parent categories
# Based on Notes file structure
CATEGORY_MAPPING = {
    # Income
    "Income": {
        "icon": "TrendingUp",
        "group": "Income",
        "children": ["Salary", "Salaries", "Interest", "Business", "Business Income", "Other Income"]
    },
    # Household
    "Household Expenses": {
        "icon": "Home",
        "group": "Non-Discretionary",
        "children": [
            "Gas & Electricity", "Water", "Internet", "Mortgage/Rent", "Strata Levies",
            "Council Rates", "Subscriptions", "Maintenance", "Home Maintenance", 
            "Household General", "Home Insurance"
        ]
    },
    # Vehicle
    "Vehicle": {
        "icon": "Car",
        "group": "Non-Discretionary",
        "children": ["Petrol", "Insurance & Registration", "Car Insurance & Rego", "Vehicle Maintenance", "Car Maintenance"]
    },
    # Food
    "Food": {
        "icon": "Utensils",
        "group": "Discretionary",
        "children": ["Groceries", "Dining Out", "Coffee", "Snacks"]
    },
    # Lifestyle
    "Lifestyle": {
        "icon": "Heart",
        "group": "Discretionary",
        "children": [
            "Personal", "Homewares", "Beauty", "Health & Fitness", "Clothing",
            "Leisure", "Dates", "Gifts", "Parking & Tolls", "Public Transport",
            "Taxi & Rideshare"
        ]
    },
    # Health & Wellness
    "Health & Wellness": {
        "icon": "HeartPulse",
        "group": "Non-Discretionary",
        "children": ["Medical", "Dental", "Pharmacy", "Fitness", "Health Insurance"]
    },
    # Kids
    "Kids": {
        "icon": "Baby",
        "group": "Discretionary",
        "children": ["Childcare", "Education", "Kids Expenses", "Activities", "Investing"]
    },
    # Rollover/Non-Monthly
    "Rollover/Non-Monthly": {
        "icon": "Calendar",
        "group": "Discretionary",
        "children": ["Donations", "Renovations", "Travel", "Major Purchases"]
    },
    # Financial
    "Financial": {
        "icon": "Landmark",
        "group": "Non-Discretionary", 
        "children": ["Cash & ATM Fees", "Financial Fees", "Investment Contributions", "Accounting", "Bank Fees"]
    },
    # Other
    "Other": {
        "icon": "MoreHorizontal",
        "group": "Discretionary",
        "children": ["Work Expenses", "Business Expenses", "Miscellaneous", "Uncategorised"]
    }
}


def migrate_existing_categories(db_path: str = "principal_v5.db"):
    """
    Migrate existing flat categories to hierarchical structure.
    - Creates parent categories if they don't exist
    - Updates existing child categories to point to their parent
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all users
    cursor.execute("SELECT DISTINCT user_id FROM budget_buckets")
    user_ids = [row[0] for row in cursor.fetchall()]
    
    print(f"Found {len(user_ids)} users to migrate")
    
    for user_id in user_ids:
        print(f"\n=== Migrating user {user_id} ===")
        
        # Get existing categories for this user
        cursor.execute("SELECT id, name, parent_id FROM budget_buckets WHERE user_id = ?", (user_id,))
        existing = {row[1]: {"id": row[0], "parent_id": row[1]} for row in cursor.fetchall()}
        
        display_order = 0
        
        for parent_name, config in CATEGORY_MAPPING.items():
            # Skip if parent already exists
            if parent_name in existing:
                parent_id = existing[parent_name]["id"]
                print(f"  Parent '{parent_name}' already exists (id={parent_id})")
            else:
                # Create parent category
                cursor.execute("""
                    INSERT INTO budget_buckets (name, icon_name, user_id, "group", display_order, parent_id)
                    VALUES (?, ?, ?, ?, ?, NULL)
                """, (parent_name, config.get("icon", "Wallet"), user_id, config.get("group", "Discretionary"), display_order))
                parent_id = cursor.lastrowid
                print(f"  Created parent '{parent_name}' (id={parent_id})")
            
            display_order += 1
            
            # Update children to point to this parent
            child_order = 0
            for child_name in config.get("children", []):
                if child_name in existing:
                    child_data = existing[child_name]
                    # Only update if not already assigned to a parent
                    cursor.execute("SELECT parent_id FROM budget_buckets WHERE id = ?", (child_data["id"],))
                    current_parent = cursor.fetchone()[0]
                    if current_parent is None:
                        cursor.execute("""
                            UPDATE budget_buckets 
                            SET parent_id = ?, display_order = ?
                            WHERE id = ?
                        """, (parent_id, child_order, child_data["id"]))
                        print(f"    Linked '{child_name}' to parent '{parent_name}'")
                    child_order += 1
        
        conn.commit()
    
    conn.close()
    print("\n=== Migration complete! ===")


if __name__ == "__main__":
    import sys
    
    db_path = sys.argv[1] if len(sys.argv) > 1 else "principal_v5.db"
    
    if not os.path.exists(db_path):
        print(f"Error: Database '{db_path}' not found")
        sys.exit(1)
    
    print(f"Migrating database: {db_path}")
    migrate_existing_categories(db_path)
