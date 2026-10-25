import type { Layout, RoadUser } from '../layout';

/** A prototype Scenario: the Passing order and Explanations are written by hand (no rules engine yet). */
export type Scenario = {
  id: string;
  title: string;
  layout: Layout;
  roadUsers: RoadUser[];
  /** Road user the learner plays, for the "behind You" camera. */
  you?: string;
  passingOrder: string[][];
  /** Why each waiting road user waits. */
  explanations: Record<string, string>;
};

const compass = (extra: Partial<Layout['arms'][number]> = {}) =>
  [0, 90, 180, 270].map((bearing, i) => ({ id: 'nesw'[i]!, bearing, ...extra }));

export const scenarios: Scenario[] = [
  {
    id: 'turning-right',
    title: 'Turning right past a cycle path',
    layout: { kind: 'crossroads', arms: compass({ cyclePath: true }) },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'right' },
      { id: 'bike', kind: 'bicycle', arm: 's', manoeuvre: 'straight' },
      { id: 'ped', kind: 'pedestrian', arm: 'e', manoeuvre: 'cross' },
    ],
    you: 'car',
    passingOrder: [['bike', 'ped'], ['car']],
    explanations: {
      car: 'Turning right, you let the cyclist going straight on and the pedestrian crossing the side road go first (RVV art. 18).',
    },
  },
  {
    id: 'from-the-right',
    title: 'Unmarked crossroads',
    layout: { kind: 'crossroads', arms: compass() },
    roadUsers: [
      { id: 'blue', kind: 'car', arm: 's', manoeuvre: 'straight' },
      { id: 'bus', kind: 'bus', arm: 'w', manoeuvre: 'straight' },
      { id: 'moped', kind: 'moped', arm: 'n', manoeuvre: 'right' },
    ],
    you: 'bus',
    passingOrder: [['blue', 'moped'], ['bus']],
    explanations: {
      bus: 'The car from the south comes from your right, so it goes first (RVV art. 15). The moped turning right never crosses your path.',
    },
  },
  {
    id: 'tram-and-ambulance',
    title: 'Tram, ambulance and a stop sign',
    layout: {
      kind: 't-junction',
      arms: [
        { id: 'e', bearing: 90, tram: true },
        { id: 's', bearing: 180, control: { priority: 'B7' } },
        { id: 'w', bearing: 270, tram: true },
      ],
    },
    roadUsers: [
      { id: 'tram', kind: 'tram', arm: 'w', manoeuvre: 'straight' },
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'left' },
      { id: 'ambulance', kind: 'voorrangsvoertuig', arm: 'e', manoeuvre: 'left' },
    ],
    you: 'car',
    passingOrder: [['ambulance'], ['tram'], ['car']],
    explanations: {
      tram: 'An emergency vehicle using blue lights and siren goes before everyone, the tram included (RVV art. 50).',
      car: 'You wait for the ambulance (RVV art. 50), then stop at the STOP sign (B7) and give way to all traffic on the main road, the tram included (RVV art. 62, Bijlage 1).',
    },
  },
  {
    id: 'lights-left-turn',
    title: 'Green light, turning left',
    layout: {
      kind: 'crossroads',
      arms: compass().map((arm) => ({
        ...arm,
        lanesIn: 2,
        control: { lights: arm.id === 'n' || arm.id === 's' ? ('green' as const) : ('red' as const), zebra: true },
      })),
    },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'left', lane: 1 },
      { id: 'bus', kind: 'bus', arm: 'n', manoeuvre: 'straight' },
      { id: 'ped', kind: 'pedestrian', arm: 'w', manoeuvre: 'cross' },
    ],
    you: 'car',
    passingOrder: [['bus', 'ped'], ['car']],
    explanations: {
      car: 'Green does not mean you go first: turning left, you let oncoming traffic and the pedestrian crossing your new road go (RVV art. 18).',
    },
  },
];
