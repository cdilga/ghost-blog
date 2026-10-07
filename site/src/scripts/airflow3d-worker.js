// Runs the 3D house airflow solver (airflow3d.js) off the main thread. Posts back a horizontal slice at the chosen
// height, a vertical section along the chosen line, and per-room speed and AC-air statistics; while the volume view is
// open, also the whole 3D speed, tracer and velocity fields every VOL_MS.
import { createSim3D } from './airflow3d.js';

let sim = null, house = null, cfg = null, running = true, failed = false, timer = 0;
const BUDGET_MS = 30; // solver time per tick; one post per tick
let msPerStep = 0;
// "settled": no room's AC-air share has moved by more than SETTLE_TOL over the last SETTLE_WINDOW s of tracer time, and
// the tracer has had at least SETTLE_MIN s since the last change to the fans, doors or AC
const SETTLE_WINDOW = 240, SETTLE_MIN = 300, SETTLE_TOL = 0.005;
let hist = [], settled = false, sinceChange = 0;
const VOL_MS = 250; // volume fields cadence (only while the volume view is open)
let vol = false, lastVol = 0;

function sources(c) {
  return {
    ac: { on: c.ac.on, flow: c.ac.flow, speed: c.ac.speed, louvre: c.ac.louvre },
    fans: (c.fans || []).map((f) => ({ x: f.x, y: f.y, z: f.z, d: f.d ?? 0.25, yaw: f.yaw, pitch: f.pitch || 0, speed: f.speed })),
  };
}

function configure(c, hard) {
  const rebuild = !sim || cfg.layers !== c.layers;
  if (rebuild) sim = createSim3D(house, { layers: c.layers, doorsOpen: c.doorsOpen, furniture: c.furniture, dT: c.dT, decay: c.decay, lapse: c.lapse });
  const geom = sim.setOptions({ doorsOpen: c.doorsOpen, furniture: c.furniture, dT: c.dT, decay: c.decay, lapse: c.lapse });
  cfg = c;
  sim.setSources(sources(c));
  if (hard && !geom && !rebuild) sim.reset();
  hist = []; settled = false; sinceChange = sim.stats().scalarTime;
  if (rebuild || geom || hard) {
    postMessage({ type: 'grid', NX: sim.NX, NY: sim.NY, NZ: sim.NZ, nz: sim.nz, h: sim.h, dt: sim.dt, extent: sim.extent, ceil: sim.ceil, nF: sim.nF, solid: sim.solid.slice() });
  }
  post();
  if (vol) postVol();
}

function postVol() {
  const v = sim.volume();
  lastVol = performance.now();
  postMessage({ type: 'volume', simTime: sim.time, sc: v.sc, vel: v.vel }, [v.sc.buffer, v.vel.buffer]);
}

function trackSettling(st) {
  if (st.scalarTime < sinceChange) { hist = []; sinceChange = 0; } // the solver was reset under us
  const last = hist[hist.length - 1];
  if (!last || st.scalarTime - last.t >= 10) {
    hist.push({ t: st.scalarTime, ac: Object.values(st.rooms).map((r) => r.ac) });
    while (hist.length > 2 && st.scalarTime - hist[1].t >= SETTLE_WINDOW) hist.shift();
  }
  const old = hist[0], now = hist[hist.length - 1];
  settled = !!old && now.t - old.t >= SETTLE_WINDOW && st.scalarTime - sinceChange >= SETTLE_MIN
    && now.ac.every((v, i) => Math.abs(v - old.ac[i]) < SETTLE_TOL);
}

function post() {
  const slice = sim.sliceZ(cfg.sliceZ);
  const sec = sim.section(cfg.section.axis, cfg.section.at);
  const st = sim.stats();
  trackSettling(st);
  const msg = {
    type: 'field', simTime: sim.time, scalarTime: st.scalarTime, settled, msPerStep, dt: sim.dt, nan: st.nan,
    slice: { ux: slice.ux, uy: slice.uy, uz: slice.uz, c: slice.c, layer: slice.layer, z: slice.z },
    section: { axis: cfg.section.axis, at: cfg.section.at, u: sec.u, w: sec.w, c: sec.c, solid: sec.solid, n: sec.n },
    rooms: st.rooms, doors: st.doors.map((d) => ({ name: d.name, room: d.room, closed: d.closed, inLs: d.inLs, acInLs: d.acInLs, upperInLs: d.upperInLs, lowerInLs: d.lowerInLs })),
  };
  postMessage(msg, [slice.ux.buffer, slice.uy.buffer, slice.uz.buffer, slice.c.buffer, sec.u.buffer, sec.w.buffer, sec.c.buffer, sec.solid.buffer]);
}

// a failure here (an allocation that a phone refuses, a driver quirk) must reach the page, not die silently
function fail(err) {
  running = false; failed = true;
  postMessage({ type: 'error', message: String((err && err.message) || err), stack: String((err && err.stack) || '').slice(0, 600) });
}

function tick() {
  timer = 0;
  if (!sim || !running || failed) return;
  try {
    const t0 = performance.now(); let n = 0;
    while (n < 1 || performance.now() - t0 < BUDGET_MS) { sim.step(1); n++; }
    const ms = (performance.now() - t0) / n;
    msPerStep = msPerStep ? msPerStep * 0.8 + ms * 0.2 : ms;
    post();
    if (vol && performance.now() - lastVol >= VOL_MS) postVol();
  } catch (err) { return fail(err); }
  timer = setTimeout(tick, 0);
}
const kick = () => { if (!timer && running && !failed) timer = setTimeout(tick, 0); };

onmessage = (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') { house = m.house; configure(m.cfg, true); kick(); }
    else if (m.type === 'config') { configure(m.cfg, m.reset); kick(); }
    else if (m.type === 'pause') { running = !m.paused; kick(); }
    else if (m.type === 'volume') { vol = m.on; if (vol && sim) postVol(); }
  } catch (err) { fail(err); }
};
