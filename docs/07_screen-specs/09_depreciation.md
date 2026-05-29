# 減価償却シミュレーション画面

## 1. 画面概要

追加CSV「減価償却シミュレーション」を期・月・半期・通期・償却展開区分名で集計する画面です。

## 2. 表示条件

メインCSV未取込でも、`depreciation_simulation` の追加CSVが imported なら表示可能です。

## 3. 主な利用データ

| データ | 用途 |
|---|---|
| `state.data.depreciation` | 追加CSV行 |
| `state.ui.depreciationFilters.fiscalPeriod` | 選択期 |
| `state.ui.depreciationFilters.categoryName` | 償却展開区分名絞り込み |
| `state.ui.units.depreciation` | 金額単位 |

## 4. 主な利用API

`GET /api/additional-data/depreciation_simulation`。

## 5. 画面レイアウト

フィルター、金額単位切替、KPI、月次チャート、65期〜70期通期推移、Top10、前期差ランキング、半期・通期/明細一覧で構成されます。

## 6. 表示項目

区分、償却展開区分、償却展開区分名、期間種別、期、月、金額、選択期上期/下期/通期、前期通期、前期差、前期差率を表示します。

## 7. 操作仕様

期・区分名フィルター、金額単位切替を行います。

## 8. フィルター・ソート仕様

期、償却展開区分名で絞り込みます。Top10は通期償却費、前期差ランキングは前期差で並びます。

## 9. グラフ・テーブル仕様

月次チャート、通期推移棒グラフ、ランキングテーブルを表示します。

## 10. ドリルダウン仕様

メイン明細との管理番号結合はありません。ドリルダウン仕様は未実装/未確認です。

## 11. 計算仕様

月次/半期/通期を `period_type` で分類し、選択期と前期の通期差・差率を算出します。

## 12. エラー・空データ時の表示

追加CSV未取込時は空データ表示または取込画面誘導。金額不正は0扱いかつ `amount_valid=false`。

## 13. 関連ソース

| ソース | 関数 |
|---|---|
| `public/static/app.js` | `renderDepreciation`, `drawDepreciationMonthlyChart`, `drawDepreciationBarChart` |
| `server.js` | `parseDepreciationSimulationCsv`, `normalizeDepreciationSimulationRecord`, `app.get(/api/additional-data/:fileType)` |

## 14. 未確認事項

- 65期〜70期が固定表示でよいか。
- 金額単位の正式定義。
- 償却展開区分の業務マスタ。

## 共通出力仕様

- 画面描画後、`renderPage` が主要コンテンツを `#export-root` で囲み、画面タイトル付近に「PDF出力」主ボタンと、HTML保存用の補助メニューを表示します。
- 出力対象は再集計データではなく、フィルタ・ランキング・ドリルダウン後の現在DOMです。
- PDF/HTMLにはレポートタイトル、出力日時、対象画面名、適用条件サマリー、画面上のカード・グラフ・テーブルを含めます。
- レポートヘッダーはクリックで閉じる／展開できます。保存処理中は欠落防止のため自動展開します。
- PDF出力時は `export-mode` を一時付与して、サイドバー・トップバー・出力ボタンを非表示にし、A4横向きの印刷レイアウトを適用します。
