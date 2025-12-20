import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import (
    settings, ingestion, transactions, analytics, 
    net_worth, auth, market, rules, goals, taxes, 
    connections, investments
)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Principal Finance API",
    description="Personal finance management API",
    version="1.0.0"
)

# CORS setup - configurable via environment
# IMPORTANT: This must be added before routers
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000")
origins = [origin.strip() for origin in cors_origins.split(",")]

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
        "version": "1.0.0"
    }
