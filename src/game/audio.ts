let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;

export function initAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.02);
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo = 0, delay = 0) {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo > 0) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function noise(dur: number, vol: number, cutoff: number, cutoffEnd = 0, delay = 0) {
  if (!ctx || !master || muted || !noiseBuf) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff, t);
  if (cutoffEnd > 0) f.frequency.exponentialRampToValueAtTime(cutoffEnd, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.03);
}

let lastTerrain = 0;

export const sfx = {
  ui() { tone(660, 0.07, 'triangle', 0.12, 880); },
  deny() { tone(160, 0.12, 'square', 0.06, 110); },
  life() {
    const b = 520 + Math.random() * 80;
    tone(b, 0.12, 'sine', 0.2, b * 1.5);
    tone(b * 1.5, 0.16, 'sine', 0.14, b * 2, 0.06);
  },
  bless() {
    [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, 0, i * 0.05));
  },
  bolt() {
    noise(0.35, 0.5, 6000, 300);
    tone(1400, 0.18, 'sawtooth', 0.12, 80);
    tone(70, 0.4, 'sine', 0.35, 35, 0.03);
  },
  terrain(up: boolean) {
    const now = performance.now();
    if (now - lastTerrain < 90) return;
    lastTerrain = now;
    noise(0.14, 0.14, up ? 500 : 900, up ? 900 : 300);
    tone(up ? 90 : 140, 0.12, 'sine', 0.12, up ? 130 : 80);
  },
  plant() { tone(700 + Math.random() * 300, 0.09, 'sine', 0.13, 1300); },
  animal() {
    tone(300, 0.1, 'square', 0.07, 520);
    tone(520, 0.14, 'square', 0.07, 380, 0.1);
  },
  plague() {
    tone(180, 0.6, 'sawtooth', 0.1, 70);
    tone(187, 0.6, 'sawtooth', 0.1, 74);
    noise(0.5, 0.1, 400, 150);
  },
  meteorFall() { tone(900, 0.5, 'sawtooth', 0.07, 120); },
  meteor() {
    noise(0.9, 0.7, 2500, 80);
    tone(60, 0.8, 'sine', 0.5, 25);
  },
  heal() {
    [784, 988, 1175].forEach((f, i) => tone(f, 0.35, 'sine', 0.12, 0, i * 0.07));
    noise(0.5, 0.05, 5000, 2000);
  },
  build() { tone(240, 0.06, 'square', 0.06); tone(320, 0.08, 'square', 0.06, 0, 0.07); },
  death() { tone(330, 0.16, 'triangle', 0.07, 150); },
  combo(n: number) { tone(440 * Math.pow(1.122, Math.min(n, 12)), 0.1, 'triangle', 0.1); },
  warp() {
    tone(90, 1.1, 'sawtooth', 0.14, 1400);
    noise(1.1, 0.16, 300, 7000);
    tone(1320, 0.5, 'sine', 0.14, 660, 1.05);
  },
  warn() { tone(520, 0.12, 'square', 0.07); tone(520, 0.12, 'square', 0.07, 0, 0.18); },
  over() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.5, 'triangle', 0.16, 0, i * 0.22));
  },
  start() {
    [262, 330, 392, 523, 659].forEach((f, i) => tone(f, 0.4, 'triangle', 0.13, 0, i * 0.07));
  },
};
