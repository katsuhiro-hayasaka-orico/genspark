const state = { rows: [], headers: [] };

const fileInput = document.getElementById('fileInput');
const mappingCard = document.getElementById('mappingCard');
const categoryCol = document.getElementById('categoryCol');
const valueCol = document.getElementById('valueCol');
const renderBtn = document.getElementById('renderBtn');

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const ext = file.name.toLowerCase().split('.').pop();

  if (ext === 'csv') {
    const text = await file.text();
    loadRows(parseCsv(text));
  } else if (ext === 'xlsx') {
    const buffer = await file.arrayBuffer();
    const rows = await parseXlsx(buffer);
    loadRows(rows);
  } else {
    alert('未対応形式です。.xlsx または .csv を選んでください。');
  }
});

renderBtn.addEventListener('click', () => renderDashboard());

function loadRows(rows) {
  if (!rows.length) return alert('データが見つかりませんでした。');
  state.headers = Object.keys(rows[0]);
  state.rows = rows;

  categoryCol.innerHTML = state.headers.map((h) => `<option value="${h}">${h}</option>`).join('');
  valueCol.innerHTML = state.headers.map((h) => `<option value="${h}">${h}</option>`).join('');
  valueCol.selectedIndex = Math.min(1, state.headers.length - 1);

  mappingCard.hidden = false;
}

function renderDashboard() {
  const catKey = categoryCol.value;
  const valueKey = valueCol.value;
  const groups = new Map();
  let total = 0;
  let count = 0;

  for (const row of state.rows) {
    const category = String(row[catKey] ?? '未分類').trim() || '未分類';
    const value = Number(String(row[valueKey] ?? '').replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    groups.set(category, (groups.get(category) || 0) + value);
    total += value;
    count += 1;
  }

  const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;

  document.getElementById('summaryCard').hidden = false;
  document.getElementById('summary').innerHTML = `
    <div><strong>有効行数</strong><br>${count.toLocaleString('ja-JP')}</div>
    <div><strong>合計</strong><br>${total.toLocaleString('ja-JP')}</div>
    <div><strong>カテゴリ数</strong><br>${sorted.length.toLocaleString('ja-JP')}</div>
  `;

  document.getElementById('chartCard').hidden = false;
  document.getElementById('bars').innerHTML = sorted.map(([name, value]) => {
    const width = (value / max) * 100;
    return `<div class="bar-row">
      <div>${escapeHtml(name)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
      <div style="text-align:right">${Math.round(value).toLocaleString('ja-JP')}</div>
    </div>`;
  }).join('');

  document.getElementById('tableCard').hidden = false;
  document.getElementById('tableWrap').innerHTML = renderTable(state.rows.slice(0, 50));
}

function renderTable(rows) {
  const headers = state.headers;
  return `<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((row) => `<tr>${headers.map((h) => `<td>${escapeHtml(String(row[h] ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']));
  });
}

function splitCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = '';
    } else cur += ch;
  }
  result.push(cur);
  return result;
}

async function parseXlsx(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const files = await unzipEntries(bytes);
  const sharedStrings = parseSharedStrings(files.get('xl/sharedStrings.xml') || '');
  const sheetPath = resolveFirstSheetPath(files);
  if (!sheetPath) throw new Error('シートが見つかりません。');
  const sheetXml = files.get(sheetPath);
  return parseSheet(sheetXml, sharedStrings);
}

function resolveFirstSheetPath(files) {
  const workbook = files.get('xl/workbook.xml');
  const rels = files.get('xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) return 'xl/worksheets/sheet1.xml';
  const wbDoc = new DOMParser().parseFromString(workbook, 'application/xml');
  const relDoc = new DOMParser().parseFromString(rels, 'application/xml');
  const firstSheet = wbDoc.querySelector('sheet');
  const rid = firstSheet?.getAttribute('r:id');
  const rel = [...relDoc.querySelectorAll('Relationship')].find((r) => r.getAttribute('Id') === rid);
  const target = rel?.getAttribute('Target');
  if (!target) return 'xl/worksheets/sheet1.xml';
  return `xl/${target.replace(/^\//, '')}`;
}

function parseSharedStrings(xmlText) {
  if (!xmlText) return [];
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  return [...doc.querySelectorAll('si')].map((si) => [...si.querySelectorAll('t')].map((t) => t.textContent || '').join(''));
}

function parseSheet(xmlText, sharedStrings) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const rows = [...doc.querySelectorAll('sheetData > row')];
  const matrix = rows.map((r) => {
    const cells = [...r.querySelectorAll('c')];
    const row = {};
    for (const c of cells) {
      const ref = c.getAttribute('r') || '';
      const col = ref.replace(/\d+/g, '');
      const idx = colToIndex(col);
      const t = c.getAttribute('t');
      const v = c.querySelector('v')?.textContent || '';
      row[idx] = t === 's' ? (sharedStrings[Number(v)] || '') : v;
    }
    return row;
  });
  if (!matrix.length) return [];
  const headers = Object.values(matrix[0]).map((h) => String(h));
  return matrix.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i] ?? '');
    return obj;
  });
}

function colToIndex(col) {
  let n = 0;
  for (const c of col) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

async function unzipEntries(bytes) {
  const entries = parseZipEntries(bytes);
  const map = new Map();
  for (const e of entries) {
    const name = decodeText(bytes.subarray(e.nameStart, e.nameStart + e.nameLen));
    const compressed = bytes.subarray(e.dataStart, e.dataStart + e.compSize);
    let data;
    if (e.method === 0) data = compressed;
    else if (e.method === 8) data = await inflateRaw(compressed);
    else continue;
    map.set(name, decodeText(data));
  }
  return map;
}

function parseZipEntries(bytes) {
  const entries = [];
  let p = 0;
  while (p + 30 < bytes.length) {
    const sig = readU32(bytes, p);
    if (sig !== 0x04034b50) { p++; continue; }
    const method = readU16(bytes, p + 8);
    const compSize = readU32(bytes, p + 18);
    const nameLen = readU16(bytes, p + 26);
    const extraLen = readU16(bytes, p + 28);
    const nameStart = p + 30;
    const dataStart = nameStart + nameLen + extraLen;
    entries.push({ method, compSize, nameLen, nameStart, dataStart });
    p = dataStart + compSize;
  }
  return entries;
}

async function inflateRaw(data) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data]).stream().pipeThrough(ds);
  const out = await new Response(stream).arrayBuffer();
  return new Uint8Array(out);
}

function readU16(bytes, p) { return bytes[p] | (bytes[p + 1] << 8); }
function readU32(bytes, p) { return (bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24)) >>> 0; }
function decodeText(bytes) { return new TextDecoder('utf-8').decode(bytes); }
function escapeHtml(v) { return v.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
