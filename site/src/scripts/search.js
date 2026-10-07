// Site search: press "/" (or Ctrl/Cmd+K, or the search button) anywhere.
//
// Loading is silent and staged, so search is instant whenever you open it:
//   1. after first paint, when the browser is idle: the index (~100 KB compressed) and passage vectors
//      arrive and the lexical engine is built (exact BM25 + typo-tolerant lists work from here)
//   2. right after that, the embedding model starts loading in a worker at low priority (skipped on
//      Save-Data or 2G until you actually open search). When ready, meaning-based results join the fusion
// If anything in step 2 fails, search simply stays lexical; nothing on the page waits for it.
import { buildEngine } from './search-engine.js';

const base = (document.querySelector('meta[name="base"]')?.content || '').replace(/\/$/, '');
const conn = navigator.connection || {};
const frugal = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
const KIND = { post: 'Post', project: 'Project', page: 'Page' };
const MODES = [['fused', 'Best'], ['exact', 'Exact'], ['typos', 'Typos'], ['meaning', 'Meaning']];
const SCOPES = [['all', 'All'], ['post', 'Posts'], ['project', 'Projects'], ['page', 'Pages']];

let engine = null, data = null, vectors = null, loading = null;
let worker = null, semantic = 'off', semanticPct = 0; // off | loading | ready | failed
let mode = 'fused', scope = 'all', sel = 0, results = [], qid = 0, lastLex = null, meaning = [], meaningFor = '';
const dots = () => document.querySelectorAll('.search-dot');

function setState(s, pct) {
  semantic = s; if (pct != null) semanticPct = pct;
  dots().forEach((d) => { d.dataset.state = s; });
  renderStatus();
}

function loadIndex() {
  loading ||= Promise.all([
    fetch(`${base}/search/index.json`).then((r) => r.json()),
    fetch(`${base}/search/vectors.bin`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
  ]).then(([d, v]) => {
    data = d; vectors = v; engine = buildEngine(d);
    // finish the typo index in idle slices so it never blocks scrolling or typing
    const step = (dl) => { if (!engine.warm(() => dl.timeRemaining())) idle(step); };
    idle(step);
    if (ui) run();
  }).catch(() => { loading = null; });
  return loading;
}

function startModel() {
  if (worker || semantic === 'failed' || !vectors || typeof Worker === 'undefined') return;
  try {
    worker = new Worker(new URL('./search-worker.js', import.meta.url), { type: 'module' });
  } catch { setState('failed'); return; }
  setState('loading', 0);
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'progress') setState('loading', m.pct);
    else if (m.type === 'ready') { setState('ready'); if (ui) run(); }
    else if (m.type === 'hits' && m.id === qid) { meaning = engine.meaningToDocs(m.hits); meaningFor = ui.input.value; render(); }
    else if (m.type === 'error' && semantic !== 'ready') { setState('failed'); worker.terminate(); }
  };
  worker.onerror = () => { if (semantic !== 'ready') setState('failed'); };
  worker.postMessage({ type: 'init', vectors: vectors.slice(0), dims: data.dims, model: data.model, base });
}

function prefetch() {
  loadIndex().then(() => { if (!frugal) startModel(); });
}

// ---------- UI ----------
let ui = null;
function buildUI() {
  const dlg = document.createElement('dialog');
  dlg.className = 'search-dlg';
  dlg.setAttribute('aria-label', 'Search the site');
  dlg.innerHTML = `
    <div class="sd-box">
      <div class="sd-top">
        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m11 11 3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <input type="search" placeholder="Search posts, projects and pages" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="sd-list" aria-autocomplete="list" />
        <kbd class="sd-esc">esc</kbd>
      </div>
      <div class="sd-bar">
        <div class="sd-chips" data-g="mode" role="radiogroup" aria-label="Ranking">${MODES.map(([k, t]) => `<button type="button" role="radio" data-v="${k}">${t}</button>`).join('')}</div>
        <div class="sd-chips" data-g="scope" role="radiogroup" aria-label="Show">${SCOPES.map(([k, t]) => `<button type="button" role="radio" data-v="${k}">${t}</button>`).join('')}</div>
      </div>
      <ol class="sd-list" id="sd-list" role="listbox"></ol>
      <div class="sd-status mono" aria-live="polite"></div>
    </div>`;
  document.body.append(dlg);
  const input = dlg.querySelector('input'), list = dlg.querySelector('.sd-list'), status = dlg.querySelector('.sd-status');
  ui = { dlg, input, list, status };
  const syncChips = () => dlg.querySelectorAll('.sd-chips').forEach((g) => g.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === (g.dataset.g === 'mode' ? mode : scope)))));
  syncChips();
  dlg.querySelectorAll('.sd-chips').forEach((g) => g.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (g.dataset.g === 'mode') mode = b.dataset.v; else scope = b.dataset.v;
    syncChips(); render(); input.focus();
  }));
  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); move(e.key === 'ArrowDown' ? 1 : -1); }
    else if (e.key === 'Enter') { e.preventDefault(); const a = list.querySelector('[aria-selected="true"] a'); if (a) go(a, e.metaKey || e.ctrlKey); }
  });
  list.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); go(a); } });
  list.addEventListener('mousemove', (e) => { const li = e.target.closest('li[data-i]'); if (li && +li.dataset.i !== sel) { sel = +li.dataset.i; mark(); } });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => document.documentElement.classList.remove('search-open'));
}

function open() {
  if (!ui) buildUI();
  loadIndex().then(() => startModel());
  if (!ui.dlg.open) { ui.dlg.showModal(); document.documentElement.classList.add('search-open'); }
  ui.input.select();
  run();
}

function go(a, newTab) {
  const url = new URL(a.href, location.href);
  if (newTab) { window.open(url.href, '_blank', 'noopener'); return; }
  ui.dlg.close();
  // a scene on the home page we are already on: let the scroll story glide there
  if (url.pathname === location.pathname && url.hash && window.__story?.goto) { history.replaceState(null, '', url.hash); window.__story.goto(url.hash.slice(1)); return; }
  location.href = url.href;
}

function run() {
  if (!ui) return;
  const q = ui.input.value;
  if (!engine) { renderStatus(); return; }
  const t0 = performance.now();
  lastLex = engine.lexical(q);
  lastLex.ms = performance.now() - t0;
  sel = 0;
  if (meaningFor !== q) meaning = [];
  if (semantic === 'ready' && q.trim().length >= 2) { qid++; worker.postMessage({ type: 'query', id: qid, q: q.trim() }); }
  render();
}

function render() {
  if (!ui || !engine) return;
  const q = ui.input.value.trim();
  if (!q) { results = []; ui.list.innerHTML = `<li class="sd-empty">Try “quiet fan”, “beads”, “hackathon”, or something vague like “keeping rooms cool”.</li>`; renderStatus(); return; }
  const lists = { exact: lastLex.exact, typos: lastLex.typos };
  if (meaning.length) lists.meaning = meaning;
  results = engine.fuse(lists, mode, scope, 40, lastLex.qt.length);
  const { docs, passages } = engine;
  ui.list.innerHTML = results.length ? results.map((r, i) => {
    const d = docs[r.d], p = passages[r.p];
    const url = `${base}${d.u}${p.a && !d.u.includes('#') ? '#' + p.a : ''}`;
    const via = Object.entries(r.via).map(([k, n]) => `${k} #${n}`).join(' · ');
    return `<li role="option" data-i="${i}" aria-selected="${i === sel}"><a href="${url}">
      <span class="sd-k">${KIND[d.k] || ''}${d.dt ? ' · ' + d.dt.slice(0, 4) : ''}</span>
      <span class="sd-t">${esc(d.t)}${p.h ? `<span class="sd-h"> › ${esc(p.h)}</span>` : ''}</span>
      <span class="sd-s">${engine.snippet(r.p, lastLex.marks)}</span>
      <span class="sd-via mono">${via}</span></a></li>`;
  }).join('') : `<li class="sd-empty">Nothing for “${esc(q)}”${semantic === 'loading' ? '. Meaning search is still loading and may find it in a moment.' : '.'}</li>`;
  renderStatus();
}

function mark() { ui.list.querySelectorAll('li[data-i]').forEach((li) => li.setAttribute('aria-selected', String(+li.dataset.i === sel))); ui.list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }
function move(d) { if (!results.length) return; sel = (sel + d + results.length) % results.length; mark(); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderStatus() {
  if (!ui) return;
  const lex = engine ? `exact + typos ${lastLex?.ms != null ? lastLex.ms.toFixed(1) + ' ms' : 'ready'}` : 'loading index…';
  const sem = { off: 'meaning: off', loading: `meaning: loading model ${semanticPct}%`, ready: 'meaning: on-device', failed: 'meaning unavailable, using words only' }[semantic];
  ui.status.innerHTML = `<span>${lex}</span><span>${sem}</span><span class="sd-keys"><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>↵</kbd> open · <kbd>esc</kbd> close</span>`;
}

// ---------- wiring ----------
addEventListener('keydown', (e) => {
  const t = e.target, typing = t.closest?.('input, textarea, select, [contenteditable="true"]');
  if ((e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
    e.preventDefault(); open();
  }
});
document.addEventListener('click', (e) => { if (e.target.closest('[data-search-open]')) { e.preventDefault(); open(); } });
// hovering or focusing the button is a strong hint: start loading now
document.addEventListener('pointerover', (e) => { if (e.target.closest?.('[data-search-open]')) loadIndex().then(() => startModel()); }, { passive: true });

function idle(fn) { return 'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(() => fn({ timeRemaining: () => 8 }), 50); }
if (document.readyState === 'complete') idle(prefetch); else addEventListener('load', () => idle(prefetch), { once: true });
