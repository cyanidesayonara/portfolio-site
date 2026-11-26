import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DimoniState, DIMONI_POS, DIMONI_MAX_PLAYER_HITS } from '../src/scripts/walk/dimoniLogic.ts';
import { CastellersState, CASTELLERS_POS } from '../src/scripts/walk/castellersLogic.ts';
import { TabalersState, TABALERS_BEAT_DUR } from '../src/scripts/walk/tabalersLogic.ts';

describe('El Dimoni Gegant boss state machine', () => {
  it('supports douse hits when wet, devil counter hits, phase 3 victory, and flee reset', () => {
    const dimoni = new DimoniState();
    assert.equal(dimoni.state, 'dormant');
    dimoni.start();
    assert.equal(dimoni.state, 'active');
    assert.equal(dimoni.phase, 1);

    // Dry dog cannot douse the bonfire.
    assert.equal(dimoni.tryDouse(DIMONI_POS.x + 2, DIMONI_POS.z, 0.0), 'dry');
    // Soaked dog deals Phase 1 -> Phase 2 hit.
    assert.equal(dimoni.tryDouse(DIMONI_POS.x + 2, DIMONI_POS.z, 1.0), 'hit');
    assert.equal(dimoni.hp, 2);
    assert.equal(dimoni.phase, 2);

    // Advance past counterCooldown and trigger a devil counter-bark for Phase 2 -> 3.
    const devils = [{ x: DIMONI_POS.x + 4.5, z: DIMONI_POS.z }];
    dimoni.step(1.2, { x: DIMONI_POS.x + 4, z: DIMONI_POS.z }, []);
    assert.equal(dimoni.tryDevilCounter(DIMONI_POS.x + 3.5, DIMONI_POS.z, devils), 'hit');
    assert.equal(dimoni.hp, 1);
    assert.equal(dimoni.phase, 3);

    // Final soak douse defeats El Dimoni Gegant.
    assert.equal(dimoni.tryDouse(DIMONI_POS.x, DIMONI_POS.z + 5, 0.8), 'defeated');
    assert.equal(dimoni.hp, 0);
    assert.equal(dimoni.state, 'defeated');
    assert.equal(dimoni.defeatedOnce, true);

    // Fleeing onto boardwalk/town resets dormant.
    dimoni.start();
    const fledEv = dimoni.step(0.05, { x: 24, z: -14 }, []);
    assert.equal(fledEv.fled, true);
    assert.equal(dimoni.state, 'dormant');
  });

  it('launches cinders & fanned lanes in phase 3 and claims victory after 3 hits', () => {
    const dimoni = new DimoniState();
    dimoni.start();
    dimoni.hp = 1; // Phase 3
    dimoni.attackT = 0;
    const ev1 = dimoni.step(0.05, { x: 24, z: -28 }, []);
    assert.equal(ev1.cinderVolley, 4);
    dimoni.attackT = 0;
    const ev2 = dimoni.step(0.05, { x: 24, z: -28 }, []);
    assert.equal(ev2.laneVolley, 2);

    // 3 devil hits put Dimoni in victory state.
    const dm = new DimoniState();
    dm.start();
    for (let h = 1; h <= DIMONI_MAX_PLAYER_HITS; h++) {
      dm.hitsCooldown = 0;
      const ev = dm.step(0.02, { x: 24, z: -28 }, [{ x: 24, z: -28 }]);
      assert.equal(ev.playerHit, 'devil');
      if (h === DIMONI_MAX_PLAYER_HITS) assert.equal(ev.bossWon, true);
    }
    assert.equal(dm.state, 'victory');
  });
});

describe('Plaça Castellers state machine', () => {
  it('wobbles under nudges, topples at full instability, and rebuilds', () => {
    const tower = new CastellersState();
    assert.equal(tower.state, 'standing');
    assert.equal(tower.nudge(CASTELLERS_POS.x - 2, CASTELLERS_POS.z, 0.45), 'wobble');
    assert.equal(tower.state, 'wobbling');

    // Step damping preserves stability without immediate topple.
    tower.step(0.1);
    assert.ok(tower.instability > 0 && tower.instability < 1);

    assert.equal(tower.nudge(CASTELLERS_POS.x - 2, CASTELLERS_POS.z, 0.7), 'toppled');
    assert.equal(tower.state, 'toppled');
    assert.equal(tower.toppledOnce, true);

    // Step through toppled -> rebuilding -> standing.
    for (let i = 0; i < 70; i++) tower.step(0.1);
    assert.equal(tower.state, 'rebuilding');
    for (let i = 0; i < 25; i++) tower.step(0.1);
    assert.equal(tower.state, 'standing');
    assert.equal(tower.instability, 0);
  });
});

describe('Rambla Tabalers squad state machine', () => {
  it('spooks Millie on close downbeats unless braved by a nearby bark', () => {
    const squad = new TabalersState();
    const x0 = squad.x;
    let spooked = false;
    for (let i = 0; i < 30; i++) {
      const ev = squad.step(TABALERS_BEAT_DUR / 10, { x: squad.x, z: squad.z }, false);
      if (ev.spooked) spooked = true;
    }
    assert.notEqual(squad.x, x0, 'squad should march east along the Rambla');
    assert.ok(spooked, 'expected downbeat near squad to spook un-braved Millie');

    assert.equal(squad.tryBarkBrave(squad.x + 20, squad.z), 'none');
    assert.equal(squad.tryBarkBrave(squad.x + 2, squad.z), 'calmed');
    assert.equal(squad.bravedOnce, true);

    // While calmed, downbeats never spook even right beside them.
    for (let i = 0; i < 30; i++) {
      const ev = squad.step(TABALERS_BEAT_DUR / 10, { x: squad.x, z: squad.z }, false);
      assert.equal(ev.spooked, false);
    }
  });
});
