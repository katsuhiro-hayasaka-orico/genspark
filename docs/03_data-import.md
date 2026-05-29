# CSV取込仕様

## 1. 取込可能なファイル種別一覧

| 内部キー | 画面表示名 | 用途 | 主なパーサー | 保存先 | 備考 |
|---|---|---|---|---|---|
| `budget` | 予実績管理データ | メインCSV。予算・見込み・実績の可視化元 | `parseBudgetCsv` | `store.master`, `store.detail`, `store.rawRows` | `app.js` の選択肢に表示 |
| `variance_reason` | 差額理由 | 差額理由コメント・カテゴリの追加データ | `parseVarianceReasonCsv` | `store.additionalData.variance_reason`, `store.varianceReasons` | `management_no` 等で紐付け |
| `new_project_master` | 新規案件マスタCSV | 新規案件の案件名、担当者、進捗等 | `parseNewProjectMasterCsv` | `store.additionalData.new_project_master` | 月次金額CSVと結合 |
| `new_project_monthly_cost` | 新規案件月次金額CSV | 新規案件の年月別予算・見込 | `parseNewProjectMonthlyCostCsv` | `store.additionalData.new_project_monthly_cost` | マスタCSVと `management_no` で結合 |
| `new_project` | 画面選択肢なし | 旧/互換的な新規案件データ | `parseNewProjectCsv` | `store.additionalData.new_project` | サーバ側には存在。画面の選択肢にはない |
| `new_project_actual_forecast` | 画面選択肢なし | 新規案件予算見込CSV | `parseNewProjectCostCsv` | `store.additionalData.new_project_actual_forecast` | サーバ側には存在。画面の選択肢にはない |
| `oasis_actual` | OACIS実績 | OACIS実績金額、サプライヤ、予実番号の分析 | `parseOasisActualCsv` | `store.additionalData.oasis_actual` | 表示名はOACISだが内部キーは `oasis_actual` |
| `depreciation_simulation` | 減価償却シミュレーション | 償却シミュレーションの期間別集計 | `parseDepreciationSimulationCsv` | `store.additionalData.depreciation_simulation` | ロング形式を想定 |

## 2. CSV解析の基本仕様

| 項目 | 仕様 |
|---|---|
| 受信方式 | `POST /api/upload` で `budget_csv` フィールドとして受信。multer の memoryStorage を使用 |
| ファイルサイズ | multer 設定上 50MB 上限 |
| 拡張子 | `.csv` のみ許可。その他は multer の fileFilter でエラー |
| 文字列前処理 | BOM除去、CRLF/CRをLFに正規化 |
| ヘッダー行 | `looksLikeHeaderRecord` により管理番号・年月・既知列を手がかりに検出 |
| 重複ヘッダー | 同名ヘッダーは `_1`, `_2` のように連番付与 |
| 空行 | すべて空の行は除外 |

## 3. 区切り文字判定

| 判定対象 | 仕様 |
|---|---|
| サンプル | 先頭最大8行を対象にカンマ数とタブ数を比較 |
| 優先 | タブ数がカンマ数を上回る場合はタブ、それ以外はカンマ |
| クォート | 区切り文字のカウントとCSV解析はダブルクォート内を除外 |

## 4. 文字列正規化

`safeString` により以下を正規化します。

| 処理 | 内容 |
|---|---|
| null/undefined | 空文字 |
| 不可視文字 | ゼロ幅文字、BOM相当を除去 |
| NBSP | 半角スペースに置換 |
| 全角英数字記号 | 半角へ変換 |
| 全角スペース | 半角スペースへ変換 |
| 前後空白 | trim |

## 5. 金額正規化

| 入力例/パターン | 扱い |
|---|---|
| `￥`, `¥`, `円` | 除去 |
| カンマ、全角カンマ、空白 | 除去 |
| 全角マイナス類 | `-` に統一 |
| `(123)` | `-123` として扱う |
| `△123`, `▲123` | 負数として扱う |
| 空、`-`, `△`, `▲` | 0かつ valid |
| 数値化不能 | 0かつ invalid |

## 6. 年月正規化

| 入力 | 出力 | 備考 |
|---|---|---|
| `YYYYMM` | `YYYYMM` | 年は1900〜2200、月は1〜12 |
| `YYYY/MM`、`YYYY-MM`、`YYYY.MM`、`YYYY年M月` | `YYYYMM` | 日付部分がある場合も年月として扱う |
| 空 | 空、status=`blank` | warningなし |
| 不正 | 空、status=`invalid` | warning=`年月はYYYYMMまたはYYYY/MM形式で入力してください` |

## 7. 必須列チェック

| ファイル種別 | 実装から確認できる必須/準必須 | 不足時の扱い |
|---|---|---|
| `budget` | `管理番号`、月次金額列。その他はヘッダー別名で正規化 | 管理番号空欄は error、月次金額なしは warning。詳細は `parseUnifiedBudgetLayout` |
| `variance_reason` | 厳密な必須チェックは未確認 | 取得できない項目は空文字 |
| `new_project_master` | 管理番号は空なら `NO-{行番号}` を補完 | 案件名未設定時は `(案件名未設定:{management_no})` |
| `new_project_monthly_cost` | 管理番号は空なら `NO-{行番号}` を補完 | 年月不正は空、status保持 |
| `oasis_actual` | 厳密な必須チェックは未確認 | 実質空行は除外 |
| `depreciation_simulation` | `period_type`, `fiscal_period`, `depreciation_category_name` を持つ行のみ採用 | 有効行がない場合は not_imported |

## 8. warning / error / skipped の考え方

| 区分 | 主な発生条件 | 取込結果への影響 |
|---|---|---|
| `error` | `budget` で管理番号が空など | 該当行は `skippedRows` に計上され得る |
| `warning` | `budget` で取込可能な月次金額がない、年月不正、金額不正など | 行または項目は可能な範囲で取り込む |
| `skipped` | `budget` で処理不能な行 | `skippedRows` に計上 |

## 9. 追加CSV未取込時の扱い

追加CSVは `createAdditionalDataStore` により `status: not_imported`、`message: 追加データ未取込`、`rows: []` として初期化されます。フロントエンドの取込画面では「追加データが未取込でも、予実績管理データをもとに各ページを表示」と説明されています。

## 10. 新規案件マスタCSVと新規案件月次金額CSVの関係

| 項目 | 仕様 |
|---|---|
| 結合キー | `management_no` |
| マスタ側 | 案件名、担当者、本番開始予定日、IT投資シミュレーションNo、進捗状況、進捗率、案件区分 |
| 月次金額側 | 経費事象、対象年月、予算金額、見込金額、差額、差額率、投資/運用区分、予算有無、5年経費合計、memo |
| 優先関係 | `buildNewProjectAnalysis` では2ファイル構成を優先して分析データを構築する実装が確認できます |
| 片方不足 | 分析可能な行が不足するため、詳細な業務エラー文言は未確認。画面/APIでは空データまたはnot_imported相当として扱われます |

## 11. OACIS実績、減価償却シミュレーションの扱い

| ファイル | 主な正規化項目 | 集計単位 |
|---|---|---|
| OACIS実績 | 経費事象コード/名、会計日、実績部店、借方/貸方/残高、実績額、サプライヤ、予実番号 | 経費事象、サプライヤ、予実番号、予実番号未設定明細 |
| 減価償却シミュレーション | 区分、償却展開区分、償却展開区分名、期間種別、期、月、金額 | 期、月、半期、通期、償却展開区分名 |

## 12. 未確認事項

- 各CSV列の業務上の正式定義。
- OACIS実績の元システム仕様。
- 金額が円単位か千円単位かはCSVごとに実装上の表示変換から推定できる箇所がありますが、正式定義は未確認です。
