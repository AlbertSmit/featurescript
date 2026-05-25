import { CompletionItemKind } from 'vscode-languageserver/node.js';
import { parse, NodeType, visit } from '../../parser/src/index.js';

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

// ── Common stdlib types ──
const STDLIB_TYPES = [
  'Context', 'Id', 'Query', 'boolean', 'number', 'string', 'array', 'map', 'box',
  'ValueWithUnits', 'Vector', 'Line', 'Plane', 'CoordSystem', 'Transform',
  'BooleanOperationType', 'BoundingType', 'OperationType',
];

const TYPE_ITEMS = STDLIB_TYPES.map(t => ({
  label: t,
  kind: CompletionItemKind.TypeParameter,
  detail: 'type',
}));

// ── Common stdlib functions ──
const STDLIB_FUNCTIONS = [
  { label: 'opExtrude', detail: '(context, id, definition)' },
  { label: 'opRevolve', detail: '(context, id, definition)' },
  { label: 'opSweep', detail: '(context, id, definition)' },
  { label: 'opLoft', detail: '(context, id, definition)' },
  { label: 'opFillet', detail: '(context, id, definition)' },
  { label: 'opChamfer', detail: '(context, id, definition)' },
  { label: 'opBoolean', detail: '(context, id, definition)' },
  { label: 'opPattern', detail: '(context, id, definition)' },
  { label: 'opDeleteBodies', detail: '(context, id, definition)' },
  { label: 'opTransform', detail: '(context, id, definition)' },
  { label: 'startSketch', detail: '(context, id, value)' },
  { label: 'sketchArc', detail: '(sketch, id, value)' },
  { label: 'sketchCircle', detail: '(sketch, id, value)' },
  { label: 'sketchLine', detail: '(sketch, id, value)' },
  { label: 'sketchRectangle', detail: '(sketch, id, value)' },
  { label: 'skSolve', detail: '(sketch)' },
  { label: 'qCreatedBy', detail: '(id, entityType)' },
  { label: 'qOwnerBody', detail: '(query)' },
  { label: 'qEverything', detail: '(entityType)' },
  { label: 'qBodyType', detail: '(query, bodyType)' },
  { label: 'qUnion', detail: '(queries)' },
  { label: 'qSubtraction', detail: '(from, subtract)' },
  { label: 'qIntersection', detail: '(queries)' },
  { label: 'evBox3d', detail: '(context, definition)' },
  { label: 'evDistance', detail: '(context, definition)' },
  { label: 'evFaceTangentPlane', detail: '(context, definition)' },
  { label: 'evEdgeTangentLine', detail: '(context, definition)' },
  { label: 'evVertexPoint', detail: '(context, definition)' },
  { label: 'evLength', detail: '(context, definition)' },
  { label: 'evArea', detail: '(context, definition)' },
  { label: 'evVolume', detail: '(context, definition)' },
  { label: 'isAtVersionOrLater', detail: '(context, version)' },
  { label: 'reportFeatureInfo', detail: '(context, id, message)' },
  { label: 'reportFeatureWarning', detail: '(context, id, message)' },
  { label: 'reportFeatureError', detail: '(context, id, message)' },
  { label: 'defineFeature', detail: '(feature, definition)' },
  { label: 'isQueryEmpty', detail: '(context, query)' },
  { label: 'size', detail: '(container)' },
  { label: 'append', detail: '(array, value)' },
  { label: 'concatenateArrays', detail: '(arrays)' },
  { label: 'mergeMaps', detail: '(map1, map2)' },
  { label: 'keys', detail: '(map)' },
  { label: 'values', detail: '(map)' },
  { label: 'mapArray', detail: '(arr, fn)' },
  { label: 'toString', detail: '(value)' },
  { label: 'println', detail: '(value)' },
];

const FUNCTION_ITEMS = STDLIB_FUNCTIONS.map(f => ({
  label: f.label,
  kind: CompletionItemKind.Function,
  detail: f.detail,
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

  // After `is` or `as` — suggest types
  if (/\b(is|as)\s+\w*$/.test(prefix)) {
    return TYPE_ITEMS;
  }

  // Collect local symbols from the AST
  const localItems = collectLocalSymbols(source);

  return [...KEYWORD_ITEMS, ...FUNCTION_ITEMS, ...TYPE_ITEMS, ...localItems];
}

function isInsideAnnotation(lines, pos) {
  // Simple heuristic: walk backward to find `annotation {` without closing `}`
  let braceDepth = 0;
  for (let i = pos.line; i >= 0; i--) {
    const l = i === pos.line ? lines[i].slice(0, pos.character) : lines[i];
    for (let j = l.length - 1; j >= 0; j--) {
      if (l[j] === '}') braceDepth++;
      if (l[j] === '{') {
        braceDepth--;
        if (braceDepth < 0) {
          // Check if preceded by `annotation`
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
