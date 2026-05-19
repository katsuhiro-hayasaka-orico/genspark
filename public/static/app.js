const NAV_PAGES = [
  { key: 'import', label: '1. データ取込' },
  { key: 'summary', label: '2. 全体サマリー（月次レポート）' },
  { key: 'trend', label: '3. 推移（前年差／トレンド）' },
  { key: 'category', label: '4. カテゴリ別分析' },
  { key: 'project', label: '5. プロジェクト別コスト管理（新規案件）' },
  { key: 'alert', label: '6. アラート（乖離・変動）' },
  { key: 'vendor', label: '7. ベンダー／契約更新' },
  { key: 'detail', label: '8. 明細（検索・ドリルダウン）' },
  { key: 'settings', label: '9. 表示設定' },
  { key: 'depreciation', label: '11. 減価償却シミュレーション' },
  { key: 'oacis', label: '12. OACIS実績' },
  { key: 'manual', label: '99. 取扱説明書（マニュアル）' },
];

const IMPORT_FILE_TYPE_OPTIONS = [
  { value: 'budget', label: '予実績管理データ' },
  { value: 'variance_reason', label: '差額理由' },
  { value: 'new_project_master', label: '新規案件マスタCSV' },
  { value: 'new_project_monthly_cost', label: '新規案件月次金額CSV' },
  { value: 'new_project_actual_forecast', label: '新規案件CSV（旧形式・互換）' },
  { value: 'oasis_actual', label: 'OACIS実績' },
  { value: 'depreciation_simulation', label: '減価償却シミュレーション' },
];

const IMPORT_STATUS_FILE_TYPES = IMPORT_FILE_TYPE_OPTIONS.map(t => t.value);
const ADDITIONAL_FILE_TYPES = IMPORT_FILE_TYPE_OPTIONS.filter(t => t.value !== 'budget').map(t => t.value);
const NOT_IMPORTED_MESSAGE = '追加データ未取込';
const APP_ZOOM = { min: 75, max: 150, step: 5, defaultValue: 100 };

const state = {
  page: 'import',
  hasData: false,
  data: { status: null, items: [], contracts: [], depreciation: [], oacisActual: null },
  filters: { periodMode: '月次', department: '', perspective: '費目', target: 'すべて', fiscalPeriod: '', targetYearMonth: '' },
  settings: {
    thresholds: { varianceRate: 10, amountGap: 1000, momRate: 10, yoyRate: 10 },
    kpiOrder: ['総予算', '見込み／実績', '予算消化率', '差額', '着地見込み', 'コスト削減効果'],
  },
  ui: {
    theme: localStorage.getItem('theme') || 'light',
    displayZoom: normalizeZoomPercent(localStorage.getItem('displayZoom')),
    categoryTab: 'システム分類名別',
    trendMonths: 12,
    trendMetric: '総額',
    detailSearch: '',
    extraDetailCols: ['owner_name', 'vendor_name', 'budget_category', 'totalForecast'],
    importFileType: 'budget',
    depreciationFilters: { fiscalPeriod: '', categoryName: '' },
  },
};

const fmt = (n) => Number(n || 0).toLocaleString('ja-JP');
const pct = (n) => `${(Number(n || 0)).toFixed(1)}%`;
const yen = (n) => `${fmt(Math.round(Number(n || 0)))} 千円`;
const OKU_YEN_DIVISOR_IN_THOUSAND_YEN = 100000;
const toOkuYen = (thousandYen) => Number(thousandYen || 0) / OKU_YEN_DIVISOR_IN_THOUSAND_YEN;
const formatOkuYenValue = (n) => Number(n || 0).toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const okuYen = (n) => `${formatOkuYenValue(n)}億円`;
const formatFixedOneDecimal = (n) => Number(n || 0).toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const okuYenFixed = (n) => `${formatFixedOneDecimal(n)}億円`;
const MONTHLY_AXIS_SCALE_OKU_YEN = { min: 0, max: 40, stepSize: 5 };
const CUMULATIVE_AXIS_SCALE_OKU_YEN = { min: 0, max: 400, stepSize: 50 };
const fixedOkuYenTicks = (scaleConfig) => ({
  color: 'var(--text)',
  autoSkip: false,
  stepSize: scaleConfig.stepSize,
  callback: value => okuYen(value),
});
const forceFixedAxisTicks = (scaleConfig) => (scale) => {
  scale.ticks = Array.from(
    { length: Math.floor((scaleConfig.max - scaleConfig.min) / scaleConfig.stepSize) + 1 },
    (_, idx) => ({ value: scaleConfig.min + idx * scaleConfig.stepSize }),
  );
};
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


function normalizeZoomPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return APP_ZOOM.defaultValue;
  const roundedToStep = Math.round(numeric / APP_ZOOM.step) * APP_ZOOM.step;
  return Math.min(APP_ZOOM.max, Math.max(APP_ZOOM.min, roundedToStep));
}

function updateZoomControls() {
  const zoomLabel = `${state.ui.displayZoom}%`;
  const value = document.getElementById('zoomValue');
  if (value) value.textContent = zoomLabel;

  const zoomOut = document.getElementById('zoomOut');
  if (zoomOut) zoomOut.disabled = state.ui.displayZoom <= APP_ZOOM.min;

  const zoomIn = document.getElementById('zoomIn');
  if (zoomIn) zoomIn.disabled = state.ui.displayZoom >= APP_ZOOM.max;

  const range = document.getElementById('zoomRange');
  if (range) range.value = state.ui.displayZoom;

  const number = document.getElementById('zoomNumber');
  if (number) number.value = state.ui.displayZoom;

  const settingLabel = document.getElementById('zoomSettingValue');
  if (settingLabel) settingLabel.textContent = zoomLabel;
}

function applyDisplayZoom() {
  state.ui.displayZoom = normalizeZoomPercent(state.ui.displayZoom);
  document.body.style.zoom = String(state.ui.displayZoom / 100);
  document.documentElement.style.setProperty('--app-zoom', String(state.ui.displayZoom / 100));
  localStorage.setItem('displayZoom', String(state.ui.displayZoom));
  updateZoomControls();
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}

function setDisplayZoom(value) {
  state.ui.displayZoom = normalizeZoomPercent(value);
  applyDisplayZoom();
}

function changeDisplayZoom(delta) {
  setDisplayZoom(state.ui.displayZoom + delta);
}

function handleZoomShortcut(event) {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key === '+' || event.key === '=' || event.key === 'Add') {
    event.preventDefault();
    changeDisplayZoom(APP_ZOOM.step);
  } else if (event.key === '-' || event.key === '_' || event.key === 'Subtract') {
    event.preventDefault();
    changeDisplayZoom(-APP_ZOOM.step);
  } else if (event.key === '0') {
    event.preventDefault();
    setDisplayZoom(APP_ZOOM.defaultValue);
  }
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
  updateZoomControls();
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
  nav.innerHTML = NAV_PAGES.map(p => `<button class="nav-item ${p.key === state.page ? 'active' : ''}" data-page="${dataAttr(p.key)}" ${!state.hasData && !['import', 'settings', 'manual'].includes(p.key) ? 'disabled' : ''}>${escapeHtml(p.label)}</button>`).join('');
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
  const [status, itemsRes, contractsRes, depreciationRes, oacisActualRes] = await Promise.all([
    api('/status'),
    api('/items'),
    api('/contracts').catch(() => ({ data: [] })),
    api('/additional-data/depreciation_simulation').catch(() => ({ data: [] })),
    api('/analysis/oacis-actual').catch(() => ({ summary: null, byExpenseEvent: [], bySupplier: [], byYojitsuNo: [], missingYojitsuNoRows: [] })),
  ]);
  state.hasData = !!status.hasData;
  state.data.status = status;
  state.data.items = itemsRes.items || [];
  state.data.contracts = contractsRes.data || [];
  state.data.depreciation = depreciationRes.data || [];
  state.data.oacisActual = oacisActualRes || null;
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
  return `<div class="additional-status-grid">${IMPORT_STATUS_FILE_TYPES.map((fileType) => {
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
  const monthlyPlan = reportSeries.plan.map(toOkuYen);
  const monthlyActualForecast = reportSeries.actualForecast.map(toOkuYen);
  const planCumulative = reportSeries.planCumulative.map(toOkuYen);
  const actualForecastCumulative = reportSeries.actualForecastCumulative.map(toOkuYen);
  new Chart(el, {
    type: 'bar',
    data: {
      labels: reportSeries.labels,
      datasets: [
        {
          type: 'bar',
          label: '月次計画（億円）',
          data: monthlyPlan,
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
          label: '月次見込み／実績（億円）',
          data: monthlyActualForecast,
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
          label: '計画累計（億円）',
          data: planCumulative,
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
          label: '見込み／実績累計（億円）',
          data: actualForecastCumulative,
          yAxisID: 'y1',
          hidden: false,
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
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${okuYenFixed(ctx.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: 'var(--text)' }, grid: { color: 'var(--line)' } },
        y: {
          position: 'left',
          title: { display: true, text: '単月値（億円）', color: 'var(--text)' },
          beginAtZero: true,
          min: MONTHLY_AXIS_SCALE_OKU_YEN.min,
          max: MONTHLY_AXIS_SCALE_OKU_YEN.max,
          ticks: fixedOkuYenTicks(MONTHLY_AXIS_SCALE_OKU_YEN),
          afterBuildTicks: forceFixedAxisTicks(MONTHLY_AXIS_SCALE_OKU_YEN),
          grid: { color: 'var(--line)' },
        },
        y1: {
          position: 'right',
          display: true,
          title: { display: true, text: '累計値（億円）', color: 'var(--text)' },
          beginAtZero: true,
          min: CUMULATIVE_AXIS_SCALE_OKU_YEN.min,
          max: CUMULATIVE_AXIS_SCALE_OKU_YEN.max,
          ticks: fixedOkuYenTicks(CUMULATIVE_AXIS_SCALE_OKU_YEN),
          afterBuildTicks: forceFixedAxisTicks(CUMULATIVE_AXIS_SCALE_OKU_YEN),
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
            <button id="clearBrowserDataBtn" type="button">ブラウザ保存データをクリア</button>
          </div>
        </section>
      </div>
      <div id="importSummary"></div>
      <div id="importErrors"></div>
      <div class="panel"><h4>取込状況</h4>${additionalStatusListHtml()}</div>
    </div>`;

  const fileInput = document.getElementById('csvFile');
  const uploadBtn = document.getElementById('uploadBtn');
  const fileTypeSelect = document.getElementById('fileTypeSelect');
  const summaryEl = document.getElementById('importSummary');
  const errorsEl = document.getElementById('importErrors');
  const clearBrowserDataBtn = document.getElementById('clearBrowserDataBtn');
  let file = null;

  fileTypeSelect.onchange = () => {
    state.ui.importFileType = fileTypeSelect.value;
    if (file) preview(file);
  };

  const preview = async (f) => {
    file = f;
    const selectedType = fileTypeSelect.value;
    if (selectedType !== 'budget') {
      const isDep = selectedType === 'depreciation_simulation';
      summaryEl.innerHTML = `<div class="panel"><h4>追加データプレビュー</h4><p>${escapeHtml(IMPORT_FILE_TYPE_OPTIONS.find(t => t.value === selectedType)?.label || selectedType)}を取り込みます。${isDep ? 'CSVのロング形式（区分,償却展開区分,償却展開区分名,期間種別,期,月,金額）をそのまま専用ビューで集計します。' : '結合キーは management_no（管理番号）です。新規案件は2ファイル構成（マスタ＋月次金額）を優先します。'}</p></div>`;
      errorsEl.innerHTML = `<div class="panel"><h4>エラーパネル（表示のみ）</h4>${isDep ? '減価償却シミュレーション.csv は指定レイアウト（区分,償却展開区分,償却展開区分名,期間種別,期,月,金額）で取り込みます。' : '新規案件マスタCSV: 管理番号,案件名,案件担当者,本番開始予定日,IT投資シミュレーション№,進捗状況,予算有り,5年経費合計,案件区分,memo。新規案件月次金額CSV: 管理番号,経費事象,対象年月,予算金額,見込金額(任意:投資運用区分)。'}</div>`;
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

  uploadBtn.onclick = async () => {
    if (!file) return;
    const selectedType = fileTypeSelect.value;
    const fd = new FormData();
    fd.append('budget_csv', file);
    fd.append('fileType', selectedType);

    const sizeMb = (file.size || 0) / (1024 * 1024);
    const showProgress = sizeMb >= 5;
    uploadBtn.disabled = true;
    if (showProgress) {
      summaryEl.innerHTML = `<div class="panel"><h4>取込進捗</h4><p id="uploadProgressText">アップロード準備中…</p><progress id="uploadProgressBar" max="100" value="0" style="width:100%"></progress></div>`;
    }

    const postUploadWithProgress = () => new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.responseType = 'json';
      xhr.upload.onprogress = (event) => {
        if (!showProgress || !event.lengthComputable) return;
        const ratio = Math.min(100, Math.round((event.loaded / event.total) * 100));
        const bar = document.getElementById('uploadProgressBar');
        const text = document.getElementById('uploadProgressText');
        if (bar) bar.value = ratio;
        if (text) text.textContent = `アップロード中… ${ratio}% (${fmt(Math.round(event.loaded / 1024))}KB / ${fmt(Math.round(event.total / 1024))}KB)`;
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response || JSON.parse(xhr.responseText || '{}'));
        else reject(new Error((xhr.response && xhr.response.error) || `API Error ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('アップロードに失敗しました'));
      xhr.send(fd);
    });

    try {
      const result = await postUploadWithProgress();
      if (showProgress) {
        const text = document.getElementById('uploadProgressText');
        const bar = document.getElementById('uploadProgressBar');
        if (bar) bar.value = 100;
        if (text) text.textContent = 'アップロード完了。データを反映中…';
      }
      await refreshAllData();
      if (selectedType === 'budget') goPage('summary');
      else if (selectedType === 'depreciation_simulation' && result.status === 'imported') goPage('depreciation');
      else if (selectedType === 'oasis_actual' && result.status === 'imported') goPage('oacis');
      else if (['new_project_actual_forecast', 'new_project_master', 'new_project_monthly_cost'].includes(selectedType) && result.status === 'imported') goPage('project');
      else {
        renderImport();
        document.getElementById('importSummary').innerHTML = `<div class="panel"><h4>取込結果</h4><p>${escapeHtml(result.message || '')}</p><p>ステータス: ${escapeHtml(result.status || '')} / ${fmt(result.rowCount || 0)}件</p></div>`;
      }
    } catch (error) {
      errorsEl.innerHTML = `<div class="panel"><h4>エラーパネル</h4><p class="warn">${escapeHtml(error.message || '取込に失敗しました')}</p></div>`;
    } finally {
      uploadBtn.disabled = false;
    }
  };

  clearBrowserDataBtn.onclick = async () => {
    if (!window.confirm('ブラウザ保存データと取込済みデータをクリアします。よろしいですか？')) return;
    localStorage.clear();
    state.ui.theme = 'light';
    state.ui.importFileType = 'budget';
    state.ui.detailSearch = '';
    state.ui.detailFilter = null;
    await api('/clear', { method: 'POST' });
    await refreshAllData();
    renderImport();
    document.getElementById('importSummary').innerHTML = '<div class="panel"><h4>クリア完了</h4><p>ブラウザ保存データと取込済みデータをクリアしました。</p></div>';
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
  const payload = await api('/analysis/new-project-costs').catch(() => null);
  if (!payload) return void (content.innerHTML = '<div class="panel"><p>新規案件予算見込CSVが未取込です。</p></div>');

  const summary = payload.summary || {}; const rankingBase = payload.projectRanking || []; const detailBase = payload.detailRows || [];
  const filterState = { targetMonth:'', projectCategory:'', itInvestmentNo:'', owner:'', progressStatus:'', costGroup:'', varianceReason:'', keyword:'', rankSort:'variance' };
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ja'));

  const options = {
    targetMonth: uniq(detailBase.map(r=>r.targetMonth)), projectCategory: uniq(detailBase.map(r=>r.projectCategory)), itInvestmentNo: uniq(detailBase.map(r=>r.itInvestmentNo)), owner: uniq(detailBase.map(r=>r.owner)),
    progressStatus: uniq(detailBase.map(r=>r.progressStatus)), costGroup: uniq(detailBase.map(r=>r.costGroup)), varianceReason: uniq(detailBase.map(r=>r.varianceReason)),
  };

  content.innerHTML = `<section class="panel new-project-cost-page"><div class="card-title-row"><div><h3>プロジェクト別コスト管理（新規案件）</h3><p class="muted">進捗率は進捗状況からの簡易換算値です。差額理由は進捗状況/memoからの簡易分類です。</p></div><span class="badge">5番画面 強化版</span></div>
  <div class="controls">${['targetMonth','projectCategory','itInvestmentNo','owner','progressStatus','costGroup','varianceReason'].map(k=>`<label>${k}<select id="npf_${k}"><option value="">全て</option>${options[k].map(v=>`<option>${escapeHtml(v)}</option>`).join('')}</select></label>`).join('')}<label>検索<input id="npf_keyword" type="text" placeholder="管理番号/案件名"></label></div>
  <div id="np_kpi" class="kpi-strip new-project-kpi"></div>
  <div class="new-project-cost-grid grid-2"><div class="panel new-project-ranking"><div class="card-title-row"><h4>差額ランキング</h4><select id="np_rank_sort"><option value="variance">差額順</option><option value="rate">差額率順</option><option value="forecast">見込金額順</option></select></div><div class="table-wrap"><table><thead><tr><th>#</th><th>管理番号</th><th>案件名</th><th class="right">予算</th><th class="right">見込</th><th class="right">差額</th><th class="right">差額率</th><th>差額理由</th></tr></thead><tbody id="np_rank_rows"></tbody></table></div></div>
  <div class="panel new-project-scatter"><h4>進捗率 × コスト消化率</h4><div style="height:300px"><canvas id="np_scatter"></canvas></div><p class="muted">左上は要確認（進捗低・消化高）/ 右下は進捗先行の可能性。</p></div></div>
  <div class="new-project-cost-grid grid-2"><div class="panel new-project-cost-compare"><div class="card-title-row"><h4>区分別 投資・運用比較</h4><select id="np_compare_mode"><option value="category">案件区分別</option><option value="it">IT投資シミュレーション№別</option><option value="group">投資運用区分別</option></select></div><div class="table-wrap"><table><thead><tr><th>区分</th><th class="right">投資見込</th><th class="right">運用見込</th><th class="right">差額</th></tr></thead><tbody id="np_compare_rows"></tbody></table></div></div>
  <div class="panel new-project-variance-reason"><h4>差額理由サマリー</h4><div class="table-wrap"><table><thead><tr><th>理由</th><th class="right">件数</th><th class="right">差額</th><th>主案件</th></tr></thead><tbody id="np_reason_rows"></tbody></table></div></div></div>
  <div class="panel new-project-detail-table"><h4>詳細テーブル</h4><div class="table-wrap"><table><thead><tr><th>管理番号</th><th>案件名</th><th>担当</th><th>対象年月</th><th>区分</th><th>進捗</th><th class="right">進捗率</th><th class="right">予算</th><th class="right">見込</th><th class="right">差額</th><th class="right">差額率</th><th class="right">消化率</th><th>理由</th><th>memo</th></tr></thead><tbody id="np_detail_rows"></tbody></table></div></div></section>`;

  let scatterChart = null;
  const getFiltered = () => detailBase.filter(r => (!filterState.targetMonth || r.targetMonth===filterState.targetMonth) && (!filterState.projectCategory || r.projectCategory===filterState.projectCategory) && (!filterState.itInvestmentNo || r.itInvestmentNo===filterState.itInvestmentNo) && (!filterState.owner || r.owner===filterState.owner) && (!filterState.progressStatus || r.progressStatus===filterState.progressStatus) && (!filterState.costGroup || r.costGroup===filterState.costGroup) && (!filterState.varianceReason || r.varianceReason===filterState.varianceReason) && (!filterState.keyword || `${r.managementNo} ${r.projectName}`.toLowerCase().includes(filterState.keyword.toLowerCase())));

  const renderAll = () => {
    const drows = getFiltered();
    const pmap = new Map(); drows.forEach(r=>{ const k=r.managementNo||'未設定'; if(!pmap.has(k)) pmap.set(k,{...r,budgetAmount:0,forecastAmount:0,varianceAmount:0}); const p=pmap.get(k); p.budgetAmount+=Number(r.budgetAmount||0); p.forecastAmount+=Number(r.forecastAmount||0); p.varianceAmount+=Number(r.varianceAmount||0); p.varianceRate=p.budgetAmount?p.varianceAmount/p.budgetAmount:null; p.costConsumptionRate=p.budgetAmount?(p.forecastAmount/p.budgetAmount)*100:null;});
    let prows=[...pmap.values()];
    if (filterState.rankSort==='rate') prows.sort((a,b)=>Math.abs(b.varianceRate||0)-Math.abs(a.varianceRate||0)); else if (filterState.rankSort==='forecast') prows.sort((a,b)=>b.forecastAmount-a.forecastAmount); else prows.sort((a,b)=>Math.abs(b.varianceAmount)-Math.abs(a.varianceAmount));
    const top=prows.slice(0,20);
    document.getElementById('np_rank_rows').innerHTML = top.map((r,i)=>`<tr class="clickable-row" data-management="${dataAttr(r.managementNo)}"><td>${i+1}</td><td>${escapeHtml(r.managementNo)}</td><td>${escapeHtml(r.projectName)}</td><td class="right">${yen(r.budgetAmount)}</td><td class="right">${yen(r.forecastAmount)}</td><td class="right ${r.varianceAmount>0?'variance-positive':r.varianceAmount<0?'variance-negative':'variance-neutral'}">${yen(r.varianceAmount)}</td><td class="right">${r.varianceRate==null?'-':pct(r.varianceRate*100)}</td><td>${displayHtml(r.varianceReason)}</td></tr>`).join('');
    const s={...summary, projectCount:prows.length, totalBudget:prows.reduce((a,b)=>a+b.budgetAmount,0), totalForecast:prows.reduce((a,b)=>a+b.forecastAmount,0), totalVariance:prows.reduce((a,b)=>a+b.varianceAmount,0)}; s.varianceRate=s.totalBudget?s.totalVariance/s.totalBudget:null;
    document.getElementById('np_kpi').innerHTML=[['新規案件数',fmt(s.projectCount)],['5年経費合計',yen(summary.totalFiveYearCost||0)],['当期予算額',yen(s.totalBudget)],['見込金額',yen(s.totalForecast)],['差額',yen(s.totalVariance)],['差額率',s.varianceRate==null?'-':pct(s.varianceRate*100)],['投資系金額',yen(summary.investmentAmount||0)],['運用系金額',yen(summary.operationAmount||0)],['差額発生案件数',fmt(summary.varianceProjectCount||0)],['未着手案件数',fmt(summary.notStartedProjectCount||0)],['要確認案件数',fmt(summary.alertProjectCount||0)]].map(([l,v])=>`<article class="kpi"><div class="label">${l}</div><div class="value">${v}</div></article>`).join('');
    document.getElementById('np_detail_rows').innerHTML=drows.slice(0,500).map(r=>`<tr class="${Math.abs(r.varianceAmount)>1000000?'warning-row':''}" data-management="${dataAttr(r.managementNo)}"><td>${escapeHtml(r.managementNo)}</td><td>${escapeHtml(r.projectName)}</td><td>${escapeHtml(r.owner||'')}</td><td>${escapeHtml(r.targetMonth||'')}</td><td>${escapeHtml(r.projectCategory||'')}</td><td>${escapeHtml(r.progressStatus||'')}</td><td class="right">${r.progressRate??'-'}</td><td class="right">${yen(r.budgetAmount)}</td><td class="right">${yen(r.forecastAmount)}</td><td class="right ${r.varianceAmount>0?'variance-positive':r.varianceAmount<0?'variance-negative':'variance-neutral'}">${yen(r.varianceAmount)}</td><td class="right">${r.varianceRate==null?'-':pct(r.varianceRate*100)}</td><td class="right ${r.alertLevel==='watch'?'alert-level-watch':r.alertLevel==='alert'?'alert-level-alert':r.alertLevel==='progressAhead'?'alert-level-progress-ahead':''}">${r.costConsumptionRate==null?'-':pct(r.costConsumptionRate)}</td><td>${displayHtml(r.varianceReason)}</td><td>${displayHtml(r.memo)}</td></tr>`).join('');
    const scatterData=top.filter(r=>r.progressRate!=null&&r.costConsumptionRate!=null).map(r=>({x:r.progressRate,y:r.costConsumptionRate,r:5}));
    if (scatterChart) scatterChart.destroy();
    scatterChart=new Chart(document.getElementById('np_scatter'),{type:'bubble',data:{datasets:[{label:'案件',data:scatterData,backgroundColor:'rgba(251,91,1,.45)'}]},options:baseChartOptions({scales:{x:{title:{display:true,text:'進捗率(%)'}},y:{title:{display:true,text:'コスト消化率(%)'}}}})});
    const compareMode = document.getElementById('np_compare_mode').value; let compareRows=[];
    if(compareMode==='category') compareRows=payload.byProjectCategory||[]; else if(compareMode==='it') compareRows=payload.byItInvestmentNo||[]; else compareRows=(payload.byCostGroup||[]).map(v=>({label:v.costGroup,investmentForecastAmount:(v.costGroup||'').includes('投資')?v.forecastAmount:0,operationForecastAmount:(v.costGroup||'').includes('運用')?v.forecastAmount:0,varianceAmount:v.varianceAmount}));
    document.getElementById('np_compare_rows').innerHTML=compareRows.map(v=>{const label=v.projectCategory||v.itInvestmentNo||v.label||v.costGroup; return `<tr><td>${escapeHtml(label)}</td><td class="right">${yen(v.investmentForecastAmount||0)}</td><td class="right">${yen(v.operationForecastAmount||0)}</td><td class="right">${yen(v.varianceAmount||0)}</td></tr>`;}).join('');
    document.getElementById('np_reason_rows').innerHTML=(payload.byVarianceReason||[]).map(r=>`<tr><td>${escapeHtml(r.varianceReason)}</td><td class="right">${fmt(r.projectCount)}</td><td class="right">${yen(r.varianceAmount)}</td><td>${escapeHtml((r.mainProjects||[]).join(' / '))}</td></tr>`).join('');
    document.querySelectorAll('[data-management]').forEach(el=>el.onclick=()=>{const mid=el.dataset.management; const hit=document.querySelector(`#np_detail_rows tr[data-management="${CSS.escape(mid)}"]`); if(hit){hit.scrollIntoView({behavior:'smooth',block:'center'}); hit.classList.add('warning-row'); setTimeout(()=>hit.classList.remove('warning-row'),1200);} });
  };

  Object.keys(options).forEach(k=>document.getElementById(`npf_${k}`).onchange=e=>{filterState[k]=e.target.value; renderAll();});
  document.getElementById('npf_keyword').oninput=e=>{filterState.keyword=e.target.value; renderAll();};
  document.getElementById('np_rank_sort').onchange=e=>{filterState.rankSort=e.target.value; renderAll();};
  document.getElementById('np_compare_mode').onchange=renderAll;
  renderAll();
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
      <div class="panel detail-pane" id="detailPane"><h4>詳細ペイン</h4><p>行クリックで月次データを表示します。</p></div>
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
      const monthlyRows = Object.entries(row.monthly || {}).sort(([a], [b]) => a.localeCompare(b)).map(([ym, m]) => `<tr><td>${escapeHtml(formatYearMonth(ym))}</td><td class="right">${yen(m.plan)}</td><td class="right">${yen(m.forecast)}</td><td class="right">${yen(m.actual)}</td><td>${monthlyCommentHtml(m, row)}</td></tr>`).join('');
      document.getElementById('detailPane').innerHTML = `<h4>詳細ペイン</h4><div class="table-wrap"><table><thead><tr><th>年月</th><th class="right">計画</th><th class="right">見込</th><th class="right">実績</th><th>コメント</th></tr></thead><tbody>${monthlyRows || '<tr><td colspan="5">月次データなし</td></tr>'}</tbody></table></div>`;
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
      <h4>表示倍率</h4>
      <p class="muted">Electron版でブラウザのZoomが使えない場合でも、ダッシュボード全体を75%〜150%の範囲で拡大・縮小できます。Ctrl/Cmd + +・-・0 のショートカットにも対応しています。</p>
      <div class="controls zoom-settings">
        <label class="zoom-range-label">全体表示倍率 <span id="zoomSettingValue" class="badge">${state.ui.displayZoom}%</span>
          <input id="zoomRange" type="range" min="${APP_ZOOM.min}" max="${APP_ZOOM.max}" step="${APP_ZOOM.step}" value="${state.ui.displayZoom}">
        </label>
        <label>倍率（%） <input id="zoomNumber" type="number" min="${APP_ZOOM.min}" max="${APP_ZOOM.max}" step="${APP_ZOOM.step}" value="${state.ui.displayZoom}"></label>
        <button id="zoomSettingReset" type="button">100%に戻す</button>
      </div>
    </div>
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
  document.getElementById('zoomRange').oninput = (e) => setDisplayZoom(e.target.value);
  document.getElementById('zoomNumber').onchange = (e) => setDisplayZoom(e.target.value);
  document.getElementById('zoomSettingReset').onclick = () => setDisplayZoom(APP_ZOOM.defaultValue);
  updateZoomControls();
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
      <h4>5. プロジェクト別コスト管理（新規案件）</h4>
      <ul><li><b>見るポイント：</b>新規案件の予算規模、見込乖離、進捗。</li><li><b>操作：</b>対象フィルタで新規案件に絞り、案件別に優先度を判断。</li></ul>
      <h4>6. アラート（乖離・変動）</h4>
      <ul><li><b>見るポイント：</b>乖離率・差額・前月比・前年比のしきい値超過。</li><li><b>操作：</b>9. 表示設定でしきい値を調整し、重要アラートのみ抽出。</li></ul>
      <h4>7. ベンダー／契約更新</h4>
      <ul><li><b>見るポイント：</b>ベンダー別支出、契約更新時期、集中リスク。</li><li><b>操作：</b>ベンダー単位で並べ替え、更新月の重なりを確認。</li></ul>
      <h4>8. 明細（検索・ドリルダウン）</h4>
      <ul><li><b>見るポイント：</b>案件単位の実績・見込・担当者・ベンダー情報。</li><li><b>操作：</b>キーワード検索、列表示切替、他画面からのドリルダウン確認。</li></ul>
      <h4>9. 表示設定</h4>
      <ul><li><b>見るポイント：</b>アラート判定に使うしきい値、KPI表示順、表示倍率。</li><li><b>操作：</b>しきい値・KPI順・表示倍率（75%〜150%）・テーマ（ライト/ダーク/ネオン）を変更して反映。表示倍率は上部バーやCtrl/Cmd + +・-・0でも操作できます。</li></ul>
      <h4>11. 減価償却シミュレーション</h4>
      <ul><li><b>見るポイント：</b>減価償却の展開区分ごとの月次推移と期別合計。</li><li><b>操作：</b>対象期・区分を切替えて、償却影響の山谷を確認。</li></ul>
      <h4>12. OACIS実績</h4>
      <ul><li><b>見るポイント：</b>OACIS取り込み実績と費目/取引先の集計。</li><li><b>操作：</b>実績データの偏りや未紐づき行を確認し、明細精査へ連携。</li></ul>
      <h4>99. 取扱説明書（マニュアル）</h4>
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


function depreciationAmount(row) {
  return Number(row.amount || 0);
}

function depreciationPeriodSortValue(value) {
  const n = Number(String(value || '').replace(/期$/, ''));
  return Number.isFinite(n) ? n : 0;
}

function depreciationMonthSortValue(row = {}) {
  if (Number.isFinite(Number(row.month_order))) return Number(row.month_order);
  const monthKey = String(row.month_key || '').trim();
  if (/^\d{6}$/.test(monthKey)) {
    const month = Number(monthKey.slice(4, 6));
    return month >= 4 ? month - 4 : month + 8;
  }
  const raw = String(row.month || '').trim().toUpperCase();
  if (raw === 'H1') return 0;
  if (raw === 'H2') return 6;
  if (raw === 'FY') return 12;
  return 99;
}

function depreciationMonthLabel(row = {}) {
  const monthKey = String(row.month_key || '').trim();
  if (/^\d{6}$/.test(monthKey)) return `${Number(monthKey.slice(4, 6))}月`;
  return String(row.month || '-');
}

function normalizeDepreciationFilters(rows) {
  const periods = [...new Set(rows.map(r => String(r.fiscal_period || '')).filter(Boolean))]
    .sort((a, b) => depreciationPeriodSortValue(a) - depreciationPeriodSortValue(b));
  const names = [...new Set(rows.map(r => r.depreciation_category_name || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
  const filters = state.ui.depreciationFilters || (state.ui.depreciationFilters = { fiscalPeriod: '', categoryName: '' });
  if (!filters.fiscalPeriod || (periods.length && !periods.includes(filters.fiscalPeriod))) filters.fiscalPeriod = periods.includes('70') ? '70' : (periods[periods.length - 1] || '');
  if (filters.categoryName && !names.includes(filters.categoryName)) filters.categoryName = '';
  return { periods, names, filters };
}

function depreciationRowsForFilter(rows, filters) {
  return rows.filter(row => {
    if (filters.fiscalPeriod && String(row.fiscal_period || '') !== String(filters.fiscalPeriod)) return false;
    if (filters.categoryName && String(row.depreciation_category_name || '') !== String(filters.categoryName)) return false;
    return true;
  });
}

function sumDepreciation(rows, periodType, fiscalPeriod) {
  return rows
    .filter(row => (!periodType || row.period_type === periodType) && (!fiscalPeriod || String(row.fiscal_period || '') === String(fiscalPeriod)))
    .reduce((sum, row) => sum + depreciationAmount(row), 0);
}

function buildDepreciationDetailRows(allRows, fiscalPeriod, categoryName) {
  const selectedRows = allRows.filter(row => String(row.fiscal_period || '') === String(fiscalPeriod) && (!categoryName || row.depreciation_category_name === categoryName));
  const previousPeriod = String(depreciationPeriodSortValue(fiscalPeriod) - 1);
  const previousRows = allRows.filter(row => String(row.fiscal_period || '') === previousPeriod && (!categoryName || row.depreciation_category_name === categoryName));
  const bucket = new Map();
  const keyFor = row => [row.division || '', row.depreciation_category || '', row.depreciation_category_name || '未入力'].join('\u0001');
  const ensure = (row) => {
    const key = keyFor(row);
    if (!bucket.has(key)) bucket.set(key, {
      division: row.division || '',
      depreciation_category: row.depreciation_category || '',
      depreciation_category_name: row.depreciation_category_name || '未入力',
      h1: 0,
      h2: 0,
      full: 0,
      previousFull: 0,
    });
    return bucket.get(key);
  };
  selectedRows.forEach(row => {
    const item = ensure(row);
    if (row.period_type === 'half' && String(row.month || '').toUpperCase() === 'H1') item.h1 += depreciationAmount(row);
    if (row.period_type === 'half' && String(row.month || '').toUpperCase() === 'H2') item.h2 += depreciationAmount(row);
    if (row.period_type === 'full') item.full += depreciationAmount(row);
  });
  previousRows.filter(row => row.period_type === 'full').forEach(row => { ensure(row).previousFull += depreciationAmount(row); });
  return [...bucket.values()].map(item => ({
    ...item,
    previousDiff: item.full - item.previousFull,
    previousDiffRate: item.previousFull ? (item.full - item.previousFull) / item.previousFull * 100 : 0,
  })).sort((a, b) => Math.abs(b.previousDiff) - Math.abs(a.previousDiff));
}

function drawDepreciationMonthlyChart(canvasId, rows) {
  const monthly = [...rows.filter(row => row.period_type === 'month')].sort((a, b) => depreciationMonthSortValue(a) - depreciationMonthSortValue(b));
  const bucket = new Map();
  monthly.forEach(row => {
    const key = row.month_key || row.month;
    if (!bucket.has(key)) bucket.set(key, { label: depreciationMonthLabel(row), order: depreciationMonthSortValue(row), amount: 0 });
    bucket.get(key).amount += depreciationAmount(row);
  });
  let cumulative = 0;
  const series = [...bucket.values()].sort((a, b) => a.order - b.order).map(item => {
    cumulative += item.amount;
    return { ...item, cumulative };
  });
  const el = document.getElementById(canvasId);
  if (!el) return;
  const monthlyAmounts = series.map(v => toOkuYen(v.amount));
  const cumulativeAmounts = series.map(v => toOkuYen(v.cumulative));
  const colors = chartColors();
  new Chart(el, {
    type: 'bar',
    data: {
      labels: series.map(v => v.label),
      datasets: [
        { type: 'bar', label: '月次償却費（億円）', data: monthlyAmounts, backgroundColor: colors.c1, borderColor: colors.c1, yAxisID: 'y', order: 2 },
        { type: 'line', label: '累計償却費（億円）', data: cumulativeAmounts, borderColor: colors.c3, backgroundColor: colors.c3, yAxisID: 'y1', hidden: false, tension: 0.25, order: 1 },
      ],
    },
    options: baseChartOptions({ maintainAspectRatio: false, responsive: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: true, labels: { color: 'var(--text)' } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${okuYenFixed(ctx.parsed.y)}` } } }, scales: { x: { ticks: { color: 'var(--text)' }, grid: { color: 'var(--line)' } }, y: { position: 'left', title: { display: true, text: '単月値（億円）', color: 'var(--text)' }, beginAtZero: true, min: MONTHLY_AXIS_SCALE_OKU_YEN.min, max: MONTHLY_AXIS_SCALE_OKU_YEN.max, ticks: fixedOkuYenTicks(MONTHLY_AXIS_SCALE_OKU_YEN), afterBuildTicks: forceFixedAxisTicks(MONTHLY_AXIS_SCALE_OKU_YEN), grid: { color: 'var(--line)' } }, y1: { beginAtZero: true, position: 'right', title: { display: true, text: '累計値（億円）', color: 'var(--text)' }, min: CUMULATIVE_AXIS_SCALE_OKU_YEN.min, max: CUMULATIVE_AXIS_SCALE_OKU_YEN.max, ticks: fixedOkuYenTicks(CUMULATIVE_AXIS_SCALE_OKU_YEN), afterBuildTicks: forceFixedAxisTicks(CUMULATIVE_AXIS_SCALE_OKU_YEN), grid: { drawOnChartArea: false } } } }),
  });
}

function drawDepreciationBarChart(canvasId, labels, values, label) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const colors = chartColors();
  new Chart(el, { type: 'bar', data: { labels, datasets: [{ label, data: values, backgroundColor: colors.c2, borderColor: colors.c1, borderWidth: 1 }] }, options: baseChartOptions({ indexAxis: labels.length > 8 ? 'y' : 'x', maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => yen(ctx.parsed.x ?? ctx.parsed.y) } } }, scales: { x: { beginAtZero: true, ticks: { color: 'var(--text)', callback: value => fmt(value) }, grid: { color: 'var(--line)' } }, y: { beginAtZero: true, ticks: { color: 'var(--text)' }, grid: { color: 'var(--line)' } } } }) });
}

function renderDepreciation() {
  const rows = state.data.depreciation || [];
  const content = document.getElementById('content');
  if (!rows.length) {
    content.innerHTML = `<div class="notice notice--empty">減価償却シミュレーションCSVが未取込です。「1. データ取込」でファイル種別「減価償却シミュレーション」を選択してCSVを取り込んでください。</div>`;
    return;
  }

  const { periods, names, filters } = normalizeDepreciationFilters(rows);
  const scoped = depreciationRowsForFilter(rows, filters);
  const selectedPeriod = filters.fiscalPeriod;
  const previousPeriod = String(depreciationPeriodSortValue(selectedPeriod) - 1);
  const full = sumDepreciation(scoped, 'full', selectedPeriod);
  const h1 = scoped.filter(row => row.period_type === 'half' && String(row.month || '').toUpperCase() === 'H1').reduce((s, r) => s + depreciationAmount(r), 0);
  const h2 = scoped.filter(row => row.period_type === 'half' && String(row.month || '').toUpperCase() === 'H2').reduce((s, r) => s + depreciationAmount(r), 0);
  const previousFull = sumDepreciation(rows.filter(row => !filters.categoryName || row.depreciation_category_name === filters.categoryName), 'full', previousPeriod);
  const detailRows = buildDepreciationDetailRows(rows, selectedPeriod, filters.categoryName);
  const topCategory = [...detailRows].sort((a, b) => b.full - a.full)[0];
  const transitionPeriods = periods.filter(p => depreciationPeriodSortValue(p) >= 65 && depreciationPeriodSortValue(p) <= 70);
  const transitionValues = transitionPeriods.map(p => sumDepreciation(rows.filter(row => !filters.categoryName || row.depreciation_category_name === filters.categoryName), 'full', p));
  const top10 = [...detailRows].sort((a, b) => b.full - a.full).slice(0, 10);
  const diffTop = [...detailRows].sort((a, b) => Math.abs(b.previousDiff) - Math.abs(a.previousDiff)).slice(0, 10);

  content.innerHTML = `
    <div class="panel depreciation-dashboard">
      <div class="card-title-row"><div><p class="eyebrow">Depreciation Simulation</p><h3>減価償却シミュレーション専用ビュー</h3><p class="muted">CSVをロング形式のまま保持し、選択期・償却展開区分名でフロント側集計します。</p></div></div>
      <div class="controls detail-controls">
        <label>期 <select id="depFiscalPeriod">${periods.map(v => optionHtml(v, selectedPeriod)).join('')}</select></label>
        <label>償却展開区分名 <select id="depCategoryName"><option value="">全区分</option>${names.map(v => optionHtml(v, filters.categoryName)).join('')}</select></label>
      </div>
      <div class="kpi-strip">
        <article class="kpi"><div class="label">通期償却費</div><div class="value">${animatedValueHtml(full)}</div><div class="kpi-note">${escapeHtml(selectedPeriod)}期 FY</div></article>
        <article class="kpi"><div class="label">上期償却費</div><div class="value">${animatedValueHtml(h1)}</div><div class="kpi-note">H1</div></article>
        <article class="kpi"><div class="label">下期償却費</div><div class="value">${animatedValueHtml(h2)}</div><div class="kpi-note">H2</div></article>
        <article class="kpi"><div class="label">上期下期差</div><div class="value">${animatedValueHtml(h2 - h1)}</div><div class="kpi-note">下期 - 上期</div></article>
        <article class="kpi"><div class="label">前期差</div><div class="value ${full - previousFull < 0 ? 'ok' : 'warn'}">${animatedValueHtml(full - previousFull)}</div><div class="kpi-note">前期通期 ${yen(previousFull)}</div></article>
        <article class="kpi"><div class="label">最大区分</div><div class="value">${escapeHtml(topCategory?.depreciation_category_name || '-')}</div><div class="kpi-note">${topCategory ? yen(topCategory.full) : '-'}</div></article>
      </div>
    </div>
    <div class="dashboard-bento depreciation-bento">
      <section class="panel bento-card bento-card--wide chart-card"><h3>月次推移（4月〜翌年3月）</h3><div class="chart-frame chart-frame--large"><canvas id="depMonthlyChart"></canvas></div></section>
      <section class="panel bento-card bento-card--small chart-card"><h3>65期〜70期 通期推移</h3><div class="chart-frame"><canvas id="depPeriodChart"></canvas></div></section>
      <section class="panel bento-card bento-card--small ranking-card"><h3>償却展開区分別 Top10</h3><div class="table-wrap"><table><thead><tr><th>区分名</th><th class="right">通期償却費</th></tr></thead><tbody>${top10.map(row => `<tr><td>${escapeHtml(row.depreciation_category_name)}</td><td class="right">${yen(row.full)}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel bento-card bento-card--small ranking-card"><h3>前期差ランキング</h3><div class="table-wrap"><table><thead><tr><th>区分名</th><th class="right">前期差</th><th class="right">差率</th></tr></thead><tbody>${diffTop.map(row => `<tr><td>${escapeHtml(row.depreciation_category_name)}</td><td class="right ${row.previousDiff < 0 ? 'ok' : 'warn'}">${yen(row.previousDiff)}</td><td class="right">${pct(row.previousDiffRate)}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel bento-card bento-card--wide"><h3>半期・通期 / 明細一覧</h3><div class="table-wrap"><table><thead><tr><th>区分</th><th>償却展開区分</th><th>償却展開区分名</th><th class="right">選択期上期</th><th class="right">選択期下期</th><th class="right">選択期通期</th><th class="right">前期通期</th><th class="right">前期差</th><th class="right">前期差率</th></tr></thead><tbody>${detailRows.map(row => `<tr><td>${escapeHtml(row.division)}</td><td>${escapeHtml(row.depreciation_category)}</td><td>${escapeHtml(row.depreciation_category_name)}</td><td class="right">${yen(row.h1)}</td><td class="right">${yen(row.h2)}</td><td class="right">${yen(row.full)}</td><td class="right">${yen(row.previousFull)}</td><td class="right ${row.previousDiff < 0 ? 'ok' : 'warn'}">${yen(row.previousDiff)}</td><td class="right">${pct(row.previousDiffRate)}</td></tr>`).join('')}</tbody></table></div></section>
    </div>`;

  document.getElementById('depFiscalPeriod').onchange = (event) => { state.ui.depreciationFilters.fiscalPeriod = event.target.value; renderPage(); };
  document.getElementById('depCategoryName').onchange = (event) => { state.ui.depreciationFilters.categoryName = event.target.value; renderPage(); };
  animateNumericValues(content);
  drawDepreciationMonthlyChart('depMonthlyChart', scoped);
  drawDepreciationBarChart('depPeriodChart', transitionPeriods.map(p => `${p}期`), transitionValues, '通期償却費');
}

function renderOacisActual() {
  const payload = state.data.oacisActual || { summary: {}, byExpenseEvent: [], bySupplier: [], byYojitsuNo: [], missingYojitsuNoRows: [] };
  const s = payload.summary || {};
  const asPct = v => `${Number(v || 0).toFixed(1)}%`;
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="panel">
      <div class="kpi-strip oacis-kpi-strip">
        <article class="kpi oacis-summary-card"><div class="label">実績合計額</div><div class="value">${yen(s.totalAmount || 0)}</div></article>
        <article class="kpi oacis-summary-card"><div class="label">明細件数</div><div class="value">${fmt(s.rowCount || 0)}</div></article>
        <article class="kpi oacis-summary-card"><div class="label">経費事象数</div><div class="value">${fmt(s.expenseEventCount || 0)}</div></article>
        <article class="kpi oacis-summary-card"><div class="label">サプライヤ数</div><div class="value">${fmt(s.supplierCount || 0)}</div></article>
        <article class="kpi oacis-summary-card"><div class="label">予実番号あり金額</div><div class="value">${yen(s.yojitsuNoPresentAmount || 0)}</div></article>
        <article class="kpi oacis-summary-card"><div class="label">予実番号なし金額</div><div class="value">${yen(s.yojitsuNoMissingAmount || 0)}</div></article>
      </div>
    </div>
    <div class="oacis-ranking-grid">
      <section class="panel bento-card"><h3>経費事象別ランキング（上位20）</h3><div class="table-wrap"><table><thead><tr><th>経費事象コード</th><th>経費事象名</th><th class="right">実績額</th><th class="right">明細件数</th><th class="right">構成比</th></tr></thead><tbody>${(payload.byExpenseEvent || []).map(r => `<tr><td>${escapeHtml(r.expense_event_code || '')}</td><td>${escapeHtml(r.expense_event_name || '')}</td><td class="right">${yen(r.amount || 0)}</td><td class="right">${fmt(r.rowCount || 0)}</td><td class="right">${asPct(r.shareRate)}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel bento-card"><h3>サプライヤ別ランキング（上位20）</h3><div class="table-wrap"><table><thead><tr><th>サプライヤ</th><th class="right">実績額</th><th class="right">明細件数</th><th class="right">構成比</th><th>主な経費事象名</th></tr></thead><tbody>${(payload.bySupplier || []).map(r => `<tr><td>${escapeHtml(r.supplier || '')}</td><td class="right">${yen(r.amount || 0)}</td><td class="right">${fmt(r.rowCount || 0)}</td><td class="right">${asPct(r.shareRate)}</td><td>${escapeHtml(r.mainExpenseEventName || '')}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel bento-card"><h3>予実番号別ランキング（上位20）</h3><div class="table-wrap"><table><thead><tr><th>予実番号</th><th class="right">実績額</th><th class="right">明細件数</th><th>主な経費事象名</th><th>主なサプライヤ</th></tr></thead><tbody>${(payload.byYojitsuNo || []).map(r => `<tr><td>${escapeHtml(r.yojitsu_no || '')}</td><td class="right">${yen(r.amount || 0)}</td><td class="right">${fmt(r.rowCount || 0)}</td><td>${escapeHtml(r.mainExpenseEventName || '')}</td><td>${escapeHtml(r.mainSupplier || '')}</td></tr>`).join('')}</tbody></table></div></section>
    </div>
    <section class="panel bento-card oacis-alert-table"><h3>予実番号未設定（要確認）明細</h3><div class="table-wrap"><table><thead><tr><th>会計日</th><th>実績部店名</th><th>経費事象名</th><th>経費事象細目名</th><th>サプライヤ</th><th class="right">実績額</th><th>仕訳摘要</th><th>仕訳明細摘要</th><th>請求書番号</th></tr></thead><tbody>${(payload.missingYojitsuNoRows || []).map(r => `<tr><td>${escapeHtml(formatYearMonth(r.accounting_date) || r.accounting_date || '')}</td><td>${escapeHtml(r.actual_department_name || '')}</td><td>${escapeHtml(r.expense_event_name || '')}</td><td>${escapeHtml(r.expense_event_detail_name || '')}</td><td>${escapeHtml(r.supplier || '')}</td><td class="right">${yen(r.amount || 0)}</td><td>${escapeHtml(r.journal_summary || '')}</td><td>${escapeHtml(r.journal_detail_summary || '')}</td><td>${escapeHtml(r.invoice_no || '')}</td></tr>`).join('')}</tbody></table></div></section>
  `;
}

async function renderPage() {
  document.getElementById('pageTitle').textContent = NAV_PAGES.find(p => p.key === state.page)?.label || '';
  if (state.page === 'import') return renderImport();
  if (state.page === 'settings') return renderSettings();
  if (state.page === 'manual') return renderManual();
  const hasDepreciationData = (state.data.depreciation || []).length > 0 || state.data.status?.additionalData?.depreciation_simulation?.status === 'imported';
  const hasOacisData = (state.data.oacisActual?.summary?.rowCount || 0) > 0 || state.data.status?.additionalData?.oasis_actual?.status === 'imported';
  if (!state.hasData && !(state.page === 'depreciation' && hasDepreciationData) && !(state.page === 'oacis' && hasOacisData)) return goPage('import');
  if (state.page === 'summary') renderSummary();
  else if (state.page === 'trend') renderTrend();
  else if (state.page === 'category') renderCategory();
  else if (state.page === 'project') renderProject();
  else if (state.page === 'alert') renderAlert();
  else if (state.page === 'vendor') renderVendor();
  else if (state.page === 'detail') renderDetail();
  else if (state.page === 'depreciation') renderDepreciation();
  else if (state.page === 'oacis') renderOacisActual();
  showAdditionalDataNotice();
}

function showManualHintDialog() {
  if (localStorage.getItem('manualHintSeen')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="manualHintDialog" aria-labelledby="manualHintTitle" aria-describedby="manualHintDesc">
      <h3 id="manualHintTitle">初回チュートリアル</h3>
      <p id="manualHintDesc">チュートリアルは「99. 取扱説明書（マニュアル）」から確認できます。</p>
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
  document.getElementById('zoomOut').onclick = () => changeDisplayZoom(-APP_ZOOM.step);
  document.getElementById('zoomIn').onclick = () => changeDisplayZoom(APP_ZOOM.step);
  document.getElementById('zoomReset').onclick = () => setDisplayZoom(APP_ZOOM.defaultValue);
  document.addEventListener('keydown', handleZoomShortcut);

  applyTheme();
  applyDisplayZoom();
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
