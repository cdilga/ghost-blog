# Ghost Blog: chris.dilger.me

**Always read [GUARDRAILS.md](GUARDRAILS.md) before running tasks** - contains critical info about users, permissions, and common pitfalls.

## Quick Reference

- **Maintenance tasks**: See [MAINTENANCE_LIST.md](MAINTENANCE_LIST.md)
- **Backup setup**: See [BACKUPS.md](BACKUPS.md)
- **Image workflow**: See [THEME_IMAGES.md](THEME_IMAGES.md)
- **SSH**: `ssh ghost-blog` (connects as root)
- **Ghost CLI**: Must run as `chris` user, not root

## Testing Requirements

**Before closing any theme-related issue, run `npm test`** (requires Ghost running).

This single command runs all checks:
- Theme validation (gscan)
- Smoke tests (console errors, scroll init, core elements)

```bash
npm start    # Start Ghost if not running
npm test     # Run ALL tests
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm test` | **Run all tests** (validate + smoke) |
| `npm start` | Start local Ghost (localhost:2368) |
| `npm stop` | Stop Ghost |
| `npm run logs` | View Ghost logs |
| `npm run package` | Zip theme for upload |
| `npm run test:validate` | Theme validation only |
| `npm run test:smoke` | Smoke tests only |
| `npm run images:optimize` | Optimize theme images |
| `npm run images:dry-run` | Preview image optimization |

## Issue Tracking

This project uses **bd (beads)** for issue tracking.
Run `bd prime` for workflow context, or install hooks (`bd hooks install`) for auto-injection.

**Quick reference:**
- `bd ready` - Find unblocked work
- `bd create "Title" --type task --priority 2` - Create issue
- `bd close <id>` - Complete work
- `bd sync` - Sync with git (run at session end)

For full workflow details: `bd prime`

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## Skills for Specific Work

**Frontend work** (label: `frontend`): Use the `/frontend-designer` skill when implementing issues with the `frontend` label. This includes CSS, animations, responsive design, accessibility, and component styling.

Check issue labels with `bd show <id>` before starting work.

## Browser Automation

Prefer **Playwright** (`npm run test:smoke`) over Claude in Chrome for testing and verification.
