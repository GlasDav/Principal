import os
import logging
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Environment Validation
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
SECRET_KEY = os.getenv("SECRET_KEY")

# Configure structured logging BEFORE any other imports
from .logging_config import configure_logging
logger = configure_logging(
    environment=ENVIRONMENT,
    log_level=os.getenv("LOG_LEVEL", "INFO")
)

logger.info(f"Starting Principal Finance API in {ENVIRONMENT} mode")

# Validate production configuration
if ENVIRONMENT == "production":
    if not SECRET_KEY or SECRET_KEY in ["your-256-bit-secret-key-here", "dev-secret-key-change-in-production"]:
        raise ValueError(
            "SECRET_KEY must be set to a strong random value in production! "
            "Generate one with: python -c 'import secrets; print(secrets.token_hex(32))'"
        )
    logger.info("✅ Production environment validated")

# Optional: Initialize Sentry for error monitoring
SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=ENVIRONMENT,
            traces_sample_rate=0.1,  # 10% of transactions for performance monitoring
            profiles_sample_rate=0.1,  # 10% profiling in production
        )
        logger.info("✅ Sentry error monitoring initialized")
    except ImportError:
        logger.warning("⚠️  Sentry SDK not installed. Install with: pip install sentry-sdk")
else:
    logger.info("ℹ️  Sentry not configured (set SENTRY_DSN to enable error monitoring)")

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .database import engine, Base
from .routers import (
    settings, ingestion, transactions, analytics,
    net_worth, auth, market, rules, goals, taxes, 
    connections, investments, notifications, export, api_keys, household
)

# Create tables
Base.metadata.create_all(bind=engine)

# Run auto-migrations for schema updates
from .migrations import run_migrations
run_migrations(engine)

# === RATE LIMITER ===
# Configurable via environment, default: 100 requests per minute per IP
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Principal Finance API",
    description="""
## Personal Finance Management API

Comprehensive API for managing personal finances including:
* **Authentication** - Secure login with JWT tokens and MFA support
* **Transactions** - Track income and expenses with categorization
* **Budgets** - Set and monitor budget goals by category
* **Analytics** - Financial insights and spending trends
* **Net Worth** - Track assets, liabilities, and investments
* **Investments** - Portfolio tracking with real-time prices
* **Goals** - Savings goals with progress tracking
* **Subscriptions** - Recurring expense management

### Features
* 🔐 Secure authentication with refresh tokens
* 📊 Real-time financial analytics
* 📈 Investment portfolio tracking
* 💰 Budget monitoring with alerts
* 🏦 Bank account aggregation
* 🤖 AI-powered transaction categorization
* 👥 Family sharing & household management

### Getting Started
1. Register a new account at `/auth/register`
2. Login to receive access tokens at `/auth/token`
3. Use the access token in Authorization header: `Bearer <token>`
4. Explore the interactive documentation below

### Rate Limits
- Default: 100 requests per minute per IP
- Auth endpoints: 10 requests per minute
- Sensitive operations: Custom limits apply
    """,
    version="1.0.0",
    contact={
        "name": "Principal Finance",
        "email": "support@principal.finance",
    },
    license_info={
        "name": "MIT",
    },
    openapi_tags=[
        {"name": "auth", "description": "Authentication and user management"},
        {"name": "transactions", "description": "Transaction operations"},
        {"name": "budgets", "description": "Budget management"},
        {"name": "analytics", "description": "Financial analytics and insights"},
        {"name": "net-worth", "description": "Net worth and investment tracking"},
        {"name": "goals", "description": "Financial goals"},
        {"name": "subscriptions", "description": "Recurring expenses"},
    ]
)

# Register rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# === SECURITY HEADERS MIDDLEWARE ===
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # XSS Protection
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Content Type Sniffing Prevention
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Clickjacking Prevention
        response.headers["X-Frame-Options"] = "DENY"
        
        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content Security Policy (adjust as needed for your frontend)
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        
        # HSTS (only in production over HTTPS)
        if os.getenv("ENVIRONMENT", "development") == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Permissions Policy (disable unnecessary browser features)
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        return response


# === COMPRESSION ===
# Compress responses > 500 bytes for faster network transfer
app.add_middleware(GZipMiddleware, minimum_size=500)

# === REQUEST ID MIDDLEWARE ===
# Add unique request ID to each request for tracing through logs
from .middleware.request_id import RequestIDMiddleware
app.add_middleware(RequestIDMiddleware)
logger.info("✅ Request ID middleware enabled")

# Add security headers middleware FIRST (middleware runs in reverse order, so this runs AFTER CORS)
app.add_middleware(SecurityHeadersMiddleware)

# === CORS CONFIGURATION ===
# IMPORTANT: In production, set CORS_ORIGINS to your actual frontend domain
# Example: CORS_ORIGINS=https://principal.com
environment = os.getenv("ENVIRONMENT", "development")
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000")
origins = [origin.strip() for origin in cors_origins.split(",")]

# Production CORS is stricter
if environment == "production":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,  # Only explicitly allowed origins
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],  # Specific methods
        allow_headers=["Authorization", "Content-Type"],  # Specific headers
        expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining"],
    )
else:
    # Development: More permissive for easier testing
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )



# Include routers
app.include_router(auth.router)
app.include_router(settings.router)
app.include_router(ingestion.router)
app.include_router(transactions.router)
app.include_router(analytics.router)
app.include_router(net_worth.router)
app.include_router(market.router)
app.include_router(rules.router)
app.include_router(goals.router)
app.include_router(taxes.router)
app.include_router(connections.router)
app.include_router(investments.router)
app.include_router(notifications.router)
app.include_router(export.router)
app.include_router(api_keys.router)
app.include_router(household.router)


@app.get("/")
def read_root():
    """Root endpoint."""
    return {"message": "Welcome to Principal API"}


@app.get("/health")
def health_check():
    """Health check endpoint for load balancers and monitoring."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "development")
    }

