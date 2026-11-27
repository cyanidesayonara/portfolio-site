/*
  Pure runtime state machines for Phase 8 (Ronda / Parc):
  - TrafficState: ambient cars and buses looping through the sunken highway trench
  - ScooterRushState: runaway delivery scooters across the overpass approaches
  Kept free of Three.js imports so node --test can drive both directly.
*/
import { RONDA_BRIDGE, RONDA_TRAFFIC } from './rondaGeom.ts';

export interface TrafficVehicle {
  lane: number;
  x: number;
  z: number;
  dir: 1 | -1;
  speed: number;
  kind: 'car' | 'bus';
}

export interface TrafficStepEvents {
  passed: number;
}

/** Ambient trench traffic — visual only; no dog hits. */
export class TrafficState {
  vehicles: TrafficVehicle[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    const lanes = RONDA_TRAFFIC.laneZ;
    this.vehicles = [
      { lane: 0, x: -210, z: lanes[0], dir: 1, speed: 11.5, kind: 'car' },
      { lane: 1, x: -160, z: lanes[1], dir: -1, speed: 9.2, kind: 'bus' },
      { lane: 2, x: -130, z: lanes[2], dir: 1, speed: 13.0, kind: 'car' },
      { lane: 0, x: -145, z: lanes[0], dir: 1, speed: 10.4, kind: 'car' },
      { lane: 1, x: -190, z: lanes[1], dir: -1, speed: 8.6, kind: 'bus' },
      { lane: 2, x: -175, z: lanes[2], dir: 1, speed: 12.2, kind: 'car' },
    ];
  }

  step(dt: number): TrafficStepEvents {
    let passed = 0;
    for (const v of this.vehicles) {
      v.x += v.dir * v.speed * dt;
      if (v.dir > 0 && v.x > RONDA_TRAFFIC.x1) {
        v.x = RONDA_TRAFFIC.x0;
        passed++;
      } else if (v.dir < 0 && v.x < RONDA_TRAFFIC.x0) {
        v.x = RONDA_TRAFFIC.x1;
        passed++;
      }
    }
    return { passed };
  }
}

export const SCOOTER_LANES = [-174.5, -165.0, -155.5] as const;
export const SCOOTER_START_Z = 128.5;
export const SCOOTER_END_Z = 152.5;
export const SCOOTER_SAFE_SOUTH_Z = 126.5;
export const SCOOTER_SAFE_NORTH_Z = 154.5;
export const SCOOTER_SAFE_WEST_X = -182.0;
export const SCOOTER_SAFE_EAST_X = -148.0;
export const SCOOTER_HIT_R = 1.05;
export const SCOOTER_COOLDOWN = 15;

export interface ScooterEntity {
  lane: number;
  x: number;
  z: number;
  speed: number;
  delay: number;
  active: boolean;
  passed: boolean;
}

export interface ScooterStepResult {
  startedRush: boolean;
  nextWave: boolean;
  hit: { x: number; z: number } | null;
  escaped: boolean;
}

/** Runaway delivery scooters charging north across the Pont de vianants approaches. */
export class ScooterRushState {
  active = false;
  phase: 'idle' | 'warning' | 'charging' = 'idle';
  t = 0;
  warnDur = 1.3;
  cooldown = 0;
  survivedOnce = false;
  wave = 0;
  maxWaves = 2;

  scooters: ScooterEntity[] = SCOOTER_LANES.map((x, lane) => ({
    lane,
    x,
    z: SCOOTER_START_Z,
    speed: 8.4,
    delay: lane * 0.48,
    active: false,
    passed: false,
  }));

  private setupWave(waveNum: number, dogX: number) {
    this.wave = waveNum;
    this.phase = 'warning';
    this.t = 0;
    this.warnDur = waveNum === 1 ? 1.3 : 0.95;
    const speed = 7.6 + waveNum * 1.0;
    const ranked = [0, 1, 2].sort(
      (a, b) => Math.abs(SCOOTER_LANES[a] - dogX) - Math.abs(SCOOTER_LANES[b] - dogX),
    );
    const delays = [0, 0, 0];
    ranked.forEach((laneIdx, rank) => {
      delays[laneIdx] = rank * 0.48;
    });
    this.scooters = SCOOTER_LANES.map((x, lane) => ({
      lane,
      x,
      z: SCOOTER_START_Z,
      speed,
      delay: delays[lane],
      active: false,
      passed: false,
    }));
  }

  /** Trigger zone: south approach to the overpass. */
  canTrigger(dog: { x: number; z: number }, blocked: boolean): boolean {
    return (
      !this.active
      && this.cooldown <= 0
      && !blocked
      && dog.x >= RONDA_BRIDGE.x0 - 2
      && dog.x <= RONDA_BRIDGE.x1 + 2
      && dog.z >= 120
      && dog.z <= 136
    );
  }

  tryBarkStart(dog: { x: number; z: number }, blocked: boolean): boolean {
    if (
      this.active
      || this.cooldown > 0
      || blocked
      || dog.x < RONDA_BRIDGE.x0 - 4
      || dog.x > RONDA_BRIDGE.x1 + 4
      || dog.z < 118
      || dog.z > 150
    ) {
      return false;
    }
    this.start(dog.x);
    return true;
  }

  start(dogX = -165) {
    this.active = true;
    this.setupWave(1, dogX);
  }

  reset() {
    this.active = false;
    this.phase = 'idle';
    this.t = 0;
    this.cooldown = 0;
    this.wave = 0;
    for (let i = 0; i < this.scooters.length; i++) {
      this.scooters[i].x = SCOOTER_LANES[i];
      this.scooters[i].z = SCOOTER_START_Z;
      this.scooters[i].active = false;
      this.scooters[i].passed = false;
    }
  }

  step(dt: number, dog: { x: number; z: number }): ScooterStepResult {
    const out: ScooterStepResult = {
      startedRush: false,
      nextWave: false,
      hit: null,
      escaped: false,
    };

    if (!this.active) {
      if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
      return out;
    }

    this.t += dt;

    if (
      dog.z <= SCOOTER_SAFE_SOUTH_Z
      || dog.z >= SCOOTER_SAFE_NORTH_Z
      || dog.x <= SCOOTER_SAFE_WEST_X
      || dog.x >= SCOOTER_SAFE_EAST_X
    ) {
      this.active = false;
      this.phase = 'idle';
      this.cooldown = SCOOTER_COOLDOWN;
      this.survivedOnce = true;
      out.escaped = true;
      return out;
    }

    if (this.phase === 'warning') {
      if (this.t >= this.warnDur) {
        this.phase = 'charging';
        this.t = 0;
        out.startedRush = true;
      }
      return out;
    }

    for (const s of this.scooters) {
      if (s.passed) continue;
      if (!s.active && this.t >= s.delay) {
        s.active = true;
      }
      if (!s.active) continue;
      s.z += s.speed * dt;
      if (Math.hypot(dog.x - s.x, dog.z - s.z) <= SCOOTER_HIT_R) {
        const hitPos = { x: s.x, z: s.z };
        this.active = false;
        this.phase = 'idle';
        this.cooldown = SCOOTER_COOLDOWN;
        out.hit = hitPos;
        return out;
      }
      if (s.z >= SCOOTER_END_Z) {
        s.passed = true;
        s.active = false;
      }
    }

    if (this.scooters.every((s) => s.passed)) {
      if (this.wave < this.maxWaves) {
        this.setupWave(this.wave + 1, dog.x);
        out.nextWave = true;
      } else {
        this.active = false;
        this.phase = 'idle';
        this.cooldown = SCOOTER_COOLDOWN;
        this.survivedOnce = true;
        out.escaped = true;
      }
    }

    return out;
  }
}
