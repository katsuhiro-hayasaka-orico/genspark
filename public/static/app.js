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
  { key: 'manual', label: '10. 取扱説明書（マニュアル）' },
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
    categoryTab: 'システム分類名別',
    trendMonths: 12,
    trendMetric: '総額',
    detailSearch: '',
    detailFilter: null,
    extraDetailCols: ['owner_name', 'vendor_name', 'budget_category', 'totalForecast'],
  },
};

const fmt = (n) => Number(n || 0).toLocaleString('ja-JP');
const pct = (n) => `${(Number(n || 0)).toFixed(1)}%`;
const yen = (n) => `${fmt(Math.round(Number(n || 0)))} 千円`;
const isNewProject = (r) => /新規|new/i.test(r.project_name || '');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[ch]));
const optionHtml = (value, selectedValue) => {
  const safe = escapeHtml(value);
  return `<option value="${safe}" ${value === selectedValue ? 'selected' : ''}>${safe}</option>`;
};
const dataAttr = (value) => escapeHtml(value);
const jsonForHtml = (value) => escapeHtml(JSON.stringify(value, null, 2));

const DETAIL_FILTER_LABELS = {
  management_no: '管理番号',
  category: 'カテゴリ',
  department: '部門',
  vendor: 'ベンダー',
  contract_no: '契約番号',
};

function setDetailFilter(type, value) {
  state.ui.detailFilter = value ? { type, value } : null;
  state.ui.detailSearch = '';
}

function detailFilterLabel(filter = state.ui.detailFilter) {
  if (!filter) return '';
  return `${DETAIL_FILTER_LABELS[filter.type] || filter.type}: ${filter.value}`;
}

function itemMatchesDetailFilter(item, filter = state.ui.detailFilter) {
  if (!filter || !filter.value) return true;
  const value = String(filter.value);
  if (filter.type === 'management_no') return String(item.management_no || '') === value;
  if (filter.type === 'department') return String(item.department_name || '') === value;
  if (filter.type === 'vendor') return String(item.vendor_name || item.payee_name || '') === value;
  if (filter.type === 'contract_no') return String(item.contract_no || '') === value;
  if (filter.type === 'category') {
    return [
      item.budget_category,
      item.system_classification,
      item.expense_classification,
      item.expense_item_name,
      item.fixed_variable_type,
      item.payment_category,
      item.system_name,
    ].some(v => String(v || '') === value);
  }
  return true;
}

function bindDetailFilterLinks(scope = document) {
  scope.querySelectorAll('[data-filter-type][data-filter-value]').forEach(el => {
    el.onclick = () => {
      setDetailFilter(el.dataset.filterType, el.dataset.filterValue);
      goPage('detail');
    };
  });
}

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `API Error ${res.status}`);
  return json;
}

function withViewTransition(update) {
  if (document.startViewTransition) {
    document.startViewTransition(update);
  } else {
    update();
  }
}

function toggleTheme() {
  withViewTransition(() => {
    const order = ['light', 'dark', 'neon'];
    const idx = order.indexOf(state.ui.theme);
    state.ui.theme = order[(idx + 1) % order.length];
    applyTheme();
    renderPage();
  });
}

function applyTheme() {
  document.body.dataset.theme = state.ui.theme;
  localStorage.setItem('theme', state.ui.theme);
  const themeLabel = { light: '☀️ ライト', dark: '🌙 ダーク', neon: '🌈 ネオン' };
  document.getElementById('themeToggle').textContent = `${themeLabel[state.ui.theme]}（切替）`;
  const sel = document.getElementById('themeSelect');
  if (sel) sel.value = state.ui.theme;
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

function scopedPeriodSummary(items) {
  const ts = buildTimeSeries(items);
  const lastLabel = ts.labels[ts.labels.length - 1];
  const scopeAll = state.filters.periodMode === '通期' || !lastLabel;
  let totalPlan = 0;
  let totalForecast = 0;
  let totalActual = 0;

  items.forEach((item) => {
    if (scopeAll) {
      totalPlan += Number(item.totalPlan || 0);
      totalForecast += Number(item.totalForecast || 0);
      totalActual += Number(item.totalActual || 0);
      return;
    }
    Object.entries(item.monthly || {}).forEach(([ym, m]) => {
      const key = state.filters.periodMode === '月次' ? ym : ymToQuarter(ym);
      if (key !== lastLabel) return;
      totalPlan += Number(m.plan || 0);
      totalForecast += Number(m.forecast || 0);
      totalActual += Number(m.actual || 0);
    });
  });

  return {
    totalPlan,
    totalForecast,
    totalActual,
    labels: ts.labels,
    series: ts.labels.map(l => ts.bucket[l] || { plan: 0, forecast: 0, actual: 0 }),
  };
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
  nav.innerHTML = NAV_PAGES.map(p => `<button class="nav-item ${p.key === state.page ? 'active' : ''}" data-page="${dataAttr(p.key)}" ${!state.hasData && !['import', 'manual'].includes(p.key) ? 'disabled' : ''}>${escapeHtml(p.label)}</button>`).join('');
  nav.querySelectorAll('.nav-item').forEach(b => b.onclick = () => goPage(b.dataset.page));
}

function initFilterBar() {
  const st = state.data.status || {};
  const depts = st.departments || [];
  const vendors = (st.vendors || []).slice(0, 20);
  const targets = ['すべて', '継続案件', '新規案件', ...vendors.map(v => `ベンダー:${v}`)];
  const root = document.getElementById('globalFilters');
  root.innerHTML = `
    <select id="fPeriod">${['月次', '四半期', '通期'].map(v => optionHtml(v, state.filters.periodMode)).join('')}</select>
    <select id="fDept"><option value="">全部門</option>${depts.map(v => optionHtml(v, state.filters.department)).join('')}</select>
    <select id="fPers">${['費目', 'システム', '固定・変動', '投資・運用'].map(v => optionHtml(v, state.filters.perspective)).join('')}</select>
    <select id="fTarget">${targets.map(v => optionHtml(v, state.filters.target)).join('')}</select>
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
  applyTheme();
  document.getElementById('statusBadge').textContent = state.hasData ? 'データ読込済' : 'データなし';
  document.getElementById('statusBadge').className = `status ${state.hasData ? 'ok' : ''}`;
  document.getElementById('sidebarMeta').innerHTML = state.hasData
    ? `${escapeHtml(state.data.status?.csvFileName || '')}<br>案件 ${fmt(state.data.status?.itemCount || 0)} 件`
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
  withViewTransition(() => {
    state.page = page;
    initNav();
    renderPage();
  });
}

function parseCsvPreviewRecords(text, delimiter = ',') {
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false;
  const normalized = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (ch === delimiter) {
      record.push(field);
      field = '';
      fieldStarted = false;
    } else if (ch === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      fieldStarted = false;
    } else {
      field += ch;
      fieldStarted = true;
    }
  }

  if (field.length || fieldStarted || record.length) {
    record.push(field);
    records.push(record);
  }
  return records;
}

function detectPreviewDelimiter(text) {
  const firstLine = String(text || '').split(/\r?\n/, 1)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
}

function csvClientChecks(text) {
  const records = parseCsvPreviewRecords(text, detectPreviewDelimiter(text));
  if (!records.length) return { errors: ['空ファイルです'], summary: null };
  const headers = records[0].map(s => s.trim());
  const hasId = headers.includes('管理番号') || headers.includes('管理番号（統合）');
  const hasItem = headers.includes('項番');
  const monthCols = headers.filter(h => /期\d{1,2}月(計画|見込)$/.test(h));
  const rows = records.slice(1).filter(r => r.some(v => String(v || '').trim()));
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
  new Chart(el, { type: 'line', data: { labels, datasets }, options: { maintainAspectRatio: false, responsive: true, plugins: { legend: { labels: { color: 'var(--text)' } } }, scales: { x: { ticks: { color: 'var(--text)' }, grid: { color: 'var(--line)' } }, y: { ticks: { color: 'var(--text)' }, grid: { color: 'var(--line)' } } } } });
}

function chartColors() {
  if (state.ui.theme === 'neon') return { c1: '#32E0FF', c2: '#AE7CFF', c3: '#FF4FD8', c4: '#7DFF9B', pie: ['#32E0FF','#AE7CFF','#FF4FD8','#7DFF9B','#FFD166','#6CF0FF','#D6A3FF','#FF8AE2','#9DFFB5','#7E89FF'] };
  if (state.ui.theme === 'dark') return { c1: '#FB5B01', c2: '#FFC199', c3: '#FFC700', c4: '#82D4A5', pie: ['#FB5B01','#FF8D44','#FFC199','#FFC700','#A58000','#82D4A5','#6BC7FF','#C8A2FF','#666','#999'] };
  return { c1: '#AC3E00', c2: '#541E00', c3: '#FB5B01', c4: '#197A4B', pie: ['#541E00','#AC3E00','#FB5B01','#FF8D44','#FFC199','#A58000','#D2A400','#FFC700','#666666','#999999'] };
}

function renderImport() {
  document.getElementById('content').innerHTML = `
    <div class="panel">
      <h3>CSV取込</h3>
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
    document.getElementById('importSummary').innerHTML = c.summary ? `<div class="panel"><h4>読み込み結果サマリー（表示のみ）</h4><ul><li>読み込み件数: ${fmt(c.summary.count)}</li><li>対象期間: ${escapeHtml(c.summary.periodRange)}</li><li>欠損の多い列: ${escapeHtml(c.summary.missingHeavy)}</li><li>数値列への文字混入候補: ${fmt(c.summary.invalidNumeric)}</li></ul></div>` : '';
    document.getElementById('importErrors').innerHTML = `<div class="panel"><h4>エラーパネル（表示のみ）</h4>${c.errors.length ? `<ul>${c.errors.map(e => `<li class="warn">${escapeHtml(e)}</li>`).join('')}</ul>` : '問題は検知されませんでした。'}</div>`;
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

function kpiStatus(name, value, thresholds) {
  if (name === '予算消化率') {
    if (value > 105) return { tone: 'warn', label: '超過注意', icon: '⚠️' };
    if (value >= 90) return { tone: 'ok', label: '順調', icon: '●' };
    return { tone: 'neutral', label: '進行中', icon: '●' };
  }
  if (name === '予算-実績') {
    if (Math.abs(value) >= thresholds.amountGap) return { tone: 'warn', label: '要確認', icon: '⚠️' };
    return { tone: 'ok', label: '許容範囲', icon: '●' };
  }
  if (name === 'コスト削減効果') {
    return value > 0 ? { tone: 'ok', label: '削減効果あり', icon: '●' } : { tone: 'neutral', label: '効果なし', icon: '●' };
  }
  return { tone: 'neutral', label: '確認対象', icon: '●' };
}

function kpiHelpText(name) {
  const map = {
    '総予算': '選択中の期間・部門・対象における計画金額の合計です。',
    '総実績': '選択範囲で確定済みの実績金額の合計です。',
    '予算消化率': '総実績 ÷ 総予算。100%超は予算超過リスクとして確認します。',
    '予算-実績': '総予算から総実績を差し引いた残額です。大きなプラス／マイナスは原因確認対象です。',
    '着地見込み': '登録済み見込額の合計です。未設定の場合はCSV列・期間を確認してください。',
    'コスト削減効果': '予算残額のうちプラス分を削減効果として見ます。',
  };
  return map[name] || 'KPIの読み方を確認します。';
}

function renderSummary() {
  const items = filteredItems();
  const s = scopedPeriodSummary(items);
  const diff = s.totalPlan - s.totalActual;
  const actualRate = s.totalPlan ? s.totalActual / s.totalPlan * 100 : 0;
  const reduction = Math.max(diff, 0);
  const reductionRate = s.totalPlan ? reduction / s.totalPlan * 100 : 0;
  const top = items.map(r => ({
    name: r.project_name || '(案件名未設定)',
    gap: Number(r.totalPlan || 0) - Number(r.totalActual || 0),
    row: r,
  })).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 10);
  const kpiRaw = {
    '総予算': s.totalPlan,
    '総実績': s.totalActual,
    '予算消化率': actualRate,
    '予算-実績': diff,
    '着地見込み': s.totalForecast,
    'コスト削減効果': reduction,
  };
  const kpiDisplay = {
    '総予算': yen(s.totalPlan),
    '総実績': yen(s.totalActual),
    '予算消化率': pct(actualRate),
    '予算-実績': yen(diff),
    '着地見込み': s.totalForecast ? yen(s.totalForecast) : '未設定',
    'コスト削減効果': `${yen(reduction)} / ${pct(reductionRate)}`,
  };

  const kpiCards = state.settings.kpiOrder.map((name, idx) => {
    const status = kpiStatus(name, kpiRaw[name], state.settings.thresholds);
    const popId = `kpiHelp${idx}`;
    const isHero = ['総予算', '総実績', '予算消化率'].includes(name);
    return `<article class="kpi kpi-card ${isHero ? 'kpi-card--priority' : ''}" aria-label="${dataAttr(name)}">
      <div class="kpi-head">
        <div class="label">${escapeHtml(name)}</div>
        <button class="icon-button" type="button" popovertarget="${popId}" aria-label="${dataAttr(name)}の説明を開く">?</button>
        <div id="${popId}" class="popover-card" popover role="note">${escapeHtml(kpiHelpText(name))}</div>
      </div>
      <div class="value ${status.tone === 'warn' ? 'warn' : ''}">${kpiDisplay[name] || ''}</div>
      <div class="kpi-meta">
        <span class="status-pill status-pill--${status.tone}">${status.icon} ${escapeHtml(status.label)}</span>
        <span>${escapeHtml(state.filters.periodMode)} / ${escapeHtml(state.filters.department || '全部門')}</span>
      </div>
      <p class="kpi-note">${escapeHtml(kpiHelpText(name))}</p>
    </article>`;
  }).join('');

  document.getElementById('content').innerHTML = `
    <section class="dashboard-bento" aria-label="経営サマリーダッシュボード">
      <div class="bento-card bento-card--hero summary-hero">
        <div>
          <p class="eyebrow">Executive overview</p>
          <h3>まず見るべき予実差と消化状況</h3>
          <p class="muted">上部フィルターを反映した最新スコープです。大きな差異はランキングから明細へドリルダウンできます。</p>
        </div>
        <div class="hero-metric ${Math.abs(diff) >= state.settings.thresholds.amountGap ? 'warn' : 'ok'}">
          <span>予算-実績</span><strong>${yen(diff)}</strong>
        </div>
      </div>
      <div class="bento-card bento-card--wide kpi-strip">${kpiCards}</div>
      <div class="bento-card bento-card--wide chart-card">
        <div class="card-title-row"><h4>予算 vs 実績の推移</h4><span class="badge">最優先グラフ</span></div>
        <div class="chart-frame chart-frame--large"><canvas id="sumChart1"></canvas></div>
      </div>
      <div class="bento-card bento-card--tall chart-card">
        <div class="card-title-row"><h4>前年差グラフ</h4><span class="badge">前期差で代替</span></div>
        <p class="card-help">実績の急な増減を確認します。</p>
        <div class="chart-frame"><canvas id="sumChart2"></canvas></div>
      </div>
      <div class="bento-card bento-card--wide ranking-card">
        <div class="card-title-row">
          <h4>差異が大きいカテゴリ／案件ランキング（Top10）</h4>
          <button class="icon-button" type="button" popovertarget="rankHelp" aria-label="差異ランキングの読み方を開く">?</button>
          <div id="rankHelp" class="popover-card" popover role="note">絶対差額が大きい順です。行クリックで明細へドリルダウンします。</div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>対象</th><th class="right">差額</th><th>状態</th></tr></thead><tbody>
        ${top.map((r, i) => {
          const isWarn = Math.abs(r.gap) >= state.settings.thresholds.amountGap;
          return `<tr data-filter-type="management_no" data-filter-value="${dataAttr(r.row.management_no)}" class="clickable-row ${isWarn ? 'warning-row' : ''}"><td>${i + 1}. ${escapeHtml(r.name)}</td><td class="right ${isWarn ? 'warn' : ''}">${yen(r.gap)}</td><td><span class="status-pill status-pill--${isWarn ? 'warn' : 'ok'}">${isWarn ? '⚠️ 要確認' : '● 許容範囲'}</span></td></tr>`;
        }).join('')}
        </tbody></table></div>
      </div>
      <div class="bento-card bento-card--small insight-card">
        <h4>フィルター中の件数</h4><strong>${fmt(items.length)}</strong><span class="muted">案件</span>
      </div>
    </section>`;

  const labels = s.labels;
  const series = s.series;
  const cc = chartColors();
  drawLine('sumChart1', labels, [
    { label: '予算', data: series.map(v => v.plan), borderColor: cc.c1 },
    { label: '実績', data: series.map(v => v.actual), borderColor: cc.c2 },
  ]);
  const deltas = series.map((v, idx) => idx === 0 ? 0 : v.actual - series[idx - 1].actual);
  drawLine('sumChart2', labels, [{ label: '前年差(代替:前期差)', data: deltas, borderColor: cc.c3 }]);

  bindDetailFilterLinks();
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
        <label>指標 <select id="trendMetric">${['総額', '費目別', 'システム別'].map(v => optionHtml(v, state.ui.trendMetric)).join('')}</select></label>
      </div>
      <div style="height:320px"><canvas id="trendChart"></canvas></div>
    </div>
    <div class="panel"><h4>変動の大きい順ランキング（前年差・前月差）</h4><div class="table-wrap"><table><thead><tr><th>対象</th><th class="right">前年差</th><th class="right">前月差</th></tr></thead><tbody>
      ${rank.map(r => `<tr class="clickable-row" data-filter-type="management_no" data-filter-value="${dataAttr(r.management_no)}"><td>${escapeHtml(r.name)}</td><td class="right">${yen(r.yoy)}</td><td class="right">${yen(r.mom)}</td></tr>`).join('')}
    </tbody></table></div></div>`;

  const cc = chartColors();
  drawLine('trendChart', labels, [
    { label: '予算', data: series.map(v => v.plan), borderColor: cc.c1 },
    { label: '見込', data: series.map(v => v.forecast), borderColor: cc.c3 },
    { label: '実績', data: series.map(v => v.actual), borderColor: cc.c2 },
  ]);

  document.getElementById('trendMonths').onchange = e => { state.ui.trendMonths = Number(e.target.value); renderTrend(); };
  document.getElementById('trendMetric').onchange = e => { state.ui.trendMetric = e.target.value; renderTrend(); };
  bindDetailFilterLinks();
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
  const tabs = ['システム分類名別', '経費区分別', '経費事象名別', '部門別', '固定費・変動費'];
  const keyMap = { 'システム分類名別': 'system_classification', '経費区分別': 'expense_classification', '経費事象名別': 'expense_item_name', '部門別': 'department_name', '固定費・変動費': 'fixed_variable_type' };
  const categoryKey = keyMap[state.ui.categoryTab];
  const agg = aggregateBy(filteredItems(), categoryKey);

  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="tabs">${tabs.map(t => `<button data-tab="${dataAttr(t)}" class="${t === state.ui.categoryTab ? 'active' : ''}">${escapeHtml(t)}</button>`).join('')}</div>
      <div class="grid-2">
        <div><h4>構成比</h4><div style="height:300px"><canvas id="catPie"></canvas></div></div>
        <div><h4>予実差（差額順／乖離率順）</h4><div class="table-wrap"><table><thead><tr><th>分類</th><th class="right">構成比</th><th class="right">差額</th><th class="right">乖離率</th></tr></thead><tbody>
          ${agg.slice(0, 25).map(r => `<tr class="clickable-row" data-filter-type="${categoryKey === 'department_name' ? 'department' : 'category'}" data-filter-value="${dataAttr(r.key)}"><td>${escapeHtml(r.key)}</td><td class="right">${pct(r.comp)}</td><td class="right">${yen(r.gap)}</td><td class="right">${pct(r.gapRate)}</td></tr>`).join('')}
        </tbody></table></div></div>
      </div>
    </div>`;

  document.querySelectorAll('[data-tab]').forEach(btn => btn.onclick = () => { state.ui.categoryTab = btn.dataset.tab; renderCategory(); });
  bindDetailFilterLinks();
  const palette = chartColors().pie;
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
      return `<tr class="clickable-row" data-filter-type="management_no" data-filter-value="${dataAttr(r.management_no)}"><td>${escapeHtml(r.project_name || '(名称未設定)')}</td><td class="right">${yen(Number(r.totalPlan || 0) - Number(r.totalActual || 0))}</td><td class="right">${pct(progress)}</td><td class="right">${pct(burn)}</td><td>${escapeHtml(r.variance_reason || '-')}</td></tr>`;
    }).join('');
    bindDetailFilterLinks(document.getElementById('projectRows'));
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
  const alertCards = rows.slice(0, 4).map((r, idx) => `
    <article class="alert-card ${idx === 0 ? 'alert-card--major' : ''}">
      <div class="card-title-row"><h4>⚠️ ${escapeHtml(r.project_name || r.management_no)}</h4><span class="status-pill status-pill--warn">重要度 ${idx + 1}</span></div>
      <dl class="metric-list"><div><dt>差額</dt><dd class="warn">${yen(r.gap)}</dd></div><div><dt>乖離率</dt><dd>${pct(r.rate)}</dd></div></dl>
      <p class="muted">${escapeHtml(r.department_name || '-')} / ${escapeHtml(r.system_name || '-')}</p>
      <button type="button" data-filter-type="management_no" data-filter-value="${dataAttr(r.management_no)}" aria-label="${dataAttr(r.project_name || r.management_no)}の明細を表示">明細を見る</button>
    </article>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="panel alert-overview">
      <div class="controls"><span class="badge">しきい値: 乖離率 ${t.varianceRate}% / 差額 ${fmt(t.amountGap)} 千円 / 前月比 ${t.momRate}% / 前年比 ${t.yoyRate}%</span></div>
      <div class="alert-grid">${alertCards || '<div class="ok">● アラート対象なし</div>'}</div>
    </div>
    <div class="grid-2">
      <div class="panel"><h4>アラート一覧</h4><div class="table-wrap"><table><thead><tr><th>案件</th><th class="right">差額</th><th class="right">乖離率</th><th>状態</th></tr></thead><tbody>
        ${rows.slice(0, 200).map(r => `<tr data-filter-type="management_no" data-filter-value="${dataAttr(r.management_no)}" class="clickable-row warning-row"><td>${escapeHtml(r.project_name || r.management_no)}</td><td class="right warn">${yen(r.gap)}</td><td class="right">${pct(r.rate)}</td><td><span class="status-pill status-pill--warn">⚠️ 要確認</span></td></tr>`).join('') || '<tr><td colspan="4">対象なし</td></tr>'}
      </tbody></table></div></div>
      <div class="panel"><h4>最重要アラートの詳細</h4>${first ? `<p><b>${escapeHtml(first.project_name || first.management_no)}</b></p><p>推移: 予算 ${yen(first.totalPlan)} / 実績 ${yen(first.totalActual)}</p><p>関連明細: ${escapeHtml(first.system_name || '-')} / ${escapeHtml(first.department_name || '-')}</p><p>メモ欄: ${escapeHtml(first.memo || 'CSV列なし')}</p><button id="alertDetailBtn" type="button">詳細説明を開く</button><dialog id="alertDetailDialog" aria-labelledby="alertDialogTitle"><h3 id="alertDialogTitle">アラートの読み方</h3><p>差額・乖離率の両方を確認し、対象案件の明細で月次推移と担当部門を確認してください。</p><form method="dialog"><button>閉じる</button></form></dialog>` : 'アラート対象なし'}</div>
    </div>`;

  bindDetailFilterLinks();
  const dialog = document.getElementById('alertDetailDialog');
  const btn = document.getElementById('alertDetailBtn');
  if (dialog && btn) btn.onclick = () => dialog.showModal();
}

function renderVendor() {
  const items = filteredItems();
  const map = {};
  const periodSummary = scopedPeriodSummary(items);
  const latestLabel = periodSummary.labels[periodSummary.labels.length - 1];
  const scopeAll = state.filters.periodMode === '通期' || !latestLabel;
  items.forEach(r => {
    const name = r.vendor_name || r.payee_name || '未設定ベンダー';
    if (!map[name]) map[name] = { name, amount: 0, count: 0 };
    let pay = 0;
    if (scopeAll) {
      pay = Number(r.totalActual || 0) || Number(r.totalForecast || 0) || Number(r.totalPlan || 0);
    } else {
      Object.entries(r.monthly || {}).forEach(([ym, m]) => {
        const key = state.filters.periodMode === '月次' ? ym : ymToQuarter(ym);
        if (key === latestLabel) pay += Number(m.actual || 0) || Number(m.forecast || 0) || Number(m.plan || 0);
      });
    }
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
    <section class="vendor-bento">
      <div class="bento-card bento-card--wide"><div class="card-title-row"><h4>ベンダー別支払額ランキング</h4><span class="badge">集中リスク確認</span></div><div class="table-wrap"><table><thead><tr><th>ベンダー</th><th class="right">支払額</th><th class="right">件数</th><th>状態</th></tr></thead><tbody>
        ${ranking.map((v, idx) => `<tr class="clickable-row" data-filter-type="vendor" data-filter-value="${dataAttr(v.name)}"><td>${escapeHtml(v.name)}</td><td class="right">${yen(v.amount)}</td><td class="right">${fmt(v.count)}</td><td><span class="status-pill status-pill--${idx < 3 ? 'warn' : 'neutral'}">${idx < 3 ? '⚠️ 上位集中' : '● 通常'}</span></td></tr>`).join('') || '<tr><td colspan="4">データなし</td></tr>'}
      </tbody></table></div></div>
      <div class="bento-card bento-card--tall"><div class="card-title-row"><h4>契約更新月一覧</h4><span class="badge">当月〜3か月先</span></div><div class="renewal-list">
        ${renewals.map(r => `<article class="renewal-card clickable-row" data-filter-type="contract_no" data-filter-value="${dataAttr(r.contract_no)}"><span class="status-pill status-pill--warn">⚠️ 更新判断</span><strong>${escapeHtml(r.vendor_name)}</strong><span>${escapeHtml(r.contract_no)}</span><b>${escapeHtml(r.renewal_month)}</b></article>`).join('') || '<p>対象なし</p>'}
      </div></div>
    </section>`;

  bindDetailFilterLinks();
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
}

function renderDetail() {
  const fixedCols = ['management_no', 'project_name', 'department_name', 'system_name'];
  const optionalCols = ['owner_name', 'vendor_name', 'budget_category', 'fixed_variable_type', 'payment_category', 'contract_no', 'totalPlan', 'totalForecast', 'totalActual'];
  const drilldownBadge = state.ui.detailFilter
    ? `<span class="badge">ドリルダウン: ${escapeHtml(detailFilterLabel())}</span><button id="dClearFilter" type="button">絞り込み解除</button>`
    : '<span class="badge">ドリルダウンなし</span>';

  document.getElementById('content').innerHTML = `
    <section class="detail-layout">
      <div class="panel detail-tools">
        <div class="controls detail-controls">
          <label class="search-field">検索<input type="text" id="dSearch" placeholder="管理番号・案件名・ベンダーで検索" value="${dataAttr(state.ui.detailSearch || '')}"></label>
          <button id="dExport" aria-label="表示中の明細をCSVで書き出す">表示結果をCSV書き出し</button>
          <span class="badge">キー項目は常時表示</span>
          ${drilldownBadge}
        </div>
        <div class="col-picker" id="colPicker" aria-label="表示列の選択">${optionalCols.map(c => `<label class="col-chip" data-col="${dataAttr(c)}"><input type="checkbox" ${state.ui.extraDetailCols.includes(c) ? 'checked' : ''}>${escapeHtml(c)}</label>`).join('')}</div>
      </div>
      <div class="panel detail-table-card">
        <h4>明細テーブル</h4>
        <div class="table-wrap"><table><thead><tr id="dHead"></tr></thead><tbody id="dBody"></tbody></table></div>
      </div>
      <div class="panel detail-pane" id="detailPane"><h4>詳細ペイン</h4><p>行クリックで属性(master)+月次(detail)を並列表示します。</p></div>
    </section>`;

  const renderRows = () => {
    const q = document.getElementById('dSearch').value.toLowerCase();
    state.ui.detailSearch = q;
    const cols = [...fixedCols, ...state.ui.extraDetailCols];
    const view = filteredItems().filter(r => itemMatchesDetailFilter(r)).filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));

    document.getElementById('dHead').innerHTML = cols.map(c => `<th>${escapeHtml(c)}</th>`).join('');
    document.getElementById('dBody').innerHTML = view.slice(0, 500).map((r, idx) => `<tr data-idx="${idx}" class="clickable-row">${cols.map(c => `<td>${escapeHtml(r[c] ?? '')}</td>`).join('')}</tr>`).join('');

    document.querySelectorAll('#dBody tr').forEach(tr => tr.onclick = () => {
      const row = view[Number(tr.dataset.idx)];
      const master = { management_no: row.management_no, item_no: row.item_no, project_name: row.project_name, department_name: row.department_name, owner_name: row.owner_name, vendor_name: row.vendor_name, system_name: row.system_name, budget_category: row.budget_category };
      const detail = row.monthly || {};
      document.getElementById('detailPane').innerHTML = `<h4>詳細ペイン</h4><div class="detail-card-grid"><div><h5>属性(master)</h5><pre>${jsonForHtml(master)}</pre></div><div><h5>月次(detail)</h5><pre>${jsonForHtml(detail)}</pre></div></div>`;
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

  const clearFilter = document.getElementById('dClearFilter');
  if (clearFilter) clearFilter.onclick = () => { state.ui.detailFilter = null; renderDetail(); };

  renderRows();
  document.getElementById('dSearch').oninput = renderRows;
  document.querySelectorAll('#colPicker .col-chip').forEach(chip => {
    chip.onchange = () => {
      const c = chip.dataset.col;
      if (state.ui.extraDetailCols.includes(c)) state.ui.extraDetailCols = state.ui.extraDetailCols.filter(v => v !== c);
      else state.ui.extraDetailCols.push(c);
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
      <label>重要KPI 並び順（カンマ区切り）<input id="sKpi" type="text" style="width:100%" value="${dataAttr(state.settings.kpiOrder.join(','))}"></label>
      <div class="controls"><button class="primary" id="saveSetting">反映</button></div>
    </div>`;
  document.getElementById('content').insertAdjacentHTML('beforeend', `
    <div class="panel">
      <h4>テーマ設定</h4>
      <div class="controls">
        <label>表示テーマ
          <select id="themeSelect">
            <option value="light">ライト</option><option value="dark">ダーク</option><option value="neon">ネオン</option>
          </select>
        </label>
      </div>
    </div>
  `);
  document.getElementById('themeSelect').value = state.ui.theme;
  document.getElementById('themeSelect').onchange = (e) => { state.ui.theme = e.target.value; applyTheme(); renderPage(); };

  document.getElementById('saveSetting').onclick = () => {
    state.settings.thresholds.varianceRate = Number(document.getElementById('sVar').value || 10);
    state.settings.thresholds.amountGap = Number(document.getElementById('sAmt').value || 1000);
    state.settings.thresholds.momRate = Number(document.getElementById('sMom').value || 10);
    state.settings.thresholds.yoyRate = Number(document.getElementById('sYoy').value || 10);
    state.settings.kpiOrder = document.getElementById('sKpi').value.split(',').map(v => v.trim()).filter(Boolean);
    alert('表示設定を反映しました');
  };
}

function renderManual() {
  document.getElementById('content').innerHTML = `
    <div class="panel"><h3>このアプリでできること（全体像）</h3>
      <p>予算・見込・実績を1つの画面で確認し、会議で必要な説明資料を短時間で準備するための可視化アプリです。</p>
      <ul><li>月次会議での予実差確認</li><li>コスト削減委員会での優先課題抽出</li><li>部門・案件・ベンダー単位の深掘り</li></ul>
      <div class="badge">推奨の閲覧順：1. データ取込 → 2. 全体サマリー → 6. アラート → 8. 明細</div>
    </div>
    <div class="panel"><h3>画面別ガイド（見方と操作方法）</h3>
      <h4>1. データ取込</h4>
      <ul><li><b>見るポイント：</b>読み込み件数、対象期間、警告件数。</li><li><b>操作：</b>CSVを選択してアップロード。エラーがあれば修正後に再取込。</li></ul>
      <h4>2. 全体サマリー（月次レポート）</h4>
      <ul><li><b>見るポイント：</b>KPIカード（総予算・総実績・予算消化率）と差額ランキング。</li><li><b>操作：</b>上部フィルタ（期間・部門・観点・対象）を切替えて、差異の大きい領域を特定。</li></ul>
      <h4>3. 推移（前年差／トレンド）</h4>
      <ul><li><b>見るポイント：</b>異常に増減した月、前年同月比の跳ね。</li><li><b>操作：</b>表示月数や指標を切替え、異常月を起点に原因を深掘り。</li></ul>
      <h4>4. カテゴリ別分析</h4>
      <ul><li><b>見るポイント：</b>費目・システム・固定変動など切り口別の構成比。</li><li><b>操作：</b>タブ切替で観点を変更し、寄与度の高いカテゴリを確認。</li></ul>
      <h4>5. プロジェクト別（新規案件）</h4>
      <ul><li><b>見るポイント：</b>新規案件の予算規模、見込乖離、進捗。</li><li><b>操作：</b>対象フィルタで新規案件に絞り、案件別に優先度を判断。</li></ul>
      <h4>6. アラート（乖離・変動）</h4>
      <ul><li><b>見るポイント：</b>乖離率・差額・前月比・前年比のしきい値超過。</li><li><b>操作：</b>9. 表示設定でしきい値を調整し、重要アラートのみ抽出。</li></ul>
      <h4>7. ベンダー／契約更新</h4>
      <ul><li><b>見るポイント：</b>ベンダー別支出、契約更新時期、集中リスク。</li><li><b>操作：</b>ベンダー単位で並べ替え、更新月の重なりを確認。</li></ul>
      <h4>8. 明細（検索・ドリルダウン）</h4>
      <ul><li><b>見るポイント：</b>案件単位の実績・見込・担当者・ベンダー情報。</li><li><b>操作：</b>キーワード検索、列表示切替、他画面からのドリルダウン確認。</li></ul>
      <h4>9. 表示設定</h4>
      <ul><li><b>見るポイント：</b>アラート判定に使うしきい値とKPI表示順。</li><li><b>操作：</b>しきい値・KPI順・テーマ（ライト/ダーク/ネオン）を変更して反映。</li></ul>
      <h4>10. 取扱説明書（マニュアル）</h4>
      <ul><li><b>見るポイント：</b>運用手順、FAQ、画面別の活用方法。</li><li><b>操作：</b>不明点は本画面に戻り、該当する画面説明を確認。</li></ul>
    </div>
    <div class="panel"><h3>使い方チュートリアル（ステップ形式）</h3>
      <h4>Step 1：データ取込</h4>
      <ol><li>「1. データ取込」へ移動しCSVをアップロードします。</li><li>「読み込み結果サマリー」で件数・対象期間を確認します。</li><li>エラーパネルで不足列や数値不正を確認し、CSVを修正して再取込します。</li></ol>
      <h4>Step 2：全体サマリーの見方</h4>
      <ol><li>KPIカードで「総予算・総実績・予算消化率」を確認します。</li><li>「予算-実績」の差額が大きい項目（赤表示）を優先確認します。</li><li>ランキング上位をクリックし、明細へドリルダウンします。</li></ol>
      <h4>Step 3：分析・ドリルダウン</h4>
      <ol><li>「推移」で時系列の異常月を特定します。</li><li>「カテゴリ別分析」で費目・部門など観点を切替え、原因候補を絞ります。</li><li>「明細」で検索し、個票レベルで確認します。</li></ol>
    </div>
    <div class="panel"><h3>よくある質問（FAQ）</h3>
      <p><b>Q. 数字が合わないときは？</b><br>A. 期間フィルタ（月次/四半期/通期）と対象（部門・案件）をそろえてから確認してください。CSVのヘッダ名・数値形式も再確認してください。</p>
      <p><b>Q. どこから確認を始めるべきですか？</b><br>A. まずは「2. 全体サマリー」で全体感を把握し、次に「6. アラート」で優先課題を抽出、最後に「8. 明細」で根拠を確認する流れがおすすめです。</p>
      <p><b>Q. 表示を切り替えたいときは？</b><br>A. ヘッダ右上、または「9. 表示設定」のテーマ選択でライト/ダーク/ネオンを即時切替できます。選択はブラウザに保存されます。</p>
      <div class="badge">初回アクセスの方へ：まずは Step 1 → Step 2 → Step 3 の順でお試しください。</div>
    </div>`;
}

async function renderPage() {
  document.getElementById('pageTitle').textContent = NAV_PAGES.find(p => p.key === state.page)?.label || '';
  if (state.page === 'import') return renderImport();
  if (state.page === 'manual') return renderManual();
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

function showManualHintDialog() {
  if (localStorage.getItem('manualHintSeen')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="manualHintDialog" aria-labelledby="manualHintTitle" aria-describedby="manualHintDesc">
      <h3 id="manualHintTitle">初回チュートリアル</h3>
      <p id="manualHintDesc">チュートリアルは「10. 取扱説明書（マニュアル）」から確認できます。</p>
      <form method="dialog" class="controls">
        <button class="primary" value="ok">始める</button>
      </form>
    </dialog>`);
  const dialog = document.getElementById('manualHintDialog');
  dialog.addEventListener('close', () => localStorage.setItem('manualHintSeen', '1'), { once: true });
  if (dialog.showModal) dialog.showModal();
  else localStorage.setItem('manualHintSeen', '1');
}

(async function boot() {
  document.getElementById('themeToggle').onclick = toggleTheme;
  document.getElementById('themeToggle').title = 'ライト / ダーク / ネオン';
  await refreshAllData();
  showManualHintDialog();
  renderPage();
})();
