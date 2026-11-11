/**
 * The puzzles as flat, top-down SVG boards in the style of the landing page's demo. Same Scenarios, scoring,
 * conflict points and Replay timing as the 3D puzzle; only the drawing differs. One SVG unit is one metre,
 * and scene x/z map straight to SVG x/y (north is up).
 */
import type { Vector3 } from 'three';
import { conflicts } from '../conflicts';
import {
  ARM_LENGTH,
  CYCLE_PATH_WIDTH,
  LANE_WIDTH,
  TRACK_SPACING,
  VERGE_WIDTH,
  armPoint,
  crossingDistance,
  halfWidth,
  inEdge,
  junctionRadius,
  lanesIn,
  lanesOut,
  outEdge,
  stopLineDistance,
  type Arm,
  type Layout,
  type RoadUser,
  type RoadUserKind,
} from '../layout';
import { ROAD_USER_SIZE, roadUserColours } from '../models';
import { emptyAnswer, fromSteps, score, steps, tap, type Answer, type Score } from '../puzzle/answer';
import { scheduleReplay } from '../puzzle/replay';
import { scenarios, type Scenario } from '../puzzle/scenarios';

const SVG = 'http://www.w3.org/2000/svg';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
/** Half the board's width, in metres. */
const VIEW = 21;
/** Replay speed, as the 3D puzzle's default. */
const SPEED = 1.5;
/** Badges and the crash ring are drawn at the landing demo's pixel size, then scaled to metres. */
const PX = 0.11;
/** Small road users are drawn larger than life so they stay easy to see and tap. */
const ENLARGE: Partial<Record<RoadUserKind, number>> = { bicycle: 2, moped: 1.8, snorfiets: 1.8, pedestrian: 3.2 };

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

const LAYOUT_LABEL: Record<Layout['kind'], string> = {
  crossroads: 'Crossroads',
  't-junction': 'T-junction',
  roundabout: 'Roundabout',
  exit: 'Exit',
};

const COMPASS = ['north', 'east', 'south', 'west'];
const from = (arm: Arm) => `from the ${COMPASS[Math.round(arm.bearing / 90) % 4]}`;

const C = {
  kerb: '#7d8581',
  cycle: 'var(--fietspad)',
  verge: 'var(--board-verge)',
  road: 'var(--board-road)',
  line: 'var(--board-line)',
  rail: '#a9b0ab',
  ink: '#1e2124',
  glass: '#2c3034',
};

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const pt = (v: Vector3) => `${v.x.toFixed(2)},${v.z.toFixed(2)}`;

/** A band along an arm: from `a0` to `a1` metres out, between `s0` and `s1` metres right of inbound traffic. */
const band = (arm: Arm, a0: number, a1: number, s0: number, s1: number, fill: string) =>
  el('polygon', {
    points: [armPoint(arm, a0, s0), armPoint(arm, a1, s0), armPoint(arm, a1, s1), armPoint(arm, a0, s1)].map(pt).join(' '),
    fill,
  });

const line = (arm: Arm, a0: number, a1: number, side: number, attrs: Record<string, string | number>) => {
  const p = armPoint(arm, a0, side);
  const q = armPoint(arm, a1, side);
  return el('line', { x1: p.x, y1: p.z, x2: q.x, y2: q.z, ...attrs });
};

/** The square between two arms at right angles, `r` metres to a side. */
const quadrant = (a: Arm, b: Arm, r: number, fill: string) => {
  const p = armPoint(a, r, 0);
  const q = armPoint(b, r, 0);
  return el('polygon', { points: `0,0 ${pt(p)} ${(p.x + q.x).toFixed(2)},${(p.z + q.z).toFixed(2)} ${pt(q)}`, fill });
};

const rightAngled = (layout: Layout): [Arm, Arm][] =>
  layout.arms.flatMap((a) => {
    const b = layout.arms.find((x) => (((x.bearing - a.bearing) % 360) + 360) % 360 === 90);
    return b ? [[a, b] as [Arm, Arm]] : [];
  });

/** The road: verges, footways, carriageways, cycle paths, markings, tram rails, lights and signs. */
function drawJunction(layout: Layout): SVGGElement {
  const g = el('g', { class: 'junction' });
  const r = junctionRadius(layout);
  const stop = stopLineDistance(layout);
  const cross = crossingDistance(layout);
  const L = ARM_LENGTH;

  g.append(el('rect', { x: -VIEW - 2, y: -VIEW - 2, width: 2 * VIEW + 4, height: 2 * VIEW + 4, fill: C.verge }));

  // Footways: a kerb band round every arm and the corners between them.
  for (const [a, b] of rightAngled(layout)) g.append(quadrant(a, b, r + 3, C.kerb));
  for (const arm of layout.arms) g.append(band(arm, 0, L, -halfWidth(arm) - 3, halfWidth(arm) + 3, C.kerb));
  // Grass between the footway and a cycle path.
  for (const arm of layout.arms) {
    if (!arm.cyclePath) continue;
    g.append(band(arm, r, L, lanesIn(arm) * LANE_WIDTH, inEdge(arm), C.verge));
    g.append(band(arm, r, L, -lanesOut(arm) * LANE_WIDTH, -outEdge(arm), C.verge));
  }

  // Carriageways and the junction square.
  for (const [a, b] of rightAngled(layout)) g.append(quadrant(a, b, r, C.road));
  for (const arm of layout.arms) g.append(band(arm, 0, L, -lanesOut(arm) * LANE_WIDTH, lanesIn(arm) * LANE_WIDTH, C.road));

  // Cycle paths, carried in red across the junction.
  for (const arm of layout.arms) {
    if (!arm.cyclePath) continue;
    const inner = lanesIn(arm) * LANE_WIDTH + VERGE_WIDTH;
    const outer = lanesOut(arm) * LANE_WIDTH + VERGE_WIDTH;
    g.append(band(arm, 0, L, inner, inner + CYCLE_PATH_WIDTH, C.cycle));
    g.append(band(arm, 0, L, -outer, -outer - CYCLE_PATH_WIDTH, C.cycle));
  }

  const marks = el('g', { stroke: C.line, fill: 'none', opacity: 0.85 });
  for (const arm of layout.arms) {
    const edgeIn = lanesIn(arm) * LANE_WIDTH;
    if (!arm.tram) marks.append(line(arm, stop, L, 0, { 'stroke-width': 0.15, 'stroke-dasharray': '1.8 1.4' }));
    for (let k = 1; k < lanesIn(arm); k++) {
      marks.append(line(arm, stop, L, k * LANE_WIDTH, { 'stroke-width': 0.15, 'stroke-dasharray': '3 2' }));
    }

    const c = arm.control;
    if (c?.zebra) {
      for (let s = -lanesOut(arm) * LANE_WIDTH + 0.4; s < edgeIn - 0.3; s += 1) {
        g.append(band(arm, cross - 1.4, cross + 1.4, s, s + 0.5, C.line));
      }
    }
    if (c?.priority === 'B7' || c?.lights) {
      g.append(band(arm, stop, stop + 0.4, 0.1, edgeIn - 0.1, C.line));
    }
    if (c?.priority === 'B6' || c?.priority === 'haaientanden') {
      for (let s = 0.3; s < edgeIn - 0.5; s += 1) {
        const tip = armPoint(arm, stop + 0.1, s + 0.4);
        g.append(el('polygon', { points: `${pt(armPoint(arm, stop + 1, s))} ${pt(armPoint(arm, stop + 1, s + 0.8))} ${pt(tip)}`, fill: C.line }));
      }
    }
  }
  g.append(marks);

  // Tram rails down the middle, through the junction.
  for (const arm of layout.arms) {
    if (!arm.tram) continue;
    for (const track of [-TRACK_SPACING / 2, TRACK_SPACING / 2]) {
      for (const rail of [-0.36, 0.36]) g.append(line(arm, 0, L, track + rail, { stroke: C.rail, 'stroke-width': 0.12 }));
    }
  }

  // Lights and signs, at the right-hand kerb of each arm.
  for (const arm of layout.arms) {
    const c = arm.control;
    if (!c) continue;
    const at = armPoint(arm, stop + 0.8, inEdge(arm) + 1.3);
    const holder = el('g', { transform: `translate(${at.x} ${at.z}) rotate(${arm.bearing})` });
    if (c.lights) {
      const lit = { red: '#ff3b47', yellow: '#ffb000', green: '#2fd36b', off: '#555b60', 'flashing-yellow': '#ffb000' }[c.lights];
      holder.append(
        el('rect', { x: -0.55, y: -1.5, width: 1.1, height: 3, rx: 0.35, fill: C.ink }),
        el('circle', { cx: 0, cy: c.lights === 'red' ? -0.9 : c.lights === 'green' ? 0.9 : 0, r: 0.42, fill: lit, class: 'light-lamp' }),
      );
    } else if (c.priority === 'B7') {
      const o = Array.from({ length: 8 }, (_, i) => {
        const a = ((i + 0.5) * Math.PI) / 4;
        return `${(1.15 * Math.cos(a)).toFixed(2)},${(1.15 * Math.sin(a)).toFixed(2)}`;
      }).join(' ');
      holder.append(el('polygon', { points: o, fill: '#c4122f', stroke: '#fff', 'stroke-width': 0.2 }));
    } else if (c.priority === 'B6') {
      holder.append(el('polygon', { points: '0,1.1 -1.2,-0.9 1.2,-0.9', fill: '#fff', stroke: '#c4122f', 'stroke-width': 0.3 }));
    } else if (c.priority === 'B1') {
      holder.append(
        el('rect', { x: -0.8, y: -0.8, width: 1.6, height: 1.6, transform: 'rotate(45)', fill: '#fff', stroke: C.glass, 'stroke-width': 0.1 }),
        el('rect', { x: -0.5, y: -0.5, width: 1, height: 1, transform: 'rotate(45)', fill: '#f5b301' }),
      );
    }
    if (holder.childNodes.length) g.append(holder);
  }
  return g;
}

/** A road user seen from above, facing up (north), centred on its middle. */
function drawRoadUser(user: RoadUser, colour: string): SVGGElement {
  const g = el('g', { class: 'ru', 'data-id': user.id });
  const body = el('g');
  const [w, , l] = ROAD_USER_SIZE[user.kind];
  const k = ENLARGE[user.kind] ?? 1;
  const hw = (w * k) / 2;
  const hl = (l * k) / 2;
  const outline = { stroke: C.ink, 'stroke-width': 0.18 };

  switch (user.kind) {
    case 'car':
      body.append(
        el('rect', { x: -hw, y: -hl, width: 2 * hw, height: 2 * hl, rx: 0.6, fill: colour, ...outline }),
        el('rect', { x: -hw + 0.2, y: -hl + 1.05, width: 2 * hw - 0.4, height: 0.75, rx: 0.2, fill: C.glass, opacity: 0.85 }),
        el('rect', { x: -hw + 0.25, y: hl - 1.05, width: 2 * hw - 0.5, height: 0.5, rx: 0.15, fill: C.glass, opacity: 0.6 }),
        el('rect', { x: -hw + 0.15, y: -hl, width: 0.45, height: 0.22, rx: 0.08, fill: '#ffe9a8' }),
        el('rect', { x: hw - 0.6, y: -hl, width: 0.45, height: 0.22, rx: 0.08, fill: '#ffe9a8' }),
      );
      break;
    case 'bus':
      body.append(
        el('rect', { x: -hw, y: -hl, width: 2 * hw, height: 2 * hl, rx: 0.5, fill: colour, ...outline }),
        el('rect', { x: -hw + 0.25, y: -hl + 0.25, width: 2 * hw - 0.5, height: 0.9, rx: 0.2, fill: C.glass, opacity: 0.85 }),
        el('rect', { x: -0.2, y: -hl + 1.6, width: 0.4, height: 2 * hl - 2.4, fill: 'var(--info)' }),
        el('rect', { x: -0.7, y: -1, width: 1.4, height: 2, rx: 0.2, fill: '#dde1dc', stroke: '#b8bfb9', 'stroke-width': 0.08 }),
      );
      break;
    case 'tram':
      body.append(
        el('rect', { x: -hw, y: -hl, width: 2 * hw, height: 2 * hl, rx: 1.1, fill: colour, ...outline }),
        el('rect', { x: -hw + 0.3, y: -hl + 0.3, width: 2 * hw - 0.6, height: 1, rx: 0.4, fill: C.glass, opacity: 0.85 }),
        el('rect', { x: -hw + 0.3, y: hl - 1.3, width: 2 * hw - 0.6, height: 1, rx: 0.4, fill: C.glass, opacity: 0.85 }),
        el('path', { d: `M${-hw} -3.3h${2 * hw}M${-hw} 3.3h${2 * hw}`, stroke: C.ink, 'stroke-width': 0.15 }),
        el('rect', { x: -0.4, y: -0.9, width: 0.8, height: 1.8, fill: 'none', stroke: C.ink, 'stroke-width': 0.12 }),
      );
      break;
    case 'voorrangsvoertuig':
      body.append(
        el('rect', { x: -hw, y: -hl, width: 2 * hw, height: 2 * hl, rx: 0.5, fill: colour, ...outline }),
        el('rect', { x: -hw + 0.2, y: -hl + 0.7, width: 2 * hw - 0.4, height: 0.7, rx: 0.2, fill: C.glass, opacity: 0.85 }),
        el('rect', { x: -hw, y: 0.2, width: 2 * hw, height: 0.45, fill: '#1c4f9c' }),
        el('rect', { x: -0.5, y: 0.9, width: 1, height: 1.8, fill: '#fff' }),
        el('path', { d: 'M-0.25 1.8h0.5M0 1.55v0.5', stroke: '#c4122f', 'stroke-width': 0.18 }),
        el('rect', { x: -0.85, y: -hl + 1.6, width: 0.6, height: 0.35, rx: 0.1, fill: '#2f7bff', class: 'siren' }),
        el('rect', { x: 0.25, y: -hl + 1.6, width: 0.6, height: 0.35, rx: 0.1, fill: '#2f7bff', class: 'siren' }),
      );
      break;
    case 'pedestrian':
      body.append(
        el('ellipse', { cx: 0, cy: 0, rx: hw, ry: hl * 0.55, fill: colour, class: 'ped-body' }),
        el('circle', { cx: 0, cy: 0, r: hl * 0.38, fill: '#3b2a20' }),
      );
      break;
    default: {
      // Bicycle, moped, snorfiets: wheels in line, a rider on top.
      const tyre = user.kind === 'bicycle' ? 0.22 : 0.32;
      body.append(
        el('rect', { x: -tyre / 2, y: -hl, width: tyre, height: hl * 0.75, rx: tyre / 2, fill: C.ink }),
        el('rect', { x: -tyre / 2, y: hl * 0.25, width: tyre, height: hl * 0.75, rx: tyre / 2, fill: C.ink }),
        el('rect', { x: -0.06, y: -hl * 0.4, width: 0.12, height: hl * 0.8, fill: C.ink }),
        el('path', { d: `M${-hw * 0.9} ${-hl * 0.55}h${hw * 1.8}`, stroke: C.ink, 'stroke-width': 0.12, 'stroke-linecap': 'round' }),
        el('ellipse', { cx: 0, cy: hl * 0.05, rx: hw * 1.05, ry: hl * 0.3, fill: colour, ...outline }),
        el('circle', { cx: 0, cy: -hl * 0.12, r: hl * 0.2, fill: user.kind === 'bicycle' ? C.glass : '#f4f5f2', ...outline }),
      );
    }
  }
  // A generous, invisible hit area so small road users are easy to tap.
  g.append(el('rect', { x: -Math.max(hw, 1.6) - 0.6, y: -Math.max(hl, 1.6) - 0.6, width: 2 * Math.max(hw, 1.6) + 1.2, height: 2 * Math.max(hl, 1.6) + 1.2, rx: 1.4, fill: 'transparent' }), body);
  return g;
}

function drawBadge(): SVGGElement {
  const g = el('g', { class: 'badge', 'aria-hidden': 'true' });
  const inner = el('g', { transform: `scale(${PX})` });
  inner.append(
    el('rect', { x: -11, y: -11, width: 22, height: 22, rx: 3, transform: 'rotate(45)', class: 'badge-diamond' }),
    el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 1, class: 'badge-num' }),
  );
  g.append(inner);
  return g;
}

function drawCrash(): SVGGElement {
  const g = el('g', { class: 'conflict' });
  const inner = el('g', { transform: `scale(${PX * 1.2})` });
  inner.append(
    el('circle', { class: 'pulse', r: 18, fill: 'none', stroke: 'var(--signal)', 'stroke-width': 4 }),
    el('circle', { r: 18, fill: 'none', stroke: 'var(--signal)', 'stroke-width': 4 }),
    el('path', { d: 'M-7-7 7 7M7-7-7 7', stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round' }),
  );
  g.append(inner);
  return g;
}

const heading = (v: Vector3) => (Math.atan2(v.x, -v.z) * 180) / Math.PI;

const BOARD = (s: Scenario, n: number, description: string) => `
  <div class="board-head">
    <h2>${n}. ${s.title}</h2>
    <p>${LAYOUT_LABEL[s.layout.kind]}</p>
  </div>
  <svg class="crossroads" viewBox="${-VIEW} ${-VIEW} ${2 * VIEW} ${2 * VIEW}" role="img" aria-label="${description}"></svg>
  <div class="board-sheet">
    <p class="prompt">Tap the road users in the order they may go. Tap again to take one back.</p>
    <div class="result" role="status" aria-live="polite" hidden></div>
    <div class="tray" role="group" aria-label="Road users"></div>
    <div class="actions">
      <button class="btn btn--action btn--small" type="button" data-action="check" disabled>Check order</button>
      <button class="btn btn--quiet btn--small" type="button" data-action="clear" disabled>Clear</button>
      <button class="btn btn--quiet btn--small" type="button" data-action="solve" hidden>Show the answer</button>
    </div>
  </div>`;

function mountPuzzle(root: HTMLElement, s: Scenario, n: number): void {
  const users = s.roadUsers;
  const armOf = (u: RoadUser) => s.layout.arms.find((a) => a.id === u.arm)!;
  const manoeuvre = (u: RoadUser) =>
    u.manoeuvre === 'cross' ? 'crossing' : u.manoeuvre === 'straight' ? 'going straight on' : `turning ${u.manoeuvre}`;
  const label = (id: string) => {
    const u = users.find((x) => x.id === id)!;
    const sameKind = users.filter((o) => o.kind === u.kind).length > 1;
    return `${KIND_LABEL[u.kind]}${sameKind ? ` (${id})` : ''}${s.you === id ? ' (you)' : ''}`;
  };
  const list = (ids: string[]) => ids.map(label).join(' and ');
  const description =
    `Top view: ${LAYOUT_LABEL[s.layout.kind].toLowerCase()}. ` + users.map((u) => `${label(u.id)} ${from(armOf(u))}, ${manoeuvre(u)}.`).join(' ');

  root.innerHTML = BOARD(s, n, description);
  const svg = root.querySelector<SVGSVGElement>('svg.crossroads')!;
  const tray = root.querySelector<HTMLElement>('.tray')!;
  const check = root.querySelector<HTMLButtonElement>('[data-action="check"]')!;
  const clear = root.querySelector<HTMLButtonElement>('[data-action="clear"]')!;
  const solve = root.querySelector<HTMLButtonElement>('[data-action="solve"]')!;
  const result = root.querySelector<HTMLElement>('.result')!;
  const prompt = root.querySelector<HTMLElement>('.prompt')!;

  const usersLayer = el('g', { class: 'users' });
  const crash = drawCrash();
  const badgeLayer = el('g', { class: 'badges' });
  svg.append(drawJunction(s.layout), usersLayer, crash, badgeLayer);

  const colours = roadUserColours(users);
  const meeting = new Set(conflicts(s.layout, users).flatMap((c) => [`${c.a}|${c.b}`, `${c.b}|${c.a}`]));
  const meet = (a: string, b: string) => meeting.has(`${a}|${b}`);
  // The pose at t = 0 of any Replay is the waiting position.
  const waiting = scheduleReplay(s.layout, users, [users.map((u) => u.id)]);

  const nodes = new Map<string, SVGGElement>();
  const badges = new Map<string, SVGGElement>();
  const chips = new Map<string, HTMLButtonElement>();
  let answer: Answer = emptyAnswer;
  let busy = false;
  let done = false;

  const place = (id: string, position: Vector3, facing: Vector3) =>
    nodes.get(id)!.setAttribute('transform', `translate(${position.x.toFixed(3)} ${position.z.toFixed(3)}) rotate(${heading(facing).toFixed(2)})`);

  const placeWaiting = () => {
    for (const u of users) {
      const { position, heading: h } = waiting.pose(u.id, 0);
      place(u.id, position, h);
    }
  };

  // Draw longer road users first so a cyclist beside a bus stays on top.
  for (const u of [...users].sort((a, b) => ROAD_USER_SIZE[b.kind][2] - ROAD_USER_SIZE[a.kind][2])) {
    const g = drawRoadUser(u, hex(colours.get(u.id)!));
    g.addEventListener('click', () => toggle(u.id));
    usersLayer.append(g);
    nodes.set(u.id, g);
  }

  for (const u of users) {
    const { position, heading: h } = waiting.pose(u.id, 0);
    const [w, , l] = ROAD_USER_SIZE[u.kind];
    const k = ENLARGE[u.kind] ?? 1;
    // To the left of the road user, clear of its body.
    const off = (w * k) / 2 + 2.2;
    const along = Math.min(0, -(l * k) / 2 + 2);
    const b = drawBadge();
    const bx = position.x + h.z * off + h.x * along;
    const by = position.z - h.x * off + h.z * along;
    b.setAttribute('transform', `translate(${bx.toFixed(2)} ${by.toFixed(2)})`);
    badgeLayer.append(b);
    badges.set(u.id, b);

    const colour = hex(colours.get(u.id)!);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.setAttribute('aria-pressed', 'false');
    chip.dataset.colour = colour;
    chip.innerHTML = `<span class="chip-slot" aria-hidden="true"></span><span>${label(u.id)}</span>`;
    chip.addEventListener('click', () => toggle(u.id));
    tray.append(chip);
    chips.set(u.id, chip);
  }
  placeWaiting();

  function render(): void {
    for (const u of users) {
      const i = answer.order.indexOf(u.id);
      const b = badges.get(u.id)!;
      const chip = chips.get(u.id)!;
      b.classList.toggle('shown', i >= 0 && !busy && !done);
      b.querySelector('text')!.textContent = i >= 0 ? String(i + 1) : '';
      chip.setAttribute('aria-pressed', String(i >= 0));
      chip.setAttribute('aria-label', `${label(u.id)}, ${from(armOf(u))}, ${manoeuvre(u)}${i >= 0 ? `, number ${i + 1}` : ''}`);
      chip.disabled = busy;
      const slot = chip.querySelector('.chip-slot')!;
      const wrong = slot.querySelector('.order-badge--wrong') && i >= 0;
      slot.innerHTML =
        i >= 0
          ? `<span class="order-badge${wrong ? ' order-badge--wrong' : ''}">${i + 1}</span>`
          : `<span class="chip-swatch" style="background:${chip.dataset.colour}"></span>`;
    }
    check.disabled = (answer.order.length !== users.length && !done) || busy;
    clear.disabled = answer.order.length === 0 || busy || done;
  }

  function toggle(id: string): void {
    if (busy) return;
    if (done) reset();
    answer = tap(answer, id);
    render();
  }

  function reset(): void {
    answer = emptyAnswer;
    busy = false;
    done = false;
    result.hidden = true;
    result.replaceChildren();
    prompt.hidden = false;
    solve.hidden = true;
    crash.classList.remove('shown');
    svg.classList.remove('playing');
    for (const chip of chips.values()) chip.querySelector('.order-badge')?.classList.remove('order-badge--wrong');
    placeWaiting();
    check.textContent = 'Check order';
    render();
  }

  function feedback(good: boolean, verdict: string, explanation: string): void {
    const head = document.createElement('p');
    head.append(Object.assign(document.createElement('strong'), { textContent: verdict }));
    const body = Object.assign(document.createElement('p'), { className: 'explain', textContent: explanation });
    result.replaceChildren(head, ...(explanation ? [body] : []));
    result.className = `result feedback feedback--${good ? 'good' : 'bad'}`;
    result.hidden = false;
  }

  async function play(order: string[][], verdict: Score, solution = false): Promise<void> {
    busy = true;
    done = false;
    prompt.hidden = true;
    result.hidden = true;
    solve.hidden = true;
    crash.classList.remove('shown');
    svg.classList.add('playing');
    render();

    const wrong = verdict.verdict === 'wrong' ? verdict : undefined;
    const replay = scheduleReplay(s.layout, users, order, wrong);
    const duration = reduceMotion.matches ? replay.duration : replay.duration / SPEED;
    await new Promise<void>((resolve) => {
      const start = performance.now();
      const frame = (now: number) => {
        const t = reduceMotion.matches ? replay.duration : Math.min(replay.duration, ((now - start) / 1000) * SPEED);
        for (const u of users) {
          const { position, heading: h } = replay.pose(u.id, t);
          place(u.id, position, h);
        }
        if ((now - start) / 1000 < duration) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });

    busy = false;
    done = true;
    if (wrong) {
      const why = s.explanations[wrong.tooEarly] ?? '';
      if (replay.collision) {
        crash.setAttribute('transform', `translate(${replay.collision.at.x.toFixed(2)} ${replay.collision.at.z.toFixed(2)})`);
        crash.classList.add('shown');
      }
      feedback(
        false,
        replay.collision
          ? `${label(wrong.tooEarly)} went too early and ran into the ${label(replay.collision.hit).toLowerCase()}.`
          : `${label(wrong.tooEarly)} went too early: it had to wait for ${list(wrong.waitedFor)}.`,
        why,
      );
      solve.hidden = false;
    } else {
      feedback(true, solution ? 'This is the right order.' : 'Correct.', Object.values(s.explanations).join(' '));
    }
    render();
    if (wrong) chips.get(wrong.tooEarly)!.querySelector('.order-badge')?.classList.add('order-badge--wrong');
    check.textContent = 'Try again';
    check.disabled = false;
  }

  check.addEventListener('click', () => {
    if (done) return reset();
    void play(steps(answer), score(answer, s.passingOrder, meet));
  });
  clear.addEventListener('click', reset);
  solve.addEventListener('click', () => {
    answer = fromSteps(s.passingOrder);
    void play(s.passingOrder, { verdict: 'correct' }, true);
  });

  render();
}

for (const root of document.querySelectorAll<HTMLElement>('[data-flat-puzzles]')) {
  scenarios.forEach((s, i) => {
    const board = document.createElement('article');
    board.className = 'board';
    root.append(board);
    mountPuzzle(board, s, i + 1);
  });
}
