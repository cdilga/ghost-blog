# Ghost Blog Guardrails

Quick reference signposts to check before running tasks on chris.dilger.me.

---

## SSH & User Context

| Command | User | Notes |
|---------|------|-------|
| `ssh ghost-blog` | root | Direct SSH connects as root |
| Ghost CLI commands | **chris** | Must run as chris, not root |

**Ghost CLI commands** (`ghost restart`, `ghost update`, etc.) must be run as the `chris` user:

```bash
# WRONG - will fail
ssh ghost-blog "cd /var/www/ghost && ghost restart"

# CORRECT
ssh ghost-blog "sudo -u chris bash -c 'cd /var/www/ghost && ghost restart'"
```

---

## File Ownership

| Path | Owner | Group |
|------|-------|-------|
| `/var/www/ghost/` | chris | chris |
| `/var/www/ghost/content/` | ghost | ghost |
| `/var/www/ghost/config.production.json` | ghost | chris |

---

## Service Names

- Ghost service: `ghost_chris-dilger-me`
- Nginx: `nginx`
- MySQL: `mysql`

```bash
# Check status
ssh ghost-blog "systemctl status ghost_chris-dilger-me"
```

---

## Log Locations

```bash
# Ghost logs (note the URL-based naming)
/var/www/ghost/content/logs/https___chris_dilger_me_production.error.log
/var/www/ghost/content/logs/https___chris_dilger_me_production.log

# System logs
journalctl -u ghost_chris-dilger-me
```

---

## Config Location

```bash
/var/www/ghost/config.production.json
```

---

## Pre-Task Checklist

Before running maintenance tasks:

- [ ] Am I using the correct user? (chris for Ghost CLI, root for system commands)
- [ ] Do I have a recent backup?
- [ ] Is the blog accessible? (`curl -I https://chris.dilger.me`)
