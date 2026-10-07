// 3D airflow in the real house: lattice Boltzmann (D3Q19) with a regularised BGK collision and a Smagorinsky
// LES closure, plus a passive "AC air" tracer carried on the same grid.
//
// Geometry comes from scripts/extract-house-3d.py (home-digital-twin shell, fit-out and default furniture), all as
// axis-aligned boxes. Cells are cubes; the vertical spacing is chosen so the ceiling (2.59 m) lands on a cell face.
// Walls are rasterised one cell thick (the cell row holding the wall's centre line), which keeps 7 cm studwork
// watertight without thickening it. Door heads, sills, joinery, furniture and the AC head are real solids.
//
// Sources:
//  - The split-system head adds air at its louvre (mass and momentum, as its own equilibrium) and takes the same mass
//    back out at its intake grille on top, so the house neither gains nor loses air. Injected air is tagged with the
//    tracer at concentration 1. The tracer is advected with the flow (first-order upwind, monotone) and diffused with
//    the LES eddy diffusivity. An optional decay stands in for heat gains (AC air slowly stops being "cool").
//  - Fans are actuator discs: a fixed thrust T = rho (pi/4) D^2 U^2 spread over the cells of the disc, so the far-field
//    momentum flux matches a real fan of that outlet diameter and speed even though the disc is only a few cells wide.
//  - Optional buoyancy: AC air is denser (cooler by dT at full concentration), a Boussinesq body force.
//
// Units: lattice speed = LS x physical speed (m/s), so dt = LS x h seconds per step. Read it as a model of where the
// air can go and how strongly, not as certified CFD: the grid is 15 to 25 cm and the walls are no-slip bounce-back.

const CX = [0, 1, -1, 0, 0, 0, 0, 1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0];
const CY = [0, 0, 0, 1, -1, 0, 0, 1, -1, -1, 1, 0, 0, 0, 0, 1, -1, 1, -1];
const CZ = [0, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0, 1, -1, -1, 1, 1, -1, -1, 1];
const OPP = [0, 2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17];
const WQ = CX.map((_, q) => (q === 0 ? 1 / 3 : q < 7 ? 1 / 18 : 1 / 36));
const C13 = 1 / 3;
export const BEDROOMS = ['Bed 1', 'Bed 2', 'Bed 3', 'Bed 4', 'Media'];
const PUBLIC = new Set(['Hall', 'Retreat', 'Living', 'Dining', 'Kitchen', 'Entry']);

function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}


// One fused stream + collide pass over the fluid cells (pull scheme: nb holds, for each cell and direction, the index
// of the population to read, already resolved to the cell's own opposite population at a wall = half-way bounce-back).
// Generated and unrolled for speed.
function collideKernel(f, g, nb, flag, fanF, c, U, V, Wz, R, NU, n, gb, cref, leakK, tau0, smag) {
  for (let t = 0; t < n; t++) {
      const o = t * 18;
      const a0 = f[t];
      const a1 = f[nb[o + 0]];
      const a2 = f[nb[o + 1]];
      const a3 = f[nb[o + 2]];
      const a4 = f[nb[o + 3]];
      const a5 = f[nb[o + 4]];
      const a6 = f[nb[o + 5]];
      const a7 = f[nb[o + 6]];
      const a8 = f[nb[o + 7]];
      const a9 = f[nb[o + 8]];
      const a10 = f[nb[o + 9]];
      const a11 = f[nb[o + 10]];
      const a12 = f[nb[o + 11]];
      const a13 = f[nb[o + 12]];
      const a14 = f[nb[o + 13]];
      const a15 = f[nb[o + 14]];
      const a16 = f[nb[o + 15]];
      const a17 = f[nb[o + 16]];
      const a18 = f[nb[o + 17]];
      const r = a0 + a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12 + a13 + a14 + a15 + a16 + a17 + a18;
      const jx = a1 - a2 + a7 - a8 + a9 - a10 + a11 - a12 + a13 - a14;
      const jy = a3 - a4 + a7 - a8 - a9 + a10 + a15 - a16 + a17 - a18;
      const jz = a5 - a6 + a11 - a12 - a13 + a14 + a15 - a16 - a17 + a18;
      const ir = 1 / r;
      // forces: buoyancy of AC air (cold air sinks), fan thrust, door-undercut drag
      let Fx = 0, Fy = 0, Fz = gb * (cref - c[t]) * r;
      const fl = flag[t];
      if (fl !== 0) {
        if (fl & 1) { Fx += fanF[3 * t]; Fy += fanF[3 * t + 1]; Fz += fanF[3 * t + 2]; }
        if (fl & 2) { Fx -= leakK * jx; Fy -= leakK * jy; Fz -= leakK * jz; }
      }
      const ux = (jx + 0.5 * Fx) * ir, uy = (jy + 0.5 * Fy) * ir, uz = (jz + 0.5 * Fz) * ir;
      const pxx = a1 + a2 + a7 + a8 + a9 + a10 + a11 + a12 + a13 + a14 - r * (ux * ux + C13);
      const pyy = a3 + a4 + a7 + a8 + a9 + a10 + a15 + a16 + a17 + a18 - r * (uy * uy + C13);
      const pzz = a5 + a6 + a11 + a12 + a13 + a14 + a15 + a16 + a17 + a18 - r * (uz * uz + C13);
      const pxy = a7 + a8 - a9 - a10 - r * ux * uy;
      const pxz = a11 + a12 - a13 - a14 - r * ux * uz;
      const pyz = a15 + a16 - a17 - a18 - r * uy * uz;
      const Q = Math.sqrt(pxx * pxx + pyy * pyy + pzz * pzz + 2 * (pxy * pxy + pxz * pxz + pyz * pyz));
      const tau = 0.5 * (tau0 + Math.sqrt(tau0 * tau0 + smag * Q * ir));
      const k1 = 1 - 1 / tau;
      const usq = 1.5 * (ux * ux + uy * uy + uz * uz);
      // 3 w_i F.c_i forcing and 4.5 w_i (c c - I/3):P regularised non-equilibrium, pre-scaled by w
      const fx = 3 * Fx, fy = 3 * Fy, fz = 3 * Fz;
      const qa = 4.5 * k1;
      const nxx = qa * pxx, nyy = qa * pyy, nzz = qa * pzz, nxy = qa * pxy, nxz = qa * pxz, nyz = qa * pyz, ntr = (nxx + nyy + nzz) / 3;
      g[t] = 0.333333333 * (r * (1 - usq) - ntr);
      { const e = ux; g[1 * n + t] = 0.0555555556 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nxx - ntr + fx); }
      { const e = -ux; g[2 * n + t] = 0.0555555556 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nxx - ntr - fx); }
      { const e = uy; g[3 * n + t] = 0.0555555556 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nyy - ntr + fy); }
      { const e = -uy; g[4 * n + t] = 0.0555555556 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nyy - ntr - fy); }
      { const e = uz; g[5 * n + t] = 0.0555555556 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nzz - ntr + fz); }
      { const e = -uz; g[6 * n + t] = 0.0555555556 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nzz - ntr - fz); }
      { const e = ux + uy; g[7 * n + t] = 0.0277777778 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nxx + nyy - ntr + 2 * nxy + fx + fy); }
      { const e = -ux - uy; g[8 * n + t] = 0.0277777778 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nxx + nyy - ntr + 2 * nxy - fx - fy); }
      { const e = ux - uy; g[9 * n + t] = 0.0277777778 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nxx + nyy - ntr - 2 * nxy + fx - fy); }
      { const e = -ux + uy; g[10 * n + t] = 0.0277777778 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nxx + nyy - ntr - 2 * nxy - fx + fy); }
      { const e = ux + uz; g[11 * n + t] = 0.0277777778 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nxx + nzz - ntr + 2 * nxz + fx + fz); }
      { const e = -ux - uz; g[12 * n + t] = 0.0277777778 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nxx + nzz - ntr + 2 * nxz - fx - fz); }
      { const e = ux - uz; g[13 * n + t] = 0.0277777778 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nxx + nzz - ntr - 2 * nxz + fx - fz); }
      { const e = -ux + uz; g[14 * n + t] = 0.0277777778 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nxx + nzz - ntr - 2 * nxz - fx + fz); }
      { const e = uy + uz; g[15 * n + t] = 0.0277777778 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nyy + nzz - ntr + 2 * nyz + fy + fz); }
      { const e = -uy - uz; g[16 * n + t] = 0.0277777778 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nyy + nzz - ntr + 2 * nyz - fy - fz); }
      { const e = uy - uz; g[17 * n + t] = 0.0277777778 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nyy + nzz - ntr - 2 * nyz + fy - fz); }
      { const e = -uy + uz; g[18 * n + t] = 0.0277777778 * (r * (1 + 3 * e + 4.5 * e * e - usq) + nyy + nzz - ntr - 2 * nyz - fy + fz); }
      U[t] = ux; V[t] = uy; Wz[t] = uz; R[t] = r; NU[t] = (tau - 0.5) / 3;
  }
}

export function createSim3D(house, opts = {}) {
  const ceil = house.ceiling_z;
  const nz = opts.layers ?? 15;           // cells floor to ceiling
  const h = ceil / nz;                     // cell size (m)
  const LS = opts.LS ?? 0.025;             // lattice speed per m/s
  const dt = LS * h;                       // seconds per step
  const nu0 = opts.nu0 ?? 0.0006;          // base lattice viscosity (molecular air is ~1e-6 here: the LES does the work)
  const cs = opts.cs ?? 0.16;              // Smagorinsky constant
  const tau0 = 0.5 + 3 * nu0;
  const smag = 18 * Math.SQRT2 * cs * cs;
  const Sc = 0.7;                          // turbulent Schmidt number for the tracer
  const [x0, y0, x1, y1] = house.extent;
  const NX = Math.ceil((x1 - x0) / h) + 2, NY = Math.ceil((y1 - y0) / h) + 2, NZ = nz + 2;
  const NXY = NX * NY, N = NXY * NZ;
  const X = (i) => x0 + (i - 0.5) * h, Y = (j) => y0 + (j - 0.5) * h, Z = (l) => (l - 0.5) * h;
  const roomNames = [...new Set(house.rooms.map((r) => r.name))];

  let doorsOpen = opts.doorsOpen ?? true, furniture = opts.furniture ?? true;
  let dT = opts.dT ?? 8;                   // K colder than the room at full AC-air concentration (0 = no buoyancy)
  let decayS = opts.decay ?? 0;            // e-folding time (s) of the tracer, 0 = none

  const solid = new Uint8Array(N), room = new Int8Array(N), doorway = new Int16Array(N);
  let idx = new Int32Array(N), nF = 0, cellOf = new Int32Array(0);
  let nb, px, py, pz, flag, fanF, f, g, U, V, Wz, R, NU, c, dc, occRoom;
  let doorCells = [];
  let leakK = 0;

  // ---- index ranges on the grid
  const centreRange = (b0, b1, o, n) => {
    let a = Math.ceil((b0 - o) / h + 0.5 - 1e-9), e = Math.floor((b1 - o) / h + 0.5 + 1e-9);
    a = Math.max(0, a); e = Math.min(n - 1, e);
    return [a, e];
  };
  // centre rule, or the single cell holding the midline when the box is thinner than a cell
  const hybridRange = (b0, b1, o, n) => {
    const [a, e] = centreRange(b0, b1, o, n);
    if (a <= e) return [a, e];
    const m = Math.min(n - 1, Math.max(0, Math.floor(((b0 + b1) / 2 - o) / h) + 1));
    return [m, m];
  };
  const zRange = (z0, z1, hybrid) => {
    const lo = z0 <= 1e-6 ? -1 : z0, hi = z1 >= ceil - 1e-3 ? ceil + 1 : z1;
    return hybrid ? hybridRange(lo, hi, 0, NZ) : centreRange(lo, hi, 0, NZ);
  };
  function fillBox(b, val, hybrid) {
    const [i0, i1] = hybrid ? hybridRange(b[0], b[3], x0, NX) : centreRange(b[0], b[3], x0, NX);
    const [j0, j1] = hybrid ? hybridRange(b[1], b[4], y0, NY) : centreRange(b[1], b[4], y0, NY);
    const [l0, l1] = zRange(b[2], b[5], hybrid);
    const out = [];
    for (let l = l0; l <= l1; l++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = i + NX * (j + NY * l);
      if (val !== null) solid[k] = val;
      out.push(k);
    }
    return out;
  }

  function buildMask() {
    solid.fill(1); room.fill(-1); doorway.fill(-1);
    // 1. rooms: cell centre inside an included space, between floor and ceiling
    for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
      const x = X(i), y = Y(j);
      let rr = -1;
      for (const q of house.rooms) if (inPoly(x, y, q.poly)) { rr = roomNames.indexOf(q.name); break; }
      if (rr < 0) continue;
      for (let l = 1; l <= nz; l++) { const k = i + NX * (j + NY * l); solid[k] = 0; room[k] = rr; }
    }
    // 2. walls (with door heads and sills), columns, closed windows and doors: one cell thick, watertight
    for (const s of house.solids) fillBox(s.b, 1, true);
    // 3. doorways: open the wall cells under the head
    doorCells = [];
    house.doors.forEach((d, di) => {
      const b = d.b;
      const ax = d.axis === 'x';
      const [i0, i1] = ax ? hybridRange(b[0], b[3], x0, NX) : centreRange(b[0], b[3], x0, NX);
      const [j0, j1] = ax ? centreRange(b[1], b[4], y0, NY) : hybridRange(b[1], b[4], y0, NY);
      const [l0, l1] = centreRange(0, d.head_z, 0, NZ);
      const shut = d.closable && !doorsOpen;
      const cells = [];
      const along = ax ? [j0, j1] : [i0, i1];
      const mid = Math.round((along[0] + along[1]) / 2);
      for (let l = Math.max(1, l0); l <= l1; l++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = i + NX * (j + NY * l);
        // a closed leaf keeps one floor cell open: the 12 mm undercut, throttled by drag (see leakK)
        const leak = shut && l === 1 && (ax ? j : i) === mid;
        if (shut && !leak) { solid[k] = 1; continue; }
        solid[k] = 0; room[k] = -2; doorway[k] = leak ? 1000 + di : di;
        cells.push(k);
      }
      // which side is the private room: the flow into it is "in"
      const priv = PUBLIC.has(d.joins[0]) ? 1 : 0;
      doorCells.push({ name: d.name.replace(' Door', ''), room: d.joins[priv], sign: priv === 0 ? -1 : 1, axis: d.axis, cells, closed: shut });
    });
    // 4. joinery, furniture, the AC head: real solids (cell centre inside the box)
    for (const o of house.joinery) fillBox(o.b, 1, false);
    if (furniture) for (const o of house.furniture) fillBox(o.b, 1, false);
    if (house.ac) fillBox(house.ac.b, 1, false);
    for (let k = 0; k < N; k++) if (solid[k]) room[k] = -1;

    // compact fluid list
    idx.fill(-1);
    const list = [];
    for (let k = 0; k < N; k++) if (!solid[k]) { idx[k] = list.length; list.push(k); }
    nF = list.length; cellOf = Int32Array.from(list);
    nb = new Int32Array(nF * 18);
    px = new Int32Array(nF); py = new Int32Array(nF); pz = new Int32Array(nF);
    occRoom = new Int8Array(nF).fill(-1);
    for (let t = 0; t < nF; t++) {
      const k = cellOf[t];
      for (let q = 1; q < 19; q++) {
        const s = k - CX[q] - CY[q] * NX - CZ[q] * NXY; // pull from upstream
        nb[t * 18 + q - 1] = solid[s] ? OPP[q] * nF + t : q * nF + idx[s];
      }
      px[t] = solid[k + 1] ? -1 : idx[k + 1];
      py[t] = solid[k + NX] ? -1 : idx[k + NX];
      pz[t] = solid[k + NXY] ? -1 : idx[k + NXY];
      const l = Math.floor(k / NXY), z = Z(l);
      if (room[k] >= 0 && z >= 0.1 && z <= 1.8) occRoom[t] = room[k];
    }
    flag = new Uint8Array(nF); fanF = new Float32Array(nF * 3);
    f = new Float32Array(nF * 19); g = new Float32Array(nF * 19);
    U = new Float32Array(nF); V = new Float32Array(nF); Wz = new Float32Array(nF); R = new Float32Array(nF); NU = new Float32Array(nF);
    c = new Float32Array(nF); dc = new Float32Array(nF);
    // door undercut: linear drag so one open cell passes what a 12 mm x 0.87 m undercut (Cd 0.6) passes at 0.1 Pa
    {
      const dp = 0.1, rhoA = 1.2, Auc = 0.012 * 0.87;
      const uT = ((0.6 * Auc) / (h * h)) * Math.sqrt((2 * dp) / rhoA) * LS;  // target lattice speed in the cell
      const dRho = dp / ((rhoA / 3) / (LS * LS));                            // lattice density difference for dp
      leakK = Math.min(1, dRho / 3 / uT);
    }
    for (const d of doorCells) for (const k of d.cells) if (doorway[k] >= 1000) flag[idx[k]] |= 2;
  }

  // ---- sources
  let outlet = new Int32Array(0), sinkCells = new Int32Array(0), sinkW = new Float32Array(0);
  let srcMass = 0, srcU = [0, 0, 0], acInfo = null, fanInfo = [];
  function setSources(cfg) {
    flag.forEach((v, t) => { flag[t] = v & ~1; });
    fanF.fill(0);
    fanInfo = [];
    // fans: actuator discs
    for (const fn of cfg.fans || []) {
      const yaw = (fn.yaw * Math.PI) / 180, pit = ((fn.pitch || 0) * Math.PI) / 180;
      const d = [Math.cos(pit) * Math.cos(yaw), Math.cos(pit) * Math.sin(yaw), Math.sin(pit)];
      const D = fn.d ?? 0.25, Rr = Math.max(D / 2, 0.6 * h);
      const cells = [];
      for (let t = 0; t < nF; t++) {
        const k = cellOf[t];
        const l = Math.floor(k / NXY), j = Math.floor((k - l * NXY) / NX), i = k - l * NXY - j * NX;
        const rx = X(i) - fn.x, ry = Y(j) - fn.y, rz = Z(l) - fn.z;
        if (Math.abs(rx) > Rr + h || Math.abs(ry) > Rr + h || Math.abs(rz) > Rr + h) continue;
        const ax = rx * d[0] + ry * d[1] + rz * d[2];
        const rad = Math.sqrt(Math.max(0, rx * rx + ry * ry + rz * rz - ax * ax));
        if (Math.abs(ax) <= 0.5 * h + 1e-6 && rad <= Rr) cells.push(t);
      }
      if (!cells.length) {
        let best = -1, bd = 1e9;
        for (let t = 0; t < nF; t++) {
          const k = cellOf[t], l = Math.floor(k / NXY), j = Math.floor((k - l * NXY) / NX), i = k - l * NXY - j * NX;
          const dd = (X(i) - fn.x) ** 2 + (Y(j) - fn.y) ** 2 + (Z(l) - fn.z) ** 2;
          if (dd < bd) { bd = dd; best = t; }
        }
        if (best >= 0 && bd < 0.5) cells.push(best);
      }
      const thrust = (Math.PI / 4) * D * D * fn.speed * fn.speed; // T / rho (m^4/s^2)
      const per = cells.length ? (thrust * dt * dt) / (cells.length * h ** 4) : 0;
      for (const t of cells) { flag[t] |= 1; fanF[3 * t] += per * d[0]; fanF[3 * t + 1] += per * d[1]; fanF[3 * t + 2] += per * d[2]; }
      fanInfo.push({ cells: cells.length, thrustN: 1.2 * thrust });
    }
    // split system: louvre outlet in front of the bottom of the head, intake on top
    const ac = house.ac, a = cfg.ac;
    outlet = new Int32Array(0); sinkCells = new Int32Array(0); srcMass = 0; acInfo = null;
    if (ac && a && a.on && a.flow > 0) {
      const [bx0, by0, bz0, bx1, by1, bz1] = ac.b;
      const nrm = ac.normal; // [0, -1]: out of the north wall
      const th = ((a.louvre ?? 15) * Math.PI) / 180;      // degrees below horizontal
      srcU = [nrm[0] * Math.cos(th) * a.speed * LS, nrm[1] * Math.cos(th) * a.speed * LS, -Math.sin(th) * a.speed * LS];
      const front = nrm[1] < 0 ? by0 : nrm[1] > 0 ? by1 : nrm[0] < 0 ? bx0 : bx1;
      const lz = Math.floor((bz0 + 0.06) / h) + 1;          // louvre: bottom front edge of the head
      const lTop = Math.min(nz, Math.floor((bz1 + 0.02) / h) + 1);
      const out = [], snk = [];
      const span = nrm[1] !== 0 ? centreRange(bx0 + 0.05, bx1 - 0.05, x0, NX) : centreRange(by0 + 0.05, by1 - 0.05, y0, NY);
      for (let s = span[0]; s <= span[1]; s++) {
        // first fluid cell in front of the head at the louvre height
        for (let st = 0; st < 4; st++) {
          const i = nrm[1] !== 0 ? s : Math.floor((front - x0) / h) + 1 + Math.sign(nrm[0]) * st;
          const j = nrm[1] !== 0 ? Math.floor((front - y0) / h) + 1 + Math.sign(nrm[1]) * st : s;
          const k = i + NX * (j + NY * lz);
          if (!solid[k]) { out.push(idx[k]); break; }
        }
        // intake: from the top of the head to the ceiling, over the head and one cell in front
        for (let l = lTop; l <= nz; l++) for (let st = -2; st <= 1; st++) {
          const i = nrm[1] !== 0 ? s : Math.floor((front - x0) / h) + 1 + Math.sign(nrm[0]) * st;
          const j = nrm[1] !== 0 ? Math.floor((front - y0) / h) + 1 + Math.sign(nrm[1]) * st : s;
          const k = i + NX * (j + NY * l);
          if (!solid[k] && !out.includes(idx[k]) && !snk.includes(idx[k])) snk.push(idx[k]);
        }
      }
      outlet = Int32Array.from(out); sinkCells = Int32Array.from(snk);
      srcMass = out.length ? (a.flow * dt) / (out.length * h ** 3) : 0;
      sinkW = new Float32Array(snk.length).fill(snk.length ? (srcMass * out.length) / snk.length : 0);
      acInfo = { outletCells: out.length, intakeCells: snk.length, flow: a.flow, massPerStep: srcMass * out.length };
    }
  }

  let steps = 0, cref = 0, decayF = 1;
  function reset() {
    for (let q = 0; q < 19; q++) { f.fill(WQ[q], q * nF, (q + 1) * nF); g.fill(WQ[q], q * nF, (q + 1) * nF); }
    U.fill(0); V.fill(0); Wz.fill(0); R.fill(1); NU.fill(nu0); c.fill(0); dc.fill(0);
    steps = 0; cref = 0;
  }

  function collide() {
    collideKernel(f, g, nb, flag, fanF, c, U, V, Wz, R, NU, nF, gb, cref, leakK, tau0, smag);
  }
  let gb = 0;

  function sources() {
    // split-system outlet: add mass at the louvre velocity (its own equilibrium), tagged as AC air
    const m = srcMass, [ux, uy, uz] = srcU, usq = 1.5 * (ux * ux + uy * uy + uz * uz), n = nF;
    for (let s = 0; s < outlet.length; s++) {
      const t = outlet[s];
      for (let q = 0; q < 19; q++) {
        const e = CX[q] * ux + CY[q] * uy + CZ[q] * uz;
        g[q * n + t] += m * WQ[q] * (1 + 3 * e + 4.5 * e * e - usq);
      }
    }
    // intake: remove exactly the same mass (each population scaled, so momentum goes with it)
    for (let s = 0; s < sinkCells.length; s++) {
      const t = sinkCells[s];
      let r = 0; for (let q = 0; q < 19; q++) r += g[q * n + t];
      const keep = 1 - sinkW[s] / r;
      for (let q = 0; q < 19; q++) g[q * n + t] *= keep;
    }
  }

  function tracer() {
    const n = nF;
    const D0 = 0.002;
    for (let t = 0; t < n; t++) {
      const ct = c[t], ut = U[t], vt = V[t], wt = Wz[t], nt = NU[t];
      let m = px[t];
      if (m >= 0) {
        const uf = 0.5 * (ut + U[m]), D = Math.min(0.08, D0 + (0.5 * (nt + NU[m]) - nu0) / Sc), cm = c[m];
        if (uf > 0) dc[m] += uf * (ct - cm); else dc[t] -= uf * (cm - ct);
        const df = D * (cm - ct); dc[t] += df; dc[m] -= df;
      }
      m = py[t];
      if (m >= 0) {
        const uf = 0.5 * (vt + V[m]), D = Math.min(0.08, D0 + (0.5 * (nt + NU[m]) - nu0) / Sc), cm = c[m];
        if (uf > 0) dc[m] += uf * (ct - cm); else dc[t] -= uf * (cm - ct);
        const df = D * (cm - ct); dc[t] += df; dc[m] -= df;
      }
      m = pz[t];
      if (m >= 0) {
        const uf = 0.5 * (wt + Wz[m]), D = Math.min(0.08, D0 + (0.5 * (nt + NU[m]) - nu0) / Sc), cm = c[m];
        if (uf > 0) dc[m] += uf * (ct - cm); else dc[t] -= uf * (cm - ct);
        const df = D * (cm - ct); dc[t] += df; dc[m] -= df;
      }
    }
    let sum = 0;
    for (let t = 0; t < n; t++) {
      let v = (c[t] + dc[t]) * decayF;
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      c[t] = v; dc[t] = 0; sum += v;
    }
    for (let s = 0; s < outlet.length; s++) c[outlet[s]] = 1;
    cref = sum / n;
  }

  function step(count = 1) {
    decayF = decayS > 0 ? Math.exp(-dt / decayS) : 1;
    gb = (9.81 * dT / 300) * dt * dt / h;
    for (let s = 0; s < count; s++) {
      collide();
      sources();
      const tmp = f; f = g; g = tmp;
      tracer();
      steps++;
    }
  }

  // ---- read-outs (physical units)
  const toMs = 1 / LS;
  function mass() { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; }
  function stats() {
    const nR = roomNames.length, sp = new Float64Array(nR), cc = new Float64Array(nR), cnt = new Float64Array(nR);
    let nan = false;
    for (let t = 0; t < nF; t++) {
      const r = occRoom[t]; if (r < 0) continue;
      const s = Math.sqrt(U[t] * U[t] + V[t] * V[t] + Wz[t] * Wz[t]);
      if (s !== s) nan = true;
      sp[r] += s; cc[r] += c[t]; cnt[r]++;
    }
    const rooms = {};
    roomNames.forEach((nm, r) => { if (cnt[r]) rooms[nm] = { speed: (sp[r] / cnt[r]) * toMs, ac: cc[r] / cnt[r], cells: cnt[r] }; });
    const A = h * h;
    const doors = doorCells.map((d) => {
      let inn = 0, out = 0, acIn = 0, upIn = 0, loIn = 0;
      const prof = new Float32Array(nz + 1);
      // use one plane of cells (the wall row), average if the opening is two cells thick
      for (const k of d.cells) {
        const t = idx[k]; if (t < 0) continue;
        const un = (d.axis === 'y' ? V[t] : U[t]) * d.sign * toMs;
        const l = Math.floor(k / NXY);
        prof[l] += un * A * 1000;
        if (un > 0) { inn += un * A; acIn += un * A * c[t]; if (Z(l) > 1.05) upIn += un * A; else loIn += un * A; } else out -= un * A;
      }
      return { name: d.name, room: d.room, closed: d.closed, inLs: inn * 1000, outLs: out * 1000, acInLs: acIn * 1000, upperInLs: upIn * 1000, lowerInLs: loIn * 1000, profile: prof };
    });
    return { rooms, doors, nan, cref, time: steps * dt };
  }
  function layerOf(z) { return Math.min(nz, Math.max(1, Math.floor(z / h) + 1)); }
  // horizontal slice at height z: ux, uy, uz (m/s) and tracer, NaN-free, zero in solids
  function sliceZ(z, out) {
    const l = layerOf(z), o = out || { ux: new Float32Array(NXY), uy: new Float32Array(NXY), uz: new Float32Array(NXY), c: new Float32Array(NXY) };
    for (let k2 = 0; k2 < NXY; k2++) {
      const t = idx[k2 + l * NXY];
      if (t < 0) { o.ux[k2] = o.uy[k2] = o.uz[k2] = o.c[k2] = 0; continue; }
      o.ux[k2] = U[t] * toMs; o.uy[k2] = V[t] * toMs; o.uz[k2] = Wz[t] * toMs; o.c[k2] = c[t];
    }
    o.layer = l; o.z = Z(l);
    return o;
  }
  // vertical section along y at fixed x (axis 'x') or along x at fixed y (axis 'y'): in-plane speed + w + tracer
  function section(axis, at) {
    const along = axis === 'x' ? NY : NX;
    const i = Math.min(NX - 2, Math.max(1, Math.floor((at - x0) / h) + 1)), j = Math.min(NY - 2, Math.max(1, Math.floor((at - y0) / h) + 1));
    const o = { u: new Float32Array(along * NZ), w: new Float32Array(along * NZ), c: new Float32Array(along * NZ), solid: new Uint8Array(along * NZ), n: along };
    for (let l = 0; l < NZ; l++) for (let s = 0; s < along; s++) {
      const k = axis === 'x' ? i + NX * (s + NY * l) : s + NX * (j + NY * l);
      const t = idx[k], m = s + along * l;
      if (t < 0) { o.solid[m] = 1; continue; }
      o.u[m] = (axis === 'x' ? V[t] : U[t]) * toMs; o.w[m] = Wz[t] * toMs; o.c[m] = c[t];
    }
    return o;
  }
  function solidSlice(z) {
    const l = layerOf(z), o = new Uint8Array(NXY);
    for (let k2 = 0; k2 < NXY; k2++) o[k2] = solid[k2 + l * NXY];
    return o;
  }

  buildMask();
  reset();
  return {
    NX, NY, NZ, nz, h, dt, LS, extent: house.extent, ceil, roomNames,
    get nF() { return nF; }, get steps() { return steps; }, get time() { return steps * dt; },
    get acInfo() { return acInfo; }, get fanInfo() { return fanInfo; }, get leakK() { return leakK; },
    get fields() { return { U, V, Wz, R, c, idx, cellOf }; },
    solid, step, reset, setSources, stats, sliceZ, section, solidSlice, mass, layerOf,
    setOptions(o) {
      let geom = false;
      if ('doorsOpen' in o && o.doorsOpen !== doorsOpen) { doorsOpen = o.doorsOpen; geom = true; }
      if ('furniture' in o && o.furniture !== furniture) { furniture = o.furniture; geom = true; }
      if ('dT' in o) dT = o.dT;
      if ('decay' in o) decayS = o.decay;
      if (geom) { buildMask(); reset(); }
      return geom;
    },
  };
}

// fan presets use plan coordinates (m) and compass-free yaw: 0 = east (+x), 90 = north (+y), -90 = south
export const PRESETS3D = {
  ac: { label: 'AC only', fans: [] },
  hall: { label: 'AC + fan in the hall into Bed 2', fans: [{ x: 7.36, y: 4.2, z: 0.9, yaw: -90, pitch: 0 }] },
  two: { label: 'AC + 2 fans', fans: [{ x: 9.4, y: 5.6, z: 0.9, yaw: -90, pitch: 0 }, { x: 7.36, y: 4.2, z: 0.9, yaw: -90, pitch: 0 }] },
};
