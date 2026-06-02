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
    localStorage: { getItem: () => null, setItem: () => {} },
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
this.initFilterBar = initFilterBar;`, context);

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

test('global period scope defaults to single month without always-visible fiscal range controls', async () => {
  const context = createRenderHarness();

  await context.__runPage('summary');
  context.initFilterBar();
  const filterHtml = context.document.getElementById('globalFilters').innerHTML;

  assert.match(filterHtml, /period-scope-control/);
  assert.match(filterHtml, /対象期間/);
  assert.doesNotMatch(filterHtml, /対象期\(自\)/);
  assert.doesNotMatch(filterHtml, /対象期\(至\)/);
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

