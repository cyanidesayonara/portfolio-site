/*
  Marching 3D Rambla Tabalers percussion drum squad along the Rambla.
  Collapsed rig per drummer keeps draw calls compact and hides completely outside 56 m.
*/
import * as THREE from 'three';
import { makePerson, M, box, cyl, shadowed } from './models';
import { collapseRig } from './bake';
import { TabalersState, TABALERS_RADIUS } from './tabalersLogic';
import type { Hud } from './hud';
import type { WalkAudio } from './audio';
import type { FeelState, TelegraphPool } from './telegraph';

export interface TabalersCtx {
  scene: THREE.Scene;
  groundY: number;
  hud: Hud;
  audio: WalkAudio;
  telegraphs: TelegraphPool;
  feel: FeelState;
  dog: { x: number; y: number; z: number };
  humanSay: (text: string, ttl?: number, tone?: 'paper' | 'win' | 'loud') => void;
  addBones: (n: number, why?: string) => void;
  completeGoal: (id: string) => void;
  onDone?: (key: string) => void;
  burst: (x: number, y: number, z: number, color: number, n?: number, spd?: number, up?: number, life?: number, g?: number) => void;
  onHitDog: (vx: number, vz: number, vy?: number) => void;
  busy: () => boolean;
}

const SKIN_COLS = [0xf2c6a0, 0xe0ac82, 0xc99368, 0xf6d4b2];
const HAIR_COLS = [0x2a1d14, 0x1a1512, 0x5c3a22, 0x8a5e3b];

/** Spawns and animates the 4-piece Rambla Tabalers drum squad. */
export function createTabalers(ctx: TabalersCtx) {
  const state = new TabalersState();
  const Y = ctx.groundY;
  const squadGroup = new THREE.Group();
  ctx.scene.add(squadGroup);

  const drumMat = M(0xc8322a, 0.55);
  const rimMat = M(0xf4f1ea, 0.45);
  const stickMat = M(0xd8b47c, 0.7);

  const slots: [number, number][] = [
    [0.9, -1.0],
    [0.9, 1.0],
    [-0.9, -1.0],
    [-0.9, 1.0],
  ];

  const drummers = slots.map(([ox, oz], idx) => {
    const p = makePerson({
      top: 0xe8b42c,
      trousers: 0x242a3d,
      hair: HAIR_COLS[idx],
      skin: SKIN_COLS[idx],
      hairStyle: idx % 2 ? 'ponytail' : 'short',
      prop: 'none',
      height: 0.92 + (idx % 2) * 0.06,
    });
    const shell = cyl(0.24, 0.24, 0.44, drumMat, 12);
    shell.rotation.z = Math.PI / 2;
    shell.position.set(0.28, 0.96, 0);
    p.group.add(shell);

    const head = cyl(0.245, 0.245, 0.04, rimMat, 12);
    head.rotation.z = Math.PI / 2;
    head.position.set(0.28, 0.96, 0);
    p.group.add(head);

    const sticks = box(0.32, 0.025, 0.28, stickMat);
    sticks.position.set(0.4, 1.24, 0);
    p.group.add(sticks);

    p.group.position.set(ox, 0, oz);
    shadowed(p.group);
    collapseRig(p.group);
    squadGroup.add(p.group);
    return { person: p, sticks, ox, oz };
  });

  let braved = false;

  const update = (dt: number, time: number) => {
    const d = Math.hypot(ctx.dog.x - state.x, ctx.dog.z - state.z);
    const vis = ctx.dog.z > 8 && d < 52;
    squadGroup.visible = vis;

    const { beatHit, spooked } = state.step(dt, ctx.dog, ctx.busy());
    squadGroup.position.set(state.x, Y, state.z);
    squadGroup.rotation.y = state.dir > 0 ? 0 : Math.PI;

    if (vis) {
      drummers.forEach((dr, i) => {
        dr.person.animate(time + i * 0.35, { speed: state.speed, pose: 'walk' });
        const hitAmt = Math.abs(Math.sin(state.beatPhase * Math.PI * 2 + i * 0.3));
        dr.person.arms.forEach((a, k) => {
          a.rotation.z = 1.05 + hitAmt * 0.42 * (k ? -1 : 1);
        });
      });
    }

    if (beatHit && d < 28) {
      ctx.audio.drum({ x: state.x, z: state.z });
      if (d < 8.5) ctx.feel.kick(0.06);
    }

    if (d < 32 && state.calmedT <= 0) {
      const col = state.beatPhase > 0.72 ? 0xff4a7a : 0xe5487a;
      ctx.telegraphs.ring(state.x, Y + 0.04, state.z, TABALERS_RADIUS, state.beatPhase, col);
    }

    if (spooked) {
      const dx = ctx.dog.x - state.x, dz = ctx.dog.z - state.z;
      const dl = Math.hypot(dx, dz) || 1;
      ctx.onHitDog((dx / dl) * 5.2, (dz / dl) * 5.2, 1.9);
      ctx.audio.whine();
      ctx.feel.kick(0.22);
      ctx.hud.shout('TOO LOUD!', 'bad');
      ctx.hud.say('tabalers', 'Pum! Pum! Pum!', 1.2, 'loud');
    }
  };

  const bark = () => {
    if (state.tryBarkBrave(ctx.dog.x, ctx.dog.z) !== 'calmed') return false;
    ctx.audio.bark();
    ctx.feel.kick(0.2);
    ctx.burst(state.x, Y + 1.4, state.z, 0x5eea8c, 24, 3.2, 3.2, 0.8, 5);
    ctx.hud.say('tabalers', 'Aquesta gossa té ritme!', 2.2, 'win');
    if (!braved) {
      braved = true;
      ctx.audio.goal();
      ctx.addBones(5);
      ctx.onDone?.('town:tabalers');
      ctx.completeGoal('tabalers');
      ctx.hud.shout('ON THE BEAT! +5', 'good');
      ctx.humanSay('They love your rhythm!', 2.0, 'win');
    } else {
      ctx.hud.shout('GOOD RHYTHM!', 'good');
    }
    return true;
  };

  const prompt = (): { key: string; label: string } | null => {
    if (state.calmedT <= 0 && Math.hypot(ctx.dog.x - state.x, ctx.dog.z - state.z) <= 6.8) {
      return { key: 'E', label: 'Bark on the beat (Tabalers)' };
    }
    return null;
  };

  const reset = () => {
    state.reset();
  };

  const restore = (doneKeys: ReadonlySet<string>) => {
    if (doneKeys.has('town:tabalers')) {
      braved = true;
      state.bravedOnce = true;
    }
  };

  return {
    state,
    update,
    bark,
    prompt,
    reset,
    restore,
  };
}
