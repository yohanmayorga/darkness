import {
  getStore,
  saveStore,
  generateId,
  todayISO,
  getFirebaseConfig,
  setFirebaseConfig,
  isFirebaseConfigured,
  syncToFirebaseIfConfigured,
  pullFromFirebase,
  getStoreStorageStats
} from '../services/db.js?v=6.9.6';
import { getCurrentSession, loginUser, registerCloudUser, loginWithGoogle, logoutUser, migrateStoreToPin, isValidPin } from '../services/auth.js?v=6.9.5';
import { icon } from '../components/icons.js?v=3.3.0';
import { showToast } from '../components/toast.js?v=1.4.0';
import { buildUnifiedCalendarHTML, bindUnifiedCalendar } from '../components/calendar.js?v=2.6.0';
import { ALL_DAYS, normalizeHabit } from '../utils/habits.js?v=3.3.0';
import { asideCyberDecal } from '../components/hudFrame.js?v=1.1.1';

const calState = { year: null, month: null, selectedDate: '' };

export function renderSettings(container) {
  const store = getStore();
  const today = todayISO();
  if (calState.year === null) {
    const [y, m] = today.split('-').map(Number);
    calState.year = y;
    calState.month = m - 1;
    calState.selectedDate = today;
  }
  const session = getCurrentSession();
  const fbCfg = getFirebaseConfig();
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <span class="page-eyebrow">SISTEMA & NUBE</span>
        <h1 class="page-title">Ajustes y Sincronización</h1>
        <p class="page-subtitle">Personaliza la apariencia monocromática, tu cuenta de usuario, conexión a Google Firebase y copias de seguridad.</p>
      </div>
    </header>

    <div class="grid-2">
      <!-- Apariencia y Perfil -->
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">${icon('sun')} Apariencia & Perfil Personal</h2>
        </div>

        <div class="form-group">
          <label class="form-label">Tema Visual (Monocromático / Plata)</label>
          <div style="display:flex;gap:10px;margin-top:4px;">
            <button type="button" class="btn ${currentTheme === 'dark' ? 'btn-primary' : 'btn-secondary'}" id="btn-set-dark" style="flex:1;">
              ${icon('moon')} Modo Oscuro (Obsidiana)
            </button>
            <button type="button" class="btn ${currentTheme === 'light' ? 'btn-primary' : 'btn-secondary'}" id="btn-set-light" style="flex:1;">
              ${icon('sun')} Modo Claro (Plata/Papel)
            </button>
          </div>
        </div>

        <form id="form-profile" style="margin-top:18px;">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Tu Nombre / Alias</label>
              <input type="text" name="name" class="form-input" value="${store.profile.name || ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Correo de Usuario</label>
              <input type="email" name="email" class="form-input" value="${store.profile.email || ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Peso Meta (kg)</label>
              <input type="number" step="0.1" name="targetWeightKg" class="form-input" value="${store.profile.targetWeightKg || 72}" />
            </div>
            <div class="form-group">
              <label class="form-label">% de Grasa Ideal</label>
              <input type="number" step="0.1" name="targetBodyFatPct" class="form-input" value="${store.profile.targetBodyFatPct ?? 15}" />
            </div>
            <div class="form-group">
              <label class="form-label">Cintura Ideal (cm)</label>
              <input type="number" step="0.1" name="targetWaistCm" class="form-input" value="${store.profile.targetWaistCm ?? 80}" />
            </div>
            <div class="form-group">
              <label class="form-label">Estatura (cm)</label>
              <input type="number" name="heightCm" class="form-input" value="${store.profile.heightCm || 175}" />
            </div>
            <div class="form-group full">
              <label class="form-label">Moneda Principal</label>
              <input type="text" name="currency" class="form-input" value="${store.profile.currency || 'USD'}" />
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;">Guardar Perfil y Metas</button>
        </form>
      </section>

      <!-- Base de Datos en la Nube (Google Firebase) y Usuario -->
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">${icon('cloud')} Google Firebase (Firestore & Auth)</h2>
          <span class="badge ${isFirebaseConfigured() ? 'badge-success' : 'badge-silver'}">
            ${isFirebaseConfigured() ? 'Firebase Conectado' : 'Modo Local Activo'}
          </span>
        </div>

        <details style="margin-bottom:14px;">
          <summary class="text-secondary" style="cursor:pointer;font-size:0.8rem;">
            Proyecto conectado: <strong class="mono">${fbCfg.projectId || 'Sin configurar'}</strong> (clic para editar claves)
          </summary>
          <form id="form-firebase" style="margin-top:10px;">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Project ID</label>
                <input type="text" name="projectId" class="form-input mono" value="${fbCfg.projectId}" />
              </div>
              <div class="form-group">
                <label class="form-label">API Key</label>
                <input type="password" name="apiKey" class="form-input mono" value="${fbCfg.apiKey}" />
              </div>
              <div class="form-group">
                <label class="form-label">Auth Domain</label>
                <input type="text" name="authDomain" class="form-input mono" value="${fbCfg.authDomain}" />
              </div>
              <div class="form-group">
                <label class="form-label">App ID</label>
                <input type="text" name="appId" class="form-input mono" value="${fbCfg.appId}" />
              </div>
            </div>
            <button type="submit" class="btn btn-secondary btn-sm" style="width:100%;">Guardar Configuración Firebase</button>
          </form>
        </details>

        <div>
          <h3 style="font-size:0.9rem;margin-bottom:10px;">Autenticación (${session.mode === 'cloud' ? 'Conectado a Firebase' : 'Sesión Local'})</h3>
          <button type="button" class="btn btn-secondary" id="btn-google-login" style="width:100%;margin-bottom:12px;">
            Entrar con Google (1 clic)
          </button>
          <form id="form-auth">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" name="authEmail" class="form-input" value="${session.email || ''}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Contraseña (Firebase Auth)</label>
                <input type="password" name="authPassword" class="form-input" placeholder="••••••••" />
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="submit" class="btn btn-primary btn-sm">Iniciar Sesión</button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-register-cloud">Registrar Usuario</button>
              <button type="button" class="btn btn-ghost btn-sm" id="btn-sync-push">${icon('upload')} Subir a Nube</button>
              <button type="button" class="btn btn-ghost btn-sm" id="btn-sync-pull">${icon('download')} Descargar de Nube</button>
            </div>
          </form>
        </div>

        <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-subtle);">
          <h3 style="font-size:0.9rem;margin-bottom:6px;">Acceso con Clave de 8 Dígitos</h3>
          <p class="text-secondary" style="font-size:0.78rem;margin-bottom:10px;">
            Vincula tus datos actuales a una clave numérica de 8 dígitos para entrar desde cualquier dispositivo sin depender del caché.
          </p>
          <form id="form-pin-migrate" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <input type="password" name="pinCode" class="form-input mono" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="8 dígitos" style="flex:1;min-width:140px;font-size:16px;" required />
            <button type="submit" class="btn btn-primary btn-sm">Guardar en esta Clave</button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-lock-app">${icon('lock')} Bloquear</button>
          </form>
        </div>
      </section>
    </div>

    <!-- Respaldo y Portabilidad JSON -->
    <section class="card" style="margin-bottom:16px;">
      <div class="card-header">
        <h2 class="card-title">${icon('lock')} Respaldo Total y Portabilidad de Datos (JSON)</h2>
      </div>
      <p class="text-secondary" style="font-size:0.88rem;margin-bottom:16px;">
        Descarga una copia completa de tus hábitos, mediciones corporales, biblioteca de lectura, diario y finanzas en un archivo JSON privado, o restaura un respaldo previo en cualquier dispositivo (PC, Android o iPhone).
      </p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary" id="btn-export-json">
          ${icon('download')} Exportar Respaldo (.json)
        </button>
        <label class="btn btn-secondary" style="cursor:pointer;">
          ${icon('upload')} Importar Respaldo (.json)
          <input type="file" id="input-import-json" accept="application/json" style="display:none;" />
        </label>
      </div>
    </section>

    <!-- Importar Historial desde Excel / CSV -->
    <section class="card">
      <div class="card-header">
        <h2 class="card-title">${icon('upload')} Importar Historial desde Excel (.csv)</h2>
        <span class="cyber-tag">CSV</span>
      </div>
      <p class="text-secondary" style="font-size:0.86rem;margin-bottom:14px;">
        Guarda tu hoja de Excel como <strong>CSV (delimitado por comas o punto y coma)</strong> e impórtala aquí. Acepta fechas <span class="mono">AAAA-MM-DD</span> o <span class="mono">DD/MM/AAAA</span>.
      </p>
      <div class="grid-3">
        <div style="padding:12px;background:var(--hud-bg-elevated);border:1px solid var(--hud-border-subtle);">
          <h3 style="font-size:0.86rem;margin-bottom:6px;">Historial de Pesos y Medidas</h3>
          <p class="text-muted" style="font-size:0.76rem;margin-bottom:10px;">
            Columnas: <span class="mono">fecha, peso, grasa, cintura</span> (solo fecha y peso son obligatorias).
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn btn-ghost btn-sm" id="btn-tpl-body-csv">${icon('download')} Plantilla CSV</button>
            <label class="btn btn-primary btn-sm" style="cursor:pointer;">
              ${icon('upload')} Subir CSV Pesos
              <input type="file" id="input-import-body-csv" accept=".csv,text/csv" style="display:none;" />
            </label>
          </div>
        </div>
        <div style="padding:12px;background:var(--hud-bg-elevated);border:1px solid var(--hud-border-subtle);">
          <h3 style="font-size:0.86rem;margin-bottom:6px;">Historial de Hábitos</h3>
          <p class="text-muted" style="font-size:0.76rem;margin-bottom:10px;">
            Columna <span class="mono">fecha</span> + una columna por cada hábito con <span class="mono">1</span> / <span class="mono">si</span> / <span class="mono">x</span> cuando se cumplió.
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn btn-ghost btn-sm" id="btn-tpl-habits-csv">${icon('download')} Plantilla CSV</button>
            <label class="btn btn-primary btn-sm" style="cursor:pointer;">
              ${icon('upload')} Subir CSV Hábitos
              <input type="file" id="input-import-habits-csv" accept=".csv,text/csv" style="display:none;" />
            </label>
          </div>
        </div>
        <div style="padding:12px;background:var(--hud-bg-elevated);border:1px solid var(--hud-border-subtle);">
          <h3 style="font-size:0.86rem;margin-bottom:6px;">Historial de Lecturas</h3>
          <p class="text-muted" style="font-size:0.76rem;margin-bottom:10px;">
            Columnas: <span class="mono">Name, Author, Start, End, Format, Rating, Comentarios</span>.
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <label class="btn btn-primary btn-sm" style="cursor:pointer;">
              ${icon('upload')} Subir CSV Lecturas
              <input type="file" id="input-import-books-csv" accept=".csv,text/csv" style="display:none;" />
            </label>
          </div>
        </div>
      </div>
    </section>

    <aside class="section-aside" aria-label="Calendario y estado del sistema">
      <section class="card habit-calendar" id="settings-calendar" aria-label="Calendario del sistema">
        ${buildUnifiedCalendarHTML({
          year: calState.year,
          month: calState.month,
          today,
          selectedDate: calState.selectedDate,
          markedDates: new Map([[today, 'Hoy']]),
          footerLabel: 'Sistema activo',
          legendLabel: 'hoy'
        })}
      </section>
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">${icon('settings')} Estado del Sistema</h2>
          <span class="cyber-tag">${isFirebaseConfigured() ? 'FIREBASE' : 'LOCAL'}</span>
        </div>
        <p class="body-summary-text">
          Almacenando <strong class="mono">${store.habits.length}</strong> hábitos, <strong class="mono">${store.bodyMetrics.length}</strong> mediciones, <strong class="mono">${store.books.length}</strong> libros, <strong class="mono">${store.journalEntries.length}</strong> entradas de diario y <strong class="mono">${store.transactions.length}</strong> movimientos.
        </p>
        ${(() => {
          const { totalBytes, docBytes, mediaBytes, mediaCount } = getStoreStorageStats(store);
          const fmtSize = bytes => bytes >= 1048576
            ? `${(bytes / 1048576).toFixed(2)} MB`
            : `${Math.max(1, Math.round(bytes / 1024))} KB`;
          const localLimit = 5 * 1024 * 1024;
          const localPct = Math.min(100, Math.round((totalBytes / localLimit) * 100));
          const firestoreLimit = 1024 * 1024;
          const fsPct = ((docBytes / firestoreLimit) * 100).toFixed(1);
          return `
            <div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--hud-border);">
              <div style="display:flex;justify-content:space-between;font-size:0.74rem;margin-bottom:5px;" class="mono">
                <span>Memoria local: <strong>${fmtSize(totalBytes)}</strong></span>
                <span class="text-muted">${localPct}% de 5 MB</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width:${Math.max(2, localPct)}%"></div>
              </div>
              <div class="mono text-muted" style="font-size:0.68rem;margin-top:6px;line-height:1.45;">
                Firestore doc: <strong>${fmtSize(docBytes)}</strong> (${fsPct}% de 1 MB)<br/>
                Imágenes en subcolección (${mediaCount}): ${fmtSize(mediaBytes)}
              </div>
            </div>
          `;
        })()}
      </section>
      ${asideCyberDecal({ code: 'SYS.08', label: 'SYSTEM KERNEL', tag: 'CONFIG // ROOT' })}
    </aside>
  `;

  bindUnifiedCalendar(container.querySelector('#settings-calendar'), {
    state: calState,
    today,
    onChange: () => renderSettings(container)
  });

  // Cambio de tema
  container.querySelector('#btn-set-dark')?.addEventListener('click', () => {
    window.setDarknessTheme('dark');
    renderSettings(container);
  });

  container.querySelector('#btn-set-light')?.addEventListener('click', () => {
    window.setDarknessTheme('light');
    renderSettings(container);
  });

  // Guardar Perfil
  container.querySelector('#form-profile')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const current = getStore();
    current.profile = {
      ...current.profile,
      name: String(fd.get('name')).trim(),
      email: String(fd.get('email')).trim(),
      targetWeightKg: Number(fd.get('targetWeightKg')) || 72,
      targetBodyFatPct: Number(fd.get('targetBodyFatPct')) || 15,
      targetWaistCm: Number(fd.get('targetWaistCm')) || 80,
      heightCm: Number(fd.get('heightCm')) || 175,
      currency: String(fd.get('currency')).trim().toUpperCase() || 'USD'
    };
    saveStore(current);
    showToast('Perfil y metas actualizados');
  });

  // Guardar configuración Firebase
  container.querySelector('#form-firebase')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const currentCfg = getFirebaseConfig();
    setFirebaseConfig({
      ...currentCfg,
      projectId: String(fd.get('projectId') || ''),
      apiKey: String(fd.get('apiKey') || ''),
      authDomain: String(fd.get('authDomain') || ''),
      appId: String(fd.get('appId') || '')
    });
    showToast('Configuración de Firebase guardada');
    renderSettings(container);
  });

  // Entrar con Google
  container.querySelector('#btn-google-login')?.addEventListener('click', async () => {
    try {
      await loginWithGoogle();
      showToast('Sesión iniciada con Google');
      renderSettings(container);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  // Iniciar sesión
  container.querySelector('#form-auth')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await loginUser({
        email: String(fd.get('authEmail')),
        password: String(fd.get('authPassword')),
        name: store.profile.name
      });
      showToast('Sesión iniciada correctamente');
      renderSettings(container);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  // Registrar en Supabase
  container.querySelector('#btn-register-cloud')?.addEventListener('click', async () => {
    const form = container.querySelector('#form-auth');
    const fd = new FormData(form);
    try {
      await registerCloudUser({
        email: String(fd.get('authEmail')),
        password: String(fd.get('authPassword')),
        name: store.profile.name
      });
      showToast('Usuario registrado y conectado en Firebase');
      renderSettings(container);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  // Vincular / Migrar datos actuales a PIN de 8 dígitos
  container.querySelector('#form-pin-migrate')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const pin = String(fd.get('pinCode') || '').replace(/\D/g, '');
    if (!isValidPin(pin)) {
      showToast('La clave debe tener exactamente 8 dígitos numéricos');
      return;
    }
    try {
      await migrateStoreToPin(pin);
      showToast('Datos guardados en tu bóveda de 8 dígitos en Firebase');
      renderSettings(container);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  container.querySelector('#btn-lock-app')?.addEventListener('click', () => {
    if (typeof window.lockDarknessApp === 'function') {
      window.lockDarknessApp();
    }
  });

  // Sincronización manual
  container.querySelector('#btn-sync-push')?.addEventListener('click', async () => {
    const res = await syncToFirebaseIfConfigured();
    if (res.ok) showToast('Datos sincronizados en Firebase');
    else showToast(`No se pudo subir: ${res.reason}`);
  });

  container.querySelector('#btn-sync-pull')?.addEventListener('click', async () => {
    const res = await pullFromFirebase({ force: true });
    if (res.ok) {
      showToast('Datos descargados desde Firebase');
      renderSettings(container);
    } else {
      showToast(`No se pudo descargar: ${res.reason}`);
    }
  });

  // Exportar JSON
  container.querySelector('#btn-export-json')?.addEventListener('click', () => {
    const data = JSON.stringify(getStore(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `darkness-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Respaldo JSON descargado');
  });

  // Importar JSON
  container.querySelector('#input-import-json')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && parsed.profile && Array.isArray(parsed.habits)) {
          saveStore(parsed);
          showToast('Respaldo importado con éxito');
          renderSettings(container);
        } else {
          showToast('El archivo JSON no tiene el formato de Darkness');
        }
      } catch {
        showToast('Error al leer el archivo JSON');
      }
    };
    reader.readAsText(file);
  });

  // Plantillas CSV
  container.querySelector('#btn-tpl-body-csv')?.addEventListener('click', () => {
    downloadCsv('plantilla-pesos-darkness.csv', 'fecha,peso,grasa,cintura\n2026-10-01,76.5,16.5,82\n2026-10-15,75.8,16.0,81\n');
  });

  container.querySelector('#btn-tpl-habits-csv')?.addEventListener('click', () => {
    const names = (getStore().habits || []).map(h => h.name);
    const cols = names.length ? names : ['Agua', 'Gimnasio', 'Leer'];
    const header = ['fecha', ...cols].join(',');
    const row = ['2026-10-01', ...cols.map(() => '1')].join(',');
    downloadCsv('plantilla-habitos-darkness.csv', `${header}\n${row}\n`);
  });

  // Importar CSV de Pesos
  container.querySelector('#input-import-body-csv')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsvRows(String(reader.result || ''));
      if (rows.length < 2) return showToast('El CSV no tiene filas de datos');
      const headers = rows[0].map(h => h.toLowerCase().trim());
      const findCol = (...keys) => headers.findIndex(h => keys.some(k => h === k || h.includes(k)));
      const dateIdx = findCol('fecha', 'date');
      const timeIdx = findCol('hora', 'time');
      const weightIdx = findCol('peso', 'weight');
      const bmiIdx = findCol('bmi', 'imc');
      const fatIdx = findCol('grasa', 'body fat');
      const fatFreeIdx = findCol('fat-free', 'libre de grasa');
      const subFatIdx = findCol('subcutaneous', 'subcut');
      const viscIdx = findCol('visceral');
      const waterIdx = findCol('water', 'agua');
      const skelIdx = findCol('skeletal', 'esquel');
      const muscleIdx = findCol('muscle mass', 'masa muscular');
      const boneIdx = findCol('bone', 'ósea', 'osea');
      const protIdx = findCol('protein', 'prote');
      const bmrIdx = findCol('bmr', 'tmb');
      const metAgeIdx = findCol('metabolic age', 'edad metab');
      const waistIdx = findCol('cintura', 'waist');
      const bicepsIdx = findCol('bíceps', 'biceps', 'brazo');
      const thighIdx = findCol('muslo', 'thigh', 'pierna');

      if (dateIdx === -1 || weightIdx === -1) {
        return showToast('El CSV debe tener columnas "fecha/Date" y "peso/Weight"');
      }

      const numAt = (cols, idx) => {
        if (idx === -1) return null;
        const cleaned = String(cols[idx] || '').replace(/kg|kcal|cm|%/gi, '').replace(',', '.').trim();
        if (!cleaned) return null;
        const n = parseFloat(cleaned);
        return Number.isFinite(n) ? n : null;
      };

      const current = getStore();
      if (!Array.isArray(current.bodyMetrics)) current.bodyMetrics = [];
      let imported = 0;

      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        const iso = normalizeCsvDate(cols[dateIdx]);
        const weight = numAt(cols, weightIdx);
        if (!iso || weight === null || weight <= 0) continue;

        const rawTime = timeIdx !== -1 ? String(cols[timeIdx] || '').trim() : '';
        const time = /^\d{2}:\d{2}/.test(rawTime) ? rawTime.slice(0, 5) : '07:30';

        const entryData = {
          date: iso,
          time,
          weightKg: weight,
          bmi: numAt(cols, bmiIdx) ?? 0,
          bodyFatPct: numAt(cols, fatIdx) ?? 0,
          fatFreeWeightKg: numAt(cols, fatFreeIdx) ?? 0,
          subcutaneousFatPct: numAt(cols, subFatIdx) ?? 0,
          visceralFat: numAt(cols, viscIdx) ?? 0,
          bodyWaterPct: numAt(cols, waterIdx) ?? 0,
          skeletalMusclesPct: numAt(cols, skelIdx) ?? 0,
          muscleMassKg: numAt(cols, muscleIdx) ?? 0,
          boneMassKg: numAt(cols, boneIdx) ?? 0,
          proteinPct: numAt(cols, protIdx) ?? 0,
          bmr: numAt(cols, bmrIdx) ?? 0,
          metabolicAge: numAt(cols, metAgeIdx) ?? 0,
          waistCm: numAt(cols, waistIdx) ?? 0,
          bicepsCm: numAt(cols, bicepsIdx) ?? 0,
          thighCm: numAt(cols, thighIdx) ?? 0
        };

        const existing = current.bodyMetrics.find(m => m.date === iso && m.time === time);
        if (existing) {
          Object.assign(existing, entryData);
        } else {
          current.bodyMetrics.push({ id: generateId('bm'), ...entryData });
        }
        imported++;
      }

      current.bodyMetrics.sort((a, b) => a.date.localeCompare(b.date));
      saveStore(current);
      showToast(`${imported} registro(s) de peso importados`);
      renderSettings(container);
    };
    reader.readAsText(file);
  });

  // Importar CSV de Hábitos
  container.querySelector('#input-import-habits-csv')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsvRows(String(reader.result || ''));
      if (rows.length < 2) return showToast('El CSV no tiene filas de datos');
      const headers = rows[0].map(h => h.trim());
      const dateIdx = headers.findIndex(h => h.toLowerCase() === 'fecha' || h.toLowerCase() === 'date');
      if (dateIdx === -1) return showToast('El CSV debe tener una columna "fecha"');

      const current = getStore();
      if (!Array.isArray(current.habits)) current.habits = [];

      const colToHabit = new Map();
      let earliestDate = todayISO();

      for (let i = 1; i < rows.length; i++) {
        const iso = normalizeCsvDate(rows[i][dateIdx]);
        if (iso && iso < earliestDate) earliestDate = iso;
      }

      const HABIT_ALIASES = {
        'skin care (m)': 'Skin Care (diurno)',
        'skin care (n)': 'Skin Care (nocturno)',
        'water (3l)': 'Agua',
        'water': 'Agua',
        'reading': 'Leer',
        'no sugar': 'No azúcar',
        'no alcohol': 'No alcohol',
        'gym': 'Gimnasio',
        'sleep +7h': 'Dormir +7h'
      };

      headers.forEach((colName, idx) => {
        if (idx === dateIdx || !colName) return;
        const mappedName = HABIT_ALIASES[colName.toLowerCase()] || colName;
        let habit = current.habits.find(h =>
          h.name.toLowerCase() === mappedName.toLowerCase() ||
          h.name.toLowerCase() === colName.toLowerCase()
        );
        if (!habit) {
          habit = normalizeHabit({
            id: generateId('hab'),
            name: mappedName,
            category: 'General',
            timeOfDay: 'anytime',
            days: [...ALL_DAYS],
            startDate: earliestDate,
            endDate: '',
            logs: {},
            createdAt: new Date().toISOString()
          }, earliestDate);
          current.habits.push(habit);
        } else if (earliestDate < habit.startDate) {
          habit.startDate = earliestDate;
        }
        colToHabit.set(idx, habit);
      });

      let marks = 0;
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        const iso = normalizeCsvDate(cols[dateIdx]);
        if (!iso) continue;
        colToHabit.forEach((habit, colIdx) => {
          const val = String(cols[colIdx] || '').trim().toLowerCase();
          if (['1', 'si', 'sí', 's', 'x', 'true', 'verdadero', 'yes', 'ok', '✓'].includes(val)) {
            habit.logs[iso] = true;
            marks++;
          }
        });
      }

      saveStore(current);
      showToast(`Historial de hábitos importado (${marks} marcas)`);
      renderSettings(container);
    };
    reader.readAsText(file);
  });

  // Importar CSV de Lecturas
  container.querySelector('#input-import-books-csv')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsvRows(String(reader.result || ''));
      if (rows.length < 2) return showToast('El CSV no tiene filas de libros');
      const headers = rows[0].map(h => h.toLowerCase().trim());
      const findCol = (...keys) => headers.findIndex(h => keys.some(k => h === k || h.includes(k)));
      const titleIdx = findCol('name', 'title', 'título', 'titulo', 'libro');
      const authorIdx = findCol('author', 'autor');
      const startIdx = findCol('start', 'inicio');
      const endIdx = findCol('end', 'fin');
      const formatIdx = findCol('format', 'modalidad');
      const ratingIdx = findCol('rating', 'calificacion', 'calificación');
      const commentsIdx = findCol('comentarios', 'comments', 'notas');
      if (titleIdx === -1) return showToast('El CSV debe tener columna "Name" o "Title"');

      const current = getStore();
      const seedIds = new Set(['bk-1', 'bk-2', 'bk-3']);
      current.books = (current.books || []).filter(b => !seedIds.has(b.id));

      const formatMap = {
        'physical': 'Físico',
        'fisico': 'Físico',
        'físico': 'Físico',
        'kindle': 'Kindle',
        'audiobook': 'Audiolibro',
        'audiolibro': 'Audiolibro',
        'pdf': 'PDF/Digital',
        'digital': 'PDF/Digital'
      };

      let imported = 0;
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        const title = String(cols[titleIdx] || '').trim();
        if (!title) continue;
        const author = authorIdx !== -1 ? String(cols[authorIdx] || '').trim() : '';
        const startDate = startIdx !== -1 ? normalizeCsvDate(cols[startIdx]) : '';
        const endDate = endIdx !== -1 ? normalizeCsvDate(cols[endIdx]) : '';
        const rawFmt = formatIdx !== -1 ? String(cols[formatIdx] || '').trim().toLowerCase() : 'kindle';
        const modality = formatMap[rawFmt] || 'Kindle';
        const rating = ratingIdx !== -1 ? (parseInt(cols[ratingIdx], 10) || 0) : 0;
        const comments = commentsIdx !== -1 ? String(cols[commentsIdx] || '').trim() : '';
        const status = endDate ? 'Terminado' : 'Leyendo';

        const existing = current.books.find(b => b.title.toLowerCase() === title.toLowerCase());
        const bookObj = {
          id: existing ? existing.id : generateId('bk'),
          title,
          author: author || 'Desconocido',
          modality,
          status,
          startDate,
          endDate,
          rating: Math.max(0, Math.min(10, rating)),
          comments,
          coverUrl: existing?.coverUrl || ''
        };

        if (existing) Object.assign(existing, bookObj);
        else current.books.unshift(bookObj);
        imported++;
      }

      saveStore(current);
      showToast(`${imported} libro(s) importados a tu biblioteca`);
      renderSettings(container);
    };
    reader.readAsText(file);
  });
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsvRows(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  return lines.map(line => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === sep && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  });
}

function normalizeCsvDate(raw) {
  const s = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return '';
}
