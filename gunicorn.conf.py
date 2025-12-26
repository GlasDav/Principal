# Production Server Configuration

# Use this to run the backend in production with multiple workers
# Each worker can handle requests concurrently, multiplying throughput

# Basic usage (4 workers recommended for 4 CPU cores):
# gunicorn backend.main:app -c gunicorn.conf.py

import multiprocessing
import os

# Bind to all interfaces on port 8000
bind = os.getenv("BIND", "0.0.0.0:8000")

# Number of worker processes
# Rule of thumb: 2-4 workers per CPU core
workers = int(os.getenv("WORKERS", multiprocessing.cpu_count() * 2 + 1))

# Worker class - use uvicorn for async support
worker_class = "uvicorn.workers.UvicornWorker"

# Worker timeout (seconds)
timeout = 120

# Keep-alive timeout
keepalive = 5

# Maximum requests per worker before restart (prevents memory leaks)
max_requests = 1000
max_requests_jitter = 50

# Graceful timeout
graceful_timeout = 30

# Access log - use '-' for stdout
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")

# Preload app for faster worker startup
preload_app = True

# Process naming
proc_name = "principal-api"
