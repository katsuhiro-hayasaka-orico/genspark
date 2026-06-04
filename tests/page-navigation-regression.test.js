const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function createRenderHarness() {
  const appJs = fs.readFileSync('public/static/app.js', 'utf8');
  const bootIndex = appJs.indexOf('\n(async function boot()');
  assert.notEqual(bootIndex, -1, 'boot function should exist');
  const codeWithoutBoot = appJs.slice(0, bootIndex);

  const elements = new Map();
  const storage = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        innerHTML: '',
        textContent: '',
        className: '',
        value: '',
        dataset: {},
        style: {},
        onclick: null,
        onchange: null,
        oninput: null,
        querySelector: () => ({ value: '', onchange: null }),
        querySelectorAll: () => [],
        insertAdjacentHTML(position, html) {
          this.innerHTML = position === 'afterbegin' ? html + this.innerHTML : this.innerHTML + html;
        },
      });
    }
    return elements.get(id);
  };

  const context = {
    console,
    setTimeout,
    localStorage: {
      getItem: (key) => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
      clear: () => storage.clear(),
    },
    document: {
      body: { dataset: {}, insertAdjacentHTML: () => {} },
      getElementById: getElement,
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: () => ({ click: () => {} }),
    },
    Chart: function Chart() {},
    Blob: function Blob() {},
    URL: { createObjectURL: () => 'blob:mock' },
  };

  vm.createContext(context);
  vm.runInContext(`${codeWithoutBoot}\nthis.__runPage = async (page) => {\n  state.hasData = true;\n  state.page = page;\n  state.filters.fiscalPeriod = '81';\n  state.filters.targetYearMonth = '202504';\n  state.data.status = {\n    periods: ['81'],\n    sortedYMs: ['202504'],\n    departments: ['IT'],\n    vendors: ['テストベンダー'],\n    itemCount: 1,\n  };\n  state.data.items = [{\n    management_no: 'M-001',\n    project_name: 'テスト案件',\n    department_name: 'IT',\n    vendor_name: 'テストベンダー',\n    payee_name: 'テストベンダー',\n    system_name: 'テストシステム',\n    budget_category: '運用',\n    fiscal_period: '81',\n    fiscal_year: 2025,\n    totalPlan: 1000,\n    totalForecast: 900,\n    totalActual: 800,\n    monthly: { '202504': { plan: 1000, forecast: 900, actual: 800 } },\n  }];\n  state.data.contracts = [{\n    vendor_name: 'テストベンダー',\n    project_name: 'テスト案件',\n    review_required: true,\n    months_until_renewal: 2,\n  }];\n  await renderPage();\n  return document.getElementById('content').innerHTML;\n};
this.state = state;
this.normalizeGlobalScopeFilters = normalizeGlobalScopeFilters;
this.getYearMonthOptions = getYearMonthOptions;
this.filteredItems = filteredItems;
this.formatScopeSummary = formatScopeSummary;
this.initFilterBar = initFilterBar;
this.resolveDefaultTargetYearMonth = resolveDefaultTargetYearMonth;
this.presetMonthRange = presetMonthRange;
this.buildTimeSeries = buildTimeSeries;
this.loadPeriodQuickFilters = loadPeriodQuickFilters;
this.savePeriodQuickFilters = savePeriodQuickFilters;
this.getEnabledPeriodQuickFilters = getEnabledPeriodQuickFilters;
this.resolvePeriodQuickFilter = resolvePeriodQuickFilter;
this.addCurrentScopeToQuickFilters = addCurrentScopeToQuickFilters;
this.renderSettings = renderSettings;
this.displayFiscalYearFromFiscalPeriod = displayFiscalYearFromFiscalPeriod;
this.importFileTypeOptions = IMPORT_FILE_TYPE_OPTIONS;`, context);

  return context;
}

test('summary, vendor, and detail pages render without leaving prior content in place', async () => {
  const context = createRenderHarness();

  const summaryHtml = await context.__runPage('summary');
  assert.match(summaryHtml, /経営サマリーダッシュボード/);

  const vendorHtml = await context.__runPage('vendor');
  assert.match(vendorHtml, /ベンダー別支払額ランキング/);

  const detailHtml = await context.__runPage('detail');
  assert.match(detailHtml, /明細テーブル/);
});

test('global period scope uses compact trigger without topbar aggregation axis', async () => {
  const context = createRenderHarness();

  await context.__runPage('summary');
  context.initFilterBar();
  const filterHtml = context.document.getElementById('globalFilters').innerHTML;

  assert.match(filterHtml, /period-scope-trigger/);
  assert.match(filterHtml, /対象期間/);
  assert.match(filterHtml, /部門/);
  assert.match(filterHtml, /分析軸/);
  assert.match(filterHtml, /対象/);
  assert.doesNotMatch(filterHtml, /集計軸/);
  assert.doesNotMatch(filterHtml, /月次/);
  assert.doesNotMatch(filterHtml, /四半期/);
  assert.doesNotMatch(filterHtml, /通期/);
  assert.doesNotMatch(filterHtml, /対象期\(自\)/);
  assert.doesNotMatch(filterHtml, /対象期\(至\)/);
});


test('summary report fiscal period displays FY as fiscal-period end year', () => {
  const context = createRenderHarness();

  assert.equal(context.displayFiscalYearFromFiscalPeriod('67'), 2027);
  assert.equal(context.displayFiscalYearFromFiscalPeriod('66'), 2026);
});

test('import file type options align additional CSV order with side menu', () => {
  const context = createRenderHarness();
  const values = context.importFileTypeOptions.map(option => option.value);

  assert.ok(values.indexOf('depreciation_simulation') < values.indexOf('oasis_actual'));
});

test('period scope popover renders required tabs', () => {
  const context = createRenderHarness();
  context.state.hasData = true;
  context.state.page = 'summary';
  context.state.data.status = { periods: ['66', '67'], sortedYMs: ['202604', '202605', '202606'], departments: [], vendors: [] };
  context.state.data.items = [];
  context.state.ui.periodScopePopoverOpen = true;

  context.initFilterBar();
  const filterHtml = context.document.getElementById('globalFilters').innerHTML;

  assert.match(filterHtml, /period-scope-menu/);
  assert.match(filterHtml, /よく使う/);
  assert.match(filterHtml, /月で指定/);
  assert.match(filterHtml, /期で指定/);
  assert.match(filterHtml, /検索/);
  assert.match(filterHtml, /当月/);
  assert.match(filterHtml, /データ最新月/);
});


test('default target month and presets use browser date rather than future data latest month', () => {
  const context = createRenderHarness();
  const yms = ['202504', '202605', '202606', '202803'];
  const date = new Date('2026-06-02T00:00:00');

  assert.equal(context.resolveDefaultTargetYearMonth(yms, date), '202606');
  assert.equal(JSON.stringify(context.presetMonthRange('last3Months', yms, date)), JSON.stringify({ from: '202604', to: '202606' }));
  assert.equal(JSON.stringify(context.presetMonthRange('last12Months', yms, date)), JSON.stringify({ from: '202507', to: '202606' }));
  assert.equal(JSON.stringify(context.presetMonthRange('currentFiscalPeriodFull', yms, date)), JSON.stringify({ period: '67', from: '202604', to: '202703' }));
  assert.equal(JSON.stringify(context.presetMonthRange('currentFiscalPeriodFull', yms, new Date('2027-02-02T00:00:00'))), JSON.stringify({ period: '67', from: '202604', to: '202703' }));
  assert.equal(JSON.stringify(context.presetMonthRange('currentFiscalPeriodFull', yms, new Date('2026-03-02T00:00:00'))), JSON.stringify({ period: '66', from: '202504', to: '202603' }));
  assert.equal(JSON.stringify(context.presetMonthRange('previousFiscalPeriodFull', yms, date)), JSON.stringify({ period: '66', from: '202504', to: '202603' }));
  assert.equal(JSON.stringify(context.presetMonthRange('dataLatestMonth', yms, date)), JSON.stringify({ from: '202803', to: '202803' }));
});


test('period quick filters are persisted and drive the frequently used tab', () => {
  const context = createRenderHarness();
  context.state.hasData = true;
  context.state.page = 'summary';
  context.state.data.status = { periods: ['66', '67'], sortedYMs: ['202604', '202605', '202606', '202803'], departments: [], vendors: [] };
  context.state.data.items = [];
  context.savePeriodQuickFilters([
    { id: 'currentMonth', type: 'builtInPreset', label: '当月', enabled: false },
    { id: 'currentFiscalPeriodFull', type: 'builtInPreset', label: '当期通期', enabled: true },
    { id: 'custom_202604_202609', type: 'fixedMonthRange', label: '2026年度 上期', enabled: true, fromYM: '202604', toYM: '202609' },
  ], 'currentFiscalPeriodFull');

  context.state.ui.periodScopePopoverOpen = true;
  context.initFilterBar();
  const filterHtml = context.document.getElementById('globalFilters').innerHTML;

  assert.doesNotMatch(filterHtml, /<strong>当月<\/strong>/);
  assert.match(filterHtml, /当期通期/);
  assert.match(filterHtml, /2026年度 上期/);
  assert.match(filterHtml, /現在の対象期間を「よく使う」に追加/);
  assert.equal(context.getEnabledPeriodQuickFilters().length, 2);
});

test('settings page exposes period quick filter customization', () => {
  const context = createRenderHarness();
  context.renderSettings();
  const html = context.document.getElementById('content').innerHTML;

  assert.match(html, /対象期間ショートカット/);
  assert.match(html, /よく使う/);
  assert.match(html, /初期表示/);
  assert.match(html, /初期設定に戻す/);
  assert.match(html, /データ最新月は取込データ内の最大年月/);
});

test('trend time series aggregation unit is independent from selected period scope', () => {
  const context = createRenderHarness();
  context.state.data.status = { periods: ['67'], sortedYMs: ['202604', '202605', '202606'], departments: [], vendors: [] };
  context.state.filters.scopeMode = 'custom';
  context.state.filters.scopePreset = 'custom';
  context.state.filters.customRangeUnit = 'month';
  context.state.filters.targetYearMonthFrom = '202604';
  context.state.filters.targetYearMonthTo = '202606';
  const items = [{ fiscal_period: '67', monthly: {
    '202604': { plan: 10, forecast: 8, actual: 6 },
    '202605': { plan: 20, forecast: 18, actual: 16 },
    '202606': { plan: 30, forecast: 28, actual: 26 },
  } }];

  context.normalizeGlobalScopeFilters();
  assert.equal(JSON.stringify(context.buildTimeSeries(items, 'month').labels), JSON.stringify(['202604', '202605', '202606']));
  assert.equal(JSON.stringify(context.buildTimeSeries(items, 'fiscalPeriod').labels), JSON.stringify(['第67期']));
  const cumulative = context.buildTimeSeries(items, 'cumulative');
  assert.equal(cumulative.bucket['202606'].plan, 60);
});

test('custom month range crosses fiscal periods without dropping needed rows', () => {
  const context = createRenderHarness();
  context.state.data.status = {
    periods: ['65', '66'],
    sortedYMs: ['202501', '202502', '202503', '202504', '202505', '202506'],
    departments: [],
    vendors: [],
  };
  context.state.data.items = [
    { fiscal_period: '65', monthly: { '202501': { plan: 10, forecast: 8, actual: 7 }, '202503': { plan: 20, forecast: 18, actual: 17 } }, totalPlan: 30, totalForecast: 26, totalActual: 24 },
    { fiscal_period: '66', monthly: { '202504': { plan: 30, forecast: 28, actual: 27 }, '202506': { plan: 40, forecast: 38, actual: 37 } }, totalPlan: 70, totalForecast: 66, totalActual: 64 },
  ];
  context.state.filters.scopeMode = 'custom';
  context.state.filters.scopePreset = 'custom';
  context.state.filters.customRangeUnit = 'month';
  context.state.filters.targetYearMonthFrom = '202501';
  context.state.filters.targetYearMonthTo = '202506';

  context.normalizeGlobalScopeFilters();
  const rows = context.filteredItems();

  assert.equal(context.state.filters.fiscalPeriodFrom, '65');
  assert.equal(context.state.filters.fiscalPeriodTo, '66');
  assert.equal(rows.length, 2);
  assert.equal(rows.reduce((sum, row) => sum + row.totalPlan, 0), 100);
  assert.match(context.formatScopeSummary(), /2025\/01〜2025\/06/);
});

test('custom fiscal period range expands to month range from the 67期 base calendar', () => {
  const context = createRenderHarness();
  context.state.data.status = {
    periods: ['66', '67'],
    sortedYMs: ['202504', '202603', '202604', '202703'],
    departments: [],
    vendors: [],
  };
  context.state.data.items = [];
  context.state.filters.scopeMode = 'custom';
  context.state.filters.scopePreset = 'custom';
  context.state.filters.customRangeUnit = 'fiscalPeriod';
  context.state.filters.fiscalPeriodFrom = '66';
  context.state.filters.fiscalPeriodTo = '67';

  context.normalizeGlobalScopeFilters();

  assert.equal(context.state.filters.targetYearMonthFrom, '202504');
  assert.equal(context.state.filters.targetYearMonthTo, '202703');
  assert.match(context.formatScopeSummary(), /第66期〜第67期/);
  assert.match(context.formatScopeSummary(), /2025\/04〜2027\/03/);
});

