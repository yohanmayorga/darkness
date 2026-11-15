import { getStore, saveStore, todayISO } from '../services/db.js?v=1.3.0';
import { icon } from '../components/icons.js?v=1.3.0';
import { showToast } from '../components/toast.js?v=1.3.0';
import { renderMementoSidebar } from '../components/memento.js?v=1.3.0';
import { escapeHTML, stripHTML } from '../utils/text.js?v=1.3.0';

export function renderDashboard(container) {
  const store = getStore();
  const today = todayISO();

  // Actualizar columna derecha Memento Mori
  renderMementoSidebar();

  // 1. Métricas de Hábitos
  const totalHabits = store.habits.length;
  const completedToday = store.habits.filter(h => h.logs && h.logs[today]).length;
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

  container.innerHTML = `
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

    <section class="grid-kpi">
      <div class="kpi-card">
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
          <a href="#/habits" class="btn btn-ghost btn-sm">Ver matriz →</a>
        </div>
        <div id="dash-habits-list">
          ${store.habits.map(h => {
            const done = Boolean(h.logs && h.logs[today]);
            return `
              <div class="habit-row">
                <div style="display:flex;align-items:center;gap:10px;">
                  <button type="button" class="habit-check-btn ${done ? 'done' : ''}" data-habit-id="${h.id}" aria-label="Marcar hábito">
                    ${icon('check')}
                  </button>
                  <div>
                    <div style="font-weight:500;font-size:0.82rem;${done ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${h.name}</div>
                    <span class="badge" style="margin-top:3px;">${h.category}</span>
                  </div>
                </div>
                <span class="mono text-secondary" style="font-size:0.72rem;">${h.targetDaysPerWeek}d/sem</span>
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
      habit.logs[today] = !habit.logs[today];
      saveStore(currentStore);
      showToast(habit.logs[today] ? `Hábito completado: ${habit.name}` : `Hábito desmarcado`);
      renderDashboard(container);
    });
  });
}
