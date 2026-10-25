---
id: 5
title: "Grilling: framework and build stack"
labels: [wayfinder:grilling]
parent: 0
status: closed
assignee: mylen
blocked_by: [2, 3]
---

## Question

Which framework (or none), language, build tool, 3D library layer, state management, and i18n library does the app use, given the stack research and the scenario model?

## Context

- Stack research ([research/threejs-stack-and-assets.md](research/threejs-stack-and-assets.md)): 3D code is near-identical across wrappers; the real drivers are the UI shell (menus, i18n, a11y), JS weight on phones, and R3F's v9→v10 churn. Consider a fifth option: vanilla three.js scene + a light UI framework.

## Resolution

Decided by the agent: the user delegated this ticket ("close them with your decision"). See [ADR 0002](../docs/adr/0002-vanilla-threejs-scene-with-sveltekit-shell.md).

- **Language and build:** TypeScript (strict) + Vite, through **SvelteKit 2 with `adapter-static`**. Every route is prerendered into a fully static site, with locale-prefixed routes `/nl/…` and `/en/…`.
- **UI shell:** Svelte 5 (runes) for menus, topic list, progress, settings, language switch, the passing-order tray, and the accessible non-3D paths.
- **3D layer:** **vanilla three.js** in one framework-free scene module that builds the scene imperatively from Scenario data. Not Threlte or another wrapper: it keeps the scene independent of the UI framework, is the lightest option (~155 KB gz), and avoids wrapper churn. Pin an exact three.js version (no semver). Render on demand; ≤100 draw calls.
  - Picking: `Raycaster` with enlarged invisible hit proxies, plus `touch-action: none` on the canvas.
  - Replays: a small custom timeline moving road users along per-Manoeuvre `CurvePath`s (`getPointAt` / `getTangentAt`). No GSAP or Theatre.js.
  - In-scene badges ("1, 2, 3"): `CSS2DRenderer`, so the labels stay DOM and get translated like the rest of the UI.
- **State:** Svelte 5 runes in plain `.svelte.ts` modules; no state library. Progress lives in one versioned `localStorage` record behind a small module that handles missing or blocked storage.
- **i18n:** **Paraglide JS** (compiled, tree-shakable messages, first-class in SvelteKit). The per-Rule Explanation templates are Paraglide messages with road-user parameters. CBR terms such as "erf" stay in Dutch in the English text.
- **Scenario data:** one JSON file per Scenario in the repo, described by a **Zod** schema. At build time, a Vitest suite validates every file against the schema and runs the rules engine (ADR 0001); the engine also ships to the client for Deadlock derivation and Variants. Zod is used only at build time and in dev; the client imports the inferred types, not the Zod schema, so Zod never reaches the client bundle.
- **Tests:** Vitest for the engine and scoring; Playwright smoke test on a mobile viewport.
