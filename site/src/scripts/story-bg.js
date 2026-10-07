// Glue between the scroll story and the depth backgrounds + motion controls.
// Scenes opt in with data-bg="a" | "b" | "a>b" (the wind sweeps from a to b across the scene's exit) and
// data-bg-dim (0 = full photo, 1 = black). Scenes without data-bg let the background fade away.
import { createDepthBackground } from './depth-bg.js';
import { subscribe, getMotion, enableTilt, enableCamera, disableCamera, cameraDebug } from './motion-input.js';

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

// Small control in the corner: shows what is driving the scene and offers tilt / camera.
function motionUI() {
  const ui = document.getElementById('motion-ui');
  if (!ui) return;
  const label = ui.querySelector('[data-o="src"]');
  const tilt = ui.querySelector('[data-i="tilt"]'), camera = ui.querySelector('[data-i="camera"]'), info = ui.querySelector('[data-i="info"]');
  const panel = ui.querySelector('.mu-panel'), pv = panel.querySelector('canvas'), pctx = pv.getContext('2d');
  const names = { pointer: 'pointer', tilt: 'tilt', camera: 'camera', none: 'scroll' };
  const refresh = (s) => {
    ui.hidden = false;
    label.textContent = names[s.source] || s.source;
    tilt.hidden = !s.available.tilt || s.source === 'tilt' || s.source === 'camera';
    camera.textContent = s.source === 'camera' ? 'camera off' : 'use camera';
    camera.hidden = !s.available.camera;
    info.hidden = s.source !== 'camera';
    if (s.source !== 'camera') panel.hidden = true;
  };
  subscribe(refresh); refresh(getMotion());
  tilt.addEventListener('click', async () => { if (!(await enableTilt())) tilt.textContent = 'tilt blocked'; });
  camera.addEventListener('click', async () => {
    if (getMotion().source === 'camera') { disableCamera(); return; }
    camera.textContent = 'asking...';
    if (!(await enableCamera())) camera.textContent = 'camera blocked';
  });
  info.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) drawPanel(); });
  // live view of exactly what the camera code sees: a 32x32 edge image and where it thinks you moved
  function drawPanel() {
    const c = cameraDebug();
    if (panel.hidden || !c) return;
    const N = 32, img = pctx.createImageData(N, N);
    for (let i = 0; i < N * N; i++) { const v = Math.min(255, (c.edgeFrame?.[i] || 0) * 160); img.data[i * 4] = v * 0.3; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v * 0.4; img.data[i * 4 + 3] = 255; }
    pctx.putImageData(img, 0, 0);
    const d = c.dot || { x: 0, y: 0 };
    pctx.fillStyle = '#ff7a1a'; pctx.fillRect(15 + d.x * 14, 15 + d.y * 14, 2, 2);
    requestAnimationFrame(drawPanel);
  }
}

const wait = () => (window.__story ? boot() : setTimeout(wait, 50));
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !new URLSearchParams(location.search).has('static')) wait();
