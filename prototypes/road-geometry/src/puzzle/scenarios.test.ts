import { describe, expect, it } from 'vitest';
import { scheduleReplay } from './replay';
import { scenarios } from './scenarios';

describe.each(scenarios)('scenario $id', (scenario) => {
  it('names every road user exactly once in its Passing order', () => {
    expect(scenario.passingOrder.flat().sort()).toEqual(scenario.roadUsers.map((u) => u.id).sort());
  });

  it('replays its Passing order without a collision', () => {
    expect(scheduleReplay(scenario.layout, scenario.roadUsers, scenario.passingOrder).collision).toBeNull();
  });
});
