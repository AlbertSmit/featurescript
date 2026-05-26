#!/usr/bin/env node

/**
 * FeatureScript Standard Library Scraper
 *
 * Parses the cached FsDoc HTML (or fetches it) and extracts all exported
 * symbols into stdlib-data.json.
 *
 * Usage:
 *   node oracle/scrape-stdlib.js              # fetch + parse
 *   node oracle/scrape-stdlib.js --from-cache  # parse cached HTML only
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = resolve(__dirname, '.fsdoc-cache.html');
const OUTPUT_PATH = resolve(__dirname, '..', 'stdlib-data.json');
const FSDOC_URL = 'https://cad.onshape.com/FsDoc/library.html';

// ── Fetch ──

async function fetchFsDoc() {
  if (process.argv.includes('--from-cache') && existsSync(CACHE_PATH)) {
    console.log('  Using cached HTML...');
    return readFileSync(CACHE_PATH, 'utf-8');
  }

  console.log(`  Fetching ${FSDOC_URL} ...`);
  return new Promise((resolve, reject) => {
    https.get(FSDOC_URL, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf-8');
        writeFileSync(CACHE_PATH, html);
        console.log(`  Cached to ${CACHE_PATH} (${(html.length / 1024).toFixed(0)} KB)`);
        resolve(html);
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── HTML structure ──
//
// Each symbol is a <p class="node-signature" id="NAME-Type1-Type2">
// containing:
//   <span class="fs-symbol-name"><a>NAME</a></span>
//   <span class="fs-function-arguments">(param1&nbsp;is&nbsp;<a>Type1</a>, ...)</span>
//   <span class="fs-function-return"> returns&nbsp;<a>RetType</a></span>
//   <span class="fs-symbol-descriptor">type|enum|const|predicate</span>
//
// Modules: <div class="fs-file"><h2 id="module-NAME.fs">

function stripHtml(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function parseSymbols(html) {
  const symbols = [];

  // Track current module via <h2 id="module-NAME.fs">
  const moduleRegex = /<h2[^>]*id="module-([^"]+)"[^>]*>/g;
  const modulePositions = [];
  let m;
  while ((m = moduleRegex.exec(html)) !== null) {
    modulePositions.push({ module: m[1], pos: m.index });
  }

  // Find all node signatures
  const sigRegex = /<p\s+class="node-signature"\s+id="([^"]+)">([\s\S]*?)<\/p>/g;
  let match;

  while ((match = sigRegex.exec(html)) !== null) {
    const anchorId = match[1];
    const content = match[2];
    const pos = match.index;

    // Determine module
    let module = 'unknown';
    for (let i = modulePositions.length - 1; i >= 0; i--) {
      if (modulePositions[i].pos < pos) {
        module = modulePositions[i].module;
        break;
      }
    }

    // Extract name
    const nameMatch = content.match(/<span\s+class="fs-symbol-name"[^>]*>([\s\S]*?)<\/span>/);
    if (!nameMatch) continue;
    const name = stripHtml(nameMatch[1]);
    if (!name || name.startsWith('#')) continue;

    // Extract descriptor (type, enum, const, predicate)
    const descriptorMatch = content.match(/<span\s+class="fs-symbol-descriptor"[^>]*>([\s\S]*?)<\/span>/);
    const descriptor = descriptorMatch ? stripHtml(descriptorMatch[1]).toLowerCase() : null;

    // Extract function arguments
    const argsMatch = content.match(/<span\s+class="fs-function-arguments"[^>]*>([\s\S]*?)<\/span>/);
    const argsRaw = argsMatch ? stripHtml(argsMatch[1]) : null;

    // Extract return type
    const returnMatch = content.match(/<span\s+class="fs-function-return"[^>]*>([\s\S]*?)<\/span>/);
    const returnType = returnMatch ? stripHtml(returnMatch[1]).replace(/^\s*returns\s+/, '').trim() : null;

    // Classify
    if (descriptor === 'type') {
      symbols.push({ name, kind: 'type', module });
    } else if (descriptor === 'enum') {
      symbols.push({ name, kind: 'enum', module, values: [] });
    } else if (descriptor === 'const') {
      symbols.push({ name, kind: 'constant', module });
    } else if (descriptor === 'predicate') {
      symbols.push({
        name,
        kind: 'predicate',
        module,
        params: argsRaw ? parseParams(argsRaw) : [],
      });
    } else if (argsRaw !== null) {
      // Function (has arguments)
      symbols.push({
        name,
        kind: 'function',
        module,
        params: parseParams(argsRaw),
        returnType: returnType || 'void',
      });
    } else {
      // Bare symbol — likely a function with no parens shown, or unknown
      symbols.push({ name, kind: 'constant', module });
    }
  }

  return symbols;
}

/**
 * Parse "(context is Context, id is Id, definition is map)" into params array
 */
function parseParams(raw) {
  // Remove surrounding parens
  const inner = raw.replace(/^\s*\(/, '').replace(/\)\s*$/, '').trim();
  if (!inner) return [];

  return inner.split(',').map(p => {
    const cleaned = p.trim();
    const parts = cleaned.split(/\s+is\s+/);
    if (parts.length >= 2) {
      return { name: parts[0].trim(), type: parts.slice(1).join(' is ').trim() };
    }
    return { name: cleaned, type: 'any' };
  });
}

/**
 * Extract enum values from the HTML. Enum values appear in
 * <span class="fs-enum-value-name">VALUE</span> elements.
 */
function extractEnumValues(html, symbols) {
  for (const sym of symbols) {
    if (sym.kind !== 'enum') continue;

    try {
      // Find this enum's anchor in HTML
      const anchor = `id="${sym.name}"`;
      const enumStart = html.indexOf(anchor);
      if (enumStart === -1) continue;

      // Find the next node-signature after this one
      const nextSigIdx = html.indexOf('class="node-signature"', enumStart + anchor.length);
      const enumEnd = nextSigIdx !== -1 ? nextSigIdx : Math.min(enumStart + 5000, html.length);
      const enumSection = html.slice(enumStart, enumEnd);

      // Look for fs-enum-value-name spans
      if (!sym.values) sym.values = [];
      const localEnumValRegex = /<span\s+class="fs-enum-value-name"[^>]*>([\s\S]*?)<\/span>/g;
      let vm;
      while ((vm = localEnumValRegex.exec(enumSection)) !== null) {
        const val = stripHtml(vm[1]);
        if (val && !sym.values.includes(val)) sym.values.push(val);
      }
    } catch (err) {
      console.error(`  Warning: failed to extract values for enum "${sym.name}": ${err.message}`);
    }
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Build output ──

function buildStdlibData(symbols) {
  // Use null-prototype objects to avoid collisions with Object.prototype
  // (FeatureScript has functions named 'toString', 'constructor', etc.)
  const functions = Object.create(null);
  const types = Object.create(null);
  const enums = Object.create(null);
  const constants = Object.create(null);
  const predicates = Object.create(null);

  for (const sym of symbols) {
    switch (sym.kind) {
      case 'function': {
        if (!functions[sym.name]) {
          functions[sym.name] = { module: sym.module, signatures: [] };
        }
        functions[sym.name].signatures.push({
          params: sym.params,
          returnType: sym.returnType,
        });
        break;
      }
      case 'type':
        types[sym.name] = { module: sym.module };
        break;
      case 'enum':
        enums[sym.name] = { module: sym.module, values: sym.values ?? [] };
        break;
      case 'constant':
        constants[sym.name] = { module: sym.module };
        break;
      case 'predicate':
        predicates[sym.name] = { module: sym.module, params: sym.params };
        break;
    }
  }

  const allNames = new Set([
    ...Object.keys(functions),
    ...Object.keys(types),
    ...Object.keys(enums),
    ...Object.keys(constants),
    ...Object.keys(predicates),
  ]);

  return {
    version: new Date().toISOString().split('T')[0],
    source: FSDOC_URL,
    stats: {
      functions: Object.keys(functions).length,
      types: Object.keys(types).length,
      enums: Object.keys(enums).length,
      constants: Object.keys(constants).length,
      predicates: Object.keys(predicates).length,
      totalSymbols: allNames.size,
    },
    functions,
    types,
    enums,
    constants,
    predicates,
    allSymbolNames: [...allNames].sort(),
  };
}

// ── Main ──

async function main() {
  console.log('\n\x1b[1m━━ FeatureScript Stdlib Scraper ━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');

  const html = await fetchFsDoc();
  console.log(`  HTML size: ${(html.length / 1024).toFixed(0)} KB`);

  console.log('  Parsing symbols...');
  const symbols = parseSymbols(html);
  console.log(`  Found ${symbols.length} raw symbols`);

  console.log('  Extracting enum values...');
  extractEnumValues(html, symbols);

  const data = buildStdlibData(symbols);

  console.log(`\n  \x1b[1mResults:\x1b[0m`);
  console.log(`    Functions:  ${data.stats.functions}`);
  console.log(`    Types:      ${data.stats.types}`);
  console.log(`    Enums:      ${data.stats.enums}`);
  console.log(`    Constants:  ${data.stats.constants}`);
  console.log(`    Predicates: ${data.stats.predicates}`);
  console.log(`    Total:      ${data.stats.totalSymbols}\n`);

  // Show some sample functions as sanity check
  const sampleFns = ['newSketch', 'skLineSegment', 'skCircle', 'opExtrude', 'opFillet',
                      'vector', 'defineFeature', 'reportFeatureWarning', 'skSolve'];
  console.log('  \x1b[2mSample lookups:\x1b[0m');
  for (const fn of sampleFns) {
    const found = data.functions[fn];
    if (found) {
      const sigs = found.signatures.map(s => `(${s.params.map(p => p.name).join(', ')})`);
      console.log(`    ✅ ${fn}${sigs.join(' | ')} [${found.module}]`);
    } else {
      console.log(`    ❌ ${fn} — not found`);
    }
  }
  console.log();

  writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log(`  Written to: ${OUTPUT_PATH}`);
  console.log(`  Size: ${(readFileSync(OUTPUT_PATH).length / 1024).toFixed(0)} KB\n`);
}

main().catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
