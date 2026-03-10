// Manual page HTML content
export function getManualHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IT予算管理ダッシュボード - 操作マニュアル</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap');
    * { font-family: 'Noto Sans JP', sans-serif; scroll-behavior: smooth; }
    .toc-link { transition: all 0.15s; }
    .toc-link:hover { color: #2563eb; transform: translateX(4px); }
    .toc-link.active { color: #2563eb; font-weight: 600; border-left-color: #2563eb; }
    .section-card { transition: all 0.2s; }
    .section-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .step-number {
      width: 32px; height: 32px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 14px; flex-shrink: 0;
    }
    .mockup-box {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;
      position: relative; overflow: hidden;
    }
    .mockup-box::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 32px;
      background: #e2e8f0; border-radius: 12px 12px 0 0;
    }
    .mockup-box::after {
      content: '\\f108'; font-family: 'Font Awesome 6 Free'; font-weight: 900;
      position: absolute; top: 6px; right: 12px; color: #94a3b8; font-size: 14px;
    }
    .mockup-content { margin-top: 20px; }
    .kbd {
      background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px;
      padding: 2px 6px; font-size: 12px; font-weight: 500; color: #475569;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .alert-box { border-left: 4px solid; padding: 12px 16px; border-radius: 0 8px 8px 0; }
    .alert-info { background: #eff6ff; border-color: #3b82f6; }
    .alert-warning { background: #fffbeb; border-color: #f59e0b; }
    .alert-danger { background: #fef2f2; border-color: #ef4444; }
    .alert-success { background: #f0fdf4; border-color: #22c55e; }
    @media print {
      .no-print { display: none !important; }
      .print-break { page-break-before: always; }
      body { font-size: 11pt; }
    }
  </style>
</head>
<body class="bg-gray-50 text-gray-800">

  <!-- Header -->
  <header class="bg-white border-b border-gray-200 sticky top-0 z-50 no-print">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
            <i class="fas fa-book-open text-white text-sm"></i>
          </div>
          <div>
            <h1 class="text-base font-bold text-gray-800">操作マニュアル</h1>
            <p class="text-xs text-gray-400">IT予算管理ダッシュボード v1.0</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <a href="/" class="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <i class="fas fa-arrow-left text-xs"></i> アプリに戻る
          </a>
          <button onclick="window.print()" class="text-gray-400 hover:text-gray-600 ml-2" title="印刷">
            <i class="fas fa-print"></i>
          </button>
        </div>
      </div>
    </div>
  </header>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex gap-8">

      <!-- Sidebar TOC -->
      <aside class="hidden lg:block w-64 flex-shrink-0 no-print">
        <div class="sticky top-24">
          <nav class="space-y-1" id="tocNav">
            <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">目次</p>
            <a href="#overview" class="toc-link block text-sm text-gray-500 py-1.5 px-3 border-l-2 border-gray-200">はじめに</a>
            <a href="#screen-layout" class="toc-link block text-sm text-gray-500 py-1.5 px-3 border-l-2 border-gray-200">画面構成</a>
            <a href="#dashboard" class="toc-link block text-sm text-gray-500 py-1.5 px-3 border-l-2 border-gray-200">ダッシュボード</a>
            <a href="#budget" class="toc-link block text-sm text-gray-500 py-1.5 px-3 border-l-2 border-gray-200">予算管理</a>
            <a href="#actual" class="toc-link block text-sm text-gray-500 py-1.5 px-3 border-l-2 border-gray-200">実績入力</a>
            <a href="#committed" class="toc-link block text-sm text-gray-500 py-1.5 px-3 border-l-2 border-gray-200">コミット管理</a>
            <a href="#analysis" class="toc-link block text-sm text-gray-500 py-1.5 px-3 border-l-2 border-gray-200">予実分析</a>
            <a href="#reports" class="toc-link block text-sm text-gray-500 py-1.5 px-3 border-l-2 border-gray-200">レポート出力</a>
            <a href="#master" class="toc-link block text-sm text-gray-500 py-1.5 px-3 border-l-2 border-gray-200">マスタ管理</a>
            <a href="#csv-format" class="toc-link block text-sm text-gray-500 py-1.5 px-3 border-l-2 border-gray-200">CSVフォーマット</a>
            <a href="#alert-rules" class="toc-link block text-sm text-gray-500 py-1.5 px-3 border-l-2 border-gray-200">アラートルール</a>
            <a href="#glossary" class="toc-link block text-sm text-gray-500 py-1.5 px-3 border-l-2 border-gray-200">用語集</a>
            <a href="#faq" class="toc-link block text-sm text-gray-500 py-1.5 px-3 border-l-2 border-gray-200">FAQ</a>
            <a href="#shortcuts" class="toc-link block text-sm text-gray-500 py-1.5 px-3 border-l-2 border-gray-200">操作のコツ</a>
          </nav>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 min-w-0 space-y-10">

        <!-- Hero -->
        <div class="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 md:p-12 text-white">
          <div class="max-w-2xl">
            <div class="flex items-center gap-2 mb-4">
              <span class="bg-white/20 text-xs font-medium px-2.5 py-1 rounded-full">v1.0</span>
              <span class="bg-white/20 text-xs font-medium px-2.5 py-1 rounded-full">最終更新: 2026年3月</span>
            </div>
            <h2 class="text-3xl md:text-4xl font-bold mb-4">IT予算予実績管理<br>ダッシュボード操作マニュアル</h2>
            <p class="text-blue-100 text-base leading-relaxed">
              本マニュアルでは、IT予算管理ダッシュボードの全機能について、
              操作手順を画面イメージ付きでステップ・バイ・ステップで解説します。
            </p>
            <div class="flex flex-wrap gap-3 mt-6">
              <span class="bg-white/10 backdrop-blur rounded-lg px-3 py-2 text-sm flex items-center gap-2"><i class="fas fa-tachometer-alt"></i> ダッシュボード</span>
              <span class="bg-white/10 backdrop-blur rounded-lg px-3 py-2 text-sm flex items-center gap-2"><i class="fas fa-wallet"></i> 予算管理</span>
              <span class="bg-white/10 backdrop-blur rounded-lg px-3 py-2 text-sm flex items-center gap-2"><i class="fas fa-receipt"></i> 実績入力</span>
              <span class="bg-white/10 backdrop-blur rounded-lg px-3 py-2 text-sm flex items-center gap-2"><i class="fas fa-chart-line"></i> 予実分析</span>
              <span class="bg-white/10 backdrop-blur rounded-lg px-3 py-2 text-sm flex items-center gap-2"><i class="fas fa-file-pdf"></i> レポート</span>
            </div>
          </div>
        </div>

        <!-- ========================================= -->
        <!-- 1. はじめに -->
        <!-- ========================================= -->
        <section id="overview" class="scroll-mt-24">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><i class="fas fa-info-circle text-blue-600"></i></span>
            1. はじめに
          </h2>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 section-card space-y-4">
            <h3 class="font-semibold text-gray-700 text-lg">このシステムでできること</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex gap-3 items-start">
                <div class="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i class="fas fa-wallet text-blue-500 text-sm"></i>
                </div>
                <div>
                  <p class="font-medium text-gray-700 text-sm">年度予算の計画・管理</p>
                  <p class="text-xs text-gray-500 mt-0.5">カテゴリ別・部門別・プロジェクト別に月次予算を設定</p>
                </div>
              </div>
              <div class="flex gap-3 items-start">
                <div class="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i class="fas fa-receipt text-indigo-500 text-sm"></i>
                </div>
                <div>
                  <p class="font-medium text-gray-700 text-sm">実績・コミットの記録</p>
                  <p class="text-xs text-gray-500 mt-0.5">手入力・CSVインポートで実績データを登録</p>
                </div>
              </div>
              <div class="flex gap-3 items-start">
                <div class="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i class="fas fa-chart-line text-green-500 text-sm"></i>
                </div>
                <div>
                  <p class="font-medium text-gray-700 text-sm">リアルタイム予実分析</p>
                  <p class="text-xs text-gray-500 mt-0.5">消化率・残額・差異を自動計算、超過アラート通知</p>
                </div>
              </div>
              <div class="flex gap-3 items-start">
                <div class="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i class="fas fa-file-pdf text-red-500 text-sm"></i>
                </div>
                <div>
                  <p class="font-medium text-gray-700 text-sm">レポート出力</p>
                  <p class="text-xs text-gray-500 mt-0.5">PDF / Excel / CSV形式で帳票を出力</p>
                </div>
              </div>
            </div>

            <div class="alert-box alert-info mt-6">
              <p class="text-sm font-medium text-blue-800"><i class="fas fa-lightbulb mr-2"></i>対象ユーザー</p>
              <p class="text-sm text-blue-700 mt-1">情報システム部門の予算管理者、経理担当者、部門マネージャー向けのシステムです。<br>PC・タブレット・スマートフォンのWebブラウザからアクセスできます。</p>
            </div>

            <h3 class="font-semibold text-gray-700 text-lg pt-4">予算管理の計算式</h3>
            <div class="bg-gray-50 rounded-lg p-4 space-y-2">
              <div class="flex items-center gap-3 text-sm">
                <span class="font-mono bg-white border border-gray-200 rounded px-2 py-1 text-xs font-bold text-blue-700 whitespace-nowrap">予算残額</span>
                <span class="text-gray-500">= 予算額 - 実績額 - コミット額</span>
              </div>
              <div class="flex items-center gap-3 text-sm">
                <span class="font-mono bg-white border border-gray-200 rounded px-2 py-1 text-xs font-bold text-blue-700 whitespace-nowrap">消化率</span>
                <span class="text-gray-500">= 実績額 &divide; 予算額 &times; 100 (%)</span>
              </div>
              <div class="flex items-center gap-3 text-sm">
                <span class="font-mono bg-white border border-gray-200 rounded px-2 py-1 text-xs font-bold text-blue-700 whitespace-nowrap">差異</span>
                <span class="text-gray-500">= 実績額 - 予算額 <span class="text-xs">(プラス=超過 / マイナス=未使用)</span></span>
              </div>
              <div class="flex items-center gap-3 text-sm">
                <span class="font-mono bg-white border border-gray-200 rounded px-2 py-1 text-xs font-bold text-blue-700 whitespace-nowrap">着地見込</span>
                <span class="text-gray-500">= 累計実績 + コミット額 + 残月の予測支出</span>
              </div>
            </div>
          </div>
        </section>

        <!-- ========================================= -->
        <!-- 2. 画面構成 -->
        <!-- ========================================= -->
        <section id="screen-layout" class="scroll-mt-24 print-break">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center"><i class="fas fa-desktop text-purple-600"></i></span>
            2. 画面構成
          </h2>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 section-card space-y-6">
            <p class="text-sm text-gray-600">システムは<strong>サイドバーナビゲーション</strong>と<strong>メインコンテンツエリア</strong>で構成されています。</p>

            <!-- Layout Mockup -->
            <div class="mockup-box">
              <div class="mockup-content">
                <div class="flex gap-3">
                  <!-- Mini Sidebar -->
                  <div class="w-44 bg-white rounded-lg border border-gray-200 p-3 flex-shrink-0">
                    <div class="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                      <div class="w-6 h-6 bg-blue-500 rounded flex items-center justify-center"><i class="fas fa-chart-pie text-white text-[8px]"></i></div>
                      <span class="text-[10px] font-bold text-gray-700">IT予算管理</span>
                    </div>
                    <div class="text-[9px] text-gray-400 font-semibold mb-1 uppercase">メイン</div>
                    <div class="space-y-0.5">
                      <div class="flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded px-2 py-1 text-[10px] font-medium border-r-2 border-blue-500"><i class="fas fa-tachometer-alt w-3 text-[8px]"></i> ダッシュボード</div>
                      <div class="flex items-center gap-1.5 text-gray-500 rounded px-2 py-1 text-[10px]"><i class="fas fa-wallet w-3 text-[8px]"></i> 予算管理</div>
                      <div class="flex items-center gap-1.5 text-gray-500 rounded px-2 py-1 text-[10px]"><i class="fas fa-receipt w-3 text-[8px]"></i> 実績入力</div>
                      <div class="flex items-center gap-1.5 text-gray-500 rounded px-2 py-1 text-[10px]"><i class="fas fa-file-invoice w-3 text-[8px]"></i> コミット管理</div>
                    </div>
                    <div class="text-[9px] text-gray-400 font-semibold mt-2 mb-1 uppercase">分析</div>
                    <div class="space-y-0.5">
                      <div class="flex items-center gap-1.5 text-gray-500 rounded px-2 py-1 text-[10px]"><i class="fas fa-chart-line w-3 text-[8px]"></i> 予実分析</div>
                      <div class="flex items-center gap-1.5 text-gray-500 rounded px-2 py-1 text-[10px]"><i class="fas fa-file-pdf w-3 text-[8px]"></i> レポート出力</div>
                    </div>
                    <div class="text-[9px] text-gray-400 font-semibold mt-2 mb-1 uppercase">設定</div>
                    <div class="space-y-0.5">
                      <div class="flex items-center gap-1.5 text-gray-500 rounded px-2 py-1 text-[10px]"><i class="fas fa-folder-tree w-3 text-[8px]"></i> カテゴリ管理</div>
                      <div class="flex items-center gap-1.5 text-gray-500 rounded px-2 py-1 text-[10px]"><i class="fas fa-building w-3 text-[8px]"></i> 部門管理</div>
                      <div class="flex items-center gap-1.5 text-gray-500 rounded px-2 py-1 text-[10px]"><i class="fas fa-project-diagram w-3 text-[8px]"></i> プロジェクト管理</div>
                    </div>
                  </div>
                  <!-- Mini Main Area -->
                  <div class="flex-1 space-y-2">
                    <div class="bg-white rounded-lg border border-gray-200 px-3 py-2 flex justify-between items-center">
                      <span class="text-[10px] text-gray-500">ホーム &rsaquo; <strong>ダッシュボード</strong></span>
                      <div class="flex items-center gap-2">
                        <span class="text-[9px] text-gray-400">年度:</span>
                        <span class="text-[9px] bg-gray-100 rounded px-2 py-0.5">FY2025</span>
                        <i class="fas fa-sync-alt text-gray-400 text-[8px]"></i>
                      </div>
                    </div>
                    <div class="grid grid-cols-4 gap-1.5">
                      <div class="bg-white rounded border border-gray-200 p-2"><p class="text-[8px] text-gray-400">年間予算総額</p><p class="text-[11px] font-bold text-gray-700">58,000万</p></div>
                      <div class="bg-white rounded border border-gray-200 p-2"><p class="text-[8px] text-gray-400">累計実績</p><p class="text-[11px] font-bold text-gray-700">54,935万</p></div>
                      <div class="bg-white rounded border border-gray-200 p-2"><p class="text-[8px] text-gray-400">消化率</p><p class="text-[11px] font-bold text-orange-600">94.7%</p></div>
                      <div class="bg-white rounded border border-gray-200 p-2"><p class="text-[8px] text-gray-400">残予算</p><p class="text-[11px] font-bold text-red-600">-2,035万</p></div>
                    </div>
                    <div class="grid grid-cols-2 gap-1.5">
                      <div class="bg-white rounded border border-gray-200 p-2 h-20 flex items-center justify-center text-[9px] text-gray-400"><i class="fas fa-chart-bar mr-1"></i> 月別予実比較チャート</div>
                      <div class="bg-white rounded border border-gray-200 p-2 h-20 flex items-center justify-center text-[9px] text-gray-400"><i class="fas fa-chart-pie mr-1"></i> カテゴリ別円グラフ</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div class="bg-blue-50 rounded-lg p-4">
                <p class="text-sm font-semibold text-blue-800 mb-1"><i class="fas fa-columns mr-1"></i> サイドバー</p>
                <p class="text-xs text-blue-700">全9画面へのナビゲーション。3つのグループ（メイン・分析・設定）に分類。モバイルではハンバーガーメニューで開閉。</p>
              </div>
              <div class="bg-purple-50 rounded-lg p-4">
                <p class="text-sm font-semibold text-purple-800 mb-1"><i class="fas fa-heading mr-1"></i> ヘッダーバー</p>
                <p class="text-xs text-purple-700">パンくずリスト、年度切替セレクタ、データ更新ボタンを配置。全画面共通で表示されます。</p>
              </div>
              <div class="bg-green-50 rounded-lg p-4">
                <p class="text-sm font-semibold text-green-800 mb-1"><i class="fas fa-window-maximize mr-1"></i> メインエリア</p>
                <p class="text-xs text-green-700">選択した機能の内容が表示されるエリア。チャート、テーブル、入力フォームなどが動的に切り替わります。</p>
              </div>
            </div>

            <div class="alert-box alert-info">
              <p class="text-sm text-blue-700"><i class="fas fa-mobile-alt mr-2"></i><strong>モバイル対応:</strong> スマートフォン/タブレットでもレスポンシブに対応。画面左上のメニューボタン <span class="kbd"><i class="fas fa-bars"></i></span> でサイドバーを開閉できます。</p>
            </div>
          </div>
        </section>

        <!-- ========================================= -->
        <!-- 3. ダッシュボード -->
        <!-- ========================================= -->
        <section id="dashboard" class="scroll-mt-24 print-break">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span class="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center"><i class="fas fa-tachometer-alt text-sky-600"></i></span>
            3. ダッシュボード
          </h2>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 section-card space-y-6">
            <p class="text-sm text-gray-600">ログイン後の初期画面です。選択した年度の予算状況を<strong>一目で把握</strong>できます。</p>

            <h3 class="font-semibold text-gray-700">3.1 KPIカード</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center"><i class="fas fa-wallet text-blue-500 text-sm"></i></div>
                  <span class="text-xs text-gray-500">年間予算総額</span>
                </div>
                <p class="text-lg font-bold text-gray-800">58,000 <span class="text-xs font-normal text-gray-400">万円</span></p>
                <p class="text-[10px] text-gray-400 mt-1">当年度の全カテゴリ合計予算</p>
              </div>
              <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center"><i class="fas fa-receipt text-indigo-500 text-sm"></i></div>
                  <span class="text-xs text-gray-500">年累計実績</span>
                </div>
                <p class="text-lg font-bold text-gray-800">54,935 <span class="text-xs font-normal text-gray-400">万円</span></p>
                <p class="text-[10px] text-gray-400 mt-1">当月までの支払い済み総額</p>
              </div>
              <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center"><i class="fas fa-chart-pie text-yellow-500 text-sm"></i></div>
                  <span class="text-xs text-gray-500">予算消化率</span>
                </div>
                <p class="text-lg font-bold text-orange-600">94.7%</p>
                <div class="w-full bg-gray-200 rounded-full h-1.5 mt-1"><div class="bg-yellow-500 h-1.5 rounded-full" style="width:94.7%"></div></div>
              </div>
              <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center"><i class="fas fa-piggy-bank text-red-500 text-sm"></i></div>
                  <span class="text-xs text-gray-500">残予算</span>
                </div>
                <p class="text-lg font-bold text-red-600">-2,035 <span class="text-xs font-normal text-gray-400">万円</span></p>
                <p class="text-[10px] text-gray-400 mt-1">マイナス = コミット込みで超過</p>
              </div>
            </div>

            <h3 class="font-semibold text-gray-700">3.2 超過アラート</h3>
            <p class="text-sm text-gray-500">消化率（実績+コミット &divide; 予算）が閾値を超えたカテゴリがカードで表示されます。</p>
            <div class="flex flex-wrap gap-2">
              <div class="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-3">
                <div><p class="text-xs font-medium text-red-700">クラウド</p><p class="text-[10px] text-gray-500">15,050万 / 14,400万</p></div>
                <span class="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">114.9%</span>
              </div>
              <div class="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 flex items-center gap-3">
                <div><p class="text-xs font-medium text-yellow-700">教育・研修</p><p class="text-[10px] text-gray-500">1,470万 / 1,800万</p></div>
                <span class="bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">81.7%</span>
              </div>
            </div>

            <h3 class="font-semibold text-gray-700">3.3 チャートエリア</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="bg-gray-50 rounded-lg p-4 text-center">
                <i class="fas fa-chart-bar text-blue-400 text-2xl mb-2"></i>
                <p class="text-sm font-medium text-gray-700">月別予実比較</p>
                <p class="text-xs text-gray-500 mt-1">各月の予算(青)・実績(紫)・コミット(黄)を棒グラフで比較</p>
              </div>
              <div class="bg-gray-50 rounded-lg p-4 text-center">
                <i class="fas fa-chart-pie text-purple-400 text-2xl mb-2"></i>
                <p class="text-sm font-medium text-gray-700">カテゴリ別配分</p>
                <p class="text-xs text-gray-500 mt-1">予算配分比率をドーナツチャートで視覚化</p>
              </div>
              <div class="bg-gray-50 rounded-lg p-4 text-center">
                <i class="fas fa-chart-line text-green-400 text-2xl mb-2"></i>
                <p class="text-sm font-medium text-gray-700">累計予実推移</p>
                <p class="text-xs text-gray-500 mt-1">年初からの累計推移を折れ線グラフで表示</p>
              </div>
            </div>

            <div class="alert-box alert-success">
              <p class="text-sm text-green-700"><i class="fas fa-sync-alt mr-2"></i><strong>データ更新:</strong> ヘッダー右側の <span class="kbd"><i class="fas fa-sync-alt"></i></span> ボタンで最新データに更新されます。年度セレクタを切り替えると、その年度のデータに自動的に切り替わります。</p>
            </div>
          </div>
        </section>

        <!-- ========================================= -->
        <!-- 4. 予算管理 -->
        <!-- ========================================= -->
        <section id="budget" class="scroll-mt-24 print-break">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><i class="fas fa-wallet text-blue-600"></i></span>
            4. 予算管理
          </h2>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 section-card space-y-6">
            <p class="text-sm text-gray-600">年度予算の登録・編集を行います。カテゴリ &times; 部門の組み合わせで12ヶ月の予算を月別に設定できます。</p>

            <h3 class="font-semibold text-gray-700">予算の新規登録手順</h3>
            <div class="space-y-4">
              <div class="flex gap-4 items-start">
                <span class="step-number bg-blue-100 text-blue-700">1</span>
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-700">サイドバーから「予算管理」をクリック</p>
                  <p class="text-xs text-gray-500 mt-1">現在登録されている予算一覧がカテゴリ別・部門別に表示されます。</p>
                </div>
              </div>
              <div class="flex gap-4 items-start">
                <span class="step-number bg-blue-100 text-blue-700">2</span>
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-700">右上の <span class="kbd"><i class="fas fa-plus"></i> 予算登録</span> ボタンをクリック</p>
                  <p class="text-xs text-gray-500 mt-1">予算登録のモーダルダイアログが開きます。</p>
                </div>
              </div>
              <div class="flex gap-4 items-start">
                <span class="step-number bg-blue-100 text-blue-700">3</span>
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-700">カテゴリと部門を選択</p>
                  <p class="text-xs text-gray-500 mt-1"><strong>カテゴリ</strong>: ハードウェア、クラウド等のトップレベルカテゴリから選択。<br><strong>部門</strong>: 全社共通の場合は「全社共通」のまま。</p>
                </div>
              </div>
              <div class="flex gap-4 items-start">
                <span class="step-number bg-blue-100 text-blue-700">4</span>
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-700">月別予算額を入力（万円単位）</p>
                  <div class="bg-gray-50 rounded-lg p-3 mt-2">
                    <div class="grid grid-cols-6 gap-1.5 text-center">
                      <div><p class="text-[9px] text-gray-400">4月</p><div class="bg-white border rounded px-1 py-0.5 text-xs">600</div></div>
                      <div><p class="text-[9px] text-gray-400">5月</p><div class="bg-white border rounded px-1 py-0.5 text-xs">600</div></div>
                      <div><p class="text-[9px] text-gray-400">6月</p><div class="bg-white border rounded px-1 py-0.5 text-xs">600</div></div>
                      <div><p class="text-[9px] text-gray-400">7月</p><div class="bg-white border rounded px-1 py-0.5 text-xs">600</div></div>
                      <div><p class="text-[9px] text-gray-400">8月</p><div class="bg-white border rounded px-1 py-0.5 text-xs">600</div></div>
                      <div><p class="text-[9px] text-gray-400">...</p><div class="bg-white border rounded px-1 py-0.5 text-xs text-gray-400">...</div></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex gap-4 items-start">
                <span class="step-number bg-blue-100 text-blue-700">5</span>
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-700">「保存」ボタンをクリック</p>
                  <p class="text-xs text-gray-500 mt-1">保存完了後、一覧が自動更新されます。</p>
                </div>
              </div>
            </div>

            <div class="alert-box alert-info">
              <p class="text-sm text-blue-700"><i class="fas fa-magic mr-2"></i><strong>均等配分機能:</strong> フォーム下部の「年間合計を均等配分」欄に年間予算総額（万円）を入力し「均等配分」ボタンを押すと、12ヶ月に自動配分されます。端数は12月に加算されます。</p>
            </div>

            <h3 class="font-semibold text-gray-700">既存予算の編集</h3>
            <p class="text-sm text-gray-500">一覧テーブル右端の <span class="kbd"><i class="fas fa-edit"></i></span> アイコンをクリックすると、既に登録された月別金額がフォームに読み込まれ、上書き保存ができます。</p>
          </div>
        </section>

        <!-- ========================================= -->
        <!-- 5. 実績入力 -->
        <!-- ========================================= -->
        <section id="actual" class="scroll-mt-24 print-break">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span class="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center"><i class="fas fa-receipt text-indigo-600"></i></span>
            5. 実績入力
          </h2>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 section-card space-y-6">
            <p class="text-sm text-gray-600">月次の支出実績を登録します。手入力とCSVインポートの2つの方法があります。</p>

            <h3 class="font-semibold text-gray-700">5.1 手入力で実績を登録</h3>
            <div class="space-y-3">
              <div class="flex gap-4 items-start">
                <span class="step-number bg-indigo-100 text-indigo-700">1</span>
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-700">サイドバー「実績入力」→ 右上 <span class="kbd"><i class="fas fa-plus"></i> 実績登録</span></p>
                </div>
              </div>
              <div class="flex gap-4 items-start">
                <span class="step-number bg-indigo-100 text-indigo-700">2</span>
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-700">必要項目を入力</p>
                  <div class="mt-2 overflow-x-auto">
                    <table class="text-xs w-full border border-gray-200 rounded-lg overflow-hidden">
                      <thead class="bg-gray-50">
                        <tr><th class="text-left px-3 py-2 font-semibold text-gray-600">項目</th><th class="text-left px-3 py-2 font-semibold text-gray-600">必須</th><th class="text-left px-3 py-2 font-semibold text-gray-600">説明</th></tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100">
                        <tr><td class="px-3 py-2 font-medium">月</td><td class="px-3 py-2"><span class="text-red-500">*</span></td><td class="px-3 py-2 text-gray-500">対象月（4月=1月目）</td></tr>
                        <tr><td class="px-3 py-2 font-medium">カテゴリ</td><td class="px-3 py-2"><span class="text-red-500">*</span></td><td class="px-3 py-2 text-gray-500">費用のカテゴリ</td></tr>
                        <tr><td class="px-3 py-2 font-medium">金額（円）</td><td class="px-3 py-2"><span class="text-red-500">*</span></td><td class="px-3 py-2 text-gray-500">支払額（円単位で入力）</td></tr>
                        <tr><td class="px-3 py-2 font-medium">部門</td><td class="px-3 py-2"></td><td class="px-3 py-2 text-gray-500">関連部門</td></tr>
                        <tr><td class="px-3 py-2 font-medium">説明</td><td class="px-3 py-2"></td><td class="px-3 py-2 text-gray-500">支出内容の説明（例: AWS月額利用料）</td></tr>
                        <tr><td class="px-3 py-2 font-medium">ベンダー</td><td class="px-3 py-2"></td><td class="px-3 py-2 text-gray-500">支払先ベンダー名</td></tr>
                        <tr><td class="px-3 py-2 font-medium">請求書番号</td><td class="px-3 py-2"></td><td class="px-3 py-2 text-gray-500">請求書の管理番号</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div class="flex gap-4 items-start">
                <span class="step-number bg-indigo-100 text-indigo-700">3</span>
                <div class="flex-1"><p class="text-sm font-medium text-gray-700">「登録」ボタンをクリック → 一覧に追加されます</p></div>
              </div>
            </div>

            <h3 class="font-semibold text-gray-700 pt-2">5.2 CSVインポート</h3>
            <div class="space-y-3">
              <div class="flex gap-4 items-start">
                <span class="step-number bg-green-100 text-green-700">1</span>
                <div class="flex-1"><p class="text-sm font-medium text-gray-700"><span class="kbd"><i class="fas fa-file-csv"></i> CSVインポート</span> ボタンをクリック</p></div>
              </div>
              <div class="flex gap-4 items-start">
                <span class="step-number bg-green-100 text-green-700">2</span>
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-700">CSVデータを貼り付け、またはファイルを選択</p>
                  <p class="text-xs text-gray-500 mt-1">詳細は <a href="#csv-format" class="text-blue-600 underline">CSVフォーマット</a> を参照</p>
                </div>
              </div>
              <div class="flex gap-4 items-start">
                <span class="step-number bg-green-100 text-green-700">3</span>
                <div class="flex-1"><p class="text-sm font-medium text-gray-700">「インポート」ボタンをクリック → 一括登録されます</p></div>
              </div>
            </div>

            <h3 class="font-semibold text-gray-700 pt-2">5.3 フィルタリング</h3>
            <p class="text-sm text-gray-500">一覧上部のフィルタで「月」「カテゴリ」を選択すると、該当する実績のみ表示されます。</p>

            <h3 class="font-semibold text-gray-700 pt-2">5.4 編集・削除</h3>
            <div class="flex gap-6 text-sm text-gray-600">
              <span><span class="kbd"><i class="fas fa-edit"></i></span> 編集: フォームが開き内容を修正</span>
              <span><span class="kbd text-red-500"><i class="fas fa-trash"></i></span> 削除: 確認ダイアログ後に削除</span>
            </div>
          </div>
        </section>

        <!-- ========================================= -->
        <!-- 6. コミット管理 -->
        <!-- ========================================= -->
        <section id="committed" class="scroll-mt-24 print-break">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><i class="fas fa-file-invoice text-amber-600"></i></span>
            6. コミット管理
          </h2>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 section-card space-y-6">
            <p class="text-sm text-gray-600">「コミット」とは、<strong>発注済みだが未払いの金額</strong>を指します。予算残額の正確な把握のため、コミット額は予算計算に含まれます。</p>

            <div class="alert-box alert-warning">
              <p class="text-sm text-yellow-800"><i class="fas fa-exclamation-triangle mr-2"></i><strong>重要:</strong> 予算残額 = 予算 - 実績 - <strong>コミット</strong> です。発注時にコミット登録しないと、残額が実際より多く見えてしまいます。</p>
            </div>

            <h3 class="font-semibold text-gray-700">ステータスの流れ</h3>
            <div class="flex items-center gap-2 flex-wrap text-sm">
              <span class="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium">発注済 (ordered)</span>
              <i class="fas fa-arrow-right text-gray-300 text-xs"></i>
              <span class="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-xs font-medium">納品済 (delivered)</span>
              <i class="fas fa-arrow-right text-gray-300 text-xs"></i>
              <span class="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-xs font-medium">請求済 (invoiced)</span>
              <span class="text-xs text-gray-400 mx-2">or</span>
              <span class="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full text-xs font-medium">キャンセル</span>
            </div>
            <p class="text-xs text-gray-500">請求済になった時点で「実績入力」に移行し、コミットは削除してください。キャンセルのコミットは残額計算から除外されます。</p>

            <h3 class="font-semibold text-gray-700">登録方法</h3>
            <p class="text-sm text-gray-500"><span class="kbd"><i class="fas fa-plus"></i> コミット登録</span> ボタンから、月・カテゴリ・金額・ベンダー・発注番号を入力して登録します。操作手順は実績入力と同様です。</p>
          </div>
        </section>

        <!-- ========================================= -->
        <!-- 7. 予実分析 -->
        <!-- ========================================= -->
        <section id="analysis" class="scroll-mt-24 print-break">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center"><i class="fas fa-chart-line text-green-600"></i></span>
            7. 予実分析
          </h2>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 section-card space-y-6">
            <p class="text-sm text-gray-600">予算と実績の詳細な比較分析画面です。カテゴリ別・部門別の視点で分析できます。</p>

            <h3 class="font-semibold text-gray-700">画面の構成</h3>
            <div class="space-y-3">
              <div class="flex gap-3 items-start">
                <div class="w-6 h-6 bg-blue-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5"><span class="text-white text-xs font-bold">A</span></div>
                <div>
                  <p class="text-sm font-medium text-gray-700">サマリーカード (4枚)</p>
                  <p class="text-xs text-gray-500">年間予算・累計実績・コミット済・残予算をグラデーションカードで表示</p>
                </div>
              </div>
              <div class="flex gap-3 items-start">
                <div class="w-6 h-6 bg-blue-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5"><span class="text-white text-xs font-bold">B</span></div>
                <div>
                  <p class="text-sm font-medium text-gray-700">カテゴリ別予実比較チャート (横棒グラフ)</p>
                  <p class="text-xs text-gray-500">各カテゴリの予算・実績・コミットを横並びで比較。超過状況が視覚的にわかります</p>
                </div>
              </div>
              <div class="flex gap-3 items-start">
                <div class="w-6 h-6 bg-blue-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5"><span class="text-white text-xs font-bold">C</span></div>
                <div>
                  <p class="text-sm font-medium text-gray-700">消化率トレンドチャート (折れ線グラフ)</p>
                  <p class="text-xs text-gray-500">月ごとの消化率推移。80%警告ライン（黄色）と95%危険ライン（赤色）の破線が表示されます</p>
                </div>
              </div>
              <div class="flex gap-3 items-start">
                <div class="w-6 h-6 bg-blue-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5"><span class="text-white text-xs font-bold">D</span></div>
                <div>
                  <p class="text-sm font-medium text-gray-700">カテゴリ別予実分析テーブル</p>
                  <p class="text-xs text-gray-500">予算・実績・コミット・残額・差異・消化率・進捗バーを一覧表示</p>
                </div>
              </div>
              <div class="flex gap-3 items-start">
                <div class="w-6 h-6 bg-blue-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5"><span class="text-white text-xs font-bold">E</span></div>
                <div>
                  <p class="text-sm font-medium text-gray-700">部門別サマリーテーブル</p>
                  <p class="text-xs text-gray-500">部門ごとの予算・実績・コミット・残額</p>
                </div>
              </div>
            </div>

            <h3 class="font-semibold text-gray-700">テーブルの見方</h3>
            <div class="overflow-x-auto">
              <table class="text-xs w-full border border-gray-200 rounded overflow-hidden">
                <thead class="bg-gray-50">
                  <tr><th class="text-left px-3 py-2">列名</th><th class="text-left px-3 py-2">意味</th><th class="text-left px-3 py-2">色の意味</th></tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr><td class="px-3 py-2 font-medium">残額</td><td class="px-3 py-2 text-gray-500">予算 - 実績 - コミット</td><td class="px-3 py-2"><span class="text-red-600 font-medium">赤字</span> = 超過</td></tr>
                  <tr><td class="px-3 py-2 font-medium">差異</td><td class="px-3 py-2 text-gray-500">実績 - 予算</td><td class="px-3 py-2"><span class="text-red-600">+赤</span> = 超過 / <span class="text-green-600">-緑</span> = 節約</td></tr>
                  <tr><td class="px-3 py-2 font-medium">消化率</td><td class="px-3 py-2 text-gray-500">実績 &divide; 予算 &times; 100</td><td class="px-3 py-2"><span class="text-green-600">&lt;80%</span> / <span class="text-yellow-600">&ge;80%</span> / <span class="text-red-600">&ge;95%</span></td></tr>
                  <tr><td class="px-3 py-2 font-medium">進捗バー</td><td class="px-3 py-2 text-gray-500">消化率のビジュアル表示</td><td class="px-3 py-2">青 → 黄 → 赤に変化</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- ========================================= -->
        <!-- 8. レポート出力 -->
        <!-- ========================================= -->
        <section id="reports" class="scroll-mt-24 print-break">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span class="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center"><i class="fas fa-file-pdf text-red-600"></i></span>
            8. レポート出力
          </h2>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 section-card space-y-6">
            <p class="text-sm text-gray-600">ダッシュボード上のデータを3つの形式でエクスポートできます。</p>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="border border-gray-200 rounded-xl p-5 text-center">
                <div class="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-3"><i class="fas fa-file-pdf text-red-500 text-2xl"></i></div>
                <h4 class="font-semibold text-gray-700">PDF月次報告書</h4>
                <p class="text-xs text-gray-500 mt-2 text-left">新しいウィンドウで印刷用フォーマットが開きます。ブラウザの印刷機能で「PDF保存」を選択してください。</p>
                <div class="mt-3 text-left">
                  <p class="text-[10px] text-gray-400 font-medium mb-1">操作手順:</p>
                  <ol class="text-[10px] text-gray-500 space-y-0.5 list-decimal list-inside">
                    <li>「PDF月次報告書」カードをクリック</li>
                    <li>新しいウィンドウが開き印刷ダイアログ表示</li>
                    <li>「送信先」で「PDFとして保存」を選択</li>
                    <li>「保存」をクリック</li>
                  </ol>
                </div>
              </div>
              <div class="border border-gray-200 rounded-xl p-5 text-center">
                <div class="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-3"><i class="fas fa-file-excel text-green-500 text-2xl"></i></div>
                <h4 class="font-semibold text-gray-700">Excelエクスポート</h4>
                <p class="text-xs text-gray-500 mt-2 text-left">SpreadsheetML形式(.xls)でダウンロードされます。Excel、Google スプレッドシート等で開けます。</p>
                <div class="mt-3 text-left">
                  <p class="text-[10px] text-gray-400 font-medium mb-1">操作手順:</p>
                  <ol class="text-[10px] text-gray-500 space-y-0.5 list-decimal list-inside">
                    <li>「Excelエクスポート」カードをクリック</li>
                    <li>自動ダウンロード開始</li>
                    <li>Excelで開いて編集可能</li>
                  </ol>
                </div>
              </div>
              <div class="border border-gray-200 rounded-xl p-5 text-center">
                <div class="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3"><i class="fas fa-file-csv text-blue-500 text-2xl"></i></div>
                <h4 class="font-semibold text-gray-700">CSVエクスポート</h4>
                <p class="text-xs text-gray-500 mt-2 text-left">BOM付きUTF-8形式のCSVファイル。Excelで日本語が文字化けせず開けます。</p>
                <div class="mt-3 text-left">
                  <p class="text-[10px] text-gray-400 font-medium mb-1">操作手順:</p>
                  <ol class="text-[10px] text-gray-500 space-y-0.5 list-decimal list-inside">
                    <li>「CSVエクスポート」カードをクリック</li>
                    <li>自動ダウンロード開始</li>
                    <li>Excel / 会計ソフトに取込可能</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ========================================= -->
        <!-- 9. マスタ管理 -->
        <!-- ========================================= -->
        <section id="master" class="scroll-mt-24 print-break">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span class="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center"><i class="fas fa-cog text-yellow-600"></i></span>
            9. マスタ管理
          </h2>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 section-card space-y-6">

            <h3 class="font-semibold text-gray-700">9.1 カテゴリ管理</h3>
            <p class="text-sm text-gray-500">費用カテゴリを<strong>3階層</strong>で管理します。</p>
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="space-y-1 text-sm">
                <div class="flex items-center gap-2"><i class="fas fa-folder-open text-yellow-500 w-4"></i> <strong>クラウド</strong> <span class="text-xs text-gray-400">(レベル0 - トップ)</span></div>
                <div class="flex items-center gap-2 ml-6"><i class="fas fa-folder-open text-yellow-400 w-4"></i> AWS <span class="text-xs text-gray-400">(レベル1)</span></div>
                <div class="flex items-center gap-2 ml-12"><i class="fas fa-tag text-gray-400 w-4"></i> EC2 <span class="text-xs text-gray-400">(レベル2)</span></div>
                <div class="flex items-center gap-2 ml-12"><i class="fas fa-tag text-gray-400 w-4"></i> RDS <span class="text-xs text-gray-400">(レベル2)</span></div>
                <div class="flex items-center gap-2 ml-12"><i class="fas fa-tag text-gray-400 w-4"></i> S3 <span class="text-xs text-gray-400">(レベル2)</span></div>
                <div class="flex items-center gap-2 ml-6"><i class="fas fa-folder-open text-yellow-400 w-4"></i> Azure <span class="text-xs text-gray-400">(レベル1)</span></div>
              </div>
            </div>
            <p class="text-sm text-gray-500">追加時は「親カテゴリ」を選択することで、自動的にレベルが設定されます。</p>

            <h3 class="font-semibold text-gray-700 pt-2">9.2 部門管理</h3>
            <p class="text-sm text-gray-500">部門の追加・編集ができます。各部門には<strong>コード</strong>（例: IT, INFRA）と<strong>責任者名</strong>を設定します。</p>

            <h3 class="font-semibold text-gray-700 pt-2">9.3 プロジェクト管理</h3>
            <p class="text-sm text-gray-500">予算に紐付くプロジェクトを管理します。カード形式で一覧表示され、ステータスで色分けされます。</p>
            <div class="flex flex-wrap gap-2 text-xs">
              <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">計画中</span>
              <span class="bg-green-100 text-green-700 px-2 py-1 rounded-full">進行中</span>
              <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">完了</span>
              <span class="bg-red-100 text-red-600 px-2 py-1 rounded-full">中止</span>
            </div>
          </div>
        </section>

        <!-- ========================================= -->
        <!-- 10. CSVフォーマット -->
        <!-- ========================================= -->
        <section id="csv-format" class="scroll-mt-24 print-break">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center"><i class="fas fa-file-csv text-green-600"></i></span>
            10. CSVインポートフォーマット
          </h2>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 section-card space-y-6">
            <p class="text-sm text-gray-600">実績データのCSVインポート時は、以下のフォーマットに従ってください。<strong>ヘッダー行は不要</strong>です。</p>

            <h3 class="font-semibold text-gray-700">カラム定義</h3>
            <div class="overflow-x-auto">
              <table class="text-xs w-full border border-gray-200 rounded overflow-hidden">
                <thead class="bg-gray-50">
                  <tr><th class="px-3 py-2 text-left">列番号</th><th class="px-3 py-2 text-left">項目</th><th class="px-3 py-2 text-left">型</th><th class="px-3 py-2 text-left">必須</th><th class="px-3 py-2 text-left">例</th></tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr><td class="px-3 py-2 font-mono">1</td><td class="px-3 py-2 font-medium">月</td><td class="px-3 py-2 text-gray-500">数値</td><td class="px-3 py-2"><span class="text-red-500">*</span></td><td class="px-3 py-2 font-mono text-gray-600">1</td></tr>
                  <tr><td class="px-3 py-2 font-mono">2</td><td class="px-3 py-2 font-medium">カテゴリID</td><td class="px-3 py-2 text-gray-500">数値</td><td class="px-3 py-2"><span class="text-red-500">*</span></td><td class="px-3 py-2 font-mono text-gray-600">3</td></tr>
                  <tr><td class="px-3 py-2 font-mono">3</td><td class="px-3 py-2 font-medium">部門ID</td><td class="px-3 py-2 text-gray-500">数値</td><td class="px-3 py-2"></td><td class="px-3 py-2 font-mono text-gray-600">1</td></tr>
                  <tr><td class="px-3 py-2 font-mono">4</td><td class="px-3 py-2 font-medium">金額（円）</td><td class="px-3 py-2 text-gray-500">数値</td><td class="px-3 py-2"><span class="text-red-500">*</span></td><td class="px-3 py-2 font-mono text-gray-600">12000000</td></tr>
                  <tr><td class="px-3 py-2 font-mono">5</td><td class="px-3 py-2 font-medium">説明</td><td class="px-3 py-2 text-gray-500">文字列</td><td class="px-3 py-2"></td><td class="px-3 py-2 font-mono text-gray-600">AWS月額利用料</td></tr>
                  <tr><td class="px-3 py-2 font-mono">6</td><td class="px-3 py-2 font-medium">ベンダー</td><td class="px-3 py-2 text-gray-500">文字列</td><td class="px-3 py-2"></td><td class="px-3 py-2 font-mono text-gray-600">AWS</td></tr>
                  <tr><td class="px-3 py-2 font-mono">7</td><td class="px-3 py-2 font-medium">請求書番号</td><td class="px-3 py-2 text-gray-500">文字列</td><td class="px-3 py-2"></td><td class="px-3 py-2 font-mono text-gray-600">INV-001</td></tr>
                </tbody>
              </table>
            </div>

            <h3 class="font-semibold text-gray-700">カテゴリID対応表</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div class="bg-gray-50 rounded p-2 text-xs"><span class="font-mono font-bold text-blue-600">1</span> ハードウェア</div>
              <div class="bg-gray-50 rounded p-2 text-xs"><span class="font-mono font-bold text-blue-600">2</span> ソフトウェアライセンス</div>
              <div class="bg-gray-50 rounded p-2 text-xs"><span class="font-mono font-bold text-blue-600">3</span> クラウド</div>
              <div class="bg-gray-50 rounded p-2 text-xs"><span class="font-mono font-bold text-blue-600">4</span> ネットワーク</div>
              <div class="bg-gray-50 rounded p-2 text-xs"><span class="font-mono font-bold text-blue-600">5</span> 保守・サポート</div>
              <div class="bg-gray-50 rounded p-2 text-xs"><span class="font-mono font-bold text-blue-600">6</span> 人件費(外注・派遣)</div>
              <div class="bg-gray-50 rounded p-2 text-xs"><span class="font-mono font-bold text-blue-600">7</span> 教育・研修</div>
              <div class="bg-gray-50 rounded p-2 text-xs"><span class="font-mono font-bold text-blue-600">8</span> その他</div>
            </div>

            <h3 class="font-semibold text-gray-700">サンプルCSV</h3>
            <pre class="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto font-mono">1,3,1,12000000,AWS月額利用料(4月),AWS,INV-2025-001
1,2,1,8500000,Microsoft 365年間ライセンス,Microsoft Japan,INV-2025-002
2,1,2,5200000,サーバー購入,Dell Technologies,INV-2025-003
3,6,1,10500000,外注費(6月),TCS Japan,INV-2025-004</pre>
          </div>
        </section>

        <!-- ========================================= -->
        <!-- 11. アラートルール -->
        <!-- ========================================= -->
        <section id="alert-rules" class="scroll-mt-24 print-break">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span class="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center"><i class="fas fa-bell text-red-600"></i></span>
            11. アラートルール
          </h2>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 section-card space-y-6">
            <p class="text-sm text-gray-600">各カテゴリの予算消化率に応じて、自動的にアラートが発生します。</p>

            <div class="space-y-3">
              <div class="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                <span class="bg-green-500 text-white text-sm font-bold px-3 py-1.5 rounded-full whitespace-nowrap">&lt; 80%</span>
                <div>
                  <p class="text-sm font-semibold text-green-800">正常 (Green)</p>
                  <p class="text-xs text-green-700">予算内で順調に推移しています。特にアクションは不要です。</p>
                </div>
              </div>
              <div class="flex items-center gap-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <span class="bg-yellow-500 text-white text-sm font-bold px-3 py-1.5 rounded-full whitespace-nowrap">&ge; 80%</span>
                <div>
                  <p class="text-sm font-semibold text-yellow-800">警告 (Yellow)</p>
                  <p class="text-xs text-yellow-700">予算消化が進んでいます。残り期間と残予算を確認し、支出の見直しを検討してください。</p>
                </div>
              </div>
              <div class="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <span class="bg-red-500 text-white text-sm font-bold px-3 py-1.5 rounded-full whitespace-nowrap">&ge; 95%</span>
                <div>
                  <p class="text-sm font-semibold text-red-800">超過注意 (Red)</p>
                  <p class="text-xs text-red-700">予算がほぼ使い切られています。追加予算の申請または支出凍結を検討してください。</p>
                </div>
              </div>
            </div>

            <div class="alert-box alert-info">
              <p class="text-sm text-blue-700"><i class="fas fa-calculator mr-2"></i><strong>計算方法:</strong> アラートの消化率は <code class="bg-white px-1 rounded text-xs">(実績額 + コミット額) &divide; 予算額 &times; 100</code> で計算されます。コミット（発注済未払い）も含まれる点に注意してください。</p>
            </div>
          </div>
        </section>

        <!-- ========================================= -->
        <!-- 12. 用語集 -->
        <!-- ========================================= -->
        <section id="glossary" class="scroll-mt-24 print-break">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span class="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center"><i class="fas fa-book text-gray-600"></i></span>
            12. 用語集
          </h2>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 section-card">
            <div class="divide-y divide-gray-100">
              <div class="flex gap-4 py-3"><dt class="w-40 flex-shrink-0 font-semibold text-sm text-gray-700">年度 (Fiscal Year)</dt><dd class="text-sm text-gray-500">会計年度。4月始まり3月終わりの12ヶ月間。</dd></div>
              <div class="flex gap-4 py-3"><dt class="w-40 flex-shrink-0 font-semibold text-sm text-gray-700">予算 (Budget)</dt><dd class="text-sm text-gray-500">年度初めに計画された支出上限額。</dd></div>
              <div class="flex gap-4 py-3"><dt class="w-40 flex-shrink-0 font-semibold text-sm text-gray-700">実績 (Actual)</dt><dd class="text-sm text-gray-500">実際に支払い済みの金額。</dd></div>
              <div class="flex gap-4 py-3"><dt class="w-40 flex-shrink-0 font-semibold text-sm text-gray-700">コミット (Committed)</dt><dd class="text-sm text-gray-500">発注済みだが未払いの金額。将来確実に発生する支出。</dd></div>
              <div class="flex gap-4 py-3"><dt class="w-40 flex-shrink-0 font-semibold text-sm text-gray-700">消化率</dt><dd class="text-sm text-gray-500">予算に対する実績の割合。100%で予算ちょうど使い切り。</dd></div>
              <div class="flex gap-4 py-3"><dt class="w-40 flex-shrink-0 font-semibold text-sm text-gray-700">差異 (Variance)</dt><dd class="text-sm text-gray-500">実績 - 予算。プラスは超過、マイナスは節約を意味する。</dd></div>
              <div class="flex gap-4 py-3"><dt class="w-40 flex-shrink-0 font-semibold text-sm text-gray-700">着地見込 (Forecast)</dt><dd class="text-sm text-gray-500">年度末時点での支出予測総額。</dd></div>
              <div class="flex gap-4 py-3"><dt class="w-40 flex-shrink-0 font-semibold text-sm text-gray-700">カテゴリ</dt><dd class="text-sm text-gray-500">費用の分類。最大3階層（例: クラウド > AWS > EC2）。</dd></div>
            </div>
          </div>
        </section>

        <!-- ========================================= -->
        <!-- 13. FAQ -->
        <!-- ========================================= -->
        <section id="faq" class="scroll-mt-24 print-break">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center"><i class="fas fa-question-circle text-orange-600"></i></span>
            13. よくある質問 (FAQ)
          </h2>
          <div class="space-y-3">
            <details class="bg-white rounded-xl shadow-sm border border-gray-100 section-card group">
              <summary class="p-5 cursor-pointer flex items-center justify-between text-sm font-medium text-gray-700 hover:text-blue-600">
                <span><i class="fas fa-q text-blue-500 mr-2"></i>年度を切り替えても前の年度のデータが表示されます</span>
                <i class="fas fa-chevron-down text-gray-400 group-open:rotate-180 transition-transform"></i>
              </summary>
              <div class="px-5 pb-5 text-sm text-gray-500">ヘッダーバーの年度セレクタを変更すると、全画面のデータが切り替わります。切り替わらない場合は、<span class="kbd"><i class="fas fa-sync-alt"></i></span> 更新ボタンを押してください。</div>
            </details>
            <details class="bg-white rounded-xl shadow-sm border border-gray-100 section-card group">
              <summary class="p-5 cursor-pointer flex items-center justify-between text-sm font-medium text-gray-700 hover:text-blue-600">
                <span><i class="fas fa-q text-blue-500 mr-2"></i>CSVインポートで「有効なデータがありません」と出ます</span>
                <i class="fas fa-chevron-down text-gray-400 group-open:rotate-180 transition-transform"></i>
              </summary>
              <div class="px-5 pb-5 text-sm text-gray-500">CSVの各行に「月」「カテゴリID」「金額」の3項目が必須です。ヘッダー行は不要です。カンマ区切りになっているか確認してください。<a href="#csv-format" class="text-blue-600 underline ml-1">フォーマット詳細</a></div>
            </details>
            <details class="bg-white rounded-xl shadow-sm border border-gray-100 section-card group">
              <summary class="p-5 cursor-pointer flex items-center justify-between text-sm font-medium text-gray-700 hover:text-blue-600">
                <span><i class="fas fa-q text-blue-500 mr-2"></i>コミットが実績に変わったらどうすればよいですか？</span>
                <i class="fas fa-chevron-down text-gray-400 group-open:rotate-180 transition-transform"></i>
              </summary>
              <div class="px-5 pb-5 text-sm text-gray-500">「実績入力」で支払い実績を登録し、「コミット管理」で該当コミットを削除してください。コミットを残したまま実績を登録すると、二重計上になり予算残額が実際より少なく表示されます。</div>
            </details>
            <details class="bg-white rounded-xl shadow-sm border border-gray-100 section-card group">
              <summary class="p-5 cursor-pointer flex items-center justify-between text-sm font-medium text-gray-700 hover:text-blue-600">
                <span><i class="fas fa-q text-blue-500 mr-2"></i>ExcelのダウンロードファイルがExcelで開けません</span>
                <i class="fas fa-chevron-down text-gray-400 group-open:rotate-180 transition-transform"></i>
              </summary>
              <div class="px-5 pb-5 text-sm text-gray-500">ファイルはXML SpreadsheetML形式(.xls)です。Excel 2007以降であれば開けますが、警告が表示される場合は「はい」で続行してください。Google スプレッドシートにアップロードして開くこともできます。</div>
            </details>
            <details class="bg-white rounded-xl shadow-sm border border-gray-100 section-card group">
              <summary class="p-5 cursor-pointer flex items-center justify-between text-sm font-medium text-gray-700 hover:text-blue-600">
                <span><i class="fas fa-q text-blue-500 mr-2"></i>スマートフォンでサイドバーが表示されません</span>
                <i class="fas fa-chevron-down text-gray-400 group-open:rotate-180 transition-transform"></i>
              </summary>
              <div class="px-5 pb-5 text-sm text-gray-500">画面左上の <span class="kbd"><i class="fas fa-bars"></i></span> ハンバーガーメニューをタップするとサイドバーが開きます。サイドバー以外の領域をタップすると閉じます。</div>
            </details>
            <details class="bg-white rounded-xl shadow-sm border border-gray-100 section-card group">
              <summary class="p-5 cursor-pointer flex items-center justify-between text-sm font-medium text-gray-700 hover:text-blue-600">
                <span><i class="fas fa-q text-blue-500 mr-2"></i>削除したデータを元に戻せますか？</span>
                <i class="fas fa-chevron-down text-gray-400 group-open:rotate-180 transition-transform"></i>
              </summary>
              <div class="px-5 pb-5 text-sm text-gray-500">現時点では、削除したデータの復元機能はありません。削除前に確認ダイアログが表示されますので、よく確認の上操作してください。重要なデータは事前にCSVエクスポートでバックアップを取ることをおすすめします。</div>
            </details>
          </div>
        </section>

        <!-- ========================================= -->
        <!-- 14. 操作のコツ -->
        <!-- ========================================= -->
        <section id="shortcuts" class="scroll-mt-24 print-break">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span class="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center"><i class="fas fa-keyboard text-teal-600"></i></span>
            14. 操作のコツ
          </h2>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 section-card space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-teal-50 rounded-lg p-4">
                <p class="text-sm font-semibold text-teal-800 mb-2"><i class="fas fa-bolt mr-1"></i> 均等配分で入力を高速化</p>
                <p class="text-xs text-teal-700">予算登録時、年間総額だけ入力して「均等配分」ボタンを押せば、12ヶ月分が自動入力されます。その後、特定月だけ手動で調整できます。</p>
              </div>
              <div class="bg-blue-50 rounded-lg p-4">
                <p class="text-sm font-semibold text-blue-800 mb-2"><i class="fas fa-file-csv mr-1"></i> CSV一括インポート活用</p>
                <p class="text-xs text-blue-700">会計システムからCSVエクスポートし、フォーマットを合わせて一括インポートすれば、実績を1件ずつ入力する手間が省けます。</p>
              </div>
              <div class="bg-purple-50 rounded-lg p-4">
                <p class="text-sm font-semibold text-purple-800 mb-2"><i class="fas fa-calendar-check mr-1"></i> 月次ルーティン</p>
                <p class="text-xs text-purple-700">毎月初めに前月の実績を入力 → コミット状況を更新 → ダッシュボードで確認、というサイクルで運用してください。</p>
              </div>
              <div class="bg-orange-50 rounded-lg p-4">
                <p class="text-sm font-semibold text-orange-800 mb-2"><i class="fas fa-download mr-1"></i> 定期バックアップ</p>
                <p class="text-xs text-orange-700">月次でCSVエクスポートしてバックアップを保存しておけば、データ消失のリスクを減らせます。</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Footer -->
        <footer class="border-t border-gray-200 pt-8 pb-12 text-center">
          <p class="text-sm text-gray-400">IT予算管理ダッシュボード 操作マニュアル v1.0</p>
          <p class="text-xs text-gray-300 mt-1">最終更新: 2026年3月 | 情報システム部</p>
          <a href="/" class="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mt-4"><i class="fas fa-arrow-left text-xs"></i> アプリに戻る</a>
        </footer>
      </main>
    </div>
  </div>

  <!-- Scroll to top -->
  <button onclick="window.scrollTo({top:0,behavior:'smooth'})" class="fixed bottom-6 right-6 w-10 h-10 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center no-print" title="トップへ">
    <i class="fas fa-chevron-up"></i>
  </button>

  <script>
    // TOC active state tracking
    const sections = document.querySelectorAll('section[id]');
    const tocLinks = document.querySelectorAll('.toc-link');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tocLinks.forEach(link => link.classList.remove('active'));
          const active = document.querySelector('.toc-link[href="#' + entry.target.id + '"]');
          if (active) active.classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -60% 0px' });
    sections.forEach(s => observer.observe(s));
  </script>
</body>
</html>`;
}
