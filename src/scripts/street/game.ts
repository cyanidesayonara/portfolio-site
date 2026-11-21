/*
  The playable street on the home page. A tip of the hat to Path of Leash
  Resistance: you are Millie, your human is glued to their phone on the
  other end of a rope leash, and every shop is a page of the site.

  Controls: arrows/WASD walk, Shift sprints (zoomies), E pees, Space
  barks, Enter goes into the shop at the door. On touch screens a tap
  walks there and on-screen buttons sprint, pee and bark.
*/
import {
  WH, FACADE, WALK_TOP, LANE, CAR_LANES,
  buildWorld, drawStatic, drawTops, drawNightLights, doorX, doorY,
  type Stop, type StopLot, type Circle,
} from './world';

type P = { x: number; y: number };
type Bubble = { text: string; ttl: number; who: P; lift: number; loud: boolean };
type Ped = {
  x: number; y: number; dir: 1 | -1; speed: number; pause: number; said: boolean;
  coat: string; hair: string; prop: 'phone' | 'coffee' | 'bag' | 'dog';
  pet?: { x: number; y: number; heading: number; color: string; greeted: boolean };
};
type Pigeon = { x: number; y: number; hx: number; hy: number; flying: boolean; vx: number; vy: number; t: number; hop: number };
type Vehicle = { kind: 'bike' | 'car'; x: number; y: number; dir: 1 | -1; speed: number; max: number; color: string; alerted: number; wobble: number };
type Stain = { x: number; y: number; r: number };

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
  const hint = fig.querySelector<HTMLElement>('[data-hint]');
  if (!canvas || !ctx || !caption || !hint) return;
  const c = ctx;
  const links = new Map([...fig.querySelectorAll<HTMLAnchorElement>('[data-stop]')].map((a) => [a.dataset.stop ?? '', a]));
  fig.classList.add('live');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const isNight = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : darkMq.matches;
  };

  const world = buildWorld(stops);
  const W = world.width;

  // ---- State ----------------------------------------------------------------------
  const dog = { x: 70, y: 168, heading: 0, moving: false, sprint: false, peeing: 0, step: 0 };
  const human = { x: 34, y: 150, heading: 0, walking: false, patience: 1, stop: 0, step: 0 };
  const rope = Array.from({ length: ROPE_N + 1 }, (_, i) => {
    const t = i / ROPE_N;
    const x = human.x + (dog.x - human.x) * t, y = human.y + (dog.y - human.y) * t;
    return { x, y, px: x, py: y };
  });
  let leash = ROPE_BASE;
  let heyT = 0;
  let pee = 1, zoom = 1, barkCd = 0, marked = 0;
  const goals = { mark: false, pigeons: false, dog: false };
  const stains: Stain[] = [];
  const bubbles: Bubble[] = [];
  const peds: Ped[] = [];
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

  // ---- Sizing and the static layer ---------------------------------------------------
  let cssW = 0, cssH = 0, dpr = 1, scale = 1, viewW = 0;
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
    viewW = cssW / scale;
    buildBg();
  }

  // ---- Collision ---------------------------------------------------------------------
  function pushOut(p: P, r: number, withBodies: boolean) {
    for (const s of world.solids) {
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
    if (withBodies) {
      for (const o of peds) {
        const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy), min = PED_R + r;
        if (d < min && d > 1e-4) { p.x = o.x + (dx / d) * min; p.y = o.y + (dy / d) * min; }
      }
    }
    const inPark = p.x > world.park.x + 12;
    p.x = clamp(p.x, r, W - r);
    p.y = clamp(p.y, (inPark ? 30 : WALK_TOP) + r * 0.6, WH - r - 2);
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
    if (pee < 0.25) { say(dog, '...', 18); return; }
    let best: Circle | null = null, bd = Infinity;
    for (const s of world.peeSpots) {
      const d = Math.hypot(s.x - dog.x, s.y - dog.y) - s.r - DOG_R;
      if (d < 16 && d < bd) { best = s; bd = d; }
    }
    dog.peeing = 0.9;
    pee -= 0.25;
    const sx = best ? best.x + (dog.x - best.x) * 0.5 : dog.x - Math.cos(dog.heading) * DOG_R;
    const sy = best ? best.y + (dog.y - best.y) * 0.5 + 4 : dog.y - Math.sin(dog.heading) * DOG_R;
    stains.push({ x: sx, y: sy, r: 6 + Math.random() * 3 });
    if (stains.length > 30) stains.shift();
    if (best && !best.marked) {
      best.marked = true;
      marked++;
      if (marked >= 5 && !goals.mark) { goals.mark = true; say(human, 'Good girl!', 24); }
    }
  }

  function doBark() {
    if (barkCd > 0) return;
    barkCd = 0.5;
    say(dog, 'WOOF!', 20, true, 0.9);
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
    if (any && byPlayer && playing) goals.pigeons = true;
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
    const inv = (i: number) => (i === 0 ? 0.08 : i === ROPE_N ? 0.32 : 1);
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
      for (let i = 1; i < ROPE_N; i++) pushOut(rope[i], 1.5, false);
    }
    human.x = rope[0].x; human.y = rope[0].y;
    dog.x = rope[ROPE_N].x; dog.y = rope[ROPE_N].y;
    pushOut(human, HUMAN_R, true);
    pushOut(dog, DOG_R, true);
    const dx = dog.x - human.x, dy = dog.y - human.y, d = Math.hypot(dx, dy);
    if (d > leash) { dog.x = human.x + (dx / d) * leash; dog.y = human.y + (dy / d) * leash; }
    rope[0].x = human.x; rope[0].y = human.y;
    rope[ROPE_N].x = dog.x; rope[ROPE_N].y = dog.y;
  }

  function updatePlayer(dt: number) {
    barkCd -= dt;
    heyT -= dt;
    human.stop -= dt;
    pee = Math.min(1, pee + dt * 0.07);

    let dir = playing ? input() : autopilot(dt);
    if (dog.peeing > 0) { dog.peeing -= dt; dir = null; }
    const wantSprint = playing && (held.has('ShiftLeft') || held.has('ShiftRight') || touchSprint !== null);
    dog.sprint = !!dir && wantSprint && zoom > 0.04;
    zoom = dog.sprint ? Math.max(0, zoom - dt * 0.42) : Math.min(1, zoom + dt * 0.16);
    const speed = !playing ? 70 : dog.sprint ? 235 : 140;
    dog.moving = !!dir;
    if (dir) {
      dog.x += dir.x * speed * dt;
      dog.y += dir.y * speed * dt;
      dog.heading = Math.atan2(dir.y, dir.x);
      dog.step += dt * (dog.sprint ? 24 : 15);
    }
    pushOut(dog, DOG_R, true);
    if (dog.sprint) scatter(70, true);
    else scatter(36, playing);

    // Patience: haul on them constantly and they snap and shorten the leash.
    const dx = dog.x - human.x, dy = dog.y - human.y, straight = Math.hypot(dx, dy) || 1;
    const taut = straight > leash * 0.9;
    const away = dir ? (dir.x * dx + dir.y * dy) / straight : 0;
    if (playing && taut && away > 0.3) human.patience -= dt * (dog.sprint ? 0.45 : 0.22);
    else human.patience = Math.min(1, human.patience + dt * 0.12);
    if (human.patience <= 0) {
      say(human, 'HEY!', 28, true, 1.6);
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
    if (human.walking) {
      const guide = rope[4];
      const gx = guide.x - human.x, gy = guide.y - human.y, gd = Math.hypot(gx, gy) || 1;
      const hs = (playing ? 112 : 55) * dt;
      human.x += (gx / gd) * Math.min(hs, gd);
      human.y += (gy / gd) * Math.min(hs, gd);
      human.heading = Math.atan2(gy, gx);
      human.step += dt * 9;
    }
    pushOut(human, HUMAN_R, true);
    solveRope();
  }

  function updatePeds(dt: number) {
    pedTimer -= dt;
    if (pedTimer <= 0 && peds.length < 3) {
      pedTimer = 3 + Math.random() * 4;
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const x = clamp(dir === 1 ? camX - 30 : camX + viewW + 30, 20, W - 20);
      const prop = pick<Ped['prop']>(['phone', 'coffee', 'bag', 'dog', 'phone']);
      const p: Ped = { x, y: dir === 1 ? 153 : 148, dir, speed: 26 + Math.random() * 14, pause: 0, said: false, coat: pick(COATS), hair: pick(HAIRS), prop };
      if (prop === 'dog') p.pet = { x: x - dir * 24, y: p.y + 10, heading: 0, color: pick(['#c98b4a', '#f4f1ea', '#8a6a4a', '#d9c3a0']), greeted: false };
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
          if (playing) goals.dog = true;
        }
        const tx = p.x - p.dir * 22, ty = p.y + 12 + Math.sin(performance.now() / 600 + p.x) * 3;
        const wantX = pet.greeted && p.pause > 0 ? dog.x - Math.cos(dog.heading) * 14 : tx;
        const wantY = pet.greeted && p.pause > 0 ? dog.y : ty;
        const ddx = wantX - pet.x, ddy = wantY - pet.y, dd = Math.hypot(ddx, ddy);
        if (dd > 1) {
          pet.x += (ddx / dd) * Math.min(dd, 60 * dt);
          pet.y += (ddy / dd) * Math.min(dd, 60 * dt);
          pet.heading = Math.atan2(ddy, ddx);
        }
        const lx = pet.x - p.x, ly = pet.y - p.y, ld = Math.hypot(lx, ly);
        if (ld > 34) { pet.x = p.x + (lx / ld) * 34; pet.y = p.y + (ly / ld) * 34; }
        pushOut(pet, 7, false);
      }
      if (p.pause > 0) p.pause -= dt;
      else p.x += p.dir * p.speed * dt;
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
    updatePlayer(dt);
    updatePeds(dt);
    updatePigeons(dt);
    updateTraffic(dt);
    for (let i = bubbles.length - 1; i >= 0; i--) if ((bubbles[i].ttl -= dt) <= 0) bubbles.splice(i, 1);

    const want = clamp(dog.x - viewW * 0.45, 0, Math.max(0, W - viewW));
    camX = viewW >= W ? (W - viewW) / 2 : camX + (want - camX) * Math.min(1, dt * 4);

    let best: StopLot | null = null;
    for (const l of world.stops) {
      const ok = l.type === 'park' ? dog.x > l.x + 12 : Math.abs(dog.x - doorX(l)) < 40 && dog.y < WALK_TOP + 32;
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
    if (near && playing) text = coarse ? `Tap ${near.stop.label} again to go in.` : `Press Enter to go into ${near.stop.label}.`;
    else if (playing) text = coarse ? 'Walk up to a shop door. Hold RUN for zoomies, PEE marks a spot, BARK scatters the pigeons.' : 'Arrows walk · Shift zoomies · E pee · Space bark · Enter goes into a shop';
    else text = coarse ? 'Tap the street to take Millie for a walk.' : 'Click the street to take Millie for a walk.';
    if (caption!.textContent !== text) caption!.textContent = text;
    const h = near && playing ? (coarse ? 'Tap to go in' : 'Enter to go in') : '';
    if (hint!.textContent !== h) hint!.textContent = h;
    hint!.classList.toggle('show', !!h);
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
      c.fillStyle = '#d9403a';
      c.fillRect(-25.5, -10, 2, 5);
      c.fillRect(-25.5, 5, 2, 5);
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

  function drawHud() {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!playing) return;
    const panel = (x: number, y: number, w: number, h: number) => {
      c.fillStyle = 'rgba(11, 20, 48, 0.8)';
      c.beginPath();
      c.roundRect(x, y, w, h, 8);
      c.fill();
    };
    // Compact on phones, so the HUD doesn't cover the shop signs.
    const small = cssW < 480;
    const k = small ? 0.72 : 1;
    c.save();
    c.translate(small ? 6 : 10, small ? 6 : 10);
    c.scale(k, k);
    panel(0, 0, 148, 66);
    c.font = `700 9px ${BODY}`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    const bar = (y: number, label: string, v: number, color: string) => {
      c.fillStyle = '#c9cfdf';
      c.fillText(label, 10, y);
      c.fillStyle = 'rgba(255,255,255,0.15)';
      c.fillRect(68, y - 3.5, 70, 7);
      c.fillStyle = color;
      c.fillRect(68, y - 3.5, 70 * v, 7);
    };
    bar(14, 'PEE', pee, '#ffb020');
    bar(32, 'ZOOMIES', zoom, '#8bcb3c');
    c.fillStyle = '#c9cfdf';
    c.fillText('MARKED', 10, 50);
    for (let i = 0; i < 5; i++) {
      c.fillStyle = i < marked ? '#ffb020' : 'rgba(255,255,255,0.2)';
      c.beginPath();
      c.arc(74 + i * 14, 50, 4.5, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    if (cssW >= 560) {
      const items: [string, boolean][] = [['Mark 5 spots', goals.mark], ['Scatter the pigeons', goals.pigeons], ['Say hi to another dog', goals.dog]];
      const done = items.filter(([, d]) => d).length;
      const x = cssW - 178;
      panel(x, 10, 168, 82);
      c.fillStyle = '#f4f1ea';
      c.font = `800 10px ${FONT}`;
      c.fillText(`GOALS ${done}/${items.length}`, x + 10, 24);
      c.font = `600 10px ${BODY}`;
      items.forEach(([label, d], i) => {
        const y = 44 + i * 16;
        c.strokeStyle = d ? '#8bcb3c' : '#c9cfdf';
        c.lineWidth = 1.2;
        c.strokeRect(x + 10, y - 5, 10, 10);
        if (d) {
          c.beginPath();
          c.moveTo(x + 12, y);
          c.lineTo(x + 14.5, y + 3);
          c.lineTo(x + 18.5, y - 3);
          c.stroke();
        }
        c.fillStyle = d ? 'rgba(201, 207, 223, 0.6)' : '#f4f1ea';
        c.fillText(label, x + 28, y);
      });
    }
    if (coarse) for (const b of buttons()) {
      c.fillStyle = b.id === 'run' && touchSprint !== null ? '#8bcb3c' : 'rgba(11, 20, 48, 0.8)';
      c.beginPath();
      c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f4f1ea';
      c.font = `800 10px ${FONT}`;
      c.textAlign = 'center';
      c.fillText(b.label, b.x, b.y + 1);
    }
  }

  function buttons() {
    const r = cssW < 480 ? 21 : 24, y = cssH - r - 10;
    return [
      { id: 'bark', label: 'BARK', x: cssW - r - 12, y, r },
      { id: 'pee', label: 'PEE', x: cssW - r * 3 - 20, y, r },
      { id: 'run', label: 'RUN', x: cssW - r * 5 - 28, y, r },
    ];
  }

  function draw() {
    if (!cssW) return;
    const night = isNight();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas!.width, canvas!.height);
    c.drawImage(bg, camX * bgScale, 0, viewW * bgScale, WH * bgScale, 0, 0, canvas!.width, canvas!.height);
    c.setTransform(dpr * scale, 0, 0, dpr * scale, -camX * dpr * scale, 0);
    const x0 = camX, x1 = camX + viewW;

    c.fillStyle = 'rgba(214, 178, 60, 0.35)';
    for (const s of stains) {
      if (s.x < x0 - 10 || s.x > x1 + 10) continue;
      c.beginPath();
      c.ellipse(s.x, s.y, s.r, s.r * 0.6, 0, 0, Math.PI * 2);
      c.fill();
    }
    if (near && playing && near.type === 'shop') {
      c.fillStyle = 'rgba(255, 176, 32, 0.9)';
      c.fillRect(doorX(near) - 11, 88, 22, FACADE - 88);
      c.fillStyle = 'rgba(255, 176, 32, 0.5)';
      c.fillRect(doorX(near) - 18, FACADE, 36, 9);
    }

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
        drawDogBody(p.pet.x, p.pet.y, p.pet.heading, 7, p.pet.color, performance.now() / 70, true, false, '#1fc9b7');
      }
      drawPerson(p.x, p.y, p.dir === 1 ? 0 : Math.PI, PED_R, p.coat, p.hair, performance.now() / 110 + p.x, p.pause <= 0, p.prop, night);
    }
    drawRope();
    drawPerson(human.x, human.y, human.heading, HUMAN_R, '#1fc9b7', '#5b3a29', human.step, human.walking, 'phone', night);
    drawDogBody(dog.x, dog.y, dog.heading, DOG_R, '#1b1b1f', dog.step, dog.moving, dog.peeing > 0, '#ffb020');
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
      c.fillRect(x0, 0, viewW, WH);
      drawNightLights(c, world, x0, x1);
      c.globalCompositeOperation = 'lighter';
      for (const v of vehicles) {
        if (v.kind !== 'car') continue;
        const g = c.createRadialGradient(v.x + v.dir * 40, v.y, 2, v.x + v.dir * 40, v.y, 40);
        g.addColorStop(0, 'rgba(255, 240, 190, 0.35)');
        g.addColorStop(1, 'rgba(255, 240, 190, 0)');
        c.fillStyle = g;
        c.fillRect(v.x + v.dir * 40 - 40, v.y - 40, 80, 80);
      }
      c.globalCompositeOperation = 'source-over';
    }
    for (const b of bubbles) drawBubble(b);
    drawHud();
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
  }
  function goIn() {
    if (near) links.get(near.stop.id)?.click();
  }

  fig.addEventListener('keydown', (e) => {
    if (e.target !== fig) return;
    if (e.code in MOVE || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      if (e.code in MOVE) e.preventDefault();
      takeLeash();
      held.add(e.code);
    } else if (e.code === 'Space') {
      e.preventDefault();
      takeLeash();
      if (!e.repeat) doBark();
    } else if (e.code === 'KeyE' || e.code === 'KeyP') {
      takeLeash();
      if (!e.repeat) doPee();
    } else if (e.key === 'Enter' && near) {
      e.preventDefault();
      goIn();
    } else if (e.key === 'Escape') {
      fig.blur();
    }
  });
  fig.addEventListener('keyup', (e) => held.delete(e.code));
  fig.addEventListener('blur', () => held.clear());
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    fig.focus({ preventScroll: true });
    const wasPlaying = playing;
    takeLeash();
    if (coarse && wasPlaying) {
      const b = buttons().find((b) => Math.hypot(b.x - sx, b.y - sy) < b.r + 6);
      if (b) {
        if (b.id === 'run') { touchSprint = e.pointerId; canvas.setPointerCapture(e.pointerId); }
        else if (b.id === 'pee') doPee();
        else doBark();
        return;
      }
    }
    const wx = camX + sx / scale, wy = sy / scale;
    const lot = world.stops.find((l) => wx >= l.x && wx < l.x + l.w && (wy < FACADE || l.type === 'park'));
    if (lot && wy < FACADE + 10) {
      if (wasPlaying && near === lot) { goIn(); return; }
      target = { x: doorX(lot), y: doorY(lot) };
      return;
    }
    target = { x: wx, y: clamp(wy, WALK_TOP, WH - 8) };
  });
  const endTouch = (e: PointerEvent) => { if (e.pointerId === touchSprint) touchSprint = null; };
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);

  new ResizeObserver(() => { resize(); draw(); }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) start();
  }).observe(fig);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') start(); });
  const rebuild = () => { buildBg(); draw(); };
  darkMq.addEventListener('change', rebuild);
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.fonts?.ready.then(rebuild);

  resize();
  sayCaption();
  start();

  // A frame-stepping hook for automated tests: ?streettest in the URL.
  if (new URLSearchParams(location.search).has('streettest')) {
    (window as unknown as { __street: unknown }).__street = {
      dog, human, peds, vehicles, pigeons, goals,
      get playing() { return playing; },
      get marked() { return marked; },
      get near() { return near?.stop.id ?? null; },
      key(code: string, down: boolean) { fig.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code === 'Space' ? ' ' : code, bubbles: true })); },
      tick(n: number) { for (let i = 0; i < n; i++) update(1 / 60); draw(); },
    };
  }
}
