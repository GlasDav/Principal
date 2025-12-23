
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models

# Hierarchy Definition from Notes
HIERARCHY = {
    "Income": {
        "group": "Income",
        "children": ["Salaries", "Interest", "Business", "Other Income"]
    },
    "Household Expenses": {
        "group": "Non-Discretionary",
        "children": ["Gas & Electricity", "Water", "Internet", "Mortgage/Rent", "Strata Levies", "Council Rates", "Subscriptions", "Maintenance", "Household General"]
    },
    "Vehicle": {
        "group": "Non-Discretionary",
        "children": ["Petrol", "Insurance & Registration", "Vehicle Maintenance", "Other Vehicle"]
    },
    "Food": {
        "group": "Non-Discretionary",
        "children": ["Groceries", "Dining Out", "Coffee", "Snacks"]
    },
    "Lifestyle": {
        "group": "Discretionary",
        "children": ["Personal", "Homewares", "Beauty", "Health & Fitness", "Clothing", "Leisure", "Dates", "Gifts", "Parking & Tolls", "Public Transport", "Taxi & Rideshare", "Other Lifestyle"]
    },
    "Health & Wellness": {
        "group": "Non-Discretionary",
        "children": ["Medical", "Dental", "Pharmacy", "Fitness"]
    },
    "Kids": {
        "group": "Non-Discretionary",
        "children": ["Childcare", "Education", "Kids Expenses", "Investing", "Activities"]
    },
    "Rollover/Non-Monthly": {
        "group": "Discretionary",
        "children": ["Donations", "Renovations", "Other Rollover"]
    },
    "Financial": {
        "group": "Non-Discretionary",
        "children": ["Cash & ATM Fees", "Financial Fees", "Investment Contributions", "Accounting"]
    },
    "Other": {
        "group": "Discretionary",
        "children": ["Work Expenses", "Business Expenses", "Miscellaneous", "Uncategorised", "Transfers"]
    }
}

# Mapping existing buckets to new (Parent, ChildName)
MAPPING = {
    "Rent/Mortgage": ("Household Expenses", "Mortgage/Rent"),
    "Groceries": ("Food", "Groceries"),
    "Utilities": ("Household Expenses", "Gas & Electricity"), # Approximation
    "Transport": ("Vehicle", "Petrol"), # Approximation
    "Health": ("Health & Wellness", "Medical"),
    "Dining Out": ("Food", "Dining Out"),
    "Entertainment": ("Lifestyle", "Leisure"),
    "Shopping": ("Lifestyle", "Clothing"), 
    "Travel": ("Lifestyle", "Leisure"), # Merge into leisure?
    "General": ("Other", "Miscellaneous"),
}

def reorg_hierarchy():
    db: Session = SessionLocal()
    try:
        users = db.query(models.User).all()
        print(f"Found {len(users)} users to process.")

        for user in users:
            user_id = user.id
            print(f"\n--- Processing User ID: {user_id} ({user.email}) ---")
        
            # 1. Create/Get Parents
            parent_map = {} # Name -> ID
            
            for p_name, p_data in HIERARCHY.items():
                parent = db.query(models.BudgetBucket).filter(
                    models.BudgetBucket.user_id == user_id,
                    models.BudgetBucket.name == p_name,
                    models.BudgetBucket.parent_id == None
                ).first()
                
                if not parent:
                    print(f"Creating Parent: {p_name}")
                    parent = models.BudgetBucket(
                        user_id=user_id,
                        name=p_name,
                        group=p_data["group"],
                        icon_name="Folder", # Generic icon
                        monthly_limit_a=0,
                        is_shared=True
                    )
                    db.add(parent)
                    db.commit()
                    db.refresh(parent)
                else:
                    print(f"Parent exists: {p_name}")
                    # Ensure group is correct
                    if parent.group != p_data["group"]:
                        parent.group = p_data["group"]
                        db.commit()
                
                parent_map[p_name] = parent.id
                
            # 2. Process Existing Buckets (Map/Move them)
            existing_buckets = db.query(models.BudgetBucket).filter(models.BudgetBucket.user_id == user_id).all()
            
            for bucket in existing_buckets:
                # Skip if it's one of our parent buckets
                if bucket.name in HIERARCHY and bucket.parent_id is None:
                    continue
                    
                if bucket.name in MAPPING:
                    # Move/Rename
                    target_parent_name, target_child_name = MAPPING[bucket.name]
                    # Only move if not already moved (check name)
                    if bucket.name != target_child_name:
                         print(f"Moving '{bucket.name}' -> '{target_parent_name}/{target_child_name}'")
                         bucket.name = target_child_name
                         bucket.parent_id = parent_map[target_parent_name]
                         bucket.group = HIERARCHY[target_parent_name]["group"]
                         db.commit()
                    else:
                         # Ensure parent is linked if name matches but parent might be missing
                         if bucket.parent_id is None:
                              print(f"Linking existing '{bucket.name}' -> '{target_parent_name}'")
                              bucket.parent_id = parent_map[target_parent_name]
                              bucket.group = HIERARCHY[target_parent_name]["group"]
                              db.commit()

                elif bucket.parent_id is None:
                    # Orphaned bucket? Move to "Other/Miscellaneous" or leave?
                    # For now, let's try to find a matching child name in hierarchy
                    found = False
                    for p_name, p_data in HIERARCHY.items():
                        if bucket.name in p_data["children"]:
                            # Prevent self-parenting if duplicate names exist
                            if bucket.id == parent_map[p_name]:
                                continue
                                
                            print(f"Linking Orphan '{bucket.name}' -> '{p_name}'")
                            bucket.parent_id = parent_map[p_name]
                            bucket.group = p_data["group"]
                            db.commit()
                            found = True
                            break
                    
                    if not found:
                        print(f"WARNING: Unmapped Orphan '{bucket.name}'. Moving to 'Other/Uncategorised'")
                        bucket.parent_id = parent_map["Other"]
                        bucket.group = "Discretionary"
                        # bucket.name = "Uncategorised" # Don't rename custom user buckets, just file them
                        db.commit()

            # 3. Create Missing Default Children
            for p_name, p_data in HIERARCHY.items():
                parent_id = parent_map[p_name]
                for child_name in p_data["children"]:
                    # Check if exists
                    child = db.query(models.BudgetBucket).filter(
                        models.BudgetBucket.user_id == user_id,
                        models.BudgetBucket.name == child_name,
                        models.BudgetBucket.parent_id == parent_id
                    ).first()
                    
                    if not child:
                        # Check if it exists as a root (not yet moved logic might have missed it if not in mapping)
                        # But loop 2 should catch orphans.
                        print(f"Creating missing default child: {child_name} under {p_name}")
                        child = models.BudgetBucket(
                            user_id=user_id,
                            name=child_name,
                            parent_id=parent_id,
                            group=p_data["group"],
                            monthly_limit_a=0,
                            is_shared=True
                        )
                        db.add(child)
                        db.commit()

        print("Reorganization complete.")
        
    finally:
        db.close()

if __name__ == "__main__":
    reorg_hierarchy()
