import * as THREE from 'three';

const _c = new THREE.Color();
const _v = new THREE.Vector3();
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();

export class Particles {
  points: THREE.Points;
  private max: number;
  private pos: Float32Array;
  private col: Float32Array;
  private sz: Float32Array;
  private al: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private grav: Float32Array;
  private base: Float32Array;
  private cur = 0;
  private geo: THREE.BufferGeometry;

  constructor(max: number, pixelRatio: number) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.sz = new Float32Array(max);
    this.al = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.base = new Float32Array(max);
    const geo = (this.geo = new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sz, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.al, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 300 * pixelRatio } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; attribute vec3 color;
        uniform float uScale; varying vec3 vC; varying float vA;
        void main(){ vC=color; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_PointSize=aSize*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `
        varying vec3 vC; varying float vA;
        void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard;
          float a=smoothstep(0.5,0.05,d)*vA; gl_FragColor=vec4(vC*a,a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  setScale(s: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = s;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, life: number, size: number, grav: number) {
    const i = this.cur;
    this.cur = (i + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    _c.set(color);
    const j = 0.75 + Math.random() * 0.5;
    this.col[i * 3] = _c.r * j; this.col[i * 3 + 1] = _c.g * j; this.col[i * 3 + 2] = _c.b * j;
    this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.8);
    this.base[i] = size * (0.6 + Math.random() * 0.8);
    this.grav[i] = grav;
  }

  /** Burst from a surface point. up = surface normal; cone 0 = straight up, 1 = hemisphere, 2 = full sphere. */
  burst(p: THREE.Vector3, up: THREE.Vector3, count: number, color: number, speed: number, life: number, size: number, cone = 1, grav = 6) {
    _t1.set(up.y, up.z, -up.x).cross(up).normalize();
    _t2.copy(up).cross(_t1);
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const lat = Math.random() * cone;
      const u = cone >= 2 ? Math.random() * 2 - 1 : Math.cos(lat * Math.PI * 0.5);
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      const sp = speed * (0.35 + Math.random() * 0.9);
      _v.copy(up).multiplyScalar(u).addScaledVector(_t1, Math.cos(a) * s).addScaledVector(_t2, Math.sin(a) * s).multiplyScalar(sp);
      this.emit(p.x, p.y, p.z, _v.x, _v.y, _v.z, color, life, size, grav);
    }
  }

  update(dt: number) {
    const { pos, vel, life, maxLife, sz, al, grav, base } = this;
    const drag = Math.pow(0.12, dt);
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { sz[i] = 0; al[i] = 0; continue; }
      const k = i * 3;
      const x = pos[k], y = pos[k + 1], z = pos[k + 2];
      const g = grav[i];
      if (g !== 0) {
        const l = Math.hypot(x, y, z) || 1;
        vel[k] -= (x / l) * g * dt; vel[k + 1] -= (y / l) * g * dt; vel[k + 2] -= (z / l) * g * dt;
      }
      vel[k] *= drag; vel[k + 1] *= drag; vel[k + 2] *= drag;
      pos[k] = x + vel[k] * dt; pos[k + 1] = y + vel[k + 1] * dt; pos[k + 2] = z + vel[k + 2] * dt;
      const t = life[i] / maxLife[i];
      al[i] = t < 0.5 ? t * 2 : 1;
      sz[i] = base[i] * (0.4 + 0.6 * t);
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = true;
    a.color.needsUpdate = true;
    a.aSize.needsUpdate = true;
    a.aAlpha.needsUpdate = true;
  }
}

interface Ring { mesh: THREE.Mesh; t: number; dur: number; size: number }

export class Rings {
  group = new THREE.Group();
  private pool: Ring[] = [];
  private cur = 0;
  constructor(n = 14) {
    const geo = new THREE.RingGeometry(0.82, 1, 40);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 9;
      this.group.add(mesh);
      this.pool.push({ mesh, t: 0, dur: 0, size: 1 });
    }
  }
  spawn(p: THREE.Vector3, up: THREE.Vector3, color: number, size: number, dur = 0.5) {
    const r = this.pool[this.cur];
    this.cur = (this.cur + 1) % this.pool.length;
    r.mesh.position.copy(p).addScaledVector(up, 0.08);
    r.mesh.quaternion.setFromUnitVectors(_v.set(0, 0, 1), up);
    (r.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    r.t = 0; r.dur = dur; r.size = size;
    r.mesh.visible = true;
    r.mesh.scale.setScalar(0.01);
  }
  update(dt: number) {
    for (const r of this.pool) {
      if (!r.mesh.visible) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) { r.mesh.visible = false; continue; }
      const e = 1 - Math.pow(1 - k, 3);
      r.mesh.scale.setScalar(Math.max(0.01, e * r.size));
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
    }
  }
}

interface Bolt { mesh: THREE.Mesh; t: number }

export class Bolts {
  group = new THREE.Group();
  private live: Bolt[] = [];
  private mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  strike(target: THREE.Vector3, up: THREE.Vector3, color: number) {
    const pts: THREE.Vector3[] = [];
    const n = 9;
    _t1.set(up.y, up.z, -up.x).cross(up).normalize();
    _t2.copy(up).cross(_t1);
    const top = 15;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const j = i === 0 ? 0 : (0.5 + k) * 0.9;
      pts.push(
        target.clone().addScaledVector(up, k * top)
          .addScaledVector(_t1, (Math.random() - 0.5) * j * 2)
          .addScaledVector(_t2, (Math.random() - 0.5) * j * 2),
      );
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
    const geo = new THREE.TubeGeometry(curve, 26, 0.09, 4, false);
    const m = this.mat.clone();
    m.color.set(color).lerp(_c.set(0xffffff), 0.6);
    const mesh = new THREE.Mesh(geo, m);
    mesh.renderOrder = 11;
    this.group.add(mesh);
    this.live.push({ mesh, t: 0 });
  }
  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const b = this.live[i];
      b.t += dt;
      const k = b.t / 0.22;
      const m = b.mesh.material as THREE.MeshBasicMaterial;
      m.opacity = k < 0.3 ? 1 : Math.max(0, (1 - k) * (0.6 + 0.4 * Math.sin(b.t * 120)));
      if (k >= 1) {
        this.group.remove(b.mesh);
        b.mesh.geometry.dispose();
        m.dispose();
        this.live.splice(i, 1);
      }
    }
  }
}

interface FT { el: HTMLDivElement; t: number; dur: number; p: THREE.Vector3; active: boolean }

export class FloatTexts {
  private pool: FT[] = [];
  private cur = 0;
  constructor(container: HTMLElement, n = 22) {
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'ft';
      el.style.opacity = '0';
      container.appendChild(el);
      this.pool.push({ el, t: 0, dur: 1, p: new THREE.Vector3(), active: false });
    }
  }
  spawn(p: THREE.Vector3, text: string, color: string, big = false) {
    const f = this.pool[this.cur];
    this.cur = (this.cur + 1) % this.pool.length;
    f.p.copy(p);
    f.t = 0;
    f.dur = big ? 1.5 : 0.95;
    f.active = true;
    f.el.textContent = text;
    f.el.style.color = color;
    f.el.style.fontSize = big ? '20px' : '15px';
  }
  update(dt: number, cam: THREE.Camera, w: number, h: number) {
    for (const f of this.pool) {
      if (!f.active) continue;
      f.t += dt;
      const k = f.t / f.dur;
      if (k >= 1) { f.active = false; f.el.style.opacity = '0'; continue; }
      _v.copy(f.p).project(cam);
      if (_v.z > 1) { f.el.style.opacity = '0'; continue; }
      const x = (_v.x * 0.5 + 0.5) * w;
      const y = (-_v.y * 0.5 + 0.5) * h - 18 - (1 - Math.pow(1 - k, 2)) * 46;
      const s = k < 0.15 ? 0.5 + (k / 0.15) * 0.7 : 1.2 - Math.min(1, (k - 0.15) * 3) * 0.2;
      f.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%) scale(${s.toFixed(2)})`;
      f.el.style.opacity = k > 0.7 ? ((1 - k) / 0.3).toFixed(2) : '1';
    }
  }
  clear() {
    for (const f of this.pool) { f.active = false; f.el.style.opacity = '0'; }
  }
}
