/*
  Pure state machine and geometry helpers for Boss #2: El Dimoni Gegant on the beach.
  Kept free of Three.js imports so node --test can exercise all phases and counters.
*/

export const DIMONI_POS = { x: 24, z: -38 };
export const DIMONI_MAX_HP = 3;
export const DIMONI_MAX_PLAYER_HITS = 3;
export const DIMONI_FLEE_Z = -15.5;
export const DIMONI_FLEE_DIST = 44;

export interface DimoniCinder {
  active: boolean;
  sx: number;
  sz: number;
  tx: number;
  tz: number;
  t: number;
  dur: number;
  r: number;
}

export interface DimoniFlameLane {
  active: boolean;
  sx: number;
  sz: number;
  tx: number;
  tz: number;
  t: number;
  dur: number;
  halfW: number;
}

export interface DimoniStepEvents {
  cinderVolley: number;
  laneVolley: number;
  cinderImpacts: { x: number; z: number }[];
  laneFired: { x0: number; z0: number; x1: number; z1: number }[];
  playerHit?: 'cinder' | 'lane' | 'devil';
  fled?: boolean;
  bossWon?: boolean;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const inCircle = (px: number, pz: number, cx: number, cz: number, r: number) => {
  const dx = px - cx, dz = pz - cz;
  return dx * dx + dz * dz <= r * r;
};
const inRectLane = (px: number, pz: number, x0: number, z0: number, x1: number, z1: number, halfW: number) => {
  const dx = x1 - x0, dz = z1 - z0;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-6) return false;
  const len = Math.sqrt(len2);
  const ux = dx / len, uz = dz / len;
  const rx = px - x0, rz = pz - z0;
  const along = rx * ux + rz * uz;
  const perp = Math.abs(-rx * uz + rz * ux);
  return along >= 0 && along <= len && perp <= halfW;
};

/** Multi-phase beach boss controller for El Dimoni Gegant. */
export class DimoniState {
  state: 'dormant' | 'active' | 'victory' | 'defeated' = 'dormant';
  hp = DIMONI_MAX_HP;
  maxHp = DIMONI_MAX_HP;
  playerHits = 0;
  hitsCooldown = 0;
  counterCooldown = 0;
  attackT = 0;
  attackIdx = 0;
  victoryT = 0;
  defeatedOnce = false;

  cinders: DimoniCinder[] = Array.from({ length: 4 }, () => ({
    active: false, sx: DIMONI_POS.x, sz: DIMONI_POS.z, tx: 0, tz: 0, t: 0, dur: 1.05, r: 2.0,
  }));
  lanes: DimoniFlameLane[] = Array.from({ length: 2 }, () => ({
    active: false, sx: DIMONI_POS.x, sz: DIMONI_POS.z, tx: 0, tz: 0, t: 0, dur: 1.05, halfW: 1.35,
  }));

  get phase(): 1 | 2 | 3 {
    if (this.hp <= 1) return 3;
    if (this.hp === 2) return 2;
    return 1;
  }

  get active(): boolean {
    return this.state === 'active';
  }

  private clearHazards() {
    for (const c of this.cinders) c.active = false;
    for (const l of this.lanes) l.active = false;
  }

  start() {
    this.hp = DIMONI_MAX_HP;
    this.playerHits = 0;
    this.hitsCooldown = 0;
    this.counterCooldown = 0;
    this.attackT = 0.7;
    this.attackIdx = 0;
    this.victoryT = 0;
    this.clearHazards();
    this.state = 'active';
  }

  reset() {
    this.hp = DIMONI_MAX_HP;
    this.playerHits = 0;
    this.hitsCooldown = 0;
    this.counterCooldown = 0;
    this.attackT = 0;
    this.attackIdx = 0;
    this.victoryT = 0;
    this.clearHazards();
    this.state = 'dormant';
  }

  private applyDamage(nextCooldown = 0): 'hit' | 'defeated' {
    this.hp = Math.max(0, this.hp - 1);
    this.clearHazards();
    this.attackT = 1.2;
    if (nextCooldown > 0) this.counterCooldown = nextCooldown;
    if (this.hp <= 0) {
      this.defeatedOnce = true;
      this.state = 'defeated';
      return 'defeated';
    }
    return 'hit';
  }

  /** Splash wet coat water onto the bonfire embers by barking close to El Dimoni. */
  tryDouse(dogX: number, dogZ: number, dogWet: number): 'hit' | 'defeated' | 'dry' | 'none' {
    if (this.state !== 'active') return 'none';
    if (!inCircle(dogX, dogZ, DIMONI_POS.x, DIMONI_POS.z, 9.5)) return 'none';
    if (dogWet < 0.35) return 'dry';
    return this.applyDamage(1.0);
  }

  /** Deflect a nearby chasing devil's ember spark back onto El Dimoni. */
  tryDevilCounter(dogX: number, dogZ: number, devils: readonly { x: number; z: number }[]): 'hit' | 'defeated' | 'none' {
    if (this.state !== 'active' || this.counterCooldown > 0) return 'none';
    if (!inCircle(dogX, dogZ, DIMONI_POS.x, DIMONI_POS.z, 13.5)) return 'none';
    const nearDevil = devils.some((d) => inCircle(d.x, d.z, dogX, dogZ, 4.0));
    if (!nearDevil) return 'none';
    return this.applyDamage(4.5);
  }

  private applyPlayerHit(events: DimoniStepEvents, kind: 'cinder' | 'lane' | 'devil') {
    if (this.hitsCooldown > 0) return;
    this.hitsCooldown = 1.25;
    this.playerHits++;
    events.playerHit = kind;
    if (this.playerHits >= DIMONI_MAX_PLAYER_HITS) {
      this.clearHazards();
      this.state = 'victory';
      this.victoryT = 1.3;
      events.bossWon = true;
    }
  }

  private spawnCinderVolley(dog: { x: number; z: number; vx?: number; vz?: number }): number {
    const count = this.phase === 1 ? 2 : this.phase === 2 ? 3 : 4;
    const offsets: [number, number][] = [
      [0, 0], [3.6, -2.2], [-3.6, 2.2], [2.4, 3.6],
    ];
    const leadX = dog.x + (dog.vx ?? 0) * 0.35;
    const leadZ = dog.z + (dog.vz ?? 0) * 0.35;
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      const c = this.cinders[i];
      if (!c) continue;
      c.active = true;
      c.sx = DIMONI_POS.x;
      c.sz = DIMONI_POS.z;
      c.tx = clamp(leadX + offsets[i][0], -16, 66);
      c.tz = clamp(leadZ + offsets[i][1], -56, -21);
      c.t = 0;
      c.dur = (this.phase === 3 ? 0.92 : 1.08) + i * 0.12;
      c.r = 2.05;
      spawned++;
    }
    return spawned;
  }

  private spawnFlameLanes(dog: { x: number; z: number }): number {
    const baseAng = Math.atan2(dog.z - DIMONI_POS.z, dog.x - DIMONI_POS.x);
    const angles = this.phase === 3 ? [baseAng - 0.36, baseAng + 0.36] : [baseAng];
    let spawned = 0;
    for (let i = 0; i < angles.length; i++) {
      const l = this.lanes[i];
      if (!l) continue;
      const a = angles[i];
      l.active = true;
      l.sx = DIMONI_POS.x + Math.cos(a) * 3.0;
      l.sz = DIMONI_POS.z + Math.sin(a) * 3.0;
      l.tx = DIMONI_POS.x + Math.cos(a) * 18.5;
      l.tz = DIMONI_POS.z + Math.sin(a) * 18.5;
      l.t = 0;
      l.dur = this.phase === 1 ? 1.15 : 0.98;
      l.halfW = 1.35;
      spawned++;
    }
    return spawned;
  }

  /** Step simulation and resolve cinders, flame sweeps, and devil contacts. */
  step(
    dt: number,
    dog: { x: number; z: number; vx?: number; vz?: number },
    devils: readonly { x: number; z: number }[],
  ): DimoniStepEvents {
    const events: DimoniStepEvents = {
      cinderVolley: 0,
      laneVolley: 0,
      cinderImpacts: [],
      laneFired: [],
    };
    if (this.hitsCooldown > 0) this.hitsCooldown = Math.max(0, this.hitsCooldown - dt);
    if (this.counterCooldown > 0) this.counterCooldown = Math.max(0, this.counterCooldown - dt);

    if (this.state === 'victory') {
      this.victoryT -= dt;
      if (this.victoryT <= 0) this.reset();
      return events;
    }
    if (this.state !== 'active') return events;

    if (dog.z > DIMONI_FLEE_Z || !inCircle(dog.x, dog.z, DIMONI_POS.x, DIMONI_POS.z, DIMONI_FLEE_DIST)) {
      this.reset();
      events.fled = true;
      return events;
    }

    for (const c of this.cinders) {
      if (!c.active) continue;
      c.t += dt;
      if (c.t >= c.dur) {
        c.active = false;
        events.cinderImpacts.push({ x: c.tx, z: c.tz });
        if (inCircle(dog.x, dog.z, c.tx, c.tz, c.r)) {
          this.applyPlayerHit(events, 'cinder');
          if (!this.active) return events;
        }
      }
    }

    for (const l of this.lanes) {
      if (!l.active) continue;
      l.t += dt;
      if (l.t >= l.dur) {
        l.active = false;
        events.laneFired.push({ x0: l.sx, z0: l.sz, x1: l.tx, z1: l.tz });
        if (inRectLane(dog.x, dog.z, l.sx, l.sz, l.tx, l.tz, l.halfW)) {
          this.applyPlayerHit(events, 'lane');
          if (!this.active) return events;
        }
      }
    }

    // Contact check with fire devils on dry sand (sea cools them off).
    if (dog.z > -57.5 && devils.some((d) => inCircle(dog.x, dog.z, d.x, d.z, 1.0))) {
      this.applyPlayerHit(events, 'devil');
      if (!this.active) return events;
    }

    this.attackT -= dt;
    if (this.attackT <= 0) {
      const kind = this.attackIdx % 2;
      this.attackIdx++;
      if (kind === 0) events.cinderVolley = this.spawnCinderVolley(dog);
      else events.laneVolley = this.spawnFlameLanes(dog);
      this.attackT = this.phase === 3 ? 2.0 : 2.55;
    }

    return events;
  }
}
