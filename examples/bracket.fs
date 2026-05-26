FeatureScript 2960;
import(path : "onshape/std/common.fs", version : "2960.0");
import(path : "onshape/std/transform.fs", version : "2960.0");

// Demonstrates: full sketch-to-solid workflow, map literals in op calls,
// query chaining, multiple sequential operations, id concatenation.

annotation { "Feature Type Name" : "Bracket" }
export const bracket = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Mounting face", "Filter" : GeometryType.PLANE, "MaxNumberOfPicks" : 1 }
        definition.mountFace is Query;

        annotation { "Name" : "Width" }
        isLength(definition.width, LENGTH_BOUNDS);

        annotation { "Name" : "Height" }
        isLength(definition.height, LENGTH_BOUNDS);

        annotation { "Name" : "Thickness" }
        isLength(definition.thickness, LENGTH_BOUNDS);

        annotation { "Name" : "Fillet radius" }
        isLength(definition.filletRadius, LENGTH_BOUNDS);

        annotation { "Name" : "Number of holes" }
        isInteger(definition.holeCount, POSITIVE_COUNT_BOUNDS);

        annotation { "Name" : "Hole diameter" }
        isLength(definition.holeDiameter, LENGTH_BOUNDS);
    }
    {
        // ── Base plate sketch ──
        const mountPlane = evFaceTangentPlane(context, {
            "face" : definition.mountFace,
            "parameter" : vector(0.5, 0.5)
        });

        var sketch1 = startSketch(context, id + "baseSketch", {
            "sketchPlane" : mountPlane
        });

        const halfW = definition.width / 2;
        const halfH = definition.height / 2;

        sketchRectangle(sketch1, "rect", {
            "firstCorner" : vector(-halfW, -halfH),
            "secondCorner" : vector(halfW, halfH)
        });

        skSolve(sketch1);

        // ── Extrude base plate ──
        opExtrude(context, id + "extrudeBase", {
            "entities" : qSketchRegion(id + "baseSketch"),
            "direction" : mountPlane.normal,
            "endBound" : BoundingType.BLIND,
            "endDepth" : definition.thickness
        });

        // ── Fillet edges ──
        const baseBody = qCreatedBy(id + "extrudeBase", EntityType.BODY);
        const edges = qCreatedBy(id + "extrudeBase", EntityType.EDGE);

        if (definition.filletRadius > 0 * millimeter)
        {
            opFillet(context, id + "fillet", {
                "entities" : edges,
                "radius" : definition.filletRadius
            });
        }

        // ── Hole pattern ──
        const spacing = definition.width / (definition.holeCount + 1);

        for (var i = 0; i < definition.holeCount; i += 1)
        {
            const xPos = -halfW + spacing * (i + 1);
            const holeId = "hole" ~ toString(i);

            var holeSketch = startSketch(context, id + holeId + "sketch", {
                "sketchPlane" : mountPlane
            });

            sketchCircle(holeSketch, "circle", {
                "center" : vector(xPos, 0 * millimeter),
                "radius" : definition.holeDiameter / 2
            });

            skSolve(holeSketch);

            opExtrude(context, id + holeId + "cut", {
                "entities" : qSketchRegion(id + holeId + "sketch"),
                "direction" : mountPlane.normal,
                "endBound" : BoundingType.THROUGH_ALL,
                "operationType" : NewBodyOperationType.REMOVE
            });
        }

        // ── Report ──
        const volume = evVolume(context, { "entities" : baseBody });
        reportFeatureInfo(context, id, "Bracket volume: " ~ toString(volume));
    });
