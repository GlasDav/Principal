# HTTPS Enforcement Guide

This document outlines how to configure HTTPS enforcement for the DollarData application in production.

## Current Security Headers

The application already includes HSTS (HTTP Strict Transport Security) headers in production mode:

```python
# In backend/main.py SecurityHeadersMiddleware
if os.getenv("ENVIRONMENT", "development") == "production":
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
```

## Production HTTPS Setup

### Option 1: Reverse Proxy (Recommended)

Use a reverse proxy like **Nginx** or **Caddy** to handle SSL termination.

#### Nginx Configuration

```nginx
server {
    listen 80;
    server_name dollardata.yourdomain.com;
    
    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dollardata.yourdomain.com;
    
    # SSL Certificate (Let's Encrypt recommended)
    ssl_certificate /etc/letsencrypt/live/dollardata.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dollardata.yourdomain.com/privkey.pem;
    
    # Modern SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    
    # Security Headers (additional to FastAPI middleware)
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Frontend (served by Vite build or separate server)
    location / {
        proxy_pass http://localhost:5173/;
        proxy_set_header Host $host;
    }
}
```

#### Caddy Configuration (Automatic HTTPS)

Caddy automatically provisions SSL certificates from Let's Encrypt:

```caddyfile
dollardata.yourdomain.com {
    reverse_proxy /api/* localhost:8000 {
        header_up X-Forwarded-Proto {scheme}
    }
    
    reverse_proxy localhost:5173
}
```

### Option 2: Cloud Platform SSL

If deploying to cloud platforms:

- **AWS**: Use Application Load Balancer with ACM certificates
- **Google Cloud**: Use Cloud Load Balancing with managed SSL
- **Azure**: Use Application Gateway with managed certificates
- **Heroku**: Use Heroku SSL (free with paid dynos)
- **Vercel/Netlify**: Automatic SSL included

### Option 3: Docker with Traefik

For Docker deployments, use Traefik as a reverse proxy:

```yaml
# docker-compose.prod.yml
version: "3.8"

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@yourdomain.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./letsencrypt:/letsencrypt

  backend:
    build: ./backend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`dollardata.yourdomain.com`) && PathPrefix(`/api`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
    environment:
      - ENVIRONMENT=production
```

## Application Configuration

### Environment Variables

Ensure these are set in production:

```bash
# .env.production
ENVIRONMENT=production
CORS_ORIGINS=https://dollardata.yourdomain.com
SECRET_KEY=<strong-random-key>
```

### Trust Proxy Headers

When behind a reverse proxy, FastAPI needs to trust forwarded headers. Add to `main.py`:

```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

# Only allow requests to your domain
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["dollardata.yourdomain.com", "localhost"]
)
```

## Verification Checklist

- [ ] SSL certificate is valid and not expired
- [ ] HTTP → HTTPS redirect is working
- [ ] HSTS header is present in responses
- [ ] All assets load over HTTPS (no mixed content)
- [ ] CORS is configured for HTTPS origins only
- [ ] Cookies have `Secure` flag set (if applicable)

## Testing HTTPS

Use these tools to verify your configuration:

1. **SSL Labs**: https://www.ssllabs.com/ssltest/
2. **Security Headers**: https://securityheaders.com/
3. **Mozilla Observatory**: https://observatory.mozilla.org/

## Certificate Renewal

If using Let's Encrypt, certificates auto-renew. Set up a cron job to reload your web server:

```bash
# /etc/cron.d/certbot-reload
0 3 * * * root certbot renew --quiet && systemctl reload nginx
```
