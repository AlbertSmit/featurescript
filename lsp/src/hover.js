import { parse, NodeType, visit } from '../../parser/src/index.js';
import { Lexer } from '../../parser/src/lexer.js';

// ── Stdlib hover docs (subset — extend with stdlib-data.json later) ──
const DOCS = {
  opExtrude: 'Extrude a sketch region along a direction.\n\n`opExtrude(context, id, definition)`',
  opBoolean: 'Perform a boolean operation (union, subtract, intersect) between solid bodies.\n\n`opBoolean(context, id, definition)`',
  opFillet: 'Create a fillet (rounded edge) on selected edges.\n\n`opFillet(context, id, definition)`',
  opChamfer: 'Create a chamfer (beveled edge) on selected edges.\n\n`opChamfer(context, id, definition)`',
  opSweep: 'Sweep a profile along a path.\n\n`opSweep(context, id, definition)`',
  opLoft: 'Create a loft between profiles.\n\n`opLoft(context, id, definition)`',
  opRevolve: 'Revolve a sketch region around an axis.\n\n`opRevolve(context, id, definition)`',
  opPattern: 'Create a pattern of bodies.\n\n`opPattern(context, id, definition)`',
  opDeleteBodies: 'Delete bodies from the context.\n\n`opDeleteBodies(context, id, definition)`',
  opTransform: 'Apply a transform to bodies.\n\n`opTransform(context, id, definition)`',
  startSketch: 'Begin a new sketch on a plane or face.\n\n`startSketch(context, id, { sketchPlane })`',
  skSolve: 'Solve sketch constraints.\n\n`skSolve(sketch)`',
  qCreatedBy: 'Query entities created by a feature.\n\n`qCreatedBy(id, EntityType.FACE)`',
  qOwnerBody: 'Query the owner body of an entity.\n\n`qOwnerBody(query)`',
  qEverything: 'Query all entities of a type.\n\n`qEverything(EntityType.BODY)`',
  evBox3d: 'Evaluate the 3D bounding box of entities.\n\n`evBox3d(context, { entities })`',
  defineFeature: 'Define a custom feature.\n\n`export const myFeature = defineFeature(function(context, id, definition) { ... })`',
  reportFeatureInfo: 'Report info message in the feature dialog.\n\n`reportFeatureInfo(context, id, "message")`',
  isQueryEmpty: 'Check if a query selects no entities.\n\n`isQueryEmpty(context, query)`',
  println: 'Print a value to the FeatureScript console.\n\n`println(value)`',
  Context: 'The regeneration context — holds all Part Studio geometry state.',
  Id: 'Unique identifier for features and operations.',
  Query: 'A query that lazily selects geometric entities.',
  ValueWithUnits: 'A number with associated units (e.g., 10 * millimeter).',
  Vector: 'A 3D vector [x, y, z] with units.',
  box: 'A mutable reference container. Access with `myBox[]`, create with `new box(value)`.',
};

/**
 * @param {string} source
 * @param {{ line: number, character: number }} position
 * @returns {import('vscode-languageserver').Hover | null}
 */
export function provideHover(source, position) {
  const word = getWordAtPosition(source, position);
  if (!word) return null;

  // Check stdlib docs
  if (DOCS[word]) {
    return { contents: { kind: 'markdown', value: DOCS[word] } };
  }

  // Check local declarations
  const { ast } = parse(source);
  for (const decl of ast.body ?? []) {
    if (decl.name === word) {
      const detail = buildDeclDetail(decl);
      if (detail) return { contents: { kind: 'markdown', value: detail } };
    }
  }

  return null;
}

function getWordAtPosition(source, pos) {
  const lines = source.split('\n');
  const line = lines[pos.line] ?? '';
  let start = pos.character, end = pos.character;
  while (start > 0 && /\w/.test(line[start - 1])) start--;
  while (end < line.length && /\w/.test(line[end])) end++;
  const word = line.slice(start, end);
  return word || null;
}

function buildDeclDetail(decl) {
  if (decl.type === NodeType.FunctionDeclaration) {
    const params = (decl.params ?? []).map(p => p.typeConstraint ? `${p.name} is ${p.typeConstraint}` : p.name);
    const exp = decl.exported ? 'export ' : '';
    const ret = decl.returnType ? ` returns ${decl.returnType}` : '';
    return `\`\`\`featurescript\n${exp}function ${decl.name}(${params.join(', ')})${ret}\n\`\`\``;
  }
  if (decl.type === NodeType.PredicateDeclaration) {
    const params = (decl.params ?? []).map(p => p.name);
    return `\`\`\`featurescript\npredicate ${decl.name}(${params.join(', ')})\n\`\`\``;
  }
  if (decl.type === NodeType.EnumDeclaration) {
    const vals = (decl.values ?? []).map(v => v.name).join(', ');
    return `\`\`\`featurescript\nenum ${decl.name} { ${vals} }\n\`\`\``;
  }
  if (decl.type === NodeType.ConstantDeclaration) {
    return `\`\`\`featurescript\nconst ${decl.name}\n\`\`\``;
  }
  return null;
}
