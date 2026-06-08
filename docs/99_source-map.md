# 仕様書とソースコード対応表

| 仕様書 | 対応ソース | 主な関数 | 主なAPI | 備考 |
|---|---|---|---|---|
| `docs/README.md` | なし | なし | なし | Docs as Code入口 |
| `docs/01_overview.md` | `public/index.html`, `public/static/app.js`, `public/static/style.css`, `server.js` | `renderPage`, `refreshAllData`, `parseUploadedFile` | `/api/status`, `/api/items`, `/api/analysis/*` | 全体像 |
| `docs/02_screen-list.md` | `public/static/app.js` | `NAV_SECTIONS`, `UTILITY_NAV_PAGES`, `renderPage` | 画面ごと | 画面キー対応 |
| `docs/03_data-import.md` | `server.js`, `public/static/app.js` | `parseCSV`, `parseUploadedFile`, `normalizeAmount`, `normalizeYearMonthString`, `renderImport` | `/api/upload`, `/api/status`, `/api/additional-data/:fileType` | CSV仕様 |
| `docs/04_api-spec.md` | `server.js` | Express `app.get/post` ルート | 全API | API仕様 |
| `docs/05_data-dictionary.md` | `server.js`, `public/static/app.js` | `buildUnifiedData`, `buildNewProjectAnalysis`, `parse*Csv`, `render*` | `/api/items`, `/api/analysis/*` | 内部キー辞書 |
| `docs/06_calculation-logic.md` | `server.js`, `public/static/app.js` | `normalizeAmount`, `deriveFiscalPeriodFromYearMonth`, `calculateVariance`, `calculateBurnRate`, `buildNewProjectAnalysis` | `/api/analysis/new-project-costs`, `/api/dashboard/summary` | 計算仕様 |
| `docs/07_screen-specs/01_import.md` | `public/static/app.js`, `server.js` | `renderImport`, `csvClientChecks`, `detectPreviewCategoryDimensions`, `handleParsedImport`, `detectCategoryDimensionColumns` | `/api/upload`, `/api/status`, `/api/clear` | データ取込 |
| `docs/07_screen-specs/02_summary.md` | `public/static/app.js`, `server.js` | `renderSummary`, `recomputeSummary`, `buildUnifiedData` | `/api/items`, `/api/dashboard/summary` | 全体サマリー |
| `docs/07_screen-specs/03_trend.md` | `public/static/app.js`, `server.js` | `renderTrend`, `buildTimeSeries` | `/api/items`, `/api/analysis/monthly`, `/api/analysis/yoy` | 推移分析 |
| `docs/07_screen-specs/04_category.md` | `public/static/app.js`, `server.js` | `renderCategory`, `CATEGORY_DIMENSIONS`, `getAllCategoryDimensions`, `aggregateByDimension`, `getCategoryDimensionValue`, `detectCategoryDimensionColumns`, `attachItemDimensions` | `/api/items`, `/api/analysis/by-*` | カテゴリ別分析 |
| `docs/07_screen-specs/05_alert.md` | `public/static/app.js`, `server.js` | `renderAlert`, `calculateVariance`, `calculateBurnRate` | `/api/items` | アラート |
| `docs/07_screen-specs/06_vendor.md` | `public/static/app.js`, `server.js` | `renderVendor`, `detectContractAlerts`, `buildContractRecord` | `/api/contracts`, `/api/contracts/renewals`, `/api/analysis/vendor-detail` | ベンダー/契約 |
| `docs/07_screen-specs/07_detail.md` | `public/static/app.js`, `server.js` | `renderDetail`, `setDetailFilter`, `itemMatchesDetailFilter` | `/api/items`, `/api/raw-rows` | 明細ドリルダウン |
| `docs/07_screen-specs/08_new-project-cost.md` | `public/static/app.js`, `server.js` | `renderProject`, `buildNewProjectAnalysis`, `deriveProgressRateFromStatus` | `/api/analysis/new-project-costs` | 新規案件コスト分析 |
| `docs/07_screen-specs/09_depreciation.md` | `public/static/app.js`, `server.js` | `renderDepreciation`, `parseDepreciationSimulationCsv` | `/api/additional-data/depreciation_simulation` | 減価償却 |
| `docs/07_screen-specs/10_oacis.md` | `public/static/app.js`, `server.js` | `renderOacisActual`, `parseOasisActualCsv` | `/api/analysis/oacis-actual` | OACIS実績 |
| `docs/07_screen-specs/11_settings.md` | `public/static/app.js`, `public/static/style.css` | `renderSettings`, `categoryAnalysisSettingsHtml`, `bindCategoryAnalysisSettings`, `categoryDimensionManagementHtml`, `bindCategoryDimensionManagement`, `toggleTheme`, `setDisplayZoom` | なし | 表示設定 |
| `docs/07_screen-specs/12_manual.md` | `public/static/app.js` | `renderManual` | なし | 使い方 |
| `docs/08_ui-ux.md` | `public/index.html`, `public/static/style.css`, `public/static/app.js` | `applyTheme`, `setDisplayZoom`, `baseChartOptions` | なし | 共通UI/UX |
| `docs/09_error-handling.md` | `server.js`, `public/static/app.js` | `api`, `renderPage`, `normalizeAmount`, `normalizeYearMonthString` | `/api/upload`, `/api/*` | エラー仕様 |
| `adr/0001-use-docs-as-code.md` | なし | なし | なし | Docs as Code採用判断 |
| `adr/0002-separate-screen-spec-api-data-and-calculation-logic.md` | なし | なし | なし | 仕様書分割判断 |
| `adr/0003-manage-screen-specs-by-render-function.md` | `public/static/app.js` | `render*` | 画面ごと | 画面仕様管理単位 |

## 共通出力機能の対応

| 仕様/機能 | 対応ソース | 主な関数/API | 備考 |
|---|---|---|---|
| 画面DOM基準のPDF/HTML出力 | `public/static/app.js`, `public/static/style.css` | `ensureExportableView`, `renderExportControls`, `exportCurrentView`, `waitForChartsReady`, `buildStandaloneHtml`, `bindExportReportHeaderState` | `#export-root` の現在DOMを出力対象にし、レポートヘッダー開閉状態を画面単位で保存する。 |
| Electron保存処理 | `electron/main.js`, `electron/preload.js` | IPC `export:pdf`, `export:html`; `webContents.printToPDF()` | rendererにはpreload経由で必要最小限のAPIのみ公開。 |
| 出力エラー表示 | `public/static/app.js`, `docs/09_error-handling.md` | `setExportStatus`, `exportErrorMessage` | ユーザー向けの短いメッセージを画面内に表示。 |

## AI分析用プロンプト生成

| 仕様 | ソース |
|---|---|
| `POST /api/ai-prompt`、分析コンテキスト生成、Markdown生成、担当者名の任意出力 | `server.js` の `buildAiPromptResponse` / `buildAiPromptContext` / `buildAiPromptMarkdown` / `/api/ai-prompt` |
| 画面上部の「AI分析用プロンプト」ボタン（表示対象は `AI_PROMPT_VISIBLE_PAGES`）、右ドロワー、コピー、Copilot起動、Markdown/JSON保存 | `public/static/app.js` の `AI_PROMPT_VISIBLE_PAGES` / `updateAiPromptTopbarButton` / `openAiPromptDrawer` / `generateAiPrompt` / `copyAiPrompt` / `saveAiPromptMarkdown` / `saveAiPromptJson` |
| AIプロンプトドロワーとレスポンシブ/テーマ対応スタイル | `public/static/style.css` の `.ai-prompt-*` |
