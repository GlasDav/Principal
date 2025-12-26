"""
Redis caching utility for expensive operations.
Falls back gracefully if Redis is not available.
"""

import os
import json
import logging
from typing import Optional, Any, Callable
from functools import wraps
import hashlib

logger = logging.getLogger(__name__)

# Lazy Redis connection - only import if REDIS_URL is set
_redis_client = None

def get_redis():
    """Get Redis client, lazily initialized."""
    global _redis_client
    
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return None
    
    if _redis_client is None:
        try:
            import redis
            _redis_client = redis.from_url(redis_url, decode_responses=True)
            _redis_client.ping()  # Verify connection
            logger.info("Redis connected successfully")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            return None
    
    return _redis_client


def cache_key(*args, **kwargs) -> str:
    """Generate a cache key from arguments."""
    key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
    return hashlib.md5(key_data.encode()).hexdigest()


def cached(prefix: str, ttl: int = 300):
    """
    Decorator to cache function results in Redis.
    
    Args:
        prefix: Cache key prefix (e.g., "analytics:sankey")
        ttl: Time to live in seconds (default 5 minutes)
    
    Usage:
        @cached("analytics:sankey", ttl=600)
        def get_sankey_data(user_id, start_date, end_date):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            redis = get_redis()
            
            # If no Redis, just call the function
            if redis is None:
                return func(*args, **kwargs)
            
            # Generate cache key
            key = f"{prefix}:{cache_key(*args, **kwargs)}"
            
            try:
                # Try to get from cache
                cached_value = redis.get(key)
                if cached_value is not None:
                    logger.debug(f"Cache hit: {key}")
                    return json.loads(cached_value)
                
                # Cache miss - compute and store
                result = func(*args, **kwargs)
                redis.setex(key, ttl, json.dumps(result, default=str))
                logger.debug(f"Cache set: {key}")
                return result
                
            except Exception as e:
                logger.warning(f"Cache error: {e}")
                return func(*args, **kwargs)
        
        return wrapper
    return decorator


def invalidate_cache(pattern: str):
    """
    Invalidate all cache keys matching a pattern.
    
    Args:
        pattern: Redis key pattern (e.g., "analytics:*")
    """
    redis = get_redis()
    if redis is None:
        return
    
    try:
        keys = redis.keys(pattern)
        if keys:
            redis.delete(*keys)
            logger.info(f"Invalidated {len(keys)} cache keys matching {pattern}")
    except Exception as e:
        logger.warning(f"Cache invalidation failed: {e}")


class CacheManager:
    """Centralized cache management for the application."""
    
    # Cache TTL presets (in seconds)
    TTL_SHORT = 60          # 1 minute
    TTL_MEDIUM = 300        # 5 minutes
    TTL_LONG = 3600         # 1 hour
    TTL_DAILY = 86400       # 24 hours
    
    # Key prefixes
    PREFIX_ANALYTICS = "analytics"
    PREFIX_BUCKETS = "buckets"
    PREFIX_TRANSACTIONS = "txn"
    PREFIX_USER = "user"
    
    @staticmethod
    def invalidate_user_analytics(user_id: int):
        """Invalidate all analytics caches for a user."""
        invalidate_cache(f"analytics:*:{user_id}:*")
    
    @staticmethod
    def invalidate_user_transactions(user_id: int):
        """Invalidate transaction-related caches for a user."""
        invalidate_cache(f"txn:*:{user_id}:*")
        invalidate_cache(f"analytics:*:{user_id}:*")
