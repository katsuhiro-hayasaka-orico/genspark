const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('frontend escapes CSV-derived values before writing HTML', () => {
  const appJs = fs.readFileSync('public/static/app.js', 'utf8');

  assert.match(appJs, /const escapeHtml =/);
  assert.match(appJs, /escapeHtml\(r\[c\] \?\? ''\)/);
  assert.match(appJs, /displayOrUnentered\(firstPresent\(m\.comment/);
  assert.match(appJs, /displayOrUnentered\(firstPresent\(m\.variance_reason_category, item\.variance_reason_category\)\)/);
  assert.match(appJs, /displayOrUnentered\(firstPresent\(m\.variance_reason, item\.variance_reason\)\)/);
  assert.match(appJs, /<th>差額理由分類<\/th><th>差額理由<\/th><th>コメント<\/th>/);
  assert.match(appJs, /colspan=\"7\">月次データなし/);
  assert.match(appJs, /escapeHtml\(value \|\| '-'\)/);
  assert.match(appJs, /escapeHtml\(r\.project_name \|\| r\.management_no\)/);
  assert.match(appJs, /escapeHtml\(state\.data\.status\?\.csvFileName \|\| ''\)/);
});
