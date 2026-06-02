# ドキュメントサイト運用ガイド

このリポジトリでは、内部向けドキュメントサイトと、一般利用者向けユーザーマニュアルサイトを分けてビルドします。

| 区分 | 設定 | 内容 |
|---|---|---|
| 内部向けドキュメント | `mkdocs.yml` / `mkdocs.offline.yml` | 仕様書、ADR、ユーザーマニュアルを含むリポジトリ内レビュー向けサイト |
| 一般利用者向けマニュアル | `mkdocs.user.yml` / `mkdocs.user.offline.yml` | 一般利用者向け手順だけを含む公開・配布用サイト |

## 内部向けドキュメントサイトのプレビュー方法

```bash
python -m venv .venv
. .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m mkdocs serve
```

ブラウザで `http://127.0.0.1:8000` を開きます。

## 内部向け通常ビルド方法

```bash
python -m mkdocs build --strict
```

生成物は `site/` に出力されます。`site/` は通常ブランチにコミットしません。

## 内部向けオフラインZIP生成方法

```bash
python scripts/build_docs_offline_zip.py
```

`mkdocs.offline.yml` を使って `site/` を生成し、ZIP直下に `index.html` が来る形で `dist/budget-csv-viewer-docs-offline.zip` を作成します。

## 一般利用者向けマニュアルのプレビュー方法

一般利用者向けサイトは、`docs/` 全体を `docs_dir` にしません。内部仕様書の混入を避けるため、ビルド前に `docs/manuals/` の必要なMarkdownと `docs/assets/` の必要なアセットだけを `.build/user-manual-docs/` へコピーします。

```bash
python scripts/build_user_manual_zip.py --web-only
python -m mkdocs serve --config-file mkdocs.user.yml
```

ブラウザで `http://127.0.0.1:8000` を開きます。

## 一般利用者向けオフラインZIP生成方法

```bash
python scripts/build_user_manual_zip.py
```

このコマンドは次を実行します。

1. `.build/user-manual-docs/` をクリーン作成する。
2. `docs/manuals/` から一般利用者向けMarkdownだけをコピーする。
3. 必要なCSSをコピーする。
4. `mkdocs.user.offline.yml` で `site-user-manual/` を生成する。
5. `dist/user-manual-offline.zip` を作成する。
6. ZIP直下に `index.html` があること、内部仕様書が混入していないことを簡易チェックする。


## スクリーンショット撮影時の注意

- 一般利用者向けマニュアルのスクリーンショットは、必ず実アプリを起動し、ダミーデータを使って撮影してください。
- 画像を想像で作成したり、実データ・個人情報・社内機密を含む画面を追加したりしないでください。
- 撮影環境でブラウザまたはElectronを起動できない場合は、Markdown上の `TODO: 画面キャプチャを追加してください。` を残し、PR説明に未撮影箇所と理由を記載してください。
- 画像を追加する場合は `docs/manuals/assets/images/<page>/` に保存し、一般利用者向けZIPへ含めるため、必要に応じて `scripts/build_user_manual_zip.py` のコピー対象も確認してください。

## ユーザーマニュアル更新ルール

- 一般利用者向けMarkdownは `docs/manuals/` 配下に配置します。
- 一般利用者向けZIPに含めるファイルは `scripts/build_user_manual_zip.py` の `MANUAL_FILES` で明示的に管理します。
- ソースコードから確認できない操作や業務ルールは、断定せず「未確認」「要確認」「TODO」と明記してください。
- 画面キャプチャが必要な場合は画像を捏造せず、対象画面を示すTODOを残してください。
- 一般利用者向けマニュアルには、内部仕様、開発者向け手順、詳細なデータ定義、システム運用設定を含めないでください。

## ソースコード変更時にユーザーマニュアル更新要否を確認するルール

以下を変更した場合は、関連するユーザーマニュアルも確認してください。

| 変更内容 | 確認対象 |
|---|---|
| 画面名、ボタン名、メニュー名、操作導線 | `docs/manuals/getting-started.md`, `docs/manuals/user-guide.md` |
| CSV取込、出力、保存、クリア | `docs/manuals/import-export.md`, `docs/manuals/troubleshooting.md` |
| 表示設定、検索、フィルター、表示列 | `docs/manuals/user-guide.md`, `docs/manuals/faq.md` |
| エラーメッセージ、制限事項 | `docs/manuals/faq.md`, `docs/manuals/troubleshooting.md` |

## 一般利用者向けZIPに内部仕様書を混入させない方針

- `mkdocs.user.yml` の `docs_dir` は `.build/user-manual-docs/` です。`docs/` 全体を直接指定しません。
- `scripts/build_user_manual_zip.py` は、許可されたMarkdownとCSSだけを一時ディレクトリにコピーします。
- ビルド後、ZIP内に仕様書、ADR、API仕様、内部設計書、管理者向け文書に該当するファイル名や文言がないか簡易チェックします。

## ページ内リンクのスムーススクロール

- 右側目次や本文中のページ内リンクは、`docs/assets/css/custom.css` のCSSだけでスムーススクロールと固定ヘッダー分の余白を調整しています。
- OSやブラウザで「動きを減らす」設定が有効な場合は、CSSの `prefers-reduced-motion` により通常スクロールになります。

## 画像クリック拡大の運用ルール

- ユーザーマニュアルのスクリーンショットは、通常のMarkdown画像として埋め込みます。例: `![初期表示](assets/images/getting-started/initial-screen.webp)`。
- スクリーンショット画像には `.no-lightbox` を付けません。クリックすると拡大表示される対象にします。
- アイコン、ロゴ、バッジ、小さな装飾画像には `{ .no-lightbox }` を付けます。例: `![ヘルプアイコン](assets/images/icons/help.svg){ .no-lightbox }`。
- 画像を追加したら、通常ビルドと一般利用者向けoffline ZIPビルドを確認します。
- offline ZIPを展開し、`index.html` を直接開いて、画像クリック拡大、バックドロップ表示、閉じる操作、検索欄、ライト/ダーク切替を確認します。

## Markdown追加時のnav更新ルール

- 内部向けサイトにページを追加する場合は `mkdocs.yml` の `nav` を更新します。
- 一般利用者向けサイトにページを追加する場合は、`mkdocs.user.yml` の `nav` と `scripts/build_user_manual_zip.py` の `MANUAL_FILES` を更新します。
- オフライン設定は通常、通常設定を `INHERIT` しているため、ナビゲーションは通常設定側で管理します。

## コミットしない生成物

以下は生成物またはローカル環境のため、通常ブランチにコミットしません。

- `site/`
- `site-user-manual/`
- `dist/`
- `.build/`
- `.cache/`
- `.venv/`

## PR時のレビュー観点

- `python -m mkdocs build --strict` が成功すること。
- `python scripts/build_user_manual_zip.py --web-only` が成功すること。
- `python scripts/build_docs_offline_zip.py` と `python scripts/build_user_manual_zip.py` が成功すること。
- 一般利用者向けマニュアルが実装済み機能だけを説明し、不明点を「未確認」「要確認」「TODO」として扱っていること。
- 一般利用者向けZIPに内部仕様書、API仕様、内部設計書、管理者向け文書が混入していないこと。
- `site/`、`site-user-manual/`、`dist/`、`.build/` がコミット対象になっていないこと。
