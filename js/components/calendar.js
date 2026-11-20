import { icon } from './icons.js?v=1.4.0';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * Construye el HTML del calendario unificado (.hcal-*) para cualquier sección
 */
export function buildUnifiedCalendarHTML({
  year,
  month,
  today,
  selectedDate = '',
  markedDates = new Map(),
  footerLabel = 'Días con registro',
  legendLabel = 'con datos',
  actionHTML = ''
}) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const pad = n => String(n).padStart(2, '0');

  let cells = WEEKDAYS.map(w => `<span class="hcal-weekday">${w}</span>`).join('');
  for (let i = 0; i < offset; i++) cells += '<span class="hcal-day empty"></span>';

  let monthCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
    const info = markedDates.get(iso);
    if (info) monthCount++;

    const cls = ['hcal-day'];
    let title = iso;
    if (iso > today) {
      cls.push('is-future');
    } else if (info) {
      cls.push('lvl-4');
      if (typeof info === 'string') title += ` · ${info}`;
    }
    if (iso === today) cls.push('is-today');
    if (selectedDate && iso === selectedDate) cls.push('is-selected');

    cells += `<button type="button" class="${cls.join(' ')}" data-ucal-day="${iso}" title="${title}" ${iso > today ? 'disabled' : ''}>${d}</button>`;
  }

  const [ty, tm] = today.split('-').map(Number);
  const isCurrentMonth = year === ty && month === tm - 1;

  return `
    <div class="hcal-header">
      <span class="hcal-title">${MONTHS[month]} <span class="text-muted">${year}</span></span>
      <div class="hcal-nav">
        <button type="button" class="btn-icon" data-ucal="prev" aria-label="Mes anterior">${icon('chevronLeft')}</button>
        <button type="button" class="btn-icon hcal-today-btn" data-ucal="today" title="Ir a hoy">Hoy</button>
        <button type="button" class="btn-icon" data-ucal="next" aria-label="Mes siguiente" ${isCurrentMonth ? 'disabled' : ''}>${icon('chevronRight')}</button>
      </div>
    </div>
    <div class="hcal-grid">${cells}</div>
    <div class="hcal-footer">
      <span>${footerLabel}: <span class="mono">${monthCount}</span></span>
      <span class="hcal-scale" aria-hidden="true">
        <i class="lvl-4"></i> ${legendLabel}
      </span>
    </div>
    ${actionHTML}
  `;
}

/**
 * Conecta navegación y selección de días del calendario unificado
 */
export function bindUnifiedCalendar(root, { state, today, onChange }) {
  root.querySelectorAll('[data-ucal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = btn.getAttribute('data-ucal');
      if (dir === 'today') {
        const [y, m] = today.split('-').map(Number);
        state.year = y;
        state.month = m - 1;
        state.selectedDate = today;
      } else if (dir === 'prev') {
        state.month--;
        if (state.month < 0) { state.month = 11; state.year--; }
      } else if (dir === 'next') {
        state.month++;
        if (state.month > 11) { state.month = 0; state.year++; }
      }
      onChange();
    });
  });

  root.querySelectorAll('[data-ucal-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      const iso = btn.getAttribute('data-ucal-day');
      state.selectedDate = iso;
      onChange();
    });
  });
}
