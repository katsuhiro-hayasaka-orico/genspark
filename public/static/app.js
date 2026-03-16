// =============================================
// Budget CSV Viewer - Frontend App v4.0
// New schema: management_no based, period/year_month tracking
// Plan / Forecast / Actual comparison dashboard
// =============================================

const state = {
  currentPage: 'upload',
  hasData: false,
  masterFileName: null,
  detailFileName: null,
  charts: {},
};

// === Utility Functions ===
function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('ja-JP');
}

function fmtMoney(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  const abs = Math.abs(Math.round(n));
  const formatted = abs.toLocaleString('ja-JP');
  return n < 0 ? '-' + formatted : formatted;
}

function pct(n) {
  if (n === null || n === undefined || isNaN(n)) return '0.0%';
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

function varianceClass(val) {
  if (val > 2) return 'overrun';
  if (val < -2) return 'underrun';
  return '';
}

function varianceIcon(val) {
  if (val > 2) return '<i class="fas fa-arrow-up text-red-500 text-[10px]"></i>';
  if (val < -2) return '<i class="fas fa-arrow-down text-green-500 text-[10px]"></i>';
  return '<i class="fas fa-minus text-gray-400 text-[10px]"></i>';
}

function fmtYM(ym) {
  const s = String(ym).trim();
  if (s.length === 6) return s.substring(0, 4) + '/' + s.substring(4, 6);
  return ym;
}

function shortYM(ym) {
  const s = String(ym).trim();
  if (s.length === 6) {
    const m = parseInt(s.substring(4, 6));
    return m + '月';
  }
  return ym;
}

const COLORS = {
  plan: '#3b82f6',
  forecast: '#f59e0b',
  actual: '#22c55e',
  planBg: 'rgba(59,130,246,0.15)',
  forecastBg: 'rgba(245,158,11,0.15)',
  actualBg: 'rgba(34,197,94,0.15)',
};
const PIE_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#64748b','#f97316','#06b6d4','#84cc16','#d946ef'];

async function api(path) {
  const res = await fetch('/api' + path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'API Error' }));
    throw new Error(err.error || 'API Error: ' + res.status);
  }
  return res.json();
}

function showToast(msg, type = 'success') {
  const tc = document.getElementById('toastContainer');
  const colors = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500' };
  const icons = { success: 'check-circle', error: 'exclamation-circle', warning: 'exclamation-triangle', info: 'info-circle' };
  const el = document.createElement('div');
  el.className = `${colors[type]} text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 fade-in text-[13px] max-w-sm`;
  el.innerHTML = `<i class="fas fa-${icons[type]}"></i><span>${msg}</span>`;
  tc.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

function destroyCharts() {
  Object.values(state.charts).forEach(c => { if (c && c.destroy) c.destroy(); });
  state.charts = {};
}

// === Navigation ===
function navigateTo(page) {
  if (!state.hasData && page !== 'upload') return;
  state.currentPage = page;
  destroyCharts();
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const labels = {
    'upload': 'CSVアップロード',
    'dashboard': 'ダッシュボード',
    'analysis': '分析・比較',
    'variance': '予算差異',
    'items': '明細一覧',
  };
  document.getElementById('breadcrumb').innerHTML =
    `<span class="text-gray-400">ホーム</span><i class="fas fa-chevron-right text-[10px] mx-1.5 text-gray-300"></i><span class="text-gray-700 font-medium">${labels[page] || page}</span>`;
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('sidebarOverlay').classList.add('hidden');
  renderPage(page);
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('-translate-x-full');
  document.getElementById('sidebarOverlay').classList.toggle('hidden');
}

function enableNav() {
  ['navDashboard', 'navAnalysis', 'navVariance', 'navItems'].forEach(id => {
    document.getElementById(id)?.classList.remove('disabled');
  });
}

function disableNav() {
  ['navDashboard', 'navAnalysis', 'navVariance', 'navItems'].forEach(id => {
    document.getElementById(id)?.classList.add('disabled');
  });
}

function updateSidebarInfo() {
  const el = document.getElementById('sidebarFileInfo');
  if (!state.hasData) {
    el.innerHTML = '<p>未アップロード</p>';
    return;
  }
  let info = '';
  if (state.masterFileName) info += `<p class="truncate" title="${state.masterFileName}"><i class="fas fa-file-csv text-blue-500 mr-1"></i>${state.masterFileName}</p>`;
  if (state.detailFileName) info += `<p class="truncate" title="${state.detailFileName}"><i class="fas fa-file-csv text-green-500 mr-1"></i>${state.detailFileName}</p>`;
  el.innerHTML = info;
}

function updateStatusBadge() {
  const badge = document.getElementById('statusBadge');
  if (state.hasData) {
    badge.className = 'badge bg-green-100 text-green-700';
    badge.textContent = 'データ読込済';
  } else {
    badge.className = 'badge bg-gray-100 text-gray-500';
    badge.textContent = 'データなし';
  }
}

async function renderPage(page) {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="flex items-center justify-center h-64"><i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i></div>';
  try {
    switch (page) {
      case 'upload': renderUpload(); break;
      case 'dashboard': await renderDashboard(); break;
      case 'analysis': await renderAnalysis(); break;
      case 'variance': await renderVariance(); break;
      case 'items': await renderItems(); break;
      default: mc.innerHTML = '<p class="text-gray-500 p-8">ページが見つかりません</p>';
    }
  } catch (e) {
    console.error(e);
    mc.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700"><i class="fas fa-exclamation-triangle mr-2"></i>エラー: ${e.message}</div>`;
  }
}

// === Upload Page ===
function renderUpload() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = `
    <div class="fade-in max-w-2xl mx-auto space-y-6 pt-4">
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <i class="fas fa-file-csv text-white text-2xl"></i>
        </div>
        <h2 class="text-2xl font-bold text-gray-800">予算CSVをアップロード</h2>
        <p class="text-gray-500 text-sm mt-2">budget_master.csv と budget_detail.csv をアップロードしてください</p>
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            <i class="fas fa-database text-blue-500 mr-1.5"></i>budget_master（契約マスタ情報）
          </label>
          <div class="upload-zone rounded-xl p-6 text-center cursor-pointer" id="masterZone"
               ondragover="event.preventDefault(); this.classList.add('dragover')"
               ondragleave="this.classList.remove('dragover')"
               ondrop="handleMasterDrop(event)"
               onclick="document.getElementById('masterInput').click()">
            <input type="file" id="masterInput" accept=".csv" class="hidden" onchange="handleMasterSelect(this)">
            <div id="masterContent">
              <i class="fas fa-file-csv text-2xl text-blue-300 mb-2"></i>
              <p class="text-gray-500 text-sm">ドロップまたは<span class="text-blue-500 underline">選択</span></p>
              <p class="text-gray-300 text-[10px] mt-1">period, management_no, item_no, budget_category, ...</p>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            <i class="fas fa-table text-green-500 mr-1.5"></i>budget_detail（月別金額明細）
          </label>
          <div class="upload-zone rounded-xl p-6 text-center cursor-pointer" id="detailZone"
               ondragover="event.preventDefault(); this.classList.add('dragover')"
               ondragleave="this.classList.remove('dragover')"
               ondrop="handleDetailDrop(event)"
               onclick="document.getElementById('detailInput').click()">
            <input type="file" id="detailInput" accept=".csv" class="hidden" onchange="handleDetailSelect(this)">
            <div id="detailContent">
              <i class="fas fa-file-csv text-2xl text-green-300 mb-2"></i>
              <p class="text-gray-500 text-sm">ドロップまたは<span class="text-green-500 underline">選択</span></p>
              <p class="text-gray-300 text-[10px] mt-1">management_no, item_no, fiscal_period, target_year_month, value_type, amount</p>
            </div>
          </div>
        </div>

        <button id="uploadBtn" onclick="submitUpload()" class="btn-primary w-full justify-center py-3 text-[14px]" disabled>
          <i class="fas fa-upload mr-1"></i>アップロードして分析開始
        </button>
      </div>

      ${state.hasData ? `
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <i class="fas fa-check-circle text-green-500"></i>
            </div>
            <div>
              <p class="text-sm font-semibold text-gray-800">データ読込済</p>
              <p class="text-[11px] text-gray-400">${state.masterFileName || ''} ${state.detailFileName ? '/ ' + state.detailFileName : ''}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button onclick="navigateTo('dashboard')" class="btn-primary text-[12px]"><i class="fas fa-chart-pie mr-1"></i>ダッシュボードへ</button>
            <button onclick="clearData()" class="btn-secondary text-[12px]"><i class="fas fa-trash mr-1"></i>クリア</button>
          </div>
        </div>
      </div>` : ''}

      <div class="bg-amber-50 rounded-xl p-4 border border-amber-200">
        <h3 class="text-sm font-semibold text-amber-800 mb-2"><i class="fas fa-download mr-1.5"></i>サンプルCSVファイル</h3>
        <div class="flex flex-wrap gap-2">
          <a href="/static/sample_budget_master.csv" download class="btn-secondary text-[12px] bg-white">
            <i class="fas fa-file-csv text-blue-500"></i>budget_master.csv
          </a>
          <a href="/static/sample_budget_detail.csv" download class="btn-secondary text-[12px] bg-white">
            <i class="fas fa-file-csv text-green-500"></i>budget_detail.csv
          </a>
        </div>
        <p class="text-[11px] text-amber-700 mt-2">複数期・複数システムの計画/見通し/実績サンプルデータ</p>
      </div>

      <div class="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <h3 class="text-sm font-semibold text-blue-800 mb-2"><i class="fas fa-info-circle mr-1.5"></i>CSVフォーマット</h3>
        <div class="space-y-2">
          <div>
            <p class="text-[12px] font-medium text-blue-700">budget_master ヘッダー:</p>
            <code class="text-[10px] text-blue-600 bg-blue-100 px-2 py-1 rounded block mt-1 break-all">period, management_no, item_no, budget_category, project_name, department_name, owner_name, payee_name, contract_no, contract_amount, monthly_amount, payment_category, fixed_variable_type, system_code, system_name, expense_item_name, system_classification_name ...</code>
          </div>
          <div>
            <p class="text-[12px] font-medium text-blue-700">budget_detail ヘッダー:</p>
            <code class="text-[10px] text-blue-600 bg-blue-100 px-2 py-1 rounded block mt-1 break-all">management_no, item_no, expense_item_code, system_code, fiscal_period, target_year_month, value_type, amount</code>
          </div>
          <p class="text-[11px] text-blue-600">value_type: plan（計画）/ forecast（見通し）/ actual（実績）</p>
        </div>
      </div>

      <div class="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <h3 class="text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-shield-halved mr-1.5"></i>セキュリティ</h3>
        <ul class="text-[12px] text-gray-600 space-y-1">
          <li><i class="fas fa-check text-green-400 mr-1.5"></i>完全ローカル動作 — 外部サービスへの通信なし</li>
          <li><i class="fas fa-check text-green-400 mr-1.5"></i>データはサーバーメモリのみに保持（ディスク保存なし）</li>
          <li><i class="fas fa-check text-green-400 mr-1.5"></i>サーバー停止でデータ自動消去</li>
        </ul>
      </div>
    </div>`;
}

// File selection state
let selectedMasterFile = null;
let selectedDetailFile = null;

function handleMasterDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) setMasterFile(e.dataTransfer.files[0]);
}
function handleMasterSelect(input) { if (input.files.length > 0) setMasterFile(input.files[0]); }
function handleDetailDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) setDetailFile(e.dataTransfer.files[0]);
}
function handleDetailSelect(input) { if (input.files.length > 0) setDetailFile(input.files[0]); }

function setMasterFile(file) {
  selectedMasterFile = file;
  const el = document.getElementById('masterContent');
  el.innerHTML = `<i class="fas fa-check-circle text-blue-500 text-xl mb-1"></i><p class="text-blue-700 text-sm font-medium">${file.name}</p><p class="text-gray-400 text-[11px]">${(file.size / 1024).toFixed(1)} KB</p>`;
  updateUploadBtn();
}

function setDetailFile(file) {
  selectedDetailFile = file;
  const el = document.getElementById('detailContent');
  el.innerHTML = `<i class="fas fa-check-circle text-green-500 text-xl mb-1"></i><p class="text-green-700 text-sm font-medium">${file.name}</p><p class="text-gray-400 text-[11px]">${(file.size / 1024).toFixed(1)} KB</p>`;
  updateUploadBtn();
}

function updateUploadBtn() {
  const btn = document.getElementById('uploadBtn');
  if (btn) btn.disabled = !(selectedMasterFile || selectedDetailFile);
}

async function submitUpload() {
  const btn = document.getElementById('uploadBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>解析中...';

  const formData = new FormData();
  if (selectedMasterFile) formData.append('budget_master', selectedMasterFile);
  if (selectedDetailFile) formData.append('budget_detail', selectedDetailFile);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'アップロード失敗');

    state.hasData = true;
    state.masterFileName = data.masterFileName;
    state.detailFileName = data.detailFileName;
    selectedMasterFile = null;
    selectedDetailFile = null;

    enableNav();
    updateSidebarInfo();
    updateStatusBadge();
    showToast(`データを読み込みました（${data.itemCount}件 / ${data.systemCount}システム / ${data.periodCount}期間）`);
    navigateTo('dashboard');
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-upload mr-1"></i>アップロードして分析開始';
  }
}

async function clearData() {
  await fetch('/api/clear', { method: 'POST' });
  state.hasData = false;
  state.masterFileName = null;
  state.detailFileName = null;
  disableNav();
  updateSidebarInfo();
  updateStatusBadge();
  showToast('データをクリアしました', 'info');
  navigateTo('upload');
}

// === Dashboard ===
async function renderDashboard() {
  const mc = document.getElementById('mainContent');
  const summary = await api('/dashboard/summary');
  if (!summary.kpi) {
    mc.innerHTML = '<div class="text-center py-12 text-gray-400"><i class="fas fa-upload text-4xl mb-4"></i><p>CSVをアップロードしてください</p></div>';
    return;
  }
  const k = summary.kpi;
  const sortedYMs = summary.sortedYMs || [];

  mc.innerHTML = `
    <div class="fade-in space-y-5">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-gauge-high mr-2 text-blue-600"></i>ダッシュボード</h2>
        <div class="flex items-center gap-2 text-[11px] text-gray-400">
          ${summary.masterFileName ? `<span><i class="fas fa-file-csv text-blue-400 mr-1"></i>${summary.masterFileName}</span>` : ''}
          ${summary.detailFileName ? `<span><i class="fas fa-file-csv text-green-400 mr-1"></i>${summary.detailFileName}</span>` : ''}
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-gray-500">計画（Plan）</span>
            <div class="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center"><i class="fas fa-bullseye text-blue-500 text-xs"></i></div>
          </div>
          <p class="text-xl font-bold text-gray-800">${fmt(k.totalPlan)}</p>
          <p class="text-[10px] text-gray-400 mt-1">円 / ${k.itemCount}費目 / ${k.periodCount}期</p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-gray-500">見通し（Forecast）</span>
            <div class="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center"><i class="fas fa-chart-line text-amber-500 text-xs"></i></div>
          </div>
          <p class="text-xl font-bold text-gray-800">${fmt(k.totalForecast)}</p>
          <p class="text-[10px] ${k.varianceForecastPct > 0 ? 'text-red-500' : 'text-green-500'} mt-1 font-medium">
            対計画 ${pct(k.varianceForecastPct)}
          </p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-gray-500">実績（Actual）</span>
            <div class="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center"><i class="fas fa-coins text-green-500 text-xs"></i></div>
          </div>
          <p class="text-xl font-bold text-gray-800">${fmt(k.totalActual)}</p>
          <p class="text-[10px] ${k.varianceActualPct > 0 ? 'text-red-500' : 'text-green-500'} mt-1 font-medium">
            対計画 ${pct(k.varianceActualPct)}
          </p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-gray-500">分類</span>
            <div class="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center"><i class="fas fa-tags text-purple-500 text-xs"></i></div>
          </div>
          <p class="text-xl font-bold text-gray-800">${k.systemCount}</p>
          <p class="text-[10px] text-gray-400 mt-1">システム / ${k.classificationCount}分類 / ${k.departmentCount}部門</p>
        </div>
      </div>

      <!-- Charts Row 1: Monthly Time-series -->
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-chart-line mr-1.5 text-blue-500"></i>月別推移（計画 vs 見通し vs 実績）</h3>
        <div style="height:320px"><canvas id="monthlyTrendChart"></canvas></div>
      </div>

      <!-- Charts Row 2 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-server mr-1.5 text-green-500"></i>システム別 計画/見通し/実績</h3>
          <div style="height:320px"><canvas id="systemCompareChart"></canvas></div>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-chart-pie mr-1.5 text-purple-500"></i>システム分類別構成（計画）</h3>
          <div style="height:320px"><canvas id="classificationPieChart"></canvas></div>
        </div>
      </div>

      <!-- Charts Row 3 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-chart-area mr-1.5 text-teal-500"></i>累積推移</h3>
          <div style="height:300px"><canvas id="cumulativeChart"></canvas></div>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-building mr-1.5 text-indigo-500"></i>部門別内訳</h3>
          <div style="height:300px"><canvas id="departmentChart"></canvas></div>
        </div>
      </div>

      <!-- Charts Row 4: Period and Fixed/Variable -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-calendar-alt mr-1.5 text-orange-500"></i>期別予算推移</h3>
          <div style="height:300px"><canvas id="periodChart"></canvas></div>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-lock mr-1.5 text-cyan-500"></i>固定費/変動費構成</h3>
          <div style="height:300px"><canvas id="fixedVariableChart"></canvas></div>
        </div>
      </div>

      <!-- Overrun Alerts -->
      ${summary.overrunItems && summary.overrunItems.length > 0 ? `
      <div class="bg-white rounded-xl border border-red-100 p-4">
        <h3 class="text-sm font-semibold text-red-700 mb-3"><i class="fas fa-triangle-exclamation mr-1.5 text-red-500"></i>予算超過アラート</h3>
        <div class="overflow-auto">
          <table class="data-table">
            <thead><tr><th>管理番号</th><th>システム</th><th>案件名</th><th>費目</th><th class="num">計画</th><th class="num">見通し</th><th class="num">実績</th><th class="num">見通し差異</th><th class="num">実績差異</th></tr></thead>
            <tbody>
              ${summary.overrunItems.map(v => `
                <tr>
                  <td class="font-medium text-[11px]">${v.management_no}</td>
                  <td>${v.system_name}</td>
                  <td class="text-[11px]">${v.project_name || '-'}</td>
                  <td class="text-[11px]">${v.expense_item_name || '-'}</td>
                  <td class="num">${fmt(v.plan)}</td>
                  <td class="num">${fmt(v.forecast)}</td>
                  <td class="num">${fmt(v.actual)}</td>
                  <td class="num ${varianceClass(v.variance_forecast)}">${varianceIcon(v.variance_forecast)} ${pct(v.variance_forecast)}</td>
                  <td class="num ${varianceClass(v.variance_actual)}">${varianceIcon(v.variance_actual)} ${pct(v.variance_actual)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}
    </div>`;

  // --- Chart: Monthly Trend ---
  const mbt = summary.monthlyByType;
  if (mbt && sortedYMs.length > 0) {
    state.charts.monthlyTrend = new Chart(document.getElementById('monthlyTrendChart'), {
      type: 'line',
      data: {
        labels: sortedYMs.map(ym => fmtYM(ym)),
        datasets: [
          { label: '計画', data: sortedYMs.map(ym => mbt[ym] ? mbt[ym].plan : 0), borderColor: COLORS.plan, backgroundColor: COLORS.planBg, borderWidth: 2.5, fill: false, pointRadius: 3, tension: 0.3 },
          { label: '見通し', data: sortedYMs.map(ym => mbt[ym] ? mbt[ym].forecast : 0), borderColor: COLORS.forecast, backgroundColor: COLORS.forecastBg, borderWidth: 2.5, borderDash: [6,3], fill: false, pointRadius: 3, tension: 0.3 },
          { label: '実績', data: sortedYMs.map(ym => mbt[ym] ? mbt[ym].actual : 0), borderColor: COLORS.actual, backgroundColor: COLORS.actualBg, borderWidth: 2.5, fill: true, pointRadius: 4, pointBackgroundColor: COLORS.actual, tension: 0.3 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => fmt(v) } },
          x: { ticks: { maxRotation: 45, font: { size: 10 } } }
        },
        plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)} 円` } } }
      }
    });
  }

  // --- Chart: System Compare ---
  const sData = (summary.bySystem || []).slice(0, 10);
  if (sData.length > 0) {
    state.charts.systemCompare = new Chart(document.getElementById('systemCompareChart'), {
      type: 'bar',
      data: {
        labels: sData.map(s => s.name.length > 10 ? s.name.substring(0, 10) + '..' : s.name),
        datasets: [
          { label: '計画', data: sData.map(s => s.plan), backgroundColor: COLORS.plan + '90', borderRadius: 3 },
          { label: '見通し', data: sData.map(s => s.forecast), backgroundColor: COLORS.forecast + '90', borderRadius: 3 },
          { label: '実績', data: sData.map(s => s.actual), backgroundColor: COLORS.actual + '90', borderRadius: 3 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        scales: { x: { ticks: { callback: v => fmt(v) } } },
        plugins: { legend: { position: 'top', labels: { usePointStyle: true, font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)} 円` } } }
      }
    });
  }

  // --- Chart: Classification Pie ---
  const cData = (summary.byClassification || []).slice(0, 10);
  if (cData.length > 0) {
    state.charts.classificationPie = new Chart(document.getElementById('classificationPieChart'), {
      type: 'doughnut',
      data: {
        labels: cData.map(c => c.name),
        datasets: [{ data: cData.map(c => c.plan), backgroundColor: PIE_COLORS }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12, padding: 8 } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.raw)} 円` } }
        }
      }
    });
  }

  // --- Chart: Cumulative ---
  if (mbt && sortedYMs.length > 0) {
    let cumPlan = 0, cumForecast = 0, cumActual = 0;
    const cumPlanArr = [], cumForecastArr = [], cumActualArr = [];
    sortedYMs.forEach(ym => {
      cumPlan += mbt[ym] ? mbt[ym].plan : 0; cumPlanArr.push(cumPlan);
      cumForecast += mbt[ym] ? mbt[ym].forecast : 0; cumForecastArr.push(cumForecast);
      cumActual += mbt[ym] ? mbt[ym].actual : 0; cumActualArr.push(cumActual);
    });
    state.charts.cumulative = new Chart(document.getElementById('cumulativeChart'), {
      type: 'line',
      data: {
        labels: sortedYMs.map(ym => fmtYM(ym)),
        datasets: [
          { label: '計画累計', data: cumPlanArr, borderColor: COLORS.plan, borderWidth: 2, fill: false, pointRadius: 2, tension: 0.3 },
          { label: '見通し累計', data: cumForecastArr, borderColor: COLORS.forecast, borderWidth: 2, borderDash: [5,3], fill: false, pointRadius: 2, tension: 0.3 },
          { label: '実績累計', data: cumActualArr, borderColor: COLORS.actual, backgroundColor: COLORS.actualBg, borderWidth: 2.5, fill: true, pointRadius: 3, tension: 0.3 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { ticks: { callback: v => fmt(v) } },
          x: { ticks: { maxRotation: 45, font: { size: 9 } } }
        },
        plugins: { legend: { position: 'top', labels: { usePointStyle: true, font: { size: 10 } } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)} 円` } } }
      }
    });
  }

  // --- Chart: Department ---
  const dData = (summary.byDepartment || []);
  if (dData.length > 0) {
    state.charts.department = new Chart(document.getElementById('departmentChart'), {
      type: 'bar',
      data: {
        labels: dData.map(d => d.name),
        datasets: [
          { label: '計画', data: dData.map(d => d.plan), backgroundColor: COLORS.plan + '80', borderRadius: 3 },
          { label: '見通し', data: dData.map(d => d.forecast), backgroundColor: COLORS.forecast + '80', borderRadius: 3 },
          { label: '実績', data: dData.map(d => d.actual), backgroundColor: COLORS.actual + '80', borderRadius: 3 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { ticks: { callback: v => fmt(v) } } },
        plugins: { legend: { position: 'top', labels: { usePointStyle: true, font: { size: 10 } } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)} 円` } } }
      }
    });
  }

  // --- Chart: Period ---
  const pData = (summary.byPeriod || []);
  if (pData.length > 0) {
    state.charts.period = new Chart(document.getElementById('periodChart'), {
      type: 'bar',
      data: {
        labels: pData.map(d => d.label || `第${d.period}期`),
        datasets: [
          { label: '計画', data: pData.map(d => d.plan), backgroundColor: COLORS.plan + '80', borderRadius: 3 },
          { label: '見通し', data: pData.map(d => d.forecast), backgroundColor: COLORS.forecast + '80', borderRadius: 3 },
          { label: '実績', data: pData.map(d => d.actual), backgroundColor: COLORS.actual + '80', borderRadius: 3 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { ticks: { callback: v => fmt(v) } }, x: { ticks: { font: { size: 10 } } } },
        plugins: { legend: { position: 'top', labels: { usePointStyle: true, font: { size: 10 } } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)} 円` } } }
      }
    });
  }

  // --- Chart: Fixed/Variable ---
  const fvData = (summary.byFixedVariable || []);
  if (fvData.length > 0) {
    state.charts.fixedVariable = new Chart(document.getElementById('fixedVariableChart'), {
      type: 'doughnut',
      data: {
        labels: fvData.map(d => d.name),
        datasets: [{ data: fvData.map(d => d.plan), backgroundColor: PIE_COLORS.slice(3) }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.raw)} 円 (${((ctx.raw / fvData.reduce((s,d)=>s+d.plan,0))*100).toFixed(1)}%)` } }
        }
      }
    });
  }
}

// === Analysis Page ===
async function renderAnalysis() {
  const mc = document.getElementById('mainContent');

  mc.innerHTML = `
    <div class="fade-in space-y-4">
      <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-chart-column mr-2 text-blue-600"></i>分析・比較</h2>

      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <div class="flex flex-wrap gap-1 mb-4">
          <button onclick="loadAnalysisTab('system')" id="anaTabSystem" class="tab-btn active">システム別</button>
          <button onclick="loadAnalysisTab('classification')" id="anaTabClassification" class="tab-btn">分類別</button>
          <button onclick="loadAnalysisTab('department')" id="anaTabDepartment" class="tab-btn">部門別</button>
          <button onclick="loadAnalysisTab('period')" id="anaTabPeriod" class="tab-btn">期別</button>
          <button onclick="loadAnalysisTab('expenseItem')" id="anaTabExpenseItem" class="tab-btn">費目別</button>
          <button onclick="loadAnalysisTab('cross')" id="anaTabCross" class="tab-btn">クロス集計</button>
          <button onclick="loadAnalysisTab('systemDetail')" id="anaTabSystemDetail" class="tab-btn">システム詳細</button>
        </div>
        <div id="analysisTableContent"><p class="text-gray-400 text-sm p-4">読み込み中...</p></div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3" id="analysisChartTitle">比較チャート</h3>
          <div style="height:320px"><canvas id="analysisChart"></canvas></div>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3" id="analysisPieTitle">構成比チャート</h3>
          <div style="height:320px"><canvas id="analysisPieChart"></canvas></div>
        </div>
      </div>
    </div>`;

  await loadAnalysisTab('system');
}

async function loadAnalysisTab(tab) {
  document.querySelectorAll('[id^="anaTab"]').forEach(b => b.classList.remove('active'));
  const capTab = tab.charAt(0).toUpperCase() + tab.slice(1);
  const tabEl = document.getElementById('anaTab' + capTab);
  if (tabEl) tabEl.classList.add('active');

  const container = document.getElementById('analysisTableContent');
  container.innerHTML = '<p class="text-gray-400 text-sm p-4"><i class="fas fa-spinner fa-spin mr-2"></i>読み込み中...</p>';

  if (tab === 'cross') { await renderCrossTab(container); return; }
  if (tab === 'systemDetail') { await renderSystemDetailTab(container); return; }

  const endpoints = {
    system: '/analysis/by-system',
    classification: '/analysis/by-classification',
    department: '/analysis/by-department',
    period: '/analysis/by-period',
    expenseItem: '/analysis/by-expense-item',
  };
  const labels = {
    system: 'システム別',
    classification: '分類別',
    department: '部門別',
    period: '期別',
    expenseItem: '費目別',
  };

  const endpoint = endpoints[tab];
  const result = await api(endpoint);
  const data = result.data || [];

  if (data.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm text-center p-8">データがありません</p>';
    return;
  }

  const totalPlan = data.reduce((s, d) => s + d.plan, 0);
  const nameField = tab === 'period' ? 'label' : 'name';

  let html = '<div class="overflow-auto"><table class="data-table"><thead><tr><th>名称</th><th class="num">計画</th><th class="num">見通し</th><th class="num">実績</th><th class="num">見通し差異</th><th class="num">実績差異</th><th class="num">構成比</th><th>バー</th></tr></thead><tbody>';

  data.forEach((d, i) => {
    const dispName = d[nameField] || d.name || d.period || '';
    const pctPlan = totalPlan > 0 ? (d.plan / totalPlan * 100) : 0;
    const varF = d.plan > 0 ? ((d.forecast - d.plan) / d.plan * 100) : 0;
    const varA = d.plan > 0 ? ((d.actual - d.plan) / d.plan * 100) : 0;
    html += `<tr>
      <td class="font-medium"><span class="inline-block w-3 h-3 rounded-sm mr-2" style="background:${PIE_COLORS[i % PIE_COLORS.length]}"></span>${dispName}</td>
      <td class="num">${fmt(d.plan)}</td>
      <td class="num">${fmt(d.forecast)}</td>
      <td class="num">${fmt(d.actual)}</td>
      <td class="num ${varianceClass(varF)}">${varianceIcon(varF)} ${pct(varF)}</td>
      <td class="num ${varianceClass(varA)}">${varianceIcon(varA)} ${pct(varA)}</td>
      <td class="num">${pctPlan.toFixed(1)}%</td>
      <td><div class="w-full bg-gray-100 rounded-full h-2"><div class="h-2 rounded-full" style="width:${Math.min(pctPlan, 100)}%;background:${PIE_COLORS[i % PIE_COLORS.length]}"></div></div></td>
    </tr>`;
  });

  const totalForecast = data.reduce((s, d) => s + d.forecast, 0);
  const totalActual = data.reduce((s, d) => s + d.actual, 0);
  html += `<tr class="font-bold" style="background:#f8fafc"><td>合計</td><td class="num">${fmt(totalPlan)}</td><td class="num">${fmt(totalForecast)}</td><td class="num">${fmt(totalActual)}</td><td></td><td></td><td class="num">100%</td><td></td></tr>`;
  html += '</tbody></table></div>';
  container.innerHTML = html;

  // Charts
  document.getElementById('analysisChartTitle').textContent = labels[tab] + ' 比較';
  document.getElementById('analysisPieTitle').textContent = labels[tab] + ' 構成比（計画）';

  const chartLabels = data.map(d => {
    const n = d[nameField] || d.name || d.period || '';
    return n.length > 12 ? n.substring(0, 12) + '..' : n;
  });

  if (state.charts.analysis) state.charts.analysis.destroy();
  state.charts.analysis = new Chart(document.getElementById('analysisChart'), {
    type: 'bar',
    data: {
      labels: chartLabels,
      datasets: [
        { label: '計画', data: data.map(d => d.plan), backgroundColor: COLORS.plan + '80', borderRadius: 3 },
        { label: '見通し', data: data.map(d => d.forecast), backgroundColor: COLORS.forecast + '80', borderRadius: 3 },
        { label: '実績', data: data.map(d => d.actual), backgroundColor: COLORS.actual + '80', borderRadius: 3 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: data.length > 5 ? 'y' : 'x',
      scales: {
        [data.length > 5 ? 'x' : 'y']: { ticks: { callback: v => fmt(v) } }
      },
      plugins: { legend: { position: 'top', labels: { usePointStyle: true, font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)} 円` } } }
    }
  });

  if (state.charts.analysisPie) state.charts.analysisPie.destroy();
  state.charts.analysisPie = new Chart(document.getElementById('analysisPieChart'), {
    type: 'doughnut',
    data: {
      labels: data.slice(0, 10).map(d => d[nameField] || d.name || d.period || ''),
      datasets: [{ data: data.slice(0, 10).map(d => d.plan), backgroundColor: PIE_COLORS }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.raw)} 円` } }
      }
    }
  });
}

async function renderCrossTab(container) {
  const result = await api('/analysis/cross-tab');
  const { data, systems, periods } = result;

  if (systems.length === 0 || periods.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm text-center p-8">クロス集計データがありません</p>';
    return;
  }

  let html = '<div class="overflow-auto"><table class="data-table"><thead><tr><th>システム \\ 期</th>';
  periods.forEach(p => { html += `<th class="num">第${p}期</th>`; });
  html += '<th class="num" style="background:#e0e7ff;font-weight:700">合計</th></tr></thead><tbody>';

  const colTotals = {};
  periods.forEach(p => { colTotals[p] = 0; });
  let grandTotal = 0;

  systems.forEach(sys => {
    html += `<tr><td class="font-medium">${sys}</td>`;
    let rowTotal = 0;
    periods.forEach(p => {
      const val = (data[sys] && data[sys][p]) ? data[sys][p].plan : 0;
      rowTotal += val;
      colTotals[p] += val;
      html += `<td class="num ${val > 0 ? '' : 'text-gray-300'}">${val > 0 ? fmt(val) : '-'}</td>`;
    });
    grandTotal += rowTotal;
    html += `<td class="num font-semibold" style="background:#eff6ff">${fmt(rowTotal)}</td></tr>`;
  });

  html += '<tr style="background:#f8fafc;font-weight:700"><td>合計</td>';
  periods.forEach(p => { html += `<td class="num">${fmt(colTotals[p])}</td>`; });
  html += `<td class="num" style="background:#dbeafe">${fmt(grandTotal)}</td></tr>`;
  html += '</tbody></table></div>';
  container.innerHTML = html;

  document.getElementById('analysisChartTitle').textContent = 'クロス集計（計画・積み上げ）';
  if (state.charts.analysis) state.charts.analysis.destroy();
  const datasets = periods.map((p, i) => ({
    label: `第${p}期`,
    data: systems.map(sys => (data[sys] && data[sys][p]) ? data[sys][p].plan : 0),
    backgroundColor: PIE_COLORS[i % PIE_COLORS.length] + '80',
    borderColor: PIE_COLORS[i % PIE_COLORS.length],
    borderWidth: 1,
  }));
  state.charts.analysis = new Chart(document.getElementById('analysisChart'), {
    type: 'bar',
    data: { labels: systems.map(s => s.length > 8 ? s.substring(0, 8) + '..' : s), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: v => fmt(v) } } },
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)} 円` } } }
    }
  });
}

async function renderSystemDetailTab(container) {
  const statusData = await api('/status');
  const systems = statusData.systems || [];

  if (systems.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm text-center p-8">システムデータがありません</p>';
    return;
  }

  container.innerHTML = `
    <div class="mb-4">
      <label class="text-[12px] text-gray-500 mr-2">システム選択:</label>
      <select id="systemDetailSelect" onchange="loadSystemDetail()" class="border rounded-md px-3 py-1.5 text-[13px]">
        ${systems.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>
    <div id="systemDetailBody">読み込み中...</div>
  `;
  await loadSystemDetail();
}

async function loadSystemDetail() {
  const system = document.getElementById('systemDetailSelect')?.value;
  if (!system) return;
  const body = document.getElementById('systemDetailBody');
  body.innerHTML = '<p class="text-gray-400 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>読み込み中...</p>';

  const result = await api('/analysis/system-detail?system=' + encodeURIComponent(system));
  if (!result.data) { body.innerHTML = '<p class="text-gray-400">データなし</p>'; return; }

  const d = result.data;
  const varF = d.totalPlan > 0 ? ((d.totalForecast - d.totalPlan) / d.totalPlan * 100) : 0;
  const varA = d.totalPlan > 0 ? ((d.totalActual - d.totalPlan) / d.totalPlan * 100) : 0;

  let html = `
    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="bg-blue-50 rounded-lg p-3"><p class="text-[10px] text-blue-500">計画</p><p class="text-lg font-bold text-blue-700">${fmt(d.totalPlan)}</p></div>
      <div class="bg-amber-50 rounded-lg p-3"><p class="text-[10px] text-amber-500">見通し <span class="${varianceClass(varF)}">${pct(varF)}</span></p><p class="text-lg font-bold text-amber-700">${fmt(d.totalForecast)}</p></div>
      <div class="bg-green-50 rounded-lg p-3"><p class="text-[10px] text-green-500">実績 <span class="${varianceClass(varA)}">${pct(varA)}</span></p><p class="text-lg font-bold text-green-700">${fmt(d.totalActual)}</p></div>
    </div>
  `;

  // By period table
  if (d.byPeriod && d.byPeriod.length > 0) {
    html += '<h4 class="text-[12px] font-semibold text-gray-700 mb-2">期別内訳</h4>';
    html += '<div class="overflow-auto mb-4"><table class="data-table"><thead><tr><th>期</th><th class="num">計画</th><th class="num">見通し</th><th class="num">実績</th><th class="num">差異</th></tr></thead><tbody>';
    (d.byPeriod || []).forEach(p => {
      const v = p.plan > 0 ? ((p.actual - p.plan) / p.plan * 100) : 0;
      html += `<tr><td class="font-medium">${p.label || '第'+p.period+'期'}</td><td class="num">${fmt(p.plan)}</td><td class="num">${fmt(p.forecast)}</td><td class="num">${fmt(p.actual)}</td><td class="num ${varianceClass(v)}">${varianceIcon(v)} ${pct(v)}</td></tr>`;
    });
    html += '</tbody></table></div>';
  }

  // Items table
  if (d.items && d.items.length > 0) {
    html += '<h4 class="text-[12px] font-semibold text-gray-700 mb-2">費目一覧</h4>';
    html += '<div class="overflow-auto"><table class="data-table"><thead><tr><th>管理番号</th><th>案件名</th><th>期</th><th class="num">計画</th><th class="num">見通し</th><th class="num">実績</th><th class="num">差異</th></tr></thead><tbody>';
    d.items.forEach(item => {
      const v = item.totalPlan > 0 ? ((item.totalActual - item.totalPlan) / item.totalPlan * 100) : 0;
      html += `<tr><td class="text-[11px]">${item.management_no}</td><td class="text-[11px]">${item.project_name || '-'}</td><td class="text-[11px]">${item.fiscal_period_label || ''}</td><td class="num">${fmt(item.totalPlan)}</td><td class="num">${fmt(item.totalForecast)}</td><td class="num">${fmt(item.totalActual)}</td><td class="num ${varianceClass(v)}">${varianceIcon(v)} ${pct(v)}</td></tr>`;
    });
    html += '</tbody></table></div>';
  }

  body.innerHTML = html;

  // Monthly trend chart for this system
  document.getElementById('analysisChartTitle').textContent = `${system} 月別推移`;
  if (state.charts.analysis) state.charts.analysis.destroy();
  const mbt = d.monthlyByType;
  const sysYMs = d.sortedYMs || [];
  if (sysYMs.length > 0) {
    state.charts.analysis = new Chart(document.getElementById('analysisChart'), {
      type: 'line',
      data: {
        labels: sysYMs.map(ym => fmtYM(ym)),
        datasets: [
          { label: '計画', data: sysYMs.map(ym => mbt[ym] ? mbt[ym].plan : 0), borderColor: COLORS.plan, borderWidth: 2, fill: false, pointRadius: 3, tension: 0.3 },
          { label: '見通し', data: sysYMs.map(ym => mbt[ym] ? mbt[ym].forecast : 0), borderColor: COLORS.forecast, borderWidth: 2, borderDash: [5,3], fill: false, pointRadius: 3, tension: 0.3 },
          { label: '実績', data: sysYMs.map(ym => mbt[ym] ? mbt[ym].actual : 0), borderColor: COLORS.actual, backgroundColor: COLORS.actualBg, borderWidth: 2.5, fill: true, pointRadius: 4, tension: 0.3 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => fmt(v) } },
          x: { ticks: { maxRotation: 45, font: { size: 10 } } }
        },
        plugins: { legend: { position: 'top', labels: { usePointStyle: true, font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)} 円` } } }
      }
    });
  }
}

// === Variance Page ===
async function renderVariance() {
  const mc = document.getElementById('mainContent');
  const result = await api('/analysis/variances');
  const data = result.data || [];

  if (data.length === 0) {
    mc.innerHTML = '<div class="text-center py-12 text-gray-400"><p>差異データがありません</p></div>';
    return;
  }

  const overruns = data.filter(d => d.overrun_actual || d.overrun_forecast);
  const underruns = data.filter(d => d.variance_actual < -2);

  mc.innerHTML = `
    <div class="fade-in space-y-5">
      <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-triangle-exclamation mr-2 text-red-500"></i>予算差異分析</h2>

      <!-- Summary Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
          <p class="text-[11px] text-gray-500 mb-1">全費目数</p>
          <p class="text-2xl font-bold text-gray-800">${data.length}</p>
        </div>
        <div class="bg-red-50 rounded-xl p-4 border border-red-100 card-hover">
          <p class="text-[11px] text-red-500 mb-1"><i class="fas fa-arrow-up mr-1"></i>超過項目</p>
          <p class="text-2xl font-bold text-red-700">${overruns.length}</p>
        </div>
        <div class="bg-green-50 rounded-xl p-4 border border-green-100 card-hover">
          <p class="text-[11px] text-green-500 mb-1"><i class="fas fa-arrow-down mr-1"></i>節約項目</p>
          <p class="text-2xl font-bold text-green-700">${underruns.length}</p>
        </div>
        <div class="bg-blue-50 rounded-xl p-4 border border-blue-100 card-hover">
          <p class="text-[11px] text-blue-500 mb-1">予算内項目</p>
          <p class="text-2xl font-bold text-blue-700">${data.length - overruns.length - underruns.length}</p>
        </div>
      </div>

      <!-- Variance Chart -->
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-chart-bar mr-1.5 text-red-500"></i>実績差異率（対計画）</h3>
        <div style="height:350px"><canvas id="varianceChart"></canvas></div>
      </div>

      <!-- Overrun Table -->
      ${overruns.length > 0 ? `
      <div class="bg-white rounded-xl border border-red-100 p-4">
        <h3 class="text-sm font-semibold text-red-700 mb-3"><i class="fas fa-exclamation-circle mr-1.5"></i>予算超過一覧（${overruns.length}件）</h3>
        <div class="overflow-auto">
          <table class="data-table">
            <thead><tr><th>管理番号</th><th>システム</th><th>案件名</th><th>部門</th><th class="num">計画</th><th class="num">見通し</th><th class="num">実績</th><th class="num">超過額</th><th class="num">超過率</th></tr></thead>
            <tbody>
              ${overruns.map(v => {
                const overAmt = v.actual - v.plan;
                return `<tr>
                  <td class="font-medium text-[11px]">${v.management_no}</td>
                  <td>${v.system_name}</td>
                  <td class="text-[11px]">${v.project_name || '-'}</td>
                  <td class="text-[11px]">${v.department_name || '-'}</td>
                  <td class="num">${fmt(v.plan)}</td>
                  <td class="num">${fmt(v.forecast)}</td>
                  <td class="num font-semibold">${fmt(v.actual)}</td>
                  <td class="num overrun">${fmtMoney(overAmt)}</td>
                  <td class="num overrun">${pct(v.variance_actual)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>` : '<div class="bg-green-50 rounded-xl p-4 border border-green-200 text-green-700"><i class="fas fa-check-circle mr-2"></i>予算超過項目はありません</div>'}

      <!-- Full Variance Table -->
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-list mr-1.5 text-gray-500"></i>全費目差異一覧</h3>
        <div class="overflow-auto max-h-[50vh]">
          <table class="data-table">
            <thead><tr><th>管理番号</th><th>システム</th><th>期</th><th>案件名</th><th class="num">計画</th><th class="num">見通し</th><th class="num">実績</th><th class="num">見通し差異</th><th class="num">実績差異</th><th>ステータス</th></tr></thead>
            <tbody>
              ${data.map(v => {
                let statusBadge = '<span class="badge bg-gray-100 text-gray-500">予算内</span>';
                if (v.overrun_actual) statusBadge = '<span class="badge bg-red-100 text-red-700">超過</span>';
                else if (v.variance_actual < -2) statusBadge = '<span class="badge bg-green-100 text-green-700">節約</span>';
                return `<tr>
                  <td class="font-medium text-[11px]">${v.management_no}</td>
                  <td>${v.system_name}</td>
                  <td class="text-[11px]">${v.fiscal_period_label || ''}</td>
                  <td class="text-[11px]">${v.project_name || '-'}</td>
                  <td class="num">${fmt(v.plan)}</td>
                  <td class="num">${fmt(v.forecast)}</td>
                  <td class="num">${fmt(v.actual)}</td>
                  <td class="num ${varianceClass(v.variance_forecast)}">${pct(v.variance_forecast)}</td>
                  <td class="num ${varianceClass(v.variance_actual)}">${pct(v.variance_actual)}</td>
                  <td>${statusBadge}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  // Variance chart
  const chartData = data.filter(d => d.totalPlan > 0 || d.variance_actual !== 0).slice(0, 20);
  if (chartData.length > 0) {
    state.charts.variance = new Chart(document.getElementById('varianceChart'), {
      type: 'bar',
      data: {
        labels: chartData.map(d => `${d.system_name.substring(0, 6)}/${d.management_no.substring(0, 8)}`),
        datasets: [{
          label: '実績差異率(%)',
          data: chartData.map(d => d.variance_actual),
          backgroundColor: chartData.map(d => d.variance_actual > 0 ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)'),
          borderColor: chartData.map(d => d.variance_actual > 0 ? '#ef4444' : '#22c55e'),
          borderWidth: 1,
          borderRadius: 3,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { ticks: { callback: v => v + '%' } },
          x: { ticks: { font: { size: 9 }, maxRotation: 45 } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `差異: ${ctx.raw > 0 ? '+' : ''}${ctx.raw.toFixed(1)}%` } }
        }
      }
    });
  }
}

// === Items Page ===
async function renderItems() {
  const mc = document.getElementById('mainContent');
  const statusData = await api('/status');
  const systems = statusData.systems || [];
  const classifications = statusData.classifications || [];
  const departments = statusData.departments || [];
  const periods = statusData.periods || [];

  mc.innerHTML = `
    <div class="fade-in space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-list-ol mr-2 text-blue-600"></i>明細一覧</h2>
        <button onclick="exportItemsCSV()" class="btn-secondary text-[12px]"><i class="fas fa-download mr-1"></i>CSV出力</button>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <div class="flex items-center gap-1.5">
            <label class="text-[12px] text-gray-500">システム:</label>
            <select id="filterSystem" onchange="loadItems()" class="border rounded-md px-2 py-1 text-[12px]">
              <option value="">全て</option>${systems.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="flex items-center gap-1.5">
            <label class="text-[12px] text-gray-500">分類:</label>
            <select id="filterClassification" onchange="loadItems()" class="border rounded-md px-2 py-1 text-[12px]">
              <option value="">全て</option>${classifications.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="flex items-center gap-1.5">
            <label class="text-[12px] text-gray-500">部門:</label>
            <select id="filterDepartment" onchange="loadItems()" class="border rounded-md px-2 py-1 text-[12px]">
              <option value="">全て</option>${departments.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
          </div>
          <div class="flex items-center gap-1.5">
            <label class="text-[12px] text-gray-500">期:</label>
            <select id="filterPeriod" onchange="loadItems()" class="border rounded-md px-2 py-1 text-[12px]">
              <option value="">全て</option>${periods.map(p => `<option value="${p}">第${p}期</option>`).join('')}
            </select>
          </div>
          <div class="flex items-center gap-1.5">
            <label class="text-[12px] text-gray-500">検索:</label>
            <input id="filterSearch" oninput="debounceLoadItems()" class="border rounded-md px-2 py-1 text-[12px] w-40" placeholder="キーワード...">
          </div>
          <span id="itemCount" class="text-[11px] text-gray-400 ml-auto"></span>
        </div>
        <div id="itemsContent" class="overflow-auto max-h-[70vh]">
          <p class="text-gray-400 text-sm p-4">読み込み中...</p>
        </div>
      </div>
    </div>`;

  await loadItems();
}

let _debounceTimer = null;
function debounceLoadItems() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(loadItems, 300);
}

async function loadItems() {
  const container = document.getElementById('itemsContent');
  const system = document.getElementById('filterSystem')?.value || '';
  const classification = document.getElementById('filterClassification')?.value || '';
  const department = document.getElementById('filterDepartment')?.value || '';
  const period = document.getElementById('filterPeriod')?.value || '';
  const search = document.getElementById('filterSearch')?.value || '';

  let url = '/items?';
  if (system) url += 'system=' + encodeURIComponent(system) + '&';
  if (classification) url += 'classification=' + encodeURIComponent(classification) + '&';
  if (department) url += 'department=' + encodeURIComponent(department) + '&';
  if (period) url += 'period=' + encodeURIComponent(period) + '&';
  if (search) url += 'search=' + encodeURIComponent(search) + '&';

  const result = await api(url);
  const items = result.items || [];
  const sortedYMs = result.sortedYMs || [];
  document.getElementById('itemCount').textContent = `${items.length} 費目`;

  if (items.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm text-center p-8">該当するデータがありません</p>';
    return;
  }

  // Determine relevant year_months for display (limit to avoid overflow)
  const displayYMs = sortedYMs.slice(0, 24); // max 24 months

  let html = '<table class="data-table" id="itemsTable"><thead><tr>';
  html += '<th>管理番号</th><th>システム</th><th>期</th><th>案件名</th><th>部門</th>';
  displayYMs.forEach(ym => html += `<th class="num text-[10px]">${fmtYM(ym)}</th>`);
  html += '<th class="num" style="background:#dbeafe">計画計</th><th class="num" style="background:#fef3c7">見通し計</th><th class="num" style="background:#dcfce7">実績計</th><th class="num">差異</th>';
  html += '</tr></thead><tbody>';

  const displayItems = items.slice(0, 200);
  displayItems.forEach(item => {
    const var_a = item.totalPlan > 0 ? ((item.totalActual - item.totalPlan) / item.totalPlan * 100) : 0;
    html += '<tr>';
    html += `<td class="font-medium text-[10px]">${item.management_no}/${item.item_no}</td>`;
    html += `<td class="text-[10px]">${item.system_name}</td>`;
    html += `<td class="text-[10px]">${item.fiscal_period || ''}</td>`;
    html += `<td class="text-[10px]">${item.project_name || '-'}</td>`;
    html += `<td class="text-[10px] text-gray-400">${item.department_name || '-'}</td>`;
    displayYMs.forEach(ym => {
      const m = item.monthly[ym];
      const plan = m ? m.plan : 0;
      const actual = m ? m.actual : 0;
      const isOver = actual > plan && plan > 0;
      const displayVal = actual || plan;
      html += `<td class="num text-[10px] ${isOver ? 'overrun' : ''}" title="計画:${fmt(plan)} 実績:${fmt(actual)}">${displayVal > 0 ? fmt(displayVal) : ''}</td>`;
    });
    html += `<td class="num font-semibold text-[10px]" style="background:#eff6ff">${fmt(item.totalPlan)}</td>`;
    html += `<td class="num font-semibold text-[10px]" style="background:#fefce8">${fmt(item.totalForecast)}</td>`;
    html += `<td class="num font-semibold text-[10px]" style="background:#f0fdf4">${fmt(item.totalActual)}</td>`;
    html += `<td class="num text-[10px] ${varianceClass(var_a)}">${pct(var_a)}</td>`;
    html += '</tr>';
  });

  // Totals row
  html += '<tr style="background:#f8fafc;font-weight:700"><td colspan="5">合計</td>';
  displayYMs.forEach(ym => {
    const total = displayItems.reduce((s, i) => {
      const m = i.monthly[ym];
      return s + (m ? (m.actual || m.plan) : 0);
    }, 0);
    html += `<td class="num">${total > 0 ? fmt(total) : ''}</td>`;
  });
  const totalPlan = displayItems.reduce((s, i) => s + i.totalPlan, 0);
  const totalForecast = displayItems.reduce((s, i) => s + i.totalForecast, 0);
  const totalActual = displayItems.reduce((s, i) => s + i.totalActual, 0);
  html += `<td class="num" style="background:#dbeafe">${fmt(totalPlan)}</td>`;
  html += `<td class="num" style="background:#fef3c7">${fmt(totalForecast)}</td>`;
  html += `<td class="num" style="background:#dcfce7">${fmt(totalActual)}</td>`;
  html += '<td></td></tr>';

  html += '</tbody></table>';
  if (items.length > 200) html += `<p class="text-center text-gray-400 text-[11px] py-2">※ 表示は200件に制限（全${items.length}件）</p>`;

  container.innerHTML = html;
}

function exportItemsCSV() {
  const table = document.getElementById('itemsTable');
  if (!table) { showToast('テーブルが見つかりません', 'warning'); return; }
  let csv = '\uFEFF';
  table.querySelectorAll('tr').forEach(row => {
    const cells = [];
    row.querySelectorAll('th, td').forEach(cell => {
      let val = cell.textContent.trim();
      cells.push('"' + val.replace(/"/g, '""') + '"');
    });
    csv += cells.join(',') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'budget_items_export.csv';
  a.click();
  showToast('CSVをダウンロードしました');
}

// === Initialization ===
async function initApp() {
  try {
    const status = await api('/status');
    if (status.hasData) {
      state.hasData = true;
      state.masterFileName = status.masterFileName;
      state.detailFileName = status.detailFileName;
      enableNav();
      updateSidebarInfo();
      updateStatusBadge();
    }
    navigateTo(state.hasData ? 'dashboard' : 'upload');
  } catch (e) {
    console.error('Init error:', e);
    navigateTo('upload');
  }
}

function refreshData() {
  renderPage(state.currentPage);
}

document.addEventListener('DOMContentLoaded', initApp);
