// Glue between the scroll story and the depth backgrounds + motion controls.
// Scenes opt in with data-bg="a" | "b" | "a>b" (the wind sweeps from a to b across the scene's exit) and
// data-bg-dim (0 = full photo, 1 = black). Scenes without data-bg let the background fade away.
import { createDepthBackground } from './depth-bg.js';
import { subscribe, getMotion, enableTilt, enableCamera, disableCamera, cameraDebug, restoreCamera } from './motion-input.js';

const root = document.documentElement;
const base = (document.querySelector('meta[name="base"]')?.content || '').replace(/\/$/, '');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);

async function boot() {
  const story = window.__story;
  const canvas = document.getElementById('depth');
  if (!story || !canvas) return;
  let bg = null;
  try {
    bg = await createDepthBackground(canvas, { a: `${base}/bg/dune.jpg`, da: `${base}/bg/dune-depth.jpg`, b: `${base}/bg/sunset.jpg`, db: `${base}/bg/sunset-depth.jpg` });
  } catch (e) { console.warn('depth background unavailable', e); }
  window.__depthState = bg ? 'ready' : 'failed';
  dispatchEvent(new Event(bg ? 'depth-ready' : 'depth-failed'));
  if (!bg) return;
  root.classList.add('depth-on');
  const cfg = story.scenes.map((s) => {
    const v = s.el.dataset.bg; if (!v) return null;
    return { from: v.startsWith('b') ? 1 : 0, to: v.endsWith('b') ? 1 : 0, sweep: v.includes('>'), dim: parseFloat(s.el.dataset.bgDim ?? '0.4') };
  });
  let lastP = 0, vel = 0, shownOp = 0;
  story.onFrame((P, scenes, cur) => {
    let wSum = 0, mix = 0, dim = 0, op = 0;
    scenes.forEach((s, i) => {
      const c = cfg[i], o = s.on ? s.o ?? 0 : 0;
      if (!o) return;
      if (!c) return;
      const lp = clamp((P - s.start) / (s.end - s.start));
      const m = c.sweep ? c.from + (c.to - c.from) * ease(clamp((lp - 0.45) / 0.55)) : c.from;
      mix += m * o; dim += c.dim * o; wSum += o; op = Math.max(op, o);
    });
    if (wSum > 0) { bg.params.mix = mix / wSum; bg.params.dim = dim / wSum; }
    shownOp += (op - shownOp) * 0.2;
    bg.params.opacity = shownOp;
    const s = scenes[cur];
    bg.params.scroll = clamp((P - s.start) / (s.end - s.start)) - 0.5;
    vel = vel * 0.9 + Math.abs(P - lastP) * 60 * 0.1; lastP = P;
    bg.params.vel = Math.min(2, vel * 40);
    if (shownOp > 0.01) bg.start(); else bg.stop();
  });
  bg.start();
  motionUI();
}

// One small control in the corner: a camera pill. Off, it asks "why enable camera?" and explains; on, it shows
// exactly what the camera code sees. A granted camera comes back on by itself on later visits.
function motionUI() {
  const ui = document.getElementById('motion-ui');
  if (!ui) return;
  const pill = ui.querySelector('[data-i="pill"]'), label = ui.querySelector('[data-o="label"]'), src = ui.querySelector('[data-o="src"]');
  const panel = ui.querySelector('.mu-panel'), view = ui.querySelector('.mu-view'), pv = view.querySelector('canvas'), pctx = pv.getContext('2d');
  const camBtn = ui.querySelector('[data-i="camera"]'), tiltBtn = ui.querySelector('[data-i="tilt"]'), title = ui.querySelector('.mu-title');
  const ask = ui.querySelector('.mu-ask');
  const names = { pointer: 'your pointer', tilt: 'tilt', camera: 'the camera', none: 'scroll' };
  const open = (v) => { panel.hidden = !v; pill.setAttribute('aria-expanded', String(v)); if (v) { hideNudge(); drawView(); } };
  const refresh = (s) => {
    const on = s.source === 'camera';
    ui.hidden = !(s.available.camera || s.available.tilt);
    ui.classList.toggle('cam-on', on);
    label.textContent = on ? 'camera on' : s.available.camera ? 'camera' : 'tilt to look around';
    title.textContent = on ? 'The camera is on' : 'Why enable the camera?';
    camBtn.textContent = on ? 'Turn camera off' : 'Enable camera';
    camBtn.hidden = !s.available.camera;
    tiltBtn.hidden = !s.available.tilt || s.source === 'tilt' || on;
    view.hidden = !on;
    src.textContent = names[s.source] || s.source;
    if (on) hideNudge();
  };
  subscribe(refresh); refresh(getMotion());
  pill.addEventListener('click', () => open(panel.hidden));
  document.addEventListener('click', (e) => { if (!panel.hidden && !ui.contains(e.target)) open(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) open(false); });
  camBtn.addEventListener('click', async () => {
    if (getMotion().source === 'camera') { disableCamera(); return; }
    camBtn.textContent = 'asking...';
    if (!(await enableCamera())) camBtn.textContent = 'Camera blocked';
    else drawView();
  });
  tiltBtn.addEventListener('click', async () => { if (!(await enableTilt())) tiltBtn.textContent = 'Tilt blocked'; });
  function drawView() {
    const c = cameraDebug();
    if (panel.hidden || !c) return;
    const N = 32, img = pctx.createImageData(N, N);
    for (let i = 0; i < N * N; i++) { const v = Math.min(255, (c.edgeFrame?.[i] || 0) * 160); img.data[i * 4] = v * 0.3; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v * 0.4; img.data[i * 4 + 3] = 255; }
    pctx.putImageData(img, 0, 0);
    const d = c.dot || { x: 0, y: 0 };
    pctx.fillStyle = '#ff7a1a'; pctx.fillRect(15 + d.x * 14, 15 + d.y * 14, 2, 2);
    requestAnimationFrame(drawView);
  }
  // a tiny "what's this?" bubble over the pill, until the visitor has looked once
  const SEEN = 'cd-camera-tip';
  const seen = () => { try { return localStorage.getItem(SEEN); } catch { return '1'; } };
  function hideNudge() { if (!ask.hidden) { ask.classList.remove('show'); setTimeout(() => { ask.hidden = true; }, 250); } try { localStorage.setItem(SEEN, '1'); } catch {} }
  function showNudge() {
    const s = getMotion();
    if (seen() || !s.available.camera || s.source === 'camera' || !panel.hidden) return;
    ask.hidden = false; requestAnimationFrame(() => ask.classList.add('show'));
    setTimeout(() => { if (!ask.hidden) { ask.classList.remove('show'); setTimeout(() => { ask.hidden = true; }, 250); } }, 12000);
  }
  ask.addEventListener('click', () => open(true));
  addEventListener('intro-done', () => setTimeout(showNudge, 1200), { once: true });
  restoreCamera();
}

const wait = () => (window.__story ? boot() : setTimeout(wait, 50));
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !new URLSearchParams(location.search).has('static')) wait();
