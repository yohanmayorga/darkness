import { getStore, saveStore, generateId, todayISO } from '../services/db.js?v=1.3.0';
import { icon } from '../components/icons.js?v=1.3.0';
import { openModal, closeModal } from '../components/modal.js?v=1.3.0';
import { showToast } from '../components/toast.js?v=1.3.0';

/**
 * Obtiene los últimos 7 días en orden cronológico
 */
function getLast7Days() {
  const days = [];
  const names = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    days.push({
      iso: `${y}-${m}-${day}`,
      label: names[d.getDay()],
      dayNum: day
    });
  }
  return days;
}

function calculateStreak(logs = {}) {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${day}`;
    if (logs[iso]) {
      streak++;
    } else if (i > 0) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function renderHabits(container) {
  const store = getStore();
  const today = todayISO();
  const weekDays = getLast7Days();

  const totalHabits = store.habits.length;
  const doneToday = store.habits.filter(h => h.logs?.[today]).length;

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <span class="page-eyebrow">DISCIPLINA DIARIA</span>
        <h1 class="page-title">Seguimiento de Hábitos</h1>
        <p class="page-subtitle">Haz clic en cualquier día de la matriz semanal para registrar o corregir tu progreso.</p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" id="btn-new-habit">
          ${icon('plus')} Nuevo Hábito
        </button>
      </div>
    </header>

    <section class="grid-kpi">
      <div class="kpi-card">
        <div class="kpi-top"><span>Completados Hoy</span>${icon('habits')}</div>
        <div class="kpi-value">${doneToday} / ${totalHabits}</div>
        <div class="kpi-meta">Fecha activa: <span class="mono">${today}</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span>Mejor Racha Activa</span>${icon('flame')}</div>
        <div class="kpi-value">${Math.max(0, ...store.habits.map(h => calculateStreak(h.logs)))} <small style="font-size:0.9rem;">días</small></div>
        <div class="kpi-meta">Consistencia acumulada</div>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <h2 class="card-title">${icon('habits')} Matriz de los Últimos 7 Días</h2>
      </div>

      ${store.habits.length === 0 ? `
        <div class="empty-state">
          <p>No tienes hábitos registrados todavía.</p>
        </div>
      ` : `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Hábito</th>
                <th>Categoría</th>
                <th>Racha</th>
                ${weekDays.map(d => `<th style="text-align:center;" class="mono">${d.label}<br><span style="font-size:0.7rem;color:var(--text-secondary);">${d.dayNum}</span></th>`).join('')}
                <th style="text-align:right;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${store.habits.map(h => {
                const streak = calculateStreak(h.logs);
                return `
                  <tr>
                    <td>
                      <div style="font-weight:600;">${h.name}</div>
                      <div class="text-muted mono" style="font-size:0.75rem;">Meta: ${h.targetDaysPerWeek} días/sem</div>
                    </td>
                    <td><span class="badge badge-silver">${h.category}</span></td>
                    <td><span class="badge mono">${streak}d</span></td>
                    ${weekDays.map(d => {
                      const isDone = Boolean(h.logs && h.logs[d.iso]);
                      return `
                        <td style="text-align:center;">
                          <button type="button"
                            class="habit-day-cell ${isDone ? 'done' : ''}"
                            style="margin:0 auto;"
                            data-toggle-habit="${h.id}"
                            data-date="${d.iso}"
                            title="${d.iso}">
                            ${isDone ? '✓' : '·'}
                          </button>
                        </td>
                      `;
                    }).join('')}
                    <td style="text-align:right;">
                      <button type="button" class="btn-icon" data-delete-habit="${h.id}" title="Eliminar hábito">
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
  `;

  // Eventos para alternar celda de día
  container.querySelectorAll('[data-toggle-habit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const habitId = btn.getAttribute('data-toggle-habit');
      const dateIso = btn.getAttribute('data-date');
      const current = getStore();
      const target = current.habits.find(h => h.id === habitId);
      if (!target) return;
      if (!target.logs) target.logs = {};
      target.logs[dateIso] = !target.logs[dateIso];
      saveStore(current);
      renderHabits(container);
    });
  });

  // Eliminar hábito
  container.querySelectorAll('[data-delete-habit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const habitId = btn.getAttribute('data-delete-habit');
      const current = getStore();
      current.habits = current.habits.filter(h => h.id !== habitId);
      saveStore(current);
      showToast('Hábito eliminado');
      renderHabits(container);
    });
  });

  // Crear nuevo hábito
  const newBtn = container.querySelector('#btn-new-habit');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      openModal({
        title: 'Nuevo Hábito',
        contentHTML: `
          <form id="form-habit">
            <div class="form-group">
              <label class="form-label">Nombre del hábito</label>
              <input type="text" name="name" class="form-input" placeholder="Ej. Meditación 15 min" required />
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Categoría</label>
                <select name="category" class="form-select">
                  <option value="Cuerpo">Cuerpo</option>
                  <option value="Mente">Mente</option>
                  <option value="Salud">Salud</option>
                  <option value="Disciplina">Disciplina</option>
                  <option value="Finanzas">Finanzas</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Meta (días por semana)</label>
                <input type="number" name="targetDays" class="form-input" min="1" max="7" value="7" required />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="cancel-habit">Cancelar</button>
              <button type="submit" class="btn btn-primary">Guardar Hábito</button>
            </div>
          </form>
        `,
        onMount: (modal) => {
          modal.querySelector('#cancel-habit').addEventListener('click', closeModal);
          modal.querySelector('#form-habit').addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const current = getStore();
            current.habits.push({
              id: generateId('hab'),
              name: String(fd.get('name')).trim(),
              category: String(fd.get('category')),
              targetDaysPerWeek: Number(fd.get('targetDays')) || 7,
              logs: {}
            });
            saveStore(current);
            closeModal();
            showToast('Hábito creado correctamente');
            renderHabits(container);
          });
        }
      });
    });
  }
}
