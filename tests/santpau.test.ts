import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SANTPAU_PIPICA, SANTPAU_PLACETA, SANTPAU_STREET, inSantPauPipica, onSantPauStreet, santpauSurface } from '../src/scripts/walk/santpauGeom.ts';
import {
  BOTTLE_LANES, BOTTLE_START_Z, BOTTLE_TRIGGER, BottleRushState, ESMOLET_BARK_R, ESMOLET_PERIOD, ESMOLET_WHISTLE,
  EsmoletState, LISTEN_TIME, ListenState,
} from '../src/scripts/walk/santpauLogic.ts';

const layout = JSON.parse(readFileSync(new URL('../src/scripts/walk/data/seafront.json', import.meta.url), 'utf8')) as {
  districts: { id: string; bounds: { x0: number; x1: number; z0: number; z1: number } }[];
  pipica8: { x0: number; x1: number; z0: number; z1: number };
};

describe('Sant Pau i Prim geometry', () => {
  it('matches the layout data', () => {
    const d = layout.districts.find((x) => x.id === 'santpau')!;
    assert.deepEqual(layout.pipica8, { ...layout.pipica8, x0: SANTPAU_PIPICA.x0, x1: SANTPAU_PIPICA.x1, z0: SANTPAU_PIPICA.z0, z1: SANTPAU_PIPICA.z1 });
    for (const r of [SANTPAU_STREET, SANTPAU_PLACETA, SANTPAU_PIPICA]) {
      assert.ok(r.x0 >= d.bounds.x0 && r.x1 <= d.bounds.x1 && r.z0 >= d.bounds.z0 && r.z1 <= d.bounds.z1);
    }
  });

  it('puts the pipicà in the Placeta with sand underfoot', () => {
    assert.ok(SANTPAU_PIPICA.x0 >= SANTPAU_PLACETA.x0 && SANTPAU_PIPICA.x1 <= SANTPAU_PLACETA.x1);
    assert.ok(inSantPauPipica(-154, 68));
    assert.equal(santpauSurface(-154, 68), 'sand');
    assert.equal(santpauSurface(-122, 60), 'paving');
    assert.ok(onSantPauStreet(-122, 100) && !onSantPauStreet(-140, 100));
  });
});

describe('BottleRushState', () => {
  it('starts from the upper street only', () => {
    const s = new BottleRushState();
    assert.ok(!s.canTrigger({ x: -122, z: 60 }, false));
    assert.ok(s.canTrigger({ x: -122, z: (BOTTLE_TRIGGER.z0 + BOTTLE_TRIGGER.z1) / 2 }, false));
    assert.ok(!s.canTrigger({ x: -122, z: 100 }, true));
  });

  it('lets a dog in the middle of the street survive both waves', () => {
    const s = new BottleRushState();
    s.start(-122);
    let survived = false;
    for (let i = 0; i < 60 * 40 && !survived; i++) {
      const r = s.step(1 / 60, { x: -122, z: 100 });
      assert.equal(r.hit, null);
      survived = r.survived;
    }
    assert.ok(survived && s.survivedOnce && !s.active);
  });

  it('hits a dog standing in a gutter lane', () => {
    const s = new BottleRushState();
    s.start(BOTTLE_LANES[0]);
    let hit = null;
    for (let i = 0; i < 60 * 20 && !hit; i++) hit = s.step(1 / 60, { x: BOTTLE_LANES[0], z: BOTTLE_START_Z - 20 }).hit;
    assert.ok(hit);
    assert.ok(!s.active && s.cooldown > 0);
  });

  it('stops without credit when Millie leaves the street', () => {
    const s = new BottleRushState();
    s.start(-122);
    const r = s.step(0.1, { x: -140, z: 68 });
    assert.ok(r.leftStreet && !s.active && !s.survivedOnce);
  });
});

describe('EsmoletState', () => {
  it('only takes a bark while he whistles and Millie is close', () => {
    const e = new EsmoletState();
    assert.ok(e.whistling);
    assert.ok(!e.bark(ESMOLET_BARK_R + 1));
    e.step(ESMOLET_WHISTLE + 0.5);
    assert.ok(!e.whistling);
    assert.ok(!e.bark(2));
    let started = false;
    for (let i = 0; i < 60 * ESMOLET_PERIOD && !started; i++) started = e.step(1 / 60);
    assert.ok(started && e.whistling);
    assert.ok(e.bark(2));
    assert.ok(e.answered && !e.whistling);
  });
});

describe('ListenState', () => {
  it('needs Millie to sit still close by', () => {
    const l = new ListenState();
    let done = false;
    for (let i = 0; i < 60 * LISTEN_TIME * 2 && !done; i++) done = l.step(1 / 60, 5, 0);
    assert.ok(!done, 'too far');
    for (let i = 0; i < 60 * LISTEN_TIME * 2 && !done; i++) done = l.step(1 / 60, 2, 2);
    assert.ok(!done, 'moving');
    for (let i = 0; i < 60 * (LISTEN_TIME + 0.2) && !done; i++) done = l.step(1 / 60, 2, 0);
    assert.ok(done && l.done);
  });
});
