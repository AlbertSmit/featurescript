// ─── AST Node Types ───────────────────────────────────────────
// Every node in the FeatureScript AST is one of these types.
// Each node carries { type, ...fields, loc } where loc is
// { start: { line, column, offset }, end: { line, column, offset } }.

/** @typedef {import('./types.js').NodeTypeValue} NodeTypeValue */
/** @typedef {import('./types.js').ASTNode} ASTNode */
/** @typedef {import('./types.js').SourceLocation} SourceLocation */
/** @typedef {import('./types.js').Token} Token */

/** @type {import('./types.js').NodeType} */
export const NodeType = Object.freeze({
  // ── Program ──
  Program:              'Program',

  // ── Top-level ──
  ImportStatement:      'ImportStatement',
  NamespacedImport:     'NamespacedImport',
  FunctionDeclaration:  'FunctionDeclaration',
  PredicateDeclaration: 'PredicateDeclaration',
  OperatorOverload:     'OperatorOverload',
  EnumDeclaration:      'EnumDeclaration',
  EnumValue:            'EnumValue',
  TypeDeclaration:      'TypeDeclaration',
  ConstantDeclaration:  'ConstantDeclaration',
  Annotation:           'Annotation',

  // ── Statements ──
  VariableDeclaration:  'VariableDeclaration',
  ExpressionStatement:  'ExpressionStatement',
  BlockStatement:       'BlockStatement',
  IfStatement:          'IfStatement',
  WhileStatement:       'WhileStatement',
  ForStatement:         'ForStatement',
  ForInStatement:       'ForInStatement',
  ReturnStatement:      'ReturnStatement',
  BreakStatement:       'BreakStatement',
  ContinueStatement:    'ContinueStatement',
  ThrowStatement:       'ThrowStatement',
  TryCatchStatement:    'TryCatchStatement',
  AssignmentStatement:  'AssignmentStatement',
  Precondition:         'Precondition',

  // ── Expressions ──
  Identifier:           'Identifier',
  BuiltinIdentifier:    'BuiltinIdentifier',
  NumberLiteral:        'NumberLiteral',
  StringLiteral:        'StringLiteral',
  BooleanLiteral:       'BooleanLiteral',
  UndefinedLiteral:     'UndefinedLiteral',
  InfLiteral:           'InfLiteral',
  ArrayLiteral:         'ArrayLiteral',
  MapLiteral:           'MapLiteral',
  MapEntry:             'MapEntry',
  BinaryExpression:     'BinaryExpression',
  UnaryExpression:      'UnaryExpression',
  TernaryExpression:    'TernaryExpression',
  CallExpression:       'CallExpression',
  ArrowCallExpression:  'ArrowCallExpression',
  MemberExpression:     'MemberExpression',
  SafeMemberExpression: 'SafeMemberExpression',
  SubscriptExpression:  'SubscriptExpression',
  SafeSubscriptExpression: 'SafeSubscriptExpression',
  BoxAccessExpression:  'BoxAccessExpression',
  SafeBoxAccessExpression: 'SafeBoxAccessExpression',
  TypeExpression:       'TypeExpression',     // expr is Type
  CastExpression:       'CastExpression',     // expr as Type
  NewBoxExpression:     'NewBoxExpression',    // new box(expr)
  TryExpression:        'TryExpression',       // try(expr)
  LambdaExpression:     'LambdaExpression',    // function(...) { } or (...) => expr
  NamespaceAccess:      'NamespaceAccess',     // ns::symbol
  GroupExpression:      'GroupExpression',      // (expr) — for map key disambiguation

  // ── Parameters ──
  Parameter:            'Parameter',           // name [is Type]
});

// ── Location helpers ──

/**
 * Build a SourceLocation from start/end position sources.
 * Accepts Tokens (which have .end as byte offset) and ASTNodes (which have .loc).
 * @param {import('./types.js').PositionSource} startToken
 * @param {import('./types.js').PositionSource} endToken
 * @returns {SourceLocation}
 */
export function loc(startToken, endToken) {
  const s = 'loc' in startToken ? startToken.loc.start : startToken;
  const e = 'loc' in endToken   ? endToken.loc.end     : endToken;
  return {
    start: { line: s.line, column: s.column, offset: s.offset },
    end:   { line: e.line, column: e.column, offset: /** @type {number} */ (e.end ?? e.offset) },
  };
}

// ── Node factory ──
// All AST nodes are plain objects with a `type` field.
// This keeps the AST serializable and easy to traverse.

/**
 * Create an AST node with location information.
 * @param {NodeTypeValue} type - The node type string
 * @param {Record<string, unknown>} fields - Node-specific fields
 * @param {Token | ASTNode} startToken - Start position source
 * @param {Token | ASTNode} [endToken] - End position source (defaults to startToken)
 * @returns {ASTNode}
 */
export function node(type, fields, startToken, endToken) {
  return { type, ...fields, loc: loc(startToken, endToken ?? startToken) };
}
