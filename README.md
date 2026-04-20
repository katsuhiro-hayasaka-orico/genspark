# 予算管理ダッシュボード (Budget CSV Viewer)

## Project Overview
- **Name**: budget-csv-viewer
- **Version**: 3.0.0
- **Goal**: CSVファイル（budget_master / budget_detail）をアップロードし、計画(plan)・見通し(forecast)・実績(actual) の3軸で予算データを可視化するローカル専用アプリ
- **Features**: 完全ビジュアライゼーション専用（データ入力機能なし）

## Tech Stack
- **Backend**: Node.js + Express
- **CSV解析**: 自前パーサー（外部ライブラリ不使用）
- **ファイル受信**: multer（メモリストレージ）
- **Frontend**: Vanilla JS SPA + Tailwind CSS (CDN) + Chart.js + Font Awesome
- **Desktop Shell**: Electron
- **Packaging**: electron-builder（Windows: NSIS installer / portable exe）

## セキュリティ方針（Electron）
- Express は `127.0.0.1` のみにバインド（外部から到達不可）
- Electron `BrowserWindow` は `nodeIntegration=false` / `contextIsolation=true` / `sandbox=true`
- `preload` は最小限の `desktop.platform` のみ公開
- Electron終了時に Express 子プロセスへ `SIGTERM` を送り、タイムアウト時は `SIGKILL` で確実停止

## 開発起動（従来のNodeサーバ）
```bash
npm install
npm run dev
# http://127.0.0.1:3000
```

## Electron起動（ローカル実行）
```bash
npm install
npm run electron
```

## Windows配布物の作り方
```bash
npm install
npm run dist
```

生成物は `dist/` に出力されます。
- インストーラ: `Budget CSV Viewer-<version>-<arch>.exe`（NSIS）
- ポータブル版: `Budget CSV Viewer-<version>-<arch>.exe`（portable）

## 利用者の起動方法（配布後）
1. 配布された `.exe` をダブルクリック
2. アプリ起動時に内部でローカルExpressサーバが自動起動
3. 画面からCSVをアップロードし、集計・可視化を利用
4. ウィンドウを閉じると内部サーバも自動停止（バックグラウンド残留なし）

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
