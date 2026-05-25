# AGENTS.md — FeatureScript Tooling

Instructions for AI agents working in this repository.

## Repository Overview

This is a **FeatureScript developer toolchain** — a parser, linter, LSP server, and VS Code extension for Onshape's CAD modeling language. All modules are zero-dependency, pure JavaScript (ESM).

## Project Structure

```
parser/src/         Core parser (lexer → AST)
  ├── lexer.js      Tokenizer — identifiers, keywords, operators, strings, numbers
  ├── parser.js     Entry point — orchestrates declarations/statements/expressions
  ├── parser-base.js  Shared parser state (token stream, position, error reporting)
  ├── declarations.js Top-level constructs (imports, functions, enums, types, consts)
  ├── statements.js   Statement parsing (if, for, while, try/catch, assignments)
  ├── expressions.js  Expression parsing with precedence climbing
  ├── ast.js          Node types enum + node factory + loc helpers
  ├── visitor.js      AST visitor (used by linter rules)
  └── index.js        Public API re-exports

linter/src/         AST-driven lint engine
  ├── rules.js      All lint rules (9 total)
  ├── engine.js     Rule runner
  ├── cli.js        CLI entry point (stylish/JSON output)
  ├── config.js     .featurescriptrc.json loader
  └── index.js      Public API

lsp/src/            Language Server Protocol
  ├── server.js     LSP entry point + capability registration
  ├── diagnostics.js  Parse errors → LSP diagnostics
  ├── hover.js      Hover provider (stdlib + local symbols)
  ├── completions.js  Completion provider
  ├── definition.js   Go to Definition
  ├── symbols.js    Document Symbol provider
  ├── signature.js  Signature Help
  └── semantic-tokens.js  (stub — future AST-aware tokenization)

vscode-ext/         VS Code extension
  ├── package.json  Extension manifest
  ├── syntaxes/     TextMate grammar (.tmLanguage.json)
  └── src/          Extension activation + LSP client

examples/           Real-world .fs files for testing
test/               Test suite (node:test runner)
docs/               Language reference documentation
```

## FeatureScript Language Essentials

Agents working on this codebase must understand the FeatureScript language. Key reference: `docs/featurescript-language-reference.md`.

### Critical Patterns

**Version header** — Every .fs file starts with:
```
FeatureScript 2096;
```

**Imports** — Three forms:
```
import(path : "onshape/std/common.fs", version : "2096.0");
export import(path : "tabId", version : "microversion");
ns::import(path : "onshape/std/math.fs", version : "2096.0");
```

**Feature definition** — The canonical pattern:
```
annotation { "Feature Type Name" : "My Feature" }
export const myFeature = defineFeature(function(context is Context, id is Id, definition is map)
  precondition
  {
    annotation { "Name" : "My Parameter" }
    definition.myParam is Query;
  }
  {
    // Feature body
    opExtrude(context, id + "extrude1", { "entities" : definition.myParam, ... });
  });
```

**Operators** — FeatureScript-specific:
- `~` string concatenation (not bitwise)
- `^` exponentiation (not bitwise XOR)
- `??` undefined-coalescing
- `->` arrow call syntax (`x->f(y)` = `f(x, y)`)
- `::` namespace access
- `[]` box access (no subscript inside)
- `is` / `as` for type checking / conversion

**No ++ or --** — Use `+= 1` and `-= 1` instead.

**Reserved keywords** (not yet used): `assert`, `case`, `default`, `do`, `switch`.

## Parser Architecture

### Module Dependency Order

```
lexer.js → parser-base.js → declarations.js
                            ↕ (lazy cross-refs)
                           statements.js ↔ expressions.js
```

Circular dependency between statements and expressions is resolved via **lazy imports** — each module only references the other at call time, not at module load time.

### How the Parser Works

1. **Lexer** tokenizes source into a flat token array
2. **Parser** creates a `ParserBase` instance wrapping the token stream
3. **Declarations** dispatcher handles the top-level loop:
   - `FeatureScript VERSION;` → Program node
   - `import(...)` → ImportStatement
   - `export? function` → FunctionDeclaration
   - `export? predicate` → PredicateDeclaration
   - `export? enum` → EnumDeclaration
   - `export? type` → TypeDeclaration
   - `export? const` → ConstantDeclaration
   - `annotation { ... }` → Annotation (attached to next declaration)
4. **Statements** handles function bodies
5. **Expressions** uses precedence climbing for binary operators

### Error Recovery

The parser does not throw on syntax errors. Instead it:
1. Records the error with location
2. Skips tokens until a recovery point (`;`, `}`, or a known keyword)
3. Continues parsing the rest of the file

This is critical for LSP — a file with one error should still provide completions and diagnostics for the rest.

## Testing

```bash
node --test test/parser.test.js
```

Four tiers of tests:
1. **AST structure** — exact node types and shapes
2. **Error detection** — invalid syntax produces errors
3. **Corpus** — all `examples/*.fs` files parse with 0 errors
4. **AST completeness** — function bodies contain all statements (not empty stubs)

**Before any parser change**: run the full test suite. All 48 tests must pass.

## Common Pitfalls

### Parser

- **`defineFeature` lambda parsing** — The function expression inside `defineFeature(function(...) precondition {} {})` requires the expression parser to handle precondition blocks. This was a major bug that was fixed. Don't regress it.
- **For-loop disambiguation** — `for (var x ...)` could be a standard for-loop or a for-in loop. The parser looks ahead for `in` after the variable name to decide.
- **Map literal vs block** — `{ ... }` at statement position is a block statement; in expression position it's a map literal. Context matters.

### Linter

- **Import resolution** — The linter does NOT resolve imports. Rules like `no-undefined-vars` are heuristic-only and intentionally disabled for cross-module references.
- **Rule IDs are stable** — Don't rename rule IDs, they're used in `.featurescriptrc.json` config files.

### LSP

- **Stdlib data** — Completions and hover info come from hard-coded patterns, not a full stdlib database. Future work: scrape FsDoc into `stdlib-data.json`.

## Conventions

- **ESM only** — All files use `import`/`export`. No CommonJS.
- **No external dependencies** — The parser, linter, and LSP are pure JavaScript.
- **Node types are strings** — AST node types are plain strings from `NodeType` enum, not class instances.
- **All AST nodes have `loc`** — `{ start: { line, column, offset }, end: { line, column, offset } }`.
- **Test before commit** — Run `node --test test/parser.test.js` and verify 48/48 pass.
