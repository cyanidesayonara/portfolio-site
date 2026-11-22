/*
  The leash, ported from Path of Leash Resistance (entities/leash.gd and the
  tug in main.gd) to meters on the XZ plane. The visible rope IS the
  constraint: there is no separate wrap bookkeeping. Poles grip the rope
  with stick-slip friction, and tension pulls each end along its tangent.
  The game's 340 px leash is 5 m, so 68 px = 1 m.
*/

export interface Obstacle {
  x: number;
  z: number;
  r: number;
  kind: 'pole' | 'furniture';
}

interface Pt {
  x: number;
  z: number;
  px: number;
  pz: number;
  c: Obstacle | null;
}

export interface Body {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

const TAU = Math.PI * 2;
const wrap = (a: number) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class Leash {
  readonly N = 24;
  pts: Pt[] = [];
  rest = 5; // current reel length (m)
  length = 0;
  stretch = 1;
  taut = 0;
  winding = 0; // turns
  humanEndWinding = 0; // radians, last 8 segments
  contacts = 0; // distinct obstacles touching
  staticWinding = 0; // turns around touched obstacles
  nearestPole: Obstacle | null = null; // contact nearest the human end
  nearestPoleCoil = 0; // radians wound around that pole
  freeSlip = 0; // seconds of free slip (after a fling)
  whirl = false;

  constructor(dog: { x: number; z: number }, hand: { x: number; z: number }) {
    this.reset(dog, hand);
  }

  /** Straight line from dog to hand (start, re-clip, reset). */
  reset(dog: { x: number; z: number }, hand: { x: number; z: number }) {
    this.pts = [];
    for (let i = 0; i < this.N; i++) {
      const t = i / (this.N - 1);
      const x = dog.x + (hand.x - dog.x) * t;
      const z = dog.z + (hand.z - dog.z) * t;
      this.pts.push({ x, z, px: x, pz: z, c: null });
    }
    this.measure();
  }

  step(dog: { x: number; z: number }, hand: { x: number; z: number }, obstacles: Obstacle[], dt: number) {
    const { N, pts } = this;
    const seg = this.rest / (N - 1);
    if (this.freeSlip > 0) this.freeSlip -= dt;

    // 1. Integrate interior points.
    for (let i = 1; i < N - 1; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * 0.94, vz = (p.z - p.pz) * 0.94;
      p.px = p.x; p.pz = p.z;
      p.x += vx; p.z += vz;
      p.c = null;
    }

    const near = (p: Pt, pad: number) => {
      for (const o of obstacles) {
        if (Math.hypot(p.x - o.x, p.z - o.z) < o.r + pad) return true;
      }
      return false;
    };

    // 2. Solver iterations.
    for (let iter = 0; iter < 11; iter++) {
      pts[0].x = dog.x; pts[0].z = dog.z;
      pts[N - 1].x = hand.x; pts[N - 1].z = hand.z;

      if (iter === 0) {
        // Bending: points two apart stay at least 1.55 segments apart,
        // except near obstacles so the rope can hug a pole.
        const minD = 1.55 * seg;
        for (let i = 0; i < N - 2; i++) {
          const a = pts[i], c = pts[i + 2];
          if (near(pts[i + 1], 1.0)) continue;
          const dx = c.x - a.x, dz = c.z - a.z;
          const d = Math.hypot(dx, dz) || 1e-5;
          if (d < minD) {
            const corr = ((minD - d) / d) * 0.5 * 0.6;
            if (i > 0) { a.x -= dx * corr; a.z -= dz * corr; }
            if (i + 2 < N - 1) { c.x += dx * corr; c.z += dz * corr; }
          }
        }
      }

      // Distance constraints: stiff when stretched, soft when compressed so slack drapes.
      for (let i = 0; i < N - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz) || 1e-5;
        const diff = d - seg;
        const k = diff > 0 ? 0.9 : 0.05;
        const wa = i === 0 ? 0 : 1, wb = i + 1 === N - 1 ? 0 : 1;
        const ws = wa + wb;
        if (!ws) continue;
        const corr = (diff / d) * k;
        if (wa) { a.x += dx * corr * (wa / ws); a.z += dz * corr * (wa / ws); }
        if (wb) { b.x -= dx * corr * (wb / ws); b.z -= dz * corr * (wb / ws); }
      }

      // Push interior points out of obstacles and remember the contact.
      for (let i = 1; i < N - 1; i++) {
        const p = pts[i];
        for (const o of obstacles) {
          const dx = p.x - o.x, dz = p.z - o.z;
          const d = Math.hypot(dx, dz);
          const min = o.r + 0.035;
          if (d < min) {
            if (d > 1e-5) { p.x = o.x + (dx / d) * min; p.z = o.z + (dz / d) * min; }
            else { p.x = o.x + min; }
            p.c = o;
          }
        }
      }
    }

    this.measure();

    // 3. Stick-slip around touched obstacles.
    const freeAll = this.whirl || this.freeSlip > 0;
    const poleSlip = clamp(0.15 + (this.stretch - 1) * 0.8, 0.15, 1);
    const furnSlip = 0.35 + 0.65 * clamp((this.stretch - 1) / 0.15, 0, 1);
    for (let i = 1; i < N - 1; i++) {
      const p = pts[i];
      if (!p.c) {
        // 4. A taut rope touching nothing loses a bit of its swing.
        const k = 1 - 0.1 * this.taut;
        p.px = p.x - (p.x - p.px) * k;
        p.pz = p.z - (p.z - p.pz) * k;
        continue;
      }
      const o = p.c;
      const slip = freeAll ? 1 : o.kind === 'pole' ? poleSlip : furnSlip;
      if (slip < 1) {
        const a0 = Math.atan2(p.pz - o.z, p.px - o.x);
        const a1 = Math.atan2(p.z - o.z, p.x - o.x);
        const keep = a0 + wrap(a1 - a0) * slip;
        const r = Math.hypot(p.x - o.x, p.z - o.z);
        p.x = o.x + Math.cos(keep) * r;
        p.z = o.z + Math.sin(keep) * r;
      }
      p.px += (p.x - p.px) * 0.5;
      p.pz += (p.z - p.pz) * 0.5;
    }
    this.measure();
  }

  measure() {
    const { N, pts } = this;
    let len = 0;
    for (let i = 0; i < N - 1; i++) len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
    this.length = len;
    this.stretch = len / this.rest;
    this.taut = smoothstep(1.0, 1.05, this.stretch);

    let wind = 0, endWind = 0;
    for (let i = 1; i < N - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const a1 = Math.atan2(b.z - a.z, b.x - a.x);
      const a2 = Math.atan2(c.z - b.z, c.x - b.x);
      if (Math.hypot(b.x - a.x, b.z - a.z) < 1e-4 || Math.hypot(c.x - b.x, c.z - b.z) < 1e-4) continue;
      const turn = wrap(a2 - a1);
      wind += turn;
      if (i >= N - 9) endWind += turn;
    }
    this.winding = wind / TAU;
    this.humanEndWinding = endWind;

    // Contacts: distinct obstacles, total coil around them, and the one nearest the hand.
    const seen = new Map<Obstacle, number>();
    for (let i = 1; i < N - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      if (!p.c) continue;
      let coil = seen.get(p.c) ?? 0;
      if (q.c === p.c || (i + 1 < N - 1 && Math.hypot(q.x - p.c.x, q.z - p.c.z) < p.c.r + 0.3)) {
        const a0 = Math.atan2(p.z - p.c.z, p.x - p.c.x);
        const a1 = Math.atan2(q.z - p.c.z, q.x - p.c.x);
        coil += wrap(a1 - a0);
      }
      seen.set(p.c, coil);
    }
    this.contacts = seen.size;
    let sw = 0;
    seen.forEach((c) => { sw += c; });
    this.staticWinding = sw / TAU;
    this.nearestPole = null;
    this.nearestPoleCoil = 0;
    for (let i = N - 2; i >= 1; i--) {
      const c = pts[i].c;
      if (c) {
        if (c.kind === 'pole') { this.nearestPole = c; this.nearestPoleCoil = seen.get(c) ?? 0; }
        break;
      }
    }
  }

  /** Tangent direction at each end (chord over 3 segments), pointing along the rope. */
  ends() {
    const { N, pts } = this;
    const d = pts[0], d3 = pts[3], h = pts[N - 1], h3 = pts[N - 4];
    const dl = Math.hypot(d3.x - d.x, d3.z - d.z) || 1;
    const hl = Math.hypot(h3.x - h.x, h3.z - h.z) || 1;
    return {
      dog: { x: (d3.x - d.x) / dl, z: (d3.z - d.z) / dl },
      human: { x: (h3.x - h.x) / hl, z: (h3.z - h.z) / hl },
    };
  }
}

export interface TugOpts {
  dogMass: number; // 1, ×2 with input, ×14 planted
  humanMass: number; // 4, 8 fallen
  dogPulling: boolean;
  planted: boolean;
  dt: number;
  poles: Obstacle[];
}

/** Apply leash tension to both bodies. Returns tension in m/s² (game px/s² / 68). */
export function applyTug(leash: Leash, dog: Body, human: Body, o: TugOpts): number {
  const excess = leash.length - leash.rest;
  if (excess <= 0) return 0;
  const tension = Math.min(32 * excess * leash.taut, 23.5);
  const { dog: dd, human: hd } = leash.ends();
  const shield = 1 / (1 + 0.3 * leash.contacts);
  const turns = Math.abs(leash.staticWinding);
  const pulley = turns > 0.3 && (o.dogPulling || o.planted) ? 1 + 0.4 * Math.min(turns, 3) : 1;

  dog.vx += dd.x * (tension / o.dogMass) * shield * o.dt;
  dog.vz += dd.z * (tension / o.dogMass) * shield * o.dt;

  let fx = hd.x * (tension / o.humanMass) * pulley;
  let fz = hd.z * (tension / o.humanMass) * pulley;
  // Near a pole, the part of the pull aimed into it becomes a step around it,
  // so the human slides round the lamppost instead of sticking to it.
  for (const p of o.poles) {
    const dx = p.x - human.x, dz = p.z - human.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.7 + p.r || d < 1e-4) continue;
    const nx = dx / d, nz = dz / d;
    const into = fx * nx + fz * nz;
    if (into <= 0) continue;
    fx -= nx * into; fz -= nz * into;
    let tx = -nz, tz = nx;
    if (tx * fx + tz * fz < 0) { tx = -tx; tz = -tz; }
    fx += tx * into; fz += tz * into;
  }
  human.vx += fx * o.dt;
  human.vz += fz * o.dt;

  // Damp the velocity components that pull the two ends apart.
  const sepD = -(dog.vx * dd.x + dog.vz * dd.z);
  if (sepD > 0) {
    const k = Math.min(1, 3 * leash.taut * o.dt);
    dog.vx += dd.x * sepD * k; dog.vz += dd.z * sepD * k;
  }
  const sepH = -(human.vx * hd.x + human.vz * hd.z);
  if (sepH > 0) {
    const k = Math.min(1, 5 * leash.taut * o.dt);
    human.vx += hd.x * sepH * k; human.vz += hd.z * sepH * k;
  }
  return tension;
}

/** Hard cap at 1.15× stretch: move both ends back, split by inverse mass. Returns overshoot. */
export function capStretch(leash: Leash, dog: { x: number; z: number }, human: { x: number; z: number }, dogMass: number, humanMass: number) {
  const over = leash.length - leash.rest * 1.15;
  if (over <= 0) return 0;
  const { dog: dd, human: hd } = leash.ends();
  const iD = 1 / dogMass, iH = 1 / humanMass;
  const sD = iD / (iD + iH), sH = iH / (iD + iH);
  dog.x += dd.x * over * sD; dog.z += dd.z * over * sD;
  human.x += hd.x * over * sH; human.z += hd.z * over * sH;
  return over;
}

/**
  Pole whirl trigger (main.gd): all of these must hold for 0.25 s:
  excess > 8 px, |winding| > 0.55 turns, |human-end winding| > 2.4 rad,
  the contact nearest the human is a pole within 70 px of them, and
  0.9 s since the last whirl.
*/
export class WhirlDetector {
  hold = 0;
  cooldown = 0;
  coilSum = 0;
  frames = 0;
  update(leash: Leash, human: { x: number; z: number }, dt: number): { pole: Obstacle; coil: number } | null {
    if (this.cooldown > 0) this.cooldown -= dt;
    const pole = leash.nearestPole;
    const ok =
      this.cooldown <= 0 &&
      leash.length - leash.rest > 0.12 &&
      Math.abs(leash.winding) > 0.55 &&
      Math.abs(leash.humanEndWinding) > 2.4 &&
      pole !== null &&
      Math.hypot(pole.x - human.x, pole.z - human.z) - pole.r < 1.03;
    if (!ok) { this.hold = 0; this.coilSum = 0; this.frames = 0; return null; }
    this.hold += dt;
    this.coilSum += leash.nearestPoleCoil || leash.humanEndWinding;
    this.frames++;
    if (this.hold < 0.25) return null;
    const coil = this.coilSum / this.frames;
    this.hold = 0; this.coilSum = 0; this.frames = 0;
    this.cooldown = 0.9;
    return { pole: pole!, coil };
  }
}
