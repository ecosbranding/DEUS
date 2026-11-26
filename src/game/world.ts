import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PlanetDef } from './data';
import { genHeights, sampleH } from './terrain';

export interface Person {
  d: THREE.Vector3; f: THREE.Vector3;
  hero: boolean; sick: number; immune: number;
  age: number; build: number; phase: number; tint: number;
}
export interface House { d: THREE.Vector3; f: THREE.Vector3; age: number; s: number; h: number }
export interface Tree { d: THREE.Vector3; f: THREE.Vector3; age: number; s: number; h: number }
export interface Animal {
  d: THREE.Vector3; f: THREE.Vector3;
  color: THREE.Color; s: number; age: number; phase: number; speed: number;
}
export interface World {
  def: PlanetDef;
  g: Float32Array;
  people: Person[];
  houses: House[];
  trees: Tree[];
  animals: Animal[];
  heroes: number;
  hub?: THREE.Vector3;
}

export const CAP = { people: 260, houses: 110, trees: 420, animals: 120 };

export function makeWorld(def: PlanetDef): World {
  return { def, g: genHeights(def), people: [], houses: [], trees: [], animals: [], heroes: 0 };
}

const _a = new THREE.Vector3();

/** Random unit tangent at d. */
export function randTangent(d: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  do {
    out.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    out.addScaledVector(d, -out.dot(d));
  } while (out.lengthSq() < 0.01);
  return out.normalize();
}

/** Random direction within angular radius ang of d. */
export function jitterDir(d: THREE.Vector3, ang: number, out: THREE.Vector3): THREE.Vector3 {
  randTangent(d, _a);
  return out.copy(d).addScaledVector(_a, Math.tan(ang * Math.sqrt(Math.random()))).normalize();
}

export function randDir(out: THREE.Vector3): THREE.Vector3 {
  const u = Math.random() * 2 - 1;
  const t = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return out.set(s * Math.cos(t), u, s * Math.sin(t));
}

/** Random habitable land direction, or false. */
export function randLand(w: World, out: THREE.Vector3, tries = 60): boolean {
  for (let i = 0; i < tries; i++) {
    randDir(out);
    const h = sampleH(w.g, out.x, out.y, out.z) - w.def.sea;
    if (h > 0.08 && h < 1.3) return true;
  }
  return false;
}

export function newPerson(d: THREE.Vector3): Person {
  const dd = d.clone();
  return {
    d: dd, f: randTangent(dd, new THREE.Vector3()),
    hero: false, sick: 0, immune: 0, age: 0,
    build: 6 + Math.random() * 22, phase: Math.random() * 10, tint: (Math.random() * 6) | 0,
  };
}
export function newHouse(d: THREE.Vector3): House {
  const dd = d.clone();
  return { d: dd, f: randTangent(dd, new THREE.Vector3()), age: 0, s: 0.85 + Math.random() * 0.4, h: 0 };
}
export function newTree(d: THREE.Vector3): Tree {
  const dd = d.clone();
  return { d: dd, f: randTangent(dd, new THREE.Vector3()), age: 0, s: 0.7 + Math.random() * 0.7, h: 0 };
}
export function newAnimal(d: THREE.Vector3, color: THREE.Color, s: number, speed: number): Animal {
  const dd = d.clone();
  return { d: dd, f: randTangent(dd, new THREE.Vector3()), color, s, age: 0, phase: Math.random() * 10, speed };
}

type Piece = { geo: THREE.BufferGeometry; material: number };

function piece(
  geo: THREE.BufferGeometry,
  material: number,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0],
): Piece {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
  geo.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...position), q, new THREE.Vector3(...scale),
  ));
  return { geo, material };
}

/** Merge many soft shapes into one instanced model with one draw group per material. */
function model(pieces: Piece[], materialCount: number): THREE.BufferGeometry {
  const buckets: THREE.BufferGeometry[][] = Array.from({ length: materialCount }, () => []);
  for (const p of pieces) buckets[p.material].push(p.geo);
  const groups = buckets.map((items) => mergeGeometries(items, false)!).filter(Boolean);
  return mergeGeometries(groups, true)!;
}

const sphere = (r: number, material: number, p: [number, number, number], s: [number, number, number], detail = 14) =>
  piece(new THREE.SphereGeometry(r, detail, Math.max(5, Math.round(detail * 0.72))), material, p, s);

export function personGeo(lowDetail = false): THREE.BufferGeometry {
  const p: Piece[] = [];
  const seg = lowDetail ? 8 : 14;
  const sph = (r: number, mat: number, at: [number, number, number], size: [number, number, number]) => sphere(r, mat, at, size, seg);
  const cap = (radius: number, length: number, mat: number, at: [number, number, number], size: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0]) =>
    p.push(piece(new THREE.CapsuleGeometry(radius, length, lowDetail ? 3 : 4, lowDetail ? 7 : 10), mat, at, size, rot));

  // Relaxed, stylized proportions with a hoodie, loose cargo trousers and sneakers.
  cap(0.19, 0.24, 1, [0, 0.59, 0]);
  p.push(sph(0.16, 2, [0, 0.59, 0.175], [0.83, 0.86, 0.2]));
  p.push(sph(0.17, 1, [0, 0.86, -0.12], [0.92, 0.86, 0.55]));
  p.push(piece(new THREE.CylinderGeometry(0.08, 0.09, 0.12, lowDetail ? 7 : 10), 0, [0, 0.9, 0]));

  for (const side of [-1, 1]) {
    const x = side * 0.105;
    cap(0.065, 0.25, 3, [x, 0.28, 0]);
    p.push(sph(0.1, 4, [x, 0.075, 0.045], [1, 0.58, 1.35]));
    p.push(piece(new THREE.BoxGeometry(0.105, 0.13, 0.035), 8, [side * 0.155, 0.28, 0.074], [1, 1, 1], [0, 0, side * -0.08]));

    cap(0.061, 0.23, 1, [side * 0.22, 0.59, 0], [1, 1, 1], [0, 0, side * -0.17]);
    p.push(piece(new THREE.CylinderGeometry(0.055, 0.06, 0.045, lowDetail ? 7 : 10), 8, [side * 0.22, 0.43, 0], [1, 1, 1], [0, 0, side * -0.17]));
    p.push(sph(0.055, 0, [side * 0.245, 0.365, 0.01], [0.9, 1.1, 0.9]));
    p.push(sph(0.043, 0, [side * 0.195, 1.08, 0], [1, 1.12, 0.7])); // ears
  }

  cap(0.058, 0.09, 0, [0, 0.86, 0]);
  p.push(sph(0.19, 0, [0, 1.075, 0], [1, 1.12, 0.87]));
  p.push(sph(0.196, 5, [0, 1.205, -0.012], [1, 0.62, 0.98])); // soft hair cap
  // Swept fringe and side locks give the young 3D-animation look from the reference.
  for (const [x, y, z, sx, sy, sz, rz] of [
    [-0.13, 1.26, 0.075, 0.42, 0.58, 0.48, -0.35],
    [-0.06, 1.30, 0.09, 0.42, 0.5, 0.44, -0.12],
    [0.03, 1.30, 0.085, 0.4, 0.5, 0.43, 0.18],
    [0.13, 1.25, 0.055, 0.42, 0.58, 0.48, 0.36],
    [-0.19, 1.12, -0.015, 0.28, 0.75, 0.62, -0.08],
    [0.19, 1.12, -0.015, 0.28, 0.75, 0.62, 0.08],
    [-0.1, 0.99, -0.09, 0.28, 0.7, 0.65, -0.1],
    [0.1, 0.99, -0.09, 0.28, 0.7, 0.65, 0.1],
  ] as number[][]) {
    p.push(piece(new THREE.SphereGeometry(0.16, lowDetail ? 8 : 12, lowDetail ? 6 : 9), 5, [x, y, z], [sx, sy, sz], [0, 0, rz]));
  }

  // Large expressive eyes, warm irises, brows and a small smile.
  for (const side of [-1, 1]) {
    p.push(sph(0.047, 6, [side * 0.075, 1.105, 0.151], [0.86, 1.05, 0.45]));
    p.push(sph(0.026, 7, [side * 0.074, 1.102, 0.173], [0.9, 1, 0.45]));
    p.push(sph(0.012, 8, [side * 0.074, 1.102, 0.184], [0.9, 1, 0.5]));
    p.push(sph(0.009, 6, [side * 0.082, 1.115, 0.19], [0.65, 0.65, 0.5]));
    p.push(piece(new THREE.CapsuleGeometry(0.012, 0.065, 2, 6), 5, [side * 0.075, 1.172, 0.15], [1, 1, 1], [0, 0, side * -0.13]));
  }
  p.push(sph(0.032, 0, [0, 1.025, 0.17], [0.76, 0.65, 0.68]));
  const smile = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.046, 1.002, 0.16), new THREE.Vector3(0, 0.986, 0.173), new THREE.Vector3(0.046, 1.002, 0.16),
  ]);
  p.push(piece(new THREE.TubeGeometry(smile, 8, 0.006, lowDetail ? 3 : 5, false), 8, [0, 0, 0]));

  // Hoodie drawstrings and a tiny pendant.
  for (const side of [-1, 1]) {
    const cord = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.035, 0.76, 0.17),
      new THREE.Vector3(side * 0.04, 0.67, 0.19),
      new THREE.Vector3(side * 0.045, 0.55, 0.19),
    ]);
    p.push(piece(new THREE.TubeGeometry(cord, 8, 0.006, lowDetail ? 3 : 4, false), 6, [0, 0, 0]));
  }
  p.push(sph(0.018, 8, [0, 0.57, 0.195], [0.75, 1.3, 0.45]));
  return model(p, 9);
}

/** Groups: 0 = walls, 1 = roof, 2 = door (one material each, so roofs can be recoloured per planet). */
export function houseGeo(): THREE.BufferGeometry {
  const walls = new THREE.BoxGeometry(0.44, 0.3, 0.44).translate(0, 0.13, 0);
  const roof = new THREE.ConeGeometry(0.4, 0.28, 4).rotateY(Math.PI / 4).translate(0, 0.42, 0);
  const door = new THREE.BoxGeometry(0.1, 0.16, 0.02).translate(0, 0.08, 0.225);
  return mergeGeometries([walls, roof, door], true)!;
}

export function treeGeo(lowDetail = false): THREE.BufferGeometry {
  const p: Piece[] = [];
  const trunk = (a: THREE.Vector3, b: THREE.Vector3, thick: number) => {
    const d = b.clone().sub(a), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    p.push(piece(new THREE.CylinderGeometry(thick * 0.68, thick, d.length(), lowDetail ? 5 : 7), 0, a.clone().add(b).multiplyScalar(0.5).toArray() as [number, number, number], [1, 1, 1], new THREE.Euler().setFromQuaternion(q).toArray().slice(0, 3) as [number, number, number]));
  };
  trunk(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.82, 0), 0.075);
  // A spread of curving branches, then a layered broadleaf crown like the reference tree.
  const branchCount = lowDetail ? 5 : 7;
  for (let i = 0; i < branchCount; i++) {
    const a = (i / branchCount) * Math.PI * 2 + 0.25;
    const start = new THREE.Vector3(0, 0.47 + (i % 3) * 0.1, 0);
    const end = new THREE.Vector3(Math.cos(a) * 0.47, 1.12 + (i % 2) * 0.13, Math.sin(a) * 0.42);
    trunk(start, end, 0.035);
  }
  const clusters: [number, number, number, number, number, number][] = [
    [0, 1.25, 0, 0.38, 0.32, 0.34], [-0.34, 1.12, 0.08, 0.32, 0.27, 0.31],
    [0.34, 1.16, 0.06, 0.34, 0.29, 0.32], [-0.24, 1.39, -0.05, 0.34, 0.3, 0.32],
    [0.17, 1.46, 0.03, 0.38, 0.31, 0.34], [0, 1.63, -0.06, 0.31, 0.3, 0.31],
    [-0.51, 1.28, -0.03, 0.23, 0.22, 0.25], [0.52, 1.34, -0.06, 0.24, 0.23, 0.26],
    [-0.35, 1.52, 0.11, 0.25, 0.23, 0.24], [0.36, 1.59, 0.12, 0.27, 0.25, 0.27],
    [0, 1.83, 0.02, 0.23, 0.23, 0.23],
  ];
  for (let i = 0; i < clusters.length; i++) {
    const [x, y, z, sx, sy, sz] = clusters[i];
    p.push(piece(new THREE.SphereGeometry(0.42, lowDetail ? 8 : 12, lowDetail ? 6 : 9), 1, [x, y, z], [sx, sy, sz]));
  }
  // Small leaf masses catch highlights while keeping the canopy soft, not spiky.
  for (let i = 0; i < (lowDetail ? 10 : 20); i++) {
    const a = i * 2.399963;
    const h = 1.15 + (i % 5) * 0.13;
    const r = 0.3 + (i % 3) * 0.09;
    p.push(piece(new THREE.SphereGeometry(0.18, lowDetail ? 6 : 9, lowDetail ? 5 : 7), 1, [Math.cos(a) * r, h, Math.sin(a) * r], [0.8, 0.7, 0.9]));
  }
  return model(p, 2);
}

export function animalGeo(lowDetail = false): THREE.BufferGeometry {
  const p: Piece[] = [];
  const seg = lowDetail ? 10 : 16;
  // A plush, friendly sloth-like creature with a cream face and oversized eyes.
  p.push(piece(new THREE.SphereGeometry(0.36, seg, Math.round(seg * 0.75)), 0, [0, 0.37, 0], [0.74, 0.92, 0.66]));
  p.push(piece(new THREE.SphereGeometry(0.3, seg, Math.round(seg * 0.75)), 0, [0, 0.76, 0.02], [0.82, 0.8, 0.76]));
  p.push(piece(new THREE.SphereGeometry(0.205, seg, Math.round(seg * 0.75)), 2, [0, 0.75, 0.195], [1, 1.12, 0.42]));
  for (const side of [-1, 1]) {
    p.push(piece(new THREE.CapsuleGeometry(0.085, 0.18, lowDetail ? 3 : 4, lowDetail ? 7 : 10), 0, [side * 0.21, 0.34, 0.015], [1, 1, 1], [0, 0, side * -0.32]));
    p.push(piece(new THREE.SphereGeometry(0.095, lowDetail ? 8 : 12, lowDetail ? 6 : 9), 0, [side * 0.24, 0.12, 0.08], [1.2, 0.75, 1.3]));
    p.push(piece(new THREE.CapsuleGeometry(0.075, 0.19, lowDetail ? 3 : 4, lowDetail ? 7 : 10), 0, [side * 0.255, 0.65, 0.015], [1, 1, 1], [0, 0, side * 0.3]));
    // Dark eye patches, glossy amber eyes and a pair of tiny catchlights.
    p.push(piece(new THREE.SphereGeometry(0.085, lowDetail ? 8 : 12, lowDetail ? 6 : 9), 3, [side * 0.09, 0.79, 0.25], [1.1, 0.86, 0.42]));
    p.push(piece(new THREE.SphereGeometry(0.052, lowDetail ? 8 : 12, lowDetail ? 6 : 10), 4, [side * 0.09, 0.8, 0.278], [0.95, 1.05, 0.5]));
    p.push(piece(new THREE.SphereGeometry(0.032, lowDetail ? 8 : 12, lowDetail ? 6 : 10), 5, [side * 0.09, 0.8, 0.3], [0.92, 1, 0.5]));
    p.push(piece(new THREE.SphereGeometry(0.014, 8, 6), 6, [side * 0.1, 0.816, 0.315], [1, 1, 0.6]));
  }
  p.push(piece(new THREE.SphereGeometry(0.066, lowDetail ? 8 : 12, lowDetail ? 6 : 8), 3, [0, 0.66, 0.292], [1.15, 0.72, 0.75]));
  p.push(piece(new THREE.SphereGeometry(0.027, 10, 8), 6, [0, 0.67, 0.32], [1, 0.7, 0.7]));
  const smile = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.065, 0.605, 0.27), new THREE.Vector3(0, 0.586, 0.286), new THREE.Vector3(0.065, 0.605, 0.27),
  ]);
  p.push(piece(new THREE.TubeGeometry(smile, 8, 0.006, 4, false), 3, [0, 0, 0]));
  // Individual soft fur tufts create a gentle silhouette without expensive hair simulation.
  for (let i = 0; i < (lowDetail ? 16 : 30); i++) {
    const a = i * 2.399963;
    const furCount = lowDetail ? 16 : 30;
    const y = -0.85 + 1.7 * ((i + 0.5) / furCount);
    const r = Math.sqrt(1 - y * y);
    const x = Math.cos(a) * r * 0.25;
    const z = Math.sin(a) * r * 0.18;
    p.push(piece(new THREE.SphereGeometry(0.085, lowDetail ? 6 : 8, 5), i % 4 === 0 ? 1 : 0, [x, 0.37 + y * 0.3, z], [0.58, 1.1, 0.58]));
  }
  // Three curved claws on each front paw.
  for (const side of [-1, 1]) for (let k = -1; k <= 1; k++) {
    p.push(piece(new THREE.ConeGeometry(0.016, 0.1, 6), 7, [side * 0.3 + k * 0.035, 0.55, 0.1], [1, 1, 1], [Math.PI * 0.82, 0, side * -0.18]));
  }
  return model(p, 8);
}
