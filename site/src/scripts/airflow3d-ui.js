// Main-thread side of the 3D house airflow figure: plan slice, vertical section, streaks, controls, room read-outs.
// The solver (airflow3d.js) runs in airflow3d-worker.js.
import { PRESETS3D } from './airflow3d.js';

const ROOMS_SHOWN = ['Bed 1', 'Bed 2', 'Bed 3', 'Bed 4', 'Media', 'Hall', 'Living', 'Dining'];
const SLOT_AREA = 0.3 / 3.5;  // m^2: 300 L/s leaves the louvre at 3.5 m/s
const SPEED_MAX = 1.5;        // m/s at full heat colour
const AC_MAX = 0.5;           // AC-air share at full colour
const SECTION_LEN = { default: 6.3, Media: 4.9 };

export function startHouseAirflow3D(fig) {
  const house = JSON.parse(fig.querySelector('.h3d-house').textContent);
  const $ = (s) => fig.querySelector(s);
  const cv = $('.h3d-plan'), ctx = cv.getContext('2d');
  const sv = $('.h3d-sec'), sctx = sv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 700 || (navigator.hardwareConcurrency || 4) <= 4;
  const sectionDoors = house.doors.filter((d) => /^(Bed \d Door|Media)$/.test(d.name)).map((d) => ({ ...d, label: d.name.replace(' Door', '') }));
  const state = {
    preset: fig.dataset.preset || 'hall', custom: [], fanSpeed: 4.5, fanZ: 0.9, fanTilt: 0,
    acFlow: 0.3, louvre: 15, doorsOpen: true, cold: true, z: 1.2, colour: 'speed', door: 'Bed 2',
    layers: small ? 10 : 12,
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
    layers: state.layers, doorsOpen: state.doorsOpen, furniture: true, dT: state.cold ? 8 : 0,
    ac: { on: state.acFlow > 0, flow: state.acFlow, speed: state.acFlow / SLOT_AREA, louvre: state.louvre },
    fans: fanList(), sliceZ: state.z, section: { axis: 'x', at: secAt() },
  });
  function start() {
    if (worker) return;
    worker = new Worker(new URL('./airflow3d-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'grid') { grid = m; field = null; lastSim = 0; lastMsgT = 0; resetTracers(); out('grid', `${m.NX}×${m.NY}×${m.NZ} cells, ${(m.h * 100).toFixed(0)} cm`); }
      else if (m.type === 'field') {
        const now = performance.now();
        if (lastMsgT && m.simTime > lastSim) simRate = simRate * 0.85 + 0.15 * ((m.simTime - lastSim) / ((now - lastMsgT) / 1000));
        if (m.simTime < lastSim) simRate = 0;
        lastMsgT = now; lastSim = m.simTime; field = m;
        out('clock', `${m.simTime.toFixed(1)} s simulated`);
        out('rate', simRate ? `${simRate.toFixed(2)}× real time` : '');
        readouts(m);
      }
    };
    worker.postMessage({ type: 'init', house, cfg: cfg() });
    $('.h3d-start').hidden = true;
    kick();
  }
  const send = (reset = false) => worker?.postMessage({ type: 'config', cfg: cfg(), reset });

  // ---------- plan: static layer ----------
  const base = document.createElement('canvas'), bctx = base.getContext('2d');
  const trails = document.createElement('canvas'), tctx = trails.getContext('2d');
  const heat = document.createElement('canvas'), hctx = heat.getContext('2d');
  const sbase = document.createElement('canvas'), sbctx = sbase.getContext('2d');
  const strails = document.createElement('canvas'), stctx = strails.getContext('2d');
  const sheat = document.createElement('canvas'), shctx = sheat.getContext('2d');
  // section geometry: y along the canvas, z up
  let SW = 0, SH = 0, SS = 1;
  const secLen = () => SECTION_LEN[state.door] ?? SECTION_LEN.default;
  const spx = (y) => (y + 0.1) * SS, spz = (z) => SH - (z + 0.12) * SS;

  function size() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = cv.clientWidth; S = W / (ex1 - ex0 + 2 * pad); H = Math.round((ey1 - ey0 + 2 * pad) * S);
    for (const c of [cv, base, trails]) { c.width = W * dpr; c.height = H * dpr; }
    for (const c of [ctx, bctx, tctx]) c.setTransform(dpr, 0, 0, dpr, 0, 0);
    SW = sv.clientWidth; SS = SW / (secLen() + 0.2); SH = Math.round((CEIL + 0.24) * SS);
    sv.style.height = `${SH}px`;
    for (const c of [sv, sbase, strails]) { c.width = SW * dpr; c.height = SH * dpr; }
    for (const c of [sctx, sbctx, stctx]) c.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    const rect = (b, fill) => { sbctx.fillStyle = fill; sbctx.fillRect(spx(b[1]), spz(b[5]), Math.max(1.5, (Math.min(L, b[4]) - b[1]) * SS), (b[5] - b[2]) * SS); };
    for (const o of [...house.joinery, ...house.furniture]) if (cut(o.b)) rect(o.b, 'rgba(242,230,211,.42)');
    for (const s of house.solids) if (cut(s.b)) rect(s.b, s.c === 'window' ? '#5e8fb8' : '#b9a68f');
    if (!state.doorsOpen) for (const d of house.doors) if (d.closable && cut(d.b)) rect([d.b[0], d.b[1], 0.012, d.b[3], d.b[4], d.head_z], '#7a6a58');
    // floor and ceiling
    sbctx.fillStyle = '#b9a68f'; sbctx.fillRect(0, spz(0), SW, 2); sbctx.fillRect(0, spz(CEIL) - 2, SW, 2);
    // labels: room names along the floor, door head height
    sbctx.font = `${Math.max(9, Math.round(SS * 0.2))}px JetBrains Mono, monospace`; sbctx.textAlign = 'center'; sbctx.fillStyle = 'rgba(185,166,143,.7)';
    let last = null, y0 = 0;
    for (let y = 0; y <= L + step; y += step) {
      const r = house.rooms.find((q) => inPoly(x, y, q.poly))?.name ?? null;
      if (r !== last) { if (last && y - y0 > 0.8) sbctx.fillText(last.toUpperCase(), spx((y0 + y) / 2), spz(0) - 6); last = r; y0 = y; }
    }
    const d = door();
    sbctx.textAlign = 'left'; sbctx.fillStyle = 'rgba(255,122,26,.85)';
    sbctx.fillText(`door head ${d.head_z.toFixed(2)} m`, spx(d.b[4]) + 6, spz(d.head_z) + 4);
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
    ctx.clearRect(0, 0, W, H); ctx.drawImage(base, 0, 0, W, H);
    sctx.clearRect(0, 0, SW, SH); sctx.drawImage(sbase, 0, 0, SW, SH);
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
      sctx.drawImage(sbase, 0, 0, SW, SH, 0, 0, SW, SH); // redraw solids on top so blurred heat stays inside the rooms
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
    for (const f of fanList()) {
      const yaw = (f.yaw * Math.PI) / 180, near = Math.abs(f.z - state.z) < 0.35;
      ctx.beginPath(); ctx.arc(px(f.x), py(f.y), Math.max(6, 0.15 * S), 0, Math.PI * 2);
      ctx.fillStyle = near ? '#ff7a1a' : 'rgba(255,122,26,.55)'; ctx.fill();
      arrow(ctx, px(f.x), py(f.y), px(f.x + Math.cos(yaw) * 0.75), py(f.y + Math.sin(yaw) * 0.75), '#ffd166');
    }
    if (drag) arrow(ctx, px(drag.x), py(drag.y), px(drag.x + drag.dx), py(drag.y + drag.dy), '#ffd166');
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
    sctx.font = `500 ${Math.max(10, Math.round(SS * 0.2))}px JetBrains Mono, monospace`; sctx.textAlign = 'left'; sctx.fillStyle = '#f2e6d3';
    const txt = d.closed ? `door shut: ${d.inLs.toFixed(1)} L/s under it` : `door: ${d.inLs.toFixed(0)} L/s in (${d.upperInLs.toFixed(0)} high, ${d.lowerInLs.toFixed(0)} low)`;
    sctx.fillText(txt, spx(0.15), spz(CEIL) + Math.max(14, SS * 0.28));
  }

  // ---------- read-outs ----------
  const roomsEl = $('.h3d-rooms');
  roomsEl.innerHTML = ROOMS_SHOWN.map((r) => `<div data-room="${r}">${r}<b data-k="ac">0% AC air</b><span data-k="sp">0.00 m/s</span><i class="ac" style="width:0"></i><i class="sp" style="width:0"></i></div>`).join('');
  function readouts(m) {
    for (const el of roomsEl.children) {
      const r = m.rooms[el.dataset.room]; if (!r) continue;
      const d = m.doors.find((q) => q.room === el.dataset.room && /^Bed|^Media/.test(q.name));
      el.querySelector('[data-k="ac"]').textContent = `${(100 * r.ac).toFixed(r.ac < 0.1 ? 1 : 0)}% AC air`;
      el.querySelector('[data-k="sp"]').textContent = `${r.speed.toFixed(2)} m/s` + (d ? ` · door ${d.inLs.toFixed(0)} L/s` : '');
      el.querySelector('i.ac').style.width = `${Math.min(100, (100 * r.ac) / AC_MAX)}%`;
      el.querySelector('i.sp').style.width = `${Math.min(100, (r.speed / 0.5) * 100)}%`;
    }
  }

  // ---------- controls ----------
  const out = (k, v) => { const el = $(`[data-o="${k}"]`); if (el) el.textContent = v; };
  const pressed = (sel, attr, v) => fig.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === v)));
  function setPreset(p) {
    state.preset = p;
    pressed('.h3d-presets button', 'preset', p);
    fig.classList.toggle('placing', p === 'custom');
    send(true); resetTracers();
  }
  fig.querySelectorAll('.h3d-presets button').forEach((b) => b.addEventListener('click', () => {
    start();
    if (b.dataset.preset === 'custom' && state.preset === 'custom') state.custom = []; // press again to clear
    setPreset(b.dataset.preset);
  }));
  fig.querySelectorAll('.h3d-colour button').forEach((b) => b.addEventListener('click', () => { state.colour = b.dataset.colour; pressed('.h3d-colour button', 'colour', state.colour); $('.h3d-legend').dataset.mode = state.colour; }));
  const doorsEl = $('.h3d-doors');
  doorsEl.innerHTML = sectionDoors.map((d) => `<button type="button" data-door="${d.label}">${d.label}</button>`).join('');
  doorsEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.door = b.dataset.door; pressed('.h3d-doors button', 'door', state.door); size(); send(false); stctx.clearRect(0, 0, SW, SH); for (let n = 0; n < NS; n++) spawnS(n); }));
  const bind = (k, fn, reset = false) => $(`[data-i="${k}"]`).addEventListener('input', (e) => { fn(+e.target.value); send(reset); });
  const fmtLouvre = (v) => (v === 0 ? 'level' : v > 0 ? `${v}° down` : `${-v}° up`);
  bind('z', (v) => { state.z = v; out('z', `${v.toFixed(1)} m`); buildBase(); tctx.clearRect(0, 0, W, H); for (let n = 0; n < NT; n++) spawn(n); });
  bind('ac', (v) => { state.acFlow = v / 1000; out('ac', v ? `${v} L/s` : 'off'); });
  bind('louvre', (v) => { state.louvre = v; out('louvre', fmtLouvre(v)); });
  bind('fan', (v) => { state.fanSpeed = v; out('fan', `${v.toFixed(1)} m/s`); });
  bind('fanz', (v) => { state.fanZ = v; out('fanz', `${v.toFixed(1)} m`); });
  bind('tilt', (v) => { state.fanTilt = v; out('tilt', v === 0 ? 'level' : v > 0 ? `${v}° up` : `${-v}° down`); });
  $('[data-i="doors"]').addEventListener('change', (e) => { state.doorsOpen = e.target.checked; buildBase(); buildSecBase(); send(true); resetTracers(); });
  $('[data-i="cold"]').addEventListener('change', (e) => { state.cold = e.target.checked; send(false); });
  $('[data-i="reset"]').addEventListener('click', () => { send(true); resetTracers(); });
  out('z', `${state.z.toFixed(1)} m`); out('ac', `${Math.round(state.acFlow * 1000)} L/s`); out('louvre', fmtLouvre(state.louvre));
  out('fan', `${state.fanSpeed.toFixed(1)} m/s`); out('fanz', `${state.fanZ.toFixed(1)} m`); out('tilt', 'level');
  pressed('.h3d-presets button', 'preset', state.preset); pressed('.h3d-colour button', 'colour', state.colour); pressed('.h3d-doors button', 'door', state.door);
  fig.classList.toggle('placing', state.preset === 'custom');

  // place your own: press where the fan stands, drag the way it points (up to 3 fans)
  let drag = null;
  cv.addEventListener('pointerdown', (e) => {
    if (state.preset !== 'custom') return;
    const r = cv.getBoundingClientRect();
    drag = { x: mx(e.clientX - r.left), y: my(e.clientY - r.top), dx: 0, dy: -0.75 };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = cv.getBoundingClientRect(), x = mx(e.clientX - r.left), y = my(e.clientY - r.top);
    if (Math.hypot(x - drag.x, y - drag.y) > 0.15) { drag.dx = x - drag.x; drag.dy = y - drag.y; }
  });
  const drop = () => {
    if (!drag) return;
    state.custom = [...state.custom.slice(-2), { x: drag.x, y: drag.y, z: state.fanZ, yaw: (Math.atan2(drag.dy, drag.dx) * 180) / Math.PI }];
    drag = null; start(); send(false);
  };
  cv.addEventListener('pointerup', drop);
  cv.addEventListener('pointercancel', () => { drag = null; });

  // ---------- lifecycle ----------
  size();
  let resizeW = cv.clientWidth;
  addEventListener('resize', () => { if (cv.clientWidth !== resizeW) { resizeW = cv.clientWidth; size(); tctx.clearRect(0, 0, W, H); stctx.clearRect(0, 0, SW, SH); } });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    worker?.postMessage({ type: 'pause', paused: !visible });
    if (visible && !reduce) start();
    if (visible) { last = performance.now(); kick(); }
  }, { rootMargin: '100px' }).observe(fig);
  ctx.drawImage(base, 0, 0, W, H); sctx.drawImage(sbase, 0, 0, SW, SH); drawFans();
  if (reduce) { const b = $('.h3d-start'); b.hidden = false; b.addEventListener('click', () => { visible = true; start(); }); }
}

function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
