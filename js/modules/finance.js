import { getStore, saveStore, generateId, todayISO } from '../services/db.js?v=6.9.0';
import { icon } from '../components/icons.js?v=1.4.0';
import { openModal, closeModal } from '../components/modal.js?v=1.4.0';
import { showToast } from '../components/toast.js?v=1.4.0';
import { buildUnifiedCalendarHTML, bindUnifiedCalendar } from '../components/calendar.js?v=2.6.0';
import { formatDateDMY } from '../utils/text.js?v=4.3.0';

let txFilter = 'all';
let chartScope = 'month';
const calState = { year: null, month: null, selectedDate: '' };

const FINANCE_CATEGORIES = [
  'Alimentación',
  'Gimnasio',
  'Inversión y ahorros',
  'Ingresos principales',
  'Ingresos extras',
  'Transporte',
  'Teléfono',
  'Suscripciones',
  'Pago de deudas',
  'Ropa y calzado',
  'Salidas',
  'Regalos',
  'Compras menores',
  'No recuerdo',
  'Otro'
];

const ACCOUNT_KEYS = ['bank', 'binance', 'bolivares', 'cash', 'other'];

function ensureFinance(store) {
  if (!store.finance || typeof store.finance !== 'object') {
    store.finance = {};
  }
  const f = store.finance;
  if (!f.bankName) f.bankName = 'UNFCU';
  if (typeof f.bankCustomName !== 'string') f.bankCustomName = '';
  if (!f.accounts || typeof f.accounts !== 'object') {
    f.accounts = { bank: 0, binance: 0, bolivares: 0, cash: 0, other: 0 };
  }
  ACCOUNT_KEYS.forEach(k => {
    f.accounts[k] = Number(f.accounts[k]) || 0;
  });
  if (!Array.isArray(f.receivables)) f.receivables = [];
  if (!Array.isArray(f.projectedIncome)) f.projectedIncome = [];
  if (!Array.isArray(f.projectedExpenses)) f.projectedExpenses = [];
  if (!Array.isArray(f.debts)) f.debts = [];
  if (!Array.isArray(store.transactions)) store.transactions = [];
  return f;
}

function getAccountLabel(key) {
  switch (key) {
    case 'bank': return 'Banco';
    case 'binance': return 'Binance';
    case 'bolivares': return 'Bolívares';
    case 'cash': return 'Efectivo';
    case 'other': return 'Otro';
    default: return key || '—';
  }
}

function fmtMoney(amount, currency) {
  const num = Math.round(Number(amount) || 0);
  return `${currency} ${num.toLocaleString('en-US')}`;
}

function sumList(list) {
  return (list || []).reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderFinance(container) {
  const store = getStore();
  const finance = ensureFinance(store);
  const today = todayISO();
  if (calState.year === null) {
    const [y, m] = today.split('-').map(Number);
    calState.year = y;
    calState.month = m - 1;
    calState.selectedDate = today;
  }

  const currency = store.profile.currency || 'USD';
  const txs = [...store.transactions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const totalTengo = ACCOUNT_KEYS.reduce((acc, k) => acc + (Number(finance.accounts[k]) || 0), 0);
  const totalOwedToMe = sumList(finance.receivables);
  const totalProjectedIncome = sumList(finance.projectedIncome);
  const totalProjectedExpenses = sumList(finance.projectedExpenses);
  const totalDebts = sumList(finance.debts);

  const totalObligations = totalProjectedExpenses + totalDebts;
  const availableToSpend = totalTengo - totalObligations;
  const projectedMoney = totalTengo + totalProjectedIncome + totalOwedToMe - totalObligations;

  const filtered = txs.filter(t => {
    if (txFilter === 'all') return true;
    return t.type === txFilter;
  });

  // Datos para la gráfica de gastos por categoría
  const currentMonthPrefix = today.slice(0, 7);
  const expenseTxsForChart = txs.filter(t => {
    if (t.type !== 'expense') return false;
    if (chartScope === 'month') return (t.date || '').startsWith(currentMonthPrefix);
    return true;
  });

  const categoryMap = new Map();
  expenseTxsForChart.forEach(t => {
    const cat = t.category || 'No recuerdo';
    const prev = categoryMap.get(cat) || { amount: 0, count: 0 };
    categoryMap.set(cat, {
      amount: prev.amount + (Number(t.amount) || 0),
      count: prev.count + 1
    });
  });

  const chartItems = [...categoryMap.entries()]
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.amount - a.amount);
  const chartTotalExpense = chartItems.reduce((acc, i) => acc + i.amount, 0);

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <span class="page-eyebrow">CONTROL PATRIMONIAL</span>
        <h1 class="page-title">Finanzas Personales</h1>
        <p class="page-subtitle">Saldos actuales, cuentas por cobrar, proyecciones, deudas e historial de gastos.</p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" id="btn-new-tx">
          ${icon('plus')} Registrar Movimiento
        </button>
      </div>
    </header>

    <section class="grid-kpi">
      <div class="kpi-card">
        <div class="kpi-top"><span>Dinero Ahorita</span>${icon('finance')}</div>
        <div class="kpi-value text-success">${fmtMoney(totalTengo, currency)}</div>
        <div class="kpi-meta">Suma de cuentas (sin lo que me deben: <span class="mono">${fmtMoney(totalOwedToMe, currency)}</span>)</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top"><span>Disponible para gastar</span>${icon('finance')}</div>
        <div class="kpi-value ${availableToSpend >= 0 ? 'text-success' : 'text-danger'}">${fmtMoney(availableToSpend, currency)}</div>
        <div class="kpi-meta">Lo que tengo menos gastos proy. y deudas</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top"><span>Dinero Proyectado</span>${icon('finance')}</div>
        <div class="kpi-value ${projectedMoney >= 0 ? 'text-success' : 'text-danger'}">${fmtMoney(projectedMoney, currency)}</div>
        <div class="kpi-meta">Incluye <span class="mono">+${fmtMoney(totalProjectedIncome, currency)}</span> proy. y <span class="mono">+${fmtMoney(totalOwedToMe, currency)}</span> por cobrar</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top"><span>Gastos + Deudas</span>${icon('finance')}</div>
        <div class="kpi-value text-danger">-${fmtMoney(totalObligations, currency)}</div>
        <div class="kpi-meta">Proy: <span class="mono">${fmtMoney(totalProjectedExpenses, currency)}</span> · Deudas: <span class="mono">${fmtMoney(totalDebts, currency)}</span></div>
      </div>
    </section>

    <section class="grid-2" style="margin-bottom:20px;">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">${icon('finance')} Cuánto Tengo (Cuentas)</h2>
          <span class="badge badge-success mono">${fmtMoney(totalTengo, currency)}</span>
        </div>
        <div class="finance-accounts-list">
          <div class="finance-account-row">
            <div class="finance-account-label">
              <span class="finance-account-name">Banco</span>
            </div>
            <input type="number" step="any" class="form-input finance-amount-input" data-account-input="bank" value="${Math.round(finance.accounts.bank)}" aria-label="Saldo en Banco" />
          </div>

          <div class="finance-account-row">
            <div class="finance-account-label">
              <span class="finance-account-name">Binance</span>
            </div>
            <input type="number" step="any" class="form-input finance-amount-input" data-account-input="binance" value="${Math.round(finance.accounts.binance)}" aria-label="Saldo en Binance" />
          </div>

          <div class="finance-account-row">
            <div class="finance-account-label">
              <span class="finance-account-name">Bolívares</span>
            </div>
            <input type="number" step="any" class="form-input finance-amount-input" data-account-input="bolivares" value="${Math.round(finance.accounts.bolivares)}" aria-label="Saldo en Bolívares" />
          </div>

          <div class="finance-account-row">
            <div class="finance-account-label">
              <span class="finance-account-name">Efectivo</span>
            </div>
            <input type="number" step="any" class="form-input finance-amount-input" data-account-input="cash" value="${Math.round(finance.accounts.cash)}" aria-label="Saldo en Efectivo" />
          </div>

          <div class="finance-account-row">
            <div class="finance-account-label">
              <span class="finance-account-name">Otro</span>
            </div>
            <input type="number" step="any" class="form-input finance-amount-input" data-account-input="other" value="${Math.round(finance.accounts.other)}" aria-label="Otro saldo" />
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">${icon('finance')} Gastos Proyectados</h2>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge badge-danger mono">-${fmtMoney(totalProjectedExpenses, currency)}</span>
            <button type="button" class="btn btn-secondary btn-sm" data-add-list="projectedExpenses">${icon('plus')}</button>
          </div>
        </div>
        ${renderSimpleListHTML(finance.projectedExpenses, 'projectedExpenses', currency, 'Sin gastos proyectados.', 'text-danger')}
      </div>
    </section>

    <section class="grid-2" style="margin-bottom:20px;">
      <div class="grid-2" style="gap:14px;">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">${icon('plus')} Ingresos Proyectados</h2>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="badge badge-success mono">+${fmtMoney(totalProjectedIncome, currency)}</span>
              <button type="button" class="btn btn-secondary btn-sm" data-add-list="projectedIncome">${icon('plus')}</button>
            </div>
          </div>
          ${renderSimpleListHTML(finance.projectedIncome, 'projectedIncome', currency, 'Sin ingresos proyectados.', 'text-success')}
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">${icon('finance')} Lo que me deben</h2>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="badge badge-silver mono">${fmtMoney(totalOwedToMe, currency)}</span>
              <button type="button" class="btn btn-secondary btn-sm" data-add-list="receivables">${icon('plus')}</button>
            </div>
          </div>
          ${finance.receivables.length === 0 ? `
            <div class="empty-state">No tienes cobros pendientes registrados.</div>
          ` : `
            <div class="finance-items-list">
              ${finance.receivables.map(item => `
                <div class="finance-list-item">
                  <div class="finance-list-item-info">
                    <div class="finance-list-item-title">${escapeHtml(item.person || item.title)}</div>
                    <div class="finance-list-item-meta">${escapeHtml(item.note || item.date || 'Por cobrar')}</div>
                  </div>
                  <div class="finance-list-item-right">
                    <span class="mono text-success" style="font-weight:600;">${fmtMoney(item.amount, currency)}</span>
                    <button type="button" class="btn btn-secondary btn-sm" data-collect-receivable="${item.id}" title="Marcar como cobrado" style="min-height:28px;padding:3px 8px;font-size:0.72rem;">Cobrado</button>
                    <button type="button" class="btn-icon" data-edit-list="receivables" data-edit-id="${item.id}" title="Editar" aria-label="Editar" style="width:28px;height:28px;">
                      ${icon('edit')}
                    </button>
                    <button type="button" class="btn-icon" data-del-list="receivables" data-del-id="${item.id}" title="Eliminar" aria-label="Eliminar" style="width:28px;height:28px;">
                      ${icon('trash')}
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">${icon('finance')} Deudas</h2>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge badge-danger mono">-${fmtMoney(totalDebts, currency)}</span>
            <button type="button" class="btn btn-secondary btn-sm" data-add-list="debts">${icon('plus')}</button>
          </div>
        </div>
        ${renderSimpleListHTML(finance.debts, 'debts', currency, 'Sin deudas registradas.', 'text-danger')}
      </div>
    </section>

    <section class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <h2 class="card-title">${icon('finance')} En qué estoy gastando (Categorías)</h2>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="badge badge-danger mono">${fmtMoney(chartTotalExpense, currency)}</span>
          <select class="form-select" id="fin-chart-scope" style="width:auto;min-height:34px;padding:4px 10px;font-size:0.8rem;" aria-label="Período de gráfica">
            <option value="month" ${chartScope === 'month' ? 'selected' : ''}>Este mes</option>
            <option value="all" ${chartScope === 'all' ? 'selected' : ''}>Todo el historial</option>
          </select>
        </div>
      </div>
      ${chartItems.length === 0 ? `
        <div class="empty-state">No hay gastos registrados en este período para graficar.</div>
      ` : `
        <div class="finance-chart-list">
          ${chartItems.map(item => {
            const pct = chartTotalExpense > 0 ? Math.round((item.amount / chartTotalExpense) * 100) : 0;
            return `
              <div class="finance-chart-row">
                <div class="finance-chart-meta">
                  <span class="finance-chart-cat">${escapeHtml(item.category)} <span class="text-muted">(${item.count})</span></span>
                  <span class="finance-chart-val">${fmtMoney(item.amount, currency)} · ${pct}%</span>
                </div>
                <div class="finance-chart-track">
                  <div class="finance-chart-fill" style="width:${pct}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </section>

    <div class="filter-tabs">
      <button type="button" class="filter-tab ${txFilter === 'all' ? 'active' : ''}" data-tx-filter="all">Todos</button>
      <button type="button" class="filter-tab ${txFilter === 'expense' ? 'active' : ''}" data-tx-filter="expense">Gastos</button>
      <button type="button" class="filter-tab ${txFilter === 'income' ? 'active' : ''}" data-tx-filter="income">Ingresos</button>
    </div>

    <section class="card">
      <div class="card-header">
        <h2 class="card-title">${icon('finance')} Historial de Movimientos</h2>
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
                <th>Tipo</th>
                <th style="text-align:right;">Monto</th>
                <th style="text-align:right;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(tx => {
                const isPositive = tx.type === 'income';
                const sign = isPositive ? '+' : '-';
                const colorClass = isPositive ? 'text-success' : 'text-danger';
                return `
                  <tr>
                    <td class="mono">${formatDateDMY(tx.date)}</td>
                    <td style="font-weight:600;">${escapeHtml(tx.description)}</td>
                    <td><span class="badge">${escapeHtml(tx.category)}</span></td>
                    <td class="text-secondary mono" style="font-size:0.74rem;">${isPositive ? 'Ingreso' : 'Gasto'}</td>
                    <td style="text-align:right;font-weight:700;" class="mono ${colorClass}">
                      ${sign}${fmtMoney(tx.amount, currency)}
                    </td>
                    <td style="text-align:right;">
                      <button type="button" class="btn-icon" data-delete-tx="${tx.id}" title="Eliminar">
                        ${icon('trash')}
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </section>

    <aside class="section-aside" aria-label="Calendario y resumen financiero">
      <section class="card habit-calendar" id="finance-calendar" aria-label="Calendario financiero">
        ${(() => {
          const marked = new Map();
          txs.forEach(t => {
            if (!t.date) return;
            marked.set(t.date, `${t.category || 'Movimiento'}: ${fmtMoney(t.amount, currency)}`);
          });
          const dayTxs = txs.filter(t => t.date === calState.selectedDate);
          return buildUnifiedCalendarHTML({
            year: calState.year,
            month: calState.month,
            today,
            selectedDate: calState.selectedDate,
            markedDates: marked,
            footerLabel: 'Días con movimientos',
            legendLabel: 'con mov.',
            actionHTML: `
              <div class="body-cal-day-action">
                <div>
                  <div class="mono" style="font-weight:600;">${formatDateDMY(calState.selectedDate)}</div>
                  <div class="text-muted">${dayTxs.length ? `${dayTxs.length} movimiento(s)` : 'Sin movimientos'}</div>
                </div>
              </div>
            `
          });
        })()}
      </section>
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">${icon('finance')} Resumen</h2>
          <span class="cyber-tag">FIN</span>
        </div>
        <p class="body-summary-text">
          Tienes <strong class="mono">${fmtMoney(totalTengo, currency)}</strong> ahora. Disponible para gastar: <strong class="mono">${fmtMoney(availableToSpend, currency)}</strong>. Proyectado (con lo que te deben): <strong class="mono">${fmtMoney(projectedMoney, currency)}</strong>.
        </p>
      </section>
    </aside>
  `;

  bindUnifiedCalendar(container.querySelector('#finance-calendar'), {
    state: calState,
    today,
    onChange: () => renderFinance(container)
  });

  // Edición manual de saldos de cuentas
  container.querySelectorAll('[data-account-input]').forEach(input => {
    input.addEventListener('change', () => {
      const key = input.getAttribute('data-account-input');
      const current = getStore();
      const f = ensureFinance(current);
      f.accounts[key] = Math.round(Number(input.value) || 0);
      saveStore(current);
      showToast(`Saldo de ${getAccountLabel(key)} actualizado`);
      renderFinance(container);
    });
  });

  // Scope de gráfica
  const scopeSelect = container.querySelector('#fin-chart-scope');
  if (scopeSelect) {
    scopeSelect.addEventListener('change', () => {
      chartScope = scopeSelect.value;
      renderFinance(container);
    });
  }

  // Filtros de tabla
  container.querySelectorAll('[data-tx-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      txFilter = btn.getAttribute('data-tx-filter');
      renderFinance(container);
    });
  });

  // Agregar a listas (receivables, projectedIncome, projectedExpenses, debts)
  container.querySelectorAll('[data-add-list]').forEach(btn => {
    btn.addEventListener('click', () => {
      const listKey = btn.getAttribute('data-add-list');
      openListItemModal(listKey, currency, () => renderFinance(container));
    });
  });

  // Editar elementos de listas (receivables, projectedIncome, projectedExpenses, debts)
  container.querySelectorAll('[data-edit-list]').forEach(btn => {
    btn.addEventListener('click', () => {
      const listKey = btn.getAttribute('data-edit-list');
      const id = btn.getAttribute('data-edit-id');
      const current = getStore();
      const f = ensureFinance(current);
      const existing = (f[listKey] || []).find(item => item.id === id);
      if (!existing) return;
      openListItemModal(listKey, currency, () => renderFinance(container), existing);
    });
  });

  // Eliminar de listas
  container.querySelectorAll('[data-del-list]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!window.confirm('¿Estás seguro de borrar este registro?')) return;
      const listKey = btn.getAttribute('data-del-list');
      const id = btn.getAttribute('data-del-id');
      const current = getStore();
      const f = ensureFinance(current);
      f[listKey] = f[listKey].filter(item => item.id !== id);
      saveStore(current);
      showToast('Elemento eliminado');
      renderFinance(container);
    });
  });

  // Marcar como cobrado en "Lo que me deben" (sin alterar cuentas automáticamente)
  container.querySelectorAll('[data-collect-receivable]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-collect-receivable');
      const current = getStore();
      const f = ensureFinance(current);
      f.receivables = f.receivables.filter(r => r.id !== id);
      saveStore(current);
      showToast('Marcado como cobrado');
      renderFinance(container);
    });
  });

  // Eliminar movimiento (solo historial, no altera cuentas)
  container.querySelectorAll('[data-delete-tx]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!window.confirm('¿Estás seguro de borrar este movimiento del historial?')) return;
      const id = btn.getAttribute('data-delete-tx');
      const current = getStore();
      current.transactions = current.transactions.filter(t => t.id !== id);
      saveStore(current);
      showToast('Movimiento eliminado del historial');
      renderFinance(container);
    });
  });

  // Registrar nuevo movimiento (solo historial y gráfica, no altera cuentas)
  const newBtn = container.querySelector('#btn-new-tx');
  if (newBtn) {
    newBtn.addEventListener('click', () => openNewTxModal(currency, () => renderFinance(container)));
  }
}

function renderSimpleListHTML(items, listKey, currency, emptyText, colorClass) {
  if (!items || items.length === 0) {
    return `<div class="empty-state">${emptyText}</div>`;
  }
  return `
    <div class="finance-items-list">
      ${items.map(item => `
        <div class="finance-list-item">
          <div class="finance-list-item-info">
            <div class="finance-list-item-title">${escapeHtml(item.title)}</div>
            ${item.note ? `<div class="finance-list-item-meta">${escapeHtml(item.note)}</div>` : ''}
          </div>
          <div class="finance-list-item-right">
            <span class="mono ${colorClass}" style="font-weight:600;">${fmtMoney(item.amount, currency)}</span>
            <button type="button" class="btn-icon" data-edit-list="${listKey}" data-edit-id="${item.id}" title="Editar" aria-label="Editar" style="width:28px;height:28px;">
              ${icon('edit')}
            </button>
            <button type="button" class="btn-icon" data-del-list="${listKey}" data-del-id="${item.id}" title="Eliminar" aria-label="Eliminar" style="width:28px;height:28px;">
              ${icon('trash')}
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openListItemModal(listKey, currency, onDone, existingItem = null) {
  const isEdit = Boolean(existingItem);
  const titles = {
    receivables: isEdit ? 'Editar: Lo que me deben' : 'Agregar: Lo que me deben',
    projectedIncome: isEdit ? 'Editar Ingreso Proyectado' : 'Agregar Ingreso Proyectado',
    projectedExpenses: isEdit ? 'Editar Gasto Proyectado' : 'Agregar Gasto Proyectado',
    debts: isEdit ? 'Editar Deuda' : 'Agregar Deuda'
  };
  const nameLabels = {
    receivables: 'Persona / Concepto',
    projectedIncome: 'Concepto del ingreso',
    projectedExpenses: 'Concepto del gasto',
    debts: 'Deuda / Acreedor'
  };

  const initialTitle = existingItem ? (existingItem.person || existingItem.title || '') : '';
  const initialAmount = existingItem && existingItem.amount !== undefined ? existingItem.amount : '';
  const initialNote = existingItem ? (existingItem.note || '') : '';
  const initialDate = existingItem ? (existingItem.date || todayISO()) : todayISO();

  openModal({
    title: titles[listKey] || (isEdit ? 'Editar Registro' : 'Agregar Registro'),
    contentHTML: `
      <form id="form-fin-list-item">
        <div class="form-grid">
          <div class="form-group full">
            <label class="form-label">${nameLabels[listKey] || 'Concepto'}</label>
            <input type="text" name="title" class="form-input" value="${escapeHtml(initialTitle)}" placeholder="Ej. Alquiler, Juan, Tarjeta..." required />
          </div>
          <div class="form-group">
            <label class="form-label">Monto (${currency})</label>
            <input type="number" step="any" min="0" name="amount" class="form-input" value="${initialAmount}" placeholder="0" required />
          </div>
          <div class="form-group">
            <label class="form-label">Nota / Detalle (opcional)</label>
            <input type="text" name="note" class="form-input" value="${escapeHtml(initialNote)}" placeholder="Detalle breve" />
          </div>
          ${listKey === 'receivables' ? `
            <div class="form-group full">
              <label class="form-label">Fecha</label>
              <input type="date" name="date" class="form-input" value="${escapeHtml(initialDate)}" />
            </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="cancel-list-item">Cancelar</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar cambios' : 'Guardar'}</button>
        </div>
      </form>
    `,
    onMount: (modal) => {
      modal.querySelector('#cancel-list-item').addEventListener('click', closeModal);
      modal.querySelector('#form-fin-list-item').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const title = String(fd.get('title')).trim();
        const amount = Math.round(Number(fd.get('amount')) || 0);
        const note = String(fd.get('note') || '').trim();
        const dateVal = String(fd.get('date') || '').trim();
        const current = getStore();
        const f = ensureFinance(current);

        if (isEdit) {
          f[listKey] = (f[listKey] || []).map(item => {
            if (item.id !== existingItem.id) return item;
            if (listKey === 'receivables') {
              return { ...item, person: title, title, amount, note, date: dateVal || item.date || todayISO() };
            }
            return { ...item, title, amount, note };
          });
        } else {
          const entry = listKey === 'receivables'
            ? { id: generateId('rec'), person: title, title, amount, note, date: dateVal || todayISO() }
            : { id: generateId('fin'), title, amount, note };
          f[listKey].unshift(entry);
        }

        saveStore(current);
        closeModal();
        showToast(isEdit ? 'Registro actualizado' : 'Registro agregado');
        onDone();
      });
    }
  });
}

function openNewTxModal(currency, onDone) {
  openModal({
    title: 'Registrar Movimiento (Historial)',
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
            <input type="number" step="any" min="1" name="amount" class="form-input" placeholder="0" required />
          </div>
          <div class="form-group">
            <label class="form-label">Categoría</label>
            <select name="category" class="form-select">
              ${FINANCE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
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
      modal.querySelector('#form-tx').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const current = getStore();
        ensureFinance(current);

        current.transactions.unshift({
          id: generateId('tx'),
          date: String(fd.get('date')),
          type: String(fd.get('type')),
          amount: Math.round(Number(fd.get('amount')) || 0),
          category: String(fd.get('category')),
          description: String(fd.get('description')).trim()
        });

        saveStore(current);
        closeModal();
        showToast('Movimiento guardado en el historial');
        onDone();
      });
    }
  });
}
