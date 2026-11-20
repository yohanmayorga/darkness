import { getStore, saveStore, generateId, todayISO, fileToDataUrl } from '../services/db.js?v=1.4.0';
import { icon } from '../components/icons.js?v=1.4.0';
import { openModal, closeModal } from '../components/modal.js?v=1.4.0';
import { showToast } from '../components/toast.js?v=1.4.0';
import { buildUnifiedCalendarHTML, bindUnifiedCalendar } from '../components/calendar.js?v=2.6.0';

let activeFilter = 'Todos';
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
  const totalPagesRead = books.reduce((acc, b) => acc + Number(b.currentPage || 0), 0);

  const filteredBooks = activeFilter === 'Todos'
    ? books
    : books.filter(b => b.status === activeFilter);

  const statuses = ['Todos', 'Leyendo', 'Terminado', 'Por leer', 'Pausado'];

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
      <div class="kpi-card">
        <div class="kpi-top"><span>Páginas Acumuladas</span>${icon('reading')}</div>
        <div class="kpi-value">${totalPagesRead.toLocaleString('en-US')}</div>
        <div class="kpi-meta">Volumen total registrado</div>
      </div>
    </section>

    <div class="filter-tabs">
      ${statuses.map(st => `
        <button type="button" class="filter-tab ${activeFilter === st ? 'active' : ''}" data-filter-status="${st}">
          ${st}
        </button>
      `).join('')}
    </div>

    ${filteredBooks.length === 0 ? `
      <div class="card empty-state">
        <p>No hay libros en la categoría "${activeFilter}".</p>
      </div>
    ` : `
      <div class="grid-3">
        ${filteredBooks.map(book => {
          const pct = book.totalPages > 0
            ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100))
            : 0;
          const daysSpent = calculateDaysBetween(book.startDate, book.endDate);
          const stars = book.rating > 0 ? '★'.repeat(book.rating) + '☆'.repeat(5 - book.rating) : 'Sin calificar';

          return `
            <article class="card book-card">
              <div>
                <div class="book-header">
                  <div class="book-cover">
                    ${book.coverUrl ? `<img src="${book.coverUrl}" alt="${book.title}"/>` : `<span>${book.modality.slice(0, 3).toUpperCase()}</span>`}
                  </div>
                  <div class="book-info">
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                      <h3 class="book-title">${book.title}</h3>
                      <span class="badge ${book.status === 'Terminado' ? 'badge-success' : 'badge-silver'}">${book.status}</span>
                    </div>
                    <div class="book-author">${book.author}</div>
                    <div class="book-badges">
                      <span class="badge badge-silver">${book.modality}</span>
                      <span class="badge mono">${stars}</span>
                    </div>
                  </div>
                </div>

                <div style="margin-top:14px;">
                  <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:5px;" class="mono text-secondary">
                    <span>Progreso: ${book.currentPage} / ${book.totalPages} págs</span>
                    <span>${pct}%</span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-fill" style="width:${pct}%"></div>
                  </div>
                </div>

                <div style="display:flex;justify-content:space-between;font-size:0.76rem;margin-top:12px;" class="mono text-muted">
                  <span>Inicio: ${book.startDate || '—'}</span>
                  <span>Fin: ${book.endDate || 'En curso'}</span>
                  ${daysSpent ? `<span>(${daysSpent}d)</span>` : ''}
                </div>

                ${book.comments ? `<div class="book-notes" style="margin-top:12px;">${book.comments}</div>` : ''}
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
    `}

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
          Tienes <strong class="mono">${readingCount}</strong> libro(s) en curso, <strong class="mono">${finishedCount}</strong> terminado(s) y <strong class="mono">${totalPagesRead.toLocaleString('en-US')}</strong> páginas acumuladas en tu biblioteca.
        </p>
      </section>
    </aside>
  `;

  bindUnifiedCalendar(container.querySelector('#reading-calendar'), {
    state: calState,
    today,
    onChange: () => renderReading(container)
  });

  // Filtros
  container.querySelectorAll('[data-filter-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.getAttribute('data-filter-status');
      renderReading(container);
    });
  });

  // Eliminar libro
  container.querySelectorAll('[data-delete-book]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-book');
      const current = getStore();
      current.books = current.books.filter(b => b.id !== id);
      saveStore(current);
      showToast('Libro eliminado');
      renderReading(container);
    });
  });

  // Abrir modal para crear o editar libro
  const openBookForm = (existingBook = null) => {
    const b = existingBook || {
      title: '',
      author: '',
      modality: 'Físico',
      status: 'Leyendo',
      startDate: todayISO(),
      endDate: '',
      currentPage: 0,
      totalPages: 250,
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
              <label class="form-label">Calificación (0 a 5 ★)</label>
              <input type="number" name="rating" min="0" max="5" class="form-input" value="${b.rating ?? 5}" />
            </div>
            <div class="form-group">
              <label class="form-label">Fecha de Inicio</label>
              <input type="date" name="startDate" class="form-input" value="${b.startDate || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Fecha de Fin</label>
              <input type="date" name="endDate" class="form-input" value="${b.endDate || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Página / Progreso Actual</label>
              <input type="number" name="currentPage" min="0" class="form-input" value="${b.currentPage || 0}" />
            </div>
            <div class="form-group">
              <label class="form-label">Total de Páginas (o 100 para %)</label>
              <input type="number" name="totalPages" min="1" class="form-input" value="${b.totalPages || 100}" required />
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
          const totalP = Number(fd.get('totalPages')) || 100;
          let currP = Number(fd.get('currentPage')) || 0;
          let endD = String(fd.get('endDate') || '');

          if (statusVal === 'Terminado') {
            currP = totalP;
            if (!endD) endD = todayISO();
          }

          const bookData = {
            id: existingBook ? existingBook.id : generateId('bk'),
            title: String(fd.get('title')).trim(),
            author: String(fd.get('author')).trim(),
            modality: String(fd.get('modality')),
            status: statusVal,
            startDate: String(fd.get('startDate') || ''),
            endDate: endD,
            currentPage: currP,
            totalPages: totalP,
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

  container.querySelectorAll('[data-edit-book]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-book');
      const target = store.books.find(b => b.id === id);
      if (target) openBookForm(target);
    });
  });
}
