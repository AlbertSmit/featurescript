// Main parser entry point — orchestrates lexer + declaration/statement/expression parsers
import { Lexer } from './lexer.js';
import { ParserBase } from './parser-base.js';
import { node, NodeType } from './ast.js';
import { parseTopLevel } from './declarations.js';

/** @typedef {import('./types.js').ParseResult} ParseResult */

/**
 * Parse a FeatureScript source string into an AST.
 * @param {string} source - FeatureScript source code
 * @returns {ParseResult} The root Program node and any parse/lex errors
 */
export function parse(source) {
  const lexer = new Lexer(source);
  const { tokens, errors: lexErrors } = lexer.tokenize();
  const p = new ParserBase(tokens);

  /** @type {import('./types.js').ASTNode[]} */
  const body = [];
  while (!p.isEOF()) {
    const decl = parseTopLevel(p);
    if (decl) body.push(decl);
    else if (!p.isEOF()) p.advance(); // skip unrecognized token to avoid infinite loop
  }

  const ast = node(NodeType.Program, { body }, tokens[0], tokens[tokens.length - 1]);
  /** @type {import('./types.js').ParseError[]} */
  const errors = [
    ...lexErrors.map(t => ({ message: `Unexpected token: ${t.value}`, line: t.line, column: t.column, offset: t.offset })),
    ...p.errors,
  ];
  return { ast: /** @type {import('./types.js').ProgramNode} */ (ast), errors };
}
