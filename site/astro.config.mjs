import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Cloudflare Pages: turn every meta-refresh redirect page (old Ghost URLs, /rss/, author and tag pages) into
// a real 301 in _redirects, and keep the shared preview site out of search engines via _headers.
function cloudflarePages() {
  return {
    name: 'cloudflare-pages-files',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const root = fileURLToPath(dir);
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
          'https://preview.chris.dilger.me/*', '  X-Robots-Tag: noindex', '',
          '/_astro/*', '  Cache-Control: public, max-age=31536000, immutable', '',
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
