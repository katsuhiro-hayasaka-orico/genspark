import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { budgetApi } from './routes/budget'
import { actualApi } from './routes/actual'
import { committedApi } from './routes/committed'
import { masterApi } from './routes/master'
import { dashboardApi } from './routes/dashboard'
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
app.route('/api/actuals', actualApi)
app.route('/api/committed', committedApi)
app.route('/api/master', masterApi)
app.route('/api/reports', reportApi)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Manual page
app.get('/manual', (c) => {
  return c.html(getManualHtml())
})

// SPA - serve index.html for all non-API routes
app.get('*', (c) => {
  return c.html(getIndexHtml())
})

function getIndexHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IT予算管理ダッシュボード</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a' },
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
    .sidebar-item:hover { background: rgba(59,130,246,0.1); }
    .sidebar-item.active { background: rgba(59,130,246,0.15); border-right: 3px solid #3b82f6; }
    .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
    .card-hover { transition: all 0.2s ease; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    .modal-overlay { background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
    .tooltip { position: relative; }
    .tooltip:hover::after { content: attr(data-tip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: #1e293b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; white-space: nowrap; z-index: 50; }
    .progress-bar { transition: width 0.8s ease; }
    .table-row:hover { background: #f8fafc; }
    input:focus, select:focus, textarea:focus { outline: none; ring: 2px; ring-color: #3b82f6; }
    .btn-primary { background: #2563eb; color: white; padding: 8px 16px; border-radius: 6px; font-weight: 500; transition: all 0.15s; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary { background: #f1f5f9; color: #475569; padding: 8px 16px; border-radius: 6px; font-weight: 500; transition: all 0.15s; }
    .btn-secondary:hover { background: #e2e8f0; }
    .btn-danger { background: #dc2626; color: white; padding: 8px 16px; border-radius: 6px; font-weight: 500; transition: all 0.15s; }
    .btn-danger:hover { background: #b91c1c; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div id="app" class="flex min-h-screen">
    <!-- Sidebar -->
    <aside id="sidebar" class="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col fixed h-full z-30 transition-transform lg:translate-x-0 -translate-x-full">
      <div class="p-5 border-b border-gray-100">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
            <i class="fas fa-chart-pie text-white text-lg"></i>
          </div>
          <div>
            <h1 class="text-base font-bold text-gray-800">IT予算管理</h1>
            <p class="text-xs text-gray-400">Budget Dashboard</p>
          </div>
        </div>
      </div>
      <nav class="flex-1 py-4 overflow-y-auto">
        <div class="px-4 mb-2">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">メイン</p>
        </div>
        <a href="#" onclick="navigateTo('dashboard')" data-page="dashboard" class="sidebar-item flex items-center gap-3 px-5 py-3 text-sm text-gray-600 cursor-pointer">
          <i class="fas fa-tachometer-alt w-5 text-center"></i><span>ダッシュボード</span>
        </a>
        <a href="#" onclick="navigateTo('budgets')" data-page="budgets" class="sidebar-item flex items-center gap-3 px-5 py-3 text-sm text-gray-600 cursor-pointer">
          <i class="fas fa-wallet w-5 text-center"></i><span>予算管理</span>
        </a>
        <a href="#" onclick="navigateTo('actuals')" data-page="actuals" class="sidebar-item flex items-center gap-3 px-5 py-3 text-sm text-gray-600 cursor-pointer">
          <i class="fas fa-receipt w-5 text-center"></i><span>実績入力</span>
        </a>
        <a href="#" onclick="navigateTo('committed')" data-page="committed" class="sidebar-item flex items-center gap-3 px-5 py-3 text-sm text-gray-600 cursor-pointer">
          <i class="fas fa-file-invoice w-5 text-center"></i><span>コミット管理</span>
        </a>
        <div class="px-4 mt-5 mb-2">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">分析</p>
        </div>
        <a href="#" onclick="navigateTo('analysis')" data-page="analysis" class="sidebar-item flex items-center gap-3 px-5 py-3 text-sm text-gray-600 cursor-pointer">
          <i class="fas fa-chart-line w-5 text-center"></i><span>予実分析</span>
        </a>
        <a href="#" onclick="navigateTo('reports')" data-page="reports" class="sidebar-item flex items-center gap-3 px-5 py-3 text-sm text-gray-600 cursor-pointer">
          <i class="fas fa-file-pdf w-5 text-center"></i><span>レポート出力</span>
        </a>
        <div class="px-4 mt-5 mb-2">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">設定</p>
        </div>
        <a href="#" onclick="navigateTo('categories')" data-page="categories" class="sidebar-item flex items-center gap-3 px-5 py-3 text-sm text-gray-600 cursor-pointer">
          <i class="fas fa-folder-tree w-5 text-center"></i><span>カテゴリ管理</span>
        </a>
        <a href="#" onclick="navigateTo('departments')" data-page="departments" class="sidebar-item flex items-center gap-3 px-5 py-3 text-sm text-gray-600 cursor-pointer">
          <i class="fas fa-building w-5 text-center"></i><span>部門管理</span>
        </a>
        <a href="#" onclick="navigateTo('projects')" data-page="projects" class="sidebar-item flex items-center gap-3 px-5 py-3 text-sm text-gray-600 cursor-pointer">
          <i class="fas fa-project-diagram w-5 text-center"></i><span>プロジェクト管理</span>
        </a>
        <div class="px-4 mt-4">
          <a href="/manual" target="_blank" class="sidebar-item flex items-center gap-3 px-5 py-3 text-sm text-gray-400 hover:text-blue-600 cursor-pointer">
            <i class="fas fa-book-open w-5 text-center"></i><span>操作マニュアル</span><i class="fas fa-external-link-alt text-[10px] ml-auto"></i>
          </a>
        </div>
      </nav>
      <div class="p-4 border-t border-gray-100">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <i class="fas fa-user text-blue-600 text-sm"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-700 truncate">山田 太郎</p>
            <p class="text-xs text-gray-400">管理者</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 lg:ml-64">
      <!-- Top Bar -->
      <header class="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div class="flex items-center justify-between px-6 py-3">
          <div class="flex items-center gap-4">
            <button onclick="toggleSidebar()" class="lg:hidden text-gray-500 hover:text-gray-700">
              <i class="fas fa-bars text-xl"></i>
            </button>
            <div id="breadcrumb" class="text-sm text-gray-500">
              <span class="text-gray-400">ホーム</span>
              <i class="fas fa-chevron-right text-xs mx-2 text-gray-300"></i>
              <span class="text-gray-700 font-medium">ダッシュボード</span>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2 text-sm">
              <label class="text-gray-500">年度:</label>
              <select id="fiscalYearSelect" onchange="onFiscalYearChange()" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
              </select>
            </div>
            <button onclick="refreshData()" class="text-gray-400 hover:text-blue-600 transition-colors" title="データ更新">
              <i class="fas fa-sync-alt"></i>
            </button>
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <main id="mainContent" class="p-6">
        <div class="flex items-center justify-center h-64">
          <div class="text-center">
            <i class="fas fa-spinner fa-spin text-3xl text-blue-500 mb-4"></i>
            <p class="text-gray-500">読み込み中...</p>
          </div>
        </div>
      </main>
    </div>
  </div>

  <!-- Mobile sidebar overlay -->
  <div id="sidebarOverlay" class="fixed inset-0 bg-black/50 z-20 hidden lg:hidden" onclick="toggleSidebar()"></div>

  <!-- Modal Container -->
  <div id="modalContainer" class="fixed inset-0 z-50 hidden"></div>

  <!-- Toast Container -->
  <div id="toastContainer" class="fixed top-4 right-4 z-[60] flex flex-col gap-2"></div>

  <script src="/static/app.js"></script>
</body>
</html>`
}

export default app
