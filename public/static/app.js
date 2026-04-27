const NAV_PAGES = [
  { key: 'import', label: '1. データ取込' },
  { key: 'summary', label: '2. 全体サマリー（月次レポート）' },
  { key: 'trend', label: '3. 推移（前年差／トレンド）' },
  { key: 'category', label: '4. カテゴリ別分析' },
  { key: 'project', label: '5. プロジェクト別（新規案件）' },
  { key: 'alert', label: '6. アラート（乖離・変動）' },
  { key: 'vendor', label: '7. ベンダー／契約更新' },
  { key: 'detail', label: '8. 明細（検索・ドリルダウン）' },
  { key: 'settings', label: '9. 表示設定' },
];

const state = {
  page: 'import',
  hasData: false,
  data: { status: null, summary: null, items: [] },
  filters: { periodMode: '月次', department: '', perspective: '費目', target: 'すべて' },
  settings: {
    thresholds: { varianceRate: 10, amountGap: 1000, momRate: 10, yoyRate: 10 },
    kpiOrder: ['総予算','総実績','予算消化率','予算-実績','着地見込み','コスト削減効果'],
    labels: { department_name: '部門', system_name: 'システム', budget_category: '費目' },
    defaultFilters: { target: 'すべて' },
  },
  ui: { categoryTab: '費目別', trendMonths: 12, trendMetric: '総額', detailCols: ['management_no','project_name','department_name','system_name','totalPlan','totalActual'] },
};

const fmt = (n) => Number(n || 0).toLocaleString('ja-JP');
const pct = (n) => `${(Number(n || 0)).toFixed(1)}%`;
const yen = (n) => `${fmt(Math.round(Number(n || 0)))} 千円`;

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `API Error ${res.status}`);
  return json;
}

function filteredItems() {
  let rows = [...state.data.items];
  if (state.filters.department) rows = rows.filter(r => r.department_name === state.filters.department);
  if (state.filters.target === '新規案件') rows = rows.filter(r => /新規|new/i.test(r.project_name || ''));
  if (state.filters.target === '継続案件') rows = rows.filter(r => !/新規|new/i.test(r.project_name || ''));
  if (state.filters.target.startsWith('ベンダー:')) {
    const v = state.filters.target.replace('ベンダー:', '');
    rows = rows.filter(r => (r.vendor_name || r.payee_name) === v);
  }
  return rows;
}

function initNav() {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = NAV_PAGES.map(p => `<button class="nav-item ${p.key===state.page?'active':''}" data-page="${p.key}" ${!state.hasData&&p.key!=='import'?'disabled':''}>${p.label}</button>`).join('');
  nav.querySelectorAll('.nav-item').forEach(b => b.onclick = () => goPage(b.dataset.page));
}

function initFilterBar() {
  const st = state.data.status || {};
  const depts = st.departments || [];
  const vendors = st.vendors || [];
  const optionsTarget = ['すべて','継続案件','新規案件', ...vendors.slice(0, 20).map(v => `ベンダー:${v}`)];
  const root = document.getElementById('globalFilters');
  root.innerHTML = `
    <select id="fPeriod">${['月次','四半期','通期'].map(v=>`<option ${v===state.filters.periodMode?'selected':''}>${v}</option>`).join('')}</select>
    <select id="fDept"><option value="">全部門</option>${depts.map(v=>`<option ${v===state.filters.department?'selected':''}>${v}</option>`).join('')}</select>
    <select id="fPers">${['費目','システム','固定・変動','投資・運用'].map(v=>`<option ${v===state.filters.perspective?'selected':''}>${v}</option>`).join('')}</select>
    <select id="fTarget">${optionsTarget.map(v=>`<option ${v===state.filters.target?'selected':''}>${v}</option>`).join('')}</select>
  `;
  root.querySelector('#fPeriod').onchange = (e) => { state.filters.periodMode = e.target.value; renderPage(); };
  root.querySelector('#fDept').onchange = (e) => { state.filters.department = e.target.value; renderPage(); };
  root.querySelector('#fPers').onchange = (e) => { state.filters.perspective = e.target.value; renderPage(); };
  root.querySelector('#fTarget').onchange = (e) => { state.filters.target = e.target.value; renderPage(); };
}

function goPage(page) {
  state.page = page;
  initNav();
  renderPage();
}

function setStatus() {
  document.getElementById('statusBadge').textContent = state.hasData ? 'データ読込済' : 'データなし';
  document.getElementById('statusBadge').className = `status ${state.hasData ? 'ok' : ''}`;
  document.getElementById('sidebarMeta').innerHTML = state.hasData
    ? `${state.data.status?.csvFileName || ''}<br>案件 ${fmt(state.data.status?.itemCount || 0)} 件`
    : '未取込';
}

async function refreshAllData() {
  const [status, summary] = await Promise.all([api('/status'), api('/dashboard/summary')]);
  state.hasData = !!status.hasData;
  state.data.status = status;
  state.data.summary = summary;
  if (state.hasData) {
    const items = await api('/items');
    state.data.items = items.items || [];
  } else {
    state.data.items = [];
  }
  initNav();
  initFilterBar();
  setStatus();
}

function csvClientChecks(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  if (lines.length === 0) return { errors:['空ファイルです'], summary:null };
  const headers = lines[0].split(',').map(s=>s.trim());
  const required = ['管理番号', '管理番号（統合）', '項番'];
  const hasId = headers.includes('管理番号') || headers.includes('管理番号（統合）');
  const hasItem = headers.includes('項番');
  const errors = [];
  if (!hasId) errors.push('必須列不足: 管理番号/管理番号（統合）');
  if (!hasItem) errors.push('必須列不足: 項番');
  const monthCols = headers.filter(h => /期\d{1,2}月(計画|見込)$/.test(h));
  if (monthCols.length === 0) errors.push('期間列が見つかりません');
  const rows = lines.slice(1).map(l=>l.split(','));
  const emptyPeriod = rows.filter(r => monthCols.some((_,i)=>!(r[headers.indexOf(monthCols[i])]||'').trim())).length;
  const numCols = monthCols.slice(0, 8);
  const invalidNumeric = rows.filter(r => numCols.some(c => {
    const v = (r[headers.indexOf(c)]||'').trim();
    return v && isNaN(Number(String(v).replace(/,/g,'')));
  })).length;
  return {
    errors,
    summary: {
      count: rows.length,
      periodRange: monthCols.length ? `${monthCols[0]} 〜 ${monthCols[monthCols.length-1]}` : '-',
      missingHeavy: `${emptyPeriod} 行で期間列の空欄あり`,
      invalidNumeric,
    }
  };
}

function renderImport() {
  const el = document.getElementById('content');
  el.innerHTML = `
    <div class="panel">
      <h3>CSV取込（唯一の入口）</h3>
      <div class="dropzone" id="dropzone">ドラッグ＆ドロップ または <input id="csvFile" type="file" accept=".csv"></div>
      <div class="controls"><button class="primary" id="uploadBtn" disabled>取込実行</button></div>
      <div id="importSummary"></div>
      <div id="importErrors"></div>
    </div>
  `;
  const fileInput = document.getElementById('csvFile');
  const uploadBtn = document.getElementById('uploadBtn');
  let file = null;

  const parseAndPreview = async (f) => {
    file = f;
    const text = await f.text();
    const check = csvClientChecks(text);
    document.getElementById('importSummary').innerHTML = check.summary ? `
      <div class="panel">
        <h4>読み込み結果サマリー（表示のみ）</h4>
        <ul>
          <li>読み込み件数: ${fmt(check.summary.count)}</li>
          <li>対象期間: ${check.summary.periodRange}</li>
          <li>欠損の多い列: ${check.summary.missingHeavy}</li>
          <li>数値列への文字混入候補: ${check.summary.invalidNumeric}</li>
        </ul>
      </div>` : '';
    document.getElementById('importErrors').innerHTML = `
      <div class="panel"><h4>エラーパネル（表示のみ）</h4>${check.errors.length?`<ul>${check.errors.map(e=>`<li class='warn'>${e}</li>`).join('')}</ul>`:'問題は検知されませんでした。'}</div>`;
    uploadBtn.disabled = false;
  };

  fileInput.onchange = (e) => e.target.files[0] && parseAndPreview(e.target.files[0]);
  const dz = document.getElementById('dropzone');
  dz.ondragover = (e) => { e.preventDefault(); };
  dz.ondrop = (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) parseAndPreview(e.dataTransfer.files[0]); };

  uploadBtn.onclick = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('budget_csv', file);
    await api('/upload', { method: 'POST', body: fd });
    await refreshAllData();
    goPage('summary');
  };
}

function drawLine(canvasId, labels, datasets) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  new Chart(c, { type: 'line', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false } });
}

function renderSummary() {
  const s = state.data.summary || {};
  const k = s.kpi || {};
  const diff = (k.totalPlan || 0) - (k.totalActual || 0);
  const reduction = Math.max(diff, 0);
  const reductionRate = (k.totalPlan || 0) ? (reduction / k.totalPlan) * 100 : 0;
  const top = [...filteredItems()].map(r => ({ name: r.project_name || r.expense_item_name || r.management_no, gap: (r.totalPlan || 0) - (r.totalActual || 0), row: r }))
    .sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap)).slice(0,10);
  const yms = (s.sortedYMs || []).slice(-12);
  const monthData = yms.map(ym => s.monthlyByType?.[ym] || { plan:0, actual:0 });

  document.getElementById('content').innerHTML = `
    <div class="grid-6">
      ${state.settings.kpiOrder.map(name => {
        const map = {
          '総予算': yen(k.totalPlan),
          '総実績': yen(k.totalActual),
          '予算消化率': pct((k.totalPlan? (k.totalActual/k.totalPlan*100):0)),
          '予算-実績': `<span class="${Math.abs(diff) > state.settings.thresholds.amountGap ? 'warn' : ''}">${yen(diff)}</span>`,
          '着地見込み': k.totalForecast ? yen(k.totalForecast) : '未設定',
          'コスト削減効果': `${yen(reduction)} / ${pct(reductionRate)}`,
        };
        return `<div class="kpi"><div class="label">${name}</div><div class="value">${map[name]}</div></div>`;
      }).join('')}
    </div>
    <div class="grid-2">
      <div class="panel"><h4>予算 vs 実績 推移</h4><div style="height:280px"><canvas id="sumChart1"></canvas></div></div>
      <div class="panel"><h4>前年同月比（前年差）</h4><div style="height:280px"><canvas id="sumChart2"></canvas></div></div>
    </div>
    <div class="panel"><h4>トップ論点 Top10（クリックで明細へ）</h4>
      <div class="table-wrap"><table><thead><tr><th>対象</th><th class="right">差額</th></tr></thead><tbody>
        ${top.map((r,i)=>`<tr data-mid="${r.row.management_no}" class="topic-row"><td>${i+1}. ${r.name}</td><td class="right ${Math.abs(r.gap) > state.settings.thresholds.amountGap?'warn':''}">${yen(r.gap)}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
  `;
  drawLine('sumChart1', yms, [
    { label: '予算', data: monthData.map(m=>m.plan||0), borderColor:'#1f5fbf' },
    { label: '実績', data: monthData.map(m=>m.actual||0), borderColor:'#1b8f46' },
  ]);
  const yoy = yms.map(ym => s.yoyMonthly?.[ym]?.deltaActual || 0);
  drawLine('sumChart2', yms, [{ label: '前年差(実績)', data: yoy, borderColor:'#c62828' }]);
  document.querySelectorAll('.topic-row').forEach(tr => tr.onclick = () => {
    state.ui.detailSearch = tr.dataset.mid || '';
    goPage('detail');
  });
}

function renderTrend() {
  const months = state.ui.trendMonths;
  const metric = state.ui.trendMetric;
  const s = state.data.summary || {};
  const yms = (s.sortedYMs || []).slice(-months);
  const data = yms.map(ym => s.monthlyByType?.[ym] || {});
  const rank = [...filteredItems()].map(r => ({ name: r.project_name || r.management_no, yoy: (r.totalActual||0)-(r.totalPlan||0), mom: (r.totalForecast||0)-(r.totalActual||0) }))
    .sort((a,b)=>Math.abs(b.yoy)-Math.abs(a.yoy)).slice(0,20);
  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="controls">
        <label>期間 <select id="trendMonths">${[12,24,60].map(v=>`<option value="${v}" ${v===months?'selected':''}>${v}か月</option>`).join('')}</select></label>
        <label>指標 <select id="trendMetric">${['総額','費目別','システム別'].map(v=>`<option ${v===metric?'selected':''}>${v}</option>`).join('')}</select></label>
      </div>
      <div style="height:320px"><canvas id="trendChart"></canvas></div>
    </div>
    <div class="panel"><h4>変動の大きい順（前年差・前月差）</h4>
      <div class="table-wrap"><table><thead><tr><th>対象</th><th class="right">前年差</th><th class="right">前月差</th></tr></thead><tbody>
      ${rank.map(r=>`<tr><td>${r.name}</td><td class="right">${yen(r.yoy)}</td><td class="right">${yen(r.mom)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  drawLine('trendChart', yms, [
    { label: '予算', data: data.map(m=>m.plan||0), borderColor:'#1f5fbf' },
    { label: '見込', data: data.map(m=>m.forecast||0), borderColor:'#f39c12' },
    { label: '実績', data: data.map(m=>m.actual||0), borderColor:'#1b8f46' },
  ]);
  document.getElementById('trendMonths').onchange = e => { state.ui.trendMonths = Number(e.target.value); renderTrend(); };
  document.getElementById('trendMetric').onchange = e => { state.ui.trendMetric = e.target.value; renderTrend(); };
}

function aggregateBy(rows, key) {
  const map = {};
  rows.forEach(r => {
    const k = r[key] || '未設定';
    if (!map[k]) map[k] = { key: k, plan: 0, actual: 0 };
    map[k].plan += Number(r.totalPlan || 0);
    map[k].actual += Number(r.totalActual || 0);
  });
  return Object.values(map).map(r => ({ ...r, ratio: (r.actual / Math.max(r.plan, 1)) * 100, gap: r.plan - r.actual, gapRate: r.plan ? ((r.plan-r.actual)/r.plan*100) : 0 }))
    .sort((a,b)=>b.actual-a.actual);
}

function renderCategory() {
  const tabs = ['期間別','費目別','システム別','部門別','固定費・変動費'];
  const tab = state.ui.categoryTab;
  const rows = filteredItems();
  const keyMap = { '期間別': 'fiscal_period', '費目別':'budget_category', 'システム別':'system_name', '部門別':'department_name', '固定費・変動費':'fixed_variable_type' };
  const agg = aggregateBy(rows, keyMap[tab]);

  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="tabs">${tabs.map(t=>`<button class="${t===tab?'active':''}" data-tab="${t}">${t}</button>`).join('')}</div>
      <div class="grid-2">
        <div><h4>構成比</h4><div style="height:300px"><canvas id="catPie"></canvas></div></div>
        <div><h4>予実差（差額順／乖離率順）</h4>
          <div class="table-wrap"><table><thead><tr><th>分類</th><th class="right">構成比</th><th class="right">差額</th><th class="right">乖離率</th></tr></thead><tbody>
          ${agg.slice(0,25).map(r=>`<tr><td>${r.key}</td><td class="right">${pct((r.actual/Math.max(agg.reduce((s,v)=>s+v.actual,0),1))*100)}</td><td class="right">${yen(r.gap)}</td><td class="right">${pct(r.gapRate)}</td></tr>`).join('')}
          </tbody></table></div></div>
      </div>
    </div>`;
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{ state.ui.categoryTab = b.dataset.tab; renderCategory(); });
  new Chart(document.getElementById('catPie'), {
    type: 'doughnut',
    data: { labels: agg.slice(0,10).map(r=>r.key), datasets: [{ data: agg.slice(0,10).map(r=>r.actual) }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function renderProject() {
  const rows = filteredItems().filter(r => /新規|new/i.test(r.project_name || '') || r.budget_category?.includes('投資'));
  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="controls"><input type="text" id="pSearch" placeholder="案件検索"></div>
      <div style="height:300px"><canvas id="projectScatter"></canvas></div>
    </div>
    <div class="panel"><div class="table-wrap"><table><thead><tr><th>プロジェクト</th><th class="right">予算実績差異</th><th class="right">進捗率</th><th class="right">コスト消化率</th><th>差額理由</th></tr></thead><tbody id="projectRows"></tbody></table></div></div>`;

  const renderRows = (q='') => {
    const view = rows.filter(r => !q || (r.project_name||'').toLowerCase().includes(q.toLowerCase()));
    document.getElementById('projectRows').innerHTML = view.slice(0,200).map(r => {
      const progress = Math.min((r.totalForecast||0) / Math.max(r.totalPlan||1,1) * 100, 200);
      const burn = Math.min((r.totalActual||0) / Math.max(r.totalPlan||1,1) * 100, 200);
      return `<tr data-mid="${r.management_no}"><td>${r.project_name || '(名称未設定)'}</td><td class="right">${yen((r.totalPlan||0)-(r.totalActual||0))}</td><td class="right">${pct(progress)}</td><td class="right">${pct(burn)}</td><td>${r.variance_reason || '-'}</td></tr>`;
    }).join('');
    document.querySelectorAll('#projectRows tr').forEach(tr => tr.onclick = () => { state.ui.detailSearch = tr.dataset.mid; goPage('detail'); });
  };
  renderRows();
  document.getElementById('pSearch').oninput = e => renderRows(e.target.value);

  new Chart(document.getElementById('projectScatter'), {
    type: 'scatter',
    data: { datasets: [{ label: '案件', data: rows.slice(0,100).map(r => ({ x: (r.totalForecast||0)/Math.max(r.totalPlan||1,1)*100, y: (r.totalActual||0)/Math.max(r.totalPlan||1,1)*100 })) }] },
    options: { scales: { x: { title: { display: true, text: '進捗率(%)' } }, y: { title: { display: true, text: 'コスト消化率(%)' } } } }
  });
}

function renderAlert() {
  const t = state.settings.thresholds;
  const rows = filteredItems().map(r => {
    const gap = (r.totalPlan||0) - (r.totalActual||0);
    const rate = (r.totalPlan||0) ? ((r.totalActual-r.totalPlan)/r.totalPlan*100) : 0;
    return { ...r, gap, rate };
  }).filter(r => Math.abs(r.rate) >= t.varianceRate || Math.abs(r.gap) >= t.amountGap)
    .sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap));
  const first = rows[0];
  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="controls">
        <span class="badge">しきい値: 乖離率 ${t.varianceRate}% / 差額 ${fmt(t.amountGap)} 千円 / 前月比 ${t.momRate}% / 前年比 ${t.yoyRate}%</span>
      </div>
      <div class="grid-2">
        <div class="table-wrap"><table><thead><tr><th>案件</th><th class="right">差額</th><th class="right">乖離率</th></tr></thead><tbody>
          ${rows.slice(0,200).map(r=>`<tr data-mid="${r.management_no}"><td>${r.project_name||r.management_no}</td><td class="right warn">${yen(r.gap)}</td><td class="right">${pct(r.rate)}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="panel">
          <h4>右ペイン（対象案件）</h4>
          ${first ? `<p><b>${first.project_name||first.management_no}</b></p><p>推移: 予算 ${yen(first.totalPlan)} / 実績 ${yen(first.totalActual)}</p><p>関連明細: ${first.system_name} / ${first.department_name}</p><p>メモ欄: ${first.memo || 'CSV列なし'}</p>` : 'アラート対象なし'}
        </div>
      </div>
    </div>`;
  document.querySelectorAll('tr[data-mid]').forEach(tr => tr.onclick = () => { state.ui.detailSearch = tr.dataset.mid; goPage('detail'); });
}

async function renderVendor() {
  const [vendors, renewals] = await Promise.all([api('/analysis/by-vendor'), api('/contracts/renewals?withinMonths=3')]);
  const vRows = (vendors.data || []).sort((a,b)=>b.actual-a.actual);
  document.getElementById('content').innerHTML = `
    <div class="grid-2">
      <div class="panel"><h4>ベンダー別支払額ランキング</h4><div class="table-wrap"><table><thead><tr><th>ベンダー</th><th class="right">支払額(実績)</th></tr></thead><tbody>
      ${vRows.map(v=>`<tr><td>${v.name}</td><td class="right">${yen(v.actual)}</td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="panel"><h4>契約更新月（当月〜3か月先）</h4><div class="table-wrap"><table><thead><tr><th>契約番号</th><th>ベンダー</th><th>更新月</th></tr></thead><tbody>
      ${(renewals.data||[]).map(r=>`<tr><td>${r.contract_no}</td><td>${r.vendor_name}</td><td>${r.renewal_month}</td></tr>`).join('') || '<tr><td colspan="3">対象なし</td></tr>'}
      </tbody></table></div></div>
    </div>`;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
}

function renderDetail() {
  const cols = state.ui.detailCols;
  const search0 = state.ui.detailSearch || '';
  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="controls">
        <input type="text" id="dSearch" placeholder="キーワード検索" value="${search0}">
        <label>列表示切替 <select id="dCols" multiple size="1">
          ${['management_no','project_name','department_name','owner_name','vendor_name','system_name','budget_category','fixed_variable_type','totalPlan','totalForecast','totalActual'].map(c=>`<option ${cols.includes(c)?'selected':''}>${c}</option>`).join('')}
        </select></label>
        <button id="dExport">表示結果をCSV書き出し</button>
      </div>
      <div class="table-wrap"><table><thead><tr id="dHead"></tr></thead><tbody id="dBody"></tbody></table></div>
    </div>
    <div class="panel" id="dPane">行クリックで属性(master)+月次(detail)を表示</div>`;

  const renderRows = () => {
    const q = document.getElementById('dSearch').value.toLowerCase();
    const selected = Array.from(document.getElementById('dCols').selectedOptions).map(o=>o.value);
    state.ui.detailCols = selected.length ? selected : cols;
    const view = filteredItems().filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));
    document.getElementById('dHead').innerHTML = state.ui.detailCols.map(c=>`<th>${c}</th>`).join('');
    document.getElementById('dBody').innerHTML = view.slice(0,500).map((r,i)=>`<tr data-idx="${i}">${state.ui.detailCols.map(c=>`<td>${r[c] ?? ''}</td>`).join('')}</tr>`).join('');
    document.querySelectorAll('#dBody tr').forEach(tr => tr.onclick = () => {
      const row = view[Number(tr.dataset.idx)];
      document.getElementById('dPane').innerHTML = `<h4>属性(master)</h4><pre>${JSON.stringify({ management_no: row.management_no, project_name: row.project_name, department_name: row.department_name, system_name: row.system_name, vendor_name: row.vendor_name }, null, 2)}</pre><h4>月次(detail)</h4><pre>${JSON.stringify(row.monthly || {}, null, 2)}</pre>`;
    });
    document.getElementById('dExport').onclick = () => {
      const csv = toCsv(view.map(r => Object.fromEntries(state.ui.detailCols.map(c => [c, r[c] ?? '']))));
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'displayed_detail.csv';
      a.click();
    };
  };
  renderRows();
  document.getElementById('dSearch').oninput = renderRows;
  document.getElementById('dCols').onchange = renderRows;
}

function renderSettings() {
  const t = state.settings.thresholds;
  document.getElementById('content').innerHTML = `
    <div class="panel">
      <h4>表示設定（データは変更しない）</h4>
      <div class="grid-2">
        <div>
          <h5>アラートしきい値</h5>
          <div class="controls">
            <label>乖離率% <input id="sVar" type="number" value="${t.varianceRate}"></label>
            <label>差額金額 <input id="sAmt" type="number" value="${t.amountGap}"></label>
            <label>前月比% <input id="sMom" type="number" value="${t.momRate}"></label>
            <label>前年比% <input id="sYoy" type="number" value="${t.yoyRate}"></label>
          </div>
        </div>
        <div>
          <h5>重要KPI 並び替え（カンマ区切り）</h5>
          <input id="sKpi" type="text" style="width:100%" value="${state.settings.kpiOrder.join(',')}">
          <h5>用語表示名（JSON）</h5>
          <input id="sLbl" type="text" style="width:100%" value='${JSON.stringify(state.settings.labels)}'>
          <h5>委員会向け既定フィルタ</h5>
          <select id="sDefTarget"><option ${state.settings.defaultFilters.target==='すべて'?'selected':''}>すべて</option><option ${state.settings.defaultFilters.target==='継続案件'?'selected':''}>継続案件</option><option ${state.settings.defaultFilters.target==='新規案件'?'selected':''}>新規案件</option></select>
        </div>
      </div>
      <button class="primary" id="saveSetting">表示設定を反映</button>
    </div>`;

  document.getElementById('saveSetting').onclick = () => {
    state.settings.thresholds.varianceRate = Number(document.getElementById('sVar').value || 10);
    state.settings.thresholds.amountGap = Number(document.getElementById('sAmt').value || 1000);
    state.settings.thresholds.momRate = Number(document.getElementById('sMom').value || 10);
    state.settings.thresholds.yoyRate = Number(document.getElementById('sYoy').value || 10);
    state.settings.kpiOrder = document.getElementById('sKpi').value.split(',').map(v => v.trim()).filter(Boolean);
    try { state.settings.labels = JSON.parse(document.getElementById('sLbl').value || '{}'); } catch {}
    state.settings.defaultFilters.target = document.getElementById('sDefTarget').value;
    state.filters.target = state.settings.defaultFilters.target;
    initFilterBar();
    alert('表示設定を反映しました');
  };
}

async function renderPage() {
  const title = NAV_PAGES.find(p => p.key === state.page)?.label || '';
  document.getElementById('pageTitle').textContent = title;
  if (state.page === 'import') return renderImport();
  if (!state.hasData) return goPage('import');
  if (state.page === 'summary') return renderSummary();
  if (state.page === 'trend') return renderTrend();
  if (state.page === 'category') return renderCategory();
  if (state.page === 'project') return renderProject();
  if (state.page === 'alert') return renderAlert();
  if (state.page === 'vendor') return renderVendor();
  if (state.page === 'detail') return renderDetail();
  if (state.page === 'settings') return renderSettings();
}

(async function boot() {
  await refreshAllData();
  renderPage();
})();
