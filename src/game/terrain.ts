import * as THREE from 'three';
import type { PlanetDef } from './data';

export const R = 10;
export const GW = 256;
export const GH = 128;
export const H_MIN = -1.5;
export const H_MAX = 3.0;
const TAU = Math.PI * 2;

// Unit direction of every grid cell (shared by all worlds)
const CELL_DIRS = new Float32Array(GW * GH * 3);
for (let j = 0; j < GH; j++) {
  const phi = (j / (GH - 1)) * Math.PI;
  for (let i = 0; i < GW; i++) {
    const th = (i / GW) * TAU;
    const k = (j * GW + i) * 3;
    CELL_DIRS[k] = Math.sin(phi) * Math.cos(th);
    CELL_DIRS[k + 1] = Math.cos(phi);
    CELL_DIRS[k + 2] = Math.sin(phi) * Math.sin(th);
  }
}

function hash(x: number, y: number, z: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
const sm = (t: number) => t * t * (3 - 2 * t);
function vnoise(x: number, y: number, z: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(hash(xi, yi, zi, s), hash(xi + 1, yi, zi, s), xf), l(hash(xi, yi + 1, zi, s), hash(xi + 1, yi + 1, zi, s), xf), yf),
    l(l(hash(xi, yi, zi + 1, s), hash(xi + 1, yi, zi + 1, s), xf), l(hash(xi, yi + 1, zi + 1, s), hash(xi + 1, yi + 1, zi + 1, s), xf), yf),
    zf,
  );
}
function fbm(x: number, y: number, z: number, s: number) {
  let v = 0, a = 0.5, f = 1;
  for (let o = 0; o < 5; o++) {
    v += a * vnoise(x * f + 17.3, y * f + 5.1, z * f + 9.7, s + o * 13);
    a *= 0.5;
    f *= 2.05;
  }
  return v / 0.96875;
}

export function genHeights(p: PlanetDef): Float32Array {
  const g = new Float32Array(GW * GH);
  for (let k = 0; k < GW * GH; k++) {
    const x = CELL_DIRS[k * 3], y = CELL_DIRS[k * 3 + 1], z = CELL_DIRS[k * 3 + 2];
    const base = (fbm(x * 1.5, y * 1.5, z * 1.5, p.seed) - 0.5) * 3.4;
    const ridge = 1 - Math.abs(fbm(x * 3.2, y * 3.2, z * 3.2, p.seed + 99) - 0.5) * 2;
    let h = base * p.amp + (base > 0 ? ridge * ridge * base * 0.7 * p.amp : 0);
    h = Math.max(H_MIN, Math.min(H_MAX - 0.6, h));
    g[k] = h;
  }
  return g;
}

export function sampleH(g: Float32Array, x: number, y: number, z: number): number {
  const phi = Math.acos(y > 1 ? 1 : y < -1 ? -1 : y);
  let th = Math.atan2(z, x);
  if (th < 0) th += TAU;
  const fi = (th / TAU) * GW;
  const fj = (phi / Math.PI) * (GH - 1);
  const fi0 = Math.floor(fi);
  const i0 = fi0 % GW;
  const i1 = (i0 + 1) % GW;
  let j0 = Math.floor(fj);
  if (j0 > GH - 2) j0 = GH - 2;
  const a = fi - fi0;
  const b = fj - j0;
  const r0 = j0 * GW, r1 = r0 + GW;
  return (g[r0 + i0] * (1 - a) + g[r0 + i1] * a) * (1 - b) + (g[r1 + i0] * (1 - a) + g[r1 + i1] * a) * b;
}

/** Smooth additive brush on the sphere. radius is angular (radians). */
export function brush(g: Float32Array, cx: number, cy: number, cz: number, radius: number, amount: number) {
  const phi = Math.acos(cy > 1 ? 1 : cy < -1 ? -1 : cy);
  const j0 = Math.max(0, Math.floor(((phi - radius) / Math.PI) * (GH - 1)));
  const j1 = Math.min(GH - 1, Math.ceil(((phi + radius) / Math.PI) * (GH - 1)));
  const cosR = Math.cos(radius);
  for (let j = j0; j <= j1; j++) {
    for (let i = 0; i < GW; i++) {
      const k = j * GW + i;
      const d = CELL_DIRS[k * 3] * cx + CELL_DIRS[k * 3 + 1] * cy + CELL_DIRS[k * 3 + 2] * cz;
      if (d <= cosR) continue;
      const t = 1 - Math.acos(d > 1 ? 1 : d) / radius;
      const v = g[k] + amount * sm(t);
      g[k] = v < H_MIN ? H_MIN : v > H_MAX ? H_MAX : v;
    }
  }
}

const _p = new THREE.Vector3();
/** Ray-march against the edited terrain (and water surface). Returns unit direction of the hit or null. */
export function raycastTerrain(g: Float32Array, sea: number, o: THREE.Vector3, d: THREE.Vector3, out: THREE.Vector3): boolean {
  const RO = R + H_MAX + 0.1;
  const b = o.dot(d);
  const c = o.dot(o) - RO * RO;
  const disc = b * b - c;
  if (disc < 0) return false;
  const sq = Math.sqrt(disc);
  let t = Math.max(0, -b - sq);
  const tEnd = -b + sq;
  const step = 0.1;
  let prev = t;
  while (t <= tEnd) {
    _p.copy(d).multiplyScalar(t).add(o);
    const r = _p.length();
    const h = Math.max(sea, sampleH(g, _p.x / r, _p.y / r, _p.z / r));
    if (r <= R + h) {
      let lo = prev, hi = t;
      for (let i = 0; i < 5; i++) {
        const m = (lo + hi) / 2;
        _p.copy(d).multiplyScalar(m).add(o);
        const rm = _p.length();
        const hm = Math.max(sea, sampleH(g, _p.x / rm, _p.y / rm, _p.z / rm));
        if (rm <= R + hm) hi = m; else lo = m;
      }
      out.copy(d).multiplyScalar(hi).add(o).normalize();
      return true;
    }
    prev = t;
    t += step;
  }
  return false;
}

const STOPS = [-0.55, 0.0, 0.1, 0.55, 1.15, 1.9];

export class PlanetMesh {
  mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private count: number;
  private dirs: Float32Array;
  private idx: Uint32Array;
  private wts: Float32Array;
  private hs: Float32Array;
  private jit: Float32Array;
  private pal: THREE.Color[] = [];
  private palFor = '';

  constructor(detail: number) {
    const geo = new THREE.IcosahedronGeometry(1, detail);
    this.geo = geo;
    const pos = geo.attributes.position.array as Float32Array;
    const n = (this.count = pos.length / 3);
    this.dirs = new Float32Array(pos.length);
    this.idx = new Uint32Array(n * 4);
    this.wts = new Float32Array(n * 2);
    this.hs = new Float32Array(n);
    this.jit = new Float32Array(n / 3);
    for (let f = 0; f < n / 3; f++) this.jit[f] = 0.93 + Math.random() * 0.14;
    for (let v = 0; v < n; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      const l = Math.hypot(x, y, z);
      const dx = x / l, dy = y / l, dz = z / l;
      this.dirs[v * 3] = dx; this.dirs[v * 3 + 1] = dy; this.dirs[v * 3 + 2] = dz;
      const phi = Math.acos(Math.max(-1, Math.min(1, dy)));
      let th = Math.atan2(dz, dx);
      if (th < 0) th += TAU;
      const fi = (th / TAU) * GW, fj = (phi / Math.PI) * (GH - 1);
      const fi0 = Math.floor(fi);
      const i0 = fi0 % GW, i1 = (i0 + 1) % GW;
      const j0 = Math.min(GH - 2, Math.floor(fj));
      this.idx[v * 4] = j0 * GW + i0;
      this.idx[v * 4 + 1] = j0 * GW + i1;
      this.idx[v * 4 + 2] = (j0 + 1) * GW + i0;
      this.idx[v * 4 + 3] = (j0 + 1) * GW + i1;
      this.wts[v * 2] = fi - fi0;
      this.wts[v * 2 + 1] = fj - j0;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R + H_MAX + 1);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
  }

  update(g: Float32Array, p: PlanetDef) {
    if (this.palFor !== p.id) {
      this.pal = p.colors.map((c) => new THREE.Color(c));
      this.palFor = p.id;
    }
    const pal = this.pal;
    const pos = this.geo.attributes.position.array as Float32Array;
    const col = this.geo.attributes.color.array as Float32Array;
    const { dirs, idx, wts, hs, jit } = this;
    const n = this.count;
    for (let v = 0; v < n; v++) {
      const k = v * 4, a = wts[v * 2], b = wts[v * 2 + 1];
      const h = (g[idx[k]] * (1 - a) + g[idx[k + 1]] * a) * (1 - b) + (g[idx[k + 2]] * (1 - a) + g[idx[k + 3]] * a) * b;
      hs[v] = h;
      const r = R + h;
      pos[v * 3] = dirs[v * 3] * r;
      pos[v * 3 + 1] = dirs[v * 3 + 1] * r;
      pos[v * 3 + 2] = dirs[v * 3 + 2] * r;
    }
    const sea = p.sea;
    // dry worlds sit far above their "sea": stretch the colour ramp so they are not all peaks
    const k = 1 + Math.max(0, -sea) * 1.6;
    for (let f = 0; f < n / 3; f++) {
      let e = (hs[f * 3] + hs[f * 3 + 1] + hs[f * 3 + 2]) / 3 - sea;
      if (e > 0) e /= k;
      let s = 0;
      while (s < 4 && e > STOPS[s + 1]) s++;
      let t = (e - STOPS[s]) / (STOPS[s + 1] - STOPS[s]);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const c0 = pal[s], c1 = pal[s + 1], j = jit[f];
      const r = (c0.r + (c1.r - c0.r) * t) * j;
      const gg = (c0.g + (c1.g - c0.g) * t) * j;
      const bb = (c0.b + (c1.b - c0.b) * t) * j;
      for (let q = 0; q < 3; q++) {
        const o = (f * 3 + q) * 3;
        col[o] = r; col[o + 1] = gg; col[o + 2] = bb;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
