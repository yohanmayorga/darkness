import { getStore, saveStore, generateId, todayISO, fileToDataUrl } from '../services/db.js?v=1.3.0';
import { icon } from '../components/icons.js?v=1.3.0';
import { openModal, closeModal } from '../components/modal.js?v=1.3.0';
import { showToast } from '../components/toast.js?v=1.3.0';

let txFilter = 'all';

export function renderFinance(container) {
  const store = getStore();
  const currency = store.profile.currency || 'USD';
  const budget = Number(store.profile.monthlyBudget || 2000);
  const txs = [...(store.transactions || [])].sort((a, b) => b.date.localeCompare(a.date));

  const totalIncome = txs
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const totalExpense = txs
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const netBalance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100)) : 0;
  const budgetPct = budget > 0 ? Math.min(100, Math.round((totalExpense / budget) * 100)) : 0;

  const filtered = txFilter === 'all'
    ? txs
    : txs.filter(t => t.type === txFilter);

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <span class="page-eyebrow">CONTROL PATRIMONIAL</span>
        <h1 class="page-title">Finanzas Personales</h1>
        <p class="page-subtitle">Flujo de caja, presupuesto mensual, cuentas y comprobantes.</p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" id="btn-new-tx">
          ${icon('plus')} Registrar Movimiento
        </button>
      </div>
    </header>

    <section class="grid-kpi">
      <div class="kpi-card">
        <div class="kpi-top"><span>Ingresos Totales</span>${icon('finance')}</div>
        <div class="kpi-value text-success">+${currency} ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        <div class="kpi-meta">Entradas acumuladas</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top"><span>Gastos Totales</span>${icon('finance')}</div>
        <div class="kpi-value text-danger">-${currency} ${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        <div class="kpi-meta">Salidas registradas</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top"><span>Balance Neto</span>${icon('finance')}</div>
        <div class="kpi-value">${currency} ${netBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        <div class="kpi-meta">Tasa de ahorro: <span class="mono">${savingsRate}%</span></div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top"><span>Presupuesto de Gasto</span>${icon('finance')}</div>
        <div class="kpi-value">${budgetPct}%</div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${budgetPct}%"></div>
        </div>
        <div class="kpi-meta"><span class="mono">${currency} ${totalExpense.toLocaleString('en-US')} / ${budget.toLocaleString('en-US')}</span></div>
      </div>
    </section>

    <div class="filter-tabs">
      <button type="button" class="filter-tab ${txFilter === 'all' ? 'active' : ''}" data-tx-filter="all">Todos</button>
      <button type="button" class="filter-tab ${txFilter === 'income' ? 'active' : ''}" data-tx-filter="income">Ingresos</button>
      <button type="button" class="filter-tab ${txFilter === 'expense' ? 'active' : ''}" data-tx-filter="expense">Gastos</button>
    </div>

    <section class="card">
      <div class="card-header">
        <h2 class="card-title">${icon('finance')} Libro Mayor de Movimientos</h2>
      </div>
      ${filtered.length === 0 ? `
        <div class="empty-state">No hay movimientos registrados para este filtro.</div>
      ` : `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Cuenta</th>
                <th style="text-align:right;">Monto</th>
                <th style="text-align:right;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(tx => `
                <tr>
                  <td class="mono">${tx.date}</td>
                  <td>
                    <div style="font-weight:600;">${tx.description}</div>
                    ${tx.attachmentData ? `<a href="${tx.attachmentData}" download="comprobante-${tx.date}" class="badge badge-silver" style="margin-top:4px;">${icon('paperclip')} Comprobante</a>` : ''}
                  </td>
                  <td><span class="badge">${tx.category}</span></td>
                  <td class="text-secondary">${tx.account}</td>
                  <td style="text-align:right;font-weight:700;" class="mono ${tx.type === 'income' ? 'text-success' : 'text-danger'}">
                    ${tx.type === 'income' ? '+' : '-'}${currency} ${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td style="text-align:right;">
                    <button type="button" class="btn-icon" data-delete-tx="${tx.id}" title="Eliminar">
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

  // Filtros
  container.querySelectorAll('[data-tx-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      txFilter = btn.getAttribute('data-tx-filter');
      renderFinance(container);
    });
  });

  // Eliminar movimiento
  container.querySelectorAll('[data-delete-tx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-tx');
      const current = getStore();
      current.transactions = current.transactions.filter(t => t.id !== id);
      saveStore(current);
      showToast('Movimiento eliminado');
      renderFinance(container);
    });
  });

  // Crear movimiento
  const newBtn = container.querySelector('#btn-new-tx');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      openModal({
        title: 'Registrar Movimiento Financiero',
        contentHTML: `
          <form id="form-tx">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Tipo</label>
                <select name="type" class="form-select">
                  <option value="expense">Gasto (-)</option>
                  <option value="income">Ingreso (+)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Fecha</label>
                <input type="date" name="date" class="form-input" value="${todayISO()}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Monto (${currency})</label>
                <input type="number" step="0.01" min="0.01" name="amount" class="form-input" placeholder="0.00" required />
              </div>
              <div class="form-group">
                <label class="form-label">Categoría</label>
                <select name="category" class="form-select">
                  <option value="Alimentación & Suplementos">Alimentación & Suplementos</option>
                  <option value="Vivienda & Servicios">Vivienda & Servicios</option>
                  <option value="Educación & Libros">Educación & Libros</option>
                  <option value="Entrenamiento & Salud">Entrenamiento & Salud</option>
                  <option value="Inversión & Ahorro">Inversión & Ahorro</option>
                  <option value="Ingresos Principales">Ingresos Principales</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Cuenta / Método</label>
                <input type="text" name="account" class="form-input" value="Banco Principal" required />
              </div>
              <div class="form-group">
                <label class="form-label">Comprobante / Recibo (opcional)</label>
                <input type="file" name="receipt" class="form-input" />
              </div>
              <div class="form-group full">
                <label class="form-label">Descripción</label>
                <input type="text" name="description" class="form-input" placeholder="Detalle del movimiento..." required />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="cancel-tx">Cancelar</button>
              <button type="submit" class="btn btn-primary">Guardar Movimiento</button>
            </div>
          </form>
        `,
        onMount: (modal) => {
          modal.querySelector('#cancel-tx').addEventListener('click', closeModal);
          modal.querySelector('#form-tx').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const fileInput = e.target.querySelector('input[name="receipt"]');
            const file = fileInput?.files?.[0];
            const attachmentData = file ? await fileToDataUrl(file) : '';

            const current = getStore();
            current.transactions.unshift({
              id: generateId('tx'),
              date: String(fd.get('date')),
              type: String(fd.get('type')),
              amount: Number(fd.get('amount')),
              category: String(fd.get('category')),
              account: String(fd.get('account')).trim(),
              description: String(fd.get('description')).trim(),
              attachmentData
            });
            saveStore(current);
            closeModal();
            showToast('Movimiento registrado');
            renderFinance(container);
          });
        }
      });
    });
  }
}
