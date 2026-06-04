# カテゴリ別分析画面

## 1. 画面概要

分類軸レジストリで定義された分析軸ごとに、構成比・予算・見込み・実績・差額・乖離率・件数を確認する画面です。分類軸の増減時は `CATEGORY_DIMENSIONS` に定義を追加・変更することで、画面タブの個別改修を最小化します。

## 2. 表示条件

メインCSV取込済み。`state.ui.selectedCategoryDimension` により選択中の分類軸IDを保持し、旧 `state.ui.categoryTab` は `LEGACY_CATEGORY_TAB_MAP` で後方互換変換します。

## 3. 主な利用データ

| データ | 用途 |
|---|---|
| `state.data.items` | 分析軸別集計 |
| `CATEGORY_DIMENSIONS` | 分類軸ID、表示名、参照フィールド、お気に入り、表示順の定義 |
| `state.ui.selectedCategoryDimension` | 選択中の分類軸ID |
| `state.ui.categoryTopN` | 分類別テーブルの表示件数（10/25/50/全件） |
| `state.ui.units.category` | 金額単位 |
| `item.dimensions` | 将来拡張用の分類軸値マップ。既存フィールド参照を優先しつつ利用可能 |

## 4. 主な利用API

主に `GET /api/items`。関連APIとして `/api/analysis/by-classification`, `/api/analysis/by-department`, `/api/analysis/by-vendor`, `/api/analysis/by-expense-item`, `/api/analysis/by-fixed-variable` があります。

## 5. 画面レイアウト

分類軸セレクトボックス、Top Nセレクタ、金額単位切替、よく使う分類軸チップ、構成比グラフ、分類別テーブルで構成します。固定タブは使用しません。

## 6. 表示項目

分類値、構成比、予算、見込み、実績、差額、乖離率、件数を表示します。分類値が空の場合は `未設定` と表示します。

## 7. 操作仕様

分類軸セレクト、よく使う分類軸チップ、Top N切替、金額単位切替、分類値クリックによる明細遷移を行います。Top Nは 10 / 25 / 50 / 全件から選択します。

## 8. フィルター・ソート仕様

グローバルフィルター適用後のデータを、選択中の分類軸IDで `aggregateByDimension` により集計します。構成比の降順で表示し、グラフはTop 10、テーブルはTop Nに従います。

## 9. グラフ・テーブル仕様

構成比グラフは選択分類軸のTop 10をドーナツグラフで表示します。分類別テーブルはTop Nに従い、予算・見込み・実績・差額・乖離率を併記します。

## 10. ドリルダウン仕様

分類値クリック時は `setDetailFilter('dimension', value, dimensionId)` を使用し、明細画面で `dimensionId + value` により該当フィールドだけを絞り込みます。曖昧な `category` 横断検索には依存しません。

## 11. 計算仕様

カテゴリ単位で `plan` / `forecast` / `actual` / `count` を集計し、構成比、差額（予算 - 実績）、乖離率を算出します。構成比分母は実績合計を優先し、実績がない場合は見込み、見込みもない場合は予算を用います。

## 12. エラー・空データ時の表示

対象データなしの場合は空テーブルメッセージを表示します。分類軸定義が不正または未設定でも、既定の有効分類軸または `未設定` として扱い、画面全体が表示不能にならないようにします。

## 13. 関連ソース

| ソース | 関数 |
|---|---|
| `public/static/app.js` | `CATEGORY_DIMENSIONS`, `getEnabledCategoryDimensions`, `getCategoryDimensionById`, `normalizeCategoryDimensionId`, `getCategoryDimensionValue`, `aggregateByDimension`, `renderCategory`, `bindDetailFilterLinks` |
| `server.js` | `app.get(/api/items)`, `attachItemDimensions`, `getAggregations`, 各 `/api/analysis/by-*` |

## 14. 未確認事項

- 今後追加される分類軸（事業優先度、クラウド分類、管理区分、施策分類など）の正式なCSV列名・業務定義。
- 分類軸マスタCSVまたは設定画面で分類軸を管理する場合の権限・保存方式。

## 共通出力仕様

- 画面描画後、`renderPage` が主要コンテンツを `#export-root` で囲み、画面タイトル付近に「PDF出力」主ボタンと、HTML保存用の補助メニューを表示します。
- 出力対象は再集計データではなく、フィルタ・ランキング・ドリルダウン後の現在DOMです。
- PDF/HTMLにはレポートタイトル、出力日時、対象画面名、適用条件サマリー、画面上のカード・グラフ・テーブルを含めます。
- レポートヘッダーは初期状態を閉じた状態とし、クリックで閉じる／展開できます。画面単位の開閉状態は `localStorage` に保存・復元し、保存処理中は欠落防止のため自動展開してから元の状態へ戻します。
- PDF出力時は `export-mode` を一時付与して、サイドバー・トップバー・出力ボタンを非表示にし、A4横向きの印刷レイアウトを適用します。
