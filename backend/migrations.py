from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
import logging

logger = logging.getLogger(__name__)

def run_migrations(engine: Engine):
    """
    Simple auto-migration script to add missing columns to existing tables.
    Useful for deployments where Alembic is not set up but models have changed.
    """
    try:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        # --- budget_buckets migrations ---
        if "budget_buckets" in table_names:
            existing_columns = [c["name"] for c in inspector.get_columns("budget_buckets")]
            
            # Map of column_name -> SQL type definition
            # Note: SQLite has limited ALTER TABLE support, but ADD COLUMN is supported.
            columns_to_add = [
                ("icon_name", "VARCHAR DEFAULT 'Wallet'"),
                ("is_rollover", "BOOLEAN DEFAULT 0"),
                ("is_transfer", "BOOLEAN DEFAULT 0"),
                ("is_investment", "BOOLEAN DEFAULT 0"),
                ("is_hidden", "BOOLEAN DEFAULT 0"),
                ("is_one_off", "BOOLEAN DEFAULT 0"),
                ("parent_id", "INTEGER"), # references are hard in sqlite alter
                ("display_order", "INTEGER DEFAULT 0"),
                ("target_amount", "FLOAT"),
                ("target_date", "DATE"),
                ("group", "VARCHAR DEFAULT 'Discretionary'") # 'group' might need quoting in some DBs
            ]
            
            with engine.connect() as conn:
                for col_name, col_def in columns_to_add:
                    if col_name not in existing_columns:
                        logger.info(f"Auto-Migration: Adding column '{col_name}' to 'budget_buckets' table...")
                        try:
                            # Quote "group" to avoid keyword issues
                            safe_col_name = f'"{col_name}"' if col_name == "group" else col_name
                            conn.execute(text(f"ALTER TABLE budget_buckets ADD COLUMN {safe_col_name} {col_def}"))
                            conn.commit()
                        except Exception as e:
                            logger.error(f"Failed to add column {col_name}: {e}")

        # --- users migrations ---
        if "users" in table_names:
            existing_columns = [c["name"] for c in inspector.get_columns("users")]
            
            columns_to_add = [
                ("household_id", "INTEGER"),
                ("mfa_enabled", "BOOLEAN DEFAULT 0"),
                ("mfa_secret", "VARCHAR"),
                ("mfa_backup_codes", "VARCHAR"),
                ("is_email_verified", "BOOLEAN DEFAULT 0")
            ]
            
            with engine.connect() as conn:
                for col_name, col_def in columns_to_add:
                    if col_name not in existing_columns:
                        logger.info(f"Auto-Migration: Adding column '{col_name}' to 'users' table...")
                        try:
                             conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}"))
                             conn.commit()
                        except Exception as e:
                            logger.error(f"Failed to add column {col_name}: {e}")

    except Exception as e:
        logger.error(f"Migration check failed: {e}")
