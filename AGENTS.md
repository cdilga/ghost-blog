# chris.dilger.me

Static Astro site in `site/`, hosted on Cloudflare Pages. The old Ghost theme and server deploy are gone (see
README "History"); ignore any Ghost-era instructions you find in `docs/ghost-era/` or `docs/ghost-server/`.

## Where things are

- [README.md](README.md): publishing flow (`main` -> chris-preview.dilger.me, `prod` -> chris.dilger.me) and layout.
- [WRITING.md](WRITING.md): how posts are written, every component and its props. Keep it accurate when you add or
  change a component.
- [site/README.md](site/README.md): scroll engine, harness, search index, image pipeline.

## Checks

```bash
cd site && npm ci        # once
npm run build            # must pass before pushing; Cloudflare runs the same build
npm run harness          # after touching the home page story (src/scripts/story.js, src/pages/index.astro)
```

The build updates `site/search-cache.json` (passage embeddings) when text changes: commit it with the change.

## Rules

- Never push to `prod` or promote without the owner asking. Changes land on `main` (the preview site) first.
- Drafts (`draft: true`) must stay out of lists, feeds and search and never build for `prod`
  (`CF_PAGES_BRANCH`); keep it that way if you touch routing or the search index.
- Posts are written by Chris. Edit post text only when asked; code, components and data are fair game.
- Australian spelling in copy and docs. No em dashes.

## Issue tracking

This project uses **beads** (`.beads/`). `bd ready` for unblocked work, `bd show <id>` before starting,
`bd close <id>` when done (check the issue's acceptance criteria first), `bd sync` at session end.

## Session completion

Work is not done until it is pushed: run the build, commit, `git pull --rebase`, `bd sync`, `git push`, and
confirm `git status` shows the branch up to date. File beads for anything left over.

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
