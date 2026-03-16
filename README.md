# 予算管理ダッシュボード (Budget CSV Viewer)

## Project Overview
- **Name**: budget-csv-viewer
- **Version**: 3.0.0
- **Goal**: CSVファイル（budget_master / budget_detail）をアップロードし、計画(plan)・見通し(forecast)・実績(actual) の3軸で予算データを可視化するローカル専用Webアプリ
- **Features**: 完全ビジュアライゼーション専用（データ入力機能なし）

## URLs
- **Application**: https://3000-ia3opus0iq67dxs4c1h6v-cbeee0f9.sandbox.novita.ai
- **Health Check**: /api/health

## 実装済み機能

### 1. CSVアップロード
- budget_master.csv（マスタ情報: システム名、ドメイン、費目、年間合計）
- budget_detail.csv（月別明細: 4月〜3月の12ヶ月分金額）
- ドラッグ＆ドロップ / ファイル選択対応
- サンプルCSVダウンロード機能

### 2. ダッシュボード
- KPIカード: 計画合計 / 見通し合計 / 実績合計 / 分類数（対計画差異率付き）
- 月別推移チャート（計画 vs 見通し vs 実績 折れ線グラフ）
- システム別 計画/見通し/実績 横棒グラフ
- カテゴリ別構成 ドーナツチャート
- 累積推移チャート（計画/見通し/実績 各累計）
- ドメイン別内訳チャート
- 予算超過アラートテーブル

### 3. 分析・比較
- システム別 / カテゴリ別 / ドメイン別 集計テーブル + チャート
- クロス集計（システム × カテゴリ マトリクス）
- システム詳細（個別システムの月別推移・カテゴリ内訳）

### 4. 予算差異分析
- 全費目の差異一覧（見通し差異 / 実績差異 %表示）
- 超過 / 節約 / 予算内 ステータスバッジ
- 実績差異率バーチャート（赤: 超過、緑: 節約）
- 予算超過一覧テーブル（超過額・超過率）

### 5. 明細一覧
- 全費目の月別詳細テーブル
- システム / カテゴリ / キーワード フィルター
- CSV出力機能
- 超過セルのハイライト表示

## CSVフォーマット

### budget_master ヘッダー
```
fiscal_year, system_code, system_name, domain, expense_category, expense_item, budget_type, annual_total, remarks
```

### budget_detail ヘッダー
```
fiscal_year, system_code, expense_category, expense_item, budget_type, month_4, month_5, month_6, month_7, month_8, month_9, month_10, month_11, month_12, month_1, month_2, month_3
```

### budget_type 値
- `plan`: 計画値
- `forecast`: 見通し値
- `actual`: 実績値

## API エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| POST | /api/upload | CSV アップロード（budget_master / budget_detail） |
| GET | /api/status | データ読込状態 |
| GET | /api/dashboard/summary | ダッシュボード要約（KPI・月別・システム別・カテゴリ別・超過アラート） |
| GET | /api/items | 明細一覧（?system=, ?category=, ?domain=, ?search= フィルタ） |
| GET | /api/analysis/by-system | システム別集計 |
| GET | /api/analysis/by-category | カテゴリ別集計 |
| GET | /api/analysis/by-domain | ドメイン別集計 |
| GET | /api/analysis/monthly | 月別時系列（plan/forecast/actual） |
| GET | /api/analysis/variances | 全費目差異分析 |
| GET | /api/analysis/cross-tab | クロス集計（システム×カテゴリ） |
| GET | /api/analysis/system-detail | システム詳細（?system= 必須） |
| POST | /api/clear | データクリア |
| GET | /api/health | ヘルスチェック |

## Tech Stack
- **Backend**: Node.js + Express
- **CSV解析**: 自前パーサー（外部ライブラリ不使用）
- **ファイル受信**: multer（メモリストレージ）
- **Frontend**: Vanilla JS SPA + Tailwind CSS (CDN) + Chart.js + Font Awesome
- **ビルドツール**: なし（node server.js で即時起動）

## セキュリティ
- 完全ローカル動作（外部サービス通信なし）
- ディスク保存なし（メモリ保持のみ）
- サーバー再起動でデータ自動消去
- Cloudflare / Wrangler 依存なし

## 起動方法
```bash
npm install
node server.js
# http://localhost:3000 でアクセス
```

## データモデル
- 金額単位: 千円
- 会計年度: 4月始まり（month_4 = 4月, month_3 = 3月）
- 3種類の予算タイプ: plan（計画）, forecast（見通し）, actual（実績）

## Deployment
- **Platform**: ローカル Node.js サーバー
- **Status**: Active
- **Last Updated**: 2026-03-16
