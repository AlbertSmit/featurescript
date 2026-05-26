/**
 * FeatureScript Parser — Correctness test suite
 *
 * Four tiers of assurance:
 *  1. AST structure assertions — verify exact node types and shapes
 *  2. Error detection — verify invalid syntax produces errors
 *  3. Corpus tests — parse every example file end-to-end
 *  4. AST completeness — verify bodies are fully parsed, not stubs
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from '../parser/src/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Helpers ──────────────────────────────────────────────────

/** Parse source, assert no errors, return AST */
function ok(source) {
  const { ast, errors } = parse(source);
  assert.equal(errors.length, 0, `Expected no errors but got:\n${errors.map(e => `  L${e.line}:${e.column} ${e.message}`).join('\n')}`);
  return ast;
}

/** Parse source, assert at least one error */
function fail(source) {
  const { ast, errors } = parse(source);
  assert.ok(errors.length > 0, 'Expected parse errors but got none');
  return { ast, errors };
}

/** Get top-level declarations from AST (skip the Program wrapper) */
function decls(ast) {
  return (ast.body ?? []).filter(n => n.type !== 'Program');
}

/** Deep-walk AST and collect all nodes of a given type */
function collectNodes(node, type) {
  const result = [];
  if (!node || typeof node !== 'object') return result;
  if (node.type === type) result.push(node);
  for (const val of Object.values(node)) {
    if (Array.isArray(val)) {
      for (const child of val) result.push(...collectNodes(child, type));
    } else if (val && typeof val === 'object' && val.type) {
      result.push(...collectNodes(val, type));
    }
  }
  return result;
}


// ═══════════════════════════════════════════════════════════
// TIER 1: AST Structure Assertions
// ═══════════════════════════════════════════════════════════

describe('Tier 1: AST structure assertions', () => {

  // ── Version header ──

  describe('FeatureScript header', () => {
    it('parses FeatureScript VERSION; as Program node', () => {
      const ast = ok('FeatureScript 2096;');
      assert.equal(ast.body[0].type, 'Program');
      assert.equal(ast.body[0].version, '2096');
    });
  });

  // ── Imports ──

  describe('import statement', () => {
    it('parses standard import with path and version', () => {
      const ast = ok('import(path : "onshape/std/common.fs", version : "2096.0");');
      const imp = decls(ast).find(n => n.type === 'ImportStatement');
      assert.ok(imp, 'Expected ImportStatement');
      // Parser stores string with quotes — check that the path content is present
      assert.ok(imp.path.includes('onshape/std/common.fs'), `Path: ${imp.path}`);
      assert.ok(imp.version.includes('2096.0'), `Version: ${imp.version}`);
    });
  });

  // ── Variable declarations ──

  describe('variable declarations', () => {
    it('parses var with initializer inside a function', () => {
      const ast = ok('export function f() { var x = 42; }');
      const vars = collectNodes(ast, 'VariableDeclaration');
      assert.ok(vars.length >= 1, 'Expected at least 1 VariableDeclaration');
      assert.equal(vars[0].name, 'x');
      assert.equal(vars[0].init.type, 'NumberLiteral');
      assert.equal(vars[0].init.value, 42);
    });

    it('parses local const (ConstantDeclaration) with initializer', () => {
      const ast = ok('export function f() { const y = "hello"; }');
      // local const may be ConstantDeclaration or VariableDeclaration
      const consts = collectNodes(ast, 'ConstantDeclaration');
      const vars = collectNodes(ast, 'VariableDeclaration');
      const all = [...consts, ...vars].filter(n => n.name === 'y');
      assert.ok(all.length >= 1, 'Expected const y to be parsed');
    });
  });

  // ── Function declarations ──

  describe('function declarations', () => {
    it('parses function with typed parameters', () => {
      const ast = ok('export function myFn(a is Context, b is Id) { }');
      const fn = decls(ast).find(n => n.type === 'FunctionDeclaration');
      assert.ok(fn);
      assert.equal(fn.name, 'myFn');
      assert.equal(fn.params.length, 2);
      assert.equal(fn.params[0].name, 'a');
      assert.equal(fn.params[0].typeConstraint, 'Context');
      assert.equal(fn.params[1].name, 'b');
      assert.equal(fn.params[1].typeConstraint, 'Id');
    });

    it('parses function with returns clause', () => {
      const ast = ok('export function add(a is number, b is number) returns number { return a; }');
      const fn = decls(ast).find(n => n.type === 'FunctionDeclaration');
      assert.ok(fn);
      assert.equal(fn.returnType, 'number');
    });

    it('parses function with precondition', () => {
      const ast = ok(`
        export function myFeature(context is Context, id is Id, definition is map)
        precondition { }
        { }
      `);
      const fn = decls(ast).find(n => n.type === 'FunctionDeclaration');
      assert.ok(fn);
      assert.ok(fn.precondition, 'Expected precondition on function');
    });
  });

  // ── Predicate declarations ──

  describe('predicate declarations', () => {
    it('parses predicate with body', () => {
      const ast = ok('export predicate isPositive(val) { val > 0; }');
      const pred = decls(ast).find(n => n.type === 'PredicateDeclaration');
      assert.ok(pred);
      assert.equal(pred.name, 'isPositive');
      assert.equal(pred.params.length, 1);
    });
  });

  // ── Enum declarations ──

  describe('enum declarations', () => {
    it('parses enum with annotated values', () => {
      const ast = ok(`
        export enum WallType {
          annotation { "Name" : "Straight" }
          STRAIGHT,
          annotation { "Name" : "Curved" }
          CURVED
        }
      `);
      const enm = decls(ast).find(n => n.type === 'EnumDeclaration');
      assert.ok(enm);
      assert.equal(enm.name, 'WallType');
      assert.ok(enm.values.length >= 2, `Expected >= 2 enum values, got ${enm.values.length}`);
    });

    it('parses enum without annotations', () => {
      const ast = ok('export enum Color { RED, GREEN, BLUE }');
      const enm = decls(ast).find(n => n.type === 'EnumDeclaration');
      assert.ok(enm);
      assert.equal(enm.values.length, 3);
    });
  });

  // ── Constant declarations (defineFeature pattern) ──

  describe('defineFeature pattern', () => {
    it('parses export const = defineFeature(function(...) precondition {} {})', () => {
      const ast = ok(`
        export const slot = defineFeature(function(context is Context, id is Id, definition is map)
          precondition
          {
            definition.slotPath is Query;
          }
          {
            var x = 1;
          });
      `);
      const cnst = decls(ast).find(n => n.type === 'ConstantDeclaration');
      assert.ok(cnst, 'Expected ConstantDeclaration');
      assert.equal(cnst.name, 'slot');

      // The value is stored in either .value or .init
      const val = cnst.value ?? cnst.init;
      assert.ok(val, 'Expected value/init on constant');
      assert.equal(val.type, 'CallExpression');
      assert.equal(val.callee.name, 'defineFeature');

      // Its argument should be a LambdaExpression with a precondition
      const lambda = val.arguments[0];
      assert.equal(lambda.type, 'LambdaExpression');
      assert.ok(lambda.precondition, 'Expected precondition on lambda inside defineFeature');
    });
  });

  // ── Expressions ──

  describe('expressions', () => {
    it('parses binary operators with correct precedence (+ vs *)', () => {
      const ast = ok('export function f() { var x = 1 + 2 * 3; }');
      const vars = collectNodes(ast, 'VariableDeclaration');
      const init = vars[0].init;
      // 1 + (2 * 3) — outer is +, right child is *
      assert.equal(init.type, 'BinaryExpression');
      assert.equal(init.operator, '+');
      assert.equal(init.right.type, 'BinaryExpression');
      assert.equal(init.right.operator, '*');
    });

    it('parses string concatenation with ~', () => {
      const ast = ok('export function f() { var s = "hello" ~ " world"; }');
      const vars = collectNodes(ast, 'VariableDeclaration');
      const init = vars[0].init;
      assert.equal(init.type, 'BinaryExpression');
      assert.equal(init.operator, '~');
    });

    it('parses member access chains', () => {
      const ast = ok('export function f() { var x = obj.prop.sub; }');
      const vars = collectNodes(ast, 'VariableDeclaration');
      const init = vars[0].init;
      assert.equal(init.type, 'MemberExpression');
      assert.equal(init.property, 'sub');
      assert.equal(init.object.type, 'MemberExpression');
    });

    it('parses function calls with map arguments', () => {
      const ast = ok('export function f() { opExtrude(context, id + "ext1", { "entities" : query }); }');
      const calls = collectNodes(ast, 'CallExpression');
      assert.ok(calls.length >= 1);
      assert.equal(calls[0].callee.name, 'opExtrude');
      assert.equal(calls[0].arguments.length, 3);
      assert.equal(calls[0].arguments[2].type, 'MapLiteral');
    });

    it('parses try expression', () => {
      const ast = ok('export function f() { var r = try(riskyCall()); }');
      const tries = collectNodes(ast, 'TryExpression');
      assert.ok(tries.length >= 1);
    });

    it('parses ternary expression', () => {
      const ast = ok('export function f() { var x = a > b ? a : b; }');
      const terns = collectNodes(ast, 'TernaryExpression');
      assert.ok(terns.length >= 1);
    });

    it('parses array literal', () => {
      const ast = ok('export function f() { var arr = [1, 2, 3]; }');
      const arrs = collectNodes(ast, 'ArrayLiteral');
      assert.ok(arrs.length >= 1);
      assert.equal(arrs[0].elements.length, 3);
    });

    it('parses map literal with entries', () => {
      const ast = ok('export function f() { var m = { "key" : "val" }; }');
      const maps = collectNodes(ast, 'MapLiteral');
      assert.ok(maps.length >= 1);
      assert.equal(maps[0].entries.length, 1);
    });

    it('parses type check expression (is)', () => {
      const ast = ok('export function f() { var x = val is number; }');
      const types = collectNodes(ast, 'TypeExpression');
      assert.ok(types.length >= 1);
    });

    it('parses cast expression (as)', () => {
      const ast = ok('export function f() { var x = val as IntegerBoundSpec; }');
      const casts = collectNodes(ast, 'CastExpression');
      assert.ok(casts.length >= 1);
    });

    it('parses id + string (binary +)', () => {
      const ast = ok('export function f() { var x = id + "extrude1"; }');
      const bins = collectNodes(ast, 'BinaryExpression');
      const plus = bins.find(b => b.operator === '+');
      assert.ok(plus);
      assert.equal(plus.left.name, 'id');
      assert.equal(plus.right.type, 'StringLiteral');
    });
  });

  // ── Statements ──

  describe('statements', () => {
    it('parses if/else if/else', () => {
      const ast = ok(`
        export function f() {
          if (x > 0) { return 1; }
          else if (x == 0) { return 0; }
          else { return -1; }
        }
      `);
      const ifs = collectNodes(ast, 'IfStatement');
      assert.ok(ifs.length >= 1);
      assert.ok(ifs[0].alternate, 'Expected else branch');
    });

    it('parses for loop with update', () => {
      const ast = ok('export function f() { for (var i = 0; i < 10; i += 1) { } }');
      const fors = collectNodes(ast, 'ForStatement');
      assert.ok(fors.length >= 1);
      assert.ok(fors[0].init);
      assert.ok(fors[0].test);
      assert.ok(fors[0].update);
    });

    it('parses for-in loop', () => {
      const ast = ok('export function f() { for (var item in items) { } }');
      const forins = collectNodes(ast, 'ForInStatement');
      assert.ok(forins.length >= 1);
      assert.equal(forins[0].variable, 'item');
    });

    it('parses while loop', () => {
      const ast = ok('export function f() { while (x > 0) { x = x - 1; } }');
      const whiles = collectNodes(ast, 'WhileStatement');
      assert.ok(whiles.length >= 1);
    });

    it('parses try/catch statement', () => {
      const ast = ok(`
        export function f() {
          try { riskyCall(); }
          catch (e) { handleError(e); }
        }
      `);
      const trys = collectNodes(ast, 'TryCatchStatement');
      assert.ok(trys.length >= 1);
      // Parser uses 'body' for try block and 'handler' for catch block
      assert.ok(trys[0].body, 'Expected try body');
      assert.ok(trys[0].handler, 'Expected catch handler');
    });

    it('parses return statement', () => {
      const ast = ok('export function f() { return 42; }');
      const rets = collectNodes(ast, 'ReturnStatement');
      assert.ok(rets.length >= 1);
    });

    it('parses throw statement', () => {
      const ast = ok('export function f() { throw "error"; }');
      const throws = collectNodes(ast, 'ThrowStatement');
      assert.ok(throws.length >= 1);
    });

    it('parses assignment with compound operators', () => {
      const ast = ok('export function f() { var x = 0; x += 1; x -= 2; x *= 3; }');
      const assigns = collectNodes(ast, 'AssignmentStatement');
      assert.ok(assigns.length >= 3);
    });
  });

  // ── Annotations ──

  describe('annotations', () => {
    it('parses annotation with map literal', () => {
      const ast = ok(`
        annotation { "Feature Type Name" : "Slot" }
        export const slot = defineFeature(function(context is Context, id is Id, definition is map)
          precondition { }
          { });
      `);
      const annots = collectNodes(ast, 'Annotation');
      assert.ok(annots.length >= 1);
    });
  });

  // ── Location data ──

  describe('location data', () => {
    it('nodes have loc with start and end objects', () => {
      const ast = ok('export function f() { var x = 1 + 2; }');
      const vars = collectNodes(ast, 'VariableDeclaration');
      assert.ok(vars.length >= 1);
      const v = vars[0];
      assert.ok(v.loc, 'VariableDeclaration missing loc');
      assert.ok(v.loc.start, 'VariableDeclaration missing loc.start');
      assert.ok(v.loc.end, 'VariableDeclaration missing loc.end');
      // start should have line and column
      assert.ok('line' in v.loc.start, 'loc.start should have line');
      assert.ok('column' in v.loc.start, 'loc.start should have column');
    });

    it('line numbers start at 1 for single-line input', () => {
      const ast = ok('export function f() { return 1; }');
      const rets = collectNodes(ast, 'ReturnStatement');
      assert.ok(rets.length >= 1);
      assert.ok(rets[0].loc.start.line >= 1, `Line should be >= 1, got ${rets[0].loc.start.line}`);
    });
  });
});


// ═══════════════════════════════════════════════════════════
// TIER 2: Error Detection
// ═══════════════════════════════════════════════════════════

describe('Tier 2: Error detection', () => {
  it('reports error for missing semicolon after var', () => {
    const { errors } = fail('export function f() { var x = 1 }');
    assert.ok(errors.some(e => e.message.includes(';') || e.message.includes('}')));
  });

  it('reports error for unmatched braces', () => {
    const { errors } = fail('export function f() { ');
    assert.ok(errors.length > 0);
  });

  it('recovers and continues parsing after an error', () => {
    const { ast, errors } = parse(`
      export function broken() { var x = ; }
      export function good() { var y = 1; }
    `);
    assert.ok(errors.length > 0, 'Expected errors from broken function');
    const fns = decls(ast).filter(n => n.type === 'FunctionDeclaration');
    assert.ok(fns.length >= 1, 'Expected at least the good function to be parsed');
  });

  it('reports error for incomplete expression', () => {
    const { errors } = fail('export function f() { var x = 1 + ; }');
    assert.ok(errors.length > 0);
  });
});



// ═══════════════════════════════════════════════════════════
// TIER 2b: Edge Cases — degenerate inputs
// ═══════════════════════════════════════════════════════════

describe('Tier 2b: Edge cases', () => {
  it('handles empty string without crashing', () => {
    const { ast, errors } = parse('');
    assert.ok(ast, 'Expected AST even for empty input');
  });

  it('handles whitespace-only input', () => {
    const { ast, errors } = parse('   \n  \n\t\n  ');
    assert.ok(ast, 'Expected AST for whitespace-only input');
  });

  it('handles comment-only file', () => {
    const { ast, errors } = parse(`
      // This file has only comments
      /* and a block comment too */
      // Nothing else
    `);
    assert.ok(ast, 'Expected AST for comment-only input');
  });

  it('handles version header only (minimal valid file)', () => {
    const ast = ok('FeatureScript 2096;');
    assert.equal(ast.body[0].type, 'Program');
    assert.equal(ast.body[0].version, '2096');
    // No other declarations
    assert.equal(decls(ast).length, 0);
  });

  it('handles file with only parse errors', () => {
    const { ast, errors } = parse('!!! @@@ %%% ^^^');
    assert.ok(errors.length > 0, 'Expected parse errors');
    assert.ok(ast, 'Expected AST even with only errors');
  });

  it('handles file with version header and only a comment', () => {
    const ast = ok(`
      FeatureScript 2096;
      // Just a comment, no declarations
    `);
    assert.equal(decls(ast).length, 0);
  });

  it('handles file with multiple consecutive imports', () => {
    const ast = ok(`
      FeatureScript 2096;
      import(path : "onshape/std/common.fs", version : "2096.0");
      import(path : "onshape/std/math.fs", version : "2096.0");
      import(path : "onshape/std/transform.fs", version : "2096.0");
    `);
    const imports = decls(ast).filter(n => n.type === 'ImportStatement');
    assert.equal(imports.length, 3);
  });

  it('handles deeply nested expressions', () => {
    const ast = ok(`
      export function f() {
        var x = ((((1 + 2) * 3) - 4) / 5);
      }
    `);
    const vars = collectNodes(ast, 'VariableDeclaration');
    assert.ok(vars.length >= 1);
  });

  it('handles empty function body', () => {
    const ast = ok('export function empty() { }');
    const fn = decls(ast).find(n => n.type === 'FunctionDeclaration');
    assert.ok(fn);
    assert.equal(fn.name, 'empty');
  });

  it('handles empty enum', () => {
    const ast = ok('export enum EmptyEnum { }');
    const enm = decls(ast).find(n => n.type === 'EnumDeclaration');
    assert.ok(enm);
    assert.equal(enm.values.length, 0);
  });
});


// ═══════════════════════════════════════════════════════════
// TIER 3: Corpus Tests (example .fs files)
// ═══════════════════════════════════════════════════════════

describe('Tier 3: Corpus — example .fs files', () => {
  const examplesDir = join(__dirname, '..', 'examples');
  let files;
  try {
    files = readdirSync(examplesDir).filter(f => f.endsWith('.fs'));
  } catch {
    files = [];
  }

  for (const file of files) {
    it(`parses ${file} with zero errors`, () => {
      const source = readFileSync(join(examplesDir, file), 'utf-8');
      const { ast, errors } = parse(source);
      assert.equal(errors.length, 0,
        `${file} had ${errors.length} error(s):\n${errors.map(e => `  L${e.line}:${e.column} ${e.message}`).join('\n')}`);
      // Minimal files (version header only) legitimately have zero declarations
      assert.ok(ast.body.length > 0, `${file} produced no AST nodes at all`);
    });
  }

  // Also test the sample.fs fixture
  const samplePath = join(__dirname, 'sample.fs');
  try {
    readFileSync(samplePath, 'utf-8');
    it('parses test/sample.fs with zero errors', () => {
      const source = readFileSync(samplePath, 'utf-8');
      const { ast, errors } = parse(source);
      assert.equal(errors.length, 0,
        `sample.fs had ${errors.length} error(s):\n${errors.map(e => `  L${e.line}:${e.column} ${e.message}`).join('\n')}`);
    });
  } catch { /* skip if file doesn't exist */ }
});


// ═══════════════════════════════════════════════════════════
// TIER 4: AST Completeness — nothing is silently swallowed
// ═══════════════════════════════════════════════════════════

describe('Tier 4: AST completeness', () => {

  it('function body contains all parsed statements', () => {
    const ast = ok(`
      export function myFn(context is Context) {
        var x = 42;
        opExtrude(context, id + "ext1", { "entities" : query });
        if (x > 10) { x = x + 1; }
        return x;
      }
    `);
    const fn = decls(ast).find(n => n.type === 'FunctionDeclaration');
    assert.ok(fn.body);
    assert.ok(fn.body.body.length >= 4,
      `Expected >= 4 statements in function body, got ${fn.body.body.length}`);
  });

  it('defineFeature lambda body is fully parsed (not an empty stub)', () => {
    const ast = ok(`
      export const myFeature = defineFeature(function(context is Context, id is Id, definition is map)
        precondition { definition.param is Query; }
        {
          var x = 1;
          opExtrude(context, id + "ext1", { "entities" : definition.param });
          return x;
        });
    `);
    const cnst = decls(ast).find(n => n.type === 'ConstantDeclaration');
    const val = cnst.value ?? cnst.init;
    const lambda = val.arguments[0];
    assert.ok(lambda.body.body.length >= 3,
      `Expected >= 3 statements in defineFeature body, got ${lambda.body.body.length}`);
    assert.ok(lambda.precondition, 'Expected precondition on defineFeature lambda');
  });

  it('nested function calls in map literals are fully parsed', () => {
    const ast = ok(`
      export function f() {
        opExtrude(context, id + "ext", {
          "entities" : qCreatedBy(id + "sketch", EntityType.BODY),
          "direction" : evOwnerSketchPlane(context, { "entity" : query }).normal
        });
      }
    `);
    const calls = collectNodes(ast, 'CallExpression');
    const callNames = calls.map(c => c.callee?.name).filter(Boolean);
    assert.ok(callNames.includes('opExtrude'), 'Missing opExtrude call');
    assert.ok(callNames.includes('qCreatedBy'), 'Missing qCreatedBy call');
    assert.ok(callNames.includes('evOwnerSketchPlane'), 'Missing evOwnerSketchPlane call');
  });

  it('for loop body is fully parsed', () => {
    const ast = ok(`
      export function f() {
        for (var i = 0; i < 10; i += 1) {
          var x = i * 2;
          doSomething(x);
        }
      }
    `);
    const fors = collectNodes(ast, 'ForStatement');
    assert.ok(fors[0].body.body.length >= 2,
      `Expected >= 2 statements in for body, got ${fors[0].body.body.length}`);
  });

  it('try/catch both branches have parsed bodies', () => {
    const ast = ok(`
      export function f() {
        try {
          riskyCall();
          anotherCall();
        }
        catch (e) {
          handleError(e);
        }
      }
    `);
    const trys = collectNodes(ast, 'TryCatchStatement');
    // Parser stores try block in .body and catch block in .handler
    const tryBody = trys[0].body;
    const catchBody = trys[0].handler;
    // These may be BlockStatement nodes or plain arrays
    const tryStmts = tryBody.body ?? tryBody;
    const catchStmts = catchBody.body ?? catchBody;
    assert.ok((Array.isArray(tryStmts) ? tryStmts : [tryStmts]).length >= 2,
      'try block body not fully parsed');
    assert.ok((Array.isArray(catchStmts) ? catchStmts : [catchStmts]).length >= 1,
      'catch block body not fully parsed');
  });

  it('enum values all have names', () => {
    const ast = ok('export enum Direction { UP, DOWN, LEFT, RIGHT }');
    const enm = decls(ast).find(n => n.type === 'EnumDeclaration');
    assert.equal(enm.values.length, 4);
    for (const v of enm.values) {
      assert.ok(v.name, `Enum value missing name: ${JSON.stringify(v)}`);
    }
  });
});
