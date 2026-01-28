# Ghost Blog: chris.dilger.me

**Always read [GUARDRAILS.md](GUARDRAILS.md) before running tasks** - contains critical info about users, permissions, and common pitfalls.

## Quick Reference

- **Maintenance tasks**: See [MAINTENANCE_LIST.md](MAINTENANCE_LIST.md)
- **Backup setup**: See [BACKUPS.md](BACKUPS.md)
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

### Mobile Testing (with Claude in Chrome)

When working on mobile-specific features (accelerometer, touch, responsive), **test at mobile viewport**:

1. **Resize to mobile**: `resize_window` to 375x812 (iPhone)
2. **Reload**: Hard refresh to reinitialize with mobile detection
3. **Check console**: Verify mobile-specific code paths initialized
4. **Simulate gyroscope** (if applicable):
   ```javascript
   // Dispatch device orientation event
   window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', {
       alpha: 0, beta: 45, gamma: 15
   }));
   ```
5. **Compare screenshots**: Capture before/after to verify effect

**Do this for EACH iteration** when tuning mobile-specific values.

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

## Issue Tracking

This project uses **bd (beads)** for issue tracking.
Run `bd prime` for workflow context, or install hooks (`bd hooks install`) for auto-injection.

**Quick reference:**
- `bd ready` - Find unblocked work
- `bd create "Title" --type task --priority 2` - Create issue
- `bd close <id>` - Complete work
- `bd sync` - Sync with git (run at session end)

For full workflow details: `bd prime`

## Closing Issues - Acceptance Verification

**Before closing ANY issue**, verify ALL acceptance criteria are met:

1. **Read the issue**: `bd show <id>` - check the `## Acceptance` section
2. **Verify each criterion** with evidence:
   - **Code changes**: Show the implementation matches the requirement
   - **Visual changes**: Take screenshots/GIFs to demonstrate the effect
   - **Fallbacks**: Test reduced-motion, error states, edge cases
   - **Tests**: Run `npm test` and confirm relevant tests pass
3. **Document verification** in the close reason or comment

**Example verification table:**

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Feature X works | ✅ PASS | Screenshot shows X in action |
| Reduced-motion fallback | ✅ PASS | Tested: element visible without animation |
| No console errors | ✅ PASS | `npm test` passes |

**DO NOT close issues with unchecked acceptance criteria.** If criteria can't be verified, either:
- Fix the implementation until it passes
- Update the issue explaining why criteria changed
- Ask the user for clarification

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

<!-- bv-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Workflow Pattern

1. **Start**: Run `bd ready` to find actionable work
2. **Claim**: Use `bd update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `bd close <id>`
5. **Sync**: Always run `bd sync` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session

<!-- end-bv-agent-instructions -->
