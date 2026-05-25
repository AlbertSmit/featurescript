/** @typedef {import('./types.js').TokenTypeValue} TokenTypeValue */
/** @typedef {import('./types.js').LexResult} LexResult */

// ─── Token Types ──────────────────────────────────────────────
// Every token produced by the lexer carries one of these types.

/** @type {import('./types.js').TokenType} */
export const TokenType = Object.freeze({
  // ── Literals ──
  Number:       'Number',
  String:       'String',
  Identifier:   'Identifier',
  BuiltinId:    'BuiltinId',     // @prefixed identifiers

  // ── Keywords: top-level & functions ──
  Annotation:   'annotation',
  Enum:         'enum',
  Export:       'export',
  Function:     'function',
  Import:       'import',
  Operator:     'operator',
  Precondition: 'precondition',
  Predicate:    'predicate',
  Returns:      'returns',
  Type:         'type',
  Typecheck:    'typecheck',
  Typeconvert:  'typeconvert',

  // ── Keywords: expressions ──
  As:           'as',
  Is:           'is',
  New:          'new',

  // ── Keywords: statements ──
  Break:        'break',
  Const:        'const',
  Continue:     'continue',
  For:          'for',
  In:           'in',
  Return:       'return',
  Var:          'var',
  While:        'while',
  If:           'if',
  Else:         'else',

  // ── Keywords: literals ──
  False:        'false',
  Inf:          'inf',
  True:         'true',
  Undefined:    'undefined',

  // ── Keywords: exceptions ──
  Catch:        'catch',
  Throw:        'throw',
  Try:          'try',

  // ── Reserved (future) ──
  Assert:       'assert',
  Case:         'case',
  Default:      'default',
  Do:           'do',
  Switch:       'switch',

  // ── Operators ──
  Plus:         '+',
  Minus:        '-',
  Star:         '*',
  Slash:        '/',
  Percent:      '%',
  Caret:        '^',
  Tilde:        '~',
  Less:         '<',
  Greater:      '>',
  LessEqual:    '<=',
  GreaterEqual: '>=',
  EqualEqual:   '==',
  BangEqual:    '!=',
  AmpAmp:       '&&',
  PipePipe:     '||',
  QuestionQuestion: '??',
  Bang:         '!',
  Arrow:        '->',
  FatArrow:     '=>',
  Dot:          '.',
  SafeDot:      '?.',
  SafeBracket:  '?[',

  // ── Assignment ──
  Equal:        '=',
  PlusEqual:    '+=',
  MinusEqual:   '-=',
  StarEqual:    '*=',
  SlashEqual:   '/=',
  CaretEqual:   '^=',
  PercentEqual: '%=',
  PipePipeEqual:      '||=',
  AmpAmpEqual:        '&&=',
  QuestionQuestionEqual: '??=',
  TildeEqual:   '~=',

  // ── Punctuation ──
  Comma:        ',',
  Question:     '?',
  Colon:        ':',
  ColonColon:   '::',
  LBrace:       '{',
  RBrace:       '}',
  LParen:       '(',
  RParen:       ')',
  LBracket:     '[',
  RBracket:     ']',
  Semicolon:    ';',

  // ── Special ──
  Comment:      'Comment',
  EOF:          'EOF',
  Error:        'Error',
});

// Keyword lookup table — identifier text → token type
/** @type {Map<string, TokenTypeValue>} */
const KEYWORDS = new Map([
  ['annotation',   TokenType.Annotation],
  ['enum',         TokenType.Enum],
  ['export',       TokenType.Export],
  ['function',     TokenType.Function],
  ['import',       TokenType.Import],
  ['operator',     TokenType.Operator],
  ['precondition', TokenType.Precondition],
  ['predicate',    TokenType.Predicate],
  ['returns',      TokenType.Returns],
  ['type',         TokenType.Type],
  ['typecheck',    TokenType.Typecheck],
  ['typeconvert',  TokenType.Typeconvert],
  ['as',           TokenType.As],
  ['is',           TokenType.Is],
  ['new',          TokenType.New],
  ['break',        TokenType.Break],
  ['const',        TokenType.Const],
  ['continue',     TokenType.Continue],
  ['for',          TokenType.For],
  ['in',           TokenType.In],
  ['return',       TokenType.Return],
  ['var',          TokenType.Var],
  ['while',        TokenType.While],
  ['if',           TokenType.If],
  ['else',         TokenType.Else],
  ['false',        TokenType.False],
  ['inf',          TokenType.Inf],
  ['true',         TokenType.True],
  ['undefined',    TokenType.Undefined],
  ['catch',        TokenType.Catch],
  ['throw',        TokenType.Throw],
  ['try',          TokenType.Try],
  ['assert',       TokenType.Assert],
  ['case',         TokenType.Case],
  ['default',      TokenType.Default],
  ['do',           TokenType.Do],
  ['switch',       TokenType.Switch],
]);

/**
 * Check whether a string is a FeatureScript keyword.
 * @param {string} text
 * @returns {boolean}
 */
export function isKeyword(text) {
  return KEYWORDS.has(text);
}

// ─── Token ────────────────────────────────────────────────────
// Immutable token with position information for error reporting.

export class Token {
  /**
   * @param {TokenTypeValue} type   - One of TokenType values
   * @param {string}         value  - Raw source text of the token
   * @param {number}         line   - 1-based line number
   * @param {number}         column - 0-based column offset
   * @param {number}         offset - 0-based byte offset in source
   */
  constructor(type, value, line, column, offset) {
    /** @type {TokenTypeValue} */
    this.type = type;
    /** @type {string} */
    this.value = value;
    /** @type {number} */
    this.line = line;
    /** @type {number} */
    this.column = column;
    /** @type {number} */
    this.offset = offset;
    /** @type {number} */
    this.length = value.length;
  }

  /** @returns {number} Byte offset of the character after this token. */
  get end() {
    return this.offset + this.length;
  }

  /** @returns {string} */
  toString() {
    return `Token(${this.type}, ${JSON.stringify(this.value)}, ${this.line}:${this.column})`;
  }
}

// ─── Lexer ────────────────────────────────────────────────────
// Converts FeatureScript source text into a stream of Tokens.
// Single-pass, no backtracking, O(n) complexity.

export class Lexer {
  /** @param {string} source */
  constructor(source) {
    /** @type {string} */
    this.source = source;
    /** @type {number} */
    this.pos = 0;
    /** @type {number} */
    this.line = 1;
    /** @type {number} */
    this.column = 0;
    /** @type {Token[]} */
    this.tokens = [];
    /** @type {Token[]} */
    this.errors = [];
  }

  // ── Public API ──

  /**
   * Tokenise the full source, returning tokens and errors.
   * @returns {LexResult}
   */
  tokenize() {
    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const token = this.readToken();
      if (token) {
        if (token.type === TokenType.Error) {
          this.errors.push(token);
        }
        this.tokens.push(token);
      }
    }

    this.tokens.push(new Token(TokenType.EOF, '', this.line, this.column, this.pos));
    return { tokens: this.tokens, errors: this.errors };
  }

  // ── Character helpers ──

  /**
   * @param {number} [offset]
   * @returns {string}
   */
  peek(offset = 0) {
    return this.source[this.pos + offset];
  }

  /** @returns {string} */
  advance() {
    const ch = this.source[this.pos];
    this.pos++;
    if (ch === '\n') {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }
    return ch;
  }

  /**
   * @param {string} expected
   * @returns {boolean}
   */
  match(expected) {
    if (this.pos < this.source.length && this.source[this.pos] === expected) {
      this.advance();
      return true;
    }
    return false;
  }

  /**
   * @param {TokenTypeValue} type
   * @param {number} start
   * @param {number} startLine
   * @param {number} startCol
   * @returns {Token}
   */
  makeToken(type, start, startLine, startCol) {
    const value = this.source.slice(start, this.pos);
    return new Token(type, value, startLine, startCol, start);
  }

  // ── Whitespace ──

  /** @returns {void} */
  skipWhitespace() {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        this.advance();
      } else {
        break;
      }
    }
  }

  // ── Main dispatch ──

  /** @returns {Token | undefined} */
  readToken() {
    const start = this.pos;
    const startLine = this.line;
    const startCol = this.column;
    const ch = this.peek();

    // ── Comments ──
    if (ch === '/') {
      if (this.peek(1) === '/') return this.readLineComment(start, startLine, startCol);
      if (this.peek(1) === '*') return this.readBlockComment(start, startLine, startCol);
    }

    // ── Strings ──
    if (ch === '"' || ch === "'") return this.readString(start, startLine, startCol);

    // ── Numbers ──
    if (isDigit(ch) || (ch === '.' && isDigit(this.peek(1)))) {
      return this.readNumber(start, startLine, startCol);
    }

    // ── Identifiers / keywords ──
    if (isIdentStart(ch)) return this.readIdentifier(start, startLine, startCol);

    // ── Builtin identifiers (@prefixed) ──
    if (ch === '@') {
      this.advance();
      if (this.pos < this.source.length && isIdentStart(this.peek())) {
        return this.readBuiltinId(start, startLine, startCol);
      }
      return new Token(TokenType.Error, '@', startLine, startCol, start);
    }

    // ── Operators and punctuation ──
    return this.readOperatorOrPunctuation(start, startLine, startCol);
  }

  // ── Line comment: // to end of line ──

  /**
   * @param {number} start
   * @param {number} startLine
   * @param {number} startCol
   * @returns {Token}
   */
  readLineComment(start, startLine, startCol) {
    this.advance(); // /
    this.advance(); // /
    while (this.pos < this.source.length && this.peek() !== '\n') {
      this.advance();
    }
    return this.makeToken(TokenType.Comment, start, startLine, startCol);
  }

  // ── Block comment: /* to */ (no nesting) ──

  /**
   * @param {number} start
   * @param {number} startLine
   * @param {number} startCol
   * @returns {Token}
   */
  readBlockComment(start, startLine, startCol) {
    this.advance(); // /
    this.advance(); // *
    while (this.pos < this.source.length) {
      if (this.peek() === '*' && this.peek(1) === '/') {
        this.advance(); // *
        this.advance(); // /
        return this.makeToken(TokenType.Comment, start, startLine, startCol);
      }
      this.advance();
    }
    // Unterminated block comment
    this.errors.push(new Token(TokenType.Error, this.source.slice(start, this.pos), startLine, startCol, start));
    return this.makeToken(TokenType.Comment, start, startLine, startCol);
  }

  // ── String: single or double quoted ──

  /**
   * @param {number} start
   * @param {number} startLine
   * @param {number} startCol
   * @returns {Token}
   */
  readString(start, startLine, startCol) {
    const quote = this.advance();
    while (this.pos < this.source.length) {
      const ch = this.peek();
      if (ch === quote) {
        this.advance();
        return this.makeToken(TokenType.String, start, startLine, startCol);
      }
      if (ch === '\\') {
        this.advance(); // backslash
        if (this.pos < this.source.length) {
          const esc = this.peek();
          if (esc === 'u') {
            // \uXXXX
            this.advance();
            for (let i = 0; i < 4 && this.pos < this.source.length; i++) {
              this.advance();
            }
          } else {
            this.advance();
          }
        }
        continue;
      }
      if (ch === '\n') {
        // Unterminated string at newline
        this.errors.push(new Token(TokenType.Error, this.source.slice(start, this.pos), startLine, startCol, start));
        return this.makeToken(TokenType.String, start, startLine, startCol);
      }
      this.advance();
    }
    // Unterminated string at EOF
    this.errors.push(new Token(TokenType.Error, this.source.slice(start, this.pos), startLine, startCol, start));
    return this.makeToken(TokenType.String, start, startLine, startCol);
  }

  // ── Number: integer, float, scientific notation ──

  /**
   * @param {number} start
   * @param {number} startLine
   * @param {number} startCol
   * @returns {Token}
   */
  readNumber(start, startLine, startCol) {
    // Integer part
    while (this.pos < this.source.length && isDigit(this.peek())) {
      this.advance();
    }
    // Fractional part
    if (this.pos < this.source.length && this.peek() === '.' && isDigit(this.peek(1))) {
      this.advance(); // .
      while (this.pos < this.source.length && isDigit(this.peek())) {
        this.advance();
      }
    }
    // Exponent part
    if (this.pos < this.source.length && (this.peek() === 'e' || this.peek() === 'E')) {
      this.advance(); // e/E
      if (this.pos < this.source.length && (this.peek() === '+' || this.peek() === '-')) {
        this.advance();
      }
      while (this.pos < this.source.length && isDigit(this.peek())) {
        this.advance();
      }
    }
    return this.makeToken(TokenType.Number, start, startLine, startCol);
  }

  // ── Identifier or keyword ──

  /**
   * @param {number} start
   * @param {number} startLine
   * @param {number} startCol
   * @returns {Token}
   */
  readIdentifier(start, startLine, startCol) {
    while (this.pos < this.source.length && isIdentChar(this.peek())) {
      this.advance();
    }
    const text = this.source.slice(start, this.pos);
    const keywordType = KEYWORDS.get(text);
    const type = keywordType ?? TokenType.Identifier;
    return new Token(type, text, startLine, startCol, start);
  }

  // ── @builtin identifier ──

  /**
   * @param {number} start
   * @param {number} startLine
   * @param {number} startCol
   * @returns {Token}
   */
  readBuiltinId(start, startLine, startCol) {
    while (this.pos < this.source.length && isIdentChar(this.peek())) {
      this.advance();
    }
    return this.makeToken(TokenType.BuiltinId, start, startLine, startCol);
  }

  // ── Operators and punctuation ──

  /**
   * @param {number} start
   * @param {number} startLine
   * @param {number} startCol
   * @returns {Token}
   */
  readOperatorOrPunctuation(start, startLine, startCol) {
    const ch = this.advance();

    switch (ch) {
      // Single-char with possible multi-char extensions
      case '+': return this.makeToken(this.match('=') ? TokenType.PlusEqual : TokenType.Plus, start, startLine, startCol);
      case '*': return this.makeToken(this.match('=') ? TokenType.StarEqual : TokenType.Star, start, startLine, startCol);
      case '%': return this.makeToken(this.match('=') ? TokenType.PercentEqual : TokenType.Percent, start, startLine, startCol);
      case '^': return this.makeToken(this.match('=') ? TokenType.CaretEqual : TokenType.Caret, start, startLine, startCol);
      case '~': return this.makeToken(this.match('=') ? TokenType.TildeEqual : TokenType.Tilde, start, startLine, startCol);

      case '-':
        if (this.match('>')) return this.makeToken(TokenType.Arrow, start, startLine, startCol);
        if (this.match('=')) return this.makeToken(TokenType.MinusEqual, start, startLine, startCol);
        return this.makeToken(TokenType.Minus, start, startLine, startCol);

      case '/':
        if (this.match('=')) return this.makeToken(TokenType.SlashEqual, start, startLine, startCol);
        return this.makeToken(TokenType.Slash, start, startLine, startCol);

      case '<':
        if (this.match('=')) return this.makeToken(TokenType.LessEqual, start, startLine, startCol);
        return this.makeToken(TokenType.Less, start, startLine, startCol);

      case '>':
        if (this.match('=')) return this.makeToken(TokenType.GreaterEqual, start, startLine, startCol);
        return this.makeToken(TokenType.Greater, start, startLine, startCol);

      case '=':
        if (this.match('=')) return this.makeToken(TokenType.EqualEqual, start, startLine, startCol);
        if (this.match('>')) return this.makeToken(TokenType.FatArrow, start, startLine, startCol);
        return this.makeToken(TokenType.Equal, start, startLine, startCol);

      case '!':
        if (this.match('=')) return this.makeToken(TokenType.BangEqual, start, startLine, startCol);
        return this.makeToken(TokenType.Bang, start, startLine, startCol);

      case '&':
        if (this.match('&')) {
          if (this.match('=')) return this.makeToken(TokenType.AmpAmpEqual, start, startLine, startCol);
          return this.makeToken(TokenType.AmpAmp, start, startLine, startCol);
        }
        return new Token(TokenType.Error, ch, startLine, startCol, start);

      case '|':
        if (this.match('|')) {
          if (this.match('=')) return this.makeToken(TokenType.PipePipeEqual, start, startLine, startCol);
          return this.makeToken(TokenType.PipePipe, start, startLine, startCol);
        }
        return new Token(TokenType.Error, ch, startLine, startCol, start);

      case '?':
        if (this.match('?')) {
          if (this.match('=')) return this.makeToken(TokenType.QuestionQuestionEqual, start, startLine, startCol);
          return this.makeToken(TokenType.QuestionQuestion, start, startLine, startCol);
        }
        if (this.match('.')) return this.makeToken(TokenType.SafeDot, start, startLine, startCol);
        if (this.match('[')) return this.makeToken(TokenType.SafeBracket, start, startLine, startCol);
        return this.makeToken(TokenType.Question, start, startLine, startCol);

      case ':':
        if (this.match(':')) return this.makeToken(TokenType.ColonColon, start, startLine, startCol);
        return this.makeToken(TokenType.Colon, start, startLine, startCol);

      case '.': return this.makeToken(TokenType.Dot, start, startLine, startCol);

      // Simple single-char punctuation
      case ',': return this.makeToken(TokenType.Comma, start, startLine, startCol);
      case '{': return this.makeToken(TokenType.LBrace, start, startLine, startCol);
      case '}': return this.makeToken(TokenType.RBrace, start, startLine, startCol);
      case '(': return this.makeToken(TokenType.LParen, start, startLine, startCol);
      case ')': return this.makeToken(TokenType.RParen, start, startLine, startCol);
      case '[': return this.makeToken(TokenType.LBracket, start, startLine, startCol);
      case ']': return this.makeToken(TokenType.RBracket, start, startLine, startCol);
      case ';': return this.makeToken(TokenType.Semicolon, start, startLine, startCol);

      default:
        return new Token(TokenType.Error, ch, startLine, startCol, start);
    }
  }
}

// ── Character classification ──

/**
 * @param {string} ch
 * @returns {boolean}
 */
function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}

/**
 * @param {string} ch
 * @returns {boolean}
 */
function isIdentStart(ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

/**
 * @param {string} ch
 * @returns {boolean}
 */
function isIdentChar(ch) {
  return isIdentStart(ch) || isDigit(ch);
}
