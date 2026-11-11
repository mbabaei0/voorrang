import { CubicBezierCurve3, Curve, CurvePath, LineCurve3, Vector3 } from 'three';

export type LayoutKind = 'crossroads' | 't-junction' | 'roundabout' | 'exit';

export type Arm = {
  id: string;
  /** Compass bearing from the centre out along the arm, in degrees (0 = north, 90 = east). */
  bearing: number;
  /** Lanes towards the centre, counted from the right. Default 1. */
  lanesIn?: number;
  /** Lanes away from the centre. Default 1. */
  lanesOut?: number;
  /** A red cycle path on each side, separated from the carriageway by a verge. */
  cyclePath?: boolean;
  /** Two tram tracks down the middle of the carriageway. */
  tram?: boolean;
  surface?: 'paved' | 'unpaved';
  /** An uitrit: a driveway or erf exit, crossing a continuous footway. */
  exit?: boolean;
  control?: Control;
};

export type PriorityControl = 'B1' | 'B6' | 'B7' | 'haaientanden';
/** One frozen light state for the arm (a Scenario is a frozen moment). */
export type LightState = 'red' | 'yellow' | 'green' | 'off' | 'flashing-yellow';

/** What an arm imposes on traffic approaching on it. */
export type Control = {
  priority?: PriorityControl;
  lights?: LightState;
  zebra?: boolean;
};

export type Layout = {
  kind: LayoutKind;
  arms: Arm[];
  /**
   * A roundabout built as a turbo roundabout: a two-lane ring whose lanes spiral outward, kept apart by raised
   * lane dividers. The two opposite arms with two lanes out are the main road.
   */
  turbo?: boolean;
};

export type RoadUserKind = 'car' | 'bicycle' | 'moped' | 'snorfiets' | 'pedestrian' | 'tram' | 'bus' | 'voorrangsvoertuig';
export type Manoeuvre = 'left' | 'straight' | 'right' | 'cross';

export type RoadUser = {
  id: string;
  kind: RoadUserKind;
  arm: string;
  manoeuvre: Manoeuvre;
  /** Inbound lane, 0 = rightmost. Default 0. */
  lane?: number;
};

export type Path = CurvePath<Vector3>;

export const LANE_WIDTH = 3.5;
export const ARM_LENGTH = 30;
export const VERGE_WIDTH = 1;
/** Distance between the centrelines of the two tram tracks. */
export const TRACK_SPACING = 1.5;
export const CYCLE_PATH_WIDTH = 2;
/** Distance from the outermost crossing road surface to the edge of the junction. */
const JUNCTION_MARGIN = 1.5;

/** Unit vector pointing out along a bearing, in plan [east, north]. */
type Plan = { e: number; n: number };
const outward = (bearing: number): Plan => {
  const r = (bearing * Math.PI) / 180;
  return { e: Math.sin(r), n: Math.cos(r) };
};
/** The direction to the right of a heading. */
const rightOf = (h: Plan): Plan => ({ e: h.n, n: -h.e });
const toScene = (p: Plan) => new Vector3(p.e, 0, -p.n);

/** A point on an arm: `along` metres out from the centre, `side` metres to the right of inbound traffic. */
export const armPoint = (arm: Arm, along: number, side: number): Vector3 => {
  const u = outward(arm.bearing);
  const r = rightOf({ e: -u.e, n: -u.n });
  return toScene({ e: u.e * along + r.e * side, n: u.n * along + r.n * side });
};

const findArm = (layout: Layout, id: string): Arm => {
  const arm = layout.arms.find((a) => a.id === id);
  if (!arm) throw new Error(`No arm "${id}"`);
  return arm;
};

const angleBetween = (a: number, b: number) => {
  const d = (((a - b) % 360) + 360) % 360;
  return Math.min(d, 360 - d);
};

/** The arm a manoeuvre leaves by: the one whose bearing is closest to where the turn points. */
const destinationArm = (layout: Layout, from: Arm, manoeuvre: Exclude<Manoeuvre, 'cross'>): Arm => {
  const turn = { straight: 180, left: 90, right: -90 }[manoeuvre];
  const target = from.bearing + turn;
  const candidates = layout.arms.filter((a) => a !== from);
  if (candidates.length === 0) throw new Error(`No arm to go ${manoeuvre} from "${from.id}"`);
  const best = candidates.reduce((x, y) => (angleBetween(x.bearing, target) <= angleBetween(y.bearing, target) ? x : y));
  if (angleBetween(best.bearing, target) > 60) throw new Error(`No arm to go ${manoeuvre} from "${from.id}"`);
  return best;
};

/** Where two lines (point + direction, in the ground plane) meet, or null if they are parallel. */
const meet = (p: Vector3, d: Vector3, q: Vector3, e: Vector3): Vector3 | null => {
  const det = d.x * e.z - d.z * e.x;
  if (Math.abs(det) < 1e-9) return null;
  const t = ((q.x - p.x) * e.z - (q.z - p.z) * e.x) / det;
  return p.clone().addScaledVector(d, t);
};

/** Bezier handle length that makes a right-angled turn a quarter circle. */
const ARC_HANDLE = 0.5523;

/**
 * A turn that is close to a circular arc. A quadratic through the lane-line corner would cut towards the
 * centre; this one keeps a left turn on its own side, so opposing left turns pass in front of each other.
 */
const turnCurve = (entry: Vector3, corner: Vector3, exit: Vector3) =>
  new CubicBezierCurve3(entry, entry.clone().lerp(corner, ARC_HANDLE), exit.clone().lerp(corner, ARC_HANDLE), exit);

export const lanesIn = (arm: Arm) => arm.lanesIn ?? 1;
export const lanesOut = (arm: Arm) => arm.lanesOut ?? 1;
const ridesCycle = (kind: RoadUserKind) => kind === 'bicycle' || kind === 'moped' || kind === 'snorfiets';

/** Distance from the carriageway edge to the middle of the cycle path. */
const CYCLE_PATH_OFFSET = VERGE_WIDTH + CYCLE_PATH_WIDTH / 2;

/** How far to the right of inbound traffic a road user rides, entering (`lanes` = lanesIn) or leaving (lanesOut). */
const sideOffset = (arm: Arm, lanes: number, user: RoadUser, lane: number): number => {
  const edge = lanes * LANE_WIDTH;
  if (user.kind === 'tram') return TRACK_SPACING / 2;
  if (ridesCycle(user.kind)) return arm.cyclePath ? edge + CYCLE_PATH_OFFSET : edge - 1;
  return (lanes - lane - 0.5) * LANE_WIDTH;
};

/** The outer edge of the road surface on one side of an arm, measured from its centreline. */
const surfaceEdge = (arm: Arm, lanes: number) => lanes * LANE_WIDTH + (arm.cyclePath ? VERGE_WIDTH + CYCLE_PATH_WIDTH : 0);
/** Outer edge of the road surface to the right of inbound traffic. */
export const inEdge = (arm: Arm) => surfaceEdge(arm, lanesIn(arm));
/** Outer edge of the road surface to the left of inbound traffic. */
export const outEdge = (arm: Arm) => surfaceEdge(arm, lanesOut(arm));
export const halfWidth = (arm: Arm) => Math.max(inEdge(arm), outEdge(arm));

export const FOOTWAY_OFFSET = 1.5;
/** Pedestrians cross an arm in a band this wide, just outside the junction; traffic waits behind it. */
const CROSSING_WIDTH = 3;
/** Gap between the crossing band and the stop line. */
const STOP_LINE_GAP = 0.5;

/** Where the junction ends on every arm: the edge of the junction square, or the outside of a roundabout's rings. */
export const junctionEdge = (layout: Layout) => {
  if (layout.kind !== 'roundabout') return junctionRadius(layout);
  if (isTurbo(layout)) return TURBO_EDGE;
  return hasCycleRing(layout) ? CYCLE_RING_RADIUS + CYCLE_PATH_WIDTH / 2 : ISLAND_RADIUS + RING_WIDTH;
};

/** The distance from the centre at which pedestrians cross an arm: the middle of the crossing band. */
export const crossingDistance = (layout: Layout) => junctionEdge(layout) + CROSSING_WIDTH / 2;

/**
 * Where traffic on an arm waits: behind the crossing band, so pedestrians cross in front of it. At a roundabout
 * with a cycle ring, traffic crosses the cycle ring first and gives way at the carriageway, in the gap between.
 */
export const stopLineDistance = (layout: Layout) =>
  layout.kind === 'roundabout' && hasCycleRing(layout)
    ? ISLAND_RADIUS + RING_WIDTH + STOP_LINE_GAP
    : junctionEdge(layout) + CROSSING_WIDTH + STOP_LINE_GAP;

/** On foot across an arm, starting on the footway to the right of inbound traffic. */
const crossingPath = (layout: Layout, arm: Arm): Path => {
  const along = crossingDistance(layout);
  const path: Path = new CurvePath();
  path.add(
    new LineCurve3(
      armPoint(arm, along, inEdge(arm) + FOOTWAY_OFFSET),
      armPoint(arm, along, -outEdge(arm) - FOOTWAY_OFFSET),
    ),
  );
  return path;
};

/** Distance from the centre to where turns begin: just clear of every crossing road surface. */
export const junctionRadius = (layout: Layout) => Math.max(...layout.arms.map(halfWidth)) + JUNCTION_MARGIN;

export const manoeuvrePath = (layout: Layout, user: RoadUser): Path => {
  const from = findArm(layout, user.arm);
  if (user.manoeuvre === 'cross') return crossingPath(layout, from);
  const to = destinationArm(layout, from, user.manoeuvre);
  const radius = junctionRadius(layout);
  const inSide = sideOffset(from, lanesIn(from), user, user.lane ?? 0);
  // Outbound traffic on `to` drives on its right, which is the left of inbound traffic.
  const outSide = -sideOffset(to, lanesOut(to), user, 0);
  if (isTurbo(layout) && !ridesCycle(user.kind) && user.kind !== 'tram') return turboPath(layout, user, from, to, inSide);
  if (layout.kind === 'roundabout') return roundaboutPath(layout, user, from, to, inSide, outSide);
  const start = armPoint(from, ARM_LENGTH, inSide);
  const entry = armPoint(from, radius, inSide);
  const exit = armPoint(to, radius, outSide);
  const end = armPoint(to, ARM_LENGTH, outSide);

  const path: Path = new CurvePath();
  path.add(new LineCurve3(start, entry));
  const corner = meet(entry, entry.clone().sub(start), exit, end.clone().sub(exit));
  path.add(corner ? turnCurve(entry, corner, exit) : new LineCurve3(entry, exit));
  path.add(new LineCurve3(exit, end));
  return path;
};

export const ISLAND_RADIUS = 8;
export const RING_WIDTH = 5;
/** Road users circulate in the middle of the ring. */
export const RING_RADIUS = ISLAND_RADIUS + RING_WIDTH / 2;
/** Separate cycle ring, set back far enough from the carriageway for one car to wait between them. */
export const CYCLE_RING_SETBACK = 5;
export const CYCLE_RING_RADIUS = ISLAND_RADIUS + RING_WIDTH + CYCLE_RING_SETBACK + CYCLE_PATH_WIDTH / 2;

export const hasCycleRing = (layout: Layout) => layout.arms.some((arm) => arm.cyclePath);

/**
 * Anticlockwise seen from above (traffic keeps right), from one angle to another, in scene x/z. With `growth`
 * (metres per radian) the radius grows as it goes: a spiral, as the lanes of a turbo roundabout.
 */
class RingArc extends Curve<Vector3> {
  constructor(
    private readonly radius: number,
    private readonly from: number,
    private readonly sweep: number,
    private readonly growth = 0,
  ) {
    super();
  }
  override getPoint(t: number, target = new Vector3()) {
    const a = this.from + this.sweep * t;
    const r = this.radius + this.growth * this.sweep * t;
    // Plan angle anticlockwise from east; scene z points south.
    return target.set(r * Math.cos(a), 0, -r * Math.sin(a));
  }
}

const planAngle = (v: Vector3) => Math.atan2(-v.z, v.x);

/** Where a line parallel to an arm, `side` metres to the right of inbound traffic, meets a circle round the centre. */
const ringPoint = (arm: Arm, radius: number, side: number) =>
  armPoint(arm, Math.sqrt(radius * radius - side * side), side);

/** How far round the ring (radians) an entry or exit curve takes to blend into the circle. */
const RING_BLEND = 0.4;
/** Entry and exit curves start this far outside the circulating line. */
const RING_APPROACH = 4;
const RING_HANDLE = 2.5;

/** Direction of anticlockwise travel at a plan angle on a ring of radius `r` growing by `growth` per radian. */
const ringTangent = (a: number, r = 1, growth = 0) =>
  new Vector3(growth * Math.cos(a) - r * Math.sin(a), 0, -(growth * Math.sin(a) + r * Math.cos(a))).normalize();
const onRing = (radius: number, a: number) => new RingArc(radius, a, 0).getPoint(0);

const TWO_PI = 2 * Math.PI;
const mod = (x: number, m: number) => ((x % m) + m) % m;

/**
 * Onto a ring from one arm, anticlockwise round it and off along another. `radiusAt` gives the ring's radius at
 * a plan angle where the route joins it; from there it grows by `growth` metres per radian. The route runs
 * between `start` and `end` metres out along the two arms.
 */
const ringRoute = (
  from: Arm,
  inSide: number,
  to: Arm,
  outSide: number,
  radiusAt: (angle: number) => number,
  growth = 0,
  start = ARM_LENGTH,
  end = ARM_LENGTH,
): Path => {
  // Join the ring a little anticlockwise of where the lane line meets it, and leave a little before.
  const joinAngle = planAngle(ringPoint(from, radiusAt(armAngle(from)), inSide)) + RING_BLEND;
  const radius = radiusAt(joinAngle);
  let leaveRadius = radius;
  let sweep = 0;
  // On a spiral, where the route leaves depends on how far round it has grown; two rounds settle it.
  for (let i = 0; i < 2; i++) {
    sweep = mod(planAngle(ringPoint(to, leaveRadius, outSide)) - RING_BLEND - joinAngle, TWO_PI);
    leaveRadius = radius + growth * sweep;
  }
  const leaveAngle = joinAngle + sweep;
  const startPoint = armPoint(from, start, inSide);
  const approach = ringPoint(from, radius + RING_APPROACH, inSide);
  const leave = ringPoint(to, leaveRadius + RING_APPROACH, outSide);
  const endPoint = armPoint(to, end, outSide);
  const join = onRing(radius, joinAngle);
  const leaveRing = onRing(leaveRadius, leaveAngle);
  const inDir = approach.clone().sub(startPoint).normalize();
  const outDir = endPoint.clone().sub(leave).normalize();

  const path: Path = new CurvePath();
  path.add(new LineCurve3(startPoint, approach));
  path.add(
    new CubicBezierCurve3(
      approach,
      approach.clone().addScaledVector(inDir, RING_HANDLE),
      join.clone().addScaledVector(ringTangent(joinAngle, radius, growth), -RING_HANDLE),
      join,
    ),
  );
  path.add(new RingArc(radius, joinAngle, sweep, growth));
  path.add(
    new CubicBezierCurve3(
      leaveRing,
      leaveRing.clone().addScaledVector(ringTangent(leaveAngle, leaveRadius, growth), RING_HANDLE),
      leave.clone().addScaledVector(outDir, -RING_HANDLE),
      leave,
    ),
  );
  path.add(new LineCurve3(leave, endPoint));
  return path;
};

const roundaboutPath = (layout: Layout, user: RoadUser, from: Arm, to: Arm, inSide: number, outSide: number): Path => {
  const radius = ridesCycle(user.kind) && hasCycleRing(layout) ? CYCLE_RING_RADIUS : RING_RADIUS;
  return ringRoute(from, inSide, to, outSide, () => radius);
};

// ---- Turbo roundabouts. ----
//
// Each lane of the ring begins on the inside, at the left-hand entry lane of a main road arm, and moves out by
// one lane every half turn: by the opposite main arm it has become the outer lane, and it ends where it began,
// as the right-hand exit lane. So the island spirals too, with a step at each main arm where a new lane starts.

export const isTurbo = (layout: Layout) => layout.kind === 'roundabout' && !!layout.turbo;

export const TURBO_LANE = 3.5;
const TURBO_DIVIDER = 0.3;
/** Between neighbouring lane centres: how far a lane moves out every half turn. */
export const TURBO_TRACK = TURBO_LANE + TURBO_DIVIDER;
/** Centre of a lane where it begins, beside the island. */
const TURBO_START = 8.6;
/** How fast a lane spirals outward, in metres per radian. */
export const TURBO_GROWTH = TURBO_TRACK / Math.PI;
/** The centre of a lane `phi` radians round from the main arm where it begins. */
export const turboLaneRadius = (phi: number) => TURBO_START + TURBO_GROWTH * phi;
/** The outside of the ring at its widest, just before a main arm, where the outer lane ends. */
const TURBO_EDGE = turboLaneRadius(TWO_PI) + TURBO_LANE / 2;

/** An arm's plan angle: anticlockwise from east, in radians. */
export const armAngle = (arm: Arm) => Math.PI / 2 - (arm.bearing * Math.PI) / 180;

/** The main road of a turbo roundabout: the two opposite arms with two lanes out. Each starts a lane. */
export const turboMains = (layout: Layout): Arm[] => {
  const mains = layout.arms.filter((arm) => lanesOut(arm) === 2);
  if (mains.length !== 2 || angleBetween(mains[0]!.bearing, mains[1]!.bearing) !== 180) {
    throw new Error('A turbo roundabout needs two opposite main arms with two lanes out');
  }
  return mains;
};

/** How far round from where it began (radians, 0 to π) the inner lane is at a plan angle. */
export const turboInnerPhi = (layout: Layout, angle: number) =>
  Math.min(...turboMains(layout).map((main) => mod(angle - armAngle(main), TWO_PI)));

/** The outside of the ring at a plan angle. */
export const turboOuterEdge = (layout: Layout, angle: number) => turboLaneRadius(turboInnerPhi(layout, angle) + Math.PI) + TURBO_LANE / 2;

/**
 * A road user on a turbo roundabout keeps the lane it chose before the entry. The left-hand entry lane joins the
 * inner ring lane, the right-hand one the outer. It can leave at a main arm from either lane (inner to the left
 * exit lane, outer to the right one), at a side arm only from the outer lane, and nowhere past where its lane ends.
 */
const turboPath = (layout: Layout, user: RoadUser, from: Arm, to: Arm, inSide: number): Path => {
  const entry = armAngle(from) + RING_BLEND;
  const inner = turboInnerPhi(layout, entry);
  const left = (user.lane ?? 0) >= 1;
  if (left && user.manoeuvre === 'right') throw new Error('On a turbo roundabout you turn right from the right-hand lane');
  const phi = left ? inner : inner + Math.PI;
  /** Where this road user's lane began. */
  const laneStart = entry - phi;
  const phiAt = (angle: number) => mod(angle - laneStart, TWO_PI);
  // Round to the destination, counting the main arm where the lane began as the end of the lane.
  const phiExit = TWO_PI - mod(laneStart - armAngle(to), TWO_PI);
  if (phiExit < phi) throw new Error(`From lane ${user.lane ?? 0} on "${from.id}" you cannot reach "${to.id}"`);
  const main = lanesOut(to) === 2;
  if (!main && phiExit < Math.PI) throw new Error(`"${to.id}" can only be reached from the outer ring lane`);
  const exitLane = main && phiExit < Math.PI * 1.5 ? 1 : 0;
  const outSide = -sideOffset(to, lanesOut(to), user, exitLane);
  return ringRoute(from, inSide, to, outSide, (angle) => turboLaneRadius(phiAt(angle)), TURBO_GROWTH);
};

/** How far round from its main arm (radians) a divider begins: once the left entry lane has joined the ring. */
const DIVIDER_START = 0.55;
/** A divider stays open this far (radians) either side of a side road, where its left lane crosses the outer ring lane. */
const SIDE_OPEN: [number, number] = [0, 0.55];

/**
 * The raised lane dividers of a turbo roundabout, as runs of points. One per main arm: round the outside of the
 * lane that arm starts, from just past its entry (the left entry lane crosses the lane carrying on past the arm,
 * so the divider cannot reach back to the entry) to between the exit lanes of the opposite main arm, and open
 * where a side road's left lane crosses to the inner lane.
 */
export const turboDividers = (layout: Layout): Vector3[][] => {
  const mains = turboMains(layout);
  const sides = layout.arms.filter((arm) => !mains.includes(arm));
  return mains.flatMap((main) => {
    const opposite = mains.find((m) => m !== main)!;
    const start = armAngle(main);
    const radiusAt = (angle: number) => turboLaneRadius(mod(angle - start, TWO_PI)) + TURBO_TRACK / 2;
    const route = ringRoute(main, LANE_WIDTH, opposite, -LANE_WIDTH, radiusAt, TURBO_GROWTH, TURBO_EDGE, TURBO_EDGE);
    const open = (p: Vector3) => {
      const angle = planAngle(p);
      if (mod(angle - start, TWO_PI) < DIVIDER_START) return true;
      return sides.some((side) => mod(angle - armAngle(side) - SIDE_OPEN[0], TWO_PI) < SIDE_OPEN[1] - SIDE_OPEN[0]);
    };
    const runs: Vector3[][] = [[]];
    for (const p of route.getSpacedPoints(260)) {
      if (open(p)) runs.push([]);
      else runs[runs.length - 1]!.push(p);
    }
    return runs.filter((run) => run.length > 1);
  });
};

/** A Variant: the same Layout turned clockwise by `degrees`. Never mirrored, since that swaps left and right. */
export const rotateLayout = (layout: Layout, degrees: number): Layout => ({
  ...layout,
  arms: layout.arms.map((arm) => ({ ...arm, bearing: (((arm.bearing + degrees) % 360) + 360) % 360 })),
});
