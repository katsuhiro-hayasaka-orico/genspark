const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Multer setup (memory storage, no disk persistence) ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.xlsm', '.xlsb', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('対応形式: .xlsx, .xls, .xlsm, .xlsb, .csv'));
  }
});

app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'public', 'static')));

// =============================================
// In-memory data store
// =============================================
let store = {
  fileName: null,
  uploadedAt: null,
  fileSize: 0,
  sheets: {},       // raw sheet data keyed by sheet name
  parsed: null,     // parsed budget structure
};

// =============================================
// Excel parsing logic
// =============================================
function parseExcel(buffer, originalName) {
  const opts = { type: 'buffer', cellDates: true, cellNF: true, cellStyles: false };
  // CSV handling
  if (originalName.toLowerCase().endsWith('.csv')) {
    opts.type = 'string';
  }
  const wb = XLSX.read(buffer, opts);
  const sheets = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    sheets[name] = {
      name,
      json,
      range: ws['!ref'] || '',
      rowCount: json.length,
      colCount: json.length > 0 ? Math.max(...json.map(r => r.length)) : 0,
      merges: (ws['!merges'] || []).map(m => ({
        s: { r: m.s.r, c: m.s.c },
        e: { r: m.e.r, c: m.e.c }
      }))
    };
  }
  return { sheetNames: wb.SheetNames, sheets };
}

// Detect if a value is numeric
function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/,/g, '').replace(/\s/g, '').replace(/^[\u00A5\uFFE5\\$]/,'');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// Detect month patterns in header cells
function detectMonthColumns(row) {
  const monthCols = {};
  for (let c = 0; c < row.length; c++) {
    const cell = String(row[c] || '').trim();
    // Japanese month patterns: 4月, 5月 ... 3月
    const mMatch = cell.match(/^(\d{1,2})\s*月$/);
    if (mMatch) {
      const m = parseInt(mMatch[1]);
      if (m >= 1 && m <= 12) monthCols[m] = c;
      continue;
    }
    // Year-month: 2025/4, 2025-04 etc.
    const ymMatch = cell.match(/(?:20\d{2})[\/\-](\d{1,2})/);
    if (ymMatch) {
      const m = parseInt(ymMatch[1]);
      if (m >= 1 && m <= 12) monthCols[m] = c;
      continue;
    }
    // English short months
    const enMonths = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
    const lower = cell.toLowerCase().replace(/\./g,'');
    for (const [en, num] of Object.entries(enMonths)) {
      if (lower === en || lower.startsWith(en)) { monthCols[num] = c; break; }
    }
    // Quarter patterns
    if (/^[QqＱ][1-4]$/.test(cell)) monthCols['q_' + cell] = c;
    // Annual/Total patterns
    if (/^(合計|年間|年度計|累計|Total|Annual|通期|計)$/i.test(cell)) monthCols['annual'] = c;
    // Half-year
    if (/^(上期|下期|[HhＨ][12]|前期|後期|1H|2H)/.test(cell)) monthCols['half_' + cell] = c;
  }
  return monthCols;
}

// Auto-parse budget structure from sheets
function autoParseBudget(sheets) {
  const result = {
    systems: [],
    categories: [],
    items: [],
    monthlyTotals: [],
    categoryTotals: [],
    systemTotals: [],
    sheetAnalysis: {},
    raw: [],
  };

  for (const [sheetName, sheet] of Object.entries(sheets)) {
    const rows = sheet.json;
    if (!rows || rows.length < 2) continue;

    // Try to find header row with month columns
    let headerRowIdx = -1;
    let monthCols = {};
    let labelCols = [];
    let annualCol = -1;

    for (let r = 0; r < Math.min(rows.length, 30); r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      const detected = detectMonthColumns(row);
      const numericMonths = Object.keys(detected).filter(k => !isNaN(parseInt(k)));
      if (numericMonths.length >= 3) {
        headerRowIdx = r;
        monthCols = {};
        for (const k of numericMonths) monthCols[parseInt(k)] = detected[parseInt(k)];
        if (detected['annual'] !== undefined) annualCol = detected['annual'];
        // Label columns: everything before first month column
        const firstMonthCol = Math.min(...Object.values(monthCols));
        for (let c = 0; c < firstMonthCol; c++) labelCols.push(c);
        break;
      }
    }

    const sheetAnalysisEntry = {
      name: sheetName,
      headerRow: headerRowIdx,
      monthColumns: Object.keys(monthCols).length,
      labelColumns: labelCols.length,
      dataRows: 0,
      totalValue: 0,
      type: headerRowIdx >= 0 ? 'structured' : 'generic'
    };

    if (headerRowIdx < 0) {
      // Generic table - store raw data with auto-detection of numeric columns
      const headerRow = rows[0] || [];
      const numericColIndices = [];
      
      // Check rows 1-5 to identify numeric columns
      for (let c = 0; c < (headerRow.length || 0); c++) {
        let numCount = 0;
        for (let r = 1; r < Math.min(rows.length, 6); r++) {
          if (rows[r] && toNum(rows[r][c]) !== null) numCount++;
        }
        if (numCount >= Math.min(rows.length - 1, 3)) numericColIndices.push(c);
      }

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;
        
        // Build labels from non-numeric columns
        const labelValues = [];
        for (let c = 0; c < row.length; c++) {
          if (!numericColIndices.includes(c) && row[c] !== '' && row[c] !== null) {
            labelValues.push(String(row[c]).trim());
          }
        }
        if (labelValues.length === 0 && row.length > 0) labelValues.push(String(row[0] || '').trim());

        // Sum numeric values for annual
        let annual = 0;
        const months = {};
        numericColIndices.forEach((ci, idx) => {
          const v = toNum(row[ci]);
          if (v !== null) {
            months[idx + 1] = v;
            annual += v;
          }
        });

        if (annual === 0 && labelValues.join('').length === 0) continue;

        result.items.push({
          sheet: sheetName,
          system: sheetName,
          category: labelValues[0] || '',
          item: labelValues.slice(1).join(' ') || labelValues[0] || '',
          months,
          annual,
          labels: labelValues,
          type: 'generic'
        });
        sheetAnalysisEntry.dataRows++;
        sheetAnalysisEntry.totalValue += annual;
      }
      
      result.sheetAnalysis[sheetName] = sheetAnalysisEntry;
      continue;
    }

    // Parse structured data rows
    let currentGroup = '';
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      if (row.every(c => c === '' || c === null || c === undefined)) continue;

      // Extract labels
      const labels = labelCols.map(c => String(row[c] || '').trim());
      const nonEmptyLabels = labels.filter(Boolean);

      // Track group headers (rows with label but no numeric data)
      const hasNumericData = Object.values(monthCols).some(ci => toNum(row[ci]) !== null);

      // Skip total/subtotal rows
      const fullText = labels.join('').toLowerCase();
      if (/合計|小計|total|subtotal|計$/.test(fullText) && !/科目|項目/.test(fullText)) continue;

      if (nonEmptyLabels.length > 0 && !hasNumericData) {
        // This might be a group header
        currentGroup = nonEmptyLabels[0];
        continue;
      }

      if (!hasNumericData) continue;

      // Extract monthly values
      const months = {};
      let annual = 0;
      for (const [monthNum, colIdx] of Object.entries(monthCols)) {
        const val = toNum(row[colIdx]);
        if (val !== null) {
          months[parseInt(monthNum)] = val;
          annual += val;
        }
      }

      // Also check the annual column
      if (annualCol >= 0) {
        const annualVal = toNum(row[annualCol]);
        if (annualVal !== null && Math.abs(annualVal) > Math.abs(annual)) {
          annual = annualVal;
        }
      }

      if (annual === 0 && Object.keys(months).length === 0) continue;

      // Determine system / category / item from labels
      let system = '', category = '', itemName = '';
      if (labelCols.length >= 3) {
        system = labels[0] || currentGroup || sheetName;
        category = labels[1] || '';
        itemName = labels[2] || labels[1] || '';
      } else if (labelCols.length === 2) {
        system = labels[0] || currentGroup || sheetName;
        itemName = labels[1] || labels[0] || '';
        category = currentGroup || sheetName;
      } else if (labelCols.length === 1) {
        itemName = labels[0] || '';
        system = currentGroup || sheetName;
        category = sheetName;
      } else {
        itemName = sheetName;
        system = sheetName;
        category = sheetName;
      }

      // Use currentGroup if system is empty
      if (!system && currentGroup) system = currentGroup;

      result.items.push({
        sheet: sheetName,
        system: system || sheetName,
        category,
        item: itemName,
        months,
        annual,
        labels: nonEmptyLabels,
        type: 'structured'
      });

      sheetAnalysisEntry.dataRows++;
      sheetAnalysisEntry.totalValue += annual;

      // Collect unique values
      if (system && !result.systems.includes(system)) result.systems.push(system);
      if (category && !result.categories.includes(category)) result.categories.push(category);
    }

    result.sheetAnalysis[sheetName] = sheetAnalysisEntry;
  }

  // Also collect systems/categories from generic items
  for (const item of result.items) {
    if (item.system && !result.systems.includes(item.system)) result.systems.push(item.system);
    if (item.category && !result.categories.includes(item.category)) result.categories.push(item.category);
  }

  // Aggregate totals
  aggregateTotals(result);

  return result;
}

function aggregateTotals(result) {
  const monthAgg = {};
  const catAgg = {};
  const sysAgg = {};

  for (const item of result.items) {
    for (const [m, v] of Object.entries(item.months)) {
      const mk = parseInt(m);
      if (!monthAgg[mk]) monthAgg[mk] = 0;
      monthAgg[mk] += v;
    }
    const cat = item.category || item.item || 'その他';
    if (!catAgg[cat]) catAgg[cat] = 0;
    catAgg[cat] += item.annual;

    const sys = item.system || item.sheet;
    if (!sysAgg[sys]) sysAgg[sys] = 0;
    sysAgg[sys] += item.annual;
  }

  result.monthlyTotals = Object.entries(monthAgg)
    .map(([m, v]) => ({ month: parseInt(m), value: v }))
    .sort((a, b) => {
      // Fiscal year sort: 4,5,...,12,1,2,3
      const fa = a.month >= 4 ? a.month - 4 : a.month + 8;
      const fb = b.month >= 4 ? b.month - 4 : b.month + 8;
      return fa - fb;
    });

  result.categoryTotals = Object.entries(catAgg)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  result.systemTotals = Object.entries(sysAgg)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

// =============================================
// API Routes
// =============================================

// Upload Excel
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルが選択されていません' });

  try {
    const { sheetNames, sheets } = parseExcel(req.file.buffer, req.file.originalname);
    const parsed = autoParseBudget(sheets);

    store = {
      fileName: req.file.originalname,
      uploadedAt: new Date().toISOString(),
      fileSize: req.file.size,
      sheets,
      parsed,
    };

    res.json({
      message: 'アップロード完了',
      fileName: req.file.originalname,
      fileSize: req.file.size,
      sheetNames,
      rowCount: parsed.items.length,
      systems: parsed.systems.length,
      categories: parsed.categories.length,
      sheetAnalysis: parsed.sheetAnalysis,
    });
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ error: 'Excel解析エラー: ' + e.message });
  }
});

// Status
app.get('/api/status', (_, res) => {
  res.json({
    hasData: !!store.parsed,
    fileName: store.fileName,
    uploadedAt: store.uploadedAt,
    fileSize: store.fileSize,
    itemCount: store.parsed ? store.parsed.items.length : 0,
    systemCount: store.parsed ? store.parsed.systems.length : 0,
    categoryCount: store.parsed ? store.parsed.categories.length : 0,
    sheetNames: store.sheets ? Object.keys(store.sheets) : [],
  });
});

// Dashboard summary
app.get('/api/dashboard/summary', (_, res) => {
  if (!store.parsed) return res.json({ kpi: null });
  const p = store.parsed;
  const totalAnnual = p.items.reduce((s, i) => s + i.annual, 0);
  const maxMonth = p.monthlyTotals.length > 0 ? Math.max(...p.monthlyTotals.map(m => m.value)) : 0;
  const avgMonth = p.monthlyTotals.length > 0 ? totalAnnual / p.monthlyTotals.length : 0;

  res.json({
    fileName: store.fileName,
    kpi: {
      totalAnnual,
      itemCount: p.items.length,
      systemCount: p.systems.length,
      categoryCount: p.categories.length,
      sheetCount: Object.keys(store.sheets).length,
      maxMonthValue: maxMonth,
      avgMonthValue: avgMonth,
    },
    monthlyTotals: p.monthlyTotals,
    categoryTotals: p.categoryTotals,
    systemTotals: p.systemTotals,
    sheetAnalysis: p.sheetAnalysis,
  });
});

// Sheet list
app.get('/api/sheets', (_, res) => {
  if (!store.sheets) return res.json({ sheets: [] });
  const sheets = Object.values(store.sheets).map(s => ({
    name: s.name,
    rows: s.rowCount,
    cols: s.colCount,
    range: s.range,
  }));
  res.json({ sheets });
});

// Sheet data (raw)
app.get('/api/sheets/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  if (!store.sheets || !store.sheets[name]) return res.status(404).json({ error: 'シートが見つかりません' });
  const s = store.sheets[name];
  // Limit to first 500 rows for performance
  const limitedJson = s.json.slice(0, 500);
  res.json({
    name: s.name,
    json: limitedJson,
    range: s.range,
    totalRows: s.rowCount,
    totalCols: s.colCount,
    truncated: s.json.length > 500,
    merges: s.merges || [],
  });
});

// Items (parsed rows with filtering)
app.get('/api/items', (req, res) => {
  if (!store.parsed) return res.json({ items: [], total: 0 });
  let items = store.parsed.items;
  const { system, category, sheet, search } = req.query;
  if (system) items = items.filter(i => i.system === system);
  if (category) items = items.filter(i => i.category === category);
  if (sheet) items = items.filter(i => i.sheet === sheet);
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(i =>
      (i.system || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q) ||
      (i.item || '').toLowerCase().includes(q) ||
      (i.labels || []).some(l => l.toLowerCase().includes(q))
    );
  }
  res.json({ items, total: items.length });
});

// Analysis: by system
app.get('/api/analysis/by-system', (_, res) => {
  if (!store.parsed) return res.json({ data: [] });
  res.json({ data: store.parsed.systemTotals });
});

// Analysis: by category
app.get('/api/analysis/by-category', (_, res) => {
  if (!store.parsed) return res.json({ data: [] });
  res.json({ data: store.parsed.categoryTotals });
});

// Analysis: by month
app.get('/api/analysis/by-month', (_, res) => {
  if (!store.parsed) return res.json({ data: [] });
  res.json({ data: store.parsed.monthlyTotals });
});

// Analysis: by sheet
app.get('/api/analysis/by-sheet', (_, res) => {
  if (!store.parsed) return res.json({ data: [] });
  const sheetAgg = {};
  for (const item of store.parsed.items) {
    if (!sheetAgg[item.sheet]) sheetAgg[item.sheet] = { name: item.sheet, value: 0, count: 0 };
    sheetAgg[item.sheet].value += item.annual;
    sheetAgg[item.sheet].count++;
  }
  res.json({ data: Object.values(sheetAgg).sort((a, b) => b.value - a.value) });
});

// Cross-tab: system x category
app.get('/api/analysis/cross-tab', (_, res) => {
  if (!store.parsed) return res.json({ data: {}, systems: [], categories: [] });
  const p = store.parsed;
  const matrix = {};
  const catSet = new Set();
  for (const item of p.items) {
    const sys = item.system || item.sheet;
    const cat = item.category || item.item || 'その他';
    catSet.add(cat);
    if (!matrix[sys]) matrix[sys] = {};
    if (!matrix[sys][cat]) matrix[sys][cat] = 0;
    matrix[sys][cat] += item.annual;
  }
  res.json({
    data: matrix,
    systems: p.systems,
    categories: [...catSet]
  });
});

// Top items ranking
app.get('/api/analysis/top-items', (req, res) => {
  if (!store.parsed) return res.json({ data: [] });
  const limit = parseInt(req.query.limit) || 20;
  const sorted = [...store.parsed.items]
    .sort((a, b) => Math.abs(b.annual) - Math.abs(a.annual))
    .slice(0, limit);
  res.json({ data: sorted });
});

// Clear data
app.post('/api/clear', (_, res) => {
  store = { fileName: null, uploadedAt: null, fileSize: 0, sheets: {}, parsed: null };
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
  console.log(`\n  Budget Excel Viewer`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://0.0.0.0:${PORT}`);
  console.log(`  Status:  Ready for Excel upload\n`);
});
