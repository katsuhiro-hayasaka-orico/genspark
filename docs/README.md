# Docs as Code 仕様書入口

このディレクトリは、予実績管理ダッシュボードの仕様をコードと同じ Pull Request で管理するための入口です。仕様書は Markdown で作成し、実装差分と同じレビュー単位で更新します。

## ドキュメント構成

| 種別 | ファイル | 読む目的 |
|---|---|---|
| 全体像 | [01_overview.md](./01_overview.md) | アプリの責務分担、画面構成、CSV取込から表示までの流れを把握する |
| 画面一覧 | [02_screen-list.md](./02_screen-list.md) | 画面キー、画面名、render関数、利用API、個別画面仕様の対応を確認する |
| CSV取込 | [03_data-import.md](./03_data-import.md) | ファイル種別、CSV解析、正規化、warning/error/skipped の扱いを確認する |
| API | [04_api-spec.md](./04_api-spec.md) | Express ルート、リクエスト、レスポンス、関連処理関数を確認する |
| データ辞書 | [05_data-dictionary.md](./05_data-dictionary.md) | 内部キー、日本語項目名、生成元、算出項目かどうかを確認する |
| 計算ロジック | [06_calculation-logic.md](./06_calculation-logic.md) | 金額、年月、会計期、差額率、アラート、新規案件コスト計算を確認する |
| 画面仕様 | [07_screen-specs/](./07_screen-specs/) | render関数単位で、表示項目・操作・API・計算を実装と照合する |
| UI/UX | [08_ui-ux.md](./08_ui-ux.md) | レイアウト、テーマ、表示倍率、レスポンシブ、アクセシビリティを確認する |
| エラー処理 | [09_error-handling.md](./09_error-handling.md) | CSV/API/空データ/計算不可などの扱いを確認する |
| ソース対応 | [99_source-map.md](./99_source-map.md) | 仕様書と対応ソース・関数・API の対応表を確認する |
| ADR | [ADRテンプレート](./adr/template.md) | 設計判断とその背景・影響を確認する |

## 仕様書同士の関係

- **画面仕様**は、保守担当が `public/static/app.js` の `render*` 関数、イベント処理、Chart.js 描画処理と照合するための仕様です。
- **API仕様**は、`server.js` の Express ルートと、画面が受け取るレスポンス構造を追跡するための仕様です。
- **CSV仕様**は、`server.js` の CSV パーサー、ファイル種別、正規化、取込結果の扱いを追跡するための仕様です。
- **データ項目辞書**は、CSV由来項目・APIレスポンス項目・フロントエンド表示項目の表記揺れをつなぐための辞書です。
- **計算ロジック仕様**は、サーバ側集計とフロントエンド側再集計・表示計算を分離して確認するための仕様です。
- **ADR**は、仕様書分割や運用方針など、あとから見返すべき設計判断を記録します。

## 仕様変更時の更新ルール

| 変更内容 | 必ず確認・更新する仕様書 |
|---|---|
| 画面構成、表示項目、操作、グラフ、テーブルを変更 | `docs/02_screen-list.md`、該当する `docs/07_screen-specs/*.md`、必要に応じて `docs/08_ui-ux.md` |
| APIルート、クエリ、レスポンス項目、エラー形式を変更 | `docs/04_api-spec.md`、`docs/05_data-dictionary.md`、関連画面仕様、`docs/99_source-map.md` |
| CSVファイル種別、列、正規化、必須チェックを変更 | `docs/03_data-import.md`、`docs/05_data-dictionary.md`、`docs/09_error-handling.md` |
| 金額、差額、率、しきい値、アラート、KPIを変更 | `docs/06_calculation-logic.md`、関連画面仕様、必要に応じてADR |
| 大きな責務分割、データモデル変更、運用方針変更 | `adr/` に ADR を追加または更新 |

## Pull Request 時の仕様書更新チェック方針

`.github/pull_request_template.md` のチェックリストを利用し、実装変更と仕様書変更が同じ PR に含まれていることを確認します。仕様書更新が不要な場合も、不要な理由を PR に明記してください。

## 今後の拡張案

| 候補 | 目的 |
|---|---|
| Markdown lint GitHub Actions | 見出し階層、表記揺れ、リンク切れを早期検出する |
| `npm test` 自動実行 | 既存の Node.js テストを PR で必ず実行する |
| docsリンクチェック | 仕様書間リンク、ADRリンク、ソースマップリンクの欠落を検出する |
| APIスナップショット検査 | 主要APIレスポンスの代表項目が仕様書から欠落していないか確認する |
| CSVサンプル検査 | サンプルCSVとCSV取込仕様の必須列・正規化仕様の差分を検出する |
