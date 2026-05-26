import { parse, NodeType, visit } from '../../parser/src/index.js';
import { getStdlib, formatSignature } from './stdlib-loader.js';

/**
 * @param {string} source
 * @param {{ line: number, character: number }} position
 * @returns {import('vscode-languageserver').Hover | null}
 */
export function provideHover(source, position) {
  const word = getWordAtPosition(source, position);
  if (!word) return null;

  // Check stdlib
  const stdlibHover = getStdlibHover(word);
  if (stdlibHover) return stdlibHover;

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

/**
 * Build hover content from stdlib-data.json.
 */
function getStdlibHover(word) {
  const stdlib = getStdlib();
  if (!stdlib) return null;

  // Functions — show all overload signatures
  const fn = stdlib.functions[word];
  if (fn) {
    const sigs = fn.signatures.map(sig => formatSignature(word, sig));
    const sigBlock = sigs.map(s => `${s}`).join('\n');
    const md = [
      '```featurescript',
      sigBlock,
      '```',
      '',
      `*${fn.module}*`,
    ].join('\n');
    return { contents: { kind: 'markdown', value: md } };
  }

  // Types
  const type = stdlib.types[word];
  if (type) {
    const md = [
      '```featurescript',
      `type ${word}`,
      '```',
      '',
      `*${type.module}*`,
    ].join('\n');
    return { contents: { kind: 'markdown', value: md } };
  }

  // Enums — show values
  const enumData = stdlib.enums[word];
  if (enumData) {
    const vals = enumData.values?.length
      ? enumData.values.join(', ')
      : '(no values scraped)';
    const md = [
      '```featurescript',
      `enum ${word} { ${vals} }`,
      '```',
      '',
      `*${enumData.module}*`,
    ].join('\n');
    return { contents: { kind: 'markdown', value: md } };
  }

  // Constants
  const constant = stdlib.constants[word];
  if (constant) {
    const md = [
      '```featurescript',
      `const ${word}`,
      '```',
      '',
      `*${constant.module}*`,
    ].join('\n');
    return { contents: { kind: 'markdown', value: md } };
  }

  // Predicates
  const pred = stdlib.predicates[word];
  if (pred) {
    const params = pred.params?.map(p =>
      p.type && p.type !== 'any' ? `${p.name} is ${p.type}` : p.name
    ).join(', ') ?? '';
    const md = [
      '```featurescript',
      `predicate ${word}(${params})`,
      '```',
      '',
      `*${pred.module}*`,
    ].join('\n');
    return { contents: { kind: 'markdown', value: md } };
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
