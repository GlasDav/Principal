"""
Fix Ampersand HTML Entity Encoding in Bucket Names

This migration fixes bucket names that have HTML entities like &amp; 
instead of plain ampersands.
"""

import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import html
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models

def unescape_bucket_names():
    """Unescape HTML entities in bucket names."""
    db: Session = SessionLocal()
    
    try:
        # Get all buckets
        buckets = db.query(models.BudgetBucket).all()
        
        updated_count = 0
        for bucket in buckets:
            # Unescape HTML entities
            original_name = bucket.name
            unescaped_name = html.unescape(original_name)
            
            if original_name != unescaped_name:
                bucket.name = unescaped_name
                updated_count += 1
                print(f"Updated: '{original_name}' → '{unescaped_name}'")
        
        if updated_count > 0:
            db.commit()
            print(f"\n✅ Successfully updated {updated_count} bucket names")
        else:
            print("✅ No buckets needed updating")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Fix Ampersand HTML Entity Encoding")
    print("=" * 60)
    print()
    unescape_bucket_names()
