const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

initializeApp();

const db = getFirestore();
const auth = getAuth();
const PIN_PEPPER = defineSecret('PIN_PEPPER');
const scrypt = promisify(crypto.scrypt);
const PIN_PATTERN = /^@([0-9]{8,12})\*$/;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 12;
const HASH_BYTES = 64;

function cleanName(value, pin) {
  const candidate = typeof value === 'string'
    ? value.normalize('NFKC').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 20)
    : '';
  return candidate || `DIOS-${pin.slice(-4)}`;
}

function securePinId(pin, pepper) {
  return crypto.createHmac('sha256', pepper).update(`deus-account:${pin}`).digest('hex');
}

async function pinDigest(pin, salt, pepper) {
  const result = await scrypt(pin, `${salt}:${pepper}`, HASH_BYTES, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return result.toString('base64');
}

async function enforceRateLimit(request, pepper) {
  const address = request.rawRequest?.ip || 'unavailable';
  const bucketId = crypto.createHmac('sha256', pepper).update(`deus-rate:${address}`).digest('hex');
  const ref = db.collection('pinRateLimits').doc(bucketId);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const inWindow = data && now - data.startedAt < WINDOW_MS;
    const attempts = inWindow ? data.attempts : 0;
    if (attempts >= MAX_ATTEMPTS) {
      throw new HttpsError('resource-exhausted', 'Demasiados intentos. Espera 15 minutos.');
    }
    tx.set(ref, {
      startedAt: inWindow ? data.startedAt : now,
      attempts: attempts + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

function parsePin(data) {
  const match = PIN_PATTERN.exec(typeof data?.pin === 'string' ? data.pin : '');
  if (!match) {
    throw new HttpsError('invalid-argument', 'El PIN debe tener el formato @ seguido de 8–12 números y terminar en *.');
  }
  return match[1];
}

const commonOptions = {
  region: 'us-central1',
  maxInstances: 10,
  timeoutSeconds: 30,
  memory: '256MiB',
  enforceAppCheck: true,
  secrets: [PIN_PEPPER],
};

exports.registerWithPin = onCall(commonOptions, async (request) => {
  const pepper = PIN_PEPPER.value();
  if (!pepper || pepper.length < 32) {
    throw new HttpsError('failed-precondition', 'El servidor PIN_PEPPER no está configurado correctamente.');
  }
  await enforceRateLimit(request, pepper);

  const pin = parsePin(request.data);
  const name = cleanName(request.data?.displayName, pin);
  const salt = crypto.randomBytes(16).toString('base64url');
  const digest = await pinDigest(pin, salt, pepper);
  const accountRef = db.collection('pinAccounts').doc(securePinId(pin, pepper));
  const authUser = await auth.createUser({ displayName: name });

  try {
    await db.runTransaction(async (tx) => {
      const current = await tx.get(accountRef);
      if (current.exists) {
        throw new HttpsError('already-exists', 'Ese PIN ya tiene una cuenta.');
      }
      tx.create(accountRef, {
        uid: authUser.uid,
        salt,
        pinHash: digest,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.create(db.collection('users').doc(authUser.uid), {
        displayName: name,
        createdAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    await auth.deleteUser(authUser.uid).catch(() => undefined);
    throw error;
  }

  const token = await auth.createCustomToken(authUser.uid);
  return { token, displayName: name };
});

exports.loginWithPin = onCall(commonOptions, async (request) => {
  const pepper = PIN_PEPPER.value();
  if (!pepper || pepper.length < 32) {
    throw new HttpsError('failed-precondition', 'El servidor PIN_PEPPER no está configurado correctamente.');
  }
  await enforceRateLimit(request, pepper);

  const pin = parsePin(request.data);
  const accountRef = db.collection('pinAccounts').doc(securePinId(pin, pepper));
  const snap = await accountRef.get();
  if (!snap.exists) {
    // Keep unknown-PIN responses close in cost to a wrong PIN hash check.
    await pinDigest(pin, 'deus-dummy-salt-v1', pepper);
    throw new HttpsError('unauthenticated', 'PIN incorrecto o cuenta inexistente.');
  }

  const account = snap.data();
  const actual = Buffer.from(await pinDigest(pin, account.salt, pepper), 'base64');
  const expected = Buffer.from(account.pinHash, 'base64');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new HttpsError('unauthenticated', 'PIN incorrecto o cuenta inexistente.');
  }

  const user = await auth.getUser(account.uid);
  await db.collection('users').doc(user.uid).set({ lastLoginAt: FieldValue.serverTimestamp() }, { merge: true });
  const token = await auth.createCustomToken(user.uid);
  return { token, displayName: user.displayName || 'DIOS' };
});