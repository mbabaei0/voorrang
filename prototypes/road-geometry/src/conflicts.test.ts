import { describe, expect, it } from 'vitest';
import type { Vector3 } from 'three';
import { conflicts } from './conflicts';
import { rotateLayout, type Layout, type RoadUser } from './layout';

// Scene coordinates are three.js: x = east, y = up, z = south. Read back as [east, north], rounded to 0.01.
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

const car = (id: string, arm: string, manoeuvre: RoadUser['manoeuvre']): RoadUser => ({ id, kind: 'car', arm, manoeuvre });

describe('conflicts on a crossroads', () => {
  it('finds where two straight-on paths cross', () => {
    const found = conflicts(crossroads, [car('a', 's', 'straight'), car('b', 'w', 'straight')]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ a: 'a', b: 'b', kind: 'cross' });
    expect(plan(found[0]!.at)).toEqual([1.75, -1.75]);
  });

  it('finds no conflict between right turns from opposite arms', () => {
    expect(conflicts(crossroads, [car('a', 's', 'right'), car('b', 'n', 'right')])).toEqual([]);
  });

  it('finds no conflict between opposing left turns, which pass in front of each other', () => {
    expect(conflicts(crossroads, [car('a', 's', 'left'), car('b', 'n', 'left')])).toEqual([]);
  });

  it('finds a left turn crossing oncoming straight-on traffic on its own side of the centre', () => {
    const found = conflicts(crossroads, [car('a', 's', 'left'), car('b', 'n', 'straight')]);
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('cross');
    const [east] = plan(found[0]!.at);
    expect(east).toBe(-1.75);
  });

  it('finds a merge where a left turn and an oncoming right turn leave by the same arm', () => {
    const found = conflicts(crossroads, [car('a', 's', 'left'), car('b', 'n', 'right')]);
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('merge');
    // They come together as both settle into the west arm's outbound lane.
    const [east, north] = plan(found[0]!.at);
    expect(east).toBeLessThan(-3);
    expect(Math.abs(north! - 1.75)).toBeLessThan(0.3);
  });

  it('finds a car turning right across a cyclist going straight on the cycle path beside it', () => {
    const withCyclePaths: Layout = { ...crossroads, arms: crossroads.arms.map((arm) => ({ ...arm, cyclePath: true })) };
    const bike: RoadUser = { id: 'bike', kind: 'bicycle', arm: 's', manoeuvre: 'straight' };
    const found = conflicts(withCyclePaths, [car('car', 's', 'right'), bike]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ a: 'car', b: 'bike', kind: 'cross' });
    expect(plan(found[0]!.at)[0]).toBe(5.5);
  });

  it('finds a car turning into a side road across a pedestrian crossing it', () => {
    const ped: RoadUser = { id: 'ped', kind: 'pedestrian', arm: 'e', manoeuvre: 'cross' };
    const found = conflicts(crossroads, [car('car', 's', 'right'), ped]);
    expect(found).toHaveLength(1);
    expect(plan(found[0]!.at)).toEqual([6.5, -1.75]);
  });

  it('finds no conflict between two cars queueing in the same lane for different turns', () => {
    expect(conflicts(crossroads, [car('a', 's', 'left'), car('b', 's', 'right')])).toEqual([]);
  });

  it('finds the same conflicts on a rotated Variant', () => {
    const users = [car('a', 's', 'left'), car('b', 'n', 'straight'), car('c', 'w', 'straight')];
    const pairs = (layout: Layout) => conflicts(layout, users).map(({ a, b, kind }) => `${a}-${b}:${kind}`);
    expect(pairs(rotateLayout(crossroads, 90))).toEqual(pairs(crossroads));
  });
});

describe('conflicts on a roundabout', () => {
  const roundabout: Layout = { ...crossroads, kind: 'roundabout' };

  it('finds a car entering merging with a car already circulating past its arm', () => {
    const found = conflicts(roundabout, [car('entering', 's', 'right'), car('circulating', 'w', 'left')]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'merge' });
  });

  it('finds a car entering crossing a cyclist on the cycle ring', () => {
    const withCyclePaths: Layout = { ...roundabout, arms: roundabout.arms.map((arm) => ({ ...arm, cyclePath: true })) };
    const bike: RoadUser = { id: 'bike', kind: 'bicycle', arm: 'w', manoeuvre: 'left' };
    const found = conflicts(withCyclePaths, [car('car', 's', 'straight'), bike]);
    expect(found.map((c) => c.kind)).toEqual(['cross']);
  });

  it('finds no conflict between cars entering and leaving by different, non-overlapping quarters', () => {
    expect(conflicts(roundabout, [car('a', 's', 'right'), car('b', 'n', 'right')])).toEqual([]);
  });
});
