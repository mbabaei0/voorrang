---
id: 6
title: "Prototype: puzzle interaction feel"
labels: [wayfinder:prototype]
parent: 0
status: closed
assignee: mylen
blocked_by: [5, 7]
---

## Question

How should a Puzzle feel on a phone? Build a rough single-intersection prototype to decide: how the learner selects the passing order (tap sequence, drag, numbered badges), camera behaviour (fixed, orbit, presets), replay pacing, how a conflict is shown on a wrong answer, and how simultaneous moves are expressed.

## Context

- Measure frame timing on one mid-range Android phone and one iPhone; the budgets in the stack research are indirect.
- Scoring of simultaneous moves depends on the CBR ties research (ticket 7).

## Resolution

Prototype: `puzzle.html` in [prototypes/road-geometry](../prototypes/road-geometry/README.md), built on the road geometry prototype (0008). It has four Scenarios with hand-authored Passing orders. Tests cover the two agreed seams, the answer model with scoring and the Replay timeline, plus a consistency check on each Scenario. Every interaction alternative can be switched under "Variants" or from the URL, for example `puzzle.html?input=tray&ties=links&speed=2&orbit=on`. The recommendations below are the agent's, from trying the page at phone size in a desktop browser. They still need a feel test on real phones; see "Outstanding" at the end.

### Decisions

- **Choosing the passing order**
  - The learner taps road users in the 3D scene, and each one gets a numbered badge.
  - Badges are `CSS2DRenderer` DOM labels, so they translate and stay crisp. Taps hit enlarged invisible boxes, at least 2.5 × 3 m, so a pedestrian is easy to hit on a phone.
  - Tapping a road user again takes it back out, and the numbers after it move up.
  - The same order shows as chips in a tray under the scene. The tray is not a second input in the default mode, but it is the base of the accessible non-3D path: with "tapping chips", the whole Puzzle can be done from the tray, and placed chips can be dragged to a new position.
  - Drag-only ordering was not better: the learner has to map chips back onto the scene.
- **Ties (simultaneous moves)**
  - **Default: no tie control.** The learner numbers 1-2-3 strictly, as CBR does (0007).
  - Scoring accepts any order within a Step. **A road user also only has to wait for road users whose paths actually meet its own** (taken from the conflict points).
  - The Replay shows a Step moving off together, which is enough to teach that they may go together.
  - "Link" buttons between chips (marking a tie explicitly) work, but they add a control most Puzzles never need. Keep them as an optional extension, if at all.
- **Camera**
  - The default is a fixed, angled overview.
  - Two preset buttons sit beside it: **Top**, and **You** (behind the road user the learner plays).
  - Orbit is **off by default**: on a phone a drag competes with tapping, and the presets are enough. Taps are told apart from drags (under 8 px and 500 ms) so orbit can be an option.
  - The "You" view crops cross traffic in portrait, a 20 m tram especially. Use it as a second view, never as the default.
- **Replay pacing**
  - Speeds in m/s: car 7, bus and tram 6, ambulance 9, moped 6, bicycle 4.5, pedestrian 2.5.
  - Each road user pulls away as soon as every road user in an earlier Step has cleared the conflict points they share, with a 0.4 s beat between Steps.
  - The Replay ends when the last road user has cleared the junction, not when it reaches the end of its arm. That gives about 3–7 s at 1× for three road users, with 0.5× and 2× available.
  - Rendering is on demand: the frame loop runs only during a Replay or a camera move.
- **Showing the conflict on a wrong answer**
  1. The road user that the early one should have waited for takes its priority anyway. It is timed so that both reach their shared conflict point together, which guarantees there is something to see.
  2. The Replay slows to 0.3× for the last 1.5 s and stops at the collision.
  3. A red ring marks the point, the camera glides in to about 22 m, and only the badge of the road user that went too early stays visible, in red. Otherwise the two badges sit on top of each other.
  4. A feedback card over the scene names who went too early and whom it hit, followed by its Explanation.
  5. "Show correct order" then replays the Passing order.
  
  This implements 0004's "stops at the first conflict and highlights the road user that went too early".
- **Layout:** the scene sits on top and the order tray and buttons sit below it. The tray and the prompt keep a fixed height, and feedback floats over the scene, so the 3D view never jumps while the learner answers.

### Consequences for other decisions

- **Scenario model (0003):** Steps alone are too strict. Two road users in different Steps whose paths never meet may go in either order. Scoring therefore needs the conflict pairs as well as the Passing order. These come from the Layout geometry, so the rules engine or build check should derive them, and Explanations must not claim a wait between road users that never meet.
- **Stack (0005):** the puzzle page ships at about 158 KB gzipped of JS (three.js, the scene and the puzzle code), in line with the research's estimate of about 155 KB. A Replay renders in 4–6 draw calls with the current camera framing.

### Frame timing

- **Not measured on real phones.** The agent had no devices. In a desktop browser at a 360 × 640 phone viewport, Replays ran at avg 16.6 ms and p95 about 18 ms per frame. That is vsync-bound, so it says little about phones.
- **To measure:**
  1. In `prototypes/road-geometry`, run `npm run dev:phone`.
  2. On each phone, on the same network, open `http://<computer-ip>:5173/puzzle.html`.
  3. Play a Replay and open "Variants". It shows frame count, avg and p95 frame time, and draw calls.

### Outstanding

- The real-device frame timing above, on a mid-range Android phone and an iPhone.
- A feel test of tap targets and chip dragging with real touch.
- Pedestrian light states for signalled crossings: the scenario model gives lights per movement, but the prototype has one state per Arm.
- UI strings are English only. In the app they become Paraglide messages; the Explanation templates take road-user parameters.
