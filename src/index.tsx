import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { masterApi } from './routes/master'
import { budgetApi } from './routes/budget'
import { dashboardApi } from './routes/dashboard'
import { analysisApi } from './routes/analysis'
import { commentApi } from './routes/comments'
import { reportApi } from './routes/report'
import { getManualHtml } from './manual'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// API Routes
app.route('/api/dashboard', dashboardApi)
app.route('/api/budgets', budgetApi)
app.route('/api/analysis', analysisApi)
app.route('/api/comments', commentApi)
app.route('/api/master', masterApi)
app.route('/api/reports', reportApi)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Manual page
app.get('/manual', (c) => c.html(getManualHtml()))

// SPA
app.get('*', (c) => c.html(getIndexHtml()))

function getIndexHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>システム企画 予算管理</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a' },
            accent: { 50:'#f0fdfa',100:'#ccfbf1',500:'#14b8a6',600:'#0d9488',700:'#0f766e' },
            danger: { 50:'#fef2f2',100:'#fee2e2',500:'#ef4444',600:'#dc2626',700:'#b91c1c' },
            warning: { 50:'#fffbeb',100:'#fef3c7',500:'#f59e0b',600:'#d97706' },
            success: { 50:'#f0fdf4',100:'#dcfce7',500:'#22c55e',600:'#16a34a' }
          }
        }
      }
    }
  </script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap');
    * { font-family: 'Noto Sans JP', sans-serif; }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .sidebar-item:hover { background: rgba(59,130,246,0.08); }
    .sidebar-item.active { background: rgba(59,130,246,0.12); border-right: 3px solid #3b82f6; color: #2563eb; font-weight: 600; }
    .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    .card-hover { transition: all 0.2s ease; }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    .modal-overlay { background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
    .budget-table { border-collapse: collapse; }
    .budget-table th, .budget-table td { border: 1px solid #e2e8f0; padding: 4px 8px; font-size: 12px; text-align: right; white-space: nowrap; }
    .budget-table th { background: #f1f5f9; font-weight: 600; text-align: center; position: sticky; top: 0; z-index: 5; }
    .budget-table .row-header { text-align: left; background: #f8fafc; font-weight: 500; position: sticky; left: 0; z-index: 4; }
    .budget-table .input-cell { background: #fffbeb; }
    .budget-table .ref-cell { background: #f0fdf4; }
    .budget-table .actual-cell { background: #eff6ff; }
    .budget-table .negative { color: #dc2626; }
    .budget-table .positive { color: #16a34a; }
    .budget-table .subtotal-row { background: #e2e8f0 !important; font-weight: 700; }
    .budget-table .total-row { background: #1e40af !important; color: white !important; font-weight: 700; }
    .budget-table input[type="number"] { width: 72px; text-align: right; padding: 2px 4px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 12px; background: #fffef5; }
    .budget-table input[type="number"]:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
    .progress-bar { transition: width 0.8s ease; }
    .tooltip { position: relative; }
    .tooltip:hover::after { content: attr(data-tip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: #1e293b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; white-space: nowrap; z-index: 50; }
    .tab-btn { padding: 8px 16px; font-size: 13px; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.15s; }
    .tab-btn:hover { color: #2563eb; }
    .tab-btn.active { color: #2563eb; border-color: #2563eb; font-weight: 600; }
    .btn-primary { background: #2563eb; color: white; padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; transition: all 0.15s; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary { background: #f1f5f9; color: #475569; padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; transition: all 0.15s; }
    .btn-secondary:hover { background: #e2e8f0; }
    .btn-danger { background: #dc2626; color: white; padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; transition: all 0.15s; }
    .btn-danger:hover { background: #b91c1c; }
    .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    @media print {
      .sidebar, .no-print { display: none !important; }
      .main-content { margin-left: 0 !important; }
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div id="app" class="flex min-h-screen">
    <!-- Sidebar -->
    <aside id="sidebar" class="sidebar w-60 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col fixed h-full z-30 transition-transform lg:translate-x-0 -translate-x-full">
      <div class="p-4 border-b border-gray-100">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
            <i class="fas fa-building-columns text-white text-sm"></i>
          </div>
          <div>
            <h1 class="text-sm font-bold text-gray-800 leading-tight">システム企画</h1>
            <p class="text-[10px] text-gray-400">予算管理ダッシュボード</p>
          </div>
        </div>
      </div>
      <nav class="flex-1 py-3 overflow-y-auto">
        <div class="px-3 mb-1.5"><p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">メイン</p></div>
        <a href="#" onclick="navigateTo('dashboard')" data-page="dashboard" class="sidebar-item flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-600 cursor-pointer">
          <i class="fas fa-gauge-high w-4 text-center text-xs"></i><span>ダッシュボード</span>
        </a>
        <a href="#" onclick="navigateTo('budget-input')" data-page="budget-input" class="sidebar-item flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-600 cursor-pointer">
          <i class="fas fa-table-cells w-4 text-center text-xs"></i><span>予算データ入力</span>
        </a>
        <div class="px-3 mt-4 mb-1.5"><p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">分析</p></div>
        <a href="#" onclick="navigateTo('analysis')" data-page="analysis" class="sidebar-item flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-600 cursor-pointer">
          <i class="fas fa-chart-column w-4 text-center text-xs"></i><span>予実差異分析</span>
        </a>
        <a href="#" onclick="navigateTo('multi-year')" data-page="multi-year" class="sidebar-item flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-600 cursor-pointer">
          <i class="fas fa-calendar-days w-4 text-center text-xs"></i><span>中期比較</span>
        </a>
        <a href="#" onclick="navigateTo('reports')" data-page="reports" class="sidebar-item flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-600 cursor-pointer">
          <i class="fas fa-file-export w-4 text-center text-xs"></i><span>レポート出力</span>
        </a>
        <div class="px-3 mt-4 mb-1.5"><p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">マスタ管理</p></div>
        <a href="#" onclick="navigateTo('master-systems')" data-page="master-systems" class="sidebar-item flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-600 cursor-pointer">
          <i class="fas fa-server w-4 text-center text-xs"></i><span>システム管理</span>
        </a>
        <a href="#" onclick="navigateTo('master-expenses')" data-page="master-expenses" class="sidebar-item flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-600 cursor-pointer">
          <i class="fas fa-tags w-4 text-center text-xs"></i><span>費目管理</span>
        </a>
        <a href="#" onclick="navigateTo('comments')" data-page="comments" class="sidebar-item flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-600 cursor-pointer">
          <i class="fas fa-comments w-4 text-center text-xs"></i><span>差異コメント</span>
        </a>
        <div class="px-3 mt-3">
          <a href="/manual" target="_blank" class="flex items-center gap-2 px-4 py-2 text-[12px] text-gray-400 hover:text-blue-600 transition-colors">
            <i class="fas fa-book-open w-4 text-center"></i><span>操作マニュアル</span><i class="fas fa-external-link-alt text-[9px] ml-auto"></i>
          </a>
        </div>
      </nav>
      <div class="p-3 border-t border-gray-100">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
            <i class="fas fa-user text-blue-600 text-xs"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-gray-700 truncate">山田 太郎</p>
            <p class="text-[10px] text-gray-400">管理者</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="main-content flex-1 lg:ml-60">
      <header class="bg-white border-b border-gray-200 sticky top-0 z-20 no-print">
        <div class="flex items-center justify-between px-5 py-2.5">
          <div class="flex items-center gap-3">
            <button onclick="toggleSidebar()" class="lg:hidden text-gray-500 hover:text-gray-700">
              <i class="fas fa-bars"></i>
            </button>
            <div id="breadcrumb" class="text-[13px] text-gray-500">
              <span class="text-gray-400">ホーム</span>
              <i class="fas fa-chevron-right text-[10px] mx-1.5 text-gray-300"></i>
              <span class="text-gray-700 font-medium">ダッシュボード</span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1.5 text-[13px]">
              <label class="text-gray-500">年度:</label>
              <select id="fiscalYearSelect" onchange="onFiscalYearChange()" class="border border-gray-200 rounded-md px-2.5 py-1 text-[13px] bg-white focus:border-blue-500">
              </select>
            </div>
            <span class="text-gray-300">|</span>
            <span class="text-[11px] text-gray-400">単位: 千円（税抜）</span>
            <button onclick="refreshData()" class="text-gray-400 hover:text-blue-600 transition-colors" title="更新">
              <i class="fas fa-sync-alt text-sm"></i>
            </button>
          </div>
        </div>
      </header>

      <main id="mainContent" class="p-5">
        <div class="flex items-center justify-center h-64">
          <div class="text-center">
            <i class="fas fa-spinner fa-spin text-2xl text-blue-500 mb-3"></i>
            <p class="text-sm text-gray-500">読み込み中...</p>
          </div>
        </div>
      </main>
    </div>
  </div>

  <div id="sidebarOverlay" class="fixed inset-0 bg-black/50 z-20 hidden lg:hidden" onclick="toggleSidebar()"></div>
  <div id="modalContainer" class="fixed inset-0 z-50 hidden"></div>
  <div id="toastContainer" class="fixed top-4 right-4 z-[60] flex flex-col gap-2"></div>

  <script src="/static/app.js"></script>
</body>
</html>`
}

export default app
