FeatureScript 2960;
import(path : "onshape/std/common.fs", version : "2960.0");
import(path : "onshape/std/math.fs", version : "2960.0");

// Demonstrates: arrow calls, string concatenation, ternary, box access,
// for-in loops, type declarations, predicates, operator overloads, lambdas.

// ── Custom type with typecheck predicate ──

export type Interval typecheck canBeInterval;

export predicate canBeInterval(value)
{
    value is map;
    value.min is number;
    value.max is number;
    value.min <= value.max;
}

// ── Operator overload ──

operator+(a is Interval, b is Interval) returns Interval
{
    return { "min" : a.min + b.min, "max" : a.max + b.max } as Interval;
}

// ── Constants ──

export const TOLERANCE = 0.001 * millimeter;
export const MAX_ITERATIONS = 100;

// ── Enum with annotated values ──

export enum FitType
{
    annotation { "Name" : "Clearance" }
    CLEARANCE,
    annotation { "Name" : "Transition" }
    TRANSITION,
    annotation { "Name" : "Interference" }
    INTERFERENCE
}

// ── Helper using arrow call syntax and string concat ──

function describeFit(fitType is FitType, gap is ValueWithUnits) returns string
{
    const label = fitType == FitType.CLEARANCE ? "Loose" :
                  fitType == FitType.INTERFERENCE ? "Tight" : "Sliding";
    return label ~ " fit: " ~ toString(gap);
}

// ── Box usage ──

function accumulate(values is array) returns number
{
    var total = new box(0);
    for (var v in values)
    {
        total[] = total[] + v;
    }
    return total[];
}

// ── For-in with key, value ──

function mergeDefaults(userMap is map, defaults is map) returns map
{
    var result = defaults;
    for (var key, value in userMap)
    {
        result[key] = value;
    }
    return result;
}

// ── Lambda / function expression ──

function applyToAll(arr is array, fn) returns array
{
    var result = [];
    for (var item in arr)
    {
        result = append(result, fn(item));
    }
    return result;
}

const doubled = function(x) { return x * 2; };

// ── Arrow lambda (=>) ──

const tripled = (x) => x * 3;

// ── Namespace-qualified usage ──

// myNs::import(path : "onshape/std/units.fs", version : "2960.0");

// ── Feature using defineFeature ──

annotation { "Feature Type Name" : "Tolerance Check" }
export const toleranceCheck = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Target body" }
        definition.target is Query;

        annotation { "Name" : "Fit type" }
        definition.fitType is FitType;

        annotation { "Name" : "Nominal gap" }
        isLength(definition.gap, LENGTH_BOUNDS);
    }
    {
        const info = describeFit(definition.fitType, definition.gap);
        reportFeatureInfo(context, id, info);

        if (definition.gap < TOLERANCE)
        {
            reportFeatureWarning(context, id, "Gap is below manufacturing tolerance");
        }
    });
