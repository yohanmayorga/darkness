import { getStore, saveStore, generateId, todayISO } from '../services/db.js?v=6.9.5';
import { icon } from '../components/icons.js?v=1.4.0';
import { openModal, closeModal } from '../components/modal.js?v=1.4.0';
import { showToast } from '../components/toast.js?v=1.4.0';
import { buildUnifiedCalendarHTML, bindUnifiedCalendar } from '../components/calendar.js?v=2.6.0';
import { formatDateDMY } from '../utils/text.js?v=4.3.0';
import { hudFrameOrnaments, asideCyberDecal } from '../components/hudFrame.js?v=1.1.1';
import { attachChartZoom, formatZoomLabel } from '../utils/chartZoom.js?v=1.0.0';

let txFilter = 'all';
let chartScope = 'month';
let dailyChartRange = 'all';
let dailyChartZoom = 1;
let activeOutsideTooltipHandler = null;
const calState = { year: null, month: null, selectedDate: '' };

const DAILY_RANGES = [
  { key: 7, label: '7D' },
  { key: 30, label: '30D' },
  { key: 90, label: '90D' },
  { key: 'all', label: 'Todo' }
];

function parseISODate(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

function toISODate(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDaysISO(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function formatDayWithWeekday(iso) {
  const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const d = parseISODate(iso);
  return `${names[d.getDay()]} ${formatDateDMY(iso)}`;
}

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

  // Datos para el gráfico de barras de gastos diarios (historial de movimientos)
  const validExpenseTxs = txs.filter(t => t.type === 'expense' && /^\d{4}-\d{2}-\d{2}$/.test(t.date || ''));
  const dailyMap = new Map();
  validExpenseTxs.forEach(t => {
    const entry = dailyMap.get(t.date) || { iso: t.date, total: 0, items: [] };
    const amt = Number(t.amount) || 0;
    entry.total += amt;
    entry.items.push({
      description: t.description || 'Sin descripción',
      category: t.category || 'Otro',
      amount: amt
    });
    dailyMap.set(t.date, entry);
  });
  dailyMap.forEach(entry => {
    entry.items.sort((a, b) => b.amount - a.amount);
  });

  const sortedExpenseDates = [...dailyMap.keys()].sort();
  let dailyEnd = today;
  if (sortedExpenseDates.length && sortedExpenseDates[sortedExpenseDates.length - 1] > dailyEnd) {
    dailyEnd = sortedExpenseDates[sortedExpenseDates.length - 1];
  }
  let dailyStart;
  if (dailyChartRange === 'all') {
    dailyStart = sortedExpenseDates.length ? sortedExpenseDates[0] : addDaysISO(today, -29);
    if (dailyStart > addDaysISO(dailyEnd, -6)) dailyStart = addDaysISO(dailyEnd, -6);
  } else {
    dailyStart = addDaysISO(today, -(dailyChartRange - 1));
    dailyEnd = today;
  }

  const dailySeries = [];
  for (let iso = dailyStart; iso <= dailyEnd; iso = addDaysISO(iso, 1)) {
    const found = dailyMap.get(iso);
    dailySeries.push(found || { iso, total: 0, items: [] });
  }
  const dailySeriesByIso = new Map(dailySeries.map(d => [d.iso, d]));
  const dailyPeriodTotal = dailySeries.reduce((acc, d) => acc + d.total, 0);
  const dailyMaxDay = dailySeries.reduce((best, d) => (!best || d.total > best.total ? d : best), null);
  const dailyMaxVal = dailyMaxDay ? dailyMaxDay.total : 0;
  const dailyAvgPerDay = dailySeries.length ? dailyPeriodTotal / dailySeries.length : 0;

  const dailyChartHTML = buildDailyExpensesChartHTML({
    series: dailySeries,
    periodTotal: dailyPeriodTotal,
    avgPerDay: dailyAvgPerDay,
    maxDay: dailyMaxDay,
    maxVal: dailyMaxVal,
    hasAnyExpense: validExpenseTxs.length > 0,
    currency
  });

  const periodExpenseTxs = validExpenseTxs.filter(t => t.date >= dailyStart && t.date <= dailyEnd);
  const cyberIntelHTML = buildFinanceCyberIntelHTML({
    txs: periodExpenseTxs.length ? periodExpenseTxs : validExpenseTxs,
    dailySeries,
    currency,
    rangeLabel: dailyChartRange === 'all' ? 'ALL' : `${dailyChartRange}D`
  });

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

    <section class="fin-visual-grid">
      <div class="card fin-cyber-intel-card cyber-frame-wrap">
        ${hudFrameOrnaments()}
        ${cyberIntelHTML}
      </div>

      <div class="card fin-daily-card cyber-frame-wrap">
        ${hudFrameOrnaments()}
        <div class="card-header" style="flex-wrap:wrap;gap:8px;">
          <h2 class="card-title">${icon('finance')} Gastos diarios</h2>
          <div class="fin-daily-controls">
            <div style="display:inline-flex;align-items:center;gap:2px;" role="group" aria-label="Zoom de la gráfica de gastos">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-fd-zoom-out" title="Alejar zoom">−</button>
              <button type="button" class="btn btn-secondary btn-sm mono" id="btn-fd-zoom-reset" title="Restablecer zoom">${formatZoomLabel(dailyChartZoom)}</button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-fd-zoom-in" title="Acercar zoom">+</button>
            </div>
            <div class="fin-range" role="group" aria-label="Rango del gráfico de gastos diarios">
              ${DAILY_RANGES.map(r => `
                <button type="button" class="fin-range-btn ${dailyChartRange === r.key ? 'active' : ''}" data-fin-daily-range="${r.key}">${r.label}</button>
              `).join('')}
            </div>
          </div>
        </div>
        ${dailyChartHTML}
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
            const avg = item.count > 0 ? item.amount / item.count : 0;
            return `
              <div class="finance-chart-row">
                <div class="finance-chart-meta">
                  <span class="finance-chart-cat">${escapeHtml(item.category)} <span class="text-muted">(${item.count})</span> <span class="finance-chart-avg mono">· Promedio: ${fmtMoney(avg, currency)}</span></span>
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
      ${asideCyberDecal({ code: 'SYS.06', label: 'CREDIT LEDGER', tag: 'FLOW // BAL' })}
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

  // Rango de gráfica diaria de gastos
  container.querySelectorAll('[data-fin-daily-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-fin-daily-range');
      dailyChartRange = val === 'all' ? 'all' : Number(val);
      renderFinance(container);
    });
  });

  // Zoom de gráfica diaria de gastos (botones, rueda y pellizco táctil)
  const updateDailyZoom = (restoreScroll) => {
    const plotEl = container.querySelector('.fin-daily-plot');
    const zoomBtn = container.querySelector('#btn-fd-zoom-reset');
    if (plotEl) {
      const basePx = Number(plotEl.dataset.baseWidth || 0);
      if (basePx > 0) {
        plotEl.style.width = `${dailyChartZoom * 100}%`;
        plotEl.style.minWidth = `${Math.round(basePx * dailyChartZoom)}px`;
      } else {
        plotEl.style.width = `${dailyChartZoom * 100}%`;
      }
    }
    if (zoomBtn) zoomBtn.textContent = formatZoomLabel(dailyChartZoom);
    if (typeof restoreScroll === 'function') restoreScroll();
  };

  container.querySelector('#btn-fd-zoom-in')?.addEventListener('click', () => {
    dailyChartZoom = Math.min(6, Number((dailyChartZoom + 0.5).toFixed(2)));
    updateDailyZoom();
  });
  container.querySelector('#btn-fd-zoom-out')?.addEventListener('click', () => {
    dailyChartZoom = Math.max(1, Number((dailyChartZoom - 0.5).toFixed(2)));
    updateDailyZoom();
  });
  container.querySelector('#btn-fd-zoom-reset')?.addEventListener('click', () => {
    dailyChartZoom = 1;
    updateDailyZoom();
  });

  attachChartZoom(container.querySelector('#fin-daily-scroll'), {
    getZoom: () => dailyChartZoom,
    setZoom: (z) => { dailyChartZoom = z; },
    minZoom: 1,
    maxZoom: 6,
    step: 0.25,
    onZoomChange: (_nextZoom, restoreScroll) => updateDailyZoom(restoreScroll)
  });

  // Tooltip interactivo (mouse y táctil) de gastos diarios
  bindDailyExpensesChart(container, dailySeriesByIso, currency);

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

function fmtBarLabel(amount, currency) {
  const num = Math.round(Number(amount) || 0);
  const sym = currency === 'USD' ? '$' : '';
  if (num >= 10000) return `${sym}${(num / 1000).toFixed(1)}k`;
  return `${sym}${num.toLocaleString('en-US')}`;
}

/**
 * Panel Cyberpunk de Inteligencia Financiera (1/4 derecho):
 * Radar heptagonal por día de semana + vectores de mayor fuga + patrón detectado
 */
function buildFinanceCyberIntelHTML({ txs, dailySeries, currency, rangeLabel }) {
  const header = `
    <div class="card-header">
      <h2 class="card-title">${icon('finance')} Radar de Fugas</h2>
      <span class="cyber-tag">SCAN.${rangeLabel}</span>
    </div>
  `;

  if (!txs.length) {
    return `
      ${header}
      <div class="fin-cyber-stage is-empty">
        <div class="fin-cyber-empty mono">SIN TELEMETRÍA DE GASTOS</div>
      </div>
    `;
  }

  const WEEKDAYS = [
    { dow: 1, short: 'L', name: 'Lunes' },
    { dow: 2, short: 'M', name: 'Martes' },
    { dow: 3, short: 'X', name: 'Miércoles' },
    { dow: 4, short: 'J', name: 'Jueves' },
    { dow: 5, short: 'V', name: 'Viernes' },
    { dow: 6, short: 'S', name: 'Sábado' },
    { dow: 0, short: 'D', name: 'Domingo' }
  ];

  // 1. Gasto acumulado por día de la semana
  const dowTotals = new Map(WEEKDAYS.map(w => [w.dow, 0]));
  const dowCounts = new Map(WEEKDAYS.map(w => [w.dow, 0]));
  const catTotals = new Map();
  let totalSpent = 0;

  txs.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (amt <= 0) return;
    totalSpent += amt;
    const dow = parseISODate(t.date).getDay();
    dowTotals.set(dow, (dowTotals.get(dow) || 0) + amt);
    dowCounts.set(dow, (dowCounts.get(dow) || 0) + 1);
    const cat = t.category || 'Otro';
    catTotals.set(cat, (catTotals.get(cat) || 0) + amt);
  });

  const maxDowVal = Math.max(...WEEKDAYS.map(w => dowTotals.get(w.dow) || 0), 1);
  let peakDay = WEEKDAYS[0];
  WEEKDAYS.forEach(w => {
    if ((dowTotals.get(w.dow) || 0) > (dowTotals.get(peakDay.dow) || 0)) {
      peakDay = w;
    }
  });
  const peakVal = dowTotals.get(peakDay.dow) || 0;

  // 2. Top 3 categorías que más drenan el dinero
  const topDrains = [...catTotals.entries()]
    .map(([cat, amount]) => ({
      cat,
      amount,
      pct: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // 3. Patrón conductual detectado
  const wkndTotal = (dowTotals.get(5) || 0) + (dowTotals.get(6) || 0) + (dowTotals.get(0) || 0);
  const wkndPct = totalSpent > 0 ? Math.round((wkndTotal / totalSpent) * 100) : 0;
  const zeroDays = (dailySeries || []).filter(d => d.total === 0).length;
  const totalDays = (dailySeries || []).length || 1;
  const zeroPct = Math.round((zeroDays / totalDays) * 100);

  let patternTag = 'PATRÓN';
  let patternText = `Pico los ${peakDay.name} (${fmtBarLabel(peakVal, currency)})`;
  if (wkndPct >= 52) {
    patternTag = 'FINDE';
    patternText = `${wkndPct}% de tu gasto ocurre Vie–Dom`;
  } else if (topDrains[0] && topDrains[0].pct >= 40) {
    patternTag = 'FUGA #1';
    patternText = `${topDrains[0].cat} absorbe ${topDrains[0].pct}%`;
  } else if (zeroPct >= 45) {
    patternTag = 'CONTROL';
    patternText = `${zeroDays} días sin gasto (${zeroPct}%)`;
  }

  // 4. Geometría SVG del Radar Heptagonal (7 vértices = L..D)
  const cx = 130;
  const cy = 104;
  const maxR = 66;
  const ringRadii = [22, 44, maxR];

  const vertexPoint = (idx, r) => {
    const a = -Math.PI / 2 + (idx * 2 * Math.PI) / 7;
    return {
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a)
    };
  };

  const heptagonPath = (r) =>
    WEEKDAYS.map((_, idx) => {
      const p = vertexPoint(idx, r);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ');

  const dataCoords = WEEKDAYS.map((w, idx) => {
    const val = dowTotals.get(w.dow) || 0;
    const r = val > 0 ? Math.max(11, (val / maxDowVal) * maxR) : 6;
    const p = vertexPoint(idx, r);
    const lbl = vertexPoint(idx, maxR + 15);
    return {
      ...w,
      val,
      count: dowCounts.get(w.dow) || 0,
      isPeak: w.dow === peakDay.dow && val > 0,
      x: p.x,
      y: p.y,
      lx: lbl.x,
      ly: lbl.y
    };
  });

  const dataPoly = dataCoords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  return `
    ${header}
    <div class="fin-cyber-stage">
      <div class="fin-cyber-scanline" aria-hidden="true"></div>
      <svg class="fin-radar-svg" viewBox="0 0 260 206" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Radar de gasto por día de la semana. Día pico: ${peakDay.name}">
        <defs>
          <filter id="fin-radar-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="fin-radar-area" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stop-color="var(--status-danger)" stop-opacity="0.42" />
            <stop offset="100%" stop-color="var(--status-danger)" stop-opacity="0.10" />
          </radialGradient>
          <linearGradient id="fin-sweep-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--cyber-yellow)" stop-opacity="0.28" />
            <stop offset="100%" stop-color="var(--cyber-yellow)" stop-opacity="0" />
          </linearGradient>
        </defs>

        <!-- Telemetría superior -->
        <text x="6" y="12" class="fin-radar-micro">DRAIN // MATRIX</text>
        <g>
          <circle cx="250" cy="9" r="2.6" fill="var(--status-danger)" class="fin-radar-led" />
          <text x="243" y="12" text-anchor="end" class="fin-radar-micro">PICO: ${peakDay.name.slice(0, 3).toUpperCase()}</text>
        </g>

        <!-- Anillos heptagonales concéntricos -->
        ${ringRadii.map((r, i) => `
          <polygon
            points="${heptagonPath(r)}"
            fill="none"
            stroke="${i === 2 ? 'var(--hud-border-strong)' : 'var(--hud-border-subtle)'}"
            stroke-width="${i === 2 ? '1' : '0.8'}"
            ${i === 1 ? 'stroke-dasharray="3 3"' : ''}
          />
        `).join('')}

        <!-- Radios hacia cada día de la semana -->
        ${WEEKDAYS.map((_, idx) => {
          const p = vertexPoint(idx, maxR);
          return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="var(--hud-border-subtle)" stroke-width="0.8" />`;
        }).join('')}

        <!-- Haz de radar giratorio -->
        <g class="fin-radar-sweep">
          <path d="M ${cx} ${cy} L ${cx} ${cy - maxR} A ${maxR} ${maxR} 0 0 1 ${(cx + maxR * 0.65).toFixed(1)} ${(cy - maxR * 0.76).toFixed(1)} Z" fill="url(#fin-sweep-grad)" />
          <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - maxR}" stroke="var(--cyber-yellow)" stroke-width="1" opacity="0.65" />
        </g>

        <!-- Polígono de energía de gasto semanal -->
        <polygon points="${dataPoly}" fill="url(#fin-radar-area)" stroke="var(--status-danger)" stroke-width="1.6" stroke-linejoin="round" filter="url(#fin-radar-glow)" />

        <!-- Nodos por día y mira pulsante en el día pico -->
        ${dataCoords.map(c => `
          <g class="fin-radar-node${c.isPeak ? ' is-peak' : ''}">
            <title>${c.name}: ${fmtMoney(c.val, currency)} (${c.count} mov.)</title>
            ${c.isPeak ? `
              <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="7.5" fill="none" stroke="var(--status-danger)" stroke-width="1.1" class="fin-radar-target" />
            ` : ''}
            <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${c.isPeak ? '3.3' : '2.3'}" fill="${c.isPeak ? 'var(--status-danger)' : 'var(--hud-accent)'}" />
            <text x="${c.lx.toFixed(1)}" y="${(c.ly + 3).toFixed(1)}" text-anchor="middle" class="fin-radar-day${c.isPeak ? ' is-peak' : ''}">${c.short}</text>
          </g>
        `).join('')}

        <!-- Núcleo central -->
        <circle cx="${cx}" cy="${cy}" r="2.2" fill="var(--hud-text-muted)" />
      </svg>

      <!-- Top 3 categorías que drenan más dinero -->
      <div class="fin-drain-block">
        <div class="fin-drain-head mono">
          <span>TOP FUGAS</span>
          <span>${fmtBarLabel(totalSpent, currency)}</span>
        </div>
        <div class="fin-drain-list">
          ${topDrains.map((d, idx) => {
            const lvl = idx === 0 ? 'is-crit' : idx === 1 ? 'is-warn' : 'is-base';
            return `
              <div class="fin-drain-row ${lvl}" title="${escapeHtml(d.cat)}: ${fmtMoney(d.amount, currency)} (${d.pct}%)">
                <div class="fin-drain-meta">
                  <span class="fin-drain-cat">${escapeHtml(d.cat)}</span>
                  <span class="fin-drain-val mono">${d.pct}% · ${fmtBarLabel(d.amount, currency)}</span>
                </div>
                <div class="fin-drain-track">
                  <span class="fin-drain-fill" style="width:${Math.max(d.pct, 6)}%;"></span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Patrón conductual detectado -->
      <div class="fin-pattern-footer">
        <span class="fin-pattern-pill mono">${patternTag}</span>
        <span class="fin-pattern-text">${escapeHtml(patternText)}</span>
      </div>
    </div>
  `;
}

function buildDailyExpensesChartHTML({ series, periodTotal, avgPerDay, maxDay, maxVal, hasAnyExpense, currency }) {
  if (!hasAnyExpense) {
    return `<div class="empty-state">Registra gastos en el historial de movimientos para ver tu evolución día a día.</div>`;
  }
  if (!series.length || maxVal <= 0) {
    return `<div class="empty-state">No hay gastos registrados en este rango.</div>`;
  }

  const W = 1000;
  const H = 200;
  const TOP_PAD = 24;
  const plotH = H - TOP_PAD;
  const n = series.length;
  const slot = W / n;
  const barW = Math.max(Math.min(slot * 0.64, 44), 4);
  const baseMinPx = n > 18 ? n * 38 : 0;
  const plotStyle = baseMinPx > 0
    ? `width:${dailyChartZoom * 100}%;min-width:${Math.round(baseMinPx * dailyChartZoom)}px;`
    : `width:${dailyChartZoom * 100}%;min-width:100%;`;

  // Media móvil de 7 días
  const avgPoints = [];
  series.forEach((d, i) => {
    const win = series.slice(Math.max(0, i - 6), i + 1);
    const avg = win.reduce((acc, x) => acc + x.total, 0) / win.length;
    const cx = (i * slot + slot / 2).toFixed(2);
    const cy = (H - (avg / maxVal) * plotH).toFixed(2);
    avgPoints.push(`${cx},${cy}`);
  });

  const valueLabels = [];
  const bars = series.map((d, i) => {
    const x = (i * slot + (slot - barW) / 2).toFixed(2);
    const hitX = (i * slot).toFixed(2);
    let bar = '';
    if (d.total > 0) {
      const ratio = d.total / maxVal;
      const h = Math.max(ratio * plotH, 5);
      const y = H - h;
      const lvl = ratio >= 0.7 ? 'is-high' : ratio >= 0.35 ? 'is-mid' : 'is-low';
      bar = `
        <rect class="fin-dbar ${lvl}" data-fin-bar="${d.iso}" x="${x}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" rx="2"/>
        <rect class="fin-dbar-cap ${lvl}" data-fin-cap="${d.iso}" x="${x}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="2"/>
      `;
      const leftPct = (((i + 0.5) / n) * 100).toFixed(4);
      const bottomPct = ((h / H) * 100).toFixed(2);
      valueLabels.push(
        `<span class="fin-dbar-val mono" data-fin-val="${d.iso}" style="left:${leftPct}%;bottom:${bottomPct}%;">${fmtBarLabel(d.total, currency)}</span>`
      );
    } else {
      bar = `<rect class="fin-dbar-zero" data-fin-bar="${d.iso}" x="${x}" y="${H - 2}" width="${barW.toFixed(2)}" height="2" rx="1"/>`;
    }
    return `${bar}<rect class="fin-dhit" x="${hitX}" y="0" width="${slot.toFixed(2)}" height="${H}" data-fin-day="${d.iso}"/>`;
  }).join('');

  const mid = series[Math.floor((n - 1) / 2)];
  const xLabels = n > 1
    ? `<span>${formatDateDMY(series[0].iso)}</span>${n > 6 ? `<span>${formatDateDMY(mid.iso)}</span>` : ''}<span>${formatDateDMY(series[n - 1].iso)}</span>`
    : `<span>${formatDateDMY(series[0].iso)}</span>`;

  const daysWithSpend = series.filter(d => d.total > 0).length;

  return `
    <div class="fin-daily-summary">
      <div class="fin-daily-headline">
        <span class="fin-daily-total-val mono">${fmtMoney(periodTotal, currency)}</span>
        <span class="text-muted">gastado en el período · <span class="mono">${daysWithSpend}/${n}</span> días con gasto · prom. <span class="mono">${fmtMoney(avgPerDay, currency)}/d</span>${maxDay && maxDay.total > 0 ? ` · pico <span class="mono">${formatDateDMY(maxDay.iso)} (${fmtMoney(maxDay.total, currency)})</span>` : ''}</span>
      </div>
    </div>
    <div class="fin-daily-stage" id="fin-daily-stage">
      <div class="fin-daily-wrap">
        <div class="fin-daily-yaxis mono" aria-hidden="true">
          <span>${fmtMoney(maxVal, currency)}</span>
          <span>${fmtMoney(maxVal / 2, currency)}</span>
          <span>0</span>
        </div>
        <div class="fin-daily-scroll" id="fin-daily-scroll">
          <div class="fin-daily-plot" data-base-width="${baseMinPx}" style="${plotStyle}">
            <div class="fin-daily-canvas">
              <svg class="fin-daily-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Gastos diarios del historial">
                <defs>
                  <linearGradient id="fin-grad-low" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stop-color="var(--accent-subtle)" />
                    <stop offset="100%" stop-color="var(--accent-primary)" />
                  </linearGradient>
                  <linearGradient id="fin-grad-mid" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stop-color="var(--cyber-yellow-border)" />
                    <stop offset="100%" stop-color="var(--cyber-yellow)" />
                  </linearGradient>
                  <linearGradient id="fin-grad-high" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stop-color="var(--status-danger-bg)" />
                    <stop offset="100%" stop-color="var(--status-danger)" />
                  </linearGradient>
                </defs>
                <line class="fin-dgrid" x1="0" y1="${TOP_PAD}" x2="${W}" y2="${TOP_PAD}"/>
                <line class="fin-dgrid" x1="0" y1="${TOP_PAD + plotH / 2}" x2="${W}" y2="${TOP_PAD + plotH / 2}"/>
                <line class="fin-dgrid" x1="0" y1="${H - 0.5}" x2="${W}" y2="${H - 0.5}"/>
                ${bars}
                ${avgPoints.length > 1 ? `<polyline class="fin-dline" points="${avgPoints.join(' ')}"/>` : ''}
              </svg>
              <div class="fin-daily-overlay" aria-hidden="true">${valueLabels.join('')}</div>
            </div>
            <div class="fin-daily-xaxis mono">${xLabels}</div>
          </div>
        </div>
      </div>
      <div class="fin-daily-tooltip" id="fin-daily-tooltip" role="tooltip" hidden></div>
    </div>
    <div class="fin-daily-legend">
      <span><i class="fin-key-low"></i>Gasto moderado</span>
      <span><i class="fin-key-mid"></i>Gasto medio</span>
      <span><i class="fin-key-high"></i>Pico de gasto</span>
      <span><i class="fin-key-line"></i>Media móvil 7 días</span>
      <span class="fin-daily-legend-hint">Pasa el cursor o toca una barra para ver el detalle</span>
    </div>
  `;
}

function bindDailyExpensesChart(container, dailySeriesByIso, currency) {
  if (activeOutsideTooltipHandler) {
    document.removeEventListener('click', activeOutsideTooltipHandler);
    activeOutsideTooltipHandler = null;
  }

  const stage = container.querySelector('#fin-daily-stage');
  const tooltip = container.querySelector('#fin-daily-tooltip');
  const scrollWrap = container.querySelector('#fin-daily-scroll');
  if (!stage || !tooltip) return;

  let pinnedIso = null;
  let activeIso = null;

  const clearActiveBar = () => {
    stage.querySelectorAll('.fin-dbar.is-active, .fin-dbar-zero.is-active, .fin-dhit.is-active, .fin-dbar-val.is-active').forEach(el => {
      el.classList.remove('is-active');
    });
  };

  const hideTooltip = () => {
    tooltip.hidden = true;
    activeIso = null;
    pinnedIso = null;
    clearActiveBar();
  };

  const renderTooltipContent = (day) => {
    const maxItems = 6;
    const shown = day.items.slice(0, maxItems);
    const remaining = day.items.length - shown.length;
    return `
      <div class="fin-tt-head">
        <span class="fin-tt-date mono">${escapeHtml(formatDayWithWeekday(day.iso))}</span>
        <span class="fin-tt-total mono ${day.total > 0 ? 'text-danger' : 'text-muted'}">${day.total > 0 ? `-${fmtMoney(day.total, currency)}` : fmtMoney(0, currency)}</span>
      </div>
      ${shown.length === 0 ? `
        <div class="fin-tt-empty">Sin gastos registrados este día.</div>
      ` : `
        <div class="fin-tt-list">
          ${shown.map(item => `
            <div class="fin-tt-item">
              <div class="fin-tt-item-main">
                <span class="fin-tt-desc">${escapeHtml(item.description)}</span>
                <span class="fin-tt-cat">${escapeHtml(item.category)}</span>
              </div>
              <span class="fin-tt-amt mono">${fmtMoney(item.amount, currency)}</span>
            </div>
          `).join('')}
          ${remaining > 0 ? `<div class="fin-tt-more mono">+${remaining} gasto${remaining === 1 ? '' : 's'} más</div>` : ''}
        </div>
      `}
    `;
  };

  const showTooltip = (hitEl, iso) => {
    const day = dailySeriesByIso.get(iso);
    if (!day) return;

    clearActiveBar();
    activeIso = iso;
    hitEl.classList.add('is-active');
    const barEl = stage.querySelector(`[data-fin-bar="${iso}"]`);
    if (barEl) barEl.classList.add('is-active');
    const valEl = stage.querySelector(`[data-fin-val="${iso}"]`);
    if (valEl) valEl.classList.add('is-active');

    tooltip.innerHTML = renderTooltipContent(day);
    tooltip.hidden = false;

    const stageRect = stage.getBoundingClientRect();
    const hitRect = hitEl.getBoundingClientRect();
    const ttRect = tooltip.getBoundingClientRect();

    const centerX = (hitRect.left - stageRect.left) + (hitRect.width / 2);
    let left = centerX - (ttRect.width / 2);
    left = Math.max(6, Math.min(left, stageRect.width - ttRect.width - 6));

    // Colocar arriba de la barra o en la zona superior del stage sin salirse
    let top = 6;
    if (barEl && day.total > 0) {
      const barRect = barEl.getBoundingClientRect();
      const barTopRel = barRect.top - stageRect.top;
      if (barTopRel - ttRect.height - 10 >= 0) {
        top = barTopRel - ttRect.height - 10;
      } else {
        top = 6;
      }
    }

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  };

  stage.querySelectorAll('.fin-dhit[data-fin-day]').forEach(hit => {
    const iso = hit.getAttribute('data-fin-day');

    hit.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch' || pinnedIso) return;
      showTooltip(hit, iso);
    });

    hit.addEventListener('click', (e) => {
      e.stopPropagation();
      if (pinnedIso === iso) {
        hideTooltip();
      } else {
        pinnedIso = iso;
        showTooltip(hit, iso);
      }
    });
  });

  stage.addEventListener('mouseleave', () => {
    if (!pinnedIso && activeIso) hideTooltip();
  });

  if (scrollWrap) {
    // Mostrar los días más recientes al final del scroll cuando el rango es ancho
    requestAnimationFrame(() => {
      if (scrollWrap.scrollWidth > scrollWrap.clientWidth) {
        scrollWrap.scrollLeft = scrollWrap.scrollWidth;
      }
    });
    scrollWrap.addEventListener('scroll', () => {
      if (!tooltip.hidden) hideTooltip();
    }, { passive: true });
  }

  activeOutsideTooltipHandler = (e) => {
    if (!stage.contains(e.target) && !tooltip.hidden) {
      hideTooltip();
    }
  };
  document.addEventListener('click', activeOutsideTooltipHandler);
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
