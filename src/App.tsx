import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { Game, type GameState } from './game/engine';
import type { GameOverInfo, Hud as HudState, Toast } from './game/data';
import { initAudio, setMuted, sfx } from './game/audio';
import { auth } from './firebase';
import Hud, { fmtTime } from './ui/Hud';
import Icon from './ui/Icon';
import PinGate from './ui/PinGate';
import SolarMap from './ui/SolarMap';

interface Row { name: string; score: number; worlds: number; time: number; date: number }
const KEY = 'deus.scores.v1';
const NAME_KEY = 'deus.name';

function loadScores(): Row[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? (v as Row[]) : [];
  } catch {
    return [];
  }
}
function loadName(): string {
  try { return localStorage.getItem(NAME_KEY) || 'DIOS'; } catch { return 'DIOS'; }
}

function ScoreTable({ rows, mark }: { rows: Row[]; mark?: number | null }) {
  if (!rows.length) {
    return <p className="py-3 text-center text-sm text-amber-100/50">Aún no hay leyendas. Sé la primera deidad.</p>;
  }
  return (
    <ol className="space-y-1 text-sm">
      {rows.map((r, i) => (
        <li
          key={r.date}
          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 tabular-nums ${r.date === mark ? 'bg-amber-300/20 ring-1 ring-amber-300/70' : 'bg-white/5'}`}
        >
          <span className="w-6 font-display font-extrabold text-amber-300">{i === 0 ? <Icon name="crown" className="h-4 w-4" /> : i + 1}</span>
          <span className="flex-1 truncate font-semibold uppercase tracking-wide">{r.name}</span>
          <span className="hidden text-xs text-white/45 sm:inline">{r.worlds}/8 mundos · {fmtTime(r.time)}</span>
          <span className="font-display font-extrabold text-amber-100">{r.score.toLocaleString('es')}</span>
        </li>
      ))}
    </ol>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-amber-200/30 bg-black/40 px-1.5 py-0.5 text-[11px] font-bold text-amber-100">{children}</kbd>;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<GameState>('menu');
  const [hud, setHud] = useState<HudState | null>(null);
  const [toast, setToast] = useState<(Toast & { id: number }) | null>(null);
  const [over, setOver] = useState<GameOverInfo | null>(null);
  const [scores, setScores] = useState<Row[]>(loadScores);
  const [mark, setMark] = useState<number | null>(null);
  const [muted, setMutedState] = useState(false);
  const [name, setName] = useState(loadName);
  const [denyKey, setDenyKey] = useState(0);
  const [error, setError] = useState('');
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);
  const [touch] = useState(() => typeof matchMedia !== 'undefined' && (matchMedia('(pointer: coarse)').matches || innerWidth < 760));
  const nameRef = useRef(name);
  nameRef.current = name;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setAuthUser(user);
    setAuthLoading(false);
    if (user?.displayName) {
      setName(user.displayName);
      try { localStorage.setItem(NAME_KEY, user.displayName); } catch { /* ignore */ }
    }
  }, () => setAuthLoading(false)), []);

  useEffect(() => {
    const overlay = overlayRef.current!;
    let game: Game;
    try {
      game = new Game(canvasRef.current!, overlay, {
        onHud: setHud,
        onToast: (t) => setToast({ ...t, id: performance.now() }),
        onDeny: () => setDenyKey((k) => k + 1),
        onState: setState,
        onOver: (info) => {
          setMapOpen(false);
          const row: Row = {
            name: (nameRef.current.trim() || 'DIOS').slice(0, 12),
            score: info.score, worlds: info.worlds, time: info.time, date: Date.now(),
          };
          const next = [...loadScores(), row].sort((a, b) => b.score - a.score).slice(0, 8);
          try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
          setScores(next);
          setMark(row.date);
          setOver(info);
        },
      });
    } catch (e) {
      setError('Tu navegador no pudo iniciar WebGL. Prueba con otro navegador o activa la aceleración por hardware.');
      console.error(e);
      return;
    }
    gameRef.current = game;
    (window as unknown as { __deus?: Game }).__deus = game;
    setReady(true);
    return () => {
      game.dispose();
      overlay.innerHTML = '';
      gameRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const g = gameRef.current;
    if (!g || !auth.currentUser) return;
    initAudio();
    try { localStorage.setItem(NAME_KEY, nameRef.current); } catch { /* ignore */ }
    setOver(null);
    setToast(null);
    g.start();
  }, []);

  const logout = useCallback(async () => {
    setMapOpen(false);
    gameRef.current?.returnToMenu();
    try {
      await signOut(auth);
    } catch {
      setError('No se pudo cerrar la sesión. Comprueba tu conexión e inténtalo otra vez.');
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      setMuted(!m);
      return !m;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT';
      const s = stateRef.current;
      if (e.code === 'Enter' && auth.currentUser && (s === 'menu' || s === 'over')) { e.preventDefault(); start(); return; }
      if (typing) return;
      if (!auth.currentUser) return;
      if (e.code === 'Space' && s === 'menu') { e.preventDefault(); start(); }
      if (e.code === 'KeyR' && (s === 'paused' || s === 'over')) start();
      if (e.code === 'KeyM') toggleMute();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [start, toggleMute]);

  const best = scores[0]?.score ?? 0;
  const isRecord = !!over && scores[0]?.date === mark;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#05030f]">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" />

      {ready && hud && authUser && (state === 'playing' || state === 'paused') && gameRef.current && (
        <Hud
          hud={hud}
          game={gameRef.current}
          muted={muted}
          touch={touch}
          denyKey={denyKey}
          onMute={toggleMute}
          onMap={() => setMapOpen(true)}
          onPause={() => { sfx.ui(); gameRef.current?.togglePause(); }}
        />
      )}

      {mapOpen && hud && gameRef.current && authUser && (state === 'playing' || state === 'paused') && (
        <SolarMap hud={hud} game={gameRef.current} onClose={() => setMapOpen(false)} />
      )}

      {toast && state === 'playing' && (
        <div
          key={toast.id}
          className="toast glass pointer-events-none absolute left-1/2 top-[218px] z-20 max-w-[92vw] rounded-full px-4 py-2 text-center text-sm font-bold sm:top-28 sm:text-base"
          style={{ color: toast.color, borderColor: toast.color + '88' }}
        >
          {toast.icon && <Icon name={toast.icon} className="mr-1.5 h-4 w-4 -translate-y-px" />}
          {toast.text}
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 text-center text-amber-100">{error}</div>
      )}

      {/* ───────── START ───────── */}
      {authLoading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#05030f]/90 text-center">
          <div className="glass rounded-2xl px-6 py-5">
            <p className="gold-text font-display text-2xl font-extrabold tracking-[0.2em]">DEUS</p>
            <p className="mt-2 text-xs text-amber-50/60">Conectando con Firebase…</p>
          </div>
        </div>
      )}

      {!authLoading && !authUser && !error && <PinGate />}

      {state === 'menu' && authUser && !authLoading && !error && (
        <div className="absolute inset-0 z-30 touch-pan-y overflow-y-auto bg-[radial-gradient(ellipse_at_center,rgba(5,3,15,0.25)_0%,rgba(5,3,15,0.88)_75%)]">
          <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-4 py-8">
            <div className="relative flex flex-col items-center">
              <div className="halo absolute -top-10 h-56 w-56 rounded-full border border-dashed border-amber-200/30 sm:h-72 sm:w-72" />
              <p className="float-y text-xs font-bold tracking-[0.5em] text-amber-200/70">✦ SISTEMA SOLAR ✦</p>
              <h1 className="gold-text font-display text-7xl font-extrabold leading-none tracking-[0.12em] drop-shadow-[0_0_40px_rgba(255,200,90,0.35)] sm:text-8xl">
                DEUS
              </h1>
              <p className="mt-2 max-w-md text-center text-sm text-amber-50/85 sm:text-base">
                Da vida o quítala. Levanta montañas, excava ríos, inventa bestias, desata plagas y viaja de planeta en planeta.
              </p>
            </div>

            <div className="pop-in mt-6 flex w-full max-w-sm flex-col items-stretch gap-3">
              <div className="glass flex items-center gap-3 rounded-xl px-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200/10 text-amber-200"><Icon name="user" className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-bold tracking-widest text-amber-200/60">CUENTA CONECTADA</span>
                  <span className="block truncate font-display text-base font-extrabold uppercase text-amber-100">{authUser.displayName || name || 'DIOS'}</span>
                </div>
                <button onClick={logout} className="rounded-lg px-2 py-2 text-[10px] font-bold tracking-wide text-amber-100/60 hover:bg-white/5 hover:text-amber-100">SALIR</button>
              </div>
              <button onClick={start} disabled={!ready} className="btn-gold rounded-2xl px-6 py-4 font-display text-xl font-extrabold tracking-widest disabled:opacity-50">
                ✦ COMENZAR A REINAR
              </button>
              {best > 0 && <p className="text-center text-xs text-amber-100/60">Tu mejor gloria: <b className="text-amber-200">{best.toLocaleString('es')}</b></p>}
            </div>

            <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
              <div className="glass rounded-2xl p-4 text-sm leading-relaxed text-amber-50/85">
                <h2 className="mb-2 font-display text-sm font-extrabold tracking-widest text-amber-200">CÓMO JUGAR</h2>
                <p className="mb-2">
                  Mantén viva la <b className="text-amber-200">FE</b> obrando milagros: cuando llegue a cero serás olvidado. Alterna poderes
                  distintos para subir el <b className="text-fuchsia-300">combo</b> y coloniza los 8 planetas para ganar más gloria.
                </p>
                <ul className="space-y-1.5 text-[13px]">
                  <li><Icon name="tap" className="mr-1.5 h-3.5 w-3.5 text-amber-200" /><b>Toca / clic</b> en el planeta: usar poder (mantén para repetir)</li>
                  <li><Icon name="orbit" className="mr-1.5 h-3.5 w-3.5 text-amber-200" /><b>Arrastra fuera</b> del planeta, clic derecho o 2 dedos: girar</li>
                  <li><Icon name="zoom" className="mr-1.5 h-3.5 w-3.5 text-amber-200" />Rueda / pellizco: zoom · aléjate para ver los planetas</li>
                  <li className="hidden sm:block"><Kbd>WASD</Kbd> girar · <Kbd>Espacio</Kbd> poder al centro · <Kbd>1</Kbd>–<Kbd>0</Kbd> poderes</li>
                  <li className="hidden sm:block"><Kbd>Q</Kbd>/<Kbd>E</Kbd> planetas · <Kbd>Z</Kbd>/<Kbd>X</Kbd> zoom · <Kbd>P</Kbd> pausa · <Kbd>M</Kbd> sonido</li>
                </ul>
              </div>
              <div className="glass rounded-2xl p-4">
                <h2 className="mb-2 font-display text-sm font-extrabold tracking-widest text-amber-200">PANTEÓN DE LEYENDAS</h2>
                <ScoreTable rows={scores} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────── PAUSE ───────── */}
      {state === 'paused' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05030f]/70 p-4 backdrop-blur-sm">
          <div className="glass pop-in w-full max-w-sm rounded-3xl p-6 text-center">
            <h2 className="gold-text font-display text-4xl font-extrabold tracking-widest">PAUSA</h2>
            <p className="mt-1 text-sm text-amber-50/70">El cosmos contiene el aliento…</p>
            <div className="mt-5 flex flex-col gap-3">
              <button onClick={() => gameRef.current?.togglePause()} className="btn-gold rounded-2xl px-6 py-3 font-display text-lg font-extrabold tracking-widest">
                <Icon name="play" className="mr-2 h-4 w-4" />CONTINUAR
              </button>
              <button onClick={start} className="rounded-2xl border border-amber-200/30 bg-white/5 px-6 py-3 font-bold tracking-wide text-amber-100 hover:bg-white/10 active:scale-95">
                <Icon name="restart" className="mr-1.5 h-4 w-4" />Reiniciar <span className="hidden text-white/40 sm:inline">(R)</span>
              </button>
              <button onClick={toggleMute} className="text-sm text-amber-100/70 hover:text-amber-100">
                <Icon name={muted ? 'mute' : 'sound'} className="mr-1.5 h-4 w-4" />{muted ? 'Sonido apagado' : 'Sonido activado'}
              </button>
              <button onClick={logout} className="mt-1 rounded-xl border border-rose-200/15 bg-rose-300/5 px-4 py-2 text-xs font-bold tracking-wide text-rose-200/75 hover:bg-rose-300/10 hover:text-rose-100">
                <Icon name="logout" className="mr-1.5 h-4 w-4" />Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────── GAME OVER ───────── */}
      {state === 'over' && over && (
        <div className="absolute inset-0 z-30 touch-pan-y overflow-y-auto bg-[radial-gradient(ellipse_at_center,rgba(40,5,20,0.55)_0%,rgba(5,3,15,0.92)_80%)]">
          <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center px-4 py-8">
            <div className="glass pop-in w-full rounded-3xl p-5 text-center sm:p-7">
              <p className="text-xs font-bold tracking-[0.4em] text-rose-300/80">LA FE SE HA EXTINGUIDO</p>
              <h2 className="gold-text mt-1 font-display text-3xl font-extrabold tracking-wider sm:text-4xl">HAS SIDO OLVIDADO</h2>
              {isRecord && <p className="bump mt-2 font-display text-sm font-extrabold tracking-widest text-fuchsia-300"><Icon name="crown" className="mr-1.5 h-4 w-4" />¡NUEVO RÉCORD DIVINO!</p>}
              <div className="gold-text mt-3 font-display text-6xl font-extrabold leading-none tabular-nums">{over.score.toLocaleString('es')}</div>
              <p className="text-[10px] font-bold tracking-[0.3em] text-amber-200/60">GLORIA ETERNA</p>
              <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                {[
                  ['clock', fmtTime(over.time), 'Reinado'],
                  ['planet', `${over.worlds}/8`, 'Mundos'],
                  ['life', over.peakPop, 'Almas máx.'],
                  ['bless', over.miracles, 'Milagros'],
                ].map(([icon, v, l]) => (
                  <div key={l as string} className="rounded-xl bg-white/5 px-1 py-2">
                    <Icon name={icon as string} className="h-5 w-5 text-amber-300" />
                    <div className="font-display text-base font-extrabold tabular-nums text-amber-100">{v}</div>
                    <div className="text-[10px] text-white/50">{l}</div>
                  </div>
                ))}
              </div>
              <button onClick={start} className="btn-gold mt-5 w-full rounded-2xl px-6 py-4 font-display text-lg font-extrabold tracking-widest">
                <Icon name="restart" className="mr-2 h-5 w-5" />REINAR DE NUEVO
              </button>
              <p className="mt-2 hidden text-xs text-white/40 sm:block">Pulsa <Kbd>Enter</Kbd> o <Kbd>R</Kbd> para reiniciar al instante</p>
              <div className="mt-5 text-left">
                <h3 className="mb-2 text-center font-display text-xs font-extrabold tracking-widest text-amber-200">PANTEÓN DE LEYENDAS</h3>
                <ScoreTable rows={scores} mark={mark} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { App };
