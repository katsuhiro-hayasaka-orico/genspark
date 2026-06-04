const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-csv-viewer-sample-import-'));
process.env.BUDGET_CSV_VIEWER_STORE_FILE = path.join(tmpDir, 'store.json');

const { IMPORT_FILE_TYPES, parseUploadedFile } = require('../server');

const demoDir = path.join(__dirname, '..', 'sample-data', 'demo');
const sampleFiles = {
  budget: 'budget-demo.csv',
  newProjectMaster: 'new-project-master-demo.csv',
  newProjectMonthlyCost: 'new-project-monthly-cost-demo.csv',
  oacisActual: 'oacis-actual-demo.csv',
  depreciationSimulation: 'depreciation-simulation-demo.csv',
};

function readDemoCsv(fileName) {
  const filePath = path.join(demoDir, fileName);
  assert.ok(fs.existsSync(filePath), `${fileName} should exist in sample-data/demo`);
  const text = fs.readFileSync(filePath, 'utf8');
  assert.notEqual(text.trim(), '', `${fileName} should not be empty`);
  assertDemoCsvHasNoSensitiveMarkers(fileName, text);
  return text;
}

function assertDemoCsvHasNoSensitiveMarkers(fileName, text) {
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  assert.equal(emailPattern.test(text), false, `${fileName} should not contain email-like strings`);

  const forbiddenWords = [
    '社外秘',
    '極秘',
    'confidential',
    'password',
    'パスワード',
    '個人情報',
    'マイナンバー',
  ];
  for (const word of forbiddenWords) {
    assert.equal(text.toLowerCase().includes(word.toLowerCase()), false, `${fileName} should not contain forbidden word: ${word}`);
  }
}

test('sample budget demo CSV imports with master and detail rows', () => {
  const result = parseUploadedFile(IMPORT_FILE_TYPES.BUDGET, readDemoCsv(sampleFiles.budget));

  assert.equal(result.status, 'imported');
  assert.ok(result.master.length > 0);
  assert.ok(result.detail.length > 0);
  assert.equal(result.errorCount, 0);
});

test('sample new project master demo CSV imports with management numbers', () => {
  const result = parseUploadedFile(IMPORT_FILE_TYPES.NEW_PROJECT_MASTER, readDemoCsv(sampleFiles.newProjectMaster));

  assert.equal(result.status, 'imported');
  assert.ok(result.rows.length > 0);
  assert.notEqual(result.rows[0].management_no, '');
});

test('sample new project monthly cost demo CSV imports and normalizes target year month', () => {
  const result = parseUploadedFile(IMPORT_FILE_TYPES.NEW_PROJECT_MONTHLY_COST, readDemoCsv(sampleFiles.newProjectMonthlyCost));

  assert.equal(result.status, 'imported');
  assert.ok(result.rows.length > 0);
  assert.ok(result.rows.every((row) => /^\d{6}$/.test(row.target_year_month)), 'target_year_month should be normalized to YYYYMM');
});

test('sample OACIS actual demo CSV imports with missing yojitsu number marker', () => {
  const result = parseUploadedFile(IMPORT_FILE_TYPES.OASIS_ACTUAL, readDemoCsv(sampleFiles.oacisActual));

  assert.equal(result.status, 'imported');
  assert.ok(result.rows.length > 0);
  assert.ok(result.rows.some((row) => row.yojitsu_no_missing === true));
});

test('sample depreciation simulation demo CSV imports all period types', () => {
  const result = parseUploadedFile(IMPORT_FILE_TYPES.DEPRECIATION_SIMULATION, readDemoCsv(sampleFiles.depreciationSimulation));

  assert.equal(result.status, 'imported');
  const periodTypes = new Set(result.rows.map((row) => row.period_type));
  assert.ok(periodTypes.has('month'));
  assert.ok(periodTypes.has('half'));
  assert.ok(periodTypes.has('full'));
  assert.ok(result.rows.every((row) => row.depreciation_category_name !== ''));
});
