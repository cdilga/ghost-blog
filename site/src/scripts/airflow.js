// 2D airflow on a real floor plan: lattice Boltzmann (D2Q9) with a Smagorinsky LES closure.
//
// The plan is a horizontal slice of the house (see scripts/extract-house-plan.py): walls, doorways,
// joinery and furniture from the home-digital-twin model. Walls are solid. Furniture and joinery are
// "porous": each cell carries the fraction of the room height that is blocked there, which becomes a
// drag on the depth-averaged flow (a 1.8 m fridge stops most of it, a 0.45 m coffee table very little).
//
// Fans (the split-system head, a Dreo pedestal fan) are momentum sources: inside the fan's footprint
// the collision is steered towards the fan's outlet velocity, so air is entrained from around it and
// pushed on, but none is created. That is what a recirculating split system or a fan does.
//
// It is a 2D, depth-averaged slice: it cannot show the jet hugging the ceiling or a cool jet falling.
// Read it as "where can the air go, and how much of the push survives the trip", not as certified CFD.
// Real Reynolds numbers (~10^5) are far beyond any grid this size, hence the LES eddy viscosity.

const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
const EY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
const EXCLUDE = new Set(['Alfresco', 'Porch', 'Garage', 'Linen', 'Robe (Bed 2)', 'Robe (Bed 3)', 'Robe (Bed 4)']); // outside the envelope, or behind closed robe and linen sliders
const W0 = 4 / 9, W1 = 1 / 9, W2 = 1 / 36;

function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const inBox = (x, y, b, pad = 0) => x >= b[0] - pad && x <= b[2] + pad && y >= b[1] - pad && y <= b[3] + pad;

export function createSim(plan, opts = {}) {
  const h = opts.h ?? 0.1;           // cell size (m)
  const uLat = 0.1;                  // lattice speed of a fan at full speed (keeps Mach low)
  const nu = opts.nu ?? 0.003;       // base lattice viscosity
  const cs = 0.17;                   // Smagorinsky constant
  const drag = opts.drag ?? 0.006;   // per-step damping for a fully blocked cell (depth-averaged form drag)
  const tau0 = 0.5 + 3 * nu;
  const fanGain = opts.fanGain ?? 0.15;
  const [x0, y0, x1, y1] = plan.extent;
  const NX = Math.ceil((x1 - x0) / h) + 2, NY = Math.ceil((y1 - y0) / h) + 2;
  const N = NX * NY;
  const X = (i) => x0 + (i - 0.5) * h, Y = (j) => y0 + (j - 0.5) * h;
  const rooms = plan.rooms.filter((r) => !EXCLUDE.has(r.name));

  const solid = new Uint8Array(N), room = new Int16Array(N), block = new Float32Array(N);
  const src = new Int32Array(N * 9); // pull-streaming source index per direction, or -1 - k (bounce-back)
  let fluidList = new Int32Array(0);
  let doorsOpen = opts.doorsOpen ?? true;
  let furniture = opts.furniture ?? true;

  function buildMask() {
    const roomH = 2.4;
    // 1. rooms by cell centre
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const x = X(i), y = Y(j), k = j * NX + i;
      let r = -1;
      for (let q = 0; q < rooms.length; q++) if (inPoly(x, y, rooms[q].poly)) { r = q; break; }
      room[k] = r; solid[k] = r >= 0 ? 0 : 1; block[k] = 0;
    }
    // cells whose square overlaps a box (conservative: a 7 cm wall can never fall between 10 cm cells)
    const cover = (b, fn, padX = 0, padY = 0) => {
      const i0 = Math.max(0, Math.floor((b[0] - padX - x0) / h + 0.5)), i1 = Math.min(NX - 1, Math.ceil((b[2] + padX - x0) / h + 0.5) - 1);
      const j0 = Math.max(0, Math.floor((b[1] - padY - y0) / h + 0.5)), j1 = Math.min(NY - 1, Math.ceil((b[3] + padY - y0) / h + 0.5) - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * NX + i, X(i), Y(j));
    };
    // 2. walls, columns, windows, door leaves
    for (const sb of plan.solids) cover(sb.b, (k) => { solid[k] = 1; });
    // 3. doorways: carve the cells whose centre is inside the opening along the wall, through the wall's thickness
    for (const d of plan.doors) {
      if (d.external) continue;
      const closable = /^(Bed \d Door|Bath Door|WC|Media)$/.test(d.name); // doors a person would shut
      if (closable && !doorsOpen) continue;
      const thinX = d.b[2] - d.b[0] < d.b[3] - d.b[1];
      cover(d.b, (k, x, y) => {
        const along = thinX ? y >= d.b[1] && y <= d.b[3] : x >= d.b[0] && x <= d.b[2];
        if (!along) return;
        solid[k] = 0;
        if (room[k] < 0) room[k] = -2; // a doorway, not a room
      }, thinX ? h : 0, thinX ? 0 : h);
    }
    // 4. furniture and joinery: fraction of the room height blocked, by cell centre
    for (const o of plan.obstacles || []) {
      if (!furniture && o.kind === 'furniture') continue;
      const frac = Math.min(1, (Math.min(o.z[1], roomH) - Math.max(o.z[0], 0)) / roomH);
      if (frac <= 0) continue;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i;
        if (!solid[k] && inBox(X(i), Y(j), o.b, 0)) block[k] = Math.min(1, block[k] + frac);
      }
    }
    for (let k = 0; k < N; k++) {
      if (block[k] > 0.7) solid[k] = 1;
      if (solid[k]) { room[k] = -1; block[k] = 0; }
    }
    // border is always solid
    for (let i = 0; i < NX; i++) solid[i] = solid[(NY - 1) * NX + i] = 1;
    for (let j = 0; j < NY; j++) solid[j * NX] = solid[j * NX + NX - 1] = 1;
    const list = [];
    for (let k = 0; k < N; k++) {
      if (solid[k]) continue;
      list.push(k);
      for (let q = 0; q < 9; q++) { const s = k - EX[q] - EY[q] * NX; src[k * 9 + q] = solid[s] ? -1 : s; }
    }
    fluidList = Int32Array.from(list);
  }

  // structure of arrays, two buffers
  const A = Array.from({ length: 9 }, () => new Float32Array(N));
  const B = Array.from({ length: 9 }, () => new Float32Array(N));
  let f = A, g = B;
  const ux = new Float32Array(N), uy = new Float32Array(N), rho = new Float32Array(N);
  const fanU = new Float32Array(N), fanV = new Float32Array(N), isFan = new Uint8Array(N);
  let steps = 0;
  function reset() {
    const w = [W0, W1, W1, W1, W1, W2, W2, W2, W2];
    for (let q = 0; q < 9; q++) { A[q].fill(w[q]); B[q].fill(w[q]); }
    ux.fill(0); uy.fill(0); rho.fill(1); steps = 0;
  }

  // fans: { x, y, dir:[dx,dy], width (m), depth (m), speed (fraction of uLat) }
  let fans = [];
  const sink = new Float32Array(N); // per-step fractional mass removal (the split system's return air)
  let srcMass = 0;                   // mass added per step per outlet cell
  function setFans(list) {
    fans = list;
    isFan.fill(0); fanU.fill(0); fanV.fill(0); sink.fill(0);
    let nOut = 0;
    for (const fn of fans) {
      const [dx, dy] = fn.dir, n = Math.hypot(dx, dy) || 1, ex = dx / n, ey = dy / n;
      const mode = fn.kind === 'ac' ? 2 : 1;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i; if (solid[k]) continue;
        const rx = X(i) - fn.x, ry = Y(j) - fn.y;
        const along = rx * ex + ry * ey, across = -rx * ey + ry * ex;
        if (Math.abs(across) <= fn.width / 2 && along >= -fn.depth / 2 && along <= fn.depth / 2) {
          isFan[k] = mode; fanU[k] = ex * uLat * fn.speed; fanV[k] = ey * uLat * fn.speed;
          if (mode === 2) nOut++;
        }
      }
      if (mode === 2) {
        // return air: drawn in over the ceiling around and behind the head (out of this slice), within fn.returnR
        for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
          const k = j * NX + i; if (solid[k] || isFan[k]) continue;
          const rx = X(i) - fn.x, ry = Y(j) - fn.y, d = Math.hypot(rx, ry);
          if (d < fn.returnR) sink[k] += 1 - d / fn.returnR;
        }
      }
    }
    // mass balance: outlet cells add speed/depth each step; the sink removes exactly that much at rho ~ 1
    const ac = fans.find((fn) => fn.kind === 'ac');
    srcMass = ac ? (uLat * ac.speed) / Math.max(1, Math.round(ac.depth / h)) : 0;
    let wsum = 0; for (let k = 0; k < N; k++) wsum += sink[k];
    if (wsum > 0) for (let k = 0; k < N; k++) sink[k] *= (srcMass * nOut) / wsum;
  }

  function step() {
    const [f0, f1, f2, f3, f4, f5, f6, f7, f8] = f;
    const [g0, g1, g2, g3, g4, g5, g6, g7, g8] = g;
    const L = fluidList, n = L.length;
    for (let t = 0; t < n; t++) {
      const k = L[t], o = k * 9;
      // stream (pull) with half-way bounce-back
      let s;
      const a0 = f0[k];
      s = src[o + 1]; const a1 = s < 0 ? f3[k] : f1[s];
      s = src[o + 2]; const a2 = s < 0 ? f4[k] : f2[s];
      s = src[o + 3]; const a3 = s < 0 ? f1[k] : f3[s];
      s = src[o + 4]; const a4 = s < 0 ? f2[k] : f4[s];
      s = src[o + 5]; const a5 = s < 0 ? f7[k] : f5[s];
      s = src[o + 6]; const a6 = s < 0 ? f8[k] : f6[s];
      s = src[o + 7]; const a7 = s < 0 ? f5[k] : f7[s];
      s = src[o + 8]; const a8 = s < 0 ? f6[k] : f8[s];
      const r = a0 + a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8;
      let u = (a1 - a3 + a5 - a6 - a7 + a8) / r;
      let v = (a2 - a4 + a5 + a6 - a7 - a8) / r;
      // porous furniture drag, then fan steering
      const bk = block[k];
      if (bk > 0) { const d = 1 - drag * bk; u *= d; v *= d; }
      // fan: body force F towards the outlet velocity (proportional controller); equilibrium uses u + F/2
      let Fx = 0, Fy = 0;
      if (isFan[k] === 1) { Fx = (fanU[k] - u) * fanGain * r; Fy = (fanV[k] - v) * fanGain * r; u += 0.5 * Fx / r; v += 0.5 * Fy / r; }
      const uu = u * u, vv = v * v, usq = 1.5 * (uu + vv);
      const e0 = W0 * r * (1 - usq);
      const e1 = W1 * r * (1 + 3 * u + 4.5 * uu - usq);
      const e2 = W1 * r * (1 + 3 * v + 4.5 * vv - usq);
      const e3 = W1 * r * (1 - 3 * u + 4.5 * uu - usq);
      const e4 = W1 * r * (1 - 3 * v + 4.5 * vv - usq);
      const p5 = u + v, p6 = -u + v;
      const e5 = W2 * r * (1 + 3 * p5 + 4.5 * p5 * p5 - usq);
      const e6 = W2 * r * (1 + 3 * p6 + 4.5 * p6 * p6 - usq);
      const e7 = W2 * r * (1 - 3 * p5 + 4.5 * p5 * p5 - usq);
      const e8 = W2 * r * (1 - 3 * p6 + 4.5 * p6 * p6 - usq);
      // Smagorinsky: local eddy viscosity from the non-equilibrium stress
      const n1 = a1 - e1, n2 = a2 - e2, n3 = a3 - e3, n4 = a4 - e4, n5 = a5 - e5, n6 = a6 - e6, n7 = a7 - e7, n8 = a8 - e8;
      const pxx = n1 + n3 + n5 + n6 + n7 + n8, pyy = n2 + n4 + n5 + n6 + n7 + n8, pxy = n5 - n6 + n7 - n8;
      const Q = Math.sqrt(pxx * pxx + pyy * pyy + 2 * pxy * pxy);
      const tau = 0.5 * (tau0 + Math.sqrt(tau0 * tau0 + 25.46 * cs * cs * Q / r)); // 18*sqrt(2) = 25.46
      const om = 1 / tau;
      g0[k] = a0 + om * (e0 - a0); g1[k] = a1 + om * (e1 - a1); g2[k] = a2 + om * (e2 - a2);
      g3[k] = a3 + om * (e3 - a3); g4[k] = a4 + om * (e4 - a4); g5[k] = a5 + om * (e5 - a5);
      g6[k] = a6 + om * (e6 - a6); g7[k] = a7 + om * (e7 - a7); g8[k] = a8 + om * (e8 - a8);
      if (isFan[k] === 2) {
        // split-system outlet: inject mass at the louvre velocity (its own equilibrium distribution)
        const m = srcMass, U = fanU[k], V = fanV[k], q = 1.5 * (U * U + V * V), P5 = U + V, P6 = -U + V;
        g0[k] += m * W0 * (1 - q);
        g1[k] += m * W1 * (1 + 3 * U + 4.5 * U * U - q); g3[k] += m * W1 * (1 - 3 * U + 4.5 * U * U - q);
        g2[k] += m * W1 * (1 + 3 * V + 4.5 * V * V - q); g4[k] += m * W1 * (1 - 3 * V + 4.5 * V * V - q);
        g5[k] += m * W2 * (1 + 3 * P5 + 4.5 * P5 * P5 - q); g7[k] += m * W2 * (1 - 3 * P5 + 4.5 * P5 * P5 - q);
        g6[k] += m * W2 * (1 + 3 * P6 + 4.5 * P6 * P6 - q); g8[k] += m * W2 * (1 - 3 * P6 + 4.5 * P6 * P6 - q);
      } else if (sink[k] > 0) {
        const keep = 1 - sink[k] / r;
        g0[k] *= keep; g1[k] *= keep; g2[k] *= keep; g3[k] *= keep; g4[k] *= keep; g5[k] *= keep; g6[k] *= keep; g7[k] *= keep; g8[k] *= keep;
      }
      if (Fx !== 0 || Fy !== 0) {
        // first-order force term: 3 w_i (e_i . F)
        const c1 = 3 * W1, c2 = 3 * W2;
        g1[k] += c1 * Fx; g3[k] -= c1 * Fx; g2[k] += c1 * Fy; g4[k] -= c1 * Fy;
        g5[k] += c2 * (Fx + Fy); g7[k] -= c2 * (Fx + Fy); g6[k] += c2 * (-Fx + Fy); g8[k] -= c2 * (-Fx + Fy);
      }
      ux[k] = u; uy[k] = v; rho[k] = r;
    }
    const tmp = f; f = g; g = tmp;
    steps++;
  }

  // bilinear velocity at a point in metres (lattice units)
  function vel(x, y) {
    const fi = (x - x0) / h + 0.5, fj = (y - y0) / h + 0.5;
    const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j;
    if (i < 0 || j < 0 || i >= NX - 1 || j >= NY - 1) return [0, 0];
    const k = j * NX + i;
    return [
      (1 - a) * (1 - b) * ux[k] + a * (1 - b) * ux[k + 1] + (1 - a) * b * ux[k + NX] + a * b * ux[k + NX + 1],
      (1 - a) * (1 - b) * uy[k] + a * (1 - b) * uy[k + 1] + (1 - a) * b * uy[k + NX] + a * b * uy[k + NX + 1],
    ];
  }
  const cellAt = (x, y) => { const i = Math.floor((x - x0) / h + 0.5), j = Math.floor((y - y0) / h + 0.5); return i < 0 || j < 0 || i >= NX || j >= NY ? -1 : j * NX + i; };
  const isSolidAt = (x, y) => { const k = cellAt(x, y); return k < 0 || solid[k] === 1; };

  // mean speed per named room (lattice units), excluding the fans themselves
  function roomSpeeds() {
    const acc = {};
    for (let t = 0; t < fluidList.length; t++) {
      const k = fluidList[t], r = room[k]; if (r < 0 || isFan[k]) continue;
      const nm = rooms[r].name; const a = acc[nm] || (acc[nm] = [0, 0]);
      a[0] += Math.hypot(ux[k], uy[k]); a[1]++;
    }
    const out = {}; for (const nm in acc) out[nm] = acc[nm][0] / acc[nm][1];
    return out;
  }

  buildMask();
  reset();
  return {
    NX, NY, N, h, uLat, solid, block, ux, uy, rho, rooms, extent: plan.extent, room, isFan,
    get steps() { return steps; }, step, reset, setFans, vel, isSolidAt, cellAt, roomSpeeds,
    setOptions(o) { if ('doorsOpen' in o) doorsOpen = o.doorsOpen; if ('furniture' in o) furniture = o.furniture; buildMask(); setFans(fans); reset(); },
  };
}

// The split-system head from the plan. Louvres aim the jet; 0 = straight out from the wall.
export function acFan(plan, louvreDeg = 0, speed = 1) {
  const a = plan.ac, t = (louvreDeg * Math.PI) / 180;
  return { x: a.centre_x, y: a.wall_y - 0.2, dir: [Math.sin(t), -Math.cos(t)], width: a.width * 0.9, depth: 0.2, speed, kind: 'ac', returnR: 2.2 };
}
