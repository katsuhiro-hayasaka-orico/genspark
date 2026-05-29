# 新規案件コスト画面

## 1. 画面概要

追加CSVの新規案件マスタと新規案件月次金額をもとに、予算・見込差額、進捗率、コスト消化率、ギャップを分析する画面です。

## 2. 表示条件

`GET /api/analysis/new-project-costs` が取得可能であること。追加CSV未取込の場合は空またはnot_imported相当の表示になります。

## 3. 主な利用データ

| データ | 用途 |
|---|---|
| `summary` | KPI |
| `projectRanking` | 差額ランキング |
| `progressCostMatrix` | 進捗・コスト消化ギャップ |
| `byProjectCategory` | 案件区分別比較 |
| `byCostGroup` | 投資/運用系比較 |
| `byVarianceReason` | 差額理由サマリー |
| `detailRows` | 詳細テーブル |
| `debug` | 算出不可理由の件数 |

## 4. 主な利用API

`GET /api/analysis/new-project-costs`。必要に応じて取込状況は `GET /api/status`。

## 5. 画面レイアウト

KPI、金額単位切替、差額ランキング、進捗・コスト消化ギャップ分析、区分別比較、差額理由サマリー、詳細テーブルで構成されます。

## 6. 表示項目

プロジェクト名、管理番号、担当者、本番開始予定日、IT投資シミュレーションNo、案件区分、進捗状況、進捗率、予算金額、見込金額、差額、差額率、コスト消化率、ギャップ判定、差額理由、memoを表示します。

## 7. 操作仕様

金額単位切替、ランキング更新、詳細テーブル参照を行います。行からメイン明細への遷移可否は未確認です。

## 8. フィルター・ソート仕様

APIレスポンスのランキングは差額絶対値の大きい順です。画面側で最新データ再取得を行う箇所があります。

## 9. グラフ・テーブル仕様

差額ランキング、マトリクス/散布図相当、区分別テーブル、差額理由テーブル、詳細テーブルを表示します。

## 10. ドリルダウン仕様

管理番号があるため将来的な明細遷移対象ですが、実装上の遷移仕様は未確認です。

## 11. 計算仕様

| 計算 | 仕様 |
|---|---|
| コスト消化率 | `forecastAmount / budgetAmount * 100` |
| ギャップ | `costConsumptionRate - progressRate` |
| 判定 | `alert`, `watch`, `progressAhead`, `normal` |
| 予算0 | `costConsumptionRate = null`、debugに計上 |
| 進捗率未算出 | `progressRate = null`、debugに計上 |

## 12. エラー・空データ時の表示

API取得失敗時は `null` フォールバックがあります。追加CSV不足時は空配列/0件として表示されます。算出不能は debug と判定不可相当で扱います。

## 13. 関連ソース

| ソース | 関数 |
|---|---|
| `public/static/app.js` | `renderProject` |
| `server.js` | `app.get(/api/analysis/new-project-costs)`, `buildNewProjectAnalysis`, `deriveProgressRateFromStatus`, `deriveCostGroup`, `deriveVarianceReason` |

## 14. 未確認事項

- 進捗状況文字列の業務マスタ。
- 判定区分の画面ラベル正式名称。
- 予算0案件を集計母数に含めるかの業務判断。

## 共通出力仕様

- 画面描画後、`renderPage` が主要コンテンツを `#export-root` で囲み、画面タイトル付近に「PDF出力」主ボタンと、HTML保存用の補助メニューを表示します。
- 出力対象は再集計データではなく、フィルタ・ランキング・ドリルダウン後の現在DOMです。
- PDF/HTMLにはレポートタイトル、出力日時、対象画面名、適用条件サマリー、画面上のカード・グラフ・テーブルを含めます。
- レポートヘッダーは初期状態を閉じた状態とし、クリックで閉じる／展開できます。画面単位の開閉状態は `localStorage` に保存・復元し、保存処理中は欠落防止のため自動展開してから元の状態へ戻します。
- PDF出力時は `export-mode` を一時付与して、サイドバー・トップバー・出力ボタンを非表示にし、A4横向きの印刷レイアウトを適用します。
