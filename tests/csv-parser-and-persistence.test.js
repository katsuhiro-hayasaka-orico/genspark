const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-csv-viewer-'));
process.env.BUDGET_CSV_VIEWER_STORE_FILE = path.join(tmpDir, 'store.json');

const { parseCSV, startServer, stopServer } = require('../server');

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

    const varianceReasonRes = await fetch(`${baseUrl}/api/variance-reasons`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        management_no: 'XSS-1',
        item_no: '1',
        fiscal_period: '65',
        target_year_month: '202504',
        reason_category: '価格改定',
        factor_type: 'ライセンス単価上昇',
        comment: '更新見積もりを確認済み',
        comment_updated_by: 'Alice',
      }),
    });
    assert.equal(varianceReasonRes.status, 200);

    const items = await fetch(`${baseUrl}/api/items`).then(res => res.json());
    assert.equal(items.items.length, 1);
    assert.equal(items.items[0].variance_reason_category, '価格改定');
    assert.equal(items.items[0].variance_reason, 'ライセンス単価上昇');
    assert.equal(items.items[0].comment, '更新見積もりを確認済み');
    assert.equal(items.items[0].comment_updated_month, '202504');
    assert.equal(items.items[0].comment_updated_by, 'Alice');
    assert.deepEqual(items.items[0].monthlyComments['202504'], {
      variance_reason: 'ライセンス単価上昇',
      variance_reason_category: '価格改定',
      comment: '更新見積もりを確認済み',
      comment_updated_month: '202504',
      comment_updated_by: 'Alice',
    });
    assert.equal(items.items[0].monthly['202504'].variance_reason_category, '価格改定');
    assert.equal(items.items[0].monthly['202504'].variance_reason, 'ライセンス単価上昇');
    assert.equal(items.items[0].monthly['202504'].comment, '更新見積もりを確認済み');

    const saved = JSON.parse(fs.readFileSync(process.env.BUDGET_CSV_VIEWER_STORE_FILE, 'utf8'));
    assert.equal(saved.csvFileName, 'upload.csv');
    assert.equal(saved.master.length, 1);
    assert.equal(saved.contracts['C-2'].vendor_name, 'Vendor B');
  } finally {
    await stopServer();
  }
});
