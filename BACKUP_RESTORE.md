# Ghost Blog Disaster Recovery Guide

How to restore chris.dilger.me from backups stored on TrueNAS.

## Backup Location

| Location | Path | Retention |
|----------|------|-----------|
| TrueNAS | `/mnt/vessel/backups/ghost-blog/` | 90 days (ZFS snapshots) |
| VPS (staging only) | `/root/backups/` | 3 days |

## What's In The Backups

| File | Contains | Critical? |
|------|----------|-----------|
| `db_YYYYMMDD_HHMM.sql.gz` | All posts, pages, settings, users, tags, members | **YES** |
| `content_YYYYMMDD_HHMM.tar.gz` | Images, themes, uploaded files | YES |

---

## Scenario 1: Full Disaster Recovery (VPS is Dead)

Complete rebuild from scratch on a new VPS.

### Prerequisites

- New Ubuntu 22.04/24.04 VPS (minimum 512MB RAM, 20GB disk)
- Domain DNS pointing to new server IP
- SSH access to TrueNAS

### Step 1: Provision New VPS

```bash
# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y nginx mysql-server nodejs npm

# Install Ghost-CLI
npm install -g ghost-cli@latest
```

### Step 2: Set Up MySQL

```bash
mysql_secure_installation

# Create database and user
mysql -u root -p << 'SQL'
CREATE DATABASE ghost_prod;
CREATE USER 'ghost-508'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON ghost_prod.* TO 'ghost-508'@'localhost';
FLUSH PRIVILEGES;
SQL
```

### Step 3: Install Ghost

```bash
# Create ghost user
adduser --disabled-password --gecos "" ghost-user

# Create directory
mkdir -p /var/www/ghost
chown ghost-user:ghost-user /var/www/ghost
cd /var/www/ghost

# Install Ghost (as ghost-user)
su - ghost-user -c "cd /var/www/ghost && ghost install"

# Follow prompts:
# - URL: https://chris.dilger.me
# - MySQL hostname: localhost
# - MySQL username: ghost-508
# - MySQL password: YOUR_PASSWORD_HERE
# - MySQL database: ghost_prod
# - Set up Nginx: Yes
# - Set up SSL: Yes (or No if using Cloudflare)
# - Set up systemd: Yes
```

### Step 4: Stop Ghost and Restore Database

```bash
cd /var/www/ghost
ghost stop

# Get latest backup from TrueNAS
scp truenas:/mnt/vessel/backups/ghost-blog/db_LATEST.sql.gz /root/

# Restore database
gunzip < /root/db_LATEST.sql.gz | mysql -u ghost-508 -p ghost_prod
```

### Step 5: Restore Content

```bash
# Get content backup from TrueNAS
scp truenas:/mnt/vessel/backups/ghost-blog/content_LATEST.tar.gz /root/

# Backup current content (just in case)
mv /var/www/ghost/content /var/www/ghost/content.fresh

# Restore content
cd /var/www/ghost
tar -xzf /root/content_LATEST.tar.gz

# Fix permissions
chown -R ghost-user:ghost-user /var/www/ghost/content
```

### Step 6: Update Config and Start

```bash
# Edit config if needed (database credentials, URL)
nano /var/www/ghost/config.production.json

# Start Ghost
ghost start

# Verify
ghost status
curl -I https://chris.dilger.me
```

### Step 7: Update SSH Config and Backups

On your Mac:
```bash
# Update ~/.ssh/config with new VPS IP
nano ~/.ssh/config

# Update TrueNAS SSH credential with new IP
ssh truenas
sudo midclt call keychaincredential.update CRED_ID '{"attributes": {"host": "NEW_IP_HERE"}}'
```

---

## Scenario 2: Restore to Existing VPS

VPS is running but you need to restore from backup (e.g., corrupted data, accidental deletion).

### Step 1: Stop Ghost

```bash
ssh ghost-blog
cd /var/www/ghost
ghost stop
```

### Step 2: Find Available Backups

```bash
# List recent backups on TrueNAS
ssh truenas "ls -lt /mnt/vessel/backups/ghost-blog/ | head -20"

# Or list ZFS snapshots for older point-in-time
ssh truenas "zfs list -t snapshot | grep ghost-blog"
```

### Step 3: Restore Database

```bash
# Copy backup from TrueNAS
scp truenas:/mnt/vessel/backups/ghost-blog/db_20260114_0300.sql.gz /root/

# Restore (overwrites current database)
gunzip < /root/db_20260114_0300.sql.gz | mysql -u ghost-508 -p ghost_prod
```

### Step 4: Restore Content (if needed)

```bash
# Copy content backup
scp truenas:/mnt/vessel/backups/ghost-blog/content_20260114_0300.tar.gz /root/

# Backup current content
mv /var/www/ghost/content /var/www/ghost/content.old

# Restore
cd /var/www/ghost
tar -xzf /root/content_20260114_0300.tar.gz

# Fix permissions
chown -R ghost-user:ghost-user content/
```

### Step 5: Restart Ghost

```bash
cd /var/www/ghost
ghost start
ghost status

# Test
curl -I https://chris.dilger.me
```

---

## Scenario 3: Point-in-Time Recovery (ZFS Snapshots)

Restore from a specific date up to 90 days ago.

### Step 1: List Available Snapshots

```bash
ssh truenas "zfs list -t snapshot -o name,creation | grep ghost-blog"

# Example output:
# vessel/backups/ghost-blog@auto-2026-01-14_06-00  Tue Jan 14  6:00 2026
# vessel/backups/ghost-blog@auto-2026-01-13_06-00  Mon Jan 13  6:00 2026
# vessel/backups/ghost-blog@auto-2026-01-12_06-00  Sun Jan 12  6:00 2026
# ...
```

### Step 2: Browse Snapshot Contents

```bash
# Snapshots are accessible via .zfs/snapshot directory (read-only)
ssh truenas "ls -la /mnt/vessel/backups/ghost-blog/.zfs/snapshot/"

# Browse specific snapshot
ssh truenas "ls -la /mnt/vessel/backups/ghost-blog/.zfs/snapshot/auto-2026-01-10_06-00/"
```

### Step 3: Copy Files from Snapshot

```bash
# Copy specific backup file from that point in time
scp truenas:/mnt/vessel/backups/ghost-blog/.zfs/snapshot/auto-2026-01-10_06-00/db_20260110_0300.sql.gz ghost-blog:/root/
scp truenas:/mnt/vessel/backups/ghost-blog/.zfs/snapshot/auto-2026-01-10_06-00/content_20260110_0300.tar.gz ghost-blog:/root/
```

### Step 4: Restore as Normal

Follow Steps 3-5 from Scenario 2.

---

## Scenario 4: Restore Single Post/Image

If you just need to recover a single deleted post or image.

### For Posts (Database)

Unfortunately, MySQL backups are all-or-nothing. Options:

1. **Restore full DB to temp database, extract post:**
   ```bash
   # Create temp database
   mysql -u root -p -e "CREATE DATABASE ghost_temp;"

   # Restore backup to temp
   gunzip < db_backup.sql.gz | mysql -u root -p ghost_temp

   # Query the post you need
   mysql -u root -p ghost_temp -e "SELECT * FROM posts WHERE title LIKE '%my post%';"

   # Manually recreate in Ghost admin, or use API

   # Clean up
   mysql -u root -p -e "DROP DATABASE ghost_temp;"
   ```

2. **Use Ghost Admin revision history** (if recent enough)

### For Images

Images are easier - just copy from backup:

```bash
# Find image in content backup
tar -tzf content_backup.tar.gz | grep "image-name"

# Extract single file
tar -xzf content_backup.tar.gz content/images/2026/01/my-image.jpg

# Copy to VPS
scp content/images/2026/01/my-image.jpg ghost-blog:/var/www/ghost/content/images/2026/01/
```

---

## Verification Checklist

After any restore, verify:

- [ ] Ghost is running: `ghost status`
- [ ] Homepage loads: `curl -I https://chris.dilger.me`
- [ ] Admin panel works: https://chris.dilger.me/ghost/
- [ ] Recent posts are visible
- [ ] Images load correctly
- [ ] Check Ghost logs: `ghost log`

---

## Emergency Contacts & Info

| Item | Value |
|------|-------|
| VPS Provider | Vultr |
| VPS IP | 45.77.114.162 |
| Domain | chris.dilger.me |
| DNS/CDN | Cloudflare |
| Backup Storage | TrueNAS (192.168.11.12) |
| Backup Path | `/mnt/vessel/backups/ghost-blog/` |

---

## Quick Reference Commands

```bash
# Check backup status on TrueNAS
ssh truenas "ls -lth /mnt/vessel/backups/ghost-blog/ | head -10"

# Check ZFS snapshots
ssh truenas "zfs list -t snapshot | grep ghost-blog | tail -10"

# Check Ghost status
ssh ghost-blog "cd /var/www/ghost && ghost status"

# Ghost logs
ssh ghost-blog "cd /var/www/ghost && ghost log"

# Test site
curl -sI https://chris.dilger.me | head -5
```
