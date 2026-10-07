// Build-time image optimisation, run from the astro:build:done hook.
//
// For every <img> in the built HTML that points at a local JPEG, PNG or WebP (posts, covers, screenshots,
// anything uploaded later), it:
//   - makes WebP copies at the useful widths (never upscaled) under /_img/, named by content hash so they can
//     be cached forever
//   - rewrites the tag with srcset + sizes so each screen downloads the right size, width/height so the page
//     does not jump while images load, and lazy loading and async decoding unless the page said otherwise
// Encoded files are cached in node_modules/.cache/img-opt, so rebuilds only encode new or changed images.
// Originals stay where they were, for feeds and anything that links to them directly.
import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const WIDTHS = [400, 800, 1200, 1600, 2400];
const DEFAULT_SIZES = '(max-width: 720px) 100vw, 680px'; // post column width; lazy images also send sizes=auto
const CACHE = fileURLToPath(new URL('../node_modules/.cache/img-opt/', import.meta.url));

async function htmlFiles(root) {
  const out = [];
  const walk = async (d) => { for (const e of await readdir(d, { withFileTypes: true })) { const f = join(d, e.name); if (e.isDirectory()) { if (e.name !== '_astro' && e.name !== '_img') await walk(f); } else if (e.name.endsWith('.html')) out.push(f); } };
  await walk(root);
  return out;
}

export async function optimiseImages(root, base = '', log = console) {
  const t0 = Date.now();
  const sharp = (await import('sharp')).default;
  const outDir = join(root, '_img');
  await mkdir(outDir, { recursive: true }); await mkdir(CACHE, { recursive: true });
  const variants = new Map(); // src -> { srcset, src, w, h } | null
  let encoded = 0, reused = 0;

  async function variantsFor(src) {
    if (variants.has(src)) return variants.get(src);
    let v = null;
    const rel = decodeURIComponent(src.slice(base.length).split(/[?#]/)[0]);
    const file = join(root, rel);
    if (/\.(jpe?g|png|webp)$/i.test(rel) && existsSync(file)) {
      try {
        const buf = await readFile(file);
        const hash = createHash('sha1').update(buf).digest('hex').slice(0, 10);
        const meta = await sharp(buf).metadata();
        const W = meta.width, H = meta.height;
        if (W && H) {
          const widths = WIDTHS.filter((w) => w < W * 0.92); widths.push(Math.min(W, 2400));
          const set = [];
          for (const w of [...new Set(widths)]) {
            const name = `${hash}-${w}.webp`, cached = join(CACHE, name);
            if (existsSync(cached)) reused++;
            else { await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: w <= 800 ? 78 : 74, effort: 4 }).toFile(cached); encoded++; }
            await copyFile(cached, join(outDir, name));
            set.push([`${base}/_img/${name}`, w]);
          }
          const fallback = set.filter(([, w]) => w <= 1600).pop() || set[0];
          v = { srcset: set.map(([u, w]) => `${u} ${w}w`).join(', '), src: fallback[0], w: W, h: H };
        }
      } catch (e) { log.warn?.(`images: skipped ${rel} (${e.message})`); }
    }
    variants.set(src, v);
    return v;
  }

  let tags = 0;
  for (const f of await htmlFiles(root)) {
    const html = await readFile(f, 'utf8');
    const imgs = [...html.matchAll(/<img\b[^>]*>/gi)];
    if (!imgs.length) continue;
    let out = '', last = 0, changed = false;
    for (const m of imgs) {
      const tag = m[0];
      const src = tag.match(/\ssrc="([^"]+)"/)?.[1];
      if (!src || !src.startsWith(base + '/') || src.startsWith('//') || /\ssrcset=/.test(tag) || /data-no-opt/.test(tag)) continue;
      const v = await variantsFor(src);
      if (!v) continue;
      let t = tag.replace(/\ssrc="[^"]+"/, ` src="${v.src}" srcset="${v.srcset}"`);
      const lazy = !/\sloading=/.test(t) || /\sloading="lazy"/.test(t);
      if (!/\sloading=/.test(t)) t = t.replace(/<img\b/i, '<img loading="lazy"');
      if (!/\ssizes=/.test(t)) t = t.replace(/<img\b/i, `<img sizes="${lazy ? 'auto, ' : ''}${DEFAULT_SIZES}"`);
      if (!/\sdecoding=/.test(t)) t = t.replace(/<img\b/i, '<img decoding="async"');
      if (!/\swidth=/.test(t) && !/\sheight=/.test(t)) t = t.replace(/<img\b/i, `<img width="${v.w}" height="${v.h}"`);
      out += html.slice(last, m.index) + t; last = m.index + tag.length; changed = true; tags++;
    }
    if (changed) await writeFile(f, out + html.slice(last));
  }
  const n = [...variants.values()].filter(Boolean).length;
  log.info?.(`images: ${n} images, ${tags} tags rewritten, ${encoded} encoded, ${reused} from cache, ${Date.now() - t0} ms`);
}
