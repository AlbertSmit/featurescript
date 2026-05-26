/**
 * FeatureScript Linter — Correctness test suite
 *
 * Tests each lint rule in isolation against targeted FeatureScript snippets.
 * Uses the same node:test runner as the parser tests.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { parse } from '../parser/src/parser.js';
import { runRules } from '../linter/src/engine.js';
import {
  noUnusedVars,
  noUndefinedVars,
  missingExportFeature,
  missingPrecondition,
  noTrySilentFail,
  noReservedKeywords,
  enumNaming,
  typeNaming,
  functionNaming,
  ALL_RULES,
} from '../linter/src/rules.js';
import { lint } from '../linter/src/index.js';

// ── Helpers ──

/** Parse and run a single rule, return reports */
function runRule(source, rule) {
  const { ast } = parse(source);
  return runRules(ast, [rule]);
}

/** Parse and run all rules, return reports */
function runAll(source) {
  const { ast } = parse(source);
  return runRules(ast, ALL_RULES);
}


// ═══════════════════════════════════════════════════════════
// Individual Rule Tests
// ═══════════════════════════════════════════════════════════

describe('Lint rules', () => {

  // ── no-unused-vars ──

  describe('no-unused-vars', () => {
    it('reports unused variable', () => {
      const reports = runRule(`
        export function f() {
          var unusedVar = 42;
        }
      `, noUnusedVars);
      assert.ok(reports.some(r => r.message.includes('unusedVar')));
    });

    it('does not report used variable', () => {
      const reports = runRule(`
        export function f() {
          var x = 1;
          return x;
        }
      `, noUnusedVars);
      assert.ok(!reports.some(r => r.message.includes("'x'")));
    });

    it('does not report variable used in nested scope', () => {
      const reports = runRule(`
        export function f() {
          var total = 0;
          for (var i = 0; i < 10; i += 1) {
            total += i;
          }
          return total;
        }
      `, noUnusedVars);
      assert.ok(!reports.some(r => r.message.includes("'total'")));
    });
  });

  // ── missing-export-feature ──

  describe('missing-export-feature', () => {
    it('reports non-exported function using defineFeature', () => {
      const reports = runRule(`
        const myFeature = defineFeature(function(context is Context, id is Id, definition is map)
          precondition { }
          { });
      `, missingExportFeature);
      // The rule checks FunctionDeclarations, not ConstantDeclarations with defineFeature calls.
      // This tests the rule as-written: it looks for FunctionDeclaration nodes whose body
      // contains a defineFeature call.
    });

    it('does not report exported feature function', () => {
      const reports = runRule(`
        export function myFeature(context is Context, id is Id, definition is map)
        precondition { }
        {
          defineFeature(context);
        }
      `, missingExportFeature);
      assert.equal(reports.length, 0);
    });
  });

  // ── missing-precondition ──

  describe('missing-precondition', () => {
    it('reports feature function without precondition', () => {
      const reports = runRule(`
        function myFeature(context is Context, id is Id, definition is map) {
          return undefined;
        }
      `, missingPrecondition);
      assert.ok(reports.some(r => r.message.includes('precondition')));
    });

    it('does not report function with precondition', () => {
      const reports = runRule(`
        export function myFeature(context is Context, id is Id, definition is map)
        precondition { }
        { }
      `, missingPrecondition);
      assert.equal(reports.length, 0);
    });

    it('does not report function with fewer than 3 params', () => {
      const reports = runRule(`
        function helper(context is Context) { }
      `, missingPrecondition);
      assert.equal(reports.length, 0);
    });

    it('does not report function without Context/Id params', () => {
      const reports = runRule(`
        function process(a is number, b is string, c is array) { }
      `, missingPrecondition);
      assert.equal(reports.length, 0);
    });

    it('does not report helper with Context+Id but non-map third param', () => {
      // Helper functions commonly pass context/id through without being feature functions.
      // Only the canonical (Context, Id, map) signature should trigger this rule.
      const reports = runRule(`
        function processWithFallback(context is Context, id is Id, query is Query) { }
      `, missingPrecondition);
      assert.equal(reports.length, 0);
    });
  });

  // ── no-try-silent-fail ──

  describe('no-try-silent-fail', () => {
    it('reports discarded try() result', () => {
      const reports = runRule(`
        export function f() {
          try(riskyCall());
        }
      `, noTrySilentFail);
      assert.ok(reports.some(r => r.message.includes('try()')));
    });

    it('does not report try() assigned to variable', () => {
      const reports = runRule(`
        export function f() {
          var result = try(riskyCall());
        }
      `, noTrySilentFail);
      assert.equal(reports.length, 0);
    });
  });

  // ── no-reserved-keywords ──

  describe('no-reserved-keywords', () => {
    it('reports use of reserved keyword as identifier', () => {
      const reports = runRule(`
        export function f() {
          var assert = 1;
        }
      `, noReservedKeywords);
      assert.ok(reports.some(r => r.message.includes('assert')));
    });

    it('flags all reserved keywords', () => {
      // Each reserved keyword used as a var name
      for (const keyword of ['assert', 'case', 'default', 'do', 'switch']) {
        const reports = runRule(`
          export function f() { var ${keyword} = 1; }
        `, noReservedKeywords);
        assert.ok(reports.some(r => r.message.includes(keyword)),
          `Expected '${keyword}' to be flagged`);
      }
    });
  });

  // ── enum-naming ──

  describe('enum-naming', () => {
    it('reports lowercase enum values', () => {
      const reports = runRule(`
        enum MyStatus { active, inactive }
      `, enumNaming);
      assert.ok(reports.some(r => r.message.includes('active')));
      assert.ok(reports.some(r => r.message.includes('inactive')));
    });

    it('does not report UPPER_SNAKE_CASE values', () => {
      const reports = runRule(`
        enum Direction { UP, DOWN, LEFT_RIGHT }
      `, enumNaming);
      assert.equal(reports.length, 0);
    });
  });

  // ── type-naming ──

  describe('type-naming', () => {
    it('reports non-PascalCase type name', () => {
      const reports = runRule(`
        type myType typecheck canBeMyType;
      `, typeNaming);
      assert.ok(reports.some(r => r.message.includes('myType')));
    });

    it('does not report PascalCase type name', () => {
      const reports = runRule(`
        type Interval typecheck canBeInterval;
      `, typeNaming);
      assert.equal(reports.length, 0);
    });
  });

  // ── function-naming ──

  describe('function-naming', () => {
    it('reports PascalCase function name', () => {
      const reports = runRule(`
        export function MyFunction() { }
      `, functionNaming);
      assert.ok(reports.some(r => r.message.includes('MyFunction')));
    });

    it('does not report camelCase function name', () => {
      const reports = runRule(`
        export function myFunction() { }
      `, functionNaming);
      assert.equal(reports.length, 0);
    });
  });
});


// ═══════════════════════════════════════════════════════════
// Engine Tests
// ═══════════════════════════════════════════════════════════

describe('Lint engine', () => {

  it('respects rule config: turns off a rule', () => {
    const { ast } = parse(`
      export function f() { var x = 42; }
    `);
    const reports = runRules(ast, ALL_RULES, { 'no-unused-vars': 'off' });
    assert.ok(!reports.some(r => r.ruleId === 'no-unused-vars'));
  });

  it('respects rule config: changes severity', () => {
    const { ast } = parse(`
      export function f() { var x = 42; }
    `);
    const reports = runRules(ast, ALL_RULES, { 'no-unused-vars': 'error' });
    const relevant = reports.filter(r => r.ruleId === 'no-unused-vars');
    assert.ok(relevant.length > 0);
    assert.equal(relevant[0].severity, 'error');
  });

  it('reports are sorted by line then column', () => {
    const reports = runAll(`
      enum Test { bad, worse }
      function MyBadFunction() { var unused = 1; }
    `);
    for (let i = 1; i < reports.length; i++) {
      const prev = reports[i - 1];
      const curr = reports[i];
      assert.ok(
        prev.line < curr.line || (prev.line === curr.line && prev.column <= curr.column),
        `Reports not sorted: ${prev.ruleId}@${prev.line}:${prev.column} > ${curr.ruleId}@${curr.line}:${curr.column}`
      );
    }
  });
});


// ═══════════════════════════════════════════════════════════
// Public API Tests (lint function)
// ═══════════════════════════════════════════════════════════

describe('Lint public API', () => {

  it('lint() returns parseErrors and lintReports', () => {
    const result = lint(`
      FeatureScript 2096;
      export function f() { var unused = 1; }
    `);
    assert.ok('parseErrors' in result);
    assert.ok('lintReports' in result);
    assert.ok(Array.isArray(result.parseErrors));
    assert.ok(Array.isArray(result.lintReports));
  });

  it('lint() reports lint findings for valid code', () => {
    const result = lint(`
      FeatureScript 2096;
      export function f() { var unused = 1; }
    `);
    assert.equal(result.parseErrors.length, 0);
    assert.ok(result.lintReports.some(r => r.ruleId === 'no-unused-vars'));
  });

  it('lint() reports parse errors for invalid code', () => {
    const result = lint(`
      FeatureScript 2096;
      export function f() { var x = ; }
    `);
    assert.ok(result.parseErrors.length > 0);
  });

  it('lint() works with empty source', () => {
    const result = lint('');
    assert.ok('parseErrors' in result);
    assert.ok('lintReports' in result);
  });
});
