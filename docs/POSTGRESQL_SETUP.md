# PostgreSQL Deployment Guide

## Quick Start

### Option 1: Supabase (Recommended for getting started)
1. Create free account at [supabase.com](https://supabase.com)
2. Create new project
3. Get connection string from Settings > Database > Connection string (URI)
4. Set environment variable:
   ```
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
   ```

### Option 2: Railway
1. Create account at [railway.app](https://railway.app)
2. New Project > Database > PostgreSQL
3. Copy connection string from Variables

### Option 3: Local Docker
```bash
docker run -d --name dollardata-postgres \
  -e POSTGRES_PASSWORD=secretpassword \
  -e POSTGRES_DB=dollardata \
  -p 5432:5432 \
  postgres:15
```

Set: `DATABASE_URL=postgresql://postgres:secretpassword@localhost:5432/dollardata`

## Environment Variables

```env
# Production
ENVIRONMENT=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SECRET_KEY=your-secret-key-here

# Optional
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=https://yourdomain.com
```

## Run Migration
After connecting to PostgreSQL, run the index migration:
```bash
psql $DATABASE_URL -f backend/migrations/001_add_indexes.sql
```

## Production Deployment
```bash
# Install dependencies
pip install -r backend/requirements.txt

# Run with Gunicorn (4 workers by default, based on CPU cores)
gunicorn backend.main:app -c gunicorn.conf.py
```

## Redis Setup (Optional but Recommended)

### Upstash (Serverless - Recommended)
1. Create account at [upstash.com](https://upstash.com)
2. Create Redis database
3. Copy REST URL to `REDIS_URL`

### Local Docker
```bash
docker run -d --name dollardata-redis -p 6379:6379 redis:7
```
Set: `REDIS_URL=redis://localhost:6379`

## Background Jobs (Optional)

For heavy tasks like PDF parsing and AI categorization:
```bash
# Start RQ worker
rq worker --with-scheduler
```

