# 予算管理ダッシュボード (Budget CSV Viewer)

## Project Overview
- **Name**: budget-csv-viewer
- **Version**: 3.0.0
- **Goal**: 統合レイアウトCSVファイル（1ファイル）をアップロードし、計画(plan)・見通し(forecast)・実績(actual) の3軸で予算データを可視化するローカル専用アプリ
- **Features**: 完全ビジュアライゼーション専用（データ入力機能なし）

## Tech Stack
- **Backend**: Node.js + Express
- **CSV解析**: 自前パーサー（外部ライブラリ不使用）
- **ファイル受信**: multer（メモリストレージ）
- **Frontend**: Vanilla JS SPA + ローカル同梱CSS（Tailwind相当ユーティリティ） + ローカル同梱アイコン + Chart.js
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
npm run check:external
```

生成物は `dist/` に出力されます。
- インストーラ: `Budget CSV Viewer-<version>-<arch>.exe`（NSIS）
- ポータブル版: `Budget CSV Viewer-<version>-<arch>.exe`（portable）

## オフライン動作保証（外部依存なし）
- `public/index.html` は外部CDN参照を行わず、ローカル配信ファイルのみを参照します。
- `npm run check:external` は `public/` と `electron/` 配下の `http://` / `https://` を機械検査し、外部参照混入を防ぎます（`localhost/127.0.0.1` は除外）。

## 同梱物一覧（vendor/assets 相当）
- `public/static/vendor/chart.umd.min.js` : Chart.js (ローカル同梱)
- `public/static/vendor/offline-ui.css` : Tailwind相当ユーティリティ + アイコン代替スタイル（ローカル同梱）

## 利用者の起動方法（配布後）
1. 配布された `.exe` をダブルクリック
2. アプリ起動時に内部でローカルExpressサーバが自動起動
3. 画面からCSVをアップロードし、集計・可視化を利用
4. ウィンドウを閉じると内部サーバも自動停止（バックグラウンド残留なし）

## トラブルシュート（Windows配布版）
- `A JavaScript error occurred in the main process` / `Error: spawn ... ENOENT` が出る場合は、旧ビルドの実行ファイルを使っている可能性があります。  
  本バージョンでは `child_process.fork` を使わず、Electronメインプロセス内でExpressを直接起動する方式に変更済みです。

## API エンドポイント
| Method | Path | 説明 |
|--------|------|------|
| POST | /api/upload | 統合CSVアップロード（budget_csv） |
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
