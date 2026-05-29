# 推移分析画面

## 1. 画面概要

月次または期間別の予算・見込み・実績推移と、変動ランキングを確認する画面です。

## 2. 表示条件

メインCSV取込済み、かつ `state.data.items` が取得済みであること。

## 3. 主な利用データ

| データ | 用途 |
|---|---|
| `state.data.items` | 時系列集計 |
| `state.ui.trendMonths` | 表示月数 |
| `state.ui.trendMetric` | 表示指標 |
| `state.ui.units.trend` | 金額単位 |

## 4. 主な利用API

主に `GET /api/items`。サーバ側には `GET /api/analysis/monthly` と `GET /api/analysis/yoy` もあります。

## 5. 画面レイアウト

期間選択、指標選択、金額単位切替、推移グラフ、変動ランキングのカードで構成します。

## 6. 表示項目

| 表示項目 | 内部キー |
|---|---|
| 対象年月 | `target_year_month` |
| 計画 | `plan`, `totalPlan` |
| 見込み | `forecast`, `totalForecast` |
| 実績 | `actual`, `totalActual` |
| 差額/変動 | 集計結果 |

## 7. 操作仕様

表示月数、指標、金額単位を変更すると再描画します。

## 8. フィルター・ソート仕様

グローバルフィルターと画面内の期間・指標選択を併用します。ランキングは変動額/率に基づきます。

## 9. グラフ・テーブル仕様

`buildTimeSeries` で時系列バケットを作成し、Chart.js の折れ線/棒グラフを描画します。

## 10. ドリルダウン仕様

変動ランキングから明細へ遷移できる箇所は `bindDetailFilterLinks` の対象です。

## 11. 計算仕様

月次合計、前月差、前年比等を算出します。前年比APIも存在しますが画面内の正確な利用範囲はコード照合が必要です。

## 12. エラー・空データ時の表示

データがない月は0または空として表示されます。データ未取込時は取込画面へ戻ります。

## 13. 関連ソース

| ソース | 関数 |
|---|---|
| `public/static/app.js` | `renderTrend`, `buildTimeSeries`, `drawTrendChart` |
| `server.js` | `app.get(/api/items)`, `app.get(/api/analysis/monthly)`, `app.get(/api/analysis/yoy)` |

## 14. 未確認事項

- 指標選択肢ごとの正式な業務意味。
- 変動ランキングの同率時ソート順。

## 共通出力仕様

- 画面描画後、`renderPage` が主要コンテンツを `#export-root` で囲み、画面タイトル付近に「PDF出力」主ボタンと、HTML/PNG保存用の補助メニューを表示します。
- 出力対象は再集計データではなく、フィルタ・ランキング・ドリルダウン後の現在DOMです。
- PDF/HTML/PNGにはレポートタイトル、出力日時、対象画面名、適用条件サマリー、画面上のカード・グラフ・テーブルを含めます。
- PDF出力時は `export-mode` を一時付与して、サイドバー・トップバー・出力ボタンを非表示にし、A4横向きの印刷レイアウトを適用します。
