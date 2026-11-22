import { getStore, saveStore, generateId, todayISO } from '../services/db.js?v=6.9.0';
import { icon } from '../components/icons.js?v=3.3.0';
import { openModal, closeModal } from '../components/modal.js?v=1.4.0';
import { showToast } from '../components/toast.js?v=1.4.0';
import { formatDateDMY } from '../utils/text.js?v=4.3.0';
import { hudFrameOrnaments } from '../components/hudFrame.js?v=1.0.0';

const BODY_METRICS_META = [
  { key: 'weightKg', label: 'Peso', unit: 'kg', step: '0.1', placeholder: '74.5' },
  { key: 'bmi', label: 'IMC', unit: '', step: '0.1', placeholder: '24.3' },
  { key: 'bodyFatPct', label: 'Grasa corporal', unit: '%', step: '0.1', placeholder: '15.2' },
  { key: 'fatFreeWeightKg', label: 'Peso libre de grasa', unit: 'kg', step: '0.1', placeholder: '63.2' },
  { key: 'subcutaneousFatPct', label: 'Grasa subcutánea', unit: '%', step: '0.1', placeholder: '12.9' },
  { key: 'visceralFat', label: 'Grasa visceral', unit: '', step: '1', placeholder: '5' },
  { key: 'bodyWaterPct', label: 'Agua corporal', unit: '%', step: '0.1', placeholder: '61.6' },
  { key: 'skeletalMusclesPct', label: 'Músculo esquelético', unit: '%', step: '0.1', placeholder: '48.3' },
  { key: 'muscleMassKg', label: 'Masa muscular', unit: 'kg', step: '0.1', placeholder: '60.1' },
  { key: 'boneMassKg', label: 'Masa ósea', unit: 'kg', step: '0.1', placeholder: '3.1' },
  { key: 'proteinPct', label: 'Proteína', unit: '%', step: '0.1', placeholder: '19.6' },
  { key: 'bmr', label: 'TMB', unit: 'kcal', step: '1', placeholder: '1732' },
  { key: 'metabolicAge', label: 'Edad metabólica', unit: 'años', step: '1', placeholder: '26' },
  { key: 'waistCm', label: 'Cintura', unit: 'cm', step: '0.1', placeholder: '79.5' },
  { key: 'bicepsCm', label: 'Bíceps', unit: 'cm', step: '0.1', placeholder: '37.0' },
  { key: 'thighCm', label: 'Muslo', unit: 'cm', step: '0.1', placeholder: '56.5' }
];

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CAL_WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

let selectedChartMetric = 'weightKg';
let selectedChartYear = 'all';
let selectedChartMonth = 'all';
let chartZoom = 1;
let selectedBodyDate = todayISO();
let calYear = null;
let calMonth = null;

function ensureCalendarCursor(today) {
  if (calYear === null || calMonth === null) {
    const [y, m] = today.split('-').map(Number);
    calYear = y;
    calMonth = m - 1;
  }
}

function currentTimeHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getMetricValue(record, key) {
  if (!record) return null;
  if (key === 'bicepsCm') {
    const v = record.bicepsCm ?? record.armCm;
    return v === undefined || v === null || v === '' ? null : Number(v);
  }
  const v = record[key];
  return v === undefined || v === null || v === '' ? null : Number(v);
}

function formatVal(val, unit = '') {
  if (val === null || val === undefined || Number.isNaN(val)) return '--';
  return unit ? `${val}${unit === '%' ? '%' : ` ${unit}`}` : String(val);
}

function getChronologicalAge(birthDateStr) {
  if (!birthDateStr) return null;
  const [y, m, d] = birthDateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) {
    age--;
  }
  return age;
}

/**
 * Genera el resumen concatenado de situación actual + alertas biométricas detectadas
 */
function buildBodySummaryAndAlerts(sorted, profile, today) {
  if (!sorted.length) {
    return {
      summaryHTML: `<p class="body-summary-text">Aún no hay mediciones biométricas registradas. Selecciona una fecha en el calendario o pulsa <strong>Registrar Medición</strong> para comenzar.</p>`,
      alerts: [{ level: 'warn', tag: 'SIN DATOS', text: 'Registra tu primera medición para activar el análisis.' }]
    };
  }

  const latest = sorted[0];
  const prev = sorted[1] || null;
  const targetW = Number(profile?.targetWeightKg || 0);
  const weight = getMetricValue(latest, 'weightKg');
  const prevWeight = prev ? getMetricValue(prev, 'weightKg') : null;

  const parts = [];
  parts.push(`Último registro el <span class="mono text-primary">${formatDateDMY(latest.date)}</span>${latest.time ? ` (${latest.time})` : ''}:`);

  if (weight !== null) {
    let wText = `peso actual de <span class="mono text-primary">${weight} kg</span>`;
    if (prevWeight !== null) {
      const diff = Number((weight - prevWeight).toFixed(1));
      wText += ` (${diff > 0 ? '+' : ''}${diff} kg vs anterior)`;
    }
    if (targetW > 0) {
      const toGoal = Number((weight - targetW).toFixed(1));
      if (Math.abs(toGoal) < 0.1) wText += `, en tu meta de ${targetW} kg`;
      else if (toGoal > 0) wText += `, a ${toGoal} kg de tu meta (${targetW} kg)`;
      else wText += `, ${Math.abs(toGoal)} kg por debajo de tu meta (${targetW} kg)`;
    }
    parts.push(wText + '.');
  }

  const details = [];
  const bmi = getMetricValue(latest, 'bmi');
  const fat = getMetricValue(latest, 'bodyFatPct');
  const visceral = getMetricValue(latest, 'visceralFat');
  const muscle = getMetricValue(latest, 'muscleMassKg');
  const water = getMetricValue(latest, 'bodyWaterPct');
  const bmr = getMetricValue(latest, 'bmr');
  const waist = getMetricValue(latest, 'waistCm');
  const metAge = getMetricValue(latest, 'metabolicAge');

  if (bmi !== null) details.push(`IMC ${bmi}`);
  if (fat !== null) details.push(`grasa ${fat}%`);
  if (visceral !== null) details.push(`visceral ${visceral}`);
  if (muscle !== null) details.push(`músculo ${muscle} kg`);
  if (water !== null) details.push(`agua ${water}%`);
  if (bmr !== null) details.push(`TMB ${bmr} kcal`);
  if (metAge !== null) details.push(`edad metabólica ${metAge} años`);
  if (waist !== null && waist > 0) details.push(`cintura ${waist} cm`);

  if (details.length) {
    parts.push(`Presentas ${details.join(', ')}.`);
  }

  const summaryHTML = `<p class="body-summary-text">${parts.join(' ')}</p>`;

  // Detección de alertas
  const alerts = [];
  if (visceral !== null) {
    if (visceral >= 13) alerts.push({ level: 'danger', tag: 'VISCERAL ALTA', text: `Grasa visceral en ${visceral} (nivel alto, recomendado < 10).` });
    else if (visceral >= 10) alerts.push({ level: 'warn', tag: 'VISCERAL', text: `Grasa visceral en ${visceral} (límite moderado, ideal < 10).` });
  }
  if (bmi !== null) {
    if (bmi < 18.5) alerts.push({ level: 'warn', tag: 'IMC BAJO', text: `IMC de ${bmi} por debajo del rango estándar (18.5–24.9).` });
    else if (bmi >= 30) alerts.push({ level: 'danger', tag: 'IMC ALTO', text: `IMC de ${bmi} en rango elevado (>= 30).` });
    else if (bmi >= 25) alerts.push({ level: 'warn', tag: 'IMC', text: `IMC de ${bmi} ligeramente sobre 24.9.` });
  }
  if (water !== null && water < 50) {
    alerts.push({ level: 'warn', tag: 'HIDRATACIÓN', text: `Agua corporal baja (${water}%, recomendado >= 50%).` });
  }
  const realAge = getChronologicalAge(profile?.mementoMori?.birthDate);
  if (metAge !== null && realAge !== null && metAge > realAge + 2) {
    alerts.push({ level: 'warn', tag: 'EDAD MET.', text: `Edad metabólica (${metAge}) superior a tu edad actual (${realAge}).` });
  }
  if (weight !== null && prevWeight !== null && Math.abs(weight - prevWeight) >= 1.5) {
    const diff = Number((weight - prevWeight).toFixed(1));
    alerts.push({ level: 'warn', tag: 'VARIACIÓN', text: `Cambio rápido de peso (${diff > 0 ? '+' : ''}${diff} kg) respecto al último registro.` });
  }
  if (latest.date) {
    const daysSince = Math.round((new Date(today) - new Date(latest.date)) / 86400000);
    if (daysSince > 7) {
      alerts.push({ level: 'warn', tag: 'FRECUENCIA', text: `Llevas ${daysSince} días sin registrar mediciones nuevas.` });
    }
  }

  if (alerts.length === 0) {
    alerts.push({ level: 'ok', tag: 'ESTABLE', text: 'Sin alertas biométricas detectadas. Parámetros dentro de rango.' });
  }

  return { summaryHTML, alerts };
}

/**
 * Calendario mensual con el mismo diseño (.hcal-*) que Hábitos
 */
function buildBodyCalendar(records, today) {
  ensureCalendarCursor(today);
  const y = calYear;
  const m = calMonth;

  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const pad = n => String(n).padStart(2, '0');

  const byDate = new Map();
  records.forEach(r => {
    if (!r.date) return;
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  });

  let cells = CAL_WEEKDAYS.map(w => `<span class="hcal-weekday">${w}</span>`).join('');
  for (let i = 0; i < offset; i++) cells += '<span class="hcal-day empty"></span>';

  let monthRecordsCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
    const dayItems = byDate.get(iso) || [];
    if (dayItems.length) monthRecordsCount++;

    const cls = ['hcal-day'];
    let title = iso;
    if (iso > today) {
      cls.push('is-future');
    } else if (dayItems.length > 0) {
      cls.push('lvl-4');
      title += ` · ${dayItems[0].weightKg ?? '--'} kg`;
    }
    if (iso === today) cls.push('is-today');
    if (iso === selectedBodyDate) cls.push('is-selected');

    cells += `<button type="button" class="${cls.join(' ')}" data-cal-day="${iso}" title="${title}" ${iso > today ? 'disabled' : ''}>${d}</button>`;
  }

  const [ty, tm] = today.split('-').map(Number);
  const isCurrentMonth = y === ty && m === tm - 1;
  const selectedDayItems = byDate.get(selectedBodyDate) || [];

  return `
    <div class="hcal-header">
      <span class="hcal-title">${MONTHS[m]} <span class="text-muted">${y}</span></span>
      <div class="hcal-nav">
        <button type="button" class="btn-icon" data-cal="prev" aria-label="Mes anterior">${icon('chevronLeft')}</button>
        <button type="button" class="btn-icon hcal-today-btn" data-cal="today" title="Ir a hoy">Hoy</button>
        <button type="button" class="btn-icon" data-cal="next" aria-label="Mes siguiente" ${isCurrentMonth ? 'disabled' : ''}>${icon('chevronRight')}</button>
      </div>
    </div>
    <div class="hcal-grid">${cells}</div>
    <div class="hcal-footer">
      <span>Días con registro: <span class="mono">${monthRecordsCount}</span></span>
      <span class="hcal-scale" aria-hidden="true">
        <i class="lvl-4"></i> con datos
      </span>
    </div>
    <div class="body-cal-day-action">
      <div>
        <div class="mono" style="font-weight:600;">${formatDateDMY(selectedBodyDate)}</div>
        <div class="text-muted">${selectedDayItems.length ? `${selectedDayItems.length} registro(s) · ${selectedDayItems[0].weightKg ?? '--'} kg` : 'Sin registro este día'}</div>
      </div>
      <button type="button" class="btn btn-primary btn-sm" id="btn-body-load-date">
        ${icon('plus')} Cargar
      </button>
    </div>
  `;
}

/**
 * Genera una gráfica SVG monocromática sin distorsión de texto/puntos
 */
function buildBodyChartSVG(records, metricKey) {
  const meta = BODY_METRICS_META.find(m => m.key === metricKey) || BODY_METRICS_META[0];
  const chronological = [...records]
    .sort((a, b) => `${a.date} ${a.time || '00:00'}`.localeCompare(`${b.date} ${b.time || '00:00'}`))
    .filter(r => {
      if (getMetricValue(r, meta.key) === null) return false;
      if (selectedChartYear !== 'all' && !String(r.date || '').startsWith(`${selectedChartYear}-`)) return false;
      if (selectedChartMonth !== 'all' && String(r.date || '').slice(5, 7) !== selectedChartMonth) return false;
      return true;
    });

  if (chronological.length === 0) {
    return `<div class="empty-state">No hay registros de ${meta.label.toLowerCase()} para el período seleccionado.</div>`;
  }

  const padX = 6;
  const padTop = 18;
  const padBot = 16;

  const values = chronological.map(r => getMetricValue(r, meta.key));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = Math.max(0.5, rawMax - rawMin);
  const margin = spread * 0.22;
  const minV = rawMin - margin;
  const maxV = rawMax + margin;
  const range = Math.max(0.1, maxV - minV);

  const points = chronological.map((r, idx) => {
    const val = getMetricValue(r, meta.key);
    const x = chronological.length === 1
      ? 50
      : padX + (idx / (chronological.length - 1)) * (100 - padX * 2);
    const y = (100 - padBot) - ((val - minV) / range) * (100 - padTop - padBot);
    return { x, y, date: formatDateDMY(r.date), fullDate: formatDateDMY(r.date), val };
  });

  const polyline = points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const baseLine = 100 - padBot;
  const areaPoints = `${points[0].x.toFixed(2)},${baseLine} ${polyline} ${points[points.length - 1].x.toFixed(2)},${baseLine}`;

  const totalPts = points.length;
  const maxLabels = Math.max(5, Math.round(6 * chartZoom));
  const dense = totalPts > maxLabels + 4;
  const step = Math.max(1, Math.ceil((totalPts - 1) / maxLabels));
  const minIdx = values.indexOf(rawMin);
  const maxIdx = values.indexOf(rawMax);
  const labelIndices = new Set([0, totalPts - 1, minIdx, maxIdx]);
  if (!dense) {
    points.forEach((_, idx) => labelIndices.add(idx));
  } else {
    for (let i = 0; i < totalPts; i += step) labelIndices.add(i);
  }

  // Evitar que dos etiquetas queden demasiado pegadas en modo denso
  const minGapPct = 11 / chartZoom;
  const shownIndices = [...labelIndices].sort((a, b) => a - b).filter((idx, pos, arr) => {
    if (!dense || pos === 0 || idx === totalPts - 1) return true;
    const prevX = points[arr[pos - 1]].x;
    const currX = points[idx].x;
    const lastX = points[totalPts - 1].x;
    if (currX - prevX < minGapPct) return false;
    if (idx !== totalPts - 1 && lastX - currX < minGapPct * 0.85) return false;
    return true;
  });

  return `
    <div class="mono text-muted" style="display:flex;flex-wrap:wrap;gap:12px;font-size:0.7rem;margin-bottom:6px;">
      <span>Registros: <strong class="text-primary">${totalPts}</strong></span>
      <span>Mín: <strong class="text-primary">${formatVal(rawMin, meta.unit)}</strong></span>
      <span>Máx: <strong class="text-primary">${formatVal(rawMax, meta.unit)}</strong></span>
      <span>Actual: <strong class="text-primary">${formatVal(values[values.length - 1], meta.unit)}</strong></span>
      ${chartZoom > 1 ? `<span>Zoom: <strong class="text-primary">${chartZoom}x</strong></span>` : ''}
    </div>
    <div class="chart-scroll-wrap">
      <div class="chart-box" style="width:${chartZoom * 100}%;min-width:100%;">
        <svg class="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="${padX}" y1="${padTop}" x2="${100 - padX}" y2="${padTop}" stroke="var(--chart-grid)" stroke-width="1" vector-effect="non-scaling-stroke"/>
          <line x1="${padX}" y1="${(padTop + baseLine) / 2}" x2="${100 - padX}" y2="${(padTop + baseLine) / 2}" stroke="var(--chart-grid)" stroke-width="1" vector-effect="non-scaling-stroke"/>
          <line x1="${padX}" y1="${baseLine}" x2="${100 - padX}" y2="${baseLine}" stroke="var(--chart-grid)" stroke-width="1" vector-effect="non-scaling-stroke"/>
          <polygon points="${areaPoints}" fill="var(--chart-fill)" />
          <polyline fill="none" stroke="var(--chart-line)" stroke-width="2" vector-effect="non-scaling-stroke" points="${polyline}" />
        </svg>
        <div class="chart-overlay">
          ${shownIndices.map(idx => {
            const p = points[idx];
            return `
              <span class="chart-point-dot" style="left:${p.x.toFixed(2)}%;top:${p.y.toFixed(2)}%;" title="${p.fullDate}: ${formatVal(p.val, meta.unit)}"></span>
              <span class="chart-point-val" style="left:${p.x.toFixed(2)}%;top:${p.y.toFixed(2)}%;">${formatVal(p.val, meta.unit)}</span>
              <span class="chart-point-date" style="left:${p.x.toFixed(2)}%;">${p.date}</span>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function openBodyModal(container, latest, prefillDate = todayISO()) {
  openModal({
    title: 'Registrar Medición Corporal',
    contentHTML: `
      <form id="form-body">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Fecha</label>
            <input type="date" name="date" class="form-input" value="${prefillDate}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Hora</label>
            <input type="time" name="time" class="form-input" value="${currentTimeHHMM()}" required />
          </div>
          ${BODY_METRICS_META.map(m => {
            const prevVal = getMetricValue(latest, m.key);
            return `
              <div class="form-group">
                <label class="form-label">${m.label}${m.unit ? ` (${m.unit})` : ''}</label>
                <input type="number" step="${m.step}" name="${m.key}" class="form-input" placeholder="${m.placeholder}" value="${prevVal ?? ''}" ${m.key === 'weightKg' ? 'required' : ''} />
              </div>
            `;
          }).join('')}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="cancel-body">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Medición</button>
        </div>
      </form>
    `,
    onMount: (modal) => {
      modal.querySelector('#cancel-body').addEventListener('click', closeModal);
      modal.querySelector('#form-body').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const entry = {
          id: generateId('bm'),
          date: String(fd.get('date') || prefillDate),
          time: String(fd.get('time') || currentTimeHHMM())
        };
        BODY_METRICS_META.forEach(m => {
          const raw = fd.get(m.key);
          entry[m.key] = raw === '' || raw === null ? null : Number(raw);
        });

        const current = getStore();
        current.bodyMetrics.push(entry);
        saveStore(current);
        selectedBodyDate = entry.date;
        closeModal();
        showToast('Medición corporal guardada');
        renderBody(container);
      });
    }
  });
}

function goalTrendClass(curr, prev, target, tolerance = 0.5) {
  const c = getMetricValue({ v: curr }, 'v');
  const t = getMetricValue({ v: target }, 'v');
  if (c === null || t === null || t <= 0) return '';
  const distCurr = Math.abs(c - t);
  if (distCurr <= tolerance) return 'kpi-lvl-high';
  const p = prev !== null && prev !== undefined ? getMetricValue({ v: prev }, 'v') : null;
  if (p !== null) {
    const distPrev = Math.abs(p - t);
    if (distCurr < distPrev) return 'kpi-lvl-high';
    if (distCurr > distPrev) return 'kpi-lvl-low';
  }
  return distCurr <= tolerance * 3 ? '' : 'kpi-lvl-low';
}

export function renderBody(container) {
  const store = getStore();
  const today = todayISO();
  const sorted = [...store.bodyMetrics].sort((a, b) =>
    `${b.date} ${b.time || '00:00'}`.localeCompare(`${a.date} ${a.time || '00:00'}`)
  );
  const latest = sorted[0] || {};
  const previous = sorted[1] || latest;

  const weightDelta = latest.weightKg && previous.weightKg
    ? (latest.weightKg - previous.weightKg).toFixed(1)
    : '0.0';

  const activeMeta = BODY_METRICS_META.find(m => m.key === selectedChartMetric) || BODY_METRICS_META[0];
  const latestBiceps = latest.bicepsCm ?? latest.armCm;
  const { summaryHTML, alerts } = buildBodySummaryAndAlerts(sorted, store.profile, today);

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <span class="page-eyebrow">BIOMETRÍA & ANTROPOMETRÍA</span>
        <h1 class="page-title">Cuerpo y Peso</h1>
        <p class="page-subtitle">Control biométrico de composición corporal y perímetros.</p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" id="btn-add-body">
          ${icon('plus')} Registrar Medición
        </button>
      </div>
    </header>

    <section class="grid-kpi">
      <div class="kpi-card ${goalTrendClass(latest.weightKg, previous.weightKg, store.profile.targetWeightKg, 0.5)}">
        <div class="kpi-top"><span>Peso Actual</span>${icon('body')}</div>
        <div class="kpi-value">${latest.weightKg ?? '--'} <small style="font-size:0.9rem;">kg</small></div>
        <div class="kpi-meta">Cambio: <span class="mono">${weightDelta > 0 ? '+' + weightDelta : weightDelta} kg</span> · Meta: <span class="mono">${store.profile.targetWeightKg || '--'} kg</span></div>
      </div>

      <div class="kpi-card ${goalTrendClass(latest.bodyFatPct, previous.bodyFatPct, store.profile.targetBodyFatPct ?? 15, 0.5)}">
        <div class="kpi-top"><span>Grasa Corporal / IMC</span>${icon('body')}</div>
        <div class="kpi-value">${latest.bodyFatPct ?? '--'}% <small style="font-size:0.85rem;">/ ${latest.bmi ?? '--'}</small></div>
        <div class="kpi-meta">Visceral: <span class="mono">${latest.visceralFat ?? '--'}</span> · Meta grasa: <span class="mono">${store.profile.targetBodyFatPct ?? 15}%</span></div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top"><span>Masa Muscular / TMB</span>${icon('body')}</div>
        <div class="kpi-value">${latest.muscleMassKg ?? '--'} <small style="font-size:0.85rem;">kg</small></div>
        <div class="kpi-meta">TMB: <span class="mono">${latest.bmr ?? '--'} kcal</span> · Edad met.: <span class="mono">${latest.metabolicAge ?? '--'}</span></div>
      </div>

      <div class="kpi-card ${goalTrendClass(latest.waistCm > 0 ? latest.waistCm : null, previous.waistCm > 0 ? previous.waistCm : null, store.profile.targetWaistCm ?? 80, 1)}">
        <div class="kpi-top"><span>Perímetros (cm)</span>${icon('body')}</div>
        <div class="kpi-value">${latest.waistCm ?? '--'} <small style="font-size:0.85rem;">cintura</small></div>
        <div class="kpi-meta">Bíceps: <span class="mono">${latestBiceps ?? '--'}</span> · Muslo: <span class="mono">${latest.thighCm ?? '--'}</span> · Meta: <span class="mono">${store.profile.targetWaistCm ?? 80} cm</span></div>
      </div>
    </section>

    <section class="card cyber-frame-wrap" style="margin-bottom: 24px;">
      ${hudFrameOrnaments()}
      <div class="card-header" style="flex-wrap:wrap;gap:8px;">
        <h2 class="card-title" id="body-chart-title">${icon('body')} Evolución: ${activeMeta.label}${activeMeta.unit ? ` (${activeMeta.unit})` : ''}</h2>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <select id="body-chart-year" class="form-select" style="width:auto;min-height:32px;padding:4px 8px;font-size:0.76rem;" aria-label="Filtrar por año">
            <option value="all" ${selectedChartYear === 'all' ? 'selected' : ''}>Todos los años</option>
            ${[...new Set((store.bodyMetrics || []).map(r => String(r.date || '').slice(0, 4)).filter(Boolean))].sort().reverse().map(y => `
              <option value="${y}" ${selectedChartYear === y ? 'selected' : ''}>${y}</option>
            `).join('')}
          </select>
          <select id="body-chart-month" class="form-select" style="width:auto;min-height:32px;padding:4px 8px;font-size:0.76rem;" aria-label="Filtrar por mes">
            <option value="all" ${selectedChartMonth === 'all' ? 'selected' : ''}>Todos los meses</option>
            ${MONTHS.map((mName, idx) => {
              const mm = String(idx + 1).padStart(2, '0');
              return `<option value="${mm}" ${selectedChartMonth === mm ? 'selected' : ''}>${mName}</option>`;
            }).join('')}
          </select>
          <div style="display:inline-flex;align-items:center;gap:2px;" role="group" aria-label="Zoom del gráfico">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-chart-zoom-out" title="Alejar zoom">−</button>
            <button type="button" class="btn btn-secondary btn-sm mono" id="btn-chart-zoom-reset" title="Restablecer zoom">${chartZoom}x</button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-chart-zoom-in" title="Acercar zoom">+</button>
          </div>
          <select id="body-chart-metric" class="form-select" style="width:auto;min-width:170px;min-height:32px;padding:4px 10px;font-size:0.76rem;" aria-label="Seleccionar métrica del gráfico">
            ${BODY_METRICS_META.map(m => `
              <option value="${m.key}" ${m.key === selectedChartMetric ? 'selected' : ''}>${m.label}${m.unit ? ` (${m.unit})` : ''}</option>
            `).join('')}
          </select>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-chart-reset-filters" title="Restablecer peso, fechas y zoom">Borrar filtros</button>
        </div>
      </div>
      <div id="body-chart-container">
        ${buildBodyChartSVG(store.bodyMetrics, selectedChartMetric)}
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <h2 class="card-title">Historial Biométrico</h2>
      </div>
      ${sorted.length === 0 ? `
        <div class="empty-state">Sin mediciones registradas todavía.</div>
      ` : `
        <div class="table-wrap body-history-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Peso</th>
                <th>IMC</th>
                <th>Grasa</th>
                <th>Libre Grasa</th>
                <th>Subcutánea</th>
                <th>Visceral</th>
                <th>Agua</th>
                <th>Músc. Esq.</th>
                <th>Masa Musc.</th>
                <th>Masa Ósea</th>
                <th>Proteína</th>
                <th>TMB</th>
                <th>Edad Met.</th>
                <th>Cintura</th>
                <th>Bíceps</th>
                <th>Muslo</th>
                <th style="text-align:right;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map(item => {
                const biceps = item.bicepsCm ?? item.armCm;
                return `
                  <tr>
                    <td class="mono">${formatDateDMY(item.date)}</td>
                    <td class="mono">${item.time || '--'}</td>
                    <td class="mono" style="font-weight:600;">${formatVal(item.weightKg, 'kg')}</td>
                    <td class="mono">${item.bmi ?? '--'}</td>
                    <td class="mono">${formatVal(item.bodyFatPct, '%')}</td>
                    <td class="mono">${formatVal(item.fatFreeWeightKg, 'kg')}</td>
                    <td class="mono">${formatVal(item.subcutaneousFatPct, '%')}</td>
                    <td class="mono">${item.visceralFat ?? '--'}</td>
                    <td class="mono">${formatVal(item.bodyWaterPct, '%')}</td>
                    <td class="mono">${formatVal(item.skeletalMusclesPct, '%')}</td>
                    <td class="mono">${formatVal(item.muscleMassKg, 'kg')}</td>
                    <td class="mono">${formatVal(item.boneMassKg, 'kg')}</td>
                    <td class="mono">${formatVal(item.proteinPct, '%')}</td>
                    <td class="mono">${formatVal(item.bmr, 'kcal')}</td>
                    <td class="mono">${item.metabolicAge ?? '--'}</td>
                    <td class="mono">${formatVal(item.waistCm, 'cm')}</td>
                    <td class="mono">${formatVal(biceps, 'cm')}</td>
                    <td class="mono">${formatVal(item.thighCm, 'cm')}</td>
                    <td style="text-align:right;">
                      <button type="button" class="btn-icon" data-delete-body="${item.id}" title="Eliminar">
                        ${icon('trash')}
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </section>

    <aside class="body-aside" aria-label="Calendario y resumen biométrico">
      <section class="card habit-calendar" aria-label="Calendario biométrico">
        ${buildBodyCalendar(store.bodyMetrics, today)}
      </section>

      <section class="card">
        <div class="card-header">
          <h2 class="card-title">${icon('body')} Situación Actual</h2>
          <span class="cyber-tag">STATUS</span>
        </div>
        ${summaryHTML}
        <div class="body-alerts-list">
          ${alerts.map(a => `
            <div class="body-alert-item is-${a.level}">
              <span class="badge ${a.level === 'danger' ? 'badge-danger' : a.level === 'warn' ? 'badge-warning' : 'badge-success'}">${a.tag}</span>
              <span>${a.text}</span>
            </div>
          `).join('')}
        </div>
      </section>
    </aside>
  `;

  // Filtros y zoom del gráfico
  const refreshChart = () => {
    const meta = BODY_METRICS_META.find(m => m.key === selectedChartMetric) || BODY_METRICS_META[0];
    const titleEl = container.querySelector('#body-chart-title');
    const chartContainer = container.querySelector('#body-chart-container');
    const zoomBtn = container.querySelector('#btn-chart-zoom-reset');
    if (titleEl) {
      titleEl.innerHTML = `${icon('body')} Evolución: ${meta.label}${meta.unit ? ` (${meta.unit})` : ''}`;
    }
    if (zoomBtn) zoomBtn.textContent = `${chartZoom}x`;
    if (chartContainer) {
      chartContainer.innerHTML = buildBodyChartSVG(getStore().bodyMetrics, selectedChartMetric);
    }
  };

  container.querySelector('#body-chart-metric')?.addEventListener('change', (e) => {
    selectedChartMetric = e.target.value;
    refreshChart();
  });
  container.querySelector('#body-chart-year')?.addEventListener('change', (e) => {
    selectedChartYear = e.target.value;
    refreshChart();
  });
  container.querySelector('#body-chart-month')?.addEventListener('change', (e) => {
    selectedChartMonth = e.target.value;
    refreshChart();
  });
  container.querySelector('#btn-chart-zoom-in')?.addEventListener('click', () => {
    chartZoom = Math.min(6, chartZoom + 1);
    refreshChart();
  });
  container.querySelector('#btn-chart-zoom-out')?.addEventListener('click', () => {
    chartZoom = Math.max(1, chartZoom - 1);
    refreshChart();
  });
  container.querySelector('#btn-chart-zoom-reset')?.addEventListener('click', () => {
    chartZoom = 1;
    refreshChart();
  });
  container.querySelector('#btn-chart-reset-filters')?.addEventListener('click', () => {
    selectedChartMetric = 'weightKg';
    selectedChartYear = 'all';
    selectedChartMonth = 'all';
    chartZoom = 1;
    const metricEl = container.querySelector('#body-chart-metric');
    const yearEl = container.querySelector('#body-chart-year');
    const monthEl = container.querySelector('#body-chart-month');
    if (metricEl) metricEl.value = 'weightKg';
    if (yearEl) yearEl.value = 'all';
    if (monthEl) monthEl.value = 'all';
    refreshChart();
  });

  // Navegación del calendario y selección de fecha
  container.querySelectorAll('[data-cal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = btn.getAttribute('data-cal');
      if (dir === 'today') {
        const [y, m] = today.split('-').map(Number);
        calYear = y;
        calMonth = m - 1;
        selectedBodyDate = today;
      } else if (dir === 'prev') {
        calMonth--;
        if (calMonth < 0) { calMonth = 11; calYear--; }
      } else if (dir === 'next') {
        calMonth++;
        if (calMonth > 11) { calMonth = 0; calYear++; }
      }
      renderBody(container);
    });
  });

  container.querySelectorAll('[data-cal-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedBodyDate = btn.getAttribute('data-cal-day');
      renderBody(container);
    });
  });

  const loadDateBtn = container.querySelector('#btn-body-load-date');
  if (loadDateBtn) {
    loadDateBtn.addEventListener('click', () => openBodyModal(container, latest, selectedBodyDate));
  }

  // Eliminar registro
  container.querySelectorAll('[data-delete-body]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!window.confirm('¿Estás seguro de borrar esta medición corporal?')) return;
      const id = btn.getAttribute('data-delete-body');
      const current = getStore();
      current.bodyMetrics = current.bodyMetrics.filter(r => r.id !== id);
      saveStore(current);
      showToast('Medición eliminada');
      renderBody(container);
    });
  });

  // Agregar nueva medición
  const addBtn = container.querySelector('#btn-add-body');
  if (addBtn) {
    addBtn.addEventListener('click', () => openBodyModal(container, latest, selectedBodyDate));
  }
}
