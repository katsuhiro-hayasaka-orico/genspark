# 表示設定画面

## 1. 画面概要

テーマ、表示倍率、しきい値、KPI順序、対象期間ショートカット、カテゴリ別分析の初期表示、分類軸管理など、フロントエンド表示設定を変更する画面です。

## 2. 表示条件

常時表示可能です。メインCSV未取込でも利用できます。CSV検出分類軸は、メインCSV取込後に `state.data.status.categoryDimensions` から表示されます。

## 3. 主な利用データ

| データ | 用途 |
|---|---|
| `state.ui.theme` | テーマ |
| `state.ui.displayZoom` | 表示倍率 |
| `state.settings.thresholds` | アラートしきい値 |
| `state.settings.kpiOrder` | KPI順序 |
| `periodQuickFilters` / `periodQuickDefault` | 対象期間ポップオーバーの「よく使う」表示項目・順序・初期表示 |
| `categoryAnalysisSettings` | カテゴリ別分析の初期分類軸とTop N初期値 |
| `categoryDimensionSettings` | 分類軸ごとの表示名、表示/非表示、よく使う、表示順 |
| `CATEGORY_DIMENSIONS` / `state.data.status.categoryDimensions` | 固定分類軸とCSV検出分類軸のベース定義 |

## 4. 主な利用API

APIは利用しません。localStorage と `state` を利用します。

## 5. 画面レイアウト

しきい値/KPI順序、対象期間ショートカット、カテゴリ別分析、分類軸管理、表示倍率、テーマ設定のパネルで構成されます。

分類軸管理テーブルは、表示順、表示名、分類軸ID、CSV列、種別、表示、よく使う、データ品質、操作を表示します。種別は固定分類軸の場合 `固定`、CSV検出分類軸の場合 `CSV検出: {sourceHeader}` として表示します。

## 6. 表示項目

ライト/ダーク/ネオン、表示倍率、差額率しきい値、金額差しきい値、前月比しきい値、前年比しきい値、KPI順序、対象期間ショートカット（有効/無効、表示順、初期表示、ユーザー定義の削除）、カテゴリ別分析の初期分類軸/Top N、分類軸管理（表示名、表示/非表示、よく使う、表示順、CSV列、分類値数、未設定件数）を表示します。

## 7. 操作仕様

テーマ切替、倍率±/リセット、しきい値変更、対象期間ショートカットのON/OFF・上下移動・現在の対象期間の追加・ユーザー定義削除・初期設定へのリセット、カテゴリ別分析の初期分類軸/Top N保存、分類軸管理の表示名変更・表示/非表示切替・よく使う切替・順序変更・軸別初期化・全体初期化を行います。

分類軸管理では、表示名が空欄の場合は元のラベルに戻します。全分類軸を非表示にはできず、最低1つは有効な分類軸を残します。現在選択中の分類軸を非表示にした場合は、有効な分類軸へフォールバックします。

## 8. フィルター・ソート仕様

フィルター/ソートはありません。分類軸管理テーブルは分類軸の `order` 順に表示します。

## 9. グラフ・テーブル仕様

グラフはありません。分類軸管理はテーブルで表示します。

## 10. ドリルダウン仕様

なし。

## 11. 計算仕様

表示倍率は 75〜150%、5%刻み。テーマは light/dark/neon を body の `data-theme` に反映します。金額単位は画面別に localStorage 保存されます。対象期間ショートカットは組み込みプリセットをIDとして保存し、当月・前月・直近期間・当期通期・前期通期を利用時点の `new Date()` で再計算します。固定年月範囲と固定対象期範囲はユーザー定義として保存します。

分類軸管理のデータ品質は `state.data.items` を分類軸別に集計し、分類値数、未設定件数、最大分類の構成比を算出します。分類値数が30超の場合は「多い」、100超の場合は「非推奨」バッジを表示します。

## 12. エラー・空データ時の表示

localStorage 読み込み失敗時は既定値にフォールバックします。不正な分類軸設定値は無視し、現在CSVに存在しない検出分類軸の設定が残っていても表示対象にしません。

## 13. 関連ソース

| ソース | 関数 |
|---|---|
| `public/static/app.js` | `renderSettings`, `periodQuickSettingsHtml`, `bindPeriodQuickSettings`, `categoryAnalysisSettingsHtml`, `bindCategoryAnalysisSettings`, `categoryDimensionManagementHtml`, `bindCategoryDimensionManagement`, `loadCategoryDimensionSettings`, `saveCategoryDimensionSettings`, `resetCategoryDimensionSettings`, `applyCategoryDimensionSettings`, `updateCategoryDimensionSetting`, `toggleTheme`, `applyTheme`, `normalizeZoomPercent`, `setDisplayZoom`, `updateZoomControls` |
| `public/static/style.css` | `body[data-theme]`, 表示倍率関連CSS, 分類軸管理CSS |

## 14. 未確認事項

- KPI順序変更の永続化範囲。
- しきい値変更の保存先が localStorage かセッション限定か。
- 分類軸管理をチーム共通設定にする場合の保存先と権限。
