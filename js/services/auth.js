import { getSupabaseClient, getStore, saveStore, pullFromSupabase, syncToSupabaseIfConfigured } from './db.js?v=1.3.0';

const SESSION_KEY = 'darkness_session_v1';

/**
 * Obtiene la sesión actual (Local o Supabase)
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

export async function loginUser({ email, password, name }) {
  const client = await getSupabaseClient();
  if (client && password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message);
    }
    const session = {
      isLogged: true,
      mode: 'cloud',
      email: data.user.email,
      name: name || data.user.user_metadata?.name || email.split('@')[0]
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    await pullFromSupabase();
    return session;
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
  const client = await getSupabaseClient();
  if (!client) {
    throw new Error('Primero configura tu URL y Anon Key de Supabase en Ajustes.');
  }
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { name } }
  });
  if (error) throw new Error(error.message);

  const session = {
    isLogged: true,
    mode: 'cloud',
    email: data.user?.email || email,
    name: name || email.split('@')[0]
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  await syncToSupabaseIfConfigured();
  return session;
}

export async function logoutUser() {
  const client = await getSupabaseClient();
  if (client) {
    await client.auth.signOut().catch(() => {});
  }
  const current = getCurrentSession();
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    ...current,
    isLogged: false
  }));
}
