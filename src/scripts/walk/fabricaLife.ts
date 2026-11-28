/*
  La Fàbrica at runtime: the baker's lost bread bag, the kid's ball herded across
  the avenue, the Ferreteria's roller shutter, the chimney sniff, the seventh
  pipicà's resident dog, and runaway recycling bins rolling down the avenue.
*/
import * as THREE from 'three';
import { makePerson, makeDog, M, box, cyl, sphere, shadowed } from './models';
import { collapseRig } from './bake';
import { FABRICA } from './fabrica';
import { FABRICA_AVENUE, FABRICA_GROUND_Y, clampFabrica, inFabricaPipica } from './fabricaGeom';
import { BinRushState, BIN_LANES, BIN_START_Z, BIN_TRIGGER, ShutterState, SHUTTER_BARK_R } from './fabricaLogic';
import type { Hud } from './hud';
import type { WalkAudio } from './audio';
import type { FeelState, TelegraphPool } from './telegraph';

export type FabricaItem = 'fabricaBread';
export const isFabricaItem = (c: string | null): c is FabricaItem => c === 'fabricaBread';

type P = { x: number; z: number };

export interface FabricaCtx {
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

const Y = FABRICA_GROUND_Y;
const VIEW = 110;
const CHIMNEY_SNIFF_R = 3.4;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);
const angLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

/** A green wheelie recycling container that tumbles end over end. */
function makeRecyclingBin() {
  const g = new THREE.Group();
  const body = box(0.9, 1.15, 0.85, M(0x2f7d3a, 0.6));
  const lid = box(0.96, 0.1, 0.92, M(0x24612d, 0.55));
  lid.position.y = 0.62;
  const stripe = box(0.92, 0.12, 0.87, M(0xf2ede0, 0.6));
  stripe.position.y = 0.2;
  g.add(body, lid, stripe);
  for (const wx of [-0.32, 0.32]) {
    const wh = cyl(0.13, 0.13, 0.08, M(0x22262e, 0.8), 8);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(wx, -0.5, 0.36);
    g.add(wh);
  }
  shadowed(g);
  collapseRig(g);
  g.visible = false;
  return g;
}

function makeBreadBag() {
  const g = new THREE.Group();
  const bag = box(0.32, 0.22, 0.16, M(0xe9d7b0, 0.85));
  bag.position.y = 0.11;
  const loaf = box(0.12, 0.08, 0.46, M(0xc98a3e, 0.7));
  loaf.position.set(0.04, 0.24, 0);
  loaf.rotation.x = 0.25;
  g.add(bag, loaf);
  shadowed(g);
  collapseRig(g);
  return g;
}

function makeKidBall() {
  const g = new THREE.Group();
  g.add(sphere(0.16, M(0xe5487a, 0.5), 12, 10));
  shadowed(g);
  collapseRig(g);
  return g;
}

function makeShutter() {
  const g = new THREE.Group();
  const slats = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.0, 0.05), M(0x9aa1a8, 0.45, 0.4));
  slats.position.y = -1.5; // pivot at the top so scaling lowers it from the housing
  const holder = new THREE.Group();
  holder.add(slats);
  const housing = box(5.4, 0.36, 0.3, M(0x6d7278, 0.5, 0.3));
  housing.position.y = 0.18;
  g.add(holder, housing);
  return { group: g, holder };
}

/** Instantiates and updates La Fàbrica's runtime life, quests, and the bin rush. */
export function createFabricaLife(ctx: FabricaCtx) {
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
  const mouth = () => ({
    x: dog.x + Math.cos(dog.heading) * 0.55,
    y: dog.y + 0.55,
    z: dog.z + Math.sin(dog.heading) * 0.55,
  });

  const quests = { bread: false, ball: false, shutter: false };
  let doneCount = 0;
  let sniffedChimney = false;

  const finishQuest = (k: keyof typeof quests, msg: string, reward: number) => {
    if (quests[k]) return;
    quests[k] = true;
    doneCount++;
    ctx.onDone?.(`fabrica:${k}`);
    ctx.addBones(reward, msg);
    ctx.bumpGoal('fabrica_quests', doneCount);
  };

  const saidT: Record<string, number> = {};
  const say = (id: string, text: string, ttl = 2, tone: 'paper' | 'win' | 'loud' = 'paper', every = 0) => {
    if (every && (saidT[id] ?? 0) > 0) return;
    saidT[id] = every;
    hud.say(id, text, ttl, tone);
  };

  // ---- NPCs ----
  const baker = person(
    { top: 0xf4f1ea, trousers: 0x3a404c, hair: 0x2a1d14, hairStyle: 'short', prop: 'none' },
    FABRICA.baker.x, FABRICA.baker.z, Math.PI,
  );
  const kid = person(
    { top: 0x1fc9b7, trousers: 0x3d73c7, hair: 0x6b4026, hairStyle: 'ponytail', prop: 'none', shorts: true, height: 0.72 },
    FABRICA.kid.x, FABRICA.kid.z, Math.PI,
  );
  const shopkeeper = person(
    { top: 0x855c85, trousers: 0x40455c, hair: 0x8a8a8a, hairStyle: 'bald', prop: 'none' },
    FABRICA.shopkeeper.x, FABRICA.shopkeeper.z, -Math.PI / 2,
  );

  const PP = FABRICA.pipica;
  const playmateM = makeDog({
    fur: 0xf4efe2, dark: 0x2a2624, muzzle: 0xf4efe2, paws: 0xf4efe2, collar: 0xd98c2b, scale: 0.62, ears: 'drop',
  });
  add(collapseRig(playmateM.group));
  const playmate = { x: (PP.x0 + PP.x1) / 2, z: (PP.z0 + PP.z1) / 2, tx: PP.x1 - 3, tz: PP.z0 + 3, heading: 0, t: 1.0 };

  // ---- Props ----
  const breadM = add(makeBreadBag());
  const bread = { x: FABRICA.breadPos.x, z: FABRICA.breadPos.z, held: false };

  const ballM = add(makeKidBall());
  const kball = { x: FABRICA.ballPos.x, z: FABRICA.ballPos.z, vx: 0, vz: 0 };

  const shutter = new ShutterState();
  const shutterM = makeShutter();
  shutterM.group.position.set(FABRICA.shop.x, Y + 3.2, FABRICA.shop.z - 0.12);
  add(shutterM.group);

  const binRush = new BinRushState();
  const binMeshes = BIN_LANES.map(() => {
    const m = makeRecyclingBin();
    scene.add(m);
    return m;
  });
  let autoRushUsed = false;

  const startRush = (why: 'walk' | 'bark') => {
    binRush.start(dog.x);
    hud.shout('BINS LOOSE!', 'loud');
    ctx.humanSay(why === 'walk' ? 'That gust just knocked the bins loose!' : 'Millie, the bins!', 2.2, 'loud');
    hud.toast('Runaway bins', 'Duck into the tree line down the middle and let them roll past!', '#ff6b5a', 4);
    audio.whoosh(0.8);
    ctx.feel.kick(0.22);
  };

  const update = (dt: number, time: number) => {
    for (const k in saidT) saidT[k] -= dt;
    const near = dist(dog, FABRICA.center) < VIEW;
    for (const o of all) o.visible = near;
    if (!near) {
      if (binRush.active) binRush.reset();
      for (const bm of binMeshes) bm.visible = false;
      return;
    }

    baker.animate(time, { speed: 0, pose: 'stand' });
    kid.animate(time + 1.3, { speed: 0, pose: 'stand' });
    shopkeeper.animate(time + 2.1, { speed: 0, pose: 'stand' });

    // Goal: sniff out the old chimney.
    if (!sniffedChimney && dist(dog, FABRICA.chimney) < CHIMNEY_SNIFF_R) {
      sniffedChimney = true;
      ctx.onDone?.('fabrica:chimney');
      ctx.addBones(3, 'OLD CHIMNEY');
      ctx.completeGoal('fabrica_chimney');
      ctx.humanSay('That chimney is older than the whole street.', 2.4, 'paper');
    }

    // Quest 1: the baker's bread bag.
    if (!quests.bread && !bread.held && dist(dog, FABRICA.baker) < 4.5) {
      say('baker', 'Algú ha perdut una bossa de pa al final de l’avinguda!', 2.4, 'paper', 10);
    }
    if (bread.held) {
      const mp = mouth();
      breadM.position.set(mp.x, mp.y - 0.1, mp.z);
      breadM.rotation.y = -dog.heading;
    } else {
      breadM.position.set(bread.x, Y + (quests.bread ? 0.0 : 0.02 + Math.sin(time * 3) * 0.03), bread.z);
      breadM.rotation.y = quests.bread ? 0 : time * 0.9;
    }

    // Quest 2: herd the kid's ball across the avenue into the square.
    {
      const bd = dist(dog, kball);
      if (!quests.ball && bd < 0.6 && Math.hypot(dog.vx, dog.vz) > 0.4) {
        const dx = (kball.x - dog.x) / (bd || 1), dz = (kball.z - dog.z) / (bd || 1);
        kball.vx = dx * 4.0 + dog.vx * 0.5;
        kball.vz = dz * 4.0 + dog.vz * 0.5;
        audio.click();
      }
      kball.vx *= Math.max(0, 1 - dt * 1.7);
      kball.vz *= Math.max(0, 1 - dt * 1.7);
      const c = clampFabrica(kball.x + kball.vx * dt, kball.z + kball.vz * dt);
      kball.x = c.x;
      kball.z = c.z;
      ballM.position.set(kball.x, Y + 0.16, kball.z);
      ballM.rotation.x += kball.vz * dt * 6;
      ballM.rotation.z -= kball.vx * dt * 6;
      if (!quests.ball && dist(dog, FABRICA.kid) < 5) say('kid', 'La meva pilota és a l’altra banda!', 2.2, 'paper', 10);
      if (!quests.ball && dist(kball, FABRICA.kid) < 2.0) {
        kball.vx = kball.vz = 0;
        say('kid', 'Gràcies, gosseta!', 2.4, 'win');
        ctx.burst(FABRICA.kid.x, Y + 1.0, FABRICA.kid.z, 0xe5487a, 14, 2.4, 2.2, 0.6, 5);
        audio.chime();
        finishQuest('ball', 'BALL HERDED', 4);
      }
    }

    // Quest 3: the Ferreteria's shutter comes down as Millie approaches.
    {
      const sd = dist(dog, FABRICA.shop);
      if (!quests.shutter && shutter.notice(sd)) {
        say('shopkeeper', 'Tanquem, tanquem! Ja és l’hora.', 2.4, 'paper');
        hud.toast('Ferreteria', 'The shutter is coming down. Bark [E] to ask for one more customer!', '#c2412d', 3.5);
      }
      const ev = shutter.step(dt);
      if (ev.closed) say('shopkeeper', 'Tancat! Torneu més tard.', 2.2, 'paper');
      if (ev.reopened) say('shopkeeper', 'Bé, obro una estoneta més.', 2.0, 'paper');
      shutterM.holder.scale.y = Math.max(0.001, shutter.level);
    }

    // Pipicà 7's resident dog.
    playmate.t -= dt;
    if (playmate.t <= 0) {
      playmate.t = rand(1.3, 3.4);
      playmate.tx = rand(PP.x0 + 1.4, PP.x1 - 1.4);
      playmate.tz = rand(PP.z0 + 1.4, PP.z1 - 1.4);
    }
    const pdx = playmate.tx - playmate.x, pdz = playmate.tz - playmate.z, pdd = Math.hypot(pdx, pdz);
    const psp = pdd > 0.4 ? (inFabricaPipica(dog.x, dog.z) && ctx.offLeash() ? 3.8 : 2.1) : 0;
    if (pdd > 0.4) {
      playmate.x += (pdx / pdd) * psp * dt;
      playmate.z += (pdz / pdd) * psp * dt;
      playmate.heading = angLerp(playmate.heading, Math.atan2(pdz, pdx), dt * 8);
    }
    playmateM.group.position.set(playmate.x, Y, playmate.z);
    playmateM.group.rotation.y = -playmate.heading;
    playmateM.animate(time + 3, { speed: psp, dig: false, peeing: false, wag: 0.9, air: false });

    // Chase: the first walk up the avenue sets the bins loose; after that, bark to rattle them again.
    if (!autoRushUsed && !binRush.survivedOnce && binRush.canTrigger(dog, !(ctx.canStartThreat?.() ?? true))) {
      autoRushUsed = true;
      startRush('walk');
    }
    const ev = binRush.step(dt, dog);
    if (ev.startedRush) {
      audio.click();
      hud.shout('HERE THEY ROLL!', 'loud');
    }
    if (ev.nextWave) {
      hud.shout('SECOND GUST!', 'loud');
      audio.whoosh(0.9);
    }
    if (ev.hit) {
      const dx = dog.x - ev.hit.x;
      ctx.onHitDog?.((Math.abs(dx) > 0.15 ? Math.sign(dx) : 1) * 5.2, -3.8, 2.2);
      hud.flash('rgba(255, 90, 54, 0.34)');
      audio.whine();
      audio.stumble();
      ctx.feel.kick(0.34);
      ctx.feel.hitstop(0.08);
      ctx.burst(dog.x, dog.y + 0.45, dog.z, 0x2f7d3a, 14, 2.6, 2.4, 0.55, 5);
      hud.shout('BIN BUMP!', 'bad');
    }
    if (ev.leftAvenue) hud.shout('THE BINS ROLL ON WITHOUT YOU', 'bad');
    if (ev.survived) {
      hud.shout('DODGED THE BINS! +6', 'good');
      audio.goal();
      ctx.feel.kick(0.2);
      ctx.addBones(6);
      ctx.onDone?.('fabrica:bins');
      ctx.completeGoal('fabrica_bins');
      ctx.humanSay('Who leaves bins unlocked on a windy day?', 2.0, 'win');
    }

    if (binRush.active) {
      for (let i = 0; i < binRush.bins.length; i++) {
        const b = binRush.bins[i];
        const bm = binMeshes[i];
        if (binRush.phase === 'warning') {
          const fill = clamp(binRush.t / Math.max(0.01, binRush.warnDur) - b.delay * 0.25, 0.08, 1);
          ctx.telegraphs.lane(b.x, BIN_START_Z - 1, b.x, 40, Y + 0.05, 1.7, fill, 0xff5a36);
          bm.visible = true;
          bm.position.set(b.x, Y + 0.62, BIN_START_Z);
          bm.rotation.set(Math.sin(time * 14 + i) * 0.08, 0, 0);
        } else if (b.active && !b.passed) {
          ctx.telegraphs.lane(b.x, b.z, b.x, 40, Y + 0.05, 1.6, 0.9, 0xff3b2f);
          bm.visible = true;
          bm.position.set(b.x, Y + 0.62, b.z);
          bm.rotation.set(-b.roll, 0, 0);
        } else {
          bm.visible = false;
        }
      }
      ctx.telegraphs.beacon(FABRICA_AVENUE.midX, Y + 0.06, 70, 1.4, time, 0x5eea8c);
    } else {
      for (const bm of binMeshes) bm.visible = false;
    }
  };

  const pickup = () => {
    if (!quests.bread && !bread.held && dist(dog, bread) < 1.2) {
      bread.held = true;
      dog.carrying = 'fabricaBread';
      audio.pickup();
      hud.banner('Take the bread bag back to the Forn', 'news');
      return true;
    }
    return false;
  };

  const drop = (fx: number, fz: number) => {
    if (!isFabricaItem(dog.carrying)) return false;
    bread.held = false;
    bread.x = fx;
    bread.z = fz;
    if (!quests.bread && dist({ x: fx, z: fz }, FABRICA.baker) < 3.4) {
      bread.x = FABRICA.baker.x + 0.3;
      bread.z = FABRICA.baker.z - 0.6;
      say('baker', 'El pa de la senyora Rosa! Gràcies, bonica.', 2.4, 'win');
      finishQuest('bread', 'BREAD RETURNED', 4);
    }
    dog.carrying = null;
    audio.click();
    return true;
  };

  const bark = (): boolean => {
    if (dist(dog, FABRICA.center) >= VIEW) return false;
    if (!quests.shutter && shutter.bark(dist(dog, FABRICA.shop))) {
      say('shopkeeper', 'Ui! Passa, passa, encara és obert.', 2.4, 'win');
      ctx.burst(FABRICA.shop.x, Y + 1.6, FABRICA.shop.z - 0.8, 0xc2412d, 12, 2.2, 2.0, 0.5, 5);
      audio.chime();
      finishQuest('shutter', 'SHOP STAYS OPEN', 4);
      return true;
    }
    if (
      !binRush.active && binRush.cooldown <= 0 && (ctx.canStartThreat?.() ?? true)
      && dog.x >= FABRICA_AVENUE.x0 && dog.x <= FABRICA_AVENUE.x1 && dog.z >= BIN_TRIGGER.z0 - 10 && dog.z <= BIN_TRIGGER.z1
    ) {
      startRush('bark');
      return true;
    }
    return false;
  };

  const prompt = (): string | null => {
    if (!quests.bread && !bread.held && !dog.carrying && dist(dog, bread) < 1.2) return 'Pick up the bread bag';
    return null;
  };

  const barkPrompt = (): string | null => {
    if (!quests.shutter && shutter.phase === 'closing' && dist(dog, FABRICA.shop) < SHUTTER_BARK_R) return 'Bark before it shuts';
    if (
      !binRush.active && binRush.cooldown <= 0 && (ctx.canStartThreat?.() ?? true)
      && dog.x >= FABRICA_AVENUE.x0 && dog.x <= FABRICA_AVENUE.x1 && dog.z >= BIN_TRIGGER.z0 - 10 && dog.z <= BIN_TRIGGER.z1
    ) {
      return binRush.survivedOnce ? 'Rattle the bins again' : 'Rattle the bins';
    }
    return null;
  };

  const banner = (): string | null => (
    binRush.active
      ? `Runaway bins (gust ${binRush.wave}/${binRush.maxWaves}): duck into the tree line!`
      : null
  );

  const reset = () => {
    bread.held = false;
    bread.x = quests.bread ? FABRICA.baker.x + 0.3 : FABRICA.breadPos.x;
    bread.z = quests.bread ? FABRICA.baker.z - 0.6 : FABRICA.breadPos.z;
    if (!quests.ball) {
      kball.x = FABRICA.ballPos.x;
      kball.z = FABRICA.ballPos.z;
    }
    kball.vx = kball.vz = 0;
    shutter.reset(quests.shutter);
    binRush.reset();
    autoRushUsed = false;
    for (const bm of binMeshes) bm.visible = false;
  };

  const restore = (doneKeys: ReadonlySet<string>) => {
    if (doneKeys.has('fabrica:bread')) {
      quests.bread = true;
      bread.x = FABRICA.baker.x + 0.3;
      bread.z = FABRICA.baker.z - 0.6;
    }
    if (doneKeys.has('fabrica:ball')) {
      quests.ball = true;
      kball.x = FABRICA.kid.x + 0.9;
      kball.z = FABRICA.kid.z;
    }
    if (doneKeys.has('fabrica:shutter')) {
      quests.shutter = true;
      shutter.reset(true);
    }
    if (doneKeys.has('fabrica:chimney')) sniffedChimney = true;
    if (doneKeys.has('fabrica:bins')) binRush.survivedOnce = true;
    doneCount = Number(quests.bread) + Number(quests.ball) + Number(quests.shutter);
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
    busy: () => binRush.active,
    binsActive: () => binRush.active,
    quests: () => ({ ...quests }),
    bubbles: () => [
      { id: 'baker', x: FABRICA.baker.x, y: Y + 2.1, z: FABRICA.baker.z },
      { id: 'kid', x: FABRICA.kid.x, y: Y + 1.6, z: FABRICA.kid.z },
      { id: 'shopkeeper', x: FABRICA.shopkeeper.x, y: Y + 2.1, z: FABRICA.shopkeeper.z },
    ],
    debug: {
      binRush,
      shutter,
      bread,
      kball,
      playmate,
      get sniffedChimney() { return sniffedChimney; },
      startBins: () => {
        if (binRush.active || !(ctx.canStartThreat?.() ?? true)) return false;
        binRush.start(dog.x);
        return true;
      },
    },
  };
}


export type FabricaLife = ReturnType<typeof createFabricaLife>;
