// Captures desktop + phone screenshots of featured projects into public/shots.
// Usage: node harness/project-shots.mjs [name-filter]
// Desktop: 1440x900 @1.5x, phone: 390x844 @2x (isMobile, hasTouch).
// Output is JPEG, resized to max 1600px wide and squeezed under ~250 KB with sharp.
// The house twin is private (behind a sign-in) and is never captured or linked from the site.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const out = new URL('../public/shots/', import.meta.url).pathname;
const filter = process.argv[2] || '';
const MAX_BYTES = 250 * 1024;

const D = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 };
const M = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const PS = 'https://ps-r-round22-e94fc8fe.dilger.dev/'; // latest playable build from https://ps-r-index-e94fc8fe.dilger.dev/
const JP = 'https://jammers-preview.dilger.dev/poc/';

// Physical Soccer: host a test room, use "this screen" with 2 touch buttons, pick a mode.
async function psRoom(page) {
  await page.waitForTimeout(1500);
  await page.click('text=Host on this screen');
  await page.waitForTimeout(2500);
  await page.click('text=Create test room');
  await page.waitForTimeout(5000);
  await page.click('button:has-text("Skip")').catch(() => {});
  await page.click('button:has-text("2 buttons")');
  await page.waitForTimeout(1000);
}
async function psMatch(page, mode) {
  await psRoom(page);
  await page.click(`button:has-text("${mode}")`);
  await page.waitForTimeout(500);
  await page.click('text=Play in a window');
  await page.waitForTimeout(5000);
  await page.click('text=Start anyway');
  await page.waitForTimeout(4500); // countdown, GO!
  // Left and right halves of the lower pitch are the two players' buttons.
  for (let i = 0; i < 9; i++) {
    await page.mouse.move(i % 2 ? 1100 : 350, 700);
    await page.mouse.down();
    await page.waitForTimeout(350 + (i % 3) * 200);
    await page.mouse.up();
    await page.waitForTimeout(250);
  }
}

const jobs = [
  // Physical Soccer
  { name: 'physicalsoccer-d', url: PS, ctx: D, steps: p => psMatch(p, 'Pure') },
  { name: 'physicalsoccer-game-d', url: PS, ctx: D, steps: p => psMatch(p, 'Forklift Football') },
  { name: 'physicalsoccer-lobby-d', url: PS, ctx: D, steps: psRoom },
  { name: 'physicalsoccer-m', url: PS + 'controller', ctx: M, wait: 4000 },

  // Joystick Jammers: the new direction (POC) is primary
  { name: 'jammers-d', url: JP + 'world/#tv', ctx: D, wait: 9000 },
  { name: 'jammers-m', url: JP + 'world/#tv', ctx: M, wait: 9000 },
  { name: 'jammers-poc-d', url: JP + 'tv/#grid&n=8', ctx: D, wait: 9000 },
  { name: 'jammers-poc-m', url: JP + 'phone/', ctx: M, wait: 4000 },
  { name: 'jammers-closeup-d', url: JP + 'world/#closeup', ctx: D, wait: 9000 },
  { name: 'jammers-lobby-d', url: JP + 'tv/#lobby&n=8', ctx: D, wait: 9000 },
  { name: 'jammers-live-d', url: 'https://jammers.dilger.dev/', ctx: D, wait: 5000 },

  // Dilger Books: books.dilger.au is still "coming soon", so the storefront shots use test.books
  { name: 'books-d', url: 'https://test.books.dilger.au/', ctx: D, wait: 3000 },
  { name: 'books-m', url: 'https://test.books.dilger.au/', ctx: M, wait: 3000 },
  { name: 'books-detail-d', url: 'https://test.books.dilger.au/', ctx: D, wait: 2000, steps: async p => {
    await p.locator('#peek').scrollIntoViewIfNeeded();
    await p.evaluate(() => document.querySelector('#peek').scrollIntoView({ block: 'start' }));
    await p.click('button:has-text("A · Air Tractor")').catch(() => {});
    await p.waitForTimeout(1500);
  } },
  { name: 'books-soon-d', url: 'https://books.dilger.au/', ctx: D, wait: 2000 },

  // Dishmate: only live deployment is the GitHub Pages demo (dishmate.app is a parked page)
  { name: 'dishmate-d', url: 'https://cdilga.github.io/dishmate/', ctx: D, wait: 2000, steps: async p => {
    await p.click('button:has-text("Load Advisor")');
    await p.waitForTimeout(800);
  } },
  { name: 'dishmate-m', url: 'https://cdilga.github.io/dishmate/', ctx: M, wait: 2000 },
];

async function save(buf, file) {
  let img = sharp(buf);
  const { width } = await img.metadata();
  let q = 80, data;
  do {
    img = sharp(buf);
    if (width > 1600) img = img.resize({ width: 1600 });
    data = await img.jpeg({ quality: q, mozjpeg: true }).toBuffer();
    q -= 6;
  } while (data.length > MAX_BYTES && q > 40);
  fs.writeFileSync(file, data);
  return data.length;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const job of jobs.filter(j => j.name.includes(filter))) {
  const ctx = await browser.newContext(job.ctx);
  const page = await ctx.newPage();
  try {
    await page.goto(job.url, { waitUntil: 'load', timeout: 30000 });
    if (job.wait) await page.waitForTimeout(job.wait);
    if (job.steps) await job.steps(page);
    const buf = await page.screenshot({ type: 'png', timeout: 120000 });
    const bytes = await save(buf, path.join(out, `${job.name}.jpg`));
    console.log('ok', job.name, Math.round(bytes / 1024) + 'KB', await page.title());
  } catch (e) { console.log('fail', job.name, e.message.split('\n')[0]); }
  await ctx.close();
}
await browser.close();
