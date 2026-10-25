import { Vector3 } from 'three';
import { manoeuvrePath, type Layout, type RoadUser } from './layout';

/** Where two road users' paths meet: crossing each other, or one joining the other's lane. */
export type Conflict = {
  a: string;
  b: string;
  kind: 'cross' | 'merge';
  at: Vector3;
};

/** Paths closer than this are treated as touching. */
const TOUCH = 0.3;
const SAMPLE_SPACING = 0.2;
/** Paths meeting at less than this angle merge rather than cross. */
const MERGE_ANGLE = Math.PI / 6;

type Sampled = { points: Vector3[] };

const sample = (layout: Layout, user: RoadUser): Sampled => {
  const path = manoeuvrePath(layout, user);
  const n = Math.max(2, Math.ceil(path.getLength() / SAMPLE_SPACING));
  return { points: path.getSpacedPoints(n) };
};

const closestOnSegment = (p: Vector3, a: Vector3, b: Vector3) => {
  const ab = b.clone().sub(a);
  const t = Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / ab.lengthSq()));
  return a.clone().addScaledVector(ab, t);
};

/** The nearest point on a polyline to `p`, and the index of the segment it lies on. */
const nearest = (p: Vector3, line: Vector3[]) => {
  let best = { point: line[0]!, segment: 0, distance: Infinity };
  for (let i = 0; i < line.length - 1; i++) {
    const q = closestOnSegment(p, line[i]!, line[i + 1]!);
    const distance = q.distanceTo(p);
    if (distance < best.distance) best = { point: q, segment: i, distance };
  }
  return best;
};

/** The exact crossing of two segments in the ground plane, if they cross. */
const crossing = (p: Vector3, p2: Vector3, q: Vector3, q2: Vector3): Vector3 | null => {
  const d = p2.clone().sub(p);
  const e = q2.clone().sub(q);
  const det = d.x * e.z - d.z * e.x;
  if (Math.abs(det) < 1e-12) return null;
  const w = q.clone().sub(p);
  const t = (w.x * e.z - w.z * e.x) / det;
  const u = (w.x * d.z - w.z * d.x) / det;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? p.clone().addScaledVector(d, t) : null;
};

const heading = (line: Vector3[], segment: number) => line[segment + 1]!.clone().sub(line[segment]!).normalize();

/**
 * The first place `a` comes to touch `b` after having been apart. Road users who start in the same lane
 * are queueing, not conflicting, so a shared start is skipped.
 */
const meeting = (a: Vector3[], b: Vector3[]): Omit<Conflict, 'a' | 'b'> | null => {
  let apart = false;
  for (let i = 0; i < a.length - 1; i++) {
    const near = nearest(a[i]!, b);
    if (near.distance >= TOUCH) {
      apart = true;
      continue;
    }
    if (!apart) continue;
    const angle = heading(a, Math.min(i, a.length - 2)).angleTo(heading(b, near.segment));
    if (angle < MERGE_ANGLE) return { kind: 'merge', at: near.point };
    for (let j = Math.max(0, near.segment - 2); j < Math.min(b.length - 1, near.segment + 3); j++) {
      for (let k = Math.max(0, i - 2); k < Math.min(a.length - 1, i + 3); k++) {
        const at = crossing(a[k]!, a[k + 1]!, b[j]!, b[j + 1]!);
        if (at) return { kind: 'cross', at };
      }
    }
    return { kind: 'cross', at: near.point };
  }
  return null;
};

/** Every pair of road users whose paths meet, in input order. */
export const conflicts = (layout: Layout, users: RoadUser[]): Conflict[] => {
  const sampled = users.map((user) => sample(layout, user));
  const found: Conflict[] = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const met = meeting(sampled[i]!.points, sampled[j]!.points);
      if (met) found.push({ a: users[i]!.id, b: users[j]!.id, ...met });
    }
  }
  return found;
};
