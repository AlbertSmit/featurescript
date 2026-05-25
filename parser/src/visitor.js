// AST visitor utility — walk and transform AST nodes
import { NodeType } from './ast.js';

/** @typedef {import('./types.js').ASTNode} ASTNode */
/** @typedef {import('./types.js').VisitorMap} VisitorMap */

/**
 * Walk an AST, calling visitor callbacks for each node type.
 * Traverses depth-first, visiting parents before children.
 *
 * Each callback receives the narrowed node type for its key:
 * ```
 * visit(ast, {
 *   FunctionDeclaration(node) {
 *     // node is FunctionDeclarationNode
 *   },
 * });
 * ```
 *
 * @param {ASTNode} ast - Root AST node to traverse
 * @param {VisitorMap} visitors - Map of NodeType → callback
 */
export function visit(ast, visitors) {
  /**
   * @param {ASTNode | null | undefined} n
   * @param {ASTNode | null} parent
   */
  function walk(n, parent) {
    if (!n || typeof n !== 'object') return;
    if (n.type && visitors[n.type]) visitors[n.type](/** @type {never} */ (n), parent);
    for (const key of Object.keys(n)) {
      if (key === 'loc' || key === 'type') continue;
      const val = /** @type {Record<string, unknown>} */ (n)[key];
      if (Array.isArray(val)) val.forEach(child => walk(/** @type {ASTNode} */ (child), /** @type {ASTNode} */ (n)));
      else if (val && typeof val === 'object' && /** @type {ASTNode} */ (val).type) walk(/** @type {ASTNode} */ (val), /** @type {ASTNode} */ (n));
    }
  }
  walk(ast, null);
}
