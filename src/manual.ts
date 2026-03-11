// Manual page HTML content - System Planning Budget Management
export function getManualHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>システム企画 予算管理 - 操作マニュアル</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap');
    * { font-family: 'Noto Sans JP', sans-serif; scroll-behavior: smooth; }
    .toc-link { transition: all 0.15s; border-left: 3px solid transparent; }
    .toc-link:hover { color: #2563eb; transform: translateX(4px); }
    .toc-link.active { color: #2563eb; font-weight: 600; border-left-color: #2563eb; }
    .section-card { transition: all 0.2s; }
    .section-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .step-number { width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
    @media print { .sidebar-toc { display: none !important; } .main-manual { margin-left: 0 !important; } }
    table.manual-table { border-collapse: collapse; width: 100%; font-size: 13px; }
    table.manual-table th, table.manual-table td { border: 1px solid #e2e8f0; padding: 8px 12px; }
    table.manual-table th { background: #f1f5f9; font-weight: 600; text-align: left; }
    .kbd { background: #f1f5f9; border: 1px solid #d1d5db; border-radius: 4px; padding: 2px 6px; font-size: 12px; font-family: monospace; }
  </style>
</head>
<body class="bg-gray-50 text-gray-700">

  <!-- TOC Sidebar -->
  <aside class="sidebar-toc fixed left-0 top-0 w-60 h-full bg-white border-r border-gray-200 overflow-y-auto z-20 hidden lg:block">
    <div class="p-4 border-b">
      <a href="/" class="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm mb-2"><i class="fas fa-arrow-left"></i>アプリに戻る</a>
      <h2 class="text-sm font-bold text-gray-800">操作マニュアル</h2>
      <p class="text-[10px] text-gray-400">システム企画 予算管理</p>
    </div>
    <nav class="p-3 space-y-0.5" id="tocNav">
      <a href="#overview" class="toc-link block px-3 py-1.5 text-[12px] text-gray-600 rounded">1. 概要</a>
      <a href="#data-model" class="toc-link block px-3 py-1.5 text-[12px] text-gray-600 rounded">2. データモデル</a>
      <a href="#dashboard" class="toc-link block px-3 py-1.5 text-[12px] text-gray-600 rounded">3. ダッシュボード</a>
      <a href="#budget-input" class="toc-link block px-3 py-1.5 text-[12px] text-gray-600 rounded">4. 予算データ入力</a>
      <a href="#analysis" class="toc-link block px-3 py-1.5 text-[12px] text-gray-600 rounded">5. 予実差異分析</a>
      <a href="#multi-year" class="toc-link block px-3 py-1.5 text-[12px] text-gray-600 rounded">6. 中期比較</a>
      <a href="#reports" class="toc-link block px-3 py-1.5 text-[12px] text-gray-600 rounded">7. レポート出力</a>
      <a href="#master" class="toc-link block px-3 py-1.5 text-[12px] text-gray-600 rounded">8. マスタ管理</a>
      <a href="#comments" class="toc-link block px-3 py-1.5 text-[12px] text-gray-600 rounded">9. 差異コメント</a>
      <a href="#formulas" class="toc-link block px-3 py-1.5 text-[12px] text-gray-600 rounded">10. 計算式・集計</a>
      <a href="#csv" class="toc-link block px-3 py-1.5 text-[12px] text-gray-600 rounded">11. CSV入出力</a>
      <a href="#glossary" class="toc-link block px-3 py-1.5 text-[12px] text-gray-600 rounded">12. 用語集</a>
      <a href="#faq" class="toc-link block px-3 py-1.5 text-[12px] text-gray-600 rounded">13. FAQ</a>
    </nav>
  </aside>

  <!-- Main Content -->
  <main class="main-manual lg:ml-60 max-w-4xl mx-auto p-6 lg:p-8">

    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center">
          <i class="fas fa-building-columns text-white text-lg"></i>
        </div>
        <div>
          <h1 class="text-2xl font-bold text-gray-800">システム企画 予算管理</h1>
          <p class="text-sm text-gray-500">操作マニュアル v2.0</p>
        </div>
      </div>
      <p class="text-sm text-gray-600 leading-relaxed bg-blue-50 p-4 rounded-lg border border-blue-100">
        本システムは、情報システム部門（システム企画）における<strong>中長期（複数期間）の予算計画・予測・実績管理</strong>を一元化するWebアプリケーションです。
        Excel管理の課題（同時編集不可、バージョン管理困難、手動集計）を解消し、リアルタイムの予実分析と差異管理を実現します。
      </p>
    </div>

    <!-- 1. Overview -->
    <section id="overview" class="section-card bg-white rounded-xl border p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span class="step-number bg-blue-100 text-blue-700">1</span>概要</h2>
      <h3 class="text-sm font-semibold text-gray-700 mb-2">主な特徴</h3>
      <ul class="text-sm space-y-2 mb-4">
        <li class="flex items-start gap-2"><i class="fas fa-check-circle text-green-500 mt-0.5"></i><span><strong>複数年度管理</strong> — FY65〜FY70まで6年分の中期予算を一画面で比較</span></li>
        <li class="flex items-start gap-2"><i class="fas fa-check-circle text-green-500 mt-0.5"></i><span><strong>3次元データモデル</strong> — システム × 費目 × 月 の粒度で4種類の金額（当初計画・修正計画・着地見込・実績）を管理</span></li>
        <li class="flex items-start gap-2"><i class="fas fa-check-circle text-green-500 mt-0.5"></i><span><strong>自動集計</strong> — 月 → 四半期 → 半期 → 年間の自動集計。ドメイン別・カテゴリ別のクロス集計</span></li>
        <li class="flex items-start gap-2"><i class="fas fa-check-circle text-green-500 mt-0.5"></i><span><strong>差異分析</strong> — 計画vs実績、見込vs計画の差異率を自動計算。超過アラート付き</span></li>
        <li class="flex items-start gap-2"><i class="fas fa-check-circle text-green-500 mt-0.5"></i><span><strong>Excel/PDF出力</strong> — レポート一括エクスポート、印刷対応</span></li>
        <li class="flex items-start gap-2"><i class="fas fa-check-circle text-green-500 mt-0.5"></i><span><strong>差異コメント</strong> — 年間・半期・四半期・月次レベルでの差異理由を記録</span></li>
      </ul>
      <h3 class="text-sm font-semibold text-gray-700 mb-2">金額単位</h3>
      <p class="text-sm bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <i class="fas fa-info-circle text-yellow-600 mr-1"></i>
        全金額は <strong>千円（税抜）</strong> 単位で入力・表示されます。例: 2,500 = 250万円
      </p>
    </section>

    <!-- 2. Data Model -->
    <section id="data-model" class="section-card bg-white rounded-xl border p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span class="step-number bg-blue-100 text-blue-700">2</span>データモデル</h2>
      <h3 class="text-sm font-semibold text-gray-700 mb-2">ディメンション構造</h3>
      <table class="manual-table mb-4">
        <thead><tr><th>ディメンション</th><th>説明</th><th>例</th></tr></thead>
        <tbody>
          <tr><td><strong>年度</strong></td><td>複数年度を横断管理</td><td>FY65, FY66, ..., FY70</td></tr>
          <tr><td><strong>システムドメイン</strong></td><td>上位グループ</td><td>基幹系, センター系, チャネル系, 共通基盤</td></tr>
          <tr><td><strong>システム</strong></td><td>個別システム</td><td>オーソリシステム, CAFIS, CARDNET, クラウド基盤</td></tr>
          <tr><td><strong>費用カテゴリ</strong></td><td>大分類</td><td>ハードウェア, ソフトウェアライセンス, クラウド, 開発費</td></tr>
          <tr><td><strong>費目</strong></td><td>明細レベル</td><td>リース料, ライセンス料, AWS利用料, 外注費</td></tr>
          <tr><td><strong>月</strong></td><td>1〜12月（4月始まり）</td><td>4月=月1, 3月=月12</td></tr>
        </tbody>
      </table>

      <h3 class="text-sm font-semibold text-gray-700 mb-2">4種類の金額</h3>
      <table class="manual-table">
        <thead><tr><th>タイプ</th><th>説明</th><th>入力タイミング</th><th>セル色</th></tr></thead>
        <tbody>
          <tr><td><strong>当初計画</strong></td><td>年度開始前に策定した初期予算</td><td>期初（策定時）</td><td class="bg-green-50">緑系</td></tr>
          <tr><td><strong>修正計画</strong></td><td>期中に改定した予算（最新の承認済み計画）</td><td>期中随時</td><td class="bg-yellow-50">黄系（入力可）</td></tr>
          <tr><td><strong>着地見込</strong></td><td>年度末時点の着地予測金額</td><td>月次・四半期レビュー時</td><td class="bg-yellow-50">黄系（入力可）</td></tr>
          <tr><td><strong>実績</strong></td><td>実際に発生した金額</td><td>月次締め後</td><td class="bg-blue-50">青系</td></tr>
        </tbody>
      </table>
    </section>

    <!-- 3. Dashboard -->
    <section id="dashboard" class="section-card bg-white rounded-xl border p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span class="step-number bg-blue-100 text-blue-700">3</span>ダッシュボード</h2>
      <p class="text-sm mb-3">選択中の年度の予算状況を一目で把握するための統合画面です。</p>
      <h3 class="text-sm font-semibold text-gray-700 mb-2">KPIカード（4枚）</h3>
      <table class="manual-table mb-4">
        <thead><tr><th>カード</th><th>表示内容</th><th>計算式</th></tr></thead>
        <tbody>
          <tr><td>修正計画</td><td>最新の承認済み年間予算合計</td><td>SUM(revised_plan)</td></tr>
          <tr><td>実績累計</td><td>年度の実績金額累計 + 消化率バー</td><td>SUM(actual) / SUM(revised_plan) × 100</td></tr>
          <tr><td>着地見込</td><td>年度末の着地予測 + 計画との差異</td><td>SUM(forecast) - SUM(revised_plan)</td></tr>
          <tr><td>残予算</td><td>修正計画から実績を引いた残額</td><td>SUM(revised_plan) - SUM(actual)</td></tr>
        </tbody>
      </table>
      <h3 class="text-sm font-semibold text-gray-700 mb-2">チャート</h3>
      <ul class="text-sm space-y-1">
        <li>📊 <strong>月別推移チャート</strong> — 棒グラフで修正計画vs実績、折線で着地見込を重ね表示</li>
        <li>🍩 <strong>費用カテゴリ別構成</strong> — ドーナツチャートで修正計画の構成比を可視化</li>
        <li>📈 <strong>累積推移チャート</strong> — 計画累計・見込累計・実績累計の折線比較</li>
      </ul>
      <h3 class="text-sm font-semibold text-gray-700 mt-3 mb-2">超過アラート</h3>
      <p class="text-sm">消化率80%以上 または 見込差異率5%以上のシステムを自動検出してアラート表示します。</p>
    </section>

    <!-- 4. Budget Input -->
    <section id="budget-input" class="section-card bg-white rounded-xl border p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span class="step-number bg-blue-100 text-blue-700">4</span>予算データ入力</h2>
      <p class="text-sm mb-3">Excel風のマトリクス表で予算データの閲覧・編集を行います。</p>

      <h3 class="text-sm font-semibold text-gray-700 mb-2">表示モード</h3>
      <table class="manual-table mb-4">
        <thead><tr><th>モード</th><th>説明</th></tr></thead>
        <tbody>
          <tr><td><strong>全タイプ比較</strong></td><td>各システム×費目に対し、4種類の金額を4行で表示（閲覧専用）</td></tr>
          <tr><td><strong>当初計画</strong></td><td>当初計画のみ表示（参照用）</td></tr>
          <tr><td><strong>修正計画</strong></td><td>修正計画のみ表示、セル直接編集可能</td></tr>
          <tr><td><strong>着地見込</strong></td><td>着地見込のみ表示、セル直接編集可能</td></tr>
          <tr><td><strong>実績</strong></td><td>実績のみ表示、セル直接編集可能</td></tr>
        </tbody>
      </table>

      <h3 class="text-sm font-semibold text-gray-700 mb-2">操作手順</h3>
      <ol class="text-sm space-y-2 list-decimal list-inside">
        <li><strong>システム選択</strong>: プルダウンで特定システムに絞り込み（全システム表示も可）</li>
        <li><strong>表示タイプ選択</strong>: 「修正計画」「着地見込」「実績」を選ぶと入力可能モードになる</li>
        <li><strong>セル編集</strong>: 数値を直接入力し、Tabまたはフォーカス移動で自動保存</li>
        <li><strong>CSV出力</strong>: 画面右上「CSV出力」ボタンで現在の表をCSVダウンロード</li>
        <li><strong>CSV取込</strong>: 「CSV取込」ボタンで一括データ投入</li>
      </ol>

      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3 text-sm">
        <i class="fas fa-lightbulb text-yellow-600 mr-1"></i>
        <strong>入力セルの色分け</strong>: 黄色=入力可能（計画・見込）、青色=実績入力、緑色=参照のみ
      </div>
    </section>

    <!-- 5. Analysis -->
    <section id="analysis" class="section-card bg-white rounded-xl border p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span class="step-number bg-blue-100 text-blue-700">5</span>予実差異分析</h2>
      <p class="text-sm mb-3">予算と実績の差異を多角的に分析する画面です。</p>

      <h3 class="text-sm font-semibold text-gray-700 mb-2">集計切り口（4種類）</h3>
      <ul class="text-sm space-y-1 mb-4">
        <li>🖥️ <strong>システム別</strong> — 個別システムごとの予実比較（ドメイン名付き）</li>
        <li>📁 <strong>カテゴリ別</strong> — ハードウェア・ソフトウェア等のカテゴリ集計</li>
        <li>🏢 <strong>ドメイン別</strong> — 基幹系・センター系等のドメイン集計</li>
        <li>🏷️ <strong>費目別</strong> — リース料・保守費等の詳細費目集計</li>
      </ul>

      <h3 class="text-sm font-semibold text-gray-700 mb-2">表示項目</h3>
      <table class="manual-table mb-4">
        <thead><tr><th>列</th><th>意味</th></tr></thead>
        <tbody>
          <tr><td>計画vs実績</td><td>修正計画 - 実績（正=残予算あり、負=超過）</td></tr>
          <tr><td>差異率</td><td>(実績 - 修正計画) / 修正計画 × 100</td></tr>
          <tr><td>見込vs計画</td><td>着地見込 - 修正計画（正=超過見込、負=下振れ）</td></tr>
          <tr><td>消化率</td><td>実績 / 修正計画 × 100（プログレスバー付き）</td></tr>
        </tbody>
      </table>

      <h3 class="text-sm font-semibold text-gray-700 mb-2">四半期・半期集計</h3>
      <p class="text-sm">右側のタブで「四半期」「半期」を切り替えると、期間集計のチャートが表示されます。</p>
      <ul class="text-sm space-y-1 mt-2">
        <li><strong>Q1</strong>: 月1〜3（4月〜6月）、<strong>Q2</strong>: 月4〜6（7月〜9月）</li>
        <li><strong>Q3</strong>: 月7〜9（10月〜12月）、<strong>Q4</strong>: 月10〜12（1月〜3月）</li>
        <li><strong>H1</strong>: 月1〜6（上期）、<strong>H2</strong>: 月7〜12（下期）</li>
      </ul>
    </section>

    <!-- 6. Multi-Year -->
    <section id="multi-year" class="section-card bg-white rounded-xl border p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span class="step-number bg-blue-100 text-blue-700">6</span>中期比較</h2>
      <p class="text-sm mb-3">FY65〜FY70の6年間を横断して予算推移を比較する画面です。</p>
      <ul class="text-sm space-y-2">
        <li>📊 <strong>年度別テーブル</strong>: 各年度の当初計画・修正計画・着地見込・実績を横並び表示</li>
        <li>📈 <strong>中期推移チャート</strong>: 棒グラフ（計画・実績）+ 折線（着地見込）で推移可視化</li>
        <li>🔍 <strong>システム絞り込み</strong>: プルダウンで特定システムの年度推移を確認可能</li>
      </ul>
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3 text-sm">
        <i class="fas fa-info-circle text-blue-600 mr-1"></i>
        中期比較は予算策定時（年度初め）に特に重要です。過去実績トレンドから次年度予算の妥当性を検証できます。
      </div>
    </section>

    <!-- 7. Reports -->
    <section id="reports" class="section-card bg-white rounded-xl border p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span class="step-number bg-blue-100 text-blue-700">7</span>レポート出力</h2>
      <p class="text-sm mb-3">3つのサマリレポートとエクスポート機能を提供します。</p>
      <table class="manual-table mb-4">
        <thead><tr><th>レポート</th><th>内容</th></tr></thead>
        <tbody>
          <tr><td><strong>ドメイン別サマリ</strong></td><td>基幹系・センター系・チャネル系・共通基盤の集計</td></tr>
          <tr><td><strong>システム別サマリ</strong></td><td>全システムの4金額 + 見込差異率</td></tr>
          <tr><td><strong>費用カテゴリ別サマリ</strong></td><td>HW・SW・クラウド等のカテゴリ集計</td></tr>
        </tbody>
      </table>
      <h3 class="text-sm font-semibold text-gray-700 mb-2">出力方法</h3>
      <ul class="text-sm space-y-1">
        <li>📗 <strong>Excel出力</strong>: 画面上の全テーブルをExcel XML形式でダウンロード</li>
        <li>📕 <strong>PDF出力</strong>: ブラウザの印刷機能（PDF保存選択可能）</li>
        <li>🖨️ <strong>印刷</strong>: サイドバー非表示の印刷用レイアウトで出力</li>
      </ul>
    </section>

    <!-- 8. Master -->
    <section id="master" class="section-card bg-white rounded-xl border p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span class="step-number bg-blue-100 text-blue-700">8</span>マスタ管理</h2>

      <h3 class="text-sm font-semibold text-gray-700 mb-2">システム管理</h3>
      <p class="text-sm mb-3">ドメイン（基幹系・センター系等）配下のシステムを管理します。</p>
      <ul class="text-sm space-y-1 mb-4">
        <li>• ドメイン単位でカード表示</li>
        <li>• 新規追加: ドメイン・コード・名称・説明を入力</li>
        <li>• 有効/無効の状態管理</li>
      </ul>

      <h3 class="text-sm font-semibold text-gray-700 mb-2">費目管理</h3>
      <p class="text-sm mb-3">費用カテゴリ配下の費目を管理します。</p>
      <ul class="text-sm space-y-1">
        <li>• カテゴリ単位でカード表示</li>
        <li>• 課税/非課税の属性管理</li>
        <li>• 新規追加: カテゴリ・コード・名称・課税区分を入力</li>
      </ul>
      <div class="bg-green-50 border border-green-200 rounded-lg p-3 mt-3 text-sm">
        <i class="fas fa-lightbulb text-green-600 mr-1"></i>
        <strong>保守性</strong>: マスタ追加で年度・システム・費目を自由に拡張可能。既存データに影響しません。
      </div>
    </section>

    <!-- 9. Comments -->
    <section id="comments" class="section-card bg-white rounded-xl border p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span class="step-number bg-blue-100 text-blue-700">9</span>差異コメント</h2>
      <p class="text-sm mb-3">予実差異の理由やアクションを記録する機能です。金額データとは分離して管理されます。</p>
      <h3 class="text-sm font-semibold text-gray-700 mb-2">コメント種別</h3>
      <table class="manual-table mb-4">
        <thead><tr><th>種別</th><th>用途</th><th>色</th></tr></thead>
        <tbody>
          <tr><td>差異説明</td><td>計画と実績/見込の差異理由</td><td class="bg-red-50">赤系</td></tr>
          <tr><td>備考</td><td>補足情報やメモ</td><td class="bg-blue-50">青系</td></tr>
          <tr><td>アクション</td><td>差異解消のための施策</td><td class="bg-green-50">緑系</td></tr>
          <tr><td>リスク</td><td>超過リスクの警告</td><td class="bg-yellow-50">黄系</td></tr>
        </tbody>
      </table>
      <p class="text-sm">コメントは年間・半期・四半期・月次の粒度で、特定のシステムや費目に紐付けて登録できます。</p>
    </section>

    <!-- 10. Formulas -->
    <section id="formulas" class="section-card bg-white rounded-xl border p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span class="step-number bg-blue-100 text-blue-700">10</span>計算式・集計ロジック</h2>
      <table class="manual-table">
        <thead><tr><th>指標</th><th>計算式</th></tr></thead>
        <tbody>
          <tr><td>消化率</td><td>実績合計 ÷ 修正計画合計 × 100 (%)</td></tr>
          <tr><td>残予算</td><td>修正計画合計 − 実績合計</td></tr>
          <tr><td>計画vs実績差異</td><td>修正計画 − 実績（正=残あり、負=超過）</td></tr>
          <tr><td>差異率</td><td>(実績 − 修正計画) ÷ 修正計画 × 100 (%)</td></tr>
          <tr><td>見込vs計画差異</td><td>着地見込 − 修正計画（正=超過見込）</td></tr>
          <tr><td>見込差異率</td><td>(着地見込 − 修正計画) ÷ 修正計画 × 100 (%)</td></tr>
          <tr><td>四半期集計</td><td>月→Q1(月1-3), Q2(月4-6), Q3(月7-9), Q4(月10-12)</td></tr>
          <tr><td>半期集計</td><td>月→H1(月1-6), H2(月7-12)</td></tr>
          <tr><td>年間集計</td><td>月1〜12の合計</td></tr>
        </tbody>
      </table>
    </section>

    <!-- 11. CSV -->
    <section id="csv" class="section-card bg-white rounded-xl border p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span class="step-number bg-blue-100 text-blue-700">11</span>CSV入出力</h2>
      <h3 class="text-sm font-semibold text-gray-700 mb-2">インポートフォーマット</h3>
      <p class="text-sm mb-2">1行1レコード、カンマ区切り（ヘッダなし）:</p>
      <pre class="bg-gray-800 text-green-400 text-xs p-3 rounded-lg overflow-x-auto mb-3">system_id, expense_item_id, month, field, value
1, 1, 1, revised_plan, 2500
1, 5, 1, actual, 1800
4, 10, 6, forecast, 4800</pre>
      <table class="manual-table mb-4">
        <thead><tr><th>列</th><th>型</th><th>説明</th></tr></thead>
        <tbody>
          <tr><td>system_id</td><td>整数</td><td>システムID</td></tr>
          <tr><td>expense_item_id</td><td>整数</td><td>費目ID</td></tr>
          <tr><td>month</td><td>1-12</td><td>月番号</td></tr>
          <tr><td>field</td><td>文字列</td><td>initial_plan / revised_plan / forecast / actual</td></tr>
          <tr><td>value</td><td>数値</td><td>金額（千円）</td></tr>
        </tbody>
      </table>
      <h3 class="text-sm font-semibold text-gray-700 mb-2">CSV出力</h3>
      <p class="text-sm">予算データ入力画面の「CSV出力」ボタンで、現在表示中のマトリクスをCSV形式（UTF-8 BOM付き）でダウンロードします。</p>
    </section>

    <!-- 12. Glossary -->
    <section id="glossary" class="section-card bg-white rounded-xl border p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span class="step-number bg-blue-100 text-blue-700">12</span>用語集</h2>
      <table class="manual-table">
        <thead><tr><th>用語</th><th>説明</th></tr></thead>
        <tbody>
          <tr><td>FY (Fiscal Year)</td><td>会計年度。FY65 = 2025年度</td></tr>
          <tr><td>ドメイン</td><td>システムの上位グループ（基幹系・センター系等）</td></tr>
          <tr><td>費目</td><td>費用の詳細項目（リース料・保守費等）</td></tr>
          <tr><td>当初計画</td><td>年度開始前に策定した初期予算</td></tr>
          <tr><td>修正計画</td><td>期中改定後の最新予算（差異分析の基準）</td></tr>
          <tr><td>着地見込</td><td>年度末時点の着地予測金額</td></tr>
          <tr><td>実績</td><td>実際に発生・計上された金額</td></tr>
          <tr><td>消化率</td><td>実績 ÷ 修正計画の割合</td></tr>
          <tr><td>差異率</td><td>計画と実績/見込の乖離割合</td></tr>
          <tr><td>CAFIS</td><td>NTTデータのカード決済ネットワーク</td></tr>
          <tr><td>CARDNET</td><td>日本カードネットワークの決済基盤</td></tr>
        </tbody>
      </table>
    </section>

    <!-- 13. FAQ -->
    <section id="faq" class="section-card bg-white rounded-xl border p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span class="step-number bg-blue-100 text-blue-700">13</span>FAQ</h2>
      <div class="space-y-3">
        <details class="border rounded-lg">
          <summary class="px-4 py-3 text-sm font-medium cursor-pointer hover:bg-gray-50">新しい年度を追加するには？</summary>
          <div class="px-4 pb-3 text-sm text-gray-600">ヘッダの年度プルダウンは自動で全年度を表示します。新年度はマスタデータ（seed.sql）に追加するか、APIを通じて登録します。</div>
        </details>
        <details class="border rounded-lg">
          <summary class="px-4 py-3 text-sm font-medium cursor-pointer hover:bg-gray-50">新しいシステムを追加するには？</summary>
          <div class="px-4 pb-3 text-sm text-gray-600">サイドバーの「システム管理」から「新規追加」ボタンをクリック。ドメイン・コード・名称を入力して追加します。</div>
        </details>
        <details class="border rounded-lg">
          <summary class="px-4 py-3 text-sm font-medium cursor-pointer hover:bg-gray-50">大量データを一括入力するには？</summary>
          <div class="px-4 pb-3 text-sm text-gray-600">予算データ入力画面の「CSV取込」を使います。CSVフォーマットに従ったデータを貼り付けてインポートできます。</div>
        </details>
        <details class="border rounded-lg">
          <summary class="px-4 py-3 text-sm font-medium cursor-pointer hover:bg-gray-50">特定システムの年度推移を確認するには？</summary>
          <div class="px-4 pb-3 text-sm text-gray-600">「中期比較」画面でシステムプルダウンから対象システムを選択すると、そのシステムのFY65〜FY70の推移チャートが表示されます。</div>
        </details>
        <details class="border rounded-lg">
          <summary class="px-4 py-3 text-sm font-medium cursor-pointer hover:bg-gray-50">差異の理由を記録するには？</summary>
          <div class="px-4 pb-3 text-sm text-gray-600">「差異コメント」画面から新規追加します。種別（差異説明・備考・アクション・リスク）を選び、対象システムや期間レベルを指定してコメントを入力します。</div>
        </details>
      </div>
    </section>

    <!-- Footer -->
    <div class="text-center text-xs text-gray-400 mt-8 pb-8">
      <p>システム企画 予算管理ダッシュボード v2.0 | 操作マニュアル</p>
      <p class="mt-1"><a href="/" class="text-blue-500 hover:underline">アプリケーションに戻る</a></p>
    </div>
  </main>

  <script>
    // TOC scroll highlight
    const sections = document.querySelectorAll('section[id]');
    const tocLinks = document.querySelectorAll('.toc-link');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tocLinks.forEach(l => l.classList.remove('active'));
          const active = document.querySelector('.toc-link[href="#' + entry.target.id + '"]');
          if (active) active.classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    sections.forEach(s => observer.observe(s));
  </script>
</body>
</html>`
}
