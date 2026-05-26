FeatureScript 2960;
import(path : "onshape/std/common.fs", version : "2960.0");

// Demonstrates: export import, multiple enums, predicate-heavy validation,
// precondition with complex annotation keys, arrow call chaining.

export import(path : "onshape/std/units.fs", version : "2960.0");

// ── Multiple enums ──

export enum WallSide
{
    annotation { "Name" : "Interior" }
    INTERIOR,
    annotation { "Name" : "Exterior" }
    EXTERIOR,
    annotation { "Name" : "Both" }
    BOTH
}

export enum SurfaceFinish
{
    SMOOTH,
    TEXTURED,
    RIBBED
}

// ── Predicate for validation ──

export predicate isValidThickness(value)
{
    value is ValueWithUnits;
    value > 0 * millimeter;
    value < 500 * millimeter;
}

export predicate isInRange(value, min is number, max is number)
{
    value is number;
    value >= min;
    value <= max;
}

// ── Utility functions with arrow calls ──

function clampValue(val is number, lo is number, hi is number) returns number
{
    if (val < lo)
    {
        return lo;
    }
    if (val > hi)
    {
        return hi;
    }
    return val;
}

function processValues(arr is array) returns array
{
    var result = [];
    for (var val in arr)
    {
        // Arrow call syntax: val->clampValue(0, 100)
        result = append(result, val->clampValue(0, 100));
    }
    return result;
}

// ── Map construction and member access ──

function buildConfig(side is WallSide, finish is SurfaceFinish) returns map
{
    return {
        "side" : side,
        "finish" : finish,
        "offset" : side == WallSide.BOTH ? 0 * millimeter : 5 * millimeter,
        "hasTexture" : finish != SurfaceFinish.SMOOTH
    };
}

// ── Subscript access ──

function getProperty(config is map, key is string)
{
    return config[key];
}

function setArrayValue(arr is array, index is number, value) returns array
{
    var result = arr;
    result[index] = value;
    return result;
}

// ── Nested map/array construction ──

function buildMatrix() returns array
{
    var matrix = [];
    for (var row = 0; row < 3; row += 1)
    {
        var rowData = [];
        for (var col = 0; col < 3; col += 1)
        {
            rowData = append(rowData, row * 3 + col);
        }
        matrix = append(matrix, rowData);
    }
    return matrix;
}
