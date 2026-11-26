/*
  The Marina & Breakwater at runtime: moored boats gently bobbing on the harbor
  swell, a flashing green beacon atop Far del Port, a sailor looking for his
  lifebuoy, a fisherman beset by crate gulls, Bimba the playmate in pipica 4,
  Boss #1 (El Mico de Bronze) at West Quay, and the Harbor Boat Wake Surge chase.
*/
import * as THREE from 'three';
import { makePerson, makeBird, makeDog, M, box, cyl, sphere, rod, shadowed } from './models';
import { collapseRig } from './bake';
import { MARINA, inMarinaPipica, PONTOON_Y, BREAKWATER_Y } from './marina';
import { MARINA_GROUND_Y, MARINA_WATER_Y, PONTOON_A, PONTOON_B } from './marinaGeom';
import { createMicoBoss } from './micoBoss';
import { WakeChaseState } from './wakeLogic';
import type { Hud } from './hud';
import type { WalkAudio } from './audio';
import type { FeelState, TelegraphPool } from './telegraph';

export type MarinaItem = 'buoy';
export const isMarinaItem = (c: string | null): c is MarinaItem => c === 'buoy';

type P = { x: number; z: number };

export interface MarinaCtx {
  scene: THREE.Scene;
  hud: Hud;
  audio: WalkAudio;
  telegraphs: TelegraphPool;
  feel: FeelState;
  dog: { x: number; y: number; z: number; vx: number; vz: number; heading: number; carrying: string | null };
  human: { x: number; y: number; z: number; vx: number; vz: number };
  humanSay: (text: string, ttl?: number, tone?: 'paper' | 'win' | 'loud') => void;
  addBones: (n: number, why?: string) => void;
  completeGoal: (id: string) => void;
  bumpGoal: (id: string, n: number) => void;
  onDone?: (key: string) => void;
  burst: (x: number, y: number, z: number, color: number, n?: number, spd?: number, up?: number, life?: number, g?: number) => void;
  offLeash: () => boolean;
  canStartThreat?: () => boolean;
  onWet?: () => void;
  onHitDog?: (vx: number, vz: number, vy?: number) => void;
}

const Y = MARINA_GROUND_Y;
const VIEW = 115;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);
const angLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

function makeMooredBoat(accent: number, kind: 'sail' | 'fisher') {
  const g = new THREE.Group();
  const hull = M(0xf4f1ea, 0.55);
  const trim = M(accent, 0.55);
  const deck = M(0xb88f64, 0.85);
  const dark = M(0x2a2f3d, 0.6);

  const body = box(2.1, 0.7, 5.2, hull);
  body.position.y = 0.28;
  g.add(body);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.5, 4), hull);
  bow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  bow.scale.set(1.0, 0.45, 1.0);
  bow.position.set(0, 0.28, -3.2);
  g.add(bow);
  const stripe = box(2.14, 0.16, 5.24, trim);
  stripe.position.y = 0.48;
  g.add(stripe);
  const topDeck = box(1.85, 0.08, 4.9, deck);
  topDeck.position.y = 0.65;
  g.add(topDeck);

  if (kind === 'sail') {
    const cabin = box(1.2, 0.55, 2.0, hull);
    cabin.position.set(0, 0.95, 0.2);
    g.add(cabin);
    const mast = cyl(0.05, 0.07, 6.2, M(0xd8dde4, 0.35, 0.7), 8);
    mast.position.set(0, 3.8, -0.3);
    g.add(mast);
    const boom = rod(new THREE.Vector3(0, 1.75, -0.3), new THREE.Vector3(0, 1.75, 2.1), 0.04, M(0xd8dde4, 0.4, 0.6), 6);
    g.add(boom);
    const sailBag = box(0.24, 0.22, 2.2, trim);
    sailBag.position.set(0, 1.88, 0.85);
    g.add(sailBag);
  } else {
    const house = box(1.4, 1.3, 1.7, hull);
    house.position.set(0, 1.32, 0.2);
    g.add(house);
    const win = box(1.44, 0.45, 0.9, dark);
    win.position.set(0, 1.55, -0.15);
    g.add(win);
    const roof = box(1.5, 0.12, 1.85, trim);
    roof.position.set(0, 2.0, 0.2);
    g.add(roof);
  }
  shadowed(g);
  return g;
}

function makeWakeBoat() {
  const g = new THREE.Group();
  const hull = box(5.4, 0.85, 2.1, M(0xf4f1ea, 0.4));
  hull.position.y = 0.42;
  const trim = box(5.46, 0.2, 2.14, M(0x2a5aa8, 0.45));
  trim.position.y = 0.66;
  const cabin = box(1.9, 0.65, 1.5, M(0x1f2b3f, 0.25, 0.3));
  cabin.position.set(-0.2, 1.1, 0);
  g.add(hull, trim, cabin);
  g.visible = false;
  shadowed(g);
  collapseRig(g);
  return g;
}

function makeWakeWave() {
  const g = new THREE.Group();
  const crest = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 1.25, 1.4),
    new THREE.MeshBasicMaterial({ color: 0x62dbff, transparent: true, opacity: 0.62, depthWrite: false }),
  );
  crest.position.y = 0.6;
  const foam = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 0.35, 1.55),
    new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.84, depthWrite: false }),
  );
  foam.position.y = 1.22;
  g.add(crest, foam);
  g.visible = false;
  return g;
}

export function createMarinaLife(ctx: MarinaCtx) {
  const { scene, hud, audio, dog, human } = ctx;
  const all: THREE.Object3D[] = [];
  const add = <T extends THREE.Object3D>(o: T) => { scene.add(o); all.push(o); return o; };
  const person = (look: Parameters<typeof makePerson>[0], x: number, y: number, z: number, heading: number) => {
    const m = makePerson(look);
    m.group.position.set(x, y, z);
    m.group.rotation.y = -heading;
    add(collapseRig(m.group));
    return m;
  };
  const mouth = () => ({
    x: dog.x + Math.cos(dog.heading) * 0.55,
    y: dog.y + 0.55,
    z: dog.z + Math.sin(dog.heading) * 0.55,
  });

  const quests = { buoy: false, gulls: false, playmate: false };
  let doneCount = 0;
  let lighthouseDone = false;
  let wakeDone = false;
  let pontoons = { a: false, b: false };
  let boatsCount = 0;

  const finishQuest = (k: keyof typeof quests, msg: string, reward: number) => {
    if (quests[k]) return;
    quests[k] = true;
    doneCount++;
    ctx.onDone?.(`marina:${k}`);
    ctx.addBones(reward, msg);
    ctx.bumpGoal('marina_quests', doneCount);
  };

  const saidT: Record<string, number> = {};
  const say = (id: string, text: string, ttl = 2, tone: 'paper' | 'win' | 'loud' = 'paper', every = 0) => {
    if (every && (saidT[id] ?? 0) > 0) return;
    saidT[id] = every;
    hud.say(id, text, ttl, tone);
  };

  // ---- Moored boats & lighthouse green beacon ----
  const boats = MARINA.boats.map(([x, z, ry, col, kind], i) => {
    const m = makeMooredBoat(col, kind);
    m.position.set(x, MARINA_WATER_Y, z);
    m.rotation.y = ry;
    add(collapseRig(m));
    return { m, x, z, phase: i * 1.1 };
  });
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0x5eea8c, emissive: 0x5eea8c, emissiveIntensity: 1.5 });
  const beacon = add(sphere(0.32, beaconMat, 10, 8));
  beacon.position.set(MARINA.lighthouse.x, BREAKWATER_Y + 10.35, MARINA.lighthouse.z);

  // ---- People ----
  const sailor = person(
    { top: 0xf4f1ea, trousers: 0x284c75, hair: 0x5b3a29, hairStyle: 'short', prop: 'none' },
    MARINA.sailor.x, PONTOON_Y, MARINA.sailor.z, 0,
  );
  const fisherman = person(
    { top: 0xe8b42c, trousers: 0x3d4b5c, hair: 0x8a8a8a, hairStyle: 'bald', prop: 'none', height: 0.98 },
    MARINA.fisherman.x, Y, MARINA.fisherman.z, Math.PI,
  );
  const terraceLocal = person(
    { top: 0x3d73c7, trousers: 0x40455c, hair: 0x6b4026, hairStyle: 'bun', prop: 'coffee', height: 0.96 },
    MARINA.terraceLocal.x, Y, MARINA.terraceLocal.z, -Math.PI / 2,
  );

  // ---- Orange lifebuoy ring on the canal footbridge ----
  const buoyM = add(new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.08, 8, 16),
    M(0xf26c22, 0.5),
  ));
  buoyM.rotation.x = Math.PI / 2;
  const buoy = { x: MARINA.buoyPos.x, z: MARINA.buoyPos.z, held: false };

  // ---- Harbor crate gulls (West Quay) ----
  const gulls = [0, 1, 2].map((i) => {
    const b = makeBird('gull');
    add(b.group);
    const hx = MARINA.cratePos.x + (i - 1) * 0.65;
    const hz = MARINA.cratePos.z + (i === 1 ? 0.35 : -0.25);
    const hy = Y + (i === 1 ? 0.98 : 1.46);
    return { b, hx, hz, hy, x: hx, y: hy, z: hz, vx: 0, vy: 0, vz: 0, fly: 0, gone: false };
  });

  // ---- Bimba, playful harbor pup inside the fourth pipicà ----
  const PP = MARINA.pipica;
  const playmateM = makeDog({
    fur: 0x6e4f38, dark: 0x422d1e, muzzle: 0xd9b896, paws: 0xf4efe2, collar: 0x1fc9b7, scale: 0.74, ears: 'prick',
  });
  add(collapseRig(playmateM.group));
  const playmate = {
    x: (PP.x0 + PP.x1) / 2,
    z: (PP.z0 + PP.z1) / 2,
    tx: PP.x0 + 3,
    tz: PP.z0 + 3,
    heading: 0,
    t: 1.0,
    tags: 0,
    tagCd: 0,
  };

  // ---- Boss #1: El Mico de Bronze (West Quay) + Wake Chase ----
  const wake = new WakeChaseState();
  const wakeBoat = add(makeWakeBoat());
  const wakeWave = add(makeWakeWave());
  const mico = createMicoBoss({
    addObject: add,
    hud,
    audio,
    telegraphs: ctx.telegraphs,
    feel: ctx.feel,
    dog,
    humanSay: ctx.humanSay,
    addBones: ctx.addBones,
    completeGoal: ctx.completeGoal,
    onDone: ctx.onDone,
    burst: ctx.burst,
    onHitDog: (vx, vz, vy) => ctx.onHitDog?.(vx, vz, vy),
    canStart: () => (ctx.canStartThreat?.() ?? true) && !wake.active,
  });

  // ---- Per-frame ----
  const update = (dt: number, time: number) => {
    for (const k in saidT) saidT[k] -= dt;
    const near = dist(dog, MARINA.center) < VIEW;
    for (const o of all) o.visible = near;
    mico.update(dt, time, near);

    if (!near) {
      if (wake.active) wake.reset();
      return;
    }

    // Boats rock gently on the marina swell, or roll heavily under a passing wake.
    for (const bt of boats) {
      const wakeBoost = wake.active ? Math.max(0, 1 - Math.abs(bt.z - wake.waveZ) / 14) : 0;
      bt.m.position.y = MARINA_WATER_Y + Math.sin(time * 1.4 + bt.phase) * (0.06 + wakeBoost * 0.22);
      bt.m.rotation.x = Math.sin(time * 1.2 + bt.phase) * (0.025 + wakeBoost * 0.08);
      bt.m.rotation.z = Math.cos(time * 1.1 + bt.phase) * (0.03 + wakeBoost * 0.12);
    }
    const pulse = Math.max(0, Math.sin(time * 3.0));
    beaconMat.emissiveIntensity = 0.6 + pulse * 1.8;

    // Wake Chase trigger & advancement on Pontoons A/B.
    if (!wake.active) {
      const trig = wake.canTrigger(
        dog.x, dog.z,
        !(ctx.canStartThreat?.() ?? true) || mico.active,
        ctx.offLeash(),
      );
      if (trig) {
        wake.start(trig);
        hud.shout('BOAT WAKE!', 'loud');
        ctx.humanSay('Whoa, look at that wake!', 1.8, 'loud');
        hud.toast('Harbor chase', 'Sprint back up the gangway onto the stone quay before the wake hits!', '#38c9ff', 4);
        audio.honk({ x: wake.boatX, z: -68 });
        audio.splash({ x: trig === 'A' ? -124 : -150, z: -62 });
      }
    }
    const wakeRes = wake.step(dt, dog, human);
    if (wakeRes === 'active' && wake.active) {
      const p = wake.pontoon === 'B' ? PONTOON_B : PONTOON_A;
      const cx = (p.x0 + p.x1) / 2;
      wakeBoat.visible = true;
      wakeBoat.position.set(wake.boatX, MARINA_WATER_Y + 0.18, -68);
      wakeWave.visible = true;
      wakeWave.position.set(cx, PONTOON_Y - 0.15, wake.waveZ);
      const fill = Math.max(0.05, Math.min(1, (wake.waveZ + 62) / 44));
      ctx.telegraphs.lane(cx, -59, cx, -19.5, PONTOON_Y + 0.08, 4.4, fill, 0x38c9ff);
      ctx.telegraphs.beacon(cx, Y + 0.06, -17.2, 2.2, time, 0x5eea8c);
      if (Math.random() < dt * 16) ctx.burst(cx + rand(-2, 2), PONTOON_Y + 0.4, wake.waveZ, 0xcff5ff, 2, 1.5, 2.0, 0.4, 5);
    } else {
      wakeBoat.visible = false;
      wakeWave.visible = false;
    }
    if (wakeRes === 'escaped') {
      hud.shout(wakeDone ? 'DRY PAWS!' : 'ESCAPED WAKE! +6', 'good');
      audio.goal();
      if (!wakeDone) {
        wakeDone = true;
        ctx.onDone?.('marina:wake');
        ctx.addBones(6);
        ctx.completeGoal('marina_wake');
      }
    } else if (wakeRes === 'hit') {
      hud.shout('SPLASHED!', 'bad');
      hud.flash('rgba(56, 201, 255, 0.35)');
      ctx.onWet?.();
      ctx.onHitDog?.(0, 5.8, 2.5);
      ctx.burst(dog.x, dog.y + 0.5, dog.z, 0xbfe6ff, 28, 3.2, 3.2, 0.7, 6);
      audio.splash({ x: dog.x, z: dog.z });
      audio.whine();
      ctx.feel.kick(0.38);
      ctx.feel.hitstop(0.08);
      ctx.humanSay('Drenched again!', 1.8, 'loud');
    }

    sailor.animate(time, { speed: 0, pose: 'stand' });
    fisherman.animate(time + 1.5, { speed: 0, pose: 'stand' });
    terraceLocal.animate(time + 2.5, { speed: 0, pose: 'sit' });

    if (!quests.buoy) {
      if (dist(dog, MARINA.sailor) < 5.5 && !buoy.held) {
        say('sailor', 'Has vist el salvavides? Sembla al pont del canal!', 2.2, 'paper', 10);
      }
      if (buoy.held) {
        const m = mouth();
        buoyM.position.set(m.x, m.y - 0.04, m.z);
        buoyM.rotation.x = 0.25;
      } else {
        buoyM.position.set(buoy.x, Y + 0.09, buoy.z);
        buoyM.rotation.x = Math.PI / 2;
      }
      buoyM.visible = near;
    } else {
      buoyM.visible = false;
    }

    // Gulls at Moll de Ponent crates.
    if (!quests.gulls && dist(dog, MARINA.fisherman) < 6) {
      say('fisherman', 'Aquestes gavines em roben les sardines! Borda!', 2.2, 'paper', 10);
    }
    for (const g of gulls) {
      if (g.fly > 0) {
        g.fly -= dt;
        g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
        g.vy -= 0.4 * dt;
        g.b.wings.forEach((w, k) => { w.rotation.x = Math.sin(time * 28 + k * Math.PI) * 0.9; });
        g.b.group.rotation.y = -Math.atan2(g.vz, g.vx);
      } else if (!g.gone) {
        g.x = g.hx; g.z = g.hz; g.y = g.hy + Math.abs(Math.sin(time * 3 + g.hx)) * 0.03;
        g.b.wings.forEach((w) => { w.rotation.x = 0; });
        if (Math.random() < dt * 0.4) g.b.group.rotation.y = rand(0, 6.28);
      }
      g.b.group.position.set(g.x, g.y, g.z);
      g.b.group.visible = near && (!g.gone || g.fly > 0) && g.y < Y + 40;
    }

    // Playmate pup inside pipica4.
    if (playmate.tagCd > 0) playmate.tagCd -= dt;
    const inPip = inMarinaPipica(dog.x, dog.z);
    if (!quests.playmate && inPip && ctx.offLeash() && playmate.tagCd <= 0 && dist(dog, playmate) < 2.2) {
      playmate.tagCd = 1.4;
      playmate.tags++;
      playmate.tx = rand(PP.x0 + 1.4, PP.x1 - 1.4);
      playmate.tz = rand(PP.z0 + 1.4, PP.z1 - 1.4);
      audio.bark();
      if (playmate.tags >= 3) {
        say('playmate', 'Guau guau! Quina carrera!', 2.0, 'win');
        finishQuest('playmate', 'HARBOR TAG', 4);
      } else {
        say('playmate', playmate.tags === 1 ? 'Tag! Catch me!' : 'Again, again!', 1.4, 'paper');
      }
    }
    playmate.t -= dt;
    if (playmate.t <= 0) {
      playmate.t = rand(1.1, 2.8);
      playmate.tx = rand(PP.x0 + 1.5, PP.x1 - 1.5);
      playmate.tz = rand(PP.z0 + 1.5, PP.z1 - 1.5);
    }
    const pdx = playmate.tx - playmate.x, pdz = playmate.tz - playmate.z, pdd = Math.hypot(pdx, pdz);
    const psp = pdd > 0.35 ? (inPip && ctx.offLeash() ? 4.4 : 2.2) : 0;
    if (pdd > 0.35) {
      playmate.x += (pdx / pdd) * psp * dt;
      playmate.z += (pdz / pdd) * psp * dt;
      playmate.heading = angLerp(playmate.heading, Math.atan2(pdz, pdx), dt * 8);
    }
    playmateM.group.position.set(playmate.x, Y, playmate.z);
    playmateM.group.rotation.y = -playmate.heading;
    playmateM.animate(time + 1, { speed: psp, dig: false, peeing: false, wag: 0.9, air: false });

    // Explore both pontoons.
    if (!pontoons.a && dog.x >= MARINA.pontoonA.x0 && dog.x <= MARINA.pontoonA.x1 && dog.z <= -42) {
      pontoons.a = true;
      boatsCount = Number(pontoons.a) + Number(pontoons.b);
      ctx.onDone?.('marina:pontoonA');
      ctx.addBones(2);
      ctx.bumpGoal('marina_boats', boatsCount);
    }
    if (!pontoons.b && dog.x >= MARINA.pontoonB.x0 && dog.x <= MARINA.pontoonB.x1 && dog.z <= -42) {
      pontoons.b = true;
      boatsCount = Number(pontoons.a) + Number(pontoons.b);
      ctx.onDone?.('marina:pontoonB');
      ctx.addBones(2);
      ctx.bumpGoal('marina_boats', boatsCount);
    }

    // Breakwater lighthouse reach goal.
    if (!lighthouseDone && dist(dog, MARINA.lighthouse) < 6) {
      lighthouseDone = true;
      ctx.onDone?.('marina:lighthouse');
      hud.shout('FAR DEL PORT!', 'good');
      ctx.humanSay('What a view back toward the beach!', 2.4, 'win');
      ctx.addBones(5);
      ctx.burst(MARINA.lighthouse.x, BREAKWATER_Y + 2, MARINA.lighthouse.z, 0x5eea8c, 20, 3, 4, 0.9, 6);
      ctx.completeGoal('marina_lighthouse');
    }
  };

  const pickup = () => {
    if (dog.carrying) return false;
    if (!quests.buoy && !buoy.held && dist(dog, buoy) < 1.2) {
      buoy.held = true;
      dog.carrying = 'buoy';
      audio.pickup();
      hud.banner('Take the lifebuoy to the sailor on the east pontoon', 'news');
      return true;
    }
    return false;
  };

  const drop = (fx: number, fz: number) => {
    if (!isMarinaItem(dog.carrying)) return false;
    dog.carrying = null;
    buoy.held = false;
    buoy.x = fx;
    buoy.z = fz;
    audio.click();
    if (!quests.buoy && dist({ x: fx, z: fz }, MARINA.sailor) < 3.4) {
      say('sailor', 'Perfecte, gràcies campiona!', 2.2, 'win');
      finishQuest('buoy', 'LIFEBUOY RETURNED', 4);
    }
    return true;
  };

  const bark = () => {
    if (mico.bark()) return;
    if (quests.gulls) return;
    if (dist(dog, MARINA.cratePos) > 7 || !gulls.some((g) => !g.gone)) return;
    for (const g of gulls) {
      const a = rand(0, Math.PI * 2);
      g.vx = Math.cos(a) * rand(3, 5);
      g.vz = Math.sin(a) * rand(3, 5) - 2;
      g.vy = rand(4, 6);
      g.fly = 8;
      g.gone = true;
    }
    audio.flutter(MARINA.cratePos);
    audio.gull(MARINA.cratePos);
    ctx.completeGoal('birds');
    say('fisherman', 'Així! Moltes gràcies!', 2.2, 'win');
    finishQuest('gulls', 'CRATES GUARDED', 4);
  };

  const onWhirl = (poleX: number, poleZ: number) => mico.onWhirl(poleX, poleZ);

  const prompt = (): { key: string; label: string } | null => {
    const mp = mico.prompt();
    if (mp) return mp;
    if (!dog.carrying && !quests.buoy && !buoy.held && dist(dog, buoy) < 1.2) {
      return { key: 'G', label: 'Pick up the lifebuoy' };
    }
    if (!quests.gulls && dist(dog, MARINA.cratePos) < 6 && gulls.some((g) => !g.gone)) {
      return { key: 'E', label: 'Scatter the crate gulls' };
    }
    return null;
  };

  const banner = (): string | null => (
    wake.active ? 'Harbor boat wake! Sprint back onto the stone quay!' : null
  );

  const reset = () => {
    buoy.held = false;
    buoy.x = MARINA.buoyPos.x;
    buoy.z = MARINA.buoyPos.z;
    playmate.tagCd = 0;
    wake.reset();
    wakeBoat.visible = false;
    wakeWave.visible = false;
    mico.reset();
  };

  const restore = (doneKeys: ReadonlySet<string>) => {
    if (doneKeys.has('marina:buoy')) { quests.buoy = true; buoyM.visible = false; }
    if (doneKeys.has('marina:gulls')) {
      quests.gulls = true;
      for (const g of gulls) { g.gone = true; g.fly = 0; g.b.group.visible = false; }
    }
    if (doneKeys.has('marina:playmate')) { quests.playmate = true; playmate.tags = 3; }
    if (doneKeys.has('marina:pontoonA')) pontoons.a = true;
    if (doneKeys.has('marina:pontoonB')) pontoons.b = true;
    if (doneKeys.has('marina:lighthouse')) lighthouseDone = true;
    if (doneKeys.has('marina:wake')) wakeDone = true;
    mico.restore(doneKeys);
    doneCount = Number(quests.buoy) + Number(quests.gulls) + Number(quests.playmate);
    boatsCount = Number(pontoons.a) + Number(pontoons.b);
  };

  return {
    update,
    pickup,
    drop,
    bark,
    onWhirl,
    prompt,
    banner,
    busy: () => mico.active || wake.active,
    wakeActive: () => wake.active,
    reset,
    restore,
    quests: () => ({ ...quests, lighthouse: lighthouseDone, wake: wakeDone, mico: mico.state.defeatedOnce, pontoons: { ...pontoons } }),
    bubbles: () => [
      { id: 'sailor', x: MARINA.sailor.x, y: PONTOON_Y + 2.1, z: MARINA.sailor.z },
      { id: 'fisherman', x: MARINA.fisherman.x, y: Y + 2.1, z: MARINA.fisherman.z },
      { id: 'playmate', x: playmate.x, y: Y + 1.0, z: playmate.z },
      { id: 'mico', x: mico.state.x, y: Y + 3.0, z: mico.state.z },
    ],
    debug: {
      buoy, gulls, playmate, pontoons, mico, wake,
      get lighthouseDone() { return lighthouseDone; },
      get wakeDone() { return wakeDone; },
    },
  };
}

export type MarinaLife = ReturnType<typeof createMarinaLife>;
