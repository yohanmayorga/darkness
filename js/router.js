import { renderDashboard } from './modules/dashboard.js?v=4.8.0';
import { renderHabits } from './modules/habits.js?v=5.1.0';
import { renderTasks } from './modules/tasks.js?v=5.3.0';
import { renderBody } from './modules/body.js?v=5.3.0';
import { renderReading } from './modules/reading.js?v=5.5.0';
import { renderJournal } from './modules/journal.js?v=2.6.0';
import { renderFinance } from './modules/finance.js?v=5.6.0';
import { renderSettings } from './modules/settings.js?v=6.0.0';

const ROUTES = {
  '/dashboard': renderDashboard,
  '/habits': renderHabits,
  '/tasks': renderTasks,
  '/body': renderBody,
  '/reading': renderReading,
  '/journal': renderJournal,
  '/finance': renderFinance,
  '/settings': renderSettings
};

/**
 * Interpreta el hash: #/journal/edit/abc -> { base: '/journal', params: ['edit', 'abc'] }
 */
function parseHash() {
  const hash = window.location.hash || '#/dashboard';
  const parts = hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map(p => {
      try { return decodeURIComponent(p); } catch { return p; }
    });
  const base = `/${parts[0] || 'dashboard'}`;
  if (!ROUTES[base]) return { base: '/dashboard', params: [] };
  return { base, params: parts.slice(1) };
}

export function getActiveRoute() {
  return parseHash().base;
}

export function initRouter(mountNode, onRouteChanged) {
  const handleNavigation = () => {
    const { base, params } = parseHash();
    if (typeof onRouteChanged === 'function') {
      onRouteChanged(base, params);
    }
    ROUTES[base](mountNode, params);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  window.addEventListener('hashchange', handleNavigation);
  handleNavigation();
}
