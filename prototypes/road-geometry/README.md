# Road geometry prototype (ticket 0008)

This is a throwaway prototype. It answers [ticket 0008](../../wayfinder/0008-prototype-road-geometry.md); the findings are in that ticket's Resolution.

- `src/layout.ts`: Layout, Arm and Control types; `manoeuvrePath`, which turns a road user into a `CurvePath`; and `rotateLayout`, which makes Variants.
- `src/conflicts.ts`: `conflicts`, which finds where road users' paths cross or merge.
- `src/scene.ts`: `buildScene`, which builds a three.js `Group` from merged, vertex-coloured static meshes plus placeholder road users.
- `src/main.ts` and `src/presets.ts`: a demo page that renders on demand. It has a preset picker, path and conflict overlays, and a live draw-call count.

Run the tests:

```bash
npm install && npm test
```

Start the demo page:

```bash
npm run dev
```
