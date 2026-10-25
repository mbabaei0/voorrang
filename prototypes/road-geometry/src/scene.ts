import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
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
  type Arm,
  type Layout,
  type LightState,
  type RoadUser,
  type RoadUserKind,
} from './layout';

const COLOURS = {
  grass: 0x7fb069,
  island: 0x6a9e57,
  asphalt: 0x4a4e54,
  unpaved: 0x9b8565,
  brick: 0x9c6b52,
  cyclePath: 0xb5413a,
  footway: 0xc9c3b8,
  white: 0xf4f4f0,
  rail: 0x2b2b2b,
  signRed: 0xd0202a,
  signYellow: 0xf3c400,
  post: 0x8a8f96,
  housing: 0x1d1f22,
};

const LAMPS: Record<'red' | 'yellow' | 'green', { lit: number; dark: number }> = {
  red: { lit: 0xff3b30, dark: 0x4a1512 },
  yellow: { lit: 0xffcc00, dark: 0x4a3a10 },
  green: { lit: 0x34c759, dark: 0x103a1c },
};

/** Road-user placeholders until the CC0 models are in: [width, height, length] in metres. */
const ROAD_USERS: Record<RoadUserKind, { size: [number, number, number]; colour: number }> = {
  car: { size: [1.8, 1.5, 4.2], colour: 0x3b82c4 },
  bus: { size: [2.55, 3, 12], colour: 0xe2e2e2 },
  tram: { size: [2.4, 3.2, 20], colour: 0xe8c547 },
  voorrangsvoertuig: { size: [2.1, 2.5, 5.5], colour: 0xf5e663 },
  bicycle: { size: [0.6, 1.6, 1.8], colour: 0x2f9e44 },
  moped: { size: [0.7, 1.4, 1.9], colour: 0x8e44ad },
  snorfiets: { size: [0.7, 1.4, 1.9], colour: 0xd9480f },
  pedestrian: { size: [0.5, 1.75, 0.5], colour: 0xf08c00 },
};

/** Height of each layer above the grass, so coplanar surfaces don't fight. */
const LAYER = { grass: -0.02, road: 0.01, footway: 0.012, cyclePath: 0.015, rails: 0.025, markings: 0.03 };

// ---- Geometry helpers. Every static piece is non-indexed, with normals and vertex colours, so it can merge. ----

const paint = (geometry: BufferGeometry, colour: number): BufferGeometry => {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const c = new Color(colour);
  const count = g.getAttribute('position').count;
  g.setAttribute('color', new Float32BufferAttribute(Array.from({ length: count }, () => [c.r, c.g, c.b]).flat(), 3));
  return g;
};

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

const armSurface = (layout: Layout, arm: Arm, out: BufferGeometry[]) => {
  const start = armStart(layout, arm);
  const colour = arm.exit ? COLOURS.brick : arm.surface === 'unpaved' ? COLOURS.unpaved : COLOURS.asphalt;
  out.push(strip(arm, [start, ARM_LENGTH], carriageway(arm), LAYER.road, colour));

  const rightEdge = inEdge(arm);
  const leftEdge = outEdge(arm);
  if (arm.cyclePath) {
    const cycleStart = layout.kind === 'roundabout' ? CYCLE_RING_RADIUS : start;
    const inner = VERGE_WIDTH;
    const [left, right] = carriageway(arm);
    out.push(strip(arm, [cycleStart, ARM_LENGTH], [right + inner, right + inner + CYCLE_PATH_WIDTH], LAYER.cyclePath, COLOURS.cyclePath));
    out.push(strip(arm, [cycleStart, ARM_LENGTH], [left - inner - CYCLE_PATH_WIDTH, left - inner], LAYER.cyclePath, COLOURS.cyclePath));
  }
  const footStart = footwayStart(layout, arm);
  const footway = (edge: number): [number, number] => [edge + FOOTWAY_OFFSET - FOOTWAY_WIDTH / 2, edge + FOOTWAY_OFFSET + FOOTWAY_WIDTH / 2];
  out.push(strip(arm, [footStart, ARM_LENGTH], footway(rightEdge), LAYER.footway, COLOURS.footway));
  const [near, far] = footway(leftEdge);
  out.push(strip(arm, [footStart, ARM_LENGTH], [-far, -near], LAYER.footway, COLOURS.footway));
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

const markings = (arm: Arm, stop: number, out: BufferGeometry[]) => {
  if (arm.exit) return;
  if (!arm.tram) dashes(arm, stop + 1, 0, out);
  for (let lane = 1; lane < lanesIn(arm); lane++) dashes(arm, stop + 1, lane * LANE_WIDTH, out);
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

const roadUserMaterials = new Map<RoadUserKind, MeshLambertMaterial>();

/** A placeholder box for a road user, waiting just before its stop line, facing along its path. */
const roadUserMesh = (layout: Layout, user: RoadUser) => {
  const { size, colour } = ROAD_USERS[user.kind];
  const [width, height, length] = size;
  let material = roadUserMaterials.get(user.kind);
  if (!material) roadUserMaterials.set(user.kind, (material = new MeshLambertMaterial({ color: colour })));
  const mesh = new Mesh(new BoxGeometry(width, height, length), material);
  mesh.name = `roadUser:${user.id}`;
  mesh.userData.roadUserId = user.id;

  const path = manoeuvrePath(layout, user);
  const waitAt = user.manoeuvre === 'cross' ? 0 : ARM_LENGTH - stopLineDistance(layout) - length / 2 - 0.5;
  const u = Math.max(0, waitAt / path.getLength());
  const position = path.getPointAt(u);
  mesh.position.set(position.x, height / 2, position.z);
  mesh.lookAt(mesh.position.clone().add(path.getTangentAt(u)));
  return mesh;
};

/** Build the 3D scene for a Layout and its road users. Lights and camera are the caller's. */
export const buildScene = (layout: Layout, roadUsers: RoadUser[] = []): Group => {
  const stop = stopLineDistance(layout);
  const ground: BufferGeometry[] = [paint(layFlat(new PlaneGeometry(2 * ARM_LENGTH + 20, 2 * ARM_LENGTH + 20), LAYER.grass), COLOURS.grass)];
  const lines: BufferGeometry[] = [];

  if (layout.kind === 'roundabout') {
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
    markings(arm, stop, lines);
    if (arm.tram) rails(arm, lines);
  }

  const group = new Group();
  group.name = 'layout';
  group.add(
    mergedMesh(ground, 'ground'),
    mergedMesh(lines, 'markings'),
    zebra(layout),
    teeth(layout, stop),
    signs(layout, stop),
    lights(layout, stop),
    ...roadUsers.map((user) => roadUserMesh(layout, user)),
  );
  return group;
};
