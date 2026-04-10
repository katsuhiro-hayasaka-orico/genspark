# ローカル予算可視化アプリ（Streamlit）

Cloudflare / 外部DB への接続を一切使わず、手元でアップロードした CSV のみを可視化するアプリです。

## 対応ファイル
- `budget_master.csv`
- `budget_detail.csv`

> 2ファイルをアップロードすると、可能な範囲でキー結合してダッシュボード表示します。

## 主な機能
- CSVアップロード（文字コードは UTF-8 / UTF-8-SIG / CP932 を自動判定）
- 合計金額、件数の KPI 表示
- 月別推移（列があれば自動表示）
- カテゴリ構成（列があれば自動表示）
- フィルタ（年度・システム）
- フィルタ後データの CSV ダウンロード

## ローカル実行手順
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
streamlit run streamlit_app.py
```

## セキュリティ方針
- アプリはローカル実行前提です。
- データはアップロードされた CSV のみを使用します。
- 外部 API・Cloudflare・外部 DB への接続処理は含みません。
