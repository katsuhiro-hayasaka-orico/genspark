# 画面一覧

`public/static/app.js` の `NAV_SECTIONS`、`UTILITY_NAV_PAGES`、`renderPage`、各 `render*` 関数から読み取れる画面一覧です。

| 区分 | 画面キー | 画面名 | 主な役割 | 対応するrender関数 | 主な利用API | 対応する画面仕様書 | 備考 |
|---|---|---|---|---|---|---|---|
| メインCSV | `import` | データ取込 | CSV種別選択、CSVアップロード、取込状況表示、保存データクリア | `renderImport` | `POST /api/upload`, `GET /api/status`, `POST /api/clear` | [01_import.md](./07_screen-specs/01_import.md) | データ未取込時の初期遷移先 |
| メインCSV | `summary` | 全体サマリー | KPI、予算vs見込み/実績、報告用サマリー、差額ランキング | `renderSummary` | `GET /api/status`, `GET /api/items` | [02_summary.md](./07_screen-specs/02_summary.md) | `state.data.items` からフロント側再集計 |
| メインCSV | `trend` | 推移分析 | 期間・指標選択、推移グラフ、変動ランキング | `renderTrend` | `GET /api/items` | [03_trend.md](./07_screen-specs/03_trend.md) | `buildTimeSeries` を利用 |
| メインCSV | `category` | カテゴリ別分析 | 分類軸セレクタ、追加分類軸、構成比、差額・乖離率、明細遷移 | `renderCategory` | `GET /api/items` | [04_category.md](./07_screen-specs/04_category.md) | 分析軸は `state.ui.selectedCategoryDimension` と `categoryDimensions` |
| メインCSV | `alert` | アラート | しきい値、アラートカード、アラート一覧 | `renderAlert` | `GET /api/items` | [05_alert.md](./07_screen-specs/05_alert.md) | しきい値は `state.settings.thresholds` |
| メインCSV | `vendor` | ベンダー／契約更新 | ベンダー別金額、契約更新アラート、レビュー候補 | `renderVendor` | `GET /api/items`, `GET /api/contracts` | [06_vendor.md](./07_screen-specs/06_vendor.md) | サーバ側に契約APIあり |
| メインCSV | `detail` | 明細ドリルダウン | 検索、フィルター、表示列、追加列、明細一覧 | `renderDetail` | `GET /api/items`, `GET /api/raw-rows` | [07_detail.md](./07_screen-specs/07_detail.md) | ドリルダウンリンクから遷移 |
| 追加CSV | `project` | 新規案件コスト | 新規案件コスト分析、進捗・コスト消化ギャップ、差額理由 | `renderProject` | `GET /api/analysis/new-project-costs` | [08_new-project-cost.md](./07_screen-specs/08_new-project-cost.md) | 新規案件マスタ/月次金額を優先利用 |
| 追加CSV | `depreciation` | 減価償却シミュレーション | 減価償却シミュレーションCSVの集計・ランキング | `renderDepreciation` | `GET /api/additional-data/depreciation_simulation` | [09_depreciation.md](./07_screen-specs/09_depreciation.md) | データ未取込でも追加CSV単独表示条件あり |
| 追加CSV | `oacis` | OACIS実績 | OACIS実績のKPI、経費事象/サプライヤ/予実番号ランキング | `renderOacisActual` | `GET /api/analysis/oacis-actual` | [10_oacis.md](./07_screen-specs/10_oacis.md) | `oasis_actual` という内部キーを使用 |
| 共通・ユーティリティ | `settings` | 表示設定 | テーマ、表示倍率、しきい値、KPI順序、対象期間ショートカット | `renderSettings` | なし（localStorage/state中心） | [11_settings.md](./07_screen-specs/11_settings.md) | クイック設定から遷移 |
| 共通・ユーティリティ | `manual` | 使い方 | アプリ内ヘルプ、操作説明 | `renderManual` | なし | [12_manual.md](./07_screen-specs/12_manual.md) | 実装上のヘルプ内容を仕様化 |

## 未確認事項

- README のAPI一覧には古い可能性がある `by-category` / `by-domain` が残っていますが、現行 `server.js` では `by-classification` / `by-department` 等が確認できます。正式な互換方針は未確認です。

## 共通出力操作

主要ダッシュボード画面（`summary`、`trend`、`category`、`alert`、`vendor`、`detail`、`project`、`depreciation`、`oacis`）では、`renderPage` の描画後に共通の出力ラッパーを付与します。画面タイトル付近に「PDF出力」主ボタンを表示し、補助メニューからHTML保存を実行できます。

出力対象は `#export-root` 配下に描画済みの現在DOMです。グローバルフィルター、画面内フィルター、金額単位、ランキング、ドリルダウン状態など、画面に反映済みの状態を業務報告用レイアウトとして出力します。

レポートヘッダーは初期状態を閉じた状態とし、画面単位の開閉状態を `localStorage` に保存・復元します。PDF/HTML出力時は必ず展開して出力し、出力後に元の状態へ戻します。
