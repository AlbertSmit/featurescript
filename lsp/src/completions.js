import lsp from 'vscode-languageserver/node.js';
const { CompletionItemKind } = lsp;
import { parse, NodeType, visit } from '../../parser/src/index.js';
import { getStdlib, formatParamList } from './stdlib-loader.js';

// ── Keyword completions ──
const KEYWORDS = [
  'annotation', 'as', 'break', 'catch', 'const', 'continue', 'else', 'enum',
  'export', 'false', 'for', 'function', 'if', 'import', 'in', 'inf', 'is',
  'new', 'operator', 'precondition', 'predicate', 'return', 'returns',
  'throw', 'true', 'try', 'type', 'typecheck', 'typeconvert', 'undefined',
  'var', 'while',
];

const KEYWORD_ITEMS = KEYWORDS.map(k => ({
  label: k,
  kind: CompletionItemKind.Keyword,
  detail: 'keyword',
}));

// ── Annotation keys ──
const ANNOTATION_KEYS = [
  '"Name"', '"Feature Type Name"', '"UIHint"', '"Filter"', '"MaxNumberOfPicks"',
  '"Default"', '"Hidden"', '"Editing Logic Function"', '"Manipulator Change Function"',
];

const ANNOTATION_ITEMS = ANNOTATION_KEYS.map(k => ({
  label: k,
  kind: CompletionItemKind.Property,
  detail: 'annotation key',
  insertText: k,
}));

// ── Stdlib-driven completions (built lazily from stdlib-data.json) ──

let _stdlibItems = null;

function getStdlibItems() {
  if (_stdlibItems) return _stdlibItems;

  const stdlib = getStdlib();
  if (!stdlib) return getFallbackItems();

  const items = [];

  // Functions — all 695+
  for (const [name, data] of Object.entries(stdlib.functions)) {
    const primarySig = data.signatures[0];
    const overloadCount = data.signatures.length;
    const detail = formatParamList(primarySig);
    const overloadSuffix = overloadCount > 1 ? ` (+${overloadCount - 1} overload${overloadCount > 2 ? 's' : ''})` : '';

    items.push({
      label: name,
      kind: CompletionItemKind.Function,
      detail: `${detail}${overloadSuffix}`,
      sortText: `1_${name}`, // Functions first
      data: { module: data.module },
    });
  }

  // Types — all 87
  for (const [name, data] of Object.entries(stdlib.types)) {
    items.push({
      label: name,
      kind: CompletionItemKind.TypeParameter,
      detail: `type [${data.module}]`,
      sortText: `2_${name}`,
    });
  }

  // Enums — all 180
  for (const [name, data] of Object.entries(stdlib.enums)) {
    items.push({
      label: name,
      kind: CompletionItemKind.Enum,
      detail: `enum [${data.module}]`,
      sortText: `2_${name}`,
    });

    // Enum values as qualified names (e.g., BoundingType.BLIND)
    for (const val of data.values ?? []) {
      items.push({
        label: `${name}.${val}`,
        kind: CompletionItemKind.EnumMember,
        detail: name,
        sortText: `3_${name}.${val}`,
      });
    }
  }

  // Constants — all 123
  for (const [name, data] of Object.entries(stdlib.constants)) {
    items.push({
      label: name,
      kind: CompletionItemKind.Constant,
      detail: `const [${data.module}]`,
      sortText: `2_${name}`,
    });
  }

  // Predicates — all 112
  for (const [name, data] of Object.entries(stdlib.predicates)) {
    items.push({
      label: name,
      kind: CompletionItemKind.Function,
      detail: `predicate [${data.module}]`,
      sortText: `1_${name}`,
    });
  }

  _stdlibItems = items;
  return items;
}

/** Minimal fallback if stdlib-data.json is missing */
function getFallbackItems() {
  const BUILTIN_TYPES = [
    'Context', 'Id', 'Query', 'boolean', 'number', 'string', 'array', 'map', 'box',
    'ValueWithUnits', 'Vector', 'Line', 'Plane', 'CoordSystem', 'Transform',
  ];

  return BUILTIN_TYPES.map(t => ({
    label: t,
    kind: CompletionItemKind.TypeParameter,
    detail: 'type',
  }));
}

/**
 * @param {string} source
 * @param {{ line: number, character: number }} position
 */
export function provideCompletion(source, position) {
  const lines = source.split('\n');
  const line = lines[position.line] ?? '';
  const prefix = line.slice(0, position.character);

  // Inside annotation { ... } — suggest annotation keys
  if (isInsideAnnotation(lines, position)) {
    return ANNOTATION_ITEMS;
  }

  // After `EnumType.` — suggest enum values
  const enumDot = prefix.match(/(\w+)\.\w*$/);
  if (enumDot) {
    const stdlib = getStdlib();
    if (stdlib) {
      const enumName = enumDot[1];
      const enumData = stdlib.enums[enumName];
      if (enumData && enumData.values) {
        return enumData.values.map(v => ({
          label: v,
          kind: CompletionItemKind.EnumMember,
          detail: enumName,
        }));
      }
    }
  }

  // After `is` or `as` — filter to types and enums only
  if (/\b(is|as)\s+\w*$/.test(prefix)) {
    return getStdlibItems().filter(item =>
      item.kind === CompletionItemKind.TypeParameter ||
      item.kind === CompletionItemKind.Enum
    );
  }

  // Collect local symbols from the AST
  const localItems = collectLocalSymbols(source);

  return [...KEYWORD_ITEMS, ...getStdlibItems(), ...localItems];
}

function isInsideAnnotation(lines, pos) {
  let braceDepth = 0;
  for (let i = pos.line; i >= 0; i--) {
    const l = i === pos.line ? lines[i].slice(0, pos.character) : lines[i];
    for (let j = l.length - 1; j >= 0; j--) {
      if (l[j] === '}') braceDepth++;
      if (l[j] === '{') {
        braceDepth--;
        if (braceDepth < 0) {
          const before = l.slice(0, j).trimEnd();
          return before.endsWith('annotation');
        }
      }
    }
  }
  return false;
}

function collectLocalSymbols(source) {
  try {
    const { ast } = parse(source);
    const items = [];
    for (const decl of ast.body ?? []) {
      if (decl.name) {
        const kind = decl.type === NodeType.EnumDeclaration ? CompletionItemKind.Enum
          : decl.type === NodeType.ConstantDeclaration ? CompletionItemKind.Constant
          : decl.type === NodeType.TypeDeclaration ? CompletionItemKind.TypeParameter
          : CompletionItemKind.Function;
        items.push({ label: decl.name, kind, detail: 'local' });
      }
      // Enum values
      if (decl.values) {
        for (const v of decl.values) {
          items.push({ label: `${decl.name}.${v.name}`, kind: CompletionItemKind.EnumMember, detail: decl.name });
        }
      }
    }
    return items;
  } catch { return []; }
}
