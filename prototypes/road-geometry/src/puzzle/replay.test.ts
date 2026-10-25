import { describe, expect, it } from 'vitest';
import type { Layout, RoadUser } from '../layout';
import { scheduleReplay } from './replay';

const crossroads: Layout = {
  kind: 'crossroads',
  arms: [
    { id: 'n', bearing: 0, cyclePath: true },
    { id: 'e', bearing: 90, cyclePath: true },
    { id: 's', bearing: 180, cyclePath: true },
    { id: 'w', bearing: 270, cyclePath: true },
  ],
};

// A car turning right waits for the cyclist going straight beside it and the pedestrian crossing the side road.
const roadUsers: RoadUser[] = [
  { id: 'car', kind: 'car', arm: 's', manoeuvre: 'right' },
  { id: 'bike', kind: 'bicycle', arm: 's', manoeuvre: 'straight' },
  { id: 'ped', kind: 'pedestrian', arm: 'e', manoeuvre: 'cross' },
];

describe('scheduleReplay for a correct order', () => {
  it('starts a Step together, and the next Step only later', () => {
    const replay = scheduleReplay(crossroads, roadUsers, [['bike', 'ped'], ['car']]);
    expect(replay.start('bike')).toBe(0);
    expect(replay.start('ped')).toBe(0);
    expect(replay.start('car')).toBeGreaterThan(0);
  });
});

const sampleTimes = (duration: number) => Array.from({ length: Math.ceil(duration / 0.05) + 1 }, (_, i) => Math.min(duration, i * 0.05));

describe('scheduleReplay, more', () => {
  it('never brings road users with crossing paths close together when the order is right', () => {
    const replay = scheduleReplay(crossroads, roadUsers, [['bike', 'ped'], ['car']]);
    expect(replay.collision).toBeNull();
    for (const t of sampleTimes(replay.duration)) {
      for (const other of ['bike', 'ped']) {
        expect(replay.pose('car', t).position.distanceTo(replay.pose(other, t).position)).toBeGreaterThan(2);
      }
    }
  });

  it('ends as soon as the last road user has cleared the junction, not when it reaches the edge of the map', () => {
    const replay = scheduleReplay(crossroads, roadUsers, [['bike', 'ped'], ['car']]);
    // The junction ends 8 m out (3.5 m lane, 3 m to the far side of the cycle path, 1.5 m margin); the crossing
    // band runs to 11 m and the stop line is at 11.5 m. The car is past that, well short of the map edge at 30 m.
    const car = replay.pose('car', replay.duration).position;
    expect(car.x).toBeGreaterThan(13);
    expect(car.x).toBeLessThan(25);
    // The pedestrian is across, on the far footway.
    expect(-replay.pose('ped', replay.duration).position.z).toBeCloseTo(-8);
    // Afterwards road users drive on out of view.
    expect(replay.pose('car', replay.duration + 10).position.x).toBeCloseTo(30);
  });

  it('on a wrong order, stops where the road user who went too early meets one it should have waited for', () => {
    const replay = scheduleReplay(crossroads, roadUsers, [['car'], ['bike'], ['ped']], { tooEarly: 'car', waitedFor: ['bike', 'ped'] });
    expect(replay.collision).toMatchObject({ tooEarly: 'car', hit: 'bike' });
    const { time, at } = replay.collision!;
    expect(replay.duration).toBe(time);
    expect(replay.pose('car', time).position.distanceTo(at)).toBeLessThan(0.5);
    expect(replay.pose('bike', time).position.distanceTo(at)).toBeLessThan(0.5);
  });

  it('has no collision to show when the road user who went too early shares no path with those it skipped', () => {
    const fromTheRight: RoadUser[] = [
      { id: 'a', kind: 'car', arm: 's', manoeuvre: 'straight' },
      { id: 'b', kind: 'car', arm: 'w', manoeuvre: 'straight' },
      { id: 'c', kind: 'car', arm: 'n', manoeuvre: 'right' },
    ];
    // Correct: [[a, c], [b]]. The learner put b before c, which never meets b.
    const replay = scheduleReplay(crossroads, fromTheRight, [['a'], ['b'], ['c']], { tooEarly: 'b', waitedFor: ['c'] });
    expect(replay.collision).toBeNull();
  });
});
