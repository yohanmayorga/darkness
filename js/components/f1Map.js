import { escapeHTML } from '../utils/text.js?v=4.3.0';
import { parseRaceDateTime, resolveRaceTimeline } from '../services/f1.js?v=1.0.0';

const WORLD_TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json';
const WORLD_CACHE_KEY = 'darkness_f1_world_paths_v1';

// Límites geográficos para recortar la Antártida y aprovechar todo el ancho
const LAT_MAX = 83;
const LAT_MIN = -58;
const VIEW_W = 1000;
const VIEW_H = 440;

let memoryLandPaths = null;

function projectCoords(latStr, lonStr) {
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  const clampedLat = Math.max(LAT_MIN, Math.min(LAT_MAX, lat));
  const x = ((lon + 180) / 360) * VIEW_W;
  const y = ((LAT_MAX - clampedLat) / (LAT_MAX - LAT_MIN)) * VIEW_H;
  return { x, y };
}

function decodeArc(arc, transform) {
  const { scale, translate } = transform;
  const pts = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < arc.length; i++) {
    x += arc[i][0];
    y += arc[i][1];
    pts.push([x * scale[0] + translate[0], y * scale[1] + translate[1]]);
  }
  return pts;
}

function decodeRing(arcIndices, decodedArcs) {
  const coords = [];
  for (let i = 0; i < arcIndices.length; i++) {
    const idx = arcIndices[i];
    const arcPts = idx >= 0 ? decodedArcs[idx] : [...decodedArcs[~idx]].reverse();
    for (let j = i === 0 ? 0 : 1; j < arcPts.length; j++) {
      coords.push(arcPts[j]);
    }
  }
  return coords;
}

function ringToSvgPath(ring) {
  if (!ring || ring.length < 2) return '';
  let d = '';
  let prevLon = null;
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    if (lat < LAT_MIN - 5) continue;
    const pt = projectCoords(lat, lon);
    if (!pt) continue;
    const jump = prevLon !== null && Math.abs(lon - prevLon) > 180;
    d += `${i === 0 || jump || d === '' ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    prevLon = lon;
  }
  return d ? `${d}Z` : '';
}

function extractTopoLandPaths(topology) {
  const decodedArcs = topology.arcs.map(a => decodeArc(a, topology.transform));
  const paths = [];

  const walk = (geom) => {
    if (!geom) return;
    if (geom.type === 'GeometryCollection' && Array.isArray(geom.geometries)) {
      geom.geometries.forEach(walk);
    } else if (geom.type === 'Polygon' && Array.isArray(geom.arcs)) {
      const d = geom.arcs.map(ring => ringToSvgPath(decodeRing(ring, decodedArcs))).join('');
      if (d) paths.push(d);
    } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.arcs)) {
      geom.arcs.forEach(poly => {
        const d = poly.map(ring => ringToSvgPath(decodeRing(ring, decodedArcs))).join('');
        if (d) paths.push(d);
      });
    }
  };

  walk(topology.objects?.land);
  return paths;
}

function getCachedLandPaths() {
  if (memoryLandPaths) return memoryLandPaths;
  try {
    const raw = localStorage.getItem(WORLD_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryLandPaths = parsed;
        return parsed;
      }
    }
  } catch {
    // noop
  }
  return null;
}

async function ensureLandPaths() {
  const cached = getCachedLandPaths();
  if (cached) return cached;

  const res = await fetch(WORLD_TOPO_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const topo = await res.json();
  const paths = extractTopoLandPaths(topo);
  memoryLandPaths = paths;
  try {
    localStorage.setItem(WORLD_CACHE_KEY, JSON.stringify(paths));
  } catch {
    // noop
  }
  return paths;
}

/**
 * Renderiza el Mapa Mundi Cyberpunk con todas las sedes de la temporada.
 */
export function renderF1WorldMapHTML(races = []) {
  const { nextRace } = resolveRaceTimeline(races);
  const now = Date.now();
  const landPaths = getCachedLandPaths();

  const points = races
    .map(r => {
      const coords = projectCoords(r.Circuit?.Location?.lat, r.Circuit?.Location?.long);
      if (!coords) return null;
      const dt = parseRaceDateTime(r.date, r.time);
      const isPast = dt ? dt.getTime() + 3 * 60 * 60 * 1000 < now : false;
      const isNext = nextRace && nextRace.round === r.round;
      const status = isNext ? 'next' : isPast ? 'past' : 'future';
      return { race: r, x: coords.x, y: coords.y, status };
    })
    .filter(Boolean);

  const routePath = points.length > 1
    ? `M ${points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`
    : '';

  // Línea del ecuador (lat = 0)
  const equatorY = projectCoords(0, 0).y.toFixed(1);

  return `
    <div class="f1-map-wrap" id="f1-world-map">
      <div class="f1-map-hud-overlay" aria-hidden="true">
        <span class="cyber-tag">GEO-GRID // F1 WORLD</span>
        <span class="f1-mono f1-map-coords" id="f1-map-active-label">
          ${nextRace ? `NEXT: R${String(nextRace.round).padStart(2, '0')} · ${escapeHTML(nextRace.Circuit?.Location?.country || '')}` : `${points.length} SEDES`}
        </span>
      </div>

      <svg class="f1-world-svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa mundial de circuitos de Fórmula 1">
        <defs>
          <pattern id="f1-map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="var(--f1-map-grid-line)" stroke-width="0.6" />
          </pattern>
          <pattern id="f1-land-dots" width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="0.7" fill="rgba(56, 189, 248, 0.24)" />
          </pattern>
          <filter id="f1-neon-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Retícula táctica y meridianos -->
        <rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" fill="url(#f1-map-grid)" />
        <line x1="0" y1="${equatorY}" x2="${VIEW_W}" y2="${equatorY}" stroke="var(--f1-map-equator)" stroke-width="0.8" stroke-dasharray="4 6" />
        <line x1="500" y1="0" x2="500" y2="${VIEW_H}" stroke="var(--f1-map-equator)" stroke-width="0.8" stroke-dasharray="4 6" />

        <!-- Cartografía real (se rellena inmediatamente si está en caché o vía fetch) -->
        <g class="f1-map-continents" id="f1-map-land-group">
          ${landPaths ? landPaths.map(d => `<path d="${d}" />`).join('') : ''}
        </g>

        <!-- Ruta de temporada -->
        ${routePath ? `<path class="f1-map-route" d="${routePath}" fill="none" />` : ''}

        <!-- Puntos de Grandes Premios -->
        <g class="f1-map-points">
          ${points.map(pt => {
            const r = pt.race;
            const cx = pt.x.toFixed(1);
            const cy = pt.y.toFixed(1);
            const label = `R${String(r.round).padStart(2, '0')} · ${r.raceName}`;
            return `
              <g class="f1-map-pin is-${pt.status}"
                 data-map-round="${escapeHTML(r.round)}"
                 data-map-name="${escapeHTML(r.raceName)}"
                 data-map-circuit="${escapeHTML(r.Circuit?.circuitName || '')}"
                 data-map-loc="${escapeHTML(`${r.Circuit?.Location?.locality || ''}, ${r.Circuit?.Location?.country || ''}`)}"
                 data-map-date="${escapeHTML(r.date || '')}"
                 data-map-status="${pt.status}"
                 tabindex="0"
                 role="button"
                 aria-label="${escapeHTML(label)}">
                ${pt.status === 'next' ? `
                  <circle class="f1-pin-pulse-outer" cx="${cx}" cy="${cy}" r="13" />
                  <circle class="f1-pin-pulse-inner" cx="${cx}" cy="${cy}" r="8" />
                ` : ''}
                <circle class="f1-pin-hit" cx="${cx}" cy="${cy}" r="10" fill="transparent" />
                <circle class="f1-pin-dot" cx="${cx}" cy="${cy}" r="${pt.status === 'next' ? '4.5' : '2.9'}" ${pt.status === 'next' ? 'filter="url(#f1-neon-glow)"' : ''} />
                ${pt.status === 'next' ? `
                  <text class="f1-pin-tag" x="${Number(cx) > 840 ? Number(cx) - 9 : Number(cx) + 9}" y="${Number(cy) - 7}" text-anchor="${Number(cx) > 840 ? 'end' : 'start'}">
                    R${String(r.round).padStart(2, '0')}
                  </text>
                ` : ''}
              </g>
            `;
          }).join('')}
        </g>
      </svg>

      <div class="f1-map-tooltip" id="f1-map-tooltip" hidden></div>

      <div class="f1-map-legend">
        <span class="f1-legend-item"><i class="is-past"></i> Disputada</span>
        <span class="f1-legend-item"><i class="is-next"></i> Próxima / Actual</span>
        <span class="f1-legend-item"><i class="is-future"></i> Programada</span>
      </div>
    </div>
  `;
}

/**
 * Conecta interactividad (hover/tap tooltip y clic en GP) y carga la cartografía si no está en caché.
 */
export function bindF1WorldMap(container, { onSelectRound }) {
  const wrap = container.querySelector('#f1-world-map');
  const tooltip = container.querySelector('#f1-map-tooltip');
  if (!wrap || !tooltip) return;

  const landGroup = wrap.querySelector('#f1-map-land-group');
  if (landGroup && landGroup.children.length === 0) {
    ensureLandPaths()
      .then(paths => {
        if (document.body.contains(landGroup)) {
          landGroup.innerHTML = paths.map(d => `<path d="${d}" />`).join('');
        }
      })
      .catch(() => {
        // Si no hay red, mantiene la retícula y coordenadas limpias sin romper el mapa
      });
  }

  const showTip = (pin) => {
    const round = pin.dataset.mapRound;
    const name = pin.dataset.mapName;
    const circuit = pin.dataset.mapCircuit;
    const loc = pin.dataset.mapLoc;
    const date = pin.dataset.mapDate;
    const status = pin.dataset.mapStatus;

    const statusLabel = status === 'next' ? 'PRÓXIMA' : status === 'past' ? 'DISPUTADA' : 'PROGRAMADA';
    tooltip.innerHTML = `
      <div class="f1-tip-head">
        <span class="f1-mono">R${String(round).padStart(2, '0')}</span>
        <span class="f1-tip-status is-${status}">${statusLabel}</span>
      </div>
      <div class="f1-tip-title">${escapeHTML(name)}</div>
      <div class="f1-tip-sub">${escapeHTML(circuit)}</div>
      <div class="f1-tip-sub f1-mono">${escapeHTML(loc)} · ${escapeHTML(date)}</div>
    `;
    tooltip.hidden = false;

    const wrapRect = wrap.getBoundingClientRect();
    const pinRect = pin.getBoundingClientRect();
    const left = Math.max(8, Math.min(wrapRect.width - 230, pinRect.left - wrapRect.left + 12));
    const top = Math.max(8, pinRect.top - wrapRect.top - 12);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  const hideTip = () => {
    tooltip.hidden = true;
  };

  wrap.querySelectorAll('.f1-map-pin').forEach(pin => {
    pin.addEventListener('mouseenter', () => showTip(pin));
    pin.addEventListener('mouseleave', hideTip);
    pin.addEventListener('focus', () => showTip(pin));
    pin.addEventListener('blur', hideTip);
    pin.addEventListener('click', () => {
      showTip(pin);
      if (typeof onSelectRound === 'function') {
        onSelectRound(pin.dataset.mapRound, pin.dataset.mapStatus);
      }
    });
  });
}
