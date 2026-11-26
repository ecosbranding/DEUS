import { PLANETS, type Hud } from '../game/data';
import type { Game } from '../game/engine';
import Icon from './Icon';

const CENTER = { x: 350, y: 245 };
const ORBITS = [
  { r: 28, a: -47 }, { r: 48, a: 148 }, { r: 69, a: -17 }, { r: 91, a: 164 },
  { r: 120, a: -39 }, { r: 150, a: 173 }, { r: 183, a: -43 }, { r: 216, a: 159 },
];

interface Props { hud: Hud; game: Game; onClose(): void }

export default function SolarMap({ hud, game, onClose }: Props) {
  const select = (planet: number) => {
    onClose();
    if (game.state === 'paused') game.togglePause();
    if (planet !== hud.planet) game.travel(planet);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#03020b]/80 p-3 backdrop-blur-md touch-pan-y sm:p-6">
      <section className="glass pop-in relative my-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-amber-200/25 p-4 sm:p-6">
        <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl" />
        <header className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold tracking-[0.38em] text-amber-200/60">NAVEGACIÓN CELESTE</p>
            <h2 className="gold-text mt-1 font-display text-2xl font-extrabold tracking-wide sm:text-4xl">Sistema solar</h2>
            <p className="mt-1 text-xs text-amber-50/60 sm:text-sm">Elige un mundo para viajar. Los mundos visitados conservan tu civilización.</p>
          </div>
          <button onClick={onClose} className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-amber-100 hover:bg-white/10" aria-label="Cerrar mapa">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </header>

        <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#070513]/80">
          <svg viewBox="0 0 700 490" role="img" aria-label="Mapa orbital del sistema solar" className="block max-h-[56vh] w-full">
            <defs>
              <radialGradient id="solarSun">
                <stop offset="0" stopColor="#fff8d0" />
                <stop offset=".22" stopColor="#ffc451" />
                <stop offset=".7" stopColor="#f07a25" stopOpacity=".38" />
                <stop offset="1" stopColor="#f07a25" stopOpacity="0" />
              </radialGradient>
              <filter id="sunGlow" x="-300%" y="-300%" width="700%" height="700%">
                <feGaussianBlur stdDeviation="12" />
              </filter>
              <linearGradient id="mapFade" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#11152b" stopOpacity=".42" />
                <stop offset="1" stopColor="#080612" stopOpacity=".03" />
              </linearGradient>
            </defs>
            <rect width="700" height="490" fill="url(#mapFade)" />
            {Array.from({ length: 68 }, (_, i) => {
              const x = ((i * 137.5 + 19) % 690) + 5;
              const y = ((i * 73.3 + 31) % 470) + 10;
              const opacity = 0.2 + ((i * 31) % 6) * 0.09;
              return <circle key={i} cx={x} cy={y} r={i % 9 === 0 ? 1.35 : 0.75} fill="#dbe6ff" opacity={opacity} />;
            })}
            <g transform="translate(0 0)">
              {ORBITS.map(({ r }, i) => (
                <ellipse key={r} cx={CENTER.x} cy={CENTER.y} rx={r} ry={r * 0.55} transform={`rotate(-16 ${CENTER.x} ${CENTER.y})`} fill="none" stroke={i === hud.planet ? '#ffe5a3' : '#9ca8d0'} strokeOpacity={i === hud.planet ? 0.42 : 0.2} strokeWidth={i === hud.planet ? 1.5 : 1} strokeDasharray={i === hud.planet ? 'none' : '2 4'} />
              ))}
              <circle cx={CENTER.x} cy={CENTER.y} r="45" fill="url(#solarSun)" filter="url(#sunGlow)" opacity=".7" />
              <circle cx={CENTER.x} cy={CENTER.y} r="12" fill="url(#solarSun)" />
              <circle cx={CENTER.x} cy={CENTER.y} r="4.5" fill="#fff4c5" />
              <text x={CENTER.x} y={CENTER.y + 30} textAnchor="middle" fill="#ffc96f" fontSize="9" fontFamily="Inter, sans-serif" letterSpacing="2">SOL</text>
            </g>

            {PLANETS.map((p, i) => {
              const { r, a } = ORBITS[i];
              const angle = (a * Math.PI) / 180;
              const x = CENTER.x + Math.cos(angle) * r;
              const y = CENTER.y + Math.sin(angle) * r * 0.55;
              const active = i === hud.planet;
              const visited = hud.visited[i];
              const size = i === 4 || i === 5 ? 10 : i > 5 ? 7 : 5.5;
              return (
                <g
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Viajar a ${p.name}${visited ? ', visitado' : ', mundo nuevo'}`}
                  onClick={() => select(i)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); } }}
                  className="cursor-pointer outline-none"
                >
                  <circle cx={x} cy={y} r="22" fill="transparent" />
                  {active && <circle cx={x} cy={y} r={size + 6} fill="none" stroke="#fff1c5" strokeOpacity=".7" strokeWidth="1.5" />}
                  {p.ring && <ellipse cx={x} cy={y} rx={size * 1.9} ry={size * 0.58} transform={`rotate(-18 ${x} ${y})`} fill="none" stroke="#e9d18c" strokeOpacity=".78" strokeWidth="2.1" />}
                  <circle cx={x} cy={y} r={size} fill={p.dot} stroke={active ? '#fff9e8' : '#ffffff88'} strokeWidth={active ? 2 : 1} />
                  <circle cx={x - size * 0.28} cy={y - size * 0.3} r={size * 0.28} fill="#ffffff" opacity=".48" />
                  <text x={x} y={y + size + 16} textAnchor="middle" fill={active ? '#fff0bd' : visited ? '#d9d5c8' : '#ffffff88'} fontSize="10" fontWeight={active ? 700 : 500} fontFamily="Inter, sans-serif">{p.name}</text>
                  {visited && !active && <circle cx={x + size + 2} cy={y - size} r="2.2" fill="#78edb4" />}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-8 sm:gap-2">
          {PLANETS.map((p, i) => (
            <button key={p.id} onClick={() => select(i)} className={`pointer-events-auto flex min-w-0 flex-col items-center rounded-xl border px-1 py-2 transition active:scale-95 ${i === hud.planet ? 'border-amber-200/70 bg-amber-100/10' : 'border-white/10 bg-white/[0.025] hover:bg-white/[0.08]'}`}>
              <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]" style={{ backgroundColor: p.dot, color: p.dot }} />
              <span className="mt-1 w-full truncate text-[9px] font-semibold text-amber-50/80 sm:text-[10px]">{p.name}</span>
              <span className="text-[8px] text-amber-200/50">×{p.mult}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-[10px] text-white/40">Verde: visitado · Dorado: mundo actual · Pulsa cualquier planeta para viajar</p>
      </section>
    </div>
  );
}