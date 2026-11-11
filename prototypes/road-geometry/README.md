# Road geometry and puzzle prototypes (tickets 0008, 0006)

These are throwaway prototypes. They answer [ticket 0008](../../wayfinder/0008-prototype-road-geometry.md) (`geometry.html`) and [ticket 0006](../../wayfinder/0006-prototype-puzzle-interaction.md) (`puzzle.html`); the findings are in each ticket's Resolution.

- `src/layout.ts`: Layout, Arm and Control types; `manoeuvrePath`, which turns a road user into a `CurvePath`; and `rotateLayout`, which makes Variants.
- `src/conflicts.ts`: `conflicts`, which finds where road users' paths cross or merge.
- `src/scene.ts`: `buildScene`, which builds a three.js `Group` from merged, vertex-coloured static meshes (roads, kerbs, lamps, signs, lights) plus the road users and scenery.
- `src/models.ts`: low-poly road users (car, bus, tram, ambulance, cyclist, scooter, pedestrian) and seeded scenery (terraced houses, trees, bushes). Each road user is one merged mesh, and all scenery is one more.
- `src/main.ts` and `src/presets.ts`: a demo page that renders on demand. It has a preset picker, path and conflict overlays, and a live draw-call count.

- `src/puzzle/answer.ts`: the learner's answer (tap, link, move) and `score` against the Passing order.
- `src/puzzle/replay.ts`: `scheduleReplay`, which times each road user's Replay and stages the collision on a wrong answer.
- `src/puzzle/scenarios.ts` and `src/puzzle/main.ts`: the puzzle page, with interaction variants under "Settings" or from the URL (`?input=scene&ties=links&speed=2&orbit=on`). Defaults: the list plus tapping in the scene, the You camera, 1.5× replay.

The site around them:

- `index.html`: the landing page, with one playable crossroads (`src/landing/demo.ts`) and links to the puzzle and the rules.
- `rules.html`: the priority rules in plain language, by topic.
- `design-system.html`: the design system. Tokens are in `src/design/tokens.css`, components in `src/design/system.css`.

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
