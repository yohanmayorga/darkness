import { initRouter, getActiveRoute } from './router.js?v=6.9.0';
import { getStore, isFirebaseConfigured, pullFromFirebase, getFirebaseClient } from './services/db.js?v=6.9.0';
import {
  handleGoogleRedirectResult,
  loginWithPin,
  registerWithPin,
  loginWithGoogle,
  isValidPin
} from './services/auth.js?v=6.9.0';
import { icon } from './components/icons.js?v=3.3.0';
import { renderMementoSidebar, computeMementoStats, drawMementoCanvas } from './components/memento.js?v=6.9.0';

const THEME_KEY = 'darkness_theme';
const SIDEBAR_KEY = 'darkness_sidebar_collapsed';
const PIN_UNLOCKED_KEY = 'darkness_pin_unlocked';
let shellInitialized = false;

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', shortLabel: 'Inicio', icon: 'dashboard' },
  { path: '/habits', label: 'Hábitos', shortLabel: 'Hábitos', icon: 'habits' },
  { path: '/tasks', label: 'Tareas', shortLabel: 'Tareas', icon: 'list' },
  { path: '/body', label: 'Cuerpo & Peso', shortLabel: 'Cuerpo', icon: 'body' },
  { path: '/reading', label: 'Lectura', shortLabel: 'Lectura', icon: 'reading' },
  { path: '/journal', label: 'Diario', shortLabel: 'Diario', icon: 'journal' },
  { path: '/finance', label: 'Finanzas', shortLabel: 'Finanzas', icon: 'finance' },
  { path: '/settings', label: 'Ajustes', shortLabel: 'Ajustes', icon: 'settings' }
];

function applyTheme(theme) {
  const valid = theme === 'dark' ? 'dark' : 'light';
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
    statusEl.textContent = isFirebaseConfigured() ? 'Firebase Cloud' : 'Almacenamiento Local';
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

  // 1. Mantener tema guardado o iniciar en Modo Claro (Light) por defecto
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');

  // 2. Estado colapsado de sidebar en escritorio
  if (localStorage.getItem(SIDEBAR_KEY) === '1') {
    shell?.classList.add('sidebar-collapsed');
  }

  document.getElementById('btn-collapse-sidebar')?.addEventListener('click', () => {
    shell?.classList.toggle('sidebar-collapsed');
    const isCollapsed = shell?.classList.contains('sidebar-collapsed');
    localStorage.setItem(SIDEBAR_KEY, isCollapsed ? '1' : '0');
  });

  // 3. Botones de cambio de tema y bloqueo (escritorio y móvil)
  document.querySelectorAll('[data-action="toggle-theme"]').forEach(btn => {
    btn.addEventListener('click', () => window.toggleDarknessTheme());
  });

  document.querySelectorAll('[data-action="lock-app"]').forEach(btn => {
    btn.innerHTML = icon('lock');
    btn.addEventListener('click', () => window.lockDarknessApp());
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
    shell?.classList.toggle('route-habits', activePath === '/habits');
    shell?.classList.toggle('route-body', activePath === '/body');
    shell?.classList.remove('memento-open');
    shell?.classList.remove('focus-mode');
  });

  // 8. Sincronización automática desde la nube al abrir la página (sin pedir login de nuevo)
  if (isFirebaseConfigured()) {
    handleGoogleRedirectResult()
      .then(() => pullFromFirebase())
      .then(res => {
        if (res?.ok) {
          updateUserFooter();
          renderMementoSidebar();
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      })
      .catch(() => {});
  }

  // 9. Escape: cierra Memento Mori móvil y sale del modo enfoque
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    shell?.classList.remove('memento-open');
    if (shell?.classList.contains('focus-mode')) {
      shell.classList.remove('focus-mode');
      document.getElementById('editor-focus')?.classList.remove('active');
    }
  });
}

function unlockAppAndInit() {
  document.documentElement.classList.remove('app-locked');
  if (!shellInitialized) {
    shellInitialized = true;
    initShell();
  }
}

window.lockDarknessApp = () => {
  sessionStorage.removeItem(PIN_UNLOCKED_KEY);
  location.reload();
};

function initPinGate() {
  const form = document.getElementById('pin-gate-form');
  const input = document.getElementById('pin-gate-input');
  const slotsWrap = document.getElementById('pin-slots');
  const slots = document.querySelectorAll('#pin-slots .pin-slot');
  const googleBtn = document.getElementById('pin-gate-google-btn');

  if (!form || !input) return;

  let busy = false;

  const updateSlots = (len) => {
    slots.forEach((slot, idx) => {
      slot.classList.toggle('filled', idx < len);
      slot.classList.toggle('active', idx === Math.min(len, slots.length - 1));
    });
  };

  const triggerError = () => {
    if (!slotsWrap) return;
    slotsWrap.classList.remove('is-error');
    void slotsWrap.offsetWidth;
    slotsWrap.classList.add('is-error');
    setTimeout(() => slotsWrap.classList.remove('is-error'), 450);
  };

  async function handlePinSubmit() {
    if (busy) return;
    const pin = input.value.replace(/\D/g, '');
    if (!isValidPin(pin)) {
      triggerError();
      input.focus();
      return;
    }

    busy = true;
    input.disabled = true;
    slotsWrap?.classList.add('is-loading');

    try {
      await loginWithPin(pin);
      sessionStorage.setItem(PIN_UNLOCKED_KEY, '1');
      unlockAppAndInit();
    } catch (err) {
      console.warn('Error al validar clave:', err?.code || err?.message);
      triggerError();
      input.value = '';
      updateSlots(0);
    } finally {
      busy = false;
      input.disabled = false;
      slotsWrap?.classList.remove('is-loading');
      if (document.documentElement.classList.contains('app-locked')) {
        input.focus();
      }
    }
  }

  input.addEventListener('input', () => {
    const clean = input.value.replace(/\D/g, '').slice(0, 8);
    if (input.value !== clean) input.value = clean;
    updateSlots(clean.length);
    if (clean.length === 8) {
      handlePinSubmit();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handlePinSubmit();
  });

  googleBtn?.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    slotsWrap?.classList.add('is-loading');
    try {
      await loginWithGoogle();
      sessionStorage.setItem(PIN_UNLOCKED_KEY, '1');
      unlockAppAndInit();
    } catch (err) {
      console.warn('Error al iniciar sesión con Google:', err?.code || err?.message);
      triggerError();
    } finally {
      busy = false;
      slotsWrap?.classList.remove('is-loading');
    }
  });

  updateSlots(0);
  requestAnimationFrame(() => input.focus());
}

async function bootstrapApp() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');

  if (sessionStorage.getItem(PIN_UNLOCKED_KEY) === '1') {
    const fb = await getFirebaseClient();
    if (fb) {
      await fb.auth.authStateReady();
      if (fb.auth.currentUser) {
        unlockAppAndInit();
        return;
      }
    }
    sessionStorage.removeItem(PIN_UNLOCKED_KEY);
  }

  initPinGate();
}

document.addEventListener('DOMContentLoaded', bootstrapApp);
