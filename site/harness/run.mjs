// Visual + timing harness for the scroll story.
//   npm run build && npm run harness            (full matrix)
//   node harness/run.mjs --quick                (2 devices)
//   node harness/run.mjs --video                (also record a webm of a scripted scroll per device)
// Outputs harness/out/report.html with: contact sheets per device/zoom, a scene
// timeline chart (opacity of each scene vs progress, to spot dead air or clutter),
// frame-time stats from a scripted wheel scroll, and a toolbar-jitter stability check.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = path.join(root, 'dist');
const out = path.join(root, 'harness/out');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const quick = process.argv.includes('--quick');
const video = process.argv.includes('--video');

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.xml': 'application/xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(dist, p);
  if (!f.startsWith(dist) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

// "zoom" = what a browser zoom does: fewer CSS px across the same screen, higher DPR.
const devices = [
  { name: 'iphone-toolbar-shown', w: 390, h: 664, mobile: true, dpr: 3 },
  { name: 'iphone-toolbar-hidden', w: 390, h: 750, mobile: true, dpr: 3 },
  { name: 'pixel-landscape', w: 800, h: 360, mobile: true, dpr: 2.6 },
  { name: 'ipad', w: 820, h: 1180, mobile: true, dpr: 2 },
  { name: 'laptop', w: 1440, h: 900, dpr: 1 },
  { name: 'laptop-zoom150', w: 960, h: 600, dpr: 1.5 },
  { name: 'laptop-zoom200', w: 720, h: 450, dpr: 2 },
  { name: 'desktop-4k-zoom75', w: 2560, h: 1440, dpr: 0.75 },
].filter((d) => !quick || ['iphone-toolbar-shown', 'laptop'].includes(d.name));

const STOPS = 30;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const report = [];

for (const dev of devices) {
  const ctx = await browser.newContext({
    viewport: { width: dev.w, height: dev.h }, deviceScaleFactor: Math.min(dev.dpr, 2), isMobile: !!dev.mobile, hasTouch: !!dev.mobile,
    ...(video ? { recordVideo: { dir: path.join(out, 'video'), size: { width: Math.min(dev.w, 800), height: Math.round(Math.min(dev.w, 800) * dev.h / dev.w) } } } : {}),
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('html[data-story-ready]', { state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
  const dir = path.join(out, dev.name); fs.mkdirSync(dir, { recursive: true });

  // 1) contact sheet + scene opacity timeline, driven by instant scrolls and snapped progress
  const timeline = [];
  const shots = [];
  const info = await page.evaluate(() => { const s = document.getElementById('story'); return { top: s.getBoundingClientRect().top + scrollY, range: s.offsetHeight - document.querySelector('.stage').offsetHeight }; });
  for (let i = 0; i <= 100; i++) {
    const P = i / 100;
    await page.evaluate(([y]) => { scrollTo(0, y); window.__story.measure(); window.__story.snap(); }, [info.top + P * info.range]);
    const row = await page.evaluate(() => ({ P: window.__story.progress, o: window.__story.scenes.map((s) => (s.on ? +(s.o ?? 0).toFixed(3) : 0)) }));
    timeline.push(row);
    if (i % Math.round(100 / STOPS) === 0 || i === 100) {
      await page.waitForTimeout(40);
      const f = `p${String(i).padStart(3, '0')}.jpg`;
      await page.screenshot({ path: path.join(dir, f), type: 'jpeg', quality: 60 });
      shots.push({ f, P });
    }
  }
  // clipped-content check at every active scene's mid point: text/CTA boxes must sit inside the visible viewport
  const clipped = await page.evaluate(([top, range]) => {
    const bad = [];
    window.__story.scenes.forEach((s) => {
      scrollTo(0, top + (s.start + (s.end - s.start) * 0.55) * range); window.__story.measure(); window.__story.snap();
      s.el.querySelectorAll('h1,h2,.lede,.cta,.browser,.term,.card,svg.graph,svg.house').forEach((el) => {
        const r = el.getBoundingClientRect(); const o = parseFloat(getComputedStyle(el).opacity);
        if (r.width && o > 0.5 && (r.bottom > innerHeight + 2 || r.top < -2 || r.right > innerWidth + 2 || r.left < -2)) bad.push(`${s.id}:${el.tagName.toLowerCase()}.${(el.className.baseVal ?? el.className).toString().split(' ')[0]} top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} vh=${innerHeight}`);
      });
    });
    return bad;
  }, [info.top, info.range]);

  // dead air: stretches of progress where the strongest scene is dim
  let dead = 0; for (const r of timeline) if (Math.max(...r.o) < 0.55) dead++;

  // 2) resize stability: after height-only resizes the engine must agree with a fresh measurement (no stale cache)
  await page.evaluate(([y]) => { scrollTo(0, y); window.__story.measure(); window.__story.snap(); }, [info.top + 0.37 * info.range]);
  let maxDP = 0;
  for (let k = 0; k < 8; k++) {
    await page.setViewportSize({ width: dev.w, height: dev.h + (k % 2 ? 0 : 56) });
    await page.waitForTimeout(80);
    const d = await page.evaluate(() => { const live = window.__story.target; window.__story.measure(); return Math.abs(live - window.__story.target) ; });
    maxDP = Math.max(maxDP, d);
  }
  await page.setViewportSize({ width: dev.w, height: dev.h });

  // 3) frame timing during a scripted wheel/touch-like scroll through the whole story
  await page.evaluate(() => { scrollTo(0, 0); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { const s = window.__story.stats; s.frames = 0; s.long = 0; s.worst = 0; s.dts.length = 0; });
  const t0 = Date.now();
  const steps = 160;
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, info.range / steps); await page.waitForTimeout(16); }
  await page.waitForTimeout(600);
  const perf = await page.evaluate(() => { const s = window.__story.stats; const d = [...s.dts].sort((a, b) => a - b); return { frames: s.frames, long: s.long, worst: +s.worst.toFixed(1), p50: d[Math.floor(d.length * 0.5)], p95: d[Math.floor(d.length * 0.95)] }; });
  perf.seconds = +((Date.now() - t0) / 1000).toFixed(1);

  report.push({ dev, shots, timeline, clipped, dead, maxDP: +maxDP.toFixed(4), perf, errors, sceneIds: await page.evaluate(() => window.__story.scenes.map((s) => [s.id, s.start, s.end])) });
  await ctx.close();
  console.log(`${dev.name.padEnd(24)} clipped=${clipped.length} dead=${dead}% jitterΔP=${maxDP.toFixed(4)} p95=${perf.p95}ms worst=${perf.worst}ms errors=${errors.length}`);
}
await browser.close(); server.close();

const colours = ['#ff7a1a', '#5ec8c0', '#b48cff', '#f2e6d3', '#ffd166', '#ff6b9d', '#7ed49a', '#6aa9ff', '#e0a370', '#9aa'];
const chart = (r) => {
  const W = 900, H = 140;
  const lines = r.sceneIds.map(([id], si) => `<polyline fill="none" stroke="${colours[si % 10]}" stroke-width="1.6" points="${r.timeline.map((row, i) => `${(i / 100) * W},${H - row.o[si] * (H - 10) - 5}`).join(' ')}"><title>${id}</title></polyline>`).join('');
  const labels = r.sceneIds.map(([id, s, e], si) => `<text x="${((s + e) / 2) * W}" y="${H + 14}" fill="${colours[si % 10]}" font-size="10" text-anchor="middle">${id}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H + 20}" style="width:100%;background:#1c1410;border-radius:8px">${lines}${labels}</svg>`;
};
const html = `<!doctype html><meta charset=utf-8><title>Story harness</title><style>body{background:#120d0a;color:#f2e6d3;font:14px system-ui;margin:20px}h2{margin-top:40px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}.grid figure{margin:0;font:10px monospace;color:#b9a68f}.grid img{width:100%;border-radius:4px;display:block}.ok{color:#7ed49a}.bad{color:#ff6b6b}code{color:#ff9a4d}</style><h1>Scroll story harness</h1><p>Scene opacity vs progress (each colour is a scene). Smooth overlaps are good; gaps below 0.55 are dead air.</p>${report.map((r) => `<h2>${r.dev.name} <small>${r.dev.w}×${r.dev.h} @${r.dev.dpr}x</small></h2><p>clipped: <b class="${r.clipped.length ? 'bad' : 'ok'}">${r.clipped.length}</b> · dead air: <b class="${r.dead > 3 ? 'bad' : 'ok'}">${r.dead}%</b> · stale-measure ΔP: <b class="${r.maxDP > 0.01 ? 'bad' : 'ok'}">${r.maxDP}</b> · frame p50/p95/worst: ${r.perf.p50}/${r.perf.p95}/${r.perf.worst} ms (${r.perf.long} >24ms of ${r.perf.frames}) · console errors: <b class="${r.errors.length ? 'bad' : 'ok'}">${r.errors.length}</b></p>${r.clipped.length ? `<pre>${r.clipped.join('\n')}</pre>` : ''}${r.errors.length ? `<pre>${r.errors.join('\n').replace(/</g, '&lt;')}</pre>` : ''}${chart(r)}<div class="grid">${r.shots.map((s) => `<figure><img loading=lazy src="${r.dev.name}/${s.f}"><figcaption>${(s.P * 100).toFixed(0)}%</figcaption></figure>`).join('')}</div>`).join('')}`;
fs.writeFileSync(path.join(out, 'report.html'), html);
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(report.map((r) => ({ device: r.dev.name, clipped: r.clipped, dead: r.dead, jitter: r.maxDP, perf: r.perf, errors: r.errors })), null, 1));
console.log('report:', path.join(out, 'report.html'));
