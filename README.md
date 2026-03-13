# Excel Budget Viewer

## プロジェクト概要
- **名称**: Excel Budget Viewer
- **目的**: アップロードしたExcelファイルの予算データをブラウザ上でダッシュボード可視化する
- **特徴**: Cloudflare等の外部サービスへの依存なし。完全ローカル動作でセキュア

## 主な機能

### 実装済み機能
1. **Excelアップロード** - .xlsx/.xls/.xlsm/.xlsb/.csv対応、ドラッグ&ドロップ、最大100MB
2. **自動解析** - 月別ヘッダー（4月〜3月/Jan〜Dec）自動検出、複数シート対応、構造化/汎用テーブル自動判別
3. **ダッシュボード** - KPIカード（年間合計・データ件数・分類数・月平均）、月別推移棒グラフ、カテゴリ別ドーナツチャート、システム別横棒グラフ、累積推移ラインチャート、シート別解析テーブル
4. **シートデータ閲覧** - シートタブ切り替え、セル値の色分け表示、CSV出力
5. **分析・比較** - システム別/カテゴリ別/シート別集計、クロス集計（システム×カテゴリ）、金額ランキングTop30
6. **明細一覧** - シート・キーワードフィルタリング、月別展開テーブル、CSV出力

### 技術的特徴
- **外部通信なし**: CDN読み込み以外のネットワーク通信は一切なし（APIはすべてlocalhost）
- **ディスク保存なし**: Excelデータはサーバーメモリにのみ保持。ファイルはディスクに残さない
- **セッション限り**: サーバー再起動でデータは自動消去

## URL
- **アプリケーション**: https://3000-ia3opus0iq67dxs4c1h6v-cbeee0f9.sandbox.novita.ai

## API エンドポイント一覧

| パス | メソッド | 説明 |
|------|----------|------|
| `/api/upload` | POST | Excelファイルアップロード（multipart/form-data, field: `file`） |
| `/api/status` | GET | 現在のデータ状態 |
| `/api/dashboard/summary` | GET | KPIサマリ・月別/カテゴリ/システム集計 |
| `/api/sheets` | GET | シート一覧 |
| `/api/sheets/:name` | GET | シート生データ（最大500行） |
| `/api/items` | GET | 解析済み明細（?sheet=&category=&system=&search=） |
| `/api/analysis/by-system` | GET | システム別集計 |
| `/api/analysis/by-category` | GET | カテゴリ別集計 |
| `/api/analysis/by-month` | GET | 月別集計 |
| `/api/analysis/by-sheet` | GET | シート別集計 |
| `/api/analysis/cross-tab` | GET | クロス集計（システム×カテゴリ） |
| `/api/analysis/top-items` | GET | 金額ランキング（?limit=） |
| `/api/clear` | POST | データクリア |
| `/api/health` | GET | ヘルスチェック |

## 技術スタック
- **バックエンド**: Node.js + Express 4.x
- **Excel解析**: SheetJS (xlsx)
- **ファイル処理**: multer（メモリストレージ）
- **フロントエンド**: Vanilla JS SPA + Tailwind CSS (CDN) + Chart.js (CDN) + Font Awesome (CDN)
- **ビルド不要**: `node server.js` で即起動

## プロジェクト構造
```
webapp/
├── server.js              # Express サーバー + Excel解析ロジック
├── public/
│   ├── index.html         # SPA HTML
│   └── static/
│       └── app.js         # クライアントサイドJavaScript
├── ecosystem.config.cjs   # PM2設定
├── package.json           # 依存: express, multer, xlsx のみ
└── .gitignore
```

## 利用方法
```bash
# 依存関係インストール
npm install

# サーバー起動
npm start
# または
node server.js

# PM2で起動
pm2 start ecosystem.config.cjs

# ブラウザでアクセス
open http://localhost:3000
```

## セキュリティ
- 外部APIへの通信なし（CDN以外）
- アップロードファイルはメモリ処理のみ（ディスク保存なし）
- サーバー再起動でデータ消去
- ローカルネットワーク内のみでの利用を想定

## デプロイ状況
- **プラットフォーム**: ローカルNode.js（Cloudflare依存なし）
- **ステータス**: ✅ 稼働中
- **最終更新**: 2026-03-13
