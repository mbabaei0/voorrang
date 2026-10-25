import { Vector3 } from 'three';
import { conflicts, type Conflict } from '../conflicts';
import { ARM_LENGTH, manoeuvrePath, stopLineDistance, type Layout, type Path, type RoadUser, type RoadUserKind } from '../layout';
import { roadUserLength, waitingDistance } from '../scene';
import type { Score } from './answer';

export type WrongAnswer = Extract<Score, { verdict: 'wrong' }>;

/** Replay speeds in m/s: brisk enough to watch, in the right proportion to each other. */
const SPEED: Record<RoadUserKind, number> = {
  car: 7,
  bus: 6,
  tram: 6,
  voorrangsvoertuig: 9,
  bicycle: 4.5,
  moped: 6,
  snorfiets: 5,
  pedestrian: 2.5,
};

/** Space kept clear in front of and behind a road user at a conflict point, in metres. */
const CLEARANCE = 1;
/** Seconds between consecutive Steps when nothing makes the later one wait longer. */
const BEAT = 0.4;
/** A road user has cleared the junction once its tail is this far past the outbound stop line. */
const CLEARED = 1;

type Track = { path: Path; length: number; from: number; cleared: number; speed: number; half: number; start: number };

export type Collision = { time: number; at: Vector3; tooEarly: string; hit: string };

export type Replay = {
  /** When a road user pulls away, in seconds from the start of the Replay. */
  start: (id: string) => number;
  /** Where a road user is at time t, and which way it faces. */
  pose: (id: string, t: number) => { position: Vector3; heading: Vector3 };
  /** On a wrong answer: where the road user who went too early meets one it should have waited for. */
  collision: Collision | null;
  /** Seconds until everyone has cleared the junction, or until the collision. Poses run on after it. */
  duration: number;
};

/** When a road user's centre is `distance` along its path. */
const timeAt = (track: Track, distance: number) => track.start + Math.max(0, distance - track.from) / track.speed;

/** Earliest start for `v` so that it reaches the conflict point only after `w` has cleared it. */
const startAfter = (v: Track, vAlong: number, w: Track, wAlong: number) =>
  timeAt(w, wAlong + w.half + CLEARANCE) - Math.max(0, vAlong - v.half - CLEARANCE - v.from) / v.speed;

/**
 * Play the Steps in order. Each road user starts once every road user in an earlier Step has cleared the
 * points their paths share. On a wrong answer (`wrong`), the first road user that `tooEarly` should have
 * waited for takes its priority anyway, timed to meet it at their conflict point, and the Replay stops there.
 */
export const scheduleReplay = (
  layout: Layout,
  roadUsers: RoadUser[],
  steps: string[][],
  wrong?: Pick<WrongAnswer, 'tooEarly' | 'waitedFor'>,
): Replay => {
  const byId = new Map(roadUsers.map((user) => [user.id, user]));
  const tracks = new Map<string, Track>();
  for (const user of roadUsers) {
    const path = manoeuvrePath(layout, user);
    const length = path.getLength();
    const half = roadUserLength(user.kind) / 2;
    tracks.set(user.id, {
      path,
      length,
      from: waitingDistance(layout, user),
      // Pedestrians are done when they reach the far footway; vehicles once they are clear of the far crossing.
      cleared: user.manoeuvre === 'cross' ? length : Math.min(length, length - (ARM_LENGTH - stopLineDistance(layout)) + half + CLEARED),
      speed: SPEED[user.kind],
      half,
      start: 0,
    });
  }
  const track = (id: string) => tracks.get(id)!;
  const shared = conflicts(layout, roadUsers);
  const between = (v: string, w: string): { vAlong: number; wAlong: number; c: Conflict } | null => {
    const c = shared.find((x) => (x.a === v && x.b === w) || (x.a === w && x.b === v));
    if (!c) return null;
    return c.a === v ? { vAlong: c.alongA, wAlong: c.alongB, c } : { vAlong: c.alongB, wAlong: c.alongA, c };
  };

  let previousStart = -BEAT;
  steps.forEach((step, k) => {
    const earlier = steps.slice(0, k).flat();
    for (const v of step) {
      if (!byId.has(v)) throw new Error(`No road user "${v}"`);
      const waits = earlier.flatMap((w) => {
        const met = between(v, w);
        return met ? [startAfter(track(v), met.vAlong, track(w), met.wAlong)] : [];
      });
      track(v).start = Math.max(k === 0 ? 0 : previousStart + BEAT, ...waits);
    }
    previousStart = Math.max(...step.map((v) => track(v).start));
  });

  let collision: Collision | null = null;
  if (wrong) {
    for (const w of wrong.waitedFor) {
      const met = between(wrong.tooEarly, w);
      if (!met) continue;
      const u = track(wrong.tooEarly);
      const other = track(w);
      // `w` takes its priority: it pulls away so that both centres reach the conflict point together.
      const meetAt = timeAt(u, met.vAlong);
      other.start = meetAt - Math.max(0, met.wAlong - other.from) / other.speed;
      if (other.start < 0) {
        u.start -= other.start;
        other.start = 0;
      }
      collision = { time: timeAt(u, met.vAlong), at: met.c.at.clone(), tooEarly: wrong.tooEarly, hit: w };
      break;
    }
  }

  const finished = Math.max(...[...tracks.values()].map((t) => timeAt(t, t.cleared)));
  return {
    start: (id) => track(id).start,
    pose: (id, t) => {
      const tr = track(id);
      const distance = Math.min(tr.length, tr.from + Math.max(0, t - tr.start) * tr.speed);
      const u = distance / tr.length;
      return { position: tr.path.getPointAt(u), heading: tr.path.getTangentAt(u) };
    },
    collision,
    duration: collision ? collision.time : finished,
  };
};
