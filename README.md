# ローカル予算可視化アプリ（Streamlit / EXE対応）

Cloudflare / 外部DB への接続を一切使わず、手元でアップロードした CSV のみを可視化するアプリです。

## 対応ファイル
- `budget_master.csv`
- `budget_detail.csv`

> 2ファイルをアップロードすると、可能な範囲でキー結合してダッシュボード表示します。

## 主な機能（移植元ダッシュボード構成を再現）
- CSVアップロード（文字コードは UTF-8 / UTF-8-SIG / CP932 を自動判定）
- ダッシュボード（KPIカード、月別推移、累積推移、カテゴリ/ドメイン構成、超過アラート、システム別サマリ）
- 予算データ入力（システム×費目×月のマトリクス表示）
- 予実差異分析（システム/カテゴリ/費目/ドメイン別、四半期/半期集計）
- 中期比較（年度横断の推移比較）
- レポート（ドメイン別・システム別・カテゴリ別・CSVエクスポート）
- マスタ管理（マスタ参照と件数表示）
- 差異コメント（ローカルセッションで追加/表示）

## ローカル実行手順（Python）
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
streamlit run streamlit_app.py
```


## サンプルCSV
リポジトリ直下に、アップロード検証用のサンプルを同梱しています。
- `budget_master.csv`
- `budget_detail.csv`

そのままアプリへアップロードして動作確認できます。

## EXE化（Windows）
### 1) ビルド
```bat
build_exe.bat
```

### 2) 実行
- 生成物: `dist\\BudgetDashboardLocal.exe`
- EXE起動後、ローカルの Streamlit サーバー（`127.0.0.1`）でダッシュボードが立ち上がります。

### 3) 手動ビルドしたい場合
```bat
pyinstaller --onefile --name BudgetDashboardLocal --collect-all streamlit --collect-all plotly --collect-submodules pandas --add-data "streamlit_app.py;." launcher.py
```

## セキュリティ方針
- アプリはローカル実行前提です。
- データはアップロードされた CSV のみを使用します。
- 外部 API・Cloudflare・外部 DB への接続処理は含みません。
