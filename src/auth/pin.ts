import { signInWithCustomToken } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase';

export const PIN_MIN = 8;
export const PIN_MAX = 12;

export function digitsOnly(value: string) {
  return value.replace(/\D/g, '').slice(0, PIN_MAX);
}

export function pinIsValid(pin: string) {
  return new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);
}

interface PinResponse {
  token: string;
  displayName: string;
}

async function redeemToken(token: string) {
  return signInWithCustomToken(auth, token);
}

export async function createPinAccount(pin: string, displayName: string) {
  const register = httpsCallable<{ pin: string; displayName: string }, PinResponse>(functions, 'registerWithPin');
  const result = await register({ pin: `@${pin}*`, displayName });
  return redeemToken(result.data.token);
}

export async function loginWithPin(pin: string) {
  const login = httpsCallable<{ pin: string }, PinResponse>(functions, 'loginWithPin');
  const result = await login({ pin: `@${pin}*` });
  return redeemToken(result.data.token);
}