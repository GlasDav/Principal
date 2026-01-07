"""
Principal Finance - Analytics Tests

Tests for:
- Dashboard summary data
- Spending trends
- Sankey diagram data
- Insights and anomaly detection
"""
import pytest
from datetime import datetime, timedelta


class TestDashboardSummary:
    """Tests for dashboard summary endpoint."""
    
    def test_get_dashboard_empty(self, client, auth_headers, date_range):
        """Dashboard returns data for user with no transactions."""
        response = client.get(
            f"/analytics/dashboard?start_date={date_range['start_date']}&end_date={date_range['end_date']}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # Response has nested totals structure
        assert "totals" in data
        assert "income" in data["totals"]
        assert "expenses" in data["totals"]
    
    def test_get_dashboard_with_data(self, client, auth_headers, date_range, sample_transactions):
        """Dashboard includes transactions."""
        response = client.get(
            f"/analytics/dashboard?start_date={date_range['start_date']}&end_date={date_range['end_date']}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # Sample transactions are all negative (expenses)
        assert data["totals"]["expenses"] != 0


class TestSpendingHistory:
    """Tests for spending history endpoint."""
    
    def test_get_spending_history(self, client, auth_headers, date_range, sample_transactions):
        """Get spending trends over time."""
        response = client.get(
            f"/analytics/history?start_date={date_range['start_date']}&end_date={date_range['end_date']}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestSankeyData:
    """Tests for Sankey diagram data endpoint."""
    
    def test_get_sankey_data(self, client, auth_headers, date_range, sample_transactions):
        """Get Sankey diagram data."""
        response = client.get(
            f"/analytics/sankey?start_date={date_range['start_date']}&end_date={date_range['end_date']}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "links" in data
    
    def test_sankey_data_empty(self, client, auth_headers, date_range):
        """Sankey returns structure when no data."""
        response = client.get(
            f"/analytics/sankey?start_date={date_range['start_date']}&end_date={date_range['end_date']}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "links" in data


class TestAnomalies:
    """Tests for anomaly detection endpoint."""
    
    def test_get_anomalies(self, client, auth_headers, sample_transactions):
        """Get spending anomalies."""
        response = client.get("/analytics/anomalies", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_anomalies_empty_data(self, client, auth_headers):
        """Anomalies handles empty data gracefully."""
        response = client.get("/analytics/anomalies", headers=auth_headers)
        assert response.status_code == 200


class TestProjections:
    """Tests for projection endpoints."""
    
    def test_cashflow_projection(self, client, auth_headers):
        """Cash flow projection returns data."""
        response = client.get("/analytics/cashflow-projection", headers=auth_headers)
        assert response.status_code == 200
    
    def test_networth_projection(self, client, auth_headers):
        """Net worth projection returns data."""
        response = client.get("/analytics/networth-projection", headers=auth_headers)
        assert response.status_code == 200


class TestCategoryHistory:
    """Tests for category history endpoint."""
    
    def test_get_category_history(self, client, auth_headers, sample_bucket):
        """Get spending history for a category."""
        response = client.get(
            f"/analytics/category-history/{sample_bucket.id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "bucket_name" in data
        assert "history" in data
        assert "stats" in data
    
    def test_category_history_not_found(self, client, auth_headers):
        """Category history returns 404 for non-existent bucket."""
        response = client.get(
            "/analytics/category-history/99999",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestGroupSpending:
    """Tests for group spending endpoint."""
    
    def test_get_group_spending(self, client, auth_headers, date_range):
        """Get spending aggregated by group."""
        response = client.get(
            f"/analytics/group-spending?start_date={date_range['start_date']}&end_date={date_range['end_date']}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "groups" in data
        assert "total_expenses" in data


class TestPerformanceData:
    """Tests for performance tab endpoint."""
    
    def test_get_performance_data(self, client, auth_headers):
        """Performance endpoint returns 12 months of data."""
        response = client.get("/analytics/performance", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "months" in data
        assert "categories" in data
        assert len(data["months"]) == 12
    
    def test_performance_with_spender_filter(self, client, auth_headers):
        """Performance endpoint accepts spender filter."""
        response = client.get("/analytics/performance?spender=Joint", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data

