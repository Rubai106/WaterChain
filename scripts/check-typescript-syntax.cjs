#!/usr/bin/env node
/* Syntax-only TS/TSX parser. This is not a substitute for tsc type-checking. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const skipped = new Set(['node_modules', '.next', '.git', 'test-results', 'playwright-report', 'coverage', '__pycache__']);
const extensions = new Set(['.ts', '.tsx', '.mts', '.cts']);
const files = [];
function walk(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (!skipped.has(item.name)) walk(path.join(directory, item.name));
      continue;
    }
    if (extensions.has(path.extname(item.name))) files.push(path.join(directory, item.name));
  }
}
walk(root);
const errors = [];
for (const file of files) {
  const sourceText = fs.readFileSync(file, 'utf8');
  const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  for (const diagnostic of source.parseDiagnostics || []) {
    const pos = source.getLineAndCharacterOfPosition(diagnostic.start || 0);
    errors.push(`${path.relative(root, file)}:${pos.line + 1}:${pos.character + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
  }
}
console.log(`TypeScript ${ts.version}: parsed ${files.length} TS/TSX files; ${errors.length} syntax error(s).`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  console.log('PASS: syntax parsing only; type checking and framework build are separate checks.');
}
