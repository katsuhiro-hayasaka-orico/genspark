const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-csv-viewer-'));
process.env.BUDGET_CSV_VIEWER_STORE_FILE = path.join(tmpDir, 'store.json');

const { parseCSV, parseUnifiedBudgetLayout, mergeVarianceReasons, startServer, stopServer } = require('../server');

test('parseCSV handles quoted commas and quoted newlines', () => {
  const rows = parseCSV([
    '管理番号,項番,案件名,65期4月計画',
    'A-1,1,"alpha, beta",100',
    'A-2,1,"line1',
    'line2",200',
  ].join('\n'));

  assert.equal(rows.length, 2);
  assert.equal(rows[0]['案件名'], 'alpha, beta');
  assert.equal(rows[1]['案件名'], 'line1\nline2');
});

test('parseUnifiedBudgetLayout maps aliased variance reason columns and normalizes categories', () => {
  const rows = parseCSV([
    '管理番号（統合）,項番,期,案件名,差額理由,差額理由分類,コメント,コメント更新月,コメント更新者,65期4月計画',
    'M-1,2,65,Project A,利用量増,未定義カテゴリ,要確認,202604,Alice,100',
    'M-2,1,65,Project B,契約変更,契約変更,確認済み,202605,Bob,200',
  ].join('\n'));

  const converted = parseUnifiedBudgetLayout(rows);

  assert.equal(converted.master[0].management_no, 'M-1');
  assert.equal(converted.master[0].project_name, 'Project A');
  assert.equal(converted.master[0].variance_reason, '利用量増');
  assert.equal(converted.master[0].variance_reason_category, '未分類');
  assert.equal(converted.master[0].comment, '要確認');
  assert.equal(converted.master[0].comment_updated_month, '202604');
  assert.equal(converted.master[0].comment_updated_by, 'Alice');
  assert.equal(converted.detail[0].variance_reason_category, '未分類');
  assert.equal(converted.master[1].variance_reason_category, '契約変更');
});

test('mergeVarianceReasons overlays rows by management number', () => {
  const items = [
    { management_no: 'M-1', variance_reason: 'old', variance_reason_category: '時期差', comment: '' },
    { management_no: 'M-2', variance_reason: '', variance_reason_category: '時期差', comment: 'keep' },
  ];
  const varianceRows = [
    { 管理番号: 'M-1', 差額理由: 'new', 差額理由分類: '契約変更', コメント: 'updated', コメント更新月: '202606', コメント更新者: 'Carol' },
    { 管理番号: 'M-2', 差額理由分類: 'unknown' },
  ];

  const merged = mergeVarianceReasons(items, varianceRows);

  assert.equal(merged[0].variance_reason, 'new');
  assert.equal(merged[0].variance_reason_category, '契約変更');
  assert.equal(merged[0].comment, 'updated');
  assert.equal(merged[0].comment_updated_month, '202606');
  assert.equal(merged[0].comment_updated_by, 'Carol');
  assert.equal(merged[1].variance_reason_category, '未分類');
  assert.equal(merged[1].comment, 'keep');
});

test('upload and mutable records persist to the local store file', async () => {
  const server = startServer({ host: '127.0.0.1', port: 0 });
  if (!server.listening) await once(server, 'listening');

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const csv = [
      '管理番号,項番,期,予算区分,案件名,部署名,担当者,支払先,契約番号,契約金額,月額,支払区分,固定変動,経費事象コード,システム名,経費事象名,システム分類名,経費区分,65期4月計画,65期4月見込',
      'XSS-1,1,65,運用,"<img src=x onerror=alert(1)>",IT,Alice,Vendor A,C-1,1000,100,運用,固定,SYS1,System One,Hosting,Core,クラウド,1000,900',
    ].join('\n');

    const form = new FormData();
    form.append('budget_csv', new Blob([csv], { type: 'text/csv' }), 'upload.csv');
    const uploadRes = await fetch(`${baseUrl}/api/upload`, { method: 'POST', body: form });
    assert.equal(uploadRes.status, 200);

    const status = await fetch(`${baseUrl}/api/status`).then(res => res.json());
    assert.equal(status.hasData, true);
    assert.equal(status.itemCount, 1);

    const contractRes = await fetch(`${baseUrl}/api/contracts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contract_no: 'C-2',
        vendor_name: 'Vendor B',
        renewal_month: '202604',
        annual_amount: 2000,
      }),
    });
    assert.equal(contractRes.status, 200);

    const renewals = await fetch(`${baseUrl}/api/contracts/renewals?baseYearMonth=202605`).then(res => res.json());
    assert.equal(renewals.data.some(row => row.contract_no === 'C-1' && 'alert_type' in row && 'review_required' in row && 'months_until_renewal' in row && 'note' in row), true);

    const saved = JSON.parse(fs.readFileSync(process.env.BUDGET_CSV_VIEWER_STORE_FILE, 'utf8'));
    assert.equal(saved.csvFileName, 'upload.csv');
    assert.equal(saved.master.length, 1);
    assert.equal(saved.contracts['C-2'].vendor_name, 'Vendor B');
  } finally {
    await stopServer();
  }
});

test('contract date normalization and renewal alerts preserve invalid inputs', () => {
  const { parseCSV, parseUnifiedBudgetLayout, normalizeDateString, detectContractAlerts } = require('../server');
  assert.deepEqual(normalizeDateString('2026/05/14'), { value: '2026-05-14', status: 'valid', warning: '' });

  const invalidDate = normalizeDateString('更新時確認');
  assert.equal(invalidDate.value, '更新時確認');
  assert.equal(invalidDate.status, 'invalid');
  assert.match(invalidDate.warning, /日付形式/);

  const csv = [
    '管理番号,項番,期,案件名,支払先,契約番号,契約開始日,契約終了日,契約期間,次回更新予定月,支払区分,備考,65期4月計画',
    'C-ROW,1,65,契約案件,Vendor X,CON-1,2026/01/01,更新時確認,期間不明,2026/07,月払い,原契約確認,100',
  ].join('\n');
  const converted = parseUnifiedBudgetLayout(parseCSV(csv));
  const master = converted.master[0];

  assert.equal(master.contract_start_date, '2026-01-01');
  assert.equal(master.contract_end_date, '更新時確認');
  assert.equal(master.contract_end_date_status, 'invalid');
  assert.equal(master.next_renewal_month, '202607');
  assert.equal(master.payment_category, '月払い');
  assert.equal(master.note, '原契約確認');

  const alerts = detectContractAlerts(master, '202605');
  assert.equal(alerts.months_until_renewal, 2);
  assert.match(alerts.alert_type, /更新3か月以内/);
  assert.match(alerts.alert_type, /月次見直し/);
  assert.match(alerts.alert_type, /契約期間形式不正/);
  assert.match(alerts.note, /原契約確認/);
});
