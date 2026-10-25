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
const rides = (kind: RoadUserKind) => kind === 'bicycle' || kind === 'moped' || kind === 'snorfiets';

/** Distance from the carriageway edge to the middle of the cycle path. */
const CYCLE_PATH_OFFSET = VERGE_WIDTH + CYCLE_PATH_WIDTH / 2;

/** How far to the right of inbound traffic a road user rides, entering (`lanes` = lanesIn) or leaving (lanesOut). */
const sideOffset = (arm: Arm, lanes: number, user: RoadUser, lane: number): number => {
  const edge = lanes * LANE_WIDTH;
  if (user.kind === 'tram') return TRACK_SPACING / 2;
  if (rides(user.kind)) return arm.cyclePath ? edge + CYCLE_PATH_OFFSET : edge - 1;
  return (lanes - lane - 0.5) * LANE_WIDTH;
};

/** The outer edge of the road surface on one side of an arm, measured from its centreline. */
export const surfaceEdge = (arm: Arm, lanes: number) => lanes * LANE_WIDTH + (arm.cyclePath ? VERGE_WIDTH + CYCLE_PATH_WIDTH : 0);
const halfWidth = (arm: Arm) => Math.max(surfaceEdge(arm, lanesIn(arm)), surfaceEdge(arm, lanesOut(arm)));

export const FOOTWAY_OFFSET = 1.5;
/** Pedestrians cross an arm in a band this wide, just outside the junction; traffic waits behind it. */
const CROSSING_WIDTH = 3;
/** Gap between the crossing band and the stop line. */
const STOP_LINE_GAP = 0.5;

/** Where the junction ends on every arm: the edge of the junction square, or the outside of a roundabout's rings. */
export const junctionEdge = (layout: Layout) => {
  if (layout.kind !== 'roundabout') return junctionRadius(layout);
  return hasCycleRing(layout) ? CYCLE_RING_RADIUS + CYCLE_PATH_WIDTH / 2 : ISLAND_RADIUS + RING_WIDTH;
};

/** The distance from the centre at which pedestrians cross an arm: the middle of the crossing band. */
export const crossingDistance = (layout: Layout) => junctionEdge(layout) + CROSSING_WIDTH / 2;

/** Where traffic on an arm waits: behind the crossing band, so pedestrians cross in front of it. */
export const stopLineDistance = (layout: Layout) => junctionEdge(layout) + CROSSING_WIDTH + STOP_LINE_GAP;

/** On foot across an arm, starting on the footway to the right of inbound traffic. */
const crossingPath = (layout: Layout, arm: Arm): Path => {
  const along = crossingDistance(layout);
  const path: Path = new CurvePath();
  path.add(
    new LineCurve3(
      armPoint(arm, along, surfaceEdge(arm, lanesIn(arm)) + FOOTWAY_OFFSET),
      armPoint(arm, along, -surfaceEdge(arm, lanesOut(arm)) - FOOTWAY_OFFSET),
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

/** Anticlockwise seen from above (traffic keeps right), from one angle to another, in scene x/z. */
class RingArc extends Curve<Vector3> {
  constructor(
    private readonly radius: number,
    private readonly from: number,
    private readonly sweep: number,
  ) {
    super();
  }
  override getPoint(t: number, target = new Vector3()) {
    const a = this.from + this.sweep * t;
    // Plan angle anticlockwise from east; scene z points south.
    return target.set(this.radius * Math.cos(a), 0, -this.radius * Math.sin(a));
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

/** Direction of anticlockwise travel at a plan angle on the ring, in scene x/z. */
const ringTangent = (a: number) => new Vector3(-Math.sin(a), 0, -Math.cos(a));
const onRing = (radius: number, a: number) => new RingArc(radius, a, 0).getPoint(0);

const roundaboutPath = (layout: Layout, user: RoadUser, from: Arm, to: Arm, inSide: number, outSide: number): Path => {
  const radius = rides(user.kind) && hasCycleRing(layout) ? CYCLE_RING_RADIUS : RING_RADIUS;
  const start = armPoint(from, ARM_LENGTH, inSide);
  const approach = ringPoint(from, radius + RING_APPROACH, inSide);
  const leave = ringPoint(to, radius + RING_APPROACH, outSide);
  const end = armPoint(to, ARM_LENGTH, outSide);
  // Join the ring a little anticlockwise of where the lane line meets it, and leave a little before.
  const joinAngle = planAngle(ringPoint(from, radius, inSide)) + RING_BLEND;
  const sweep = (((planAngle(ringPoint(to, radius, outSide)) - RING_BLEND - joinAngle) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const leaveAngle = joinAngle + sweep;
  const join = onRing(radius, joinAngle);
  const part = onRing(radius, leaveAngle);
  const inDir = approach.clone().sub(start).normalize();
  const outDir = end.clone().sub(leave).normalize();

  const path: Path = new CurvePath();
  path.add(new LineCurve3(start, approach));
  path.add(
    new CubicBezierCurve3(
      approach,
      approach.clone().addScaledVector(inDir, RING_HANDLE),
      join.clone().addScaledVector(ringTangent(joinAngle), -RING_HANDLE),
      join,
    ),
  );
  path.add(new RingArc(radius, joinAngle, sweep));
  path.add(
    new CubicBezierCurve3(
      part,
      part.clone().addScaledVector(ringTangent(leaveAngle), RING_HANDLE),
      leave.clone().addScaledVector(outDir, -RING_HANDLE),
      leave,
    ),
  );
  path.add(new LineCurve3(leave, end));
  return path;
};

/** A Variant: the same Layout turned clockwise by `degrees`. Never mirrored, since that swaps left and right. */
export const rotateLayout = (layout: Layout, degrees: number): Layout => ({
  ...layout,
  arms: layout.arms.map((arm) => ({ ...arm, bearing: (((arm.bearing + degrees) % 360) + 360) % 360 })),
});
