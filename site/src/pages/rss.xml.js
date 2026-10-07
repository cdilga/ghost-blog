import { getCollection } from 'astro:content';
export async function GET(ctx) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const abs = (p) => new URL(`${base}${p}`, ctx.site).href;
  const posts = (await getCollection('blog', (p) => !p.data.draft)).sort((a, b) => +b.data.date - +a.data.date);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const items = posts.map((p) => {
    const link = abs(`/blog/${p.id}/`);
    const cats = p.data.tags.map((t) => `<category>${esc(t)}</category>`).join('');
    return `<item><title>${esc(p.data.title)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><pubDate>${p.data.date.toUTCString()}</pubDate><description>${esc(p.data.description)}</description>${cats}</item>`;
  }).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Chris Dilger</title><link>${abs('/')}</link><description>Writing</description><language>en-au</language>${items}</channel></rss>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
