import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RONDA_BRIDGE,
  RONDA_GROUND_Y,
  RONDA_TRENCH,
  RONDA_TRENCH_Y,
  RONDA_TRAFFIC,
  inRondaPark,
  inRondaPipica,
  inRondaSkate,
  inRondaTrenchOpen,
  onRondaBridge,
  rondaFloor,
  rondaSurface,
} from '../src/scripts/walk/rondaGeom.ts';
import { TrafficState, ScooterRushState, SCOOTER_LANES } from '../src/scripts/walk/rondaLogic.ts';

const distToBounds = (b: { x0: number; x1: number; z0: number; z1: number }, x: number, z: number) =>
  Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));

describe('Ronda / Parc geometry and streaming bounds', () => {
  it('computes floor heights and surfaces across trench, overpass, skate pad, and pipica 6', () => {
    assert.equal(onRondaBridge(-165, 140), true);
    assert.equal(onRondaBridge(-200, 140), false);
    assert.equal(rondaFloor(-165, 140), RONDA_GROUND_Y);
    assert.equal(rondaSurface(-165, 140), 'deck');

    // Open trench west of the bridge deck
    assert.equal(inRondaTrenchOpen(-200, 140), true);
    assert.equal(rondaFloor(-200, 140), RONDA_TRENCH_Y);
    assert.equal(rondaSurface(-200, 140), 'paving');

    // Sixth pipicà & skate pad north of the trench
    assert.equal(inRondaPipica(-193, 175), true);
    assert.equal(inRondaPipica(-180, 175), false);
    assert.equal(rondaSurface(-193, 175), 'sand');

    assert.equal(inRondaSkate(-158, 166), true);
    assert.equal(rondaSurface(-158, 166), 'paving');

    assert.equal(inRondaPark(-180, 170), true);
    assert.equal(rondaSurface(-180, 170), 'paving');

    assert.ok(RONDA_TRENCH.z1 > RONDA_BRIDGE.z0);
    assert.ok(RONDA_BRIDGE.x1 > RONDA_BRIDGE.x0);
  });

  it('keeps ronda beyond warm distance at spawn and the hill past live distance from west ronda', () => {
    const raw = JSON.parse(
      readFileSync(new URL('../src/scripts/walk/data/seafront.json', import.meta.url), 'utf8'),
    ) as { districts: { id: string; bounds: { x0: number; x1: number; z0: number; z1: number } }[] };
    const ronda = raw.districts.find((d) => d.id === 'ronda');
    const hill = raw.districts.find((d) => d.id === 'hill');
    assert.ok(ronda && hill);

    assert.ok(distToBounds(ronda.bounds, -22, -3.4) > 80);
    // Far corner of Ronda: since the hill moved toward -x (re-orientation step 2) it stays a
    // stand-in there (Streamer.far = 100) rather than unloading, until Ronda moves to +x in step 4.
    assert.ok(distToBounds(hill.bounds, -220, 120) > 100);
  });
});

describe('Ronda TrafficState & ScooterRushState', () => {
  it('traffic vehicles loop through the trench and wrap at the corridor ends', () => {
    const t = new TrafficState();
    assert.ok(t.vehicles.length >= 4);
    const first = t.vehicles[0];
    const startX = first.x;
    let wrapped = false;
    for (let i = 0; i < 400; i++) {
      const ev = t.step(0.1);
      if (ev.passed > 0) wrapped = true;
    }
    assert.equal(wrapped, true);
    assert.ok(first.x !== startX || first.x === RONDA_TRAFFIC.x0 || first.x === RONDA_TRAFFIC.x1);
    assert.ok(first.x >= RONDA_TRAFFIC.x0 - 0.01);
    assert.ok(first.x <= RONDA_TRAFFIC.x1 + 0.01);
  });

  it('scooter rush triggers on the south approach, hits stationary targets, and escapes when sidestepped', () => {
    const c = new ScooterRushState();
    const dog = { x: -165.0, z: 128.0 };
    assert.equal(c.canTrigger(dog, false), true);
    c.start(dog.x);
    assert.equal(c.active, true);
    assert.equal(c.phase, 'warning');

    let hitEv: { x: number; z: number } | null = null;
    for (let i = 0; i < 160 && !hitEv; i++) {
      hitEv = c.step(0.05, dog).hit;
    }
    assert.ok(hitEv !== null);
    assert.equal(Math.abs(hitEv.x - SCOOTER_LANES[1]) < 0.01, true);
    assert.equal(c.active, false);

    while (c.cooldown > 0) c.step(1.0, { x: 0, z: 0 });
    assert.equal(c.tryBarkStart({ x: -165, z: 128 }, false), true);
    const escaped = c.step(0.05, { x: -185.0, z: 128.0 });
    assert.equal(escaped.escaped, true);
    assert.equal(c.survivedOnce, true);
  });
});
