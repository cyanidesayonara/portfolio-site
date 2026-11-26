import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MicoState, MICO_ARENA, MICO_HOME, MICO_MAX_HP, MICO_PLAYER_MAX_HITS,
} from '../src/scripts/walk/micoLogic.ts';
import { WakeChaseState } from '../src/scripts/walk/wakeLogic.ts';

const BOLLARDS: readonly [number, number][] = [
  [-204, -18], [-190, -18], [-204, -6], [-190, -6],
];

describe('El Mico de Bronze boss state machine', () => {
  it('cycles phases, stuns when lured into a bollard, and takes 3 bark hits to defeat', () => {
    const mico = new MicoState();
    assert.equal(mico.state, 'dormant');
    mico.start();
    assert.equal(mico.state, 'intro');
    assert.equal(mico.hp, MICO_MAX_HP);
    assert.equal(mico.phase, 1);

    // Finish intro -> leapWindup -> leapAir -> pace -> chargeWindup -> charging.
    let seenLeap = false;
    let seenCharge = false;
    const dog = { x: -204, z: -18, vx: 0, vz: 0 };
    for (let i = 0; i < 400; i++) {
      // Keep dog behind bollard (-204, -18) when charging starts so charge hits the bollard.
      if (mico.state === 'chargeWindup') {
        dog.x = -206.5;
        dog.z = -20.5;
      } else if (mico.state === 'charging') {
        seenCharge = true;
        dog.x = -195;
        dog.z = -5;
      } else if (mico.state === 'leapAir') {
        seenLeap = true;
        dog.x = -190;
        dog.z = -5;
      }
      const ev = mico.step(0.05, dog, BOLLARDS);
      if (ev.bollardBonk) break;
    }

    assert.ok(seenLeap, 'expected Phase 1 to run a leap attack before charging');
    assert.ok(seenCharge, 'expected Phase 1 to trigger a charge');
    assert.equal(mico.state, 'stunned', 'charging through a bollard must stun El Mico');

    // Out-of-range bark does not damage.
    assert.equal(mico.tryBarkHit(mico.x + 10, mico.z), 'none');
    // Close bark lands Phase 1 damage and enters recover.
    assert.equal(mico.tryBarkHit(mico.x + 1.5, mico.z), 'hit');
    assert.equal(mico.hp, 2);
    assert.equal(mico.phase, 2);
    assert.equal(mico.state, 'recover');

    // Phase 2 stun via pole whirl -> bark down to Phase 3.
    mico.step(1.2, dog, BOLLARDS);
    assert.equal(mico.triggerStun('whirl'), true);
    assert.equal(mico.tryBarkHit(mico.x, mico.z + 2), 'hit');
    assert.equal(mico.hp, 1);
    assert.equal(mico.phase, 3);

    // Phase 3 final stun -> bark defeats El Mico and flags defeatedOnce.
    mico.step(1.2, dog, BOLLARDS);
    assert.equal(mico.triggerStun('whirl'), true);
    assert.equal(mico.tryBarkHit(mico.x - 1, mico.z), 'defeated');
    assert.equal(mico.hp, 0);
    assert.equal(mico.state, 'defeated');
    assert.equal(mico.defeatedOnce, true);
  });

  it('spawns airborne bronze jugs in Phase 2 and counts 3 player hits toward defeat', () => {
    const mico = new MicoState();
    mico.start();
    mico.hp = 2; // Phase 2 throws 2 jugs first
    mico.stateT = 0;
    const dog = { x: -190, z: -12, vx: 0, vz: 0 };
    let sawToss = false;
    for (let i = 0; i < 60; i++) {
      const ev = mico.step(0.05, dog, BOLLARDS);
      if (ev.tossed) { sawToss = true; assert.equal(ev.tossed, 2); }
    }
    assert.ok(sawToss, 'expected Phase 2 script to throw 2 bronze jugs');

    // Stand directly inside jug landing zones/attacks or trigger consecutive hits cleanly.
    const hm = new MicoState();
    hm.start();
    hm.hp = 1;
    for (let h = 1; h <= MICO_PLAYER_MAX_HITS; h++) {
      hm.hitsCooldown = 0;
      hm.state = 'chargeWindup';
      hm.stateT = 0;
      hm.dur = 0.05;
      hm.tx = -194;
      hm.tz = -12;
      hm.step(0.06, { x: hm.x + 1.5, z: hm.z }, []);
      hm.x = -194;
      hm.z = -12;
      const res = hm.step(0.02, { x: -194, z: -12 }, []);
      assert.equal(res.playerHit, 'charge');
      if (h < MICO_PLAYER_MAX_HITS) assert.equal(res.bossWon, undefined);
      else assert.equal(res.bossWon, true);
    }
    assert.equal(hm.state, 'victory');
  });

  it('resets cleanly to dormant if Millie retreats east across the canal bridge', () => {
    const mico = new MicoState();
    mico.start();
    const ev = mico.step(0.05, { x: MICO_ARENA.fleeX + 1, z: -6 }, BOLLARDS);
    assert.equal(ev.fled, true);
    assert.equal(mico.state, 'dormant');
    assert.equal(mico.x, MICO_HOME.x);
    assert.equal(mico.z, MICO_HOME.z);
  });
});

describe('Harbor Boat Wake Surge state machine', () => {
  it('triggers only mid-pontoon, hits stragglers on the pontoon, and escapes at the stone quay', () => {
    const wake = new WakeChaseState();
    assert.equal(wake.canTrigger(-124, -20, false, false), null, 'quay ramp edge should not trigger yet');
    assert.equal(wake.canTrigger(-124, -40, true, false), null, 'must not overlap another threat');
    assert.equal(wake.canTrigger(-124, -40, false, false), 'A');

    wake.start('A');
    assert.equal(wake.active, true);
    assert.equal(wake.pontoon, 'A');

    // Escaping to quay before wave arrives wins cleanly.
    const esc = wake.step(0.5, { x: -124, z: -17.5 }, { x: -124, z: -18.5 });
    assert.equal(esc, 'escaped');
    assert.equal(wake.active, false);

    // Waiting halfway down Pontoon B until wave reaches dog scores a hit.
    wake.reset();
    wake.start('B');
    let result = 'active';
    for (let i = 0; i < 120; i++) {
      result = wake.step(0.1, { x: -150, z: -38 }, { x: -150, z: -36 });
      if (result !== 'active') break;
    }
    assert.equal(result, 'hit');
    assert.equal(wake.active, false);
  });
});
