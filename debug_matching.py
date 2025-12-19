from backend.database import SessionLocal
from backend.models import BudgetBucket, User
from sqlalchemy.orm import joinedload
from backend.services.categorizer import Categorizer

def debug_matching():
    db = SessionLocal()
    try:
        user = db.query(User).first()
        print(f"User: {user.email}")
        
        # Load buckets and tags exactly like ingestion.py
        buckets = db.query(BudgetBucket).options(joinedload(BudgetBucket.tags)).filter(BudgetBucket.user_id == user.id).all()
        
        rules_map = {}
        for bucket in buckets:
            for tag in bucket.tags:
                rules_map[tag.name.lower()] = bucket.name
                
        print(f"Loaded {len(rules_map)} legacy rules from {len(buckets)} buckets.")
        print(f"Sample Rules: {list(rules_map.items())[:5]}")
        
        if not rules_map:
            print("ERROR: Rules map is empty!")
            return

        categorizer = Categorizer()
        
        # Test 1: Exact Match of a known tag
        test_tag = list(rules_map.keys())[0]
        test_desc = f"PURCHASE {test_tag.upper()} Sydney"
        print(f"\nTest 1: '{test_desc}' (Expect: {rules_map[test_tag]})")
        
        clean = categorizer.clean_description(test_desc)
        print(f" Cleaned: '{clean}'")
        
        cat, conf = categorizer.predict(clean, rules_map)
        print(f" Result: {cat} ({conf})")
        
        # Test 2: Substring
        test_desc_2 = f"Some random shop {test_tag} 123"
        print(f"\nTest 2: '{test_desc_2}'")
        clean_2 = categorizer.clean_description(test_desc_2)
        print(f" Cleaned: '{clean_2}'")
        cat_2, conf_2 = categorizer.predict(clean_2, rules_map)
        print(f" Result: {cat_2} ({conf_2})")
        
    finally:
        db.close()

if __name__ == "__main__":
    debug_matching()
