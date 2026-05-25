// AST visitor utility — walk and transform AST nodes
import { NodeType } from './ast.js';

/**
 * Walk an AST, calling visitor callbacks for each node type.
 * @param {object} ast - Root AST node
 * @param {Record<string, (node, parent) => void>} visitors - Map of NodeType → callback
 */
export function visit(ast, visitors) {
  function walk(n, parent) {
    if (!n || typeof n !== 'object') return;
    if (n.type && visitors[n.type]) visitors[n.type](n, parent);
    for (const key of Object.keys(n)) {
      if (key === 'loc' || key === 'type') continue;
      const val = n[key];
      if (Array.isArray(val)) val.forEach(child => walk(child, n));
      else if (val && typeof val === 'object' && val.type) walk(val, n);
    }
  }
  walk(ast, null);
}
