# Principal Finance - Test Suite

## Running Tests

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=backend --cov-report=html

# Run specific test file
pytest tests/test_auth.py -v

# Run specific test class
pytest tests/test_auth.py::TestLogin -v
```

## Test Structure

- `conftest.py` - Shared fixtures (test database, auth helpers, sample data)
- `test_auth.py` - Authentication tests (33 tests - includes MFA)
- `test_transactions.py` - Transaction CRUD and filtering (12 tests)
- `test_analytics.py` - Dashboard and reporting (13 tests)
- `test_settings.py` - User settings and bucket management (11 tests)
- `test_security.py` - XSS protection and input sanitization (17 tests)

**Total: 86 tests**

## Key Fixtures

- `test_db` - In-memory SQLite database
- `client` - FastAPI TestClient
- `auth_headers` - JWT authentication headers
- `sample_bucket` - Test budget category
- `sample_transactions` - Sample transaction data
- `sample_account` - Sample bank accounts
