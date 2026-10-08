# chris.dilger.me

Chris Dilger's site: a scroll story on the home page, and a blog with interactive charts, simulations and
dependency graphs. Built with [Astro](https://astro.build), hosted on Cloudflare Pages.

The code is written by AI agents (Claude Code); the posts are written by me.

| | |
|---|---|
| Live | https://chris.dilger.me (the `prod` branch) |
| Preview | https://chris-preview.dilger.me (the `main` branch, hidden from search engines) |
| Writing guide | [WRITING.md](WRITING.md): images, video, embeds, charts and other rich content |
| Site internals | [site/README.md](site/README.md): the scroll engine, test harness, search, image pipeline |

## Write and publish

One-time setup (needs git and Node.js 22):

```bash
git clone https://github.com/cdilga/ghost-blog.git && cd ghost-blog
./blog setup
```

Then, each post:

```bash
./blog new "Post title"        # draft at site/src/content/blog/post-title.md (--mdx for charts and components)
./blog dev                     # live preview at http://localhost:4321 while you write
./blog preview "post: title"   # build, commit and push to main -> chris-preview.dilger.me in ~2 minutes
./blog status                  # what is on preview but not live yet
./blog promote                 # put preview live -> chris.dilger.me in ~2 minutes
```

New posts start as drafts: they get a URL on the preview site so you can read them anywhere, but they are kept
out of lists, feeds and search and are never built for production. Set `draft: false` when it is ready.

No terminal handy? Edit or upload under `site/src/content/blog` on GitHub, commit to `main`, check the preview,
then run **Actions > Promote to production**. [WRITING.md](WRITING.md) has the details.

## How publishing works

```
your commit ──push──▶ main ──Cloudflare Pages──▶ chris-preview.dilger.me
                       │
                 ./blog promote (fast-forwards prod to main)
                       ▼
                     prod ──Cloudflare Pages──▶ chris.dilger.me
```

- Cloudflare Pages (project `chris-dilger-me`) builds every push to `main` and `prod` itself. No secrets live here.
- `prod` only ever moves forward to a commit already on `main`, so production is always something you have seen on
  the preview site. `./blog promote` uses the **Promote to production** workflow when the GitHub CLI is signed in,
  and otherwise pushes `prod` itself with the same check.
- [Site build check](.github/workflows/site-check.yml) builds every push and pull request so a broken build
  shows red on GitHub before it reaches Cloudflare.
- To undo a release: Cloudflare dashboard > Workers & Pages > chris-dilger-me > Deployments > **Rollback** on the
  previous production deployment.

## Layout

```
blog                    the ./blog helper (setup, new, dev, check, preview, status, promote)
WRITING.md              how to write posts, with every component
site/
  src/content/blog/     posts (.md and .mdx)
  src/content/pages/    standalone pages (cv, reading list, photography)
  src/components/       charts, embeds and interactive figures used in posts
  src/pages/            routes: home story, blog, tags, RSS, redirects for old Ghost URLs
  src/data/             JSON data the posts import
  public/               images, video and other files served as-is (posts use public/img/<slug>/)
  scripts/              build-time image optimisation and search index, data generators for posts
  harness/              screenshot/video test harness for the scroll story
.beads/                 issue tracker (beads)
docs/ghost-server/      runbooks for the retired Ghost server (backups, sysadmin)
docs/ghost-era/         design notes from the Ghost theme the static site replaced
```

## History

Until October 2026 this repo was a custom Ghost theme deployed to a VPS. The site was rebuilt as a static Astro
site, the old posts were ported across (old Ghost URLs 301 to the new ones), and the Ghost theme, storage adapter,
deploy pipeline and tests were removed. They are all in the git history: the last commit with them is `d4e10a1`.

## Licence

MIT. See [LICENSE](LICENSE).
