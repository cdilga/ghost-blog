// Port posts from a Ghost JSON export (Admin > Settings > Labs > Export) into src/content/blog.
//   node scripts/import-ghost.mjs path/to/export.json [--drafts]
// Images are left pointing at their original URLs; run with --download-images to copy them into public/img/ghost.
import fs from 'node:fs';
import path from 'node:path';
import TurndownService from 'turndown';

const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!file) { console.error('usage: node scripts/import-ghost.mjs export.json [--drafts] [--download-images]'); process.exit(1); }
const drafts = process.argv.includes('--drafts');
const dl = process.argv.includes('--download-images');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const db = data.db?.[0]?.data ?? data.data;
const tagsByPost = new Map();
for (const pt of db.posts_tags ?? []) {
  const tag = db.tags.find((t) => t.id === pt.tag_id)?.name;
  if (tag) tagsByPost.set(pt.post_id, [...(tagsByPost.get(pt.post_id) ?? []), tag]);
}
const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
td.addRule('kg-bookmark', { filter: (n) => n.classList?.contains('kg-bookmark-card'), replacement: (c, n) => { const a = n.querySelector('a'); return a ? `\n\n[${n.querySelector('.kg-bookmark-title')?.textContent ?? a.href}](${a.href})\n\n` : ''; } });
const outDir = new URL('../src/content/blog/', import.meta.url).pathname;
const imgDir = new URL('../public/img/ghost/', import.meta.url).pathname;
let n = 0;
for (const p of db.posts.filter((p) => p.type === 'post' && (drafts || p.status === 'published'))) {
  let html = p.html ?? '';
  if (dl) {
    for (const m of new Set([...html.matchAll(/(?:https?:\/\/[^"')\s]+|__GHOST_URL__)\/content\/images\/[^"')\s]+/g)].map((x) => x[0]))) {
      const url = m.replace('__GHOST_URL__', 'https://chris.dilger.me');
      const name = path.basename(new URL(url).pathname);
      try { const r = await fetch(url); fs.mkdirSync(imgDir, { recursive: true }); fs.writeFileSync(path.join(imgDir, name), Buffer.from(await r.arrayBuffer())); html = html.split(m).join(`/img/ghost/${name}`); } catch { console.warn('image failed', url); }
    }
  }
  const md = td.turndown(html.replaceAll('__GHOST_URL__', 'https://chris.dilger.me'));
  const q = (s) => JSON.stringify(s ?? '');
  const fm = `---\ntitle: ${q(p.title)}\ndescription: ${q((p.custom_excerpt || p.plaintext || '').replace(/\s+/g, ' ').slice(0, 180))}\ndate: ${new Date(p.published_at ?? p.created_at).toISOString()}\ntags: ${JSON.stringify(tagsByPost.get(p.id) ?? [])}\ndraft: ${p.status !== 'published'}\n---\n\n`;
  fs.writeFileSync(path.join(outDir, `${p.slug}.md`), fm + md + '\n');
  n++;
}
console.log(`imported ${n} posts into src/content/blog`);
