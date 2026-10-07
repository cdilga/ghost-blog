// The opening: black until the desert has loaded, then a sandstorm that builds CHRIS DILGER out of sand.
//
//   0      the black curtain lifts as the storm rolls in from the right: a wall of haze and streaking grit
//   0.3s   ~4,000 grains peel off the wind and swirl onto the exact glyph outlines of the name
//   2.0s   the sand hardens into sandstone (the real, selectable heading fades in under the grains)
//   2.15s  the whole name rears up... and SLAMS into the dune: squash, screen shake, a plume of dust
//          thrown up from the baseline, a shockwave rippling out across the sand and a flare of sun
//   2.7s   heat haze shimmers through the letters, a tumbleweed bounces through, the subtitle lands
// Scrolling then erodes the name back into sand, blown right to left by the wind (reversible), and pulling
// past the top of the page replays the whole thing. Reduced motion and ?static skip straight to the name.
//
// The grains are sampled from the heading's own glyphs (one Range per character), so they land exactly
// where the real text is, at any size, on any screen.

const root = document.documentElement;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut3 = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('static');
const SAND = ['#ffe2b0', '#f7c483', '#efa45c', '#d9803f', '#b85d2c', '#8e3f1e'];
// ?introAt=1200 freezes the timeline at that moment (for checking each phase in screenshots)
const FREEZE = +new URLSearchParams(location.search).get('introAt') || 0;
const T = { storm: 250, harden: 2050, lift: 2300, slam: 2520, impact: 2640, settle: 3000, end: 4500 };

// ---------- curtain ----------
export function liftCurtain(ms = 700) {
  const c = document.getElementById('curtain');
  if (!c || c.dataset.lifting) return;
  c.dataset.lifting = '1';
  c.style.transition = `opacity ${ms}ms ease`;
  requestAnimationFrame(() => { c.style.opacity = '0'; });
  setTimeout(() => c.remove(), ms + 60);
}

// resolves when the desert is ready to be seen: fonts, the hero photo and the depth backgrounds (or a cap)
function desertReady(hero, waitDepth = true) {
  const img = hero.closest('.scene')?.querySelector('.bg.photo img');
  const fonts = document.fonts ? Promise.all([document.fonts.load('900 100px Inter'), document.fonts.ready]).catch(() => {}) : Promise.resolve();
  const photo = !img || (img.complete && img.naturalWidth) ? Promise.resolve() : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); });
  const depth = new Promise((r) => {
    if (root.classList.contains('depth-on') || window.__depthState) return r();
    addEventListener('depth-ready', r, { once: true }); addEventListener('depth-failed', r, { once: true });
  });
  // the depth layer can take a moment after the photo; never wait on it for more than 2.5 s once the photo is in
  const depthCapped = waitDepth ? photo.then(() => Promise.race([depth, new Promise((r) => setTimeout(r, 2500))])) : photo;
  return Promise.race([Promise.all([fonts, photo, depthCapped]), new Promise((r) => setTimeout(r, 15000))]);
}

// ---------- the hook ----------
export function heroHook(el) {
  const cv = el.querySelector('canvas.sandstorm');
  const ctx = cv.getContext('2d');
  const name = el.querySelector('.hn');
  const lines = [...name.querySelectorAll('.hn-line')];
  const sub = el.querySelector('.hn-sub'), hint = el.querySelector('.hn-hint'), weed = el.querySelector('.tumbleweed');
  const stage = el.closest('.stage');
  let W = 0, H = 0, dpr = 1, P = null, dust = null, plume = [], clouds = [], t0 = -1, raf = 0, lastLp = 0, eroding = false, played = false;

  function layout() {
    const r = el.getBoundingClientRect();
    if (!r.width) return false;
    dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // rasterise the heading's glyphs where they really are, then sample grains from the ink
    const off = document.createElement('canvas'); off.width = Math.ceil(W); off.height = Math.ceil(H);
    const o = off.getContext('2d', { willReadFrequently: true });
    o.fillStyle = '#000';
    const prev = name.style.transform; name.style.transform = 'none';
    const box = name.getBoundingClientRect();
    for (const line of lines) {
      const cs = getComputedStyle(line), fs = parseFloat(cs.fontSize);
      o.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`; o.textBaseline = 'alphabetic';
      const lb = line.getBoundingClientRect();
      // Inter's metrics: ascender 0.969em, descender 0.241em; the line box centres that content area
      const baseline = lb.top - r.top + (lb.height - 1.21 * fs) / 2 + 0.969 * fs;
      const range = document.createRange(), text = line.firstChild;
      for (let i = 0; i < text.length; i++) {
        range.setStart(text, i); range.setEnd(text, i + 1);
        const cr = range.getBoundingClientRect();
        o.fillText(text.data[i], cr.left - r.left, baseline);
      }
    }
    name.style.transform = prev;
    const data = o.getImageData(0, 0, off.width, off.height).data;
    const pts = [], step = W < 600 ? 2 : 3;
    for (let y = 0; y < off.height; y += step) for (let x = 0; x < off.width; x += step) if (data[(y * off.width + x) * 4 + 3] > 128) pts.push(x, y);
    const max = W < 600 ? 4200 : 9000, n = Math.min(max, pts.length / 2);
    const top = box.top - r.top, hgt = box.height || 1;
    P = new Float32Array(n * 10); // tx ty sx sy delay dur phase colour release drift
    for (let i = 0; i < n; i++) {
      const k = Math.floor(Math.random() * (pts.length / 2)) * 2;
      const tx = pts[k] + Math.random() * step, ty = pts[k + 1] + Math.random() * step;
      const o2 = i * 10;
      P[o2] = tx; P[o2 + 1] = ty;
      P[o2 + 2] = W + 40 + Math.random() * W * 0.7;                       // start: off to the right, in the wind
      P[o2 + 3] = ty + (Math.random() - 0.5) * H * 0.9;
      P[o2 + 4] = (1 - tx / W) * 420 + Math.random() * 260;                 // grains near the wind arrive first
      P[o2 + 5] = 700 + Math.random() * 420;                                 // all landed by ~1.6 s: the name stands in sand

      P[o2 + 6] = Math.random() * 6.283;
      const rel = clamp((ty - top) / hgt);                                   // strata: pale on top, rust below
      P[o2 + 7] = Math.min(SAND.length - 1, Math.max(0, Math.round(rel * (SAND.length - 1) + (Math.random() - 0.5) * 1.6)));
      P[o2 + 8] = 0.16 + (1 - tx / W) * 0.2 + Math.random() * 0.05;          // scroll erosion: windward side first
      P[o2 + 9] = 0.6 + Math.random() * 0.8;
    }
    dust = Array.from({ length: W < 600 ? 360 : 700 }, () => ({ x: Math.random(), y: Math.random(), v: 0.6 + Math.random() * 1.4, l: 6 + Math.random() * 30, a: 0.15 + Math.random() * 0.45, p: Math.random() * 6.283 }));
    return true;
  }

  const clear = () => ctx.setTransform(1, 0, 0, 1, 0, 0) || ctx.clearRect(0, 0, cv.width, cv.height);

  function drawGrains(posFn, alpha) {
    const buckets = SAND.map(() => []);
    const n = P.length / 10;
    for (let i = 0; i < n; i++) { const p = posFn(i); if (p) buckets[P[i * 10 + 7]].push(p); }
    const s = W < 600 ? 1.9 : 2.6;
    buckets.forEach((b, c) => {
      if (!b.length) return;
      ctx.fillStyle = SAND[c];
      for (const [x, y, a] of b) { ctx.globalAlpha = alpha * (a ?? 1); ctx.fillRect(x, y, s, s); }
    });
    ctx.globalAlpha = 1;
  }

  function stepPlume() {
    const dt = 1 / 60;
    for (const p of plume) {
      p.vx *= 0.975; p.vy = p.vy * 0.975 + 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.y > p.floor) { p.y = p.floor; p.vy *= -0.15; p.vx *= 0.6; }
    }
  }

  // ---------- the timeline ----------
  function frame(now) {
    raf = 0;
    const t = FREEZE || now - t0;
    clear(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // haze: the storm front, a warm wall of airborne sand that sweeps through and thins out
    const haze = clamp(t / 500) * (1 - clamp((t - 1500) / 900));
    if (haze > 0) {
      const g = ctx.createLinearGradient(W, 0, 0, 0);
      const front = clamp((t - 100) / 1300);
      g.addColorStop(0, `rgba(214,150,86,${0.55 * haze})`); g.addColorStop(clamp(front), `rgba(196,124,64,${0.4 * haze})`); g.addColorStop(Math.min(1, front + 0.25), 'rgba(196,124,64,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // grit: fast streaks riding the wind, right to left
    const gust = clamp(t / 300) * (1 - clamp((t - 1900) / 900));
    if (gust > 0) {
      ctx.strokeStyle = '#f2c98e'; ctx.lineWidth = 1;
      for (const d of dust) {
        const x = (((d.x - (t / 1000) * d.v * 1.3) % 1) + 1) % 1 * (W + 200) - 100, y = d.y * H + Math.sin(t / 260 + d.p) * 16;
        ctx.globalAlpha = d.a * gust; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + d.l * (1.4 + d.v), y - 1.5); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // grains swirling onto the letters, then fading as the stone takes over
    const fadeGrains = 1 - clamp((t - T.harden - 120) / 320);
    if (fadeGrains > 0) drawGrains((i) => {
      const o = i * 10, u = clamp((t - T.storm - P[o + 4]) / P[o + 5]);
      if (u <= 0) return null;
      const e = easeOut3(u), w = (1 - e) ** 2;
      const x = P[o + 2] + (P[o] - P[o + 2]) * e + Math.sin(P[o + 6] + t * 0.007) * 70 * w;
      const y = P[o + 3] + (P[o + 1] - P[o + 3]) * easeInOut(u) + Math.cos(P[o + 6] * 1.7 + t * 0.009) * 46 * w - Math.sin(u * Math.PI) * 60 * P[o + 9];
      return [x, y, 0.35 + 0.65 * clamp(u * 3)];
    }, fadeGrains);
    // the name itself: stone fades in, rears up, slams down, settles with a wobble
    const stone = clamp((t - T.harden) / 300);
    let ty = 0, sx = 1, sy = 1;
    if (t >= T.lift && t < T.slam) { const k = easeOut3(clamp((t - T.lift) / (T.slam - T.lift))); ty = -0.07 * H * k; sx = sy = 1 + 0.05 * k; }
    else if (t >= T.slam && t < T.impact) { const k = clamp((t - T.slam) / (T.impact - T.slam)) ** 2; ty = -0.07 * H * (1 - k) + 0.012 * H * k; sx = 1.05 - 0.02 * k; sy = 1.05 - 0.15 * k; }
    else if (t >= T.impact) { const k = clamp((t - T.impact) / 520); const wob = Math.exp(-6 * k) * Math.cos(k * 18); ty = 0.012 * H * wob; sx = 1 + 0.03 * wob; sy = 1 - 0.1 * wob; }
    name.style.opacity = stone;
    name.style.transform = `translateY(${ty.toFixed(1)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
    // impact: shake, plume, shockwave, sun flare
    if (t >= T.impact) {
      const k = (t - T.impact) / 1000;
      const shake = Math.exp(-k * 7) * (W < 600 ? 7 : 12);
      if (stage) stage.style.transform = k < 0.6 ? `translate(${((Math.random() - 0.5) * shake).toFixed(1)}px, ${((Math.random() - 0.5) * shake).toFixed(1)}px)` : '';
      const nb = name.getBoundingClientRect(), eb = el.getBoundingClientRect();
      const cx = nb.left - eb.left + nb.width / 2, by = nb.bottom - eb.top - nb.height * 0.04;
      if (FREEZE) { plume = []; burst(); for (let i = 0; i < k * 60; i++) stepPlume(); }
      else if (!plume.length && k < 0.15) burst();
      for (const [delay, spread] of [[0, 1], [0.12, 0.75]]) {
        const q = clamp((k - delay) / 0.9);
        if (q <= 0 || q >= 1) continue;
        ctx.strokeStyle = `rgba(255,214,160,${(0.55 * (1 - q)).toFixed(3)})`; ctx.lineWidth = 3 * (1 - q) + 0.5;
        ctx.beginPath(); ctx.ellipse(cx, by, W * 0.75 * easeOut3(q) * spread, H * 0.06 * easeOut3(q) * spread, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // billowing dust: soft clouds rolling outwards along the base and rising as they thin
      if (!clouds.length) for (let i = 0; i < 18; i++) { const f = i / 17 - 0.5; clouds.push({ x: cx + f * nb.width * 1.1, dir: Math.sign(f) || (Math.random() - 0.5), r: nb.height * (0.12 + Math.random() * 0.1), sp: 0.4 + Math.random() * 0.8, rise: 0.3 + Math.random() * 0.6 }); }
      const ck = clamp(k / 1.6);
      if (ck < 1) for (const c of clouds) {
        const e = easeOut3(ck), x = c.x + c.dir * e * W * 0.14 * c.sp, y = by - e * nb.height * 0.22 * c.rise, r = c.r * (0.6 + e * 1.8);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(222,170,112,${(0.38 * (1 - ck)).toFixed(3)})`); g.addColorStop(1, 'rgba(222,170,112,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const flare = Math.exp(-k * 5);
      if (flare > 0.02) { const g = ctx.createRadialGradient(cx, by, 0, cx, by, W * 0.7); g.addColorStop(0, `rgba(255,214,150,${0.45 * flare})`); g.addColorStop(1, 'rgba(255,170,90,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      // the plume: thrown up and out, dragged by the air, settling back with gravity
      if (plume.length) {
        ctx.fillStyle = '#e8b276';
        if (!FREEZE) stepPlume();
        for (const p of plume) {
          if (p.life <= 0) continue;
          ctx.globalAlpha = clamp(p.life / p.max) * 0.85; ctx.fillRect(p.x, p.y, p.s, p.s);
        }
        ctx.globalAlpha = 1;
      }
      function burst() {
        const n = W < 600 ? 420 : 900;
        for (let i = 0; i < n; i++) {
          const x = cx + (Math.random() - 0.5) * nb.width * 1.05, dir = Math.sign(x - cx) || 1;
          const sp = 160 + Math.random() * 620;
          plume.push({ x, y: by - Math.random() * 6, vx: dir * sp * (0.35 + Math.random() * 0.9), vy: -sp * (0.5 + Math.random() * 0.8), s: 1 + Math.random() * 2.6, life: 0.7 + Math.random() * 1.1, max: 1.8, floor: by + 4 + Math.random() * H * 0.05 });
        }
      }
    }
    // heat haze through the stone for a moment after the slam
    name.classList.toggle('haze', t > T.impact && t < T.end + 600);
    if (sub) sub.style.opacity = clamp((t - T.settle) / 500);
    if (t < T.end || FREEZE) raf = requestAnimationFrame(frame);
    else finish();
  }

  function finish() {
    clear(); plume = []; clouds = [];
    name.style.opacity = 1; name.style.transform = '';
    if (stage) stage.style.transform = '';
    if (sub) sub.style.opacity = 1;
    el.classList.add('played'); played = true;
    setTimeout(() => name.classList.remove('haze'), 1200);
    dispatchEvent(new Event('intro-done'));
  }

  function play() {
    if (raf || !layout()) return;
    eroding = false; plume = []; clouds = []; t0 = performance.now();
    name.style.opacity = 0; if (sub) sub.style.opacity = 0;
    el.classList.remove('played');
    if (weed) { weed.getAnimations().forEach((a) => a.cancel()); setTimeout(() => tumble(), T.impact + 150); }
    raf = requestAnimationFrame(frame);
  }

  function tumble() {
    if (!weed || reduce) return;
    const w = W + 240, kf = [];
    for (let i = 0; i <= 12; i++) { const f = i / 12; kf.push({ transform: `translate(${(W + 120 - w * f).toFixed(0)}px, ${(-Math.abs(Math.sin(f * Math.PI * 5)) * 70 * (1 - f * 0.5)).toFixed(0)}px) rotate(${(-f * 1080).toFixed(0)}deg)`, offset: f }); }
    weed.animate(kf, { duration: 3200, easing: 'linear', fill: 'both' });
  }

  // scroll erosion: grains lift off right to left as the wind takes the name (fully reversible)
  function erode(lp) {
    const n = P.length / 10;
    const k = clamp((lp - 0.14) / 0.04);
    name.style.opacity = 1 - k;
    if (sub) sub.style.opacity = 1 - clamp((lp - 0.1) / 0.12);
    if (lp <= 0.14 || lp >= 0.78) { if (eroding) { clear(); eroding = false; } return; }
    eroding = true;
    clear(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrains((i) => {
      const o = i * 10, v = clamp((lp - P[o + 8]) / 0.3);
      if (v >= 1) return null;
      const e = v ** 1.5;
      return [P[o] - e * (W * (0.7 + P[o + 9] * 0.5)), P[o + 1] - e * H * 0.25 * P[o + 9] + Math.sin(P[o + 6] + v * 7) * 26 * v, 1 - v * v];
    }, k);
  }

  // ---------- start, replay, resize ----------
  if (reduce) {
    name.style.opacity = 1; el.classList.add('played');
    desertReady(el, false).then(() => liftCurtain(300));
  } else {
    desertReady(el).then(() => { liftCurtain(900); play(); });
    // pull past the top (wheel or touch overscroll) to replay
    let pull = 0, pullT = 0, ty0 = null;
    const atTop = () => scrollY <= 2 && lastLp < 0.05;
    addEventListener('wheel', (e) => {
      if (!played || raf || !atTop() || e.deltaY >= 0) { pull = 0; return; }
      const now = performance.now(); if (now - pullT > 500) pull = 0; pullT = now;
      pull += -e.deltaY; if (pull > 260) { pull = 0; play(); }
    }, { passive: true });
    addEventListener('touchstart', (e) => { ty0 = atTop() ? e.touches[0].clientY : null; }, { passive: true });
    addEventListener('touchmove', (e) => { if (ty0 != null && played && !raf && e.touches[0].clientY - ty0 > 110) { ty0 = null; play(); } }, { passive: true });
    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!raf) layout(); }, 200); });
  }

  return (lp) => {
    lastLp = lp;
    if (hint) hint.style.opacity = played && lp < 0.03 ? 1 : 0;
    if (reduce) { name.style.opacity = 1 - clamp((lp - 0.14) / 0.12); if (sub) sub.style.opacity = name.style.opacity; return; }
    if (raf || !played || !P) return;
    erode(lp);
  };
}
