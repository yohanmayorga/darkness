/**
 * Servicio de datos de Fórmula 1 para Darkness.
 * Fuentes:
 *  - Jolpica F1 API (sucesora de Ergast): calendario, resultados, qualifying, sprint, pitstops y mundiales.
 *  - OpenF1 API: clima en pista, mensajes de dirección de carrera y stints de neumáticos.
 * Incluye caché en localStorage con TTL y fallback offline.
 */

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';
const OPENF1_BASE = 'https://api.openf1.org/v1';
const CACHE_PREFIX = 'darkness_f1_v1_';

const TTL_CURRENT_MS = 30 * 60 * 1000; // 30 min para datos de temporada en curso
const TTL_HISTORIC_MS = 24 * 60 * 60 * 1000; // 24 h para rondas/temporadas cerradas

function readCache(key, ignoreExpiry = false) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!ignoreExpiry && parsed.expiresAt && Date.now() > parsed.expiresAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key, data, ttlMs) {
  try {
    const payload = {
      data,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + ttlMs
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload));
  } catch {
    // Si localStorage está lleno, limpiar entradas viejas de F1 e intentar de nuevo
    try {
      clearF1Cache();
      localStorage.setItem(
        CACHE_PREFIX + key,
        JSON.stringify({ data, fetchedAt: Date.now(), expiresAt: Date.now() + ttlMs })
      );
    } catch {
      // Ignorar si no es posible persistir
    }
  }
}

export function clearF1Cache() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {
    // noop
  }
}

async function fetchJsonWithCache(cacheKey, url, ttlMs, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = readCache(cacheKey, false);
    if (cached) {
      return { data: cached.data, fromCache: true, fetchedAt: cached.fetchedAt, stale: false };
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    writeCache(cacheKey, data, ttlMs);
    return { data, fromCache: false, fetchedAt: Date.now(), stale: false };
  } catch (err) {
    const fallback = readCache(cacheKey, true);
    if (fallback) {
      return { data: fallback.data, fromCache: true, fetchedAt: fallback.fetchedAt, stale: true };
    }
    throw err;
  }
}

/**
 * Obtiene el paquete principal de una temporada:
 * calendario, standings de pilotos, standings de constructores, último resultado y última quali.
 */
export async function fetchSeasonOverview(season = 'current', forceRefresh = false) {
  const isCurrent = season === 'current' || Number(season) >= new Date().getFullYear();
  const ttl = isCurrent ? TTL_CURRENT_MS : TTL_HISTORIC_MS;
  const sKey = String(season);

  const [scheduleRes, driversRes, constructorsRes, lastRaceRes, lastQualiRes] = await Promise.allSettled([
    fetchJsonWithCache(`schedule_${sKey}`, `${JOLPICA_BASE}/${sKey}.json?limit=100`, ttl, forceRefresh),
    fetchJsonWithCache(`drivers_${sKey}`, `${JOLPICA_BASE}/${sKey}/driverStandings.json?limit=60`, ttl, forceRefresh),
    fetchJsonWithCache(`constructors_${sKey}`, `${JOLPICA_BASE}/${sKey}/constructorStandings.json?limit=30`, ttl, forceRefresh),
    fetchJsonWithCache(`last_race_${sKey}`, `${JOLPICA_BASE}/${sKey}/last/results.json?limit=30`, ttl, forceRefresh),
    fetchJsonWithCache(`last_quali_${sKey}`, `${JOLPICA_BASE}/${sKey}/last/qualifying.json?limit=30`, ttl, forceRefresh)
  ]);

  const scheduleData = scheduleRes.status === 'fulfilled' ? scheduleRes.value : null;
  const driversData = driversRes.status === 'fulfilled' ? driversRes.value : null;
  const constructorsData = constructorsRes.status === 'fulfilled' ? constructorsRes.value : null;
  const lastRaceData = lastRaceRes.status === 'fulfilled' ? lastRaceRes.value : null;
  const lastQualiData = lastQualiRes.status === 'fulfilled' ? lastQualiRes.value : null;

  if (!scheduleData && !driversData && !lastRaceData) {
    throw new Error('No se pudo conectar con la API de Fórmula 1.');
  }

  const races = scheduleData?.data?.MRData?.RaceTable?.Races || [];
  const resolvedSeason =
    scheduleData?.data?.MRData?.RaceTable?.season ||
    driversData?.data?.MRData?.StandingsTable?.season ||
    String(season);

  const driverStandings =
    driversData?.data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
  const constructorStandings =
    constructorsData?.data?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
  const lastRace = lastRaceData?.data?.MRData?.RaceTable?.Races?.[0] || null;
  const lastQuali = lastQualiData?.data?.MRData?.RaceTable?.Races?.[0] || null;

  const timestamps = [scheduleData, driversData, constructorsData, lastRaceData]
    .filter(Boolean)
    .map(r => r.fetchedAt)
    .filter(Boolean);
  const fetchedAt = timestamps.length ? Math.max(...timestamps) : Date.now();
  const stale = [scheduleData, driversData, constructorsData, lastRaceData].some(r => r?.stale);

  return {
    season: resolvedSeason,
    races,
    driverStandings,
    constructorStandings,
    lastRace,
    lastQuali,
    fetchedAt,
    stale
  };
}

/**
 * Obtiene el detalle completo de una ronda específica:
 * resultados de carrera, clasificación, sprint (si hubo) y paradas en boxes.
 */
export async function fetchRoundDetails(season, round, forceRefresh = false) {
  const sKey = String(season);
  const rKey = String(round);
  const ttl = TTL_HISTORIC_MS;

  const [raceRes, qualiRes, sprintRes, pitsRes] = await Promise.allSettled([
    fetchJsonWithCache(`race_${sKey}_${rKey}`, `${JOLPICA_BASE}/${sKey}/${rKey}/results.json?limit=30`, ttl, forceRefresh),
    fetchJsonWithCache(`quali_${sKey}_${rKey}`, `${JOLPICA_BASE}/${sKey}/${rKey}/qualifying.json?limit=30`, ttl, forceRefresh),
    fetchJsonWithCache(`sprint_${sKey}_${rKey}`, `${JOLPICA_BASE}/${sKey}/${rKey}/sprint.json?limit=30`, ttl, forceRefresh),
    fetchJsonWithCache(`pits_${sKey}_${rKey}`, `${JOLPICA_BASE}/${sKey}/${rKey}/pitstops.json?limit=100`, ttl, forceRefresh)
  ]);

  const race = raceRes.status === 'fulfilled' ? raceRes.value?.data?.MRData?.RaceTable?.Races?.[0] || null : null;
  const quali = qualiRes.status === 'fulfilled' ? qualiRes.value?.data?.MRData?.RaceTable?.Races?.[0] || null : null;
  const sprint = sprintRes.status === 'fulfilled' ? sprintRes.value?.data?.MRData?.RaceTable?.Races?.[0] || null : null;
  const pits = pitsRes.status === 'fulfilled' ? pitsRes.value?.data?.MRData?.RaceTable?.Races?.[0]?.PitStops || [] : [];

  return { race, quali, sprint, pits };
}

/**
 * Obtiene los resultados de toda la temporada para un piloto específico.
 */
export async function fetchDriverSeasonResults(season, driverId, forceRefresh = false) {
  const sKey = String(season);
  const dKey = String(driverId);
  const res = await fetchJsonWithCache(
    `driver_res_${sKey}_${dKey}`,
    `${JOLPICA_BASE}/${sKey}/drivers/${encodeURIComponent(dKey)}/results.json?limit=60`,
    TTL_CURRENT_MS,
    forceRefresh
  );
  return res?.data?.MRData?.RaceTable?.Races || [];
}

/**
 * Obtiene los resultados de toda la temporada para una escudería específica.
 */
export async function fetchConstructorSeasonResults(season, constructorId, forceRefresh = false) {
  const sKey = String(season);
  const cKey = String(constructorId);
  const res = await fetchJsonWithCache(
    `constructor_res_${sKey}_${cKey}`,
    `${JOLPICA_BASE}/${sKey}/constructors/${encodeURIComponent(cKey)}/results.json?limit=100`,
    TTL_CURRENT_MS,
    forceRefresh
  );
  return res?.data?.MRData?.RaceTable?.Races || [];
}

/**
 * Obtiene fotos oficiales (headshot_url) de pilotos desde OpenF1 para la última sesión del año.
 */
export async function fetchOpenF1DriverHeadshots(year, forceRefresh = false) {
  const targetYear = Number(year) || new Date().getFullYear();
  const sessionsRes = await fetchJsonWithCache(
    `openf1_sessions_${targetYear}`,
    `${OPENF1_BASE}/sessions?year=${targetYear}`,
    TTL_CURRENT_MS,
    forceRefresh
  );
  const sessions = Array.isArray(sessionsRes?.data) ? sessionsRes.data : [];
  if (!sessions.length) return {};

  const now = Date.now();
  const past = sessions
    .filter(s => s.date_start && new Date(s.date_start).getTime() <= now)
    .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime());
  const latest = past[0] || sessions[sessions.length - 1];
  if (!latest?.session_key) return {};

  const drvRes = await fetchJsonWithCache(
    `openf1_drivers_${latest.session_key}`,
    `${OPENF1_BASE}/drivers?session_key=${latest.session_key}`,
    TTL_HISTORIC_MS,
    forceRefresh
  );
  const list = Array.isArray(drvRes?.data) ? drvRes.data : [];
  const map = {};
  list.forEach(d => {
    const entry = {
      headshotUrl: d.headshot_url || '',
      teamColour: d.team_colour ? `#${d.team_colour}` : '',
      fullName: d.full_name || '',
      acronym: d.name_acronym || '',
      number: d.driver_number ? String(d.driver_number) : ''
    };
    if (d.name_acronym) map[d.name_acronym.toUpperCase()] = entry;
    if (d.driver_number) map[`#${d.driver_number}`] = entry;
  });
  return map;
}

/**
 * Obtiene datos técnicos de la última sesión disponible en OpenF1:
 * clima en pista, mensajes de dirección de carrera y estrategia de neumáticos (stints).
 */
export async function fetchOpenF1LatestSession(year, forceRefresh = false) {
  const targetYear = Number(year) || new Date().getFullYear();
  const ttl = TTL_CURRENT_MS;

  const sessionsRes = await fetchJsonWithCache(
    `openf1_sessions_${targetYear}`,
    `${OPENF1_BASE}/sessions?year=${targetYear}`,
    ttl,
    forceRefresh
  );

  const sessions = Array.isArray(sessionsRes?.data) ? sessionsRes.data : [];
  if (!sessions.length) return null;

  const now = Date.now();
  const pastSessions = sessions
    .filter(s => s.date_start && new Date(s.date_start).getTime() <= now)
    .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime());

  // Preferir la última carrera disputada; si no, la última sesión disponible
  const latestRace = pastSessions.find(s => s.session_type === 'Race') || pastSessions[0];
  if (!latestRace || !latestRace.session_key) return null;

  const sk = latestRace.session_key;

  const [weatherRes, rcRes, stintsRes, driversRes] = await Promise.allSettled([
    fetchJsonWithCache(`openf1_weather_${sk}`, `${OPENF1_BASE}/weather?session_key=${sk}`, TTL_HISTORIC_MS, forceRefresh),
    fetchJsonWithCache(`openf1_rc_${sk}`, `${OPENF1_BASE}/race_control?session_key=${sk}`, TTL_HISTORIC_MS, forceRefresh),
    fetchJsonWithCache(`openf1_stints_${sk}`, `${OPENF1_BASE}/stints?session_key=${sk}`, TTL_HISTORIC_MS, forceRefresh),
    fetchJsonWithCache(`openf1_drivers_${sk}`, `${OPENF1_BASE}/drivers?session_key=${sk}`, TTL_HISTORIC_MS, forceRefresh)
  ]);

  const weatherList = weatherRes.status === 'fulfilled' && Array.isArray(weatherRes.value?.data) ? weatherRes.value.data : [];
  const raceControl = rcRes.status === 'fulfilled' && Array.isArray(rcRes.value?.data) ? rcRes.value.data : [];
  const stints = stintsRes.status === 'fulfilled' && Array.isArray(stintsRes.value?.data) ? stintsRes.value.data : [];
  const drivers = driversRes.status === 'fulfilled' && Array.isArray(driversRes.value?.data) ? driversRes.value.data : [];

  return {
    session: latestRace,
    weather: weatherList.length ? weatherList[weatherList.length - 1] : null,
    weatherSamples: weatherList,
    raceControl,
    stints,
    drivers
  };
}

/**
 * Utilidad para convertir fecha + hora UTC de Jolpica en Date.
 */
export function parseRaceDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const cleanTime = timeStr || '14:00:00Z';
  const iso = cleanTime.endsWith('Z') || cleanTime.includes('+') ? `${dateStr}T${cleanTime}` : `${dateStr}T${cleanTime}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Encuentra el próximo GP y el último GP disputado según la fecha actual.
 */
export function resolveRaceTimeline(races = []) {
  const now = Date.now();
  let nextRace = null;
  let lastScheduledPast = null;

  for (const r of races) {
    const dt = parseRaceDateTime(r.date, r.time);
    if (!dt) continue;
    // Consideramos "pasada" 3 horas después de la hora de inicio
    if (dt.getTime() + 3 * 60 * 60 * 1000 < now) {
      lastScheduledPast = r;
    } else if (!nextRace) {
      nextRace = r;
    }
  }

  return { nextRace, lastScheduledPast };
}
