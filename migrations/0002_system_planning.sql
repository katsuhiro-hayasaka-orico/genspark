-- =============================================
-- System Planning Budget Management - Schema v2
-- Multi-year, multi-dimensional budget tracking
-- Dimensions: System/Domain × ExpenseCategory × ExpenseItem × Month
-- Amount unit: thousand yen (tax-excluded)
-- =============================================

-- Drop old tables
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS committed_expenses;
DROP TABLE IF EXISTS actual_expenses;
DROP TABLE IF EXISTS budget_plans;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS budget_categories;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS fiscal_years;
DROP TABLE IF EXISTS users;

-- =============================================
-- Master Tables
-- =============================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','manager','editor','viewer')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fiscal Years (FY65=2025, FY66=2026, etc.)
CREATE TABLE IF NOT EXISTS fiscal_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,           -- e.g., 'FY65', 'FY66'
  name TEXT NOT NULL,                  -- e.g., '2025年度(FY65)'
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  is_locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- System Domains (top-level grouping)
CREATE TABLE IF NOT EXISTS system_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,           -- e.g., 'CORE', 'CENTER', 'CHANNEL'
  name TEXT NOT NULL,                  -- e.g., '基幹系', 'センター系', 'チャネル系'
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Systems (individual systems under domains)
CREATE TABLE IF NOT EXISTS systems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id INTEGER NOT NULL,
  code TEXT UNIQUE NOT NULL,           -- e.g., 'CORE-AUTH', 'CAFIS'
  name TEXT NOT NULL,                  -- e.g., 'オーソリシステム', 'CAFIS'
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (domain_id) REFERENCES system_domains(id)
);

-- Expense Categories (broad categories)
CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,           -- e.g., 'HW', 'SW', 'CLOUD'
  name TEXT NOT NULL,                  -- e.g., 'ハードウェア', 'ソフトウェアライセンス'
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Expense Items (detailed items under categories)
CREATE TABLE IF NOT EXISTS expense_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  code TEXT UNIQUE NOT NULL,           -- e.g., 'HW-LEASE', 'SW-MAINT'
  name TEXT NOT NULL,                  -- e.g., 'リース料', '保守費'
  is_taxable INTEGER NOT NULL DEFAULT 1,  -- 課税/非課税
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES expense_categories(id)
);

-- =============================================
-- Transaction Data (the core 3D data model)
-- Granularity: System × ExpenseItem × Month
-- Amount types: initial_plan, revised_plan, forecast, actual
-- =============================================

-- Budget Data (single table, all amount types)
CREATE TABLE IF NOT EXISTS budget_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year_id INTEGER NOT NULL,
  system_id INTEGER NOT NULL,
  expense_item_id INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  initial_plan REAL NOT NULL DEFAULT 0,     -- 当初計画 (thousand yen)
  revised_plan REAL NOT NULL DEFAULT 0,     -- 修正計画 (thousand yen)
  forecast REAL NOT NULL DEFAULT 0,         -- 見込/着地予測 (thousand yen)
  actual REAL NOT NULL DEFAULT 0,           -- 実績 (thousand yen)
  contract_partner TEXT,                    -- 契約先
  notes TEXT,                               -- 備考
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(fiscal_year_id, system_id, expense_item_id, month),
  FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id),
  FOREIGN KEY (system_id) REFERENCES systems(id),
  FOREIGN KEY (expense_item_id) REFERENCES expense_items(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- =============================================
-- Comments (variance reasons, etc.)
-- Attached at various aggregation levels
-- =============================================

CREATE TABLE IF NOT EXISTS budget_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year_id INTEGER NOT NULL,
  system_id INTEGER,                       -- NULL = fiscal year level
  expense_item_id INTEGER,                 -- NULL = system level
  period_type TEXT NOT NULL DEFAULT 'annual' CHECK(period_type IN ('annual','half','quarter','month')),
  period_value INTEGER,                     -- NULL for annual; 1/2 for half; 1-4 for quarter; 1-12 for month
  comment_type TEXT NOT NULL DEFAULT 'variance' CHECK(comment_type IN ('variance','note','action','risk')),
  content TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id),
  FOREIGN KEY (system_id) REFERENCES systems(id),
  FOREIGN KEY (expense_item_id) REFERENCES expense_items(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- =============================================
-- Audit Log
-- =============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id INTEGER,
  old_values TEXT,
  new_values TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =============================================
-- Indexes
-- =============================================

CREATE INDEX IF NOT EXISTS idx_systems_domain ON systems(domain_id);
CREATE INDEX IF NOT EXISTS idx_expense_items_category ON expense_items(category_id);
CREATE INDEX IF NOT EXISTS idx_budget_data_fy ON budget_data(fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_budget_data_system ON budget_data(system_id);
CREATE INDEX IF NOT EXISTS idx_budget_data_item ON budget_data(expense_item_id);
CREATE INDEX IF NOT EXISTS idx_budget_data_month ON budget_data(month);
CREATE INDEX IF NOT EXISTS idx_budget_data_lookup ON budget_data(fiscal_year_id, system_id, expense_item_id);
CREATE INDEX IF NOT EXISTS idx_budget_comments_fy ON budget_comments(fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_budget_comments_system ON budget_comments(system_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name, record_id);
