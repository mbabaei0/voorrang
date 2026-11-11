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

/** A turbo roundabout: two lanes on every approach, B6 at every entry. The ring itself is drawn single-lane. */
const turbo = (): Layout => ({
  kind: 'roundabout',
  arms: compass().map((arm) => ({ ...arm, lanesIn: 2, control: { priority: 'B6' as const } })),
});

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
  {
    id: 'roundabout-entry',
    title: 'Entering a roundabout',
    layout: {
      kind: 'roundabout',
      arms: compass().map((arm) => ({ ...arm, control: { priority: 'B6' as const } })),
    },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'straight' },
      { id: 'circulating', kind: 'car', arm: 'w', manoeuvre: 'left' },
    ],
    you: 'car',
    passingOrder: [['circulating'], ['car']],
    explanations: {
      car: 'The shark teeth (B6) at the entry mean traffic already on the roundabout goes first, so you wait for the car circulating past your entry (RVV art. 15, Bijlage 1).',
    },
  },
  {
    id: 'shark-teeth',
    title: 'Shark teeth on a side road',
    layout: {
      kind: 't-junction',
      arms: [
        { id: 'e', bearing: 90 },
        { id: 's', bearing: 180, control: { priority: 'haaientanden' } },
        { id: 'w', bearing: 270 },
      ],
    },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'left' },
      { id: 'west', kind: 'car', arm: 'w', manoeuvre: 'straight' },
      { id: 'east', kind: 'bus', arm: 'e', manoeuvre: 'straight' },
    ],
    you: 'car',
    passingOrder: [['west', 'east'], ['car']],
    explanations: {
      car: 'The shark teeth painted on your road (haaientanden) mean you give way to everyone on the road you join, from both directions (RVV art. 15, Bijlage 1).',
    },
  },
  {
    id: 'leaving-a-driveway',
    title: 'Leaving a driveway',
    layout: {
      kind: 'exit',
      arms: [
        { id: 'n', bearing: 0, cyclePath: true },
        { id: 'e', bearing: 90, exit: true },
        { id: 's', bearing: 180, cyclePath: true },
      ],
    },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 'e', manoeuvre: 'right' },
      { id: 'bike', kind: 'bicycle', arm: 's', manoeuvre: 'straight' },
      { id: 'passing', kind: 'car', arm: 'n', manoeuvre: 'straight' },
    ],
    you: 'car',
    passingOrder: [['bike', 'passing'], ['car']],
    explanations: {
      car: 'Coming out of a driveway (uitrit) you give way to everything on the road, the cyclist on the cycle path included (RVV art. 19).',
    },
  },
  {
    id: 'cyclist-from-the-right',
    title: 'A cyclist from the right',
    layout: { kind: 'crossroads', arms: compass() },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'straight' },
      { id: 'bike', kind: 'bicycle', arm: 'e', manoeuvre: 'straight' },
    ],
    you: 'car',
    passingOrder: [['bike'], ['car']],
    explanations: {
      car: 'Without signs, everyone from the right goes first, and that includes cyclists and moped riders (RVV art. 15).',
    },
  },
  {
    id: 'left-and-oncoming-right',
    title: 'Left turn, oncoming right turn',
    layout: { kind: 'crossroads', arms: compass() },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'left' },
      { id: 'oncoming', kind: 'car', arm: 'n', manoeuvre: 'right' },
    ],
    you: 'car',
    passingOrder: [['oncoming'], ['car']],
    explanations: {
      car: 'Both of you end up in the same road. Turning left, you let oncoming traffic go, even when it turns right (RVV art. 18).',
    },
  },
  {
    id: 'give-way-side-road',
    title: 'Giving way from a side road',
    layout: {
      kind: 'crossroads',
      arms: compass().map((arm) => (arm.id === 's' ? { ...arm, control: { priority: 'B6' as const } } : arm)),
    },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'straight' },
      { id: 'west', kind: 'car', arm: 'w', manoeuvre: 'straight' },
      { id: 'moped', kind: 'moped', arm: 'e', manoeuvre: 'right' },
    ],
    you: 'car',
    passingOrder: [['west', 'moped'], ['car']],
    explanations: {
      car: 'The give way sign (B6) on your road beats the right-hand rule: you wait for traffic from both sides, including the moped turning into your road (RVV art. 63, Bijlage 1).',
    },
  },
  {
    id: 'zebra-right-turn',
    title: 'Turning right at a zebra crossing',
    layout: {
      kind: 'crossroads',
      arms: compass().map((arm) => ({ ...arm, control: { zebra: true } })),
    },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'right' },
      { id: 'ped', kind: 'pedestrian', arm: 'e', manoeuvre: 'cross' },
    ],
    you: 'car',
    passingOrder: [['ped'], ['car']],
    explanations: {
      car: 'The pedestrian is on the zebra crossing of the road you turn into, so you stop and let them cross (RVV art. 49).',
    },
  },
  {
    id: 'tram-from-the-left',
    title: 'A tram from the left',
    layout: {
      kind: 'crossroads',
      arms: compass().map((arm) => (arm.id === 'e' || arm.id === 'w' ? { ...arm, tram: true } : arm)),
    },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'straight' },
      { id: 'tram', kind: 'tram', arm: 'w', manoeuvre: 'straight' },
    ],
    you: 'car',
    passingOrder: [['tram'], ['car']],
    explanations: {
      car: 'The tram comes from your left, but a tram always goes first at a junction, from either side (RVV art. 15).',
    },
  },
  {
    id: 'red-light',
    title: 'Waiting at a red light',
    layout: {
      kind: 'crossroads',
      arms: compass().map((arm) => ({
        ...arm,
        control: { lights: arm.id === 'n' || arm.id === 's' ? ('green' as const) : ('red' as const) },
      })),
    },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 'w', manoeuvre: 'straight' },
      { id: 'bus', kind: 'bus', arm: 'n', manoeuvre: 'straight' },
    ],
    you: 'car',
    passingOrder: [['bus'], ['car']],
    explanations: {
      car: 'Your light is red: you stop at the stop line and wait for crossing traffic, which has green (RVV art. 68).',
    },
  },
  {
    id: 'lights-out',
    title: 'Traffic lights out of order',
    layout: {
      kind: 'crossroads',
      arms: compass().map((arm) => ({ ...arm, control: { lights: 'off' as const } })),
    },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'straight' },
      { id: 'bike', kind: 'bicycle', arm: 'e', manoeuvre: 'straight' },
      { id: 'moped', kind: 'moped', arm: 'n', manoeuvre: 'right' },
    ],
    you: 'car',
    passingOrder: [['bike', 'moped'], ['car']],
    explanations: {
      car: 'Dark lights control nothing. With no signs, the general rules apply again: the cyclist from your right goes first (RVV art. 75, art. 15).',
    },
  },
  {
    id: 'ambulance-first',
    title: 'An ambulance at an unmarked crossroads',
    layout: { kind: 'crossroads', arms: compass() },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'straight' },
      { id: 'ambulance', kind: 'voorrangsvoertuig', arm: 'w', manoeuvre: 'straight' },
      { id: 'bus', kind: 'bus', arm: 'e', manoeuvre: 'straight' },
    ],
    you: 'car',
    passingOrder: [['ambulance', 'bus'], ['car']],
    explanations: {
      car: 'The ambulance with blue lights and siren goes first, whatever the other rules say (RVV art. 50). Then the bus from your right goes before you (RVV art. 15).',
    },
  },
  {
    id: 'unpaved-road',
    title: 'Coming off an unpaved road',
    layout: {
      kind: 'crossroads',
      arms: compass().map((arm) => (arm.id === 's' ? { ...arm, surface: 'unpaved' as const } : arm)),
    },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'straight' },
      { id: 'paved', kind: 'car', arm: 'w', manoeuvre: 'straight' },
    ],
    you: 'car',
    passingOrder: [['paved'], ['car']],
    explanations: {
      car: 'The car from the left is on a paved road and you are on an unpaved one: unpaved yields to paved, whichever side it comes from (RVV art. 15).',
    },
  },
  {
    id: 'left-turn-oncoming-cyclist',
    title: 'Left turn, oncoming cyclist',
    layout: { kind: 'crossroads', arms: compass({ cyclePath: true }) },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'left' },
      { id: 'bike', kind: 'bicycle', arm: 'n', manoeuvre: 'straight' },
      { id: 'ped', kind: 'pedestrian', arm: 'w', manoeuvre: 'cross' },
    ],
    you: 'car',
    passingOrder: [['bike', 'ped'], ['car']],
    explanations: {
      car: 'Turning left, you let the oncoming cyclist and the pedestrian crossing the road you turn into go first (RVV art. 18).',
    },
  },
  {
    id: 'turbo-left-lane',
    title: 'Turbo roundabout: left lane',
    layout: turbo(),
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'straight', lane: 1 },
      { id: 'circulating', kind: 'car', arm: 'w', manoeuvre: 'straight' },
    ],
    you: 'car',
    passingOrder: [['circulating'], ['car']],
    explanations: {
      car: 'You chose the left lane for going straight on. The B6 sign still applies to both lanes: you wait for the car already on the roundabout (RVV art. 15, Bijlage 1).',
    },
  },
  {
    id: 'turbo-two-lanes',
    title: 'Turbo roundabout: two lanes entering',
    layout: turbo(),
    roadUsers: [
      { id: 'right', kind: 'car', arm: 's', manoeuvre: 'right' },
      { id: 'left', kind: 'car', arm: 's', manoeuvre: 'straight', lane: 1 },
      { id: 'circulating', kind: 'bus', arm: 'w', manoeuvre: 'straight' },
    ],
    you: 'right',
    passingOrder: [['circulating'], ['right', 'left']],
    explanations: {
      right: 'Both lanes on your arm give way to the bus on the roundabout. Once it has passed, the two lanes are kept apart by the lane dividers and can enter side by side (RVV art. 15, Bijlage 1).',
      left: 'You wait for the bus on the roundabout. Never switch lanes on a turbo roundabout: the lane you chose before the entry decides where you can exit.',
    },
  },
  {
    id: 'turbo-long-way-round',
    title: 'Turbo roundabout: third exit',
    layout: turbo(),
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'straight', lane: 1 },
      { id: 'bus', kind: 'bus', arm: 'n', manoeuvre: 'left' },
    ],
    you: 'car',
    passingOrder: [['bus'], ['car']],
    explanations: {
      car: 'The bus is taking the third exit and passes your entry on the way, so it is on the roundabout and goes first (RVV art. 15, Bijlage 1).',
    },
  },
  {
    id: 'turbo-exit-zebra',
    title: 'Turbo roundabout: leaving at a zebra',
    layout: {
      kind: 'roundabout',
      arms: compass().map((arm) => ({ ...arm, lanesIn: 2, control: { priority: 'B6' as const, zebra: true } })),
    },
    roadUsers: [
      { id: 'car', kind: 'car', arm: 's', manoeuvre: 'right' },
      { id: 'ped', kind: 'pedestrian', arm: 'e', manoeuvre: 'cross' },
    ],
    you: 'car',
    passingOrder: [['ped'], ['car']],
    explanations: {
      car: 'Leaving the roundabout you reach a zebra crossing: stop and let the pedestrian cross before you drive on (RVV art. 49).',
    },
  },
];
