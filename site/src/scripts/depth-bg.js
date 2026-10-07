// Depth-map parallax backgrounds with a windswept transition, in one WebGL2 fragment shader.
//
// Two photographs from the top of Big Red (the dune at midday, the view at sunset), each with an AI depth
// map. Near pixels shift more than far ones as the motion input moves, which reads as real depth. Moving
// from one photo to the other, a ragged, wobbling edge of blown sand sweeps across the screen from the
// right, with a warm glowing seam and grains peeling off it, scrubbed by scroll.
//
// Replaces the old theme's two PixiJS canvases + SVG clip path with ~200 lines and no library. If WebGL2 is
// missing, the caller keeps its static <img> fallbacks.
import { subscribe } from './motion-input.js';

const VERT = `#version 300 es
in vec2 p; out vec2 v_uv;
void main() { v_uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D uA, uDA, uB, uDB;
uniform vec2 uRes, uSizeA, uSizeB, uMotion;
uniform float uMix, uTime, uOpacity, uDim, uScroll, uStrength, uVel;

// cover-fit a texture of size s into the canvas, with a 12% buffer so displaced edges never show a gap
vec2 cover(vec2 uv, vec2 s) {
  float ca = uRes.x / uRes.y, ia = s.x / s.y;
  vec2 sc = ca > ia ? vec2(1.0, ia / ca) : vec2(ca / ia, 1.0);
  return (uv - 0.5) * sc / 1.12 + 0.5;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }

vec3 sampleDepth(sampler2D img, sampler2D dep, vec2 size, vec2 uv) {
  vec2 c = cover(uv, size);
  float d = texture(dep, c).r;
  // near (bright) pixels move with the motion, far ones barely; scroll lifts the near ground
  vec2 off = uMotion * (d - 0.45) * 0.045 * uStrength + vec2(0.0, (d - 0.3) * uScroll * 0.035);
  return texture(img, c + off).rgb;
}

void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 a = sampleDepth(uA, uDA, uSizeA, uv);
  vec3 b = sampleDepth(uB, uDB, uSizeB, uv);
  // windswept edge: sweeps right to left as uMix goes 0 -> 1. Bulging fbm lobes plus a travelling wobble
  // that speeds up while you scroll.
  float t = uTime * (1.0 + uVel * 2.5);
  float y = uv.y;
  float ragged = (fbm(vec2(y * 3.2, t * 0.12)) - 0.5) * 0.36 + sin(y * 11.0 + t * 0.8) * 0.03 + sin(y * 27.0 - t * 1.7) * 0.012;
  float edge = mix(1.25, -0.25, uMix) + ragged;
  float side = uv.x - edge;                  // > 0: wind has passed, show B
  float m = smoothstep(-0.004, 0.004, side);
  vec3 col = mix(a, b, m);
  // glowing sand seam and grains peeling off into the A side
  float seam = exp(-abs(side) * 70.0);
  float grains = step(0.985, hash(floor(uv * uRes / 3.0) + floor(t * 6.0))) * smoothstep(0.0, -0.12, side) * exp(side * 18.0);
  float live = step(0.001, uMix) * step(uMix, 0.999);
  col += live * (vec3(1.0, 0.62, 0.25) * seam * 0.9 + vec3(1.0, 0.8, 0.55) * grains * 0.8);
  // grade towards the site's ink and vignette, so text stays readable
  float vig = smoothstep(1.25, 0.35, length((v_uv - 0.5) * vec2(uRes.x / uRes.y, 1.0)));
  col = mix(vec3(0.07, 0.05, 0.04), col, (1.0 - uDim) * mix(0.55, 1.0, vig));
  o = vec4(col * uOpacity, uOpacity);
}`;

export async function createDepthBackground(canvas, sources) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);

  const load = (src) => new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = rej; im.src = src; });
  const imgs = await Promise.all([sources.a, sources.da, sources.b, sources.db].map(load));
  imgs.forEach((im, i) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
  });
  ['uA', 'uDA', 'uB', 'uDB'].forEach((n, i) => gl.uniform1i(U(n), i));
  gl.uniform2f(U('uSizeA'), imgs[0].width, imgs[0].height);
  gl.uniform2f(U('uSizeB'), imgs[2].width, imgs[2].height);

  const coarse = matchMedia('(pointer: coarse)').matches;
  const params = { mix: 0, opacity: 1, dim: 0.25, scroll: 0, vel: 0, strength: coarse ? 0.9 : 1 };
  let motion = { x: 0, y: 0 };
  subscribe((s) => { motion = s; });

  function resize() {
    const dpr = Math.min(coarse ? 1.5 : 2, devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    gl.uniform2f(U('uRes'), w, h);
  }
  const t0 = performance.now();
  let raf = 0, running = false;
  function draw(now) {
    raf = 0;
    if (!running) return;
    resize();
    gl.uniform2f(U('uMotion'), motion.x || 0, motion.y || 0);
    gl.uniform1f(U('uMix'), params.mix); gl.uniform1f(U('uOpacity'), params.opacity);
    gl.uniform1f(U('uDim'), params.dim); gl.uniform1f(U('uScroll'), params.scroll);
    gl.uniform1f(U('uVel'), params.vel); gl.uniform1f(U('uStrength'), params.strength);
    gl.uniform1f(U('uTime'), (now - t0) / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    raf = requestAnimationFrame(draw);
  }
  return {
    params,
    start() { if (!running) { running = true; raf ||= requestAnimationFrame(draw); } },
    stop() { running = false; },
  };
}
