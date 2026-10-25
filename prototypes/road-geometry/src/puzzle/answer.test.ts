import { describe, expect, it } from 'vitest';
import { emptyAnswer, fromSteps, move, score, steps, tap, toggleLink, type Answer } from './answer';

describe('building an answer', () => {
  it('puts each tapped road user in a Step of its own, in tap order', () => {
    const answer = ['car', 'bike', 'ped'].reduce(tap, emptyAnswer);
    expect(steps(answer)).toEqual([['car'], ['bike'], ['ped']]);
  });

  const build = (...ids: string[]) => ids.reduce(tap, emptyAnswer);

  it('takes a road user back out when it is tapped again, renumbering the rest', () => {
    expect(steps(tap(build('car', 'bike', 'ped'), 'bike'))).toEqual([['car'], ['ped']]);
  });

  it('links neighbours into one Step, and unlinks them again', () => {
    const linked = toggleLink(build('bike', 'ped', 'car'), 0);
    expect(steps(linked)).toEqual([['bike', 'ped'], ['car']]);
    expect(steps(toggleLink(linked, 0))).toEqual([['bike'], ['ped'], ['car']]);
  });

  it('keeps a Step together when a middle member is taken out, and splits nothing else', () => {
    const three = [0, 1].reduce<Answer>(toggleLink, build('a', 'b', 'c', 'd'));
    expect(steps(tap(three, 'b'))).toEqual([['a', 'c'], ['d']]);
    const pairThenOne = toggleLink(build('a', 'b', 'c'), 0);
    expect(steps(tap(pairThenOne, 'b'))).toEqual([['a'], ['c']]);
  });

  it('moves a road user to a new place on its own, leaving its old Step intact', () => {
    const answer = toggleLink(build('a', 'b', 'c'), 0);
    expect(steps(move(answer, 2, 0))).toEqual([['c'], ['a', 'b']]);
    expect(steps(move(answer, 0, 2))).toEqual([['b'], ['c'], ['a']]);
  });
});

describe('showing the correct order', () => {
  it('builds an answer from a Passing order, linking the road users within each Step', () => {
    const answer = fromSteps([['bike', 'ped'], ['car']]);
    expect(answer).toEqual({ order: ['bike', 'ped', 'car'], linked: [true, false] });
  });
});

describe('scoring an answer against the Passing order', () => {
  // A car turning right waits for the cyclist going straight beside it and the pedestrian crossing the side
  // road; those two may go together.
  const passingOrder = [['bike', 'ped'], ['car']];
  const build = (...ids: string[]) => ids.reduce(tap, emptyAnswer);

  it('accepts either strict order within a Step, as CBR numbers them', () => {
    expect(score(build('bike', 'ped', 'car'), passingOrder)).toEqual({ verdict: 'correct' });
    expect(score(build('ped', 'bike', 'car'), passingOrder)).toEqual({ verdict: 'correct' });
  });

  it('accepts a tie the learner marks when those road users really may go together', () => {
    expect(score(toggleLink(build('ped', 'bike', 'car'), 0), passingOrder)).toEqual({ verdict: 'correct' });
  });

  it('names the road user who went too early and the ones it should have waited for', () => {
    expect(score(build('car', 'bike', 'ped'), passingOrder)).toEqual({ verdict: 'wrong', tooEarly: 'car', waitedFor: ['bike', 'ped'] });
    expect(score(build('bike', 'car', 'ped'), passingOrder)).toEqual({ verdict: 'wrong', tooEarly: 'car', waitedFor: ['ped'] });
  });

  it('rejects a tie between road users who must go one after the other', () => {
    const tied = toggleLink(build('ped', 'bike', 'car'), 1);
    expect(score(tied, passingOrder)).toEqual({ verdict: 'wrong', tooEarly: 'car', waitedFor: ['bike'] });
  });

  it('does not score an answer until every road user is placed', () => {
    expect(score(build('bike', 'ped'), passingOrder)).toEqual({ verdict: 'incomplete', missing: ['car'] });
  });
});

describe('scoring when some road users never meet', () => {
  // Car from the south and a moped turning right from the north may go together; the bus from the west waits
  // for the car, which comes from its right. The bus and the moped never meet.
  const passingOrder = [['car', 'moped'], ['bus']];
  const meet = (a: string, b: string) => [a, b].sort().join() !== 'bus,moped';
  const build = (...ids: string[]) => ids.reduce(tap, emptyAnswer);

  it('does not require an order between road users whose paths never meet', () => {
    expect(score(build('car', 'bus', 'moped'), passingOrder, meet)).toEqual({ verdict: 'correct' });
    expect(score(build('moped', 'car', 'bus'), passingOrder, meet)).toEqual({ verdict: 'correct' });
  });

  it('still names only the road users it actually had to wait for', () => {
    expect(score(build('bus', 'moped', 'car'), passingOrder, meet)).toEqual({ verdict: 'wrong', tooEarly: 'bus', waitedFor: ['car'] });
  });
});
