import lsp from 'vscode-languageserver/node.js';
const { DiagnosticSeverity } = lsp;
import { parse } from '../../parser/src/index.js';
import { runRules } from '../../linter/src/engine.js';
import { ALL_RULES } from '../../linter/src/rules.js';

/** Map linter severity strings → LSP DiagnosticSeverity. */
const SEVERITY_MAP = {
  error:   DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  info:    DiagnosticSeverity.Information,
};

/**
 * Parse source and return LSP Diagnostic[] from parse errors + lint findings.
 * @param {string} source
 * @param {Record<string, string>} [ruleConfig] - Optional rule overrides from .featurescriptrc.json
 * @returns {import('vscode-languageserver').Diagnostic[]}
 */
export function validate(source, ruleConfig = {}) {
  const { ast, errors } = parse(source);

  // ── Parse errors ──
  /** @type {import('vscode-languageserver').Diagnostic[]} */
  const diagnostics = errors.map((err) => ({
    severity: DiagnosticSeverity.Error,
    range: {
      start: { line: (err.line ?? 1) - 1, character: err.column ?? 0 },
      end:   { line: (err.line ?? 1) - 1, character: (err.column ?? 0) + 1 },
    },
    message: err.message ?? String(err),
    source: 'featurescript',
  }));

  // ── Lint findings ──
  const reports = runRules(ast, ALL_RULES, ruleConfig);

  for (const r of reports) {
    diagnostics.push({
      severity: SEVERITY_MAP[r.severity] ?? DiagnosticSeverity.Warning,
      range: {
        start: { line: Math.max(0, (r.line ?? 1) - 1), character: r.column ?? 0 },
        end:   { line: Math.max(0, (r.line ?? 1) - 1), character: (r.column ?? 0) + 1 },
      },
      message: r.message,
      source: `featurescript/${r.ruleId}`,
      code: r.ruleId,
    });
  }

  return diagnostics;
}
