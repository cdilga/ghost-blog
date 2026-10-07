import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

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
  integrations: [mdx()],
  markdown: { rehypePlugins: [rehypeBase] },
  build: { inlineStylesheets: 'auto' },
});
