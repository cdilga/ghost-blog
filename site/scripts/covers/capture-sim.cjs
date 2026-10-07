// Run the 3D fan sim in the built post and save its plan canvas: node capture-sim.cjs out.png
const { chromium } = require('../../node_modules/playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '../../dist');
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(dist, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(4590);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
  await pg.goto('http://localhost:4590/blog/choosing-a-quiet-fan-with-physics/');
  const fig = await pg.$('.h3d'); await fig.scrollIntoViewIfNeeded();
  await pg.click('.h3d button:has-text("Two fans")');
  await pg.click('.h3d button:has-text("AC air")');
  for (let i = 0; i < 40; i++) { await pg.waitForTimeout(3000); const t = await pg.$eval('.h3d [data-o="clock"]', (e) => parseFloat(e.textContent)); if (t > 75) break; }
  console.log(await pg.$eval('.h3d [data-o="clock"]', (e) => e.textContent));
  await pg.addStyleTag({ content: '.h3d-hud{display:none!important}' }); await (await pg.$('.h3d-plan')).screenshot({ path: process.argv[2] });
  await b.close(); srv.close();
})();
