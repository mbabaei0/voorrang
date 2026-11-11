import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROAD_USER_SIZE, kindColour, paint, roadUserColours, roadUserGeometry, sceneryGeometry } from './models';
import {
  ARM_LENGTH,
  CYCLE_PATH_WIDTH,
  CYCLE_RING_RADIUS,
  ISLAND_RADIUS,
  LANE_WIDTH,
  RING_WIDTH,
  TRACK_SPACING,
  VERGE_WIDTH,
  armPoint,
  crossingDistance,
  hasCycleRing,
  lanesIn,
  lanesOut,
  manoeuvrePath,
  junctionEdge,
  junctionRadius,
  stopLineDistance,
  halfWidth,
  inEdge,
  outEdge,
  FOOTWAY_OFFSET,
  TURBO_LANE,
  armAngle,
  isTurbo,
  turboDividers,
  turboLaneRadius,
  turboMains,
  turboOuterEdge,
  type Arm,
  type Layout,
  type LightState,
  type RoadUser,
  type RoadUserKind,
} from './layout';

const COLOURS = {
  grass: 0x93ad7f,
  island: 0x7f9a6c,
  asphalt: 0x464c52,
  unpaved: 0x9b8565,
  brick: 0x9c6b52,
  cyclePath: 0xa9473d,
  footway: 0xbfc4bf,
  white: 0xf4f5f2,
  rail: 0x2b2b2b,
  signRed: 0xc4122f,
  signYellow: 0xf5b301,
  post: 0x8a8f96,
  housing: 0x1d1f22,
  kerb: 0xd6dad5,
  apron: 0x9a948c,
  lamp: 0xfff3c4,
};

const LAMPS: Record<'red' | 'yellow' | 'green', { lit: number; dark: number }> = {
  red: { lit: 0xff3b30, dark: 0x4a1512 },
  yellow: { lit: 0xffcc00, dark: 0x4a3a10 },
  green: { lit: 0x34c759, dark: 0x103a1c },
};

/** Height of each layer above the grass, so coplanar surfaces don't fight. */
const LAYER = { grass: -0.02, road: 0.01, footway: 0.012, cyclePath: 0.015, rails: 0.025, markings: 0.03 };

// ---- Geometry helpers. Every static piece is non-indexed, with normals and vertex colours, so it can merge. ----

/** Lay a flat geometry built in the XY plane (x = east, y = north) onto the ground at height `y`. */
const layFlat = (geometry: BufferGeometry, y: number) => geometry.rotateX(-Math.PI / 2).translate(0, y, 0);

/** A flat polygon through scene points. */
const polygon = (points: Vector3[], y: number, colour: number) =>
  paint(layFlat(new ShapeGeometry(new Shape(points.map((p) => new Vector2(p.x, -p.z)))), y), colour);

/** A flat strip on an arm, between two distances out from the centre and two side offsets. */
const strip = (arm: Arm, along: [number, number], side: [number, number], y: number, colour: number) =>
  polygon(
    [
      armPoint(arm, along[0], side[0]),
      armPoint(arm, along[1], side[0]),
      armPoint(arm, along[1], side[1]),
      armPoint(arm, along[0], side[1]),
    ],
    y,
    colour,
  );

const ring = (inner: number, outer: number, y: number, colour: number) =>
  paint(layFlat(new RingGeometry(inner, outer, 64), y), colour);

/** Rotation that turns a geometry's +Z face towards traffic approaching on an arm. */
const facingTraffic = (arm: Arm) => Math.PI - (arm.bearing * Math.PI) / 180;

/** Stand a geometry built facing +Z at a point beside an arm, facing approaching traffic. */
const standAt = (geometry: BufferGeometry, arm: Arm, at: Vector3, height: number) =>
  geometry.rotateY(facingTraffic(arm)).translate(at.x, height, at.z);

const dashes = (arm: Arm, from: number, side: number, out: BufferGeometry[]) => {
  for (let a = from; a + 3 <= ARM_LENGTH; a += 6) out.push(strip(arm, [a, a + 3], [side - 0.06, side + 0.06], LAYER.markings, COLOURS.white));
};

// ---- Pieces of the Layout. ----

const FOOTWAY_WIDTH = 2;

const carriageway = (arm: Arm): [number, number] => [-lanesOut(arm) * LANE_WIDTH, lanesIn(arm) * LANE_WIDTH];

const mainRoad = (layout: Layout) => layout.arms.filter((arm) => !arm.exit);

/**
 * Where an arm's own surfaces begin, out from the centre. The main road runs straight past an uitrit, and the
 * uitrit starts at its carriageway edge, so the main road's cycle paths and footways run on across it.
 */
const armStart = (layout: Layout, arm: Arm) => {
  if (isTurbo(layout)) return turboLaneRadius(Math.PI) + TURBO_LANE / 2 - 0.2;
  if (layout.kind === 'roundabout') return ISLAND_RADIUS + RING_WIDTH - 0.2;
  if (layout.kind !== 'exit') return junctionRadius(layout);
  if (!arm.exit) return 0;
  return Math.max(...mainRoad(layout).map((main) => Math.max(lanesIn(main), lanesOut(main)) * LANE_WIDTH));
};

/** Where an arm's footways begin: outside a roundabout's rings, or outside the main road's footways at an uitrit. */
const footwayStart = (layout: Layout, arm: Arm) => {
  if (layout.kind === 'roundabout') return junctionEdge(layout);
  if (arm.exit) return Math.max(...mainRoad(layout).map((main) => halfWidth(main) + FOOTWAY_OFFSET + FOOTWAY_WIDTH / 2));
  return armStart(layout, arm);
};

/** Road surfaces run on past the end of the arm to the edge of the ground, so roads don't stop in a field. */
const SURFACE_END = ARM_LENGTH + 10;

const armSurface = (layout: Layout, arm: Arm, out: BufferGeometry[]) => {
  const start = armStart(layout, arm);
  const colour = arm.exit ? COLOURS.brick : arm.surface === 'unpaved' ? COLOURS.unpaved : COLOURS.asphalt;
  out.push(strip(arm, [start, SURFACE_END], carriageway(arm), LAYER.road, colour));

  const rightEdge = inEdge(arm);
  const leftEdge = outEdge(arm);
  if (arm.cyclePath) {
    const cycleStart = layout.kind === 'roundabout' ? CYCLE_RING_RADIUS : start;
    const inner = VERGE_WIDTH;
    const [left, right] = carriageway(arm);
    out.push(strip(arm, [cycleStart, SURFACE_END], [right + inner, right + inner + CYCLE_PATH_WIDTH], LAYER.cyclePath, COLOURS.cyclePath));
    out.push(strip(arm, [cycleStart, SURFACE_END], [left - inner - CYCLE_PATH_WIDTH, left - inner], LAYER.cyclePath, COLOURS.cyclePath));
  }
  const footStart = footwayStart(layout, arm);
  const footway = (edge: number): [number, number] => [edge + FOOTWAY_OFFSET - FOOTWAY_WIDTH / 2, edge + FOOTWAY_OFFSET + FOOTWAY_WIDTH / 2];
  out.push(strip(arm, [footStart, SURFACE_END], footway(rightEdge), LAYER.footway, COLOURS.footway));
  const [near, far] = footway(leftEdge);
  out.push(strip(arm, [footStart, SURFACE_END], [-far, -near], LAYER.footway, COLOURS.footway));
};

/** The junction square: a polygon through the corners where neighbouring arms' road surfaces meet it. */
const junctionSurface = (layout: Layout, radius: number) => {
  const sorted = [...layout.arms].sort((a, b) => a.bearing - b.bearing);
  // Going clockwise, each arm's right-of-inbound side comes first.
  const corners = sorted.flatMap((arm) => [
    armPoint(arm, radius, inEdge(arm)),
    armPoint(arm, radius, -outEdge(arm)),
  ]);
  return polygon(corners.reverse(), LAYER.road, COLOURS.asphalt);
};

const rails = (arm: Arm, out: BufferGeometry[]) => {
  const gauge = 1.435 / 2;
  for (const track of [-TRACK_SPACING / 2, TRACK_SPACING / 2]) {
    for (const rail of [track - gauge, track + gauge]) {
      out.push(strip(arm, [0, ARM_LENGTH], [rail - 0.04, rail + 0.04], LAYER.rails, COLOURS.rail));
    }
  }
};

/** A solid line along an arm, between two distances out. */
const solid = (arm: Arm, from: number, to: number, side: number, out: BufferGeometry[]) =>
  out.push(strip(arm, [from, to], [side - 0.07, side + 0.07], LAYER.markings, COLOURS.white));

/**
 * Lane arrows, built in a frame where x is to the right of inbound traffic and y points ahead, then laid on the
 * lane with their tip `tip` metres out from the centre.
 */
type Turn = 'left' | 'straight' | 'right';
const arrow = (arm: Arm, tip: number, side: number, turns: Turn[], out: BufferGeometry[]) => {
  const shapes: [number, number][][] = [];
  const fork = 2.2;
  const top = turns.includes('straight') ? 3.6 : fork + 0.13;
  shapes.push([[-0.12, 0], [0.12, 0], [0.12, top], [-0.12, top]]);
  if (turns.includes('straight')) shapes.push([[-0.45, 3.6], [0.45, 3.6], [0, 5]]);
  for (const turn of turns) {
    if (turn === 'straight') continue;
    const k = turn === 'right' ? 1 : -1;
    shapes.push([[0, fork - 0.13], [k * 0.8, fork - 0.13], [k * 0.8, fork + 0.13], [0, fork + 0.13]]);
    shapes.push([[k * 0.8, fork - 0.45], [k * 1.45, fork], [k * 0.8, fork + 0.45]]);
  }
  for (const shape of shapes) out.push(polygon(shape.map(([x, y]) => armPoint(arm, tip + 5 - y, side + x)), LAYER.markings, COLOURS.white));
};

/**
 * Turbo roundabout lane markings. The lane line between the entry lanes, and between a main arm's exit lanes,
 * is solid towards the ring (no changing lanes), and arrows show where each entry lane can go: on the main
 * road the right lane goes right or straight on and the left lane straight on or left; from a side road the
 * right lane only goes right.
 */
const turboMarkings = (layout: Layout, arm: Arm, stop: number, out: BufferGeometry[]) => {
  const main = lanesOut(arm) === 2;
  solid(arm, stop, stop + 12, LANE_WIDTH, out);
  dashes(arm, stop + 13, LANE_WIDTH, out);
  if (main) {
    solid(arm, junctionEdge(layout) + 3, stop + 8, -LANE_WIDTH, out);
    dashes(arm, stop + 9, -LANE_WIDTH, out);
  }
  arrow(arm, stop + 4, LANE_WIDTH * 1.5, main ? ['straight', 'right'] : ['right'], out);
  arrow(arm, stop + 4, LANE_WIDTH * 0.5, ['straight', 'left'], out);
};

const markings = (layout: Layout, arm: Arm, stop: number, out: BufferGeometry[]) => {
  if (arm.exit) return;
  if (!arm.tram) dashes(arm, stop + 1, 0, out);
  if (isTurbo(layout) && lanesIn(arm) === 2) turboMarkings(layout, arm, stop, out);
  else for (let lane = 1; lane < lanesIn(arm); lane++) dashes(arm, stop + 1, lane * LANE_WIDTH, out);
  const control = arm.control;
  if (control?.lights || control?.priority === 'B7') {
    out.push(strip(arm, [stop, stop + 0.3], [0, lanesIn(arm) * LANE_WIDTH], LAYER.markings, COLOURS.white));
  }
};

/** Zebra stripes, laid along the traffic, across the carriageway where pedestrians cross. */
const zebra = (layout: Layout) => {
  const at = crossingDistance(layout);
  const parts = layout.arms
    .filter((arm) => arm.control?.zebra)
    .flatMap((arm) => {
      const [left, right] = carriageway(arm);
      const stripes: BufferGeometry[] = [];
      for (let s = left + 0.25; s + 0.5 <= right; s += 1) {
        stripes.push(strip(arm, [at - 1.25, at + 1.25], [s, s + 0.5], LAYER.markings, COLOURS.white));
      }
      return stripes;
    });
  return mergedMesh(parts, 'zebra');
};

/** Haaientanden: a row of white triangles across the inbound lanes, pointing at the traffic that gives way. */
const TOOTH_SPACING = 0.5;
const teeth = (layout: Layout, stop: number) => {
  const placements = layout.arms
    .filter((arm) => arm.control?.priority === 'B6' || arm.control?.priority === 'haaientanden')
    .flatMap((arm) =>
      Array.from({ length: Math.floor((lanesIn(arm) * LANE_WIDTH) / TOOTH_SPACING) }, (_, k) => ({
        arm,
        at: armPoint(arm, stop + 0.3, (k + 0.5) * TOOTH_SPACING),
      })),
    );
  // Built pointing north (+y before laying flat), then turned to point out along its arm.
  const tooth = paint(
    layFlat(new ShapeGeometry(new Shape([new Vector2(-0.18, -0.3), new Vector2(0.18, -0.3), new Vector2(0, 0.3)])), 0),
    COLOURS.white,
  );
  const mesh = new InstancedMesh(tooth, staticMaterial(), placements.length);
  mesh.name = 'haaientanden';
  mesh.visible = placements.length > 0;
  const m = new Matrix4();
  const q = new Quaternion();
  placements.forEach(({ arm, at }, i) => {
    q.setFromAxisAngle(new Vector3(0, 1, 0), -(arm.bearing * Math.PI) / 180);
    m.compose(new Vector3(at.x, LAYER.markings, at.z), q, new Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
  });
  return mesh;
};

const flatShape = (points: [number, number][], z: number, colour: number) =>
  paint(new ShapeGeometry(new Shape(points.map(([x, y]) => new Vector2(x, y)))).translate(0, 0, z), colour);

const regular = (sides: number, radius: number, turn: number): [number, number][] =>
  Array.from({ length: sides }, (_, i) => {
    const a = turn + (i * 2 * Math.PI) / sides;
    return [radius * Math.cos(a), radius * Math.sin(a)];
  });

/** A sign plate, built facing +Z around its centre. */
const plate = (sign: 'B1' | 'B6' | 'B7'): BufferGeometry[] => {
  switch (sign) {
    case 'B1':
      return [flatShape(regular(4, 0.5, 0), 0.03, COLOURS.white), flatShape(regular(4, 0.36, 0), 0.04, COLOURS.signYellow)];
    case 'B6':
      return [
        flatShape(regular(3, 0.55, -Math.PI / 2), 0.03, COLOURS.signRed),
        flatShape(regular(3, 0.36, -Math.PI / 2), 0.04, COLOURS.white),
      ];
    case 'B7':
      return [
        flatShape(regular(8, 0.45, Math.PI / 8), 0.03, COLOURS.signRed),
        flatShape([[-0.3, -0.07], [0.3, -0.07], [0.3, 0.07], [-0.3, 0.07]], 0.04, COLOURS.white),
      ];
  }
};

const post = (height: number) => paint(new BoxGeometry(0.08, height, 0.08).translate(0, height / 2, 0), COLOURS.post);

const signs = (layout: Layout, stop: number) => {
  const parts = layout.arms.flatMap((arm) => {
    const sign = arm.control?.priority;
    if (!sign || sign === 'haaientanden') return [];
    const at = armPoint(arm, stop + 0.8, inEdge(arm) + 0.8);
    return [standAt(post(2.4), arm, at, 0), ...plate(sign).map((g) => standAt(g, arm, at, 2))];
  });
  return mergedMesh(parts, 'signs');
};

const lampColours = (state: LightState) => ({
  red: state === 'red' ? LAMPS.red.lit : LAMPS.red.dark,
  yellow: state === 'yellow' || state === 'flashing-yellow' ? LAMPS.yellow.lit : LAMPS.yellow.dark,
  green: state === 'green' ? LAMPS.green.lit : LAMPS.green.dark,
});

const lights = (layout: Layout, stop: number) => {
  const parts = layout.arms.flatMap((arm) => {
    const state = arm.control?.lights;
    if (!state) return [];
    const at = armPoint(arm, stop + 0.3, inEdge(arm) + 0.6);
    const colours = lampColours(state);
    return [
      standAt(post(2.2), arm, at, 0),
      standAt(paint(new BoxGeometry(0.36, 1, 0.24), COLOURS.housing), arm, at, 2.7),
      ...(['red', 'yellow', 'green'] as const).map((lamp, i) =>
        standAt(paint(new CircleGeometry(0.12, 12).translate(0, 0.3 - i * 0.3, 0.13), colours[lamp]), arm, at, 2.7),
      ),
    ];
  });
  return mergedMesh(parts, 'lights');
};

/** Kerbstones along the carriageway and street lamps along the footways. */
const street = (layout: Layout) => {
  const parts: BufferGeometry[] = [];
  for (const arm of layout.arms) {
    if (arm.exit) continue;
    const start = armStart(layout, arm);
    const [left, right] = carriageway(arm);
    for (const side of [left - 0.1, right + 0.1]) {
      const from = isTurbo(layout) ? turboKerbStart(layout, arm, side, start) : start;
      const run = SURFACE_END - from;
      const at = armPoint(arm, from + run / 2, side);
      parts.push(standAt(paint(new BoxGeometry(0.2, 0.14, run), COLOURS.kerb), arm, at, 0.07));
    }
    // A lamp every 16 m on the far verge, its head reaching over the road.
    for (let d = Math.max(start, junctionEdge(layout)) + 7; d < ARM_LENGTH + 6; d += 16) {
      const at = armPoint(arm, d, -(outEdge(arm) + FOOTWAY_OFFSET + 1.4));
      const lamp = [
        paint(new BoxGeometry(0.14, 5.2, 0.14).translate(0, 2.6, 0), COLOURS.post),
        paint(new BoxGeometry(1.8, 0.1, 0.12).translate(0.85, 5.15, 0), COLOURS.post),
        paint(new BoxGeometry(0.55, 0.14, 0.32).translate(1.65, 5.05, 0), COLOURS.lamp),
      ];
      // Built reaching towards +X; turn it so it reaches over the road.
      parts.push(...lamp.map((g) => g.rotateY(facingTraffic(arm)).translate(at.x, 0, at.z)));
    }
  }
  return mergedMesh(parts, 'street');
};

// ---- Junction corners: where neighbouring arms' cycle paths, verges and footways meet. ----

/** Where two lines meet in the ground plane, or null when they are (nearly) parallel. */
const meetLines = (p: Vector3, d: Vector3, q: Vector3, e: Vector3): Vector3 | null => {
  const det = d.x * e.z - d.z * e.x;
  if (Math.abs(det) < 1e-6) return null;
  const t = ((q.x - p.x) * e.z - (q.z - p.z) * e.x) / det;
  return p.clone().addScaledVector(d, t);
};

/** The line along an arm at a signed side offset: a point and a direction. */
const armLine = (arm: Arm, side: number): [Vector3, Vector3] => {
  const p = armPoint(arm, 0, side);
  return [p, armPoint(arm, 1, side).sub(p)];
};

/** How far out along an arm a point lies. */
const alongArm = (arm: Arm, p: Vector3) => p.dot(armPoint(arm, 1, 0));

/** A band beside an arm, as [near, far] offsets from its centreline on one side. */
type Band = [number, number];

/** Clockwise gap from one arm's bearing to the next. */
const gap = (a: Arm, b: Arm) => (((b.bearing - a.bearing) % 360) + 360) % 360 || 360;

/**
 * Join a band on the left of arm `a` (its outbound side) to the same band on the right of the next arm `b`
 * clockwise. Bands that meet at an angle get a corner patch where they cross plus strips back to the arms; on
 * a straight run (a T-junction's through road) the band simply carries on across.
 */
const joinBands = (a: Arm, b: Arm, bandA: Band, bandB: Band, radius: number, y: number, colour: number, out: BufferGeometry[]) => {
  if (gap(a, b) > 165) {
    out.push(polygon([armPoint(a, radius, -bandA[0]), armPoint(a, radius, -bandA[1]), armPoint(b, radius, bandB[1]), armPoint(b, radius, bandB[0])], y, colour));
    return;
  }
  const corner = (sa: number, sb: number) => meetLines(...armLine(a, -sa), ...armLine(b, sb));
  const pts = [corner(bandA[0], bandB[0]), corner(bandA[0], bandB[1]), corner(bandA[1], bandB[1]), corner(bandA[1], bandB[0])];
  if (pts.some((p) => !p)) return;
  const quad = pts as Vector3[];
  out.push(polygon(quad, y, colour));
  const reachA = Math.min(...quad.map((p) => alongArm(a, p)));
  const reachB = Math.min(...quad.map((p) => alongArm(b, p)));
  if (reachA < radius) out.push(strip(a, [reachA, radius], [-bandA[1], -bandA[0]], y, colour));
  if (reachB < radius) out.push(strip(b, [reachB, radius], [bandB[0], bandB[1]], y, colour));
};

/** Dutch block markings: 0.5 m squares with 0.5 m gaps along a line on an arm, between two distances. */
const blocks = (arm: Arm, side: number, from: number, to: number, out: BufferGeometry[]) => {
  const [lo, hi] = from < to ? [from, to] : [to, from];
  for (let a = lo + 0.25; a + 0.5 <= hi; a += 1) out.push(strip(arm, [a, a + 0.5], [side - 0.25, side + 0.25], LAYER.markings, COLOURS.white));
};

const corners = (layout: Layout) => {
  const parts: BufferGeometry[] = [];
  if (layout.kind === 'roundabout' || layout.kind === 'exit') return mergedMesh(parts, 'corners');
  const radius = junctionRadius(layout);
  const sorted = [...layout.arms].sort((x, y) => x.bearing - y.bearing);
  const carriage = (arm: Arm, side: 'in' | 'out') => (side === 'in' ? lanesIn(arm) : lanesOut(arm)) * LANE_WIDTH;
  const edge = (arm: Arm, side: 'in' | 'out') => (side === 'in' ? inEdge(arm) : outEdge(arm));
  const footway = (arm: Arm, side: 'in' | 'out'): Band => [edge(arm, side) + FOOTWAY_OFFSET - FOOTWAY_WIDTH / 2, edge(arm, side) + FOOTWAY_OFFSET + FOOTWAY_WIDTH / 2];
  const cycle = (arm: Arm, side: 'in' | 'out'): Band => [carriage(arm, side) + VERGE_WIDTH, carriage(arm, side) + VERGE_WIDTH + CYCLE_PATH_WIDTH];
  const verge = (arm: Arm, side: 'in' | 'out'): Band => [carriage(arm, side), carriage(arm, side) + VERGE_WIDTH];

  sorted.forEach((a, i) => {
    const b = sorted[(i + 1) % sorted.length]!;
    if (a === b) return;
    joinBands(a, b, footway(a, 'out'), footway(b, 'in'), radius, LAYER.footway, COLOURS.footway, parts);
    if (a.cyclePath && b.cyclePath) {
      joinBands(a, b, verge(a, 'out'), verge(b, 'in'), radius, LAYER.footway, COLOURS.grass, parts);
      joinBands(a, b, cycle(a, 'out'), cycle(b, 'in'), radius, LAYER.cyclePath, COLOURS.cyclePath, parts);
    }
  });

  // Where a cycle path runs straight on across a side road, block markings show the crossing.
  sorted.forEach((side, i) => {
    const before = sorted[(i - 1 + sorted.length) % sorted.length]!;
    const after = sorted[(i + 1) % sorted.length]!;
    if (!before.cyclePath || !after.cyclePath || !side.cyclePath) return;
    if (Math.abs(gap(before, after) - 180) > 5) return;
    // `before`'s outbound-side cycle path carries on to `after`'s inbound side, across `side`'s mouth.
    const [near, far] = cycle(before, 'out');
    const sideBand = verge(side, 'in')[0];
    const reach = Math.max(sideBand, verge(side, 'out')[0]) + VERGE_WIDTH;
    for (const offset of [near, far]) blocks(before, -offset, reach, -reach, parts);
  });

  return mergedMesh(parts, 'corners');
};

/** Roundabout details: a cobbled apron and kerb round the island, and splitter islands on the arms. */
const roundaboutDetails = (layout: Layout) => {
  const parts: BufferGeometry[] = [];
  if (isTurbo(layout)) {
    for (const arm of layout.arms) {
      if (arm.tram) continue;
      const at = armPoint(arm, 21.2, 0);
      parts.push(standAt(paint(new BoxGeometry(1.1, 0.14, 9), COLOURS.kerb), arm, at, 0.07));
      parts.push(standAt(paint(new BoxGeometry(0.8, 0.16, 8.6), COLOURS.island), arm, at, 0.08));
    }
  } else if (layout.kind === 'roundabout') {
    parts.push(ring(ISLAND_RADIUS - 1.4, ISLAND_RADIUS, LAYER.footway, COLOURS.apron));
    parts.push(paint(new RingGeometry(ISLAND_RADIUS - 1.6, ISLAND_RADIUS - 1.4, 64).rotateX(-Math.PI / 2).translate(0, 0.08, 0), COLOURS.kerb));
    const ringOuter = ISLAND_RADIUS + RING_WIDTH;
    for (const arm of layout.arms) {
      if (arm.tram) continue;
      const at = armPoint(arm, ringOuter + 4.5, 0);
      parts.push(standAt(paint(new BoxGeometry(1.1, 0.14, 8), COLOURS.kerb), arm, at, 0.07));
      parts.push(standAt(paint(new BoxGeometry(0.8, 0.16, 7.6), COLOURS.island), arm, at, 0.08));
    }
  }
  return mergedMesh(parts, 'roundabout');
};

// ---- Turbo roundabouts: a spiral island, a ring whose outside spirals with it, and raised lane dividers. ----

/** A point at a plan angle (anticlockwise from east) and distance from the centre. */
const polar = (angle: number, r: number) => new Vector3(r * Math.cos(angle), 0, -r * Math.sin(angle));
const angleOf = (p: Vector3) => Math.atan2(-p.z, p.x);

/**
 * A closed outline round a turbo roundabout, in two halves, one from each main arm, at `radius(phi)` from the
 * centre, where phi is how far round the inner lane is. It steps at each main arm, where a new lane begins.
 */
const turboOutline = (layout: Layout, radius: (phi: number) => number, steps = 72) =>
  turboMains(layout).flatMap((main) =>
    Array.from({ length: steps + 1 }, (_, j) => {
      const phi = (Math.PI * j) / steps;
      return polar(armAngle(main) + phi, radius(phi));
    }),
  );

const turboGround = (layout: Layout) => [
  polygon(turboOutline(layout, (phi) => turboLaneRadius(phi + Math.PI) + TURBO_LANE / 2), LAYER.road, COLOURS.asphalt),
  // A paved island, planted in the middle.
  polygon(turboOutline(layout, (phi) => turboLaneRadius(phi) - TURBO_LANE / 2), LAYER.footway, COLOURS.apron),
  polygon(turboOutline(layout, (phi) => turboLaneRadius(phi) - TURBO_LANE / 2 - 1.4), LAYER.cyclePath, COLOURS.island),
];

/** A raised kerb along a line of points, as one box per segment. */
const kerbLine = (points: Vector3[], width: number, height: number, colour: number, out: BufferGeometry[]) => {
  for (let i = 0; i + 1 < points.length; i++) {
    const p = points[i]!;
    const q = points[i + 1]!;
    const length = p.distanceTo(q);
    if (length < 1e-3) continue;
    const mid = p.clone().add(q).multiplyScalar(0.5);
    const box = new BoxGeometry(width, height, length + width * 0.6);
    out.push(paint(box.rotateY(Math.atan2(q.x - p.x, q.z - p.z)).translate(mid.x, height / 2, mid.z), colour));
  }
};

/** Split a line of points into runs, leaving out the points `skip` picks. */
const runs = (points: Vector3[], skip: (p: Vector3) => boolean) =>
  points.reduce<Vector3[][]>((all, p) => {
    if (skip(p)) all.push([]);
    else all[all.length - 1]!.push(p);
    return all;
  }, [[]]);

/** Whether a point lies in an arm's mouth: on its carriageway, out from the centre. */
const inMouth = (arm: Arm, p: Vector3, margin: number) => {
  const along = p.dot(armPoint(arm, 1, 0));
  const side = p.dot(armPoint(arm, 0, 1));
  const [left, right] = carriageway(arm);
  return along > 0 && side > left - margin && side < right + margin;
};

/** Where a kerb `side` metres right of an arm's inbound traffic meets the outside of a turbo ring. */
const turboKerbStart = (layout: Layout, arm: Arm, side: number, from: number) => {
  for (let along = from; along < SURFACE_END; along += 0.1) {
    const p = armPoint(arm, along, side);
    if (p.length() >= turboOuterEdge(layout, angleOf(p))) return along;
  }
  return from;
};

/** Kerbs round the island and the outside of the ring, and the white raised lane dividers. */
const turboKerbs = (layout: Layout) => {
  const parts: BufferGeometry[] = [];
  if (isTurbo(layout)) {
    const island = turboOutline(layout, (phi) => turboLaneRadius(phi) - TURBO_LANE / 2);
    kerbLine([...island, island[0]!], 0.25, 0.16, COLOURS.kerb, parts);
    const outside = turboOutline(layout, (phi) => turboLaneRadius(phi + Math.PI) + TURBO_LANE / 2 + 0.1);
    for (const run of runs([...outside, outside[0]!], (p) => layout.arms.some((arm) => inMouth(arm, p, 0.3)))) {
      kerbLine(run, 0.2, 0.14, COLOURS.kerb, parts);
    }
    for (const run of turboDividers(layout)) kerbLine(run, 0.35, 0.12, COLOURS.white, parts);
  }
  return mergedMesh(parts, 'turbo');
};

// ---- Meshes. ----

let shared: MeshLambertMaterial | undefined;
/** One material for all static geometry: colour comes from the vertices. */
const staticMaterial = () => (shared ??= new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }));

const mergedMesh = (parts: BufferGeometry[], name: string) => {
  const mesh = new Mesh(parts.length ? mergeGeometries(parts) : new BufferGeometry(), staticMaterial());
  mesh.name = name;
  mesh.visible = parts.length > 0;
  return mesh;
};

let modelShared: MeshLambertMaterial | undefined;
/** Road users and scenery: vertex colours, flat shaded for the low-poly toy look. */
const modelMaterial = () => (modelShared ??= new MeshLambertMaterial({ vertexColors: true, flatShading: true }));

export const roadUserLength = (kind: RoadUserKind) => ROAD_USER_SIZE[kind][2];
export const roadUserHeight = (kind: RoadUserKind) => ROAD_USER_SIZE[kind][1];
export const roadUserColour = (kind: RoadUserKind) => kindColour(kind);
export { roadUserColours };

/** How far along its path a road user stands while it waits: just behind the stop line, or at the kerb. */
export const waitingDistance = (layout: Layout, user: RoadUser) =>
  user.manoeuvre === 'cross' ? 0 : Math.max(0, ARM_LENGTH - stopLineDistance(layout) - roadUserLength(user.kind) / 2 - 0.5);

/** A road user's model, waiting just before its stop line, facing along its path. */
const roadUserMesh = (layout: Layout, user: RoadUser, colour: number, index: number) => {
  const height = ROAD_USER_SIZE[user.kind][1];
  const mesh = new Mesh(roadUserGeometry(user.kind, colour, index), modelMaterial());
  mesh.castShadow = true;
  mesh.name = `roadUser:${user.id}`;
  mesh.userData.roadUserId = user.id;

  const path = manoeuvrePath(layout, user);
  const u = waitingDistance(layout, user) / path.getLength();
  const position = path.getPointAt(u);
  mesh.position.set(position.x, height / 2, position.z);
  mesh.lookAt(mesh.position.clone().add(path.getTangentAt(u)));
  return mesh;
};

const scenery = (layout: Layout) => {
  const geometry = sceneryGeometry(layout);
  const mesh = new Mesh(geometry ?? new BufferGeometry(), modelMaterial());
  mesh.name = 'scenery';
  mesh.visible = !!geometry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

/** Build the 3D scene for a Layout and its road users. Lights and camera are the caller's. */
export const buildScene = (layout: Layout, roadUsers: RoadUser[] = []): Group => {
  const stop = stopLineDistance(layout);
  const ground: BufferGeometry[] = [paint(layFlat(new PlaneGeometry(2 * SURFACE_END, 2 * SURFACE_END), LAYER.grass), COLOURS.grass)];
  const lines: BufferGeometry[] = [];

  if (isTurbo(layout)) {
    ground.push(...turboGround(layout));
  } else if (layout.kind === 'roundabout') {
    ground.push(paint(layFlat(new CircleGeometry(ISLAND_RADIUS, 48), LAYER.road), COLOURS.island));
    ground.push(ring(ISLAND_RADIUS, ISLAND_RADIUS + RING_WIDTH, LAYER.road, COLOURS.asphalt));
    if (hasCycleRing(layout)) {
      ground.push(ring(CYCLE_RING_RADIUS - CYCLE_PATH_WIDTH / 2, CYCLE_RING_RADIUS + CYCLE_PATH_WIDTH / 2, LAYER.cyclePath, COLOURS.cyclePath));
    }
  } else if (layout.kind !== 'exit') {
    ground.push(junctionSurface(layout, junctionRadius(layout)));
  }

  for (const arm of layout.arms) {
    armSurface(layout, arm, ground);
    markings(layout, arm, stop, lines);
    if (arm.tram) rails(arm, lines);
  }

  const colours = roadUserColours(roadUsers);
  const group = new Group();
  group.name = 'layout';
  group.add(
    mergedMesh(ground, 'ground'),
    mergedMesh(lines, 'markings'),
    zebra(layout),
    teeth(layout, stop),
    street(layout),
    corners(layout),
    roundaboutDetails(layout),
    turboKerbs(layout),
    signs(layout, stop),
    lights(layout, stop),
    scenery(layout),
    ...roadUsers.map((user, i) => roadUserMesh(layout, user, colours.get(user.id)!, i)),
  );
  for (const name of ['ground', 'markings', 'zebra', 'haaientanden', 'corners', 'roundabout', 'turbo']) group.getObjectByName(name)!.receiveShadow = true;
  for (const name of ['signs', 'lights', 'street', 'turbo']) group.getObjectByName(name)!.castShadow = true;
  group.getObjectByName('street')!.receiveShadow = true;
  return group;
};
