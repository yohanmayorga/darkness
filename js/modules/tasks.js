import { getStore, saveStore, generateId, todayISO } from '../services/db.js?v=6.9.0';
import { icon } from '../components/icons.js?v=3.3.0';
import { openModal, closeModal } from '../components/modal.js?v=1.4.0';
import { showToast } from '../components/toast.js?v=1.4.0';
import { buildUnifiedCalendarHTML, bindUnifiedCalendar } from '../components/calendar.js?v=2.6.0';
import { formatDateDMY } from '../utils/text.js?v=4.3.0';
import { asideCyberDecal } from '../components/hudFrame.js?v=1.1.1';

let statusFilter = 'all';
const calState = { year: null, month: null, selectedDate: '' };

const STATUS_META = {
  pending: { label: 'Pendiente' },
  in_progress: { label: 'En curso' },
  done: { label: 'Completada' }
};

const PRIORITY_META = {
  high: { label: 'Alta', cls: 'is-high' },
  medium: { label: 'Media', cls: 'is-medium' },
  low: { label: 'Baja', cls: 'is-low' }
};

function ensureTasks(store) {
  if (!Array.isArray(store.taskLists) || store.taskLists.length === 0) {
    store.taskLists = [
      { id: 'list-general', name: 'General (Rápida)', isDefault: true, createdAt: todayISO() }
    ];
  }
  if (!store.taskLists.some(l => l.id === 'list-general')) {
    store.taskLists.unshift({ id: 'list-general', name: 'General (Rápida)', isDefault: true, createdAt: todayISO() });
  }
  if (!Array.isArray(store.tasks)) {
    store.tasks = [];
  }
  store.tasks.forEach(t => {
    if (!STATUS_META[t.status]) t.status = 'pending';
    if (!PRIORITY_META[t.priority]) t.priority = 'medium';
    if (typeof t.dueDate !== 'string') t.dueDate = '';
    if (!t.listId) t.listId = 'list-general';
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function calcStats(items) {
  const total = items.length;
  const done = items.filter(t => t.status === 'done').length;
  const inProgress = items.filter(t => t.status === 'in_progress').length;
  const pending = items.filter(t => t.status === 'pending').length;
  const donePct = total > 0 ? Math.round((done / total) * 100) : 0;
  const inProgPct = total > 0 ? Math.round((inProgress / total) * 100) : 0;
  const pendPct = total > 0 ? Math.max(0, 100 - donePct - inProgPct) : 0;
  return { total, done, inProgress, pending, donePct, inProgPct, pendPct };
}

export function renderTasks(container) {
  const store = getStore();
  ensureTasks(store);
  const today = todayISO();
  if (calState.year === null) {
    const [y, m] = today.split('-').map(Number);
    calState.year = y;
    calState.month = m - 1;
    calState.selectedDate = today;
  }

  const lists = store.taskLists;
  const allTasks = store.tasks;
  const globalStats = calcStats(allTasks);
  const highPriorityCount = allTasks.filter(t => t.priority === 'high' && t.status !== 'done').length;

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <span class="page-eyebrow">EJECUCIÓN Y PENDIENTES</span>
        <h1 class="page-title">Gestión de Tareas</h1>
        <p class="page-subtitle">Listas personalizadas, prioridades, fecha límite y orden por urgencia.</p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" id="btn-new-task-list">
          ${icon('plus')} Nueva Lista
        </button>
      </div>
    </header>

    <section class="grid-kpi">
      <div class="kpi-card">
        <div class="kpi-top"><span>Progreso Global</span>${icon('target')}</div>
        <div class="kpi-value ${globalStats.donePct >= 70 ? 'text-success' : ''}">${globalStats.donePct}%</div>
        <div class="kpi-meta"><span class="mono">${globalStats.done}/${globalStats.total}</span> completadas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span>En Curso</span>${icon('clock')}</div>
        <div class="kpi-value">${globalStats.inProgress}</div>
        <div class="kpi-meta">Tareas activas ahora</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span>Pendientes</span>${icon('list')}</div>
        <div class="kpi-value ${globalStats.pending > 0 ? 'text-danger' : ''}">${globalStats.pending}</div>
        <div class="kpi-meta"><span class="mono">${highPriorityCount}</span> de prioridad alta</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span>Listas Activas</span>${icon('habits')}</div>
        <div class="kpi-value">${lists.length}</div>
        <div class="kpi-meta">General + personalizadas</div>
      </div>
    </section>

    <section class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <h2 class="card-title">${icon('target')} Gráfico General de Avance</h2>
        <span class="badge badge-silver mono">${globalStats.done}/${globalStats.total} (${globalStats.donePct}%)</span>
      </div>
      <div class="tasks-segmented-track" aria-label="Progreso global">
        <div class="tasks-seg-done" style="width:${globalStats.donePct}%" title="Completadas: ${globalStats.done}"></div>
        <div class="tasks-seg-prog" style="width:${globalStats.inProgPct}%" title="En curso: ${globalStats.inProgress}"></div>
        <div class="tasks-seg-pend" style="width:${globalStats.pendPct}%" title="Pendientes: ${globalStats.pending}"></div>
      </div>
      <div class="tasks-legend mono">
        <span><i class="tasks-dot is-done"></i> Completadas (${globalStats.done})</span>
        <span><i class="tasks-dot is-prog"></i> En curso (${globalStats.inProgress})</span>
        <span class="text-danger"><i class="tasks-dot is-pend"></i> Pendientes (${globalStats.pending})</span>
      </div>

      ${lists.length > 0 ? `
        <div class="finance-chart-list" style="margin-top:14px;">
          ${lists.map(l => {
            const items = allTasks.filter(t => t.listId === l.id);
            const st = calcStats(items);
            return `
              <div class="finance-chart-row">
                <div class="finance-chart-meta">
                  <span class="finance-chart-cat">${escapeHtml(l.name)}</span>
                  <span class="finance-chart-val">${st.done}/${st.total} · ${st.donePct}%</span>
                </div>
                <div class="tasks-segmented-track is-sm">
                  <div class="tasks-seg-done" style="width:${st.donePct}%"></div>
                  <div class="tasks-seg-prog" style="width:${st.inProgPct}%"></div>
                  <div class="tasks-seg-pend" style="width:${st.pendPct}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    </section>

    <div class="filter-tabs">
      <button type="button" class="filter-tab ${statusFilter === 'all' ? 'active' : ''}" data-task-filter="all">Todas</button>
      <button type="button" class="filter-tab ${statusFilter === 'pending' ? 'active' : ''}" data-task-filter="pending">Pendientes</button>
      <button type="button" class="filter-tab ${statusFilter === 'in_progress' ? 'active' : ''}" data-task-filter="in_progress">En curso</button>
      <button type="button" class="filter-tab ${statusFilter === 'done' ? 'active' : ''}" data-task-filter="done">Completadas</button>
    </div>

    <div class="grid-2">
      ${lists.map(list => {
        const listTasks = allTasks.filter(t => t.listId === list.id);
        const st = calcStats(listTasks);
        const visibleTasks = statusFilter === 'all'
          ? listTasks
          : listTasks.filter(t => t.status === statusFilter);

        return `
          <section class="card task-list-card">
            <div class="card-header">
              <h2 class="card-title">${icon('list')} ${escapeHtml(list.name)}</h2>
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="badge badge-silver mono">${st.done}/${st.total} (${st.donePct}%)</span>
                ${!list.isDefault ? `
                  <button type="button" class="btn-icon" data-delete-list="${list.id}" title="Eliminar lista" style="width:28px;height:28px;">
                    ${icon('trash')}
                  </button>
                ` : ''}
              </div>
            </div>

            <div class="tasks-segmented-track is-sm" style="margin-bottom:12px;">
              <div class="tasks-seg-done" style="width:${st.donePct}%"></div>
              <div class="tasks-seg-prog" style="width:${st.inProgPct}%"></div>
              <div class="tasks-seg-pend" style="width:${st.pendPct}%"></div>
            </div>

            <form class="task-inline-add" data-add-task-form="${list.id}">
              <input type="text" name="title" class="form-input task-add-title" placeholder="Nueva tarea en ${escapeHtml(list.name)}..." required />
              <select name="priority" class="form-select task-add-priority" aria-label="Prioridad">
                <option value="high">Alta</option>
                <option value="medium" selected>Media</option>
                <option value="low">Baja</option>
              </select>
              <input type="date" name="dueDate" class="form-input task-add-date" title="Fecha límite (opcional)" aria-label="Fecha límite opcional" />
              <button type="submit" class="btn btn-secondary btn-sm" aria-label="Agregar tarea">${icon('plus')}</button>
            </form>

            ${visibleTasks.length === 0 ? `
              <div class="empty-state" style="padding:16px 8px;">Sin tareas para este filtro.</div>
            ` : `
              <div class="task-items-list" data-task-dropzone="${list.id}">
                ${visibleTasks.map(task => {
                  const isDone = task.status === 'done';
                  const pMeta = PRIORITY_META[task.priority] || PRIORITY_META.medium;
                  const isOverdue = Boolean(task.dueDate && task.dueDate < today && !isDone);
                  return `
                    <div class="task-item ${pMeta.cls} ${isDone ? 'is-done' : ''}" draggable="true" data-task-id="${task.id}" data-task-list="${list.id}">
                      <span class="task-drag-handle" title="Arrastrar para reordenar" aria-hidden="true">⋮⋮</span>
                      <button type="button" class="habit-check-btn ${isDone ? 'done' : ''}" data-toggle-task="${task.id}" aria-label="Completar tarea">
                        ${icon('check')}
                      </button>
                      <div class="task-item-main">
                        <span class="task-item-title">${escapeHtml(task.title)}</span>
                        <div class="task-item-meta">
                          <select class="task-mini-select task-priority-select ${pMeta.cls}" data-priority-task="${task.id}" aria-label="Prioridad">
                            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>Alta</option>
                            <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Media</option>
                            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Baja</option>
                          </select>
                          ${task.dueDate ? `
                            <span class="mono task-due-tag ${isOverdue ? 'text-danger' : 'text-muted'}">
                              ${isOverdue ? 'Vencida: ' : 'Límite: '}${formatDateDMY(task.dueDate)}
                            </span>
                          ` : ''}
                        </div>
                      </div>
                      <div class="task-item-actions">
                        <select class="task-mini-select task-status-select is-${task.status}" data-status-task="${task.id}" aria-label="Estado">
                          <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                          <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>En curso</option>
                          <option value="done" ${task.status === 'done' ? 'selected' : ''}>Completada</option>
                        </select>
                        <button type="button" class="btn-icon" data-delete-task="${task.id}" title="Eliminar tarea" style="width:28px;height:28px;">
                          ${icon('trash')}
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </section>
        `;
      }).join('')}
    </div>

    <aside class="section-aside" aria-label="Calendario y resumen de tareas">
      <section class="card habit-calendar" id="tasks-calendar" aria-label="Calendario de tareas">
        ${(() => {
          const marked = new Map();
          allTasks.forEach(t => {
            if (!t.dueDate) return;
            marked.set(t.dueDate, `${t.title} (${STATUS_META[t.status]?.label || 'Pendiente'})`);
          });
          const dayTasks = allTasks.filter(t => t.dueDate === calState.selectedDate);
          return buildUnifiedCalendarHTML({
            year: calState.year,
            month: calState.month,
            today,
            selectedDate: calState.selectedDate,
            markedDates: marked,
            footerLabel: 'Fechas límite',
            legendLabel: 'con límite',
            actionHTML: `
              <div class="body-cal-day-action">
                <div>
                  <div class="mono" style="font-weight:600;">${formatDateDMY(calState.selectedDate)}</div>
                  <div class="text-muted">${dayTasks.length ? `${dayTasks.length} tarea(s) límite` : 'Sin entregas este día'}</div>
                </div>
              </div>
            `
          });
        })()}
      </section>
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">${icon('list')} Resumen</h2>
          <span class="cyber-tag">TSK</span>
        </div>
        <p class="body-summary-text">
          Tienes <strong class="mono">${globalStats.pending}</strong> pendiente(s), <strong class="mono">${globalStats.inProgress}</strong> en curso y <strong class="mono">${globalStats.done}</strong> completada(s) (<strong class="mono">${globalStats.donePct}%</strong>).
        </p>
      </section>
      ${asideCyberDecal({ code: 'SYS.02', label: 'TASK MATRIX', tag: 'QUEUE // EXEC' })}
    </aside>
  `;

  bindUnifiedCalendar(container.querySelector('#tasks-calendar'), {
    state: calState,
    today,
    onChange: () => renderTasks(container)
  });

  // Filtros
  container.querySelectorAll('[data-task-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      statusFilter = btn.getAttribute('data-task-filter');
      renderTasks(container);
    });
  });

  // Nueva lista personalizada
  const newListBtn = container.querySelector('#btn-new-task-list');
  if (newListBtn) {
    newListBtn.addEventListener('click', () => {
      openModal({
        title: 'Nueva Lista de Tareas',
        contentHTML: `
          <form id="form-task-list">
            <div class="form-group">
              <label class="form-label">Nombre de la lista</label>
              <input type="text" name="name" class="form-input" placeholder="Ej. Trabajo, Estudios, Compras..." required />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="cancel-task-list">Cancelar</button>
              <button type="submit" class="btn btn-primary">Crear Lista</button>
            </div>
          </form>
        `,
        onMount: (modal) => {
          modal.querySelector('#cancel-task-list').addEventListener('click', closeModal);
          modal.querySelector('#form-task-list').addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const name = String(fd.get('name')).trim();
            if (!name) return;
            const current = getStore();
            ensureTasks(current);
            current.taskLists.push({
              id: generateId('tlist'),
              name,
              isDefault: false,
              createdAt: todayISO()
            });
            saveStore(current);
            closeModal();
            showToast(`Lista "${name}" creada`);
            renderTasks(container);
          });
        }
      });
    });
  }

  // Eliminar lista personalizada (y sus tareas)
  container.querySelectorAll('[data-delete-list]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!window.confirm('¿Estás seguro de borrar esta lista y todas sus tareas?')) return;
      const listId = btn.getAttribute('data-delete-list');
      const current = getStore();
      ensureTasks(current);
      current.taskLists = current.taskLists.filter(l => l.id !== listId);
      current.tasks = current.tasks.filter(t => t.listId !== listId);
      saveStore(current);
      showToast('Lista eliminada');
      renderTasks(container);
    });
  });

  // Agregar tarea inline en cualquier lista
  container.querySelectorAll('[data-add-task-form]').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const listId = form.getAttribute('data-add-task-form');
      const fd = new FormData(form);
      const title = String(fd.get('title') || '').trim();
      if (!title) return;
      const priority = String(fd.get('priority') || 'medium');
      const dueDate = String(fd.get('dueDate') || '');

      const current = getStore();
      ensureTasks(current);
      current.tasks.unshift({
        id: generateId('tsk'),
        listId,
        title,
        priority,
        dueDate,
        status: 'pending',
        createdAt: todayISO()
      });
      saveStore(current);
      showToast('Tarea agregada');
      renderTasks(container);
    });
  });

  // Completar / descompletar tarea con checkbox
  container.querySelectorAll('[data-toggle-task]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle-task');
      const current = getStore();
      ensureTasks(current);
      const task = current.tasks.find(t => t.id === id);
      if (!task) return;
      task.status = task.status === 'done' ? 'pending' : 'done';
      saveStore(current);
      renderTasks(container);
    });
  });

  // Dropdown de estado (Pendiente / En curso / Completada)
  container.querySelectorAll('[data-status-task]').forEach(sel => {
    sel.addEventListener('change', () => {
      const id = sel.getAttribute('data-status-task');
      const current = getStore();
      ensureTasks(current);
      const task = current.tasks.find(t => t.id === id);
      if (!task) return;
      task.status = sel.value;
      saveStore(current);
      renderTasks(container);
    });
  });

  // Dropdown de prioridad (Alta / Media / Baja)
  container.querySelectorAll('[data-priority-task]').forEach(sel => {
    sel.addEventListener('change', () => {
      const id = sel.getAttribute('data-priority-task');
      const current = getStore();
      ensureTasks(current);
      const task = current.tasks.find(t => t.id === id);
      if (!task) return;
      task.priority = sel.value;
      saveStore(current);
      renderTasks(container);
    });
  });

  // Eliminar tarea
  container.querySelectorAll('[data-delete-task]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!window.confirm('¿Estás seguro de borrar esta tarea?')) return;
      const id = btn.getAttribute('data-delete-task');
      const current = getStore();
      ensureTasks(current);
      current.tasks = current.tasks.filter(t => t.id !== id);
      saveStore(current);
      showToast('Tarea eliminada');
      renderTasks(container);
    });
  });

  // Drag & Drop para reordenar tareas dentro de su lista
  let draggedId = null;
  let draggedListId = null;

  container.querySelectorAll('.task-item[draggable="true"]').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedId = item.getAttribute('data-task-id');
      draggedListId = item.getAttribute('data-task-list');
      item.classList.add('is-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedId);
      }
    });

    item.addEventListener('dragover', (e) => {
      const targetList = item.getAttribute('data-task-list');
      if (!draggedId || targetList !== draggedListId) return;
      e.preventDefault();
      item.classList.add('is-drag-over');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('is-drag-over');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('is-drag-over');
      const targetId = item.getAttribute('data-task-id');
      const targetList = item.getAttribute('data-task-list');
      if (!draggedId || !targetId || draggedId === targetId || targetList !== draggedListId) return;

      const current = getStore();
      ensureTasks(current);
      const fromIdx = current.tasks.findIndex(t => t.id === draggedId);
      const toIdx = current.tasks.findIndex(t => t.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return;

      const [moved] = current.tasks.splice(fromIdx, 1);
      current.tasks.splice(toIdx, 0, moved);
      saveStore(current);
      renderTasks(container);
    });

    item.addEventListener('dragend', () => {
      draggedId = null;
      draggedListId = null;
      container.querySelectorAll('.task-item').forEach(el => {
        el.classList.remove('is-dragging', 'is-drag-over');
      });
    });
  });
}
