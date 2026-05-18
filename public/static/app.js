const NAV_PAGES = [
  { key: 'import', label: '1. データ取込' },
  { key: 'summary', label: '2. 全体サマリー（月次レポート）' },
  { key: 'trend', label: '3. 推移（前年差／トレンド）' },
  { key: 'category', label: '4. カテゴリ別分析' },
  { key: 'project', label: '5. プロジェクト別（新規案件）' },
  { key: 'alert', label: '6. アラート（乖離・変動）' },
  { key: 'vendor', label: '7. ベンダー／契約更新' },
  { key: 'detail', label: '8. 明細（検索・ドリルダウン）' },
  { key: 'settings', label: '9. 表示設定' },
  { key: 'manual', label: '10. 取扱説明書（マニュアル）' },
];

const IMPORT_FILE_TYPE_OPTIONS = [
  { value: 'budget', label: '予実績管理データ' },
  { value: 'variance_reason', label: '差額理由' },
  { value: 'new_project', label: '新規案件' },
  { value: 'oasis_actual', label: 'OASIS実績' },
  { value: 'depreciation_simulation', label: '減価償却シミュレーション' },
];

const ADDITIONAL_FILE_TYPES = IMPORT_FILE_TYPE_OPTIONS.filter(t => t.value !== 'budget').map(t => t.value);
const NOT_IMPORTED_MESSAGE = '追加データ未取込';

const state = {
  page: 'import',
  hasData: false,
  data: { status: null, items: [], contracts: [] },
  filters: { periodMode: '月次', department: '', perspective: '費目', target: 'すべて', fiscalPeriod: '', targetYearMonth: '' },
  settings: {
    thresholds: { varianceRate: 10, amountGap: 1000, momRate: 10, yoyRate: 10 },
    kpiOrder: ['総予算', '見込み／実績', '予算消化率', '差額', '着地見込み', 'コスト削減効果'],
  },
  ui: {
    theme: localStorage.getItem('theme') || 'light',
    categoryTab: 'システム分類名別',
    trendMonths: 12,
    trendMetric: '総額',
    detailSearch: '',
    extraDetailCols: ['owner_name', 'vendor_name', 'budget_category', 'totalForecast'],
    importFileType: 'budget',
  },
};

const fmt = (n) => Number(n || 0).toLocaleString('ja-JP');
const pct = (n) => `${(Number(n || 0)).toFixed(1)}%`;
const yen = (n) => `${fmt(Math.round(Number(n || 0)))} 千円`;
const isNewProject = (r) => /新規|new/i.test(r.project_name || '');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[ch]));
const displayText = (value) => {
  const text = String(value ?? '').trim();
  return text ? text : '未入力';
};
const displayHtml = (value) => escapeHtml(displayText(value));
const optionHtml = (value, selectedValue) => {
  const safe = escapeHtml(value);
  return `<option value="${safe}" ${value === selectedValue ? 'selected' : ''}>${safe}</option>`;
};
const dataAttr = (value) => escapeHtml(value);
const displayOrUnentered = (value) => {
  const text = String(value ?? '').trim();
  return text ? escapeHtml(text) : '未入力';
};
const formatYearMonth = (ym) => {
  const s = String(ym || '').trim();
  return /^\d{6}$/.test(s) ? `${s.slice(0, 4)}/${s.slice(4, 6)}` : (s || '-');
};
const firstPresent = (...values) => values.find(value => value !== undefined && value !== null && String(value).trim() !== '');

const DETAIL_FILTER_LABELS = {
  management_no: '管理番号',
  category: 'カテゴリ',
  department: '部門',
  vendor: 'ベンダー',
  contract_no: '契約番号',
};

function setDetailFilter(type, value) {
  state.ui.detailFilter = value ? { type, value } : null;
  state.ui.detailSearch = '';
}

function detailFilterLabel(filter = state.ui.detailFilter) {
  if (!filter) return '';
  return `${DETAIL_FILTER_LABELS[filter.type] || filter.type}: ${filter.value}`;
}

function itemMatchesDetailFilter(item, filter = state.ui.detailFilter) {
  if (!filter || !filter.value) return true;
  const value = String(filter.value);
  if (filter.type === 'management_no') return String(item.management_no || '') === value;
  if (filter.type === 'department') return String(item.department_name || '') === value;
  if (filter.type === 'vendor') return String(item.vendor_name || item.payee_name || '') === value;
  if (filter.type === 'contract_no') return String(item.contract_no || '') === value;
  if (filter.type === 'category') {
    return [
      item.budget_category,
      item.system_classification,
      item.expense_classification,
      item.expense_item_name,
      item.fixed_variable_type,
      item.payment_category,
      item.system_name,
    ].some(v => String(v || '') === value);
  }
  return true;
}

function bindDetailFilterLinks(scope = document) {
  scope.querySelectorAll('[data-filter-type][data-filter-value]').forEach(el => {
    el.onclick = () => {
      setDetailFilter(el.dataset.filterType, el.dataset.filterValue);
      goPage('detail');
    };
  });
}

function bindManagementNoDrilldowns(scope = document) {
  scope.querySelectorAll('[data-mid]').forEach((el) => {
    el.onclick = (event) => {
      event.stopPropagation();
      setDetailFilter('management_no', el.dataset.mid);
      goPage('detail');
    };
  });
}

const displayContractDate = (value, status) => {
  if (!value || status === 'blank') return '要確認';
  if (status === 'invalid') return `要確認（${value}）`;
  return value;
};
const displayContractValue = (value) => value === null || value === undefined || value === '' ? '-' : value;
const escapedContractValueForHtml = (value) => escapeHtml(value || '-');
const monthlyCommentHtml = (m = {}, item = {}) => displayOrUnentered(firstPresent(m.comment, item.comment));

const DETAIL_COLUMN_LABELS = {
  management_no: '管理番号',
  item_no: '項番',
  project_name: '案件名',
  department_name: '部門名',
  system_name: 'システム名',
  owner_name: '担当者名',
  vendor_name: 'ベンダー名',
  payee_name: '支払先名',
  budget_category: '予算カテゴリ',
  fixed_variable_type: '固定費・変動費',
  payment_category: '投資・運用区分',
  totalPlan: '計画合計',
  totalForecast: '見込み合計',
  totalActual: '実績合計',
  variance_reason_category: '差額理由分類',
  variance_reason: '差額理由',
  comment: 'コメント',
  comment_updated_month: 'コメント更新月',
  comment_updated_by: 'コメント更新者',
  fiscal_period: '対象期',
  fiscal_year: '会計年度',
  system_classification: 'システム分類名',
  expense_classification: '経費区分',
  expense_item_name: '経費事象名',
  contract_no: '契約番号',
};

const detailColumnLabel = (key) => DETAIL_COLUMN_LABELS[key] || key;
const jsonForHtml = (value) => escapeHtml(JSON.stringify(value ?? {}, null, 2));

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const chartAnimationDuration = () => reduceMotion() ? 0 : 900;
const animatedValueHtml = (value, formatter = 'yen', className = '') => {
  const formatters = { yen, pct, fmt };
  const display = (formatters[formatter] || yen)(value);
  return `<span class="animated-number ${className}" data-animate-value="${dataAttr(Number(value || 0))}" data-animate-format="${dataAttr(formatter)}">${escapeHtml(display)}</span>`;
};

function animateNumericValues(root = document, duration = chartAnimationDuration()) {
  const formatters = { yen, pct, fmt };
  root.querySelectorAll('[data-animate-value]').forEach((el) => {
    const target = Number(el.dataset.animateValue || 0);
    const formatter = formatters[el.dataset.animateFormat] || yen;
    if (!duration) {
      el.textContent = formatter(target);
      return;
    }
    const start = 0;
    if (typeof requestAnimationFrame !== 'function' || typeof performance === 'undefined') {
      el.textContent = formatter(target);
      return;
    }
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatter(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function baseChartOptions(extra = {}) {
  const duration = chartAnimationDuration();
  return {
    animation: {
      duration,
      easing: 'easeOutQuart',
    },
    transitions: {
      active: { animation: { duration: Math.round(duration / 2) } },
      resize: { animation: { duration: Math.round(duration / 2) } },
    },
    ...extra,
  };
}

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `API Error ${res.status}`);
  return json;
}

function withViewTransition(update) {
  if (document.startViewTransition) {
    document.startViewTransition(update);
  } else {
    update();
  }
}

function toggleTheme() {
  withViewTransition(() => {
    const order = ['light', 'dark', 'neon'];
    const idx = order.indexOf(state.ui.theme);
    state.ui.theme = order[(idx + 1) % order.length];
    applyTheme();
    renderPage();
  });
}

function applyTheme() {
  document.body.dataset.theme = state.ui.theme;
  localStorage.setItem('theme', state.ui.theme);
  const themeLabel = { light: '☀️ ライト', dark: '🌙 ダーク', neon: '🌈 ネオン' };
  document.getElementById('themeToggle').textContent = `${themeLabel[state.ui.theme]}（切替）`;
  const sel = document.getElementById('themeSelect');
  if (sel) sel.value = state.ui.theme;
}

function ymToQuarter(ym) {
  const s = String(ym || '');
  if (s.length !== 6) return '不明';
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const q = Math.floor((m - 1) / 3) + 1;
  return `${y}Q${q}`;
}

function periodSortValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : String(value || '');
}

function getPeriodOptions() {
  const st = state.data.status || {};
  const periods = Array.isArray(st.periods) ? st.periods : [];
  if (periods.length) return [...periods].filter(Boolean).sort((a, b) => String(periodSortValue(a)).localeCompare(String(periodSortValue(b)), 'ja', { numeric: true }));
  return [...new Set(state.data.items.map(r => r.fiscal_period).filter(Boolean))].sort((a, b) => String(periodSortValue(a)).localeCompare(String(periodSortValue(b)), 'ja', { numeric: true }));
}

function getYearMonthOptions() {
  const period = state.filters.fiscalPeriod;
  const scopedItems = period
    ? state.data.items.filter(r => String(r.fiscal_period || '') === String(period))
    : state.data.items;
  const scopedYMs = [...new Set(scopedItems.flatMap(r => Object.keys(r.monthly || {})).filter(Boolean))].sort();
  if (scopedYMs.length) return scopedYMs;
  const st = state.data.status || {};
  const yms = Array.isArray(st.sortedYMs) ? st.sortedYMs : [];
  return [...yms].filter(Boolean).sort();
}

function normalizeGlobalScopeFilters() {
  const periods = getPeriodOptions();
  const yms = getYearMonthOptions();
  if (!state.filters.fiscalPeriod || (periods.length && !periods.includes(state.filters.fiscalPeriod))) {
    state.filters.fiscalPeriod = periods[periods.length - 1] || '';
  }
  if (!state.filters.targetYearMonth || (yms.length && !yms.includes(state.filters.targetYearMonth))) {
    state.filters.targetYearMonth = yms[yms.length - 1] || '';
  }
}

function ymCompare(a, b) {
  return String(a || '').localeCompare(String(b || ''));
}

function selectedQuarterLabel() {
  return ymToQuarter(state.filters.targetYearMonth);
}

function ymInSelectedScope(ym, { includeHistory = false } = {}) {
  const selectedYM = state.filters.targetYearMonth;
  if (!selectedYM || state.filters.periodMode === '通期') return true;
  if (state.filters.periodMode === '月次') {
    return includeHistory ? ymCompare(ym, selectedYM) <= 0 : ym === selectedYM;
  }
  const selectedQuarter = selectedQuarterLabel();
  if (includeHistory) return ymToQuarter(ym) <= selectedQuarter;
  return ymToQuarter(ym) === selectedQuarter;
}

function scopedItemTotals(item) {
  let totalPlan = 0;
  let totalForecast = 0;
  let totalActual = 0;
  const monthlyEntries = Object.entries(item.monthly || {}).filter(([ym]) => ymInSelectedScope(ym));

  if (state.filters.periodMode === '通期' && monthlyEntries.length === 0) {
    return {
      totalPlan: Number(item.totalPlan || 0),
      totalForecast: Number(item.totalForecast || 0),
      totalActual: Number(item.totalActual || 0),
    };
  }

  monthlyEntries.forEach(([, m]) => {
    totalPlan += Number(m.plan || 0);
    totalForecast += Number(m.forecast || 0);
    totalActual += Number(m.actual || 0);
  });

  return { totalPlan, totalForecast, totalActual };
}

function hasSelectedMonthData(item) {
  if (!state.filters.targetYearMonth || state.filters.periodMode === '通期') return true;
  return Object.keys(item.monthly || {}).some(ym => ymInSelectedScope(ym));
}

function filterItemsByGlobalScope(sourceItems = state.data.items) {
  let rows = [...sourceItems];
  if (state.filters.department) rows = rows.filter(r => r.department_name === state.filters.department);
  if (state.filters.target === '新規案件') rows = rows.filter(isNewProject);
  if (state.filters.target === '継続案件') rows = rows.filter(r => !isNewProject(r));
  if ((state.filters.target || '').startsWith('ベンダー:')) {
    const v = state.filters.target.replace('ベンダー:', '');
    rows = rows.filter(r => (r.vendor_name || r.payee_name || '') === v);
  }
  if (state.filters.fiscalPeriod) rows = rows.filter(r => String(r.fiscal_period || '') === String(state.filters.fiscalPeriod));
  rows = rows.filter(hasSelectedMonthData);

  return rows.map((r) => {
    const scoped = scopedItemTotals(r);
    return {
      ...r,
      rawTotalPlan: Number(r.totalPlan || 0),
      rawTotalForecast: Number(r.totalForecast || 0),
      rawTotalActual: Number(r.totalActual || 0),
      totalPlan: scoped.totalPlan,
      totalForecast: scoped.totalForecast,
      totalActual: scoped.totalActual,
      scopedPlan: scoped.totalPlan,
      scopedForecast: scoped.totalForecast,
      scopedActual: scoped.totalActual,
    };
  });
}

function filteredItems() {
  return filterItemsByGlobalScope();
}

function getPerspectiveKey() {
  if (state.filters.perspective === '費目') return 'budget_category';
  if (state.filters.perspective === 'システム') return 'system_name';
  if (state.filters.perspective === '固定・変動') return 'fixed_variable_type';
  return 'payment_category';
}

function buildTimeSeries(items) {
  const bucket = {};
  const addBucket = (key, values) => {
    if (!bucket[key]) bucket[key] = { plan: 0, forecast: 0, actual: 0 };
    bucket[key].plan += Number(values.plan || 0);
    bucket[key].forecast += Number(values.forecast || 0);
    bucket[key].actual += Number(values.actual || 0);
  };

  items.forEach((item) => {
    if (state.filters.periodMode === '通期') {
      addBucket(item.fiscal_period_label || item.fiscal_period || state.filters.fiscalPeriod || '通期', {
        plan: item.totalPlan,
        forecast: item.totalForecast,
        actual: item.totalActual,
      });
      return;
    }

    Object.entries(item.monthly || {}).forEach(([ym, m]) => {
      if (!ymInSelectedScope(ym, { includeHistory: true })) return;
      const key = state.filters.periodMode === '月次' ? ym : ymToQuarter(ym);
      addBucket(key, m);
    });
  });

  const labels = Object.keys(bucket).sort();
  return { labels, bucket };
}


function deriveFiscalYearFromFiscalPeriod(fiscalPeriod, items = []) {
  const raw = String(fiscalPeriod ?? '').trim();
  const matched = items.find(item => raw && String(item.fiscal_period || '') === raw && item.fiscal_year);
  if (matched) return Number(matched.fiscal_year);

  const numeric = Number(raw.replace(/^FY/i, ''));
  if (Number.isFinite(numeric) && numeric > 0) {
    if (numeric >= 60 && numeric <= 99) return 1960 + numeric;
    return numeric;
  }

  const yearFromMonthly = items
    .flatMap(item => Object.keys(item.monthly || {}))
    .map(ym => Number(String(ym).slice(0, 4)))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)[0];
  return yearFromMonthly || new Date().getFullYear();
}

function buildFiscalYearMonths(fiscalYear) {
  const fy = deriveFiscalYearFromFiscalPeriod(fiscalYear);
  return Array.from({ length: 12 }, (_, idx) => {
    const month = idx + 4 <= 12 ? idx + 4 : idx - 8;
    const year = month >= 4 ? fy : fy + 1;
    const key = `${year}${String(month).padStart(2, '0')}`;
    return { key, label: `${year}/${String(month).padStart(2, '0')}` };
  });
}

function buildReportSeries(items, fiscalPeriod) {
  const fiscalYear = deriveFiscalYearFromFiscalPeriod(fiscalPeriod, items);
  const months = buildFiscalYearMonths(fiscalYear);
  const period = String(fiscalPeriod ?? '').trim();
  const rows = period
    ? items.filter(item => String(item.fiscal_period || '') === period || Number(item.fiscal_year) === fiscalYear)
    : items;
  let planCumulative = 0;
  let actualForecastCumulative = 0;

  const series = months.map((month) => {
    const totals = rows.reduce((acc, item) => {
      const monthly = item.monthly?.[month.key] || {};
      const actual = Number(monthly.actual || 0);
      const forecast = Number(monthly.forecast || 0);
      acc.plan += Number(monthly.plan || 0);
      acc.actualForecast += actual || forecast;
      return acc;
    }, { plan: 0, actualForecast: 0 });

    planCumulative += totals.plan;
    actualForecastCumulative += totals.actualForecast;
    return {
      key: month.key,
      label: month.label,
      plan: totals.plan,
      actualForecast: totals.actualForecast,
      planCumulative,
      actualForecastCumulative,
    };
  });

  return {
    fiscalPeriod: period,
    fiscalYear,
    labels: series.map(v => v.label),
    keys: series.map(v => v.key),
    plan: series.map(v => v.plan),
    actualForecast: series.map(v => v.actualForecast),
    planCumulative: series.map(v => v.planCumulative),
    actualForecastCumulative: series.map(v => v.actualForecastCumulative),
    rows: series,
  };
}

function getComparableActual(record = {}) {
  const actual = Number(record.actual ?? record.totalActual ?? 0);
  const forecast = Number(record.forecast ?? record.totalForecast ?? 0);
  return actual || forecast;
}

function calculateVariance(plan, comparable) {
  const amount = Number(plan || 0) - Number(comparable || 0);
  const rate = Number(plan || 0) ? amount / Number(plan || 0) * 100 : 0;
  return { amount, rate };
}

function calculateBurnRate(plan, comparable) {
  return Number(plan || 0) ? Number(comparable || 0) / Number(plan || 0) * 100 : 0;
}

function scopedPeriodSummary(items) {
  const ts = buildTimeSeries(items);
  const lastLabel = ts.labels[ts.labels.length - 1];
  const scopeAll = state.filters.periodMode === '通期' || !lastLabel;
  let totalPlan = 0;
  let totalForecast = 0;
  let totalActual = 0;
  let comparable = 0;

  items.forEach((item) => {
    if (scopeAll) {
      totalPlan += Number(item.totalPlan || 0);
      totalForecast += Number(item.totalForecast || 0);
      totalActual += Number(item.totalActual || 0);
      comparable += getComparableActual(item);
      return;
    }
    Object.entries(item.monthly || {}).forEach(([ym, m]) => {
      const key = state.filters.periodMode === '月次' ? ym : ymToQuarter(ym);
      if (key !== lastLabel) return;
      totalPlan += Number(m.plan || 0);
      totalForecast += Number(m.forecast || 0);
      totalActual += Number(m.actual || 0);
      comparable += getComparableActual(m);
    });
  });

  return {
    totalPlan,
    totalForecast,
    totalActual,
    comparable,
    label: lastLabel,
    labels: ts.labels,
    series: ts.labels.map(l => {
      const values = ts.bucket[l] || { plan: 0, forecast: 0, actual: 0 };
      return { ...values, comparable: getComparableActual(values) };
    }),
  };
}

function recomputeSummary(items) {
  const totalPlan = items.reduce((s, r) => s + Number(r.totalPlan || 0), 0);
  const totalForecast = items.reduce((s, r) => s + Number(r.totalForecast || 0), 0);
  const totalActual = items.reduce((s, r) => s + Number(r.totalActual || 0), 0);
  const diff = totalPlan - totalActual;
  const reduction = Math.max(diff, 0);
  const reductionRate = totalPlan ? reduction / totalPlan * 100 : 0;
  const ts = buildTimeSeries(items);

  return {
    totalPlan, totalForecast, totalActual, diff, reduction, reductionRate,
    labels: ts.labels,
    series: ts.labels.map(l => ts.bucket[l] || { plan: 0, forecast: 0, actual: 0 }),
  };
}

function initNav() {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = NAV_PAGES.map(p => `<button class="nav-item ${p.key === state.page ? 'active' : ''}" data-page="${dataAttr(p.key)}" ${!state.hasData && !['import', 'manual'].includes(p.key) ? 'disabled' : ''}>${escapeHtml(p.label)}</button>`).join('');
  nav.querySelectorAll('.nav-item').forEach(b => b.onclick = () => goPage(b.dataset.page));
}

function initFilterBar() {
  const st = state.data.status || {};
  const depts = st.departments || [];
  const vendors = (st.vendors || []).slice(0, 20);
  const periods = getPeriodOptions();
  normalizeGlobalScopeFilters();
  const yms = getYearMonthOptions();
  const targets = ['すべて', '継続案件', '新規案件', ...vendors.map(v => `ベンダー:${v}`)];
  const root = document.getElementById('globalFilters');
  root.innerHTML = `
    <label>表示単位 <select id="fPeriodMode">${['月次', '四半期', '通期'].map(v => optionHtml(v, state.filters.periodMode)).join('')}</select></label>
    <label>対象期 <select id="fFiscalPeriod">${periods.map(v => optionHtml(v, state.filters.fiscalPeriod)).join('')}</select></label>
    <label>対象月 <select id="fTargetYM">${yms.map(v => optionHtml(v, state.filters.targetYearMonth)).join('')}</select></label>
    <select id="fDept"><option value="">全部門</option>${depts.map(v => optionHtml(v, state.filters.department)).join('')}</select>
    <select id="fPers">${['費目', 'システム', '固定・変動', '投資・運用'].map(v => optionHtml(v, state.filters.perspective)).join('')}</select>
    <select id="fTarget">${targets.map(v => optionHtml(v, state.filters.target)).join('')}</select>
  `;
  ['fPeriodMode', 'fFiscalPeriod', 'fTargetYM', 'fDept', 'fPers', 'fTarget'].forEach((id) => {
    root.querySelector(`#${id}`).onchange = () => {
      state.filters.periodMode = root.querySelector('#fPeriodMode').value;
      state.filters.fiscalPeriod = root.querySelector('#fFiscalPeriod').value;
      state.filters.targetYearMonth = root.querySelector('#fTargetYM').value;
      state.filters.department = root.querySelector('#fDept').value;
      state.filters.perspective = root.querySelector('#fPers').value;
      state.filters.target = root.querySelector('#fTarget').value;
      normalizeGlobalScopeFilters();
      initFilterBar();
      renderPage();
    };
  });
}

function setStatus() {
  applyTheme();
  document.getElementById('statusBadge').textContent = state.hasData ? 'データ読込済' : 'データなし';
  document.getElementById('statusBadge').className = `status ${state.hasData ? 'ok' : ''}`;
  document.getElementById('sidebarMeta').innerHTML = state.hasData
    ? `${escapeHtml(state.data.status?.csvFileName || '')}<br>案件 ${fmt(state.data.status?.itemCount || 0)} 件`
    : '未取込';
}

async function refreshAllData() {
  const [status, itemsRes, contractsRes] = await Promise.all([
    api('/status'),
    api('/items'),
    api('/contracts').catch(() => ({ data: [] })),
  ]);
  state.hasData = !!status.hasData;
  state.data.status = status;
  state.data.items = itemsRes.items || [];
  state.data.contracts = contractsRes.data || [];
  initNav();
  initFilterBar();
  setStatus();
}

function goPage(page) {
  withViewTransition(() => {
    state.page = page;
    initNav();
    renderPage();
  });
}

function parseCsvPreviewRecords(text, delimiter = ',') {
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false;
  const normalized = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (ch === delimiter) {
      record.push(field);
      field = '';
      fieldStarted = false;
    } else if (ch === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      fieldStarted = false;
    } else {
      field += ch;
      fieldStarted = true;
    }
  }

  if (field.length || fieldStarted || record.length) {
    record.push(field);
    records.push(record);
  }
  return records;
}

function detectPreviewDelimiter(text) {
  const firstLine = String(text || '').split(/\r?\n/, 1)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
}

function additionalDataNoticeHtml() {
  const additionalData = state.data.status?.additionalData || {};
  const missing = ADDITIONAL_FILE_TYPES.filter((fileType) => (additionalData[fileType]?.status || 'not_imported') !== 'imported');
  if (!missing.length) return '';
  return `<div class="notice notice--empty">${escapeHtml(NOT_IMPORTED_MESSAGE)}：${missing.map((fileType) => {
    const option = IMPORT_FILE_TYPE_OPTIONS.find(t => t.value === fileType);
    return escapeHtml(option?.label || fileType);
  }).join(' / ')}</div>`;
}

function additionalStatusListHtml() {
  const additionalData = state.data.status?.additionalData || {};
  return `<div class="additional-status-grid">${ADDITIONAL_FILE_TYPES.map((fileType) => {
    const option = IMPORT_FILE_TYPE_OPTIONS.find(t => t.value === fileType);
    const st = additionalData[fileType] || { status: 'not_imported', message: NOT_IMPORTED_MESSAGE, rowCount: 0 };
    const imported = st.status === 'imported';
    return `<article class="mini-status ${imported ? 'mini-status--ok' : ''}"><strong>${escapeHtml(option?.label || fileType)}</strong><span>${escapeHtml(imported ? '取込済み' : NOT_IMPORTED_MESSAGE)}</span><small>${imported ? `${fmt(st.rowCount)}件 / ${escapeHtml(st.fileName || '')}` : escapeHtml(st.message || NOT_IMPORTED_MESSAGE)}</small></article>`;
  }).join('')}</div>`;
}

function csvClientChecks(text) {
  const records = parseCsvPreviewRecords(text, detectPreviewDelimiter(text));
  if (!records.length) return { errors: ['空ファイルです'], summary: null };
  const headers = records[0].map(s => s.trim());
  const hasId = headers.includes('管理番号') || headers.includes('管理番号（統合）');
  const hasItem = headers.includes('項番');
  const monthCols = headers.filter(h => /期\d{1,2}月(計画|見込)$/.test(h));
  const rows = records.slice(1).filter(r => r.some(v => String(v || '').trim()));
  const errors = [];
  if (!hasId) errors.push('必須列不足: 管理番号/管理番号（統合）');
  if (!hasItem) errors.push('必須列不足: 項番');
  if (!monthCols.length) errors.push('期間列が見つかりません');
  const invalidNumeric = rows.filter(r => monthCols.slice(0, 8).some(c => {
    const v = (r[headers.indexOf(c)] || '').trim();
    return v && isNaN(Number(String(v).replace(/,/g, '')));
  })).length;
  return {
    errors,
    summary: {
      count: rows.length,
      periodRange: monthCols.length ? `${monthCols[0]} 〜 ${monthCols[monthCols.length - 1]}` : '-',
      missingHeavy: `${rows.filter(r => monthCols.some(c => !(r[headers.indexOf(c)] || '').trim())).length} 行で期間列空欄`,
      invalidNumeric,
    }
  };
}

function drawLine(canvasId, labels, datasets) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  new Chart(el, { type: 'line', data: { labels, datasets }, options: baseChartOptions({ maintainAspectRatio: false, responsive: true, plugins: { legend: { labels: { color: 'var(--text)' } } }, scales: { x: { ticks: { color: 'var(--text)' }, grid: { color: 'var(--line)' } }, y: { ticks: { color: 'var(--text)' }, grid: { color: 'var(--line)' } } } }) });
}


function drawReportComboChart(canvasId, reportSeries) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const gray = '#D7DCE2';
  const grayLine = '#B9C0CA';
  const blue = '#2F80ED';
  const monthlyMax = Math.max(...reportSeries.plan, ...reportSeries.actualForecast, 0);
  const cumulativeMax = Math.max(...reportSeries.planCumulative, ...reportSeries.actualForecastCumulative, 0);
  new Chart(el, {
    type: 'bar',
    data: {
      labels: reportSeries.labels,
      datasets: [
        {
          type: 'bar',
          label: '月次計画',
          data: reportSeries.plan,
          yAxisID: 'y',
          backgroundColor: 'rgba(215, 220, 226, 0.88)',
          borderColor: gray,
          borderWidth: 1,
          grouped: true,
          categoryPercentage: 0.82,
          barPercentage: 0.92,
          order: 3,
        },
        {
          type: 'bar',
          label: '月次見込み／実績',
          data: reportSeries.actualForecast,
          yAxisID: 'y',
          backgroundColor: 'rgba(47, 128, 237, 0.88)',
          borderColor: blue,
          borderWidth: 1,
          grouped: true,
          categoryPercentage: 0.82,
          barPercentage: 0.92,
          order: 2,
        },
        {
          type: 'line',
          label: '計画累計',
          data: reportSeries.planCumulative,
          yAxisID: 'y1',
          borderColor: grayLine,
          backgroundColor: grayLine,
          borderWidth: 3,
          showLine: true,
          pointStyle: 'circle',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.25,
          fill: false,
          order: 1,
        },
        {
          type: 'line',
          label: '見込み／実績累計',
          data: reportSeries.actualForecastCumulative,
          yAxisID: 'y1',
          borderColor: blue,
          backgroundColor: blue,
          borderWidth: 3,
          showLine: true,
          pointStyle: 'circle',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.25,
          fill: false,
          order: 0,
        },
      ],
    },
    options: baseChartOptions({
      maintainAspectRatio: false,
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, labels: { color: 'var(--text)', usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${yen(ctx.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: 'var(--text)' }, grid: { color: 'var(--line)' } },
        y: {
          position: 'left',
          title: { display: true, text: '単月値', color: 'var(--text)' },
          beginAtZero: true,
          suggestedMax: monthlyMax ? monthlyMax * 1.25 : undefined,
          ticks: { color: 'var(--text)', callback: value => fmt(value) },
          grid: { color: 'var(--line)' },
        },
        y1: {
          position: 'right',
          display: cumulativeMax > 0,
          title: { display: true, text: '累計値', color: 'var(--text)' },
          beginAtZero: true,
          suggestedMax: cumulativeMax ? cumulativeMax * 1.08 : undefined,
          ticks: { color: 'var(--text)', callback: value => fmt(value) },
          grid: { drawOnChartArea: false },
        },
      },
    }),
  });
}

function chartColors() {
  if (state.ui.theme === 'neon') return { c1: '#32E0FF', c2: '#AE7CFF', c3: '#FF4FD8', c4: '#7DFF9B', pie: ['#32E0FF','#AE7CFF','#FF4FD8','#7DFF9B','#FFD166','#6CF0FF','#D6A3FF','#FF8AE2','#9DFFB5','#7E89FF'] };
  if (state.ui.theme === 'dark') return { c1: '#FB5B01', c2: '#FFC199', c3: '#FFC700', c4: '#82D4A5', pie: ['#FB5B01','#FF8D44','#FFC199','#FFC700','#A58000','#82D4A5','#6BC7FF','#C8A2FF','#666','#999'] };
  return { c1: '#AC3E00', c2: '#541E00', c3: '#FB5B01', c4: '#197A4B', pie: ['#541E00','#AC3E00','#FB5B01','#FF8D44','#FFC199','#A58000','#D2A400','#FFC700','#666666','#999999'] };
}

function renderImport() {
  document.getElementById('content').innerHTML = `
    <div class="panel">
      <h3>CSV取込</h3>
      <div class="controls">
        <label>ファイル種別
          <select id="fileTypeSelect">${IMPORT_FILE_TYPE_OPTIONS.map(t => `<option value="${dataAttr(t.value)}" ${t.value === state.ui.importFileType ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}</select>
        </label>
      </div>
      <p class="muted">追加データが未取込でも、予実績管理データをもとに各ページを表示します。データ仕様が未確定の追加データは、空の本番風モックを作らず「${escapeHtml(NOT_IMPORTED_MESSAGE)}」として扱います。</p>
      <div class="import-method-grid">
        <section class="import-method-card">
          <h4>CSVファイルから取り込む</h4>
          <div class="dropzone" id="dropzone">ドラッグ＆ドロップ または <input id="csvFile" type="file" accept=".csv,text/csv"></div>
          <div class="controls">
            <button class="primary" id="uploadBtn" disabled>CSVを取り込む</button>
          </div>
        </section>
        <section class="import-method-card">
          <h4>Excelから貼り付けて取り込む</h4>
          <p class="muted">Excelでヘッダー行を含む範囲をコピーし、下の欄へ貼り付けてください。タブ区切り・カンマ区切りを自動判定し、列名の表記ゆれも吸収します。</p>
          <textarea id="pasteData" class="paste-data" rows="10" placeholder="例: 管理No<TAB>案件名<TAB>65期4月予算<TAB>65期4月見込み ..."></textarea>
          <div class="controls">
            <button id="pasteCheckBtn" disabled>貼り付けデータをチェック</button>
            <button class="primary" id="pasteImportBtn" disabled>貼り付けデータを取り込む</button>
          </div>
        </section>
      </div>
      <div class="controls">
        <button class="primary" id="confirmImportBtn" style="display:none">取込を続行する</button>
        <button id="cancelImportBtn" style="display:none">取込を中止する</button>
      </div>
      <div id="importSummary"></div>
      <div id="importErrors"></div>
      <div class="panel"><h4>追加データ取込状況</h4>${additionalStatusListHtml()}</div>
    </div>`;

  const fileInput = document.getElementById('csvFile');
  const uploadBtn = document.getElementById('uploadBtn');
  const fileTypeSelect = document.getElementById('fileTypeSelect');
  const pasteData = document.getElementById('pasteData');
  const pasteCheckBtn = document.getElementById('pasteCheckBtn');
  const pasteImportBtn = document.getElementById('pasteImportBtn');
  const summaryEl = document.getElementById('importSummary');
  const errorsEl = document.getElementById('importErrors');
  const confirmBtn = document.getElementById('confirmImportBtn');
  const cancelBtn = document.getElementById('cancelImportBtn');
  let file = null;
  let lastInspection = null;

  const issueLabel = (level) => ({ warning: '警告', error: 'エラー', skipped: '対象外' }[level] || level);
  const issueHtml = (issue) => {
    const row = issue.rowNumber ? `${fmt(issue.rowNumber)}行目` : 'ファイル全体';
    const raw = issue.rawValue !== undefined && issue.rawValue !== '' ? `（値: ${escapeHtml(issue.rawValue)}）` : '';
    return `<li class="${issue.level === 'error' || issue.level === 'skipped' ? 'warn' : ''}"><b>${escapeHtml(issueLabel(issue.level))}</b> ${escapeHtml(row)} / ${escapeHtml(issue.field || '-')}: ${escapeHtml(issue.message || '')}${raw}</li>`;
  };

  const renderInspection = (result) => {
    lastInspection = result;
    const warnings = (result.issues || []).filter(i => i.level === 'warning');
    const errors = (result.issues || []).filter(i => i.level === 'error');
    const skipped = (result.issues || []).filter(i => i.level === 'skipped');
    const mainWarnings = warnings.concat(skipped).slice(0, 10);
    const mainErrors = errors.slice(0, 10);
    const targetPeriods = (result.targetPeriods || []).length ? result.targetPeriods.map(p => `第${p}期`).join(', ') : '-';

    summaryEl.innerHTML = `
      <div class="panel">
        <h4>${result.dryRun ? '取込前チェック結果' : '取込結果'}</h4>
        <ul>
          <li>取込ファイル名: ${escapeHtml(result.csvFileName || file?.name || '-')}</li>
          <li>対象年月: ${escapeHtml(result.targetYearMonthRange || '-')}</li>
          <li>対象期: ${escapeHtml(targetPeriods)}</li>
          <li>総レコード数: ${fmt(result.totalRows)}</li>
          <li>正常取込件数: ${fmt(result.successRows)}</li>
          <li>警告件数: ${fmt(result.warningCount)}</li>
          <li>エラー件数: ${fmt(result.errorCount)}</li>
          <li>取込対象外件数: ${fmt(result.skippedRows)}</li>
        </ul>
      </div>`;

    errorsEl.innerHTML = `
      <div class="panel">
        <h4>主な警告</h4>
        ${mainWarnings.length ? `<ul>${mainWarnings.map(issueHtml).join('')}</ul>` : '<p>警告はありません。</p>'}
      </div>
      <div class="panel">
        <h4>主なエラー</h4>
        ${mainErrors.length ? `<ul>${mainErrors.map(issueHtml).join('')}</ul>` : '<p>エラーはありません。</p>'}
      </div>`;

    const hasIssues = Number(result.warningCount || 0) > 0 || Number(result.errorCount || 0) > 0 || Number(result.skippedRows || 0) > 0;
    uploadBtn.style.display = result.dryRun ? 'none' : '';
    confirmBtn.style.display = result.dryRun ? '' : 'none';
    cancelBtn.style.display = result.dryRun && hasIssues ? '' : 'none';
    confirmBtn.textContent = hasIssues ? '取込を続行する' : '取込を確定する';
  };

  fileTypeSelect.onchange = () => {
    state.ui.importFileType = fileTypeSelect.value;
    if (file) preview(file);
  };

  const preview = async (f) => {
    file = f;
    const selectedType = fileTypeSelect.value;
    if (selectedType !== 'budget') {
      summaryEl.innerHTML = `<div class="panel"><h4>追加データプレビュー</h4><p>${escapeHtml(IMPORT_FILE_TYPE_OPTIONS.find(t => t.value === selectedType)?.label || selectedType)}を取り込みます。結合キーは management_no（管理番号）を中心に既存明細へ補完します。</p></div>`;
      errorsEl.innerHTML = `<div class="panel"><h4>エラーパネル（表示のみ）</h4>新規案件個票.csv は指定レイアウト（区分,チーム名,管理番号,...,年月,予算金額,見込金額）で取り込みます。その他の追加データ仕様が未確定の種別は「${escapeHtml(NOT_IMPORTED_MESSAGE)}」として返します。</div>`;
      uploadBtn.disabled = false;
      return;
    }

    uploadBtn.disabled = false;
    const c = csvClientChecks(await f.text());
    summaryEl.innerHTML = c.summary ? `<div class="panel"><h4>読み込み結果サマリー（表示のみ）</h4><ul><li>取込ファイル名: ${escapeHtml(f.name)}</li><li>読み込み件数: ${fmt(c.summary.count)}</li><li>対象期間: ${escapeHtml(c.summary.periodRange)}</li><li>欠損の多い列: ${escapeHtml(c.summary.missingHeavy)}</li><li>数値列への文字混入候補: ${fmt(c.summary.invalidNumeric)}</li></ul></div>` : '';
    errorsEl.innerHTML = `<div class="panel"><h4>エラーパネル（表示のみ）</h4>${c.errors.length ? `<ul>${c.errors.map(e => `<li class="warn">${escapeHtml(e)}</li>`).join('')}</ul>` : '問題は検知されませんでした。'}</div>`;
  };

  fileInput.onchange = e => e.target.files[0] && preview(e.target.files[0]);
  const dz = document.getElementById('dropzone');
  dz.ondragover = e => e.preventDefault();
  dz.ondrop = e => { e.preventDefault(); e.dataTransfer.files[0] && preview(e.dataTransfer.files[0]); };

  const updatePasteButtons = () => {
    const hasText = Boolean(pasteData.value.trim());
    pasteCheckBtn.disabled = !hasText;
    pasteImportBtn.disabled = !hasText;
  };

  const submitPaste = async ({ dryRun = false } = {}) => {
    const text = pasteData.value;
    if (!text.trim()) return;
    const selectedType = fileTypeSelect.value;
    const result = await api('/paste', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fileType: selectedType,
        text,
        fileName: 'Excel貼り付けデータ',
        dryRun: dryRun ? 'true' : '',
        confirmImport: dryRun ? '' : 'true',
      }),
    });

    if (dryRun && selectedType === 'budget') {
      renderInspection(result);
      return;
    }

    await refreshAllData();
    if (selectedType === 'budget') goPage('summary');
    else {
      renderImport();
      document.getElementById('importSummary').innerHTML = `<div class="panel"><h4>貼り付け取込結果</h4><p>${escapeHtml(result.message || '')}</p><p>ステータス: ${escapeHtml(result.status || '')} / ${fmt(result.rowCount || 0)}件</p></div>`;
    }
  };

  pasteData.oninput = updatePasteButtons;
  pasteData.onpaste = () => setTimeout(updatePasteButtons, 0);
  pasteCheckBtn.onclick = () => submitPaste({ dryRun: true });
  pasteImportBtn.onclick = () => submitPaste({ dryRun: false });
  confirmBtn.onclick = () => submitPaste({ dryRun: false });
  updatePasteButtons();

  uploadBtn.onclick = async () => {
    if (!file) return;
    const selectedType = fileTypeSelect.value;
    const fd = new FormData();
    fd.append('budget_csv', file);
    fd.append('fileType', selectedType);
    const result = await api('/upload', { method: 'POST', body: fd });
    await refreshAllData();
    if (selectedType === 'budget') goPage('summary');
    else {
      renderImport();
      document.getElementById('importSummary').innerHTML = `<div class="panel"><h4>取込結果</h4><p>${escapeHtml(result.message || '')}</p><p>ステータス: ${escapeHtml(result.status || '')} / ${fmt(result.rowCount || 0)}件</p></div>`;
    }
  };

  cancelBtn.onclick = () => {
    lastInspection = null;
    confirmBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    uploadBtn.style.display = '';
    uploadBtn.disabled = !file;
    errorsEl.innerHTML = '<div class="panel"><h4>取込を中止しました</h4><p>ストアには反映していません。</p></div>';
  };
}

function kpiStatus(name, value, thresholds) {
  if (name === '予算消化率') {
    if (value > 105) return { tone: 'warn', label: '超過注意', icon: '⚠️' };
    if (value >= 90) return { tone: 'ok', label: '順調', icon: '●' };
    return { tone: 'neutral', label: '進行中', icon: '●' };
  }
  if (name === '差額') {
    if (Math.abs(value) >= thresholds.amountGap) return { tone: 'warn', label: '要確認', icon: '⚠️' };
    return { tone: 'ok', label: '許容範囲', icon: '●' };
  }
  if (name === 'コスト削減効果') {
    return value > 0 ? { tone: 'ok', label: '削減効果あり', icon: '●' } : { tone: 'neutral', label: '効果なし', icon: '●' };
  }
  return { tone: 'neutral', label: '確認対象', icon: '●' };
}

function kpiHelpText(name) {
  const map = {
    '総予算': '選択中の期間・部門・対象における計画金額の合計です。',
    '見込み／実績': '実績がある場合は実績、未確定の場合は見込を使った比較対象金額です。',
    '予算消化率': '見込み／実績 ÷ 総予算。100%超は予算超過リスクとして確認します。',
    '差額': '総予算から見込み／実績を差し引いた残額です。大きなプラス／マイナスは原因確認対象です。',
    '着地見込み': '登録済み見込額の合計です。未設定の場合はCSV列・期間を確認してください。',
    'コスト削減効果': '予算残額のうちプラス分を削減効果として見ます。',
  };
  return map[name] || 'KPIの読み方を確認します。';
}

function renderSummary() {
  const items = filteredItems();
  const s = scopedPeriodSummary(items);
  const periodVariance = calculateVariance(s.totalPlan, s.comparable);
  const periodBurnRate = calculateBurnRate(s.totalPlan, s.comparable);
  const fullComparable = items.reduce((sum, item) => sum + getComparableActual(item), 0);
  const fullPlan = items.reduce((sum, item) => sum + Number(item.totalPlan || 0), 0);
  const fullBurnRate = calculateBurnRate(fullPlan, fullComparable);
  const reduction = Math.max(periodVariance.amount, 0);
  const reductionRate = s.totalPlan ? reduction / s.totalPlan * 100 : 0;
  const top = items.map(r => {
    let scopedPlan = 0;
    let scopedComparable = 0;
    const scopeAll = state.filters.periodMode === '通期' || !s.label;

    if (scopeAll) {
      scopedPlan = Number(r.totalPlan || 0);
      scopedComparable = getComparableActual(r);
    } else {
      Object.entries(r.monthly || {}).forEach(([ym, m]) => {
        const key = state.filters.periodMode === '月次' ? ym : ymToQuarter(ym);
        if (key !== s.label) return;
        scopedPlan += Number(m.plan || 0);
        scopedComparable += getComparableActual(m);
      });
    }

    return {
      name: r.project_name || '(案件名未設定)',
      gap: calculateVariance(scopedPlan, scopedComparable).amount,
      row: r,
    };
  }).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 10);
  const kpiRaw = {
    '総予算': s.totalPlan,
    '見込み／実績': s.comparable,
    '予算消化率': periodBurnRate,
    '差額': periodVariance.amount,
    '着地見込み': s.totalForecast,
    'コスト削減効果': reduction,
  };
  const kpiDisplay = {
    '総予算': animatedValueHtml(s.totalPlan, 'yen'),
    '見込み／実績': animatedValueHtml(s.comparable, 'yen'),
    '予算消化率': animatedValueHtml(periodBurnRate, 'pct'),
    '差額': animatedValueHtml(periodVariance.amount, 'yen'),
    '着地見込み': s.totalForecast ? animatedValueHtml(s.totalForecast, 'yen') : '未設定',
    'コスト削減効果': `${animatedValueHtml(reduction, 'yen')} / ${animatedValueHtml(reductionRate, 'pct')}`,
  };
  const reportPeriods = [...new Set(items.map(item => item.fiscal_period).filter(Boolean))]
    .sort((a, b) => Number(a) - Number(b));
  const defaultReportPeriod = reportPeriods[reportPeriods.length - 1] || state.data.status?.periods?.slice(-1)[0] || '';
  if (!state.ui.reportFiscalPeriod || (reportPeriods.length && !reportPeriods.includes(state.ui.reportFiscalPeriod))) {
    state.ui.reportFiscalPeriod = defaultReportPeriod;
  }
  const reportSeries = buildReportSeries(items, state.ui.reportFiscalPeriod || defaultReportPeriod);
  const reportPeriodOptions = reportPeriods.map(period => {
    const fy = deriveFiscalYearFromFiscalPeriod(period, items);
    return `<option value="${dataAttr(period)}" ${period === state.ui.reportFiscalPeriod ? 'selected' : ''}>第${escapeHtml(period)}期（FY${fy}）</option>`;
  }).join('');

  const kpiCards = state.settings.kpiOrder.map((name, idx) => {
    const displayName = name;
    const status = kpiStatus(displayName, kpiRaw[displayName], state.settings.thresholds);
    const popId = `kpiHelp${idx}`;
    const isHero = ['総予算', '見込み／実績', '予算消化率'].includes(displayName);
    return `<article class="kpi kpi-card ${isHero ? 'kpi-card--priority' : ''}" aria-label="${dataAttr(displayName)}">
      <div class="kpi-head">
        <div class="label">${escapeHtml(displayName)}</div>
        <span class="tooltip-wrap">
          <button class="icon-button" type="button" aria-describedby="${popId}" aria-label="${dataAttr(displayName)}の説明を表示">?</button>
          <span id="${popId}" class="popover-card" role="tooltip">${escapeHtml(kpiHelpText(displayName))}</span>
        </span>
      </div>
      <div class="value ${status.tone === 'warn' ? 'warn' : ''}">${kpiDisplay[displayName] || ''}</div>
      <div class="kpi-meta">
        <span class="status-pill status-pill--${status.tone}">${status.icon} ${escapeHtml(status.label)}</span>
        <span>${escapeHtml(state.filters.periodMode)} / ${escapeHtml(state.filters.department || '全部門')}</span>
      </div>
      <p class="kpi-note">${escapeHtml(kpiHelpText(displayName))}</p>
    </article>`;
  }).join('');

  document.getElementById('content').innerHTML = `
    <section class="dashboard-bento" aria-label="経営サマリーダッシュボード">
      <div class="bento-card bento-card--hero summary-hero">
        <div>
          <p class="eyebrow">Executive overview</p>
          <h3>まず見るべき差額と消化状況</h3>
          <p class="muted">上部フィルターを反映した最新スコープです。大きな差異はランキングから明細へドリルダウンできます。</p>
        </div>
        <div class="hero-metric ${Math.abs(periodVariance.amount) >= state.settings.thresholds.amountGap ? 'warn' : 'ok'}">
          <span>差額</span><strong>${animatedValueHtml(periodVariance.amount, 'yen')}</strong>
        </div>
      </div>
      <div class="bento-card bento-card--wide kpi-strip">${kpiCards}</div>
      <div class="bento-card bento-card--small insight-card">
        <h4>当月カード</h4>
        <p class="muted">選択スコープ: ${escapeHtml(s.label || '通期')}</p>
        <dl>
          <dt>予算</dt><dd>${animatedValueHtml(s.totalPlan, 'yen')}</dd>
          <dt>見込み／実績</dt><dd>${animatedValueHtml(s.comparable, 'yen')}</dd>
          <dt>差額</dt><dd class="${Math.abs(periodVariance.amount) >= state.settings.thresholds.amountGap ? 'warn' : ''}">${animatedValueHtml(periodVariance.amount, 'yen')}</dd>
          <dt>差額率</dt><dd>${animatedValueHtml(periodVariance.rate, 'pct')}</dd>
        </dl>
      </div>
      <div class="bento-card bento-card--small insight-card">
        <h4>期全体カード</h4>
        <dl>
          <dt>期全体の予算</dt><dd>${animatedValueHtml(fullPlan, 'yen')}</dd>
          <dt>期全体の見込み／実績</dt><dd>${animatedValueHtml(fullComparable, 'yen')}</dd>
          <dt>予算消化率</dt><dd>${animatedValueHtml(fullBurnRate, 'pct')}</dd>
        </dl>
      </div>
      <div class="bento-card bento-card--wide chart-card">
        <div class="card-title-row"><h4>予算 vs 見込み／実績の推移</h4><span class="badge">最優先グラフ</span></div>
        <div class="chart-frame chart-frame--large"><canvas id="sumChart1"></canvas></div>
      </div>
      <div class="bento-card bento-card--wide chart-card">
        <div class="card-title-row">
          <div>
            <h4>報告用サマリー（単月・累計）</h4>
            <p class="card-help">4月から翌年3月までの月次計画／見込み・実績と累計を同時に確認します。</p>
          </div>
          <label class="controls">期 ${reportPeriodOptions ? `<select id="reportFiscalPeriod">${reportPeriodOptions}</select>` : `<span class="badge">FY${reportSeries.fiscalYear}</span>`}</label>
        </div>
        <div class="chart-frame chart-frame--large"><canvas id="reportComboChart"></canvas></div>
      </div>
      <div class="bento-card bento-card--tall chart-card">
        <div class="card-title-row"><h4>前年差グラフ</h4><span class="badge">前期差で代替</span></div>
        <p class="card-help">見込み／実績の急な増減を確認します。</p>
        <div class="chart-frame"><canvas id="sumChart2"></canvas></div>
      </div>
      <div class="bento-card bento-card--wide ranking-card">
        <div class="card-title-row">
          <h4>差異が大きいカテゴリ／案件ランキング（Top10）</h4>
          <span class="tooltip-wrap">
            <button class="icon-button" type="button" aria-describedby="rankHelp" aria-label="差異ランキングの読み方を表示">?</button>
            <span id="rankHelp" class="popover-card" role="tooltip">絶対差額が大きい順です。行クリックで明細へドリルダウンします。</span>
          </span>
        </div>
        <div class="table-wrap"><table><thead><tr><th>対象</th><th class="right">差額</th><th>状態</th><th>差額理由分類</th><th>差額理由</th><th>コメント</th></tr></thead><tbody>
        ${top.map((r, i) => {
          const isWarn = Math.abs(r.gap) >= state.settings.thresholds.amountGap;
          return `<tr data-mid="${dataAttr(r.row.management_no)}" class="clickable-row ${isWarn ? 'warning-row' : ''}"><td>${i + 1}. ${escapeHtml(r.name)}</td><td class="right ${isWarn ? 'warn' : ''}">${yen(r.gap)}</td><td><span class="status-pill status-pill--${isWarn ? 'warn' : 'ok'}">${isWarn ? '⚠️ 要確認' : '● 許容範囲'}</span></td><td>${displayHtml(r.row.variance_reason_category)}</td><td>${displayHtml(r.row.variance_reason)}</td><td>${displayHtml(r.row.comment)}</td></tr>`;
        }).join('')}
        </tbody></table></div>
      </div>
      <div class="bento-card bento-card--small insight-card">
        <h4>フィルター中の件数</h4><strong>${animatedValueHtml(items.length, 'fmt')}</strong><span class="muted">案件</span>
      </div>
    </section>`;

  const labels = s.labels;
  const series = s.series;
  const cc = chartColors();
  drawLine('sumChart1', labels, [
    { label: '予算', data: series.map(v => v.plan), borderColor: cc.c1 },
    { label: '見込み／実績', data: series.map(v => v.comparable), borderColor: cc.c2 },
  ]);
  const deltas = series.map((v, idx) => idx === 0 ? 0 : v.comparable - series[idx - 1].comparable);
  drawLine('sumChart2', labels, [{ label: '前年差(代替:前期差)', data: deltas, borderColor: cc.c3 }]);
  drawReportComboChart('reportComboChart', reportSeries);
  animateNumericValues(document.getElementById('content'));

  const reportFiscalPeriodSelect = document.getElementById('reportFiscalPeriod');
  if (reportFiscalPeriodSelect) {
    reportFiscalPeriodSelect.onchange = () => {
      state.ui.reportFiscalPeriod = reportFiscalPeriodSelect.value;
      renderPage();
    };
  }
  bindManagementNoDrilldowns();
}

function renderTrend() {
  const items = filteredItems();
  const s = recomputeSummary(items);
  const labels = s.labels.slice(-state.ui.trendMonths);
  const series = s.series.slice(-state.ui.trendMonths);
  const rank = items.map(r => ({
    name: r.project_name || '(案件名未設定)',
    management_no: r.management_no,
    yoy: Number(r.totalActual || 0) - Number(r.totalPlan || 0),
    mom: Number(r.totalForecast || 0) - Number(r.totalActual || 0),
  })).sort((a, b) => Math.abs(b.yoy) - Math.abs(a.yoy)).slice(0, 20);

  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="controls">
        <label>期間 <select id="trendMonths">${[12, 24, 60].map(v => `<option value="${v}" ${v === state.ui.trendMonths ? 'selected' : ''}>${v}か月</option>`).join('')}</select></label>
        <label>指標 <select id="trendMetric">${['総額', '費目別', 'システム別'].map(v => optionHtml(v, state.ui.trendMetric)).join('')}</select></label>
      </div>
      <div style="height:320px"><canvas id="trendChart"></canvas></div>
    </div>
    <div class="panel"><h4>変動の大きい順ランキング（前年差・前月差）</h4><div class="table-wrap"><table><thead><tr><th>対象</th><th class="right">前年差</th><th class="right">前月差</th></tr></thead><tbody>
      ${rank.map(r => `<tr class="clickable-row" data-filter-type="management_no" data-filter-value="${dataAttr(r.management_no)}"><td>${escapeHtml(r.name)}</td><td class="right">${yen(r.yoy)}</td><td class="right">${yen(r.mom)}</td></tr>`).join('')}
    </tbody></table></div></div>`;

  const cc = chartColors();
  drawLine('trendChart', labels, [
    { label: '予算', data: series.map(v => v.plan), borderColor: cc.c1 },
    { label: '見込', data: series.map(v => v.forecast), borderColor: cc.c3 },
    { label: '実績', data: series.map(v => v.actual), borderColor: cc.c2 },
  ]);

  document.getElementById('trendMonths').onchange = e => { state.ui.trendMonths = Number(e.target.value); renderTrend(); };
  document.getElementById('trendMetric').onchange = e => { state.ui.trendMetric = e.target.value; renderTrend(); };
  bindDetailFilterLinks();
}

function aggregateBy(rows, key) {
  const map = {};
  rows.forEach(r => {
    const k = r[key] || '未設定';
    if (!map[k]) map[k] = { key: k, plan: 0, actual: 0 };
    map[k].plan += Number(r.totalPlan || 0);
    map[k].actual += Number(r.totalActual || 0);
  });
  const all = Object.values(map);
  const totalActual = all.reduce((s, v) => s + v.actual, 0);
  const totalPlan = all.reduce((s, v) => s + v.plan, 0);
  const base = totalActual > 0 ? totalActual : totalPlan;
  return all.map(r => ({
    ...r,
    comp: base ? (r.actual > 0 ? r.actual : r.plan) / base * 100 : 0,
    gap: r.plan - r.actual,
    gapRate: r.plan ? (r.plan - r.actual) / r.plan * 100 : 0,
  })).sort((a, b) => b.comp - a.comp);
}

function renderCategory() {
  const tabs = ['システム分類名別', '経費区分別', '経費事象名別', '部門別', '固定費・変動費'];
  const keyMap = { 'システム分類名別': 'system_classification', '経費区分別': 'expense_classification', '経費事象名別': 'expense_item_name', '部門別': 'department_name', '固定費・変動費': 'fixed_variable_type' };
  const categoryKey = keyMap[state.ui.categoryTab];
  const agg = aggregateBy(filteredItems(), categoryKey);

  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="tabs">${tabs.map(t => `<button data-tab="${dataAttr(t)}" class="${t === state.ui.categoryTab ? 'active' : ''}">${escapeHtml(t)}</button>`).join('')}</div>
      <div class="grid-2">
        <div><h4>構成比</h4><div style="height:300px"><canvas id="catPie"></canvas></div></div>
        <div><h4>予実差（差額順／乖離率順）</h4><div class="table-wrap"><table><thead><tr><th>分類</th><th class="right">構成比</th><th class="right">差額</th><th class="right">乖離率</th></tr></thead><tbody>
          ${agg.slice(0, 25).map(r => `<tr class="clickable-row" data-filter-type="${categoryKey === 'department_name' ? 'department' : 'category'}" data-filter-value="${dataAttr(r.key)}"><td>${escapeHtml(r.key)}</td><td class="right">${pct(r.comp)}</td><td class="right">${yen(r.gap)}</td><td class="right">${pct(r.gapRate)}</td></tr>`).join('')}
        </tbody></table></div></div>
      </div>
    </div>`;

  document.querySelectorAll('[data-tab]').forEach(btn => btn.onclick = () => { state.ui.categoryTab = btn.dataset.tab; renderCategory(); });
  bindDetailFilterLinks();
  const palette = chartColors().pie;
  new Chart(document.getElementById('catPie'), {
    type: 'doughnut',
    data: { labels: agg.slice(0, 10).map(v => v.key), datasets: [{ data: agg.slice(0, 10).map(v => v.comp), backgroundColor: palette.slice(0, Math.min(10, agg.length)), borderWidth: 1 }] },
    options: baseChartOptions({ maintainAspectRatio: false, responsive: true })
  });
}

async function renderProject() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="panel"><p>新規案件データを読み込み中です...</p></div>';

  const analysis = await api('/analysis/new-projects').catch(() => ({ data: null }));
  const payload = analysis.data || { projects: [], groupSummary: [], hasNewProjectCsv: false, sourceRowCount: 0 };
  const fallbackRows = filteredItems()
    .filter(r => isNewProject(r) || (r.payment_category || '').includes('投資'))
    .map(r => {
      const plan = Number(r.totalPlan || 0);
      const comparable = Number(r.totalActual || 0) > 0 ? Number(r.totalActual || 0) : Number(r.totalForecast || 0);
      return {
        ...r,
        project_category: r.payment_category || r.budget_category || '',
        it_strategy_category: r.system_classification || '',
        progress_rate: plan ? comparable / Math.max(plan, 1) * 100 : 0,
        cost_burn_rate: plan ? comparable / Math.max(plan, 1) * 100 : 0,
        variance_amount: plan - comparable,
        comparableAmount: comparable,
      };
    });
  const rows = (payload.projects && payload.projects.length ? payload.projects : fallbackRows);
  const scatter = rows.slice(0, 200).map(r => ({
    x: Number(r.progress_rate || 0),
    y: Number(r.cost_burn_rate || 0),
  }));
  const categoryRows = (payload.groupSummary || []).filter(r => r.type === 'project_category').slice(0, 8);
  const strategyRows = (payload.groupSummary || []).filter(r => r.type === 'it_strategy_category').slice(0, 8);

  content.innerHTML = `
    <section class="panel">
      <div class="card-title-row">
        <div>
          <h3>プロジェクト別予算実績差異（新規案件個票）</h3>
          <p class="muted">新規案件個票.csv の「案件区分」と「区分_1（IT戦区分）」別に、予算金額と見込／実績の差額を確認します。</p>
        </div>
        <span class="badge">${payload.hasNewProjectCsv ? `新規案件CSV ${fmt(payload.sourceRowCount)}行` : '予実績管理データから抽出'}</span>
      </div>
      <div class="grid-2">
        <div><h4>投資系／運用系など案件区分別</h4><div class="table-wrap"><table><thead><tr><th>区分</th><th class="right">予算</th><th class="right">見込／実績</th><th class="right">差額</th></tr></thead><tbody>${categoryRows.map(r => `<tr><td>${escapeHtml(r.key)}</td><td class="right">${yen(r.plan)}</td><td class="right">${yen(r.comparable)}</td><td class="right ${Math.abs(r.variance) >= state.settings.thresholds.amountGap ? 'warn' : ''}">${yen(r.variance)}</td></tr>`).join('') || '<tr><td colspan="4">分類データなし</td></tr>'}</tbody></table></div></div>
        <div><h4>IT戦区分別</h4><div class="table-wrap"><table><thead><tr><th>区分</th><th class="right">予算</th><th class="right">見込／実績</th><th class="right">差額</th></tr></thead><tbody>${strategyRows.map(r => `<tr><td>${escapeHtml(r.key)}</td><td class="right">${yen(r.plan)}</td><td class="right">${yen(r.comparable)}</td><td class="right ${Math.abs(r.variance) >= state.settings.thresholds.amountGap ? 'warn' : ''}">${yen(r.variance)}</td></tr>`).join('') || '<tr><td colspan="4">分類データなし</td></tr>'}</tbody></table></div></div>
      </div>
    </section>
    <div class="panel"><div class="controls"><input id="pSearch" type="text" placeholder="案件名・管理番号・担当者で検索"></div><div style="height:300px"><canvas id="projectScatter"></canvas></div></div>
    <div class="panel"><div class="table-wrap"><table><thead><tr><th>管理番号</th><th>プロジェクト</th><th>案件区分</th><th>IT戦区分</th><th class="right">予算実績差異</th><th class="right">進捗率</th><th class="right">コスト消化率</th><th>差額理由分類</th><th>差額理由</th><th>memo/コメント</th></tr></thead><tbody id="projectRows"></tbody></table></div></div>`;

  const drawRows = (q = '') => {
    const query = q.toLowerCase();
    const view = rows.filter(r => !query || [r.project_name, r.management_no, r.owner_name, r.team_name].some(v => String(v || '').toLowerCase().includes(query)));
    document.getElementById('projectRows').innerHTML = view.slice(0, 300).map(r => `
      <tr class="clickable-row" data-filter-type="management_no" data-filter-value="${dataAttr(r.management_no)}">
        <td>${escapeHtml(r.management_no || '-')}</td>
        <td>${escapeHtml(r.project_name || '(名称未設定)')}</td>
        <td>${escapeHtml(r.project_category || '未設定')}</td>
        <td>${escapeHtml(r.it_strategy_category || '未設定')}</td>
        <td class="right ${Math.abs(Number(r.variance_amount || 0)) >= state.settings.thresholds.amountGap ? 'warn' : ''}">${yen(r.variance_amount)}</td>
        <td class="right">${pct(r.progress_rate)}</td>
        <td class="right">${pct(r.cost_burn_rate)}</td>
        <td>${displayHtml(r.variance_reason_category)}</td>
        <td>${displayHtml(r.variance_reason)}</td>
        <td>${displayHtml(r.comment || r.memo)}</td>
      </tr>`).join('') || '<tr><td colspan="10">対象なし</td></tr>';
    bindDetailFilterLinks(document.getElementById('projectRows'));
  };

  drawRows();
  document.getElementById('pSearch').oninput = e => drawRows(e.target.value);
  new Chart(document.getElementById('projectScatter'), {
    type: 'scatter',
    data: { datasets: [{ label: '案件', data: scatter }] },
    options: baseChartOptions({ scales: { x: { title: { display: true, text: '進捗率(%)' } }, y: { title: { display: true, text: 'コスト消化率(%)' } } } }),
  });
}

function renderAlert() {
  const t = state.settings.thresholds;
  const rows = filteredItems().map(r => {
    const gap = Number(r.totalPlan || 0) - Number(r.totalActual || 0);
    const rate = Number(r.totalPlan || 0) ? (Number(r.totalActual || 0) - Number(r.totalPlan || 0)) / Number(r.totalPlan || 1) * 100 : 0;
    return { ...r, gap, rate };
  }).filter(r => Math.abs(r.rate) >= t.varianceRate || Math.abs(r.gap) >= t.amountGap).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  const first = rows[0];
  const alertCards = rows.slice(0, 4).map((r, idx) => `
    <article class="alert-card ${idx === 0 ? 'alert-card--major' : ''}">
      <div class="card-title-row"><h4>⚠️ ${escapeHtml(r.project_name || r.management_no)}</h4><span class="status-pill status-pill--warn">重要度 ${idx + 1}</span></div>
      <dl class="metric-list"><div><dt>差額</dt><dd class="warn">${yen(r.gap)}</dd></div><div><dt>乖離率</dt><dd>${pct(r.rate)}</dd></div></dl>
      <p class="muted">${escapeHtml(r.department_name || '-')} / ${escapeHtml(r.system_name || '-')}</p><p>差額理由分類: ${displayHtml(r.variance_reason_category)} / 差額理由: ${displayHtml(r.variance_reason)}</p><p>コメント: ${displayHtml(r.comment)}</p>
      <button type="button" data-mid="${dataAttr(r.management_no)}" aria-label="${dataAttr(r.project_name || r.management_no)}の明細を表示">明細を見る</button>
    </article>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="panel alert-overview">
      <div class="controls"><span class="badge">しきい値: 乖離率 ${t.varianceRate}% / 差額 ${fmt(t.amountGap)} 千円 / 前月比 ${t.momRate}% / 前年比 ${t.yoyRate}%</span></div>
      <div class="alert-grid">${alertCards || '<div class="ok">● アラート対象なし</div>'}</div>
    </div>
    <div class="grid-2">
      <div class="panel"><h4>アラート一覧</h4><div class="table-wrap"><table><thead><tr><th>案件</th><th class="right">差額</th><th class="right">乖離率</th><th>状態</th><th>差額理由分類</th><th>差額理由</th><th>コメント</th></tr></thead><tbody>
        ${rows.slice(0, 200).map(r => `<tr data-mid="${dataAttr(r.management_no)}" class="clickable-row warning-row"><td>${escapeHtml(r.project_name || r.management_no)}</td><td class="right warn">${yen(r.gap)}</td><td class="right">${pct(r.rate)}</td><td><span class="status-pill status-pill--warn">⚠️ 要確認</span></td><td>${displayHtml(r.variance_reason_category)}</td><td>${displayHtml(r.variance_reason)}</td><td>${displayHtml(r.comment)}</td></tr>`).join('') || '<tr><td colspan="7">対象なし</td></tr>'}
      </tbody></table></div></div>
      <div class="panel"><h4>最重要アラートの詳細</h4>${first ? `<p><b>${escapeHtml(first.project_name || first.management_no)}</b></p><p>推移: 予算 ${yen(first.totalPlan)} / 実績 ${yen(first.totalActual)}</p><p>関連明細: ${escapeHtml(first.system_name || '-')} / ${escapeHtml(first.department_name || '-')}</p><p>差額理由分類: ${displayHtml(first.variance_reason_category)} / 差額理由: ${displayHtml(first.variance_reason)}</p><p>コメント: ${displayHtml(first.comment)}</p><p>メモ欄: ${escapeHtml(first.memo || 'CSV列なし')}</p><button id="alertDetailBtn" type="button">詳細説明を開く</button><dialog id="alertDetailDialog" aria-labelledby="alertDialogTitle"><h3 id="alertDialogTitle">アラートの読み方</h3><p>差額・乖離率の両方を確認し、対象案件の明細で月次推移と担当部門を確認してください。</p><form method="dialog"><button>閉じる</button></form></dialog>` : 'アラート対象なし'}</div>
    </div>`;

  bindDetailFilterLinks();
  bindManagementNoDrilldowns();
  const dialog = document.getElementById('alertDetailDialog');
  const btn = document.getElementById('alertDetailBtn');
  if (dialog && btn) btn.onclick = () => dialog.showModal();
}

function renderVendor() {
  const items = filteredItems();
  const map = {};
  const periodSummary = scopedPeriodSummary(items);
  const latestLabel = periodSummary.labels[periodSummary.labels.length - 1];
  const scopeAll = state.filters.periodMode === '通期' || !latestLabel;
  items.forEach(r => {
    const name = r.vendor_name || r.payee_name || '未設定ベンダー';
    if (!map[name]) map[name] = { name, amount: 0, count: 0 };
    let pay = 0;
    if (scopeAll) {
      pay = Number(r.totalActual || 0) || Number(r.totalForecast || 0) || Number(r.totalPlan || 0);
    } else {
      Object.entries(r.monthly || {}).forEach(([ym, m]) => {
        const key = state.filters.periodMode === '月次' ? ym : ymToQuarter(ym);
        if (key === latestLabel) pay += Number(m.actual || 0) || Number(m.forecast || 0) || Number(m.plan || 0);
      });
    }
    map[name].amount += pay;
    map[name].count += 1;
  });
  const ranking = Object.values(map).sort((a, b) => b.amount - a.amount);

  const contractRows = (state.data.contracts || []).slice().sort((a, b) => {
    const ar = a.review_required ? 0 : 1;
    const br = b.review_required ? 0 : 1;
    if (ar !== br) return ar - br;
    const am = a.months_until_renewal ?? Number.MAX_SAFE_INTEGER;
    const bm = b.months_until_renewal ?? Number.MAX_SAFE_INTEGER;
    return am - bm || String(a.vendor_name || '').localeCompare(String(b.vendor_name || ''), 'ja');
  });

  document.getElementById('content').innerHTML = `
    <section class="vendor-bento">
      <div class="bento-card bento-card--wide"><div class="card-title-row"><h4>ベンダー別支払額ランキング</h4><span class="badge">集中リスク確認</span></div><div class="table-wrap"><table><thead><tr><th>ベンダー</th><th class="right">支払額</th><th class="right">件数</th><th>状態</th></tr></thead><tbody>
        ${ranking.map((v, idx) => `<tr class="clickable-row" data-filter-type="vendor" data-filter-value="${dataAttr(v.name)}"><td>${escapeHtml(v.name)}</td><td class="right">${yen(v.amount)}</td><td class="right">${fmt(v.count)}</td><td><span class="status-pill status-pill--${idx < 3 ? 'warn' : 'neutral'}">${idx < 3 ? '⚠️ 上位集中' : '● 通常'}</span></td></tr>`).join('') || '<tr><td colspan="4">データなし</td></tr>'}
      </tbody></table></div></div>
      <div class="bento-card bento-card--wide"><div class="card-title-row"><h4>契約更新・見直し一覧</h4><span class="badge">契約属性とアラート</span></div><div class="table-wrap"><table><thead><tr><th>ベンダー名</th><th>案件名</th><th>支払区分</th><th>契約開始日</th><th>契約終了日</th><th>次回更新予定月</th><th class="right">残月数</th><th>アラート区分</th><th>見直し要否</th><th>備考</th></tr></thead><tbody>
        ${contractRows.map(r => `<tr class="${r.review_required ? 'warning-row' : ''}"><td>${escapeHtml(r.vendor_name || '未設定ベンダー')}</td><td>${escapeHtml(r.project_name || r.system_name || '-')}</td><td>${escapedContractValueForHtml(r.payment_category)}</td><td>${escapeHtml(displayContractDate(r.contract_start_date, r.contract_start_date_status))}</td><td>${escapeHtml(displayContractDate(r.contract_end_date, r.contract_end_date_status))}</td><td>${escapedContractValueForHtml(r.next_renewal_month || r.renewal_month)}</td><td class="right">${escapeHtml(r.months_until_renewal ?? '-')}</td><td>${escapeHtml(r.alert_type || '通常')}</td><td><span class="status-pill status-pill--${r.review_required ? 'warn' : 'neutral'}">${r.review_required ? '要見直し' : '不要'}</span></td><td>${escapedContractValueForHtml(r.note)}</td></tr>`).join('') || '<tr><td colspan="10">契約データなし</td></tr>'}
      </tbody></table></div></div>
    </section>`;

  bindDetailFilterLinks();
}
function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
}

function renderDetail() {
  const fixedCols = ['management_no', 'project_name', 'department_name', 'system_name'];
  const optionalCols = ['owner_name', 'vendor_name', 'budget_category', 'fixed_variable_type', 'payment_category', 'totalPlan', 'totalForecast', 'totalActual', 'variance_reason_category', 'variance_reason', 'comment'];
  const drilldownBadge = state.ui.detailFilter
    ? `<span class="badge">絞り込み: ${escapeHtml(detailFilterLabel())}</span><button id="dClearFilter" type="button">絞り込み解除</button>`
    : '';

  document.getElementById('content').innerHTML = `
    <section class="detail-layout">
      <div class="panel detail-tools">
        <div class="controls detail-controls">
          <label class="search-field">検索<input type="text" id="dSearch" placeholder="管理番号・案件名・ベンダー名・部門名・担当者名で検索" value="${dataAttr(state.ui.detailSearch || '')}"></label>
          <button id="dExport" aria-label="表示中の明細をCSVで書き出す">表示結果をCSV書き出し</button>
          <span class="badge">キー項目は常時表示</span>
          ${drilldownBadge}
        </div>
        <div class="col-picker" id="colPicker" aria-label="表示列の選択">${optionalCols.map(c => `<label class="col-chip" data-col="${dataAttr(c)}"><input type="checkbox" ${state.ui.extraDetailCols.includes(c) ? 'checked' : ''}>${escapeHtml(detailColumnLabel(c))}</label>`).join('')}</div>
      </div>
      <div class="panel detail-table-card">
        <h4>明細テーブル</h4>
        <div class="table-wrap"><table><thead><tr id="dHead"></tr></thead><tbody id="dBody"></tbody></table></div>
      </div>
      <div class="panel detail-pane" id="detailPane"><h4>詳細ペイン</h4><p>行クリックで属性(master)+月次(detail)を並列表示します。</p></div>
    </section>`;

  const renderRows = () => {
    const q = document.getElementById('dSearch').value.toLowerCase();
    state.ui.detailSearch = q;
    const cols = [...fixedCols, ...state.ui.extraDetailCols];
    const view = filteredItems().filter(r => itemMatchesDetailFilter(r)).filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));

    document.getElementById('dHead').innerHTML = cols.map(c => `<th>${escapeHtml(detailColumnLabel(c))}</th>`).join('');
    document.getElementById('dBody').innerHTML = view.slice(0, 500).map((r, idx) => `<tr data-idx="${idx}" class="clickable-row">${cols.map(c => `<td>${['variance_reason_category', 'variance_reason', 'comment'].includes(c) ? displayHtml(r[c]) : escapeHtml(r[c] ?? '')}</td>`).join('')}</tr>`).join('');

    document.querySelectorAll('#dBody tr').forEach(tr => tr.onclick = () => {
      const row = view[Number(tr.dataset.idx)];
      const master = {
        [detailColumnLabel('management_no')]: row.management_no,
        [detailColumnLabel('item_no')]: row.item_no,
        [detailColumnLabel('project_name')]: row.project_name,
        [detailColumnLabel('department_name')]: row.department_name,
        [detailColumnLabel('owner_name')]: row.owner_name,
        [detailColumnLabel('vendor_name')]: row.vendor_name,
        [detailColumnLabel('system_name')]: row.system_name,
        [detailColumnLabel('budget_category')]: row.budget_category,
        [detailColumnLabel('variance_reason_category')]: displayText(row.variance_reason_category),
        [detailColumnLabel('variance_reason')]: displayText(row.variance_reason),
        [detailColumnLabel('comment')]: displayText(row.comment),
        [detailColumnLabel('comment_updated_month')]: displayText(row.comment_updated_month),
        [detailColumnLabel('comment_updated_by')]: displayText(row.comment_updated_by),
      };
      const detail = Object.fromEntries(Object.entries(row.monthly || {}).sort(([a], [b]) => a.localeCompare(b)).map(([ym, m]) => [formatYearMonth(ym), {
        計画: Number(m.plan || 0),
        見込: Number(m.forecast || 0),
        実績: Number(m.actual || 0),
        コメント: displayText(firstPresent(m.comment, row.comment)),
      }]));
      const monthlyRows = Object.entries(row.monthly || {}).sort(([a], [b]) => a.localeCompare(b)).map(([ym, m]) => `<tr><td>${escapeHtml(formatYearMonth(ym))}</td><td class="right">${yen(m.plan)}</td><td class="right">${yen(m.forecast)}</td><td class="right">${yen(m.actual)}</td><td>${monthlyCommentHtml(m, row)}</td></tr>`).join('');
      document.getElementById('detailPane').innerHTML = `<h4>詳細ペイン</h4><div class="table-wrap"><table><thead><tr><th>年月</th><th class="right">計画</th><th class="right">見込</th><th class="right">実績</th><th>コメント</th></tr></thead><tbody>${monthlyRows || '<tr><td colspan="5">月次データなし</td></tr>'}</tbody></table></div><div class="detail-card-grid detail-json-grid"><div><h5>属性（マスタJSON）</h5><pre>${jsonForHtml(master)}</pre></div><div><h5>月次（明細JSON）</h5><pre>${jsonForHtml(detail)}</pre></div></div>`;
    });

    document.getElementById('dExport').onclick = () => {
      const csv = toCsv(view.map(r => Object.fromEntries(cols.map(c => [c, r[c] ?? '']))));
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'displayed_detail.csv';
      a.click();
    };
  };

  const clearFilter = document.getElementById('dClearFilter');
  if (clearFilter) clearFilter.onclick = () => { state.ui.detailFilter = null; renderDetail(); };

  renderRows();
  document.getElementById('dSearch').oninput = renderRows;
  document.querySelectorAll('#colPicker .col-chip').forEach(chip => {
    chip.onchange = () => {
      const c = chip.dataset.col;
      if (state.ui.extraDetailCols.includes(c)) state.ui.extraDetailCols = state.ui.extraDetailCols.filter(v => v !== c);
      else state.ui.extraDetailCols.push(c);
      renderRows();
    };
  });
}

function renderSettings() {
  const t = state.settings.thresholds;
  document.getElementById('content').innerHTML = `
    <div class="panel">
      <h4>表示設定（データは変更しない）</h4>
      <div class="controls">
        <label>乖離率% <input id="sVar" type="number" value="${t.varianceRate}"></label>
        <label>差額金額 <input id="sAmt" type="number" value="${t.amountGap}"></label>
        <label>前月比% <input id="sMom" type="number" value="${t.momRate}"></label>
        <label>前年比% <input id="sYoy" type="number" value="${t.yoyRate}"></label>
      </div>
      <label>重要KPI 並び順（カンマ区切り）<input id="sKpi" type="text" style="width:100%" value="${dataAttr(state.settings.kpiOrder.join(','))}"></label>
      <div class="controls"><button class="primary" id="saveSetting">反映</button></div>
    </div>`;
  document.getElementById('content').insertAdjacentHTML('beforeend', `
    <div class="panel">
      <h4>テーマ設定</h4>
      <div class="controls">
        <label>表示テーマ
          <select id="themeSelect">
            <option value="light">ライト</option><option value="dark">ダーク</option><option value="neon">ネオン</option>
          </select>
        </label>
      </div>
    </div>
  `);
  document.getElementById('themeSelect').value = state.ui.theme;
  document.getElementById('themeSelect').onchange = (e) => { state.ui.theme = e.target.value; applyTheme(); renderPage(); };

  document.getElementById('saveSetting').onclick = () => {
    state.settings.thresholds.varianceRate = Number(document.getElementById('sVar').value || 10);
    state.settings.thresholds.amountGap = Number(document.getElementById('sAmt').value || 1000);
    state.settings.thresholds.momRate = Number(document.getElementById('sMom').value || 10);
    state.settings.thresholds.yoyRate = Number(document.getElementById('sYoy').value || 10);
    state.settings.kpiOrder = document.getElementById('sKpi').value.split(',').map(v => v.trim()).filter(Boolean);
    alert('表示設定を反映しました');
  };
}

function renderManual() {
  document.getElementById('content').innerHTML = `
    <div class="panel"><h3>このアプリでできること（全体像）</h3>
      <p>予算・見込・実績を1つの画面で確認し、会議で必要な説明資料を短時間で準備するための可視化アプリです。</p>
      <ul><li>月次会議での予実差確認</li><li>コスト削減委員会での優先課題抽出</li><li>部門・案件・ベンダー単位の深掘り</li></ul>
      <div class="badge">推奨の閲覧順：1. データ取込 → 2. 全体サマリー → 6. アラート → 8. 明細</div>
    </div>
    <div class="panel"><h3>画面別ガイド（見方と操作方法）</h3>
      <h4>1. データ取込</h4>
      <ul><li><b>見るポイント：</b>読み込み件数、対象期間、警告件数。</li><li><b>操作：</b>CSVを選択してアップロード。エラーがあれば修正後に再取込。</li></ul>
      <h4>2. 全体サマリー（月次レポート）</h4>
      <ul><li><b>見るポイント：</b>KPIカード（総予算・見込み／実績・予算消化率）と差額ランキング。</li><li><b>操作：</b>上部フィルタ（期間・部門・観点・対象）を切替えて、差異の大きい領域を特定。</li></ul>
      <h4>3. 推移（前年差／トレンド）</h4>
      <ul><li><b>見るポイント：</b>異常に増減した月、前年同月比の跳ね。</li><li><b>操作：</b>表示月数や指標を切替え、異常月を起点に原因を深掘り。</li></ul>
      <h4>4. カテゴリ別分析</h4>
      <ul><li><b>見るポイント：</b>費目・システム・固定変動など切り口別の構成比。</li><li><b>操作：</b>タブ切替で観点を変更し、寄与度の高いカテゴリを確認。</li></ul>
      <h4>5. プロジェクト別（新規案件）</h4>
      <ul><li><b>見るポイント：</b>新規案件の予算規模、見込乖離、進捗。</li><li><b>操作：</b>対象フィルタで新規案件に絞り、案件別に優先度を判断。</li></ul>
      <h4>6. アラート（乖離・変動）</h4>
      <ul><li><b>見るポイント：</b>乖離率・差額・前月比・前年比のしきい値超過。</li><li><b>操作：</b>9. 表示設定でしきい値を調整し、重要アラートのみ抽出。</li></ul>
      <h4>7. ベンダー／契約更新</h4>
      <ul><li><b>見るポイント：</b>ベンダー別支出、契約更新時期、集中リスク。</li><li><b>操作：</b>ベンダー単位で並べ替え、更新月の重なりを確認。</li></ul>
      <h4>8. 明細（検索・ドリルダウン）</h4>
      <ul><li><b>見るポイント：</b>案件単位の実績・見込・担当者・ベンダー情報。</li><li><b>操作：</b>キーワード検索、列表示切替、他画面からのドリルダウン確認。</li></ul>
      <h4>9. 表示設定</h4>
      <ul><li><b>見るポイント：</b>アラート判定に使うしきい値とKPI表示順。</li><li><b>操作：</b>しきい値・KPI順・テーマ（ライト/ダーク/ネオン）を変更して反映。</li></ul>
      <h4>10. 取扱説明書（マニュアル）</h4>
      <ul><li><b>見るポイント：</b>運用手順、FAQ、画面別の活用方法。</li><li><b>操作：</b>不明点は本画面に戻り、該当する画面説明を確認。</li></ul>
    </div>
    <div class="panel"><h3>使い方チュートリアル（ステップ形式）</h3>
      <h4>Step 1：データ取込</h4>
      <ol><li>「1. データ取込」へ移動しCSVをアップロードします。</li><li>「読み込み結果サマリー」で件数・対象期間を確認します。</li><li>エラーパネルで不足列や数値不正を確認し、CSVを修正して再取込します。</li></ol>
      <h4>Step 2：全体サマリーの見方</h4>
      <ol><li>KPIカードで「総予算・見込み／実績・予算消化率」を確認します。</li><li>「差額」が大きい項目（赤表示）を優先確認します。</li><li>ランキング上位をクリックし、明細へドリルダウンします。</li></ol>
      <h4>Step 3：分析・ドリルダウン</h4>
      <ol><li>「推移」で時系列の異常月を特定します。</li><li>「カテゴリ別分析」で費目・部門など観点を切替え、原因候補を絞ります。</li><li>「明細」で検索し、個票レベルで確認します。</li></ol>
    </div>
    <div class="panel"><h3>よくある質問（FAQ）</h3>
      <p><b>Q. 数字が合わないときは？</b><br>A. 期間フィルタ（月次/四半期/通期）と対象（部門・案件）をそろえてから確認してください。CSVのヘッダ名・数値形式も再確認してください。</p>
      <p><b>Q. どこから確認を始めるべきですか？</b><br>A. まずは「2. 全体サマリー」で全体感を把握し、次に「6. アラート」で優先課題を抽出、最後に「8. 明細」で根拠を確認する流れがおすすめです。</p>
      <p><b>Q. 表示を切り替えたいときは？</b><br>A. ヘッダ右上、または「9. 表示設定」のテーマ選択でライト/ダーク/ネオンを即時切替できます。選択はブラウザに保存されます。</p>
      <div class="badge">初回アクセスの方へ：まずは Step 1 → Step 2 → Step 3 の順でお試しください。</div>
    </div>`;
}

function showAdditionalDataNotice() {
  const content = document.getElementById('content');
  const notice = additionalDataNoticeHtml();
  if (content && notice && state.page !== 'import') content.insertAdjacentHTML('afterbegin', notice);
}

async function renderPage() {
  document.getElementById('pageTitle').textContent = NAV_PAGES.find(p => p.key === state.page)?.label || '';
  if (state.page === 'import') return renderImport();
  if (state.page === 'manual') return renderManual();
  if (!state.hasData) return goPage('import');
  if (state.page === 'summary') renderSummary();
  else if (state.page === 'trend') renderTrend();
  else if (state.page === 'category') renderCategory();
  else if (state.page === 'project') renderProject();
  else if (state.page === 'alert') renderAlert();
  else if (state.page === 'vendor') renderVendor();
  else if (state.page === 'detail') renderDetail();
  else if (state.page === 'settings') renderSettings();
  showAdditionalDataNotice();
}

function showManualHintDialog() {
  if (localStorage.getItem('manualHintSeen')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="manualHintDialog" aria-labelledby="manualHintTitle" aria-describedby="manualHintDesc">
      <h3 id="manualHintTitle">初回チュートリアル</h3>
      <p id="manualHintDesc">チュートリアルは「10. 取扱説明書（マニュアル）」から確認できます。</p>
      <form method="dialog" class="controls">
        <button class="primary" value="ok">始める</button>
      </form>
    </dialog>`);
  const dialog = document.getElementById('manualHintDialog');
  dialog.addEventListener('close', () => localStorage.setItem('manualHintSeen', '1'), { once: true });
  if (dialog.showModal) dialog.showModal();
  else localStorage.setItem('manualHintSeen', '1');
}

(async function boot() {
  document.getElementById('themeToggle').onclick = toggleTheme;
  document.getElementById('themeToggle').title = 'ライト / ダーク / ネオン';

  applyTheme();
  initNav();
  renderPage();

  try {
    await refreshAllData();
  } catch (error) {
    console.error('[boot] initial data refresh failed:', error);
  }

  showManualHintDialog();
  renderPage();
})();
