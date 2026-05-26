#!/usr/bin/env node

/**
 * Oracle CLI — Validate FeatureScript against Onshape's real compiler
 *
 * Usage:
 *   node oracle/cli.js validate <file.fs>        Validate a single file
 *   node oracle/cli.js corpus <glob>              Validate all files, produce report
 *   node oracle/cli.js generate-tests <glob>      Validate + auto-generate test cases
 *   node oracle/cli.js eval "<expression>"        Evaluate a FeatureScript expression
 *
 * Environment:
 *   ONSHAPE_ACCESS_KEY    API access key (required)
 *   ONSHAPE_SECRET_KEY    API secret key (required)
 *
 * Config:
 *   .oraclerc.json        Document/element IDs (see .oraclerc.json.example)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { parse } from '../parser/src/index.js';
import { lint } from '../linter/src/index.js';
import { OnshapeOracle } from './client.js';
import { compareDiagnostics, formatDiffSummary } from './differ.js';
import { generateTests, writeTestFixtures } from './test-generator.js';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';

// ── Main ──

const [,, command, ...args] = process.argv;

if (!command || command === '--help' || command === '-h') {
  printUsage();
  process.exit(0);
}

try {
  switch (command) {
    case 'validate':
      await runValidate(args);
      break;
    case 'corpus':
      await runCorpus(args);
      break;
    case 'generate-tests':
      await runGenerateTests(args);
      break;
    case 'eval':
      await runEval(args);
      break;
    default:
      console.error(`${RED}Unknown command: ${command}${RESET}`);
      printUsage();
      process.exit(1);
  }
} catch (error) {
  if (error.message.includes('Oracle config incomplete')) {
    console.error(`\n${RED}${BOLD}Configuration Error${RESET}`);
    console.error(`${DIM}${error.message}${RESET}\n`);
    console.error(`Set up your Onshape API keys:`);
    console.error(`  ${CYAN}export ONSHAPE_ACCESS_KEY="your-access-key"${RESET}`);
    console.error(`  ${CYAN}export ONSHAPE_SECRET_KEY="your-secret-key"${RESET}\n`);
    console.error(`Create ${CYAN}.oraclerc.json${RESET} with your document IDs (see .oraclerc.json.example)\n`);
    process.exit(1);
  }
  throw error;
}

// ── Commands ──

/**
 * Validate a single file: local + oracle + diff.
 * @param {string[]} files
 */
async function runValidate(files) {
  const debug = files.includes('--debug');
  const fsFiles = files.filter(f => f !== '--debug');

  if (!fsFiles.length) {
    console.error(`${RED}Usage: oracle validate <file.fs> [--debug]${RESET}`);
    process.exit(1);
  }

  const oracle = new OnshapeOracle();

  for (const file of fsFiles) {
    const filePath = resolve(file);
    const source = readFileSync(filePath, 'utf-8');

    console.log(`\n${BOLD}━━ ${basename(filePath)} ━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);

    // Local analysis
    const localDiags = getLocalDiagnostics(source, filePath);
    console.log(`${DIM}  Local: ${localDiags.length} diagnostic(s)${RESET}`);

    // Oracle analysis
    console.log(`${DIM}  Pushing to Onshape...${RESET}`);
    const oracleResult = await oracle.validate(source, { debug });

    if (!oracleResult.success) {
      console.error(`  ${RED}Oracle failed: ${oracleResult.error}${RESET}`);
      if (debug && oracleResult.raw) {
        console.log(`${DIM}  Raw:`, JSON.stringify(oracleResult.raw, null, 2), RESET);
      }
      continue;
    }

    console.log(`${DIM}  Oracle: ${oracleResult.diagnostics.length} diagnostic(s) (${oracleResult.durationMs}ms)${RESET}`);

    if (debug && oracleResult.raw) {
      console.log(`${DIM}  Raw API data:`, JSON.stringify(oracleResult.raw, null, 2), RESET);
    }

    // Diff
    const diff = compareDiagnostics(localDiags, oracleResult.diagnostics);
    console.log(formatDiffSummary(diff));
  }
}

/**
 * Validate all corpus files and produce a summary report.
 * @param {string[]} patterns
 */
async function runCorpus(patterns) {
  const files = resolveGlobs(patterns);

  if (!files.length) {
    console.error(`${RED}No .fs files found.${RESET}`);
    console.error(`Usage: oracle corpus examples/*.fs`);
    process.exit(1);
  }

  const oracle = new OnshapeOracle();

  console.log(`\n${BOLD}━━ Oracle Corpus Validation ━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${DIM}  Files: ${files.length}${RESET}\n`);

  let totalTP = 0, totalFP = 0, totalFN = 0;
  const fileResults = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf-8');
    const localDiags = getLocalDiagnostics(source, file);

    process.stdout.write(`  ${basename(file).padEnd(30)} `);

    const oracleResult = await oracle.validate(source);

    if (!oracleResult.success) {
      console.log(`${RED}⚠ oracle error${RESET}`);
      fileResults.push({ file, error: oracleResult.error });
      continue;
    }

    const diff = compareDiagnostics(localDiags, oracleResult.diagnostics);
    totalTP += diff.truePositives.length;
    totalFP += diff.falsePositives.length;
    totalFN += diff.falseNegatives.length;

    const icon = diff.falseNegatives.length ? `${RED}🔴` :
                 diff.falsePositives.length ? `${YELLOW}⚡` :
                 `${GREEN}✅`;

    const stats = [];
    if (diff.truePositives.length) stats.push(`${diff.truePositives.length} TP`);
    if (diff.falsePositives.length) stats.push(`${diff.falsePositives.length} FP`);
    if (diff.falseNegatives.length) stats.push(`${diff.falseNegatives.length} FN`);
    if (!stats.length) stats.push('clean');

    console.log(`${icon} ${stats.join(' | ')}${RESET}`);
    fileResults.push({ file, diff });
  }

  // Summary
  const total = totalTP + totalFP + totalFN;
  const accuracy = total === 0 ? 1.0 : totalTP / total;

  console.log(`\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`  ${BOLD}Accuracy: ${pct(accuracy)}${RESET}  |  TP: ${totalTP}  |  FP: ${totalFP}  |  FN: ${totalFN}`);
  console.log();
}

/**
 * Validate corpus + auto-generate test cases from discrepancies.
 * @param {string[]} patterns
 */
async function runGenerateTests(patterns) {
  const files = resolveGlobs(patterns);

  if (!files.length) {
    console.error(`${RED}No .fs files found.${RESET}`);
    process.exit(1);
  }

  const oracle = new OnshapeOracle();
  /** @type {import('./test-generator.js').GeneratedTest[]} */
  const allTests = [];

  console.log(`\n${BOLD}━━ Oracle Test Generation ━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);

  for (const file of files) {
    const source = readFileSync(file, 'utf-8');
    const localDiags = getLocalDiagnostics(source, file);

    process.stdout.write(`  ${basename(file).padEnd(30)} `);

    const oracleResult = await oracle.validate(source);

    if (!oracleResult.success) {
      console.log(`${RED}⚠ oracle error${RESET}`);
      continue;
    }

    const diff = compareDiagnostics(localDiags, oracleResult.diagnostics);
    const tests = generateTests(diff, source, file);

    if (tests.length) {
      console.log(`${YELLOW}→ ${tests.length} test(s) generated${RESET}`);
    } else {
      console.log(`${GREEN}✅ no gaps${RESET}`);
    }

    allTests.push(...tests);
  }

  if (allTests.length) {
    const result = writeTestFixtures(allTests);
    console.log(`\n  ${BOLD}Wrote ${result.count} new test fixture(s)${RESET} to ${CYAN}${result.path}${RESET}`);
    console.log(`  Run with: ${CYAN}node --test test/oracle-generated/oracle.test.js${RESET}\n`);
  } else {
    console.log(`\n  ${GREEN}No discrepancies found — parser matches Onshape perfectly.${RESET}\n`);
  }
}

/**
 * Evaluate a FeatureScript expression.
 * @param {string[]} args
 */
async function runEval(args) {
  const script = args.join(' ');

  if (!script) {
    console.error(`${RED}Usage: oracle eval "function(context is Context, queries) { ... }"${RESET}`);
    process.exit(1);
  }

  const oracle = new OnshapeOracle();
  const result = await oracle.evalScript(script);

  if (result.error) {
    console.error(`${RED}Error: ${result.error}${RESET}`);
    process.exit(1);
  }

  console.log(JSON.stringify(result.result, null, 2));
}

// ── Helpers ──

/**
 * Run our local parser + linter and normalize output.
 * @param {string} source
 * @param {string} filePath
 * @returns {import('./differ.js').LocalDiagnostic[]}
 */
function getLocalDiagnostics(source, filePath) {
  const { parseErrors, lintReports } = lint(source, filePath);

  return [
    ...parseErrors.map(e => ({
      line: e.line ?? e.loc?.start?.line ?? 0,
      column: e.column ?? e.loc?.start?.column ?? 0,
      severity: /** @type {'error'} */ ('error'),
      message: e.message ?? String(e),
      source: /** @type {'parse'} */ ('parse'),
    })),
    ...lintReports.map(r => ({
      line: r.line ?? 0,
      column: r.column ?? 0,
      severity: /** @type {'error'|'warning'} */ (r.severity ?? 'warning'),
      message: r.message ?? String(r),
      source: /** @type {'lint'} */ ('lint'),
    })),
  ];
}

/**
 * Resolve file arguments (support basic glob-like patterns).
 * @param {string[]} patterns
 * @returns {string[]}
 */
function resolveGlobs(patterns) {
  const files = [];

  for (const pattern of patterns) {
    const resolved = resolve(pattern);

    try {
      if (statSync(resolved).isDirectory()) {
        const children = readdirSync(resolved)
          .filter(f => extname(f) === '.fs')
          .map(f => resolve(resolved, f));
        files.push(...children);
      } else if (extname(resolved) === '.fs') {
        files.push(resolved);
      }
    } catch {
      // Node doesn't natively glob — shell should expand *.fs before we get here
      if (extname(pattern) === '.fs') {
        files.push(resolved);
      }
    }
  }

  return [...new Set(files)].sort();
}

function printUsage() {
  console.log(`
${BOLD}Oracle CLI${RESET} — Validate FeatureScript against Onshape's compiler

${BOLD}Commands:${RESET}
  ${CYAN}validate${RESET} <file.fs>           Validate a single file
  ${CYAN}corpus${RESET} <dir|files>           Validate all files, produce accuracy report
  ${CYAN}generate-tests${RESET} <dir|files>   Validate + auto-generate test cases from gaps
  ${CYAN}eval${RESET} "<expression>"          Evaluate a FeatureScript expression

${BOLD}Setup:${RESET}
  1. Create API keys at ${CYAN}https://cad.onshape.com/appstore/dev-portal${RESET}
  2. ${CYAN}export ONSHAPE_ACCESS_KEY="..."${RESET}
  3. ${CYAN}export ONSHAPE_SECRET_KEY="..."${RESET}
  4. Create ${CYAN}.oraclerc.json${RESET} with document IDs (see .oraclerc.json.example)
  `);
}

/** @param {number} n */
function pct(n) {
  return `${(n * 100).toFixed(0)}%`;
}
