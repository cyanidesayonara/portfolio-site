/*
  Plaça del Mercat at runtime: its people, three quests and the butcher's chase.
  The square's buildings stream in and out (plaza.ts); these few NPCs and props
  stay in the scene but are hidden and paused while Millie is far away.

  Quests (they count toward the "Help out on Plaça del Mercat" goal):
  - Newspaper: pick up the paper at the newsstand, drop it by the grandpa's bench.
  - Terrace: bark the pigeons off the café terrace from outside it; charging through
    the tables only annoys the waiter and the pigeons come back.
  - Fetch: in the second pipicà, bring the regular's frisbee back three times.
  Chase: snatch the botifarra off the butcher's counter and get away with it.
*/
import * as THREE from 'three';
import { makePerson, makeBird, M, box, cyl } from './models';
import { collapseRig } from './bake';
import { PLAZA, inPlazaPipica } from './plaza';
import { GROUND_Y, type Level } from './level';
import type { Hud } from './hud';
import type { WalkAudio } from './audio';

export type PlazaItem = 'paper' | 'frisbee' | 'botifarra';
export const isPlazaItem = (c: string | null): c is PlazaItem => c === 'paper' || c === 'frisbee' || c === 'botifarra';

type P = { x: number; z: number };
export interface PlazaCtx {
  scene: THREE.Scene;
  level: Level;
  hud: Hud;
  audio: WalkAudio;
  dog: { x: number; y: number; z: number; vx: number; vz: number; heading: number; carrying: string | null };
  human: { x: number; z: number };
  humanSay: (text: string, ttl?: number, tone?: 'paper' | 'win' | 'loud') => void;
  addBones: (n: number, why?: string) => void;
  completeGoal: (id: string) => void;
  bumpGoal: (id: string, n: number) => void;
  burst: (x: number, y: number, z: number, color: number, n?: number, spd?: number, up?: number, life?: number, g?: number) => void;
  offLeash: () => boolean;
  /** No other chase running and none just finished. */
  chaseFree: () => boolean;
  /** Tell the game a chase is over (starts the shared cooldown). */
  chaseEnded: () => void;
  collide: (p: P, r: number, feetY: number) => void;
}

const Y = GROUND_Y;
const VIEW = 75;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);
const angLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export function createPlazaLife(ctx: PlazaCtx) {
  const { scene, hud, audio, dog } = ctx;
  const all: THREE.Object3D[] = [];
  const add = <T extends THREE.Object3D>(o: T) => { scene.add(o); all.push(o); return o; };
  const person = (look: Parameters<typeof makePerson>[0], x: number, z: number, heading: number) => {
    const m = makePerson(look);
    m.group.position.set(x, Y, z);
    m.group.rotation.y = -heading;
    add(collapseRig(m.group));
    return m;
  };
  const mouth = () => ({ x: dog.x + Math.cos(dog.heading) * 0.55, y: dog.y + 0.55, z: dog.z + Math.sin(dog.heading) * 0.55 });
  const quests = { paper: false, terrace: false, fetch: false };
  let done = 0;
  const finish = (k: keyof typeof quests, msg: string, reward: number) => {
    if (quests[k]) return;
    quests[k] = true;
    done++;
    ctx.addBones(reward, msg);
    ctx.bumpGoal('plaza', done);
  };
  const saidT: Record<string, number> = {};
  const say = (id: string, text: string, ttl = 2, tone: 'paper' | 'win' | 'loud' = 'paper', every = 0) => {
    if (every && (saidT[id] ?? 0) > 0) return;
    saidT[id] = every;
    hud.say(id, text, ttl, tone);
  };

  // ---- People ------------------------------------------------------------------------
  const K = PLAZA.kiosk;
  const vendor = person({ top: 0x2a5aa8, hair: 0x8a8a8a, hairStyle: 'bald', prop: 'none' }, K.x + 1.3, K.z + 1.8, 0);
  const grandpa = person({ top: 0x6b5a48, trousers: 0x40455c, hair: 0xd8d8d8, hairStyle: 'short', prop: 'none', height: 0.96 }, PLAZA.grandpa.x, PLAZA.grandpa.z, -Math.PI / 2);
  const waiter = person({ top: 0xf4f1ea, trousers: 0x1a1a1a, hair: 0x1a1a1a, hairStyle: 'short', prop: 'none' }, PLAZA.waiter.x, PLAZA.waiter.z, Math.PI);
  const regular = person({ top: 0x1fc9b7, trousers: 0x3d73c7, hair: 0xb08850, hairStyle: 'ponytail', prop: 'none' }, PLAZA.regular.x, PLAZA.regular.z, Math.PI);
  const butcherM = person({ top: 0xf4f1ea, trousers: 0x3d3d45, hair: 0x2a1d14, hairStyle: 'short', prop: 'none', height: 1.04 }, PLAZA.butcher.x, PLAZA.butcher.z, -Math.PI / 2);
  // The butcher's red apron.
  const apron = box(0.42, 0.62, 0.04, M(0xc23b32, 0.7));
  apron.position.set(0.14, 0.95, 0);
  apron.rotation.y = Math.PI / 2;
  butcherM.group.add(apron);

  // ---- Props: the newspaper, the frisbee, the botifarra ----------------------------
  const paperM = add(new THREE.Group());
  { const p = box(0.34, 0.06, 0.24, M(0xeeeae0, 0.9)); p.position.y = 0.03; paperM.add(p); const band = box(0.36, 0.065, 0.04, M(0xc23b32, 0.8)); band.position.y = 0.03; paperM.add(band); }
  const paper = { x: PLAZA.paper.x, z: PLAZA.paper.z, held: false };
  const frisM = add(cyl(0.16, 0.16, 0.04, M(0xffb020, 0.5), 16));
  const fris = { x: PLAZA.regular.x + 0.4, z: PLAZA.regular.z, y: Y + 1.0, held: false, inHand: true, flight: null as null | { t: number; dur: number; x0: number; z0: number; x1: number; z1: number }, throwT: 0, count: 0 };
  const botiM = add(cyl(0.05, 0.05, 0.5, M(0x7a2a22, 0.6), 8));
  botiM.rotation.z = Math.PI / 2;
  const boti = { onCounter: true, held: false, x: 0, z: 0, restockT: 0, eaten: false };
  const counterPos = { x: (PLAZA.stall.x0 + PLAZA.stall.x1) / 2, z: PLAZA.stall.z0 + 0.35 };

  // ---- Terrace pigeons ---------------------------------------------------------------
  const pigeons = PLAZA.tables.map(([tx, tz], i) => {
    const b = makeBird('pigeon');
    add(b.group);
    const hx = tx + (i % 2 ? 0.25 : -0.2), hz = tz + 0.15, hy = Y + 0.78;
    return { b, hx, hz, hy, x: hx, z: hz, y: hy, vx: 0, vy: 0, vz: 0, fly: 0, gone: false };
  });
  const scare = (forGood: boolean) => {
    for (const p of pigeons) {
      if (p.fly > 0 || p.gone) continue;
      const a = rand(0, Math.PI * 2);
      p.vx = Math.cos(a) * rand(2, 4); p.vz = Math.sin(a) * rand(2, 4) + 2; p.vy = rand(3, 5);
      p.fly = forGood ? 99 : 7; // the ones only startled come back after a while
      p.gone = forGood;
    }
    audio.flutter();
  };
  const inTerrace = (x: number, z: number) => x > PLAZA.terrace.x0 && x < PLAZA.terrace.x1 && z > PLAZA.terrace.z0 && z < PLAZA.terrace.z1;
  const terraceCenter = { x: (PLAZA.terrace.x0 + PLAZA.terrace.x1) / 2, z: (PLAZA.terrace.z0 + PLAZA.terrace.z1) / 2 };
  let terraceGrumbleT = 0;

  // ---- The butcher and the chase -------------------------------------------------------
  const S = PLAZA.stall;
  const exitPath: [number, number][] = [[S.x1 + 0.7, PLAZA.butcher.z], [S.x1 + 0.7, S.z0 - 0.9]];
  const butcher = { x: PLAZA.butcher.x, z: PLAZA.butcher.z, heading: -Math.PI / 2, state: 'stall' as 'stall' | 'exit' | 'chase' | 'return', wp: 0, speed: 0, stuckT: 0 };
  let chase: null | { t: number; speed: number } = null;
  const endChase = (outcome: 'escaped' | 'caught' | 'dropped') => {
    if (!chase) return;
    chase = null;
    ctx.chaseEnded();
    butcher.state = 'return';
    butcher.wp = 0;
    if (outcome === 'escaped') {
      dog.carrying = null;
      boti.held = false; boti.eaten = true; boti.restockT = 20;
      hud.shout('NOM NOM!', 'good');
      ctx.burst(dog.x, dog.y + 0.5, dog.z, 0x7a2a22, 12, 1.5, 2, 0.6, 6);
      ctx.addBones(6);
      ctx.completeGoal('butcher');
      say('butcher', 'Gossa lladre!', 1.8, 'loud');
      ctx.humanSay('Millie! That was not ours!', 1.8);
    } else if (outcome === 'caught') {
      dog.carrying = null;
      boti.held = false; boti.onCounter = false; boti.restockT = 2;
      hud.shout('CAUGHT!', 'bad');
      say('butcher', 'Això és meu!', 1.8, 'loud');
      ctx.humanSay('Sorry, sorry!', 1.6);
    } else {
      hud.shout('DROPPED IT!', 'bad');
      say('butcher', 'Gràcies, eh!', 1.6);
      boti.held = false; boti.onCounter = false; boti.restockT = 2;
    }
  };
  const grab = () => {
    if (!ctx.chaseFree()) { say('butcher', 'Ara no, bonica.', 1.4, 'paper', 3); return false; }
    boti.onCounter = false; boti.held = true;
    dog.carrying = 'botifarra';
    chase = { t: 0, speed: 2.4 };
    butcher.state = 'exit'; butcher.wp = 0; butcher.stuckT = 0;
    hud.shout('BOTIFARRA!', 'loud');
    say('butcher', 'Ep! La meva botifarra!', 1.8, 'loud');
    hud.toast('Chase', 'The butcher wants it back: run down Carrer Major!', '#ff6b5a');
    ctx.humanSay('Millie, no!', 1.4, 'loud');
    audio.hey();
    return true;
  };

  // The district's open spaces: the square, the two alleys beside the market and Carrer Major.
  // Chasing between them goes through the alley mouths rather than through the market hall.
  type Area = 'square' | 'alleyW' | 'alleyE' | 'street' | 'out';
  const areaOf = (p: P): Area => {
    if (p.z < PLAZA.market.z0) return p.z >= PLAZA.square.z0 - 6 ? 'square' : 'out';
    if (p.z >= PLAZA.street.z0) return 'street';
    return p.x < 0 ? 'alleyW' : 'alleyE';
  };
  const ALLEY_X = (PLAZA.square.x1 + PLAZA.market.x1) / 2; // 17
  const routeTo = (from: P, to: P): P => {
    const a = areaOf(from), b = areaOf(to);
    if (a === b || a === 'out' || b === 'out') return to;
    const side = (p: P) => (p.x < 0 ? -1 : 1);
    if (a === 'square') return { x: side(to) * ALLEY_X, z: PLAZA.market.z0 - 1 };
    if (a === 'street') return { x: side(b === 'street' ? from : to) * ALLEY_X, z: PLAZA.street.z0 - 1 };
    // In an alley: out the far end toward Millie.
    return b === 'street' ? { x: side(from) * ALLEY_X, z: PLAZA.street.z0 + 1.5 } : { x: side(from) * ALLEY_X, z: PLAZA.market.z0 - 1.5 };
  };

  // Walk a person toward (tx, tz) at `speed`, sliding around buildings.
  const stepToward = (p: { x: number; z: number; heading: number; stuckT: number }, tx: number, tz: number, speed: number, dt: number) => {
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return 0;
    const step = Math.min(d, speed * dt);
    let ux = dx / d, uz = dz / d;
    // Stuck on a corner: sidestep for a moment.
    if (p.stuckT > 0.4) { const s = Math.sin(p.stuckT * 3) > 0 ? 1 : -1; [ux, uz] = [ux * 0.4 - uz * s, uz * 0.4 + ux * s]; }
    const x0 = p.x, z0 = p.z;
    p.x += ux * step; p.z += uz * step;
    ctx.collide(p, 0.3, Y);
    const moved = Math.hypot(p.x - x0, p.z - z0);
    p.stuckT = moved < step * 0.3 ? p.stuckT + dt : Math.max(0, p.stuckT - dt * 2);
    if (p.stuckT > 1.4) p.stuckT = 0;
    p.heading = angLerp(p.heading, Math.atan2(uz, ux), Math.min(1, dt * 10));
    return moved / Math.max(dt, 1e-4);
  };

  // ---- Fetch ---------------------------------------------------------------------------
  const throwFrisbee = () => {
    const pp = PLAZA.pipica;
    let tx = 0, tz = 0;
    for (let k = 0; k < 8; k++) {
      tx = rand(pp.x0 + 1.5, pp.x1 - 1.5); tz = rand(pp.z0 + 1.5, pp.z1 - 1.5);
      if (Math.hypot(tx - PLAZA.regular.x, tz - PLAZA.regular.z) > 4) break;
    }
    fris.inHand = false;
    fris.flight = { t: 0, dur: 1.1, x0: PLAZA.regular.x + 0.4, z0: PLAZA.regular.z, x1: tx, z1: tz };
    audio.whoosh(1.2);
  };

  // ---- Per-frame ---------------------------------------------------------------------
  let clock = 0;
  let regularPose: 'stand' | 'walk' = 'stand';
  const update = (dt: number, time: number) => {
    clock += dt;
    for (const k in saidT) saidT[k] -= dt;
    const near = dist(dog, PLAZA.center) < VIEW || chase !== null;
    for (const o of all) o.visible = near;
    if (!near) return;

    // People idling.
    vendor.animate(time, { speed: 0, pose: 'stand' });
    grandpa.animate(time, { speed: 0, pose: 'sit' });
    waiter.animate(time, { speed: 0, pose: 'stand' });
    regular.animate(time, { speed: 0, pose: regularPose });
    regularPose = 'stand';

    // Newspaper.
    if (paper.held) { const m = mouth(); paperM.position.set(m.x, m.y - 0.05, m.z); paperM.rotation.y = -dog.heading; }
    else paperM.position.set(paper.x, Y, paper.z);
    paperM.visible = near && !quests.paper;
    if (!quests.paper) {
      if (dist(dog, K) < 4 && !paper.held) say('vendor', 'El diari per a l\'avi del banc!', 2, 'paper', 9);
      if (dist(dog, PLAZA.grandpa) < 6 && !paper.held) say('grandpa', 'On és el meu diari?', 1.8, 'paper', 10);
    }

    // Terrace pigeons.
    for (const p of pigeons) {
      if (p.fly > 0) {
        p.fly -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vy -= 0.6 * dt;
        p.b.wings.forEach((w, k) => { w.rotation.x = Math.sin(time * 28 + k * Math.PI) * 0.9; });
        p.b.group.rotation.y = -Math.atan2(p.vz, p.vx);
        if (p.y > Y + 40) { if (p.gone) p.fly = 0; p.b.group.visible = false; }
      } else if (!p.gone) {
        p.x = p.hx; p.z = p.hz; p.y = p.hy + Math.abs(Math.sin(time * 3 + p.hx)) * 0.03;
        p.b.group.visible = true;
        p.b.wings.forEach((w) => { w.rotation.x = 0; });
        if (Math.random() < dt * 0.4) p.b.group.rotation.y = rand(0, 6.28);
      }
      p.b.group.position.set(p.x, p.y, p.z);
      if (p.gone && p.fly <= 0) p.b.group.visible = false;
      else if (p.fly > 0 && p.y > Y + 40) p.b.group.visible = false;
    }
    if (!quests.terrace) {
      const sp = Math.hypot(dog.vx, dog.vz);
      if (inTerrace(dog.x, dog.z) && sp > 3.2 && pigeons.some((p) => p.fly <= 0)) {
        scare(false);
        say('waiter', 'Ep! Compte amb les cadires!', 1.8, 'loud');
        terraceGrumbleT = 3;
      } else if (dist(dog, terraceCenter) < 9 && pigeons.some((p) => p.fly <= 0)) {
        say('waiter', 'Aquests coloms... Fora d\'aquí!', 2, 'paper', 12);
      }
    }
    if (terraceGrumbleT > 0) terraceGrumbleT -= dt;

    // Fetch in the second pipicà.
    const inPip = inPlazaPipica(dog.x, dog.z);
    if (fris.flight) {
      const f = fris.flight;
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      fris.x = f.x0 + (f.x1 - f.x0) * k; fris.z = f.z0 + (f.z1 - f.z0) * k;
      fris.y = Y + 1.0 + Math.sin(Math.PI * k) * 1.6 - k * 0.95;
      frisM.rotation.y += dt * 18;
      if (k >= 1) { fris.flight = null; fris.y = Y + 0.03; }
    } else if (fris.held) {
      const m = mouth(); fris.x = m.x; fris.z = m.z; fris.y = m.y - 0.05;
      if (!inPip || !ctx.offLeash()) { // took it out of the park: the regular gets it back
        fris.held = false; dog.carrying = null; fris.inHand = true;
        say('regular', 'Ei, el meu frisbi!', 1.6);
      }
    } else if (fris.inHand) {
      fris.x = PLAZA.regular.x + 0.35; fris.z = PLAZA.regular.z - 0.2; fris.y = Y + 1.0;
      if (inPip && ctx.offLeash()) {
        fris.throwT -= dt;
        if (fris.throwT <= 0) {
          if (fris.count === 0) say('regular', 'Vols jugar? Agafa!', 1.6, 'paper', 20);
          throwFrisbee();
        }
      } else fris.throwT = 0.8;
    }
    frisM.position.set(fris.x, fris.y, fris.z);

    // The butcher.
    if (boti.restockT > 0 && butcher.state === 'stall') {
      boti.restockT -= dt;
      if (boti.restockT <= 0) { boti.onCounter = true; boti.eaten = false; }
    }
    if (chase) {
      chase.t += dt;
      chase.speed = Math.min(3.6, 2.2 + chase.t * 0.3); // a touch faster than the human can drag along
      if (butcher.state === 'exit') {
        const [tx, tz] = exitPath[butcher.wp];
        butcher.speed = stepToward(butcher, tx, tz, chase.speed, dt);
        if (Math.hypot(tx - butcher.x, tz - butcher.z) < 0.3) { butcher.wp++; if (butcher.wp >= exitPath.length) butcher.state = 'chase'; }
      } else if (butcher.state === 'chase') {
        const goal = boti.held ? dog : { x: boti.x, z: boti.z };
        const target = routeTo(butcher, goal);
        butcher.speed = stepToward(butcher, target.x, target.z, chase.speed, dt);
        if (boti.held) {
          const d = dist(butcher, dog);
          if (d < 0.9) endChase('caught');
          else if (d > 20) { hud.shout('LOST HIM!', 'good'); endChase('escaped'); }
          else if (chase.t > 25) { hud.shout('HE GAVE UP!', 'good'); endChase('escaped'); }
          else if (Math.random() < dt * 0.4) say('butcher', Math.random() < 0.5 ? 'Atura\'t, gossa!' : 'La botifarra!', 1.2, 'loud');
        } else if (dist(butcher, boti) < 0.6) endChase('dropped');
      }
    } else if (butcher.state === 'return') {
      // Back round the front of the counter, along it, then in behind it to his spot.
      const front = { x: S.x1 + 0.7, z: S.z0 - 1.2 };
      const path: P[] = [front, { x: S.x1 + 0.7, z: PLAZA.butcher.z }, { x: PLAZA.butcher.x, z: PLAZA.butcher.z }];
      let tgt = path[Math.min(butcher.wp, path.length - 1)];
      if (butcher.wp === 0) {
        tgt = routeTo(butcher, front);
        // Beside or behind the stall's west end: step out in front of it first.
        if (butcher.z > S.z0 - 1.0 && butcher.x < S.x1 + 0.4) tgt = { x: butcher.x, z: front.z };
      }
      butcher.speed = stepToward(butcher, tgt.x, tgt.z, 1.6, dt);
      const atWp = Math.hypot(path[butcher.wp].x - butcher.x, path[butcher.wp].z - butcher.z) < 0.35;
      if (atWp) {
        butcher.wp++;
        if (butcher.wp >= path.length) { butcher.state = 'stall'; butcher.heading = -Math.PI / 2; butcher.speed = 0; }
      }
    } else butcher.speed = 0;
    butcherM.group.position.set(butcher.x, Y, butcher.z);
    butcherM.group.rotation.y = -butcher.heading;
    butcherM.animate(time + 3, { speed: butcher.speed, pose: butcher.speed > 0.2 ? 'walk' : 'stand' });
    if (butcher.state === 'stall' && dist(dog, PLAZA.grab) < 3 && boti.onCounter) say('butcher', 'Botifarra fresca!', 1.6, 'paper', 12);

    // The botifarra itself.
    if (boti.held) { const m = mouth(); botiM.position.set(m.x, m.y, m.z); botiM.rotation.y = -dog.heading + Math.PI / 2; }
    else if (boti.onCounter) { botiM.position.set(counterPos.x, Y + 1.06, counterPos.z); botiM.rotation.y = 0; }
    else if (chase) botiM.position.set(boti.x, Y + 0.05, boti.z);
    botiM.visible = near && (boti.held || boti.onCounter || chase !== null);
  };

  /** G with nothing in her mouth: a plaza thing to pick up? */
  const pickup = () => {
    if (dog.carrying) return false;
    if (!quests.paper && !paper.held && dist(dog, paper) < 1.0) {
      paper.held = true; dog.carrying = 'paper'; audio.pickup();
      hud.banner('Take the newspaper to the grandpa on the bench', 'news');
      return true;
    }
    if (!fris.held && !fris.inHand && !fris.flight && dist(dog, fris) < 1.0) {
      fris.held = true; dog.carrying = 'frisbee'; audio.pickup();
      return true;
    }
    if (boti.onCounter && dist(dog, PLAZA.grab) < 1.4) return grab();
    return false;
  };

  /** G with a plaza thing in her mouth: drop it (maybe where it's wanted). */
  const drop = (fx: number, fz: number) => {
    const c = dog.carrying;
    if (!isPlazaItem(c)) return false;
    dog.carrying = null;
    audio.click();
    if (c === 'paper') {
      paper.held = false; paper.x = fx; paper.z = fz;
      if (Math.hypot(fx - PLAZA.grandpa.x, fz - PLAZA.grandpa.z) < 2.6) {
        say('grandpa', 'Moltes gràcies, bonica!', 2.2, 'win');
        finish('paper', 'PAPER DELIVERED', 4);
      }
    } else if (c === 'frisbee') {
      fris.held = false; fris.x = fx; fris.z = fz; fris.y = Y + 0.03;
      if (Math.hypot(fx - PLAZA.regular.x, fz - PLAZA.regular.z) < 2.4) {
        fris.inHand = true; fris.count++; fris.throwT = 1.2;
        if (fris.count >= 3 && !quests.fetch) { say('regular', 'Quina campiona!', 2, 'win'); finish('fetch', 'GOOD FETCH', 4); }
        else { say('regular', fris.count > 3 ? 'Una altra!' : 'Bona gossa!', 1.2, 'win'); if (quests.fetch) ctx.addBones(1); }
      }
    } else {
      boti.held = false; boti.x = fx; boti.z = fz;
    }
    return true;
  };

  /** E: barking at the terrace pigeons from outside the tables clears them for good. */
  const bark = () => {
    if (quests.terrace) return;
    if (dist(dog, terraceCenter) > 8 || !pigeons.some((p) => p.fly <= 0 && !p.gone)) return;
    if (inTerrace(dog.x, dog.z)) {
      scare(false);
      say('waiter', 'Des de fora, si us plau!', 1.8, 'loud');
      return;
    }
    scare(true);
    say('waiter', 'Gràcies! Un cafè a la teva salut!', 2.2, 'win');
    finish('terrace', 'TERRACE CLEARED', 4);
  };

  /** What G would do near here, for the prompt pills. */
  const prompt = (): string | null => {
    if (dog.carrying) return null;
    if (!quests.paper && !paper.held && dist(dog, paper) < 1.0) return 'Pick up the newspaper';
    if (!fris.held && !fris.inHand && !fris.flight && dist(dog, fris) < 1.0) return 'Pick up the frisbee';
    if (boti.onCounter && dist(dog, PLAZA.grab) < 1.4) return 'Snatch the botifarra';
    return null;
  };

  /** R: put the props back (quests stay done). */
  const reset = () => {
    if (chase) { chase = null; ctx.chaseEnded(); }
    butcher.x = PLAZA.butcher.x; butcher.z = PLAZA.butcher.z; butcher.state = 'stall'; butcher.heading = -Math.PI / 2;
    boti.held = false; boti.onCounter = true; boti.restockT = 0;
    paper.held = false; paper.x = PLAZA.paper.x; paper.z = PLAZA.paper.z;
    fris.held = false; fris.flight = null; fris.inHand = true; fris.throwT = 0.8;
  };

  return {
    update, pickup, drop, bark, prompt, reset,
    chasing: () => chase !== null,
    quests: () => ({ ...quests }),
    bubbles: () => [
      { id: 'vendor', x: vendor.group.position.x, y: Y + 2.1, z: vendor.group.position.z },
      { id: 'grandpa', x: PLAZA.grandpa.x, y: Y + 1.6, z: PLAZA.grandpa.z },
      { id: 'waiter', x: PLAZA.waiter.x, y: Y + 2.1, z: PLAZA.waiter.z },
      { id: 'regular', x: PLAZA.regular.x, y: Y + 2.1, z: PLAZA.regular.z },
      { id: 'butcher', x: butcher.x, y: Y + 2.2, z: butcher.z },
    ],
    /** For tests. */
    debug: { butcher, boti, fris, paper, pigeons },
  };
}

export type PlazaLife = ReturnType<typeof createPlazaLife>;
