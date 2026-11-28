/*
  Pure runtime state machines for Phase 7 (Canal i Galeria / Gorg):
  - TramState: gliding Mediterranean tram stopping at Parada Canal and yielding for Millie
  - CartRushState: Runaway shopping carts along the Galeria del Canal esplanade
  Kept free of Three.js imports so node --test can drive both directly.
*/
import { GORG_TRAM } from './gorgGeom.ts';

export interface TramStepEvents {
  arrived: boolean;
  departed: boolean;
  brakedForDog: boolean;
}

/** Articulated Mediterranean tram gliding along the grass-verge avenue (z = 37). */
export class TramState {
  x: number = GORG_TRAM.stopX;
  z: number = GORG_TRAM.z;
  dir: 1 | -1 = 1;
  speed = 0;
  maxSpeed = 6.2;
  dwell = 2.0;
  stoppedAtStop = true;
  bellCd = 0;

  reset() {
    this.x = GORG_TRAM.stopX;
    this.dir = 1;
    this.speed = 0;
    this.dwell = 2.0;
    this.stoppedAtStop = true;
    this.bellCd = 0;
  }

  step(dt: number, dog: { x: number; z: number }): TramStepEvents {
    const ev: TramStepEvents = { arrived: false, departed: false, brakedForDog: false };
    if (this.bellCd > 0) this.bellCd = Math.max(0, this.bellCd - dt);

    const onTrack = Math.abs(dog.z - this.z) < 2.2;
    const ahead = (dog.x - this.x) * this.dir;
    const dogBlocking = onTrack && ahead > -1.5 && ahead < 11.0;

    if (this.dwell > 0) {
      this.dwell -= dt;
      this.speed = 0;
      if (this.dwell <= 0) {
        this.dwell = 0;
        ev.departed = true;
      }
      return ev;
    }

    if (dogBlocking) {
      this.speed = Math.max(0, this.speed - 14 * dt);
      if (this.bellCd <= 0) {
        this.bellCd = 3.2;
        ev.brakedForDog = true;
      }
    } else {
      const distToStop = (GORG_TRAM.stopX - this.x) * this.dir;
      if (!this.stoppedAtStop && distToStop >= -0.4 && distToStop < 16) {
        if (distToStop <= 0.35) {
          this.x = GORG_TRAM.stopX;
          this.speed = 0;
          this.dwell = 4.0;
          this.stoppedAtStop = true;
          ev.arrived = true;
          return ev;
        }
        const want = Math.max(1.2, Math.sqrt(3.6 * Math.max(0.2, distToStop)));
        this.speed += Math.max(-9 * dt, Math.min(4 * dt, want - this.speed));
      } else {
        this.speed = Math.min(this.maxSpeed, this.speed + 3.2 * dt);
      }
    }

    this.x += this.dir * this.speed * dt;
    if (this.dir > 0 && this.x >= GORG_TRAM.x1) {
      this.x = GORG_TRAM.x1;
      this.dir = -1;
      this.speed = 0;
      this.dwell = 1.4;
      this.stoppedAtStop = false;
    } else if (this.dir < 0 && this.x <= GORG_TRAM.x0) {
      this.x = GORG_TRAM.x0;
      this.dir = 1;
      this.speed = 0;
      this.dwell = 1.4;
      this.stoppedAtStop = false;
    }

    return ev;
  }
}

export const CART_LANES = [-185.8, -183.0, -180.2] as const;
export const CART_START_Z = 84.5;
export const CART_END_Z = 41.5;
export const CART_SAFE_SOUTH_Z = 42.5;
export const CART_SAFE_EAST_X = -176.8;
export const CART_HIT_R = 1.05;
export const CART_COOLDOWN = 15;
/** Where the minimap marks the cart run. */
export const CARTS_MAP_POS = { x: CART_LANES[1], z: 64 } as const;

export interface CartEntity {
  lane: number;
  x: number;
  z: number;
  speed: number;
  delay: number;
  active: boolean;
  passed: boolean;
}

export interface CartStepResult {
  startedRush: boolean;
  nextWave: boolean;
  hit: { x: number; z: number } | null;
  escaped: boolean;
}

/** Runaway shopping carts sliding south down the Galeria del Canal esplanade. */
export class CartRushState {
  active = false;
  phase: 'idle' | 'warning' | 'charging' = 'idle';
  t = 0;
  warnDur = 1.3;
  cooldown = 0;
  survivedOnce = false;
  wave = 0;
  maxWaves = 2;

  carts: CartEntity[] = CART_LANES.map((x, lane) => ({
    lane,
    x,
    z: CART_START_Z,
    speed: 8.1,
    delay: lane * 0.52,
    active: false,
    passed: false,
  }));

  private setupWave(waveNum: number, dogX: number) {
    this.wave = waveNum;
    this.phase = 'warning';
    this.t = 0;
    this.warnDur = waveNum === 1 ? 1.3 : 0.95;
    const speed = 7.2 + waveNum * 0.9;
    const ranked = [0, 1, 2].sort(
      (a, b) => Math.abs(CART_LANES[a] - dogX) - Math.abs(CART_LANES[b] - dogX),
    );
    const delays = [0, 0, 0];
    ranked.forEach((laneIdx, rank) => {
      delays[laneIdx] = rank * 0.52;
    });
    this.carts = CART_LANES.map((x, lane) => ({
      lane,
      x,
      z: CART_START_Z,
      speed,
      delay: delays[lane],
      active: false,
      passed: false,
    }));
  }

  canTrigger(dog: { x: number; z: number }, blocked: boolean): boolean {
    return (
      !this.active
      && this.cooldown <= 0
      && !blocked
      && dog.x >= -187.5
      && dog.x <= -178.6
      && dog.z >= 48
      && dog.z <= 78
    );
  }

  tryBarkStart(dog: { x: number; z: number }, blocked: boolean): boolean {
    if (
      this.active
      || this.cooldown > 0
      || blocked
      || dog.x < -188
      || dog.x > -177
      || dog.z < 44
      || dog.z > 84
    ) {
      return false;
    }
    this.start(dog.x);
    return true;
  }

  start(dogX = -183) {
    this.active = true;
    this.setupWave(1, dogX);
  }

  reset() {
    this.active = false;
    this.phase = 'idle';
    this.t = 0;
    this.cooldown = 0;
    this.wave = 0;
    for (let i = 0; i < this.carts.length; i++) {
      this.carts[i].x = CART_LANES[i];
      this.carts[i].z = CART_START_Z;
      this.carts[i].active = false;
      this.carts[i].passed = false;
    }
  }

  step(dt: number, dog: { x: number; z: number }): CartStepResult {
    const out: CartStepResult = {
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

    if (dog.z <= CART_SAFE_SOUTH_Z || dog.x >= CART_SAFE_EAST_X || dog.z >= 86.5) {
      this.active = false;
      this.phase = 'idle';
      this.cooldown = CART_COOLDOWN;
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

    for (const c of this.carts) {
      if (c.passed) continue;
      if (!c.active && this.t >= c.delay) {
        c.active = true;
      }
      if (!c.active) continue;
      c.z -= c.speed * dt;
      if (Math.hypot(dog.x - c.x, dog.z - c.z) <= CART_HIT_R) {
        const hitPos = { x: c.x, z: c.z };
        this.active = false;
        this.phase = 'idle';
        this.cooldown = CART_COOLDOWN;
        out.hit = hitPos;
        return out;
      }
      if (c.z <= CART_END_Z) {
        c.passed = true;
        c.active = false;
      }
    }

    if (this.carts.every((c) => c.passed)) {
      if (this.wave < this.maxWaves) {
        this.setupWave(this.wave + 1, dog.x);
        out.nextWave = true;
      } else {
        this.active = false;
        this.phase = 'idle';
        this.cooldown = CART_COOLDOWN;
        this.survivedOnce = true;
        out.escaped = true;
      }
    }

    return out;
  }
}
