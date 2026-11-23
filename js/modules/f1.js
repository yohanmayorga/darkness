import {
  fetchSeasonOverview,
  fetchRoundDetails,
  fetchDriverSeasonResults,
  fetchConstructorSeasonResults,
  fetchOpenF1LatestSession,
  fetchOpenF1DriverHeadshots,
  parseRaceDateTime,
  resolveRaceTimeline
} from '../services/f1.js?v=1.1.0';
import { todayISO } from '../services/db.js?v=6.9.0';
import { icon } from '../components/icons.js?v=3.4.0';
import { hudFrameOrnaments } from '../components/hudFrame.js?v=1.0.0';
import { renderF1WorldMapHTML, bindF1WorldMap } from '../components/f1Map.js?v=2.0.0';
import { getTeamMeta } from '../components/f1Teams.js?v=1.0.0';
import { openModal } from '../components/modal.js?v=1.4.0';
import { showToast } from '../components/toast.js?v=1.4.0';
import { escapeHTML } from '../utils/text.js?v=4.3.0';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const state = {
  season: 'current',
  heroMode: 'map', // 'map' | 'drivers' | 'constructors'
  selectedDriverId: null,
  selectedConstructorId: null,
  driverHeadshots: {},
  driverDetailCache: new Map(),
  constructorDetailCache: new Map(),
  entityDetailLoading: false,
  activeTab: 'overview', // 'overview' | 'standings' | 'calendar' | 'telemetry'
  overviewSubtab: 'race', // 'race' | 'quali'
  standingsSubtab: 'drivers', // 'drivers' | 'constructors'
  loading: false,
  error: null,
  data: null,
  openf1Loading: false,
  openf1Error: null,
  openf1Data: null,
  openf1SeasonLoaded: null,
  countdownTimer: null,
  calYear: null,
  calMonth: null,
  selectedDate: '',
  asideRoundCache: new Map(),
  asideRoundLoading: false
};

function clearCountdownTimer() {
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }
}

function getTeamColorVar(constructorObjOrName) {
  return getTeamMeta(constructorObjOrName).colorVar;
}

function getDriverHeadshot(driver) {
  if (!driver) return '';
  const code = (driver.code || '').toUpperCase();
  const num = driver.permanentNumber ? `#${driver.permanentNumber}` : '';
  return state.driverHeadshots[code]?.headshotUrl || state.driverHeadshots[num]?.headshotUrl || '';
}

function formatLocalDateTime(dateStr, timeStr, includeTime = true) {
  const dt = parseRaceDateTime(dateStr, timeStr);
  if (!dt) return dateStr || '—';
  const datePart = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(dt);
  if (!includeTime || !timeStr) return datePart;
  const timePart = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(dt);
  return `${datePart} · ${timePart}`;
}

function formatCountdownText(targetDate) {
  if (!targetDate) return '—';
  const diff = targetDate.getTime() - Date.now();
  if (diff <= 0) return 'EN CURSO / RECIENTE';
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = n => String(n).padStart(2, '0');
  return `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
}

function formatDeltaBadge(gridStr, posStr) {
  const grid = Number(gridStr);
  const pos = Number(posStr);
  if (!grid || !pos) return '<span class="f1-delta-flat">—</span>';
  const diff = grid - pos;
  if (diff > 0) return `<span class="f1-delta-up">+${diff}</span>`;
  if (diff < 0) return `<span class="f1-delta-down">${diff}</span>`;
  return '<span class="f1-delta-flat">0</span>';
}

function getSeasonOptions() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= 2020; y--) {
    years.push(String(y));
  }
  return years;
}

function syncCalendarInitialState(races = []) {
  if (state.calYear !== null && state.calMonth !== null) return;
  const { nextRace, lastScheduledPast } = resolveRaceTimeline(races);
  const refRace = nextRace || lastScheduledPast || races[races.length - 1];
  const refIso = refRace?.date || todayISO();
  const [y, m] = refIso.split('-').map(Number);
  state.calYear = y;
  state.calMonth = m - 1;
  state.selectedDate = refRace?.date || refIso;
}

function renderKpisHTML(data) {
  const { races, driverStandings, constructorStandings, lastRace } = data;
  const { nextRace } = resolveRaceTimeline(races);

  const topDriver = driverStandings[0] || null;
  const topConstructor = constructorStandings[0] || null;
  const lastWinner = lastRace?.Results?.[0] || null;
  const nextTarget = nextRace ? parseRaceDateTime(nextRace.date, nextRace.time) : null;

  return `
    <div class="grid-kpi">
      <div class="kpi-card f1-kpi-card is-cyber-highlight">
        <div class="kpi-top">
          <span>Próximo GP</span>
          ${icon('flag')}
        </div>
        <div class="kpi-value f1-countdown" id="f1-countdown-value">
          ${nextRace ? formatCountdownText(nextTarget) : 'Temporada cerrada'}
        </div>
        <div class="kpi-meta">
          ${nextRace
            ? `R${escapeHTML(nextRace.round)} · ${escapeHTML(nextRace.raceName)}`
            : `${races.length} rondas completadas`}
        </div>
      </div>

      <div class="kpi-card f1-kpi-card" style="--f1-team-color:${getTeamColorVar(topDriver?.Constructors?.[0])}; border-left:3px solid var(--f1-team-color);">
        <div class="kpi-top">
          <span>Líder Pilotos</span>
          ${icon('award')}
        </div>
        <div class="kpi-value">
          ${topDriver
            ? `${escapeHTML(topDriver.Driver.code || topDriver.Driver.familyName)} · ${escapeHTML(topDriver.points)} pts`
            : 'Sin datos'}
        </div>
        <div class="kpi-meta">
          ${topDriver
            ? `${escapeHTML(topDriver.Driver.givenName)} ${escapeHTML(topDriver.Driver.familyName)} (${escapeHTML(topDriver.Constructors?.[0]?.name || '—')})`
            : 'Pendiente de inicio'}
        </div>
      </div>

      <div class="kpi-card f1-kpi-card" style="--f1-team-color:${getTeamColorVar(topConstructor?.Constructor)}; border-left:3px solid var(--f1-team-color);">
        <div class="kpi-top">
          <span>Líder Constructores</span>
          ${icon('shield')}
        </div>
        <div class="kpi-value">
          ${topConstructor ? `${escapeHTML(topConstructor.Constructor.name)}` : 'Sin datos'}
        </div>
        <div class="kpi-meta f1-mono">
          ${topConstructor
            ? `${escapeHTML(topConstructor.points)} pts · ${escapeHTML(topConstructor.wins)} victorias`
            : 'Pendiente de inicio'}
        </div>
      </div>

      <div class="kpi-card f1-kpi-card" style="--f1-team-color:${getTeamColorVar(lastWinner?.Constructor)}; border-left:3px solid var(--f1-team-color);">
        <div class="kpi-top">
          <span>Último Ganador</span>
          ${icon('zap')}
        </div>
        <div class="kpi-value">
          ${lastWinner ? `${escapeHTML(lastWinner.Driver.code || lastWinner.Driver.familyName)}` : 'Sin resultados'}
        </div>
        <div class="kpi-meta">
          ${lastRace && lastWinner
            ? `${escapeHTML(lastRace.raceName)} · ${escapeHTML(lastWinner.Time?.time || lastWinner.status)}`
            : 'Esperando primera carrera'}
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza la grilla general de Pilotos o el dossier completo de un piloto seleccionado.
 */
function renderHeroDriversHTML(data) {
  const { driverStandings, season } = data;
  if (!driverStandings.length) {
    return `<p class="f1-driver-sub">No hay pilotos registrados para esta temporada.</p>`;
  }

  if (state.selectedDriverId) {
    const entry = driverStandings.find(d => d.Driver.driverId === state.selectedDriverId);
    if (!entry) {
      state.selectedDriverId = null;
    } else {
      const drv = entry.Driver;
      const team = entry.Constructors?.[0];
      const teamMeta = getTeamMeta(team);
      const photo = getDriverHeadshot(drv);
      const cacheKey = `${season}_${drv.driverId}`;
      const raceHistory = state.driverDetailCache.get(cacheKey);
      const leaderPts = Number(driverStandings[0]?.points) || 0;
      const gap = leaderPts - (Number(entry.points) || 0);

      let podiums = 0;
      let bestFinish = null;
      let totalLaps = 0;
      if (Array.isArray(raceHistory)) {
        raceHistory.forEach(r => {
          const res = r.Results?.[0];
          if (!res) return;
          const pos = Number(res.position);
          if (pos && pos <= 3) podiums++;
          if (pos && (bestFinish === null || pos < bestFinish)) bestFinish = pos;
          totalLaps += Number(res.laps) || 0;
        });
      }

      return `
        <div class="f1-profile-bar">
          <button type="button" class="btn btn-secondary btn-sm" id="f1-back-drivers" style="min-height:44px;">
            ${icon('arrowLeft')} <span>Todos los pilotos</span>
          </button>
          ${drv.url ? `<a href="${escapeHTML(drv.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" style="min-height:44px;">Ficha Wikipedia ↗</a>` : ''}
        </div>

        <div class="f1-profile-hero" style="--f1-team-color:${teamMeta.colorVar}">
          <div class="f1-profile-portrait">
            ${photo
              ? `<img src="${escapeHTML(photo)}" alt="${escapeHTML(drv.familyName)}" loading="lazy" />`
              : `<span class="f1-avatar-fallback" style="font-size:1.4rem;">${escapeHTML(drv.code || drv.permanentNumber || 'F1')}</span>`}
          </div>
          <div class="f1-profile-info">
            <div class="f1-entity-pos">POSICIÓN #${escapeHTML(entry.position)} · DORSAL #${escapeHTML(drv.permanentNumber || '—')} · ${escapeHTML(drv.code || '—')}</div>
            <h3 class="f1-profile-title">${escapeHTML(drv.givenName)} ${escapeHTML(drv.familyName)}</h3>
            <div class="f1-entity-sub">
              <span class="f1-team-dot" style="--f1-team-color:${teamMeta.colorVar}"></span>
              <span>${escapeHTML(team?.name || '—')}</span>
              <span>·</span>
              <span>${escapeHTML(drv.nationality || '')}</span>
              ${drv.dateOfBirth ? `<span>· Nac. <span class="f1-mono">${escapeHTML(drv.dateOfBirth)}</span></span>` : ''}
            </div>
          </div>
          <div class="f1-team-logo-box" style="--f1-team-color:${teamMeta.colorVar}" title="${escapeHTML(team?.name || '')}">
            ${teamMeta.svg}
          </div>
        </div>

        <div class="f1-profile-kpis">
          <div class="f1-profile-kpi"><span>Puntos</span><strong>${escapeHTML(entry.points)}</strong></div>
          <div class="f1-profile-kpi"><span>Victorias</span><strong>${escapeHTML(entry.wins)}</strong></div>
          <div class="f1-profile-kpi"><span>Dif. Líder</span><strong>${gap === 0 ? 'Líder' : `-${gap} pts`}</strong></div>
          <div class="f1-profile-kpi"><span>Podios (${season})</span><strong>${Array.isArray(raceHistory) ? podiums : '—'}</strong></div>
          <div class="f1-profile-kpi"><span>Mejor Pos.</span><strong>${bestFinish ? `P${bestFinish}` : '—'}</strong></div>
          <div class="f1-profile-kpi"><span>Vueltas</span><strong>${Array.isArray(raceHistory) ? totalLaps : '—'}</strong></div>
        </div>

        ${state.entityDetailLoading && !raceHistory ? `
          <div class="f1-loading-box">
            <div class="f1-loading-spinner"></div>
            <p>Cargando historial de carreras de ${escapeHTML(drv.familyName)}...</p>
          </div>
        ` : Array.isArray(raceHistory) && raceHistory.length ? `
          <div class="f1-table-wrap">
            <table class="f1-table">
              <thead>
                <tr>
                  <th>Ronda</th>
                  <th>Gran Premio</th>
                  <th class="num">Parrilla</th>
                  <th class="num">Pos</th>
                  <th class="num">Vueltas</th>
                  <th class="num">Estado / Tiempo</th>
                  <th class="num">Pts</th>
                </tr>
              </thead>
              <tbody>
                ${raceHistory.map(r => {
                  const res = r.Results?.[0];
                  if (!res) return '';
                  return `
                    <tr>
                      <td class="f1-mono">R${String(r.round).padStart(2, '0')}</td>
                      <td>
                        <div class="f1-driver-name">${escapeHTML(r.raceName)}</div>
                        <div class="f1-driver-sub">${escapeHTML(r.date || '')}</div>
                      </td>
                      <td class="num">${escapeHTML(res.grid === '0' ? 'PL' : res.grid)}</td>
                      <td class="num"><span class="f1-pos-pill ${res.position === '1' ? 'is-p1' : ''}">${escapeHTML(res.positionText || res.position)}</span></td>
                      <td class="num">${escapeHTML(res.laps || '—')}</td>
                      <td class="num">${escapeHTML(res.Time?.time || res.status || '—')}</td>
                      <td class="num"><strong>${escapeHTML(res.points)}</strong></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `<p class="f1-driver-sub">Sin carreras disputadas registradas para este piloto en ${escapeHTML(season)}.</p>`}
      `;
    }
  }

  return `
    <div class="f1-roster-grid">
      ${driverStandings.map(d => {
        const drv = d.Driver;
        const team = d.Constructors?.[0];
        const teamMeta = getTeamMeta(team);
        const photo = getDriverHeadshot(drv);
        return `
          <button type="button" class="f1-entity-card" data-select-driver="${escapeHTML(drv.driverId)}" style="--f1-team-color:${teamMeta.colorVar}">
            <span class="f1-entity-watermark">${escapeHTML(drv.permanentNumber || drv.code || d.position)}</span>
            <div class="f1-entity-top">
              <div class="f1-avatar-box">
                ${photo
                  ? `<img src="${escapeHTML(photo)}" alt="${escapeHTML(drv.familyName)}" loading="lazy" />`
                  : `<span class="f1-avatar-fallback">${escapeHTML(drv.code || drv.familyName.slice(0, 3).toUpperCase())}</span>`}
              </div>
              <div class="f1-entity-meta">
                <div class="f1-entity-pos">P${escapeHTML(d.position)} · #${escapeHTML(drv.permanentNumber || '—')}</div>
                <div class="f1-entity-name">${escapeHTML(drv.givenName)} ${escapeHTML(drv.familyName)}</div>
                <div class="f1-entity-sub">
                  <span class="f1-team-dot"></span>
                  <span>${escapeHTML(team?.name || '—')}</span>
                </div>
              </div>
            </div>
            <div class="f1-entity-stats">
              <div class="f1-stat-mini"><span>Puntos</span><strong>${escapeHTML(d.points)}</strong></div>
              <div class="f1-stat-mini"><span>Victorias</span><strong>${escapeHTML(d.wins)}</strong></div>
              <div class="f1-stat-mini"><span>País</span><strong>${escapeHTML((drv.nationality || '—').slice(0, 8))}</strong></div>
            </div>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Renderiza la grilla general de Escuderías o el dossier completo de una escudería seleccionada.
 */
function renderHeroConstructorsHTML(data) {
  const { constructorStandings, driverStandings, season } = data;
  if (!constructorStandings.length) {
    return `<p class="f1-driver-sub">No hay escuderías registradas para esta temporada.</p>`;
  }

  if (state.selectedConstructorId) {
    const entry = constructorStandings.find(c => c.Constructor.constructorId === state.selectedConstructorId);
    if (!entry) {
      state.selectedConstructorId = null;
    } else {
      const team = entry.Constructor;
      const teamMeta = getTeamMeta(team);
      const teamDrivers = driverStandings.filter(d =>
        d.Constructors?.some(c => c.constructorId === team.constructorId)
      );
      const cacheKey = `${season}_${team.constructorId}`;
      const raceHistory = state.constructorDetailCache.get(cacheKey);
      const leaderPts = Number(constructorStandings[0]?.points) || 0;
      const gap = leaderPts - (Number(entry.points) || 0);

      return `
        <div class="f1-profile-bar">
          <button type="button" class="btn btn-secondary btn-sm" id="f1-back-constructors" style="min-height:44px;">
            ${icon('arrowLeft')} <span>Todas las escuderías</span>
          </button>
          ${team.url ? `<a href="${escapeHTML(team.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" style="min-height:44px;">Ficha Wikipedia ↗</a>` : ''}
        </div>

        <div class="f1-profile-hero" style="--f1-team-color:${teamMeta.colorVar}">
          <div class="f1-profile-portrait">
            ${teamMeta.svg}
          </div>
          <div class="f1-profile-info">
            <div class="f1-entity-pos">CONSTRUCTOR #${escapeHTML(entry.position)} · ${escapeHTML(teamMeta.code)}</div>
            <h3 class="f1-profile-title">${escapeHTML(team.name)}</h3>
            <div class="f1-entity-sub">
              <span>Nacionalidad: ${escapeHTML(team.nationality || '—')}</span>
              <span>·</span>
              <span>Pilotos activos: ${teamDrivers.length}</span>
            </div>
          </div>
        </div>

        <div class="f1-profile-kpis">
          <div class="f1-profile-kpi"><span>Puntos</span><strong>${escapeHTML(entry.points)}</strong></div>
          <div class="f1-profile-kpi"><span>Victorias</span><strong>${escapeHTML(entry.wins)}</strong></div>
          <div class="f1-profile-kpi"><span>Dif. Líder</span><strong>${gap === 0 ? 'Líder' : `-${gap} pts`}</strong></div>
          <div class="f1-profile-kpi"><span>Carreras</span><strong>${Array.isArray(raceHistory) ? raceHistory.length : '—'}</strong></div>
        </div>

        ${teamDrivers.length ? `
          <div class="f1-roster-grid" style="margin-bottom:16px;">
            ${teamDrivers.map(d => {
              const drv = d.Driver;
              const photo = getDriverHeadshot(drv);
              return `
                <button type="button" class="f1-entity-card" data-jump-driver="${escapeHTML(drv.driverId)}" style="--f1-team-color:${teamMeta.colorVar}">
                  <div class="f1-entity-top">
                    <div class="f1-avatar-box">
                      ${photo
                        ? `<img src="${escapeHTML(photo)}" alt="${escapeHTML(drv.familyName)}" loading="lazy" />`
                        : `<span class="f1-avatar-fallback">${escapeHTML(drv.code || 'F1')}</span>`}
                    </div>
                    <div class="f1-entity-meta">
                      <div class="f1-entity-pos">P${escapeHTML(d.position)} Mundial · #${escapeHTML(drv.permanentNumber || '—')}</div>
                      <div class="f1-entity-name">${escapeHTML(drv.givenName)} ${escapeHTML(drv.familyName)}</div>
                      <div class="f1-entity-sub f1-mono">${escapeHTML(d.points)} pts · ${escapeHTML(d.wins)} vic.</div>
                    </div>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        ` : ''}

        ${state.entityDetailLoading && !raceHistory ? `
          <div class="f1-loading-box">
            <div class="f1-loading-spinner"></div>
            <p>Cargando historial de carreras de ${escapeHTML(team.name)}...</p>
          </div>
        ` : Array.isArray(raceHistory) && raceHistory.length ? `
          <div class="f1-table-wrap">
            <table class="f1-table">
              <thead>
                <tr>
                  <th>Ronda</th>
                  <th>Gran Premio</th>
                  <th>Resultados de Monoplazas</th>
                  <th class="num">Pts GP</th>
                </tr>
              </thead>
              <tbody>
                ${raceHistory.map(r => {
                  const resList = r.Results || [];
                  const totalPts = resList.reduce((acc, x) => acc + (Number(x.points) || 0), 0);
                  const summary = resList
                    .map(x => `${x.Driver?.code || x.Driver?.familyName}: P${x.positionText || x.position}`)
                    .join(' · ');
                  return `
                    <tr>
                      <td class="f1-mono">R${String(r.round).padStart(2, '0')}</td>
                      <td>
                        <div class="f1-driver-name">${escapeHTML(r.raceName)}</div>
                        <div class="f1-driver-sub">${escapeHTML(r.date || '')}</div>
                      </td>
                      <td class="f1-mono">${escapeHTML(summary || '—')}</td>
                      <td class="num"><strong>+${totalPts}</strong></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `<p class="f1-driver-sub">Sin carreras registradas para esta escudería en ${escapeHTML(season)}.</p>`}
      `;
    }
  }

  return `
    <div class="f1-roster-grid">
      ${constructorStandings.map(c => {
        const team = c.Constructor;
        const teamMeta = getTeamMeta(team);
        const teamDrivers = driverStandings.filter(d =>
          d.Constructors?.some(tc => tc.constructorId === team.constructorId)
        );
        const driverCodes = teamDrivers.map(d => d.Driver.code || d.Driver.familyName).join(' · ');
        return `
          <button type="button" class="f1-entity-card" data-select-constructor="${escapeHTML(team.constructorId)}" style="--f1-team-color:${teamMeta.colorVar}">
            <span class="f1-entity-watermark">${escapeHTML(teamMeta.code)}</span>
            <div class="f1-entity-top">
              <div class="f1-team-logo-box">
                ${teamMeta.svg}
              </div>
              <div class="f1-entity-meta">
                <div class="f1-entity-pos">P${escapeHTML(c.position)} CONSTRUCTORES</div>
                <div class="f1-entity-name">${escapeHTML(team.name)}</div>
                <div class="f1-entity-sub">${escapeHTML(driverCodes || team.nationality || '—')}</div>
              </div>
            </div>
            <div class="f1-entity-stats">
              <div class="f1-stat-mini"><span>Puntos</span><strong>${escapeHTML(c.points)}</strong></div>
              <div class="f1-stat-mini"><span>Victorias</span><strong>${escapeHTML(c.wins)}</strong></div>
              <div class="f1-stat-mini"><span>Base</span><strong>${escapeHTML((team.nationality || '—').slice(0, 8))}</strong></div>
            </div>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderHeroPanelHTML(data) {
  const titleMap = {
    map: `${icon('compass')} Mapa Mundial del Campeonato · ${escapeHTML(data.season)}`,
    drivers: `${icon('zap')} Pilotos del Campeonato · ${escapeHTML(data.season)}`,
    constructors: `${icon('shield')} Escuderías del Campeonato · ${escapeHTML(data.season)}`
  };

  return `
    <div class="card cyber-frame-wrap f1-map-card">
      ${hudFrameOrnaments()}
      <div class="card-header" style="flex-wrap:wrap;gap:10px;">
        <h2 class="card-title">${titleMap[state.heroMode] || titleMap.map}</h2>
        <div class="f1-hero-switcher" role="tablist" aria-label="Modo del panel principal">
          <button type="button" class="f1-hero-btn ${state.heroMode === 'map' ? 'active' : ''}" data-f1-hero="map">
            ${icon('compass')} <span>Mapa</span>
          </button>
          <button type="button" class="f1-hero-btn ${state.heroMode === 'drivers' ? 'active' : ''}" data-f1-hero="drivers">
            ${icon('zap')} <span>Pilotos</span>
          </button>
          <button type="button" class="f1-hero-btn ${state.heroMode === 'constructors' ? 'active' : ''}" data-f1-hero="constructors">
            ${icon('shield')} <span>Escuderías</span>
          </button>
        </div>
      </div>

      ${state.heroMode === 'map' ? renderF1WorldMapHTML(data.races) : ''}
      ${state.heroMode === 'drivers' ? renderHeroDriversHTML(data) : ''}
      ${state.heroMode === 'constructors' ? renderHeroConstructorsHTML(data) : ''}
    </div>
  `;
}

function renderNextRaceScheduleHTML(nextRace) {
  if (!nextRace) {
    return `
      <div class="card cyber-frame-wrap">
        ${hudFrameOrnaments()}
        <div class="card-header">
          <h3 class="card-title">${icon('calendar')} Calendario de Próxima Carrera</h3>
          <span class="cyber-tag">SEASON END</span>
        </div>
        <p class="f1-driver-sub">No hay más Grandes Premios programados para esta temporada.</p>
      </div>
    `;
  }

  const sessions = [];
  if (nextRace.FirstPractice) sessions.push({ label: 'Práctica Libre 1', data: nextRace.FirstPractice, main: false });
  if (nextRace.SecondPractice) sessions.push({ label: 'Práctica Libre 2', data: nextRace.SecondPractice, main: false });
  if (nextRace.ThirdPractice) sessions.push({ label: 'Práctica Libre 3', data: nextRace.ThirdPractice, main: false });
  if (nextRace.SprintQualifying) sessions.push({ label: 'Sprint Qualifying', data: nextRace.SprintQualifying, main: false });
  if (nextRace.Sprint) sessions.push({ label: 'Carrera Sprint', data: nextRace.Sprint, main: true });
  if (nextRace.Qualifying) sessions.push({ label: 'Clasificación', data: nextRace.Qualifying, main: true });
  sessions.push({ label: 'Carrera Principal', data: { date: nextRace.date, time: nextRace.time }, main: true });

  return `
    <div class="card cyber-frame-wrap">
      ${hudFrameOrnaments()}
      <div class="card-header">
        <h3 class="card-title">${icon('clock')} Próximo Fin de Semana · Ronda ${escapeHTML(nextRace.round)}</h3>
        <span class="cyber-tag">${escapeHTML(nextRace.Circuit?.Location?.country || 'GP')}</span>
      </div>
      <div>
        <div class="f1-race-title">${escapeHTML(nextRace.raceName)}</div>
        <div class="f1-race-meta">
          ${escapeHTML(nextRace.Circuit?.circuitName || '')} — ${escapeHTML(nextRace.Circuit?.Location?.locality || '')}, ${escapeHTML(nextRace.Circuit?.Location?.country || '')}
        </div>
      </div>
      <div class="f1-sessions-grid">
        ${sessions.map(s => `
          <div class="f1-session-item ${s.main ? 'is-main' : ''}">
            <span class="f1-session-name">${escapeHTML(s.label)}</span>
            <span class="f1-session-time">${escapeHTML(formatLocalDateTime(s.data.date, s.data.time, true))}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderRaceResultsTableHTML(race, showAllColumns = true) {
  const results = race?.Results || [];
  if (!results.length) {
    return `<p class="f1-driver-sub">No hay resultados de carrera disponibles.</p>`;
  }

  return `
    <div class="f1-table-wrap">
      <table class="f1-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Piloto</th>
            ${showAllColumns ? '<th class="num">Parrilla</th><th class="num">+/-</th><th class="num">Vueltas</th>' : ''}
            <th class="num">Tiempo / Estado</th>
            <th class="num">Pts</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(r => {
            const isP1 = r.position === '1';
            const isFastest = r.FastestLap?.rank === '1';
            const timeOrStatus = r.Time?.time || r.status || '—';
            const teamColor = getTeamColorVar(r.Constructor);
            return `
              <tr>
                <td><span class="f1-pos-pill ${isP1 ? 'is-p1' : ''}">${escapeHTML(r.positionText || r.position)}</span></td>
                <td>
                  <div class="f1-driver-cell" style="--f1-team-color:${teamColor}">
                    <span class="f1-driver-name">
                      ${escapeHTML(r.Driver.givenName)} ${escapeHTML(r.Driver.familyName)}
                      ${isFastest ? `<span class="f1-fl-badge" title="Vuelta Rápida: ${escapeHTML(r.FastestLap?.Time?.time || '')}">VR ${escapeHTML(r.FastestLap?.Time?.time || '')}</span>` : ''}
                    </span>
                    <span class="f1-driver-sub">${escapeHTML(r.Constructor?.name || '')} · #${escapeHTML(r.number || r.Driver.permanentNumber || '—')}</span>
                  </div>
                </td>
                ${showAllColumns ? `
                  <td class="num">${escapeHTML(r.grid === '0' ? 'PL' : r.grid)}</td>
                  <td class="num">${formatDeltaBadge(r.grid, r.position)}</td>
                  <td class="num">${escapeHTML(r.laps || '—')}</td>
                ` : ''}
                <td class="num">${escapeHTML(timeOrStatus)}</td>
                <td class="num"><strong>${escapeHTML(r.points)}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderQualiResultsTableHTML(quali) {
  const results = quali?.QualifyingResults || [];
  if (!results.length) {
    return `<p class="f1-driver-sub">No hay resultados de clasificación disponibles.</p>`;
  }

  return `
    <div class="f1-table-wrap">
      <table class="f1-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Piloto</th>
            <th class="num">Q1</th>
            <th class="num">Q2</th>
            <th class="num">Q3</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(q => {
            const teamColor = getTeamColorVar(q.Constructor);
            return `
              <tr>
                <td><span class="f1-pos-pill ${q.position === '1' ? 'is-p1' : ''}">${escapeHTML(q.position)}</span></td>
                <td>
                  <div class="f1-driver-cell" style="--f1-team-color:${teamColor}">
                    <span class="f1-driver-name">${escapeHTML(q.Driver.givenName)} ${escapeHTML(q.Driver.familyName)}</span>
                    <span class="f1-driver-sub">${escapeHTML(q.Constructor?.name || '')}</span>
                  </div>
                </td>
                <td class="num">${escapeHTML(q.Q1 || '—')}</td>
                <td class="num">${escapeHTML(q.Q2 || '—')}</td>
                <td class="num"><strong>${escapeHTML(q.Q3 || '—')}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderOverviewTabHTML(data) {
  const { races, lastRace, lastQuali } = data;
  const { nextRace } = resolveRaceTimeline(races);
  const podium = (lastRace?.Results || []).slice(0, 3);

  return `
    <div class="stack-md">
      ${renderNextRaceScheduleHTML(nextRace)}

      <div class="card cyber-frame-wrap">
        ${hudFrameOrnaments()}
        <div class="card-header">
          <div>
            <h3 class="card-title">${icon('flag')} Último Gran Premio · ${escapeHTML(lastRace?.raceName || lastQuali?.raceName || 'Sin datos')}</h3>
            <div class="f1-race-meta">
              ${lastRace
                ? `Ronda ${escapeHTML(lastRace.round)} · ${escapeHTML(lastRace.Circuit?.circuitName || '')} · ${escapeHTML(formatLocalDateTime(lastRace.date, lastRace.time, false))}`
                : 'Esperando datos de la última carrera'}
            </div>
          </div>
          <div class="f1-subtabs" role="tablist">
            <button type="button" class="f1-subtab-btn ${state.overviewSubtab === 'race' ? 'active' : ''}" data-f1-subtab="race">Carrera</button>
            <button type="button" class="f1-subtab-btn ${state.overviewSubtab === 'quali' ? 'active' : ''}" data-f1-subtab="quali">Clasificación</button>
          </div>
        </div>

        ${state.overviewSubtab === 'race' && podium.length ? `
          <div class="f1-podium-grid">
            ${podium.map(p => {
              const teamColor = getTeamColorVar(p.Constructor);
              return `
                <div class="f1-podium-card ${p.position === '1' ? 'is-p1' : ''}" style="--f1-team-color:${teamColor}">
                  <span class="f1-podium-pos">P${escapeHTML(p.position)} · ${escapeHTML(p.Driver.code || '')}</span>
                  <div class="f1-podium-driver">${escapeHTML(p.Driver.givenName)} ${escapeHTML(p.Driver.familyName)}</div>
                  <div class="f1-podium-team">
                    <span class="f1-team-dot"></span>
                    <span>${escapeHTML(p.Constructor?.name || '')}</span>
                  </div>
                  <div class="f1-podium-time">${escapeHTML(p.Time?.time || p.status || '—')} · +${escapeHTML(p.points)} pts</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        ${state.overviewSubtab === 'race'
          ? renderRaceResultsTableHTML(lastRace, true)
          : renderQualiResultsTableHTML(lastQuali)}
      </div>
    </div>
  `;
}

function renderStandingsTabHTML(data) {
  const { driverStandings, constructorStandings } = data;
  const maxDriverPts = Number(driverStandings[0]?.points) || 1;
  const maxConstructorPts = Number(constructorStandings[0]?.points) || 1;

  return `
    <div class="card cyber-frame-wrap">
      ${hudFrameOrnaments()}
      <div class="card-header">
        <h3 class="card-title">${icon('award')} Clasificación del Mundial</h3>
        <div class="f1-subtabs" role="tablist">
          <button type="button" class="f1-subtab-btn ${state.standingsSubtab === 'drivers' ? 'active' : ''}" data-f1-standings="drivers">Pilotos (${driverStandings.length})</button>
          <button type="button" class="f1-subtab-btn ${state.standingsSubtab === 'constructors' ? 'active' : ''}" data-f1-standings="constructors">Constructores (${constructorStandings.length})</button>
        </div>
      </div>

      ${state.standingsSubtab === 'drivers' ? (
        driverStandings.length ? `
          <div class="f1-table-wrap">
            <table class="f1-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Piloto</th>
                  <th class="num">Victorias</th>
                  <th class="num">Dif.</th>
                  <th class="num">Puntos</th>
                </tr>
              </thead>
              <tbody>
                ${driverStandings.map(d => {
                  const pts = Number(d.points) || 0;
                  const diff = maxDriverPts - pts;
                  const pct = Math.max(4, Math.round((pts / maxDriverPts) * 100));
                  const teamColor = getTeamColorVar(d.Constructors?.[0]);
                  return `
                    <tr>
                      <td><span class="f1-pos-pill ${d.position === '1' ? 'is-p1' : ''}">${escapeHTML(d.position)}</span></td>
                      <td>
                        <div class="f1-driver-cell" style="--f1-team-color:${teamColor}">
                          <span class="f1-driver-name">${escapeHTML(d.Driver.givenName)} ${escapeHTML(d.Driver.familyName)} <span class="f1-mono f1-driver-sub">[${escapeHTML(d.Driver.code || d.Driver.permanentNumber || '—')}]</span></span>
                          <span class="f1-driver-sub">${escapeHTML(d.Constructors?.[0]?.name || '—')} · ${escapeHTML(d.Driver.nationality || '')}</span>
                          <div class="f1-pts-bar-wrap"><div class="f1-pts-bar" style="width:${pct}%"></div></div>
                        </div>
                      </td>
                      <td class="num">${escapeHTML(d.wins)}</td>
                      <td class="num f1-driver-sub">${diff === 0 ? 'Líder' : `-${diff}`}</td>
                      <td class="num"><strong>${escapeHTML(d.points)}</strong></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `<p class="f1-driver-sub">No hay clasificación de pilotos disponible para esta temporada.</p>`
      ) : (
        constructorStandings.length ? `
          <div class="f1-table-wrap">
            <table class="f1-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Escudería</th>
                  <th class="num">Victorias</th>
                  <th class="num">Dif.</th>
                  <th class="num">Puntos</th>
                </tr>
              </thead>
              <tbody>
                ${constructorStandings.map(c => {
                  const pts = Number(c.points) || 0;
                  const diff = maxConstructorPts - pts;
                  const pct = Math.max(4, Math.round((pts / maxConstructorPts) * 100));
                  const teamColor = getTeamColorVar(c.Constructor);
                  return `
                    <tr>
                      <td><span class="f1-pos-pill ${c.position === '1' ? 'is-p1' : ''}">${escapeHTML(c.position)}</span></td>
                      <td>
                        <div class="f1-driver-cell" style="--f1-team-color:${teamColor}">
                          <span class="f1-driver-name">${escapeHTML(c.Constructor.name)}</span>
                          <span class="f1-driver-sub">${escapeHTML(c.Constructor.nationality || '')}</span>
                          <div class="f1-pts-bar-wrap"><div class="f1-pts-bar" style="width:${pct}%"></div></div>
                        </div>
                      </td>
                      <td class="num">${escapeHTML(c.wins)}</td>
                      <td class="num f1-driver-sub">${diff === 0 ? 'Líder' : `-${diff}`}</td>
                      <td class="num"><strong>${escapeHTML(c.points)}</strong></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `<p class="f1-driver-sub">No hay clasificación de constructores disponible.</p>`
      )}
    </div>
  `;
}

function renderCalendarTabHTML(data) {
  const { races } = data;
  const { nextRace } = resolveRaceTimeline(races);
  const now = Date.now();

  if (!races.length) {
    return `<div class="card"><p class="f1-driver-sub">No hay carreras registradas para esta temporada.</p></div>`;
  }

  return `
    <div class="card cyber-frame-wrap">
      ${hudFrameOrnaments()}
      <div class="card-header">
        <h3 class="card-title">${icon('calendar')} Calendario Completo · ${races.length} Grandes Premios</h3>
        <span class="f1-driver-sub">Haz clic en una carrera disputada para ver resultados, quali y pit stops</span>
      </div>
      <div class="f1-calendar-list">
        ${races.map(r => {
          const dt = parseRaceDateTime(r.date, r.time);
          const isPast = dt ? (dt.getTime() + 3 * 60 * 60 * 1000 < now) : false;
          const isNext = nextRace && nextRace.round === r.round;
          return `
            <div class="f1-race-row ${isNext ? 'is-next' : ''}">
              <div class="f1-race-row-left">
                <div class="f1-round-badge">
                  <span>Ronda</span>
                  <span>${String(r.round).padStart(2, '0')}</span>
                </div>
                <div class="f1-race-info">
                  <div class="f1-race-title">${escapeHTML(r.raceName)}</div>
                  <div class="f1-race-meta">
                    ${escapeHTML(r.Circuit?.circuitName || '')} · ${escapeHTML(r.Circuit?.Location?.locality || '')}, ${escapeHTML(r.Circuit?.Location?.country || '')}
                  </div>
                </div>
              </div>
              <div class="f1-race-row-right">
                <span class="f1-mono f1-driver-sub">${escapeHTML(formatLocalDateTime(r.date, r.time, true))}</span>
                ${isPast
                  ? `<button type="button" class="btn btn-secondary btn-sm" data-f1-round="${escapeHTML(r.round)}" style="min-height:44px;">Ver detalle</button>`
                  : `<span class="badge badge-silver">${isNext ? 'Próxima' : 'Programada'}</span>`}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderTelemetryTabHTML() {
  if (state.openf1Loading) {
    return `
      <div class="card f1-loading-box">
        <div class="f1-loading-spinner"></div>
        <p>Cargando telemetría de sesión desde OpenF1...</p>
      </div>
    `;
  }

  if (state.openf1Error) {
    return `
      <div class="card f1-error-box">
        <p>${escapeHTML(state.openf1Error)}</p>
        <button type="button" class="btn btn-secondary" id="f1-retry-openf1" style="margin-top:12px;">Reintentar OpenF1</button>
      </div>
    `;
  }

  const info = state.openf1Data;
  if (!info || !info.session) {
    return `
      <div class="card f1-error-box">
        <p>No hay datos de sesiones disponibles en OpenF1 para esta temporada (disponible desde 2023).</p>
      </div>
    `;
  }

  const { session, weather, raceControl, stints, drivers } = info;
  const driverMap = new Map();
  drivers.forEach(d => driverMap.set(d.driver_number, d));

  const stintsByDriver = new Map();
  stints.forEach(s => {
    if (!stintsByDriver.has(s.driver_number)) stintsByDriver.set(s.driver_number, []);
    stintsByDriver.get(s.driver_number).push(s);
  });

  const sortedDrivers = Array.from(stintsByDriver.keys()).sort((a, b) => a - b);
  const rcSorted = [...raceControl].reverse().slice(0, 60);

  return `
    <div class="stack-md">
      <div class="card cyber-frame-wrap">
        ${hudFrameOrnaments()}
        <div class="card-header">
          <div>
            <h3 class="card-title">${icon('body')} Última Sesión OpenF1 · ${escapeHTML(session.country_name || session.location || '')}</h3>
            <div class="f1-race-meta">${escapeHTML(session.session_name || session.session_type || '')} · ${escapeHTML(session.circuit_short_name || '')}</div>
          </div>
          <span class="cyber-tag">KEY ${escapeHTML(String(session.session_key))}</span>
        </div>

        ${weather ? `
          <div class="f1-weather-grid">
            <div class="f1-weather-box">
              <div class="f1-weather-label">Temp. Ambiente</div>
              <div class="f1-weather-val">${escapeHTML(String(weather.air_temperature ?? '—'))} °C</div>
            </div>
            <div class="f1-weather-box">
              <div class="f1-weather-label">Temp. Pista</div>
              <div class="f1-weather-val">${escapeHTML(String(weather.track_temperature ?? '—'))} °C</div>
            </div>
            <div class="f1-weather-box">
              <div class="f1-weather-label">Humedad</div>
              <div class="f1-weather-val">${escapeHTML(String(weather.humidity ?? '—'))} %</div>
            </div>
            <div class="f1-weather-box">
              <div class="f1-weather-label">Viento</div>
              <div class="f1-weather-val">${escapeHTML(String(weather.wind_speed ?? '—'))} m/s</div>
            </div>
            <div class="f1-weather-box">
              <div class="f1-weather-label">Presión</div>
              <div class="f1-weather-val">${escapeHTML(String(weather.pressure ?? '—'))} hPa</div>
            </div>
            <div class="f1-weather-box">
              <div class="f1-weather-label">Lluvia</div>
              <div class="f1-weather-val">${weather.rainfall ? 'Sí' : 'Seco'}</div>
            </div>
          </div>
        ` : `<p class="f1-driver-sub">Sin datos meteorológicos registrados para esta sesión.</p>`}
      </div>

      <div class="card cyber-frame-wrap">
        ${hudFrameOrnaments()}
        <div class="card-header">
          <h3 class="card-title">${icon('target')} Estrategia de Neumáticos (Stints)</h3>
          <span class="cyber-tag">TYRES</span>
        </div>
        ${sortedDrivers.length ? `
          <div class="f1-stints-list">
            ${sortedDrivers.map(num => {
              const drv = driverMap.get(num);
              const drvLabel = drv ? `${drv.name_acronym || drv.full_name} #${num}` : `Piloto #${num}`;
              const drvTeam = drv?.team_name || '';
              const list = stintsByDriver.get(num).sort((a, b) => (a.stint_number || 0) - (b.stint_number || 0));
              return `
                <div class="f1-stint-row">
                  <div class="f1-driver-cell" style="--f1-team-color:${getTeamColorVar(drvTeam)}">
                    <div class="f1-driver-name f1-mono">${escapeHTML(drvLabel)}</div>
                    ${drvTeam ? `<div class="f1-driver-sub">${escapeHTML(drvTeam)}</div>` : ''}
                  </div>
                  <div class="f1-stint-pills">
                    ${list.map(st => {
                      const comp = String(st.compound || 'UNKNOWN').toUpperCase();
                      const cls =
                        comp.includes('SOFT') ? 'is-soft' :
                        comp.includes('MEDIUM') ? 'is-medium' :
                        comp.includes('HARD') ? 'is-hard' :
                        comp.includes('INTER') ? 'is-inter' :
                        comp.includes('WET') ? 'is-wet' : '';
                      const laps = (st.lap_end && st.lap_start) ? `${st.lap_end - st.lap_start + 1}v` : '';
                      return `<span class="f1-tyre-pill ${cls}">${escapeHTML(comp)} ${laps ? `· ${escapeHTML(laps)}` : ''}</span>`;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `<p class="f1-driver-sub">No hay datos de stints disponibles.</p>`}
      </div>

      <div class="card cyber-frame-wrap">
        ${hudFrameOrnaments()}
        <div class="card-header">
          <h3 class="card-title">${icon('list')} Dirección de Carrera (Race Control)</h3>
          <span class="f1-driver-sub">${rcSorted.length} eventos recientes</span>
        </div>
        ${rcSorted.length ? `
          <div class="f1-rc-feed">
            ${rcSorted.map(ev => {
              const t = ev.date ? new Date(ev.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--';
              const tag = ev.flag || ev.category || '';
              return `
                <div class="f1-rc-item">
                  <span class="f1-rc-time">${escapeHTML(t)}</span>
                  <div class="f1-rc-msg">
                    ${tag ? `<span class="badge badge-silver f1-mono" style="margin-right:6px;">${escapeHTML(tag)}</span>` : ''}
                    ${escapeHTML(ev.message || '')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `<p class="f1-driver-sub">Sin mensajes de dirección de carrera registrados.</p>`}
      </div>
    </div>
  `;
}

/**
 * Construye el calendario lateral F1 con banderas en los días de carrera.
 */
function buildF1SideCalendarHTML(races = []) {
  const today = todayISO();
  const year = state.calYear;
  const month = state.calMonth;
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const pad = n => String(n).padStart(2, '0');

  const { nextRace } = resolveRaceTimeline(races);
  const now = Date.now();
  const raceByDate = new Map();
  races.forEach(r => {
    if (r.date) raceByDate.set(r.date, r);
  });

  let cells = WEEKDAYS.map(w => `<span class="hcal-weekday">${w}</span>`).join('');
  for (let i = 0; i < offset; i++) cells += '<span class="hcal-day empty"></span>';

  let monthRaces = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
    const race = raceByDate.get(iso);
    const cls = ['hcal-day'];
    let title = iso;

    if (race) {
      monthRaces++;
      const dt = parseRaceDateTime(race.date, race.time);
      const isPast = dt ? dt.getTime() + 3 * 60 * 60 * 1000 < now : false;
      const isNext = nextRace && nextRace.round === race.round;
      cls.push('f1-has-race', isNext ? 'f1-race-next' : isPast ? 'f1-race-past' : 'f1-race-future');
      title = `R${race.round} · ${race.raceName}`;
    }
    if (iso === today) cls.push('is-today');
    if (state.selectedDate && iso === state.selectedDate) cls.push('is-selected');

    cells += `
      <button type="button" class="${cls.join(' ')}" data-f1-cal-day="${iso}" title="${escapeHTML(title)}">
        <span>${d}</span>
        ${race ? `<span class="f1-cal-flag-icon">${icon('flag')}</span>` : ''}
      </button>
    `;
  }

  return `
    <div class="hcal-header">
      <span class="hcal-title">${MONTHS[month]} <span class="text-muted">${year}</span></span>
      <div class="hcal-nav">
        <button type="button" class="btn-icon" data-f1-cal-nav="prev" aria-label="Mes anterior">${icon('chevronLeft')}</button>
        <button type="button" class="btn-icon hcal-today-btn" data-f1-cal-nav="today" title="Ir a hoy">Hoy</button>
        <button type="button" class="btn-icon" data-f1-cal-nav="next" aria-label="Mes siguiente">${icon('chevronRight')}</button>
      </div>
    </div>
    <div class="hcal-grid">${cells}</div>
    <div class="hcal-footer">
      <span>GPs del mes: <span class="mono">${monthRaces}</span></span>
      <span class="hcal-scale" aria-hidden="true">
        <span class="f1-cal-flag-icon">${icon('flag')}</span> carrera
      </span>
    </div>
  `;
}

function renderAsideRaceSummaryHTML(data) {
  const { races, season } = data;
  const race = races.find(r => r.date === state.selectedDate);

  if (!race) {
    return `
      <div class="card-header">
        <h2 class="card-title">${icon('flag')} Resumen GP</h2>
        <span class="cyber-tag">F1</span>
      </div>
      <p class="body-summary-text">
        Selecciona una fecha marcada con bandera en el calendario para inspeccionar el resumen de ese Gran Premio.
      </p>
    `;
  }

  const dt = parseRaceDateTime(race.date, race.time);
  const isPast = dt ? dt.getTime() + 3 * 60 * 60 * 1000 < Date.now() : false;
  const cacheKey = `${season}_${race.round}`;
  const details = state.asideRoundCache.get(cacheKey);

  let bodyHTML = '';
  if (!isPast) {
    bodyHTML = `
      <div class="f1-aside-summary-box">
        <div class="f1-aside-race-name">R${escapeHTML(race.round)} · ${escapeHTML(race.raceName)}</div>
        <div class="f1-driver-sub">${escapeHTML(race.Circuit?.circuitName || '')}</div>
        <div class="f1-mono f1-driver-sub">${escapeHTML(formatLocalDateTime(race.date, race.time, true))}</div>
        <span class="badge badge-silver" style="align-self:flex-start;">Próxima / Programada</span>
      </div>
    `;
  } else if (state.asideRoundLoading && !details) {
    bodyHTML = `
      <div class="f1-aside-summary-box">
        <div class="f1-aside-race-name">R${escapeHTML(race.round)} · ${escapeHTML(race.raceName)}</div>
        <p class="body-summary-text">Cargando resumen de la carrera...</p>
      </div>
    `;
  } else if (details?.race?.Results?.length) {
    const top3 = details.race.Results.slice(0, 3);
    const pole = details.quali?.QualifyingResults?.[0];
    const fastest = details.race.Results.find(r => r.FastestLap?.rank === '1');
    bodyHTML = `
      <div class="f1-aside-summary-box">
        <div class="f1-aside-race-name">R${escapeHTML(race.round)} · ${escapeHTML(race.raceName)}</div>
        <div class="f1-driver-sub">${escapeHTML(race.Circuit?.Location?.locality || '')}, ${escapeHTML(race.Circuit?.Location?.country || '')}</div>
        <div class="f1-aside-podium-list">
          ${top3.map(p => `
            <div class="f1-aside-podium-item" style="--f1-team-color:${getTeamColorVar(p.Constructor)}">
              <span><strong>P${escapeHTML(p.position)}</strong> ${escapeHTML(p.Driver.code || p.Driver.familyName)}</span>
              <span class="f1-mono">${escapeHTML(p.Time?.time || p.status || '')}</span>
            </div>
          `).join('')}
        </div>
        ${pole ? `<div class="f1-driver-sub f1-mono">POLE: ${escapeHTML(pole.Driver.code || pole.Driver.familyName)} (${escapeHTML(pole.Q3 || pole.Q2 || pole.Q1 || '')})</div>` : ''}
        ${fastest ? `<div class="f1-driver-sub f1-mono">VR: ${escapeHTML(fastest.Driver.code || fastest.Driver.familyName)} (${escapeHTML(fastest.FastestLap?.Time?.time || '')})</div>` : ''}
        <button type="button" class="btn btn-secondary btn-sm" data-f1-round="${escapeHTML(race.round)}" style="min-height:44px;margin-top:4px;">
          Ver resultados completos
        </button>
      </div>
    `;
  } else {
    bodyHTML = `
      <div class="f1-aside-summary-box">
        <div class="f1-aside-race-name">R${escapeHTML(race.round)} · ${escapeHTML(race.raceName)}</div>
        <p class="body-summary-text">Sin resultados publicados todavía para esta ronda.</p>
      </div>
    `;
  }

  return `
    <div class="card-header">
      <h2 class="card-title">${icon('flag')} Resumen GP</h2>
      <span class="cyber-tag">R${String(race.round).padStart(2, '0')}</span>
    </div>
    ${bodyHTML}
  `;
}

async function ensureAsideRaceSummary(container, race) {
  if (!race || !state.data) return;
  const dt = parseRaceDateTime(race.date, race.time);
  const isPast = dt ? dt.getTime() + 3 * 60 * 60 * 1000 < Date.now() : false;
  if (!isPast) return;

  const season = state.data.season;
  const cacheKey = `${season}_${race.round}`;
  if (state.asideRoundCache.has(cacheKey)) return;

  state.asideRoundLoading = true;
  const summaryNode = container.querySelector('#f1-aside-summary');
  if (summaryNode) summaryNode.innerHTML = renderAsideRaceSummaryHTML(state.data);

  try {
    const details = await fetchRoundDetails(season, race.round);
    state.asideRoundCache.set(cacheKey, details);
  } catch {
    // noop
  }
  state.asideRoundLoading = false;
  if (document.body.contains(container)) {
    const targetNode = container.querySelector('#f1-aside-summary');
    if (targetNode) {
      targetNode.innerHTML = renderAsideRaceSummaryHTML(state.data);
      targetNode.querySelectorAll('[data-f1-round]').forEach(btn => {
        btn.addEventListener('click', () => openRoundModal(state.data.season, btn.dataset.f1Round));
      });
    }
  }
}

async function openDriverDetail(container, driverId) {
  if (!state.data) return;
  state.heroMode = 'drivers';
  state.selectedDriverId = driverId;
  const cacheKey = `${state.data.season}_${driverId}`;

  if (!state.driverDetailCache.has(cacheKey)) {
    state.entityDetailLoading = true;
    paintView(container);
    try {
      const races = await fetchDriverSeasonResults(state.data.season, driverId);
      state.driverDetailCache.set(cacheKey, races);
    } catch {
      state.driverDetailCache.set(cacheKey, []);
    }
    state.entityDetailLoading = false;
  }
  paintView(container);
}

async function openConstructorDetail(container, constructorId) {
  if (!state.data) return;
  state.heroMode = 'constructors';
  state.selectedConstructorId = constructorId;
  const cacheKey = `${state.data.season}_${constructorId}`;

  if (!state.constructorDetailCache.has(cacheKey)) {
    state.entityDetailLoading = true;
    paintView(container);
    try {
      const races = await fetchConstructorSeasonResults(state.data.season, constructorId);
      state.constructorDetailCache.set(cacheKey, races);
    } catch {
      state.constructorDetailCache.set(cacheKey, []);
    }
    state.entityDetailLoading = false;
  }
  paintView(container);
}

async function openRoundModal(season, round) {
  openModal({
    title: `Ronda ${round} · Temporada ${season}`,
    contentHTML: `
      <div class="f1-loading-box">
        <div class="f1-loading-spinner"></div>
        <p>Cargando resultados completos de la ronda...</p>
      </div>
    `
  });

  try {
    const details = await fetchRoundDetails(season, round);
    state.asideRoundCache.set(`${season}_${round}`, details);
    const body = document.querySelector('#active-modal .modal-body');
    const titleEl = document.querySelector('#active-modal .modal-title');
    if (!body) return;

    const raceName = details.race?.raceName || details.quali?.raceName || `Ronda ${round}`;
    if (titleEl) titleEl.textContent = `${raceName} (${season})`;

    let modalTab = 'race';
    const renderModalContent = () => {
      const hasSprint = Boolean(details.sprint?.SprintResults?.length);
      const hasPits = Boolean(details.pits?.length);
      let inner = '';

      if (modalTab === 'race') {
        inner = renderRaceResultsTableHTML(details.race, true);
      } else if (modalTab === 'quali') {
        inner = renderQualiResultsTableHTML(details.quali);
      } else if (modalTab === 'sprint') {
        inner = renderRaceResultsTableHTML({ Results: details.sprint?.SprintResults || [] }, true);
      } else if (modalTab === 'pits') {
        inner = `
          <div class="f1-table-wrap">
            <table class="f1-table">
              <thead>
                <tr>
                  <th>Parada</th>
                  <th>Piloto ID</th>
                  <th class="num">Vuelta</th>
                  <th class="num">Hora</th>
                  <th class="num">Duración</th>
                </tr>
              </thead>
              <tbody>
                ${details.pits.map(p => `
                  <tr>
                    <td class="f1-mono">#${escapeHTML(p.stop)}</td>
                    <td class="f1-mono">${escapeHTML(p.driverId)}</td>
                    <td class="num">${escapeHTML(p.lap)}</td>
                    <td class="num">${escapeHTML(p.time)}</td>
                    <td class="num"><strong>${escapeHTML(p.duration)}s</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      body.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
          <div class="f1-subtabs">
            <button type="button" class="f1-subtab-btn ${modalTab === 'race' ? 'active' : ''}" data-m-tab="race">Carrera</button>
            <button type="button" class="f1-subtab-btn ${modalTab === 'quali' ? 'active' : ''}" data-m-tab="quali">Clasificación</button>
            ${hasSprint ? `<button type="button" class="f1-subtab-btn ${modalTab === 'sprint' ? 'active' : ''}" data-m-tab="sprint">Sprint</button>` : ''}
            ${hasPits ? `<button type="button" class="f1-subtab-btn ${modalTab === 'pits' ? 'active' : ''}" data-m-tab="pits">Pit Stops (${details.pits.length})</button>` : ''}
          </div>
        </div>
        ${inner}
      `;

      body.querySelectorAll('[data-m-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          modalTab = btn.dataset.mTab;
          renderModalContent();
        });
      });
    };

    renderModalContent();
  } catch (err) {
    const body = document.querySelector('#active-modal .modal-body');
    if (body) {
      body.innerHTML = `<div class="f1-error-box"><p>No se pudieron cargar los detalles de esta ronda (${escapeHTML(err.message)}).</p></div>`;
    }
  }
}

async function loadOverview(container, forceRefresh = false) {
  state.loading = true;
  state.error = null;
  paintView(container);

  try {
    const overview = await fetchSeasonOverview(state.season, forceRefresh);
    state.data = overview;
    state.calYear = null;
    state.calMonth = null;
    state.selectedDriverId = null;
    state.selectedConstructorId = null;
    syncCalendarInitialState(overview.races);
    state.loading = false;
    if (forceRefresh) {
      showToast('Datos de Fórmula 1 actualizados', 'success');
    }

    // Cargar fotos de pilotos desde OpenF1 en segundo plano
    fetchOpenF1DriverHeadshots(overview.season, forceRefresh)
      .then(map => {
        state.driverHeadshots = map || {};
        if (document.body.contains(container) && (state.heroMode === 'drivers' || state.heroMode === 'constructors')) {
          paintView(container);
        }
      })
      .catch(() => {});
  } catch (err) {
    state.loading = false;
    state.error = err?.message || 'Error al consultar la API de Fórmula 1.';
  }
  paintView(container);

  if (state.data?.races?.length) {
    const selectedRace = state.data.races.find(r => r.date === state.selectedDate);
    if (selectedRace) ensureAsideRaceSummary(container, selectedRace);
  }
}

async function loadOpenF1(container, forceRefresh = false) {
  const targetYear = state.data?.season || (state.season === 'current' ? new Date().getFullYear() : state.season);
  state.openf1Loading = true;
  state.openf1Error = null;
  paintView(container);

  try {
    const res = await fetchOpenF1LatestSession(targetYear, forceRefresh);
    state.openf1Data = res;
    state.openf1SeasonLoaded = String(targetYear);
    state.openf1Loading = false;
  } catch (err) {
    state.openf1Loading = false;
    state.openf1Error = `No se pudo conectar con OpenF1 (${err?.message || 'error de red'}).`;
  }
  paintView(container);
}

function paintView(container) {
  clearCountdownTimer();
  const years = getSeasonOptions();
  const syncText = state.data?.fetchedAt
    ? `Act. ${new Date(state.data.fetchedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}${state.data.stale ? ' (caché offline)' : ''}`
    : 'Sin sincronizar';

  if (state.data?.races) {
    syncCalendarInitialState(state.data.races);
  }

  container.innerHTML = `
    <section class="page-section">
      <header class="page-header">
        <div>
          <h1 class="page-title">Fórmula 1 <span class="cyber-tag">PADDOCK // HUD</span></h1>
          <p class="page-subtitle">Resultados, campeonato, calendario mundial y telemetría de sesión</p>
        </div>
        <div class="f1-header-controls">
          <span class="f1-sync-meta">
            <span class="f1-sync-dot ${state.data?.stale ? 'is-stale' : ''}"></span>
            <span>${escapeHTML(syncText)}</span>
          </span>
          <select id="f1-season-select" class="f1-season-select" aria-label="Seleccionar temporada">
            <option value="current" ${state.season === 'current' ? 'selected' : ''}>Temporada Actual</option>
            ${years.map(y => `<option value="${y}" ${state.season === y ? 'selected' : ''}>Temporada ${y}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-secondary" id="f1-refresh-btn" style="min-height:44px;">
            ${icon('refresh')}
            <span>Actualizar</span>
          </button>
        </div>
      </header>

      ${state.loading ? `
        <div class="card f1-loading-box">
          <div class="f1-loading-spinner"></div>
          <p>Sincronizando datos oficiales de Fórmula 1...</p>
        </div>
      ` : state.error ? `
        <div class="card f1-error-box">
          <p>${escapeHTML(state.error)}</p>
          <button type="button" class="btn btn-primary" id="f1-retry-btn" style="margin-top:12px;">Reintentar</button>
        </div>
      ` : state.data ? `
        ${renderKpisHTML(state.data)}

        ${renderHeroPanelHTML(state.data)}

        <div class="f1-tabs" role="tablist" aria-label="Secciones de Fórmula 1">
          <button type="button" class="f1-tab-btn ${state.activeTab === 'overview' ? 'active' : ''}" data-f1-tab="overview">
            ${icon('flag')} <span>Resumen & Último GP</span>
          </button>
          <button type="button" class="f1-tab-btn ${state.activeTab === 'standings' ? 'active' : ''}" data-f1-tab="standings">
            ${icon('award')} <span>Campeonato</span>
          </button>
          <button type="button" class="f1-tab-btn ${state.activeTab === 'calendar' ? 'active' : ''}" data-f1-tab="calendar">
            ${icon('calendar')} <span>Calendario</span>
          </button>
          <button type="button" class="f1-tab-btn ${state.activeTab === 'telemetry' ? 'active' : ''}" data-f1-tab="telemetry">
            ${icon('body')} <span>Pista & OpenF1</span>
          </button>
        </div>

        <div id="f1-tab-content">
          ${state.activeTab === 'overview' ? renderOverviewTabHTML(state.data) : ''}
          ${state.activeTab === 'standings' ? renderStandingsTabHTML(state.data) : ''}
          ${state.activeTab === 'calendar' ? renderCalendarTabHTML(state.data) : ''}
          ${state.activeTab === 'telemetry' ? renderTelemetryTabHTML() : ''}
        </div>
      ` : ''}
    </section>

    ${state.data ? `
      <aside class="section-aside" aria-label="Calendario lateral de Fórmula 1">
        <section class="card habit-calendar" id="f1-side-calendar" aria-label="Calendario de carreras">
          ${buildF1SideCalendarHTML(state.data.races)}
        </section>
        <section class="card" id="f1-aside-summary">
          ${renderAsideRaceSummaryHTML(state.data)}
        </section>
      </aside>
    ` : ''}
  `;

  // Bind eventos principales
  container.querySelector('#f1-season-select')?.addEventListener('change', (e) => {
    state.season = e.target.value;
    state.openf1Data = null;
    state.openf1SeasonLoaded = null;
    state.calYear = null;
    state.calMonth = null;
    loadOverview(container, false);
  });

  container.querySelector('#f1-refresh-btn')?.addEventListener('click', () => {
    if (state.activeTab === 'telemetry') {
      loadOpenF1(container, true);
    } else {
      loadOverview(container, true);
    }
  });

  container.querySelector('#f1-retry-btn')?.addEventListener('click', () => loadOverview(container, true));
  container.querySelector('#f1-retry-openf1')?.addEventListener('click', () => loadOpenF1(container, true));

  // Bind Hero Switcher (Mapa / Pilotos / Escuderías)
  container.querySelectorAll('[data-f1-hero]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.heroMode = btn.dataset.f1Hero;
      state.selectedDriverId = null;
      state.selectedConstructorId = null;
      paintView(container);
    });
  });

  container.querySelectorAll('[data-select-driver]').forEach(btn => {
    btn.addEventListener('click', () => openDriverDetail(container, btn.dataset.selectDriver));
  });

  container.querySelectorAll('[data-jump-driver]').forEach(btn => {
    btn.addEventListener('click', () => openDriverDetail(container, btn.dataset.jumpDriver));
  });

  container.querySelector('#f1-back-drivers')?.addEventListener('click', () => {
    state.selectedDriverId = null;
    paintView(container);
  });

  container.querySelectorAll('[data-select-constructor]').forEach(btn => {
    btn.addEventListener('click', () => openConstructorDetail(container, btn.dataset.selectConstructor));
  });

  container.querySelector('#f1-back-constructors')?.addEventListener('click', () => {
    state.selectedConstructorId = null;
    paintView(container);
  });

  container.querySelectorAll('[data-f1-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.f1Tab;
      if (state.activeTab === 'telemetry') {
        const targetYear = String(state.data?.season || (state.season === 'current' ? new Date().getFullYear() : state.season));
        if (!state.openf1Data || state.openf1SeasonLoaded !== targetYear) {
          loadOpenF1(container, false);
          return;
        }
      }
      paintView(container);
    });
  });

  container.querySelectorAll('[data-f1-subtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.overviewSubtab = btn.dataset.f1Subtab;
      paintView(container);
    });
  });

  container.querySelectorAll('[data-f1-standings]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.standingsSubtab = btn.dataset.f1Standings;
      paintView(container);
    });
  });

  container.querySelectorAll('[data-f1-round]').forEach(btn => {
    btn.addEventListener('click', () => {
      const round = btn.dataset.f1Round;
      const season = state.data?.season || new Date().getFullYear();
      openRoundModal(season, round);
    });
  });

  // Bind Mapa Mundi Cyberpunk
  if (state.data?.races?.length && state.heroMode === 'map') {
    bindF1WorldMap(container, {
      onSelectRound: (round, status) => {
        const race = state.data.races.find(r => r.round === round);
        if (race?.date) {
          const [y, m] = race.date.split('-').map(Number);
          state.calYear = y;
          state.calMonth = m - 1;
          state.selectedDate = race.date;
          if (status === 'past') {
            openRoundModal(state.data.season, round);
          } else {
            paintView(container);
          }
        }
      }
    });
  }

  // Bind Calendario Lateral
  container.querySelectorAll('[data-f1-cal-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.f1CalNav;
      if (dir === 'today') {
        const today = todayISO();
        const [y, m] = today.split('-').map(Number);
        state.calYear = y;
        state.calMonth = m - 1;
        state.selectedDate = today;
      } else if (dir === 'prev') {
        state.calMonth--;
        if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
      } else if (dir === 'next') {
        state.calMonth++;
        if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
      }
      paintView(container);
    });
  });

  container.querySelectorAll('[data-f1-cal-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      const iso = btn.dataset.f1CalDay;
      state.selectedDate = iso;
      paintView(container);
      const race = state.data?.races?.find(r => r.date === iso);
      if (race) ensureAsideRaceSummary(container, race);
    });
  });

  // Cuenta regresiva en vivo para el próximo GP
  if (state.data?.races?.length) {
    const { nextRace } = resolveRaceTimeline(state.data.races);
    const countdownEl = container.querySelector('#f1-countdown-value');
    if (nextRace && countdownEl) {
      const target = parseRaceDateTime(nextRace.date, nextRace.time);
      if (target) {
        state.countdownTimer = setInterval(() => {
          if (!document.body.contains(countdownEl)) {
            clearCountdownTimer();
            return;
          }
          countdownEl.textContent = formatCountdownText(target);
        }, 1000);
      }
    }
  }
}

export function renderF1(container) {
  if (!state.data && !state.loading) {
    loadOverview(container, false);
  } else {
    paintView(container);
  }
}
