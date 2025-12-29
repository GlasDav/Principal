"""
Request ID Middleware
Adds unique request ID to each request for tracing through logs
"""
import uuid
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add a unique request ID to each request.
    
    The request ID is:
    - Generated as a UUID4
    - Stored in request.state.request_id
    - Added to response headers as X-Request-ID
    - Available for logging throughout request lifecycle
    """
    
    async def dispatch(self, request: Request, call_next):
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        
        # Store in request state for access in route handlers
        request.state.request_id = request_id
        
        # Log incoming request with ID
        logger.info(
            f"Incoming request",
            extra={
                'request_id': request_id,
                'method': request.method,
                'path': request.url.path,
                'client_ip': request.client.host if request.client else None,
            }
        )
        
        # Process request
        try:
            response = await call_next(request)
            
            # Add request ID to response headers for client debugging
            response.headers['X-Request-ID'] = request_id
            
            # Log outgoing response
            logger.info(
                f"Request completed",
                extra={
                    'request_id': request_id,
                    'status_code': response.status_code,
                }
            )
            
            return response
            
        except Exception as e:
            # Log errors with request ID for debugging
            logger.error(
                f"Request failed: {str(e)}",
                extra={'request_id': request_id},
                exc_info=True
            )
            raise


def get_request_id(request: Request) -> str:
    """
    Helper function to get request ID from request state.
    
    Usage in route handlers:
        request_id = get_request_id(request)
        logger.info("Processing...", extra={'request_id': request_id})
    """
    return getattr(request.state, 'request_id', 'unknown')
