import { getStore, saveStore, generateId, todayISO } from '../services/db.js?v=6.9.0';
import { icon } from '../components/icons.js?v=1.4.0';
import { openModal, closeModal } from '../components/modal.js?v=1.4.0';
import { showToast } from '../components/toast.js?v=1.4.0';
import { buildUnifiedCalendarHTML, bindUnifiedCalendar } from '../components/calendar.js?v=2.6.0';
import { formatDateDMY } from '../utils/text.js?v=4.3.0';

let txFilter = 'all';
let chartScope = 'month';
const calState = { year: null, month: null, selectedDate: '' };

const DEFAULT_FINANCE_CATEGORIES = {
  expense: [
    'Alimentación',
    'Gimnasio',
    'Cuidado personal',
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
  ],
  income: [
    'Inversión y ahorros',
    'Ingresos principales',
    'Ingresos extras',
    'Cobro de deuda',
    'Regalos',
    'Otro'
  ]
};

const ACCOUNT_KEYS = ['bank', 'binance', 'bolivares', 'cash', 'other'];

function sortCategories(list) {
  return [...list].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

function sanitizeCategoryList(list, fallback) {
  if (!Array.isArray(list) || list.length === 0) return sortCategories(fallback);
  const seen = new Set();
  const clean = [];
  list.forEach(item => {
    const name = String(item || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    clean.push(name);
  });
  return clean.length > 0 ? sortCategories(clean) : sortCategories(fallback);
}

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
  if (!f.categories || typeof f.categories !== 'object') {
    f.categories = {
      expense: sortCategories(DEFAULT_FINANCE_CATEGORIES.expense),
      income: sortCategories(DEFAULT_FINANCE_CATEGORIES.income)
    };
  } else {
    f.categories.expense = sanitizeCategoryList(f.categories.expense, DEFAULT_FINANCE_CATEGORIES.expense);
    f.categories.income = sanitizeCategoryList(f.categories.income, DEFAULT_FINANCE_CATEGORIES.income);
  }
  if (!Array.isArray(f.receivables)) f.receivables = [];
  if (!Array.isArray(f.projectedIncome)) f.projectedIncome = [];
  if (!Array.isArray(f.projectedExpenses)) f.projectedExpenses = [];
  if (!Array.isArray(f.debts)) f.debts = [];
  if (!Array.isArray(store.transactions)) store.transactions = [];
  return f;
}

function getCategoriesByType(store, type) {
  const f = ensureFinance(store);
  const key = type === 'income' ? 'income' : 'expense';
  return sortCategories(f.categories[key]);
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
        <button type="button" class="btn btn-secondary" id="btn-manage-categories">
          ${icon('settings')} Categorías
        </button>
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
                      <div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:4px;">
                        <button type="button" class="btn-icon" data-edit-tx="${tx.id}" title="Editar" aria-label="Editar">
                          ${icon('edit')}
                        </button>
                        <button type="button" class="btn-icon" data-delete-tx="${tx.id}" title="Eliminar" aria-label="Eliminar">
                          ${icon('trash')}
                        </button>
                      </div>
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

  // Editar movimiento del historial
  container.querySelectorAll('[data-edit-tx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-tx');
      const current = getStore();
      const existing = (current.transactions || []).find(t => t.id === id);
      if (!existing) return;
      openTxModal(currency, () => renderFinance(container), existing);
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

  // Panel de control de categorías
  const manageCatBtn = container.querySelector('#btn-manage-categories');
  if (manageCatBtn) {
    manageCatBtn.addEventListener('click', () => {
      openCategoriesManagerModal('expense', () => renderFinance(container));
    });
  }

  // Registrar nuevo movimiento (solo historial y gráfica, no altera cuentas)
  const newBtn = container.querySelector('#btn-new-tx');
  if (newBtn) {
    newBtn.addEventListener('click', () => openTxModal(currency, () => renderFinance(container)));
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

function openTxModal(currency, onDone, existingTx = null, initialType = 'expense') {
  const isEdit = Boolean(existingTx);
  const safeType = existingTx
    ? (existingTx.type === 'income' ? 'income' : 'expense')
    : (initialType === 'income' ? 'income' : 'expense');

  const initialDate = existingTx ? (existingTx.date || todayISO()) : todayISO();
  const initialAmount = existingTx && existingTx.amount !== undefined ? existingTx.amount : '';
  const initialCategory = existingTx ? (existingTx.category || '') : '';
  const initialDescription = existingTx ? (existingTx.description || '') : '';

  const buildCategoryOptionsHTML = (type, selectedCat = '') => {
    let cats = getCategoriesByType(getStore(), type);
    if (selectedCat && !cats.some(c => c.toLowerCase() === selectedCat.toLowerCase())) {
      cats = sortCategories([...cats, selectedCat]);
    }
    return cats.map(c => {
      const isSelected = selectedCat && c.toLowerCase() === selectedCat.toLowerCase() ? 'selected' : '';
      return `<option value="${escapeHtml(c)}" ${isSelected}>${escapeHtml(c)}</option>`;
    }).join('');
  };

  openModal({
    title: isEdit ? 'Editar Movimiento (Historial)' : 'Registrar Movimiento (Historial)',
    contentHTML: `
      <form id="form-tx">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Tipo</label>
            <select name="type" class="form-select">
              <option value="expense" ${safeType === 'expense' ? 'selected' : ''}>Gasto (-)</option>
              <option value="income" ${safeType === 'income' ? 'selected' : ''}>Ingreso (+)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha</label>
            <input type="date" name="date" class="form-input" value="${escapeHtml(initialDate)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Monto (${currency})</label>
            <input type="number" step="any" min="1" name="amount" class="form-input" value="${initialAmount}" placeholder="0" required />
          </div>
          <div class="form-group">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <label class="form-label" style="margin-bottom:0;">Categoría</label>
              <button type="button" class="btn btn-ghost btn-sm" id="btn-tx-manage-cats" style="min-height:24px;height:24px;padding:0 6px;font-size:0.72rem;">Gestionar</button>
            </div>
            <select name="category" class="form-select">
              ${buildCategoryOptionsHTML(safeType, initialCategory)}
            </select>
          </div>
          <div class="form-group full">
            <label class="form-label">Descripción</label>
            <input type="text" name="description" class="form-input" value="${escapeHtml(initialDescription)}" placeholder="Detalle del movimiento..." required />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="cancel-tx">Cancelar</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar cambios' : 'Guardar Movimiento'}</button>
        </div>
      </form>
    `,
    onMount: (modal) => {
      const typeSelect = modal.querySelector('select[name="type"]');
      const categorySelect = modal.querySelector('select[name="category"]');

      typeSelect.addEventListener('change', () => {
        categorySelect.innerHTML = buildCategoryOptionsHTML(typeSelect.value);
      });

      const manageBtn = modal.querySelector('#btn-tx-manage-cats');
      if (manageBtn) {
        manageBtn.addEventListener('click', () => {
          const currentType = typeSelect.value;
          const draftTx = isEdit ? {
            ...existingTx,
            type: currentType,
            date: modal.querySelector('input[name="date"]')?.value || existingTx.date,
            amount: modal.querySelector('input[name="amount"]')?.value || existingTx.amount,
            category: categorySelect.value,
            description: modal.querySelector('input[name="description"]')?.value || existingTx.description
          } : null;

          openCategoriesManagerModal(currentType, () => {
            if (typeof onDone === 'function') onDone();
            openTxModal(currency, onDone, draftTx, currentType);
          });
        });
      }

      modal.querySelector('#cancel-tx').addEventListener('click', closeModal);
      modal.querySelector('#form-tx').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const current = getStore();
        ensureFinance(current);

        const nextData = {
          date: String(fd.get('date')),
          type: String(fd.get('type')),
          amount: Math.round(Number(fd.get('amount')) || 0),
          category: String(fd.get('category')),
          description: String(fd.get('description')).trim()
        };

        if (isEdit) {
          current.transactions = current.transactions.map(t => (
            t.id === existingTx.id ? { ...t, ...nextData } : t
          ));
        } else {
          current.transactions.unshift({
            id: generateId('tx'),
            ...nextData
          });
        }

        saveStore(current);
        closeModal();
        showToast(isEdit ? 'Movimiento actualizado' : 'Movimiento guardado en el historial');
        onDone();
      });
    }
  });
}

function openCategoriesManagerModal(initialType = 'expense', onDone = null) {
  let activeType = initialType === 'income' ? 'income' : 'expense';
  let editingCat = null;

  openModal({
    title: 'Panel de Control · Categorías',
    contentHTML: '<div id="fin-cat-manager-root"></div>',
    onMount: (modal) => {
      const root = modal.querySelector('#fin-cat-manager-root');

      const finish = () => {
        closeModal();
        if (typeof onDone === 'function') onDone();
      };

      const renderManager = () => {
        const current = getStore();
        const f = ensureFinance(current);
        const categories = sortCategories(f.categories[activeType]);
        const usageCount = new Map();
        current.transactions.forEach(tx => {
          if (tx.type !== activeType) return;
          const key = tx.category || '';
          usageCount.set(key, (usageCount.get(key) || 0) + 1);
        });

        root.innerHTML = `
          <div class="filter-tabs" style="margin-bottom:12px;">
            <button type="button" class="filter-tab ${activeType === 'expense' ? 'active' : ''}" data-cat-tab="expense">
              Gastos (${f.categories.expense.length})
            </button>
            <button type="button" class="filter-tab ${activeType === 'income' ? 'active' : ''}" data-cat-tab="income">
              Ingresos (${f.categories.income.length})
            </button>
          </div>

          <form id="form-add-cat" style="display:flex;gap:8px;margin-bottom:12px;">
            <input type="text" name="catName" class="form-input" placeholder="Nueva categoría de ${activeType === 'income' ? 'ingreso' : 'gasto'}..." required style="flex:1;" />
            <button type="submit" class="btn btn-primary btn-sm">${icon('plus')} Agregar</button>
          </form>

          <div class="finance-items-list" style="max-height:280px;">
            ${categories.map(cat => {
              const count = usageCount.get(cat) || 0;
              if (editingCat === cat) {
                return `
                  <form class="finance-list-item" data-edit-cat-form="${escapeHtml(cat)}" style="gap:6px;">
                    <input type="text" name="newCatName" class="form-input" value="${escapeHtml(cat)}" required style="flex:1;min-height:32px;height:32px;font-size:0.84rem;" />
                    <button type="submit" class="btn-icon" title="Guardar" aria-label="Guardar" style="width:28px;height:28px;">
                      ${icon('check')}
                    </button>
                    <button type="button" class="btn-icon" data-cancel-edit-cat title="Cancelar" aria-label="Cancelar" style="width:28px;height:28px;">
                      ${icon('close')}
                    </button>
                  </form>
                `;
              }
              return `
                <div class="finance-list-item">
                  <div class="finance-list-item-info">
                    <div class="finance-list-item-title">${escapeHtml(cat)}</div>
                    <div class="finance-list-item-meta">${count} movimiento(s)</div>
                  </div>
                  <div class="finance-list-item-right">
                    <button type="button" class="btn-icon" data-start-edit-cat="${escapeHtml(cat)}" title="Renombrar" aria-label="Renombrar" style="width:28px;height:28px;">
                      ${icon('edit')}
                    </button>
                    <button type="button" class="btn-icon" data-del-cat="${escapeHtml(cat)}" title="Eliminar" aria-label="Eliminar" style="width:28px;height:28px;">
                      ${icon('trash')}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="modal-footer" style="justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <button type="button" class="btn btn-ghost btn-sm" id="btn-reset-cats">Restaurar predeterminadas</button>
            <button type="button" class="btn btn-secondary" id="btn-close-cats">Listo</button>
          </div>
        `;

        root.querySelectorAll('[data-cat-tab]').forEach(tab => {
          tab.addEventListener('click', () => {
            activeType = tab.getAttribute('data-cat-tab');
            editingCat = null;
            renderManager();
          });
        });

        root.querySelector('#form-add-cat').addEventListener('submit', (e) => {
          e.preventDefault();
          const input = e.target.querySelector('input[name="catName"]');
          const newName = String(input.value || '').trim();
          if (!newName) return;

          const st = getStore();
          const fin = ensureFinance(st);
          const list = fin.categories[activeType];
          const exists = list.some(c => c.toLowerCase() === newName.toLowerCase());
          if (exists) {
            showToast('Esa categoría ya existe en esta lista');
            return;
          }

          fin.categories[activeType] = sortCategories([...list, newName]);
          saveStore(st);
          showToast('Categoría agregada');
          renderManager();
        });

        root.querySelectorAll('[data-start-edit-cat]').forEach(btn => {
          btn.addEventListener('click', () => {
            editingCat = btn.getAttribute('data-start-edit-cat');
            renderManager();
            const editInput = root.querySelector('input[name="newCatName"]');
            if (editInput) {
              editInput.focus();
              editInput.select();
            }
          });
        });

        const cancelEditBtn = root.querySelector('[data-cancel-edit-cat]');
        if (cancelEditBtn) {
          cancelEditBtn.addEventListener('click', () => {
            editingCat = null;
            renderManager();
          });
        }

        const editForm = root.querySelector('[data-edit-cat-form]');
        if (editForm) {
          editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const oldName = editForm.getAttribute('data-edit-cat-form');
            const newName = String(editForm.querySelector('input[name="newCatName"]').value || '').trim();
            if (!newName) return;

            if (newName === oldName) {
              editingCat = null;
              renderManager();
              return;
            }

            const st = getStore();
            const fin = ensureFinance(st);
            const list = fin.categories[activeType];
            const duplicate = list.some(c => c !== oldName && c.toLowerCase() === newName.toLowerCase());
            if (duplicate) {
              showToast('Ya existe otra categoría con ese nombre');
              return;
            }

            fin.categories[activeType] = sortCategories(list.map(c => (c === oldName ? newName : c)));
            st.transactions.forEach(tx => {
              if (tx.type === activeType && tx.category === oldName) {
                tx.category = newName;
              }
            });

            saveStore(st);
            editingCat = null;
            showToast('Categoría actualizada');
            renderManager();
          });
        }

        root.querySelectorAll('[data-del-cat]').forEach(btn => {
          btn.addEventListener('click', () => {
            const catName = btn.getAttribute('data-del-cat');
            const st = getStore();
            const fin = ensureFinance(st);
            if (fin.categories[activeType].length <= 1) {
              showToast('Debe quedar al menos una categoría');
              return;
            }
            if (!window.confirm(`¿Eliminar la categoría "${catName}"?`)) return;

            fin.categories[activeType] = fin.categories[activeType].filter(c => c !== catName);
            saveStore(st);
            showToast('Categoría eliminada');
            renderManager();
          });
        });

        root.querySelector('#btn-reset-cats').addEventListener('click', () => {
          const label = activeType === 'income' ? 'Ingresos' : 'Gastos';
          if (!window.confirm(`¿Restaurar las categorías predeterminadas de ${label}?`)) return;
          const st = getStore();
          const fin = ensureFinance(st);
          fin.categories[activeType] = sortCategories(DEFAULT_FINANCE_CATEGORIES[activeType]);
          saveStore(st);
          editingCat = null;
          showToast(`Categorías de ${label} restauradas`);
          renderManager();
        });

        root.querySelector('#btn-close-cats').addEventListener('click', finish);
      };

      const modalCloseBtn = modal.querySelector('#modal-close-btn');
      if (modalCloseBtn && typeof onDone === 'function') {
        modalCloseBtn.addEventListener('click', () => {
          onDone();
        });
      }

      renderManager();
    }
  });
}
