import { getStore, saveStore, generateId, todayISO, fileToDataUrl } from '../services/db.js?v=6.9.5';
import { icon } from '../components/icons.js?v=1.4.0';
import { openModal, closeModal } from '../components/modal.js?v=1.4.0';
import { showToast } from '../components/toast.js?v=1.4.0';
import { buildUnifiedCalendarHTML, bindUnifiedCalendar } from '../components/calendar.js?v=2.6.0';
import { formatDateDMY, escapeHTML } from '../utils/text.js?v=4.3.0';
import { asideCyberDecal } from '../components/hudFrame.js?v=1.1.1';

let activeFilter = 'Todos';
let activeModality = 'Todos';
let searchQuery = '';
let sortBy = 'date_desc';
const calState = { year: null, month: null, selectedDate: '' };

function calculateDaysBetween(start, end) {
  if (!start) return null;
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const diff = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
  return diff;
}

export function renderReading(container) {
  const store = getStore();
  const today = todayISO();
  if (calState.year === null) {
    const [y, m] = today.split('-').map(Number);
    calState.year = y;
    calState.month = m - 1;
    calState.selectedDate = today;
  }
  const books = store.books || [];

  const readingCount = books.filter(b => b.status === 'Leyendo').length;
  const finishedCount = books.filter(b => b.status === 'Terminado').length;

  const getFilteredAndSortedBooks = () => {
    const q = searchQuery.trim().toLowerCase();
    const list = books.filter(b => {
      if (activeFilter !== 'Todos' && b.status !== activeFilter) return false;
      if (activeModality !== 'Todos' && b.modality !== activeModality) return false;
      if (q) {
        const haystack = `${b.title || ''} ${b.author || ''} ${b.comments || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const dateA = a.endDate || a.startDate || '';
      const dateB = b.endDate || b.startDate || '';
      if (sortBy === 'date_desc') return dateB.localeCompare(dateA);
      if (sortBy === 'date_asc') return dateA.localeCompare(dateB);
      if (sortBy === 'rating_desc') return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      if (sortBy === 'rating_asc') return (Number(a.rating) || 0) - (Number(b.rating) || 0);
      if (sortBy === 'days_asc') {
        const da = calculateDaysBetween(a.startDate, a.endDate) ?? 99999;
        const db = calculateDaysBetween(b.startDate, b.endDate) ?? 99999;
        return da - db;
      }
      if (sortBy === 'days_desc') {
        const da = calculateDaysBetween(a.startDate, a.endDate) ?? -1;
        const db = calculateDaysBetween(b.startDate, b.endDate) ?? -1;
        return db - da;
      }
      if (sortBy === 'modality') return String(a.modality || '').localeCompare(String(b.modality || ''));
      if (sortBy === 'title') return String(a.title || '').localeCompare(String(b.title || ''));
      return 0;
    });
  };

  const renderBooksGridHTML = (list) => {
    if (list.length === 0) {
      return `
        <div class="card empty-state">
          <p>No hay libros que coincidan con los filtros actuales.</p>
        </div>
      `;
    }
    return `
      <div class="grid-3">
        ${list.map(book => {
          const daysSpent = calculateDaysBetween(book.startDate, book.endDate);
          const stars = book.rating > 0 ? `★ ${book.rating}/10` : 'Sin calificar';

          return `
            <article class="card book-card">
              <div>
                <div class="book-header">
                  <div class="book-cover">
                    ${book.coverUrl ? `<img src="${book.coverUrl}" alt="${escapeHTML(book.title)}"/>` : `<span>${escapeHTML((book.modality || 'LIB').slice(0, 3).toUpperCase())}</span>`}
                  </div>
                  <div class="book-info">
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                      <h3 class="book-title">${escapeHTML(book.title)}</h3>
                      <span class="badge ${book.status === 'Terminado' ? 'badge-success' : 'badge-silver'}">${escapeHTML(book.status)}</span>
                    </div>
                    <div class="book-author">${escapeHTML(book.author)}</div>
                    <div class="book-badges">
                      <span class="badge badge-silver">${escapeHTML(book.modality)}</span>
                      <span class="badge mono">${stars}</span>
                    </div>
                  </div>
                </div>

                <div style="display:flex;justify-content:space-between;font-size:0.76rem;margin-top:12px;" class="mono text-muted">
                  <span>Inicio: ${book.startDate ? formatDateDMY(book.startDate) : '—'}</span>
                  <span>Fin: ${book.endDate ? formatDateDMY(book.endDate) : 'En curso'}</span>
                  ${daysSpent ? `<span>(${daysSpent}d)</span>` : ''}
                </div>

                ${book.comments ? `<div class="book-notes" style="margin-top:12px;">${escapeHTML(book.comments)}</div>` : ''}
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--border-subtle);">
                <button type="button" class="btn btn-secondary btn-sm" data-edit-book="${book.id}">
                  ${icon('edit')} Editar / Notas
                </button>
                <button type="button" class="btn-icon" data-delete-book="${book.id}" title="Eliminar libro">
                  ${icon('trash')}
                </button>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  };

  const filteredBooks = getFilteredAndSortedBooks();
  const statuses = ['Todos', 'Leyendo', 'Terminado', 'Por leer', 'Pausado'];
  const modalities = ['Todos', 'Físico', 'Kindle', 'Audiolibro', 'PDF/Digital'];

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <span class="page-eyebrow">BIBLIOTECA INTELECTUAL</span>
        <h1 class="page-title">Registro de Lectura</h1>
        <p class="page-subtitle">Control de libros, fechas de inicio y fin, modalidad (físico, Kindle, audiolibro) y notas personales.</p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" id="btn-new-book">
          ${icon('plus')} Agregar Libro
        </button>
      </div>
    </header>

    <section class="grid-kpi">
      <div class="kpi-card">
        <div class="kpi-top"><span>Leyendo Ahora</span>${icon('reading')}</div>
        <div class="kpi-value">${readingCount}</div>
        <div class="kpi-meta">En progreso activo</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span>Libros Terminados</span>${icon('check')}</div>
        <div class="kpi-value">${finishedCount}</div>
        <div class="kpi-meta">Completados en tu biblioteca</div>
      </div>
    </section>

    <div class="filter-tabs" style="margin-bottom:10px;">
      ${statuses.map(st => `
        <button type="button" class="filter-tab ${activeFilter === st ? 'active' : ''}" data-filter-status="${st}">
          ${st}
        </button>
      `).join('')}
    </div>

    <div class="card" style="padding:10px 12px;margin-bottom:16px;">
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        <input type="search" id="reading-search" class="form-input" value="${escapeHTML(searchQuery)}" placeholder="Buscar libro, autor o nota..." style="flex:1 1 200px;min-height:36px;padding:5px 10px;font-size:0.84rem;" aria-label="Buscar libros" />
        <select id="reading-modality-filter" class="form-select" style="width:auto;min-height:36px;padding:5px 10px;font-size:0.82rem;" aria-label="Filtrar por formato">
          ${modalities.map(m => `<option value="${m}" ${activeModality === m ? 'selected' : ''}>${m === 'Todos' ? 'Todos los formatos' : m}</option>`).join('')}
        </select>
        <select id="reading-sort" class="form-select" style="width:auto;min-height:36px;padding:5px 10px;font-size:0.82rem;" aria-label="Ordenar libros">
          <option value="date_desc" ${sortBy === 'date_desc' ? 'selected' : ''}>Orden: Fecha (más reciente)</option>
          <option value="date_asc" ${sortBy === 'date_asc' ? 'selected' : ''}>Orden: Fecha (más antiguo)</option>
          <option value="rating_desc" ${sortBy === 'rating_desc' ? 'selected' : ''}>Orden: Calificación (mayor)</option>
          <option value="rating_asc" ${sortBy === 'rating_asc' ? 'selected' : ''}>Orden: Calificación (menor)</option>
          <option value="days_asc" ${sortBy === 'days_asc' ? 'selected' : ''}>Orden: Tiempo (más rápido)</option>
          <option value="days_desc" ${sortBy === 'days_desc' ? 'selected' : ''}>Orden: Tiempo (más largo)</option>
          <option value="modality" ${sortBy === 'modality' ? 'selected' : ''}>Orden: Formato</option>
          <option value="title" ${sortBy === 'title' ? 'selected' : ''}>Orden: Título (A–Z)</option>
        </select>
        <button type="button" class="btn btn-ghost btn-sm" id="reading-reset-filters">Limpiar</button>
      </div>
    </div>

    <div id="reading-books-grid">
      ${renderBooksGridHTML(filteredBooks)}
    </div>

    <aside class="section-aside" aria-label="Calendario y resumen de lectura">
      <section class="card habit-calendar" id="reading-calendar" aria-label="Calendario de lectura">
        ${(() => {
          const marked = new Map();
          books.forEach(b => {
            if (b.startDate) marked.set(b.startDate, `Inicio: ${b.title}`);
            if (b.endDate) marked.set(b.endDate, `Fin: ${b.title}`);
          });
          return buildUnifiedCalendarHTML({
            year: calState.year,
            month: calState.month,
            today,
            selectedDate: calState.selectedDate,
            markedDates: marked,
            footerLabel: 'Hitos del mes',
            legendLabel: 'inicio/fin'
          });
        })()}
      </section>
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">${icon('reading')} Resumen</h2>
          <span class="cyber-tag">LIB</span>
        </div>
        <p class="body-summary-text">
          Tienes <strong class="mono">${readingCount}</strong> libro(s) en curso y <strong class="mono">${finishedCount}</strong> terminado(s) en tu biblioteca.
        </p>
      </section>
      ${asideCyberDecal({ code: 'SYS.04', label: 'ARCHIVE INDEX', tag: 'DATA // READ' })}
    </aside>
  `;

  bindUnifiedCalendar(container.querySelector('#reading-calendar'), {
    state: calState,
    today,
    onChange: () => renderReading(container)
  });

  // Filtros, búsqueda y ordenamiento
  const bindBookCardActions = () => {
    container.querySelectorAll('[data-delete-book]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-book');
        const current = getStore();
        const target = current.books.find(b => b.id === id);
        if (!target) return;
        if (!window.confirm(`¿Estás seguro de borrar el libro "${target.title}"?`)) return;
        current.books = current.books.filter(b => b.id !== id);
        saveStore(current);
        showToast('Libro eliminado');
        renderReading(container);
      });
    });

    container.querySelectorAll('[data-edit-book]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-book');
        const target = getStore().books.find(b => b.id === id);
        if (target) openBookForm(target);
      });
    });
  };

  const refreshBooksGrid = () => {
    const grid = container.querySelector('#reading-books-grid');
    if (grid) {
      grid.innerHTML = renderBooksGridHTML(getFilteredAndSortedBooks());
      bindBookCardActions();
    }
  };

  container.querySelectorAll('[data-filter-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.getAttribute('data-filter-status');
      renderReading(container);
    });
  });

  container.querySelector('#reading-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    refreshBooksGrid();
  });

  container.querySelector('#reading-modality-filter')?.addEventListener('change', (e) => {
    activeModality = e.target.value;
    refreshBooksGrid();
  });

  container.querySelector('#reading-sort')?.addEventListener('change', (e) => {
    sortBy = e.target.value;
    refreshBooksGrid();
  });

  container.querySelector('#reading-reset-filters')?.addEventListener('click', () => {
    activeFilter = 'Todos';
    activeModality = 'Todos';
    searchQuery = '';
    sortBy = 'date_desc';
    renderReading(container);
  });

  bindBookCardActions();

  // Abrir modal para crear o editar libro
  const openBookForm = (existingBook = null) => {
    const b = existingBook || {
      title: '',
      author: '',
      modality: 'Físico',
      status: 'Leyendo',
      startDate: todayISO(),
      endDate: '',
      rating: 5,
      comments: '',
      coverUrl: ''
    };

    openModal({
      title: existingBook ? `Editar: ${b.title}` : 'Agregar Libro a Biblioteca',
      contentHTML: `
        <form id="form-book">
          <div class="form-grid">
            <div class="form-group full">
              <label class="form-label">Título del libro</label>
              <input type="text" name="title" class="form-input" value="${b.title}" placeholder="Ej. Meditaciones" required />
            </div>
            <div class="form-group">
              <label class="form-label">Autor</label>
              <input type="text" name="author" class="form-input" value="${b.author}" placeholder="Ej. Marco Aurelio" required />
            </div>
            <div class="form-group">
              <label class="form-label">Modalidad</label>
              <select name="modality" class="form-select">
                ${['Físico', 'Kindle', 'Audiolibro', 'PDF/Digital'].map(m => `<option value="${m}" ${b.modality === m ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Estado</label>
              <select name="status" class="form-select">
                ${['Leyendo', 'Terminado', 'Por leer', 'Pausado'].map(s => `<option value="${s}" ${b.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Calificación (1 a 10 ★)</label>
              <input type="number" name="rating" min="0" max="10" class="form-input" value="${b.rating ?? 8}" />
            </div>
            <div class="form-group">
              <label class="form-label">Fecha de Inicio</label>
              <input type="date" name="startDate" class="form-input" value="${b.startDate || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Fecha de Fin</label>
              <input type="date" name="endDate" class="form-input" value="${b.endDate || ''}" />
            </div>
            <div class="form-group full">
              <label class="form-label">Portada (subir imagen opcional)</label>
              <input type="file" name="coverFile" accept="image/*" class="form-input" />
            </div>
            <div class="form-group full">
              <label class="form-label">Comentarios, ideas clave y notas personales</label>
              <textarea name="comments" class="form-textarea" placeholder="Escribe tus aprendizajes, citas o reflexiones sobre este libro...">${b.comments || ''}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="cancel-book">Cancelar</button>
            <button type="submit" class="btn btn-primary">${existingBook ? 'Actualizar Libro' : 'Guardar Libro'}</button>
          </div>
        </form>
      `,
      onMount: (modal) => {
        modal.querySelector('#cancel-book').addEventListener('click', closeModal);
        modal.querySelector('#form-book').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const fileInput = e.target.querySelector('input[name="coverFile"]');
          const file = fileInput?.files?.[0];
          const uploadedCover = file ? await fileToDataUrl(file) : b.coverUrl;

          const statusVal = String(fd.get('status'));
          let endD = String(fd.get('endDate') || '');

          if (statusVal === 'Terminado' && !endD) {
            endD = todayISO();
          }

          const bookData = {
            id: existingBook ? existingBook.id : generateId('bk'),
            title: String(fd.get('title')).trim(),
            author: String(fd.get('author')).trim(),
            modality: String(fd.get('modality')),
            status: statusVal,
            startDate: String(fd.get('startDate') || ''),
            endDate: endD,
            rating: Number(fd.get('rating')) || 0,
            comments: String(fd.get('comments') || '').trim(),
            coverUrl: uploadedCover
          };

          const current = getStore();
          if (existingBook) {
            current.books = current.books.map(item => item.id === existingBook.id ? bookData : item);
          } else {
            current.books.unshift(bookData);
          }

          saveStore(current);
          closeModal();
          showToast(existingBook ? 'Libro actualizado' : 'Libro agregado a tu biblioteca');
          renderReading(container);
        });
      }
    });
  };

  const newBookBtn = container.querySelector('#btn-new-book');
  if (newBookBtn) newBookBtn.addEventListener('click', () => openBookForm(null));
}
