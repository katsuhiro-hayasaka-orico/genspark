# システム企画 予算管理ダッシュボード

## プロジェクト概要
- **名称**: システム企画 予算管理ダッシュボード
- **目的**: 情報システム部門（システム企画）における中長期（複数期間）の予算計画・予測・実績管理の一元化
- **解決する課題**: Excel管理の同時編集不可、バージョン管理困難、手動チャート作成、集計作業の煩雑さ、モバイル非対応

## 主な機能

### 実装済み機能
1. **ダッシュボード** — KPIカード（修正計画・実績累計・着地見込・残予算）、月別推移チャート、カテゴリ構成、累積推移、超過アラート
2. **予算データ入力** — Excel風マトリクス表（システム×費目×月）、4種類の金額（当初計画・修正計画・着地見込・実績）、セル直接編集、CSV入出力
3. **予実差異分析** — システム別・カテゴリ別・ドメイン別・費目別の差異テーブル、四半期/半期集計チャート、消化率プログレスバー
4. **中期比較** — FY65〜FY70の6年間横断比較、システム絞り込み、推移チャート
5. **レポート出力** — ドメイン別・システム別・カテゴリ別サマリ、Excel/PDF出力、印刷対応
6. **マスタ管理** — システムドメイン・システム、費用カテゴリ・費目の管理
7. **差異コメント** — 年間/半期/四半期/月次レベルの差異理由記録（4種別：差異説明・備考・アクション・リスク）
8. **操作マニュアル** — 全13章のWebマニュアル（/manual）

### 未実装（Phase 2）
- 承認ワークフロー（予算改定の承認フロー）
- 会計システム連携（実績の自動取込）
- 自動着地予測・異常検知
- メール通知アラート
- マルチテナント対応

## URL
- **アプリケーション**: https://3000-ia3opus0iq67dxs4c1h6v-cbeee0f9.sandbox.novita.ai
- **操作マニュアル**: https://3000-ia3opus0iq67dxs4c1h6v-cbeee0f9.sandbox.novita.ai/manual
- **GitHub**: https://github.com/katsuhiro-hayasaka-orico/genspark

## API エンドポイント一覧

| パス | メソッド | 説明 |
|------|----------|------|
| `/api/dashboard/summary` | GET | KPIサマリ |
| `/api/dashboard/alerts` | GET | 超過アラート |
| `/api/dashboard/trends` | GET | 月別累積推移 |
| `/api/dashboard/multi-year` | GET | 中期年度比較 |
| `/api/dashboard/system-summary` | GET | システム別サマリ |
| `/api/budgets/data` | GET | 予算データ取得 |
| `/api/budgets/matrix` | GET | マトリクスデータ取得 |
| `/api/budgets/upsert` | POST | セル単位更新 |
| `/api/budgets/bulk-upsert` | POST | 一括更新 |
| `/api/analysis/variance` | GET | 差異分析 |
| `/api/analysis/period` | GET | 四半期/半期集計 |
| `/api/analysis/system-detail` | GET | システム詳細 |
| `/api/analysis/cross-year` | GET | 年度横断比較 |
| `/api/comments` | GET/POST | コメントCRUD |
| `/api/reports/department-summary` | GET | ドメイン別レポート |
| `/api/reports/system-summary` | GET | システム別レポート |
| `/api/reports/category-summary` | GET | カテゴリ別レポート |
| `/api/reports/export-data` | GET | エクスポートデータ |
| `/api/master/fiscal-years` | GET/POST | 年度マスタ |
| `/api/master/domains` | GET/POST | ドメインマスタ |
| `/api/master/systems` | GET/POST | システムマスタ |
| `/api/master/expense-categories` | GET/POST | カテゴリマスタ |
| `/api/master/expense-items` | GET/POST | 費目マスタ |

## データモデル

### テーブル構成
- **users** — ユーザー管理
- **fiscal_years** — 年度マスタ（FY65〜FY70）
- **system_domains** — システムドメイン（基幹系・センター系・チャネル系・共通基盤）
- **systems** — システムマスタ（15システム）
- **expense_categories** — 費用カテゴリ（8カテゴリ）
- **expense_items** — 費目マスタ（24費目、課税/非課税）
- **budget_data** — 予算データ本体（システム×費目×月の3次元、4種金額）
- **budget_comments** — 差異コメント
- **audit_logs** — 監査ログ

### ディメンション
- **年度**: FY65(2025)〜FY70(2030)
- **システムドメイン**: 基幹系/センター系/チャネル系/共通基盤
- **費用カテゴリ**: HW/SW/クラウド/NW/保守/開発/人件費/その他
- **月**: 1〜12（4月始まり）

## 技術スタック
- **バックエンド**: Hono (TypeScript) on Cloudflare Workers
- **データベース**: Cloudflare D1 (SQLite) — 9テーブル、10インデックス
- **フロントエンド**: Vanilla JS SPA + Tailwind CSS + Chart.js + Font Awesome
- **ビルド**: Vite + @hono/vite-build
- **デプロイ**: Cloudflare Pages

## 利用方法
```bash
# 依存関係インストール
npm install

# データベースセットアップ
npm run db:migrate:local
npm run db:seed

# ビルド
npm run build

# 開発サーバー起動
npm run preview
```

## 金額単位
全金額は **千円（税抜）** 単位で管理されます。
例: 2,500 = 250万円

## デプロイ状況
- **プラットフォーム**: Cloudflare Pages
- **ステータス**: ✅ 開発環境稼働中
- **最終更新**: 2026-03-11
