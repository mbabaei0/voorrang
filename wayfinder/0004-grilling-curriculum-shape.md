---
id: 4
title: "Grilling: curriculum shape"
labels: [wayfinder:grilling]
parent: 0
status: closed
assignee: mylen
blocked_by: [1]
---

## Question

How is learning structured? Decide: the topic list and order, what a lesson is vs practice vs exam mode, how and when explanations are shown (on mistake, always, after replay), difficulty progression, and what counts as mastering a topic.

## Resolution

Decided by the agent: the user delegated this ticket ("close them with your decision").

- **Topics**, in suggested order. Each Topic is a set of Rules, so a Scenario's topics follow from the Rules it cites ([Grilling: the scenario model](0003-grilling-scenario-model.md)):
  1. Unmarked junctions: from the right, bikes and mopeds count, paved over unpaved (art. 15)
  2. Turning conflicts: oncoming traffic, straight-on cyclists and pedestrians alongside, left turner vs oncoming right turner (art. 18)
  3. Priority signs and haaientanden (B1–B7, art. 80)
  4. Roundabouts (signs decide; right-hand rule when unsigned)
  5. Traffic lights, including lights out and flashing yellow (art. 75)
  6. Trams
  7. Emergency vehicles (blue light *and* siren)
  8. Uitritten, pulling away and erven (art. 54)
  9. Pedestrians and zebras (art. 49)
  10. Mixed (draws from every topic), with Deadlocks as an optional advanced set
- **No locking.** All topics are open; the order is a recommendation shown as "next up".
- **Three modes:**
  - **Lesson** (one per topic): one worked example played as a Replay with its Explanation, then 3–5 guided Puzzles at the lowest difficulty.
  - **Practice**: endless Puzzles from one chosen topic or from Mixed, with scenarios the learner got wrong coming back sooner.
  - **Exam**: 10 Puzzles from Mixed with no feedback until the end. Passing is 9/10, mirroring CBR's 44/50 (88%). No timer.
- **Explanations:** in Lesson and Practice, always shown after the Replay. On a wrong answer, the Replay stops at the first conflict and highlights the road user that went too early, with its Explanation. In Exam, explanations come only on the end-of-exam review.
- **Difficulty** is derived from the scenario, not tagged by hand. Level 1: 2 road users and 1 Rule. Level 2: 3 road users. Level 3: 4+ road users, or Rules from 2+ topics. Deadlocks sit above level 3 and appear only in the advanced set.
- **Mastery** of a topic: 5 first-try correct answers in a row on *distinct* scenarios (Variants count as the same scenario), at least 2 of them at the topic's highest available level. One wrong answer resets the streak but never removes mastery once earned. Progress is stored per scenario in browser storage: last result, first-try flag, date.
- **Launch content:** at least 12 authored scenarios per topic (about 4 per level), so mastery never needs repeats; rotated Variants add variety on top.
