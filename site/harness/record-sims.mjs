// Records the settled flow of each airflow figure scenario as a short seamless loop, the fallback that
// src/scripts/sim-recording.js plays where the live solver cannot run at a watchable speed.
//
//   npm run build && npm run preview &      (or any server on BASE)
//   node harness/record-sims.mjs [hair|h3d ...]
//
// Writes public/video/sims/<fig>-<preset>-<slot>.{webm,mp4,jpg} and <fig>.json (the room read-outs at the end of
// each recording). Needs ffmpeg with libvpx-vp9 and libx264.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:4321';
const PAGE = '/blog/choosing-a-quiet-fan-with-physics/';
const OUT = new URL('../public/video/sims/', import.meta.url).pathname;
const FPS = 24, LOOP_S = 5, FADE_S = 1; // a 5 s loop whose last second crossfades into its first
const FIGS = {
  hair: { sel: 'figure.hair', presets: ['ac', 'gap', 'retreat', 'hall'], slots: { plan: '.hair-canvas' }, settleMs: 16000 },
  h3d: { sel: 'figure.h3d', presets: ['ac', 'hall', 'two'], slots: { plan: '.h3d-plan', sec: '.h3d-sec' }, settleMs: 30000 },
};
const only = process.argv.slice(2);

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 1.5 });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));

for (const [name, fig] of Object.entries(FIGS)) {
  if (only.length && !only.includes(name)) continue;
  const readouts = {};
  for (const preset of fig.presets) {
    await page.goto(BASE + PAGE, { waitUntil: 'load' });
    const el = page.locator(fig.sel);
    await el.scrollIntoViewIfNeeded();
    await el.locator(`[data-preset="${preset}"]`).first().click();
    // the 3D figure's AC air settles on a time-lapse: wait for it, within reason
    const t0 = Date.now();
    await page.waitForTimeout(fig.settleMs);
    if (name === 'h3d') await page.waitForSelector('figure.h3d [data-settled="true"]', { timeout: 60000 }).catch(() => console.warn(`${name}/${preset}: not settled after ${Math.round((Date.now() - t0) / 1000)} s`));
    const n = Math.round((LOOP_S + FADE_S) * FPS);
    const shots = await el.evaluate(async (f, { slots, n, fps }) => {
      const out = Object.fromEntries(Object.keys(slots).map((k) => [k, []]));
      const cvs = Object.entries(slots).map(([k, s]) => [k, f.querySelector(s)]);
      const t0 = performance.now();
      await new Promise((done) => {
        let i = 0;
        const id = setInterval(() => {
          for (const [k, c] of cvs) out[k].push(c.toDataURL('image/jpeg', 0.94));
          if (++i >= n) { clearInterval(id); done(); }
        }, 1000 / fps);
      });
      const fpsGot = n / ((performance.now() - t0) / 1000);
      const rooms = f.querySelector('.hair-rooms, .h3d-rooms').innerHTML;
      const txt = (s) => f.querySelector(s)?.textContent || '';
      return { out, fpsGot, rooms, deliv: txt('[data-o="deliv"]'), settle: txt('[data-o="settle"]') };
    }, { slots: fig.slots, n, fps: FPS });
    readouts[preset] = { rooms: shots.rooms, deliv: shots.deliv, settle: shots.settle };
    for (const [slot, frames] of Object.entries(shots.out)) {
      const dir = mkdtempSync(join(tmpdir(), 'simrec-'));
      frames.forEach((d, i) => writeFileSync(join(dir, `${String(i).padStart(4, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64')));
      const stem = join(OUT, `${name}-${preset}-${slot}`);
      // body: frames from FADE_S on; its last FADE_S crossfade into the first FADE_S, so the end meets the start. The
      // frames are timed at the rate the page actually managed, then resampled to FPS
      const fps = shots.fpsGot.toFixed(3), F = Math.round(FADE_S * shots.fpsGot), body = (frames.length - F) / shots.fpsGot;
      const graph = `[0:v]split[a][b];[a]trim=start_frame=${F},setpts=PTS-STARTPTS[body];[b]trim=end_frame=${F},setpts=PTS-STARTPTS[head];`
        + `[body][head]xfade=transition=fade:duration=${(F / shots.fpsGot).toFixed(3)}:offset=${(body - F / shots.fpsGot).toFixed(3)},fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p[v]`;
      const inp = ['-y', '-loglevel', 'error', '-framerate', fps, '-i', join(dir, '%04d.jpg'), '-filter_complex', graph, '-map', '[v]', '-an'];
      execFileSync('ffmpeg', [...inp, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', `${stem}.webm`]);
      execFileSync('ffmpeg', [...inp, '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-movflags', '+faststart', `${stem}.mp4`]);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(dir, `${String(F).padStart(4, '0')}.jpg`), '-q:v', '4', `${stem}.jpg`]);
      rmSync(dir, { recursive: true, force: true });
      console.log(`${name}/${preset}/${slot}: ${frames.length} frames at ${fps} fps -> ${stem}.{webm,mp4,jpg}`);
    }
  }
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(readouts));
}
await browser.close();
