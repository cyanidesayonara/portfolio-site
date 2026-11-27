/*
  Pure state machine and geometry helpers for Boss #3: the Roman Mosaic Guardian
  on Dalt de la Vila's mid-terrace outside the Museu.
  Kept free of Three.js imports so node --test can drive full boss phases directly.
*/

export const MOSAIC_HOME = { x: 7.5, z: 200.2 };
export const MOSAIC_ARENA = { x0: -9.5, x1: 14.0, z0: 196.4, z1: 203.5 };
export const MOSAIC_MAX_HP = 3;
export const MOSAIC_MAX_PLAYER_HITS = 3;
export const MOSAIC_LAMPS = [
  { x: -9.0, z: 196.8 },
  { x: 10.8, z: 196.8 },
] as const;

export type MosaicPhaseState =
  | 'dormant'
  | 'intro'
  | 'tiles'
  | 'sweep_windup'
  | 'sweep'
  | 'exposed'
  | 'recover'
  | 'defeated';

export interface TileBurst {
  active: boolean;
  x: number;
  z: number;
  r: number;
  t: number;
  dur: number;
}

export interface SweepLane {
  active: boolean;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  halfW: number;
  t: number;
  dur: number;
}

export interface Keystone {
  active: boolean;
  x: number;
  z: number;
  r: number;
}

export interface MosaicStepEvents {
  fled: boolean;
  tileVolley: boolean;
  tileImpacts: { x: number; z: number }[];
  sweepTelegraphed: boolean;
  sweepFired: { x0: number; z0: number; x1: number; z1: number } | null;
  exposed: boolean;
  playerHit: null | 'tile' | 'sweep';
  bossWon: boolean;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const inCircle = (px: number, pz: number, cx: number, cz: number, r: number) => {
  const dx = px - cx, dz = pz - cz;
  return dx * dx + dz * dz <= r * r;
};

function pointSegDist(px: number, pz: number, x0: number, z0: number, x1: number, z1: number): number {
  const dx = x1 - x0, dz = z1 - z0;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-8) return Math.hypot(px - x0, pz - z0);
  const t = clamp(((px - x0) * dx + (pz - z0) * dz) / len2, 0, 1);
  return Math.hypot(px - (x0 + t * dx), pz - (z0 + t * dz));
}

/** Stateful controller for the Roman Mosaic Guardian outside Museu (3 phases, whirl-break, keystone bark). */
export class MosaicState {
  state: MosaicPhaseState = 'dormant';
  hp = MOSAIC_MAX_HP;
  maxHp = MOSAIC_MAX_HP;
  playerHits = 0;
  defeatedOnce = false;
  x = MOSAIC_HOME.x;
  z = MOSAIC_HOME.z;
  heading = Math.PI;
  stateT = 0;
  dur = 0;
  invulnT = 0;
  attackIdx = 0;
  lastBreakKind: 'sweep' | 'whirl' | null = null;

  tiles: TileBurst[] = Array.from({ length: 4 }, () => ({
    active: false, x: 0, z: 0, r: 1.85, t: 0, dur: 1.0,
  }));

  lane: SweepLane = {
    active: false, x0: 0, z0: 200, x1: 0, z1: 200, halfW: 1.35, t: 0, dur: 1.0,
  };

  keystone: Keystone = { active: false, x: MOSAIC_HOME.x - 2.8, z: 200.0, r: 2.0 };

  get active(): boolean {
    return this.state !== 'dormant' && this.state !== 'defeated';
  }

  get phase(): 1 | 2 | 3 {
    if (this.hp <= 1) return 3;
    if (this.hp === 2) return 2;
    return 1;
  }

  private clearTelegraphs() {
    for (const t of this.tiles) t.active = false;
    this.lane.active = false;
    this.keystone.active = false;
  }

  private enter(next: MosaicPhaseState, dur: number) {
    this.state = next;
    this.stateT = 0;
    this.dur = dur;
  }

  start() {
    this.hp = MOSAIC_MAX_HP;
    this.playerHits = 0;
    this.x = MOSAIC_HOME.x;
    this.z = MOSAIC_HOME.z;
    this.heading = Math.PI;
    this.invulnT = 0;
    this.attackIdx = 0;
    this.lastBreakKind = null;
    this.clearTelegraphs();
    this.enter('intro', 1.0);
  }

  reset() {
    this.hp = MOSAIC_MAX_HP;
    this.playerHits = 0;
    this.x = MOSAIC_HOME.x;
    this.z = MOSAIC_HOME.z;
    this.heading = Math.PI;
    this.invulnT = 0;
    this.attackIdx = 0;
    this.lastBreakKind = null;
    this.clearTelegraphs();
    this.enter('dormant', 0);
  }

  private spawnTiles(dog: { x: number; z: number; vx: number; vz: number }) {
    this.clearTelegraphs();
    const count = Math.min(this.tiles.length, 1 + this.phase);
    const dur = 1.15 - this.phase * 0.1;
    const leadX = clamp(dog.x + dog.vx * 0.35, MOSAIC_ARENA.x0 + 1.4, MOSAIC_ARENA.x1 - 1.4);
    const leadZ = clamp(dog.z + dog.vz * 0.25, MOSAIC_ARENA.z0 + 0.8, MOSAIC_ARENA.z1 - 0.8);
    const offsets: [number, number][] = [
      [0, 0],
      [leadX > 2 ? -4.2 : 4.2, leadZ > 200 ? -1.4 : 1.4],
      [leadX > 2 ? 3.8 : -3.8, leadZ > 200 ? 1.2 : -1.2],
      [leadX > 2 ? -7.6 : 7.6, 0],
    ];
    for (let i = 0; i < count; i++) {
      const [ox, oz] = offsets[i];
      const tb = this.tiles[i];
      tb.active = true;
      tb.x = clamp(leadX + ox, MOSAIC_ARENA.x0 + 1.2, MOSAIC_ARENA.x1 - 1.2);
      tb.z = clamp(leadZ + oz, MOSAIC_ARENA.z0 + 0.7, MOSAIC_ARENA.z1 - 0.7);
      tb.r = 1.85;
      tb.t = -i * 0.08;
      tb.dur = dur;
    }
    this.heading = Math.atan2(dog.z - this.z, dog.x - this.x);
    this.enter('tiles', dur + 0.35);
  }

  private startSweepWindup(dog: { x: number; z: number }) {
    this.clearTelegraphs();
    const x0 = this.x;
    const z0 = clamp(dog.z, 197.4, 202.6);
    const x1 = this.x > 2 ? -8.5 : 13.0;
    const z1 = z0;
    const dur = 1.1 - this.phase * 0.1;
    this.lane = { active: true, x0, z0, x1, z1, halfW: 1.35, t: 0, dur };
    this.heading = Math.atan2(z1 - z0, x1 - x0);
    this.enter('sweep_windup', dur);
  }

  private activateExposed(kind: 'sweep' | 'whirl', dur: number) {
    this.clearTelegraphs();
    this.lastBreakKind = kind;
    this.keystone = {
      active: true,
      x: clamp(this.x + (this.x > 2 ? -2.8 : 2.8), -8.0, 12.5),
      z: 200.0,
      r: 2.0,
    };
    this.enter('exposed', dur);
  }

  private applyPlayerHit(events: MosaicStepEvents, kind: 'tile' | 'sweep') {
    if (this.invulnT > 0) return;
    this.invulnT = 1.25;
    this.playerHits++;
    events.playerHit = kind;
    if (this.playerHits >= MOSAIC_MAX_PLAYER_HITS) {
      events.bossWon = true;
      this.reset();
    }
  }

  step(dt: number, dog: { x: number; y: number; z: number; vx: number; vz: number }): MosaicStepEvents {
    const events: MosaicStepEvents = {
      fled: false,
      tileVolley: false,
      tileImpacts: [],
      sweepTelegraphed: false,
      sweepFired: null,
      exposed: false,
      playerHit: null,
      bossWon: false,
    };

    if (this.state === 'dormant') return events;
    if (this.invulnT > 0) this.invulnT = Math.max(0, this.invulnT - dt);
    this.stateT += dt;

    if (this.state === 'defeated') {
      return events;
    }

    // Flee if Millie leaves Dalt de la Vila's mid-terrace outside Museu.
    if (
      dog.z < 191 || dog.z > 209 || dog.x < -14.5 || dog.x > 18
      || dog.y < 3.6 || dog.y > 7.8
    ) {
      this.reset();
      events.fled = true;
      return events;
    }

    if (this.state === 'intro') {
      if (this.stateT >= this.dur) {
        this.spawnTiles(dog);
        events.tileVolley = true;
      }
      return events;
    }

    if (this.state === 'tiles') {
      let anyActive = false;
      for (const tb of this.tiles) {
        if (!tb.active) continue;
        tb.t += dt;
        if (tb.t >= tb.dur) {
          tb.active = false;
          events.tileImpacts.push({ x: tb.x, z: tb.z });
          if (inCircle(dog.x, dog.z, tb.x, tb.z, tb.r - 0.1)) {
            this.applyPlayerHit(events, 'tile');
            if (events.bossWon) return events;
          }
        } else {
          anyActive = true;
        }
      }
      if (!anyActive) {
        this.startSweepWindup(dog);
        events.sweepTelegraphed = true;
      }
      return events;
    }

    if (this.state === 'sweep_windup') {
      this.lane.t = Math.min(this.lane.dur, this.stateT);
      if (this.stateT >= this.dur) {
        this.enter('sweep', 0.55);
      }
      return events;
    }

    if (this.state === 'sweep') {
      const u = clamp(this.stateT / Math.max(0.01, this.dur), 0, 1);
      this.x = this.lane.x0 + (this.lane.x1 - this.lane.x0) * u;
      this.z = this.lane.z0 + (this.lane.z1 - this.lane.z0) * u;
      if (pointSegDist(dog.x, dog.z, this.lane.x0, this.lane.z0, this.x, this.z) <= this.lane.halfW) {
        this.applyPlayerHit(events, 'sweep');
        if (events.bossWon) return events;
      }
      if (this.stateT >= this.dur) {
        events.sweepFired = { x0: this.lane.x0, z0: this.lane.z0, x1: this.lane.x1, z1: this.lane.z1 };
        this.activateExposed('sweep', 4.2);
        events.exposed = true;
      }
      return events;
    }

    if (this.state === 'exposed') {
      if (this.stateT >= this.dur) {
        this.clearTelegraphs();
        this.enter('recover', 0.7);
      }
      return events;
    }

    if (this.state === 'recover') {
      this.heading = Math.atan2(dog.z - this.z, dog.x - this.x);
      if (this.stateT >= this.dur) {
        this.attackIdx++;
        this.spawnTiles(dog);
        events.tileVolley = true;
      }
      return events;
    }

    return events;
  }

  /** Whirling either mid-terrace lamp shatters the Guardian's shield into 'exposed'. */
  tryWhirlBreak(poleX: number, poleZ: number): boolean {
    if (!this.active || this.state === 'exposed' || this.state === 'intro') return false;
    const nearLamp = MOSAIC_LAMPS.some((l) => Math.hypot(poleX - l.x, poleZ - l.z) <= 2.2);
    if (!nearLamp) return false;
    this.activateExposed('whirl', 4.8);
    return true;
  }

  /** Bark [E] near the exposed Guardian or golden keystone to shatter 1 mosaic layer. */
  tryBarkCrack(dogX: number, dogZ: number): 'none' | 'shielded' | 'hit' | 'defeated' {
    if (!this.active) return 'none';
    if (this.state !== 'exposed') {
      return Math.hypot(dogX - this.x, dogZ - this.z) < 5.0 ? 'shielded' : 'none';
    }
    const nearBoss = Math.hypot(dogX - this.x, dogZ - this.z) <= 5.2;
    const nearKeystone = this.keystone.active && Math.hypot(dogX - this.keystone.x, dogZ - this.keystone.z) <= this.keystone.r + 1.4;
    if (!nearBoss && !nearKeystone) return 'none';

    this.hp = Math.max(0, this.hp - 1);
    this.clearTelegraphs();
    this.lastBreakKind = null;
    if (this.hp <= 0) {
      this.defeatedOnce = true;
      this.enter('defeated', 2.8);
      return 'defeated';
    }
    this.enter('recover', 0.85);
    return 'hit';
  }
}
