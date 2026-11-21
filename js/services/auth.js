import {
  getFirebaseClient,
  getStore,
  saveStore,
  pullFromFirebase,
  syncToFirebaseIfConfigured
} from './db.js?v=6.0.0';

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
