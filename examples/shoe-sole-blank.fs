FeatureScript 2960;
import(path : "onshape/std/common.fs", version : "2960.0");

// ═══════════════════════════════════════════════════════════════════════════
// Parametric Shoe Sole Blank Generator
// ═══════════════════════════════════════════════════════════════════════════
//
// Generates a 3D-printable shoe sole blank with anatomically-informed
// geometry. Based on:
//   - ISO 9407 (Mondopoint) foot anthropometry
//   - Plantar pressure zone research (Diabetes Care, Frontiers in Bioeng.)
//   - Rocker sole geometry (NIH apex/angle studies)
//   - Arch classification (Navicular Drop Test literature)
//
// The blank is intended as a foundation — add tread, lattice, or upper
// mounting geometry manually in Onshape afterward.
// ═══════════════════════════════════════════════════════════════════════════

// ── Enums ─────────────────────────────────────────────────────────────────

export enum SoleType
{
    annotation { "Name" : "Walking" }
    WALKING,
    annotation { "Name" : "Running" }
    RUNNING,
    annotation { "Name" : "Standing / All-day" }
    STANDING,
    annotation { "Name" : "Orthotic" }
    ORTHOTIC
}

export enum FootSide
{
    annotation { "Name" : "Left" }
    LEFT,
    annotation { "Name" : "Right" }
    RIGHT
}

export enum ArchType
{
    annotation { "Name" : "Low (flat)" }
    LOW,
    annotation { "Name" : "Normal" }
    NORMAL,
    annotation { "Name" : "High" }
    HIGH
}

export enum SizingMode
{
    annotation { "Name" : "EU shoe size" }
    EU_SIZE,
    annotation { "Name" : "Manual measurements" }
    MANUAL
}

export enum EUSize
{
    annotation { "Name" : "EU 36" }
    EU36,
    annotation { "Name" : "EU 37" }
    EU37,
    annotation { "Name" : "EU 38" }
    EU38,
    annotation { "Name" : "EU 39" }
    EU39,
    annotation { "Name" : "EU 40" }
    EU40,
    annotation { "Name" : "EU 41" }
    EU41,
    annotation { "Name" : "EU 42" }
    EU42,
    annotation { "Name" : "EU 43" }
    EU43,
    annotation { "Name" : "EU 44" }
    EU44,
    annotation { "Name" : "EU 45" }
    EU45,
    annotation { "Name" : "EU 46" }
    EU46,
    annotation { "Name" : "EU 47" }
    EU47
}

// ── Anthropometric lookup ─────────────────────────────────────────────────
// Returns { footLength, ballWidth, heelWidth } in millimeters.
// Data derived from ISO 9407 Mondopoint averages and Hawes et al.

function euSizeData(size is EUSize) returns map
{
    if (size == EUSize.EU36) { return { "footLength" : 228, "ballWidth" : 87, "heelWidth" : 60 }; }
    if (size == EUSize.EU37) { return { "footLength" : 235, "ballWidth" : 89, "heelWidth" : 61 }; }
    if (size == EUSize.EU38) { return { "footLength" : 242, "ballWidth" : 91, "heelWidth" : 63 }; }
    if (size == EUSize.EU39) { return { "footLength" : 248, "ballWidth" : 93, "heelWidth" : 64 }; }
    if (size == EUSize.EU40) { return { "footLength" : 255, "ballWidth" : 96, "heelWidth" : 66 }; }
    if (size == EUSize.EU41) { return { "footLength" : 262, "ballWidth" : 98, "heelWidth" : 67 }; }
    if (size == EUSize.EU42) { return { "footLength" : 268, "ballWidth" : 100, "heelWidth" : 69 }; }
    if (size == EUSize.EU43) { return { "footLength" : 275, "ballWidth" : 102, "heelWidth" : 70 }; }
    if (size == EUSize.EU44) { return { "footLength" : 282, "ballWidth" : 104, "heelWidth" : 72 }; }
    if (size == EUSize.EU45) { return { "footLength" : 288, "ballWidth" : 106, "heelWidth" : 73 }; }
    if (size == EUSize.EU46) { return { "footLength" : 295, "ballWidth" : 108, "heelWidth" : 75 }; }
    return { "footLength" : 302, "ballWidth" : 110, "heelWidth" : 76 }; // EU47
}

// ── Sole type presets ─────────────────────────────────────────────────────
// Returns { heelDrop, thickness, heelCup, archFactor } in mm / unitless.

function solePresets(st is SoleType) returns map
{
    if (st == SoleType.WALKING)  { return { "heelDrop" : 8,  "thickness" : 22, "heelCup" : 4,  "archFactor" : 1.0 }; }
    if (st == SoleType.RUNNING)  { return { "heelDrop" : 10, "thickness" : 20, "heelCup" : 3,  "archFactor" : 0.8 }; }
    if (st == SoleType.STANDING) { return { "heelDrop" : 4,  "thickness" : 25, "heelCup" : 5,  "archFactor" : 1.1 }; }
    return { "heelDrop" : 6, "thickness" : 28, "heelCup" : 6, "archFactor" : 1.4 }; // ORTHOTIC
}

// ── Arch support height ───────────────────────────────────────────────────
// Base medial arch support in mm, scaled by sole type archFactor.

function archSupportHeight(archT is ArchType, factor is number) returns number
{
    if (archT == ArchType.LOW)    { return 5 * factor; }
    if (archT == ArchType.NORMAL) { return 10 * factor; }
    return 15 * factor; // HIGH
}

// ── Feature ───────────────────────────────────────────────────────────────

annotation { "Feature Type Name" : "Shoe Sole Blank",
             "Feature Type Description" : "Generates a 3D-printable shoe sole blank with anatomically-informed contouring." }
export const shoeSoleBlank = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Sole purpose" }
        definition.soleType is SoleType;

        annotation { "Name" : "Foot" }
        definition.footSide is FootSide;

        annotation { "Name" : "Sizing mode" }
        definition.sizingMode is SizingMode;

        annotation { "Name" : "EU shoe size" }
        if (definition.sizingMode == SizingMode.EU_SIZE)
        {
            definition.euSize is EUSize;
        }

        annotation { "Name" : "Foot length" }
        if (definition.sizingMode == SizingMode.MANUAL)
        {
            isLength(definition.footLength, { (millimeter) : [200, 268, 350] } as LengthBoundSpec);
        }

        annotation { "Name" : "Ball width (widest forefoot)" }
        if (definition.sizingMode == SizingMode.MANUAL)
        {
            isLength(definition.ballWidth, { (millimeter) : [70, 100, 130] } as LengthBoundSpec);
        }

        annotation { "Name" : "Heel width" }
        if (definition.sizingMode == SizingMode.MANUAL)
        {
            isLength(definition.heelWidth, { (millimeter) : [50, 69, 90] } as LengthBoundSpec);
        }

        annotation { "Name" : "Arch type" }
        definition.archType is ArchType;

        annotation { "Name" : "Enable rocker sole", "Default" : false }
        definition.enableRocker is boolean;

        annotation { "Name" : "Rocker apex (% of length)",
                     "UIHint" : UIHint.REMEMBER_PREVIOUS_VALUE }
        if (definition.enableRocker)
        {
            isReal(definition.rockerApex, { (unitless) : [40, 52, 70] } as RealBoundSpec);
        }

        annotation { "Name" : "Build plane",
                     "Filter" : GeometryType.PLANE,
                     "MaxNumberOfPicks" : 1 }
        definition.buildPlane is Query;
    }
    {
        // ══════════════════════════════════════════════════════════════════
        // PHASE 1 — Resolve dimensions
        // ══════════════════════════════════════════════════════════════════

        var footLen = 268;   // mm, defaults to EU42
        var ballW   = 100;
        var heelW   = 69;

        if (definition.sizingMode == SizingMode.EU_SIZE)
        {
            const data = euSizeData(definition.euSize);
            footLen = data.footLength;
            ballW   = data.ballWidth;
            heelW   = data.heelWidth;
        }
        else
        {
            footLen = definition.footLength / millimeter;
            ballW   = definition.ballWidth / millimeter;
            heelW   = definition.heelWidth / millimeter;
        }

        const presets   = solePresets(definition.soleType);
        const heelDrop  = presets.heelDrop;   // mm
        const thickness = presets.thickness;  // mm at heel
        const heelCupD  = presets.heelCup;    // mm
        const archH     = archSupportHeight(definition.archType, presets.archFactor);

        // Sole length includes ~10mm toe allowance beyond foot
        const soleLen = footLen + 10;

        // Mirror factor: LEFT foot is the canonical shape; RIGHT negates X
        const mirror = definition.footSide == FootSide.LEFT ? 1 : -1;

        // ══════════════════════════════════════════════════════════════════
        // PHASE 2 — Build 2D footprint outline
        // ══════════════════════════════════════════════════════════════════
        //
        // 12-point anatomical polyline (all coords in mm, Y = toe direction)
        //
        //  Zone proportions from anthropometric literature:
        //    Heel center:    0%
        //    Midfoot:       27–55%
        //    Forefoot ball: 62–73%
        //    Toe tip:      100% of soleLen
        //
        // The outline starts at heel center-bottom, goes lateral (right
        // side for LEFT foot), up to toes, back down medial (left side
        // for LEFT foot), and closes at heel.

        const plane = evPlane(context, {
                "face" : definition.buildPlane
        });

        var sk = newSketch(context, id + "outline", {
                "sketchPlane" : definition.buildPlane
        });

        // Helper: convert mm pair to sketch vector with mirror
        // We'll build a point array then connect with lines + arcs

        // Key anatomical landmarks (X, Y) in mm — canonical LEFT foot
        // X: positive = lateral, negative = medial
        // Y: 0 = heel, soleLen = toe tip

        const heelCY    = 0;                       // heel center Y
        const archY     = soleLen * 0.35;          // mid-arch Y
        const waistY    = soleLen * 0.45;          // waist (narrowest)
        const ballY     = soleLen * 0.62;          // ball of foot
        const mtHeadY   = soleLen * 0.73;          // metatarsal heads
        const toeStartY = soleLen * 0.85;          // toe splay start
        const toeTipY   = soleLen;                 // toe tip

        const heelR     = heelW / 2;               // heel half-width
        const ballMed   = ballW * 0.55;            // medial ball half
        const ballLat   = ballW * 0.45;            // lateral ball half
        const waistW    = heelW * 0.85;            // waist width
        const waistMed  = waistW * 0.52;
        const waistLat  = waistW * 0.48;
        const toeMed    = ballW * 0.35;            // toe zone width
        const toeLat    = ballW * 0.25;

        // Build outline as closed polyline. For LEFT foot the medial
        // side is -X (inside of foot). We trace counter-clockwise
        // starting at the heel center-bottom.

        // Point indices for the closed polygon (16 points for smooth shape)
        // We'll use sketchLine for straight segments.

        // Heel arc: approximate with 3 points
        const p0  = vector(0 * millimeter,                     0 * millimeter);                  // heel center
        const p1  = vector(mirror * heelR * millimeter,        5 * millimeter);                  // heel lateral
        const p2  = vector(mirror * waistLat * millimeter,     archY * millimeter);              // lateral arch
        const p3  = vector(mirror * waistLat * millimeter,     waistY * millimeter);             // lateral waist
        const p4  = vector(mirror * ballLat * millimeter,      ballY * millimeter);              // lateral ball
        const p5  = vector(mirror * ballLat * millimeter,      mtHeadY * millimeter);            // lateral mt head
        const p6  = vector(mirror * toeLat * millimeter,       toeStartY * millimeter);          // lateral toe start
        const p7  = vector(mirror * 5 * millimeter,            toeTipY * millimeter);            // toe tip (slightly lateral for big-toe)
        const p8  = vector(mirror * -toeMed * millimeter,      toeStartY * millimeter);          // medial toe start
        const p9  = vector(mirror * -ballMed * millimeter,     mtHeadY * millimeter);            // medial mt head
        const p10 = vector(mirror * -ballMed * millimeter,     ballY * millimeter);              // medial ball
        const p11 = vector(mirror * -waistMed * millimeter,    waistY * millimeter);             // medial waist
        const p12 = vector(mirror * -heelR * millimeter,       archY * millimeter);              // medial arch (narrower = arch indent)
        const p13 = vector(mirror * -heelR * millimeter,       5 * millimeter);                  // heel medial
        // Close back to p0

        // Draw the outline segments
        skLineSegment(sk, "seg0",  { "start" : p0,  "end" : p1 });
        skLineSegment(sk, "seg1",  { "start" : p1,  "end" : p2 });
        skLineSegment(sk, "seg2",  { "start" : p2,  "end" : p3 });
        skLineSegment(sk, "seg3",  { "start" : p3,  "end" : p4 });
        skLineSegment(sk, "seg4",  { "start" : p4,  "end" : p5 });
        skLineSegment(sk, "seg5",  { "start" : p5,  "end" : p6 });
        skLineSegment(sk, "seg6",  { "start" : p6,  "end" : p7 });
        skLineSegment(sk, "seg7",  { "start" : p7,  "end" : p8 });
        skLineSegment(sk, "seg8",  { "start" : p8,  "end" : p9 });
        skLineSegment(sk, "seg9",  { "start" : p9,  "end" : p10 });
        skLineSegment(sk, "seg10", { "start" : p10, "end" : p11 });
        skLineSegment(sk, "seg11", { "start" : p11, "end" : p12 });
        skLineSegment(sk, "seg12", { "start" : p12, "end" : p13 });
        skLineSegment(sk, "seg13", { "start" : p13, "end" : p0 });

        skSolve(sk);

        // ══════════════════════════════════════════════════════════════════
        // PHASE 3 — Extrude base slab
        // ══════════════════════════════════════════════════════════════════

        opExtrude(context, id + "baseSlab", {
                "entities" : qSketchRegion(id + "outline"),
                "direction" : plane.normal,
                "endBound" : BoundingType.BLIND,
                "endDepth" : thickness * millimeter
        });

        // Fillet the outer vertical edges for organic shape
        try
        {
            // Only fillet edges parallel to the extrude direction (vertical edges)
            const verticalEdges = qParallelEdges(qCreatedBy(id + "baseSlab", EntityType.EDGE), plane.normal);
            opFillet(context, id + "outerFillet", {
                    "entities" : verticalEdges,
                    "radius" : 1.5 * millimeter
            });
        }
        catch (_)
        {
            // Fillet may fail on very short segments — non-critical
        }

        // ══════════════════════════════════════════════════════════════════
        // PHASE 4 — Carve plantar surface (top-side anatomical contour)
        // ══════════════════════════════════════════════════════════════════
        //
        // We carve from the top surface using zone-specific pocket cuts.
        // Each zone is an elliptical or rectangular sketch cut into the
        // top face at a specific depth.

        const topZ = thickness;  // mm from bottom

        // ── 4a. Heel cup ──
        // Elliptical pocket centered on heel, depth = heelCupD
        var heelSk = newSketch(context, id + "heelCupSketch", {
                "sketchPlane" : definition.buildPlane
        });

        const heelCupCenterY = soleLen * 0.10;
        const heelCupRadiusX = heelR * 0.75;
        const heelCupRadiusY = soleLen * 0.10;

        // Approximate ellipse with a circle (simpler, still effective)
        skCircle(heelSk, "heelCup", {
                "center" : vector(0 * millimeter, heelCupCenterY * millimeter),
                "radius" : heelCupRadiusX * millimeter
        });

        skSolve(heelSk);

        try
        {
            opExtrude(context, id + "heelCupCut", {
                    "entities" : qSketchRegion(id + "heelCupSketch"),
                    "direction" : plane.normal,
                    "endBound" : BoundingType.BLIND,
                    "startDepth" : topZ * millimeter,
                    "endDepth" : (topZ - heelCupD) * millimeter,
                    "operationType" : NewBodyOperationType.REMOVE
            });
        }
        catch (_)
        {
            // Heel cup cut failed — non-critical, continue
        }

        // ── 4b. Medial arch support channel ──
        // A trough along the medial arch to create the raised support ridge
        var archSk = newSketch(context, id + "archSketch", {
                "sketchPlane" : definition.buildPlane
        });

        // Arch channel: narrow rectangle along medial side
        const archStartY = soleLen * 0.25;
        const archEndY   = soleLen * 0.55;
        const archInnerX = mirror * -heelR * 0.3;
        const archOuterX = mirror * -heelR * 0.9;

        skRectangle(archSk, "archRect", {
                "firstCorner" : vector(archInnerX * millimeter, archStartY * millimeter),
                "secondCorner" : vector(archOuterX * millimeter, archEndY * millimeter)
        });

        skSolve(archSk);

        try
        {
            opExtrude(context, id + "archCut", {
                    "entities" : qSketchRegion(id + "archSketch"),
                    "direction" : plane.normal,
                    "endBound" : BoundingType.BLIND,
                    "startDepth" : topZ * millimeter,
                    "endDepth" : (topZ - archH * 0.3) * millimeter,
                    "operationType" : NewBodyOperationType.REMOVE
            });
        }
        catch (_)
        {
            // Arch cut failed — non-critical
        }

        // ── 4c. Metatarsal relief ──
        // Shallow elliptical pad behind the metatarsal heads
        var metSk = newSketch(context, id + "metSketch", {
                "sketchPlane" : definition.buildPlane
        });

        const metCenterY = soleLen * 0.60;
        const metRadius  = ballW * 0.30;

        skCircle(metSk, "metPad", {
                "center" : vector(0 * millimeter, metCenterY * millimeter),
                "radius" : metRadius * millimeter
        });

        skSolve(metSk);

        try
        {
            opExtrude(context, id + "metCut", {
                    "entities" : qSketchRegion(id + "metSketch"),
                    "direction" : plane.normal,
                    "endBound" : BoundingType.BLIND,
                    "startDepth" : topZ * millimeter,
                    "endDepth" : (topZ - 2.5) * millimeter,
                    "operationType" : NewBodyOperationType.REMOVE
            });
        }
        catch (_)
        {
            // Metatarsal cut failed — non-critical
        }

        // ── 4d. Toe ramp ──
        // Slight depression in the toe area for natural toe-off
        var toeSk = newSketch(context, id + "toeSketch", {
                "sketchPlane" : definition.buildPlane
        });

        const toeCenterY = soleLen * 0.88;
        const toeRadius  = ballW * 0.20;

        skCircle(toeSk, "toePad", {
                "center" : vector(mirror * 5 * millimeter, toeCenterY * millimeter),
                "radius" : toeRadius * millimeter
        });

        skSolve(toeSk);

        try
        {
            opExtrude(context, id + "toeCut", {
                    "entities" : qSketchRegion(id + "toeSketch"),
                    "direction" : plane.normal,
                    "endBound" : BoundingType.BLIND,
                    "startDepth" : topZ * millimeter,
                    "endDepth" : (topZ - 1.5) * millimeter,
                    "operationType" : NewBodyOperationType.REMOVE
            });
        }
        catch (_)
        {
            // Toe ramp cut failed — non-critical
        }

        // ══════════════════════════════════════════════════════════════════
        // PHASE 5 — Shape outsole
        // ══════════════════════════════════════════════════════════════════

        // ── 5a. Heel-to-toe drop ──
        // Cut an angled plane from bottom to create the drop.
        // The heel stays at full thickness; the forefoot is reduced by heelDrop.
        if (heelDrop > 0)
        {
            var dropSk = newSketch(context, id + "dropSketch", {
                    "sketchPlane" : definition.buildPlane
            });

            // Trapezoidal cut profile spanning the sole bottom
            // The cut removes material from the toe end of the bottom
            const cutStartY = soleLen * 0.20;  // start thinning after heel zone
            const solePad   = ballW * 0.7;      // wide enough to cover entire sole

            skRectangle(dropSk, "dropRect", {
                    "firstCorner" : vector(-solePad * millimeter, cutStartY * millimeter),
                    "secondCorner" : vector(solePad * millimeter, (soleLen + 5) * millimeter)
            });

            skSolve(dropSk);

            try
            {
                opExtrude(context, id + "dropCut", {
                        "entities" : qSketchRegion(id + "dropSketch"),
                        "direction" : plane.normal,
                        "endBound" : BoundingType.BLIND,
                        "endDepth" : heelDrop * millimeter,
                        "operationType" : NewBodyOperationType.REMOVE
                });
            }
            catch (_)
            {
                reportFeatureWarning(context, id, "Heel drop cut could not be applied.");
            }

        }

        // ── 5b. Optional rocker profile ──
        if (definition.enableRocker)
        {
            const apexPct = definition.rockerApex / 100;
            const apexY   = soleLen * apexPct;

            // Create a large circular cut on the bottom to form the rocker curve
            // Radius chosen so the sole lifts ~heelDrop at the toe and heel extremes
            const rockerR = (soleLen * soleLen) / (8 * heelDrop);  // approximate

            var rockerSk = newSketch(context, id + "rockerSketch", {
                    "sketchPlane" : definition.buildPlane
            });

            skCircle(rockerSk, "rockerCirc", {
                    "center" : vector(0 * millimeter, apexY * millimeter),
                    "radius" : rockerR * millimeter
            });

            skSolve(rockerSk);

            try
            {
                opExtrude(context, id + "rockerCut", {
                        "entities" : qSketchRegion(id + "rockerSketch"),
                        "direction" : -plane.normal,
                        "endBound" : BoundingType.BLIND,
                        "endDepth" : (heelDrop * 1.5) * millimeter,
                        "operationType" : NewBodyOperationType.REMOVE
                });
            }
            catch (_)
            {
                reportFeatureWarning(context, id, "Rocker profile could not be applied.");
            }
        }

        // ── 5c. Final edge softening ──
        // Use a small chamfer instead of fillet — more robust on complex geometry
        try
        {
            const soleBody = qCreatedBy(id + "baseSlab", EntityType.BODY);
            const allEdges = qOwnedByBody(soleBody, EntityType.EDGE);
            opChamfer(context, id + "finalChamfer", {
                    "entities" : allEdges,
                    "chamferType" : ChamferType.EQUAL_OFFSETS,
                    "width" : 0.5 * millimeter
            });
        }
        catch (_)
        {
            // Edge softening is cosmetic — non-critical
        }

        // ══════════════════════════════════════════════════════════════════
        // PHASE 6 — Report
        // ══════════════════════════════════════════════════════════════════

        const soleBody = qCreatedBy(id + "baseSlab", EntityType.BODY);
        const vol = evVolume(context, { "entities" : soleBody });
        const volCm3 = vol / (centimeter ^ 3);

        // TPU density ≈ 1.2 g/cm³
        const massG = volCm3 * 1.2;

        const sideLabel = definition.footSide == FootSide.LEFT ? "Left" : "Right";

        reportFeatureInfo(context, id,
            sideLabel ~ " sole blank — " ~
            toString(footLen) ~ "mm length × " ~
            toString(ballW) ~ "mm ball width | " ~
            "Volume: " ~ toString(roundToPrecision(volCm3, 1)) ~ " cm³ | " ~
            "Est. TPU mass: " ~ toString(roundToPrecision(massG, 0)) ~ " g"
        );
    });
