# データ項目辞書

`server.js` と `public/static/app.js` で利用される主要な内部キーを整理します。業務上の正式名称がコードから断定できない場合は、画面ラベルまたはCSV別名から読み取れる名称を記載し、備考に未確認とします。

| 内部キー | 日本語項目名 | 用途 | 主な利用画面 | 生成元 | 算出項目かどうか | 備考 |
|---|---|---|---|---|---|---|
| `management_no` | 管理番号 | 明細・追加CSVの結合キー、ドリルダウンキー | 全体、明細、新規案件 | CSV `管理番号` 等、`normalizeManagementNo` | いいえ | 新規案件マスタ/月次で空の場合 `NO-{行番号}` 補完あり |
| `item_no` | 項番 | 明細行識別、差額理由キー | 明細、差額理由 | CSV `項番` 等 | いいえ | `makeItemKey` の一部 |
| `fiscal_period` | 期 | 会計期フィルター・集計 | 全体、推移、カテゴリ、減価償却 | CSV `期`、または年月から導出 | 一部はい | 年月からの導出は `deriveFiscalPeriodFromYearMonth`。67期=2026/04〜2027/03を基準にする |
| `target_year_month` | 対象年月 | 月次集計、推移、スコープ | 全体、推移、明細、新規案件 | CSV年月列、正規化処理 | いいえ | `YYYYMM` 形式。`67期4月` は `202604`、`67期3月` は `202703` |
| `state.filters.scopeMode` | 対象期間選択方式 | グローバルフィルターの単月/プリセット/カスタム切替 | 全体、推移、カテゴリ、アラート、ベンダー、明細 | フロント状態 | いいえ | `periodMode` には依存しない。対象期間ポップオーバーで更新 |
| `state.filters.targetYearMonthFrom` / `targetYearMonthTo` | 対象月範囲 | カスタム対象月範囲、プリセット、対象期範囲の月換算 | 全体、推移、カテゴリ、アラート、ベンダー、明細 | フロント状態 | 一部はい | `YYYYMM` 形式。対象月範囲から `fiscalPeriodFrom` / `fiscalPeriodTo` を補正する |
| `state.ui.trendAggregationUnit` | 推移表示単位 | 推移分析の月別/四半期別/期別/累計推移切替 | 推移 | フロント状態 | いいえ | 上部共通フィルターではなく推移分析内で操作する |
| `periodQuickFilters` | 対象期間ショートカット | 対象期間ポップオーバー「よく使う」の項目、表示有無、順序 | 全体、推移、カテゴリ、アラート、ベンダー、明細、設定 | localStorage | いいえ | 組み込みプリセットはID保存。固定年月範囲/固定対象期範囲はユーザー定義として保存 |
| `periodQuickDefault` | 対象期間初期表示 | 初期表示ショートカットID | 全体、推移、カテゴリ、アラート、ベンダー、明細、設定 | localStorage | いいえ | 無効・削除済みの場合は当月基準の既定解決へフォールバック |
| `categoryAnalysisSettings` | カテゴリ別分析表示設定 | 初期分類軸IDとTop N初期値 | カテゴリ、設定 | localStorage | いいえ | `selectedCategoryDimension` と `categoryTopN` を保存。旧 `categoryTab` は後方互換変換 |
| `categoryDimensionSettings` | 分類軸管理設定 | 分類軸ごとの表示名、表示/非表示、よく使う、表示順 | カテゴリ、設定 | localStorage | いいえ | 固定分類軸とCSV検出分類軸のベース定義に上書き適用。存在しない検出分類軸の設定は無視 |
| `dimensions` | 分類軸値マップ | カテゴリ別分析の分類値参照 | カテゴリ、明細 | `attachItemDimensions` | はい | 既存フィールド（`budget_category` 等）とCSV自動検出の追加分類値（`custom_*`）を統合。フロントは既存フィールド参照と併用 |
| `custom_dimensions` | 追加分類値マップ | CSV自動検出分類列の一時保持 | カテゴリ、明細 | `parseUnifiedBudgetLayout` | はい | `分類_XXX` / `分類＿XXX` / `dim_XXX` / `dimension_XXX` の値を分類軸IDで保持し、`dimensions` に統合 |
| `project_name` | 案件名 | 明細名、ランキング名 | 全体、明細、新規案件 | CSV `案件名` 等 | いいえ | 未設定補完あり |
| `department_name` | 部署名/部門名 | グローバルフィルター、部署別集計 | 全体、カテゴリ、明細 | CSV `部署名`/`部門名` 等 | いいえ | 正式な部門階層は未確認 |
| `owner_name` | 担当者/案件担当者 | 明細追加列、新規案件担当 | 明細、新規案件 | CSV `担当者`, `案件担当者` | いいえ |  |
| `vendor_name` | 支払先/ベンダー | ベンダー別集計、明細追加列 | ベンダー、明細 | CSV `支払先`, `ベンダー` | いいえ |  |
| `system_name` | システム名 | システム別集計、フィルター | 全体、カテゴリ、明細 | CSV `システム名` | いいえ |  |
| `system_classification` | システム分類 | 分類別集計 | カテゴリ、明細 | CSV `システム分類名` 等 | いいえ | 実装上 `system_classification_name` と表記揺れあり |
| `system_classification_name` | システム分類名 | 分類別表示 | カテゴリ、明細 | CSV `システム分類名` | いいえ | `system_classification` の関連項目 |
| `expense_item_name` | 経費事象名/費目名 | 費目別集計、OACIS表示 | カテゴリ、OACIS、明細 | CSV `経費事象名`, `費目名` | いいえ | OACISでは `expense_event_name` も利用 |
| `expense_event` | 経費事象 | 新規案件月次の費用分類 | 新規案件 | 新規案件CSV `経費事象` | いいえ | `deriveCostGroup` の入力 |
| `expense_event_code` | 経費事象コード | OACISランキング | OACIS | OACIS CSV | いいえ |  |
| `actual_amount` | 実績額 | OACIS実績金額 | OACIS | 残高または借方-貸方 | はい | `parseOasisActualCsv` で算出 |
| `yojitsu_no` | 予実番号 | OACIS予実番号別集計 | OACIS | OACIS CSV `予実番号` | いいえ | 空の場合 `予実番号未設定` |
| `supplier` | サプライヤ | OACISサプライヤ別集計 | OACIS | OACIS CSV | いいえ | 空の場合 `サプライヤ未設定` |
| `totalPlan` | 総予算/計画合計 | KPI、差額計算 | 全体、アラート、明細 | `buildUnifiedData` / フロント集計 | はい | 千円単位表示として扱われる箇所あり |
| `totalForecast` | 見込み合計 | KPI、比較対象 | 全体、明細 | 同上 | はい | `forecast` 月次の合計 |
| `totalActual` | 実績合計 | KPI、比較対象 | 全体、明細 | 同上 | はい | `actual` 月次の合計 |
| `plan` | 計画 | 月次値 | 推移、サーバ集計 | 月次CSV列正規化 | いいえ/集計後はい | `value_type=plan` |
| `forecast` | 見込み | 月次値 | 推移、サーバ集計 | 月次CSV列正規化 | いいえ/集計後はい | `value_type=forecast` |
| `actual` | 実績 | 月次値 | 推移、サーバ集計 | 月次CSV列正規化 | いいえ/集計後はい | `value_type=actual` |
| `budget_amount` | 予算金額 | 新規案件コスト、予算比較 | 新規案件 | 新規案件月次CSV | いいえ | 金額正規化後の数値 |
| `forecast_amount` | 見込金額 | 新規案件コスト、予算比較 | 新規案件 | 新規案件月次CSV | いいえ | 金額正規化後の数値 |
| `variance_amount` | 差額 | 見込-予算 | 新規案件、全体 | `forecast_amount - budget_amount` 等 | はい | 画面により `totalForecast - totalPlan` 相当もある |
| `variance_rate` | 差額率 | 差額÷予算 | 新規案件、カテゴリ | `variance_amount / budget_amount` 等 | はい | 分母0の場合 `null` |
| `progress_status` | 進捗状況 | 進捗率換算、表示 | 新規案件 | 新規案件マスタCSV | いいえ | 文字列パターンで進捗率へ換算 |
| `progress_rate` | 進捗率 | 進捗・コストギャップ | 新規案件 | `parseProgressRate` / `deriveProgressRateFromStatus` | はい | 算出不能時 `null` |
| `cost_burn_rate` | コスト消化率 | 予算消化/コスト消化 | アラート等 | フロント/サーバ集計 | はい | 実装上 `costConsumptionRate` と関連 |
| `costConsumptionRate` | コスト消化率 | 新規案件の見込÷予算×100 | 新規案件 | `buildNewProjectAnalysis` | はい | 予算0の場合 `null` |
| `variance_reason` | 差額理由 | 差額理由表示・集計 | 新規案件、明細 | CSV/`deriveVarianceReason` | 一部はい | `reason_category` と表記揺れあり |
| `variance_reason_category` | 差額理由カテゴリ | 差額理由分類 | 明細、新規案件 | CSV `差額理由カテゴリ` 等 | いいえ | 実装上 `reason_category` も利用 |
| `reason_category` | 理由カテゴリ | 差額理由CSVのカテゴリ | 明細、新規案件 | `parseVarianceReasonCsv` | いいえ | `variance_reason_category` の関連項目 |
| `comment` | コメント | 差額理由・月次コメント | 明細、新規案件 | CSV `コメント`, `差額理由`, `理由` | いいえ | `monthlyCommentHtml` で表示候補 |
| `memo` | メモ | 新規案件の差額理由補足 | 新規案件 | 新規案件CSV | いいえ | `deriveVarianceReason` の入力 |
| `contract_no` | 契約番号 | 契約/ベンダー管理 | ベンダー、明細 | CSV/契約API | いいえ |  |
| `contract_end_date` | 契約終了日 | 契約更新アラート | ベンダー | 契約API/CSV由来推定 | いいえ | 正式列は未確認 |
| `depreciation_category_name` | 償却展開区分名 | 減価償却集計軸 | 減価償却 | 減価償却CSV | いいえ | 有効行条件の一部 |
| `period_type` | 期間種別 | 月次/半期/通期分類 | 減価償却 | 減価償却CSV | いいえ | `month`, `half`, `full` に正規化 |
| `amount` | 金額 | 汎用金額、減価償却金額 | 減価償却、API | CSV金額 | いいえ | OACISでは `actual_amount` を主に利用 |

## 表記揺れメモ

| 概念 | 関連キー |
|---|---|
| システム分類 | `system_classification`, `system_classification_name`, CSV `システム分類名` |
| 差額理由カテゴリ | `variance_reason_category`, `reason_category`, CSV `理由カテゴリ`, `差額理由カテゴリ` |
| コスト消化率 | `cost_burn_rate`, `costConsumptionRate`, `burnRate` |
| OACIS | 画面名は `OACIS実績`、内部キーは `oasis_actual` |

## 未確認事項

- 金額列の正式単位（円、千円など）はファイル種別ごとに確認が必要です。
- CSV列の業務上の正式名称とコード上の別名対応は、業務担当レビューが必要です。

## AI分析用プロンプト生成コンテキスト

`POST /api/ai-prompt` の `jsonContext` は、AI貼り付け用に整形した分析コンテキストです。金額単位は千円です。

| 項目 | 内容 |
|---|---|
| `app` | アプリ名 |
| `page`, `pageLabel` | 生成対象の画面キーと画面名 |
| `generatedAt` | 生成日時（ISO文字列） |
| `filters` | 対象期間、部門、分類軸、対象などの表示条件 |
| `kpi.totalPlan`, `kpi.totalForecast`, `kpi.totalActual` | フィルタ後の計画、見込み、実績合計 |
| `kpi.varianceForecastAmount`, `kpi.varianceActualAmount` | 見込み差額、実績差額 |
| `kpi.varianceForecastPct`, `kpi.varianceActualPct` | 見込み差額率、実績差額率 |
| `monthlyTrend` | 月別の計画・見込み・実績・差額 |
| `rankings.topVarianceItems` | 差額上位明細。既定では上位10件 |
| `rankings.topCategories`, `rankings.topDepartments`, `rankings.topVendors` | 分類、部門、ベンダーの差額上位 |
| `alerts` | 超過、差額理由未入力、予算ゼロ実績あり、未分類などの注意情報 |
| `dataQuality.notes` | マスクや明細件数制限、未入力件数などの注意書き |

機密項目マスクが有効な場合、担当者名・契約番号・ベンダー名・摘要/理由系テキストは分析に必要な粒度へ置換されます。
