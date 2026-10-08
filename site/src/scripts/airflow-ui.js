// Main-thread side of the house airflow figure: drawing, tracers, controls. The solver runs in a worker; where it
// cannot run at a watchable speed the figure plays a recording instead (sim-recording.js).
import { createRecording, forceRecording } from './sim-recording.js';

export const airflowPresets = {
  ac: [],
  gap: [{ x: 9.4, y: 5.6, dir: [0, -1] }],          // in the living area, blowing through the gap east of the kitchen
  retreat: [{ x: 4.6, y: 7.4, dir: [-0.25, -1] }],  // at the dining edge, blowing down past the retreat
  hall: [{ x: 9.3, y: 4.2, dir: [-1, 0] }],          // in the hall itself, blowing west towards the bedrooms
};
const ROOMS_SHOWN = ['Dining', 'Living', 'Retreat', 'Hall', 'Bed 1', 'Bed 2', 'Bed 3', 'Bed 4', 'Media'];
const U_REF = 5; // m/s represented by the solver's lattice speed limit
// below this speed (x real time), measured over the first seconds, the recording is the better figure
const REC_RATE = 0.3, REC_AFTER_MS = 8000;

export function startHouseAirflow(fig, presets) {
  const plan = JSON.parse(fig.querySelector('.hair-plan').textContent);
  const cv = fig.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const $ = (s) => fig.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 700 || (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const state = {
    preset: fig.dataset.preset || 'gap', custom: [], sel: -1, acSpeed: 3.5, louvre: 0, fanSpeed: 4.5, doorsOpen: true, furniture: true,
    h: small ? 0.13 : 0.1,
  };
  const pad = 0.15, [ex0, ey0, ex1, ey1] = plan.extent;
  let W = 0, H = 0, dpr = 1, S = 1; // S: pixels per metre
  const px = (x) => (x - ex0 + pad) * S, py = (y) => (ey1 - y + pad) * S;
  const mx = (cx) => cx / S + ex0 - pad, my = (cy) => ey1 + pad - cy / S;

  // ---------- worker ----------
  let worker = null, grid = null, field = null, lastSim = 0, simRate = 0, lastMsgT = 0;
  const fans = () => (state.preset === 'custom' ? state.custom : presets[state.preset] || []).map((f) => ({ ...f, speed: state.fanSpeed }));
  const MAX_FANS = 4;
  const editable = () => (state.preset === 'custom' ? state.custom : (presets[state.preset] || []).map((f) => ({ x: f.x, y: f.y, dir: [...f.dir] })));
  const cfg = () => ({ h: state.h, doorsOpen: state.doorsOpen, furniture: state.furniture, uRef: U_REF, ac: { on: state.acSpeed > 0, speed: state.acSpeed, louvre: state.louvre }, fans: fans() });
  // anything that stops the simulation (no module workers, a crashed worker, a device too slow to produce a frame)
  // shows in the note rather than leaving a blank plan; the figure then offers a retry
  let watchdog = 0;
  const diag = () => `[${(navigator.userAgent.match(/(SamsungBrowser|Firefox|Chrome|Safari)\/[\d.]+/) || ['browser'])[0]}, ${navigator.hardwareConcurrency || '?'} cores, ${navigator.deviceMemory || '?'} GB]`;
  let live = false, firstFieldT = 0, firstSim = 0; // live: the reader asked for the live simulation over the recording
  function stop() {
    clearTimeout(watchdog);
    try { worker?.terminate(); } catch { /* already gone */ }
    worker = null; field = null; simRate = 0; lastMsgT = 0; firstFieldT = 0;
  }
  function fail(msg, err) {
    console.error('airflow:', msg, err);
    stop();
    if (!live) { rec.show(state.preset, `${msg.replace(/[.:]\s*$/, '')} ${diag()}`); return; }
    const n = $('.hair-note'); n.hidden = false; n.textContent = `${msg} ${diag()}`;
    const b = $('.hair-start'); b.textContent = 'Try again'; b.hidden = false;
  }
  function start() {
    if (worker || rec.active) return;
    try { worker = new Worker(new URL('./airflow-worker.js', import.meta.url), { type: 'module' }); }
    catch (err) { fail('This browser could not start the simulation (module web workers are needed).', err); return; }
    worker.onerror = (e) => { e.preventDefault?.(); fail('The simulation worker could not load or crashed.', e.message || e); };
    worker.onmessageerror = (e) => fail('The simulation worker sent data this browser could not read.', e);
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'error') fail(`The simulation stopped: ${m.message}.`, m.stack);
      else if (m.type === 'grid') { grid = m; field = null; buildBase(); resetTracers(); lastSim = 0; }
      else if (m.type === 'field') {
        const now = performance.now();
        clearTimeout(watchdog);
        if (lastMsgT && m.simTime > lastSim && now - lastMsgT > 4) simRate = simRate * 0.8 + 0.2 * ((m.simTime - lastSim) / ((now - lastMsgT) / 1000));
        lastMsgT = now; lastSim = m.simTime; field = m;
        if (!firstFieldT || m.simTime < firstSim) { firstFieldT = now; firstSim = m.simTime; }
        const avgRate = (m.simTime - firstSim) / ((now - firstFieldT) / 1000);
        if (!live && now - firstFieldT > REC_AFTER_MS && avgRate < REC_RATE) {
          stop();
          rec.show(state.preset, `this browser runs it at ${avgRate.toFixed(2)}× real time, too slow to watch. Firefox does this with its JavaScript JIT switched off, a common privacy setting`);
          return;
        }
        $('[data-o="clock"]').textContent = `${m.simTime.toFixed(1)} s simulated`;
        $('[data-o="rate"]').textContent = `${simRate.toFixed(1)}x real time`;
        rooms(m.rooms);
      }
    };
    worker.postMessage({ type: 'init', plan, cfg: cfg() });
    $('.hair-start').hidden = true;
    clearTimeout(watchdog);
    watchdog = setTimeout(() => { if (!field && worker) fail('The simulation has not produced anything after 12 seconds: this device may be too slow, or its browser blocks web workers.'); }, 12000);
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
    fans().forEach((f, i) => {
      const on = state.preset === 'custom' && i === state.sel, r = Math.max(6, 0.17 * S);
      ctx.beginPath(); ctx.arc(px(f.x), py(f.y), r, 0, Math.PI * 2);
      ctx.fillStyle = '#ff7a1a'; ctx.fill();
      if (on) { ctx.strokeStyle = '#f2e6d3'; ctx.lineWidth = 2; ctx.stroke(); }
      arrow(f.x, f.y, f.dir[0], f.dir[1], 0.75, '#ffd166');
      if (on) { const h = handle(f); ctx.beginPath(); ctx.arc(h[0], h[1], 5, 0, Math.PI * 2); ctx.fillStyle = '#120d0a'; ctx.fill(); ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.stroke(); }
    });
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
    rec.preset(p);
    presetBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === p)));
    fig.classList.toggle('placing', p === 'custom');
    send(true); resetTracers();
  }
  presetBtns.forEach((b) => b.addEventListener('click', () => { start(); state.sel = -1; setPreset(b.dataset.preset); syncFanUi(); }));
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

  // fans are edited in place: press a fan to select and drag it to move it, drag the ring at the tip of its arrow to
  // aim it. Touching a preset's fan copies the preset into 'custom' first, so the scene stays what you were looking at.
  const handle = (f) => { const n = Math.hypot(f.dir[0], f.dir[1]) || 1; return [px(f.x + (f.dir[0] / n) * 0.75), py(f.y + (f.dir[1] / n) * 0.75)]; };
  const toCustom = () => { if (state.preset === 'custom') return; state.custom = editable(); state.preset = 'custom'; presetBtns.forEach((b) => b.setAttribute('aria-pressed', 'false')); fig.classList.add('placing'); };
  const syncFanUi = () => {
    const n = editable().length, hasSel = state.preset === 'custom' && state.sel >= 0;
    $('[data-i="addfan"]').disabled = n >= MAX_FANS;
    $('[data-i="rmfan"]').disabled = !hasSel;
    $('[data-i="clearfans"]').disabled = n === 0;
    $('[data-o="fancount"]').textContent = n ? `${n} fan${n > 1 ? 's' : ''}` : 'no fans';
  };
  function addFan() {
    start(); toCustom();
    if (state.custom.length >= MAX_FANS) return;
    let x = 9.4, y = 5.6;
    for (let t = 0; t < 8 && state.custom.some((f) => Math.hypot(f.x - x, f.y - y) < 0.7); t++) { x -= 0.9; if (x < ex0 + 1) { x = 9.4; y -= 0.9; } }
    state.custom.push({ x, y, dir: [0, -1] }); state.sel = state.custom.length - 1;
    send(false); syncFanUi();
  }
  function removeFan() {
    if (state.preset !== 'custom' || state.sel < 0) return;
    state.custom.splice(state.sel, 1); state.sel = Math.min(state.sel, state.custom.length - 1);
    send(false); syncFanUi();
  }
  $('[data-i="addfan"]').addEventListener('click', addFan);
  $('[data-i="rmfan"]').addEventListener('click', removeFan);
  $('[data-i="clearfans"]').addEventListener('click', () => { start(); state.custom = []; state.sel = -1; toCustom(); send(true); resetTracers(); syncFanUi(); });
  fig.tabIndex = -1;
  fig.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel >= 0 && !/INPUT|BUTTON/.test(e.target.tagName)) { e.preventDefault(); removeFan(); } });

  let drag = null;
  const hit = (cx, cy) => {
    const list = fans();
    for (let i = list.length - 1; i >= 0; i--) { // aim handle first (only on the selected fan), then the fan body
      if (state.preset === 'custom' && i === state.sel) { const h = handle(list[i]); if (Math.hypot(cx - h[0], cy - h[1]) < 16) return { i, aim: true }; }
    }
    for (let i = list.length - 1; i >= 0; i--) if (Math.hypot(cx - px(list[i].x), cy - py(list[i].y)) < Math.max(16, 0.17 * S + 8)) return { i, aim: false };
    return null;
  };
  const clampX = (x) => Math.min(ex1 - 0.2, Math.max(ex0 + 0.2, x)), clampY = (y) => Math.min(ey1 - 0.2, Math.max(ey0 + 0.2, y));
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top, h = hit(cx, cy);
    if (!h) { if (state.preset === 'custom' && state.sel >= 0) { state.sel = -1; syncFanUi(); } return; }
    start(); toCustom();
    state.sel = h.i; syncFanUi();
    const f = state.custom[h.i];
    drag = { i: h.i, aim: h.aim, ox: f.x - mx(cx), oy: f.y - my(cy), moved: false };
    cv.setPointerCapture(e.pointerId); e.preventDefault();
  });
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top;
    if (!drag) { cv.style.cursor = hit(cx, cy) ? 'grab' : ''; return; }
    const f = state.custom[drag.i]; if (!f) return;
    drag.moved = true; cv.style.cursor = 'grabbing';
    if (drag.aim) { const dx = mx(cx) - f.x, dy = my(cy) - f.y; if (Math.hypot(dx, dy) > 0.15) f.dir = [dx, dy]; }
    else { f.x = clampX(mx(cx) + drag.ox); f.y = clampY(my(cy) + drag.oy); }
  });
  const drop = () => { if (!drag) return; const moved = drag.moved; drag = null; cv.style.cursor = ''; if (moved) send(false); };
  cv.addEventListener('pointerup', drop);
  cv.addEventListener('pointercancel', drop);

  // ---------- full screen (Fullscreen API, or a fixed-position fallback where it is missing, e.g. iPhone Safari) ----------
  const fsBtn = $('[data-i="fullscreen"]');
  const isFull = () => document.fullscreenElement === fig || fig.classList.contains('is-full');
  function setFull(on) {
    if (on === isFull()) return;
    if (on) {
      if (fig.requestFullscreen) fig.requestFullscreen().catch(() => { fig.classList.add('is-full'); document.documentElement.classList.add('fig-full'); });
      else { fig.classList.add('is-full'); document.documentElement.classList.add('fig-full'); }
    } else if (document.fullscreenElement === fig) document.exitFullscreen();
    else { fig.classList.remove('is-full'); document.documentElement.classList.remove('fig-full'); }
    relayout();
  }
  const relayout = () => requestAnimationFrame(() => requestAnimationFrame(() => { fsBtn.textContent = isFull() ? 'Exit full screen' : 'Full screen'; fsBtn.setAttribute('aria-pressed', String(isFull())); if (cv.clientWidth !== resizeW) { resizeW = cv.clientWidth; size(); tctx.clearRect(0, 0, W, H); } }));
  fsBtn.addEventListener('click', () => setFull(!isFull()));
  document.addEventListener('fullscreenchange', relayout);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && fig.classList.contains('is-full')) setFull(false); });

  // ---------- lifecycle ----------
  let resizeW = cv.clientWidth;
  size();
  addEventListener('resize', relayout);
  syncFanUi();
  // run only while the figure is on screen and the tab is in front (a phone in a pocket should not keep solving)
  let inView = false;
  function syncRun() {
    visible = inView && !document.hidden;
    rec.visible(visible);
    firstFieldT = 0; // time spent paused off screen is not slowness
    worker?.postMessage({ type: 'pause', paused: !visible });
    if (visible && !reduce) start();
    if (visible && worker) { last = performance.now(); kick(); }
  }
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; syncRun(); }, { rootMargin: '100px' }).observe(cv);
  document.addEventListener('visibilitychange', syncRun);
  ctx.drawImage(base, 0, 0, W, H); drawFans();
  const rec = createRecording({
    fig, name: 'hair', slots: [{ slot: 'plan', canvas: cv }], presets: Object.keys(presets), note: $('.hair-note'),
    fill: (d) => { roomsEl.innerHTML = d.rooms; },
    onLive: () => { live = true; start(); },
  });
  if (forceRecording()) rec.show(state.preset, 'asked for in the address');
  const startBtn = $('.hair-start');
  startBtn.addEventListener('click', () => { visible = true; $('.hair-note').hidden = true; start(); });
  if (reduce) startBtn.hidden = false;
}
