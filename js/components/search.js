import { getStore } from '../services/db.js?v=6.9.0';
import { icon } from './icons.js?v=3.3.0';
import { hudFrameOrnaments } from './hudFrame.js?v=1.0.0';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

function buildSearchItems(navItems) {
  const store = getStore();
  const items = [];

  // 1. Vistas de navegación
  navItems.forEach((nav) => {
    items.push({
      group: 'Navegación',
      icon: nav.icon,
      title: nav.label,
      sub: `#${nav.path}`,
      badge: 'Ir a',
      keywords: `${nav.label} ${nav.shortLabel} ${nav.path}`,
      action: () => {
        window.location.hash = `#${nav.path}`;
      }
    });
  });

  // 2. Comandos rápidos del sistema
  items.push({
    group: 'Sistema',
    icon: 'sun',
    title: 'Cambiar tema (Claro / Oscuro)',
    sub: 'Alternar apariencia visual de Darkness',
    badge: 'Comando',
    keywords: 'tema oscuro claro dark light modo apariencia',
    action: () => window.toggleDarknessTheme?.()
  });

  items.push({
    group: 'Sistema',
    icon: 'lock',
    title: 'Bloquear terminal',
    sub: 'Cerrar sesión activa y volver al PIN',
    badge: 'Seguridad',
    keywords: 'bloquear candado pin seguridad cerrar sesion lock',
    action: () => window.lockDarknessApp?.()
  });

  // 3. Hábitos
  (store.habits || []).forEach((h) => {
    items.push({
      group: 'Hábitos',
      icon: 'habits',
      title: h.name || 'Hábito sin nombre',
      sub: h.category ? `Categoría: ${h.category}` : 'Seguimiento diario',
      badge: 'Hábito',
      keywords: `${h.name || ''} ${h.category || ''}`,
      action: () => {
        window.location.hash = '#/habits';
      }
    });
  });

  // 4. Tareas
  (store.tasks || []).forEach((t) => {
    const title = t.title || t.text || 'Tarea';
    items.push({
      group: 'Tareas',
      icon: 'list',
      title,
      sub: t.completed ? 'Completada' : (t.dueDate ? `Fecha: ${t.dueDate}` : 'Pendiente'),
      badge: t.priority || 'Tarea',
      keywords: `${title} ${t.notes || ''} ${t.priority || ''}`,
      action: () => {
        window.location.hash = '#/tasks';
      }
    });
  });

  // 5. Lectura / Biblioteca
  (store.books || []).forEach((b) => {
    items.push({
      group: 'Lectura',
      icon: 'reading',
      title: b.title || 'Libro',
      sub: [b.author, b.modality, b.status].filter(Boolean).join(' · '),
      badge: b.status || 'Libro',
      keywords: `${b.title || ''} ${b.author || ''} ${b.modality || ''} ${b.status || ''} ${b.comments || ''}`,
      action: () => {
        window.location.hash = '#/reading';
      }
    });
  });

  // 6. Diario
  (store.journalEntries || []).forEach((j) => {
    const tagsText = Array.isArray(j.tags) ? j.tags.join(', ') : '';
    const plainBody = stripHtml(j.content).slice(0, 120);
    items.push({
      group: 'Diario',
      icon: 'journal',
      title: j.title || 'Entrada sin título',
      sub: [j.date, j.mood, tagsText].filter(Boolean).join(' · '),
      badge: 'Diario',
      keywords: `${j.title || ''} ${j.mood || ''} ${tagsText} ${plainBody}`,
      action: () => {
        window.location.hash = '#/journal';
      }
    });
  });

  // 7. Finanzas
  (store.transactions || []).forEach((tx) => {
    const sign = tx.type === 'income' ? '+' : '-';
    items.push({
      group: 'Finanzas',
      icon: 'finance',
      title: tx.description || tx.category || 'Movimiento',
      sub: `${tx.date || ''} · ${tx.category || ''} · ${sign}${tx.amount ?? 0}`,
      badge: tx.account || 'Finanzas',
      keywords: `${tx.description || ''} ${tx.category || ''} ${tx.account || ''} ${tx.amount ?? ''}`,
      action: () => {
        window.location.hash = '#/finance';
      }
    });
  });

  return items;
}

export function initGlobalSearch(navItems) {
  let activeModal = null;

  const closeSearch = () => {
    if (!activeModal) return;
    const modal = activeModal;
    activeModal = null;
    document.removeEventListener('keydown', onModalKeyDown);
    modal.classList.remove('open');
    setTimeout(() => modal.remove(), 150);
  };

  let filtered = [];
  let activeIndex = 0;

  const renderResults = (container, query) => {
    const q = normalizeText(query).trim();
    const allItems = buildSearchItems(navItems);

    if (!q) {
      // Sin texto: mostrar Navegación y Sistema por defecto
      filtered = allItems.filter((item) => item.group === 'Navegación' || item.group === 'Sistema');
    } else {
      const terms = q.split(/\s+/).filter(Boolean);
      filtered = allItems
        .filter((item) => {
          const haystack = normalizeText(`${item.title} ${item.sub} ${item.keywords} ${item.group}`);
          return terms.every((term) => haystack.includes(term));
        })
        .slice(0, 30);
    }

    activeIndex = 0;

    if (filtered.length === 0) {
      container.innerHTML = `<div class="cyber-search-empty">SIN COINCIDENCIAS PARA "${escapeHtml(query)}"</div>`;
      return;
    }

    let lastGroup = '';
    container.innerHTML = filtered
      .map((item, idx) => {
        const groupHeader =
          item.group !== lastGroup
            ? `<div class="cyber-search-group">${escapeHtml(item.group)}</div>`
            : '';
        lastGroup = item.group;

        return `
          ${groupHeader}
          <button type="button" class="cyber-search-item ${idx === 0 ? 'active' : ''}" data-search-idx="${idx}">
            <span class="cyber-search-item-icon">${icon(item.icon)}</span>
            <span class="cyber-search-item-body">
              <span class="cyber-search-item-title">${escapeHtml(item.title)}</span>
              <span class="cyber-search-item-sub">${escapeHtml(item.sub)}</span>
            </span>
            <span class="cyber-search-item-badge">${escapeHtml(item.badge)}</span>
          </button>
        `;
      })
      .join('');

    container.querySelectorAll('[data-search-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-search-idx'));
        const chosen = filtered[idx];
        closeSearch();
        chosen?.action?.();
      });
    });
  };

  const updateSelection = (resultsEl, nextIndex) => {
    if (filtered.length === 0) return;
    activeIndex = (nextIndex + filtered.length) % filtered.length;
    const buttons = resultsEl.querySelectorAll('[data-search-idx]');
    buttons.forEach((btn, idx) => {
      const isSelected = idx === activeIndex;
      btn.classList.toggle('active', isSelected);
      if (isSelected) btn.scrollIntoView({ block: 'nearest' });
    });
  };

  function onModalKeyDown(e) {
    if (!activeModal) return;
    const resultsEl = activeModal.querySelector('#cyber-search-results');

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeSearch();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateSelection(resultsEl, activeIndex + 1);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateSelection(resultsEl, activeIndex - 1);
      return;
    }

    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      const chosen = filtered[activeIndex];
      closeSearch();
      chosen?.action?.();
    }
  }

  const openSearch = () => {
    if (document.documentElement.classList.contains('app-locked')) return;
    if (activeModal) {
      activeModal.querySelector('#cyber-search-input')?.focus();
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.id = 'cyber-search-modal';
    backdrop.className = 'cyber-search-backdrop';
    backdrop.setAttribute('role', 'presentation');
    backdrop.innerHTML = `
      <div class="cyber-search-frame cyber-frame-wrap" role="dialog" aria-modal="true" aria-label="Buscador global">
        ${hudFrameOrnaments()}
        <div class="cyber-search-panel">
          <div class="cyber-search-head">
            <span class="cyber-search-icon">${icon('search')}</span>
            <input
              type="text"
              id="cyber-search-input"
              class="cyber-search-input"
              placeholder="Buscar vistas, hábitos, tareas, libros, diario, finanzas..."
              autocomplete="off"
              spellcheck="false"
            />
            <span class="cyber-search-kbd">ESC</span>
          </div>
          <div class="cyber-search-results" id="cyber-search-results"></div>
          <div class="cyber-search-foot">
            <span>↑↓ NAVEGAR · ENTER ABRIR</span>
            <span>HUD.SEARCH // CTRL+K</span>
          </div>
        </div>
      </div>
    `;

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeSearch();
    });

    const inputEl = backdrop.querySelector('#cyber-search-input');
    const resultsEl = backdrop.querySelector('#cyber-search-results');

    inputEl.addEventListener('input', () => {
      renderResults(resultsEl, inputEl.value);
    });

    renderResults(resultsEl, '');

    activeModal = backdrop;
    document.addEventListener('keydown', onModalKeyDown);
    document.body.appendChild(backdrop);

    requestAnimationFrame(() => {
      backdrop.classList.add('open');
      inputEl.focus();
    });
  };

  // Botones de búsqueda en sidebar y topbar móvil
  document.querySelectorAll('[data-action="open-search"]').forEach((btn) => {
    btn.innerHTML = icon('search');
    btn.addEventListener('click', openSearch);
  });

  // Atajo global Ctrl+K / Cmd+K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (activeModal) closeSearch();
      else openSearch();
    }
  });

  window.openDarknessSearch = openSearch;
}
