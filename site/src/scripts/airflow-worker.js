// Runs the floor-plan airflow solver off the main thread and streams the velocity field back.
import { createSim, acFan } from './airflow.js';

let sim = null, plan = null, running = true, cfg = null;
const STEP_BUDGET_MS = 14; // per tick, so a tick plus the post fits comfortably in a frame
let simTime = 0, dt = 0;

function fansFor(c) {
  const out = [];
  if (c.ac.on) out.push(acFan(plan, c.ac.louvre, c.ac.speed / c.uRef));
  for (const f of c.fans) out.push({ x: f.x, y: f.y, dir: f.dir, width: f.width ?? 0.32, depth: 0.2, speed: f.speed / c.uRef, kind: 'fan' });
  return out;
}

function configure(c, hard) {
  const geom = !cfg || cfg.h !== c.h || cfg.doorsOpen !== c.doorsOpen || cfg.furniture !== c.furniture;
  if (!sim || cfg.h !== c.h) sim = createSim(plan, { h: c.h, doorsOpen: c.doorsOpen, furniture: c.furniture });
  else if (geom) sim.setOptions({ doorsOpen: c.doorsOpen, furniture: c.furniture });
  cfg = c;
  sim.setFans(fansFor(c));
  dt = (sim.uLat * sim.h) / c.uRef; // seconds of real time per lattice step
  if (geom || hard) { sim.reset(); simTime = 0; }
  postMessage({ type: 'grid', NX: sim.NX, NY: sim.NY, h: sim.h, extent: sim.extent, solid: sim.solid, block: sim.block });
}

function tick() {
  if (!sim) return;
  if (running) {
    const t0 = performance.now(); let n = 0;
    while (performance.now() - t0 < STEP_BUDGET_MS) { sim.step(); n++; }
    simTime += n * dt;
    const scale = cfg.uRef / sim.uLat; // lattice -> m/s
    const rs = sim.roomSpeeds(); for (const k in rs) rs[k] *= scale;
    const ux = sim.ux.slice(), uy = sim.uy.slice();
    postMessage({ type: 'field', ux, uy, scale, simTime, stepsPerSec: n / ((performance.now() - t0) / 1000), dt, rooms: rs }, [ux.buffer, uy.buffer]);
  }
  setTimeout(tick, 0);
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') { plan = m.plan; configure(m.cfg, true); tick(); }
  else if (m.type === 'config') configure(m.cfg, m.reset);
  else if (m.type === 'pause') running = !m.paused;
};
