/*
  3D runtime & visuals for Chase #2: Senglars (wild boars) charging down the
  cobbled slope of Dalt de la Vila.
  Uses slope-hugging ring telegraphs so warning markers never clip into the hill,
  and hides boar rigs outside Dalt de la Vila or while idle (0 draw calls at spawn).
*/
import * as THREE from 'three';
import { M, box, cyl, sphere, shadowed } from './models';
import { collapseRig } from './bake';
import { HILL, hillFloor } from './hill';
import { SenglarsState, SENGLARS_LANES } from './senglarsLogic';
import type { Hud } from './hud';
import type { WalkAudio } from './audio';
import type { FeelState, TelegraphPool } from './telegraph';

export interface SenglarsCtx {
  scene: THREE.Scene;
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

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function makeBoar() {
  const g = new THREE.Group();
  const coat = M(0x4b3526, 0.9);
  const mane = M(0x2c1e15, 0.95);
  const snout = M(0x9a6d62, 0.8);
  const tusk = M(0xf4efe2, 0.45);
  const eye = M(0xffb020, 0.35);

  const body = new THREE.Group();
  const torso = box(0.68, 0.62, 1.18, coat);
  torso.position.set(0, 0.62, 0);
  body.add(torso);

  const ridge = box(0.18, 0.16, 1.06, mane);
  ridge.position.set(0, 0.96, 0.04);
  body.add(ridge);

  const head = box(0.5, 0.46, 0.48, coat);
  head.position.set(0, 0.56, -0.68);
  head.rotation.x = 0.22;
  body.add(head);

  const nose = cyl(0.14, 0.16, 0.24, snout, 8);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.48, -0.96);
  body.add(nose);

  for (const s of [-1, 1]) {
    const tk = cyl(0.015, 0.045, 0.24, tusk, 6);
    tk.position.set(s * 0.16, 0.48, -0.92);
    tk.rotation.set(-0.55, 0, s * -0.45);
    body.add(tk);

    const ear = box(0.12, 0.18, 0.1, mane);
    ear.position.set(s * 0.2, 0.82, -0.58);
    ear.rotation.z = s * -0.3;
    body.add(ear);

    const ey = sphere(0.04, eye, 6, 5);
    ey.position.set(s * 0.22, 0.66, -0.78);
    body.add(ey);
  }

  const tail = cyl(0.025, 0.03, 0.28, mane, 6);
  tail.position.set(0, 0.72, 0.64);
  tail.rotation.x = -0.6;
  body.add(tail);

  g.add(body);

  const legs: THREE.Group[] = [];
  for (const [lx, lz] of [[-0.22, -0.38], [0.22, -0.38], [-0.22, 0.38], [0.22, 0.38]] as const) {
    const leg = new THREE.Group();
    leg.position.set(lx, 0.4, lz);
    const shin = cyl(0.075, 0.06, 0.4, mane, 7);
    shin.position.y = -0.2;
    leg.add(shin);
    g.add(leg);
    legs.push(leg);
  }

  shadowed(g);
  collapseRig(g);
  g.visible = false;
  return { group: g, legs };
}

/** Instantiates and drives the Dalt de la Vila downhill Senglars chase. */
export function createSenglars(ctx: SenglarsCtx) {
  const state = new SenglarsState();
  const boars = SENGLARS_LANES.map(() => {
    const b = makeBoar();
    ctx.scene.add(b.group);
    return b;
  });

  const startChase = (viaBark = false) => {
    if (viaBark) {
      if (!state.tryBarkStart(ctx.dog, !ctx.canStart())) return false;
    } else {
      if (!state.canTrigger(ctx.dog, !ctx.canStart())) return false;
      state.start(ctx.dog.x);
    }
    ctx.hud.shout('SENGLARS!', 'loud');
    ctx.humanSay('Wild boars coming down the hill! Move!', 2.2, 'loud');
    ctx.hud.toast(
      'Wild boars!',
      'Sidestep between the red warning rings or race to a green safe zone at the top or bottom of the climb!',
      '#ff6b5a',
      4.5,
    );
    ctx.audio.honk({ x: 0, z: 196 });
    ctx.feel.kick(0.24);
    return true;
  };

  const update = (dt: number, time: number, nearHill: boolean) => {
    if (!nearHill) {
      if (state.active) state.reset();
      for (const b of boars) b.group.visible = false;
      return;
    }

    // Auto-trigger on the lower cobbled climb when walking uphill/downhill.
    if (!state.active && state.canTrigger(ctx.dog, !ctx.canStart())) {
      startChase(false);
    }

    const res = state.step(dt, ctx.dog);

    if (res.startedCharge) {
      ctx.audio.honk({ x: 0, z: 194 });
      ctx.hud.shout('HERE THEY COME!', 'loud');
    }
    if (res.nextWave) {
      ctx.hud.shout('SECOND PACK!', 'loud');
      ctx.audio.honk({ x: 0, z: 196 });
    }
    if (res.hit) {
      const dx = ctx.dog.x - res.hit.x;
      const sx = Math.abs(dx) > 0.15 ? Math.sign(dx) : (ctx.dog.x >= 0 ? -1 : 1);
      ctx.onHitDog(sx * 5.8, -5.2, 2.5);
      ctx.hud.flash('rgba(255, 90, 54, 0.34)');
      ctx.audio.whine();
      ctx.audio.stumble();
      ctx.feel.kick(0.38);
      ctx.feel.hitstop(0.08);
      ctx.burst(ctx.dog.x, ctx.dog.y + 0.45, ctx.dog.z, 0xc9b59c, 16, 2.8, 2.4, 0.55, 5);
      ctx.hud.shout('BOAR BUMP!', 'bad');
      ctx.humanSay('Oof! Watch the tusks!', 1.8, 'loud');
    }
    if (res.escaped) {
      ctx.hud.shout('OUTRAN THE BOARS! +6', 'good');
      ctx.audio.goal();
      ctx.feel.kick(0.2);
      ctx.addBones(6);
      ctx.onDone?.('hill:senglars');
      ctx.completeGoal('hill_senglars');
      ctx.humanSay('Back to the pines with you!', 2.0, 'win');
    }

    if (!state.active) {
      for (const b of boars) b.group.visible = false;
      return;
    }

    // Green safe-zone beacons at top and bottom of the cobbled climb.
    ctx.telegraphs.beacon(0, HILL.baseY + 0.08, 175.2, 2.5, time, 0x5eea8c);
    ctx.telegraphs.beacon(0, HILL.midY + 0.08, 198.6, 2.3, time, 0x5eea8c);

    // Slope-hugging ring telegraphs & trotting boar visuals.
    for (let i = 0; i < state.boars.length; i++) {
      const st = state.boars[i];
      const vis = boars[i];

      if (state.phase === 'warning') {
        const u = clamp(state.t / Math.max(0.01, state.warnDur), 0.08, 1);
        const urg = clamp(u - st.delay * 0.25, 0.08, 1);
        for (const rz of [191.5, 183.5]) {
          ctx.telegraphs.ring(st.x, hillFloor(st.x, rz) + 0.08, rz, 1.15, urg, 0xff5a36);
        }
        // Boars pawing the crest at the top of the slope, facing downhill (-Z).
        vis.group.visible = true;
        const gy = hillFloor(st.x, 197.2);
        vis.group.position.set(st.x, gy, 197.2);
        vis.group.rotation.set(-0.08 + Math.sin(time * 8 + i) * 0.05, 0, 0);
        vis.legs.forEach((l, li) => {
          l.rotation.x = li === 0 ? Math.sin(time * 14 + i) * 0.55 : 0;
        });
      } else if (st.active && !st.passed) {
        const zAhead = clamp(st.z - 1.6, HILL.climb.z0, HILL.climb.z1);
        ctx.telegraphs.ring(st.x, hillFloor(st.x, zAhead) + 0.08, zAhead, 1.12, 0.92, 0xff3b2f);
        vis.group.visible = true;
        const gy = hillFloor(st.x, st.z);
        vis.group.position.set(st.x, gy, st.z);
        const onSlope = st.z >= 178 && st.z <= 196;
        // Boar nose in local -Z; moving toward -Z keeps rotation.y = 0, pitching nose down (+X rot? wait: pitch downhill in -Z means nose (-Z) goes DOWN -> negative X rotation).
        vis.group.rotation.set(onSlope ? -0.26 : 0, 0, Math.sin(time * 18 + i) * 0.04);
        vis.legs.forEach((l, li) => {
          const ph = li < 2 ? 0 : Math.PI;
          const side = li % 2 ? 0 : Math.PI * 0.5;
          l.rotation.x = Math.sin(time * 24 + ph + side) * 0.7;
        });
        if (Math.random() < dt * 8) {
          ctx.burst(st.x, gy + 0.12, st.z + 0.55, 0xb8a68a, 1, 0.8, 0.9, 0.32, 4);
        }
      } else {
        vis.group.visible = false;
      }
    }
  };

  const bark = (): boolean => startChase(true);

  const prompt = (): { key: string; label: string } | null => {
    if (
      !state.active
      && state.cooldown <= 0
      && ctx.canStart()
      && ctx.dog.x >= -6 && ctx.dog.x <= 6
      && ctx.dog.z >= 176.5 && ctx.dog.z <= 196.5
    ) {
      return { key: 'E', label: state.survivedOnce ? 'Startle the wild boars again' : 'Startle the wild boars' };
    }
    return null;
  };

  const banner = (): string | null => (
    state.active
      ? `Senglars (wave ${state.wave}/${state.maxWaves}) — dodge the downhill boar lanes or reach a green zone!`
      : null
  );

  const reset = () => {
    state.reset();
    for (const b of boars) b.group.visible = false;
  };

  const restore = (doneKeys: ReadonlySet<string>) => {
    if (doneKeys.has('hill:senglars')) state.survivedOnce = true;
  };

  return {
    state,
    get active() { return state.active; },
    start: () => {
      if (state.active || !ctx.canStart()) return false;
      state.start(ctx.dog.x);
      ctx.hud.shout('SENGLARS!', 'loud');
      return true;
    },
    update,
    bark,
    prompt,
    banner,
    reset,
    restore,
  };
}

export type SenglarsChase = ReturnType<typeof createSenglars>;
