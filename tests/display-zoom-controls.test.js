const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('dashboard display zoom controls are available and persisted', () => {
  const html = fs.readFileSync('public/index.html', 'utf8');
  const appJs = fs.readFileSync('public/static/app.js', 'utf8');

  assert.ok(html.includes('id="zoomOut"'), 'topbar should include zoom out control');
  assert.ok(html.includes('id="zoomValue"'), 'topbar should include current zoom label');
  assert.ok(html.includes('id="zoomIn"'), 'topbar should include zoom in control');
  assert.ok(html.includes('id="zoomReset"'), 'topbar should include zoom reset control');
  assert.ok(appJs.includes('localStorage.setItem(\'displayZoom\''), 'display zoom should be saved to localStorage');
  assert.ok(appJs.includes('document.body.style.zoom'), 'display zoom should apply to the whole dashboard body');
  assert.ok(appJs.includes('handleZoomShortcut'), 'display zoom should support keyboard shortcuts');
});
