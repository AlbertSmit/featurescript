import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Load lint config by searching for .featurescriptrc.json up the directory tree.
 * @param {string} [filePath] - Path to the file being linted (for config discovery)
 * @returns {{ rules: Record<string, string> }}
 */
export function loadConfig(filePath) {
  const defaults = { rules: {} };

  if (!filePath) return defaults;

  let dir = dirname(filePath);
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, '.featurescriptrc.json');
    if (existsSync(candidate)) {
      try {
        const raw = readFileSync(candidate, 'utf-8');
        const config = JSON.parse(raw);
        return { rules: { ...defaults.rules, ...(config.rules ?? {}) } };
      } catch { return defaults; }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return defaults;
}
