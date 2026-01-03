"""
Migration: Sync Database Schema
================================
This migration ensures all model columns exist in the database.
Safe to run multiple times (idempotent).

Usage (from /app directory in container):
    cd /app && python -c "from backend.migrations.sync_schema import run_migration; run_migration()"

Or via Docker:
    docker compose exec backend sh -c "cd /app && python -c \"from backend.migrations.sync_schema import run_migration; run_migration()\""
"""
import os
import sys
from pathlib import Path

# Set up Python path for backend imports
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Now we can import from backend
from sqlalchemy import text, inspect
from database import engine

# Define all expected columns per table
# Format: table_name -> [(column_name, column_type, default_value), ...]
EXPECTED_COLUMNS = {
    "users": [
        ("is_email_verified", "BOOLEAN", "FALSE"),
        ("token_version", "INTEGER", "0"),
        ("household_id", "INTEGER", None),
        ("mfa_enabled", "BOOLEAN", "FALSE"),
        ("mfa_secret", "VARCHAR(255)", None),
        ("mfa_backup_codes", "TEXT", None),
    ],
    "budget_buckets": [
        ("is_rollover", "BOOLEAN", "FALSE"),
        ("is_transfer", "BOOLEAN", "FALSE"),
        ("is_investment", "BOOLEAN", "FALSE"),
        ("is_hidden", "BOOLEAN", "FALSE"),
        ("is_one_off", "BOOLEAN", "FALSE"),
        ("parent_id", "INTEGER", None),
        ("display_order", "INTEGER", "0"),
        ("target_amount", "FLOAT", None),
        ("target_date", "DATE", None),
    ],
    "transactions": [
        ("category_confidence", "FLOAT", "0.0"),
        ("is_verified", "BOOLEAN", "FALSE"),
        ("spender", "VARCHAR(100)", "'Joint'"),
        ("goal_id", "INTEGER", None),
        ("account_id", "INTEGER", None),
        ("external_id", "VARCHAR(255)", None),
        ("transaction_hash", "VARCHAR(255)", None),
        ("assigned_to", "VARCHAR(50)", None),
        ("tags", "TEXT", None),
        ("notes", "TEXT", None),
    ],
    "accounts": [
        ("connection_id", "VARCHAR(255)", None),
        ("target_balance", "FLOAT", None),
        ("target_date", "DATE", None),
    ],
    "investment_holdings": [
        ("asset_type", "VARCHAR(50)", "'Stock'"),
        ("sector", "VARCHAR(100)", None),
    ],
    "subscriptions": [
        ("bucket_id", "INTEGER", None),
    ],
    "categorization_rules": [
        ("min_amount", "FLOAT", None),
        ("max_amount", "FLOAT", None),
        ("apply_tags", "TEXT", None),
        ("mark_for_review", "BOOLEAN", "FALSE"),
        ("assign_to", "VARCHAR(100)", None),
    ],
}


def get_existing_columns(connection, table_name):
    """Get list of existing column names for a table."""
    inspector = inspect(engine)
    try:
        columns = inspector.get_columns(table_name)
        return {col['name'] for col in columns}
    except Exception:
        return set()


def run_migration():
    """Run the schema synchronization migration."""
    print("=" * 60)
    print("Schema Sync Migration")
    print("=" * 60)
    
    added_columns = 0
    skipped_columns = 0
    errors = []
    
    with engine.connect() as connection:
        for table_name, columns in EXPECTED_COLUMNS.items():
            existing = get_existing_columns(connection, table_name)
            
            if not existing:
                print(f"⚠️  Table '{table_name}' not found, skipping...")
                continue
            
            for col_name, col_type, default in columns:
                if col_name in existing:
                    skipped_columns += 1
                    continue
                
                # Build ALTER TABLE statement
                if default is not None:
                    sql = f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS "{col_name}" {col_type} DEFAULT {default}'
                else:
                    sql = f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS "{col_name}" {col_type}'
                
                try:
                    connection.execute(text(sql))
                    connection.commit()
                    print(f"✅ Added: {table_name}.{col_name}")
                    added_columns += 1
                except Exception as e:
                    error_msg = f"❌ Failed: {table_name}.{col_name} - {str(e)}"
                    print(error_msg)
                    errors.append(error_msg)
    
    # Summary
    print("=" * 60)
    print(f"Migration Complete!")
    print(f"  - Columns added: {added_columns}")
    print(f"  - Columns skipped (already exist): {skipped_columns}")
    if errors:
        print(f"  - Errors: {len(errors)}")
        for e in errors:
            print(f"    {e}")
    print("=" * 60)
    
    return len(errors) == 0


if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
