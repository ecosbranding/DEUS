export interface PlanetDef {
  id: string;
  name: string;
  tag: string;
  colors: [number, number, number, number, number, number]; // deep, shore, low, mid, high, peak
  water: number;
  waterOpacity: number;
  atmo: number;
  sea: number; // sea level offset relative to base radius
  amp: number; // terrain amplitude
  mult: number; // score multiplier
  tree: number;
  trunk: number;
  ring?: boolean;
  seed: number;
  dot: string;
}

export const PLANETS: PlanetDef[] = [
  {
    id: 'mercurio', name: 'Mercurio', tag: 'Roca abrasada y cráteres', seed: 11,
    colors: [0x3b342f, 0x5c534b, 0x7d7268, 0x968a7e, 0xb3a89c, 0xe6dfd4],
    water: 0xff7a2e, waterOpacity: 0.9, atmo: 0xffb37a, sea: -0.55, amp: 0.8, mult: 1.6,
    tree: 0xd9a441, trunk: 0x4a3b2c, dot: '#a89b8c',
  },
  {
    id: 'venus', name: 'Venus', tag: 'Mares de ácido dorado', seed: 23,
    colors: [0x6b3a12, 0xa85f1c, 0xd08a2c, 0xe0a646, 0xf0c56b, 0xfff0c2],
    water: 0xd4e02a, waterOpacity: 0.85, atmo: 0xffd27a, sea: -0.15, amp: 1.0, mult: 1.5,
    tree: 0xff6b3d, trunk: 0x5a2d12, dot: '#e8b04a',
  },
  {
    id: 'tierra', name: 'Tierra', tag: 'La cuna de la vida', seed: 7,
    colors: [0x1b4f7a, 0xe3d39a, 0x58b04a, 0x3f8f3c, 0x7d7468, 0xffffff],
    water: 0x1e8fe0, waterOpacity: 0.82, atmo: 0x6fc3ff, sea: 0, amp: 1.0, mult: 1,
    tree: 0x2f9e44, trunk: 0x6b4423, dot: '#4aa3ff',
  },
  {
    id: 'marte', name: 'Marte', tag: 'Desiertos de óxido rojo', seed: 31,
    colors: [0x4a1a10, 0x8c3a22, 0xb5502d, 0xc9683a, 0x8a4a3a, 0xfbe9df],
    water: 0x3ad6c2, waterOpacity: 0.8, atmo: 0xff8a66, sea: -0.5, amp: 1.25, mult: 1.3,
    tree: 0x35c9a5, trunk: 0x40221a, dot: '#e0603a',
  },
  {
    id: 'jupiter', name: 'Júpiter', tag: 'Islas sobre tormentas eternas', seed: 43,
    colors: [0x7a3f1e, 0xd9a066, 0xe8c9a0, 0xc98a55, 0xa85c3a, 0xfff3e0],
    water: 0xc9622f, waterOpacity: 0.88, atmo: 0xffc48a, sea: 0.2, amp: 1.1, mult: 2,
    tree: 0xffe08a, trunk: 0x7a3f1e, dot: '#d9a066',
  },
  {
    id: 'saturno', name: 'Saturno', tag: 'El señor de los anillos', seed: 59, ring: true,
    colors: [0x7a6a3a, 0xd9c98a, 0xeadfae, 0xcbb675, 0xa8935a, 0xfffbe6],
    water: 0xb89a4a, waterOpacity: 0.85, atmo: 0xfff0a8, sea: 0.1, amp: 0.9, mult: 2.2,
    tree: 0xb6f07a, trunk: 0x6a5a2a, dot: '#e6d08a',
  },
  {
    id: 'urano', name: 'Urano', tag: 'Glaciares de metano', seed: 67,
    colors: [0x1a5a66, 0x8ee6e0, 0xb5f2ee, 0x7fd6d2, 0x4fa8ad, 0xffffff],
    water: 0x2fb8c9, waterOpacity: 0.8, atmo: 0x9ff5f0, sea: 0.05, amp: 0.85, mult: 2.5,
    tree: 0xf0f7ff, trunk: 0x2a6a72, dot: '#8ee6e0',
  },
  {
    id: 'neptuno', name: 'Neptuno', tag: 'Abismo azul y vientos salvajes', seed: 79,
    colors: [0x0d1f6b, 0x3a5fd9, 0x5a7ff0, 0x3f55c9, 0x2a3a9a, 0xdfe8ff],
    water: 0x1a2fd0, waterOpacity: 0.85, atmo: 0x6a8cff, sea: 0.25, amp: 1.15, mult: 3,
    tree: 0xc77dff, trunk: 0x1a1f5a, dot: '#4a6aff',
  },
];

export const START_PLANET = 2;

export type PowerId =
  | 'life' | 'bless' | 'bolt' | 'mount' | 'river'
  | 'plant' | 'animal' | 'plague' | 'meteor' | 'heal';

export interface PowerDef {
  id: PowerId;
  name: string;
  key: string;
  cost: number;
  rate: number; // seconds between casts while holding
  color: string;
  hint: string;
}

export const POWERS: PowerDef[] = [
  { id: 'life', name: 'Vida', key: '1', cost: 6, rate: 0.16, color: '#7dffb0', hint: 'Crea mortales que construyen aldeas' },
  { id: 'bless', name: 'Poder', key: '2', cost: 14, rate: 0.35, color: '#ffe066', hint: 'Convierte mortales en héroes inmunes' },
  { id: 'bolt', name: 'Rayo', key: '3', cost: 9, rate: 0.22, color: '#9ad4ff', hint: 'Quita vidas y derriba casas' },
  { id: 'mount', name: 'Montaña', key: '4', cost: 1.6, rate: 0.045, color: '#d6b38a', hint: 'Mantén pulsado para elevar la tierra' },
  { id: 'river', name: 'Río', key: '5', cost: 1.6, rate: 0.045, color: '#5ac8ff', hint: 'Mantén pulsado y arrastra para excavar ríos' },
  { id: 'plant', name: 'Plantas', key: '6', cost: 4, rate: 0.14, color: '#8be36a', hint: 'Haz brotar bosques' },
  { id: 'animal', name: 'Bestias', key: '7', cost: 8, rate: 0.3, color: '#ff9ad6', hint: 'Inventa una especie animal nueva' },
  { id: 'plague', name: 'Plaga', key: '8', cost: 12, rate: 0.5, color: '#b7ff3a', hint: 'Desata una pandemia contagiosa' },
  { id: 'meteor', name: 'Meteoro', key: '9', cost: 24, rate: 0.6, color: '#ff7a3a', hint: 'Arrasa todo y deja un cráter' },
  { id: 'heal', name: 'Milagro', key: '0', cost: 10, rate: 0.4, color: '#7af0ff', hint: 'Lluvia sagrada: cura y da fertilidad' },
];

export interface Hud {
  score: number;
  faith: number;
  mana: number;
  combo: number;
  comboT: number;
  pop: number;
  heroes: number;
  houses: number;
  trees: number;
  animals: number;
  sick: number;
  time: number;
  planet: number;
  visited: boolean[];
  power: PowerId;
  warp: boolean;
  souls: number; // believers across all worlds
}

export interface GameOverInfo {
  score: number;
  time: number;
  worlds: number;
  peakPop: number;
  miracles: number;
}

export interface Toast {
  text: string;
  color: string;
  icon?: string;
}

const A = ['Zor', 'Cuer', 'Lumi', 'Dra', 'Pel', 'Tro', 'Ñan', 'Fur', 'Gri', 'Mo', 'Ala', 'Vex', 'Quim', 'Bru', 'Sil'];
const B = ['ra', 'no', 'co', 'pi', 'lu', 'ta', 'me', 'xi', 'fo', 'gue'];
const C = ['lope', 'dón', 'rante', 'fante', 'gato', 'saurio', 'ciervo', 'buey', 'lince', 'pótamo', 'dillo', 'corn'];
export function speciesName(): string {
  const r = (a: string[]) => a[(Math.random() * a.length) | 0];
  return r(A) + r(B) + r(C);
}
