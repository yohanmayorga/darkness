/**
 * Metadatos visuales y emblemas vectoriales minimalistas/cyberpunk para escuderías de F1.
 */

const TEAM_EMBLEMS = {
  ferrari: {
    code: 'FER',
    colorVar: 'var(--f1-ferrari)',
    svg: '<path d="M5 3h14v10c0 4.5-7 8-7 8s-7-3.5-7-8V3z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 15l2-5 2 2 2-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><line x1="6" y1="6.5" x2="18" y2="6.5" stroke="currentColor" stroke-width="1.4"/>'
  },
  redbull: {
    code: 'RBR',
    colorVar: 'var(--f1-redbull)',
    svg: '<circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2 10l6 2-4 3M22 10l-6 2 4 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  mercedes: {
    code: 'MER',
    colorVar: 'var(--f1-mercedes)',
    svg: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3v9l7.5 4.5M12 12L4.5 16.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
  },
  mclaren: {
    code: 'MCL',
    colorVar: 'var(--f1-mclaren)',
    svg: '<path d="M3 16c4-7 11-10 18-8-4 2-6 5-7 8-3-1-6 0-11 0z" fill="currentColor" opacity="0.25"/><path d="M3 16c4-7 11-10 18-8-4 2-6 5-7 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  aston: {
    code: 'AMR',
    colorVar: 'var(--f1-aston)',
    svg: '<path d="M2 9l10 3 10-3-4 6H6L2 9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" stroke-width="1.4"/>'
  },
  alpine: {
    code: 'ALP',
    colorVar: 'var(--f1-alpine)',
    svg: '<path d="M4 18L13 5l3 5-7 8H4zM12 18l5-7 3 7h-8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'
  },
  williams: {
    code: 'WIL',
    colorVar: 'var(--f1-williams)',
    svg: '<path d="M3 7l4 10 5-7 5 7 4-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  rb: {
    code: 'VCARB',
    colorVar: 'var(--f1-rb)',
    svg: '<polygon points="12,3 21,8 21,16 12,21 3,16 3,8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
  },
  haas: {
    code: 'HAA',
    colorVar: 'var(--f1-haas)',
    svg: '<path d="M6 5v14M18 5v14M6 12h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="3 3"/>'
  },
  sauber: {
    code: 'SAU',
    colorVar: 'var(--f1-sauber)',
    svg: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 12h5M15 12h5" stroke="currentColor" stroke-width="1.5"/>'
  },
  cadillac: {
    code: 'CAD',
    colorVar: 'var(--f1-cadillac)',
    svg: '<polygon points="12,2 20,7 17,19 7,19 4,7" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="8.5" y="8.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.4"/>'
  },
  default: {
    code: 'F1',
    colorVar: 'var(--f1-default)',
    svg: '<polygon points="12,3 21,12 12,21 3,12" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>'
  }
};

export function getTeamMeta(constructorObjOrName) {
  const raw = typeof constructorObjOrName === 'string'
    ? constructorObjOrName
    : `${constructorObjOrName?.constructorId || ''} ${constructorObjOrName?.name || ''}`;
  const s = raw.toLowerCase();

  let key = 'default';
  if (s.includes('ferrari')) key = 'ferrari';
  else if (s.includes('red_bull') || s.includes('red bull')) key = 'redbull';
  else if (s.includes('mercedes')) key = 'mercedes';
  else if (s.includes('mclaren')) key = 'mclaren';
  else if (s.includes('aston')) key = 'aston';
  else if (s.includes('alpine')) key = 'alpine';
  else if (s.includes('williams')) key = 'williams';
  else if (s.includes('rb') || s.includes('racing bulls') || s.includes('alphatauri')) key = 'rb';
  else if (s.includes('haas')) key = 'haas';
  else if (s.includes('sauber') || s.includes('kick') || s.includes('audi') || s.includes('alfa')) key = 'sauber';
  else if (s.includes('cadillac') || s.includes('andretti')) key = 'cadillac';

  const meta = TEAM_EMBLEMS[key];
  return {
    key,
    code: meta.code,
    colorVar: meta.colorVar,
    svg: `<svg viewBox="0 0 24 24" aria-hidden="true">${meta.svg}</svg>`
  };
}
