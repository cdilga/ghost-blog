// Motion input for the depth backgrounds: one smoothed (x, y) in [-1, 1], from the best source available.
//
//   pointer  desktop, always on: where the mouse is
//   tilt     phones: device orientation, calibrated to however you are holding it. iOS needs a tap to allow
//            it, so it waits for an explicit button press rather than ambushing the first touch
//   camera   opt-in only, anywhere: 32x32 greyscale optical flow from the front camera, so moving your
//            head moves the scene. Nothing is stored or sent; the "?" panel shows exactly what it sees
//   none     reduced motion, or nothing granted: the backgrounds still drift with scroll
//
// Reimagined from the old Ghost theme's MotionInput (Sobel + block-matching flow, One Euro filter), with the
// gyro path the old site specified but never shipped, and the camera moved behind a button.

const listeners = new Set();
const state = { x: 0, y: 0, tx: 0, ty: 0, source: 'none', available: { tilt: false, camera: false } };
const clamp = (v, a = -1, b = 1) => Math.min(b, Math.max(a, v));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
let started = false;

export function subscribe(fn) { listeners.add(fn); start(); return () => listeners.delete(fn); }
export function getMotion() { return state; }
const emit = () => listeners.forEach((fn) => fn(state));
const setSource = (s) => { if (state.source !== s) { state.source = s; emit(); } };

function start() {
  if (started || reduce) return;
  started = true;
  // pointer (desktop): position relative to the viewport centre
  if (!coarse) {
    setSource('pointer');
    addEventListener('pointermove', (e) => {
      if (state.source !== 'pointer') return;
      state.tx = clamp((e.clientX / innerWidth) * 2 - 1);
      state.ty = clamp((e.clientY / innerHeight) * 2 - 1);
    }, { passive: true });
  }
  // tilt: available everywhere DeviceOrientationEvent exists; on iOS 13+ it needs a user gesture
  if ('DeviceOrientationEvent' in window) {
    state.available.tilt = coarse;
    const needsPermission = typeof DeviceOrientationEvent.requestPermission === 'function';
    if (coarse && !needsPermission) enableTilt();
  }
  state.available.camera = !!navigator.mediaDevices?.getUserMedia;
  // smoothing loop (critically damped follow)
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = 1 - Math.exp(-6 * dt);
    state.x += (state.tx - state.x) * k; state.y += (state.ty - state.y) * k;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  emit();
}

// ---------- tilt ----------
let tiltOn = false, base = null;
export async function enableTilt() {
  if (tiltOn) return true;
  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') return false;
    }
  } catch { return false; }
  tiltOn = true;
  addEventListener('deviceorientation', (e) => {
    if (e.beta == null || e.gamma == null) return;
    if (state.source === 'camera') return;
    if (!base) base = { b: e.beta, g: e.gamma };
    // slowly re-centre so a change in how the phone is held does not pin the scene to one side
    base.b += (e.beta - base.b) * 0.004; base.g += (e.gamma - base.g) * 0.004;
    state.tx = clamp((e.gamma - base.g) / 18);
    state.ty = clamp((e.beta - base.b) / 18);
    setSource('tilt');
  });
  return true;
}

// ---------- camera optical flow ----------
const N = 32;
let cam = null;
export async function enableCamera() {
  if (cam) return true;
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 160, height: 120 }, audio: false }); }
  catch { return false; }
  const video = document.createElement('video');
  video.playsInline = true; video.muted = true; video.srcObject = stream; await video.play();
  const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const grey = new Float32Array(N * N), edge = new Float32Array(N * N), prev = new Float32Array(N * N);
  let have = false, px = 0, py = 0, fx = 0, fy = 0;
  cam = { stream, video, grey, edge, stop() { stream.getTracks().forEach((t) => t.stop()); cam = null; setSource(coarse ? (tiltOn ? 'tilt' : 'none') : 'pointer'); } };
  setSource('camera');
  const step = () => {
    if (!cam) return;
    cx.drawImage(video, 0, 0, N, N);
    const d = cx.getImageData(0, 0, N, N).data;
    for (let i = 0; i < N * N; i++) grey[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
    // Sobel edge magnitude: flow is only trustworthy where there is texture
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      const gx = grey[i - N + 1] + 2 * grey[i + 1] + grey[i + N + 1] - grey[i - N - 1] - 2 * grey[i - 1] - grey[i + N - 1];
      const gy = grey[i + N - 1] + 2 * grey[i + N] + grey[i + N + 1] - grey[i - N - 1] - 2 * grey[i - N] - grey[i - N + 1];
      edge[i] = Math.hypot(gx, gy);
    }
    if (have) {
      // global block match on the edge image: which shift best explains this frame?
      let best = Infinity, bx = 0, by = 0;
      for (let sy = -3; sy <= 3; sy++) for (let sx = -3; sx <= 3; sx++) {
        let err = 0;
        for (let y = 4; y < N - 4; y += 2) for (let x = 4; x < N - 4; x += 2) {
          const a = edge[y * N + x], b = prev[(y + sy) * N + (x + sx)];
          err += Math.abs(a - b);
        }
        if (err < best) { best = err; bx = sx; by = sy; }
      }
      // smooth, dead-zone, integrate with decay so it drifts back to centre (it measures movement, not pose)
      fx += (bx - fx) * 0.35; fy += (by - fy) * 0.35;
      const dx = Math.abs(fx) < 0.25 ? 0 : fx, dy = Math.abs(fy) < 0.25 ? 0 : fy;
      px = clamp(px * 0.97 - dx * 0.12); py = clamp(py * 0.97 + dy * 0.12);
      state.tx = -px; state.ty = py; // mirror: move your head left, the scene looks left
    }
    prev.set(edge); have = true;
    cam.edgeFrame = edge; cam.dot = { x: state.tx, y: state.ty };
    setTimeout(() => requestAnimationFrame(step), 33);
  };
  step();
  return true;
}
export const cameraDebug = () => cam;
export const disableCamera = () => cam?.stop();
