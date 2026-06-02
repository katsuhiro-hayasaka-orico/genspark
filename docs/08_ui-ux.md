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
| グローバルフィルター | `#globalFilters` に期、年月、部署等を表示。取込/設定/使い方では非表示 |

## 4. グローバルフィルター

| フィルター | 内部キー | 備考 |
|---|---|---|
| 期間モード | `state.filters.periodMode` | 月次/期等 |
| 部署 | `state.filters.department` | `department_name` |
| 分析視点 | `state.filters.perspective` | カテゴリ分析等に影響 |
| 対象 | `state.filters.target` | 値の正式定義は未確認 |
| 期 | `fiscalPeriod`, `fiscalPeriodFrom`, `fiscalPeriodTo` | 範囲指定あり。対象年月候補は選択期範囲にカスケードし、67期=2026/04〜2027/03を基準にする |
| 対象年月 | `targetYearMonth` | `YYYYMM` |

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
