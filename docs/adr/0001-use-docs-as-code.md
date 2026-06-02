# ADR-0001: Docs as Code を採用する

## Status

Accepted

## Date

2026-05-29

## Context

予実績管理ダッシュボードでは、画面表示、API、CSV取込、データ正規化、集計ロジックが `public/static/app.js` と `server.js` を中心に実装されています。仕様書がコードと別管理になると、実装変更時に仕様書更新が漏れ、保守担当が実装と仕様の差分を追跡しづらくなります。

## Decision

- 仕様書をコードと同じリポジトリで管理します。
- Markdown を基本形式にします。
- Pull Request で仕様書をレビューします。
- コード変更時は、関連仕様書を同じ PR で更新します。
- 仕様書更新が不要な場合も、PRで理由を明記します。

## Alternatives Considered

| 代替案 | 採用しない理由 |
|---|---|
| 外部Wikiで管理 | コード差分と仕様差分を同時レビューしづらい |
| Office文書で管理 | Git差分レビュー、検索、リンク管理に不向き |
| コメントのみで管理 | 画面/API/CSV/計算の横断的な仕様把握が難しい |

## Consequences

### Positive

- コード変更と仕様変更を同じPRで確認できます。
- 仕様書が古くなるリスクを減らせます。
- GitHub上で履歴、レビュー、リンクを管理できます。

### Negative

- 実装変更時にドキュメント更新コストが追加されます。
- Markdown品質を保つためのレビュー観点が増えます。

### Risks

- 仕様書更新チェックが形骸化すると、実装との不一致が再発します。
- コードから確認できない業務仕様を推測で断定するリスクがあります。

## Related Documents

- `docs/README.md`
- `.github/pull_request_template.md`
- `AGENTS.md`

## Related Source

- `public/static/app.js`
- `server.js`
