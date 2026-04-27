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
  data: { status: null, items: [], contracts: [] },
  filters: { periodMode: '月次', department: '', perspective: '費目', target: 'すべて' },
  settings: {
    thresholds: { varianceRate: 10, amountGap: 1000, momRate: 10, yoyRate: 10 },
    kpiOrder: ['総予算', '総実績', '予算消化率', '予算-実績', '着地見込み', 'コスト削減効果'],
  },
  ui: {
    theme: localStorage.getItem('theme') || 'light',
    categoryTab: '費目別',
    trendMonths: 12,
    trendMetric: '総額',
    detailSearch: '',
    extraDetailCols: ['owner_name', 'vendor_name', 'budget_category', 'totalForecast'],
  },
};

const fmt = (n) => Number(n || 0).toLocaleString('ja-JP');
const pct = (n) => `${(Number(n || 0)).toFixed(1)}%`;
const yen = (n) => `${fmt(Math.round(Number(n || 0)))} 千円`;
const isNewProject = (r) => /新規|new/i.test(r.project_name || '');

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `API Error ${res.status}`);
  return json;
}

function toggleTheme() {
  state.ui.theme = state.ui.theme === 'light' ? 'dark' : 'light';
  document.body.dataset.theme = state.ui.theme;
  localStorage.setItem('theme', state.ui.theme);
  document.getElementById('themeToggle').textContent = state.ui.theme === 'light' ? '🌙 ダーク' : '☀️ ライト';
}

function ymToQuarter(ym) {
  const s = String(ym || '');
  if (s.length !== 6) return '不明';
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const q = Math.floor((m - 1) / 3) + 1;
  return `${y}Q${q}`;
}

function filteredItems() {
  let rows = [...state.data.items];
  if (state.filters.department) rows = rows.filter(r => r.department_name === state.filters.department);
  if (state.filters.target === '新規案件') rows = rows.filter(isNewProject);
  if (state.filters.target === '継続案件') rows = rows.filter(r => !isNewProject(r));
  if (state.filters.target.startsWith('ベンダー:')) {
    const v = state.filters.target.replace('ベンダー:', '');
    rows = rows.filter(r => (r.vendor_name || r.payee_name || '') === v);
  }
  return rows;
}

function getPerspectiveKey() {
  if (state.filters.perspective === '費目') return 'budget_category';
  if (state.filters.perspective === 'システム') return 'system_name';
  if (state.filters.perspective === '固定・変動') return 'fixed_variable_type';
  return 'payment_category';
}

function buildTimeSeries(items) {
  const bucket = {};
  items.forEach((item) => {
    Object.entries(item.monthly || {}).forEach(([ym, m]) => {
      const key = state.filters.periodMode === '月次' ? ym : (state.filters.periodMode === '四半期' ? ymToQuarter(ym) : String(ym).slice(0, 4));
      if (!bucket[key]) bucket[key] = { plan: 0, forecast: 0, actual: 0 };
      bucket[key].plan += Number(m.plan || 0);
      bucket[key].forecast += Number(m.forecast || 0);
      bucket[key].actual += Number(m.actual || 0);
    });
  });
  const labels = Object.keys(bucket).sort();
  return { labels, bucket };
}

function recomputeSummary(items) {
  const totalPlan = items.reduce((s, r) => s + Number(r.totalPlan || 0), 0);
  const totalForecast = items.reduce((s, r) => s + Number(r.totalForecast || 0), 0);
  const totalActual = items.reduce((s, r) => s + Number(r.totalActual || 0), 0);
  const diff = totalPlan - totalActual;
  const reduction = Math.max(diff, 0);
  const reductionRate = totalPlan ? reduction / totalPlan * 100 : 0;
  const ts = buildTimeSeries(items);

  return {
    totalPlan, totalForecast, totalActual, diff, reduction, reductionRate,
    labels: ts.labels,
    series: ts.labels.map(l => ts.bucket[l] || { plan: 0, forecast: 0, actual: 0 }),
  };
}

function initNav() {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = NAV_PAGES.map(p => `<button class="nav-item ${p.key === state.page ? 'active' : ''}" data-page="${p.key}" ${!state.hasData && p.key !== 'import' ? 'disabled' : ''}>${p.label}</button>`).join('');
  nav.querySelectorAll('.nav-item').forEach(b => b.onclick = () => goPage(b.dataset.page));
}

function initFilterBar() {
  const st = state.data.status || {};
  const depts = st.departments || [];
  const vendors = (st.vendors || []).slice(0, 20);
  const targets = ['すべて', '継続案件', '新規案件', ...vendors.map(v => `ベンダー:${v}`)];
  const root = document.getElementById('globalFilters');
  root.innerHTML = `
    <select id="fPeriod">${['月次', '四半期', '通期'].map(v => `<option ${v === state.filters.periodMode ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <select id="fDept"><option value="">全部門</option>${depts.map(v => `<option ${v === state.filters.department ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <select id="fPers">${['費目', 'システム', '固定・変動', '投資・運用'].map(v => `<option ${v === state.filters.perspective ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <select id="fTarget">${targets.map(v => `<option ${v === state.filters.target ? 'selected' : ''}>${v}</option>`).join('')}</select>
  `;
  ['fPeriod', 'fDept', 'fPers', 'fTarget'].forEach((id) => {
    root.querySelector(`#${id}`).onchange = () => {
      state.filters.periodMode = root.querySelector('#fPeriod').value;
      state.filters.department = root.querySelector('#fDept').value;
      state.filters.perspective = root.querySelector('#fPers').value;
      state.filters.target = root.querySelector('#fTarget').value;
      renderPage();
    };
  });
}

function setStatus() {
  document.body.dataset.theme = state.ui.theme;
  document.getElementById('themeToggle').textContent = state.ui.theme === 'light' ? '🌙 ダーク' : '☀️ ライト';
  document.getElementById('statusBadge').textContent = state.hasData ? 'データ読込済' : 'データなし';
  document.getElementById('statusBadge').className = `status ${state.hasData ? 'ok' : ''}`;
  document.getElementById('sidebarMeta').innerHTML = state.hasData
    ? `${state.data.status?.csvFileName || ''}<br>案件 ${fmt(state.data.status?.itemCount || 0)} 件`
    : '未取込';
}

async function refreshAllData() {
  const [status, itemsRes, contractsRes] = await Promise.all([
    api('/status'),
    api('/items'),
    api('/contracts').catch(() => ({ data: [] })),
  ]);
  state.hasData = !!status.hasData;
  state.data.status = status;
  state.data.items = itemsRes.items || [];
  state.data.contracts = contractsRes.data || [];
  initNav();
  initFilterBar();
  setStatus();
}

function goPage(page) {
  state.page = page;
  initNav();
  renderPage();
}

function csvClientChecks(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  if (!lines.length) return { errors: ['空ファイルです'], summary: null };
  const headers = lines[0].split(',').map(s => s.trim());
  const hasId = headers.includes('管理番号') || headers.includes('管理番号（統合）');
  const hasItem = headers.includes('項番');
  const monthCols = headers.filter(h => /期\d{1,2}月(計画|見込)$/.test(h));
  const rows = lines.slice(1).map(l => l.split(','));
  const errors = [];
  if (!hasId) errors.push('必須列不足: 管理番号/管理番号（統合）');
  if (!hasItem) errors.push('必須列不足: 項番');
  if (!monthCols.length) errors.push('期間列が見つかりません');
  const invalidNumeric = rows.filter(r => monthCols.slice(0, 8).some(c => {
    const v = (r[headers.indexOf(c)] || '').trim();
    return v && isNaN(Number(String(v).replace(/,/g, '')));
  })).length;
  return {
    errors,
    summary: {
      count: rows.length,
      periodRange: monthCols.length ? `${monthCols[0]} 〜 ${monthCols[monthCols.length - 1]}` : '-',
      missingHeavy: `${rows.filter(r => monthCols.some(c => !(r[headers.indexOf(c)] || '').trim())).length} 行で期間列空欄`,
      invalidNumeric,
    }
  };
}

function drawLine(canvasId, labels, datasets) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  new Chart(el, { type: 'line', data: { labels, datasets }, options: { maintainAspectRatio: false, responsive: true } });
}

function renderImport() {
  document.getElementById('content').innerHTML = `
    <div class="panel">
      <h3>CSV取込（唯一の入口）</h3>
      <div class="dropzone" id="dropzone">ドラッグ＆ドロップ または <input id="csvFile" type="file" accept=".csv"></div>
      <div class="controls"><button class="primary" id="uploadBtn" disabled>取込実行</button></div>
      <div id="importSummary"></div>
      <div id="importErrors"></div>
    </div>`;

  const fileInput = document.getElementById('csvFile');
  const uploadBtn = document.getElementById('uploadBtn');
  let file = null;

  const preview = async (f) => {
    file = f;
    const c = csvClientChecks(await f.text());
    document.getElementById('importSummary').innerHTML = c.summary ? `<div class="panel"><h4>読み込み結果サマリー（表示のみ）</h4><ul><li>読み込み件数: ${fmt(c.summary.count)}</li><li>対象期間: ${c.summary.periodRange}</li><li>欠損の多い列: ${c.summary.missingHeavy}</li><li>数値列への文字混入候補: ${c.summary.invalidNumeric}</li></ul></div>` : '';
    document.getElementById('importErrors').innerHTML = `<div class="panel"><h4>エラーパネル（表示のみ）</h4>${c.errors.length ? `<ul>${c.errors.map(e => `<li class="warn">${e}</li>`).join('')}</ul>` : '問題は検知されませんでした。'}</div>`;
    uploadBtn.disabled = false;
  };

  fileInput.onchange = e => e.target.files[0] && preview(e.target.files[0]);
  const dz = document.getElementById('dropzone');
  dz.ondragover = e => e.preventDefault();
  dz.ondrop = e => { e.preventDefault(); e.dataTransfer.files[0] && preview(e.dataTransfer.files[0]); };

  uploadBtn.onclick = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('budget_csv', file);
    await api('/upload', { method: 'POST', body: fd });
    await refreshAllData();
    goPage('summary');
  };
}

function renderSummary() {
  const items = filteredItems();
  const s = recomputeSummary(items);
  const top = items.map(r => ({
    name: r.project_name || '(案件名未設定)',
    gap: Number(r.totalPlan || 0) - Number(r.totalActual || 0),
    row: r,
  })).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 10);

  document.getElementById('content').innerHTML = `
    <div class="grid-6">
      ${state.settings.kpiOrder.map(name => {
        const map = {
          '総予算': yen(s.totalPlan),
          '総実績': yen(s.totalActual),
          '予算消化率': pct(s.totalPlan ? s.totalActual / s.totalPlan * 100 : 0),
          '予算-実績': `<span class="${Math.abs(s.diff) >= state.settings.thresholds.amountGap ? 'warn' : ''}">${yen(s.diff)}</span>`,
          '着地見込み': s.totalForecast ? yen(s.totalForecast) : '未設定',
          'コスト削減効果': `${yen(s.reduction)} / ${pct(s.reductionRate)}`,
        };
        return `<div class="kpi"><div class="label">${name}</div><div class="value">${map[name]}</div></div>`;
      }).join('')}
    </div>
    <div class="grid-2">
      <div class="panel"><h4>予算 vs 実績の推移</h4><div style="height:280px"><canvas id="sumChart1"></canvas></div></div>
      <div class="panel"><h4>前年同月比（前年差）</h4><div style="height:280px"><canvas id="sumChart2"></canvas></div></div>
    </div>
    <div class="panel"><h4>差異が大きいカテゴリ／案件ランキング（Top10）</h4>
      <div class="table-wrap"><table><thead><tr><th>対象</th><th class="right">差額</th></tr></thead><tbody>
      ${top.map((r, i) => `<tr data-mid="${r.row.management_no}"><td>${i + 1}. ${r.name}</td><td class="right ${Math.abs(r.gap) >= state.settings.thresholds.amountGap ? 'warn' : ''}">${yen(r.gap)}</td></tr>`).join('')}
      </tbody></table></div>
    </div>`;

  const labels = s.labels.slice(-Math.min(s.labels.length, 12));
  const series = s.series.slice(-labels.length);
  drawLine('sumChart1', labels, [
    { label: '予算', data: series.map(v => v.plan), borderColor: '#2962d0' },
    { label: '実績', data: series.map(v => v.actual), borderColor: '#2e9d5a' },
  ]);

  const deltas = series.map((v, idx) => idx === 0 ? 0 : v.actual - series[idx - 1].actual);
  drawLine('sumChart2', labels, [{ label: '前年差(代替:前期差)', data: deltas, borderColor: '#d84343' }]);

  document.querySelectorAll('tr[data-mid]').forEach(tr => tr.onclick = () => {
    state.ui.detailSearch = tr.dataset.mid;
    goPage('detail');
  });
}

function renderTrend() {
  const items = filteredItems();
  const s = recomputeSummary(items);
  const labels = s.labels.slice(-state.ui.trendMonths);
  const series = s.series.slice(-state.ui.trendMonths);
  const rank = items.map(r => ({
    name: r.project_name || '(案件名未設定)',
    management_no: r.management_no,
    yoy: Number(r.totalActual || 0) - Number(r.totalPlan || 0),
    mom: Number(r.totalForecast || 0) - Number(r.totalActual || 0),
  })).sort((a, b) => Math.abs(b.yoy) - Math.abs(a.yoy)).slice(0, 20);

  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="controls">
        <label>期間 <select id="trendMonths">${[12, 24, 60].map(v => `<option value="${v}" ${v === state.ui.trendMonths ? 'selected' : ''}>${v}か月</option>`).join('')}</select></label>
        <label>指標 <select id="trendMetric">${['総額', '費目別', 'システム別'].map(v => `<option ${v === state.ui.trendMetric ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
      <div style="height:320px"><canvas id="trendChart"></canvas></div>
    </div>
    <div class="panel"><h4>変動の大きい順ランキング（前年差・前月差）</h4><div class="table-wrap"><table><thead><tr><th>対象</th><th class="right">前年差</th><th class="right">前月差</th></tr></thead><tbody>
      ${rank.map(r => `<tr data-mid="${r.management_no}"><td>${r.name}</td><td class="right">${yen(r.yoy)}</td><td class="right">${yen(r.mom)}</td></tr>`).join('')}
    </tbody></table></div></div>`;

  drawLine('trendChart', labels, [
    { label: '予算', data: series.map(v => v.plan), borderColor: '#2962d0' },
    { label: '見込', data: series.map(v => v.forecast), borderColor: '#f2a037' },
    { label: '実績', data: series.map(v => v.actual), borderColor: '#2e9d5a' },
  ]);

  document.getElementById('trendMonths').onchange = e => { state.ui.trendMonths = Number(e.target.value); renderTrend(); };
  document.getElementById('trendMetric').onchange = e => { state.ui.trendMetric = e.target.value; renderTrend(); };
  document.querySelectorAll('tr[data-mid]').forEach(tr => tr.onclick = () => { state.ui.detailSearch = tr.dataset.mid; goPage('detail'); });
}

function aggregateBy(rows, key) {
  const map = {};
  rows.forEach(r => {
    const k = r[key] || '未設定';
    if (!map[k]) map[k] = { key: k, plan: 0, actual: 0 };
    map[k].plan += Number(r.totalPlan || 0);
    map[k].actual += Number(r.totalActual || 0);
  });
  const all = Object.values(map);
  const totalActual = all.reduce((s, v) => s + v.actual, 0);
  const totalPlan = all.reduce((s, v) => s + v.plan, 0);
  const base = totalActual > 0 ? totalActual : totalPlan;
  return all.map(r => ({
    ...r,
    comp: base ? (r.actual > 0 ? r.actual : r.plan) / base * 100 : 0,
    gap: r.plan - r.actual,
    gapRate: r.plan ? (r.plan - r.actual) / r.plan * 100 : 0,
  })).sort((a, b) => b.comp - a.comp);
}

function renderCategory() {
  const tabs = ['期間別', '費目別', 'システム別', '部門別', '固定費・変動費'];
  const keyMap = { '期間別': 'fiscal_period', '費目別': 'budget_category', 'システム別': 'system_name', '部門別': 'department_name', '固定費・変動費': 'fixed_variable_type' };
  const agg = aggregateBy(filteredItems(), keyMap[state.ui.categoryTab]);

  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="tabs">${tabs.map(t => `<button data-tab="${t}" class="${t === state.ui.categoryTab ? 'active' : ''}">${t}</button>`).join('')}</div>
      <div class="grid-2">
        <div><h4>構成比</h4><div style="height:300px"><canvas id="catPie"></canvas></div></div>
        <div><h4>予実差（差額順／乖離率順）</h4><div class="table-wrap"><table><thead><tr><th>分類</th><th class="right">構成比</th><th class="right">差額</th><th class="right">乖離率</th></tr></thead><tbody>
          ${agg.slice(0, 25).map(r => `<tr><td>${r.key}</td><td class="right">${pct(r.comp)}</td><td class="right">${yen(r.gap)}</td><td class="right">${pct(r.gapRate)}</td></tr>`).join('')}
        </tbody></table></div></div>
      </div>
    </div>`;

  document.querySelectorAll('[data-tab]').forEach(btn => btn.onclick = () => { state.ui.categoryTab = btn.dataset.tab; renderCategory(); });
  const palette = ['#4f46e5','#0ea5e9','#22c55e','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f97316','#e11d48','#64748b'];
  new Chart(document.getElementById('catPie'), {
    type: 'doughnut',
    data: { labels: agg.slice(0, 10).map(v => v.key), datasets: [{ data: agg.slice(0, 10).map(v => v.comp), backgroundColor: palette.slice(0, Math.min(10, agg.length)), borderWidth: 1 }] },
    options: { maintainAspectRatio: false, responsive: true }
  });
}

function renderProject() {
  const rows = filteredItems().filter(r => isNewProject(r) || (r.payment_category || '').includes('投資'));
  const scatter = rows.slice(0, 100).map(r => ({
    x: Number(r.totalForecast || 0) / Math.max(Number(r.totalPlan || 1), 1) * 100,
    y: Number(r.totalActual || 0) / Math.max(Number(r.totalPlan || 1), 1) * 100,
  }));

  document.getElementById('content').innerHTML = `
    <div class="panel"><div class="controls"><input id="pSearch" type="text" placeholder="案件検索"></div><div style="height:300px"><canvas id="projectScatter"></canvas></div></div>
    <div class="panel"><div class="table-wrap"><table><thead><tr><th>プロジェクト</th><th class="right">予算実績差異</th><th class="right">進捗率</th><th class="right">コスト消化率</th><th>差額理由</th></tr></thead><tbody id="projectRows"></tbody></table></div></div>`;

  const drawRows = (q = '') => {
    const view = rows.filter(r => !q || (r.project_name || '').toLowerCase().includes(q.toLowerCase()));
    document.getElementById('projectRows').innerHTML = view.slice(0, 200).map(r => {
      const progress = Number(r.totalForecast || 0) / Math.max(Number(r.totalPlan || 1), 1) * 100;
      const burn = Number(r.totalActual || 0) / Math.max(Number(r.totalPlan || 1), 1) * 100;
      return `<tr data-mid="${r.management_no}"><td>${r.project_name || '(名称未設定)'}</td><td class="right">${yen(Number(r.totalPlan || 0) - Number(r.totalActual || 0))}</td><td class="right">${pct(progress)}</td><td class="right">${pct(burn)}</td><td>${r.variance_reason || '-'}</td></tr>`;
    }).join('');
    document.querySelectorAll('#projectRows tr').forEach(tr => tr.onclick = () => { state.ui.detailSearch = tr.dataset.mid; goPage('detail'); });
  };

  drawRows();
  document.getElementById('pSearch').oninput = e => drawRows(e.target.value);
  new Chart(document.getElementById('projectScatter'), { type: 'scatter', data: { datasets: [{ label: '案件', data: scatter }] }, options: { scales: { x: { title: { display: true, text: '進捗率(%)' } }, y: { title: { display: true, text: 'コスト消化率(%)' } } } } });
}

function renderAlert() {
  const t = state.settings.thresholds;
  const rows = filteredItems().map(r => {
    const gap = Number(r.totalPlan || 0) - Number(r.totalActual || 0);
    const rate = Number(r.totalPlan || 0) ? (Number(r.totalActual || 0) - Number(r.totalPlan || 0)) / Number(r.totalPlan || 1) * 100 : 0;
    return { ...r, gap, rate };
  }).filter(r => Math.abs(r.rate) >= t.varianceRate || Math.abs(r.gap) >= t.amountGap).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  const first = rows[0];
  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="controls"><span class="badge">しきい値: 乖離率 ${t.varianceRate}% / 差額 ${fmt(t.amountGap)} 千円 / 前月比 ${t.momRate}% / 前年比 ${t.yoyRate}%</span></div>
      <div class="grid-2">
        <div class="table-wrap"><table><thead><tr><th>案件</th><th class="right">差額</th><th class="right">乖離率</th></tr></thead><tbody>
          ${rows.slice(0, 200).map(r => `<tr data-mid="${r.management_no}"><td>${r.project_name || r.management_no}</td><td class="right warn">${yen(r.gap)}</td><td class="right">${pct(r.rate)}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="panel"><h4>右ペイン</h4>${first ? `<p><b>${first.project_name || first.management_no}</b></p><p>推移: 予算 ${yen(first.totalPlan)} / 実績 ${yen(first.totalActual)}</p><p>関連明細: ${first.system_name || '-'} / ${first.department_name || '-'}</p><p>メモ欄: ${first.memo || 'CSV列なし'}</p>` : 'アラート対象なし'}</div>
      </div>
    </div>`;

  document.querySelectorAll('tr[data-mid]').forEach(tr => tr.onclick = () => { state.ui.detailSearch = tr.dataset.mid; goPage('detail'); });
}

function renderVendor() {
  const items = filteredItems();
  const map = {};
  items.forEach(r => {
    const name = r.vendor_name || r.payee_name || '未設定ベンダー';
    if (!map[name]) map[name] = { name, amount: 0, count: 0 };
    const pay = Number(r.totalActual || 0) || Number(r.totalForecast || 0) || Number(r.totalPlan || 0);
    map[name].amount += pay;
    map[name].count += 1;
  });
  const ranking = Object.values(map).sort((a, b) => b.amount - a.amount);

  const now = new Date();
  const currentYm = Number(`${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`);
  const renewals = state.data.contracts.filter(c => {
    const ym = Number(c.renewal_month || 0);
    if (!ym) return false;
    const diff = (Math.floor(ym / 100) - Math.floor(currentYm / 100)) * 12 + (ym % 100) - (currentYm % 100);
    return diff >= 0 && diff <= 3;
  }).sort((a, b) => String(a.renewal_month || '').localeCompare(String(b.renewal_month || '')));

  document.getElementById('content').innerHTML = `
    <div class="grid-2">
      <div class="panel"><h4>ベンダー別支払額ランキング（Top／全件）</h4><div class="table-wrap"><table><thead><tr><th>ベンダー</th><th class="right">支払額</th><th class="right">件数</th></tr></thead><tbody>
        ${ranking.map(v => `<tr><td>${v.name}</td><td class="right">${yen(v.amount)}</td><td class="right">${fmt(v.count)}</td></tr>`).join('') || '<tr><td colspan="3">データなし</td></tr>'}
      </tbody></table></div></div>
      <div class="panel"><h4>契約更新月一覧（当月〜3か月先）</h4><div class="table-wrap"><table><thead><tr><th>契約番号</th><th>ベンダー</th><th>更新月</th></tr></thead><tbody>
        ${renewals.map(r => `<tr><td>${r.contract_no}</td><td>${r.vendor_name}</td><td>${r.renewal_month}</td></tr>`).join('') || '<tr><td colspan="3">対象なし</td></tr>'}
      </tbody></table></div></div>
    </div>`;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
}

function renderDetail() {
  const fixedCols = ['management_no', 'project_name', 'department_name', 'system_name'];
  const optionalCols = ['owner_name', 'vendor_name', 'budget_category', 'fixed_variable_type', 'payment_category', 'totalPlan', 'totalForecast', 'totalActual'];

  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="controls">
        <input type="text" id="dSearch" placeholder="キーワード検索" value="${state.ui.detailSearch || ''}">
        <button id="dExport">表示結果をCSV書き出し</button>
      </div>
      <div class="controls"><span class="badge">キー項目は常時表示</span></div>
      <div class="col-picker" id="colPicker">${optionalCols.map(c => `<span class="col-chip ${state.ui.extraDetailCols.includes(c) ? 'active' : ''}" data-col="${c}">${c}</span>`).join('')}</div>
      <div class="table-wrap"><table><thead><tr id="dHead"></tr></thead><tbody id="dBody"></tbody></table></div>
    </div>
    <div class="panel" id="detailPane">行クリックで属性(master)+月次(detail)を並列表示</div>`;

  const renderRows = () => {
    const q = document.getElementById('dSearch').value.toLowerCase();
    state.ui.detailSearch = q;
    const cols = [...fixedCols, ...state.ui.extraDetailCols];
    const view = filteredItems().filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));

    document.getElementById('dHead').innerHTML = cols.map(c => `<th>${c}</th>`).join('');
    document.getElementById('dBody').innerHTML = view.slice(0, 500).map((r, idx) => `<tr data-idx="${idx}">${cols.map(c => `<td>${r[c] ?? ''}</td>`).join('')}</tr>`).join('');

    document.querySelectorAll('#dBody tr').forEach(tr => tr.onclick = () => {
      const row = view[Number(tr.dataset.idx)];
      const master = { management_no: row.management_no, item_no: row.item_no, project_name: row.project_name, department_name: row.department_name, owner_name: row.owner_name, vendor_name: row.vendor_name, system_name: row.system_name, budget_category: row.budget_category };
      const detail = row.monthly || {};
      document.getElementById('detailPane').innerHTML = `<div class="grid-2"><div><h4>属性(master)</h4><pre>${JSON.stringify(master, null, 2)}</pre></div><div><h4>月次(detail)</h4><pre>${JSON.stringify(detail, null, 2)}</pre></div></div>`;
    });

    document.getElementById('dExport').onclick = () => {
      const csv = toCsv(view.map(r => Object.fromEntries(cols.map(c => [c, r[c] ?? '']))));
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'displayed_detail.csv';
      a.click();
    };
  };

  renderRows();
  document.getElementById('dSearch').oninput = renderRows;
  document.querySelectorAll('#colPicker .col-chip').forEach(chip => {
    chip.onclick = () => {
      const c = chip.dataset.col;
      if (state.ui.extraDetailCols.includes(c)) state.ui.extraDetailCols = state.ui.extraDetailCols.filter(v => v !== c);
      else state.ui.extraDetailCols.push(c);
      chip.classList.toggle('active');
      renderRows();
    };
  });
}

function renderSettings() {
  const t = state.settings.thresholds;
  document.getElementById('content').innerHTML = `
    <div class="panel">
      <h4>表示設定（データは変更しない）</h4>
      <div class="controls">
        <label>乖離率% <input id="sVar" type="number" value="${t.varianceRate}"></label>
        <label>差額金額 <input id="sAmt" type="number" value="${t.amountGap}"></label>
        <label>前月比% <input id="sMom" type="number" value="${t.momRate}"></label>
        <label>前年比% <input id="sYoy" type="number" value="${t.yoyRate}"></label>
      </div>
      <label>重要KPI 並び順（カンマ区切り）<input id="sKpi" type="text" style="width:100%" value="${state.settings.kpiOrder.join(',')}"></label>
      <div class="controls"><button class="primary" id="saveSetting">反映</button></div>
    </div>`;

  document.getElementById('saveSetting').onclick = () => {
    state.settings.thresholds.varianceRate = Number(document.getElementById('sVar').value || 10);
    state.settings.thresholds.amountGap = Number(document.getElementById('sAmt').value || 1000);
    state.settings.thresholds.momRate = Number(document.getElementById('sMom').value || 10);
    state.settings.thresholds.yoyRate = Number(document.getElementById('sYoy').value || 10);
    state.settings.kpiOrder = document.getElementById('sKpi').value.split(',').map(v => v.trim()).filter(Boolean);
    alert('表示設定を反映しました');
  };
}

async function renderPage() {
  document.getElementById('pageTitle').textContent = NAV_PAGES.find(p => p.key === state.page)?.label || '';
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
  document.getElementById('themeToggle').onclick = toggleTheme;
  await refreshAllData();
  renderPage();
})();
