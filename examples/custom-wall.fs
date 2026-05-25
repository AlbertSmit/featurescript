FeatureScript 2096;
import(path : "onshape/std/common.fs", version : "2096.0");

// Example from FeatureScript language reference — enums, types, predicates, and functions

export enum WallType
{
    annotation { "Name" : "Straight" }
    STRAIGHT,
    annotation { "Name" : "Tapered" }
    TAPERED,
    annotation { "Name" : "Curved" }
    CURVED
}

export predicate isPositiveLength(val)
{
    val is number;
    val > 0;
}

export function addVectors(a is array, b is array) returns array
{
    var result = [];
    for (var i = 0; i < size(a); i += 1)
    {
        result = append(result, a[i] + b[i]);
    }
    return result;
}

export function dotProduct(a is array, b is array) returns number
{
    var sum = 0;
    for (var i = 0; i < size(a); i += 1)
    {
        sum += a[i] * b[i];
    }
    return sum;
}

// Feature using enum and utility functions
annotation { "Feature Type Name" : "Custom Wall" }
export const customWall = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Wall type" }
        definition.wallType is WallType;

        annotation { "Name" : "Wall height" }
        isLength(definition.height, LENGTH_BOUNDS);

        annotation { "Name" : "Wall thickness" }
        isLength(definition.thickness, LENGTH_BOUNDS);

        annotation { "Name" : "Face to build on", "Filter" : EntityType.FACE, "MaxNumberOfPicks" : 1 }
        definition.face is Query;

        annotation { "Name" : "Apply fillet", "Default" : true }
        definition.applyFillet is boolean;

        annotation { "Name" : "Fillet radius",
                     "UIHint" : UIHint.REMEMBER_PREVIOUS_VALUE }
        if (definition.applyFillet)
        {
            isLength(definition.filletRadius, BLEND_BOUNDS);
        }
    }
    {
        // Get the face plane for sketch
        const facePlane = evFaceTangentPlane(context, {
                "face" : definition.face,
                "parameter" : vector(0.5, 0.5)
        });

        // Start a sketch on the selected face
        var sketch1 = startSketch(context, id + "sketch1", {
                "sketchPlane" : facePlane
        });

        // Draw rectangle based on wall type
        if (definition.wallType == WallType.STRAIGHT)
        {
            sketchRectangle(sketch1, "rect1", {
                    "firstCorner" : vector(-definition.thickness / 2, 0 * meter),
                    "secondCorner" : vector(definition.thickness / 2, definition.height)
            });
        }
        else if (definition.wallType == WallType.TAPERED)
        {
            // Tapered wall — narrower at top
            const halfBase = definition.thickness / 2;
            const halfTop = definition.thickness / 4;

            sketchLine(sketch1, "line1", { "start" : vector(-halfBase, 0 * meter), "end" : vector(halfBase, 0 * meter) });
            sketchLine(sketch1, "line2", { "start" : vector(halfBase, 0 * meter), "end" : vector(halfTop, definition.height) });
            sketchLine(sketch1, "line3", { "start" : vector(halfTop, definition.height), "end" : vector(-halfTop, definition.height) });
            sketchLine(sketch1, "line4", { "start" : vector(-halfTop, definition.height), "end" : vector(-halfBase, 0 * meter) });
        }

        skSolve(sketch1);

        // Extrude the wall
        opExtrude(context, id + "extrude1", {
                "entities" : qSketchRegion(id + "sketch1"),
                "direction" : facePlane.normal,
                "endBound" : BoundingType.BLIND,
                "endDepth" : definition.thickness
        });

        // Optional fillet
        if (definition.applyFillet)
        {
            try
            {
                opFillet(context, id + "fillet1", {
                        "entities" : qCreatedBy(id + "extrude1", EntityType.EDGE),
                        "radius" : definition.filletRadius
                });
            }
            catch (error)
            {
                reportFeatureWarning(context, id, "Fillet could not be applied. Try a smaller radius.");
            }
        }

        // Boolean union with the target body
        const targetBody = qOwnerBody(definition.face);
        if (!isQueryEmpty(context, targetBody))
        {
            opBoolean(context, id + "boolean1", {
                    "tools" : qCreatedBy(id + "extrude1", EntityType.BODY),
                    "targets" : targetBody,
                    "operationType" : BooleanOperationType.UNION
            });
        }
    });
