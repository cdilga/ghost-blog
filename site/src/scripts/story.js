// Scroll story engine.
//
// Design rules (these are what fix the mobile-Chrome toolbar jank):
//  1. Native scroll only. No scroll hijacking, no pinning library, no wheel interception.
//  2. The track height and the sticky stage are sized in `lvh`, the *largest* viewport,
//     so the URL bar showing/hiding never changes layout. Content sits in an `svh` frame
//     that is always fully visible.
//  3. Progress is a pure function of scrollY / (track - stage). Nothing is measured on
//     `resize` unless the *width* changed (height-only resizes are toolbar noise).
//  4. A critically damped follower smooths the displayed progress, so wheel notches and
//     touch flings feel like one continuous camera move. Scrub is stateless w.r.t. time.
const root = document.documentElement;
root.classList.remove('no-js');
const story = document.getElementById('story');
function init() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = story.querySelector('.stage');
  const scenes = [...story.querySelectorAll('.scene')].map((el) => ({
    el,
    id: el.dataset.scene,
    len: parseFloat(el.dataset.len),
    fx: [...el.querySelectorAll('[data-fx]')].map(prepFx),
    hook: el.querySelector('[data-hook]'),
  }));
  if (reduce || new URLSearchParams(location.search).has('static')) {
    root.classList.add('static');
    return;
  }
  const total = scenes.reduce((a, s) => a + s.len, 0);
  let acc = 0;
  for (const s of scenes) { s.start = acc / total; acc += s.len; s.end = acc / total; }

  const hooks = { beads: beadsHook, terms: termsHook, rack: rackHook, house: houseHook };
  for (const s of scenes) if (s.hook) s.run = hooks[s.hook.dataset.hook]?.(s.hook);

  const bar = document.getElementById('progress');
  const dots = [...document.querySelectorAll('#rail button')];
  let trackTop = 0, range = 1, width = innerWidth, stageH = 0;

  function measure() {
    trackTop = story.getBoundingClientRect().top + scrollY;
    stageH = stage.offsetHeight;
    range = Math.max(1, story.offsetHeight - stageH);
  }
  measure();
  addEventListener('resize', () => {
    if (innerWidth !== width) { width = innerWidth; measure(); } // ignore toolbar-only height changes
  }, { passive: true });
  addEventListener('load', measure);
  if (document.fonts?.ready) document.fonts.ready.then(measure);

  // Damped follower
  let target = 0, shown = 0, last = performance.now(), active = -1;
  const stats = { frames: 0, long: 0, worst: 0, dts: [] };
  const rate = 9; // higher = snappier

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    stats.frames++; const ms = dt * 1000; if (ms > 24) stats.long++; stats.worst = Math.max(stats.worst, ms);
    if (stats.dts.length < 4000) stats.dts.push(+ms.toFixed(1));
    if (stage.offsetHeight !== stageH) measure(); // lvh only changes on real resizes, never on toolbar show/hide
    target = Math.min(1, Math.max(0, (scrollY - trackTop) / range));
    const k = 1 - Math.exp(-rate * dt);
    shown += (target - shown) * k;
    if (Math.abs(target - shown) < 1e-5) shown = target;
    render(shown);
    requestAnimationFrame(frame);
  }

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function render(P) {
    bar.style.transform = `scaleX(${P})`;
    let cur = 0;
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const p = (P - s.start) / (s.end - s.start); // local progress, <0 or >1 outside
      // crossfade windows overlap neighbours so there is never dead air
      const fadeIn = i === 0 ? 1 : ease(clamp((p + 0.12) / 0.2));
      const fadeOut = i === scenes.length - 1 ? 1 : ease(clamp((1.12 - p) / 0.2));
      const o = Math.min(fadeIn, fadeOut);
      const on = o > 0.002;
      if (on !== s.on) { s.on = on; s.el.classList.toggle('on', on); }
      if (!on) continue;
      s.el.style.opacity = o;
      s.o = o;
      if (p >= 0 && p < 1) cur = i;
      const lp = clamp(p);
      for (const f of s.fx) f.run(lp, p);
      s.run?.(lp);
    }
    if (cur !== active) { active = cur; dots.forEach((d, i) => d.setAttribute('aria-current', i === cur)); }
    stats.P = P; stats.target = target; stats.scene = scenes[cur].id;
  }

  // Dots navigate natively
  const byId = Object.fromEntries(scenes.map((s) => [s.id, s]));
  function goto(id, smooth = true) {
    const s = byId[id]; if (!s) return;
    const y = trackTop + (s.start + (s.end - s.start) * 0.42) * range;
    scrollTo({ top: y, behavior: smooth ? 'smooth' : 'instant' });
  }
  dots.forEach((d) => d.addEventListener('click', () => goto(d.dataset.goto)));
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href').slice(1);
    if (byId[id]) { e.preventDefault(); goto(id); }
  }));
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input,textarea')) return;
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (dir) { const i = clamp(active + dir, 0, scenes.length - 1); goto(scenes[i].id); }
  });

  window.__story = { scenes, stats, goto, get progress() { return shown; }, get target() { return target; }, measure, snap() { shown = target; render(shown); } };
  root.dataset.storyReady = '1';
  requestAnimationFrame((t) => { last = t; frame(t); });
  if (location.hash && byId[location.hash.slice(1)]) setTimeout(() => goto(location.hash.slice(1), false), 50);
}

/* ---------- effect factory ---------- */
function prepFx(el) {
  const type = el.dataset.fx;
  const a = parseFloat(el.dataset.a ?? '0');
  const d = parseFloat(el.dataset.d ?? '0.2');
  const seg = (lp) => Math.min(1, Math.max(0, (lp - a) / d));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  if (type === 'words') {
    const words = splitWords(el);
    const n = words.length;
    return { run(lp) {
      const t = seg(lp);
      words.forEach((w, i) => {
        const wt = ease(Math.min(1, Math.max(0, t * (n + 2) / 3 - (i * 1) / 3 * 1)) );
        w.style.opacity = wt;
        w.style.transform = `translate3d(0,${(1 - wt) * 0.55}em,0) rotate(${(1 - wt) * 2.5}deg)`;
        w.style.filter = wt < 1 ? `blur(${(1 - wt) * 10}px)` : 'none';
      });
    } };
  }
  if (type === 'fade') return { run(lp) { el.style.opacity = seg(lp); } };
  if (type === 'rise') return { run(lp) { const t = ease(seg(lp)); el.style.opacity = t; el.style.transform = `translate3d(0,${(1 - t) * 48}px,0)`; } };
  if (type === 'tilt') return { run(lp) {
    const t = ease(seg(lp)); const drift = lp - 0.5;
    el.style.opacity = Math.min(1, t * 1.4);
    el.style.transform = `perspective(1100px) translate3d(0,${(1 - t) * 70 + drift * -40}px,0) rotateY(${(1 - t) * -16 + drift * 6}deg) rotateX(${(1 - t) * 8}deg) scale(${0.9 + t * 0.1})`;
  } };
  if (type === 'pan') return { run(lp) { el.style.transform = `translate3d(0,${-Math.max(0, lp - 0.1) * 14}%,0) scale(1.06)`; } };
  if (type === 'bgzoom') return { run(lp, p) { el.style.transform = `scale(${1.04 + lp * 0.22}) translate3d(0,${lp * -4}%,0)`; } };
  return { run() {} };
}

function splitWords(el) {
  if (el.dataset.split) return [...el.querySelectorAll('.w')];
  el.dataset.split = '1';
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  return text.split(/\s+/).map((word, i, arr) => {
    const s = document.createElement('span');
    s.className = 'w'; s.setAttribute('aria-hidden', 'true'); s.textContent = word;
    el.append(s); if (i < arr.length - 1) el.append(' ');
    return s;
  });
}

/* ---------- scene hooks: stateless functions of local progress ---------- */
const c01 = (v) => Math.min(1, Math.max(0, v));

function beadsHook(svg) {
  const nodes = [...svg.querySelectorAll('.node')];
  const edges = [...svg.querySelectorAll('.edge')];
  const base = nodes.map((n) => +n.dataset.done);
  return (lp) => {
    nodes.forEach((n, i) => {
      const appear = c01((lp - 0.12 - i * 0.04) / 0.1);
      n.style.opacity = appear; n.style.transform = `translate(${n.getAttribute('transform').match(/-?[\d.]+/g)[0]}px,${n.getAttribute('transform').match(/-?[\d.]+/g)[1]}px) scale(${0.85 + appear * 0.15})`;
      n.style.transformBox = 'fill-box'; n.style.transformOrigin = 'center';
      n.classList.toggle('done', lp > 0.25 + base[i] * 0.7);
    });
    edges.forEach((e, i) => { e.style.strokeDashoffset = 1 - c01((lp - 0.2 - i * 0.04) / 0.18); });
  };
}

const LINES = (task, status) => [`$ bd show ${task.split(' ')[0]}`, `› ${task}`, `… ${status}`, '✓ tests pass'];
function termsHook(grid) {
  const terms = [...grid.querySelectorAll('.term')].map((t, i) => {
    const full = LINES(t.dataset.task, t.dataset.status).join('\n');
    return { t, line: t.querySelector('.line'), full, i, last: -1 };
  });
  return (lp) => {
    for (const x of terms) {
      const appear = c01((lp - 0.1 - x.i * 0.03) / 0.1);
      x.t.style.opacity = appear; x.t.style.transform = `translate3d(0,${(1 - appear) * 24}px,0)`;
      const chars = Math.floor(c01((lp - 0.18 - x.i * 0.025) / 0.5) * x.full.length);
      if (chars !== x.last) {
        x.last = chars;
        const txt = x.full.slice(0, chars);
        x.line.innerHTML = '';
        const pre = document.createElement('span'); pre.style.whiteSpace = 'pre-wrap';
        pre.textContent = txt.replace('✓ tests pass', '');
        x.line.append(pre);
        if (txt.includes('✓ tests pass')) { const ok = document.createElement('span'); ok.className = 'ok'; ok.textContent = '✓ tests pass'; x.line.append(ok); }
        else { const c = document.createElement('span'); c.className = 'cur'; x.line.append(c); }
      }
    }
  };
}

function rackHook(svg) {
  const items = [...svg.querySelectorAll('.item')];
  return (lp) => items.forEach((it, i) => {
    const t = c01((lp - 0.15 - i * 0.045) / 0.12);
    it.style.opacity = t;
    it.style.transform = `translate(${it.getAttribute('transform').match(/-?[\d.]+/g)[0]}px,${+it.getAttribute('transform').match(/-?[\d.]+/g)[1] - (1 - t) * 60}px)`;
  });
}

function houseHook(svg) {
  const slab = svg.querySelector('.slab'), frame = svg.querySelector('.frame'), fin = svg.querySelector('.finished'), marks = [...svg.querySelectorAll('.marks > g')], label = svg.querySelector('.stagelabel');
  return (lp) => {
    const sl = c01((lp - 0.1) / 0.12), fr = c01((lp - 0.3) / 0.2), fi = c01((lp - 0.6) / 0.2);
    slab.style.opacity = sl;
    frame.style.opacity = fr * (1 - fi * 0.85);
    frame.style.transform = `translateY(${(1 - fr) * -40}px)`;
    fin.style.opacity = fi; fin.style.transform = `translateY(${(1 - fi) * -30}px)`;
    marks.forEach((m, i) => { const t = c01((lp - 0.82 - i * 0.04) / 0.08); m.style.opacity = t; m.style.transform = `scale(${0.4 + t * 0.6})`; m.style.transformBox = 'fill-box'; m.style.transformOrigin = 'center'; });
    label.textContent = fi > 0.5 ? 'FINISHED' : fr > 0.5 ? 'FRAME' : 'SLAB';
  };
}

if (story) init();
