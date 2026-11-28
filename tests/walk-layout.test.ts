import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boneSpots, mapPlaceMarks, poiPos } from '../src/scripts/walk/placements.ts';
import { GOAL_DEFS } from '../src/scripts/walk/goalDefs.ts';
import { AREAS, loadProgress } from '../src/scripts/walk/progress.ts';
import { HILL_DX, shiftX } from '../src/scripts/walk/hillOffset.ts';
import { MARINA_DX } from '../src/scripts/walk/marinaOffset.ts';
import { BREAKWATER, CANAL } from '../src/scripts/walk/marinaGeom.ts';
import { MICO_ARENA as MICO_ARENA_LOCAL } from '../src/scripts/walk/micoLogic.ts';

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

describe('the moved hill and the metro (re-orientation step 2)', () => {
  const zone = (id: string) => (layout as unknown as { zones: (Rect & { id: string })[] }).zones.find((z) => z.id === id)!;

  it('puts the old town on the hill northeast (-x) of Carrer del Mar', () => {
    const church = poiPos(layout, 'hill', 'church');
    const street = poiPos(layout, 'town', 'carrer-del-mar');
    assert.equal(church.x, HILL_DX);
    assert.ok(church.x < street.x - 30, `church at x ${church.x}`);
  });

  it('opens Carrer Major at the foot of the climb', () => {
    const approach = zone('hillApproach');
    const climb = zone('hillClimb');
    assert.ok(approach.x0 >= climb.x0 && approach.x1 <= climb.x1);
    const plaza = byId.get('plaza') as unknown as { blocks: Rect[] };
    for (const b of plaza.blocks) {
      const ox = Math.min(b.x1, approach.x1) - Math.max(b.x0, approach.x0);
      const oz = Math.min(b.z1, approach.z1) - Math.max(b.z0, approach.z0);
      assert.ok(ox <= 0 || oz <= 0, 'a plaza block covers the way up to the hill');
    }
  });

  it('puts the first metro entrance in its square off Carrer Major, not on the Rambla', () => {
    const metro = (layout as unknown as { metros: (Rect & { id: string })[] }).metros[0];
    const sq = zone('metroSquare');
    assert.equal(metro.id, 'plaza', "the 2D street's metro links to the first entrance");
    assert.ok(metro.x0 > sq.x0 && metro.x1 < sq.x1 && metro.z0 > sq.z0 && metro.z1 < sq.z1);
    assert.ok(!byId.get('rambla')!.pois.some((p) => p.id === 'metro'));
  });

  it('shifts x fields and [x, z] pairs only', () => {
    assert.deepEqual(shiftX({ x: 1, z: 2, x0: 3, x1: 4, minX: 5, maxX: 6, y: 7, pts: [[1, 2]], label: 'a' }, 10),
      { x: 11, z: 2, x0: 13, x1: 14, minX: 15, maxX: 16, y: 7, pts: [[11, 2]], label: 'a' });
  });
});

describe('the port (re-orientation step 3)', () => {
  const marina = byId.get('marina')!;
  const seafront = byId.get('seafront')!;
  const zone = (id: string) => (layout as unknown as { zones: (Rect & { id: string })[] }).zones.find((z) => z.id === id)!;

  it('sits southwest of the old pier, where the beach ends', () => {
    assert.ok(marina.bounds.x0 > layout.pier.x1, 'southwest (+x) of the pier');
    assert.equal(marina.bounds.x0, seafront.bounds.x1, 'the beach and promenade run straight into the port');
  });

  it('starts at the breakwater root, with the canal right beside it', () => {
    const stem = zone('marinaBreakwater');
    const canal = zone('marinaCanal');
    assert.equal(stem.x0, marina.bounds.x0);
    assert.equal(stem.x0, BREAKWATER.x0 + MARINA_DX);
    assert.equal(canal.x0, CANAL.x0 + MARINA_DX);
    assert.ok(canal.x0 - stem.x1 < 40, 'the canal opens close to the breakwater root');
  });

  it('keeps El Mico de Bronze and the lighthouse inside the port', () => {
    const a = MICO_ARENA_LOCAL;
    assert.ok(inside(marina.bounds, a.x0 + MARINA_DX, a.z0) && inside(marina.bounds, a.x1 + MARINA_DX, a.z1));
    assert.ok(inside(marina.bounds, poiPos(layout, 'marina', 'lighthouse').x, poiPos(layout, 'marina', 'lighthouse').z));
  });
});

describe('Canal i Galeria, Ronda and Carrer del Progrés (re-orientation step 4)', () => {
  const b = (id: string) => byId.get(id)!.bounds;
  const zone = (id: string) => (layout as unknown as { zones: (Rect & { id: string })[] }).zones.find((z) => z.id === id)!;

  it('puts Gorg inland of the port, its canal straight on from the port canal', () => {
    assert.equal(zone('gorgCanal').x0, zone('marinaCanal').x0);
    assert.equal(zone('gorgCanal').x1, zone('marinaCanal').x1);
    assert.equal(b('gorg').x0, b('marina').x0 - 6);
    assert.equal(b('ronda').z0, b('gorg').z1, 'Ronda sits north of Gorg');
  });

  it('closes the gap between La Fàbrica and Gorg with Carrer del Progrés', () => {
    assert.equal(b('progres').x0, b('fabrica').x1);
    assert.equal(b('progres').x1, b('gorg').x0);
  });

  it('puts a metro entrance where each real L2 stop is, inside its district', () => {
    const metros = (layout as unknown as { metros: (Rect & { id: string })[] }).metros;
    assert.deepEqual(metros.map((m) => m.id), ['plaza', 'progres', 'gorg']);
    for (const m of metros) {
      const d = byId.get(m.id)!;
      assert.ok(inside(d.bounds, m.x0, m.z0) && inside(d.bounds, m.x1, m.z1), `metro ${m.id} outside its district`);
    }
    // Southwest (+x) in the real order: town hall terminus, then the middle stop, then Gorg.
    assert.ok(metros[0].x0 < metros[1].x0 && metros[1].x0 < metros[2].x0);
  });
});

describe('the Montgat side (re-orientation step 5)', () => {
  const b = (id: string) => byId.get(id)!.bounds;

  it('runs the Rambla and the seafront on northeast (-x) toward Montgat', () => {
    assert.ok(b('rambla').x0 <= -200 && b('seafront').x0 <= -200);
  });

  it('puts Sant Pau i Prim northeast of Carrer del Mar, off the Rambla', () => {
    const sp = byId.get('santpau')!;
    assert.equal(sp.bounds.x1, b('town').x0, 'next to the town, on its -x side');
    assert.equal(sp.bounds.z0, b('rambla').z1 + 0.5);
    const streets = (sp as unknown as { streets: { id: string; points: [number, number][] }[] }).streets;
    for (const id of ['sant-pau', 'prim']) {
      const st = streets.find((t) => t.id === id)!;
      for (const [x, z] of st.points) assert.ok(inside(sp.bounds, x, z), `${id} leaves the district`);
      assert.equal(st.points[0][1], 34, `${id} starts at the Rambla`);
    }
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
