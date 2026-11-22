/*
  Direct chunked geometry builder for static level geometry and stand-ins.
  Accumulates non-indexed triangles directly into chunked, vertex-colored
  material buckets so large static geometry never spawns intermediate
  Three.js Mesh/BoxGeometry objects only to discard them in bakeSteps().
*/
import * as THREE from 'three';
import { vcMaterial } from './bake';

interface Bucket {
  mat: THREE.Material;
  cast: boolean;
  receive: boolean;
  pos: number[];
  nor: number[];
  uv: number[];
  col: number[];
}

export interface BoxBuildOpts {
  cast?: boolean;
  receive?: boolean;
  mat?: THREE.MeshStandardMaterial;
  uvTile?: number;
  skipBottom?: boolean;
}

const tmpCol = new THREE.Color();

function pushQuad(
  b: Bucket,
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  nx: number, ny: number, nz: number,
  u0: number, v0: number, u1: number, v1: number,
  r: number, g: number, bl: number,
) {
  b.pos.push(
    p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2],
    p0[0], p0[1], p0[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2],
  );
  for (let i = 0; i < 6; i++) {
    b.nor.push(nx, ny, nz);
    b.col.push(r, g, bl);
  }
  b.uv.push(
    u0, v0, u1, v0, u1, v1,
    u0, v0, u1, v1, u0, v1,
  );
}

export class DirectBuilder {
  private buckets = new Map<string, Bucket>();

  constructor(readonly originZ = 0, readonly chunkSize = 36) {}

  private bucket(cxWorld: number, czWorld: number, mat: THREE.Material, matKey: string, cast: boolean, receive: boolean): Bucket {
    const cx = Math.floor(cxWorld / this.chunkSize);
    const cz = Math.floor((czWorld - this.originZ) / this.chunkSize);
    const key = `${matKey}|${cast}|${receive}|${cx},${cz}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { mat, cast, receive, pos: [], nor: [], uv: [], col: [] };
      this.buckets.set(key, b);
    }
    return b;
  }

  private pushWalls(
    b: Bucket,
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    tile: number,
    r: number, g: number, bl: number,
  ) {
    const v0 = y0 / tile, v1 = y1 / tile;
    // +Z
    pushQuad(b, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, x0 / tile, v0, x1 / tile, v1, r, g, bl);
    // -Z
    pushQuad(b, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, x0 / tile, v0, x1 / tile, v1, r, g, bl);
    // +X
    pushQuad(b, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, z0 / tile, v0, z1 / tile, v1, r, g, bl);
    // -X
    pushQuad(b, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, z0 / tile, v0, z1 / tile, v1, r, g, bl);
  }

  addBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, colorHex: number, opts: BoxBuildOpts = {}) {
    const mat = opts.mat ?? vcMaterial(THREE.FrontSide, false);
    const matKey = opts.mat ? opts.mat.uuid : 'vcFront';
    const cast = opts.cast ?? true;
    const receive = opts.receive ?? true;
    const tile = opts.uvTile ?? 6;
    const b = this.bucket((x0 + x1) * 0.5, (z0 + z1) * 0.5, mat, matKey, cast, receive);
    tmpCol.setHex(colorHex);
    const { r, g, b: bl } = tmpCol;
    this.pushWalls(b, x0, y0, z0, x1, y1, z1, tile, r, g, bl);
    // +Y top
    pushQuad(b, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, x0 / tile, -z1 / tile, x1 / tile, -z0 / tile, r, g, bl);
    // -Y bottom
    if (!opts.skipBottom) {
      pushQuad(b, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0, -1, 0, x0 / tile, z0 / tile, x1 / tile, z1 / tile, r, g, bl);
    }
  }

  /** Add a building with vertex-colored plaster walls and a separate vertex-colored roof material. */
  addBuilding(
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    wallColorHex: number, roofColorHex: number,
    wallMat: THREE.MeshStandardMaterial,
    opts: { cast?: boolean; receive?: boolean; uvTile?: number } = {},
  ) {
    const cx = (x0 + x1) * 0.5, cz = (z0 + z1) * 0.5;
    const cast = opts.cast ?? true;
    const receive = opts.receive ?? true;
    const tile = opts.uvTile ?? 6;

    const wb = this.bucket(cx, cz, wallMat, wallMat.uuid, cast, receive);
    tmpCol.setHex(wallColorHex);
    this.pushWalls(wb, x0, y0, z0, x1, y1, z1, tile, tmpCol.r, tmpCol.g, tmpCol.b);

    const roofMat = vcMaterial(THREE.FrontSide, false);
    const rb = this.bucket(cx, cz, roofMat, 'vcFront', cast, receive);
    tmpCol.setHex(roofColorHex);
    pushQuad(rb, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, x0 / tile, -z1 / tile, x1 / tile, -z0 / tile, tmpCol.r, tmpCol.g, tmpCol.b);
  }

  *flushSteps(target: THREE.Object3D): Generator<void, number, void> {
    let count = 0;
    for (const b of this.buckets.values()) {
      if (!b.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, b.mat);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      mesh.userData.baked = true;
      target.add(mesh);
      count++;
      yield;
    }
    this.buckets.clear();
    return count;
  }

  flush(target: THREE.Object3D): number {
    const g = this.flushSteps(target);
    for (;;) {
      const r = g.next();
      if (r.done) return r.value;
    }
  }
}
