// Build-time search index, run from the astro:build:done hook.
//
// Reads the built HTML (so it sees exactly what visitors see: posts, pages and each scene of the home page),
// splits it into heading-sized passages, and writes:
//   dist/search/index.json   docs + passages for literal, BM25 and fuzzy matching in the browser
//   dist/search/vectors.bin  one int8 embedding per passage (384 dims) for semantic search
// Embeddings come from Snowflake/snowflake-arctic-embed-xs, the same model the browser loads to embed the
// query. They are cached in search-cache.json (committed), keyed by a hash of the passage, so a build only
// embeds new or changed text. If the model cannot load, the build still succeeds and those passages are
// simply lexical-only until the next build.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { cp } from 'node:fs/promises';

export const MODEL = 'Snowflake/snowflake-arctic-embed-xs';
export const DIMS = 384;
const CACHE = new URL('../search-cache.json', import.meta.url);
const MODEL_CACHE = fileURLToPath(new URL('../node_modules/.cache/transformers/', import.meta.url));
const ORT = fileURLToPath(new URL('../node_modules/onnxruntime-web/dist/', import.meta.url));
const SKIP = [/^\/404\//, /^\/author\//, /^\/tag\//, /^\/blog\/tag\//, /^\/rss\//, /^\/blog\/$/];

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ', mdash: '-', ndash: '-', hellip: '...', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', middot: '·', times: '×' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
  return ENT[e] ?? m;
});
const text = (html) => decode(html.replace(/<(script|style|svg|noscript|template)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<br\s*\/?>|<\/(p|li|h\d|div|tr|figcaption|blockquote|pre)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')).replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// split long text into ~700 character passages on sentence boundaries
function pieces(t, max = 700) {
  const out = []; let cur = '';
  for (const s of t.split(/(?<=[.!?])\s+|\n+/)) {
    if (cur && cur.length + s.length > max) { out.push(cur.trim()); cur = ''; }
    cur += s + ' ';
  }
  if (cur.trim().length > 20) out.push(cur.trim());
  return out;
}

async function htmlFiles(root) {
  const out = [];
  const walk = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const f = join(d, e.name);
      if (e.isDirectory()) { if (!['_astro', 'img', 'shots', 'bg', 'video', 'search', '_img'].includes(e.name)) await walk(f); }
      else if (e.name === 'index.html') out.push(f);
    }
  };
  await walk(root);
  return out;
}

export async function collect(root) {
  const docs = [], passages = [];
  for (const f of await htmlFiles(root)) {
    const url = '/' + relative(root, f).split(sep).slice(0, -1).join('/') + (f === join(root, 'index.html') ? '' : '/');
    const u = url.replace(/\/+/g, '/');
    if (SKIP.some((r) => r.test(u))) continue;
    const html = await readFile(f, 'utf8');
    if (/http-equiv="refresh"/i.test(html)) continue;
    const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] || u).replace(/\s*[|·]\s*Chris Dilger$/, '');
    const desc = decode(attr(html.match(/<meta name="description"[^>]*>/)?.[0] || '', 'content') || '');
    if (u === '/') {
      // the home page is a scroll story: index each scene as its own result, linked by its hash
      for (const m of html.matchAll(/<section class="scene"[^>]*data-scene="([^"]+)"[^>]*aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/section>/g)) {
        const [, id, label, body] = m;
        if (id === 'writing') continue; // just the list of every post title; the posts themselves are indexed
        const title = id === 'top' ? 'Chris Dilger: building with a fleet of agents' : decode(label);
        const t = text(body); if (t.length < 40) continue;
        const d = docs.push({ u: id === 'top' ? '/' : `/#${id}`, t: title, k: id === 'top' || id === 'contact' || id === 'story' ? 'page' : 'project', s: t.slice(0, 180) }) - 1;
        pieces(t).forEach((x) => passages.push({ d, h: '', a: '', x }));
      }
      continue;
    }
    const main = html.match(/<main[^>]*>([\s\S]*)<\/main>/)?.[1] || html;
    const isPost = u.startsWith('/blog/');
    const date = html.match(/<time[^>]*datetime="([^"]+)"/)?.[1]?.slice(0, 10) || '';
    const tags = [...main.matchAll(/href="[^"]*\/blog\/tag\/([^/"]+)\/"/g)].map((m) => m[1]);
    const d = docs.push({ u, t: title, k: isPost ? 'post' : 'page', s: desc, dt: date, tg: [...new Set(tags)].slice(0, 8) }) - 1;
    // split on h2/h3 so a match can link straight to its section
    const parts = main.split(/(?=<h[23][^>]*>)/i);
    for (const p of parts) {
      const hm = p.match(/^<h[23]([^>]*)>([\s\S]*?)<\/h[23]>/i);
      const h = hm ? text(hm[2]) : '';
      const a = hm ? attr(hm[1], 'id') || slug(hm[2]) : '';
      const t = text(hm ? p.slice(hm[0].length) : p);
      if (!t && !h) continue;
      const ps = pieces(t);
      if (!ps.length && h) ps.push(h);
      ps.forEach((x) => passages.push({ d, h, a, x }));
    }
    if (desc) passages.push({ d, h: '', a: '', x: desc });
  }
  return { docs, passages };
}

const key = (s) => createHash('sha1').update(MODEL + '\n' + s).digest('base64url').slice(0, 16);
const toEmbedText = (p, doc) => `${doc.t}${p.h ? ' — ' + p.h : ''}\n${p.x}`;

export async function buildSearch(root, log = console) {
  const t0 = Date.now();
  const { docs, passages } = await collect(root);
  let cache = {};
  try { cache = JSON.parse(await readFile(CACHE, 'utf8')); } catch {}
  const keys = passages.map((p) => key(toEmbedText(p, docs[p.d])));
  const missing = [...new Set(keys.filter((k) => !cache[k]))];
  // always load the model: besides embedding new passages, this makes sure its files are on disk to ship
  // with the site, so browsers never fetch it from a third party
  let embed = null;
  try {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir = MODEL_CACHE;
    embed = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
  } catch (e) { log.warn?.(`search: model unavailable (${e.message}); new passages stay lexical-only`); }
  if (missing.length && embed) {
    try {
      const todo = passages.map((p, i) => [keys[i], toEmbedText(p, docs[p.d])]).filter(([k]) => missing.includes(k));
      const seen = new Set();
      for (let i = 0; i < todo.length; i += 16) {
        const batch = todo.slice(i, i + 16).filter(([k]) => !seen.has(k) && seen.add(k));
        if (!batch.length) continue;
        const out = (await embed(batch.map(([, t]) => t), { pooling: 'cls', normalize: true })).tolist();
        batch.forEach(([k], j) => {
          const v = out[j], m = Math.max(...v.map(Math.abs)) || 1, s = m / 127;
          cache[k] = Buffer.from(Int8Array.from(v, (x) => Math.round(x / s)).buffer).toString('base64') + ':' + s.toPrecision(6);
        });
      }
    } catch (e) { log.warn?.(`search: embedding failed (${e.message}); passages stay lexical-only`); }
  }
  // keep the cache tidy: only passages that still exist
  const live = {}; keys.forEach((k) => { if (cache[k]) live[k] = cache[k]; });
  await writeFile(CACHE, JSON.stringify(live, null, 0).replace(/","/g, '",\n"'));
  // vectors.bin: N * DIMS int8, then N float32 scales (0 = no vector)
  const N = passages.length;
  const buf = Buffer.alloc(N * DIMS + N * 4);
  keys.forEach((k, i) => {
    const c = live[k]; if (!c) return;
    const [b64, s] = c.split(':');
    Buffer.from(b64, 'base64').copy(buf, i * DIMS);
    buf.writeFloatLE(+s, N * DIMS + i * 4);
  });
  const dir = join(root, 'search');
  if (!existsSync(dir)) await mkdir(dir);
  await writeFile(join(dir, 'vectors.bin'), buf);
  await writeFile(join(dir, 'index.json'), JSON.stringify({ model: MODEL, dims: DIMS, docs, passages }));
  // ship the model and the plain (CPU) ONNX WASM runtime with the site; both stay under Pages' 25 MiB per file
  const mdir = join(MODEL_CACHE, MODEL);
  if (existsSync(join(mdir, 'onnx', 'model_quantized.onnx'))) {
    await cp(mdir, join(root, 'models', MODEL), { recursive: true, filter: (f) => !/\/onnx\/(?!model_quantized\.onnx$)[^/]+$/.test(f) });
  }
  await mkdir(join(root, 'ort'), { recursive: true });
  for (const f of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) if (existsSync(join(ORT, f))) await cp(join(ORT, f), join(root, 'ort', f));
  log.info?.(`search: ${docs.length} docs, ${N} passages, ${missing.length} newly embedded, ${Date.now() - t0} ms`);
}
