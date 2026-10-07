// Render an SVG cover to JPG with the site's web fonts: node render.cjs in.svg out.jpg [w h]
const { chromium } = require('../../node_modules/playwright'); const fs = require('fs'), path = require('path');
const [, , inp, out, w = 1600, h = 900] = process.argv;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: +w, height: +h } });
  await pg.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono:wght@400;500&display=block" rel="stylesheet"><style>html,body{margin:0;background:#0e1926}svg{display:block;width:100vw;height:100vh}</style></head><body>${fs.readFileSync(inp, 'utf8')}</body></html>`, { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: out, type: 'jpeg', quality: 86 });
  await b.close();
})();
