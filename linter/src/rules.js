import { visit, NodeType } from '../../parser/src/index.js';

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
      if (types[0] === 'Context' && types[1] === 'Id') {
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
];
