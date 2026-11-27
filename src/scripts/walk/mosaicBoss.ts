/*
  3D presentation, telegraphs, and animation for Boss #3: the Roman Mosaic Guardian
  outside Museu on Dalt de la Vila's mid-terrace.
  Uses baked vertex-colored tessera geometry (~7 meshes total, 0 draw calls when
  outside Dalt de la Vila) and a guarded HUD boss bar so multiple bosses never
  clear each other's bar.
*/
import * as THREE from 'three';
import { M, box, cyl, sphere, rod, shadowed } from './models';
import { bakeStatic } from './bake';
import { HILL } from './hill';
import { MosaicState, MOSAIC_HOME, MOSAIC_MAX_PLAYER_HITS } from './mosaicLogic';
import type { Hud } from './hud';
import type { WalkAudio } from './audio';
import type { FeelState, TelegraphPool } from './telegraph';

export interface MosaicBossCtx {
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

const Y = HILL.midY;
const PLINTH_H = 0.24;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function buildMedallion() {
  const g = new THREE.Group();
  const travertine = M(0xd6cbb4, 0.85);
  const terracotta = M(0xb85232, 0.78);
  const cobalt = M(0x2d4b7a, 0.78);
  const gold = M(0xd6a642, 0.45, 0.55);

  const disk = cyl(2.25, 2.4, PLINTH_H, travertine, 18);
  disk.position.y = PLINTH_H / 2;
  g.add(disk);

  const ring = cyl(1.78, 1.82, 0.04, terracotta, 16);
  ring.position.y = PLINTH_H + 0.02;
  g.add(ring);

  const centerTile = cyl(1.05, 1.05, 0.05, cobalt, 12);
  centerTile.position.y = PLINTH_H + 0.03;
  g.add(centerTile);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tess = box(0.26, 0.06, 0.26, i % 2 === 0 ? gold : terracotta);
    tess.position.set(Math.cos(a) * 1.45, PLINTH_H + 0.04, Math.sin(a) * 1.45);
    tess.rotation.y = a;
    g.add(tess);
  }

  shadowed(g);
  bakeStatic(g);
  return g;
}

function buildMosaicRig() {
  const root = new THREE.Group();
  const marble = M(0xded5c2, 0.78);
  const basalt = M(0x434856, 0.7);
  const terracotta = M(0xc15230, 0.72);
  const cobalt = M(0x2c4b7a, 0.68);
  const gold = M(0xdca93e, 0.35, 0.68);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffd25a,
    emissive: 0xffa020,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.2,
  });

  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = 1.05;
  root.add(torsoPivot);

  const torsoMesh = new THREE.Group();
  const cuirass = box(0.95, 1.15, 0.62, marble);
  cuirass.position.y = 0.32;
  torsoMesh.add(cuirass);

  // Inlaid Roman mosaic tesserae across front and back chest plates.
  const mosaicCols = [terracotta, cobalt, gold, terracotta];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const m = mosaicCols[(row + col) % mosaicCols.length];
      for (const side of [-1, 1]) {
        const tile = box(0.18, 0.18, 0.05, m);
        tile.position.set((col - 1) * 0.24, 0.2 + row * 0.28, side * 0.32);
        torsoMesh.add(tile);
      }
    }
  }

  // Shoulder pauldrons & Corinthian crested stone helm.
  for (const s of [-1, 1]) {
    const pld = box(0.32, 0.22, 0.56, terracotta);
    pld.position.set(s * 0.56, 0.78, 0);
    torsoMesh.add(pld);
  }
  const neck = cyl(0.22, 0.28, 0.24, basalt, 10);
  neck.position.y = 0.96;
  torsoMesh.add(neck);
  const helm = cyl(0.3, 0.34, 0.54, marble, 12);
  helm.position.y = 1.28;
  torsoMesh.add(helm);
  const visor = box(0.42, 0.14, 0.14, basalt);
  visor.position.set(0, 1.24, 0.29);
  torsoMesh.add(visor);
  const crest = box(0.14, 0.32, 0.68, terracotta);
  crest.position.set(0, 1.66, -0.02);
  torsoMesh.add(crest);
  const crestTrim = box(0.16, 0.08, 0.72, gold);
  crestTrim.position.set(0, 1.54, -0.02);
  torsoMesh.add(crestTrim);

  shadowed(torsoMesh);
  bakeStatic(torsoMesh);
  torsoPivot.add(torsoMesh);

  // Glowing tessera core inside the chest aperture.
  const core = sphere(0.22, coreMat, 10, 8);
  core.position.set(0, 0.42, 0.28);
  core.userData.dynamic = true;
  torsoPivot.add(core);

  // Left arm: broad Roman mosaic scutum shield.
  const shieldArm = new THREE.Group();
  shieldArm.position.set(-0.68, 0.66, 0.08);
  shieldArm.add(rod(V(0, 0, 0), V(-0.18, -0.5, 0.18), 0.11, marble, 8));
  const shieldPlate = box(0.14, 1.15, 0.85, cobalt);
  shieldPlate.position.set(-0.28, -0.25, 0.28);
  const shieldBoss = sphere(0.16, gold, 8, 6);
  shieldBoss.position.set(-0.34, -0.25, 0.28);
  const shieldRim = box(0.16, 1.2, 0.12, terracotta);
  shieldRim.position.set(-0.28, -0.25, 0.72);
  shieldArm.add(shieldPlate, shieldBoss, shieldRim);
  shadowed(shieldArm);
  bakeStatic(shieldArm);
  torsoPivot.add(shieldArm);

  // Right arm: carved marble column mace.
  const spearArm = new THREE.Group();
  spearArm.position.set(0.68, 0.66, 0.05);
  spearArm.add(rod(V(0, 0, 0), V(0.16, -0.54, 0.22), 0.11, marble, 8));
  const club = cyl(0.14, 0.09, 1.35, marble, 10);
  club.position.set(0.22, -0.45, 0.45);
  club.rotation.x = Math.PI * 0.35;
  const band = cyl(0.155, 0.155, 0.16, gold, 10);
  band.position.set(0.22, -0.35, 0.72);
  band.rotation.x = Math.PI * 0.35;
  spearArm.add(club, band);
  shadowed(spearArm);
  bakeStatic(spearArm);
  torsoPivot.add(spearArm);

  // Pillar legs.
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.28, 1.0, 0);
    const pillar = cyl(0.17, 0.19, 0.9, marble, 10);
    pillar.position.y = -0.45;
    const sandal = box(0.32, 0.16, 0.42, basalt);
    sandal.position.set(0, -0.92, 0.08);
    leg.add(pillar, sandal);
    shadowed(leg);
    bakeStatic(leg);
    root.add(leg);
    legs.push(leg);
  }

  root.scale.setScalar(1.22);
  return { root, torsoPivot, shieldArm, spearArm, legs, coreMat };
}

/** Instantiates and drives Boss #3 (Roman Mosaic Guardian) outside Museu. */
export function createMosaicBoss(ctx: MosaicBossCtx) {
  const state = new MosaicState();
  let wasBossBarOn = false;

  const medallion = ctx.addObject(buildMedallion());
  medallion.position.set(MOSAIC_HOME.x, Y + 0.015, MOSAIC_HOME.z);

  const rig = buildMosaicRig();
  ctx.addObject(rig.root);

  const hideBarIfNeeded = () => {
    if (!wasBossBarOn) return;
    wasBossBarOn = false;
    ctx.hud.setBoss(null);
  };

  const applyHit = (kind: 'tile' | 'sweep') => {
    const dx = ctx.dog.x - state.x, dz = ctx.dog.z - state.z;
    const d = Math.hypot(dx, dz) || 1;
    ctx.onHitDog((dx / d) * 6.8, (dz / d) * 6.8, 2.2);
    ctx.hud.flash('rgba(232, 107, 42, 0.34)');
    ctx.audio.whine();
    ctx.feel.kick(0.36);
    ctx.feel.hitstop(0.08);
    ctx.burst(ctx.dog.x, ctx.dog.y + 0.5, ctx.dog.z, 0xe86b2a, 14, 2.6, 2.4, 0.55, 5);
    const left = Math.max(0, MOSAIC_MAX_PLAYER_HITS - state.playerHits);
    ctx.hud.shout(left > 0 ? `STONE-STRUCK! (${left} left)` : 'KNOCKED BACK!', 'bad');
    if (kind === 'sweep') ctx.humanSay('Watch that marble shield sweep!', 1.5, 'loud');
  };

  const handleCrackDamage = (res: 'hit' | 'defeated', via: string) => {
    ctx.audio.bark();
    ctx.audio.bell({ x: state.x, z: state.z });
    ctx.feel.hitstop(res === 'defeated' ? 0.12 : 0.09);
    ctx.feel.kick(res === 'defeated' ? 0.48 : 0.38);
    ctx.burst(state.x, Y + 1.5, state.z, 0xffd24a, 18, 3.8, 3.6, 0.75, 5);
    if (res === 'defeated') {
      hideBarIfNeeded();
      ctx.hud.shout('MOSAIC SHATTERED! +12', 'loud');
      ctx.audio.goal();
      ctx.addBones(12);
      ctx.onDone?.('hill:mosaic');
      ctx.completeGoal('hill_mosaic');
      ctx.humanSay('A living Roman mosaic — and you outsmarted it!', 2.6, 'win');
      return;
    }
    ctx.hud.shout(`${via}! PHASE ${state.phase}`, 'good');
    ctx.hud.say('mosaic', state.phase === 3 ? 'Tesseram ultima!' : 'Resisteix!', 1.8, 'loud');
  };

  const startFight = () => {
    if (state.active || !ctx.canStart()) return false;
    state.start();
    ctx.hud.shout('GUARDIAN AWAKES!', 'loud');
    ctx.hud.toast(
      'Museu boss fight',
      'Dodge the terracotta mosaic rings and marble sweep, then rush the golden keystone and bark [E] — or whirl a terrace lamp!',
      '#ffb020',
      5,
    );
    ctx.humanSay('Wait… the Roman statue outside Museu is moving!', 2.3, 'loud');
    ctx.audio.bell({ x: state.x, z: state.z });
    ctx.feel.kick(0.28);
    ctx.burst(MOSAIC_HOME.x, Y + 1.2, MOSAIC_HOME.z, 0xdca93e, 16, 3.0, 2.8, 0.7, 5);
    return true;
  };

  const update = (dt: number, time: number, nearHill: boolean) => {
    if (!nearHill) {
      if (state.active || state.state === 'defeated') state.reset();
      hideBarIfNeeded();
      medallion.visible = false;
      rig.root.visible = false;
      return;
    }

    medallion.visible = true;
    rig.root.visible = true;

    const events = state.step(dt, ctx.dog);

    if (events.fled) {
      hideBarIfNeeded();
      ctx.hud.toast('Restored', 'The Roman Mosaic Guardian returned to its pedestal outside Museu.', '#ffb020', 2.5);
    }
    if (events.tileVolley) {
      ctx.audio.click();
      ctx.hud.say('mosaic', 'Tesserae!', 1.2, 'loud');
    }
    for (const imp of events.tileImpacts) {
      ctx.burst(imp.x, Y + 0.3, imp.z, 0xe86b2a, 14, 2.8, 2.4, 0.55, 5);
      ctx.audio.land();
      ctx.feel.kick(0.22);
    }
    if (events.sweepTelegraphed) {
      ctx.audio.whoosh(0.95);
      ctx.hud.say('mosaic', 'Scutum!', 1.1, 'loud');
    }
    if (events.sweepFired) {
      const mx = (events.sweepFired.x0 + events.sweepFired.x1) * 0.5;
      ctx.burst(mx, Y + 0.4, events.sweepFired.z0, 0xded5c2, 16, 3.2, 2.4, 0.55, 5);
      ctx.audio.land();
      ctx.feel.kick(0.28);
    }
    if (events.exposed) {
      ctx.hud.say('mosaic', 'Agh! La clau!', 1.6, 'loud');
    }
    if (events.playerHit) {
      applyHit(events.playerHit);
    }
    if (events.bossWon) {
      hideBarIfNeeded();
      ctx.hud.toast('Standing firm', 'The Guardian reclaimed its medallion! Bark [E] whenever you want a rematch.', '#ff6b5a', 3.5);
    }

    if (state.state === 'defeated' && state.stateT >= state.dur) {
      state.reset();
    }

    // Active telegraphs.
    if (state.active) {
      for (const tb of state.tiles) {
        if (!tb.active || tb.t < 0) continue;
        ctx.telegraphs.ring(tb.x, Y + 0.05, tb.z, tb.r, clamp(tb.t / Math.max(0.01, tb.dur), 0, 1), 0xe86b2a);
      }
      if (state.lane.active && (state.state === 'sweep_windup' || state.state === 'sweep')) {
        const fill = state.state === 'sweep_windup' ? clamp(state.lane.t / Math.max(0.01, state.lane.dur), 0.1, 1) : 1;
        ctx.telegraphs.lane(state.lane.x0, state.lane.z0, state.lane.x1, state.lane.z1, Y + 0.06, state.lane.halfW * 2, fill, 0xd93a2b);
      }
      if (state.state === 'exposed' && state.keystone.active) {
        ctx.telegraphs.beacon(state.keystone.x, Y + 0.06, state.keystone.z, state.keystone.r, time, 0xffd24a);
      }
    }

    // Visual rig pose & glowing mosaic core.
    const onPlinth = state.state === 'dormant';
    rig.root.position.set(state.x, onPlinth ? Y + PLINTH_H : Y + 0.02, state.z);
    // Mesh local +Z faces forward -> Three rotation.y around Y rotates +Z toward atan2(x, z),
    // which equals Math.PI / 2 - heading in XZ (heading = atan2(dz, dx)).
    rig.root.rotation.y = onPlinth ? -Math.PI / 2 : Math.PI / 2 - state.heading;

    if (onPlinth) {
      rig.coreMat.emissive.setHex(0x8a5e1a);
      rig.coreMat.emissiveIntensity = 0.25;
      rig.torsoPivot.position.y = 1.05;
      rig.torsoPivot.rotation.set(0, 0, 0);
      rig.shieldArm.rotation.set(0, 0, 0);
      rig.spearArm.rotation.set(0, 0, 0);
      rig.legs[0].rotation.x = 0;
      rig.legs[1].rotation.x = 0;
    } else if (state.state === 'exposed') {
      rig.coreMat.emissive.setHex(0x38e8ff);
      rig.coreMat.emissiveIntensity = 1.15 + Math.sin(time * 12) * 0.35;
      rig.torsoPivot.position.y = 0.72;
      rig.torsoPivot.rotation.set(0.28, Math.sin(time * 10) * 0.08, 0);
      rig.shieldArm.rotation.set(0, -0.75, 0.35);
      rig.spearArm.rotation.set(-0.35, 0.35, -0.3);
      rig.legs[0].rotation.x = 0.25;
      rig.legs[1].rotation.x = -0.25;
    } else if (state.state === 'defeated') {
      const collapse = clamp(state.stateT / Math.max(0.01, state.dur), 0, 1);
      rig.coreMat.emissive.setHex(0x4a3a22);
      rig.coreMat.emissiveIntensity = 0.1;
      rig.torsoPivot.position.y = 1.05 - collapse * 0.45;
      rig.torsoPivot.rotation.set(collapse * 0.5, 0, collapse * 0.15);
    } else if (state.state === 'sweep') {
      rig.coreMat.emissive.setHex(0xff4a3d);
      rig.coreMat.emissiveIntensity = 1.0;
      rig.torsoPivot.position.y = 1.02;
      rig.torsoPivot.rotation.set(0.22, -0.25, 0);
      rig.shieldArm.rotation.set(-0.2, 0.55, 0);
      rig.spearArm.rotation.set(0.55, 0, 0);
      const cy = Math.sin(time * 22);
      rig.legs[0].rotation.x = cy * 0.55;
      rig.legs[1].rotation.x = -cy * 0.55;
    } else {
      rig.coreMat.emissive.setHex(state.phase === 3 ? 0xff4a3d : state.phase === 2 ? 0xff8a2a : 0xffb020);
      rig.coreMat.emissiveIntensity = 0.8 + Math.sin(time * 7) * 0.2;
      rig.torsoPivot.position.y = 1.05 + Math.abs(Math.sin(time * 5)) * 0.05;
      rig.torsoPivot.rotation.set(state.state === 'sweep_windup' ? -0.14 : 0.04, 0, 0);
      rig.shieldArm.rotation.set(0, 0.2, 0);
      rig.spearArm.rotation.set(-Math.sin(time * 6) * 0.35, 0, 0);
      rig.legs[0].rotation.x = 0;
      rig.legs[1].rotation.x = 0;
    }

    if (state.active) {
      wasBossBarOn = true;
      const hint = state.state === 'exposed'
        ? 'SHIELD OPEN! Step onto the golden keystone and press [E] to crack the mosaic!'
        : state.state === 'sweep_windup' || state.state === 'sweep'
          ? 'Step clear of the red marble lane — or whirl a terrace lamp!'
          : 'Dodge the terracotta rings & shield sweep (or whirl a lamp around it)!';
      ctx.hud.setBoss({
        name: 'ROMAN MOSAIC GUARDIAN',
        hp: state.hp,
        maxHp: state.maxHp,
        phase: `Phase ${state.phase}/3`,
        hint,
        accent: state.state === 'exposed' ? '#38e8ff' : state.phase === 3 ? '#ff4a3d' : '#ffb020',
      });
    } else {
      hideBarIfNeeded();
    }
  };

  const bark = (): boolean => {
    if (state.state === 'dormant' && Math.hypot(ctx.dog.x - MOSAIC_HOME.x, ctx.dog.z - MOSAIC_HOME.z) < 6.2) {
      return startFight();
    }
    if (!state.active) return false;
    const res = state.tryBarkCrack(ctx.dog.x, ctx.dog.z);
    if (res === 'hit' || res === 'defeated') {
      handleCrackDamage(res, 'MOSAIC CRACKED');
      return true;
    }
    if (res === 'shielded') {
      ctx.hud.shout('SHIELDED! WAIT FOR OPENING', 'bad');
      return true;
    }
    return false;
  };

  const onWhirl = (poleX: number, poleZ: number): boolean => {
    if (!state.tryWhirlBreak(poleX, poleZ)) return false;
    ctx.burst(state.x, Y + 1.4, state.z, 0x38e8ff, 18, 3.8, 3.2, 0.7, 5);
    ctx.audio.bell({ x: state.x, z: state.z });
    ctx.feel.kick(0.36);
    ctx.feel.hitstop(0.08);
    ctx.hud.shout('LAMP WHIRL SHATTER!', 'good');
    ctx.hud.say('mosaic', 'Quin estrèpit!!', 1.8, 'loud');
    return true;
  };

  const prompt = (): { key: string; label: string } | null => {
    if (state.state === 'dormant' && ctx.canStart() && Math.hypot(ctx.dog.x - MOSAIC_HOME.x, ctx.dog.z - MOSAIC_HOME.z) < 6.2) {
      return { key: 'E', label: state.defeatedOnce ? 'Rematch Roman Guardian' : 'Wake the Roman Guardian' };
    }
    if (state.state === 'exposed') {
      const near = Math.hypot(ctx.dog.x - state.x, ctx.dog.z - state.z) <= 5.2
        || (state.keystone.active && Math.hypot(ctx.dog.x - state.keystone.x, ctx.dog.z - state.keystone.z) <= state.keystone.r + 1.4);
      if (near) return { key: 'E', label: 'Crack the mosaic!' };
    }
    return null;
  };

  const banner = (): string | null => {
    if (!state.active) return null;
    return state.state === 'exposed'
      ? 'Roman Mosaic Guardian — bark [E] on the glowing keystone!'
      : 'Roman Mosaic Guardian — dodge rings & shield sweep, or whirl a terrace lamp!';
  };

  const reset = () => {
    state.reset();
    hideBarIfNeeded();
  };

  const restore = (doneKeys: ReadonlySet<string>) => {
    if (doneKeys.has('hill:mosaic')) state.defeatedOnce = true;
  };

  return {
    state,
    get active() { return state.active; },
    start: startFight,
    update,
    bark,
    onWhirl,
    prompt,
    banner,
    reset,
    restore,
    bubblePos: () => ({ x: state.x, y: Y + 3.1, z: state.z }),
  };
}

export type MosaicBoss = ReturnType<typeof createMosaicBoss>;
