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
  /** Streaming state (see Streamer). */
  built: boolean;
  baked: boolean;
  state: 'live' | 'standin';
  /** Cheap far-away look: merged blocks, landmarks. Lives outside `root`. */
  standin?: THREE.Object3D;
  /** Merge the district's static meshes, in steps. */
  bake?: () => Generator<void, unknown, void>;
  /**
   * Districts that can stream: build the content into `root` (and colliders into
   * the grid) in steps, and tear it down again. Districts without these are
   * resident: built once at load and never unloaded.
   */
  build?: () => Generator<void, unknown, void>;
  unload?: () => void;
}

/** Distance from a point to a district's bounds (0 inside). */
export const distToBounds = (b: Bounds, x: number, z: number) =>
  Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));

/**
 * Streams districts around Millie, with hysteresis so nothing flickers at an edge:
 * - within `near`: live (full detail; built and baked first if needed),
 * - beyond `far`: the stand-in instead,
 * - beyond `unloadAt`: streamable districts are torn down.
 * Building and baking run as generators under a per-frame time budget.
 */
export class Streamer {
  near = 80;
  far = 100;
  unloadAt = 170;
  budgetMs = 4;
  private job: null | { d: District; g: Generator<void, unknown, void>; kind: 'build' | 'bake' } = null;
  /** Work log for the perf readout and tests. */
  readonly stats = { built: 0, baked: 0, unloaded: 0, lastSliceMs: 0, maxSliceMs: 0, maxStepMs: 0, maxStepKind: '' };

  constructor(readonly districts: District[], private grid: ColliderGrid) {}

  private nextJob(x: number, z: number) {
    let best: District | null = null, bestD = Infinity, kind: 'build' | 'bake' = 'bake';
    for (const d of this.districts) {
      const dist = distToBounds(d.bounds, x, z);
      if (!d.built && d.build && dist < this.near + 30 && dist < bestD) { best = d; bestD = dist; kind = 'build'; }
      else if (d.built && !d.baked && d.bake && dist < bestD) { best = d; bestD = dist; kind = 'bake'; }
    }
    if (!best) return null;
    const g = kind === 'build' ? best.build!() : best.bake!();
    return { d: best, g, kind };
  }

  private finish(job: NonNullable<Streamer['job']>) {
    if (job.kind === 'build') { job.d.built = true; this.stats.built++; if (!job.d.bake) job.d.baked = true; }
    else { job.d.baked = true; this.stats.baked++; }
  }

  /** Call every frame with Millie's position. */
  update(x: number, z: number) {
    for (const d of this.districts) {
      const dist = distToBounds(d.bounds, x, z);
      if (d.state === 'live' && dist > this.far) d.state = 'standin';
      else if (d.state === 'standin' && dist < this.near) d.state = 'live';
      if (d.build && d.unload && d.built && dist > this.unloadAt && this.job?.d !== d) {
        d.unload();
        this.grid.removeDistrict(d.id);
        d.built = false; d.baked = false;
        this.stats.unloaded++;
      }
      const show = d.state === 'live' && d.built;
      d.root.visible = show;
      if (d.standin) d.standin.visible = !show;
    }
    // Background work under the time budget.
    const t0 = performance.now();
    while (performance.now() - t0 < this.budgetMs) {
      if (!this.job) this.job = this.nextJob(x, z);
      if (!this.job) break;
      const ts = performance.now();
      const done = this.job.g.next().done;
      const sm = performance.now() - ts;
      if (sm > this.stats.maxStepMs) { this.stats.maxStepMs = sm; this.stats.maxStepKind = `${this.job.kind} ${this.job.d.id}`; }
      if (done) { this.finish(this.job); this.job = null; }
    }
    const ms = performance.now() - t0;
    this.stats.lastSliceMs = ms;
    this.stats.maxSliceMs = Math.max(this.stats.maxSliceMs, ms);
  }

  /** Steps that build and bake everything within `near` of (x, z): for the loading screen. */
  *warm(x: number, z: number): Generator<number, void, void> {
    // Finish whatever update() was in the middle of first, so no district is built twice.
    if (this.job) {
      while (!this.job.g.next().done) yield 0;
      this.finish(this.job);
      this.job = null;
    }
    const todo = this.districts.filter((d) => distToBounds(d.bounds, x, z) < this.near && (!d.built || !d.baked));
    let done = 0;
    for (const d of todo) {
      if (!d.built && d.build) { const g = d.build(); while (!g.next().done) yield done / todo.length; d.built = true; this.stats.built++; }
      if (!d.baked && d.bake) { const g = d.bake(); while (!g.next().done) yield done / todo.length; this.stats.baked++; }
      d.baked = true;
      done++;
      yield done / todo.length;
    }
  }

  get busy() { return !!this.job; }
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
