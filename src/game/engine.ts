import * as THREE from 'three';
import { PLANETS, POWERS, START_PLANET, type GameOverInfo, type Hud, type PowerDef, type PowerId, type Toast } from './data';
import { initAudio, sfx } from './audio';
import { Bolts, FloatTexts, Particles, Rings } from './fx';
import { PlanetMesh, R, raycastTerrain, sampleH } from './terrain';
import { CAP, animalGeo, houseGeo, makeWorld, personGeo, jitterDir, randLand, randTangent, treeGeo, type World } from './world';
import { POWER_RADIUS, castPower, meteorImpact, refreshStatics, seedWorld, stepWorld, surf, type G } from './sim';

export type GameState = 'menu' | 'playing' | 'paused' | 'over';
export interface Callbacks {
  onHud(h: Hud): void;
  onToast(t: Toast): void;
  onOver(i: GameOverInfo): void;
  onDeny(): void;
  onState(s: GameState): void;
}
interface Meteor { d: THREE.Vector3; side: THREE.Vector3; t: number; dur: number; chaos: boolean; mesh: THREE.Mesh; ringT: number }

const POWER_BY_ID = Object.fromEntries(POWERS.map((p) => [p.id, p])) as Record<PowerId, PowerDef>;
const TUNICS = [0xfffaf5, 0xf5ede5, 0xefe5dd, 0xfff4e8, 0xf3e7e0, 0xfff8ee].map((c) => new THREE.Color(c));
const C_HERO = new THREE.Color(0xffc21a);
const C_SICK = new THREE.Color(0x86e03a);
const HUMAN_MATERIALS = [
  new THREE.MeshStandardMaterial({ color: 0xd9a885, roughness: 0.82 }), // skin
  new THREE.MeshStandardMaterial({ color: 0x202329, roughness: 0.9 }), // hoodie
  new THREE.MeshStandardMaterial({ color: 0x858281, roughness: 0.85 }), // tee
  new THREE.MeshStandardMaterial({ color: 0x424650, roughness: 0.94 }), // cargo denim
  new THREE.MeshStandardMaterial({ color: 0xe8e9e8, roughness: 0.7 }), // sneakers
  new THREE.MeshStandardMaterial({ color: 0x573a2b, roughness: 0.9 }), // hair
  new THREE.MeshStandardMaterial({ color: 0xfff7eb, roughness: 0.22 }), // eye whites
  new THREE.MeshStandardMaterial({ color: 0x4b2a1c, roughness: 0.25 }), // iris
  new THREE.MeshStandardMaterial({ color: 0x17161a, roughness: 0.35 }), // details
];
const ANIMAL_MATERIALS = [
  new THREE.MeshStandardMaterial({ color: 0x79563f, roughness: 0.95 }),
  new THREE.MeshStandardMaterial({ color: 0xa67a59, roughness: 0.96 }),
  new THREE.MeshStandardMaterial({ color: 0xe5d3b9, roughness: 0.92 }),
  new THREE.MeshStandardMaterial({ color: 0x49352f, roughness: 0.66 }),
  new THREE.MeshStandardMaterial({ color: 0xfff2dc, roughness: 0.16 }),
  new THREE.MeshStandardMaterial({ color: 0x582e20, roughness: 0.2 }),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 }),
  new THREE.MeshStandardMaterial({ color: 0xddd0bb, roughness: 0.75 }),
];
const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);
const SUN = new THREE.Vector3(0.75, 0.45, 0.6).normalize();
// roof colour per planet, chosen to stand out against each terrain palette
const ROOFS = [0xd9483b, 0x3b6fd9, 0xc2452d, 0x3a57e0, 0x8a3fd6, 0xc2452d, 0xd94a8a, 0xffb02e];
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const pop = (age: number, dur: number) => {
  const t = Math.min(1, age / dur) - 1;
  return 1 + 2.7 * t * t * t + 1.7 * t * t;
};

function place(mesh: THREE.InstancedMesh, i: number, d: THREE.Vector3, f: THREE.Vector3, r: number, s: number) {
  _x.crossVectors(d, f);
  _m.makeBasis(_x, d, f);
  _m.scale(_s.set(s, s, s));
  _m.setPosition(d.x * r, d.y * r, d.z * r);
  mesh.setMatrixAt(i, _m);
}

export class Game implements G {
  world!: World;
  parts: Particles;
  rings = new Rings();
  bolts = new Bolts();
  texts: FloatTexts;
  shake = 0;
  terrainDirty = false;
  state: GameState = 'menu';
  power: PowerId = 'life';

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.5, 1500);
  private ray = new THREE.Raycaster();
  private planet: PlanetMesh;
  private water: THREE.Mesh;
  private atmo: THREE.Mesh;
  private satRing = new THREE.Group();
  private fill: THREE.DirectionalLight;
  private far: THREE.Mesh[] = [];
  private iPeople: THREE.InstancedMesh;
  private iHouses: THREE.InstancedMesh;
  private roofMat!: THREE.MeshLambertMaterial;
  private iTrees: THREE.InstancedMesh;
  private iAnimals: THREE.InstancedMesh;
  private cursor: THREE.Mesh;
  private flashEl: HTMLDivElement;
  private flashA = 0;
  private meteors: Meteor[] = [];
  private meteorPool: THREE.Mesh[] = [];

  private worlds: (World | null)[] = PLANETS.map(() => null);
  private visited: boolean[] = PLANETS.map(() => false);
  private planetIdx = START_PLANET;
  private score = 0;
  private faith = 70;
  private mana = 100;
  private combo = 1;
  private comboT = 0;
  private lastPower: PowerId | null = null;
  private time = 0;
  private casts = 0;
  private peakPop = 0;
  private chaosT = 30;
  private warp: { t: number; to: number; switched: boolean } | null = null;

  private yaw = 0.6; private pitch = 0.35; private dist = 30;
  private yawT = 0.6; private pitchT = 0.35; private distT = 30;
  private keys = new Set<string>();
  private pointers = new Map<number, { x: number; y: number }>();
  private mode: 'none' | 'cast' | 'orbit' | 'gesture' = 'none';
  private pinch = 0;
  private mouse = new THREE.Vector2();
  private hasPointer = false;
  private aimCenter = false;
  private aim = new THREE.Vector3(0, 0, 1);
  private aimValid = false;
  private castTimer = 0;
  private pending = false;
  private tip = 0;
  private pendAim = new THREE.Vector3();
  private orbitIn = { x: 0, y: 0 };
  private denyT = 0;
  private hudT = 0;
  private clock = 0;
  private raf = 0;
  private last = 0;
  private w = 1; private h = 1;
  private pr = 1;
  private cleanup: (() => void)[] = [];
  private lastBase = 0;
  private q = 1;
  private qOff = false;
  private qBad = 0;
  private qPrev = 0;
  private qFail = 0;
  private fAcc = 0;
  private fN = 0;

  constructor(private canvas: HTMLCanvasElement, overlay: HTMLElement, private cb: Callbacks) {
    const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
    this.pr = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.pr);
    // software rasterizers (no GPU) start directly in a lighter mode
    const gl = this.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const soft = /swiftshader|llvmpipe|software|basic render/i.test(dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '');
    const lowDetail = mobile || soft;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    const sc = this.scene;
    sc.background = new THREE.Color(0x05030f);

    // lights
    const sunDir = SUN;
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.5);
    sun.position.copy(sunDir).multiplyScalar(100);
    this.fill = new THREE.DirectionalLight(0xc4d2ff, 1.0);
    sc.add(sun, this.fill, new THREE.HemisphereLight(0xcfe0ff, 0x2a2040, 0.9));

    // stars
    const sp = new Float32Array(1800 * 3), scol = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      _v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(600);
      sp.set([_v.x, _v.y, _v.z], i * 3);
      const b = 0.4 + Math.random() * 0.6, t = Math.random();
      scol.set([b * (0.8 + t * 0.2), b * 0.85, b * (1 - t * 0.25)], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(scol, 3));
    sc.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.7 * this.pr, sizeAttenuation: false, vertexColors: true })));

    // sun + glow
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff6d0, toneMapped: false }));
    sunMesh.position.copy(sunDir).multiplyScalar(500);
    const gc = document.createElement('canvas');
    gc.width = gc.height = 128;
    const g2 = gc.getContext('2d')!;
    const grad = g2.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,240,190,1)');
    grad.addColorStop(0.25, 'rgba(255,190,90,0.5)');
    grad.addColorStop(1, 'rgba(255,120,40,0)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 128, 128);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    glow.scale.setScalar(190);
    glow.position.copy(sunMesh.position);
    sc.add(sunMesh, glow);

    // far planets
    PLANETS.forEach((p, i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(i >= 4 ? 8 : 4, 16, 12), new THREE.MeshLambertMaterial({ color: p.dot, emissive: p.dot, emissiveIntensity: 0.25 }));
      const a = i * 0.83 + 2.2;
      m.position.set(Math.cos(a) * 430, Math.sin(i * 1.7) * 90, Math.sin(a) * 430);
      sc.add(m);
      this.far.push(m);
    });

    // planet, water, atmosphere, ring
    this.planet = new PlanetMesh(soft ? 16 : mobile ? 24 : 34);
    this.water = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 48), new THREE.MeshPhongMaterial({ transparent: true, shininess: 80, specular: 0x555555 }));
    this.atmo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.22, 48, 32),
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color() } },
        vertexShader: 'varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 uColor; varying vec3 vN; void main(){ float i=pow(clamp(-vN.z*1.9,0.0,1.0),3.0)*0.75; gl_FragColor=vec4(uColor*i,1.0); }',
        side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      }),
    );
    for (const [a, b, o] of [[1.5, 1.7, 0.42], [1.76, 2.0, 0.26], [2.06, 2.16, 0.16]]) {
      this.satRing.add(new THREE.Mesh(
        new THREE.RingGeometry(R * a, R * b, 96),
        new THREE.MeshBasicMaterial({ color: 0xe6c97a, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
      ));
    }
    this.satRing.rotation.x = Math.PI / 2 - 0.3;
    sc.add(this.planet.mesh, this.water, this.atmo, this.satRing);

    // instanced entities
    const mk = (geo: THREE.BufferGeometry, cap: number, colors: boolean, material?: THREE.Material | THREE.Material[]) => {
      const m = new THREE.InstancedMesh(geo, material ?? new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), cap);
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (colors) m.setColorAt(0, TUNICS[0]);
      m.count = 0;
      sc.add(m);
      return m;
    };
    this.iPeople = mk(personGeo(lowDetail), CAP.people, true, HUMAN_MATERIALS);
    this.iHouses = mk(houseGeo(), CAP.houses, false);
    const flat = (color: number) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    this.roofMat = flat(ROOFS[START_PLANET]);
    this.iHouses.material = [flat(0xf3e6c8), this.roofMat, flat(0x6b3d1e)];
    const treeMats = [
      new THREE.MeshStandardMaterial({ color: PLANETS[START_PLANET].trunk, roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: PLANETS[START_PLANET].tree, roughness: 0.9 }),
    ];
    this.iTrees = mk(treeGeo(lowDetail), CAP.trees, false, treeMats);
    this.iAnimals = mk(animalGeo(lowDetail), CAP.animals, true, ANIMAL_MATERIALS);

    // fx
    this.parts = new Particles(mobile ? 1800 : 3200, this.pr);
    this.texts = new FloatTexts(overlay);
    sc.add(this.parts.points, this.rings.group, this.bolts.group);
    this.flashEl = document.createElement('div');
    this.flashEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;mix-blend-mode:screen';
    overlay.appendChild(this.flashEl);
    this.cursor = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 1, 48),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }),
    );
    this.cursor.renderOrder = 20;
    this.cursor.visible = false;
    sc.add(this.cursor);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: 0xffd08a, toneMapped: false }));
      m.visible = false;
      sc.add(m);
      this.meteorPool.push(m);
    }

    this.bind();
    this.resize();
    if (soft) this.setQ(0.5);
    this.distT = this.dist;
    this.setWorld(START_PLANET, true);
    this.faceHub();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ───────────── public API ─────────────
  start() {
    initAudio();
    this.worlds = PLANETS.map(() => null);
    this.visited = PLANETS.map(() => false);
    this.score = 0; this.faith = 70; this.pending = false; this.tip = 0; this.mana = 100; this.combo = 1; this.comboT = 0;
    this.lastPower = null; this.time = 0; this.casts = 0; this.peakPop = 0; this.chaosT = 32;
    this.warp = null; this.shake = 0;
    for (const m of this.meteors) m.mesh.visible = false;
    this.meteors = [];
    this.power = 'life';
    this.setWorld(START_PLANET, true);
    this.distT = this.baseDist();
    this.faceHub();
    this.setState('playing');
    sfx.start();
    this.cb.onToast({ text: 'Toca el planeta para crear vida', color: '#7dffb0', icon: 'tap' });
    this.pushHud();
  }
  togglePause() {
    if (this.state === 'playing') this.setState('paused');
    else if (this.state === 'paused') { this.last = performance.now(); this.setState('playing'); }
  }
  returnToMenu() {
    this.warp = null;
    this.mode = 'none';
    this.pending = false;
    this.keys.clear();
    this.setState('menu');
  }
  setPower(id: PowerId) {
    if (this.power !== id) sfx.ui();
    this.power = id;
    this.pushHud();
  }
  travel(i: number) {
    if (this.state !== 'playing' || this.warp || i === this.planetIdx || i < 0 || i >= PLANETS.length) return;
    this.warp = { t: 0, to: i, switched: false };
    sfx.warp();
    this.pushHud();
  }
  travelRel(n: number) { this.travel((this.planetIdx + n + PLANETS.length) % PLANETS.length); }
  setOrbitInput(x: number, y: number) { this.orbitIn.x = x; this.orbitIn.y = y; }
  dispose() {
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((f) => f());
    this.renderer.dispose();
  }

  // ───────────── G interface ─────────────
  flash(color: string, a: number) {
    this.flashEl.style.background = color;
    this.flashA = Math.max(this.flashA, a);
  }
  award(base: number, at: THREE.Vector3, color: string) {
    if (base <= 0 || this.state !== 'playing') return;
    const pts = Math.round(base * this.combo * this.world.def.mult);
    this.score += pts;
    if (base >= 5) this.texts.spawn(at, '+' + pts, color);
  }
  addFaith(n: number) {
    if (this.state === 'playing') this.faith = clamp(this.faith + n, 0, 100);
  }
  launchMeteor(d: THREE.Vector3, chaos: boolean) {
    const mesh = this.meteorPool.find((m) => !m.visible);
    if (!mesh) return;
    mesh.visible = true;
    const dd = d.clone();
    this.meteors.push({ d: dd, side: randTangent(dd, new THREE.Vector3()), t: 0, dur: chaos ? 2.2 : 0.75, chaos, mesh, ringT: 0 });
    sfx.meteorFall();
  }

  // ───────────── internals ─────────────
  private setState(s: GameState) {
    this.state = s;
    this.cb.onState(s);
  }
  private baseDist() {
    return clamp(9.6 / (Math.tan((22.5 * Math.PI) / 180) * this.camera.aspect), 31, 44);
  }
  private setWorld(i: number, silent = false) {
    this.planetIdx = i;
    let w = this.worlds[i];
    if (!w) {
      w = this.worlds[i] = makeWorld(PLANETS[i]);
      if (i === START_PLANET) {
        const hub = new THREE.Vector3();
        let ok = false;
        for (let n = 0; n < 60 && !ok; n++) {
          ok = randLand(w, hub) && hub.dot(SUN) > 0.3;
          for (let q = 0; q < 6 && ok; q++) {
            jitterDir(hub, 0.12, _v);
            ok = sampleH(w.g, _v.x, _v.y, _v.z) - w.def.sea > 0.05;
          }
        }
        if (ok || randLand(w, hub)) seedWorld(w, 8, 40, 4, hub);
      }
    }
    this.world = w;
    const def = w.def;
    this.planet.update(w.g, def);
    const wm = this.water.material as THREE.MeshPhongMaterial;
    wm.color.set(def.water);
    wm.opacity = def.waterOpacity;
    wm.emissive.set(def.water).multiplyScalar(def.id === 'mercurio' || def.id === 'venus' ? 0.5 : 0.08);
    ((this.atmo.material as THREE.ShaderMaterial).uniforms.uColor.value as THREE.Color).set(def.atmo);
    const treeMats = this.iTrees.material as THREE.MeshStandardMaterial[];
    treeMats[0].color.set(def.trunk);
    treeMats[1].color.set(def.tree);
    this.satRing.visible = !!def.ring;
    this.roofMat.color.set(ROOFS[i]);
    this.far.forEach((m, k) => (m.visible = k !== i));
    this.texts.clear();
    if (!silent && w.hub) {
      // arrive looking at the settlement, with a short swing-in
      const ty = Math.atan2(w.hub.x, w.hub.z);
      this.yawT = ty;
      this.yaw = ty - 1.4;
      this.pitchT = clamp(Math.asin(w.hub.y), -1.1, 1.1);
    }
    const first = !this.visited[i];
    this.visited[i] = true;
    if (silent) return;
    if (first) {
      const bonus = Math.round(300 * def.mult);
      this.score += bonus;
      this.addFaith(22);
      this.cb.onToast({ text: `Nuevo mundo: ${def.name} · +${bonus} gloria`, color: def.dot, icon: 'planet' });
    } else {
      this.cb.onToast({ text: `${def.name} — ${def.tag}`, color: def.dot, icon: 'planet' });
    }
  }

  private bind() {
    const c = this.canvas;
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, ev: K | string, fn: (e: never) => void, opt?: AddEventListenerOptions) => {
      el.addEventListener(ev, fn as EventListener, opt);
      this.cleanup.push(() => el.removeEventListener(ev, fn as EventListener));
    };
    const local = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    on(c, 'pointerdown', (e: PointerEvent) => {
      initAudio();
      try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      const p = local(e);
      this.pointers.set(e.pointerId, p);
      this.aimCenter = false;
      this.hasPointer = true;
      this.mouse.set(p.x, p.y);
      if (this.pointers.size >= 2) {
        this.mode = 'gesture';
        const [a, b] = [...this.pointers.values()];
        this.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      } else if (e.button === 2 || e.button === 1) {
        this.mode = 'orbit';
      } else {
        this.updateAim();
        this.mode = this.aimValid && this.state === 'playing' ? 'cast' : 'orbit';
        if (this.mode === 'cast') { this.pending = true; this.pendAim.copy(this.aim); }
      }
    });
    on(c, 'pointermove', (e: PointerEvent) => {
      const p = local(e);
      const prev = this.pointers.get(e.pointerId);
      if (this.mode !== 'gesture') { this.mouse.set(p.x, p.y); this.hasPointer = true; this.aimCenter = false; }
      if (!prev) return;
      const dx = p.x - prev.x, dy = p.y - prev.y;
      prev.x = p.x; prev.y = p.y;
      if (this.mode === 'orbit') {
        this.yawT -= dx * 0.0055;
        this.pitchT += dy * 0.0055;
      } else if (this.mode === 'gesture' && this.pointers.size >= 2) {
        this.yawT -= dx * 0.003;
        this.pitchT += dy * 0.003;
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch > 10 && d > 10) this.distT *= this.pinch / d;
        this.pinch = d;
      }
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) {
        this.mode = 'none';
        if (e.pointerType !== 'mouse') { this.hasPointer = false; this.aimValid = false; }
      }
    };
    on(c, 'pointerup', up);
    on(c, 'pointercancel', up);
    on(c, 'pointerleave', (e: PointerEvent) => { if (e.pointerType === 'mouse' && this.mode === 'none') this.hasPointer = false; });
    on(c, 'wheel', (e: WheelEvent) => { e.preventDefault(); this.distT *= 1 + clamp(e.deltaY, -120, 120) * 0.0012; }, { passive: false });
    on(c, 'contextmenu', (e: Event) => e.preventDefault());
    on(window, 'keydown', (e: KeyboardEvent) => {
      if (e.repeat || (e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      const k = e.code;
      this.keys.add(k);
      if (k === 'Space' || k.startsWith('Arrow')) e.preventDefault();
      if (k === 'Space' || k.startsWith('Arrow') || 'KeyW KeyA KeyS KeyD'.includes(k)) { this.aimCenter = true; initAudio(); }
      if (k === 'Space' && this.state === 'playing') this.pending = true;
      if (k === 'KeyP' || k === 'Escape') this.togglePause();
      if (this.state !== 'playing') return;
      const pw = POWERS.find((p) => 'Digit' + p.key === k || 'Numpad' + p.key === k);
      if (pw) this.setPower(pw.id);
      if (k === 'KeyQ') this.travelRel(-1);
      if (k === 'KeyE') this.travelRel(1);
    });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    on(window, 'blur', () => this.keys.clear());
    on(window, 'resize', () => this.resize());
    const vis = () => { if (document.hidden && this.state === 'playing') this.togglePause(); };
    document.addEventListener('visibilitychange', vis);
    this.cleanup.push(() => document.removeEventListener('visibilitychange', vis));
  }

  private resize() {
    const w = (this.w = this.canvas.clientWidth || innerWidth);
    const h = (this.h = this.canvas.clientHeight || innerHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.parts.setScale(h * this.pr * this.q * 1.207);
    const bd = this.baseDist();
    if (Math.abs(bd - this.lastBase) > 1) this.distT = this.dist = bd;
    this.lastBase = bd;
  }

  private updateAim() {
    if (!this.aimCenter && !this.hasPointer) { this.aimValid = false; return; }
    if (this.aimCenter) _v2.set(0, 0, 0);
    else _v2.set((this.mouse.x / this.w) * 2 - 1, -(this.mouse.y / this.h) * 2 + 1, 0);
    this.ray.setFromCamera(new THREE.Vector2(_v2.x, _v2.y), this.camera);
    this.aimValid = raycastTerrain(this.world.g, this.world.def.sea, this.ray.ray.origin, this.ray.ray.direction, this.aim);
  }

  private tryCast() {
    if (!this.aimValid) return;
    const def = POWER_BY_ID[this.power];
    const deny = (msg?: string) => {
      if (this.denyT > 0) return;
      this.denyT = 0.5;
      sfx.deny();
      if (msg) this.texts.spawn(surf(this.world, this.aim, _v, 0.3), msg, '#ff9a9a');
      else this.cb.onDeny();
    };
    if (this.mana < def.cost) return deny();
    const base = castPower(this, this.power, this.aim);
    if (base < 0) return deny('Aquí no');
    this.mana -= def.cost;
    this.casts++;
    if (this.power === 'life' && !this.world.hub) this.world.hub = this.aim.clone(); // remember the first settlement
    if (this.comboT <= 0) this.combo = 1;
    else if (this.lastPower !== this.power && this.combo < 8) { this.combo++; sfx.combo(this.combo); }
    this.lastPower = this.power;
    this.comboT = 3.5;
    this.award(base, surf(this.world, this.aim, _v, 0.3), def.color);
    if (this.tip === 0 && this.casts >= 3) {
      this.tip = 1;
      this.cb.onToast({ text: 'Alterna poderes distintos para subir el combo', color: '#f0abfc', icon: 'bless' });
    } else if (this.tip === 1 && this.combo >= 4) {
      this.tip = 2;
      this.cb.onToast({ text: 'Viaja a otros planetas: más gloria y más fe', color: '#ffd76a', icon: 'planet' });
    }
  }

  /** Advance the simulation without rendering (used by automated tests). */
  fastForward(sec: number) {
    for (let t = 0; t < sec && this.state === 'playing'; t += 0.05) this.frame(0.05);
  }

  private faceHub() {
    const hb = this.world.hub;
    if (!hb) return;
    this.yaw = this.yawT = Math.atan2(hb.x, hb.z);
    this.pitch = this.pitchT = clamp(Math.asin(hb.y), -1.1, 1.1);
  }

  private setQ(q: number) {
    this.q = q;
    this.renderer.setPixelRatio(this.pr * q);
    this.renderer.setSize(this.w, this.h, false);
    this.parts.setScale(this.h * this.pr * q * 1.207);
  }

  /** Adaptive resolution: drop render scale when the GPU cannot hold ~50 fps. */
  private perf(raw: number) {
    if (this.qOff || raw > 1 || this.state === 'paused') { this.fAcc = this.fN = 0; return; }
    this.fAcc += raw;
    this.fN++;
    if (this.fN < 30 && this.fAcc < 0.7) return;
    const avg = this.fAcc / this.fN;
    this.fAcc = this.fN = 0;
    if (avg < 0.0205) { this.qBad = 0; return; }
    if (++this.qBad < 2 && avg < 0.04) return;
    this.qBad = 0;
    if (this.qPrev > 0 && avg > this.qPrev * 0.92) {
      // lowering the resolution did not help: frame-rate cap or CPU bound, restore quality
      if (++this.qFail >= 2) { this.qOff = true; this.setQ(1); return; }
    } else this.qFail = 0;
    this.qPrev = avg;
    if (this.q > 0.4) this.setQ(Math.max(0.4, this.q * (avg > 0.05 ? 0.65 : 0.82)));
    else this.qOff = true;
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const raw = (now - this.last) / 1000;
    this.last = now;
    let rem = Math.min(0.2, raw);
    do {
      const dt = Math.min(rem, 0.05);
      this.frame(dt);
      rem -= dt;
    } while (rem > 0.002);
    this.renderer.render(this.scene, this.camera);
    this.perf(raw);
  };

  private frame(dt: number) {
    const playing = this.state === 'playing';
    const paused = this.state === 'paused';
    const k = this.keys;
    if (!paused) {
      this.clock += dt;
      const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.orbitIn.x;
      const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + this.orbitIn.y;
      this.yawT += kx * 1.7 * dt;
      this.pitchT += ky * 1.3 * dt;
      if (k.has('KeyZ') || k.has('Equal') || k.has('NumpadAdd')) this.distT *= 1 - dt * 0.9;
      if (k.has('KeyX') || k.has('Minus') || k.has('NumpadSubtract')) this.distT *= 1 + dt * 0.9;
      if (!playing) this.yawT += dt * 0.1;
    }
    this.pitchT = clamp(this.pitchT, -1.35, 1.35);
    this.distT = clamp(this.distT, 17, 620);
    const e = Math.min(1, dt * 10);
    this.yaw += (this.yawT - this.yaw) * e;
    this.pitch += (this.pitchT - this.pitch) * e;
    this.dist += (this.distT - this.dist) * e;

    let dist = this.dist;
    if (this.warp && !paused) {
      const wp = this.warp;
      wp.t += dt;
      const q = wp.t / 1.3;
      if (!wp.switched) this.yawT += dt * 3.2;
      if (q >= 0.5 && !wp.switched) {
        wp.switched = true;
        for (const m of this.meteors) m.mesh.visible = false;
        this.meteors = [];
        this.setWorld(wp.to);
        this.flash('#ffffff', 1);
        this.shake = Math.max(this.shake, 0.5);
      }
      if (q >= 1) this.warp = null;
      else dist += Math.sin(q * Math.PI) * 75;
    }
    const cp = Math.cos(this.pitch);
    const cam = this.camera;
    cam.position.set(Math.sin(this.yaw) * cp * dist, Math.sin(this.pitch) * dist, Math.cos(this.yaw) * cp * dist);
    cam.lookAt(0, 0, 0);
    if (this.shake > 0.002 && !paused) {
      const s = this.shake;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
      cam.rotation.z += (Math.random() - 0.5) * s * 0.05;
      this.shake *= Math.exp(-dt * 7);
    }
    cam.updateMatrixWorld();
    this.fill.position.copy(cam.position);

    if (!paused) {
      const w = this.world;
      if (!this.warp) {
        this.updateAim();
        if (playing) this.playStep(dt);
        if (this.state === 'playing') stepWorld(this, dt);
        this.stepMeteors(dt);
        if (this.terrainDirty) {
          this.terrainDirty = false;
          this.planet.update(w.g, w.def);
          refreshStatics(this);
        }
      }
      this.parts.update(dt);
      this.rings.update(dt);
      this.bolts.update(dt);
      this.texts.update(dt, cam, this.w, this.h);
      this.sync();
      this.water.scale.setScalar(R + w.def.sea + Math.sin(this.clock * 1.3) * 0.012);
      this.water.rotation.y = this.clock * 0.01;
      const cur = this.cursor;
      cur.visible = this.aimValid && playing && !this.warp;
      if (cur.visible) {
        surf(w, this.aim, cur.position, 0.12);
        cur.quaternion.setFromUnitVectors(Z, this.aim);
        cur.scale.setScalar(Math.max(0.45, POWER_RADIUS[this.power] * R) * (1 + Math.sin(this.clock * 7) * 0.06));
        (cur.material as THREE.MeshBasicMaterial).color.set(POWER_BY_ID[this.power].color);
      }
      if (this.flashA > 0) {
        this.flashA = Math.max(0, this.flashA - dt * 3.2);
        this.flashEl.style.opacity = this.flashA.toFixed(3);
      }
      this.hudT -= dt;
      if (this.hudT <= 0 && playing) { this.hudT = 0.12; this.pushHud(); }
    }
  }

  private playStep(dt: number) {
    this.time += dt;
    this.denyT -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 1; }
    // "pending" buffers a tap/press that started and ended between two frames so no input is ever dropped
    const held = this.mode === 'cast' || this.keys.has('Space');
    if (held || this.pending) {
      this.castTimer -= dt;
      let n = 0;
      while (this.castTimer <= 0 && n++ < 3) {
        if (!held && !this.aimCenter) { this.aim.copy(this.pendAim); this.aimValid = true; }
        this.tryCast();
        this.pending = false;
        this.castTimer += POWER_BY_ID[this.power].rate;
        if (!held) break;
      }
      if (this.castTimer < 0) this.castTimer = 0;
    } else this.castTimer = Math.max(0, this.castTimer - dt);

    let souls = 0, heroes = 0, houses = 0, animals = 0, trees = 0;
    for (const w of this.worlds) {
      if (!w) continue;
      souls += w.people.length; heroes += w.heroes; houses += w.houses.length;
      animals += w.animals.length; trees += w.trees.length;
    }
    this.peakPop = Math.max(this.peakPop, souls);
    const t = this.time;
    const gain = souls * 0.012 + heroes * 0.05 + houses * 0.02 + animals * 0.01 + trees * 0.002;
    const decay = 0.9 + t / 45 + (t / 250) * (t / 250);
    this.faith = clamp(this.faith + (gain - decay) * dt, 0, 100);
    this.mana = Math.min(100, this.mana + (14 + Math.min(26, souls * 0.03)) * dt);
    this.score += (souls * 0.25 + heroes) * dt * this.world.def.mult;

    this.chaosT -= dt;
    if (this.chaosT <= 0) {
      this.chaosT = Math.max(7, 24 - t / 35);
      const w = this.world;
      const pick = w.houses.length ? w.houses[(Math.random() * w.houses.length) | 0].d
        : w.people.length ? w.people[(Math.random() * w.people.length) | 0].d : null;
      if (pick) {
        this.launchMeteor(pick, true);
        sfx.warn();
        this.cb.onToast({ text: '¡Meteoro del Caos en camino!', color: '#ff6a6a', icon: 'warn' });
      }
    }
    if (this.faith <= 0) {
      this.shake = 1.2;
      this.flash('#ff3a5a', 0.5);
      sfx.over();
      this.pushHud();
      this.setState('over');
      this.cb.onOver({
        score: Math.round(this.score), time: this.time, worlds: this.visited.filter(Boolean).length,
        peakPop: this.peakPop, miracles: this.casts,
      });
    }
  }

  private stepMeteors(dt: number) {
    const w = this.world;
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.t += dt;
      const q = m.t / m.dur;
      if (q >= 1) {
        m.mesh.visible = false;
        this.meteors.splice(i, 1);
        meteorImpact(this, m.d, m.chaos);
        continue;
      }
      surf(w, m.d, _v).addScaledVector(m.d, (1 - q) * 26).addScaledVector(m.side, (1 - q) * 12);
      m.mesh.position.copy(_v);
      m.mesh.rotation.set(m.t * 9, m.t * 7, 0);
      m.mesh.scale.setScalar(m.chaos ? 0.8 : 1.15);
      for (let n = 0; n < 3; n++) {
        this.parts.emit(_v.x, _v.y, _v.z, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, n ? 0xff7a2e : 0xffe08a, 0.5, 0.55, 0);
      }
      if (m.chaos) {
        m.ringT -= dt;
        if (m.ringT <= 0) { m.ringT = 0.4; this.rings.spawn(surf(w, m.d, _v2, 0.1), m.d, 0xff3a3a, 1.5, 0.5); }
      }
    }
  }

  private sync() {
    const w = this.world, g = w.g;
    const ip = this.iPeople, ia = this.iAnimals, ih = this.iHouses, it = this.iTrees;
    const pulse = 0.75 + Math.sin(this.clock * 9) * 0.25;
    for (let i = 0; i < w.people.length; i++) {
      const p = w.people[i];
      const h = sampleH(g, p.d.x, p.d.y, p.d.z) + Math.abs(Math.sin(p.phase * 8)) * 0.035;
      place(ip, i, p.d, p.f, R + h, pop(p.age, 0.35) * (p.hero ? 1.9 : 1.4));
      if (p.hero) ip.setColorAt(i, C_HERO);
      else if (p.sick > 0) ip.setColorAt(i, _c.copy(C_SICK).multiplyScalar(pulse));
      else ip.setColorAt(i, TUNICS[p.tint]);
    }
    ip.count = w.people.length;
    ip.instanceMatrix.needsUpdate = true;
    if (ip.instanceColor) ip.instanceColor.needsUpdate = true;
    for (let i = 0; i < w.animals.length; i++) {
      const a = w.animals[i];
      const h = sampleH(g, a.d.x, a.d.y, a.d.z) + Math.abs(Math.sin(a.phase * 7)) * 0.07 * a.s;
      place(ia, i, a.d, a.f, R + h, pop(a.age, 0.4) * a.s * 1.15);
      ia.setColorAt(i, a.color);
    }
    ia.count = w.animals.length;
    ia.instanceMatrix.needsUpdate = true;
    if (ia.instanceColor) ia.instanceColor.needsUpdate = true;
    for (let i = 0; i < w.houses.length; i++) {
      const o = w.houses[i];
      place(ih, i, o.d, o.f, R + sampleH(g, o.d.x, o.d.y, o.d.z) - 0.02, pop(o.age, 0.45) * o.s * 1.8);
    }
    ih.count = w.houses.length;
    ih.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < w.trees.length; i++) {
      const o = w.trees[i];
      place(it, i, o.d, o.f, R + sampleH(g, o.d.x, o.d.y, o.d.z) - 0.02, pop(o.age, 0.6) * o.s * 1.2);
    }
    it.count = w.trees.length;
    it.instanceMatrix.needsUpdate = true;
  }

  private pushHud() {
    const w = this.world;
    let sick = 0, souls = 0;
    for (const p of w.people) if (p.sick > 0) sick++;
    for (const o of this.worlds) if (o) souls += o.people.length;
    this.cb.onHud({
      score: Math.round(this.score), faith: this.faith, mana: this.mana, combo: this.combo,
      comboT: Math.max(0, this.comboT / 3.5), pop: w.people.length, heroes: w.heroes, houses: w.houses.length,
      trees: w.trees.length, animals: w.animals.length, sick, time: this.time, planet: this.planetIdx,
      visited: this.visited.slice(), power: this.power, warp: !!this.warp, souls,
    });
  }
}

const _c = new THREE.Color();
