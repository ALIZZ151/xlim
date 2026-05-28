'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.vercel'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (full.endsWith('.js')) files.push(full);
  }
}
walk(root);
for (const file of files) {
  require('child_process').execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
console.log(`Syntax OK: ${files.length} JS files checked.`);
