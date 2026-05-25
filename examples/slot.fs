FeatureScript 2096;
import(path : "onshape/std/common.fs", version : "2096.0");

annotation { "Feature Type Name" : "Slot" }
export const slot = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Slot path", "Filter" : EntityType.EDGE, "MaxNumberOfPicks" : 1 }
        definition.slotPath is Query;

        annotation { "Name" : "Part to cut", "Filter" : EntityType.BODY && BodyType.SOLID, "MaxNumberOfPicks" : 1 }
        definition.partToCut is Query;

        annotation { "Name" : "Width" }
        isLength(definition.width, LENGTH_BOUNDS);
    }
    {
        // Extrude the edge as a surface through all
        opExtrude(context, id + "extrude1", {
                "entities" : definition.slotPath,
                "direction" : evOwnerSketchPlane(context, { "entity" : definition.slotPath }).normal,
                "endBound" : BoundingType.THROUGH_ALL,
                "startBound" : BoundingType.THROUGH_ALL
        });

        // Thicken the surface to create the slot body
        opThicken(context, id + "thicken1", {
                "entities" : qCreatedBy(id + "extrude1", EntityType.BODY),
                "thickness1" : definition.width / 2,
                "thickness2" : definition.width / 2
        });

        // Delete the original extruded surface
        opDeleteBodies(context, id + "deleteBodies1", {
                "entities" : qCreatedBy(id + "extrude1", EntityType.BODY)
        });

        // Subtract from the target part
        opBoolean(context, id + "boolean1", {
                "tools" : qCreatedBy(id + "thicken1", EntityType.BODY),
                "targets" : definition.partToCut,
                "operationType" : BooleanOperationType.SUBTRACTION
        });
    });
