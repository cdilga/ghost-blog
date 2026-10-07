// Main-thread side of the house airflow figure: drawing, tracers, controls. The solver runs in a worker.

export const airflowPresets = {
  ac: [],
  gap: [{ x: 9.4, y: 5.6, dir: [0, -1] }],          // in the living area, blowing through the gap east of the kitchen
  retreat: [{ x: 4.6, y: 7.4, dir: [-0.25, -1] }],  // at the dining edge, blowing down past the retreat
  hall: [{ x: 9.3, y: 4.2, dir: [-1, 0] }],          // in the hall itself, blowing west towards the bedrooms
};
const ROOMS_SHOWN = ['Dining', 'Living', 'Retreat', 'Hall', 'Bed 1', 'Bed 2', 'Bed 3', 'Bed 4', 'Media'];
const U_REF = 5; // m/s represented by the solver's lattice speed limit

export function startHouseAirflow(fig, presets) {
  const plan = JSON.parse(fig.querySelector('.hair-plan').textContent);
  const cv = fig.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const $ = (s) => fig.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 700 || (navigator.hardwareConcurrency || 4) <= 4;
  const state = {
    preset: fig.dataset.preset || 'gap', custom: [], acSpeed: 3.5, louvre: 0, fanSpeed: 4.5, doorsOpen: true, furniture: true,
    h: small ? 0.13 : 0.1,
  };
  const pad = 0.15, [ex0, ey0, ex1, ey1] = plan.extent;
  let W = 0, H = 0, dpr = 1, S = 1; // S: pixels per metre
  const px = (x) => (x - ex0 + pad) * S, py = (y) => (ey1 - y + pad) * S;
  const mx = (cx) => cx / S + ex0 - pad, my = (cy) => ey1 + pad - cy / S;

  // ---------- worker ----------
  let worker = null, grid = null, field = null, lastSim = 0, simRate = 0, lastMsgT = 0;
  const fans = () => (state.preset === 'custom' ? state.custom : presets[state.preset] || []).map((f) => ({ ...f, speed: state.fanSpeed }));
  const cfg = () => ({ h: state.h, doorsOpen: state.doorsOpen, furniture: state.furniture, uRef: U_REF, ac: { on: state.acSpeed > 0, speed: state.acSpeed, louvre: state.louvre }, fans: fans() });
  function start() {
    if (worker) return;
    worker = new Worker(new URL('./airflow-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'grid') { grid = m; field = null; buildBase(); resetTracers(); lastSim = 0; }
      else if (m.type === 'field') {
        const now = performance.now();
        if (lastMsgT && m.simTime > lastSim) simRate = simRate * 0.8 + 0.2 * ((m.simTime - lastSim) / ((now - lastMsgT) / 1000));
        lastMsgT = now; lastSim = m.simTime; field = m;
        $('[data-o="clock"]').textContent = `${m.simTime.toFixed(1)} s simulated`;
        $('[data-o="rate"]').textContent = `${simRate.toFixed(1)}x real time`;
        rooms(m.rooms);
      }
    };
    worker.postMessage({ type: 'init', plan, cfg: cfg() });
    $('.hair-start').hidden = true;
    kick();
  }
  const send = (reset = false) => worker?.postMessage({ type: 'config', cfg: cfg(), reset });

  // ---------- layout + static layer ----------
  const base = document.createElement('canvas'), bctx = base.getContext('2d');
  const trails = document.createElement('canvas'), tctx = trails.getContext('2d');
  const heat = document.createElement('canvas'), hctx = heat.getContext('2d');
  let heatImg = null;
  function size() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = cv.clientWidth; H = Math.round(W * ((ey1 - ey0 + 2 * pad) / (ex1 - ex0 + 2 * pad)));
    S = W / (ex1 - ex0 + 2 * pad);
    for (const c of [cv, base, trails]) { c.width = W * dpr; c.height = H * dpr; }
    for (const c of [ctx, bctx, tctx]) c.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildBase();
  }
  function buildBase() {
    bctx.clearRect(0, 0, W, H);
    bctx.fillStyle = '#0b0806'; bctx.fillRect(0, 0, W, H);
    for (const r of plan.rooms) {
      if (['Alfresco', 'Porch', 'Garage'].includes(r.name)) continue;
      bctx.beginPath(); r.poly.forEach(([x, y], i) => (i ? bctx.lineTo(px(x), py(y)) : bctx.moveTo(px(x), py(y)))); bctx.closePath();
      bctx.fillStyle = '#17110d'; bctx.fill();
    }
    if (state.furniture) for (const o of plan.obstacles) {
      const f = Math.min(1, (Math.min(o.z[1], 2.4) - Math.max(o.z[0], 0)) / 2.4); if (f <= 0) continue;
      bctx.fillStyle = `rgba(242,230,211,${(0.05 + f * 0.18).toFixed(3)})`;
      bctx.fillRect(px(o.b[0]), py(o.b[3]), (o.b[2] - o.b[0]) * S, (o.b[3] - o.b[1]) * S);
    }
    for (const s of plan.solids) {
      bctx.fillStyle = s.c === 'window' ? '#5e8fb8' : '#b9a68f';
      bctx.fillRect(px(s.b[0]), py(s.b[3]), Math.max(1.2, (s.b[2] - s.b[0]) * S), Math.max(1.2, (s.b[3] - s.b[1]) * S));
    }
    if (!state.doorsOpen) for (const d of plan.doors) if (/^(Bed \d Door|Bath Door|WC|Media)$/.test(d.name)) { bctx.fillStyle = '#7a6a58'; bctx.fillRect(px(d.b[0]), py(d.b[3]), Math.max(1.5, (d.b[2] - d.b[0]) * S), Math.max(1.5, (d.b[3] - d.b[1]) * S)); }
    bctx.font = `${Math.max(9, Math.round(S * 0.24))}px JetBrains Mono, monospace`; bctx.textAlign = 'center'; bctx.fillStyle = 'rgba(185,166,143,.55)';
    for (const r of plan.rooms) {
      if (/Robe|Linen|WIP|WC|Alfresco|Porch|Garage/.test(r.name) || r.k === 'space.hall.west') continue;
      const cx = r.poly.reduce((a, p) => a + p[0], 0) / r.poly.length, cy = r.poly.reduce((a, p) => a + p[1], 0) / r.poly.length;
      bctx.fillText(r.name.toUpperCase(), px(cx), py(cy) + (r.name === 'Dining' ? S * 0.9 : 0));
    }
    if (grid) { heat.width = grid.NX; heat.height = grid.NY; heatImg = hctx.createImageData(grid.NX, grid.NY); }
  }

  // ---------- velocity lookup ----------
  function vel(x, y) {
    if (!grid || !field) return [0, 0, true];
    const { NX, NY, h, extent } = grid;
    const fi = (x - extent[0]) / h + 0.5, fj = (y - extent[1]) / h + 0.5;
    const i = Math.floor(fi), j = Math.floor(fj);
    if (i < 0 || j < 0 || i >= NX - 1 || j >= NY - 1) return [0, 0, true];
    const k = j * NX + i;
    const solidHere = grid.solid[Math.round(fj - 0.5) * NX + Math.round(fi - 0.5)] === 1;
    const a = fi - i, b = fj - j, { ux, uy, scale } = field;
    return [
      ((1 - a) * (1 - b) * ux[k] + a * (1 - b) * ux[k + 1] + (1 - a) * b * ux[k + NX] + a * b * ux[k + NX + 1]) * scale,
      ((1 - a) * (1 - b) * uy[k] + a * (1 - b) * uy[k + 1] + (1 - a) * b * uy[k + NX] + a * b * uy[k + NX + 1]) * scale,
      solidHere,
    ];
  }

  // ---------- tracers ----------
  const NT = small ? 520 : 1100;
  const tx = new Float32Array(NT), ty = new Float32Array(NT), tage = new Float32Array(NT);
  function spawn(n) {
    if (!grid) return;
    for (let tries = 0; tries < 50; tries++) {
      // half the tracers start near a fan, so the interesting part is always populated
      const fs = [...(state.acSpeed > 0 ? [{ x: plan.ac.centre_x, y: plan.ac.wall_y - 0.4 }] : []), ...fans()];
      let x, y;
      if (fs.length && Math.random() < 0.5) { const f = fs[(Math.random() * fs.length) | 0]; x = f.x + (Math.random() - 0.5) * 0.8; y = f.y + (Math.random() - 0.5) * 0.8; }
      else { x = ex0 + Math.random() * (ex1 - ex0); y = ey0 + Math.random() * (ey1 - ey0); }
      const k = Math.round((y - grid.extent[1]) / grid.h) * grid.NX + Math.round((x - grid.extent[0]) / grid.h);
      if (k >= 0 && k < grid.solid.length && !grid.solid[k]) { tx[n] = x; ty[n] = y; tage[n] = Math.random() * 3; return; }
    }
  }
  function resetTracers() { for (let n = 0; n < NT; n++) spawn(n); tctx.clearRect(0, 0, W, H); }

  // ---------- frame ----------
  let last = performance.now(), visible = false, raf = 0;
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  function frame(now) {
    raf = 0;
    const dtReal = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, W, H);
    if (field && grid && heatImg) {
      const { NX, NY } = grid, d = heatImg.data, { ux, uy, scale } = field;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i, o = ((NY - 1 - j) * NX + i) * 4;
        if (grid.solid[k]) { d[o + 3] = 0; continue; }
        const sp = Math.min(1, (Math.hypot(ux[k], uy[k]) * scale) / 1.5);
        d[o] = 255 * Math.min(1, sp * 1.7); d[o + 1] = 120 * sp + 135 * sp * sp * sp; d[o + 2] = 30 + 200 * Math.pow(sp, 4); d[o + 3] = 255 * Math.min(0.85, sp * 1.4);
      }
      hctx.putImageData(heatImg, 0, 0);
      ctx.imageSmoothingEnabled = true;
      // cell i spans [x0 + (i-1)h, x0 + ih], so the image's left edge is x0 - h and its top edge y0 + (NY-1)h
      ctx.drawImage(heat, px(grid.extent[0] - grid.h), py(grid.extent[1] + (NY - 1) * grid.h), NX * grid.h * S, NY * grid.h * S);
      // tracers advance in simulated time, so they match the clock
      const dtSim = dtReal * Math.max(0.2, simRate || 1);
      tctx.globalCompositeOperation = 'destination-out'; tctx.fillStyle = 'rgba(0,0,0,0.14)'; tctx.fillRect(0, 0, W, H);
      tctx.globalCompositeOperation = 'source-over'; tctx.lineWidth = 1.2;
      for (let n = 0; n < NT; n++) {
        const [u, v, sol] = vel(tx[n], ty[n]);
        const sp = Math.hypot(u, v);
        tage[n] -= dtSim;
        if (sol || tage[n] < 0 || (sp < 0.03 && Math.random() < 0.02)) { spawn(n); continue; }
        const nx = tx[n] + u * dtSim, ny = ty[n] + v * dtSim;
        if (sp > 0.04) {
          tctx.strokeStyle = `rgba(255,${Math.round(150 + Math.min(1, sp) * 100)},${Math.round(90 + Math.min(1, sp) * 150)},${Math.min(0.9, 0.25 + sp)})`;
          tctx.beginPath(); tctx.moveTo(px(tx[n]), py(ty[n])); tctx.lineTo(px(nx), py(ny)); tctx.stroke();
        }
        tx[n] = nx; ty[n] = ny;
      }
      ctx.drawImage(trails, 0, 0, W, H);
    }
    drawFans();
    kick();
  }
  function arrow(x, y, dx, dy, len, col) {
    const n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
    const x2 = px(x + ux * len), y2 = py(y + uy * len);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px(x), py(y)); ctx.lineTo(x2, y2); ctx.stroke();
    const a = Math.atan2(-(uy), ux); ctx.beginPath();
    ctx.moveTo(x2, y2); ctx.lineTo(x2 - 8 * Math.cos(a - 0.5), y2 + 8 * Math.sin(a - 0.5)); ctx.lineTo(x2 - 8 * Math.cos(a + 0.5), y2 + 8 * Math.sin(a + 0.5)); ctx.closePath(); ctx.fill();
  }
  function drawFans() {
    const a = plan.ac;
    ctx.fillStyle = state.acSpeed > 0 ? '#f2e6d3' : '#5a4c40';
    ctx.fillRect(px(a.centre_x - a.width / 2), py(a.wall_y) - 1, a.width * S, Math.max(4, 0.23 * S));
    ctx.font = `600 ${Math.max(9, Math.round(S * 0.22))}px JetBrains Mono, monospace`; ctx.textAlign = 'center'; ctx.fillStyle = '#f2e6d3';
    ctx.fillText('AC', px(a.centre_x), py(a.wall_y) + Math.max(14, 0.55 * S));
    for (const f of fans()) {
      ctx.beginPath(); ctx.arc(px(f.x), py(f.y), Math.max(6, 0.17 * S), 0, Math.PI * 2);
      ctx.fillStyle = '#ff7a1a'; ctx.fill();
      arrow(f.x, f.y, f.dir[0], f.dir[1], 0.75, '#ffd166');
    }
    if (drag) arrow(drag.x, drag.y, drag.dx, drag.dy, 0.75, '#ffd166');
  }

  // ---------- room readouts ----------
  const roomsEl = $('.hair-rooms');
  roomsEl.innerHTML = ROOMS_SHOWN.map((r) => `<div data-room="${r}">${r}<b>0.00 m/s</b><i style="width:0"></i></div>`).join('');
  function rooms(rs) {
    for (const el of roomsEl.children) {
      const v = rs[el.dataset.room] ?? 0;
      el.querySelector('b').textContent = `${v.toFixed(2)} m/s`;
      el.querySelector('i').style.width = `${Math.min(100, v * 100)}%`;
    }
  }

  // ---------- controls ----------
  const presetBtns = [...fig.querySelectorAll('.hair-presets button')];
  function setPreset(p) {
    state.preset = p;
    presetBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === p)));
    fig.classList.toggle('placing', p === 'custom');
    send(true); resetTracers();
  }
  presetBtns.forEach((b) => b.addEventListener('click', () => { start(); setPreset(b.dataset.preset); }));
  const out = (k, v) => { $(`[data-o="${k}"]`).textContent = v; };
  const bind = (k, fn) => $(`[data-i="${k}"]`).addEventListener('input', (e) => { fn(e.target); send(false); });
  bind('ac', (el) => { state.acSpeed = +el.value; out('ac', state.acSpeed ? `${state.acSpeed.toFixed(1)} m/s` : 'off'); });
  bind('louvre', (el) => { state.louvre = +el.value; out('louvre', `${state.louvre > 0 ? '+' : ''}${state.louvre}°`); });
  bind('fan', (el) => { state.fanSpeed = +el.value; out('fan', `${state.fanSpeed.toFixed(1)} m/s`); });
  $('[data-i="doors"]').addEventListener('change', (e) => { state.doorsOpen = e.target.checked; buildBase(); send(true); resetTracers(); });
  $('[data-i="furniture"]').addEventListener('change', (e) => { state.furniture = e.target.checked; buildBase(); send(true); resetTracers(); });
  $('[data-i="reset"]').addEventListener('click', () => { send(true); resetTracers(); });
  out('ac', `${state.acSpeed.toFixed(1)} m/s`); out('louvre', '0°'); out('fan', `${state.fanSpeed.toFixed(1)} m/s`);
  presetBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === state.preset)));

  // place-your-own: press where the fan stands, drag the way it points
  let drag = null;
  cv.addEventListener('pointerdown', (e) => {
    if (state.preset !== 'custom') return;
    const r = cv.getBoundingClientRect(); const x = mx(e.clientX - r.left), y = my(e.clientY - r.top);
    drag = { x, y, dx: 0, dy: -1 }; cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = cv.getBoundingClientRect(); const x = mx(e.clientX - r.left), y = my(e.clientY - r.top);
    if (Math.hypot(x - drag.x, y - drag.y) > 0.15) { drag.dx = x - drag.x; drag.dy = y - drag.y; }
  });
  cv.addEventListener('pointerup', () => {
    if (!drag) return;
    state.custom = [...state.custom.slice(-2), { x: drag.x, y: drag.y, dir: [drag.dx, drag.dy] }];
    drag = null; send(false);
  });

  // ---------- lifecycle ----------
  size();
  let resizeW = cv.clientWidth;
  addEventListener('resize', () => { if (cv.clientWidth !== resizeW) { resizeW = cv.clientWidth; size(); tctx.clearRect(0, 0, W, H); } });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    worker?.postMessage({ type: 'pause', paused: !visible });
    if (visible && !reduce) start();
    if (visible && worker) { last = performance.now(); kick(); }
  }, { rootMargin: '100px' }).observe(cv);
  ctx.drawImage(base, 0, 0, W, H); drawFans();
  if (reduce) { const b = $('.hair-start'); b.hidden = false; b.addEventListener('click', () => { visible = true; start(); }); }
}
