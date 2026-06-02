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
this.getYearMonthOptions = getYearMonthOptions;`, context);

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

test('global fiscal period month options cascade from 67期 base calendar', () => {
  const context = createRenderHarness();
  context.state.data.status = {
    periods: ['66', '67', '68'],
    sortedYMs: ['202504', '202604', '202703', '202704'],
    departments: [],
    vendors: [],
  };
  context.state.data.items = [
    { fiscal_period: '67', monthly: { '202604': { plan: 1 }, '202703': { plan: 1 }, '202704': { plan: 1 } } },
    { fiscal_period: '66', monthly: { '202504': { plan: 1 } } },
  ];
  context.state.filters.fiscalPeriod = '67';
  context.state.filters.fiscalPeriodFrom = '67';
  context.state.filters.fiscalPeriodTo = '67';
  context.state.filters.targetYearMonth = '202704';

  context.normalizeGlobalScopeFilters();
  const yms = context.getYearMonthOptions();

  assert.equal(yms[0], '202604');
  assert.equal(yms.at(-1), '202703');
  assert.equal(yms.includes('202704'), false);
  assert.equal(context.state.filters.targetYearMonth, '202703');
});

