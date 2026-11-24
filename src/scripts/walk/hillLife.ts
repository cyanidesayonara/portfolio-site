/*
  Dalt de la Vila at runtime: the museum guide, the church caretaker, a swinging
  bronze bell in the tower, hilltop pigeons, a playful dog in the third pipicà,
  two hilltop quests (ring the church bells, pause at the mirador) and the
  generic home door finish line.
*/
import * as THREE from 'three';
import { makePerson, makeDog, makeBird, M, cyl } from './models';
import { collapseRig } from './bake';
import { HILL, inHillPipica } from './hill';
import type { Hud } from './hud';
import type { WalkAudio } from './audio';

type P = { x: number; z: number };

export interface HillCtx {
  scene: THREE.Scene;
  hud: Hud;
  audio: WalkAudio;
  dog: { x: number; y: number; z: number; vx: number; vz: number };
  humanSay: (text: string, ttl?: number, tone?: 'paper' | 'win' | 'loud') => void;
  addBones: (n: number, why?: string) => void;
  completeGoal: (id: string) => void;
  bumpGoal: (id: string, n: number) => void;
  onDone?: (key: string) => void;
  burst: (x: number, y: number, z: number, color: number, n?: number, spd?: number, up?: number, life?: number, g?: number) => void;
  offLeash: () => boolean;
}

const VIEW = 85;
const MID_Y = HILL.midY;
const TOP_Y = HILL.topY;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);
const angLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export function createHillLife(ctx: HillCtx) {
  const { scene, hud, audio, dog } = ctx;
  const all: THREE.Object3D[] = [];
  const add = <T extends THREE.Object3D>(o: T) => { scene.add(o); all.push(o); return o; };
  const person = (look: Parameters<typeof makePerson>[0], x: number, y: number, z: number, heading: number) => {
    const m = makePerson(look);
    m.group.position.set(x, y, z);
    m.group.rotation.y = -heading;
    add(collapseRig(m.group));
    return m;
  };

  const quests = { bell: false, mirador: false };
  let doneCount = 0;
  let homeDone = false;
  let miradorT = 0;
  let bellRingT = 0;

  const finishQuest = (k: keyof typeof quests, msg: string, reward: number) => {
    if (quests[k]) return;
    quests[k] = true;
    doneCount++;
    ctx.onDone?.(`hill:${k}`);
    ctx.addBones(reward, msg);
    ctx.bumpGoal('hill_quests', doneCount);
  };

  const saidT: Record<string, number> = {};
  const say = (id: string, text: string, ttl = 2, tone: 'paper' | 'win' | 'loud' = 'paper', every = 0) => {
    if (every && (saidT[id] ?? 0) > 0) return;
    saidT[id] = every;
    hud.say(id, text, ttl, tone);
  };

  // ---- People ----
  const guide = person(
    { top: 0x3d73c7, trousers: 0x2a2f3d, hair: 0x6b4026, hairStyle: 'bun', prop: 'none' },
    HILL.guide.x, MID_Y, HILL.guide.z, Math.PI,
  );
  const caretaker = person(
    { top: 0x6b5a48, trousers: 0x40455c, hair: 0xd8d8d8, hairStyle: 'short', prop: 'none', height: 0.96 },
    HILL.caretaker.x, TOP_Y, HILL.caretaker.z, -Math.PI / 2,
  );
  const miradorLocal = person(
    { top: 0x9e4c47, trousers: 0x2a2f3d, hair: 0x8a8a8a, hairStyle: 'short', prop: 'coffee', height: 0.96 },
    17.5, TOP_Y, 219.6, -Math.PI / 2,
  );
  const squareLocal = person(
    { top: 0x667a5c, trousers: 0x6b5a48, hair: 0x2a1d14, hairStyle: 'ponytail', prop: 'phone', height: 0.98 },
    15.4, TOP_Y, 224.0, Math.PI,
  );

  // ---- Animated bronze church bell ----
  const bellPivot = add(new THREE.Group());
  bellPivot.position.set(HILL.bellPos.x, TOP_Y + 22.4, 232.45);
  {
    const bronze = M(0x9a7538, 0.35, 0.75);
    const body = cyl(0.28, 0.52, 0.82, bronze, 14);
    body.position.y = -0.52;
    bellPivot.add(body);
    const rim = cyl(0.56, 0.58, 0.14, bronze, 14);
    rim.position.y = -0.94;
    bellPivot.add(rim);
  }

  // ---- Hilltop pigeons ----
  const pigeonSpots: [number, number][] = [[-3, 229], [-1.5, 228.4], [2.5, 229.2], [4.0, 228.5]];
  const pigeons = pigeonSpots.map(([hx, hz]) => {
    const b = makeBird('pigeon');
    add(b.group);
    return { b, hx, hz, hy: TOP_Y, x: hx, z: hz, y: TOP_Y, vx: 0, vy: 0, vz: 0, fly: 0 };
  });
  const scatterPigeons = () => {
    let any = false;
    for (const p of pigeons) {
      if (p.fly > 0) continue;
      const a = rand(0, Math.PI * 2);
      p.vx = Math.cos(a) * rand(2.5, 4.5);
      p.vz = Math.sin(a) * rand(2.5, 4.5) - 1;
      p.vy = rand(3.5, 5.5);
      p.fly = 6;
      any = true;
    }
    if (any) {
      audio.flutter();
      ctx.completeGoal('birds');
    }
  };

  // ---- Pigeons wheeling around the bell tower ----
  const wheel = Array.from({ length: 6 }, (_, i) => {
    const b = makeBird('pigeon');
    add(b.group);
    return { b, a: (i / 6) * Math.PI * 2, r: rand(5.5, 9), h: rand(17, 24), w: rand(0.45, 0.7) * (i % 2 ? 1 : -1), bob: rand(0, 6) };
  });

  // ---- Free dog in the third pipicà ----
  const parkDogM = makeDog({
    fur: 0xd8a866, dark: 0x8a5a2a, muzzle: 0xf4e4c8, paws: 0xf4efe2, collar: 0xe5487a, scale: 0.78, ears: 'drop',
  });
  add(collapseRig(parkDogM.group));
  const PP = HILL.pipica;
  const parkDog = {
    x: (PP.x0 + PP.x1) / 2,
    z: (PP.z0 + PP.z1) / 2,
    tx: PP.x0 + 3,
    tz: PP.z0 + 3,
    heading: 0,
    t: 1.5,
  };

  // ---- Per-frame ----
  const inMirador = (x: number, z: number) =>
    x >= HILL.mirador.x0 && x <= HILL.mirador.x1 && z >= HILL.mirador.z0 && z <= HILL.mirador.z1;

  const update = (dt: number, time: number) => {
    for (const k in saidT) saidT[k] -= dt;
    const near = dist(dog, HILL.center) < VIEW;
    for (const o of all) o.visible = near;
    if (!near) return;

    guide.animate(time, { speed: 0, pose: 'stand' });
    caretaker.animate(time + 1, { speed: 0, pose: 'stand' });
    miradorLocal.animate(time + 2, { speed: 0, pose: 'sit' });
    squareLocal.animate(time + 3, { speed: 0, pose: 'sit' });

    if (dist(dog, HILL.guide) < 4.5 && dog.y >= MID_Y - 1 && dog.y < TOP_Y - 1) {
      say('guide', 'Benvinguts al Museu! A dalt hi ha l\'Església.', 2.2, 'paper', 14);
    }
    if (dist(dog, HILL.caretaker) < 5.0 && dog.y >= TOP_Y - 1 && !quests.bell) {
      say('caretaker', 'Quines vistes des d\'aquí dalt!', 2.0, 'paper', 14);
    }
    if (dist(dog, { x: 17.5, z: 219.7 }) < 3.5 && dog.y >= TOP_Y - 1) {
      say('miradorLocal', 'Es veu tot el mar des d\'aquí!', 2.0, 'paper', 16);
    }

    // Bell swing.
    if (bellRingT > 0) {
      bellRingT = Math.max(0, bellRingT - dt);
      bellPivot.rotation.x = Math.sin(time * 9.5) * 0.48 * Math.min(1, bellRingT);
    } else {
      bellPivot.rotation.x = 0;
    }

    // Hilltop pigeons.
    if (dog.y >= TOP_Y - 1 && Math.hypot(dog.vx, dog.vz) > 2.8 && pigeons.some((p) => p.fly <= 0 && dist(dog, p) < 2.2)) {
      scatterPigeons();
    }
    for (const p of pigeons) {
      if (p.fly > 0) {
        p.fly -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 0.7 * dt;
        p.b.wings.forEach((w, k) => { w.rotation.x = Math.sin(time * 28 + k * Math.PI) * 0.9; });
        p.b.group.rotation.y = -Math.atan2(p.vz, p.vx);
        if (p.fly <= 0) {
          p.x = p.hx; p.z = p.hz; p.y = p.hy;
        }
      } else {
        p.x = p.hx; p.z = p.hz; p.y = p.hy + Math.abs(Math.sin(time * 3 + p.hx)) * 0.03;
        p.b.wings.forEach((w) => { w.rotation.x = 0; });
        if (Math.random() < dt * 0.4) p.b.group.rotation.y = rand(0, 6.28);
      }
      p.b.group.position.set(p.x, p.y, p.z);
    }

    // Tower pigeons: lazy circles round the campanar, faster for a while after the bell.
    const rush = bellRingT > 0 ? 2.2 : 1;
    for (const p of wheel) {
      p.a += p.w * rush * dt;
      const x = HILL.bellPos.x + Math.cos(p.a) * p.r;
      const z = HILL.bellPos.z + Math.sin(p.a) * p.r;
      const y = TOP_Y + p.h + Math.sin(time * 0.8 + p.bob) * 0.8;
      p.b.group.position.set(x, y, z);
      // Face along the circle (tangent), wings beating.
      p.b.group.rotation.y = -(p.a + (p.w > 0 ? Math.PI / 2 : -Math.PI / 2));
      p.b.wings.forEach((w, k) => { w.rotation.x = Math.sin(time * 16 + p.bob + k * Math.PI) * 0.8; });
    }

    // Free dog in pipica3.
    parkDog.t -= dt;
    if (parkDog.t <= 0) {
      parkDog.t = rand(1.4, 3.6);
      parkDog.tx = rand(PP.x0 + 1.4, PP.x1 - 1.4);
      parkDog.tz = rand(PP.z0 + 1.4, PP.z1 - 1.4);
    }
    const pdx = parkDog.tx - parkDog.x, pdz = parkDog.tz - parkDog.z, pdd = Math.hypot(pdx, pdz);
    const psp = pdd > 0.4 ? (inHillPipica(dog.x, dog.z) && ctx.offLeash() ? 3.8 : 2.2) : 0;
    if (pdd > 0.4) {
      parkDog.x += (pdx / pdd) * psp * dt;
      parkDog.z += (pdz / pdd) * psp * dt;
      parkDog.heading = angLerp(parkDog.heading, Math.atan2(pdz, pdx), dt * 8);
    }
    parkDogM.group.position.set(parkDog.x, MID_Y, parkDog.z);
    parkDogM.group.rotation.y = -parkDog.heading;
    parkDogM.animate(time + 2, { speed: psp, dig: false, peeing: false, wag: 0.8, air: false });

    // Mirador overlook quest: pause briefly along the balustrade overlooking the sea.
    if (!quests.mirador && dog.y >= TOP_Y - 1 && inMirador(dog.x, dog.z) && Math.hypot(dog.vx, dog.vz) < 0.8) {
      miradorT += dt;
      if (miradorT >= 1.2) {
        ctx.humanSay('You can see the whole seafront from here!', 2.4, 'win');
        finishQuest('mirador', 'MIRADOR VIEW', 4);
      }
    } else if (!quests.mirador) {
      miradorT = Math.max(0, miradorT - dt);
    }

    // Generic Home door finish line.
    if (!homeDone && dog.y >= TOP_Y - 1 && dist(dog, HILL.home) < 2.2) {
      homeDone = true;
      ctx.onDone?.('hill:home');
      hud.shout('HOME SWEET HOME', 'good');
      ctx.humanSay('What a walk! Time for dinner.', 2.6, 'win');
      ctx.addBones(10);
      ctx.burst(HILL.home.x, TOP_Y + 1.2, HILL.home.z, 0xffb020, 22, 3, 4, 0.9, 6);
      audio.goal();
      ctx.completeGoal('hill_top');
    }
  };

  /** E: barking by the church portal rings the belfry bell, and barks near hilltop pigeons scatter them. */
  const bark = () => {
    if (dog.y < TOP_Y - 1) return;
    if (pigeons.some((p) => p.fly <= 0 && dist(dog, p) < 7)) scatterPigeons();
    if (dist(dog, HILL.portal) > 7) return;
    bellRingT = 4.2;
    audio.chime();
    if (!quests.bell) {
      say('caretaker', 'Ei, que no és migdia!', 2.2, 'loud');
      finishQuest('bell', 'CHURCH BELLS', 4);
    }
  };

  const prompt = (): { key: string; label: string } | null => {
    if (!quests.bell && dog.y >= TOP_Y - 1 && dist(dog, HILL.portal) < 7) {
      return { key: 'E', label: 'Ring the church bell' };
    }
    return null;
  };

  const reset = () => {
    bellRingT = 0;
    miradorT = 0;
  };

  const restore = (doneKeys: ReadonlySet<string>) => {
    if (doneKeys.has('hill:bell')) quests.bell = true;
    if (doneKeys.has('hill:mirador')) quests.mirador = true;
    if (doneKeys.has('hill:home')) homeDone = true;
    doneCount = Number(quests.bell) + Number(quests.mirador);
  };

  return {
    update,
    bark,
    prompt,
    reset,
    restore,
    quests: () => ({ ...quests, home: homeDone }),
    bubbles: () => [
      { id: 'guide', x: HILL.guide.x, y: MID_Y + 2.1, z: HILL.guide.z },
      { id: 'caretaker', x: HILL.caretaker.x, y: TOP_Y + 2.1, z: HILL.caretaker.z },
      { id: 'miradorLocal', x: 17.5, y: TOP_Y + 1.7, z: 219.7 },
    ],
    debug: {
      get bellRingT() { return bellRingT; },
      get miradorT() { return miradorT; },
      get homeDone() { return homeDone; },
      pigeons,
      parkDog,
    },
  };
}

export type HillLife = ReturnType<typeof createHillLife>;
