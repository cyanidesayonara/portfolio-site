/*
  The playable street on the home page. A tip of the hat to Path of Leash
  Resistance: you are Millie, your human is glued to their phone on the
  other end of a rope leash, and every shop is a page of the site.

  Controls match the real game's defaults: WASD or arrows move, Shift (or ])
  runs, Space digs in, Q marks a spot, F squats when nature calls, G picks
  up, E (or Ctrl) barks, Tab shows the goals, R starts again and Esc leaves.
  Enter digs in too, except at a shop door, where it goes in. On touch
  screens a tap walks there and on-screen buttons run, dig, pee and bark.
*/
import {
  WH, FACADE, WALK_TOP, LANE, CAR_LANES,
  buildWorld, drawStatic, drawTops, drawNightLights, doorX, doorY,
  type Stop, type StopLot, type Circle,
} from './world';
import { StreetSound } from './audio';
import { trackVisibleViewport } from '../viewport';

type P = { x: number; y: number };
type Bubble = { text: string; ttl: number; who: P; lift: number; loud: boolean };
type Ped = {
  x: number; y: number; ly: number; dir: 1 | -1; speed: number; pause: number; said: boolean;
  coat: string; hair: string; prop: 'phone' | 'coffee' | 'bag' | 'dog';
  pet?: { x: number; y: number; heading: number; color: string; greeted: boolean };
};
type Pigeon = { x: number; y: number; hx: number; hy: number; flying: boolean; vx: number; vy: number; t: number; hop: number };
type Vehicle = { kind: 'bike' | 'car'; x: number; y: number; dir: 1 | -1; speed: number; max: number; color: string; alerted: number; wobble: number };
type Stain = { x: number; y: number; r: number };
type Fx = { kind: 'ring' | 'dust' | 'splash' | 'heart'; x: number; y: number; vx: number; vy: number; t: number; max: number };

const ROPE_N = 18;
const ROPE_BASE = 130;
const DOG_R = 9;
const HUMAN_R = 13;
const PED_R = 11;

const MOVE: Record<string, P> = {
  ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 },
};
const COATS = ['#e5487a', '#3a4a75', '#ffb020', '#8bcb3c', '#c9cfdf', '#b0674a', '#1fc9b7'];
const HAIRS = ['#5b3a29', '#1b1b1f', '#c98b4a', '#8a8a8a', '#7a2e1d'];
const FONT = "'Bricolage Grotesque Variable', 'Bricolage Grotesque', system-ui, sans-serif";
const BODY = "'Inter Variable', 'Inter', system-ui, sans-serif";

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function startStreet(fig: HTMLElement, stops: Stop[]) {
  const canvas = fig.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  const caption = fig.querySelector<HTMLElement>('[data-caption]');
  const soundBtn = fig.querySelector<HTMLButtonElement>('[data-sound]');
  if (!canvas || !ctx || !caption) return;
  const c = ctx;
  const links = new Map([...fig.querySelectorAll<HTMLAnchorElement>('[data-stop]')].map((a) => [a.dataset.stop ?? '', a]));
  fig.classList.add('live');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const streetTest = new URLSearchParams(location.search).has('streettest');
  let coarse = matchMedia('(pointer: coarse)').matches || matchMedia('(any-pointer: coarse)').matches;
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const isNight = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : darkMq.matches;
  };

  const world = buildWorld(stops);
  const W = world.width;

  // ---- State ----------------------------------------------------------------------
  const dog = { x: 70, y: 168, heading: 0, moving: false, sprint: false, peeing: 0, step: 0, dig: false, squat: 0 };
  const human = { x: 34, y: 150, heading: 0, walking: false, patience: 1, stop: 0, step: 0, stuck: 0, ghost: 0 };
  const rope = Array.from({ length: ROPE_N + 1 }, (_, i) => {
    const t = i / ROPE_N;
    const x = human.x + (dog.x - human.x) * t, y = human.y + (dog.y - human.y) * t;
    return { x, y, px: x, py: y };
  });
  let leash = ROPE_BASE;
  let heyT = 0;
  let pee = 0.6, zoom = 1, barkCd = 0, marked = 0;
  const goals = { mark: false, pigeons: false, dog: false, bones: false, free: false };
  let offLeash = false, offT = 0, clippedInPark = false;
  let nature = 35, natureCalls = false;
  const poops: { x: number; y: number; t: number }[] = [];
  const ball = { x: world.park.x + 210, y: 110, vx: 0, vy: 0 };
  let nearBone: { x: number; y: number; got: boolean } | null = null;
  let nearDrink = false;
  let touchDig: number | null = null, touchSquat: number | null = null;
  const bones = world.bones.map((b) => ({ ...b, got: false }));
  let bonesGot = 0;
  let toast: { text: string; t: number } | null = null;
  let allDone = false;
  let goalsOpen: boolean | null = null;
  let goalsRect = { x: 0, y: 0, w: 0, h: 0 };
  const sound = new StreetSound();
  let wantSound = false;
  try { wantSound = localStorage.getItem('street-sound') === 'on'; } catch { /* storage blocked */ }
  const stains: Stain[] = [];
  const bubbles: Bubble[] = [];
  const fx: Fx[] = [];
  const peds: Ped[] = [];
  const spawnFx = (kind: Fx['kind'], x: number, y: number, vx = 0, vy = 0, max = 0.45) => {
    if (fx.length >= 40) fx.shift();
    fx.push({ kind, x, y, vx, vy, t: 0, max });
  };
  const vehicles: Vehicle[] = [];
  const pigeons: Pigeon[] = [];
  world.benches.slice(0, 3).forEach((b, bi) => {
    for (let i = 0; i < 4; i++) {
      const hx = b.x + 6 + i * 12 + (bi % 2) * 4, hy = 190 + ((i * 7) % 9);
      pigeons.push({ x: hx, y: hy, hx, hy, flying: false, vx: 0, vy: 0, t: 0, hop: Math.random() * 3 });
    }
  });
  let pedTimer = 1, bikeTimer = 2, carTimer = 5;
  const held = new Set<string>();
  let touchSprint: number | null = null;
  let target: P | null = null;
  let playing = false;
  let near: StopLot | null = null;
  let wander = { lot: 0, wait: 1.2 };
  let camX = 0;
  let boarding: { href: string; t: number; sent: boolean } | null = null;
  // Coming back with the browser's Back button can restore this page mid-boarding.
  window.addEventListener('pageshow', (e) => { if (e.persisted) boarding = null; });
  let arriving = 0;

  // ---- Sizing and the static layer ---------------------------------------------------
  let cssW = 0, cssH = 0, dpr = 1, scale = 1, viewW = 0, offY = 0;
  const bg = document.createElement('canvas');
  const bgc = bg.getContext('2d')!;
  let bgScale = 1;
  function buildBg() {
    bgScale = Math.min(scale * dpr, 12000 / W);
    bg.width = Math.ceil(W * bgScale);
    bg.height = Math.ceil(WH * bgScale);
    bgc.setTransform(bgScale, 0, 0, bgScale, 0, 0);
    drawStatic(bgc, world);
  }
  function resize() {
    const r = canvas!.getBoundingClientRect();
    if (!r.width || !r.height) return;
    cssW = r.width;
    cssH = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas!.width = Math.round(cssW * dpr);
    canvas!.height = Math.round(cssH * dpr);
    scale = cssH / WH;
    // Fullscreen on a tall screen would zoom right in; keep a decent stretch
    // of street in view and letterbox the rest.
    if (fig.classList.contains('immersive') || document.fullscreenElement === fig) scale = Math.min(scale, cssW / 640);
    offY = Math.max(0, (cssH - WH * scale) / 2);
    viewW = cssW / scale;
    buildBg();
  }

  // ---- Collision ---------------------------------------------------------------------
  function pushOut(p: P, r: number, ghost = false) {
    if (!ghost) for (const s of world.solids) {
      if (s.shape === 'circle') {
        const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy), min = s.r + r;
        if (d < min && d > 1e-4) { p.x = s.x + (dx / d) * min; p.y = s.y + (dy / d) * min; }
      } else {
        const cx = clamp(p.x, s.x, s.x + s.w), cy = clamp(p.y, s.y, s.y + s.h);
        const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
        if (d < r) {
          if (d > 1e-4) { p.x = cx + (dx / d) * r; p.y = cy + (dy / d) * r; }
          else p.y = p.y < s.y + s.h / 2 ? s.y - r : s.y + s.h + r;
        }
      }
    }
    const inPark = p.x > world.park.x + 12;
    p.x = clamp(p.x, r, W - r);
    p.y = clamp(p.y, (inPark ? 30 : WALK_TOP) + r * 0.6, WH - r - 2);
  }

  function complete(key: keyof typeof goals, label: string) {
    if (goals[key] || !playing) return;
    goals[key] = true;
    toast = { text: `Goal done: ${label}`, t: 2.6 };
    sound.goal();
    if (Object.values(goals).every(Boolean)) finale();
  }

  // Every goal done: a little celebration, then point her at the train to the 3D walk.
  function finale() {
    allDone = true;
    say(human, 'Best walk ever!', 24, true, 2.4);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      spawnFx('heart', dog.x + Math.cos(a) * 10, dog.y - 12 + Math.sin(a) * 6, Math.cos(a) * 34, -26 + Math.sin(a) * 14, 1.3);
    }
    window.setTimeout(() => {
      if (!playing) return;
      sound.stationChime();
      toast = { text: 'Best walk ever! Every goal done', t: 4 };
    }, 1600);
  }

  // ---- Talking -----------------------------------------------------------------------
  function say(who: P, text: string, lift: number, loud = false, ttl = 1.4) {
    for (const b of bubbles) if (b.who === who) b.ttl = 0;
    bubbles.push({ text, ttl, who, lift, loud });
  }

  // ---- Input -------------------------------------------------------------------------
  function input(): P | null {
    let ix = 0, iy = 0;
    for (const k of held) if (MOVE[k]) { ix += MOVE[k].x; iy += MOVE[k].y; }
    if (ix || iy) { target = null; const l = Math.hypot(ix, iy); return { x: ix / l, y: iy / l }; }
    if (target) {
      const dx = target.x - dog.x, dy = target.y - dog.y, l = Math.hypot(dx, dy);
      if (l < 5) { target = null; return null; }
      return { x: dx / l, y: dy / l };
    }
    return null;
  }

  // Before anyone takes the leash, Millie visits the shops on her own.
  function autopilot(dt: number): P | null {
    if (wander.wait > 0) { wander.wait -= dt; return null; }
    const l = world.stops[wander.lot];
    const dx = doorX(l) - dog.x, dy = doorY(l) - dog.y, d = Math.hypot(dx, dy);
    if (d < 6) {
      wander = { lot: (wander.lot + 1) % (world.stops.length - 1), wait: 1.8 };
      return null;
    }
    return { x: dx / d, y: dy / d };
  }

  function doPee() {
    if (dog.peeing > 0) return;
    if (pee < 0.25) { say(dog, '...', 18); toast = { text: 'Out of pee! Find a water bowl', t: 2 }; return; }
    let best: Circle | null = null, bd = Infinity;
    for (const s of world.peeSpots) {
      const d = Math.hypot(s.x - dog.x, s.y - dog.y) - s.r - DOG_R;
      if (d < 16 && d < bd) { best = s; bd = d; }
    }
    dog.peeing = 0.9;
    pee -= 0.25;
    sound.pee();
    const sx = best ? best.x + (dog.x - best.x) * 0.5 : dog.x - Math.cos(dog.heading) * DOG_R;
    const sy = best ? best.y + (dog.y - best.y) * 0.5 + 4 : dog.y - Math.sin(dog.heading) * DOG_R;
    stains.push({ x: sx, y: sy, r: 6 + Math.random() * 3 });
    if (stains.length > 30) stains.shift();
    if (best && !best.marked) {
      best.marked = true;
      marked++;
      if (marked >= 5 && !goals.mark) { complete('mark', 'mark 5 spots'); say(human, 'Good girl!', 24); }
    }
  }

  function doPickup() {
    if (!nearBone) return;
    nearBone.got = true;
    nearBone = null;
    bonesGot++;
    sound.pickup();
    if (bonesGot >= 5) complete('bones', 'find 5 bones');
  }

  function resetRope() {
    rope.forEach((p, i) => {
      const t = i / ROPE_N;
      p.x = p.px = human.x + (dog.x - human.x) * t;
      p.y = p.py = human.y + (dog.y - human.y) * t;
    });
  }

  // R starts the walk again, like the real game.
  function restart() {
    Object.assign(dog, { x: 70, y: 168, heading: 0, peeing: 0, squat: 0 });
    Object.assign(human, { x: 34, y: 150, heading: 0, patience: 1, stop: 0, stuck: 0, ghost: 0 });
    resetRope();
    leash = ROPE_BASE; heyT = 0; pee = 0.6; zoom = 1; marked = 0; bonesGot = 0;
    offLeash = false; clippedInPark = false; nature = 35; natureCalls = false;
    for (const k of Object.keys(goals) as (keyof typeof goals)[]) goals[k] = false;
    allDone = false;
    for (const sp of world.peeSpots) sp.marked = false;
    for (const b of bones) b.got = false;
    stains.length = 0; poops.length = 0; bubbles.length = 0; fx.length = 0; target = null;
    boarding = null; arriving = 0;
    Object.assign(ball, { x: world.park.x + 210, y: 110, vx: 0, vy: 0 });
    camX = 0;
    toast = { text: 'New walk', t: 1.5 };
  }

  function doBark() {
    if (barkCd > 0) return;
    barkCd = 0.5;
    say(dog, 'WOOF!', 20, true, 0.9);
    sound.bark();
    scatter(150, true);
    if (Math.random() < 0.6) { say(human, pick(['Shh!', 'Millie!', 'What?']), 26); human.stop = 0.5; }
    for (const p of peds) {
      const d = Math.hypot(p.x - dog.x, p.y - dog.y);
      if (d < 90) { p.pause = Math.max(p.pause, 0.6); if (!p.said) { say(p, 'Oh!', 24); p.said = true; } }
      if (p.pet && Math.hypot(p.pet.x - dog.x, p.pet.y - dog.y) < 160) say(p.pet, 'Woof!', 16, true, 0.9);
    }
  }

  function scatter(radius: number, byPlayer: boolean) {
    let any = false;
    for (const g of pigeons) {
      if (g.flying || Math.hypot(g.x - dog.x, g.y - dog.y) > radius) continue;
      g.flying = true;
      g.t = 0;
      g.vx = (g.x >= dog.x ? 1 : -1) * (80 + Math.random() * 80);
      g.vy = -120 - Math.random() * 80;
      any = true;
    }
    if (any && byPlayer && playing) { sound.flutter(); complete('pigeons', 'scatter the pigeons'); }
  }

  // ---- Simulation ----------------------------------------------------------------------
  function solveRope() {
    for (let i = 1; i < ROPE_N; i++) {
      const p = rope[i];
      const vx = (p.x - p.px) * 0.82, vy = (p.y - p.py) * 0.82;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy;
    }
    const seg = leash / ROPE_N;
    // Inverse masses: the rope is light, Millie heavier, her human four times her weight.
    const inv = (i: number) => (i === 0 ? 0.08 : i === ROPE_N ? (dog.dig ? 0.01 : 0.32) : 1);
    rope[0].x = human.x; rope[0].y = human.y;
    rope[ROPE_N].x = dog.x; rope[ROPE_N].y = dog.y;
    for (let it = 0; it < 22; it++) {
      for (let i = 0; i < ROPE_N; i++) {
        const a = rope[i], b = rope[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d <= seg) continue;
        const wa = inv(i), wb = inv(i + 1), k = (d - seg) / d / (wa + wb);
        a.x += dx * k * wa; a.y += dy * k * wa;
        b.x -= dx * k * wb; b.y -= dy * k * wb;
      }
      for (let i = 1; i < ROPE_N; i++) pushOut(rope[i], 1.5);
    }
    human.x = rope[0].x; human.y = rope[0].y;
    dog.x = rope[ROPE_N].x; dog.y = rope[ROPE_N].y;
    pushOut(human, HUMAN_R, human.ghost > 0);
    pushOut(dog, DOG_R);
    const dx = dog.x - human.x, dy = dog.y - human.y, d = Math.hypot(dx, dy);
    if (d > leash) { dog.x = human.x + (dx / d) * leash; dog.y = human.y + (dy / d) * leash; }
    rope[0].x = human.x; rope[0].y = human.y;
    rope[ROPE_N].x = dog.x; rope[ROPE_N].y = dog.y;
  }

  function updatePlayer(dt: number) {
    barkCd -= dt;
    heyT -= dt;
    human.stop -= dt;

    let dir = playing ? input() : autopilot(dt);
    if (dog.peeing > 0) { dog.peeing -= dt; dir = null; }
    // Dig in: Millie plants her feet and the leash holds her human instead.
    dog.dig = playing && (held.has('Space') || held.has('Enter') || held.has('NumpadEnter') || touchDig !== null);
    if (dog.dig) { dir = null; target = null; }
    // Nature calls every so often: hold F (or POOP) to squat.
    if (playing && !natureCalls && (nature -= dt) <= 0) natureCalls = true;
    const squatting = natureCalls && (held.has('KeyF') || held.has('End') || touchSquat !== null);
    if (squatting) {
      dir = null;
      dog.squat += dt;
      if (dog.squat >= 1.1) {
        poops.push({ x: dog.x - Math.cos(dog.heading) * DOG_R * 1.2, y: dog.y - Math.sin(dog.heading) * DOG_R * 1.2, t: 0 });
        natureCalls = false;
        nature = 40 + Math.random() * 30;
        dog.squat = 0;
        if (!offLeash) { human.stop = 2.2; say(human, pick(['Ugh. Bag time.', 'Really? Here?', 'Fine...']), 26); }
      }
    } else dog.squat = Math.max(0, dog.squat - dt * 2);
    const wantSprint = playing && (held.has('ShiftLeft') || held.has('ShiftRight') || held.has('BracketRight') || touchSprint !== null);
    dog.sprint = !!dir && wantSprint && zoom > 0.04;
    zoom = dog.sprint ? Math.max(0, zoom - dt * 0.42) : Math.min(1, zoom + dt * 0.16);
    const speed = (!playing ? 70 : dog.sprint ? 235 : 140) * (offLeash ? 1.15 : 1);
    dog.moving = !!dir;
    if (dir) {
      dog.x += dir.x * speed * dt;
      dog.y += dir.y * speed * dt;
      dog.heading = Math.atan2(dir.y, dir.x);
      dog.step += dt * (dog.sprint ? 24 : 15);
      if (dog.sprint && Math.random() < dt * 22) {
        spawnFx('dust', dog.x - dir.x * 8 + (Math.random() - 0.5) * 6, dog.y + 3, -dir.x * 18, -6 - Math.random() * 8, 0.36);
      }
    } else if (dog.dig && Math.random() < dt * 16) {
      spawnFx('dust', dog.x - Math.cos(dog.heading) * 9 + (Math.random() - 0.5) * 6, dog.y + 2, -Math.cos(dog.heading) * 20, -10 - Math.random() * 8, 0.32);
    }
    pushOut(dog, DOG_R);
    nearBone = null;
    for (const b of bones) if (!b.got && Math.hypot(b.x - dog.x, b.y - dog.y) < DOG_R + 16) nearBone = b;
    if (offLeash) dog.x = Math.max(dog.x, world.park.x + 14);
    // Drinking refills the pee meter; nothing else does.
    const drink = world.drinks.find((d) => Math.hypot(d.x - dog.x, d.y - dog.y) < DOG_R + (d.kind === 'fountain' ? 16 : 10));
    if (drink && playing && pee < 1) {
      if (pee < 0.97 && !bubbles.some((b) => b.who === dog)) { say(dog, 'slurp', 16, false, 0.7); sound.slurp(); }
      pee = Math.min(1, pee + dt * 0.45);
      if (Math.random() < dt * 14) spawnFx('splash', drink.x + (Math.random() - 0.5) * 8, drink.y - 2, (Math.random() - 0.5) * 18, -22, 0.35);
    }
    nearDrink = !!drink;
    updateBall(dt);
    if (dog.sprint) scatter(70, true);
    else scatter(36, playing);

    // The park is an off-leash area: the human unclips her at the gate and
    // waits there, and clips her back on when she comes back to them.
    // Once clipped back on, she has to leave through the gate before the park unclips her again.
    if (clippedInPark && dog.x < world.park.x + 8) clippedInPark = false;
    if (!offLeash && !clippedInPark && playing && dog.x > world.park.x + 26 && dog.y < 212) {
      offLeash = true;
      offT = 0;
      say(human, 'Off you go!', 28);
      toast = { text: 'Off the leash!', t: 2 };
      sound.pickup();
      complete('free', 'run free in the park');
    }
    if (offLeash) {
      offT += dt;
      dog.y = Math.min(dog.y, 212 - DOG_R);
      const gx = world.park.x + 26 - human.x, gy = 168 - human.y, gd = Math.hypot(gx, gy);
      human.walking = gd > 2;
      if (human.walking) {
        const hs = Math.min(70 * dt, gd);
        human.x += (gx / gd) * hs;
        human.y += (gy / gd) * hs;
        human.step += dt * 9;
      }
      human.heading = Math.atan2(dog.y - human.y, dog.x - human.x);
      pushOut(human, HUMAN_R);
      if (offT > 1.5 && Math.hypot(dog.x - human.x, dog.y - human.y) < DOG_R + HUMAN_R + 8) {
        offLeash = false;
        clippedInPark = true;
        resetRope();
        say(human, 'Come on, Millie.', 28);
      }
      return;
    }

    // Patience: haul on them constantly and they snap and shorten the leash.
    const dx = dog.x - human.x, dy = dog.y - human.y, straight = Math.hypot(dx, dy) || 1;
    const taut = straight > leash * 0.9;
    const away = dir ? (dir.x * dx + dir.y * dy) / straight : 0;
    if (playing && taut && away > 0.3) human.patience -= dt * (dog.sprint ? 0.45 : 0.22);
    else human.patience = Math.min(1, human.patience + dt * 0.12);
    if (human.patience <= 0) {
      say(human, 'HEY!', 28, true, 1.6);
      sound.hey();
      toast = { text: 'Leash shortened!', t: 2 };
      heyT = 3.5;
      human.patience = 1;
      human.stop = 0.7;
    }
    const want = heyT > 0 ? ROPE_BASE * 0.6 : ROPE_BASE;
    leash += (want - leash) * Math.min(1, dt * 3);

    // The human walks on autopilot along the leash, eyes on the phone.
    let ropeLen = 0;
    for (let i = 0; i < ROPE_N; i++) ropeLen += Math.hypot(rope[i + 1].x - rope[i].x, rope[i + 1].y - rope[i].y);
    human.walking = human.stop <= 0 && (ropeLen > leash * 0.8 || straight > leash * 0.6);
    const hx0 = human.x, hy0 = human.y;
    let hs = 0;
    if (human.walking) {
      const guide = rope[4];
      const gx = guide.x - human.x, gy = guide.y - human.y, gd = Math.hypot(gx, gy) || 1;
      hs = Math.min((playing ? 112 : 55) * dt, gd);
      human.x += (gx / gd) * hs;
      human.y += (gy / gd) * hs;
      human.heading = Math.atan2(gy, gx);
      human.step += dt * 9;
    }
    human.ghost -= dt;
    pushOut(human, HUMAN_R, human.ghost > 0);
    // A gap the leash fits through can be too narrow for a person. If they
    // stop making progress, let them squeeze past instead of sticking.
    const moved = Math.hypot(human.x - hx0, human.y - hy0);
    if (human.walking && hs > 0.5 && moved < hs * 0.3) human.stuck += dt;
    else human.stuck = Math.max(0, human.stuck - dt * 2);
    if (human.stuck > 0.4) { human.ghost = 0.9; human.stuck = 0; }
    solveRope();
  }

  function updateBall(dt: number) {
    const d = Math.hypot(ball.x - dog.x, ball.y - dog.y);
    if (d < DOG_R + 5 && d > 1e-4) {
      const kick = dog.sprint ? 260 : 190;
      ball.vx = ((ball.x - dog.x) / d) * kick;
      ball.vy = ((ball.y - dog.y) / d) * kick;
      ball.x = dog.x + ((ball.x - dog.x) / d) * (DOG_R + 5);
      ball.y = dog.y + ((ball.y - dog.y) / d) * (DOG_R + 5);
    }
    const f = Math.max(0, 1 - dt * 1.4);
    ball.vx *= f;
    ball.vy *= f;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const minX = world.park.x + 10, maxX = W - 6, minY = 34, maxY = 208;
    if (ball.x < minX) { ball.x = minX; ball.vx = Math.abs(ball.vx) * 0.6; }
    if (ball.x > maxX) { ball.x = maxX; ball.vx = -Math.abs(ball.vx) * 0.6; }
    if (ball.y < minY) { ball.y = minY; ball.vy = Math.abs(ball.vy) * 0.6; }
    if (ball.y > maxY) { ball.y = maxY; ball.vy = -Math.abs(ball.vy) * 0.6; }
    const bx = ball.x, by = ball.y;
    pushOut(ball, 4);
    if (bx !== ball.x || by !== ball.y) { ball.vx *= -0.5; ball.vy *= -0.5; }
  }

  function updatePeds(dt: number) {
    pedTimer -= dt;
    if (pedTimer <= 0 && peds.length < 3) {
      pedTimer = 3 + Math.random() * 4;
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const x = clamp(dir === 1 ? camX - 30 : camX + viewW + 30, 20, W - 20);
      const prop = pick<Ped['prop']>(['phone', 'coffee', 'bag', 'dog', 'phone']);
      const ly = dir === 1 ? 153 : 148;
      const p: Ped = { x, y: ly, ly, dir, speed: 26 + Math.random() * 14, pause: 0, said: false, coat: pick(COATS), hair: pick(HAIRS), prop };
      if (prop === 'dog') p.pet = { x: x - dir * 22, y: p.y + 12, heading: dir === 1 ? 0 : Math.PI, color: pick(['#c98b4a', '#f4f1ea', '#8a6a4a', '#d9c3a0']), greeted: false };
      peds.push(p);
    }
    for (let i = peds.length - 1; i >= 0; i--) {
      const p = peds[i];
      // Make way for Millie and her human.
      for (const o of [dog, human]) {
        const ahead = (o.x - p.x) * p.dir;
        if (ahead > 0 && ahead < 34 && Math.abs(o.y - p.y) < 22) {
          p.pause = Math.max(p.pause, 0.4);
          if (o === dog && !p.said && Math.random() < 0.02) { say(p, pick(['Aww!', 'Hi doggy!', 'Cute!']), 24); p.said = true; }
        }
      }
      if (p.pet) {
        const pet = p.pet;
        if (!pet.greeted && Math.hypot(pet.x - dog.x, pet.y - dog.y) < 36) {
          pet.greeted = true;
          p.pause = 2.4;
          say(pet, 'Woof!', 16, true, 1);
          spawnFx('heart', (dog.x + pet.x) / 2, Math.min(dog.y, pet.y) - 10, 0, -18, 1.0);
          complete('dog', 'say hi to another dog');
        }
        const tx = p.x - p.dir * 22, ty = p.y + 12;
        const wantX = pet.greeted && p.pause > 0 ? dog.x - Math.cos(dog.heading) * 14 : tx;
        const wantY = pet.greeted && p.pause > 0 ? dog.y : ty;
        const ddx = wantX - pet.x, ddy = wantY - pet.y, dd = Math.hypot(ddx, ddy);
        if (dd > 3) {
          const step = Math.min(dd - 2, 60 * dt);
          pet.x += (ddx / dd) * step;
          pet.y += (ddy / dd) * step;
          // Ease the turn instead of snapping to every small correction.
          const want = Math.atan2(ddy, ddx);
          let turn = want - pet.heading;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          pet.heading += turn * Math.min(1, dt * 6);
        } else if (p.pause <= 0) {
          const want = p.dir === 1 ? 0 : Math.PI;
          let turn = want - pet.heading;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          pet.heading += turn * Math.min(1, dt * 4);
        }
        const lx = pet.x - p.x, ly = pet.y - p.y, ld = Math.hypot(lx, ly);
        if (ld > 34) { pet.x = p.x + (lx / ld) * 34; pet.y = p.y + (ly / ld) * 34; }
        pushOut(pet, 7);
      }
      if (p.pause > 0) p.pause -= dt;
      else p.x += p.dir * p.speed * dt;
      // Pedestrians are never in the way for long: Millie and her human
      // nudge them aside, and they drift back to their line afterwards.
      for (const [o, r] of [[dog, DOG_R], [human, HUMAN_R]] as const) {
        const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy), min = r + PED_R;
        if (d < min && d > 1e-4) { p.x = o.x + (dx / d) * min; p.y = o.y + (dy / d) * min; }
      }
      p.y += (p.ly - p.y) * Math.min(1, dt * 1.5);
      p.y = clamp(p.y, WALK_TOP + PED_R, 210 - PED_R);
      if (p.x < -40 || p.x > W + 40 || p.x < camX - 200 || p.x > camX + viewW + 200) peds.splice(i, 1);
    }
  }

  function updatePigeons(dt: number) {
    for (const g of pigeons) {
      if (g.flying) {
        g.t += dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        if (g.t > 9 && Math.hypot(g.hx - dog.x, g.hy - dog.y) > 140) {
          g.flying = false; g.x = g.hx; g.y = g.hy;
        }
      } else {
        g.hop -= dt;
        if (g.hop < 0) {
          g.hop = 0.6 + Math.random() * 2;
          g.x = g.hx + (Math.random() - 0.5) * 10;
          g.y = g.hy + (Math.random() - 0.5) * 6;
        }
      }
    }
  }

  function updateTraffic(dt: number) {
    bikeTimer -= dt;
    carTimer -= dt;
    const spawn = (kind: Vehicle['kind']) => {
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const max = kind === 'bike' ? 100 + Math.random() * 50 : 120 + Math.random() * 40;
      const y = kind === 'bike' ? LANE + dir * 10 : dir === 1 ? CAR_LANES.east : CAR_LANES.west;
      vehicles.push({ kind, x: dir === 1 ? camX - 60 : camX + viewW + 60, y, dir, speed: max, max, color: pick(kind === 'bike' ? COATS : ['#e5487a', '#1fc9b7', '#ffb020', '#f4f1ea', '#3a4a75', '#5c6473']), alerted: 0, wobble: 0 });
    };
    if (bikeTimer <= 0) { spawn('bike'); bikeTimer = 3 + Math.random() * 5; }
    if (carTimer <= 0) { spawn('car'); carTimer = 6 + Math.random() * 6; }

    const bodies: P[] = [dog, human, ...peds];
    for (let i = vehicles.length - 1; i >= 0; i--) {
      const v = vehicles[i];
      const reach = v.kind === 'car' ? 120 : 85, stopAt = v.kind === 'car' ? 38 : 26, band = v.kind === 'car' ? 24 : 16;
      let blocked = false, close = false;
      for (const o of bodies) {
        const ahead = (o.x - v.x) * v.dir;
        if (Math.abs(o.y - v.y) < band && ahead > 0 && ahead < reach) { blocked = true; if (ahead < stopAt) close = true; }
      }
      for (const u of vehicles) {
        if (u === v || u.y !== v.y) continue;
        const ahead = (u.x - v.x) * v.dir;
        if (ahead > 0 && ahead < (v.kind === 'car' ? 60 : 36)) { blocked = true; close = close || ahead < 44; }
      }
      v.alerted -= dt;
      if (blocked && v.alerted <= 0 && bodies.some((o) => Math.abs(o.y - v.y) < band && (o.x - v.x) * v.dir > 0 && (o.x - v.x) * v.dir < reach)) {
        say(v, v.kind === 'car' ? 'HONK!' : 'Ring ring!', 22, true, 1.1);
        if (v.x > camX && v.x < camX + viewW) { if (v.kind === 'car') sound.honk(); else sound.bell(); }
        v.alerted = 3;
        v.wobble = 0.6;
      }
      const targetSpeed = close ? 0 : blocked ? v.max * 0.25 : v.max;
      v.speed += clamp(targetSpeed - v.speed, -320 * dt, 120 * dt);
      if (close) v.speed = Math.min(v.speed, 10);
      v.x += v.dir * v.speed * dt;
      v.wobble = Math.max(0, v.wobble - dt);
      if (v.x < camX - 260 || v.x > camX + viewW + 260) vehicles.splice(i, 1);
    }
  }

  function update(dt: number) {
    if (boarding) {
      boarding.t += dt;
      if (boarding.t >= 0.45 && !boarding.sent) {
        boarding.sent = true;
        location.href = boarding.href;
      }
      return;
    }
    if (arriving > 0) arriving = Math.max(0, arriving - dt);
    updatePlayer(dt);
    updatePeds(dt);
    updatePigeons(dt);
    updateTraffic(dt);
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.x += f.vx * dt; f.y += f.vy * dt;
      if ((f.t += dt) >= f.max) fx.splice(i, 1);
    }
    for (let i = bubbles.length - 1; i >= 0; i--) if ((bubbles[i].ttl -= dt) <= 0) bubbles.splice(i, 1);
    if (toast && (toast.t -= dt) <= 0) toast = null;
    for (let i = poops.length - 1; i >= 0; i--) if ((poops[i].t += dt) > 3) poops.splice(i, 1);

    const want = clamp(dog.x - viewW * 0.45, 0, Math.max(0, W - viewW));
    camX = viewW >= W ? (W - viewW) / 2 : camX + (want - camX) * Math.min(1, dt * 4);

    let best: StopLot | null = null;
    for (const l of world.stops) {
      const ok = l.type === 'park' ? dog.x > l.x + 8 && dog.x < l.x + 160 && dog.y < 148 : Math.abs(dog.x - doorX(l)) < 40 && dog.y < WALK_TOP + 32;
      if (ok) best = l;
    }
    if (best !== near) {
      if (near) links.get(near.stop.id)?.classList.remove('near');
      if (best) links.get(best.stop.id)?.classList.add('near');
      near = best;
      sayCaption();
    }
  }

  function sayCaption() {
    let text: string;
    if (near && playing) {
      if (near.stop.id === 'station') text = coarse ? 'Tap GO IN or Estació again to board the train to 3D.' : 'Press Enter at Estació to board the train to the 3D walk.';
      else text = coarse ? `Tap ${near.stop.label} again to go in.` : `Press Enter to go into ${near.stop.label}.`;
    } else if (playing) text = coarse ? 'Tap to walk, tap a shop to visit it. RUN and DIG are held; PEE marks a spot (POOP when nature calls), BARK scatters the pigeons, GRAB picks up.' : 'Walk Millie up to a shop door to go in. Arrow keys work too.';
    else text = coarse ? 'Tap the street to take Millie for a walk.' : 'Click the street to take Millie for a walk.';
    if (caption!.textContent !== text) caption!.textContent = text;
  }

  // ---- Drawing ----------------------------------------------------------------------
  function shadowAt(x: number, y: number, rx: number, ry: number, rot = 0) {
    c.fillStyle = 'rgba(30, 20, 10, 0.2)';
    c.beginPath();
    c.ellipse(x + 3, y + 3, rx, ry, rot, 0, Math.PI * 2);
    c.fill();
  }

  function drawPerson(x: number, y: number, heading: number, r: number, coat: string, hair: string, step: number, walking: boolean, prop: Ped['prop'], night: boolean) {
    shadowAt(x, y, r, r * 0.8);
    c.save();
    c.translate(x, y);
    c.rotate(heading);
    // Feet, striding
    const s = walking ? Math.sin(step) * r * 0.45 : 0;
    c.fillStyle = '#2a2f3d';
    c.beginPath();
    c.ellipse(s, -r * 0.35, r * 0.32, r * 0.2, 0, 0, Math.PI * 2);
    c.ellipse(-s, r * 0.35, r * 0.32, r * 0.2, 0, 0, Math.PI * 2);
    c.fill();
    // Shoulders and arms
    c.fillStyle = coat;
    c.beginPath();
    c.ellipse(0, 0, r * 0.62, r, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(r * 0.45, -r * 0.55, r * 0.24, 0, Math.PI * 2);
    c.arc(r * 0.45, r * 0.55, r * 0.24, 0, Math.PI * 2);
    c.fill();
    // Head
    c.fillStyle = hair;
    c.beginPath();
    c.arc(-r * 0.04, 0, r * 0.47, 0, Math.PI * 2);
    c.fill();
    if (prop === 'phone') {
      c.save();
      c.shadowColor = night ? '#bfe6ff' : 'rgba(255,255,255,0.8)';
      c.shadowBlur = night ? 16 : 5;
      c.fillStyle = '#e9f6ff';
      c.fillRect(r * 0.62, -r * 0.24, r * 0.34, r * 0.48);
      c.restore();
    } else if (prop === 'coffee') {
      c.fillStyle = '#f4f1ea';
      c.beginPath();
      c.arc(r * 0.72, r * 0.5, r * 0.22, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#6b4a32';
      c.beginPath();
      c.arc(r * 0.72, r * 0.5, r * 0.12, 0, Math.PI * 2);
      c.fill();
    } else if (prop === 'bag') {
      c.fillStyle = '#e8dcc6';
      c.fillRect(-r * 0.2, r * 0.75, r * 0.7, r * 0.45);
    }
    c.restore();
  }

  function drawDogBody(x: number, y: number, heading: number, r: number, color: string, step: number, moving: boolean, peeing: boolean, collar: string) {
    shadowAt(x, y, r * 1.3, r * 0.75, heading);
    const t = performance.now() / 1000;
    c.save();
    c.translate(x, y);
    c.rotate(heading);
    // Legs
    c.fillStyle = color;
    const legs: [number, number, number][] = [[0.55, -0.5, 0], [0.55, 0.5, Math.PI], [-0.65, -0.5, Math.PI], [-0.65, 0.5, 0]];
    for (const [lx, ly, ph] of legs) {
      const swing = moving ? Math.sin(step + ph) * r * 0.35 : 0;
      const lift = peeing && lx < 0 && ly > 0 ? r * 0.45 : 0;
      c.beginPath();
      c.ellipse(lx * r + swing, ly * r + lift, r * 0.26, r * 0.17, 0, 0, Math.PI * 2);
      c.fill();
    }
    // Tail
    const wag = moving ? Math.sin(t * 18) * 0.6 : Math.sin(t * 5) * 0.35;
    c.strokeStyle = color;
    c.lineWidth = r * 0.34;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-r * 1.05, 0);
    c.quadraticCurveTo(-r * 1.5, Math.sin(wag) * r * 0.6, -r * 1.9 * Math.cos(wag * 0.5), Math.sin(wag) * r);
    c.stroke();
    // Body, head, snout, ears
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(-r * 0.1, 0, r * 1.15, r * 0.62, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(r * 0.98, 0, r * 0.56, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(r * 1.42, 0, r * 0.32, r * 0.24, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.beginPath();
    c.ellipse(-r * 0.2, -r * 0.18, r * 0.7, r * 0.22, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(r * 0.82, -r * 0.56, r * 0.36, r * 0.2, -0.5, 0, Math.PI * 2);
    c.ellipse(r * 0.82, r * 0.56, r * 0.36, r * 0.2, 0.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = collar;
    c.lineWidth = r * 0.26;
    c.beginPath();
    c.moveTo(r * 0.5, -r * 0.5);
    c.lineTo(r * 0.5, r * 0.5);
    c.stroke();
    c.restore();
  }

  function drawVehicle(v: Vehicle, night: boolean) {
    c.save();
    c.translate(v.x, v.y);
    c.scale(v.dir, 1);
    if (v.kind === 'bike') {
      const wob = v.wobble > 0 ? Math.sin(performance.now() / 40) * 0.15 : 0;
      c.rotate(wob);
      shadowAt(0, 0, 16, 6);
      c.fillStyle = '#1b1b1f';
      c.beginPath();
      c.ellipse(-11, 0, 5, 1.8, 0, 0, Math.PI * 2);
      c.ellipse(11, 0, 5, 1.8, 0, 0, Math.PI * 2);
      c.fill();
      c.fillRect(-11, -1, 22, 2);
      c.fillStyle = v.color;
      c.beginPath();
      c.ellipse(-2, 0, 6.5, 7.5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#e8e4da';
      c.beginPath();
      c.arc(1, 0, 4, 0, Math.PI * 2);
      c.fill();
      // Lights: white at the front, red at the back.
      c.fillStyle = night ? '#fffbe6' : '#f4f1ea';
      c.beginPath();
      c.arc(15, 0, 1.8, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ff3b30';
      c.beginPath();
      c.arc(-15, 0, 1.6, 0, Math.PI * 2);
      c.fill();
    } else {
      shadowAt(0, 0, 26, 13);
      c.fillStyle = v.color;
      c.beginPath();
      c.roundRect(-25, -13, 50, 26, 7);
      c.fill();
      c.fillStyle = 'rgba(20, 32, 61, 0.7)';
      c.beginPath();
      c.roundRect(4, -10, 9, 20, 3);
      c.roundRect(-18, -10, 6, 20, 3);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.beginPath();
      c.roundRect(-11, -10, 14, 20, 3);
      c.fill();
      c.fillStyle = night ? '#fff3c4' : '#f4f1ea';
      c.fillRect(23, -10, 2.5, 5);
      c.fillRect(23, 5, 2.5, 5);
      c.fillStyle = night ? '#ff4a3d' : '#d9403a';
      c.beginPath();
      c.roundRect(-26, -11, 3, 6, 1);
      c.roundRect(-26, 5, 3, 6, 1);
      c.fill();
    }
    c.restore();
  }

  function drawPigeon(g: Pigeon) {
    const flap = g.flying ? Math.sin(performance.now() / 50) : 0;
    if (!g.flying) shadowAt(g.x - 2, g.y - 2, 4, 2.5);
    else {
      c.fillStyle = 'rgba(30, 20, 10, 0.12)';
      c.beginPath();
      c.ellipse(g.x + 10, g.y + 24 + g.t * 20, 4, 2.5, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.save();
    c.translate(g.x, g.y);
    c.scale(g.vx < 0 ? -1 : 1, 1);
    c.fillStyle = '#8a92a3';
    if (g.flying) {
      c.beginPath();
      c.ellipse(0, -4 * flap, 3, 7, 0, 0, Math.PI * 2);
      c.ellipse(0, 4 * flap, 3, 7, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.ellipse(0, 0, 5, 3.2, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#5c6473';
    c.beginPath();
    c.arc(4, 0, 2.2, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function drawRope() {
    c.strokeStyle = '#d9403a';
    c.lineWidth = 2.2;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(rope[0].x, rope[0].y);
    for (let i = 1; i < ROPE_N; i++) {
      const mx = (rope[i].x + rope[i + 1].x) / 2, my = (rope[i].y + rope[i + 1].y) / 2;
      c.quadraticCurveTo(rope[i].x, rope[i].y, mx, my);
    }
    c.lineTo(rope[ROPE_N].x, rope[ROPE_N].y);
    c.stroke();
  }

  function drawBubble(b: Bubble) {
    const a = Math.min(1, b.ttl * 4);
    c.save();
    c.globalAlpha = a;
    c.font = b.loud ? `800 12px ${FONT}` : `700 10px ${BODY}`;
    const tw = c.measureText(b.text).width;
    const w = tw + 14, h = b.loud ? 20 : 17;
    const x = clamp(b.who.x, camX + w / 2 + 4, camX + viewW - w / 2 - 4), y = Math.max(h / 2 + 4, b.who.y - b.lift - h / 2);
    c.fillStyle = b.loud ? '#ffb020' : '#f4f1ea';
    c.strokeStyle = '#0b1430';
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(x - w / 2, y - h / 2, w, h, 6);
    c.fill();
    c.stroke();
    c.fillStyle = '#0b1430';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(b.text, x, y + 0.5);
    c.restore();
  }

  // ---- HUD, in the style of Path of Leash Resistance's -----------------------------------
  const HUD_BG = 'rgba(20, 27, 44, 0.86)';
  function hudPanel(x: number, y: number, w: number, h: number) {
    c.fillStyle = HUD_BG;
    c.beginPath();
    c.roundRect(x, y, w, h, 8);
    c.fill();
  }
  function iconDrop(x: number, y: number, color: string, s = 1) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x, y - 5 * s);
    c.quadraticCurveTo(x + 4.5 * s, y + 0.5 * s, x + 3.6 * s, y + 2 * s);
    c.arc(x, y + 1.5 * s, 3.6 * s, 0.1, Math.PI - 0.1);
    c.quadraticCurveTo(x - 4.5 * s, y + 0.5 * s, x, y - 5 * s);
    c.fill();
  }
  function iconBolt(x: number, y: number, color: string) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x + 1.5, y - 6);
    c.lineTo(x - 3.5, y + 1);
    c.lineTo(x - 0.2, y + 1);
    c.lineTo(x - 1.5, y + 6);
    c.lineTo(x + 3.5, y - 1);
    c.lineTo(x + 0.2, y - 1);
    c.closePath();
    c.fill();
  }
  function iconRing(x: number, y: number, color: string) {
    c.strokeStyle = color;
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(x, y, 4.2, 0, Math.PI * 2);
    c.stroke();
  }
  function iconPhone(x: number, y: number, color: string) {
    c.strokeStyle = color;
    c.lineWidth = 1.4;
    c.beginPath();
    c.roundRect(x - 3.5, y - 6, 7, 12, 1.5);
    c.stroke();
  }
  function iconBone(x: number, y: number, color: string, s = 1) {
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(x - 5 * s, y - 1.6 * s, 10 * s, 3.2 * s, 1.5 * s);
    for (const [ox, oy] of [[-5, -1.8], [-5, 1.8], [5, -1.8], [5, 1.8]]) {
      c.moveTo(x + ox * s + 2.2 * s, y + oy * s);
      c.arc(x + ox * s, y + oy * s, 2.2 * s, 0, Math.PI * 2);
    }
    c.fill();
  }
  function keyBadge(x: number, y: number, label: string) {
    c.font = `700 9px ${BODY}`;
    const w = Math.max(16, c.measureText(label).width + 8);
    c.strokeStyle = 'rgba(232, 228, 218, 0.7)';
    c.lineWidth = 1;
    c.beginPath();
    c.roundRect(x - w, y - 7, w, 14, 3);
    c.stroke();
    c.fillStyle = 'rgba(232, 228, 218, 0.85)';
    c.textAlign = 'center';
    c.fillText(label, x - w / 2, y + 0.5);
    c.textAlign = 'left';
  }

  function goalItems(): [string, boolean][] {
    return [
      [`Mark 5 spots${goals.mark ? '' : ` (${Math.min(marked, 5)}/5)`}`, goals.mark],
      ['Scatter the pigeons', goals.pigeons],
      ['Say hi to another dog', goals.dog],
      [`Find 5 bones${goals.bones ? '' : ` (${Math.min(bonesGot, 5)}/5)`}`, goals.bones],
      ['Run free in the park', goals.free],
    ];
  }

  function bannerText(): string | null {
    if (toast) return toast.text;
    if (near) {
      if (near.stop.id === 'station') return coarse ? 'Tap GO IN: Board train to 3D' : 'Enter: ride train to 3D seafront';
      return coarse ? `Tap GO IN or sign: ${near.stop.label}` : `Enter: go into ${near.stop.label}`;
    }
    if (nearBone) return coarse ? 'GRAB: pick up the bone' : 'G: pick up the bone';
    if (natureCalls) return coarse ? 'Nature calls! Hold POOP' : 'Nature calls! Hold F';
    if (pee < 0.25 && !nearDrink) return 'Thirsty! Find a water bowl';
    if (offLeash) return 'Off the leash! Go back to your human to clip on';
    if (pee > 0.97 && !goals.mark) return 'Bursting! Go mark a spot';
    if (allDone) return 'All done! Next: train to 3D at Estació';
    return null;
  }

  function drawHud() {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!playing) return;
    const small = cssW < 520;
    const k = small ? 0.78 : 1;
    c.textBaseline = 'middle';
    c.textAlign = 'left';

    // Stats, top left
    c.save();
    c.translate(small ? 6 : 10, small ? 6 : 10);
    c.scale(k, k);
    hudPanel(0, 0, 176, 86);
    const label = (y: number, text: string) => {
      c.fillStyle = '#e8e4da';
      c.font = `700 9px ${BODY}`;
      c.fillText(text, 26, y);
    };
    const bar = (y: number, v: number, color: string) => {
      c.fillStyle = 'rgba(255,255,255,0.14)';
      c.fillRect(92, y - 3.5, 74, 7);
      c.fillStyle = color;
      c.fillRect(92, y - 3.5, 74 * clamp(v, 0, 1), 7);
    };
    iconPhone(14, 15, '#e8e4da');
    label(15, 'PATIENCE');
    for (let i = 0; i < 3; i++) {
      c.fillStyle = human.patience > i / 3 + 0.02 ? '#1fc9b7' : 'rgba(255,255,255,0.14)';
      c.fillRect(92 + i * 13, 11, 10, 8);
    }
    iconBone(140, 15, '#f4ecd8', 0.9);
    c.fillStyle = '#f4f1ea';
    c.font = `800 11px ${FONT}`;
    c.fillText(String(bonesGot), 151, 15.5);
    iconDrop(14, 34, '#ffb020');
    label(34, 'PEE');
    bar(34, pee, '#ffb020');
    iconRing(14, 52, '#ffb020');
    label(52, 'MARKED');
    for (let i = 0; i < 5; i++) iconDrop(98 + i * 14, 52, i < marked ? '#ffb020' : 'rgba(255,255,255,0.22)', 0.85);
    iconBolt(14, 70, '#8bcb3c');
    label(70, 'ZOOMIES');
    bar(70, zoom, '#8bcb3c');
    c.restore();

    // Goals, top right; G or a tap opens and closes the list
    if (goalsOpen === null) goalsOpen = !small;
    const items = goalItems();
    const done = items.filter(([, d]) => d).length;
    const gw = 196, gh = goalsOpen ? 30 + items.length * 17 : 26;
    c.save();
    const gx = cssW - (gw + 10) * k - (small ? -4 : 0), gy = small ? 6 : 10;
    c.translate(gx, gy);
    c.scale(k, k);
    goalsRect = { x: gx, y: gy, w: gw * k, h: gh * k };
    hudPanel(0, 0, gw, gh);
    c.fillStyle = '#f4f1ea';
    c.font = `800 11px ${FONT}`;
    c.textAlign = 'left';
    c.fillText(`GOALS ${done}/${items.length}`, 10, 13.5);
    keyBadge(gw - 8, 13, coarse ? (goalsOpen ? '–' : '+') : 'TAB');
    if (goalsOpen) {
      c.font = `600 10px ${BODY}`;
      items.forEach(([text, d], i) => {
        const y = 34 + i * 17;
        c.strokeStyle = d ? '#8bcb3c' : 'rgba(232, 228, 218, 0.8)';
        c.lineWidth = 1.2;
        c.strokeRect(10, y - 5, 10, 10);
        if (d) {
          c.beginPath();
          c.moveTo(12, y);
          c.lineTo(14.5, y + 3);
          c.lineTo(18.5, y - 3);
          c.stroke();
        }
        c.fillStyle = d ? 'rgba(232, 228, 218, 0.45)' : '#f4f1ea';
        c.textAlign = 'left';
        c.fillText(text, 28, y + 0.5);
      });
    }
    c.restore();

    // Banner: prompts and toasts, top center (below the panels on phones)
    const text = bannerText();
    if (text) {
      c.font = `800 ${small ? 10 : 12}px ${FONT}`;
      const t = text.toUpperCase();
      const tw = c.measureText(t).width;
      const bw = tw + 34, bh = small ? 22 : 26;
      const bx = cssW / 2 - bw / 2, by = small ? 6 + 86 * k + 6 : 12;
      hudPanel(bx, by, bw, bh);
      c.fillStyle = toast ? '#8bcb3c' : '#ffb020';
      c.beginPath();
      c.arc(bx + 13, by + bh / 2, 3.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f4f1ea';
      c.textAlign = 'left';
      c.fillText(t, bx + 23, by + bh / 2 + 0.5);
    }

    // Touch buttons
    if (coarse) for (const b of buttons()) {
      const on = (b.id === 'run' && touchSprint !== null) || (b.id === 'dig' && touchDig !== null) || (b.id === 'pee' && touchSquat !== null);
      const accent = b.id === 'grab' || b.id === 'enter';
      c.fillStyle = on ? '#8bcb3c' : accent ? 'rgba(255, 176, 32, 0.94)' : HUD_BG;
      c.beginPath();
      c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      c.fill();
      if (b.id === 'pee') iconDrop(b.x, b.y - 5, natureCalls ? '#b0674a' : '#ffb020', 1.1);
      else if (b.id === 'run') iconBolt(b.x, b.y - 5, on ? '#0b1430' : '#8bcb3c');
      else if (b.id === 'grab') iconBone(b.x, b.y - 5, '#0b1430', 0.9);
      c.fillStyle = on || accent ? '#0b1430' : '#f4f1ea';
      c.font = `800 9px ${FONT}`;
      c.textAlign = 'center';
      const plain = b.id === 'bark' || b.id === 'dig' || b.id === 'enter';
      c.fillText(b.label, b.x, b.y + (plain ? 0.5 : 8));
    }
    c.textAlign = 'left';
  }

  function buttons() {
    const r = cssW < 520 ? 22 : 24, y = cssH - r - 10, step = r * 2 + 8;
    const x = (i: number) => cssW - r - 12 - step * i;
    const list = [
      { id: 'bark', label: 'BARK', x: x(0), y, r },
      { id: 'pee', label: natureCalls ? 'POOP' : 'PEE', x: x(1), y, r },
      { id: 'dig', label: 'DIG', x: x(2), y, r },
      { id: 'run', label: 'RUN', x: x(3), y, r },
    ];
    if (nearBone) list.push({ id: 'grab', label: 'GRAB', x: x(0), y: y - step, r });
    if (near) list.push({ id: 'enter', label: 'GO IN', x: x(nearBone ? 1 : 0), y: y - step, r });
    return list;
  }

  function drawParkThings(x0: number, x1: number) {
    for (const p of poops) {
      if (p.x < x0 - 10 || p.x > x1 + 10) continue;
      c.fillStyle = '#6b4a32';
      c.beginPath();
      c.arc(p.x, p.y, 3, 0, Math.PI * 2);
      c.arc(p.x + 2.5, p.y - 1.5, 2.4, 0, Math.PI * 2);
      c.arc(p.x + 1, p.y - 3.5, 1.8, 0, Math.PI * 2);
      c.fill();
    }
    if (ball.x > x0 - 10 && ball.x < x1 + 10) {
      shadowAt(ball.x, ball.y, 4.5, 3);
      c.fillStyle = '#d4e157';
      c.beginPath();
      c.arc(ball.x, ball.y, 4.5, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(ball.x - 3, ball.y, 3.5, -0.9, 0.9);
      c.stroke();
    }
  }

  function drawBones(x0: number, x1: number) {
    const t = performance.now() / 1000;
    for (const b of bones) {
      if (b.got || b.x < x0 - 20 || b.x > x1 + 20) continue;
      const bob = Math.sin(t * 3 + b.x) * 1.2;
      shadowAt(b.x, b.y + 2, 6, 2.5);
      c.save();
      c.translate(b.x, b.y + bob);
      c.rotate(-0.4);
      iconBone(0, 0, '#f4ecd8', 1.25);
      c.strokeStyle = 'rgba(80, 60, 40, 0.5)';
      c.lineWidth = 0.8;
      c.stroke();
      c.restore();
    }
  }

  function drawFx(x0: number, x1: number) {
    for (const f of fx) {
      if (f.x < x0 - 20 || f.x > x1 + 20) continue;
      const p = clamp(f.t / f.max, 0, 1);
      const a = 1 - p;
      c.save();
      c.globalAlpha = a;
      if (f.kind === 'ring') {
        c.strokeStyle = 'rgba(255, 176, 32, 0.95)';
        c.lineWidth = 1.6;
        c.beginPath();
        c.ellipse(f.x, f.y, 4 + p * 12, (4 + p * 12) * 0.55, 0, 0, Math.PI * 2);
        c.stroke();
      } else if (f.kind === 'dust') {
        c.fillStyle = 'rgba(210, 194, 165, 0.7)';
        c.beginPath();
        c.arc(f.x, f.y, 2 + p * 3, 0, Math.PI * 2);
        c.fill();
      } else if (f.kind === 'splash') {
        c.fillStyle = '#6ec6e8';
        c.beginPath();
        c.arc(f.x, f.y, 1.8 * (1 - p * 0.4), 0, Math.PI * 2);
        c.fill();
      } else {
        c.fillStyle = '#e5487a';
        c.beginPath();
        c.arc(f.x - 2.2, f.y, 2.2, 0, Math.PI * 2);
        c.arc(f.x + 2.2, f.y, 2.2, 0, Math.PI * 2);
        c.moveTo(f.x - 4.3, f.y + 0.8);
        c.lineTo(f.x, f.y + 5.2);
        c.lineTo(f.x + 4.3, f.y + 0.8);
        c.fill();
      }
      c.restore();
    }
  }

  function drawTransitDoors() {
    if (!boarding && arriving <= 0) return;
    const raw = boarding ? clamp(boarding.t / 0.45, 0, 1) : clamp(arriving / 0.45, 0, 1);
    const closed = 1 - Math.pow(1 - raw, 2);
    const halfW = (cssW / 2) * closed;
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const side of [-1, 1] as const) {
      const x = side < 0 ? 0 : cssW - halfW;
      c.fillStyle = '#cfd4dc';
      c.fillRect(x, 0, halfW + 1, cssH);
      c.fillStyle = '#e5302a';
      c.fillRect(x, cssH * 0.48, halfW + 1, Math.max(12, cssH * 0.08));
      c.fillStyle = '#14203d';
      const winW = Math.min(84, halfW * 0.55);
      if (winW > 12) {
        const wx = side < 0 ? Math.max(8, halfW - winW - 22) : Math.min(cssW - winW - 8, x + 22);
        c.beginPath();
        c.roundRect(wx, cssH * 0.16, winW, cssH * 0.28, 10);
        c.fill();
      }
      c.fillStyle = '#2a2f3d';
      c.fillRect(side < 0 ? halfW - 6 : x, 0, 6, cssH);
    }
    if (boarding && closed > 0.35) {
      c.fillStyle = 'rgba(20, 27, 44, 0.92)';
      c.beginPath();
      c.roundRect(cssW / 2 - 140, cssH / 2 - 20, 280, 40, 20);
      c.fill();
      c.fillStyle = '#f4f1ea';
      c.font = `800 12px ${FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('BOARDING R1 · HEADING TO 3D SEAFRONT…', cssW / 2, cssH / 2 + 0.5);
    }
    c.restore();
  }

  function draw() {
    if (!cssW) return;
    const night = isNight();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas!.width, canvas!.height);
    if (offY > 0) {
      // Letterbox: rooftops above the street, more road below it.
      c.fillStyle = '#b8a888';
      c.fillRect(0, 0, canvas!.width, Math.ceil(offY * dpr));
      c.fillStyle = '#4a4f5c';
      c.fillRect(0, Math.floor((offY + WH * scale) * dpr), canvas!.width, Math.ceil(offY * dpr) + 2);
    }
    c.drawImage(bg, camX * bgScale, 0, viewW * bgScale, WH * bgScale, 0, Math.round(offY * dpr), canvas!.width, Math.round(WH * scale * dpr));
    c.setTransform(dpr * scale, 0, 0, dpr * scale, -camX * dpr * scale, offY * dpr);
    const x0 = camX, x1 = camX + viewW;

    c.fillStyle = 'rgba(214, 178, 60, 0.35)';
    for (const s of stains) {
      if (s.x < x0 - 10 || s.x > x1 + 10) continue;
      c.beginPath();
      c.ellipse(s.x, s.y, s.r, s.r * 0.6, 0, 0, Math.PI * 2);
      c.fill();
    }
    if (near && playing && (near.type === 'shop' || near.type === 'station')) {
      c.fillStyle = 'rgba(255, 176, 32, 0.9)';
      c.fillRect(doorX(near) - 11, 88, 22, FACADE - 88);
      c.fillStyle = 'rgba(255, 176, 32, 0.5)';
      c.fillRect(doorX(near) - 18, FACADE, 36, 9);
    }

    drawFx(x0, x1);
    drawBones(x0, x1);
    drawParkThings(x0, x1);
    for (const v of vehicles) if (v.x > x0 - 60 && v.x < x1 + 60) drawVehicle(v, night);
    for (const g of pigeons) if (!g.flying) drawPigeon(g);
    for (const p of peds) {
      if (p.x < x0 - 60 || p.x > x1 + 60) continue;
      if (p.pet) {
        c.strokeStyle = '#3a4a75';
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.pet.x, p.pet.y);
        c.stroke();
        drawDogBody(p.pet.x, p.pet.y, p.pet.heading, 7, p.pet.color, performance.now() / 70, p.pause <= 0, false, '#1fc9b7');
      }
      drawPerson(p.x, p.y, p.dir === 1 ? 0 : Math.PI, PED_R, p.coat, p.hair, performance.now() / 110 + p.x, p.pause <= 0, p.prop, night);
    }
    if (!offLeash) drawRope();
    drawPerson(human.x, human.y, human.heading, HUMAN_R, '#1fc9b7', '#5b3a29', human.step, human.walking, 'phone', night);
    drawDogBody(dog.x, dog.y, dog.heading, DOG_R, '#1b1b1f', dog.step, dog.moving, dog.peeing > 0, '#ffb020');
    if (dog.dig || dog.squat > 0) {
      // Scuff marks behind her paws while she digs in or squats.
      c.strokeStyle = 'rgba(90, 70, 50, 0.45)';
      c.lineWidth = 1.2;
      const bx = dog.x - Math.cos(dog.heading) * DOG_R * 1.4, by = dog.y - Math.sin(dog.heading) * DOG_R * 1.4;
      for (const o of [-4, 0, 4]) {
        c.beginPath();
        c.moveTo(bx + Math.sin(dog.heading) * o, by - Math.cos(dog.heading) * o);
        c.lineTo(bx + Math.sin(dog.heading) * o - Math.cos(dog.heading) * 5, by - Math.cos(dog.heading) * o - Math.sin(dog.heading) * 5);
        c.stroke();
      }
    }
    if (dog.peeing > 0) {
      c.fillStyle = 'rgba(240, 200, 60, 0.8)';
      c.beginPath();
      c.arc(dog.x - Math.cos(dog.heading) * 6 + Math.sin(dog.heading) * 10, dog.y - Math.sin(dog.heading) * 6 - Math.cos(dog.heading) * 10 + 2, 1.6, 0, Math.PI * 2);
      c.fill();
    }
    drawTops(c, world, x0, x1, night);
    for (const g of pigeons) if (g.flying && g.y > -20) drawPigeon(g);

    if (night) {
      c.fillStyle = 'rgba(11, 20, 48, 0.5)';
      c.fillRect(x0, -offY / scale - 1, viewW, WH + (2 * offY) / scale + 2);
      drawNightLights(c, world, x0, x1);
      c.globalCompositeOperation = 'lighter';
      for (const v of vehicles) {
        const reach = v.kind === 'car' ? 40 : 22, size = v.kind === 'car' ? 40 : 20;
        const g = c.createRadialGradient(v.x + v.dir * reach, v.y, 2, v.x + v.dir * reach, v.y, size);
        g.addColorStop(0, 'rgba(255, 240, 190, 0.35)');
        g.addColorStop(1, 'rgba(255, 240, 190, 0)');
        c.fillStyle = g;
        c.fillRect(v.x + v.dir * reach - size, v.y - size, size * 2, size * 2);
        // Tail lights: one on a bike, a pair on a car.
        const tx = v.x - v.dir * (v.kind === 'car' ? 26 : 15);
        for (const ty of v.kind === 'car' ? [v.y - 7.5, v.y + 7.5] : [v.y]) {
          const r = c.createRadialGradient(tx, ty, 1, tx, ty, v.kind === 'car' ? 8 : 9);
          r.addColorStop(0, 'rgba(255, 60, 50, 0.55)');
          r.addColorStop(1, 'rgba(255, 60, 50, 0)');
          c.fillStyle = r;
          c.fillRect(tx - 9, ty - 9, 18, 18);
        }
      }
      c.globalCompositeOperation = 'source-over';
    }
    for (const b of bubbles) drawBubble(b);
    drawHud();
    drawTransitDoors();
  }

  // ---- Loop and events ---------------------------------------------------------------
  let last = 0, raf = 0, onScreen = true;
  const still = () => reduced && !playing;
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!still()) update(dt);
    draw();
    raf = onScreen && !still() && document.visibilityState === 'visible' ? requestAnimationFrame(frame) : 0;
  }
  function start() {
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function takeLeash() {
    if (!playing) { playing = true; sayCaption(); start(); }
    if (wantSound && !sound.on) sound.enable();
  }
  function setSound(on: boolean) {
    wantSound = on;
    try { localStorage.setItem('street-sound', on ? 'on' : 'off'); } catch { /* storage blocked */ }
    if (on) sound.enable();
    else sound.disable();
    if (soundBtn) {
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.textContent = on ? 'Sound on' : 'Sound off';
    }
  }
  // Two fullscreen modes: "window" fills the browser window (works everywhere),
  // "screen" asks for real fullscreen and falls back to filling the window. A
  // page change (the train to 3D) drops real fullscreen, so the mode rides along
  // in the URL (?fs=) and is restored on arrival.
  type FsMode = 'off' | 'window' | 'screen';
  const fsButtons = Array.from(fig.querySelectorAll<HTMLButtonElement>('[data-fs]'));
  const canRealFs = !!fig.requestFullscreen && document.fullscreenEnabled !== false;
  if (!canRealFs) fsButtons.filter((b) => b.dataset.fs === 'screen').forEach((b) => { b.hidden = true; });
  let fsMode: FsMode = 'off';
  const isFull = () => fsMode !== 'off';
  const syncFs = () => {
    for (const b of fsButtons) b.setAttribute('aria-pressed', String(b.dataset.fs === fsMode));
  };
  let untrackViewport: (() => void) | null = null;
  function immersive(on: boolean) {
    fig.classList.toggle('immersive', on);
    if (on && !untrackViewport) untrackViewport = trackVisibleViewport(fig);
    else if (!on && untrackViewport) { untrackViewport(); untrackViewport = null; }
    document.documentElement.style.overflow = on ? 'hidden' : '';
  }
  function setFsMode(mode: FsMode) {
    if (mode === fsMode) return;
    fsMode = mode;
    if (mode === 'off') {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      immersive(false);
    } else if (mode === 'window') {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      immersive(true);
    } else {
      // Fill the window until (and unless) the browser grants real fullscreen;
      // some browsers and embedded views refuse or ignore the request silently.
      immersive(true);
      fig.requestFullscreen?.().catch(() => { if (fsMode === 'screen') { fsMode = 'window'; syncFs(); } });
    }
    if (mode !== 'off') { takeLeash(); fig.focus({ preventScroll: true }); }
    syncFs();
  }
  function toggleFullscreen() {
    setFsMode(isFull() ? 'off' : canRealFs ? 'screen' : 'window');
  }
  fsButtons.forEach((b) => b.addEventListener('click', () => {
    const m = b.dataset.fs as FsMode;
    setFsMode(fsMode === m ? 'off' : m);
  }));
  // Leaving real fullscreen with the browser's own Escape or gesture: back to the page.
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && fsMode === 'screen') setFsMode('off'); });
  // After the train: fill the window at once, and go real fullscreen on the
  // first key or tap (browsers only allow it in response to one).
  function restoreFs(mode: string | null) {
    if (mode !== 'window' && mode !== 'screen') return;
    setFsMode('window');
    if (mode !== 'screen' || !canRealFs) return;
    const upgrade = (e: Event) => {
      if (e instanceof KeyboardEvent && e.code === 'Escape') return;
      fig.removeEventListener('keydown', upgrade, true);
      fig.removeEventListener('pointerdown', upgrade, true);
      if (fsMode === 'window') setFsMode('screen');
    };
    fig.addEventListener('keydown', upgrade, true);
    fig.addEventListener('pointerdown', upgrade, true);
  }

  if (soundBtn) {
    soundBtn.setAttribute('aria-pressed', String(wantSound));
    soundBtn.textContent = wantSound ? 'Sound on' : 'Sound off';
    soundBtn.addEventListener('click', () => setSound(!wantSound));
  }
  fig.querySelector<HTMLButtonElement>('[data-restart]')?.addEventListener('click', () => { takeLeash(); restart(); });
  function goIn() {
    if (!near || boarding) return;
    const a = links.get(near.stop.id);
    if (near.stop.id === 'station') {
      const url = new URL(a?.getAttribute('href') || near.stop.href, location.origin);
      if (wantSound) url.searchParams.set('sound', '1');
      if (fsMode !== 'off') url.searchParams.set('fs', fsMode);
      if (!reduced && !streetTest) {
        sound.stationChime();
        boarding = { href: url.pathname + url.search + url.hash, t: 0, sent: false };
        return;
      }
      location.href = url.pathname + url.search + url.hash;
      return;
    }
    a?.click();
  }

  // The real game's default bindings (autoload/game.gd, the default layout).
  const HOLD = new Set(['ShiftLeft', 'ShiftRight', 'BracketRight', 'Space', 'Enter', 'NumpadEnter', 'KeyF', 'End']);
  fig.addEventListener('keydown', (e) => {
    if (e.target !== fig) return;
    const code = e.code;
    if (code === 'Escape') {
      if (fig.classList.contains('immersive')) { toggleFullscreen(); return; }
      fig.blur();
      return;
    }
    if (code === 'Tab') {
      if (e.shiftKey || !playing) return; // let Shift+Tab (and Tab before playing) move focus as usual
      e.preventDefault();
      goalsOpen = !goalsOpen;
      return;
    }
    if ((code === 'Enter' || code === 'NumpadEnter') && near) {
      e.preventDefault();
      goIn();
      return;
    }
    if (code in MOVE || HOLD.has(code)) {
      e.preventDefault();
      takeLeash();
      held.add(code);
      return;
    }
    if (e.repeat) return;
    if (code === 'KeyE' || code === 'ControlLeft' || code === 'ControlRight') { takeLeash(); doBark(); }
    else if (code === 'KeyQ' || code === 'Delete') { takeLeash(); doPee(); }
    else if (code === 'KeyG' || code === 'PageDown') { takeLeash(); doPickup(); }
    else if (code === 'KeyR' && playing) restart();
  });
  fig.addEventListener('keyup', (e) => held.delete(e.code));
  fig.addEventListener('blur', () => held.clear());
  let steerId: number | null = null;
  // How far up a tap can send her: the shopfronts stop her at the pavement, but the park is open lawn.
  const topAt = (wx: number) => (wx > world.park.x + 12 ? 36 : WALK_TOP);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('touchstart', (e) => {
    coarse = true;
    if (!playing) return;
    const rect = canvas.getBoundingClientRect();
    const btns = buttons();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const sx = t.clientX - rect.left, sy = t.clientY - rect.top;
      const onGoal = sx >= goalsRect.x - 10 && sx <= goalsRect.x + goalsRect.w + 10 && sy >= goalsRect.y - 10 && sy <= goalsRect.y + goalsRect.h + 10;
      const onBtn = btns.some((b) => Math.hypot(b.x - sx, b.y - sy) < b.r + 8);
      if (onGoal || onBtn || isFull()) { e.preventDefault(); break; }
    }
  }, { passive: false });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') coarse = true;
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    fig.focus({ preventScroll: true });
    const wasPlaying = playing;
    takeLeash();
    if (wasPlaying && sx >= goalsRect.x - 10 && sx <= goalsRect.x + goalsRect.w + 10 && sy >= goalsRect.y - 10 && sy <= goalsRect.y + goalsRect.h + 10) {
      goalsOpen = !goalsOpen;
      return;
    }
    if (coarse && wasPlaying) {
      const b = buttons().find((b) => Math.hypot(b.x - sx, b.y - sy) < b.r + 8);
      if (b) {
        e.preventDefault();
        const cap = () => { try { canvas.setPointerCapture(e.pointerId); } catch {} };
        if (b.id === 'run') { touchSprint = e.pointerId; cap(); }
        else if (b.id === 'dig') { touchDig = e.pointerId; cap(); }
        else if (b.id === 'pee' && natureCalls) { touchSquat = e.pointerId; cap(); }
        else if (b.id === 'pee') doPee();
        else if (b.id === 'grab') doPickup();
        else if (b.id === 'enter') goIn();
        else doBark();
        return;
      }
    }
    const wx = camX + sx / scale, wy = (sy - offY) / scale;
    // Shops: tap the facade. The park is open ground (the bone and the ball are in
    // it), so only its sign counts as "going in"; anywhere else there just walks.
    const onParkSign = (l: (typeof world.stops)[number]) => wx >= l.x + 14 && wx < l.x + 146 && wy >= 86 && wy < 134;
    const lot = world.stops.find((l) => (l.type === 'park' ? onParkSign(l) : wx >= l.x && wx < l.x + l.w && wy < FACADE));
    if (lot) {
      if (wasPlaying && near === lot) { goIn(); return; }
      target = { x: doorX(lot), y: doorY(lot) };
      return;
    }
    steerId = e.pointerId;
    target = { x: wx, y: clamp(wy, topAt(wx), WH - 8) };
    spawnFx('ring', target.x, target.y, 0, 0, 0.45);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== steerId) return;
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const wx = camX + sx / scale, wy = (sy - offY) / scale;
    target = { x: wx, y: clamp(wy, topAt(wx), WH - 8) };
  });
  const endTouch = (e: PointerEvent) => {
    if (e.pointerId === steerId) steerId = null;
    if (e.pointerId === touchSprint) touchSprint = null;
    if (e.pointerId === touchDig) touchDig = null;
    if (e.pointerId === touchSquat) touchSquat = null;
  };
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);

  new ResizeObserver(() => { resize(); draw(); }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) start();
  }).observe(fig);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { start(); sound.resume(); }
    else sound.pause();
  });
  const rebuild = () => { buildBg(); draw(); };
  darkMq.addEventListener('change', rebuild);
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.fonts?.ready.then(rebuild);

  resize();
  const params = new URLSearchParams(location.search);
  const viaTrain = params.get('via') === 'train';
  if (params.get('sound') === '1' && !wantSound) setSound(true);
  if (viaTrain) {
    const st = world.stops.find((l) => l.stop.id === 'station');
    if (st) {
      dog.x = doorX(st); dog.y = 152; dog.heading = Math.PI * 0.5;
      human.x = doorX(st) - 24; human.y = 150; human.heading = 0;
      resetRope();
      camX = clamp(dog.x - viewW * 0.45, 0, Math.max(0, W - viewW));
    }
    playing = true;
    if (!reduced && !streetTest) arriving = 0.45;
    const fsWanted = params.get('fs');
    toast = { text: fsWanted === 'screen' && canRealFs ? 'Arrived from 3D! Press any key for fullscreen' : 'Arrived from 3D Estació!', t: 3 };
    if (fsWanted === 'window' || fsWanted === 'screen') restoreFs(fsWanted);
    else fig.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    // Arriving by train continues the walk: take the keys without another click.
    fig.focus({ preventScroll: true });
    if (!streetTest) {
      params.delete('via');
      params.delete('sound');
      params.delete('fs');
      const qs = params.toString();
      history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
    }
  }
  sayCaption();
  start();

  // A frame-stepping hook for automated tests: ?streettest in the URL.
  if (new URLSearchParams(location.search).has('streettest')) {
    (window as unknown as { __street: unknown }).__street = {
      dog, human, peds, vehicles, pigeons, goals,
      get playing() { return playing; },
      get marked() { return marked; },
      get bonesGot() { return bonesGot; },
      get goalsOpen() { return goalsOpen; },
      get banner() { return bannerText(); },
      get offLeash() { return offLeash; },
      get pee() { return pee; },
      get natureCalls() { return natureCalls; },
      set nature(v: number) { nature = v; },
      get poops() { return poops.length; },
      ball, world,
      bones,
      get near() { return near?.stop.id ?? null; },
      get view() { return { camX, scale, offY }; },
      get target() { return target; },
      buttons: () => buttons(),
      restart: () => restart(),
      key(code: string, down: boolean) { fig.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code === 'Space' ? ' ' : code, bubbles: true })); },
      tick(n: number) { for (let i = 0; i < n; i++) update(1 / 60); draw(); },
    };
  }
}
