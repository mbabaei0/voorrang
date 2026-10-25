# Road geometry and puzzle prototypes (tickets 0008, 0006)

These are throwaway prototypes. They answer [ticket 0008](../../wayfinder/0008-prototype-road-geometry.md) (`index.html`) and [ticket 0006](../../wayfinder/0006-prototype-puzzle-interaction.md) (`puzzle.html`); the findings are in each ticket's Resolution.

- `src/layout.ts`: Layout, Arm and Control types; `manoeuvrePath`, which turns a road user into a `CurvePath`; and `rotateLayout`, which makes Variants.
- `src/conflicts.ts`: `conflicts`, which finds where road users' paths cross or merge.
- `src/scene.ts`: `buildScene`, which builds a three.js `Group` from merged, vertex-coloured static meshes plus placeholder road users.
- `src/main.ts` and `src/presets.ts`: a demo page that renders on demand. It has a preset picker, path and conflict overlays, and a live draw-call count.

- `src/puzzle/answer.ts`: the learner's answer (tap, link, move) and `score` against the Passing order.
- `src/puzzle/replay.ts`: `scheduleReplay`, which times each road user's Replay and stages the collision on a wrong answer.
- `src/puzzle/scenarios.ts` and `src/puzzle/main.ts`: the puzzle page, with interaction variants under "Variants" or from the URL (`?input=tray&ties=links&speed=2&orbit=on`).

Run the tests:

```bash
npm install && npm test
```

Start the demo page:

```bash
npm run dev
```

To try the puzzle on a phone on the same network, run this and open `http://<computer-ip>:5173/puzzle.html`:

```bash
npm run dev:phone
```
