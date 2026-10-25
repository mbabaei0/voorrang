---
id: 3
title: "Grilling: the scenario model"
labels: [wayfinder:grilling]
parent: 0
status: closed
assignee: mylen
blocked_by: [1]
---

## Question

How is a Scenario described as data? Decide: road layout representation (templates vs composable pieces), signs/markings/signals, road users with their intended paths, the passing order (incl. simultaneous moves and deadlocks), and the explanation attached to each step. Decide whether the correct passing order is hand-authored per scenario or derived by a rules engine from the scenario (or authored and validated by one).

## Context

- CBR answer conventions ([research/cbr-answer-conventions.md](research/cbr-answer-conventions.md)): the exam's numbering question is strict 1-2-3 with one token per number, so simultaneous moves (a Step with several road users) would be the app's own extension, not exam style. Turning drivers let pedestrians crossing the side road go (art. 18). Roundabout priority comes only from the signs or haaientanden shown, never from the built-up-area sign.

## Resolution

- **Answer authority**: authored Passing order, checked at build time by a rules engine running the 10-step precedence from the rules research. An author may override the engine only by citing a Rule of kind *convention* with its source. A scenario relying on an *unresolved* Rule fails the build. See [ADR 0001](../docs/adr/0001-authored-answers-validated-by-rules-engine.md).
- **Layout**: one of ~4 parametrised Layouts (crossroads, T-junction, roundabout, road with exit/erf). Each Arm has surface (paved/unpaved), cycle path, tram track, lanes, and a fixed angle choice.
- **Controls** attach to Arms: priority control (none, B1, B2–B5, B6, B7, haaientanden), optional lights with one frozen state per movement (red/yellow/green/off/flashing yellow), optional zebra or tram markings. Every Scenario is a frozen moment: all road users already waiting, lights don't change, arrival order never decides.
- **Road users**: kind (car, bicycle, moped, snorfiets, pedestrian, tram, bus, voorrangsvoertuig) + arm + Manoeuvre + lane; the Layout derives the 3D path and conflict points. Blue light and siren are separate flags. One road user may be marked **You**; the scenario picks a starting camera preset (driver's eye, behind You, overhead).
- **Passing order**: a list of Steps, each a set of road users who may go together. Scoring accepts any order within a Step (matches the strict CBR 1-2-3 format, confirmed by [the CBR conventions research](0007-research-cbr-ties-and-pedestrians.md)); the Replay moves them together. Whether ties can be marked in the UI is the interaction prototype's call.
- **Deadlock**: no authored order. The first Step is a waiver Step (the road users in the cycle; any one may go by agreement); the engine derives the rest after removing the waiving road user. The learner must also declare the deadlock to score.
- **Explanation**: one per waiting road user: Rule id + the road users it waits for. NL/EN text comes from a template per Rule, which an author may add to or replace. Rules form one catalogue with kind law | convention | unresolved. Pedestrians crossing the side road when turning is a *law* Rule (art. 18), settled by the CBR conventions research.
- **Variants**: rotated Variants are generated and engine-checked, and count as the same scenario for progress. Mirroring is forbidden (it swaps left and right).
- **Curriculum hooks**: a scenario has a stable id and an NL/EN title; its topics are derived from the Rules its explanations cite. Difficulty goes to [Grilling: curriculum shape](0004-grilling-curriculum-shape.md); file format (one file per scenario, schema-validated) goes to [Grilling: framework and build stack](0005-grilling-framework-and-build-stack.md).
- Glossary terms added to [CONTEXT.md](../CONTEXT.md): Layout, Arm, Control, Manoeuvre, Step, Rule, Law/Convention, Explanation, Deadlock/waiver, You, Variant.
