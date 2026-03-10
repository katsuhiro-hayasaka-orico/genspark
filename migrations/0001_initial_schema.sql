-- =============================================
-- IT Budget Tracker - Database Schema
-- =============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','manager','editor','viewer')),
  department_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fiscal Years
CREATE TABLE IF NOT EXISTS fiscal_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  total_budget REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  manager_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  department_id INTEGER,
  fiscal_year_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('planning','active','completed','cancelled')),
  description TEXT,
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id)
);

-- Budget Categories (hierarchical with parent_id)
CREATE TABLE IF NOT EXISTS budget_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  parent_id INTEGER,
  level INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES budget_categories(id)
);

-- Budget Plans (monthly allocation)
CREATE TABLE IF NOT EXISTS budget_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  department_id INTEGER,
  project_id INTEGER,
  month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id),
  FOREIGN KEY (category_id) REFERENCES budget_categories(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE(fiscal_year_id, category_id, department_id, project_id, month)
);

-- Actual Expenses
CREATE TABLE IF NOT EXISTS actual_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  department_id INTEGER,
  project_id INTEGER,
  month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  amount REAL NOT NULL DEFAULT 0,
  description TEXT,
  vendor TEXT,
  invoice_number TEXT,
  invoice_date TEXT,
  payment_date TEXT,
  status TEXT NOT NULL DEFAULT 'recorded' CHECK(status IN ('draft','recorded','approved','rejected')),
  created_by INTEGER,
  approved_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id),
  FOREIGN KEY (category_id) REFERENCES budget_categories(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Committed Expenses (ordered but not yet paid)
CREATE TABLE IF NOT EXISTS committed_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  department_id INTEGER,
  project_id INTEGER,
  month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  amount REAL NOT NULL DEFAULT 0,
  description TEXT,
  vendor TEXT,
  order_number TEXT,
  order_date TEXT,
  expected_delivery_date TEXT,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK(status IN ('ordered','delivered','invoiced','cancelled')),
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id),
  FOREIGN KEY (category_id) REFERENCES budget_categories(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id INTEGER,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_budget_plans_fy ON budget_plans(fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_budget_plans_cat ON budget_plans(category_id);
CREATE INDEX IF NOT EXISTS idx_budget_plans_dept ON budget_plans(department_id);
CREATE INDEX IF NOT EXISTS idx_budget_plans_month ON budget_plans(month);
CREATE INDEX IF NOT EXISTS idx_actual_expenses_fy ON actual_expenses(fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_actual_expenses_cat ON actual_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_actual_expenses_month ON actual_expenses(month);
CREATE INDEX IF NOT EXISTS idx_committed_expenses_fy ON committed_expenses(fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_committed_expenses_status ON committed_expenses(status);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON budget_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_projects_dept ON projects(department_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name, record_id);
