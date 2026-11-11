/**
 * Toy-like, low-poly models built from primitives, each merged into one vertex-coloured geometry so a road user
 * costs one draw call and all scenery together costs one more. Colours stay in the design system's family.
 *
 * Road users are built facing +Z (Object3D.lookAt points +Z at the target), standing on y = 0, then centred
 * vertically so the puzzle can keep placing them at half their height.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  ARM_LENGTH,
  CYCLE_RING_RADIUS,
  FOOTWAY_OFFSET,
  ISLAND_RADIUS,
  RING_WIDTH,
  armPoint,
  halfWidth,
  hasCycleRing,
  type Layout,
  type RoadUser,
  type RoadUserKind,
} from './layout';

// ---- Painting and placing primitives. ----

/** Give a geometry flat vertex colours and drop UVs, so differently built pieces merge. */
export const paint = (geometry: BufferGeometry, colour: number): BufferGeometry => {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const c = new Color(colour);
  const count = g.getAttribute('position').count;
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) data.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new Float32BufferAttribute(data, 3));
  return g;
};

const box = (w: number, h: number, d: number, colour: number, x = 0, y = 0, z = 0) =>
  paint(new BoxGeometry(w, h, d).translate(x, y, z), colour);

/** A wheel lying across the vehicle (axis along X). */
const wheel = (radius: number, width: number, x: number, y: number, z: number): BufferGeometry[] => [
  paint(new CylinderGeometry(radius, radius, width, 12).rotateZ(Math.PI / 2).translate(x, y, z), INK.tyre),
  paint(new CylinderGeometry(radius * 0.45, radius * 0.45, width + 0.02, 8).rotateZ(Math.PI / 2).translate(x, y, z), INK.hub),
];

const ball = (radius: number, colour: number, x: number, y: number, z: number, detail = 1) =>
  paint(new IcosahedronGeometry(radius, detail).translate(x, y, z), colour);

const INK = {
  tyre: 0x1e2124,
  hub: 0xc9cfc9,
  glass: 0x2b3a4a,
  trim: 0x3b4045,
  headlight: 0xfff3c4,
  taillight: 0xc4122f,
  white: 0xf4f5f2,
  info: 0x1c4f9c,
  blueLight: 0x2f7bff,
  lime: 0xc6e83a,
  trousers: 0x34495e,
  shoe: 0x22262a,
  hair: [0x3b2a20, 0x1e1b18, 0x8a5a2b, 0xd9b26a],
  skin: [0xf1c27d, 0xc68642, 0x8d5524, 0xe0ac69],
};

// ---- Road users. ----

/** [width, height, length] in metres; the models fit inside these boxes. */
export const ROAD_USER_SIZE: Record<RoadUserKind, [number, number, number]> = {
  car: [1.8, 1.5, 4.2],
  bus: [2.55, 3, 12],
  tram: [2.4, 3.2, 20],
  voorrangsvoertuig: [2.1, 2.5, 5.5],
  bicycle: [0.6, 1.6, 1.8],
  moped: [0.7, 1.4, 1.9],
  snorfiets: [0.7, 1.4, 1.9],
  pedestrian: [0.5, 1.75, 0.5],
};

/** Body (or shirt) colours per kind; road users of the same kind take the next one, so they tell apart. */
const PALETTE: Record<RoadUserKind, number[]> = {
  car: [0x3d7dd8, 0xf4f5f2, 0x2f9e8f, 0xf08c3c, 0x8a5cc2],
  bus: [0xf4f5f2],
  tram: [0xe8c547],
  voorrangsvoertuig: [0xf5e663],
  bicycle: [0x2f9e44, 0xe8590c, 0x1c7ed6],
  moped: [0x8e44ad, 0x2f9e8f],
  snorfiets: [0xd9480f, 0x3d7dd8],
  pedestrian: [0xf08c00, 0x5c7cfa, 0xd6336c],
};

/** Each road user's main colour, in Scenario order. The puzzle's chips use the same colour. */
export const roadUserColours = (users: RoadUser[]) => {
  const seen = new Map<RoadUserKind, number>();
  return new Map(
    users.map((u) => {
      const n = seen.get(u.kind) ?? 0;
      seen.set(u.kind, n + 1);
      const palette = PALETTE[u.kind];
      return [u.id, palette[n % palette.length]!] as const;
    }),
  );
};

export const kindColour = (kind: RoadUserKind) => PALETTE[kind][0]!;

const car = (c: number): BufferGeometry[] => [
  box(1.8, 0.62, 4.2, c, 0, 0.59, 0),
  box(1.84, 0.16, 0.2, INK.trim, 0, 0.36, 2.05),
  box(1.84, 0.16, 0.2, INK.trim, 0, 0.36, -2.05),
  box(1.6, 0.52, 2.2, INK.glass, 0, 1.16, -0.2),
  box(1.66, 0.1, 1.9, c, 0, 1.45, -0.25),
  box(0.34, 0.14, 0.05, INK.headlight, 0.58, 0.74, 2.1),
  box(0.34, 0.14, 0.05, INK.headlight, -0.58, 0.74, 2.1),
  box(0.34, 0.14, 0.05, INK.taillight, 0.58, 0.74, -2.1),
  box(0.34, 0.14, 0.05, INK.taillight, -0.58, 0.74, -2.1),
  ...[1.35, -1.35].flatMap((z) => [...wheel(0.32, 0.24, 0.8, 0.32, z), ...wheel(0.32, 0.24, -0.8, 0.32, z)]),
];

const bus = (c: number): BufferGeometry[] => [
  box(2.55, 2.5, 12, c, 0, 1.6, 0),
  box(2.58, 0.95, 10.4, INK.glass, 0, 2.08, -0.4),
  box(2.3, 1.5, 0.06, INK.glass, 0, 1.95, 6.0),
  box(2.6, 0.22, 12.02, INK.info, 0, 1.0, 0),
  box(2.3, 0.14, 11.2, 0xdde1dc, 0, 2.92, 0),
  box(1.5, 0.24, 0.07, 0xffb000, 0, 2.62, 6.02),
  box(0.4, 0.18, 0.05, INK.headlight, 0.85, 0.75, 6.02),
  box(0.4, 0.18, 0.05, INK.headlight, -0.85, 0.75, 6.02),
  ...[4, -3.8].flatMap((z) => [...wheel(0.5, 0.3, 1.15, 0.5, z), ...wheel(0.5, 0.3, -1.15, 0.5, z)]),
];

const tram = (c: number): BufferGeometry[] => {
  const parts: BufferGeometry[] = [];
  const section = 6.2;
  for (const z of [-6.8, 0, 6.8]) {
    parts.push(
      box(2.4, 2.4, section, c, 0, 1.75, z),
      box(2.44, 1.0, section - 0.8, INK.glass, 0, 2.15, z),
      box(2.42, 0.18, section + 0.02, INK.white, 0, 1.45, z),
      box(2.2, 0.45, section - 0.4, INK.trim, 0, 0.35, z),
      box(2.2, 0.12, section - 0.3, 0xdde1dc, 0, 3.0, z),
    );
  }
  for (const z of [-3.4, 3.4]) parts.push(box(2.1, 2.1, 0.7, INK.trim, 0, 1.7, z));
  for (const z of [9.92, -9.92]) parts.push(box(2.2, 1.3, 0.06, INK.glass, 0, 2.1, z));
  // Pantograph on the middle section.
  parts.push(
    box(0.08, 0.08, 1.4, INK.trim, 0, 3.12, 0).rotateX(0.35),
    box(1.6, 0.05, 0.08, INK.trim, 0, 3.17, 0.25),
  );
  return parts;
};

const ambulance = (c: number): BufferGeometry[] => [
  box(2.1, 1.0, 5.5, c, 0, 0.85, 0),
  box(2.1, 1.15, 3.7, c, 0, 1.92, -0.9),
  box(1.9, 0.72, 1.6, INK.glass, 0, 1.7, 1.95),
  box(1.96, 0.08, 1.5, c, 0, 2.1, 1.95),
  box(0.62, 0.18, 0.32, INK.blueLight, -0.34, 2.24, 1.95),
  box(0.62, 0.18, 0.32, INK.blueLight, 0.34, 2.24, 1.95),
  box(0.32, 0.16, 0.2, INK.blueLight, 0.8, 2.56, -2.7),
  box(0.32, 0.16, 0.2, INK.blueLight, -0.8, 2.56, -2.7),
  // Checked side band in blue and lime.
  ...Array.from({ length: 10 }, (_, i) => {
    const z = -2.5 + i * 0.55;
    const colour = i % 2 ? INK.lime : INK.info;
    return [box(0.04, 0.32, 0.55, colour, 1.06, 0.95, z), box(0.04, 0.32, 0.55, colour, -1.06, 0.95, z)];
  }).flat(),
  box(0.36, 0.14, 0.05, INK.headlight, 0.66, 0.85, 2.76),
  box(0.36, 0.14, 0.05, INK.headlight, -0.66, 0.85, 2.76),
  ...[1.8, -1.8].flatMap((z) => [...wheel(0.38, 0.26, 0.92, 0.38, z), ...wheel(0.38, 0.26, -0.92, 0.38, z)]),
];

/** A person's head with hair; `y` is the head centre. */
const head = (y: number, z: number, skin: number, hair: number): BufferGeometry[] => [
  paint(new SphereGeometry(0.15, 10, 8).translate(0, y, z), skin),
  box(0.3, 0.09, 0.3, hair, 0, y + 0.11, z - 0.02),
];

const helmetHead = (y: number, z: number, helmet: number): BufferGeometry[] => [
  paint(new SphereGeometry(0.18, 10, 8).translate(0, y, z), helmet),
  box(0.26, 0.09, 0.05, INK.glass, 0, y - 0.01, z + 0.16),
];

/** A Dutch upright bike with a front basket and a rider sitting tall. */
const bicycle = (c: number, skin: number, hair: number): BufferGeometry[] => [
  ...[0.56, -0.56].map((z) => paint(new TorusGeometry(0.33, 0.04, 6, 16).rotateY(Math.PI / 2).translate(0, 0.37, z), INK.tyre)),
  box(0.05, 0.05, 1.0, INK.trim, 0, 0.6, 0),
  box(0.05, 0.4, 0.05, INK.trim, 0, 0.72, -0.22),
  box(0.05, 0.5, 0.05, INK.trim, 0, 0.72, 0.42),
  box(0.52, 0.04, 0.04, INK.trim, 0, 0.98, 0.38),
  box(0.36, 0.22, 0.3, 0x9c6b52, 0, 0.86, 0.66),
  box(0.14, 0.5, 0.14, INK.trousers, 0.1, 0.6, -0.06),
  box(0.14, 0.5, 0.14, INK.trousers, -0.1, 0.6, -0.06),
  box(0.4, 0.55, 0.26, c, 0, 1.12, -0.14),
  box(0.1, 0.1, 0.46, c, 0.22, 1.1, 0.12),
  box(0.1, 0.1, 0.46, c, -0.22, 1.1, 0.12),
  ...head(1.5, -0.1, skin, hair),
];

/** A scooter with a helmeted rider (helmets are compulsory on mopeds and snorfietsen). */
const scooter = (c: number, skin: number): BufferGeometry[] => [
  ...wheel(0.25, 0.12, 0, 0.25, 0.66),
  ...wheel(0.25, 0.12, 0, 0.25, -0.66),
  box(0.42, 0.22, 1.2, c, 0, 0.42, 0),
  box(0.5, 0.78, 0.16, c, 0, 0.8, 0.55),
  box(0.5, 0.36, 0.72, c, 0, 0.66, -0.38),
  box(0.42, 0.08, 0.6, INK.tyre, 0, 0.88, -0.36),
  box(0.6, 0.05, 0.05, INK.trim, 0, 1.08, 0.55),
  box(0.16, 0.1, 0.05, INK.headlight, 0, 1.0, 0.64),
  box(0.14, 0.42, 0.14, INK.trousers, 0.1, 0.7, -0.05),
  box(0.14, 0.42, 0.14, INK.trousers, -0.1, 0.7, -0.05),
  box(0.4, 0.46, 0.26, 0x495057, 0, 1.08, -0.2),
  box(0.1, 0.1, 0.5, 0x495057, 0.22, 1.08, 0.1),
  box(0.1, 0.1, 0.5, 0x495057, -0.22, 1.08, 0.1),
  paint(new SphereGeometry(0.05, 6, 4).translate(0.22, 1.08, 0.36), skin),
  ...helmetHead(1.24, -0.16, c),
];

const pedestrian = (c: number, skin: number, hair: number): BufferGeometry[] => [
  box(0.15, 0.08, 0.24, INK.shoe, 0.09, 0.04, 0.03),
  box(0.15, 0.08, 0.24, INK.shoe, -0.09, 0.04, 0.03),
  box(0.14, 0.76, 0.16, INK.trousers, 0.09, 0.46, 0),
  box(0.14, 0.76, 0.16, INK.trousers, -0.09, 0.46, 0),
  box(0.42, 0.6, 0.24, c, 0, 1.12, 0),
  box(0.1, 0.55, 0.12, c, 0.27, 1.08, 0),
  box(0.1, 0.55, 0.12, c, -0.27, 1.08, 0),
  paint(new SphereGeometry(0.06, 6, 4).translate(0.27, 0.77, 0), skin),
  paint(new SphereGeometry(0.06, 6, 4).translate(-0.27, 0.77, 0), skin),
  box(0.3, 0.36, 0.12, 0x8a5cc2, 0, 1.16, -0.18),
  ...head(1.56, 0, skin, hair),
];

/** A road user's model: one merged geometry, centred on its height so the puzzle can stand it at height / 2. */
export const roadUserGeometry = (kind: RoadUserKind, colour: number, index: number): BufferGeometry => {
  const skin = INK.skin[index % INK.skin.length]!;
  const hair = INK.hair[(index * 3 + 1) % INK.hair.length]!;
  const parts = (() => {
    switch (kind) {
      case 'car':
        return car(colour);
      case 'bus':
        return bus(colour);
      case 'tram':
        return tram(colour);
      case 'voorrangsvoertuig':
        return ambulance(colour);
      case 'bicycle':
        return bicycle(colour, skin, hair);
      case 'moped':
      case 'snorfiets':
        return scooter(colour, skin);
      case 'pedestrian':
        return pedestrian(colour, skin, hair);
    }
  })();
  const merged = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return merged.translate(0, -ROAD_USER_SIZE[kind][1] / 2, 0);
};

// ---- Scenery: Dutch row houses, trees and bushes in the space between the arms. ----

/** Small seeded random generator, so the same Layout always gets the same scenery. */
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = <T>(rnd: () => number, list: T[]) => list[Math.floor(rnd() * list.length)]!;

const BRICK = [0x9c4a3a, 0xb5654a, 0x7f3b30, 0xa86b4c, 0x8c5a48];
const ROOF = [0x3d3f44, 0x5a3a33, 0x4a4e54];
const LEAVES = [0x5e8c4a, 0x6f9e57, 0x4f7a43, 0x7aa860];
const FLOWERS = [0xf5b301, 0xd6336c, 0xf4f5f2, 0x845ef7];

/** A narrow Dutch house built facing +Z (its front door), standing on y = 0. */
const house = (rnd: () => number, width: number): BufferGeometry[] => {
  const depth = 6;
  const floors = 2;
  const wall = floors * 2.6 + 0.3 + rnd() * 0.8;
  const brick = pick(rnd, BRICK);
  const roofColour = pick(rnd, ROOF);
  const pitch = width * 0.62;
  const roof = new Shape();
  roof.moveTo(-width / 2 - 0.15, 0);
  roof.lineTo(width / 2 + 0.15, 0);
  roof.lineTo(0, pitch);
  roof.closePath();
  const parts: BufferGeometry[] = [
    box(width, wall, depth, brick, 0, wall / 2, 0),
    box(width + 0.1, 0.25, depth + 0.1, INK.white, 0, wall, 0),
    paint(new ExtrudeGeometry(roof, { depth, bevelEnabled: false }).translate(0, wall + 0.1, -depth / 2), roofColour),
    box(1.0, 2.1, 0.12, pick(rnd, [0x2f5d50, 0x1c4f9c, 0x3b2a20]), -width / 4, 1.05, depth / 2 + 0.02),
  ];
  const columns = width > 5 ? 2 : 1;
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < columns; c++) {
      const x = columns === 1 ? width / 4 : (c - 0.5) * (width / 2);
      if (f === 0 && x < 0) continue;
      const y = 1.5 + f * 2.6;
      parts.push(box(1.1, 1.5, 0.08, INK.white, x, y, depth / 2 + 0.02), box(0.86, 1.26, 0.1, INK.glass, x, y, depth / 2 + 0.03));
    }
  }
  return parts;
};

/** Two to four houses side by side, the way Dutch streets are built. */
const terrace = (rnd: () => number): { parts: BufferGeometry[]; length: number } => {
  const count = 2 + Math.floor(rnd() * 3);
  const widths = Array.from({ length: count }, () => 4.6 + rnd() * 1.4);
  const length = widths.reduce((a, b) => a + b, 0);
  let x = -length / 2;
  const parts = widths.flatMap((w) => {
    const g = house(rnd, w).map((p) => p.translate(x + w / 2, 0, 0));
    x += w;
    return g;
  });
  return { parts, length };
};

const tree = (rnd: () => number, scale: number): BufferGeometry[] => {
  const leaves = pick(rnd, LEAVES);
  return [
    paint(new CylinderGeometry(0.16 * scale, 0.24 * scale, 1.8 * scale, 6).translate(0, 0.9 * scale, 0), 0x7a5a3a),
    ball(1.3 * scale, leaves, 0, 2.7 * scale, 0, 0),
    ball(0.9 * scale, leaves, 0.6 * scale, 3.3 * scale, 0.3 * scale, 0),
    ball(0.8 * scale, leaves, -0.5 * scale, 3.1 * scale, -0.4 * scale, 0),
  ];
};

const bush = (rnd: () => number): BufferGeometry[] => {
  const g = paint(new IcosahedronGeometry(0.7, 0).scale(1, 0.65, 1).translate(0, 0.35, 0), pick(rnd, LEAVES));
  const flowers = rnd() < 0.5 ? [ball(0.12, pick(rnd, FLOWERS), 0.3, 0.7, 0.2, 0), ball(0.12, pick(rnd, FLOWERS), -0.25, 0.65, -0.2, 0)] : [];
  return [g, ...flowers];
};

const FOOTWAY_OUTER = FOOTWAY_OFFSET + 1;

/** How far a point is from the nearest road surface or footway (negative inside one), and which way that is. */
const clearance = (layout: Layout, p: Vector3) => {
  let best = Infinity;
  let toward = new Vector3();
  for (const arm of layout.arms) {
    const origin = armPoint(arm, 0, 0);
    const along = armPoint(arm, 1, 0).sub(origin);
    const side = armPoint(arm, 0, 1).sub(origin);
    const a = p.dot(along);
    if (a < -4) continue;
    const s = p.dot(side);
    const d = Math.abs(s) - (halfWidth(arm) + FOOTWAY_OUTER);
    if (d < best) {
      best = d;
      toward = side.clone().multiplyScalar(-Math.sign(s));
    }
  }
  if (layout.kind === 'roundabout') {
    const ringOuter = (hasCycleRing(layout) ? CYCLE_RING_RADIUS + 1 : ISLAND_RADIUS + RING_WIDTH) + FOOTWAY_OUTER;
    const d = p.length() - ringOuter;
    if (d < best) {
      best = d;
      toward = p.clone().negate().normalize();
    }
  }
  return { distance: best, toward };
};

const place = (geometry: BufferGeometry[], at: Vector3, facing: Vector3) => {
  const angle = Math.atan2(facing.x, facing.z);
  return geometry.map((g) => g.rotateY(angle).translate(at.x, 0, at.z));
};

/** Everything around the roads, merged into one geometry. */
export const sceneryGeometry = (layout: Layout): BufferGeometry | null => {
  const seed = [...layout.kind, ...layout.arms.flatMap((a) => `${a.bearing}${a.exit ? 'x' : ''}`)].reduce(
    (h, ch) => (Math.imul(h, 31) + (typeof ch === 'string' ? ch.charCodeAt(0) : ch)) | 0,
    7,
  );
  const rnd = random(seed);
  const parts: BufferGeometry[] = [];
  const taken: { at: Vector3; radius: number }[] = [];
  const free = (at: Vector3, radius: number) => taken.every((t) => t.at.distanceTo(at) > t.radius + radius);
  const extent = ARM_LENGTH + 6;

  const scatter = (count: number, tries: number, radius: number, minClear: number, maxClear: number, make: (at: Vector3, toward: Vector3) => BufferGeometry[]) => {
    let placed = 0;
    for (let i = 0; i < tries && placed < count; i++) {
      const at = new Vector3((rnd() * 2 - 1) * extent, 0, (rnd() * 2 - 1) * extent);
      const { distance, toward } = clearance(layout, at);
      if (distance < minClear || distance > maxClear || !free(at, radius)) continue;
      parts.push(...make(at, toward));
      taken.push({ at, radius });
      placed++;
    }
  };

  // Terraces first, close to the road with their fronts to it, then trees and bushes in the gaps. The camera looks
  // from the south, so buildings stay on the far half, where they frame the junction instead of hiding it.
  let rows = 0;
  for (let i = 0; i < 300 && rows < 5; i++) {
    const at = new Vector3((rnd() * 2 - 1) * extent, 0, -rnd() * extent + 4);
    const { distance, toward } = clearance(layout, at);
    if (distance < 4 || distance > 7 || !free(at, 8)) continue;
    const { parts: row, length } = terrace(rnd);
    // Every house in the row must clear the roads too.
    const along = new Vector3(toward.z, 0, -toward.x);
    const ends = [-1, 1].map((k) => at.clone().addScaledVector(along, (k * length) / 2));
    if (ends.some((e) => clearance(layout, e).distance < 3.5)) continue;
    parts.push(...place(row, at, toward));
    taken.push({ at, radius: Math.max(5, length / 2 + 1) });
    rows++;
  }
  scatter(26, 600, 1.7, 1.4, 40, (at, toward) => place(tree(rnd, 0.8 + rnd() * 0.5), at, toward));
  scatter(22, 500, 0.8, 0.6, 40, (at, toward) => place(bush(rnd), at, toward));

  if (layout.kind === 'roundabout') {
    parts.push(...tree(rnd, 1.2));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      parts.push(...place(bush(rnd), new Vector3(Math.cos(a) * 4.8, 0, Math.sin(a) * 4.8), new Vector3(0, 0, 1)));
    }
  }

  if (!parts.length) return null;
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
};
