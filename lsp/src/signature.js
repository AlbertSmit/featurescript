/**
 * Signature help: show parameter info for known stdlib functions.
 */

const SIGNATURES = {
  opExtrude:   { label: 'opExtrude(context is Context, id is Id, definition is map)', params: ['context is Context', 'id is Id', 'definition is map'] },
  opBoolean:   { label: 'opBoolean(context is Context, id is Id, definition is map)', params: ['context is Context', 'id is Id', 'definition is map'] },
  opFillet:    { label: 'opFillet(context is Context, id is Id, definition is map)', params: ['context is Context', 'id is Id', 'definition is map'] },
  opChamfer:   { label: 'opChamfer(context is Context, id is Id, definition is map)', params: ['context is Context', 'id is Id', 'definition is map'] },
  opSweep:     { label: 'opSweep(context is Context, id is Id, definition is map)', params: ['context is Context', 'id is Id', 'definition is map'] },
  opLoft:      { label: 'opLoft(context is Context, id is Id, definition is map)', params: ['context is Context', 'id is Id', 'definition is map'] },
  opRevolve:   { label: 'opRevolve(context is Context, id is Id, definition is map)', params: ['context is Context', 'id is Id', 'definition is map'] },
  startSketch: { label: 'startSketch(context is Context, id is Id, value is map)', params: ['context is Context', 'id is Id', 'value is map'] },
  skSolve:     { label: 'skSolve(sketch is Sketch)', params: ['sketch is Sketch'] },
  sketchLine:  { label: 'sketchLine(sketch is Sketch, id is string, value is map)', params: ['sketch is Sketch', 'id is string', 'value is map'] },
  sketchArc:   { label: 'sketchArc(sketch is Sketch, id is string, value is map)', params: ['sketch is Sketch', 'id is string', 'value is map'] },
  sketchCircle: { label: 'sketchCircle(sketch is Sketch, id is string, value is map)', params: ['sketch is Sketch', 'id is string', 'value is map'] },
  qCreatedBy:  { label: 'qCreatedBy(id is Id, entityType is EntityType)', params: ['id is Id', 'entityType is EntityType'] },
  qOwnerBody:  { label: 'qOwnerBody(query is Query)', params: ['query is Query'] },
  println:     { label: 'println(value)', params: ['value'] },
};

export function provideSignatureHelp(source, position) {
  const lines = source.split('\n');
  const line = lines[position.line] ?? '';
  const prefix = line.slice(0, position.character);

  // Find the function name before the open paren
  const match = prefix.match(/(\w+)\s*\([^)]*$/);
  if (!match) return null;

  const funcName = match[1];
  const sig = SIGNATURES[funcName];
  if (!sig) return null;

  // Count commas to determine active parameter
  const afterParen = prefix.slice(prefix.lastIndexOf('(') + 1);
  const activeParam = (afterParen.match(/,/g) || []).length;

  return {
    signatures: [{
      label: sig.label,
      parameters: sig.params.map(p => ({ label: p })),
    }],
    activeSignature: 0,
    activeParameter: Math.min(activeParam, sig.params.length - 1),
  };
}
