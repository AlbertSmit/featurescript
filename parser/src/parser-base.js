import { TokenType, Token } from './lexer.js';

export class ParserBase {
  constructor(tokens) {
    this.tokens = tokens.filter(t => t.type !== TokenType.Comment);
    this.pos = 0;
    this.errors = [];
  }

  peek() { return this.tokens[this.pos]; }
  
  at(type) { return this.peek().type === type; }

  atAny(...types) { return types.includes(this.peek().type); }

  advance() { const t = this.tokens[this.pos]; this.pos++; return t; }

  expect(type) {
    if (this.at(type)) return this.advance();
    const t = this.peek();
    this.error(`Expected '${type}' but got '${t.type}'`, t);
    return t;
  }

  match(type) {
    if (this.at(type)) { this.advance(); return true; }
    return false;
  }

  error(msg, token) {
    this.errors.push({ message: msg, line: token.line, column: token.column, offset: token.offset });
  }

  isEOF() { return this.at(TokenType.EOF); }
}
