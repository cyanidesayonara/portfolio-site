import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inRing, inLane, inSector, FeelState } from '../src/scripts/walk/telegraph.ts';

describe('Telegraph geometry and combat feel helpers', () => {
  it('inRing tests circular bounds inclusively', () => {
    assert.equal(inRing(0, 0, 0, 0, 2), true);
    assert.equal(inRing(3, 4, 0, 0, 5), true);
    assert.equal(inRing(3.1, 4, 0, 0, 5), false);
    assert.equal(inRing(-2, 5, -1, 5, 1.1), true);
  });

  it('inLane handles axis-aligned and diagonal rectangular lanes', () => {
    // Axis-aligned lane from (0, 0) -> (10, 0), halfW = 1.5
    assert.equal(inLane(5, 1.2, 0, 0, 10, 0, 1.5), true);
    assert.equal(inLane(5, 1.6, 0, 0, 10, 0, 1.5), false);
    assert.equal(inLane(-0.2, 0, 0, 0, 10, 0, 1.5), false);
    assert.equal(inLane(10.2, 0, 0, 0, 10, 0, 1.5), false);

    // Diagonal lane along (1, 1) direction
    assert.equal(inLane(3, 3, 0, 0, 6, 6, 1), true);
    assert.equal(inLane(3, 5, 0, 0, 6, 6, 1), false);
    assert.equal(inLane(3, 4, 0, 0, 6, 6, 1), true); // perp = sqrt(2)/2 ~= 0.707 <= 1
  });

  it('inSector checks radius and angular wedge across +-PI wrap', () => {
    // Facing +X (angle 0), halfAngle PI/4, radius 5
    assert.equal(inSector(3, 1, 0, 0, 0, Math.PI / 4, 5), true);
    assert.equal(inSector(1, 3, 0, 0, 0, Math.PI / 4, 5), false);
    assert.equal(inSector(6, 0, 0, 0, 0, Math.PI / 4, 5), false);

    // Facing -X (angle PI), wrapping cleanly across +PI / -PI
    assert.equal(inSector(-3, 0.5, 0, 0, Math.PI, 0.4, 5), true);
    assert.equal(inSector(-3, -0.5, 0, 0, Math.PI, 0.4, 5), true);
    assert.equal(inSector(3, 0, 0, 0, Math.PI, 0.4, 5), false);
  });

  it('FeelState slows simScale during hitstop and decays trauma shake to zero', () => {
    const feel = new FeelState();
    feel.hitstop(0.1);
    feel.kick(0.6);

    const s1 = feel.step(0.05);
    assert.equal(s1.simScale, 0.18);
    assert.ok(Math.hypot(s1.shakeX, s1.shakeY) > 0);

    const s2 = feel.step(0.06);
    assert.equal(s2.simScale, 0.18);

    const s3 = feel.step(0.05);
    assert.equal(s3.simScale, 1);

    for (let i = 0; i < 40; i++) feel.step(0.05);
    const settled = feel.step(0.05);
    assert.equal(settled.shakeX, 0);
    assert.equal(settled.shakeY, 0);
  });
});
