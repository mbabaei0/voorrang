/**
 * The landing page's hero: one playable Scenario on a flat, top-down crossroads.
 * Unmarked crossroads, everyone goes straight on. Correct order: cyclist, white car, green car.
 * Kept separate from the three.js puzzle so the landing page stays light.
 */

type Point = [number, number];
type Id = 'bike' | 'white' | 'green';

interface RoadUser {
  id: Id;
  name: string;
  from: string;
  colour: string;
  kind: 'car' | 'bike';
  wait: Point;
  exit: Point;
  angle: number; // degrees, 0 = facing up
  badge: Point; // offset from the road user
  waitsFor: Id[];
  explain: string;
}

const USERS: RoadUser[] = [
  {
    id: 'white',
    name: 'White car',
    from: 'from the south',
    colour: '#f4f5f2',
    kind: 'car',
    wait: [220, 296],
    exit: [220, -60],
    angle: 0,
    badge: [-36, 0],
    waitsFor: ['bike'],
    explain: 'The white car waits for the cyclist, who comes from its right. Bikes count too (RVV art. 15).',
  },
  {
    id: 'bike',
    name: 'Cyclist',
    from: 'from the east',
    colour: '#d4553f',
    kind: 'bike',
    wait: [292, 174],
    exit: [-60, 174],
    angle: -90,
    badge: [0, -32],
    waitsFor: [],
    explain: 'Nobody comes from the cyclist’s right, so the cyclist goes first.',
  },
  {
    id: 'green',
    name: 'Green car',
    from: 'from the west',
    colour: '#7fa38a',
    kind: 'car',
    wait: [104, 220],
    exit: [460, 220],
    angle: 90,
    badge: [0, 36],
    waitsFor: ['white'],
    explain: 'The green car waits for the white car, which comes from its right (RVV art. 15).',
  },
];

/** Where two road users' paths meet. */
const CONFLICTS: Record<string, Point> = {
  'bike|white': [220, 174],
  'green|white': [220, 220],
};

const SVG = 'http://www.w3.org/2000/svg';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function drawRoadUser(u: RoadUser): SVGGElement {
  const g = el('g', { class: 'ru', 'data-id': u.id });
  const body = el('g');
  if (u.kind === 'car') {
    body.append(
      el('rect', { x: -15, y: -25, width: 30, height: 50, rx: 8, fill: u.colour, stroke: '#1e2124', 'stroke-width': 2 }),
      el('rect', { x: -11, y: -14, width: 22, height: 9, rx: 3, fill: '#2c3034', opacity: 0.85 }),
      el('rect', { x: -11, y: 12, width: 22, height: 6, rx: 2, fill: '#2c3034', opacity: 0.6 }),
      el('rect', { x: -12, y: -25, width: 6, height: 3, rx: 1, fill: '#ffe9a8' }),
      el('rect', { x: 6, y: -25, width: 6, height: 3, rx: 1, fill: '#ffe9a8' }),
    );
  } else {
    body.setAttribute('transform', 'scale(1.25)');
    body.append(
      el('rect', { x: -2.5, y: -22, width: 5, height: 12, rx: 2.5, fill: '#1e2124' }),
      el('rect', { x: -2.5, y: 10, width: 5, height: 12, rx: 2.5, fill: '#1e2124' }),
      el('rect', { x: -1, y: -12, width: 2, height: 24, fill: '#1e2124' }),
      el('ellipse', { cx: 0, cy: 2, rx: 10, ry: 6, fill: u.colour, stroke: '#1e2124', 'stroke-width': 2 }),
      el('circle', { cx: 0, cy: -2, r: 5, fill: '#2c3034' }),
    );
  }
  // A generous, invisible hit area so small road users are easy to tap.
  g.append(el('circle', { r: 36, fill: 'transparent' }), body);
  return g;
}

function drawBadge(): SVGGElement {
  const g = el('g', { class: 'badge', 'aria-hidden': 'true' });
  g.append(
    el('rect', { x: -11, y: -11, width: 22, height: 22, rx: 3, transform: 'rotate(45)', class: 'badge-diamond' }),
    el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 1, class: 'badge-num' }),
  );
  return g;
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Point `gap` units before `to`, on the line from `from`. */
function stopShort(from: Point, to: Point, gap: number): Point {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  return [to[0] - (dx / len) * gap, to[1] - (dy / len) * gap];
}

/** The board's markup: header, top-down crossroads and the sheet with the tray and actions. */
const BOARD = `
  <div class="board-head">
    <h2>Try one here</h2>
    <p>Unmarked crossroads</p>
  </div>
  <svg class="crossroads" viewBox="0 0 400 400" role="img" aria-label="Top view of a crossroads without signs or lights. A white car waits on the south arm, a cyclist on the east arm and a green car on the west arm. All three go straight on.">
    <rect width="400" height="400" fill="var(--board-road)" />
    <g fill="#7d8581">
      <rect x="-40" y="-40" width="200" height="200" rx="26" />
      <rect x="240" y="-40" width="200" height="200" rx="26" />
      <rect x="-40" y="240" width="200" height="200" rx="26" />
      <rect x="240" y="240" width="200" height="200" rx="26" />
    </g>
    <g fill="var(--board-verge)">
      <rect x="-40" y="-40" width="188" height="188" rx="18" />
      <rect x="252" y="-40" width="188" height="188" rx="18" />
      <rect x="-40" y="252" width="188" height="188" rx="18" />
      <rect x="252" y="252" width="188" height="188" rx="18" />
    </g>
    <g stroke="var(--board-line)" stroke-width="3" stroke-dasharray="14 12" opacity="0.8">
      <path d="M200 0v148M200 252v148M0 200h148M252 200h148" />
    </g>
    <g class="users"></g>
    <g class="conflict">
      <circle class="pulse" r="18" fill="none" stroke="var(--signal)" stroke-width="4" />
      <circle r="18" fill="none" stroke="var(--signal)" stroke-width="4" />
      <path d="M-7-7 7 7M7-7-7 7" stroke="#fff" stroke-width="4" stroke-linecap="round" />
    </g>
    <g class="badges"></g>
  </svg>
  <div class="board-sheet">
    <p class="prompt">Tap the road users in the order they may go. Tap again to take one back.</p>
    <div class="result" role="status" aria-live="polite" hidden></div>
    <div class="tray" role="group" aria-label="Road users"></div>
    <div class="actions">
      <button class="btn btn--action btn--small" type="button" data-action="check" disabled>Check order</button>
      <button class="btn btn--quiet btn--small" type="button" data-action="clear" disabled>Clear</button>
      <a href="puzzle.html">More puzzles</a>
    </div>
  </div>`;

export function mountDemo(root: HTMLElement): void {
  if (!root.children.length) root.innerHTML = BOARD;
  const svg = root.querySelector<SVGSVGElement>('svg.crossroads')!;
  const usersLayer = svg.querySelector<SVGGElement>('.users')!;
  const badgeLayer = svg.querySelector<SVGGElement>('.badges')!;
  const ring = svg.querySelector<SVGGElement>('.conflict')!;
  const tray = root.querySelector<HTMLElement>('.tray')!;
  const check = root.querySelector<HTMLButtonElement>('[data-action="check"]')!;
  const clear = root.querySelector<HTMLButtonElement>('[data-action="clear"]')!;
  const result = root.querySelector<HTMLElement>('.result')!;
  const prompt = root.querySelector<HTMLElement>('.prompt')!;

  const nodes = new Map<Id, SVGGElement>();
  const badges = new Map<Id, SVGGElement>();
  const chips = new Map<Id, HTMLButtonElement>();
  let order: Id[] = [];
  let busy = false;

  const place = (id: Id, p: Point) => {
    const u = USERS.find((x) => x.id === id)!;
    nodes.get(id)!.setAttribute('transform', `translate(${p[0]} ${p[1]}) rotate(${u.angle})`);
  };

  for (const u of USERS) {
    const g = drawRoadUser(u);
    g.addEventListener('click', () => toggle(u.id));
    usersLayer.append(g);
    nodes.set(u.id, g);
    place(u.id, u.wait);

    const b = drawBadge();
    b.setAttribute('transform', `translate(${u.wait[0] + u.badge[0]} ${u.wait[1] + u.badge[1]})`);
    badgeLayer.append(b);
    badges.set(u.id, b);

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.setAttribute('aria-pressed', 'false');
    chip.innerHTML = `<span class="chip-slot" aria-hidden="true"><span class="chip-swatch" style="background:${u.colour}"></span></span><span>${u.name}</span>`;
    chip.setAttribute('aria-label', `${u.name}, ${u.from}`);
    chip.addEventListener('click', () => toggle(u.id));
    tray.append(chip);
    chips.set(u.id, chip);
  }

  function render(): void {
    for (const u of USERS) {
      const i = order.indexOf(u.id);
      const b = badges.get(u.id)!;
      const chip = chips.get(u.id)!;
      const slot = chip.querySelector('.chip-slot')!;
      b.classList.toggle('shown', i >= 0);
      b.classList.remove('wrong');
      b.querySelector('text')!.textContent = i >= 0 ? String(i + 1) : '';
      nodes.get(u.id)!.classList.toggle('placed', i >= 0);
      chip.setAttribute('aria-pressed', String(i >= 0));
      chip.setAttribute('aria-label', i >= 0 ? `${u.name}, ${u.from}, number ${i + 1}` : `${u.name}, ${u.from}`);
      slot.innerHTML =
        i >= 0
          ? `<span class="order-badge">${i + 1}</span>`
          : `<span class="chip-swatch" style="background:${u.colour}"></span>`;
    }
    check.disabled = order.length !== USERS.length || busy;
    clear.disabled = order.length === 0 || busy;
  }

  function toggle(id: Id): void {
    if (busy) return;
    if (!result.hidden) reset();
    order = order.includes(id) ? order.filter((x) => x !== id) : [...order, id];
    render();
  }

  function reset(): void {
    order = [];
    busy = false;
    result.hidden = true;
    result.innerHTML = '';
    prompt.hidden = false;
    ring.classList.remove('shown');
    svg.classList.remove('playing');
    for (const u of USERS) place(u.id, u.wait);
    check.textContent = 'Check order';
    render();
  }

  function animate(moves: { id: Id; from: Point; to: Point }[], ms: number): Promise<void> {
    const duration = reduceMotion.matches ? 1 : ms;
    return new Promise((resolve) => {
      const start = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        for (const m of moves) place(m.id, lerp(m.from, m.to, ease(t)));
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  async function play(): Promise<void> {
    busy = true;
    svg.classList.add('playing');
    render();

    // First road user who goes before someone it must wait for.
    let wrong: { u: RoadUser; blocker: RoadUser } | null = null;
    for (let i = 0; i < order.length && !wrong; i++) {
      const u = USERS.find((x) => x.id === order[i])!;
      const blockerId = u.waitsFor.find((w) => order.indexOf(w) > i);
      if (blockerId) wrong = { u, blocker: USERS.find((x) => x.id === blockerId)! };
    }

    const stopAt = wrong ? order.indexOf(wrong.u.id) : order.length;
    for (let i = 0; i < stopAt; i++) {
      const u = USERS.find((x) => x.id === order[i])!;
      badges.get(u.id)!.classList.remove('shown');
      await animate([{ id: u.id, from: u.wait, to: u.exit }], 1100);
    }

    prompt.hidden = true;
    if (wrong) {
      const { u, blocker } = wrong;
      const key = [u.id, blocker.id].sort().join('|');
      const point = CONFLICTS[key]!;
      for (const id of [u.id, blocker.id]) badges.get(id)!.classList.remove('shown');
      await animate(
        [
          { id: u.id, from: u.wait, to: stopShort(u.wait, point, 44) },
          { id: blocker.id, from: blocker.wait, to: stopShort(blocker.wait, point, 44) },
        ],
        900,
      );
      chips.get(u.id)!.querySelector('.order-badge')?.classList.add('order-badge--wrong');
      ring.setAttribute('transform', `translate(${point[0]} ${point[1]})`);
      ring.classList.add('shown');
      result.className = 'result feedback feedback--bad';
      result.innerHTML = `<p><strong>${u.name} went too early.</strong></p><p class="explain">${u.explain}</p>`;
    } else {
      result.className = 'result feedback feedback--good';
      result.innerHTML =
        `<p><strong>Correct. Cyclist, white car, then green car.</strong></p>` +
        `<p class="explain">At a crossroads without signs or lights, you give way to traffic from your right, and that includes bikes.</p>`;
    }
    result.hidden = false;
    busy = false;
    check.textContent = 'Try again';
    check.disabled = false;
    clear.disabled = true;
  }

  check.addEventListener('click', () => {
    if (!result.hidden) reset();
    else void play();
  });
  clear.addEventListener('click', reset);

  render();
}

for (const root of document.querySelectorAll<HTMLElement>('[data-demo]')) mountDemo(root);
