// Test runner: parse all .fs files in examples/ and report results
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from '../parser/src/parser.js';

const dir = join(import.meta.dirname, '..', 'examples');
const files = readdirSync(dir).filter(f => f.endsWith('.fs'));

let totalErrors = 0;
let totalFiles = 0;

for (const file of files) {
  totalFiles++;
  const source = readFileSync(join(dir, file), 'utf-8');
  const { ast, errors } = parse(source);

  const declarations = (ast.body ?? []).filter(n => n != null);
  const types = declarations.map(d => d.type);

  console.log(`\n━━ ${file} ━━`);
  console.log(`  Declarations: ${declarations.length} (${types.join(', ')})`);
  console.log(`  Parse errors: ${errors.length}`);

  if (errors.length > 0) {
    totalErrors += errors.length;
    for (const e of errors) {
      console.log(`    L${e.line}:${e.column} ${e.message}`);
    }
  }
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`Files: ${totalFiles} | Total errors: ${totalErrors}`);
console.log(totalErrors === 0 ? '✅ All files parsed successfully!' : '❌ Some files have parse errors');
process.exit(totalErrors > 0 ? 1 : 0);
