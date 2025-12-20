"""
AI-powered transaction categorization using Google Gemini API.

This service provides intelligent categorization for transactions that 
the rule-based system cannot match, using natural language understanding.
"""

import os
import json
import logging
from typing import List, Tuple, Optional, Dict
import google.generativeai as genai

logger = logging.getLogger(__name__)

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

class AICategorizer:
    """AI-powered transaction categorization using Gemini."""
    
    def __init__(self):
        self.model = None
        self.enabled = False
        
        if GEMINI_API_KEY:
            try:
                genai.configure(api_key=GEMINI_API_KEY)
                self.model = genai.GenerativeModel('gemini-1.5-flash')
                self.enabled = True
                logger.info("AI Categorizer initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini API: {e}")
        else:
            logger.info("GEMINI_API_KEY not set - AI categorization disabled")
    
    async def categorize_batch(
        self, 
        transactions: List[Dict], 
        bucket_names: List[str]
    ) -> Dict[int, Tuple[str, float]]:
        """
        Categorize a batch of transactions using AI.
        
        Args:
            transactions: List of dicts with 'id', 'description', 'amount'
            bucket_names: List of user's budget category names
            
        Returns:
            Dict mapping transaction index to (bucket_name, confidence)
        """
        if not self.enabled or not transactions:
            return {}
        
        # Limit batch size to 50 for API efficiency
        batch = transactions[:50]
        
        # Build the prompt
        prompt = self._build_prompt(batch, bucket_names)
        
        try:
            response = await self._call_gemini(prompt)
            return self._parse_response(response, len(batch), bucket_names)
        except Exception as e:
            logger.error(f"AI categorization failed: {e}")
            return {}
    
    def categorize_batch_sync(
        self, 
        transactions: List[Dict], 
        bucket_names: List[str]
    ) -> Dict[int, Tuple[str, float]]:
        """Synchronous version for non-async contexts."""
        if not self.enabled or not transactions:
            return {}
        
        batch = transactions[:50]
        prompt = self._build_prompt(batch, bucket_names)
        
        try:
            response = self.model.generate_content(prompt)
            return self._parse_response(response.text, len(batch), bucket_names)
        except Exception as e:
            logger.error(f"AI categorization failed: {e}")
            return {}
    
    def _build_prompt(self, transactions: List[Dict], bucket_names: List[str]) -> str:
        """Build the categorization prompt for Gemini."""
        
        # Format transactions for the prompt
        txn_list = []
        for i, txn in enumerate(transactions):
            desc = txn.get('description', txn.get('raw_description', ''))
            amount = txn.get('amount', 0)
            txn_list.append(f"{i}. \"{desc}\" (${abs(amount):.2f})")
        
        txn_text = "\n".join(txn_list)
        buckets_text = ", ".join(bucket_names)
        
        prompt = f"""You are a financial transaction categorizer. Analyze each transaction and assign it to the most appropriate category.

AVAILABLE CATEGORIES:
{buckets_text}

TRANSACTIONS TO CATEGORIZE:
{txn_text}

INSTRUCTIONS:
1. For each transaction, determine the best matching category from the list above
2. Only use categories from the provided list - do not invent new ones
3. If no category fits well, use "Uncategorized"
4. Consider the merchant name, amount, and typical spending patterns

RESPOND WITH ONLY A JSON ARRAY in this exact format:
[
  {{"index": 0, "category": "CategoryName", "confidence": 0.9}},
  {{"index": 1, "category": "CategoryName", "confidence": 0.8}},
  ...
]

Where:
- index: the transaction number (0-indexed)
- category: exact category name from the list above
- confidence: 0.5-1.0 (how confident you are in this categorization)

JSON RESPONSE:"""
        
        return prompt
    
    async def _call_gemini(self, prompt: str) -> str:
        """Call Gemini API asynchronously."""
        response = await self.model.generate_content_async(prompt)
        return response.text
    
    def _parse_response(
        self, 
        response_text: str, 
        batch_size: int,
        bucket_names: List[str]
    ) -> Dict[int, Tuple[str, float]]:
        """Parse Gemini's JSON response into categorization results."""
        
        results = {}
        
        # Clean up response - extract JSON if wrapped in markdown
        text = response_text.strip()
        if text.startswith("```"):
            # Remove markdown code blocks
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        
        try:
            predictions = json.loads(text)
            
            # Validate bucket names (case-insensitive matching)
            bucket_lookup = {b.lower(): b for b in bucket_names}
            
            for pred in predictions:
                idx = pred.get("index")
                category = pred.get("category", "")
                confidence = pred.get("confidence", 0.7)
                
                if idx is not None and 0 <= idx < batch_size:
                    # Match category to user's bucket (case-insensitive)
                    matched_bucket = bucket_lookup.get(category.lower(), category)
                    
                    # Only include if category exists in user's buckets
                    if matched_bucket.lower() in bucket_lookup:
                        results[idx] = (matched_bucket, min(confidence, 0.85))
                    # Don't include "Uncategorized" predictions
                    
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse AI response as JSON: {e}")
            logger.debug(f"Response was: {response_text[:500]}")
        
        return results


# Singleton instance for reuse
_ai_categorizer = None

def get_ai_categorizer() -> AICategorizer:
    """Get or create the AI categorizer singleton."""
    global _ai_categorizer
    if _ai_categorizer is None:
        _ai_categorizer = AICategorizer()
    return _ai_categorizer
