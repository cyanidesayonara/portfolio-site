/*
  Canal i Galeria / Gorg at runtime: the gliding Mediterranean tramway stopping
  at Parada Canal, two canal bridge crossings, a streetball court trick-shot,
  a lost croissant treat bag, Nala in the fifth pipicà, and Runaway Shopping
  Carts along the Galeria del Canal esplanade.
*/
import * as THREE from 'three';
import { makePerson, makeDog, M, box, cyl, sphere, shadowed } from './models';
import { collapseRig } from './bake';
import { GORG, inGorgPipica, onGorgBridge } from './gorg';
import { GORG_GROUND_Y, GORG_TRAM } from './gorgGeom';
import { TramState, CartRushState, CART_LANES } from './gorgLogic';
import type { Hud } from './hud';
import type { WalkAudio } from './audio';
import type { FeelState, TelegraphPool } from './telegraph';

export type GorgItem = 'gorgBag';
export const isGorgItem = (c: string | null): c is GorgItem => c === 'gorgBag';

type P = { x: number; z: number };

export interface GorgCtx {
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

const Y = GORG_GROUND_Y;
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

function makeTram() {
  const g = new THREE.Group();
  const bodyM = M(0xf4f1ea, 0.45);
  const greenM = M(0x1b9c8c, 0.42);
  const darkM = M(0x222c3c, 0.25, 0.35);
  const roofM = M(0xd8dde4, 0.55);
  const lampM = M(0xffe08a, 0.25);

  for (const cx of [-6.0, 0, 6.0]) {
    const len = cx === 0 ? 5.2 : 5.6;
    const lower = box(len, 1.0, 2.35, greenM);
    lower.position.set(cx, 0.72, 0);
    const upper = box(len, 1.45, 2.3, bodyM);
    upper.position.set(cx, 1.94, 0);
    const glass = box(len * 0.86, 0.95, 2.34, darkM);
    glass.position.set(cx, 1.98, 0);
    const roof = box(len - 0.1, 0.22, 2.15, roofM);
    roof.position.set(cx, 2.76, 0);
    g.add(lower, upper, glass, roof);
  }
  for (const jx of [-3.0, 3.0]) {
    const joint = box(0.9, 2.15, 2.05, M(0x2a2f3d, 0.75));
    joint.position.set(jx, 1.45, 0);
    g.add(joint);
  }
  for (const endX of [-8.82, 8.82]) {
    const hl = box(0.08, 0.22, 1.4, lampM);
    hl.position.set(endX, 0.75, 0);
    g.add(hl);
  }
  shadowed(g);
  collapseRig(g);
  return g;
}

function makeCart() {
  const g = new THREE.Group();
  const wire = M(0xc8d0da, 0.3, 0.78);
  const red = M(0xd93a2b, 0.55);
  const wheelM = M(0x22262e, 0.8);

  const basket = box(0.76, 0.48, 0.98, wire);
  basket.position.set(0, 0.64, 0);
  const trim = box(0.8, 0.07, 1.02, red);
  trim.position.set(0, 0.88, 0);
  const handle = box(0.74, 0.06, 0.08, red);
  handle.position.set(0, 0.96, 0.52);
  g.add(basket, trim, handle);

  for (const [wx, wz] of [[-0.32, -0.38], [0.32, -0.38], [-0.32, 0.38], [0.32, 0.38]] as const) {
    const leg = box(0.04, 0.28, 0.04, wire);
    leg.position.set(wx, 0.26, wz);
    const wh = cyl(0.065, 0.065, 0.05, wheelM, 8);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(wx, 0.07, wz);
    g.add(leg, wh);
  }

  shadowed(g);
  collapseRig(g);
  g.visible = false;
  return g;
}

function makeBasketball() {
  const g = new THREE.Group();
  const ball = sphere(0.145, M(0xe67222, 0.55), 12, 8);
  const seam = box(0.3, 0.02, 0.02, M(0x221b18, 0.7));
  g.add(ball, seam);
  shadowed(g);
  collapseRig(g);
  return g;
}

function makeTreatBag() {
  const g = new THREE.Group();
  const bag = box(0.28, 0.34, 0.18, M(0xd8a85c, 0.8));
  bag.position.y = 0.17;
  const fold = box(0.3, 0.08, 0.2, M(0xc88438, 0.75));
  fold.position.y = 0.36;
  g.add(bag, fold);
  shadowed(g);
  collapseRig(g);
  return g;
}

/** Instantiates and updates Gorg (Canal i Galeria) runtime life, quests, tram, and cart rush. */
export function createGorgLife(ctx: GorgCtx) {
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

  const quests = { bag: false, hoop: false, tram: false };
  let doneCount = 0;
  let bridges = { S: false, N: false };
  let bridgeCount = 0;

  const finishQuest = (k: keyof typeof quests, msg: string, reward: number) => {
    if (quests[k]) return;
    quests[k] = true;
    doneCount++;
    ctx.onDone?.(`gorg:${k}`);
    ctx.addBones(reward, msg);
    ctx.bumpGoal('gorg_quests', doneCount);
  };

  const saidT: Record<string, number> = {};
  const say = (id: string, text: string, ttl = 2, tone: 'paper' | 'win' | 'loud' = 'paper', every = 0) => {
    if (every && (saidT[id] ?? 0) > 0) return;
    saidT[id] = every;
    hud.say(id, text, ttl, tone);
  };

  // ---- NPCs & Nala in Pipica 5 ----
  const shopper = person(
    { top: 0xe5487a, trousers: 0x2a2f3d, hair: 0x5c3a21, hairStyle: 'ponytail', prop: 'none' },
    GORG.shopper.x, Y, GORG.shopper.z, 0,
  );
  const baller = person(
    { top: 0x3d73c7, trousers: 0x1e2433, hair: 0x1a1410, hairStyle: 'short', prop: 'none', shorts: true },
    GORG.baller.x, Y, GORG.baller.z, Math.PI / 2,
  );
  const commuter = person(
    { top: 0x1fc9b7, trousers: 0x2a2f3d, hair: 0x8a8a8a, hairStyle: 'bun', prop: 'phone', height: 0.96 },
    GORG.commuter.x, Y, GORG.commuter.z, Math.PI / 2,
  );

  const PP = GORG.pipica;
  const playmateM = makeDog({
    fur: 0xe6dac4, dark: 0x9b8e7e, muzzle: 0xf4efe2, paws: 0xf4efe2, collar: 0xffb020, scale: 0.72, ears: 'drop',
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

  // ---- Props: Tram, Carts, Treat Bag & Streetball ----
  const tram = new TramState();
  const tramMesh = add(makeTram());
  tramMesh.position.set(tram.x, Y, tram.z);

  const bagM = add(makeTreatBag());
  const bag = { x: GORG.bagPos.x, z: GORG.bagPos.z, held: false };

  const bballM = add(makeBasketball());
  const bball = {
    x: GORG.ballPos.x, y: Y + 0.15, z: GORG.ballPos.z,
    vx: 0, vy: 0, vz: 0, shooting: false,
  };

  const cartRush = new CartRushState();
  const cartMeshes = CART_LANES.map(() => {
    const m = makeCart();
    scene.add(m);
    return m;
  });

  const shootBasketball = () => {
    const dx = GORG.hoopPos.x - bball.x;
    const dz = GORG.hoopPos.z - bball.z;
    const flightT = 0.95;
    bball.vx = dx / flightT;
    bball.vz = dz / flightT;
    bball.vy = (3.15 - (bball.y - Y) + 0.5 * 14 * flightT * flightT) / flightT;
    bball.shooting = true;
    audio.jump();
  };

  // ---- Per-frame ----
  const update = (dt: number, time: number) => {
    for (const k in saidT) saidT[k] -= dt;
    const near = dist(dog, GORG.center) < VIEW;
    for (const o of all) o.visible = near;
    if (!near) {
      if (cartRush.active) cartRush.reset();
      for (const cm of cartMeshes) cm.visible = false;
      return;
    }

    shopper.animate(time, { speed: 0, pose: 'stand' });
    baller.animate(time + 1, { speed: 0, pose: 'stand' });
    commuter.animate(time + 2, { speed: 0, pose: 'phone' });

    // Tram glide along the avenue.
    const tev = tram.step(dt, dog);
    if (tev.arrived && dist(dog, GORG.commuter) < 26) audio.bell({ x: tram.x, z: tram.z });
    if (tev.departed && dist(dog, GORG.commuter) < 26) audio.click();
    if (tev.brakedForDog) {
      audio.bell({ x: tram.x, z: tram.z });
      say('tramStop', 'Ting-ting!', 1.2, 'loud');
    }
    tramMesh.position.set(tram.x, Y, tram.z);

    // Bridge exploration milestones.
    const br = onGorgBridge(dog.x, dog.z);
    if (br && !bridges[br]) {
      bridges[br] = true;
      bridgeCount++;
      ctx.onDone?.(`gorg:bridge${br}`);
      ctx.addBones(3, br === 'S' ? 'SOUTH BRIDGE' : 'NORTH BRIDGE');
      ctx.bumpGoal('gorg_bridges', bridgeCount);
    }

    // Quest 1: croissant treat bag.
    if (!quests.bag && !bag.held && dist(dog, GORG.shopper) < 4.5) {
      say('shopper', 'He perdut la bossa al pont sud!', 2.2, 'paper', 10);
    }
    if (bag.held) {
      const mp = mouth();
      bagM.position.set(mp.x, mp.y, mp.z);
      bagM.rotation.y = -dog.heading;
    } else {
      bagM.position.set(bag.x, Y + (quests.bag ? 0.02 : 0.04 + Math.sin(time * 3) * 0.04), bag.z);
      bagM.rotation.y = quests.bag ? 0 : time * 1.2;
    }

    // Quest 2: streetball trick shot into the east hoop.
    if (!bball.shooting) {
      const bd = dist(dog, bball);
      if (bd < 0.6 && Math.hypot(dog.vx, dog.vz) > 0.4) {
        const dx = (bball.x - dog.x) / (bd || 1), dz = (bball.z - dog.z) / (bd || 1);
        bball.vx = dx * 4.5 + dog.vx * 0.6;
        bball.vz = dz * 4.5 + dog.vz * 0.6;
      }
      bball.vx *= Math.max(0, 1 - dt * 1.8);
      bball.vz *= Math.max(0, 1 - dt * 1.8);
      bball.x = clamp(bball.x + bball.vx * dt, GORG.hoopPos.x - 18.5, GORG.hoopPos.x + 0.5);
      bball.z = clamp(bball.z + bball.vz * dt, GORG.baller.z + 2.5, GORG.hoopPos.z + 8.5);
      bball.y = Y + 0.15;
    } else {
      bball.vy -= 14 * dt;
      bball.x += bball.vx * dt;
      bball.y += bball.vy * dt;
      bball.z += bball.vz * dt;
      if (!quests.hoop && Math.hypot(bball.x - GORG.hoopPos.x, bball.z - GORG.hoopPos.z) < 0.9 && bball.y >= Y + 2.4 && bball.y <= Y + 3.6 && bball.vy < 0) {
        say('baller', 'Quina cistella!!', 2.4, 'win');
        ctx.burst(GORG.hoopPos.x, Y + 3.05, GORG.hoopPos.z, 0xffb020, 18, 3.0, 2.8, 0.7, 5);
        audio.chime();
        finishQuest('hoop', 'TRICK SHOT', 4);
      }
      if (bball.y <= Y + 0.15) {
        bball.y = Y + 0.15;
        if (Math.abs(bball.vy) > 1.2) {
          bball.vy = Math.abs(bball.vy) * 0.45;
          bball.vx *= 0.6;
          bball.vz *= 0.6;
          audio.click();
        } else {
          bball.vy = 0;
          bball.shooting = false;
        }
      }
    }
    bballM.position.set(bball.x, bball.y, bball.z);
    bballM.rotation.x += dt * 4;
    if (!quests.hoop && dist(dog, GORG.baller) < 4.5) {
      say('baller', 'Ensenya’m un tir a cistella [E]!', 2.0, 'paper', 10);
    }

    // Playmate pup in pipica 5.
    playmate.t -= dt;
    if (playmate.t <= 0) {
      playmate.t = rand(1.3, 3.4);
      playmate.tx = rand(PP.x0 + 1.4, PP.x1 - 1.4);
      playmate.tz = rand(PP.z0 + 1.4, PP.z1 - 1.4);
    }
    const pdx = playmate.tx - playmate.x, pdz = playmate.tz - playmate.z, pdd = Math.hypot(pdx, pdz);
    const psp = pdd > 0.4 ? (inGorgPipica(dog.x, dog.z) && ctx.offLeash() ? 3.8 : 2.1) : 0;
    if (pdd > 0.4) {
      playmate.x += (pdx / pdd) * psp * dt;
      playmate.z += (pdz / pdd) * psp * dt;
      playmate.heading = angLerp(playmate.heading, Math.atan2(pdz, pdx), dt * 8);
    }
    playmateM.group.position.set(playmate.x, Y, playmate.z);
    playmateM.group.rotation.y = -playmate.heading;
    playmateM.animate(time + 3, { speed: psp, dig: false, peeing: false, wag: 0.9, air: false });

    // Chase: Runaway Shopping Carts down the Galeria esplanade.
    if (!cartRush.active && cartRush.canTrigger(dog, !(ctx.canStartThreat?.() ?? true))) {
      cartRush.start(dog.x);
      hud.shout('CARTS LOOSE!', 'loud');
      ctx.humanSay('Whoa — runaway shopping carts!', 2.2, 'loud');
      hud.toast('Runaway carts', 'Sidestep between red lanes or dash south/east to the green zone!', '#ff6b5a', 4);
      audio.honk({ x: -183, z: 80 });
      ctx.feel.kick(0.22);
    }
    const cev = cartRush.step(dt, dog);
    if (cev.startedRush) {
      audio.click();
      hud.shout('HERE THEY ROLL!', 'loud');
    }
    if (cev.nextWave) {
      hud.shout('SECOND AISLE!', 'loud');
      audio.click();
    }
    if (cev.hit) {
      const dx = dog.x - cev.hit.x;
      ctx.onHitDog?.((Math.abs(dx) > 0.15 ? Math.sign(dx) : -1) * 5.6, -4.8, 2.3);
      hud.flash('rgba(255, 90, 54, 0.34)');
      audio.whine();
      audio.stumble();
      ctx.feel.kick(0.36);
      ctx.feel.hitstop(0.08);
      ctx.burst(dog.x, dog.y + 0.45, dog.z, 0xc8d0da, 14, 2.6, 2.4, 0.55, 5);
      hud.shout('CART BUMP!', 'bad');
    }
    if (cev.escaped) {
      hud.shout('OUTRAN THE CARTS! +6', 'good');
      audio.goal();
      ctx.feel.kick(0.2);
      ctx.addBones(6);
      ctx.onDone?.('gorg:carts');
      ctx.completeGoal('gorg_carts');
      ctx.humanSay('Wait till we tell the grocer about that!', 2.0, 'win');
    }

    if (cartRush.active) {
      ctx.telegraphs.beacon(-183, Y + 0.06, 42.0, 2.3, time, 0x5eea8c);
      ctx.telegraphs.beacon(-175.8, Y + 0.06, 65.0, 2.1, time, 0x5eea8c);
      for (let i = 0; i < cartRush.carts.length; i++) {
        const st = cartRush.carts[i];
        const cm = cartMeshes[i];
        if (cartRush.phase === 'warning') {
          const fill = clamp(cartRush.t / Math.max(0.01, cartRush.warnDur) - st.delay * 0.25, 0.08, 1);
          ctx.telegraphs.lane(st.x, 84.0, st.x, 42.0, Y + 0.05, 1.85, fill, 0xff5a36);
          cm.visible = true;
          cm.position.set(st.x, Y, 84.5);
          cm.rotation.y = Math.sin(time * 12 + i) * 0.06;
        } else if (st.active && !st.passed) {
          ctx.telegraphs.lane(st.x, st.z, st.x, 42.0, Y + 0.05, 1.8, 0.92, 0xff3b2f);
          cm.visible = true;
          cm.position.set(st.x, Y, st.z);
          cm.rotation.y = Math.sin(time * 18 + i) * 0.04;
        } else {
          cm.visible = false;
        }
      }
    } else {
      for (const cm of cartMeshes) cm.visible = false;
    }
  };

  const pickup = () => {
    if (!quests.bag && !bag.held && dist(dog, bag) < 1.3) {
      bag.held = true;
      dog.carrying = 'gorgBag';
      audio.pickup();
      hud.banner('Take the treat bag back to the shopper outside Galeria', 'news');
      return true;
    }
    return false;
  };

  const drop = (fx: number, fz: number) => {
    if (!isGorgItem(dog.carrying)) return false;
    bag.held = false;
    bag.x = fx;
    bag.z = fz;
    if (!quests.bag && dist({ x: fx, z: fz }, GORG.shopper) < 3.4) {
      bag.x = GORG.shopper.x + 0.6;
      bag.z = GORG.shopper.z + 0.4;
      say('shopper', 'Gràcies! Els croissants salvats!', 2.4, 'win');
      finishQuest('bag', 'BAG RETURNED', 4);
    }
    dog.carrying = null;
    audio.click();
    return true;
  };

  const bark = (): boolean => {
    if (dist(dog, GORG.center) >= VIEW) return false;
    if (!bball.shooting && dist(dog, bball) < 2.4) {
      shootBasketball();
      return true;
    }
    if (dist(dog, GORG.commuter) < 6.0 && Math.abs(tram.x - GORG_TRAM.stopX) < 16) {
      audio.bell({ x: tram.x, z: tram.z });
      if (!quests.tram) {
        say('commuter', 'Bon dia, Tramvia!', 2.2, 'win');
        finishQuest('tram', 'TRAM GREETING', 4);
      }
      return true;
    }
    if (cartRush.tryBarkStart(dog, !(ctx.canStartThreat?.() ?? true))) {
      hud.shout('CARTS LOOSE!', 'loud');
      audio.honk({ x: -183, z: 80 });
      return true;
    }
    return false;
  };

  const prompt = (): string | null => {
    if (!quests.bag && !bag.held && !dog.carrying && dist(dog, bag) < 1.3) return 'Pick up croissant bag';
    return null;
  };

  const barkPrompt = (): string | null => {
    if (!quests.hoop && !bball.shooting && dist(dog, bball) < 2.4) return 'Shoot basketball!';
    if (!quests.tram && dist(dog, GORG.commuter) < 6.0 && Math.abs(tram.x - GORG_TRAM.stopX) < 16) return 'Greet the tram';
    if (!cartRush.active && cartRush.cooldown <= 0 && (ctx.canStartThreat?.() ?? true) && dog.x >= -188 && dog.x <= -177 && dog.z >= 44 && dog.z <= 84) {
      return cartRush.survivedOnce ? 'Rattle the carts again' : 'Startle the shopping carts';
    }
    return null;
  };

  const banner = (): string | null => (
    cartRush.active
      ? `Runaway carts (wave ${cartRush.wave}/${cartRush.maxWaves}) — sidestep or reach the green zone!`
      : null
  );

  const reset = () => {
    bag.held = false;
    bag.x = quests.bag ? GORG.shopper.x + 0.6 : GORG.bagPos.x;
    bag.z = quests.bag ? GORG.shopper.z + 0.4 : GORG.bagPos.z;
    bball.x = GORG.ballPos.x;
    bball.z = GORG.ballPos.z;
    bball.y = Y + 0.15;
    bball.vx = bball.vy = bball.vz = 0;
    bball.shooting = false;
    tram.reset();
    cartRush.reset();
    for (const cm of cartMeshes) cm.visible = false;
  };

  const restore = (doneKeys: ReadonlySet<string>) => {
    if (doneKeys.has('gorg:bag')) quests.bag = true;
    if (doneKeys.has('gorg:hoop')) quests.hoop = true;
    if (doneKeys.has('gorg:tram')) quests.tram = true;
    if (doneKeys.has('gorg:bridgeS')) bridges.S = true;
    if (doneKeys.has('gorg:bridgeN')) bridges.N = true;
    if (doneKeys.has('gorg:carts')) cartRush.survivedOnce = true;
    doneCount = Number(quests.bag) + Number(quests.hoop) + Number(quests.tram);
    bridgeCount = Number(bridges.S) + Number(bridges.N);
    if (quests.bag) {
      bag.x = GORG.shopper.x + 0.6;
      bag.z = GORG.shopper.z + 0.4;
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
    busy: () => cartRush.active,
    cartsActive: () => cartRush.active,
    quests: () => ({ ...quests }),
    bridges: () => ({ ...bridges }),
    bubbles: () => [
      { id: 'shopper', x: GORG.shopper.x, y: Y + 2.1, z: GORG.shopper.z },
      { id: 'baller', x: GORG.baller.x, y: Y + 2.1, z: GORG.baller.z },
      { id: 'commuter', x: GORG.commuter.x, y: Y + 2.1, z: GORG.commuter.z },
      { id: 'tramStop', x: tram.x, y: Y + 3.0, z: tram.z },
    ],
    debug: {
      tram,
      cartRush,
      bag,
      bball,
      playmate,
      bridges,
      startCarts: () => {
        if (cartRush.active || !(ctx.canStartThreat?.() ?? true)) return false;
        cartRush.start(dog.x);
        return true;
      },
    },
  };
}

export type GorgLife = ReturnType<typeof createGorgLife>;
