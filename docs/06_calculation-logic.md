# 計算ロジック仕様

## 1. 正規化ロジック

| ロジック | 関連関数 | 仕様 |
|---|---|---|
| 文字列正規化 | `safeString` | 不可視文字除去、NBSP/全角スペース正規化、全角英数字記号の半角化、trim |
| 金額正規化 | `normalizeAmount` | 通貨記号・カンマ・空白除去、全角マイナス統一、括弧/△/▲負数対応、数値化不能は invalid |
| 年月正規化 | `normalizeDateString`, `normalizeYearMonthString` | `YYYYMM` または `YYYY/MM` 等を `YYYYMM` 化。年1900〜2200、月1〜12 |
| 会計期導出 | `deriveFiscalPeriodFromYearMonth`, `yearMonthForFiscalPeriodMonth`, `fiscalPeriodFromYearMonth`, `fiscalPeriodToMonthRange` | 67期を2026年4月〜2027年3月（FY2026）とする。年月から期を導出する場合は月が1〜3月なら前年、それ以外は当年を会計年度とし、`fiscalYear - 1959` を期とする。期＋月から対象年月を導出する場合は `period + 1959` を年度開始年とし、4〜12月は当年、1〜3月は翌年に配置する。 |
| グローバル対象期間 | `normalizeGlobalScopeFilters`, `ymInSelectedScope`, `inSelectedFiscalPeriodRange`, `scopedItemTotals` | `periodMode` は集計軸として維持し、`scopeMode`/`scopePreset`/`customRangeUnit` で対象期間の選択方式を管理する。単月は1か月、対象月範囲は開始月〜終了月、対象期範囲は開始期4月〜終了期翌3月の月次データだけを合計する。 |

## 2. plan / forecast / actual の扱い

| 項目 | 仕様 |
|---|---|
| 生成元 | 予実績管理CSVの月次金額列を `value_type` により `plan` / `forecast` / `actual` として detail 化 |
| 合計 | `buildUnifiedData` とフロント側 `scopedItemTotals` / `recomputeSummary` で `totalPlan`, `totalForecast`, `totalActual` を算出 |
| 比較対象 | フロント側には `getComparableActual` があり、選択月や実績/見込みの状態に応じた比較値を作る。詳細な業務定義は未確認 |

## 3. 基本KPI・差額計算

| 計算 | 関連関数 | 式/扱い |
|---|---|---|
| 合計計算 | `scopedPeriodSummary`, `recomputeSummary`, `getAggregations` | 対象明細の plan/forecast/actual を合算 |
| 差額 | `calculateVariance`, 新規案件集計 | 基本は `比較対象 - plan` または `forecast_amount - budget_amount` |
| 差額率 | `calculateVariance`, 新規案件集計 | 分母がある場合 `差額 / 分母`。画面表示時に%化される箇所あり |
| 予算消化率 | `calculateBurnRate` | 実績/見込み等の比較対象 ÷ 予算。分母0の扱いは画面により `0` または `null` |
| コスト削減効果 | `recomputeSummary` 等 | 実装からはKPI名として確認。正式な業務式は未確認 |

## 4. 新規案件コスト計算

### 4.1 入力データ

| 入力 | 主な項目 | 備考 |
|---|---|---|
| 新規案件マスタCSV | `management_no`, `project_name`, `owner_name`, `production_start_date`, `it_investment_simulation_no`, `progress_status`, `progress_rate`, `project_category` | `management_no` で月次金額と結合 |
| 新規案件月次金額CSV | `management_no`, `expense_event`, `target_year_month`, `budget_amount`, `forecast_amount`, `variance_amount`, `cost_group`, `memo` | `forecast_amount - budget_amount` を差額にする |

### 4.2 進捗状況から進捗率への換算ルール

`deriveProgressRateFromStatus` で確認できる換算です。別関数 `parseProgressRate` には数値%や「設計」「開発」等の汎用換算もありますが、新規案件2ファイル構成では下表が中心です。

| 進捗状況の文字列パターン | 進捗率 |
|---|---:|
| `01.未着手` または `未着手`、または `取下げ` / `削除` | 0 |
| `今期中に案件組成` または `来期案件組成予定` | 20 |
| `組成予定` | 40 |
| `組成済` | 60 |
| `予算計画通り` | 80 |
| `完了` | 100 |
| 上記以外、空 | `null` |

### 4.3 コスト消化率・ギャップ・判定

| 計算項目 | 式/仕様 | 例外 |
|---|---|---|
| 予算金額合計 | プロジェクト単位で `budget_amount` を合算 | なし |
| 見込金額合計 | プロジェクト単位で `forecast_amount` を合算 | なし |
| 差額 | `見込金額合計 - 予算金額合計` | なし |
| 差額率 | `差額 ÷ 予算金額合計` | 予算0の場合 `null` |
| コスト消化率 | `見込金額合計 ÷ 予算金額合計 × 100` | 予算0の場合 `null` |
| ギャップ | `コスト消化率 − 進捗率` | どちらかが算出不能の場合は判定に注意 |
| 予算金額が0 | 分母0として `costConsumptionRate` は `null`、debugの `zeroDenominator` に計上 | 画面では判定不可相当 |
| 進捗率が算出できない | `progress_rate` は `null`、debugの `progressRateNotCalculated` に計上 | 画面では判定不可相当 |

### 4.4 ギャップ判定区分

| 条件 | `alertLevel` | 仕様上の意味 |
|---|---|---|
| `costConsumptionRate >= 80` かつ `progressRate < 50` | `alert` | コスト先行の強い警戒 |
| `progressRate >= 80` かつ `costConsumptionRate < 50` | `progressAhead` | 進捗先行 |
| `gap >= 40` | `alert` | コスト消化が進捗を大きく上回る |
| `gap >= 20` | `watch` | 要注意 |
| 上記以外 | `normal` | 通常 |

## 5. 差額理由・コスト区分

| ロジック | 関連関数 | 仕様 |
|---|---|---|
| コスト区分 | `deriveCostGroup` | 入力の投資運用区分があれば優先。なければ経費事象名のパターンから `投資系` / `運用系` / `未分類` を導出 |
| 差額理由 | `deriveVarianceReason` | 進捗状況・memo から `見込精緻化`、`コスト削減`、`遅延` 等を導出。詳細パターンはコード参照 |

## 6. アラート判定

| 画面/対象 | 関連実装 | 判定概要 |
|---|---|---|
| アラート画面 | `renderAlert`, `state.settings.thresholds` | 差額率、金額差、前月比、前年比のしきい値を UI 設定から利用 |
| 新規案件コスト | `buildNewProjectAnalysis` / `/api/analysis/new-project-costs` | 進捗率とコスト消化率のギャップから `alertLevel` を算出 |
| 契約更新 | `detectContractAlerts` | 契約終了/更新に関する月数差からアラートを返す実装がある。正式しきい値はコード照合が必要 |

## 7. 契約更新アラート

`server.js` には `detectContractAlerts(contract, baseYearMonth)` と `buildContractRecord` があり、契約関連APIで利用されます。契約日の列名・契約更新運用ルールの正式定義は未確認のため、詳細は [06_vendor.md](./07_screen-specs/06_vendor.md) に未確認事項として残します。

## 8. 未確認事項

- `コスト削減効果` KPI の正式な業務式。
- 予実績管理メインCSVの金額単位の正式定義。
- アラートしきい値の業務上の妥当性。
- 契約更新アラートの正式運用ルール。
