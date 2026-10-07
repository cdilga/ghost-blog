import { getCollection } from 'astro:content';
export async function GET(ctx) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const posts = (await getCollection('blog', (p) => !p.data.draft)).sort((a, b) => +b.data.date - +a.data.date);
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const items = posts.map((p) => `<item><title>${esc(p.data.title)}</title><link>${ctx.site}${base.slice(1)}/blog/${p.id}/</link><pubDate>${p.data.date.toUTCString()}</pubDate><description>${esc(p.data.description)}</description></item>`).join('');
  return new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Chris Dilger</title><link>${ctx.site}</link><description>Writing</description>${items}</channel></rss>`, { headers: { 'Content-Type': 'application/xml' } });
}
