import { TokenType } from './lexer.js';
import { node, NodeType } from './ast.js';
import { parseExpression } from './expressions.js';

const ASSIGNMENT_OPS = new Set([
  TokenType.Equal, TokenType.PlusEqual, TokenType.MinusEqual,
  TokenType.StarEqual, TokenType.SlashEqual, TokenType.CaretEqual,
  TokenType.PercentEqual, TokenType.PipePipeEqual, TokenType.AmpAmpEqual,
  TokenType.QuestionQuestionEqual, TokenType.TildeEqual,
]);

// ── Main dispatcher ──

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
function parseAnnotationStatement(p) {
  const start = p.advance(); // annotation
  const map = parseMapLiteralImported(p);
  const ann = node(NodeType.Annotation, { entries: map.entries }, start, map);
  // The next statement is the annotated statement
  const stmt = parseStatement(p);
  stmt.annotations = [ann, ...(stmt.annotations || [])];
  return stmt;
}

// Inline map literal parse to avoid circular import
function parseMapLiteralImported(p) {
  const lb = p.expect(TokenType.LBrace);
  const entries = [];
  if (!p.at(TokenType.RBrace)) {
    entries.push(parseMapEntryInline(p));
    while (p.match(TokenType.Comma)) {
      if (p.at(TokenType.RBrace)) break;
      entries.push(parseMapEntryInline(p));
    }
  }
  const rb = p.expect(TokenType.RBrace);
  return node(NodeType.MapLiteral, { entries }, lb, rb);
}

function parseMapEntryInline(p) {
  let key;
  if (p.at(TokenType.String)) { key = p.advance(); key = node(NodeType.StringLiteral, { value: key.value }, key, key); }
  else if (p.at(TokenType.Identifier)) { const id = p.advance(); key = node(NodeType.StringLiteral, { value: id.value }, id, id); }
  else { key = parseExpression(p); }
  p.expect(TokenType.Colon);
  const value = parseExpression(p);
  return node(NodeType.MapEntry, { key, value }, key, value);
}

// ── Block: { stmts } ──

export function parseBlockStatement(p) {
  const lb = p.expect(TokenType.LBrace);
  const body = [];
  while (!p.isEOF() && !p.at(TokenType.RBrace)) {
    body.push(parseStatement(p));
  }
  const rb = p.expect(TokenType.RBrace);
  return node(NodeType.BlockStatement, { body }, lb, rb);
}

// ── var name [is Type] [= expr]; ──

export function parseVarDeclaration(p) {
  const start = p.advance(); // var
  const name = p.expect(TokenType.Identifier);
  let typeConstraint = null;
  if (p.match(TokenType.Is)) typeConstraint = p.expect(TokenType.Identifier).value;
  let init = null;
  if (p.match(TokenType.Equal)) init = parseExpression(p);
  const end = p.expect(TokenType.Semicolon);
  return node(NodeType.VariableDeclaration, { name: name.value, typeConstraint, init }, start, end);
}

// ── const name [is Type] = expr; ──

export function parseConstDeclaration(p) {
  const start = p.advance(); // const
  const name = p.expect(TokenType.Identifier);
  let typeConstraint = null;
  if (p.match(TokenType.Is)) typeConstraint = p.expect(TokenType.Identifier).value;
  p.expect(TokenType.Equal);
  const init = parseExpression(p);
  const end = p.expect(TokenType.Semicolon);
  return node(NodeType.ConstantDeclaration, { name: name.value, typeConstraint, init }, start, end);
}

// ── if (expr) stmt [else stmt] ──

export function parseIfStatement(p) {
  const start = p.advance(); // if
  p.expect(TokenType.LParen);
  const test = parseExpression(p);
  p.expect(TokenType.RParen);
  const consequent = parseStatement(p);
  let alternate = null;
  if (p.match(TokenType.Else)) alternate = parseStatement(p);
  return node(NodeType.IfStatement, { test, consequent, alternate }, start, alternate ?? consequent);
}

// ── while (expr) stmt ──

export function parseWhileStatement(p) {
  const start = p.advance(); // while
  p.expect(TokenType.LParen);
  const test = parseExpression(p);
  p.expect(TokenType.RParen);
  const body = parseStatement(p);
  return node(NodeType.WhileStatement, { test, body }, start, body);
}

// ── for ──
// Standard: for (init; cond; update) stmt
// For-in:   for (var a [, b] in expr) stmt

export function parseForStatement(p) {
  const start = p.advance(); // for
  p.expect(TokenType.LParen);

  // Detect for-in vs standard for
  if (isForIn(p)) {
    return parseForInStatement(p, start);
  }

  // Standard for
  let init = null;
  if (!p.at(TokenType.Semicolon)) {
    if (p.at(TokenType.Var)) init = parseVarDeclarationNoSemicolon(p);
    else init = parseExpression(p);
  }
  p.expect(TokenType.Semicolon);
  let test = null;
  if (!p.at(TokenType.Semicolon)) test = parseExpression(p);
  p.expect(TokenType.Semicolon);
  let update = null;
  if (!p.at(TokenType.RParen)) update = parseForUpdate(p);
  p.expect(TokenType.RParen);
  const body = parseStatement(p);
  return node(NodeType.ForStatement, { init, test, update, body }, start, body);
}

// For-loop update: expr or expr op= expr (no semicolon)
function parseForUpdate(p) {
  const expr = parseExpression(p);
  if (ASSIGNMENT_OPS.has(p.peek().type)) {
    const op = p.advance();
    const value = parseExpression(p);
    return node(NodeType.AssignmentStatement, { target: expr, operator: op.value, value }, expr, value);
  }
  return expr;
}

function isForIn(p) {
  // Look ahead: for ( [var] ident [, ident] in ...
  let i = p.pos;
  if (p.tokens[i]?.type === TokenType.Var) i++;
  if (p.tokens[i]?.type !== TokenType.Identifier) return false;
  i++;
  if (p.tokens[i]?.type === TokenType.Comma) { i++; i++; } // skip , ident
  return p.tokens[i]?.type === TokenType.In;
}

function parseForInStatement(p, start) {
  const hasVar = p.match(TokenType.Var);
  const varName = p.expect(TokenType.Identifier);
  let indexName = null;
  if (p.match(TokenType.Comma)) indexName = p.expect(TokenType.Identifier).value;
  p.expect(TokenType.In);
  const iterable = parseExpression(p);
  p.expect(TokenType.RParen);
  const body = parseStatement(p);
  return node(NodeType.ForInStatement, {
    variable: varName.value, index: indexName, iterable, body, hasVar,
  }, start, body);
}

function parseVarDeclarationNoSemicolon(p) {
  const start = p.advance(); // var
  const name = p.expect(TokenType.Identifier);
  let typeConstraint = null;
  if (p.match(TokenType.Is)) typeConstraint = p.expect(TokenType.Identifier).value;
  let init = null;
  if (p.match(TokenType.Equal)) init = parseExpression(p);
  return node(NodeType.VariableDeclaration, { name: name.value, typeConstraint, init }, start, name);
}

// ── return [expr]; ──

export function parseReturnStatement(p) {
  const start = p.advance();
  let value = null;
  if (!p.at(TokenType.Semicolon) && !p.at(TokenType.RBrace)) {
    value = parseExpression(p);
  }
  const end = p.expect(TokenType.Semicolon);
  return node(NodeType.ReturnStatement, { value }, start, end);
}

// ── break; ──

export function parseBreakStatement(p) {
  const start = p.advance();
  const end = p.expect(TokenType.Semicolon);
  return node(NodeType.BreakStatement, {}, start, end);
}

// ── continue; ──

export function parseContinueStatement(p) {
  const start = p.advance();
  const end = p.expect(TokenType.Semicolon);
  return node(NodeType.ContinueStatement, {}, start, end);
}

// ── throw expr; ──

export function parseThrowStatement(p) {
  const start = p.advance();
  const value = parseExpression(p);
  const end = p.expect(TokenType.Semicolon);
  return node(NodeType.ThrowStatement, { value }, start, end);
}

// ── try stmt catch (var) stmt ──
// Also handles try(expr) as expression statement

export function parseTryCatchStatement(p) {
  const start = p.advance(); // try
  // try(expr) is an expression — redirect
  if (p.at(TokenType.LParen)) {
    p.expect(TokenType.LParen);
    const innerExpr = parseExpression(p);
    const rp = p.expect(TokenType.RParen);
    const tryExpr = node(NodeType.TryExpression, { expression: innerExpr }, start, rp);
    const end = p.expect(TokenType.Semicolon);
    return node(NodeType.ExpressionStatement, { expression: tryExpr }, start, end);
  }
  const body = parseStatement(p);
  p.expect(TokenType.Catch);
  p.expect(TokenType.LParen);
  const param = p.expect(TokenType.Identifier);
  p.expect(TokenType.RParen);
  const handler = parseStatement(p);
  return node(NodeType.TryCatchStatement, { body, param: param.value, handler }, start, handler);
}

// ── Assignment or expression statement ──

export function parseAssignmentOrExprStatement(p) {
  const expr = parseExpression(p);
  // Check for assignment operators
  if (ASSIGNMENT_OPS.has(p.peek().type)) {
    const op = p.advance();
    const value = parseExpression(p);
    const end = p.expect(TokenType.Semicolon);
    return node(NodeType.AssignmentStatement, { target: expr, operator: op.value, value }, expr, end);
  }
  const end = p.expect(TokenType.Semicolon);
  return node(NodeType.ExpressionStatement, { expression: expr }, expr, end);
}
