import { initRouter, getActiveRoute } from './router.js?v=6.9.16';
import { getStore, isFirebaseConfigured, pullFromFirebase, getFirebaseClient } from './services/db.js?v=6.9.1';
import {
  handleGoogleRedirectResult,
  loginWithPin,
  registerWithPin,
  loginWithGoogle,
  isValidPin
} from './services/auth.js?v=6.9.0';
import { icon } from './components/icons.js?v=3.4.0';
import { renderMementoSidebar, computeMementoStats, drawMementoCanvas } from './components/memento.js?v=6.9.0';
import { initGlobalSearch } from './components/search.js?v=1.3.1';
import { hudFrameOrnaments } from './components/hudFrame.js?v=1.0.0';

const THEME_KEY = 'darkness_theme';
const SIDEBAR_KEY = 'darkness_sidebar_collapsed';
const PIN_UNLOCKED_KEY = 'darkness_pin_unlocked';
let shellInitialized = false;

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', shortLabel: 'Inicio', icon: 'dashboard' },
  { path: '/habits', label: 'Hábitos', shortLabel: 'Hábitos', icon: 'habits' },
  { path: '/tasks', label: 'Tareas', shortLabel: 'Tareas', icon: 'list' },
  { path: '/body', label: 'Cuerpo', shortLabel: 'Cuerpo', icon: 'body' },
  { path: '/reading', label: 'Lectura', shortLabel: 'Lectura', icon: 'reading' },
  { path: '/journal', label: 'Diario', shortLabel: 'Diario', icon: 'journal' },
  { path: '/finance', label: 'Finanzas', shortLabel: 'Finanzas', icon: 'finance' },
  { path: '/f1', label: 'Fórmula 1', shortLabel: 'F1', icon: 'flag' },
  { path: '/settings', label: 'Ajustes', shortLabel: 'Ajustes', icon: 'settings' }
];

function applyTheme(theme) {
  const valid = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', valid);
  localStorage.setItem(THEME_KEY, valid);
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', valid === 'dark' ? '#07070A' : '#E6E6EC');
  }
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

  // 3b. Buscador Global / Paleta de Comandos (Ctrl+K / Cmd+K y botón lupa)
  initGlobalSearch(NAV_ITEMS);
  initCyberRadGlitch();

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
  const HUD_MODULES = {
    '/dashboard': { num: '01', code: 'SYS.01', tag: 'CORE // OVERVIEW' },
    '/habits':    { num: '02', code: 'SYS.02', tag: 'HABITS // PROTOCOL' },
    '/tasks':     { num: '03', code: 'SYS.03', tag: 'TASKS // QUEUE' },
    '/body':      { num: '04', code: 'SYS.04', tag: 'BIOMETRICS // LOG' },
    '/reading':   { num: '05', code: 'SYS.05', tag: 'ARCHIVE // LIBRARY' },
    '/journal':   { num: '06', code: 'SYS.06', tag: 'MEMORY // JOURNAL' },
    '/finance':   { num: '07', code: 'SYS.07', tag: 'LEDGER // FINANCE' },
    '/f1':        { num: '08', code: 'SYS.08', tag: 'TELEMETRY // F1' },
    '/settings':  { num: '09', code: 'SYS.09', tag: 'SYSTEM // CONFIG' }
  };
  const hudNumEl = document.getElementById('hud-giant-num');
  const hudCodeEl = document.getElementById('hud-watermark-code');
  const hudTagEl = document.getElementById('hud-watermark-tag');

  const mountNode = document.getElementById('app-view');
  initRouter(mountNode, (activePath) => {
    renderNavigation();
    shell?.classList.toggle('route-dashboard', activePath === '/dashboard');
    shell?.classList.toggle('route-habits', activePath === '/habits');
    shell?.classList.toggle('route-body', activePath === '/body');
    shell?.classList.remove('memento-open');
    shell?.classList.remove('focus-mode');
    const mod = HUD_MODULES[activePath] || HUD_MODULES['/dashboard'];
    if (hudNumEl) hudNumEl.textContent = mod.num;
    if (hudCodeEl) hudCodeEl.textContent = mod.code;
    if (hudTagEl) hudTagEl.textContent = mod.tag;
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

function executeLock() {
  sessionStorage.removeItem(PIN_UNLOCKED_KEY);
  location.reload();
}

function openLockConfirmModal() {
  const existing = document.getElementById('cyber-lock-modal');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'cyber-lock-modal';
  backdrop.className = 'cyber-lock-backdrop';
  backdrop.setAttribute('role', 'presentation');
  backdrop.innerHTML = `
    <div class="cyber-lock-frame cyber-frame-wrap" role="alertdialog" aria-modal="true" aria-labelledby="cyber-lock-title" aria-describedby="cyber-lock-desc">
      ${hudFrameOrnaments()}
      <div class="cyber-lock-dialog">
        <div class="cyber-lock-hazard-bar" aria-hidden="true"></div>
        <div class="cyber-lock-hud-bar" aria-hidden="true">
          <span class="cyber-lock-code"><span class="cyber-lock-dot"></span> SEC-09 // LOCKDOWN</span>
          <span class="cyber-lock-tag">ADVERTENCIA</span>
        </div>
        <div class="cyber-lock-body">
          <div class="cyber-lock-emblem" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="0.75" stroke-dasharray="2 2" opacity="0.55"/>
              <circle cx="12" cy="12" r="2.1"/>
              <path d="M10.1 8.71 L7.2 3.69 A9.6 9.6 0 0 1 16.8 3.69 L13.9 8.71 A3.8 3.8 0 0 0 10.1 8.71 Z" transform="rotate(60 12 12)"/>
              <path d="M10.1 8.71 L7.2 3.69 A9.6 9.6 0 0 1 16.8 3.69 L13.9 8.71 A3.8 3.8 0 0 0 10.1 8.71 Z" transform="rotate(180 12 12)"/>
              <path d="M10.1 8.71 L7.2 3.69 A9.6 9.6 0 0 1 16.8 3.69 L13.9 8.71 A3.8 3.8 0 0 0 10.1 8.71 Z" transform="rotate(300 12 12)"/>
            </svg>
          </div>
          <h3 class="cyber-lock-title" id="cyber-lock-title">¿Bloquear terminal?</h3>
          <p class="cyber-lock-desc" id="cyber-lock-desc">Se bloqueará la sesión actual y necesitarás tu clave de acceso para volver a entrar.</p>
          <span class="cyber-lock-meta">SYS.LOCK // PROTOCOLO DE SEGURIDAD</span>
        </div>
        <div class="cyber-lock-actions">
          <button type="button" class="btn btn-secondary" id="cyber-lock-cancel">Cancelar</button>
          <button type="button" class="btn cyber-lock-confirm-btn" id="cyber-lock-confirm">Sí, bloquear</button>
        </div>
        <div class="cyber-lock-hazard-bar" aria-hidden="true"></div>
      </div>
    </div>
  `;

  const closeModal = () => {
    document.removeEventListener('keydown', onKeyDown);
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 170);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeModal();
    }
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  backdrop.querySelector('#cyber-lock-cancel')?.addEventListener('click', closeModal);
  backdrop.querySelector('#cyber-lock-confirm')?.addEventListener('click', () => {
    closeModal();
    executeLock();
  });

  document.addEventListener('keydown', onKeyDown);
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    backdrop.querySelector('#cyber-lock-cancel')?.focus();
  });
}

window.lockDarknessApp = () => {
  openLockConfirmModal();
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

function initCyberRadGlitch() {
  const badge = document.getElementById('cyber-rad-badge');
  if (!badge) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const scheduleNextGlitch = () => {
    const delay = 3500 + Math.random() * 6500;
    window.setTimeout(() => {
      badge.classList.remove('is-glitching');
      void badge.offsetWidth;
      badge.classList.add('is-glitching');
      window.setTimeout(() => {
        badge.classList.remove('is-glitching');
        scheduleNextGlitch();
      }, 360);
    }, delay);
  };

  scheduleNextGlitch();
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
