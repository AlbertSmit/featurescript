import { parse } from '../../parser/src/index.js';
import { runRules } from './engine.js';
import { ALL_RULES } from './rules.js';
import { loadConfig } from './config.js';

/**
 * Lint a FeatureScript source string.
 * @param {string} source - FeatureScript source code
 * @param {string} [filePath] - File path for config discovery
 * @returns {{ parseErrors: object[], lintReports: object[] }}
 */
export function lint(source, filePath) {
  const { ast, errors: parseErrors } = parse(source);
  const config = loadConfig(filePath);
  const lintReports = runRules(ast, ALL_RULES, config.rules);
  return { parseErrors, lintReports };
}

export { ALL_RULES } from './rules.js';
