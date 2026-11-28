/*
  A streamable district built only from its layout data: paving along its streets and
  procedural blocks (layout.ts). Used for town fabric that has no quests of its own yet,
  like the streets between La Fàbrica and Canal i Galeria. A district can also carve
  holes in its paving for metro stairwells, which the resident level builds.
*/
import * as THREE from 'three';
import { DirectBuilder } from './meshbuilder';
import { bakeSteps } from './bake';
import { buildDistrictBlocksSteps, type DistrictData, type InstanceSink, type MetroDef } from './layout';
import { groundAroundMetro } from './metro';
import type { ColliderGrid, District } from './world';
import type { BoxCollider } from './level';

export interface BlocksEnv {
  groundY: number;
  grid: ColliderGrid;
  layout: DistrictData;
  ground: (x0: number, x1: number, z0: number, z1: number, y: number, mat: THREE.Material, tile: number) => THREE.Mesh;
  newInstancer: () => InstanceSink & { build(assign: (x: number, z: number) => THREE.Object3D): void };
  mats: {
    panot: THREE.Material; panotTile: number;
    wall: THREE.MeshStandardMaterial;
    litWindow: THREE.Material;
    darkWindow: THREE.Material;
    iron: THREE.Material;
  };
  /** Metro stairwells inside this district's paving. */
  metros?: MetroDef[];
  r: () => number;
}

/** Axis-aligned paving rectangles along a district's streets (two-point, axis-aligned streets only). */
function streetRects(d: DistrictData): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (const s of d.streets) {
    const [[ax, az], [bx, bz]] = s.points as [number, number][];
    const h = s.width / 2;
    if (az === bz) out.push([Math.min(ax, bx), Math.max(ax, bx), az - h, az + h]);
    else out.push([ax - h, ax + h, Math.min(az, bz), Math.max(az, bz)]);
  }
  return out;
}

export function makeBlocksDistrict(env: BlocksEnv): District {
  const L = env.layout;
  const d: District = {
    id: L.id,
    label: L.label,
    bounds: L.bounds,
    root: new THREE.Group(),
    floor: () => env.groundY,
    surface: () => 'paving',
    built: false,
    baked: false,
    state: 'standin',
    build: () => build(),
    bake: () => bakeSteps(d.root, (L.bounds.z0 + L.bounds.z1) / 2),
    unload: () => {
      d.root.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); });
      d.root.clear();
    },
  };
  d.root.name = L.id;

  function* build(): Generator<void, void, void> {
    const { groundY: Y, grid, mats, r } = env;
    for (const [x0, x1, z0, z1] of streetRects(L)) {
      const holes = (env.metros ?? []).filter((m) => m.x0 > x0 && m.x1 < x1 && m.z0 > z0 && m.z1 < z1);
      const pieces = holes.length ? groundAroundMetro(x0, x1, z0, z1, holes[0]) : [[x0, x1, z0, z1] as [number, number, number, number]];
      for (const [gx0, gx1, gz0, gz1] of pieces) d.root.add(env.ground(gx0, gx1, gz0, gz1, Y + 0.002, mats.panot, mats.panotTile));
    }
    yield;
    const builder = new DirectBuilder((L.bounds.z0 + L.bounds.z1) / 2);
    const inst = env.newInstancer();
    const boxes: BoxCollider[] = [];
    const blocks = buildDistrictBlocksSteps(L, {
      groundY: Y, builder, wallMat: mats.wall, inst, boxes,
      litWindowMat: mats.litWindow, darkWindowMat: mats.darkWindow, ironMat: mats.iron, r,
    });
    while (!blocks.next().done) yield;
    for (const b of boxes) grid.addBox(b);
    const flush = builder.flushSteps(d.root);
    while (!flush.next().done) yield;
    inst.build(() => d.root);
  }
  return d;
}
