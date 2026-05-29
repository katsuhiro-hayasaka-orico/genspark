# データ取込画面

## 1. 画面概要

CSVファイル種別を選択し、メインCSVまたは追加CSVをアップロードする画面です。取込前のクライアント側プレビュー、取込状況表示、サーバ側保存データのクリア導線を持ちます。

## 2. 表示条件

- 初期ページは `state.page = import`。
- `state.hasData` が false の状態でメイン/追加CSV画面へ遷移しようとした場合、追加CSV単独表示条件を除きこの画面へ戻されます。

## 3. 主な利用データ

| データ | 内部キー/関数 | 用途 |
|---|---|---|
| ファイル種別 | `IMPORT_FILE_TYPE_OPTIONS` | セレクトボックス |
| 取込状況 | `state.data.status.additionalData` | 追加CSVの取込状態表示 |
| 選択ファイル | `File` | プレビューとアップロード |

## 4. 主な利用API

| API | 用途 |
|---|---|
| `POST /api/upload` | CSVアップロード |
| `GET /api/status` | 取込後の状態再取得 |
| `POST /api/clear` | 保存データクリア |

## 5. 画面レイアウト

パネル内に「ファイル種別」セレクト、ドロップゾーン、`CSVを取り込む` ボタン、`ブラウザ保存データをクリア` ボタン、プレビュー/エラーパネル、取込状況パネルを配置します。

## 6. 表示項目

| 表示項目 | 内容 |
|---|---|
| ファイル種別 | `budget`, `variance_reason`, `new_project_master`, `new_project_monthly_cost`, `oasis_actual`, `depreciation_simulation` |
| 追加データ説明 | 追加データ未取込時もメインCSVで表示する旨 |
| 読み込み結果サマリー | メインCSV選択時の件数、対象期間、欠損候補、数値混入候補 |
| エラーパネル | クライアント側チェック結果または追加CSVの想定レイアウト説明 |
| 取込状況 | ファイル種別ごとの imported/not_imported |

## 7. 操作仕様

| 操作 | 仕様 |
|---|---|
| ファイル種別変更 | `state.ui.importFileType` を更新し、ファイル選択済みなら再プレビュー |
| ファイル選択/ドロップ | `preview(file)` を実行 |
| CSV取込 | `FormData` に `budget_csv` と `fileType` を詰めて `/api/upload` |
| 大容量ファイル | 5MB以上で progress 表示 |
| クリア | `/api/clear` 実行後にデータ状態を再取得 |
| 取込後遷移 | メインCSV取込後はサマリー等へ移動する実装があるため、詳細はコード照合 |

## 8. フィルター・ソート仕様

この画面固有のグローバルフィルターは表示しません。ファイル種別セレクトのみです。

## 9. グラフ・テーブル仕様

グラフはありません。テーブル相当として取込状況リストを表示します。

## 10. ドリルダウン仕様

なし。取込後に他画面へ遷移する導線があります。

## 11. 計算仕様

クライアント側プレビューでは `csvClientChecks` による表示のみのチェックを行います。正式な正規化・必須チェックはサーバ側 `parseUploadedFile` 配下が担当します。

## 12. エラー・空データ時の表示

- ファイル未選択時はアップロードボタンが disabled。
- `.csv` 以外はサーバ側 multer で拒否。
- 追加CSV未取込は「データ未取込」または「追加データ未取込」として扱います。

## 13. 関連ソース

| ソース | 関数/定数 |
|---|---|
| `public/static/app.js` | `IMPORT_FILE_TYPE_OPTIONS`, `renderImport`, `csvClientChecks`, `refreshAllData` |
| `server.js` | `app.post(/api/upload)`, `handleParsedImport`, `parseUploadedFile`, `applyParsedImport`, `app.post(/api/clear)` |

## 14. 未確認事項

- 取込後の正確な遷移先とメッセージ文言の業務要件。
- クライアント側プレビュー結果を正式エラーとして扱うかどうか。
