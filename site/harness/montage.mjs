// node harness/montage.mjs <device> [cols] -> harness/out/<device>-sheet.jpg
import sharp from 'sharp'; import fs from 'node:fs'; import path from 'node:path';
const dev = process.argv[2], cols = +(process.argv[3] || 6), every = +(process.argv[4] || 1);
const dir = path.join(new URL('.', import.meta.url).pathname, 'out', dev);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort().filter((_, i) => i % every === 0);
const m0 = await sharp(path.join(dir, files[0])).metadata();
const tw = 300, th = Math.round((300 * m0.height) / m0.width), rows = Math.ceil(files.length / cols);
const comps = await Promise.all(files.map(async (f, i) => ({ input: await sharp(path.join(dir, f)).resize(tw, th).toBuffer(), left: (i % cols) * (tw + 4), top: Math.floor(i / cols) * (th + 4) })));
await sharp({ create: { width: cols * (tw + 4), height: rows * (th + 4), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 80 }).toFile(path.join(dir, '..', `${dev}-sheet.jpg`));
