# AGENTS.md

このファイルは、このリポジトリで作業するAIエージェント/Codex向けのガイドです。リポジトリ全体に適用します。

## プロジェクト概要

予実績管理ダッシュボード（Budget CSV Viewer）は、CSVで取り込んだ予算・見込み・実績データをローカル環境で可視化する Node.js + Express + Vanilla JS SPA + Electron アプリです。

## ソース構成

| パス | 役割 |
|---|---|
| `server.js` | Expressサーバ、CSV解析、正規化、ローカル永続化、集計API |
| `public/index.html` | SPAのHTML骨格 |
| `public/static/app.js` | ナビゲーション、状態管理、API呼び出し、画面描画、グラフ描画 |
| `public/static/style.css` | 共通スタイル、テーマ、レスポンシブ、UI部品 |
| `electron/` | Electron起動とpreload |
| `tests/` | Node.jsテスト |
| `docs/` | Docs as Code 仕様書 |
| `adr/` | Architecture Decision Record |

## ドキュメント構成

| パス | 内容 |
|---|---|
| `docs/README.md` | ドキュメント入口、更新ルール |
| `docs/01_overview.md` | 全体概要 |
| `docs/02_screen-list.md` | 画面一覧、画面キー、render関数 |
| `docs/03_data-import.md` | CSV取込仕様 |
| `docs/04_api-spec.md` | API仕様 |
| `docs/05_data-dictionary.md` | データ項目辞書 |
| `docs/06_calculation-logic.md` | 計算ロジック仕様 |
| `docs/07_screen-specs/` | 画面別仕様 |
| `docs/08_ui-ux.md` | UI/UX共通仕様 |
| `docs/09_error-handling.md` | エラー処理仕様 |
| `docs/99_source-map.md` | 仕様書とソースの対応表 |
| `adr/` | 設計判断履歴 |

## 仕様書更新ルール

- 実装を変更する場合は、関連する仕様書を同じPull Requestで更新してください。
- コードから確認できない業務仕様は推測で断定せず、「未確認事項」として記載してください。
- 仕様書と実装の対応を保つため、必要に応じて `docs/99_source-map.md` を更新してください。
- 大きな設計判断は `adr/` にADRを追加または更新してください。

## コード変更時のドキュメント更新ルール

| 変更内容 | 更新対象 |
|---|---|
| 画面表示、表示項目、操作、グラフ、テーブル | `docs/02_screen-list.md`、該当 `docs/07_screen-specs/*.md`、必要に応じて `docs/08_ui-ux.md` |
| APIルート、クエリ、レスポンス、エラー | `docs/04_api-spec.md`、`docs/05_data-dictionary.md`、関連画面仕様、`docs/99_source-map.md` |
| CSVファイル種別、列、正規化、必須チェック | `docs/03_data-import.md`、`docs/05_data-dictionary.md`、`docs/09_error-handling.md` |
| 計算式、KPI、しきい値、アラート | `docs/06_calculation-logic.md`、関連画面仕様、必要に応じてADR |
| UIテーマ、レイアウト、アクセシビリティ | `docs/08_ui-ux.md`、関連画面仕様 |

## 画面変更時の更新対象

- `public/static/app.js` の `render*` 関数を変更した場合、対応する `docs/07_screen-specs/*.md` を更新してください。
- ナビゲーションの画面キーや画面名を変更した場合、`docs/02_screen-list.md` も更新してください。

## API変更時の更新対象

- `server.js` の `app.get` / `app.post` ルートを追加・変更・削除した場合、`docs/04_api-spec.md` と `docs/99_source-map.md` を更新してください。
- レスポンス項目が増減した場合、`docs/05_data-dictionary.md` と関連画面仕様も確認してください。

## CSV項目変更時の更新対象

- `parse*Csv`、`normalize*`、ヘッダー別名、必須チェックを変更した場合、`docs/03_data-import.md` を更新してください。
- 新しい内部キーを追加した場合、`docs/05_data-dictionary.md` を更新してください。

## 計算式変更時の更新対象

- 差額、差額率、予算消化率、進捗率、コスト消化率、アラート判定を変更した場合、`docs/06_calculation-logic.md` と関連画面仕様を更新してください。

## ADRが必要な変更の例

- 画面仕様の管理単位を変更する。
- APIレスポンス構造を大きく変更する。
- CSVレイアウトや必須列の方針を変更する。
- 計算ロジックの業務上の意味を変更する。
- 永続化方式、セキュリティ方針、Electron起動方式を変更する。
- 既存互換性を破る変更を行う。

## 禁止事項

- 実装挙動を勝手に変えない。
- 仕様書と実装の不一致を放置しない。
- 推測で業務仕様を断定しない。
- 大きな仕様変更をADRなしで入れない。
- `server.js`、`public/static/app.js`、`public/static/style.css`、`public/index.html` の挙動を、ドキュメント整備目的で変更しない。
- import文にtry/catchをかけない。

## 推奨チェック

```bash
npm test
npm run check:external
```
