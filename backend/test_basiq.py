"""
Basiq Integration Test Script

This script tests the Basiq connection without running the full app.
It helps diagnose issues with API keys, token generation, and Basiq connectivity.
"""

import os
import asyncio
import httpx
from dotenv import load_dotenv
import base64

# Load environment variables
load_dotenv()

BASIQ_API_KEY = os.getenv("BASIQ_API_KEY")
BASIQ_API_URL = "https://au-api.basiq.io"


def check_api_key():
    """Validate API key format"""
    print("=" * 60)
    print("Step 1: Checking API Key")
    print("=" * 60)
    
    if not BASIQ_API_KEY:
        print("❌ BASIQ_API_KEY not found in .env file")
        return False
    
    print(f"✅ API Key present (length: {len(BASIQ_API_KEY)} chars)")
    print(f"   First 20 chars: {BASIQ_API_KEY[:20]}...")
    
    # Try to decode
    try:
        decoded = base64.b64decode(BASIQ_API_KEY).decode('utf-8')
        if ':' in decoded:
            app_id, app_secret = decoded.split(':', 1)
            print(f"✅ Valid Base64 format")
            print(f"   App ID: {app_id[:8]}...{app_id[-4:]}")
            print(f"   App Secret: {'*' * len(app_secret)}")
        else:
            print("⚠️ Decoded but doesn't contain ':' separator")
    except Exception as e:
        print(f"⚠️ Could not decode as Base64: {e}")
    
    print()
    return True


async def test_token_endpoint():
    """Test fetching a CLIENT_ACCESS token from Basiq"""
    print("=" * 60)
    print("Step 2: Testing Token Endpoint")
    print("=" * 60)
    
    headers = {
        "Authorization": f"Basic {BASIQ_API_KEY}",
        "Content-Type": "application/x-www-form-urlencoded",
        "basiq-version": "3.0"
    }
    
    data = {"scope": "CLIENT_ACCESS"}
    
    print(f"POST {BASIQ_API_URL}/token")
    print(f"Scope: CLIENT_ACCESS")
    print()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{BASIQ_API_URL}/token",
                headers=headers,
                data=data
            )
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                token_data = response.json()
                print(f"✅ Token received successfully!")
                print(f"   Token Type: {token_data.get('token_type')}")
                print(f"   Expires In: {token_data.get('expires_in')} seconds")
                print(f"   Access Token: {token_data.get('access_token', '')[:50]}...")
                print()
                return token_data
            else:
                print(f"❌ Failed to get token")
                print(f"Response Body: {response.text}")
                print()
                return None
                
    except httpx.TimeoutException:
        print("❌ Request timed out (>30s)")
        print("   Basiq API might be unreachable")
        print()
        return None
    except Exception as e:
        print(f"❌ Request failed: {type(e).__name__}")
        print(f"   Error: {str(e)}")
        print()
        import traceback
        traceback.print_exc()
        return None


async def test_redirect_url():
    """Check if redirect URL format is correct"""
    print("=" * 60)
    print("Step 3: Checking Redirect URL Configuration")
    print("=" * 60)
    
    token_data = await test_token_endpoint()
    
    if token_data:
        access_token = token_data.get('access_token')
        redirect_url = "http://localhost:5173/basiq-callback"
        
        # Build the Basiq consent URL
        from urllib.parse import urlencode, quote
        
        params = {
            'token': access_token,
            'redirect_uri': redirect_url
        }
        
        basiq_url = f"https://consent.basiq.io/home?token={access_token}&redirect_uri={quote(redirect_url)}"
        
        print(f"📋 Basiq Consent URL:")
        print(f"   {basiq_url[:100]}...")
        print()
        print(f"✅ URL format looks correct")
        print(f"   Redirect to: {redirect_url}")
        print()
        print("⚠️ IMPORTANT: This redirect URL must be whitelisted in your Basiq Dashboard")
        print("   1. Go to https://dashboard.basiq.io")
        print("   2. Navigate to your Application settings")
        print("   3. Add the redirect URL to allowed URLs")
        print()
    else:
        print("⏭️ Skipping (no token available)")
        print()


async def main():
    """Run all diagnostic tests"""
    print("\n🔍 Basiq Integration Diagnostic Tool")
    print("=" * 60)
    print()
    
    # Step 1: Check API Key
    if not check_api_key():
        print("\n❌ Cannot proceed without API key")
        print("   Add BASIQ_API_KEY to your .env file")
        return
    
    # Step 2 & 3: Test token endpoint and redirect URL
    await test_redirect_url()
    
    # Summary
    print("=" * 60)
    print("Summary & Next Steps")
    print("=" * 60)
    print()
    print("If token request succeeded:")
    print("  1. Whitelist http://localhost:5173/basiq-callback in Basiq Dashboard")
    print("  2. Start backend: uvicorn backend.main:app --reload")
    print("  3. Start frontend: npm run dev (in frontend folder)")
    print("  4. Test connection via UI")
    print()
    print("If token request failed:")
    print("  1. Check API key is correct in Basiq Dashboard")
    print("  2. Verify API key has correct permissions")
    print("  3. Contact Basiq support: support@basiq.io")
    print()
    print("For development, you can use Mock Mode:")
    print("  - Comment out BASIQ_API_KEY in .env")
    print("  - Restart backend")
    print("  - Mock flow will activate automatically")
    print()


if __name__ == "__main__":
    asyncio.run(main())
