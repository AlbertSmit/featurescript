import { TokenType } from './lexer.js';
import { node, NodeType } from './ast.js';
import { parseStatement } from './statements.js';

// ── Operator precedence (lowest → highest) ──
const PREC = {
  [TokenType.PipePipe]: 1,
  [TokenType.AmpAmp]: 2,
  [TokenType.QuestionQuestion]: 3,
  [TokenType.EqualEqual]: 4, [TokenType.BangEqual]: 4,
  [TokenType.Less]: 5, [TokenType.Greater]: 5,
  [TokenType.LessEqual]: 5, [TokenType.GreaterEqual]: 5,
  [TokenType.Tilde]: 6,
  [TokenType.Plus]: 7, [TokenType.Minus]: 7,
  [TokenType.Star]: 8, [TokenType.Slash]: 8, [TokenType.Percent]: 8,
  [TokenType.Caret]: 9,
};

function isBinaryOp(type) { return type in PREC; }

// ── Public entry ──

export function parseExpression(p) {
  return parseTernaryExpr(p);
}

// ── Ternary: cond ? a : b ──

export function parseTernaryExpr(p) {
  let expr = parseBinaryExpr(p, 0);
  if (p.at(TokenType.Question)) {
    p.advance();
    const consequent = parseExpression(p);
    p.expect(TokenType.Colon);
    const alternate = parseExpression(p);
    expr = node(NodeType.TernaryExpression, { test: expr, consequent, alternate }, expr.loc.start, alternate);
  }
  return expr;
}

// ── Binary: precedence climbing ──

export function parseBinaryExpr(p, minPrec) {
  let left = parseUnaryExpr(p);
  while (!p.isEOF()) {
    const op = p.peek();
    // Handle `is` and `as` as binary-like type ops
    if (op.type === TokenType.Is) {
      p.advance();
      const typeName = p.expect(TokenType.Identifier);
      left = node(NodeType.TypeExpression, { expression: left, typeName: typeName.value }, left, typeName);
      continue;
    }
    if (op.type === TokenType.As) {
      p.advance();
      const typeName = p.expect(TokenType.Identifier);
      left = node(NodeType.CastExpression, { expression: left, typeName: typeName.value }, left, typeName);
      continue;
    }
    if (!isBinaryOp(op.type)) break;
    const prec = PREC[op.type];
    if (prec < minPrec) break;
    p.advance();
    const right = parseBinaryExpr(p, prec + 1);
    left = node(NodeType.BinaryExpression, { operator: op.value, left, right }, left, right);
  }
  return left;
}

// ── Unary: - ! ──

export function parseUnaryExpr(p) {
  if (p.atAny(TokenType.Minus, TokenType.Bang)) {
    const op = p.advance();
    const operand = parseUnaryExpr(p);
    return node(NodeType.UnaryExpression, { operator: op.value, operand }, op, operand);
  }
  return parsePostfixExpr(p);
}

// ── Postfix: calls, member access, subscript, arrow call ──

function parsePostfixExpr(p) {
  let expr = parsePrimaryExpr(p);
  while (!p.isEOF()) {
    if (p.at(TokenType.LParen)) {
      expr = parseCallExpr(p, expr);
    } else if (p.at(TokenType.Dot)) {
      p.advance();
      const prop = p.expect(TokenType.Identifier);
      expr = node(NodeType.MemberExpression, { object: expr, property: prop.value }, expr, prop);
    } else if (p.at(TokenType.SafeDot)) {
      p.advance();
      const prop = p.expect(TokenType.Identifier);
      expr = node(NodeType.SafeMemberExpression, { object: expr, property: prop.value }, expr, prop);
    } else if (p.at(TokenType.LBracket)) {
      const lb = p.advance();
      if (p.at(TokenType.RBracket)) {
        const rb = p.advance();
        expr = node(NodeType.BoxAccessExpression, { object: expr }, expr, rb);
      } else {
        const index = parseExpression(p);
        const rb = p.expect(TokenType.RBracket);
        expr = node(NodeType.SubscriptExpression, { object: expr, index }, expr, rb);
      }
    } else if (p.at(TokenType.SafeBracket)) {
      p.advance();
      if (p.at(TokenType.RBracket)) {
        const rb = p.advance();
        expr = node(NodeType.SafeBoxAccessExpression, { object: expr }, expr, rb);
      } else {
        const index = parseExpression(p);
        const rb = p.expect(TokenType.RBracket);
        expr = node(NodeType.SafeSubscriptExpression, { object: expr, index }, expr, rb);
      }
    } else if (p.at(TokenType.Arrow)) {
      expr = parseArrowCall(p, expr);
    } else {
      break;
    }
  }
  return expr;
}

// ── Call: f(a, b, c) ──

export function parseCallExpr(p, callee) {
  p.expect(TokenType.LParen);
  const args = [];
  if (!p.at(TokenType.RParen)) {
    args.push(parseExpression(p));
    while (p.match(TokenType.Comma)) args.push(parseExpression(p));
  }
  const rp = p.expect(TokenType.RParen);
  return node(NodeType.CallExpression, { callee, arguments: args }, callee, rp);
}

// ── Arrow call: x->f(y, z) ──

export function parseArrowCall(p, left) {
  p.advance(); // ->
  const name = p.expect(TokenType.Identifier);
  p.expect(TokenType.LParen);
  const args = [];
  if (!p.at(TokenType.RParen)) {
    args.push(parseExpression(p));
    while (p.match(TokenType.Comma)) args.push(parseExpression(p));
  }
  const rp = p.expect(TokenType.RParen);
  return node(NodeType.ArrowCallExpression, { object: left, method: name.value, arguments: args }, left, rp);
}

// ── Primary expressions ──

export function parsePrimaryExpr(p) {
  const t = p.peek();

  switch (t.type) {
    case TokenType.Number: { p.advance(); return node(NodeType.NumberLiteral, { value: Number(t.value) }, t, t); }
    case TokenType.String: { p.advance(); return node(NodeType.StringLiteral, { value: t.value }, t, t); }
    case TokenType.True:   { p.advance(); return node(NodeType.BooleanLiteral, { value: true }, t, t); }
    case TokenType.False:  { p.advance(); return node(NodeType.BooleanLiteral, { value: false }, t, t); }
    case TokenType.Inf:    { p.advance(); return node(NodeType.InfLiteral, {}, t, t); }
    case TokenType.Undefined: { p.advance(); return node(NodeType.UndefinedLiteral, {}, t, t); }

    case TokenType.Identifier: {
      p.advance();
      // namespace::symbol
      if (p.at(TokenType.ColonColon)) {
        p.advance();
        const sym = p.expect(TokenType.Identifier);
        return node(NodeType.NamespaceAccess, { namespace: t.value, name: sym.value }, t, sym);
      }
      return node(NodeType.Identifier, { name: t.value }, t, t);
    }

    case TokenType.BuiltinId: { p.advance(); return node(NodeType.BuiltinIdentifier, { name: t.value }, t, t); }

    case TokenType.LBracket: return parseArrayLiteral(p);
    case TokenType.LBrace:   return parseMapLiteral(p);
    case TokenType.Function: return parseLambdaExpr(p);
    case TokenType.New:      return parseNewBoxExpr(p);

    case TokenType.Try: {
      // try(expr) — expression form
      p.advance();
      if (p.at(TokenType.LParen)) {
        return parseTryExpr(p, t);
      }
      p.error('Expected ( after try in expression context', t);
      return node(NodeType.Identifier, { name: 'try' }, t, t);
    }

    case TokenType.LParen: {
      // Could be grouping or lambda: (args) => expr
      return parseParenOrLambda(p);
    }

    default:
      p.error(`Unexpected token '${t.value}'`, t);
      p.advance();
      return node(NodeType.Identifier, { name: t.value }, t, t);
  }
}

// ── Disambiguate (expr) vs (params) => body ──

function parseParenOrLambda(p) {
  // Look ahead to determine if this is a lambda
  const saved = p.pos;
  if (isLambdaStart(p)) {
    return parseLambdaArrow(p);
  }
  // Grouping: (expr)
  const lp = p.advance();
  const expr = parseExpression(p);
  const rp = p.expect(TokenType.RParen);
  return node(NodeType.GroupExpression, { expression: expr }, lp, rp);
}

function isLambdaStart(p) {
  // Scan ahead from ( to matching ) and check for =>
  let depth = 0;
  let i = p.pos;
  while (i < p.tokens.length) {
    const tt = p.tokens[i].type;
    if (tt === TokenType.LParen) depth++;
    else if (tt === TokenType.RParen) { depth--; if (depth === 0) { i++; break; } }
    else if (tt === TokenType.EOF) return false;
    i++;
  }
  // Check for optional `returns Type` then `=>`
  if (i < p.tokens.length && p.tokens[i].type === TokenType.Returns) {
    i++; // skip returns
    if (i < p.tokens.length) i++; // skip type name
  }
  return i < p.tokens.length && p.tokens[i].type === TokenType.FatArrow;
}

// ── Lambda: (params) => expr | (params) => { body } ──

function parseLambdaArrow(p) {
  const start = p.peek();
  const params = parseLambdaParams(p);
  let returnType = null;
  if (p.match(TokenType.Returns)) {
    returnType = p.expect(TokenType.Identifier).value;
  }
  p.expect(TokenType.FatArrow);
  let body;
  if (p.at(TokenType.LBrace)) {
    body = parseLambdaBlock(p);
  } else {
    body = parseExpression(p);
  }
  return node(NodeType.LambdaExpression, { params, returnType, body }, start, body);
}

function parseLambdaParams(p) {
  p.expect(TokenType.LParen);
  const params = [];
  if (!p.at(TokenType.RParen)) {
    params.push(parseLambdaParam(p));
    while (p.match(TokenType.Comma)) params.push(parseLambdaParam(p));
  }
  p.expect(TokenType.RParen);
  return params;
}

function parseLambdaParam(p) {
  const name = p.expect(TokenType.Identifier);
  let typeConstraint = null;
  if (p.match(TokenType.Is)) {
    typeConstraint = p.expect(TokenType.Identifier).value;
  }
  return node(NodeType.Parameter, { name: name.value, typeConstraint }, name, name);
}

// Parse a block body for a function expression — delegates to statement parser
function parseFunctionExprBlock(p) {
  const lb = p.expect(TokenType.LBrace);
  const stmts = [];
  while (!p.isEOF() && !p.at(TokenType.RBrace)) {
    stmts.push(parseStatement(p));
  }
  const rb = p.expect(TokenType.RBrace);
  return node(NodeType.BlockStatement, { body: stmts }, lb, rb);
}

// ── function(...) { ... } lambda ──

export function parseLambdaExpr(p) {
  const start = p.advance(); // function
  const params = parseLambdaParams(p);
  let returnType = null;
  if (p.match(TokenType.Returns)) returnType = p.expect(TokenType.Identifier).value;
  // precondition block — used in defineFeature(function(...) precondition { } { })
  let precondition = null;
  if (p.at(TokenType.Precondition)) {
    const pcStart = p.advance(); // precondition
    const pcBody = parseFunctionExprBlock(p);
    precondition = node(NodeType.Precondition, { body: pcBody }, pcStart, pcBody);
  }
  const body = parseFunctionExprBlock(p);
  return node(NodeType.LambdaExpression, { params, returnType, precondition, body }, start, body);
}

// ── new box(expr) ──

export function parseNewBoxExpr(p) {
  const start = p.advance(); // new
  p.expect(TokenType.Identifier); // 'box'
  p.expect(TokenType.LParen);
  const value = parseExpression(p);
  const rp = p.expect(TokenType.RParen);
  return node(NodeType.NewBoxExpression, { value }, start, rp);
}

// ── try(expr) ──

export function parseTryExpr(p, tryToken) {
  p.expect(TokenType.LParen);
  const expr = parseExpression(p);
  const rp = p.expect(TokenType.RParen);
  return node(NodeType.TryExpression, { expression: expr }, tryToken, rp);
}

// ── Array literal: [a, b, c] ──

export function parseArrayLiteral(p) {
  const lb = p.advance(); // [
  const elements = [];
  if (!p.at(TokenType.RBracket)) {
    elements.push(parseExpression(p));
    while (p.match(TokenType.Comma)) {
      if (p.at(TokenType.RBracket)) break; // trailing comma
      elements.push(parseExpression(p));
    }
  }
  const rb = p.expect(TokenType.RBracket);
  return node(NodeType.ArrayLiteral, { elements }, lb, rb);
}

// ── Map literal: { key: val, ... } ──

export function parseMapLiteral(p) {
  const lb = p.advance(); // {
  const entries = [];
  if (!p.at(TokenType.RBrace)) {
    entries.push(parseMapEntry(p));
    while (p.match(TokenType.Comma)) {
      if (p.at(TokenType.RBrace)) break;
      entries.push(parseMapEntry(p));
    }
  }
  const rb = p.expect(TokenType.RBrace);
  return node(NodeType.MapLiteral, { entries }, lb, rb);
}

function parseMapEntry(p) {
  let key;
  const t = p.peek();
  if (p.at(TokenType.LParen)) {
    // (expr) : value — computed key
    p.advance();
    key = parseExpression(p);
    p.expect(TokenType.RParen);
    key = node(NodeType.GroupExpression, { expression: key }, t, key);
  } else if (p.at(TokenType.String)) {
    key = parsePrimaryExpr(p);
  } else if (p.at(TokenType.Number)) {
    key = parsePrimaryExpr(p);
  } else if (p.at(TokenType.Identifier)) {
    // Unquoted string key
    const id = p.advance();
    key = node(NodeType.StringLiteral, { value: `"${id.value}"` }, id, id);
  } else {
    // Complex key (e.g. map as key)
    key = parseExpression(p);
  }
  p.expect(TokenType.Colon);
  const value = parseExpression(p);
  return node(NodeType.MapEntry, { key, value }, key, value);
}
