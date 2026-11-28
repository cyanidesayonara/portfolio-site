/*
  Old-town strays: cats dozing on the steps and squares of Dalt de la Vila.

  A cat sits and swishes its tail, watching Millie. Charge at it, sneak right
  up to it, or bark nearby and it bolts away from her, slips out of sight and
  comes back to its spot a while later when she is gone. Each cat sent running
  counts once toward the hill's cat goal.
*/
import * as THREE from 'three';
import { makeCat } from './models';
import { collapseRig } from './bake';
import type { WalkAudio } from './audio';
import { HILL_DX, shiftX } from './hillOffset';

const VIEW = 60;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const angLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

type P = { x: number; z: number };
export interface StraysCtx {
  scene: THREE.Scene;
  audio: WalkAudio;
  dog: { x: number; y: number; z: number; vx: number; vz: number };
  floor: (x: number, z: number, y: number) => number;
  collide: (p: P, r: number, feetY: number) => void;
  /** How many different cats have been sent running so far. */
  onScared: (count: number) => void;
  onDone?: (key: string) => void;
}

/** Home spots on the hill: lower square, mid terrace, mirador, church square (hill-local x, shifted into place below). */
const LOCAL_SPOTS: { x: number; z: number; color: number; heading: number }[] = [
  { x: 6.5, z: 176.2, color: 0xd98a3a, heading: -Math.PI / 2 },
  { x: -5.5, z: 199.5, color: 0x2b2a2e, heading: Math.PI },
  { x: 20.5, z: 222.6, color: 0xe8e4dc, heading: -Math.PI / 2 },
  { x: -18.5, z: 233.2, color: 0x8d8a86, heading: 0 },
];
const SPOTS = shiftX(LOCAL_SPOTS, HILL_DX);

export function createStrays(ctx: StraysCtx) {
  const { scene, audio, dog } = ctx;
  const scared = new Set<number>();
  const cats = SPOTS.map((s, i) => {
    const m = makeCat(s.color);
    scene.add(collapseRig(m.group));
    const y = ctx.floor(s.x, s.z, 20);
    m.group.position.set(s.x, y, s.z);
    m.group.rotation.y = -s.heading;
    return {
      i, m, home: s,
      x: s.x, y, z: s.z, heading: s.heading,
      state: 'rest' as 'rest' | 'flee' | 'gone',
      t: 0, vx: 0, vz: 0, phase: Math.random() * 6,
    };
  });

  const bolt = (c: (typeof cats)[number]) => {
    if (c.state !== 'rest') return;
    c.state = 'flee';
    c.t = rand(1.3, 1.7);
    const away = Math.atan2(c.z - dog.z, c.x - dog.x) + rand(-0.5, 0.5);
    c.vx = Math.cos(away) * 6.5;
    c.vz = Math.sin(away) * 6.5;
    audio.meow({ x: c.x, z: c.z });
    if (!scared.has(c.i)) {
      scared.add(c.i);
      ctx.onDone?.(`cat:${c.i}`);
      ctx.onScared(scared.size);
    }
  };

  const update = (dt: number, time: number) => {
    const dogSpeed = Math.hypot(dog.vx, dog.vz);
    for (const c of cats) {
      const d = Math.hypot(c.x - dog.x, c.z - dog.z);
      const near = d < VIEW;
      c.m.group.visible = near && c.state !== 'gone';
      if (!near && c.state !== 'gone') continue;
      if (c.state === 'rest') {
        // Watch Millie when she's around; bolt when she charges or gets too close.
        if (d < 8) c.heading = angLerp(c.heading, Math.atan2(dog.z - c.z, dog.x - c.x), dt * 2);
        if ((d < 3.4 && dogSpeed > 2.6) || d < 1.1) bolt(c);
        c.m.tail.rotation.x = Math.sin(time * 2.2 + c.phase) * 0.5;
        c.m.group.position.set(c.x, c.y, c.z);
        c.m.group.rotation.y = -c.heading;
      } else if (c.state === 'flee') {
        c.t -= dt;
        const p = { x: c.x + c.vx * dt, z: c.z + c.vz * dt };
        ctx.collide(p, 0.2, c.y);
        c.x = p.x; c.z = p.z;
        c.y = ctx.floor(c.x, c.z, c.y + 0.4);
        c.heading = Math.atan2(c.vz, c.vx);
        // A low, bounding run; shrinks away at the end as it slips out of sight.
        const k = Math.min(1, c.t / 0.35);
        c.m.group.scale.setScalar(Math.max(0.01, k));
        c.m.group.position.set(c.x, c.y + Math.abs(Math.sin(time * 18)) * 0.06, c.z);
        c.m.group.rotation.y = -c.heading;
        c.m.tail.rotation.x = 0.2;
        if (c.t <= 0) { c.state = 'gone'; c.t = rand(35, 55); }
      } else {
        c.t -= dt;
        // Back to its spot once the coast is clear.
        if (c.t <= 0 && Math.hypot(c.home.x - dog.x, c.home.z - dog.z) > 16) {
          c.state = 'rest';
          c.x = c.home.x; c.z = c.home.z; c.y = ctx.floor(c.x, c.z, 20); c.heading = c.home.heading;
          c.m.group.scale.setScalar(1);
        }
      }
    }
  };

  /** E: a bark sends every cat within earshot running. */
  const bark = () => {
    for (const c of cats) if (Math.hypot(c.x - dog.x, c.z - dog.z) < 6) bolt(c);
  };

  const restore = (doneKeys: ReadonlySet<string>) => {
    for (let i = 0; i < SPOTS.length; i++) {
      if (doneKeys.has(`cat:${i}`)) scared.add(i);
    }
  };

  return {
    update,
    bark,
    restore,
    debug: { cats, get scared() { return scared.size; } },
  };
}

export type Strays = ReturnType<typeof createStrays>;
