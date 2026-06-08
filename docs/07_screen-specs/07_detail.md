# 明細ドリルダウン画面

## 1. 画面概要

検索、フィルター、追加列選択により予実績明細を確認する保守向け詳細画面です。

## 2. 表示条件

メインCSV取込済み。サマリー/カテゴリ/アラート等から `state.ui.detailFilter` が設定される場合があります。

## 3. 主な利用データ

| データ | 用途 |
|---|---|
| `state.data.items` | 表示明細 |
| `state.ui.detailSearch` | 検索語 |
| `state.ui.extraDetailCols` | 追加表示列 |
| `state.ui.detailFilter` | ドリルダウン条件 |

## 4. 主な利用API

`GET /api/items`。関連APIとして `GET /api/raw-rows`。

## 5. 画面レイアウト

検索/フィルター操作エリア、追加列選択、明細テーブル、行クリック後に月次データを表示する詳細ペイン、選択条件表示で構成します。

## 6. 表示項目

| 表示列 | 内部キー例 |
|---|---|
| 管理番号 | `management_no` |
| 項番 | `item_no` |
| 期/対象年月 | `fiscal_period`, `target_year_month` |
| 案件/システム | `project_name`, `system_name` |
| 部署/担当/ベンダー | `department_name`, `owner_name`, `vendor_name` |
| 金額 | `totalPlan`, `totalForecast`, `totalActual`, `variance` |
| 追加列 | `state.ui.extraDetailCols` |
| 詳細ペイン（月次） | 年月、計画、見込、実績、差額理由分類、差額理由、コメント |

## 7. 操作仕様

検索語入力、フィルター解除、追加列変更、管理番号リンク、明細行クリックによる詳細ペイン表示の操作があります。

## 8. フィルター・ソート仕様

`itemMatchesDetailFilter` と `detailSearch` により絞り込みます。ソートは表示列や差額順の実装があるかコード照合が必要です。

## 9. グラフ・テーブル仕様

グラフはありません。明細テーブルと詳細ペインの月次テーブルを表示します。詳細ペインの列順は「年月、計画、見込、実績、差額理由分類、差額理由、コメント」です。差額理由分類・差額理由・コメントは月次データ側の値を優先し、空の場合は行全体の値へフォールバックします。月次データがない場合は7列結合で「月次データなし」と表示します。

## 10. ドリルダウン仕様

他画面から `setDetailFilter(type, value)` または `setDetailFilter('dimension', value, dimensionId)` で条件が設定されます。カテゴリ別分析からの遷移では `state.ui.detailFilter = { type: 'dimension', dimensionId, value }` を保持し、対象分類軸のフィールドだけで絞り込みます。管理番号クリックは `bindManagementNoDrilldowns` が処理します。

## 11. 計算仕様

表示金額は既に `state.data.items` に含まれる集計済み項目、またはフロント側の対象期間集計を利用します。

## 12. エラー・空データ時の表示

検索結果0件の場合は空テーブル。データ未取込時は取込画面へ戻ります。

## 13. 関連ソース

| ソース | 関数 |
|---|---|
| `public/static/app.js` | `renderDetail`, `setDetailFilter`, `detailFilterLabel`, `itemMatchesDetailFilter`, `getCategoryDimensionValue`, `DETAIL_COLUMN_LABELS` |
| `server.js` | `app.get(/api/items)`, `app.get(/api/raw-rows)` |

## 14. 未確認事項

- raw rows の画面上の露出範囲。

## 共通出力仕様

- 画面描画後、`renderPage` が主要コンテンツを `#export-root` で囲み、画面タイトル付近に「PDF出力」主ボタンと、HTML保存用の補助メニューを表示します。
- 出力対象は再集計データではなく、フィルタ・ランキング・ドリルダウン後の現在DOMです。
- PDF/HTMLにはレポートタイトル、出力日時、対象画面名、適用条件サマリー、画面上のカード・グラフ・テーブルを含めます。
- レポートヘッダーは初期状態を閉じた状態とし、クリックで閉じる／展開できます。画面単位の開閉状態は `localStorage` に保存・復元し、保存処理中は欠落防止のため自動展開してから元の状態へ戻します。
- PDF出力時は `export-mode` を一時付与して、サイドバー・トップバー・出力ボタンを非表示にし、A4横向きの印刷レイアウトを適用します。

## AI分析用プロンプト

明細ドリルダウン画面では、現在のフィルター条件を反映した明細確認用のAI分析用プロンプトを生成できます。既定では差額上位10件のみを含み、ユーザーが明示した場合だけ明細件数を増やします。担当者名はユーザーが明示選択した場合のみ含め、契約番号は含めるデータ対象外です。
