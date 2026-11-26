import {
  getFirebaseClient,
  getStore,
  saveStore,
  pullFromFirebase,
  syncToFirebaseIfConfigured
} from './db.js?v=6.9.5';

const SESSION_KEY = 'darkness_session_v1';

/**
 * Obtiene la sesión actual (Local o Firebase Cloud)
 */
export function getCurrentSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      const store = getStore();
      const defaultSession = {
        isLogged: true,
        mode: 'local',
        email: store.profile.email,
        name: store.profile.name
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(defaultSession));
      return defaultSession;
    }
    return JSON.parse(raw);
  } catch {
    return { isLogged: true, mode: 'local', email: 'usuario@darkness.app', name: 'Usuario Darkness' };
  }
}

async function finishCloudSignIn(user, fallbackName) {
  const session = {
    isLogged: true,
    mode: 'cloud',
    email: user.email || '',
    name: fallbackName || user.displayName || (user.email ? user.email.split('@')[0] : 'Usuario Darkness')
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  const pulled = await pullFromFirebase();
  if (!pulled.ok && pulled.reason === 'empty') {
    await syncToFirebaseIfConfigured();
  }
  return session;
}

export async function loginUser({ email, password, name }) {
  const fb = await getFirebaseClient();
  if (fb && password) {
    const cred = await fb.authMod.signInWithEmailAndPassword(fb.auth, email.trim(), password);
    return finishCloudSignIn(cred.user, name);
  }

  // Modo Local / Offline-First
  const store = getStore();
  if (name) store.profile.name = name;
  if (email) store.profile.email = email;
  saveStore(store);

  const session = {
    isLogged: true,
    mode: 'local',
    email: store.profile.email,
    name: store.profile.name
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function registerCloudUser({ email, password, name }) {
  const fb = await getFirebaseClient();
  if (!fb) {
    throw new Error('Primero configura tu conexión de Firebase en Ajustes.');
  }
  const cred = await fb.authMod.createUserWithEmailAndPassword(fb.auth, email.trim(), password);
  if (name) {
    await fb.authMod.updateProfile(cred.user, { displayName: name }).catch(() => {});
  }
  return finishCloudSignIn(cred.user, name);
}

export async function loginWithGoogle() {
  const fb = await getFirebaseClient();
  if (!fb) {
    throw new Error('Firebase no está configurado.');
  }
  const provider = new fb.authMod.GoogleAuthProvider();
  const cred = await fb.authMod.signInWithPopup(fb.auth, provider);
  return finishCloudSignIn(cred.user, cred.user.displayName);
}

export async function handleGoogleRedirectResult() {
  return null;
}

export async function logoutUser() {
  const fb = await getFirebaseClient();
  if (fb) {
    await fb.authMod.signOut(fb.auth).catch(() => {});
  }
  const current = getCurrentSession();
  const local = { ...current, mode: 'local' };
  localStorage.setItem(SESSION_KEY, JSON.stringify(local));
  return local;
}

/**
 * SHA-256 determinístico en JS puro (funciona tanto en HTTPS como en HTTP local)
 */
function sha256Hex(input) {
  const bytes = new TextEncoder().encode(String(input));
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);

  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const w = new Uint32Array(64);
  for (let i = 0; i < paddedLen; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map(v => v.toString(16).padStart(8, '0')).join('');
}

export function isValidPin(pin) {
  return /^\d{8}$/.test(String(pin || '').trim());
}

function derivePinCredentials(pin) {
  const clean = String(pin || '').trim();
  if (!isValidPin(clean)) {
    throw new Error('La clave debe tener exactamente 8 dígitos numéricos.');
  }
  const emailHash = sha256Hex(`darkness:pin:v1:email:${clean}`).slice(0, 24);
  const passHash = sha256Hex(`darkness:pin:v1:pass:${clean}`);
  return {
    email: `pin-${emailHash}@darkness.app`,
    password: passHash
  };
}

/**
 * Inicia sesión en Firebase usando únicamente el PIN de 8 dígitos y descarga todo el contenido
 */
export async function loginWithPin(pin) {
  const fb = await getFirebaseClient();
  if (!fb) {
    throw new Error('Firebase no está configurado.');
  }
  const { email, password } = derivePinCredentials(pin);
  const cred = await fb.authMod.signInWithEmailAndPassword(fb.auth, email, password);
  return finishCloudSignIn(cred.user, 'Usuario Darkness');
}

/**
 * Crea una bóveda nueva en Firebase asociada al PIN de 8 dígitos
 */
export async function registerWithPin(pin) {
  const fb = await getFirebaseClient();
  if (!fb) {
    throw new Error('Firebase no está configurado.');
  }
  const { email, password } = derivePinCredentials(pin);
  const cred = await fb.authMod.createUserWithEmailAndPassword(fb.auth, email, password);
  return finishCloudSignIn(cred.user, 'Usuario Darkness');
}

/**
 * Copia los datos actuales del dispositivo a la bóveda del PIN de 8 dígitos en Firebase
 */
export async function migrateStoreToPin(pin) {
  const fb = await getFirebaseClient();
  if (!fb) {
    throw new Error('Firebase no está configurado.');
  }
  const snapshot = JSON.parse(JSON.stringify(getStore()));
  const { email, password } = derivePinCredentials(pin);

  let cred;
  try {
    cred = await fb.authMod.signInWithEmailAndPassword(fb.auth, email, password);
  } catch (err) {
    const code = err?.code || '';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      cred = await fb.authMod.createUserWithEmailAndPassword(fb.auth, email, password);
    } else {
      throw err;
    }
  }

  saveStore(snapshot);
  const syncRes = await syncToFirebaseIfConfigured(snapshot);
  if (!syncRes.ok) {
    throw new Error(syncRes.reason || 'No se pudo subir el respaldo a Firebase.');
  }

  const session = {
    isLogged: true,
    mode: 'cloud',
    email: cred.user.email || '',
    name: snapshot.profile?.name || 'Usuario Darkness'
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
