// Runs the 3D house airflow solver (airflow3d.js) off the main thread. Posts back a horizontal slice at the chosen
// height, a vertical section along the chosen line, and per-room speed and AC-air statistics.
import { createSim3D } from './airflow3d.js';

let sim = null, house = null, cfg = null, running = true, timer = 0;
const BUDGET_MS = 30; // solver time per tick; one post per tick
let msPerStep = 0;

function sources(c) {
  return {
    ac: { on: c.ac.on, flow: c.ac.flow, speed: c.ac.speed, louvre: c.ac.louvre },
    fans: (c.fans || []).map((f) => ({ x: f.x, y: f.y, z: f.z, d: f.d ?? 0.25, yaw: f.yaw, pitch: f.pitch || 0, speed: f.speed })),
  };
}

function configure(c, hard) {
  const rebuild = !sim || cfg.layers !== c.layers;
  if (rebuild) sim = createSim3D(house, { layers: c.layers, doorsOpen: c.doorsOpen, furniture: c.furniture, dT: c.dT });
  const geom = sim.setOptions({ doorsOpen: c.doorsOpen, furniture: c.furniture, dT: c.dT });
  cfg = c;
  sim.setSources(sources(c));
  if (hard && !geom && !rebuild) sim.reset();
  if (rebuild || geom || hard) {
    postMessage({ type: 'grid', NX: sim.NX, NY: sim.NY, NZ: sim.NZ, nz: sim.nz, h: sim.h, dt: sim.dt, extent: sim.extent, ceil: sim.ceil, nF: sim.nF, solid: sim.solid.slice() });
  }
  post();
}

function post() {
  const slice = sim.sliceZ(cfg.sliceZ);
  const sec = sim.section(cfg.section.axis, cfg.section.at);
  const st = sim.stats();
  const msg = {
    type: 'field', simTime: sim.time, msPerStep, dt: sim.dt, nan: st.nan,
    slice: { ux: slice.ux, uy: slice.uy, uz: slice.uz, c: slice.c, layer: slice.layer, z: slice.z },
    section: { axis: cfg.section.axis, at: cfg.section.at, u: sec.u, w: sec.w, c: sec.c, solid: sec.solid, n: sec.n },
    rooms: st.rooms, doors: st.doors.map((d) => ({ name: d.name, room: d.room, closed: d.closed, inLs: d.inLs, acInLs: d.acInLs, upperInLs: d.upperInLs, lowerInLs: d.lowerInLs })),
  };
  postMessage(msg, [slice.ux.buffer, slice.uy.buffer, slice.uz.buffer, slice.c.buffer, sec.u.buffer, sec.w.buffer, sec.c.buffer, sec.solid.buffer]);
}

function tick() {
  timer = 0;
  if (!sim || !running) return;
  const t0 = performance.now(); let n = 0;
  while (performance.now() - t0 < BUDGET_MS) { sim.step(1); n++; }
  const ms = (performance.now() - t0) / n;
  msPerStep = msPerStep ? msPerStep * 0.8 + ms * 0.2 : ms;
  post();
  timer = setTimeout(tick, 0);
}
const kick = () => { if (!timer && running) timer = setTimeout(tick, 0); };

onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') { house = m.house; configure(m.cfg, true); kick(); }
  else if (m.type === 'config') { configure(m.cfg, m.reset); kick(); }
  else if (m.type === 'pause') { running = !m.paused; kick(); }
};
