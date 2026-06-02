# 全体サマリー画面

## 1. 画面概要

メインCSVから得た予算・見込み/実績・差額を、KPIカード、グラフ、報告用サマリー、差額ランキングで確認する画面です。

## 2. 表示条件

- `state.hasData` が true。
- `GET /api/items` により `state.data.items` が取得済み。

## 3. 主な利用データ

| データ | 用途 |
|---|---|
| `state.data.items` | KPI・ランキング・グラフの元データ |
| `state.filters` | 期、年月、部署、分析視点などの絞り込み |
| `state.ui.units.summary` | 金額単位 |

## 4. 主な利用API

`GET /api/items`、初期取得時に `GET /api/status`。サーバ側 `/api/dashboard/summary` も存在しますが、現行 `renderSummary` はフロント側再集計中心です。

## 5. 画面レイアウト

KPIストリップ、金額単位切替、予算vs見込み/実績グラフ、報告用サマリー、差額ランキング、補助カードで構成されます。

## 6. 表示項目

| 表示項目 | 主な内部キー |
|---|---|
| 総予算 | `totalPlan` |
| 見込み/実績 | `totalForecast`, `totalActual`, `getComparableActual` |
| 予算消化率 | `burnRate` |
| 差額 | `variance` |
| 着地見込み | `totalForecast` 等 |
| コスト削減効果 | 実装上のKPI名。正式式は未確認 |
| 差額ランキング | `project_name`, `system_name`, `variance` 等 |

## 7. 操作仕様

金額単位切替、ランキングやカードからの明細ドリルダウン、グローバルフィルター変更による再描画を行います。

## 8. フィルター・ソート仕様

グローバルフィルター（集計軸、対象期間、部署、分析視点等）を利用します。対象期間は単月を既定とし、対象期累計・直近3か月・直近12か月・カスタム範囲を1つのコントロールから選択します。カスタム範囲を選んだ場合のみ、対象月または対象期の開始/終了を表示します。対象期は67期=2026年4月〜2027年3月、66期=2025年4月〜2026年3月として月範囲へ展開し、選択範囲の月次データだけを累計します。差額ランキングは差額絶対値または差額の大きい順で表示される実装です。

## 9. グラフ・テーブル仕様

Chart.js による予算 vs 見込み/実績グラフを描画します。KPI値には `animateNumericValues` が適用されます。

## 10. ドリルダウン仕様

管理番号やカテゴリリンクから `setDetailFilter` を通じて明細画面へ遷移します。

## 11. 計算仕様

`scopedItemTotals`, `scopedPeriodSummary`, `recomputeSummary`, `calculateVariance`, `calculateBurnRate` を参照します。

## 12. エラー・空データ時の表示

データ未取込時は取込画面へ戻ります。フィルター結果が空の場合は0件/空表示となります。

## 13. 関連ソース

| ソース | 関数 |
|---|---|
| `public/static/app.js` | `renderSummary`, `recomputeSummary`, `scopedItemTotals`, `drawSummaryChart`, `bindDetailFilterLinks` |
| `server.js` | `app.get(/api/items)`, `buildUnifiedData` |

## 14. 未確認事項

- コスト削減効果の正式式。
- 報告用サマリーの文言要件。

## 共通出力仕様

- 画面描画後、`renderPage` が主要コンテンツを `#export-root` で囲み、画面タイトル付近に「PDF出力」主ボタンと、HTML保存用の補助メニューを表示します。
- 出力対象は再集計データではなく、フィルタ・ランキング・ドリルダウン後の現在DOMです。
- PDF/HTMLにはレポートタイトル、出力日時、対象画面名、適用条件サマリー、画面上のカード・グラフ・テーブルを含めます。
- レポートヘッダーは初期状態を閉じた状態とし、クリックで閉じる／展開できます。画面単位の開閉状態は `localStorage` に保存・復元し、保存処理中は欠落防止のため自動展開してから元の状態へ戻します。
- PDF出力時は `export-mode` を一時付与して、サイドバー・トップバー・出力ボタンを非表示にし、A4横向きの印刷レイアウトを適用します。
