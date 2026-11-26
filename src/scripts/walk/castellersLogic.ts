/*
  Pure state machine for interactive Plaça Castellers human tower (Plaça del Mercat).
  Kept free of Three.js imports so node --test can drive wobble and collapse directly.
*/

export const CASTELLERS_POS = { x: 0, z: 127 };
export const CASTELLERS_TIERS = 5;

/** Tracks sway physics, instability buildup, topple collapse, and rebuild timer. */
export class CastellersState {
  state: 'standing' | 'wobbling' | 'toppled' | 'rebuilding' = 'standing';
  instability = 0;
  swayAngle = 0;
  swayVel = 0;
  leanX = 1;
  leanZ = 0;
  timer = 0;
  toppledOnce = false;

  reset() {
    this.state = 'standing';
    this.instability = 0;
    this.swayAngle = 0;
    this.swayVel = 0;
    this.leanX = 1;
    this.leanZ = 0;
    this.timer = 0;
  }

  /** Apply a barge or bark shockwave to the base pinya ring. */
  nudge(fromX: number, fromZ: number, power = 0.36): 'wobble' | 'toppled' | 'ignored' {
    if (this.state === 'toppled' || this.state === 'rebuilding') return 'ignored';
    const dx = CASTELLERS_POS.x - fromX;
    const dz = CASTELLERS_POS.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    this.leanX = dx / d;
    this.leanZ = dz / d;
    this.instability = Math.min(1.2, this.instability + power);
    this.swayVel += (this.swayAngle >= 0 ? 1 : -1) * (1.7 + power * 2.2);
    if (this.instability >= 1) {
      this.state = 'toppled';
      this.timer = 0;
      this.toppledOnce = true;
      return 'toppled';
    }
    this.state = 'wobbling';
    return 'wobble';
  }

  /** Advance tower spring wobble or topple/rebuild timers. */
  step(dt: number) {
    if (this.state === 'toppled') {
      this.timer += dt;
      if (this.timer >= 6.5) {
        this.state = 'rebuilding';
        this.timer = 0;
      }
      return;
    }
    if (this.state === 'rebuilding') {
      this.timer += dt;
      if (this.timer >= 2.0) {
        this.state = 'standing';
        this.instability = 0;
        this.swayAngle = 0;
        this.swayVel = 0;
        this.timer = 0;
      }
      return;
    }

    const acc = -26 * this.swayAngle - 4.2 * this.swayVel;
    this.swayVel += acc * dt;
    this.swayAngle += this.swayVel * dt;
    this.instability = Math.max(0, this.instability - dt * 0.14);
    if (this.state === 'wobbling' && this.instability < 0.05 && Math.abs(this.swayAngle) < 0.015) {
      this.state = 'standing';
      this.instability = 0;
      this.swayAngle = 0;
      this.swayVel = 0;
    }
  }
}
