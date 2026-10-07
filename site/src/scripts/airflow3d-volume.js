// WebGL2 volume view of the 3D house airflow: the shell, furniture, AC head and fans as boxes, the air speed (or the
// AC-air share) raymarched through a 3D texture with the plan's colour ramps (emission and absorption), and particles
// carried by the 3D velocity. The raymarch is cached: it reruns only when the data, camera or settings change, and
// the particles are drawn over the cached image each frame.
import { VOL_SMAX } from './airflow3d.js';

const SPEED_MAX = 1.5, AC_MAX = 0.5; // full colour, as in the plan
const FAR = 80;                      // m: distances are packed as a fraction of this
const BG = [11 / 255, 8 / 255, 6 / 255];
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const COL = { floor: rgb('#1e1712'), wall: rgb('#b9a68f'), cut: rgb('#f2e6d3'), window: rgb('#5e8fb8'), shut: rgb('#7a6a58'), furn: rgb('#5f564d'), ac: rgb('#f2e6d3'), fan: rgb('#ff7a1a'), sel: rgb('#ffd166'), arrow: rgb('#ffd166'), pole: rgb('#5a4c40') };

// ---------- shaders ----------
const VS_MESH = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec3 aCol;
uniform mat4 uVP; out vec3 vPos; out vec3 vNrm; out vec3 vCol;
void main() { vPos = aPos; vNrm = aNrm; vCol = aCol; gl_Position = uVP * vec4(aPos, 1.0); }`;
// opaque pass: shaded colour, plus the distance from the eye packed into two bytes for the raymarch and overlays
const FS_MESH = `#version 300 es
precision highp float;
in vec3 vPos; in vec3 vNrm; in vec3 vCol; uniform vec3 uEye; uniform float uFar;
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oDist;
void main() {
  vec3 n = normalize(vNrm);
  float lit = 0.38 + 0.5 * max(dot(n, normalize(vec3(-0.45, -0.6, 0.75))), 0.0) + 0.12 * max(n.z, 0.0);
  oCol = vec4(vCol * lit, 1.0);
  float t = clamp(distance(vPos, uEye) / uFar, 0.0, 1.0) * 255.0;
  oDist = vec4(floor(t) / 255.0, fract(t), 0.0, 1.0);
}`;
const VS_QUAD = `#version 300 es
out vec2 vUv;
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const FS_BLIT = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; out vec4 o;
void main() { o = texture(uTex, vUv); }`;
// front-to-back emission and absorption along each eye ray, stopped at the first opaque surface
const FS_RAY = `#version 300 es
precision highp float; precision highp sampler3D;
in vec2 vUv; out vec4 o;
uniform sampler3D uVol; uniform sampler2D uScene, uDist;
uniform mat4 uInv; uniform vec3 uEye, uBmin, uBmax, uTo, uTs;
uniform float uFar, uStep, uThr, uDen, uMode, uHave;
vec3 heat(float x) { return vec3(min(1.0, x * 1.7), (120.0 * x + 135.0 * x * x * x) / 255.0, (30.0 + 200.0 * x * x * x * x) / 255.0); }
vec3 cool(float x) { return vec3((40.0 + 200.0 * x * x) / 255.0, (120.0 + 110.0 * x) / 255.0, (200.0 + 55.0 * x) / 255.0); }
void main() {
  vec3 scene = texture(uScene, vUv).rgb; vec4 dd = texture(uDist, vUv);
  float tScene = (dd.x + dd.y / 255.0) * uFar;
  vec4 a = uInv * vec4(vUv * 2.0 - 1.0, -1.0, 1.0), b = uInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = normalize(b.xyz / b.w - a.xyz / a.w);
  dir += vec3(equal(dir, vec3(0.0))) * 1e-6;
  vec3 t0 = (uBmin - uEye) / dir, t1 = (uBmax - uEye) / dir, tn = min(t0, t1), tf = max(t0, t1);
  float tN = max(max(tn.x, tn.y), max(tn.z, 0.0)), tF = min(min(tf.x, tf.y), min(tf.z, tScene));
  vec4 acc = vec4(0.0);
  if (uHave > 0.5 && tF > tN) {
    float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    for (int i = 0; i < 400; i++) {
      float t = tN + (float(i) + j) * uStep;
      if (t > tF || acc.a > 0.97) break;
      vec2 s = texture(uVol, (uEye + dir * t - uTo) * uTs).rg;
      float x, den; vec3 col;
      if (uMode < 0.5) { float v = s.r * ${VOL_SMAX.toFixed(1)}; x = min(1.0, v / ${SPEED_MAX.toFixed(2)}); den = smoothstep(uThr, uThr + 0.2, v); col = heat(x); }
      else { x = min(1.0, s.g / ${AC_MAX.toFixed(2)}); den = smoothstep(uThr, uThr + 0.06, s.g); col = cool(x); }
      float al = 1.0 - exp(-den * (0.3 + 0.7 * x) * uDen * uStep);
      acc.rgb += (1.0 - acc.a) * al * col; acc.a += (1.0 - acc.a) * al;
    }
  }
  o = vec4(acc.rgb + (1.0 - acc.a) * scene, 1.0);
}`;
// overlays (translucent upper walls, outlines, particles): hidden behind the opaque pass by its packed distance
const VS_OVER = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol;
uniform mat4 uVP; out vec3 vPos; out vec4 vCol;
void main() { vPos = aPos; vCol = aCol; gl_Position = uVP * vec4(aPos, 1.0); }`;
const FS_OVER = `#version 300 es
precision highp float;
in vec3 vPos; in vec4 vCol; uniform sampler2D uDist; uniform vec3 uEye; uniform float uFar; out vec4 o;
void main() {
  vec4 dd = texelFetch(uDist, ivec2(gl_FragCoord.xy), 0);
  if (distance(vPos, uEye) > (dd.x + dd.y / 255.0) * uFar + 0.03) discard;
  o = vCol;
}`;

// ---------- small matrix kit (column-major) ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function perspective(fy, asp, n, f) {
  const t = 1 / Math.tan(fy / 2);
  return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0];
}
function lookAt(e, c, up) {
  const z = norm(sub(e, c)), x = norm(cross(up, z)), y = cross(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
}
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
  return o;
}
function invert(m) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d,
  ];
}

// ---------- geometry ----------
// box as 12 triangles: pos, normal, colour (9 floats a vertex); top can take its own colour (a cut face)
function pushBox(out, b, col, top = col) {
  const [x0, y0, z0, x1, y1, z1] = b;
  const f = (n, c, ...p) => { for (const i of [0, 1, 2, 0, 2, 3]) out.push(...p[i], ...n, ...c); };
  f([0, 0, 1], top, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  f([0, 0, -1], col, [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]);
  f([1, 0, 0], col, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
  f([-1, 0, 0], col, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
  f([0, 1, 0], col, [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]);
  f([0, -1, 0], col, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
}
// cylinder or cone from p0 (radius r0) to p1 (radius r1), with end caps
function pushCyl(out, p0, p1, r0, r1, col, seg = 14) {
  const ax = norm(sub(p1, p0)), u = norm(cross(Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], ax)), v = cross(ax, u);
  const ring = (p, r, a) => [p[0] + r * (Math.cos(a) * u[0] + Math.sin(a) * v[0]), p[1] + r * (Math.cos(a) * u[1] + Math.sin(a) * v[1]), p[2] + r * (Math.cos(a) * u[2] + Math.sin(a) * v[2])];
  const rad = (a) => [Math.cos(a) * u[0] + Math.sin(a) * v[0], Math.cos(a) * u[1] + Math.sin(a) * v[1], Math.cos(a) * u[2] + Math.sin(a) * v[2]];
  for (let s = 0; s < seg; s++) {
    const a = (s / seg) * Math.PI * 2, b = ((s + 1) / seg) * Math.PI * 2;
    const q = [ring(p0, r0, a), ring(p0, r0, b), ring(p1, r1, b), ring(p1, r1, a)], n = [rad(a), rad(b), rad(b), rad(a)];
    for (const i of [0, 1, 2, 0, 2, 3]) out.push(...q[i], ...n[i], ...col);
    if (r0 > 0) out.push(...p0, ...ax.map((x) => -x), ...col, ...q[1], ...ax.map((x) => -x), ...col, ...q[0], ...ax.map((x) => -x), ...col);
    if (r1 > 0) out.push(...p1, ...ax, ...col, ...q[3], ...ax, ...col, ...q[2], ...ax, ...col);
  }
}
// ear clipping for the (simple, mostly rectilinear) room outlines
function triangulate(poly) {
  const pts = poly.slice(), area = pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  if (area < 0) pts.reverse();
  const tris = [], idx = pts.map((_, i) => i);
  const crs = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = 0;
  while (idx.length > 3 && guard++ < 500) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
      const a = pts[ia], b = pts[ib], c = pts[ic];
      if (crs(a, b, c) <= 1e-9) continue;
      if (idx.some((k) => k !== ia && k !== ib && k !== ic && crs(a, b, pts[k]) >= 0 && crs(b, c, pts[k]) >= 0 && crs(c, a, pts[k]) >= 0)) continue;
      tris.push(a, b, c); idx.splice(i, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) tris.push(...idx.map((k) => pts[k]));
  return tris;
}

export function createVolumeView({ canvas, labels, house, small }) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const lctx = labels.getContext('2d');
  const [ex0, ey0, ex1, ey1] = house.extent, CEIL = house.ceiling_z;

  function prog(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p, u };
  }
  let P;
  try { P = { mesh: prog(VS_MESH, FS_MESH), ray: prog(VS_QUAD, FS_RAY), blit: prog(VS_QUAD, FS_BLIT), over: prog(VS_OVER, FS_OVER) }; }
  catch (err) { console.warn('volume view unavailable:', err); return null; }

  // vertex buffers: static shell (rebuilt when the cutaway or doors change), fans, overlays, particles
  const mkVao = (stride, attrs) => {
    const vao = gl.createVertexArray(), buf = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    let off = 0;
    attrs.forEach((n, i) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, stride * 4, off * 4); off += n; });
    gl.bindVertexArray(null);
    return { vao, buf, n: 0 };
  };
  const shell = mkVao(9, [3, 3, 3]), fansM = mkVao(9, [3, 3, 3]), overT = mkVao(7, [3, 4]), overL = mkVao(7, [3, 4]), parts = mkVao(7, [3, 4]);
  const upload = (m, arr, usage = gl.STATIC_DRAW) => { gl.bindBuffer(gl.ARRAY_BUFFER, m.buf); gl.bufferData(gl.ARRAY_BUFFER, arr instanceof Float32Array ? arr : new Float32Array(arr), usage); m.n = arr.length / (m === shell || m === fansM ? 9 : 7); };

  const opt = { mode: 'speed', thr: 0.18, den: 1.2, cut: 0.9, doorsOpen: true, acOn: true };
  function buildShell() {
    const tri = [], ot = [], ol = [], cut = opt.cut;
    for (const r of house.rooms) for (const p of triangulate(r.poly)) tri.push(p[0], p[1], 0, 0, 0, 1, ...COL.floor);
    const wall = (b, col, alpha) => {
      if (b[2] < cut) pushBox(tri, [b[0], b[1], b[2], b[3], b[4], Math.min(b[5], cut)], col, b[5] > cut + 1e-3 ? COL.cut : col);
      if (b[5] > cut + 1e-3) {
        const q = [b[0], b[1], Math.max(b[2], cut), b[3], b[4], b[5]], t = [];
        pushBox(t, q, col);
        for (let i = 0; i < t.length; i += 9) ot.push(t[i], t[i + 1], t[i + 2], ...col, alpha);
        // top edges of the full-height walls, so the shell reads above the cut
        if (b[5] >= CEIL - 0.05) for (const [a, c] of [[[q[0], q[1]], [q[3], q[1]]], [[q[3], q[1]], [q[3], q[4]]], [[q[3], q[4]], [q[0], q[4]]], [[q[0], q[4]], [q[0], q[1]]]]) ol.push(a[0], a[1], b[5], ...COL.wall, 0.22, c[0], c[1], b[5], ...COL.wall, 0.22);
      }
    };
    for (const s of house.solids) wall(s.b, s.c === 'window' ? COL.window : s.c === 'door_closed' ? COL.shut : COL.wall, s.c === 'window' ? 0.16 : 0.07);
    if (!opt.doorsOpen) for (const d of house.doors) if (d.closable) wall([d.b[0], d.b[1], 0, d.b[3], d.b[4], d.head_z], COL.shut, 0.12);
    for (const o of [...house.joinery, ...house.furniture]) pushBox(tri, o.b, COL.furn);
    if (house.ac) pushBox(tri, house.ac.b, opt.acOn ? COL.ac : COL.pole);
    // room outlines on the floor
    for (const r of house.rooms) r.poly.forEach((p, i) => { const q = r.poly[(i + 1) % r.poly.length]; ol.push(p[0], p[1], 0.01, ...COL.wall, 0.18, q[0], q[1], 0.01, ...COL.wall, 0.18); });
    upload(shell, tri); upload(overT, ot); upload(overL, ol);
  }
  let fanKey = '';
  function buildFans(fans, sel) {
    const key = JSON.stringify([fans.map((f) => [f.x, f.y, f.z, f.yaw, f.pitch]), sel]);
    if (key === fanKey) return false;
    fanKey = key;
    const tri = [];
    fans.forEach((f, i) => {
      const yaw = (f.yaw * Math.PI) / 180, pit = ((f.pitch || 0) * Math.PI) / 180;
      const d = [Math.cos(pit) * Math.cos(yaw), Math.cos(pit) * Math.sin(yaw), Math.sin(pit)], c = [f.x, f.y, f.z];
      const at = (s) => [c[0] + d[0] * s, c[1] + d[1] * s, c[2] + d[2] * s];
      pushCyl(tri, [f.x, f.y, 0], [f.x, f.y, Math.max(0.05, f.z - 0.2)], 0.025, 0.025, COL.pole, 8);
      pushCyl(tri, at(-0.05), at(0.05), 0.2, 0.2, i === sel ? COL.sel : COL.fan, 20);
      pushCyl(tri, at(0.05), at(0.6), 0.03, 0.03, COL.arrow, 8);
      pushCyl(tri, at(0.6), at(0.85), 0.09, 0, COL.arrow, 12);
    });
    upload(fansM, tri, gl.DYNAMIC_DRAW);
    return true;
  }

  // ---------- targets ----------
  let CW = 0, CH = 0, fbA = null, fbB = null, tScene, tDist, tOut, rb;
  const tex2 = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, CW, CH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); return t; };
  function targets() {
    for (const t of [tScene, tDist, tOut]) if (t) gl.deleteTexture(t);
    if (rb) gl.deleteRenderbuffer(rb);
    for (const f of [fbA, fbB]) if (f) gl.deleteFramebuffer(f);
    tScene = tex2(); tDist = tex2(); tOut = tex2();
    rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, CW, CH);
    fbA = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tScene, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tDist, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    fbB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tOut, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  let cssW = 0, cssH = 0;
  function resize() {
    cssW = canvas.clientWidth; cssH = canvas.clientHeight;
    if (!cssW || !cssH) return;
    const dpr = Math.min(1.5, devicePixelRatio || 1); // the raymarch is cached, so this costs little
    const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
    const ldpr = Math.min(2, devicePixelRatio || 1);
    labels.width = Math.round(cssW * ldpr); labels.height = Math.round(cssH * ldpr); lctx.setTransform(ldpr, 0, 0, ldpr, 0, 0);
    if (w === CW && h === CH) { dirtyScene = true; return; }
    CW = canvas.width = w; CH = canvas.height = h;
    targets(); dirtyScene = true;
  }

  // ---------- camera ----------
  const target = [(ex0 + ex1) / 2, (ey0 + ey1) / 2, 0.6];
  const HOME = { yaw: -1.2, pitch: 0.95, zoom: 1 };
  const cam = { ...HOME };
  let VP = null, eye = [0, 0, 0];
  function camera() {
    // distance that fits the whole house at this aspect, times the user's zoom
    const dist = 20 * Math.max(1, 1.75 / (CW / CH)) ** 0.8 * cam.zoom, cp = Math.cos(cam.pitch);
    eye = [target[0] + dist * cp * Math.cos(cam.yaw), target[1] + dist * cp * Math.sin(cam.yaw), target[2] + dist * Math.sin(cam.pitch)];
    VP = mul(perspective((38 * Math.PI) / 180, CW / CH, 0.1, 200), lookAt(eye, target, [0, 0, 1]));
  }
  const orbit = (dyaw, dpitch) => { cam.yaw += dyaw; cam.pitch = Math.min(1.53, Math.max(0.08, cam.pitch + dpitch)); dirtyScene = true; };
  const zoom = (f) => { cam.zoom = Math.min(2, Math.max(0.2, cam.zoom * f)); dirtyScene = true; };
  const resetView = () => { Object.assign(cam, HOME); dirtyScene = true; };

  // ---------- volume data ----------
  let grid = null, vtex = null, vel = null, sc = null, have = false;
  function setGrid(g) {
    grid = g; have = false; vel = null; sc = null;
    if (vtex) gl.deleteTexture(vtex);
    vtex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, vtex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_3D, k, v);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RG8, g.NX, g.NY, g.NZ, 0, gl.RG, gl.UNSIGNED_BYTE, null);
    for (let n = 0; n < NP; n++) age[n] = 0;
    dirtyVol = true;
  }
  function setData(scBytes, velocity) {
    if (!grid || scBytes.length !== grid.NX * grid.NY * grid.NZ * 2) return;
    gl.bindTexture(gl.TEXTURE_3D, vtex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, grid.NX, grid.NY, grid.NZ, gl.RG, gl.UNSIGNED_BYTE, scBytes);
    sc = scBytes; vel = velocity; have = true; dirtyVol = true;
  }
  function setOptions(o) {
    let geom = false, look = false;
    for (const k in o) if (opt[k] !== o[k]) { opt[k] = o[k]; if (k === 'cut' || k === 'doorsOpen' || k === 'acOn') geom = true; else look = true; }
    if (geom) { buildShell(); dirtyScene = true; }
    if (look) dirtyVol = true;
  }

  // ---------- particles: carried by the 3D velocity, short fading trails ----------
  const NP = small ? 450 : 1100, K = 7;
  const hist = new Float32Array(NP * K * 3), age = new Float32Array(NP), pbuf = new Float32Array(NP * (K - 1) * 2 * 7);
  function velAt(x, y, z, o) {
    const { NX, NY, NZ, h, extent } = grid;
    const fi = (x - extent[0]) / h + 0.5, fj = (y - extent[1]) / h + 0.5, fl = z / h + 0.5;
    const i = Math.floor(fi), j = Math.floor(fj), l = Math.floor(fl);
    if (i < 0 || j < 0 || l < 0 || i >= NX - 1 || j >= NY - 1 || l >= NZ - 1) return false;
    if (grid.solid[Math.round(fi - 0.5) + NX * (Math.round(fj - 0.5) + NY * Math.round(fl - 0.5))]) return false;
    const a = fi - i, b = fj - j, c = fl - l, NXY = NX * NY;
    o[0] = o[1] = o[2] = 0;
    for (let q = 0; q < 8; q++) {
      const di = q & 1, dj = (q >> 1) & 1, dl = q >> 2, w = (di ? a : 1 - a) * (dj ? b : 1 - b) * (dl ? c : 1 - c);
      const k = 3 * (i + di + NX * (j + dj) + NXY * (l + dl));
      o[0] += w * vel[k]; o[1] += w * vel[k + 1]; o[2] += w * vel[k + 2];
    }
    return true;
  }
  function spawn(n) {
    const { NX, NY, NZ, h, extent } = grid;
    // favour moving air: pick cells at random, keep a slow one only now and then
    for (let tries = 0; tries < 30; tries++) {
      const i = 1 + ((Math.random() * (NX - 2)) | 0), j = 1 + ((Math.random() * (NY - 2)) | 0), l = 1 + ((Math.random() * (NZ - 2)) | 0);
      const k = i + NX * (j + NY * l);
      if (grid.solid[k]) continue;
      const s = (sc[2 * k] / 255) * VOL_SMAX;
      if (s < 0.12 && Math.random() > 0.08) continue;
      const x = extent[0] + (i - 0.5 + Math.random() - 0.5) * h, y = extent[1] + (j - 0.5 + Math.random() - 0.5) * h, z = (l - 0.5 + Math.random() - 0.5) * h;
      for (let m = 0; m < K; m++) { hist[(n * K + m) * 3] = x; hist[(n * K + m) * 3 + 1] = y; hist[(n * K + m) * 3 + 2] = z; }
      age[n] = 1.5 + Math.random() * 3;
      return;
    }
    age[n] = -1;
  }
  const u3 = [0, 0, 0];
  function stepParticles(dt) {
    let nv = 0;
    for (let n = 0; n < NP; n++) {
      age[n] -= dt;
      if (age[n] <= 0) { spawn(n); continue; }
      const o = n * K * 3;
      if (!velAt(hist[o], hist[o + 1], hist[o + 2], u3)) { age[n] = 0; continue; }
      const sp = Math.hypot(u3[0], u3[1], u3[2]);
      if (sp < 0.02 && Math.random() < 0.05) { age[n] = 0; continue; }
      hist.copyWithin(o + 3, o, o + (K - 1) * 3);
      hist[o] += u3[0] * dt; hist[o + 1] += u3[1] * dt; hist[o + 2] += u3[2] * dt;
      if (sp < 0.04) continue;
      const x = Math.min(1, sp / SPEED_MAX), fade = Math.min(1, age[n] / 0.6);
      const [r, g, b] = opt.mode === 'ac' ? [0.92, 0.96, 1] : [1, (150 + 100 * x) / 255, (90 + 150 * x) / 255];
      for (let m = 0; m < K - 1; m++) {
        const a0 = fade * Math.min(0.9, 0.3 + sp) * (1 - m / (K - 1)), a1 = fade * Math.min(0.9, 0.3 + sp) * (1 - (m + 1) / (K - 1));
        const p = o + m * 3;
        pbuf.set([hist[p], hist[p + 1], hist[p + 2], r, g, b, a0, hist[p + 3], hist[p + 4], hist[p + 5], r, g, b, a1], nv * 7); nv += 2;
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, parts.buf); gl.bufferData(gl.ARRAY_BUFFER, pbuf.subarray(0, nv * 7), gl.STREAM_DRAW); parts.n = nv;
  }

  // ---------- drawing ----------
  let dirtyScene = true, dirtyVol = true;
  function drawScene() {
    camera();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbA); gl.viewport(0, 0, CW, CH);
    gl.clearBufferfv(gl.COLOR, 0, [...BG, 1]); gl.clearBufferfv(gl.COLOR, 1, [1, 1, 0, 1]); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.useProgram(P.mesh.p);
    gl.uniformMatrix4fv(P.mesh.u.uVP, false, VP); gl.uniform3fv(P.mesh.u.uEye, eye); gl.uniform1f(P.mesh.u.uFar, FAR);
    gl.disable(gl.CULL_FACE); // the floor and some boxes are wound either way; the shell is small
    for (const m of [shell, fansM]) if (m.n) { gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.n); }
    gl.disable(gl.DEPTH_TEST);
    drawLabels();
  }
  function drawVolume() {
    const g = grid;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbB); gl.viewport(0, 0, CW, CH);
    gl.useProgram(P.ray.p); const u = P.ray.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, vtex); gl.uniform1i(u.uVol, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tScene); gl.uniform1i(u.uScene, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tDist); gl.uniform1i(u.uDist, 2);
    gl.uniformMatrix4fv(u.uInv, false, invert(VP)); gl.uniform3fv(u.uEye, eye); gl.uniform1f(u.uFar, FAR);
    if (g) {
      gl.uniform3fv(u.uBmin, [ex0, ey0, 0]); gl.uniform3fv(u.uBmax, [ex1, ey1, CEIL]);
      gl.uniform3fv(u.uTo, [g.extent[0] - g.h, g.extent[1] - g.h, -g.h]);
      gl.uniform3fv(u.uTs, [1 / (g.h * g.NX), 1 / (g.h * g.NY), 1 / (g.h * g.NZ)]);
      gl.uniform1f(u.uStep, g.h * (small ? 0.75 : 0.5));
    }
    gl.uniform1f(u.uThr, opt.mode === 'ac' ? opt.thr * AC_MAX : opt.thr * SPEED_MAX);
    gl.uniform1f(u.uDen, opt.den); gl.uniform1f(u.uMode, opt.mode === 'ac' ? 1 : 0); gl.uniform1f(u.uHave, have && g ? 1 : 0);
    gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function drawLabels() {
    lctx.clearRect(0, 0, cssW, cssH);
    const proj = (x, y, z) => {
      const w = VP[3] * x + VP[7] * y + VP[11] * z + VP[15]; if (w <= 0.1) return null;
      return [((VP[0] * x + VP[4] * y + VP[8] * z + VP[12]) / w * 0.5 + 0.5) * cssW, (0.5 - (VP[1] * x + VP[5] * y + VP[9] * z + VP[13]) / w * 0.5) * cssH];
    };
    lctx.font = `${cssW < 500 ? 9 : 11}px JetBrains Mono, monospace`; lctx.textAlign = 'center'; lctx.fillStyle = 'rgba(185,166,143,.75)';
    for (const r of house.rooms) {
      if (/WIP|WC|WIR|Ensuite|Laundry|Entry/.test(r.name) || r.k === 'space.hall.west') continue;
      const cx = r.poly.reduce((a, p) => a + p[0], 0) / r.poly.length, cy = r.poly.reduce((a, p) => a + p[1], 0) / r.poly.length;
      const p = proj(cx, cy - (r.name === 'Dining' ? 0.9 : r.name === 'Hall' ? 0.25 : 0), 0.02); if (p) lctx.fillText(r.name.toUpperCase(), p[0], p[1]);
    }
    if (house.ac) { const a = house.ac.b, p = proj((a[0] + a[3]) / 2, a[1], a[5] + 0.12); if (p) { lctx.font = `600 ${cssW < 500 ? 10 : 12}px JetBrains Mono, monospace`; lctx.fillStyle = opt.acOn ? '#f2e6d3' : '#5a4c40'; lctx.fillText('AC', p[0], p[1]); } }
  }
  const overlay = (m, mode, blend) => {
    if (!m.n) return;
    gl.blendFunc(gl.SRC_ALPHA, blend); gl.bindVertexArray(m.vao); gl.drawArrays(mode, 0, m.n);
  };
  // one frame: redo the cached passes if needed, then the cached image, overlays and particles
  function frame(dt, fans, sel) {
    if (!CW || !CH || gl.isContextLost()) return;
    if (buildFans(fans, sel)) dirtyScene = true;
    if (dirtyScene) { drawScene(); dirtyVol = true; }
    if (dirtyVol) drawVolume();
    dirtyScene = dirtyVol = false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, CW, CH);
    gl.useProgram(P.blit.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tOut); gl.uniform1i(P.blit.u.uTex, 0);
    gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(P.over.p); const u = P.over.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tDist); gl.uniform1i(u.uDist, 0);
    gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniform3fv(u.uEye, eye); gl.uniform1f(u.uFar, FAR);
    gl.enable(gl.BLEND);
    overlay(overT, gl.TRIANGLES, gl.ONE_MINUS_SRC_ALPHA);
    overlay(overL, gl.LINES, gl.ONE_MINUS_SRC_ALPHA);
    if (have && vel && dt > 0) stepParticles(dt);
    if (have) overlay(parts, gl.LINES, gl.ONE);
    gl.disable(gl.BLEND);
  }

  buildShell();
  resize();
  return { frame, resize, setGrid, setData, setOptions, orbit, zoom, resetView, get ok() { return !gl.isContextLost(); } };
}
