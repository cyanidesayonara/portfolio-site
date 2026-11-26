/*
  3D presentation, telegraphs, and animation for Boss #1: El Mico de Bronze.
  Owns the oversized articulated bronze statue at West Quay (Moll de Ponent),
  its thrown bronze jugs, dizzy stun stars, and HUD boss-bar wiring.
*/
import * as THREE from 'three';
import { M, box, cyl, sphere, rod, shadowed } from './models';
import { collapseRig } from './bake';
import { MARINA } from './marina';
import { MARINA_GROUND_Y } from './marinaGeom';
import { MicoState, MICO_HOME, MICO_PLAYER_MAX_HITS } from './micoLogic';
import type { Hud } from './hud';
import type { WalkAudio } from './audio';
import type { FeelState, TelegraphPool } from './telegraph';

export interface MicoBossCtx {
  addObject: <T extends THREE.Object3D>(o: T) => T;
  hud: Hud;
  audio: WalkAudio;
  telegraphs: TelegraphPool;
  feel: FeelState;
  dog: { x: number; y: number; z: number; vx: number; vz: number };
  humanSay: (text: string, ttl?: number, tone?: 'paper' | 'win' | 'loud') => void;
  addBones: (n: number, why?: string) => void;
  completeGoal: (id: string) => void;
  onDone?: (key: string) => void;
  burst: (x: number, y: number, z: number, color: number, n?: number, spd?: number, up?: number, life?: number, g?: number) => void;
  onHitDog: (vx: number, vz: number, vy?: number) => void;
  canStart: () => boolean;
}

const Y = MARINA_GROUND_Y;
const PLINTH_TOP = 0.9;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function buildMicoRig() {
  const root = new THREE.Group();
  const bronze = M(0x8c6533, 0.34, 0.8);
  const bright = M(0xb28748, 0.3, 0.76);
  const darkBronze = M(0x4b341a, 0.45, 0.7);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffd27a, emissive: 0xff9a2a, emissiveIntensity: 0.7, roughness: 0.25,
  });

  // Core torso & head group (rotates / bounces during slams & chest beats).
  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = 1.05;
  root.add(torsoPivot);

  const belly = sphere(0.56, bronze, 14, 10);
  belly.scale.set(0.95, 1.24, 0.9);
  belly.position.y = 0.2;
  torsoPivot.add(belly);

  const chest = sphere(0.46, bright, 12, 10);
  chest.scale.set(0.85, 0.92, 0.7);
  chest.position.set(0.18, 0.3, 0);
  torsoPivot.add(chest);

  const head = sphere(0.38, bronze, 14, 10);
  head.position.set(0.1, 1.05, 0);
  torsoPivot.add(head);

  const muzzle = sphere(0.24, bright, 12, 8);
  muzzle.scale.set(0.75, 0.88, 1.0);
  muzzle.position.set(0.36, 0.96, 0);
  torsoPivot.add(muzzle);

  for (const s of [-1, 1]) {
    const ear = sphere(0.13, bronze, 10, 8);
    ear.scale.set(0.5, 1, 1);
    ear.position.set(0.06, 1.1, s * 0.36);
    torsoPivot.add(ear);

    const eye = sphere(0.065, eyeMat, 8, 6);
    eye.position.set(0.42, 1.12, s * 0.14);
    torsoPivot.add(eye);
  }

  // Signature coastal promenade bronze bottle held close to the hip when on plinth.
  const bottle = cyl(0.08, 0.11, 0.46, bright, 10);
  bottle.position.set(0.25, 0.15, -0.36);
  bottle.rotation.z = -0.35;
  torsoPivot.add(bottle);

  // Articulated arms.
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(0.05, 0.65, s * 0.48);
    sh.add(rod(V(0, 0, 0), V(0.35, -0.58, s * 0.12), 0.11, bronze, 8));
    const fist = sphere(0.14, bright, 10, 8);
    fist.position.set(0.35, -0.58, s * 0.12);
    sh.add(fist);
    torsoPivot.add(sh);
    arms.push(sh);
  }

  // Legs + curled bronze tail.
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(-0.02, 0.85, s * 0.28);
    hip.add(rod(V(0, 0, 0), V(0.18, -0.82, 0), 0.13, bronze, 8));
    const foot = box(0.34, 0.12, 0.2, darkBronze);
    foot.position.set(0.24, -0.8, 0);
    hip.add(foot);
    root.add(hip);
    legs.push(hip);
  }

  const tail = new THREE.Group();
  tail.position.set(-0.42, 0.95, 0);
  tail.add(rod(V(0, 0, 0), V(-0.55, 0.55, 0.12), 0.065, bronze, 8));
  tail.add(rod(V(-0.55, 0.55, 0.12), V(-0.32, 0.95, 0.25), 0.055, bright, 8));
  root.add(tail);

  // Dizzy gold stars halo when stunned.
  const stars = new THREE.Group();
  stars.position.set(0.08, 2.75, 0);
  const starMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, emissive: 0xffb020, emissiveIntensity: 0.9, roughness: 0.2 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const st = box(0.16, 0.16, 0.16, starMat);
    st.position.set(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6);
    st.rotation.y = Math.PI / 4;
    stars.add(st);
  }
  stars.visible = false;
  root.add(stars);

  root.scale.setScalar(1.38);
  shadowed(root);
  collapseRig(root);
  return { root, torsoPivot, arms, legs, tail, stars, eyeMat };
}

function buildPlinth() {
  const g = new THREE.Group();
  const stone = M(0xb9b1a0, 0.85);
  const rim = M(0x8c6533, 0.4, 0.65);
  const base = box(2.3, PLINTH_TOP, 2.3, stone);
  base.position.y = PLINTH_TOP / 2;
  g.add(base);
  const plaque = box(1.2, 0.45, 0.1, rim);
  plaque.position.set(1.16, 0.48, 0);
  g.add(plaque);
  shadowed(g);
  collapseRig(g);
  return g;
}

function buildJugMesh() {
  const g = new THREE.Group();
  const body = cyl(0.18, 0.22, 0.52, M(0x9a7340, 0.35, 0.72), 10);
  const neck = cyl(0.08, 0.12, 0.16, M(0xc8a260, 0.35, 0.7), 8);
  neck.position.y = 0.32;
  g.add(body, neck);
  g.visible = false;
  shadowed(g);
  collapseRig(g);
  return g;
}

/** Instantiates and drives Boss #1 (El Mico de Bronze) inside the Marina district. */
export function createMicoBoss(ctx: MicoBossCtx) {
  const state = new MicoState();

  const plinth = ctx.addObject(buildPlinth());
  plinth.position.set(MICO_HOME.x, Y, MICO_HOME.z);

  const rig = buildMicoRig();
  ctx.addObject(rig.root);

  const jugMeshes = [0, 1, 2].map(() => ctx.addObject(buildJugMesh()));
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  const startFight = () => {
    if (state.active || !ctx.canStart()) return false;
    state.start();
    ctx.hud.shout('EL MICO AWAKES!', 'loud');
    ctx.hud.toast('Boss fight', 'Lure his red charge into a harbor bollard — or whirl him on a pole — then bark [E]!', '#ffb020', 5);
    ctx.humanSay('Wait… did the bronze statue just blink?!', 2.4, 'loud');
    ctx.audio.bell({ x: state.x, z: state.z });
    ctx.feel.kick(0.28);
    ctx.burst(MICO_HOME.x, Y + 1.4, MICO_HOME.z, 0xd8a852, 24, 3.2, 3.2, 0.75, 5);
    return true;
  };

  const applyKnockback = (srcX: number, srcZ: number, spd: number, up = 2.6) => {
    const dx = ctx.dog.x - srcX, dz = ctx.dog.z - srcZ;
    const d = Math.hypot(dx, dz) || 1;
    ctx.onHitDog((dx / d) * spd, (dz / d) * spd, up);
    ctx.hud.flash('rgba(255, 115, 42, 0.32)');
    ctx.audio.whine();
    ctx.feel.kick(0.34);
    ctx.feel.hitstop(0.08);
    const left = Math.max(0, MICO_PLAYER_MAX_HITS - state.playerHits);
    ctx.hud.shout(left > 0 ? `CLOBBERED! (${left} left)` : 'KNOCKED DOWN!', 'bad');
  };

  const update = (dt: number, time: number, nearMarina: boolean) => {
    if (!nearMarina) {
      if (state.active) {
        state.reset();
        ctx.hud.setBoss(null);
      }
      plinth.visible = false;
      rig.root.visible = false;
      for (const jm of jugMeshes) jm.visible = false;
      return;
    }

    plinth.visible = true;
    rig.root.visible = true;

    const events = state.step(dt, ctx.dog, MARINA.arenaBollards);

    if (events.fled) {
      ctx.hud.setBoss(null);
      ctx.hud.toast('Retreated', 'El Mico stepped back onto his plinth at West Quay.', '#ffb020', 2.5);
    }
    if (events.landed) {
      ctx.burst(events.landed.x, Y + 0.2, events.landed.z, 0xd8a852, 22, 4.2, 2.8, 0.65, 6);
      ctx.audio.land();
      ctx.feel.kick(0.3);
    }
    if (events.tossed) {
      ctx.audio.howl({ x: state.x, z: state.z }, 0.7);
      ctx.hud.say('mico', 'Tasta això!', 1.3, 'loud');
    }
    for (const imp of events.jugImpacts) {
      ctx.burst(imp.x, Y + 0.2, imp.z, 0xffb020, 14, 2.8, 2.4, 0.55, 5);
      ctx.audio.click();
    }
    if (events.chargeStarted) {
      ctx.hud.say('mico', 'Aaaaargh!', 1.2, 'loud');
      ctx.audio.honk({ x: state.x, z: state.z });
    }
    if (events.bollardBonk) {
      ctx.burst(events.bollardBonk.x, Y + 0.9, events.bollardBonk.z, 0xffd25a, 28, 4.4, 3.6, 0.75, 5);
      ctx.audio.bell(events.bollardBonk);
      ctx.feel.kick(0.38);
      ctx.feel.hitstop(0.09);
      ctx.hud.shout('BOLLARD BONK!', 'good');
      ctx.hud.say('mico', 'Ai! El norai!!', 2.2, 'loud');
    }
    if (events.playerHit) {
      applyKnockback(state.x, state.z, events.playerHit === 'charge' ? 8.0 : 6.2);
    }
    if (events.bossWon) {
      ctx.hud.toast('Knocked silly', 'El Mico reclaimed his plinth! Bark [E] whenever you want a rematch.', '#ff6b5a', 3.5);
    }

    // Settle defeated boss cleanly back onto plinth pose after victory fanfare.
    if (state.state === 'defeated' && state.stateT >= state.dur) {
      state.reset();
    }

    // Telegraphs during active fight.
    if (state.state === 'leapWindup' || state.state === 'leapAir') {
      const fill = state.state === 'leapWindup' ? clamp(state.stateT / Math.max(0.01, state.dur), 0.1, 1) : 1;
      ctx.telegraphs.ring(state.tx, Y + 0.05, state.tz, 3.0, fill, 0xff8a2a);
    }
    if (state.state === 'chargeWindup' || state.state === 'charging') {
      const fill = state.state === 'chargeWindup' ? clamp(state.stateT / Math.max(0.01, state.dur), 0.1, 1) : 1;
      ctx.telegraphs.lane(state.sx, state.sz, state.tx, state.tz, Y + 0.05, 2.4, fill, 0xff4a3d);
      if (state.state === 'chargeWindup') {
        const sortedBollards = [...MARINA.arenaBollards].sort(
          (a, b) => Math.hypot(a[0] - ctx.dog.x, a[1] - ctx.dog.z) - Math.hypot(b[0] - ctx.dog.x, b[1] - ctx.dog.z),
        );
        for (let i = 0; i < 2; i++) {
          const [bx, bz] = sortedBollards[i];
          ctx.telegraphs.beacon(bx, Y + 0.05, bz, 1.45, time, 0x5eea8c);
        }
      }
    }
    if (state.state === 'stunned') {
      ctx.telegraphs.beacon(state.x, Y + 0.05, state.z, 2.6, time, 0xffc93c);
    }
    state.jugs.forEach((j, idx) => {
      const jm = jugMeshes[idx];
      if (!j.active) { jm.visible = false; return; }
      const u = clamp(j.t / Math.max(0.01, j.dur), 0, 1);
      ctx.telegraphs.ring(j.tx, Y + 0.05, j.tz, j.r, u, 0xffb020);
      jm.visible = true;
      jm.position.set(
        j.sx + (j.tx - j.sx) * u,
        Y + 0.35 + Math.sin(u * Math.PI) * 5.0,
        j.sz + (j.tz - j.sz) * u,
      );
      jm.rotation.x += dt * 7;
      jm.rotation.z += dt * 5.5;
    });

    // Position and animate 3D statue rig.
    const onPlinth = state.state === 'dormant';
    const baseY = onPlinth ? Y + PLINTH_TOP : Y + state.y;
    rig.root.position.set(state.x, baseY, state.z);
    rig.root.rotation.y = onPlinth ? 0 : -state.heading;
    rig.stars.visible = state.state === 'stunned';

    rig.eyeMat.emissive.setHex(
      onPlinth ? 0x6a4a24
        : state.state === 'stunned' ? 0xffe46a
          : state.phase === 3 ? 0xff3b2f
            : state.phase === 2 ? 0xff7a22 : 0xffb020,
    );
    rig.eyeMat.emissiveIntensity = onPlinth ? 0.15 : 0.95 + Math.sin(time * 8) * 0.25;

    if (state.state === 'stunned') {
      rig.stars.rotation.y = time * 4.5;
      rig.torsoPivot.rotation.z = Math.sin(time * 9) * 0.14;
      rig.torsoPivot.rotation.x = 0.22;
      rig.arms[0].rotation.z = 0.4;
      rig.arms[1].rotation.z = -0.4;
      rig.legs[0].rotation.z = 0;
      rig.legs[1].rotation.z = 0;
    } else if (state.state === 'intro' || state.state === 'recover' || state.state === 'tossWindup' || state.state === 'leapWindup') {
      const raise = 1.6 + Math.abs(Math.sin(time * 10)) * 0.5;
      rig.torsoPivot.rotation.z = 0;
      rig.torsoPivot.rotation.x = state.state === 'leapWindup' ? -0.25 : 0.08;
      rig.arms[0].rotation.z = -raise;
      rig.arms[1].rotation.z = raise;
      rig.legs[0].rotation.z = 0;
      rig.legs[1].rotation.z = 0;
    } else if (state.state === 'charging' || state.state === 'pace') {
      const cy = Math.sin(time * (state.state === 'charging' ? 18 : 8));
      rig.torsoPivot.rotation.z = cy * 0.08;
      rig.torsoPivot.rotation.x = state.state === 'charging' ? 0.35 : 0.1;
      rig.arms[0].rotation.z = cy * 0.7;
      rig.arms[1].rotation.z = -cy * 0.7;
      rig.legs[0].rotation.z = -cy * 0.65;
      rig.legs[1].rotation.z = cy * 0.65;
    } else {
      rig.torsoPivot.rotation.z = 0;
      rig.torsoPivot.rotation.x = 0;
      rig.arms[0].rotation.z = 0.12;
      rig.arms[1].rotation.z = -0.12;
      rig.legs[0].rotation.z = 0;
      rig.legs[1].rotation.z = 0;
    }
    rig.tail.rotation.y = Math.sin(time * (onPlinth ? 0 : 4)) * 0.25;

    // HUD Boss bar.
    if (state.active) {
      const hint = state.state === 'stunned'
        ? 'DIZZY! Run in and press [E] to super-bark!'
        : state.state === 'chargeWindup' || state.state === 'charging'
          ? 'Bait his red charge into a green-lit bollard!'
          : 'Dodge attacks and bait a charge into a bollard (or pole-whirl him)!';
      ctx.hud.setBoss({
        name: 'EL MICO DE BRONZE',
        hp: state.hp,
        maxHp: state.maxHp,
        phase: `Phase ${state.phase}/3`,
        hint,
        accent: state.state === 'stunned' ? '#ffc93c' : state.phase === 3 ? '#ff4a3d' : '#ffb020',
      });
    } else {
      ctx.hud.setBoss(null);
    }
  };

  const bark = () => {
    if (state.state === 'dormant' && Math.hypot(ctx.dog.x - MICO_HOME.x, ctx.dog.z - MICO_HOME.z) < 6.8) {
      return startFight();
    }
    if (state.state === 'stunned') {
      const res = state.tryBarkHit(ctx.dog.x, ctx.dog.z);
      if (res === 'hit') {
        ctx.audio.bark();
        ctx.audio.bell({ x: state.x, z: state.z });
        ctx.feel.hitstop(0.1);
        ctx.feel.kick(0.42);
        ctx.burst(state.x, Y + 1.5, state.z, 0xffd25a, 30, 4.5, 4.0, 0.85, 5);
        ctx.hud.shout(`CLANG! PHASE ${state.phase}`, 'good');
        ctx.hud.say('mico', state.phase === 3 ? 'Prou de bromes!' : 'Grrr… més fort!', 2.0, 'loud');
        return true;
      }
      if (res === 'defeated') {
        ctx.audio.bark();
        ctx.audio.goal();
        ctx.audio.firework({ x: state.x, z: state.z });
        ctx.feel.hitstop(0.12);
        ctx.feel.kick(0.5);
        ctx.burst(state.x, Y + 1.8, state.z, 0xffc93c, 45, 5.5, 5.2, 1.1, 4);
        ctx.hud.shout('MICO BESTED! +12', 'loud');
        ctx.hud.setBoss(null);
        ctx.addBones(12);
        ctx.onDone?.('marina:mico');
        ctx.completeGoal('marina_mico');
        ctx.humanSay('You outsmarted the bronze monkey himself!', 2.6, 'win');
        return true;
      }
    }
    return false;
  };

  const onWhirl = (poleX: number, poleZ: number) => {
    if (!state.active || Math.hypot(poleX - state.x, poleZ - state.z) > 12) return false;
    if (!state.triggerStun('whirl')) return false;
    ctx.burst(state.x, Y + 1.4, state.z, 0xffc93c, 26, 4.0, 3.6, 0.75, 5);
    ctx.audio.bell({ x: state.x, z: state.z });
    ctx.feel.kick(0.36);
    ctx.feel.hitstop(0.08);
    ctx.hud.shout('WHIRL STUN!', 'good');
    ctx.hud.say('mico', 'Estic marejat!!', 2.0, 'loud');
    return true;
  };

  const prompt = (): { key: string; label: string } | null => {
    if (state.state === 'dormant' && ctx.canStart() && Math.hypot(ctx.dog.x - MICO_HOME.x, ctx.dog.z - MICO_HOME.z) < 6.8) {
      return { key: 'E', label: state.defeatedOnce ? 'Rematch El Mico de Bronze' : 'Challenge El Mico de Bronze' };
    }
    if (state.state === 'stunned' && Math.hypot(ctx.dog.x - state.x, ctx.dog.z - state.z) < 5.2) {
      return { key: 'E', label: 'Super-bark El Mico!' };
    }
    return null;
  };

  const reset = () => {
    state.reset();
    ctx.hud.setBoss(null);
  };

  const restore = (doneKeys: ReadonlySet<string>) => {
    if (doneKeys.has('marina:mico')) state.defeatedOnce = true;
  };

  return {
    state,
    get active() { return state.active; },
    start: startFight,
    update,
    bark,
    onWhirl,
    prompt,
    reset,
    restore,
  };
}
