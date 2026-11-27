/*
  Ronda i Parc at runtime: ambient trench traffic, Pont de vianants crossing,
  skateboard return, timid-pedestrian bark quest, park fetch, sixth pipicà dog,
  and runaway delivery scooters on the overpass approaches.
*/
import * as THREE from 'three';
import { makePerson, makeDog, M, box, cyl, sphere, shadowed } from './models';
import { collapseRig } from './bake';
import { RONDA, inRondaPipica, onRondaBridge } from './ronda';
import { RONDA_BRIDGE, RONDA_GROUND_Y, RONDA_TRENCH_Y } from './rondaGeom';
import { TrafficState, ScooterRushState, SCOOTER_LANES } from './rondaLogic';
import type { Hud } from './hud';
import type { WalkAudio } from './audio';
import type { FeelState, TelegraphPool } from './telegraph';

export type RondaItem = 'rondaDeck';
export const isRondaItem = (c: string | null): c is RondaItem => c === 'rondaDeck';

type P = { x: number; z: number };

export interface RondaCtx {
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

const Y = RONDA_GROUND_Y;
const VIEW = 115;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);
const angLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

function makeCar(kind: 'car' | 'bus') {
  const g = new THREE.Group();
  const bodyM = M(kind === 'bus' ? 0xe8b42c : 0x3d73c7, 0.45);
  const darkM = M(0x1a1e28, 0.3);
  const wheelM = M(0x22262e, 0.8);
  const len = kind === 'bus' ? 5.4 : 3.6;
  const h = kind === 'bus' ? 2.4 : 1.35;
  const body = box(len, h, 1.7, bodyM);
  body.position.y = h * 0.55;
  const cabin = box(len * 0.55, h * 0.55, 1.65, darkM);
  cabin.position.set(kind === 'bus' ? 0.4 : 0.55, h * 0.95, 0);
  g.add(body, cabin);
  for (const [wx, wz] of [[-len * 0.32, -0.7], [len * 0.32, -0.7], [-len * 0.32, 0.7], [len * 0.32, 0.7]] as const) {
    const wh = cyl(0.28, 0.28, 0.18, wheelM, 8);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(wx, 0.28, wz);
    g.add(wh);
  }
  shadowed(g);
  collapseRig(g);
  return g;
}

function makeScooter() {
  const g = new THREE.Group();
  const frame = M(0x2a2f3d, 0.5);
  const accent = M(0xff6a1a, 0.45);
  const wheelM = M(0x22262e, 0.8);
  const deck = box(0.95, 0.08, 0.28, frame);
  deck.position.y = 0.18;
  const stem = box(0.06, 0.85, 0.06, frame);
  stem.position.set(0.38, 0.6, 0);
  const bar = box(0.08, 0.06, 0.55, accent);
  bar.position.set(0.38, 1.02, 0);
  const boxCargo = box(0.42, 0.38, 0.36, accent);
  boxCargo.position.set(-0.28, 0.45, 0);
  g.add(deck, stem, bar, boxCargo);
  for (const wx of [-0.38, 0.38]) {
    const wh = cyl(0.12, 0.12, 0.06, wheelM, 8);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(wx, 0.12, 0);
    g.add(wh);
  }
  shadowed(g);
  collapseRig(g);
  g.visible = false;
  return g;
}

function makeSkateboard() {
  const g = new THREE.Group();
  const deck = box(0.72, 0.05, 0.2, M(0xc88438, 0.7));
  deck.position.y = 0.08;
  const grip = box(0.68, 0.02, 0.18, M(0x2a2f3d, 0.8));
  grip.position.y = 0.11;
  g.add(deck, grip);
  for (const [wx, wz] of [[-0.22, -0.08], [0.22, -0.08], [-0.22, 0.08], [0.22, 0.08]] as const) {
    const wh = cyl(0.035, 0.035, 0.04, M(0xff6a1a, 0.5), 8);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(wx, 0.04, wz);
    g.add(wh);
  }
  shadowed(g);
  collapseRig(g);
  return g;
}

function makeFetchBall() {
  const g = new THREE.Group();
  const ball = sphere(0.12, M(0xffb020, 0.55), 10, 8);
  g.add(ball);
  shadowed(g);
  collapseRig(g);
  return g;
}

/** Instantiates and updates Ronda i Parc runtime life, quests, traffic, and scooter rush. */
export function createRondaLife(ctx: RondaCtx) {
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
  const mouth = () => ({
    x: dog.x + Math.cos(dog.heading) * 0.55,
    y: dog.y + 0.55,
    z: dog.z + Math.sin(dog.heading) * 0.55,
  });

  const quests = { deck: false, bridge: false, fetch: false };
  let doneCount = 0;
  let crossedBridge = false;
  let trafficHonkCd = 2.5;

  const finishQuest = (k: keyof typeof quests, msg: string, reward: number) => {
    if (quests[k]) return;
    quests[k] = true;
    doneCount++;
    ctx.onDone?.(`ronda:${k}`);
    ctx.addBones(reward, msg);
    ctx.bumpGoal('ronda_quests', doneCount);
  };

  const saidT: Record<string, number> = {};
  const say = (id: string, text: string, ttl = 2, tone: 'paper' | 'win' | 'loud' = 'paper', every = 0) => {
    if (every && (saidT[id] ?? 0) > 0) return;
    saidT[id] = every;
    hud.say(id, text, ttl, tone);
  };

  // ---- NPCs ----
  const skater = person(
    { top: 0xff6a1a, trousers: 0x1e2433, hair: 0x1a1410, hairStyle: 'short', prop: 'none', shorts: true },
    RONDA.skater.x, Y, RONDA.skater.z, Math.PI,
  );
  const timid = person(
    { top: 0xe8eef2, trousers: 0x2a2f3d, hair: 0xc9a26b, hairStyle: 'bun', prop: 'phone', height: 0.94 },
    RONDA.timid.x, Y, RONDA.timid.z, Math.PI / 2,
  );
  const fetcher = person(
    { top: 0x8bcb3c, trousers: 0x3a404c, hair: 0x5c3a21, hairStyle: 'ponytail', prop: 'none' },
    RONDA.fetcher.x, Y, RONDA.fetcher.z, 0,
  );

  const PP = RONDA.pipica;
  const playmateM = makeDog({
    fur: 0xb8a090, dark: 0x6b5a48, muzzle: 0xf4efe2, paws: 0xf4efe2, collar: 0x1fc9b7, scale: 0.7, ears: 'prick',
  });
  add(collapseRig(playmateM.group));
  const playmate = {
    x: (PP.x0 + PP.x1) / 2,
    z: (PP.z0 + PP.z1) / 2,
    tx: PP.x0 + 3,
    tz: PP.z0 + 3,
    heading: 0,
    t: 1.2,
  };

  // ---- Props ----
  const traffic = new TrafficState();
  const trafficMeshes = traffic.vehicles.map((v) => {
    const m = makeCar(v.kind);
    add(m);
    m.position.set(v.x, RONDA_TRENCH_Y + 0.05, v.z);
    return m;
  });

  const deckM = add(makeSkateboard());
  const deck = { x: RONDA.deckPos.x, z: RONDA.deckPos.z, held: false };

  const ballM = add(makeFetchBall());
  const fball = {
    x: RONDA.ballPos.x, y: Y + 0.12, z: RONDA.ballPos.z,
    vx: 0, vy: 0, vz: 0, flying: false,
  };

  // Timid pedestrian crossing state.
  const timidState = {
    phase: 'waiting' as 'waiting' | 'crossing' | 'done',
    z: RONDA.timid.z,
    progress: 0,
  };

  const scooterRush = new ScooterRushState();
  const scooterMeshes = SCOOTER_LANES.map(() => {
    const m = makeScooter();
    scene.add(m);
    return m;
  });

  const throwFetch = () => {
    const dx = RONDA.fetcher.x - fball.x;
    const dz = RONDA.fetcher.z - fball.z;
    const flightT = 0.85;
    fball.vx = dx / flightT;
    fball.vz = dz / flightT;
    fball.vy = (1.8 - (fball.y - Y) + 0.5 * 12 * flightT * flightT) / flightT;
    fball.flying = true;
    audio.jump();
  };

  const update = (dt: number, time: number) => {
    for (const k in saidT) saidT[k] -= dt;
    const near = dist(dog, RONDA.center) < VIEW;
    for (const o of all) o.visible = near;
    if (!near) {
      if (scooterRush.active) scooterRush.reset();
      for (const sm of scooterMeshes) sm.visible = false;
      return;
    }

    skater.animate(time, { speed: 0, pose: 'stand' });
    timid.animate(time + 1, {
      speed: timidState.phase === 'crossing' ? 1.4 : 0,
      pose: timidState.phase === 'waiting' ? 'phone' : 'walk',
    });
    fetcher.animate(time + 2, { speed: 0, pose: 'stand' });

    // Ambient trench traffic; occasional horn when a car loops past under the overpass.
    const { passed } = traffic.step(dt);
    for (let i = 0; i < traffic.vehicles.length; i++) {
      const v = traffic.vehicles[i];
      const m = trafficMeshes[i];
      m.position.set(v.x, RONDA_TRENCH_Y + 0.05, v.z);
      m.rotation.y = v.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    trafficHonkCd -= dt;
    if (trafficHonkCd <= 0 && passed > 0 && dog.z > 118 && dog.z < 142 && Math.random() < 0.4) {
      const v = traffic.vehicles[Math.floor(Math.random() * traffic.vehicles.length)];
      audio.honk({ x: v.x, z: v.z });
      trafficHonkCd = 5 + Math.random() * 7;
    }

    // Bridge crossing goal.
    if (!crossedBridge && onRondaBridge(dog.x, dog.z)) {
      crossedBridge = true;
      ctx.onDone?.('ronda:bridgeCross');
      ctx.addBones(3, 'OVERPASS');
      ctx.completeGoal('ronda_bridge');
    }

    // Quest 1: skateboard return.
    if (!quests.deck && !deck.held && dist(dog, RONDA.skater) < 4.5) {
      say('skater', 'He perdut el monopatí al sud del pont!', 2.2, 'paper', 10);
    }
    if (deck.held) {
      const mp = mouth();
      deckM.position.set(mp.x, mp.y, mp.z);
      deckM.rotation.y = -dog.heading;
    } else {
      deckM.position.set(deck.x, Y + (quests.deck ? 0.02 : 0.04 + Math.sin(time * 3) * 0.04), deck.z);
      deckM.rotation.y = quests.deck ? 0 : time * 1.1;
    }

    // Quest 2: bark to coax timid pedestrian across.
    if (!quests.bridge && timidState.phase === 'waiting' && dist(dog, RONDA.timid) < 5.0) {
      say('timid', 'El pont em fa por… Guau?', 2.2, 'paper', 10);
    }
    if (timidState.phase === 'crossing') {
      timidState.progress += dt * 0.35;
      timidState.z = RONDA.timid.z + timidState.progress * (RONDA_BRIDGE.z1 + 2 - RONDA.timid.z);
      timid.group.position.set(RONDA.timid.x, Y, timidState.z);
      timid.group.rotation.y = 0;
      if (timidState.progress >= 1) {
        timidState.phase = 'done';
        timidState.z = RONDA_BRIDGE.z1 + 2;
        timid.group.position.set(RONDA.timid.x, Y, timidState.z);
        say('timid', 'Gràcies! Ja estic a l’altra banda!', 2.4, 'win');
        finishQuest('bridge', 'BRIDGE COURAGE', 4);
      }
    }

    // Quest 3: park fetch.
    if (!fball.flying) {
      const bd = dist(dog, fball);
      if (bd < 0.55 && Math.hypot(dog.vx, dog.vz) > 0.4) {
        const dx = (fball.x - dog.x) / (bd || 1), dz = (fball.z - dog.z) / (bd || 1);
        fball.vx = dx * 4.2 + dog.vx * 0.55;
        fball.vz = dz * 4.2 + dog.vz * 0.55;
      }
      fball.vx *= Math.max(0, 1 - dt * 1.8);
      fball.vz *= Math.max(0, 1 - dt * 1.8);
      fball.x = clamp(fball.x + fball.vx * dt, -210, -120);
      fball.z = clamp(fball.z + fball.vz * dt, 150, 192);
      fball.y = Y + 0.12;
    } else {
      fball.vy -= 12 * dt;
      fball.x += fball.vx * dt;
      fball.y += fball.vy * dt;
      fball.z += fball.vz * dt;
      if (!quests.fetch && dist({ x: fball.x, z: fball.z }, RONDA.fetcher) < 1.6 && fball.y < Y + 1.2) {
        say('fetcher', 'Bon llançament!', 2.2, 'win');
        ctx.burst(RONDA.fetcher.x, Y + 1.2, RONDA.fetcher.z, 0xffb020, 14, 2.4, 2.2, 0.6, 5);
        audio.chime();
        finishQuest('fetch', 'PARK FETCH', 4);
        fball.flying = false;
        fball.x = RONDA.fetcher.x + 0.5;
        fball.z = RONDA.fetcher.z + 0.4;
        fball.y = Y + 0.12;
        fball.vx = fball.vy = fball.vz = 0;
      }
      if (fball.y <= Y + 0.12) {
        fball.y = Y + 0.12;
        if (Math.abs(fball.vy) > 1.0) {
          fball.vy = Math.abs(fball.vy) * 0.4;
          fball.vx *= 0.55;
          fball.vz *= 0.55;
          audio.click();
        } else {
          fball.vy = 0;
          fball.flying = false;
        }
      }
    }
    ballM.position.set(fball.x, fball.y, fball.z);
    ballM.rotation.x += dt * 5;
    if (!quests.fetch && dist(dog, RONDA.fetcher) < 4.5) {
      say('fetcher', 'Tira’m la pilota [E]!', 2.0, 'paper', 10);
    }

    // Playmate in pipica 6.
    playmate.t -= dt;
    if (playmate.t <= 0) {
      playmate.t = rand(1.3, 3.4);
      playmate.tx = rand(PP.x0 + 1.4, PP.x1 - 1.4);
      playmate.tz = rand(PP.z0 + 1.4, PP.z1 - 1.4);
    }
    const pdx = playmate.tx - playmate.x, pdz = playmate.tz - playmate.z, pdd = Math.hypot(pdx, pdz);
    const psp = pdd > 0.4 ? (inRondaPipica(dog.x, dog.z) && ctx.offLeash() ? 3.8 : 2.1) : 0;
    if (pdd > 0.4) {
      playmate.x += (pdx / pdd) * psp * dt;
      playmate.z += (pdz / pdd) * psp * dt;
      playmate.heading = angLerp(playmate.heading, Math.atan2(pdz, pdx), dt * 8);
    }
    playmateM.group.position.set(playmate.x, Y, playmate.z);
    playmateM.group.rotation.y = -playmate.heading;
    playmateM.animate(time + 3, { speed: psp, dig: false, peeing: false, wag: 0.9, air: false });

    // Chase: runaway delivery scooters.
    if (!scooterRush.active && scooterRush.canTrigger(dog, !(ctx.canStartThreat?.() ?? true))) {
      scooterRush.start(dog.x);
      hud.shout('SCOOTERS LOOSE!', 'loud');
      ctx.humanSay('Delivery scooters — dodge!', 2.2, 'loud');
      hud.toast('Runaway scooters', 'Sidestep off the approach or dash north/south to the green zone!', '#ff6b5a', 4);
      audio.honk({ x: -165, z: 128 });
      ctx.feel.kick(0.22);
    }
    const sev = scooterRush.step(dt, dog);
    if (sev.startedRush) {
      audio.click();
      hud.shout('HERE THEY ROLL!', 'loud');
    }
    if (sev.nextWave) {
      hud.shout('SECOND WAVE!', 'loud');
      audio.click();
    }
    if (sev.hit) {
      const dx = dog.x - sev.hit.x;
      ctx.onHitDog?.((Math.abs(dx) > 0.15 ? Math.sign(dx) : 1) * 5.6, 4.2, 2.3);
      hud.flash('rgba(255, 90, 54, 0.34)');
      audio.whine();
      audio.stumble();
      ctx.feel.kick(0.36);
      ctx.feel.hitstop(0.08);
      ctx.burst(dog.x, dog.y + 0.45, dog.z, 0xff6a1a, 14, 2.6, 2.4, 0.55, 5);
      hud.shout('SCOOTER BUMP!', 'bad');
    }
    if (sev.escaped) {
      hud.shout('OUTRAN THE SCOOTERS! +6', 'good');
      audio.goal();
      ctx.feel.kick(0.2);
      ctx.addBones(6);
      ctx.onDone?.('ronda:scooters');
      ctx.completeGoal('ronda_scooters');
      ctx.humanSay('Those riders need a slower lane!', 2.0, 'win');
    }

    if (scooterRush.active) {
      ctx.telegraphs.beacon(-165, Y + 0.06, 154.0, 2.3, time, 0x5eea8c);
      ctx.telegraphs.beacon(-165, Y + 0.06, 126.0, 2.1, time, 0x5eea8c);
      for (let i = 0; i < scooterRush.scooters.length; i++) {
        const st = scooterRush.scooters[i];
        const sm = scooterMeshes[i];
        if (scooterRush.phase === 'warning') {
          const fill = clamp(scooterRush.t / Math.max(0.01, scooterRush.warnDur) - st.delay * 0.25, 0.08, 1);
          ctx.telegraphs.lane(st.x, 128.0, st.x, 152.0, Y + 0.05, 1.85, fill, 0xff5a36);
          sm.visible = true;
          sm.position.set(st.x, Y, 128.5);
          sm.rotation.y = Math.sin(time * 12 + i) * 0.06;
        } else if (st.active && !st.passed) {
          ctx.telegraphs.lane(st.x, st.z, st.x, 152.0, Y + 0.05, 1.8, 0.92, 0xff3b2f);
          sm.visible = true;
          sm.position.set(st.x, Y, st.z);
          sm.rotation.y = 0;
        } else {
          sm.visible = false;
        }
      }
    } else {
      for (const sm of scooterMeshes) sm.visible = false;
    }
  };

  const pickup = () => {
    if (!quests.deck && !deck.held && dist(dog, deck) < 1.3) {
      deck.held = true;
      dog.carrying = 'rondaDeck';
      audio.pickup();
      hud.banner('Take the skateboard back to the skater at the ramp', 'news');
      return true;
    }
    return false;
  };

  const drop = (fx: number, fz: number) => {
    if (!isRondaItem(dog.carrying)) return false;
    deck.held = false;
    deck.x = fx;
    deck.z = fz;
    if (!quests.deck && dist({ x: fx, z: fz }, RONDA.skater) < 3.4) {
      deck.x = RONDA.skater.x + 0.5;
      deck.z = RONDA.skater.z + 0.4;
      say('skater', 'Gràcies! El monopatí ha tornat!', 2.4, 'win');
      finishQuest('deck', 'DECK RETURNED', 4);
    }
    dog.carrying = null;
    audio.click();
    return true;
  };

  const bark = (): boolean => {
    if (dist(dog, RONDA.center) >= VIEW) return false;
    if (!fball.flying && dist(dog, fball) < 2.4) {
      throwFetch();
      return true;
    }
    if (!quests.bridge && timidState.phase === 'waiting' && dist(dog, RONDA.timid) < 5.5) {
      timidState.phase = 'crossing';
      say('timid', 'D’acord… vaig!', 1.8, 'loud');
      audio.bark();
      return true;
    }
    if (scooterRush.tryBarkStart(dog, !(ctx.canStartThreat?.() ?? true))) {
      hud.shout('SCOOTERS LOOSE!', 'loud');
      audio.honk({ x: -165, z: 128 });
      return true;
    }
    return false;
  };

  const prompt = (): string | null => {
    if (!quests.deck && !deck.held && !dog.carrying && dist(dog, deck) < 1.3) return 'Pick up skateboard';
    return null;
  };

  const barkPrompt = (): string | null => {
    if (!quests.fetch && !fball.flying && dist(dog, fball) < 2.4) return 'Throw the ball!';
    if (!quests.bridge && timidState.phase === 'waiting' && dist(dog, RONDA.timid) < 5.5) return 'Encourage the walker';
    if (
      !scooterRush.active
      && scooterRush.cooldown <= 0
      && (ctx.canStartThreat?.() ?? true)
      && dog.x >= -180
      && dog.x <= -150
      && dog.z >= 118
      && dog.z <= 150
    ) {
      return scooterRush.survivedOnce ? 'Rattle the scooters again' : 'Startle the delivery scooters';
    }
    return null;
  };

  const banner = (): string | null => (
    scooterRush.active
      ? `Runaway scooters (wave ${scooterRush.wave}/${scooterRush.maxWaves}) — sidestep or reach the green zone!`
      : null
  );

  const reset = () => {
    deck.held = false;
    deck.x = quests.deck ? RONDA.skater.x + 0.5 : RONDA.deckPos.x;
    deck.z = quests.deck ? RONDA.skater.z + 0.4 : RONDA.deckPos.z;
    fball.x = RONDA.ballPos.x;
    fball.z = RONDA.ballPos.z;
    fball.y = Y + 0.12;
    fball.vx = fball.vy = fball.vz = 0;
    fball.flying = false;
    if (!quests.bridge) {
      timidState.phase = 'waiting';
      timidState.progress = 0;
      timidState.z = RONDA.timid.z;
      timid.group.position.set(RONDA.timid.x, Y, RONDA.timid.z);
      timid.group.rotation.y = -Math.PI / 2;
    }
    traffic.reset();
    trafficHonkCd = 2.5;
    scooterRush.reset();
    for (const sm of scooterMeshes) sm.visible = false;
  };

  const restore = (doneKeys: ReadonlySet<string>) => {
    if (doneKeys.has('ronda:deck')) quests.deck = true;
    if (doneKeys.has('ronda:bridge')) {
      quests.bridge = true;
      timidState.phase = 'done';
      timidState.z = RONDA_BRIDGE.z1 + 2;
      timid.group.position.set(RONDA.timid.x, Y, timidState.z);
    }
    if (doneKeys.has('ronda:fetch')) quests.fetch = true;
    if (doneKeys.has('ronda:bridgeCross')) crossedBridge = true;
    if (doneKeys.has('ronda:scooters')) scooterRush.survivedOnce = true;
    doneCount = Number(quests.deck) + Number(quests.bridge) + Number(quests.fetch);
    if (quests.deck) {
      deck.x = RONDA.skater.x + 0.5;
      deck.z = RONDA.skater.z + 0.4;
    }
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
    busy: () => scooterRush.active,
    scootersActive: () => scooterRush.active,
    quests: () => ({ ...quests }),
    bubbles: () => [
      { id: 'skater', x: RONDA.skater.x, y: Y + 2.1, z: RONDA.skater.z },
      { id: 'timid', x: RONDA.timid.x, y: Y + 2.1, z: timidState.z },
      { id: 'fetcher', x: RONDA.fetcher.x, y: Y + 2.1, z: RONDA.fetcher.z },
    ],
    debug: {
      traffic,
      scooterRush,
      deck,
      fball,
      timidState,
      playmate,
      crossedBridge,
      startScooters: () => {
        if (scooterRush.active || !(ctx.canStartThreat?.() ?? true)) return false;
        scooterRush.start(dog.x);
        return true;
      },
    },
  };
}

export type RondaLife = ReturnType<typeof createRondaLife>;
