"""
Principal Finance - AI Chat and Savings Opportunities Tests

Tests for Phase 5: Intelligence & Forecasting features.
"""
import pytest
from datetime import datetime, timedelta


class TestAIChat:
    """Tests for AI chat endpoint."""
    
    def test_chat_endpoint_returns_response(self, client, auth_headers):
        """Chat endpoint returns a valid response structure."""
        response = client.post(
            "/analytics/chat",
            json={"question": "How much did I spend last month?"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "suggestions" in data
        assert "data_points" in data
    
    def test_chat_requires_auth(self, client):
        """Chat endpoint requires authentication."""
        response = client.post("/analytics/chat", json={"question": "test"})
        assert response.status_code == 401
    
    def test_chat_handles_empty_question(self, client, auth_headers):
        """Chat handles empty questions gracefully."""
        response = client.post(
            "/analytics/chat",
            json={"question": ""},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        # Should return a prompt to ask a question
        assert len(data["suggestions"]) > 0


class TestSavingsOpportunities:
    """Tests for savings opportunities endpoint."""
    
    def test_savings_endpoint_exists(self, client, auth_headers):
        """Savings opportunities endpoint returns data."""
        response = client.get("/analytics/savings-opportunities", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "opportunities" in data
        assert "total_potential_savings" in data
        assert "count" in data
    
    def test_savings_requires_auth(self, client):
        """Savings endpoint requires authentication."""
        response = client.get("/analytics/savings-opportunities")
        assert response.status_code == 401
    
    def test_savings_returns_list(self, client, auth_headers):
        """Savings opportunities is a list."""
        response = client.get("/analytics/savings-opportunities", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["opportunities"], list)
