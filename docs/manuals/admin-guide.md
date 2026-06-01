# 管理者ガイド

## 導入・セットアップ方法

### 必要な環境

| 用途 | 必要なもの | 備考 |
|---|---|---|
| Nodeサーバ起動 | Node.js、npm | バージョン要件は `package.json` では明示されていません。要確認です。 |
| Electron起動 | Node.js、npm、Electron依存関係 | `npm run electron` を使用します。 |
| Windows配布物作成 | Node.js、npm、electron-builder | `npm run dist` を使用します。 |
| ドキュメントサイト生成 | Python、pip | `requirements.txt`（内部で `requirements-docs.txt` を参照）を使用します。 |

### 初回セットアップ

```bash
npm install
```

## ローカル起動方法

### Nodeサーバとして起動

```bash
npm run dev
# または
npm start
```

既定では `http://127.0.0.1:3000` で起動します。

### Electronとして起動

```bash
npm run electron
```

Electron起動時は、ElectronメインプロセスからExpressサーバを起動し、ウィンドウにローカルURLを読み込みます。

## ビルド方法

### Windows配布物

```bash
npm run dist
npm run check:external
```

`electron-builder` により、Windows向けNSISインストーラとポータブル版が `dist/` に出力されます。

### ドキュメントサイト

```bash
pip install -r requirements.txt
python -m mkdocs build --strict
python scripts/build_docs_offline_zip.py
```

## 設定ファイル

| ファイル | 内容 |
|---|---|
| `package.json` | npm scripts、依存関係、Electronビルド設定 |
| `ecosystem.config.cjs` | PM2等でのNodeサーバ起動設定 |
| `electron/main.js` | Electronウィンドウ、ローカルサーバ起動、PDF/HTML出力処理 |
| `electron/preload.js` | `desktop.platform`、`exportPdf`、`exportHtml` の公開 |
| `mkdocs.yml` | 通常のMkDocs Materialサイト設定 |
| `mkdocs.offline.yml` | オフラインZIP配布向けのMkDocs設定 |

## データ保存先・永続化方式

サーバ実装では、取り込み済みデータをJSONとして保存します。

- 既定の保存ファイルは、アプリケーションデータディレクトリ配下の `store.json` です。
- 環境変数 `BUDGET_CSV_VIEWER_STORE_FILE` を指定すると保存ファイルパスを変更できます。
- CSVアップロードは `multer.memoryStorage()` を使って受信し、アップロード一時ファイルをディスクに残さない実装です。
- `POST /api/clear` で保存データを初期化します。

## ポート・ホスト

| 項目 | 既定値 | 変更方法 |
|---|---|---|
| ホスト | `127.0.0.1` | 環境変数 `HOST` |
| ポート | `3000` | 環境変数 `PORT` |

READMEのセキュリティ方針では、Expressは `127.0.0.1` のみにバインドし、外部から到達不可とされています。運用で `HOST` を変更する場合は、組織のセキュリティレビューが必要です。

## 権限・セキュリティ上の注意点

- Electronの `BrowserWindow` は `nodeIntegration=false`、`contextIsolation=true`、`sandbox=true` です。
- preloadで公開する機能は、プラットフォーム情報とPDF/HTML出力APIに限定されています。
- アプリはローカル専用を前提としているため、ネットワーク公開や複数利用者共有は未確認です。
- CSVに機密情報が含まれる場合、保存先のアクセス権限、バックアップ、削除運用を確認してください。
- 生成されるWindows配布物やオフラインZIPを共有する場合は、改ざん防止と配布元確認の手順を定めてください。

## 運用時の確認事項

- `npm test` が成功すること。
- `npm run check:external` で外部CDN参照が混入していないこと。
- `python -m mkdocs build --strict` が成功すること。
- 取込CSVのレイアウトが[CSV取込仕様](../03_data-import.md)と一致していること。
- 保存データをクリアする運用、復旧方法、保存期間は未確認です。必要に応じて運用ルールを追加してください。
