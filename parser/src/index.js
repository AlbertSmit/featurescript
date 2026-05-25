// Public API — re-exports everything consumers need
export { Lexer, Token, TokenType } from './lexer.js';
export { parse } from './parser.js';
export { NodeType, node, loc } from './ast.js';
export { visit } from './visitor.js';

// ── Type re-exports for JSDoc consumers ──
/** @typedef {import('./types.js').ASTNode} ASTNode */
/** @typedef {import('./types.js').ExpressionNode} ExpressionNode */
/** @typedef {import('./types.js').StatementNode} StatementNode */
/** @typedef {import('./types.js').DeclarationNode} DeclarationNode */
/** @typedef {import('./types.js').ProgramNode} ProgramNode */
/** @typedef {import('./types.js').ImportStatementNode} ImportStatementNode */
/** @typedef {import('./types.js').FunctionDeclarationNode} FunctionDeclarationNode */
/** @typedef {import('./types.js').PredicateDeclarationNode} PredicateDeclarationNode */
/** @typedef {import('./types.js').OperatorOverloadNode} OperatorOverloadNode */
/** @typedef {import('./types.js').EnumDeclarationNode} EnumDeclarationNode */
/** @typedef {import('./types.js').EnumValueNode} EnumValueNode */
/** @typedef {import('./types.js').TypeDeclarationNode} TypeDeclarationNode */
/** @typedef {import('./types.js').ConstantDeclarationNode} ConstantDeclarationNode */
/** @typedef {import('./types.js').AnnotationNode} AnnotationNode */
/** @typedef {import('./types.js').VariableDeclarationNode} VariableDeclarationNode */
/** @typedef {import('./types.js').BlockStatementNode} BlockStatementNode */
/** @typedef {import('./types.js').IfStatementNode} IfStatementNode */
/** @typedef {import('./types.js').ForStatementNode} ForStatementNode */
/** @typedef {import('./types.js').ForInStatementNode} ForInStatementNode */
/** @typedef {import('./types.js').ReturnStatementNode} ReturnStatementNode */
/** @typedef {import('./types.js').AssignmentStatementNode} AssignmentStatementNode */
/** @typedef {import('./types.js').ExpressionStatementNode} ExpressionStatementNode */
/** @typedef {import('./types.js').ParameterNode} ParameterNode */
/** @typedef {import('./types.js').IdentifierNode} IdentifierNode */
/** @typedef {import('./types.js').CallExpressionNode} CallExpressionNode */
/** @typedef {import('./types.js').MemberExpressionNode} MemberExpressionNode */
/** @typedef {import('./types.js').LambdaExpressionNode} LambdaExpressionNode */
/** @typedef {import('./types.js').MapLiteralNode} MapLiteralNode */
/** @typedef {import('./types.js').MapEntryNode} MapEntryNode */
/** @typedef {import('./types.js').SourceLocation} SourceLocation */
/** @typedef {import('./types.js').Position} Position */
/** @typedef {import('./types.js').ParseResult} ParseResult */
/** @typedef {import('./types.js').ParseError} ParseError */
/** @typedef {import('./types.js').LexResult} LexResult */
/** @typedef {import('./types.js').VisitorMap} VisitorMap */
/** @typedef {import('./types.js').TokenTypeValue} TokenTypeValue */
/** @typedef {import('./types.js').NodeTypeValue} NodeTypeValue */
