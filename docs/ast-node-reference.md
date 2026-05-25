# AST Node Reference

Every AST node is a plain JavaScript object with `{ type, ...fields, loc }`.

The `loc` field has the shape:
```json
{
  "start": { "line": 1, "column": 0, "offset": 0 },
  "end":   { "line": 1, "column": 10, "offset": 11 }
}
```

## Program (Root)

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"Program"` | |
| `version` | `string` | FeatureScript version from header (e.g. `"2096"`) |
| `body` | `Node[]` | Top-level declarations |

## Top-Level Declarations

### ImportStatement

```js
{ type: "ImportStatement", namespace: null, path: "\"onshape/std/common.fs\"", version: "\"2096.0\"" }
```

| Field | Type | Description |
|-------|------|-------------|
| `namespace` | `string \| null` | Namespace prefix if namespaced import |
| `path` | `string` | Import path (includes surrounding quotes) |
| `version` | `string` | Version string (includes surrounding quotes) |

### FunctionDeclaration

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Function name |
| `params` | `Parameter[]` | Parameter list |
| `returnType` | `string \| null` | Return type name if `returns` clause present |
| `precondition` | `Precondition \| null` | Precondition block |
| `body` | `BlockStatement` | Function body |
| `exported` | `boolean` | Whether `export` keyword was present |

### PredicateDeclaration

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Predicate name |
| `params` | `Parameter[]` | Parameter list |
| `body` | `BlockStatement` | Predicate body |
| `exported` | `boolean` | |

### EnumDeclaration

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Enum name |
| `values` | `EnumValue[]` | Enum value nodes |
| `exported` | `boolean` | |

### EnumValue

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Value name (e.g. `"STRAIGHT"`) |
| `annotation` | `Annotation \| null` | Preceding annotation |

### TypeDeclaration

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Type name |
| `typecheck` | `string \| null` | Typecheck predicate name |
| `typeconvert` | `string \| null` | Typeconvert function name |
| `exported` | `boolean` | |

### ConstantDeclaration

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Constant name |
| `typeConstraint` | `string \| null` | Type constraint |
| `value` | `Expression` | Initializer expression |

### OperatorOverload

| Field | Type | Description |
|-------|------|-------------|
| `operator` | `string` | Operator symbol (`+`, `-`, `*`, etc.) |
| `params` | `Parameter[]` | Parameter list (1 or 2) |
| `body` | `BlockStatement` | |

### Annotation

| Field | Type | Description |
|-------|------|-------------|
| `value` | `MapLiteral` | Annotation body as map literal |

## Statements

### VariableDeclaration

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Variable name |
| `typeConstraint` | `string \| null` | Type constraint |
| `init` | `Expression \| null` | Initializer |

> Note: Local `const` declarations inside functions produce `ConstantDeclaration` nodes with `init` instead of `value`.

### ExpressionStatement

| Field | Type | Description |
|-------|------|-------------|
| `expression` | `Expression` | The expression |

### BlockStatement

| Field | Type | Description |
|-------|------|-------------|
| `body` | `Statement[]` | List of statements |

### IfStatement

| Field | Type | Description |
|-------|------|-------------|
| `test` | `Expression` | Condition |
| `consequent` | `Statement` | Then branch |
| `alternate` | `Statement \| null` | Else branch (may be another IfStatement for else-if) |

### ForStatement

| Field | Type | Description |
|-------|------|-------------|
| `init` | `VariableDeclaration \| AssignmentStatement` | Initializer |
| `test` | `Expression` | Loop condition |
| `update` | `AssignmentStatement \| ExpressionStatement` | Increment |
| `body` | `Statement` | Loop body |

### ForInStatement

| Field | Type | Description |
|-------|------|-------------|
| `variable` | `string` | Loop variable name |
| `iterable` | `Expression` | Collection to iterate |
| `body` | `Statement` | Loop body |

### WhileStatement

| Field | Type | Description |
|-------|------|-------------|
| `test` | `Expression` | Loop condition |
| `body` | `Statement` | Loop body |

### TryCatchStatement

| Field | Type | Description |
|-------|------|-------------|
| `body` | `BlockStatement` | Try block |
| `param` | `string` | Catch parameter name |
| `handler` | `BlockStatement` | Catch block |

### ReturnStatement

| Field | Type | Description |
|-------|------|-------------|
| `argument` | `Expression \| null` | Return value |

### ThrowStatement

| Field | Type | Description |
|-------|------|-------------|
| `argument` | `Expression` | Thrown value |

### AssignmentStatement

| Field | Type | Description |
|-------|------|-------------|
| `left` | `Expression` | Assignment target |
| `operator` | `string` | Assignment operator (`=`, `+=`, etc.) |
| `right` | `Expression` | Value |

### BreakStatement / ContinueStatement

No additional fields.

### Precondition

| Field | Type | Description |
|-------|------|-------------|
| `body` | `Statement` | Precondition body (usually BlockStatement) |

## Expressions

### Identifier

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Identifier name |

### BuiltinIdentifier

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Builtin name (e.g. `@convert`) |

### Literals

| Node Type | Field | Value Type |
|-----------|-------|------------|
| `NumberLiteral` | `value` | `number` |
| `StringLiteral` | `value` | `string` |
| `BooleanLiteral` | `value` | `boolean` |
| `UndefinedLiteral` | — | — |
| `InfLiteral` | — | — |

### ArrayLiteral

| Field | Type | Description |
|-------|------|-------------|
| `elements` | `Expression[]` | Array elements |

### MapLiteral

| Field | Type | Description |
|-------|------|-------------|
| `entries` | `MapEntry[]` | Key-value pairs |

### MapEntry

| Field | Type | Description |
|-------|------|-------------|
| `key` | `Expression` | Key (usually StringLiteral) |
| `value` | `Expression` | Value |

### BinaryExpression

| Field | Type | Description |
|-------|------|-------------|
| `operator` | `string` | Binary operator |
| `left` | `Expression` | Left operand |
| `right` | `Expression` | Right operand |

### UnaryExpression

| Field | Type | Description |
|-------|------|-------------|
| `operator` | `string` | Unary operator (`-`, `!`) |
| `argument` | `Expression` | Operand |

### TernaryExpression

| Field | Type | Description |
|-------|------|-------------|
| `test` | `Expression` | Condition |
| `consequent` | `Expression` | True branch |
| `alternate` | `Expression` | False branch |

### CallExpression

| Field | Type | Description |
|-------|------|-------------|
| `callee` | `Expression` | Function being called |
| `arguments` | `Expression[]` | Arguments |

### ArrowCallExpression

For `x->f(y, z)`:

| Field | Type | Description |
|-------|------|-------------|
| `callee` | `Identifier` | Function name |
| `object` | `Expression` | First argument (left of `->`) |
| `arguments` | `Expression[]` | Remaining arguments |

### MemberExpression / SafeMemberExpression

| Field | Type | Description |
|-------|------|-------------|
| `object` | `Expression` | Object being accessed |
| `property` | `string` | Property name |

### SubscriptExpression / SafeSubscriptExpression

| Field | Type | Description |
|-------|------|-------------|
| `object` | `Expression` | Object being accessed |
| `index` | `Expression` | Subscript expression |

### BoxAccessExpression / SafeBoxAccessExpression

| Field | Type | Description |
|-------|------|-------------|
| `object` | `Expression` | Box being accessed |

### TypeExpression (`is`)

| Field | Type | Description |
|-------|------|-------------|
| `expression` | `Expression` | Value being checked |
| `typeId` | `string` | Type name |

### CastExpression (`as`)

| Field | Type | Description |
|-------|------|-------------|
| `expression` | `Expression` | Value being cast |
| `typeId` | `string` | Target type name |

### TryExpression

| Field | Type | Description |
|-------|------|-------------|
| `expression` | `Expression` | Expression to try |

### LambdaExpression

| Field | Type | Description |
|-------|------|-------------|
| `params` | `Parameter[]` | Parameter list |
| `precondition` | `Precondition \| null` | Precondition (for defineFeature pattern) |
| `body` | `BlockStatement \| Expression` | Lambda body |

### NewBoxExpression

| Field | Type | Description |
|-------|------|-------------|
| `argument` | `Expression` | Initial box value |

### NamespaceAccess

| Field | Type | Description |
|-------|------|-------------|
| `namespace` | `string` | Namespace name |
| `name` | `string` | Symbol name |

### GroupExpression

| Field | Type | Description |
|-------|------|-------------|
| `expression` | `Expression` | Wrapped expression |

## Parameters

### Parameter

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Parameter name |
| `typeConstraint` | `string \| null` | Type constraint (from `is Type`) |
