/*
  Pure state machine for the marching Rambla Tabalers percussion drum squad.
  Kept free of Three.js imports so node --test can check patrol, beats, and calming.
*/

export const TABALERS_Z = 26.5;
export const TABALERS_X0 = -56;
export const TABALERS_X1 = 26;
export const TABALERS_BEAT_DUR = 1.1;
export const TABALERS_RADIUS = 5.0;

/** Patrols along the Rambla, pulsing downbeat shockwaves unless braved with a bark. */
export class TabalersState {
  x = -18;
  z = TABALERS_Z;
  dir: 1 | -1 = 1;
  speed = 1.9;
  beatT = 0;
  calmedT = 0;
  spookCooldown = 0;
  bravedOnce = false;

  get beatPhase(): number {
    return (this.beatT % TABALERS_BEAT_DUR) / TABALERS_BEAT_DUR;
  }

  reset() {
    this.x = -18;
    this.z = TABALERS_Z;
    this.dir = 1;
    this.beatT = 0;
    this.calmedT = 0;
    this.spookCooldown = 0;
  }

  /** Barking alongside the squad wins them over so their downbeats stop spooking Millie. */
  tryBarkBrave(dogX: number, dogZ: number): 'calmed' | 'none' {
    if (this.calmedT > 0) return 'none';
    if (Math.hypot(dogX - this.x, dogZ - this.z) > 6.8) return 'none';
    this.calmedT = 12;
    this.bravedOnce = true;
    return 'calmed';
  }

  /** Advance march & beat clock; returns whether a downbeat landed and whether it spooked Millie. */
  step(dt: number, dog: { x: number; z: number }, busy: boolean): { beatHit: boolean; spooked: boolean } {
    this.x += this.dir * this.speed * dt;
    if (this.x >= TABALERS_X1) { this.x = TABALERS_X1; this.dir = -1; }
    if (this.x <= TABALERS_X0) { this.x = TABALERS_X0; this.dir = 1; }

    if (this.calmedT > 0) this.calmedT = Math.max(0, this.calmedT - dt);
    if (this.spookCooldown > 0) this.spookCooldown = Math.max(0, this.spookCooldown - dt);

    let beatHit = false;
    let spooked = false;
    this.beatT += dt;
    if (this.beatT >= TABALERS_BEAT_DUR) {
      this.beatT -= TABALERS_BEAT_DUR;
      beatHit = true;
      const near = Math.hypot(dog.x - this.x, dog.z - this.z) <= TABALERS_RADIUS;
      if (this.calmedT <= 0 && this.spookCooldown <= 0 && !busy && near) {
        this.spookCooldown = 2.6;
        spooked = true;
      }
    }
    return { beatHit, spooked };
  }
}
