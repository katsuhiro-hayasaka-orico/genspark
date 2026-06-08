# API仕様

## 1. 共通事項

| 項目 | 仕様 |
|---|---|
| ベース | 同一オリジン。フロントエンドの `api(path)` は `/api${path}` にリクエスト |
| レスポンス | 主にJSON |
| エラー | `api()` は `res.ok` でない場合 `Error('API error')` を投げる。サーバ側はAPIにより `400` / `500` を返す |
| 永続化 | `server.js` の `store` とローカル `store.json` |

## 2. API一覧

| API名 | HTTPメソッド | 用途 | 主な利用画面 | リクエストパラメータ | レスポンス概要 | 主なレスポンス項目 | エラー時の扱い | 関連する処理関数 | 備考 |
|---|---|---|---|---|---|---|---|---|---|
| CSVアップロード | POST `/api/upload` | CSVを取込・永続化 | データ取込 | multipart `budget_csv`, form `fileType` | 取込結果 | `ok`, `fileType`, `fileName`, `uploadedAt`, `status`, `message`, `summary`, `issues`, `categoryDimensions` | CSV未選択/形式不正/未対応fileTypeでエラー | `handleParsedImport`, `parseUploadedFile`, `applyParsedImport` | multer memoryStorage、50MB制限 |
| ステータス | GET `/api/status` | 取込状態を返す | 全画面共通 | なし | 取込済み有無と追加CSV状態 | `hasData`, `uploadedAt`, `csvFileName`, `masterCount`, `detailCount`, `categoryDimensions`, `additionalData` | 原則なし | `summarizeAdditionalData` | フロントの `state.hasData` 判定に使用 |
| ダッシュボード要約 | GET `/api/dashboard/summary` | KPI・月別・分類別要約 | 主に旧/互換、全体サマリー参考 | なし | 集計済みサマリー | `totalPlan`, `totalForecast`, `totalActual`, `burnRate`, `monthly`, `bySystem`, `byClassification`, `alerts` | 原則なし | `buildUnifiedData`, `getAggregations` | 現行画面は `items` から再集計も行う |
| 明細一覧 | GET `/api/items` | 画面表示用明細一覧 | サマリー、推移、カテゴリ、アラート、ベンダー、明細 | `system`, `category`, `classification`, `department`, `vendor`, `period`, `search` 等 | フィルタ済み明細配列 | `data`, `items` 相当。各itemには将来拡張用の `dimensions` を含む。項目はデータ辞書参照 | 原則なし | `buildUnifiedData` | 実装上の戻り形は `data` 配列 |
| 新規案件一覧 | GET `/api/analysis/new-projects` | 新規案件抽出 | 新規案件関連 | なし | 新規案件と思われる明細 | `data` | 原則なし | `isNewProject` 相当の抽出 | 旧/補助API |
| 新規案件コスト分析 | GET `/api/analysis/new-project-costs` | 新規案件コストKPI・ランキング・ギャップ分析 | 新規案件コスト | なし | 分析一式 | `summary`, `projectRanking`, `progressCostMatrix`, `byProjectCategory`, `byItInvestmentNo`, `byCostGroup`, `byVarianceReason`, `monthlyTrend`, `detailRows`, `debug` | 原則なし | `buildNewProjectAnalysis`, ルート内集計 | 重要API |
| OACIS実績分析 | GET `/api/analysis/oacis-actual` | OACIS実績のランキング/KPI | OACIS実績 | なし | 分析一式 | `summary`, `byExpenseEvent`, `bySupplier`, `byYojitsuNo`, `missingYojitsuNoRows` | 原則なし | `parseOasisActualCsv` 後の集計 | `oasis_actual` の追加CSVから生成 |
| システム別分析 | GET `/api/analysis/by-system` | システム別集計 | カテゴリ/旧分析 | なし | 集計配列 | `key/name`, `totalPlan`, `totalForecast`, `totalActual`, `variance` 等 | 原則なし | `getAggregations` | 詳細型は未確認 |
| システム分類別分析 | GET `/api/analysis/by-classification` | システム分類別集計 | カテゴリ | なし | 集計配列 | 同上 | 原則なし | `getAggregations` | READMEの `by-category` とは異なる |
| 部署別分析 | GET `/api/analysis/by-department` | 部署別集計 | カテゴリ/明細 | なし | 集計配列 | 同上 | 原則なし | `getAggregations` |  |
| ベンダー別分析 | GET `/api/analysis/by-vendor` | ベンダー別集計 | ベンダー | なし | 集計配列 | 同上 | 原則なし | `getAggregations` |  |
| 期別分析 | GET `/api/analysis/by-period` | 会計期別集計 | 推移/カテゴリ | なし | 集計配列 | 同上 | 原則なし | `getAggregations` |  |
| 費目別分析 | GET `/api/analysis/by-expense-item` | 経費事象/費目別集計 | カテゴリ/明細 | なし | 集計配列 | 同上 | 原則なし | `getAggregations` |  |
| 固定変動別分析 | GET `/api/analysis/by-fixed-variable` | 固定費/変動費別集計 | カテゴリ | なし | 集計配列 | 同上 | 原則なし | `getAggregations` |  |
| 月別分析 | GET `/api/analysis/monthly` | 月別 plan/forecast/actual | 推移 | なし | 月別配列 | `target_year_month`, `plan`, `forecast`, `actual` 等 | 原則なし | `getAggregations` |  |
| 前年比分析 | GET `/api/analysis/yoy` | YoY分析 | 推移/カテゴリ | `groupBy` | YoY集計 | 代表項目未確認 | 原則なし | ルート内集計 | `groupBy` 既定は `system` |
| 差異分析 | GET `/api/analysis/variances` | 差額分析 | サマリー/カテゴリ | なし | 差額配列 | `variance`, `varianceRate` 等 | 原則なし | `getAggregations` |  |
| クロス集計 | GET `/api/analysis/cross-tab` | システム×分類等のクロス集計 | カテゴリ | なし | クロス集計 | 代表項目未確認 | 原則なし | ルート内集計 |  |
| システム詳細 | GET `/api/analysis/system-detail` | システム条件の詳細 | 明細ドリルダウン | `system` 必須 | 詳細 | `items`, 集計情報 | `system` 不足時は400の可能性 | ルート内フィルタ |  |
| 分類詳細 | GET `/api/analysis/classification-detail` | 分類条件の詳細 | 明細ドリルダウン | `classification` 等 | 詳細 | `items`, 集計情報 | 条件不足時は400の可能性 | ルート内フィルタ |  |
| 追加データ取得 | GET `/api/additional-data/:fileType` | 追加CSVの行取得 | 減価償却等 | path `fileType` | 追加データ | `fileType`, `status`, `message`, `data`, `rowCount` | 未対応fileTypeは400 | `normalizeAdditionalDataStore` |  |
| 生CSV行取得 | GET `/api/raw-rows` | 元CSV行の確認 | 明細 | 検索等は未確認 | rawRows | `data` | 原則なし | `store.rawRows` |  |
| ベンダー詳細 | GET `/api/analysis/vendor-detail` | ベンダー条件の詳細 | ベンダー/明細 | `vendor` 等 | 詳細 | 未確認 | 条件不足時は400の可能性 | ルート内フィルタ |  |
| 差額理由取得 | GET `/api/variance-reasons` | 差額理由取得 | 明細/新規案件 | クエリ未確認 | 差額理由 | `data` | 原則なし | `buildVarianceReasonMap` |  |
| 差額理由保存 | POST `/api/variance-reasons` | 差額理由登録/更新 | 明細/新規案件 | JSON body | 保存結果 | `ok`, `record` 等 | 入力不正で400の可能性 | `normalizeVarianceReasonRecord` |  |
| 差額理由サマリー | GET `/api/variance-reasons/summary` | 差額理由カテゴリ集計 | 新規案件 | なし | サマリー | 未確認 | 原則なし | ルート内集計 |  |
| 施策取得 | GET `/api/initiatives` | 施策データ取得 | 未確認 | なし | 施策一覧 | `data` | 原則なし | store |  |
| 施策保存 | POST `/api/initiatives` | 施策登録/更新 | 未確認 | JSON body | 保存結果 | `ok` | 入力不正で400の可能性 | store |  |
| 施策サマリー | GET `/api/initiatives/summary` | 施策サマリー | 未確認 | なし | サマリー | 未確認 | 原則なし | ルート内集計 |  |
| 契約取得 | GET `/api/contracts` | 契約情報取得 | ベンダー | なし | 契約一覧 | `data` | 原則なし | `buildContractRecord` | `refreshAllData` で取得 |
| 契約保存 | POST `/api/contracts` | 契約登録/更新 | ベンダー | JSON body | 保存結果 | `ok` | 入力不正で400の可能性 | `buildContractRecord` |  |
| 契約更新 | GET `/api/contracts/renewals` | 契約更新アラート | ベンダー | `baseYearMonth` 等 | 更新対象 | `data` | 原則なし | `detectContractAlerts` |  |
| レビュー候補 | GET `/api/contracts/review-candidates` | 契約レビュー候補 | ベンダー | なし | 候補一覧 | `data` | 原則なし | ルート内集計 |  |
| クリア | POST `/api/clear` | 保存データ初期化 | データ取込 | なし | クリア結果 | `ok` | 原則なし | `emptyStore`, `persistStore` | ブラウザ保存データクリアボタンから呼ぶ |
| ヘルスチェック | GET `/api/health` | サーバ状態確認 | 運用/テスト | なし | ヘルス | `status`, `timestamp` | 原則なし | なし |  |

## 3. 未確認事項

- 各分析APIの完全なレスポンス型は、型定義ファイルが存在しないため未確認です。
- フロントエンドで直接利用していないAPIの業務上の利用画面は未確認です。

## AI分析用プロンプト生成API

| 項目 | 仕様 |
|---|---|
| API | `POST /api/ai-prompt` |
| 用途 | 表示中画面・フィルタ条件をもとに、Copilot等へ手動貼り付けするためのMarkdownプロンプトと分析用JSONコンテキストを生成する |
| 外部送信 | 行わない。サーバ内の取込済みデータを集計・整形するのみで、AI APIや外部AIサービスは呼び出さない |
| 主なリクエスト | `page`, `filters`, `options.includeTopN`, `options.maskSensitive`, `options.includeDetailAll`, `options.includeOwnerName`, `options.includeContractNo` |
| 主なレスポンス | `title`, `markdown`, `jsonContext`, `warnings`, `generatedAt` |
| データ未取込 | 400。`AI分析用プロンプトを生成するには、先に予実績管理データを取り込んでください。` |
| フィルタ後0件 | 400。`現在のフィルタ条件では、分析対象データがありません。` |
| 関連処理 | `buildAiPromptResponse`, `buildAiPromptContext`, `buildAiPromptMarkdown`, `filterItemsForAiPrompt` |

`jsonContext` は、生データ全件ではなく分析用コンテキストです。主要KPI、月次推移、差額上位、アラート件数、データ品質注意を含みます。既定では `maskSensitive: true` とし、担当者名、契約番号、ベンダー名、摘要・理由系テキストを必要に応じてマスクします。明細は既定で差額上位10件のみです。
