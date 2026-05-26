FeatureScript 2960;
import(path : "onshape/std/common.fs", version : "2960.0");

// Demonstrates: for-in loops, map manipulation, array operations,
// try expressions, box types, and lambda functions

export function filterQueries(context is Context, queries is array) returns array
{
    var result = [];
    for (var query in queries)
    {
        if (!isQueryEmpty(context, query))
        {
            result = append(result, query);
        }
    }
    return result;
}

export function createTransformMap(angle is ValueWithUnits, axis is Line) returns map
{
    return {
        "rotation" : rotationAround(axis, angle),
        "translation" : vector(0, 0, 0) * meter
    };
}

export function safeEval(context is Context, query is Query)
{
    const result = try(evVertexPoint(context, { "vertex" : query }));
    if (result != undefined)
    {
        println("Vertex point: " ~ toString(result));
    }
    else
    {
        println("Could not evaluate vertex");
    }
}

// Pattern feature using for loop with counter
annotation { "Feature Type Name" : "Custom Pattern" }
export const customPattern = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Bodies to pattern", "Filter" : EntityType.BODY && BodyType.SOLID }
        definition.bodies is Query;

        annotation { "Name" : "Number of copies" }
        isInteger(definition.count, { (unitless) : [2, 5, 100] } as IntegerBoundSpec);

        annotation { "Name" : "Spacing" }
        isLength(definition.spacing, LENGTH_BOUNDS);

        annotation { "Name" : "Direction", "Filter" : EntityType.EDGE, "MaxNumberOfPicks" : 1 }
        definition.direction is Query;
    }
    {
        // Get direction vector from the selected edge
        const edgeLine = evEdgeTangentLine(context, {
                "edge" : definition.direction,
                "parameter" : 0.5
        });

        const dirVector = edgeLine.direction;

        // Create copies
        for (var i = 1; i < definition.count; i += 1)
        {
            const offset = dirVector * definition.spacing * i;

            opTransform(context, id + "transform" ~ i, {
                    "bodies" : definition.bodies,
                    "transform" : transform(offset)
            });
        }

        // Merge all copies with original
        const allBodies = qCreatedBy(id, EntityType.BODY);
        if (!isQueryEmpty(context, allBodies))
        {
            try
            {
                opBoolean(context, id + "merge", {
                        "tools" : allBodies,
                        "operationType" : BooleanOperationType.UNION
                });
            }
            catch (e)
            {
                reportFeatureInfo(context, id, "Bodies could not be merged — they may not overlap.");
            }
        }
    });
