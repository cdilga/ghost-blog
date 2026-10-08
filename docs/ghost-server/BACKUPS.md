# Ghost Blog Backup System

**Backup destination: TrueNAS** (192.168.11.12, pool: `vessel`)

## Architecture

```
┌─────────────┐     rsync pull      ┌─────────────┐
│  Ghost VPS  │ ──────────────────► │   TrueNAS   │
│  (staging)  │   daily @ 5 AM      │  (storage)  │
│  keep 3 days│                     │  ZFS snaps  │
└─────────────┘                     └─────────────┘
```

| Component | Role |
|-----------|------|
| VPS | Generates backup files, keeps 3 days locally |
| TrueNAS | Pulls backups, stores with 90-day ZFS snapshot retention |

## Backup Chain Schedule

| Time | Action | System |
|------|--------|--------|
| 3:00 AM | Create backup files (DB + content) | VPS cron |
| 5:00 AM | Pull backups via rsync | TrueNAS rsync task |
| 6:00 AM | Create ZFS snapshot | TrueNAS snapshot task |

---

## Setup Instructions

### Part 1: VPS Backup Script

Creates backup files for TrueNAS to pull.

```bash
ssh ghost-blog

mkdir -p /root/backups

cat > /root/backup-ghost.sh << 'SCRIPT'
#!/bin/bash
set -e
DATE=$(date +%Y%m%d_%H%M)
BACKUP_DIR=/root/backups

# Database backup
mysqldump -u ghost-508 -p'PASSWORD_HERE' ghost_prod | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Content backup (images, themes, etc.)
tar -czf $BACKUP_DIR/content_$DATE.tar.gz -C /var/www/ghost content

# Keep only 3 days locally (TrueNAS has the real backups)
find $BACKUP_DIR -mtime +3 -delete

echo "Backup completed: $DATE"
SCRIPT

chmod +x /root/backup-ghost.sh

# Run daily at 3 AM (before TrueNAS pulls at 5 AM)
(crontab -l 2>/dev/null; echo "0 3 * * * /root/backup-ghost.sh >> /var/log/ghost-backup.log 2>&1") | crontab -
```

### Part 2: TrueNAS Configuration

**Uses TrueNAS middleware API (`midclt`)** - official API that survives upgrades.

All commands run via `ssh truenas` with `sudo midclt call`.

#### Step 1: Create Destination Dataset

```bash
ssh truenas

# Create backup dataset on vessel pool
sudo midclt call pool.dataset.create '{
  "name": "vessel/backups/ghost-blog",
  "type": "FILESYSTEM",
  "compression": "LZ4"
}'
```

#### Step 2: Generate SSH Keypair

```bash
ssh truenas

# Generate keypair via API
KEYPAIR=$(sudo midclt call keychaincredential.generate_ssh_key_pair)
echo "$KEYPAIR" | python3 -c "import sys,json; d=json.load(sys.stdin); print('PUBLIC KEY:'); print(d['public_key'])"

# Save keypair as credential
sudo midclt call keychaincredential.create '{
  "name": "ghost-blog-backup-key",
  "type": "SSH_KEY_PAIR",
  "attributes": '"$KEYPAIR"'
}'
```

Note the credential ID returned (e.g., `1`).

#### Step 3: Add Public Key to VPS

Copy the public key from Step 2 output, then:

```bash
ssh ghost-blog

# Add TrueNAS public key
echo "ssh-ed25519 AAAA... ghost-blog-backup-key" >> ~/.ssh/authorized_keys
```

#### Step 4: Scan Remote Host Key

```bash
ssh truenas

# Get the VPS host key
sudo midclt call keychaincredential.remote_ssh_host_key_scan '{
  "host": "45.77.114.162",
  "port": 22
}'
```

Copy the returned host key string.

#### Step 5: Create SSH Connection Credential

```bash
ssh truenas

# Replace KEYPAIR_ID with ID from Step 2 (e.g., 1)
# Replace HOST_KEY with output from Step 4
sudo midclt call keychaincredential.create '{
  "name": "ghost-blog-vps",
  "type": "SSH_CREDENTIALS",
  "attributes": {
    "host": "45.77.114.162",
    "port": 22,
    "username": "root",
    "private_key": KEYPAIR_ID,
    "remote_host_key": "HOST_KEY_STRING_HERE",
    "connect_timeout": 10
  }
}'
```

Note the SSH credential ID returned (e.g., `2`).

#### Step 6: Create Rsync Task

```bash
ssh truenas

# Replace SSH_CRED_ID with ID from Step 5
sudo midclt call rsynctask.create '{
  "path": "/mnt/vessel/backups/ghost-blog",
  "user": "root",
  "mode": "SSH",
  "ssh_credentials": SSH_CRED_ID,
  "remotepath": "/root/backups/",
  "direction": "PULL",
  "desc": "Pull Ghost blog backups from VPS",
  "schedule": {
    "minute": "0",
    "hour": "5",
    "dom": "*",
    "month": "*",
    "dow": "*"
  },
  "recursive": true,
  "times": true,
  "compress": true,
  "archive": false,
  "delete": true,
  "preserveperm": true,
  "enabled": true
}'
```

#### Step 7: Create Periodic Snapshot Task

```bash
ssh truenas

sudo midclt call pool.snapshottask.create '{
  "dataset": "vessel/backups/ghost-blog",
  "recursive": false,
  "lifetime_value": 90,
  "lifetime_unit": "DAY",
  "naming_schema": "auto-%Y-%m-%d_%H-%M",
  "schedule": {
    "minute": "0",
    "hour": "6",
    "dom": "*",
    "month": "*",
    "dow": "*"
  },
  "enabled": true
}'
```

#### Step 8: Test Rsync Task

```bash
ssh truenas

# Get rsync task ID
TASK_ID=$(sudo midclt call rsynctask.query | python3 -c "import sys,json; tasks=json.load(sys.stdin); print([t['id'] for t in tasks if 'ghost' in t.get('desc','').lower()][0])")

# Run task manually
sudo midclt call -j rsynctask.run "$TASK_ID"
```

---

## Verification Commands

### Check TrueNAS Configuration

```bash
ssh truenas

# Check credentials exist
sudo midclt call keychaincredential.query | python3 -c "import sys,json; [print(f\"{c['id']}: {c['name']} ({c['type']})\") for c in json.load(sys.stdin)]"

# Check rsync task exists
sudo midclt call rsynctask.query | python3 -c "import sys,json; [print(f\"{t['id']}: {t['desc']} - {t['path']}\") for t in json.load(sys.stdin)]"

# Check snapshot task exists
sudo midclt call pool.snapshottask.query | python3 -c "import sys,json; [print(f\"{t['id']}: {t['dataset']} - {t['lifetime_value']} {t['lifetime_unit']}\") for t in json.load(sys.stdin)]"

# Check backups arrived
ls -la /mnt/vessel/backups/ghost-blog/

# Check snapshots
zfs list -t snapshot | grep ghost-blog
```

### Check VPS Backup Script

```bash
ssh ghost-blog

# Check cron is set
crontab -l | grep backup

# Check recent backups
ls -lh /root/backups/

# Check backup log
tail -20 /var/log/ghost-backup.log
```

---

## Restore Procedures

**See [BACKUP_RESTORE.md](BACKUP_RESTORE.md) for full disaster recovery guide.**

Quick restore to existing VPS:

```bash
# Stop Ghost
ssh ghost-blog "cd /var/www/ghost && ghost stop"

# Copy latest backup from TrueNAS
scp truenas:/mnt/vessel/backups/ghost-blog/db_LATEST.sql.gz ghost-blog:/root/
scp truenas:/mnt/vessel/backups/ghost-blog/content_LATEST.tar.gz ghost-blog:/root/

# Restore database
ssh ghost-blog "gunzip < /root/db_LATEST.sql.gz | mysql -u ghost-508 -p ghost_prod"

# Restore content
ssh ghost-blog "cd /var/www/ghost && tar -xzf /root/content_LATEST.tar.gz"

# Start Ghost
ssh ghost-blog "cd /var/www/ghost && ghost start"
```

---

## Troubleshooting

### Rsync Task Failing

```bash
ssh truenas

# Check task status
sudo midclt call rsynctask.query | python3 -c "import sys,json; [print(f\"{t['id']}: enabled={t['enabled']}, job_state={t.get('job',{}).get('state','N/A')}\") for t in json.load(sys.stdin)]"

# Test SSH connection manually
sudo midclt call keychaincredential.query | python3 -c "import sys,json; [print(f\"{c['id']}: {c['name']}\") for c in json.load(sys.stdin) if c['type']=='SSH_CREDENTIALS']"

# Check TrueNAS alerts
sudo midclt call alert.list
```

### VPS Backup Script Failing

```bash
ssh ghost-blog

# Check log
cat /var/log/ghost-backup.log

# Test script manually
/root/backup-ghost.sh

# Check disk space
df -h /root/backups
```

---

## Notes

- All TrueNAS configuration stored in middleware database - survives upgrades
- VPS keeps only 3 days of backups to save disk space
- TrueNAS ZFS snapshots provide 90-day point-in-time recovery
- Compression (LZ4) enabled on dataset for storage efficiency
