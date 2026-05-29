# エラー・例外処理仕様

## 1. CSV取込時

| ケース | 検出箇所 | 現行の扱い | 備考 |
|---|---|---|---|
| CSV未選択 | `renderImport` | アップロードボタン disabled。クリック時も `if (!file) return` | 画面文言は未確認 |
| CSV形式以外 | `multer.fileFilter` | `.csv` 以外は `CSV形式のみ対応しています (.csv)` で拒否 | HTTPエラーとして返る |
| ファイルサイズ超過 | `multer.limits.fileSize` | 50MB超過で multer エラー | 画面文言は未確認 |
| 未対応fileType | `parseUploadedFile` | `未対応のファイル種別です` を throw | 400/500の詳細はコード照合 |
| 必須列不足 | `parseUnifiedBudgetLayout` 等 | ヘッダー検出/列別名で吸収。不足項目は warning/error または空 | CSV種別により差あり |
| 管理番号空欄 | `parseUnifiedBudgetLayout` | `error` issue、行スキップ対象 | 新規案件追加CSVでは `NO-{行番号}` 補完あり |
| 年月列不足 | `parseUnifiedBudgetLayout` | 月次金額が作れない場合 warning |  |
| 金額不正 | `normalizeAmount` | 0、`valid=false` | 予実績CSVでは issue 化され得る |
| 年月不正 | `normalizeYearMonthString` | 空、`status=invalid`、warning文言 |  |

## 2. 追加CSV関連

| ケース | 現行の扱い | 備考 |
|---|---|---|
| 追加CSV未取込 | `status:not_imported`, `message:追加データ未取込`, `rows:[]` | 画面では未取込として表示し、メインCSV画面は継続表示 |
| 新規案件マスタ不足 | 分析データが不足し、空/未設定値が増える | 専用エラー文言は未確認 |
| 新規案件月次金額不足 | 予算/見込/差額が集計できず、空または0件 | 専用エラー文言は未確認 |
| 新規案件2ファイル片方不足 | `buildNewProjectAnalysis` の結合結果に依存 | 業務上の必須扱いは未確認 |
| OACIS実績未取込 | KPI 0、ランキング空 | 追加CSV単独表示条件は status を参照 |
| 減価償却有効行なし | `not_imported` | `period_type`, `fiscal_period`, `depreciation_category_name` が必要 |

## 3. APIエラー

| ケース | フロントの扱い | 備考 |
|---|---|---|
| `res.ok` でない | `api()` が `Error('API error')` を throw | 呼び出し側で catch する場合としない場合がある |
| `/api/contracts` 取得失敗 | `refreshAllData` で `{ data: [] }` にフォールバック | ベンダー画面は契約なしとして表示 |
| `/api/additional-data/depreciation_simulation` 取得失敗 | `{ data: [] }` にフォールバック |  |
| `/api/analysis/oacis-actual` 取得失敗 | 空summary/空配列にフォールバック |  |
| `/api/analysis/new-project-costs` 取得失敗 | `renderProject` で `null` フォールバック |  |

## 4. データ未取込・空データ

| ケース | 扱い |
|---|---|
| メインCSV未取込でメイン画面表示 | `renderPage` が `goPage('import')` |
| 減価償却CSVのみ取込済み | 減価償却画面は表示可能 |
| OACIS実績のみ取込済み | OACIS画面は表示可能 |
| フィルター結果0件 | 空KPI/空テーブル/0値表示 |

## 5. 計算不可

| ケース | 扱い | 関連項目 |
|---|---|---|
| 予算金額0による差額率不可 | `varianceRate=null` | 新規案件 |
| 予算金額0によるコスト消化率不可 | `costConsumptionRate=null`, debug `zeroDenominator` | 新規案件 |
| 進捗率未算出 | `progress_rate=null`, debug `progressRateNotCalculated` | 新規案件 |
| 判定不可 | 明示的な `unknown` 区分はなく、`null` を含む計算結果と `normal` 判定になる可能性あり | 仕様上は要改善候補 |
| 金額不正 | 0扱いかつ `valid=false` | CSV取込 |
| 年月不正 | 空年月、status invalid | CSV取込 |

## 6. 未確認事項

- APIエラー時に画面へ表示する正式文言。
- 新規案件2ファイル片方不足をエラーにするか警告にするか。
- 判定不可を `normal` と区別するUI要件。

## 表示中内容の出力エラー

| 状況 | ユーザー向けメッセージ | 備考 |
|---|---|---|
| 出力対象DOMが見つからない | 出力対象の画面が見つかりません。 | `#export-root` 未生成時。 |
| Electron APIを利用できない | Electron環境ではないためPDF/HTML/PNG出力できません。 | ブラウザ単体起動時。 |
| 保存キャンセル | 保存をキャンセルしました。 | main process の保存ダイアログでキャンセルした場合。 |
| Chart.js描画未完了 | Chart.jsの描画が完了していません。 | canvas サイズが0の場合。 |
| 保存/生成失敗 | PDF/HTML/PNG画像出力に失敗しました。保存先を変更して再度お試しください。 | 権限、パス、生成失敗を含む。 |

出力処理では `finally` で `export-mode` を必ず解除し、失敗時も通常画面表示へ戻します。
