import os
import httpx
import logging
import asyncio

logger = logging.getLogger(__name__)

# Basiq API
BASIQ_API_URL = "https://au-api.basiq.io"

class BasiqService:
    def __init__(self):
        self.api_key = os.getenv("BASIQ_API_KEY")
        # If API key is present, we use REAL mode. Else Mock.
        self.is_mock = not self.api_key
        
        # We need a shared client in a real app, but for simplicity we create one per request or use context manager
        self.headers = {
            "Authorization": f"Basic {self.api_key}",
            "Content-Type": "application/x-www-form-urlencoded",
            "basiq-version": "3.0"
        }

    async def get_client_token(self, user_id_context: str = None):
        if self.is_mock:
            return {"access_token": "mock_client_token_123", "token_type": "Bearer", "expires_in": 3600}
        
        async with httpx.AsyncClient() as client:
            # Get token with 'CLIENT_ACCESS' scope
            # If we want to bind to a specific user, we might need a server token first to create the user, 
            # or we just get a generic token and let frontend create user.
            # Basiq Docs: POST /token with scope='CLIENT_ACCESS'
            
            data = {"scope": "CLIENT_ACCESS"}
            if user_id_context:
                # If we have a Basiq User ID, we can bind it? 
                # Basiq token endpoint usually just takes scope. Context involves 'userId' parameter if we want tailored access?
                # Actually, for the SDK to "connect", a simple CLIENT_ACCESS token often suffices for the initialization.
                pass
                
            response = await client.post(
                f"{BASIQ_API_URL}/token",
                headers=self.headers,
                data=data
            )
            response.raise_for_status()
            return response.json()

    async def get_connection_data(self, job_id: str):
        if self.is_mock:
            # Mock Data
            from datetime import datetime, timedelta
            return {
                "accounts": [
                    {"id": "acc_1", "accountNo": "12345678", "name": "Everyday Saver", "currency": "AUD", "balance": 5420.50, "class": "transaction"},
                    {"id": "acc_2", "accountNo": "87654321", "name": "Credit Card", "currency": "AUD", "balance": -1250.00, "class": "credit-card"},
                ],
                "transactions": [
                    {"id": "txn_real_1", "description": "Woolworths Real", "amount": -150.00, "postDate": (datetime.now()).isoformat()},
                ]
            }

        async with httpx.AsyncClient() as client:
            # 1. Poll Job
            # We need a SERVER_ACCESS token to read job details if the Key alone isn't enough (Key is Basic Auth, usually fully privileged)
            # Basic Auth with API Key is usually SERVER_ACCESS equivalent.
            
            job_url = f"{BASIQ_API_URL}/jobs/{job_id}"
            
            # Polling loop
            for _ in range(10): # Try 10 times
                resp = await client.get(job_url, headers=self.headers)
                resp.raise_for_status()
                job_data = resp.json()
                
                step = job_data.get("steps", [{}])[0]
                status = step.get("status")
                
                if status == "success":
                    break
                elif status == "failed":
                    raise Exception(f"Basiq Job Failed: {step.get('result', {}).get('detail', 'Unknown error')}")
                
                await asyncio.sleep(2) # Wait 2s
            else:
                 raise Exception("Basiq Job Timed Out")

            # 2. Get User/Connection from Job
            # The 'source' link in the result usually points to the created resource (e.g. valid user or connection)
            # job_data['links']['source'] -> e.g. https://au-api.basiq.io/users/{id} or /connections/{id}
            
            result_url = job_data.get("links", {}).get("source")
            if not result_url:
                 # Sometimes it's inside steps?
                 # steps[0].result.url?
                 # Let's assume the job was "verify-credentials" or similar.
                 # Actually, usually Basiq Connect job creates a CONNECTION.
                 # Let's fetch the connection ID from the URL.
                 # format: .../users/{uid}/connections/{cid}
                 pass

            # For now, to be safe, let's assume we can traverse to the User.
            # If the job is 'create-connection', the source is likely the Connection.
            # Connection -> User.
            
            conn_resp = await client.get(result_url, headers=self.headers)
            conn_resp.raise_for_status()
            connection = conn_resp.json()
            
            user_url = connection.get("links", {}).get("user") # .../users/{id}
            
            # 3. Fetch Accounts
            accounts_resp = await client.get(f"{user_url}/accounts", headers=self.headers)
            accounts_resp.raise_for_status()
            accounts = accounts_resp.json().get("data", [])
            
            # 4. Fetch Transactions
            transactions_resp = await client.get(f"{user_url}/transactions", headers=self.headers)
            transactions_resp.raise_for_status()
            transactions = transactions_resp.json().get("data", [])
            
            return {
                "accounts": accounts,
                "transactions": transactions
            }
