import {
  getStore,
  saveStore,
  getSupabaseConfig,
  setSupabaseConfig,
  isSupabaseConfigured,
  syncToSupabaseIfConfigured,
  pullFromSupabase
} from '../services/db.js?v=1.4.0';
import { getCurrentSession, loginUser, registerCloudUser, logoutUser } from '../services/auth.js?v=1.4.0';
import { icon } from '../components/icons.js?v=1.4.0';
import { showToast } from '../components/toast.js?v=1.4.0';
import { buildUnifiedCalendarHTML, bindUnifiedCalendar } from '../components/calendar.js?v=2.6.0';
import { todayISO } from '../services/db.js?v=2.4.0';

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
  const supaCfg = getSupabaseConfig();
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <span class="page-eyebrow">SISTEMA & NUBE</span>
        <h1 class="page-title">Ajustes y Sincronización</h1>
        <p class="page-subtitle">Personaliza la apariencia monocromática, tu cuenta de usuario, conexión a Supabase y copias de seguridad.</p>
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
              <label class="form-label">Estatura (cm)</label>
              <input type="number" name="heightCm" class="form-input" value="${store.profile.heightCm || 175}" />
            </div>
            <div class="form-group">
              <label class="form-label">Moneda Principal</label>
              <input type="text" name="currency" class="form-input" value="${store.profile.currency || 'USD'}" />
            </div>
            <div class="form-group">
              <label class="form-label">Presupuesto Mensual</label>
              <input type="number" name="monthlyBudget" class="form-input" value="${store.profile.monthlyBudget || 2000}" />
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;">Guardar Perfil y Metas</button>
        </form>
      </section>

      <!-- Base de Datos en la Nube (Supabase) y Usuario -->
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">${icon('cloud')} Base de Datos Supabase & Sesión</h2>
          <span class="badge ${isSupabaseConfigured() ? 'badge-success' : 'badge-silver'}">
            ${isSupabaseConfigured() ? 'Supabase Configurado' : 'Modo Local Activo'}
          </span>
        </div>

        <form id="form-supabase">
          <div class="form-group">
            <label class="form-label">Supabase Project URL</label>
            <input type="url" name="url" class="form-input mono" placeholder="https://tu-proyecto.supabase.co" value="${supaCfg.url}" />
          </div>
          <div class="form-group">
            <label class="form-label">Supabase Anon Public Key</label>
            <input type="password" name="anonKey" class="form-input mono" placeholder="eyJhbGciOiJIUzI1NiIs..." value="${supaCfg.anonKey}" />
          </div>
          <button type="submit" class="btn btn-secondary" style="width:100%;">Guardar Conexión Supabase</button>
        </form>

        <div style="border-top:1px solid var(--border-subtle);margin:18px 0;padding-top:16px;">
          <h3 style="font-size:0.9rem;margin-bottom:10px;">Autenticación de Usuario (${session.mode === 'cloud' ? 'Conectado a Nube' : 'Sesión Local'})</h3>
          <form id="form-auth">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" name="authEmail" class="form-input" value="${session.email || ''}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Contraseña (Supabase Auth)</label>
                <input type="password" name="authPassword" class="form-input" placeholder="••••••••" />
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="submit" class="btn btn-primary btn-sm">Iniciar Sesión</button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-register-cloud">Registrar Usuario en Supabase</button>
              <button type="button" class="btn btn-ghost btn-sm" id="btn-sync-push">${icon('upload')} Subir a Nube</button>
              <button type="button" class="btn btn-ghost btn-sm" id="btn-sync-pull">${icon('download')} Descargar de Nube</button>
            </div>
          </form>
        </div>
      </section>
    </div>

    <!-- Respaldo y Portabilidad JSON -->
    <section class="card">
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
          <span class="cyber-tag">${isSupabaseConfigured() ? 'CLOUD' : 'LOCAL'}</span>
        </div>
        <p class="body-summary-text">
          Almacenando <strong class="mono">${store.habits.length}</strong> hábitos, <strong class="mono">${store.bodyMetrics.length}</strong> mediciones, <strong class="mono">${store.books.length}</strong> libros, <strong class="mono">${store.journalEntries.length}</strong> entradas de diario y <strong class="mono">${store.transactions.length}</strong> movimientos.
        </p>
      </section>
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
      heightCm: Number(fd.get('heightCm')) || 175,
      currency: String(fd.get('currency')).trim().toUpperCase() || 'USD',
      monthlyBudget: Number(fd.get('monthlyBudget')) || 2000
    };
    saveStore(current);
    showToast('Perfil y metas actualizados');
  });

  // Guardar credenciales de Supabase
  container.querySelector('#form-supabase')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setSupabaseConfig(String(fd.get('url') || ''), String(fd.get('anonKey') || ''));
    showToast('Configuración de Supabase guardada');
    renderSettings(container);
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
      showToast('Usuario registrado en Supabase (revisa tu correo si requiere confirmación)');
      renderSettings(container);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  // Sincronización manual
  container.querySelector('#btn-sync-push')?.addEventListener('click', async () => {
    const res = await syncToSupabaseIfConfigured();
    if (res.ok) showToast('Datos sincronizados en Supabase');
    else showToast(`No se pudo subir: ${res.reason}`);
  });

  container.querySelector('#btn-sync-pull')?.addEventListener('click', async () => {
    const res = await pullFromSupabase();
    if (res.ok) {
      showToast('Datos descargados desde Supabase');
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
}
