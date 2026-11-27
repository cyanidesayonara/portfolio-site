import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GORG_CANAL,
  GORG_GROUND_Y,
  GORG_WATER_Y,
  gorgFloor,
  gorgSurface,
  inGorgCourt,
  inGorgPipica,
  onGorgBridge,
} from '../src/scripts/walk/gorgGeom.ts';
import { TramState, CartRushState, CART_LANES } from '../src/scripts/walk/gorgLogic.ts';

const distToBounds = (b: { x0: number; x1: number; z0: number; z1: number }, x: number, z: number) =>
  Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));

describe('Gorg (Canal i Galeria) geometry and streaming bounds', () => {
  it('computes floor heights and surfaces across canal, twin bridges, court, and pipica 5', () => {
    assert.equal(onGorgBridge(-170, 24), 'S');
    assert.equal(onGorgBridge(-170, 66), 'N');
    assert.equal(onGorgBridge(-170, 44), null);

    assert.equal(gorgFloor(-170, 24), GORG_GROUND_Y);
    assert.equal(gorgSurface(-170, 24), 'deck');
    assert.equal(gorgFloor(-170, 66), GORG_GROUND_Y);
    assert.equal(gorgSurface(-170, 66), 'deck');

    // Deep canal water between the two bridges
    assert.ok(gorgFloor(-170, 44) < GORG_WATER_Y);
    assert.equal(gorgSurface(-170, 44), 'water');

    // Fifth pipicà & streetball court
    assert.equal(inGorgPipica(-149, 26), true);
    assert.equal(inGorgPipica(-140, 26), false);
    assert.equal(gorgSurface(-149, 26), 'sand');

    assert.equal(inGorgCourt(-135, 64), true);
    assert.equal(inGorgCourt(-150, 64), false);
    assert.equal(gorgSurface(-183, 64), 'paving');
    assert.ok(GORG_CANAL.z1 > GORG_CANAL.bridgeN.z1);
  });

  it('keeps gorg beyond warm distance at spawn and unloads eastern hill from west gorg', () => {
    const raw = JSON.parse(
      readFileSync(new URL('../src/scripts/walk/data/seafront.json', import.meta.url), 'utf8'),
    ) as { districts: { id: string; bounds: { x0: number; x1: number; z0: number; z1: number } }[] };
    const gorg = raw.districts.find((d) => d.id === 'gorg');
    const hill = raw.districts.find((d) => d.id === 'hill');
    assert.ok(gorg && hill);

    assert.ok(distToBounds(gorg.bounds, -22, -3.4) > 80);
    assert.ok(distToBounds(hill.bounds, -200, 64) > 170);
  });
});

describe('Gorg TramState & CartRushState', () => {
  it('tram departs Parada Canal, glides east-west, and brakes smoothly for Millie on tracks', () => {
    const t = new TramState();
    let departed = false;
    for (let i = 0; i < 60; i++) {
      const ev = t.step(0.1, { x: 0, z: 0 });
      if (ev.departed) departed = true;
    }
    assert.equal(departed, true);
    assert.ok(t.x > -148);

    // Put Millie right ahead of the eastbound tram on the track
    const aheadX = t.x + 4;
    const braked = t.step(0.1, { x: aheadX, z: t.z });
    assert.equal(braked.brakedForDog, true);
  });

  it('cart rush triggers on Galeria esplanade, hits stationary targets, and escapes when sidestepped or fleeing south', () => {
    const c = new CartRushState();
    const dog = { x: -183.0, z: 62.0 };
    assert.equal(c.canTrigger(dog, false), true);
    c.start(dog.x);
    assert.equal(c.active, true);
    assert.equal(c.phase, 'warning');

    let hitEv: { x: number; z: number } | null = null;
    for (let i = 0; i < 120 && !hitEv; i++) {
      hitEv = c.step(0.05, dog).hit;
    }
    assert.ok(hitEv !== null);
    assert.equal(Math.abs(hitEv.x - CART_LANES[1]) < 0.01, true);
    assert.equal(c.active, false);

    // Clear cooldown, restart via bark, and sidestep east into safety
    while (c.cooldown > 0) c.step(1.0, { x: 0, z: 0 });
    assert.equal(c.tryBarkStart({ x: -183, z: 62 }, false), true);
    const escaped = c.step(0.05, { x: -176.2, z: 62.0 });
    assert.equal(escaped.escaped, true);
    assert.equal(c.survivedOnce, true);
  });
});
