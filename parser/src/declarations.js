import { TokenType } from './lexer.js';
import { node, NodeType } from './ast.js';
import { parseExpression, parseMapLiteral } from './expressions.js';
import { parseStatement, parseBlockStatement } from './statements.js';

/** @typedef {import('./types.js').ParserBase} ParserBase */
/** @typedef {import('./types.js').ASTNode} ASTNode */
/** @typedef {import('./types.js').AnnotationNode} AnnotationNode */
/** @typedef {import('./types.js').ImportStatementNode} ImportStatementNode */
/** @typedef {import('./types.js').FunctionDeclarationNode} FunctionDeclarationNode */
/** @typedef {import('./types.js').PredicateDeclarationNode} PredicateDeclarationNode */
/** @typedef {import('./types.js').OperatorOverloadNode} OperatorOverloadNode */
/** @typedef {import('./types.js').EnumDeclarationNode} EnumDeclarationNode */
/** @typedef {import('./types.js').TypeDeclarationNode} TypeDeclarationNode */
/** @typedef {import('./types.js').ConstantDeclarationNode} ConstantDeclarationNode */
/** @typedef {import('./types.js').ParameterNode} ParameterNode */
/** @typedef {import('./types.js').PreconditionNode} PreconditionNode */

// ── Main dispatcher ──

/**
 * Parse a single top-level declaration or directive.
 * @param {ParserBase} p
 * @returns {ASTNode | null}
 */
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

/**
 * @param {ParserBase} p
 * @returns {ASTNode}
 */
function parseVersionHeader(p) {
  const start = p.advance(); // FeatureScript
  const version = p.expect(TokenType.Number);
  const end = p.expect(TokenType.Semicolon);
  return node(NodeType.Program, { version: version.value }, start, end);
}

/**
 * @param {ParserBase} p
 * @returns {ASTNode}
 */
function parseNamespacedImport(p) {
  const ns = p.advance(); // namespace identifier
  p.expect(TokenType.ColonColon);
  const imp = parseImportStatement(p);
  imp.namespace = ns.value;
  return imp;
}

// ── Annotations ──
// Collects zero or more `annotation { ... }` blocks before a declaration.

/**
 * @param {ParserBase} p
 * @returns {AnnotationNode[]}
 */
function collectAnnotations(p) {
  /** @type {AnnotationNode[]} */
  const annotations = [];
  while (p.at(TokenType.Annotation)) {
    annotations.push(parseAnnotation(p));
  }
  return annotations;
}

/**
 * Parse a single `annotation { ... }` block.
 * @param {ParserBase} p
 * @returns {AnnotationNode}
 */
export function parseAnnotation(p) {
  const start = p.advance(); // annotation
  const map = parseMapLiteral(p);
  return /** @type {AnnotationNode} */ (node(NodeType.Annotation, { entries: map.entries }, start, map));
}

// ── import(path: "...", version: "..."); ──
// [namespace::]import(path: "...", version: "...");

/**
 * Parse an import statement.
 * @param {ParserBase} p
 * @returns {ImportStatementNode}
 */
export function parseImportStatement(p) {
  /** @type {string | null} */
  let namespace = null;
  const start = p.peek();

  const importToken = p.expect(TokenType.Import);
  p.expect(TokenType.LParen);

  // Parse key-value pairs: path : "...", version : "..."
  /** @type {Record<string, string>} */
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

  return /** @type {ImportStatementNode} */ (node(NodeType.ImportStatement, {
    namespace,
    path: args.path ?? null,
    version: args.version ?? null,
  }, start, end));
}

// ── function name(params) [returns Type] [precondition { }] { body } ──

/**
 * Parse a function declaration.
 * @param {ParserBase} p
 * @param {boolean} exported
 * @param {AnnotationNode[]} annotations
 * @returns {FunctionDeclarationNode}
 */
export function parseFunctionDeclaration(p, exported, annotations) {
  const start = p.advance(); // function
  const name = p.expect(TokenType.Identifier);
  const params = parseParameterList(p);
  /** @type {string | null} */
  let returnType = null;
  if (p.match(TokenType.Returns)) returnType = p.expect(TokenType.Identifier).value;
  /** @type {PreconditionNode | null} */
  let precondition = null;
  if (p.at(TokenType.Precondition)) precondition = parsePrecondition(p);
  const body = parseBlockStatement(p);
  return /** @type {FunctionDeclarationNode} */ (node(NodeType.FunctionDeclaration, {
    name: name.value, params, returnType, precondition, body, exported, annotations,
  }, start, body));
}

// ── predicate name(params) { body } ──

/**
 * Parse a predicate declaration.
 * @param {ParserBase} p
 * @param {boolean} exported
 * @param {AnnotationNode[]} annotations
 * @returns {PredicateDeclarationNode}
 */
export function parsePredicateDeclaration(p, exported, annotations) {
  const start = p.advance(); // predicate
  const name = p.expect(TokenType.Identifier);
  const params = parseParameterList(p);
  const body = parseBlockStatement(p);
  return /** @type {PredicateDeclarationNode} */ (node(NodeType.PredicateDeclaration, {
    name: name.value, params, body, exported, annotations,
  }, start, body));
}

// ── operator OP(params) [returns Type] [precondition] { body } ──

/**
 * Parse an operator overload declaration.
 * @param {ParserBase} p
 * @param {boolean} exported
 * @param {AnnotationNode[]} annotations
 * @returns {OperatorOverloadNode}
 */
export function parseOperatorOverload(p, exported, annotations) {
  const start = p.advance(); // operator
  const op = p.advance(); // the operator symbol (+, -, *, etc.)
  const params = parseParameterList(p);
  /** @type {string | null} */
  let returnType = null;
  if (p.match(TokenType.Returns)) returnType = p.expect(TokenType.Identifier).value;
  /** @type {PreconditionNode | null} */
  let precondition = null;
  if (p.at(TokenType.Precondition)) precondition = parsePrecondition(p);
  const body = parseBlockStatement(p);
  return /** @type {OperatorOverloadNode} */ (node(NodeType.OperatorOverload, {
    operator: op.value, params, returnType, precondition, body, exported, annotations,
  }, start, body));
}

// ── enum Name { [annotation] VALUE, ... } ──

/**
 * Parse an enum declaration.
 * @param {ParserBase} p
 * @param {boolean} exported
 * @param {AnnotationNode[]} annotations
 * @returns {EnumDeclarationNode}
 */
export function parseEnumDeclaration(p, exported, annotations) {
  const start = p.advance(); // enum
  const name = p.expect(TokenType.Identifier);
  p.expect(TokenType.LBrace);
  /** @type {import('./types.js').EnumValueNode[]} */
  const values = [];
  while (!p.isEOF() && !p.at(TokenType.RBrace)) {
    const valAnnotations = collectAnnotations(p);
    const valName = p.expect(TokenType.Identifier);
    values.push(/** @type {import('./types.js').EnumValueNode} */ (node(NodeType.EnumValue, {
      name: valName.value, annotations: valAnnotations,
    }, valName, valName)));
    // Comma is optional before }
    if (!p.at(TokenType.RBrace)) p.match(TokenType.Comma);
  }
  const end = p.expect(TokenType.RBrace);
  return /** @type {EnumDeclarationNode} */ (node(NodeType.EnumDeclaration, {
    name: name.value, values, exported, annotations,
  }, start, end));
}

// ── type Name typecheck predicateName; ──

/**
 * Parse a type declaration.
 * @param {ParserBase} p
 * @param {boolean} exported
 * @param {AnnotationNode[]} annotations
 * @returns {TypeDeclarationNode}
 */
export function parseTypeDeclaration(p, exported, annotations) {
  const start = p.advance(); // type
  const name = p.expect(TokenType.Identifier);
  p.expect(TokenType.Typecheck);
  const predicate = p.expect(TokenType.Identifier);
  const end = p.expect(TokenType.Semicolon);
  return /** @type {TypeDeclarationNode} */ (node(NodeType.TypeDeclaration, {
    name: name.value, typecheck: predicate.value, exported, annotations,
  }, start, end));
}

// ── const name [is Type] = expr; ──

/**
 * Parse a top-level constant declaration.
 * @param {ParserBase} p
 * @param {boolean} exported
 * @param {AnnotationNode[]} annotations
 * @returns {ConstantDeclarationNode}
 */
export function parseTopLevelConst(p, exported, annotations) {
  const start = p.advance(); // const
  const name = p.expect(TokenType.Identifier);
  /** @type {string | null} */
  let typeConstraint = null;
  if (p.match(TokenType.Is)) typeConstraint = p.expect(TokenType.Identifier).value;
  p.expect(TokenType.Equal);
  const init = parseExpression(p);
  const end = p.expect(TokenType.Semicolon);
  return /** @type {ConstantDeclarationNode} */ (node(NodeType.ConstantDeclaration, {
    name: name.value, typeConstraint, init, exported, annotations,
  }, start, end));
}

// ── Parameter list: (name [is Type], ...) ──

/**
 * Parse a parenthesized parameter list.
 * @param {ParserBase} p
 * @returns {ParameterNode[]}
 */
export function parseParameterList(p) {
  p.expect(TokenType.LParen);
  /** @type {ParameterNode[]} */
  const params = [];
  if (!p.at(TokenType.RParen)) {
    params.push(parseParam(p));
    while (p.match(TokenType.Comma)) params.push(parseParam(p));
  }
  p.expect(TokenType.RParen);
  return params;
}

/**
 * @param {ParserBase} p
 * @returns {ParameterNode}
 */
function parseParam(p) {
  const name = p.expect(TokenType.Identifier);
  /** @type {string | null} */
  let typeConstraint = null;
  if (p.match(TokenType.Is)) typeConstraint = p.expect(TokenType.Identifier).value;
  return /** @type {ParameterNode} */ (node(NodeType.Parameter, { name: name.value, typeConstraint }, name, name));
}

// ── precondition { stmt } or precondition stmt ──

/**
 * Parse a precondition block.
 * @param {ParserBase} p
 * @returns {PreconditionNode}
 */
export function parsePrecondition(p) {
  const start = p.advance(); // precondition
  /** @type {import('./types.js').BlockStatementNode | import('./types.js').StatementNode} */
  let body;
  if (p.at(TokenType.LBrace)) {
    body = parseBlockStatement(p);
  } else {
    body = parseStatement(p);
  }
  return /** @type {PreconditionNode} */ (node(NodeType.Precondition, { body }, start, body));
}
