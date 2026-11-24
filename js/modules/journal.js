import { getStore, saveStore, generateId, todayISO, fileToDataUrl } from '../services/db.js?v=6.9.1';
import {
  uploadVoiceNoteToCloud,
  getVoiceNoteStreamUrl,
  deleteVoiceNoteFiles,
  purgeLegacyVoiceCache,
  pickSupportedAudioMime,
  formatDuration,
  formatBytes,
  getVoiceStorageStats
} from '../services/voiceNotes.js?v=1.2.0';
import { icon } from '../components/icons.js?v=1.5.0';
import { showToast } from '../components/toast.js?v=1.4.0';
import { buildUnifiedCalendarHTML } from '../components/calendar.js?v=2.6.0';
import {
  escapeHTML,
  stripHTML,
  sanitizeHTML,
  cleanPastedHTML,
  plainToHTML,
  toEditorHTML,
  normalizeText,
  countWords
} from '../utils/text.js?v=1.4.0';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

// Estado persistente del listado mientras navegas
const state = { query: '', selectedDate: '', calYear: null, calMonth: null };

/* ==========================================================================
   Utilidades
   ========================================================================== */
const pad = n => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parseISO(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

function formatLongDate(iso) {
  const s = parseISO(iso).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getEntries() {
  const store = getStore();
  return [...(store.journalEntries || [])].sort((a, b) => {
    const byDate = (b.date || '').localeCompare(a.date || '');
    return byDate !== 0 ? byDate : (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

const entryPlain = e => stripHTML(e.content || '');

function attachmentsOf(entry) {
  const list = Array.isArray(entry.attachments) ? [...entry.attachments] : [];
  if (entry.attachmentData) {
    list.push({ name: entry.attachmentName || 'adjunto', type: '', data: entry.attachmentData });
  }
  return list;
}

/** Resalta coincidencias (ignorando tildes y mayúsculas) */
function highlight(text, query) {
  const src = String(text || '').normalize('NFC');
  const q = normalizeText(String(query || '').trim());
  if (!q) return escapeHTML(src);
  const norm = normalizeText(src);
  if (norm.length !== src.length) return escapeHTML(src);

  let out = '';
  let i = 0;
  let idx;
  while ((idx = norm.indexOf(q, i)) !== -1) {
    out += escapeHTML(src.slice(i, idx));
    out += `<mark class="search-hit">${escapeHTML(src.slice(idx, idx + q.length))}</mark>`;
    i = idx + q.length;
  }
  return out + escapeHTML(src.slice(i));
}

/** Extracto centrado en la coincidencia de búsqueda */
function buildExcerpt(plain, query, len = 240) {
  const q = normalizeText(String(query || '').trim());
  let start = 0;
  if (q) {
    const idx = normalizeText(plain).indexOf(q);
    if (idx > 70) start = idx - 70;
  }
  let snippet = plain.slice(start, start + len);
  if (start > 0) snippet = '…' + snippet;
  if (start + len < plain.length) snippet += '…';
  return snippet;
}

function calcStreak(dateSet) {
  const d = new Date();
  let iso = toISO(d.getFullYear(), d.getMonth(), d.getDate());
  if (!dateSet.has(iso)) {
    d.setDate(d.getDate() - 1);
    iso = toISO(d.getFullYear(), d.getMonth(), d.getDate());
  }
  let streak = 0;
  while (dateSet.has(iso)) {
    streak++;
    d.setDate(d.getDate() - 1);
    iso = toISO(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return streak;
}

/** Comprime imágenes para no saturar el almacenamiento */
function compressImage(file, maxWidth = 1400, quality = 0.82) {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/') || /gif|svg/.test(file.type)) {
      fileToDataUrl(file).then(resolve);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      fileToDataUrl(file).then(resolve);
    };
    img.src = url;
  });
}

/* ==========================================================================
   Punto de entrada del módulo
   #/journal                 -> listado + buscador + calendario
   #/journal/new[/YYYY-MM-DD] -> editor nueva entrada
   #/journal/edit/:id        -> editor de entrada existente
   ========================================================================== */
export function renderJournal(container, params = []) {
  if (params[0] === 'new') {
    renderEditor(container, null, params[1] || '');
    return;
  }
  if (params[0] === 'edit' && params[1]) {
    const entry = (getStore().journalEntries || []).find(e => e.id === params[1]);
    if (entry) {
      renderEditor(container, entry);
      return;
    }
    showToast('Entrada no encontrada');
    window.location.hash = '#/journal';
    return;
  }
  renderList(container);
}

/* ==========================================================================
   LISTADO
   ========================================================================== */
function buildVoiceHudHTML(entries) {
  const stats = getVoiceStorageStats(entries);
  const barWidth = stats.totalBytes > 0 ? Math.max(1.5, stats.percent) : 0;
  const levelClass = stats.percent >= 90 ? 'is-critical' : stats.percent >= 70 ? 'is-warn' : '';
  const syncBadge = stats.totalCount === 0
    ? '<span class="vhud-badge">CLOUD VAULT // 5 GB</span>'
    : '<span class="vhud-badge is-synced">SOLO NUBE · SIN CACHÉ</span>';

  return `
    <section class="voice-storage-hud ${levelClass}" id="journal-voice-hud" aria-label="Nivel de memoria de notas de voz">
      <div class="vhud-top">
        <div class="vhud-title-wrap">
          <span class="vhud-tag">MEMORIA // AUDIO_VAULT</span>
          <span class="vhud-metrics mono">
            <strong>${formatBytes(stats.totalBytes)}</strong>
            <span class="vhud-sep">/</span>
            <span>5.00 GB</span>
            <span class="vhud-pct">(${stats.percent.toFixed(2)}%)</span>
          </span>
        </div>
        <div class="vhud-right">
          <span class="vhud-sub mono">${stats.totalCount} ${stats.totalCount === 1 ? 'audio' : 'audios'} · ${formatDuration(stats.totalDuration)}</span>
          ${syncBadge}
        </div>
      </div>
      <div class="vhud-bar-track" role="progressbar" aria-valuenow="${stats.percent.toFixed(2)}" aria-valuemin="0" aria-valuemax="100">
        <div class="vhud-bar-fill" style="width:${barWidth.toFixed(2)}%"></div>
      </div>
    </section>
  `;
}

function renderList(container) {
  const entries = getEntries();
  if (state.calYear === null) {
    const now = new Date();
    state.calYear = now.getFullYear();
    state.calMonth = now.getMonth();
  }

  const countsByDate = new Map();
  entries.forEach(e => countsByDate.set(e.date, (countsByDate.get(e.date) || 0) + 1));

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const thisMonth = entries.filter(e => (e.date || '').startsWith(monthPrefix)).length;
  const totalWords = entries.reduce((acc, e) => acc + countWords(entryPlain(e)), 0);
  const streak = calcStreak(new Set(countsByDate.keys()));

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <span class="page-eyebrow">BITÁCORA PERSONAL</span>
        <h1 class="page-title">Diario</h1>
        <p class="page-subtitle">Tu espacio privado de escritura, reflexión y memoria.</p>
      </div>
      <div class="page-actions">
        <a href="#/journal/new" class="btn btn-primary">${icon('plus')} Nueva Entrada</a>
      </div>
    </header>

    <div id="journal-voice-hud-slot">${buildVoiceHudHTML(entries)}</div>

    <div class="journal-layout">
      <div class="journal-main">
        <div class="journal-search">
          ${icon('search')}
          <input type="search" id="journal-search" class="journal-search-input"
            placeholder="Buscar por texto, título o etiqueta…"
            value="${escapeHTML(state.query)}" autocomplete="off" />
          <button type="button" class="journal-search-clear" id="journal-search-clear" aria-label="Limpiar búsqueda" ${state.query ? '' : 'hidden'}>
            ${icon('close')}
          </button>
        </div>
        <div id="journal-results"></div>
      </div>

      <aside class="journal-aside section-aside">
        <section class="card habit-calendar" id="journal-calendar" aria-label="Calendario de entradas"></section>
        <section class="card journal-stats">
          <div class="journal-stats-grid">
            <div class="jstat"><div class="jstat-value">${entries.length}</div><div class="jstat-label">Entradas</div></div>
            <div class="jstat"><div class="jstat-value">${thisMonth}</div><div class="jstat-label">Este mes</div></div>
            <div class="jstat"><div class="jstat-value">${streak}<small>d</small></div><div class="jstat-label">Racha</div></div>
            <div class="jstat"><div class="jstat-value">${totalWords.toLocaleString('es-ES')}</div><div class="jstat-label">Palabras</div></div>
          </div>
        </section>
      </aside>
    </div>
  `;

  const resultsNode = container.querySelector('#journal-results');
  const calNode = container.querySelector('#journal-calendar');
  const searchInput = container.querySelector('#journal-search');
  const clearBtn = container.querySelector('#journal-search-clear');

  const clearQuery = () => {
    state.query = '';
    searchInput.value = '';
    clearBtn.hidden = true;
    renderResults();
  };

  function renderResults() {
    const q = state.query.trim();
    const nq = normalizeText(q);

    let list = entries;
    if (state.selectedDate) list = list.filter(e => e.date === state.selectedDate);
    if (nq) {
      list = list.filter(e => {
        const voiceTxt = (e.voiceNotes || []).map(v => v.title || '').join(' ');
        return normalizeText(`${e.title || ''} ${entryPlain(e)} ${(e.tags || []).join(' ')} ${voiceTxt}`).includes(nq);
      });
    }

    if (entries.length === 0) {
      resultsNode.innerHTML = `
        <div class="card empty-state journal-empty">
          ${icon('journal')}
          <p>Tu diario está en blanco.</p>
          <a href="#/journal/new" class="btn btn-primary btn-sm">${icon('plus')} Escribir la primera entrada</a>
        </div>`;
      return;
    }

    let html = '';
    if (state.selectedDate || q) {
      html += `
        <div class="journal-filter-bar">
          <span class="mono">${list.length} ${list.length === 1 ? 'resultado' : 'resultados'}</span>
          ${state.selectedDate ? `
            <span class="filter-chip">${icon('calendar')} ${formatLongDate(state.selectedDate)}
              <button type="button" data-clear="date" aria-label="Quitar filtro de fecha">${icon('close')}</button>
            </span>` : ''}
          ${q ? `
            <span class="filter-chip">“${escapeHTML(q)}”
              <button type="button" data-clear="query" aria-label="Quitar búsqueda">${icon('close')}</button>
            </span>` : ''}
        </div>`;
    }

    if (list.length === 0) {
      html += `
        <div class="card empty-state">
          <p>No se encontraron entradas${q ? ` que contengan “${escapeHTML(q)}”` : ''}${state.selectedDate ? ' en esta fecha' : ''}.</p>
        </div>`;
    } else {
      let lastGroup = '';
      list.forEach(e => {
        const d = parseISO(e.date);
        const group = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        if (group !== lastGroup) {
          html += `<div class="journal-month-label">${group}</div>`;
          lastGroup = group;
        }
        const plain = entryPlain(e);
        const words = countWords(plain);
        const att = attachmentsOf(e).length;
        const voices = Array.isArray(e.voiceNotes) ? e.voiceNotes : [];
        const voiceSecs = voices.reduce((acc, v) => acc + (Number(v.duration) || 0), 0);
        const excerptHTML = plain
          ? highlight(buildExcerpt(plain, q), q)
          : voices.length
            ? `<span class="je-voice-only">${icon('waveform')} ${voices.length} ${voices.length === 1 ? 'nota de voz' : 'notas de voz'} (${formatDuration(voiceSecs)})</span>`
            : '<span class="text-muted">Entrada vacía</span>';

        html += `
          <a href="#/journal/edit/${encodeURIComponent(e.id)}" class="journal-entry-card">
            <div class="je-date">
              <span class="je-day mono">${pad(d.getDate())}</span>
              <span class="je-month mono">${MONTHS_SHORT[d.getMonth()]}</span>
              <span class="je-weekday">${WEEKDAYS_SHORT[d.getDay()]}</span>
            </div>
            <div class="je-body">
              <h3 class="je-title">${highlight(e.title || 'Sin título', q)}</h3>
              <p class="je-excerpt">${excerptHTML}</p>
              <div class="je-meta mono">
                <span>${words} ${words === 1 ? 'palabra' : 'palabras'}</span>
                ${voices.length ? `<span class="je-voice-pill">${icon('mic')} ${voices.length} · ${formatDuration(voiceSecs)}</span>` : ''}
                ${att ? `<span>${icon('paperclip')} ${att}</span>` : ''}
                ${(e.tags || []).map(t => `<span>#${highlight(t, q)}</span>`).join('')}
              </div>
            </div>
          </a>`;
      });
    }

    resultsNode.innerHTML = html;
    resultsNode.querySelectorAll('[data-clear]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.clear === 'date') {
          state.selectedDate = '';
          renderCalendar();
          renderResults();
        } else {
          clearQuery();
        }
      });
    });
  }

  function renderCalendar() {
    const todayIso = todayISO();
    const markedDates = new Map();
    countsByDate.forEach((count, iso) => {
      markedDates.set(iso, `${count} ${count === 1 ? 'entrada' : 'entradas'}`);
    });

    calNode.innerHTML = buildUnifiedCalendarHTML({
      year: state.calYear,
      month: state.calMonth,
      today: todayIso,
      selectedDate: state.selectedDate || todayIso,
      markedDates,
      footerLabel: 'Días con entradas',
      legendLabel: 'con entrada'
    });

    calNode.querySelectorAll('[data-ucal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-ucal');
        if (action === 'today') {
          const n = new Date();
          state.calYear = n.getFullYear();
          state.calMonth = n.getMonth();
        } else {
          const delta = action === 'prev' ? -1 : 1;
          const next = new Date(state.calYear, state.calMonth + delta, 1);
          state.calYear = next.getFullYear();
          state.calMonth = next.getMonth();
        }
        renderCalendar();
      });
    });

    calNode.querySelectorAll('[data-ucal-day]').forEach(btn => {
      btn.addEventListener('click', () => {
        const iso = btn.getAttribute('data-ucal-day');
        if ((countsByDate.get(iso) || 0) > 0) {
          state.selectedDate = state.selectedDate === iso ? '' : iso;
          renderCalendar();
          renderResults();
        } else {
          window.location.hash = `#/journal/new/${iso}`;
        }
      });
    });
  }

  searchInput.addEventListener('input', () => {
    state.query = searchInput.value;
    clearBtn.hidden = !state.query;
    renderResults();
  });
  clearBtn.addEventListener('click', () => {
    clearQuery();
    searchInput.focus();
  });

  renderResults();
  renderCalendar();
  purgeLegacyVoiceCache();
}

/* ==========================================================================
   EDITOR DE PÁGINA COMPLETA (tipo procesador de texto)
   ========================================================================== */
function renderEditor(container, existing = null, presetDate = '') {
  let currentId = existing ? existing.id : null;
  const createdAt = existing?.createdAt || new Date().toISOString();
  let draftKey = `darkness_journal_draft_${currentId || 'new'}`;
  let attachments = existing ? attachmentsOf(existing) : [];
  let voiceNotes = Array.isArray(existing?.voiceNotes) ? existing.voiceNotes.map(v => ({ ...v })) : [];
  let dirty = false;
  let savedRange = null;
  let draftTimer = null;

  const validPreset = /^\d{4}-\d{2}-\d{2}$/.test(presetDate) ? presetDate : '';
  let initial = {
    date: existing?.date || validPreset || todayISO(),
    title: existing?.title || '',
    content: existing ? toEditorHTML(existing.content) : '<p><br></p>',
    tags: existing?.tags || []
  };

  // Restaurar borrador automático si existe y es más reciente
  let restoredDraft = false;
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
    if (draft && (!existing || (draft.savedAt || '') > (existing.updatedAt || ''))) {
      initial = {
        date: (!existing && validPreset) ? validPreset : (draft.date || initial.date),
        title: draft.title ?? initial.title,
        content: draft.content || initial.content,
        tags: Array.isArray(draft.tags) ? draft.tags : initial.tags
      };
      if (Array.isArray(draft.voiceNotes)) {
        voiceNotes = draft.voiceNotes.map(v => ({ ...v, uploading: false }));
      }
      restoredDraft = true;
    }
  } catch { /* borrador corrupto: se ignora */ }

  const tb = (cmd, ic, title, value = '') => `
    <button type="button" class="tb-btn" data-cmd="${cmd}" ${value ? `data-value="${value}"` : ''} title="${title}" aria-label="${title}">
      ${icon(ic)}
    </button>`;
  const tbAction = (action, ic, title) => `
    <button type="button" class="tb-btn" data-action="${action}" title="${title}" aria-label="${title}">
      ${icon(ic)}
    </button>`;
  const sep = '<span class="tb-sep" aria-hidden="true"></span>';

  container.innerHTML = `
    <div class="journal-editor-page">
      <div class="editor-topbar">
        <a href="#/journal" class="btn btn-ghost btn-sm" id="editor-back">${icon('arrowLeft')} Diario</a>
        <div class="editor-status" id="editor-status">
          <span class="dot"></span><span id="editor-status-text">${existing ? 'Sin cambios' : 'Nueva entrada'}</span>
        </div>
        <div class="editor-top-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="editor-discard" ${restoredDraft ? '' : 'hidden'}>Descartar borrador</button>
          <button type="button" class="btn-icon" id="editor-focus" title="Modo enfoque" aria-label="Modo enfoque">${icon('maximize')}</button>
          <button type="button" class="btn-icon" id="editor-delete" title="Eliminar entrada" aria-label="Eliminar entrada" ${currentId ? '' : 'hidden'}>${icon('trash')}</button>
          <button type="button" class="btn btn-primary btn-sm" id="editor-save">${icon('check')} Guardar</button>
        </div>
      </div>

      <article class="editor-sheet">
        <div class="editor-head">
          <div class="editor-meta">
            <input type="date" id="editor-date" class="editor-date-input" value="${initial.date}" aria-label="Fecha de la entrada" />
            <span class="editor-date-long" id="editor-date-long">${formatLongDate(initial.date)}</span>
          </div>
          <input type="text" id="editor-title" class="editor-title-input" placeholder="Título de la entrada"
            value="${escapeHTML(initial.title)}" maxlength="160" aria-label="Título" />
        </div>

        <div class="editor-toolbar" id="editor-toolbar" role="toolbar" aria-label="Formato de texto">
          ${tb('undo', 'undo', 'Deshacer (Ctrl+Z)')}
          ${tb('redo', 'redo', 'Rehacer (Ctrl+Y)')}
          ${sep}
          <select class="tb-select" id="tb-block" title="Estilo de párrafo" aria-label="Estilo de párrafo">
            <option value="p">Párrafo</option>
            <option value="h1">Título 1</option>
            <option value="h2">Título 2</option>
            <option value="h3">Título 3</option>
            <option value="blockquote">Cita</option>
            <option value="pre">Código</option>
          </select>
          <select class="tb-select" id="tb-font" title="Fuente" aria-label="Fuente">
            <option value="">Fuente</option>
            <option value="Plus Jakarta Sans">Sans</option>
            <option value="Newsreader">Serif</option>
            <option value="IBM Plex Mono">Mono</option>
          </select>
          <select class="tb-select" id="tb-size" title="Tamaño" aria-label="Tamaño de texto">
            <option value="">Tamaño</option>
            <option value="2">Pequeño</option>
            <option value="3">Normal</option>
            <option value="4">Mediano</option>
            <option value="5">Grande</option>
            <option value="6">Muy grande</option>
          </select>
          ${sep}
          ${tb('bold', 'bold', 'Negrita (Ctrl+B)')}
          ${tb('italic', 'italic', 'Cursiva (Ctrl+I)')}
          ${tb('underline', 'underline', 'Subrayado (Ctrl+U)')}
          ${tb('strikeThrough', 'strike', 'Tachado')}
          ${sep}
          <label class="tb-btn tb-color" title="Color de texto">
            ${icon('type')}<span class="swatch" id="sw-fore"></span>
            <input type="color" id="tb-forecolor" value="#9ca3af" aria-label="Color de texto" />
          </label>
          <label class="tb-btn tb-color" title="Resaltar texto">
            ${icon('highlighter')}<span class="swatch" id="sw-hilite"></span>
            <input type="color" id="tb-hilitecolor" value="#52525b" aria-label="Color de resaltado" />
          </label>
          ${sep}
          ${tb('insertUnorderedList', 'list', 'Lista con viñetas')}
          ${tb('insertOrderedList', 'listOrdered', 'Lista numerada')}
          ${tb('outdent', 'outdent', 'Reducir sangría')}
          ${tb('indent', 'indent', 'Aumentar sangría')}
          ${sep}
          ${tb('justifyLeft', 'alignLeft', 'Alinear a la izquierda')}
          ${tb('justifyCenter', 'alignCenter', 'Centrar')}
          ${tb('justifyRight', 'alignRight', 'Alinear a la derecha')}
          ${tb('justifyFull', 'alignJustify', 'Justificar')}
          ${sep}
          ${tbAction('link', 'link', 'Insertar enlace')}
          ${tbAction('image', 'image', 'Insertar imagen')}
          ${tbAction('table', 'table', 'Insertar tabla')}
          ${tb('insertHorizontalRule', 'minus', 'Línea divisoria')}
          ${sep}
          ${tb('removeFormat', 'eraser', 'Limpiar formato')}
          <input type="file" id="tb-image-input" accept="image/*" hidden />
        </div>

        <div id="editor-body" class="editor-body prose" contenteditable="true" spellcheck="true"
          data-placeholder="Empieza a escribir…" aria-label="Contenido de la entrada"></div>

        <section class="voice-cyber-deck" id="voice-cyber-deck" aria-label="Notas de voz">
          <div class="vdeck-header">
            <div class="vdeck-title-group">
              <span class="vdeck-eyebrow mono">AUDIO_REC // BITÁCORA VOCAL</span>
              <span class="vdeck-count mono" id="vdeck-count">0 pistas</span>
            </div>
            <div class="vdeck-controls" id="vdeck-controls">
              <button type="button" class="btn-voice-rec" id="btn-voice-rec">
                ${icon('mic')} <span>GRABAR VOZ</span>
              </button>
              <button type="button" class="btn-voice-stop" id="btn-voice-stop" hidden>
                ${icon('stop')} <span>DETENER</span>
              </button>
              <button type="button" class="btn btn-ghost btn-sm" id="btn-voice-cancel" hidden>
                ${icon('close')} Cancelar
              </button>
            </div>
          </div>

          <div class="vdeck-live" id="vdeck-live" hidden>
            <div class="vdeck-rec-badge mono">
              <span class="vdeck-rec-dot"></span>
              <span>REC</span>
              <span id="vdeck-timer">00:00</span>
            </div>
            <div class="vdeck-spectrum" id="vdeck-spectrum" aria-hidden="true">
              ${'<span></span>'.repeat(20)}
            </div>
          </div>

          <div class="vdeck-list" id="vdeck-list"></div>
        </section>

        <div class="editor-extras">
          <div class="form-group" style="margin:0;">
            <label class="form-label" for="editor-tags">Etiquetas (separadas por coma)</label>
            <input type="text" id="editor-tags" class="form-input" placeholder="ideas, gratitud, trabajo"
              value="${escapeHTML(initial.tags.join(', '))}" />
          </div>
          <div class="form-group" style="margin:0;">
            <span class="form-label">Archivos adjuntos</span>
            <div class="editor-attach-row">
              <label class="btn btn-secondary btn-sm">
                ${icon('paperclip')} Adjuntar
                <input type="file" id="editor-attach" multiple hidden />
              </label>
              <div class="attachment-list" id="editor-attachments"></div>
            </div>
          </div>
        </div>

        <div class="editor-statusbar mono">
          <span id="editor-counts">0 palabras</span>
          <span class="editor-hint">Ctrl+S guardar · Ctrl+clic abre enlaces</span>
        </div>
      </article>
    </div>
  `;

  const shell = document.getElementById('app-shell');
  const editor = container.querySelector('#editor-body');
  const titleInput = container.querySelector('#editor-title');
  const dateInput = container.querySelector('#editor-date');
  const dateLong = container.querySelector('#editor-date-long');
  const tagsInput = container.querySelector('#editor-tags');
  const statusEl = container.querySelector('#editor-status');
  const statusText = container.querySelector('#editor-status-text');
  const toolbar = container.querySelector('#editor-toolbar');
  const countsEl = container.querySelector('#editor-counts');
  const attachList = container.querySelector('#editor-attachments');
  const blockSelect = container.querySelector('#tb-block');
  const fontSelect = container.querySelector('#tb-font');
  const sizeSelect = container.querySelector('#tb-size');
  const foreInput = container.querySelector('#tb-forecolor');
  const hiliteInput = container.querySelector('#tb-hilitecolor');
  const imageInput = container.querySelector('#tb-image-input');
  const deleteBtn = container.querySelector('#editor-delete');
  const discardBtn = container.querySelector('#editor-discard');
  const focusBtn = container.querySelector('#editor-focus');

  editor.innerHTML = sanitizeHTML(initial.content) || '<p><br></p>';
  container.querySelector('#sw-fore').style.background = foreInput.value;
  container.querySelector('#sw-hilite').style.background = hiliteInput.value;

  try {
    document.execCommand('defaultParagraphSeparator', false, 'p');
    document.execCommand('styleWithCSS', false, true);
  } catch { /* navegadores sin soporte */ }

  /* ---------- Selección y comandos ---------- */
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    editor.focus({ preventScroll: true });
    if (savedRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
  };

  const STATE_CMDS = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList',
    'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'];

  const updateToolbarState = () => {
    STATE_CMDS.forEach(cmd => {
      const btn = toolbar.querySelector(`[data-cmd="${cmd}"]`);
      try { btn?.classList.toggle('active', document.queryCommandState(cmd)); } catch { /* noop */ }
    });
    try {
      const block = String(document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, '');
      blockSelect.value = ['h1', 'h2', 'h3', 'blockquote', 'pre'].includes(block) ? block : 'p';
    } catch { /* noop */ }
  };

  const exec = (cmd, value = null) => {
    restoreSelection();
    document.execCommand(cmd, false, value);
    saveSelection();
    onChange();
    updateToolbarState();
  };

  /* ---------- Estado, conteo y borrador ---------- */
  const setStatus = (kind, text) => {
    statusEl.className = `editor-status ${kind}`;
    statusText.textContent = text;
  };

  const parseTags = () => tagsInput.value
    .split(',')
    .map(t => t.trim().replace(/^#/, ''))
    .filter(Boolean);

  const updateCounts = () => {
    const plain = (editor.innerText || '').trim();
    const words = countWords(plain);
    const mins = Math.max(1, Math.ceil(words / 200));
    countsEl.textContent = `${words} ${words === 1 ? 'palabra' : 'palabras'} · ${plain.length} caracteres · ${mins} min de lectura`;
    editor.classList.toggle('is-empty', !plain && !editor.querySelector('img,table,hr'));
  };

  const writeDraft = () => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        date: dateInput.value,
        title: titleInput.value,
        content: editor.innerHTML,
        tags: parseTags(),
        voiceNotes,
        savedAt: new Date().toISOString()
      }));
    } catch { /* sin espacio para borrador */ }
  };

  function onChange() {
    dirty = true;
    setStatus('dirty', 'Cambios sin guardar');
    updateCounts();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(writeDraft, 700);
  }

  /* ---------- Notas de voz (Cyberpunk Audio Deck) ---------- */
  const vCountEl = container.querySelector('#vdeck-count');
  const vListEl = container.querySelector('#vdeck-list');
  const vRecBtn = container.querySelector('#btn-voice-rec');
  const vStopBtn = container.querySelector('#btn-voice-stop');
  const vCancelBtn = container.querySelector('#btn-voice-cancel');
  const vLiveEl = container.querySelector('#vdeck-live');
  const vTimerEl = container.querySelector('#vdeck-timer');
  const vSpectrumBars = [...container.querySelectorAll('#vdeck-spectrum span')];

  let mediaRecorder = null;
  let recStream = null;
  let recChunks = [];
  let recStartMs = 0;
  let recTimerId = null;
  let recCancelled = false;
  let audioCtx = null;
  let analyser = null;
  let rafId = null;

  let activeAudio = null;
  let activeAudioUrl = '';
  let activePlayingId = null;

  const stopRecordingResources = () => {
    clearInterval(recTimerId);
    recTimerId = null;
    cancelAnimationFrame(rafId);
    rafId = null;
    if (recStream) {
      recStream.getTracks().forEach(t => t.stop());
      recStream = null;
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
      analyser = null;
    }
    vSpectrumBars.forEach(b => { b.style.height = '18%'; });
    vRecBtn.hidden = false;
    vStopBtn.hidden = true;
    vCancelBtn.hidden = true;
    vLiveEl.hidden = true;
  };

  const stopActivePlayback = () => {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.src = '';
      activeAudio = null;
    }
    if (activeAudioUrl) {
      URL.revokeObjectURL(activeAudioUrl);
      activeAudioUrl = '';
    }
    activePlayingId = null;
  };

  const renderVoiceNotes = () => {
    const totalDur = voiceNotes.reduce((acc, v) => acc + (Number(v.duration) || 0), 0);
    vCountEl.textContent = voiceNotes.length
      ? `${voiceNotes.length} ${voiceNotes.length === 1 ? 'pista' : 'pistas'} · ${formatDuration(totalDur)}`
      : '0 pistas';

    if (!voiceNotes.length) {
      vListEl.innerHTML = '<div class="vdeck-empty mono">SIN REGISTROS DE VOZ // PULSA «GRABAR VOZ» PARA CAPTURAR</div>';
      return;
    }

    vListEl.innerHTML = voiceNotes.map((vn, i) => {
      const isPlaying = activePlayingId === vn.id && activeAudio && !activeAudio.paused;
      const syncTag = vn.uploading
        ? '<span class="vnote-badge is-uploading">SUBIENDO…</span>'
        : vn.synced && vn.storagePath
          ? '<span class="vnote-badge is-cloud">CLOUD</span>'
          : '<span class="vnote-badge is-local">LOCAL</span>';

      return `
        <div class="vnote-item ${isPlaying ? 'is-playing' : ''}" data-vn-id="${escapeHTML(vn.id)}">
          <button type="button" class="vnote-play-btn" data-vn-play="${i}" aria-label="${isPlaying ? 'Pausar' : 'Reproducir'} nota de voz">
            ${icon(isPlaying ? 'pause' : 'play')}
          </button>
          <div class="vnote-body">
            <div class="vnote-top">
              <input type="text" class="vnote-title-input" data-vn-title="${i}" value="${escapeHTML(vn.title || `Nota de voz #${i + 1}`)}" maxlength="80" aria-label="Nombre de nota de voz" />
              <div class="vnote-badges mono">
                <span class="vnote-size">${formatBytes(vn.size || 0)}</span>
                ${syncTag}
              </div>
            </div>
            <div class="vnote-progress-row">
              <input type="range" class="vnote-seek" data-vn-seek="${i}" min="0" max="${Math.max(1, Math.round(vn.duration || 1))}" value="0" step="0.1" aria-label="Progreso de audio" />
              <span class="vnote-time mono" data-vn-time="${i}">00:00 / ${formatDuration(vn.duration || 0)}</span>
            </div>
          </div>
          <button type="button" class="vnote-del-btn" data-vn-del="${i}" title="Eliminar audio" aria-label="Eliminar nota de voz">
            ${icon('trash')}
          </button>
        </div>
      `;
    }).join('');

    vListEl.querySelectorAll('[data-vn-title]').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = Number(inp.dataset.vnTitle);
        if (voiceNotes[idx]) {
          voiceNotes[idx].title = inp.value.trim() || `Nota de voz #${idx + 1}`;
          onChange();
        }
      });
    });

    vListEl.querySelectorAll('[data-vn-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.dataset.vnDel);
        const target = voiceNotes[idx];
        if (!target) return;
        if (!window.confirm(`¿Eliminar "${target.title || 'esta nota de voz'}" permanentemente?`)) return;
        if (activePlayingId === target.id) stopActivePlayback();
        voiceNotes.splice(idx, 1);
        renderVoiceNotes();
        onChange();
        await deleteVoiceNoteFiles(target);
        showToast('Nota de voz eliminada');
      });
    });

    vListEl.querySelectorAll('[data-vn-play]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.dataset.vnPlay);
        const vn = voiceNotes[idx];
        if (!vn) return;
        const row = vListEl.querySelector(`[data-vn-id="${CSS.escape(vn.id)}"]`);
        const seekEl = row?.querySelector('[data-vn-seek]');
        const timeEl = row?.querySelector('[data-vn-time]');

        if (activePlayingId === vn.id && activeAudio) {
          if (activeAudio.paused) {
            await activeAudio.play().catch(() => {});
            btn.innerHTML = icon('pause');
            row?.classList.add('is-playing');
          } else {
            activeAudio.pause();
            btn.innerHTML = icon('play');
            row?.classList.remove('is-playing');
          }
          return;
        }

        stopActivePlayback();
        vListEl.querySelectorAll('.vnote-item').forEach(el => {
          el.classList.remove('is-playing');
          const pBtn = el.querySelector('.vnote-play-btn');
          if (pBtn) pBtn.innerHTML = icon('play');
        });

        btn.disabled = true;
        btn.classList.add('is-loading');
        try {
          const src = await getVoiceNoteStreamUrl(vn);
          const audio = new Audio(src);
          audio.preload = 'auto';
          activeAudio = audio;
          activePlayingId = vn.id;

          audio.addEventListener('loadedmetadata', () => {
            const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (vn.duration || 1);
            if (seekEl) seekEl.max = String(dur);
          });

          audio.addEventListener('timeupdate', () => {
            const cur = audio.currentTime || 0;
            const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (vn.duration || 0);
            if (seekEl) {
              seekEl.max = String(Math.max(1, dur));
              seekEl.value = String(cur);
            }
            if (timeEl) timeEl.textContent = `${formatDuration(cur)} / ${formatDuration(dur)}`;
          });

          audio.addEventListener('ended', () => {
            stopActivePlayback();
            btn.innerHTML = icon('play');
            row?.classList.remove('is-playing');
            if (seekEl) seekEl.value = '0';
            if (timeEl) timeEl.textContent = `00:00 / ${formatDuration(vn.duration || 0)}`;
          });

          audio.addEventListener('error', () => {
            stopActivePlayback();
            btn.innerHTML = icon('play');
            row?.classList.remove('is-playing');
            showToast('Error al reproducir el audio desde Firebase Storage');
          });

          if (seekEl) {
            seekEl.oninput = () => {
              if (activeAudio === audio) audio.currentTime = Number(seekEl.value) || 0;
            };
          }

          await audio.play();
          btn.innerHTML = icon('pause');
          row?.classList.add('is-playing');
        } catch (err) {
          console.error('Error reproduciendo nota de voz:', err);
          stopActivePlayback();
          showToast(err?.message || 'No se pudo reproducir el audio');
        } finally {
          btn.disabled = false;
          btn.classList.remove('is-loading');
        }
      });
    });
  };

  vRecBtn.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      showToast('Tu navegador no soporta grabación de audio');
      return;
    }

    try {
      recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      showToast('Permiso de micrófono denegado');
      return;
    }

    const mimeType = pickSupportedAudioMime();
    try {
      mediaRecorder = mimeType
        ? new MediaRecorder(recStream, { mimeType, audioBitsPerSecond: 48000 })
        : new MediaRecorder(recStream);
    } catch {
      mediaRecorder = new MediaRecorder(recStream);
    }

    recChunks = [];
    recCancelled = false;
    recStartMs = Date.now();
    vTimerEl.textContent = '00:00';
    vRecBtn.hidden = true;
    vStopBtn.hidden = false;
    vCancelBtn.hidden = false;
    vLiveEl.hidden = false;

    // Visualizador de espectro en tiempo real
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        const src = audioCtx.createMediaStreamSource(recStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(data);
          vSpectrumBars.forEach((bar, idx) => {
            const val = data[idx % data.length] || 0;
            const pct = Math.max(14, Math.min(100, Math.round((val / 255) * 100)));
            bar.style.height = `${pct}%`;
          });
          rafId = requestAnimationFrame(tick);
        };
        tick();
      }
    } catch { /* fallback sin analyser */ }

    recTimerId = setInterval(() => {
      vTimerEl.textContent = formatDuration((Date.now() - recStartMs) / 1000);
    }, 250);

    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) recChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const duration = Math.max(1, Math.round((Date.now() - recStartMs) / 1000));
      const finalMime = mediaRecorder?.mimeType || mimeType || 'audio/webm';
      const chunks = [...recChunks];
      stopRecordingResources();
      if (recCancelled || !chunks.length) return;

      const blob = new Blob(chunks, { type: finalMime });
      const timeLabel = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const note = {
        id: generateId('vn'),
        title: `REC ${timeLabel}`,
        duration,
        size: blob.size,
        mimeType: finalMime,
        createdAt: new Date().toISOString(),
        storagePath: '',
        synced: false,
        uploading: true
      };

      voiceNotes.push(note);
      renderVoiceNotes();

      const cloud = await uploadVoiceNoteToCloud(note, blob);
      note.uploading = false;
      if (cloud.ok) {
        note.storagePath = cloud.storagePath;
        note.synced = true;
        onChange();
        showToast('Audio guardado en Firebase Storage');
      } else {
        const idx = voiceNotes.indexOf(note);
        if (idx >= 0) voiceNotes.splice(idx, 1);
        showToast('No se pudo subir a la nube (sin caché local). Verifica tu sesión o conexión.');
      }
      if (document.body.contains(vListEl)) renderVoiceNotes();
      writeDraft();
    };

    mediaRecorder.start(250);
  });

  vStopBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  });

  vCancelBtn.addEventListener('click', () => {
    recCancelled = true;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    } else {
      stopRecordingResources();
    }
    showToast('Grabación cancelada');
  });

  /* ---------- Adjuntos ---------- */
  const renderAttachments = () => {
    attachList.innerHTML = attachments.length
      ? attachments.map((a, i) => `
          <span class="attachment-chip">
            ${icon('paperclip')}
            <a href="${a.data}" download="${escapeHTML(a.name)}" title="${escapeHTML(a.name)}">${escapeHTML(a.name)}</a>
            <button type="button" data-remove-att="${i}" aria-label="Quitar adjunto">${icon('close')}</button>
          </span>`).join('')
      : '<span class="text-muted" style="font-size:0.72rem;">Sin adjuntos</span>';

    attachList.querySelectorAll('[data-remove-att]').forEach(btn => {
      btn.addEventListener('click', () => {
        attachments.splice(Number(btn.dataset.removeAtt), 1);
        renderAttachments();
        onChange();
      });
    });
  };

  /* ---------- Guardar / eliminar ---------- */
  function save() {
    clearTimeout(draftTimer);
    const content = sanitizeHTML(editor.innerHTML);
    const plain = stripHTML(content);
    const now = new Date().toISOString();
    const cleanVoices = voiceNotes.map(({ uploading, ...rest }) => rest);
    const record = {
      id: currentId || generateId('jr'),
      date: dateInput.value || todayISO(),
      title: titleInput.value.trim() || plain.slice(0, 60) || (cleanVoices.length ? 'Nota de voz' : 'Sin título'),
      content,
      tags: parseTags(),
      attachments,
      voiceNotes: cleanVoices,
      createdAt,
      updatedAt: now
    };

    const store = getStore();
    if (!Array.isArray(store.journalEntries)) store.journalEntries = [];
    const idx = store.journalEntries.findIndex(e => e.id === record.id);
    if (idx >= 0) store.journalEntries[idx] = record;
    else store.journalEntries.unshift(record);

    try {
      saveStore(store);
    } catch (err) {
      console.error(err);
      showToast('No se pudo guardar: almacenamiento local lleno. Reduce imágenes o conecta Supabase.');
      return false;
    }

    localStorage.removeItem(draftKey);
    if (!currentId) {
      currentId = record.id;
      draftKey = `darkness_journal_draft_${currentId}`;
      history.replaceState(null, '', `#/journal/edit/${encodeURIComponent(currentId)}`);
      deleteBtn.hidden = false;
    }
    if (!titleInput.value.trim()) titleInput.value = record.title;

    dirty = false;
    discardBtn.hidden = true;
    const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    setStatus('saved', `Guardado a las ${time}`);
    showToast('Entrada guardada');
    return true;
  }

  /* ---------- Eventos ---------- */
  editor.addEventListener('input', onChange);
  titleInput.addEventListener('input', onChange);
  tagsInput.addEventListener('input', onChange);
  dateInput.addEventListener('change', () => {
    if (dateInput.value) dateLong.textContent = formatLongDate(dateInput.value);
    onChange();
  });

  titleInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editor.focus();
    }
  });

  // Mantener selección y estado de la barra
  const onSelectionChange = () => {
    if (!document.body.contains(editor)) {
      document.removeEventListener('selectionchange', onSelectionChange);
      return;
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      saveSelection();
      updateToolbarState();
    }
  };
  document.addEventListener('selectionchange', onSelectionChange);

  // Tabulación en listas y texto
  editor.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const inList = document.queryCommandState('insertUnorderedList') || document.queryCommandState('insertOrderedList');
    if (inList) exec(e.shiftKey ? 'outdent' : 'indent');
    else if (!e.shiftKey) exec('insertHTML', '&emsp;');
  });

  // Ctrl/Cmd + clic abre enlaces
  editor.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (link && (e.ctrlKey || e.metaKey) && link.href) {
      window.open(link.href, '_blank', 'noopener');
    }
  });

  // Pegado limpio (conserva estructura, elimina estilos ajenos al tema)
  editor.addEventListener('paste', async e => {
    const cd = e.clipboardData;
    if (!cd) return;
    saveSelection();
    const imageFile = [...(cd.files || [])].find(f => f.type.startsWith('image/'));
    if (imageFile) {
      e.preventDefault();
      exec('insertImage', await compressImage(imageFile));
      return;
    }
    const html = cd.getData('text/html');
    const text = cd.getData('text/plain');
    e.preventDefault();
    if (html) exec('insertHTML', cleanPastedHTML(html));
    else if (/\n/.test(text)) exec('insertHTML', plainToHTML(text));
    else exec('insertText', text);
  });

  // Barra de herramientas
  toolbar.querySelectorAll('button.tb-btn').forEach(btn => {
    btn.addEventListener('mousedown', e => e.preventDefault());
  });

  toolbar.addEventListener('click', e => {
    const btn = e.target.closest('button.tb-btn');
    if (!btn) return;
    const { cmd, action, value } = btn.dataset;

    if (cmd) {
      exec(cmd, value || null);
      return;
    }

    if (action === 'link') {
      const url = window.prompt('Dirección del enlace (URL):', 'https://');
      if (!url || url.trim() === 'https://') return;
      const safe = /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      restoreSelection();
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) exec('createLink', safe);
      else exec('insertHTML', `<a href="${escapeHTML(safe)}">${escapeHTML(url.trim())}</a>&nbsp;`);
    } else if (action === 'image') {
      imageInput.click();
    } else if (action === 'table') {
      const row = `<tr>${'<td><br></td>'.repeat(3)}</tr>`;
      exec('insertHTML', `<table><tbody>${row.repeat(3)}</tbody></table><p><br></p>`);
    }
  });

  blockSelect.addEventListener('change', () => exec('formatBlock', `<${blockSelect.value}>`));

  fontSelect.addEventListener('change', () => {
    if (fontSelect.value) exec('fontName', fontSelect.value);
    fontSelect.value = '';
  });

  sizeSelect.addEventListener('change', () => {
    if (sizeSelect.value) exec('fontSize', sizeSelect.value);
    sizeSelect.value = '';
  });

  foreInput.addEventListener('change', () => {
    container.querySelector('#sw-fore').style.background = foreInput.value;
    exec('foreColor', foreInput.value);
  });

  hiliteInput.addEventListener('change', () => {
    container.querySelector('#sw-hilite').style.background = hiliteInput.value;
    restoreSelection();
    const ok = document.execCommand('hiliteColor', false, hiliteInput.value);
    if (!ok) document.execCommand('backColor', false, hiliteInput.value);
    saveSelection();
    onChange();
  });

  imageInput.addEventListener('change', async () => {
    const file = imageInput.files?.[0];
    imageInput.value = '';
    if (!file) return;
    exec('insertImage', await compressImage(file));
  });

  container.querySelector('#editor-attach').addEventListener('change', async e => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    for (const file of files) {
      if (!file.type.startsWith('image/') && file.size > MAX_ATTACHMENT_BYTES) {
        showToast(`"${file.name}" supera 3 MB (límite del almacenamiento local)`);
        continue;
      }
      const data = file.type.startsWith('image/') ? await compressImage(file) : await fileToDataUrl(file);
      attachments.push({ name: file.name, type: file.type, data });
    }
    renderAttachments();
    if (files.length) onChange();
  });

  // Acciones superiores
  container.querySelector('#editor-save').addEventListener('click', save);

  container.querySelector('#editor-back').addEventListener('click', e => {
    if (!dirty) return;
    e.preventDefault();
    if (window.confirm('Tienes cambios sin guardar. ¿Guardarlos antes de salir?\n(Si cancelas se conservará como borrador)')) {
      if (save()) window.location.hash = '#/journal';
    } else {
      writeDraft();
      window.location.hash = '#/journal';
    }
  });

  deleteBtn.addEventListener('click', () => {
    if (!currentId || !window.confirm('¿Eliminar esta entrada de forma permanente?')) return;
    stopActivePlayback();
    voiceNotes.forEach(vn => deleteVoiceNoteFiles(vn));
    const store = getStore();
    store.journalEntries = (store.journalEntries || []).filter(x => x.id !== currentId);
    saveStore(store);
    localStorage.removeItem(draftKey);
    dirty = false;
    showToast('Entrada eliminada');
    window.location.hash = '#/journal';
  });

  discardBtn.addEventListener('click', () => {
    localStorage.removeItem(draftKey);
    renderEditor(container, existing, presetDate);
    showToast('Borrador descartado');
  });

  focusBtn.addEventListener('click', () => {
    shell?.classList.toggle('focus-mode');
    focusBtn.classList.toggle('active', shell?.classList.contains('focus-mode'));
  });

  // Atajo Ctrl/Cmd + S (un solo listener global activo)
  if (window._journalKeyHandler) document.removeEventListener('keydown', window._journalKeyHandler);
  window._journalKeyHandler = e => {
    if (!document.body.contains(editor)) {
      document.removeEventListener('keydown', window._journalKeyHandler);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  };
  document.addEventListener('keydown', window._journalKeyHandler);

  // Limpiar recursos de audio/micrófono si el usuario navega fuera del editor
  const onRouteLeave = () => {
    if (!document.body.contains(editor)) {
      stopActivePlayback();
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        recCancelled = true;
        mediaRecorder.stop();
      } else {
        stopRecordingResources();
      }
      window.removeEventListener('hashchange', onRouteLeave);
    }
  };
  window.addEventListener('hashchange', onRouteLeave);

  /* ---------- Inicialización ---------- */
  renderAttachments();
  renderVoiceNotes();
  updateCounts();
  if (restoredDraft) {
    dirty = true;
    setStatus('dirty', 'Borrador restaurado sin guardar');
  }
  if (!existing && window.matchMedia('(min-width: 769px)').matches) {
    titleInput.focus();
  }
}
