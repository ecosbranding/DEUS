import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

// Firebase client keys identify the project; the PIN pepper stays server-side.
const firebaseConfig = {
  apiKey: 'AIzaSyAKqR-bSJ_6aAd9P9Z9W5XOpSLx2KTbNw',
  authDomain: 'geometria-760b8.firebaseapp.com',
  projectId: 'geometria-760b8',
  storageBucket: 'geometria-760b8.firebasestorage.app',
  messagingSenderId: '442978325535',
  appId: '1:442978325535:web:e7c9cc4f185f4b29edf12a',
  measurementId: 'G-Z2458ZFCDL',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY?.trim();
export const appCheckConfigured = Boolean(recaptchaSiteKey);

if (recaptchaSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const functions = getFunctions(app, 'us-central1');