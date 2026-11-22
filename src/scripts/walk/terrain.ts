/*
  Terrain helpers for sloped districts (Phase 4): a bilinear height grid for
  hillsides and terraces, plus stone stairways with cheek walls.
*/
import * as THREE from 'three';
import { DirectBuilder } from './meshbuilder';
import type { BoxCollider } from './level';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / Math.max(1e-5, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export class HeightGrid {
  readonly nx: number;
  readonly nz: number;
  readonly data: Float32Array;

  constructor(
    readonly x0: number,
    readonly x1: number,
    readonly z0: number,
    readonly z1: number,
    readonly cell = 2,
    defaultY = 0.12,
  ) {
    this.nx = Math.max(1, Math.round((x1 - x0) / cell));
    this.nz = Math.max(1, Math.round((z1 - z0) / cell));
    this.data = new Float32Array((this.nx + 1) * (this.nz + 1));
    this.data.fill(defaultY);
  }

  private idx(ix: number, iz: number) {
    return iz * (this.nx + 1) + ix;
  }

  /** Bilinear height sample at (x, z), clamped to grid bounds. */
  sample(x: number, z: number): number {
    const cx = clamp(x, this.x0, this.x1);
    const cz = clamp(z, this.z0, this.z1);
    const fx = ((cx - this.x0) / (this.x1 - this.x0)) * this.nx;
    const fz = ((cz - this.z0) / (this.z1 - this.z0)) * this.nz;
    const ix = Math.min(this.nx - 1, Math.floor(fx));
    const iz = Math.min(this.nz - 1, Math.floor(fz));
    const tx = fx - ix;
    const tz = fz - iz;
    const h00 = this.data[this.idx(ix, iz)];
    const h10 = this.data[this.idx(ix + 1, iz)];
    const h01 = this.data[this.idx(ix, iz + 1)];
    const h11 = this.data[this.idx(ix + 1, iz + 1)];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  }

  /** Set every grid vertex inside [rx0, rx1] × [rz0, rz1] from `fn`. */
  setRect(rx0: number, rx1: number, rz0: number, rz1: number, fn: (x: number, z: number) => number) {
    const dx = (this.x1 - this.x0) / this.nx;
    const dz = (this.z1 - this.z0) / this.nz;
    for (let iz = 0; iz <= this.nz; iz++) {
      const z = this.z0 + iz * dz;
      if (z < rz0 - 1e-4 || z > rz1 + 1e-4) continue;
      for (let ix = 0; ix <= this.nx; ix++) {
        const x = this.x0 + ix * dx;
        if (x < rx0 - 1e-4 || x > rx1 + 1e-4) continue;
        this.data[this.idx(ix, iz)] = fn(x, z);
      }
    }
  }

  /** Smoothly blend grid heights toward `fn` across `margin` meters around the rect. */
  blendRect(rx0: number, rx1: number, rz0: number, rz1: number, margin: number, fn: (x: number, z: number) => number) {
    const dx = (this.x1 - this.x0) / this.nx;
    const dz = (this.z1 - this.z0) / this.nz;
    for (let iz = 0; iz <= this.nz; iz++) {
      const z = this.z0 + iz * dz;
      if (z < rz0 - margin || z > rz1 + margin) continue;
      for (let ix = 0; ix <= this.nx; ix++) {
        const x = this.x0 + ix * dx;
        if (x < rx0 - margin || x > rx1 + margin) continue;
        const ex = Math.max(rx0 - x, 0, x - rx1);
        const ez = Math.max(rz0 - z, 0, z - rz1);
        const dist = Math.hypot(ex, ez);
        if (dist >= margin) continue;
        const w = 1 - smoothstep(0, margin, dist);
        const i = this.idx(ix, iz);
        this.data[i] = this.data[i] * (1 - w) + fn(x, z) * w;
      }
    }
  }

  /** Build a vertex-colored terrain mesh with world-meter UVs. */
  buildMesh(mat: THREE.Material, colorFn: (x: number, y: number, z: number) => number, uvTile = 6): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(this.x1 - this.x0, this.z1 - this.z0, this.nx, this.nz);
    geo.rotateX(-Math.PI / 2);
    geo.translate((this.x0 + this.x1) / 2, 0, (this.z0 + this.z1) / 2);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.sample(x, z);
      pos.setY(i, y);
      uv.setXY(i, x / uvTile, -z / uvTile);
      c.setHex(colorFn(x, y, z));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.userData.baked = true; // keep vertex colors and smooth terrain normals out of bakeSteps
    return mesh;
  }
}

export interface StairDef {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y0: number;
  y1: number;
  steps: number;
  wallColor?: number;
  stepColor?: number;
  wallHeight?: number;
}

/** Smooth ramp height inside a stairway along +Z, or null outside. */
export function stairFloor(s: StairDef, x: number, z: number): number | null {
  if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) return null;
  const t = clamp((z - s.z0) / Math.max(1e-5, s.z1 - s.z0), 0, 1);
  return s.y0 + t * (s.y1 - s.y0);
}

/** Emit stone treads, solid risers and stepped cheek walls into a DirectBuilder. */
export function addStairsToBuilder(
  builder: DirectBuilder,
  s: StairDef,
  addBox: (b: Omit<BoxCollider, 'district'>) => void,
) {
  const stepColor = s.stepColor ?? 0xd2c6b2;
  const wallColor = s.wallColor ?? 0xb8aa94;
  const wallH = s.wallHeight ?? 0.9;
  const dz = (s.z1 - s.z0) / s.steps;
  const dy = (s.y1 - s.y0) / s.steps;

  for (let i = 0; i < s.steps; i++) {
    const z0 = s.z0 + i * dz;
    const z1 = z0 + dz;
    const yTop = s.y0 + (i + 1) * dy;
    const yBot = Math.max(s.y0 - 0.5, s.y0 + i * dy - 0.65);
    builder.addBox(s.x0, yBot, z0, s.x1, yTop, z1, stepColor, { skipBottom: true });
  }

  // Cheek walls: stepped low stone parapets along both edges of the stairway.
  const tiers = Math.max(4, Math.round(s.steps / 3));
  const tdz = (s.z1 - s.z0) / tiers;
  const tdy = (s.y1 - s.y0) / tiers;
  for (let i = 0; i < tiers; i++) {
    const z0 = s.z0 + i * tdz;
    const z1 = z0 + tdz;
    const yTop = s.y0 + (i + 1) * tdy + wallH;
    const yBot = Math.max(s.y0 - 0.5, s.y0 + i * tdy - 0.65);
    builder.addBox(s.x0 - 0.35, yBot, z0, s.x0, yTop, z1, wallColor, { skipBottom: true });
    builder.addBox(s.x1, yBot, z0, s.x1 + 0.35, yTop, z1, wallColor, { skipBottom: true });
  }

  addBox({ x0: s.x0 - 0.35, x1: s.x0, z0: s.z0, z1: s.z1, top: s.y1 + wallH, kind: 'wall' });
  addBox({ x0: s.x1, x1: s.x1 + 0.35, z0: s.z0, z1: s.z1, top: s.y1 + wallH, kind: 'wall' });
}
