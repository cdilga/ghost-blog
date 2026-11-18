// Fetches the card media for the /projects page into public/projects/, so the page serves its own copies
// (no hotlinking, no CDNs). Run it when a project is added or its look changes, then commit the files.
//
//   npm run projects              every project in src/data/projects.json
//   npm run projects -- big-lap   only slugs containing "big-lap"
//
// Per project, by media.type:
//   og    the site's og:video (re-encoded to a small silent loop of up to 24 s, plus a poster frame), else its og:image
//   shot  a 1200x630 screenshot of media.url (default: the project url), after `wait` ms and optional
//         `press` / `click` to dismiss a welcome dialog
//   file  an image already in public/ (cropped to the same 1200x630 card; `fit: "contain"` keeps all of it on a
//         blurred backdrop). An animated WebP or GIF also becomes a video loop.
// Every card image ends up as public/projects/<slug>.jpg at 1200x630 (the og card shape), under ~180 KB.
// Videos need ffmpeg on PATH.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'public/projects');
const data = JSON.parse(readFileSync(join(root, 'src/data/projects.json'), 'utf8'));
const filter = process.argv[2] || '';
const W = 1200, H = 630, MAX_BYTES = 180 * 1024;
mkdirSync(out, { recursive: true });

// cover crops to the card from the top (or from `position`); contain sits the whole image on a blurred, darkened copy of itself
async function card(input, fit = 'cover', w = W, h = H, position = 'top') {
  if (fit !== 'contain') return sharp(input).resize(w, h, { fit: 'cover', position }).toBuffer();
  const bg = await sharp(input).resize(w, h, { fit: 'cover' }).blur(28).modulate({ brightness: 0.45 }).toBuffer();
  const fg = await sharp(input).resize(w, h, { fit: 'inside' }).toBuffer();
  return sharp(bg).composite([{ input: fg, gravity: 'centre' }]).toBuffer();
}

async function saveCard(input, file, fit, position) {
  const img = await card(input, fit, W, H, position);
  let q = 82, buf;
  do { buf = await sharp(img).jpeg({ quality: q, mozjpeg: true }).toBuffer(); q -= 6; }
  while (buf.length > MAX_BYTES && q > 40);
  writeFileSync(file, buf);
  return buf.length;
}

const encode = (args, mp4) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '32',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);

// an animated WebP/GIF in public/ becomes a video loop the same way an og:video does
async function animation(file, slug, fit) {
  const { pages, delay = [] } = await sharp(file).metadata();
  const tmp = mkdtempSync(join(tmpdir(), 'projmedia-'));
  try {
    for (let i = 0; i < pages; i++) await sharp(await card(await sharp(file, { page: i }).png().toBuffer(), fit, 960, 504)).png().toFile(join(tmp, `f${String(i).padStart(4, '0')}.png`));
    const fps = Math.max(1, Math.round(1000 / (delay[0] || 80)));
    const mp4 = join(out, `${slug}.mp4`);
    encode(['-framerate', String(fps), '-i', join(tmp, 'f%04d.png')], mp4);
    const kb = await saveCard(await sharp(file, { page: 0 }).png().toBuffer(), join(out, `${slug}.jpg`), fit);
    return `animation ${pages} frames, video ${Math.round(statSync(mp4).size / 1024)} KB, poster ${Math.round(kb / 1024)} KB`;
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

const meta = (html, prop) => {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (new RegExp(`(property|name)=["']${prop}["']`, 'i').test(tag)) return tag.match(/content=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, '&');
  }
};

let browser;
const page = async () => {
  browser ??= await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  return ctx.newPage();
};

async function screenshot(url, m) {
  const p = await page();
  await p.goto(url, { waitUntil: 'load', timeout: 45000 });
  await p.waitForTimeout(m.wait ?? 6000);
  if (m.press) await p.keyboard.press(m.press).catch(() => {});
  if (m.click) await p.locator(m.click).first().click({ timeout: 2000 }).catch(() => {});
  if (m.press || m.click) await p.waitForTimeout(800);
  const buf = await p.screenshot({ type: 'png' });
  await p.context().close();
  return buf;
}

async function video(src, slug) {
  const tmp = mkdtempSync(join(tmpdir(), 'projmedia-'));
  try {
    const raw = join(tmp, 'in.mp4');
    writeFileSync(raw, Buffer.from(await (await fetch(src)).arrayBuffer()));
    const mp4 = join(out, `${slug}.mp4`);
    // silent 960x504 loop, small enough to sit on a page of cards
    encode(['-i', raw, '-t', '24', '-vf', 'scale=960:504:force_original_aspect_ratio=increase,crop=960:504,fps=30'], mp4);
    const frame = join(tmp, 'poster.png');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '2', '-i', raw, '-frames:v', '1', frame]);
    // the poster is cropped about the centre, like the loop above, so a caption at the bottom of the frame is not
    // cut in half and the picture does not jump when the loop starts
    const kb = await saveCard(frame, join(out, `${slug}.jpg`), 'cover', 'centre');
    return `video ${Math.round(statSync(mp4).size / 1024)} KB, poster ${Math.round(kb / 1024)} KB`;
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

for (const p of [...data.games, ...data.more].filter((x) => x.slug.includes(filter))) {
  const m = p.media;
  try {
    let note;
    if (m.type === 'og') {
      const html = await (await fetch(p.url)).text();
      const vid = meta(html, 'og:video:secure_url') || meta(html, 'og:video');
      const img = meta(html, 'og:image');
      if (vid) note = await video(new URL(vid, p.url).href, p.slug);
      else if (img) note = `og:image ${Math.round(await saveCard(Buffer.from(await (await fetch(new URL(img, p.url))).arrayBuffer()), join(out, `${p.slug}.jpg`)) / 1024)} KB`;
      else throw new Error('no og:video or og:image; use a shot');
    } else if (m.type === 'shot') {
      note = `shot ${Math.round(await saveCard(await screenshot(m.url || p.url, m), join(out, `${p.slug}.jpg`)) / 1024)} KB`;
    } else if (m.type === 'file') {
      const file = join(root, 'public', m.path);
      if (((await sharp(file).metadata()).pages ?? 1) > 1) note = await animation(file, p.slug, m.fit);
      else note = `file ${Math.round(await saveCard(file, join(out, `${p.slug}.jpg`), m.fit) / 1024)} KB`;
    }
    console.log('ok  ', p.slug, note);
  } catch (e) { console.log('FAIL', p.slug, e.message.split('\n')[0]); process.exitCode = 1; }
}
await browser?.close();
