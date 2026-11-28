import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boneSpots, mapPlaceMarks, poiPos } from '../src/scripts/walk/placements.ts';
import { GOAL_DEFS } from '../src/scripts/walk/goalDefs.ts';
import { AREAS, loadProgress } from '../src/scripts/walk/progress.ts';

/*
  Guards for the map re-orientation (docs/superpowers/specs/2026-11-28-walk-reorientation-design.md):
  districts must tile without overlapping, every POI, pipicà, map marker and bone must sit
  where its district is, and saves made before any district moved must stay valid.
*/

interface Rect { x0: number; x1: number; z0: number; z1: number }
interface District { id: string; bounds: Rect; pois: { id: string; x: number; z: number }[] }
const layout = JSON.parse(readFileSync(new URL('../src/scripts/walk/data/seafront.json', import.meta.url), 'utf8')) as {
  mapBounds: Rect;
  pier: { x0: number; x1: number };
  districts: District[];
  [key: string]: unknown;
};
const byId = new Map(layout.districts.map((d) => [d.id, d]));
const inside = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

describe('walk layout districts', () => {
  it('have unique ids', () => {
    assert.equal(byId.size, layout.districts.length);
  });

  it('do not overlap (sharing an edge is fine)', () => {
    const ds = layout.districts;
    for (let i = 0; i < ds.length; i++) {
      for (let j = i + 1; j < ds.length; j++) {
        const a = ds[i].bounds;
        const b = ds[j].bounds;
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
        assert.ok(ox <= 0 || oz <= 0, `${ds[i].id} overlaps ${ds[j].id} by ${ox} x ${oz} m`);
      }
    }
  });

  it('hold their own POIs', () => {
    for (const d of layout.districts) {
      for (const p of d.pois) assert.ok(inside(d.bounds, p.x, p.z), `${d.id}/${p.id} at (${p.x}, ${p.z}) is outside its district`);
    }
  });

  it('hold every pipicà', () => {
    const pens = Object.entries(layout).filter(([k]) => /^pipica\d*$/.test(k)) as [string, Rect][];
    assert.ok(pens.length >= 7);
    for (const [k, r] of pens) {
      const owner = layout.districts.find((d) => inside(d.bounds, r.x0, r.z0) && inside(d.bounds, r.x1, r.z1));
      assert.ok(owner, `${k} is not inside a single district`);
    }
  });
});

describe('walk placements', () => {
  it('resolve every minimap place inside the map', () => {
    const marks = mapPlaceMarks(layout);
    assert.ok(marks.length > 20);
    for (const m of marks) assert.ok(inside(layout.mapBounds, m.x, m.z), `${m.label} at (${m.x}, ${m.z}) is off the map`);
  });

  it('throw on a POI the data no longer has', () => {
    assert.throws(() => poiPos(layout, 'marina', 'no-such-poi'));
    assert.deepEqual(poiPos(layout, 'rambla', 'station'), { x: 47, z: 17 });
  });

  it('keep each bone group inside its district', () => {
    const groups = boneSpots(layout);
    assert.equal(groups.flatMap((g) => g.spots).length, 22);
    for (const g of groups) {
      const d = byId.get(g.district);
      assert.ok(d, `no district ${g.district}`);
      for (const [x, z] of g.spots) assert.ok(inside(d.bounds, x, z), `bone (${x}, ${z}) is outside ${g.district}`);
    }
  });

  it('put the pier bones on the pier', () => {
    const pierX = (layout.pier.x0 + layout.pier.x1) / 2;
    const seafront = boneSpots(layout).find((g) => g.district === 'seafront')!;
    assert.equal(seafront.spots.filter(([x]) => x === pierX).length, 2);
  });
});

describe('real-town orientation (+x is southwest, toward the city)', () => {
  const station = poiPos(layout, 'rambla', 'station');
  const seafront = byId.get('seafront')!;
  const lm = (id: string) => (seafront as unknown as { landmarks: (Rect & { id: string })[] }).landmarks.find((l) => l.id === id);

  it('puts the old pier a little southwest of the station', () => {
    const pierX = (layout.pier.x0 + layout.pier.x1) / 2;
    assert.ok(pierX > station.x + 60 && pierX < station.x + 160, `pier at x ${pierX}`);
    assert.ok(layout.pier.x1 <= seafront.bounds.x1);
  });

  it('puts the old distillery between the tracks and the promenade, at the pier root', () => {
    const d = lm('distillery');
    const c = lm('chimney');
    assert.ok(d && c);
    assert.ok(d.z1 <= 4 && d.z0 > -10, 'seaward of the tracks, inland of the boardwalk');
    assert.ok(d.x0 > station.x, 'southwest of the station');
    assert.ok(Math.abs(layout.pier.x0 - d.x1) < 10, 'beside the pier root');
    assert.ok(c.x0 >= d.x0 && c.x1 <= d.x1 && c.z0 >= d.z0 && c.z1 <= d.z1, 'chimney inside the distillery');
    assert.ok(!byId.get('town')!.pois.some((p) => p.id === 'distillery'));
  });
});

describe('saved progress across district moves', () => {
  // A save made before the re-orientation (walk3d-progress-v1). Goal ids and done keys
  // carry no positions, so moving districts must never invalidate them.
  const before = {
    v: 1,
    bones: 57,
    goals: {
      whirl: { done: true }, mark: { done: false, count: 3 }, finds: { done: true, count: 3 }, pier: { done: true },
      marina_quests: { done: true, count: 3 }, marina_lighthouse: { done: true }, marina_mico: { done: true },
      gorg_quests: { done: false, count: 2 }, gorg_bridges: { done: true, count: 2 }, gorg_carts: { done: true },
      ronda_quests: { done: true, count: 3 }, ronda_bridge: { done: true }, ronda_scooters: { done: true },
      fabrica_quests: { done: false, count: 1 }, plaza_castellers: { done: true }, hill_top: { done: true },
    },
    done: ['gorg:bag', 'gorg:hoop', 'gorg:bridgeS', 'gorg:bridgeN', 'gorg:carts', 'marina:mico', 'marina:lighthouse', 'marina:wake',
      'ronda:bridgeCross', 'ronda:scooters', 'fabrica:bread', 'plaza:castellers', 'hill:home', 'town:tabalers', 'find:3', 'hurdle:1', 'cat:2'],
  };

  it('still names only goals that exist', () => {
    const ids = new Set(GOAL_DEFS.map((g) => g.id));
    for (const id of Object.keys(before.goals)) assert.ok(ids.has(id), `saved goal "${id}" no longer exists`);
  });

  it('maps every goal to an area and every area to districts in the layout', () => {
    const areas = new Set(AREAS.map((a) => a.id));
    for (const g of GOAL_DEFS) assert.ok(g.area && areas.has(g.area), `goal ${g.id} has unknown area ${g.area}`);
    for (const a of AREAS) for (const d of a.districts) assert.ok(byId.has(d), `area ${a.id} names unknown district ${d}`);
  });

  it('keeps done-key prefixes on known areas', () => {
    const prefixes = new Set([...AREAS.map((a) => a.id), 'find', 'hurdle', 'cat']);
    for (const k of before.done) assert.ok(prefixes.has(k.split(':')[0]), `done key ${k} has an unknown prefix`);
  });

  it('loads unchanged', () => {
    const store = new Map<string, string>([['walk3d-progress-v1', JSON.stringify(before)]]);
    const g = globalThis as { localStorage?: unknown };
    const prev = g.localStorage;
    g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: () => {}, removeItem: () => {} };
    try {
      assert.deepEqual(loadProgress(), before);
    } finally {
      g.localStorage = prev;
    }
  });
});
