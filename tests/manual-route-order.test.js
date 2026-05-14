const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('manual route is checked before no-data gate in renderPage', () => {
  const appJs = fs.readFileSync('public/static/app.js', 'utf8');
  const manualCheck = "if (state.page === 'manual') return renderManual();";
  const dataGate = "if (!state.hasData) return goPage('import');";

  const manualIndex = appJs.indexOf(manualCheck);
  const dataGateIndex = appJs.indexOf(dataGate);

  assert.notEqual(manualIndex, -1, 'manual route check should exist');
  assert.notEqual(dataGateIndex, -1, 'no-data gate should exist');
  assert.ok(
    manualIndex < dataGateIndex,
    'manual route check must appear before no-data gate',
  );
});

test('primary data label and page gate do not require additional imports', () => {
  const appJs = fs.readFileSync('public/static/app.js', 'utf8');

  assert.match(appJs, /\{ value: 'budget', label: '予実績管理データ' \}/);
  assert.match(appJs, /追加データが未取込でも、予実績管理データをもとに各ページを表示します。/);
  assert.doesNotMatch(appJs, /if \([^\n]*(additionalData|ADDITIONAL_FILE_TYPES)[^\n]*\) return goPage\('import'\);/);
});
