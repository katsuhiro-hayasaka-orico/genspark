// =============================================
// IT Budget Dashboard - Main Application
// =============================================

// === State Management ===
const state = {
  currentPage: 'dashboard',
  fiscalYearId: 1,
  fiscalYears: [],
  categories: [],
  departments: [],
  projects: [],
  charts: {}
};

// === Utility Functions ===
function fmt(n) {
  if (n === null || n === undefined) return '¥0';
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}
function fmtM(n) {
  if (n === null || n === undefined) return '0';
  return (n / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 0 });
}
function fmtPct(n) { return (n || 0).toFixed(1) + '%'; }
function monthName(m) { return ['4月','5月','6月','7月','8月','9月','10月','11月','12月','1月','2月','3月'][m - 1] || m + '月'; }
function monthLabel(m) { return monthName(m); }

async function api(path, opts = {}) {
  const url = '/api' + path + (path.includes('?') ? '&' : '?') + 'fiscal_year_id=' + state.fiscalYearId;
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'エラーが発生しました' }));
    throw new Error(err.error || 'API Error: ' + res.status);
  }
  return res.json();
}

function showToast(msg, type = 'success') {
  const tc = document.getElementById('toastContainer');
  const colors = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500' };
  const icons = { success: 'check-circle', error: 'exclamation-circle', warning: 'exclamation-triangle', info: 'info-circle' };
  const el = document.createElement('div');
  el.className = `${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 fade-in text-sm`;
  el.innerHTML = `<i class="fas fa-${icons[type]}"></i><span>${msg}</span>`;
  tc.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

function showModal(content) {
  const mc = document.getElementById('modalContainer');
  mc.innerHTML = `<div class="modal-overlay fixed inset-0 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()">
    <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto fade-in">${content}</div>
  </div>`;
  mc.classList.remove('hidden');
}
function closeModal() { document.getElementById('modalContainer').classList.add('hidden'); }

function getAlertColor(rate) {
  if (rate >= 95) return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-500' };
  if (rate >= 80) return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', badge: 'bg-yellow-500' };
  return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', badge: 'bg-green-500' };
}

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
    dashboard: 'ダッシュボード', budgets: '予算管理', actuals: '実績入力',
    committed: 'コミット管理', analysis: '予実分析', reports: 'レポート出力',
    categories: 'カテゴリ管理', departments: '部門管理', projects: 'プロジェクト管理'
  };
  document.getElementById('breadcrumb').innerHTML =
    `<span class="text-gray-400">ホーム</span><i class="fas fa-chevron-right text-xs mx-2 text-gray-300"></i><span class="text-gray-700 font-medium">${labels[page] || page}</span>`;
  
  // Close mobile sidebar
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('sidebarOverlay').classList.add('hidden');
  
  renderPage(page);
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.toggle('-translate-x-full');
  ov.classList.toggle('hidden');
}

async function onFiscalYearChange() {
  state.fiscalYearId = parseInt(document.getElementById('fiscalYearSelect').value);
  refreshData();
}

async function refreshData() {
  renderPage(state.currentPage);
}

async function renderPage(page) {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="flex items-center justify-center h-64"><i class="fas fa-spinner fa-spin text-3xl text-blue-500"></i></div>';
  try {
    switch (page) {
      case 'dashboard': await renderDashboard(main); break;
      case 'budgets': await renderBudgets(main); break;
      case 'actuals': await renderActuals(main); break;
      case 'committed': await renderCommitted(main); break;
      case 'analysis': await renderAnalysis(main); break;
      case 'reports': await renderReports(main); break;
      case 'categories': await renderCategories(main); break;
      case 'departments': await renderDepartments(main); break;
      case 'projects': await renderProjects(main); break;
      default: main.innerHTML = '<p>ページが見つかりません</p>';
    }
  } catch (e) {
    main.innerHTML = `<div class="text-center py-12"><i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i><p class="text-red-600">${e.message}</p><button onclick="refreshData()" class="btn-primary mt-4">再試行</button></div>`;
    console.error(e);
  }
}

// === Dashboard Page ===
async function renderDashboard(main) {
  const [summary, alerts, trends] = await Promise.all([
    api('/dashboard/summary'),
    api('/dashboard/alerts'),
    api('/dashboard/trends')
  ]);

  const k = summary.kpi;
  const alertLevel = k.consumptionRate >= 95 ? 'danger' : k.consumptionRate >= 80 ? 'warning' : 'success';
  const alertColors = { danger: 'from-red-500 to-red-600', warning: 'from-yellow-500 to-yellow-600', success: 'from-green-500 to-green-600' };

  main.innerHTML = `
    <div class="fade-in space-y-6">
      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm text-gray-500">年間予算総額</span>
            <div class="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <i class="fas fa-wallet text-blue-500"></i>
            </div>
          </div>
          <p class="text-2xl font-bold text-gray-800">${fmtM(k.totalBudget)}<span class="text-sm font-normal text-gray-400 ml-1">万円</span></p>
          <p class="text-xs text-gray-400 mt-1">${summary.fiscalYear?.name || ''}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm text-gray-500">年累計実績</span>
            <div class="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <i class="fas fa-receipt text-indigo-500"></i>
            </div>
          </div>
          <p class="text-2xl font-bold text-gray-800">${fmtM(k.totalActual)}<span class="text-sm font-normal text-gray-400 ml-1">万円</span></p>
          <p class="text-xs text-gray-400 mt-1">コミット: ${fmtM(k.totalCommitted)}万円</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm text-gray-500">予算消化率</span>
            <div class="w-10 h-10 ${k.consumptionRate >= 95 ? 'bg-red-50' : k.consumptionRate >= 80 ? 'bg-yellow-50' : 'bg-green-50'} rounded-lg flex items-center justify-center">
              <i class="fas fa-chart-pie ${k.consumptionRate >= 95 ? 'text-red-500' : k.consumptionRate >= 80 ? 'text-yellow-500' : 'text-green-500'}"></i>
            </div>
          </div>
          <p class="text-2xl font-bold text-gray-800">${fmtPct(k.consumptionRate)}</p>
          <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div class="h-2 rounded-full progress-bar ${k.consumptionRate >= 95 ? 'bg-red-500' : k.consumptionRate >= 80 ? 'bg-yellow-500' : 'bg-blue-500'}" style="width:${Math.min(k.consumptionRate, 100)}%"></div>
          </div>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100 card-hover">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm text-gray-500">残予算</span>
            <div class="w-10 h-10 ${k.remaining < 0 ? 'bg-red-50' : 'bg-emerald-50'} rounded-lg flex items-center justify-center">
              <i class="fas fa-piggy-bank ${k.remaining < 0 ? 'text-red-500' : 'text-emerald-500'}"></i>
            </div>
          </div>
          <p class="text-2xl font-bold ${k.remaining < 0 ? 'text-red-600' : 'text-gray-800'}">${fmtM(k.remaining)}<span class="text-sm font-normal text-gray-400 ml-1">万円</span></p>
          <p class="text-xs text-gray-400 mt-1">着地見込: ${fmtM(k.forecastTotal)}万円</p>
        </div>
      </div>

      <!-- Alerts -->
      ${alerts.alerts?.length ? `
      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 class="text-sm font-semibold text-gray-700 mb-3"><i class="fas fa-bell text-yellow-500 mr-2"></i>予算超過アラート</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          ${alerts.alerts.map(a => {
            const c = getAlertColor(a.usage_rate);
            return `<div class="${c.bg} ${c.border} border rounded-lg p-3 flex items-center justify-between">
              <div>
                <p class="text-sm font-medium ${c.text}">${a.category_name}</p>
                <p class="text-xs text-gray-500">実績+コミット: ${fmtM(a.actual + a.committed)}万円 / ${fmtM(a.budget)}万円</p>
              </div>
              <span class="${c.badge} text-white text-xs font-bold px-2 py-1 rounded-full">${a.usage_rate}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Monthly Budget vs Actual -->
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 class="text-sm font-semibold text-gray-700 mb-4"><i class="fas fa-chart-bar text-blue-500 mr-2"></i>月別予実比較</h3>
          <div style="height:300px"><canvas id="monthlyChart"></canvas></div>
        </div>
        <!-- Category Breakdown -->
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 class="text-sm font-semibold text-gray-700 mb-4"><i class="fas fa-chart-pie text-purple-500 mr-2"></i>カテゴリ別予算配分</h3>
          <div style="height:300px"><canvas id="categoryChart"></canvas></div>
        </div>
      </div>

      <!-- Cumulative Trend -->
      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 class="text-sm font-semibold text-gray-700 mb-4"><i class="fas fa-chart-line text-green-500 mr-2"></i>累計予実績推移</h3>
        <div style="height:300px"><canvas id="trendChart"></canvas></div>
      </div>

      <!-- Category Detail Table -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-5 border-b border-gray-100">
          <h3 class="text-sm font-semibold text-gray-700"><i class="fas fa-table text-gray-500 mr-2"></i>カテゴリ別サマリー</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">カテゴリ</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">予算(万円)</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">実績(万円)</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">コミット(万円)</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">残額(万円)</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">消化率</th>
                <th class="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">ステータス</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${summary.categoryData.map(cat => {
                const remaining = cat.budget - cat.actual - cat.committed;
                const rate = cat.budget > 0 ? ((cat.actual + cat.committed) / cat.budget * 100) : 0;
                const c = getAlertColor(rate);
                return `<tr class="table-row">
                  <td class="px-5 py-3 font-medium text-gray-700">${cat.name}</td>
                  <td class="px-5 py-3 text-right text-gray-600">${fmtM(cat.budget)}</td>
                  <td class="px-5 py-3 text-right text-gray-600">${fmtM(cat.actual)}</td>
                  <td class="px-5 py-3 text-right text-gray-600">${fmtM(cat.committed)}</td>
                  <td class="px-5 py-3 text-right ${remaining < 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}">${fmtM(remaining)}</td>
                  <td class="px-5 py-3 text-right font-medium ${c.text}">${rate.toFixed(1)}%</td>
                  <td class="px-5 py-3"><span class="${c.badge} text-white text-xs px-2 py-1 rounded-full">${rate >= 95 ? '超過注意' : rate >= 80 ? '警告' : '正常'}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  // Render Charts
  setTimeout(() => {
    renderMonthlyChart(summary.monthlyData);
    renderCategoryChart(summary.categoryData);
    renderTrendChart(trends.trends);
  }, 100);
}

function renderMonthlyChart(data) {
  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return;
  state.charts.monthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => monthLabel(d.month)),
      datasets: [
        { label: '予算', data: data.map(d => d.budget / 10000), backgroundColor: 'rgba(59,130,246,0.2)', borderColor: '#3b82f6', borderWidth: 1.5, borderRadius: 4 },
        { label: '実績', data: data.map(d => d.actual / 10000), backgroundColor: 'rgba(99,102,241,0.6)', borderColor: '#6366f1', borderWidth: 1.5, borderRadius: 4 },
        { label: 'コミット', data: data.map(d => d.committed / 10000), backgroundColor: 'rgba(245,158,11,0.5)', borderColor: '#f59e0b', borderWidth: 1.5, borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 15, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + ctx.parsed.y.toLocaleString() + '万円' } }
      },
      scales: { y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString() + '万' } } }
    }
  });
}

function renderCategoryChart(data) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;
  const colors = ['#3b82f6','#6366f1','#8b5cf6','#a855f7','#ec4899','#f43f5e','#f59e0b','#10b981'];
  state.charts.category = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.name),
      datasets: [{
        data: data.map(d => d.budget),
        backgroundColor: colors,
        borderWidth: 2, borderColor: '#fff'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: {
        legend: { position: 'right', labels: { usePointStyle: true, padding: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => ctx.label + ': ' + fmtM(ctx.raw) + '万円 (' + ((ctx.raw / data.reduce((s, d) => s + d.budget, 0)) * 100).toFixed(1) + '%)' } }
      }
    }
  });
}

function renderTrendChart(data) {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;
  state.charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => monthLabel(d.month)),
      datasets: [
        { label: '累計予算', data: data.map(d => d.cumulative_budget / 10000), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3, pointRadius: 4 },
        { label: '累計実績', data: data.map(d => d.cumulative_actual / 10000), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.3, pointRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 15, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + ctx.parsed.y.toLocaleString() + '万円' } }
      },
      scales: { y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString() + '万' } } }
    }
  });
}

// === Budget Management Page ===
async function renderBudgets(main) {
  const [budgetData, catData, deptData] = await Promise.all([
    api('/budgets/summary'),
    api('/master/categories'),
    api('/master/departments')
  ]);
  state.categories = catData.categories;
  state.departments = deptData.departments;

  const topCats = catData.categories.filter(c => !c.parent_id);

  main.innerHTML = `
    <div class="fade-in space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-gray-800"><i class="fas fa-wallet text-blue-500 mr-2"></i>予算管理</h2>
        <button onclick="showBudgetForm()" class="btn-primary"><i class="fas fa-plus mr-2"></i>予算登録</button>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">カテゴリ</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">部門</th>
                <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500">年間予算(万円)</th>
                ${[...Array(12)].map((_, i) => `<th class="text-right px-3 py-3 text-xs font-semibold text-gray-500">${monthLabel(i + 1)}</th>`).join('')}
                <th class="px-4 py-3 text-xs font-semibold text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${budgetData.summary.map(s => {
                const monthly = {};
                if (s.monthly_breakdown) {
                  s.monthly_breakdown.split(',').forEach(mb => {
                    const [m, a] = mb.split(':');
                    monthly[parseInt(m)] = parseFloat(a);
                  });
                }
                return `<tr class="table-row">
                  <td class="px-4 py-3 font-medium text-gray-700">${s.category_name}</td>
                  <td class="px-4 py-3 text-gray-500">${s.department_name || '-'}</td>
                  <td class="px-4 py-3 text-right font-semibold text-gray-700">${fmtM(s.annual_budget)}</td>
                  ${[...Array(12)].map((_, i) => `<td class="px-3 py-3 text-right text-gray-500 text-xs">${monthly[i + 1] ? fmtM(monthly[i + 1]) : '-'}</td>`).join('')}
                  <td class="px-4 py-3">
                    <button onclick="editBudgetRow(${s.category_id}, ${s.department_id || 'null'})" class="text-blue-500 hover:text-blue-700 text-xs"><i class="fas fa-edit"></i></button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function showBudgetForm(data = null) {
  const topCats = state.categories.filter(c => !c.parent_id);
  showModal(`
    <div class="p-6">
      <h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-wallet text-blue-500 mr-2"></i>${data ? '予算編集' : '予算登録'}</h3>
      <form id="budgetForm" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
            <select id="bf_category" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
              <option value="">選択してください</option>
              ${topCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">部門</label>
            <select id="bf_dept" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
              <option value="">全社共通</option>
              ${state.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">月別予算配分 (万円)</label>
          <div class="grid grid-cols-4 gap-2">
            ${[...Array(12)].map((_, i) => `
              <div>
                <label class="text-xs text-gray-500">${monthLabel(i + 1)}</label>
                <input type="number" id="bf_m${i + 1}" class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="0" step="1">
              </div>
            `).join('')}
          </div>
          <div class="mt-2 flex items-center gap-2">
            <label class="text-xs text-gray-500">年間合計を均等配分:</label>
            <input type="number" id="bf_total" class="border border-gray-300 rounded px-2 py-1 text-sm w-32" placeholder="年間(万円)">
            <button type="button" onclick="distributeBudget()" class="btn-secondary text-xs">均等配分</button>
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onclick="closeModal()" class="btn-secondary">キャンセル</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById('budgetForm').onsubmit = async (e) => {
    e.preventDefault();
    const categoryId = document.getElementById('bf_category').value;
    const deptId = document.getElementById('bf_dept').value;
    const monthly = {};
    for (let i = 1; i <= 12; i++) {
      const val = parseFloat(document.getElementById('bf_m' + i).value);
      if (val) monthly[i] = val * 10000;
    }
    if (!categoryId || Object.keys(monthly).length === 0) {
      showToast('カテゴリと月別金額を入力してください', 'error');
      return;
    }
    try {
      await api('/budgets/bulk', { method: 'POST', body: {
        fiscal_year_id: state.fiscalYearId, category_id: parseInt(categoryId),
        department_id: deptId ? parseInt(deptId) : null, monthly_amounts: monthly
      }});
      closeModal();
      showToast('予算を保存しました');
      navigateTo('budgets');
    } catch (e) { showToast(e.message, 'error'); }
  };
}

function distributeBudget() {
  const total = parseFloat(document.getElementById('bf_total').value);
  if (!total) return;
  const monthly = Math.floor(total / 12);
  const remainder = total - monthly * 12;
  for (let i = 1; i <= 12; i++) {
    document.getElementById('bf_m' + i).value = i === 12 ? monthly + remainder : monthly;
  }
}

async function editBudgetRow(catId, deptId) {
  const data = await api(`/budgets?category_id=${catId}${deptId ? '&department_id=' + deptId : ''}`);
  showBudgetForm();
  // Fill in existing data
  if (data.budgets.length > 0) {
    document.getElementById('bf_category').value = catId;
    if (deptId) document.getElementById('bf_dept').value = deptId;
    data.budgets.forEach(b => {
      const el = document.getElementById('bf_m' + b.month);
      if (el) el.value = Math.round(b.amount / 10000);
    });
  }
}

// === Actuals Page ===
async function renderActuals(main) {
  const [actualData, catData, deptData] = await Promise.all([
    api('/actuals'),
    api('/master/categories'),
    api('/master/departments')
  ]);
  state.categories = catData.categories;
  state.departments = deptData.departments;

  main.innerHTML = `
    <div class="fade-in space-y-6">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <h2 class="text-xl font-bold text-gray-800"><i class="fas fa-receipt text-indigo-500 mr-2"></i>実績入力</h2>
        <div class="flex gap-2">
          <button onclick="showCsvImport()" class="btn-secondary"><i class="fas fa-file-csv mr-2"></i>CSVインポート</button>
          <button onclick="showActualForm()" class="btn-primary"><i class="fas fa-plus mr-2"></i>実績登録</button>
        </div>
      </div>
      <!-- Filters -->
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-4">
        <div>
          <label class="text-xs text-gray-500 block mb-1">月</label>
          <select id="actualMonthFilter" onchange="filterActuals()" class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">全月</option>
            ${[...Array(12)].map((_, i) => `<option value="${i + 1}">${monthLabel(i + 1)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">カテゴリ</label>
          <select id="actualCatFilter" onchange="filterActuals()" class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">全カテゴリ</option>
            ${catData.categories.filter(c => !c.parent_id).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">月</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">カテゴリ</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">説明</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">ベンダー</th>
                <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500">金額(万円)</th>
                <th class="text-center px-4 py-3 text-xs font-semibold text-gray-500">ステータス</th>
                <th class="px-4 py-3 text-xs font-semibold text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody id="actualsTableBody" class="divide-y divide-gray-100">
              ${renderActualsRows(actualData.actuals)}
            </tbody>
          </table>
        </div>
        <div class="p-4 bg-gray-50 border-t border-gray-100 text-sm text-gray-500">
          合計 ${actualData.actuals.length} 件 / 総額 ${fmtM(actualData.actuals.reduce((s, a) => s + a.amount, 0))} 万円
        </div>
      </div>
    </div>`;
}

function renderActualsRows(actuals) {
  if (!actuals.length) return '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">データがありません</td></tr>';
  return actuals.map(a => {
    const statusColors = { draft: 'bg-gray-100 text-gray-600', recorded: 'bg-blue-100 text-blue-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' };
    const statusLabels = { draft: '下書き', recorded: '記録済', approved: '承認済', rejected: '却下' };
    return `<tr class="table-row">
      <td class="px-4 py-3 text-gray-600">${monthLabel(a.month)}</td>
      <td class="px-4 py-3 text-gray-700 font-medium">${a.category_name || '-'}</td>
      <td class="px-4 py-3 text-gray-600 max-w-xs truncate">${a.description || '-'}</td>
      <td class="px-4 py-3 text-gray-500">${a.vendor || '-'}</td>
      <td class="px-4 py-3 text-right font-medium text-gray-700">${fmtM(a.amount)}</td>
      <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[a.status] || ''}">${statusLabels[a.status] || a.status}</span></td>
      <td class="px-4 py-3 flex gap-2">
        <button onclick='showActualForm(${JSON.stringify(a).replace(/'/g, "\\'")})' class="text-blue-500 hover:text-blue-700 text-xs"><i class="fas fa-edit"></i></button>
        <button onclick="deleteActual(${a.id})" class="text-red-400 hover:text-red-600 text-xs"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}

async function filterActuals() {
  const month = document.getElementById('actualMonthFilter').value;
  const cat = document.getElementById('actualCatFilter').value;
  let url = '/actuals?';
  if (month) url += '&month=' + month;
  if (cat) url += '&category_id=' + cat;
  const data = await api(url);
  document.getElementById('actualsTableBody').innerHTML = renderActualsRows(data.actuals);
}

function showActualForm(data = null) {
  const topCats = state.categories.filter(c => !c.parent_id);
  showModal(`
    <div class="p-6">
      <h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-receipt text-indigo-500 mr-2"></i>${data ? '実績編集' : '実績登録'}</h3>
      <form id="actualForm" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">月 *</label>
            <select id="af_month" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              ${[...Array(12)].map((_, i) => `<option value="${i + 1}" ${data && data.month === i + 1 ? 'selected' : ''}>${monthLabel(i + 1)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">カテゴリ *</label>
            <select id="af_category" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">選択してください</option>
              ${topCats.map(c => `<option value="${c.id}" ${data && data.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">金額 (円) *</label>
            <input type="number" id="af_amount" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value="${data ? data.amount : ''}" step="1">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">部門</label>
            <select id="af_dept" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">選択してください</option>
              ${state.departments.map(d => `<option value="${d.id}" ${data && data.department_id === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
            </select>
          </div>
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">説明</label>
            <input type="text" id="af_desc" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value="${data?.description || ''}" placeholder="例: AWS月額利用料">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ベンダー</label>
            <input type="text" id="af_vendor" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value="${data?.vendor || ''}">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">請求書番号</label>
            <input type="text" id="af_invoice" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value="${data?.invoice_number || ''}">
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onclick="closeModal()" class="btn-secondary">キャンセル</button>
          <button type="submit" class="btn-primary">${data ? '更新' : '登録'}</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById('actualForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      fiscal_year_id: state.fiscalYearId,
      month: parseInt(document.getElementById('af_month').value),
      category_id: parseInt(document.getElementById('af_category').value),
      amount: parseFloat(document.getElementById('af_amount').value),
      department_id: document.getElementById('af_dept').value ? parseInt(document.getElementById('af_dept').value) : null,
      description: document.getElementById('af_desc').value,
      vendor: document.getElementById('af_vendor').value,
      invoice_number: document.getElementById('af_invoice').value
    };
    try {
      if (data) {
        await api('/actuals/' + data.id, { method: 'PUT', body: payload });
        showToast('実績を更新しました');
      } else {
        await api('/actuals', { method: 'POST', body: payload });
        showToast('実績を登録しました');
      }
      closeModal();
      navigateTo('actuals');
    } catch (e) { showToast(e.message, 'error'); }
  };
}

async function deleteActual(id) {
  if (!confirm('この実績データを削除しますか？')) return;
  try {
    await api('/actuals/' + id, { method: 'DELETE' });
    showToast('実績を削除しました');
    navigateTo('actuals');
  } catch (e) { showToast(e.message, 'error'); }
}

function showCsvImport() {
  showModal(`
    <div class="p-6">
      <h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-file-csv text-green-500 mr-2"></i>CSVインポート</h3>
      <div class="space-y-4">
        <div class="bg-gray-50 rounded-lg p-4">
          <p class="text-sm font-medium text-gray-700 mb-2">CSVフォーマット:</p>
          <code class="text-xs text-gray-600 block bg-white rounded p-2">月,カテゴリID,部門ID,金額,説明,ベンダー,請求書番号</code>
          <p class="text-xs text-gray-400 mt-2">例: 1,3,1,12000000,AWS月額利用料,AWS,INV-001</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">CSVデータ</label>
          <textarea id="csvData" rows="8" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" placeholder="CSVデータを貼り付け..."></textarea>
        </div>
        <div>
          <input type="file" id="csvFile" accept=".csv" onchange="loadCsvFile()" class="text-sm text-gray-500">
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onclick="closeModal()" class="btn-secondary">キャンセル</button>
          <button type="button" onclick="importCsv()" class="btn-primary">インポート</button>
        </div>
      </div>
    </div>
  `);
}

function loadCsvFile() {
  const file = document.getElementById('csvFile').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => { document.getElementById('csvData').value = e.target.result; };
  reader.readAsText(file);
}

async function importCsv() {
  const csv = document.getElementById('csvData').value.trim();
  if (!csv) { showToast('CSVデータを入力してください', 'error'); return; }
  const lines = csv.split('\n').filter(l => l.trim());
  const records = lines.map(line => {
    const [month, category_id, department_id, amount, description, vendor, invoice_number] = line.split(',').map(s => s.trim());
    return { month: parseInt(month), category_id: parseInt(category_id), department_id: department_id ? parseInt(department_id) : null, amount: parseFloat(amount), description, vendor, invoice_number };
  }).filter(r => r.month && r.category_id && r.amount);

  if (!records.length) { showToast('有効なデータがありません', 'error'); return; }

  try {
    const result = await api('/actuals/import', { method: 'POST', body: { fiscal_year_id: state.fiscalYearId, records } });
    closeModal();
    showToast(result.message);
    navigateTo('actuals');
  } catch (e) { showToast(e.message, 'error'); }
}

// === Committed Expenses Page ===
async function renderCommitted(main) {
  const data = await api('/committed');

  main.innerHTML = `
    <div class="fade-in space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-gray-800"><i class="fas fa-file-invoice text-amber-500 mr-2"></i>コミット管理</h2>
        <button onclick="showCommittedForm()" class="btn-primary"><i class="fas fa-plus mr-2"></i>コミット登録</button>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">月</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">カテゴリ</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">説明</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">ベンダー</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">発注番号</th>
                <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500">金額(万円)</th>
                <th class="text-center px-4 py-3 text-xs font-semibold text-gray-500">ステータス</th>
                <th class="px-4 py-3 text-xs font-semibold text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${data.committed.length ? data.committed.map(ce => {
                const statusColors = { ordered: 'bg-blue-100 text-blue-700', delivered: 'bg-purple-100 text-purple-700', invoiced: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-500' };
                const statusLabels = { ordered: '発注済', delivered: '納品済', invoiced: '請求済', cancelled: 'キャンセル' };
                return `<tr class="table-row">
                  <td class="px-4 py-3">${monthLabel(ce.month)}</td>
                  <td class="px-4 py-3 font-medium text-gray-700">${ce.category_name || '-'}</td>
                  <td class="px-4 py-3 text-gray-600 max-w-xs truncate">${ce.description || '-'}</td>
                  <td class="px-4 py-3 text-gray-500">${ce.vendor || '-'}</td>
                  <td class="px-4 py-3 text-gray-500">${ce.order_number || '-'}</td>
                  <td class="px-4 py-3 text-right font-medium">${fmtM(ce.amount)}</td>
                  <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[ce.status]}">${statusLabels[ce.status]}</span></td>
                  <td class="px-4 py-3 flex gap-2">
                    <button onclick="deleteCommitted(${ce.id})" class="text-red-400 hover:text-red-600 text-xs"><i class="fas fa-trash"></i></button>
                  </td>
                </tr>`;
              }).join('') : '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">データがありません</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="p-4 bg-gray-50 border-t border-gray-100 text-sm text-gray-500">
          合計 ${data.committed.length} 件 / 総額 ${fmtM(data.committed.filter(c => c.status !== 'cancelled').reduce((s, c) => s + c.amount, 0))} 万円
        </div>
      </div>
    </div>`;
}

function showCommittedForm() {
  const topCats = state.categories.filter(c => !c.parent_id);
  showModal(`
    <div class="p-6">
      <h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-file-invoice text-amber-500 mr-2"></i>コミット登録</h3>
      <form id="committedForm" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">月 *</label>
            <select id="cf_month" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              ${[...Array(12)].map((_, i) => `<option value="${i + 1}">${monthLabel(i + 1)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">カテゴリ *</label>
            <select id="cf_category" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">選択</option>
              ${topCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">金額 (円) *</label>
            <input type="number" id="cf_amount" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ベンダー</label>
            <input type="text" id="cf_vendor" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">発注番号</label>
            <input type="text" id="cf_order" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">部門</label>
            <select id="cf_dept" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">選択</option>
              ${state.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
            </select>
          </div>
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">説明</label>
            <input type="text" id="cf_desc" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onclick="closeModal()" class="btn-secondary">キャンセル</button>
          <button type="submit" class="btn-primary">登録</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById('committedForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/committed', { method: 'POST', body: {
        fiscal_year_id: state.fiscalYearId,
        month: parseInt(document.getElementById('cf_month').value),
        category_id: parseInt(document.getElementById('cf_category').value),
        amount: parseFloat(document.getElementById('cf_amount').value),
        department_id: document.getElementById('cf_dept').value ? parseInt(document.getElementById('cf_dept').value) : null,
        vendor: document.getElementById('cf_vendor').value,
        order_number: document.getElementById('cf_order').value,
        description: document.getElementById('cf_desc').value
      }});
      closeModal(); showToast('コミット金額を登録しました'); navigateTo('committed');
    } catch (e) { showToast(e.message, 'error'); }
  };
}

async function deleteCommitted(id) {
  if (!confirm('このコミットデータを削除しますか？')) return;
  try { await api('/committed/' + id, { method: 'DELETE' }); showToast('削除しました'); navigateTo('committed'); } catch (e) { showToast(e.message, 'error'); }
}

// === Analysis Page ===
async function renderAnalysis(main) {
  const [report, deptReport, trendData] = await Promise.all([
    api('/reports/monthly'),
    api('/reports/department'),
    api('/dashboard/trends')
  ]);

  const totals = report.report.reduce((acc, r) => ({
    budget: acc.budget + r.budget, actual: acc.actual + r.actual,
    committed: acc.committed + r.committed, remaining: acc.remaining + r.remaining
  }), { budget: 0, actual: 0, committed: 0, remaining: 0 });

  main.innerHTML = `
    <div class="fade-in space-y-6">
      <h2 class="text-xl font-bold text-gray-800"><i class="fas fa-chart-line text-green-500 mr-2"></i>予実分析</h2>

      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
          <p class="text-sm opacity-80">年間予算</p>
          <p class="text-2xl font-bold mt-1">${fmtM(totals.budget)}<span class="text-sm font-normal opacity-80 ml-1">万円</span></p>
        </div>
        <div class="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white">
          <p class="text-sm opacity-80">累計実績</p>
          <p class="text-2xl font-bold mt-1">${fmtM(totals.actual)}<span class="text-sm font-normal opacity-80 ml-1">万円</span></p>
        </div>
        <div class="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white">
          <p class="text-sm opacity-80">コミット済</p>
          <p class="text-2xl font-bold mt-1">${fmtM(totals.committed)}<span class="text-sm font-normal opacity-80 ml-1">万円</span></p>
        </div>
        <div class="bg-gradient-to-br ${totals.remaining >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600'} rounded-xl p-5 text-white">
          <p class="text-sm opacity-80">残予算</p>
          <p class="text-2xl font-bold mt-1">${fmtM(totals.remaining)}<span class="text-sm font-normal opacity-80 ml-1">万円</span></p>
        </div>
      </div>

      <!-- Analysis Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 class="text-sm font-semibold text-gray-700 mb-4"><i class="fas fa-chart-bar text-blue-500 mr-2"></i>カテゴリ別予実比較</h3>
          <div style="height:300px"><canvas id="analysisBarChart"></canvas></div>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 class="text-sm font-semibold text-gray-700 mb-4"><i class="fas fa-chart-line text-green-500 mr-2"></i>消化率トレンド</h3>
          <div style="height:300px"><canvas id="analysisRateChart"></canvas></div>
        </div>
      </div>

      <!-- Category Detail -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-5 border-b border-gray-100">
          <h3 class="text-sm font-semibold text-gray-700"><i class="fas fa-table text-gray-500 mr-2"></i>カテゴリ別予実分析</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left px-5 py-3 text-xs font-semibold text-gray-500">カテゴリ</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500">予算</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500">実績</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500">コミット</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500">残額</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500">差異</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500">消化率</th>
                <th class="px-5 py-3 text-xs font-semibold text-gray-500">進捗</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${report.report.map(r => {
                const c = getAlertColor(r.consumption_rate);
                return `<tr class="table-row">
                  <td class="px-5 py-3 font-medium text-gray-700">${r.category_name}</td>
                  <td class="px-5 py-3 text-right">${fmtM(r.budget)}万</td>
                  <td class="px-5 py-3 text-right">${fmtM(r.actual)}万</td>
                  <td class="px-5 py-3 text-right">${fmtM(r.committed)}万</td>
                  <td class="px-5 py-3 text-right ${r.remaining < 0 ? 'text-red-600 font-semibold' : ''}">${fmtM(r.remaining)}万</td>
                  <td class="px-5 py-3 text-right ${r.variance > 0 ? 'text-red-600' : 'text-green-600'}">${r.variance > 0 ? '+' : ''}${fmtM(r.variance)}万</td>
                  <td class="px-5 py-3 text-right font-medium ${c.text}">${r.consumption_rate}%</td>
                  <td class="px-5 py-3 w-32">
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div class="h-2 rounded-full progress-bar ${r.consumption_rate >= 95 ? 'bg-red-500' : r.consumption_rate >= 80 ? 'bg-yellow-500' : 'bg-blue-500'}" style="width:${Math.min(r.consumption_rate, 100)}%"></div>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Department Report -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-5 border-b border-gray-100">
          <h3 class="text-sm font-semibold text-gray-700"><i class="fas fa-building text-purple-500 mr-2"></i>部門別サマリー</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left px-5 py-3 text-xs font-semibold text-gray-500">部門</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500">予算(万円)</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500">実績(万円)</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500">コミット(万円)</th>
                <th class="text-right px-5 py-3 text-xs font-semibold text-gray-500">残額(万円)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${deptReport.report.map(d => `<tr class="table-row">
                <td class="px-5 py-3 font-medium text-gray-700">${d.department_name}</td>
                <td class="px-5 py-3 text-right">${fmtM(d.budget)}</td>
                <td class="px-5 py-3 text-right">${fmtM(d.actual)}</td>
                <td class="px-5 py-3 text-right">${fmtM(d.committed)}</td>
                <td class="px-5 py-3 text-right ${d.remaining < 0 ? 'text-red-600 font-semibold' : ''}">${fmtM(d.remaining)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  setTimeout(() => {
    // Bar chart
    const ctx1 = document.getElementById('analysisBarChart');
    if (ctx1) {
      state.charts.analysisBar = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: report.report.map(r => r.category_name),
          datasets: [
            { label: '予算', data: report.report.map(r => r.budget / 10000), backgroundColor: 'rgba(59,130,246,0.3)', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 4 },
            { label: '実績', data: report.report.map(r => r.actual / 10000), backgroundColor: 'rgba(99,102,241,0.6)', borderColor: '#6366f1', borderWidth: 1, borderRadius: 4 },
            { label: 'コミット', data: report.report.map(r => r.committed / 10000), backgroundColor: 'rgba(245,158,11,0.5)', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 4 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false, indexAxis: 'y',
          plugins: { legend: { position: 'top', labels: { usePointStyle: true, font: { size: 11 } } } },
          scales: { x: { ticks: { callback: v => v.toLocaleString() + '万' } } }
        }
      });
    }
    // Rate trend
    const ctx2 = document.getElementById('analysisRateChart');
    if (ctx2 && trendData.trends) {
      const cumBudgets = [], cumActuals = [];
      let cBudget = 0, cActual = 0;
      trendData.trends.forEach(t => {
        cBudget += t.budget; cActual += t.actual;
        cumBudgets.push(cBudget); cumActuals.push(cActual);
      });
      const rates = cumBudgets.map((b, i) => b > 0 ? (cumActuals[i] / b * 100).toFixed(1) : 0);
      state.charts.analysisRate = new Chart(ctx2, {
        type: 'line',
        data: {
          labels: trendData.trends.map(d => monthLabel(d.month)),
          datasets: [
            { label: '消化率', data: rates, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.3, pointRadius: 4 },
            { label: '80%ライン', data: Array(12).fill(80), borderColor: '#f59e0b', borderDash: [5, 5], pointRadius: 0 },
            { label: '95%ライン', data: Array(12).fill(95), borderColor: '#ef4444', borderDash: [5, 5], pointRadius: 0 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { usePointStyle: true, font: { size: 11 } } } },
          scales: { y: { min: 0, max: 120, ticks: { callback: v => v + '%' } } }
        }
      });
    }
  }, 100);
}

// === Reports Page ===
async function renderReports(main) {
  const report = await api('/reports/monthly');

  main.innerHTML = `
    <div class="fade-in space-y-6">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <h2 class="text-xl font-bold text-gray-800"><i class="fas fa-file-pdf text-red-500 mr-2"></i>レポート出力</h2>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onclick="exportPDF()" class="bg-white rounded-xl p-6 shadow-sm border border-gray-100 card-hover text-left">
          <div class="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4"><i class="fas fa-file-pdf text-red-500 text-xl"></i></div>
          <h4 class="font-semibold text-gray-800">PDF月次報告書</h4>
          <p class="text-sm text-gray-500 mt-1">月次予実績レポートをPDFで出力</p>
        </button>
        <button onclick="exportExcel()" class="bg-white rounded-xl p-6 shadow-sm border border-gray-100 card-hover text-left">
          <div class="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-4"><i class="fas fa-file-excel text-green-500 text-xl"></i></div>
          <h4 class="font-semibold text-gray-800">Excelエクスポート</h4>
          <p class="text-sm text-gray-500 mt-1">予実績データをExcel形式でダウンロード</p>
        </button>
        <button onclick="exportCSV()" class="bg-white rounded-xl p-6 shadow-sm border border-gray-100 card-hover text-left">
          <div class="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4"><i class="fas fa-file-csv text-blue-500 text-xl"></i></div>
          <h4 class="font-semibold text-gray-800">CSVエクスポート</h4>
          <p class="text-sm text-gray-500 mt-1">データをCSV形式でダウンロード</p>
        </button>
      </div>

      <!-- Preview Table -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-5 border-b border-gray-100">
          <h3 class="text-sm font-semibold text-gray-700">レポートプレビュー: カテゴリ別予実績</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm" id="reportTable">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">カテゴリ</th>
                <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500">予算</th>
                <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500">実績</th>
                <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500">コミット</th>
                <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500">残額</th>
                <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500">消化率</th>
                <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500">差異</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${report.report.map(r => `<tr class="table-row">
                <td class="px-4 py-3 font-medium">${r.category_name}</td>
                <td class="px-4 py-3 text-right">${fmt(r.budget)}</td>
                <td class="px-4 py-3 text-right">${fmt(r.actual)}</td>
                <td class="px-4 py-3 text-right">${fmt(r.committed)}</td>
                <td class="px-4 py-3 text-right ${r.remaining < 0 ? 'text-red-600' : ''}">${fmt(r.remaining)}</td>
                <td class="px-4 py-3 text-right">${r.consumption_rate}%</td>
                <td class="px-4 py-3 text-right ${r.variance > 0 ? 'text-red-600' : 'text-green-600'}">${fmt(r.variance)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function exportCSV() {
  const table = document.getElementById('reportTable');
  if (!table) { showToast('レポートデータがありません', 'error'); return; }
  let csv = '\uFEFF'; // BOM for Japanese Excel
  const rows = table.querySelectorAll('tr');
  rows.forEach(row => {
    const cells = row.querySelectorAll('th, td');
    csv += Array.from(cells).map(c => '"' + c.textContent.trim().replace(/"/g, '""') + '"').join(',') + '\n';
  });
  downloadFile(csv, 'budget_report.csv', 'text/csv;charset=utf-8');
  showToast('CSVファイルをダウンロードしました');
}

function exportExcel() {
  // Create simple XLSX-compatible XML
  const table = document.getElementById('reportTable');
  if (!table) return;
  let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
  xml += '<Worksheet ss:Name="予実績レポート"><Table>';
  const rows = table.querySelectorAll('tr');
  rows.forEach(row => {
    xml += '<Row>';
    row.querySelectorAll('th, td').forEach(cell => {
      const val = cell.textContent.trim();
      const isNum = /^[¥\-\+]?[\d,]+\.?\d*%?$/.test(val.replace(/[¥,%]/g, ''));
      if (isNum) {
        xml += `<Cell><Data ss:Type="Number">${val.replace(/[¥,%万円]/g, '').replace(/,/g, '')}</Data></Cell>`;
      } else {
        xml += `<Cell><Data ss:Type="String">${val}</Data></Cell>`;
      }
    });
    xml += '</Row>';
  });
  xml += '</Table></Worksheet></Workbook>';
  downloadFile(xml, 'budget_report.xls', 'application/vnd.ms-excel');
  showToast('Excelファイルをダウンロードしました');
}

function exportPDF() {
  // Print-friendly version
  const table = document.getElementById('reportTable');
  if (!table) return;
  const fy = state.fiscalYears.find(f => f.id === state.fiscalYearId);
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>IT予算予実績レポート</title>
    <style>
      body { font-family: 'Noto Sans JP', sans-serif; padding: 40px; color: #333; }
      h1 { font-size: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
      h2 { font-size: 14px; color: #666; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
      th { background: #f3f4f6; text-align: left; padding: 8px 12px; border: 1px solid #e5e7eb; font-weight: 600; }
      td { padding: 8px 12px; border: 1px solid #e5e7eb; }
      .text-right { text-align: right; }
      .negative { color: #dc2626; }
      .footer { margin-top: 30px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
      @media print { body { padding: 20px; } }
    </style>
    </head><body>
    <h1>IT予算予実績レポート</h1>
    <h2>${fy?.name || ''} | 出力日: ${new Date().toLocaleDateString('ja-JP')}</h2>
    ${table.outerHTML}
    <div class="footer">IT予算管理ダッシュボード - 自動生成レポート</div>
    <script>window.print();</script>
    </body></html>
  `);
  showToast('PDFレポートを生成しました');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// === Categories Management ===
async function renderCategories(main) {
  const data = await api('/master/categories/tree');

  function renderTree(nodes, level = 0) {
    return nodes.map(n => {
      const indent = level * 24;
      const hasChildren = n.children && n.children.length > 0;
      return `
        <tr class="table-row">
          <td class="px-4 py-3">
            <div style="padding-left:${indent}px" class="flex items-center gap-2">
              ${hasChildren ? '<i class="fas fa-folder-open text-yellow-500 text-xs"></i>' : '<i class="fas fa-tag text-gray-400 text-xs"></i>'}
              <span class="font-medium text-gray-700">${n.name}</span>
            </div>
          </td>
          <td class="px-4 py-3 text-gray-500 text-sm">${n.code}</td>
          <td class="px-4 py-3 text-gray-500 text-sm">レベル ${n.level}</td>
          <td class="px-4 py-3">
            <button onclick="editCategory(${n.id}, '${n.name}', '${n.code}', ${n.sort_order}, '${n.description || ''}')" class="text-blue-500 hover:text-blue-700 text-xs mr-2"><i class="fas fa-edit"></i></button>
          </td>
        </tr>
        ${hasChildren ? renderTree(n.children, level + 1) : ''}
      `;
    }).join('');
  }

  main.innerHTML = `
    <div class="fade-in space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-gray-800"><i class="fas fa-folder-tree text-yellow-500 mr-2"></i>カテゴリ管理</h2>
        <button onclick="showCategoryForm()" class="btn-primary"><i class="fas fa-plus mr-2"></i>カテゴリ追加</button>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">名前</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">コード</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500">レベル</th>
              <th class="px-4 py-3 text-xs font-semibold text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${renderTree(data.tree)}
          </tbody>
        </table>
      </div>
    </div>`;
}

function showCategoryForm(parentId = null) {
  const topCats = state.categories.filter(c => !c.parent_id);
  showModal(`
    <div class="p-6">
      <h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-folder-tree text-yellow-500 mr-2"></i>カテゴリ追加</h3>
      <form id="categoryForm" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">名前 *</label>
            <input type="text" id="catf_name" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">コード *</label>
            <input type="text" id="catf_code" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="例: CLOUD-AWS">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">親カテゴリ</label>
            <select id="catf_parent" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">なし(トップレベル)</option>
              ${state.categories.map(c => `<option value="${c.id}" ${c.id === parentId ? 'selected' : ''}>${'　'.repeat(c.level)}${c.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">並び順</label>
            <input type="number" id="catf_sort" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value="0">
          </div>
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">説明</label>
            <input type="text" id="catf_desc" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onclick="closeModal()" class="btn-secondary">キャンセル</button>
          <button type="submit" class="btn-primary">登録</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById('categoryForm').onsubmit = async (e) => {
    e.preventDefault();
    const parentId = document.getElementById('catf_parent').value;
    const parentCat = parentId ? state.categories.find(c => c.id === parseInt(parentId)) : null;
    try {
      await api('/master/categories', { method: 'POST', body: {
        name: document.getElementById('catf_name').value,
        code: document.getElementById('catf_code').value,
        parent_id: parentId ? parseInt(parentId) : null,
        level: parentCat ? parentCat.level + 1 : 0,
        sort_order: parseInt(document.getElementById('catf_sort').value) || 0,
        description: document.getElementById('catf_desc').value
      }});
      closeModal(); showToast('カテゴリを登録しました'); navigateTo('categories');
    } catch (e) { showToast(e.message, 'error'); }
  };
}

function editCategory(id, name, code, sortOrder, desc) {
  showModal(`
    <div class="p-6">
      <h3 class="text-lg font-bold text-gray-800 mb-4">カテゴリ編集</h3>
      <form id="editCatForm" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">名前</label>
            <input type="text" id="ecf_name" value="${name}" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">コード</label>
            <input type="text" id="ecf_code" value="${code}" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">並び順</label>
            <input type="number" id="ecf_sort" value="${sortOrder}" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">説明</label>
            <input type="text" id="ecf_desc" value="${desc}" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onclick="closeModal()" class="btn-secondary">キャンセル</button>
          <button type="submit" class="btn-primary">更新</button>
        </div>
      </form>
    </div>
  `);
  document.getElementById('editCatForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/master/categories/' + id, { method: 'PUT', body: {
        name: document.getElementById('ecf_name').value, code: document.getElementById('ecf_code').value,
        sort_order: parseInt(document.getElementById('ecf_sort').value), description: document.getElementById('ecf_desc').value, is_active: 1
      }});
      closeModal(); showToast('更新しました'); navigateTo('categories');
    } catch (e) { showToast(e.message, 'error'); }
  };
}

// === Departments Management ===
async function renderDepartments(main) {
  const data = await api('/master/departments');
  state.departments = data.departments;

  main.innerHTML = `
    <div class="fade-in space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-gray-800"><i class="fas fa-building text-purple-500 mr-2"></i>部門管理</h2>
        <button onclick="showDeptForm()" class="btn-primary"><i class="fas fa-plus mr-2"></i>部門追加</button>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="text-left px-5 py-3 text-xs font-semibold text-gray-500">部門名</th>
              <th class="text-left px-5 py-3 text-xs font-semibold text-gray-500">コード</th>
              <th class="text-left px-5 py-3 text-xs font-semibold text-gray-500">責任者</th>
              <th class="px-5 py-3 text-xs font-semibold text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${data.departments.map(d => `<tr class="table-row">
              <td class="px-5 py-3 font-medium text-gray-700"><i class="fas fa-building text-purple-400 mr-2"></i>${d.name}</td>
              <td class="px-5 py-3 text-gray-500">${d.code}</td>
              <td class="px-5 py-3 text-gray-500">${d.manager_name || '-'}</td>
              <td class="px-5 py-3">
                <button onclick="editDept(${d.id}, '${d.name}', '${d.code}', '${d.manager_name || ''}')" class="text-blue-500 hover:text-blue-700 text-xs"><i class="fas fa-edit"></i></button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function showDeptForm() {
  showModal(`
    <div class="p-6">
      <h3 class="text-lg font-bold text-gray-800 mb-4">部門追加</h3>
      <form id="deptForm" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">部門名 *</label>
            <input type="text" id="df_name" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">コード *</label>
            <input type="text" id="df_code" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></div>
          <div class="col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">責任者</label>
            <input type="text" id="df_manager" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onclick="closeModal()" class="btn-secondary">キャンセル</button>
          <button type="submit" class="btn-primary">登録</button>
        </div>
      </form>
    </div>
  `);
  document.getElementById('deptForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/master/departments', { method: 'POST', body: {
        name: document.getElementById('df_name').value,
        code: document.getElementById('df_code').value,
        manager_name: document.getElementById('df_manager').value
      }});
      closeModal(); showToast('部門を登録しました'); navigateTo('departments');
    } catch (e) { showToast(e.message, 'error'); }
  };
}

function editDept(id, name, code, manager) {
  showModal(`
    <div class="p-6">
      <h3 class="text-lg font-bold text-gray-800 mb-4">部門編集</h3>
      <form id="editDeptForm" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">部門名</label>
            <input type="text" id="edf_name" value="${name}" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">コード</label>
            <input type="text" id="edf_code" value="${code}" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></div>
          <div class="col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">責任者</label>
            <input type="text" id="edf_manager" value="${manager}" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onclick="closeModal()" class="btn-secondary">キャンセル</button>
          <button type="submit" class="btn-primary">更新</button>
        </div>
      </form>
    </div>
  `);
  document.getElementById('editDeptForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/master/departments/' + id, { method: 'PUT', body: {
        name: document.getElementById('edf_name').value, code: document.getElementById('edf_code').value,
        manager_name: document.getElementById('edf_manager').value, is_active: 1
      }});
      closeModal(); showToast('更新しました'); navigateTo('departments');
    } catch (e) { showToast(e.message, 'error'); }
  };
}

// === Projects Management ===
async function renderProjects(main) {
  const [projData, deptData] = await Promise.all([
    api('/master/projects'),
    api('/master/departments')
  ]);
  state.departments = deptData.departments;

  const statusColors = { planning: 'bg-gray-100 text-gray-600', active: 'bg-green-100 text-green-700', completed: 'bg-blue-100 text-blue-700', cancelled: 'bg-red-100 text-red-600' };
  const statusLabels = { planning: '計画中', active: '進行中', completed: '完了', cancelled: '中止' };

  main.innerHTML = `
    <div class="fade-in space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-gray-800"><i class="fas fa-project-diagram text-teal-500 mr-2"></i>プロジェクト管理</h2>
        <button onclick="showProjectForm()" class="btn-primary"><i class="fas fa-plus mr-2"></i>プロジェクト追加</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${projData.projects.map(p => `
          <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100 card-hover">
            <div class="flex items-center justify-between mb-3">
              <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[p.status]}">${statusLabels[p.status]}</span>
              <span class="text-xs text-gray-400">${p.code}</span>
            </div>
            <h4 class="font-semibold text-gray-800 mb-2">${p.name}</h4>
            <p class="text-sm text-gray-500 mb-3">${p.description || '説明なし'}</p>
            <div class="flex items-center gap-4 text-xs text-gray-400">
              <span><i class="fas fa-building mr-1"></i>${p.department_name || '-'}</span>
              <span><i class="fas fa-calendar mr-1"></i>${p.fiscal_year_name || '-'}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function showProjectForm() {
  showModal(`
    <div class="p-6">
      <h3 class="text-lg font-bold text-gray-800 mb-4">プロジェクト追加</h3>
      <form id="projForm" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">名前 *</label>
            <input type="text" id="pf_name" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">コード *</label>
            <input type="text" id="pf_code" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="例: PRJ-005"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">部門</label>
            <select id="pf_dept" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">選択</option>
              ${state.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
            </select></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
            <select id="pf_status" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="planning">計画中</option><option value="active">進行中</option>
            </select></div>
          <div class="col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">説明</label>
            <textarea id="pf_desc" rows="2" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></textarea></div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onclick="closeModal()" class="btn-secondary">キャンセル</button>
          <button type="submit" class="btn-primary">登録</button>
        </div>
      </form>
    </div>
  `);
  document.getElementById('projForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/master/projects', { method: 'POST', body: {
        name: document.getElementById('pf_name').value,
        code: document.getElementById('pf_code').value,
        department_id: document.getElementById('pf_dept').value ? parseInt(document.getElementById('pf_dept').value) : null,
        fiscal_year_id: state.fiscalYearId,
        status: document.getElementById('pf_status').value,
        description: document.getElementById('pf_desc').value
      }});
      closeModal(); showToast('プロジェクトを登録しました'); navigateTo('projects');
    } catch (e) { showToast(e.message, 'error'); }
  };
}

// === Initialization ===
async function init() {
  try {
    const fyData = await fetch('/api/master/fiscal-years').then(r => r.json());
    state.fiscalYears = fyData.fiscalYears;
    const select = document.getElementById('fiscalYearSelect');
    select.innerHTML = fyData.fiscalYears.map(fy =>
      `<option value="${fy.id}" ${fy.is_active ? 'selected' : ''}>${fy.name} (${fy.year})</option>`
    ).join('');
    const active = fyData.fiscalYears.find(f => f.is_active);
    if (active) state.fiscalYearId = active.id;

    // Load master data
    const [catData, deptData] = await Promise.all([
      fetch('/api/master/categories?fiscal_year_id=' + state.fiscalYearId).then(r => r.json()),
      fetch('/api/master/departments?fiscal_year_id=' + state.fiscalYearId).then(r => r.json())
    ]);
    state.categories = catData.categories;
    state.departments = deptData.departments;

    navigateTo('dashboard');
  } catch (e) {
    console.error('Init error:', e);
    document.getElementById('mainContent').innerHTML =
      `<div class="text-center py-12"><i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i><p class="text-red-600">初期化エラー: ${e.message}</p><button onclick="init()" class="btn-primary mt-4">再試行</button></div>`;
  }
}

// Start
document.addEventListener('DOMContentLoaded', init);
