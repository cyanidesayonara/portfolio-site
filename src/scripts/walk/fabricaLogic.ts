/*
  Pure runtime logic for Phase 9 (La Fàbrica), free of Three.js so node --test can drive it:
  - BinRushState: runaway recycling bins rolling down Avinguda de la Fàbrica on a windy day.
  - ShutterState: the hardware shop's roller shutter coming down unless Millie barks in time.
*/
import { FABRICA_AVENUE } from './fabricaGeom.ts';

/** Bin lanes on the avenue, clear of the tree line down the middle (x = 118). */
export const BIN_LANES = [112.8, 115.4, 121.0, 123.6] as const;
export const BIN_START_Z = 100.5;
export const BIN_END_Z = 38.0;
export const BIN_HIT_R = 1.0;
export const BIN_COOLDOWN = 18;
/** Where a rush can start: the upper half of the avenue. */
export const BIN_TRIGGER = { z0: 70, z1: 92 } as const;

export interface BinEntity {
  lane: number;
  x: number;
  z: number;
  speed: number;
  delay: number;
  active: boolean;
  passed: boolean;
  /** Rolling angle for the mesh (radians). */
  roll: number;
}

export interface BinStepResult {
  startedRush: boolean;
  nextWave: boolean;
  hit: { x: number; z: number } | null;
  /** Survived every wave on the avenue. */
  survived: boolean;
  /** Left the avenue mid-rush: the rush stops without credit. */
  leftAvenue: boolean;
}

const onAvenue = (x: number, z: number) =>
  x >= FABRICA_AVENUE.x0 - 0.5 && x <= FABRICA_AVENUE.x1 + 0.5 && z >= FABRICA_AVENUE.z0 - 1 && z <= FABRICA_AVENUE.z1 + 1;

/**
  Waves of bins rolling south (toward the Rambla) down all four lanes. The tree line
  down the middle of the avenue (and the very edges) stay clear: that is where to duck.
*/
export class BinRushState {
  active = false;
  phase: 'idle' | 'warning' | 'rolling' = 'idle';
  t = 0;
  warnDur = 1.4;
  cooldown = 0;
  survivedOnce = false;
  wave = 0;
  maxWaves = 2;
  bins: BinEntity[] = [];

  constructor() {
    this.bins = this.makeBins(1, 118);
  }

  /** Lanes nearest Millie roll first so each wave asks for a sidestep, then another. */
  private makeBins(waveNum: number, dogX: number): BinEntity[] {
    const speed = 6.8 + waveNum * 1.1;
    const lanes = BIN_LANES.map((_, i) => i);
    const ranked = [...lanes].sort((a, b) => Math.abs(BIN_LANES[a] - dogX) - Math.abs(BIN_LANES[b] - dogX));
    const gap = waveNum === 1 ? 0.55 : 0.4;
    const delays = new Map<number, number>();
    ranked.forEach((lane, rank) => delays.set(lane, rank * gap));
    return lanes.map((lane) => ({
      lane,
      x: BIN_LANES[lane],
      z: BIN_START_Z,
      speed,
      delay: delays.get(lane) ?? 0,
      active: false,
      passed: false,
      roll: 0,
    }));
  }

  private setupWave(waveNum: number, dogX: number) {
    this.wave = waveNum;
    this.phase = 'warning';
    this.t = 0;
    this.warnDur = waveNum === 1 ? 1.4 : 1.0;
    this.bins = this.makeBins(waveNum, dogX);
  }

  canTrigger(dog: { x: number; z: number }, blocked: boolean): boolean {
    return (
      !this.active
      && this.cooldown <= 0
      && !blocked
      && dog.x >= FABRICA_AVENUE.x0
      && dog.x <= FABRICA_AVENUE.x1
      && dog.z >= BIN_TRIGGER.z0
      && dog.z <= BIN_TRIGGER.z1
    );
  }

  start(dogX: number = FABRICA_AVENUE.midX) {
    this.active = true;
    this.setupWave(1, dogX);
  }

  private stop() {
    this.active = false;
    this.phase = 'idle';
    this.t = 0;
    this.cooldown = BIN_COOLDOWN;
  }

  reset() {
    this.active = false;
    this.phase = 'idle';
    this.t = 0;
    this.cooldown = 0;
    this.wave = 0;
    this.bins = this.makeBins(1, FABRICA_AVENUE.midX);
  }

  step(dt: number, dog: { x: number; z: number }): BinStepResult {
    const out: BinStepResult = { startedRush: false, nextWave: false, hit: null, survived: false, leftAvenue: false };

    if (!this.active) {
      if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
      return out;
    }

    if (!onAvenue(dog.x, dog.z)) {
      this.stop();
      out.leftAvenue = true;
      return out;
    }

    this.t += dt;
    if (this.phase === 'warning') {
      if (this.t >= this.warnDur) {
        this.phase = 'rolling';
        this.t = 0;
        out.startedRush = true;
      }
      return out;
    }

    for (const b of this.bins) {
      if (b.passed) continue;
      if (!b.active && this.t >= b.delay) b.active = true;
      if (!b.active) continue;
      b.z -= b.speed * dt;
      b.roll += (b.speed * dt) / 0.55;
      if (Math.hypot(dog.x - b.x, dog.z - b.z) <= BIN_HIT_R) {
        out.hit = { x: b.x, z: b.z };
        this.stop();
        return out;
      }
      if (b.z <= BIN_END_Z) {
        b.passed = true;
        b.active = false;
      }
    }

    if (this.bins.every((b) => b.passed)) {
      if (this.wave < this.maxWaves) {
        this.setupWave(this.wave + 1, dog.x);
        out.nextWave = true;
      } else {
        this.stop();
        this.survivedOnce = true;
        out.survived = true;
      }
    }
    return out;
  }
}

export const SHUTTER_CLOSE_TIME = 9;
export const SHUTTER_REOPEN_TIME = 6;
export const SHUTTER_NOTICE_R = 7;
export const SHUTTER_BARK_R = 6;

export interface ShutterStepResult {
  startedClosing: boolean;
  closed: boolean;
  reopened: boolean;
}

/**
  The hardware shop's roller shutter. When Millie comes near, the shopkeeper starts
  lowering it (0 = open, 1 = shut). A bark in range before it shuts saves the day;
  once shut, it rolls back up after a while so the quest can be tried again.
*/
export class ShutterState {
  phase: 'open' | 'closing' | 'shut' | 'saved' = 'open';
  level = 0;
  t = 0;

  notice(distToShop: number): boolean {
    if (this.phase !== 'open' || distToShop > SHUTTER_NOTICE_R) return false;
    this.phase = 'closing';
    this.t = 0;
    return true;
  }

  /** True when the bark lands in time. */
  bark(distToShop: number): boolean {
    if (this.phase !== 'closing' || distToShop > SHUTTER_BARK_R) return false;
    this.phase = 'saved';
    return true;
  }

  step(dt: number): ShutterStepResult {
    const out: ShutterStepResult = { startedClosing: false, closed: false, reopened: false };
    if (this.phase === 'closing') {
      this.level = Math.min(1, this.level + dt / SHUTTER_CLOSE_TIME);
      if (this.level >= 1) {
        this.phase = 'shut';
        this.t = 0;
        out.closed = true;
      }
    } else if (this.phase === 'shut') {
      this.t += dt;
      if (this.t >= SHUTTER_REOPEN_TIME) {
        this.level = 0;
        this.phase = 'open';
        out.reopened = true;
      }
    } else if (this.phase === 'saved') {
      this.level = Math.max(0, this.level - dt * 0.6);
    }
    return out;
  }

  reset(saved: boolean) {
    this.phase = saved ? 'saved' : 'open';
    this.level = 0;
    this.t = 0;
  }
}
