import { TokenType } from './lexer.js';
import { node, NodeType } from './ast.js';
import { parseExpression } from './expressions.js';

/** @typedef {import('./types.js').ParserBase} ParserBase */
/** @typedef {import('./types.js').ASTNode} ASTNode */
/** @typedef {import('./types.js').StatementNode} StatementNode */
/** @typedef {import('./types.js').ExpressionNode} ExpressionNode */
/** @typedef {import('./types.js').BlockStatementNode} BlockStatementNode */
/** @typedef {import('./types.js').VariableDeclarationNode} VariableDeclarationNode */
/** @typedef {import('./types.js').ConstantDeclarationNode} ConstantDeclarationNode */
/** @typedef {import('./types.js').IfStatementNode} IfStatementNode */
/** @typedef {import('./types.js').WhileStatementNode} WhileStatementNode */
/** @typedef {import('./types.js').ForStatementNode} ForStatementNode */
/** @typedef {import('./types.js').ForInStatementNode} ForInStatementNode */
/** @typedef {import('./types.js').ReturnStatementNode} ReturnStatementNode */
/** @typedef {import('./types.js').BreakStatementNode} BreakStatementNode */
/** @typedef {import('./types.js').ContinueStatementNode} ContinueStatementNode */
/** @typedef {import('./types.js').ThrowStatementNode} ThrowStatementNode */
/** @typedef {import('./types.js').TryCatchStatementNode} TryCatchStatementNode */
/** @typedef {import('./types.js').ExpressionStatementNode} ExpressionStatementNode */
/** @typedef {import('./types.js').AssignmentStatementNode} AssignmentStatementNode */
/** @typedef {import('./types.js').AnnotationNode} AnnotationNode */
/** @typedef {import('./types.js').TokenTypeValue} TokenTypeValue */

/** @type {Set<TokenTypeValue>} */
const ASSIGNMENT_OPS = new Set([
  TokenType.Equal, TokenType.PlusEqual, TokenType.MinusEqual,
  TokenType.StarEqual, TokenType.SlashEqual, TokenType.CaretEqual,
  TokenType.PercentEqual, TokenType.PipePipeEqual, TokenType.AmpAmpEqual,
  TokenType.QuestionQuestionEqual, TokenType.TildeEqual,
]);

// ── Main dispatcher ──

/**
 * Parse a single statement.
 * @param {ParserBase} p
 * @returns {StatementNode}
 */
export function parseStatement(p) {
  const t = p.peek();
  switch (t.type) {
    case TokenType.LBrace:     return parseBlockStatement(p);
    case TokenType.Var:        return parseVarDeclaration(p);
    case TokenType.Const:      return parseConstDeclaration(p);
    case TokenType.If:         return parseIfStatement(p);
    case TokenType.While:      return parseWhileStatement(p);
    case TokenType.For:        return parseForStatement(p);
    case TokenType.Return:     return parseReturnStatement(p);
    case TokenType.Break:      return parseBreakStatement(p);
    case TokenType.Continue:   return parseContinueStatement(p);
    case TokenType.Throw:      return parseThrowStatement(p);
    case TokenType.Try:        return parseTryCatchStatement(p);
    case TokenType.Annotation: return parseAnnotationStatement(p);
    default:                   return parseAssignmentOrExprStatement(p);
  }
}

// Annotation inside a precondition or block: annotation { ... } followed by a statement

/**
 * @param {ParserBase} p
 * @returns {StatementNode}
 */
function parseAnnotationStatement(p) {
  const start = p.advance(); // annotation
  const map = parseMapLiteralImported(p);
  const ann = /** @type {AnnotationNode} */ (node(NodeType.Annotation, { entries: map.entries }, start, map));
  // The next statement is the annotated statement
  const stmt = parseStatement(p);
  stmt.annotations = [ann, ...(stmt.annotations || [])];
  return stmt;
}

// Inline map literal parse to avoid circular import

/**
 * @param {ParserBase} p
 * @returns {import('./types.js').MapLiteralNode}
 */
function parseMapLiteralImported(p) {
  const lb = p.expect(TokenType.LBrace);
  /** @type {import('./types.js').MapEntryNode[]} */
  const entries = [];
  if (!p.at(TokenType.RBrace)) {
    entries.push(parseMapEntryInline(p));
    while (p.match(TokenType.Comma)) {
      if (p.at(TokenType.RBrace)) break;
      entries.push(parseMapEntryInline(p));
    }
  }
  const rb = p.expect(TokenType.RBrace);
  return /** @type {import('./types.js').MapLiteralNode} */ (node(NodeType.MapLiteral, { entries }, lb, rb));
}

/**
 * @param {ParserBase} p
 * @returns {import('./types.js').MapEntryNode}
 */
function parseMapEntryInline(p) {
  /** @type {ExpressionNode} */
  let key;
  if (p.at(TokenType.String)) { const k = p.advance(); key = /** @type {import('./types.js').StringLiteralNode} */ (node(NodeType.StringLiteral, { value: k.value }, k, k)); }
  else if (p.at(TokenType.Identifier)) { const id = p.advance(); key = /** @type {import('./types.js').StringLiteralNode} */ (node(NodeType.StringLiteral, { value: id.value }, id, id)); }
  else { key = parseExpression(p); }
  p.expect(TokenType.Colon);
  const value = parseExpression(p);
  return /** @type {import('./types.js').MapEntryNode} */ (node(NodeType.MapEntry, { key, value }, key, value));
}

// ── Block: { stmts } ──

/**
 * Parse a block statement `{ ... }`.
 * @param {ParserBase} p
 * @returns {BlockStatementNode}
 */
export function parseBlockStatement(p) {
  const lb = p.expect(TokenType.LBrace);
  /** @type {StatementNode[]} */
  const body = [];
  while (!p.isEOF() && !p.at(TokenType.RBrace)) {
    body.push(parseStatement(p));
  }
  const rb = p.expect(TokenType.RBrace);
  return /** @type {BlockStatementNode} */ (node(NodeType.BlockStatement, { body }, lb, rb));
}

// ── var name [is Type] [= expr]; ──

/**
 * Parse a variable declaration with semicolon.
 * @param {ParserBase} p
 * @returns {VariableDeclarationNode}
 */
export function parseVarDeclaration(p) {
  const start = p.advance(); // var
  const name = p.expect(TokenType.Identifier);
  /** @type {string | null} */
  let typeConstraint = null;
  if (p.match(TokenType.Is)) typeConstraint = p.expect(TokenType.Identifier).value;
  /** @type {ExpressionNode | null} */
  let init = null;
  if (p.match(TokenType.Equal)) init = parseExpression(p);
  const end = p.expect(TokenType.Semicolon);
  return /** @type {VariableDeclarationNode} */ (node(NodeType.VariableDeclaration, { name: name.value, typeConstraint, init }, start, end));
}

// ── const name [is Type] = expr; ──

/**
 * Parse a constant declaration with semicolon.
 * @param {ParserBase} p
 * @returns {ConstantDeclarationNode}
 */
export function parseConstDeclaration(p) {
  const start = p.advance(); // const
  const name = p.expect(TokenType.Identifier);
  /** @type {string | null} */
  let typeConstraint = null;
  if (p.match(TokenType.Is)) typeConstraint = p.expect(TokenType.Identifier).value;
  p.expect(TokenType.Equal);
  const init = parseExpression(p);
  const end = p.expect(TokenType.Semicolon);
  return /** @type {ConstantDeclarationNode} */ (node(NodeType.ConstantDeclaration, { name: name.value, typeConstraint, init }, start, end));
}

// ── if (expr) stmt [else stmt] ──

/**
 * Parse an if statement.
 * @param {ParserBase} p
 * @returns {IfStatementNode}
 */
export function parseIfStatement(p) {
  const start = p.advance(); // if
  p.expect(TokenType.LParen);
  const test = parseExpression(p);
  p.expect(TokenType.RParen);
  const consequent = parseStatement(p);
  /** @type {StatementNode | null} */
  let alternate = null;
  if (p.match(TokenType.Else)) alternate = parseStatement(p);
  return /** @type {IfStatementNode} */ (node(NodeType.IfStatement, { test, consequent, alternate }, start, alternate ?? consequent));
}

// ── while (expr) stmt ──

/**
 * Parse a while statement.
 * @param {ParserBase} p
 * @returns {WhileStatementNode}
 */
export function parseWhileStatement(p) {
  const start = p.advance(); // while
  p.expect(TokenType.LParen);
  const test = parseExpression(p);
  p.expect(TokenType.RParen);
  const body = parseStatement(p);
  return /** @type {WhileStatementNode} */ (node(NodeType.WhileStatement, { test, body }, start, body));
}

// ── for ──
// Standard: for (init; cond; update) stmt
// For-in:   for (var a [, b] in expr) stmt

/**
 * Parse a for or for-in statement.
 * @param {ParserBase} p
 * @returns {ForStatementNode | ForInStatementNode}
 */
export function parseForStatement(p) {
  const start = p.advance(); // for
  p.expect(TokenType.LParen);

  // Detect for-in vs standard for
  if (isForIn(p)) {
    return parseForInStatement(p, start);
  }

  // Standard for
  /** @type {VariableDeclarationNode | ExpressionNode | null} */
  let init = null;
  if (!p.at(TokenType.Semicolon)) {
    if (p.at(TokenType.Var)) init = parseVarDeclarationNoSemicolon(p);
    else init = parseExpression(p);
  }
  p.expect(TokenType.Semicolon);
  /** @type {ExpressionNode | null} */
  let test = null;
  if (!p.at(TokenType.Semicolon)) test = parseExpression(p);
  p.expect(TokenType.Semicolon);
  /** @type {ExpressionNode | AssignmentStatementNode | null} */
  let update = null;
  if (!p.at(TokenType.RParen)) update = parseForUpdate(p);
  p.expect(TokenType.RParen);
  const body = parseStatement(p);
  return /** @type {ForStatementNode} */ (node(NodeType.ForStatement, { init, test, update, body }, start, body));
}

// For-loop update: expr or expr op= expr (no semicolon)

/**
 * @param {ParserBase} p
 * @returns {ExpressionNode | AssignmentStatementNode}
 */
function parseForUpdate(p) {
  const expr = parseExpression(p);
  if (ASSIGNMENT_OPS.has(p.peek().type)) {
    const op = p.advance();
    const value = parseExpression(p);
    return /** @type {AssignmentStatementNode} */ (node(NodeType.AssignmentStatement, { target: expr, operator: op.value, value }, expr, value));
  }
  return expr;
}

/**
 * @param {ParserBase} p
 * @returns {boolean}
 */
function isForIn(p) {
  // Look ahead: for ( [var] ident [, ident] in ...
  let i = p.pos;
  if (p.tokens[i]?.type === TokenType.Var) i++;
  if (p.tokens[i]?.type !== TokenType.Identifier) return false;
  i++;
  if (p.tokens[i]?.type === TokenType.Comma) { i++; i++; } // skip , ident
  return p.tokens[i]?.type === TokenType.In;
}

/**
 * @param {ParserBase} p
 * @param {import('./types.js').Token} start
 * @returns {ForInStatementNode}
 */
function parseForInStatement(p, start) {
  const hasVar = p.match(TokenType.Var);
  const varName = p.expect(TokenType.Identifier);
  /** @type {string | null} */
  let indexName = null;
  if (p.match(TokenType.Comma)) indexName = p.expect(TokenType.Identifier).value;
  p.expect(TokenType.In);
  const iterable = parseExpression(p);
  p.expect(TokenType.RParen);
  const body = parseStatement(p);
  return /** @type {ForInStatementNode} */ (node(NodeType.ForInStatement, {
    variable: varName.value, index: indexName, iterable, body, hasVar,
  }, start, body));
}

/**
 * @param {ParserBase} p
 * @returns {VariableDeclarationNode}
 */
function parseVarDeclarationNoSemicolon(p) {
  const start = p.advance(); // var
  const name = p.expect(TokenType.Identifier);
  /** @type {string | null} */
  let typeConstraint = null;
  if (p.match(TokenType.Is)) typeConstraint = p.expect(TokenType.Identifier).value;
  /** @type {ExpressionNode | null} */
  let init = null;
  if (p.match(TokenType.Equal)) init = parseExpression(p);
  return /** @type {VariableDeclarationNode} */ (node(NodeType.VariableDeclaration, { name: name.value, typeConstraint, init }, start, name));
}

// ── return [expr]; ──

/**
 * Parse a return statement.
 * @param {ParserBase} p
 * @returns {ReturnStatementNode}
 */
export function parseReturnStatement(p) {
  const start = p.advance();
  /** @type {ExpressionNode | null} */
  let value = null;
  if (!p.at(TokenType.Semicolon) && !p.at(TokenType.RBrace)) {
    value = parseExpression(p);
  }
  const end = p.expect(TokenType.Semicolon);
  return /** @type {ReturnStatementNode} */ (node(NodeType.ReturnStatement, { value }, start, end));
}

// ── break; ──

/**
 * Parse a break statement.
 * @param {ParserBase} p
 * @returns {BreakStatementNode}
 */
export function parseBreakStatement(p) {
  const start = p.advance();
  const end = p.expect(TokenType.Semicolon);
  return /** @type {BreakStatementNode} */ (node(NodeType.BreakStatement, {}, start, end));
}

// ── continue; ──

/**
 * Parse a continue statement.
 * @param {ParserBase} p
 * @returns {ContinueStatementNode}
 */
export function parseContinueStatement(p) {
  const start = p.advance();
  const end = p.expect(TokenType.Semicolon);
  return /** @type {ContinueStatementNode} */ (node(NodeType.ContinueStatement, {}, start, end));
}

// ── throw expr; ──

/**
 * Parse a throw statement.
 * @param {ParserBase} p
 * @returns {ThrowStatementNode}
 */
export function parseThrowStatement(p) {
  const start = p.advance();
  const value = parseExpression(p);
  const end = p.expect(TokenType.Semicolon);
  return /** @type {ThrowStatementNode} */ (node(NodeType.ThrowStatement, { value }, start, end));
}

// ── try stmt catch (var) stmt ──
// Also handles try(expr) as expression statement

/**
 * Parse a try-catch statement or try(expr) expression statement.
 * @param {ParserBase} p
 * @returns {TryCatchStatementNode | ExpressionStatementNode}
 */
export function parseTryCatchStatement(p) {
  const start = p.advance(); // try
  // try(expr) is an expression — redirect
  if (p.at(TokenType.LParen)) {
    p.expect(TokenType.LParen);
    const innerExpr = parseExpression(p);
    const rp = p.expect(TokenType.RParen);
    const tryExpr = /** @type {import('./types.js').TryExpressionNode} */ (node(NodeType.TryExpression, { expression: innerExpr }, start, rp));
    const end = p.expect(TokenType.Semicolon);
    return /** @type {ExpressionStatementNode} */ (node(NodeType.ExpressionStatement, { expression: tryExpr }, start, end));
  }
  const body = parseStatement(p);
  p.expect(TokenType.Catch);
  p.expect(TokenType.LParen);
  const param = p.expect(TokenType.Identifier);
  p.expect(TokenType.RParen);
  const handler = parseStatement(p);
  return /** @type {TryCatchStatementNode} */ (node(NodeType.TryCatchStatement, { body, param: param.value, handler }, start, handler));
}

// ── Assignment or expression statement ──

/**
 * Parse an assignment or expression statement.
 * @param {ParserBase} p
 * @returns {AssignmentStatementNode | ExpressionStatementNode}
 */
export function parseAssignmentOrExprStatement(p) {
  const expr = parseExpression(p);
  // Check for assignment operators
  if (ASSIGNMENT_OPS.has(p.peek().type)) {
    const op = p.advance();
    const value = parseExpression(p);
    const end = p.expect(TokenType.Semicolon);
    return /** @type {AssignmentStatementNode} */ (node(NodeType.AssignmentStatement, { target: expr, operator: op.value, value }, expr, end));
  }
  const end = p.expect(TokenType.Semicolon);
  return /** @type {ExpressionStatementNode} */ (node(NodeType.ExpressionStatement, { expression: expr }, expr, end));
}
