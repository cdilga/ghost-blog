# Beads Agent: Ghost Blog Portfolio

## Project Overview

You are working on **chris.dilger.me** - a Ghost blog theme for Chris Dilger's personal portfolio website. The theme showcases Chris as a coder, speaker, and consultant through an interactive, visually rich design.

## Current Goals

The project is building a **scrolling portfolio experience** with:

1. **Hero Section** - Desert landscape with parallax effects
2. **Scene Sections** - Interactive showcases for different aspects:
   - The Coder (keyboard visualization, GitHub activity)
   - The Speaker (talks/presentations showcase)
   - The Consultant (enterprise work highlights)
   - 8 Claude Codes (parallel terminals visualization)
3. **Projects Section** - Animated cards with hover effects
4. **Blog Carousel** - Infinite scroll with scroll-hijack
5. **Embed Components** - X.com, GitHub, YouTube integrations
6. **Dev Playground** - .dev projects showcase

## Tech Stack

- **Ghost CMS** (Handlebars templates)
- **CSS** (custom theme styling)
- **JavaScript** (scroll animations, parallax effects)

## Your Task

1. Run `bd ready` to see available work
2. Pick ONE task: `bd update <id> --status=in_progress`
3. Read the full issue: `bd show <id>`
4. Check labels - use `/frontend-designer` skill for frontend work
5. Implement the feature/fix following existing patterns
6. Test if code changed: `npm test` (requires `npm start` first)
7. Commit with meaningful message
8. Close the bead: `bd close <id>`
9. Push changes: `git push`

## Critical Rules

- **ALWAYS read GUARDRAILS.md** before SSH/server operations
- **ALWAYS run `npm test`** before closing theme-related issues
- **ALWAYS push changes** - work isn't done until `git push` succeeds
- **Work autonomously** - make reasonable decisions, don't ask for clarification
- **If blocked** - document the blocker in the issue and move to next task
- **Ghost CLI** must run as `chris` user, not root

## Learning from Failures

When you encounter an approach that **doesn't work** or causes issues:

1. Add it to `GUARDRAILS.md` under a relevant section
2. Keep it concise - just the pitfall and what to do instead
3. Only document **specific gotchas**, not generic logs

Example format for GUARDRAILS.md:
```markdown
## Theme Development Pitfalls

- **Don't use X** - causes Y. Instead do Z.
- **Card CSS requires** - the `.kg-card` wrapper, not direct selectors
```

This helps future sessions avoid the same mistakes.

## SSH Access

```bash
ssh ghost-blog                    # Connects as root
sudo -u chris bash -c '...'       # Run Ghost CLI commands
```

## Quality Gates

Before closing any issue:
```bash
npm start        # Start Ghost locally
npm test         # Run ALL tests (gscan + smoke)
git push         # Push to remote
```

## Session End Protocol

When finishing work:
1. Close completed beads: `bd close <id>`
2. Push everything: `git pull --rebase && git push`
3. Verify: `git status` shows "up to date with origin"
