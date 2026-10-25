# Research: three.js stack and asset options (as of 2026-10-25)

Ticket: [0002](../0002-research-threejs-stack-and-assets.md). The question is what it takes to build a static, mobile-friendly 3D "who goes first?" puzzle (tap road users in passing order, then watch the Replay) on three.js, in NL and EN, with no backend.

**This document gives options and trade-offs. It does not pick a framework**, because that is ticket 0005's job.

Method: package versions, dates and licences come straight from the npm registry (`registry.npmjs.org/<pkg>`). Repo activity comes from the GitHub REST API. API claims were checked against the installed package source or the official docs. Bundle sizes were **measured here** (method in §2). Where a claim relies on a weaker source, the text says so.

---

## 1. Maturity and maintenance

| Option | Latest stable (npm, date) | Peer requirements | GitHub stars / last push | Licence | Notes |
|---|---|---|---|---|---|
| **three.js** | `three@0.186.1` (2026-09-24) | none | 116.9k / 2026-10-25 | MIT | Releases ship roughly every 2–3 months (r183 Feb, r184 Apr, r185 Jul, r186 Sep 2026). **No semver.** Every release has a "Migration Guide" section, so pin the version. Both WebGLRenderer and `three/webgpu` (WebGPURenderer, which can fall back to WebGL2) ship in the package. |
| **React Three Fiber** | `@react-three/fiber@9.8.2` (2026-10-14) | `react >=19 <19.4`, `three >=0.156` | 33.2k / 2026-10-21 | MIT | **v10 is in alpha** (`10.0.0-alpha.6`, 2026-10-17). It is described as "a clean break". WebGPURenderer becomes the default, and GLSL/WebGL users must switch to `@react-three/fiber/legacy`. The core no longer imports three.js, and each renderer is its own module ([release notes](https://github.com/pmndrs/react-three-fiber/releases/tag/v10.0.0-alpha.6)). Starting on v9 now means a likely migration soon. |
| **drei** | `@react-three/drei@10.7.9` (2026-09-25) | R3F | 10.1k / 2026-10-21 | MIT | An `11.0.0-alpha.7` exists, tracking R3F v10. |
| **Threlte** (Svelte) | `@threlte/core@8.6.1` (2026-09-24), `@threlte/extras@9.22.3` (2026-10-21) | `svelte >=5`, `three >=0.172` | 3.4k / 2026-10-21 | MIT | Active patch cadence. Recent extras releases add WebGPU support component by component (CSM, Gizmo, BakeShadows…). |
| **TresJS** (Vue) | `@tresjs/core@5.10.0`, `@tresjs/cientos@5.10.0` (2026-10-22) | `vue >=3.4`, `three >=0.133` | 3.8k / 2026-10-22 | MIT | Added `/webgpu` entry points in 5.10.0. Pointer events come from `@pmndrs/pointer-events` (a dependency in its package.json). |
| **Babylon.js** (contrast) | `@babylonjs/core@9.32.0` (2026-10-22) | none | 26.2k / 2026-10-23 | Apache-2.0 | A full engine (GUI, animation, physics, inspector) backed by Microsoft. Its API is unrelated to three.js. |
| **PlayCanvas engine** (contrast) | `playcanvas@2.23.3` (2026-10-15) | none | 17.1k / 2026-10-23 | MIT | An engine built around an editor, though it can be used code-only. Mentioned only for completeness. |

Supporting libraries (all MIT, all active):
- `three-mesh-bvh@0.9.16` (2026-10-08): BVH-accelerated raycasting.
- `@gltf-transform/cli@4.5.1` (2026-09-28): asset pipeline.
- `meshoptimizer@1.3.0` (2026-09-25).
- `@threlte/gltf@3.1.0`.
- `gltfjsx@6.5.3`: last released 2024-11-04, so it is slowing down.

Animation libraries:
- `gsap@3.15.0` is under the "Standard 'no charge' licence" rather than an OSI licence.
- `@theatre/core@0.7.2` was last published 2024-05. Treat it as stale.

## 2. Bundle size (measured)

Method: minimal "scene + box + standard material + light" entry points, plus `GLTFLoader`. Built with esbuild (`--bundle --minify`, ESM, production defines), then gzip -9 as Node's default. These are indicative and do not reproduce Vite/Rollup output exactly, but they are internally comparable. Installed versions match §1, with `react@19.2`, `vue@3`, `svelte@5`.

| Entry | min | gzip |
|---|---|---|
| vanilla three, WebGLRenderer, minimal scene | 520 KB | **132 KB** |
| vanilla three + GLTFLoader + Raycaster | 603 KB | **155 KB** |
| vanilla `three/webgpu` (WebGPURenderer + node material) | 769 KB | 210 KB |
| Threlte (Svelte 5 + `@threlte/core`, with GLTFLoader) | 852 KB | **230 KB** |
| TresJS (Vue 3 + `@tresjs/core`, with GLTFLoader) | 954 KB | **266 KB** |
| R3F v9 (React 19 + react-dom + fiber, with GLTFLoader) | 1146 KB | **320 KB** |
| Babylon.js 9 (ES6 deep imports: engine, scene, camera, light, box, glTF loader, picking) | 2805 KB | **654 KB** |

Why the wrappers cost more than "framework + three":
- Both `@react-three/fiber@9` and `@tresjs/core` contain `import * as THREE from 'three'` (checked in `dist/`) for their JSX/template catalogue. That defeats tree-shaking, so close to all of three.js lands in the bundle.
- R3F v10 states it fixes this ("You only download the renderer you use"), but it is still alpha.

Optional runtime decoders, from `three/examples/jsm/libs/` in r186, are loaded on demand. Raw / gzip:
- Draco: `draco_decoder.wasm` 192 KB / 63 KB, plus wrapper 58 KB / 12 KB.
- Basis (KTX2): `basis_transcoder.wasm` 527 KB / **245 KB**, plus JS 58 KB / 15 KB.
- Meshopt: `meshopt_decoder.module.js` 29 KB / **8 KB**.

So for a small low-poly scene, **meshopt costs far less to ship than Draco, and KTX2's transcoder (~260 KB gz) only pays off once texture memory is large enough to matter.** A flat-colour low-poly style may not need textures at all (see §6).

## 3. Mobile performance

- All four three.js options render with the same three.js renderer, so GPU cost is the same. The differences are CPU-side: reconciler overhead, and per-frame callbacks versus a hand-written loop.
- For a puzzle app with a few dozen objects, that overhead is small compared with draw calls and fill rate.
- **Render-on-demand** matters most on mobile, for battery and heat: the scene is idle while the user thinks. Every option supports it:
  - R3F: `frameloop` (`'always' | 'demand' | 'never'`) in `configuration.d.ts`.
  - Threlte: `renderMode: 'always' | 'on-demand' | 'manual'` in `scheduler.svelte.d.ts`.
  - TresJS: `renderMode?: 'always' | 'on-demand' | 'manual'`.
  - Vanilla: render only on change or while a Replay is running.
- R3F/drei add `PerformanceMonitor` and `AdaptiveDpr` (exports in drei's `index.d.ts`) for automatic resolution scaling. Threlte extras has `PerfMonitor`. In vanilla, capping `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` is the usual hand-rolled equivalent.
- **WebGPU**: Safari 26 ships WebGPU on iOS/iPadOS/macOS. This comes from WebKit's Safari 26 feature post, which I saw only via secondary quotes (e.g. WebKit Bugzilla [301627](https://bugs.webkit.org/show_bug.cgi?id=301627)). User bug reports describe early flicker and flag issues.
  - For a simple low-poly scene, WebGL2 is still the safer default. three's WebGPURenderer falls back to WebGL2 and costs about 55 KB gz more (§2).
  - R3F v10 will default to it.
- Babylon is a heavier download (§2) but well optimised at runtime. Its main mobile cost is first-load size.

## 4. Picking ergonomics (tapping road users)

| Option | How tapping works |
|---|---|
| **Vanilla** | `Raycaster.setFromCamera(ndc, camera)` + `intersectObjects()`. You write the `pointerdown`/`pointerup` handling, tap-vs-drag thresholds, and the mapping from a hit mesh to its Road user (e.g. `object.userData.roadUserId` walking up parents). That is about 50–100 lines. `InstancedMesh.raycast` and `BatchedMesh.raycast` exist in r186, and the hit carries `instanceId`/`batchId`. `three-mesh-bvh` speeds up raycasts against dense meshes (not needed at this scale). |
| **R3F** ([events docs](https://r3f.docs.pmnd.rs/api/events)) | `onClick`, `onPointerDown/Up/Over/Out/Enter/Leave/Move`, `onDoubleClick`, `onContextMenu`, `onWheel` on any object. `onPointerMissed` on the Canvas fires for taps on empty space. Events go to the nearest hit first and bubble through ancestors. `stopPropagation()` also blocks objects behind. The event carries `object`, `eventObject`, `intersections`, `delta` (pixels moved between down and up, which helps tell a tap from an orbit drag). Customise with `events={{ filter, compute }}`. drei adds `Select`, `Outlines`, `Bvh`, `useCursor`. |
| **Threlte** ([interactivity docs](https://threlte.xyz/docs/reference/extras/interactivity)) | Opt in by calling `interactivity()` from `@threlte/extras`. It then offers the same model as R3F (depth-ordered bubbling, `stopPropagation`, `delta`, `onpointermissed`, `filter`, `compute`). The docs explicitly recommend `touch-action: none` on the canvas wrapper for touch devices. |
| **TresJS** | Event props on Tres objects (`onClick`, `onPointerdown/up/move/enter/leave/over/out`, `onPointermissed`, `onWheel`), checked in `@tresjs/core` type declarations. Built on `@pmndrs/pointer-events`. Its event docs URL redirected or 404'd during this research, so I checked the types only. |
| **Babylon** | `scene.onPointerObservable` / `scene.pick(x, y)` return a `PickingInfo` with `pickedMesh`. It is built in and well documented, but has its own idioms. |

All three wrappers give declarative per-object tap handlers with tap-versus-drag detection (`delta`). In vanilla you write that yourself, but it is small and fully under your control.

Touch-specific advice that applies to every option:
- Set `touch-action: none` on the canvas.
- Use invisible, enlarged hit proxies (simple boxes) per road user, so small cyclists and pedestrians can be tapped on a phone.
- Raycast against the proxies only, not the visual meshes.

## 5. Animation tooling for path-following Replays

The core primitive is three's own curve API (in `src/extras/core/Curve.js` and `src/extras/curves/`):
- `Curve.getPointAt(u)` / `getTangentAt(u)` give arc-length-parameterised position and heading.
- Curve classes: `LineCurve3`, `QuadraticBezierCurve3`, `CubicBezierCurve3`, `CatmullRomCurve3`, and `CurvePath` to chain straight → turn arc → straight.

Each road user's manoeuvre (straight, left, right, roundabout exit) becomes a curve. The Replay drives `u` from 0→1 per road user with a scheduled start time, and sets `position = getPointAt(u)` and `lookAt(position + tangent)`. Simultaneous moves are just overlapping time windows. This is framework-neutral and deterministic, which suits a Replay.

Options for driving `u`:
- **Hand-written timeline** in a `requestAnimationFrame`/`useFrame`/`useTask` loop. Simplest and deterministic, and easy to scrub, pause or rewind.
- **three `AnimationMixer` / `AnimationClip` / `KeyframeTrack`** (`src/animation/`). Bake sampled curve points into position/quaternion tracks. You get play, pause, `time` scrubbing, and crossfades for free, plus the ability to play glTF-embedded clips (pedestrian walk cycles, wheel spin).
- **GSAP** (`gsap@3.15.0`, free "Standard" licence, not OSI). A mature timeline with good scrub, labels and stagger APIs. It is framework-neutral.
- **react-spring** (`@react-spring/three@10.1.2`) for R3F. It is physics-based springs, which fit UI flourishes better than deterministic replays.
- **Theatre.js** is effectively unmaintained (`@theatre/core` last published 2024-05), so avoid it.

Framework helpers for glTF clips: drei `useAnimations`, Threlte `useGltfAnimations`, cientos `useAnimations` (all confirmed in package exports). Threlte extras also has `useFollow` and `CameraControls`, and drei/cientos have `CameraControls`/`MapControls`. These are useful for a "follow the car" Replay camera.

Babylon contrast: it has `Path3D` (`Maths/math.path`) plus a built-in `Animation`/`AnimationGroup` system, which is comparable.

## 6. UI overlays and i18n fit

- In every option, overlay UI (instructions, the passing-order tray, feedback, menus) is best done as **ordinary DOM over the canvas**. That means i18n is a DOM/framework concern, not a 3D one. Current maintained choices (npm, all MIT):
  - React: `react-i18next@17.1.9`, `@lingui/core@6.10.1`.
  - Vue: `vue-i18n@11.4.16`.
  - Svelte: `@inlang/paraglide-js@2.29.1`, which compiles messages into tree-shakable functions and also works with any framework or vanilla. `svelte-i18n@4.0.1` was last released 2024-10.
  - Vanilla: `i18next@26.5.10`, or a hand-rolled `nl.json`/`en.json` lookup. Two locales and a static site make the hand-rolled route realistic.
- **In-scene labels** (e.g. a "1, 2, 3" badge above each tapped road user): `<Html>` in drei/cientos and `<HTML>` in Threlte extras project DOM elements to 3D positions, so the text stays as DOM and is translated like the rest of the UI. Vanilla has `CSS2DRenderer` in `three/addons` for the same thing. Alternatives are SDF text in-scene (drei/Threlte `Text`, built on troika) or sprite textures, but those are harder to localise and to make accessible.
- A **component framework helps most with the UI shell**, not the 3D part: menus, a curriculum list, progress, settings, a language switch, and accessibility (the map's "non-3D fallback / keyboard / screen reader" item). That shell argues for some UI framework even if the 3D layer is vanilla. "Vanilla three.js scene module + light UI framework (or none)" is a legitimate hybrid, not only the four wrappers.
- Babylon has its own `@babylonjs/gui` (9.32.0), which draws UI on canvas. You can also use DOM overlays, and for i18n and a11y you should.

## 7. Trade-off summary (not a decision)

| | Vanilla + Vite + TS | R3F + drei | Threlte | TresJS | Babylon |
|---|---|---|---|---|---|
| JS cost (gz, measured) | ~155 KB | ~320 KB (v9) | ~230 KB | ~266 KB | ~650 KB |
| Ecosystem / examples | Largest (all three.js examples apply) | Largest wrapper ecosystem | Smaller, very active | Smaller, active | Large, separate ecosystem |
| Picking | DIY (small) | Best-documented | Same model, opt-in | Same model | Built-in |
| Release risk | three has no semver; pin it | **v10 clean break in alpha now** | Stable on Svelte 5 | Stable on Vue 3 | Stable |
| UI shell / i18n | Need to pick something | React ecosystem | Svelte + Paraglide | Vue + vue-i18n | Own GUI or DOM |
| Scenario-as-data fit | Imperative build from JSON | Declarative JSX from JSON | Declarative markup from JSON | Declarative templates from JSON | Imperative |

The deciding factors for ticket 0005 are likely:
- Which UI framework the maintainers know.
- Whether ~100–170 KB gz of extra JS matters for a learner app opened on phones.
- Whether to accept R3F v9→v10 churn.

The 3D work itself (curves, raycasting, glTF) is the same three.js code in all four.

## 8. Asset sources and licences

| Source | Licence (exact, from source) | Relevant content found | Gaps |
|---|---|---|---|
| **Kenney** ([support/FAQ](https://kenney.nl/support)) | All game assets "public domain licensed (CC0)". "Attribution is not required". Commercial use is allowed. The Kenney logo is reserved. | [City Kit (Roads)](https://kenney.nl/assets/city-kit-roads) v2.2, CC0. v2.1 added road signs and traffic lights. [Car Kit](https://kenney.nl/assets/car-kit) v3.1, CC0, 45 files. Secondary listings (OpenGameArt) mention sedan, van, ambulance and separate wheels. [Train Kit](https://kenney.nl/assets/train-kit) v1.1, CC0, tagged "tram, trolley, track". Formats per the itch/OGA listings: glTF, FBX, OBJ. | The signs are generic, not Dutch RVV. I did not confirm whether Train Kit contains a tram vehicle or only track. |
| **Quaternius** ([FAQ](https://quaternius.com/faq.html)) | "All models are under the CC0 License". Attribution is not necessary. Free for commercial, educational and personal use. | Packs on [quaternius.com](https://quaternius.com/): Cars Pack, **Public Transport Pack** (OpenGameArt listing tags bicycle, bus, taxi, ambulance), Modular Train Pack, Modular Streets Pack, Downtown City MegaKit, plus rigged and animated people (Animated Men/Women, Ultimate Animated Character Pack, Universal Animation Library). | No tram confirmed. A cyclist would need a rider posed on a bicycle. |
| **Poly Pizza** ([poly.pizza](https://poly.pizza/)) | **Per model.** For example, "Bicycle" by Poly by Google ([/m/19VoUuA2pcN](https://poly.pizza/m/19VoUuA2pcN)) is "Creative Commons Attribution" (CC BY 3.0). Re-hosted Kenney/Quaternius items stay CC0. | Search results include several "Tram" models (Poly by Google, "jeremy") and many bicycles. It has an API (`/docs/api/v1.1`, whose content was not readable here). | CC-BY items need a credits page. Check each model's licence one by one and record it in a manifest. Style varies between authors. |
| **Wikimedia Commons: Dutch road signs** ([category](https://commons.wikimedia.org/wiki/Category:Diagrams_of_road_signs_of_the_Netherlands)) | Files tagged [`PD-NL-verkeersbord`](https://commons.wikimedia.org/wiki/Template:PD-NL-verkeersbord). The template says the sign is part of Dutch legislation and therefore public domain, citing art. 11 Auteurswet 1912. Example: [B6 (haaientanden/voorrang verlenen)](https://commons.wikimedia.org/wiki/File:Nederlands_verkeersbord_B6.svg), Public Domain Mark 1.0, SVG by Bouwe Brouwer. | SVGs for the RVV 1990 Bijlage 1 signs. These are the right source for B1–B7 priority signs, D1 roundabout, and so on. | Each file's licence still needs checking individually. Use the SVG as a texture or decal on a simple post-and-plate mesh (cheap and exact). |

Practical asset notes:
- No single CC0 pack covers Dutch specifics: red cycle paths (fietspad), haaientanden, Dutch-style roundabouts with cycle rings, trams, or the RVV signs. Expect to **generate roads, markings and signs procedurally** (§9) and use packs only for road users and props.
- Mixing Kenney and Quaternius styles is feasible because both are flat-colour low-poly. Poly Pizza / Google Poly items vary more in style.
- Keep a `assets/LICENSES.md` manifest: source URL, author, licence, any modifications. It is required for CC-BY and is good hygiene for CC0.

## 9. Procedural intersection and roundabout geometry

Feasible, and arguably the better choice. Scenarios are data (map Notes: Scenario, Road user, Passing order), so deriving the road from the same data keeps the geometry and the rules consistent. three.js r186 already provides the building blocks:
- **Road surfaces**:
  - `ShapeGeometry` / `ExtrudeGeometry` from a 2D `Shape`, which supports holes, for arms, junction polygons and kerbs. `ExtrudeGeometry`'s `extrudePath` can sweep a kerb profile along a curve.
  - `RingGeometry` for a roundabout carriageway, a cycle ring or a central island. `CircleGeometry` for the island top.
  - `PlaneGeometry` for straight arms.
- **Markings**: thin `ShapeGeometry` strips slightly above the asphalt, or `DecalGeometry` / `Line2`/`LineMaterial` (in `examples/jsm`). Haaientanden (shark teeth) are a row of small triangles, so they suit one `InstancedMesh`. Red fietspad surfaces are just another coloured strip.
- **Lane centrelines double as Replay paths**: the same `CurvePath` (straight → `QuadraticBezierCurve3` turn → straight) that drives a road user (§5) can be offset to build its lane.
- **Draw-call hygiene**: merge static road pieces per material with `BufferGeometryUtils.mergeGeometries`, so the whole intersection is a few draw calls.
- **Shapes to cover**: 4-arm cross, T-junction, Y/skew junction, roundabout (single-lane, with or without a separate cycle path), tram crossing, uitrit (exit kerb), erf (shared surface).
  - A small parametric generator (arm count, arm angles, lanes per arm, cycle path type, sign set) can cover most of the curriculum.
  - Hand-authored glTF is a fallback for special layouts.
- Alternative: Kenney's tile-based City Kit (Roads) on a grid. It is quick, but cannot do skewed arms, Dutch cycle-path layouts or haaientanden.

## 10. Mobile GPU budgets and techniques

Primary sources rarely publish a single number for the mobile web. The figures below are **planning targets with their provenance**, not limits:
- **Draw calls**:
  - Meta's Quest docs (mobile Snapdragon GPUs, a demanding case at 72 FPS stereo) give ranges of 200–1000 depending on headset and scene load. Meta's Unity Runtime Optimizer page suggests "below 300".
  - An Arm community forum answer (not the official guide) suggests about 500 on most phones.
  - Arm's Mali best-practices material stresses that state changes per draw matter more than the raw count.
  - **Suggested target for this app: ≤100 draw calls**, which is easy for one intersection plus 2–8 road users.
- **Triangles**: Meta's docs give no fixed triangle budget for Quest. Their PC guidance mentions 1–2 M per frame. **Suggested target: ≤100–200k triangles per scene**. Low-poly packs are typically hundreds to a few thousand triangles per vehicle, so the real constraint is draw calls and fill rate, not triangles.
- **Texture memory**:
  - Prefer flat vertex/material colours or a single small palette atlas. Kenney and Quaternius packs largely work this way.
  - Uncompressed RGBA8 is 4 bytes/pixel plus about ⅓ for mips, so a 2048² texture is about 21 MB of VRAM.
  - KTX2 (Basis ETC1S/UASTC) stays block-compressed on the GPU. KTX2Loader in r186 transcodes to ASTC, ETC2, BC7 or PVRTC depending on support.
  - Suggested target: **≤32 MB of texture memory**, and keep signs as small SVG-rasterised textures (256–512 px).
- **Other levers**:
  - Cap DPR at 2.
  - Use render-on-demand (§3).
  - Avoid real-time shadows, or use one small shadow map or baked contact shadows (`ContactShadows` / `BakeShadows` exist in drei and Threlte extras).
  - Avoid post-processing.
  - Use `MeshLambertMaterial`/`MeshStandardMaterial` without environment maps for a toy-like look.

Techniques and pipeline:
- **Instancing**:
  - `InstancedMesh` for repeated identical meshes (shark teeth, kerb segments, trees, parked cars).
  - `BatchedMesh` for many different static meshes sharing one material.
  - Both support raycasting with `instanceId`/`batchId`.
  - Wrapper helpers: drei `Instances`/`Merged`, Threlte `Instancing`, cientos `Instances`.
  - GLTFLoader supports `EXT_mesh_gpu_instancing`.
- **glTF compression**:
  - `GLTFLoader.setMeshoptDecoder` (decoder about 8 KB gz) versus `setDRACOLoader` (about 75 KB gz of wasm and JS).
  - For small low-poly models, meshopt plus quantisation is the lighter choice. Draco compresses geometry harder but costs decode time and download.
- **Pipeline**: `@gltf-transform/cli` ([docs](https://gltf-transform.dev/cli)).
  - Its `optimize` command runs "all available methods" (e.g. `--compress draco|meshopt`, `--texture-compress webp|ktx2`).
  - Separate commands exist for `instance`, `join`, `simplify`, `etc1s`/`uastc`.
  - The docs recommend running `inspect` first.
- **Decision rule**: use KTX2 only if textures exceed about 1–2 MB in total, because otherwise the 245 KB gz Basis transcoder outweighs the saving.

## Open points / not verified

- Exact contents of Kenney Car Kit, City Kit (Roads) and Train Kit: the asset pages list versions and file counts, not item lists. Download them and run `gltf-transform inspect` before relying on them, especially for a tram, emergency vehicles, and per-model triangle counts.
- Whether Quaternius's Public Transport Pack includes a tram. It does include a bicycle (OGA tags).
- The TresJS event docs page URL had moved. Its behaviour was confirmed from types only.
- Real-device frame timing was not measured. A prototype (ticket 0006) on a mid-range Android plus an iPhone would settle the performance questions far better than any published number.
