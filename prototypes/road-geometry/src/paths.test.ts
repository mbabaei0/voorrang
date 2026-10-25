import { describe, expect, it } from 'vitest';
import type { Vector3 } from 'three';
import { ISLAND_RADIUS, manoeuvrePath, rotateLayout, type Layout } from './layout';

// Scene coordinates are three.js: x = east, y = up, z = south.
// Tests read positions back as [east, north] metres, rounded to 0.01.
const plan = (v: Vector3) => [round(v.x), round(-v.z)];
const round = (n: number) => Math.round(n * 100) / 100 + 0;

const crossroads: Layout = {
  kind: 'crossroads',
  arms: [
    { id: 'n', bearing: 0 },
    { id: 'e', bearing: 90 },
    { id: 's', bearing: 180 },
    { id: 'w', bearing: 270 },
  ],
};

describe('manoeuvrePath on a crossroads', () => {
  it('goes straight from the south arm to the north arm, keeping right', () => {
    const path = manoeuvrePath(crossroads, { id: 'car', kind: 'car', arm: 's', manoeuvre: 'straight' });
    expect(plan(path.getPointAt(0))).toEqual([1.75, -30]);
    expect(plan(path.getPointAt(1))).toEqual([1.75, 30]);
  });

  it('turns right from the south arm into the east arm, heading east at the end', () => {
    const path = manoeuvrePath(crossroads, { id: 'car', kind: 'car', arm: 's', manoeuvre: 'right' });
    expect(plan(path.getPointAt(0))).toEqual([1.75, -30]);
    expect(plan(path.getPointAt(1))).toEqual([30, -1.75]);
    expect(plan(path.getTangentAt(1))).toEqual([1, 0]);
  });

  it('turns left from the south arm into the west arm, passing south-west of the centre', () => {
    const path = manoeuvrePath(crossroads, { id: 'car', kind: 'car', arm: 's', manoeuvre: 'left' });
    expect(plan(path.getPointAt(1))).toEqual([-30, 1.75]);
    expect(plan(path.getTangentAt(1))).toEqual([-1, 0]);
    // Opposing left turns pass in front of each other, so each stays on its own side of the centre.
    const [east, north] = plan(path.getPointAt(0.5));
    expect(east).toBeLessThan(0);
    expect(north).toBeLessThan(0);
  });

  it('rotates with a Variant: a quarter turn clockwise moves the right turn from east to south', () => {
    const variant = rotateLayout(crossroads, 90);
    const path = manoeuvrePath(variant, { id: 'car', kind: 'car', arm: 's', manoeuvre: 'right' });
    // Arm "s" now points west; turning right from it heads south.
    expect(plan(path.getPointAt(0))).toEqual([-30, -1.75]);
    expect(plan(path.getPointAt(1))).toEqual([-1.75, -30]);
  });

  it('puts a cyclist on the cycle path: 3.5 m lane, 1 m verge, then the middle of a 2 m path', () => {
    const withCyclePaths: Layout = {
      ...crossroads,
      arms: crossroads.arms.map((arm) => ({ ...arm, cyclePath: true })),
    };
    const path = manoeuvrePath(withCyclePaths, { id: 'bike', kind: 'bicycle', arm: 's', manoeuvre: 'straight' });
    expect(plan(path.getPointAt(0))).toEqual([5.5, -30]);
    expect(plan(path.getPointAt(1))).toEqual([5.5, 30]);
  });

  it('keeps a cyclist 1 m from the kerb on an arm without a cycle path', () => {
    const path = manoeuvrePath(crossroads, { id: 'bike', kind: 'bicycle', arm: 's', manoeuvre: 'straight' });
    expect(plan(path.getPointAt(0))).toEqual([2.5, -30]);
  });

  it('starts a car in the lane it is given, counting lanes from the right, so lane 1 of 2 is beside the centreline', () => {
    const twoLanes: Layout = {
      ...crossroads,
      arms: crossroads.arms.map((arm) => (arm.id === 's' ? { ...arm, lanesIn: 2 } : arm)),
    };
    const path = manoeuvrePath(twoLanes, { id: 'car', kind: 'car', arm: 's', manoeuvre: 'left', lane: 1 });
    expect(plan(path.getPointAt(0))).toEqual([1.75, -30]);
  });

  it('walks a pedestrian across an arm just outside the junction, from footway to footway', () => {
    // Junction edge at 3.5 m lane + 1.5 m margin = 5 m; a 3 m crossing band beyond it, centred at 6.5 m.
    // Footways start 1.5 m outside the 3.5 m lanes.
    const path = manoeuvrePath(crossroads, { id: 'ped', kind: 'pedestrian', arm: 'e', manoeuvre: 'cross' });
    expect(plan(path.getPointAt(0))).toEqual([6.5, 5]);
    expect(plan(path.getPointAt(1))).toEqual([6.5, -5]);
  });
});

describe('manoeuvrePath on other Layouts', () => {
  const tJunction: Layout = {
    kind: 't-junction',
    arms: [
      { id: 'e', bearing: 90, tram: true },
      { id: 's', bearing: 180 },
      { id: 'w', bearing: 270, tram: true },
    ],
  };

  it('refuses a manoeuvre with no arm to leave by, such as straight on from the stem of a T', () => {
    expect(() => manoeuvrePath(tJunction, { id: 'car', kind: 'car', arm: 's', manoeuvre: 'straight' })).toThrow(
      /No arm to go straight/,
    );
  });

  it('refuses a Layout with only one arm', () => {
    const stub: Layout = { kind: 't-junction', arms: [{ id: 's', bearing: 180 }] };
    expect(() => manoeuvrePath(stub, { id: 'car', kind: 'car', arm: 's', manoeuvre: 'left' })).toThrow(/No arm to go left/);
  });

  it('runs a tram on the right-hand of two tracks laid 1.5 m apart down the middle of the road', () => {
    const path = manoeuvrePath(tJunction, { id: 'tram', kind: 'tram', arm: 'w', manoeuvre: 'straight' });
    expect(plan(path.getPointAt(0))).toEqual([-30, -0.75]);
    expect(plan(path.getPointAt(1))).toEqual([30, -0.75]);
  });
});

describe('manoeuvrePath on a roundabout', () => {
  const roundabout: Layout = { ...crossroads, kind: 'roundabout' };
  const samples = (path: ReturnType<typeof manoeuvrePath>) =>
    Array.from({ length: 201 }, (_, i) => plan(path.getPointAt(i / 200)));

  it('takes the third exit anticlockwise, round the east side of the island', () => {
    const path = manoeuvrePath(roundabout, { id: 'car', kind: 'car', arm: 's', manoeuvre: 'left' });
    expect(plan(path.getPointAt(1))).toEqual([-30, 1.75]);
    const points = samples(path);
    expect(points.every(([e, n]) => Math.hypot(e!, n!) > ISLAND_RADIUS)).toBe(true);
    const eastIndex = points.findIndex(([e, n]) => e! > ISLAND_RADIUS && Math.abs(n!) < 1);
    const northIndex = points.findIndex(([e, n]) => n! > ISLAND_RADIUS && Math.abs(e!) < 1);
    expect(eastIndex).toBeGreaterThan(-1);
    expect(northIndex).toBeGreaterThan(eastIndex);
  });

  it('takes the first exit without passing any other arm', () => {
    const path = manoeuvrePath(roundabout, { id: 'car', kind: 'car', arm: 's', manoeuvre: 'right' });
    expect(plan(path.getPointAt(1))).toEqual([30, -1.75]);
    expect(samples(path).every(([, n]) => n! < 0)).toBe(true);
  });
});
