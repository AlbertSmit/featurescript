// Test FeatureScript file for linter validation
FeatureScript 2096;
import(path : "onshape/std/common.fs", version : "2096.0");

annotation { "Feature Type Name" : "My Custom Feature" }
export function myCustomFeature(context is Context, id is Id, definition is map)
precondition
{
    annotation { "Name" : "Select face" }
    definition.face is Query;

    annotation { "Name" : "Depth" }
    isLength(definition.depth, LENGTH_BOUNDS);
}
{
    var sketch1 = startSketch(context, id + "sketch1", {
        "sketchPlane" : definition.face
    });

    sketchCircle(sketch1, "circle1", {
        "center" : vector(0, 0) * millimeter,
        "radius" : 10 * millimeter
    });

    skSolve(sketch1);

    var unusedVar = 42;

    opExtrude(context, id + "extrude1", {
        "entities" : qSketchRegion(id + "sketch1"),
        "direction" : evOwnerSketchPlane(context, { "entity" : qSketchRegion(id + "sketch1") }).normal,
        "endBound" : BoundingType.BLIND,
        "endDepth" : definition.depth
    });

    try(riskyOperation(context));
}

function helperFunction(context is Context, id is Id, definition is map)
{
    return undefined;
}

enum myStatus
{
    active,
    inactive,
    pending
}
