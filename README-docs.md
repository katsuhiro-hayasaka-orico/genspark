# ドキュメントサイト運用ガイド

このリポジトリでは、既存のDocs as Code仕様書と取扱説明書をMkDocs Materialで同一サイトとして閲覧できるようにします。

## ローカルプレビュー方法

```bash
python -m venv .venv
. .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements-docs.txt
python -m mkdocs serve
```

ブラウザで `http://127.0.0.1:8000` を開きます。

## 通常ビルド方法

```bash
python -m mkdocs build --strict
```

生成物は `site/` に出力されます。`site/` は通常ブランチにコミットしません。

## オフラインZIP生成方法

```bash
python scripts/build_docs_offline_zip.py
```

`mkdocs.offline.yml` を使って `site/` を生成し、ZIP直下に `index.html` が来る形で `dist/budget-csv-viewer-docs-offline.zip` を作成します。`dist/` も通常ブランチにコミットしません。

## 仕様書Markdownの追加・更新ルール

- 既存仕様書は `docs/` 配下の原本をそのままMkDocsの `docs_dir` として利用します。
- `adr/` は `docs_dir` 外のため、MkDocs上のリンク切れを避ける目的で `docs/adr/` に同内容を配置しています。ADR原本を更新した場合は `docs/adr/` も同期してください。
- 仕様書本文の意味を変える変更は、対応する実装変更と同じPull Requestで行ってください。
- 画面、API、CSV、計算ロジックを変更した場合は、`AGENTS.md` と `docs/README.md` の更新ルールに従って関連仕様書を更新してください。
- 新しい仕様書Markdownを追加した場合は、`mkdocs.yml` の `nav` に追加してください。

## 取扱説明書Markdownの更新ルール

- 取扱説明書は `docs/manuals/` 配下に配置します。
- ソースコードから確認できない操作や業務ルールは、断定せず「未確認」「要確認」「TODO」と明記してください。
- 画面キャプチャが必要な場合は画像を捏造せず、対象画面を示すTODOを残してください。

## ソースコード変更時に取扱説明書を更新するルール

以下を変更した場合は、関連する取扱説明書も確認してください。

| 変更内容 | 確認対象 |
|---|---|
| 画面名、ボタン名、メニュー名、操作導線 | `docs/manuals/user-guide.md`, `docs/manuals/faq.md` |
| 起動方法、設定、永続化、配布方法 | `docs/manuals/admin-guide.md`, `docs/manuals/troubleshooting.md` |
| CSV取込、出力、保存、クリア | `docs/manuals/user-guide.md`, `docs/manuals/troubleshooting.md` |
| エラーメッセージ、制限事項 | `docs/manuals/faq.md`, `docs/manuals/troubleshooting.md` |

## Markdown追加時のnav更新ルール

- サイト上で閲覧してほしいMarkdownを追加した場合は、`mkdocs.yml` の `nav` に追加します。
- オフライン配布でも同じナビゲーションを使うため、通常は `mkdocs.offline.yml` ではなく `mkdocs.yml` を更新します。
- 既存仕様書は原本移動せず、ファイル名とディレクトリ構造に合わせて `nav` を調整します。

## コミットしない生成物

以下は生成物またはローカル環境のため、通常ブランチにコミットしません。

- `site/`
- `dist/`
- `.cache/`
- `.venv/`

## PR時のレビュー観点

- `python -m mkdocs build --strict` が成功すること。
- 追加・変更したMarkdownが `mkdocs.yml` の `nav` から辿れること。
- 仕様書本文の意味を不要に変更していないこと。
- 取扱説明書が実装済み機能だけを説明し、不明点を「未確認」「要確認」「TODO」として扱っていること。
- オフラインZIPに `index.html`、`assets/`、`search/` など必要ファイルが含まれること。
