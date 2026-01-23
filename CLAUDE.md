# Ghost Blog: chris.dilger.me

**Always read [GUARDRAILS.md](GUARDRAILS.md) before running tasks** - contains critical info about users, permissions, and common pitfalls.

## Quick Reference

- **Maintenance tasks**: See [MAINTENANCE_LIST.md](MAINTENANCE_LIST.md)
- **Backup setup**: See [BACKUPS.md](BACKUPS.md)
- **SSH**: `ssh ghost-blog` (connects as root)
- **Ghost CLI**: Must run as `chris` user, not root

## Testing Requirements

**Before closing any theme-related issue, you MUST:**

1. **Validate the theme**: `npm run validate` (runs gscan)
2. **Run smoke tests**: `npm test` (requires Docker running)

The smoke tests check:
- No console errors on page load
- Smooth scroll initializes correctly
- Key page elements render

```bash
# Full test workflow
npm start        # Start Ghost if not running
npm run validate # Theme validation
npm test         # Smoke tests

# First time setup
npm install
npm run test:install  # Install Playwright browser
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start local Ghost (localhost:2368) |
| `npm stop` | Stop Ghost |
| `npm run validate` | Validate theme with gscan |
| `npm test` | Run smoke tests |
| `npm run logs` | View Ghost logs |
| `npm run package` | Zip theme for upload |
