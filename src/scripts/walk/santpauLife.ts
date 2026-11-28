/*
  Sant Pau i Prim at runtime: the neighbor's blown-away bedsheet, the accordion player in
  the Placeta, the knife sharpener's whistle on Carrer de Prim, the eighth pipicà's
  resident dog, and runaway butane bottles rolling down Carrer de Sant Pau.
*/
import * as THREE from 'three';
import { makePerson, makeDog, M, box, cyl, shadowed } from './models';
import { collapseRig } from './bake';
import { SANTPAU } from './santpau';
import { SANTPAU_GROUND_Y, SANTPAU_STREET, inSantPauPipica } from './santpauGeom';
import {
  BottleRushState, BOTTLE_LANES, BOTTLE_START_Z, BOTTLE_END_Z, BOTTLE_TRIGGER,
  EsmoletState, ESMOLET_BARK_R, ListenState, LISTEN_R, LISTEN_TIME,
} from './santpauLogic';
import type { Hud } from './hud';
import type { WalkAudio } from './audio';
import type { FeelState, TelegraphPool } from './telegraph';

export type SantPauItem = 'santpauSheet';
export const isSantPauItem = (c: string | null): c is SantPauItem => c === 'santpauSheet';

type P = { x: number; z: number };

export interface SantPauCtx {
  scene: THREE.Scene;
  hud: Hud;
  audio: WalkAudio;
  telegraphs: TelegraphPool;
  feel: FeelState;
  dog: { x: number; y: number; z: number; vx: number; vz: number; heading: number; carrying: string | null };
  humanSay: (text: string, ttl?: number, tone?: 'paper' | 'win' | 'loud') => void;
  addBones: (n: number, why?: string) => void;
  completeGoal: (id: string) => void;
  bumpGoal: (id: string, n: number) => void;
  onDone?: (key: string) => void;
  burst: (x: number, y: number, z: number, color: number, n?: number, spd?: number, up?: number, life?: number, g?: number) => void;
  offLeash: () => boolean;
  canStartThreat?: () => boolean;
  onHitDog?: (vx: number, vz: number, vy?: number) => void;
}

const Y = SANTPAU_GROUND_Y;
const VIEW = 110;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);
const angLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

/** An orange butane bottle lying on its side, rolling along its axis. */
function makeButaneBottle() {
  const g = new THREE.Group();
  const holder = new THREE.Group();
  const body = cyl(0.16, 0.16, 0.62, M(0xe8741e, 0.45), 12);
  body.rotation.z = Math.PI / 2;
  const valve = cyl(0.05, 0.05, 0.1, M(0x2a2f3d, 0.5, 0.4), 8);
  valve.rotation.z = Math.PI / 2;
  valve.position.x = 0.36;
  holder.add(body, valve);
  g.add(holder);
  shadowed(g);
  g.visible = false;
  return { group: g, holder };
}

function makeSheet() {
  const g = new THREE.Group();
  const s = box(0.5, 0.12, 0.34, M(0xf4f1ea, 0.9));
  s.position.y = 0.06;
  const stripe = box(0.5, 0.125, 0.06, M(0x3d73c7, 0.8));
  stripe.position.set(0, 0.06, 0.1);
  g.add(s, stripe);
  shadowed(g);
  collapseRig(g);
  return g;
}

/** The knife sharpener's grinding cart: a small frame with a stone wheel. */
function makeGrinderCart() {
  const g = new THREE.Group();
  const frame = box(0.9, 0.08, 0.5, M(0x5a4636, 0.8));
  frame.position.y = 0.75;
  const wheel = cyl(0.42, 0.42, 0.06, M(0x2a2f3d, 0.6, 0.3), 14);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(-0.2, 0.42, 0.28);
  const stone = cyl(0.2, 0.2, 0.08, M(0xb9b4aa, 0.9), 12);
  stone.rotation.x = Math.PI / 2;
  stone.position.set(0.25, 0.95, 0);
  g.add(frame, wheel, stone);
  shadowed(g);
  collapseRig(g);
  return g;
}

/** Instantiates and updates Sant Pau i Prim's people, quests and the bottle rush. */
export function createSantPauLife(ctx: SantPauCtx) {
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

  const quests = { sheet: false, music: false, esmolet: false };
  let doneCount = 0;
  let romped = false;

  const finishQuest = (k: keyof typeof quests, msg: string, reward: number) => {
    if (quests[k]) return;
    quests[k] = true;
    doneCount++;
    ctx.onDone?.(`santpau:${k}`);
    ctx.addBones(reward, msg);
    ctx.bumpGoal('santpau_quests', doneCount);
  };

  const saidT: Record<string, number> = {};
  const say = (id: string, text: string, ttl = 2, tone: 'paper' | 'win' | 'loud' = 'paper', every = 0) => {
    if (every && (saidT[id] ?? 0) > 0) return;
    saidT[id] = every;
    hud.say(id, text, ttl, tone);
  };

  // ---- People ----
  const neighbor = person({ top: 0x9e4c47, trousers: 0x40455c, hair: 0xd8d8d8, hairStyle: 'bun', prop: 'none', height: 0.95 }, SANTPAU.neighbor.x, SANTPAU.neighbor.z, Math.PI);
  const musician = person({ top: 0x2a2f3d, trousers: 0x3a404c, hair: 0x6b4026, hairStyle: 'short', prop: 'none' }, SANTPAU.musician.x, SANTPAU.musician.z, -Math.PI / 2);
  const accordion = add(box(0.5, 0.42, 0.26, M(0xc93b32, 0.5)));
  accordion.position.set(SANTPAU.musician.x, Y + 0.95, SANTPAU.musician.z - 0.35);
  const esmolet = person({ top: 0x5f7a5a, trousers: 0x2a2f3d, hair: 0x8a8a8a, hairStyle: 'short', prop: 'none' }, SANTPAU.esmolet.x, SANTPAU.esmolet.z, 0);
  const cart = add(makeGrinderCart());
  cart.position.set(SANTPAU.esmolet.x + 1.1, Y, SANTPAU.esmolet.z);

  const PP = SANTPAU.pipica;
  const playmateM = makeDog({ fur: 0x2a2624, dark: 0x1a1816, muzzle: 0xc98b4a, paws: 0xc98b4a, collar: 0x1fc9b7, scale: 0.7, ears: 'prick' });
  add(collapseRig(playmateM.group));
  const playmate = { x: (PP.x0 + PP.x1) / 2, z: (PP.z0 + PP.z1) / 2, tx: PP.x0 + 3, tz: PP.z0 + 3, heading: 0, t: 1.0 };

  // ---- Props and state ----
  const sheetM = add(makeSheet());
  const sheet = { x: SANTPAU.sheetPos.x, z: SANTPAU.sheetPos.z, held: false };
  const listen = new ListenState();
  const sharpener = new EsmoletState();

  const bottles = new BottleRushState();
  const bottleMeshes = BOTTLE_LANES.map(() => {
    const m = makeButaneBottle();
    scene.add(m.group);
    return m;
  });
  let autoRushUsed = false;
  const startRush = (why: 'walk' | 'bark') => {
    bottles.start(dog.x);
    hud.shout('BOTTLES LOOSE!', 'loud');
    ctx.humanSay(why === 'walk' ? 'The butane van just dropped its whole load!' : 'Millie, watch the bottles!', 2.2, 'loud');
    hud.toast('Runaway butane bottles', 'They roll down both gutters. Keep to the middle of the street!', '#e8741e', 4);
    audio.whoosh(0.8);
    ctx.feel.kick(0.22);
  };

  const update = (dt: number, time: number) => {
    for (const k in saidT) saidT[k] -= dt;
    const near = dist(dog, SANTPAU.center) < VIEW;
    for (const o of all) o.visible = near;
    if (!near) {
      if (bottles.active) bottles.reset();
      for (const b of bottleMeshes) b.group.visible = false;
      return;
    }

    neighbor.animate(time, { speed: 0, pose: 'stand' });
    musician.animate(time + 0.7, { speed: 0, pose: 'stand' });
    esmolet.animate(time + 1.9, { speed: 0, pose: 'stand' });
    accordion.scale.x = 1 + Math.sin(time * 5) * 0.18;

    // Goal: a romp in the Placeta's pipicà.
    if (!romped && inSantPauPipica(dog.x, dog.z)) {
      romped = true;
      ctx.onDone?.('santpau:pipica');
      ctx.addBones(2, 'PLACETA ROMP');
      ctx.completeGoal('santpau_pipica');
    }

    // Quest 1: the bedsheet that blew off a balcony.
    if (!quests.sheet && !sheet.held && dist(dog, SANTPAU.neighbor) < 4.5) {
      say('neighbor', 'El vent se m’ha endut el llençol cap al carrer de Prim!', 2.6, 'paper', 10);
    }
    if (sheet.held) {
      const mp = mouth();
      sheetM.position.set(mp.x, mp.y - 0.12, mp.z);
      sheetM.rotation.y = -dog.heading;
    } else {
      sheetM.position.set(sheet.x, Y + (quests.sheet ? 0 : 0.02 + Math.sin(time * 3) * 0.03), sheet.z);
      sheetM.rotation.y = quests.sheet ? 0 : time * 0.6;
    }

    // Quest 2: sit by the accordion player.
    {
      const d = dist(dog, SANTPAU.musician);
      if (!quests.music && d < 6) say('musician', 'Seu una estona i et toco una havanera.', 2.4, 'paper', 12);
      if (listen.step(dt, d, Math.hypot(dog.vx, dog.vz))) {
        say('musician', 'Per a tu, gosseta!', 2.4, 'win');
        audio.chime();
        ctx.burst(SANTPAU.musician.x, Y + 1.8, SANTPAU.musician.z, 0xffc93c, 16, 2.2, 2.4, 0.7, 4);
        finishQuest('music', 'A TUNE FOR MILLIE', 4);
      }
      if (!quests.music && d <= LISTEN_R && listen.t > 0) {
        ctx.telegraphs.ring(SANTPAU.musician.x, Y + 0.05, SANTPAU.musician.z, LISTEN_R, clamp(listen.t / LISTEN_TIME, 0, 1), 0xffc93c);
      }
    }

    // Quest 3: the knife sharpener's whistle.
    if (!quests.esmolet) {
      if (sharpener.step(dt) && dist(dog, SANTPAU.esmolet) < 16) {
        say('esmolet', 'Fiu-fiu-fiuuu! L’esmolet!', 2.6, 'loud');
        audio.whoosh(0.4);
      }
      if (sharpener.whistling && dist(dog, SANTPAU.esmolet) < ESMOLET_BARK_R + 4) {
        ctx.telegraphs.ring(SANTPAU.esmolet.x, Y + 0.05, SANTPAU.esmolet.z, ESMOLET_BARK_R, 1, 0x5eea8c);
      }
    }

    // The eighth pipicà's resident dog.
    playmate.t -= dt;
    if (playmate.t <= 0) {
      playmate.t = rand(1.3, 3.4);
      playmate.tx = rand(PP.x0 + 1.4, PP.x1 - 1.4);
      playmate.tz = rand(PP.z0 + 1.4, PP.z1 - 1.4);
    }
    const pdx = playmate.tx - playmate.x, pdz = playmate.tz - playmate.z, pdd = Math.hypot(pdx, pdz);
    const psp = pdd > 0.4 ? (inSantPauPipica(dog.x, dog.z) && ctx.offLeash() ? 3.8 : 2.1) : 0;
    if (pdd > 0.4) {
      playmate.x += (pdx / pdd) * psp * dt;
      playmate.z += (pdz / pdd) * psp * dt;
      playmate.heading = angLerp(playmate.heading, Math.atan2(pdz, pdx), dt * 8);
    }
    playmateM.group.position.set(playmate.x, Y, playmate.z);
    playmateM.group.rotation.y = -playmate.heading;
    playmateM.animate(time + 3, { speed: psp, dig: false, peeing: false, wag: 0.9, air: false });

    // Chase: the first walk up Carrer de Sant Pau sets the bottles loose; after that, bark to start it.
    if (!autoRushUsed && !bottles.survivedOnce && bottles.canTrigger(dog, !(ctx.canStartThreat?.() ?? true))) {
      autoRushUsed = true;
      startRush('walk');
    }
    const ev = bottles.step(dt, dog);
    if (ev.startedRush) {
      audio.click();
      hud.shout('HERE THEY ROLL!', 'loud');
    }
    if (ev.nextWave) {
      hud.shout('MORE BOTTLES!', 'loud');
      audio.whoosh(0.9);
    }
    if (ev.hit) {
      const dx = dog.x - ev.hit.x;
      ctx.onHitDog?.((Math.abs(dx) > 0.15 ? Math.sign(dx) : 1) * 5.0, -3.6, 2.0);
      hud.flash('rgba(232, 116, 30, 0.34)');
      audio.whine();
      audio.stumble();
      ctx.feel.kick(0.34);
      ctx.feel.hitstop(0.08);
      ctx.burst(dog.x, dog.y + 0.45, dog.z, 0xe8741e, 14, 2.6, 2.4, 0.55, 5);
      hud.shout('BOTTLE BUMP!', 'bad');
    }
    if (ev.leftStreet) hud.shout('THE BOTTLES ROLL ON WITHOUT YOU', 'bad');
    if (ev.survived) {
      hud.shout('DODGED THE BOTTLES! +6', 'good');
      audio.goal();
      ctx.feel.kick(0.2);
      ctx.addBones(6);
      ctx.onDone?.('santpau:bottles');
      ctx.completeGoal('santpau_bottles');
      ctx.humanSay('Who stacks butane bottles at the top of a hill?', 2.2, 'win');
    }
    if (bottles.active) {
      for (let i = 0; i < bottles.bottles.length; i++) {
        const b = bottles.bottles[i];
        const bm = bottleMeshes[i];
        if (bottles.phase === 'warning') {
          const fill = clamp(bottles.t / Math.max(0.01, bottles.warnDur) - b.delay * 0.25, 0.08, 1);
          ctx.telegraphs.lane(b.x, BOTTLE_START_Z - 1, b.x, BOTTLE_END_Z, Y + 0.05, 1.3, fill, 0xff8a2a);
          bm.group.visible = true;
          bm.group.position.set(b.x, Y + 0.16, BOTTLE_START_Z);
          bm.group.rotation.set(0, Math.PI / 2, 0);
          bm.holder.rotation.x = Math.sin(time * 14 + i) * 0.1;
        } else if (b.active && !b.passed) {
          ctx.telegraphs.lane(b.x, b.z, b.x, BOTTLE_END_Z, Y + 0.05, 1.2, 0.9, 0xff6a1a);
          bm.group.visible = true;
          bm.group.position.set(b.x, Y + 0.16, b.z);
          bm.group.rotation.set(0, Math.PI / 2, 0);
          bm.holder.rotation.x = -b.roll;
        } else {
          bm.group.visible = false;
        }
      }
      ctx.telegraphs.beacon(SANTPAU_STREET.midX, Y + 0.06, 100, 1.1, time, 0x5eea8c);
    } else {
      for (const bm of bottleMeshes) bm.group.visible = false;
    }
  };

  const pickup = () => {
    if (!quests.sheet && !sheet.held && dist(dog, sheet) < 1.2) {
      sheet.held = true;
      dog.carrying = 'santpauSheet';
      audio.pickup();
      hud.banner('Take the bedsheet back to the neighbor on Carrer de Sant Pau', 'news');
      return true;
    }
    return false;
  };

  const drop = (fx: number, fz: number) => {
    if (!isSantPauItem(dog.carrying)) return false;
    sheet.held = false;
    sheet.x = fx;
    sheet.z = fz;
    if (!quests.sheet && dist({ x: fx, z: fz }, SANTPAU.neighbor) < 3.4) {
      sheet.x = SANTPAU.neighbor.x - 0.6;
      sheet.z = SANTPAU.neighbor.z;
      say('neighbor', 'El meu llençol! Que n’ets, d’espavilada.', 2.4, 'win');
      finishQuest('sheet', 'SHEET RETURNED', 4);
    }
    dog.carrying = null;
    audio.click();
    return true;
  };

  const inStreetTrigger = () =>
    dog.x >= SANTPAU_STREET.x0 && dog.x <= SANTPAU_STREET.x1 && dog.z >= BOTTLE_TRIGGER.z0 - 10 && dog.z <= BOTTLE_TRIGGER.z1;

  const bark = (): boolean => {
    if (dist(dog, SANTPAU.center) >= VIEW) return false;
    if (!quests.esmolet && sharpener.bark(dist(dog, SANTPAU.esmolet))) {
      say('esmolet', 'Ja surten! Gràcies, bonica.', 2.4, 'win');
      ctx.burst(SANTPAU.esmolet.x, Y + 1.6, SANTPAU.esmolet.z, 0x5eea8c, 12, 2.2, 2.0, 0.5, 5);
      audio.chime();
      finishQuest('esmolet', 'NEIGHBORS CALLED OUT', 4);
      return true;
    }
    if (!bottles.active && bottles.cooldown <= 0 && (ctx.canStartThreat?.() ?? true) && inStreetTrigger()) {
      startRush('bark');
      return true;
    }
    return false;
  };

  const prompt = (): string | null => {
    if (!quests.sheet && !sheet.held && !dog.carrying && dist(dog, sheet) < 1.2) return 'Pick up the bedsheet';
    return null;
  };

  const barkPrompt = (): string | null => {
    if (!quests.esmolet && sharpener.whistling && dist(dog, SANTPAU.esmolet) < ESMOLET_BARK_R) return 'Bark with the knife sharpener';
    if (!bottles.active && bottles.cooldown <= 0 && (ctx.canStartThreat?.() ?? true) && inStreetTrigger()) {
      return bottles.survivedOnce ? 'Rattle the bottles again' : 'Rattle the butane bottles';
    }
    return null;
  };

  const banner = (): string | null => (
    bottles.active ? `Runaway butane bottles (${bottles.wave}/${bottles.maxWaves}): keep to the middle of the street!` : null
  );

  const reset = () => {
    sheet.held = false;
    sheet.x = quests.sheet ? SANTPAU.neighbor.x - 0.6 : SANTPAU.sheetPos.x;
    sheet.z = quests.sheet ? SANTPAU.neighbor.z : SANTPAU.sheetPos.z;
    bottles.reset();
    autoRushUsed = false;
    for (const bm of bottleMeshes) bm.group.visible = false;
  };

  const restore = (doneKeys: ReadonlySet<string>) => {
    if (doneKeys.has('santpau:sheet')) {
      quests.sheet = true;
      sheet.x = SANTPAU.neighbor.x - 0.6;
      sheet.z = SANTPAU.neighbor.z;
    }
    if (doneKeys.has('santpau:music')) { quests.music = true; listen.done = true; }
    if (doneKeys.has('santpau:esmolet')) { quests.esmolet = true; sharpener.answered = true; }
    if (doneKeys.has('santpau:pipica')) romped = true;
    if (doneKeys.has('santpau:bottles')) bottles.survivedOnce = true;
    doneCount = Number(quests.sheet) + Number(quests.music) + Number(quests.esmolet);
  };

  return {
    update,
    pickup,
    drop,
    bark,
    prompt,
    barkPrompt,
    banner,
    reset,
    restore,
    busy: () => bottles.active,
    bottlesActive: () => bottles.active,
    quests: () => ({ ...quests }),
    bubbles: () => [
      { id: 'neighbor', x: SANTPAU.neighbor.x, y: Y + 2.0, z: SANTPAU.neighbor.z },
      { id: 'musician', x: SANTPAU.musician.x, y: Y + 2.1, z: SANTPAU.musician.z },
      { id: 'esmolet', x: SANTPAU.esmolet.x, y: Y + 2.1, z: SANTPAU.esmolet.z },
    ],
    debug: {
      bottles, sharpener, listen, sheet, playmate,
      get romped() { return romped; },
    },
  };
}

export type SantPauLife = ReturnType<typeof createSantPauLife>;
