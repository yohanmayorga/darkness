import { getStore, saveStore, todayISO } from '../services/db.js?v=1.4.0';
import { icon } from '../components/icons.js?v=1.4.0';
import { showToast } from '../components/toast.js?v=1.4.0';
import { renderMementoSidebar } from '../components/memento.js?v=1.6.0';
import { escapeHTML, stripHTML } from '../utils/text.js?v=1.4.0';
import { isScheduled, isDone, habitStreak } from '../utils/habits.js?v=1.4.0';

const WORLD_CLOCKS = [
  { id: 'nyc', label: 'Nueva York', tz: 'America/New_York' },
  { id: 'arg', label: 'Argentina', tz: 'America/Argentina/Buenos_Aires' },
  { id: 'mad', label: 'Madrid', tz: 'Europe/Madrid' },
  { id: 'sel', label: 'Seúl', tz: 'Asia/Seoul' },
  { id: 'tyo', label: 'Tokyo', tz: 'Asia/Tokyo' },
  { id: 'pek', label: 'Pekín', tz: 'Asia/Shanghai' }
];

let clockInterval = null;

function formatWorldClock(now, tz) {
  const time = new Intl.DateTimeFormat('es-ES', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
  const weekday = new Intl.DateTimeFormat('es-ES', {
    timeZone: tz,
    weekday: 'short'
  }).format(now).replace('.', '');
  const day = new Intl.DateTimeFormat('es-ES', {
    timeZone: tz,
    day: '2-digit'
  }).format(now);
  return { time, dayLabel: `${weekday} ${day}` };
}

function updateClockBar() {
  const bar = document.getElementById('dash-clock-bar');
  if (!bar) {
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
    return;
  }

  const now = new Date();
  const dayStr = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(now).replace('.', '');
  const dateStr = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(now).replace('.', '');
  const timeStr = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now);

  const dateEl = bar.querySelector('[data-clock-date]');
  const timeEl = bar.querySelector('[data-clock-time]');
  if (dateEl) dateEl.textContent = `${dayStr} · ${dateStr}`;
  if (timeEl) timeEl.textContent = timeStr;

  WORLD_CLOCKS.forEach(c => {
    const info = formatWorldClock(now, c.tz);
    const timeEl = bar.querySelector(`[data-tz="${c.id}"]`);
    const dayEl = bar.querySelector(`[data-tz-day="${c.id}"]`);
    if (timeEl) timeEl.textContent = info.time;
    if (dayEl) dayEl.textContent = info.dayLabel;
  });
}

export function renderDashboard(container) {
  const store = getStore();
  const today = todayISO();

  // Actualizar columna derecha Memento Mori
  renderMementoSidebar();

  // 1. Métricas de Hábitos (sólo cuentan los programados para hoy)
  const todayHabits = store.habits.filter(h => isScheduled(h, today));
  const totalHabits = todayHabits.length;
  const completedToday = todayHabits.filter(h => isDone(h, today)).length;
  const habitsPct = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

  // 2. Métricas Corporales
  const sortedBody = [...store.bodyMetrics].sort((a, b) => b.date.localeCompare(a.date));
  const latestBody = sortedBody[0] || { weightKg: 0, bodyFatPct: 0, waistCm: 0 };
  const weightDiff = store.profile.targetWeightKg
    ? (latestBody.weightKg - store.profile.targetWeightKg).toFixed(1)
    : '0.0';

  // 3. Lectura en curso
  const activeBook = store.books.find(b => b.status === 'Leyendo') || store.books[0];
  const bookPct = activeBook && activeBook.totalPages > 0
    ? Math.min(100, Math.round((activeBook.currentPage / activeBook.totalPages) * 100))
    : 0;

  // 4. Finanzas
  const totalIncome = store.transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const totalExpense = store.transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const balance = totalIncome - totalExpense;
  const currency = store.profile.currency || 'USD';

  // 5. Última entrada del diario
  const latestJournal = [...store.journalEntries].sort((a, b) => b.date.localeCompare(a.date))[0];

  const renderClockNode = c => `
    <div class="cyber-clock-node" title="${c.label}">
      <span class="cyber-clock-city">${c.label}</span>
      <span class="cyber-clock-time" data-tz="${c.id}">--:--</span>
      <span class="cyber-clock-day" data-tz-day="${c.id}">--- --</span>
    </div>
  `;

  container.innerHTML = `
    <section class="cyber-clock-bar" id="dash-clock-bar" aria-label="Fecha, hora local y relojes mundiales">
      ${WORLD_CLOCKS.slice(0, 3).map(renderClockNode).join('')}
      <div class="cyber-clock-main">
        <span class="cyber-clock-main-date" data-clock-date>--- · -- --- ----</span>
        <span class="cyber-clock-main-time" data-clock-time>--:--:--</span>
      </div>
      ${WORLD_CLOCKS.slice(3, 6).map(renderClockNode).join('')}
    </section>

    <header class="page-header">
      <div class="page-title-group">
        <span class="page-eyebrow">${today} · PANEL CENTRAL</span>
        <h1 class="page-title">Hola, ${store.profile.name}</h1>
        <p class="page-subtitle">Resumen ejecutivo de tus pilares de crecimiento personal.</p>
      </div>
      <div class="page-actions">
        <a href="#/journal/new" class="btn btn-secondary">${icon('journal')} Escribir en Diario</a>
        <a href="#/habits" class="btn btn-primary">${icon('habits')} Ir a Hábitos</a>
      </div>
    </header>

    <section class="cyber-hud-strip" aria-hidden="true">
      <div class="cyber-hud-left">
        <span class="cyber-tag">SYS // ACTIVE</span>
        <svg class="cyber-barcode" viewBox="0 0 88 12" width="62" height="10" fill="currentColor">
          <rect x="0" y="0" width="3" height="12"/><rect x="5" y="0" width="1" height="12"/><rect x="8" y="0" width="4" height="12"/>
          <rect x="14" y="0" width="2" height="12"/><rect x="18" y="0" width="1" height="12"/><rect x="21" y="0" width="5" height="12"/>
          <rect x="28" y="0" width="2" height="12"/><rect x="32" y="0" width="3" height="12"/><rect x="37" y="0" width="1" height="12"/>
          <rect x="40" y="0" width="4" height="12"/><rect x="46" y="0" width="2" height="12"/><rect x="50" y="0" width="3" height="12"/>
          <rect x="55" y="0" width="1" height="12"/><rect x="58" y="0" width="5" height="12"/><rect x="65" y="0" width="2" height="12"/>
          <rect x="69" y="0" width="4" height="12"/><rect x="75" y="0" width="1" height="12"/><rect x="78" y="0" width="3" height="12"/>
          <rect x="83" y="0" width="5" height="12"/>
        </svg>
        <span class="cyber-hud-hide-sm">&gt;&gt; SURVIVAL_INDEX // SEC_01</span>
      </div>
      <div class="cyber-hazard-bar cyber-hud-hide-sm"></div>
      <div class="cyber-hud-right">
        <span class="cyber-crosses">✕ ✕</span>
        <span>»»»</span>
      </div>
    </section>

    <section class="grid-kpi">
      <div class="kpi-card cyber-reticle-wrap">
        <svg class="cyber-reticle-bg" viewBox="0 0 100 100" fill="none" stroke="currentColor" aria-hidden="true">
          <circle cx="50" cy="50" r="42" stroke-width="1.5" stroke-dasharray="18 6 8 6"/>
          <circle cx="50" cy="50" r="28" stroke-width="2" stroke-dasharray="28 10"/>
          <circle cx="50" cy="50" r="12" stroke-width="1.5"/>
          <line x1="50" y1="0" x2="50" y2="100" stroke-width="1"/>
          <line x1="0" y1="50" x2="100" y2="50" stroke-width="1"/>
        </svg>
        <div class="kpi-top">
          <span>Hábitos de Hoy</span>
          ${icon('habits')}
        </div>
        <div class="kpi-value">${completedToday}/${totalHabits}</div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${habitsPct}%"></div>
        </div>
        <div class="kpi-meta"><span class="mono">${habitsPct}%</span> completado hoy</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top">
          <span>Peso Corporal</span>
          ${icon('body')}
        </div>
        <div class="kpi-value">${latestBody.weightKg || '--'} <small style="font-size:0.78rem;font-weight:400;">kg</small></div>
        <div class="kpi-meta">
          <span>Grasa: <strong class="mono">${latestBody.bodyFatPct || '--'}%</strong></span>
          <span>· Meta: <strong class="mono">${store.profile.targetWeightKg}kg</strong> (${weightDiff > 0 ? '+' + weightDiff : weightDiff})</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top">
          <span>Lectura Activa</span>
          ${icon('reading')}
        </div>
        <div class="kpi-value" style="font-size:0.96rem;font-family:var(--font-sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${activeBook ? activeBook.title : 'Sin lectura activa'}
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${bookPct}%"></div>
        </div>
        <div class="kpi-meta">
          ${activeBook ? `<span class="badge badge-silver">${activeBook.modality}</span> <span class="mono">${bookPct}% (${activeBook.currentPage}/${activeBook.totalPages})</span>` : 'Agrega un libro en #/reading'}
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top">
          <span>Balance Neto</span>
          ${icon('finance')}
        </div>
        <div class="kpi-value">${currency} ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        <div class="kpi-meta">
          <span class="text-success mono">+${totalIncome.toLocaleString('en-US')}</span>
          <span>/</span>
          <span class="text-danger mono">-${totalExpense.toLocaleString('en-US')}</span>
        </div>
      </div>
    </section>

    <div class="grid-2">
      <!-- Check-in rápido de hábitos -->
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">${icon('habits')} Check-in Rápido de Hoy</h2>
          <a href="#/habits" class="btn btn-ghost btn-sm">Panel completo →</a>
        </div>
        <div id="dash-habits-list">
          ${todayHabits.length === 0 ? `<div class="empty-state">Hoy no tienes hábitos programados.</div>` : ''}
          ${todayHabits.map(h => {
            const done = isDone(h, today);
            return `
              <div class="habit-row">
                <div style="display:flex;align-items:center;gap:10px;">
                  <button type="button" class="habit-check-btn ${done ? 'done' : ''}" data-habit-id="${h.id}" aria-label="Marcar hábito">
                    ${icon('check')}
                  </button>
                  <div>
                    <div style="font-weight:500;font-size:0.82rem;${done ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${escapeHTML(h.name)}</div>
                    <span class="badge" style="margin-top:3px;">${escapeHTML(h.category)}</span>
                  </div>
                </div>
                <span class="mono text-secondary" style="font-size:0.72rem;">${habitStreak(h, today)}d</span>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <!-- Columna derecha del contenido: Lectura + Diario -->
      <div style="display:flex;flex-direction:column;gap:16px;">
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">${icon('reading')} Libro en Curso</h2>
            <a href="#/reading" class="btn btn-ghost btn-sm">Biblioteca →</a>
          </div>
          ${activeBook ? `
            <div class="book-card">
              <div class="book-header">
                <div class="book-cover">
                  ${activeBook.coverUrl ? `<img src="${activeBook.coverUrl}" alt="${activeBook.title}"/>` : 'LIBRO'}
                </div>
                <div class="book-info">
                  <div class="book-title">${activeBook.title}</div>
                  <div class="book-author">${activeBook.author}</div>
                  <div class="book-badges">
                    <span class="badge badge-silver">${activeBook.modality}</span>
                    <span class="badge mono">Inicio: ${activeBook.startDate || 'N/A'}</span>
                  </div>
                </div>
              </div>
              ${activeBook.comments ? `<div class="book-notes">"${activeBook.comments}"</div>` : ''}
            </div>
          ` : `<div class="empty-state">No hay libros activos.</div>`}
        </section>

        <section class="card">
          <div class="card-header">
            <h2 class="card-title">${icon('journal')} Última Reflexión del Diario</h2>
            <a href="#/journal" class="btn btn-ghost btn-sm">Abrir diario →</a>
          </div>
          ${latestJournal ? `
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                <strong style="font-size:0.84rem;font-weight:500;">${latestJournal.title}</strong>
                <span class="badge mono">${latestJournal.date}</span>
              </div>
              <p class="text-secondary" style="font-size:0.8rem;line-height:1.5;">${(() => {
                const plain = stripHTML(latestJournal.content || '');
                return escapeHTML(plain.length > 220 ? plain.slice(0, 220) + '…' : plain);
              })()}</p>
            </div>
          ` : `<div class="empty-state">Aún no hay entradas en el diario.</div>`}
        </section>
      </div>
    </div>
  `;

  // Eventos de check rápido de hábitos
  container.querySelectorAll('[data-habit-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-habit-id');
      const currentStore = getStore();
      const habit = currentStore.habits.find(item => item.id === id);
      if (!habit) return;
      if (!habit.logs) habit.logs = {};
      if (habit.logs[today]) delete habit.logs[today];
      else habit.logs[today] = true;
      saveStore(currentStore);
      showToast(habit.logs[today] ? `Hábito completado: ${habit.name}` : `Hábito desmarcado`);
      renderDashboard(container);
    });
  });

  if (clockInterval) clearInterval(clockInterval);
  updateClockBar();
  clockInterval = setInterval(updateClockBar, 1000);
}
