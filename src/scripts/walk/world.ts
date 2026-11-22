/*
  World structure for a level that can grow: districts and a collider grid.

  - A District owns a part of the map: its scene graph (root), its ground
    height and surfaces, and (by `district` tag) its colliders. Districts are
    what will later stream in and out (Phase 1); for now they're all live.
  - ColliderGrid buckets boxes and circles into square cells, so collision,
    leash-obstacle and camera checks only look at what's nearby instead of
    scanning the whole level. Results come back in a reused array: use them
    straight away, don't keep them.
*/
import * as THREE from 'three';
import type { BoxCollider, CircleCollider, Surface } from './level';

export interface Bounds { x0: number; x1: number; z0: number; z1: number }

export interface District {
  id: string;
  label: string;
  /** Half-open: x0 ≤ x < x1, z0 ≤ z < z1. */
  bounds: Bounds;
  root: THREE.Group;
  floor: (x: number, z: number, y: number) => number;
  surface: (x: number, z: number, y: number) => Surface;
}

export const inBounds = (b: Bounds, x: number, z: number) => x >= b.x0 && x < b.x1 && z >= b.z0 && z < b.z1;

interface Cell { boxes: BoxCollider[]; circles: CircleCollider[] }

export class ColliderGrid {
  private cells = new Map<number, Cell>();
  private stamp = new WeakMap<object, number>();
  private q = 0;
  private outBoxes: BoxCollider[] = [];
  private outCircles: CircleCollider[] = [];

  constructor(readonly size = 8) {}

  private key(ix: number, iz: number) { return (ix + 32768) * 65536 + (iz + 32768); }
  private cell(ix: number, iz: number, make: true): Cell;
  private cell(ix: number, iz: number, make?: false): Cell | undefined;
  private cell(ix: number, iz: number, make = false) {
    const k = this.key(ix, iz);
    let c = this.cells.get(k);
    if (!c && make) { c = { boxes: [], circles: [] }; this.cells.set(k, c); }
    return c;
  }
  private span(x0: number, x1: number, z0: number, z1: number, fn: (ix: number, iz: number) => void) {
    const s = this.size;
    for (let ix = Math.floor(x0 / s); ix <= Math.floor(x1 / s); ix++)
      for (let iz = Math.floor(z0 / s); iz <= Math.floor(z1 / s); iz++) fn(ix, iz);
  }

  addBox(b: BoxCollider) { this.span(b.x0, b.x1, b.z0, b.z1, (ix, iz) => this.cell(ix, iz, true).boxes.push(b)); }
  addCircle(c: CircleCollider) { this.span(c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r, (ix, iz) => this.cell(ix, iz, true).circles.push(c)); }

  /** Drop every collider tagged with this district (for unloading, Phase 1). */
  removeDistrict(id: string) {
    this.cells.forEach((c) => {
      c.boxes = c.boxes.filter((b) => b.district !== id);
      c.circles = c.circles.filter((k) => k.district !== id);
    });
  }

  /** Boxes overlapping the square around (x, z) with half-size r. */
  boxesNear(x: number, z: number, r: number) {
    const out = this.outBoxes;
    out.length = 0;
    const q = ++this.q;
    this.span(x - r, x + r, z - r, z + r, (ix, iz) => {
      const c = this.cell(ix, iz);
      if (!c) return;
      for (const b of c.boxes) {
        if (this.stamp.get(b) === q) continue;
        this.stamp.set(b, q);
        if (b.x1 >= x - r && b.x0 <= x + r && b.z1 >= z - r && b.z0 <= z + r) out.push(b);
      }
    });
    return out;
  }

  /** Circles overlapping the square around (x, z) with half-size r. */
  circlesNear(x: number, z: number, r: number) {
    const out = this.outCircles;
    out.length = 0;
    const q = ++this.q;
    this.span(x - r, x + r, z - r, z + r, (ix, iz) => {
      const c = this.cell(ix, iz);
      if (!c) return;
      for (const k of c.circles) {
        if (this.stamp.get(k) === q) continue;
        this.stamp.set(k, q);
        if (Math.abs(k.x - x) <= r + k.r && Math.abs(k.z - z) <= r + k.r) out.push(k);
      }
    });
    return out;
  }
}
