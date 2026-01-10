"""
DollarData - Configuration Settings

Centralized configuration management with validation.
Fails fast on startup if required environment variables are missing.
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import validator


class Settings(BaseSettings):
    """Application settings with validation."""
    
    # Security
    SECRET_KEY: str
    ENVIRONMENT: str = "development"
    
    # Database
    DATABASE_URL: str = "sqlite:///./dollardata.db"
    
    # Authentication
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    
    # External Services
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    BASIQ_API_KEY: Optional[str] = None
    SENTRY_DSN: Optional[str] = None
    
    # Redis (Optional)
    REDIS_URL: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    @validator("SECRET_KEY")
    def validate_secret_key(cls, v, values):
        """Ensure SECRET_KEY is secure in production."""
        environment = values.get("ENVIRONMENT", "development")
        
        if environment == "production":
            # Check if using default/weak secret
            weak_secrets = [
                "your-256-bit-secret-key-here",
                "dev-secret-key-change-in-production",
                "secret",
                "changeme"
            ]
            
            if v in weak_secrets or len(v) < 32:
                raise ValueError(
                    "SECRET_KEY must be a strong random string (32+ characters) in production. "
                    "Generate one with: python -c 'import secrets; print(secrets.token_hex(32))'"
                )
        
        return v
    
    @validator("CORS_ORIGINS")
    def validate_cors(cls, v, values):
        """Warn if CORS allows all origins in production."""
        environment = values.get("ENVIRONMENT", "development")
        
        if environment == "production" and ("*" in v or "localhost" in v):
            import logging
            logging.warning(
                "⚠️  CORS_ORIGINS contains localhost or wildcard in production! "
                "Set to your actual domain: https://yourdomain.com"
            )
        
        return v
    
    def get_cors_origins_list(self) -> list[str]:
        """Parse CORS origins string into list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


# Singleton instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get application settings singleton."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


# Initialize on import to fail fast
try:
    settings = get_settings()
except Exception as e:
    print(f"❌ Configuration Error: {e}")
    print("💡 Please check your .env file and ensure all required variables are set.")
    raise
