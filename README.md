# ローカルExcel可視化ダッシュボード

Cloudflare / 外部API / DB接続を使わず、**ブラウザ内だけ**でExcelファイルを可視化するWebアプリです。

## できること
- `.xlsx` / `.csv` ファイルをローカルからアップロード
- ヘッダー行を使って「カテゴリ列」「値列」を選択
- KPI（有効行数・合計・カテゴリ数）を表示
- カテゴリ別の横棒グラフを表示
- 明細の先頭50行をテーブル表示

> データはサーバー送信されません（ローカルブラウザ内で処理）。

## 起動方法
```bash
npm run dev
```

`http://localhost:3000` を開いて利用します。

## ビルド
```bash
npm run build
npm run preview
```

## 補足
- Excelは先頭シートを対象に読み込みます。
- `.xlsx` の展開はブラウザの `DecompressionStream` を使います（Chromium系推奨）。
