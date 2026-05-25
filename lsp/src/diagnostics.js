import { DiagnosticSeverity } from 'vscode-languageserver/node.js';
import { parse } from '../../parser/src/index.js';

/**
 * Parse source and return LSP Diagnostic[] from parse errors.
 * @param {string} source
 * @returns {import('vscode-languageserver').Diagnostic[]}
 */
export function validate(source) {
  const { errors } = parse(source);

  return errors.map((err) => ({
    severity: DiagnosticSeverity.Error,
    range: {
      start: { line: (err.line ?? 1) - 1, character: err.column ?? 0 },
      end:   { line: (err.line ?? 1) - 1, character: (err.column ?? 0) + 1 },
    },
    message: err.message ?? String(err),
    source: 'featurescript',
  }));
}
