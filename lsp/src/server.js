import lsp from 'vscode-languageserver/node.js';
const {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
} = lsp;
import { TextDocument } from 'vscode-languageserver-textdocument';
import { validate } from './diagnostics.js';
import { loadConfig } from '../../linter/src/config.js';
import { provideCompletion } from './completions.js';
import { provideHover } from './hover.js';
import { provideDocumentSymbols } from './symbols.js';
import { provideDefinition } from './definition.js';
import { provideSignatureHelp } from './signature.js';
import { provideSemanticTokens } from './semantic-tokens.js';
import { fileURLToPath } from 'url';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

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

  // Resolve file path for .featurescriptrc.json lookup
  let filePath;
  try { filePath = fileURLToPath(doc.uri); } catch { /* untitled docs */ }
  const config = loadConfig(filePath);

  const diagnostics = validate(source, config.rules);
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
