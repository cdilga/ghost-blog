// Downloads images that posts and pages hotlink from other sites into public/img/<slug>/ and points the post at the
// local copy, so the site serves every image itself. Only the image URL changes; nothing else in the post is touched.
// A URL that fails to download is left as it is and reported (old Ghost-era hotlinks are sometimes long dead).
//
//   npm run localise-images        (the "Localise images" GitHub workflow runs it and commits the result)
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const dirs = ['src/content/blog', 'src/content/pages'];
const TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/avif': '.avif' };
// markdown ![alt](url "title") and <img src="url">
const PATTERNS = [/(!\[[^\]]*\]\()(https?:\/\/[^)\s]+)/g, /(<img\b[^>]*\bsrc=")(https?:\/\/[^"]+)/gi];

let changed = 0, failed = 0;
for (const dir of dirs) {
  for (const f of (await readdir(join(root, dir))).filter((f) => /\.mdx?$/.test(f))) {
    const file = join(root, dir, f), slug = f.replace(/\.mdx?$/, '');
    let text = await readFile(file, 'utf8');
    const urls = new Set(PATTERNS.flatMap((re) => [...text.matchAll(re)].map((m) => m[2])));
    for (const url of urls) {
      const clean = url.replace(/&amp;/g, '&').split('#')[0];
      try {
        const res = await fetch(clean, { redirect: 'follow' });
        const type = (res.headers.get('content-type') || '').split(';')[0].trim();
        if (!res.ok || !TYPES[type]) throw new Error(`${res.status} ${type || 'no type'}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const stem = basename(new URL(clean).pathname, extname(new URL(clean).pathname)).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'image';
        const name = `${stem}-${createHash('sha1').update(buf).digest('hex').slice(0, 8)}${TYPES[type]}`;
        await mkdir(join(root, 'public/img', slug), { recursive: true });
        await writeFile(join(root, 'public/img', slug, name), buf);
        const fragment = url.includes('#') ? url.slice(url.indexOf('#')) : ''; // keeps hints like #small
        text = text.split(url).join(`/img/${slug}/${name}${fragment}`);
        changed++;
        console.log('ok  ', `${dir}/${f}`, '->', `/img/${slug}/${name}`);
      } catch (e) { failed++; console.log('FAIL', `${dir}/${f}`, url.slice(0, 90), e.message); }
    }
    await writeFile(file, text);
  }
}
console.log(`${changed} localised, ${failed} left as they were`);
