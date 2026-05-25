import { visit, NodeType } from '../../parser/src/index.js';

/**
 * Run all enabled rules against a parsed AST.
 * @param {object} ast - Parsed AST
 * @param {object[]} rules - Array of rule modules
 * @param {object} config - Rule severity overrides { ruleId: 'off'|'warn'|'error' }
 * @returns {{ ruleId: string, severity: string, message: string, line: number, column: number }[]}
 */
export function runRules(ast, rules, config = {}) {
  const reports = [];

  for (const rule of rules) {
    const severity = config[rule.id] ?? rule.severity;
    if (severity === 'off') continue;

    const ctx = {
      report(node, message) {
        reports.push({
          ruleId: rule.id,
          severity,
          message,
          line: node?.loc?.start?.line ?? 0,
          column: node?.loc?.start?.column ?? 0,
        });
      },
      ast,
    };

    rule.create(ctx);
  }

  // Sort by line, then column
  reports.sort((a, b) => a.line - b.line || a.column - b.column);
  return reports;
}
