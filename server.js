const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Multer setup (memory storage, no disk persistence) ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv') cb(null, true);
    else cb(new Error('CSV形式のみ対応しています (.csv)'));
  }
});

app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'public', 'static')));

// =============================================
// In-memory data store
// =============================================
let store = {
  master: null,       // parsed budget_master rows
  detail: null,       // parsed budget_detail rows
  uploadedAt: null,
  masterFileName: null,
  detailFileName: null,
};

// =============================================
// CSV Parsing (no external dependency)
// =============================================
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// =============================================
// Data Processing Helpers
// =============================================
function toNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

// Parse target_year_month (e.g. "202404") -> { year: 2024, month: 4 }
function parseYM(ym) {
  const s = String(ym).trim();
  if (s.length !== 6) return null;
  const y = parseInt(s.substring(0, 4));
  const m = parseInt(s.substring(4, 6));
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

// Format year_month for display (e.g. 202404 -> "2024/04")
function fmtYM(ym) {
  const s = String(ym).trim();
  if (s.length === 6) return s.substring(0, 4) + '/' + s.substring(4, 6);
  return ym;
}

// Derive fiscal_period label from period number
function periodLabel(p) {
  const n = toNum(p);
  // period 60 = FY2024 (Apr 2024 - Mar 2025)
  // period 61 = FY2025, period 62 = FY2026, etc.
  if (n >= 60 && n <= 99) {
    const baseYear = 2024 + (n - 60);
    return `第${n}期 (FY${baseYear})`;
  }
  return `第${n}期`;
}

function periodFY(p) {
  const n = toNum(p);
  if (n >= 60 && n <= 99) return 2024 + (n - 60);
  return n;
}

// =============================================
// Build unified data from new schema
// =============================================
function buildUnifiedData() {
  if (!store.master && !store.detail) return null;

  // Step 1: Build master lookup map: management_no + item_no -> master info
  const masterMap = {};
  const allPeriods = new Set();
  const allSystems = {};       // system_code -> { name, classification }
  const allDepartments = new Set();
  const allBudgetCategories = new Set();
  const allExpenseItems = {};  // expense_item_code -> expense_item_name

  if (store.master) {
    for (const row of store.master) {
      const mno = row.management_no || '';
      const ino = row.item_no || '';
      if (!mno) continue;

      const key = `${mno}|${ino}`;
      masterMap[key] = row;

      if (row.period) allPeriods.add(row.period);

      const syscode = row.system_code || '';
      if (syscode && !allSystems[syscode]) {
        allSystems[syscode] = {
          code: syscode,
          name: row.system_name || syscode,
          classification: row.system_classification_name || '',
          expense_item_code: row.expense_item_code || '',
          expense_item_name: row.expense_item_name || '',
        };
      }

      if (row.department_name) allDepartments.add(row.department_name);
      if (row.budget_category) allBudgetCategories.add(row.budget_category);
      if (row.expense_item_code) {
        allExpenseItems[row.expense_item_code] = row.expense_item_name || row.expense_item_code;
      }
    }
  }

  // Step 2: Process detail rows to build item-level data
  // Each unique (management_no, item_no, fiscal_period) = one budget item
  // with monthly breakdown for plan/forecast/actual
  const itemIndex = {};
  const items = [];
  const allYearMonths = new Set();

  if (store.detail) {
    for (const row of store.detail) {
      const mno = row.management_no || '';
      const ino = row.item_no || '';
      const fp = row.fiscal_period || '';
      const ym = row.target_year_month || '';
      const vtype = (row.value_type || '').toLowerCase();
      const amount = toNum(row.amount);

      if (!mno || !ym) continue;
      if (!['plan', 'forecast', 'actual'].includes(vtype)) continue;

      allYearMonths.add(ym);
      if (fp) allPeriods.add(fp);

      const itemKey = `${mno}|${ino}|${fp}`;

      if (!itemIndex[itemKey]) {
        const masterKey = `${mno}|${ino}`;
        const masterRow = masterMap[masterKey] || {};

        const syscode = row.system_code || masterRow.system_code || '';
        const sysInfo = allSystems[syscode] || {};

        itemIndex[itemKey] = {
          management_no: mno,
          item_no: ino,
          fiscal_period: fp,
          fiscal_period_label: periodLabel(fp),
          fiscal_year: periodFY(fp),

          // From master
          budget_category: masterRow.budget_category || '',
          project_name: masterRow.project_name || '',
          department_name: masterRow.department_name || '',
          owner_name: masterRow.owner_name || '',
          payee_name: masterRow.payee_name || '',
          contract_no: masterRow.contract_no || '',
          contract_amount: toNum(masterRow.contract_amount),
          monthly_amount: toNum(masterRow.monthly_amount),
          payment_category: masterRow.payment_category || '',
          fixed_variable_type: masterRow.fixed_variable_type || '',

          // System info
          system_code: syscode,
          system_name: sysInfo.name || masterRow.system_name || syscode,
          system_classification: sysInfo.classification || masterRow.system_classification_name || '',
          expense_item_code: row.expense_item_code || masterRow.expense_item_code || '',
          expense_item_name: sysInfo.expense_item_name || masterRow.expense_item_name || '',

          // Monthly data: { ym: { plan, forecast, actual } }
          monthly: {},
          // Totals
          totalPlan: 0,
          totalForecast: 0,
          totalActual: 0,
        };
        items.push(itemIndex[itemKey]);
      }

      const item = itemIndex[itemKey];
      if (!item.monthly[ym]) {
        item.monthly[ym] = { plan: 0, forecast: 0, actual: 0 };
      }
      item.monthly[ym][vtype] += amount;
    }
  }

  // If only master uploaded (no detail), create items from master contract data
  if (store.master && !store.detail) {
    for (const row of store.master) {
      const mno = row.management_no || '';
      const ino = row.item_no || '';
      const fp = row.period || '';
      if (!mno) continue;

      const itemKey = `${mno}|${ino}|${fp}`;
      if (itemIndex[itemKey]) continue; // already exists

      const syscode = row.system_code || '';
      const sysInfo = allSystems[syscode] || {};

      itemIndex[itemKey] = {
        management_no: mno,
        item_no: ino,
        fiscal_period: fp,
        fiscal_period_label: periodLabel(fp),
        fiscal_year: periodFY(fp),
        budget_category: row.budget_category || '',
        project_name: row.project_name || '',
        department_name: row.department_name || '',
        owner_name: row.owner_name || '',
        payee_name: row.payee_name || '',
        contract_no: row.contract_no || '',
        contract_amount: toNum(row.contract_amount),
        monthly_amount: toNum(row.monthly_amount),
        payment_category: row.payment_category || '',
        fixed_variable_type: row.fixed_variable_type || '',
        system_code: syscode,
        system_name: sysInfo.name || row.system_name || syscode,
        system_classification: sysInfo.classification || row.system_classification_name || '',
        expense_item_code: row.expense_item_code || '',
        expense_item_name: sysInfo.expense_item_name || row.expense_item_name || '',
        monthly: {},
        totalPlan: toNum(row.contract_amount),
        totalForecast: toNum(row.contract_amount),
        totalActual: 0,
      };
      items.push(itemIndex[itemKey]);
    }
  }

  // Step 3: Calculate totals for each item
  for (const item of items) {
    let tp = 0, tf = 0, ta = 0;
    for (const ym of Object.keys(item.monthly)) {
      tp += item.monthly[ym].plan;
      tf += item.monthly[ym].forecast;
      ta += item.monthly[ym].actual;
    }
    item.totalPlan = tp;
    item.totalForecast = tf;
    item.totalActual = ta;
  }

  // Sort year_months
  const sortedYMs = [...allYearMonths].sort();

  return {
    items,
    sortedYMs,
    periods: [...allPeriods].sort(),
    systems: allSystems,
    departments: [...allDepartments],
    budgetCategories: [...allBudgetCategories],
    expenseItems: allExpenseItems,
  };
}

// =============================================
// Aggregation
// =============================================
function getAggregations(data) {
  if (!data || !data.items || data.items.length === 0) return null;

  const { items, sortedYMs, periods, systems } = data;

  // Unique values
  const systemNames = [...new Set(items.map(i => i.system_name))].filter(Boolean);
  const classifications = [...new Set(items.map(i => i.system_classification))].filter(Boolean);
  const departments = [...new Set(items.map(i => i.department_name))].filter(Boolean);
  const budgetCategories = [...new Set(items.map(i => i.budget_category))].filter(Boolean);
  const expenseItemNames = [...new Set(items.map(i => i.expense_item_name))].filter(Boolean);
  const fixedVariableTypes = [...new Set(items.map(i => i.fixed_variable_type))].filter(Boolean);

  // KPI
  const totalPlan = items.reduce((s, i) => s + i.totalPlan, 0);
  const totalForecast = items.reduce((s, i) => s + i.totalForecast, 0);
  const totalActual = items.reduce((s, i) => s + i.totalActual, 0);

  // Monthly aggregation by type (across all items)
  const monthlyByType = {};
  for (const ym of sortedYMs) {
    monthlyByType[ym] = { plan: 0, forecast: 0, actual: 0 };
    for (const item of items) {
      if (item.monthly[ym]) {
        monthlyByType[ym].plan += item.monthly[ym].plan;
        monthlyByType[ym].forecast += item.monthly[ym].forecast;
        monthlyByType[ym].actual += item.monthly[ym].actual;
      }
    }
  }

  // By system_name
  const bySystem = {};
  for (const item of items) {
    const key = item.system_name || item.system_code || '不明';
    if (!bySystem[key]) bySystem[key] = { name: key, code: item.system_code, classification: item.system_classification, plan: 0, forecast: 0, actual: 0, itemCount: 0 };
    bySystem[key].plan += item.totalPlan;
    bySystem[key].forecast += item.totalForecast;
    bySystem[key].actual += item.totalActual;
    bySystem[key].itemCount++;
  }

  // By system_classification
  const byClassification = {};
  for (const item of items) {
    const key = item.system_classification || 'その他';
    if (!byClassification[key]) byClassification[key] = { name: key, plan: 0, forecast: 0, actual: 0, itemCount: 0 };
    byClassification[key].plan += item.totalPlan;
    byClassification[key].forecast += item.totalForecast;
    byClassification[key].actual += item.totalActual;
    byClassification[key].itemCount++;
  }

  // By department
  const byDepartment = {};
  for (const item of items) {
    const key = item.department_name || 'その他';
    if (!byDepartment[key]) byDepartment[key] = { name: key, plan: 0, forecast: 0, actual: 0, itemCount: 0 };
    byDepartment[key].plan += item.totalPlan;
    byDepartment[key].forecast += item.totalForecast;
    byDepartment[key].actual += item.totalActual;
    byDepartment[key].itemCount++;
  }

  // By period
  const byPeriod = {};
  for (const item of items) {
    const key = item.fiscal_period || '不明';
    const label = item.fiscal_period_label || key;
    if (!byPeriod[key]) byPeriod[key] = { period: key, label, plan: 0, forecast: 0, actual: 0, itemCount: 0 };
    byPeriod[key].plan += item.totalPlan;
    byPeriod[key].forecast += item.totalForecast;
    byPeriod[key].actual += item.totalActual;
    byPeriod[key].itemCount++;
  }

  // By expense_item_name
  const byExpenseItem = {};
  for (const item of items) {
    const key = item.expense_item_name || 'その他';
    if (!byExpenseItem[key]) byExpenseItem[key] = { name: key, plan: 0, forecast: 0, actual: 0, itemCount: 0 };
    byExpenseItem[key].plan += item.totalPlan;
    byExpenseItem[key].forecast += item.totalForecast;
    byExpenseItem[key].actual += item.totalActual;
    byExpenseItem[key].itemCount++;
  }

  // By fixed_variable_type
  const byFixedVariable = {};
  for (const item of items) {
    const key = item.fixed_variable_type || 'その他';
    if (!byFixedVariable[key]) byFixedVariable[key] = { name: key, plan: 0, forecast: 0, actual: 0, itemCount: 0 };
    byFixedVariable[key].plan += item.totalPlan;
    byFixedVariable[key].forecast += item.totalForecast;
    byFixedVariable[key].actual += item.totalActual;
    byFixedVariable[key].itemCount++;
  }

  // Variance analysis per item
  const variances = items.map(item => {
    const p = item.totalPlan;
    const f = item.totalForecast;
    const a = item.totalActual;
    const varF = p > 0 ? ((f - p) / p * 100) : 0;
    const varA = p > 0 ? ((a - p) / p * 100) : 0;
    return {
      management_no: item.management_no,
      item_no: item.item_no,
      fiscal_period: item.fiscal_period,
      fiscal_period_label: item.fiscal_period_label,
      system_name: item.system_name,
      system_classification: item.system_classification,
      department_name: item.department_name,
      project_name: item.project_name,
      expense_item_name: item.expense_item_name,
      plan: p,
      forecast: f,
      actual: a,
      variance_forecast: Math.round(varF * 10) / 10,
      variance_actual: Math.round(varA * 10) / 10,
      overrun_forecast: f > p,
      overrun_actual: a > p && a > 0,
    };
  });

  // Cross-tab: system x period
  const crossTabSysPeriod = {};
  for (const item of items) {
    const sys = item.system_name || item.system_code || '不明';
    const per = item.fiscal_period || '不明';
    if (!crossTabSysPeriod[sys]) crossTabSysPeriod[sys] = {};
    if (!crossTabSysPeriod[sys][per]) crossTabSysPeriod[sys][per] = { plan: 0, forecast: 0, actual: 0 };
    crossTabSysPeriod[sys][per].plan += item.totalPlan;
    crossTabSysPeriod[sys][per].forecast += item.totalForecast;
    crossTabSysPeriod[sys][per].actual += item.totalActual;
  }

  // Cross-tab: system x classification (for the old "system x category" view)
  const crossTabSysClassification = {};
  for (const item of items) {
    const sys = item.system_name || item.system_code || '不明';
    const cls = item.system_classification || 'その他';
    if (!crossTabSysClassification[sys]) crossTabSysClassification[sys] = {};
    if (!crossTabSysClassification[sys][cls]) crossTabSysClassification[sys][cls] = { plan: 0, forecast: 0, actual: 0 };
    crossTabSysClassification[sys][cls].plan += item.totalPlan;
    crossTabSysClassification[sys][cls].forecast += item.totalForecast;
    crossTabSysClassification[sys][cls].actual += item.totalActual;
  }

  return {
    systemNames,
    classifications,
    departments,
    budgetCategories,
    expenseItemNames,
    fixedVariableTypes,
    periods,
    sortedYMs,
    totalPlan,
    totalForecast,
    totalActual,
    monthlyByType,
    bySystem: Object.values(bySystem).sort((a, b) => b.plan - a.plan),
    byClassification: Object.values(byClassification).sort((a, b) => b.plan - a.plan),
    byDepartment: Object.values(byDepartment).sort((a, b) => b.plan - a.plan),
    byPeriod: Object.values(byPeriod).sort((a, b) => a.period - b.period),
    byExpenseItem: Object.values(byExpenseItem).sort((a, b) => b.plan - a.plan),
    byFixedVariable: Object.values(byFixedVariable).sort((a, b) => b.plan - a.plan),
    variances: variances.sort((a, b) => Math.abs(b.variance_actual) - Math.abs(a.variance_actual)),
    crossTabSysPeriod,
    crossTabSysClassification,
    itemCount: items.length,
  };
}

// =============================================
// API Routes
// =============================================

// Upload CSV files (budget_master and/or budget_detail)
app.post('/api/upload', upload.fields([
  { name: 'budget_master', maxCount: 1 },
  { name: 'budget_detail', maxCount: 1 }
]), (req, res) => {
  try {
    let masterCount = 0, detailCount = 0;

    if (req.files['budget_master'] && req.files['budget_master'][0]) {
      const buf = req.files['budget_master'][0].buffer;
      const text = buf.toString('utf-8').replace(/^\uFEFF/, '');
      store.master = parseCSV(text);
      store.masterFileName = req.files['budget_master'][0].originalname;
      masterCount = store.master.length;
    }

    if (req.files['budget_detail'] && req.files['budget_detail'][0]) {
      const buf = req.files['budget_detail'][0].buffer;
      const text = buf.toString('utf-8').replace(/^\uFEFF/, '');
      store.detail = parseCSV(text);
      store.detailFileName = req.files['budget_detail'][0].originalname;
      detailCount = store.detail.length;
    }

    if (!store.master && !store.detail) {
      return res.status(400).json({ error: 'budget_master または budget_detail の少なくとも1つをアップロードしてください' });
    }

    store.uploadedAt = new Date().toISOString();

    const data = buildUnifiedData();
    const agg = data ? getAggregations(data) : null;

    res.json({
      message: 'アップロード完了',
      masterFileName: store.masterFileName,
      detailFileName: store.detailFileName,
      masterRows: masterCount,
      detailRows: detailCount,
      itemCount: data ? data.items.length : 0,
      systemCount: agg ? agg.systemNames.length : 0,
      periodCount: agg ? agg.periods.length : 0,
      classificationCount: agg ? agg.classifications.length : 0,
    });
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ error: 'CSV解析エラー: ' + e.message });
  }
});

// Status
app.get('/api/status', (_, res) => {
  const data = buildUnifiedData();
  const agg = data ? getAggregations(data) : null;
  res.json({
    hasData: !!(store.master || store.detail),
    masterFileName: store.masterFileName,
    detailFileName: store.detailFileName,
    uploadedAt: store.uploadedAt,
    itemCount: data ? data.items.length : 0,
    systemCount: agg ? agg.systemNames.length : 0,
    periodCount: agg ? agg.periods.length : 0,
    classificationCount: agg ? agg.classifications.length : 0,
    departmentCount: agg ? agg.departments.length : 0,
    systems: agg ? agg.systemNames : [],
    classifications: agg ? agg.classifications : [],
    departments: agg ? agg.departments : [],
    periods: agg ? agg.periods : [],
    expenseItems: agg ? agg.expenseItemNames : [],
    sortedYMs: data ? data.sortedYMs : [],
  });
});

// Dashboard summary
app.get('/api/dashboard/summary', (_, res) => {
  const data = buildUnifiedData();
  if (!data || data.items.length === 0) return res.json({ kpi: null });
  const agg = getAggregations(data);

  res.json({
    masterFileName: store.masterFileName,
    detailFileName: store.detailFileName,
    kpi: {
      totalPlan: agg.totalPlan,
      totalForecast: agg.totalForecast,
      totalActual: agg.totalActual,
      itemCount: agg.itemCount,
      systemCount: agg.systemNames.length,
      classificationCount: agg.classifications.length,
      departmentCount: agg.departments.length,
      periodCount: agg.periods.length,
      varianceForecastPct: agg.totalPlan > 0 ? Math.round((agg.totalForecast - agg.totalPlan) / agg.totalPlan * 1000) / 10 : 0,
      varianceActualPct: agg.totalPlan > 0 ? Math.round((agg.totalActual - agg.totalPlan) / agg.totalPlan * 1000) / 10 : 0,
    },
    sortedYMs: data.sortedYMs,
    monthlyByType: agg.monthlyByType,
    bySystem: agg.bySystem,
    byClassification: agg.byClassification,
    byDepartment: agg.byDepartment,
    byPeriod: agg.byPeriod,
    byExpenseItem: agg.byExpenseItem,
    byFixedVariable: agg.byFixedVariable,
    overrunItems: agg.variances.filter(v => v.overrun_actual || v.overrun_forecast).slice(0, 15),
  });
});

// Items list with filters
app.get('/api/items', (req, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ items: [], total: 0 });

  let filtered = data.items;
  const { system, classification, department, period, search } = req.query;
  if (system) filtered = filtered.filter(i => i.system_name === system || i.system_code === system);
  if (classification) filtered = filtered.filter(i => i.system_classification === classification);
  if (department) filtered = filtered.filter(i => i.department_name === department);
  if (period) filtered = filtered.filter(i => i.fiscal_period === period);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(i =>
      (i.system_name || '').toLowerCase().includes(q) ||
      (i.project_name || '').toLowerCase().includes(q) ||
      (i.expense_item_name || '').toLowerCase().includes(q) ||
      (i.department_name || '').toLowerCase().includes(q) ||
      (i.payee_name || '').toLowerCase().includes(q) ||
      (i.management_no || '').toLowerCase().includes(q)
    );
  }
  res.json({ items: filtered, total: filtered.length, sortedYMs: data.sortedYMs });
});

// Analysis: by system
app.get('/api/analysis/by-system', (_, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ data: [] });
  const agg = getAggregations(data);
  res.json({ data: agg.bySystem });
});

// Analysis: by classification
app.get('/api/analysis/by-classification', (_, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ data: [] });
  const agg = getAggregations(data);
  res.json({ data: agg.byClassification });
});

// Analysis: by department
app.get('/api/analysis/by-department', (_, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ data: [] });
  const agg = getAggregations(data);
  res.json({ data: agg.byDepartment });
});

// Analysis: by period
app.get('/api/analysis/by-period', (_, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ data: [] });
  const agg = getAggregations(data);
  res.json({ data: agg.byPeriod });
});

// Analysis: by expense item
app.get('/api/analysis/by-expense-item', (_, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ data: [] });
  const agg = getAggregations(data);
  res.json({ data: agg.byExpenseItem });
});

// Analysis: by fixed/variable
app.get('/api/analysis/by-fixed-variable', (_, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ data: [] });
  const agg = getAggregations(data);
  res.json({ data: agg.byFixedVariable });
});

// Analysis: monthly time-series
app.get('/api/analysis/monthly', (_, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ data: null, sortedYMs: [] });
  const agg = getAggregations(data);
  res.json({ data: agg.monthlyByType, sortedYMs: data.sortedYMs });
});

// Analysis: variances (overruns/shortfalls)
app.get('/api/analysis/variances', (_, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ data: [] });
  const agg = getAggregations(data);
  res.json({ data: agg.variances });
});

// Analysis: cross-tab (system x period)
app.get('/api/analysis/cross-tab', (_, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ data: {}, systems: [], periods: [] });
  const agg = getAggregations(data);
  res.json({
    data: agg.crossTabSysPeriod,
    systems: agg.systemNames,
    periods: agg.periods,
  });
});

// Analysis: system detail (monthly breakdown per system)
app.get('/api/analysis/system-detail', (req, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ data: null });
  const { system } = req.query;
  if (!system) return res.json({ data: null });

  const sysItems = data.items.filter(i => i.system_name === system || i.system_code === system);
  if (sysItems.length === 0) return res.json({ data: null });

  // Aggregate monthly for this system
  const monthlyByType = {};
  for (const ym of data.sortedYMs) {
    monthlyByType[ym] = { plan: 0, forecast: 0, actual: 0 };
    for (const item of sysItems) {
      if (item.monthly[ym]) {
        monthlyByType[ym].plan += item.monthly[ym].plan;
        monthlyByType[ym].forecast += item.monthly[ym].forecast;
        monthlyByType[ym].actual += item.monthly[ym].actual;
      }
    }
  }
  // Filter out months with no data for this system
  const sysYMs = data.sortedYMs.filter(ym =>
    monthlyByType[ym].plan > 0 || monthlyByType[ym].forecast > 0 || monthlyByType[ym].actual > 0
  );

  // By period
  const byPeriod = {};
  for (const item of sysItems) {
    const p = item.fiscal_period || '不明';
    if (!byPeriod[p]) byPeriod[p] = { period: p, label: item.fiscal_period_label, plan: 0, forecast: 0, actual: 0 };
    byPeriod[p].plan += item.totalPlan;
    byPeriod[p].forecast += item.totalForecast;
    byPeriod[p].actual += item.totalActual;
  }

  res.json({
    data: {
      system,
      itemCount: sysItems.length,
      totalPlan: sysItems.reduce((s, i) => s + i.totalPlan, 0),
      totalForecast: sysItems.reduce((s, i) => s + i.totalForecast, 0),
      totalActual: sysItems.reduce((s, i) => s + i.totalActual, 0),
      monthlyByType,
      sortedYMs: sysYMs,
      byPeriod: Object.values(byPeriod).sort((a, b) => a.period - b.period),
      items: sysItems,
    }
  });
});

// Clear data
app.post('/api/clear', (_, res) => {
  store = { master: null, detail: null, uploadedAt: null, masterFileName: null, detailFileName: null };
  res.json({ message: 'データをクリアしました' });
});

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// =============================================
// Serve HTML
// =============================================
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Fallback SPA
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, 'public', req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return res.sendFile(filePath);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// =============================================
// Auto-load sample CSVs on startup
// =============================================
function autoLoadSampleData() {
  try {
    const masterPath = path.join(__dirname, 'public', 'static', 'sample_budget_master.csv');
    const detailPath = path.join(__dirname, 'public', 'static', 'sample_budget_detail.csv');

    if (fs.existsSync(masterPath)) {
      const text = fs.readFileSync(masterPath, 'utf-8').replace(/^\uFEFF/, '');
      store.master = parseCSV(text);
      store.masterFileName = 'sample_budget_master.csv';
      console.log(`  [Auto-load] budget_master: ${store.master.length} rows`);
    }
    if (fs.existsSync(detailPath)) {
      const text = fs.readFileSync(detailPath, 'utf-8').replace(/^\uFEFF/, '');
      store.detail = parseCSV(text);
      store.detailFileName = 'sample_budget_detail.csv';
      console.log(`  [Auto-load] budget_detail: ${store.detail.length} rows`);
    }

    if (store.master || store.detail) {
      store.uploadedAt = new Date().toISOString();
      const data = buildUnifiedData();
      const agg = data ? getAggregations(data) : null;
      console.log(`  [Auto-load] ${data ? data.items.length : 0} items, ${agg ? agg.systemNames.length : 0} systems, ${agg ? agg.periods.length : 0} periods`);
    }
  } catch (e) {
    console.error('  [Auto-load] Failed:', e.message);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Budget CSV Viewer v4.0`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://0.0.0.0:${PORT}`);
  autoLoadSampleData();
  console.log(`  Status:  Ready\n`);
});
