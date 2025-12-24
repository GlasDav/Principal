"""
AI-powered financial assistant using Google Gemini API.

This service provides natural language Q&A about the user's finances,
leveraging transaction history, budgets, and account data as context.
"""

import os
import json
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
import google.generativeai as genai

logger = logging.getLogger(__name__)


class AIAssistant:
    """Financial AI assistant using Gemini with context about user's finances."""
    
    def __init__(self):
        self.model = None
        self.enabled = False
        self._initialized = False
    
    def _ensure_initialized(self):
        """Lazily initialize the API on first use."""
        if self._initialized:
            return
        
        self._initialized = True
        api_key = os.getenv("GEMINI_API_KEY")
        
        if api_key:
            try:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel('gemini-2.0-flash')
                self.enabled = True
                logger.info("AI Assistant initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize AI Assistant: {e}")
        else:
            logger.info("GEMINI_API_KEY not set - AI Assistant disabled")
    
    def _gather_financial_context(self, user_id: int, db: Session) -> Dict[str, Any]:
        """Gather user's financial data for AI context."""
        from .. import models
        
        today = datetime.now()
        thirty_days_ago = today - timedelta(days=30)
        ninety_days_ago = today - timedelta(days=90)
        
        context = {}
        
        # Get buckets/categories
        buckets = db.query(models.BudgetBucket).filter(
            models.BudgetBucket.user_id == user_id
        ).all()
        context["categories"] = [{"name": b.name, "group": b.group} for b in buckets if not b.is_transfer]
        bucket_map = {b.id: b.name for b in buckets}
        # Get IDs of transfer buckets to exclude
        transfer_bucket_ids = [b.id for b in buckets if b.is_transfer]
        
        # Get spending by category (last 30 days)
        spending_by_cat = db.query(
            models.Transaction.bucket_id,
            func.sum(models.Transaction.amount)
        ).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.date >= thirty_days_ago,
            models.Transaction.amount < 0
        ).group_by(models.Transaction.bucket_id).all()
        
        context["spending_last_30_days"] = {
            bucket_map.get(bid, "Uncategorized"): abs(amt) 
            for bid, amt in spending_by_cat if amt and bid not in transfer_bucket_ids
        }
        
        # Get total income and expenses separately (to avoid SQLAlchemy case syntax issues)
        income_total = db.query(
            func.sum(models.Transaction.amount)
        ).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.date >= thirty_days_ago,
            models.Transaction.amount > 0
        ).scalar() or 0
        
        expense_total = db.query(
            func.sum(models.Transaction.amount)
        ).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.date >= thirty_days_ago,
            models.Transaction.amount < 0
        ).scalar() or 0
        
        context["income_last_30_days"] = float(income_total)
        context["expenses_last_30_days"] = abs(float(expense_total))
        context["net_savings_last_30_days"] = context["income_last_30_days"] - context["expenses_last_30_days"]
        
        # Get accounts summary
        accounts = db.query(models.Account).filter(
            models.Account.user_id == user_id,
            models.Account.is_active == True
        ).all()
        
        total_assets = sum(a.balance for a in accounts if a.type == "Asset")
        total_liabilities = abs(sum(a.balance for a in accounts if a.type == "Liability"))
        context["net_worth"] = total_assets - total_liabilities
        context["total_assets"] = total_assets
        context["total_liabilities"] = total_liabilities
        
        # Get recent large transactions
        large_txns = db.query(models.Transaction).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.date >= thirty_days_ago,
            models.Transaction.amount < -100  # Expenses over $100
        ).order_by(models.Transaction.amount.asc()).limit(5).all()
        
        context["largest_expenses"] = [
            {"description": t.description, "amount": abs(t.amount), "date": t.date.strftime("%Y-%m-%d")}
            for t in large_txns
        ]
        
        # Get subscriptions
        subs = db.query(models.Subscription).filter(
            models.Subscription.user_id == user_id,
            models.Subscription.is_active == True
        ).all()
        context["active_subscriptions"] = [
            {"name": s.name, "amount": s.amount, "frequency": s.frequency}
            for s in subs
        ]
        
        return context
    
    def _build_prompt(self, question: str, context: Dict[str, Any]) -> str:
        """Build the prompt with financial context."""
        
        context_summary = f"""
USER'S FINANCIAL SNAPSHOT:
- Net Worth: ${context.get('net_worth', 0):,.2f}
- Total Assets: ${context.get('total_assets', 0):,.2f}
- Total Liabilities: ${context.get('total_liabilities', 0):,.2f}

LAST 30 DAYS:
- Income: ${context.get('income_last_30_days', 0):,.2f}
- Expenses: ${context.get('expenses_last_30_days', 0):,.2f}
- Net Savings: ${context.get('net_savings_last_30_days', 0):,.2f}

SPENDING BY CATEGORY (Last 30 Days):
{json.dumps(context.get('spending_last_30_days', {}), indent=2)}

LARGEST RECENT EXPENSES:
{json.dumps(context.get('largest_expenses', []), indent=2)}

ACTIVE SUBSCRIPTIONS:
{json.dumps(context.get('active_subscriptions', []), indent=2)}

BUDGET CATEGORIES:
{', '.join(c['name'] for c in context.get('categories', []))}
"""
        
        prompt = f"""You are a helpful financial assistant for a personal finance app called Principal Finance.
        
{context_summary}

USER QUESTION: {question}

INSTRUCTIONS:
- Answer the user's question based on their financial data above
- Be concise and direct
- Use Australian Dollar ($) format
- If the data doesn't contain enough information, say so
- Provide actionable insights when relevant
- Keep responses under 200 words unless the question requires more detail

Answer:"""
        
        return prompt
    
    def answer_query(self, user_id: int, question: str, db: Session) -> Dict[str, Any]:
        """Answer a natural language question about user's finances."""
        self._ensure_initialized()
        
        if not self.enabled:
            return {
                "answer": "AI assistant is not available. Please configure GEMINI_API_KEY.",
                "data_points": [],
                "suggestions": []
            }
        
        if not question or not question.strip():
            return {
                "answer": "Please ask a question about your finances.",
                "data_points": [],
                "suggestions": [
                    "How much did I spend last month?",
                    "What are my biggest expenses?",
                    "Am I on track with my budget?"
                ]
            }
        
        try:
            # Gather context
            context = self._gather_financial_context(user_id, db)
            
            # Build and send prompt
            prompt = self._build_prompt(question, context)
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=1024,
                    temperature=0.7,
                ),
                request_options={"timeout": 30}
            )
            
            answer = response.text.strip()
            
            # Generate follow-up suggestions
            suggestions = self._generate_suggestions(question, context)
            
            # Extract relevant data points
            data_points = self._extract_data_points(question, context)
            
            return {
                "answer": answer,
                "data_points": data_points,
                "suggestions": suggestions
            }
            
        except Exception as e:
            logger.error(f"AI query failed: {e}")
            return {
                "answer": f"I encountered an error processing your question. Please try again.",
                "data_points": [],
                "suggestions": ["What are my top spending categories?"]
            }
    
    def _generate_suggestions(self, question: str, context: Dict) -> List[str]:
        """Generate follow-up question suggestions."""
        suggestions = []
        
        # Based on context, suggest relevant follow-ups
        if context.get("spending_last_30_days"):
            top_category = max(context["spending_last_30_days"].items(), key=lambda x: x[1], default=(None, 0))
            if top_category[0]:
                suggestions.append(f"How can I reduce spending on {top_category[0]}?")
        
        if context.get("net_savings_last_30_days", 0) < 0:
            suggestions.append("Why am I spending more than I earn?")
        
        if context.get("active_subscriptions"):
            suggestions.append("Which subscriptions should I cancel?")
        
        if not suggestions:
            suggestions = [
                "How is my spending trending?",
                "What's my biggest expense category?",
                "Am I saving enough?"
            ]
        
        return suggestions[:3]
    
    def _extract_data_points(self, question: str, context: Dict) -> List[Dict]:
        """Extract relevant data points for the UI."""
        data_points = []
        
        question_lower = question.lower()
        
        if any(word in question_lower for word in ["spend", "expense", "spent"]):
            for cat, amount in list(context.get("spending_last_30_days", {}).items())[:5]:
                data_points.append({
                    "label": cat,
                    "value": f"${amount:,.2f}",
                    "type": "spending"
                })
        
        if any(word in question_lower for word in ["worth", "asset", "balance"]):
            data_points.append({
                "label": "Net Worth",
                "value": f"${context.get('net_worth', 0):,.2f}",
                "type": "net_worth"
            })
        
        if any(word in question_lower for word in ["save", "saving"]):
            data_points.append({
                "label": "Monthly Savings",
                "value": f"${context.get('net_savings_last_30_days', 0):,.2f}",
                "type": "savings"
            })
        
        return data_points


# Singleton instance
_ai_assistant = None


def get_ai_assistant() -> AIAssistant:
    """Get or create the AI assistant singleton."""
    global _ai_assistant
    if _ai_assistant is None:
        _ai_assistant = AIAssistant()
    return _ai_assistant
