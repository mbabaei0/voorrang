import {
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { conflicts } from './conflicts';
import { manoeuvrePath } from './layout';
import { presets } from './presets';
import { buildScene } from './scene';

const canvas = document.createElement('canvas');
document.body.prepend(canvas);
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new Scene();
scene.background = new Color(0xdfe7ec);
scene.add(new HemisphereLight(0xffffff, 0x667755, 2));
const sun = new DirectionalLight(0xffffff, 1.5);
sun.position.set(20, 40, 10);
scene.add(sun);

const camera = new PerspectiveCamera(45, 1, 0.5, 300);
camera.position.set(0, 55, 40);
const controls = new OrbitControls(camera, canvas);
controls.maxPolarAngle = Math.PI / 2.2;

const select = document.querySelector<HTMLSelectElement>('#layout')!;
const showPaths = document.querySelector<HTMLInputElement>('#paths')!;
const showConflicts = document.querySelector<HTMLInputElement>('#conflicts')!;
const stats = document.querySelector<HTMLSpanElement>('#stats')!;
for (const name of Object.keys(presets)) select.add(new Option(name, name));

const pathMaterial = new LineBasicMaterial({ color: 0x1060ff });
const conflictMaterials = { cross: new MeshBasicMaterial({ color: 0xff2020 }), merge: new MeshBasicMaterial({ color: 0xff9900 }) };
const marker = new SphereGeometry(0.35, 12, 8);

let current = new Group();
let overlays = { paths: new Group(), conflicts: new Group() };

const load = () => {
  const { layout, roadUsers } = presets[select.value]!;
  scene.remove(current, overlays.paths, overlays.conflicts);
  current = buildScene(layout, roadUsers);
  overlays = { paths: new Group(), conflicts: new Group() };
  for (const user of roadUsers) {
    const points = manoeuvrePath(layout, user).getSpacedPoints(120).map((p) => p.setY(0.2));
    overlays.paths.add(new Line(new BufferGeometry().setFromPoints(points), pathMaterial));
  }
  for (const conflict of conflicts(layout, roadUsers)) {
    const dot = new Mesh(marker, conflictMaterials[conflict.kind]);
    dot.position.copy(conflict.at).setY(0.4);
    overlays.conflicts.add(dot);
  }
  scene.add(current, overlays.paths, overlays.conflicts);
  render();
};

/** Render on demand: only when something changes. */
const render = () => {
  overlays.paths.visible = showPaths.checked;
  overlays.conflicts.visible = showConflicts.checked;
  const { clientWidth: w, clientHeight: h } = canvas;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const started = performance.now();
  renderer.render(scene, camera);
  const ms = performance.now() - started;
  // Overlays are debug aids; count the scene as the app would draw it.
  const { calls, triangles } = renderer.info.render;
  const overlayCalls = (showPaths.checked ? overlays.paths.children.length : 0) + (showConflicts.checked ? overlays.conflicts.children.length : 0);
  stats.textContent = `${calls - overlayCalls} draw calls (+${overlayCalls} overlay) · ${triangles} tris · ${ms.toFixed(1)} ms CPU`;
};

controls.addEventListener('change', render);
select.addEventListener('change', load);
showPaths.addEventListener('change', render);
showConflicts.addEventListener('change', render);
addEventListener('resize', render);
load();
