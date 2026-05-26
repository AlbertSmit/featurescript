/**
 * Signature help: show parameter info for stdlib functions.
 * Driven by stdlib-data.json — covers all 695+ functions with overloads.
 */

import { getStdlib, formatSignature } from './stdlib-loader.js';

export function provideSignatureHelp(source, position) {
  const lines = source.split('\n');
  const line = lines[position.line] ?? '';
  const prefix = line.slice(0, position.character);

  // Find the function name before the open paren.
  // Walk backward to handle nested calls: opExtrude(context, id + "foo", { "entities" : qCreatedBy(|
  const funcName = findActiveFunctionName(prefix);
  if (!funcName) return null;

  const stdlib = getStdlib();
  if (!stdlib) return null;

  const fnData = stdlib.functions[funcName];
  if (!fnData) return null;

  // Count commas at the current nesting level to determine active parameter
  const activeParam = countActiveParam(prefix);

  // Build LSP signature info for each overload
  const signatures = fnData.signatures.map(sig => {
    const label = formatSignature(funcName, sig);
    const parameters = sig.params.map(p => {
      const paramLabel = p.type && p.type !== 'any'
        ? `${p.name} is ${p.type}`
        : p.name;
      return { label: paramLabel };
    });
    return { label, parameters };
  });

  // Pick the best overload based on parameter count
  let activeSignature = 0;
  for (let i = 0; i < signatures.length; i++) {
    if (activeParam < signatures[i].parameters.length) {
      activeSignature = i;
      break;
    }
  }

  return {
    signatures,
    activeSignature,
    activeParameter: Math.min(activeParam, signatures[activeSignature]?.parameters?.length - 1 ?? 0),
  };
}

/**
 * Find the function name for the innermost open paren.
 * Handles nested calls by tracking paren depth.
 */
function findActiveFunctionName(prefix) {
  let depth = 0;

  for (let i = prefix.length - 1; i >= 0; i--) {
    const ch = prefix[i];
    if (ch === ')') depth++;
    if (ch === '(') {
      if (depth === 0) {
        // This is our open paren — extract the function name before it
        const before = prefix.slice(0, i);
        const match = before.match(/(\w+)\s*$/);
        return match ? match[1] : null;
      }
      depth--;
    }
  }

  return null;
}

/**
 * Count commas at the current paren nesting level.
 * This determines which parameter index the cursor is at.
 */
function countActiveParam(prefix) {
  let depth = 0;
  let commas = 0;

  for (let i = prefix.length - 1; i >= 0; i--) {
    const ch = prefix[i];
    if (ch === ')') depth++;
    if (ch === '(') {
      if (depth === 0) return commas;
      depth--;
    }
    if (ch === ',' && depth === 0) commas++;
  }

  return commas;
}
