import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FABRICA_AVENUE,
  FABRICA_BOUNDS,
  FABRICA_GROUND_Y,
  FABRICA_PIPICA,
  FABRICA_SQUARE,
  clampFabrica,
  fabricaFloor,
  fabricaSurface,
  inFabricaOpen,
  inFabricaPipica,
} from '../src/scripts/walk/fabricaGeom.ts';
import {
  BIN_LANES,
  BinRushState,
  ShutterState,
  SHUTTER_CLOSE_TIME,
  SHUTTER_REOPEN_TIME,
} from '../src/scripts/walk/fabricaLogic.ts';

type Bounds = { x0: number; x1: number; z0: number; z1: number };
const distToBounds = (b: Bounds, x: number, z: number) =>
  Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
const overlaps = (a: Bounds, b: Bounds) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

const layout = JSON.parse(
  readFileSync(new URL('../src/scripts/walk/data/seafront.json', import.meta.url), 'utf8'),
) as {
  districts: { id: string; bounds: Bounds; blocks: Bounds[] }[];
  pipica7: Bounds & { gateZ0: number; gateZ1: number };
};

describe('La Fàbrica geometry and layout', () => {
  it('has flat paving with sand only in the seventh pipicà', () => {
    assert.equal(fabricaFloor(118, 60), FABRICA_GROUND_Y);
    assert.equal(fabricaSurface(118, 60), 'paving');
    assert.equal(inFabricaPipica(157, 68), true);
    assert.equal(fabricaSurface(157, 68), 'sand');
    assert.equal(inFabricaPipica(140, 68), false);
  });

  it('clamps points into the avenue or the square', () => {
    assert.equal(inFabricaOpen(118, 60), true);
    assert.equal(inFabricaOpen(150, 80), true);
    assert.equal(inFabricaOpen(100, 60), false);
    // Inside a block west of the avenue: pulled onto the avenue.
    const w = clampFabrica(104, 60);
    assert.ok(w.x >= FABRICA_AVENUE.x0 && w.x <= FABRICA_AVENUE.x1);
    // Inside the block south of the square: pulled onto the square or avenue, never left inside.
    const s = clampFabrica(150, 50);
    assert.equal(inFabricaOpen(s.x, s.z), true);
    // Past the far wall of the square.
    const e = clampFabrica(180, 80);
    assert.ok(e.x < FABRICA_SQUARE.x1);
  });

  it('matches the layout data and leaves the avenue and square free of blocks', () => {
    const fab = layout.districts.find((d) => d.id === 'fabrica');
    const town = layout.districts.find((d) => d.id === 'town');
    assert.ok(fab && town);
    assert.deepEqual(fab.bounds, { ...FABRICA_BOUNDS });
    assert.equal(overlaps(town.bounds, fab.bounds), false);
    for (const d of layout.districts) {
      for (const b of d.blocks) {
        assert.equal(overlaps(b, FABRICA_AVENUE), false, `block ${JSON.stringify(b)} sits on the avenue`);
        assert.equal(overlaps(b, FABRICA_SQUARE), false, `block ${JSON.stringify(b)} sits on the square`);
      }
    }
    assert.deepEqual(layout.pipica7, { ...FABRICA_PIPICA });
  });

  it('does not build at spawn (beyond the streamer build radius of 110 m)', () => {
    assert.ok(distToBounds(FABRICA_BOUNDS, -22, -3.4) > 110);
  });
});

describe('La Fàbrica BinRushState and ShutterState', () => {
  it('rolls bins down every lane and hits a dog standing in one', () => {
    const r = new BinRushState();
    const dog = { x: BIN_LANES[1], z: 80 };
    assert.equal(r.canTrigger(dog, false), true);
    assert.equal(r.canTrigger(dog, true), false);
    r.start(dog.x);
    let hit: { x: number; z: number } | null = null;
    for (let i = 0; i < 400 && !hit; i++) hit = r.step(0.05, dog).hit;
    assert.ok(hit);
    assert.ok(Math.abs(hit.x - BIN_LANES[1]) < 0.01);
    assert.equal(r.active, false);
    assert.ok(r.cooldown > 0);
  });

  it('lets a dog in the tree line survive both waves', () => {
    const r = new BinRushState();
    const dog = { x: FABRICA_AVENUE.midX, z: 80 };
    r.start(dog.x);
    let survived = false, waves = 0;
    for (let i = 0; i < 2000 && !survived; i++) {
      const ev = r.step(0.05, dog);
      assert.equal(ev.hit, null);
      if (ev.nextWave) waves++;
      survived = ev.survived;
    }
    assert.equal(survived, true);
    assert.equal(waves, 1);
    assert.equal(r.survivedOnce, true);
  });

  it('calls the rush off without credit when Millie leaves the avenue', () => {
    const r = new BinRushState();
    r.start(118);
    const ev = r.step(0.05, { x: 140, z: 80 });
    assert.equal(ev.leftAvenue, true);
    assert.equal(r.active, false);
    assert.equal(r.survivedOnce, false);
  });

  it('closes the shutter unless Millie barks in time, then reopens it for another try', () => {
    const s = new ShutterState();
    assert.equal(s.notice(20), false);
    assert.equal(s.notice(3), true);
    assert.equal(s.phase, 'closing');
    let closed = false;
    for (let t = 0; t < SHUTTER_CLOSE_TIME + 1 && !closed; t += 0.1) closed = s.step(0.1).closed;
    assert.equal(closed, true);
    assert.equal(s.bark(2), false);
    let reopened = false;
    for (let t = 0; t < SHUTTER_REOPEN_TIME + 1 && !reopened; t += 0.1) reopened = s.step(0.1).reopened;
    assert.equal(reopened, true);
    assert.equal(s.notice(3), true);
    s.step(1);
    assert.equal(s.bark(10), false);
    assert.equal(s.bark(2), true);
    assert.equal(s.phase, 'saved');
  });
});
