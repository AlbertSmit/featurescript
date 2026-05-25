#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { lint } from './index.js';

const SEVERITY_COLORS = { error: '\x1b[31m', warning: '\x1b[33m', info: '\x1b[36m' };
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function main() {
  const args = process.argv.slice(2);
  const files = [];
  let format = 'stylish';
  let minSeverity = 'info';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) { format = args[++i]; continue; }
    if (args[i] === '--severity' && args[i + 1]) { minSeverity = args[++i]; continue; }
    if (args[i] === '--help' || args[i] === '-h') { printHelp(); process.exit(0); }
    files.push(args[i]);
  }

  if (files.length === 0) {
    console.error('Usage: fs-lint [options] file.fs [file2.fs ...]');
    process.exit(1);
  }

  const severityOrder = { info: 0, warning: 1, error: 2 };
  const minLevel = severityOrder[minSeverity] ?? 0;
  let totalErrors = 0;
  let totalWarnings = 0;
  const allResults = [];

  for (const file of files) {
    const filePath = resolve(file);
    let source;
    try { source = readFileSync(filePath, 'utf-8'); }
    catch (e) { console.error(`Error reading ${file}: ${e.message}`); continue; }

    const { parseErrors, lintReports } = lint(source, filePath);

    const issues = [
      ...parseErrors.map(e => ({ severity: 'error', ruleId: 'parse-error', message: e.message, line: e.line, column: e.column })),
      ...lintReports,
    ].filter(r => (severityOrder[r.severity] ?? 0) >= minLevel);

    totalErrors += issues.filter(i => i.severity === 'error').length;
    totalWarnings += issues.filter(i => i.severity === 'warning').length;
    allResults.push({ file, issues });
  }

  if (format === 'json') {
    console.log(JSON.stringify(allResults, null, 2));
  } else {
    for (const { file, issues } of allResults) {
      if (issues.length === 0) continue;
      console.log(`\n${BOLD}${file}${RESET}`);
      for (const issue of issues) {
        const color = SEVERITY_COLORS[issue.severity] ?? '';
        const loc = `${issue.line}:${issue.column}`;
        console.log(`  ${loc.padEnd(8)} ${color}${issue.severity.padEnd(8)}${RESET} ${issue.message}  ${BOLD}${issue.ruleId}${RESET}`);
      }
    }
    console.log(`\n${totalErrors > 0 ? '\x1b[31m' : ''}✖ ${totalErrors + totalWarnings} problems (${totalErrors} errors, ${totalWarnings} warnings)${RESET}\n`);
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

function printHelp() {
  console.log(`
fs-lint — FeatureScript linter

Usage: fs-lint [options] file.fs [file2.fs ...]

Options:
  --format json|stylish    Output format (default: stylish)
  --severity error|warning|info  Minimum severity (default: info)
  -h, --help               Show this help
`);
}

main();
