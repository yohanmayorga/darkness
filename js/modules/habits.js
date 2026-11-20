import { getStore, saveStore, generateId, todayISO } from '../services/db.js?v=1.4.0';
import { icon } from '../components/icons.js?v=1.4.0';
import { openModal, closeModal } from '../components/modal.js?v=1.4.0';
import { showToast } from '../components/toast.js?v=1.4.0';
import { escapeHTML } from '../utils/text.js?v=1.4.0';
import {
  addDays, parseISO, isValidISO,
  ALL_DAYS, WORK_DAYS, WEEKEND_DAYS, WEEK_ORDER, DAY_SHORT, DAY_LETTER,
  TIME_OF_DAY, TIME_ORDER, HABIT_CATEGORIES,
  isScheduled, isDone, offReason, dayStats, rangeSeries, aggregate,
  habitRate, habitStreak, bestStreak,
  formatShort, formatLong, scheduleLabel, pctText, generateAdvice
} from '../utils/habits.js?v=1.4.0';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CAL_WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const RANGES = [
  { key: 7, label: '7D' },
  { key: 30, label: '30D' },
  { key: 90, label: '90D' },
  { key: 'all', label: 'Todo' }
];

// Estado de la vista mientras navegas por la app
const state = { selectedDate: null, calYear: null, calMonth: null, range: 30 };

const esc = v => escapeHTML(String(v ?? ''));

/* ==========================================================================
   Punto de entrada
   ========================================================================== */
export function renderHabits(container) {
  const store = getStore();
  const habits = store.habits || [];
  const today = todayISO();

  if (!state.selectedDate || state.selectedDate > today) state.selectedDate = today;
  if (state.calYear === null) {
    const d = parseISO(state.selectedDate);
    state.calYear = d.getFullYear();
    state.calMonth = d.getMonth();
  }

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <span class="page-eyebrow">DISCIPLINA DIARIA</span>
        <h1 class="page-title">Hábitos</h1>
        <p class="page-subtitle">Sólo cuentan los hábitos programados para cada día: si hoy no toca, no penaliza tu porcentaje.</p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" id="btn-new-habit">${icon('plus')} Nuevo hábito</button>
      </div>
    </header>

    <section class="card habit-chart-card">
      <div class="card-header">
        <h2 class="card-title">${icon('dashboard')} Evolución del cumplimiento</h2>
        <div class="habit-range" role="group" aria-label="Rango de la gráfica">
          ${RANGES.map(r => `
            <button type="button" class="habit-range-btn ${state.range === r.key ? 'active' : ''}" data-range="${r.key}">${r.label}</button>
          `).join('')}
        </div>
      </div>
      ${buildChart(habits, today)}
      ${buildAdvice(habits, today)}
    </section>

    ${buildKpis(habits, today)}

    <div class="habit-layout">
      <section class="card habit-day">${buildDayPanel(habits, today)}</section>
      <aside class="habit-aside">
        <section class="card habit-calendar" aria-label="Calendario de cumplimiento">${buildCalendar(habits, today)}</section>
        <section class="card habit-manage">${buildManager(habits, today)}</section>
      </aside>
    </div>
  `;

  bindEvents(container, today);
}

/* ==========================================================================
   Gráfica de evolución (barras diarias + media móvil de 7 días)
   ========================================================================== */
function buildChart(habits, today) {
  if (!habits.length) {
    return `<div class="empty-state">Crea tu primer hábito para empezar a medir tu evolución.</div>`;
  }

  const earliest = habits.reduce((min, h) => (h.startDate < min ? h.startDate : min), today);
  let from = state.range === 'all' ? earliest : addDays(today, -(state.range - 1));
  if (state.range === 'all' && from > addDays(today, -6)) from = addDays(today, -6);

  const series = rangeSeries(habits, from, today);
  const withData = series.filter(d => d.pct !== null);
  const summary = aggregate(series);

  if (!withData.length || from > today) {
    return `<div class="empty-state">Aún no hay días registrados en este rango.</div>`;
  }

  const W = 1000;
  const H = 200;
  const n = series.length;
  const slot = W / n;
  const barW = Math.min(slot * 0.64, 46);

  // Media móvil de 7 días (sólo días con hábitos programados)
  const avgPoints = [];
  series.forEach((d, i) => {
    const win = series.slice(Math.max(0, i - 6), i + 1).filter(x => x.pct !== null);
    if (d.pct === null || !win.length) return;
    const avg = win.reduce((a, x) => a + x.pct, 0) / win.length;
    avgPoints.push(`${(i * slot + slot / 2).toFixed(2)},${(H - avg * H).toFixed(2)}`);
  });

  const bars = series.map((d, i) => {
    const x = (i * slot + (slot - barW) / 2).toFixed(2);
    const hitX = (i * slot).toFixed(2);
    const label = d.pct === null
      ? `${formatShort(d.iso)} · Sin hábitos programados`
      : `${formatShort(d.iso)} · ${d.done}/${d.total} · ${pctText(d.pct)}`;
    const cls = ['hc-bar'];
    if (d.pct === 1) cls.push('is-full');
    if (d.iso === state.selectedDate) cls.push('is-selected');
    let bar = '';
    if (d.pct !== null) {
      const h = Math.max(d.pct * H, 3);
      bar = `<rect class="${cls.join(' ')}" x="${x}" y="${(H - h).toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" rx="2"/>`;
    }
    return `${bar}<rect class="hc-hit" x="${hitX}" y="0" width="${slot.toFixed(2)}" height="${H}" data-day="${d.iso}"><title>${label}</title></rect>`;
  }).join('');

  const mid = series[Math.floor((n - 1) / 2)];
  const xLabels = n > 1
    ? `<span>${formatShort(series[0].iso)}</span>${n > 6 ? `<span>${formatShort(mid.iso)}</span>` : ''}<span>${formatShort(today)}</span>`
    : `<span>${formatShort(today)}</span>`;

  return `
    <div class="hc-summary">
      <span class="hc-summary-value mono">${pctText(summary.rate)}</span>
      <span class="text-muted">promedio del período · <span class="mono">${summary.done}/${summary.total}</span> cumplidos</span>
    </div>
    <div class="hc-wrap">
      <div class="hc-yaxis mono" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div>
      <div class="hc-plot">
        <svg class="hc-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Cumplimiento diario">
          <line class="hc-grid" x1="0" y1="0.5" x2="${W}" y2="0.5"/>
          <line class="hc-grid" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"/>
          <line class="hc-grid" x1="0" y1="${H - 0.5}" x2="${W}" y2="${H - 0.5}"/>
          ${bars}
          ${avgPoints.length > 1 ? `<polyline class="hc-line" points="${avgPoints.join(' ')}"/>` : ''}
        </svg>
        <div class="hc-xaxis mono">${xLabels}</div>
      </div>
    </div>
    <div class="hc-legend">
      <span><i class="hc-key-bar"></i>Cumplimiento diario</span>
      <span><i class="hc-key-full"></i>Día completo</span>
      <span><i class="hc-key-line"></i>Media móvil 7 días</span>
    </div>
  `;
}

function buildAdvice(habits, today) {
  if (!habits.length) return '';
  const tips = generateAdvice(habits, today);
  return `
    <div class="habit-advice">
      <span class="habit-advice-label mono">CONSEJO DE HOY</span>
      ${tips.map(t => `<p>${t}</p>`).join('')}
    </div>
  `;
}

/* ==========================================================================
   KPIs
   ========================================================================== */
function buildKpis(habits, today) {
  const t = dayStats(habits, today);
  const w = aggregate(rangeSeries(habits, addDays(today, -6), today));
  const m = aggregate(rangeSeries(habits, addDays(today, -29), today));
  const streaks = habits
    .filter(h => !h.endDate || h.endDate >= today)
    .map(h => ({ h, s: habitStreak(h, today) }))
    .sort((a, b) => b.s - a.s);
  const top = streaks[0];

  return `
    <section class="grid-kpi">
      <div class="kpi-card">
        <div class="kpi-top"><span>Hoy</span>${icon('habits')}</div>
        <div class="kpi-value">${t.total ? `${t.done}/${t.total}` : '—'} <small class="kpi-small">${pctText(t.pct)}</small></div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.round((t.pct || 0) * 100)}%"></div></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span>Últimos 7 días</span>${icon('calendar')}</div>
        <div class="kpi-value">${pctText(w.rate)}</div>
        <div class="kpi-meta"><span class="mono">${w.done}/${w.total}</span> cumplidos</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span>Últimos 30 días</span>${icon('calendar')}</div>
        <div class="kpi-value">${pctText(m.rate)}</div>
        <div class="kpi-meta"><span class="mono">${m.done}/${m.total}</span> cumplidos</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span>Mejor racha activa</span>${icon('flame')}</div>
        <div class="kpi-value">${top ? top.s : 0} <small class="kpi-small">días</small></div>
        <div class="kpi-meta">${top && top.s > 0 ? esc(top.h.name) : 'Sin racha activa'}</div>
      </div>
    </section>
  `;
}

/* ==========================================================================
   Panel del día (por defecto: hoy)
   ========================================================================== */
function buildDayPanel(habits, today) {
  const iso = state.selectedDate;
  const isToday = iso === today;
  const label = isToday ? 'Hoy' : iso === addDays(today, -1) ? 'Ayer' : 'Día anterior';
  const stats = dayStats(habits, iso);
  const scheduled = habits.filter(h => isScheduled(h, iso));
  const off = habits.filter(h => !isScheduled(h, iso));
  const pct = Math.round((stats.pct || 0) * 100);

  return `
    <div class="hday-head">
      <button type="button" class="btn-icon" data-day-nav="-1" aria-label="Día anterior">${icon('chevronLeft')}</button>
      <div class="hday-title">
        <span class="hday-label">${label}</span>
        <span class="hday-date">${formatLong(iso)}</span>
      </div>
      <button type="button" class="btn-icon" data-day-nav="1" aria-label="Día siguiente" ${isToday ? 'disabled' : ''}>${icon('chevronRight')}</button>
    </div>

    ${!isToday ? `
      <div class="hday-notice">
        <span>Estás corrigiendo un día anterior.</span>
        <button type="button" class="btn btn-ghost btn-sm" data-go-today>Volver a hoy</button>
      </div>` : ''}

    <div class="hday-progress">
      <div class="hday-score mono">${stats.total ? `${pct}%` : '—'}</div>
      <div class="hday-progress-body">
        <span class="text-secondary">${stats.total
          ? `${stats.done} de ${stats.total} hábitos programados${stats.done === stats.total ? ' · día completo' : ''}`
          : 'No hay hábitos programados para este día'}</span>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
    </div>

    <div class="hday-grid">
      ${scheduled.map(h => {
        const done = isDone(h, iso);
        const streak = habitStreak(h, today);
        const meta = [h.target, `Racha ${streak}d`].filter(Boolean).map(esc).join(' · ');
        return `
          <button type="button" class="hday-item ${done ? 'done' : ''}" data-toggle-habit="${h.id}" aria-pressed="${done}">
            <span class="habit-check-btn ${done ? 'done' : ''}" aria-hidden="true">${icon('check')}</span>
            <span class="hday-item-body">
              <span class="hday-item-name">${esc(h.name)}</span>
              <span class="hday-item-meta">${meta}</span>
            </span>
          </button>`;
      }).join('')}
    </div>

    ${off.length ? `
      <details class="hday-off">
        <summary>No cuentan este día <span class="mono">(${off.length})</span></summary>
        ${off.map(h => `
          <div class="hday-off-item">
            <span>${esc(h.name)}</span>
            <span class="text-muted">${esc(offReason(h, iso))}</span>
          </div>`).join('')}
      </details>` : ''}
  `;
}

/* ==========================================================================
   Calendario con mapa de calor de cumplimiento
   ========================================================================== */
function buildCalendar(habits, today) {
  const y = state.calYear;
  const m = state.calMonth;
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const pad = n => String(n).padStart(2, '0');

  let cells = CAL_WEEKDAYS.map(w => `<span class="hcal-weekday">${w}</span>`).join('');
  for (let i = 0; i < offset; i++) cells += '<span class="hcal-day empty"></span>';

  const monthSeries = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
    const cls = ['hcal-day'];
    let title = formatLong(iso);
    if (iso > today) {
      cls.push('is-future');
    } else {
      const s = dayStats(habits, iso);
      monthSeries.push(s);
      if (s.pct !== null) {
        const lvl = s.pct === 1 ? 4 : s.pct >= 0.67 ? 3 : s.pct >= 0.34 ? 2 : s.pct > 0 ? 1 : 0;
        cls.push(`lvl-${lvl}`);
        title += ` · ${s.done}/${s.total} (${pctText(s.pct)})`;
      }
    }
    if (iso === today) cls.push('is-today');
    if (iso === state.selectedDate) cls.push('is-selected');
    cells += `<button type="button" class="${cls.join(' ')}" data-cal-day="${iso}" title="${title}" ${iso > today ? 'disabled' : ''}>${d}</button>`;
  }

  const monthAgg = aggregate(monthSeries);
  const isCurrentMonth = y === parseISO(today).getFullYear() && m === parseISO(today).getMonth();

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
      <span>Mes: <span class="mono">${pctText(monthAgg.rate)}</span></span>
      <span class="hcal-scale" aria-hidden="true">
        0%<i class="lvl-0"></i><i class="lvl-1"></i><i class="lvl-2"></i><i class="lvl-3"></i><i class="lvl-4"></i>100%
      </span>
    </div>
  `;
}

/* ==========================================================================
   Gestión de hábitos
   ========================================================================== */
function habitStatus(h, today) {
  if (h.endDate && h.endDate < today) return { label: 'Finalizado', cls: '' };
  if (h.startDate > today) return { label: 'Programado', cls: 'badge-warning' };
  return { label: 'Activo', cls: 'badge-success' };
}

function buildManager(habits, today) {
  return `
    <div class="card-header">
      <h2 class="card-title">${icon('settings')} Gestionar hábitos</h2>
      <span class="text-muted mono hman-count">${habits.length} ${habits.length === 1 ? 'hábito' : 'hábitos'}</span>
    </div>
    ${!habits.length ? `<div class="empty-state">No tienes hábitos todavía.</div>` : `
      <div class="hman-list">
        ${habits.map(h => {
          const st = habitStatus(h, today);
          const r30 = habitRate(h, addDays(today, -29), today);
          return `
            <div class="hman-row">
              <div class="hman-main">
                <div class="hman-name">${esc(h.name)} <span class="badge ${st.cls}">${st.label}</span></div>
                ${h.target ? `<div class="hman-sub"><span>${esc(h.target)}</span></div>` : ''}
              </div>
              <div class="hman-days" aria-label="${scheduleLabel(h.days)}" title="${scheduleLabel(h.days)}">
                ${WEEK_ORDER.map(d => `<span class="${h.days.includes(d) ? 'on' : ''}">${DAY_LETTER[d]}</span>`).join('')}
              </div>
              <div class="hman-range mono">
                <span>Desde ${formatShort(h.startDate)}</span>
                <span>${h.endDate ? `Hasta ${formatShort(h.endDate)}` : 'Indefinido'}</span>
              </div>
              <div class="hman-stats mono">
                <span title="Cumplimiento últimos 30 días">${pctText(r30.rate)} <small>30d</small></span>
                <span title="Racha actual / mejor racha">${habitStreak(h, today)}d <small>/ ${bestStreak(h, today)}d</small></span>
              </div>
              <div class="hman-actions">
                <button type="button" class="btn-icon" data-edit-habit="${h.id}" aria-label="Editar ${esc(h.name)}">${icon('edit')}</button>
                <button type="button" class="btn-icon" data-delete-habit="${h.id}" aria-label="Eliminar ${esc(h.name)}">${icon('trash')}</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    `}
  `;
}

/* ==========================================================================
   Modal crear / editar
   ========================================================================== */
function openHabitForm(container, existing = null) {
  const today = todayISO();
  const h = existing || {
    name: '', category: 'General', timeOfDay: 'anytime', target: '',
    days: [...ALL_DAYS], startDate: today, endDate: ''
  };
  const presets = [
    { key: 'all', label: 'Todos los días', days: ALL_DAYS },
    { key: 'work', label: 'Lunes a viernes', days: WORK_DAYS },
    { key: 'weekend', label: 'Fines de semana', days: WEEKEND_DAYS }
  ];

  openModal({
    title: existing ? 'Editar hábito' : 'Nuevo hábito',
    contentHTML: `
      <form id="form-habit" novalidate>
        <div class="form-group">
          <label class="form-label" for="hf-name">Nombre del hábito</label>
          <input type="text" id="hf-name" name="name" class="form-input" placeholder="Ej. Meditación 15 min" value="${esc(h.name)}" maxlength="80" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="hf-target">Meta o detalle (opcional)</label>
          <input type="text" id="hf-target" name="target" class="form-input" placeholder="Ej. 3 L al día" value="${esc(h.target)}" maxlength="60" />
        </div>

        <div class="form-group">
          <span class="form-label">¿Qué días cuenta?</span>
          <div class="hf-presets">
            ${presets.map(p => `<button type="button" class="filter-tab" data-preset="${p.days.join(',')}">${p.label}</button>`).join('')}
          </div>
          <div class="hf-days" role="group" aria-label="Días de la semana">
            ${WEEK_ORDER.map(d => `
              <button type="button" class="hf-day ${h.days.includes(d) ? 'on' : ''}" data-day="${d}" aria-pressed="${h.days.includes(d)}" title="${DAY_SHORT[d]}">${DAY_SHORT[d]}</button>
            `).join('')}
          </div>
          <span class="hf-days-summary text-muted" id="hf-days-summary"></span>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="hf-start">Cuenta desde</label>
            <input type="date" id="hf-start" name="startDate" class="form-input" value="${h.startDate}" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="hf-end">Hasta</label>
            <input type="date" id="hf-end" name="endDate" class="form-input" value="${h.endDate}" ${h.endDate ? '' : 'disabled'} />
            <label class="hf-check">
              <input type="checkbox" id="hf-indef" ${h.endDate ? '' : 'checked'} /> Indefinido
            </label>
          </div>
        </div>
        <p class="hf-error text-danger" id="hf-error" hidden></p>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="cancel-habit">Cancelar</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Guardar cambios' : 'Crear hábito'}</button>
        </div>
      </form>
    `,
    onMount: modal => {
      const form = modal.querySelector('#form-habit');
      const dayBtns = [...modal.querySelectorAll('.hf-day')];
      const presetBtns = [...modal.querySelectorAll('[data-preset]')];
      const summary = modal.querySelector('#hf-days-summary');
      const endInput = modal.querySelector('#hf-end');
      const indef = modal.querySelector('#hf-indef');
      const errorEl = modal.querySelector('#hf-error');

      const selectedDays = () => dayBtns.filter(b => b.classList.contains('on')).map(b => Number(b.dataset.day));
      const syncDays = () => {
        const days = selectedDays();
        const key = [...days].sort().join(',');
        presetBtns.forEach(b => b.classList.toggle('active', b.dataset.preset === key));
        dayBtns.forEach(b => b.setAttribute('aria-pressed', b.classList.contains('on')));
        summary.textContent = days.length ? scheduleLabel(days) : 'Selecciona al menos un día';
      };

      dayBtns.forEach(b => b.addEventListener('click', () => { b.classList.toggle('on'); syncDays(); }));
      presetBtns.forEach(p => p.addEventListener('click', () => {
        const days = p.dataset.preset.split(',').map(Number);
        dayBtns.forEach(b => b.classList.toggle('on', days.includes(Number(b.dataset.day))));
        syncDays();
      }));
      indef.addEventListener('change', () => {
        endInput.disabled = indef.checked;
        if (indef.checked) endInput.value = '';
        else endInput.focus();
      });
      syncDays();

      modal.querySelector('#cancel-habit').addEventListener('click', closeModal);
      form.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(form);
        const name = String(fd.get('name') || '').trim();
        const days = selectedDays().sort();
        const startDate = String(fd.get('startDate') || '');
        const endDate = indef.checked ? '' : String(endInput.value || '');

        const fail = msg => { errorEl.textContent = msg; errorEl.hidden = false; };
        if (!name) return fail('Escribe un nombre para el hábito.');
        if (!days.length) return fail('Selecciona al menos un día de la semana.');
        if (!isValidISO(startDate)) return fail('Indica desde cuándo cuenta el hábito.');
        if (!indef.checked && !isValidISO(endDate)) return fail('Indica la fecha final o marca "Indefinido".');
        if (endDate && endDate < startDate) return fail('La fecha final no puede ser anterior a la inicial.');

        const data = {
          name,
          category: existing?.category || 'General',
          timeOfDay: existing?.timeOfDay || 'anytime',
          target: String(fd.get('target') || '').trim(),
          days, startDate, endDate
        };

        const current = getStore();
        if (existing) {
          const target = current.habits.find(x => x.id === existing.id);
          if (target) Object.assign(target, data);
        } else {
          current.habits.push({ id: generateId('hab'), ...data, logs: {}, createdAt: new Date().toISOString() });
        }
        saveStore(current);
        closeModal();
        showToast(existing ? 'Hábito actualizado' : 'Hábito creado');
        renderHabits(container);
      });
    }
  });
}

/* ==========================================================================
   Eventos
   ========================================================================== */
function selectDate(iso) {
  state.selectedDate = iso;
  const d = parseISO(iso);
  state.calYear = d.getFullYear();
  state.calMonth = d.getMonth();
}

function bindEvents(container, today) {
  const rerender = () => renderHabits(container);

  container.querySelector('#btn-new-habit')?.addEventListener('click', () => openHabitForm(container));

  container.querySelectorAll('[data-range]').forEach(btn => btn.addEventListener('click', () => {
    const v = btn.dataset.range;
    state.range = v === 'all' ? 'all' : Number(v);
    rerender();
  }));

  // Clic en una barra de la gráfica: abrir ese día
  container.querySelectorAll('.hc-hit[data-day]').forEach(el => el.addEventListener('click', () => {
    selectDate(el.dataset.day);
    rerender();
  }));

  // Navegación de días
  container.querySelectorAll('[data-day-nav]').forEach(btn => btn.addEventListener('click', () => {
    const next = addDays(state.selectedDate, Number(btn.dataset.dayNav));
    if (next > today) return;
    selectDate(next);
    rerender();
  }));
  container.querySelector('[data-go-today]')?.addEventListener('click', () => { selectDate(today); rerender(); });

  // Marcar / desmarcar
  container.querySelectorAll('[data-toggle-habit]').forEach(btn => btn.addEventListener('click', () => {
    const current = getStore();
    const h = current.habits.find(x => x.id === btn.dataset.toggleHabit);
    if (!h) return;
    const iso = state.selectedDate;
    if (h.logs[iso]) delete h.logs[iso];
    else h.logs[iso] = true;
    saveStore(current);
    rerender();
  }));

  // Calendario
  container.querySelectorAll('[data-cal]').forEach(btn => btn.addEventListener('click', () => {
    const action = btn.dataset.cal;
    if (action === 'today') {
      selectDate(today);
    } else {
      const d = new Date(state.calYear, state.calMonth + (action === 'prev' ? -1 : 1), 1);
      state.calYear = d.getFullYear();
      state.calMonth = d.getMonth();
    }
    rerender();
  }));
  container.querySelectorAll('[data-cal-day]').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.calDay > today) return;
    selectDate(btn.dataset.calDay);
    rerender();
    if (window.matchMedia('(max-width: 920px)').matches) {
      container.querySelector('.habit-day')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }));

  // Gestión
  container.querySelectorAll('[data-edit-habit]').forEach(btn => btn.addEventListener('click', () => {
    const h = getStore().habits.find(x => x.id === btn.dataset.editHabit);
    if (h) openHabitForm(container, h);
  }));
  container.querySelectorAll('[data-delete-habit]').forEach(btn => btn.addEventListener('click', () => {
    const current = getStore();
    const h = current.habits.find(x => x.id === btn.dataset.deleteHabit);
    if (!h) return;
    if (!window.confirm(`¿Eliminar "${h.name}" y todo su historial? Si sólo quieres dejar de contarlo, edítalo y ponle fecha final.`)) return;
    current.habits = current.habits.filter(x => x.id !== h.id);
    saveStore(current);
    showToast('Hábito eliminado');
    rerender();
  }));
}
