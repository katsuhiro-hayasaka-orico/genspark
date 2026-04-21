#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const roots = process.argv.slice(2);
const targets = roots.length ? roots : ['public', 'electron'];
const textExt = new Set(['.html', '.css', '.js', '.mjs', '.cjs', '.json', '.txt']);
const issues = [];

function walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(p)) walk(path.join(p, name));
    return;
  }
  const ext = path.extname(p).toLowerCase();
  if (!textExt.has(ext)) return;
  const content = fs.readFileSync(p, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!/https?:\/\//i.test(line)) return;
    if (/https?:\/\/(127\.0\.0\.1|localhost)/i.test(line)) return;
    if (/SERVER_HOST|SERVER_PORT/.test(line)) return;
    if (/^\s*\/\//.test(line)) return;
    issues.push(`${p}:${i + 1}: ${line.trim()}`);
  });
}

for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  walk(target);
}

if (issues.length) {
  console.error('External URL reference(s) found:');
  for (const issue of issues) console.error(issue);
  process.exit(1);
}

console.log(`OK: no external URL refs in ${targets.join(', ')}`);
