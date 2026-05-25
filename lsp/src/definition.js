import { parse, NodeType, visit } from '../../parser/src/index.js';

/**
 * Go to definition: find the declaration of the symbol at the cursor position.
 * Only handles local (same-file) definitions.
 * @param {string} source
 * @param {{ line: number, character: number }} position
 * @param {string} uri
 * @returns {import('vscode-languageserver').Location | null}
 */
export function provideDefinition(source, position, uri) {
  const word = getWordAtPosition(source, position);
  if (!word) return null;

  const { ast } = parse(source);

  // Search top-level declarations
  for (const decl of ast.body ?? []) {
    if (decl.name === word && decl.loc) {
      return {
        uri,
        range: {
          start: { line: (decl.loc.start.line ?? 1) - 1, character: decl.loc.start.column ?? 0 },
          end:   { line: (decl.loc.start.line ?? 1) - 1, character: (decl.loc.start.column ?? 0) + word.length },
        },
      };
    }
    // Search enum values
    if (decl.values) {
      for (const v of decl.values) {
        if (v.name === word && v.loc) {
          return {
            uri,
            range: {
              start: { line: (v.loc.start.line ?? 1) - 1, character: v.loc.start.column ?? 0 },
              end:   { line: (v.loc.start.line ?? 1) - 1, character: (v.loc.start.column ?? 0) + word.length },
            },
          };
        }
      }
    }
  }

  // Search variable/const declarations in function bodies
  const allDecls = [];
  visit(ast, {
    [NodeType.VariableDeclaration]: (n) => { if (n.name === word) allDecls.push(n); },
    [NodeType.ConstantDeclaration]: (n) => { if (n.name === word) allDecls.push(n); },
  });

  if (allDecls.length > 0) {
    const decl = allDecls[0];
    return {
      uri,
      range: {
        start: { line: (decl.loc.start.line ?? 1) - 1, character: decl.loc.start.column ?? 0 },
        end:   { line: (decl.loc.start.line ?? 1) - 1, character: (decl.loc.start.column ?? 0) + word.length },
      },
    };
  }

  return null;
}

function getWordAtPosition(source, pos) {
  const lines = source.split('\n');
  const line = lines[pos.line] ?? '';
  let start = pos.character, end = pos.character;
  while (start > 0 && /\w/.test(line[start - 1])) start--;
  while (end < line.length && /\w/.test(line[end])) end++;
  return line.slice(start, end) || null;
}
