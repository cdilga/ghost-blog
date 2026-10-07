// Scroll story engine.
//
// Design rules (these are what fix the mobile-Chrome toolbar jank):
//  1. Native scroll only. No scroll hijacking, no pinning library, no wheel interception.
//  2. The track height and the sticky stage are sized in `lvh`, the *largest* viewport,
//     so the URL bar showing/hiding never changes layout. Content sits in an `svh` frame
//     that is always fully visible.
//  3. Progress is a pure function of scrollY / (track - stage). Nothing is re-measured on
//     `resize` unless the *width* changed (height-only resizes are toolbar noise).
//  4. A critically damped follower smooths the displayed progress, so wheel notches and
//     touch flings feel like one continuous camera move. Scrub is stateless w.r.t. time.
//  5. Content always fits. If a scene's content is taller than the frame (phones, zoomed
//     desktops, landscape), the scene gets extra scroll length and the content pans through
//     the frame instead of being clipped or having copy hidden by media queries.
//  6. Every scene has three phases: enter (content drifts up into place), hold (text lights
//     up word by word as you read), exit (content lifts away while the next scene arrives).
const root = document.documentElement;
root.classList.remove('no-js');
const story = document.getElementById('story');

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const coarse = matchMedia('(pointer: coarse)').matches;

function init() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = story.querySelector('.stage');
  const frameEl = story.querySelector('.frame');
  const scenes = [...story.querySelectorAll('.scene')].map((el) => ({
    el,
    id: el.dataset.scene,
    base: parseFloat(el.dataset.len),
    len: parseFloat(el.dataset.len),
    content: el.querySelector('.content'),
    fx: [...el.querySelectorAll('[data-fx]')].map(prepFx),
    hook: el.querySelector('[data-hook]'),
    over: 0,
  }));
  if (reduce || new URLSearchParams(location.search).has('static')) {
    root.classList.add('static');
    return;
  }

  const hooks = { beads: beadsHook, terms: termsHook, rack: rackHook, house: houseHook, timeline: timelineHook };
  for (const s of scenes) if (s.hook) s.run = hooks[s.hook.dataset.hook]?.(s.hook);

  const bar = document.getElementById('progress');
  const dots = [...document.querySelectorAll('#rail button')];
  let trackTop = 0, range = 1, width = innerWidth, stageH = 0, frameH = 0;

  // Layout pass: measure how much each scene's content overflows the always-visible frame,
  // give tall scenes extra scroll so the pan is not rushed, then size the track.
  function layout() {
    frameH = frameEl.offsetHeight;
    for (const s of scenes) {
      if (!s.content) continue;
      s.el.classList.remove('tall');
      const cs = getComputedStyle(s.el);
      const avail = frameH - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      s.over = Math.max(0, s.content.offsetHeight - avail);
      s.el.classList.toggle('tall', s.over > 0);
      s.len = s.base + Math.min(2, (s.over / frameH) * 1.2);
    }
    const total = scenes.reduce((a, s) => a + s.len, 0);
    let acc = 0;
    for (const s of scenes) { s.start = acc / total; acc += s.len; s.end = acc / total; }
    story.style.setProperty('--total', total.toFixed(3));
    for (const s of scenes) s.relayout?.();
    measure();
  }
  function measure() {
    trackTop = story.getBoundingClientRect().top + scrollY;
    stageH = stage.offsetHeight;
    range = Math.max(1, story.offsetHeight - stageH);
  }
  for (const s of scenes) if (s.run?.relayout) s.relayout = s.run.relayout;
  layout();
  addEventListener('resize', () => {
    if (innerWidth !== width) { width = innerWidth; layout(); } // ignore toolbar-only height changes
  }, { passive: true });
  addEventListener('load', layout);
  if (document.fonts?.ready) document.fonts.ready.then(layout);

  // Damped follower
  let target = 0, shown = 0, last = performance.now(), active = -1;
  const stats = { frames: 0, long: 0, worst: 0, dts: [] };
  const rate = 9; // higher = snappier

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    stats.frames++; const ms = dt * 1000; if (ms > 24) stats.long++; stats.worst = Math.max(stats.worst, ms);
    if (stats.dts.length < 4000) stats.dts.push(+ms.toFixed(1));
    if (stage.offsetHeight !== stageH) measure(); // lvh only changes on real resizes, never on toolbar show/hide
    target = clamp((scrollY - trackTop) / range);
    const k = 1 - Math.exp(-rate * dt);
    shown += (target - shown) * k;
    if (Math.abs(target - shown) < 1e-5) shown = target;
    render(shown);
    requestAnimationFrame(frame);
  }

  function render(P) {
    bar.style.transform = `scaleX(${P})`;
    let cur = 0;
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const p = (P - s.start) / (s.end - s.start); // local progress, <0 or >1 outside
      // Crossfade windows overlap neighbours so there is never dead air. Windows are
      // expressed in viewport heights of scroll so long scenes do not linger half-faded.
      const w = 0.22 / s.len;
      const fadeIn = i === 0 ? 1 : ease(clamp((p + w * 0.6) / w));
      const fadeOut = i === scenes.length - 1 ? 1 : ease(clamp((1 + w * 0.6 - p) / w));
      const o = Math.min(fadeIn, fadeOut);
      const on = o > 0.002;
      if (on !== s.on) { s.on = on; s.el.classList.toggle('on', on); }
      if (!on) continue;
      s.el.style.opacity = o;
      s.o = o;
      if (p >= 0 && p < 1) cur = i;
      const lp = clamp(p);
      if (s.content) {
        // enter: rise from below; exit: lift away; tall scenes pan their overflow through the frame
        const enter = i === 0 ? 1 : easeOut(clamp((p + w * 0.6) / (w * 1.6)));
        const exit = i === scenes.length - 1 ? 0 : ease(clamp((p - (1 - w * 0.4)) / (w * 1.2)));
        const pan = s.over * ease(clamp((lp - 0.12) / 0.72));
        const y = (1 - enter) * frameH * 0.12 - exit * frameH * 0.14 - pan;
        s.content.style.transform = `translate3d(0,${y.toFixed(1)}px,0) scale(${(1 - exit * 0.04).toFixed(4)})`;
      }
      for (const f of s.fx) f.run(lp, p);
      s.run?.(lp, p);
    }
    if (cur !== active) { active = cur; dots.forEach((d, i) => d.setAttribute('aria-current', i === cur)); root.dataset.scene = scenes[cur].id; }
    stats.P = P; stats.target = target; stats.scene = scenes[cur].id;
  }

  // Dots navigate natively
  const byId = Object.fromEntries(scenes.map((s) => [s.id, s]));
  function goto(id, smooth = true) {
    const s = byId[id]; if (!s) return;
    const y = trackTop + (s.start + (s.end - s.start) * 0.5) * range;
    scrollTo({ top: y, behavior: smooth ? 'smooth' : 'instant' });
  }
  dots.forEach((d) => d.addEventListener('click', () => goto(d.dataset.goto)));
  document.querySelectorAll('a[href^="#"], a[href^="/#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href').split('#')[1];
    if (byId[id]) { e.preventDefault(); goto(id); }
  }));
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input,textarea')) return;
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (dir) { const i = clamp(active + dir, 0, scenes.length - 1); goto(scenes[i].id); }
  });

  window.__story = { scenes, stats, goto, get progress() { return shown; }, get target() { return target; }, measure, layout, snap() { target = clamp((scrollY - trackTop) / range); shown = target; render(shown); } };
  root.dataset.storyReady = '1';
  requestAnimationFrame((t) => { last = t; frame(t); });
  if (location.hash && byId[location.hash.slice(1)]) setTimeout(() => goto(location.hash.slice(1), false), 50);
}

/* ---------- effect factory ---------- */
// data-fx types (data-a = start, data-d = duration, both in scene-local progress 0..1):
//   words   headline: words rise, unblur and settle one after another
//   reveal  body copy: every word is visible but dim, and lights up as you scroll (read-along)
//   rise / fade / tilt   blocks
//   pan     screenshot slowly scrolls inside its device frame
//   bgzoom  background slow push-in
//   count   number counts up to data-to
//   drift   parallax: moves at data-speed (px per scene) for depth
function prepFx(el) {
  const type = el.dataset.fx;
  const a = parseFloat(el.dataset.a ?? '0');
  const d = parseFloat(el.dataset.d ?? '0.2');
  const seg = (lp) => clamp((lp - a) / d);
  if (type === 'words') {
    const words = splitWords(el);
    const n = words.length;
    const blur = !coarse && n < 14;
    let lastT = -1;
    return { run(lp) {
      const t = seg(lp);
      if (t === lastT) return; lastT = t;
      words.forEach((w, i) => {
        const wt = easeOut(clamp(t * (n + 2) / 3 - i / 3));
        w.style.opacity = wt;
        w.style.transform = `translate3d(0,${((1 - wt) * 0.6).toFixed(3)}em,0) rotate(${((1 - wt) * 3).toFixed(2)}deg)`;
        if (blur) w.style.filter = wt < 1 ? `blur(${((1 - wt) * 8).toFixed(1)}px)` : 'none';
      });
    } };
  }
  if (type === 'reveal') {
    const words = splitWords(el);
    const n = words.length;
    el.style.opacity = 1;
    let lastT = -1;
    return { run(lp) {
      // the block itself slides in at the start of its window, then words light up across it
      const t = seg(lp);
      const inT = easeOut(clamp(t / 0.25));
      el.style.transform = `translate3d(0,${((1 - inT) * 28).toFixed(1)}px,0)`;
      el.style.opacity = (0.25 + inT * 0.75).toFixed(3);
      if (t === lastT) return; lastT = t;
      const lit = t * (n + 6);
      words.forEach((w, i) => { const v = clamp(lit - i, 0, 1); w.style.opacity = (0.2 + v * 0.8).toFixed(3); });
    } };
  }
  if (type === 'count') {
    const to = parseFloat(el.dataset.to), from = parseFloat(el.dataset.from ?? '0');
    return { run(lp) { el.textContent = Math.round(from + (to - from) * easeOut(seg(lp))); } };
  }
  if (type === 'drift') {
    const sp = parseFloat(el.dataset.speed ?? '60');
    return { run(lp, p) { const q = clamp(p, -0.3, 1.3); el.style.transform = `translate3d(${(Math.sin(q * 3 + sp) * sp * 0.08).toFixed(1)}px,${((0.5 - q) * sp).toFixed(1)}px,0)`; } };
  }
  if (type === 'out') return { run(lp) { el.style.opacity = 1 - seg(lp); } };
  if (type === 'fade') return { run(lp) { el.style.opacity = seg(lp); } };
  if (type === 'rise') return { run(lp) { const t = easeOut(seg(lp)); el.style.opacity = t; el.style.transform = `translate3d(0,${(1 - t) * 48}px,0)`; } };
  if (type === 'tilt') return { run(lp) {
    const t = easeOut(seg(lp)); const drift = lp - 0.5;
    el.style.opacity = Math.min(1, t * 1.4);
    el.style.transform = `perspective(1100px) translate3d(0,${(1 - t) * 70 + drift * -40}px,0) rotateY(${(1 - t) * -16 + drift * 6}deg) rotateX(${(1 - t) * 8}deg) scale(${0.9 + t * 0.1})`;
  } };
  if (type === 'pan') return { run(lp) { el.style.transform = `translate3d(0,${-Math.max(0, lp - 0.1) * 14}%,0) scale(1.06)`; } };
  if (type === 'bgzoom') return { run(lp) { el.style.transform = `scale(${1.04 + lp * 0.22}) translate3d(0,${lp * -4}%,0)`; } };
  return { run() {} };
}

// Wrap each word in a span, preserving inline markup like <b>, <code> and <a>.
function splitWords(el) {
  if (el.dataset.split) return [...el.querySelectorAll('.w')];
  el.dataset.split = '1';
  el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
  const texts = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) texts.push(walk.currentNode);
  const words = [];
  for (const node of texts) {
    const parts = node.textContent.split(/(\s+)/);
    const frag = document.createDocumentFragment();
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.append(' '); continue; }
      const s = document.createElement('span');
      s.className = 'w'; s.setAttribute('aria-hidden', 'true'); s.textContent = part;
      frag.append(s); words.push(s);
    }
    node.replaceWith(frag);
  }
  return words;
}

/* ---------- scene hooks: stateless functions of local progress ---------- */
const c01 = (v) => clamp(v);
const xy = (el) => el.getAttribute('transform').match(/-?[\d.]+/g).map(Number);

function beadsHook(svg) {
  const nodes = [...svg.querySelectorAll('.node')].map((n) => ({ n, at: xy(n), done: +n.dataset.done }));
  const edges = [...svg.querySelectorAll('.edge')];
  const ready = svg.parentElement.querySelector('[data-ready]');
  return (lp) => {
    let open = 0;
    nodes.forEach(({ n, at, done }, i) => {
      const appear = c01((lp - 0.08 - i * 0.04) / 0.1);
      n.style.opacity = appear;
      n.style.transform = `translate(${at[0]}px,${at[1] + (1 - appear) * 14}px)`;
      const isDone = lp > 0.25 + done * 0.6;
      n.classList.toggle('done', isDone);
      if (appear > 0.5 && !isDone) open++;
    });
    edges.forEach((e, i) => { e.style.strokeDashoffset = 1 - c01((lp - 0.18 - i * 0.04) / 0.18); });
    if (ready) ready.textContent = open;
  };
}

const LINES = (task, status) => [`$ bd ready --claim`, `› ${task}`, `… ${status}`, '✓ tests pass, PR merged'];
function termsHook(grid) {
  const terms = [...grid.querySelectorAll('.term')].map((t, i) => {
    const full = LINES(t.dataset.task, t.dataset.status).join('\n');
    return { t, line: t.querySelector('.line'), full, i, last: -1 };
  });
  const merged = grid.parentElement.querySelector('[data-merged]');
  return (lp) => {
    let done = 0;
    for (const x of terms) {
      const appear = c01((lp - 0.06 - x.i * 0.03) / 0.1);
      x.t.style.opacity = appear; x.t.style.transform = `translate3d(0,${(1 - appear) * 24}px,0)`;
      const chars = Math.floor(c01((lp - 0.14 - x.i * 0.03) / 0.5) * x.full.length);
      const okAt = x.full.indexOf('✓');
      if (chars >= x.full.length) done++;
      if (chars !== x.last) {
        x.last = chars;
        const txt = x.full.slice(0, chars);
        x.line.textContent = '';
        const pre = document.createElement('span'); pre.style.whiteSpace = 'pre-wrap';
        pre.textContent = chars > okAt ? txt.slice(0, okAt) : txt;
        x.line.append(pre);
        if (chars > okAt) { const ok = document.createElement('span'); ok.className = 'ok'; ok.textContent = txt.slice(okAt); x.line.append(ok); }
        if (chars < x.full.length) { const c = document.createElement('span'); c.className = 'cur'; x.line.append(c); }
        x.t.classList.toggle('finished', chars >= x.full.length);
      }
    }
    if (merged) merged.textContent = done;
  };
}

function rackHook(svg) {
  const items = [...svg.querySelectorAll('.item')].map((it) => ({ it, at: xy(it) }));
  return (lp) => items.forEach(({ it, at }, i) => {
    const t = c01((lp - 0.15 - i * 0.045) / 0.12);
    it.style.opacity = t;
    it.style.transform = `translate(${at[0]}px,${at[1] - (1 - t) * 60}px)`;
  });
}

function houseHook(svg) {
  const slab = svg.querySelector('.slab'), frame = svg.querySelector('.frame'), fin = svg.querySelector('.finished'), marks = [...svg.querySelectorAll('.marks > g')], label = svg.querySelector('.stagelabel');
  const chips = [...svg.closest('.scene').querySelectorAll('[data-stage]')];
  return (lp) => {
    const sl = c01((lp - 0.1) / 0.12), fr = c01((lp - 0.3) / 0.2), fi = c01((lp - 0.55) / 0.2);
    slab.style.opacity = sl;
    frame.style.opacity = fr * (1 - fi * 0.85);
    frame.style.transform = `translateY(${(1 - fr) * -40}px)`;
    fin.style.opacity = fi; fin.style.transform = `translateY(${(1 - fi) * -30}px)`;
    marks.forEach((m, i) => { const t = c01((lp - 0.78 - i * 0.04) / 0.08); m.style.opacity = t; m.style.transform = `scale(${0.4 + t * 0.6})`; m.style.transformBox = 'fill-box'; m.style.transformOrigin = 'center'; });
    const st = fi > 0.5 ? 'finished' : fr > 0.5 ? 'frame' : 'slab';
    label.textContent = st.toUpperCase();
    chips.forEach((c) => c.classList.toggle('active', c.dataset.stage === st));
  };
}

// Horizontal timeline: the track slides left as you scroll, the year ticks over,
// and the milestone nearest the centre line lights up.
function timelineHook(el) {
  const track = el.querySelector('.tl-track');
  const items = [...track.querySelectorAll('.tl-item')];
  const year = el.querySelector('.tl-year');
  const fill = el.querySelector('.tl-fill');
  let shift = 0, centres = [], viewW = 0;
  function relayout() {
    viewW = el.offsetWidth;
    track.style.transform = 'none';
    const base = track.getBoundingClientRect().left;
    centres = items.map((it) => { const r = it.getBoundingClientRect(); return r.left - base + r.width / 2; });
    shift = Math.max(0, track.scrollWidth - viewW);
  }
  const run = (lp) => {
    const t = ease(clamp((lp - 0.08) / 0.8));
    const x = -shift * t;
    track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    // which item is closest to the reading line (40% across the viewport)
    const line = viewW * 0.4 - x;
    let best = 0, bd = Infinity;
    centres.forEach((c, i) => { const d = Math.abs(c - line); if (d < bd) { bd = d; best = i; } });
    if (t === 0) best = 0;
    if (t === 1) best = items.length - 1;
    items.forEach((it, i) => {
      const dist = Math.abs(centres[i] - line) / Math.max(1, viewW);
      it.style.opacity = (1 - clamp(dist * 1.4, 0, 0.7)).toFixed(3);
      it.classList.toggle('now', i === best);
    });
    if (year) year.textContent = items[best].dataset.year;
    if (fill) fill.style.transform = `scaleX(${t.toFixed(4)})`;
  };
  run.relayout = relayout;
  relayout();
  return run;
}

if (story) init();
