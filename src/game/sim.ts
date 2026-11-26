import * as THREE from 'three';
import { speciesName, type PowerId } from './data';
import { sfx } from './audio';
import type { Bolts, FloatTexts, Particles, Rings } from './fx';
import { R, brush, sampleH } from './terrain';
import { CAP, jitterDir, newAnimal, newHouse, newPerson, newTree, randLand, type World } from './world';

export interface G {
  world: World;
  parts: Particles;
  rings: Rings;
  bolts: Bolts;
  texts: FloatTexts;
  shake: number;
  terrainDirty: boolean;
  flash(color: string, a: number): void;
  award(base: number, at: THREE.Vector3, color: string): void;
  addFaith(n: number): void;
  launchMeteor(d: THREE.Vector3, chaos: boolean): void;
}

export const POWER_RADIUS: Record<PowerId, number> = {
  life: 0.05, bless: 0.14, bolt: 0.085, mount: 0.17, river: 0.085,
  plant: 0.09, animal: 0.06, plague: 0.14, meteor: 0.2, heal: 0.2,
};

const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Vector3();
let lastDeath = 0;
let plagueT = 0, birthT = 0, treeT = 0;

const hAt = (w: World, d: THREE.Vector3) => sampleH(w.g, d.x, d.y, d.z);

/** World-space point on the visible surface (terrain or sea) at direction d. */
export function surf(w: World, d: THREE.Vector3, out: THREE.Vector3, lift = 0): THREE.Vector3 {
  return out.copy(d).multiplyScalar(R + Math.max(hAt(w, d), w.def.sea) + lift);
}
function isLand(w: World, d: THREE.Vector3) {
  const h = hAt(w, d) - w.def.sea;
  return h > 0.04;
}
function rot(f: THREE.Vector3, d: THREE.Vector3, a: number) {
  _c.crossVectors(d, f);
  f.multiplyScalar(Math.cos(a)).addScaledVector(_c, Math.sin(a)).normalize();
}

export function killPerson(g: G, i: number, color = 0xffffff) {
  const w = g.world, p = w.people[i];
  surf(w, p.d, _q, 0.2);
  g.parts.burst(_q, p.d, 8, color, 1.6, 0.9, 0.22, 0.5, -3);
  w.people[i] = w.people[w.people.length - 1];
  w.people.pop();
  const now = performance.now();
  if (now - lastDeath > 70) { lastDeath = now; sfx.death(); }
}
function destroyHouse(g: G, i: number) {
  const w = g.world, h = w.houses[i];
  surf(w, h.d, _q, 0.2);
  g.parts.burst(_q, h.d, 16, 0xd8b98a, 3.2, 0.8, 0.26, 1, 9);
  g.parts.burst(_q, h.d, 6, 0xff7a3a, 2, 0.5, 0.3, 1, 2);
  w.houses[i] = w.houses[w.houses.length - 1];
  w.houses.pop();
}
function removeTree(g: G, i: number, color: number) {
  const w = g.world, t = w.trees[i];
  surf(w, t.d, _q, 0.3);
  g.parts.burst(_q, t.d, 5, color, 1.8, 0.6, 0.24, 1, 1);
  w.trees[i] = w.trees[w.trees.length - 1];
  w.trees.pop();
}
function killAnimal(g: G, i: number) {
  const w = g.world, a = w.animals[i];
  surf(w, a.d, _q, 0.2);
  g.parts.burst(_q, a.d, 7, a.color.getHex(), 2, 0.7, 0.22, 1, 4);
  w.animals[i] = w.animals[w.animals.length - 1];
  w.animals.pop();
}

function smite(g: G, d: THREE.Vector3, radius: number) {
  const w = g.world, cr = Math.cos(radius);
  let kills = 0, houses = 0, trees = 0;
  for (let i = w.people.length - 1; i >= 0; i--) if (w.people[i].d.dot(d) > cr) { killPerson(g, i); kills++; }
  for (let i = w.animals.length - 1; i >= 0; i--) if (w.animals[i].d.dot(d) > cr) { killAnimal(g, i); kills++; }
  for (let i = w.houses.length - 1; i >= 0; i--) if (w.houses[i].d.dot(d) > cr) { destroyHouse(g, i); houses++; }
  for (let i = w.trees.length - 1; i >= 0; i--) if (w.trees[i].d.dot(d) > cr) { removeTree(g, i, 0xff8a3a); trees++; }
  return { kills, houses, trees };
}

export function meteorImpact(g: G, d: THREE.Vector3, chaos: boolean) {
  const w = g.world;
  const rad = chaos ? 0.13 : 0.2;
  const r = smite(g, d, rad);
  brush(w.g, d.x, d.y, d.z, rad * 1.5, 0.14);
  brush(w.g, d.x, d.y, d.z, rad, chaos ? -0.4 : -0.6);
  g.terrainDirty = true;
  surf(w, d, _p, 0.15);
  g.parts.burst(_p, d, 90, 0xff8a2e, 11, 1.1, 0.55, 1, 7);
  g.parts.burst(_p, d, 50, 0xffe08a, 6, 0.8, 0.4, 1, 2);
  g.parts.burst(_p, d, 40, 0x8a7a70, 4, 1.6, 0.7, 1, 1);
  g.rings.spawn(_p, d, 0xffb060, rad * R * 2.2, 0.7);
  g.rings.spawn(_p, d, 0xffffff, rad * R * 1.3, 0.45);
  g.shake = Math.max(g.shake, chaos ? 0.9 : 1.4);
  g.flash('#ffb060', chaos ? 0.4 : 0.6);
  sfx.meteor();
  if (chaos) {
    g.addFaith(-(2 + r.kills * 0.4 + r.houses * 0.6));
    g.texts.spawn(_p, '¡CAOS!', '#ff5a5a', true);
  } else {
    g.addFaith(Math.min(8, 1 + r.kills * 0.8));
    g.award(40 + r.kills * 15 + r.houses * 35 + r.trees * 4, _p, '#ffa35a');
  }
}

/** Returns base points (>= 0) or -1 if the power cannot be used there. */
export function castPower(g: G, id: PowerId, d: THREE.Vector3): number {
  const w = g.world;
  const land = isLand(w, d);
  surf(w, d, _p, 0.12);
  const rad = POWER_RADIUS[id];
  const cr = Math.cos(rad);
  switch (id) {
    case 'life': {
      if (!land || w.people.length >= CAP.people) return -1;
      let n = 0;
      for (let i = 0; i < 3 && w.people.length < CAP.people; i++) {
        jitterDir(d, rad, _n);
        if (!isLand(w, _n)) continue;
        w.people.push(newPerson(_n));
        n++;
      }
      if (!n) return -1;
      g.parts.burst(_p, d, 22, 0x7dffb0, 3.4, 0.7, 0.3, 0.8, 3);
      g.rings.spawn(_p, d, 0x7dffb0, 1.1, 0.4);
      g.addFaith(1.2 * n);
      sfx.life();
      return 15 * n;
    }
    case 'bless': {
      let n = 0;
      for (const p of w.people) {
        if (!p.hero && p.d.dot(d) > cr) { p.hero = true; p.sick = 0; p.age = 0.12; n++; }
      }
      g.parts.burst(_p, d, 34, 0xffe066, 4.5, 1.1, 0.34, 0.5, -2);
      g.rings.spawn(_p, d, 0xffe066, rad * R * 1.1, 0.55);
      g.addFaith(Math.min(10, n * 2));
      sfx.bless();
      return n * 45;
    }
    case 'bolt': {
      const r = smite(g, d, rad);
      g.bolts.strike(_p, d, 0x9ad4ff);
      g.parts.burst(_p, d, 30, 0xbfe6ff, 7, 0.45, 0.32, 1, 6);
      g.rings.spawn(_p, d, 0xbfe6ff, rad * R * 1.4, 0.35);
      g.shake = Math.max(g.shake, 0.55);
      g.flash('#dff1ff', 0.3);
      g.addFaith(Math.min(6, 0.3 + r.kills));
      sfx.bolt();
      return 3 + r.kills * 12 + r.houses * 30 + r.trees * 4;
    }
    case 'mount':
    case 'river': {
      const up = id === 'mount';
      brush(w.g, d.x, d.y, d.z, rad, up ? 0.1 : -0.13);
      g.terrainDirty = true;
      if (Math.random() < 0.6) {
        jitterDir(d, rad * 0.7, _n);
        surf(w, _n, _q, 0.1);
        g.parts.burst(_q, _n, 3, up ? 0xd6b38a : w.def.water, up ? 2.6 : 3.2, 0.6, 0.3, 0.7, 7);
      }
      g.shake = Math.max(g.shake, 0.07);
      g.addFaith(0.12);
      sfx.terrain(up);
      return 2;
    }
    case 'plant': {
      if (w.trees.length >= CAP.trees) return -1;
      let n = 0;
      for (let i = 0; i < 4 && w.trees.length < CAP.trees; i++) {
        jitterDir(d, rad, _n);
        if (!isLand(w, _n)) continue;
        w.trees.push(newTree(_n));
        n++;
      }
      if (!n) return -1;
      g.parts.burst(_p, d, 14, w.def.tree, 2.6, 0.6, 0.26, 0.9, 4);
      g.addFaith(0.5 * n);
      sfx.plant();
      return 6 * n;
    }
    case 'animal': {
      if (!land || w.animals.length >= CAP.animals) return -1;
      // Keep new creatures in natural fur tones; the model carries its own face and markings.
      const col = new THREE.Color().setHSL(0.055 + Math.random() * 0.055, 0.22 + Math.random() * 0.12, 0.83 + Math.random() * 0.08);
      const s = 0.8 + Math.random() * 1.1;
      const sp = 0.25 + Math.random() * 0.6;
      let n = 0;
      for (let i = 0; i < 3 && w.animals.length < CAP.animals; i++) {
        jitterDir(d, rad, _n);
        if (!isLand(w, _n)) continue;
        w.animals.push(newAnimal(_n, col, s, sp));
        n++;
      }
      if (!n) return -1;
      g.parts.burst(_p, d, 24, col.getHex(), 3.6, 0.8, 0.32, 0.8, 3);
      g.rings.spawn(_p, d, col.getHex(), 1.3, 0.45);
      g.texts.spawn(surf(w, d, _q, 0.9), '¡' + speciesName() + '!', '#' + col.getHexString(), true);
      g.addFaith(3);
      sfx.animal();
      return 25 + n * 10;
    }
    case 'plague': {
      let n = 0;
      for (const p of w.people) {
        if (!p.hero && p.sick === 0 && p.immune <= 0 && p.d.dot(d) > cr) { p.sick = 0.01; n++; }
      }
      g.parts.burst(_p, d, 40, 0xa6ff2e, 2.6, 2.0, 0.6, 1, -0.6);
      g.rings.spawn(_p, d, 0xa6ff2e, rad * R * 1.1, 0.8);
      g.flash('#9dff3a', 0.14);
      g.addFaith(Math.min(5, n * 0.6));
      sfx.plague();
      return n * 15;
    }
    case 'meteor': {
      g.launchMeteor(d, false);
      return 0;
    }
    case 'heal': {
      let cured = 0, near = 0;
      for (const p of w.people) {
        if (p.d.dot(d) <= cr) continue;
        near++;
        if (p.sick > 0) { p.sick = 0; cured++; }
        p.immune = Math.max(p.immune, 25);
      }
      let born = 0;
      for (let i = 0; i < 5; i++) {
        jitterDir(d, rad, _n);
        if (!isLand(w, _n)) continue;
        if (i < 2 && near > 0 && w.people.length < CAP.people) { w.people.push(newPerson(_n)); born++; }
        else if (w.trees.length < CAP.trees) { w.trees.push(newTree(_n)); born++; }
      }
      for (let i = 0; i < 46; i++) {
        jitterDir(d, rad, _n);
        surf(w, _n, _q, 2.2 + Math.random() * 1.6);
        g.parts.emit(_q.x, _q.y, _q.z, -_n.x * 2, -_n.y * 2, -_n.z * 2, 0x7af0ff, 0.9, 0.26, 9);
      }
      g.rings.spawn(_p, d, 0x7af0ff, rad * R * 1.1, 0.7);
      g.addFaith(Math.min(10, 1 + cured * 1.5 + born * 0.4));
      sfx.heal();
      return 8 + cured * 22 + born * 6;
    }
  }
  return -1;
}

/** Recompute static heights after terraforming; drown whatever ends up under the sea. */
export function refreshStatics(g: G) {
  const w = g.world, sea = w.def.sea;
  for (let i = w.houses.length - 1; i >= 0; i--) {
    const h = w.houses[i];
    h.h = hAt(w, h.d);
    if (h.h < sea - 0.03) destroyHouse(g, i);
  }
  for (let i = w.trees.length - 1; i >= 0; i--) {
    const t = w.trees[i];
    t.h = hAt(w, t.d);
    if (t.h < sea - 0.03) removeTree(g, i, w.def.water);
  }
}

function walk(w: World, d: THREE.Vector3, f: THREE.Vector3, ang: number, steer: number): number {
  const sea = w.def.sea;
  const hc = hAt(w, d) - sea;
  rot(f, d, steer);
  _n.copy(d).addScaledVector(f, 0.035).normalize();
  const hn = hAt(w, _n) - sea;
  if (hn < 0.04 || Math.abs(hn - hc) > 0.16) {
    rot(f, d, 1.2 + Math.random() * 2.4);
  } else {
    d.addScaledVector(f, ang).normalize();
    f.addScaledVector(d, -f.dot(d)).normalize();
  }
  return hc;
}

export function stepWorld(g: G, dt: number) {
  const w = g.world;
  const COS_HOUSE = Math.cos(0.058);

  for (let i = w.people.length - 1; i >= 0; i--) {
    const p = w.people[i];
    p.age += dt;
    p.phase += dt;
    const sp = (p.hero ? 0.55 : p.sick > 0 ? 0.2 : 0.36) / R;
    const hc = walk(w, p.d, p.f, sp * dt, (Math.sin(p.phase * 0.9) + (Math.random() - 0.5) * 3) * dt);
    if (hc < -0.07) { killPerson(g, i, w.def.water); continue; }
    if (p.hero && Math.random() < dt * 2.5) {
      surf(w, p.d, _q, 0.4);
      g.parts.emit(_q.x, _q.y, _q.z, p.d.x * 0.8, p.d.y * 0.8, p.d.z * 0.8, 0xffe066, 0.6, 0.16, 0);
    } else if (p.sick > 0 && Math.random() < dt * 2) {
      surf(w, p.d, _q, 0.4);
      g.parts.emit(_q.x, _q.y, _q.z, p.d.x * 0.5, p.d.y * 0.5, p.d.z * 0.5, 0xa6ff2e, 0.7, 0.18, 0);
    }
    p.build -= dt * (p.hero ? 2.5 : 1);
    if (p.build <= 0) {
      p.build = 18 + Math.random() * 30;
      if (p.sick === 0 && w.houses.length < CAP.houses && hc > 0.06) {
        let free = true;
        for (const h of w.houses) if (h.d.dot(p.d) > COS_HOUSE) { free = false; break; }
        if (free) {
          const h = newHouse(p.d);
          h.h = hc + w.def.sea;
          w.houses.push(h);
          surf(w, p.d, _q, 0.25);
          g.parts.burst(_q, p.d, 10, 0xffe2a8, 2.2, 0.5, 0.22, 1, 5);
          g.award(25, _q, '#ffe2a8');
          g.addFaith(1);
          sfx.build();
        }
      }
    }
  }

  for (let i = w.animals.length - 1; i >= 0; i--) {
    const a = w.animals[i];
    a.age += dt;
    a.phase += dt * (1 + a.speed);
    const hc = walk(w, a.d, a.f, (a.speed / R) * dt, (Math.sin(a.phase * 0.6) + (Math.random() - 0.5) * 4) * dt);
    if (hc < -0.07) killAnimal(g, i);
  }
  for (const h of w.houses) h.age += dt;
  for (const t of w.trees) t.age += dt;

  plagueT += dt;
  if (plagueT >= 0.4) {
    plagueT = 0;
    const COS_INF = Math.cos(0.065);
    let heroes = 0;
    for (let i = w.people.length - 1; i >= 0; i--) {
      const p = w.people[i];
      if (p.hero) heroes++;
      if (p.immune > 0) p.immune -= 0.4;
      if (p.sick <= 0) continue;
      p.sick += 0.4;
      for (const q of w.people) {
        if (q.sick === 0 && !q.hero && q.immune <= 0 && q.d.dot(p.d) > COS_INF && Math.random() < 0.3) q.sick = 0.01;
      }
      if (p.sick > 9) {
        if (Math.random() < 0.65) killPerson(g, i, 0xa6ff2e);
        else { p.sick = 0; p.immune = 30; }
      }
    }
    w.heroes = heroes;
  }

  birthT += dt;
  if (birthT >= 1.6) {
    birthT = 0;
    if (w.houses.length > 0 && w.people.length < Math.min(CAP.people, 4 + w.houses.length * 3.5)) {
      const h = w.houses[(Math.random() * w.houses.length) | 0];
      jitterDir(h.d, 0.03, _n);
      if (isLand(w, _n)) {
        w.people.push(newPerson(_n));
        surf(w, _n, _q, 0.25);
        g.parts.burst(_q, _n, 5, 0xffffff, 1.4, 0.5, 0.18, 0.6, 2);
      }
    }
  }
  treeT += dt;
  if (treeT >= 4) {
    treeT = 0;
    if (w.trees.length > 0 && w.trees.length < CAP.trees * 0.5) {
      const t = w.trees[(Math.random() * w.trees.length) | 0];
      jitterDir(t.d, 0.06, _n);
      if (isLand(w, _n)) w.trees.push(newTree(_n));
    }
  }
}

/** Starting life for the home planet. */
export function seedWorld(w: World, people: number, trees: number, animals: number, hub: THREE.Vector3) {
  const d = new THREE.Vector3();
  w.hub = hub.clone();
  for (let i = 0; i < people; i++) { jitterDir(hub, 0.12, d); if (isLand(w, d)) w.people.push(newPerson(d)); }
  w.houses.push(newHouse(hub));
  for (let i = 0; i < trees; i++) {
    if (i % 3 === 0) { if (!randLand(w, d)) continue; } else jitterDir(hub, 0.45, d);
    if (isLand(w, d)) w.trees.push(newTree(d));
  }
  const col = new THREE.Color(0xffb86b);
  for (let i = 0; i < animals; i++) { jitterDir(hub, 0.2, d); if (isLand(w, d)) w.animals.push(newAnimal(d, col, 1, 0.4)); }
  for (const h of w.houses) h.h = hAt(w, h.d);
  for (const t of w.trees) t.h = hAt(w, t.d);
}
