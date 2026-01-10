import os
import sys
import httpx
import asyncio
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from backend.models import User
# We don't import database/Base to avoid triggering auto-migrations or env var issues
# We'll just inspect the User model directly

def load_supabase_config():
    """Load Supabase config from .env.supabase"""
    # Try loading .env.supabase
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env.supabase')
    load_dotenv(env_path)
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print(f"❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in {env_path}")
        print("Please ensure you have filled in these values.")
        sys.exit(1)
        
    return url, key

def get_legacy_db_session():
    """Connect to legacy database"""
    # Try loading .env for DATABASE_URL
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        # Fallback to local SQLite if not specified (common in dev)
        db_path = os.path.join(os.path.dirname(__file__), '..', 'backend', 'principal_v5.db')
        db_url = f"sqlite:///{db_path}"
        print(f"⚠️  DATABASE_URL not found, falling back to: {db_url}")
    else:
        print(f"✅ using DATABASE_URL from .env")
        
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    return Session()

async def migrate_users():
    print("🚀 Starting User Migration to Supabase...")
    
    supabase_url, supabase_key = load_supabase_config()
    session = get_legacy_db_session()
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    try:
        users = session.execute(select(User)).scalars().all()
        print(f"found {len(users)} users to migrate.")
        
        async with httpx.AsyncClient() as client:
            for user in users:
                if not user.email:
                    print(f"⚠️  Skipping user ID {user.id}: No email")
                    continue
                    
                print(f"Processing {user.email}...")
                
                # Check if user exists
                # Technically we can just try to create and catch error, 
                # but let's be cleaner if we can. 
                # Actually, admin API 'create_user' doesn't error if exists? 
                # Documentation says it returns error.
                
                payload = {
                    "email": user.email,
                    "email_confirm": True, # Auto-verify migrated users
                    "user_metadata": {
                        "name": user.name or "",
                        "currency_symbol": user.currency_symbol or "AUD"
                    }
                    # We cannot migrate password hash (bcrypt vs argon2)
                    # User will need to reset password
                }
                
                except Exception as e:
                    print(f"❌ Error processing {user.email}: {str(e)}")
                    continue

                if response.status_code == 200:
                    data = response.json()
                    new_uuid = data['id']
                    print(f"✅ Created: {user.email} (Old ID: {user.id} -> New ID: {new_uuid})")
                    id_mapping[user.id] = new_uuid

                elif (response.status_code == 422 and "email_exists" in response.text) or \
                     (response.status_code == 400 and "User already registered" in response.text):
                     print(f"⚠️  Already registered: {user.email}. Fetching ID...")
                     
                     # Fetch existing user to get ID
                     # We'll list users and filter (fine for small batch, ideally use search param if available)
                     try:
                         list_resp = await client.get(
                             f"{supabase_url}/auth/v1/admin/users",
                             headers=headers
                         )
                         if list_resp.status_code == 200:
                             all_users = list_resp.json().get("users", [])
                             found = next((u for u in all_users if u["email"] == user.email), None)
                             if found:
                                 new_uuid = found['id']
                                 print(f"   Mapping found: {new_uuid}")
                                 id_mapping[user.id] = new_uuid
                             else:
                                 print(f"   Could not find user in list despite error.")
                         else:
                             print(f"   Failed to list users: {list_resp.text}")
                     except Exception as fetch_err:
                         print(f"   Error fetching existing user: {fetch_err}")

                else:
                    print(f"❌ Failed to create {user.email}: {response.text}")
        
        # Save mapping to file
        import json
        mapping_path = os.path.join(os.path.dirname(__file__), 'id_mapping.json')
        with open(mapping_path, 'w') as f:
            json.dump(id_mapping, f, indent=2)
        print(f"💾 Saved ID mapping to {mapping_path}")
                     
    except Exception as e:
        print(f"🔥 Critical Error: {str(e)}")
    finally:
        session.close()

if __name__ == "__main__":
    # Initialize empty mapping
    global id_mapping
    id_mapping = {}
    asyncio.run(migrate_users())
