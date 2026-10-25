import { describe, expect, it } from 'vitest';
import { Box3, InstancedMesh, Matrix4, Mesh, Object3D, Vector3 } from 'three';
import { buildScene } from './scene';
import type { Arm, Layout, RoadUser } from './layout';

/** What WebGLRenderer would issue: one draw per visible mesh per material group. */
const drawCalls = (root: Object3D) => {
  let calls = 0;
  root.traverseVisible((o) => {
    if (o instanceof Mesh) calls += Array.isArray(o.material) ? Math.max(1, o.geometry.groups.length) : 1;
  });
  return calls;
};

// Scene coordinates are three.js: x = east, y = up, z = south.
const north = (v: Vector3) => -v.z;
const boundsOf = (root: Object3D, name: string) => {
  const object = root.getObjectByName(name);
  if (!object) throw new Error(`No "${name}" in the scene`);
  return new Box3().setFromObject(object);
};

/** Every arm as busy as a Scenario gets: two lanes in, cycle paths, tram, lights, zebra, a priority sign. */
const busyArm = (id: string, bearing: number): Arm => ({
  id,
  bearing,
  lanesIn: 2,
  cyclePath: true,
  tram: bearing % 180 === 90,
  control: { priority: bearing === 0 || bearing === 180 ? 'B1' : 'B6', lights: 'red', zebra: true },
});

const busy: Record<Layout['kind'], Layout> = {
  crossroads: { kind: 'crossroads', arms: [busyArm('n', 0), busyArm('e', 90), busyArm('s', 180), busyArm('w', 270)] },
  't-junction': { kind: 't-junction', arms: [busyArm('e', 90), busyArm('s', 180), busyArm('w', 270)] },
  roundabout: { kind: 'roundabout', arms: [busyArm('n', 0), busyArm('e', 90), busyArm('s', 180), busyArm('w', 270)] },
  exit: {
    kind: 'exit',
    arms: [busyArm('n', 0), { id: 'e', bearing: 90, exit: true }, busyArm('s', 180)],
  },
};

const eightRoadUsers = (layout: Layout): RoadUser[] => {
  const kinds: RoadUser['kind'][] = ['car', 'bicycle', 'moped', 'pedestrian', 'bus', 'voorrangsvoertuig', 'car', 'bicycle'];
  const opposite = (arm: Arm) => layout.arms.some((other) => Math.abs(other.bearing - arm.bearing) === 180);
  return kinds.map((kind, i) => {
    const arm = layout.arms[i % layout.arms.length]!;
    return { id: `u${i}`, kind, arm: arm.id, manoeuvre: kind === 'pedestrian' ? 'cross' : opposite(arm) ? 'straight' : 'left' };
  });
};

describe('buildScene', () => {
  it.each(Object.entries(busy))('draws a busy %s with eight road users in at most 100 draw calls', (_, layout) => {
    const scene = buildScene(layout, eightRoadUsers(layout));
    expect(drawCalls(scene)).toBeLessThanOrEqual(100);
  });

  const crossroadsWith = (control: Arm['control']): Layout => ({
    kind: 'crossroads',
    arms: [
      { id: 'n', bearing: 0 },
      { id: 'e', bearing: 90 },
      { id: 's', bearing: 180, control },
      { id: 'w', bearing: 270 },
    ],
  });
  // One lane each way, no cycle paths: lanes span 3.5 m either side of the centreline. The junction ends at 5 m,
  // pedestrians cross in the band from 5 to 8 m, and traffic waits at the stop line at 8.5 m, before the crossing.

  it('lays haaientanden across the inbound lane, one tooth per 0.5 m, at the stop line', () => {
    const scene = buildScene(crossroadsWith({ priority: 'haaientanden' }));
    const teeth = scene.getObjectByName('haaientanden') as InstancedMesh;
    expect(teeth.count).toBe(7);
    const at = new Vector3();
    for (let i = 0; i < teeth.count; i++) {
      at.setFromMatrixPosition(new Matrix4().fromArray(teeth.instanceMatrix.array, i * 16));
      expect(at.x).toBeGreaterThan(0);
      expect(at.x).toBeLessThan(3.5);
      expect(north(at)).toBeLessThan(-8.5);
      expect(north(at)).toBeGreaterThan(-9.5);
    }
  });

  it('stands a B6 sign on the right-hand verge of its arm, facing the traffic that gives way', () => {
    const bounds = boundsOf(buildScene(crossroadsWith({ priority: 'B6' })), 'signs');
    expect(bounds.min.x).toBeGreaterThan(3.5);
    expect(-bounds.min.z).toBeLessThan(-8.5);
    expect(bounds.max.y).toBeGreaterThan(2);
  });

  it('stands traffic lights on the right-hand verge of their arm', () => {
    const bounds = boundsOf(buildScene(crossroadsWith({ lights: 'red' })), 'lights');
    expect(bounds.min.x).toBeGreaterThan(3.5);
    expect(-bounds.min.z).toBeLessThan(-5);
  });

  it('paints a zebra across the whole carriageway where pedestrians cross', () => {
    const bounds = boundsOf(buildScene(crossroadsWith({ zebra: true })), 'zebra');
    expect(bounds.min.x).toBeGreaterThan(-3.5);
    expect(bounds.max.x).toBeLessThan(3.5);
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(6);
    expect((-bounds.min.z - bounds.max.z) / 2).toBeCloseTo(-6.5);
    // Clear of the stop line, so waiting traffic does not stand on it.
    expect(-bounds.min.z).toBeLessThan(-5);
    expect(-bounds.max.z).toBeGreaterThan(-8.5);
  });

  it('draws nothing for Controls an arm does not have', () => {
    const scene = buildScene(crossroadsWith(undefined));
    for (const name of ['signs', 'lights', 'zebra']) expect(scene.getObjectByName(name)?.visible).toBe(false);
    expect((scene.getObjectByName('haaientanden') as InstancedMesh).count).toBe(0);
  });
});
