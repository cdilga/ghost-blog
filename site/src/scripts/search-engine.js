// Lexical side of site search: three ranked lists fused with Reciprocal Rank Fusion.
//
//   exact    BM25 (k1 1.2, b 0.75) over the query terms, BM25F-style field weights (title 3, heading 2,
//            text 1), the word being typed expanded by prefix, and a boost for passages holding the whole
//            phrase literally
//   typos    each term expanded through a Damerau-Levenshtein BK-tree (edit budget 1/2/3 for terms of up to
//            4/7/more characters, 24 candidates) plus trigram-Jaccard > 0.45 for terms of 5+ characters
//            (12 more); BM25 over the expansions, weighted 1/(1+distance) or 0.8 x Jaccard
//   meaning  passage ids from the embedding worker, merged in when they arrive
//
// Fusion is per document: each list is collapsed to documents (best passage first), then scored
// sum 1/(60 + rank) over the top 60 of each list. Every hit remembers where it ranked in each list.
// Everything is in memory and synchronous; a query over this site takes well under a millisecond.

const K1 = 1.2, B = 0.75, RRF_K = 60, TOP = 60;
const FIELD = { t: 3, h: 2, x: 1, g: 2 };
const STOP = new Set('a an and are as at be by for from has have how i in is it of on or that the this to was what when where which who why with you your'.split(' '));

// same as norm, but never changes the length (so match offsets map straight back onto the original text)
const normSame = (s) => [...s].map((c) => { const d = c.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); return (d.length === c.length ? d : c).toLowerCase(); }).join('');
export const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
// light, symmetric stemming: enough to make "fans" find "fan" without mangling technical words
const stem = (w) => (w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') ? w.slice(0, -1) : w);
export const words = (s) => norm(s).match(/[a-z0-9]+(?:[.'][a-z0-9]+)*/g) || [];
const terms = (s) => words(s).map(stem);

// optimal string alignment distance (Damerau-Levenshtein with adjacent transpositions), with an early exit.
// Three reused rows, so the inner loop never allocates.
const R0 = new Int32Array(66), R1 = new Int32Array(66), R2 = new Int32Array(66);
function osa(a, b, max) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > max) return max + 1;
  if (n > 64 || m > 64) return max + 1;
  let p2 = R0, p1 = R1, cur = R2;
  for (let j = 0; j <= n; j++) p1[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i; let rowMin = i;
    const ai = a.charCodeAt(i - 1), ap = i > 1 ? a.charCodeAt(i - 2) : -1;
    for (let j = 1; j <= n; j++) {
      const bj = b.charCodeAt(j - 1);
      let v = p1[j - 1] + (ai === bj ? 0 : 1);
      const del = p1[j] + 1, ins = cur[j - 1] + 1;
      if (del < v) v = del; if (ins < v) v = ins;
      if (j > 1 && ai === b.charCodeAt(j - 2) && ap === bj && p2[j - 2] + 1 < v) v = p2[j - 2] + 1;
      cur[j] = v; if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    const t = p2; p2 = p1; p1 = cur; cur = t;
  }
  return p1[n];
}

class BKTree {
  constructor() { this.root = null; }
  add(w) {
    if (!this.root) { this.root = [w, new Map()]; return; }
    let node = this.root;
    for (;;) {
      const d = osa(w, node[0], 64); if (d === 0) return;
      const child = node[1].get(d);
      if (!child) { node[1].set(d, [w, new Map()]); return; }
      node = child;
    }
  }
  find(w, max, limit) {
    const out = [], stack = this.root ? [this.root] : [];
    while (stack.length) {
      const [word, kids] = stack.pop();
      const d = osa(w, word, max);
      if (d <= max) out.push([word, d]);
      for (const [k, c] of kids) if (k >= d - max && k <= d + max) stack.push(c);
    }
    return out.sort((a, b) => a[1] - b[1]).slice(0, limit);
  }
}
const tri = (w) => { const s = ` ${w} `, o = new Set(); for (let i = 0; i < s.length - 2; i++) o.add(s.slice(i, i + 3)); return o; };

export function buildEngine(data) {
  const { docs, passages } = data;
  const post = new Map();            // term -> [[passage, weighted tf], ...]
  const lens = new Float32Array(passages.length);
  const flat = new Array(passages.length);
  const N = passages.length;
  let indexed = 0, total = 0, avg = 1, vocab = [], sorted = [];
  // posting lists, built a slice of passages at a time (see warm)
  const indexSome = (n) => {
    const end = Math.min(N, indexed + n);
    for (; indexed < end; indexed++) {
      const i = indexed, p = passages[i], doc = docs[p.d], tf = new Map();
      flat[i] = norm(`${doc.t} ${p.h} ${p.x}`);
      const add = (s, w) => { for (const t of terms(s)) { tf.set(t, (tf.get(t) || 0) + w); lens[i] += w; } };
      add(doc.t, FIELD.t); add(p.h, FIELD.h); add(p.x, FIELD.x); add((doc.tg || []).join(' '), FIELD.g);
      total += lens[i];
      for (const [t, f] of tf) { let l = post.get(t); if (!l) post.set(t, (l = [])); l.push([i, f]); }
    }
    if (indexed === N && !vocab.length) { avg = total / N; vocab = [...post.keys()]; sorted = [...vocab].sort(); }
  };
  // the typo tree is filled in idle slices (see warm); a partly built BK-tree is still a valid one
  const bk = new BKTree(); let filled = 0;
  const fill = (n) => { const end = Math.min(vocab.length, filled + n); for (; filled < end; filled++) bk.add(vocab[filled]); return filled >= vocab.length; };
  // trigram index for the Jaccard half of typo matching, also filled in idle slices
  const triIdx = new Map(), triCount = new Map(); let trid = 0;
  const fillTri = (n) => { const end = Math.min(vocab.length, trid + n); for (; trid < end; trid++) { const w = vocab[trid]; if (w.length < 4) continue; const g = tri(w); triCount.set(w, g.size); for (const t of g) { let l = triIdx.get(t); if (!l) triIdx.set(t, (l = [])); l.push(w); } } };
  const idf = (t) => { const df = post.get(t)?.length || 0; return Math.log(1 + (N - df + 0.5) / (df + 0.5)); };

  function bm25(weighted) {          // weighted: Map term -> query weight
    const score = new Map();
    for (const [t, qw] of weighted) {
      const l = post.get(t); if (!l) continue; const w = idf(t) * qw;
      for (const [i, f] of l) score.set(i, (score.get(i) || 0) + w * (f * (K1 + 1)) / (f + K1 * (1 - B + B * lens[i] / avg)));
    }
    return score;
  }
  function prefix(p, limit = 12) {   // binary search into the sorted vocabulary
    let lo = 0, hi = sorted.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < p) lo = m + 1; else hi = m; }
    const out = []; for (let i = lo; i < sorted.length && sorted[i].startsWith(p) && out.length < limit; i++) if (sorted[i] !== p) out.push(sorted[i]);
    return out;
  }
  const memo = new Map();
  function expand(t) {
    const hit = memo.get(t); if (hit) return hit;
    const out = expandRaw(t);
    memo.set(t, out); if (memo.size > 500) memo.delete(memo.keys().next().value);
    return out;
  }
  function expandRaw(t) {
    const budget = t.length <= 4 ? 1 : t.length <= 7 ? 2 : 3;
    const out = new Map();
    for (const [w, d] of bk.find(t, budget, 24)) out.set(w, 1 / (1 + d));
    if (t.length >= 5) {
      const g = tri(t), hits = new Map();
      for (const x of g) for (const w of triIdx.get(x) || []) hits.set(w, (hits.get(w) || 0) + 1);
      [...hits].filter(([w]) => triCount.has(w)).map(([w, c]) => [w, c / (g.size + triCount.get(w) - c)]).filter(([, j]) => j > 0.45)
        .sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([w, j]) => { if (!out.has(w)) out.set(w, 0.8 * j); });
    }
    return out;
  }
  const ranked = (score) => [...score].sort((a, b) => b[1] - a[1]).map(([i]) => i);
  // collapse a passage ranking to a document ranking, keeping each document's best passage
  function byDoc(list) {
    const seen = new Map();
    for (const i of list) { const d = passages[i].d; if (!seen.has(d)) seen.set(d, i); if (seen.size >= TOP) break; }
    return [...seen];
  }

  return {
    docs, passages,
    // keep adding words while the idle deadline allows; true once the typo index is complete
    warm(timeLeft = () => 1) {
      while (indexed < N && timeLeft() > 2) indexSome(40);
      while (indexed >= N && trid < vocab.length && timeLeft() > 2) fillTri(400);
      while (trid >= vocab.length && filled < vocab.length && timeLeft() > 2) fill(200);
      return indexed >= N && filled >= vocab.length;
    },
    warmAll() { indexSome(Infinity); fillTri(Infinity); fill(Infinity); },
    lexical(query) {
      if (indexed < N) indexSome(Infinity); // someone searched before the idle indexing finished
      const q = norm(query.trim());
      const qt = terms(q).filter((t, i, a) => a.length === 1 || !STOP.has(t));
      if (!qt.length) return { exact: [], typos: [], qt: [], marks: [] };
      const typing = !/\s$/.test(query);
      // exact: the terms, the word being typed by prefix, and literal phrase hits
      const ew = new Map(qt.map((t) => [t, 1]));
      const last = qt[qt.length - 1];
      if (typing && last.length >= 2) for (const w of prefix(last)) if (!ew.has(w)) ew.set(w, 0.85);
      const es = bm25(ew);
      if (q.length >= 4) flat.forEach((f, i) => { if (f.includes(q)) es.set(i, (es.get(i) || 0) * 1.6 + 2); });
      // typos
      const tw = new Map();
      for (const t of qt) for (const [w, wt] of expand(t)) tw.set(w, Math.max(tw.get(w) || 0, wt));
      const ts = bm25(tw);
      const marks = [...new Set([...ew.keys(), ...tw.keys()])];
      return { exact: byDoc(ranked(es)), typos: byDoc(ranked(ts)), qt, marks };
    },
    // lists: { exact, typos, meaning } as [[doc, passage], ...]; mode: 'fused' or a list name.
    // Weighted RRF: the typo list mostly repeats the exact one, so it counts for less, and for
    // natural-language queries (3+ words) meaning counts for more.
    fuse(lists, mode = 'fused', scope = 'all', limit = 40, nTerms = 1) {
      const use = mode === 'fused' ? Object.keys(lists) : [mode];
      const W = { exact: 1, typos: 0.6, meaning: nTerms >= 3 ? 1.5 : 1 };
      const acc = new Map();
      for (const name of use) (lists[name] || []).slice(0, TOP).forEach(([d, p], r) => {
        let e = acc.get(d); if (!e) acc.set(d, (e = { d, score: 0, via: {}, p, best: Infinity }));
        e.score += (W[name] ?? 1) / (RRF_K + r + 1); e.via[name] = r + 1;
        if (r < e.best) { e.best = r; e.p = p; }
      });
      return [...acc.values()].filter((e) => scope === 'all' || docs[e.d].k === scope)
        .sort((a, b) => b.score - a.score).slice(0, limit);
    },
    meaningToDocs(hits) { return byDoc(hits.map(([i]) => i)); },
    // best 300-character window (stepping by 60) holding the most query words, as HTML with <mark>s
    snippet(i, marks, size = 300) {
      const x = passages[i].x;
      const re = marks.length ? new RegExp(`\\b(${marks.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|')})[a-z0-9]*`, 'gi') : null;
      let best = 0, bestN = -1;
      if (re && x.length > size) for (let s = 0; s < x.length - size + 60; s += 60) {
        const n = new Set((norm(x.slice(s, s + size)).match(re) || []).map((m) => m.toLowerCase())).size;
        if (n > bestN) { bestN = n; best = s; }
      }
      let w = x.slice(best, best + size);
      if (best > 0) w = '…' + w.replace(/^\S*\s/, '');
      if (best + size < x.length) w = w.replace(/\s\S*$/, '') + '…';
      const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      if (!re) return esc(w);
      // match on a normalised copy, so accented text still highlights, then map back by position
      const nw = normSame(w); let out = '', last = 0;
      for (const m of nw.matchAll(re)) { out += esc(w.slice(last, m.index)) + '<mark>' + esc(w.slice(m.index, m.index + m[0].length)) + '</mark>'; last = m.index + m[0].length; }
      return out + esc(w.slice(last));
    },
  };
}
