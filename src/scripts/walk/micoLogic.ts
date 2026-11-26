/*
  Pure state machine and geometry helpers for Boss #1: El Mico de Bronze at West Quay.
  Kept free of Three.js imports so node --test can drive full boss phases directly.
*/

export const MICO_HOME = { x: -197, z: -12 };
export const MICO_ARENA = { x0: -207, x1: -182, z0: -23, z1: -1.5, fleeX: -176 };
export const MICO_MAX_HP = 3;
export const MICO_PLAYER_MAX_HITS = 3;

export type MicoStateName =
  | 'dormant'
  | 'intro'
  | 'pace'
  | 'leapWindup'
  | 'leapAir'
  | 'tossWindup'
  | 'chargeWindup'
  | 'charging'
  | 'stunned'
  | 'recover'
  | 'victory'
  | 'defeated';

export interface MicoJug {
  active: boolean;
  sx: number;
  sz: number;
  tx: number;
  tz: number;
  t: number;
  dur: number;
  r: number;
}

export interface MicoStepEvents {
  landed?: { x: number; z: number };
  tossed?: number;
  chargeStarted?: boolean;
  bollardBonk?: { x: number; z: number };
  stunExpired?: boolean;
  playerHit?: 'leap' | 'jug' | 'charge';
  jugImpacts: { x: number; z: number }[];
  fled?: boolean;
  bossWon?: boolean;
}

type AttackKind = 'leap' | 'toss' | 'charge';
const PHASE_SCRIPT: Record<1 | 2 | 3, AttackKind[]> = {
  1: ['leap', 'charge'],
  2: ['toss', 'charge', 'leap'],
  3: ['leap', 'toss', 'charge'],
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const clampArenaX = (x: number) => clamp(x, MICO_ARENA.x0, MICO_ARENA.x1);
const clampArenaZ = (z: number) => clamp(z, MICO_ARENA.z0, MICO_ARENA.z1);
const inCircle = (px: number, pz: number, cx: number, cz: number, r: number) => {
  const dx = px - cx, dz = pz - cz;
  return dx * dx + dz * dz <= r * r;
};

/** Stateful controller for El Mico de Bronze (3 HP phases, bollard charge-lure, and stun punish). */
export class MicoState {
  state: MicoStateName = 'dormant';
  hp = MICO_MAX_HP;
  maxHp = MICO_MAX_HP;
  playerHits = 0;
  x = MICO_HOME.x;
  z = MICO_HOME.z;
  y = 0;
  heading = 0;
  stateT = 0;
  dur = 0;
  sx = MICO_HOME.x;
  sz = MICO_HOME.z;
  tx = MICO_HOME.x;
  tz = MICO_HOME.z;
  hitsCooldown = 0;
  cycleIdx = 0;
  stunReason: 'bollard' | 'whirl' | null = null;
  defeatedOnce = false;
  jugs: MicoJug[] = Array.from({ length: 3 }, () => ({
    active: false, sx: 0, sz: 0, tx: 0, tz: 0, t: 0, dur: 0.95, r: 1.7,
  }));

  get phase(): 1 | 2 | 3 {
    if (this.hp <= 1) return 3;
    if (this.hp === 2) return 2;
    return 1;
  }

  get active(): boolean {
    return this.state !== 'dormant' && this.state !== 'defeated' && this.state !== 'victory';
  }

  private clearJugs() {
    for (const j of this.jugs) j.active = false;
  }

  start() {
    this.hp = MICO_MAX_HP;
    this.playerHits = 0;
    this.x = MICO_HOME.x;
    this.z = MICO_HOME.z;
    this.y = 0;
    this.heading = 0;
    this.cycleIdx = 0;
    this.hitsCooldown = 0;
    this.stunReason = null;
    this.clearJugs();
    this.enter('intro', 0.95);
  }

  reset() {
    this.hp = MICO_MAX_HP;
    this.playerHits = 0;
    this.x = MICO_HOME.x;
    this.z = MICO_HOME.z;
    this.y = 0;
    this.heading = 0;
    this.cycleIdx = 0;
    this.hitsCooldown = 0;
    this.stunReason = null;
    this.clearJugs();
    this.enter('dormant', 0);
  }

  private enter(next: MicoStateName, dur: number) {
    this.state = next;
    this.stateT = 0;
    this.dur = dur;
  }

  /** Trigger dizzy stun from colliding into a harbor bollard or a nearby pole whirl. */
  triggerStun(reason: 'bollard' | 'whirl'): boolean {
    if (!this.active || this.state === 'stunned' || this.state === 'intro') return false;
    this.y = 0;
    this.stunReason = reason;
    this.enter('stunned', 4.2);
    return true;
  }

  /** Counter-bark while El Mico is stunned to deal 1 HP of stamina damage. */
  tryBarkHit(dogX: number, dogZ: number): 'hit' | 'defeated' | 'none' {
    if (this.state !== 'stunned') return 'none';
    if (!inCircle(dogX, dogZ, this.x, this.z, 5.2)) return 'none';
    this.hp = Math.max(0, this.hp - 1);
    this.clearJugs();
    this.stunReason = null;
    this.hitsCooldown = 0.8;
    if (this.hp <= 0) {
      this.defeatedOnce = true;
      this.enter('defeated', 2.4);
      return 'defeated';
    }
    this.enter('recover', 1.05);
    return 'hit';
  }

  private pickNextAttack(dog: { x: number; z: number }) {
    const seq = PHASE_SCRIPT[this.phase];
    const kind = seq[this.cycleIdx % seq.length];
    this.cycleIdx++;
    this.sx = this.x;
    this.sz = this.z;
    if (kind === 'leap') {
      this.tx = clampArenaX(dog.x);
      this.tz = clampArenaZ(dog.z);
      this.enter('leapWindup', this.phase === 3 ? 0.62 : 0.78);
    } else if (kind === 'toss') {
      this.enter('tossWindup', 0.65);
    } else {
      this.aimCharge(dog);
      this.enter('chargeWindup', this.phase === 3 ? 0.8 : 0.95);
    }
  }

  private aimCharge(dog: { x: number; z: number }) {
    const dx = dog.x - this.x;
    const dz = dog.z - this.z;
    const d = Math.hypot(dx, dz) || 1;
    const ux = dx / d, uz = dz / d;
    this.sx = this.x;
    this.sz = this.z;
    this.tx = clampArenaX(this.x + ux * 15);
    this.tz = clampArenaZ(this.z + uz * 15);
    this.heading = Math.atan2(this.tz - this.z, this.tx - this.x);
  }

  private spawnJugs(dog: { x: number; z: number; vx?: number; vz?: number }): number {
    const count = this.phase >= 3 ? 3 : 2;
    const spread: [number, number][] = count === 2
      ? [[0, 0], [3.2, -1.8]]
      : [[0, 0], [3.4, -2.0], [-3.2, 2.1]];
    const leadX = dog.x + (dog.vx ?? 0) * 0.4;
    const leadZ = dog.z + (dog.vz ?? 0) * 0.4;
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      const j = this.jugs[i];
      if (!j) continue;
      j.active = true;
      j.sx = this.x;
      j.sz = this.z;
      j.tx = clampArenaX(leadX + spread[i][0]);
      j.tz = clampArenaZ(leadZ + spread[i][1]);
      j.t = 0;
      j.dur = 0.95 + i * 0.14;
      j.r = 1.75;
      spawned++;
    }
    return spawned;
  }

  private applyPlayerHit(events: MicoStepEvents, kind: 'leap' | 'jug' | 'charge') {
    if (this.hitsCooldown > 0) return;
    this.hitsCooldown = 1.25;
    this.playerHits++;
    events.playerHit = kind;
    if (this.playerHits >= MICO_PLAYER_MAX_HITS) {
      this.clearJugs();
      this.y = 0;
      this.enter('victory', 1.5);
      events.bossWon = true;
    }
  }

  /** Advance one simulation tick. */
  step(
    dt: number,
    dog: { x: number; z: number; vx?: number; vz?: number },
    bollards: readonly [number, number][],
  ): MicoStepEvents {
    const events: MicoStepEvents = { jugImpacts: [] };
    if (this.hitsCooldown > 0) this.hitsCooldown = Math.max(0, this.hitsCooldown - dt);

    // Tick thrown jugs regardless of phase.
    for (const j of this.jugs) {
      if (!j.active) continue;
      j.t += dt;
      if (j.t >= j.dur) {
        j.active = false;
        events.jugImpacts.push({ x: j.tx, z: j.tz });
        if (this.active && inCircle(dog.x, dog.z, j.tx, j.tz, j.r)) {
          this.applyPlayerHit(events, 'jug');
        }
      }
    }

    if (this.state === 'dormant') return events;
    this.stateT += dt;

    if (this.state === 'defeated') {
      if (this.stateT >= this.dur) {
        this.x = MICO_HOME.x;
        this.z = MICO_HOME.z;
        this.y = 0;
      }
      return events;
    }

    if (this.state === 'victory') {
      if (this.stateT >= this.dur) this.reset();
      return events;
    }

    // If Millie retreats east across the canal bridge, reset cleanly.
    if (dog.x > MICO_ARENA.fleeX) {
      this.reset();
      events.fled = true;
      return events;
    }

    const toDogAngle = Math.atan2(dog.z - this.z, dog.x - this.x);

    switch (this.state) {
      case 'intro':
        this.heading = toDogAngle;
        if (this.stateT >= this.dur) this.pickNextAttack(dog);
        break;

      case 'recover':
        this.heading = toDogAngle;
        if (this.stateT >= this.dur) this.pickNextAttack(dog);
        break;

      case 'pace': {
        this.heading = toDogAngle;
        const speed = 2.6;
        const dx = dog.x - this.x, dz = dog.z - this.z, d = Math.hypot(dx, dz) || 1;
        this.x = clampArenaX(this.x + (dx / d) * speed * dt);
        this.z = clampArenaZ(this.z + (dz / d) * speed * dt);
        if (this.stateT >= this.dur) this.pickNextAttack(dog);
        break;
      }

      case 'leapWindup':
        if (this.stateT < this.dur * 0.5) {
          this.tx = clampArenaX(dog.x);
          this.tz = clampArenaZ(dog.z);
        }
        this.heading = Math.atan2(this.tz - this.z, this.tx - this.x);
        if (this.stateT >= this.dur) {
          this.sx = this.x;
          this.sz = this.z;
          this.enter('leapAir', 0.54);
        }
        break;

      case 'leapAir': {
        const u = clamp(this.stateT / Math.max(0.01, this.dur), 0, 1);
        this.x = this.sx + (this.tx - this.sx) * u;
        this.z = this.sz + (this.tz - this.sz) * u;
        this.y = Math.sin(u * Math.PI) * 4.2;
        if (u >= 1) {
          this.y = 0;
          events.landed = { x: this.x, z: this.z };
          if (inCircle(dog.x, dog.z, this.x, this.z, 2.95)) {
            this.applyPlayerHit(events, 'leap');
          }
          if (this.state === 'leapAir') this.enter('pace', this.phase === 3 ? 0.55 : 0.85);
        }
        break;
      }

      case 'tossWindup':
        this.heading = toDogAngle;
        if (this.stateT >= this.dur) {
          events.tossed = this.spawnJugs(dog);
          this.enter('pace', 0.95);
        }
        break;

      case 'chargeWindup':
        // Aim tracks gently for the first 45%, then locks the red lane so dodging is crisp.
        if (this.stateT < this.dur * 0.45) this.aimCharge(dog);
        if (this.stateT >= this.dur) {
          events.chargeStarted = true;
          this.enter('charging', 1.45);
        }
        break;

      case 'charging': {
        const dx = this.tx - this.x;
        const dz = this.tz - this.z;
        const d = Math.hypot(dx, dz);
        const speed = this.phase === 3 ? 13.0 : 11.4;
        const stepDist = speed * dt;
        if (d > 0.05) {
          const move = Math.min(d, stepDist);
          this.x += (dx / d) * move;
          this.z += (dz / d) * move;
        }
        // Check collision against harbor mooring bollards.
        for (const [bx, bz] of bollards) {
          if (inCircle(this.x, this.z, bx, bz, 1.35)) {
            this.triggerStun('bollard');
            events.bollardBonk = { x: bx, z: bz };
            return events;
          }
        }
        if (inCircle(dog.x, dog.z, this.x, this.z, 1.55)) {
          this.applyPlayerHit(events, 'charge');
          if (this.state !== 'charging') return events;
        }
        if (d <= 0.25 || this.stateT >= this.dur) {
          this.enter('pace', this.phase === 3 ? 0.6 : 0.9);
        }
        break;
      }

      case 'stunned':
        if (this.stateT >= this.dur) {
          this.stunReason = null;
          events.stunExpired = true;
          this.enter('pace', 0.65);
        }
        break;
    }

    return events;
  }
}
