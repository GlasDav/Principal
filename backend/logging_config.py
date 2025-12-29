"""
Structured Logging Configuration
JSON formatter for production logging with context
"""
import logging
import json
from datetime import datetime
from typing import Optional


class JSONFormatter(logging.Formatter):
    """
    Formats log records as JSON for structured logging.
    
    Includes:
    - timestamp (ISO 8601)
    - level (INFO, ERROR, etc.)
    - message
    - logger name
    - request_id (if available)
    - user_id (if available)
    - exception info (if present)
    """
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }
        
        # Add request ID if available
        if hasattr(record, 'request_id'):
            log_data['request_id'] = record.request_id
        
        # Add user ID if available
        if hasattr(record, 'user_id'):
            log_data['user_id'] = record.user_id
        
        # Add file location for debugging
        if record.levelno >= logging.WARNING:
            log_data['file'] = f"{record.filename}:{record.lineno}"
            log_data['function'] = record.funcName
        
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        # Add any extra fields passed to logger
        for key, value in record.__dict__.items():
            if key not in ['name', 'msg', 'args', 'created', 'filename', 'funcName', 
                          'levelname', 'levelno', 'lineno', 'module', 'msecs', 
                          'message', 'pathname', 'process', 'processName', 'relativeCreated',
                          'thread', 'threadName', 'exc_info', 'exc_text', 'stack_info',
                          'request_id', 'user_id']:
                if not key.startswith('_'):
                    log_data[key] = value
        
        return json.dumps(log_data)


def configure_logging(environment: str = "development", log_level: str = "INFO"):
    """
    Configure application logging based on environment.
    
    Args:
        environment: "development" or "production"
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
    
    Development: Human-readable format with colors
    Production: JSON format for log aggregation
    """
    root_logger = logging.getLogger()
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create console handler
    console = logging.StreamHandler()
    
    # Set formatter based on environment
    if environment == "production":
        formatter = JSONFormatter()
    else:
        # Development: readable format
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    console.setFormatter(formatter)
    root_logger.addHandler(console)
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Reduce noise from third-party libraries
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    
    return root_logger
