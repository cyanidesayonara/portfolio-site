import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MosaicState,
  MOSAIC_HOME,
  MOSAIC_LAMPS,
  MOSAIC_MAX_HP,
  MOSAIC_MAX_PLAYER_HITS,
} from '../src/scripts/walk/mosaicLogic.ts';
import {
  SenglarsState,
  SENGLARS_COOLDOWN,
  SENGLARS_LANES,
} from '../src/scripts/walk/senglarsLogic.ts';

function stepUntil(fn: () => boolean, maxSteps = 200): boolean {
  for (let i = 0; i < maxSteps; i++) {
    if (fn()) return true;
  }
  return false;
}

describe('MosaicState (Boss #3 — Roman Mosaic Guardian at Museu)', () => {
  it('progresses intro -> tiles -> sweep_windup -> sweep -> exposed with golden keystone', () => {
    const m = new MosaicState();
    m.start();
    assert.equal(m.active, true);
    assert.equal(m.state, 'intro');
    assert.equal(m.hp, MOSAIC_MAX_HP);

    const safeDog = { x: -4.5, y: 5.2, z: 202.0, vx: 0, vz: 0 };
    const sawTiles = stepUntil(() => {
      const ev = m.step(0.05, safeDog);
      return ev.tileVolley && m.state === 'tiles';
    }, 40);
    assert.equal(sawTiles, true);
    assert.ok(m.tiles.filter((t) => t.active).length >= 2);

    const sawWindup = stepUntil(() => {
      const ev = m.step(0.05, safeDog);
      return ev.sweepTelegraphed && m.state === 'sweep_windup';
    }, 60);
    assert.equal(sawWindup, true);
    assert.equal(m.lane.active, true);

    const sawExposed = stepUntil(() => {
      const ev = m.step(0.05, safeDog);
      return ev.exposed && m.state === 'exposed';
    }, 60);
    assert.equal(sawExposed, true);
    assert.equal(m.keystone.active, true);
  });

  it('rejects shielded barks, allows mid-terrace lamp whirl-break, and defeats in 3 exposed cracks', () => {
    const m = new MosaicState();
    m.start();
    const dog = { x: MOSAIC_HOME.x - 1.5, y: 5.2, z: MOSAIC_HOME.z, vx: 0, vz: 0 };

    // Wait through intro into tiles.
    stepUntil(() => {
      m.step(0.05, dog);
      return m.state === 'tiles';
    }, 40);
    assert.equal(m.tryBarkCrack(dog.x, dog.z), 'shielded');

    // Three rounds of lamp whirl -> keystone/close bark crack.
    for (let hit = 1; hit <= MOSAIC_MAX_HP; hit++) {
      const lamp = MOSAIC_LAMPS[hit % MOSAIC_LAMPS.length];
      assert.equal(m.tryWhirlBreak(lamp.x, lamp.z), true);
      assert.equal(m.state, 'exposed');
      assert.equal(m.keystone.active, true);
      const res = m.tryBarkCrack(m.keystone.x, m.keystone.z);
      if (hit < MOSAIC_MAX_HP) {
        assert.equal(res, 'hit');
        assert.equal(m.hp, MOSAIC_MAX_HP - hit);
        stepUntil(() => {
          m.step(0.05, dog);
          return m.state === 'tiles';
        }, 40);
      } else {
        assert.equal(res, 'defeated');
        assert.equal(m.hp, 0);
        assert.equal(m.defeatedOnce, true);
        assert.equal(m.active, false);
      }
    }
  });

  it('resets on player KO after 3 hits and flees cleanly if dog leaves terrace', () => {
    const m = new MosaicState();
    m.start();

    // Test flee boundary cleanly.
    const fleeEv = m.step(0.05, { x: 0, y: 0.2, z: 175, vx: 0, vz: 0 });
    assert.equal(fleeEv.fled, true);
    assert.equal(m.state, 'dormant');

    // Test 3 tile impacts standing directly inside the first active ring.
    m.start();
    let totalHits = 0;
    let won = false;
    for (let i = 0; i < 450 && !won; i++) {
      const activeTile = m.tiles.find((t) => t.active);
      const stand = activeTile
        ? { x: activeTile.x, y: 5.2, z: activeTile.z, vx: 0, vz: 0 }
        : { x: m.x, y: 5.2, z: m.z, vx: 0, vz: 0 };
      const ev = m.step(0.05, stand);
      if (ev.playerHit) totalHits++;
      if (ev.bossWon) won = true;
    }
    assert.equal(totalHits, MOSAIC_MAX_PLAYER_HITS);
    assert.equal(won, true);
    assert.equal(m.state, 'dormant');
  });
});

describe('SenglarsState (Chase #2 — wild boars downhill on Dalt de la Vila)', () => {
  it('triggers on lower hillside climb, warns, charges downhill along lanes, and hits on collision', () => {
    const s = new SenglarsState();
    const midDog = { x: 0, y: 2.66, z: 187.0 };
    assert.equal(s.canTrigger(midDog, true), false);
    assert.equal(s.canTrigger(midDog, false), true);

    s.start(midDog.x);
    assert.equal(s.active, true);
    assert.equal(s.phase, 'warning');
    assert.equal(s.wave, 1);

    const started = stepUntil(() => s.step(0.05, midDog).startedCharge, 40);
    assert.equal(started, true);
    assert.equal(s.phase, 'charging');

    // Boar on lane closest to dog.x (x = 0) rushes downhill and bumps stationary Millie.
    let hitEv: { x: number; z: number } | null = null;
    for (let i = 0; i < 60 && !hitEv; i++) {
      hitEv = s.step(0.05, midDog).hit;
    }
    assert.ok(hitEv !== null);
    assert.equal(Math.abs(hitEv.x - 0) < 0.01, true);
    assert.equal(s.active, false);
    assert.equal(s.cooldown, SENGLARS_COOLDOWN);
  });

  it('escapes cleanly when reaching bottom terrace or surviving both waves cleanly', () => {
    const s = new SenglarsState();
    s.start(-2.2);
    const outRun = s.step(0.05, { x: 0, y: 0.2, z: 175.8 });
    assert.equal(outRun.escaped, true);
    assert.equal(s.survivedOnce, true);

    // Clear cooldown and dodge both waves on the far edge of the climb.
    while (s.cooldown > 0) s.step(1.0, { x: 0, y: 2.66, z: 187.0 });
    assert.equal(s.tryBarkStart({ x: 3.6, y: 2.66, z: 187.0 }, false), true);

    const safeSpot = { x: 3.8, y: 2.66, z: 187.0 };
    assert.ok(SENGLARS_LANES.every((lx) => Math.abs(lx - safeSpot.x) > 1.2));

    let escapedAll = false;
    let sawWave2 = false;
    for (let i = 0; i < 300 && !escapedAll; i++) {
      const ev = s.step(0.05, safeSpot);
      if (ev.nextWave) sawWave2 = true;
      if (ev.escaped) escapedAll = true;
    }
    assert.equal(sawWave2, true);
    assert.equal(escapedAll, true);
    assert.equal(s.survivedOnce, true);
  });
});
