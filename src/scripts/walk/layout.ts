/*
  Portable town layout loader and procedural district builders (Phase 2).
  JSON layout files (data/*.json) are the single source of truth for district
  bounds, zones, streets, building blocks, pavilions, landmarks and POIs,
  shared by the 3D builders, colliders, stand-ins and minimap.
*/
import * as THREE from 'three';
import seafrontRaw from './data/seafront.json';
import { M } from './models';
import { vcMaterial } from './bake';
import { DirectBuilder } from './meshbuilder';
import type { BoxCollider } from './level';

export type Face = '+x' | '-x' | '+z' | '-z';
export type FacadeStyle = 'catalan' | 'rambla' | 'industrial';

export interface BoundsData {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface ZoneDef {
  id: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  mapColor: string;
}

export interface StreetDef {
  id: string;
  name: string;
  width: number;
  surface: string;
  points: [number, number][];
}

export interface BlockDef {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  floors: number;
  baseY?: number;
  color: string;
  roofColor: string;
  shutterColor: string;
  facadeStyle: FacadeStyle;
  faces: Face[];
  groundFloor: boolean;
  /**
    Ranges along a face (x for ±z faces, z for ±x faces) where the generated ground
    floor is left plain so a hand-built shop front can go there instead.
  */
  groundFloorSkip?: [number, number][];
}

export interface PavilionDef {
  id: string;
  title: string;
  sub: string;
  href: string;
  color: string;
  x: number;
  w: number;
  z0: number;
  z1: number;
  dark?: boolean;
}

export interface LandmarkDef {
  id: string;
  label: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  height: number;
  baseY?: number;
  alwaysVisible?: boolean;
  color: string;
  roofColor: string;
}

export interface PoiDef {
  id: string;
  kind: string;
  label: string;
  x: number;
  z: number;
  color: string;
}

export interface DistrictData {
  id: string;
  label: string;
  bounds: BoundsData;
  streets: StreetDef[];
  blocks: BlockDef[];
  pavilions: PavilionDef[];
  landmarks: LandmarkDef[];
  pois: PoiDef[];
}

export interface TownLayout {
  version: number;
  units: string;
  mapBounds: BoundsData;
  swim: { x0: number; x1: number; z: number; shoreZ: number };
  pipica: { x0: number; x1: number; z0: number; z1: number; gateZ0: number; gateZ1: number };
  pipica2: { x0: number; x1: number; z0: number; z1: number; gateZ0: number; gateZ1: number };
  pipica3: { x0: number; x1: number; z0: number; z1: number; gateZ0: number; gateZ1: number };
  pipica4: { x0: number; x1: number; z0: number; z1: number; gateZ0: number; gateZ1: number };
  pipica5?: { x0: number; x1: number; z0: number; z1: number; gateZ0: number; gateZ1: number };
  pipica6?: { x0: number; x1: number; z0: number; z1: number; gateZ0: number; gateZ1: number };
  pipica7?: { x0: number; x1: number; z0: number; z1: number; gateZ0: number; gateZ1: number };
  pier: { x0: number; x1: number; root: number; rise: number; end: number; high: number };
  ramps: number[];
  tracks: number[];
  /** The metro entrance: an open stairwell on the Rambla going down toward +x from its head at x0. */
  metro: MetroDef;
  zones: ZoneDef[];
  districts: DistrictData[];
}

export interface MetroDef { x0: number; x1: number; z0: number; z1: number; depth: number; line: string; lineColor: string }

export const SEAFRONT_LAYOUT = seafrontRaw as unknown as TownLayout;

export const parseHex = (hex: string) => parseInt(hex.replace('#', ''), 16);

export interface InstanceSink {
  add(
    key: string,
    geo: THREE.BufferGeometry | (() => THREE.BufferGeometry),
    mat: THREE.Material | (() => THREE.Material),
    m: THREE.Matrix4,
    cast?: boolean,
  ): void;
}

export interface BlockBuildCtx {
  groundY: number;
  builder: DirectBuilder;
  wallMat: THREE.MeshStandardMaterial;
  inst: InstanceSink;
  boxes: BoxCollider[];
  litWindowMat: THREE.Material;
  darkWindowMat: THREE.Material;
  ironMat: THREE.Material;
  r: () => number;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const mtx = (x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) =>
  tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromEuler(tmpE.set(rx, ry, rz)), tmpS.set(sx, sy, sz));

const faceRot = (f: Face) => (f === '+z' ? 0 : f === '+x' ? Math.PI / 2 : f === '-x' ? -Math.PI / 2 : Math.PI);

const winGeo = new THREE.BoxGeometry(1.1, 2.0, 0.1);
const frameGeo = new THREE.BoxGeometry(1.36, 2.26, 0.08);
const shutterGeo = new THREE.BoxGeometry(0.56, 2.0, 0.06);
const slabGeo = new THREE.BoxGeometry(1.6, 0.12, 0.6);
const corniceGeo = new THREE.BoxGeometry(1, 0.35, 0.45);
const shopGlassGeo = new THREE.BoxGeometry(1, 2.6, 0.08);
const rollerGeo = new THREE.BoxGeometry(1, 3.0, 0.06);
const awningGeo = new THREE.BoxGeometry(1, 0.06, 1.1);
const bladeGeo = new THREE.BoxGeometry(0.06, 0.6, 0.9);
const awningCols = [0x2f6b4f, 0x8a2f2c, 0x2a5aa8, 0xb5700a, 0x3d3d45];
const bladeCols = [0xf4f1ea, 0xffb020, 0x1fc9b7, 0xe5487a];

function mergeSimple(parts: THREE.BufferGeometry[]) {
  const ps = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  let n = 0;
  for (const p of ps) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const p of ps) {
    pos.set(p.attributes.position.array as Float32Array, o * 3);
    nor.set(p.attributes.normal.array as Float32Array, o * 3);
    if (p.attributes.uv) uv.set(p.attributes.uv.array as Float32Array, o * 2);
    o += p.attributes.position.count;
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

const railGeo = (() => {
  const parts: THREE.BufferGeometry[] = [];
  const top = new THREE.BoxGeometry(1.6, 0.05, 0.05); top.translate(0, 0.95, 0.27); parts.push(top);
  const bot = new THREE.BoxGeometry(1.6, 0.04, 0.04); bot.translate(0, 0.12, 0.27); parts.push(bot);
  for (let i = 0; i <= 8; i++) {
    const b = new THREE.BoxGeometry(0.024, 0.85, 0.024);
    b.translate(-0.76 + i * 0.19, 0.53, 0.27);
    parts.push(b);
  }
  for (const sx of [-0.79, 0.79]) {
    const b = new THREE.BoxGeometry(0.03, 0.85, 0.56);
    b.translate(sx, 0.53, 0);
    parts.push(b);
  }
  return mergeSimple(parts);
})();

const rollerMat = M(0x9aa0a8, 0.5, 0.6);
const shopGlassMat = M(0x3a4d63, 0.12, 0.4);

function emitFacade(b: BlockDef, h: number, ctx: BlockBuildCtx) {
  const { groundY, inst, litWindowMat, darkWindowMat, ironMat, r } = ctx;
  const y0 = groundY + (b.baseY ?? 0);
  const color = parseHex(b.color);
  const shutter = M(parseHex(b.shutterColor), 0.7);
  const trim = M(new THREE.Color(color).multiplyScalar(0.84).getHex(), 0.9);
  const industrial = b.facadeStyle === 'industrial';
  const rambla = b.facadeStyle === 'rambla';
  const bayWidth = industrial ? 4.0 : 3.2;

  for (const f of b.faces) {
    const along = f === '+z' || f === '-z';
    const a0 = along ? b.x0 : b.z0, a1 = along ? b.x1 : b.z1;
    const fixed = f === '+z' ? b.z1 : f === '-z' ? b.z0 : f === '+x' ? b.x1 : b.x0;
    const n = f === '+z' || f === '+x' ? 1 : -1;
    const ry = faceRot(f);
    const P = (s: number, y: number, out: number): [number, number, number] =>
      along ? [s, y, fixed + n * out] : [fixed + n * out, y, s];
    const len = a1 - a0;
    const cols = Math.max(1, Math.floor(len / bayWidth));
    const pitch = len / cols;

    for (let fl = 0; fl < b.floors; fl++) {
      const y = y0 + 4.2 + fl * 3.05 + 1.15;
      for (let c = 0; c < cols; c++) {
        const s = a0 + pitch * (c + 0.5);
        const lit = r() < 0.5;
        inst.add('frame', frameGeo, trim, mtx(...P(s, y, 0.02), ry), false);
        inst.add(lit ? 'winL' : 'winD', winGeo, lit ? litWindowMat : darkWindowMat, mtx(...P(s, y, 0.05), ry), false);
        if (!industrial) {
          const off = r() < 0.6 ? 0.92 : 0.3;
          for (const side of [-1, 1]) {
            inst.add(`sh${shutter.id}`, shutterGeo, shutter, mtx(...P(s + side * off, y, 0.09), ry), false);
          }
          const hasBalcony = rambla ? r() < 0.75 : fl < b.floors - 1 || r() < 0.5;
          if (hasBalcony) {
            inst.add('slab', slabGeo, () => M(0xb4ada0, 0.85), mtx(...P(s, y - 1.08, 0.3), ry));
            inst.add('rail', railGeo, ironMat, mtx(...P(s, y - 1.08, 0.3), ry));
          }
        }
      }
    }

    inst.add('cornice', corniceGeo, trim, mtx(...P((a0 + a1) / 2, y0 + h - 0.4, 0.18), ry, len + 0.4, 1, 1));
    inst.add('band', corniceGeo, trim, mtx(...P((a0 + a1) / 2, y0 + 4.15, 0.12), ry, len, 0.6, 0.6));
    if (!b.groundFloor) continue;

    for (let c = 0; c < cols; c++) {
      const s = a0 + pitch * (c + 0.5);
      if (b.groundFloorSkip?.some(([k0, k1]) => s + pitch / 2 > k0 && s - pitch / 2 < k1)) continue;
      const kind = r();
      const shopChance = rambla ? 0.62 : 0.5;
      if (!industrial && kind < shopChance) {
        inst.add('sglass', shopGlassGeo, shopGlassMat, mtx(...P(s, y0 + 1.5, 0.04), ry, pitch * 0.82, 1, 1), false);
        if (r() < (rambla ? 0.72 : 0.6)) {
          const ac = awningCols[Math.floor(r() * awningCols.length)];
          inst.add(`aw${ac}`, awningGeo, () => M(ac, 0.8), mtx(...P(s, y0 + 3.05, 0.55), ry, pitch * 0.86, 1, 1, 0.3));
        }
        if (r() < 0.35) {
          const bc = bladeCols[Math.floor(r() * bladeCols.length)];
          inst.add('blade', bladeGeo, () => M(bc, 0.6), mtx(...P(s - pitch * 0.4, y0 + 3.6, 0.5), ry + Math.PI / 2), false);
        }
      } else if (kind < 0.85) {
        inst.add('roller', rollerGeo, rollerMat, mtx(...P(s, y0 + 1.6, 0.04), ry, pitch * 0.82, 1, 1), false);
      } else {
        inst.add('door', () => new THREE.BoxGeometry(1.3, 2.6, 0.08), () => M(0x5a4636, 0.7), mtx(...P(s, y0 + 1.35, 0.04), ry), false);
      }
    }
  }
}

export function* buildDistrictBlocksSteps(district: DistrictData, ctx: BlockBuildCtx): Generator<string, void, void> {
  const { groundY, builder, wallMat, boxes } = ctx;
  for (let i = 0; i < district.blocks.length; i++) {
    const b = district.blocks[i];
    const y0 = groundY + (b.baseY ?? 0);
    const h = 4.2 + b.floors * 3.05 + 0.6;
    builder.addBuilding(b.x0, y0, b.z0, b.x1, y0 + h, b.z1, parseHex(b.color), parseHex(b.roofColor), wallMat);
    boxes.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, top: y0 + h, kind: 'building', district: district.id });
    emitFacade(b, h, ctx);
    if ((i + 1) % 6 === 0) yield 'Buildings';
  }
}

/** Build a single vertex-colored stand-in mesh per district from its layout blocks, pavilions and landmarks. */
export function buildDistrictStandin(d: DistrictData, groundY: number): THREE.Group | undefined {
  const builder = new DirectBuilder(0, 512);
  const vcMat = vcMaterial(THREE.FrontSide, false);

  for (const b of d.blocks) {
    const y0 = groundY + (b.baseY ?? 0);
    const h = 4.2 + b.floors * 3.05 + 0.6;
    builder.addBuilding(b.x0, y0, b.z0, b.x1, y0 + h, b.z1, parseHex(b.color), parseHex(b.roofColor), vcMat);
  }
  for (const p of d.pavilions) {
    const h = 3.9;
    const bodyCol = p.dark ? 0x101933 : 0xf4f1ea;
    builder.addBuilding(p.x - p.w / 2, groundY, p.z0, p.x + p.w / 2, groundY + h, p.z1, bodyCol, 0xe9e6df, vcMat);
    builder.addBox(p.x - p.w / 2 - 0.3, groundY + h - 0.3, p.z1 + 1.9, p.x + p.w / 2 + 0.3, groundY + h + 0.25, p.z1 + 2.2, parseHex(p.color), { mat: vcMat, skipBottom: true });
  }
  for (const lm of d.landmarks) {
    if (lm.alwaysVisible) continue;
    const y0 = groundY + (lm.baseY ?? 0);
    builder.addBuilding(lm.x0, y0, lm.z0, lm.x1, y0 + lm.height, lm.z1, parseHex(lm.color), parseHex(lm.roofColor), vcMat);
  }

  const g = new THREE.Group();
  const count = builder.flush(g);
  if (!count) return undefined;
  g.visible = false;
  return g;
}
