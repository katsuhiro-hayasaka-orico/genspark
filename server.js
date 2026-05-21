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

const IMPORT_FILE_TYPES = Object.freeze({
  BUDGET: 'budget',
  VARIANCE_REASON: 'variance_reason',
  NEW_PROJECT_MASTER: 'new_project_master',
  NEW_PROJECT_MONTHLY_COST: 'new_project_monthly_cost',
  NEW_PROJECT: 'new_project',
  NEW_PROJECT_ACTUAL_FORECAST: 'new_project_actual_forecast',
  OASIS_ACTUAL: 'oasis_actual',
  DEPRECIATION_SIMULATION: 'depreciation_simulation',
});

const ADDITIONAL_IMPORT_FILE_TYPES = Object.freeze([
  IMPORT_FILE_TYPES.VARIANCE_REASON,
  IMPORT_FILE_TYPES.NEW_PROJECT_MASTER,
  IMPORT_FILE_TYPES.NEW_PROJECT_MONTHLY_COST,
  IMPORT_FILE_TYPES.NEW_PROJECT,
  IMPORT_FILE_TYPES.NEW_PROJECT_ACTUAL_FORECAST,
  IMPORT_FILE_TYPES.OASIS_ACTUAL,
  IMPORT_FILE_TYPES.DEPRECIATION_SIMULATION,
]);

const NOT_IMPORTED_MESSAGE = '追加データ未取込';

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

app.use(express.json({ limit: '50mb' }));
app.use('/static', express.static(path.join(__dirname, 'public', 'static')));

// =============================================
// Local data store
// =============================================
function createAdditionalDataStore() {
  return Object.fromEntries(ADDITIONAL_IMPORT_FILE_TYPES.map((fileType) => [fileType, {
    status: 'not_imported',
    message: NOT_IMPORTED_MESSAGE,
    rows: [],
    byManagementNo: {},
    fileName: null,
    uploadedAt: null,
  }]));
}

function emptyStore() {
  return {
    master: [],       // normalized master-like rows derived from unified CSV
    detail: [],       // normalized detail-like rows derived from unified CSV
    rawRows: [],      // parsed unified CSV rows (as-is view for items screen)
    uploadedAt: null,
    csvFileName: null,
    additionalData: createAdditionalDataStore(),
    varianceReasons: {},   // key: management_no|item_no|fiscal_period|target_year_month
    initiatives: {},       // key: initiative_id
    contracts: {},         // key: contract_id
  };
}

let store = emptyStore();

function normalizeAdditionalDataStore(candidate) {
  const normalized = createAdditionalDataStore();
  if (!candidate || typeof candidate !== 'object') return normalized;

  for (const fileType of ADDITIONAL_IMPORT_FILE_TYPES) {
    const current = candidate[fileType];
    if (!current || typeof current !== 'object') continue;
    const rows = Array.isArray(current.rows) ? current.rows : [];
    normalized[fileType] = {
      ...normalized[fileType],
      ...current,
      status: current.status || (rows.length ? 'imported' : 'not_imported'),
      message: current.message || (rows.length ? '取込済み' : NOT_IMPORTED_MESSAGE),
      rows,
      byManagementNo: current.byManagementNo && typeof current.byManagementNo === 'object'
        ? current.byManagementNo
        : indexRowsByManagementNo(rows),
    };
  }
  return normalized;
}

function normalizeStore(candidate) {
  const base = emptyStore();
  const source = candidate && typeof candidate === 'object' ? candidate : {};
  return {
    ...base,
    ...source,
    master: Array.isArray(source.master) ? source.master : [],
    detail: Array.isArray(source.detail) ? source.detail : [],
    rawRows: Array.isArray(source.rawRows) ? source.rawRows : [],
    additionalData: normalizeAdditionalDataStore(source.additionalData),
    varianceReasons: source.varianceReasons && typeof source.varianceReasons === 'object' ? source.varianceReasons : {},
    initiatives: source.initiatives && typeof source.initiatives === 'object' ? source.initiatives : {},
    contracts: source.contracts && typeof source.contracts === 'object' ? source.contracts : {},
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
function parseDelimitedRows(text) {
  const normalized = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized.trim()) return [];

  const delimiter = detectDelimiterFromText(normalized);
  return parseCSVRecords(normalized, delimiter);
}

function looksLikeHeaderRecord(record) {
  const headers = (record || []).map(h => safeString(h));
  if (!headers.some(Boolean)) return false;
  const joined = headers.join(' ');
  const hasManagementNo = headers.some(h => /管理(?:番号|no|NO|No)|management/i.test(h));
  const hasBudgetMonth = headers.some(h => canonicalBudgetMonthHeader(h));
  const hasKnownBudgetColumn = /案件名|部署名|部門名|システム名|契約|支払先|担当者|項番/.test(joined);
  return (hasManagementNo && (hasBudgetMonth || hasKnownBudgetColumn)) || (hasBudgetMonth && hasKnownBudgetColumn);
}

function recordsToObjects(records) {
  if (!Array.isArray(records) || records.length < 2) return [];
  const headerIndex = Math.max(0, records.findIndex(looksLikeHeaderRecord));
  const headers = (records[headerIndex] || []).map(h => safeString(h));
  const seen = {};
  const normalizedHeaders = headers.map((header, idx) => {
    const base = header || `__blank_${idx}`;
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] === 1 ? base : `${base}_${seen[base] - 1}`;
  });

  return records.slice(headerIndex + 1)
    .filter(values => values.some(v => safeString(v) !== ''))
    .map((values) => {
      const row = {};
      normalizedHeaders.forEach((h, idx) => {
        if (!h || /^__blank_/.test(h)) return;
        row[h] = safeString(values[idx] ?? '');
      });
      return row;
    });
}

function parseCSV(text) {
  return recordsToObjects(parseDelimitedRows(text));
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

function detectDelimiterFromText(text) {
  const sampleRecords = String(text || '').split('\n').slice(0, 8);
  let commaMax = 0;
  let tabMax = 0;
  for (const record of sampleRecords) {
    commaMax = Math.max(commaMax, countDelimiterOutsideQuotes(record, ','));
    tabMax = Math.max(tabMax, countDelimiterOutsideQuotes(record, '\t'));
  }
  if (tabMax > commaMax) return '\t';
  return detectDelimiter(readFirstCSVRecord(text));
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

function safeString(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
    .trim();
}

function normalizeAmount(value) {
  const rawValue = value;
  let text = safeString(value);
  if (!text) return { value: 0, rawValue, normalizedText: '', blank: true, valid: true };

  text = text
    .replace(/[￥¥円]/g, '')
    .replace(/[，,\s]/g, '')
    .replace(/[－―−]/g, '-')
    .replace(/^\((.*)\)$/, '-$1');

  if (!text || text === '-' || text === '△' || text === '▲') {
    return { value: 0, rawValue, normalizedText: text, blank: true, valid: true };
  }

  const negativePrefix = /^[△▲]/.test(text);
  text = text.replace(/^[△▲]/, '');
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) {
    return { value: 0, rawValue, normalizedText: text, blank: false, valid: false };
  }

  const valueNumber = Number(text);
  if (!Number.isFinite(valueNumber)) {
    return { value: 0, rawValue, normalizedText: text, blank: false, valid: false };
  }

  return {
    value: negativePrefix ? -Math.abs(valueNumber) : valueNumber,
    rawValue,
    normalizedText: String(negativePrefix ? -Math.abs(valueNumber) : valueNumber),
    blank: false,
    valid: true,
  };
}

function normalizeDateString(value) {
  const rawValue = value;
  const text = safeString(value);
  if (!text) return { value: '', rawValue, blank: true, valid: true };

  let match = text.match(/^(\d{4})(\d{2})$/);
  if (!match) match = text.match(/^(\d{4})[\/\-.年](\d{1,2})(?:[\/\-.月](?:\d{1,2})日?)?$/);
  if (!match) return { value: '', rawValue, blank: false, valid: false };

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 1900 || year > 2200 || month < 1 || month > 12) {
    return { value: '', rawValue, blank: false, valid: false };
  }

  return { value: `${year}${String(month).padStart(2, '0')}`, rawValue, blank: false, valid: true };
}

function normalizeYearMonthString(value) {
  const normalized = normalizeDateString(value);
  if (normalized.blank) {
    return {
      ...normalized,
      status: 'blank',
      warning: '',
    };
  }
  if (!normalized.valid) {
    return {
      ...normalized,
      status: 'invalid',
      warning: '年月はYYYYMMまたはYYYY/MM形式で入力してください',
    };
  }
  return {
    ...normalized,
    status: 'valid',
    warning: '',
  };
}

function makeImportIssue(level, rowNumber, field, message, rawValue = '') {
  return { level, rowNumber, field, message, rawValue };
}

function normalizeHeaderForMatch(value) {
  return safeString(value).toLowerCase().replace(/[\/_\-・（）()\[\]【】\s]/g, '');
}

const BUDGET_HEADER_ALIASES = Object.freeze({
  '管理番号': ['管理番号', '管理番号（統合）', '管理No', '管理NO', '管理番号統合', '案件管理番号', 'management_no', 'managementno', 'managementnumber'],
  '項番': ['項番', '明細番号', '行番号', 'No', 'item_no', 'itemno'],
  '期': ['期', '対象期', '会計期', 'fiscal_period', 'period'],
  '予算区分': ['予算区分', '予算カテゴリ', 'カテゴリ', 'budget_category'],
  '経費区分': ['経費区分', '費目区分', 'expense_classification'],
  '案件名': ['案件名', '件名', 'プロジェクト名', 'project_name', 'projectname'],
  '部署名': ['部署名', '部門名', '組織名', 'department_name', 'department'],
  '担当者': ['担当者', '担当者名', '案件担当者', 'owner_name', 'owner'],
  '支払先': ['支払先', 'ベンダー', 'ベンダー名', '取引先', 'vendor_name', 'payee_name'],
  '契約番号': ['契約番号', '契約No', '契約NO', 'contract_no', 'contractno'],
  '契約金額': ['契約金額', '契約額', '年額', 'annual_amount', 'contract_amount'],
  '月額': ['月額', '月次金額', 'monthly_amount'],
  '支払区分': ['支払区分', '投資運用区分', '投資・運用区分', 'payment_category'],
  '固定変動': ['固定変動', '固定費変動費', '固定費・変動費', 'fixed_variable_type'],
  '経費事象コード': ['経費事象コード', '経費事象CD', 'システムコード', 'system_code', 'expense_item_code'],
  'システム名': ['システム名', 'サービス名', 'system_name'],
  '経費事象名': ['経費事象名', '費目名', 'expense_item_name'],
  'システム分類名': ['システム分類名', '分類名', 'system_classification_name'],
});

const BUDGET_HEADER_LOOKUP = Object.freeze(Object.entries(BUDGET_HEADER_ALIASES).reduce((acc, [canonical, aliases]) => {
  aliases.forEach(alias => { acc[normalizeHeaderForMatch(alias)] = canonical; });
  return acc;
}, {}));

function canonicalBudgetColumnHeader(header) {
  const normalized = normalizeHeaderForMatch(header);
  return BUDGET_HEADER_LOOKUP[normalized] || '';
}

function canonicalBudgetValueType(value) {
  const text = safeString(value);
  if (/^(計画|予算|budget|plan)$/i.test(text)) return '計画';
  if (/^(見込|見込み|予測|forecast)$/i.test(text)) return '見込';
  if (/^(実績|actual)$/i.test(text)) return '実績';
  return '';
}

function canonicalBudgetMonthHeader(header, fallbackPeriod = '') {
  const text = safeString(header).replace(/\s/g, '');
  if (!text) return '';

  let match = text.match(/^(\d{1,3})期0?(\d{1,2})月(計画|予算|見込|見込み|予測|実績|plan|budget|forecast|actual)$/i);
  if (match) {
    const type = canonicalBudgetValueType(match[3]);
    return type ? `${Number(match[1])}期${Number(match[2])}月${type}` : '';
  }

  match = text.match(/^(\d{4})[\-/年]?(\d{1,2})月?[\-_/]*(計画|予算|見込|見込み|予測|実績|plan|budget|forecast|actual)$/i);
  if (match) {
    const ym = normalizeYearMonthString(`${match[1]}${String(Number(match[2])).padStart(2, '0')}`);
    const period = deriveFiscalPeriodFromYearMonth(ym.value);
    const type = canonicalBudgetValueType(match[3]);
    return ym.valid && period && type ? `${period}期${Number(match[2])}月${type}` : '';
  }

  match = text.match(/^0?(\d{1,2})月(計画|予算|見込|見込み|予測|実績|plan|budget|forecast|actual)$/i);
  const period = safeString(fallbackPeriod).replace(/期$/, '');
  if (match && period) {
    const type = canonicalBudgetValueType(match[2]);
    return type ? `${Number(period)}期${Number(match[1])}月${type}` : '';
  }

  return '';
}

function canonicalizeBudgetRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const canonical = {};
    for (const [header, value] of Object.entries(row || {})) {
      const knownHeader = canonicalBudgetColumnHeader(header);
      const targetHeader = knownHeader || canonicalBudgetMonthHeader(header, row['期'] || row['対象期'] || row['会計期']) || safeString(header);
      if (!targetHeader) continue;
      if (canonical[targetHeader] === undefined || canonical[targetHeader] === '') canonical[targetHeader] = value;
    }
    return { ...row, ...canonical };
  });
}

function parseUnifiedBudgetLayout(rows) {
  const master = [];
  const detail = [];
  const issues = [];
  const sourceRows = canonicalizeBudgetRows(rows);
  const totalRows = sourceRows.length;
  let successRows = 0;
  let skippedRows = 0;

  if (totalRows === 0) {
    return { master, detail, issues, totalRows, successRows, warningCount: 0, errorCount: 0, skippedRows };
  }

  const headers = Object.keys(sourceRows[0] || {});
  const hasManagementNo = headers.includes('管理番号') || headers.includes('管理番号（統合）');
  const hasItemNo = headers.includes('項番');
  const monthHeaders = headers.filter(h => /期\d{1,2}月(計画|見込|実績)$/.test(safeString(h)));

  if (!hasManagementNo) {
    issues.push(makeImportIssue('error', null, '管理番号', '必須列が不足しています（管理番号 または 管理番号（統合））'));
  }
  if (!hasItemNo) {
    issues.push(makeImportIssue('warning', null, '項番', '必須列が不足しています。項番は 1 として取り込みます'));
  }
  if (!monthHeaders.length) {
    issues.push(makeImportIssue('error', null, '年月', '取込対象の年月列（例: 65期4月計画）が見つかりません'));
  }

  const monthPattern = /^(\d+)期(\d{1,2})月(計画|見込|実績)$/;

  sourceRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const managementNo = safeString(row['管理番号'] || row['管理番号（統合）'] || '');
    const itemNo = safeString(row['項番'] || '1') || '1';
    if (!managementNo) {
      issues.push(makeImportIssue('skipped', rowNumber, '管理番号', '管理番号が空欄のため、このレコードは取込対象外にしました', row['管理番号'] || row['管理番号（統合）'] || ''));
      skippedRows++;
      return;
    }

    if (!monthHeaders.length) {
      issues.push(makeImportIssue('skipped', rowNumber, '年月', '年月列がないため、このレコードは取込対象外にしました'));
      skippedRows++;
      return;
    }

    const contractAmount = normalizeAmount(row['契約金額']);
    if (!contractAmount.valid) {
      issues.push(makeImportIssue('warning', rowNumber, '契約金額', '契約金額が不正なため 0 として取り込みます', row['契約金額']));
    }
    const monthlyAmount = normalizeAmount(row['月額']);
    if (!monthlyAmount.valid) {
      issues.push(makeImportIssue('warning', rowNumber, '月額', '月額が不正なため 0 として取り込みます', row['月額']));
    }

    const contractStartDate = normalizeDateString(row['契約開始日'] || '');
    const contractEndDate = normalizeDateString(row['契約終了日'] || '');
    const nextRenewalMonth = normalizeYearMonthString(row['次回更新予定月'] || '');

    master.push({
      period: safeString(row['期'] || ''),
      management_no: managementNo,
      item_no: itemNo,
      budget_category: safeString(row['予算区分'] || row['経費区分'] || ''),
      expense_classification: safeString(row['経費区分'] || ''),
      project_name: safeString(row['案件名'] || ''),
      department_name: safeString(row['部署名'] || ''),
      owner_name: safeString(row['担当者'] || ''),
      payee_name: safeString(row['支払先'] || ''),
      contract_no: safeString(row['契約番号'] || ''),
      contract_amount: String(contractAmount.valid ? contractAmount.value : 0),
      monthly_amount: String(monthlyAmount.valid ? monthlyAmount.value : 0),
      payment_category: safeString(row['支払区分'] || ''),
      fixed_variable_type: safeString(row['固定変動'] || ''),
      system_code: safeString(row['経費事象コード'] || ''),
      system_name: safeString(row['システム名'] || ''),
      expense_item_code: safeString(row['経費事象コード'] || ''),
      expense_item_name: safeString(row['経費事象名'] || ''),
      system_classification_name: safeString(row['システム分類名'] || ''),
    });

    let validDetailCount = 0;
    for (const key of monthHeaders) {
      const rawAmount = row[key];
      const amount = normalizeAmount(rawAmount);
      if (amount.blank) continue;
      if (!amount.valid) {
        issues.push(makeImportIssue('warning', rowNumber, key, '金額が不正なため、この金額セルは取り込みません', rawAmount));
        continue;
      }

      const match = safeString(key).match(monthPattern);
      const period = Number(match[1]);
      const month = Number(match[2]);
      const typeLabel = match[3];
      if (!Number.isInteger(period) || !Number.isInteger(month) || month < 1 || month > 12) {
        issues.push(makeImportIssue('warning', rowNumber, key, '年月が不正なため、この金額セルは取り込みません', rawAmount));
        continue;
      }

      const fiscalYear = 1960 + period;
      const calendarYear = month <= 3 ? fiscalYear + 1 : fiscalYear;
      const date = normalizeDateString(`${calendarYear}${String(month).padStart(2, '0')}`);
      if (!date.valid) {
        issues.push(makeImportIssue('warning', rowNumber, key, '年月が不正なため、この金額セルは取り込みません', rawAmount));
        continue;
      }

      detail.push({
        management_no: managementNo,
        item_no: itemNo,
        expense_item_code: safeString(row['経費事象コード'] || ''),
        system_code: safeString(row['経費事象コード'] || ''),
        fiscal_period: String(period),
        target_year_month: date.value,
        value_type: typeLabel === '計画' ? 'plan' : (typeLabel === '実績' ? 'actual' : 'forecast'),
        amount: String(amount.value),
      });
      validDetailCount++;
    }

    if (!validDetailCount) {
      issues.push(makeImportIssue('warning', rowNumber, '金額', '取込可能な月次金額がないレコードです'));
    }
    successRows++;
  });

  const warningCount = issues.filter(issue => issue.level === 'warning').length;
  const errorCount = issues.filter(issue => issue.level === 'error').length;
  return { master, detail, issues, totalRows, successRows, warningCount, errorCount, skippedRows };
}


function getFirstValue(row, aliases) {
  for (const key of aliases) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function normalizeManagementNo(row) {
  return getFirstValue(row, ['management_no', '管理番号', '管理番号（統合）', '管理No', '管理NO', '案件管理番号']);
}

function indexRowsByManagementNo(rows) {
  const indexed = {};
  for (const row of rows || []) {
    const managementNo = row.management_no || normalizeManagementNo(row);
    if (!managementNo) continue;
    if (!indexed[managementNo]) indexed[managementNo] = [];
    indexed[managementNo].push({ ...row, management_no: managementNo });
  }
  return indexed;
}

function makeNotImportedParseResult(fileType) {
  return {
    fileType,
    status: 'not_imported',
    message: NOT_IMPORTED_MESSAGE,
    rows: [],
    byManagementNo: {},
  };
}

function makeImportedParseResult(fileType, rows, message = '取込済み') {
  const normalizedRows = (rows || []).map((row) => ({
    ...row,
    management_no: row.management_no || normalizeManagementNo(row),
  })).filter(row => row.management_no);

  return {
    fileType,
    status: normalizedRows.length > 0 ? 'imported' : 'not_imported',
    message: normalizedRows.length > 0 ? message : NOT_IMPORTED_MESSAGE,
    rows: normalizedRows,
    byManagementNo: indexRowsByManagementNo(normalizedRows),
  };
}

function parseBudgetCsv(text) {
  const rows = parseCSV(text);
  const converted = parseUnifiedBudgetLayout(rows);
  return {
    ...converted,
    fileType: IMPORT_FILE_TYPES.BUDGET,
    status: 'imported',
    message: '予実績管理データを取り込みました',
    rows,
    master: converted.master,
    detail: converted.detail,
  };
}

function parseVarianceReasonCsv(text) {
  const rows = parseCSV(text).map((row) => ({
    ...row,
    management_no: normalizeManagementNo(row),
    item_no: getFirstValue(row, ['item_no', '項番']),
    fiscal_period: getFirstValue(row, ['fiscal_period', '期']),
    target_year_month: getFirstValue(row, ['target_year_month', '対象年月', '年月']),
    reason_category: getFirstValue(row, ['reason_category', '理由カテゴリ', '差額理由カテゴリ']),
    factor_type: getFirstValue(row, ['factor_type', '要因区分']),
    comment: getFirstValue(row, ['comment', 'コメント', '差額理由', '理由']),
  }));
  return makeImportedParseResult(IMPORT_FILE_TYPES.VARIANCE_REASON, rows, '差額理由データを取り込みました');
}

function parseProgressRate(value) {
  const text = safeString(value);
  if (!text) return null;
  const numeric = text.match(/(\d+(?:\.\d+)?)\s*%?/);
  if (numeric) {
    const n = Number(numeric[1]);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
  }
  const normalized = text.toLowerCase();
  if (/完了|本番|リリース|稼働|済/.test(normalized)) return 100;
  if (/テスト|受入|移行/.test(normalized)) return 85;
  if (/開発|製造|構築/.test(normalized)) return 65;
  if (/設計/.test(normalized)) return 45;
  if (/要件|企画|検討|計画/.test(normalized)) return 25;
  if (/未着手|保留|中止/.test(normalized)) return 0;
  return null;
}

function deriveFiscalPeriodFromYearMonth(ym) {
  const parsed = parseYM(ym);
  if (!parsed) return '';
  const fiscalYear = parsed.month <= 3 ? parsed.year - 1 : parsed.year;
  const period = fiscalYear - 1960;
  return period > 0 ? String(period) : '';
}

function normalizeNewProjectRecord(row = {}) {
  const managementNo = normalizeManagementNo(row);
  const targetYearMonth = normalizeYearMonthString(getFirstValue(row, ['年月', 'target_year_month', '対象年月']));
  const budgetAmount = normalizeAmount(getFirstValue(row, ['予算金額', 'budget_amount', 'plan']));
  const forecastAmount = normalizeAmount(getFirstValue(row, ['見込金額', 'forecast_amount', '見込み金額', 'forecast']));
  const fiveYearExpense = normalizeAmount(getFirstValue(row, ['5年経費合計', 'five_year_expense_total']));
  const category = getFirstValue(row, ['案件区分', 'project_category', '投資運用区分']);
  const division = getFirstValue(row, ['区分', 'division']);
  const itStrategyCategory = getFirstValue(row, ['区分_1', 'it_strategy_category', 'IT戦区分']);
  const progressStatus = getFirstValue(row, ['進捗状況', 'progress_status']);

  return {
    ...row,
    management_no: managementNo,
    division,
    team_name: getFirstValue(row, ['チーム名', 'team_name']),
    computer_processing_no: getFirstValue(row, ['電算処理№', '電算処理No', 'computer_processing_no']),
    project_name: getFirstValue(row, ['案件名', 'project_name']),
    owner_name: getFirstValue(row, ['案件担当者', '担当者', 'owner_name']),
    production_start_date: getFirstValue(row, ['本番開始予定日', 'production_start_date']),
    it_investment_simulation_no: getFirstValue(row, ['IT投資ｼﾐｭﾚｰｼｮﾝ№', 'IT投資シミュレーション№', 'it_investment_simulation_no']),
    expense_event: getFirstValue(row, ['経費事象', 'expense_event']),
    progress_status: progressStatus,
    progress_rate: parseProgressRate(progressStatus),
    has_budget: getFirstValue(row, ['予算有り', 'has_budget']),
    five_year_expense_total: fiveYearExpense.valid ? fiveYearExpense.value : 0,
    project_category: category,
    memo: getFirstValue(row, ['memo', 'メモ', '差額理由', '理由']),
    it_strategy_category: itStrategyCategory,
    target_year_month: targetYearMonth.valid ? targetYearMonth.value : '',
    fiscal_period: targetYearMonth.valid ? deriveFiscalPeriodFromYearMonth(targetYearMonth.value) : '',
    budget_amount: budgetAmount.valid ? budgetAmount.value : 0,
    forecast_amount: forecastAmount.valid ? forecastAmount.value : 0,
    budget_amount_valid: budgetAmount.valid,
    forecast_amount_valid: forecastAmount.valid,
    target_year_month_status: targetYearMonth.status,
  };
}

function parseNewProjectCsv(text) {
  const rows = parseCSV(text).map(normalizeNewProjectRecord);
  return makeImportedParseResult(IMPORT_FILE_TYPES.NEW_PROJECT, rows, '新規案件データを取り込みました');
}

function deriveCostGroup(costGroupRaw, expenseEvent) {
  const v = safeString(costGroupRaw);
  if (v) return v;
  const e = safeString(expenseEvent);
  if (/A\.日本IBM投資|B\.キンドリル社投資|開発費|他社開発/.test(e)) return '投資系';
  if (/運用費|リース料|保守料|外部委託|回線料|事務用品/.test(e)) return '運用系';
  return '未分類';
}
function deriveProgressRateFromStatus(status) {
  const s = safeString(status);
  if (!s) return null;
  if (/01\.未着手|未着手/.test(s) || /取下げ|削除/.test(s)) return 0;
  if (/今期中に案件組成|来期案件組成予定/.test(s)) return 20;
  if (/組成予定/.test(s)) return 40;
  if (/組成済/.test(s)) return 60;
  if (/予算計画通り/.test(s)) return 80;
  if (/完了/.test(s)) return 100;
  return null;
}
function deriveVarianceReason(status, memo, varianceAmount) {
  const text = `${safeString(status)} ${safeString(memo)}`;
  if (/見込精緻化/.test(text)) return '見込精緻化';
  if (/コスト削減/.test(text)) return 'コスト削減';
  if (/遅延/.test(text)) return '遅延';
  if (/取下げ|取下/.test(text)) return '取下げ';
  if (/削除/.test(text)) return '削除';
  if (/計上年度/.test(text)) return '計上年度誤り';
  if (/予算計画通り/.test(text)) return '予算計画通り';
  if (/未着手/.test(text)) return '未着手';
  if (Number(varianceAmount || 0) === 0) return '差額なし';
  return 'その他';
}
function parseNewProjectCostCsv(text) {
  const rows = parseCSV(text).map((row, idx) => {
    const budget = normalizeAmount(getFirstValue(row, ['予算金額'])).value;
    const forecast = normalizeAmount(getFirstValue(row, ['見込金額', '見込み金額'])).value;
    const varianceRaw = normalizeAmount(getFirstValue(row, ['差額']));
    const varianceAmount = varianceRaw.blank ? (forecast - budget) : varianceRaw.value;
    const varianceRateRaw = normalizeAmount(getFirstValue(row, ['差額率']));
    const varianceRate = varianceRateRaw.blank ? (budget ? varianceAmount / budget : null) : varianceRateRaw.value;
    const month = normalizeYearMonthString(getFirstValue(row, ['対象年月', '年月']));
    const status = getFirstValue(row, ['進捗状況']);
    const memo = getFirstValue(row, ['memo', 'メモ']);
    const costGroup = deriveCostGroup(getFirstValue(row, ['投資運用区分']), getFirstValue(row, ['経費事象']));
    const managementNo = normalizeManagementNo(row) || `NO-${idx + 1}`;
    const projectName = getFirstValue(row, ['案件名']) || `(案件名未設定:${managementNo})`;
    return {
      management_no: managementNo,
      team_name: getFirstValue(row, ['チーム名']),
      project_name: projectName,
      owner_name: getFirstValue(row, ['案件担当者', '担当者']),
      production_start_date: getFirstValue(row, ['本番開始予定日']),
      it_investment_simulation_no: getFirstValue(row, ['IT投資シミュレーション№', 'IT投資ｼﾐｭﾚｰｼｮﾝ№']) || '未設定',
      expense_event: getFirstValue(row, ['経費事象']) || '未設定',
      cost_group: costGroup,
      progress_status: status || '未設定',
      progress_rate: deriveProgressRateFromStatus(status),
      project_category: getFirstValue(row, ['案件区分']) || '未設定',
      memo,
      target_year_month: month.valid ? month.value : '',
      budget_amount: budget,
      forecast_amount: forecast,
      variance_amount: varianceAmount,
      variance_rate: varianceRate,
      five_year_expense_total: normalizeAmount(getFirstValue(row, ['5年経費合計'])).value,
      variance_reason: deriveVarianceReason(status, memo, varianceAmount),
    };
  });
  return makeImportedParseResult(IMPORT_FILE_TYPES.NEW_PROJECT_ACTUAL_FORECAST, rows, '新規案件予算見込CSVを取り込みました');
}

function parseNewProjectMasterCsv(text) {
  const rows = parseCSV(text).map((row, idx) => {
    const managementNo = normalizeManagementNo(row) || `NO-${idx + 1}`;
    return {
      management_no: managementNo,
      project_name: getFirstValue(row, ['案件名', 'project_name']) || `(案件名未設定:${managementNo})`,
      owner_name: getFirstValue(row, ['案件担当者', '担当者', 'owner_name']),
      production_start_date: getFirstValue(row, ['本番開始予定日', 'production_start_date']),
      it_investment_simulation_no: getFirstValue(row, ['IT投資シミュレーション№', 'IT投資ｼﾐｭﾚｰｼｮﾝ№', 'it_investment_simulation_no']),
      progress_status: getFirstValue(row, ['進捗状況', 'progress_status']) || '未設定',
      progress_rate: deriveProgressRateFromStatus(getFirstValue(row, ['進捗状況', 'progress_status'])),
      project_category: getFirstValue(row, ['案件区分', 'project_category']) || '未設定',
    };
  });
  return makeImportedParseResult(IMPORT_FILE_TYPES.NEW_PROJECT_MASTER, rows, '新規案件マスタCSVを取り込みました');
}

function parseNewProjectMonthlyCostCsv(text) {
  const rows = parseCSV(text).map((row, idx) => {
    const budget = normalizeAmount(getFirstValue(row, ['予算金額', 'budget_amount'])).value;
    const forecast = normalizeAmount(getFirstValue(row, ['見込金額', '見込み金額', 'forecast_amount'])).value;
    const varianceAmount = forecast - budget;
    const month = normalizeYearMonthString(getFirstValue(row, ['対象年月', '年月', 'target_year_month']));
    const managementNo = normalizeManagementNo(row) || `NO-${idx + 1}`;
    return {
      management_no: managementNo,
      expense_event: getFirstValue(row, ['経費事象', 'expense_event']) || '未設定',
      target_year_month: month.valid ? month.value : '',
      budget_amount: budget,
      forecast_amount: forecast,
      variance_amount: varianceAmount,
      variance_rate: budget ? varianceAmount / budget : null,
      cost_group: deriveCostGroup(getFirstValue(row, ['投資運用区分']), getFirstValue(row, ['経費事象'])),
      has_budget: getFirstValue(row, ['予算有り', 'has_budget']),
      five_year_expense_total: normalizeAmount(getFirstValue(row, ['5年経費合計', 'five_year_expense_total'])).value,
      memo: getFirstValue(row, ['memo', 'メモ']),
    };
  });
  return makeImportedParseResult(IMPORT_FILE_TYPES.NEW_PROJECT_MONTHLY_COST, rows, '新規案件月次金額CSVを取り込みました');
}

function parseOasisActualCsv() {
  const rows = parseCSV(arguments[0] || '').map((row) => {
    const balance = normalizeAmount(getFirstValue(row, ['残高', 'balance']));
    const debit = normalizeAmount(getFirstValue(row, ['借方金額', 'debit_amount', 'debit']));
    const credit = normalizeAmount(getFirstValue(row, ['貸方金額', 'credit_amount', 'credit']));
    const fallbackAmount = debit.value - credit.value;
    const amount = balance.valid && !balance.blank ? balance.value : fallbackAmount;
    const accountingDate = normalizeDateString(getFirstValue(row, ['会計日', 'accounting_date', 'date']));
    const supplier = getFirstValue(row, ['サプライヤ', 'supplier']) || 'サプライヤ未設定';
    const yojitsuNo = getFirstValue(row, ['予実番号', 'yojitsu_no']) || '予実番号未設定';
    return {
      ...row,
      expense_event_code: getFirstValue(row, ['経費事象コード', 'expense_event_code']),
      expense_event_name: getFirstValue(row, ['経費事象名', 'expense_event_name']),
      expense_event_detail_code: getFirstValue(row, ['経費事象細目コード', 'expense_event_detail_code']),
      expense_event_detail_name: getFirstValue(row, ['経費事象細目名', 'expense_event_detail_name']),
      accounting_date: accountingDate.valid ? accountingDate.value : safeString(getFirstValue(row, ['会計日', 'accounting_date', 'date'])),
      budget_department_code: getFirstValue(row, ['予算部店コード', 'budget_department_code']),
      budget_department_name: getFirstValue(row, ['予算部店名', 'budget_department_name']),
      actual_department_code: getFirstValue(row, ['実績部店コード', 'actual_department_code']),
      actual_department_name: getFirstValue(row, ['実績部店名', 'actual_department_name']),
      debit_amount: debit.value,
      credit_amount: credit.value,
      balance_amount: balance.valid ? balance.value : 0,
      actual_amount: amount,
      supplier,
      journal_summary: getFirstValue(row, ['仕訳摘要', 'journal_summary']),
      journal_detail_summary: getFirstValue(row, ['仕訳明細摘要', 'journal_detail_summary']),
      invoice_no: getFirstValue(row, ['請求書番号', 'invoice_no']),
      payment_base_date: getFirstValue(row, ['支払起算日', 'payment_base_date']),
      number: getFirstValue(row, ['番号', 'number']),
      detail_code: getFirstValue(row, ['細目コード', 'detail_code']),
      major_classification: getFirstValue(row, ['大分類', 'major_classification']),
      yojitsu_no: yojitsuNo,
      yojitsu_no_missing: yojitsuNo === '予実番号未設定',
    };
  }).filter((row) => (
    row.expense_event_code || row.expense_event_name || row.accounting_date || row.actual_department_name || row.supplier || row.actual_amount
  ));

  return {
    fileType: IMPORT_FILE_TYPES.OASIS_ACTUAL,
    status: rows.length > 0 ? 'imported' : 'not_imported',
    message: rows.length > 0 ? 'OACIS実績データを取り込みました' : NOT_IMPORTED_MESSAGE,
    rows,
    byManagementNo: {},
  };
}

function normalizeDepreciationPeriodType(value) {
  const text = safeString(value).toLowerCase();
  if (/^(month|monthly|月次|月)$/.test(text)) return 'month';
  if (/^(half|halfyear|semiannual|半期|上期|下期|h1|h2)$/.test(text)) return 'half';
  if (/^(full|fy|year|annual|通期|年次|年間)$/.test(text)) return 'full';
  return text || '';
}

function normalizeDepreciationMonth(value) {
  const raw = safeString(value);
  const upper = raw.toUpperCase();
  if (upper === 'H1' || /上期/.test(raw)) return { month: 'H1', month_key: '', month_order: 0 };
  if (upper === 'H2' || /下期/.test(raw)) return { month: 'H2', month_key: '', month_order: 6 };
  if (upper === 'FY' || /通期|年間|年次/.test(raw)) return { month: 'FY', month_key: '', month_order: 12 };

  const normalizedDate = normalizeDateString(raw);
  if (normalizedDate.valid && normalizedDate.value) {
    const month = Number(normalizedDate.value.slice(4, 6));
    return {
      month: raw,
      month_key: normalizedDate.value,
      month_order: month >= 4 ? month - 4 : month + 8,
    };
  }

  const monthMatch = raw.match(/^(\d{1,2})月?$/);
  if (monthMatch) {
    const month = Number(monthMatch[1]);
    if (month >= 1 && month <= 12) {
      return { month: `${month}月`, month_key: '', month_order: month >= 4 ? month - 4 : month + 8 };
    }
  }

  return { month: raw, month_key: '', month_order: 99 };
}

function normalizeDepreciationSimulationRecord(row = {}) {
  const amount = normalizeAmount(getFirstValue(row, ['金額', 'amount']));
  const month = normalizeDepreciationMonth(getFirstValue(row, ['月', 'month', '年月']));
  return {
    division: getFirstValue(row, ['区分', 'division']),
    depreciation_category: getFirstValue(row, ['償却展開区分', 'depreciation_category']),
    depreciation_category_name: getFirstValue(row, ['償却展開区分名', 'depreciation_category_name']),
    period_type: normalizeDepreciationPeriodType(getFirstValue(row, ['期間種別', 'period_type'])),
    fiscal_period: getFirstValue(row, ['期', 'fiscal_period']).replace(/期$/, ''),
    month: month.month,
    month_key: month.month_key,
    month_order: month.month_order,
    amount: amount.valid ? amount.value : 0,
    amount_valid: amount.valid,
    raw_amount: getFirstValue(row, ['金額', 'amount']),
  };
}

function parseDepreciationSimulationCsv(text) {
  const rows = parseCSV(text).map(normalizeDepreciationSimulationRecord).filter((row) => (
    row.division || row.depreciation_category || row.depreciation_category_name || row.fiscal_period || row.month || row.amount
  ));
  const normalizedRows = rows.filter(row => row.period_type && row.fiscal_period && row.depreciation_category_name);
  return {
    fileType: IMPORT_FILE_TYPES.DEPRECIATION_SIMULATION,
    status: normalizedRows.length > 0 ? 'imported' : 'not_imported',
    message: normalizedRows.length > 0 ? '減価償却シミュレーションデータを取り込みました' : NOT_IMPORTED_MESSAGE,
    rows: normalizedRows,
    byManagementNo: {},
  };
}

function parseUploadedFile(fileType, text) {
  switch (fileType) {
    case IMPORT_FILE_TYPES.BUDGET:
      return parseBudgetCsv(text);
    case IMPORT_FILE_TYPES.VARIANCE_REASON:
      return parseVarianceReasonCsv(text);
    case IMPORT_FILE_TYPES.NEW_PROJECT:
      return parseNewProjectCsv(text);
    case IMPORT_FILE_TYPES.NEW_PROJECT_MASTER:
      return parseNewProjectMasterCsv(text);
    case IMPORT_FILE_TYPES.NEW_PROJECT_MONTHLY_COST:
      return parseNewProjectMonthlyCostCsv(text);
    case IMPORT_FILE_TYPES.NEW_PROJECT_ACTUAL_FORECAST:
      return parseNewProjectCostCsv(text);
    case IMPORT_FILE_TYPES.OASIS_ACTUAL:
      return parseOasisActualCsv(text);
    case IMPORT_FILE_TYPES.DEPRECIATION_SIMULATION:
      return parseDepreciationSimulationCsv(text);
    default:
      throw new Error(`未対応のファイル種別です: ${fileType}`);
  }
}

function summarizeAdditionalData(additionalData) {
  const normalized = normalizeAdditionalDataStore(additionalData);
  return Object.fromEntries(ADDITIONAL_IMPORT_FILE_TYPES.map((fileType) => {
    const entry = normalized[fileType];
    return [fileType, {
      status: entry.status || 'not_imported',
      message: entry.message || NOT_IMPORTED_MESSAGE,
      rowCount: Array.isArray(entry.rows) ? entry.rows.length : 0,
      fileName: entry.fileName || null,
      uploadedAt: entry.uploadedAt || null,
    }];
  }));
}

function firstAdditionalRow(additionalStores, fileType, managementNo) {
  return additionalStores?.[fileType]?.byManagementNo?.[managementNo]?.[0] || null;
}

function mergeAdditionalDataByManagementNo(items, additionalStores) {
  const normalized = normalizeAdditionalDataStore(additionalStores);
  return (items || []).map((item) => {
    const managementNo = item.management_no || '';
    const varianceReason = firstAdditionalRow(normalized, IMPORT_FILE_TYPES.VARIANCE_REASON, managementNo);
    const newProject = firstAdditionalRow(normalized, IMPORT_FILE_TYPES.NEW_PROJECT, managementNo);
    const oasisActual = firstAdditionalRow(normalized, IMPORT_FILE_TYPES.OASIS_ACTUAL, managementNo);
    const depreciationSimulation = firstAdditionalRow(normalized, IMPORT_FILE_TYPES.DEPRECIATION_SIMULATION, managementNo);

    return {
      ...item,
      variance_reason: item.variance_reason || varianceReason?.comment || varianceReason?.reason || '',
      new_project_status: newProject?.status || item.new_project_status || '',
      oasis_actual_amount: oasisActual?.actual_amount ?? item.oasis_actual_amount ?? '',
      depreciation_simulation_amount: depreciationSimulation?.simulation_amount ?? item.depreciation_simulation_amount ?? '',
      additional_data_status: summarizeAdditionalData(normalized),
      additional_data: {
        variance_reason: varianceReason,
        new_project: newProject,
        oasis_actual: oasisActual,
        depreciation_simulation: depreciationSimulation,
      },
    };
  });
}


function buildNewProjectAnalysis() {
  const normalizedAdditional = normalizeAdditionalDataStore(store.additionalData);
  const newProjectRows = normalizedAdditional[IMPORT_FILE_TYPES.NEW_PROJECT]?.rows || [];
  const data = buildUnifiedData();
  const baseItems = data?.items || [];
  const baseByManagementNo = new Map(baseItems.map(item => [item.management_no, item]));
  const grouped = new Map();

  for (const row of newProjectRows) {
    const managementNo = row.management_no || normalizeManagementNo(row);
    if (!managementNo) continue;
    if (!grouped.has(managementNo)) {
      const baseItem = baseByManagementNo.get(managementNo) || {};
      grouped.set(managementNo, {
        management_no: managementNo,
        project_name: row.project_name || baseItem.project_name || '',
        team_name: row.team_name || baseItem.department_name || '',
        owner_name: row.owner_name || baseItem.owner_name || '',
        project_category: row.project_category || baseItem.payment_category || baseItem.budget_category || '',
        it_strategy_category: row.it_strategy_category || row.division || baseItem.system_classification || '',
        expense_event: row.expense_event || baseItem.expense_item_name || '',
        progress_status: row.progress_status || '',
        progress_rate: row.progress_rate,
        production_start_date: row.production_start_date || '',
        memo: row.memo || baseItem.comment || '',
        variance_reason_category: baseItem.variance_reason_category || row.project_category || row.it_strategy_category || '',
        variance_reason: baseItem.variance_reason || row.memo || '',
        comment: baseItem.comment || row.memo || '',
        totalPlan: 0,
        totalForecast: 0,
        totalActual: Number(baseItem.totalActual || 0),
        five_year_expense_total: 0,
        monthly: {},
        source: 'new_project_csv',
      });
    }

    const project = grouped.get(managementNo);
    project.project_name = project.project_name || row.project_name || '';
    project.team_name = project.team_name || row.team_name || '';
    project.owner_name = project.owner_name || row.owner_name || '';
    project.project_category = project.project_category || row.project_category || '';
    project.it_strategy_category = project.it_strategy_category || row.it_strategy_category || row.division || '';
    project.expense_event = project.expense_event || row.expense_event || '';
    project.progress_status = project.progress_status || row.progress_status || '';
    if (project.progress_rate === null || project.progress_rate === undefined) project.progress_rate = row.progress_rate;
    project.production_start_date = project.production_start_date || row.production_start_date || '';
    project.memo = project.memo || row.memo || '';
    project.variance_reason = project.variance_reason || row.memo || '';
    project.comment = project.comment || row.memo || '';
    project.five_year_expense_total = Math.max(project.five_year_expense_total || 0, Number(row.five_year_expense_total || 0));

    if (row.target_year_month) {
      if (!project.monthly[row.target_year_month]) project.monthly[row.target_year_month] = { plan: 0, forecast: 0, actual: 0 };
      project.monthly[row.target_year_month].plan += Number(row.budget_amount || 0);
      project.monthly[row.target_year_month].forecast += Number(row.forecast_amount || 0);
    }
    project.totalPlan += Number(row.budget_amount || 0);
    project.totalForecast += Number(row.forecast_amount || 0);
  }

  for (const baseItem of baseItems) {
    const hasAdditional = grouped.has(baseItem.management_no);
    const looksNewProject = /新規|new/i.test(`${baseItem.project_name || ''} ${baseItem.budget_category || ''} ${baseItem.payment_category || ''}`);
    if (hasAdditional || !looksNewProject) continue;
    grouped.set(baseItem.management_no, {
      ...baseItem,
      team_name: baseItem.department_name || '',
      project_category: baseItem.payment_category || baseItem.budget_category || '',
      it_strategy_category: baseItem.system_classification || '',
      expense_event: baseItem.expense_item_name || '',
      progress_status: baseItem.new_project_status || '',
      progress_rate: parseProgressRate(baseItem.new_project_status),
      memo: baseItem.comment || '',
      source: 'budget_csv',
    });
  }

  const projects = [...grouped.values()].map((project) => {
    const plan = Number(project.totalPlan || 0) || Number(project.five_year_expense_total || 0);
    const comparable = Number(project.totalActual || 0) > 0 ? Number(project.totalActual || 0) : Number(project.totalForecast || 0);
    const costBurnRate = plan > 0 ? (comparable / plan) * 100 : 0;
    const progressRate = project.progress_rate === null || project.progress_rate === undefined ? costBurnRate : Number(project.progress_rate || 0);
    const varianceAmount = plan - comparable;
    return {
      ...project,
      totalPlan: plan,
      comparableAmount: comparable,
      cost_burn_rate: Math.round(costBurnRate * 10) / 10,
      progress_rate: Math.round(progressRate * 10) / 10,
      variance_amount: varianceAmount,
      variance_rate: plan > 0 ? Math.round((varianceAmount / plan) * 1000) / 10 : 0,
      variance_reason_category: project.variance_reason_category || project.project_category || project.it_strategy_category || '未分類',
      variance_reason: project.variance_reason || project.memo || '未入力',
      comment: project.comment || project.memo || '',
    };
  }).sort((a, b) => Math.abs(b.variance_amount) - Math.abs(a.variance_amount));

  const groupSummary = {};
  for (const project of projects) {
    const category = project.project_category || '未設定';
    const strategy = project.it_strategy_category || '未設定';
    for (const [type, key] of [['project_category', category], ['it_strategy_category', strategy]]) {
      const summaryKey = `${type}:${key}`;
      if (!groupSummary[summaryKey]) groupSummary[summaryKey] = { type, key, plan: 0, comparable: 0, variance: 0, itemCount: 0 };
      groupSummary[summaryKey].plan += Number(project.totalPlan || 0);
      groupSummary[summaryKey].comparable += Number(project.comparableAmount || 0);
      groupSummary[summaryKey].variance += Number(project.variance_amount || 0);
      groupSummary[summaryKey].itemCount += 1;
    }
  }

  return {
    projects,
    groupSummary: Object.values(groupSummary).sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)),
    sourceRowCount: newProjectRows.length,
    hasNewProjectCsv: newProjectRows.length > 0,
  };
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

function normalizeVarianceReasonCategory(value) {
  return safeString(value || '');
}

function makeItemKey(managementNo, itemNo, fiscalPeriod, targetYm = '') {
  return `${managementNo || ''}|${itemNo || ''}|${fiscalPeriod || ''}|${targetYm || ''}`;
}

function getCurrentYYYYMM() {
  const now = new Date();
  return Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);
}

function normalizeVarianceReasonRecord(record = {}) {
  return {
    ...record,
    variance_reason: record.variance_reason || record.factor_type || '',
    variance_reason_category: record.variance_reason_category || record.reason_category || '',
    comment: record.comment || '',
    comment_updated_month: record.comment_updated_month || record.updated_month || record.target_year_month || '',
    comment_updated_by: record.comment_updated_by || record.updated_by || '',
  };
}

function buildVarianceReasonMap(varianceReasons = {}) {
  const map = new Map();
  Object.values(varianceReasons || {}).forEach((record) => {
    if (!record || typeof record !== 'object') return;
    const key = makeItemKey(record.management_no, record.item_no, record.fiscal_period, record.target_year_month);
    map.set(key, normalizeVarianceReasonRecord(record));
  });
  return map;
}

// =============================================
// Build unified data from new schema
// =============================================
function buildUnifiedData() {
  if ((!store.master || store.master.length === 0) && (!store.detail || store.detail.length === 0)) return null;

  // Step 1: Build master lookup map: management_no + item_no -> master info
  const masterMap = {};
  const allPeriods = new Set();
  const allSystems = {};       // system_code -> { name, classification }
  const allDepartments = new Set();
  const allBudgetCategories = new Set();
  const allExpenseItems = {};  // expense_item_code -> expense_item_name

  if (store.master && store.master.length > 0) {
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
  const varianceReasonMap = buildVarianceReasonMap(store.varianceReasons);

  if (store.detail && store.detail.length > 0) {
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
          contract_start_date: masterRow.contract_start_date || '',
          contract_start_date_status: masterRow.contract_start_date_status || '',
          contract_start_date_warning: masterRow.contract_start_date_warning || '',
          contract_end_date: masterRow.contract_end_date || '',
          contract_end_date_status: masterRow.contract_end_date_status || '',
          contract_end_date_warning: masterRow.contract_end_date_warning || '',
          contract_period: masterRow.contract_period || '',
          next_renewal_month: masterRow.next_renewal_month || '',
          next_renewal_month_status: masterRow.next_renewal_month_status || '',
          next_renewal_month_warning: masterRow.next_renewal_month_warning || '',
          note: masterRow.note || '',
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
        item.monthly[ym] = { plan: 0, forecast: 0, actual: 0, variance_reason: '', variance_reason_category: '', comment: '' };
      }
      item.monthly[ym][vtype] += amount;
    }
  }

  // If only master uploaded (no detail), create items from master contract data
  if (store.master && store.master.length > 0 && (!store.detail || store.detail.length === 0)) {
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
        contract_start_date: row.contract_start_date || '',
        contract_start_date_status: row.contract_start_date_status || '',
        contract_start_date_warning: row.contract_start_date_warning || '',
        contract_end_date: row.contract_end_date || '',
        contract_end_date_status: row.contract_end_date_status || '',
        contract_end_date_warning: row.contract_end_date_warning || '',
        contract_period: row.contract_period || '',
        next_renewal_month: row.next_renewal_month || '',
        next_renewal_month_status: row.next_renewal_month_status || '',
        next_renewal_month_warning: row.next_renewal_month_warning || '',
        note: row.note || '',
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

  // Attach variance reasons/comments to items and monthly cells.
  for (const item of items) {
    item.variance_reason = '';
    item.variance_reason_category = '';
    item.comment = '';
    item.comment_updated_month = '';
    item.comment_updated_by = '';
    item.monthlyComments = {};

    const matchingReasons = [...varianceReasonMap.values()].filter(reason => (
      reason.management_no === item.management_no &&
      reason.item_no === item.item_no &&
      reason.fiscal_period === item.fiscal_period
    ));
    const monthlyYms = new Set([
      ...Object.keys(item.monthly),
      ...matchingReasons.map(reason => reason.target_year_month).filter(Boolean),
    ]);

    const reasons = [...monthlyYms].sort().map((ym) => {
      if (!item.monthly[ym]) {
        item.monthly[ym] = { plan: 0, forecast: 0, actual: 0, variance_reason: '', variance_reason_category: '', comment: '' };
        allYearMonths.add(ym);
      }

      const reason = varianceReasonMap.get(makeItemKey(item.management_no, item.item_no, item.fiscal_period, ym));
      if (!reason) return null;

      item.monthly[ym].variance_reason = reason.variance_reason || '';
      item.monthly[ym].variance_reason_category = reason.variance_reason_category || '';
      item.monthly[ym].comment = reason.comment || '';
      item.monthlyComments[ym] = {
        variance_reason: reason.variance_reason || '',
        variance_reason_category: reason.variance_reason_category || '',
        comment: reason.comment || '',
        comment_updated_month: reason.comment_updated_month || '',
        comment_updated_by: reason.comment_updated_by || '',
      };
      return reason;
    }).filter(Boolean);

    const latestReason = reasons.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0];
    if (latestReason) {
      item.variance_reason = latestReason.variance_reason || '';
      item.variance_reason_category = latestReason.variance_reason_category || '';
      item.comment = latestReason.comment || '';
      item.comment_updated_month = latestReason.comment_updated_month || '';
      item.comment_updated_by = latestReason.comment_updated_by || '';
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

  const mergedItems = mergeAdditionalDataByManagementNo(items, store.additionalData);

  return {
    items: mergedItems,
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


function monthsBetweenYearMonths(fromYm, toYm) {
  const from = parseYM(fromYm);
  const to = parseYM(toYm);
  if (!from || !to) return null;
  return (to.year - from.year) * 12 + (to.month - from.month);
}

function detectContractAlerts(contract = {}, baseYearMonth = getCurrentYYYYMM()) {
  const renewalMonth = contract.next_renewal_month || contract.renewal_month || '';
  const monthsUntilRenewal = renewalMonth ? monthsBetweenYearMonths(String(baseYearMonth), renewalMonth) : null;
  const hasInvalidDates = [
    contract.contract_start_date_status,
    contract.contract_end_date_status,
    contract.next_renewal_month_status,
  ].includes('invalid');
  const reviewRequired = hasInvalidDates || monthsUntilRenewal === null || monthsUntilRenewal <= 3;
  let alertType = '通常';
  if (hasInvalidDates) alertType = '日付確認';
  else if (monthsUntilRenewal === null) alertType = '更新月未設定';
  else if (monthsUntilRenewal < 0) alertType = '更新期限超過';
  else if (monthsUntilRenewal <= 3) alertType = '更新間近';

  return {
    months_until_renewal: monthsUntilRenewal,
    review_required: reviewRequired,
    alert_type: alertType,
  };
}

function buildContractRecord(item, overrides = {}, baseYearMonth = getCurrentYYYYMM()) {
  const contract = {
    contract_id: overrides.contract_id || item.contract_no || overrides.contract_no || '',
    contract_no: overrides.contract_no || item.contract_no || '',
    vendor_name: overrides.vendor_name || item.vendor_name || '未設定ベンダー',
    project_name: overrides.project_name || item.project_name || '',
    system_name: overrides.system_name || item.system_name || '',
    payment_category: overrides.payment_category ?? item.payment_category ?? '',
    contract_start_date: overrides.contract_start_date ?? item.contract_start_date ?? '',
    contract_start_date_status: overrides.contract_start_date_status ?? item.contract_start_date_status ?? '',
    contract_start_date_warning: overrides.contract_start_date_warning ?? item.contract_start_date_warning ?? '',
    contract_end_date: overrides.contract_end_date ?? item.contract_end_date ?? '',
    contract_end_date_status: overrides.contract_end_date_status ?? item.contract_end_date_status ?? '',
    contract_end_date_warning: overrides.contract_end_date_warning ?? item.contract_end_date_warning ?? '',
    contract_period: overrides.contract_period ?? item.contract_period ?? '',
    next_renewal_month: overrides.next_renewal_month ?? item.next_renewal_month ?? overrides.renewal_month ?? '',
    next_renewal_month_status: overrides.next_renewal_month_status ?? item.next_renewal_month_status ?? '',
    next_renewal_month_warning: overrides.next_renewal_month_warning ?? item.next_renewal_month_warning ?? '',
    renewal_month: overrides.renewal_month || overrides.next_renewal_month || item.next_renewal_month || '',
    decision_status: overrides.decision_status || '未判断',
    decision_note: overrides.decision_note || '',
    annual_amount: toNum(overrides.annual_amount ?? item.contract_amount ?? item.totalPlan ?? 0),
    note: overrides.note ?? item.note ?? '',
    updated_at: new Date().toISOString(),
  };
  Object.assign(contract, detectContractAlerts(contract, baseYearMonth));
  return contract;
}

function summarizeTargetYearMonthRange(detailRows = []) {
  const months = [...new Set((detailRows || []).map(row => row.target_year_month).filter(Boolean))].sort();
  if (!months.length) return '';
  return months.length === 1 ? months[0] : `${months[0]}〜${months[months.length - 1]}`;
}

// =============================================
// API Routes
// =============================================

// Upload CSV file by import type
function budgetImportDryRunResponse({ parsed, fileType, fileName }) {
  return {
    dryRun: true,
    fileType,
    csvFileName: fileName,
    totalRows: parsed.totalRows,
    successRows: parsed.successRows,
    warningCount: parsed.warningCount,
    errorCount: parsed.errorCount,
    skippedRows: parsed.skippedRows,
    issues: parsed.issues || [],
    targetPeriods: [...new Set((parsed.detail || []).map(row => row.fiscal_period).filter(Boolean))].sort(),
    targetYearMonthRange: summarizeTargetYearMonthRange(parsed.detail || []),
    message: parsed.message || '取込前チェックが完了しました',
  };
}

function applyParsedImport({ fileType, parsed, fileName, uploadedAt }) {
  if (fileType === IMPORT_FILE_TYPES.BUDGET) {
    store.rawRows = parsed.rows;
    store.master = parsed.master;
    store.detail = parsed.detail;
    store.csvFileName = fileName;
    store.uploadedAt = uploadedAt;

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
          updated_at: uploadedAt,
        };
      });
    }

    persistStore();

    return {
      message: parsed.message || 'アップロード完了',
      fileType,
      csvFileName: store.csvFileName,
      masterRows: store.master.length,
      detailRows: store.detail.length,
      itemCount: data ? data.items.length : 0,
      systemCount: agg ? agg.systemNames.length : 0,
      periodCount: agg ? agg.periods.length : 0,
      classificationCount: agg ? agg.classifications.length : 0,
      additionalData: summarizeAdditionalData(store.additionalData),
    };
  }

  if (!ADDITIONAL_IMPORT_FILE_TYPES.includes(fileType)) {
    const error = new Error(`未対応のファイル種別です: ${fileType}`);
    error.statusCode = 400;
    throw error;
  }

  store.additionalData[fileType] = {
    status: parsed.status,
    message: parsed.message,
    rows: parsed.rows || [],
    byManagementNo: parsed.byManagementNo || {},
    fileName: parsed.status === 'imported' ? fileName : null,
    uploadedAt: parsed.status === 'imported' ? uploadedAt : null,
  };

  if (fileType === IMPORT_FILE_TYPES.VARIANCE_REASON && parsed.status === 'imported') {
    for (const row of parsed.rows || []) {
      if (!row.management_no) continue;
      const key = makeItemKey(row.management_no, row.item_no, row.fiscal_period, row.target_year_month);
      store.varianceReasons[key] = {
        key,
        management_no: row.management_no,
        item_no: row.item_no || '',
        fiscal_period: row.fiscal_period || '',
        target_year_month: row.target_year_month || '',
        reason_category: row.reason_category || '未分類',
        factor_type: row.factor_type || '未分類',
        comment: row.comment || '',
        updated_at: uploadedAt,
      };
    }
  }

  persistStore();

  return {
    message: parsed.message,
    fileType,
    status: parsed.status,
    rowCount: (parsed.rows || []).length,
    additionalData: summarizeAdditionalData(store.additionalData),
  };
}

function handleParsedImport(req, res, { fileType, text, fileName }) {
  try {
    const parsed = parseUploadedFile(fileType, text);
    const uploadedAt = new Date().toISOString();

    if (fileType === IMPORT_FILE_TYPES.BUDGET
      && String(req.body.dryRun || '').toLowerCase() === 'true'
      && String(req.body.confirmImport || '').toLowerCase() !== 'true') {
      persistStore();
      return res.json(budgetImportDryRunResponse({ parsed, fileType, fileName }));
    }

    return res.json(applyParsedImport({ fileType, parsed, fileName, uploadedAt }));
  } catch (e) {
    console.error('Import error:', e);
    res.status(e.statusCode || 500).json({ error: 'データ解析エラー: ' + e.message });
  }
}

// Upload CSV file by import type
app.post('/api/upload', upload.single('budget_csv'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'CSVファイル（budget_csv）をアップロードしてください' });
  }

  return handleParsedImport(req, res, {
    fileType: String(req.body.fileType || IMPORT_FILE_TYPES.BUDGET),
    text: req.file.buffer.toString('utf-8').replace(/^\uFEFF/, ''),
    fileName: req.file.originalname,
  });
});

// Status
app.get('/api/status', (_, res) => {
  const data = buildUnifiedData();
  const agg = data ? getAggregations(data) : null;
  res.json({
    hasData: store.master.length > 0 || store.detail.length > 0 || ADDITIONAL_IMPORT_FILE_TYPES.some(fileType => (store.additionalData?.[fileType]?.rows || []).length > 0),
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
    importFileTypes: IMPORT_FILE_TYPES,
    additionalData: summarizeAdditionalData(store.additionalData),
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

// Analysis: new projects from 新規案件個票.csv
app.get('/api/analysis/new-projects', (_, res) => {
  res.json({ data: buildNewProjectAnalysis() });
});

app.get('/api/analysis/new-project-costs', (_, res) => {
  const normalizedAdditional = normalizeAdditionalDataStore(store.additionalData);
  const masterRows = normalizedAdditional[IMPORT_FILE_TYPES.NEW_PROJECT_MASTER]?.rows || [];
  const monthlyRows = normalizedAdditional[IMPORT_FILE_TYPES.NEW_PROJECT_MONTHLY_COST]?.rows || [];
  const legacyRows = normalizedAdditional[IMPORT_FILE_TYPES.NEW_PROJECT_ACTUAL_FORECAST]?.rows || [];
  const useTwoFileMode = masterRows.length > 0 || monthlyRows.length > 0;
  if (useTwoFileMode && (!masterRows.length || !monthlyRows.length)) {
    return res.status(400).json({ error: '新規案件データは2ファイル構成です。new_project_master.csv と new_project_monthly_cost.csv の両方を取り込んでください。', missing: { new_project_master: masterRows.length === 0, new_project_monthly_cost: monthlyRows.length === 0 } });
  }
  const rows = useTwoFileMode ? monthlyRows.map((m) => {
    const master = masterRows.find((x) => x.management_no === m.management_no) || {};
    const status = master.progress_status || '未設定';
    const memo = m.memo || '';
    const budget = Number(m.budget_amount || 0);
    const forecast = Number(m.forecast_amount || 0);
    const variance = Number(m.variance_amount ?? (forecast - budget));
    return {
      management_no: m.management_no || '', project_name: master.project_name || `(案件名未設定:${m.management_no || '不明'})`, owner_name: master.owner_name || '',
      production_start_date: master.production_start_date || '', it_investment_simulation_no: master.it_investment_simulation_no || '未設定', project_category: master.project_category || '未設定',
      progress_status: status, progress_rate: master.progress_rate ?? deriveProgressRateFromStatus(status), memo, expense_event: m.expense_event || '未設定', cost_group: m.cost_group || '未分類', target_year_month: m.target_year_month || '',
      budget_amount: budget, forecast_amount: forecast, variance_amount: variance, variance_rate: m.variance_rate ?? (budget ? variance / budget : null), five_year_expense_total: Number(m.five_year_expense_total || 0), has_budget: m.has_budget || '',
      variance_reason: deriveVarianceReason(status, memo, variance),
    };
  }) : legacyRows;

  const projectMap = new Map(); const monthlyMap = new Map();
  const fiveYearDedupGlobal = new Set();
  const byProjectCategory = {}; const byItInvestmentNo = {}; const byCostGroup = {}; const byVarianceReason = {};
  const bump = (obj, key) => { if (!obj[key]) obj[key] = { key, budgetAmount: 0, forecastAmount: 0, varianceAmount: 0, investmentBudgetAmount: 0, investmentForecastAmount: 0, investmentVarianceAmount: 0, operationBudgetAmount: 0, operationForecastAmount: 0, operationVarianceAmount: 0, projectSet: new Set(), names: [] }; return obj[key]; };

  for (const r of rows) {
    const key = r.management_no || '';
    if (!projectMap.has(key)) projectMap.set(key, { managementNo: key, projectName: r.project_name, owner: r.owner_name, plannedStartDate: r.production_start_date, itInvestmentNo: r.it_investment_simulation_no, projectCategory: r.project_category, progressStatus: r.progress_status, progressRate: r.progress_rate, budgetAmount: 0, forecastAmount: 0, varianceAmount: 0, fiveYearCost: 0, memo: r.memo, memoSet: new Set(), hasBudgetSet: new Set(), fiveYearDedup: new Set() });
    const p = projectMap.get(key);
    p.budgetAmount += Number(r.budget_amount || 0); p.forecastAmount += Number(r.forecast_amount || 0); p.varianceAmount += Number(r.variance_amount || 0);
    if (r.memo) p.memoSet.add(r.memo);
    if (r.has_budget) p.hasBudgetSet.add(r.has_budget);
    const expenseKey = `${key}__${r.expense_event || '未設定'}`;
    if (!p.fiveYearDedup.has(expenseKey)) { p.fiveYearDedup.add(expenseKey); p.fiveYearCost += Number(r.five_year_expense_total || 0); }
    if (!fiveYearDedupGlobal.has(expenseKey)) fiveYearDedupGlobal.add(expenseKey);
    const month = r.target_year_month || '未設定';
    if (!monthlyMap.has(month)) monthlyMap.set(month, { targetMonth: month, budgetAmount: 0, forecastAmount: 0, varianceAmount: 0 });
    const mv = monthlyMap.get(month); mv.budgetAmount += Number(r.budget_amount || 0); mv.forecastAmount += Number(r.forecast_amount || 0); mv.varianceAmount += Number(r.variance_amount || 0);

    const groups = [ [byProjectCategory, r.project_category || '未設定'], [byItInvestmentNo, r.it_investment_simulation_no || '未設定'], [byCostGroup, r.cost_group || '未分類'], [byVarianceReason, deriveVarianceReason(r.progress_status, r.memo, r.variance_amount)] ];
    for (const [obj, gk] of groups) {
      const g = bump(obj, gk); const b=Number(r.budget_amount||0), f=Number(r.forecast_amount||0), v=Number(r.variance_amount||0);
      g.budgetAmount += b; g.forecastAmount += f; g.varianceAmount += v; g.projectSet.add(key);
      if (r.project_name && g.names.length < 3 && !g.names.includes(r.project_name)) g.names.push(r.project_name);
      if ((r.cost_group||'').includes('投資')) { g.investmentBudgetAmount += b; g.investmentForecastAmount += f; g.investmentVarianceAmount += v; }
      if ((r.cost_group||'').includes('運用')) { g.operationBudgetAmount += b; g.operationForecastAmount += f; g.operationVarianceAmount += v; }
    }
  }

  const projectRanking = [...projectMap.values()].map((p) => {
    const varianceRate = p.budgetAmount ? p.varianceAmount / p.budgetAmount : null;
    const costConsumptionRate = p.budgetAmount ? (p.forecastAmount / p.budgetAmount) * 100 : null;
    const memoSummary = [...p.memoSet];
    const hasBudgetSummaryList = [...p.hasBudgetSet];
    const varianceReason = deriveVarianceReason(p.progressStatus, memoSummary.join(' '), p.varianceAmount);
    const diff = (costConsumptionRate ?? 0) - (p.progressRate ?? 0);
    let alertLevel = 'normal';
    if ((costConsumptionRate ?? 0) >= 80 && (p.progressRate ?? 0) < 50) alertLevel = 'alert';
    else if ((p.progressRate ?? 0) >= 80 && (costConsumptionRate ?? 0) < 50) alertLevel = 'progressAhead';
    else if (diff >= 40) alertLevel = 'alert'; else if (diff >= 20) alertLevel = 'watch';
    return { ...p, varianceRate, costConsumptionRate, varianceReason, memoSummary: memoSummary.length <= 1 ? (memoSummary[0] || '') : `${memoSummary.slice(0, 2).join(' / ')} 他${memoSummary.length - 2}件`, hasBudgetSummary: hasBudgetSummaryList.join('/'), alertLevel };
  }).sort((a, b) => Math.abs(b.varianceAmount) - Math.abs(a.varianceAmount));

  const summary = { projectCount: projectRanking.length, totalBudget: 0, totalForecast: 0, totalVariance: 0, totalFiveYearCost: 0, investmentAmount: 0, operationAmount: 0, varianceProjectCount: 0, notStartedProjectCount: 0, alertProjectCount: 0 };
  for (const p of projectRanking) {
    summary.totalBudget += p.budgetAmount; summary.totalForecast += p.forecastAmount; summary.totalVariance += p.varianceAmount; summary.totalFiveYearCost += p.fiveYearCost;
    if (p.varianceAmount !== 0) summary.varianceProjectCount += 1;
    if (/未着手/.test(p.progressStatus || '')) summary.notStartedProjectCount += 1;
    if (p.alertLevel !== 'normal') summary.alertProjectCount += 1;
  }
  summary.varianceRate = summary.totalBudget ? summary.totalVariance / summary.totalBudget : null;
  summary.investmentAmount = Object.values(byCostGroup).find(v => (v.key || '').includes('投資'))?.forecastAmount || 0;
  summary.operationAmount = Object.values(byCostGroup).find(v => (v.key || '').includes('運用'))?.forecastAmount || 0;

  const progressCostMatrix = projectRanking.map(p => ({ managementNo: p.managementNo, projectName: p.projectName, progressRate: p.progressRate, costConsumptionRate: p.costConsumptionRate, budgetAmount: p.budgetAmount, forecastAmount: p.forecastAmount, varianceAmount: p.varianceAmount, fiveYearCost: p.fiveYearCost, projectCategory: p.projectCategory, progressStatus: p.progressStatus, alertLevel: p.alertLevel }));
  const detailRows = rows.map((r) => { const budget = Number(r.budget_amount || 0); const forecast = Number(r.forecast_amount || 0); const variance = Number(r.variance_amount || (forecast - budget)); const ccr = budget ? (forecast / budget) * 100 : null; const pr = r.progress_rate; const diff = (ccr ?? 0) - (pr ?? 0); let alertLevel='normal'; if ((ccr ?? 0)>=80 && (pr ?? 0)<50) alertLevel='alert'; else if ((pr ?? 0)>=80 && (ccr ?? 0)<50) alertLevel='progressAhead'; else if (diff>=40) alertLevel='alert'; else if (diff>=20) alertLevel='watch'; return { managementNo:r.management_no||'', projectName:r.project_name, owner:r.owner_name, plannedStartDate:r.production_start_date, itInvestmentNo:r.it_investment_simulation_no, projectCategory:r.project_category, progressStatus:r.progress_status, progressRate:r.progress_rate, expenseEvent:r.expense_event, costGroup:r.cost_group, hasBudget:r.has_budget||'', fiveYearCost:Number(r.five_year_expense_total||0), targetMonth:r.target_year_month, budgetAmount:budget, forecastAmount:forecast, varianceAmount:variance, varianceRate: budget ? variance / budget : null, costConsumptionRate: ccr, varianceReason:deriveVarianceReason(r.progress_status, r.memo, variance), memo:r.memo, alertLevel }; });

  const toComp = (v, label) => ({ [label]: v.key, projectCount: v.projectSet.size, budgetAmount: v.budgetAmount, forecastAmount: v.forecastAmount, varianceAmount: v.varianceAmount, investmentBudgetAmount: v.investmentBudgetAmount, investmentForecastAmount: v.investmentForecastAmount, investmentVarianceAmount: v.investmentVarianceAmount, operationBudgetAmount: v.operationBudgetAmount, operationForecastAmount: v.operationForecastAmount, operationVarianceAmount: v.operationVarianceAmount });
  res.json({ summary, projectRanking, progressCostMatrix, byProjectCategory: Object.values(byProjectCategory).map(v => toComp(v, 'projectCategory')), byItInvestmentNo: Object.values(byItInvestmentNo).map(v => toComp(v, 'itInvestmentNo')), byItStrategy: Object.values(byItInvestmentNo).map(v => ({ itInvestmentNo: v.key, projectCount: v.projectSet.size, budgetAmount: v.budgetAmount, forecastAmount: v.forecastAmount, varianceAmount: v.varianceAmount })), byCostGroup: Object.values(byCostGroup).map(v => ({ costGroup: v.key, projectCount: v.projectSet.size, budgetAmount: v.budgetAmount, forecastAmount: v.forecastAmount, varianceAmount: v.varianceAmount })), byVarianceReason: Object.values(byVarianceReason).map(v => ({ varianceReason: v.key, projectCount: v.projectSet.size, budgetAmount: v.budgetAmount, forecastAmount: v.forecastAmount, varianceAmount: v.varianceAmount, mainProjects: v.names.slice(0, 3) })), monthlyTrend: [...monthlyMap.values()].sort((a, b) => String(a.targetMonth).localeCompare(String(b.targetMonth))), detailRows });
});


app.get('/api/analysis/oacis-actual', (_, res) => {
  const rows = normalizeAdditionalDataStore(store.additionalData)[IMPORT_FILE_TYPES.OASIS_ACTUAL]?.rows || [];
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.actual_amount || 0), 0);
  const expenseSet = new Set();
  const supplierSet = new Set();
  let yojitsuNoPresentCount = 0;
  let yojitsuNoMissingCount = 0;
  let yojitsuNoPresentAmount = 0;
  let yojitsuNoMissingAmount = 0;
  const byExpenseMap = new Map();
  const bySupplierMap = new Map();
  const byYojitsuMap = new Map();
  const missingYojitsuNoRows = [];
  const bump = (container, key) => { container.set(key, (container.get(key) || 0) + 1); };
  for (const row of rows) {
    const amount = Number(row.actual_amount || 0);
    const expenseCode = row.expense_event_code || '未設定';
    const expenseName = row.expense_event_name || '未設定';
    const supplier = row.supplier || 'サプライヤ未設定';
    const yojitsuNo = row.yojitsu_no || '予実番号未設定';
    expenseSet.add(`${expenseCode}\u0001${expenseName}`);
    supplierSet.add(supplier);
    const expenseKey = `${expenseCode}\u0001${expenseName}`;
    if (!byExpenseMap.has(expenseKey)) byExpenseMap.set(expenseKey, { expense_event_code: expenseCode, expense_event_name: expenseName, amount: 0, rowCount: 0 });
    const expenseItem = byExpenseMap.get(expenseKey);
    expenseItem.amount += amount; expenseItem.rowCount += 1;
    if (!bySupplierMap.has(supplier)) bySupplierMap.set(supplier, { supplier, amount: 0, rowCount: 0, eventCounter: new Map() });
    const supplierItem = bySupplierMap.get(supplier);
    supplierItem.amount += amount; supplierItem.rowCount += 1; bump(supplierItem.eventCounter, expenseName);
    if (!byYojitsuMap.has(yojitsuNo)) byYojitsuMap.set(yojitsuNo, { yojitsu_no: yojitsuNo, amount: 0, rowCount: 0, eventCounter: new Map(), supplierCounter: new Map() });
    const yojitsuItem = byYojitsuMap.get(yojitsuNo);
    yojitsuItem.amount += amount; yojitsuItem.rowCount += 1; bump(yojitsuItem.eventCounter, expenseName); bump(yojitsuItem.supplierCounter, supplier);
    if (yojitsuNo === '予実番号未設定') {
      yojitsuNoMissingCount += 1;
      yojitsuNoMissingAmount += amount;
      if (missingYojitsuNoRows.length < 100) {
        missingYojitsuNoRows.push({
          accounting_date: row.accounting_date || '',
          actual_department_name: row.actual_department_name || '',
          expense_event_name: expenseName,
          expense_event_detail_name: row.expense_event_detail_name || '',
          supplier,
          amount,
          journal_summary: row.journal_summary || '',
          journal_detail_summary: row.journal_detail_summary || '',
          invoice_no: row.invoice_no || '',
        });
      }
    } else {
      yojitsuNoPresentCount += 1;
      yojitsuNoPresentAmount += amount;
    }
  }
  const topFromCounter = (counter) => [...counter.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '未設定';
  const ranked = (arr) => arr.sort((a, b) => b.amount - a.amount).slice(0, 20);
  const byExpenseEvent = ranked([...byExpenseMap.values()]).map(item => ({ ...item, shareRate: totalAmount ? item.amount / totalAmount * 100 : 0 }));
  const bySupplier = ranked([...bySupplierMap.values()]).map(item => ({ supplier: item.supplier, amount: item.amount, rowCount: item.rowCount, shareRate: totalAmount ? item.amount / totalAmount * 100 : 0, mainExpenseEventName: topFromCounter(item.eventCounter) }));
  const byYojitsuNo = ranked([...byYojitsuMap.values()]).map(item => ({ yojitsu_no: item.yojitsu_no, amount: item.amount, rowCount: item.rowCount, mainExpenseEventName: topFromCounter(item.eventCounter), mainSupplier: topFromCounter(item.supplierCounter) }));
  res.json({
    summary: { totalAmount, rowCount: rows.length, expenseEventCount: expenseSet.size, supplierCount: supplierSet.size, yojitsuNoPresentCount, yojitsuNoMissingCount, yojitsuNoPresentAmount, yojitsuNoMissingAmount },
    byExpenseEvent,
    bySupplier,
    byYojitsuNo,
    missingYojitsuNoRows,
  });
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

app.get('/api/additional-data/:fileType', (req, res) => {
  const fileType = String(req.params.fileType || '');
  if (!ADDITIONAL_IMPORT_FILE_TYPES.includes(fileType)) {
    return res.status(404).json({ error: 'Unknown additional data type' });
  }
  const normalized = normalizeAdditionalDataStore(store.additionalData);
  const entry = normalized[fileType] || { rows: [] };
  res.json({
    fileType,
    status: entry.status || 'not_imported',
    message: entry.message || NOT_IMPORTED_MESSAGE,
    data: entry.rows || [],
    rowCount: (entry.rows || []).length,
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
    variance_reason_category: body.variance_reason_category || body.reason_category || '未分類',
    variance_reason: body.variance_reason || body.factor_type || '未分類',
    comment: body.comment || '',
    comment_updated_month: body.comment_updated_month || body.updated_month || body.target_year_month || '',
    comment_updated_by: body.comment_updated_by || body.updated_by || '',
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
  const currentYm = getCurrentYYYYMM();
  res.json({ data: Object.values(store.contracts || {}).map((c) => ({ ...c, ...detectContractAlerts(c, currentYm) })) });
});

app.post('/api/contracts', (req, res) => {
  const body = req.body || {};
  if (!body.contract_no) return res.status(400).json({ error: '契約番号は必須です' });
  const id = body.contract_id || body.contract_no;
  const contractStartDate = normalizeDateString(body.contract_start_date || '');
  const contractEndDate = normalizeDateString(body.contract_end_date || '');
  const nextRenewalMonth = normalizeYearMonthString(body.next_renewal_month || body.renewal_month || '');
  store.contracts[id] = buildContractRecord({}, {
    ...body,
    contract_id: id,
    contract_no: body.contract_no,
    vendor_name: body.vendor_name || '未設定ベンダー',
    contract_start_date: contractStartDate.value,
    contract_start_date_status: contractStartDate.status,
    contract_start_date_warning: contractStartDate.warning,
    contract_end_date: contractEndDate.value,
    contract_end_date_status: contractEndDate.status,
    contract_end_date_warning: contractEndDate.warning,
    next_renewal_month: nextRenewalMonth.value,
    next_renewal_month_status: nextRenewalMonth.status,
    next_renewal_month_warning: nextRenewalMonth.warning,
    renewal_month: nextRenewalMonth.value,
    annual_amount: toNum(body.annual_amount),
  });
  persistStore();
  res.json({ message: '契約情報を保存しました', data: store.contracts[id] });
});

app.get('/api/contracts/renewals', (req, res) => {
  const withinMonths = Number(req.query.withinMonths || 3);
  const currentYm = String(req.query.baseYearMonth || getCurrentYYYYMM());
  const rows = Object.values(store.contracts || {}).map((c) => {
    const alerts = detectContractAlerts(c, currentYm);
    return { ...c, ...alerts };
  }).filter((c) => {
    if (c.months_until_renewal === null || c.months_until_renewal === undefined) return c.review_required;
    return c.review_required || (c.months_until_renewal >= 0 && c.months_until_renewal <= withinMonths);
  }).sort((a, b) => {
    const am = a.months_until_renewal ?? Number.MAX_SAFE_INTEGER;
    const bm = b.months_until_renewal ?? Number.MAX_SAFE_INTEGER;
    return am - bm || String(a.next_renewal_month || a.renewal_month || '').localeCompare(String(b.next_renewal_month || b.renewal_month || ''));
  });
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
          store.contracts[id] = buildContractRecord(item, {
            contract_id: id,
            renewal_month: item.next_renewal_month || renewalMonth,
            next_renewal_month: item.next_renewal_month || renewalMonth,
          });
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
  parseDelimitedRows,
  recordsToObjects,
  IMPORT_FILE_TYPES,
  parseUploadedFile,
  parseBudgetCsv,
  parseVarianceReasonCsv,
  parseNewProjectCsv,
  parseOasisActualCsv,
  parseDepreciationSimulationCsv,
  mergeAdditionalDataByManagementNo,
  parseUnifiedBudgetLayout,
  canonicalizeBudgetRows,
  canonicalBudgetMonthHeader,
  normalizeAmount,
  normalizeDateString,
  safeString,
  buildUnifiedData,
  buildNewProjectAnalysis,
  buildVarianceReasonMap,
  getAggregations,
  emptyStore,
  normalizeStore,
};
