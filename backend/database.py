import os
import logging

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Database configuration from environment
# Supports SQLite (development) and PostgreSQL (production)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dollardata.db")

# Engine configuration differs by database type
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    # SQLite-specific settings
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )
    logger.info("Using SQLite database (development mode)")
else:
    # PostgreSQL and other databases
    connect_args = {}
    if "supabase.co" in SQLALCHEMY_DATABASE_URL or "sslmode=require" in SQLALCHEMY_DATABASE_URL:
        connect_args["sslmode"] = "require"
    
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args=connect_args
    )
    logger.info("Using PostgreSQL database (production mode)")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Database session dependency for FastAPI."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        try:
            db.close()
        except Exception:
            # If closing fails (e.g. transaction aborted), likely due to previous error.
            # Suppress this so the original error surfaces.
            pass
