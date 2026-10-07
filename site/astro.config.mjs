import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// GitHub Pages: set SITE / BASE in CI. Defaults suit a custom domain at the root.
export default defineConfig({
  site: process.env.SITE || 'https://chris.dilger.me',
  base: process.env.BASE || '/',
  integrations: [mdx()],
  build: { inlineStylesheets: 'auto' },
});
