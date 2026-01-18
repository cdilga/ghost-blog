# Ghost Blog Sysadmin Guide

Server management instructions for **chris.dilger.me** Ghost blog.

## Server Access

```bash
ssh ghost-blog
```

Host configured in `~/.ssh/config` using key authentication.

- **IP**: 45.77.114.162
- **User**: root
- **Provider**: Vultr (VPS)

## Server Specs

| Resource | Value |
|----------|-------|
| OS | Ubuntu 20.04.6 LTS |
| RAM | 473 MB (low) |
| Disk | 20 GB (71% used) |
| CPU | 1 vCPU |

## Software Versions

| Component | Version | Notes |
|-----------|---------|-------|
| Ghost | 5.38.0 | Update available |
| Ghost-CLI | 1.24.0 | |
| Node.js | 16.19.1 | EOL - needs upgrade |
| MySQL | 8.0.32 | OK |
| Nginx | System default | Reverse proxy |

## Directory Structure

```
/var/www/ghost/           # Ghost installation
├── config.production.json  # Config (contains DB/mail creds)
├── content/
│   ├── images/           # 161 MB - uploaded images
│   ├── data/             # SQLite backup data
│   ├── logs/             # 31 MB - Ghost logs
│   └── themes/           # Custom themes
```

## Services

```bash
# Ghost service
systemctl status ghost_chris-dilger-me
systemctl restart ghost_chris-dilger-me

# Nginx
systemctl status nginx
systemctl restart nginx

# MySQL
systemctl status mysql
```

## Common Commands

### Ghost Management (run from /var/www/ghost)

```bash
cd /var/www/ghost

# Check status
ghost status

# Update Ghost
ghost update

# Restart Ghost
ghost restart

# View logs
ghost log
```

### System Updates

```bash
apt update
apt upgrade -y

# Security updates only
apt install unattended-upgrades
unattended-upgrades --dry-run
```

### Disk Space

```bash
df -h
du -sh /var/www/ghost/content/*
du -sh /var/lib/mysql

# Clean old logs
journalctl --vacuum-time=7d
apt autoremove
```

### Database Backup

```bash
# Manual backup
mysqldump -u ghost-508 -p ghost_prod > /root/ghost_backup_$(date +%Y%m%d).sql

# Full Ghost backup (includes content)
cd /var/www/ghost
ghost backup
```

## SSL/TLS

- **Provider**: Cloudflare (handles SSL termination)
- **Local cert**: Expired (acme.sh) - not critical due to Cloudflare
- **Renewal cron**: `44 0 * * *` via acme.sh

Since Cloudflare handles SSL, the expired local cert doesn't affect users.

## Mail Configuration

- **Provider**: Mailgun
- **Domain**: mg.dilger.me
- **Config location**: `/var/www/ghost/config.production.json`

---

## TASKS NEEDING ATTENTION

### Critical

1. **230 pending system updates** (last updated: March 2023)
   ```bash
   apt update && apt upgrade -y
   ```
   Consider rebooting after kernel updates.

2. **Node.js 16 is EOL** - Ghost requires Node 18+
   ```bash
   # Install Node 18 via NodeSource
   curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
   apt install -y nodejs
   ghost restart
   ```

### High Priority

3. **No backup system** - Set up automated backups
   ```bash
   # Create backup script
   cat > /root/backup-ghost.sh << 'EOF'
   #!/bin/bash
   DATE=$(date +%Y%m%d)
   mysqldump -u ghost-508 -p'PASSWORD' ghost_prod > /root/backups/db_$DATE.sql
   tar -czf /root/backups/content_$DATE.tar.gz /var/www/ghost/content
   # Keep only last 7 days
   find /root/backups -mtime +7 -delete
   EOF
   chmod +x /root/backup-ghost.sh

   # Add to cron
   crontab -e
   # 0 3 * * * /root/backup-ghost.sh
   ```

4. **Ghost outdated** (5.38.0) - Update to latest
   ```bash
   cd /var/www/ghost
   ghost update
   ```

### Medium Priority

5. **Disk space at 71%** - Clean up old logs
   ```bash
   journalctl --vacuum-time=7d
   rm -rf /var/www/ghost/content/logs/*.log.*
   apt autoremove
   ```

6. **Memory pressure** (using 507MB swap)
   - Consider upgrading VPS plan, or
   - Add swap space, or
   - Optimize Ghost/MySQL memory settings

7. **Ubuntu 20.04 EOL** (April 2025)
   - Plan upgrade to 22.04 or 24.04 LTS

### Low Priority

8. **Fix local SSL cert** (cosmetic - Cloudflare handles SSL)
   ```bash
   /etc/letsencrypt/acme.sh --renew -d chris.dilger.me --force
   ```

---

## Monitoring

Check these periodically:

```bash
# Quick health check
ssh ghost-blog "uptime && df -h / && free -h && ghost status"

# Recent errors
ssh ghost-blog "tail -50 /var/www/ghost/content/logs/chris-dilger-me.error.log"
```

## Security Notes

- Server receives WordPress vulnerability scans (normal bot traffic)
- Fail2ban not installed - consider adding
- UFW firewall status unknown - verify ports 22, 80, 443 only

## Useful Links

- Ghost Admin: https://chris.dilger.me/ghost/
- Ghost Docs: https://ghost.org/docs/
- Cloudflare Dashboard: https://dash.cloudflare.com/
