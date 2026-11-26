/*
  Pure state machine for Chase #1: Harbor Boat Wake Surge along Marina pontoons.
  Kept free of Three.js imports so node --test can test trigger, hit, and escape math.
*/
import { PONTOON_A, PONTOON_B, onPontoon } from './marinaGeom.ts';

export type WakeStepResult = 'idle' | 'active' | 'escaped' | 'hit';

/** Tracks the roaring boat wake surging across Pontoon A or B toward the stone quay. */
export class WakeChaseState {
  active = false;
  pontoon: 'A' | 'B' | null = null;
  waveZ = -62;
  speed = 4.2;
  boatX = -104;
  cooldown = 0;

  reset() {
    this.active = false;
    this.pontoon = null;
    this.waveZ = -62;
    this.speed = 4.2;
    this.cooldown = 0;
  }

  /** Returns which pontoon should launch a wake surge, or null if not eligible. */
  canTrigger(dogX: number, dogZ: number, busy: boolean, offLeash: boolean): 'A' | 'B' | null {
    if (this.active || this.cooldown > 0 || busy || offLeash) return null;
    const p = onPontoon(dogX, dogZ);
    if (!p || dogZ > -30) return null;
    return p;
  }

  start(pontoon: 'A' | 'B') {
    this.active = true;
    this.pontoon = pontoon;
    this.waveZ = -62;
    this.speed = 4.2;
    this.boatX = pontoon === 'A' ? -104 : -130;
  }

  /** Advance wave surge and return resolution status. */
  step(dt: number, dog: { x: number; z: number }, human: { x: number; z: number }): WakeStepResult {
    if (!this.active) {
      if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
      return 'idle';
    }
    this.boatX -= 22 * dt;
    this.speed = Math.min(6.8, this.speed + dt * 0.55);
    this.waveZ += this.speed * dt;

    // Both characters cleared up the gangway onto the solid quay.
    const bothOnQuay = dog.z >= -18.2 && human.z >= -19.2;
    if (bothOnQuay) {
      this.active = false;
      this.cooldown = 18;
      return 'escaped';
    }

    const activeBounds = this.pontoon === 'B' ? PONTOON_B : PONTOON_A;
    const onActiveStrip = (p: { x: number; z: number }) =>
      p.x >= activeBounds.x0 - 0.5 && p.x <= activeBounds.x1 + 0.5 && p.z < -18.4;

    const hitChar = [dog, human].some(
      (p) => onActiveStrip(p) && this.waveZ >= p.z - 0.85 && this.waveZ <= p.z + 2.2,
    );
    if (hitChar) {
      this.active = false;
      this.cooldown = 14;
      return 'hit';
    }

    if (this.waveZ >= -17.6) {
      this.active = false;
      this.cooldown = 18;
      return 'escaped';
    }
    return 'active';
  }
}
