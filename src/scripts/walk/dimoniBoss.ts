/*
  3D runtime & visuals for Boss #2: El Dimoni Gegant on the beach.
  Upgrades the beach bonfire into a 3-phase battle with falling cinder rings,
  flaming pitchfork sweeps, flanking beach devils, seawater dousing, and
  devil counter-barks using the shared HUD boss bar.
*/
import * as THREE from 'three';
import { sphere } from './models';
import { DimoniState, DIMONI_POS, DIMONI_MAX_PLAYER_HITS } from './dimoniLogic';
import type { Hud } from './hud';
import type { WalkAudio } from './audio';
import type { FeelState, TelegraphPool } from './telegraph';

export interface BeachDevil {
  id: string;
  x: number;
  z: number;
  flank: number;
  person: { group: THREE.Group };
}

export interface DimoniBossCtx {
  scene: THREE.Scene;
  hud: Hud;
  audio: WalkAudio;
  telegraphs: TelegraphPool;
  feel: FeelState;
  dog: { x: number; y: number; z: number; vx: number; vz: number; wet: number };
  dimoni: { x: number; z: number; figure: THREE.Group; glow: THREE.PointLight };
  devils: BeachDevil[];
  waterY: number;
  floor: (x: number, z: number, y: number) => number;
  humanSay: (text: string, ttl?: number, tone?: 'paper' | 'win' | 'loud') => void;
  addBones: (n: number, why?: string) => void;
  completeGoal: (id: string) => void;
  onDone?: (key: string) => void;
  burst: (x: number, y: number, z: number, color: number, n?: number, spd?: number, up?: number, life?: number, g?: number) => void;
  consumeWet: () => void;
  onHitDog: (vx: number, vz: number, vy?: number) => void;
  onVictory: () => void;
  fireworksT: () => number;
  canStart: () => boolean;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Creates and drives the multi-phase El Dimoni Gegant beach boss. */
export function createDimoniBoss(ctx: DimoniBossCtx) {
  const state = new DimoniState();
  let wasBossBarOn = false;

  const cinderMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a });
  const cinders = Array.from({ length: 4 }, () => {
    const m = sphere(0.32, cinderMat, 10, 8);
    m.visible = false;
    ctx.scene.add(m);
    return m;
  });

  const hideBarIfNeeded = () => {
    if (!wasBossBarOn) return;
    wasBossBarOn = false;
    ctx.hud.setBoss(null);
  };

  const applyHit = (srcX: number, srcZ: number, kind: 'cinder' | 'lane' | 'devil') => {
    const dx = ctx.dog.x - srcX, dz = ctx.dog.z - srcZ;
    const d = Math.hypot(dx, dz) || 1;
    ctx.onHitDog((dx / d) * 6.5, (dz / d) * 6.5, 2.3);
    ctx.hud.flash('rgba(255, 74, 42, 0.34)');
    ctx.audio.whine();
    ctx.feel.kick(0.36);
    ctx.feel.hitstop(0.08);
    ctx.burst(ctx.dog.x, ctx.dog.y + 0.5, ctx.dog.z, 0xff6a1a, 18, 2.8, 2.6, 0.6, 5);
    const left = Math.max(0, DIMONI_MAX_PLAYER_HITS - state.playerHits);
    ctx.hud.shout(left > 0 ? `SINGED! (${left} left)` : 'TOO HOT!', 'bad');
    if (kind === 'devil') ctx.humanSay('Watch out for the devils!', 1.5, 'loud');
  };

  const spawnDevils = () => {
    ctx.devils.forEach((bd, i) => {
      const a = Math.atan2(ctx.dog.z - DIMONI_POS.z, ctx.dog.x - DIMONI_POS.x) + (i - 1) * 0.9;
      bd.x = DIMONI_POS.x + Math.cos(a) * 6.4;
      bd.z = DIMONI_POS.z + Math.sin(a) * 6.4;
      bd.person.group.visible = true;
      ctx.hud.say(bd.id, i === 1 ? 'Visca!' : 'Foc!', 1.5, 'loud');
    });
  };

  const handlePhaseDamage = (res: 'hit' | 'defeated', why: string) => {
    ctx.audio.bark();
    ctx.feel.hitstop(res === 'defeated' ? 0.12 : 0.09);
    ctx.feel.kick(res === 'defeated' ? 0.48 : 0.36);
    ctx.burst(DIMONI_POS.x, 2.2, DIMONI_POS.z, 0xbfe6ff, 34, 4.4, 4.6, 0.9, 4);
    if (res === 'defeated') {
      cinders.forEach((m) => { m.visible = false; });
      hideBarIfNeeded();
      ctx.hud.shout('DIMONI EXTINGUISHED! +12', 'loud');
      ctx.audio.goal();
      ctx.audio.firework(DIMONI_POS);
      ctx.addBones(12);
      ctx.onDone?.('seafront:dimoni');
      ctx.completeGoal('dimoni');
      ctx.humanSay('Now that is a proper Cremada!', 2.6, 'win');
      ctx.onVictory();
      return;
    }
    ctx.hud.shout(`${why}! PHASE ${state.phase}`, 'good');
    spawnDevils();
  };

  const startBattle = () => {
    if (state.active || ctx.fireworksT() > 0 || !ctx.canStart()) return false;
    state.start();
    spawnDevils();
    ctx.hud.shout('EL DIMONI BLAZES!', 'loud');
    ctx.hud.toast(
      'Beach boss fight',
      'Wade into the sea to soak your coat, then bark [E] near the bonfire to douse it — or counter-bark a lunging devil!',
      '#ff6a1a',
      5,
    );
    ctx.humanSay('Into the waves to soak up water — quick!', 2.4, 'loud');
    ctx.audio.firework(DIMONI_POS);
    ctx.audio.hey();
    ctx.feel.kick(0.28);
    return true;
  };

  const update = (dt: number, time: number) => {
    const events = state.step(dt, ctx.dog, ctx.devils);

    if (events.fled) {
      cinders.forEach((m) => { m.visible = false; });
      hideBarIfNeeded();
      ctx.hud.toast('Bonfire cooled', 'El Dimoni returned to smolder on the sand.', '#ff8a2a', 2.5);
      return;
    }
    if (events.cinderVolley) {
      ctx.audio.firework(DIMONI_POS);
      ctx.hud.say('dimoni', 'Espurnes!', 1.2, 'loud');
    }
    if (events.laneVolley) {
      ctx.audio.whoosh(1.25);
      ctx.hud.say('dimoni', 'Forca de foc!', 1.2, 'loud');
    }
    for (const imp of events.cinderImpacts) {
      const fy = ctx.floor(imp.x, imp.z, 0);
      ctx.burst(imp.x, fy + 0.35, imp.z, 0xff7a2a, 18, 2.8, 2.8, 0.55, 5);
      ctx.feel.kick(0.2);
    }
    for (const lf of events.laneFired) {
      const mx = (lf.x0 + lf.x1) * 0.5, mz = (lf.z0 + lf.z1) * 0.5;
      ctx.burst(mx, ctx.floor(mx, mz, 0) + 0.4, mz, 0xff4a3d, 22, 3.2, 3.0, 0.55, 5);
      ctx.audio.firework({ x: mx, z: mz });
      ctx.feel.kick(0.24);
    }
    if (events.playerHit) {
      applyHit(DIMONI_POS.x, DIMONI_POS.z, events.playerHit);
    }
    if (events.bossWon) {
      cinders.forEach((m) => { m.visible = false; });
      hideBarIfNeeded();
      ctx.hud.toast('Outlasted', 'El Dimoni burnt bright! Bark [E] by the fence whenever you want a rematch.', '#ff6b5a', 3.5);
      return;
    }

    if (!state.active) {
      cinders.forEach((m) => { m.visible = false; });
      hideBarIfNeeded();
      return;
    }

    // Active fight visuals & telegraphs.
    ctx.dimoni.glow.intensity = 6 + state.phase * 2.2 + Math.sin(time * 18) * 2.4;
    ctx.dimoni.figure.rotation.y = Math.sin(time * (4 + state.phase)) * 0.2;
    ctx.dimoni.figure.position.y = 1.3 + Math.abs(Math.sin(time * 6)) * 0.14;

    if (Math.random() < dt * 24) {
      ctx.burst(
        DIMONI_POS.x + (Math.random() - 0.5) * 2.6,
        ctx.floor(DIMONI_POS.x, DIMONI_POS.z, 0) + 1.2 + Math.random() * 2.6,
        DIMONI_POS.z + (Math.random() - 0.5) * 2.6,
        Math.random() < 0.5 ? 0xff7a2a : 0xffd25a,
        1, 0.8, 3.2, 0.65, -0.8,
      );
    }

    // Guide beacon: shoreline when dry, bonfire when soaked.
    if (ctx.dog.wet >= 0.35) {
      const fy = ctx.floor(DIMONI_POS.x, DIMONI_POS.z, 0);
      ctx.telegraphs.beacon(DIMONI_POS.x, fy + 0.08, DIMONI_POS.z, 6.4, time, 0xffc93c);
    } else {
      ctx.telegraphs.beacon(clamp(ctx.dog.x, -40, 62), ctx.waterY + 0.06, -58.5, 2.9, time, 0x1fc9b7);
    }

    state.cinders.forEach((c, idx) => {
      const m = cinders[idx];
      if (!c.active) { m.visible = false; return; }
      const u = clamp(c.t / Math.max(0.01, c.dur), 0, 1);
      const fy = ctx.floor(c.tx, c.tz, 0);
      ctx.telegraphs.ring(c.tx, fy + 0.06, c.tz, c.r, u, 0xff7a2a);
      m.visible = true;
      const sx = c.sx + (c.tx - c.sx) * u;
      const sz = c.sz + (c.tz - c.sz) * u;
      m.position.set(sx, fy + 1.1 + Math.sin(u * Math.PI) * 5.2, sz);
    });

    for (const l of state.lanes) {
      if (!l.active) continue;
      const u = clamp(l.t / Math.max(0.01, l.dur), 0, 1);
      const midY = ctx.floor((l.sx + l.tx) * 0.5, (l.sz + l.tz) * 0.5, 0);
      ctx.telegraphs.lane(l.sx, l.sz, l.tx, l.tz, midY + 0.08, l.halfW * 2, u, 0xff3b2f);
    }

    wasBossBarOn = true;
    const hint = ctx.dog.wet >= 0.35
      ? 'SOAKED! Race near the bonfire and bark [E] to douse it!'
      : 'Run into the sea to get wet — or bark [E] when a devil lunges close!';
    ctx.hud.setBoss({
      name: 'EL DIMONI GEGANT',
      hp: state.hp,
      maxHp: state.maxHp,
      phase: `Phase ${state.phase}/3`,
      hint,
      accent: ctx.dog.wet >= 0.35 ? '#1fc9b7' : '#ff5a36',
    });
  };

  const bark = () => {
    if (state.state === 'dormant' && ctx.fireworksT() <= 0 && Math.hypot(ctx.dog.x - DIMONI_POS.x, ctx.dog.z - DIMONI_POS.z) < 7.5) {
      return startBattle();
    }
    if (!state.active) return false;

    const douse = state.tryDouse(ctx.dog.x, ctx.dog.z, ctx.dog.wet);
    if (douse === 'hit' || douse === 'defeated') {
      ctx.consumeWet();
      ctx.audio.splash(DIMONI_POS);
      handlePhaseDamage(douse, 'DIMONI DOUSED');
      return true;
    }

    const counter = state.tryDevilCounter(ctx.dog.x, ctx.dog.z, ctx.devils);
    if (counter === 'hit' || counter === 'defeated') {
      handlePhaseDamage(counter, 'DEVIL REBOUND');
      return true;
    }

    if (douse === 'dry') {
      ctx.hud.shout('GET WET IN THE SEA!', 'bad');
      return true;
    }
    return false;
  };

  const prompt = (): { key: string; label: string } | null => {
    if (state.state === 'dormant' && ctx.fireworksT() <= 0 && ctx.canStart() && Math.hypot(ctx.dog.x - DIMONI_POS.x, ctx.dog.z - DIMONI_POS.z) < 7.5) {
      return { key: 'E', label: state.defeatedOnce ? 'Rematch El Dimoni' : 'Challenge El Dimoni' };
    }
    if (!state.active) return null;
    if (ctx.dog.wet >= 0.35 && Math.hypot(ctx.dog.x - DIMONI_POS.x, ctx.dog.z - DIMONI_POS.z) < 9.5) {
      return { key: 'E', label: 'Douse El Dimoni!' };
    }
    if (state.counterCooldown <= 0 && Math.hypot(ctx.dog.x - DIMONI_POS.x, ctx.dog.z - DIMONI_POS.z) < 13.5 && ctx.devils.some((d) => Math.hypot(d.x - ctx.dog.x, d.z - ctx.dog.z) < 4.0)) {
      return { key: 'E', label: 'Counter-bark devil!' };
    }
    return null;
  };

  const reset = () => {
    state.reset();
    cinders.forEach((m) => { m.visible = false; });
    hideBarIfNeeded();
  };

  const restore = (doneKeys: ReadonlySet<string>) => {
    if (doneKeys.has('seafront:dimoni')) state.defeatedOnce = true;
  };

  return {
    state,
    get active() { return state.active; },
    start: startBattle,
    update,
    bark,
    prompt,
    reset,
    restore,
    devilSpeed: () => 2.1 + state.phase * 0.45,
  };
}
