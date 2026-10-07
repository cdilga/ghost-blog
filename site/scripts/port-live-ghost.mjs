// Port posts and pages from the live Ghost site into the Astro content collections by scraping HTML.
// No Content API key is needed: it reads the public sitemaps and each rendered page.
//
//   node scripts/port-live-ghost.mjs                 # all posts + pages
//   node scripts/port-live-ghost.mjs --only cv,hack  # just these slugs
//   node scripts/port-live-ghost.mjs --no-images     # leave image URLs pointing at the live site
//   node scripts/port-live-ghost.mjs --site https://example.com
//
// Output:
//   posts -> src/content/blog/<slug>.md   (legacy: true)
//   pages -> src/content/pages/<slug>.md  (rendered by src/pages/<slug>.astro)
//   media -> public/img/ghost/<slug>/<file>, referenced as /img/ghost/<slug>/<file>
// Re-running is safe: media already listed in scripts/ghost-media-manifest.json is not downloaded again.
import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
const SITE = (arg('--site') || 'https://chris.dilger.me').replace(/\/$/, '');
const ONLY = arg('--only')?.split(',').map((s) => s.trim()).filter(Boolean);
const NO_IMAGES = process.argv.includes('--no-images');
const PAGES = ['reading-list', 'cv', 'photography']; // contact is a redirect to /#contact, home is skipped
const MAX_BYTES = 400 * 1024;
const MAX_WIDTH = 1600;

const root = new URL('..', import.meta.url).pathname;
const postDir = path.join(root, 'src/content/blog');
const pageDir = path.join(root, 'src/content/pages');
const mediaRoot = path.join(root, 'public/img/ghost');
const stats = { posts: 0, pages: 0, media: 0, downloaded: 0, resized: 0, failed: [], warnings: [] };

async function get(url, as = 'text') {
  const r = await fetch(url, { headers: { 'user-agent': 'astro-port/1.0' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return as === 'text' ? r.text() : Buffer.from(await r.arrayBuffer());
}
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
const slugOf = (u) => new URL(u).pathname.replace(/^\/|\/$/g, '');

// ---------- media ----------
const isOwnMedia = (u) => { try { const x = new URL(u, SITE); return x.origin === new URL(SITE).origin && /^\/content\/(images|files|media)\//.test(x.pathname); } catch { return false; } };
const originalOf = (u) => u.replace(/\/content\/images\/size\/w\d+(h\d+)?\//, '/content/images/').replace(/\/content\/images\/format\/[a-z]+\//, '/content/images/');

// Returns { buf, ext }. Stills over MAX_BYTES are resized to MAX_WIDTH at quality 80 in their own format.
// Large animated GIFs are re-encoded at 720px as GIF or animated WebP, whichever is smaller.
async function shrink(buf, ext) {
  if (buf.length <= MAX_BYTES) return { buf, ext };
  if (ext === '.gif') {
    const w = { width: 720, withoutEnlargement: true };
    const gif = await sharp(buf, { animated: true }).resize(w).gif({ effort: 7, colours: 128 }).toBuffer();
    const webp = await sharp(buf, { animated: true }).resize(w).webp({ quality: 65, effort: 5 }).toBuffer();
    const best = webp.length < gif.length ? { buf: webp, ext: '.webp' } : { buf: gif, ext: '.gif' };
    if (best.buf.length < buf.length) { stats.resized++; return best; }
    return { buf, ext };
  }
  const fmt = { '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.webp': 'webp', '.avif': 'avif' }[ext];
  if (!fmt) return { buf, ext };
  const img = sharp(buf).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true });
  const out = await (fmt === 'png' ? img.png({ quality: 80, palette: true, compressionLevel: 9 }) : img[fmt]({ quality: 80 })).toBuffer();
  if (out.length < buf.length) { stats.resized++; return { buf: out, ext }; }
  return { buf, ext };
}

// source URL -> stored file name, per slug, so re-runs skip downloads (and know about GIF -> WebP renames)
const manifestFile = path.join(root, 'scripts/ghost-media-manifest.json');
const allManifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};

function makeLocaliser(slug) {
  const dir = path.join(mediaRoot, slug);
  const byUrl = new Map(); const used = new Set(); const hashes = new Map();
  const manifest = (allManifest[slug] ??= {});
  return async function localise(raw) {
    if (NO_IMAGES || !raw || !isOwnMedia(raw)) return raw;
    const abs = new URL(raw, SITE); abs.search = ''; abs.hash = '';
    const orig = originalOf(abs.href);
    if (byUrl.has(orig)) return byUrl.get(orig);
    let name = decodeURIComponent(path.basename(new URL(orig).pathname)).replace(/[^\w.-]+/g, '-');
    const srcExt = path.extname(name).toLowerCase();
    const stem = path.basename(name, path.extname(name));
    // a previous run may already have stored this source (possibly re-encoded); reuse it
    const prior = manifest[orig];
    if (prior && fs.existsSync(path.join(dir, prior))) { used.add(prior); byUrl.set(orig, `/img/ghost/${slug}/${prior}`); stats.media++; return byUrl.get(orig); }
    let buf;
    for (const u of [...new Set([orig, abs.href])]) { try { buf = await get(u, 'buf'); break; } catch {} }
    if (!buf) { stats.failed.push(`${slug}: ${abs.href}`); byUrl.set(orig, abs.href); return abs.href; }
    // the same bytes under another path (Ghost often stores the feature image twice): reuse that file
    const hash = createHash('sha1').update(buf).digest('hex');
    if (hashes.has(hash)) { const n = hashes.get(hash); manifest[orig] = n; byUrl.set(orig, `/img/ghost/${slug}/${n}`); stats.media++; return byUrl.get(orig); }
    let ext = srcExt;
    if (orig.includes('/content/images/')) ({ buf, ext } = await shrink(buf, srcExt));
    name = stem + ext;
    for (let i = 2; used.has(name); i++) name = `${stem}-${i}${ext}`;
    used.add(name); hashes.set(hash, name); manifest[orig] = name;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), buf);
    fs.writeFileSync(manifestFile, JSON.stringify(allManifest, null, 1) + '\n');
    stats.downloaded++;
    const local = `/img/ghost/${slug}/${name}`;
    stats.media++;
    byUrl.set(orig, local);
    return local;
  };
}

// one localiser per slug, so body images and the feature image share file names
const localisers = new Map();
const mediaFor = (slug) => { if (!localisers.has(slug)) localisers.set(slug, makeLocaliser(slug)); return localisers.get(slug); };

// ---------- links ----------
let postSlugs = new Set();
function rewriteHref(href) {
  if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return href;
  let u; try { u = new URL(href, SITE); } catch { return href; }
  if (u.searchParams.get('ref') === new URL(SITE).hostname) u.searchParams.delete('ref'); // Ghost outbound tracking
  if (u.origin === new URL(SITE).origin && !isOwnMedia(u.href)) {
    const s = u.pathname.replace(/^\/|\/$/g, '');
    if (postSlugs.has(s)) return `/blog/${s}/${u.hash}`;
    if (PAGES.includes(s)) return `/${s}/${u.hash}`;
    if (s === 'contact') return '/#contact';
    if (s === '') return `/${u.hash}`;
    return u.pathname + u.search + u.hash;
  }
  return u.href === href || u.href === href + '/' ? href : u.href;
}

// ---------- HTML clean-up (Ghost cards to plain or raw HTML) ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const oneLine = (s) => s.replace(/\s*\n\s*/g, ' ').trim();

async function clean(body, slug, document) {
  const localise = mediaFor(slug);
  body.querySelectorAll('script, style, noscript, .kg-file-card-icon').forEach((n) => n.remove());
  // Ghost's Lexical editor wraps every run of text in <span style="white-space: pre-wrap;">
  for (const sp of body.querySelectorAll('span')) if ([...sp.attributes].every((a) => a.name === 'style')) sp.replaceWith(...sp.childNodes);

  // Cloudflare email obfuscation: hex string, first byte is the XOR key
  const cfDecode = (hex) => { const k = parseInt(hex.slice(0, 2), 16); let o = ''; for (let i = 2; i < hex.length; i += 2) o += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k); return o; };
  for (const sp of body.querySelectorAll('[data-cfemail]')) sp.replaceWith(document.createTextNode(cfDecode(sp.getAttribute('data-cfemail'))));
  for (const a of body.querySelectorAll('a[href*="/cdn-cgi/l/email-protection#"]')) a.setAttribute('href', 'mailto:' + cfDecode(a.getAttribute('href').split('#')[1]));
  for (const a of body.querySelectorAll('a[href^="www."]')) a.setAttribute('href', 'https://' + a.getAttribute('href'));
  for (const a of body.querySelectorAll('a[href]')) {
    const h = a.getAttribute('href');
    a.setAttribute('href', isOwnMedia(h) ? await localise(h) : rewriteHref(h));
  }
  for (const img of body.querySelectorAll('img')) {
    const src = img.getAttribute('src');
    if (!src) { const p = img.parentElement; img.remove(); if (p && p.tagName === 'P' && !p.textContent.trim() && !p.children.length) p.remove(); continue; }
    const keep = { src: await localise(src), alt: img.getAttribute('alt') || '', title: img.getAttribute('title') };
    for (const at of [...img.attributes]) img.removeAttribute(at.name);
    img.setAttribute('src', keep.src); img.setAttribute('alt', keep.alt); if (keep.title) img.setAttribute('title', keep.title);
    img.setAttribute('loading', 'lazy');
  }
  for (const el of body.querySelectorAll('video[src], audio[src], source[src]')) el.setAttribute('src', await localise(el.getAttribute('src')));
  for (const el of body.querySelectorAll('video[poster]')) el.setAttribute('poster', await localise(el.getAttribute('poster')));

  const html = (s) => { const d = document.createElement('div'); d.innerHTML = s; const f = document.createDocumentFragment(); while (d.firstChild) f.appendChild(d.firstChild); return f; };
  const caption = (fig) => { const c = fig.querySelector('figcaption'); return c && c.textContent.trim() ? `<figcaption>${oneLine(c.innerHTML)}</figcaption>` : ''; };
  const imgHtml = (img) => { const a = img.closest('a'); const tag = `<img src="${esc(img.getAttribute('src'))}" alt="${esc(img.getAttribute('alt') || '')}" loading="lazy">`; return a ? `<a href="${esc(a.getAttribute('href'))}">${tag}</a>` : tag; };
  const swap = (el, s) => el.replaceWith(html(s));

  for (const fig of body.querySelectorAll('.kg-image-card')) {
    const img = fig.querySelector('img'); if (!img) { fig.remove(); continue; }
    const wide = fig.classList.contains('kg-width-wide') || fig.classList.contains('kg-width-full');
    swap(fig, `<figure class="ghost-figure${wide ? ' wide' : ''}">${imgHtml(img)}${caption(fig)}</figure>`);
  }
  for (const fig of body.querySelectorAll('.kg-gallery-card')) {
    const rows = [...fig.querySelectorAll('.kg-gallery-row')].map((r) => `<div class="gallery-row">${[...r.querySelectorAll('img')].map(imgHtml).join('')}</div>`);
    if (!rows.length) rows.push(`<div class="gallery-row">${[...fig.querySelectorAll('img')].map(imgHtml).join('')}</div>`);
    swap(fig, `<figure class="ghost-gallery wide">${rows.join('')}${caption(fig)}</figure>`);
  }
  for (const card of body.querySelectorAll('.kg-bookmark-card')) {
    const a = card.querySelector('a'); if (!a) { card.remove(); continue; }
    const title = card.querySelector('.kg-bookmark-title')?.textContent.trim() || a.getAttribute('href');
    const desc = card.querySelector('.kg-bookmark-description')?.textContent.trim();
    swap(card, `<p class="bookmark"><strong><a href="${esc(a.getAttribute('href'))}">${esc(title)}</a></strong>${desc ? `<br>${esc(desc)}` : ''}</p>`);
  }
  for (const card of body.querySelectorAll('.kg-code-card')) {
    const pre = card.querySelector('pre'); const c = card.querySelector('figcaption');
    card.replaceWith(pre); if (c && c.textContent.trim()) pre.after(html(`<p><em>${esc(c.textContent.trim())}</em></p>`));
  }
  for (const card of body.querySelectorAll('.kg-file-card')) {
    const a = card.querySelector('a'); if (!a) { card.remove(); continue; }
    const name = card.querySelector('.kg-file-card-filename')?.textContent.trim() || card.querySelector('.kg-file-card-title')?.textContent.trim() || 'Download';
    const size = card.querySelector('.kg-file-card-filesize')?.textContent.trim();
    const cap = card.querySelector('.kg-file-card-caption')?.textContent.trim();
    swap(card, `<p>Download: <a href="${esc(a.getAttribute('href'))}">${esc(name)}</a>${size ? ` (${esc(size)})` : ''}${cap ? `, ${esc(cap)}` : ''}</p>`);
  }
  for (const card of body.querySelectorAll('.kg-callout-card')) {
    const t = card.querySelector('.kg-callout-text'); swap(card, `<blockquote><p>${t ? t.innerHTML : card.textContent}</p></blockquote>`);
  }
  for (const card of body.querySelectorAll('.kg-button-card')) {
    const a = card.querySelector('a'); swap(card, a ? `<p><a href="${esc(a.getAttribute('href'))}">${esc(a.textContent.trim())}</a></p>` : '');
  }
  for (const card of body.querySelectorAll('.kg-video-card, .kg-audio-card')) {
    const m = card.querySelector('video, audio'); if (!m) { card.remove(); continue; }
    const tag = m.tagName.toLowerCase();
    swap(card, `<figure class="ghost-embed"><${tag} controls preload="metadata" src="${esc(m.getAttribute('src') || '')}"${m.getAttribute('poster') ? ` poster="${esc(m.getAttribute('poster'))}"` : ''}></${tag}>${caption(card)}</figure>`);
  }
  // embeds: Ghost embed cards and bare iframes from markdown/HTML cards
  for (const ifr of body.querySelectorAll('iframe')) {
    const src = ifr.getAttribute('src'); if (!src) { ifr.remove(); continue; }
    const fig = ifr.closest('.kg-embed-card');
    const h = (ifr.getAttribute('height') || '').replace(/px$/, '');
    const yt = /youtube(-nocookie)?\.com|vimeo\.com/.test(src);
    const attrs = [`src="${esc(src)}"`, `title="${esc(ifr.getAttribute('title') || (yt ? 'Embedded video' : 'Embedded content'))}"`, 'loading="lazy"', 'allowfullscreen'];
    if (ifr.getAttribute('allow')) attrs.push(`allow="${esc(ifr.getAttribute('allow'))}"`);
    if (!yt && /^\d+$/.test(h)) attrs.push(`height="${h}"`);
    const out = `<figure class="ghost-embed${yt ? ' video' : ''}"><iframe ${attrs.join(' ')}></iframe>${fig ? caption(fig) : ''}</figure>`;
    const target = fig || (ifr.parentElement?.tagName === 'P' && ifr.parentElement.textContent.trim() === '' ? ifr.parentElement : ifr);
    swap(target, out);
  }
  for (const card of body.querySelectorAll('.kg-embed-card')) swap(card, `<div>${card.innerHTML}</div>`);
  // drop empty links, Ghost heading ids are kept
  for (const a of body.querySelectorAll('a')) if (!a.textContent.trim() && !a.querySelector('img')) a.remove();
  return body.innerHTML.replace(/[\u200b\u200c\u200d\ufeff]/g, '');
}

// ---------- Markdown ----------
const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*' });
const baseEscape = td.escape.bind(td);
td.escape = (s) => baseEscape(s).replace(/</g, '&lt;');
td.addRule('raw-figure', { filter: (n) => n.nodeName === 'FIGURE', replacement: (c, n) => `\n\n${oneLine(n.outerHTML)}\n\n` });
td.addRule('fenced-lang', {
  filter: (n) => n.nodeName === 'PRE' && n.firstChild?.nodeName === 'CODE',
  replacement: (c, n) => {
    const code = n.firstChild; const cls = (code.getAttribute('class') || '') + ' ' + (n.getAttribute('class') || '');
    const lang = (cls.match(/(?:language|lang)-([\w+#-]+)/) || [])[1] || '';
    const text = code.textContent.replace(/\n$/, '');
    const fence = '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((m) => m[0].length + 1)));
    return `\n\n${fence}${lang}\n${text}\n${fence}\n\n`;
  },
});

// ---------- extraction ----------
function meta(document, key) {
  const el = document.querySelector(`meta[property="${key}"], meta[name="${key}"]`);
  return el?.getAttribute('content')?.trim() || '';
}
function ldJson(document) {
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) { try { return JSON.parse(s.textContent); } catch {} }
  return {};
}
const stripMd = (s) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*|`/g, '').replace(/[\u200b\u200c\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
function clip(s, n = 180) {
  s = stripMd(s); if (s.length <= n) return s;
  const cut = s.slice(0, n - 1); return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 30)).replace(/[\s,.;:]+$/, '') + '…';
}
const q = (s) => JSON.stringify(s ?? '');
// Ghost falls back to an auto excerpt (the first ~50 words of plain text, headings and list bullets
// run together). Keep a real custom excerpt; otherwise use the first proper paragraph.
function pickDescription(metaDesc, html, title) {
  const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const { document } = parseHTML(`<div>${html}</div>`);
  const text = document.querySelector('div').textContent;
  const isAuto = !metaDesc || norm(text).startsWith(norm(metaDesc.replace(/\[https?:[^\]]*\]/g, '')).slice(0, 40));
  if (metaDesc && !isAuto) return metaDesc;
  const para = [...document.querySelectorAll('p')].map((p) => p.textContent.trim()).find((t) => t.length >= 40);
  if (para) return para;
  return html.includes('<iframe') ? 'The full report, embedded as a PDF, with a link to download it.' : title;
}

async function port(url, kind) {
  const slug = slugOf(url);
  const { document } = parseHTML(await get(url));
  const ld = ldJson(document);
  const body = document.querySelector('.gh-content, .post-content, .post-full-content, .page-content') || document.querySelector('article');
  if (!body) { stats.warnings.push(`${slug}: no body found`); return; }
  const title = (document.querySelector('.post-title, .page-title, .article-title, h1')?.textContent || meta(document, 'og:title') || document.title).trim();
  const date = meta(document, 'article:published_time') || ld.datePublished || document.querySelector('time[datetime]')?.getAttribute('datetime');
  let tags = [...document.querySelectorAll('meta[property="article:tag"]')].map((m) => m.getAttribute('content').trim());
  if (!tags.length && ld.keywords) tags = String(ld.keywords).split(',').map((t) => t.trim()).filter(Boolean);
  const featureSrc = document.querySelector('.post-feature-image img, .page-feature-image img, .article-image img, .gh-feature-image img')?.getAttribute('src') || meta(document, 'og:image');

  const cleaned = await clean(body, slug, document);
  let md = td.turndown(cleaned).replace(/^[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  const description = clip(pickDescription(meta(document, 'description') || meta(document, 'og:description'), cleaned, title));
  const image = featureSrc && isOwnMedia(featureSrc) ? await mediaFor(slug)(featureSrc) : featureSrc || '';
  if (!md) stats.warnings.push(`${slug}: empty body`);

  const fm = ['---', `title: ${q(title)}`, `description: ${q(description)}`];
  if (kind === 'post') fm.push(`date: ${new Date(date || Date.now()).toISOString()}`, `tags: ${JSON.stringify(tags)}`);
  if (image) fm.push(`image: ${q(image)}`);
  if (kind === 'post') fm.push('legacy: true');
  fm.push(`source: ${q(url)}`, '---', '');
  const dir = kind === 'post' ? postDir : pageDir;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.md`), fm.join('\n') + '\n' + md + '\n');
  stats[kind === 'post' ? 'posts' : 'pages']++;
  console.log(`${kind} ${slug}${date ? ' ' + date.slice(0, 10) : ''} (${md.length} chars)`);
}

// ---------- main ----------
const postUrls = locs(await get(`${SITE}/sitemap-posts.xml`));
const pageUrls = locs(await get(`${SITE}/sitemap-pages.xml`)).filter((u) => PAGES.includes(slugOf(u)));
postSlugs = new Set(postUrls.map(slugOf));
for (const [list, kind] of [[postUrls, 'post'], [pageUrls, 'page']]) {
  for (const u of list) {
    if (ONLY && !ONLY.includes(slugOf(u))) continue;
    try { await port(u, kind); } catch (e) { stats.warnings.push(`${slugOf(u)}: ${e.message}`); console.error('FAILED', u, e.message); }
  }
}
console.log(`\n${stats.posts} posts, ${stats.pages} pages, ${stats.media} media refs (${stats.downloaded} downloaded, ${stats.resized} resized)`);
if (stats.failed.length) console.log('media failures:\n  ' + stats.failed.join('\n  '));
if (stats.warnings.length) console.log('warnings:\n  ' + stats.warnings.join('\n  '));
