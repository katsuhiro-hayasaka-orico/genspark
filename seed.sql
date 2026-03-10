-- =============================================
-- Seed Data for IT Budget Tracker
-- =============================================

-- Users
INSERT OR IGNORE INTO users (id, email, name, role, department_id) VALUES
  (1, 'admin@example.com', '山田 太郎', 'admin', 1),
  (2, 'tanaka@example.com', '田中 花子', 'manager', 1),
  (3, 'suzuki@example.com', '鈴木 一郎', 'editor', 2),
  (4, 'sato@example.com', '佐藤 美咲', 'viewer', 3);

-- Fiscal Years
INSERT OR IGNORE INTO fiscal_years (id, year, name, start_date, end_date, is_active, total_budget) VALUES
  (1, 2025, 'FY2025', '2025-04-01', '2026-03-31', 1, 580000000),
  (2, 2024, 'FY2024', '2024-04-01', '2025-03-31', 0, 520000000);

-- Departments
INSERT OR IGNORE INTO departments (id, name, code, manager_name) VALUES
  (1, '情報システム部', 'IT', '山田 太郎'),
  (2, 'インフラ課', 'INFRA', '田中 花子'),
  (3, 'アプリ開発課', 'APPDEV', '鈴木 一郎'),
  (4, 'セキュリティ課', 'SEC', '佐藤 美咲');

-- Projects
INSERT OR IGNORE INTO projects (id, name, code, department_id, fiscal_year_id, status, description) VALUES
  (1, '基幹システム刷新', 'PRJ-001', 3, 1, 'active', '基幹業務システムのクラウド移行プロジェクト'),
  (2, 'ネットワーク更改', 'PRJ-002', 2, 1, 'active', '社内ネットワーク機器のリプレース'),
  (3, 'セキュリティ強化', 'PRJ-003', 4, 1, 'active', 'ゼロトラスト環境の構築'),
  (4, 'DX推進基盤', 'PRJ-004', 1, 1, 'planning', 'データ分析基盤の構築');

-- Budget Categories (hierarchical)
-- Level 0: Top categories
INSERT OR IGNORE INTO budget_categories (id, name, code, parent_id, level, sort_order) VALUES
  (1, 'ハードウェア', 'HW', NULL, 0, 1),
  (2, 'ソフトウェアライセンス', 'SW', NULL, 0, 2),
  (3, 'クラウド', 'CLOUD', NULL, 0, 3),
  (4, 'ネットワーク', 'NW', NULL, 0, 4),
  (5, '保守・サポート', 'MAINT', NULL, 0, 5),
  (6, '人件費(外注・派遣)', 'HR', NULL, 0, 6),
  (7, '教育・研修', 'EDU', NULL, 0, 7),
  (8, 'その他', 'OTHER', NULL, 0, 8);

-- Level 1: Sub-categories
INSERT OR IGNORE INTO budget_categories (id, name, code, parent_id, level, sort_order) VALUES
  (9, 'サーバー', 'HW-SRV', 1, 1, 1),
  (10, 'PC・端末', 'HW-PC', 1, 1, 2),
  (11, 'ストレージ', 'HW-STR', 1, 1, 3),
  (12, 'Microsoft 365', 'SW-M365', 2, 1, 1),
  (13, 'Adobe CC', 'SW-ADOBE', 2, 1, 2),
  (14, 'セキュリティソフト', 'SW-SEC', 2, 1, 3),
  (15, 'AWS', 'CLOUD-AWS', 3, 1, 1),
  (16, 'Azure', 'CLOUD-AZ', 3, 1, 2),
  (17, 'Google Cloud', 'CLOUD-GCP', 3, 1, 3),
  (18, 'SaaS', 'CLOUD-SAAS', 3, 1, 4);

-- Level 2: Sub-sub-categories
INSERT OR IGNORE INTO budget_categories (id, name, code, parent_id, level, sort_order) VALUES
  (19, 'EC2', 'CLOUD-AWS-EC2', 15, 2, 1),
  (20, 'RDS', 'CLOUD-AWS-RDS', 15, 2, 2),
  (21, 'S3', 'CLOUD-AWS-S3', 15, 2, 3),
  (22, 'Lambda', 'CLOUD-AWS-LAMBDA', 15, 2, 4);

-- Budget Plans for FY2025 (monthly allocations for top categories)
-- ハードウェア: 72M/year
INSERT OR IGNORE INTO budget_plans (fiscal_year_id, category_id, department_id, month, amount, created_by) VALUES
  (1, 1, 1, 1, 6000000, 1), (1, 1, 1, 2, 6000000, 1), (1, 1, 1, 3, 6000000, 1),
  (1, 1, 1, 4, 6000000, 1), (1, 1, 1, 5, 6000000, 1), (1, 1, 1, 6, 6000000, 1),
  (1, 1, 1, 7, 6000000, 1), (1, 1, 1, 8, 6000000, 1), (1, 1, 1, 9, 6000000, 1),
  (1, 1, 1, 10, 6000000, 1), (1, 1, 1, 11, 6000000, 1), (1, 1, 1, 12, 6000000, 1);

-- ソフトウェアライセンス: 84M/year
INSERT OR IGNORE INTO budget_plans (fiscal_year_id, category_id, department_id, month, amount, created_by) VALUES
  (1, 2, 1, 1, 7000000, 1), (1, 2, 1, 2, 7000000, 1), (1, 2, 1, 3, 7000000, 1),
  (1, 2, 1, 4, 7000000, 1), (1, 2, 1, 5, 7000000, 1), (1, 2, 1, 6, 7000000, 1),
  (1, 2, 1, 7, 7000000, 1), (1, 2, 1, 8, 7000000, 1), (1, 2, 1, 9, 7000000, 1),
  (1, 2, 1, 10, 7000000, 1), (1, 2, 1, 11, 7000000, 1), (1, 2, 1, 12, 7000000, 1);

-- クラウド: 144M/year
INSERT OR IGNORE INTO budget_plans (fiscal_year_id, category_id, department_id, month, amount, created_by) VALUES
  (1, 3, 1, 1, 12000000, 1), (1, 3, 1, 2, 12000000, 1), (1, 3, 1, 3, 12000000, 1),
  (1, 3, 1, 4, 12000000, 1), (1, 3, 1, 5, 12000000, 1), (1, 3, 1, 6, 12000000, 1),
  (1, 3, 1, 7, 12000000, 1), (1, 3, 1, 8, 12000000, 1), (1, 3, 1, 9, 12000000, 1),
  (1, 3, 1, 10, 12000000, 1), (1, 3, 1, 11, 12000000, 1), (1, 3, 1, 12, 12000000, 1);

-- ネットワーク: 36M/year
INSERT OR IGNORE INTO budget_plans (fiscal_year_id, category_id, department_id, month, amount, created_by) VALUES
  (1, 4, 1, 1, 3000000, 1), (1, 4, 1, 2, 3000000, 1), (1, 4, 1, 3, 3000000, 1),
  (1, 4, 1, 4, 3000000, 1), (1, 4, 1, 5, 3000000, 1), (1, 4, 1, 6, 3000000, 1),
  (1, 4, 1, 7, 3000000, 1), (1, 4, 1, 8, 3000000, 1), (1, 4, 1, 9, 3000000, 1),
  (1, 4, 1, 10, 3000000, 1), (1, 4, 1, 11, 3000000, 1), (1, 4, 1, 12, 3000000, 1);

-- 保守・サポート: 96M/year
INSERT OR IGNORE INTO budget_plans (fiscal_year_id, category_id, department_id, month, amount, created_by) VALUES
  (1, 5, 1, 1, 8000000, 1), (1, 5, 1, 2, 8000000, 1), (1, 5, 1, 3, 8000000, 1),
  (1, 5, 1, 4, 8000000, 1), (1, 5, 1, 5, 8000000, 1), (1, 5, 1, 6, 8000000, 1),
  (1, 5, 1, 7, 8000000, 1), (1, 5, 1, 8, 8000000, 1), (1, 5, 1, 9, 8000000, 1),
  (1, 5, 1, 10, 8000000, 1), (1, 5, 1, 11, 8000000, 1), (1, 5, 1, 12, 8000000, 1);

-- 人件費: 120M/year
INSERT OR IGNORE INTO budget_plans (fiscal_year_id, category_id, department_id, month, amount, created_by) VALUES
  (1, 6, 1, 1, 10000000, 1), (1, 6, 1, 2, 10000000, 1), (1, 6, 1, 3, 10000000, 1),
  (1, 6, 1, 4, 10000000, 1), (1, 6, 1, 5, 10000000, 1), (1, 6, 1, 6, 10000000, 1),
  (1, 6, 1, 7, 10000000, 1), (1, 6, 1, 8, 10000000, 1), (1, 6, 1, 9, 10000000, 1),
  (1, 6, 1, 10, 10000000, 1), (1, 6, 1, 11, 10000000, 1), (1, 6, 1, 12, 10000000, 1);

-- 教育・研修: 18M/year
INSERT OR IGNORE INTO budget_plans (fiscal_year_id, category_id, department_id, month, amount, created_by) VALUES
  (1, 7, 1, 1, 1500000, 1), (1, 7, 1, 2, 1500000, 1), (1, 7, 1, 3, 1500000, 1),
  (1, 7, 1, 4, 1500000, 1), (1, 7, 1, 5, 1500000, 1), (1, 7, 1, 6, 1500000, 1),
  (1, 7, 1, 7, 1500000, 1), (1, 7, 1, 8, 1500000, 1), (1, 7, 1, 9, 1500000, 1),
  (1, 7, 1, 10, 1500000, 1), (1, 7, 1, 11, 1500000, 1), (1, 7, 1, 12, 1500000, 1);

-- その他: 10M/year
INSERT OR IGNORE INTO budget_plans (fiscal_year_id, category_id, department_id, month, amount, created_by) VALUES
  (1, 8, 1, 1, 833333, 1), (1, 8, 1, 2, 833333, 1), (1, 8, 1, 3, 833333, 1),
  (1, 8, 1, 4, 833333, 1), (1, 8, 1, 5, 833333, 1), (1, 8, 1, 6, 833334, 1),
  (1, 8, 1, 7, 833333, 1), (1, 8, 1, 8, 833333, 1), (1, 8, 1, 9, 833333, 1),
  (1, 8, 1, 10, 833333, 1), (1, 8, 1, 11, 833333, 1), (1, 8, 1, 12, 833335, 1);

-- Actual Expenses for FY2025 (April 2025 - Feb 2026, 11 months of data)
-- Month 1 = April, Month 11 = February
-- ハードウェア actuals (slightly under budget most months)
INSERT OR IGNORE INTO actual_expenses (fiscal_year_id, category_id, department_id, month, amount, description, vendor, status, created_by) VALUES
  (1, 1, 1, 1, 5200000, 'サーバー購入(第1四半期)', 'Dell Technologies', 'approved', 1),
  (1, 1, 1, 2, 4800000, 'PC端末更新(営業部)', 'Lenovo Japan', 'approved', 1),
  (1, 1, 1, 3, 7500000, 'ストレージ拡張', 'NetApp Japan', 'approved', 1),
  (1, 1, 1, 4, 5500000, 'ネットワーク機器', 'Cisco Systems', 'approved', 1),
  (1, 1, 1, 5, 3200000, 'モニター購入', 'EIZO', 'approved', 1),
  (1, 1, 1, 6, 8200000, 'サーバー追加購入', 'HPE Japan', 'approved', 2),
  (1, 1, 1, 7, 5800000, 'PC端末更新(開発部)', 'Apple Japan', 'approved', 2),
  (1, 1, 1, 8, 4500000, 'プリンター更新', 'Ricoh', 'approved', 2),
  (1, 1, 1, 9, 6200000, 'サーバーメモリ増設', 'Dell Technologies', 'approved', 1),
  (1, 1, 1, 10, 5900000, 'タブレット端末', 'Apple Japan', 'approved', 1),
  (1, 1, 1, 11, 7100000, 'ネットワーク機器更新', 'Juniper Networks', 'approved', 1);

-- ソフトウェアライセンス actuals
INSERT OR IGNORE INTO actual_expenses (fiscal_year_id, category_id, department_id, month, amount, description, vendor, status, created_by) VALUES
  (1, 2, 1, 1, 8500000, 'Microsoft 365 年間ライセンス', 'Microsoft Japan', 'approved', 1),
  (1, 2, 1, 2, 3200000, 'Adobe CC ライセンス更新', 'Adobe Japan', 'approved', 1),
  (1, 2, 1, 3, 6800000, 'Oracle DB ライセンス', 'Oracle Japan', 'approved', 1),
  (1, 2, 1, 4, 5500000, 'VMware ライセンス', 'VMware', 'approved', 1),
  (1, 2, 1, 5, 7200000, 'SAP ライセンス更新', 'SAP Japan', 'approved', 2),
  (1, 2, 1, 6, 4800000, 'Slack Enterprise', 'Salesforce', 'approved', 2),
  (1, 2, 1, 7, 9200000, 'CrowdStrike ライセンス', 'CrowdStrike', 'approved', 1),
  (1, 2, 1, 8, 6100000, 'Jira/Confluence', 'Atlassian', 'approved', 1),
  (1, 2, 1, 9, 7800000, 'Windows Server CAL', 'Microsoft Japan', 'approved', 1),
  (1, 2, 1, 10, 5400000, 'Zoom Enterprise', 'Zoom', 'approved', 1),
  (1, 2, 1, 11, 8300000, 'ServiceNow ライセンス', 'ServiceNow', 'approved', 1);

-- クラウド actuals (trending upward)
INSERT OR IGNORE INTO actual_expenses (fiscal_year_id, category_id, department_id, month, amount, description, vendor, status, created_by) VALUES
  (1, 3, 1, 1, 11500000, 'AWS月額利用料(4月)', 'AWS', 'approved', 1),
  (1, 3, 1, 2, 11800000, 'AWS月額利用料(5月)', 'AWS', 'approved', 1),
  (1, 3, 1, 3, 12500000, 'AWS月額利用料(6月)+Azure', 'AWS/Microsoft', 'approved', 1),
  (1, 3, 1, 4, 13200000, 'クラウド利用料(7月)', 'AWS/Azure/GCP', 'approved', 1),
  (1, 3, 1, 5, 13800000, 'クラウド利用料(8月)', 'AWS/Azure/GCP', 'approved', 2),
  (1, 3, 1, 6, 14200000, 'クラウド利用料(9月)', 'AWS/Azure/GCP', 'approved', 2),
  (1, 3, 1, 7, 14500000, 'クラウド利用料(10月)', 'AWS/Azure/GCP', 'approved', 1),
  (1, 3, 1, 8, 13900000, 'クラウド利用料(11月)', 'AWS/Azure/GCP', 'approved', 1),
  (1, 3, 1, 9, 15100000, 'クラウド利用料(12月)', 'AWS/Azure/GCP', 'approved', 1),
  (1, 3, 1, 10, 14800000, 'クラウド利用料(1月)', 'AWS/Azure/GCP', 'approved', 1),
  (1, 3, 1, 11, 15200000, 'クラウド利用料(2月)', 'AWS/Azure/GCP', 'approved', 1);

-- ネットワーク actuals
INSERT OR IGNORE INTO actual_expenses (fiscal_year_id, category_id, department_id, month, amount, description, vendor, status, created_by) VALUES
  (1, 4, 2, 1, 2800000, '専用線月額(4月)', 'NTT Communications', 'approved', 2),
  (1, 4, 2, 2, 2800000, '専用線月額(5月)', 'NTT Communications', 'approved', 2),
  (1, 4, 2, 3, 3500000, '専用線+VPN追加(6月)', 'NTT/IIJ', 'approved', 2),
  (1, 4, 2, 4, 2900000, '回線月額(7月)', 'NTT Communications', 'approved', 2),
  (1, 4, 2, 5, 2800000, '回線月額(8月)', 'NTT Communications', 'approved', 2),
  (1, 4, 2, 6, 4200000, 'SD-WAN導入', 'Cisco/NTT', 'approved', 2),
  (1, 4, 2, 7, 3100000, '回線月額+SD-WAN(10月)', 'NTT Communications', 'approved', 2),
  (1, 4, 2, 8, 2900000, '回線月額(11月)', 'NTT Communications', 'approved', 2),
  (1, 4, 2, 9, 3000000, '回線月額(12月)', 'NTT Communications', 'approved', 2),
  (1, 4, 2, 10, 2800000, '回線月額(1月)', 'NTT Communications', 'approved', 2),
  (1, 4, 2, 11, 3200000, '回線月額+帯域増強(2月)', 'NTT Communications', 'approved', 2);

-- 保守・サポート actuals
INSERT OR IGNORE INTO actual_expenses (fiscal_year_id, category_id, department_id, month, amount, description, vendor, status, created_by) VALUES
  (1, 5, 1, 1, 7800000, 'サーバー保守(4月)', '富士通', 'approved', 1),
  (1, 5, 1, 2, 7500000, 'サーバー保守(5月)', '富士通', 'approved', 1),
  (1, 5, 1, 3, 8200000, 'サーバー保守+緊急対応(6月)', '富士通/NEC', 'approved', 1),
  (1, 5, 1, 4, 7800000, '保守月額(7月)', '富士通', 'approved', 1),
  (1, 5, 1, 5, 7600000, '保守月額(8月)', '富士通', 'approved', 1),
  (1, 5, 1, 6, 9500000, '保守+年次点検(9月)', '富士通/IBM', 'approved', 2),
  (1, 5, 1, 7, 7900000, '保守月額(10月)', '富士通', 'approved', 2),
  (1, 5, 1, 8, 7700000, '保守月額(11月)', '富士通', 'approved', 1),
  (1, 5, 1, 9, 8800000, '保守+障害対応(12月)', '富士通/NEC', 'approved', 1),
  (1, 5, 1, 10, 7500000, '保守月額(1月)', '富士通', 'approved', 1),
  (1, 5, 1, 11, 8200000, '保守月額+部品交換(2月)', '富士通', 'approved', 1);

-- 人件費 actuals
INSERT OR IGNORE INTO actual_expenses (fiscal_year_id, category_id, department_id, month, amount, description, vendor, status, created_by) VALUES
  (1, 6, 1, 1, 9800000, '外注費(4月)', 'TCS Japan', 'approved', 1),
  (1, 6, 1, 2, 10200000, '外注費(5月)', 'TCS Japan/Accenture', 'approved', 1),
  (1, 6, 1, 3, 10500000, '外注費(6月)', 'TCS Japan/Accenture', 'approved', 1),
  (1, 6, 1, 4, 11200000, '外注費+派遣(7月)', 'TCS/パーソル', 'approved', 1),
  (1, 6, 1, 5, 10800000, '外注費+派遣(8月)', 'TCS/パーソル', 'approved', 2),
  (1, 6, 1, 6, 11500000, '外注費+派遣(9月)', 'TCS/パーソル/NRI', 'approved', 2),
  (1, 6, 1, 7, 10900000, '外注費+派遣(10月)', 'TCS/パーソル', 'approved', 1),
  (1, 6, 1, 8, 10500000, '外注費+派遣(11月)', 'TCS/パーソル', 'approved', 1),
  (1, 6, 1, 9, 11800000, '外注費+派遣(12月)', 'TCS/パーソル/NRI', 'approved', 1),
  (1, 6, 1, 10, 10200000, '外注費+派遣(1月)', 'TCS/パーソル', 'approved', 1),
  (1, 6, 1, 11, 10800000, '外注費+派遣(2月)', 'TCS/パーソル', 'approved', 1);

-- 教育・研修 actuals
INSERT OR IGNORE INTO actual_expenses (fiscal_year_id, category_id, department_id, month, amount, description, vendor, status, created_by) VALUES
  (1, 7, 1, 1, 800000, 'AWS認定研修', 'クラスメソッド', 'approved', 3),
  (1, 7, 1, 2, 1200000, 'セキュリティ研修', 'LAC', 'approved', 3),
  (1, 7, 1, 3, 2500000, 'PMP研修+試験', 'グローバルナレッジ', 'approved', 3),
  (1, 7, 1, 4, 600000, 'オンライン学習(Udemy)', 'Udemy Business', 'approved', 3),
  (1, 7, 1, 5, 1800000, 'AI/ML研修', 'Google Cloud', 'approved', 3),
  (1, 7, 1, 6, 900000, 'リーダーシップ研修', '日本能率協会', 'approved', 3),
  (1, 7, 1, 7, 2200000, 'Azure認定研修', 'Microsoft', 'approved', 3),
  (1, 7, 1, 8, 500000, '技術書購入', '各社', 'approved', 3),
  (1, 7, 1, 9, 1500000, 'CISSP研修', 'ISC2', 'approved', 3),
  (1, 7, 1, 10, 1100000, 'アジャイル研修', 'Scrum Inc.', 'approved', 3),
  (1, 7, 1, 11, 1600000, 'データベース研修', 'Oracle University', 'approved', 3);

-- その他 actuals
INSERT OR IGNORE INTO actual_expenses (fiscal_year_id, category_id, department_id, month, amount, description, vendor, status, created_by) VALUES
  (1, 8, 1, 1, 500000, '展示会参加費', 'Interop Tokyo', 'approved', 1),
  (1, 8, 1, 2, 300000, '消耗品', '各社', 'approved', 1),
  (1, 8, 1, 3, 1200000, 'コンサルティング費', 'Gartner', 'approved', 1),
  (1, 8, 1, 4, 400000, '消耗品・雑費', '各社', 'approved', 1),
  (1, 8, 1, 5, 600000, '出張費', '各社', 'approved', 1),
  (1, 8, 1, 6, 800000, 'イベント開催費', '社内IT Day', 'approved', 1),
  (1, 8, 1, 7, 350000, '消耗品', '各社', 'approved', 1),
  (1, 8, 1, 8, 450000, '出張費', '各社', 'approved', 1),
  (1, 8, 1, 9, 900000, 'コンサルティング費', 'IDC Japan', 'approved', 1),
  (1, 8, 1, 10, 550000, '消耗品・雑費', '各社', 'approved', 1),
  (1, 8, 1, 11, 700000, '年度末対応費', '各社', 'approved', 1);

-- Committed Expenses (not yet paid)
INSERT OR IGNORE INTO committed_expenses (fiscal_year_id, category_id, department_id, month, amount, description, vendor, order_number, status, created_by) VALUES
  (1, 1, 1, 12, 8500000, '新サーバー発注(年度末)', 'Dell Technologies', 'PO-2026-001', 'ordered', 1),
  (1, 3, 1, 12, 15000000, 'AWS Reserved Instance 購入', 'AWS', 'PO-2026-002', 'ordered', 1),
  (1, 5, 1, 12, 9500000, '次年度保守契約(前払い)', '富士通', 'PO-2026-003', 'ordered', 2),
  (1, 6, 1, 12, 12000000, '3月派遣費(確定)', 'パーソルテクノロジー', 'PO-2026-004', 'delivered', 1),
  (1, 2, 1, 12, 6000000, 'ライセンス更新(3月)', 'Microsoft Japan', 'PO-2026-005', 'ordered', 1);
