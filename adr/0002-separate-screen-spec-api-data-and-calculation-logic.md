# ADR-0002: 画面仕様、API仕様、データ項目辞書、計算ロジック仕様を分離する

## Status

Accepted

## Date

2026-05-29

## Context

このツールでは、画面表示ロジックは `public/static/app.js`、CSV正規化・永続化・集計APIは `server.js` に分散しています。画面仕様だけに情報を集約すると、APIレスポンス項目、CSV列の正規化、集計式、エラー時の扱いが追跡しづらくなります。

## Decision

以下の仕様書を分離して管理します。

| 仕様 | ファイル |
|---|---|
| 画面仕様 | `docs/07_screen-specs/*.md` |
| API仕様 | `docs/04_api-spec.md` |
| CSV取込仕様 | `docs/03_data-import.md` |
| データ項目辞書 | `docs/05_data-dictionary.md` |
| 計算ロジック仕様 | `docs/06_calculation-logic.md` |
| エラー仕様 | `docs/09_error-handling.md` |

## Alternatives Considered

| 代替案 | 採用しない理由 |
|---|---|
| 画面仕様にすべて記載 | API/CSV/計算ロジックの再利用箇所が重複し、更新漏れが起きやすい |
| API仕様だけ作成 | フロント側再集計やUI操作仕様を追跡できない |
| データ辞書なし | 表記揺れやCSV/API/画面項目の対応を追跡しづらい |

## Consequences

### Positive

- 変更種別ごとに更新対象を判断しやすくなります。
- 画面/API/CSV/計算の依存関係を明示できます。
- 保守担当が該当領域だけをレビューしやすくなります。

### Negative

- 同じ内部キーが複数仕様書に現れるため、リンク・対応表の維持が必要です。

### Risks

- 仕様書間で矛盾が発生する可能性があります。
- ソースマップ更新が漏れると追跡性が低下します。

## Related Documents

- `docs/03_data-import.md`
- `docs/04_api-spec.md`
- `docs/05_data-dictionary.md`
- `docs/06_calculation-logic.md`
- `docs/99_source-map.md`

## Related Source

- `public/static/app.js`
- `server.js`
