import { useState, type FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import { appCheckConfigured } from '../firebase';
import { createPinAccount, digitsOnly, loginWithPin, pinIsValid } from '../auth/pin';
import Icon from './Icon';

type Mode = 'login' | 'register';

function errorText(error: unknown, mode: Mode) {
  if (error instanceof FirebaseError) {
    if (error.code === 'functions/already-exists') return 'Ese PIN ya tiene una cuenta. Inicia sesión o elige otro.';
    if (error.code === 'functions/resource-exhausted') return 'Demasiados intentos desde esta red. Espera 15 minutos.';
    if (error.code === 'functions/unauthenticated') return 'PIN incorrecto o cuenta inexistente.';
    if (error.code === 'functions/not-found' || error.code === 'functions/unavailable') {
      return 'El acceso aún no está desplegado. Sigue los pasos de FIREBASE_SETUP.md y vuelve a intentarlo.';
    }
    if (error.code === 'functions/failed-precondition') return error.message || 'Falta configurar Firebase.';
    if (error.code === 'functions/permission-denied') return 'App Check rechazó esta solicitud. Revisa la clave reCAPTCHA del proyecto.';
    if (error.code === 'auth/operation-not-allowed') return 'Activa Firebase Authentication en la consola del proyecto.';
  }
  return mode === 'register' ? 'No se pudo crear la cuenta. Comprueba Firebase y vuelve a intentarlo.' : 'No se pudo iniciar sesión. Comprueba la conexión y vuelve a intentarlo.';
}

export default function PinGate() {
  const [mode, setMode] = useState<Mode>('login');
  const [pin, setPin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const valid = pinIsValid(pin);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setNotice('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || busy) return;
    if (!appCheckConfigured) {
      setError('Configura la clave de reCAPTCHA v3 indicada en FIREBASE_SETUP.md antes de registrarte.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'register') {
        const result = await createPinAccount(pin, displayName.trim());
        setNotice(`Cuenta creada. Bienvenido, ${result.user.displayName || 'deidad'}.`);
      } else {
        await loginWithPin(pin);
      }
    } catch (e) {
      setError(errorText(e, mode));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-[radial-gradient(ellipse_at_center,rgba(11,8,31,0.58),rgba(5,3,15,0.94)_74%)] px-4 py-7 touch-pan-y">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center">
        <div className="mb-5 text-center">
          <p className="text-[10px] font-bold tracking-[0.48em] text-amber-200/70">✦ SISTEMA SOLAR ✦</p>
          <h1 className="gold-text mt-1 font-display text-6xl font-extrabold leading-none tracking-[0.1em] sm:text-7xl">DEUS</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-amber-50/75">
            Crea tu cuenta divina con un PIN y úsala para volver a jugar desde cualquier dispositivo.
          </p>
        </div>

        <form onSubmit={submit} className="glass rounded-3xl p-5 sm:p-6">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-black/35 p-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`rounded-lg py-2.5 text-xs font-bold tracking-widest transition ${mode === 'login' ? 'bg-amber-300 text-[#251503]' : 'text-amber-50/65 hover:text-amber-50'}`}
            >
              INICIAR SESIÓN
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`rounded-lg py-2.5 text-xs font-bold tracking-widest transition ${mode === 'register' ? 'bg-amber-300 text-[#251503]' : 'text-amber-50/65 hover:text-amber-50'}`}
            >
              CREAR CUENTA
            </button>
          </div>

          {mode === 'register' && (
            <label className="mb-4 block text-xs font-bold tracking-widest text-amber-100/70">
              NOMBRE DIVINO <span className="font-normal tracking-normal text-white/40">(opcional)</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 20))}
                maxLength={20}
                autoComplete="nickname"
                placeholder="DIOS DEL COSMOS"
                className="mt-2 w-full rounded-xl border border-amber-200/15 bg-black/35 px-3 py-3 text-base font-semibold tracking-normal text-amber-50 outline-none transition placeholder:text-white/25 focus:border-amber-200/60 focus:ring-2 focus:ring-amber-300/10"
              />
            </label>
          )}

          <label className="block text-xs font-bold tracking-widest text-amber-100/70">
            PIN PERSONAL
            <div className="mt-2 flex items-center rounded-xl border border-amber-200/20 bg-black/40 px-4 transition focus-within:border-amber-200/70 focus-within:ring-2 focus-within:ring-amber-300/10">
              <span className="select-none font-display text-2xl font-extrabold text-amber-300">@</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={pin}
                onChange={(e) => { setPin(digitsOnly(e.target.value)); setError(''); }}
                maxLength={12}
                pattern="[0-9]{8,12}"
                placeholder="8–12 dígitos"
                aria-label="PIN de ocho a doce dígitos"
                className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-center font-mono text-xl font-bold tracking-[0.32em] text-white outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-white/30"
              />
              <span className="select-none font-display text-2xl font-extrabold text-amber-300">*</span>
            </div>
          </label>
          <p className="mt-2 text-[11px] leading-relaxed text-amber-50/50">El sistema añade @ y *. Solo tú conocerás el PIN. No lo compartas.</p>

          {mode === 'register' && (
            <p className="mt-3 rounded-lg border border-amber-200/10 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-amber-50/55">
              El PIN debe tener 8–12 números. Guárdalo bien: al registrarte solo con PIN no hay correo ni recuperación de cuenta.
            </p>
          )}
          {!appCheckConfigured && (
            <p className="mt-3 rounded-lg border border-sky-300/20 bg-sky-400/5 px-3 py-2 text-[11px] leading-relaxed text-sky-100/65">
              El acceso seguro requiere la clave reCAPTCHA de App Check. Está explicado paso a paso en <b>FIREBASE_SETUP.md</b>.
            </p>
          )}
          {error && <p role="alert" className="mt-3 rounded-lg border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-200">{error}</p>}
          {notice && <p role="status" className="mt-3 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">{notice}</p>}

          <button disabled={!valid || busy} className="btn-gold mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-base font-extrabold tracking-widest disabled:cursor-not-allowed disabled:opacity-40">
            <Icon name={mode === 'register' ? 'bless' : 'user'} className="h-4 w-4" />
            {busy ? 'CONECTANDO…' : mode === 'register' ? 'CREAR CUENTA' : 'ENTRAR A MI COSMOS'}
          </button>
        </form>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-white/35">
          PIN único · Sesión cifrada por Firebase Authentication · Nunca guardamos el PIN en texto plano
        </p>
      </div>
    </div>
  );
}