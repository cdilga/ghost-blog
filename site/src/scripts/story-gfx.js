// Scroll-driven motion graphics for the home page, one distinct technique per scene:
//   marquee   giant outlined words that slide with scroll and lean with scroll speed (plan)
//   score     a split-flap scoreboard that ticks over as goals go in (Physical Soccer)
//   plane     a paper plane flying a loop-the-loop that draws itself behind it (Aviation ABCs)
//   bubbles   dishwasher bubbles rising with scroll, wobbling and popping at the top (Dishmate)
//   house3d   the real house shell, assembled in 3D: slab, walls rise, furniture drops, then the air moves (home twin)
// Each hook takes its element and returns run(lp) for scene-local progress 0..1, called every frame while on screen.

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) ** 3;

// ---------- marquee ----------
export function marqueeHook(el) {
  const rows = [...el.querySelectorAll('.mq-row')];
  let last = null, lean = 0, lastT = performance.now();
  return (lp) => {
    const now = performance.now(), dt = Math.max(0.001, (now - lastT) / 1000); lastT = now;
    const v = last == null ? 0 : (lp - last) / dt; last = lp;
    lean += (clamp(v * 18, -14, 14) - lean) * Math.min(1, dt * 8);
    rows.forEach((r, i) => {
      const dir = i % 2 ? 1 : -1;
      r.style.transform = `translate3d(${(dir * (lp - 0.5) * 38 - (i % 2 ? 30 : 8)).toFixed(2)}%,0,0) skewX(${(-lean * dir).toFixed(2)}deg)`;
    });
  };
}

// ---------- split-flap scoreboard ----------
export function scoreHook(el) {
  const goals = (el.dataset.goals || '').split(',').map((g) => { const [at, side] = g.split(':'); return { at: +at, side }; });
  const red = el.querySelector('[data-team="red"]'), blue = el.querySelector('[data-team="blue"]'), flash = el.querySelector('.sb-goal');
  let shown = { red: -1, blue: -1 };
  const set = (node, v, team) => {
    if (shown[team] === v) return;
    const first = shown[team] < 0; shown[team] = v;
    node.querySelector('.flap-next').textContent = v;
    if (first) { node.querySelector('.flap-cur').textContent = v; return; }
    node.classList.remove('flip'); void node.offsetWidth; node.classList.add('flip');
    clearTimeout(node._t); node._t = setTimeout(() => { node.querySelector('.flap-cur').textContent = v; node.classList.remove('flip'); }, 420);
    flash.dataset.team = team; flash.classList.remove('pop'); void flash.offsetWidth; flash.classList.add('pop');
  };
  return (lp) => {
    const r = goals.filter((g) => g.side === 'r' && lp >= g.at).length, b = goals.filter((g) => g.side === 'b' && lp >= g.at).length;
    set(red, r, 'red'); set(blue, b, 'blue');
  };
}

// ---------- paper plane ----------
export function planeHook(svg) {
  const path = svg.querySelector('.fp-path'), trail = svg.querySelector('.fp-trail'), plane = svg.querySelector('.fp-plane');
  const len = path.getTotalLength();
  trail.style.strokeDasharray = `${len} ${len}`;
  return (lp) => {
    const t = easeOut(clamp((lp - 0.08) / 0.8));
    trail.style.strokeDashoffset = (len * (1 - t)).toFixed(1);
    const d = len * t, p = path.getPointAtLength(d), q = path.getPointAtLength(Math.min(len, d + 2));
    const a = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
    plane.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${a.toFixed(1)})`);
    plane.style.opacity = t > 0 && t < 1 ? 1 : t >= 1 ? 1 : 0;
  };
}

// ---------- bubbles ----------
export function bubblesHook(cv) {
  const ctx = cv.getContext('2d');
  const N = 46, rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const B = Array.from({ length: N }, (_, i) => ({ x: rnd(i, 1), r: 4 + rnd(i, 2) ** 2 * 26, sp: 0.5 + rnd(i, 3) * 0.9, ph: rnd(i, 4), wob: rnd(i, 5) * 6.28 }));
  let W = 0, H = 0, dpr = 1;
  const t0 = performance.now();
  const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
  function run(lp) {
    if (cv.clientWidth !== W || cv.clientHeight !== H) size();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const t = (performance.now() - t0) / 1000, amount = clamp(lp / 0.25) * clamp((1.05 - lp) / 0.2);
    for (const b of B) {
      const span = H + b.r * 4;
      const y = H + b.r * 2 - (((b.ph + lp * 1.6 * b.sp + t * 0.025 * b.sp) % 1) * span);
      const x = b.x * W + Math.sin(t * 1.3 + b.wob + y * 0.02) * (6 + b.r * 0.4);
      const top = clamp((y + b.r) / (H * 0.18)); // pop near the top
      const a = amount * top * 0.5;
      if (a < 0.01) continue;
      const r = b.r * (top < 1 ? 1 + (1 - top) * 0.5 : 1);
      ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(0.25, 'rgba(255,255,255,0)'); g.addColorStop(0.8, 'rgba(190,225,255,0)'); g.addColorStop(1, 'rgba(220,240,255,.35)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(230,245,255,.35)'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  run.relayout = size;
  return run;
}

// ---------- 3D house ----------
// A tiny painter's-algorithm renderer on a 2D canvas: no WebGL, ~250 boxes. Only the house shell, its fit-out and
// furniture are drawn: nothing of the street or neighbours.
export function house3dHook(cv) {
  const data = JSON.parse(cv.parentElement.querySelector('script[type="application/json"]').textContent);
  const ctx = cv.getContext('2d');
  const chips = [...cv.closest('.scene').querySelectorAll('[data-stage]')];
  const label = cv.parentElement.querySelector('.h3-label');
  let xs = [], ys = [];
  data.rooms.forEach((r) => r.poly.forEach(([x, y]) => { xs.push(x); ys.push(y); }));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const walls = data.solids.map((s, i) => ({ b: s.b, kind: 'wall', i })).sort((a, b) => a.b[0] - b.b[0]);
  walls.forEach((w, i) => { w.order = i / walls.length; });
  const furn = [...data.joinery.map((j) => ({ b: j.b, kind: 'join' })), ...data.furniture.map((f) => ({ b: f.b, kind: 'furn' }))];
  furn.forEach((f, i) => { f.order = ((i * 37) % furn.length) / furn.length; });
  // air path from the AC, down the dining room, round the kitchen, along the hall and into Bed 2
  const air = [[6.19, 10.4, 2.35], [6.4, 8.6, 2.3], [8.4, 7.4, 1.9], [9.4, 6.3, 1.4], [9.3, 4.7, 1.0], [7.6, 4.2, 0.9], [7.35, 3.3, 0.8], [7.9, 1.8, 0.6]];
  const segL = air.slice(1).map((p, i) => Math.hypot(p[0] - air[i][0], p[1] - air[i][1], p[2] - air[i][2]));
  const airLen = segL.reduce((a, b) => a + b, 0);
  const airAt = (s) => { s = ((s % airLen) + airLen) % airLen; for (let i = 0; i < segL.length; i++) { if (s <= segL[i]) { const f = s / segL[i], a = air[i], b = air[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; } s -= segL[i]; } return air[air.length - 1]; };

  let W = 0, H = 0, dpr = 1;
  const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
  const t0 = performance.now();
  let lastStage = '';

  function run(lp) {
    if (cv.clientWidth !== W || cv.clientHeight !== H) size();
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const yaw = (-38 + lp * 56) * Math.PI / 180, el = (58 - lp * 18) * Math.PI / 180;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), se = Math.sin(el), ce = Math.cos(el);
    const S = Math.min(W, H * 1.55) / span * 0.98;
    const P = (x, y, z) => { const dx = x - cx, dy = y - cy; const X = dx * cyw - dy * syw, Y = dx * syw + dy * cyw; return [W / 2 + X * S, H * 0.56 - (Y * se + z * ce) * S, Y * ce - z * se]; };
    const slab = ease(clamp((lp - 0.04) / 0.12)), rise = clamp((lp - 0.16) / 0.3), drop = clamp((lp - 0.46) / 0.22), flow = clamp((lp - 0.66) / 0.12);
    const stage = drop > 0.5 ? 'finished' : rise > 0.4 ? 'frame' : 'slab';
    if (stage !== lastStage) { lastStage = stage; chips.forEach((c) => c.classList.toggle('active', c.dataset.stage === stage)); if (label) label.textContent = stage.toUpperCase(); }

    // slab: room floors
    ctx.globalAlpha = slab;
    for (const r of data.rooms) {
      ctx.beginPath(); r.poly.forEach(([x, y], i) => { const [sx, sy] = P(x, y, 0); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.closePath();
      ctx.fillStyle = '#3a2c22'; ctx.fill(); ctx.strokeStyle = 'rgba(242,230,211,.18)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // boxes, far to near
    const items = [];
    for (const w of walls) { const t = ease(clamp(rise * 1.6 - w.order * 0.6)); if (t > 0.001) items.push({ b: w.b, h: t, dz: 0, kind: 'wall' }); }
    for (const f of furn) { const t = easeOut(clamp(drop * 1.7 - f.order * 0.7)); if (t > 0.001) items.push({ b: f.b, h: 1, dz: (1 - t) * 3.2, a: t, kind: f.kind }); }
    for (const it of items) { const [x0, y0, , x1, y1] = it.b; it.d = P((x0 + x1) / 2, (y0 + y1) / 2, 0)[2]; }
    items.sort((a, b) => b.d - a.d);
    for (const it of items) drawBox(it);

    // airflow: streaks running along the path, from the AC towards Bed 2
    if (flow > 0) {
      const t = (performance.now() - t0) / 1000;
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 26; k++) {
        const s0 = t * 2.2 + (k / 26) * airLen;
        const reach = flow * airLen;
        const sw = ((s0 % airLen) + airLen) % airLen; if (sw > reach) continue;
        const wob = Math.sin(k * 2.3) * 0.35;
        ctx.beginPath();
        for (let j = 0; j < 6; j++) { const p = airAt(sw - j * 0.18); const [sx, sy] = P(p[0] + wob * 0.6, p[1] + wob, p[2] + Math.cos(k) * 0.12); j ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }
        ctx.strokeStyle = `rgba(150,205,255,${(0.55 * (1 - sw / airLen * 0.5)).toFixed(3)})`; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      // the AC head glows once it is running
      const [ax, ay] = P(data.ac.b[0] / 2 + data.ac.b[3] / 2, data.ac.b[1], data.ac.b[5]);
      ctx.fillStyle = `rgba(150,205,255,${(0.8 * flow).toFixed(3)})`; ctx.beginPath(); ctx.arc(ax, ay, 4, 0, Math.PI * 2); ctx.fill();
    }
    function drawBox(it) {
      const [x0, y0, z0, x1, y1, z1] = it.b;
      const za = z0 + it.dz, zb = z0 + (z1 - z0) * it.h + it.dz;
      const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => [P(x, y, za), P(x, y, zb)]);
      const wall = it.kind === 'wall';
      ctx.globalAlpha = wall ? 0.92 : it.a;
      // side faces whose outward normal faces the viewer (lower depth = nearer)
      for (let i = 0; i < 4; i++) {
        const a = c[i], b = c[(i + 1) % 4];
        const mid = (a[0][2] + b[0][2]) / 2, ctr = (c[0][0][2] + c[2][0][2]) / 2;
        if (mid > ctr) continue;
        ctx.beginPath(); ctx.moveTo(a[0][0], a[0][1]); ctx.lineTo(b[0][0], b[0][1]); ctx.lineTo(b[1][0], b[1][1]); ctx.lineTo(a[1][0], a[1][1]); ctx.closePath();
        ctx.fillStyle = wall ? (i % 2 ? '#b8a283' : '#9c8669') : it.kind === 'join' ? '#6b5846' : '#a2552a'; ctx.fill();
      }
      ctx.beginPath(); c.forEach((p, i) => (i ? ctx.lineTo(p[1][0], p[1][1]) : ctx.moveTo(p[1][0], p[1][1]))); ctx.closePath();
      ctx.fillStyle = wall ? '#efe2cb' : it.kind === 'join' ? '#8a7560' : '#ff8a3d'; ctx.fill();
      if (!wall) { ctx.strokeStyle = 'rgba(18,13,10,.5)'; ctx.lineWidth = 0.6; ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  }
  run.relayout = size;
  return run;
}
