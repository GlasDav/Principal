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
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./principal_v5.db")

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
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,  # Verify connections before use
        pool_recycle=300,    # Recycle connections every 5 minutes to prevent stale connections
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
        db.close()
