// Captures desktop + phone screenshots of featured projects into public/shots
import { chromium } from 'playwright';
import path from 'node:path';
const out = new URL('../public/shots/', import.meta.url).pathname;
const targets = [
  ['physicalsoccer', 'https://ps-r-index-e94fc8fe.dilger.dev/'],
  ['jammers', 'https://jammers.dilger.dev/'],
  ['jammers-poc', 'https://jammers-preview.dilger.dev/poc/'],
  ['books', 'https://books.dilger.au/'],
  ['books-test', 'https://test.books.dilger.au/'],
  ['home', 'https://home.dilger.dev/'],
  ['dishmate', 'https://dishmate.app/'],
];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [name, url] of targets) {
  for (const [tag, vp, mobile] of [['d', { width: 1440, height: 900 }, false], ['m', { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1.5, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(out, `${name}-${tag}.jpg`), type: 'jpeg', quality: 82 });
      console.log('ok', name, tag, await page.title());
    } catch (e) { console.log('fail', name, tag, e.message.split('\n')[0]); }
    await ctx.close();
  }
}
await browser.close();
