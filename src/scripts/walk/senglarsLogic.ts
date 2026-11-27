/*
  Pure state machine for Chase #2: Senglars (wild boars) charging downhill
  along Dalt de la Vila's lower cobbled climb.
  Kept free of Three.js imports so node --test can drive waves cleanly.
*/

export const SENGLARS_LANES = [-2.2, 0, 2.2] as const;
export const SENGLARS_START_Z = 197.2;
export const SENGLARS_END_Z = 172.5;
export const SENGLARS_SAFE_LOW_Z = 176.0;
export const SENGLARS_SAFE_HIGH_Z = 198.2;
export const SENGLARS_SAFE_EAST_X = 11.2;
export const SENGLARS_COOLDOWN = 14;
export const SENGLARS_HIT_R = 1.05;

export interface BoarEntity {
  lane: number;
  x: number;
  z: number;
  speed: number;
  delay: number;
  active: boolean;
  passed: boolean;
}

export interface SenglarsStepResult {
  startedCharge: boolean;
  nextWave: boolean;
  hit: { x: number; z: number } | null;
  escaped: boolean;
}

/** Stateful downhill wild-boar pack controller (2 staggered 3-boar waves). */
export class SenglarsState {
  active = false;
  phase: 'idle' | 'warning' | 'charging' = 'idle';
  t = 0;
  warnDur = 1.35;
  cooldown = 0;
  survivedOnce = false;
  wave = 0;
  maxWaves = 2;

  boars: BoarEntity[] = SENGLARS_LANES.map((x, lane) => ({
    lane,
    x,
    z: SENGLARS_START_Z,
    speed: 8.3,
    delay: lane * 0.55,
    active: false,
    passed: false,
  }));

  private setupWave(waveNum: number, dogX: number) {
    this.wave = waveNum;
    this.phase = 'warning';
    this.t = 0;
    this.warnDur = waveNum === 1 ? 1.35 : 1.0;
    const speed = 7.4 + waveNum * 0.9;
    // Order lanes so the boar aligned closest to Millie charges first.
    const ranked = [0, 1, 2].sort(
      (a, b) => Math.abs(SENGLARS_LANES[a] - dogX) - Math.abs(SENGLARS_LANES[b] - dogX),
    );
    const delays = [0, 0, 0];
    ranked.forEach((laneIdx, rank) => {
      delays[laneIdx] = rank * 0.55;
    });
    this.boars = SENGLARS_LANES.map((x, lane) => ({
      lane,
      x,
      z: SENGLARS_START_Z,
      speed,
      delay: delays[lane],
      active: false,
      passed: false,
    }));
  }

  canTrigger(dog: { x: number; y: number; z: number }, blocked: boolean): boolean {
    return (
      !this.active
      && this.cooldown <= 0
      && !blocked
      && dog.x >= -4.2
      && dog.x <= 4.2
      && dog.z >= 180.5
      && dog.z <= 194.5
      && dog.y >= 0.4
      && dog.y <= 5.6
    );
  }

  tryBarkStart(dog: { x: number; y: number; z: number }, blocked: boolean): boolean {
    if (
      this.active
      || this.cooldown > 0
      || blocked
      || dog.x < -6
      || dog.x > 6
      || dog.z < 176.5
      || dog.z > 196.5
    ) {
      return false;
    }
    this.start(dog.x);
    return true;
  }

  start(dogX = 0) {
    this.active = true;
    this.setupWave(1, dogX);
  }

  reset() {
    this.active = false;
    this.phase = 'idle';
    this.t = 0;
    this.cooldown = 0;
    this.wave = 0;
    for (let i = 0; i < this.boars.length; i++) {
      this.boars[i].x = SENGLARS_LANES[i];
      this.boars[i].z = SENGLARS_START_Z;
      this.boars[i].active = false;
      this.boars[i].passed = false;
    }
  }

  step(dt: number, dog: { x: number; y: number; z: number }): SenglarsStepResult {
    const out: SenglarsStepResult = {
      startedCharge: false,
      nextWave: false,
      hit: null,
      escaped: false,
    };

    if (!this.active) {
      if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
      return out;
    }

    this.t += dt;

    // Reaching bottom terrace, mid-terrace top, or east stairs escapes cleanly.
    if (
      dog.z <= SENGLARS_SAFE_LOW_Z
      || dog.z >= SENGLARS_SAFE_HIGH_Z
      || dog.x >= SENGLARS_SAFE_EAST_X
      || dog.x <= -7.5
    ) {
      this.active = false;
      this.phase = 'idle';
      this.cooldown = SENGLARS_COOLDOWN;
      this.survivedOnce = true;
      out.escaped = true;
      return out;
    }

    if (this.phase === 'warning') {
      if (this.t >= this.warnDur) {
        this.phase = 'charging';
        this.t = 0;
        out.startedCharge = true;
      }
      return out;
    }

    for (const b of this.boars) {
      if (b.passed) continue;
      if (!b.active && this.t >= b.delay) {
        b.active = true;
      }
      if (!b.active) continue;
      b.z -= b.speed * dt;
      if (Math.hypot(dog.x - b.x, dog.z - b.z) <= SENGLARS_HIT_R) {
        const hitPos = { x: b.x, z: b.z };
        this.active = false;
        this.phase = 'idle';
        this.cooldown = SENGLARS_COOLDOWN;
        out.hit = hitPos;
        return out;
      }
      if (b.z <= SENGLARS_END_Z) {
        b.passed = true;
        b.active = false;
      }
    }

    if (this.boars.every((b) => b.passed)) {
      if (this.wave < this.maxWaves) {
        this.setupWave(this.wave + 1, dog.x);
        out.nextWave = true;
      } else {
        this.active = false;
        this.phase = 'idle';
        this.cooldown = SENGLARS_COOLDOWN;
        this.survivedOnce = true;
        out.escaped = true;
      }
    }

    return out;
  }
}
