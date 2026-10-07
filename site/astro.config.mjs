import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { readdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimiseImages } from './scripts/optimise-images.mjs';
import { buildSearch } from './scripts/search-index.mjs';

// Cloudflare Pages: turn every meta-refresh redirect page (old Ghost URLs, /rss/, author and tag pages) into
// a real 301 in _redirects, and keep the shared preview site out of search engines via _headers.
function cloudflarePages() {
  return {
    name: 'cloudflare-pages-files',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const log = { info: (m) => logger.info(m), warn: (m) => logger.warn(m) };
        await optimiseImages(root, base.replace(/\/$/, ''), log);
        await buildSearch(root, log);
        // Vite copies onnxruntime's own WASM builds into _astro, but the search worker loads the smaller
        // self-hosted /ort copy, and the asyncify build is over Pages' 25 MiB file limit
        for (const f of await readdir(join(root, '_astro'))) if (/^ort-wasm.*\.wasm$/.test(f)) await rm(join(root, '_astro', f));
        // fail loudly here rather than at Cloudflare's upload step
        const big = [];
        const scan = async (d) => { for (const e of await readdir(d, { withFileTypes: true })) { const f = join(d, e.name); if (e.isDirectory()) await scan(f); else if ((await stat(f)).size > 25 * 1024 * 1024) big.push(relative(root, f)); } };
        await scan(root);
        if (big.length) throw new Error(`files over Cloudflare Pages' 25 MiB limit: ${big.join(', ')}`);
        const lines = ['/feed /rss.xml 301', '/feed/ /rss.xml 301', '/rss /rss.xml 301'];
        const walk = async (d) => {
          for (const e of await readdir(d, { withFileTypes: true })) {
            const f = join(d, e.name);
            if (e.isDirectory()) { if (e.name !== '_astro') await walk(f); continue; }
            if (e.name !== 'index.html') continue;
            const m = (await readFile(f, 'utf8')).match(/<meta http-equiv="refresh" content="0;\s*url=([^"]+)"/i);
            if (!m) continue;
            const from = '/' + relative(root, d).split(sep).join('/') + '/';
            lines.push(`${from.replace(/\/+/g, '/')} ${m[1]} 301`);
          }
        };
        await walk(root);
        await writeFile(join(root, '_redirects'), lines.join('\n') + '\n');
        await writeFile(join(root, '_headers'), [
          'https://chris-preview.dilger.me/*', '  X-Robots-Tag: noindex', '',
          '/_astro/*', '  Cache-Control: public, max-age=31536000, immutable', '',
          '/_img/*', '  Cache-Control: public, max-age=31536000, immutable', '',
          '/models/*', '  Cache-Control: public, max-age=2592000', '',
          '/ort/*', '  Cache-Control: public, max-age=2592000', '',
          '/search/*', '  Cache-Control: public, max-age=300', '',
        ].join('\n'));
      },
    },
  };
}

// GitHub Pages: CI sets SITE / BASE from actions/configure-pages. Defaults suit a custom domain at the root.
const base = process.env.BASE || '/';

// Markdown posts use root-relative links (/img/..., /blog/...). Prefix them with the base path so the
// site also works when served from a sub-path such as https://cdilga.github.io/ghost-blog/.
function rehypeBase() {
  const prefix = base.replace(/\/$/, '');
  const fix = (v) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') && !v.startsWith(prefix + '/') ? prefix + v : v);
  const walk = (node) => {
    if (node.properties) for (const k of ['href', 'src', 'poster']) if (node.properties[k]) node.properties[k] = fix(node.properties[k]);
    if (node.type === 'raw' && prefix) node.value = node.value.replace(/\b(src|href|poster)="(\/(?!\/)[^"]*)"/g, (m, a, v) => `${a}="${fix(v)}"`);
    node.children?.forEach(walk);
  };
  return (tree) => { if (prefix) walk(tree); };
}

export default defineConfig({
  site: process.env.SITE || 'https://chris.dilger.me',
  base,
  integrations: [mdx(), cloudflarePages()],
  markdown: { rehypePlugins: [rehypeBase] },
  build: { inlineStylesheets: 'auto' },
});
