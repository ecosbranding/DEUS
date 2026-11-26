import { useEffect, useRef, useState } from 'react';
import { PLANETS, POWERS, type Hud as HudState } from '../game/data';
import type { Game } from '../game/engine';
import Icon from './Icon';

export const fmtTime = (t: number) => {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function Bar({ label, value, grad, low }: { label: string; value: number; grad: string; low?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-12 text-[10px] font-bold tracking-widest ${low ? 'text-rose-300' : 'text-amber-100/70'}`}>{label}</span>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-150 ease-out ${low ? 'animate-pulse' : ''}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: grad }}
        />
      </div>
    </div>
  );
}

function Stat({ icon, v, cls = '' }: { icon: string; v: number | string; cls?: string }) {
  return (
    <span className={`flex items-center gap-0.5 ${cls}`}>
      <Icon name={icon} className="h-3 w-3 opacity-80" />
      {v}
    </span>
  );
}

function Joystick({ game }: { game: Game }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    let y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    setKnob({ x, y });
    game.setOrbitInput(x * 1.2, -y * 1.2);
  };
  const end = () => { setKnob({ x: 0, y: 0 }); game.setOrbitInput(0, 0); };
  return (
    <div
      ref={ref}
      className="glass pointer-events-auto relative h-[84px] w-[84px] rounded-full"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e); }}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="Girar el planeta"
    >
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tracking-widest text-amber-100/40">GIRAR</span>
      <div
        className="absolute left-1/2 top-1/2 h-9 w-9 rounded-full bg-gradient-to-b from-amber-100 to-amber-500 shadow-lg shadow-amber-500/40"
        style={{ transform: `translate(calc(-50% + ${knob.x * 24}px), calc(-50% + ${knob.y * 24}px))` }}
      />
    </div>
  );
}

interface Props {
  hud: HudState;
  game: Game;
  muted: boolean;
  touch: boolean;
  denyKey: number;
  onMute(): void;
  onMap(): void;
  onPause(): void;
}

export default function Hud({ hud, game, muted, touch, denyKey, onMute, onMap, onPause }: Props) {
  const power = POWERS.find((p) => p.id === hud.power)!;
  const planet = PLANETS[hud.planet];
  const low = hud.faith < 25;
  const [bump, setBump] = useState(0);
  const lastCombo = useRef(1);
  useEffect(() => {
    if (hud.combo > lastCombo.current) setBump((b) => b + 1);
    lastCombo.current = hud.combo;
  }, [hud.combo]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {low && <div className="danger-vignette absolute inset-0" />}

      {/* top-left: score + bars */}
      <div
        className="glass absolute left-2 top-2 w-[172px] rounded-2xl p-2.5 sm:left-4 sm:top-4 sm:w-64 sm:p-3.5"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[9px] font-bold tracking-[0.3em] text-amber-200/60">GLORIA</div>
            <div className="gold-text font-display text-2xl font-extrabold leading-none tabular-nums sm:text-4xl">
              {hud.score.toLocaleString('es')}
            </div>
          </div>
          <div className="text-right">
            <div
              key={bump}
              className={`font-display text-lg font-extrabold leading-none sm:text-2xl ${hud.combo > 1 ? 'bump text-fuchsia-300' : 'text-white/25'}`}
            >
              ×{hud.combo}
            </div>
            <div className="mt-1 h-1 w-10 overflow-hidden rounded-full bg-white/10 sm:w-14">
              <div className="h-full bg-fuchsia-400" style={{ width: `${hud.combo > 1 ? hud.comboT * 100 : 0}%` }} />
            </div>
          </div>
        </div>
        <div className="mt-2 space-y-1.5">
          <Bar label="FE" value={hud.faith} low={low} grad={low ? 'linear-gradient(90deg,#ff3a5a,#ff8a6a)' : 'linear-gradient(90deg,#ffb23a,#fff0a8)'} />
          <div key={denyKey} className={denyKey ? 'deny' : ''}>
            <Bar label="PODER" value={hud.mana} grad="linear-gradient(90deg,#3a8bff,#7af0ff)" />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-semibold tabular-nums text-amber-50/80 sm:text-xs">
          <Stat icon="life" v={hud.pop} />
          <Stat icon="bless" v={hud.heroes} cls="text-amber-300" />
          <Stat icon="house" v={hud.houses} />
          <Stat icon="plant" v={hud.trees} />
          <Stat icon="animal" v={hud.animals} />
          {hud.sick > 0 && <Stat icon="plague" v={hud.sick} cls="text-lime-300" />}
          <Stat icon="clock" v={fmtTime(hud.time)} cls="text-amber-200/60" />
        </div>
      </div>

      {/* top-right: buttons */}
      <div className="absolute right-2 top-2 flex gap-1 sm:right-4 sm:top-4 sm:gap-2" style={{ marginTop: 'env(safe-area-inset-top)' }}>
        <button onClick={onMute} className="glass pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl text-amber-100 active:scale-90 sm:h-11 sm:w-11" aria-label="Sonido">
          <Icon name={muted ? 'mute' : 'sound'} className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <button onClick={onMap} className="glass pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl text-amber-100 active:scale-90 sm:h-11 sm:w-11" aria-label="Mapa del sistema solar" title="Ver todos los planetas">
          <Icon name="map" className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <button onClick={onPause} className="glass pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl text-amber-100 active:scale-90 sm:h-11 sm:w-11" aria-label="Pausa">
          <Icon name="pause" className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </div>

      {/* planets */}
      <div
        className="absolute left-1/2 top-[150px] flex -translate-x-1/2 flex-col items-center sm:top-4"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        <div className="glass pointer-events-auto flex items-center gap-1 rounded-full px-1.5 py-1 sm:gap-1.5 sm:px-2 sm:py-1.5">
          <button onClick={() => game.travelRel(-1)} className="h-8 w-7 rounded-full text-amber-200 active:scale-90" aria-label="Planeta anterior">◀</button>
          {PLANETS.map((p, i) => {
            const cur = i === hud.planet;
            return (
              <button
                key={p.id}
                onClick={() => game.travel(i)}
                title={`${p.name} ×${p.mult}`}
                aria-label={p.name}
                className={`relative h-6 w-6 rounded-full transition-all duration-200 sm:h-7 sm:w-7 ${cur ? 'scale-125' : 'scale-90 hover:scale-105'} ${hud.visited[i] ? '' : 'opacity-55'}`}
                style={{
                  background: `radial-gradient(circle at 32% 30%, #ffffffcc, ${p.dot} 45%, #00000088 120%)`,
                  boxShadow: cur ? `0 0 0 2px #fff, 0 0 16px ${p.dot}` : 'none',
                }}
              >
                {p.ring && <span className="absolute left-1/2 top-1/2 h-[3px] w-[150%] -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-full bg-amber-100/70" />}
                {!hud.visited[i] && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-black/70">?</span>}
              </button>
            );
          })}
          <button onClick={() => game.travelRel(1)} className="h-8 w-7 rounded-full text-amber-200 active:scale-90" aria-label="Planeta siguiente">▶</button>
        </div>
        <div className="mt-1.5 rounded-full bg-black/40 px-3 py-0.5 text-center text-[11px] font-semibold tracking-wide text-amber-50/90 sm:text-xs">
          <span className="font-display font-extrabold" style={{ color: planet.dot }}>{planet.name}</span>
          <span className="text-amber-200/70"> · gloria ×{planet.mult}</span>
          <span className="hidden text-white/50 sm:inline"> · {planet.tag}</span>
        </div>
      </div>

      {!touch && (
        <div className="absolute bottom-3 left-4 hidden text-[11px] leading-relaxed text-white/45 xl:block">
          <div><b className="text-white/70">Clic</b> usar poder</div>
          <div><b className="text-white/70">Clic derecho / WASD</b> girar</div>
          <div><b className="text-white/70">Rueda</b> zoom / alejar para ver planetas · <b className="text-white/70">Q / E</b> viajar</div>
        </div>
      )}

      {/* bottom: joystick + hint + powers */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {touch && (
          <div className="mb-2 flex w-full items-end justify-between">
            <Joystick game={game} />
            <div className="rounded-lg bg-black/35 px-2 py-1 text-right text-[10px] leading-tight text-white/55">
              2 dedos: girar / zoom · mapa arriba
            </div>
          </div>
        )}
        <div className="mb-1.5 max-w-full truncate rounded-full bg-black/45 px-3 py-1 text-center text-[11px] sm:text-sm">
          <span className="font-bold" style={{ color: power.color }}><Icon name={power.id} className="mr-1 h-3.5 w-3.5 -translate-y-px" />{power.name}</span>
          <span className="text-white/70"> — {power.hint}</span>
        </div>
        <div className="glass pointer-events-auto grid grid-cols-5 gap-1 rounded-2xl p-1.5 sm:flex sm:gap-1.5 sm:p-2">
          {POWERS.map((p) => {
            const sel = p.id === hud.power;
            const poor = hud.mana < p.cost;
            return (
              <button
                key={p.id}
                onClick={() => game.setPower(p.id)}
                className={`relative flex h-[50px] w-[56px] flex-col items-center justify-center rounded-xl transition-all duration-150 active:scale-90 max-[360px]:w-[52px] sm:h-[72px] sm:w-[68px] ${sel ? 'sm:-translate-y-2' : 'bg-white/5 hover:bg-white/10'} ${poor && !sel ? 'opacity-45' : ''}`}
                style={sel ? { background: `linear-gradient(180deg, ${p.color}55, ${p.color}18)`, boxShadow: `0 0 0 2px ${p.color}, 0 0 22px ${p.color}66` } : undefined}
                aria-label={p.name}
                aria-pressed={sel}
              >
                <Icon name={p.id} className="h-5 w-5 sm:h-7 sm:w-7" style={{ color: sel ? '#ffffff' : p.color }} />
                <span className="mt-0.5 text-[9px] font-bold tracking-wide text-amber-50/90 sm:text-[11px]">{p.name}</span>
                {!touch && <span className="absolute left-1 top-0.5 text-[9px] font-bold text-white/40">{p.key}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
