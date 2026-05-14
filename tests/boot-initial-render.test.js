const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('boot renders initial page before refreshing data', () => {
  const appJs = fs.readFileSync('public/static/app.js', 'utf8');
  const bootBlock = /\(async function boot\(\) \{[\s\S]*?\n\}\)\(\);/m.exec(appJs)?.[0] || '';

  assert.notEqual(bootBlock, '', 'boot function should exist');
  assert.ok(bootBlock.includes('renderPage();'), 'boot should render page');
  assert.ok(bootBlock.includes('await refreshAllData();'), 'boot should refresh data');
  assert.ok(
    bootBlock.indexOf('renderPage();') < bootBlock.indexOf('await refreshAllData();'),
    'boot should render the initial page before refreshing data',
  );
});
