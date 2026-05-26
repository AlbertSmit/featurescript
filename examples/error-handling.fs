FeatureScript 2960;
import(path : "onshape/std/common.fs", version : "2960.0");

// Demonstrates: try/catch, try expression, throw, error recovery,
// undefined coalescing (??), compound assignment, while loops.

function safeDivide(a is number, b is number) returns number
{
    if (b == 0)
    {
        throw "Division by zero";
    }
    return a / b;
}

function processWithFallback(context is Context, id is Id, query is Query)
{
    var result = try(evLength(context, { "entities" : query }));
    const length = result ?? 0 * meter;

    if (length == 0 * meter)
    {
        reportFeatureWarning(context, id, "Could not evaluate length, using fallback");
    }

    try
    {
        opExtrude(context, id + "extrude", {
            "entities" : query,
            "direction" : vector(0, 0, 1),
            "endBound" : BoundingType.BLIND,
            "endDepth" : length
        });
    }
    catch (error)
    {
        reportFeatureError(context, id, "Extrude failed: " ~ toString(error));
        throw regenError("Operation failed", ["entities"]);
    }
}

// ── Compound assignment operators ──

function compoundOps()
{
    var x = 10;
    x += 5;
    x -= 3;
    x *= 2;
    x /= 4;
    x ^= 2;

    var s = "hello";
    s ~= " world";

    var flag = true;
    flag &&= false;
    flag ||= true;

    var maybe = undefined;
    maybe ??= 42;
}

// ── While loop with break/continue ──

function iterativeSearch(arr is array) returns number
{
    var i = 0;
    var found = -1;

    while (i < size(arr))
    {
        if (arr[i] == undefined)
        {
            i += 1;
            continue;
        }

        if (arr[i] > 100)
        {
            found = i;
            break;
        }

        i += 1;
    }

    return found;
}

// ── Nested if/else chains ──

function classify(value is number) returns string
{
    if (value < 0)
    {
        return "negative";
    }
    else if (value == 0)
    {
        return "zero";
    }
    else if (value < 1)
    {
        return "fractional";
    }
    else
    {
        return "positive integer or greater";
    }
}
