# FeatureScript Tooling

Developer tooling for [FeatureScript](https://cad.onshape.com/FsDoc/) — the Onshape CAD modeling language. Provides a parser, linter, language server, and VS Code extension — all zero-dependency, pure JavaScript.

## Modules

```
featurescript/
├── parser/          Recursive-descent parser → AST
├── linter/          AST-driven lint rules + CLI
├── lsp/             Language Server Protocol provider
├── vscode-ext/      VS Code extension (TextMate grammar + LSP client)
├── oracle/          Onshape validation oracle (push, compile, diff)
├── stdlib-data.json Scraped standard library (1197 symbols)
├── examples/        Real-world .fs files (slot, fillet, pattern, shoe-sole-blank)
├── test/            Automated test suite (node:test)
└── docs/            Language reference & architecture notes
```

### Parser

A zero-dependency, recursive-descent parser that produces a complete AST from FeatureScript source. Handles all language constructs including:

- `FeatureScript VERSION;` headers
- Namespaced and standard imports
- Functions with typed parameters, return types, and preconditions
- The `defineFeature(function(...) precondition {} {})` pattern
- Predicates, enums, custom types, operator overloads, constants
- Full expression precedence (binary, unary, ternary, member access, subscript, box, type checks, casts)
- Arrow call syntax (`x->f(y)`)
- All statement types (if/else, for, for-in, while, try/catch, throw, return, break, continue)
- Annotations with map literal bodies

```js
import { parse } from './parser/src/parser.js';

const { ast, errors } = parse(source);
```

### Linter

10 lint rules covering correctness, naming conventions, and FeatureScript-specific patterns:

| Rule | Severity | Description |
|------|----------|-------------|
| `no-unused-vars` | warning | Variables declared but never referenced |
| `no-undefined-vars` | error | Identifiers used before declaration (heuristic) |
| `missing-export-feature` | warning | `defineFeature` usage without `export` |
| `missing-precondition` | warning | Feature functions (Context, Id, map) without precondition |
| `no-try-silent-fail` | warning | `try()` result discarded silently |
| `no-reserved-keywords` | error | Use of reserved keywords (assert, case, default, do, switch) |
| `enum-naming` | info | Enum values should be `UPPER_SNAKE_CASE` |
| `type-naming` | info | Types should be `PascalCase` |
| `function-naming` | info | Functions should be `camelCase` |
| `no-unknown-stdlib-call` | warning | Function calls that don't match any stdlib symbol (with typo suggestions) |

Configurable via `.featurescriptrc.json`.

### LSP

Language Server Protocol provider powered by `stdlib-data.json` (1197 scraped symbols):

- **Diagnostics** — parse errors + lint violations
- **Hover** — all stdlib functions (with overloads), types, enums, constants
- **Completions** — 695 functions, 87 types, 180 enums, 123 constants + local symbols
- **Go to Definition** — jump to symbol declarations
- **Document Symbols** — outline view of functions, enums, types
- **Signature Help** — parameter hints with overloads for all stdlib functions

### VS Code Extension

- TextMate grammar for syntax highlighting
- LSP client integration
- Language configuration (brackets, comments, auto-close)

## Building

The extension ships as a `.vsix` file — a zip archive containing the extension code, the parser, the LSP server, and the linter. No `vsce` or additional build tools required.

### Build the `.vsix`

```bash
# Install the single runtime dependency (vscode-languageclient)
cd vscode-ext && pnpm install --prod && cd ..

# Package the extension
node vscode-ext/build.mjs
```

Output: `vscode-ext/featurescript-<version>.vsix`

### Install in VS Code

```bash
code --install-extension vscode-ext/featurescript-0.1.0.vsix
```

The build script (`vscode-ext/build.mjs`) does the following:
1. Copies `parser/`, `lsp/`, `linter/` source and `stdlib-data.json` into a staging directory
2. Rewrites the extension entry point to use packaged paths
3. Writes VSIX metadata (`[Content_Types].xml`, `extension.vsixmanifest`)
4. Zips everything into a `.vsix` using system `zip`
5. Cleans up the staging directory

### Oracle (Remote Validation)

Validate FeatureScript files against Onshape's actual compiler:

```bash
# Validate a single file
node oracle/cli.js validate examples/shoe-sole-blank.fs

# Validate all example files
node oracle/cli.js corpus examples

# Regenerate stdlib-data.json from FsDoc
node oracle/scrape-stdlib.js
```

Requires `.oraclerc.json` with Onshape API credentials and document IDs (see `.oraclerc.json.example`).

## Testing

The test suite uses Node.js built-in `node:test` runner with 4 tiers:

| Tier | Coverage | Tests |
|------|----------|-------|
| 1. AST structure | Exact node types, field names, operator precedence | 35 |
| 2. Error detection | Invalid syntax produces errors, error recovery | 4 |
| 3. Corpus | All example `.fs` files parse with 0 errors | 5 |
| 4. AST completeness | Function/lambda bodies fully parsed, not empty stubs | 6 |

```bash
node --test test/parser.test.js test/linter.test.js
```

## Architecture

```
Source (.fs)
  │
  ▼
┌──────────┐     ┌───────────┐     ┌─────────┐
│  Lexer   │────▶│  Parser   │────▶│   AST   │
│ lexer.js │     │ parser.js │     │  ast.js  │
└──────────┘     │ decl.js   │     └────┬────┘
                 │ stmt.js   │          │
                 │ expr.js   │          ▼
                 └───────────┘     ┌─────────┐
                                   │ Visitor  │
                                   │visitor.js│
                                   └────┬────┘
                                        │
                        ┌───────────────┼───────────────┐
                        ▼               ▼               ▼
                   ┌─────────┐    ┌──────────┐    ┌──────────┐
                   │ Linter  │    │   LSP    │    │ VS Code  │
                   │ rules   │    │ server   │    │   ext    │
                   │ engine  │    │ hover    │    │ grammar  │
                   │ cli     │    │ complete │    │ client   │
                   └─────────┘    │ defn     │    └──────────┘
                                  │ symbols  │
                                  └──────────┘
```

## Documentation

See [`docs/`](docs/) for:

- [FeatureScript Language Reference](docs/featurescript-language-reference.md) — complete syntax, semantics, and type system
- [AST Node Reference](docs/ast-node-reference.md) — all node types with field descriptions
- [FeatureScript LLM Writing Guide](docs/featurescript-llm-guide.md) — injectable context for LLMs writing FeatureScript (operator gotchas, validation checklist, stdlib reference)

## Links

- [FeatureScript Documentation](https://cad.onshape.com/FsDoc/)
- [Standard Library Reference](https://cad.onshape.com/FsDoc/library.html)
- [Standard Library Source](https://cad.onshape.com/documents/12312312345abcabcabcdeff)
- [Onshape Custom Features](https://www.onshape.com/en/features/custom-features)
