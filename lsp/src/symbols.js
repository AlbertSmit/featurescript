import lsp from 'vscode-languageserver/node.js';
const { SymbolKind } = lsp;
import { parse, NodeType, visit } from '../../parser/src/index.js';

const KIND_MAP = {
  [NodeType.FunctionDeclaration]:  SymbolKind.Function,
  [NodeType.PredicateDeclaration]: SymbolKind.Function,
  [NodeType.OperatorOverload]:     SymbolKind.Operator,
  [NodeType.EnumDeclaration]:      SymbolKind.Enum,
  [NodeType.TypeDeclaration]:      SymbolKind.TypeParameter,
  [NodeType.ConstantDeclaration]:  SymbolKind.Constant,
};

/**
 * Walk the AST and return DocumentSymbol[] for the outline view.
 * @param {string} source
 * @returns {import('vscode-languageserver').DocumentSymbol[]}
 */
export function provideDocumentSymbols(source) {
  const { ast } = parse(source);
  const symbols = [];

  for (const decl of ast.body ?? []) {
    const kind = KIND_MAP[decl.type];
    if (!kind || !decl.name) continue;

    const range = locToRange(decl.loc);
    const detail = buildDetail(decl);

    const sym = {
      name: decl.name,
      detail,
      kind,
      range,
      selectionRange: range,
      children: [],
    };

    // Add enum values as children
    if (decl.type === NodeType.EnumDeclaration && decl.values) {
      for (const val of decl.values) {
        sym.children.push({
          name: val.name,
          kind: SymbolKind.EnumMember,
          range: locToRange(val.loc),
          selectionRange: locToRange(val.loc),
        });
      }
    }

    symbols.push(sym);
  }

  return symbols;
}

function buildDetail(decl) {
  if (decl.type === NodeType.FunctionDeclaration || decl.type === NodeType.PredicateDeclaration) {
    const params = (decl.params ?? []).map(p => p.typeConstraint ? `${p.name} is ${p.typeConstraint}` : p.name);
    const ret = decl.returnType ? ` returns ${decl.returnType}` : '';
    return `(${params.join(', ')})${ret}`;
  }
  if (decl.type === NodeType.OperatorOverload) return `operator ${decl.operator}`;
  if (decl.type === NodeType.TypeDeclaration) return `typecheck ${decl.typecheck}`;
  return '';
}

function locToRange(loc) {
  return {
    start: { line: (loc?.start?.line ?? 1) - 1, character: loc?.start?.column ?? 0 },
    end:   { line: (loc?.end?.line ?? 1) - 1,   character: loc?.end?.column ?? 0 },
  };
}
