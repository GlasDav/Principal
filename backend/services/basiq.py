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
        
        # Debug logging
        logger.info(f"BasiqService initialized - is_mock: {self.is_mock}, api_key present: {bool(self.api_key)}")
        if self.api_key:
            logger.info(f"API Key (first 20 chars): {self.api_key[:20]}...")
        
        # We need a shared client in a real app, but for simplicity we create one per request or use context manager
        self.headers = {
            "Authorization": f"Basic {self.api_key}",
            "Content-Type": "application/x-www-form-urlencoded",
            "basiq-version": "3.0"
        }

    async def get_client_token(self, user_id_context: str = None):
        """
        Get a CLIENT_ACCESS token from Basiq for frontend SDK initialization.
        
        Returns mock token if BASIQ_API_KEY is not configured.
        """
        if self.is_mock:
            logger.info("🎭 Mock mode: Returning mock token")
            return {"access_token": "mock_client_token_123", "token_type": "Bearer", "expires_in": 3600}
        
        logger.info(f"🔐 Requesting CLIENT_ACCESS token from Basiq")
        logger.debug(f"   User context: {user_id_context}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                data = {"scope": "CLIENT_ACCESS"}
                
                logger.debug(f"   POST {BASIQ_API_URL}/token")
                logger.debug(f"   Scope: CLIENT_ACCESS")
                
                response = await client.post(
                    f"{BASIQ_API_URL}/token",
                    headers=self.headers,
                    data=data
                )
                
                logger.debug(f"   Response status: {response.status_code}")
                
                if response.status_code == 200:
                    token_data = response.json()
                    logger.info(f"✅ Token received successfully (expires in {token_data.get('expires_in')}s)")
                    return token_data
                else:
                    logger.error(f"❌ Token request failed with status {response.status_code}")
                    logger.error(f"   Response: {response.text}")
                    response.raise_for_status()
                    
        except httpx.TimeoutException:
            logger.error("❌ Basiq token request timed out (>30s)")
            raise Exception("Basiq API is unreachable. Please try again later.")
        except httpx.HTTPStatusError as e:
            logger.error(f"❌ Basiq API error: {e.response.status_code}")
            logger.error(f"   Response: {e.response.text}")
            if e.response.status_code == 401:
                raise Exception("Invalid Basiq API key. Please check your configuration.")
            elif e.response.status_code == 403:
                raise Exception("Basiq API access denied. Please verify your API key permissions.")
            else:
                raise Exception(f"Basiq API error: {e.response.text}")
        except Exception as e:
            logger.error(f"❌ Unexpected error getting Basiq token: {str(e)}")
            raise

    async def get_connection_data(self, job_id: str):
        """
        Poll a Basiq job until complete, then fetch account and transaction data.
        
        Args:
            job_id: The job ID returned from Basiq consent flow
            
        Returns:
            dict with 'accounts' and 'transactions' lists
        """
        if self.is_mock:
            logger.info("🎭 Mock mode: Returning mock account data")
            # Mock Data
            from datetime import datetime, timedelta
            return {
                "accounts": [
                    {"id": "acc_1", "accountNo": "12345678", "name": "Everyday Saver", "currency": "AUD", "balance": 5420.50, "class": "transaction"},
                    {"id": "acc_2", "accountNo": "87654321", "name": "Credit Card", "currency": "AUD", "balance": -1250.00, "class": "credit-card"},
                ],
                "transactions": [
                    {
                        "id": "txn_real_1", 
                        "description": "Woolworths Real", 
                        "amount": -150.00, 
                        "postDate": (datetime.now()).isoformat(),
                        "links": {"account": "acc_1"} 
                    },
                    {
                        "id": "txn_real_2", 
                        "description": "Salary", 
                        "amount": 5000.00, 
                        "postDate": (datetime.now()).isoformat(),
                        "links": {"account": "acc_1"} 
                    },
                    {
                        "id": "txn_real_3", 
                        "description": "Credit Card Repayment", 
                        "amount": -1000.00, 
                        "postDate": (datetime.now()).isoformat(),
                        "links": {"account": "acc_2"} 
                    }
                ]
            }

        logger.info(f"📥 Fetching connection data for job: {job_id}")
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                job_url = f"{BASIQ_API_URL}/jobs/{job_id}"
                
                # Polling loop
                logger.info("⏳ Polling job status...")
                for attempt in range(30):  # Increased from 10 to 30 (60s total)
                    logger.debug(f"   Poll attempt {attempt + 1}/30")
                    
                    resp = await client.get(job_url, headers=self.headers)
                    
                    if resp.status_code != 200:
                        logger.error(f"❌ Job polling failed with status {resp.status_code}")
                        logger.error(f"   Response: {resp.text}")
                        resp.raise_for_status()
                    
                    job_data = resp.json()
                    
                    step = job_data.get("steps", [{}])[0]
                    status = step.get("status")
                    
                    logger.debug(f"   Job status: {status}")
                    
                    if status == "success":
                        logger.info("✅ Job completed successfully")
                        break
                    elif status == "failed":
                        error_detail = step.get('result', {}).get('detail', 'Unknown error')
                        logger.error(f"❌ Basiq job failed: {error_detail}")
                        raise Exception(f"Basiq connection failed: {error_detail}")
                    
                    await asyncio.sleep(2)  # Wait 2s before next poll
                else:
                    logger.error("❌ Job polling timed out after 60 seconds")
                    raise Exception("Basiq connection timed out. Please try again.")

                # 2. Get Connection/User from Job Result
                logger.info("📋 Extracting connection details...")
                result_url = job_data.get("links", {}).get("source")
                
                if not result_url:
                    logger.warning("⚠️ No 'source' link in job response, checking alternatives...")
                    # Try to extract from steps
                    result_url = step.get("result", {}).get("url")
                    
                if not result_url:
                    logger.error("❌ Could not find result URL in job response")
                    logger.error(f"   Job data: {job_data}")
                    raise Exception("Invalid job response from Basiq")
                
                logger.debug(f"   Result URL: {result_url}")
                
                # 3. Fetch Connection details
                logger.info("🔗 Fetching connection details...")
                conn_resp = await client.get(result_url, headers=self.headers)
                conn_resp.raise_for_status()
                connection = conn_resp.json()
                
                user_url = connection.get("links", {}).get("user")
                if not user_url:
                    logger.error("❌ No user link in connection response")
                    raise Exception("Invalid connection response from Basiq")
                
                logger.debug(f"   User URL: {user_url}")
                
                # 4. Fetch Accounts
                logger.info("💳 Fetching accounts...")
                accounts_resp = await client.get(f"{user_url}/accounts", headers=self.headers)
                accounts_resp.raise_for_status()
                accounts = accounts_resp.json().get("data", [])
                logger.info(f"✅ Retrieved {len(accounts)} accounts")
                
                # 5. Fetch Transactions
                logger.info("📊 Fetching transactions...")
                transactions_resp = await client.get(f"{user_url}/transactions", headers=self.headers)
                transactions_resp.raise_for_status()
                transactions = transactions_resp.json().get("data", [])
                logger.info(f"✅ Retrieved {len(transactions)} transactions")
                
                return {
                    "accounts": accounts,
                    "transactions": transactions
                }
                
        except httpx.TimeoutException:
            logger.error("❌ Basiq request timed out")
            raise Exception("Basiq connection timed out. Please try again.")
        except httpx.HTTPStatusError as e:
            logger.error(f"❌ Basiq API error: {e.response.status_code}")
            logger.error(f"   Response: {e.response.text}")
            if e.response.status_code == 401:
                raise Exception("Basiq authentication failed. Please check your API key.")
            elif e.response.status_code == 404:
                raise Exception("Basiq job not found. It may have expired.")
            else:
                raise Exception(f"Basiq API error: {e.response.text}")
        except Exception as e:
            if "Basiq" in str(e):
                raise  # Re-raise Basiq-specific errors
            logger.error(f"❌ Unexpected error fetching Basiq data: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            raise Exception(f"Failed to fetch bank data: {str(e)}")

