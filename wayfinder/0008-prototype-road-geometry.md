---
id: 8
title: "Prototype: procedural road geometry"
labels: [wayfinder:prototype]
parent: 0
status: closed
assignee: mylen
blocked_by: [5]
---

## Question

Can the ~4 Layouts (crossroads, T-junction, roundabout, road with exit/erf) be generated procedurally from Arm data (surface, red cycle path, tram track, lanes, angle) and Controls (haaientanden, sign posts, lights, zebra) to look recognisably Dutch at mobile budgets (≤100 draw calls)? Decide the geometry approach and how Manoeuvre paths and conflict points are derived from it.

## Context

- Scenario model: [Grilling: the scenario model](0003-grilling-scenario-model.md). No asset pack covers Dutch layouts; road users come from CC0 packs ([stack research](research/threejs-stack-and-assets.md)).

## Resolution

**Yes.** All four Layouts can be generated from Arm and Control data, and a busy scene stays far under budget. The prototype is in [prototypes/road-geometry](../prototypes/road-geometry/README.md). It has 36 Vitest tests at the three agreed seams (Manoeuvre paths, conflict points, scene budget) and a demo page with seven presets.

### Geometry approach

- **Everything is derived from the Arm cross-section.** Each Arm is a bearing plus lanes in and out, cycle path, tram and surface. From these the code works out:
  - lane offsets (3.5 m lanes, lane 0 is the rightmost)
  - the cycle path (1 m verge, then a 2 m red path)
  - the footway (1.5 m outside the road surface)
  - two tram tracks down the middle
  
  The junction radius, the crossing band and the stop line all come from the widest Arm. Nothing is placed by hand.
- **Fixed distances, from the centre outwards:**
  - the junction square or the roundabout rings
  - a 3 m pedestrian crossing band (zebra), just outside the junction
  - the stop line, 0.5 m further out; haaientanden, signs and lights stand here, so waiting traffic is behind the crossing
  
  Exception: at a roundabout with a cycle ring, traffic crosses the cycle ring first. It gives way at the carriageway, in the 5 m gap that holds one car.
- **Static surfaces are flat polygons with vertex colours, built in plan.** They are merged per role into one `Mesh` each, all sharing a single `MeshLambertMaterial`. The roles are ground, markings, zebra, signs and lights. Haaientanden are one `InstancedMesh`.
  - Sign plates are built from shapes (inverted triangle, diamond, octagon), so the static layout needs no textures.
  - Commons SVG plates can come later as one small atlas.
- **Uitrit:** the main road runs straight past it with no junction square. The exit arm (brick) starts at the edge of the main carriageway, so the main road's cycle path and footway run on across its mouth.
- **Variants:** `rotateLayout` adds to every bearing. Tests check that paths rotate with it and that the conflict list is unchanged.

### Manoeuvre paths

- A path is a `CurvePath` made of three parts:
  1. straight in along the lane line
  2. a turn
  3. straight out along the target lane line
  
  The turn is a cubic Bézier through the corner where the two lane lines meet, with handles set for a quarter circle on right-angled turns. This is the same curve the Replay will drive with `getPointAt` and `getTangentAt`.
  - A quadratic curve cut across the centre. The cubic keeps opposing left turns on their own side, so they pass in front of each other ("voor elkaar langs") and do not conflict.
- **Target Arm:** the one whose bearing is closest to the turn direction (straight ±180°, left +90°, right −90°). An Arm more than 60° off is rejected. This handles T-junctions, Y-junctions and skewed arms without separate templates.
- **Roundabout:** an entry curve blends into a circle at the middle of the ring, then traffic runs anticlockwise, then an exit curve blends out. Cyclists use the cycle ring if there is one. Pedestrians walk straight across the crossing band.
- **"Leave an exit" is not its own path shape.** It is a left or right turn from an Arm marked `exit`. The Manoeuvre type can drop it, or keep it only as a label for Explanations.

### Conflict points

- Both paths are sampled every 0.2 m. The conflict point is the first place one path comes within 0.3 m of the other after the two have been apart.
  - Road users who start in the same lane are queueing, so they don't count.
  - Each conflict is classed by the angle the paths meet at: under 30° is a **merge**, otherwise a **cross**.
- Every case tested comes out as expected:
  - Crossing straight paths conflict.
  - Opposing right turns and opposing left turns do not.
  - A left turn conflicts with oncoming straight traffic, and merges with an oncoming right turn into the same exit.
  - A car turning right crosses a cyclist going straight on the cycle path (the art. 18 case), and a pedestrian crossing the side road.
  - On a roundabout, a car entering merges with circulating traffic and crosses the cycle ring.
- Geometry only says *who meets whom*. *Who goes first* remains the rules engine's job (ADR 0001).

### Budget (measured in Node with eight placeholder road users)

| Layout (busy: 2 lanes in, cycle paths, tram, lights, zebra, signs) | Draw calls | Triangles |
|---|---|---|
| crossroads | 14 | 600 |
| T-junction | 14 | 482 |
| roundabout | 14 | 886 |
| road with exit | 14 | 336 |

Of the 14 draw calls, 6 are the static Layout and 8 are road users (one each). Building a scene takes about 1.4 ms in Node. **The budget will be spent on road-user models, not roads.** A multi-material CC0 vehicle can cost 3–5 draw calls, so merge each model's materials into a palette at import (gltf-transform). Real-device frame timing still belongs to the interaction prototype (0006).

### Open, for building or later tickets

- **Not modelled yet:**
  - B2–B5 plates
  - lights per movement (the prototype has one state per Arm; arrows need per-lane state)
  - tram-crossing markings
  - the erf shared surface (it could reuse the uitrit treatment with a brick surface on every Arm)
  - the red cycle crossing (fietsoversteek) painted across a side road; this matters for looking "recognisably Dutch"
- **Visual shortcuts:**
  - The junction square is a plain polygon with no kerb radii.
  - Roundabout entries have no splitter islands.
  - Road users are boxes.
- **`junctionRadius` is shared by the whole Layout.** It is the maximum over all Arms. A very wide Arm pushes every stop line back, which is fine for the curriculum's Layouts.
