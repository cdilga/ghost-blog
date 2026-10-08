# Writing for chris.dilger.me

Everything you need to write, preview and publish a post by hand. For the one-line version of each step see
the [README](README.md).

## The loop

```bash
./blog new "Why my fan is quiet"        # creates site/src/content/blog/why-my-fan-is-quiet.md as a draft
./blog dev                              # http://localhost:4321/blog/why-my-fan-is-quiet/ updates as you save
./blog preview "post: why my fan is quiet"   # build, commit, push to main -> chris-preview.dilger.me
./blog promote                          # put it live on chris.dilger.me
```

A post starts as a **draft** (`draft: true`). Drafts:

- show at their own URL locally and on the preview site, marked "Draft", so you can read them on your phone or send
  the preview link to someone;
- are left out of the post lists, tag pages, RSS, the home page and search, and are marked `noindex`;
- are **never built for production**, even if you promote while one is in the repo.

To publish, set `draft: false` (and set `date` to the publish day), then `./blog preview` and `./blog promote`.

### No terminal? Use GitHub in the browser

1. Open [site/src/content/blog](https://github.com/cdilga/ghost-blog/tree/main/site/src/content/blog), then
   **Add file > Create new file** (or open a post and press the pencil). Copy the front matter from another post.
2. Upload images with **Add file > Upload files** into `site/public/img/<your-post-slug>/`.
3. **Commit directly to `main`**. Two minutes later it is on [chris-preview.dilger.me](https://chris-preview.dilger.me).
4. To go live: **Actions > Promote to production > Run workflow**.

Pressing `.` on any GitHub page opens the same files in a full editor in the browser.

## Front matter

The block at the top of every post:

```yaml
---
title: "Why my fan is quiet"
description: "One or two sentences. Used in search results, link previews and the post list."
date: 2026-10-08
tags: [physics, home]          # each tag gets a page at /blog/tag/<tag>/
image: /img/why-my-fan-is-quiet/cover.jpg   # optional: cover at the top, thumbnail in lists, link preview image
draft: true
---
```

The post's URL is its file name: `why-my-fan-is-quiet.md` becomes `/blog/why-my-fan-is-quiet/`. Renaming the file
changes the URL, so do that before publishing.

## Plain Markdown

`.md` files take normal Markdown, GitHub style: headings (`##` and down, the title is already the `#`), **bold**,
*italic*, lists, `> quotes`, `inline code`, fenced code blocks with a language (` ```js `) for highlighting,
tables, task lists, footnotes (`text[^1]` with `[^1]: the note` at the bottom) and links.

Link to other posts with their path: `[the fan post](/blog/choosing-a-quiet-fan-with-physics/)`.

## Images

Put them in `site/public/img/<post-slug>/` and link them from the site root:

```markdown
![A Dreo fan on the bench, grille off](/img/why-my-fan-is-quiet/bench.jpg)
```

Drop in the full-size JPEG or PNG straight off the phone. The build makes WebP copies at sensible widths, picks the
right one for each screen, sets width and height so the page does not jump, and lazy-loads below the fold. Always
write the alt text: it is what screen readers read and what shows if the image fails.

**With a caption**, use a little HTML (fine in both `.md` and `.mdx`):

```html
<figure>
  <img src="/img/why-my-fan-is-quiet/bench.jpg" alt="A Dreo fan on the bench, grille off" />
  <figcaption>The grille is half the noise.</figcaption>
</figure>
```

**Side by side**:

```html
<div class="gallery"><div class="gallery-row">
  <img src="/img/why-my-fan-is-quiet/before.jpg" alt="Before" />
  <img src="/img/why-my-fan-is-quiet/after.jpg" alt="After" />
</div></div>
```

Add `data-no-opt` to an `<img>` to skip the optimiser (for an animated GIF, say).

## Video and embeds

**Your own video**: put the file in `site/public/video/<post-slug>/`. Keep each file under 25 MB (Cloudflare's
limit; the build fails loudly if one is bigger). Encode to H.264 MP4.

```html
<figure class="embed">
  <video src="/video/why-my-fan-is-quiet/smoke-test.mp4" controls playsinline preload="metadata"></video>
  <figcaption>Smoke shows where the air really goes.</figcaption>
</figure>
```

For a short silent loop that plays like a GIF use `autoplay muted loop playsinline` instead of `controls`.

**YouTube** (16:9, responsive):

```html
<figure class="embed video"><iframe src="https://www.youtube.com/embed/VIDEO_ID" title="What the video is" loading="lazy" allowfullscreen allow="autoplay; encrypted-media"></iframe></figure>
```

**Anything else that gives you an iframe** (Google Docs, maps, CodePen): the same `<figure class="embed">`
wrapper, 600 px tall unless the iframe sets `height`.

**X / Twitter** posts need the MDX component below (`<Tweet />`).

## Rich content: MDX

Rename the file to `.mdx` (or start with `./blog new "Title" --mdx`) and you can drop interactive and
data-driven components into the text. Import what you use just under the front matter:

```mdx
---
title: ...
---
import Chart from '../../components/Chart.astro';
import CompareWipe from '../../components/CompareWipe.astro';

Normal Markdown here, then a component:

<Chart type="line" title="Noise vs speed" series={[{ name: 'Dreo', data: [[1, 22], [2, 31], [3, 38]] }]} xLabel="speed setting" yLabel="dBA" />
```

MDX is stricter than Markdown in four ways:

- `{` and `}` mean "JavaScript here". Write `\{` for a literal brace.
- `<` starts a tag. Write `&lt;` (or put it in backticks) for a literal less-than.
- HTML comments do not work. Use `{/* a note to myself */}`.
- Every tag must be closed: `<img ... />`, `<br />` (the snippets in this guide already are).

### The components

All charts render to plain SVG at build time: no JavaScript to load, and readable in both light and dark.

| Component | What it is |
|---|---|
| `Chart` | Line, bar or scatter chart. Line charts get a hover/touch readout. |
| `BarList` | Ranked horizontal bars with value labels and an optional reference line. |
| `DualChart` | Two quantities with different units on one x axis (left and right axes). |
| `ParetoChart` | Scatter with the best-trade-off frontier drawn and every point labelled. |
| `CompareWipe` | Before/after slider over two images of the same view. |
| `Term` | A highlighted definition for teaching posts. |
| `Tweet` | An X post: a plain link that turns into the embed when scrolled near. |

```mdx
import Chart from '../../components/Chart.astro';
<Chart type="line" title="Temperature through the night"
  series={[{ name: 'bedroom', data: [[0, 27], [2, 25.5], [4, 24]] }, { name: 'outside', data: [[0, 24], [2, 21], [4, 19]] }]}
  xLabel="hours after 10pm" yLabel="°C" caption="What the chart shows, in a sentence." />
{/* type="bar" takes text x values: data: [['Mon', 3], ['Tue', 5]]. Also: logX, logY, yMin, yMax, height */}

import BarList from '../../components/BarList.astro';
<BarList title="Share of airflow reaching the bed" unit="%" max={100}
  rows={[{ label: 'Ceiling fan', value: 62 }, { label: 'Pedestal fan', sub: 'at 2 m', value: 31 }]}
  ref={{ value: 25, label: 'free jet' }} />

import CompareWipe from '../../components/CompareWipe.astro';
<CompareWipe before="/img/my-post/model.jpg" after="/img/my-post/photo.jpg" beforeLabel="Model" afterLabel="Photo" alt="The same room, modelled and photographed" />

import Term from '../../components/Term.astro';
<Term name="Reynolds number" symbol="Re">How turbulent a flow is: inertia divided by viscosity.</Term>

import Tweet from '../../components/Tweet.astro';
<Tweet url="https://x.com/user/status/123" label="What the post says, for people who do not load X" />
```

**Data from a file.** Long series are easier to keep in a JSON file next to the other site data and import:

```mdx
import Chart from '../../components/Chart.astro';
import runs from '../../data/my-runs.json';   // site/src/data/my-runs.json: [[0, 1.2], [1, 1.9], ...]

<Chart type="scatter" series={[{ name: 'runs', data: runs }]} xLabel="..." yLabel="..." />
```

You can also use values from it in the text: `I did {runs.length} runs.`

The other components (`BeadsGraph`, `BeadsForce`, `HouseAirflow`, `HouseAirflow3D`, `JetExplorer`, `DualChart`,
`ParetoChart`) are built for particular posts; each one documents its props in a comment at the top of its file in
`site/src/components/`, and [planning-with-beads.mdx](site/src/content/blog/planning-with-beads.mdx) and
[choosing-a-quiet-fan-with-physics.mdx](site/src/content/blog/choosing-a-quiet-fan-with-physics.mdx) show them in
use.

### Something new

Anything interactive beyond that (a simulation, a little tool) is a new component in `site/src/components/`:
an `.astro` file with its markup, a `<style>` and a `<script>`. `JetExplorer.astro` is a compact example to copy.
This is a good job to hand an agent: describe what it should show and let it write the component and the post
section together.

## Before you publish

- `./blog check` builds exactly what Cloudflare will build. If it fails, the error names the file and line.
- Look at the preview on your phone as well as a laptop.
- `./blog status` lists what is on the preview site and not yet live, so you know what `./blog promote` will ship.
- Promoting ships everything on `main`, not only your post. If something half-finished is on `main`, either finish
  it first or promote an earlier commit: `./blog promote <commit>`.
- A bad release can be rolled back in one click: Cloudflare dashboard > Workers & Pages > chris-dilger-me >
  Deployments > Rollback on the previous production deployment.
