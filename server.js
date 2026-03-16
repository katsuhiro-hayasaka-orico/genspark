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
  master: null,   // parsed budget_master rows
  detail: null,   // parsed budget_detail rows
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

// Fiscal year month order: 4,5,6,7,8,9,10,11,12,1,2,3
const FY_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const MONTH_NAMES = { 4:'4月', 5:'5月', 6:'6月', 7:'7月', 8:'8月', 9:'9月', 10:'10月', 11:'11月', 12:'12月', 1:'1月', 2:'2月', 3:'3月' };

// Merge master + detail to build unified items
function buildUnifiedData() {
  if (!store.master && !store.detail) return null;

  const masterMap = {};
  if (store.master) {
    for (const row of store.master) {
      const key = `${row.system_code}|${row.expense_category}|${row.expense_item}|${row.budget_type}`;
      masterMap[key] = row;
    }
  }

  // Build items from detail (monthly data)
  const items = [];
  const itemIndex = {};

  if (store.detail) {
    for (const row of store.detail) {
      const baseKey = `${row.system_code}|${row.expense_category}|${row.expense_item}`;
      const btype = row.budget_type || 'plan';

      if (!itemIndex[baseKey]) {
        // Look up master info
        const masterKey = `${row.system_code}|${row.expense_category}|${row.expense_item}|${btype}`;
        const masterRow = masterMap[masterKey] || {};
        itemIndex[baseKey] = {
          fiscal_year: row.fiscal_year || masterRow.fiscal_year || '',
          system_code: row.system_code || '',
          system_name: masterRow.system_name || row.system_code || '',
          domain: masterRow.domain || '',
          expense_category: row.expense_category || '',
          expense_item: row.expense_item || '',
          remarks: masterRow.remarks || '',
          plan: { months: {}, annual: 0 },
          forecast: { months: {}, annual: 0 },
          actual: { months: {}, annual: 0 },
        };
        items.push(itemIndex[baseKey]);
      }

      const item = itemIndex[baseKey];

      // Fill monthly values
      const monthData = {};
      let annual = 0;
      for (const m of FY_MONTHS) {
        const colName = `month_${m}`;
        const val = toNum(row[colName]);
        monthData[m] = val;
        annual += val;
      }

      if (btype === 'plan' || btype === 'forecast' || btype === 'actual') {
        item[btype].months = monthData;
        item[btype].annual = annual;
      }

      // Also update master info if found
      const mkey = `${row.system_code}|${row.expense_category}|${row.expense_item}|${btype}`;
      if (masterMap[mkey]) {
        item.system_name = masterMap[mkey].system_name || item.system_name;
        item.domain = masterMap[mkey].domain || item.domain;
        item.remarks = masterMap[mkey].remarks || item.remarks;
      }
    }
  }

  // If only master is uploaded (no detail), build items from master annual_total
  if (store.master && !store.detail) {
    for (const row of store.master) {
      const baseKey = `${row.system_code}|${row.expense_category}|${row.expense_item}`;
      const btype = row.budget_type || 'plan';

      if (!itemIndex[baseKey]) {
        itemIndex[baseKey] = {
          fiscal_year: row.fiscal_year || '',
          system_code: row.system_code || '',
          system_name: row.system_name || row.system_code || '',
          domain: row.domain || '',
          expense_category: row.expense_category || '',
          expense_item: row.expense_item || '',
          remarks: row.remarks || '',
          plan: { months: {}, annual: 0 },
          forecast: { months: {}, annual: 0 },
          actual: { months: {}, annual: 0 },
        };
        items.push(itemIndex[baseKey]);
      }

      const item = itemIndex[baseKey];
      const annualTotal = toNum(row.annual_total);
      item[btype].annual = annualTotal;
      // Distribute evenly for monthly approximation
      for (const m of FY_MONTHS) {
        item[btype].months[m] = Math.round(annualTotal / 12);
      }
    }
  }

  return items;
}

function getAggregations(items) {
  if (!items || items.length === 0) return null;

  // Systems list
  const systems = [...new Set(items.map(i => i.system_name))].filter(Boolean);
  const domains = [...new Set(items.map(i => i.domain))].filter(Boolean);
  const categories = [...new Set(items.map(i => i.expense_category))].filter(Boolean);

  // KPI
  const totalPlan = items.reduce((s, i) => s + i.plan.annual, 0);
  const totalForecast = items.reduce((s, i) => s + i.forecast.annual, 0);
  const totalActual = items.reduce((s, i) => s + i.actual.annual, 0);

  // Monthly aggregation by type
  const monthlyByType = { plan: {}, forecast: {}, actual: {} };
  for (const btype of ['plan', 'forecast', 'actual']) {
    for (const m of FY_MONTHS) {
      monthlyByType[btype][m] = items.reduce((s, i) => s + (i[btype].months[m] || 0), 0);
    }
  }

  // By system
  const bySystem = {};
  for (const item of items) {
    const key = item.system_name || item.system_code;
    if (!bySystem[key]) bySystem[key] = { name: key, plan: 0, forecast: 0, actual: 0 };
    bySystem[key].plan += item.plan.annual;
    bySystem[key].forecast += item.forecast.annual;
    bySystem[key].actual += item.actual.annual;
  }

  // By category
  const byCategory = {};
  for (const item of items) {
    const key = item.expense_category;
    if (!byCategory[key]) byCategory[key] = { name: key, plan: 0, forecast: 0, actual: 0 };
    byCategory[key].plan += item.plan.annual;
    byCategory[key].forecast += item.forecast.annual;
    byCategory[key].actual += item.actual.annual;
  }

  // By domain
  const byDomain = {};
  for (const item of items) {
    const key = item.domain || 'その他';
    if (!byDomain[key]) byDomain[key] = { name: key, plan: 0, forecast: 0, actual: 0 };
    byDomain[key].plan += item.plan.annual;
    byDomain[key].forecast += item.forecast.annual;
    byDomain[key].actual += item.actual.annual;
  }

  // Budget variance (overruns/shortfalls)
  const variances = items.map(item => {
    const planAnnual = item.plan.annual;
    const forecastAnnual = item.forecast.annual;
    const actualAnnual = item.actual.annual;
    const varianceForecast = planAnnual > 0 ? ((forecastAnnual - planAnnual) / planAnnual * 100) : 0;
    const varianceActual = planAnnual > 0 ? ((actualAnnual - planAnnual) / planAnnual * 100) : 0;
    return {
      system_name: item.system_name,
      expense_category: item.expense_category,
      expense_item: item.expense_item,
      plan: planAnnual,
      forecast: forecastAnnual,
      actual: actualAnnual,
      variance_forecast: Math.round(varianceForecast * 10) / 10,
      variance_actual: Math.round(varianceActual * 10) / 10,
      overrun_forecast: forecastAnnual > planAnnual,
      overrun_actual: actualAnnual > planAnnual,
    };
  });

  // Cross-tab: system x category
  const crossTab = {};
  for (const item of items) {
    const sys = item.system_name || item.system_code;
    const cat = item.expense_category;
    if (!crossTab[sys]) crossTab[sys] = {};
    if (!crossTab[sys][cat]) crossTab[sys][cat] = { plan: 0, forecast: 0, actual: 0 };
    crossTab[sys][cat].plan += item.plan.annual;
    crossTab[sys][cat].forecast += item.forecast.annual;
    crossTab[sys][cat].actual += item.actual.annual;
  }

  return {
    systems,
    domains,
    categories,
    totalPlan,
    totalForecast,
    totalActual,
    monthlyByType,
    bySystem: Object.values(bySystem).sort((a, b) => b.plan - a.plan),
    byCategory: Object.values(byCategory).sort((a, b) => b.plan - a.plan),
    byDomain: Object.values(byDomain).sort((a, b) => b.plan - a.plan),
    variances: variances.sort((a, b) => Math.abs(b.variance_actual) - Math.abs(a.variance_actual)),
    crossTab,
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
      const text = buf.toString('utf-8').replace(/^\uFEFF/, ''); // strip BOM
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

    // Build unified data
    const items = buildUnifiedData();
    const agg = getAggregations(items);

    res.json({
      message: 'アップロード完了',
      masterFileName: store.masterFileName,
      detailFileName: store.detailFileName,
      masterRows: masterCount,
      detailRows: detailCount,
      itemCount: items ? items.length : 0,
      systemCount: agg ? agg.systems.length : 0,
      categoryCount: agg ? agg.categories.length : 0,
    });
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ error: 'CSV解析エラー: ' + e.message });
  }
});

// Status
app.get('/api/status', (_, res) => {
  const items = buildUnifiedData();
  const agg = items ? getAggregations(items) : null;
  res.json({
    hasData: !!(store.master || store.detail),
    masterFileName: store.masterFileName,
    detailFileName: store.detailFileName,
    uploadedAt: store.uploadedAt,
    itemCount: items ? items.length : 0,
    systemCount: agg ? agg.systems.length : 0,
    categoryCount: agg ? agg.categories.length : 0,
    systems: agg ? agg.systems : [],
    categories: agg ? agg.categories : [],
    domains: agg ? agg.domains : [],
  });
});

// Dashboard summary
app.get('/api/dashboard/summary', (_, res) => {
  const items = buildUnifiedData();
  if (!items || items.length === 0) return res.json({ kpi: null });
  const agg = getAggregations(items);

  res.json({
    masterFileName: store.masterFileName,
    detailFileName: store.detailFileName,
    kpi: {
      totalPlan: agg.totalPlan,
      totalForecast: agg.totalForecast,
      totalActual: agg.totalActual,
      itemCount: agg.itemCount,
      systemCount: agg.systems.length,
      categoryCount: agg.categories.length,
      domainCount: agg.domains.length,
      varianceForecastPct: agg.totalPlan > 0 ? Math.round((agg.totalForecast - agg.totalPlan) / agg.totalPlan * 1000) / 10 : 0,
      varianceActualPct: agg.totalPlan > 0 ? Math.round((agg.totalActual - agg.totalPlan) / agg.totalPlan * 1000) / 10 : 0,
    },
    monthlyByType: agg.monthlyByType,
    bySystem: agg.bySystem,
    byCategory: agg.byCategory,
    byDomain: agg.byDomain,
    overrunItems: agg.variances.filter(v => v.overrun_actual || v.overrun_forecast).slice(0, 10),
  });
});

// Items list with filters
app.get('/api/items', (req, res) => {
  const items = buildUnifiedData();
  if (!items) return res.json({ items: [], total: 0 });

  let filtered = items;
  const { system, category, domain, search } = req.query;
  if (system) filtered = filtered.filter(i => i.system_name === system || i.system_code === system);
  if (category) filtered = filtered.filter(i => i.expense_category === category);
  if (domain) filtered = filtered.filter(i => i.domain === domain);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(i =>
      (i.system_name || '').toLowerCase().includes(q) ||
      (i.expense_category || '').toLowerCase().includes(q) ||
      (i.expense_item || '').toLowerCase().includes(q) ||
      (i.domain || '').toLowerCase().includes(q)
    );
  }
  res.json({ items: filtered, total: filtered.length });
});

// Analysis: by system
app.get('/api/analysis/by-system', (_, res) => {
  const items = buildUnifiedData();
  if (!items) return res.json({ data: [] });
  const agg = getAggregations(items);
  res.json({ data: agg.bySystem });
});

// Analysis: by category
app.get('/api/analysis/by-category', (_, res) => {
  const items = buildUnifiedData();
  if (!items) return res.json({ data: [] });
  const agg = getAggregations(items);
  res.json({ data: agg.byCategory });
});

// Analysis: by domain
app.get('/api/analysis/by-domain', (_, res) => {
  const items = buildUnifiedData();
  if (!items) return res.json({ data: [] });
  const agg = getAggregations(items);
  res.json({ data: agg.byDomain });
});

// Analysis: monthly time-series
app.get('/api/analysis/monthly', (_, res) => {
  const items = buildUnifiedData();
  if (!items) return res.json({ data: null });
  const agg = getAggregations(items);
  res.json({ data: agg.monthlyByType });
});

// Analysis: variances (overruns/shortfalls)
app.get('/api/analysis/variances', (_, res) => {
  const items = buildUnifiedData();
  if (!items) return res.json({ data: [] });
  const agg = getAggregations(items);
  res.json({ data: agg.variances });
});

// Analysis: cross-tab (system x category)
app.get('/api/analysis/cross-tab', (_, res) => {
  const items = buildUnifiedData();
  if (!items) return res.json({ data: {}, systems: [], categories: [] });
  const agg = getAggregations(items);
  res.json({
    data: agg.crossTab,
    systems: agg.systems,
    categories: agg.categories,
  });
});

// Analysis: system detail (monthly breakdown per system)
app.get('/api/analysis/system-detail', (req, res) => {
  const items = buildUnifiedData();
  if (!items) return res.json({ data: null });
  const { system } = req.query;
  if (!system) return res.json({ data: null });

  const sysItems = items.filter(i => i.system_name === system || i.system_code === system);
  if (sysItems.length === 0) return res.json({ data: null });

  // Aggregate monthly for this system
  const monthlyByType = { plan: {}, forecast: {}, actual: {} };
  for (const btype of ['plan', 'forecast', 'actual']) {
    for (const m of FY_MONTHS) {
      monthlyByType[btype][m] = sysItems.reduce((s, i) => s + (i[btype].months[m] || 0), 0);
    }
  }

  // Categories within this system
  const byCategory = {};
  for (const item of sysItems) {
    const cat = item.expense_category;
    if (!byCategory[cat]) byCategory[cat] = { name: cat, plan: 0, forecast: 0, actual: 0 };
    byCategory[cat].plan += item.plan.annual;
    byCategory[cat].forecast += item.forecast.annual;
    byCategory[cat].actual += item.actual.annual;
  }

  res.json({
    data: {
      system,
      itemCount: sysItems.length,
      totalPlan: sysItems.reduce((s, i) => s + i.plan.annual, 0),
      totalForecast: sysItems.reduce((s, i) => s + i.forecast.annual, 0),
      totalActual: sysItems.reduce((s, i) => s + i.actual.annual, 0),
      monthlyByType,
      byCategory: Object.values(byCategory).sort((a, b) => b.plan - a.plan),
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Budget CSV Viewer`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://0.0.0.0:${PORT}`);
  console.log(`  Status:  Ready for CSV upload (budget_master / budget_detail)\n`);
});
