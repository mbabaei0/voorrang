# Context

An interactive web app that teaches Dutch traffic priority rules (voorrangsregels) to learner drivers preparing for the CBR theory exam. UI and lesson text in Dutch and English.

## Glossary

- **Priority** (voorrang): the right to proceed before another road user at a conflict point. The thing the app teaches.
- **Learner**: the person using the app; a learner driver preparing for the theory exam.
- **Scenario**: one situation at one location (intersection, roundabout, exit) with a set of road users, signs, and signals, for which there is a single correct order of proceeding.
- **Road user** (weggebruiker): any participant in a scenario: car, bicycle, moped, pedestrian, tram, bus, emergency vehicle.
- **Passing order**: the sequence in which road users may proceed in a scenario; some may proceed simultaneously.
- **Puzzle**: the learner's interaction with a scenario: choosing the passing order, then seeing it played out.
- **Replay**: the animated playback of a passing order, showing a conflict if the learner's order was wrong.

### Describing a scenario

- **Layout**: the shape of the location in a scenario, one of a small fixed set (crossroads, T-junction, roundabout, road with an exit). _Avoid_: map, level.
- **Arm**: one road leading into a layout, with its own surface (paved/unpaved), cycle path, tram track and lanes.
- **Control**: what an arm imposes on traffic approaching on it: a priority sign or haaientanden, traffic lights, or a zebra. _Avoid_: sign (too narrow).
- **Manoeuvre**: what a road user does at the location: turn left, go straight, turn right, leave an exit, cross on foot. Together with its arm and lane it fixes the road user's path.
- A scenario is a frozen moment: every road user is already waiting and lights do not change, so order of arrival never decides.

### Answers and explanations

- **Step**: one position in a passing order; the set of road users who may proceed at the same time.
- **Rule**: one named reason one road user goes before another, e.g. "from the right (RVV art. 15)". Explanations cite rules. _Avoid_: law, article (a rule may be narrower than an article).
- **Explanation**: why a road user waits, stated as a rule and the road users it waits for.
- **Law** vs **Convention**: the two kinds of rule. A law comes from the RVV/BABW; a convention is what CBR expects where the law is silent (e.g. the one leaving an exit goes first).
- **Deadlock**: a scenario where the rules form a cycle, so no one has priority. Resolved by a **waiver**: one road user in the cycle gives way by agreement, then the rest follows the rules.
- **You**: the road user the learner plays in a scenario, as in CBR's "you" questions. Optional.
- **Variant**: a scenario rotated so its arms face different directions. The same scenario for learning purposes; never mirrored, because mirroring swaps left and right.

### Learning

- **Topic**: a group of rules taught together, e.g. "Turning conflicts". A scenario belongs to the topics of the rules its explanations cite.
- **Lesson**, **Practice**, **Exam**: the three modes. A lesson introduces one topic with a worked example; practice repeats puzzles with feedback; an exam is a fixed set of puzzles with feedback only at the end.
- **Difficulty level**: how hard a scenario is, worked out from how many road users and topics it involves.
- **Mastery**: a learner's earned status on a topic, from a streak of first-try correct answers on distinct scenarios.
