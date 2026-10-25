import { rotateLayout, type Layout, type RoadUser } from './layout';

type Preset = { layout: Layout; roadUsers: RoadUser[] };

const compass = (cyclePath = false) => [
  { id: 'n', bearing: 0, cyclePath },
  { id: 'e', bearing: 90, cyclePath },
  { id: 's', bearing: 180, cyclePath },
  { id: 'w', bearing: 270, cyclePath },
];

const unmarked: Preset = {
  layout: { kind: 'crossroads', arms: compass(true) },
  roadUsers: [
    { id: 'car', kind: 'car', arm: 's', manoeuvre: 'right' },
    { id: 'bike', kind: 'bicycle', arm: 's', manoeuvre: 'straight' },
    { id: 'van', kind: 'car', arm: 'w', manoeuvre: 'straight' },
    { id: 'ped', kind: 'pedestrian', arm: 'e', manoeuvre: 'cross' },
  ],
};

export const presets: Record<string, Preset> = {
  'Crossroads, unmarked, cycle paths': unmarked,
  'Same, rotated Variant (60°)': { ...unmarked, layout: rotateLayout(unmarked.layout, 60) },
  'Crossroads, priority road (B1 / B6)': {
    layout: {
      kind: 'crossroads',
      arms: [
        { id: 'n', bearing: 0, control: { priority: 'B1' } },
        { id: 'e', bearing: 90, control: { priority: 'B6' } },
        { id: 's', bearing: 180, control: { priority: 'B1' } },
        { id: 'w', bearing: 270, control: { priority: 'B6' } },
      ],
    },
    roadUsers: [
      { id: 'a', kind: 'car', arm: 'n', manoeuvre: 'left' },
      { id: 'b', kind: 'car', arm: 's', manoeuvre: 'straight' },
      { id: 'c', kind: 'moped', arm: 'e', manoeuvre: 'straight' },
    ],
  },
  'Traffic lights, two lanes in': {
    layout: {
      kind: 'crossroads',
      arms: compass().map((arm) => ({
        ...arm,
        lanesIn: 2,
        control: { lights: arm.id === 'n' || arm.id === 's' ? ('green' as const) : ('red' as const), zebra: true },
      })),
    },
    roadUsers: [
      { id: 'left', kind: 'car', arm: 's', manoeuvre: 'left', lane: 1 },
      { id: 'oncoming', kind: 'bus', arm: 'n', manoeuvre: 'straight' },
      { id: 'ped', kind: 'pedestrian', arm: 'w', manoeuvre: 'cross' },
    ],
  },
  'T-junction with tram, stop sign': {
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
  },
  'Skewed junction (Y)': {
    layout: {
      kind: 't-junction',
      arms: [
        { id: 'n', bearing: 0 },
        { id: 'se', bearing: 135, control: { priority: 'haaientanden' } },
        { id: 'sw', bearing: 225 },
      ],
    },
    roadUsers: [
      { id: 'a', kind: 'car', arm: 'se', manoeuvre: 'left' },
      { id: 'b', kind: 'car', arm: 'sw', manoeuvre: 'right' },
      { id: 'c', kind: 'bicycle', arm: 'n', manoeuvre: 'left' },
    ],
  },
  'Roundabout with cycle ring': {
    layout: {
      kind: 'roundabout',
      arms: compass(true).map((arm) => ({ ...arm, control: { priority: 'B6' as const } })),
    },
    roadUsers: [
      { id: 'entering', kind: 'car', arm: 's', manoeuvre: 'straight' },
      { id: 'circulating', kind: 'car', arm: 'w', manoeuvre: 'left' },
      { id: 'bike', kind: 'bicycle', arm: 'w', manoeuvre: 'straight' },
      { id: 'ped', kind: 'pedestrian', arm: 'e', manoeuvre: 'cross' },
    ],
  },
  'Road with an exit (uitrit)': {
    layout: {
      kind: 'exit',
      arms: [
        { id: 'n', bearing: 0, cyclePath: true },
        { id: 'e', bearing: 90, exit: true },
        { id: 's', bearing: 180, cyclePath: true },
      ],
    },
    roadUsers: [
      { id: 'leaving', kind: 'car', arm: 'e', manoeuvre: 'right' },
      { id: 'bike', kind: 'bicycle', arm: 's', manoeuvre: 'straight' },
      { id: 'car', kind: 'car', arm: 'n', manoeuvre: 'straight' },
    ],
  },
};
