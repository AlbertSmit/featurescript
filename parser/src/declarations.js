import { TokenType } from './lexer.js';
import { node, NodeType } from './ast.js';
import { parseExpression, parseMapLiteral } from './expressions.js';
import { parseStatement, parseBlockStatement } from './statements.js';

// ── Main dispatcher ──

export function parseTopLevel(p) {
  // FeatureScript VERSION; — version header
  if (p.at(TokenType.Identifier) && p.peek().value === 'FeatureScript') {
    return parseVersionHeader(p);
  }

  const annotations = collectAnnotations(p);
  const exported = p.match(TokenType.Export);
  const t = p.peek();

  // Handle namespaced import: namespace::import(...)
  if (t.type === TokenType.Identifier && p.tokens[p.pos + 1]?.type === TokenType.ColonColon) {
    return parseNamespacedImport(p);
  }

  switch (t.type) {
    case TokenType.Import:      return parseImportStatement(p);
    case TokenType.Function:    return parseFunctionDeclaration(p, exported, annotations);
    case TokenType.Predicate:   return parsePredicateDeclaration(p, exported, annotations);
    case TokenType.Operator:    return parseOperatorOverload(p, exported, annotations);
    case TokenType.Enum:        return parseEnumDeclaration(p, exported, annotations);
    case TokenType.Type:        return parseTypeDeclaration(p, exported, annotations);
    case TokenType.Const:       return parseTopLevelConst(p, exported, annotations);
    default:
      p.error(`Unexpected top-level token '${t.value}'`, t);
      p.advance();
      return null;
  }
}

function parseVersionHeader(p) {
  const start = p.advance(); // FeatureScript
  const version = p.expect(TokenType.Number);
  const end = p.expect(TokenType.Semicolon);
  return node(NodeType.Program, { version: version.value }, start, end);
}

function parseNamespacedImport(p) {
  const ns = p.advance(); // namespace identifier
  p.expect(TokenType.ColonColon);
  const imp = parseImportStatement(p);
  imp.namespace = ns.value;
  return imp;
}

// ── Annotations ──
// Collects zero or more `annotation { ... }` blocks before a declaration.

function collectAnnotations(p) {
  const annotations = [];
  while (p.at(TokenType.Annotation)) {
    annotations.push(parseAnnotation(p));
  }
  return annotations;
}

export function parseAnnotation(p) {
  const start = p.advance(); // annotation
  const map = parseMapLiteral(p);
  return node(NodeType.Annotation, { entries: map.entries }, start, map);
}

// ── import(path: "...", version: "..."); ──
// [namespace::]import(path: "...", version: "...");

export function parseImportStatement(p) {
  let namespace = null;
  const start = p.peek();

  // Check if previous token was an identifier followed by ::
  // Actually, namespace comes before `import` keyword, so handle at parseTopLevel
  // For namespaced imports: ns::import(...) — ns is an identifier, :: is consumed, then import
  // We need to handle this specially since `export` may have been consumed already

  const importToken = p.expect(TokenType.Import);
  p.expect(TokenType.LParen);

  // Parse key-value pairs: path : "...", version : "..."
  const args = {};
  if (!p.at(TokenType.RParen)) {
    const key1 = p.expect(TokenType.Identifier);
    p.expect(TokenType.Colon);
    const val1 = p.expect(TokenType.String);
    args[key1.value] = val1.value;
    while (p.match(TokenType.Comma)) {
      if (p.at(TokenType.RParen)) break;
      const key = p.expect(TokenType.Identifier);
      p.expect(TokenType.Colon);
      const val = p.expect(TokenType.String);
      args[key.value] = val.value;
    }
  }
  p.expect(TokenType.RParen);
  const end = p.expect(TokenType.Semicolon);

  return node(NodeType.ImportStatement, {
    namespace,
    path: args.path ?? null,
    version: args.version ?? null,
  }, start, end);
}

// ── function name(params) [returns Type] [precondition { }] { body } ──

export function parseFunctionDeclaration(p, exported, annotations) {
  const start = p.advance(); // function
  const name = p.expect(TokenType.Identifier);
  const params = parseParameterList(p);
  let returnType = null;
  if (p.match(TokenType.Returns)) returnType = p.expect(TokenType.Identifier).value;
  let precondition = null;
  if (p.at(TokenType.Precondition)) precondition = parsePrecondition(p);
  const body = parseBlockStatement(p);
  return node(NodeType.FunctionDeclaration, {
    name: name.value, params, returnType, precondition, body, exported, annotations,
  }, start, body);
}

// ── predicate name(params) { body } ──

export function parsePredicateDeclaration(p, exported, annotations) {
  const start = p.advance(); // predicate
  const name = p.expect(TokenType.Identifier);
  const params = parseParameterList(p);
  const body = parseBlockStatement(p);
  return node(NodeType.PredicateDeclaration, {
    name: name.value, params, body, exported, annotations,
  }, start, body);
}

// ── operator OP(params) [returns Type] [precondition] { body } ──

export function parseOperatorOverload(p, exported, annotations) {
  const start = p.advance(); // operator
  const op = p.advance(); // the operator symbol (+, -, *, etc.)
  const params = parseParameterList(p);
  let returnType = null;
  if (p.match(TokenType.Returns)) returnType = p.expect(TokenType.Identifier).value;
  let precondition = null;
  if (p.at(TokenType.Precondition)) precondition = parsePrecondition(p);
  const body = parseBlockStatement(p);
  return node(NodeType.OperatorOverload, {
    operator: op.value, params, returnType, precondition, body, exported, annotations,
  }, start, body);
}

// ── enum Name { [annotation] VALUE, ... } ──

export function parseEnumDeclaration(p, exported, annotations) {
  const start = p.advance(); // enum
  const name = p.expect(TokenType.Identifier);
  p.expect(TokenType.LBrace);
  const values = [];
  while (!p.isEOF() && !p.at(TokenType.RBrace)) {
    const valAnnotations = collectAnnotations(p);
    const valName = p.expect(TokenType.Identifier);
    values.push(node(NodeType.EnumValue, {
      name: valName.value, annotations: valAnnotations,
    }, valName, valName));
    // Comma is optional before }
    if (!p.at(TokenType.RBrace)) p.match(TokenType.Comma);
  }
  const end = p.expect(TokenType.RBrace);
  return node(NodeType.EnumDeclaration, {
    name: name.value, values, exported, annotations,
  }, start, end);
}

// ── type Name typecheck predicateName; ──

export function parseTypeDeclaration(p, exported, annotations) {
  const start = p.advance(); // type
  const name = p.expect(TokenType.Identifier);
  p.expect(TokenType.Typecheck);
  const predicate = p.expect(TokenType.Identifier);
  const end = p.expect(TokenType.Semicolon);
  return node(NodeType.TypeDeclaration, {
    name: name.value, typecheck: predicate.value, exported, annotations,
  }, start, end);
}

// ── const name [is Type] = expr; ──

export function parseTopLevelConst(p, exported, annotations) {
  const start = p.advance(); // const
  const name = p.expect(TokenType.Identifier);
  let typeConstraint = null;
  if (p.match(TokenType.Is)) typeConstraint = p.expect(TokenType.Identifier).value;
  p.expect(TokenType.Equal);
  const init = parseExpression(p);
  const end = p.expect(TokenType.Semicolon);
  return node(NodeType.ConstantDeclaration, {
    name: name.value, typeConstraint, init, exported, annotations,
  }, start, end);
}

// ── Parameter list: (name [is Type], ...) ──

export function parseParameterList(p) {
  p.expect(TokenType.LParen);
  const params = [];
  if (!p.at(TokenType.RParen)) {
    params.push(parseParam(p));
    while (p.match(TokenType.Comma)) params.push(parseParam(p));
  }
  p.expect(TokenType.RParen);
  return params;
}

function parseParam(p) {
  const name = p.expect(TokenType.Identifier);
  let typeConstraint = null;
  if (p.match(TokenType.Is)) typeConstraint = p.expect(TokenType.Identifier).value;
  return node(NodeType.Parameter, { name: name.value, typeConstraint }, name, name);
}

// ── precondition { stmt } or precondition stmt ──

export function parsePrecondition(p) {
  const start = p.advance(); // precondition
  let body;
  if (p.at(TokenType.LBrace)) {
    body = parseBlockStatement(p);
  } else {
    body = parseStatement(p);
  }
  return node(NodeType.Precondition, { body }, start, body);
}
