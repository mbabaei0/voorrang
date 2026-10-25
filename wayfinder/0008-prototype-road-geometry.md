---
id: 8
title: "Prototype: procedural road geometry"
labels: [wayfinder:prototype]
parent: 0
status: open
assignee:
blocked_by: [5]
---

## Question

Can the ~4 Layouts (crossroads, T-junction, roundabout, road with exit/erf) be generated procedurally from Arm data (surface, red cycle path, tram track, lanes, angle) and Controls (haaientanden, sign posts, lights, zebra) to look recognisably Dutch at mobile budgets (≤100 draw calls)? Decide the geometry approach and how Manoeuvre paths and conflict points are derived from it.

## Context

- Scenario model: [Grilling: the scenario model](0003-grilling-scenario-model.md). No asset pack covers Dutch layouts; road users come from CC0 packs ([stack research](research/threejs-stack-and-assets.md)).
