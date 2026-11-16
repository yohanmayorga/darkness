import { initRouter, getActiveRoute } from './router.js?v=1.4.0';
import { getStore, isSupabaseConfigured } from './services/db.js?v=1.4.0';
import { icon } from './components/icons.js?v=1.4.0';
import { renderMementoSidebar, computeMementoStats, drawMementoCanvas } from './components/memento.js?v=1.4.0';

const THEME_KEY = 'darkness_theme';
const SIDEBAR_KEY = 'darkness_sidebar_collapsed';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', shortLabel: 'Inicio', icon: 'dashboard' },
  { path: '/habits', label: 'Hábitos', shortLabel: 'Hábitos', icon: 'habits' },
  { path: '/body', label: 'Cuerpo & Peso', shortLabel: 'Cuerpo', icon: 'body' },
  { path: '/reading', label: 'Lectura', shortLabel: 'Lectura', icon: 'reading' },
  { path: '/journal', label: 'Diario', shortLabel: 'Diario', icon: 'journal' },
  { path: '/finance', label: 'Finanzas', shortLabel: 'Finanzas', icon: 'finance' },
  { path: '/settings', label: 'Ajustes', shortLabel: 'Ajustes', icon: 'settings' }
];

function applyTheme(theme) {
  const valid = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', valid);
  localStorage.setItem(THEME_KEY, valid);
  updateThemeButtons(valid);
  window.dispatchEvent(new CustomEvent('darkness:theme-changed', { detail: { theme: valid } }));
}

function updateThemeButtons(theme) {
  const iconMarkup = theme === 'dark' ? icon('sun') : icon('moon');
  document.querySelectorAll('[data-action="toggle-theme"]').forEach(btn => {
    btn.innerHTML = iconMarkup;
    btn.setAttribute('title', theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro');
  });
}

window.setDarknessTheme = applyTheme;
window.toggleDarknessTheme = () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
};

function renderNavigation() {
  const desktopNav = document.getElementById('sidebar-nav');
  const mobileNav = document.getElementById('mobile-bottom-nav');
  const activePath = getActiveRoute();

  if (desktopNav) {
    desktopNav.innerHTML = NAV_ITEMS.map(item => `
      <a href="#${item.path}" class="nav-item ${activePath === item.path ? 'active' : ''}" data-route="${item.path}">
        ${icon(item.icon)}
        <span class="nav-label">${item.label}</span>
      </a>
    `).join('');
  }

  if (mobileNav) {
    mobileNav.innerHTML = NAV_ITEMS.map(item => `
      <a href="#${item.path}" class="mobile-tab ${activePath === item.path ? 'active' : ''}" data-route="${item.path}">
        ${icon(item.icon)}
        <span>${item.shortLabel}</span>
      </a>
    `).join('');
  }
}

function updateUserFooter() {
  const store = getStore();
  const nameEl = document.getElementById('sidebar-user-name');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  const statusEl = document.getElementById('sidebar-sync-status');

  const name = store.profile?.name || 'Usuario Darkness';
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (nameEl) nameEl.textContent = name;
  if (avatarEl) avatarEl.textContent = initials;
  if (statusEl) {
    statusEl.textContent = isSupabaseConfigured() ? 'Supabase Cloud' : 'Almacenamiento Local';
  }
}

function repaintMementoCanvas() {
  const canvas = document.getElementById('memento-canvas');
  if (!canvas) return;
  const store = getStore();
  const stats = computeMementoStats(store.profile?.mementoMori);
  drawMementoCanvas(canvas, stats);
}

function initShell() {
  const shell = document.getElementById('app-shell');

  // 1. Inicializar tema guardado
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(savedTheme);

  // 2. Estado colapsado de sidebar en escritorio
  if (localStorage.getItem(SIDEBAR_KEY) === '1') {
    shell?.classList.add('sidebar-collapsed');
  }

  document.getElementById('btn-collapse-sidebar')?.addEventListener('click', () => {
    shell?.classList.toggle('sidebar-collapsed');
    const isCollapsed = shell?.classList.contains('sidebar-collapsed');
    localStorage.setItem(SIDEBAR_KEY, isCollapsed ? '1' : '0');
  });

  // 3. Botones de cambio de tema (escritorio y móvil)
  document.querySelectorAll('[data-action="toggle-theme"]').forEach(btn => {
    btn.addEventListener('click', () => window.toggleDarknessTheme());
  });

  // 4. Botón móvil de Memento Mori (al lado del icono de luna/sol)
  const mobileMementoBtn = document.getElementById('btn-mobile-memento');
  if (mobileMementoBtn) {
    mobileMementoBtn.innerHTML = icon('memento');
    mobileMementoBtn.addEventListener('click', () => {
      shell?.classList.toggle('memento-open');
      if (shell?.classList.contains('memento-open')) {
        requestAnimationFrame(() => repaintMementoCanvas());
      }
    });
  }

  document.getElementById('memento-backdrop')?.addEventListener('click', () => {
    shell?.classList.remove('memento-open');
  });

  // 5. Inicializar panel Memento Mori y repintado 100% responsivo
  renderMementoSidebar();
  window.addEventListener('resize', () => requestAnimationFrame(repaintMementoCanvas));
  window.addEventListener('darkness:theme-changed', () => requestAnimationFrame(repaintMementoCanvas));

  // 6. Navegación y usuario
  renderNavigation();
  updateUserFooter();

  window.addEventListener('darkness:data-updated', updateUserFooter);

  // 7. Enrutador Hash
  const mountNode = document.getElementById('app-view');
  initRouter(mountNode, (activePath) => {
    renderNavigation();
    shell?.classList.toggle('route-dashboard', activePath === '/dashboard');
    shell?.classList.remove('memento-open');
    shell?.classList.remove('focus-mode');
  });

  // 8. Escape: cierra Memento Mori móvil y sale del modo enfoque
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    shell?.classList.remove('memento-open');
    if (shell?.classList.contains('focus-mode')) {
      shell.classList.remove('focus-mode');
      document.getElementById('editor-focus')?.classList.remove('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', initShell);
