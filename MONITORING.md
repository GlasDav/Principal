# Error Monitoring & Logging

This document outlines the recommended error monitoring setup for production.

## Sentry Integration (Recommended)

### Backend Setup

1. Install Sentry SDK:
```bash
pip install sentry-sdk[fastapi]
```

2. Add to `backend/main.py`:
```python
import sentry_sdk

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    environment=os.getenv("ENVIRONMENT", "development"),
    traces_sample_rate=0.1,  # 10% of transactions for performance monitoring
)
```

3. Add to `.env`:
```
SENTRY_DSN=https://your-key@sentry.io/your-project-id
```

### Frontend Setup

1. Install Sentry:
```bash
npm install @sentry/react
```

2. Add to `frontend/src/main.jsx`:
```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});
```

## Alternative: LogRocket

For session replay and frontend debugging:

```bash
npm install logrocket
```

```javascript
import LogRocket from 'logrocket';
LogRocket.init('your-app-id');
```

## Minimum Viable Logging

If not using paid services, ensure backend logs are persisted:

```yaml
# docker-compose.yml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Health Checks

The `/health` endpoint is already implemented and can be used with uptime monitoring services:
- UptimeRobot (free)
- Pingdom
- StatusPage.io
