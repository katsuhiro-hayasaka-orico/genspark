// =============================================
// Excel Budget Viewer - Frontend App
// =============================================

const state = {
  currentPage: 'upload',
  hasData: false,
  fileName: null,
  charts: {},
  sheetNames: [],
  systems: [],
  categories: [],
};

// === Utility Functions ===
function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('ja-JP');
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function monthName(m) {
  return ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'][m - 1] || m + '月';
}

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
    'upload': 'ファイルアップロード',
    'dashboard': 'ダッシュボード',
    'sheets': 'シートデータ',
    'analysis': '分析・比較',
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
  ['navDashboard', 'navSheets', 'navAnalysis', 'navItems'].forEach(id => {
    document.getElementById(id)?.classList.remove('disabled');
  });
}

function disableNav() {
  ['navDashboard', 'navSheets', 'navAnalysis', 'navItems'].forEach(id => {
    document.getElementById(id)?.classList.add('disabled');
  });
}

function updateSidebarInfo(fileName, info) {
  const el = document.getElementById('sidebarFileInfo');
  if (!fileName) {
    el.innerHTML = '<p>未アップロード</p>';
    return;
  }
  el.innerHTML = `
    <p class="font-medium text-gray-700 truncate" title="${fileName}"><i class="fas fa-file-excel text-green-500 mr-1"></i>${fileName}</p>
    ${info ? `<p class="mt-1">${info}</p>` : ''}
  `;
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
      case 'sheets': await renderSheets(); break;
      case 'analysis': await renderAnalysis(); break;
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
    <div class="fade-in max-w-2xl mx-auto space-y-6 pt-8">
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <i class="fas fa-file-excel text-white text-2xl"></i>
        </div>
        <h2 class="text-2xl font-bold text-gray-800">Excelファイルをアップロード</h2>
        <p class="text-gray-500 text-sm mt-2">予算データのExcelファイル（.xlsx, .xls, .csv）をドラッグ＆ドロップまたは選択してください</p>
      </div>

      <div id="uploadZone" class="upload-zone rounded-2xl p-12 text-center cursor-pointer bg-white"
           ondragover="event.preventDefault(); this.classList.add('dragover')"
           ondragleave="this.classList.remove('dragover')"
           ondrop="handleDrop(event)"
           onclick="document.getElementById('fileInput').click()">
        <input type="file" id="fileInput" accept=".xlsx,.xls,.xlsm,.xlsb,.csv" class="hidden" onchange="handleFileSelect(this)">
        <div id="uploadContent">
          <i class="fas fa-cloud-upload-alt text-4xl text-gray-300 mb-4"></i>
          <p class="text-gray-500 font-medium">ここにファイルをドロップ</p>
          <p class="text-gray-400 text-sm mt-1">または <span class="text-blue-500 underline">ファイルを選択</span></p>
          <p class="text-gray-300 text-[11px] mt-3">対応形式: .xlsx, .xls, .xlsm, .xlsb, .csv（最大100MB）</p>
        </div>
      </div>

      ${state.hasData ? `
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <i class="fas fa-check-circle text-green-500"></i>
            </div>
            <div>
              <p class="text-sm font-semibold text-gray-800">${state.fileName}</p>
              <p class="text-[11px] text-gray-400">読込済み — ${state.sheetNames.length}シート</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button onclick="navigateTo('dashboard')" class="btn-primary text-[12px]"><i class="fas fa-chart-pie mr-1"></i>ダッシュボードへ</button>
            <button onclick="clearData()" class="btn-secondary text-[12px]"><i class="fas fa-trash mr-1"></i>クリア</button>
          </div>
        </div>
      </div>` : ''}

      <div class="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <h3 class="text-sm font-semibold text-blue-800 mb-2"><i class="fas fa-info-circle mr-1.5"></i>使い方</h3>
        <ul class="text-[12px] text-blue-700 space-y-1.5">
          <li><i class="fas fa-check text-blue-400 mr-1.5"></i>Excelファイルをアップロードすると自動的にデータを解析します</li>
          <li><i class="fas fa-check text-blue-400 mr-1.5"></i>月別（4月〜3月）のヘッダーを自動検出し、予算データとして構造化します</li>
          <li><i class="fas fa-check text-blue-400 mr-1.5"></i>複数シートに対応 — 各シートを個別に可視化できます</li>
          <li><i class="fas fa-check text-blue-400 mr-1.5"></i>データはブラウザセッション中のみサーバーメモリに保持（ディスク保存なし）</li>
          <li><i class="fas fa-shield-halved text-blue-400 mr-1.5"></i>完全ローカル動作 — 外部サービスへの通信はありません</li>
        </ul>
      </div>
    </div>`;
}

function handleDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('dragover');
  const files = event.dataTransfer.files;
  if (files.length > 0) uploadFile(files[0]);
}

function handleFileSelect(input) {
  if (input.files.length > 0) uploadFile(input.files[0]);
}

async function uploadFile(file) {
  const zone = document.getElementById('uploadZone');
  const content = document.getElementById('uploadContent');
  content.innerHTML = `
    <i class="fas fa-spinner fa-spin text-3xl text-blue-500 mb-3"></i>
    <p class="text-gray-600 font-medium">解析中...</p>
    <p class="text-gray-400 text-sm">${file.name} (${fmtSize(file.size)})</p>
  `;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'アップロード失敗');

    state.hasData = true;
    state.fileName = data.fileName;
    state.sheetNames = data.sheetNames || [];

    enableNav();
    updateSidebarInfo(data.fileName, `${data.sheetNames.length}シート / ${data.rowCount}行`);
    updateStatusBadge();
    showToast(`${data.fileName} を読み込みました（${data.rowCount}件のデータ）`);

    // Auto-navigate to dashboard
    navigateTo('dashboard');
  } catch (e) {
    showToast(e.message, 'error');
    content.innerHTML = `
      <i class="fas fa-exclamation-triangle text-3xl text-red-400 mb-3"></i>
      <p class="text-red-600 font-medium">エラー</p>
      <p class="text-gray-400 text-sm">${e.message}</p>
      <p class="text-blue-500 text-sm mt-2 underline cursor-pointer" onclick="renderUpload()">再試行</p>
    `;
  }
}

async function clearData() {
  await fetch('/api/clear', { method: 'POST' });
  state.hasData = false;
  state.fileName = null;
  state.sheetNames = [];
  disableNav();
  updateSidebarInfo(null);
  updateStatusBadge();
  showToast('データをクリアしました', 'info');
  navigateTo('upload');
}

// === Dashboard ===
async function renderDashboard() {
  const mc = document.getElementById('mainContent');
  const summary = await api('/dashboard/summary');
  if (!summary.kpi) {
    mc.innerHTML = '<div class="text-center py-12 text-gray-400"><i class="fas fa-upload text-4xl mb-4"></i><p>データがありません。Excelファイルをアップロードしてください。</p></div>';
    return;
  }
  const k = summary.kpi;

  mc.innerHTML = `
    <div class="fade-in space-y-5">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-gauge-high mr-2 text-blue-600"></i>ダッシュボード</h2>
        <span class="text-[11px] text-gray-400"><i class="fas fa-file-excel text-green-500 mr-1"></i>${summary.fileName}</span>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-gray-500">年間合計</span>
            <div class="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center"><i class="fas fa-coins text-blue-500 text-xs"></i></div>
          </div>
          <p class="text-xl font-bold text-gray-800">${fmt(k.totalAnnual)}</p>
          <p class="text-[10px] text-gray-400 mt-1">${k.itemCount} 明細の合計</p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-gray-500">データ件数</span>
            <div class="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center"><i class="fas fa-list text-green-500 text-xs"></i></div>
          </div>
          <p class="text-xl font-bold text-gray-800">${fmt(k.itemCount)}</p>
          <p class="text-[10px] text-gray-400 mt-1">${k.sheetCount} シートから取得</p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-gray-500">分類数</span>
            <div class="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center"><i class="fas fa-tags text-purple-500 text-xs"></i></div>
          </div>
          <p class="text-xl font-bold text-gray-800">${k.systemCount + k.categoryCount}</p>
          <p class="text-[10px] text-gray-400 mt-1">システム ${k.systemCount} / カテゴリ ${k.categoryCount}</p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-gray-500">月平均</span>
            <div class="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center"><i class="fas fa-chart-line text-teal-500 text-xs"></i></div>
          </div>
          <p class="text-xl font-bold text-gray-800">${fmt(k.avgMonthValue)}</p>
          <p class="text-[10px] text-gray-400 mt-1">最大月: ${fmt(k.maxMonthValue)}</p>
        </div>
      </div>

      <!-- Charts Row 1 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-chart-bar mr-1.5 text-blue-500"></i>月別推移</h3>
          <div style="height: 300px"><canvas id="monthlyChart"></canvas></div>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-chart-pie mr-1.5 text-purple-500"></i>カテゴリ別構成</h3>
          <div style="height: 300px"><canvas id="categoryChart"></canvas></div>
        </div>
      </div>

      <!-- Charts Row 2 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-server mr-1.5 text-green-500"></i>システム別内訳</h3>
          <div style="height: 300px"><canvas id="systemChart"></canvas></div>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-chart-area mr-1.5 text-teal-500"></i>累積推移</h3>
          <div style="height: 300px"><canvas id="cumulativeChart"></canvas></div>
        </div>
      </div>

      <!-- Sheet Analysis -->
      ${Object.keys(summary.sheetAnalysis || {}).length > 0 ? `
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-table mr-1.5 text-gray-500"></i>シート別解析結果</h3>
        <div class="overflow-auto">
          <table class="data-table">
            <thead><tr><th>シート名</th><th>種別</th><th class="num">ヘッダー行</th><th class="num">月列数</th><th class="num">データ行</th><th class="num">合計値</th></tr></thead>
            <tbody>
              ${Object.values(summary.sheetAnalysis).map(s => `
                <tr>
                  <td class="font-medium">${s.name}</td>
                  <td><span class="badge ${s.type === 'structured' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">${s.type === 'structured' ? '構造化' : '汎用'}</span></td>
                  <td class="num">${s.headerRow >= 0 ? s.headerRow + 1 : '-'}</td>
                  <td class="num">${s.monthColumns}</td>
                  <td class="num">${s.dataRows}</td>
                  <td class="num font-semibold">${fmt(s.totalValue)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}
    </div>`;

  // Monthly Chart
  const mData = summary.monthlyTotals || [];
  if (mData.length > 0) {
    state.charts.monthly = new Chart(document.getElementById('monthlyChart'), {
      type: 'bar',
      data: {
        labels: mData.map(d => monthName(d.month)),
        datasets: [{
          label: '金額',
          data: mData.map(d => d.value),
          backgroundColor: mData.map((_, i) => `hsla(${210 + i * 10}, 70%, 60%, 0.6)`),
          borderColor: mData.map((_, i) => `hsla(${210 + i * 10}, 70%, 50%, 1)`),
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { callback: v => fmt(v) } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } } }
      }
    });
  }

  // Category Pie
  const cData = (summary.categoryTotals || []).slice(0, 10);
  if (cData.length > 0) {
    state.charts.category = new Chart(document.getElementById('categoryChart'), {
      type: 'doughnut',
      data: {
        labels: cData.map(c => c.name.length > 12 ? c.name.substring(0, 12) + '...' : c.name),
        datasets: [{ data: cData.map(c => c.value), backgroundColor: PIE_COLORS }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12, padding: 8 } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.raw)}` } }
        }
      }
    });
  }

  // System Horizontal Bar
  const sData = (summary.systemTotals || []).slice(0, 10);
  if (sData.length > 0) {
    state.charts.system = new Chart(document.getElementById('systemChart'), {
      type: 'bar',
      data: {
        labels: sData.map(s => s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name),
        datasets: [{
          label: '金額',
          data: sData.map(s => s.value),
          backgroundColor: PIE_COLORS.slice(0, sData.length),
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        scales: { x: { ticks: { callback: v => fmt(v) } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } } }
      }
    });
  }

  // Cumulative Line
  if (mData.length > 0) {
    let cumulative = 0;
    const cumData = mData.map(d => { cumulative += d.value; return cumulative; });
    state.charts.cumulative = new Chart(document.getElementById('cumulativeChart'), {
      type: 'line',
      data: {
        labels: mData.map(d => monthName(d.month)),
        datasets: [{
          label: '累計',
          data: cumData,
          borderColor: '#14b8a6',
          backgroundColor: 'rgba(20, 184, 166, 0.1)',
          borderWidth: 2.5,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#14b8a6',
          tension: 0.3,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { ticks: { callback: v => fmt(v) } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `累計: ${fmt(ctx.raw)}` } } }
      }
    });
  }
}

// === Sheets Page ===
async function renderSheets() {
  const mc = document.getElementById('mainContent');
  const { sheets } = await api('/sheets');

  let tabsHtml = sheets.map((s, i) => `
    <button onclick="loadSheet('${encodeURIComponent(s.name)}')" id="sheetTab_${i}" class="tab-btn ${i === 0 ? 'active' : ''}">${s.name} <span class="text-gray-300">(${s.rows}行)</span></button>
  `).join('');

  mc.innerHTML = `
    <div class="fade-in space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-table mr-2 text-blue-600"></i>シートデータ</h2>
        <button onclick="exportCurrentSheetCSV()" class="btn-secondary text-[12px]"><i class="fas fa-download mr-1"></i>CSV出力</button>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <div class="flex flex-wrap gap-1 mb-4 border-b border-gray-100 pb-3">${tabsHtml}</div>
        <div id="sheetContent" class="overflow-auto max-h-[70vh]">
          <p class="text-gray-400 text-sm p-4"><i class="fas fa-spinner fa-spin mr-2"></i>読み込み中...</p>
        </div>
      </div>
    </div>`;

  if (sheets.length > 0) loadSheet(encodeURIComponent(sheets[0].name));
}

async function loadSheet(encodedName) {
  const name = decodeURIComponent(encodedName);
  const container = document.getElementById('sheetContent');
  container.innerHTML = '<p class="text-gray-400 text-sm p-4"><i class="fas fa-spinner fa-spin mr-2"></i>読み込み中...</p>';

  // Update active tab
  document.querySelectorAll('[id^="sheetTab_"]').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('[id^="sheetTab_"]').forEach(btn => {
    if (btn.textContent.startsWith(name)) btn.classList.add('active');
  });

  const data = await api('/sheets/' + encodedName);
  const rows = data.json || [];

  if (rows.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm text-center p-8">データがありません</p>';
    return;
  }

  let html = `<table class="data-table" id="currentSheetTable">`;

  // First row as header
  html += '<thead><tr><th class="num" style="width:40px">#</th>';
  const maxCols = Math.min(Math.max(...rows.slice(0, 50).map(r => r.length)), 30);
  for (let c = 0; c < maxCols; c++) {
    const val = rows[0] && rows[0][c] !== undefined ? String(rows[0][c]).trim() : '';
    html += `<th title="${val}">${val.length > 20 ? val.substring(0, 20) + '...' : val || colLetter(c)}</th>`;
  }
  html += '</tr></thead><tbody>';

  // Data rows (skip first row used as header)
  const displayRows = rows.slice(1, 200);
  displayRows.forEach((row, ri) => {
    html += `<tr><td class="num text-gray-400">${ri + 2}</td>`;
    for (let c = 0; c < maxCols; c++) {
      const val = row[c] !== undefined ? row[c] : '';
      const isNum = typeof val === 'number' || (!isNaN(parseFloat(String(val).replace(/,/g, ''))) && String(val).trim() !== '');
      html += `<td class="${isNum ? 'num' : ''}" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${val}">${isNum && typeof val === 'number' ? fmt(val) : val}</td>`;
    }
    html += '</tr>';
  });

  html += '</tbody></table>';
  if (data.truncated) html += `<p class="text-center text-gray-400 text-[11px] py-2">※ 表示は先頭500行に制限されています（全${data.totalRows}行）</p>`;
  if (displayRows.length >= 199) html += `<p class="text-center text-gray-400 text-[11px] py-2">※ 表示は200行に制限しています</p>`;

  container.innerHTML = html;
}

function colLetter(n) {
  let s = '';
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
}

function exportCurrentSheetCSV() {
  const table = document.getElementById('currentSheetTable');
  if (!table) { showToast('テーブルが見つかりません', 'warning'); return; }
  let csv = '\uFEFF'; // BOM for Excel
  table.querySelectorAll('tr').forEach(row => {
    const cells = [];
    row.querySelectorAll('th, td').forEach((cell, i) => {
      if (i === 0) return; // skip row number
      let val = cell.textContent.trim();
      cells.push('"' + val.replace(/"/g, '""') + '"');
    });
    csv += cells.join(',') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sheet_export.csv';
  a.click();
  showToast('CSVをダウンロードしました');
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
          <button onclick="loadAnalysisTab('category')" id="anaTabCategory" class="tab-btn">カテゴリ別</button>
          <button onclick="loadAnalysisTab('sheet')" id="anaTabSheet" class="tab-btn">シート別</button>
          <button onclick="loadAnalysisTab('cross')" id="anaTabCross" class="tab-btn">クロス集計</button>
          <button onclick="loadAnalysisTab('ranking')" id="anaTabRanking" class="tab-btn">金額ランキング</button>
        </div>
        <div id="analysisTableContent"><p class="text-gray-400 text-sm p-4">読み込み中...</p></div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3" id="analysisChartTitle">内訳チャート</h3>
          <div style="height:320px"><canvas id="analysisChart"></canvas></div>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3">構成比チャート</h3>
          <div style="height:320px"><canvas id="analysisPieChart"></canvas></div>
        </div>
      </div>
    </div>`;

  await loadAnalysisTab('system');
}

async function loadAnalysisTab(tab) {
  document.querySelectorAll('[id^="anaTab"]').forEach(b => b.classList.remove('active'));
  const tabEl = document.getElementById('anaTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (tabEl) tabEl.classList.add('active');

  const container = document.getElementById('analysisTableContent');
  container.innerHTML = '<p class="text-gray-400 text-sm p-4"><i class="fas fa-spinner fa-spin mr-2"></i>読み込み中...</p>';

  if (tab === 'cross') {
    await renderCrossTab(container);
    return;
  }
  if (tab === 'ranking') {
    await renderRanking(container);
    return;
  }

  const endpoint = tab === 'system' ? '/analysis/by-system' : tab === 'category' ? '/analysis/by-category' : '/analysis/by-sheet';
  const result = await api(endpoint);
  const data = result.data || [];

  if (data.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm text-center p-8">データがありません</p>';
    return;
  }

  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  let html = '<div class="overflow-auto"><table class="data-table"><thead><tr><th>名称</th><th class="num">金額</th><th class="num">構成比</th><th>構成バー</th>';
  if (tab === 'sheet') html += '<th class="num">件数</th>';
  html += '</tr></thead><tbody>';

  data.forEach((d, i) => {
    const pct = total > 0 ? (d.value / total * 100) : 0;
    html += `<tr>
      <td class="font-medium"><span class="inline-block w-3 h-3 rounded-sm mr-2" style="background:${PIE_COLORS[i % PIE_COLORS.length]}"></span>${d.name}</td>
      <td class="num font-semibold">${fmt(d.value)}</td>
      <td class="num">${pct.toFixed(1)}%</td>
      <td><div class="w-full bg-gray-100 rounded-full h-2"><div class="h-2 rounded-full" style="width:${Math.min(pct, 100)}%;background:${PIE_COLORS[i % PIE_COLORS.length]}"></div></div></td>`;
    if (tab === 'sheet') html += `<td class="num">${d.count || '-'}</td>`;
    html += '</tr>';
  });

  html += `<tr class="font-bold" style="background:#f8fafc"><td>合計</td><td class="num">${fmt(total)}</td><td class="num">100.0%</td><td></td>`;
  if (tab === 'sheet') html += '<td></td>';
  html += '</tr></tbody></table></div>';
  container.innerHTML = html;

  // Update charts
  const labels = { system: 'システム別', category: 'カテゴリ別', sheet: 'シート別' };
  document.getElementById('analysisChartTitle').textContent = labels[tab] || '内訳チャート';

  if (state.charts.analysis) state.charts.analysis.destroy();
  state.charts.analysis = new Chart(document.getElementById('analysisChart'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.name.length > 12 ? d.name.substring(0, 12) + '...' : d.name),
      datasets: [{
        label: '金額',
        data: data.map(d => d.value),
        backgroundColor: data.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      scales: { x: { ticks: { callback: v => fmt(v) } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } } }
    }
  });

  if (state.charts.analysisPie) state.charts.analysisPie.destroy();
  state.charts.analysisPie = new Chart(document.getElementById('analysisPieChart'), {
    type: 'doughnut',
    data: {
      labels: data.slice(0, 10).map(d => d.name.length > 12 ? d.name.substring(0, 12) + '...' : d.name),
      datasets: [{ data: data.slice(0, 10).map(d => d.value), backgroundColor: PIE_COLORS }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.raw)}` } }
      }
    }
  });
}

async function renderCrossTab(container) {
  const result = await api('/analysis/cross-tab');
  const { data, systems, categories } = result;

  if (systems.length === 0 || categories.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm text-center p-8">クロス集計データがありません</p>';
    return;
  }

  let html = '<div class="overflow-auto"><table class="data-table"><thead><tr><th>システム \\ カテゴリ</th>';
  categories.forEach(c => { html += `<th class="num">${c.length > 10 ? c.substring(0, 10) + '..' : c}</th>`; });
  html += '<th class="num" style="background:#e0e7ff;font-weight:700">合計</th></tr></thead><tbody>';

  const colTotals = {};
  categories.forEach(c => { colTotals[c] = 0; });
  let grandTotal = 0;

  systems.forEach(sys => {
    html += `<tr><td class="font-medium">${sys}</td>`;
    let rowTotal = 0;
    categories.forEach(cat => {
      const val = (data[sys] && data[sys][cat]) || 0;
      rowTotal += val;
      colTotals[cat] += val;
      html += `<td class="num ${val > 0 ? '' : 'text-gray-300'}">${val > 0 ? fmt(val) : '-'}</td>`;
    });
    grandTotal += rowTotal;
    html += `<td class="num font-semibold" style="background:#eff6ff">${fmt(rowTotal)}</td></tr>`;
  });

  // Totals row
  html += '<tr style="background:#f8fafc;font-weight:700"><td>合計</td>';
  categories.forEach(cat => { html += `<td class="num">${fmt(colTotals[cat])}</td>`; });
  html += `<td class="num" style="background:#dbeafe">${fmt(grandTotal)}</td></tr>`;

  html += '</tbody></table></div>';
  container.innerHTML = html;

  // Update charts for cross-tab
  if (state.charts.analysis) state.charts.analysis.destroy();
  const datasets = categories.slice(0, 8).map((cat, i) => ({
    label: cat.length > 10 ? cat.substring(0, 10) + '..' : cat,
    data: systems.map(sys => (data[sys] && data[sys][cat]) || 0),
    backgroundColor: PIE_COLORS[i % PIE_COLORS.length] + '80',
    borderColor: PIE_COLORS[i % PIE_COLORS.length],
    borderWidth: 1,
  }));
  state.charts.analysis = new Chart(document.getElementById('analysisChart'), {
    type: 'bar',
    data: { labels: systems.map(s => s.length > 10 ? s.substring(0, 10) + '..' : s), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: v => fmt(v) } } },
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } } }
    }
  });
  document.getElementById('analysisChartTitle').textContent = 'クロス集計（積み上げ）';
}

async function renderRanking(container) {
  const result = await api('/analysis/top-items?limit=30');
  const data = result.data || [];

  if (data.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm text-center p-8">データがありません</p>';
    return;
  }

  let html = '<div class="overflow-auto"><table class="data-table"><thead><tr><th style="width:40px">#</th><th>シート</th><th>システム</th><th>カテゴリ</th><th>項目</th><th class="num">年間合計</th></tr></thead><tbody>';
  data.forEach((item, i) => {
    html += `<tr>
      <td class="font-bold text-gray-400">${i + 1}</td>
      <td class="text-[11px] text-gray-500">${item.sheet}</td>
      <td class="font-medium">${item.system}</td>
      <td>${item.category}</td>
      <td>${item.item}</td>
      <td class="num font-semibold">${fmt(item.annual)}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;

  document.getElementById('analysisChartTitle').textContent = '金額ランキング Top 20';
  if (state.charts.analysis) state.charts.analysis.destroy();
  const topData = data.slice(0, 20);
  state.charts.analysis = new Chart(document.getElementById('analysisChart'), {
    type: 'bar',
    data: {
      labels: topData.map((d, i) => `${i+1}. ${(d.item || d.system).substring(0, 12)}`),
      datasets: [{
        label: '金額',
        data: topData.map(d => d.annual),
        backgroundColor: topData.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
        borderRadius: 3,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      scales: { x: { ticks: { callback: v => fmt(v) } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } } }
    }
  });
}

// === Items Page ===
async function renderItems() {
  const mc = document.getElementById('mainContent');

  // Get filter options from status
  const status = await api('/status');
  const sheetOpts = (status.sheetNames || []).map(s => `<option value="${s}">${s}</option>`).join('');

  mc.innerHTML = `
    <div class="fade-in space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-list-ol mr-2 text-blue-600"></i>明細一覧</h2>
        <button onclick="exportItemsCSV()" class="btn-secondary text-[12px]"><i class="fas fa-download mr-1"></i>CSV出力</button>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <div class="flex items-center gap-1.5">
            <label class="text-[12px] text-gray-500">シート:</label>
            <select id="filterSheet" onchange="loadItems()" class="border rounded-md px-2 py-1 text-[12px]">
              <option value="">全シート</option>${sheetOpts}
            </select>
          </div>
          <div class="flex items-center gap-1.5">
            <label class="text-[12px] text-gray-500">検索:</label>
            <input id="filterSearch" oninput="debounceLoadItems()" class="border rounded-md px-2 py-1 text-[12px] w-48" placeholder="キーワード検索...">
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
  const sheet = document.getElementById('filterSheet')?.value || '';
  const search = document.getElementById('filterSearch')?.value || '';

  let url = '/items?';
  if (sheet) url += 'sheet=' + encodeURIComponent(sheet) + '&';
  if (search) url += 'search=' + encodeURIComponent(search) + '&';

  const result = await api(url);
  const items = result.items || [];
  document.getElementById('itemCount').textContent = `${items.length} 件`;

  if (items.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm text-center p-8">該当するデータがありません</p>';
    return;
  }

  // Detect which months exist
  const allMonths = new Set();
  items.forEach(item => Object.keys(item.months).forEach(m => allMonths.add(parseInt(m))));
  const months = [...allMonths].sort((a, b) => {
    const fa = a >= 4 ? a - 4 : a + 8;
    const fb = b >= 4 ? b - 4 : b + 8;
    return fa - fb;
  });

  let html = '<table class="data-table" id="itemsTable"><thead><tr>';
  html += '<th>シート</th><th>システム</th><th>カテゴリ</th><th>項目</th>';
  months.forEach(m => { html += `<th class="num">${monthName(m)}</th>`; });
  html += '<th class="num" style="background:#e0e7ff;font-weight:700">年間計</th></tr></thead><tbody>';

  const displayItems = items.slice(0, 300);
  displayItems.forEach(item => {
    html += '<tr>';
    html += `<td class="text-[11px] text-gray-400">${item.sheet}</td>`;
    html += `<td class="font-medium">${item.system}</td>`;
    html += `<td class="text-[11px] text-gray-500">${item.category}</td>`;
    html += `<td>${item.item}</td>`;
    months.forEach(m => {
      const v = item.months[m] || 0;
      html += `<td class="num ${v === 0 ? 'text-gray-300' : ''}">${v !== 0 ? fmt(v) : '-'}</td>`;
    });
    html += `<td class="num font-semibold" style="background:#eff6ff">${fmt(item.annual)}</td>`;
    html += '</tr>';
  });

  // Totals
  html += '<tr style="background:#f8fafc;font-weight:700"><td colspan="4">合計</td>';
  months.forEach(m => {
    const total = displayItems.reduce((s, i) => s + (i.months[m] || 0), 0);
    html += `<td class="num">${fmt(total)}</td>`;
  });
  const grandTotal = displayItems.reduce((s, i) => s + i.annual, 0);
  html += `<td class="num" style="background:#dbeafe">${fmt(grandTotal)}</td></tr>`;

  html += '</tbody></table>';
  if (items.length > 300) html += `<p class="text-center text-gray-400 text-[11px] py-2">※ 表示は300件に制限（全${items.length}件）</p>`;

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
  a.download = 'items_export.csv';
  a.click();
  showToast('CSVをダウンロードしました');
}

// === Initialization ===
async function initApp() {
  try {
    const status = await api('/status');
    if (status.hasData) {
      state.hasData = true;
      state.fileName = status.fileName;
      state.sheetNames = status.sheetNames || [];
      enableNav();
      updateSidebarInfo(status.fileName, `${status.sheetNames.length}シート / ${status.itemCount}行`);
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

// Start
document.addEventListener('DOMContentLoaded', initApp);
