// =============================================
// System Planning Budget Management - Frontend App
// =============================================

const state = {
  currentPage: 'dashboard',
  fiscalYearId: 1,
  fiscalYears: [],
  domains: [],
  systems: [],
  categories: [],
  items: [],
  charts: {}
};

// === Utility Functions ===
function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('ja-JP');
}
function fmtPct(n) { return (n || 0).toFixed(1) + '%'; }
function monthName(m) {
  return ['4月','5月','6月','7月','8月','9月','10月','11月','12月','1月','2月','3月'][m - 1] || m + '月';
}
function colorByVariance(rate) {
  if (rate > 5) return 'text-red-600 font-semibold';
  if (rate > 0) return 'text-yellow-600';
  if (rate < -5) return 'text-green-600';
  return 'text-gray-700';
}
function colorByUsage(rate) {
  if (rate >= 100) return 'bg-red-500';
  if (rate >= 90) return 'bg-yellow-500';
  return 'bg-blue-500';
}

async function api(path, opts = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const url = '/api' + path + sep + 'fiscal_year_id=' + state.fiscalYearId;
  const fetchOpts = { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } };
  if (opts.body && typeof opts.body === 'object') fetchOpts.body = JSON.stringify(opts.body);
  const res = await fetch(url, fetchOpts);
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
  el.className = `${colors[type]} text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 fade-in text-[13px]`;
  el.innerHTML = `<i class="fas fa-${icons[type]}"></i><span>${msg}</span>`;
  tc.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

function showModal(content) {
  const mc = document.getElementById('modalContainer');
  mc.innerHTML = `<div class="modal-overlay fixed inset-0 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()">
    <div class="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto fade-in">${content}</div>
  </div>`;
  mc.classList.remove('hidden');
}
function closeModal() { document.getElementById('modalContainer').classList.add('hidden'); }

function destroyCharts() {
  Object.values(state.charts).forEach(c => { if (c && c.destroy) c.destroy(); });
  state.charts = {};
}

// === Navigation ===
function navigateTo(page) {
  state.currentPage = page;
  destroyCharts();
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const labels = {
    'dashboard': 'ダッシュボード',
    'budget-input': '予算データ入力',
    'analysis': '予実差異分析',
    'multi-year': '中期比較',
    'reports': 'レポート出力',
    'master-systems': 'システム管理',
    'master-expenses': '費目管理',
    'comments': '差異コメント'
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

async function renderPage(page) {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="flex items-center justify-center h-64"><i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i></div>';
  try {
    switch (page) {
      case 'dashboard': await renderDashboard(); break;
      case 'budget-input': await renderBudgetInput(); break;
      case 'analysis': await renderAnalysis(); break;
      case 'multi-year': await renderMultiYear(); break;
      case 'reports': await renderReports(); break;
      case 'master-systems': await renderMasterSystems(); break;
      case 'master-expenses': await renderMasterExpenses(); break;
      case 'comments': await renderComments(); break;
      default: mc.innerHTML = '<p class="text-gray-500 p-8">ページが見つかりません</p>';
    }
  } catch (e) {
    console.error(e);
    mc.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700"><i class="fas fa-exclamation-triangle mr-2"></i>エラー: ${e.message}</div>`;
  }
}

// === Dashboard ===
async function renderDashboard() {
  const mc = document.getElementById('mainContent');
  const [summary, alerts] = await Promise.all([
    api('/dashboard/summary'),
    api('/dashboard/alerts')
  ]);
  const k = summary.kpi;
  const fy = summary.fiscalYear;

  mc.innerHTML = `
    <div class="fade-in space-y-5">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-gauge-high mr-2 text-blue-600"></i>${fy?.name || ''} ダッシュボード</h2>
        <span class="text-[11px] text-gray-400">${fy?.start_date || ''} 〜 ${fy?.end_date || ''}</span>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-gray-500">修正計画</span>
            <div class="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center"><i class="fas fa-clipboard-list text-blue-500 text-xs"></i></div>
          </div>
          <p class="text-xl font-bold text-gray-800">${fmt(k.totalRevisedPlan)}</p>
          <p class="text-[10px] text-gray-400 mt-1">当初: ${fmt(k.totalInitialPlan)}</p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-gray-500">実績累計</span>
            <div class="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center"><i class="fas fa-coins text-green-500 text-xs"></i></div>
          </div>
          <p class="text-xl font-bold text-gray-800">${fmt(k.totalActual)}</p>
          <div class="mt-1.5"><div class="w-full bg-gray-100 rounded-full h-1.5"><div class="progress-bar h-1.5 rounded-full ${colorByUsage(k.consumptionRate)}" style="width: ${Math.min(k.consumptionRate, 100)}%"></div></div>
          <p class="text-[10px] text-gray-400 mt-0.5">消化率 ${fmtPct(k.consumptionRate)}</p></div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-gray-500">着地見込</span>
            <div class="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center"><i class="fas fa-bullseye text-purple-500 text-xs"></i></div>
          </div>
          <p class="text-xl font-bold text-gray-800">${fmt(k.totalForecast)}</p>
          <p class="text-[10px] ${k.forecastVariance > 0 ? 'text-red-500' : 'text-green-500'} mt-1">
            計画比 ${k.forecastVariance > 0 ? '+' : ''}${fmt(k.forecastVariance)} (${k.varianceRate > 0 ? '+' : ''}${fmtPct(k.varianceRate)})
          </p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-gray-500">残予算</span>
            <div class="w-7 h-7 ${k.remaining < 0 ? 'bg-red-50' : 'bg-teal-50'} rounded-lg flex items-center justify-center">
              <i class="fas fa-wallet ${k.remaining < 0 ? 'text-red-500' : 'text-teal-500'} text-xs"></i>
            </div>
          </div>
          <p class="text-xl font-bold ${k.remaining < 0 ? 'text-red-600' : 'text-gray-800'}">${fmt(k.remaining)}</p>
          <p class="text-[10px] text-gray-400 mt-1">修正計画 - 実績</p>
        </div>
      </div>

      <!-- Alerts -->
      ${alerts.alerts && alerts.alerts.length > 0 ? `
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3"><i class="fas fa-triangle-exclamation mr-1.5 text-yellow-500"></i>超過/差異アラート</h3>
        <div class="space-y-2">
          ${alerts.alerts.map(a => `
            <div class="flex items-center justify-between px-3 py-2 rounded-lg ${a.variance_rate >= 5 ? 'bg-red-50 border border-red-100' : 'bg-yellow-50 border border-yellow-100'}">
              <div>
                <span class="text-[13px] font-medium ${a.variance_rate >= 5 ? 'text-red-700' : 'text-yellow-700'}">${a.system_name}</span>
                <span class="text-[11px] text-gray-500 ml-2">${a.domain_name}</span>
              </div>
              <div class="flex items-center gap-3 text-[12px]">
                <span>消化率: <b>${fmtPct(a.usage_rate)}</b></span>
                <span class="${a.variance_rate >= 5 ? 'text-red-600' : 'text-yellow-600'}">見込差異: <b>${a.variance_rate > 0 ? '+' : ''}${fmtPct(a.variance_rate)}</b></span>
              </div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3">月別推移（計画 vs 実績）</h3>
          <div style="height: 280px"><canvas id="monthlyChart"></canvas></div>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3">費用カテゴリ別構成</h3>
          <div style="height: 280px"><canvas id="categoryChart"></canvas></div>
        </div>
      </div>

      <!-- Domain + System Summary -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3">ドメイン別集計</h3>
          <table class="w-full text-[12px]">
            <thead><tr class="border-b"><th class="text-left py-2 text-gray-500">ドメイン</th><th class="text-right py-2 text-gray-500">修正計画</th><th class="text-right py-2 text-gray-500">実績</th><th class="text-right py-2 text-gray-500">着地見込</th><th class="text-right py-2 text-gray-500">差異率</th></tr></thead>
            <tbody>
              ${(summary.domainData || []).map(d => {
                const vr = d.revised_plan > 0 ? ((d.forecast - d.revised_plan) / d.revised_plan * 100) : 0;
                return `<tr class="border-b border-gray-50 hover:bg-gray-50">
                  <td class="py-2 font-medium">${d.name}</td>
                  <td class="text-right">${fmt(d.revised_plan)}</td>
                  <td class="text-right">${fmt(d.actual)}</td>
                  <td class="text-right">${fmt(d.forecast)}</td>
                  <td class="text-right ${colorByVariance(vr)}">${vr > 0 ? '+' : ''}${vr.toFixed(1)}%</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3">累積推移</h3>
          <div style="height: 240px"><canvas id="cumulativeChart"></canvas></div>
        </div>
      </div>
    </div>
  `;

  // Monthly Chart
  const mData = summary.monthlyData || [];
  const mLabels = mData.map(d => monthName(d.month));
  state.charts.monthly = new Chart(document.getElementById('monthlyChart'), {
    type: 'bar',
    data: {
      labels: mLabels,
      datasets: [
        { label: '修正計画', data: mData.map(d => d.revised_plan), backgroundColor: 'rgba(59,130,246,0.2)', borderColor: '#3b82f6', borderWidth: 1 },
        { label: '実績', data: mData.map(d => d.actual), backgroundColor: 'rgba(34,197,94,0.5)', borderColor: '#22c55e', borderWidth: 1 },
        { label: '着地見込', data: mData.map(d => d.forecast), type: 'line', borderColor: '#a855f7', borderWidth: 2, pointRadius: 3, fill: false }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: v => fmt(v) } } }, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
  });

  // Category Pie
  const cData = (summary.categoryData || []).filter(c => c.revised_plan > 0);
  const pieColors = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#64748b'];
  state.charts.category = new Chart(document.getElementById('categoryChart'), {
    type: 'doughnut',
    data: {
      labels: cData.map(c => c.name),
      datasets: [{ data: cData.map(c => c.revised_plan), backgroundColor: pieColors }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } } } }
  });

  // Cumulative Line
  try {
    const trends = await api('/dashboard/trends');
    const tData = trends.trends || [];
    state.charts.cumulative = new Chart(document.getElementById('cumulativeChart'), {
      type: 'line',
      data: {
        labels: tData.map(t => monthName(t.month)),
        datasets: [
          { label: '計画累計', data: tData.map(t => t.cum_plan), borderColor: '#3b82f6', borderWidth: 2, fill: false, pointRadius: 2 },
          { label: '見込累計', data: tData.map(t => t.cum_forecast), borderColor: '#a855f7', borderWidth: 2, borderDash: [5,3], fill: false, pointRadius: 2 },
          { label: '実績累計', data: tData.map(t => t.cum_actual), borderColor: '#22c55e', borderWidth: 2.5, fill: false, pointRadius: 3 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: v => fmt(v) } } }, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
    });
  } catch(e) { console.warn('Cumulative chart error:', e); }
}

// === Budget Input (Excel-style) ===
async function renderBudgetInput() {
  const mc = document.getElementById('mainContent');
  const [systemTree, itemTree] = await Promise.all([
    api('/master/systems/tree'),
    api('/master/expense-items/tree')
  ]);

  // Build system select options
  let systemOpts = '<option value="">全システム</option>';
  (systemTree.tree || []).forEach(d => {
    systemOpts += `<optgroup label="${d.name}">`;
    (d.systems || []).forEach(s => { systemOpts += `<option value="${s.id}">${s.name}</option>`; });
    systemOpts += '</optgroup>';
  });

  // Amount type tabs
  mc.innerHTML = `
    <div class="fade-in space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-table-cells mr-2 text-blue-600"></i>予算データ入力</h2>
        <div class="flex gap-2">
          <button onclick="exportBudgetCSV()" class="btn-secondary text-[12px]"><i class="fas fa-download mr-1"></i>CSV出力</button>
          <button onclick="showCSVImportModal()" class="btn-secondary text-[12px]"><i class="fas fa-upload mr-1"></i>CSV取込</button>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <div class="flex items-center gap-1.5">
            <label class="text-[12px] text-gray-500">システム:</label>
            <select id="budgetSystemSelect" onchange="loadBudgetMatrix()" class="border rounded-md px-2 py-1 text-[12px]">${systemOpts}</select>
          </div>
          <div class="flex items-center gap-1.5">
            <label class="text-[12px] text-gray-500">表示タイプ:</label>
            <select id="budgetAmountType" onchange="loadBudgetMatrix()" class="border rounded-md px-2 py-1 text-[12px]">
              <option value="all">全タイプ比較</option>
              <option value="initial_plan">当初計画</option>
              <option value="revised_plan">修正計画</option>
              <option value="forecast">着地見込</option>
              <option value="actual">実績</option>
            </select>
          </div>
          <div class="flex gap-1 ml-auto">
            <span class="text-[10px] px-2 py-0.5 rounded bg-yellow-50 border border-yellow-200 text-yellow-700">■ 入力セル</span>
            <span class="text-[10px] px-2 py-0.5 rounded bg-green-50 border border-green-200 text-green-700">■ 参照セル</span>
            <span class="text-[10px] px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700">■ 実績セル</span>
          </div>
        </div>
        <div id="budgetMatrixContainer" class="overflow-auto max-h-[65vh]">
          <p class="text-gray-400 text-sm p-4">読み込み中...</p>
        </div>
      </div>
    </div>`;

  await loadBudgetMatrix();
}

async function loadBudgetMatrix() {
  const container = document.getElementById('budgetMatrixContainer');
  if (!container) return;
  container.innerHTML = '<p class="text-gray-400 text-sm p-4"><i class="fas fa-spinner fa-spin mr-2"></i>読み込み中...</p>';

  const systemId = document.getElementById('budgetSystemSelect')?.value;
  const amountType = document.getElementById('budgetAmountType')?.value || 'all';

  let url = '/budgets/matrix';
  if (systemId) url += '?system_id=' + systemId;

  const data = await api(url);
  const rows = data.data || [];

  if (rows.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm p-8 text-center">データがありません</p>';
    return;
  }

  // Group by system > item
  const grouped = {};
  rows.forEach(r => {
    const key = `${r.system_id}_${r.expense_item_id}`;
    if (!grouped[key]) {
      grouped[key] = { system_id: r.system_id, system_name: r.system_name, domain_name: r.domain_name, domain_id: r.domain_id,
        item_id: r.expense_item_id, item_name: r.item_name, item_code: r.item_code, category_name: r.category_name, category_id: r.category_id,
        months: {} };
    }
    grouped[key].months[r.month] = { initial_plan: r.initial_plan, revised_plan: r.revised_plan, forecast: r.forecast, actual: r.actual, contract_partner: r.contract_partner, notes: r.notes };
  });

  const entries = Object.values(grouped);

  if (amountType === 'all') {
    renderComparisonMatrix(container, entries);
  } else {
    renderSingleTypeMatrix(container, entries, amountType);
  }
}

function renderComparisonMatrix(container, entries) {
  // Group by domain for subtotals
  const domains = {};
  entries.forEach(e => {
    if (!domains[e.domain_id]) domains[e.domain_id] = { name: e.domain_name, entries: [], totals: {} };
    domains[e.domain_id].entries.push(e);
  });

  let html = '<table class="budget-table w-full"><thead><tr>';
  html += '<th class="row-header" style="min-width:100px">ドメイン</th>';
  html += '<th class="row-header" style="min-width:120px">システム</th>';
  html += '<th class="row-header" style="min-width:100px">費目</th>';
  html += '<th>タイプ</th>';
  for (let m = 1; m <= 12; m++) html += `<th>${monthName(m)}</th>`;
  html += '<th style="background:#dbeafe">年間計</th>';
  html += '</tr></thead><tbody>';

  const types = [
    { key: 'initial_plan', label: '当初計画', cls: 'ref-cell' },
    { key: 'revised_plan', label: '修正計画', cls: 'input-cell' },
    { key: 'forecast', label: '着地見込', cls: 'input-cell' },
    { key: 'actual', label: '実績', cls: 'actual-cell' }
  ];
  const grandTotals = {};
  types.forEach(t => { grandTotals[t.key] = Array(12).fill(0); });

  Object.values(domains).forEach(domain => {
    const domTotals = {};
    types.forEach(t => { domTotals[t.key] = Array(12).fill(0); });

    domain.entries.forEach((entry, ei) => {
      types.forEach((type, ti) => {
        html += '<tr>';
        if (ti === 0 && ei === 0) html += `<td class="row-header" rowspan="${domain.entries.length * 4}" style="vertical-align:top;font-weight:600;background:#e0e7ff">${domain.name}</td>`;
        if (ti === 0) html += `<td class="row-header" rowspan="4" style="vertical-align:top">${entry.system_name}<br><span class="text-[10px] text-gray-400">${entry.item_name}</span></td>`;
        if (ti === 0) html += `<td class="row-header" rowspan="4" style="vertical-align:top"><span class="text-[10px] text-gray-500">${entry.category_name}</span></td>`;
        html += `<td class="text-center text-[10px] ${type.cls}" style="font-weight:500">${type.label}</td>`;

        let annual = 0;
        for (let m = 1; m <= 12; m++) {
          const val = entry.months[m] ? entry.months[m][type.key] || 0 : 0;
          annual += val;
          domTotals[type.key][m - 1] += val;
          grandTotals[type.key][m - 1] += val;
          html += `<td class="${type.cls}">${fmt(val)}</td>`;
        }
        html += `<td style="background:#dbeafe;font-weight:600">${fmt(annual)}</td>`;
        html += '</tr>';
      });
    });

    // Domain subtotal
    types.forEach((type, ti) => {
      html += `<tr class="subtotal-row"><td colspan="3" class="row-header" style="background:#e2e8f0">${ti === 0 ? domain.name + ' 小計' : ''}</td>`;
      html += `<td class="text-center text-[10px]">${type.label}</td>`;
      let annual = 0;
      for (let m = 0; m < 12; m++) { annual += domTotals[type.key][m]; html += `<td>${fmt(domTotals[type.key][m])}</td>`; }
      html += `<td style="font-weight:700">${fmt(annual)}</td></tr>`;
    });
  });

  // Grand total
  types.forEach((type, ti) => {
    html += `<tr class="total-row"><td colspan="3" class="row-header" style="background:#1e40af;color:white">${ti === 0 ? '全体合計' : ''}</td>`;
    html += `<td class="text-center text-[10px]">${type.label}</td>`;
    let annual = 0;
    for (let m = 0; m < 12; m++) { annual += grandTotals[type.key][m]; html += `<td>${fmt(grandTotals[type.key][m])}</td>`; }
    html += `<td>${fmt(annual)}</td></tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderSingleTypeMatrix(container, entries, amountType) {
  const labels = { initial_plan: '当初計画', revised_plan: '修正計画', forecast: '着地見込', actual: '実績' };
  const cellCls = { initial_plan: 'ref-cell', revised_plan: 'input-cell', forecast: 'input-cell', actual: 'actual-cell' };

  let html = `<table class="budget-table w-full"><thead><tr>`;
  html += '<th class="row-header" style="min-width:80px">ドメイン</th>';
  html += '<th class="row-header" style="min-width:120px">システム</th>';
  html += '<th class="row-header" style="min-width:100px">費目</th>';
  for (let m = 1; m <= 12; m++) html += `<th>${monthName(m)}</th>`;
  html += '<th style="background:#dbeafe">年間計</th></tr></thead><tbody>';

  // Group by domain
  const byDomain = {};
  entries.forEach(e => {
    if (!byDomain[e.domain_id]) byDomain[e.domain_id] = { name: e.domain_name, entries: [] };
    byDomain[e.domain_id].entries.push(e);
  });

  const grandTotal = Array(12).fill(0);

  Object.values(byDomain).forEach(domain => {
    const domTotal = Array(12).fill(0);

    domain.entries.forEach((entry, idx) => {
      html += '<tr>';
      if (idx === 0) html += `<td class="row-header" rowspan="${domain.entries.length}" style="font-weight:600;background:#e0e7ff">${domain.name}</td>`;
      html += `<td class="row-header">${entry.system_name}</td>`;
      html += `<td class="row-header"><span class="text-[10px] text-gray-500">${entry.category_name}</span><br>${entry.item_name}</td>`;

      let annual = 0;
      for (let m = 1; m <= 12; m++) {
        const val = entry.months[m] ? entry.months[m][amountType] || 0 : 0;
        annual += val;
        domTotal[m - 1] += val;
        grandTotal[m - 1] += val;

        if (amountType === 'revised_plan' || amountType === 'forecast' || amountType === 'actual') {
          html += `<td class="${cellCls[amountType]}">
            <input type="number" value="${val}" onchange="onCellEdit(this, ${state.fiscalYearId}, ${entry.system_id}, ${entry.item_id}, ${m}, '${amountType}')" />
          </td>`;
        } else {
          html += `<td class="${cellCls[amountType]}">${fmt(val)}</td>`;
        }
      }
      html += `<td style="background:#dbeafe;font-weight:600">${fmt(annual)}</td></tr>`;
    });

    // Domain subtotal
    html += `<tr class="subtotal-row"><td colspan="3" class="row-header" style="background:#e2e8f0;font-weight:600">${domain.name} 小計</td>`;
    let domAnnual = 0;
    for (let m = 0; m < 12; m++) { domAnnual += domTotal[m]; html += `<td>${fmt(domTotal[m])}</td>`; }
    html += `<td style="font-weight:700">${fmt(domAnnual)}</td></tr>`;
  });

  // Grand total
  html += `<tr class="total-row"><td colspan="3" class="row-header" style="background:#1e40af;color:white;font-weight:700">全体合計</td>`;
  let grandAnnual = 0;
  for (let m = 0; m < 12; m++) { grandAnnual += grandTotal[m]; html += `<td>${fmt(grandTotal[m])}</td>`; }
  html += `<td>${fmt(grandAnnual)}</td></tr>`;

  html += '</tbody></table>';
  container.innerHTML = html;
}

async function onCellEdit(input, fyId, systemId, itemId, month, field) {
  try {
    await api('/budgets/upsert', {
      method: 'POST',
      body: { fiscal_year_id: fyId, system_id: systemId, expense_item_id: itemId, month: month, field: field, value: parseFloat(input.value) || 0 }
    });
    input.style.borderColor = '#22c55e';
    setTimeout(() => { input.style.borderColor = '#d1d5db'; }, 1000);
  } catch (e) {
    showToast('保存エラー: ' + e.message, 'error');
    input.style.borderColor = '#ef4444';
  }
}

function exportBudgetCSV() {
  const table = document.querySelector('.budget-table');
  if (!table) { showToast('テーブルがありません', 'warning'); return; }
  let csv = '\uFEFF';
  table.querySelectorAll('tr').forEach(row => {
    const cells = [];
    row.querySelectorAll('th, td').forEach(cell => {
      let val = cell.querySelector('input') ? cell.querySelector('input').value : cell.textContent.trim();
      cells.push('"' + val.replace(/"/g, '""') + '"');
    });
    csv += cells.join(',') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `budget_data_FY${state.fiscalYearId}.csv`;
  a.click();
  showToast('CSVをダウンロードしました');
}

function showCSVImportModal() {
  showModal(`
    <div class="p-6">
      <h3 class="text-base font-bold mb-4"><i class="fas fa-upload mr-2 text-blue-500"></i>CSV取込</h3>
      <p class="text-[12px] text-gray-500 mb-3">CSVフォーマット: system_id, expense_item_id, month, field(initial_plan/revised_plan/forecast/actual), value</p>
      <textarea id="csvImportArea" class="w-full h-40 border rounded-lg p-3 text-[12px] font-mono" placeholder="1,1,1,revised_plan,2500&#10;1,1,2,revised_plan,2500"></textarea>
      <div class="flex justify-end gap-2 mt-4">
        <button onclick="closeModal()" class="btn-secondary">キャンセル</button>
        <button onclick="importCSV()" class="btn-primary">インポート</button>
      </div>
    </div>`);
}

async function importCSV() {
  const text = document.getElementById('csvImportArea')?.value;
  if (!text) { showToast('CSVデータを入力してください', 'warning'); return; }
  const lines = text.trim().split('\n').filter(l => l.trim());
  const records = lines.map(line => {
    const [system_id, expense_item_id, month, field, value] = line.split(',').map(s => s.trim());
    return { fiscal_year_id: state.fiscalYearId, system_id: parseInt(system_id), expense_item_id: parseInt(expense_item_id), month: parseInt(month), [field]: parseFloat(value) };
  });
  try {
    await api('/budgets/bulk-upsert', { method: 'POST', body: { records } });
    closeModal();
    showToast(`${records.length}件をインポートしました`);
    loadBudgetMatrix();
  } catch (e) { showToast('インポートエラー: ' + e.message, 'error'); }
}

// === Analysis ===
async function renderAnalysis() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = `
    <div class="fade-in space-y-4">
      <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-chart-column mr-2 text-blue-600"></i>予実差異分析</h2>
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex border rounded-lg overflow-hidden">
            <button onclick="loadAnalysis('system')" id="tabSystem" class="tab-btn active">システム別</button>
            <button onclick="loadAnalysis('category')" id="tabCategory" class="tab-btn">カテゴリ別</button>
            <button onclick="loadAnalysis('domain')" id="tabDomain" class="tab-btn">ドメイン別</button>
            <button onclick="loadAnalysis('item')" id="tabItem" class="tab-btn">費目別</button>
          </div>
          <div class="flex border rounded-lg overflow-hidden ml-auto">
            <button onclick="loadPeriodAnalysis('quarter')" id="tabQuarter" class="tab-btn">四半期</button>
            <button onclick="loadPeriodAnalysis('half')" id="tabHalf" class="tab-btn">半期</button>
          </div>
        </div>
        <div id="analysisContent">
          <p class="text-gray-400 text-sm p-4">読み込み中...</p>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3">差異分析チャート</h3>
          <div style="height:300px"><canvas id="varianceChart"></canvas></div>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3" id="periodChartTitle">四半期推移</h3>
          <div style="height:300px"><canvas id="periodChart"></canvas></div>
        </div>
      </div>
    </div>`;
  await loadAnalysis('system');
  await loadPeriodAnalysis('quarter');
}

async function loadAnalysis(groupBy) {
  document.querySelectorAll('#tabSystem,#tabCategory,#tabDomain,#tabItem').forEach(b => b.classList.remove('active'));
  document.getElementById('tab' + groupBy.charAt(0).toUpperCase() + groupBy.slice(1))?.classList.add('active');

  const container = document.getElementById('analysisContent');
  const result = await api(`/analysis/variance?group_by=${groupBy}`);
  const rows = result.data || [];

  let html = '<div class="overflow-auto"><table class="budget-table w-full"><thead><tr>';
  if (groupBy === 'system' || groupBy === 'item') html += '<th class="row-header">親</th>';
  html += '<th class="row-header">名称</th><th>当初計画</th><th>修正計画</th><th>着地見込</th><th>実績</th>';
  html += '<th>計画vs実績</th><th>差異率</th><th>見込vs計画</th><th>消化率</th></tr></thead><tbody>';

  let totals = { initial_plan: 0, revised_plan: 0, forecast: 0, actual: 0 };
  rows.forEach(r => {
    totals.initial_plan += r.initial_plan;
    totals.revised_plan += r.revised_plan;
    totals.forecast += r.forecast;
    totals.actual += r.actual;

    html += '<tr class="hover:bg-gray-50">';
    if (groupBy === 'system' || groupBy === 'item') html += `<td class="row-header text-[11px] text-gray-500">${r.parent_name || ''}</td>`;
    html += `<td class="row-header">${r.group_name}</td>`;
    html += `<td>${fmt(r.initial_plan)}</td><td>${fmt(r.revised_plan)}</td>`;
    html += `<td>${fmt(r.forecast)}</td><td class="actual-cell">${fmt(r.actual)}</td>`;
    html += `<td class="${r.planVsActual < 0 ? 'negative' : ''}">${fmt(r.planVsActual)}</td>`;
    html += `<td class="${colorByVariance(Math.abs(r.planVsActualRate))}">${r.planVsActualRate > 0 ? '+' : ''}${fmtPct(r.planVsActualRate)}</td>`;
    html += `<td class="${r.forecastVsPlan > 0 ? 'negative' : 'positive'}">${r.forecastVsPlan > 0 ? '+' : ''}${fmt(r.forecastVsPlan)}</td>`;
    html += `<td><div class="flex items-center gap-1"><div class="w-16 bg-gray-100 rounded-full h-1.5"><div class="h-1.5 rounded-full ${colorByUsage(r.consumptionRate)}" style="width:${Math.min(r.consumptionRate, 100)}%"></div></div><span class="text-[10px]">${fmtPct(r.consumptionRate)}</span></div></td>`;
    html += '</tr>';
  });

  // Total row
  const totalVR = totals.revised_plan > 0 ? ((totals.actual - totals.revised_plan) / totals.revised_plan * 100) : 0;
  const totalCR = totals.revised_plan > 0 ? (totals.actual / totals.revised_plan * 100) : 0;
  html += `<tr class="total-row"><td colspan="${groupBy === 'system' || groupBy === 'item' ? 2 : 1}" class="row-header" style="background:#1e40af;color:white">合計</td>`;
  html += `<td>${fmt(totals.initial_plan)}</td><td>${fmt(totals.revised_plan)}</td><td>${fmt(totals.forecast)}</td><td>${fmt(totals.actual)}</td>`;
  html += `<td>${fmt(totals.revised_plan - totals.actual)}</td><td>${totalVR > 0 ? '+' : ''}${fmtPct(totalVR)}</td>`;
  html += `<td>${fmt(totals.forecast - totals.revised_plan)}</td><td>${fmtPct(totalCR)}</td></tr>`;

  html += '</tbody></table></div>';
  container.innerHTML = html;

  // Variance chart
  if (state.charts.variance) state.charts.variance.destroy();
  const chartRows = rows.filter(r => r.revised_plan > 0).slice(0, 10);
  state.charts.variance = new Chart(document.getElementById('varianceChart'), {
    type: 'bar',
    data: {
      labels: chartRows.map(r => r.group_name.substring(0, 8)),
      datasets: [
        { label: '修正計画', data: chartRows.map(r => r.revised_plan), backgroundColor: 'rgba(59,130,246,0.3)', borderColor: '#3b82f6', borderWidth: 1 },
        { label: '着地見込', data: chartRows.map(r => r.forecast), backgroundColor: 'rgba(168,85,247,0.3)', borderColor: '#a855f7', borderWidth: 1 },
        { label: '実績', data: chartRows.map(r => r.actual), backgroundColor: 'rgba(34,197,94,0.5)', borderColor: '#22c55e', borderWidth: 1 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', scales: { x: { ticks: { callback: v => fmt(v) } } }, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
  });
}

async function loadPeriodAnalysis(period) {
  document.querySelectorAll('#tabQuarter,#tabHalf').forEach(b => b.classList.remove('active'));
  document.getElementById('tab' + (period === 'quarter' ? 'Quarter' : 'Half'))?.classList.add('active');
  document.getElementById('periodChartTitle').textContent = period === 'quarter' ? '四半期推移' : '半期推移';

  const result = await api(`/analysis/period?period=${period}`);
  const data = result.data || [];

  if (state.charts.period) state.charts.period.destroy();
  state.charts.period = new Chart(document.getElementById('periodChart'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.period_label),
      datasets: [
        { label: '修正計画', data: data.map(d => d.revised_plan), backgroundColor: 'rgba(59,130,246,0.3)', borderColor: '#3b82f6', borderWidth: 1 },
        { label: '着地見込', data: data.map(d => d.forecast), backgroundColor: 'rgba(168,85,247,0.3)', borderColor: '#a855f7', borderWidth: 1 },
        { label: '実績', data: data.map(d => d.actual), backgroundColor: 'rgba(34,197,94,0.5)', borderColor: '#22c55e', borderWidth: 1 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: v => fmt(v) } } }, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
  });
}

// === Multi-Year Comparison ===
async function renderMultiYear() {
  const mc = document.getElementById('mainContent');
  const [multiYear, systemTree] = await Promise.all([
    api('/dashboard/multi-year'),
    api('/master/systems/tree')
  ]);
  const data = multiYear.data || [];

  let systemOpts = '<option value="">全体</option>';
  (systemTree.tree || []).forEach(d => {
    (d.systems || []).forEach(s => { systemOpts += `<option value="${s.id}">${s.name}</option>`; });
  });

  mc.innerHTML = `
    <div class="fade-in space-y-4">
      <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-calendar-days mr-2 text-blue-600"></i>中期比較 (FY65-FY70)</h2>
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <div class="flex items-center gap-3 mb-4">
          <label class="text-[12px] text-gray-500">システム絞り込み:</label>
          <select id="multiYearSystem" onchange="loadMultiYearChart()" class="border rounded-md px-2 py-1 text-[12px]">${systemOpts}</select>
        </div>
        <div class="overflow-auto">
          <table class="budget-table w-full">
            <thead><tr><th class="row-header">年度</th><th>当初計画</th><th>修正計画</th><th>着地見込</th><th>実績</th><th>計画vs見込</th></tr></thead>
            <tbody>
              ${data.map(d => {
                const diff = d.forecast - d.revised_plan;
                const rate = d.revised_plan > 0 ? ((d.forecast - d.revised_plan) / d.revised_plan * 100) : 0;
                return `<tr class="hover:bg-gray-50">
                  <td class="row-header font-semibold">${d.code}</td>
                  <td>${fmt(d.initial_plan)}</td><td>${fmt(d.revised_plan)}</td>
                  <td>${fmt(d.forecast)}</td><td class="actual-cell">${fmt(d.actual)}</td>
                  <td class="${rate > 0 ? 'negative' : rate < 0 ? 'positive' : ''}">${diff > 0 ? '+' : ''}${fmt(diff)} (${rate > 0 ? '+' : ''}${rate.toFixed(1)}%)</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3">中期推移チャート</h3>
        <div style="height:320px"><canvas id="multiYearChart"></canvas></div>
      </div>
    </div>`;

  state.charts.multiYear = new Chart(document.getElementById('multiYearChart'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.code),
      datasets: [
        { label: '当初計画', data: data.map(d => d.initial_plan), backgroundColor: 'rgba(148,163,184,0.3)', borderColor: '#94a3b8', borderWidth: 1 },
        { label: '修正計画', data: data.map(d => d.revised_plan), backgroundColor: 'rgba(59,130,246,0.3)', borderColor: '#3b82f6', borderWidth: 1 },
        { label: '着地見込', data: data.map(d => d.forecast), type: 'line', borderColor: '#a855f7', borderWidth: 2, pointRadius: 4, fill: false },
        { label: '実績', data: data.map(d => d.actual), backgroundColor: 'rgba(34,197,94,0.5)', borderColor: '#22c55e', borderWidth: 1 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: v => fmt(v) } } }, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
  });
}

async function loadMultiYearChart() {
  const systemId = document.getElementById('multiYearSystem')?.value;
  let url = '/analysis/cross-year';
  if (systemId) url += '?system_id=' + systemId;
  const result = await api(url);
  const data = result.data || [];

  if (state.charts.multiYear) state.charts.multiYear.destroy();
  state.charts.multiYear = new Chart(document.getElementById('multiYearChart'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.code),
      datasets: [
        { label: '当初計画', data: data.map(d => d.initial_plan), backgroundColor: 'rgba(148,163,184,0.3)', borderColor: '#94a3b8', borderWidth: 1 },
        { label: '修正計画', data: data.map(d => d.revised_plan), backgroundColor: 'rgba(59,130,246,0.3)', borderColor: '#3b82f6', borderWidth: 1 },
        { label: '着地見込', data: data.map(d => d.forecast), type: 'line', borderColor: '#a855f7', borderWidth: 2, pointRadius: 4, fill: false },
        { label: '実績', data: data.map(d => d.actual), backgroundColor: 'rgba(34,197,94,0.5)', borderColor: '#22c55e', borderWidth: 1 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: v => fmt(v) } } }, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
  });
}

// === Reports ===
async function renderReports() {
  const mc = document.getElementById('mainContent');
  const [domSummary, sysSummary, catSummary] = await Promise.all([
    api('/reports/department-summary'),
    api('/reports/system-summary'),
    api('/reports/category-summary')
  ]);

  mc.innerHTML = `
    <div class="fade-in space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-file-export mr-2 text-blue-600"></i>レポート出力</h2>
        <div class="flex gap-2">
          <button onclick="exportExcel()" class="btn-primary text-[12px]"><i class="fas fa-file-excel mr-1"></i>Excel出力</button>
          <button onclick="exportPDF()" class="btn-secondary text-[12px]"><i class="fas fa-file-pdf mr-1"></i>PDF出力</button>
          <button onclick="window.print()" class="btn-secondary text-[12px]"><i class="fas fa-print mr-1"></i>印刷</button>
        </div>
      </div>

      <!-- Domain Summary -->
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3">ドメイン別サマリ</h3>
        <table class="budget-table w-full">
          <thead><tr><th class="row-header">ドメイン</th><th>当初計画</th><th>修正計画</th><th>着地見込</th><th>実績</th><th>残額</th><th>消化率</th></tr></thead>
          <tbody>
            ${(domSummary.data || []).map(d => {
              const rem = d.revised_plan - d.actual;
              const cr = d.revised_plan > 0 ? (d.actual / d.revised_plan * 100) : 0;
              return `<tr><td class="row-header">${d.name}</td><td>${fmt(d.initial_plan)}</td><td>${fmt(d.revised_plan)}</td>
                <td>${fmt(d.forecast)}</td><td>${fmt(d.actual)}</td>
                <td class="${rem < 0 ? 'negative' : ''}">${fmt(rem)}</td><td>${fmtPct(cr)}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- System Summary -->
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3">システム別サマリ</h3>
        <table class="budget-table w-full">
          <thead><tr><th class="row-header">ドメイン</th><th class="row-header">システム</th><th>当初計画</th><th>修正計画</th><th>着地見込</th><th>実績</th><th>見込差異率</th></tr></thead>
          <tbody>
            ${(sysSummary.data || []).map(s => `<tr>
              <td class="row-header text-[11px] text-gray-500">${s.domain_name}</td>
              <td class="row-header">${s.name}</td>
              <td>${fmt(s.initial_plan)}</td><td>${fmt(s.revised_plan)}</td>
              <td>${fmt(s.forecast)}</td><td>${fmt(s.actual)}</td>
              <td class="${colorByVariance(s.variance_rate)}">${s.variance_rate > 0 ? '+' : ''}${fmtPct(s.variance_rate)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- Category Summary -->
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3">費用カテゴリ別サマリ</h3>
        <table class="budget-table w-full">
          <thead><tr><th class="row-header">カテゴリ</th><th>当初計画</th><th>修正計画</th><th>着地見込</th><th>実績</th></tr></thead>
          <tbody>
            ${(catSummary.data || []).map(c => `<tr>
              <td class="row-header">${c.name}</td>
              <td>${fmt(c.initial_plan)}</td><td>${fmt(c.revised_plan)}</td>
              <td>${fmt(c.forecast)}</td><td>${fmt(c.actual)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function exportExcel() {
  const tables = document.querySelectorAll('.budget-table');
  let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
  xml += '<Styles><Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/></Style>';
  xml += '<Style ss:ID="num"><NumberFormat ss:Format="#,##0"/></Style></Styles>';

  tables.forEach((table, i) => {
    const title = table.closest('.bg-white')?.querySelector('h3')?.textContent || `Sheet${i+1}`;
    xml += `<Worksheet ss:Name="${title.substring(0,31)}"><Table>`;
    table.querySelectorAll('tr').forEach(row => {
      xml += '<Row>';
      row.querySelectorAll('th, td').forEach(cell => {
        const val = cell.querySelector('input') ? cell.querySelector('input').value : cell.textContent.trim().replace(/,/g, '');
        const isNum = !isNaN(val) && val !== '';
        const style = cell.tagName === 'TH' ? ' ss:StyleID="header"' : (isNum ? ' ss:StyleID="num"' : '');
        xml += `<Cell${style}><Data ss:Type="${isNum ? 'Number' : 'String'}">${val}</Data></Cell>`;
      });
      xml += '</Row>';
    });
    xml += '</Table></Worksheet>';
  });
  xml += '</Workbook>';

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `budget_report_FY${state.fiscalYearId}.xls`;
  a.click();
  showToast('Excelファイルを出力しました');
}

function exportPDF() {
  window.print();
  showToast('印刷ダイアログを開きました（PDF保存可能）', 'info');
}

// === Master Systems ===
async function renderMasterSystems() {
  const mc = document.getElementById('mainContent');
  const systemTree = await api('/master/systems/tree');

  mc.innerHTML = `
    <div class="fade-in space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-server mr-2 text-blue-600"></i>システム管理</h2>
        <button onclick="showAddSystemModal()" class="btn-primary text-[12px]"><i class="fas fa-plus mr-1"></i>新規追加</button>
      </div>
      ${(systemTree.tree || []).map(domain => `
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3">
            <span class="badge bg-blue-100 text-blue-700 mr-2">${domain.code}</span>${domain.name}
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            ${(domain.systems || []).map(s => `
              <div class="border border-gray-100 rounded-lg p-3 hover:border-blue-200 transition-colors">
                <div class="flex items-start justify-between">
                  <div>
                    <p class="text-[13px] font-semibold text-gray-800">${s.name}</p>
                    <p class="text-[11px] text-gray-400">${s.code}</p>
                    ${s.description ? `<p class="text-[11px] text-gray-500 mt-1">${s.description}</p>` : ''}
                  </div>
                  <span class="badge ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${s.is_active ? '有効' : '無効'}</span>
                </div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}

function showAddSystemModal() {
  showModal(`
    <div class="p-6">
      <h3 class="text-base font-bold mb-4">システム追加</h3>
      <div class="space-y-3">
        <div><label class="text-[12px] text-gray-500 block mb-1">ドメイン</label>
          <select id="newSysDomain" class="w-full border rounded-lg px-3 py-2 text-[13px]">
            ${state.domains.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
          </select></div>
        <div><label class="text-[12px] text-gray-500 block mb-1">コード</label>
          <input id="newSysCode" class="w-full border rounded-lg px-3 py-2 text-[13px]" placeholder="例: CORE-NEW"></div>
        <div><label class="text-[12px] text-gray-500 block mb-1">名称</label>
          <input id="newSysName" class="w-full border rounded-lg px-3 py-2 text-[13px]" placeholder="例: 新システム"></div>
        <div><label class="text-[12px] text-gray-500 block mb-1">説明</label>
          <input id="newSysDesc" class="w-full border rounded-lg px-3 py-2 text-[13px]" placeholder="概要"></div>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button onclick="closeModal()" class="btn-secondary">キャンセル</button>
        <button onclick="addSystem()" class="btn-primary">追加</button>
      </div>
    </div>`);
}

async function addSystem() {
  try {
    await api('/master/systems', { method: 'POST', body: {
      domain_id: parseInt(document.getElementById('newSysDomain').value),
      code: document.getElementById('newSysCode').value,
      name: document.getElementById('newSysName').value,
      description: document.getElementById('newSysDesc').value
    }});
    closeModal();
    showToast('システムを追加しました');
    renderMasterSystems();
  } catch (e) { showToast(e.message, 'error'); }
}

// === Master Expenses ===
async function renderMasterExpenses() {
  const mc = document.getElementById('mainContent');
  const itemTree = await api('/master/expense-items/tree');

  mc.innerHTML = `
    <div class="fade-in space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-tags mr-2 text-blue-600"></i>費目管理</h2>
        <button onclick="showAddItemModal()" class="btn-primary text-[12px]"><i class="fas fa-plus mr-1"></i>新規追加</button>
      </div>
      ${(itemTree.tree || []).map(cat => `
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3">
            <span class="badge bg-purple-100 text-purple-700 mr-2">${cat.code}</span>${cat.name}
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            ${(cat.items || []).map(item => `
              <div class="border border-gray-100 rounded-lg p-3 hover:border-purple-200 transition-colors">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-[13px] font-semibold text-gray-800">${item.name}</p>
                    <p class="text-[11px] text-gray-400">${item.code}</p>
                  </div>
                  <span class="badge ${item.is_taxable ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}">${item.is_taxable ? '課税' : '非課税'}</span>
                </div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}

function showAddItemModal() {
  showModal(`
    <div class="p-6">
      <h3 class="text-base font-bold mb-4">費目追加</h3>
      <div class="space-y-3">
        <div><label class="text-[12px] text-gray-500 block mb-1">カテゴリ</label>
          <select id="newItemCat" class="w-full border rounded-lg px-3 py-2 text-[13px]">
            ${state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select></div>
        <div><label class="text-[12px] text-gray-500 block mb-1">コード</label>
          <input id="newItemCode" class="w-full border rounded-lg px-3 py-2 text-[13px]" placeholder="例: HW-NEW"></div>
        <div><label class="text-[12px] text-gray-500 block mb-1">名称</label>
          <input id="newItemName" class="w-full border rounded-lg px-3 py-2 text-[13px]" placeholder="例: 新費目"></div>
        <div><label class="text-[12px] text-gray-500 block mb-1">課税</label>
          <select id="newItemTax" class="w-full border rounded-lg px-3 py-2 text-[13px]">
            <option value="1">課税</option><option value="0">非課税</option>
          </select></div>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button onclick="closeModal()" class="btn-secondary">キャンセル</button>
        <button onclick="addItem()" class="btn-primary">追加</button>
      </div>
    </div>`);
}

async function addItem() {
  try {
    await api('/master/expense-items', { method: 'POST', body: {
      category_id: parseInt(document.getElementById('newItemCat').value),
      code: document.getElementById('newItemCode').value,
      name: document.getElementById('newItemName').value,
      is_taxable: parseInt(document.getElementById('newItemTax').value)
    }});
    closeModal();
    showToast('費目を追加しました');
    renderMasterExpenses();
  } catch (e) { showToast(e.message, 'error'); }
}

// === Comments ===
async function renderComments() {
  const mc = document.getElementById('mainContent');
  const result = await api('/comments');
  const comments = result.comments || [];

  mc.innerHTML = `
    <div class="fade-in space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-800"><i class="fas fa-comments mr-2 text-blue-600"></i>差異コメント</h2>
        <button onclick="showAddCommentModal()" class="btn-primary text-[12px]"><i class="fas fa-plus mr-1"></i>新規追加</button>
      </div>
      <div class="space-y-3">
        ${comments.length === 0 ? '<p class="text-gray-400 text-sm p-4 text-center">コメントがありません</p>' : ''}
        ${comments.map(c => {
          const typeColors = { variance: 'bg-red-100 text-red-700', note: 'bg-blue-100 text-blue-700', action: 'bg-green-100 text-green-700', risk: 'bg-yellow-100 text-yellow-700' };
          const typeLabels = { variance: '差異説明', note: '備考', action: 'アクション', risk: 'リスク' };
          const periodLabels = { annual: '年間', half: '半期', quarter: '四半期', month: '月次' };
          return `
          <div class="bg-white rounded-xl border border-gray-100 p-4">
            <div class="flex items-start justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="badge ${typeColors[c.comment_type] || 'bg-gray-100 text-gray-700'}">${typeLabels[c.comment_type] || c.comment_type}</span>
                <span class="text-[11px] text-gray-400">${periodLabels[c.period_type] || c.period_type}${c.period_value ? ' ' + c.period_value : ''}</span>
                ${c.system_name ? `<span class="text-[11px] text-gray-500">| ${c.system_name}</span>` : ''}
                ${c.item_name ? `<span class="text-[11px] text-gray-500">| ${c.item_name}</span>` : ''}
              </div>
              <button onclick="deleteComment(${c.id})" class="text-gray-300 hover:text-red-500 text-xs"><i class="fas fa-trash"></i></button>
            </div>
            <p class="text-[13px] text-gray-700 leading-relaxed">${c.content}</p>
            <p class="text-[10px] text-gray-400 mt-2">${c.created_by_name || ''} | ${c.created_at || ''}</p>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function showAddCommentModal() {
  showModal(`
    <div class="p-6">
      <h3 class="text-base font-bold mb-4">コメント追加</h3>
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-[12px] text-gray-500 block mb-1">種別</label>
            <select id="newComType" class="w-full border rounded-lg px-3 py-2 text-[13px]">
              <option value="variance">差異説明</option><option value="note">備考</option>
              <option value="action">アクション</option><option value="risk">リスク</option>
            </select></div>
          <div><label class="text-[12px] text-gray-500 block mb-1">期間</label>
            <select id="newComPeriod" class="w-full border rounded-lg px-3 py-2 text-[13px]">
              <option value="annual">年間</option><option value="half">半期</option>
              <option value="quarter">四半期</option><option value="month">月次</option>
            </select></div>
        </div>
        <div><label class="text-[12px] text-gray-500 block mb-1">システム（任意）</label>
          <select id="newComSystem" class="w-full border rounded-lg px-3 py-2 text-[13px]">
            <option value="">全体</option>
            ${state.systems.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select></div>
        <div><label class="text-[12px] text-gray-500 block mb-1">コメント内容</label>
          <textarea id="newComContent" class="w-full border rounded-lg px-3 py-2 text-[13px] h-24" placeholder="差異の理由や対応策を記載"></textarea></div>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button onclick="closeModal()" class="btn-secondary">キャンセル</button>
        <button onclick="addComment()" class="btn-primary">追加</button>
      </div>
    </div>`);
}

async function addComment() {
  try {
    await api('/comments', { method: 'POST', body: {
      fiscal_year_id: state.fiscalYearId,
      system_id: document.getElementById('newComSystem').value || null,
      period_type: document.getElementById('newComPeriod').value,
      comment_type: document.getElementById('newComType').value,
      content: document.getElementById('newComContent').value
    }});
    closeModal();
    showToast('コメントを追加しました');
    renderComments();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteComment(id) {
  if (!confirm('このコメントを削除しますか？')) return;
  try {
    await api(`/comments/${id}`, { method: 'DELETE' });
    showToast('コメントを削除しました');
    renderComments();
  } catch (e) { showToast(e.message, 'error'); }
}

// === Initialization ===
async function initApp() {
  try {
    const [fyData, domData, sysData, catData, itemData] = await Promise.all([
      fetch('/api/master/fiscal-years').then(r => r.json()),
      fetch('/api/master/domains').then(r => r.json()),
      fetch('/api/master/systems').then(r => r.json()),
      fetch('/api/master/expense-categories').then(r => r.json()),
      fetch('/api/master/expense-items').then(r => r.json())
    ]);

    state.fiscalYears = fyData.fiscalYears || [];
    state.domains = domData.domains || [];
    state.systems = sysData.systems || [];
    state.categories = catData.categories || [];
    state.items = itemData.items || [];

    const sel = document.getElementById('fiscalYearSelect');
    sel.innerHTML = state.fiscalYears.map(fy =>
      `<option value="${fy.id}" ${fy.is_active ? 'selected' : ''}>${fy.code} ${fy.name}</option>`
    ).join('');

    const active = state.fiscalYears.find(fy => fy.is_active);
    if (active) state.fiscalYearId = active.id;

    navigateTo('dashboard');
  } catch (e) {
    console.error('Init error:', e);
    document.getElementById('mainContent').innerHTML = `<div class="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700"><i class="fas fa-exclamation-triangle mr-2"></i>初期化エラー: ${e.message}</div>`;
  }
}

function onFiscalYearChange() {
  state.fiscalYearId = parseInt(document.getElementById('fiscalYearSelect').value);
  renderPage(state.currentPage);
}
function refreshData() { renderPage(state.currentPage); }

// Start
document.addEventListener('DOMContentLoaded', initApp);
