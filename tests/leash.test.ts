import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Leash,
  applyTug,
  capStretch,
  WhirlDetector,
  type Body,
  type Obstacle,
} from '../src/scripts/walk/leash.ts';

const DT = 1 / 60;

function settle(
  leash: Leash,
  dog: { x: number; z: number },
  hand: { x: number; z: number },
  obstacles: Obstacle[],
  frames: number,
) {
  for (let i = 0; i < frames; i++) {
    leash.step(dog, hand, obstacles, DT);
  }
}

function orbit(
  leash: Leash,
  cx: number,
  cz: number,
  fromR: number,
  toR: number,
  degs: number,
  hand: { x: number; z: number },
  obstacles: Obstacle[],
) {
  const steps = Math.max(1, Math.round(Math.abs(degs)));
  const dog = { x: cx + fromR, z: cz };
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const r = fromR + (toR - fromR) * t;
    const a = ((degs * t) * Math.PI) / 180;
    dog.x = cx + Math.cos(a) * r;
    dog.z = cz + Math.sin(a) * r;
    leash.step(dog, hand, obstacles, DT);
  }
  return dog;
}

describe('Leash rope physics (meter scale, ported from Godot suite)', () => {
  it('tracks stretched chord length and aims dog end tangent back along rope', () => {
    const pole: Obstacle = { x: 0, z: 0, r: 0.14, kind: 'pole' };
    const dog = { x: 0.9, z: 0 };
    const hand = { x: -2.9, z: 0 };
    const leash = new Leash(dog, hand);
    leash.rest = 3.82; // 260 px at 68 px/m

    dog.x = 1.5;
    dog.z = 0.25;
    settle(leash, dog, hand, [pole], 120);

    const chord = Math.hypot(dog.x - hand.x, dog.z - hand.z);
    assert.ok(
      Math.abs(leash.length - chord) < 0.25,
      `used length (${leash.length.toFixed(2)}) should track ~${chord.toFixed(2)} m chord`,
    );
    const { dog: dogDir } = leash.ends();
    // Pointing from dog back toward human (~-x)
    assert.ok(dogDir.x < -0.9, `expected dog end tangent back toward human, got x=${dogDir.x}`);
    assert.ok(leash.taut > 0.9, `expected stretched rope to register taut (got ${leash.taut})`);
  });

  it('ramps taut continuously across the onset band and scales applyTug force', () => {
    const dogPos = { x: 0, z: 0 };
    const handPos = { x: 5, z: 0 };
    const leash = new Leash(dogPos, handPos);
    leash.rest = 5;

    const samples: number[] = [];
    for (let i = 0; i <= 10; i++) {
      handPos.x = 5 * (1 + i * 0.005);
      leash.reset(dogPos, handPos);
      samples.push(leash.taut);
    }

    assert.ok(samples[0] <= 0.001, `taut at rest should be 0 (got ${samples[0]})`);
    assert.ok(samples[samples.length - 1] >= 0.99, `taut past onset should reach 1 (got ${samples[samples.length - 1]})`);
    for (let i = 1; i < samples.length; i++) {
      assert.ok(samples[i] + 1e-6 >= samples[i - 1], `taut should be monotonic at step ${i}`);
      assert.ok(samples[i] >= 0 && samples[i] <= 1, `taut must remain normalized [0, 1]`);
    }
    assert.ok(samples[5] > 0.1 && samples[5] < 0.9, `midpoint onset expected between 0.1 and 0.9 (got ${samples[5]})`);

    // Zero force at rest; positive tension once stretched
    const dogBody: Body = { x: 0, z: 0, vx: 0, vz: 0 };
    const humanBody: Body = { x: 5, z: 0, vx: 0, vz: 0 };
    leash.reset(dogBody, humanBody);
    const tRest = applyTug(leash, dogBody, humanBody, {
      dogMass: 2, humanMass: 4, dogPulling: true, planted: false, dt: DT, poles: [],
    });
    assert.equal(tRest, 0);

    humanBody.x = 5.4;
    leash.reset(dogBody, humanBody);
    const tPull = applyTug(leash, dogBody, humanBody, {
      dogMass: 2, humanMass: 4, dogPulling: true, planted: false, dt: DT, poles: [],
    });
    assert.ok(tPull > 0 && humanBody.vx < 0 && dogBody.vx > 0, 'tension should pull human and dog together');
  });

  it('winds around a pole when orbiting, cinches when pulled taut, and slips off under hard pull-away', () => {
    const pole: Obstacle = { x: 0, z: 0, r: 0.17, kind: 'pole' };
    const hand = { x: -1.2, z: 0 };
    const dog = { x: 1.8, z: 0 };
    const leash = new Leash(dog, hand);
    leash.rest = 3.82;

    settle(leash, dog, hand, [pole], 60);
    const endDog = orbit(leash, 0, 0, 1.8, 0.45, 720, hand, [pole]);
    settle(leash, endDog, hand, [pole], 30);
    assert.ok(
      Math.abs(leash.winding) > 1.0,
      `spiral wrap should build > 1.0 turn (got ${leash.winding.toFixed(2)})`,
    );

    // Pull outward to cinch the coil onto the pole
    endDog.x = 0;
    endDog.z = 1.35;
    settle(leash, endDog, hand, [pole], 90);
    assert.ok(leash.contacts >= 1, `taut coil should contact the pole (got ${leash.contacts})`);
    assert.ok(
      Math.abs(leash.staticWinding) > 0.4,
      `taut pole wrap should produce staticWinding for pulley boost (got ${leash.staticWinding.toFixed(2)})`,
    );

    const straightDx = endDog.x - hand.x;
    const straightDz = endDog.z - hand.z;
    const straightLen = Math.hypot(straightDx, straightDz) || 1;
    const { human: humanDir } = leash.ends();
    const dot = (humanDir.x * straightDx + humanDir.z * straightDz) / straightLen;
    assert.ok(dot < 0.92, `wound human pull should curve around pole rather than aim straight at dog (dot=${dot.toFixed(2)})`);

    // Pull far to the same side as the human so sustained tension slips the coil off
    endDog.x = -6.3;
    endDog.z = 4.7;
    settle(leash, endDog, hand, [pole], 900);
    const chord = Math.hypot(endDog.x - hand.x, endDog.z - hand.z);
    assert.ok(
      leash.length < chord * 1.2,
      `sustained pull should slip coil off pole (length=${leash.length.toFixed(2)}, chord=${chord.toFixed(2)})`,
    );
    assert.ok(Math.abs(leash.winding) < 0.5, `pulled-free rope should unwind (winding=${leash.winding.toFixed(2)})`);

    for (const p of leash.pts) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), 'all rope vertices stay finite');
    }
  });

  it('triggers WhirlDetector only after sustained wrap tension and preserves CW/CCW coil sign + cooldown', () => {
    const pole: Obstacle = { x: 0, z: 0, r: 0.17, kind: 'pole' };

    for (const dir of [1, -1] as const) {
      const detector = new WhirlDetector();
      const hand = { x: -0.75, z: 0 };
      const dog = { x: 1.6, z: 0 };
      const leash = new Leash(dog, hand);
      leash.rest = 2.6;

      settle(leash, dog, hand, [pole], 30);
      const endDog = orbit(leash, 0, 0, 1.6, 0.5, dir * 720, hand, [pole]);
      // Pull taut outward so excess > 0.12 m and pole stays within 1.03 m of human
      endDog.x = 2.2;
      endDog.z = dir * 0.4;
      settle(leash, endDog, hand, [pole], 20);

      let triggered: { pole: Obstacle; coil: number } | null = null;
      for (let i = 0; i < 40; i++) {
        leash.step(endDog, hand, [pole], DT);
        triggered = detector.update(leash, hand, DT);
        if (triggered) break;
      }
      assert.ok(triggered !== null, `expected WhirlDetector to fire for dir=${dir}`);
      assert.equal(triggered!.pole, pole);
      // game3d.ts unwinds with dir = -Math.sign(coil), so coil sign is opposite dog orbit dir
      assert.equal(Math.sign(triggered!.coil), -dir, `coil sign should oppose orbit direction dir=${dir}`);

      // Immediate second update within 0.9 s cooldown must not re-fire
      const immediate = detector.update(leash, hand, DT);
      assert.equal(immediate, null, 'WhirlDetector should respect cooldown immediately after firing');
    }
  });

  it('caps stretch at 1.15x rest length and splits displacement by inverse mass', () => {
    const dog = { x: 0, z: 0 };
    const human = { x: 6.2, z: 0 };
    const leash = new Leash(dog, human);
    leash.rest = 5;

    const over = capStretch(leash, dog, human, 2, 4);
    assert.ok(Math.abs(over - 0.45) < 1e-6, `overshoot past 5*1.15=5.75 should be 0.45 (got ${over})`);
    assert.ok(Math.abs(dog.x - 0.3) < 1e-6, 'lighter dog moves 2/3 of overshoot');
    assert.ok(Math.abs((6.2 - human.x) - 0.15) < 1e-6, 'heavier human moves 1/3 of overshoot');
  });
});
