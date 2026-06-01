# ADR-0003: 画面仕様を render 関数単位で管理する

## Status

Accepted

## Date

2026-05-29

## Context

`public/static/app.js` では、ナビゲーションの画面キーごとに `renderImport`、`renderSummary`、`renderTrend` などの `render*` 関数が画面HTML、API呼び出し、イベント処理、グラフ・テーブル描画を担っています。画面仕様を利用者向け章立てだけで管理すると、実装上の変更箇所と仕様書の対応が曖昧になります。

## Decision

画面仕様は `app.js` の render 関数単位で管理します。

| 画面キー | render関数 | 仕様書 |
|---|---|---|
| `import` | `renderImport` | `docs/07_screen-specs/01_import.md` |
| `summary` | `renderSummary` | `docs/07_screen-specs/02_summary.md` |
| `trend` | `renderTrend` | `docs/07_screen-specs/03_trend.md` |
| `category` | `renderCategory` | `docs/07_screen-specs/04_category.md` |
| `alert` | `renderAlert` | `docs/07_screen-specs/05_alert.md` |
| `vendor` | `renderVendor` | `docs/07_screen-specs/06_vendor.md` |
| `detail` | `renderDetail` | `docs/07_screen-specs/07_detail.md` |
| `project` | `renderProject` | `docs/07_screen-specs/08_new-project-cost.md` |
| `depreciation` | `renderDepreciation` | `docs/07_screen-specs/09_depreciation.md` |
| `oacis` | `renderOacisActual` | `docs/07_screen-specs/10_oacis.md` |
| `settings` | `renderSettings` | `docs/07_screen-specs/11_settings.md` |
| `manual` | `renderManual` | `docs/07_screen-specs/12_manual.md` |

## Alternatives Considered

| 代替案 | 採用しない理由 |
|---|---|
| 業務機能単位で画面仕様をまとめる | 1つの仕様書に複数render関数が混在し、実装差分レビューが難しい |
| ファイル単位で1仕様書にする | `app.js` が大きく、画面単位の保守性が低い |

## Consequences

### Positive

- 画面ごとのUI構成、API呼び出し、イベント処理、グラフ・テーブル描画を追跡しやすくなります。
- PRで `render*` 関数を変更した場合、更新対象の仕様書を判断しやすくなります。

### Negative

- 共通処理の仕様は画面仕様だけでは重複するため、UI/UX仕様や計算ロジック仕様との併用が必要です。

### Risks

- render関数から共通コンポーネントへ分割された場合、仕様書構成の見直しが必要になる可能性があります。

## Related Documents

- `docs/02_screen-list.md`
- `docs/07_screen-specs/`
- `docs/99_source-map.md`

## Related Source

- `public/static/app.js`
