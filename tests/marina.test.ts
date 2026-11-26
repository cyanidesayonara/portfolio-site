import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BREAKWATER_Y,
  MARINA_GROUND_Y,
  MARINA_WATER_Y,
  PONTOON_Y,
  inMarinaPipica,
  marinaFloor,
  marinaSurface,
  onBreakwater,
  onPontoon,
} from '../src/scripts/walk/marinaGeom.ts';

const distToBounds = (b: { x0: number; x1: number; z0: number; z1: number }, x: number, z: number) =>
  Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));

describe('Marina & Breakwater geometry and streaming bounds', () => {
  it('computes floor heights across quays, sloped pontoons, breakwater ramp, and canal bridge', () => {
    assert.equal(marinaFloor(-130, -10), MARINA_GROUND_Y);
    assert.equal(marinaFloor(-196, -15), MARINA_GROUND_Y);
    assert.equal(marinaFloor(-169, -6), MARINA_GROUND_Y); // canal footbridge
    assert.ok(marinaFloor(-169, -15) < MARINA_WATER_Y); // canal inlet off the bridge

    // Pontoon A gangway ramps smoothly from North Quay down to PONTOON_Y
    assert.equal(onPontoon(-124, -40), 'A');
    assert.equal(onPontoon(-150, -40), 'B');
    const midGangwayY = marinaFloor(-124, -20);
    assert.ok(Math.abs(midGangwayY - (MARINA_GROUND_Y + PONTOON_Y) / 2) < 1e-6);
    assert.equal(marinaFloor(-124, -46), PONTOON_Y);
    assert.equal(marinaFloor(-150, -46), PONTOON_Y);

    // Breakwater ramp connects West Quay to BREAKWATER_Y and stays level to lighthouse
    assert.equal(onBreakwater(-162, -100), true);
    const midBwY = marinaFloor(-210, -28);
    assert.ok(Math.abs(midBwY - (MARINA_GROUND_Y + BREAKWATER_Y) / 2) < 1e-6);
    assert.equal(marinaFloor(-210, -70), BREAKWATER_Y);
    assert.equal(marinaFloor(-162, -100), BREAKWATER_Y);
  });

  it('reports expected surface types and fourth pipicà bounds', () => {
    assert.equal(inMarinaPipica(-151, -9), true);
    assert.equal(inMarinaPipica(-141, -9), false);
    assert.equal(marinaSurface(-151, -9), 'sand');
    assert.equal(marinaSurface(-124, -40), 'deck');
    assert.equal(marinaSurface(-169, -6), 'deck');
    assert.equal(marinaSurface(-196, -12), 'paving');
    assert.equal(marinaSurface(-162, -100), 'paving');
    assert.equal(marinaSurface(-140, -40), 'water');
  });

  it('keeps marina beyond warm distance at spawn and unloads hill when exploring the marina', () => {
    const raw = JSON.parse(
      readFileSync(new URL('../src/scripts/walk/data/seafront.json', import.meta.url), 'utf8'),
    ) as { districts: { id: string; bounds: { x0: number; x1: number; z0: number; z1: number } }[] };
    const marina = raw.districts.find((d) => d.id === 'marina');
    const hill = raw.districts.find((d) => d.id === 'hill');
    assert.ok(marina && hill);

    // Start point on promenade (-22, -3.4) -> marina is > 80 m away (not warmed on load).
    assert.ok(distToBounds(marina.bounds, -22, -3.4) > 80);
    // Inside Marina (-190, -60) -> Dalt de la Vila hill is > 170 m away (unloads via Streamer).
    assert.ok(distToBounds(hill.bounds, -190, -60) > 170);
  });
});
