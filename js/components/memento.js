import { getStore, saveStore } from '../services/db.js?v=6.9.0';
import { icon } from './icons.js?v=1.4.0';
import { openModal, closeModal } from './modal.js?v=1.4.0';
import { showToast } from './toast.js?v=1.4.0';

/**
 * Calcula las métricas exactas de Memento Mori al día de hoy
 */
export function computeMementoStats(mementoCfg) {
  const birthStr = mementoCfg?.birthDate || '1992-10-10';
  const expectancyYears = Number(mementoCfg?.lifeExpectancyYears) || 80;
  const unit = mementoCfg?.unit || 'months';

  const [by, bm, bd] = birthStr.split('-').map(Number);
  const birthDate = new Date(by || 1992, (bm || 10) - 1, bd || 10);
  const endDate = new Date((by || 1992) + expectancyYears, (bm || 10) - 1, bd || 10);

  const nowRaw = new Date();
  const today = new Date(nowRaw.getFullYear(), nowRaw.getMonth(), nowRaw.getDate());

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.round((endDate - birthDate) / msPerDay));
  const daysLived = Math.max(0, Math.min(totalDays, Math.round((today - birthDate) / msPerDay)));
  const pctNum = Math.min(100, Math.max(0, (daysLived / totalDays) * 100));

  let totalUnits = 0;
  let completedUnits = 0;
  let unitLabel = '';

  if (unit === 'days') {
    totalUnits = totalDays;
    completedUnits = daysLived;
    unitLabel = 'días';
  } else if (unit === 'weeks') {
    totalUnits = expectancyYears * 52;
    completedUnits = Math.min(totalUnits, Math.floor(daysLived / 7));
    unitLabel = 'semanas';
  } else if (unit === 'years') {
    totalUnits = expectancyYears;
    let years = today.getFullYear() - birthDate.getFullYear();
    const mDiff = today.getMonth() - birthDate.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
      years--;
    }
    completedUnits = Math.max(0, Math.min(totalUnits, years));
    unitLabel = 'años';
  } else {
    totalUnits = expectancyYears * 12;
    let months = (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
    if (today.getDate() < birthDate.getDate()) {
      months--;
    }
    completedUnits = Math.max(0, Math.min(totalUnits, months));
    unitLabel = 'meses';
  }

  return {
    birthStr,
    expectancyYears,
    unit,
    unitLabel,
    totalDays,
    daysLived,
    pctFormatted: pctNum.toFixed(2),
    totalUnits,
    completedUnits,
    remainingUnits: Math.max(0, totalUnits - completedUnits)
  };
}

/**
 * Dibuja los círculos 100% responsivos según el ancho real del contenedor
 */
export function drawMementoCanvas(canvas, stats) {
  if (!canvas) return;
  const wrap = canvas.parentElement;
  const rawWidth = wrap ? wrap.clientWidth - 16 : 240;
  const availableWidth = Math.max(190, rawWidth);

  const styles = getComputedStyle(document.documentElement);
  const filledColor = styles.getPropertyValue('--memento-filled').trim() || '#D4D4D8';
  const emptyColor = styles.getPropertyValue('--memento-empty').trim() || 'rgba(255,255,255,0.2)';

  let cols = 24;
  if (stats.unit === 'years') cols = 10;
  else if (stats.unit === 'months') cols = 24;
  else if (stats.unit === 'weeks') cols = 52;
  else if (stats.unit === 'days') cols = 46;

  const step = availableWidth / cols;
  const radius = Math.max(1.15, step * 0.34);
  const rows = Math.ceil(stats.totalUnits / cols);

  const cssWidth = Math.floor(availableWidth);
  const cssHeight = Math.ceil(rows * step + 4);

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.ceil(cssWidth * dpr);
  canvas.height = Math.ceil(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  for (let i = 0; i < stats.totalUnits; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * step + step / 2;
    const cy = row * step + step / 2;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);

    if (i < stats.completedUnits) {
      ctx.fillStyle = filledColor;
      ctx.fill();
    } else {
      ctx.strokeStyle = emptyColor;
      ctx.lineWidth = stats.unit === 'weeks' || stats.unit === 'days' ? 0.8 : 1.05;
      ctx.stroke();
    }
  }
}

/**
 * Renderiza el panel lateral Memento Mori (Fijo en escritorio en Dashboard / Deslizante en móvil)
 */
export function renderMementoSidebar() {
  const aside = document.getElementById('memento-sidebar');
  if (!aside) return;

  const store = getStore();
  if (!store.profile.mementoMori) {
    store.profile.mementoMori = {
      birthDate: '1992-10-10',
      lifeExpectancyYears: 80,
      unit: 'months'
    };
  }

  const stats = computeMementoStats(store.profile.mementoMori);
  const [by, bm, bd] = stats.birthStr.split('-');
  const birthDisplay = `${bd}/${bm}/${by}`;

  aside.innerHTML = `
    <div class="memento-top">
      <div style="display:flex;align-items:center;gap:7px;">
        <span class="memento-title">MEMENTO MORI</span>
        <span class="cyber-tag">GRID</span>
      </div>
      <div class="memento-top-actions">
        <button type="button" class="btn-icon" id="btn-memento-config" title="Configurar Memento Mori" aria-label="Configurar Memento Mori" style="min-width:28px;min-height:28px;">
          ${icon('settings')}
        </button>
        <button type="button" class="btn-icon memento-close-mobile" id="btn-memento-close" title="Cerrar panel" aria-label="Cerrar panel" style="min-width:28px;min-height:28px;">
          ${icon('close')}
        </button>
      </div>
    </div>

    <div class="memento-pct-block">
      <div class="memento-pct-header">
        <span class="memento-pct-number">${stats.pctFormatted}%</span>
        <span class="memento-pct-label">de vida alcanzado</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${stats.pctFormatted}%"></div>
      </div>
      <div class="memento-stats-row">
        <span>Vividos: <strong>${stats.completedUnits.toLocaleString('en-US')}</strong> ${stats.unitLabel}</span>
        <span>Faltan: <strong>${stats.remainingUnits.toLocaleString('en-US')}</strong></span>
      </div>
    </div>

    <div class="cyber-hazard-divider" style="margin:0 0 10px;" aria-hidden="true">
      <span class="cyber-hazard-block"></span>
      <span class="cyber-hazard-chevrons">✕ ✕</span>
    </div>

    <div class="memento-unit-bar" role="tablist" aria-label="Escala de tiempo">
      ${[
        { key: 'days', label: 'Días' },
        { key: 'weeks', label: 'Semanas' },
        { key: 'months', label: 'Meses' },
        { key: 'years', label: 'Años' }
      ].map(u => `
        <button type="button" class="memento-unit-btn ${stats.unit === u.key ? 'active' : ''}" data-memento-unit="${u.key}">
          ${u.label}
        </button>
      `).join('')}
    </div>

    <div class="memento-canvas-wrap">
      <canvas id="memento-canvas"></canvas>
    </div>

    <div class="memento-footer-meta">
      <span>Nac: ${birthDisplay}</span>
      <span>Meta: ${stats.expectancyYears} años</span>
    </div>
  `;

  const canvas = aside.querySelector('#memento-canvas');
  requestAnimationFrame(() => drawMementoCanvas(canvas, stats));

  // Cerrar en móvil
  aside.querySelector('#btn-memento-close')?.addEventListener('click', () => {
    document.getElementById('app-shell')?.classList.remove('memento-open');
  });

  // Cambio rápido de unidad
  aside.querySelectorAll('[data-memento-unit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedUnit = btn.getAttribute('data-memento-unit');
      const currentStore = getStore();
      currentStore.profile.mementoMori = {
        ...currentStore.profile.mementoMori,
        unit: selectedUnit
      };
      saveStore(currentStore);
      renderMementoSidebar();
    });
  });

  // Modal de configuración
  aside.querySelector('#btn-memento-config')?.addEventListener('click', () => {
    const cfg = getStore().profile.mementoMori;
    openModal({
      title: 'Configurar Memento Mori',
      contentHTML: `
        <form id="form-memento">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Fecha de nacimiento</label>
              <input type="date" name="birthDate" class="form-input" value="${cfg.birthDate || '1992-10-10'}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Expectativa de vida (años)</label>
              <input type="number" name="lifeExpectancyYears" min="1" max="130" class="form-input" value="${cfg.lifeExpectancyYears || 80}" required />
            </div>
            <div class="form-group full">
              <label class="form-label">Visualización de círculos</label>
              <select name="unit" class="form-select">
                <option value="days" ${cfg.unit === 'days' ? 'selected' : ''}>Días (${(cfg.lifeExpectancyYears || 80) * 365} círculos)</option>
                <option value="weeks" ${cfg.unit === 'weeks' ? 'selected' : ''}>Semanas (${(cfg.lifeExpectancyYears || 80) * 52} círculos)</option>
                <option value="months" ${cfg.unit === 'months' ? 'selected' : ''}>Meses (${(cfg.lifeExpectancyYears || 80) * 12} círculos)</option>
                <option value="years" ${cfg.unit === 'years' ? 'selected' : ''}>Años (${cfg.lifeExpectancyYears || 80} círculos)</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="cancel-memento">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar Configuración</button>
          </div>
        </form>
      `,
      onMount: (modal) => {
        modal.querySelector('#cancel-memento').addEventListener('click', closeModal);
        modal.querySelector('#form-memento').addEventListener('submit', (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const currentStore = getStore();
          currentStore.profile.mementoMori = {
            birthDate: String(fd.get('birthDate') || '1992-10-10'),
            lifeExpectancyYears: Number(fd.get('lifeExpectancyYears')) || 80,
            unit: String(fd.get('unit') || 'months')
          };
          saveStore(currentStore);
          closeModal();
          showToast('Memento Mori actualizado');
          renderMementoSidebar();
        });
      }
    });
  });
}
