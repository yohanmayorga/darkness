/**
 * Lógica pura de hábitos: programación por días, vigencia (desde / hasta),
 * cumplimiento diario, rachas y generador de consejos.
 * Sin dependencias para poder usarse desde db.js, dashboard y el módulo de hábitos.
 */

const pad = n => String(n).padStart(2, '0');

export const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseISO(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export const weekdayOf = iso => parseISO(iso).getDay();
export const isValidISO = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

/* Índices según Date.getDay(): 0 = domingo … 6 = sábado */
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const WORK_DAYS = [1, 2, 3, 4, 5];
export const WEEKEND_DAYS = [0, 6];
/** Orden visual de la semana empezando en lunes */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAY_LETTER = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const DAY_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

export const TIME_OF_DAY = {
  morning: 'Mañana',
  anytime: 'Durante el día',
  night: 'Noche'
};
export const TIME_ORDER = ['morning', 'anytime', 'night'];

export const HABIT_CATEGORIES = ['Salud', 'Cuerpo', 'Mente', 'Cuidado personal', 'Descanso', 'Disciplina', 'Finanzas'];

export const HABIT_ICONS = [
  { id: 'habits', label: 'Check' },
  { id: 'sparkles', label: 'Cuidado personal' },
  { id: 'moon', label: 'Descanso / Noche' },
  { id: 'sun', label: 'Mañana / Sol' },
  { id: 'droplet', label: 'Agua / Hidratación' },
  { id: 'coffee', label: 'Café / Mañana' },
  { id: 'utensils', label: 'Alimentación' },
  { id: 'apple', label: 'Nutrición' },
  { id: 'dumbbell', label: 'Gimnasio' },
  { id: 'footprints', label: 'Caminar / Pasos' },
  { id: 'bike', label: 'Ciclismo / Cardio' },
  { id: 'bed', label: 'Dormir' },
  { id: 'reading', label: 'Lectura' },
  { id: 'pen', label: 'Escribir / Diario' },
  { id: 'brain', label: 'Mente / Enfoque' },
  { id: 'ban', label: 'Evitar / Abstinencia' },
  { id: 'flame', label: 'Racha / Fuego' },
  { id: 'body', label: 'Salud / Pulso' },
  { id: 'heart', label: 'Bienestar' },
  { id: 'pill', label: 'Suplementos' },
  { id: 'zap', label: 'Energía' },
  { id: 'target', label: 'Meta' },
  { id: 'clock', label: 'Tiempo' },
  { id: 'alarm', label: 'Despertar / Alarma' },
  { id: 'music', label: 'Música' },
  { id: 'headphones', label: 'Audio / Podcast' },
  { id: 'code', label: 'Programar' },
  { id: 'laptop', label: 'Estudio / Trabajo' },
  { id: 'briefcase', label: 'Trabajo' },
  { id: 'dollar', label: 'Finanzas / Ahorro' },
  { id: 'smile', label: 'Ánimo' },
  { id: 'eye', label: 'Atención / Descanso visual' },
  { id: 'shield', label: 'Disciplina' },
  { id: 'star', label: 'Destacado' },
  { id: 'award', label: 'Logro' },
  { id: 'compass', label: 'Dirección' },
  { id: 'leaf', label: 'Naturaleza / Aire libre' }
];

const DEFAULT_ICON_BY_ID = {
  'hab-skin-am': 'sparkles',
  'hab-sleep': 'moon',
  'hab-water': 'droplet',
  'hab-read': 'reading',
  'hab-no-sugar': 'ban',
  'hab-no-alcohol': 'ban',
  'hab-gym': 'dumbbell',
  'hab-skin-pm': 'sparkles'
};

/** Hábitos predeterminados de Darkness */
export function createDefaultHabits(startDate) {
  const createdAt = new Date().toISOString();
  const make = (id, name, category, timeOfDay, days = ALL_DAYS, target = '') => ({
    id, name, category, timeOfDay, target,
    icon: DEFAULT_ICON_BY_ID[id] || 'habits',
    days: [...days],
    startDate,
    endDate: '',
    logs: {},
    createdAt
  });
  return [
    make('hab-skin-am', 'Skin Care (diurno)', 'Cuidado personal', 'morning'),
    make('hab-sleep', 'Dormir +7h', 'Descanso', 'morning', ALL_DAYS, 'Más de 7 horas de sueño'),
    make('hab-water', 'Agua', 'Salud', 'anytime', ALL_DAYS, '3 L al día'),
    make('hab-read', 'Leer', 'Mente', 'anytime'),
    make('hab-no-sugar', 'No azúcar', 'Salud', 'anytime'),
    make('hab-no-alcohol', 'No alcohol', 'Salud', 'anytime'),
    make('hab-gym', 'Gimnasio', 'Cuerpo', 'anytime', WORK_DAYS, 'Lunes a viernes'),
    make('hab-skin-pm', 'Skin Care (nocturno)', 'Cuidado personal', 'night')
  ];
}

/** Completa campos faltantes (hábitos antiguos o importados). Muta y devuelve el hábito. */
export function normalizeHabit(h, fallbackStart) {
  if (!h.logs || typeof h.logs !== 'object') h.logs = {};
  if (!Array.isArray(h.days) || h.days.length === 0) h.days = [...ALL_DAYS];
  h.days = [...new Set(h.days.map(Number).filter(d => d >= 0 && d <= 6))].sort();
  if (!isValidISO(h.startDate)) {
    const logDates = Object.keys(h.logs).filter(isValidISO).sort();
    h.startDate = logDates[0] || fallbackStart || toISO(new Date());
  }
  if (!isValidISO(h.endDate)) h.endDate = '';
  if (!TIME_OF_DAY[h.timeOfDay]) h.timeOfDay = 'anytime';
  if (typeof h.target !== 'string') h.target = '';
  if (!h.category) h.category = 'Salud';
  if (!h.icon) h.icon = DEFAULT_ICON_BY_ID[h.id] || 'habits';
  return h;
}

/* ==========================================================================
   Programación y cumplimiento
   ========================================================================== */
export function isScheduled(h, iso) {
  if (iso < h.startDate) return false;
  if (h.endDate && iso > h.endDate) return false;
  return h.days.includes(weekdayOf(iso));
}

export const isDone = (h, iso) => Boolean(h.logs && h.logs[iso]);

/** Motivo por el que un hábito no cuenta en una fecha */
export function offReason(h, iso) {
  if (iso < h.startDate) return `Comienza el ${formatShort(h.startDate)}`;
  if (h.endDate && iso > h.endDate) return `Finalizó el ${formatShort(h.endDate)}`;
  return `No cuenta los ${DAY_PLURAL[weekdayOf(iso)]} · ${scheduleLabel(h.days)}`;
}

/** Cumplimiento de un día: sólo cuentan los hábitos programados para esa fecha */
export function dayStats(habits, iso) {
  const scheduled = habits.filter(h => isScheduled(h, iso));
  const done = scheduled.filter(h => isDone(h, iso)).length;
  const total = scheduled.length;
  return { iso, done, total, pct: total ? done / total : null };
}

export function rangeSeries(habits, from, to) {
  const out = [];
  for (let iso = from; iso <= to; iso = addDays(iso, 1)) out.push(dayStats(habits, iso));
  return out;
}

/** Cumplimiento agregado de varios días (ponderado por número de hábitos) */
export function aggregate(series) {
  const done = series.reduce((a, d) => a + d.done, 0);
  const total = series.reduce((a, d) => a + d.total, 0);
  return { done, total, rate: total ? done / total : null };
}

/** Cumplimiento de un hábito en un rango */
export function habitRate(h, from, to) {
  let done = 0;
  let total = 0;
  const start = from < h.startDate ? h.startDate : from;
  for (let iso = start; iso <= to; iso = addDays(iso, 1)) {
    if (!isScheduled(h, iso)) continue;
    total++;
    if (isDone(h, iso)) done++;
  }
  return { done, total, rate: total ? done / total : null };
}

/**
 * Racha actual: días programados consecutivos cumplidos.
 * Los días no programados no rompen la racha y "hoy" pendiente tampoco.
 */
export function habitStreak(h, today) {
  let iso = today;
  if (isScheduled(h, iso) && !isDone(h, iso)) iso = addDays(iso, -1);
  let streak = 0;
  for (let i = 0; i < 2000 && iso >= h.startDate; i++) {
    if (isScheduled(h, iso)) {
      if (!isDone(h, iso)) break;
      streak++;
    }
    iso = addDays(iso, -1);
  }
  return streak;
}

export function bestStreak(h, today) {
  let best = 0;
  let run = 0;
  const end = h.endDate && h.endDate < today ? h.endDate : today;
  for (let iso = h.startDate; iso <= end; iso = addDays(iso, 1)) {
    if (!isScheduled(h, iso)) continue;
    if (isDone(h, iso)) best = Math.max(best, ++run);
    else if (iso !== today) run = 0;
  }
  return best;
}

/* ==========================================================================
   Formato
   ========================================================================== */
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatShort(iso) {
  const d = parseISO(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

export function formatLong(iso) {
  const s = parseISO(iso).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function scheduleLabel(days) {
  const set = [...new Set(days)].sort().join(',');
  if (set === ALL_DAYS.join(',')) return 'Todos los días';
  if (set === WORK_DAYS.join(',')) return 'Lunes a viernes';
  if (set === WEEKEND_DAYS.join(',')) return 'Fines de semana';
  return WEEK_ORDER.filter(d => days.includes(d)).map(d => DAY_SHORT[d]).join(' · ');
}

export const pctText = rate => (rate === null || rate === undefined) ? '—' : `${Math.round(rate * 100)}%`;

/* ==========================================================================
   Consejos personalizados (basados en el historial real)
   ========================================================================== */
export function generateAdvice(habits, today) {
  const wd = weekdayOf(today);
  const todays = habits.filter(h => isScheduled(h, today));
  const pending = todays
    .filter(h => !isDone(h, today))
    .sort((a, b) => TIME_ORDER.indexOf(a.timeOfDay) - TIME_ORDER.indexOf(b.timeOfDay));
  const yesterday = addDays(today, -1);
  const tips = [];
  const used = new Set();
  const strong = name => `<strong>${String(name).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))}</strong>`;

  if (!todays.length) {
    return [`Hoy no tienes hábitos programados. Aprovecha para descansar y planificar la semana.`];
  }

  // 1. Debilidad recurrente en este día de la semana
  let weak = null;
  pending.forEach(h => {
    let n = 0;
    let done = 0;
    for (let k = 1; k <= 12; k++) {
      const iso = addDays(today, -7 * k);
      if (iso < h.startDate) break;
      if (!isScheduled(h, iso)) continue;
      n++;
      if (isDone(h, iso)) done++;
    }
    if (n < 3) return;
    const rateW = done / n;
    const overall = habitRate(h, addDays(today, -84), yesterday);
    if (overall.total < 6 || rateW > 0.5 || rateW > overall.rate - 0.15) return;
    const gap = overall.rate - rateW;
    if (!weak || gap > weak.gap) weak = { h, rateW, overall: overall.rate, gap };
  });
  if (weak) {
    tips.push(`Los ${DAY_PLURAL[wd]} tiendes a fallar en ${strong(weak.h.name)}: sólo ${pctText(weak.rateW)} de cumplimiento frente a ${pctText(weak.overall)} el resto de la semana. Cambia eso hoy.`);
    used.add(weak.h.id);
  }

  // 2. Racha en riesgo
  const atRisk = pending
    .filter(h => !used.has(h.id))
    .map(h => ({ h, s: habitStreak(h, today) }))
    .filter(x => x.s >= 3)
    .sort((a, b) => b.s - a.s)[0];
  if (atRisk && tips.length < 2) {
    tips.push(`Llevas ${atRisk.s} días seguidos con ${strong(atRisk.h.name)}. No rompas la racha hoy.`);
    used.add(atRisk.h.id);
  }

  // 3. Prioridad: el pendiente con peor cumplimiento reciente
  const lowest = pending
    .filter(h => !used.has(h.id))
    .map(h => ({ h, r: habitRate(h, addDays(today, -14), yesterday) }))
    .filter(x => x.r.total >= 3 && x.r.rate < 0.7)
    .sort((a, b) => a.r.rate - b.r.rate)[0];
  if (lowest && tips.length < 2) {
    tips.push(`Dale prioridad a ${strong(lowest.h.name)}: lo cumpliste ${lowest.r.done} de ${lowest.r.total} veces en las últimas dos semanas.`);
    used.add(lowest.h.id);
  }

  // 4. Tendencia semanal
  if (tips.length < 2) {
    const last7 = aggregate(rangeSeries(habits, addDays(today, -7), yesterday));
    const prev7 = aggregate(rangeSeries(habits, addDays(today, -14), addDays(today, -8)));
    if (last7.rate !== null && prev7.rate !== null && prev7.total >= 7) {
      const diff = Math.round((last7.rate - prev7.rate) * 100);
      if (diff >= 10) tips.push(`Tu cumplimiento subió ${diff} puntos respecto a la semana anterior. Mantén el sistema, está funcionando.`);
      else if (diff <= -10) tips.push(`Tu cumplimiento bajó ${Math.abs(diff)} puntos respecto a la semana anterior. Vuelve a lo básico: un hábito a la vez.`);
    }
  }

  // 5. Mensajes por defecto
  if (!tips.length) {
    if (!pending.length) {
      tips.push(`Día completo: ${todays.length} de ${todays.length} hábitos cumplidos. Así se construye la disciplina.`);
    } else {
      const names = pending.slice(0, 3).map(h => strong(h.name)).join(', ');
      const more = pending.length > 3 ? ` y ${pending.length - 3} más` : '';
      tips.push(`Te ${pending.length === 1 ? 'falta' : 'faltan'} ${pending.length} para cerrar el día: ${names}${more}. Empieza por ${strong(pending[0].name)}.`);
    }
  }

  return tips.slice(0, 2);
}
