const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadChartHarness() {
  const appJs = fs.readFileSync('public/static/app.js', 'utf8');
  const bootIndex = appJs.indexOf('\n(async function boot()');
  assert.notEqual(bootIndex, -1, 'boot function should exist');

  const charts = [];
  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, { id });
    return elements.get(id);
  };

  const context = {
    console,
    localStorage: { getItem: () => null, setItem: () => {} },
    document: {
      getElementById,
      querySelectorAll: () => [],
      querySelector: () => null,
    },
    Chart: function Chart(el, config) {
      charts.push({ el, config });
    },
    __charts: charts,
  };

  vm.createContext(context);
  vm.runInContext(appJs.slice(0, bootIndex), context);
  return context;
}

test('report combo chart converts thousand-yen data to oku-yen display scales', () => {
  const context = loadChartHarness();

  context.drawReportComboChart('reportComboChart', {
    labels: ['2025/04', '2025/05'],
    plan: [100000, 12340000],
    actualForecast: [200000, 510000],
    planCumulative: [100000, 12440000],
    actualForecastCumulative: [200000, 710000],
  });

  const chart = context.__charts.at(-1).config;
  assert.deepEqual(Array.from(chart.data.datasets[0].data), [1, 123.4]);
  assert.deepEqual(Array.from(chart.data.datasets[1].data), [2, 5.1]);
  assert.deepEqual(Array.from(chart.data.datasets[2].data), [1, 124.4]);
  assert.equal(chart.options.scales.y.min, 0);
  assert.equal(chart.options.scales.y.max, 40);
  assert.equal(chart.options.scales.y.ticks.stepSize, 5);
  assert.equal(chart.options.scales.y.ticks.autoSkip, false);
  const monthlyScale = { ticks: [] };
  chart.options.scales.y.afterBuildTicks(monthlyScale);
  assert.deepEqual(Array.from(monthlyScale.ticks.map(t => t.value)), [0, 5, 10, 15, 20, 25, 30, 35, 40]);
  assert.equal(chart.options.scales.y1.display, true);
  assert.equal(chart.options.scales.y1.min, 0);
  assert.equal(chart.options.scales.y1.max, 400);
  assert.equal(chart.options.scales.y1.ticks.stepSize, 50);
  assert.equal(chart.options.scales.y1.ticks.autoSkip, false);
  const cumulativeScale = { ticks: [] };
  chart.options.scales.y1.afterBuildTicks(cumulativeScale);
  assert.deepEqual(Array.from(cumulativeScale.ticks.map(t => t.value)), [0, 50, 100, 150, 200, 250, 300, 350, 400]);
  assert.equal(chart.data.datasets[3].hidden, false);
  assert.equal(chart.options.plugins.legend.display, true);
  assert.equal(chart.options.scales.y.ticks.callback(40), '40億円');
  assert.equal(chart.options.plugins.tooltip.callbacks.label({ dataset: { label: '月次計画（億円）' }, parsed: { y: 123 } }), '月次計画（億円）: 123.0億円');
  assert.equal(chart.options.plugins.tooltip.callbacks.label({ dataset: { label: '計画累計（億円）' }, parsed: { y: 1234 } }), '計画累計（億円）: 1,234.0億円');
});

test('depreciation monthly chart converts values immediately before rendering', () => {
  const context = loadChartHarness();

  const rows = [
    { period_type: 'month', fiscal_period: '81', month: '202504', month_key: '202504', amount: 100000 },
    { period_type: 'month', fiscal_period: '81', month: '202505', month_key: '202505', amount: 6200000 },
  ];
  context.drawDepreciationMonthlyChart('depMonthlyChart', rows);

  const chart = context.__charts.at(-1).config;
  assert.deepEqual(Array.from(chart.data.datasets[0].data), [1, 62]);
  assert.deepEqual(Array.from(chart.data.datasets[1].data), [1, 63]);
  assert.equal(chart.options.scales.y.min, 0);
  assert.equal(chart.options.scales.y.max, 40);
  assert.equal(chart.options.scales.y.ticks.stepSize, 5);
  assert.equal(chart.options.scales.y.ticks.autoSkip, false);
  const monthlyScale = { ticks: [] };
  chart.options.scales.y.afterBuildTicks(monthlyScale);
  assert.deepEqual(Array.from(monthlyScale.ticks.map(t => t.value)), [0, 5, 10, 15, 20, 25, 30, 35, 40]);
  assert.equal(chart.options.scales.y1.min, 0);
  assert.equal(chart.options.scales.y1.max, 400);
  assert.equal(chart.options.scales.y1.ticks.stepSize, 50);
  assert.equal(chart.options.scales.y1.ticks.autoSkip, false);
  const cumulativeScale = { ticks: [] };
  chart.options.scales.y1.afterBuildTicks(cumulativeScale);
  assert.deepEqual(Array.from(cumulativeScale.ticks.map(t => t.value)), [0, 50, 100, 150, 200, 250, 300, 350, 400]);
  assert.equal(chart.options.scales.y1.ticks.callback(50), '50億円');
  assert.equal(chart.options.plugins.legend.display, true);
  assert.equal(chart.options.plugins.tooltip.callbacks.label({ dataset: { label: '累計償却費（億円）' }, parsed: { y: 63 } }), '累計償却費（億円）: 63.0億円');
  assert.equal(rows[0].amount, 100000);
});
