# UI/UX共通仕様

## 1. レイアウト構造

| 要素 | 対応ソース | 仕様 |
|---|---|---|
| `.layout` | `public/index.html`, `style.css` | サイドバーとメイン領域の2カラム構成 |
| `.sidebar` | `public/index.html`, `style.css` | ブランド、折りたたみ、メインナビ、フッターナビ、取込状態を表示 |
| `.main` | `public/index.html` | トップバーと `#content` を含む |
| `.topbar` | `public/index.html`, `style.css` | ページタイトル、ステータス、クイック設定、グローバルフィルターを表示 |
| `#content` | `public/index.html`, `app.js` | 各 `render*` 関数が画面HTMLを差し替える |

## 2. サイドバー

| 項目 | 仕様 |
|---|---|
| ナビゲーション | `NAV_SECTIONS` と `UTILITY_NAV_PAGES` から生成 |
| 区分 | メインCSV、追加CSV、共通・ユーティリティ |
| 折りたたみ | `sidebarCollapse` クリックで `body.sidebar-collapsed` を切替 |
| モバイル | `mobileMenuToggle` と `mobileMenuBackdrop` で開閉 |
| 状態表示 | `#sidebarMeta` に未取込/取込情報を表示 |

## 3. トップバー

| 項目 | 仕様 |
|---|---|
| ページタイトル | `#pageTitle` に現在ページ名を表示 |
| ステータス | `#statusBadge` にデータ状態を表示 |
| クイック設定 | テーマ切替、表示倍率±、リセット |
| グローバルフィルター | `#globalFilters` に対象期間、部署、分析軸、対象を表示。取込/設定/使い方では非表示 |

## 4. グローバルフィルター

| フィルター | 内部キー | 備考 |
|---|---|---|
| 対象期間 | `scopeMode`, `scopePreset`, `customRangeUnit`, `targetYearMonth`, `targetYearMonthFrom`, `targetYearMonthTo`, `fiscalPeriod`, `fiscalPeriodFrom`, `fiscalPeriodTo` | ポップオーバーで当月、前月、直近3/12か月、当期通期、前期通期、データ最新月、カスタム月/期範囲を指定する。現在日時ベースのプリセットとデータ最新月は明示的に分ける |
| 部署 | `state.filters.department` | `department_name` |
| 分析視点 | `state.filters.perspective` | カテゴリ分析等に影響 |
| 対象 | `state.filters.target` | 値の正式定義は未確認 |

## 5. カード・KPI

| 要素 | 仕様 |
|---|---|
| `.panel` | 標準カード/パネル |
| `.bento-card` | ダッシュボード用カード |
| `.kpi-strip` | KPIカードの横並び/グリッド |
| KPIアニメーション | `animateNumericValues` で数値をアニメーション。`prefers-reduced-motion` 時は抑制 |
| ヘルプテキスト | `standardKpiCardHtml` の `helpText` / `note` |

## 6. テーブル

| 項目 | 仕様 |
|---|---|
| ラッパー | `.table-wrap` で横スクロールに対応 |
| 数値寄せ | `.right` で右寄せ |
| 状態色 | `.warn`, `.ok` 等で差額や警告を表示 |
| エスケープ | 表示値は `escapeHtml` / `displayHtml` を通す実装が多い |

## 7. グラフ

| 項目 | 仕様 |
|---|---|
| ライブラリ | ローカル同梱 Chart.js |
| 共通設定 | `baseChartOptions` |
| テーマ色 | `chartColors` がテーマに応じて色を返す |
| 軸単位 | 金額単位切替に応じて千円/百万円/億円表示 |
| アニメーション | `prefers-reduced-motion: reduce` の場合 duration 0 |

## 8. テーマ

| テーマ | `body[data-theme]` | 仕様 |
|---|---|---|
| ライト | `light` | 既定テーマ |
| ダーク | `dark` | `color-scheme: dark`、暗色背景 |
| ネオン | `neon` | `color-scheme: dark`、ネオン風フォント/色 |

テーマは `localStorage.theme` に保存され、`applyTheme` で body 属性へ反映されます。

## 9. 表示倍率

| 項目 | 仕様 |
|---|---|
| 範囲 | 75〜150% |
| 刻み | 5% |
| 既定 | 100% |
| 保存 | `localStorage.displayZoom` |
| 操作 | トップバーの `−`, `＋`, `100%`、キーボードショートカット対応あり |

## 10. レスポンシブ対応

`style.css` にはモバイルメニュー、サイドバー開閉、グリッドのレスポンシブ調整が定義されています。詳細ブレークポイントはCSSを参照してください。

## 11. アクセシビリティ上の配慮

| 配慮 | 実装 |
|---|---|
| 言語 | `html lang="ja"` |
| viewport | `meta viewport` |
| ボタンラベル | サイドバー、モバイルメニュー、テーマ、倍率に `aria-label` |
| `aria-live` | 表示倍率値に `aria-live="polite"` |
| focus | `:focus-visible` にアウトライン |
| motion | `prefers-reduced-motion` を JS/CSS で考慮 |
| 外部依存 | README上、外部CDN参照なし。ローカル同梱ファイルのみ |

## 12. 未確認事項

- WCAGレベルの正式なアクセシビリティ基準。
- 色コントラストの機械検査結果。
- キーボード操作の網羅的な仕様。

## 表示中内容の出力UI

- ダッシュボード系画面（全体サマリー、推移分析、カテゴリ別分析、アラート、ベンダー／契約更新、明細ドリルダウン、新規案件コスト、減価償却シミュレーション、OACIS実績）は、画面タイトル付近に共通の出力操作を表示します。
- PDFを主用途とするため、主ボタンは「PDF出力」とし、HTML保存は隣接するドロップダウンメニュー内の補助操作とします。
- 出力対象は `#export-root` 配下の現在DOMです。グローバルナビゲーション、トップバー、出力ボタン、設定系操作UIは業務報告に不要なため、PDF出力時の `export-mode` / `@media print` では非表示にします。
- レポート冒頭にはアプリ名、画面名、出力日時、適用条件サマリーを表示します。フィルタUIそのものではなく、期・年月・部門・視点・対象・金額単位などの条件を読みやすい一覧として表示します。
- レポートヘッダーは `<details>` / `<summary>` で表示し、初期状態は閉じた状態です。画面単位の閉じる／展開状態を `localStorage` に保存し、次回描画時に復元します。PDF/HTML保存時は出力内容の欠落を防ぐため、保存処理中だけ自動的に展開し、保存後に元の状態へ戻します。
- Chart.jsグラフは出力前に `resize()` / `update('none')` を実行し、複数フレーム待機してからPDF/HTMLの保存処理を行います。

### 推移分析の表示単位

`月別` / `四半期別` / `期別` / `累計推移` は上部共通フィルターではなく、推移分析画面内の `state.ui.trendAggregationUnit` で切り替えます。


## 対象期間ショートカット

対象期間ポップオーバーの `よく使う` タブは localStorage の `periodQuickFilters` / `periodQuickDefault` を利用し、表示有無・表示順・初期表示をユーザーごとに保持します。`当月`、`前月`、`直近3か月`、`直近12か月`、`当期通期`、`前期通期` は保存時点の年月ではなく、利用時点のブラウザ現在日時で再計算します。`データ最新月` は取込データ内の最大年月であり、未来計画を含む場合は将来年月として表示します。

## AI分析用プロンプト / Copilot分析支援UI

- ダッシュボード系画面のトップバー操作に「AI分析用プロンプト」ボタンを表示します。メインCSV上部共通のグローバルフィルター行や出力操作欄には表示しません。
- ボタン押下で右ドロワーを開き、対象画面・対象期間・部門・対象条件、含めるデータを確認できます。担当者名はチェック時のみ含め、契約番号と機密項目マスク切替は表示しません。
- 「プロンプト生成」は `POST /api/ai-prompt` を呼び出し、生成Markdownをプレビュー欄に表示します。生成開始時と画面遷移時には前回のプレビューをクリアします。
- 「プロンプトをコピー」は Clipboard API を使います。失敗時はプレビュー欄から手動コピーする警告を表示します。
- 「Copilotを開く」は `https://m365.cloud.microsoft/chat` を新規タブで開きます。プロンプト本文はURLパラメータに含めません。
- 「Markdownを保存」「JSONを保存」は、それぞれ生成済みMarkdownと分析用JSONコンテキストをローカルダウンロードします。
- このUIは外部AI API呼び出し、外部ドメインDOM操作、Copilot入力欄への自動投入を行いません。
