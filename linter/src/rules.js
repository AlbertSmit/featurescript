import { visit, NodeType } from '../../parser/src/index.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STDLIB_PATH = resolve(__dirname, '..', '..', 'stdlib-data.json');

// ── no-unused-vars ──
// Warn on variables/constants declared but never referenced in the same scope.

export const noUnusedVars = {
  id: 'no-unused-vars',
  severity: 'warning',
  create(ctx) {
    const declared = new Map(); // name → node
    const used = new Set();

    visit(ctx.ast, {
      [NodeType.VariableDeclaration]: (n) => { if (n.name) declared.set(n.name, n); },
      [NodeType.Identifier]: (n) => { if (n.name) used.add(n.name); },
    });

    for (const [name, node] of declared) {
      if (!used.has(name)) {
        ctx.report(node, `'${name}' is declared but never used`);
      }
    }
  },
};

// ── no-undefined-vars ──
// Error on identifiers used before any declaration (top-level only, heuristic).

export const noUndefinedVars = {
  id: 'no-undefined-vars',
  severity: 'error',
  create(ctx) {
    // Collect all declared names
    const declared = new Set();
    visit(ctx.ast, {
      [NodeType.FunctionDeclaration]: (n) => { if (n.name) declared.add(n.name); },
      [NodeType.PredicateDeclaration]: (n) => { if (n.name) declared.add(n.name); },
      [NodeType.ConstantDeclaration]: (n) => { if (n.name) declared.add(n.name); },
      [NodeType.VariableDeclaration]: (n) => { if (n.name) declared.add(n.name); },
      [NodeType.EnumDeclaration]: (n) => { if (n.name) declared.add(n.name); },
      [NodeType.TypeDeclaration]: (n) => { if (n.name) declared.add(n.name); },
      [NodeType.Parameter]: (n) => { if (n.name) declared.add(n.name); },
    });
    // Not flagging — too many false positives without import resolution
  },
};

// ── missing-export-feature ──
// Warn if a function using defineFeature is not exported.

export const missingExportFeature = {
  id: 'missing-export-feature',
  severity: 'warning',
  create(ctx) {
    for (const decl of ctx.ast.body ?? []) {
      if (decl.type !== NodeType.FunctionDeclaration) continue;
      if (decl.exported) continue;
      // Check if body contains defineFeature call
      let hasDefineFeature = false;
      visit(decl, {
        [NodeType.CallExpression]: (n) => {
          if (n.callee?.name === 'defineFeature') hasDefineFeature = true;
        },
      });
      if (hasDefineFeature) {
        ctx.report(decl, `Feature function '${decl.name}' uses defineFeature but is not exported`);
      }
    }
  },
};

// ── missing-precondition ──
// Warn if a feature function (3-param with Context, Id, map) has no precondition.

export const missingPrecondition = {
  id: 'missing-precondition',
  severity: 'warning',
  create(ctx) {
    for (const decl of ctx.ast.body ?? []) {
      if (decl.type !== NodeType.FunctionDeclaration) continue;
      if (decl.precondition) continue;
      const params = decl.params ?? [];
      if (params.length < 3) continue;
      const types = params.map(p => p.typeConstraint);
      // The canonical feature function signature is (context is Context, id is Id, definition is map).
      // Only flag functions matching this exact pattern — helpers that pass context/id through are fine.
      if (types[0] === 'Context' && types[1] === 'Id' && types[2] === 'map') {
        ctx.report(decl, `Feature function '${decl.name}' is missing a precondition block`);
      }
    }
  },
};

// ── no-try-silent-fail ──
// Warn when try(expr) result is not checked for undefined.

export const noTrySilentFail = {
  id: 'no-try-silent-fail',
  severity: 'warning',
  create(ctx) {
    visit(ctx.ast, {
      [NodeType.ExpressionStatement]: (n) => {
        if (n.expression?.type === NodeType.TryExpression) {
          ctx.report(n, 'try() result is discarded — failures will be silently ignored');
        }
      },
    });
  },
};

// ── no-reserved-keywords ──
// Error on use of reserved keywords (assert, case, default, do, switch).

export const noReservedKeywords = {
  id: 'no-reserved-keywords',
  severity: 'error',
  create(ctx) {
    const RESERVED = new Set(['assert', 'case', 'default', 'do', 'switch']);
    visit(ctx.ast, {
      [NodeType.Identifier]: (n) => {
        if (RESERVED.has(n.name)) {
          ctx.report(n, `'${n.name}' is a reserved keyword and cannot be used as an identifier`);
        }
      },
    });
  },
};

// ── enum-naming ──
// Info: enum values should be UPPER_SNAKE_CASE.

export const enumNaming = {
  id: 'enum-naming',
  severity: 'info',
  create(ctx) {
    visit(ctx.ast, {
      [NodeType.EnumValue]: (n) => {
        if (n.name && !/^[A-Z][A-Z0-9_]*$/.test(n.name)) {
          ctx.report(n, `Enum value '${n.name}' should be UPPER_SNAKE_CASE`);
        }
      },
    });
  },
};

// ── type-naming ──
// Info: custom type names should be PascalCase.

export const typeNaming = {
  id: 'type-naming',
  severity: 'info',
  create(ctx) {
    visit(ctx.ast, {
      [NodeType.TypeDeclaration]: (n) => {
        if (n.name && !/^[A-Z][a-zA-Z0-9]*$/.test(n.name)) {
          ctx.report(n, `Type '${n.name}' should be PascalCase`);
        }
      },
    });
  },
};

// ── function-naming ──
// Info: function names should be camelCase.

export const functionNaming = {
  id: 'function-naming',
  severity: 'info',
  create(ctx) {
    visit(ctx.ast, {
      [NodeType.FunctionDeclaration]: (n) => {
        if (n.name && /^[A-Z]/.test(n.name)) {
          ctx.report(n, `Function '${n.name}' should be camelCase`);
        }
      },
    });
  },
};

// ── no-unknown-stdlib-call ──
// Warn when a function call looks like a stdlib function but doesn't exist.
// Uses stdlib-data.json (generated by oracle/scrape-stdlib.js).

/** Lazy-loaded stdlib lookup */
let _stdlibData = null;
function getStdlib() {
  if (_stdlibData) return _stdlibData;
  if (!existsSync(STDLIB_PATH)) return null;
  try {
    _stdlibData = JSON.parse(readFileSync(STDLIB_PATH, 'utf-8'));
    return _stdlibData;
  } catch {
    return null;
  }
}

/**
 * Levenshtein distance between two strings.
 * Used to suggest corrections for misspelled stdlib calls.
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Prefixes that strongly suggest a function is a stdlib call.
 * If a call matches one of these and isn't in stdlib, it's likely a typo.
 */
const STDLIB_PREFIXES = [
  'op', 'sk', 'ev', 'q',              // operations, sketch, evaluate, query
  'new', 'make', 'define', 'report',   // constructors, features, reporting
  'is', 'can', 'get', 'set',           // predicates, accessors
  'debug', 'add', 'remove',            // debug, modification
  'start', 'sketch', 'round',          // other common patterns
];

/**
 * Find the closest stdlib function to a given name.
 * Returns { match, distance } or null if nothing is close.
 */
function findClosestStdlib(name, stdlibFunctions) {
  let bestMatch = null;
  let bestDist = Infinity;
  // Adaptive threshold: shorter names need tighter matches
  const maxDist = name.length <= 5 ? 1 : name.length <= 10 ? 2 : 3;

  for (const known of stdlibFunctions) {
    // Quick reject: if lengths differ too much, skip
    if (Math.abs(name.length - known.length) > maxDist) continue;
    const dist = levenshtein(name, known);
    if (dist < bestDist && dist <= maxDist && dist > 0) {
      bestDist = dist;
      bestMatch = known;
    }
  }
  return bestMatch ? { match: bestMatch, distance: bestDist } : null;
}

/** Does this name look like it could be a stdlib call? */
function looksLikeStdlib(name) {
  for (const prefix of STDLIB_PREFIXES) {
    if (name.startsWith(prefix) && name.length > prefix.length &&
        name[prefix.length] === name[prefix.length].toUpperCase()) {
      return true;
    }
  }
  return false;
}

export const noUnknownStdlibCall = {
  id: 'no-unknown-stdlib-call',
  severity: 'warning',
  create(ctx) {
    const stdlib = getStdlib();
    if (!stdlib) return; // No stdlib data available — skip

    const stdlibFnNames = Object.keys(stdlib.functions);
    const knownFunctions = new Set(stdlibFnNames);
    const knownPredicates = new Set(Object.keys(stdlib.predicates));

    // Collect locally declared function names to avoid flagging user functions
    const localFunctions = new Set();
    visit(ctx.ast, {
      [NodeType.FunctionDeclaration]: (n) => { if (n.name) localFunctions.add(n.name); },
      [NodeType.PredicateDeclaration]: (n) => { if (n.name) localFunctions.add(n.name); },
    });

    visit(ctx.ast, {
      [NodeType.CallExpression]: (n) => {
        const name = n.callee?.name;
        if (!name) return;

        // Skip if it's a known symbol or locally declared
        if (knownFunctions.has(name) || knownPredicates.has(name)) return;
        if (localFunctions.has(name)) return;

        // Two-pronged detection:
        // 1. Prefix match → definitely should be stdlib, suggest correction
        // 2. Close Levenshtein match → likely a typo

        const prefixMatch = looksLikeStdlib(name);
        const closest = findClosestStdlib(name, stdlibFnNames);

        if (!prefixMatch && !closest) return;

        const suggestion = closest
          ? `. Did you mean '${closest.match}'?`
          : '';

        ctx.report(n.callee, `Unknown stdlib function '${name}'${suggestion}`);
      },
    });
  },
};

// ── All rules ──

export const ALL_RULES = [
  noUnusedVars,
  noUndefinedVars,
  missingExportFeature,
  missingPrecondition,
  noTrySilentFail,
  noReservedKeywords,
  enumNaming,
  typeNaming,
  functionNaming,
  noUnknownStdlibCall,
];
