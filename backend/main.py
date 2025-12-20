import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .database import engine, Base
from .routers import (
    settings, ingestion, transactions, analytics, 
    net_worth, auth, market, rules, goals, taxes, 
    connections, investments
)

# Create tables
Base.metadata.create_all(bind=engine)

# === RATE LIMITER ===
# Configurable via environment, default: 100 requests per minute per IP
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Principal Finance API",
    description="Personal finance management API",
    version="1.0.0"
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


# Add security headers middleware
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

