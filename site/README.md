# chris.dilger.me (static)

Astro site that replaces the Ghost theme. Deployed to GitHub Pages by `.github/workflows/pages.yml` on pushes to `main`.

```bash
cd site && npm ci
npm run dev        # http://localhost:4321
npm run build
npm run harness    # full device/zoom matrix -> harness/out/report.html
node harness/run.mjs --quick     # 3 devices
node harness/run.mjs --video     # also records a webm of the scripted scroll
node harness/montage.mjs laptop 5 2   # contact sheet for one device
npm run shots      # re-capture project screenshots into public/shots (needs network)
node scripts/import-ghost.mjs export.json [--download-images]   # port old Ghost posts
```

## How the scroll story works
`src/scripts/story.js`. Native scroll only. The track and sticky stage are sized in `lvh` and content lives in an `svh` frame, so Chrome's collapsing toolbar never changes layout. Progress = scrollY / track range, smoothed by a damped follower. Scenes are `<section class="scene" data-len="1.2">` (length in viewport heights); elements use `data-fx="words|rise|fade|tilt|pan"` with `data-a` (start) and `data-d` (duration) in scene-local progress. Add scene-specific animation as a hook function of local progress.
Append `?static` (or use reduced motion) for the stacked, no-animation layout.

## Blog
Markdown or MDX in `src/content/blog`. In MDX use `<Chart type="line|bar|scatter" series={[{name, data:[[x,y]]}]} />` (build-time SVG, no JS).

## Notes
- `books.dilger.au` is still "coming soon"; the story uses `test.books.dilger.au` shots. Re-run `npm run shots` after launch.
- Set the repo's Pages source to "GitHub Actions" and point the `chris.dilger.me` DNS at Pages when ready to cut over from Ghost.
