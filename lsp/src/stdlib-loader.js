/**
 * Shared stdlib-data.json loader for LSP modules.
 * Loads once, caches in memory, provides typed lookup helpers.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STDLIB_PATH = resolve(__dirname, '..', '..', 'stdlib-data.json');

let _cache = null;

/**
 * Load and cache stdlib-data.json.
 * Returns null if the file doesn't exist.
 */
export function getStdlib() {
  if (_cache) return _cache;
  if (!existsSync(STDLIB_PATH)) return null;
  try {
    _cache = JSON.parse(readFileSync(STDLIB_PATH, 'utf-8'));
    return _cache;
  } catch {
    return null;
  }
}

/**
 * Build a human-readable signature label for a function.
 * e.g. "opExtrude(context is Context, id is Id, definition is map)"
 */
export function formatSignature(name, sig) {
  const params = sig.params
    .map(p => p.type && p.type !== 'any' ? `${p.name} is ${p.type}` : p.name)
    .join(', ');
  const ret = sig.returnType && sig.returnType !== 'void'
    ? ` returns ${sig.returnType}`
    : '';
  return `${name}(${params})${ret}`;
}

/**
 * Build a short detail string showing just param names.
 * e.g. "(context, id, definition)"
 */
export function formatParamList(sig) {
  return `(${sig.params.map(p => p.name).join(', ')})`;
}
