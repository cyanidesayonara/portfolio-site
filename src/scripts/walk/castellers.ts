/*
  Interactive 3D Plaça Castellers human tower in Plaça del Mercat.
  Builds a 5-tier collapsed rig registered with plazaLife's visibility list
  so it uses ~5 batched draw calls in Plaça and zero elsewhere.
*/
import * as THREE from 'three';
import { M, capsule, cyl, sphere, rod, shadowed } from './models';
import { bakeStatic } from './bake';
import { CastellersState, CASTELLERS_POS } from './castellersLogic';
import type { Hud } from './hud';
import type { WalkAudio } from './audio';
import type { FeelState } from './telegraph';

export interface CastellersCtx {
  addObject: <T extends THREE.Object3D>(o: T) => T;
  groundY: number;
  hud: Hud;
  audio: WalkAudio;
  feel?: FeelState;
  dog: { x: number; y: number; z: number; vx: number; vz: number };
  humanSay: (text: string, ttl?: number, tone?: 'paper' | 'win' | 'loud') => void;
  addBones: (n: number, why?: string) => void;
  completeGoal: (id: string) => void;
  onDone?: (key: string) => void;
  burst: (x: number, y: number, z: number, color: number, n?: number, spd?: number, up?: number, life?: number, g?: number) => void;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function makeCastellerFigure(scale: number, isEnxaneta = false) {
  const g = new THREE.Group();
  const shirt = M(0xc8322a, 0.72);
  const pants = M(0xf4f1ea, 0.75);
  const faixa = M(0x1b1d24, 0.8);
  const skin = M(0xf0c29c, 0.75);

  // Legs
  for (const s of [-1, 1]) {
    const leg = capsule(0.085, 0.56, pants, 8);
    leg.position.set(0, 0.34, s * 0.11);
    g.add(leg);
  }
  // Waist sash (faixa) & shirt torso
  const sash = cyl(0.17, 0.16, 0.18, faixa, 10);
  sash.position.y = 0.72;
  g.add(sash);
  const torso = cyl(0.18, 0.16, 0.44, shirt, 10);
  torso.position.y = 0.98;
  g.add(torso);
  // Head (+ enxaneta striped yellow-black helmet & raised salud arm)
  const head = sphere(0.145, skin, 10, 8);
  head.position.y = 1.32;
  g.add(head);

  if (isEnxaneta) {
    const helmet = sphere(0.16, M(0xf2c230, 0.5), 10, 8);
    helmet.scale.set(1, 0.75, 1);
    helmet.position.y = 1.38;
    g.add(helmet);
    g.add(rod(V(0, 1.15, 0.16), V(0.08, 1.78, 0.22), 0.055, shirt, 6));
    g.add(sphere(0.06, skin, 8, 6).translateX(0.08).translateY(1.8).translateZ(0.22));
    g.add(rod(V(0, 1.15, -0.16), V(0.06, 0.85, -0.22), 0.055, shirt, 6));
  } else {
    for (const s of [-1, 1]) {
      g.add(rod(V(0, 1.14, s * 0.18), V(0.16, 1.48, s * 0.12), 0.055, shirt, 6));
    }
  }
  g.scale.setScalar(scale);
  return g;
}

const TIER_BASE_Y = [0, 1.35, 2.7, 3.98, 5.15];

/** Instantiates and drives the 5-tier interactive Plaça Castellers human tower. */
export function createCastellers(ctx: CastellersCtx) {
  const state = new CastellersState();
  const Y = ctx.groundY;

  const root = ctx.addObject(new THREE.Group());
  root.position.set(CASTELLERS_POS.x, Y, CASTELLERS_POS.z);

  const tierSpec: { count: number; radius: number; scale: number; enx?: boolean }[] = [
    { count: 6, radius: 1.02, scale: 1.02 },
    { count: 4, radius: 0.68, scale: 0.96 },
    { count: 3, radius: 0.42, scale: 0.9 },
    { count: 2, radius: 0.24, scale: 0.84 },
    { count: 1, radius: 0, scale: 0.74, enx: true },
  ];

  const tiers: THREE.Group[] = tierSpec.map((spec, idx) => {
    const t = new THREE.Group();
    t.position.y = TIER_BASE_Y[idx];
    for (let k = 0; k < spec.count; k++) {
      const a = (k / spec.count) * Math.PI * 2 + idx * 0.4;
      const fig = makeCastellerFigure(spec.scale, !!spec.enx);
      fig.position.set(Math.cos(a) * spec.radius, 0, Math.sin(a) * spec.radius);
      fig.rotation.y = Math.PI - a;
      t.add(fig);
    }
    if (idx === 0) {
      // Low timber safety mat ring at base (pinya cushion) merged cleanly with Tier 0.
      const pad = cyl(1.45, 1.5, 0.07, M(0x40455c, 0.88), 18);
      pad.position.y = 0.035;
      t.add(pad);
    }
    shadowed(t);
    bakeStatic(t);
    root.add(t);
    return t;
  });

  let bargeCd = 0;
  let awarded = false;

  const handleNudge = (power: number) => {
    const res = state.nudge(ctx.dog.x, ctx.dog.z, power);
    if (res === 'wobble') {
      ctx.audio.hey();
      ctx.feel?.kick(0.14);
      ctx.hud.say('casteller', state.instability > 0.65 ? 'Aguanta! Que caiem!' : 'Compte, gos!', 1.5, 'loud');
      return true;
    }
    if (res === 'toppled') {
      ctx.audio.stumble();
      ctx.feel?.kick(0.42);
      ctx.feel?.hitstop(0.08);
      ctx.burst(CASTELLERS_POS.x, Y + 3.2, CASTELLERS_POS.z, 0xf2c230, 14, 4.6, 3.8, 0.85, 6);
      ctx.burst(CASTELLERS_POS.x, Y + 1.8, CASTELLERS_POS.z, 0xc8322a, 10, 3.8, 3.0, 0.85, 6);
      ctx.hud.say('casteller', 'Fins demà!!', 1.8, 'loud');
      if (!awarded) {
        awarded = true;
        ctx.audio.goal();
        ctx.addBones(8);
        ctx.onDone?.('plaza:castellers');
        ctx.completeGoal('plaza_castellers');
        ctx.hud.shout('CASTELL TOPPLED! +8', 'loud');
        ctx.humanSay('Millie! You knocked down an entire castell!', 2.4, 'loud');
      } else {
        ctx.hud.shout('TIMBERRR!', 'good');
      }
      return true;
    }
    return false;
  };

  const update = (dt: number, time: number, visible: boolean) => {
    root.visible = visible;
    if (!visible) return;

    if (bargeCd > 0) bargeCd = Math.max(0, bargeCd - dt);
    const sp = Math.hypot(ctx.dog.vx, ctx.dog.vz);
    const d = Math.hypot(ctx.dog.x - CASTELLERS_POS.x, ctx.dog.z - CASTELLERS_POS.z);
    if (d < 2.15 && sp > 2.2 && bargeCd <= 0 && (state.state === 'standing' || state.state === 'wobbling')) {
      bargeCd = 0.85;
      handleNudge(0.46);
    }

    state.step(dt);

    if (state.state === 'toppled') {
      const k = Math.min(1, state.timer / 0.65);
      const ease = 1 - (1 - k) * (1 - k);
      tiers.forEach((t, idx) => {
        const dir = idx % 2 ? -1 : 1;
        t.position.x = ease * (state.leanX * idx * 0.9 + Math.cos(idx * 1.9) * idx * 0.45);
        t.position.z = ease * (state.leanZ * idx * 0.9 + Math.sin(idx * 1.9) * idx * 0.45);
        t.position.y = TIER_BASE_Y[idx] * (1 - ease) + 0.12 * ease;
        t.rotation.z = ease * dir * (Math.PI * 0.46);
        t.rotation.x = ease * state.leanZ * 0.8;
      });
    } else if (state.state === 'rebuilding') {
      const u = Math.min(1, state.timer / 2.0);
      tiers.forEach((t, idx) => {
        const lift = Math.max(0, Math.min(1, (u - idx * 0.1) * 1.4));
        t.position.x = 0;
        t.position.z = 0;
        t.position.y = lift * TIER_BASE_Y[idx];
        t.rotation.set(0, 0, (1 - lift) * 0.25);
      });
    } else {
      tiers.forEach((t, idx) => {
        const sway = (idx * 0.65 + 0.3) * state.swayAngle + Math.sin(time * 2.1 + idx * 0.4) * 0.012;
        t.position.x = idx * 0.08 * state.swayAngle * state.leanX;
        t.position.z = idx * 0.08 * state.swayAngle * state.leanZ;
        t.position.y = TIER_BASE_Y[idx];
        t.rotation.z = -sway * state.leanX - sway * 0.4;
        t.rotation.x = sway * state.leanZ;
      });
    }
  };

  const bark = () => {
    if (Math.hypot(ctx.dog.x - CASTELLERS_POS.x, ctx.dog.z - CASTELLERS_POS.z) > 6.8) return false;
    return handleNudge(0.38);
  };

  const prompt = (): string | null => {
    if ((state.state === 'standing' || state.state === 'wobbling') && Math.hypot(ctx.dog.x - CASTELLERS_POS.x, ctx.dog.z - CASTELLERS_POS.z) < 6.8) {
      return state.instability > 0.3 ? 'Bark to topple the castell!' : 'Rattle the Castellers';
    }
    return null;
  };

  const reset = () => {
    state.reset();
    bargeCd = 0;
  };

  const restore = (doneKeys: ReadonlySet<string>) => {
    if (doneKeys.has('plaza:castellers')) {
      awarded = true;
      state.toppledOnce = true;
    }
  };

  return {
    state,
    update,
    bark,
    prompt,
    reset,
    restore,
    anchor: CASTELLERS_POS,
  };
}
