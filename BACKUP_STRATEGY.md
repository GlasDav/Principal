# Database Backup Strategy

This document outlines the recommended backup strategy for production deployment.

## PostgreSQL Automated Backups

### Daily Backup Script

Create `/opt/principal/backup.sh`:

```bash
#!/bin/bash
# Principal Finance - Daily Backup Script

BACKUP_DIR="/var/backups/principal"
DATE=$(date +%Y-%m-%d)
RETENTION_DAYS=7

# Create backup
pg_dump -U principal principal | gzip > "$BACKUP_DIR/principal_$DATE.sql.gz"

# Delete backups older than retention period
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Log
echo "$(date): Backup completed - principal_$DATE.sql.gz" >> /var/log/principal-backup.log
```

### Cron Schedule

Add to `/etc/cron.d/principal-backup`:

```
# Daily backup at 2 AM
0 2 * * * root /opt/principal/backup.sh
```

## Restore Procedure

```bash
# Stop the application
docker-compose down

# Restore from backup
gunzip -c /var/backups/principal/principal_YYYY-MM-DD.sql.gz | psql -U principal principal

# Restart
docker-compose up -d
```

## Cloud Backup (Recommended)

For production, use a cloud backup solution:

- **AWS RDS**: Enable automated backups with point-in-time recovery
- **DigitalOcean Managed Databases**: Built-in daily backups
- **Railway/Render**: Check provider-specific backup options

## Testing Backups

**Monthly**: Test restore procedure on staging environment to verify backups are valid.
