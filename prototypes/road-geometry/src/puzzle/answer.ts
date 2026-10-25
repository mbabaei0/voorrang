/**
 * The learner's answer while they build it: road users in the order chosen, and which neighbours are linked
 * into the same Step (the app's extension to CBR's strict 1-2-3 order).
 */
export type Answer = {
  order: string[];
  /** linked[k]: order[k] and order[k + 1] go together. */
  linked: boolean[];
};

export const emptyAnswer: Answer = { order: [], linked: [] };

/** Take out the road user at `k`. Its neighbours stay in one Step only if it joined them both. */
const removeAt = (answer: Answer, k: number): Answer => {
  const linked = [...answer.linked];
  if (k === 0) linked.splice(0, 1);
  else if (k === answer.order.length - 1) linked.splice(k - 1, 1);
  else linked.splice(k - 1, 2, answer.linked[k - 1]! && answer.linked[k]!);
  return { order: answer.order.filter((_, i) => i !== k), linked };
};

/** Put a road user in at `k`, in a Step of its own. */
const insertAt = (answer: Answer, k: number, id: string): Answer => {
  const order = [...answer.order];
  order.splice(k, 0, id);
  const linked = [...answer.linked];
  if (k === 0 || k === answer.order.length) linked.splice(k === 0 ? 0 : k - 1, 0, false);
  else linked.splice(k - 1, 1, false, false);
  return { order, linked: order.length > 1 ? linked : [] };
};

/** Tapping a road user adds it as the next Step, or takes it out again if it is already placed. */
export const tap = (answer: Answer, id: string): Answer => {
  const k = answer.order.indexOf(id);
  return k >= 0 ? removeAt(answer, k) : insertAt(answer, answer.order.length, id);
};

/** Link or unlink order[k] and order[k + 1]. */
export const toggleLink = (answer: Answer, k: number): Answer => ({
  ...answer,
  linked: answer.linked.map((l, i) => (i === k ? !l : l)),
});

/** Move the road user at `from` to position `to`, in a Step of its own. */
export const move = (answer: Answer, from: number, to: number): Answer =>
  insertAt(removeAt(answer, from), to, answer.order[from]!);

/** A Passing order as an answer, with the road users in each Step linked. */
export const fromSteps = (passingOrder: string[][]): Answer => {
  const order = passingOrder.flat();
  const linked = passingOrder.flatMap((step, i) => [...step.slice(1).map(() => true), ...(i < passingOrder.length - 1 ? [false] : [])]);
  return { order, linked };
};

/** The answer as a passing order: a list of Steps. */
export const steps = (answer: Answer): string[][] =>
  answer.order.reduce<string[][]>((out, id, k) => {
    if (k > 0 && answer.linked[k - 1]) out[out.length - 1]!.push(id);
    else out.push([id]);
    return out;
  }, []);

export type Score =
  | { verdict: 'correct' }
  | { verdict: 'incomplete'; missing: string[] }
  /** `tooEarly` went before (or together with) road users it had to wait for. */
  | { verdict: 'wrong'; tooEarly: string; waitedFor: string[] };

/**
 * Any order within a Step of the Passing order is right, whether the learner numbers them one by one (as CBR
 * does) or links them. A link is right only between road users who may really go together.
 */
export const score = (answer: Answer, passingOrder: string[][]): Score => {
  const stepOf = new Map(passingOrder.flatMap((step, i) => step.map((id) => [id, i] as const)));
  const missing = [...stepOf.keys()].filter((id) => !answer.order.includes(id));
  if (missing.length) return { verdict: 'incomplete', missing };

  const gone = new Set<string>();
  for (const step of steps(answer)) {
    for (const id of step) {
      const waitedFor = [...stepOf].filter(([other, i]) => i < stepOf.get(id)! && !gone.has(other)).map(([other]) => other);
      if (waitedFor.length) return { verdict: 'wrong', tooEarly: id, waitedFor };
    }
    step.forEach((id) => gone.add(id));
  }
  return { verdict: 'correct' };
};
