import { getStore, saveStore, generateId, todayISO, fileToDataUrl } from '../services/db.js?v=1.3.0';
import { icon } from '../components/icons.js?v=1.3.0';
import { openModal, closeModal } from '../components/modal.js?v=1.3.0';
import { showToast } from '../components/toast.js?v=1.3.0';

/**
 * Genera una gráfica SVG monocromática limpia de evolución de peso
 */
function buildWeightChartSVG(records) {
  const chronological = [...records].sort((a, b) => a.date.localeCompare(b.date));
  if (chronological.length === 0) {
    return `<div class="empty-state">Agrega registros para visualizar la curva de evolución.</div>`;
  }

  const width = 760;
  const height = 190;
  const padX = 42;
  const padY = 26;

  const weights = chronological.map(r => Number(r.weightKg || 0));
  const minW = Math.min(...weights) - 1.2;
  const maxW = Math.max(...weights) + 1.2;
  const range = Math.max(1, maxW - minW);

  const points = chronological.map((r, idx) => {
    const x = chronological.length === 1
      ? width / 2
      : padX + (idx / (chronological.length - 1)) * (width - padX * 2);
    const y = height - padY - ((Number(r.weightKg) - minW) / range) * (height - padY * 2);
    return { x, y, date: r.date.slice(5), val: r.weightKg };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPoints = `${points[0].x},${height - padY} ${polyline} ${points[points.length - 1].x},${height - padY}`;

  return `
    <div class="chart-box">
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <line x1="${padX}" y1="${padY}" x2="${width - padX}" y2="${padY}" stroke="var(--chart-grid)" stroke-width="1"/>
        <line x1="${padX}" y1="${height / 2}" x2="${width - padX}" y2="${height / 2}" stroke="var(--chart-grid)" stroke-width="1"/>
        <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="var(--chart-grid)" stroke-width="1"/>
        <polygon points="${areaPoints}" fill="var(--chart-fill)" />
        <polyline fill="none" stroke="var(--chart-line)" stroke-width="2.5" points="${polyline}" />
        ${points.map(p => `
          <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="var(--bg-surface)" stroke="var(--chart-line)" stroke-width="2.5"/>
          <text x="${p.x}" y="${p.y - 10}" text-anchor="middle" fill="var(--text-primary)" font-size="11" font-family="var(--font-mono)">${p.val}kg</text>
          <text x="${p.x}" y="${height - 6}" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="var(--font-mono)">${p.date}</text>
        `).join('')}
      </svg>
    </div>
  `;
}

export function renderBody(container) {
  const store = getStore();
  const sorted = [...store.bodyMetrics].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0] || {};
  const previous = sorted[1] || latest;

  const weightDelta = latest.weightKg && previous.weightKg
    ? (latest.weightKg - previous.weightKg).toFixed(1)
    : '0.0';

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <span class="page-eyebrow">BIOMETRÍA & ANTROPOMETRÍA</span>
        <h1 class="page-title">Mediciones Corporales</h1>
        <p class="page-subtitle">Control exacto de peso, porcentaje graso, perímetros y registro fotográfico.</p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" id="btn-add-body">
          ${icon('plus')} Registrar Medición
        </button>
      </div>
    </header>

    <section class="grid-kpi">
      <div class="kpi-card">
        <div class="kpi-top"><span>Peso Actual</span>${icon('body')}</div>
        <div class="kpi-value">${latest.weightKg ?? '--'} <small style="font-size:0.9rem;">kg</small></div>
        <div class="kpi-meta">Cambio vs anterior: <span class="mono">${weightDelta > 0 ? '+' + weightDelta : weightDelta} kg</span></div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top"><span>Grasa Corporal</span>${icon('body')}</div>
        <div class="kpi-value">${latest.bodyFatPct ?? '--'} <small style="font-size:0.9rem;">%</small></div>
        <div class="kpi-meta">Meta de peso: <span class="mono">${store.profile.targetWeightKg} kg</span></div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top"><span>Cintura / Abdomen</span>${icon('body')}</div>
        <div class="kpi-value">${latest.waistCm ?? '--'} <small style="font-size:0.9rem;">cm</small></div>
        <div class="kpi-meta">Indicador metabólico clave</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top"><span>Pecho / Brazo</span>${icon('body')}</div>
        <div class="kpi-value">${latest.chestCm ?? '--'} / ${latest.armCm ?? '--'} <small style="font-size:0.85rem;">cm</small></div>
        <div class="kpi-meta">Torso y bíceps contraído</div>
      </div>
    </section>

    <section class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <h2 class="card-title">${icon('body')} Curva de Evolución de Peso (kg)</h2>
      </div>
      ${buildWeightChartSVG(store.bodyMetrics)}
    </section>

    <section class="card">
      <div class="card-header">
        <h2 class="card-title">Historial de Registros Biométricos</h2>
      </div>
      ${sorted.length === 0 ? `
        <div class="empty-state">Sin mediciones registradas todavía.</div>
      ` : `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Peso</th>
                <th>% Grasa</th>
                <th>Cintura</th>
                <th>Pecho</th>
                <th>Brazo</th>
                <th>Notas / Foto</th>
                <th style="text-align:right;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map(item => `
                <tr>
                  <td class="mono">${item.date}</td>
                  <td class="mono" style="font-weight:600;">${item.weightKg} kg</td>
                  <td class="mono">${item.bodyFatPct || '--'}%</td>
                  <td class="mono">${item.waistCm || '--'} cm</td>
                  <td class="mono">${item.chestCm || '--'} cm</td>
                  <td class="mono">${item.armCm || '--'} cm</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span class="text-secondary">${item.notes || '—'}</span>
                      ${item.photoUrl ? `<button type="button" class="badge badge-silver" data-view-photo="${item.id}">${icon('paperclip')} Ver foto</button>` : ''}
                    </div>
                  </td>
                  <td style="text-align:right;">
                    <button type="button" class="btn-icon" data-delete-body="${item.id}" title="Eliminar">
                      ${icon('trash')}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </section>
  `;

  // Ver foto adjunta
  container.querySelectorAll('[data-view-photo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-view-photo');
      const rec = store.bodyMetrics.find(r => r.id === id);
      if (!rec || !rec.photoUrl) return;
      openModal({
        title: `Progreso Corporal — ${rec.date} (${rec.weightKg} kg)`,
        contentHTML: `
          <div style="text-align:center;">
            <img src="${rec.photoUrl}" alt="Foto progreso" style="max-height:65vh;margin:0 auto;border-radius:var(--radius-md);border:1px solid var(--border-default);" />
            <p class="text-secondary" style="margin-top:12px;">${rec.notes || ''}</p>
          </div>
        `
      });
    });
  });

  // Eliminar registro
  container.querySelectorAll('[data-delete-body]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-body');
      const current = getStore();
      current.bodyMetrics = current.bodyMetrics.filter(r => r.id !== id);
      saveStore(current);
      showToast('Medición eliminada');
      renderBody(container);
    });
  });

  // Agregar nueva medición
  const addBtn = container.querySelector('#btn-add-body');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      openModal({
        title: 'Registrar Medición Corporal',
        contentHTML: `
          <form id="form-body">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Fecha</label>
                <input type="date" name="date" class="form-input" value="${todayISO()}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Peso (kg)</label>
                <input type="number" step="0.1" name="weightKg" class="form-input" placeholder="74.5" value="${latest.weightKg || ''}" required />
              </div>
              <div class="form-group">
                <label class="form-label">% Grasa Corporal</label>
                <input type="number" step="0.1" name="bodyFatPct" class="form-input" placeholder="15.0" value="${latest.bodyFatPct || ''}" />
              </div>
              <div class="form-group">
                <label class="form-label">Cintura (cm)</label>
                <input type="number" step="0.1" name="waistCm" class="form-input" placeholder="79.5" value="${latest.waistCm || ''}" />
              </div>
              <div class="form-group">
                <label class="form-label">Pecho (cm)</label>
                <input type="number" step="0.1" name="chestCm" class="form-input" placeholder="102.0" value="${latest.chestCm || ''}" />
              </div>
              <div class="form-group">
                <label class="form-label">Brazo (cm)</label>
                <input type="number" step="0.1" name="armCm" class="form-input" placeholder="37.0" value="${latest.armCm || ''}" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Foto de progreso (opcional)</label>
              <input type="file" name="photoFile" accept="image/*" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Notas / Observaciones</label>
              <input type="text" name="notes" class="form-input" placeholder="En ayunas, post-entreno, etc." />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="cancel-body">Cancelar</button>
              <button type="submit" class="btn btn-primary">Guardar Medición</button>
            </div>
          </form>
        `,
        onMount: (modal) => {
          modal.querySelector('#cancel-body').addEventListener('click', closeModal);
          modal.querySelector('#form-body').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const fileInput = e.target.querySelector('input[name="photoFile"]');
            const file = fileInput?.files?.[0];
            const photoUrl = file ? await fileToDataUrl(file) : '';

            const current = getStore();
            current.bodyMetrics.push({
              id: generateId('bm'),
              date: String(fd.get('date')),
              weightKg: Number(fd.get('weightKg')),
              bodyFatPct: Number(fd.get('bodyFatPct')) || 0,
              waistCm: Number(fd.get('waistCm')) || 0,
              chestCm: Number(fd.get('chestCm')) || 0,
              armCm: Number(fd.get('armCm')) || 0,
              notes: String(fd.get('notes') || '').trim(),
              photoUrl
            });
            saveStore(current);
            closeModal();
            showToast('Medición corporal guardada');
            renderBody(container);
          });
        }
      });
    });
  }
}
