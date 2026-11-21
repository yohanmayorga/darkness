import { SUPABASE_CONFIG } from '../config.example.js?v=1.4.0';
import { createDefaultHabits, normalizeHabit } from '../utils/habits.js?v=3.3.0';

const STORAGE_KEY = 'darkness_store_v1';
const HABITS_SCHEMA = 2;
const SUPA_CFG_KEY = 'darkness_supabase_cfg';

let supabaseClient = null;

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
 * Configuración de Supabase
 */
function normalizeSupabaseUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

export function getSupabaseConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(SUPA_CFG_KEY) || '{}');
    return {
      url: normalizeSupabaseUrl(saved.url || SUPABASE_CONFIG.url || ''),
      anonKey: String(saved.anonKey || SUPABASE_CONFIG.anonKey || '').trim()
    };
  } catch {
    return { url: '', anonKey: '' };
  }
}

export function setSupabaseConfig(url, anonKey) {
  localStorage.setItem(SUPA_CFG_KEY, JSON.stringify({
    url: normalizeSupabaseUrl(url),
    anonKey: anonKey.trim()
  }));
  supabaseClient = null;
}

export function isSupabaseConfigured() {
  const cfg = getSupabaseConfig();
  return Boolean(cfg.url && cfg.anonKey);
}

/**
 * Inicializa dinámicamente el cliente de Supabase vía ESM CDN cuando está configurado
 */
export async function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (supabaseClient) return supabaseClient;

  const { url, anonKey } = getSupabaseConfig();
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabaseClient = createClient(url, anonKey);
    return supabaseClient;
  } catch (err) {
    console.warn('No se pudo cargar el SDK de Supabase:', err);
    return null;
  }
}

/**
 * Sincroniza un snapshot JSON del usuario autenticado en Supabase (tabla `user_snapshots`)
 */
export async function syncToSupabaseIfConfigured(storeData = null) {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, reason: 'not_configured' };

  const { data: sessionData } = await client.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return { ok: false, reason: 'not_authenticated' };

  const payload = storeData || getStore();
  const { error } = await client
    .from('user_snapshots')
    .upsert({
      user_id: user.id,
      payload,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) {
    console.warn('Error sincronizando con Supabase:', error.message);
    return { ok: false, reason: error.message };
  }
  return { ok: true };
}

/**
 * Descarga el snapshot desde Supabase y actualiza el almacenamiento local
 */
export async function pullFromSupabase() {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, reason: 'not_configured' };

  const { data: sessionData } = await client.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return { ok: false, reason: 'not_authenticated' };

  const { data, error } = await client
    .from('user_snapshots')
    .select('payload, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return { ok: false, reason: error.message };
  if (data && data.payload) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.payload));
    window.dispatchEvent(new CustomEvent('darkness:data-updated'));
    return { ok: true, updatedAt: data.updated_at };
  }
  return { ok: false, reason: 'empty' };
}

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
