import { escapeHTML } from '../utils/text.js?v=4.3.0';
import { parseRaceDateTime } from '../services/f1.js?v=1.1.0';

const CIRCUIT_GEOJSON_BASE = 'https://cdn.jsdelivr.net/gh/bacinger/f1-circuits@master/circuits';
const CIRCUIT_LOCATIONS_URL = 'https://cdn.jsdelivr.net/gh/bacinger/f1-circuits@master/f1-locations.json';
const CIRCUIT_SVG_CACHE_PREFIX = 'darkness_f1_circuit_svg_v1_';
let locationsIndexPromise = null;

/**
 * Mapeo de circuitId (Jolpica/Ergast) al ID de archivo en bacinger/f1-circuits
 * junto con metadatos técnicos relevantes de cada trazado.
 */
export const CIRCUIT_META = {
  bahrain: {
    file: 'bh-2002',
    lengthKm: '5.412',
    laps: 57,
    turns: 15,
    direction: 'Horario',
    firstGp: 2004,
    lapRecord: '1:31.447 · P. de la Rosa (2005)'
  },
  jeddah: {
    file: 'sa-2021',
    lengthKm: '6.174',
    laps: 50,
    turns: 27,
    direction: 'Antihorario',
    firstGp: 2021,
    lapRecord: '1:30.734 · L. Hamilton (2021)'
  },
  albert_park: {
    file: 'au-1953',
    lengthKm: '5.278',
    laps: 58,
    turns: 14,
    direction: 'Horario',
    firstGp: 1996,
    lapRecord: '1:19.813 · C. Leclerc (2024)'
  },
  suzuka: {
    file: 'jp-1962',
    lengthKm: '5.807',
    laps: 53,
    turns: 18,
    direction: 'Mixto (en 8)',
    firstGp: 1987,
    lapRecord: '1:30.983 · L. Hamilton (2019)'
  },
  shanghai: {
    file: 'cn-2004',
    lengthKm: '5.451',
    laps: 56,
    turns: 16,
    direction: 'Horario',
    firstGp: 2004,
    lapRecord: '1:32.238 · M. Schumacher (2004)'
  },
  miami: {
    file: 'us-2022',
    lengthKm: '5.412',
    laps: 57,
    turns: 19,
    direction: 'Antihorario',
    firstGp: 2022,
    lapRecord: '1:29.708 · M. Verstappen (2023)'
  },
  imola: {
    file: 'it-1953',
    lengthKm: '4.909',
    laps: 63,
    turns: 19,
    direction: 'Antihorario',
    firstGp: 1980,
    lapRecord: '1:15.484 · L. Hamilton (2020)'
  },
  monaco: {
    file: 'mc-1929',
    lengthKm: '3.337',
    laps: 78,
    turns: 19,
    direction: 'Horario',
    firstGp: 1950,
    lapRecord: '1:12.909 · L. Hamilton (2021)'
  },
  villeneuve: {
    file: 'ca-1978',
    lengthKm: '4.361',
    laps: 70,
    turns: 14,
    direction: 'Horario',
    firstGp: 1978,
    lapRecord: '1:13.078 · V. Bottas (2019)'
  },
  catalunya: {
    file: 'es-1991',
    lengthKm: '4.657',
    laps: 66,
    turns: 14,
    direction: 'Horario',
    firstGp: 1991,
    lapRecord: '1:16.330 · M. Verstappen (2023)'
  },
  red_bull_ring: {
    file: 'at-1969',
    lengthKm: '4.318',
    laps: 71,
    turns: 10,
    direction: 'Horario',
    firstGp: 1970,
    lapRecord: '1:05.619 · C. Sainz (2020)'
  },
  silverstone: {
    file: 'gb-1948',
    lengthKm: '5.891',
    laps: 52,
    turns: 18,
    direction: 'Horario',
    firstGp: 1950,
    lapRecord: '1:27.097 · M. Verstappen (2020)'
  },
  hungaroring: {
    file: 'hu-1986',
    lengthKm: '4.381',
    laps: 70,
    turns: 14,
    direction: 'Horario',
    firstGp: 1986,
    lapRecord: '1:16.627 · L. Hamilton (2020)'
  },
  spa: {
    file: 'be-1925',
    lengthKm: '7.004',
    laps: 44,
    turns: 19,
    direction: 'Horario',
    firstGp: 1950,
    lapRecord: '1:44.701 · S. Pérez (2024)'
  },
  zandvoort: {
    file: 'nl-1948',
    lengthKm: '4.259',
    laps: 72,
    turns: 14,
    direction: 'Horario',
    firstGp: 1952,
    lapRecord: '1:11.097 · L. Hamilton (2021)'
  },
  monza: {
    file: 'it-1922',
    lengthKm: '5.793',
    laps: 53,
    turns: 11,
    direction: 'Horario',
    firstGp: 1950,
    lapRecord: '1:21.046 · R. Barrichello (2004)'
  },
  baku: {
    file: 'az-2016',
    lengthKm: '6.003',
    laps: 51,
    turns: 20,
    direction: 'Antihorario',
    firstGp: 2016,
    lapRecord: '1:43.009 · C. Leclerc (2019)'
  },
  marina_bay: {
    file: 'sg-2008',
    lengthKm: '4.940',
    laps: 62,
    turns: 19,
    direction: 'Antihorario',
    firstGp: 2008,
    lapRecord: '1:34.486 · D. Ricciardo (2024)'
  },
  americas: {
    file: 'us-2012',
    lengthKm: '5.513',
    laps: 56,
    turns: 20,
    direction: 'Antihorario',
    firstGp: 2012,
    lapRecord: '1:36.169 · C. Leclerc (2019)'
  },
  rodriguez: {
    file: 'mx-1962',
    lengthKm: '4.304',
    laps: 71,
    turns: 17,
    direction: 'Horario',
    firstGp: 1963,
    lapRecord: '1:17.774 · V. Bottas (2021)'
  },
  interlagos: {
    file: 'br-1940',
    lengthKm: '4.309',
    laps: 71,
    turns: 15,
    direction: 'Antihorario',
    firstGp: 1973,
    lapRecord: '1:10.540 · V. Bottas (2018)'
  },
  vegas: {
    file: 'us-2023',
    lengthKm: '6.201',
    laps: 50,
    turns: 17,
    direction: 'Antihorario',
    firstGp: 2023,
    lapRecord: '1:34.876 · L. Norris (2024)'
  },
  losail: {
    file: 'qa-2004',
    lengthKm: '5.419',
    laps: 57,
    turns: 16,
    direction: 'Horario',
    firstGp: 2021,
    lapRecord: '1:22.384 · L. Norris (2024)'
  },
  yas_marina: {
    file: 'ae-2009',
    lengthKm: '5.281',
    laps: 58,
    turns: 16,
    direction: 'Antihorario',
    firstGp: 2009,
    lapRecord: '1:25.637 · K. Magnussen (2024)'
  },
  ricard: {
    file: 'fr-1969',
    lengthKm: '5.842',
    laps: 53,
    turns: 15,
    direction: 'Horario',
    firstGp: 1971,
    lapRecord: '1:32.740 · S. Vettel (2019)'
  },
  portimao: {
    file: 'pt-2008',
    lengthKm: '4.653',
    laps: 66,
    turns: 15,
    direction: 'Horario',
    firstGp: 2020,
    lapRecord: '1:18.750 · L. Hamilton (2020)'
  },
  mugello: {
    file: 'it-1914',
    lengthKm: '5.245',
    laps: 59,
    turns: 15,
    direction: 'Horario',
    firstGp: 2020,
    lapRecord: '1:18.833 · L. Hamilton (2020)'
  },
  nurburgring: {
    file: 'de-1927',
    lengthKm: '5.148',
    laps: 60,
    turns: 15,
    direction: 'Horario',
    firstGp: 1951,
    lapRecord: '1:28.139 · M. Verstappen (2020)'
  },
  sochi: {
    file: 'ru-2014',
    lengthKm: '5.848',
    laps: 53,
    turns: 18,
    direction: 'Horario',
    firstGp: 2014,
    lapRecord: '1:35.761 · L. Hamilton (2019)'
  },
  istanbul: {
    file: 'tr-2005',
    lengthKm: '5.338',
    laps: 58,
    turns: 14,
    direction: 'Antihorario',
    firstGp: 2005,
    lapRecord: '1:24.770 · J. P. Montoya (2005)'
  }
};

const memoryCircuitCache = new Map();

function extractCoordinatesFromGeoJson(geo) {
  if (!geo) return null;
  let coords = null;
  if (geo.type === 'FeatureCollection' && Array.isArray(geo.features)) {
    const feat = geo.features.find(f => f?.geometry?.coordinates?.length);
    if (feat) {
      coords = feat.geometry.type === 'Polygon'
        ? feat.geometry.coordinates[0]
        : feat.geometry.coordinates;
    }
  } else if (geo.type === 'Feature' && geo.geometry?.coordinates) {
    coords = geo.geometry.type === 'Polygon'
      ? geo.geometry.coordinates[0]
      : geo.geometry.coordinates;
  } else if (geo.coordinates) {
    coords = geo.type === 'Polygon' ? geo.coordinates[0] : geo.coordinates;
  }
  return Array.isArray(coords) && coords.length > 2 ? coords : null;
}

function projectTrackToSvgData(coords, width = 320, height = 200, pad = 20) {
  // Corrección equirectangular local usando el coseno de la latitud media
  let sumLat = 0;
  for (let i = 0; i < coords.length; i++) sumLat += coords[i][1];
  const meanLat = sumLat / coords.length;
  const cosLat = Math.cos((meanLat * Math.PI) / 180) || 1;

  const projected = coords.map(([lon, lat]) => [lon * cosLat, -lat]);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of projected) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2 - minX * scale;
  const offsetY = (height - spanY * scale) / 2 - minY * scale;

  const pts = projected.map(([x, y]) => [
    Number((x * scale + offsetX).toFixed(1)),
    Number((y * scale + offsetY).toFixed(1))
  ]);

  const d = `M ${pts.map(([x, y]) => `${x},${y}`).join(' L ')} Z`;
  const start = pts[0];
  return { d, startX: start[0], startY: start[1], width, height };
}

async function resolveFileIdByLocation(location) {
  const lat = Number(location?.lat);
  const lon = Number(location?.long);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

  if (!locationsIndexPromise) {
    locationsIndexPromise = fetch(CIRCUIT_LOCATIONS_URL)
      .then(r => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  const list = await locationsIndexPromise;
  if (!Array.isArray(list) || !list.length) return null;

  let bestId = null;
  let bestDist = Infinity;
  for (const item of list) {
    const iLat = Number(item?.lat);
    const iLon = Number(item?.lon);
    if (Number.isNaN(iLat) || Number.isNaN(iLon) || !item?.id) continue;
    const d = Math.hypot(iLat - lat, iLon - lon);
    if (d < bestDist) {
      bestDist = d;
      bestId = item.id;
    }
  }
  return bestDist < 1.5 ? bestId : null;
}

/**
 * Obtiene y cachea los datos de trazado SVG para un circuitId (con fallback por coordenadas).
 */
export async function fetchCircuitTrackSvgData(circuitId, location = null) {
  if (!circuitId) return null;
  if (memoryCircuitCache.has(circuitId)) return memoryCircuitCache.get(circuitId);

  try {
    const cachedRaw = localStorage.getItem(`${CIRCUIT_SVG_CACHE_PREFIX}${circuitId}`);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (parsed?.d) {
        memoryCircuitCache.set(circuitId, parsed);
        return parsed;
      }
    }
  } catch {
    // noop
  }

  let fileId = CIRCUIT_META[circuitId]?.file || null;
  let geo = null;

  if (fileId) {
    try {
      const res = await fetch(`${CIRCUIT_GEOJSON_BASE}/${fileId}.geojson`);
      if (res.ok) geo = await res.json();
    } catch {
      // intentaremos fallback por coordenadas
    }
  }

  if (!geo && location) {
    const fallbackId = await resolveFileIdByLocation(location);
    if (fallbackId && fallbackId !== fileId) {
      const res = await fetch(`${CIRCUIT_GEOJSON_BASE}/${fallbackId}.geojson`);
      if (res.ok) geo = await res.json();
    }
  }

  if (!geo) return null;
  const coords = extractCoordinatesFromGeoJson(geo);
  if (!coords) return null;

  const svgData = projectTrackToSvgData(coords);
  memoryCircuitCache.set(circuitId, svgData);
  try {
    localStorage.setItem(`${CIRCUIT_SVG_CACHE_PREFIX}${circuitId}`, JSON.stringify(svgData));
  } catch {
    // noop
  }
  return svgData;
}

function formatSessionDateTime(dateStr, timeStr) {
  const dt = parseRaceDateTime(dateStr, timeStr);
  if (!dt) return dateStr || '—';
  const datePart = new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  }).format(dt);
  if (!timeStr) return datePart;
  const timePart = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(dt);
  return `${datePart} · ${timePart}`;
}

export function renderTrackSvgMarkup(svgData, circuitName) {
  if (!svgData?.d) {
    return `
      <div class="f1-circuit-track-empty">
        <span class="f1-mono">TRAZADO NO DISPONIBLE</span>
        <small>Sin geometría registrada para este circuito.</small>
      </div>
    `;
  }
  return `
    <svg class="f1-circuit-svg" viewBox="0 0 ${svgData.width} ${svgData.height}" role="img" aria-label="Trazado de ${escapeHTML(circuitName || 'circuito')}">
      <defs>
        <pattern id="f1-circuit-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--f1-map-grid-line)" stroke-width="0.6" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="${svgData.width}" height="${svgData.height}" fill="url(#f1-circuit-grid)" rx="8" />
      <path class="f1-circuit-path-glow" d="${svgData.d}" fill="none" />
      <path class="f1-circuit-path" d="${svgData.d}" fill="none" />
      <circle class="f1-circuit-start" cx="${svgData.startX}" cy="${svgData.startY}" r="4.5" />
    </svg>
  `;
}

/**
 * Renderiza el HTML de la ficha del circuito + cronograma del fin de semana.
 */
export function renderCircuitInfoHTML(race, svgData = null, loadingTrack = false) {
  const circuit = race?.Circuit || {};
  const loc = circuit.Location || {};
  const circuitId = circuit.circuitId || '';
  const meta = CIRCUIT_META[circuitId] || null;

  const sessions = [];
  if (race?.FirstPractice) sessions.push({ label: 'Práctica Libre 1', data: race.FirstPractice, main: false });
  if (race?.SecondPractice) sessions.push({ label: 'Práctica Libre 2', data: race.SecondPractice, main: false });
  if (race?.ThirdPractice) sessions.push({ label: 'Práctica Libre 3', data: race.ThirdPractice, main: false });
  if (race?.SprintQualifying) sessions.push({ label: 'Sprint Qualifying', data: race.SprintQualifying, main: false });
  if (race?.Sprint) sessions.push({ label: 'Sprint', data: race.Sprint, main: true });
  if (race?.Qualifying) sessions.push({ label: 'Clasificación', data: race.Qualifying, main: true });
  if (race?.date) sessions.push({ label: 'Carrera Principal', data: { date: race.date, time: race.time }, main: true });

  const totalDistanceKm = meta?.lengthKm && meta?.laps
    ? (Number(meta.lengthKm) * meta.laps).toFixed(3)
    : null;

  const coordsText = loc.lat && loc.long
    ? `${Number(loc.lat).toFixed(3)}°, ${Number(loc.long).toFixed(3)}°`
    : '—';

  const trackArea = loadingTrack
    ? `<div class="f1-circuit-track-empty"><div class="f1-loading-spinner"></div><small>Cargando trazado oficial...</small></div>`
    : renderTrackSvgMarkup(svgData, circuit.circuitName);

  return `
    <div class="f1-circuit-detail">
      <div class="f1-circuit-hero-grid">
        <div class="f1-circuit-track-box" id="f1-modal-track-box">
          <div class="f1-circuit-track-head">
            <span class="cyber-tag">TRACK // ${escapeHTML((circuitId || 'GP').toUpperCase())}</span>
            <span class="f1-mono f1-circuit-coords">${escapeHTML(coordsText)}</span>
          </div>
          ${trackArea}
          <div class="f1-circuit-track-foot">
            <span><i class="f1-circuit-dot-start"></i> Línea de salida / meta</span>
            ${meta?.direction ? `<span class="f1-mono">${escapeHTML(meta.direction)}</span>` : ''}
          </div>
        </div>

        <div class="f1-circuit-specs">
          <div class="f1-circuit-title-block">
            <div class="f1-circuit-name">${escapeHTML(circuit.circuitName || 'Circuito')}</div>
            <div class="f1-circuit-loc">${escapeHTML([loc.locality, loc.country].filter(Boolean).join(', ') || 'Ubicación por confirmar')}</div>
          </div>

          <div class="f1-circuit-stats-grid">
            <div class="f1-circuit-stat">
              <span class="f1-circuit-stat-label">Longitud</span>
              <strong class="f1-mono">${meta?.lengthKm ? `${meta.lengthKm} km` : '—'}</strong>
            </div>
            <div class="f1-circuit-stat">
              <span class="f1-circuit-stat-label">Vueltas</span>
              <strong class="f1-mono">${meta?.laps ?? '—'}</strong>
            </div>
            <div class="f1-circuit-stat">
              <span class="f1-circuit-stat-label">Curvas</span>
              <strong class="f1-mono">${meta?.turns ?? '—'}</strong>
            </div>
            <div class="f1-circuit-stat">
              <span class="f1-circuit-stat-label">Distancia</span>
              <strong class="f1-mono">${totalDistanceKm ? `${totalDistanceKm} km` : '—'}</strong>
            </div>
            <div class="f1-circuit-stat">
              <span class="f1-circuit-stat-label">Primer GP</span>
              <strong class="f1-mono">${meta?.firstGp ?? '—'}</strong>
            </div>
            <div class="f1-circuit-stat">
              <span class="f1-circuit-stat-label">Ronda</span>
              <strong class="f1-mono">R${String(race?.round || '00').padStart(2, '0')}</strong>
            </div>
          </div>

          ${meta?.lapRecord ? `
            <div class="f1-circuit-record">
              <span>Récord de vuelta</span>
              <strong class="f1-mono">${escapeHTML(meta.lapRecord)}</strong>
            </div>
          ` : ''}
        </div>
      </div>

      ${sessions.length ? `
        <div class="f1-circuit-sessions">
          <div class="f1-circuit-sessions-title">Programa del fin de semana (hora local)</div>
          <div class="f1-session-list">
            ${sessions.map(s => `
              <div class="f1-session-row ${s.main ? 'is-main' : ''}">
                <span>${escapeHTML(s.label)}</span>
                <strong class="f1-mono">${escapeHTML(formatSessionDateTime(s.data?.date, s.data?.time))}</strong>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}
