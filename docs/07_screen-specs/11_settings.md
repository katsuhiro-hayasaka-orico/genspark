# 表示設定画面

## 1. 画面概要

テーマ、表示倍率、しきい値、KPI順序、対象期間ショートカットなど、フロントエンド表示設定を変更する画面です。

## 2. 表示条件

常時表示可能です。メインCSV未取込でも利用できます。

## 3. 主な利用データ

| データ | 用途 |
|---|---|
| `state.ui.theme` | テーマ |
| `state.ui.displayZoom` | 表示倍率 |
| `state.settings.thresholds` | アラートしきい値 |
| `state.settings.kpiOrder` | KPI順序 |
| `periodQuickFilters` / `periodQuickDefault` | 対象期間ポップオーバーの「よく使う」表示項目・順序・初期表示 |

## 4. 主な利用API

APIは利用しません。localStorage と `state` を利用します。

## 5. 画面レイアウト

テーマ選択、表示倍率操作、しきい値入力、KPI順序設定、対象期間ショートカット設定のパネルで構成されます。

## 6. 表示項目

- カテゴリ別分析セクションでは、初期表示する分類軸とTop N初期値を選択・保存できます。保存値は `localStorage` の `categoryAnalysisSettings` に保持します。

## 6. 表示項目

ライト/ダーク/ネオン、表示倍率、差額率しきい値、金額差しきい値、前月比しきい値、前年比しきい値、KPI順序、対象期間ショートカット（有効/無効、表示順、初期表示、ユーザー定義の削除）を表示します。

## 7. 操作仕様

テーマ切替、倍率±/リセット、しきい値変更、対象期間ショートカットのON/OFF・上下移動・現在の対象期間の追加・ユーザー定義削除・初期設定へのリセットを行います。トップバーのクイック設定からも一部操作可能です。

## 8. フィルター・ソート仕様

フィルター/ソートはありません。

## 9. グラフ・テーブル仕様

グラフ/テーブルは設定一覧のみです。

## 10. ドリルダウン仕様

なし。

## 11. 計算仕様

表示倍率は 75〜150%、5%刻み。テーマは light/dark/neon を body の `data-theme` に反映します。金額単位は画面別に localStorage 保存されます。対象期間ショートカットは組み込みプリセットをIDとして保存し、当月・前月・直近期間・当期通期・前期通期を利用時点の `new Date()` で再計算します。固定年月範囲と固定対象期範囲はユーザー定義として保存します。

## 12. エラー・空データ時の表示

localStorage 読み込み失敗時は既定値にフォールバックします。

## 13. 関連ソース

| ソース | 関数 |
|---|---|
| `public/static/app.js` | `renderSettings`, `periodQuickSettingsHtml`, `bindPeriodQuickSettings`, `categoryAnalysisSettingsHtml`, `bindCategoryAnalysisSettings`, `loadCategoryAnalysisSettings`, `persistCategoryAnalysisSettings`, `toggleTheme`, `applyTheme`, `normalizeZoomPercent`, `setDisplayZoom`, `updateZoomControls` |
| `public/static/style.css` | `body[data-theme]`, 表示倍率関連CSS |

## 14. 未確認事項

- KPI順序変更の永続化範囲。
- しきい値変更の保存先が localStorage かセッション限定か。
