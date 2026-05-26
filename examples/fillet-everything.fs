FeatureScript 2960;
import(path : "onshape/std/common.fs", version : "2960.0");

annotation { "Feature Type Name" : "Fillet Everything" }
export const filletEverything = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Fillet radius" }
        isLength(definition.filletRadius, BLEND_BOUNDS);
    }
    {
        opFillet(context, id + "fillet1", {
                "entities" : qBodyType(qEverything(EntityType.EDGE), BodyType.SOLID),
                "radius" : definition.filletRadius
        });
    });
