import {
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  RingGeometry,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { conflicts } from '../conflicts';
import { manoeuvrePath, type RoadUserKind } from '../layout';
import { buildScene, roadUserColour, roadUserHeight, roadUserLength, waitingDistance } from '../scene';
import { emptyAnswer, fromSteps, move, score, steps, tap, toggleLink, type Answer, type Score } from './answer';
import { scheduleReplay, type Replay, type WrongAnswer } from './replay';
import { scenarios, type Scenario } from './scenarios';

const KIND_LABEL: Record<RoadUserKind, string> = {
  car: 'Car',
  bus: 'Bus',
  tram: 'Tram',
  voorrangsvoertuig: 'Ambulance',
  bicycle: 'Cyclist',
  moped: 'Moped',
  snorfiets: 'Snorfiets',
  pedestrian: 'Pedestrian',
};

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const stage = $('#stage');
const tray = $('#tray');
const feedback = $<HTMLParagraphElement>('#feedback');
const checkButton = $<HTMLButtonElement>('#check');
const clearButton = $<HTMLButtonElement>('#clear');
const settings = $<HTMLFormElement>('#settings');
const fps = $('#fps');

// ---- Renderer, scene, camera. ----

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.prepend(renderer.domElement);
const labels = new CSS2DRenderer({ element: $('#labels') });

const scene = new Scene();
scene.background = new Color(0xdfe7ec);
scene.add(new HemisphereLight(0xffffff, 0x667755, 2));
const sun = new DirectionalLight(0xffffff, 1.5);
sun.position.set(20, 40, 10);
scene.add(sun);

const camera = new PerspectiveCamera(50, 1, 0.5, 300);
const controls = new OrbitControls(camera, renderer.domElement);
controls.maxPolarAngle = Math.PI / 2.2;
controls.enabled = false;

// ---- Settings (the variants under test). ----

const setting = (name: string) => new FormData(settings).get(name) as string | null;
const inputMode = () => setting('input') as 'scene' | 'tray';
const tiesAllowed = () => setting('ties') === 'links';
const speed = () => Number(setting('speed'));

// ---- Puzzle state. ----

type Phase = 'answering' | 'replaying' | 'done';
let scenario: Scenario = scenarios[0]!;
let answer: Answer = emptyAnswer;
let phase: Phase = 'answering';
let result: Score | null = null;
/** The replay running is the Passing order shown after a wrong answer, not the learner's own. */
let showingSolution = false;
let world = new Group();
const meshes = new Map<string, Mesh>();
const badges = new Map<string, CSS2DObject>();
const proxies: Object3D[] = [];
let crashMarker: Mesh | null = null;
/** Pairs of road users whose paths meet, as "a|b" both ways: only they have to wait for each other. */
let meeting = new Set<string>();
const meet = (a: string, b: string) => meeting.has(`${a}|${b}`);
const proxyMaterial = new MeshBasicMaterial();
const crashMaterial = new MeshBasicMaterial({ color: 0xcf222e });

const user = (id: string) => scenario.roadUsers.find((u) => u.id === id)!;
const label = (id: string) => {
  const u = user(id);
  const sameKind = scenario.roadUsers.filter((o) => o.kind === u.kind).length > 1;
  return sameKind ? `${KIND_LABEL[u.kind]} (${id})` : KIND_LABEL[u.kind];
};
const list = (ids: string[]) => ids.map(label).join(' and ');

const loadScenario = (next: Scenario) => {
  scenario = next;
  answer = emptyAnswer;
  phase = 'answering';
  result = null;
  showingSolution = false;
  replay = null;
  feedback.hidden = true;
  scene.remove(world);
  world.traverse((o) => (o as Mesh).geometry?.dispose());
  for (const holder of badges.values()) holder.element.remove();
  meshes.clear();
  badges.clear();
  proxies.length = 0;
  crashMarker = null;

  world = buildScene(scenario.layout, scenario.roadUsers);
  meeting = new Set(conflicts(scenario.layout, scenario.roadUsers).flatMap((c) => [`${c.a}|${c.b}`, `${c.b}|${c.a}`]));
  for (const u of scenario.roadUsers) {
    const mesh = world.getObjectByName(`roadUser:${u.id}`) as Mesh;
    meshes.set(u.id, mesh);
    // A generous invisible box to tap, so small cyclists and pedestrians are easy to hit on a phone.
    const proxy = new Mesh(new BoxGeometry(2.5, roadUserHeight(u.kind) + 1, Math.max(3, roadUserLength(u.kind))), proxyMaterial);
    proxy.visible = false;
    proxy.userData.roadUserId = u.id;
    mesh.add(proxy);
    proxies.push(proxy);
    const badge = document.createElement('div');
    badge.className = 'badge';
    const holder = new CSS2DObject(badge);
    holder.position.set(0, roadUserHeight(u.kind) / 2 + 1.2, 0);
    mesh.add(holder);
    badges.set(u.id, holder);
  }
  scene.add(world);
  $('#title').textContent = scenario.title;
  setCamera(cameraPreset ?? 'angled', false);
  update();
};

// ---- Answer UI: badges in the scene and the tray. ----

const update = () => {
  const order = steps(answer);
  const stepIndex = new Map(order.flatMap((step, i) => step.map((id) => [id, i] as const)));
  for (const [id, holder] of badges) {
    const i = stepIndex.get(id);
    const badge = holder.element;
    badge.textContent = i === undefined ? '' : String(i + 1);
    // CSS2DRenderer owns the element's display, so hide the object instead. After a crash, only the road user
    // who went too early keeps its badge, since the two badges would otherwise sit on top of each other.
    const crashedInto = phase === 'done' && result?.verdict === 'wrong' && replay?.collision ? result.tooEarly : null;
    holder.visible = i !== undefined && (!crashedInto || id === crashedInto);
    badge.classList.toggle('tied', i !== undefined && order[i]!.length > 1);
    badge.classList.toggle('wrong', result?.verdict === 'wrong' && result.tooEarly === id);
  }
  renderTray(stepIndex);
  const complete = answer.order.length === scenario.roadUsers.length;
  checkButton.disabled = phase === 'replaying' || (phase === 'answering' && !complete);
  checkButton.textContent = phase === 'done' ? (result?.verdict === 'correct' ? 'Next' : 'Show correct order') : 'Check';
  clearButton.textContent = phase === 'done' ? 'Try again' : 'Clear';
  clearButton.disabled = phase === 'replaying';
  $('#prompt').textContent =
    phase !== 'answering'
      ? ''
      : inputMode() === 'scene'
        ? 'Tap the road users in the order they may go. Tap again to take one back.'
        : 'Tap the chips in the order the road users may go. Drag a chip to move it.';
  render();
};

const chip = (id: string, num?: number) => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `chip${num ? ' placed' : ''}`;
  el.dataset.id = id;
  const colour = `#${roadUserColour(user(id).kind).toString(16).padStart(6, '0')}`;
  el.innerHTML = `${num ? `<span class="num">${num}</span>` : ''}<span class="swatch" style="background:${colour}"></span>${label(id)}`;
  return el;
};

const renderTray = (stepIndex: Map<string, number>) => {
  tray.replaceChildren();
  answer.order.forEach((id, k) => {
    if (k > 0 && tiesAllowed()) {
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'link';
      link.textContent = '+';
      link.title = 'Go together';
      link.setAttribute('aria-label', `${label(answer.order[k - 1]!)} and ${label(id)} go together`);
      link.setAttribute('aria-pressed', String(!!answer.linked[k - 1]));
      link.disabled = phase !== 'answering';
      link.onclick = () => {
        answer = toggleLink(answer, k - 1);
        update();
      };
      tray.append(link);
    }
    const el = chip(id, stepIndex.get(id)! + 1);
    el.disabled = phase !== 'answering';
    if (inputMode() === 'tray') enableDrag(el, k);
    el.addEventListener('click', () => {
      if (dragged) return;
      answer = tap(answer, id);
      update();
    });
    tray.append(el);
  });
  if (inputMode() === 'tray' && phase === 'answering') {
    const rest = scenario.roadUsers.filter((u) => !answer.order.includes(u.id));
    if (rest.length) {
      const pool = document.createElement('div');
      pool.style.cssText = 'flex-basis:100%;display:flex;flex-wrap:wrap;gap:4px;padding-top:6px;border-top:1px dashed var(--line)';
      for (const u of rest) {
        const el = chip(u.id);
        el.onclick = () => {
          answer = tap(answer, u.id);
          update();
        };
        pool.append(el);
      }
      tray.append(pool);
    }
  }
};

/** Drag a placed chip to a new position in the order; the tray may wrap onto several lines. */
let dragged = false;
const enableDrag = (el: HTMLElement, from: number) => {
  el.addEventListener('pointerdown', (down) => {
    dragged = false;
    el.setPointerCapture(down.pointerId);
    const onMove = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) > 8) {
        dragged = true;
        el.classList.add('dragging');
        el.style.transform = `translate(${e.clientX - down.clientX}px, ${e.clientY - down.clientY}px)`;
      }
    };
    const end = (e: PointerEvent) => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      if (!dragged) return;
      if (e.type === 'pointercancel') {
        update();
        dragged = false;
        return;
      }
      // Count the chips that come before the drop point in reading order: earlier lines, then left on this line.
      const others = [...tray.querySelectorAll<HTMLElement>('.chip.placed')].filter((o) => o !== el);
      const to = others.filter((o) => {
        const r = o.getBoundingClientRect();
        const sameLine = Math.abs(r.top + r.height / 2 - e.clientY) <= r.height / 2;
        return r.bottom < e.clientY - r.height / 2 || (sameLine && r.left + r.width / 2 < e.clientX);
      }).length;
      answer = move(answer, from, to);
      update();
      setTimeout(() => (dragged = false));
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });
};

// ---- Tapping road users in the scene. ----

const raycaster = new Raycaster();
let down: { x: number; y: number; t: number } | null = null;
renderer.domElement.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
renderer.domElement.addEventListener('pointerup', (e) => {
  const isTap = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 500;
  down = null;
  if (!isTap || phase !== 'answering' || inputMode() !== 'scene') return;
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(proxies, false)[0];
  if (!hit) return;
  answer = tap(answer, hit.object.userData.roadUserId as string);
  update();
});

// ---- Camera presets. ----

type Preset = 'overhead' | 'angled' | 'you';
let cameraPreset: Preset | null = null;
let tween: { from: Vector3; to: Vector3; fromTarget: Vector3; toTarget: Vector3; start: number } | null = null;

const presetPose = (preset: Preset): { position: Vector3; target: Vector3 } => {
  const centre = new Vector3();
  if (preset === 'overhead') return { position: new Vector3(0, 62, 0.01), target: centre };
  if (preset === 'angled' || !scenario.you) return { position: new Vector3(0, 42, 40), target: centre };
  // Behind You: back along its path from where it waits, raised a little, looking at the junction.
  const you = user(scenario.you);
  const path = manoeuvrePath(scenario.layout, you);
  const u = waitingDistance(scenario.layout, you) / path.getLength();
  const at = path.getPointAt(u);
  // Far enough back and high enough that cross traffic stays in a portrait frame.
  const back = path.getTangentAt(u).multiplyScalar(-16);
  return { position: at.clone().add(back).setY(11), target: new Vector3(0, 0, 0) };
};

const pressCameraButton = (preset: Preset | null) => {
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-camera]')) b.setAttribute('aria-pressed', String(b.dataset.camera === preset));
};

/** Glide the camera to a pose. */
const glideTo = (position: Vector3, target: Vector3) => {
  tween = { from: camera.position.clone(), to: position, fromTarget: controls.target.clone(), toTarget: target, start: performance.now() };
  loop();
};

const setCamera = (preset: Preset, animate = true) => {
  cameraPreset = preset;
  pressCameraButton(preset);
  const pose = presetPose(preset);
  if (!animate) {
    camera.position.copy(pose.position);
    controls.target.copy(pose.target);
    controls.update();
    return;
  }
  glideTo(pose.position, pose.target);
};

// ---- Replay. ----

let replay: Replay | null = null;
let clock = 0;
let last: number | null = null;
const frameTimes: number[] = [];

const playReplay = (order: string[][], wrong?: WrongAnswer) => {
  replay = scheduleReplay(scenario.layout, scenario.roadUsers, order, wrong);
  if (crashMarker) {
    world.remove(crashMarker);
    crashMarker.geometry.dispose();
  }
  crashMarker = null;
  phase = 'replaying';
  clock = 0;
  frameTimes.length = 0;
  feedback.hidden = true;
  update();
  loop();
};

const placeRoadUsers = (t: number) => {
  for (const u of scenario.roadUsers) {
    const { position, heading } = replay!.pose(u.id, t);
    const mesh = meshes.get(u.id)!;
    mesh.position.set(position.x, roadUserHeight(u.kind) / 2, position.z);
    mesh.lookAt(mesh.position.clone().add(heading));
  }
};

const showCrash = () => {
  const c = replay!.collision!;
  crashMarker = new Mesh(new RingGeometry(2.2, 3, 40).rotateX(-Math.PI / 2), crashMaterial);
  crashMarker.position.copy(c.at).setY(0.12);
  world.add(crashMarker);
  // Move in on the conflict, keeping the current viewing direction, so it reads on a small screen.
  const offset = camera.position.clone().sub(controls.target).setLength(22);
  glideTo(c.at.clone().add(offset), c.at.clone());
};

const finishReplay = () => {
  phase = 'done';
  if (result?.verdict === 'wrong') {
    const why = scenario.explanations[result.tooEarly] ?? '';
    feedback.textContent = replay?.collision
      ? `${label(result.tooEarly)} went too early and ran into the ${label(replay.collision.hit).toLowerCase()}. ${why}`
      : `${label(result.tooEarly)} went too early: it had to wait for ${list(result.waitedFor)}. ${why}`;
    feedback.className = 'bad';
    if (replay?.collision) showCrash();
  } else {
    const lead = showingSolution ? 'This is the right order.' : 'Correct.';
    feedback.textContent = `${lead} ${Object.values(scenario.explanations).join(' ')}`;
    feedback.className = 'good';
  }
  feedback.hidden = false;
  reportFrames();
  update();
};

const reportFrames = () => {
  if (frameTimes.length < 10) return;
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  fps.textContent = `replay: ${frameTimes.length} frames · avg ${avg.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · ${renderer.info.render.calls} draw calls`;
};

// ---- Frame loop: runs only while something moves; otherwise render on demand. ----

let looping = false;
const loop = () => {
  if (looping) return;
  looping = true;
  last = null;
  requestAnimationFrame(frame);
};

const frame = (now: number) => {
  // The first frame of a run has no previous frame to measure from.
  const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
  if (last !== null && phase === 'replaying') frameTimes.push(now - last);
  last = now;
  let busy = false;

  if (tween) {
    const k = Math.min(1, (now - tween.start) / 600);
    const ease = k * k * (3 - 2 * k);
    camera.position.lerpVectors(tween.from, tween.to, ease);
    controls.target.lerpVectors(tween.fromTarget, tween.toTarget, ease);
    controls.update();
    if (k >= 1) tween = null;
    else busy = true;
  }

  if (phase === 'replaying' && replay) {
    let rate = speed();
    const crash = replay.collision;
    // Slow into the conflict so the learner sees it coming.
    if (crash && setting('crash') === 'slowmo' && clock > crash.time - 1.5) rate *= 0.3;
    clock = Math.min(replay.duration, clock + dt * rate);
    placeRoadUsers(clock);
    if (clock >= replay.duration) finishReplay();
    else busy = true;
  }

  render();
  // Finishing a replay can start a camera move.
  if (busy || tween) requestAnimationFrame(frame);
  else looping = false;
};

const render = () => {
  const { clientWidth: w, clientHeight: h } = stage;
  const ratio = renderer.getPixelRatio();
  if (renderer.domElement.width !== Math.floor(w * ratio) || renderer.domElement.height !== Math.floor(h * ratio)) {
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
  labels.render(scene, camera);
};

// ---- Wiring. ----

checkButton.onclick = () => {
  if (phase === 'answering') {
    result = score(answer, scenario.passingOrder, meet);
    if (result.verdict === 'incomplete') return;
    playReplay(steps(answer), result.verdict === 'wrong' ? result : undefined);
  } else if (result?.verdict === 'correct') {
    loadScenario(scenarios[(scenarios.indexOf(scenario) + 1) % scenarios.length]!);
    select.value = scenario.id;
  } else {
    result = { verdict: 'correct' };
    showingSolution = true;
    answer = fromSteps(scenario.passingOrder);
    playReplay(scenario.passingOrder);
  }
};

clearButton.onclick = () => loadScenario(scenario);

const select = $<HTMLSelectElement>('#scenario');
for (const s of scenarios) select.add(new Option(s.title, s.id));
select.onchange = () => loadScenario(scenarios.find((s) => s.id === select.value)!);

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-camera]')) b.onclick = () => setCamera(b.dataset.camera as Preset);
const openSettings = $<HTMLButtonElement>('#open-settings');
openSettings.onclick = () => {
  settings.hidden = !settings.hidden;
  openSettings.setAttribute('aria-expanded', String(!settings.hidden));
};
settings.onchange = () => {
  controls.enabled = settings.querySelector<HTMLInputElement>('[name=orbit]')!.checked;
  if (!tiesAllowed()) answer = { ...answer, linked: answer.linked.map(() => false) };
  update();
};
// Only the learner orbiting leaves the preset; programmatic moves also fire 'change'.
controls.addEventListener('start', () => {
  cameraPreset = null;
  pressCameraButton(null);
});
controls.addEventListener('change', render);
addEventListener('resize', render);

// Variants can be preselected from the URL, e.g. ?input=tray&ties=strict&speed=2&orbit=on, to share a test setup.
for (const [name, value] of new URLSearchParams(location.search)) {
  for (const input of settings.querySelectorAll<HTMLInputElement>(`[name="${CSS.escape(name)}"]`)) {
    if (input.type === 'checkbox') input.checked = value === 'on';
    else if (input.value === value) input.checked = true;
  }
}
controls.enabled = settings.querySelector<HTMLInputElement>('[name=orbit]')!.checked;

loadScenario(scenario);
