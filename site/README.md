# chris.dilger.me (static)

Astro site for chris.dilger.me. Cloudflare Pages builds `main` to https://chris-preview.dilger.me and `prod` to https://chris.dilger.me; see the [root README](../README.md) for publishing and [WRITING.md](../WRITING.md) for writing posts.

```bash
cd site && npm ci
npm run dev        # http://localhost:4321
npm run build
npm run harness    # full device/zoom matrix -> harness/out/report.html
node harness/run.mjs --quick     # 3 devices
node harness/run.mjs --video     # also records a webm of the scripted scroll
node harness/montage.mjs laptop 5 2   # contact sheet for one device
npm run shots      # re-capture project screenshots into public/shots (needs network)
```

## How the scroll story works
`src/scripts/story.js`. Native scroll only. The track and sticky stage are sized in `lvh` and content lives in an `svh` frame, so Chrome's collapsing toolbar never changes layout. Progress = scrollY / track range, smoothed by a damped follower.

- Scenes are `<section class="scene" data-len="1.2">` (base length in viewport heights).
- **Content always fits.** On every width change the engine measures each scene's `.content` against the frame. Taller content gets extra scroll length and pans through the frame (masked under the header) instead of being clipped, so phones, landscape and zoomed desktops keep all the copy.
- Every scene enters (drifts up), holds, and exits (lifts away) while crossfading with its neighbours.
- Element effects: `data-fx="words|reveal|rise|fade|out|tilt|pan|bgzoom|count|drift"` with `data-a` (start) and `data-d` (duration) in scene-local progress. `reveal` is the read-along body-copy effect (words light up as you scroll, inline markup kept).
- Scene hooks (`data-hook="beads|terms|rack|house|timeline"`) are stateless functions of local progress; give a hook a `relayout` method if it needs measurements.

Append `?static` (or use reduced motion) for the stacked, no-animation layout.

## Harness
`npm run harness` writes `harness/out/report.html`: contact sheets per device/zoom, a scene opacity timeline (dead air), a clipping check (every key element must be fully on screen at some point while its scene is active), per-scene readable hold (share of the scene where it is fully opaque and all text revealed), resize stability and frame timing.

## Blog
How to write posts, with every component: [WRITING.md](../WRITING.md). In short: Markdown or MDX in `src/content/blog`. In MDX use `<Chart type="line|bar|scatter" series={[{name, data:[[x,y]]}]} />` (build-time SVG; line charts get a small hover/touch readout). `<JetExplorer />` is an example of a fully interactive figure. Tags get pages at `/blog/tag/<tag>/`.

The live airflow figures (`<HouseAirflow />`, `<HouseAirflow3D />`) fall back to recorded loops of each scenario when the solver fails, stalls or runs below about 0.3x real time (Firefox with its JavaScript JIT switched off runs it at about 0.1x). Append `?simrec` to force the recordings. Re-record after changing a solver, preset or the plan drawing: `npm run build && npm run preview &` then `node harness/record-sims.mjs` (needs ffmpeg; writes `public/video/sims/`).

Old Ghost posts were ported once (they carry `legacy: true`, images under `public/img/ghost/`; the porting script is in git history). Old URLs (`/<slug>/`, `/tag/<tag>/`, `/rss/`) redirect to the new ones.

## Notes
- `books.dilger.au` is still "coming soon"; the story uses `test.books.dilger.au` shots. Re-run `npm run shots` after launch.
