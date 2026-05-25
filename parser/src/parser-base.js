import { TokenType, Token } from './lexer.js';

/** @typedef {import('./types.js').TokenTypeValue} TokenTypeValue */
/** @typedef {import('./types.js').ParseError} ParseError */

/**
 * Shared parser state wrapping a filtered token stream.
 * Used internally by declaration, statement, and expression parsers.
 */
export class ParserBase {
  /**
   * @param {Token[]} tokens - Raw token array (comments will be filtered out)
   */
  constructor(tokens) {
    /** @type {Token[]} */
    this.tokens = tokens.filter(t => t.type !== TokenType.Comment);
    /** @type {number} */
    this.pos = 0;
    /** @type {ParseError[]} */
    this.errors = [];
  }

  /**
   * Look at the current token without consuming it.
   * @returns {Token}
   */
  peek() { return this.tokens[this.pos]; }

  /**
   * Check if the current token matches the given type.
   * @param {TokenTypeValue} type
   * @returns {boolean}
   */
  at(type) { return this.peek().type === type; }

  /**
   * Check if the current token matches any of the given types.
   * @param {...TokenTypeValue} types
   * @returns {boolean}
   */
  atAny(...types) { return types.includes(this.peek().type); }

  /**
   * Consume and return the current token.
   * @returns {Token}
   */
  advance() { const t = this.tokens[this.pos]; this.pos++; return t; }

  /**
   * Consume the current token if it matches, otherwise record an error.
   * @param {TokenTypeValue} type
   * @returns {Token}
   */
  expect(type) {
    if (this.at(type)) return this.advance();
    const t = this.peek();
    this.error(`Expected '${type}' but got '${t.type}'`, t);
    return t;
  }

  /**
   * Consume the current token if it matches, returning true. Otherwise return false.
   * @param {TokenTypeValue} type
   * @returns {boolean}
   */
  match(type) {
    if (this.at(type)) { this.advance(); return true; }
    return false;
  }

  /**
   * Record a parse error at the given token's position.
   * @param {string} msg
   * @param {Token} token
   */
  error(msg, token) {
    this.errors.push({ message: msg, line: token.line, column: token.column, offset: token.offset });
  }

  /**
   * Check if the current token is EOF.
   * @returns {boolean}
   */
  isEOF() { return this.at(TokenType.EOF); }
}
