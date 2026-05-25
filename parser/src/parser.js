// Main parser entry point — orchestrates lexer + declaration/statement/expression parsers
import { Lexer } from './lexer.js';
import { ParserBase } from './parser-base.js';
import { node, NodeType } from './ast.js';
import { parseTopLevel } from './declarations.js';

/**
 * Parse a FeatureScript source string into an AST.
 * @param {string} source
 * @returns {{ ast: object, errors: Array }}
 */
export function parse(source) {
  const lexer = new Lexer(source);
  const { tokens, errors: lexErrors } = lexer.tokenize();
  const p = new ParserBase(tokens);

  const body = [];
  while (!p.isEOF()) {
    const decl = parseTopLevel(p);
    if (decl) body.push(decl);
    else if (!p.isEOF()) p.advance(); // skip unrecognized token to avoid infinite loop
  }

  const ast = node(NodeType.Program, { body }, tokens[0], tokens[tokens.length - 1]);
  return { ast, errors: [...lexErrors, ...p.errors] };
}
