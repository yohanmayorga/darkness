import { FIREBASE_CONFIG } from '../config.example.js?v=6.0.0';
import { createDefaultHabits, normalizeHabit } from '../utils/habits.js?v=4.9.0';

const STORAGE_KEY = 'darkness_store_v1';
const HABITS_SCHEMA = 2;
const FB_CFG_KEY = 'darkness_firebase_cfg';

let firebaseBundle = null;

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD local
 */
export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Datos semilla elegantes para que la aplicación sea 100% funcional desde el primer segundo
 */
function getInitialStore() {
  const today = todayISO();
  return {
    profile: {
      name: 'Usuario Darkness',
      email: 'usuario@darkness.app',
      currency: 'USD',
      heightCm: 175,
      targetWeightKg: 72.0,
      monthlyBudget: 2000,
      mementoMori: {
        birthDate: '1992-10-10',
        lifeExpectancyYears: 80,
        unit: 'months'
      }
    },
    habitsSchema: HABITS_SCHEMA,
    habits: createDefaultHabits(today),
    bodyMetrics: [
      {
        id: 'bm-1',
        date: '2026-10-15',
        time: '07:30',
        weightKg: 76.4,
        bmi: 24.9,
        bodyFatPct: 16.8,
        fatFreeWeightKg: 63.6,
        subcutaneousFatPct: 14.2,
        visceralFat: 6,
        bodyWaterPct: 60.4,
        skeletalMusclesPct: 47.2,
        muscleMassKg: 60.4,
        boneMassKg: 3.2,
        proteinPct: 19.1,
        bmr: 1745,
        metabolicAge: 28,
        waistCm: 82.0,
        bicepsCm: 36.5,
        thighCm: 56.0
      },
      {
        id: 'bm-2',
        date: '2026-11-01',
        time: '07:25',
        weightKg: 75.2,
        bmi: 24.6,
        bodyFatPct: 15.9,
        fatFreeWeightKg: 63.2,
        subcutaneousFatPct: 13.5,
        visceralFat: 5,
        bodyWaterPct: 61.1,
        skeletalMusclesPct: 47.8,
        muscleMassKg: 60.1,
        boneMassKg: 3.1,
        proteinPct: 19.4,
        bmr: 1738,
        metabolicAge: 27,
        waistCm: 80.5,
        bicepsCm: 36.8,
        thighCm: 56.2
      },
      {
        id: 'bm-3',
        date: today,
        time: '07:20',
        weightKg: 74.5,
        bmi: 24.3,
        bodyFatPct: 15.2,
        fatFreeWeightKg: 63.2,
        subcutaneousFatPct: 12.9,
        visceralFat: 5,
        bodyWaterPct: 61.6,
        skeletalMusclesPct: 48.3,
        muscleMassKg: 60.1,
        boneMassKg: 3.1,
        proteinPct: 19.6,
        bmr: 1732,
        metabolicAge: 26,
        waistCm: 79.5,
        bicepsCm: 37.0,
        thighCm: 56.5
      }
    ],
    books: [
      {
        id: 'bk-1',
        title: 'Meditaciones',
        author: 'Marco Aurelio',
        modality: 'Kindle',
        status: 'Leyendo',
        startDate: '2026-11-02',
        endDate: '',
        currentPage: 118,
        totalPages: 220,
        rating: 5,
        comments: 'Lectura nocturna obligatoria. Recordatorio constante sobre enfocarse únicamente en lo que depende de uno mismo.',
        coverUrl: ''
      },
      {
        id: 'bk-2',
        title: 'Hábitos Atómicos',
        author: 'James Clear',
        modality: 'Físico',
        status: 'Terminado',
        startDate: '2026-09-10',
        endDate: '2026-10-04',
        currentPage: 320,
        totalPages: 320,
        rating: 5,
        comments: 'Los sistemas superan a las metas. Aplicado directamente en el diseño de mi rutina matutina.',
        coverUrl: ''
      },
      {
        id: 'bk-3',
        title: 'La Psicología del Dinero',
        author: 'Morgan Housel',
        modality: 'Audiolibro',
        status: 'Por leer',
        startDate: '',
        endDate: '',
        currentPage: 0,
        totalPages: 280,
        rating: 0,
        comments: 'Próximo en la fila para escuchar durante caminatas.',
        coverUrl: ''
      }
    ],
    journalEntries: [
      {
        id: 'jr-1',
        date: today,
        title: 'Claridad, enfoque y sistema propio',
        mood: 'Enfocado',
        tags: ['Sistemas', 'Disciplina', 'Darkness'],
        content: 'Hoy comienza el registro centralizado en Darkness. La meta no es hacer más cosas al azar, sino medir con precisión los pilares fundamentales: cuerpo, mente, lectura y capital.',
        attachmentName: '',
        attachmentData: ''
      }
    ],
    transactions: [
      {
        id: 'tx-1',
        date: today,
        type: 'income',
        amount: 3200.00,
        category: 'Ingresos principales',
        account: 'Banco',
        description: 'Ingreso mensual neto',
        attachmentData: ''
      },
      {
        id: 'tx-2',
        date: today,
        type: 'expense',
        amount: 420.00,
        category: 'Alimentación',
        account: 'Banco',
        description: 'Compra mensual de mercado',
        attachmentData: ''
      },
      {
        id: 'tx-3',
        date: today,
        type: 'expense',
        amount: 45.00,
        category: 'Gimnasio',
        account: 'Efectivo',
        description: 'Mensualidad gimnasio',
        attachmentData: ''
      }
    ],
    finance: {
      bankName: 'UNFCU',
      bankCustomName: '',
      accounts: {
        bank: 0,
        binance: 0,
        bolivares: 0,
        cash: 0,
        other: 0
      },
      receivables: [],
      projectedIncome: [],
      projectedExpenses: [],
      debts: []
    },
    taskLists: [
      { id: 'list-general', name: 'General (Rápida)', isDefault: true, createdAt: today }
    ],
    tasks: []
  };
}

/**
 * Carga el almacén local
 */
export function getStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = getInitialStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.profile) parsed.profile = {};
    if (!parsed.profile.mementoMori) {
      parsed.profile.mementoMori = {
        birthDate: '1992-10-10',
        lifeExpectancyYears: 80,
        unit: 'months'
      };
    }
    // Migración v2 de hábitos: programación por días + vigencia (desde / hasta)
    if (!parsed.habitsSchema || parsed.habitsSchema < HABITS_SCHEMA) {
      parsed.habits = createDefaultHabits(todayISO());
      parsed.habitsSchema = HABITS_SCHEMA;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    if (!Array.isArray(parsed.habits)) parsed.habits = [];
    parsed.habits.forEach(h => normalizeHabit(h, todayISO()));

    // Fusión automática de hábitos importados en inglés hacia los hábitos originales en español
    const MERGE_ALIASES = {
      'skin care (m)': 'Skin Care (diurno)',
      'skin care (n)': 'Skin Care (nocturno)',
      'water (3l)': 'Agua',
      'reading': 'Leer',
      'no sugar': 'No azúcar',
      'no alcohol': 'No alcohol',
      'gym': 'Gimnasio',
      'sleep +7h': 'Dormir +7h'
    };
    let mergedAny = false;
    const toRemove = new Set();
    parsed.habits.forEach(dup => {
      const targetName = MERGE_ALIASES[String(dup.name || '').trim().toLowerCase()];
      if (!targetName) return;
      const orig = parsed.habits.find(h => h.id !== dup.id && h.name.toLowerCase() === targetName.toLowerCase());
      if (orig) {
        orig.logs = { ...(dup.logs || {}), ...(orig.logs || {}) };
        if (dup.startDate && (!orig.startDate || dup.startDate < orig.startDate)) {
          orig.startDate = dup.startDate;
        }
        toRemove.add(dup.id);
        mergedAny = true;
      }
    });
    if (mergedAny) {
      parsed.habits = parsed.habits.filter(h => !toRemove.has(h.id));
      const gym = parsed.habits.find(h => h.id === 'hab-gym' || h.name.toLowerCase() === 'gimnasio');
      if (gym) gym.days = [1, 2, 3, 4, 5];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      syncToSupabaseIfConfigured(parsed).catch(() => {});
    }

    return parsed;
  } catch (e) {
    console.error('Error leyendo store local:', e);
    return getInitialStore();
  }
}

/**
 * Guarda el almacén local y dispara sincronización en segundo plano si Supabase está activo
 */
export function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent('darkness:data-updated'));
  syncToSupabaseIfConfigured(store).catch(() => {});
}

/**
 * Configuración de Google Firebase (Firestore + Auth)
 */
export function getFirebaseConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(FB_CFG_KEY) || '{}');
    const merged = {
      apiKey: String(saved.apiKey || FIREBASE_CONFIG.apiKey || '').trim(),
      authDomain: String(saved.authDomain || FIREBASE_CONFIG.authDomain || '').trim(),
      projectId: String(saved.projectId || FIREBASE_CONFIG.projectId || '').trim(),
      storageBucket: String(saved.storageBucket || FIREBASE_CONFIG.storageBucket || '').trim(),
      messagingSenderId: String(saved.messagingSenderId || FIREBASE_CONFIG.messagingSenderId || '').trim(),
      appId: String(saved.appId || FIREBASE_CONFIG.appId || '').trim()
    };
    return merged;
  } catch {
    return { ...FIREBASE_CONFIG };
  }
}

export function setFirebaseConfig(cfg) {
  localStorage.setItem(FB_CFG_KEY, JSON.stringify({
    apiKey: String(cfg.apiKey || '').trim(),
    authDomain: String(cfg.authDomain || '').trim(),
    projectId: String(cfg.projectId || '').trim(),
    storageBucket: String(cfg.storageBucket || '').trim(),
    messagingSenderId: String(cfg.messagingSenderId || '').trim(),
    appId: String(cfg.appId || '').trim()
  }));
  firebaseBundle = null;
  firebaseStorageBundle = null;
}

export function isFirebaseConfigured() {
  const cfg = getFirebaseConfig();
  return Boolean(cfg.apiKey && cfg.projectId && cfg.appId);
}

export const isSupabaseConfigured = isFirebaseConfigured;

let firebaseStorageBundle = null;

/**
 * Carga bajo demanda el módulo Firebase Storage para archivos binarios (notas de voz)
 */
export async function getFirebaseStorageClient() {
  const fb = await getFirebaseClient();
  if (!fb) return null;
  if (firebaseStorageBundle) return firebaseStorageBundle;

  const cfg = getFirebaseConfig();
  if (!cfg.storageBucket) return null;

  try {
    const storageMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js');
    const storage = storageMod.getStorage(fb.app, `gs://${cfg.storageBucket.replace(/^gs:\/\//, '')}`);
    firebaseStorageBundle = { ...fb, storage, storageMod };
    return firebaseStorageBundle;
  } catch (err) {
    console.warn('No se pudo cargar Firebase Storage:', err);
    return null;
  }
}

/**
 * Inicializa dinámicamente Firebase (App, Auth, Firestore) vía ESM CDN oficial de Google
 */
export async function getFirebaseClient() {
  if (!isFirebaseConfigured()) return null;
  if (firebaseBundle) return firebaseBundle;

  const cfg = getFirebaseConfig();
  try {
    const [appMod, authMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
    ]);
    const existing = appMod.getApps().find(a => a.name === 'darkness');
    const app = existing || appMod.initializeApp(cfg, 'darkness');
    const auth = authMod.getAuth(app);
    const db = fsMod.getFirestore(app);
    firebaseBundle = { app, auth, db, authMod, fsMod };
    return firebaseBundle;
  } catch (err) {
    console.warn('No se pudo cargar el SDK de Firebase:', err);
    return null;
  }
}

/**
 * Sincroniza un snapshot JSON del usuario autenticado en Cloud Firestore (colección `users/{uid}`)
 */
export async function syncToFirebaseIfConfigured(storeData = null) {
  const fb = await getFirebaseClient();
  if (!fb) return { ok: false, reason: 'not_configured' };

  await fb.auth.authStateReady();
  const user = fb.auth.currentUser;
  if (!user) return { ok: false, reason: 'not_authenticated' };

  const payload = JSON.parse(JSON.stringify(storeData || getStore()));
  try {
    const ref = fb.fsMod.doc(fb.db, 'users', user.uid);
    await fb.fsMod.setDoc(ref, {
      payload,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { ok: true };
  } catch (err) {
    console.warn('Error sincronizando con Firebase:', err?.message || err);
    return { ok: false, reason: err?.message || 'sync_error' };
  }
}

export const syncToSupabaseIfConfigured = syncToFirebaseIfConfigured;

/**
 * Descarga el snapshot desde Cloud Firestore y actualiza el almacenamiento local
 */
export async function pullFromFirebase() {
  const fb = await getFirebaseClient();
  if (!fb) return { ok: false, reason: 'not_configured' };

  await fb.auth.authStateReady();
  const user = fb.auth.currentUser;
  if (!user) return { ok: false, reason: 'not_authenticated' };

  try {
    const ref = fb.fsMod.doc(fb.db, 'users', user.uid);
    const snap = await fb.fsMod.getDoc(ref);
    if (snap.exists() && snap.data()?.payload) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap.data().payload));
      window.dispatchEvent(new CustomEvent('darkness:data-updated'));
      return { ok: true, updatedAt: snap.data().updatedAt };
    }
    return { ok: false, reason: 'empty' };
  } catch (err) {
    return { ok: false, reason: err?.message || 'pull_error' };
  }
}

export const pullFromSupabase = pullFromFirebase;

/**
 * Convierte un archivo o imagen subida en DataURL comprimido (redimensionado automático para cuidar memoria)
 */
export function fileToDataUrl(file, { maxWidth = 480, quality = 0.78 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (!file.type || !file.type.startsWith('image/')) {
        return resolve(result);
      }
      const img = new Image();
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(result);
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(result);
        }
      };
      img.onerror = () => resolve(result);
      img.src = result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
