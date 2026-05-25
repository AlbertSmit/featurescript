# FeatureScript Language Reference

> Distilled from the [official FeatureScript documentation](https://cad.onshape.com/FsDoc/).
> This document covers the complete language specification relevant to parser/tooling development.

## File Structure

Every FeatureScript file begins with a version header, followed by imports, then top-level declarations:

```featurescript
FeatureScript 2096;

import(path : "onshape/std/common.fs", version : "2096.0");

export function myFeature(context is Context, id is Id, definition is map)
precondition { ... }
{ ... }
```

## Lexical Conventions

**Source**: [tokens.html](https://cad.onshape.com/FsDoc/tokens.html)

### Identifiers

- Initial letter or underscore, followed by alphanumeric or underscore
- Case-sensitive (uppercase reserved for types/constants by convention)
- `@`-prefixed identifiers are runtime builtins (e.g. `@convert`)
- Only 7-bit ASCII in code; unicode only in comments and strings

### Whitespace & Semicolons

- Tab, newline, carriage return are all equivalent whitespace
- Semicolons are **never optional** — always required or never allowed
- Newlines never substitute for semicolons

### Comments

```featurescript
// Line comment
/* Block comment */
```

### String Literals

- Single or double quotes: `"hello"` or `'hello'`
- Escape sequences: `\b`, `\t`, `\n`, `\f`, `\r`
- Unicode: `\u` + 4 hex digits
- Backslash escapes the same quote kind

### Numeric Literals

- Decimal floating point: `42`, `3.14`, `3e9`, `1.44e-3`
- Special value: `inf` (infinity)
- No hex or octal literals
- No `++` or `--` operators

### Keywords

| Category | Keywords |
|----------|----------|
| Top-level | `annotation`, `enum`, `export`, `function`, `import`, `operator`, `precondition`, `predicate`, `returns`, `type`, `typecheck`, `typeconvert` |
| Expressions | `as`, `is`, `new` |
| Statements | `break`, `const`, `continue`, `for`, `in`, `return`, `var`, `while` |
| Literals | `false`, `inf`, `true`, `undefined` |
| Exceptions | `catch`, `throw`, `try` |
| **Reserved** | `assert`, `case`, `default`, `do`, `switch` |

### Operators

**Unary**: `-` (negation), `!` (boolean not), `[]` (box access)

**Binary** (in precedence order, lowest to highest):

| Precedence | Operators | Notes |
|-----------|-----------|-------|
| 1 | `??` | Undefined-coalescing |
| 2 | `\|\|` | Logical OR (short-circuit) |
| 3 | `&&` | Logical AND (short-circuit) |
| 4 | `==`, `!=` | Equality |
| 5 | `<`, `>`, `<=`, `>=` | Comparison |
| 6 | `~` | String concatenation |
| 7 | `+`, `-` | Addition/subtraction |
| 8 | `*`, `/`, `%` | Multiplication/division/modulo |
| 9 | `^` | Exponentiation |

**Assignment**: `=`, `+=`, `-=`, `*=`, `/=`, `^=`, `%=`, `\|\|=`, `&&=`, `??=`, `~=`

**Special**:
- `.` — member access
- `[]` — subscript (array index / map key) or box access (empty brackets)
- `is` — type check (`x is number`)
- `as` — type cast (`x as MyType`)
- `->` — arrow call (`x->f(y)` = `f(x, y)`)
- `::` — namespace access (`ns::symbol`)
- `? :` — ternary conditional

## Types and Values

**Source**: [variables.html](https://cad.onshape.com/FsDoc/variables.html), [type-tags.html](https://cad.onshape.com/FsDoc/type-tags.html)

### Built-in Types

| Type | Examples | Notes |
|------|----------|-------|
| `number` | `42`, `3.14`, `inf` | Always floating point |
| `string` | `"hello"`, `'world'` | Immutable, concatenate with `~` |
| `boolean` | `true`, `false` | |
| `array` | `[1, 2, 3]` | Heterogeneous, 0-indexed |
| `map` | `{ "key" : "value" }` | String keys, any values |
| `function` | `function() { }` | First-class lambdas |
| `undefined` | `undefined` | The "no value" value |

### Type Tags

Custom types are maps with type tags. The `is` operator checks tags, `as` adds/removes them:

```featurescript
// Check type
if (x is Vector) { ... }

// Cast
var v = myMap as Vector;
```

### Boxes

A box is a mutable container holding exactly one value. Created with `new box(value)`, accessed with `[]`:

```featurescript
var b = new box(0);
b[] = 42;        // assign
println(b[]);    // read → 42
```

## Top-Level Constructs

**Source**: [top-level.html](https://cad.onshape.com/FsDoc/top-level.html)

All top-level constructs can be prefixed with `export` to make them visible to importers.

### Imports

Three forms:
```featurescript
// Standard library
import(path : "onshape/std/common.fs", version : "2096.0");

// Tab in current document (path = tab ID)
import(path : "abc123def456abc123def456", version : "auto");

// Tab in another document (path = docId/versionId/tabId)
import(path : "docId/versionId/tabId", version : "microversion");
```

Namespaced import:
```featurescript
myNs::import(path : "onshape/std/math.fs", version : "2096.0");
const PI2 = myNs::PI * 2;
```

### Functions

```featurescript
export function myFn(a is Context, b is number) returns number
{
    return a + b;
}
```

- Parameters optionally typed with `is`
- Optional `returns Type` clause
- Returns `undefined` if no return value

### Predicates

```featurescript
export predicate isPositive(val)
{
    val is number;
    val > 0;
}
```

- Always returns boolean
- Every expression statement must evaluate to true/false
- Fails immediately when any expression is false
- No assignments or side effects allowed
- Used in preconditions and type checks

### Preconditions

Any subroutine can have a precondition between parameters and body:

```featurescript
function sqrt(n is number) returns number
precondition n >= 0;
{ ... }

function makeArray(n is number) returns array
precondition
{
    isInteger(n);
    n > 0;
}
{ ... }
```

Evaluated like a predicate. In feature functions, preconditions define the UI dialog.

### Enumerations

```featurescript
export enum Direction
{
    annotation { "Name" : "Up" }
    UP,
    annotation { "Name" : "Down" }
    DOWN
}
```

- Values accessed as `Direction.UP`
- Internal representation: string `'UP'` with type tag `Direction`

### Custom Types

```featurescript
export type Person typecheck canBePerson;

export predicate canBePerson(value)
{
    value is map;
    value.firstName is string;
    value.age is number;
}
```

### Constants

```featurescript
export const PI = 3.14159265;
export const GRAVITY = 9.81 * meter / second ^ 2;
```

Top-level constants may call functions but cannot contain cycles.

### Operator Overloads

```featurescript
operator*(x is Vector, y is number) { ... }
```

Overloadable: `+`, `-`, `*`, `/`, `%`, `^`, `<`

### Lambda Functions

```featurescript
// function keyword form
const zero = function() { return 0; };

// Arrow form
const doubled = (val) => val * 2;
const add = (a is number, b is number) => a + b;
```

## Statements

**Source**: [syntax.html](https://cad.onshape.com/FsDoc/syntax.html)

### Variable / Constant Declaration

```featurescript
var x;                          // uninitialized (undefined)
var y = 0;                      // with initializer
var z is Vector = vector(0, 0); // with type constraint + initializer
const ONE = 1;                  // constant (immutable)
```

### Assignment

```featurescript
a = 1;
b.c = false;        // map field
b['c'] = false;     // same as above
d[] = 0;             // box assignment
e[0] = 0;            // array/map subscript
a += 1;  a -= 1;     // compound assignment
```

### If / Else

```featurescript
if (condition)
{
    ...
}
else if (other)
{
    ...
}
else
{
    ...
}
```

### While Loop

```featurescript
while (!done)
{
    x += 1;
    done = f(x);
}
```

### For Loop

```featurescript
for (var i = 0; i < 10; i += 1)
{
    f(i);
}
```

The increment must be an assignment or function call. No `++`/`--`.

### For-In Loop

```featurescript
// Array iteration
for (var item in myArray) { ... }

// Two-variable form (key/index + value)
for (var key, value in myMap) { ... }

// Without var (reuses existing variable)
for (item in myArray) { ... }
```

### Try / Catch / Throw

```featurescript
try
{
    riskyOperation();
}
catch (error)
{
    handleError(error);
}

throw "Something went wrong";
throw regenError("Bad input", ["faultyField"]);
```

### Try Expression

```featurescript
var result = try(riskyCall());  // returns undefined on exception
```

### Break / Continue / Return

```featurescript
break;
continue;
return;
return value;
```

## Expression Types

### Arrow Call Syntax

```featurescript
// These are equivalent:
x->f(y, z)
f(x, y, z)

// Chaining:
myArray->max()->clamp(0, 1)->roundToPrecision(5)
// equivalent to: roundToPrecision(clamp(max(myArray), 0, 1), 5)
```

### Namespace Access

```featurescript
myNamespace::symbolName
```

### Container Access

```featurescript
x[1]      // array index or map key
x.y       // map access (equivalent to x['y'])
x[]       // box access
x.y.z     // chained access
```

## Annotations

**Source**: [annotations.html](https://cad.onshape.com/FsDoc/annotations.html)

Annotations are metadata attached to declarations and enum values. They define feature UI elements:

```featurescript
annotation { "Feature Type Name" : "Slot", "Feature Type Description" : "Creates a slot" }
export const slot = defineFeature(function(context is Context, id is Id, definition is map)
  precondition
  {
    annotation { "Name" : "Slot path", "Filter" : EntityType.EDGE }
    definition.slotPath is Query;

    annotation { "Name" : "Slot width" }
    isLength(definition.slotWidth, LENGTH_BOUNDS);
  }
  { ... });
```

## The `defineFeature` Pattern

This is the canonical way to define custom features in FeatureScript. It's a constant declaration whose value is a `defineFeature()` call with a function expression argument:

```featurescript
annotation { "Feature Type Name" : "My Feature" }
export const myFeature = defineFeature(function(context is Context, id is Id, definition is map)
  precondition
  {
      // UI parameter definitions go here
      annotation { "Name" : "Select faces" }
      definition.faces is Query;
  }
  {
      // Feature body goes here
      opExtrude(context, id + "extrude1", {
          "entities" : qCreatedBy(id + "sketch", EntityType.BODY),
          "direction" : evOwnerSketchPlane(context, { "entity" : definition.faces }).normal,
          "endBound" : BoundingType.BLIND,
          "endDepth" : 10 * millimeter
      });
  });
```

The three parameters are always: `context is Context`, `id is Id`, `definition is map`.

## External References

| Resource | URL |
|----------|-----|
| FeatureScript Introduction | https://cad.onshape.com/FsDoc/ |
| Tutorials | https://cad.onshape.com/FsDoc/tutorials/create-a-slot-feature.html |
| Standard Library Docs | https://cad.onshape.com/FsDoc/library.html |
| Standard Library Source | https://cad.onshape.com/documents/12312312345abcabcabcdeff |
| Lexical Conventions | https://cad.onshape.com/FsDoc/tokens.html |
| Top-Level Constructs | https://cad.onshape.com/FsDoc/top-level.html |
| Syntax and Semantics | https://cad.onshape.com/FsDoc/syntax.html |
| Types and Type Tags | https://cad.onshape.com/FsDoc/type-tags.html |
| Annotations | https://cad.onshape.com/FsDoc/annotations.html |
| Exception Handling | https://cad.onshape.com/FsDoc/exceptions.html |
| Feature UI Spec | https://cad.onshape.com/FsDoc/uispec.html |
| Modeling | https://cad.onshape.com/FsDoc/modeling.html |
| Custom Features Gallery | https://www.onshape.com/en/features/custom-features |
