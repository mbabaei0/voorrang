---
id: 2
title: "Research: three.js stack and asset options"
labels: [wayfinder:research]
parent: 0
status: closed
assignee: research-agent
blocked_by: []
---

## Question

What are the realistic options for building a mobile-friendly 3D puzzle app on three.js in late 2026? Compare vanilla three.js (+ Vite + TS), React Three Fiber (+ drei), Threlte (Svelte), TresJS (Vue), and alternatives; for each: maturity, bundle size, mobile performance, input/picking ergonomics, animation tooling, i18n fit. Also: sources of low-poly road, vehicle, cyclist, pedestrian, tram and Dutch road-sign assets with licences that allow free public use; feasibility of procedurally generating road layouts; mobile GPU budgets (draw calls, triangles) to target.

## Resolution

- All four three.js options are maintained and MIT. Measured gzip JS: vanilla ~155 KB, Threlte ~230 KB, TresJS ~266 KB, R3F v9 ~320 KB. Babylon (as a contrast) is ~650 KB.
- R3F v10 is in alpha as a "clean break" (WebGPU default, `/legacy` for WebGL). three.js has no semver, so pin the version.
- Picking: R3F, Threlte and Tres share a depth-ordered pointer-event model with tap-vs-drag `delta`. Vanilla needs about 50–100 lines of Raycaster code. Use enlarged hit proxies and `touch-action: none` on mobile.
- Replays: three's `Curve.getPointAt/getTangentAt` along per-manoeuvre `CurvePath`s, driven by a custom timeline, AnimationMixer, or GSAP. Theatre.js is stale.
- i18n is a DOM/UI-shell concern in every option (Paraglide, i18next, vue-i18n, or hand-rolled JSON). In-scene labels via `<Html>`/CSS2DRenderer.
- Assets: Kenney and Quaternius are CC0 (cars, public transport incl. bicycle, people, generic road kit). Poly Pizza licences vary per model (Google Poly items are CC-BY 3.0). Dutch RVV sign SVGs on Commons are public domain (PD-NL-verkeersbord). No CC0 tram or Dutch road layout found.
- Roads, markings, haaientanden and roundabouts are best generated procedurally from Scenario data with Shape/Ring/Extrude geometry, plus InstancedMesh and merged geometry.
- Budget targets: ≤100 draw calls, ≤100–200k triangles, ≤32 MB textures, DPR ≤2, render on demand. Prefer meshopt (8 KB decoder) over Draco. Use KTX2 only if textures are substantial.

Findings: [research/threejs-stack-and-assets.md](research/threejs-stack-and-assets.md)
