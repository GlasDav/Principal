---
description: Deploy updates to the DollarData VPS on Binary Lane
---

# Deploy to VPS

// turbo-all

## Server Details
- **Host**: 43.224.182.196 (or object-motor.bnr.la)
- **Username**: root
- **Password**: mhLHTdULdHpz
- **OS**: Ubuntu 24.04 LTS
- **App Path**: /opt/dollardata

## Connect to Server

1. Open PowerShell and SSH into the server:
```powershell
ssh root@43.224.182.196
```

2. Enter the password when prompted (stored in Binary Lane dashboard)

## Deploy Updates

Once connected, run these commands:

3. Navigate to the app directory:
```bash
cd /opt/dollardata
```

4. Pull latest changes from GitHub:
```bash
git pull origin main
```

5. Rebuild and restart the application:
```bash
# If using Docker:
docker compose down && docker compose up -d --build

# If running directly:
# Frontend: cd frontend && npm run build
# Backend: systemctl restart dollardata-backend (or pm2 restart all)
```

## Quick One-Liner (after finding app path)
```bash
cd /opt/dollardata && git pull origin main && docker compose down && docker compose up -d --build
```

## Troubleshooting

- Check logs: `docker compose logs -f`
- Check running containers: `docker ps`
- Check disk space: `df -h`
