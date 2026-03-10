# IT予算予実績管理ダッシュボード

## プロジェクト概要
- **名前**: IT Budget Tracker Dashboard
- **目的**: 情報システム部門のIT予算管理をExcelからWebベースのダッシュボードシステムに移行
- **対象**: 情報システム部門の管理者・経理担当者

## 主な機能

### 実装済み (Phase 1)

#### 1. ダッシュボード (`/` → ダッシュボード)
- KPIカード: 年間予算総額 / 年累計実績 / 予算消化率 / 残予算
- 月別予実比較棒グラフ（予算 vs 実績 vs コミット）
- カテゴリ別予算配分ドーナツチャート
- 累計予実績推移折れ線グラフ
- 超過警告アラート: 消化率80%超でYellow、95%超でRed
- カテゴリ別サマリーテーブル

#### 2. 予算管理 (`/` → 予算管理)
- 年度別予算の一覧表示（月別配分付き）
- 予算の新規登録・編集
- 月別予算均等配分機能
- カテゴリ・部門別のフィルタリング

#### 3. 実績入力 (`/` → 実績入力)
- 実績データの一覧表示
- 実績の新規登録・編集・削除
- CSVインポート機能
- 月・カテゴリ別フィルタリング

#### 4. コミット管理 (`/` → コミット管理)
- 発注済・未払い金額の管理
- コミットの登録・削除
- ステータス管理（発注済/納品済/請求済/キャンセル）

#### 5. 予実分析 (`/` → 予実分析)
- カテゴリ別予実比較横棒グラフ
- 消化率トレンドグラフ（80%/95%ライン付き）
- 予算残額 = 予算額 - 実績額 - コミット額
- 進捗率 = 実績額 / 予算額 × 100
- 差異 = 実績額 - 予算額
- 部門別サマリー

#### 6. レポート出力 (`/` → レポート出力)
- PDF出力（印刷用フォーマット）
- Excelエクスポート（XML形式）
- CSVエクスポート（BOM付きUTF-8）

#### 7. マスタ管理
- カテゴリ管理: 階層構造対応（3レベル）
- 部門管理: CRUD操作
- プロジェクト管理: カード表示

### 未実装 (Phase 2 - 将来計画)
- 承認ワークフロー
- 予算申請機能
- メール通知（予算超過アラート）
- ベンダー管理
- マルチテナント対応
- JWT認証・ログイン機能
- ファイル添付（R2 Storage連携）

## API エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/health` | ヘルスチェック |
| GET | `/api/dashboard/summary?fiscal_year_id=1` | ダッシュボードKPI・サマリー |
| GET | `/api/dashboard/alerts?fiscal_year_id=1` | 超過アラート一覧 |
| GET | `/api/dashboard/trends?fiscal_year_id=1` | 累計推移データ |
| GET | `/api/budgets?fiscal_year_id=1` | 予算一覧 |
| GET | `/api/budgets/summary?fiscal_year_id=1` | 予算サマリー |
| POST | `/api/budgets` | 予算登録 |
| POST | `/api/budgets/bulk` | 月別予算一括登録 |
| PUT | `/api/budgets/:id` | 予算更新 |
| DELETE | `/api/budgets/:id` | 予算削除 |
| GET | `/api/actuals?fiscal_year_id=1` | 実績一覧 |
| POST | `/api/actuals` | 実績登録 |
| POST | `/api/actuals/import` | CSVインポート |
| PUT | `/api/actuals/:id` | 実績更新 |
| DELETE | `/api/actuals/:id` | 実績削除 |
| GET | `/api/committed?fiscal_year_id=1` | コミット一覧 |
| POST | `/api/committed` | コミット登録 |
| PUT | `/api/committed/:id` | コミット更新 |
| DELETE | `/api/committed/:id` | コミット削除 |
| GET | `/api/master/fiscal-years` | 年度一覧 |
| GET | `/api/master/categories` | カテゴリ一覧 |
| GET | `/api/master/categories/tree` | カテゴリツリー |
| GET | `/api/master/departments` | 部門一覧 |
| GET | `/api/master/projects` | プロジェクト一覧 |
| GET | `/api/reports/monthly` | 月次レポート |
| GET | `/api/reports/department` | 部門別レポート |

## データモデル

### テーブル構成
- **users** - ユーザー・権限管理
- **fiscal_years** - 年度マスタ
- **departments** - 部門マスタ
- **projects** - プロジェクトマスタ
- **budget_categories** - 費用カテゴリ（階層対応）
- **budget_plans** - 月別予算計画
- **actual_expenses** - 実績データ
- **committed_expenses** - コミット/発注済金額
- **audit_logs** - 変更履歴

### カテゴリ構成
- ハードウェア > サーバー / PC・端末 / ストレージ
- ソフトウェアライセンス > M365 / Adobe CC / セキュリティソフト
- クラウド > AWS (EC2/RDS/S3/Lambda) / Azure / GCP / SaaS
- ネットワーク
- 保守・サポート
- 人件費（外注・派遣）
- 教育・研修
- その他

## 技術スタック
- **バックエンド**: Hono (TypeScript) on Cloudflare Workers
- **データベース**: Cloudflare D1 (SQLite)
- **フロントエンド**: Vanilla JS + Tailwind CSS (CDN) + Chart.js
- **ビルド**: Vite + @hono/vite-build
- **デプロイ**: Cloudflare Pages

## 開発環境

```bash
# インストール
npm install

# データベースセットアップ
npm run db:migrate:local
npm run db:seed

# ビルド
npm run build

# 開発サーバー起動
npm run preview
# or
pm2 start ecosystem.config.cjs

# データベースリセット
npm run db:reset
```

## デプロイ
- **プラットフォーム**: Cloudflare Pages
- **ステータス**: 開発中 (ローカル動作確認済み)
- **最終更新**: 2026-03-10
