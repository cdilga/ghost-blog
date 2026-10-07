// Main-thread side of the 3D house airflow figure: plan slice, vertical section, streaks, the 3D volume view
// (airflow3d-volume.js), fan editing, full screen, controls and room read-outs. The solver (airflow3d.js) runs in
// airflow3d-worker.js.
import { PRESETS3D } from './airflow3d.js';
import { createVolumeView } from './airflow3d-volume.js';

const ROOMS_SHOWN = ['Bed 1', 'Bed 2', 'Bed 3', 'Bed 4', 'Media', 'Hall', 'Living', 'Dining'];
const SLOT_AREA = 0.3 / 3.5;  // m^2: 300 L/s leaves the louvre at 3.5 m/s
const SPEED_MAX = 1.5;        // m/s at full heat colour
const AC_MAX = 0.5;           // AC-air share at full colour
const SECTION_LEN = { default: 6.3, Media: 4.9 };
const MAX_FANS = 4, HIT_PX = 14;
// cooling carried by a flow of AC air: rho (1.2 kg/m^3) x cp (1005 J/kg/K) x the supply air's 8 K, per L/s
const W_PER_LS = 1.2 * 1005 * 8 / 1000;
const MIN_LAYERS = 8, MIN_RATE = 1;  // the coarsest grid we will drop to, and the speed (x real time) below which we do
// where Add fan puts a new fan: in the hall, blowing into a bedroom (the first spot not already taken)
const SPOTS = [{ x: 7.36, y: 4.2, yaw: -90 }, { x: 14.17, y: 4.1, yaw: -90 }, { x: 3.7, y: 4.2, yaw: -90 }, { x: 9.4, y: 5.6, yaw: -90 }, { x: 16.7, y: 3.9, yaw: -90 }, { x: 12.4, y: 4.1, yaw: 180 }];

export function startHouseAirflow3D(fig) {
  const house = JSON.parse(fig.querySelector('.h3d-house').textContent);
  const $ = (s) => fig.querySelector(s);
  const cv = $('.h3d-plan'), ctx = cv.getContext('2d');
  const sv = $('.h3d-sec'), sctx = sv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 700 || (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const sectionDoors = house.doors.filter((d) => /^(Bed \d Door|Media)$/.test(d.name)).map((d) => ({ ...d, label: d.name.replace(' Door', '') }));
  const state = {
    preset: fig.dataset.preset || 'hall', custom: [], fanSpeed: 4.5, fanZ: 0.9, fanTilt: 0,
    acFlow: 0.3, louvre: 15, doorsOpen: true, cold: true, z: 1.2, colour: 'speed', door: 'Bed 2',
    layers: small ? 10 : 12, view: 'slices', thr: 0.16, den: 1.4, cut: 1,
    decayMin: 10, lapse: small ? 4 : 8,
  };
  const pad = 0.15, [ex0, ey0, ex1, ey1] = house.extent, CEIL = house.ceiling_z;
  let W = 0, H = 0, S = 1, dpr = 1;
  const px = (x) => (x - ex0 + pad) * S, py = (y) => (ey1 - y + pad) * S;
  const mx = (cx) => cx / S + ex0 - pad, my = (cy) => ey1 + pad - cy / S;

  // ---------- worker ----------
  let worker = null, grid = null, field = null, lastSim = 0, lastMsgT = 0, simRate = 0;
  const fanList = () => (state.preset === 'custom' ? state.custom : PRESETS3D[state.preset]?.fans || [])
    .map((f) => ({ ...f, z: state.preset === 'custom' ? state.fanZ : f.z, pitch: state.fanTilt, speed: state.fanSpeed, d: 0.25 }));
  const door = () => sectionDoors.find((d) => d.label === state.door) || sectionDoors[0];
  const secAt = () => { const d = door().b; return (d[0] + d[3]) / 2; };
  const cfg = () => ({
    layers: state.layers, doorsOpen: state.doorsOpen, furniture: true, dT: state.cold ? 8 : 0, decay: state.decayMin * 60, lapse: state.lapse,
    ac: { on: state.acFlow > 0, flow: state.acFlow, speed: state.acFlow / SLOT_AREA, louvre: state.louvre },
    fans: fanList(), sliceZ: state.z, section: { axis: 'x', at: secAt() },
  });
  // Anything that stops the simulation (no module workers, a crashed or out-of-memory worker, a device too slow to
  // produce a frame) shows here rather than leaving a blank plan; the figure then offers a retry
  let watchdog = 0, gridAt = 0, nanResets = 0, slowNoted = false;
  const diag = () => {
    const ua = (navigator.userAgent.match(/(SamsungBrowser|Firefox|Chrome|Safari)\/[\d.]+/) || ['browser'])[0];
    return `[${ua}, ${navigator.hardwareConcurrency || '?'} cores, ${navigator.deviceMemory || '?'} GB, ${grid ? `${grid.NX}x${grid.NY}x${grid.NZ} cells` : 'no grid yet'}]`;
  };
  function fail(msg, err) {
    console.error('airflow3d:', msg, err);
    clearTimeout(watchdog);
    try { worker?.terminate(); } catch { /* already gone */ }
    worker = null; field = null;
    showNote(`${msg} ${diag()}`);
    const b = $('.h3d-start'); b.textContent = 'Try again'; b.hidden = false;
  }
  function start() {
    if (worker) return;
    try { worker = new Worker(new URL('./airflow3d-worker.js', import.meta.url), { type: 'module' }); }
    catch (err) { fail('This browser could not start the simulation (module web workers are needed).', err); return; }
    worker.onerror = (e) => { e.preventDefault?.(); fail('The simulation worker could not load or crashed.', e.message || e); };
    worker.onmessageerror = (e) => fail('The simulation worker sent data this browser could not read.', e);
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'error') fail(`The simulation stopped: ${m.message}.`, m.stack);
      else if (m.type === 'grid') { grid = m; gridAt = performance.now(); field = null; lastSim = 0; lastMsgT = 0; buildBase(); buildSecBase(); resetTracers(); vol?.setGrid(m); out('grid', `${m.NX}×${m.NY}×${m.NZ} cells, ${(m.h * 100).toFixed(0)} cm`); }
      else if (m.type === 'volume') vol?.setData(m.sc, m.vel);
      else if (m.type === 'field') {
        const now = performance.now();
        clearTimeout(watchdog);
        if (lastMsgT && m.simTime > lastSim && now - lastMsgT > 4) simRate = simRate * 0.85 + 0.15 * ((m.simTime - lastSim) / ((now - lastMsgT) / 1000));
        if (m.simTime < lastSim) { simRate = 0; smooth.clear(); }
        if (!lastMsgT || now - lastMsgT > 4 || m.simTime < lastSim) { lastMsgT = now; lastSim = m.simTime; } field = m;
        out('clock', `${m.simTime.toFixed(1)} s simulated`);
        out('rate', simRate ? `${simRate.toFixed(2)}× real time` : '');
        out('acclk', `AC air clock ${(m.scalarTime / 60).toFixed(0)} min`);
        readouts(m);
        if (m.nan && nanResets++ < 2) { send(true); resetTracers(); } // the solver blew up (a slow device can take a long step): restart it
        else adapt(m, now);
      }
    };
    worker.postMessage({ type: 'init', house, cfg: cfg() });
    if (state.view === 'volume') worker.postMessage({ type: 'volume', on: true });
    $('.h3d-start').hidden = true;
    clearTimeout(watchdog);
    watchdog = setTimeout(() => { if (!field && worker) fail('The simulation has not produced anything after 12 seconds: this device may be too slow, or its browser blocks web workers.'); }, 12000);
    kick();
  }
  // Keep up with real time or give up detail: a phone that manages less than MIN_RATE x real time gets a coarser grid
  // (down to MIN_LAYERS). The AC-air time-lapse stays as it is: it is the cheap part, and it is what makes the figure settle
  function adapt(m, now) {
    if (!m.msPerStep || now - gridAt < 3000) return;
    const rate = m.dt / (m.msPerStep / 1000);
    if (rate >= MIN_RATE) return;
    if (state.layers > MIN_LAYERS) {
      state.layers = Math.max(MIN_LAYERS, state.layers - 2);
      showNote(`This device runs the simulation at ${rate.toFixed(1)}× real time, so it now uses a coarser grid (${(100 * CEIL / state.layers).toFixed(0)} cm cells). The pattern is the same, with less fine detail.`);
      send(true); gridAt = now; return;
    }
    if (!slowNoted) { slowNoted = true; showNote(`This device runs the simulation at ${rate.toFixed(1)}× real time: it works, but the AC air takes a while to settle.`); }
  }
  const send = (reset = false) => worker?.postMessage({ type: 'config', cfg: cfg(), reset });

  // ---------- plan: static layer ----------
  const base = document.createElement('canvas'), bctx = base.getContext('2d');
  const trails = document.createElement('canvas'), tctx = trails.getContext('2d');
  const heat = document.createElement('canvas'), hctx = heat.getContext('2d');
  const sbase = document.createElement('canvas'), sbctx = sbase.getContext('2d');
  const ssol = document.createElement('canvas'), ssctx = ssol.getContext('2d'); // solids and labels, drawn over the heat
  const strails = document.createElement('canvas'), stctx = strails.getContext('2d');
  const sheat = document.createElement('canvas'), shctx = sheat.getContext('2d');
  // section geometry: y along the canvas, z up
  let SW = 0, SH = 0, SS = 1;
  const secLen = () => SECTION_LEN[state.door] ?? SECTION_LEN.default;
  const spx = (y) => (y + 0.1) * SS, spz = (z) => SH - (z + 0.12) * SS;

  function size() {
    layout();
    if (state.view === 'volume') { vol?.resize(); return; }
    if (!cv.clientWidth) return;
    dpr = Math.min(2, devicePixelRatio || 1);
    W = cv.clientWidth; S = W / (ex1 - ex0 + 2 * pad); H = Math.round((ey1 - ey0 + 2 * pad) * S);
    for (const c of [cv, base, trails]) { c.width = W * dpr; c.height = H * dpr; }
    for (const c of [ctx, bctx, tctx]) c.setTransform(dpr, 0, 0, dpr, 0, 0);
    SW = sv.clientWidth; SS = SW / (secLen() + 0.2); SH = Math.round((CEIL + 0.24) * SS);
    sv.style.height = `${SH}px`;
    for (const c of [sv, sbase, ssol, strails]) { c.width = SW * dpr; c.height = SH * dpr; }
    for (const c of [sctx, sbctx, ssctx, stctx]) c.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildBase(); buildSecBase();
  }
  const inZ = (b, z) => b[2] <= z && z <= b[5];
  function buildBase() {
    const z = state.z;
    bctx.clearRect(0, 0, W, H);
    bctx.fillStyle = '#0b0806'; bctx.fillRect(0, 0, W, H);
    for (const r of house.rooms) {
      bctx.beginPath(); r.poly.forEach(([x, y], i) => (i ? bctx.lineTo(px(x), py(y)) : bctx.moveTo(px(x), py(y)))); bctx.closePath();
      bctx.fillStyle = '#17110d'; bctx.fill();
    }
    const rect = (b, fill) => { bctx.fillStyle = fill; bctx.fillRect(px(b[0]), py(b[4]), Math.max(1.2, (b[3] - b[0]) * S), Math.max(1.2, (b[4] - b[1]) * S)); };
    // furniture and joinery: cut by the plane = solid, below it = a faint footprint
    for (const o of [...house.joinery, ...house.furniture]) rect(o.b, inZ(o.b, z) ? 'rgba(242,230,211,.42)' : o.b[5] < z ? 'rgba(242,230,211,.08)' : 'rgba(242,230,211,.03)');
    for (const s of house.solids) if (inZ(s.b, z) || (s.c !== 'window' && s.b[2] <= 0.01 && s.b[5] >= CEIL - 0.01)) rect(s.b, s.c === 'window' ? '#5e8fb8' : '#b9a68f');
    if (!state.doorsOpen) for (const d of house.doors) if (d.closable && z < d.head_z) rect(d.b, '#7a6a58');
    // AC head
    if (house.ac) rect(house.ac.b, inZ(house.ac.b, z) ? '#f2e6d3' : 'rgba(242,230,211,.35)');
    bctx.font = `${Math.max(9, Math.round(S * 0.24))}px JetBrains Mono, monospace`; bctx.textAlign = 'center'; bctx.fillStyle = 'rgba(185,166,143,.55)';
    for (const r of house.rooms) {
      if (/WIP|WC|WIR|Ensuite|Laundry|Entry/.test(r.name) || r.k === 'space.hall.west') continue;
      const cx = r.poly.reduce((a, p) => a + p[0], 0) / r.poly.length, cy = r.poly.reduce((a, p) => a + p[1], 0) / r.poly.length;
      bctx.fillText(r.name.toUpperCase(), px(cx), py(cy) + (r.name === 'Dining' ? S * 0.9 : r.name === 'Hall' ? S * 0.25 : 0));
    }
    // the section line
    const x = secAt();
    bctx.setLineDash([5, 4]); bctx.strokeStyle = 'rgba(255,122,26,.75)'; bctx.lineWidth = 1.2;
    bctx.beginPath(); bctx.moveTo(px(x), py(0)); bctx.lineTo(px(x), py(secLen())); bctx.stroke(); bctx.setLineDash([]);
    bctx.fillStyle = '#ff7a1a'; bctx.textAlign = 'left'; bctx.font = `600 ${Math.max(9, Math.round(S * 0.2))}px JetBrains Mono, monospace`;
    bctx.fillText('SECTION', px(x) + 4, py(secLen()) + 10);
    if (grid) { heat.width = grid.NX; heat.height = grid.NY; heatImg = hctx.createImageData(grid.NX, grid.NY); }
  }
  let heatImg = null, sheatImg = null;

  // section: geometry boxes cut by the plane x = secAt()
  function buildSecBase() {
    const x = secAt(), L = secLen();
    sbctx.clearRect(0, 0, SW, SH);
    sbctx.fillStyle = '#0b0806'; sbctx.fillRect(0, 0, SW, SH);
    // fluid: where the line is inside a room
    const step = 0.02;
    sbctx.fillStyle = '#17110d';
    for (let y = 0; y < L; y += step) if (house.rooms.some((r) => inPoly(x, y + step / 2, r.poly))) sbctx.fillRect(spx(y), spz(CEIL), step * SS + 0.6, CEIL * SS);
    const cut = (b) => b[0] <= x && x <= b[3] && b[1] < L;
    ssctx.clearRect(0, 0, SW, SH);
    const rect = (b, fill) => { ssctx.fillStyle = fill; ssctx.fillRect(spx(b[1]), spz(b[5]), Math.max(1.5, (Math.min(L, b[4]) - b[1]) * SS), (b[5] - b[2]) * SS); };
    for (const o of [...house.joinery, ...house.furniture]) if (cut(o.b)) rect(o.b, 'rgba(242,230,211,.42)');
    for (const s of house.solids) if (cut(s.b)) rect(s.b, s.c === 'window' ? '#5e8fb8' : '#b9a68f');
    if (!state.doorsOpen) for (const d of house.doors) if (d.closable && cut(d.b)) rect([d.b[0], d.b[1], 0.012, d.b[3], d.b[4], d.head_z], '#7a6a58');
    // floor and ceiling
    ssctx.fillStyle = '#b9a68f'; ssctx.fillRect(0, spz(0), SW, 2); ssctx.fillRect(0, spz(CEIL) - 2, SW, 2);
    // labels: room names along the floor, door head height
    ssctx.font = `${Math.min(12, Math.max(9, Math.round(SS * 0.11)))}px JetBrains Mono, monospace`; ssctx.textAlign = 'center'; ssctx.fillStyle = 'rgba(185,166,143,.8)';
    let last = null, y0 = 0;
    for (let y = 0; y <= L + step; y += step) {
      const r = house.rooms.find((q) => inPoly(x, y, q.poly))?.name ?? null;
      if (r !== last) { if (last && y - y0 > 0.8) ssctx.fillText(last.toUpperCase(), spx((y0 + y) / 2), spz(0) - 6); last = r; y0 = y; }
    }
    const d = door();
    ssctx.textAlign = 'left'; ssctx.fillStyle = 'rgba(255,122,26,.9)';
    ssctx.fillRect(spx(d.b[1]) - 3, spz(d.head_z), (d.b[4] - d.b[1]) * SS + 6, 1);
    ssctx.fillText(`door head ${d.head_z.toFixed(2)} m`, spx(d.b[4]) + 6, spz(d.head_z) - 4);
    if (grid) { sheat.width = grid.NY; sheat.height = grid.NZ; sheatImg = shctx.createImageData(grid.NY, grid.NZ); }
  }

  // ---------- field lookups ----------
  function velPlan(x, y) {
    if (!grid || !field) return [0, 0, true];
    const { NX, NY, h, extent } = grid, { ux, uy } = field.slice;
    const fi = (x - extent[0]) / h + 0.5, fj = (y - extent[1]) / h + 0.5;
    const i = Math.floor(fi), j = Math.floor(fj);
    if (i < 0 || j < 0 || i >= NX - 1 || j >= NY - 1) return [0, 0, true];
    const l = field.slice.layer, ks = Math.round(fj - 0.5) * NX + Math.round(fi - 0.5);
    if (grid.solid[ks + l * NX * NY]) return [0, 0, true];
    const k = j * NX + i, a = fi - i, b = fj - j;
    return [
      (1 - a) * (1 - b) * ux[k] + a * (1 - b) * ux[k + 1] + (1 - a) * b * ux[k + NX] + a * b * ux[k + NX + 1],
      (1 - a) * (1 - b) * uy[k] + a * (1 - b) * uy[k + 1] + (1 - a) * b * uy[k + NX] + a * b * uy[k + NX + 1], false,
    ];
  }
  function velSec(y, z) {
    if (!grid || !field) return [0, 0, true];
    const { NZ, h, extent } = grid, { u, w, solid, n } = field.section;
    const fi = (y - extent[1]) / h + 0.5, fl = z / h + 0.5;
    const i = Math.floor(fi), l = Math.floor(fl);
    if (i < 0 || l < 0 || i >= n - 1 || l >= NZ - 1) return [0, 0, true];
    if (solid[Math.round(fl - 0.5) * n + Math.round(fi - 0.5)]) return [0, 0, true];
    const k = l * n + i, a = fi - i, b = fl - l;
    return [
      (1 - a) * (1 - b) * u[k] + a * (1 - b) * u[k + 1] + (1 - a) * b * u[k + n] + a * b * u[k + n + 1],
      (1 - a) * (1 - b) * w[k] + a * (1 - b) * w[k + 1] + (1 - a) * b * w[k + n] + a * b * w[k + n + 1], false,
    ];
  }

  // ---------- tracers (streaks) ----------
  const NT = small ? 500 : 1000, NS = small ? 160 : 320;
  const tx = new Float32Array(NT), ty = new Float32Array(NT), tage = new Float32Array(NT);
  const sy = new Float32Array(NS), sz = new Float32Array(NS), sage = new Float32Array(NS);
  function spawn(n) {
    for (let tries = 0; tries < 40; tries++) {
      const fs = [{ x: house.ac.centre_x, y: house.ac.b[1] - 0.5 }, ...fanList()];
      let x, y;
      if (Math.random() < 0.4) { const f = fs[(Math.random() * fs.length) | 0]; x = f.x + (Math.random() - 0.5) * 1.2; y = f.y + (Math.random() - 0.5) * 1.2; }
      else { x = ex0 + Math.random() * (ex1 - ex0); y = ey0 + Math.random() * (ey1 - ey0); }
      if (!velPlan(x, y)[2]) { tx[n] = x; ty[n] = y; tage[n] = 1 + Math.random() * 3; return; }
    }
    tage[n] = 0.2;
  }
  function spawnS(n) {
    for (let tries = 0; tries < 30; tries++) {
      const y = Math.random() * secLen(), z = Math.random() * CEIL;
      if (!velSec(y, z)[2]) { sy[n] = y; sz[n] = z; sage[n] = 1 + Math.random() * 3; return; }
    }
    sage[n] = 0.2;
  }
  function resetTracers() { for (let n = 0; n < NT; n++) spawn(n); for (let n = 0; n < NS; n++) spawnS(n); tctx.clearRect(0, 0, W, H); stctx.clearRect(0, 0, SW, SH); }

  // ---------- colour ----------
  function paint(d, o, sp, c) {
    if (state.colour === 'ac') {
      const s = Math.min(1, c / AC_MAX);
      d[o] = 40 + 200 * s * s; d[o + 1] = 120 + 110 * s; d[o + 2] = 200 + 55 * s; d[o + 3] = 255 * Math.min(0.88, s * 1.1);
    } else {
      const s = Math.min(1, sp / SPEED_MAX);
      d[o] = 255 * Math.min(1, s * 1.7); d[o + 1] = 120 * s + 135 * s * s * s; d[o + 2] = 30 + 200 * Math.pow(s, 4); d[o + 3] = 255 * Math.min(0.85, s * 1.4);
    }
  }

  // ---------- frame ----------
  let last = performance.now(), visible = false, raf = 0;
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  function frame(now) {
    raf = 0;
    const dtReal = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible) return;
    const dtSim = dtReal * Math.max(0.25, simRate || 1);
    if (state.view === 'volume') {
      if (vol) vol.frame(field ? dtSim : 0, fanList(), state.preset === 'custom' ? sel : -1);
      kick(); return;
    }
    ctx.clearRect(0, 0, W, H); ctx.drawImage(base, 0, 0, W, H);
    sctx.clearRect(0, 0, SW, SH); sctx.drawImage(sbase, 0, 0, SW, SH);
    if (!field) sctx.drawImage(ssol, 0, 0, SW, SH);
    if (field && grid && heatImg && sheatImg) {
      // plan heat
      const { NX, NY, NZ, h, extent } = grid, d = heatImg.data, sl = field.slice, L = sl.layer * NX * NY;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i, o = ((NY - 1 - j) * NX + i) * 4;
        if (grid.solid[k + L]) { d[o + 3] = 0; continue; }
        paint(d, o, Math.hypot(sl.ux[k], sl.uy[k], sl.uz[k]), sl.c[k]);
      }
      hctx.putImageData(heatImg, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(heat, px(extent[0] - h), py(extent[1] + (NY - 1) * h), NX * h * S, NY * h * S);
      // plan streaks
      tctx.globalCompositeOperation = 'destination-out'; tctx.fillStyle = 'rgba(0,0,0,0.14)'; tctx.fillRect(0, 0, W, H);
      tctx.globalCompositeOperation = 'source-over'; tctx.lineWidth = 1.2;
      for (let n = 0; n < NT; n++) {
        const [u, v, sol] = velPlan(tx[n], ty[n]); const sp = Math.hypot(u, v);
        tage[n] -= dtSim;
        if (sol || tage[n] < 0 || (sp < 0.02 && Math.random() < 0.03)) { spawn(n); continue; }
        const nx = tx[n] + u * dtSim, ny = ty[n] + v * dtSim;
        if (sp > 0.03) {
          tctx.strokeStyle = state.colour === 'ac' ? `rgba(235,245,255,${Math.min(0.85, 0.25 + sp)})` : `rgba(255,${Math.round(150 + Math.min(1, sp) * 100)},${Math.round(90 + Math.min(1, sp) * 150)},${Math.min(0.9, 0.25 + sp)})`;
          tctx.beginPath(); tctx.moveTo(px(tx[n]), py(ty[n])); tctx.lineTo(px(nx), py(ny)); tctx.stroke();
        }
        tx[n] = nx; ty[n] = ny;
      }
      ctx.drawImage(trails, 0, 0, W, H);
      // section heat
      const sc = field.section, n = sc.n, sd = sheatImg.data;
      for (let l = 0; l < NZ; l++) for (let i = 0; i < n; i++) {
        const k = l * n + i, o = ((NZ - 1 - l) * n + i) * 4;
        if (sc.solid[k]) { sd[o + 3] = 0; continue; }
        paint(sd, o, Math.hypot(sc.u[k], sc.w[k]), sc.c[k]);
      }
      shctx.putImageData(sheatImg, 0, 0);
      sctx.save();
      sctx.beginPath(); sctx.rect(spx(0), spz(CEIL), secLen() * SS, CEIL * SS); sctx.clip();
      sctx.imageSmoothingEnabled = true;
      // cell i spans y0 + (i-1)h .. y0 + ih; layer l spans (l-1)h .. lh
      sctx.drawImage(sheat, spx(extent[1] - h), spz((NZ - 1) * h), n * h * SS, NZ * h * SS);
      sctx.restore();
      sctx.drawImage(ssol, 0, 0, SW, SH); // solids over the heat, so the smoothed heat stays inside the rooms
      stctx.globalCompositeOperation = 'destination-out'; stctx.fillStyle = 'rgba(0,0,0,0.16)'; stctx.fillRect(0, 0, SW, SH);
      stctx.globalCompositeOperation = 'source-over'; stctx.lineWidth = 1.2;
      for (let m = 0; m < NS; m++) {
        const [u, w, sol] = velSec(sy[m], sz[m]); const sp = Math.hypot(u, w);
        sage[m] -= dtSim;
        if (sol || sage[m] < 0 || sy[m] < 0 || sy[m] > secLen() || (sp < 0.02 && Math.random() < 0.03)) { spawnS(m); continue; }
        const ny = sy[m] + u * dtSim, nz = sz[m] + w * dtSim;
        if (sp > 0.03) {
          stctx.strokeStyle = state.colour === 'ac' ? `rgba(235,245,255,${Math.min(0.85, 0.3 + sp)})` : `rgba(255,${Math.round(150 + Math.min(1, sp) * 100)},${Math.round(90 + Math.min(1, sp) * 150)},${Math.min(0.9, 0.3 + sp)})`;
          stctx.beginPath(); stctx.moveTo(spx(sy[m]), spz(sz[m])); stctx.lineTo(spx(ny), spz(nz)); stctx.stroke();
        }
        sy[m] = ny; sz[m] = nz;
      }
      sctx.drawImage(strails, 0, 0, SW, SH);
      drawSecDoor();
    }
    drawFans();
    kick();
  }
  function arrow(c, x1, y1, x2, y2, col) {
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - 8 * Math.cos(a - 0.5), y2 - 8 * Math.sin(a - 0.5)); c.lineTo(x2 - 8 * Math.cos(a + 0.5), y2 - 8 * Math.sin(a + 0.5)); c.closePath(); c.fill();
  }
  function drawFans() {
    const a = house.ac;
    ctx.font = `600 ${Math.max(9, Math.round(S * 0.22))}px JetBrains Mono, monospace`; ctx.textAlign = 'center'; ctx.fillStyle = state.acFlow > 0 ? '#f2e6d3' : '#5a4c40';
    ctx.fillText('AC', px(a.centre_x), py(a.b[1]) + Math.max(14, 0.45 * S));
    fanList().forEach((f, i) => {
      const near = Math.abs(f.z - state.z) < 0.35, p = fanPx(f), on = state.preset === 'custom' && i === sel;
      if (on) { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(6, 0.15 * S) + 5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,209,102,.18)'; ctx.fill(); ctx.strokeStyle = '#f2e6d3'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(6, 0.15 * S), 0, Math.PI * 2);
      ctx.fillStyle = near ? '#ff7a1a' : 'rgba(255,122,26,.55)'; ctx.fill();
      arrow(ctx, p.x, p.y, p.tx, p.ty, '#ffd166');
      // aim handle at the arrow tip
      ctx.beginPath(); ctx.arc(p.tx, p.ty, on ? 5.5 : 4, 0, Math.PI * 2); ctx.fillStyle = on ? '#f2e6d3' : '#ffd166'; ctx.fill();
      ctx.strokeStyle = '#0b0806'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    // fans that sit on the section line (within 0.4 m)
    const x = secAt();
    for (const f of fanList()) if (Math.abs(f.x - x) < 0.4 && f.y < secLen()) {
      const yaw = (f.yaw * Math.PI) / 180, pit = (f.pitch * Math.PI) / 180, dy = Math.sin(yaw) * Math.cos(pit), dz = Math.sin(pit);
      sctx.beginPath(); sctx.arc(spx(f.y), spz(f.z), Math.max(5, 0.12 * SS), 0, Math.PI * 2); sctx.fillStyle = '#ff7a1a'; sctx.fill();
      if (Math.hypot(dy, dz) > 0.2) arrow(sctx, spx(f.y), spz(f.z), spx(f.y + dy * 0.6), spz(f.z + dz * 0.6), '#ffd166');
    }
  }
  function drawSecDoor() {
    const d = field.doors.find((q) => q.name === door().label.replace(' Door', '')) || field.doors.find((q) => q.room === door().joins[0]);
    if (!d) return;
    sctx.font = `500 ${Math.min(12, Math.max(10, Math.round(SS * 0.11)))}px JetBrains Mono, monospace`; sctx.textAlign = 'left'; sctx.fillStyle = '#f2e6d3';
    const txt = d.closed ? `door shut: ${d.inLs.toFixed(1)} L/s under it` : `door: ${d.inLs.toFixed(0)} L/s in (${d.upperInLs.toFixed(0)} high, ${d.lowerInLs.toFixed(0)} low)`;
    sctx.fillText(txt, spx(0.15), spz(CEIL) + Math.max(14, SS * 0.28));
  }

  // ---------- read-outs ----------
  const roomsEl = $('.h3d-rooms');
  roomsEl.innerHTML = ROOMS_SHOWN.map((r) => `<div data-room="${r}">${r}<b data-k="ac">0% AC air</b><span data-k="sp">0.00 m/s</span><em data-k="cool"></em><i class="ac" style="width:0"></i><i class="sp" style="width:0"></i></div>`).join('');
  // read-outs are smoothed (about 2.5 s) so the doorway flows, which are gusty, can be read
  const smooth = new Map();
  let lastRd = 0;
  const sm = (k, v, a) => { const o = smooth.get(k), n = o === undefined ? v : o + (v - o) * a; smooth.set(k, n); return n; };
  function readouts(m) {
    const now = performance.now(), a = lastRd ? 1 - Math.exp(-(now - lastRd) / 2500) : 1;
    lastRd = now;
    let bedW = 0, beds = 0;
    for (const el of roomsEl.children) {
      const name = el.dataset.room, r = m.rooms[name]; if (!r) continue;
      const d = m.doors.find((q) => q.room === name && /^Bed|^Media/.test(q.name));
      const ac = sm(`ac:${name}`, r.ac, a);
      el.querySelector('[data-k="ac"]').textContent = `${(100 * ac).toFixed(ac < 0.1 ? 1 : 0)}% AC air`;
      el.querySelector('[data-k="sp"]').textContent = `${r.speed.toFixed(2)} m/s` + (d ? ` · door ${sm(`in:${name}`, d.inLs, a).toFixed(0)} L/s` : '');
      // cool air delivered through the door: the doorway's flow into the room, weighted by its AC-air share
      const cool = el.querySelector('[data-k="cool"]');
      if (d) { const w = sm(`w:${name}`, d.acInLs, a) * W_PER_LS; bedW += w; beds++; cool.textContent = `≈ ${Math.round(w / 10) * 10} W of cooling`; }
      else cool.textContent = '';
      el.querySelector('i.ac').style.width = `${Math.min(100, (100 * ac) / AC_MAX)}%`;
      el.querySelector('i.sp').style.width = `${Math.min(100, (r.speed / 0.5) * 100)}%`;
    }
    const acW = state.acFlow * 1000 * W_PER_LS;
    out('deliv', !acW ? 'AC is off' : beds ? `Bedrooms get ≈ ${(bedW / 1000).toFixed(1)} kW of the AC's ${(acW / 1000).toFixed(1)} kW (${Math.round((100 * bedW) / acW)}%)` : '');
    const settle = $('[data-o="settle"]');
    settle.textContent = m.settled ? 'AC air: steady' : 'AC air: settling';
    settle.dataset.settled = String(!!m.settled);
  }

  // ---------- controls ----------
  const out = (k, v) => { const el = $(`[data-o="${k}"]`); if (el) el.textContent = v; };
  const pressed = (sel, attr, v) => fig.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === v)));
  function setPreset(p) {
    state.preset = p;
    if (p !== 'custom') sel = -1;
    pressed('.h3d-presets button', 'preset', p);
    send(true); resetTracers(); fanUi();
  }
  fig.querySelectorAll('.h3d-presets button').forEach((b) => b.addEventListener('click', () => {
    start();
    if (b.dataset.preset === 'custom' && state.preset !== 'custom' && !state.custom.length) state.custom = copyPreset(); // start from the scene on show
    setPreset(b.dataset.preset);
  }));
  fig.querySelectorAll('.h3d-colour button').forEach((b) => b.addEventListener('click', () => { state.colour = b.dataset.colour; pressed('.h3d-colour button', 'colour', state.colour); $('.h3d-legend').dataset.mode = state.colour; volOpts(); }));
  const doorsEl = $('.h3d-doors');
  doorsEl.innerHTML = sectionDoors.map((d) => `<button type="button" data-door="${d.label}">${d.label}</button>`).join('');
  doorsEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.door = b.dataset.door; pressed('.h3d-doors button', 'door', state.door); size(); send(false); stctx.clearRect(0, 0, SW, SH); for (let n = 0; n < NS; n++) spawnS(n); }));
  const bind = (k, fn, reset = false) => $(`[data-i="${k}"]`).addEventListener('input', (e) => { fn(+e.target.value); send(reset); });
  const fmtLouvre = (v) => (v === 0 ? 'level' : v > 0 ? `${v}° down` : `${-v}° up`);
  bind('z', (v) => { state.z = v; out('z', `${v.toFixed(1)} m`); buildBase(); tctx.clearRect(0, 0, W, H); for (let n = 0; n < NT; n++) spawn(n); });
  bind('ac', (v) => { state.acFlow = v / 1000; out('ac', v ? `${v} L/s` : 'off'); volOpts(); });
  bind('decay', (v) => { state.decayMin = v; out('decay', v ? `${v} min` : 'never'); });
  bind('louvre', (v) => { state.louvre = v; out('louvre', fmtLouvre(v)); });
  bind('fan', (v) => { state.fanSpeed = v; out('fan', `${v.toFixed(1)} m/s`); });
  bind('fanz', (v) => { state.fanZ = v; out('fanz', `${v.toFixed(1)} m`); });
  bind('tilt', (v) => { state.fanTilt = v; out('tilt', v === 0 ? 'level' : v > 0 ? `${v}° up` : `${-v}° down`); });
  bind('thr', (v) => { state.thr = v; volOpts(); });
  bind('den', (v) => { state.den = v; volOpts(); });
  bind('cut', (v) => { state.cut = v; volOpts(); });
  $('[data-i="doors"]').addEventListener('change', (e) => { state.doorsOpen = e.target.checked; buildBase(); buildSecBase(); send(true); resetTracers(); volOpts(); });
  $('[data-i="cold"]').addEventListener('change', (e) => { state.cold = e.target.checked; send(false); });
  $('[data-i="reset"]').addEventListener('click', () => { send(true); resetTracers(); });
  out('z', `${state.z.toFixed(1)} m`); out('ac', `${Math.round(state.acFlow * 1000)} L/s`); out('louvre', fmtLouvre(state.louvre)); out('decay', `${state.decayMin} min`);
  out('fan', `${state.fanSpeed.toFixed(1)} m/s`); out('fanz', `${state.fanZ.toFixed(1)} m`); out('tilt', 'level');
  pressed('.h3d-presets button', 'preset', state.preset); pressed('.h3d-colour button', 'colour', state.colour); pressed('.h3d-doors button', 'door', state.door);

  // ---------- fans: click to select, drag to move, drag the arrow tip to aim; a preset becomes your own layout ----------
  let sel = -1, grab = null, lastSend = 0;
  const arrowLen = () => Math.max(0.75, 30 / S); // m: the aim handle stays clear of the fan body at phone width
  function fanPx(f) {
    const yaw = (f.yaw * Math.PI) / 180, L = arrowLen();
    return { x: px(f.x), y: py(f.y), tx: px(f.x + Math.cos(yaw) * L), ty: py(f.y + Math.sin(yaw) * L) };
  }
  function hitFan(cx, cy) {
    let best = null;
    fanList().forEach((f, i) => {
      const p = fanPx(f), db = Math.hypot(cx - p.x, cy - p.y), dt = Math.hypot(cx - p.tx, cy - p.ty);
      if (dt <= HIT_PX && (!best || dt < best.d)) best = { i, mode: 'aim', d: dt };
      if (db <= Math.max(HIT_PX, 0.15 * S + 4) && (!best || db < best.d)) best = { i, mode: 'move', d: db };
    });
    return best;
  }
  const copyPreset = () => (PRESETS3D[state.preset]?.fans || []).map((f) => ({ x: f.x, y: f.y, z: f.z, yaw: f.yaw }));
  function toCustom() {
    if (state.preset === 'custom') return;
    state.custom = copyPreset();
    setPreset('custom');
  }
  const hintEl = $('.h3d-fanhint');
  function fanUi() {
    const n = fanList().length, custom = state.preset === 'custom';
    $('[data-fan="add"]').disabled = custom && n >= MAX_FANS;
    $('[data-fan="remove"]').disabled = !(custom && sel >= 0);
    $('[data-fan="clear"]').disabled = n === 0;
    hintEl.textContent = state.view === 'volume' ? 'switch to slices to move fans'
      : custom && sel >= 0 ? `fan ${sel + 1} of ${n} selected: drag to move, drag the dot to aim`
      : n ? 'drag a fan to move it, drag the dot on its arrow to aim it' : '';
  }
  function addFan() {
    start(); toCustom();
    if (state.custom.length >= MAX_FANS) return;
    const spot = SPOTS.find((p) => !state.custom.some((f) => Math.hypot(f.x - p.x, f.y - p.y) < 0.8)) || SPOTS[0];
    state.custom.push({ x: spot.x, y: spot.y, z: state.fanZ, yaw: spot.yaw });
    sel = state.custom.length - 1; send(false); fanUi();
  }
  function removeFan() {
    if (state.preset !== 'custom' || sel < 0) return;
    state.custom.splice(sel, 1); sel = -1; send(false); fanUi();
  }
  $('[data-fan="add"]').addEventListener('click', addFan);
  $('[data-fan="remove"]').addEventListener('click', removeFan);
  $('[data-fan="clear"]').addEventListener('click', () => { start(); toCustom(); state.custom = []; sel = -1; send(false); fanUi(); });
  const at = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => {
    const [cx, cy] = at(e), hit = hitFan(cx, cy);
    if (!hit) { if (sel >= 0) { sel = -1; fanUi(); } return; }
    e.preventDefault();
    start(); toCustom();
    sel = hit.i;
    const f = state.custom[sel];
    grab = { mode: hit.mode, ox: mx(cx) - f.x, oy: my(cy) - f.y };
    cv.setPointerCapture(e.pointerId); cv.focus({ preventScroll: true }); cv.style.cursor = hit.mode === 'move' ? 'grabbing' : 'crosshair';
    fanUi();
  });
  cv.addEventListener('pointermove', (e) => {
    const [cx, cy] = at(e);
    if (!grab) { const h = hitFan(cx, cy); cv.style.cursor = h ? (h.mode === 'aim' ? 'crosshair' : 'grab') : ''; return; }
    const f = state.custom[sel]; if (!f) return;
    const x = mx(cx), y = my(cy);
    if (grab.mode === 'move') { f.x = Math.min(ex1 - 0.1, Math.max(ex0 + 0.1, x - grab.ox)); f.y = Math.min(ey1 - 0.1, Math.max(ey0 + 0.1, y - grab.oy)); }
    else if (Math.hypot(x - f.x, y - f.y) > 0.1) f.yaw = Math.round((Math.atan2(y - f.y, x - f.x) * 180) / Math.PI);
    // live update while dragging, a few times a second (the solver rebuilds the fan's disc each time)
    const now = performance.now();
    if (now - lastSend > 150) { lastSend = now; send(false); }
  });
  const drop = () => { if (!grab) return; grab = null; cv.style.cursor = ''; send(false); fanUi(); };
  cv.addEventListener('pointerup', drop);
  cv.addEventListener('pointercancel', drop);
  // touch: a press on a fan must not start a page scroll (the plan otherwise scrolls the page vertically)
  cv.addEventListener('touchstart', (e) => {
    const t = e.touches[0], r = cv.getBoundingClientRect();
    if (e.touches.length === 1 && hitFan(t.clientX - r.left, t.clientY - r.top)) e.preventDefault();
  }, { passive: false });
  // keys: Delete removes the selected fan; on the plan, arrows move it (shift + arrows turn it)
  fig.addEventListener('keydown', (e) => {
    if (state.preset !== 'custom' || sel < 0 || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const f = state.custom[sel];
    if (e.key === 'Delete' || e.key === 'Backspace') removeFan();
    else if (e.target === cv && e.key.startsWith('Arrow')) {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (e.shiftKey) f.yaw += (d[0] || -d[1]) * -15;
      else { f.x = Math.min(ex1 - 0.1, Math.max(ex0 + 0.1, f.x + d[0] * 0.1)); f.y = Math.min(ey1 - 0.1, Math.max(ey0 + 0.1, f.y + d[1] * 0.1)); }
      send(false);
    } else if (e.key === 'Escape' && !fig.classList.contains('h3d-full')) { sel = -1; fanUi(); }
    else return;
    e.preventDefault();
  });

  // ---------- view: slices or the 3D volume ----------
  const vcv = $('.h3d-vol'), note = $('.h3d-note');
  function showNote(t) { note.hidden = false; note.textContent = t; }
  let vol = null, volTried = false;
  function ensureVol() {
    if (volTried) return vol;
    volTried = true;
    try { vol = createVolumeView({ canvas: vcv, labels: $('.h3d-vlab'), house, small }); } catch (err) { console.warn(err); vol = null; }
    if (!vol) {
      showNote('This browser has no WebGL2, so the 3D volume view is not available here: showing the slices.');
      $('[data-view="volume"]').disabled = true;
      return null;
    }
    vcv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setView('slices'); showNote('The 3D view lost its graphics context: showing the slices.'); });
    if (grid) vol.setGrid(grid);
    volOpts();
    return vol;
  }
  function volOpts() {
    out('thr', state.colour === 'ac' ? `${Math.round(state.thr * AC_MAX * 100)}% AC air` : `${(state.thr * SPEED_MAX).toFixed(2)} m/s`);
    out('den', `${state.den.toFixed(1)}`);
    out('cut', state.cut >= 2.59 ? 'full height' : `${state.cut.toFixed(1)} m`);
    vol?.setOptions({ mode: state.colour, thr: state.thr, den: state.den, cut: state.cut, doorsOpen: state.doorsOpen, acOn: state.acFlow > 0 });
  }
  function setView(v) {
    if (v === 'volume' && !ensureVol()) v = 'slices';
    state.view = v; fig.dataset.view = v;
    pressed('.h3d-viewbar [data-view]', 'view', v);
    worker?.postMessage({ type: 'volume', on: v === 'volume' });
    if (v === 'volume' && !reduce) start();
    fanUi(); refit(true);
  }
  fig.querySelectorAll('.h3d-viewbar [data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  pressed('.h3d-viewbar [data-view]', 'view', state.view);
  volOpts();

  // orbit: drag to turn, wheel or pinch to zoom (the wheel only zooms in full screen or once the view has focus,
  // so it does not hijack the page scroll)
  const ptrs = new Map();
  let pinch0 = 0;
  vcv.addEventListener('pointerdown', (e) => { ptrs.set(e.pointerId, [e.clientX, e.clientY]); vcv.setPointerCapture(e.pointerId); vcv.focus({ preventScroll: true }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  vcv.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId); if (!p || !vol) return;
    if (ptrs.size === 1) vol.orbit(-(e.clientX - p[0]) * 0.008, (e.clientY - p[1]) * 0.006);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) vol.zoom(pinch0 / d); pinch0 = d; }
  });
  const lift = (e) => { ptrs.delete(e.pointerId); pinch0 = 0; };
  vcv.addEventListener('pointerup', lift); vcv.addEventListener('pointercancel', lift);
  vcv.addEventListener('wheel', (e) => {
    if (!vol || !(fig.classList.contains('h3d-full') || document.activeElement === vcv)) return;
    e.preventDefault(); vol.zoom(Math.exp(Math.max(-1, Math.min(1, e.deltaY * (e.deltaMode ? 0.05 : 0.0015)))));
  }, { passive: false });
  vcv.addEventListener('keydown', (e) => {
    if (!vol) return;
    const k = { ArrowLeft: () => vol.orbit(0.1, 0), ArrowRight: () => vol.orbit(-0.1, 0), ArrowUp: () => vol.orbit(0, 0.08), ArrowDown: () => vol.orbit(0, -0.08), '+': () => vol.zoom(0.9), '=': () => vol.zoom(0.9), '-': () => vol.zoom(1.1) }[e.key];
    if (k) { k(); e.preventDefault(); }
  });
  fig.querySelectorAll('[data-orbit]').forEach((b) => b.addEventListener('click', () => { if (!vol) return; const o = b.dataset.orbit; if (o === 'home') vol.resetView(); else vol.zoom(o === 'in' ? 0.85 : 1.18); }));

  // ---------- full screen: the Fullscreen API on the figure, else a fixed overlay (iPhone Safari); Esc leaves ----------
  const fsBtn = $('.h3d-fs'), main = $('.h3d-main'), side = $('.h3d-side'), stage = $('.h3d-stage'), secw = $('.h3d-secwrap');
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  function setFull(on) {
    fig.classList.toggle('h3d-full', on);
    fsBtn.setAttribute('aria-pressed', String(on)); fsBtn.textContent = on ? 'Exit full screen' : 'Full screen';
    refit(true);
  }
  function leaveExpanded() { fig.classList.remove('h3d-expanded'); document.documentElement.style.overflow = ''; setFull(false); }
  fsBtn.addEventListener('click', async () => {
    if (fig.classList.contains('h3d-full')) {
      if (fsEl() === fig) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else leaveExpanded();
      return;
    }
    const req = fig.requestFullscreen || fig.webkitRequestFullscreen;
    // the prefixed API returns nothing, so wait for the change event (or a refusal) before falling back
    if (req && await new Promise((res) => {
      const evs = ['fullscreenchange', 'webkitfullscreenchange'];
      const done = (v) => { clearTimeout(t); evs.forEach((ev) => document.removeEventListener(ev, on)); res(v); };
      const on = () => done(fsEl() === fig), t = setTimeout(on, 700);
      evs.forEach((ev) => document.addEventListener(ev, on));
      try { req.call(fig)?.catch?.(() => done(false)); } catch { done(false); }
    })) return;
    fig.classList.add('h3d-expanded'); document.documentElement.style.overflow = 'hidden'; setFull(true);
  });
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => { if (!fig.classList.contains('h3d-expanded')) setFull(fsEl() === fig); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && fig.classList.contains('h3d-expanded') && !fsEl()) leaveExpanded(); });
  // in full screen the plan and section (or the 3D view) take the room left beside or above the controls
  function layout() {
    let w = '', vh = '';
    if (fig.classList.contains('h3d-full')) {
      const two = side.offsetLeft > main.offsetLeft + 20;
      const aw = main.clientWidth, ah = two ? main.clientHeight : Math.round(fig.clientHeight * 0.62);
      if (state.view === 'volume') vh = `${Math.max(220, ah)}px`;
      else {
        const pa = (ey1 - ey0 + 2 * pad) / (ex1 - ex0 + 2 * pad), sa = (CEIL + 0.24) / (secLen() + 0.2);
        w = `${Math.max(240, Math.floor(Math.min(aw, (ah - 44) / (pa + sa))))}px`;
      }
    }
    stage.style.width = secw.style.width = w;
    vcv.style.height = vh; vcv.style.aspectRatio = vh ? 'auto' : '';
  }

  // ---------- lifecycle ----------
  size();
  // re-fit on any size change (window, full screen, view switch); a change in the plan's width rebuilds the layers
  let fitKey = '', fitRaf = 0;
  function refit(force) {
    fitRaf = 0;
    const key = `${fig.clientWidth}x${fig.clientHeight}:${state.view}:${fig.classList.contains('h3d-full')}`;
    if (key === fitKey && !force) return;
    fitKey = key;
    const w0 = W; size();
    if (state.view === 'slices' && W !== w0) { tctx.clearRect(0, 0, W, H); stctx.clearRect(0, 0, SW, SH); }
    kick();
  }
  const queueFit = () => { if (!fitRaf) fitRaf = requestAnimationFrame(() => refit(false)); };
  if ('ResizeObserver' in window) new ResizeObserver(queueFit).observe(fig);
  addEventListener('resize', queueFit);
  // run only while the figure is on screen and the tab is in front (a phone in a pocket should not keep solving)
  let inView = false;
  function syncRun() {
    visible = inView && !document.hidden;
    worker?.postMessage({ type: 'pause', paused: !visible });
    if (visible && !reduce) start();
    if (visible) { last = performance.now(); kick(); }
  }
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; syncRun(); }, { rootMargin: '100px' }).observe(fig);
  document.addEventListener('visibilitychange', syncRun);
  ctx.drawImage(base, 0, 0, W, H); sctx.drawImage(sbase, 0, 0, SW, SH); sctx.drawImage(ssol, 0, 0, SW, SH); drawFans(); fanUi();
  const startBtn = $('.h3d-start');
  startBtn.addEventListener('click', () => { visible = true; note.hidden = true; nanResets = 0; start(); });
  if (reduce) startBtn.hidden = false;
}

function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
