/*
  Pure runtime logic for Sant Pau i Prim, free of Three.js so node --test can drive it:
  - BottleRushState: runaway butane bottles rolling down Carrer de Sant Pau toward the sea,
    along both gutters; the middle of the street stays clear.
  - EsmoletState: the knife sharpener's whistle on Carrer de Prim; a bark while he whistles
    calls the neighbors out.
  - ListenState: sit still by the accordion player long enough and he plays a tune.
*/
import { SANTPAU_STREET, onSantPauStreet } from './santpauGeom.ts';

/** Bottle lanes: two along each gutter, clear of the middle of the street (x = -122). */
export const BOTTLE_LANES = [-125.0, -123.6, -120.4, -119.0] as const;
export const BOTTLE_START_Z = 124.5;
export const BOTTLE_END_Z = 36.0;
export const BOTTLE_HIT_R = 0.9;
export const BOTTLE_COOLDOWN = 18;
/** Where a rush can start: the upper part of the street, above the side street. */
export const BOTTLE_TRIGGER = { z0: 96, z1: 116 } as const;

export interface BottleEntity {
  lane: number;
  x: number;
  z: number;
  speed: number;
  delay: number;
  active: boolean;
  passed: boolean;
  roll: number;
}

export interface BottleStepResult {
  startedRush: boolean;
  nextWave: boolean;
  hit: { x: number; z: number } | null;
  survived: boolean;
  /** Left the street mid-rush: the rush stops without credit. */
  leftStreet: boolean;
}

export class BottleRushState {
  active = false;
  phase: 'idle' | 'warning' | 'rolling' = 'idle';
  t = 0;
  warnDur = 1.4;
  cooldown = 0;
  survivedOnce = false;
  wave = 0;
  maxWaves = 2;
  bottles: BottleEntity[] = [];

  constructor() {
    this.bottles = this.make(1, SANTPAU_STREET.midX);
  }

  /** The lanes nearest Millie roll first, so each wave asks for a step to the middle. */
  private make(waveNum: number, dogX: number): BottleEntity[] {
    const speed = 7.2 + waveNum * 1.2;
    const lanes = BOTTLE_LANES.map((_, i) => i);
    const ranked = [...lanes].sort((a, b) => Math.abs(BOTTLE_LANES[a] - dogX) - Math.abs(BOTTLE_LANES[b] - dogX));
    const gap = waveNum === 1 ? 0.5 : 0.35;
    const delays = new Map<number, number>();
    ranked.forEach((lane, rank) => delays.set(lane, rank * gap));
    return lanes.map((lane) => ({
      lane, x: BOTTLE_LANES[lane], z: BOTTLE_START_Z, speed, delay: delays.get(lane) ?? 0, active: false, passed: false, roll: 0,
    }));
  }

  private setupWave(waveNum: number, dogX: number) {
    this.wave = waveNum;
    this.phase = 'warning';
    this.t = 0;
    this.warnDur = waveNum === 1 ? 1.4 : 1.0;
    this.bottles = this.make(waveNum, dogX);
  }

  canTrigger(dog: { x: number; z: number }, blocked: boolean): boolean {
    return !this.active && this.cooldown <= 0 && !blocked
      && dog.x >= SANTPAU_STREET.x0 && dog.x <= SANTPAU_STREET.x1
      && dog.z >= BOTTLE_TRIGGER.z0 && dog.z <= BOTTLE_TRIGGER.z1;
  }

  start(dogX: number = SANTPAU_STREET.midX) {
    this.active = true;
    this.setupWave(1, dogX);
  }

  private stop() {
    this.active = false;
    this.phase = 'idle';
    this.t = 0;
    this.cooldown = BOTTLE_COOLDOWN;
  }

  reset() {
    this.active = false;
    this.phase = 'idle';
    this.t = 0;
    this.cooldown = 0;
    this.wave = 0;
    this.bottles = this.make(1, SANTPAU_STREET.midX);
  }

  step(dt: number, dog: { x: number; z: number }): BottleStepResult {
    const out: BottleStepResult = { startedRush: false, nextWave: false, hit: null, survived: false, leftStreet: false };
    if (!this.active) {
      if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
      return out;
    }
    if (!onSantPauStreet(dog.x, dog.z)) {
      this.stop();
      out.leftStreet = true;
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
    for (const b of this.bottles) {
      if (b.passed) continue;
      if (!b.active && this.t >= b.delay) b.active = true;
      if (!b.active) continue;
      b.z -= b.speed * dt;
      b.roll += (b.speed * dt) / 0.16;
      if (Math.hypot(dog.x - b.x, dog.z - b.z) <= BOTTLE_HIT_R) {
        out.hit = { x: b.x, z: b.z };
        this.stop();
        return out;
      }
      if (b.z <= BOTTLE_END_Z) {
        b.passed = true;
        b.active = false;
      }
    }
    if (this.bottles.every((b) => b.passed)) {
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

export const ESMOLET_PERIOD = 11;
export const ESMOLET_WHISTLE = 3.2;
export const ESMOLET_BARK_R = 6.5;

/** The knife sharpener whistles for ESMOLET_WHISTLE seconds every ESMOLET_PERIOD seconds. */
export class EsmoletState {
  t = 0;
  answered = false;

  get whistling(): boolean {
    return !this.answered && this.t % ESMOLET_PERIOD < ESMOLET_WHISTLE;
  }

  /** Returns true when a whistle just started. */
  step(dt: number): boolean {
    const before = this.t % ESMOLET_PERIOD;
    this.t += dt;
    return !this.answered && this.t % ESMOLET_PERIOD < before;
  }

  /** True when the bark lands while he whistles, close enough. */
  bark(dist: number): boolean {
    if (this.answered || !this.whistling || dist > ESMOLET_BARK_R) return false;
    this.answered = true;
    return true;
  }
}

export const LISTEN_R = 3.2;
export const LISTEN_TIME = 4;
/** Above this speed Millie is not sitting still. */
export const LISTEN_STILL = 0.35;

/** Sit still near the accordion player for LISTEN_TIME seconds; moving away lets it fade. */
export class ListenState {
  t = 0;
  done = false;

  /** Returns true the moment the tune is earned. */
  step(dt: number, dist: number, speed: number): boolean {
    if (this.done) return false;
    if (dist <= LISTEN_R && speed <= LISTEN_STILL) this.t += dt;
    else this.t = Math.max(0, this.t - dt * 2);
    if (this.t >= LISTEN_TIME) {
      this.done = true;
      return true;
    }
    return false;
  }
}
