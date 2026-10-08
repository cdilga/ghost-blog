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
