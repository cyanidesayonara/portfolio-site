/*
  The seafront level, laid out from photos of a real Catalan coastal town.
  Meters; +Y up; the sea lies toward −Z so the default camera looks out to it.

    z 100 .. 34   town: Carrer del Mar (narrow, dark flagstones, steel arches)
                  with side streets at z 50–56, 68–74 and 86–92 that hide quests
    z  34 .. 14   the Rambla: a wide slab boulevard, two rows of date palms,
                  cast-iron lanterns, café terraces under square umbrellas
    z  14 ..  4   the R1 railway at grade, fenced, crossed by a sunken underpass
    z   4 .. −10  the seafront promenade (light concrete, spotlight masts)
    z −10 .. −20  a wooden boardwalk with the project pavilions
    z −20 .. −60  the beach, then the sea; the old oil pier runs out at x −48

  Borders: works at the street ends, rock breakwaters, the railway fences and
  deep water.
*/
import * as THREE from 'three';
import type { Obstacle } from './leash';
import { bakeStatic } from './bake';
import {
  M, box, cyl, rod, shadowed,
  makeBench, makeBollard, makeBin, makeContainers, makeKiosk, makeBeachUmbrella, makeTowel,
  makeLifeguardTower, makeHeras, makeCone, makeBarrier, makeSkip, makeExcavator, makeFountain,
  makeWaterBowl, makeHurdle, makeSandMound, makeMonkeyStatue, makeDimoni, makeCafeSet,
} from './models';
import {
  makeLanternPost, makeSpotMast, makeTerrace, makeTamarisk, makeDatePalm, makeChimney, makeXemeneies,
  makeArch, makeBunting, makePierLeg, makeBeaconMast, railFenceGeometry,
} from './props';
import {
  panotTextures, sandTexture, deckTexture, plasterTexture, waterNormalTexture, signTexture, rng,
  slabTexture, flagstoneTexture, concreteTexture, wallPanelTexture, tileFloorTexture, muralTexture, paintTexture,
} from './textures';

export interface BoxCollider { x0: number; x1: number; z0: number; z1: number; top: number; minY?: number; kind: string; face?: [number, number] }
export interface CircleCollider {
  x: number; z: number; r: number; top: number; minY?: number; maxY?: number;
  kind: string; canPee: boolean; canWhirl: boolean; marked: boolean; obstacle?: Obstacle;
}
export interface Stop { id: string; label: string; kind: string; href: string; color: string; x: number; z: number; r: number }
export interface Mound { x: number; z: number; name: string; dug: boolean; mesh: THREE.Object3D; loot: THREE.Object3D }
export type Surface = 'paving' | 'sand' | 'water' | 'deck';

export const GROUND_Y = 0.12;
export const RAMBLA_Y = GROUND_Y;
export const WATER_Y = -1.6;
const SAND_Y = -0.4;
export const TRAIN_Y = GROUND_Y + 0.35;
export const TRAIN_Z = 9;
const CUT = { x: 3, tunnelX: 2, rambla0: 22, rambla1: 14, sea0: 4, sea1: -4, floor: -2.7 };
const RAMPS = [-64, -40, -23, 6, 21, 34, 46, 64];
const PIER = { x0: -50, x1: -46, root: -10, rise: -30, end: -130, high: 1.2 };
export const PIPICA = { x0: 60, x1: 80, z0: -34, z1: -22.5, gateZ0: -29.2, gateZ1: -26.8 };

const sandFloor = (z: number) => (z > -24 ? SAND_Y : SAND_Y - (-24 - z) * 0.035);
const pierDeckY = (z: number) => (z > PIER.root ? GROUND_Y : z > PIER.rise ? GROUND_Y + ((PIER.root - z) / (PIER.root - PIER.rise)) * (PIER.high - GROUND_Y) : PIER.high);

// ---- Instancing collector -------------------------------------------------------------
class Instancer {
  private sets = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; mats: THREE.Matrix4[]; cast: boolean }>();
  add(key: string, geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4, cast = true) {
    let s = this.sets.get(key);
    if (!s) { s = { geo, mat, mats: [], cast }; this.sets.set(key, s); }
    s.mats.push(m.clone());
  }
  build(root: THREE.Object3D) {
    this.sets.forEach((s) => {
      const im = new THREE.InstancedMesh(s.geo, s.mat, s.mats.length);
      s.mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = s.cast;
      im.receiveShadow = true;
      root.add(im);
    });
  }
}
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
const mtx = (x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) =>
  tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromEuler(tmpE.set(rx, ry, rz)), tmpS.set(sx, sy, sz));

function mergeGeos(parts: THREE.BufferGeometry[]) {
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
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Ground plane with UVs in world meters, optional height function. */
function ground(x0: number, x1: number, z0: number, z1: number, y: number, mat: THREE.Material, tile: number, segX = 1, segZ = 1, heightFn?: (x: number, z: number) => number) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    uv.setXY(i, x / tile, -z / tile);
    if (heightFn) pos.setY(i, heightFn(x, z));
  }
  if (heightFn) geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

// Facade colors seen on the Rambla and Carrer del Mar: ochre, coral, cream, brick.
const FACADES = [0xe3b45c, 0xd9705a, 0xeadcc0, 0xe8d4a8, 0xc8735a, 0xefe4cc, 0xd9b48a, 0xb9c3c9, 0xf2e9d8];
const ROOFS = [0xa87561, 0xb88566, 0x9a8a78, 0xc2997a];
const SHUTTERS = [0x5f7a5a, 0x6b5a48, 0x4f6f7a, 0x8a5a3c, 0x7a8a6a];

export interface LevelOpts { coriolisTex: THREE.Texture }

export function buildLevel(scene: THREE.Scene, opts: LevelOpts) {
  const root = new THREE.Group();
  scene.add(root);
  const inst = new Instancer();
  const boxes: BoxCollider[] = [];
  const circles: CircleCollider[] = [];
  const lampSpots: THREE.Vector3[] = [];
  const lampGlass: THREE.MeshStandardMaterial[] = [];
  const wetMats: THREE.MeshStandardMaterial[] = [];
  const litWindowMat = new THREE.MeshStandardMaterial({ color: 0x2c3850, roughness: 0.25, metalness: 0.2, emissive: 0xffd27a, emissiveIntensity: 0 });
  const darkWindowMat = new THREE.MeshStandardMaterial({ color: 0x2c3850, roughness: 0.25, metalness: 0.2 });
  const r = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const ironM = M(0x2a2f3d, 0.5, 0.5);

  const place = (o: THREE.Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    root.add(o);
    return o;
  };
  const addCircle = (x: number, z: number, rr: number, top: number, kind: string, canPee: boolean, canWhirl: boolean, extra: Partial<CircleCollider> = {}) => {
    const c: CircleCollider = { x, z, r: rr, top, kind, canPee, canWhirl, marked: false, ...extra };
    if (canWhirl || kind === 'palm' || kind === 'tree') c.obstacle = { x, z, r: rr, kind: 'pole' };
    else if (['bench', 'bollard', 'bin', 'fountain', 'umbrella'].includes(kind)) c.obstacle = { x, z, r: rr, kind: 'furniture' };
    circles.push(c);
    return c;
  };
  const addLamp = (lamp: { group: THREE.Group; glass: THREE.MeshStandardMaterial; lightY: number; radius: number }, x: number, y: number, z: number, ry = 0, minY?: number) => {
    place(lamp.group, x, y, z, ry);
    lampGlass.push(lamp.glass);
    lampSpots.push(new THREE.Vector3(x, y + lamp.lightY, z));
    addCircle(x, z, lamp.radius, y + 9, 'lamp', true, true, minY !== undefined ? { minY } : {});
  };

  const stops0: Stop[] = [];
  // ---- Ground materials -------------------------------------------------------------
  const slab = slabTexture();
  const slabMat = new THREE.MeshStandardMaterial({ map: slab.map, roughness: 0.9 });
  const flag = flagstoneTexture();
  const flagMat = new THREE.MeshStandardMaterial({ map: flag.map, roughness: 0.85 });
  const panot = panotTextures();
  const panotMat = new THREE.MeshStandardMaterial({ map: panot.map, bumpMap: panot.bumpMap, bumpScale: 1.2, roughness: 0.92 });
  const conc = concreteTexture();
  const concMat = new THREE.MeshStandardMaterial({ map: conc.map, roughness: 0.9 });
  const sandMat = new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 });
  const deckMap = deckTexture();
  const deckMat = new THREE.MeshStandardMaterial({ map: deckMap, roughness: 0.85, color: 0xb9ab9a });
  wetMats.push(slabMat, flagMat, panotMat, concMat);
  const plaster = plasterTexture();

  // Town: flagstones down Carrer del Mar, panots in the side streets.
  root.add(ground(-3.5, 3.5, 34, 101, GROUND_Y + 0.002, flagMat, flag.tileMeters));
  root.add(ground(-41, 41, 34, 101, GROUND_Y, panotMat, panot.tileMeters));
  // A drainage line down the middle of Carrer del Mar.
  const drain = box(0.25, 0.01, 64, M(0x2a2b2e, 0.6, 0.4));
  drain.position.set(0, GROUND_Y + 0.008, 66);
  root.add(drain);
  // The Rambla's slabs, the promenade's concrete, the boardwalk's planks.
  // Leave holes where the underpass cuts down below street level.
  root.add(ground(-140, 140, CUT.rambla0, 34, GROUND_Y, slabMat, slab.tileMeters));
  root.add(ground(-140, -CUT.x, 14, CUT.rambla0, GROUND_Y, slabMat, slab.tileMeters));
  root.add(ground(CUT.x, 140, 14, CUT.rambla0, GROUND_Y, slabMat, slab.tileMeters));
  root.add(ground(-140, 140, -10, CUT.sea1, GROUND_Y, concMat, conc.tileMeters));
  root.add(ground(-140, -CUT.x, CUT.sea1, 4, GROUND_Y, concMat, conc.tileMeters));
  root.add(ground(CUT.x, 140, CUT.sea1, 4, GROUND_Y, concMat, conc.tileMeters));
  const deck = ground(-140, 140, -20, -10, GROUND_Y + 0.01, deckMat, 3);
  root.add(deck);
  // Beach, under the sea too.
  root.add(ground(-160, 160, -120, -20, 0, sandMat, 6, 1, 50, (_x, z) => sandFloor(z)));
  const wet = ground(-160, 160, -62, -54, 0, new THREE.MeshStandardMaterial({ color: 0x8a6c44, roughness: 0.5, transparent: true, opacity: 0.4 }), 4, 1, 8, (_x, z) => sandFloor(z) + 0.012);
  root.add(wet);
  // The step down from the boardwalk to the sand: a low white concrete wall.
  const stepWall = box(280, 0.56, 0.4, M(0xeeebe4, 0.8));
  stepWall.position.set(0, GROUND_Y - 0.26, -20.1);
  root.add(stepWall);
  for (const rx of RAMPS) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(3.2, 0); shape.lineTo(0, 0.52); shape.closePath();
    const rg = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
    const rm = new THREE.Mesh(rg, M(0xe2ddd2, 0.9));
    rm.rotation.y = Math.PI / 2;
    rm.position.set(rx - 1.5, SAND_Y, -20.3);
    rm.receiveShadow = true;
    root.add(rm);
  }

  // The sea.
  const waterNormal = waterNormalTexture();
  waterNormal.repeat.set(70, 70);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2f8fb0, roughness: 0.14, metalness: 0.1, normalMap: waterNormal, normalScale: new THREE.Vector2(0.6, 0.6),
    transparent: true, opacity: 0.9,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1000), waterMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, WATER_Y, -540);
  root.add(sea);
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(320, 1.4), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, WATER_Y + 0.03, -57.4);
  root.add(foam);

  // ---- Buildings ----------------------------------------------------------------------
  type Face = '+x' | '-x' | '+z' | '-z';
  const plasterMats = new Map<number, THREE.MeshStandardMaterial>();
  const facadeMat = (c: number) => {
    let m = plasterMats.get(c);
    if (!m) { m = new THREE.MeshStandardMaterial({ color: c, map: plaster, roughness: 0.92 }); plasterMats.set(c, m); }
    return m;
  };
  const winGeo = new THREE.BoxGeometry(1.1, 2.0, 0.1);
  const frameGeo = new THREE.BoxGeometry(1.36, 2.26, 0.08);
  const shutterGeo = new THREE.BoxGeometry(0.56, 2.0, 0.06);
  const slabGeo = new THREE.BoxGeometry(1.6, 0.12, 0.6);
  const railGeo = (() => {
    const parts: THREE.BufferGeometry[] = [];
    const top = new THREE.BoxGeometry(1.6, 0.05, 0.05); top.translate(0, 0.95, 0.27); parts.push(top);
    const bot = new THREE.BoxGeometry(1.6, 0.04, 0.04); bot.translate(0, 0.12, 0.27); parts.push(bot);
    for (let i = 0; i <= 8; i++) { const b = new THREE.BoxGeometry(0.024, 0.85, 0.024); b.translate(-0.76 + i * 0.19, 0.53, 0.27); parts.push(b); }
    for (const sx of [-0.79, 0.79]) { const b = new THREE.BoxGeometry(0.03, 0.85, 0.56); b.translate(sx, 0.53, 0); parts.push(b); }
    return mergeGeos(parts);
  })();
  const corniceGeo = new THREE.BoxGeometry(1, 0.35, 0.45);
  const shopGlassGeo = new THREE.BoxGeometry(1, 2.6, 0.08);
  const rollerGeo = new THREE.BoxGeometry(1, 3.0, 0.06);
  const awningGeo = new THREE.BoxGeometry(1, 0.06, 1.1);
  const bladeGeo = new THREE.BoxGeometry(0.06, 0.6, 0.9);
  const rollerMat = M(0x9aa0a8, 0.5, 0.6);
  const shopGlassMat = M(0x3a4d63, 0.12, 0.4);
  const faceRot = (f: Face) => (f === '+z' ? 0 : f === '+x' ? Math.PI / 2 : f === '-x' ? -Math.PI / 2 : Math.PI);
  const awningCols = [0x2f6b4f, 0x8a2f2c, 0x2a5aa8, 0xb5700a, 0x3d3d45];

  /** A building block with facade detail (windows, shutters, balconies, shops) on the listed faces. */
  const building = (x0: number, x1: number, z0: number, z1: number, floors: number, color: number, faces: Face[], groundFloor = true) => {
    const h = 4.2 + floors * 3.05 + 0.6;
    const roof = M(pick(ROOFS), 0.95);
    const fm = facadeMat(color);
    const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), [fm, fm, roof, roof, fm, fm]);
    b.position.set((x0 + x1) / 2, GROUND_Y + h / 2, (z0 + z1) / 2);
    b.castShadow = true;
    b.receiveShadow = true;
    root.add(b);
    boxes.push({ x0, x1, z0, z1, top: GROUND_Y + h, kind: 'building' });
    const shutter = M(pick(SHUTTERS), 0.7);
    const trim = M(new THREE.Color(color).multiplyScalar(0.84).getHex(), 0.9);
    for (const f of faces) {
      const along = f === '+z' || f === '-z';
      const a0 = along ? x0 : z0, a1 = along ? x1 : z1;
      const fixed = f === '+z' ? z1 : f === '-z' ? z0 : f === '+x' ? x1 : x0;
      const n = f === '+z' || f === '+x' ? 1 : -1;
      const ry = faceRot(f);
      const P = (s: number, y: number, out: number): [number, number, number] => (along ? [s, y, fixed + n * out] : [fixed + n * out, y, s]);
      const tangentSign = f === '+z' || f === '-x' ? 1 : -1;
      const len = a1 - a0;
      const cols = Math.max(1, Math.floor(len / 3.2));
      const pitch = len / cols;
      for (let fl = 0; fl < floors; fl++) {
        const y = GROUND_Y + 4.2 + fl * 3.05 + 1.15;
        for (let c = 0; c < cols; c++) {
          const s = a0 + pitch * (c + 0.5);
          const lit = r() < 0.5;
          inst.add('frame', frameGeo, trim, mtx(...P(s, y, 0.02), ry), false);
          inst.add(lit ? 'winL' : 'winD', winGeo, lit ? litWindowMat : darkWindowMat, mtx(...P(s, y, 0.05), ry), false);
          const off = r() < 0.6 ? 0.92 : 0.3;
          for (const side of [-1, 1]) {
            const sp = P(s + side * off * tangentSign * (along ? 1 : 1), y, 0.09);
            if (!along) sp[2] = s + side * off;
            else sp[0] = s + side * off;
            inst.add(`sh${shutter.id}`, shutterGeo, shutter, mtx(...sp, ry), false);
          }
          if (fl < floors - 1 || r() < 0.5) {
            inst.add('slab', slabGeo, M(0xb4ada0, 0.85), mtx(...P(s, y - 1.08, 0.3), ry));
            inst.add('rail', railGeo, ironM, mtx(...P(s, y - 1.08, 0.3), ry));
          }
        }
      }
      inst.add('cornice', corniceGeo, trim, mtx(...P((a0 + a1) / 2, GROUND_Y + h - 0.4, 0.18), ry, len + 0.4, 1, 1));
      inst.add('band', corniceGeo, trim, mtx(...P((a0 + a1) / 2, GROUND_Y + 4.15, 0.12), ry, len, 0.6, 0.6));
      if (!groundFloor) continue;
      for (let c = 0; c < cols; c++) {
        const s = a0 + pitch * (c + 0.5);
        const kind = r();
        if (kind < 0.5) {
          inst.add('sglass', shopGlassGeo, shopGlassMat, mtx(...P(s, GROUND_Y + 1.5, 0.04), ry, pitch * 0.82, 1, 1), false);
          if (r() < 0.6) {
            const ac = pick(awningCols);
            inst.add(`aw${ac}`, awningGeo, M(ac, 0.8), mtx(...P(s, GROUND_Y + 3.05, 0.55), ry, pitch * 0.86, 1, 1, 0.3));
          }
          if (r() < 0.35) inst.add('blade', bladeGeo, M(pick([0xf4f1ea, 0xffb020, 0x1fc9b7, 0xe5487a]), 0.6), mtx(...P(s - pitch * 0.4, GROUND_Y + 3.6, 0.5), ry + Math.PI / 2), false);
        } else if (kind < 0.85) {
          inst.add('roller', rollerGeo, rollerMat, mtx(...P(s, GROUND_Y + 1.6, 0.04), ry, pitch * 0.82, 1, 1), false);
        } else {
          inst.add('door', new THREE.BoxGeometry(1.3, 2.6, 0.08), M(0x5a4636, 0.7), mtx(...P(s, GROUND_Y + 1.35, 0.04), ry), false);
        }
      }
    }
    return b;
  };
  const fc = () => pick(FACADES);
  const fl = () => 3 + Math.floor(r() * 3);

  // Town blocks around Carrer del Mar and its side streets (A z 50–56, B 68–74, C 86–92).
  const rows: [number, number][] = [[34, 50], [56, 68], [74, 86], [92, 101]];
  for (const [za, zb] of rows) {
    for (const side of [-1, 1]) {
      const xa = side < 0 ? -41 : 3.5, xb = side < 0 ? -3.5 : 41;
      // Split each block into a couple of buildings so the roofline varies.
      const mid = side < 0 ? -20 : 20;
      const faces = (part: 'inner' | 'outer'): Face[] => {
        const f: Face[] = [];
        if (part === 'inner') f.push(side < 0 ? '+x' : '-x');
        if (za > 34) f.push('-z');
        else f.push('-z');
        if (zb < 101) f.push('+z');
        return f;
      };
      building(side < 0 ? mid : xa, side < 0 ? xb : mid, za, zb, fl(), fc(), faces('inner'));
      building(side < 0 ? xa : mid, side < 0 ? mid : xb, za, zb, fl(), fc(), faces('outer'));
    }
  }
  // Rambla frontage beyond the town grid, and the old distillery by the pier beach.
  building(41, 70, 34, 60, 4, fc(), ['-z', '-x']);
  building(70, 100, 34, 60, 5, fc(), ['-z']);
  building(-140, -95, 34, 60, 4, fc(), ['-z']);
  building(100, 140, 34, 60, 4, fc(), ['-z']);
  // The distillery: a long low cream building with red tile roofs and its chimney.
  const dist = new THREE.Group();
  const distBody = box(48, 7, 22, facadeMat(0xe6dcc6));
  distBody.position.set(0, 3.5, 0);
  dist.add(distBody);
  for (let i = 0; i < 4; i++) {
    const roofG = new THREE.CylinderGeometry(0.01, 6.5, 3, 4, 1);
    roofG.rotateY(Math.PI / 4);
    roofG.scale(1.0, 1, 2.3);
    const rf = new THREE.Mesh(roofG, M(0xb2563a, 0.9));
    rf.position.set(-18 + i * 12, 8.5, 0);
    dist.add(rf);
  }
  for (let i = 0; i < 9; i++) {
    const w = box(1.6, 2.4, 0.1, darkWindowMat);
    w.position.set(-20 + i * 5, 3.4, -11.05);
    dist.add(w);
  }
  shadowed(dist);
  place(dist, -66, GROUND_Y, 46);
  boxes.push({ x0: -90, x1: -42, z0: 35, z1: 57, top: 9, kind: 'building' });
  place(makeChimney(38), -50, GROUND_Y, 52);
  building(-95, -90, 34, 60, 3, fc(), ['-z']);
  building(-42, -41, 34, 60, 3, fc(), []);

  // Steel arches and bunting over Carrer del Mar.
  const archSign = signTexture('Carrer del Mar', 'Eix comercial', '#f4f1ea', { bg: '#2a5aa8', fg: '#f4f1ea', aspect: 1 });
  for (const z of [37, 62, 80, 97]) place(makeArch(7, archSign), 0, GROUND_Y, z);
  for (let z = 40; z < 98; z += 7) {
    root.add(makeBunting(new THREE.Vector3(-3.5, GROUND_Y + 6.2, z), new THREE.Vector3(3.5, GROUND_Y + 6.4, z + 2.5)));
  }
  for (const z of [53, 71, 89]) {
    root.add(makeBunting(new THREE.Vector3(8, GROUND_Y + 5.8, z - 3), new THREE.Vector3(8, GROUND_Y + 5.8, z + 3)));
    root.add(makeBunting(new THREE.Vector3(-8, GROUND_Y + 5.8, z - 3), new THREE.Vector3(-8, GROUND_Y + 5.8, z + 3)));
  }

  // ---- Town furniture and quest props ----------------------------------------------
  for (const z of [36, 58, 76, 94]) {
    for (const sx of [-2.6, 2.6]) {
      place(makeBollard(), sx, GROUND_Y, z);
      addCircle(sx, z, 0.12, GROUND_Y + 0.85, 'bollard', true, false);
    }
  }
  // Fanal-style lanterns along the side streets (whirlable).
  for (const [x, z] of [[-10, 50.4], [10, 55.6], [-24, 55.6], [24, 50.4], [-12, 73.6], [14, 68.4], [-26, 68.4], [-10, 86.4], [12, 91.6], [26, 86.4]]) {
    addLamp(makeLanternPost(), x, GROUND_Y, z);
  }
  place(makeContainers(), 30, GROUND_Y, 73.2, Math.PI);
  boxes.push({ x0: 22.6, x1: 30.8, z0: 72.4, z1: 74, top: GROUND_Y + 1.6, kind: 'containers' });
  for (const [x, z] of [[-30, 50.6], [28, 86.6]]) {
    place(makeBin(), x, GROUND_Y, z);
    addCircle(x, z, 0.25, GROUND_Y + 0.9, 'bin', true, false);
  }
  // A quiet bench in side street B (east) where the kid's ball rolled under.
  place(makeBench(), 24, GROUND_Y, 73.4, Math.PI);
  boxes.push({ x0: 23.1, x1: 24.9, z0: 72.9, z1: 73.9, top: GROUND_Y + 0.5, kind: 'bench', face: [0, -1] });
  // Shop signs for the quest shops.
  const sideSign = (title: string, sub: string, color: string, x: number, z: number, ry: number) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 0.1), new THREE.MeshStandardMaterial({ map: signTexture(title, sub, color, { aspect: 3.4 / 0.7 }) }));
    place(s, x, GROUND_Y + 3.4, z, ry);
  };
  const kidBalcony = box(1.8, 0.14, 0.8, M(0xb4ada0, 0.85));
  kidBalcony.position.set(-14, GROUND_Y + 4.18, 91.6);
  root.add(kidBalcony);
  for (let i = 0; i <= 8; i++) root.add(rod(new THREE.Vector3(-14.85 + i * 0.21, GROUND_Y + 4.25, 91.25), new THREE.Vector3(-14.85 + i * 0.21, GROUND_Y + 5.1, 91.25), 0.012, ironM, 4));
  root.add(rod(new THREE.Vector3(-14.9, GROUND_Y + 5.1, 91.25), new THREE.Vector3(-13.1, GROUND_Y + 5.1, 91.25), 0.025, ironM, 4));
  sideSign('Fruiteria', 'Fruita i verdura', '#8bcb3c', -12, 50.15, 0);
  sideSign('Forn de pa', 'Pa · Coques · Galetes', '#ffb020', 12, 50.15, 0);
  // Monkey-selfie mural in side street B (a nod to the real one nearby).
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), new THREE.MeshStandardMaterial({ map: paintTexture((g, w, h) => {
    g.fillStyle = '#ffb020'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1fc9b7'; g.fillRect(0, h * 0.62, w, h * 0.38);
    g.fillStyle = '#6b4a2b';
    g.beginPath(); g.ellipse(w * 0.45, h * 0.5, 40, 54, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(w * 0.45, h * 0.24, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8c79a';
    g.beginPath(); g.ellipse(w * 0.45 + 6, h * 0.26, 20, 18, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6b4a2b';
    g.save(); g.translate(w * 0.6, h * 0.22); g.rotate(-0.6); g.fillRect(-8, 0, 16, 60); g.restore();
    g.fillStyle = '#292933'; g.fillRect(w * 0.64, h * 0.08, 22, 38);
    g.fillStyle = '#ccedff'; g.fillRect(w * 0.64 + 3, h * 0.08 + 4, 16, 28);
    g.font = "800 30px 'Bricolage Grotesque Variable', system-ui, sans-serif";
    g.fillStyle = '#0b1430'; g.fillText('SELFIE!', 20, 44);
  }, 512, 205), roughness: 0.9 }));
  place(mural, 16, GROUND_Y + 3.0, 68.06, 0);

  // ---- Borders: works ------------------------------------------------------------------
  const obresLine = (x0: number, z0: number, x1: number, z1: number, cones = true, y = GROUND_Y) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 3.5));
    const ang = Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      place(makeHeras(len / n), x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, -ang);
    }
    boxes.push({ x0: Math.min(x0, x1) - 0.15, x1: Math.max(x0, x1) + 0.15, z0: Math.min(z0, z1) - 0.15, z1: Math.max(z0, z1) + 0.15, top: 9, kind: 'fence' });
    if (cones) for (let i = 0; i <= n; i += 2) {
      const t = i / n;
      place(makeCone(), x0 + (x1 - x0) * t - Math.sin(ang) * 0.9, y, z0 + (z1 - z0) * t + Math.cos(ang) * 0.9);
    }
  };
  obresLine(-3.5, 99.5, 3.5, 99.5);
  for (const z of [53, 71, 89]) {
    obresLine(-34, z - 3, -34, z + 3, false);
    obresLine(34, z - 3, 34, z + 3, false);
  }
  place(makeSkip(), 37, GROUND_Y, 71, Math.PI / 2);
  place(makeExcavator(), -38, GROUND_Y, 89, 1.2);
  place(makeBarrier(), 0, GROUND_Y, 98.3);
  obresLine(-92, 14.6, -92, 33.4);
  obresLine(92, 14.6, 92, 33.4);
  obresLine(-92, -19.6, -92, 3.6);
  obresLine(92, -19.6, 92, 3.6);
  place(makeExcavator(), 97, GROUND_Y, 22, -1.4);
  place(makeSkip(0xdb5c24), -97, GROUND_Y, 24, Math.PI / 2);
  // Rock breakwaters close the beach.
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMats = [M(0xb8b4aa, 0.95, 0, { flatShading: true }), M(0x9a968e, 0.95, 0, { flatShading: true }), M(0xc9c4b8, 0.95, 0, { flatShading: true })];
  const rocksAt = (x: number, z0: number, z1: number, wdt = 3) => {
    for (let z = z0; z > z1; z -= 1.6) {
      for (let k = 0; k < wdt; k++) {
        const s = 0.9 + r() * 0.9;
        const rock = new THREE.Mesh(rockGeo, rockMats[k % 3]);
        rock.scale.set(s * 1.2, s, s);
        rock.rotation.set(r() * 3, r() * 3, r() * 3);
        rock.position.set(x + (k - (wdt - 1) / 2) * 1.6 + (r() - 0.5), Math.max(sandFloor(z), WATER_Y - 0.6) + s * 0.5, z + (r() - 0.5));
        rock.castShadow = true;
        rock.receiveShadow = true;
        root.add(rock);
      }
    }
  };
  for (const ex of [-94, 94]) {
    rocksAt(ex, -20.5, -80);
    boxes.push({ x0: ex - 3, x1: ex + 3, z0: -90, z1: -20.3, top: 3, kind: 'rocks' });
  }

  // ---- The Rambla ---------------------------------------------------------------------
  for (const [rowZ, off] of [[31, 0], [16.6, 4]] as const) {
    for (let x = -88 + off; x <= 88; x += 8) {
      if (Math.abs(x) < 5 || (rowZ < 20 && x > 36 && x < 58)) continue;
      const palm = makeDatePalm(Math.floor(x * 13 + rowZ * 7 + 500), 10 + r() * 4);
      place(palm.group, x, GROUND_Y, rowZ);
      addCircle(x, rowZ, palm.radius, 14, 'palm', true, false);
      const pit = box(1.5, 0.02, 1.5, M(0x8a6a4a, 0.95));
      pit.position.set(x, GROUND_Y + 0.006, rowZ);
      pit.receiveShadow = true;
      root.add(pit);
    }
  }
  for (let x = -84; x <= 84; x += 16) {
    if (Math.abs(x) < 6 || (x > 36 && x < 58)) continue;
    addLamp(makeLanternPost(), x, GROUND_Y, 15.4);
    for (const dx of [-5, 5]) {
      const bx = x + dx;
      if (Math.abs(bx) < 5 || (bx > 36 && bx < 58)) continue;
      place(makeBench(), bx, GROUND_Y, 15.8, Math.PI);
      boxes.push({ x0: bx - 0.9, x1: bx + 0.9, z0: 15.4, z1: 16.1, top: GROUND_Y + 0.5, kind: 'bench', face: [0, -1] });
    }
  }
  // Café terraces under square cream umbrellas.
  const terraceSeats: { x: number; z: number; ry: number }[] = [];
  for (const tx of [-30, -24, -18, 12, 18, 24, 50, 56, -62, -68]) {
    for (const tz of [21, 26.5]) {
      if (r() < 0.25) continue;
      place(makeTerrace(), tx, GROUND_Y, tz);
      addCircle(tx, tz, 0.15, GROUND_Y + 2.4, 'umbrella', true, false);
      addCircle(tx - 0.8, tz - 0.8, 0.45, GROUND_Y + 0.8, 'table', false, false);
      addCircle(tx + 0.8, tz + 0.8, 0.45, GROUND_Y + 0.8, 'table', false, false);
      if (r() < 0.7) terraceSeats.push({ x: tx - 0.8 + 0.6, z: tz - 0.8, ry: Math.PI });
      if (r() < 0.5) terraceSeats.push({ x: tx + 0.8 - 0.6, z: tz + 0.8, ry: 0 });
    }
  }
  const fountains = [{ x: -8, z: 30 }, { x: 30, z: 18 }, { x: -44, z: -2 }, { x: 30, z: -3 }];
  for (const f of fountains) {
    place(makeFountain(), f.x, GROUND_Y, f.z, Math.PI / 2);
    addCircle(f.x, f.z, 0.25, GROUND_Y + 1.1, 'fountain', true, false);
  }
  place(makeKiosk(0x1fc9b7), 70, GROUND_Y, 24, -Math.PI / 2);
  boxes.push({ x0: 69, x1: 71, z0: 22.6, z1: 25.4, top: GROUND_Y + 2.8, kind: 'kiosk' });

  // ---- The railway at grade --------------------------------------------------------------
  const ballast = box(300, 0.18, 9.4, M(0x8e877b, 1));
  ballast.position.set(0, GROUND_Y + 0.05, TRAIN_Z);
  ballast.receiveShadow = true;
  root.add(ballast);
  for (const tz of [TRAIN_Z - 1.6, TRAIN_Z + 1.6]) {
    for (let x = -148; x < 148; x += 0.75) inst.add('sleeper', new THREE.BoxGeometry(0.24, 0.1, 2.5), M(0x7a7368, 0.9), mtx(x, GROUND_Y + 0.18, tz), false);
    for (const dz of [-0.72, 0.72]) {
      const rail = box(300, 0.12, 0.08, M(0x9aa0a8, 0.3, 0.9));
      rail.position.set(0, GROUND_Y + 0.28, tz + dz);
      root.add(rail);
    }
  }
  // Catenary: dark masts with cantilever arms on the Rambla side.
  const mastM = M(0x3a3f48, 0.5, 0.6);
  for (let x = -140; x <= 140; x += 30) {
    root.add(rod(new THREE.Vector3(x, GROUND_Y, 13.2), new THREE.Vector3(x, GROUND_Y + 7, 13.2), 0.14, mastM, 6));
    root.add(rod(new THREE.Vector3(x, GROUND_Y + 6.4, 13.2), new THREE.Vector3(x, GROUND_Y + 6.4, TRAIN_Z - 2.2), 0.06, mastM, 4));
    root.add(rod(new THREE.Vector3(x, GROUND_Y + 7.0, 13.2), new THREE.Vector3(x, GROUND_Y + 6.4, TRAIN_Z - 1), 0.04, mastM, 4));
    const weights = box(0.25, 1.2, 0.25, M(0x5a5f68, 0.6, 0.5));
    weights.position.set(x + 0.3, GROUND_Y + 4.5, 13.2);
    root.add(weights);
  }
  for (const tz of [TRAIN_Z - 1.6, TRAIN_Z + 1.6]) {
    const wire = box(300, 0.025, 0.025, M(0x3a3a40, 0.5, 0.6));
    wire.position.set(0, GROUND_Y + 5.8, tz);
    root.add(wire);
  }
  // Fences: low curb with dark vertical bars, both sides, open only at the underpass cut.
  const fenceMat = M(0x1f2a24, 0.5, 0.5);
  for (const fz of [14, 4]) {
    for (const [fx0, fx1] of [[-148, -CUT.x], [CUT.x, 148]]) {
      for (let x = fx0; x < fx1; x += 8) {
        const len = Math.min(8, fx1 - x);
        const g = mergeGeos(railFenceGeometry(len));
        const m = new THREE.Mesh(g, fenceMat);
        m.position.set(x + len / 2, GROUND_Y, fz);
        m.castShadow = true;
        root.add(m);
      }
      boxes.push({ x0: fx0, x1: fx1, z0: fz - 0.2, z1: fz + 0.2, top: 9, kind: 'fence' });
    }
  }
  // Keep everything off the tracks themselves.
  boxes.push({ x0: -148, x1: -CUT.x, z0: 4, z1: 14, top: 9, kind: 'tracks' });
  boxes.push({ x0: CUT.x, x1: 148, z0: 4, z1: 14, top: 9, kind: 'tracks' });

  // ---- The station: platforms under steel canopies, an oxblood building on the Rambla ----
  const STATION_X = 47;
  for (const [pz0, pz1] of [[11.3, 13.6], [4.4, 6.7]] as const) {
    const plat = box(48, 0.7, pz1 - pz0, M(0xbcb8ae, 0.9));
    plat.position.set(STATION_X, GROUND_Y + 0.35, (pz0 + pz1) / 2);
    plat.receiveShadow = true;
    root.add(plat);
    const edgeZ = pz0 > 8 ? pz0 + 0.15 : pz1 - 0.15;
    const edge = box(48, 0.012, 0.1, M(0xf2c230, 0.6));
    edge.position.set(STATION_X, GROUND_Y + 0.71, edgeZ);
    root.add(edge);
    const tact = box(48, 0.012, 0.5, M(0x8a8c90, 0.8));
    tact.position.set(STATION_X, GROUND_Y + 0.71, edgeZ + (pz0 > 8 ? 0.45 : -0.45));
    root.add(tact);
    for (let x = STATION_X - 20; x <= STATION_X + 20; x += 8) {
      root.add(rod(new THREE.Vector3(x, GROUND_Y + 0.7, (pz0 + pz1) / 2), new THREE.Vector3(x, GROUND_Y + 4.0, (pz0 + pz1) / 2), 0.09, M(0x8a9098, 0.5, 0.6), 4));
    }
    const canopy = box(44, 0.12, pz1 - pz0 + 1.2, M(0x9aa0a8, 0.5, 0.6));
    canopy.position.set(STATION_X, GROUND_Y + 4.05, (pz0 + pz1) / 2);
    canopy.castShadow = true;
    root.add(canopy);
    const nameSign = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.6, 0.08), new THREE.MeshStandardMaterial({ map: signTexture('Estació', 'R1', '#e5302a', { aspect: 3.2 / 0.6 }) }));
    nameSign.position.set(STATION_X + 6, GROUND_Y + 3.3, (pz0 + pz1) / 2);
    root.add(nameSign);
  }
  const station = new THREE.Group();
  const stW = 16, stD = 5.2, stH = 8;
  const oxblood = facadeMat(0x8e2f2c);
  const sBody = box(stW, stH, stD, oxblood);
  sBody.position.y = stH / 2;
  station.add(sBody);
  const creamM = M(0xe9ddc2, 0.85);
  for (let i = 0; i <= 6; i++) {
    const pil = box(0.5, stH, 0.14, creamM);
    pil.position.set(-stW / 2 + 0.25 + i * ((stW - 0.5) / 6), stH / 2, stD / 2 + 0.07);
    station.add(pil);
  }
  for (let i = 0; i < 6; i++) {
    for (const y of [1.8, 5.2]) {
      const sx = -stW / 2 + 0.25 + (i + 0.5) * ((stW - 0.5) / 6);
      const arch = box(1.3, 2.2, 0.06, creamM);
      arch.position.set(sx, y, stD / 2 + 0.05);
      station.add(arch);
      const win = box(1.0, 1.9, 0.06, i === 2 && y < 3 ? M(0x3a2a20, 0.6) : darkWindowMat);
      win.position.set(sx, y - 0.05, stD / 2 + 0.09);
      station.add(win);
    }
  }
  const corniceS = box(stW + 0.4, 0.4, stD + 0.4, creamM);
  corniceS.position.y = stH + 0.1;
  station.add(corniceS);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 3.4, 1.6, 3, 1), creamM);
  ped.rotation.set(Math.PI / 2, 0, 0);
  ped.scale.set(1, 0.2, 1);
  ped.position.set(0, stH + 1.0, stD / 2 - 0.1);
  station.add(ped);
  const stSign = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.6, 0.08), new THREE.MeshStandardMaterial({ map: signTexture('Estació', '', '#e5302a', { aspect: 4.6 / 0.6 }) }));
  stSign.position.set(0, 3.6, stD / 2 + 0.16);
  station.add(stSign);
  shadowed(station);
  place(station, STATION_X, GROUND_Y, 14.2 + stD / 2);
  boxes.push({ x0: STATION_X - stW / 2, x1: STATION_X + stW / 2, z0: 14.2, z1: 14.2 + stD, top: GROUND_Y + stH, kind: 'building' });
  stops0.push({ id: 'station', label: 'Estació', kind: 'Rodalies R1', href: '', color: '#e5302a', x: STATION_X, z: 14.2 + stD + 1, r: 0 });

  // ---- The underpass ----------------------------------------------------------------------
  const cutY = (z: number) => {
    if (z >= CUT.rambla0 || z <= CUT.sea1) return GROUND_Y;
    if (z > CUT.rambla1) return GROUND_Y + ((CUT.rambla0 - z) / (CUT.rambla0 - CUT.rambla1)) * (CUT.floor - GROUND_Y);
    if (z >= CUT.sea0) return CUT.floor;
    return CUT.floor + ((CUT.sea0 - z) / (CUT.sea0 - CUT.sea1)) * (GROUND_Y - CUT.floor);
  };
  // Sunken approaches: broad shallow steps in pinkish pavers with a ramp alongside.
  const paverMat = M(0xcdb8a0, 0.9);
  for (const [za, zb] of [[CUT.rambla0, CUT.rambla1], [CUT.sea0, CUT.sea1]] as const) {
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const z1 = za + ((zb - za) * i) / steps, z2 = za + ((zb - za) * (i + 1)) / steps;
      const yTop = cutY((z1 + z2) / 2);
      const st = box(CUT.x * 2 - 1.6, Math.max(0.05, yTop - CUT.floor + 0.05), Math.abs(z2 - z1), paverMat);
      st.position.set(-0.8, (yTop + CUT.floor) / 2, (z1 + z2) / 2);
      st.receiveShadow = true;
      root.add(st);
    }
    const rampLen = Math.hypot(za - zb, GROUND_Y - CUT.floor);
    const ramp = box(1.5, 0.1, rampLen, M(0xc4b29a, 0.9));
    ramp.position.set(CUT.x - 0.8, (GROUND_Y + CUT.floor) / 2, (za + zb) / 2);
    ramp.rotation.x = Math.atan2(GROUND_Y - CUT.floor, za - zb) * (za > zb ? 1 : -1);
    root.add(ramp);
  }
  // Grey concrete retaining walls with a timber-topped parapet.
  const wallM = M(0xa9a7a1, 0.9);
  for (const [za, zb] of [[CUT.rambla1, CUT.rambla0], [CUT.sea1, CUT.sea0]] as const) {
    for (const sx of [-CUT.x - 0.15, CUT.x + 0.15]) {
      const w = box(0.3, GROUND_Y - CUT.floor + 1.0, zb - za, wallM);
      w.position.set(sx, (CUT.floor + GROUND_Y + 1.0) / 2, (za + zb) / 2);
      w.castShadow = true;
      w.receiveShadow = true;
      root.add(w);
      const cap = box(0.16, 0.08, zb - za, M(0xc9a26b, 0.7));
      cap.position.set(sx, GROUND_Y + 1.02, (za + zb) / 2);
      root.add(cap);
      boxes.push({ x0: sx - 0.15, x1: sx + 0.15, z0: za, z1: zb, top: 9, kind: 'wall' });
    }
    const end = za === CUT.rambla1 ? CUT.rambla0 : CUT.sea1;
    void end;
  }
  // The tunnel under the tracks: stone panels on one wall, bare concrete on the other,
  // a coffered ceiling, beige tiles underfoot and a line of tubes down the middle.
  const tunnel = new THREE.Group();
  root.add(tunnel);
  const tLen = CUT.rambla1 - CUT.sea0, tMid = (CUT.rambla1 + CUT.sea0) / 2, tH = GROUND_Y - 0.25 - CUT.floor;
  const floorTex = tileFloorTexture();
  floorTex.repeat.set((CUT.tunnelX * 2) / 1.2, tLen / 1.2);
  const tFloor = new THREE.Mesh(new THREE.PlaneGeometry(CUT.tunnelX * 2, tLen + 0.4), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }));
  tFloor.rotation.x = -Math.PI / 2;
  tFloor.position.set(0, CUT.floor + 0.005, tMid);
  tFloor.receiveShadow = true;
  tunnel.add(tFloor);
  wetMats.push(tFloor.material as THREE.MeshStandardMaterial);
  const panelTex = wallPanelTexture();
  panelTex.repeat.set(tLen / 2.4, tH / 1.6);
  const panelWall = new THREE.Mesh(new THREE.PlaneGeometry(tLen, tH), new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.8 }));
  panelWall.rotation.y = Math.PI / 2;
  panelWall.position.set(-CUT.tunnelX, CUT.floor + tH / 2, tMid);
  tunnel.add(panelWall);
  const muralWall = new THREE.Mesh(new THREE.PlaneGeometry(tLen - 1, tH * 0.6), new THREE.MeshStandardMaterial({ map: muralTexture(), roughness: 0.85 }));
  muralWall.rotation.y = -Math.PI / 2;
  muralWall.position.set(CUT.tunnelX - 0.01, CUT.floor + tH * 0.5, tMid);
  tunnel.add(muralWall);
  const concWall = new THREE.Mesh(new THREE.PlaneGeometry(tLen, tH), M(0x9e9c96, 0.95, 0, { side: THREE.DoubleSide }));
  concWall.rotation.y = -Math.PI / 2;
  concWall.position.set(CUT.tunnelX, CUT.floor + tH / 2, tMid);
  tunnel.add(concWall);
  const ceil = box(CUT.tunnelX * 2 + 0.6, 0.4, tLen, M(0x8e8c86, 0.95));
  ceil.position.set(0, CUT.floor + tH + 0.2, tMid);
  ceil.castShadow = true;
  tunnel.add(ceil);
  for (let z = CUT.sea0 + 1; z < CUT.rambla1; z += 1.5) {
    const beam = box(CUT.tunnelX * 2, 0.18, 0.2, M(0x7f7d78, 0.95));
    beam.position.set(0, CUT.floor + tH - 0.09, z);
    tunnel.add(beam);
  }
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf4ff, emissiveIntensity: 1.6 });
  for (let z = CUT.sea0 + 0.8; z < CUT.rambla1 - 0.5; z += 2.2) {
    const tube = box(0.12, 0.06, 1.6, tubeMat);
    tube.position.set(0, CUT.floor + tH - 0.06, z + 0.8);
    tunnel.add(tube);
  }
  // Portal walls between the 6 m cut and the 4 m tunnel.
  for (const pz of [CUT.rambla1, CUT.sea0]) {
    for (const s of [-1, 1]) {
      const pw = box(CUT.x - CUT.tunnelX, GROUND_Y - CUT.floor + 0.3, 0.6, wallM);
      pw.position.set(s * (CUT.tunnelX + (CUT.x - CUT.tunnelX) / 2), (CUT.floor + GROUND_Y + 0.3) / 2, pz);
      root.add(pw);
    }
    const lintel = box(CUT.tunnelX * 2 + 0.2, 0.5, 0.6, wallM);
    lintel.position.set(0, GROUND_Y + 0.05, pz);
    root.add(lintel);
  }
  boxes.push({ x0: -CUT.x, x1: -CUT.tunnelX, z0: CUT.sea0, z1: CUT.rambla1, top: 9, kind: 'wall' });
  boxes.push({ x0: CUT.tunnelX, x1: CUT.x, z0: CUT.sea0, z1: CUT.rambla1, top: 9, kind: 'wall' });
  const underpassLight = new THREE.PointLight(0xeaf4ff, 0, 12, 1.4);
  underpassLight.position.set(0, CUT.floor + tH - 0.4, tMid);
  root.add(underpassLight);
  const passSign = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.55, 0.1), new THREE.MeshStandardMaterial({ map: signTexture('Platja · Pont', '', '#1fc9b7', { aspect: 4.2 / 0.55 }) }));
  passSign.position.set(0, GROUND_Y + 0.62, CUT.rambla1 + 0.31);
  root.add(passSign);
  const passSign2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.55, 0.1), new THREE.MeshStandardMaterial({ map: signTexture('Centre · Carrer del Mar', '', '#ffb020', { aspect: 4.2 / 0.55 }) }));
  passSign2.position.set(0, GROUND_Y + 0.62, CUT.sea0 - 0.31);
  passSign2.rotation.y = Math.PI;
  root.add(passSign2);

  // ---- The seafront promenade ----------------------------------------------------------
  for (let x = -84; x <= 84; x += 24) {
    if (Math.abs(x) < 8) continue;
    addLamp(makeSpotMast(), x, GROUND_Y, -1.5);
  }
  for (let x = -80; x <= 80; x += 12) {
    if (Math.abs(x) < 6 || (x > -54 && x < -42)) continue;
    // Concrete block bench with a wooden seat.
    const b = new THREE.Group();
    const blk = box(2.2, 0.42, 0.6, M(0xd8d2c4, 0.9));
    blk.position.y = 0.21;
    b.add(blk);
    const seat = box(2.2, 0.06, 0.6, M(0x8c7362, 0.85));
    seat.position.y = 0.45;
    b.add(seat);
    shadowed(b);
    place(b, x, GROUND_Y, -8.6);
    boxes.push({ x0: x - 1.1, x1: x + 1.1, z0: -8.9, z1: -8.3, top: GROUND_Y + 0.48, kind: 'bench' });
  }
  // Painted cycle path on the promenade's land side.
  const cycleGlyph = paintTexture((g) => {
    g.strokeStyle = 'rgba(250,248,240,0.85)';
    g.lineWidth = 10;
    for (const cx of [70, 186]) { g.beginPath(); g.arc(cx, 150, 46, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(70, 150); g.lineTo(120, 80); g.lineTo(186, 150); g.moveTo(120, 80); g.lineTo(170, 80); g.lineTo(186, 150); g.stroke();
  });
  const glyphMat = new THREE.MeshBasicMaterial({ map: cycleGlyph, transparent: true, depthWrite: false, color: 0xdddddd });
  for (let x = -84; x <= 84; x += 28) {
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), glyphMat);
    gm.rotation.x = -Math.PI / 2;
    gm.position.set(x, GROUND_Y + 0.012, -5.7);
    root.add(gm);
  }

  // ---- Boardwalk pavilions: the projects, the blog and about -------------------------
  const pavilions: { id: string; title: string; sub: string; color: string; x: number; w: number; dark?: boolean }[] = [
    { id: 'leash', title: 'Path of Leash Resistance', sub: 'Game', color: '#ffb020', x: -31, w: 12 },
    { id: 'stemma', title: 'stemma', sub: 'Music studio', color: '#1fc9b7', x: -14, w: 10 },
    { id: 'coriolis', title: 'Coriolis', sub: 'LED gallery', color: '#5eea8c', x: 13.5, w: 10, dark: true },
    { id: 'about', title: 'About', sub: 'Café', color: '#8bcb3c', x: 27.5, w: 10 },
    { id: 'blog', title: 'Blog', sub: 'Newsstand', color: '#e5487a', x: 40, w: 6 },
    { id: 'how', title: 'How I build', sub: 'Studio', color: '#3d73c7', x: 53, w: 10 },
  ];
  const PZ0 = -19.4, PZ1 = -12.4;
  for (const p of pavilions) {
    const g = new THREE.Group();
    const accent = parseInt(p.color.slice(1), 16);
    const bodyM = p.dark ? M(0x101933, 0.6) : facadeMat(0xf4f1ea);
    const h = 3.9;
    const body = box(p.w, h, PZ1 - PZ0, bodyM);
    body.position.set(0, h / 2, 0);
    g.add(body);
    const roofSlab = box(p.w + 0.6, 0.25, PZ1 - PZ0 + 2.2, M(0xe9e6df, 0.8));
    roofSlab.position.set(0, h + 0.12, 1.1);
    g.add(roofSlab);
    const fascia = box(p.w + 0.62, 0.5, 0.08, M(accent, 0.6));
    fascia.position.set(0, h - 0.05, (PZ1 - PZ0) / 2 + 2.2);
    g.add(fascia);
    // Posts holding the canopy over the front deck.
    for (const sx of [-p.w / 2, p.w / 2]) {
      const post = cyl(0.06, 0.06, h, M(0xe9e6df, 0.6, 0.3), 8);
      post.position.set(sx, h / 2, (PZ1 - PZ0) / 2 + 2.1);
      g.add(post);
    }
    if (p.id !== 'coriolis') {
      const glass = box(p.w * 0.66, 2.6, 0.06, shopGlassMat);
      glass.position.set(-p.w * 0.12, 1.45, (PZ1 - PZ0) / 2 + 0.04);
      g.add(glass);
      const door = box(1.2, 2.5, 0.06, M(accent, 0.55));
      door.position.set(p.w * 0.34, 1.3, (PZ1 - PZ0) / 2 + 0.04);
      g.add(door);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(Math.min(p.w * 0.85, 7.5), 0.85, 0.1), new THREE.MeshStandardMaterial({ map: signTexture(p.title, p.sub, p.color, { aspect: Math.min(p.w * 0.85, 7.5) / 0.85 }) }));
      sign.position.set(0, h + 0.75, (PZ1 - PZ0) / 2 + 1.6);
      g.add(sign);
    }
    shadowed(g);
    place(g, p.x, GROUND_Y, (PZ0 + PZ1) / 2);
    boxes.push({ x0: p.x - p.w / 2, x1: p.x + p.w / 2, z0: PZ0, z1: PZ1, top: GROUND_Y + h, kind: 'building' });
    for (const sx of [-p.w / 2, p.w / 2]) addCircle(p.x + sx, PZ1 + 2.1, 0.06, GROUND_Y + h, 'post', true, true);
  }
  // About: a little terrace in front of the café.
  for (const tx of [24, 31]) {
    place(makeCafeSet(0x8bcb3c), tx, GROUND_Y, -9.8, r() * 3);
    addCircle(tx, -9.8, 0.5, GROUND_Y + 0.8, 'table', false, false);
  }
  // Blog: racks of magazines out front.
  place(makeKiosk(0xe5487a), 40, GROUND_Y, -10.6, 0);
  boxes.push({ x0: 38.7, x1: 41.3, z0: -11.5, z1: -9.7, top: GROUND_Y + 2.8, kind: 'kiosk' });
  // Coriolis: the LED wall on the pavilion's front, facing the promenade.
  const cor = pavilions.find((p) => p.id === 'coriolis')!;
  const wallX = cor.x, wallY = GROUND_Y + 2.3, wallZ = PZ1 + 0.05;
  const bezel = box(4.4, 4.4, 0.25, M(0x07090e, 0.4, 0.5));
  bezel.position.set(wallX, wallY, wallZ + 0.1);
  root.add(bezel);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 4.0), new THREE.MeshBasicMaterial({ map: opts.coriolisTex }));
  screen.position.set(wallX, wallY, wallZ + 0.24);
  root.add(screen);
  const cSign = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.7, 0.1), new THREE.MeshStandardMaterial({ map: signTexture('Coriolis', 'Live 128×128 · X', '#5eea8c', { aspect: 4.0 / 0.7, bg: '#0b1430', fg: '#5eea8c' }) }));
  cSign.position.set(wallX, GROUND_Y + 4.65, PZ1 + 1.6);
  root.add(cSign);
  // stemma: four live level bars in the window and speakers by the door.
  const stem = pavilions.find((p) => p.id === 'stemma')!;
  const stemmaBars: THREE.Mesh[] = [];
  const barCols = [0xe5487a, 0xffb020, 0x1fc9b7, 0x8bcb3c];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.08), new THREE.MeshStandardMaterial({ color: barCols[i], emissive: barCols[i], emissiveIntensity: 1 }));
    m.position.set(stem.x - 3.6 + i * 0.75, GROUND_Y + 0.6, PZ1 + 0.1);
    m.scale.y = 0.2;
    m.userData.dynamic = true;
    root.add(m);
    stemmaBars.push(m);
  }
  for (const sx of [stem.x - 4.4, stem.x + 4.4]) {
    const sp = box(0.7, 1.15, 0.6, M(0x1b1b1f, 0.6));
    sp.position.set(sx, GROUND_Y + 0.58, PZ1 + 0.8);
    root.add(sp);
    const cone = cyl(0.22, 0.22, 0.04, M(0x3a3a40, 0.4, 0.3), 16);
    cone.rotation.x = Math.PI / 2;
    cone.position.set(sx, GROUND_Y + 0.7, PZ1 + 1.11);
    root.add(cone);
    boxes.push({ x0: sx - 0.35, x1: sx + 0.35, z0: PZ1 + 0.5, z1: PZ1 + 1.1, top: GROUND_Y + 1.15, kind: 'speaker' });
  }

  // ---- Beach ---------------------------------------------------------------------------
  // White tent beach bar.
  const bar = new THREE.Group();
  const tent = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.2, 4, 1, true), M(0xf6f4ef, 0.8, 0, { side: THREE.DoubleSide }));
  tent.rotation.y = Math.PI / 4;
  tent.position.y = 3.6;
  bar.add(tent);
  for (const [px, pz] of [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]]) {
    const post = cyl(0.06, 0.06, 2.6, M(0xe9e6df, 0.6, 0.3), 6);
    post.position.set(px, 1.3, pz);
    bar.add(post);
  }
  const counter = box(4.2, 1.1, 1.0, M(0x8c7362, 0.8));
  counter.position.set(0, 0.55, -1.2);
  bar.add(counter);
  const deckB = box(7, 0.12, 7, deckMat);
  deckB.position.y = 0.06;
  bar.add(deckB);
  shadowed(bar);
  place(bar, -6, SAND_Y, -31);
  boxes.push({ x0: -8.2, x1: -3.8, z0: -32.8, z1: -31.6, top: SAND_Y + 1.2, kind: 'counter' });
  for (const [tx, tz] of [[-8, -28.5], [-4, -28.5]]) {
    place(makeCafeSet(0xf4f1ea), tx, SAND_Y + 0.12, tz, r() * 3);
    addCircle(tx, tz, 0.5, SAND_Y + 0.9, 'table', false, false);
  }
  place(makeLifeguardTower(), 8, sandFloor(-46), -46);
  addCircle(8, -46, 0.8, sandFloor(-46) + 2.2, 'tower', false, false);
  // Tamarisks near the pier.
  for (const [tx, tz] of [[-58, -25], [-54, -31], [-40, -26], [-62, -33], [-37, -33]]) {
    const t = makeTamarisk(Math.floor(tx * 3 + tz));
    place(t.group, tx, sandFloor(tz), tz);
    addCircle(tx, tz, t.radius, sandFloor(tz) + 4, 'tree', true, false);
  }
  // Boulder clusters.
  for (const [bx, bz] of [[22, -50], [-24, -52], [54, -48]]) {
    for (let k = 0; k < 4; k++) {
      const s = 0.5 + r() * 0.6;
      const rock = new THREE.Mesh(rockGeo, rockMats[k % 3]);
      rock.scale.set(s * 1.3, s, s);
      rock.position.set(bx + (r() - 0.5) * 2, sandFloor(bz) + s * 0.4, bz + (r() - 0.5) * 2);
      rock.castShadow = true;
      root.add(rock);
    }
    addCircle(bx, bz, 1.4, sandFloor(bz) + 1, 'rock', true, false);
  }
  const umbCols: [number, number][] = [[0xe5487a, 0xf4f1ea], [0xffb020, 0x1fc9b7], [0x3d73c7, 0xf4f1ea], [0x8bcb3c, 0xffb020], [0xd9705a, 0xf4f1ea]];
  const towels = [0xe5487a, 0x1fc9b7, 0xffb020, 0x3d73c7, 0x8bcb3c, 0xf4f1ea];
  const sunbathers: { x: number; z: number; ry: number }[] = [];
  for (const [ux, uz] of [[-20, -34], [-14, -41], [6, -36], [16, -42], [36, -36], [48, -41], [-30, -44], [28, -48], [62, -44], [-70, -40], [-76, -30]]) {
    place(makeBeachUmbrella(...pick(umbCols)), ux, sandFloor(uz), uz);
    addCircle(ux, uz, 0.12, sandFloor(uz) + 2.1, 'umbrella', true, false);
    const tw = makeTowel(pick(towels));
    tw.position.set(ux + 1.2, sandFloor(uz) + 0.01, uz + 0.3);
    root.add(tw);
    if (r() < 0.65) sunbathers.push({ x: ux + 1.2, z: uz + 0.3, ry: r() * 0.4 });
  }
  // El Dimoni on its woodpile, behind a crowd-control fence.
  const dimoni = makeDimoni();
  dimoni.figure.userData.dynamic = true;
  dimoni.group.scale.setScalar(1.6);
  place(dimoni.group, 24, sandFloor(-38), -38, -0.3);
  addCircle(24, -38, 3.6, SAND_Y + 8, 'dimoni', false, false);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const len = 2 * Math.PI * 5.2 / 10;
    place(makeHeras(len), 24 + Math.cos(a) * 5.2, sandFloor(-38 + Math.sin(a) * 5.2), -38 + Math.sin(a) * 5.2, -a - Math.PI / 2);
  }
  addCircle(24, -38, 5.4, SAND_Y + 2, 'fence', false, false);
  const dimoniGlow = new THREE.PointLight(0xff7a2a, 0, 22, 1.3);
  dimoniGlow.position.set(24, 4, -34);
  root.add(dimoniGlow);
  // Buried finds.
  const mounds: Mound[] = [];
  for (const [mx, mz, name] of [[-16, -27, 'an old one-peseta coin'], [44, -46, 'a pair of sunglasses'], [-68, -36, 'a message in a bottle']] as const) {
    const m = makeSandMound();
    m.userData.dynamic = true;
    m.position.set(mx, sandFloor(mz), mz);
    root.add(m);
    const loot = new THREE.Group();
    const gem = name.includes('coin')
      ? cyl(0.16, 0.16, 0.03, M(0xd8b04a, 0.3, 0.8), 18)
      : name.includes('sunglasses')
        ? box(0.4, 0.12, 0.05, M(0x1b1b1f, 0.2, 0.3))
        : cyl(0.07, 0.07, 0.38, new THREE.MeshStandardMaterial({ color: 0x6fae8a, transparent: true, opacity: 0.7, roughness: 0.1 }), 10);
    if (name.includes('coin')) gem.rotation.x = Math.PI / 2;
    loot.add(gem);
    loot.position.set(mx, sandFloor(mz) + 0.9, mz);
    loot.visible = false;
    loot.userData.dynamic = true;
    root.add(loot);
    mounds.push({ x: mx, z: mz, name, dug: false, mesh: m, loot });
  }

  // ---- Pipicà ---------------------------------------------------------------------------
  const P = PIPICA;
  const pFence = M(0x2f6b4f, 0.55, 0.4);
  const pTop = SAND_Y + 1.3;
  const fenceSeg = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (let s = 0; s <= len; s += 0.25) {
      const t = s / len;
      inst.add('pbar', new THREE.BoxGeometry(0.03, 1.2, 0.03), pFence, mtx(x0 + (x1 - x0) * t, SAND_Y + 0.6, z0 + (z1 - z0) * t), false);
    }
    const rail = box(len, 0.06, 0.06, pFence);
    rail.position.set((x0 + x1) / 2, pTop - 0.05, (z0 + z1) / 2);
    rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    root.add(rail);
    boxes.push({ x0: Math.min(x0, x1) - 0.1, x1: Math.max(x0, x1) + 0.1, z0: Math.min(z0, z1) - 0.1, z1: Math.max(z0, z1) + 0.1, top: pTop, kind: 'fence' });
  };
  fenceSeg(P.x0, P.z0, P.x1, P.z0);
  fenceSeg(P.x0, P.z1, P.x1, P.z1);
  fenceSeg(P.x1, P.z0, P.x1, P.z1);
  fenceSeg(P.x0, P.z0, P.x0, P.gateZ0);
  fenceSeg(P.x0, P.gateZ1, P.x0, P.z1);
  for (const gz of [P.gateZ0, P.gateZ1]) {
    const post = cyl(0.08, 0.08, 1.6, pFence, 8);
    post.position.set(P.x0, SAND_Y + 0.8, gz);
    root.add(post);
  }
  const pSign = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 2.2), new THREE.MeshStandardMaterial({ map: signTexture('Pipicà', 'Off-leash area', '#8bcb3c', { aspect: 2.2 / 0.7 }) }));
  pSign.position.set(P.x0 - 0.1, SAND_Y + 1.75, P.gateZ0 - 1.5);
  root.add(pSign);
  const hurdles: { x: number; z: number; cleared: boolean }[] = [];
  for (const hx of [66, 71, 76]) {
    place(makeHurdle(), hx, SAND_Y, -30.5);
    hurdles.push({ x: hx, z: -30.5, cleared: false });
    boxes.push({ x0: hx - 0.05, x1: hx + 0.05, z0: -31.1, z1: -29.9, top: SAND_Y + 0.5, kind: 'hurdle' });
  }
  place(makeWaterBowl(), 78, SAND_Y, -24);
  const bowls = [{ x: 78, z: -24 }];
  const humanBench = { x: P.x0 - 2.6, z: -28 };
  place(makeBench(), humanBench.x - 0.35, SAND_Y, humanBench.z, Math.PI / 2);

  // ---- The old oil pier -----------------------------------------------------------------
  const deckTex2 = deckTexture();
  deckTex2.rotation = Math.PI / 2; // planks laid crosswise
  const pierDeckMat = new THREE.MeshStandardMaterial({ map: deckTex2, roughness: 0.85, color: 0xb0a89c });
  const pierDeck = ground(PIER.x0 + 0.4, PIER.x1 - 0.4, PIER.end, PIER.root + 0.4, 0, pierDeckMat, 3, 1, 40, (_x, z) => pierDeckY(z) + 0.01);
  root.add(pierDeck);
  for (const sx of [PIER.x0 + 0.2, PIER.x1 - 0.2]) {
    const strip = ground(sx - 0.2, sx + 0.2, PIER.end, PIER.root + 0.4, 0, M(0xd9d6ce, 0.85), 3, 1, 40, (_x, z) => pierDeckY(z) + 0.015);
    root.add(strip);
  }
  const deckEdge = ground(PIER.x0, PIER.x1, PIER.end, PIER.root, 0, M(0xc8c8c2, 0.85), 3, 1, 40, (_x, z) => pierDeckY(z) - 0.35);
  deckEdge.rotation.x = 0;
  root.add(deckEdge);
  // The root sits on a rock embankment; legs carry it beyond.
  rocksAt((PIER.x0 + PIER.x1) / 2, PIER.root - 0.5, PIER.rise + 2, 4);
  for (let z = PIER.rise; z > PIER.end; z -= 10) {
    const legH = pierDeckY(z) - Math.min(sandFloor(z), WATER_Y - 1.5) + 0.5;
    place(makePierLeg(legH, PIER.x1 - PIER.x0), (PIER.x0 + PIER.x1) / 2, pierDeckY(z), z);
    for (const sx of [PIER.x0 + 0.8, PIER.x1 - 0.8]) circles.push({ x: sx, z, r: 0.35, top: pierDeckY(z) - 0.6, maxY: pierDeckY(z) - 0.9, kind: 'pillar', canPee: true, canWhirl: false, marked: false });
  }
  // Railings: posts leaning outward, horizontal cables, a round top rail.
  const steel = M(0xa89a80, 0.35, 0.8);
  const railPost = new THREE.BoxGeometry(0.05, 1.15, 0.05);
  for (const [sx, lean] of [[PIER.x0 + 0.05, 0.12], [PIER.x1 - 0.05, -0.12]] as const) {
    for (let z = PIER.root - 0.5; z > PIER.end; z -= 2) {
      inst.add('ppost', railPost, steel, mtx(sx, pierDeckY(z) + 0.57, z, 0, 1, 1, 1, 0, lean), false);
    }
    for (let z = PIER.root - 0.5; z > PIER.end; z -= 10) {
      const z2 = Math.max(PIER.end, z - 10);
      for (const [h, rr] of [[1.12, 0.03], [0.8, 0.006], [0.5, 0.006], [0.2, 0.006]] as const) {
        root.add(rod(new THREE.Vector3(sx - lean * h, pierDeckY(z) + h, z), new THREE.Vector3(sx - lean * h, pierDeckY(z2) + h, z2), rr, steel, 5));
      }
    }
    boxes.push({ x0: sx - 0.12, x1: sx + 0.12, z0: PIER.end, z1: PIER.root - 0.3, top: 9, minY: GROUND_Y - 0.1, kind: 'rail' });
  }
  boxes.push({ x0: PIER.x0, x1: PIER.x1, z0: PIER.end - 0.4, z1: PIER.end, top: 9, minY: 0.5, kind: 'rail' });
  // The monkey on its white block at the land entrance, by the gate.
  const monkey = makeMonkeyStatue();
  monkey.scale.setScalar(0.85);
  place(monkey, PIER.x0 - 1.8, GROUND_Y, -8.6, Math.PI / 2);
  boxes.push({ x0: PIER.x0 - 2.5, x1: PIER.x0 - 1.1, z0: -9.3, z1: -7.9, top: GROUND_Y + 1, kind: 'statue' });
  for (const sx of [PIER.x0 - 0.15, PIER.x1 + 0.15]) {
    const gp = box(0.3, 1.6, 0.3, steel);
    gp.position.set(sx, GROUND_Y + 0.8, PIER.root + 0.2);
    root.add(gp);
  }
  // The shortened end: a beacon mast and an open steel frame, with the old pile platform beyond.
  const beacon = makeBeaconMast();
  place(beacon.group, PIER.x1 - 0.5, pierDeckY(PIER.end), PIER.end + 0.6);
  circles.push({ x: PIER.x1 - 0.5, z: PIER.end + 0.6, r: 0.17, top: 9, minY: 0.5, kind: 'lamp', canPee: true, canWhirl: true, marked: false, obstacle: { x: PIER.x1 - 0.5, z: PIER.end + 0.6, r: 0.17, kind: 'pole' } });
  const frame = new THREE.Group();
  for (const s of [-1, 1]) frame.add(rod(new THREE.Vector3(s * 1.9, 0, 0), new THREE.Vector3(s * 1.9, 3.2, 0), 0.06, steel, 6));
  frame.add(rod(new THREE.Vector3(-1.9, 3.2, 0), new THREE.Vector3(1.9, 3.2, 0), 0.06, steel, 6));
  place(frame, (PIER.x0 + PIER.x1) / 2, pierDeckY(PIER.end), PIER.end + 6);
  const oldPlat = box(7, 0.6, 7, M(0xb8b4aa, 0.9));
  oldPlat.position.set((PIER.x0 + PIER.x1) / 2, PIER.high - 0.3, PIER.end - 14);
  root.add(oldPlat);
  place(makePierLeg(PIER.high - WATER_Y + 2, 6), (PIER.x0 + PIER.x1) / 2, PIER.high - 0.6, PIER.end - 14);
  const fishers = [{ x: PIER.x1 - 0.5, z: -70, ry: Math.PI }, { x: PIER.x0 + 0.5, z: -96, ry: 0 }, { x: PIER.x1 - 0.5, z: -118, ry: Math.PI }];

  // ---- Horizon: the Tres Xemeneies to the southwest, the Serralada inland ------------
  const xem = makeXemeneies();
  xem.position.set(-760, WATER_Y, -120);
  xem.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m) m.fog = false; });
  xem.scale.setScalar(0.9);
  root.add(xem);
  const hills = new THREE.Mesh(
    new THREE.CylinderGeometry(900, 1000, 120, 48, 1, true, Math.PI * 0.15, Math.PI * 0.7),
    new THREE.MeshBasicMaterial({ color: 0x6f8f6a, side: THREE.BackSide, fog: false }),
  );
  hills.position.set(0, 20, 300);
  root.add(hills);

  inst.build(root);
  bakeStatic(root);
  const poles: Obstacle[] = circles.filter((c) => c.obstacle).map((c) => c.obstacle!);

  // ---- Stops (doors of the pavilions) --------------------------------------------------
  const stopFor = (id: string, label: string, kind: string, href: string, color: string) => {
    const p = pavilions.find((x) => x.id === id)!;
    return { id, label, kind, href, color, x: p.x + (id === 'coriolis' ? 0 : p.w * 0.34), z: PZ1 + 1.2, r: id === 'blog' ? 2.6 : 2.4 };
  };
  const stops: Stop[] = [
    stopFor('leash', 'Path of Leash Resistance', 'Game', '/projects/path-of-leash-resistance', '#ffb020'),
    stopFor('stemma', 'stemma', 'Music studio', '/projects/stemma', '#1fc9b7'),
    { ...stopFor('coriolis', 'Coriolis', 'LED gallery', '/projects/coriolis', '#5eea8c'), x: cor.x + cor.w / 2 - 0.6 },
    stopFor('about', 'About', 'Café', '/about', '#8bcb3c'),
    { ...stopFor('blog', 'Blog', 'Newsstand', '/blog', '#e5487a'), x: 40, z: -9.0 },
    stopFor('how', 'How I build', 'Studio', '/how-i-build', '#3d73c7'),
  ];

  // ---- Floor, surfaces, bounds ---------------------------------------------------------
  const onPier = (x: number, z: number) => x >= PIER.x0 && x <= PIER.x1 && z <= PIER.root && z >= PIER.end;
  const floor = (x: number, z: number, y: number): number => {
    if (onPier(x, z)) {
      const d = pierDeckY(z);
      if (z > PIER.rise + 2 || y > d - 0.9) return d;
    }
    if (Math.abs(x) <= CUT.x && z < CUT.rambla0 && z > CUT.sea1) return cutY(z);
    if (z >= -20) return GROUND_Y;
    for (const rx of RAMPS) if (Math.abs(x - rx) <= 1.5 && z > -23.2) return GROUND_Y + ((z + 20) / 3.2) * (GROUND_Y - SAND_Y);
    return sandFloor(z);
  };
  const surface = (x: number, z: number, y: number): Surface => {
    if (onPier(x, z) && y > pierDeckY(z) - 0.9) return 'deck';
    if (z >= -20 || (Math.abs(x) <= CUT.x && z < CUT.rambla0 && z > CUT.sea1)) return z < -10 && z >= -20 ? 'deck' : 'paving';
    return sandFloor(z) < WATER_Y ? 'water' : 'sand';
  };
  const inPipica = (x: number, z: number) => x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1;
  const clampBounds = (p: { x: number; z: number; y: number }) => {
    if (p.z > 34) { p.z = Math.min(p.z, 99); p.x = Math.max(-33.6, Math.min(33.6, p.x)); return; }
    p.x = Math.max(-91.5, Math.min(91.5, p.x));
    if (!onPier(p.x, p.z)) p.z = Math.max(p.z, -64);
  };

  // ---- Paths for pedestrians -------------------------------------------------------------
  const pedPaths: [number, number][][] = [
    [[-1.6, 38], [-1.6, 60], [-1.4, 80], [-1.6, 97]],
    [[1.6, 97], [1.5, 78], [1.6, 58], [1.6, 38]],
    [[-30, 52.8], [-12, 53.2], [12, 52.8], [30, 53.2]],
    [[30, 70.8], [10, 71.2], [-10, 70.8], [-30, 71.2]],
    [[-30, 88.8], [0, 89.2], [30, 88.8]],
    [[-86, 24], [-40, 23.5], [0, 24.5], [40, 23.5], [62, 23.5], [66, 21.4], [76, 21.4], [86, 24]],
    [[86, 19], [30, 19.5], [6, 23.4], [-6, 23.4], [-30, 18.6], [-86, 19]],
    [[-86, 29], [-20, 28.4], [20, 29], [86, 28.5]],
    [[-86, -7.6], [-30, -7.4], [10, -7.7], [86, -7.5]],
    // Along the pavilion fronts (not through them), clear of the blog kiosk and the pier.
    [[-8, -10.9], [14, -11], [36, -10.9]],
    [[-44, -10.9], [-32, -11], [-20.5, -10.9]],
    [[-80, -54], [0, -55], [80, -54]],
    [[-48, -12], [-48, -60], [-48, -126]],
  ];

  return {
    root, boxes, circles, poles, stops, mounds, lampSpots, lampGlass, litWindowMat, wetMats,
    floor, surface, inPipica, clampBounds, ramps: RAMPS,
    waterMat, foamMat, sea, sunbathers, fishers, hurdles, bowls, fountains, humanBench, terraceSeats,
    dimoni: { ...dimoni, x: 24, z: -38, glow: dimoniGlow },
    pierEnd: { x: (PIER.x0 + PIER.x1) / 2, z: PIER.end + 4 },
    beacon: beacon.lamp,
    coriolis: { x: wallX, y: wallY, z: wallZ, screen },
    stemma: { x: stem.x, z: PZ1 + 1.6 },
    stemmaBars,
    underpassLight,
    tunnel: { x0: -CUT.tunnelX, x1: CUT.tunnelX, z0: CUT.sea0, z1: CUT.rambla1, cutZ0: CUT.sea1, cutZ1: CUT.rambla0, floor: CUT.floor },
    // On the promenade between the PoLR and stemma pavilions, clear of the cycle path.
    start: { dog: { x: -22, z: -3.4 }, human: { x: -21.4, z: -1.2 } },
    pedPaths,
    birdSpots: {
      pigeons: [[-1.5, 45], [1, 47], [-0.5, 43.5], [8, 53], [-16, 52], [10, 71], [-6, 30], [6, 26], [-2, 24]] as [number, number][],
      gulls: [[-20, -45], [-12, -50], [10, -52], [16, -49], [-48, -70], [-48, -100], [40, -51], [60, -52], [-48, -124]] as [number, number][],
    },
    quests: {
      kid: { x: -14, y: GROUND_Y + 4.25, z: 91.7, ry: Math.PI / 2 },
      ball: { x: 24, z: 72.4 },
      tofu: { spots: [[-29, 70.5], [-17, 72.8], [-2.6, 71.5], [-1.8, 77], [2, 84.5], [2.6, 88.8], [13, 89.6], [20, 86.7]] as [number, number][] },
      crate: { x: -11, z: 50.8, ry: 0 },
      grocer: { x: -13.4, z: 50.9, ry: -Math.PI / 2 },
      baker: { x: 12.5, z: 50.9, ry: -Math.PI / 2 },
      mural: { x: 16, z: 68.8 },
      sweeper: { x: 0, z0: 40, z1: 96 },
    },
    correfoc: { x0: 80, x1: -2, z: 24 },
    station: { x: STATION_X },
  };
}

export type Level = ReturnType<typeof buildLevel>;
