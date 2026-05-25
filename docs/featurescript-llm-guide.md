# FeatureScript — LLM Writing Guide

> Inject this document as context when asking an LLM to write FeatureScript code.
> It contains the rules, patterns, and common mistakes that language models need
> to produce valid, idiomatic FeatureScript for Onshape.

## What Is FeatureScript

FeatureScript is Onshape's CAD modeling language. It looks like JavaScript but has critical differences. Code runs inside a Part Studio to create 3D geometry. Every custom feature is a function that receives a `context` (the model state), an `id` (operation namespace), and a `definition` (user parameters).

## File Structure

Every file starts with a version header, then imports, then declarations:

```featurescript
FeatureScript 2096;

import(path : "onshape/std/common.fs", version : "2096.0");

// ... declarations
```

**Rules**:
- The version header is REQUIRED. Without `FeatureScript <number>;` the file won't compile.
- Import paths use `path :` and `version :` with COLON syntax (not `=`).
- Standard library import: `import(path : "onshape/std/common.fs", version : "2096.0");`

## The `defineFeature` Pattern

This is the ONLY correct way to define a custom feature:

```featurescript
annotation { "Feature Type Name" : "My Feature" }
export const myFeature = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Select faces" }
        definition.faces is Query;

        annotation { "Name" : "Depth" }
        isLength(definition.depth, LENGTH_BOUNDS);
    }
    {
        // Feature body — geometry operations go here
        opExtrude(context, id + "extrude1", {
            "entities" : definition.faces,
            "direction" : evPlane(context, { "face" : definition.faces }).normal,
            "endBound" : BoundingType.BLIND,
            "endDepth" : definition.depth
        });
    });
```

**Rules**:
- The three parameters are ALWAYS `context is Context, id is Id, definition is map`. No exceptions.
- `precondition` block defines the UI. Each parameter needs an `annotation` and a type assertion.
- The body block comes AFTER the precondition block — both are inside the SAME function.
- The entire thing is a `const` declaration with `defineFeature(function(...) precondition {} {})`.
- The annotation `"Feature Type Name"` MUST appear before `export const`.

## ⚠️ Critical Operator Differences from JavaScript

| What you want | FeatureScript | NOT this (JavaScript) |
|---------------|---------------|----------------------|
| String concatenation | `"a" ~ "b"` | ~~`"a" + "b"`~~ |
| Exponentiation | `x ^ 2` | ~~`x ** 2`~~ or ~~`Math.pow(x, 2)`~~ |
| Increment | `x += 1` | ~~`x++`~~ or ~~`++x`~~ |
| Decrement | `x -= 1` | ~~`x--`~~ or ~~`--x`~~ |
| Undefined coalescing | `x ?? fallback` | same |
| Type check | `x is number` | ~~`typeof x === 'number'`~~ |
| Type cast | `x as MyType` | ~~`(MyType)x`~~ |
| Arrow call | `x->f(y)` = `f(x, y)` | different meaning than `=>` |
| Namespace | `std::PI` | ~~`std.PI`~~ |
| Box access | `b[]` | no equivalent |
| Boolean NOT | `!x` | same |
| Modulo sign | sign of SECOND operand | sign of first (JS) |

## ⚠️ Things That Don't Exist in FeatureScript

- **No `let`** — use `var` (mutable) or `const` (immutable)
- **No `class`** — use `type` declarations with typecheck predicates
- **No `this`** — functions receive all state as arguments
- **No `===`** — use `==` (FeatureScript has no type coercion)
- **No `null`** — use `undefined`
- **No `console.log`** — use `println()` or `debug(context, ...)` for Part Studio debugging
- **No `async/await`** — everything is synchronous
- **No template literals** — use `~` for concatenation: `"value: " ~ toString(x)`
- **No destructuring** — access map fields with `.` notation
- **No spread operator** — use `mergeMaps()` to combine maps
- **No modules/require** — use `import(path : ..., version : ...);`
- **No `switch/case`** — these are RESERVED keywords that will error. Use if/else chains.
- **No `++` / `--`** — these DO NOT EXIST. Use `+= 1` / `-= 1`.

## Types and Values

### Built-in Types
- `number` — always floating point, no integers
- `string` — immutable, single or double quotes
- `boolean` — `true` / `false`
- `array` — heterogeneous: `[1, "two", true]`
- `map` — string-keyed: `{ "key" : value }` (note the COLON, not `=`)
- `undefined` — the absence of a value
- `function` — first-class lambdas

### Units (ValueWithUnits)
FeatureScript uses dimensional analysis. Numbers with units are NOT plain numbers:

```featurescript
// CORRECT
var length = 10 * millimeter;
var area = length * length;  // result has area units

// WRONG — raw numbers are unitless
var length = 10;  // This is just the number 10, not a length
```

Common units: `millimeter`, `centimeter`, `meter`, `inch`, `foot`, `degree`, `radian`, `second`, `kilogram`.

### Queries
Queries select geometry. They are lazy — they describe WHAT to find, not the result:

```featurescript
// Select all bodies created by an operation
qCreatedBy(id + "extrude1", EntityType.BODY)

// Select specific entity types
qEntityFilter(query, EntityType.FACE)

// Combine queries
qUnion([query1, query2])

// Everything in the model
qEverything(EntityType.BODY)
```

## Common Operation Patterns

### Sketch → Extrude

```featurescript
// 1. Create a sketch
var sketchPlane = evPlane(context, { "face" : definition.face });
var sketch1 = newSketchOnPlane(context, id + "sketch1", { "sketchPlane" : sketchPlane });

// 2. Draw geometry
skCircle(sketch1, "circle1", {
    "center" : vector(0, 0) * millimeter,
    "radius" : definition.radius
});

// 3. Solve the sketch
skSolve(sketch1);

// 4. Extrude
opExtrude(context, id + "extrude1", {
    "entities" : qSketchRegion(id + "sketch1"),
    "direction" : sketchPlane.normal,
    "endBound" : BoundingType.BLIND,
    "endDepth" : definition.depth
});
```

### Boolean Operations

```featurescript
// Union (merge bodies)
opBoolean(context, id + "boolean1", {
    "tools" : qCreatedBy(id + "extrude1", EntityType.BODY),
    "targets" : definition.targetBody,
    "operationType" : BooleanOperationType.UNION
});

// Subtraction (cut)
opBoolean(context, id + "cut1", {
    "tools" : toolBody,
    "targets" : targetBody,
    "operationType" : BooleanOperationType.SUBTRACTION
});
```

### Fillets and Chamfers

```featurescript
opFillet(context, id + "fillet1", {
    "entities" : qCreatedBy(id + "extrude1", EntityType.EDGE),
    "radius" : 2 * millimeter
});
```

### Error Handling

```featurescript
// try expression — returns undefined on failure
var result = try(opBoolean(context, id + "bool", options));
if (result == undefined)
{
    // Fallback logic
}

// try/catch statement
try
{
    opFillet(context, id + "fillet", { "entities" : edges, "radius" : radius });
}
catch (error)
{
    // Fillet failed, skip it
}
```

## Map Literals — COLON Syntax

FeatureScript maps use ` : ` (space-colon-space), NOT JavaScript's `:` or `=`:

```featurescript
// CORRECT
{ "entities" : query, "direction" : normal }

// WRONG (JavaScript object shorthand)
{ entities: query, direction: normal }
// ^ This actually WORKS for unquoted keys, but string keys with : are canonical
```

All operation functions use map arguments with QUOTED STRING KEYS.

## ID Management

Every operation needs a unique ID to track what it created:

```featurescript
// IDs are built by concatenation with +
id + "sketch1"
id + "extrude1"
id + "fillet1"

// NEVER reuse an ID — each operation must have a unique one
// WRONG:
opExtrude(context, id + "op1", ...);
opFillet(context, id + "op1", ...);  // COLLISION!

// RIGHT:
opExtrude(context, id + "extrude1", ...);
opFillet(context, id + "fillet1", ...);
```

## For Loops

```featurescript
// Standard for loop (no ++!)
for (var i = 0; i < count; i += 1)
{
    doSomething(i);
}

// For-in loop (iterate array)
for (var item in myArray)
{
    process(item);
}

// For-in with key and value
for (var key, value in myMap)
{
    println(key ~ " = " ~ toString(value));
}
```

## Predicate Declarations

Predicates are constraint functions that return boolean. Used for type checking and parameter validation:

```featurescript
export predicate isValidAngle(val)
{
    val is number;
    val >= 0;
    val <= 360;
}
```

Every expression statement in a predicate must evaluate to `true` or `false`. The predicate fails (returns false) the moment any statement evaluates to `false`.

## Enum Declarations

```featurescript
export enum ShapeType
{
    annotation { "Name" : "Circle" }
    CIRCLE,
    annotation { "Name" : "Rectangle" }
    RECTANGLE,
    annotation { "Name" : "Hexagon" }
    HEXAGON
}
```

Access with: `ShapeType.CIRCLE`. Enum values are UPPER_SNAKE_CASE by convention.

## Annotations

Annotations go BEFORE the thing they annotate:

```featurescript
// Feature type annotation
annotation { "Feature Type Name" : "My Feature" }
export const myFeature = defineFeature(...);

// Parameter annotation (inside precondition)
annotation { "Name" : "Width" }
isLength(definition.width, LENGTH_BOUNDS);

// Enum value annotation
annotation { "Name" : "Top" }
TOP,

// Parameter with filter
annotation { "Name" : "Select edges", "Filter" : EntityType.EDGE }
definition.edges is Query;
```

## Validation Checklist

Before considering FeatureScript code complete, verify:

1. ✅ File starts with `FeatureScript <version>;`
2. ✅ Imports use `import(path : "...", version : "...");`
3. ✅ No `++`, `--`, `let`, `class`, `===`, `null`, `switch`, `case`
4. ✅ String concatenation uses `~`, not `+`
5. ✅ Exponentiation uses `^`, not `**`
6. ✅ All operation IDs are unique (no `id + "same"` twice)
7. ✅ Map literals use `"key" : value` with string keys
8. ✅ Length values have units: `10 * millimeter`, not bare `10`
9. ✅ Feature function signature is `(context is Context, id is Id, definition is map)`
10. ✅ Precondition block has annotations for each UI parameter
11. ✅ Boolean operations specify `"operationType"`
12. ✅ For loops use `i += 1`, not `i++`
13. ✅ `toString()` used when concatenating numbers with strings

## Stdlib Quick Reference

### Geometry Evaluation
| Function | Returns | Use |
|----------|---------|-----|
| `evPlane(context, {...})` | `Plane` | Get plane from face |
| `evLength(context, {...})` | `ValueWithUnits` | Measure edge length |
| `evDistance(context, {...})` | `DistanceResult` | Distance between entities |
| `evBox3d(context, {...})` | `Box3d` | Bounding box |
| `evOwnerSketchPlane(context, {...})` | `Plane` | Sketch plane of entity |
| `evSurfaceNormal(context, {...})` | `Vector` | Normal vector at point on face |

### Sketch Functions
| Function | Use |
|----------|-----|
| `newSketchOnPlane(context, id, {...})` | Create sketch on plane |
| `newSketch(context, id, {...})` | Create sketch on face |
| `skCircle(sketch, id, {...})` | Draw circle |
| `skRectangle(sketch, id, {...})` | Draw rectangle |
| `skLineSegment(sketch, id, {...})` | Draw line |
| `skArc(sketch, id, {...})` | Draw arc |
| `skSolve(sketch)` | Solve sketch constraints |

### Operations
| Function | Use |
|----------|-----|
| `opExtrude(context, id, {...})` | Linear extrusion |
| `opRevolve(context, id, {...})` | Revolution |
| `opSweep(context, id, {...})` | Sweep along path |
| `opLoft(context, id, {...})` | Loft between profiles |
| `opFillet(context, id, {...})` | Fillet edges |
| `opChamfer(context, id, {...})` | Chamfer edges |
| `opBoolean(context, id, {...})` | Boolean operations |
| `opPattern(context, id, {...})` | Linear/circular pattern |
| `opTransform(context, id, {...})` | Transform bodies |
| `opDeleteBodies(context, id, {...})` | Delete bodies |

### Math
| Function | Use |
|----------|-----|
| `vector(x, y)` / `vector(x, y, z)` | Create 2D/3D vector |
| `norm(v)` | Vector magnitude |
| `normalize(v)` | Unit vector |
| `cross(a, b)` | Cross product |
| `dot(a, b)` | Dot product |
| `abs(x)` | Absolute value |
| `sin(x)` / `cos(x)` / `tan(x)` | Trig (radians) |
| `sqrt(x)` | Square root |
| `floor(x)` / `ceil(x)` / `round(x)` | Rounding |

### Query Functions
| Function | Use |
|----------|-----|
| `qCreatedBy(id, EntityType)` | Entities created by operation |
| `qSketchRegion(id)` | Sketch regions |
| `qEntityFilter(query, EntityType)` | Filter by entity type |
| `qUnion(queries[])` | Combine queries |
| `qSubtraction(from, subtract)` | Subtract queries |
| `qNthElement(query, n)` | Select nth element |
| `qEverything(EntityType)` | All entities of type |
| `qOwnedByBody(query, EntityType)` | Sub-entities of bodies |

### Parameter Validation
| Function | Use |
|----------|-----|
| `isLength(val, bounds)` | Length parameter |
| `isAngle(val, bounds)` | Angle parameter |
| `isInteger(val, bounds)` | Integer parameter |
| `isReal(val, bounds)` | Real number parameter |

### Bounds Constants
`LENGTH_BOUNDS`, `ANGLE_360_BOUNDS`, `POSITIVE_COUNT_BOUNDS`, `POSITIVE_REAL_BOUNDS`
