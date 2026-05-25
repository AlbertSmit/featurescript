import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  DiagnosticSeverity,
  CompletionItemKind,
  SymbolKind,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { validate } from './diagnostics.js';
import { provideCompletion } from './completions.js';
import { provideHover } from './hover.js';
import { provideDocumentSymbols } from './symbols.js';
import { provideDefinition } from './definition.js';
import { provideSignatureHelp } from './signature.js';
import { provideSemanticTokens } from './semantic-tokens.js';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// ── Cache: source → parsed result ──
const parseCache = new Map();

function getParsed(uri, source) {
  const cached = parseCache.get(uri);
  if (cached && cached.version === source) return cached.result;
  // Lazy import to avoid top-level await
  const { parse } = require('../../parser/src/index.js');
  const result = parse(source);
  parseCache.set(uri, { version: source, result });
  return result;
}

// ── Initialization ──

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Full,
    completionProvider: { triggerCharacters: ['.', ':', '>', '(', '"'] },
    hoverProvider: true,
    documentSymbolProvider: true,
    definitionProvider: true,
    signatureHelpProvider: { triggerCharacters: ['(', ','] },
    // semanticTokensProvider will be added in Phase 2b
  },
}));

// ── Diagnostics: on every document change ──

documents.onDidChangeContent((change) => {
  const doc = change.document;
  const source = doc.getText();
  const diagnostics = validate(source);
  connection.sendDiagnostics({ uri: doc.uri, diagnostics });
});

// ── Completion ──

connection.onCompletion((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  return provideCompletion(doc.getText(), params.position);
});

// ── Hover ──

connection.onHover((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  return provideHover(doc.getText(), params.position);
});

// ── Document Symbols ──

connection.onDocumentSymbol((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  return provideDocumentSymbols(doc.getText());
});

// ── Go to Definition ──

connection.onDefinition((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  return provideDefinition(doc.getText(), params.position, params.textDocument.uri);
});

// ── Signature Help ──

connection.onSignatureHelp((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  return provideSignatureHelp(doc.getText(), params.position);
});

// ── Start ──

documents.listen(connection);
connection.listen();
