const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const APP_DATA_DIR = process.env.BUDGET_CSV_VIEWER_DATA_DIR || path.join(os.homedir(), '.budget-csv-viewer');
const STORE_FILE = process.env.BUDGET_CSV_VIEWER_STORE_FILE || path.join(APP_DATA_DIR, 'store.json');

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
// Local data store
// =============================================
function emptyStore() {
  return {
    master: null,       // normalized master-like rows derived from unified CSV
    detail: null,       // normalized detail-like rows derived from unified CSV
    rawRows: null,      // parsed unified CSV rows (as-is view for items screen)
    uploadedAt: null,
    csvFileName: null,
    varianceReasons: {},   // key: management_no|item_no|fiscal_period|target_year_month
    initiatives: {},       // key: initiative_id
    contracts: {},         // key: contract_id
  };
}

let store = emptyStore();

function normalizeStore(candidate) {
  return {
    ...emptyStore(),
    ...(candidate && typeof candidate === 'object' ? candidate : {}),
    varianceReasons: candidate?.varianceReasons && typeof candidate.varianceReasons === 'object' ? candidate.varianceReasons : {},
    initiatives: candidate?.initiatives && typeof candidate.initiatives === 'object' ? candidate.initiatives : {},
    contracts: candidate?.contracts && typeof candidate.contracts === 'object' ? candidate.contracts : {},
  };
}

function persistStore() {
  try {
    fs.mkdirSync(APP_DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(store), 'utf8');
  } catch (error) {
    console.error('  [Store] Failed to persist local data:', error.message);
  }
}

function loadStoreFromDisk() {
  if (!fs.existsSync(STORE_FILE)) return false;

  try {
    const saved = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    store = normalizeStore(saved);
    console.log(`  [Store] Loaded local data from ${STORE_FILE}`);
    return true;
  } catch (error) {
    console.error('  [Store] Failed to load local data:', error.message);
    store = emptyStore();
    return false;
  }
}

// =============================================
// CSV Parsing
// =============================================
function parseCSV(text) {
  const normalized = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized.trim()) return [];

  const delimiter = detectDelimiter(readFirstCSVRecord(normalized));
  const records = parseCSVRecords(normalized, delimiter);
  if (records.length < 2) return [];

  const headers = records[0].map(h => h.trim());
  return records.slice(1)
    .filter(values => values.some(v => String(v || '').trim() !== ''))
    .map((values) => {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = String(values[idx] ?? '').trim();
      });
      return row;
    });
}

function readFirstCSVRecord(text) {
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === '\n' && !inQuotes) {
      return text.slice(0, i);
    }
  }
  return text;
}

function detectDelimiter(headerLine) {
  const commaCount = countDelimiterOutsideQuotes(headerLine, ',');
  const tabCount = countDelimiterOutsideQuotes(headerLine, '\t');
  return tabCount > commaCount ? '\t' : ',';
}

function countDelimiterOutsideQuotes(text, delimiter) {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      count++;
    }
  }
  return count;
}

function parseCSVLine(line, delimiter = ',') {
  return parseCSVRecords(String(line || ''), delimiter)[0] || [];
}

function parseCSVRecords(text, delimiter = ',') {
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (ch === delimiter) {
      record.push(field);
      field = '';
      fieldStarted = false;
    } else if (ch === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      fieldStarted = false;
    } else {
      field += ch;
      fieldStarted = true;
    }
  }

  if (field.length || fieldStarted || record.length) {
    record.push(field);
    records.push(record);
  }

  return records;
}

const COLUMN_ALIASES = {
  period: ['期', '会計期', '年度期'],
  management_no: ['管理番号', '管理番号（統合）', '管理No', '管理NO', '管理No.', 'management_no'],
  item_no: ['項番', '明細番号', 'item_no'],
  budget_category: ['予算区分', '経費区分', 'budget_category'],
  expense_classification: ['経費区分', 'expense_classification'],
  project_name: ['案件名', 'プロジェクト名', '件名', 'project_name'],
  department_name: ['部署名', '部門名', 'department_name'],
  owner_name: ['担当者', '担当者名', 'owner_name'],
  payee_name: ['支払先', 'ベンダー名', '取引先', 'payee_name', 'vendor_name'],
  contract_no: ['契約番号', '契約No', '契約NO', 'contract_no'],
  contract_amount: ['契約金額', 'contract_amount'],
  monthly_amount: ['月額', 'monthly_amount'],
  payment_category: ['支払区分', 'payment_category'],
  fixed_variable_type: ['固定変動', '固定/変動', 'fixed_variable_type'],
  expense_item_code: ['経費事象コード', '費目コード', 'expense_item_code'],
  system_code: ['経費事象コード', 'システムコード', 'system_code'],
  system_name: ['システム名', 'system_name'],
  expense_item_name: ['経費事象名', '費目名', 'expense_item_name'],
  system_classification_name: ['システム分類名', 'システム分類', 'system_classification_name'],
  variance_reason: ['差額理由', '差異理由', '増減理由', 'variance_reason'],
  variance_reason_category: ['差額理由分類', '差異理由分類', '理由分類', 'reason_category', 'variance_reason_category'],
  comment: ['コメント', '備考', 'comment'],
  comment_updated_month: ['コメント更新月', '更新月', 'comment_updated_month'],
  comment_updated_by: ['コメント更新者', '更新者', 'comment_updated_by'],
};

const VARIANCE_REASON_CATEGORIES = [
  '未分類',
  '時期差',
  '数量差',
  '単価差',
  'スコープ変更',
  '契約変更',
  '為替影響',
  '予算超過',
  '予算未消化',
  'その他',
];

function pickColumn(row, logicalName, defaultValue = '') {
  if (!row || typeof row !== 'object') return defaultValue;
  const candidates = COLUMN_ALIASES[logicalName] || [logicalName];

  for (const columnName of candidates) {
    if (!Object.prototype.hasOwnProperty.call(row, columnName)) continue;
    const value = row[columnName];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text !== '') return text;
  }

  return defaultValue;
}

function normalizeVarianceReasonCategory(value) {
  const text = String(value || '').trim();
  return VARIANCE_REASON_CATEGORIES.includes(text) ? text : '未分類';
}

function pickVarianceReasonFields(row) {
  return {
    variance_reason: pickColumn(row, 'variance_reason'),
    variance_reason_category: normalizeVarianceReasonCategory(pickColumn(row, 'variance_reason_category')),
    comment: pickColumn(row, 'comment'),
    comment_updated_month: pickColumn(row, 'comment_updated_month'),
    comment_updated_by: pickColumn(row, 'comment_updated_by'),
  };
}

function mergeVarianceReasons(items, varianceReasonRows) {
  if (!Array.isArray(items)) return [];
  if (!Array.isArray(varianceReasonRows) || varianceReasonRows.length === 0) {
    return items.map(item => ({
      ...item,
      variance_reason_category: normalizeVarianceReasonCategory(item?.variance_reason_category),
    }));
  }

  const reasonByManagementNo = {};
  for (const row of varianceReasonRows) {
    const managementNo = pickColumn(row, 'management_no');
    if (!managementNo) continue;

    const rawCategory = pickColumn(row, 'variance_reason_category');
    reasonByManagementNo[managementNo] = {
      ...pickVarianceReasonFields(row),
      has_variance_reason_category: rawCategory !== '',
    };
  }

  return items.map((item) => {
    const managementNo = item?.management_no || '';
    const reason = reasonByManagementNo[managementNo] || {};
    const merged = { ...item };

    for (const field of ['variance_reason', 'comment', 'comment_updated_month', 'comment_updated_by']) {
      merged[field] = reason[field] || merged[field] || '';
    }
    merged.variance_reason_category = normalizeVarianceReasonCategory(
      reason.has_variance_reason_category
        ? reason.variance_reason_category
        : merged.variance_reason_category,
    );

    return merged;
  });
}

function parseUnifiedBudgetLayout(rows) {
  const master = [];
  const detail = [];
  if (!rows || rows.length === 0) return { master, detail };

  const monthPattern = /^(\d+)期(\d{1,2})月(計画|見込)$/;

  for (const row of rows) {
    const managementNo = pickColumn(row, 'management_no');
    const itemNo = pickColumn(row, 'item_no', '1');
    if (!managementNo) continue;

    const varianceReasonFields = pickVarianceReasonFields(row);
    const expenseItemCode = pickColumn(row, 'expense_item_code');
    const systemCode = pickColumn(row, 'system_code');

    master.push({
      period: pickColumn(row, 'period'),
      management_no: managementNo,
      item_no: itemNo,
      budget_category: pickColumn(row, 'budget_category'),
      expense_classification: pickColumn(row, 'expense_classification'),
      project_name: pickColumn(row, 'project_name'),
      department_name: pickColumn(row, 'department_name'),
      owner_name: pickColumn(row, 'owner_name'),
      payee_name: pickColumn(row, 'payee_name'),
      contract_no: pickColumn(row, 'contract_no'),
      contract_amount: pickColumn(row, 'contract_amount', '0'),
      monthly_amount: pickColumn(row, 'monthly_amount', '0'),
      payment_category: pickColumn(row, 'payment_category'),
      fixed_variable_type: pickColumn(row, 'fixed_variable_type'),
      system_code: systemCode,
      system_name: pickColumn(row, 'system_name'),
      expense_item_code: expenseItemCode,
      expense_item_name: pickColumn(row, 'expense_item_name'),
      system_classification_name: pickColumn(row, 'system_classification_name'),
      ...varianceReasonFields,
    });

    for (const [key, rawAmount] of Object.entries(row)) {
      const match = key.match(monthPattern);
      if (!match) continue;
      const period = match[1];
      const month = Number(match[2]);
      const typeLabel = match[3];
      const valueType = typeLabel === '計画' ? 'plan' : 'forecast';
      const amountText = String(rawAmount || '').trim();
      if (!amountText) continue;

      const fiscalYear = 1960 + Number(period);
      if (!Number.isFinite(fiscalYear) || month < 1 || month > 12) continue;
      const calendarYear = month <= 3 ? fiscalYear + 1 : fiscalYear;
      const ym = `${calendarYear}${String(month).padStart(2, '0')}`;

      detail.push({
        management_no: managementNo,
        item_no: itemNo,
        expense_item_code: expenseItemCode,
        system_code: systemCode,
        fiscal_period: String(period),
        target_year_month: ym,
        value_type: valueType,
        amount: amountText,
        ...varianceReasonFields,
      });
    }
  }

  return { master, detail };
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
  // period 65 = FY2025, period 66 = FY2026, ... period 70 = FY2030
  if (n >= 60 && n <= 99) {
    const baseYear = 1960 + n;
    return `第${n}期 (FY${baseYear})`;
  }
  return `第${n}期`;
}

function periodFY(p) {
  const n = toNum(p);
  if (n >= 60 && n <= 99) return 1960 + n;
  return n;
}

function makeItemKey(managementNo, itemNo, fiscalPeriod, targetYm = '') {
  return `${managementNo || ''}|${itemNo || ''}|${fiscalPeriod || ''}|${targetYm || ''}`;
}

function getCurrentYYYYMM() {
  const now = new Date();
  return Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);
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
          item_key: makeItemKey(mno, ino, fp),
          fiscal_period_label: periodLabel(fp),
          fiscal_year: periodFY(fp),

          // From master
          budget_category: masterRow.budget_category || '',
          expense_classification: masterRow.expense_classification || '',
          project_name: masterRow.project_name || '',
          department_name: masterRow.department_name || '',
          owner_name: masterRow.owner_name || '',
          payee_name: masterRow.payee_name || '',
          vendor_name: masterRow.payee_name || '未設定ベンダー',
          contract_no: masterRow.contract_no || '',
          contract_amount: toNum(masterRow.contract_amount),
          monthly_amount: toNum(masterRow.monthly_amount),
          payment_category: masterRow.payment_category || '',
          fixed_variable_type: masterRow.fixed_variable_type || '',

          // System info
          system_code: syscode,
          // NOTE:
          // 同一 system_code に複数分類がぶら下がるケースがあるため、
          // 代表化済みsysInfoよりも「行自身の値」を優先して保持する。
          system_name: masterRow.system_name || sysInfo.name || syscode,
          system_classification: masterRow.system_classification_name || sysInfo.classification || '',
          expense_item_code: row.expense_item_code || masterRow.expense_item_code || '',
          expense_item_name: sysInfo.expense_item_name || masterRow.expense_item_name || '',
          variance_reason: masterRow.variance_reason || row.variance_reason || '',
          variance_reason_category: normalizeVarianceReasonCategory(masterRow.variance_reason_category || row.variance_reason_category),
          comment: masterRow.comment || row.comment || '',
          comment_updated_month: masterRow.comment_updated_month || row.comment_updated_month || '',
          comment_updated_by: masterRow.comment_updated_by || row.comment_updated_by || '',

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
        item_key: makeItemKey(mno, ino, fp),
        fiscal_period_label: periodLabel(fp),
        fiscal_year: periodFY(fp),
        budget_category: row.budget_category || '',
        expense_classification: row.expense_classification || '',
        project_name: row.project_name || '',
        department_name: row.department_name || '',
        owner_name: row.owner_name || '',
        payee_name: row.payee_name || '',
        vendor_name: row.payee_name || '未設定ベンダー',
        contract_no: row.contract_no || '',
        contract_amount: toNum(row.contract_amount),
        monthly_amount: toNum(row.monthly_amount),
        payment_category: row.payment_category || '',
        fixed_variable_type: row.fixed_variable_type || '',
        system_code: syscode,
        // NOTE:
        // 同一 system_code 内で分類が混在するケースに備え、
        // 代表値ではなく行自身のシステム名/分類を優先する。
        system_name: row.system_name || sysInfo.name || syscode,
        system_classification: row.system_classification_name || sysInfo.classification || '',
        expense_item_code: row.expense_item_code || '',
        expense_item_name: sysInfo.expense_item_name || row.expense_item_name || '',
        variance_reason: row.variance_reason || '',
        variance_reason_category: normalizeVarianceReasonCategory(row.variance_reason_category),
        comment: row.comment || '',
        comment_updated_month: row.comment_updated_month || '',
        comment_updated_by: row.comment_updated_by || '',
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

  // By vendor
  const byVendor = {};
  for (const item of items) {
    const key = item.vendor_name || item.payee_name || '未設定ベンダー';
    if (!byVendor[key]) byVendor[key] = { name: key, plan: 0, forecast: 0, actual: 0, itemCount: 0 };
    byVendor[key].plan += item.totalPlan;
    byVendor[key].forecast += item.totalForecast;
    byVendor[key].actual += item.totalActual;
    byVendor[key].itemCount++;
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

  // YoY monthly summary (actual/plan/forecast)
  const yoyMonthly = {};
  for (const ym of sortedYMs) {
    const parsed = parseYM(ym);
    if (!parsed) continue;
    const prevYm = `${parsed.year - 1}${String(parsed.month).padStart(2, '0')}`;
    const curr = monthlyByType[ym] || { plan: 0, forecast: 0, actual: 0 };
    const prev = monthlyByType[prevYm] || { plan: 0, forecast: 0, actual: 0 };
    yoyMonthly[ym] = {
      yearMonth: ym,
      prevYearMonth: prevYm,
      plan: curr.plan,
      forecast: curr.forecast,
      actual: curr.actual,
      prevPlan: prev.plan,
      prevForecast: prev.forecast,
      prevActual: prev.actual,
      deltaPlan: curr.plan - prev.plan,
      deltaForecast: curr.forecast - prev.forecast,
      deltaActual: curr.actual - prev.actual,
      deltaActualPct: prev.actual > 0 ? ((curr.actual - prev.actual) / prev.actual) * 100 : 0,
    };
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
    byVendor: Object.values(byVendor).sort((a, b) => b.plan - a.plan),
    byPeriod: Object.values(byPeriod).sort((a, b) => a.period - b.period),
    byExpenseItem: Object.values(byExpenseItem).sort((a, b) => b.plan - a.plan),
    byFixedVariable: Object.values(byFixedVariable).sort((a, b) => b.plan - a.plan),
    variances: variances.sort((a, b) => Math.abs(b.variance_actual) - Math.abs(a.variance_actual)),
    crossTabSysPeriod,
    crossTabSysClassification,
    yoyMonthly,
    itemCount: items.length,
  };
}

// =============================================
// API Routes
// =============================================

// Upload unified CSV file
app.post('/api/upload', upload.single('budget_csv'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '統合CSVファイル（budget_csv）をアップロードしてください' });
    }

    const text = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const parsedRows = parseCSV(text);
    const converted = parseUnifiedBudgetLayout(parsedRows);
    store.rawRows = parsedRows;
    store.master = converted.master;
    store.detail = converted.detail;
    store.csvFileName = req.file.originalname;
    store.uploadedAt = new Date().toISOString();

    const data = buildUnifiedData();
    const agg = data ? getAggregations(data) : null;
    store.contracts = {};
    if (data) {
      data.items.filter(i => i.contract_no).forEach((item) => {
        const id = item.contract_no;
        if (store.contracts[id]) return;
        store.contracts[id] = {
          contract_id: id,
          contract_no: item.contract_no,
          vendor_name: item.vendor_name || '未設定ベンダー',
          system_name: item.system_name || '',
          renewal_month: data.sortedYMs[0] || '',
          decision_status: '未判断',
          decision_note: '',
          annual_amount: item.contract_amount || item.totalPlan || 0,
          updated_at: new Date().toISOString(),
        };
      });
    }

    persistStore();

    res.json({
      message: 'アップロード完了',
      csvFileName: store.csvFileName,
      masterRows: store.master ? store.master.length : 0,
      detailRows: store.detail ? store.detail.length : 0,
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
    csvFileName: store.csvFileName,
    uploadedAt: store.uploadedAt,
    itemCount: data ? data.items.length : 0,
    systemCount: agg ? agg.systemNames.length : 0,
    periodCount: agg ? agg.periods.length : 0,
    classificationCount: agg ? agg.classifications.length : 0,
    departmentCount: agg ? agg.departments.length : 0,
    systems: agg ? agg.systemNames : [],
    classifications: agg ? agg.classifications : [],
    departments: agg ? agg.departments : [],
    vendors: agg ? agg.byVendor.map(v => v.name) : [],
    periods: data ? data.periods : [],
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
    csvFileName: store.csvFileName,
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
      yoyActualDelta: Object.values(agg.yoyMonthly).reduce((s, r) => s + r.deltaActual, 0),
    },
    sortedYMs: data.sortedYMs,
    monthlyByType: agg.monthlyByType,
    bySystem: agg.bySystem,
    byClassification: agg.byClassification,
    byDepartment: agg.byDepartment,
    byVendor: agg.byVendor,
    byPeriod: agg.byPeriod,
    byExpenseItem: agg.byExpenseItem,
    byFixedVariable: agg.byFixedVariable,
    yoyMonthly: agg.yoyMonthly,
    overrunItems: agg.variances.filter(v => v.overrun_actual || v.overrun_forecast).slice(0, 15),
  });
});

// Items list with filters
app.get('/api/items', (req, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ items: [], total: 0 });

  let filtered = data.items;
  const { system, classification, department, period, vendor, search } = req.query;
  if (system) filtered = filtered.filter(i => i.system_name === system || i.system_code === system);
  if (classification) filtered = filtered.filter(i => i.system_classification === classification);
  if (department) filtered = filtered.filter(i => i.department_name === department);
  if (period) filtered = filtered.filter(i => i.fiscal_period === period);
  if (vendor) filtered = filtered.filter(i => i.vendor_name === vendor || i.payee_name === vendor);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(i =>
      (i.system_name || '').toLowerCase().includes(q) ||
      (i.project_name || '').toLowerCase().includes(q) ||
      (i.expense_item_name || '').toLowerCase().includes(q) ||
      (i.department_name || '').toLowerCase().includes(q) ||
      (i.payee_name || '').toLowerCase().includes(q) ||
      (i.vendor_name || '').toLowerCase().includes(q) ||
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

// Analysis: by vendor
app.get('/api/analysis/by-vendor', (_, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ data: [] });
  const agg = getAggregations(data);
  res.json({ data: agg.byVendor });
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

// Analysis: YoY (monthly / grouped)
app.get('/api/analysis/yoy', (req, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ monthly: {}, grouped: [] });
  const agg = getAggregations(data);
  const groupBy = (req.query.groupBy || 'system').toString();

  const groupedMap = {};
  for (const item of data.items) {
    const groupName =
      groupBy === 'department'
        ? (item.department_name || 'その他')
        : (item.system_name || item.system_code || '不明');

    if (!groupedMap[groupName]) {
      groupedMap[groupName] = {
        name: groupName,
        currentActual: 0,
        previousActual: 0,
        deltaActual: 0,
        deltaActualPct: 0,
      };
    }

    for (const ym of Object.keys(item.monthly)) {
      const parsed = parseYM(ym);
      if (!parsed) continue;
      const prevYm = `${parsed.year - 1}${String(parsed.month).padStart(2, '0')}`;
      const currActual = item.monthly[ym]?.actual || 0;
      const prevActual = item.monthly[prevYm]?.actual || 0;
      groupedMap[groupName].currentActual += currActual;
      groupedMap[groupName].previousActual += prevActual;
    }
  }

  const grouped = Object.values(groupedMap).map((g) => {
    g.deltaActual = g.currentActual - g.previousActual;
    g.deltaActualPct = g.previousActual > 0 ? (g.deltaActual / g.previousActual) * 100 : 0;
    return g;
  }).sort((a, b) => Math.abs(b.deltaActual) - Math.abs(a.deltaActual));

  res.json({ monthly: agg.yoyMonthly, grouped, groupBy });
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

// Analysis: classification detail (monthly breakdown per classification)
app.get('/api/analysis/classification-detail', (req, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ data: null });
  const { classification } = req.query;
  if (!classification) return res.json({ data: null });

  const clsItems = data.items.filter(i => (i.system_classification || 'その他') === classification);
  if (clsItems.length === 0) return res.json({ data: null });

  const monthlyByType = {};
  for (const ym of data.sortedYMs) {
    monthlyByType[ym] = { plan: 0, forecast: 0, actual: 0 };
    for (const item of clsItems) {
      if (item.monthly[ym]) {
        monthlyByType[ym].plan += item.monthly[ym].plan;
        monthlyByType[ym].forecast += item.monthly[ym].forecast;
        monthlyByType[ym].actual += item.monthly[ym].actual;
      }
    }
  }

  const byPeriod = {};
  for (const item of clsItems) {
    const p = item.fiscal_period || '不明';
    if (!byPeriod[p]) byPeriod[p] = { period: p, label: item.fiscal_period_label, plan: 0, forecast: 0, actual: 0 };
    byPeriod[p].plan += item.totalPlan;
    byPeriod[p].forecast += item.totalForecast;
    byPeriod[p].actual += item.totalActual;
  }

  res.json({
    data: {
      classification,
      itemCount: clsItems.length,
      totalPlan: clsItems.reduce((s, i) => s + i.totalPlan, 0),
      totalForecast: clsItems.reduce((s, i) => s + i.totalForecast, 0),
      totalActual: clsItems.reduce((s, i) => s + i.totalActual, 0),
      monthlyByType,
      sortedYMs: data.sortedYMs,
      byPeriod: Object.values(byPeriod).sort((a, b) => a.period - b.period),
      items: clsItems,
    }
  });
});

// Raw CSV rows for near-original view
app.get('/api/raw-rows', (req, res) => {
  const rows = store.rawRows || [];
  const q = String(req.query.search || '').toLowerCase().trim();
  const filtered = q
    ? rows.filter((r) => Object.values(r || {}).some((v) => String(v || '').toLowerCase().includes(q)))
    : rows;
  const headers = filtered.length > 0 ? Object.keys(filtered[0]) : (rows[0] ? Object.keys(rows[0]) : []);
  res.json({ headers, rows: filtered, total: filtered.length });
});

// Analysis: vendor detail
app.get('/api/analysis/vendor-detail', (req, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ data: null });
  const { vendor } = req.query;
  if (!vendor) return res.json({ data: null });
  const vendorItems = data.items.filter(i => i.vendor_name === vendor || i.payee_name === vendor);
  if (vendorItems.length === 0) return res.json({ data: null });

  const monthlyByType = {};
  for (const ym of data.sortedYMs) {
    monthlyByType[ym] = { plan: 0, forecast: 0, actual: 0 };
    for (const item of vendorItems) {
      if (item.monthly[ym]) {
        monthlyByType[ym].plan += item.monthly[ym].plan;
        monthlyByType[ym].forecast += item.monthly[ym].forecast;
        monthlyByType[ym].actual += item.monthly[ym].actual;
      }
    }
  }

  res.json({
    data: {
      vendor,
      itemCount: vendorItems.length,
      totalPlan: vendorItems.reduce((s, i) => s + i.totalPlan, 0),
      totalForecast: vendorItems.reduce((s, i) => s + i.totalForecast, 0),
      totalActual: vendorItems.reduce((s, i) => s + i.totalActual, 0),
      monthlyByType,
      sortedYMs: data.sortedYMs,
      items: vendorItems,
    }
  });
});

// Variance reason management
app.get('/api/variance-reasons', (req, res) => {
  const { management_no, item_no, fiscal_period, target_year_month } = req.query;
  let rows = Object.values(store.varianceReasons || {});
  if (management_no) rows = rows.filter(r => r.management_no === management_no);
  if (item_no) rows = rows.filter(r => r.item_no === item_no);
  if (fiscal_period) rows = rows.filter(r => r.fiscal_period === fiscal_period);
  if (target_year_month) rows = rows.filter(r => r.target_year_month === target_year_month);
  res.json({ data: rows.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)) });
});

app.post('/api/variance-reasons', (req, res) => {
  const body = req.body || {};
  if (!body.management_no || !body.item_no || !body.fiscal_period || !body.target_year_month) {
    return res.status(400).json({ error: '管理番号・項番・期・月は必須です' });
  }
  const key = makeItemKey(body.management_no, body.item_no, body.fiscal_period, body.target_year_month);
  store.varianceReasons[key] = {
    key,
    management_no: body.management_no,
    item_no: body.item_no,
    fiscal_period: body.fiscal_period,
    target_year_month: body.target_year_month,
    reason_category: body.reason_category || '未分類',
    factor_type: body.factor_type || '未分類',
    comment: body.comment || '',
    updated_at: new Date().toISOString(),
  };
  persistStore();
  res.json({ message: '差額理由を保存しました', data: store.varianceReasons[key] });
});

app.get('/api/variance-reasons/summary', (_, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ missingCount: 0, byCategory: [], totalTargets: 0, registeredCount: 0 });

  const targets = data.items.filter(i => i.totalForecast > i.totalPlan || i.totalActual > i.totalPlan);
  const reasons = Object.values(store.varianceReasons || {});
  const itemKeys = new Set(targets.map(i => i.item_key));
  const withReason = new Set(reasons.map(r => makeItemKey(r.management_no, r.item_no, r.fiscal_period)));
  const registeredCount = [...withReason].filter(k => itemKeys.has(k)).length;
  const byCategoryMap = {};
  reasons.forEach((r) => {
    const cat = r.reason_category || '未分類';
    if (!byCategoryMap[cat]) byCategoryMap[cat] = { category: cat, count: 0 };
    byCategoryMap[cat].count++;
  });

  res.json({
    totalTargets: targets.length,
    registeredCount,
    missingCount: Math.max(targets.length - registeredCount, 0),
    byCategory: Object.values(byCategoryMap).sort((a, b) => b.count - a.count),
  });
});

// Improvement initiatives management
app.get('/api/initiatives', (_, res) => {
  const data = Object.values(store.initiatives || {}).sort((a, b) => (a.deadline || '') > (b.deadline || '') ? 1 : -1);
  res.json({ data });
});

app.post('/api/initiatives', (req, res) => {
  const body = req.body || {};
  if (!body.management_no || !body.item_no || !body.fiscal_period) {
    return res.status(400).json({ error: '管理番号・項番・期は必須です' });
  }
  const initiativeId = body.initiative_id || `ACT-${Date.now()}`;
  store.initiatives[initiativeId] = {
    initiative_id: initiativeId,
    management_no: body.management_no,
    item_no: body.item_no,
    fiscal_period: body.fiscal_period,
    title: body.title || '改善施策',
    status: body.status || '未着手',
    owner: body.owner || '',
    deadline: body.deadline || '',
    expected_reduction: toNum(body.expected_reduction),
    actual_reduction: toNum(body.actual_reduction),
    note: body.note || '',
    updated_at: new Date().toISOString(),
  };
  persistStore();
  res.json({ message: '改善施策を保存しました', data: store.initiatives[initiativeId] });
});

app.get('/api/initiatives/summary', (_, res) => {
  const rows = Object.values(store.initiatives || {});
  const today = new Date().toISOString().substring(0, 10);
  const overdueCount = rows.filter(r => r.deadline && r.deadline < today && r.status !== '完了').length;
  const byStatus = {};
  rows.forEach((r) => {
    const key = r.status || '未着手';
    if (!byStatus[key]) byStatus[key] = { status: key, count: 0 };
    byStatus[key].count++;
  });
  res.json({
    totalCount: rows.length,
    overdueCount,
    totalExpectedReduction: rows.reduce((s, r) => s + toNum(r.expected_reduction), 0),
    totalActualReduction: rows.reduce((s, r) => s + toNum(r.actual_reduction), 0),
    byStatus: Object.values(byStatus).sort((a, b) => b.count - a.count),
  });
});

// Contract renewal support
app.get('/api/contracts', (_, res) => {
  res.json({ data: Object.values(store.contracts || {}) });
});

app.post('/api/contracts', (req, res) => {
  const body = req.body || {};
  if (!body.contract_no) return res.status(400).json({ error: '契約番号は必須です' });
  const id = body.contract_id || body.contract_no;
  store.contracts[id] = {
    contract_id: id,
    contract_no: body.contract_no,
    vendor_name: body.vendor_name || '未設定ベンダー',
    system_name: body.system_name || '',
    renewal_month: body.renewal_month || '',
    decision_status: body.decision_status || '未判断',
    decision_note: body.decision_note || '',
    annual_amount: toNum(body.annual_amount),
    updated_at: new Date().toISOString(),
  };
  persistStore();
  res.json({ message: '契約情報を保存しました', data: store.contracts[id] });
});

app.get('/api/contracts/renewals', (req, res) => {
  const withinMonths = Number(req.query.withinMonths || 3);
  const currentYm = getCurrentYYYYMM();
  const rows = Object.values(store.contracts || {}).filter((c) => {
    const ym = Number(c.renewal_month);
    if (!ym) return false;
    const diff = (Math.floor(ym / 100) - Math.floor(currentYm / 100)) * 12 + (ym % 100) - (currentYm % 100);
    return diff >= 0 && diff <= withinMonths;
  }).sort((a, b) => (a.renewal_month || '').localeCompare(b.renewal_month || ''));
  res.json({ data: rows, currentYm, withinMonths });
});

app.get('/api/contracts/review-candidates', (_, res) => {
  const data = buildUnifiedData();
  if (!data) return res.json({ data: [] });
  const agg = getAggregations(data);
  const vendorVariance = {};
  agg.byVendor.forEach((v) => {
    vendorVariance[v.name] = v.plan > 0 ? ((v.actual - v.plan) / v.plan) * 100 : 0;
  });

  const candidates = Object.values(store.contracts || {}).map((c) => {
    const variancePct = vendorVariance[c.vendor_name] || 0;
    const shouldReview = variancePct > 5 || c.decision_status === '要見直し';
    return {
      ...c,
      vendor_variance_pct: Math.round(variancePct * 10) / 10,
      should_review: shouldReview,
    };
  }).filter(c => c.should_review).sort((a, b) => b.vendor_variance_pct - a.vendor_variance_pct);

  res.json({ data: candidates });
});

// Clear data
app.post('/api/clear', (_, res) => {
  store = emptyStore();
  persistStore();
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
    const unifiedPath = path.join(__dirname, 'public', 'static', 'sample_budget_unified.csv');

    if (fs.existsSync(unifiedPath)) {
      const text = fs.readFileSync(unifiedPath, 'utf-8').replace(/^\uFEFF/, '');
      const parsedRows = parseCSV(text);
      const converted = parseUnifiedBudgetLayout(parsedRows);
      store.rawRows = parsedRows;
      store.master = converted.master;
      store.detail = converted.detail;
      store.csvFileName = 'sample_budget_unified.csv';
      console.log(`  [Auto-load] unified: ${parsedRows.length} rows`);
    }

    if (store.master || store.detail) {
      store.uploadedAt = new Date().toISOString();
      const data = buildUnifiedData();
      const agg = data ? getAggregations(data) : null;
      if (data) {
        const contractSeeds = data.items.filter(i => i.contract_no).slice(0, 20);
        contractSeeds.forEach((item) => {
          const id = item.contract_no;
          if (store.contracts[id]) return;
          const renewalMonth = data.sortedYMs.find((ym) => ym >= `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`) || data.sortedYMs[0] || '';
          store.contracts[id] = {
            contract_id: id,
            contract_no: item.contract_no,
            vendor_name: item.vendor_name || '未設定ベンダー',
            system_name: item.system_name || '',
            renewal_month: renewalMonth,
            decision_status: '未判断',
            decision_note: '',
            annual_amount: item.contract_amount || item.totalPlan || 0,
            updated_at: new Date().toISOString(),
          };
        });
      }
      console.log(`  [Auto-load] ${data ? data.items.length : 0} items, ${agg ? agg.systemNames.length : 0} systems, ${agg ? agg.periods.length : 0} periods`);
      persistStore();
    }
  } catch (e) {
    console.error('  [Auto-load] Failed:', e.message);
  }
}

let server = null;

function startServer({ host = HOST, port = PORT } = {}) {
  if (server) return server;

  server = app.listen(port, host, () => {
    const actualPort = server.address()?.port || port;
    console.log(`\n  Budget CSV Viewer v4.0`);
    console.log(`  Local:   http://${host}:${actualPort}`);
    if (!loadStoreFromDisk()) {
      autoLoadSampleData();
    }
    console.log(`  Status:  Ready\n`);
  });

  return server;
}

function stopServer({ timeoutMs = 5000 } = {}) {
  if (!server) return Promise.resolve();

  return new Promise((resolve) => {
    const currentServer = server;
    server = null;

    const timer = setTimeout(() => {
      console.error('  [Server] Force shutdown after timeout.');
      resolve();
    }, timeoutMs);

    currentServer.close(() => {
      clearTimeout(timer);
      console.log('  [Server] Closed cleanly.');
      resolve();
    });
  });
}

async function shutdown(signal) {
  console.log(`\n  [Server] Received ${signal}. Shutting down...`);
  await stopServer();
  process.exit(0);
}

if (require.main === module) {
  startServer();
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
}

module.exports = {
  app,
  startServer,
  stopServer,
  parseCSV,
  parseCSVLine,
  COLUMN_ALIASES,
  VARIANCE_REASON_CATEGORIES,
  pickColumn,
  normalizeVarianceReasonCategory,
  mergeVarianceReasons,
  parseUnifiedBudgetLayout,
  buildUnifiedData,
  getAggregations,
  emptyStore,
  normalizeStore,
};
