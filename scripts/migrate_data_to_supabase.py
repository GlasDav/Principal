import os
import sys
import asyncio
import json
from datetime import datetime, date
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from supabase import create_client, Client

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.supabase'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Supabase Config
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Critical: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Legacy DB Config
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    db_path = os.path.join(os.path.dirname(__file__), '..', 'backend', 'principal_v5.db')
    DATABASE_URL = f"sqlite:///{db_path}"
    print(f"⚠️  Using SQLite default: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

# Load ID Mapping
mapping_path = os.path.join(os.path.dirname(__file__), 'id_mapping.json')
if not os.path.exists(mapping_path):
    print("❌ id_mapping.json not found. Run migrate_users_to_supabase.py first.")
    sys.exit(1)

with open(mapping_path, 'r') as f:
    # Keys are strings in JSON, convert to int for lookup
    ID_MAPPING = {int(k): v for k, v in json.load(f).items()}

print(f"✅ Loaded {len(ID_MAPPING)} user mappings.")

# Define migration order (parents first)
TABLES = [
    # Core
    'users', # We need to populate public.users from legacy users info
    'households', # Has owner_id
    'household_members', 
    'accounts', # Accounts before Goals
    'goals',
    'budget_buckets', # Needs 2-pass
    # Children
    'transactions',
    'subscriptions',
    'household_users',
    'household_invites',
    'api_keys',
    'notification_settings',
    'notifications',
    # Deep children
    'investment_holdings',
    'budget_limits',
    'categorization_rules',
    'net_worth_snapshots', 
    'account_balances',
    'category_goals',
    'ignored_rule_patterns',
    'tax_settings'
]

# Helper to serialize dates for JSON
def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return obj

async def migrate_table(table_name):
    print(f"\n🔄 Migrating table: {table_name}")
    
    # 1. Fetch from Legacy
    try:
        # Use simple text query to avoid importing all models
        result = session.execute(text(f"SELECT * FROM {table_name}"))
        rows = result.fetchall()
        columns = result.keys()
    except Exception as e:
        print(f"   ⚠️  Skipping/Error {table_name}: {e}")
        return

    records = []
    skipped = 0
    parent_updates = [] # For buckets 2nd pass
    
    for row in rows:
        # Convert row to dict
        data = dict(zip(columns, row))
        
        # TRANSFORMATION ------------------------
        
        # 1. Map user_id
        if 'user_id' in data and data['user_id'] is not None:
            legacy_uid = data['user_id']
            if legacy_uid in ID_MAPPING:
                data['user_id'] = ID_MAPPING[legacy_uid]
            else:
                skipped += 1
                continue
                
        # 2. Map owner_id (Households)
        if 'owner_id' in data and data['owner_id'] is not None:
             legacy_oid = data['owner_id']
             if legacy_oid in ID_MAPPING:
                 data['owner_id'] = ID_MAPPING[legacy_oid]
        
        # 3. Map invited_by_id (Invites)
        if 'invited_by_id' in data and data['invited_by_id'] is not None:
             legacy_iid = data['invited_by_id']
             if legacy_iid in ID_MAPPING:
                 data['invited_by_id'] = ID_MAPPING[legacy_iid]

        # 4. Handle 'users' table specifically for public.users
        if table_name == 'users':
            legacy_id = data.pop('id') # Remove integer ID
            if legacy_id in ID_MAPPING:
                data['id'] = ID_MAPPING[legacy_id]
            else:
                continue
            if 'hashed_password' in data: 
                del data['hashed_password']

        # 5. Handle Buckets (Self-Referential)
        if table_name == 'budget_buckets':
            # Save parent_id for later update
            if 'parent_id' in data and data['parent_id'] is not None:
                parent_updates.append({'id': data['id'], 'parent_id': data['parent_id']})
                data['parent_id'] = None # Remove for first pass
            
        # 6. Clean Data Types
        for k, v in data.items():
            if isinstance(v, (datetime, date)):
                data[k] = v.isoformat()
        
        records.append(data)

    if not records:
        print("   No records to migrate.")
        return

    # 2. Insert to Supabase (Batch)
    batch_size = 100
    print(f"   Pushing {len(records)} records...")
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        try:
            response = supabase.table(table_name).upsert(batch).execute()
        except Exception as e:
            print(f"   ❌ Error inserting batch: {str(e)}")
            # If buckets failed, we shouldn't try update
            if table_name == 'budget_buckets':
                print("   (Skipping parent_id updates for this batch due to error)")
                continue


    # 3. Second Pass for Buckets: UPDATE properly
    if table_name == 'budget_buckets' and parent_updates:
        print(f"   Updating {len(parent_updates)} parent relationships...")
        for i in range(0, len(parent_updates), batch_size):
            batch = parent_updates[i:i+batch_size]
            for item in batch:
                try:
                    # Must use update() with ID match
                    supabase.schema('public').table(table_name).update({'parent_id': item['parent_id']}).eq('id', item['id']).execute()
                except Exception as e:
                     print(f"   ❌ Error updating parent for Bucket {item['id']}: {str(e)}")


async def migrate_transactions(rows, columns):
    """Special handler for transactions to deal with splits (parent_transaction_id)"""
    # Separate parents and children (splits)
    # columns passed in
    
    parents = []
    splits = []
    
    for row in rows:
        data = dict(zip(columns, row))
        
        # --- Common Transformation ---
        # 1. Map user_id
        if 'user_id' in data and data['user_id'] in ID_MAPPING:
            data['user_id'] = ID_MAPPING[data['user_id']]
        else:
            # Skip if user not found
            continue
            
        # Clean Dates
        for k, v in data.items():
            if isinstance(v, (datetime, date)):
                data[k] = v.isoformat()
        
        # --- Split Logic ---
        if data.get('parent_transaction_id'):
            splits.append(data)
        else:
            parents.append(data)
            
    print(f"   Split Logic: {len(parents)} parents, {len(splits)} splits.")
    
    # 1. Push Parents
    batch_size = 100
    for i in range(0, len(parents), batch_size):
        batch = parents[i:i+batch_size]
        try:
            supabase.schema('public').table('transactions').upsert(batch).execute()
        except Exception as e:
             print(f"   ❌ Error inserting transactions batch: {str(e)}")

    # 2. Push Splits
    for i in range(0, len(splits), batch_size):
        batch = splits[i:i+batch_size]
        try:
            supabase.schema('public').table('transactions').upsert(batch).execute()
        except Exception as e:
             print(f"   ❌ Error inserting splits batch: {str(e)}")



async def main():
    print("🚀 Starting Data Migration to SupabaseDB... (v2 - Explicit Schema)")
    
    # 0. Migrate Public User Profiles
    # Explicitly spec schema to avoid cache issues
    try:
        await migrate_table('users') 
    except Exception as e:
        print(f"CRITICAL ERROR migrating users: {e}")
 
    
    # 1. Iterate Tables
    for table in TABLES:
        if table == 'users': continue
        
        # Special case for transactions
        if table == 'transactions':
            print(f"\n🔄 Migrating table: {table}")
            try:
                result = session.execute(text(f"SELECT * FROM {table}"))
                columns = result.keys() # Get columns
                rows = result.fetchall()
                if rows:
                    await migrate_transactions(rows, columns)
                else:
                    print("   No transactions found.")
            except Exception as e:
                print(f"   ⚠️  Skipping/Error transactions: {e}")
            continue

        await migrate_table(table)
        
    print("\n\n✨ Migration Complete.")
    print("Note: You may need to reset Primary Key sequences in Supabase SQL Editor:")
    print("SELECT setval('table_id_seq', (SELECT MAX(id) FROM table));")

if __name__ == "__main__":
    asyncio.run(main())
