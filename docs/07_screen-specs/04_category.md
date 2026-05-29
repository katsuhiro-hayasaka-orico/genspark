# カテゴリ別分析画面

## 1. 画面概要

システム分類、部署、ベンダー、費目などの分析軸ごとに構成比・差額・乖離率を確認する画面です。

## 2. 表示条件

メインCSV取込済み。`state.ui.categoryTab` により選択タブを保持します。

## 3. 主な利用データ

| データ | 用途 |
|---|---|
| `state.data.items` | 分析軸別集計 |
| `state.ui.categoryTab` | 分析タブ |
| `state.ui.units.category` | 金額単位 |

## 4. 主な利用API

主に `GET /api/items`。関連APIとして `/api/analysis/by-classification`, `/api/analysis/by-department`, `/api/analysis/by-vendor`, `/api/analysis/by-expense-item`, `/api/analysis/by-fixed-variable` があります。

## 5. 画面レイアウト

分析タブ、KPI/構成比カード、棒グラフまたは円グラフ、差額・乖離率テーブルで構成します。

## 6. 表示項目

分析軸名、予算、見込み/実績、差額、差額率、構成比、件数を表示します。

## 7. 操作仕様

タブ切替、金額単位切替、行/リンククリックによる明細遷移を行います。

## 8. フィルター・ソート仕様

グローバルフィルター適用後のデータを、選択中カテゴリ軸で集計します。ソートは金額または差額上位の実装です。

## 9. グラフ・テーブル仕様

構成比グラフ、差額グラフ、集計テーブルを表示します。

## 10. ドリルダウン仕様

カテゴリ値を `setDetailFilter` に渡し、明細ドリルダウン画面へ遷移します。

## 11. 計算仕様

カテゴリ単位で plan/forecast/actual と差額・差額率を集計します。

## 12. エラー・空データ時の表示

対象データなしの場合は空のカード/テーブルになります。データ未取込時は取込画面へ戻ります。

## 13. 関連ソース

| ソース | 関数 |
|---|---|
| `public/static/app.js` | `renderCategory`, `getPerspectiveKey`, `bindDetailFilterLinks` |
| `server.js` | `app.get(/api/items)`, `getAggregations`, 各 `/api/analysis/by-*` |

## 14. 未確認事項

- 分析タブ名称と業務分類の正式対応。
- 構成比の分母に含めるデータ範囲。
