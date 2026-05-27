const NAV_SECTIONS = [
  {
    title: 'メインCSV',
    pages: [
      { key: 'import', label: 'データ取込', icon: '📥' },
      { key: 'summary', label: '全体サマリー', icon: '📊' },
      { key: 'trend', label: '推移分析', icon: '📈' },
      { key: 'category', label: 'カテゴリ別分析', icon: '🧩' },
      { key: 'alert', label: 'アラート', icon: '🚨' },
      { key: 'vendor', label: 'ベンダー／契約更新', icon: '🤝' },
      { key: 'detail', label: '明細ドリルダウン', icon: '🔎' },
    ],
  },
  {
    title: '追加CSV',
    pages: [
      { key: 'project', label: '新規案件コスト', icon: '🗂️' },
      { key: 'depreciation', label: '減価償却シミュレーション', icon: '🧮' },
      { key: 'oacis', label: 'OACIS実績', icon: '🏢' },
    ],
  },
];

const UTILITY_NAV_PAGES = [
  { key: 'settings', label: '表示設定', icon: '⚙️' },
  { key: 'manual', label: '使い方', icon: '❓' },
];

const NAV_PAGES = [...NAV_SECTIONS.flatMap(section => section.pages), ...UTILITY_NAV_PAGES];

const IMPORT_FILE_TYPE_OPTIONS = [
  { value: 'budget', label: '予実績管理データ' },
  { value: 'variance_reason', label: '差額理由' },
  { value: 'new_project_master', label: '新規案件マスタCSV' },
  { value: 'new_project_monthly_cost', label: '新規案件月次金額CSV' },
  { value: 'oasis_actual', label: 'OACIS実績' },
  { value: 'depreciation_simulation', label: '減価償却シミュレーション' },
];

const IMPORT_STATUS_FILE_TYPES = IMPORT_FILE_TYPE_OPTIONS.map(t => t.value);
const ADDITIONAL_FILE_TYPES = IMPORT_FILE_TYPE_OPTIONS.filter(t => t.value !== 'budget').map(t => t.value);
const NOT_IMPORTED_MESSAGE = 'データ未取込';
const APP_ZOOM = { min: 75, max: 150, step: 5, defaultValue: 100 };
const MONEY_UNITS_STORAGE_KEY = 'moneyUnits';

function loadSavedMoneyUnits() {
  const defaults = { alert: 'thousand', newProject: 'thousand', summary: 'thousand', trend: 'thousand', category: 'thousand', vendor: 'thousand', depreciation: 'thousand', oacis: 'thousand' };
  try {
    const raw = localStorage.getItem(MONEY_UNITS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const valid = ['thousand', 'million', 'oku'];
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, valid.includes(parsed?.[key]) ? parsed[key] : fallback]));
  } catch (_) {
    return defaults;
  }
}

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
    units: loadSavedMoneyUnits(),
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

const MONEY_UNITS = {
  thousand: { label: '千円', divisor: 1 },
  million: { label: '百万円', divisor: 1000 },
  oku: { label: '億円', divisor: 100000 },
};
const normalizeMoneyUnit = (unit) => (MONEY_UNITS[unit] ? unit : 'thousand');
const unitLabel = (unit) => MONEY_UNITS[normalizeMoneyUnit(unit)].label;
const convertFromThousandYen = (value, unit) => Number(value || 0) / MONEY_UNITS[normalizeMoneyUnit(unit)].divisor;
const formatUnitValue = (value, digits = 1) => Number(value || 0).toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const formatMoneyByUnit = (thousandYen, unit, digits = 1) => `${formatUnitValue(convertFromThousandYen(thousandYen, unit), digits)} ${unitLabel(unit)}`;
const moneyUnitOptionsHtml = (selectedUnit) => ['thousand', 'million', 'oku'].map(key => `<option value="${key}" ${normalizeMoneyUnit(selectedUnit)===key?'selected':''}>${unitLabel(key)}</option>`).join('');
const moneyUnitSegmentedControlHtml = (controlId, selectedUnit) => `<fieldset class="unit-switch" role="radiogroup" aria-label="金額単位" data-unit-control="${dataAttr(controlId)}">${['thousand', 'million', 'oku'].map((key) => `<label class="unit-switch__btn ${normalizeMoneyUnit(selectedUnit)===key?'active':''}"><input type="radio" name="${dataAttr(controlId)}_unit" value="${key}" data-unit-value="${key}" ${normalizeMoneyUnit(selectedUnit)===key?'checked':''}><span>${unitLabel(key)}</span></label>`).join('')}</fieldset>`;
const bindMoneyUnitControl = (controlId, currentUnit, onChange) => {
  const root = document.querySelector(`[data-unit-control="${controlId}"]`);
  if (!root) return;
  root.querySelectorAll('[data-unit-value]').forEach((input) => {
    input.onchange = () => {
      const next = normalizeMoneyUnit(input.dataset.unitValue);
      if (next === normalizeMoneyUnit(currentUnit)) return;
      onChange(next);
    };
  });
};
const persistMoneyUnits = () => localStorage.setItem(MONEY_UNITS_STORAGE_KEY, JSON.stringify(state.ui.units));
const updateMoneyUnit = (key, nextUnit, rerender) => {
  state.ui.units[key] = normalizeMoneyUnit(nextUnit);
  persistMoneyUnits();
  rerender();
};
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
const normalizeBrokenText = (value) => String(value ?? '')
  .replace(/�/g, '')
  .replace(/ï»¿/g, '')
  .trim();
const formatYearMonth = (ym) => {
  const s = String(ym || '').trim();
  return /^\d{6}$/.test(s) ? `${s.slice(0, 4)}/${s.slice(4, 6)}` : (s || '-');
};
const firstPresent = (...values) => values.find(value => value !== undefined && value !== null && String(value).trim() !== '');


const GLOBAL_FILTER_VISIBLE_PAGES = ['summary', 'trend', 'category', 'alert', 'vendor', 'detail'];

function shouldShowGlobalFilters(page = state.page) {
  return GLOBAL_FILTER_VISIBLE_PAGES.includes(page);
}

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
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.textContent = `${themeLabel[state.ui.theme]}（切替）`;
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

function navButtonHtml(p) {
  return `<button class="nav-item ${p.key === state.page ? 'active' : ''}" data-page="${dataAttr(p.key)}" title="${escapeHtml(p.label)}"><span class="nav-icon">${escapeHtml(p.icon || '•')}</span><span class="nav-label">${escapeHtml(p.label)}</span></button>`;
}

function initNav() {
  const nav = document.getElementById('sidebarNav');
  const sectionHtml = NAV_SECTIONS.map(section => `<div class="nav-group"><div class="nav-group-title">${escapeHtml(section.title)}</div>${section.pages.map(navButtonHtml).join('')}</div>`).join('');
  const utilityHtml = `<div class="nav-group nav-group--utility">${UTILITY_NAV_PAGES.map(navButtonHtml).join('')}</div>`;
  nav.innerHTML = `${sectionHtml}${utilityHtml}`;
  nav.querySelectorAll('.nav-item').forEach(b => b.onclick = () => goPage(b.dataset.page));
}

function initFilterBar() {
  const root = document.getElementById('globalFilters');
  if (!shouldShowGlobalFilters()) {
    root.innerHTML = '';
    root.style.display = 'none';
    return;
  }
  root.style.display = '';

  const st = state.data.status || {};
  const depts = st.departments || [];
  const vendors = (st.vendors || []).slice(0, 20);
  const periods = getPeriodOptions();
  normalizeGlobalScopeFilters();
  const yms = getYearMonthOptions();
  const targets = ['すべて', '継続案件', '新規案件', ...vendors.map(v => `ベンダー:${v}`)];
  root.innerHTML = `
    <label>集計軸 <select id="fPeriodMode">${['月次', '四半期', '通期'].map(v => optionHtml(v, state.filters.periodMode)).join('')}</select></label>
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

function closeMobileMenu() {
  document.body.classList.remove('mobile-menu-open');
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  if (mobileMenuToggle) mobileMenuToggle.setAttribute('aria-expanded', 'false');
}

function goPage(page) {
  closeMobileMenu();
  withViewTransition(() => {
    state.page = page;
    initNav();
    initFilterBar();
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
    const st = fileType === 'budget'
      ? {
        status: state.hasData ? 'imported' : 'not_imported',
        message: state.hasData ? '' : NOT_IMPORTED_MESSAGE,
        rowCount: Number(state.data.status?.itemCount || 0),
        fileName: state.data.status?.csvFileName || '',
      }
      : (additionalData[fileType] || { status: 'not_imported', message: NOT_IMPORTED_MESSAGE, rowCount: 0 });
    const imported = st.status === 'imported';
    const safeFileName = normalizeBrokenText(st.fileName);
    const safeMessage = normalizeBrokenText(st.message);
    return `<article class="mini-status ${imported ? 'mini-status--ok' : ''}"><strong>${escapeHtml(option?.label || fileType)}</strong><span>${escapeHtml(imported ? '取込済み' : NOT_IMPORTED_MESSAGE)}</span><small>${imported ? `${fmt(st.rowCount)}件 / ${escapeHtml(safeFileName || '-')}` : escapeHtml(safeMessage || NOT_IMPORTED_MESSAGE)}</small></article>`;
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
      errorsEl.innerHTML = `<div class="panel"><h4>エラーパネル（表示のみ）</h4>${isDep ? '減価償却シミュレーション.csv は指定レイアウト（区分,償却展開区分,償却展開区分名,期間種別,期,月,金額）で取り込みます。' : '新規案件マスタCSV: 管理番号,案件名,案件担当者,本番開始予定日,IT投資シミュレーション№,進捗状況,案件区分。新規案件月次金額CSV: 管理番号,経費事象,投資運用区分,予算有り,5年経費合計,memo,対象年月,予算金額,見込金額。'}</div>`;
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

function standardKpiCardHtml({ label, valueHtml, helpText, tone = 'neutral', note = '', statusLabel = '確認対象', statusIcon = '●', scopeText = '' }, idx = 0) {
  const popId = `kpiHelpGeneric${idx}`;
  return `<article class="kpi kpi-card" aria-label="${dataAttr(label)}">
    <div class="kpi-head">
      <div class="label">${escapeHtml(label)}</div>
      <span class="tooltip-wrap">
        <button class="icon-button" type="button" aria-describedby="${popId}" aria-label="${dataAttr(label)}の説明を表示">?</button>
        <span id="${popId}" class="popover-card" role="tooltip">${escapeHtml(helpText || 'KPIの読み方を確認します。')}</span>
      </span>
    </div>
    <div class="value ${tone === 'warn' ? 'warn' : ''}">${valueHtml}</div>
    <div class="kpi-meta">
      <span class="status-pill status-pill--${tone}">${statusIcon} ${escapeHtml(statusLabel)}</span>
      <span>${escapeHtml(scopeText || '-')}</span>
    </div>
    <p class="kpi-note">${escapeHtml(note || helpText || '')}</p>
  </article>`;
}

function renderSummary() {
  const money = (value) => formatMoneyByUnit(value, state.ui.units.summary);
  const items = filteredItems();
  const s = scopedPeriodSummary(items);
  const periodVariance = calculateVariance(s.totalPlan, s.comparable);
  const periodBurnRate = calculateBurnRate(s.totalPlan, s.comparable);
  const periodScopeItems = state.data.items.filter((item) => {
    if (state.filters.department && item.department_name !== state.filters.department) return false;
    if (state.filters.target === '新規案件' && !isNewProject(item)) return false;
    if (state.filters.target === '継続案件' && isNewProject(item)) return false;
    if ((state.filters.target || '').startsWith('ベンダー:')) {
      const vendor = state.filters.target.replace('ベンダー:', '');
      if ((item.vendor_name || item.payee_name || '') !== vendor) return false;
    }
    if (state.filters.fiscalPeriod && String(item.fiscal_period || '') !== String(state.filters.fiscalPeriod)) return false;
    return true;
  });
  const fullComparable = periodScopeItems.reduce((sum, item) => sum + getComparableActual(item), 0);
  const fullPlan = periodScopeItems.reduce((sum, item) => sum + Number(item.totalPlan || 0), 0);
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
    '総予算': money(s.totalPlan),
    '見込み／実績': money(s.comparable),
    '予算消化率': animatedValueHtml(periodBurnRate, 'pct'),
    '差額': money(periodVariance.amount),
    '着地見込み': s.totalForecast ? money(s.totalForecast) : '未設定',
    'コスト削減効果': `${money(reduction)} / ${animatedValueHtml(reductionRate, 'pct')}`,
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
          <p class="muted">上部フィルターを反映した最新スコープです。大きな差異はランキングから明細へドリルダウンできます。</p><div class="controls"><span>金額単位</span>${moneyUnitSegmentedControlHtml('summary_unit', state.ui.units.summary)}</div>
        </div>
        <div class="hero-metric ${Math.abs(periodVariance.amount) >= state.settings.thresholds.amountGap ? 'warn' : 'ok'}">
          <span>差額</span><strong>${money(periodVariance.amount)}</strong>
        </div>
      </div>
      <div class="bento-card bento-card--wide kpi-strip">${kpiCards}</div>
      <div class="bento-card bento-card--small insight-card">
        <h4>当月カード</h4>
        <p class="muted">選択スコープ: ${escapeHtml(s.label || '通期')}</p>
        <dl>
          <dt>予算</dt><dd>${money(s.totalPlan)}</dd>
          <dt>見込み／実績</dt><dd>${money(s.comparable)}</dd>
          <dt>差額</dt><dd class="${Math.abs(periodVariance.amount) >= state.settings.thresholds.amountGap ? 'warn' : ''}">${money(periodVariance.amount)}</dd>
          <dt>差額率</dt><dd>${animatedValueHtml(periodVariance.rate, 'pct')}</dd>
        </dl>
      </div>
      <div class="bento-card bento-card--small insight-card">
        <h4>期全体カード</h4>
        <dl>
          <dt>期全体の予算</dt><dd>${money(fullPlan)}</dd>
          <dt>期全体の見込み／実績</dt><dd>${money(fullComparable)}</dd>
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
          return `<tr data-mid="${dataAttr(r.row.management_no)}" class="clickable-row ${isWarn ? 'warning-row' : ''}"><td>${i + 1}. ${escapeHtml(r.name)}</td><td class="right ${isWarn ? 'warn' : ''}">${money(r.gap)}</td><td><span class="status-pill status-pill--${isWarn ? 'warn' : 'ok'}">${isWarn ? '⚠️ 要確認' : '● 許容範囲'}</span></td><td>${displayHtml(r.row.variance_reason_category)}</td><td>${displayHtml(r.row.variance_reason)}</td><td>${displayHtml(r.row.comment)}</td></tr>`;
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
  bindMoneyUnitControl('summary_unit', state.ui.units.summary, (next) => updateMoneyUnit('summary', next, renderSummary));
  bindManagementNoDrilldowns();
}

function renderTrend() {
  const money = (value) => formatMoneyByUnit(value, state.ui.units.trend);
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
        <label>指標 <select id="trendMetric">${['総額', '費目別', 'システム別'].map(v => optionHtml(v, state.ui.trendMetric)).join('')}</select></label><div><span class="muted">金額単位</span>${moneyUnitSegmentedControlHtml('trend_unit', state.ui.units.trend)}</div>
      </div>
      <div style="height:320px"><canvas id="trendChart"></canvas></div>
    </div>
    <div class="panel"><h4>変動の大きい順ランキング（前年差・前月差）</h4><div class="table-wrap"><table><thead><tr><th>対象</th><th class="right">前年差</th><th class="right">前月差</th></tr></thead><tbody>
      ${rank.map(r => `<tr class="clickable-row" data-filter-type="management_no" data-filter-value="${dataAttr(r.management_no)}"><td>${escapeHtml(r.name)}</td><td class="right">${money(r.yoy)}</td><td class="right">${money(r.mom)}</td></tr>`).join('')}
    </tbody></table></div></div>`;

  const cc = chartColors();
  drawLine('trendChart', labels, [
    { label: '予算', data: series.map(v => v.plan), borderColor: cc.c1 },
    { label: '見込', data: series.map(v => v.forecast), borderColor: cc.c3 },
    { label: '実績', data: series.map(v => v.actual), borderColor: cc.c2 },
  ]);

  document.getElementById('trendMonths').onchange = e => { state.ui.trendMonths = Number(e.target.value); renderTrend(); };
  document.getElementById('trendMetric').onchange = e => { state.ui.trendMetric = e.target.value; renderTrend(); };
  bindMoneyUnitControl('trend_unit', state.ui.units.trend, (next) => updateMoneyUnit('trend', next, renderTrend));
  bindDetailFilterLinks();
  bindMoneyUnitControl('vendor_unit', state.ui.units.vendor, (next) => updateMoneyUnit('vendor', next, renderVendor));
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
  const money = (value) => formatMoneyByUnit(value, state.ui.units.category);
  const tabs = ['システム分類名別', '経費区分別', '経費事象名別', '部門別', '固定費・変動費'];
  const keyMap = { 'システム分類名別': 'system_classification', '経費区分別': 'expense_classification', '経費事象名別': 'expense_item_name', '部門別': 'department_name', '固定費・変動費': 'fixed_variable_type' };
  const categoryKey = keyMap[state.ui.categoryTab];
  const agg = aggregateBy(filteredItems(), categoryKey);

  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="tabs">${tabs.map(t => `<button data-tab="${dataAttr(t)}" class="${t === state.ui.categoryTab ? 'active' : ''}">${escapeHtml(t)}</button>`).join('')}</div><div class="controls"><span>金額単位</span>${moneyUnitSegmentedControlHtml('category_unit', state.ui.units.category)}</div>
      <div class="grid-2">
        <div><h4>構成比</h4><div style="height:300px"><canvas id="catPie"></canvas></div></div>
        <div><h4>予実差（差額順／乖離率順）</h4><div class="table-wrap"><table><thead><tr><th>分類</th><th class="right">構成比</th><th class="right">差額</th><th class="right">乖離率</th></tr></thead><tbody>
          ${agg.slice(0, 25).map(r => `<tr class="clickable-row" data-filter-type="${categoryKey === 'department_name' ? 'department' : 'category'}" data-filter-value="${dataAttr(r.key)}"><td>${escapeHtml(r.key)}</td><td class="right">${pct(r.comp)}</td><td class="right">${money(r.gap)}</td><td class="right">${pct(r.gapRate)}</td></tr>`).join('')}
        </tbody></table></div></div>
      </div>
    </div>`;

  document.querySelectorAll('[data-tab]').forEach(btn => btn.onclick = () => { state.ui.categoryTab = btn.dataset.tab; renderCategory(); });
  bindMoneyUnitControl('category_unit', state.ui.units.category, (next) => updateMoneyUnit('category', next, renderCategory));
  bindDetailFilterLinks();
  const palette = chartColors().pie;
  new Chart(document.getElementById('catPie'), {
    type: 'doughnut',
    data: { labels: agg.slice(0, 10).map(v => v.key), datasets: [{ data: agg.slice(0, 10).map(v => v.comp), backgroundColor: palette.slice(0, Math.min(10, agg.length)), borderWidth: 1 }] },
    options: baseChartOptions({ maintainAspectRatio: false, responsive: true })
  });
}

async function renderProject() {
  const money = (value) => formatMoneyByUnit(value, state.ui.units.newProject);
  const content = document.getElementById('content');
  content.innerHTML = '<div class="panel"><p>新規案件データを読み込み中です...</p></div>';
  const payload = await api('/analysis/new-project-costs').catch(() => null);
  if (!payload) return void (content.innerHTML = '<div class="panel"><p>新規案件マスタCSV取込完了。続いて新規案件月次金額CSVの取込を実施してください。</p></div>');

  const summary = payload.summary || {}; const rankingBase = payload.projectRanking || []; const detailBase = payload.detailRows || [];
  const fiscalPeriodFromMonth = (ym) => {
    const s = String(ym || '');
    const m = s.match(/^(\d{4})(\d{2})$/);
    if (!m) return '';
    const year = Number(m[1]); const month = Number(m[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return '';
    const table = [
      { period: '59期', from: 201804, to: 201903 },
      { period: '60期', from: 201904, to: 202003 },
      { period: '61期', from: 202004, to: 202103 },
      { period: '62期', from: 202104, to: 202203 },
      { period: '63期', from: 202204, to: 202303 },
      { period: '64期', from: 202304, to: 202403 },
      { period: '65期', from: 202404, to: 202503 },
      { period: '66期', from: 202504, to: 202603 },
      { period: '67期', from: 202604, to: 202703 },
      { period: '68期', from: 202704, to: 202803 },
      { period: '69期', from: 202804, to: 202903 },
      { period: '70期', from: 202904, to: 203003 },
    ];
    const value = year * 100 + month;
    return table.find(v => value >= v.from && value <= v.to)?.period || '';
  };
  const formatYmLabel = (ym) => {
    const s = String(ym || '');
    return /^\d{6}$/.test(s) ? `${s.slice(0,4)}/${s.slice(4,6)}` : s;
  };
  const filterState = { fiscalPeriod:'', targetMonth:'', projectCategory:'', itInvestmentNo:'', owner:'', progressStatus:'', costGroup:'', varianceReason:'', keyword:'', rankSort:'variance', gapStatus:'all' };
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ja'));

  const options = {
    fiscalPeriod: uniq(detailBase.map(r=>fiscalPeriodFromMonth(r.targetMonth))), targetMonth: uniq(detailBase.map(r=>r.targetMonth)), projectCategory: uniq(detailBase.map(r=>r.projectCategory)), itInvestmentNo: uniq(detailBase.map(r=>r.itInvestmentNo)), owner: uniq(detailBase.map(r=>r.owner)),
    progressStatus: uniq(detailBase.map(r=>r.progressStatus)), costGroup: uniq(detailBase.map(r=>r.costGroup)), varianceReason: uniq(detailBase.map(r=>r.varianceReason)),
  };
  const filterLabels = { fiscalPeriod: '期', targetMonth: '対象年月', projectCategory: '案件区分', itInvestmentNo: 'IT投資シミュレーション№', owner: '案件担当者', progressStatus: '進捗状況', costGroup: '投資運用区分', varianceReason: '差額理由' };
  const monthInSelectedPeriod = (ym) => {
    if (!filterState.fiscalPeriod) return true;
    return fiscalPeriodFromMonth(ym) === filterState.fiscalPeriod;
  };
  const availableTargetMonths = () => options.targetMonth.filter(monthInSelectedPeriod);
  const refreshTargetMonthOptions = () => {
    const targetSelect = document.getElementById('npf_targetMonth');
    if (!targetSelect) return;
    const months = availableTargetMonths();
    if (filterState.targetMonth && !months.includes(filterState.targetMonth)) filterState.targetMonth = '';
    targetSelect.innerHTML = `<option value="">全て</option>${months.map(v=>`<option value="${escapeHtml(v)}" ${v===filterState.targetMonth?'selected':''}>${escapeHtml(formatYmLabel(v))}</option>`).join('')}`;
  };

  content.innerHTML = `<section class="panel new-project-cost-page"><div class="card-title-row"><div><h3>プロジェクト別コスト管理（新規案件）</h3><p class="muted">進捗率は進捗状況からの簡易換算値です。差額理由は進捗状況/memoからの簡易分類です。</p></div></div>
  <div class="controls"><span>金額単位</span>${moneyUnitSegmentedControlHtml('np_unit', state.ui.units.newProject)}${['fiscalPeriod','targetMonth','projectCategory','itInvestmentNo','owner','progressStatus','costGroup','varianceReason'].map(k=>`<label>${filterLabels[k]}<select id="npf_${k}"><option value="">全て</option>${options[k].map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(k==='targetMonth'?formatYmLabel(v):v)}</option>`).join('')}</select></label>`).join('')}<label>管理番号／案件名検索<input id="npf_keyword" type="text" placeholder="管理番号／案件名"></label></div>
  <div id="np_kpi" class="kpi-strip new-project-kpi"></div>
  <div class="new-project-cost-grid grid-2"><div class="panel new-project-ranking"><div class="card-title-row"><h4>差額ランキング</h4><select id="np_rank_sort"><option value="variance">差額順</option><option value="rate">差額率順</option><option value="forecast">見込金額順</option></select></div><div class="table-wrap"><table><thead><tr><th>#</th><th>管理番号</th><th>案件名</th><th class="right">予算</th><th class="right">見込</th><th class="right">差額</th><th class="right">差額率</th><th class="right">5年経費合計</th><th>予算有り</th><th>memo</th><th>差額理由</th></tr></thead><tbody id="np_rank_rows"></tbody></table></div></div>
  <div class="panel new-project-gap-analysis"><h4>進捗・コスト消化ギャップ分析</h4><div id="np_gap_counts" class="muted"></div><div id="np_gap_summary" class="gap-summary"></div><div id="np_gap_filter_buttons" class="gap-filter-buttons"></div><div id="np_gap_bar_list" class="gap-bar-list"></div><div class="table-wrap"><table class="gap-ranking-table"><thead><tr><th>#</th><th>管理番号</th><th>案件名</th><th>案件区分</th><th>IT投資シミュレーション№</th><th>進捗状況</th><th class="right">進捗率</th><th class="right">コスト消化率</th><th class="right">ギャップ</th><th>判定区分</th><th class="right">予算金額</th><th class="right">見込金額</th><th class="right">差額</th></tr></thead><tbody id="np_gap_rank_rows"></tbody></table></div><details class="gap-formula-note"><summary>計算ロジック注釈</summary><div class="gap-formula-details"><p>進捗率は、進捗状況から自動換算した簡易値です。進捗率は正式なプロジェクト進捗率ではありません。</p><p>換算ルール: 未着手/01.未着手=0%, 今期中に案件組成=20%, 来期案件組成予定=20%, 組成予定=40%, 組成済=60%, 予算計画通り=80%, 完了=100%, 取下げ/取下/削除=0%, 上記以外=未算出。</p><p>コスト消化率 = 見込金額合計 ÷ 予算金額合計 × 100。予算金額合計が0の場合、コスト消化率は未算出です。金額は案件単位で集計した予算金額・見込金額を使用しています。</p><p>ギャップ = コスト消化率 − 進捗率。ギャップがプラスの場合、進捗に対してコスト消化が先行しています。ギャップがマイナスの場合、進捗に対してコスト消化が低い状態です。</p></div></details></div></div>
  <div class="new-project-cost-grid grid-2"><div class="panel new-project-cost-compare"><div class="card-title-row"><h4>区分別 投資・運用比較</h4><select id="np_compare_mode"><option value="category">案件区分別</option><option value="it">IT投資シミュレーション№別</option><option value="group">投資運用区分別</option></select></div><div class="table-wrap"><table><thead><tr><th>区分</th><th class="right">投資見込</th><th class="right">運用見込</th><th class="right">差額</th></tr></thead><tbody id="np_compare_rows"></tbody></table></div></div>
  <div class="panel new-project-variance-reason"><h4>差額理由サマリー</h4><div class="table-wrap"><table><thead><tr><th>理由</th><th class="right">件数</th><th class="right">差額</th><th>主案件</th></tr></thead><tbody id="np_reason_rows"></tbody></table></div></div></div>
  <div class="panel new-project-detail-table"><h4>詳細テーブル</h4><div class="table-wrap"><table><thead><tr><th>管理番号</th><th>案件名</th><th>担当</th><th>経費事象</th><th>投資運用区分</th><th>予算有り</th><th class="right">5年経費合計</th><th>対象年月</th><th class="right">予算</th><th class="right">見込</th><th class="right">差額</th><th class="right">差額率</th><th class="right">消化率</th><th>memo</th><th>理由</th></tr></thead><tbody id="np_detail_rows"></tbody></table></div></div></section>`;

  const getFiltered = () => detailBase.filter(r => (!filterState.fiscalPeriod || fiscalPeriodFromMonth(r.targetMonth)===filterState.fiscalPeriod) && (!filterState.targetMonth || r.targetMonth===filterState.targetMonth) && (!filterState.projectCategory || r.projectCategory===filterState.projectCategory) && (!filterState.itInvestmentNo || r.itInvestmentNo===filterState.itInvestmentNo) && (!filterState.owner || r.owner===filterState.owner) && (!filterState.progressStatus || r.progressStatus===filterState.progressStatus) && (!filterState.costGroup || r.costGroup===filterState.costGroup) && (!filterState.varianceReason || r.varianceReason===filterState.varianceReason) && (!filterState.keyword || `${r.managementNo} ${r.projectName}`.toLowerCase().includes(filterState.keyword.toLowerCase())));

  const renderAll = async () => {
    const latestPayload = await api('/analysis/new-project-costs').catch(() => payload);
    const matrixBase = latestPayload.progressCostMatrix || [];
    const drows = getFiltered();
    const pmap = new Map(); drows.forEach(r=>{ const k=r.managementNo||'未設定'; if(!pmap.has(k)) pmap.set(k,{...r,budgetAmount:0,forecastAmount:0,varianceAmount:0,fiveYearCost:0,memoSet:new Set(),hasBudgetSet:new Set(),fiveYearDedup:new Set()}); const p=pmap.get(k); p.budgetAmount+=Number(r.budgetAmount||0); p.forecastAmount+=Number(r.forecastAmount||0); p.varianceAmount+=Number(r.varianceAmount||0); p.varianceRate=p.budgetAmount?p.varianceAmount/p.budgetAmount:null; p.costConsumptionRate=p.budgetAmount?(p.forecastAmount/p.budgetAmount)*100:null; if(r.memo) p.memoSet.add(r.memo); if(r.hasBudget) p.hasBudgetSet.add(r.hasBudget); const eKey=`${k}__${r.expenseEvent||'未設定'}`; if(!p.fiveYearDedup.has(eKey)){p.fiveYearDedup.add(eKey); p.fiveYearCost+=Number(r.fiveYearCost||0);} p.memoSummary=[...p.memoSet].join(' / '); p.hasBudgetSummary=[...p.hasBudgetSet].join('/');});
    let prows=[...pmap.values()];
    if (filterState.rankSort==='rate') prows.sort((a,b)=>Math.abs(b.varianceRate||0)-Math.abs(a.varianceRate||0)); else if (filterState.rankSort==='forecast') prows.sort((a,b)=>b.forecastAmount-a.forecastAmount); else prows.sort((a,b)=>Math.abs(b.varianceAmount)-Math.abs(a.varianceAmount));
    const top=prows.slice(0,20);
    document.getElementById('np_rank_rows').innerHTML = top.map((r,i)=>`<tr class="clickable-row" data-management="${dataAttr(r.managementNo)}"><td>${i+1}</td><td>${escapeHtml(r.managementNo)}</td><td>${escapeHtml(r.projectName)}</td><td class="right">${money(r.budgetAmount)}</td><td class="right">${money(r.forecastAmount)}</td><td class="right ${r.varianceAmount>0?'variance-positive':r.varianceAmount<0?'variance-negative':'variance-neutral'}">${money(r.varianceAmount)}</td><td class="right">${r.varianceRate==null?'-':pct(r.varianceRate*100)}</td><td class="right">${money(r.fiveYearCost||0)}</td><td>${escapeHtml(r.hasBudgetSummary||'')}</td><td class="memo-cell memo-cell--clamped" title="${escapeHtml(r.memoSummary||'')}">${displayHtml(r.memoSummary||'')}</td><td>${displayHtml(r.varianceReason)}</td></tr>`).join('');
    const s={...summary, projectCount:prows.length, totalBudget:prows.reduce((a,b)=>a+b.budgetAmount,0), totalForecast:prows.reduce((a,b)=>a+b.forecastAmount,0), totalVariance:prows.reduce((a,b)=>a+b.varianceAmount,0), totalFiveYearCost:prows.reduce((a,b)=>a+Number(b.fiveYearCost||0),0), varianceProjectCount:prows.filter(v=>Number(v.varianceAmount||0)!==0).length, notStartedProjectCount:prows.filter(v=>/未着手/.test(v.progressStatus||'')).length, alertProjectCount:prows.filter(v=>v.alertLevel&&v.alertLevel!=='normal').length}; s.varianceRate=s.totalBudget?s.totalVariance/s.totalBudget:null;
    const npScope = `${filterState.targetMonth ? formatYmLabel(filterState.targetMonth) : '全期間'} / ${filterState.projectCategory || '全案件区分'}`;
    document.getElementById('np_kpi').innerHTML=[['新規案件数',fmt(s.projectCount),'フィルタ後の対象案件数です。'],['5年経費合計',money(s.totalFiveYearCost||0),'対象案件の5年経費合計です。'],['当期予算額',money(s.totalBudget),'対象案件の予算金額合計です。'],['見込金額',money(s.totalForecast),'対象案件の見込金額合計です。'],['差額',money(s.totalVariance),'予算金額と見込金額の差額合計です。'],['差額率',s.varianceRate==null?'-':pct(s.varianceRate*100),'差額÷予算金額です。'],['投資系金額',money(summary.investmentAmount||0),'投資系に分類された金額です。'],['運用系金額',money(summary.operationAmount||0),'運用系に分類された金額です。'],['差額発生案件数',fmt(s.varianceProjectCount||0),'差額が発生している案件数です。'],['未着手案件数',fmt(s.notStartedProjectCount||0),'進捗状況が未着手の案件数です。'],['要確認案件数',fmt(s.alertProjectCount||0),'アラートレベルがnormal以外の案件数です。']].map(([l,v,h],idx)=>standardKpiCardHtml({label:l,valueHtml:v,helpText:h,note:h,statusLabel:'確認対象',scopeText:npScope},idx)).join('');
    const detailRowsForTable = filterState.selectedManagementNo ? drows.filter(r => r.managementNo === filterState.selectedManagementNo) : [];
    document.getElementById('np_detail_rows').innerHTML=detailRowsForTable.slice(0,500).map(r=>`<tr class="${Math.abs(r.varianceAmount)>1000000?'warning-row':''}" data-management="${dataAttr(r.managementNo)}"><td>${escapeHtml(r.managementNo)}</td><td>${escapeHtml(r.projectName)}</td><td>${escapeHtml(r.owner||'')}</td><td>${escapeHtml(r.expenseEvent||'')}</td><td>${escapeHtml(r.costGroup||'')}</td><td>${escapeHtml(r.hasBudget||'')}</td><td class="right">${money(r.fiveYearCost||0)}</td><td>${escapeHtml(formatYmLabel(r.targetMonth||''))}</td><td class="right">${money(r.budgetAmount)}</td><td class="right">${money(r.forecastAmount)}</td><td class="right ${r.varianceAmount>0?'variance-positive':r.varianceAmount<0?'variance-negative':'variance-neutral'}">${money(r.varianceAmount)}</td><td class="right">${r.varianceRate==null?'-':pct(r.varianceRate*100)}</td><td class="right ${r.alertLevel==='watch'?'alert-level-watch':r.alertLevel==='alert'?'alert-level-alert':r.alertLevel==='progressAhead'?'alert-level-progress-ahead':''}">${r.costConsumptionRate==null?'-':pct(r.costConsumptionRate)}</td><td class="memo-cell memo-cell--clamped" title="${escapeHtml(r.memo||'')}">${displayHtml(r.memo)}</td><td>${displayHtml(r.varianceReason)}</td></tr>`).join('') || '<tr><td colspan="15">差額ランキングの案件をクリックすると詳細を表示します。</td></tr>';
    const allowedManagementNos = new Set(prows.map(v => v.managementNo));
    const matrixFiltered = matrixBase.filter(r => allowedManagementNos.has(r.managementNo));
    const gapRows = matrixFiltered.map(r => {
      const progressRate = Number(r.progressRate);
      const costConsumptionRate = Number(r.costConsumptionRate);
      const hasProgress = Number.isFinite(progressRate);
      const hasCost = Number.isFinite(costConsumptionRate);
      const gap = hasProgress && hasCost ? costConsumptionRate - progressRate : null;
      const status = gap == null ? 'unknown' : gap >= 40 ? 'critical' : gap >= 20 ? 'watch' : gap <= -30 ? 'progress-ahead' : 'normal';
      const statusLabel = status === 'critical' ? '要確認・高' : status === 'watch' ? '要確認' : status === 'progress-ahead' ? '進捗先行' : status === 'normal' ? '概ね整合' : '判定不可';
      return { ...r, progressRate, costConsumptionRate, progressCostGap: gap, progressCostGapStatus: status, progressCostGapLabel: statusLabel };
    });
    const gapComparable = gapRows.filter(r => r.progressCostGap != null).sort((a,b)=>Math.abs(b.progressCostGap)-Math.abs(a.progressCostGap));
    const counters = { critical:0, watch:0, 'progress-ahead':0, normal:0, unknown:0 };
    gapRows.forEach(r => { counters[r.progressCostGapStatus] = (counters[r.progressCostGapStatus] || 0) + 1; });
    const gapStatusFilter = filterState.gapStatus || 'all';
    const gapFiltered = gapStatusFilter === 'all' ? gapComparable : gapComparable.filter(r => r.progressCostGapStatus === gapStatusFilter);
    const gapTop = gapFiltered.slice(0,20);
    document.getElementById('np_gap_counts').textContent = `フィルタ後案件数：${fmt(prows.length)}件 / 判定可能案件数：${fmt(gapComparable.length)}件 / 判定不可案件数：${fmt(counters.unknown || 0)}件 / 表示中：${gapStatusFilter === 'all' ? '上位' : '絞込'}${fmt(gapTop.length)}件`;
    const summaryDefs = [['critical','要確認・高','コスト消化が進捗より大きく先行'],['watch','要確認','コスト消化が進捗より先行'],['progress-ahead','進捗先行','進捗に対してコスト消化が低い'],['normal','概ね整合','進捗とコスト消化が概ね整合'],['unknown','判定不可','進捗率またはコスト消化率を算出不可']];
    document.getElementById('np_gap_summary').innerHTML = summaryDefs.map(([key,label,desc]) => `<article class="gap-summary-card gap-status-${key}"><div class="label">${label}</div><div class="value">${fmt(counters[key] || 0)}件</div><div class="muted">${desc}</div></article>`).join('');
    const gapFilterDefs = [['all','全件'],['critical','要確認・高'],['watch','要確認'],['progress-ahead','進捗先行'],['normal','概ね整合']];
    document.getElementById('np_gap_filter_buttons').innerHTML = gapFilterDefs.map(([key,label]) => {
      const count = key === 'all' ? gapComparable.length : (counters[key] || 0);
      return `<button type="button" class="gap-filter-btn ${gapStatusFilter === key ? 'active' : ''}" data-gap-filter="${key}">${label}<span>${fmt(count)}件</span></button>`;
    }).join('');
    document.getElementById('np_gap_bar_list').innerHTML = gapTop.map(r => {
      const progressBar = Math.max(0, Math.min(100, Number(r.progressRate || 0)));
      const costBar = Math.max(0, Math.min(100, Number(r.costConsumptionRate || 0)));
      const varianceClass = r.varianceAmount>0?'variance-positive':r.varianceAmount<0?'variance-negative':'variance-neutral';
      return `<article class="gap-bar-item gap-status-${r.progressCostGapStatus}"><div class="gap-bar-label"><b>${escapeHtml(r.managementNo || '')}</b> ${escapeHtml(r.projectName || '')}<span class="muted"> / ${escapeHtml(r.progressStatus || '進捗状況未設定')}</span></div><div class="gap-bar-row"><span>進捗率 ${pct(r.progressRate)}</span><div class="gap-bar-track"><div class="gap-bar-fill-progress" style="width:${progressBar}%"></div></div></div><div class="gap-bar-row"><span>コスト消化率 ${pct(r.costConsumptionRate)}</span><div class="gap-bar-track"><div class="gap-bar-fill-cost" style="width:${costBar}%"></div></div></div><div class="muted">ギャップ: <b>${r.progressCostGap >= 0 ? '+' : ''}${pct(r.progressCostGap)}pt</b> / 判定: ${r.progressCostGapLabel} / 差額: <span class="${varianceClass}">${yen(r.varianceAmount || 0)}</span></div></article>`;
    }).join('') || '<p class="muted">進捗率またはコスト消化率を算出できる案件がありません。</p>';
    document.getElementById('np_gap_rank_rows').innerHTML = gapTop.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.managementNo||'')}</td><td>${escapeHtml(r.projectName||'')}</td><td>${escapeHtml(r.projectCategory||'')}</td><td>${escapeHtml(r.itInvestmentNo||'')}</td><td>${escapeHtml(r.progressStatus||'')}</td><td class="right">${pct(r.progressRate)}</td><td class="right">${pct(r.costConsumptionRate)}</td><td class="right ${r.progressCostGap>0?'variance-positive':r.progressCostGap<0?'variance-negative':'variance-neutral'}">${r.progressCostGap>0?'+':''}${pct(r.progressCostGap)}pt</td><td><span class="gap-status-${r.progressCostGapStatus}">${r.progressCostGapLabel}</span></td><td class="right">${money(r.budgetAmount||0)}</td><td class="right">${money(r.forecastAmount||0)}</td><td class="right ${r.varianceAmount>0?'variance-positive':r.varianceAmount<0?'variance-negative':'variance-neutral'}">${money(r.varianceAmount||0)}</td></tr>`).join('') || '<tr><td colspan="13">対象なし</td></tr>';
    document.querySelectorAll('[data-gap-filter]').forEach(el => el.onclick = async () => { filterState.gapStatus = el.dataset.gapFilter || 'all'; await renderAll(); });
    const compareMode = document.getElementById('np_compare_mode').value; let compareRows=[];
    if(compareMode==='category') compareRows=payload.byProjectCategory||[]; else if(compareMode==='it') compareRows=payload.byItInvestmentNo||[]; else compareRows=(payload.byCostGroup||[]).map(v=>({label:v.costGroup,investmentForecastAmount:(v.costGroup||'').includes('投資')?v.forecastAmount:0,operationForecastAmount:(v.costGroup||'').includes('運用')?v.forecastAmount:0,varianceAmount:v.varianceAmount}));
    document.getElementById('np_compare_rows').innerHTML=compareRows.map(v=>{const label=v.projectCategory||v.itInvestmentNo||v.label||v.costGroup; return `<tr><td>${escapeHtml(label)}</td><td class="right">${money(v.investmentForecastAmount||0)}</td><td class="right">${money(v.operationForecastAmount||0)}</td><td class="right">${money(v.varianceAmount||0)}</td></tr>`;}).join('');
    document.getElementById('np_reason_rows').innerHTML=(payload.byVarianceReason||[]).map(r=>`<tr><td>${escapeHtml(r.varianceReason)}</td><td class="right">${fmt(r.projectCount)}</td><td class="right">${money(r.varianceAmount)}</td><td>${escapeHtml((r.mainProjects||[]).join(' / '))}</td></tr>`).join('');
    document.querySelectorAll('#np_rank_rows [data-management]').forEach(el=>el.onclick=async ()=>{filterState.selectedManagementNo = el.dataset.management || ''; await renderAll(); const hit=document.querySelector(`#np_detail_rows tr[data-management="${CSS.escape(filterState.selectedManagementNo)}"]`); if(hit){hit.scrollIntoView({behavior:'smooth',block:'center'}); hit.classList.add('warning-row'); setTimeout(()=>hit.classList.remove('warning-row'),1200);} });
  };

  Object.keys(options).forEach(k=>document.getElementById(`npf_${k}`).onchange=async e=>{
    filterState[k]=e.target.value;
    if (k === 'fiscalPeriod') refreshTargetMonthOptions();
    await renderAll();
  });
  refreshTargetMonthOptions();
  document.getElementById('npf_keyword').oninput=async e=>{filterState.keyword=e.target.value; await renderAll();};
  document.getElementById('np_rank_sort').onchange=async e=>{filterState.rankSort=e.target.value; await renderAll();};
  document.getElementById('np_compare_mode').onchange=renderAll;
  bindMoneyUnitControl('np_unit', state.ui.units.newProject, (next) => updateMoneyUnit('newProject', next, renderProject));
  renderAll();
}


function renderAlert() {
  const money = (value) => formatMoneyByUnit(value, state.ui.units.alert);
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
      <dl class="metric-list"><div><dt>差額</dt><dd class="warn">${money(r.gap)}</dd></div><div><dt>乖離率</dt><dd>${pct(r.rate)}</dd></div></dl>
      <p class="muted">${escapeHtml(r.department_name || '-')} / ${escapeHtml(r.system_name || '-')}</p><p>差額理由分類: ${displayHtml(r.variance_reason_category)} / 差額理由: ${displayHtml(r.variance_reason)}</p><p>コメント: ${displayHtml(r.comment)}</p>
      <button type="button" data-mid="${dataAttr(r.management_no)}" aria-label="${dataAttr(r.project_name || r.management_no)}の明細を表示">明細を見る</button>
    </article>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="panel alert-overview">
      <div class="controls"><span>金額単位</span>${moneyUnitSegmentedControlHtml('alert_unit', state.ui.units.alert)}<span class="badge">しきい値: 乖離率 ${t.varianceRate}% / 差額 ${money(t.amountGap)} / 前月比 ${t.momRate}% / 前年比 ${t.yoyRate}%</span></div>
      <div class="alert-grid">${alertCards || '<div class="ok">● アラート対象なし</div>'}</div>
    </div>
    <div class="grid-2">
      <div class="panel"><h4>アラート一覧</h4><div class="table-wrap"><table><thead><tr><th>案件</th><th class="right">差額</th><th class="right">乖離率</th><th>状態</th><th>差額理由分類</th><th>差額理由</th><th>コメント</th></tr></thead><tbody>
        ${rows.slice(0, 200).map(r => `<tr data-mid="${dataAttr(r.management_no)}" class="clickable-row warning-row"><td>${escapeHtml(r.project_name || r.management_no)}</td><td class="right warn">${money(r.gap)}</td><td class="right">${pct(r.rate)}</td><td><span class="status-pill status-pill--warn">⚠️ 要確認</span></td><td>${displayHtml(r.variance_reason_category)}</td><td>${displayHtml(r.variance_reason)}</td><td>${displayHtml(r.comment)}</td></tr>`).join('') || '<tr><td colspan="7">対象なし</td></tr>'}
      </tbody></table></div></div>
      <div class="panel"><h4>最重要アラートの詳細</h4>${first ? `<p><b>${escapeHtml(first.project_name || first.management_no)}</b></p><p>推移: 予算 ${money(first.totalPlan)} / 実績 ${money(first.totalActual)}</p><p>関連明細: ${escapeHtml(first.system_name || '-')} / ${escapeHtml(first.department_name || '-')}</p><p>差額理由分類: ${displayHtml(first.variance_reason_category)} / 差額理由: ${displayHtml(first.variance_reason)}</p><p>コメント: ${displayHtml(first.comment)}</p><p>メモ欄: ${escapeHtml(first.memo || 'CSV列なし')}</p><button id="alertDetailBtn" type="button">詳細説明を開く</button><dialog id="alertDetailDialog" aria-labelledby="alertDialogTitle"><h3 id="alertDialogTitle">アラートの読み方</h3><p>差額・乖離率の両方を確認し、対象案件の明細で月次推移と担当部門を確認してください。</p><form method="dialog"><button>閉じる</button></form></dialog>` : 'アラート対象なし'}</div>
    </div>`;

  bindDetailFilterLinks();
  bindManagementNoDrilldowns();
  const dialog = document.getElementById('alertDetailDialog');
  const btn = document.getElementById('alertDetailBtn');
  if (dialog && btn) btn.onclick = () => dialog.showModal();
  bindMoneyUnitControl('alert_unit', state.ui.units.alert, (next) => updateMoneyUnit('alert', next, renderAlert));
}

function renderVendor() {
  const money = (value) => formatMoneyByUnit(value, state.ui.units.vendor);
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
      <div class="bento-card bento-card--wide"><div class="card-title-row"><h4>ベンダー別支払額ランキング</h4><span>金額単位</span>${moneyUnitSegmentedControlHtml('vendor_unit', state.ui.units.vendor)}<span class="badge">集中リスク確認</span></div><div class="table-wrap"><table><thead><tr><th>ベンダー</th><th class="right">支払額</th><th class="right">件数</th><th>状態</th></tr></thead><tbody>
        ${ranking.map((v, idx) => `<tr class="clickable-row" data-filter-type="vendor" data-filter-value="${dataAttr(v.name)}"><td>${escapeHtml(v.name)}</td><td class="right">${money(v.amount)}</td><td class="right">${fmt(v.count)}</td><td><span class="status-pill status-pill--${idx < 3 ? 'warn' : 'neutral'}">${idx < 3 ? '⚠️ 上位集中' : '● 通常'}</span></td></tr>`).join('') || '<tr><td colspan="4">データなし</td></tr>'}
      </tbody></table></div></div>
      <div class="bento-card bento-card--wide"><div class="card-title-row"><h4>契約更新・見直し一覧</h4><span class="badge">契約属性とアラート</span></div><div class="table-wrap"><table><thead><tr><th>ベンダー名</th><th>案件名</th><th>支払区分</th><th>契約開始日</th><th>契約終了日</th><th>次回更新予定月</th><th class="right">残月数</th><th>アラート区分</th><th>見直し要否</th><th>備考</th></tr></thead><tbody>
        ${contractRows.map(r => `<tr class="${r.review_required ? 'warning-row' : ''}"><td>${escapeHtml(r.vendor_name || '未設定ベンダー')}</td><td>${escapeHtml(r.project_name || r.system_name || '-')}</td><td>${escapedContractValueForHtml(r.payment_category)}</td><td>${escapeHtml(displayContractDate(r.contract_start_date, r.contract_start_date_status))}</td><td>${escapeHtml(displayContractDate(r.contract_end_date, r.contract_end_date_status))}</td><td>${escapedContractValueForHtml(r.next_renewal_month || r.renewal_month)}</td><td class="right">${escapeHtml(r.months_until_renewal ?? '-')}</td><td>${escapeHtml(r.alert_type || '通常')}</td><td><span class="status-pill status-pill--${r.review_required ? 'warn' : 'neutral'}">${r.review_required ? '要見直し' : '不要'}</span></td><td>${escapedContractValueForHtml(r.note)}</td></tr>`).join('') || '<tr><td colspan="10">契約データなし</td></tr>'}
      </tbody></table></div></div>
    </section>`;

  bindDetailFilterLinks();
  bindMoneyUnitControl('vendor_unit', state.ui.units.vendor, (next) => updateMoneyUnit('vendor', next, renderVendor));
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
      <div class="badge">推奨の閲覧順：1. データ取込 → 2. 全体サマリー → 5. アラート → 7. 明細</div>
    </div>
    <div class="panel"><h3>画面別ガイド（見方と操作方法）</h3>
      <h4>1. データ取込</h4>
      <p><strong>見方：</strong>画面上部で読込済みデータ件数、下部でプレビュー表を確認します。赤字や警告バッジがある場合は、列名不一致や数値変換エラーの可能性があります。</p>
      <ul>
        <li><strong>操作：</strong>「ファイル選択」からCSV／Excelを選び、読込後にプレビューで先頭行・金額列・年月列が正しいか確認します。</li>
        <li><strong>操作：</strong>複数ファイルを順に読み込む場合は、マスタ → 明細の順で取り込むと関連項目が補完されやすくなります。</li>
        <li><strong>ポイント：</strong>読み込み後は必ず「2. 全体サマリー」で総額が想定値と一致するかを最初に確認してください。</li>
      </ul>
      <h4>2. 全体サマリー（月次レポート）</h4>
      <p><strong>見方：</strong>予算・見込・実績の合計、差額、達成率をカードとグラフで俯瞰します。色分け（良化/悪化）で当月の状態を即時判断できます。</p>
      <ul>
        <li><strong>操作：</strong>月・部門・カテゴリのフィルタを絞り、会議対象スコープに合わせて数値を再計算します。</li>
        <li><strong>操作：</strong>主要KPIカードを上から順に確認し、差額の大きい項目を「5. アラート」「7. 明細」に遷移して深掘りします。</li>
      </ul>
      <h4>3. 推移（前年差／トレンド）</h4>
      <p><strong>見方：</strong>月次推移線で季節性と異常点を見ます。前年差（YoY）や前月差（MoM）を同時表示し、単月要因か継続傾向かを切り分けます。</p>
      <ul>
        <li><strong>操作：</strong>比較軸（実績/予算/見込）を切り替え、必要に応じて表示期間を四半期・通期へ変更します。</li>
        <li><strong>操作：</strong>急増月をクリックして対象月を固定し、「7. 明細」で要因レコードを特定します。</li>
      </ul>
      <h4>4. カテゴリ別分析</h4>
      <p><strong>見方：</strong>費目・部門・案件別の構成比と差異を確認します。構成比が高く差額も大きいカテゴリが優先改善対象です。</p>
      <ul>
        <li><strong>操作：</strong>並び替えを「差額順」「構成比順」で切り替え、重点カテゴリを抽出します。</li>
        <li><strong>操作：</strong>カテゴリ選択後に下位明細（ベンダー/案件）へドリルダウンし、改善アクション候補を整理します。</li>
      </ul>
      <h4>5. アラート（乖離・変動）</h4>
      <p><strong>見方：</strong>閾値超過の項目を一覧表示します。乖離率・乖離額・変動率の3観点で優先順位をつけます。</p>
      <ul>
        <li><strong>操作：</strong>「11. 表示設定」で設定した閾値に基づき、対象が自動抽出されます。会議前に閾値が妥当か再確認してください。</li>
        <li><strong>操作：</strong>アラート行を選択して「7. 明細」に遷移し、根拠データと説明コメントを準備します。</li>
      </ul>
      <h4>6. ベンダー／契約更新</h4>
      <p><strong>見方：</strong>ベンダー別支出、契約更新時期、増減率を確認します。更新月が近く増額傾向の契約は要交渉候補です。</p>
      <ul>
        <li><strong>操作：</strong>更新期限で絞り込み、今四半期に対応が必要な契約を抽出します。</li>
        <li><strong>操作：</strong>ベンダー単位で前年差を確認し、継続・減額・解約の判断材料を作成します。</li>
      </ul>
      <h4>7. 明細（検索・ドリルダウン）</h4>
      <p><strong>見方：</strong>全画面で気になった数値の根拠を、明細レコードで追跡する画面です。最終的な説明責任を担う基礎データになります。</p>
      <ul>
        <li><strong>操作：</strong>自由検索（案件名、ベンダー名、摘要）と複合フィルタ（年月、部門、費目）で対象を絞り込みます。</li>
        <li><strong>操作：</strong>列ヘッダでソートし、金額上位・変動上位を特定してコメント欄や報告資料に転記します。</li>
      </ul>
      <h4>8. 新規案件コスト</h4>
      <p><strong>見方：</strong>新規案件の初期費用・運用費・回収見込みを集計し、予算インパクトを確認します。</p>
      <ul>
        <li><strong>操作：</strong>案件フェーズ（検討/実行/運用）で絞り込み、当期に効くコストを把握します。</li>
        <li><strong>操作：</strong>案件を選択して月次配賦を確認し、既存予算への吸収可否を判断します。</li>
      </ul>
      <h4>9. 減価償却シミュレーション</h4>
      <p><strong>見方：</strong>資産カテゴリ別に償却費推移を表示し、期別の費用平準化や将来負担を確認します。</p>
      <ul>
        <li><strong>操作：</strong>期（例：70期）とカテゴリを選択し、対象範囲を切り替えます。</li>
        <li><strong>操作：</strong>月別推移を確認し、予算ピーク月を「2. 全体サマリー」と照合して説明資料に反映します。</li>
      </ul>
      <h4>10. OACIS実績</h4>
      <p><strong>見方：</strong>OACIS由来の実績データを対象に、他データソースとの差異や遅延計上の有無を確認します。</p>
      <ul>
        <li><strong>操作：</strong>対象期間を指定し、実績反映タイミングのズレを確認します。</li>
        <li><strong>操作：</strong>差異が大きい場合は「7. 明細」で対象伝票を追跡し、取込元データの再確認を行います。</li>
      </ul>
      <h4>11. 表示設定</h4>
      <p><strong>見方：</strong>アラート閾値、KPI表示順、表示倍率、テーマを管理します。運用チーム全体で基準を揃えるための画面です。</p>
      <ul>
        <li><strong>操作：</strong>乖離率・乖離額・MoM/YoY閾値を調整し、「5. アラート」の検出感度を最適化します。</li>
        <li><strong>操作：</strong>表示倍率（75〜150%）とテーマを変更して、会議室の投影環境に合わせます。</li>
      </ul>
      <h4>12. 使い方（本画面）</h4>
      <p><strong>見方：</strong>各画面で迷った際の早見表です。まず「どの数字を確認したいか」を決め、対応する画面へ移動してください。</p>
      <ul>
        <li><strong>操作：</strong>推奨フロー「1 → 2 → 5 → 7」を基本に、必要に応じて3/4/6/8/9/10を往復します。</li>
        <li><strong>操作：</strong>画面の表示が見づらい場合は「11. 表示設定」で倍率とテーマを調整してください。</li>
      </ul>
      <ul><li>メニュー順と番号は完全同期しています。</li><li>表示倍率・テーマは「11. 表示設定」から変更してください。</li></ul>
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

function drawDepreciationBarChart(canvasId, labels, values, label, unit = 'thousand') {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const colors = chartColors();
  new Chart(el, { type: 'bar', data: { labels, datasets: [{ label, data: values, backgroundColor: colors.c2, borderColor: colors.c1, borderWidth: 1 }] }, options: baseChartOptions({ indexAxis: labels.length > 8 ? 'y' : 'x', maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => formatMoneyByUnit(ctx.parsed.x ?? ctx.parsed.y, unit) } } }, scales: { x: { beginAtZero: true, ticks: { color: 'var(--text)', callback: value => formatMoneyByUnit(value, unit) }, grid: { color: 'var(--line)' } }, y: { beginAtZero: true, ticks: { color: 'var(--text)' }, grid: { color: 'var(--line)' } } } }) });
}

function renderDepreciation() {
  const money = (value) => formatMoneyByUnit(value, state.ui.units.depreciation);
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
        <span>金額単位</span>${moneyUnitSegmentedControlHtml('depreciation_unit', state.ui.units.depreciation)}
        <label>期 <select id="depFiscalPeriod">${periods.map(v => optionHtml(v, selectedPeriod)).join('')}</select></label>
        <label>償却展開区分名 <select id="depCategoryName"><option value="">全区分</option>${names.map(v => optionHtml(v, filters.categoryName)).join('')}</select></label>
      </div>
      <div id="dep_kpi_strip" class="kpi-strip"></div>
    </div>
    <div class="dashboard-bento depreciation-bento">
      <section class="panel bento-card bento-card--wide chart-card"><h3>月次推移（4月〜翌年3月）</h3><div class="chart-frame chart-frame--large"><canvas id="depMonthlyChart"></canvas></div></section>
      <section class="panel bento-card bento-card--small chart-card"><h3>65期〜70期 通期推移</h3><div class="chart-frame"><canvas id="depPeriodChart"></canvas></div></section>
      <section class="panel bento-card bento-card--small ranking-card"><h3>償却展開区分別 Top10</h3><div class="table-wrap"><table><thead><tr><th>区分名</th><th class="right">通期償却費</th></tr></thead><tbody>${top10.map(row => `<tr><td>${escapeHtml(row.depreciation_category_name)}</td><td class="right">${money(row.full)}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel bento-card bento-card--small ranking-card"><h3>前期差ランキング</h3><div class="table-wrap"><table><thead><tr><th>区分名</th><th class="right">前期差</th><th class="right">差率</th></tr></thead><tbody>${diffTop.map(row => `<tr><td>${escapeHtml(row.depreciation_category_name)}</td><td class="right ${row.previousDiff < 0 ? 'ok' : 'warn'}">${money(row.previousDiff)}</td><td class="right">${pct(row.previousDiffRate)}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel bento-card bento-card--wide"><h3>半期・通期 / 明細一覧</h3><div class="table-wrap"><table><thead><tr><th>区分</th><th>償却展開区分</th><th>償却展開区分名</th><th class="right">選択期上期</th><th class="right">選択期下期</th><th class="right">選択期通期</th><th class="right">前期通期</th><th class="right">前期差</th><th class="right">前期差率</th></tr></thead><tbody>${detailRows.map(row => `<tr><td>${escapeHtml(row.division)}</td><td>${escapeHtml(row.depreciation_category)}</td><td>${escapeHtml(row.depreciation_category_name)}</td><td class="right">${money(row.h1)}</td><td class="right">${money(row.h2)}</td><td class="right">${money(row.full)}</td><td class="right">${money(row.previousFull)}</td><td class="right ${row.previousDiff < 0 ? 'ok' : 'warn'}">${money(row.previousDiff)}</td><td class="right">${pct(row.previousDiffRate)}</td></tr>`).join('')}</tbody></table></div></section>
    </div>`;

  document.getElementById('depFiscalPeriod').onchange = (event) => { state.ui.depreciationFilters.fiscalPeriod = event.target.value; renderPage(); };
  document.getElementById('depCategoryName').onchange = (event) => { state.ui.depreciationFilters.categoryName = event.target.value; renderPage(); };
  const depScope = `${selectedPeriod}期 / ${filters.categoryName || '全区分'}`;
  document.getElementById('dep_kpi_strip').innerHTML = [
    ['通期償却費', money(full), '選択期の償却費合計です。', '確認対象', 'neutral'],
    ['上期償却費', money(h1), 'H1の償却費合計です。', '確認対象', 'neutral'],
    ['下期償却費', money(h2), 'H2の償却費合計です。', '確認対象', 'neutral'],
    ['上期下期差', money(h2 - h1), '下期 - 上期の差分です。', '確認対象', 'neutral'],
    ['前期差', money(full - previousFull), `前期通期 ${money(previousFull)} との差分です。`, full - previousFull < 0 ? '改善' : '要確認', full - previousFull < 0 ? 'ok' : 'warn'],
    ['最大区分', escapeHtml(topCategory?.depreciation_category_name || '-'), topCategory ? `${topCategory.depreciation_category_name} が最大（${money(topCategory.full)}）です。` : '該当データなし', '確認対象', 'neutral'],
  ].map(([l, v, h, st, tone], idx) => standardKpiCardHtml({ label: l, valueHtml: v, helpText: h, note: h, statusLabel: st, tone, scopeText: depScope }, idx)).join('');
  animateNumericValues(content);
  bindMoneyUnitControl('depreciation_unit', state.ui.units.depreciation, (next) => updateMoneyUnit('depreciation', next, renderDepreciation));
  drawDepreciationMonthlyChart('depMonthlyChart', scoped);
  drawDepreciationBarChart('depPeriodChart', transitionPeriods.map(p => `${p}期`), transitionValues, '通期償却費', state.ui.units.depreciation);
}

function renderOacisActual() {
  const money = (value) => formatMoneyByUnit(value, state.ui.units.oacis);
  const payload = state.data.oacisActual || { summary: {}, byExpenseEvent: [], bySupplier: [], byYojitsuNo: [], missingYojitsuNoRows: [] };
  const s = payload.summary || {};
  const asPct = v => `${Number(v || 0).toFixed(1)}%`;
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="panel">
      <div class="controls"><span>金額単位</span>${moneyUnitSegmentedControlHtml('oacis_unit', state.ui.units.oacis)}</div><div id="oacis_kpi_strip" class="kpi-strip oacis-kpi-strip"></div>
    </div>
    <div class="oacis-ranking-grid">
      <section class="panel bento-card"><h3>経費事象別ランキング（上位20）</h3><div class="table-wrap"><table><thead><tr><th>経費事象コード</th><th>経費事象名</th><th class="right">実績額</th><th class="right">明細件数</th><th class="right">構成比</th></tr></thead><tbody>${(payload.byExpenseEvent || []).map(r => `<tr><td>${escapeHtml(r.expense_event_code || '')}</td><td>${escapeHtml(r.expense_event_name || '')}</td><td class="right">${money(r.amount || 0)}</td><td class="right">${fmt(r.rowCount || 0)}</td><td class="right">${asPct(r.shareRate)}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel bento-card"><h3>サプライヤ別ランキング（上位20）</h3><div class="table-wrap"><table><thead><tr><th>サプライヤ</th><th class="right">実績額</th><th class="right">明細件数</th><th class="right">構成比</th><th>主な経費事象名</th></tr></thead><tbody>${(payload.bySupplier || []).map(r => `<tr><td>${escapeHtml(r.supplier || '')}</td><td class="right">${money(r.amount || 0)}</td><td class="right">${fmt(r.rowCount || 0)}</td><td class="right">${asPct(r.shareRate)}</td><td>${escapeHtml(r.mainExpenseEventName || '')}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel bento-card"><h3>予実番号別ランキング（上位20）</h3><div class="table-wrap"><table><thead><tr><th>予実番号</th><th class="right">実績額</th><th class="right">明細件数</th><th>主な経費事象名</th><th>主なサプライヤ</th></tr></thead><tbody>${(payload.byYojitsuNo || []).map(r => `<tr><td>${escapeHtml(r.yojitsu_no || '')}</td><td class="right">${money(r.amount || 0)}</td><td class="right">${fmt(r.rowCount || 0)}</td><td>${escapeHtml(r.mainExpenseEventName || '')}</td><td>${escapeHtml(r.mainSupplier || '')}</td></tr>`).join('')}</tbody></table></div></section>
    </div>
    <section class="panel bento-card oacis-alert-table"><h3>予実番号未設定（要確認）明細</h3><div class="table-wrap"><table><thead><tr><th>会計日</th><th>実績部店名</th><th>経費事象名</th><th>経費事象細目名</th><th>サプライヤ</th><th class="right">実績額</th><th>仕訳摘要</th><th>仕訳明細摘要</th><th>請求書番号</th></tr></thead><tbody>${(payload.missingYojitsuNoRows || []).map(r => `<tr><td>${escapeHtml(formatYearMonth(r.accounting_date) || r.accounting_date || '')}</td><td>${escapeHtml(r.actual_department_name || '')}</td><td>${escapeHtml(r.expense_event_name || '')}</td><td>${escapeHtml(r.expense_event_detail_name || '')}</td><td>${escapeHtml(r.supplier || '')}</td><td class="right">${money(r.amount || 0)}</td><td>${escapeHtml(r.journal_summary || '')}</td><td>${escapeHtml(r.journal_detail_summary || '')}</td><td>${escapeHtml(r.invoice_no || '')}</td></tr>`).join('')}</tbody></table></div></section>
  `;
  document.getElementById('oacis_kpi_strip').innerHTML = [
    ['実績合計額', money(s.totalAmount || 0), '対象データの実績金額合計です。'],
    ['明細件数', fmt(s.rowCount || 0), '対象データの明細件数です。'],
    ['経費事象数', fmt(s.expenseEventCount || 0), '対象データに含まれる経費事象数です。'],
    ['サプライヤ数', fmt(s.supplierCount || 0), '対象データに含まれるサプライヤ数です。'],
    ['予実番号あり金額', money(s.yojitsuNoPresentAmount || 0), '予実番号が設定されている明細の金額合計です。'],
    ['予実番号なし金額', money(s.yojitsuNoMissingAmount || 0), '予実番号が未設定の明細金額合計です。'],
  ].map(([l, v, h], idx) => standardKpiCardHtml({ label: l, valueHtml: v, helpText: h, note: h, scopeText: 'OACIS実績 / 全体' }, idx)).join('');
  bindMoneyUnitControl('oacis_unit', state.ui.units.oacis, (next) => updateMoneyUnit('oacis', next, renderOacisActual));
}

async function renderPage() {
  document.getElementById('pageTitle').textContent = NAV_PAGES.find(p => p.key === state.page)?.label || '';
  if (state.page === 'import') return renderImport();
  if (state.page === 'settings') return renderSettings();
  if (state.page === 'manual') return renderManual();
  if (state.page === 'account') return renderSettings();
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
      <p id="manualHintDesc">チュートリアルは「A2. 取扱説明書（マニュアル）」から確認できます。</p>
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
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.onclick = toggleTheme;
  document.getElementById('sidebarCollapse').onclick = () => document.body.classList.toggle('sidebar-collapsed');
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const mobileMenuBackdrop = document.getElementById('mobileMenuBackdrop');
  if (mobileMenuToggle && mobileMenuBackdrop) {
    mobileMenuToggle.onclick = () => {
      const willOpen = !document.body.classList.contains('mobile-menu-open');
      document.body.classList.toggle('mobile-menu-open', willOpen);
      mobileMenuToggle.setAttribute('aria-expanded', String(willOpen));
    };
    mobileMenuBackdrop.onclick = closeMobileMenu;
  }
  if (themeToggle) themeToggle.title = 'ライト / ダーク / ネオン';
  const zoomOut = document.getElementById('zoomOut');
  if (zoomOut) zoomOut.onclick = () => changeDisplayZoom(-APP_ZOOM.step);
  const zoomIn = document.getElementById('zoomIn');
  if (zoomIn) zoomIn.onclick = () => changeDisplayZoom(APP_ZOOM.step);
  const zoomReset = document.getElementById('zoomReset');
  if (zoomReset) zoomReset.onclick = () => setDisplayZoom(APP_ZOOM.defaultValue);
  const quickSettings = document.getElementById('quickSettings');
  if (quickSettings) quickSettings.onclick = () => goPage('settings');
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
