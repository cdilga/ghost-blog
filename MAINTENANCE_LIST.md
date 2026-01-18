# Ghost Blog Maintenance Tasks

**Server**: chris.dilger.me
**Last Audit**: January 2026
**Current State**: Needs significant updates

---

## Goals & Philosophy

This is a **tiny VPS** (512MB RAM, 20GB disk). All maintenance decisions follow these principles:

| Goal | Approach |
|------|----------|
| **Low Resources** | No bloat, minimal services, optimize MySQL/Ghost memory, aggressive log cleanup |
| **High Performance** | Cloudflare CDN handles caching/SSL, lean Ghost install, no unnecessary plugins |
| **Easy Maintenance** | Simple scripts, automated backups, single `ssh ghost-blog` access, no Docker complexity |

**Keep it simple**: Ghost + Nginx + MySQL + Cloudflare. Nothing more.

### Resource Targets

| Metric | Target | Current |
|--------|--------|---------|
| Disk usage | < 60% | 71% |
| RAM usage | < 400MB | 285MB + 507MB swap |
| Services | 3 only (ghost, nginx, mysql) | OK |
| Monthly maintenance | < 30 min | - |

---

## Priority 1: Critical Security Updates

### [ ] 1.1 Apply System Security Patches
**Risk**: High - 230 pending updates since March 2023
**Estimated downtime**: 5-10 minutes for reboot

```bash
ssh ghost-blog

# Backup first
cd /var/www/ghost && ghost backup

# Apply updates
apt update
apt upgrade -y

# If kernel was updated
reboot
```

### [ ] 1.2 Upgrade Node.js (EOL)
**Risk**: High - Node 16 reached end-of-life
**Current**: Node 16.19.1
**Target**: Node 18.x or 20.x LTS

```bash
ssh ghost-blog

# Check Ghost compatibility first
cd /var/www/ghost
ghost check-update

# Install Node 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify
node --version

# Restart Ghost
ghost restart
```

---

## Priority 2: Ghost Platform Updates

### [ ] 2.1 Update Ghost to Latest Version
**Current**: Ghost 5.38.0 (from 2023)
**Latest**: Ghost 6.x (released August 2025)
**Note**: Major version upgrade - review changelog for breaking changes

```bash
ssh ghost-blog
cd /var/www/ghost

# Create full backup before major upgrade
ghost backup
mysqldump -u ghost-508 -p ghost_prod > /root/pre-upgrade-backup.sql

# Update Ghost CLI first
npm install -g ghost-cli@latest

# Update Ghost
ghost update

# If major version issues, can specify version:
# ghost update --v5  (stay on v5 latest)
```

**Post-upgrade checks**:
- [ ] Admin panel loads: https://chris.dilger.me/ghost/
- [ ] Frontend displays correctly
- [ ] Posts are accessible
- [ ] Images load properly

### [ ] 2.2 Update Ghost-CLI
**Current**: 1.24.0

```bash
npm install -g ghost-cli@latest
ghost version
```

---

## Priority 3: Backup System

**See [BACKUPS.md](BACKUPS.md) for full setup instructions.**

### [ ] 3.1 Set up VPS backup script
### [ ] 3.2 Configure TrueNAS rsync pull task
### [ ] 3.3 Configure TrueNAS ZFS snapshots

Summary:

```
┌─────────────┐     rsync pull      ┌─────────────┐
│  Ghost VPS  │ ──────────────────► │   TrueNAS   │
│  (staging)  │   daily @ 5 AM      │  (storage)  │
│  keep 3 days│                     │  ZFS snaps  │
└─────────────┘                     └─────────────┘
```

| Time | Action | System |
|------|--------|--------|
| 3:00 AM | Create backup files | VPS cron |
| 5:00 AM | Pull backups via rsync | TrueNAS rsync task |
| 6:00 AM | Create ZFS snapshot | TrueNAS snapshot task |

---

## Priority 4: Disk Space Management

### [ ] 4.1 Clean Up Disk Space
**Current**: 71% used (14GB of 20GB)

```bash
ssh ghost-blog

# Check current usage
df -h /
du -sh /var/www/ghost/content/*

# Clean journal logs (keep 7 days)
journalctl --vacuum-time=7d

# Remove old Ghost logs
find /var/www/ghost/content/logs -name "*.log.*" -mtime +7 -delete

# Clean apt cache
apt autoremove -y
apt clean

# Remove old kernels
apt autoremove --purge

# Check again
df -h /
```

**Target**: Get below 60% usage

---

## Priority 5: Security Hardening

### [ ] 5.1 Configure Firewall
```bash
ssh ghost-blog

# Check current status
ufw status

# If not configured:
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

### [ ] 5.2 Install Fail2ban
Protects against brute-force SSH attacks.

```bash
ssh ghost-blog

apt install fail2ban -y
systemctl enable fail2ban
systemctl start fail2ban

# Check status
fail2ban-client status
```

### [ ] 5.3 Review SSH Security
```bash
# Verify password auth is disabled (key-only)
grep "PasswordAuthentication" /etc/ssh/sshd_config

# Should show: PasswordAuthentication no
# If not, edit and restart sshd
```

---

## Priority 6: Memory Optimization (Low-Resource Goal)

### [ ] 6.1 Optimize MySQL for Tiny Server
**Goal**: Reduce MySQL memory footprint

```bash
ssh ghost-blog

# Check current MySQL memory settings
mysql -e "SHOW VARIABLES LIKE 'innodb_buffer_pool_size';"

# Create optimized config for low-memory server
cat > /etc/mysql/mysql.conf.d/low-memory.cnf << 'EOF'
[mysqld]
# Optimized for 512MB RAM server
innodb_buffer_pool_size = 48M
innodb_log_buffer_size = 4M
key_buffer_size = 8M
max_connections = 20
table_open_cache = 64
thread_cache_size = 4
query_cache_size = 0
performance_schema = OFF
EOF

systemctl restart mysql
```

### [ ] 6.2 Optimize Ghost Memory
```bash
# Set Node.js memory limit in Ghost service
cat >> /etc/systemd/system/ghost_chris-dilger-me.service.d/override.conf << 'EOF'
[Service]
Environment="NODE_OPTIONS=--max-old-space-size=128"
EOF

systemctl daemon-reload
systemctl restart ghost_chris-dilger-me
```

### [ ] 6.3 Reduce Swap Usage (optional)
Current swap usage (507MB) is high but acceptable. Options:

1. **Live with swap** - Fine for a low-traffic blog
2. **Upgrade VPS** to 1GB RAM (~$6/month on Vultr)

### [ ] 6.4 Set Up Basic Monitoring (Easy Maintenance Goal)
```bash
# Quick health check script
cat > /root/health-check.sh << 'SCRIPT'
#!/bin/bash
echo "=== Ghost Blog Health Check ==="
echo "Date: $(date)"
echo ""
echo "=== Uptime ==="
uptime
echo ""
echo "=== Disk ==="
df -h /
echo ""
echo "=== Memory ==="
free -h
echo ""
echo "=== Ghost Status ==="
cd /var/www/ghost && ghost status
echo ""
echo "=== Recent Errors ==="
tail -10 /var/www/ghost/content/logs/chris-dilger-me.error.log 2>/dev/null || echo "No errors"
SCRIPT

chmod +x /root/health-check.sh
```

---

## Priority 7: Future Planning

### [ ] 7.1 Plan Ubuntu 20.04 EOL Migration
**EOL Date**: April 2025 (already past - in extended security maintenance)
**Target**: Ubuntu 22.04 LTS

**Recommended approach** (keep it simple):
1. In-place upgrade: `do-release-upgrade`
2. Verify Ghost still works
3. Done

**Avoid**: Fresh VPS or Docker migration unless necessary - adds complexity.

### [ ] 7.2 Fix Local SSL Certificate (Low Priority)
Cloudflare handles SSL, so this is cosmetic.

```bash
ssh ghost-blog
/etc/letsencrypt/acme.sh --renew -d chris.dilger.me --force
nginx -t && systemctl reload nginx
```

---

## What NOT to Do (Keep It Simple)

These add complexity without benefit for a simple blog:

| Avoid | Why |
|-------|-----|
| Docker/containers | Adds memory overhead, complexity |
| Kubernetes | Massive overkill |
| Multiple Ghost themes | Disk space, maintenance burden |
| Ghost Members/Subscriptions | Needs more RAM, email complexity |
| Additional monitoring tools | Prometheus/Grafana eat RAM |
| Log aggregation services | Simple `tail` is enough |
| CI/CD pipelines | Just SSH and run commands |
| Load balancers | Single server, Cloudflare handles this |

---

## Maintenance Schedule

| Task | Frequency | Command |
|------|-----------|---------|
| Health check | Weekly | `ssh ghost-blog /root/health-check.sh` |
| System updates | Monthly | `apt update && apt upgrade` |
| Ghost updates | Monthly | `cd /var/www/ghost && ghost update` |
| Backup verification | Monthly | Check `/root/backups/` has recent files |
| Disk cleanup | Quarterly | Clean logs, apt cache |
| Security review | Quarterly | Check fail2ban, firewall, SSH logs |

---

## Quick Reference Commands

```bash
# SSH in
ssh ghost-blog

# Ghost commands (from /var/www/ghost)
ghost status
ghost restart
ghost log
ghost update
ghost backup

# Service management
systemctl status ghost_chris-dilger-me
systemctl status nginx
systemctl status mysql

# Logs
tail -f /var/www/ghost/content/logs/chris-dilger-me.error.log
journalctl -u ghost_chris-dilger-me -f

# Backups
/root/backup-ghost.sh
ls -lh /root/backups/
```
