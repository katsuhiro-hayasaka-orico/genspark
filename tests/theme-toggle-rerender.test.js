const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('toggleTheme re-renders page after applying theme', () => {
  const appJs = fs.readFileSync('public/static/app.js', 'utf8');
  const toggleThemeBlock = /function toggleTheme\(\) \{[\s\S]*?\n\}/m.exec(appJs)?.[0] || '';

  assert.notEqual(toggleThemeBlock, '', 'toggleTheme function should exist');
  assert.ok(toggleThemeBlock.includes('applyTheme();'), 'toggleTheme should apply theme');
  assert.ok(toggleThemeBlock.includes('renderPage();'), 'toggleTheme should re-render current page');
  assert.ok(
    toggleThemeBlock.indexOf('applyTheme();') < toggleThemeBlock.indexOf('renderPage();'),
    'toggleTheme should re-render after applying theme',
  );
});
