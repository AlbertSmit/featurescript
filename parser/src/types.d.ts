// ─── Position & Location ──────────────────────────────────────

/** 0-based column, 1-based line, 0-based byte offset. */
export interface Position {
  line: number;
  column: number;
  offset: number;
}

/** Source span attached to every AST node. */
export interface SourceLocation {
  start: Position;
  end: Position;
}

// ─── Token Types ──────────────────────────────────────────────

/** String literal union of every token type the lexer can produce. */
export type TokenTypeValue = typeof TokenType[keyof typeof TokenType];

/** Frozen lookup object mapping semantic names to token type strings. */
export declare const TokenType: {
  // Literals
  readonly Number:       'Number';
  readonly String:       'String';
  readonly Identifier:   'Identifier';
  readonly BuiltinId:    'BuiltinId';

  // Keywords: top-level & functions
  readonly Annotation:   'annotation';
  readonly Enum:         'enum';
  readonly Export:       'export';
  readonly Function:     'function';
  readonly Import:       'import';
  readonly Operator:     'operator';
  readonly Precondition: 'precondition';
  readonly Predicate:    'predicate';
  readonly Returns:      'returns';
  readonly Type:         'type';
  readonly Typecheck:    'typecheck';
  readonly Typeconvert:  'typeconvert';

  // Keywords: expressions
  readonly As:           'as';
  readonly Is:           'is';
  readonly New:          'new';

  // Keywords: statements
  readonly Break:        'break';
  readonly Const:        'const';
  readonly Continue:     'continue';
  readonly For:          'for';
  readonly In:           'in';
  readonly Return:       'return';
  readonly Var:          'var';
  readonly While:        'while';
  readonly If:           'if';
  readonly Else:         'else';

  // Keywords: literals
  readonly False:        'false';
  readonly Inf:          'inf';
  readonly True:         'true';
  readonly Undefined:    'undefined';

  // Keywords: exceptions
  readonly Catch:        'catch';
  readonly Throw:        'throw';
  readonly Try:          'try';

  // Reserved (future)
  readonly Assert:       'assert';
  readonly Case:         'case';
  readonly Default:      'default';
  readonly Do:           'do';
  readonly Switch:       'switch';

  // Operators
  readonly Plus:         '+';
  readonly Minus:        '-';
  readonly Star:         '*';
  readonly Slash:        '/';
  readonly Percent:      '%';
  readonly Caret:        '^';
  readonly Tilde:        '~';
  readonly Less:         '<';
  readonly Greater:      '>';
  readonly LessEqual:    '<=';
  readonly GreaterEqual: '>=';
  readonly EqualEqual:   '==';
  readonly BangEqual:    '!=';
  readonly AmpAmp:       '&&';
  readonly PipePipe:     '||';
  readonly QuestionQuestion: '??';
  readonly Bang:         '!';
  readonly Arrow:        '->';
  readonly FatArrow:     '=>';
  readonly Dot:          '.';
  readonly SafeDot:      '?.';
  readonly SafeBracket:  '?[';

  // Assignment
  readonly Equal:        '=';
  readonly PlusEqual:    '+=';
  readonly MinusEqual:   '-=';
  readonly StarEqual:    '*=';
  readonly SlashEqual:   '/=';
  readonly CaretEqual:   '^=';
  readonly PercentEqual: '%=';
  readonly PipePipeEqual:      '||=';
  readonly AmpAmpEqual:        '&&=';
  readonly QuestionQuestionEqual: '??=';
  readonly TildeEqual:   '~=';

  // Punctuation
  readonly Comma:        ',';
  readonly Question:     '?';
  readonly Colon:        ':';
  readonly ColonColon:   '::';
  readonly LBrace:       '{';
  readonly RBrace:       '}';
  readonly LParen:       '(';
  readonly RParen:       ')';
  readonly LBracket:     '[';
  readonly RBracket:     ']';
  readonly Semicolon:    ';';

  // Special
  readonly Comment:      'Comment';
  readonly EOF:          'EOF';
  readonly Error:        'Error';
};

/** Check whether a string is a FeatureScript keyword. */
export declare function isKeyword(text: string): boolean;

// ─── Token ────────────────────────────────────────────────────

/** Immutable token with position information for error reporting. */
export declare class Token {
  readonly type: TokenTypeValue;
  readonly value: string;
  readonly line: number;
  readonly column: number;
  readonly offset: number;
  readonly length: number;

  constructor(
    type: TokenTypeValue,
    value: string,
    line: number,
    column: number,
    offset: number,
  );

  /** Byte offset of the character after this token. */
  get end(): number;

  toString(): string;
}

// ─── Lexer ────────────────────────────────────────────────────

/** Result of tokenising a FeatureScript source string. */
export interface LexResult {
  tokens: Token[];
  errors: Token[];
}

/**
 * Converts FeatureScript source text into a stream of Tokens.
 * Single-pass, no backtracking, O(n) complexity.
 */
export declare class Lexer {
  source: string;
  pos: number;
  line: number;
  column: number;
  tokens: Token[];
  errors: Token[];

  constructor(source: string);

  /** Tokenise the full source, returning tokens and errors. */
  tokenize(): LexResult;
}

// ─── AST Node Types ───────────────────────────────────────────

/** String literal union of every AST node type. */
export type NodeTypeValue = typeof NodeType[keyof typeof NodeType];

/** Frozen lookup object mapping semantic names to node type strings. */
export declare const NodeType: {
  // Program
  readonly Program:              'Program';

  // Top-level
  readonly ImportStatement:      'ImportStatement';
  readonly NamespacedImport:     'NamespacedImport';
  readonly FunctionDeclaration:  'FunctionDeclaration';
  readonly PredicateDeclaration: 'PredicateDeclaration';
  readonly OperatorOverload:     'OperatorOverload';
  readonly EnumDeclaration:      'EnumDeclaration';
  readonly EnumValue:            'EnumValue';
  readonly TypeDeclaration:      'TypeDeclaration';
  readonly ConstantDeclaration:  'ConstantDeclaration';
  readonly Annotation:           'Annotation';

  // Statements
  readonly VariableDeclaration:  'VariableDeclaration';
  readonly ExpressionStatement:  'ExpressionStatement';
  readonly BlockStatement:       'BlockStatement';
  readonly IfStatement:          'IfStatement';
  readonly WhileStatement:       'WhileStatement';
  readonly ForStatement:         'ForStatement';
  readonly ForInStatement:       'ForInStatement';
  readonly ReturnStatement:      'ReturnStatement';
  readonly BreakStatement:       'BreakStatement';
  readonly ContinueStatement:    'ContinueStatement';
  readonly ThrowStatement:       'ThrowStatement';
  readonly TryCatchStatement:    'TryCatchStatement';
  readonly AssignmentStatement:  'AssignmentStatement';
  readonly Precondition:         'Precondition';

  // Expressions
  readonly Identifier:           'Identifier';
  readonly BuiltinIdentifier:    'BuiltinIdentifier';
  readonly NumberLiteral:        'NumberLiteral';
  readonly StringLiteral:        'StringLiteral';
  readonly BooleanLiteral:       'BooleanLiteral';
  readonly UndefinedLiteral:     'UndefinedLiteral';
  readonly InfLiteral:           'InfLiteral';
  readonly ArrayLiteral:         'ArrayLiteral';
  readonly MapLiteral:           'MapLiteral';
  readonly MapEntry:             'MapEntry';
  readonly BinaryExpression:     'BinaryExpression';
  readonly UnaryExpression:      'UnaryExpression';
  readonly TernaryExpression:    'TernaryExpression';
  readonly CallExpression:       'CallExpression';
  readonly ArrowCallExpression:  'ArrowCallExpression';
  readonly MemberExpression:     'MemberExpression';
  readonly SafeMemberExpression: 'SafeMemberExpression';
  readonly SubscriptExpression:  'SubscriptExpression';
  readonly SafeSubscriptExpression: 'SafeSubscriptExpression';
  readonly BoxAccessExpression:  'BoxAccessExpression';
  readonly SafeBoxAccessExpression: 'SafeBoxAccessExpression';
  readonly TypeExpression:       'TypeExpression';
  readonly CastExpression:       'CastExpression';
  readonly NewBoxExpression:     'NewBoxExpression';
  readonly TryExpression:        'TryExpression';
  readonly LambdaExpression:     'LambdaExpression';
  readonly NamespaceAccess:      'NamespaceAccess';
  readonly GroupExpression:      'GroupExpression';

  // Parameters
  readonly Parameter:            'Parameter';
};

// ─── AST Node Interfaces ──────────────────────────────────────
// Discriminated union: switch on `node.type` to narrow.

/** Base shape shared by all AST nodes. */
interface BaseNode {
  loc: SourceLocation;
}

// ── Program ──

export interface ProgramNode extends BaseNode {
  type: 'Program';
  body: ASTNode[];
  /** Present on FeatureScript version header pseudo-nodes. */
  version?: string;
}

// ── Top-level declarations ──

export interface ImportStatementNode extends BaseNode {
  type: 'ImportStatement';
  namespace: string | null;
  path: string | null;
  version: string | null;
}

export interface NamespacedImportNode extends BaseNode {
  type: 'NamespacedImport';
  namespace: string;
  path: string | null;
  version: string | null;
}

export interface FunctionDeclarationNode extends BaseNode {
  type: 'FunctionDeclaration';
  name: string;
  params: ParameterNode[];
  returnType: string | null;
  precondition: PreconditionNode | null;
  body: BlockStatementNode;
  exported: boolean;
  annotations: AnnotationNode[];
}

export interface PredicateDeclarationNode extends BaseNode {
  type: 'PredicateDeclaration';
  name: string;
  params: ParameterNode[];
  body: BlockStatementNode;
  exported: boolean;
  annotations: AnnotationNode[];
}

export interface OperatorOverloadNode extends BaseNode {
  type: 'OperatorOverload';
  operator: string;
  params: ParameterNode[];
  returnType: string | null;
  precondition: PreconditionNode | null;
  body: BlockStatementNode;
  exported: boolean;
  annotations: AnnotationNode[];
}

export interface EnumDeclarationNode extends BaseNode {
  type: 'EnumDeclaration';
  name: string;
  values: EnumValueNode[];
  exported: boolean;
  annotations: AnnotationNode[];
}

export interface EnumValueNode extends BaseNode {
  type: 'EnumValue';
  name: string;
  annotations: AnnotationNode[];
}

export interface TypeDeclarationNode extends BaseNode {
  type: 'TypeDeclaration';
  name: string;
  typecheck: string;
  exported: boolean;
  annotations: AnnotationNode[];
}

export interface ConstantDeclarationNode extends BaseNode {
  type: 'ConstantDeclaration';
  name: string;
  typeConstraint: string | null;
  init: ExpressionNode;
  exported: boolean;
  annotations: AnnotationNode[];
}

export interface AnnotationNode extends BaseNode {
  type: 'Annotation';
  entries: MapEntryNode[];
}

// ── Statements ──

export interface VariableDeclarationNode extends BaseNode {
  type: 'VariableDeclaration';
  name: string;
  typeConstraint: string | null;
  init: ExpressionNode | null;
  annotations?: AnnotationNode[];
}

export interface ExpressionStatementNode extends BaseNode {
  type: 'ExpressionStatement';
  expression: ExpressionNode;
  annotations?: AnnotationNode[];
}

export interface BlockStatementNode extends BaseNode {
  type: 'BlockStatement';
  body: StatementNode[];
  annotations?: AnnotationNode[];
}

export interface IfStatementNode extends BaseNode {
  type: 'IfStatement';
  test: ExpressionNode;
  consequent: StatementNode;
  alternate: StatementNode | null;
  annotations?: AnnotationNode[];
}

export interface WhileStatementNode extends BaseNode {
  type: 'WhileStatement';
  test: ExpressionNode;
  body: StatementNode;
  annotations?: AnnotationNode[];
}

export interface ForStatementNode extends BaseNode {
  type: 'ForStatement';
  init: VariableDeclarationNode | ExpressionNode | null;
  test: ExpressionNode | null;
  update: ExpressionNode | AssignmentStatementNode | null;
  body: StatementNode;
  annotations?: AnnotationNode[];
}

export interface ForInStatementNode extends BaseNode {
  type: 'ForInStatement';
  variable: string;
  index: string | null;
  iterable: ExpressionNode;
  body: StatementNode;
  hasVar: boolean;
  annotations?: AnnotationNode[];
}

export interface ReturnStatementNode extends BaseNode {
  type: 'ReturnStatement';
  value: ExpressionNode | null;
  annotations?: AnnotationNode[];
}

export interface BreakStatementNode extends BaseNode {
  type: 'BreakStatement';
  annotations?: AnnotationNode[];
}

export interface ContinueStatementNode extends BaseNode {
  type: 'ContinueStatement';
  annotations?: AnnotationNode[];
}

export interface ThrowStatementNode extends BaseNode {
  type: 'ThrowStatement';
  value: ExpressionNode;
  annotations?: AnnotationNode[];
}

export interface TryCatchStatementNode extends BaseNode {
  type: 'TryCatchStatement';
  body: StatementNode;
  param: string;
  handler: StatementNode;
  annotations?: AnnotationNode[];
}

export interface AssignmentStatementNode extends BaseNode {
  type: 'AssignmentStatement';
  target: ExpressionNode;
  operator: string;
  value: ExpressionNode;
  annotations?: AnnotationNode[];
}

export interface PreconditionNode extends BaseNode {
  type: 'Precondition';
  body: BlockStatementNode | StatementNode;
}

// ── Expressions ──

export interface IdentifierNode extends BaseNode {
  type: 'Identifier';
  name: string;
}

export interface BuiltinIdentifierNode extends BaseNode {
  type: 'BuiltinIdentifier';
  name: string;
}

export interface NumberLiteralNode extends BaseNode {
  type: 'NumberLiteral';
  value: number;
}

export interface StringLiteralNode extends BaseNode {
  type: 'StringLiteral';
  value: string;
}

export interface BooleanLiteralNode extends BaseNode {
  type: 'BooleanLiteral';
  value: boolean;
}

export interface UndefinedLiteralNode extends BaseNode {
  type: 'UndefinedLiteral';
}

export interface InfLiteralNode extends BaseNode {
  type: 'InfLiteral';
}

export interface ArrayLiteralNode extends BaseNode {
  type: 'ArrayLiteral';
  elements: ExpressionNode[];
}

export interface MapLiteralNode extends BaseNode {
  type: 'MapLiteral';
  entries: MapEntryNode[];
}

export interface MapEntryNode extends BaseNode {
  type: 'MapEntry';
  key: ExpressionNode;
  value: ExpressionNode;
}

export interface BinaryExpressionNode extends BaseNode {
  type: 'BinaryExpression';
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface UnaryExpressionNode extends BaseNode {
  type: 'UnaryExpression';
  operator: string;
  operand: ExpressionNode;
}

export interface TernaryExpressionNode extends BaseNode {
  type: 'TernaryExpression';
  test: ExpressionNode;
  consequent: ExpressionNode;
  alternate: ExpressionNode;
}

export interface CallExpressionNode extends BaseNode {
  type: 'CallExpression';
  callee: ExpressionNode;
  arguments: ExpressionNode[];
}

export interface ArrowCallExpressionNode extends BaseNode {
  type: 'ArrowCallExpression';
  object: ExpressionNode;
  method: string;
  arguments: ExpressionNode[];
}

export interface MemberExpressionNode extends BaseNode {
  type: 'MemberExpression';
  object: ExpressionNode;
  property: string;
}

export interface SafeMemberExpressionNode extends BaseNode {
  type: 'SafeMemberExpression';
  object: ExpressionNode;
  property: string;
}

export interface SubscriptExpressionNode extends BaseNode {
  type: 'SubscriptExpression';
  object: ExpressionNode;
  index: ExpressionNode;
}

export interface SafeSubscriptExpressionNode extends BaseNode {
  type: 'SafeSubscriptExpression';
  object: ExpressionNode;
  index: ExpressionNode;
}

export interface BoxAccessExpressionNode extends BaseNode {
  type: 'BoxAccessExpression';
  object: ExpressionNode;
}

export interface SafeBoxAccessExpressionNode extends BaseNode {
  type: 'SafeBoxAccessExpression';
  object: ExpressionNode;
}

export interface TypeExpressionNode extends BaseNode {
  type: 'TypeExpression';
  expression: ExpressionNode;
  typeName: string;
}

export interface CastExpressionNode extends BaseNode {
  type: 'CastExpression';
  expression: ExpressionNode;
  typeName: string;
}

export interface NewBoxExpressionNode extends BaseNode {
  type: 'NewBoxExpression';
  value: ExpressionNode;
}

export interface TryExpressionNode extends BaseNode {
  type: 'TryExpression';
  expression: ExpressionNode;
}

export interface LambdaExpressionNode extends BaseNode {
  type: 'LambdaExpression';
  params: ParameterNode[];
  returnType: string | null;
  precondition: PreconditionNode | null;
  body: BlockStatementNode | ExpressionNode;
}

export interface NamespaceAccessNode extends BaseNode {
  type: 'NamespaceAccess';
  namespace: string;
  name: string;
}

export interface GroupExpressionNode extends BaseNode {
  type: 'GroupExpression';
  expression: ExpressionNode;
}

// ── Parameters ──

export interface ParameterNode extends BaseNode {
  type: 'Parameter';
  name: string;
  typeConstraint: string | null;
}

// ─── Union Types ──────────────────────────────────────────────

/** All expression node types. */
export type ExpressionNode =
  | IdentifierNode
  | BuiltinIdentifierNode
  | NumberLiteralNode
  | StringLiteralNode
  | BooleanLiteralNode
  | UndefinedLiteralNode
  | InfLiteralNode
  | ArrayLiteralNode
  | MapLiteralNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | TernaryExpressionNode
  | CallExpressionNode
  | ArrowCallExpressionNode
  | MemberExpressionNode
  | SafeMemberExpressionNode
  | SubscriptExpressionNode
  | SafeSubscriptExpressionNode
  | BoxAccessExpressionNode
  | SafeBoxAccessExpressionNode
  | TypeExpressionNode
  | CastExpressionNode
  | NewBoxExpressionNode
  | TryExpressionNode
  | LambdaExpressionNode
  | NamespaceAccessNode
  | GroupExpressionNode;

/** All statement node types. */
export type StatementNode =
  | VariableDeclarationNode
  | ConstantDeclarationNode
  | ExpressionStatementNode
  | BlockStatementNode
  | IfStatementNode
  | WhileStatementNode
  | ForStatementNode
  | ForInStatementNode
  | ReturnStatementNode
  | BreakStatementNode
  | ContinueStatementNode
  | ThrowStatementNode
  | TryCatchStatementNode
  | AssignmentStatementNode;

/** All declaration (top-level) node types. */
export type DeclarationNode =
  | ImportStatementNode
  | FunctionDeclarationNode
  | PredicateDeclarationNode
  | OperatorOverloadNode
  | EnumDeclarationNode
  | TypeDeclarationNode
  | ConstantDeclarationNode;

/** Discriminated union of every AST node type. */
export type ASTNode =
  | ProgramNode
  | DeclarationNode
  | NamespacedImportNode
  | StatementNode
  | ExpressionNode
  | AnnotationNode
  | EnumValueNode
  | MapEntryNode
  | ParameterNode
  | PreconditionNode;

// ─── AST Helpers ──────────────────────────────────────────────

/** Position-like object used for building source locations. */
type PositionSource = Token | ASTNode | { line: number; column: number; offset: number; end?: number };

/** Build a SourceLocation from start/end position sources. */
export declare function loc(startToken: PositionSource, endToken: PositionSource): SourceLocation;

/**
 * Create an AST node. All AST nodes are plain objects with a `type` field.
 * Keeps the AST serializable and easy to traverse.
 */
export declare function node(
  type: NodeTypeValue,
  fields: Record<string, unknown>,
  startToken: Token | ASTNode,
  endToken?: Token | ASTNode,
): ASTNode;

// ─── Parser ───────────────────────────────────────────────────

/** Parse error with position information. */
export interface ParseError {
  message: string;
  line: number;
  column: number;
  offset: number;
}

/** Result of parsing a FeatureScript source string. */
export interface ParseResult {
  ast: ProgramNode;
  errors: ParseError[];
}

/**
 * Parse a FeatureScript source string into an AST.
 * Returns the root Program node and any parse/lex errors.
 */
export declare function parse(source: string): ParseResult;

// ─── Parser Base ──────────────────────────────────────────────

/**
 * Shared parser state wrapping a filtered token stream.
 * Used internally by declaration, statement, and expression parsers.
 */
export declare class ParserBase {
  tokens: Token[];
  pos: number;
  errors: ParseError[];

  constructor(tokens: Token[]);

  /** Look at the current token without consuming it. */
  peek(): Token;

  /** Check if the current token matches the given type. */
  at(type: TokenTypeValue): boolean;

  /** Check if the current token matches any of the given types. */
  atAny(...types: TokenTypeValue[]): boolean;

  /** Consume and return the current token. */
  advance(): Token;

  /** Consume the current token if it matches, otherwise record an error. */
  expect(type: TokenTypeValue): Token;

  /** Consume the current token if it matches, returning true. Otherwise return false. */
  match(type: TokenTypeValue): boolean;

  /** Record a parse error at the given token's position. */
  error(msg: string, token: Token): void;

  /** Check if the current token is EOF. */
  isEOF(): boolean;
}

// ─── Visitor ──────────────────────────────────────────────────

/**
 * Typed visitor callback map. Each key is a NodeType string, and
 * the callback receives the correctly narrowed node type.
 *
 * Uses Extract to infer the precise node interface for each callback:
 * ```
 * visit(ast, {
 *   FunctionDeclaration(node) {
 *     // node is FunctionDeclarationNode — .name, .params, .returnType typed
 *   },
 * });
 * ```
 */
export type VisitorMap = {
  [K in NodeTypeValue]?: (
    node: Extract<ASTNode, { type: K }>,
    parent: ASTNode | null,
  ) => void;
};

/**
 * Walk an AST, calling visitor callbacks for each node type.
 * Traverses depth-first, visiting parents before children.
 */
export declare function visit(ast: ASTNode, visitors: VisitorMap): void;

// ─── Declaration Parsers (internal) ───────────────────────────

export declare function parseTopLevel(p: ParserBase): ASTNode | null;
export declare function parseAnnotation(p: ParserBase): AnnotationNode;
export declare function parseImportStatement(p: ParserBase): ImportStatementNode;
export declare function parseFunctionDeclaration(p: ParserBase, exported: boolean, annotations: AnnotationNode[]): FunctionDeclarationNode;
export declare function parsePredicateDeclaration(p: ParserBase, exported: boolean, annotations: AnnotationNode[]): PredicateDeclarationNode;
export declare function parseOperatorOverload(p: ParserBase, exported: boolean, annotations: AnnotationNode[]): OperatorOverloadNode;
export declare function parseEnumDeclaration(p: ParserBase, exported: boolean, annotations: AnnotationNode[]): EnumDeclarationNode;
export declare function parseTypeDeclaration(p: ParserBase, exported: boolean, annotations: AnnotationNode[]): TypeDeclarationNode;
export declare function parseTopLevelConst(p: ParserBase, exported: boolean, annotations: AnnotationNode[]): ConstantDeclarationNode;
export declare function parseParameterList(p: ParserBase): ParameterNode[];
export declare function parsePrecondition(p: ParserBase): PreconditionNode;

// ─── Statement Parsers (internal) ────────────────────────────

export declare function parseStatement(p: ParserBase): StatementNode;
export declare function parseBlockStatement(p: ParserBase): BlockStatementNode;
export declare function parseVarDeclaration(p: ParserBase): VariableDeclarationNode;
export declare function parseConstDeclaration(p: ParserBase): ConstantDeclarationNode;
export declare function parseIfStatement(p: ParserBase): IfStatementNode;
export declare function parseWhileStatement(p: ParserBase): WhileStatementNode;
export declare function parseForStatement(p: ParserBase): ForStatementNode | ForInStatementNode;
export declare function parseReturnStatement(p: ParserBase): ReturnStatementNode;
export declare function parseBreakStatement(p: ParserBase): BreakStatementNode;
export declare function parseContinueStatement(p: ParserBase): ContinueStatementNode;
export declare function parseThrowStatement(p: ParserBase): ThrowStatementNode;
export declare function parseTryCatchStatement(p: ParserBase): TryCatchStatementNode | ExpressionStatementNode;
export declare function parseAssignmentOrExprStatement(p: ParserBase): AssignmentStatementNode | ExpressionStatementNode;

// ─── Expression Parsers (internal) ───────────────────────────

export declare function parseExpression(p: ParserBase): ExpressionNode;
export declare function parseTernaryExpr(p: ParserBase): ExpressionNode;
export declare function parseBinaryExpr(p: ParserBase, minPrec: number): ExpressionNode;
export declare function parseUnaryExpr(p: ParserBase): ExpressionNode;
export declare function parseCallExpr(p: ParserBase, callee: ExpressionNode): CallExpressionNode;
export declare function parseArrowCall(p: ParserBase, left: ExpressionNode): ArrowCallExpressionNode;
export declare function parsePrimaryExpr(p: ParserBase): ExpressionNode;
export declare function parseLambdaExpr(p: ParserBase): LambdaExpressionNode;
export declare function parseNewBoxExpr(p: ParserBase): NewBoxExpressionNode;
export declare function parseTryExpr(p: ParserBase, tryToken: Token): TryExpressionNode;
export declare function parseArrayLiteral(p: ParserBase): ArrayLiteralNode;
export declare function parseMapLiteral(p: ParserBase): MapLiteralNode;
