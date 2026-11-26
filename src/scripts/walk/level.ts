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
import { bakeStatic, bakeSteps, drain } from './bake';
import { DirectBuilder } from './meshbuilder';
import { makeCitySkyline, makeInlandHills } from './horizon';
import { PLAZA, inPlazaPipica, makePlazaDistrict } from './plaza';
import { HILL, hillFloor, inHillPipica, makeChurchLandmark, makeHillDistrict } from './hill';
import { MARINA, inMarinaPipica, makeMarinaDistrict, BREAKWATER_Y } from './marina';
import { SEAFRONT_LAYOUT, buildDistrictBlocksSteps, buildDistrictStandin } from './layout';
import { groundAroundMetro, makeMetroEntrance } from './metro';
import { ColliderGrid, inBounds, type District } from './world';
import {
  M, box, cyl, rod, shadowed,
  makeBench, makeBollard, makeBin, makeContainers, makeKiosk, makeBeachUmbrella, makeTowel,
  makeLifeguardTower, makeHeras, makeCone, makeSkip, makeExcavator, makeFountain,
  makeWaterBowl, makeHurdle, makeSandMound, makeMonkeyStatue, makeDimoni, makeCafeSet,
} from './models';
import {
  makeLanternPost, makeSpotMast, makeTerrace, makeTamarisk, makeDatePalm, makeChimney, makeXemeneies,
  makeArch, makeBunting, makePierLeg, makeBeaconMast, railFenceGeometry, makeFingerpost, makePlanterPot, makeParkedBike,
} from './props';
import {
  panotTextures, sandTexture, deckTexture, plasterTexture, waterNormalTexture, signTexture, rng,
  slabTexture, flagstoneTexture, concreteTexture, wallPanelTexture, tileFloorTexture, muralTexture, paintTexture, lumaBumpTexture,
} from './textures';

export interface BoxCollider { x0: number; x1: number; z0: number; z1: number; top: number; minY?: number; kind: string; face?: [number, number]; district?: string }
export interface CircleCollider {
  x: number; z: number; r: number; top: number; minY?: number; maxY?: number;
  kind: string; canPee: boolean; canWhirl: boolean; marked: boolean; obstacle?: Obstacle; district?: string;
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
const RAMPS = SEAFRONT_LAYOUT.ramps;
const PIER = SEAFRONT_LAYOUT.pier;
/** The swimming zone, fenced by a buoy line: x0..x1 along the beach, out to z. */
export const SWIM = SEAFRONT_LAYOUT.swim;
export const PIPICA = SEAFRONT_LAYOUT.pipica;

const SHORE_Z = -24 - (SAND_Y - WATER_Y) / 0.035; // -58.2857, where sandFloor crosses WATER_Y
const sandFloor = (z: number) =>
  z > -24 ? SAND_Y : z >= SHORE_Z ? SAND_Y - (-24 - z) * 0.035 : WATER_Y - (SHORE_Z - z) * 0.095;
const pierDeckY = (z: number) => (z > PIER.root ? GROUND_Y : z > PIER.rise ? GROUND_Y + ((PIER.root - z) / (PIER.root - PIER.rise)) * (PIER.high - GROUND_Y) : PIER.high);

// ---- Instancing collector -------------------------------------------------------------
class Instancer {
  private sets = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; mats: THREE.Matrix4[]; cast: boolean }>();
  /** Geometry and material may be factories: they only run for the first instance of a key. */
  add(key: string, geo: THREE.BufferGeometry | (() => THREE.BufferGeometry), mat: THREE.Material | (() => THREE.Material), m: THREE.Matrix4, cast = true) {
    let s = this.sets.get(key);
    if (!s) { s = { geo: typeof geo === 'function' ? geo() : geo, mat: typeof mat === 'function' ? mat() : mat, mats: [], cast }; this.sets.set(key, s); }
    s.mats.push(m.clone());
  }
  /** One InstancedMesh per key and per target (district) that `assign` picks by position. */
  build(assign: (x: number, z: number) => THREE.Object3D) {
    const p = new THREE.Vector3();
    this.sets.forEach((s) => {
      const byTarget = new Map<THREE.Object3D, THREE.Matrix4[]>();
      for (const m of s.mats) {
        p.setFromMatrixPosition(m);
        const t = assign(p.x, p.z);
        let list = byTarget.get(t);
        if (!list) { list = []; byTarget.set(t, list); }
        list.push(m);
      }
      byTarget.forEach((mats, target) => {
        const im = new THREE.InstancedMesh(s.geo, s.mat, mats.length);
        mats.forEach((m, i) => im.setMatrixAt(i, m));
        im.computeBoundingSphere();
        im.castShadow = s.cast;
        im.receiveShadow = true;
        target.add(im);
      });
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

const TOWN_Z0 = 33.5;

export interface LevelOpts {
  coriolisTex: THREE.Texture;
  boothScreens?: Record<string, THREE.Texture>;
}

/**
 * Build the level in steps (a generator): it yields between sections so the
 * loader can spread the work over frames. `buildLevel` runs it all at once.
 */
export function* buildLevelSteps(scene: THREE.Scene, opts: LevelOpts) {
  const T0 = performance.now();
  const root = new THREE.Group();
  scene.add(root);
  const inst = new Instancer();
  const boxes: BoxCollider[] = [];
  const circles: CircleCollider[] = [];
  const lampSpots: THREE.Vector3[] = [];
  const lampGlass: THREE.MeshStandardMaterial[] = [];
  const wetMats: THREE.MeshStandardMaterial[] = [];
  const litWindowMat = new THREE.MeshStandardMaterial({ color: 0x2c3850, roughness: 0.14, metalness: 0.38, envMapIntensity: 1.25, emissive: 0xffd27a, emissiveIntensity: 0 });
  const darkWindowMat = new THREE.MeshStandardMaterial({ color: 0x2c3850, roughness: 0.14, metalness: 0.38, envMapIntensity: 1.25 });
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
  yield 'Ground materials';
  // ---- Ground materials -------------------------------------------------------------
  const slab = slabTexture();
  const slabMat = new THREE.MeshStandardMaterial({ map: slab.map, bumpMap: lumaBumpTexture(slab.map, 1.8), bumpScale: 0.24, roughness: 0.9 });
  const flag = flagstoneTexture();
  const flagMat = new THREE.MeshStandardMaterial({ map: flag.map, bumpMap: lumaBumpTexture(flag.map, 2.0), bumpScale: 0.36, roughness: 0.85 });
  yield 'Textures';
  const panot = panotTextures();
  const panotMat = new THREE.MeshStandardMaterial({ map: panot.map, bumpMap: panot.bumpMap, bumpScale: 1.2, roughness: 0.92 });
  yield 'Textures';
  const conc = concreteTexture();
  const concMat = new THREE.MeshStandardMaterial({ map: conc.map, bumpMap: lumaBumpTexture(conc.map, 1.5), bumpScale: 0.18, roughness: 0.9 });
  const sandMap = sandTexture();
  const sandMat = new THREE.MeshStandardMaterial({ map: sandMap, bumpMap: lumaBumpTexture(sandMap, 1.9), bumpScale: 0.34, roughness: 1 });
  yield 'Textures';
  const deckMap = deckTexture();
  const deckMat = new THREE.MeshStandardMaterial({ map: deckMap, bumpMap: lumaBumpTexture(deckMap, 2.0), bumpScale: 0.45, roughness: 0.85, color: 0xb9ab9a });
  wetMats.push(slabMat, flagMat, panotMat, concMat);
  const plaster = plasterTexture();
  const plasterBump = lumaBumpTexture(plaster, 1.7);
  yield 'Ground';

  // Town: flagstones down Carrer del Mar, panots in the side streets.
  root.add(ground(-3.5, 3.5, 34, 101, GROUND_Y + 0.002, flagMat, flag.tileMeters));
  root.add(ground(-41, 41, 34, 101, GROUND_Y, panotMat, panot.tileMeters));
  // A drainage line down the middle of Carrer del Mar.
  const drain = box(0.25, 0.01, 64, M(0x2a2b2e, 0.6, 0.4));
  drain.position.set(0, GROUND_Y + 0.008, 66);
  root.add(drain);
  // The Rambla's slabs, the promenade's concrete, the boardwalk's planks.
  // Leave holes where the underpass cuts down below street level.
  // The metro entrance's stairwell is a hole in the Rambla's slabs too.
  for (const [gx0, gx1, gz0, gz1] of groundAroundMetro(-140, 140, CUT.rambla0, 34, SEAFRONT_LAYOUT.metro)) {
    root.add(ground(gx0, gx1, gz0, gz1, GROUND_Y, slabMat, slab.tileMeters));
  }
  root.add(ground(-140, -CUT.x, 14, CUT.rambla0, GROUND_Y, slabMat, slab.tileMeters));
  root.add(ground(CUT.x, 140, 14, CUT.rambla0, GROUND_Y, slabMat, slab.tileMeters));
  root.add(ground(-104, 140, -10, CUT.sea1, GROUND_Y, panotMat, panot.tileMeters));
  root.add(ground(-104, -92, -18, -10, GROUND_Y, panotMat, panot.tileMeters));
  root.add(ground(-104, -CUT.x, CUT.sea1, 4, GROUND_Y, panotMat, panot.tileMeters));
  root.add(ground(CUT.x, 140, CUT.sea1, 4, GROUND_Y, panotMat, panot.tileMeters));
  const promCurb = box(232, 0.05, 0.26, M(0xd8c3a5, 0.85));
  promCurb.position.set(24, GROUND_Y + 0.025, -10.02);
  promCurb.receiveShadow = true;
  root.add(promCurb);
  const deck = ground(-92, 140, -20, -10, GROUND_Y + 0.01, deckMat, 3);
  root.add(deck);
  // Beach, under the sea too (stops at the western rock groin x -94 so it clears the marina basin).
  root.add(ground(-94, 160, -120, -20, 0, sandMat, 6, 1, 50, (_x, z) => sandFloor(z)));
  const wet = ground(-94, 160, -62, -54, 0, new THREE.MeshStandardMaterial({ color: 0x8a6c44, roughness: 0.5, transparent: true, opacity: 0.4 }), 4, 1, 8, (_x, z) => sandFloor(z) + 0.012);
  root.add(wet);
  // The step down from the boardwalk to the sand: a low white concrete wall.
  const stepWall = box(232, 0.56, 0.4, M(0xeeebe4, 0.8));
  stepWall.position.set(24, GROUND_Y - 0.26, -20.1);
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

  yield 'The sea';
  // The sea.
  const waterNormal = waterNormalTexture();
  waterNormal.repeat.set(70, 70);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2f8fb0, roughness: 0.10, metalness: 0.18, envMapIntensity: 1.35, normalMap: waterNormal, normalScale: new THREE.Vector2(0.75, 0.75),
    transparent: true, opacity: 0.9,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1000), waterMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, WATER_Y, -540);
  sea.userData.always = true;
  root.add(sea);
  // Harbor basin water north of z -40 (kept separate from `sea` so there is no coplanar z-fighting).
  const harborWater = new THREE.Mesh(new THREE.PlaneGeometry(138, 22.52), waterMat);
  harborWater.rotation.x = -Math.PI / 2;
  harborWater.position.set(-163, WATER_Y, -28.76);
  harborWater.userData.always = true;
  root.add(harborWater);
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(254, 1.4), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(33, WATER_Y + 0.03, -57.4);
  foam.userData.always = true;
  root.add(foam);

  yield 'Buildings';
  // ---- Buildings ----------------------------------------------------------------------
  const plasterMats = new Map<number, THREE.MeshStandardMaterial>();
  const facadeMat = (c: number) => {
    let m = plasterMats.get(c);
    if (!m) { m = new THREE.MeshStandardMaterial({ color: c, map: plaster, bumpMap: plasterBump, bumpScale: 0.22, roughness: 0.92 }); plasterMats.set(c, m); }
    return m;
  };
  const shopGlassMat = new THREE.MeshStandardMaterial({ color: 0x4b647d, roughness: 0.12, metalness: 0.35, envMapIntensity: 1.25, transparent: true, opacity: 0.34 });
  const wallPlasterMat = new THREE.MeshStandardMaterial({ map: plaster, bumpMap: plasterBump, bumpScale: 0.22, vertexColors: true, roughness: 0.92 });
  const townBuilder = new DirectBuilder(TOWN_Z0);
  const townLayout = SEAFRONT_LAYOUT.districts.find((d) => d.id === 'town')!;
  yield* buildDistrictBlocksSteps(townLayout, {
    groundY: GROUND_Y,
    builder: townBuilder,
    wallMat: wallPlasterMat,
    inst,
    boxes,
    litWindowMat,
    darkWindowMat,
    ironMat: ironM,
    r,
  });
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

  yield 'Town furniture and quest props';
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

  yield 'Borders: works';
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
  // (The top of Carrer del Mar is open now: it leads on to Plaça del Mercat, plaza.ts.)
  for (const z of [53, 71, 89]) {
    obresLine(-34, z - 3, -34, z + 3, false);
    obresLine(34, z - 3, 34, z + 3, false);
  }
  place(makeSkip(), 37, GROUND_Y, 71, Math.PI / 2);
  place(makeExcavator(), -38, GROUND_Y, 89, 1.2);
  obresLine(-92, 14.6, -92, 33.4);
  obresLine(92, 14.6, 92, 33.4);
  // Seafront promenade opens west at x -92 into El Port; edge rails keep Millie on the transition quay.
  obresLine(92, -19.6, 92, 3.6);
  {
    const wallM = M(0xb9b2a4, 0.85);
    const railM = M(0x383e4a, 0.5, 0.5);
    const qWall = box(12, 2.2, 0.5, wallM);
    qWall.position.set(-98, GROUND_Y - 1.1, -18.1);
    root.add(qWall);
    const qRail = box(12, 0.9, 0.14, railM);
    qRail.position.set(-98, GROUND_Y + 0.45, -18.1);
    root.add(qRail);
    boxes.push({ x0: -104, x1: -92, z0: -18.3, z1: -17.9, top: GROUND_Y + 1.4, kind: 'wall' });
    const bwRail = box(0.16, 0.9, 2.4, railM);
    bwRail.position.set(-92.0, GROUND_Y + 0.45, -19.1);
    root.add(bwRail);
    boxes.push({ x0: -92.2, x1: -91.8, z0: -20.3, z1: -17.9, top: GROUND_Y + 1.4, kind: 'wall' });
    place(makeFingerpost([
      { title: 'Port · Espigó', sub: 'Boats · Far', color: '#3d73c7', angle: Math.PI },
      { title: 'Platja', sub: 'Passeig · Pier', color: '#ffb020', angle: 0 },
    ]), -94, GROUND_Y, -8);
    addCircle(-94, -8, 0.14, GROUND_Y + 3.2, 'pole', true, true);
  }
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

  yield 'The Rambla';
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
    yield 'Palms';
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

  yield 'The railway at grade';
  // ---- The railway at grade --------------------------------------------------------------
  const ballast = box(300, 0.18, 9.4, M(0x8e877b, 1));
  ballast.position.set(0, GROUND_Y + 0.05, TRAIN_Z);
  ballast.receiveShadow = true;
  root.add(ballast);
  for (const tz of [TRAIN_Z - 1.6, TRAIN_Z + 1.6]) {
    for (let x = -148; x < 148; x += 0.75) inst.add('sleeper', () => new THREE.BoxGeometry(0.24, 0.1, 2.5), () => M(0x7a7368, 0.9), mtx(x, GROUND_Y + 0.18, tz), false);
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
  // One merged geometry per segment length, shared (the bars are ~60 boxes each).
  const fenceGeos = new Map<number, THREE.BufferGeometry>();
  const fenceGeo = (len: number) => {
    const k = Math.round(len * 100) / 100;
    let g = fenceGeos.get(k);
    if (!g) { g = mergeGeos(railFenceGeometry(k)); fenceGeos.set(k, g); }
    return g;
  };
  for (const fz of [14, 4]) {
    for (const [fx0, fx1] of [[-148, -CUT.x], [CUT.x, 148]]) {
      for (let x = fx0; x < fx1; x += 8) {
        const len = Math.min(8, fx1 - x);
        const m = new THREE.Mesh(fenceGeo(len), fenceMat);
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

  yield 'The station: platforms under steel canopies, an oxblood building on the Rambla';
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
  stops0.push({ id: 'station', label: 'Estació', kind: 'Train to 2D street', href: '/?via=train', color: '#e5302a', x: STATION_X, z: 14.2 + stD + 2.2, r: 5.5 });

  // ---- The metro entrance, at the west end of the Rambla (metro.ts) ----
  const metroDef = SEAFRONT_LAYOUT.metro;
  const metro = makeMetroEntrance(metroDef, GROUND_Y);
  root.add(metro.group);
  boxes.push({ ...metro.rail, kind: 'rail' });
  addCircle(metro.totem.x, metro.totem.z, metro.totem.r, metro.totem.top, 'pole', true, true);
  stops0.push({ id: 'metro', label: 'Metro', kind: 'Metro to 2D street', href: '/?via=metro', color: metroDef.lineColor, x: metro.head.x, z: metro.head.z, r: 2.2 });

  yield 'The underpass';
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
    // Tilt so the street-level end is up (that's za on the town side, zb on the sea side).
    const highZ = cutY(za) > cutY(zb) ? za : zb;
    ramp.rotation.x = Math.atan2(GROUND_Y - CUT.floor, Math.abs(za - zb)) * (highZ > (za + zb) / 2 ? -1 : 1);
    root.add(ramp);
  }
  // Fingerposts at both ends of the underpass: the way to the projects, the beach and town.
  const W_ = Math.PI, E_ = 0, SEA = -Math.PI / 2, LAND = Math.PI / 2;
  place(makeFingerpost([
    { title: 'Projects', sub: 'stemma · Leash · Cat · dopepod', color: '#ffb020', angle: W_ },
    { title: 'Projects', sub: 'Coriolis · About · Blog · How', color: '#1fc9b7', angle: E_ },
    { title: 'Platja', sub: 'Beach · old pier', color: '#3d73c7', angle: SEA - 0.75 },
  ]), -4.3, GROUND_Y, -3.4);
  addCircle(-4.3, -3.4, 0.12, GROUND_Y + 3.5, 'pole', true, true);
  place(makeFingerpost([
    { title: 'Platja', sub: 'Projects · beach', color: '#ffb020', angle: SEA + 0.75 }, // into the underpass
    { title: 'Estació', sub: 'Rodalies', color: '#e5302a', angle: E_ },
    { title: 'Carrer del Mar', sub: 'Centre', color: '#2a5aa8', angle: LAND - 0.7 },
  ]), -4.4, GROUND_Y, 22.6);
  addCircle(-4.4, 22.6, 0.12, GROUND_Y + 3.5, 'pole', true, true);
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

  yield 'The seafront promenade';
  // ---- The seafront promenade ----------------------------------------------------------
  for (let x = -84; x <= 84; x += 24) {
    if (Math.abs(x) < 8) continue;
    addLamp(makeSpotMast(), x, GROUND_Y, -1.5);
  }
  // Extra promenade mast right beside spawn so pole whirling is an immediate first-screen hook.
  addLamp(makeSpotMast(), -24, GROUND_Y, -1.5);
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

  yield 'Boardwalk pavilions: the projects, the blog and about';
  // ---- Boardwalk pavilions: the projects, the blog and about -------------------------
  const seafrontLayout = SEAFRONT_LAYOUT.districts.find((d) => d.id === 'seafront')!;
  const pavilions = seafrontLayout.pavilions;
  const PZ0 = pavilions[0].z0, PZ1 = pavilions[0].z1;
  let catScreenMesh: THREE.Mesh | null = null;
  let catScreenPos = { x: -58.2, y: GROUND_Y + 1.38, z: PZ1 + 0.13, w: 3.84, h: 2.4 };
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
    const awningRoll = cyl(0.14, 0.14, p.w + 0.56, M(accent, 0.55), 10);
    awningRoll.rotation.z = Math.PI / 2;
    awningRoll.position.set(0, h - 0.3, (PZ1 - PZ0) / 2 + 2.18);
    g.add(awningRoll);
    // Rounded front pilasters + canopy posts.
    for (const sx of [-(p.w / 2 - 0.08), p.w / 2 - 0.08]) {
      const pil = cyl(0.12, 0.12, h, M(0xe8e1d5, 0.78), 10);
      pil.position.set(sx, h / 2, (PZ1 - PZ0) / 2);
      g.add(pil);
    }
    for (const sx of [-p.w / 2, p.w / 2]) {
      const post = cyl(0.06, 0.06, h, M(0xe9e6df, 0.6, 0.3), 8);
      post.position.set(sx, h / 2, (PZ1 - PZ0) / 2 + 2.1);
      g.add(post);
    }
    if (p.id !== 'coriolis') {
      const winW = p.w * 0.66;
      const winX = -p.w * 0.12;
      const winZ = (PZ1 - PZ0) / 2;
      // Sunlit shop interior display backing, shelves, and small props behind glazing.
      const bay = box(winW - 0.12, 2.46, 0.04, new THREE.MeshStandardMaterial({
        color: 0xfff0d4, emissive: 0x4a3519, emissiveIntensity: 0.42, roughness: 0.88,
      }));
      bay.position.set(winX, 1.45, winZ - 0.04);
      g.add(bay);
      const woodM = M(0x8c6442, 0.78);
      for (const sy of [0.95, 1.75]) {
        const shelf = box(winW - 0.24, 0.07, 0.12, woodM);
        shelf.position.set(winX, sy, winZ + 0.02);
        g.add(shelf);
        for (let k = -2; k <= 2; k++) {
          const itemC = k % 2 === 0 ? accent : (k + 2) % 3 === 0 ? 0xf4f1ea : 0x1fc9b7;
          const item = box(0.24, 0.22 + ((Math.abs(k) + (sy > 1.3 ? 1 : 0)) % 2) * 0.1, 0.1, M(itemC, 0.55));
          item.position.set(winX + k * (winW * 0.16), sy + 0.15, winZ + 0.03);
          g.add(item);
        }
      }
      for (const mx of [winX - winW * 0.48, winX, winX + winW * 0.48]) {
        const mul = box(0.06, 2.55, 0.08, woodM);
        mul.position.set(mx, 1.45, winZ + 0.04);
        g.add(mul);
      }
      const glass = box(winW, 2.6, 0.06, shopGlassMat);
      glass.position.set(winX, 1.45, winZ + 0.04);
      g.add(glass);
      const bTex = opts.boothScreens?.[p.id];
      if (bTex) {
        const sw = p.id === 'stemma' ? 3.04 : p.id === 'eat-prey-nap' ? 3.84 : p.id === 'blog' ? 3.2 : 3.52;
        const sh = sw / 1.6;
        const sx = p.id === 'stemma' ? -0.3 : -p.w * 0.12;
        const sy = p.id === 'eat-prey-nap' ? 1.38 : 1.5;
        const sz = (PZ1 - PZ0) / 2 + 0.11;
        const scrFrame = box(sw + 0.16, sh + 0.16, 0.05, M(0x0b1224, 0.45, 0.35));
        scrFrame.position.set(sx, sy, sz - 0.025);
        g.add(scrFrame);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: bTex }));
        scr.position.set(sx, sy, sz + 0.01);
        scr.name = `booth-${p.id}`;
        g.add(scr);
        if (p.id === 'eat-prey-nap') {
          catScreenMesh = scr;
          catScreenPos = { x: p.x + sx, y: GROUND_Y + sy, z: (PZ0 + PZ1) / 2 + sz + 0.01, w: sw, h: sh };
        }
      }
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
  // Start-view boardwalk life: festive bunting, planter pots, cafe sets, and parked bicycles.
  root.add(makeBunting(new THREE.Vector3(-25, GROUND_Y + 3.85, PZ1 + 2.1), new THREE.Vector3(-19, GROUND_Y + 3.85, PZ1 + 2.1)));
  for (const [fx, fz, fc] of [
    [-25.4, -10.2, 0xe5487a],
    [-18.6, -10.2, 0xffb020],
    [-36.5, -10.2, 0xffb020],
    [-9.5, -10.2, 0x1fc9b7],
  ] as [number, number, number][]) {
    place(makePlanterPot(fc), fx, GROUND_Y, fz, fx);
    addCircle(fx, fz, 0.34, GROUND_Y + 0.9, 'pot', true, false);
  }
  for (const [tx, tz, col] of [[-28.6, -8.8, 0xffb020], [-13.8, -8.8, 0x1fc9b7]] as [number, number, number][]) {
    place(makeCafeSet(col), tx, GROUND_Y, tz, tx);
    addCircle(tx, tz, 0.5, GROUND_Y + 0.8, 'table', false, false);
  }
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 6, 14, Math.PI), M(0x2a2f3d, 0.4, 0.6));
  hoop.position.set(-17.35, GROUND_Y, -8.5);
  root.add(hoop);
  place(makeParkedBike(0xe5302a), -17.8, GROUND_Y, -8.5, 0.35);
  place(makeParkedBike(0x1fc9b7), -16.9, GROUND_Y, -8.5, 0.15);
  boxes.push({ x0: -18.4, x1: -16.3, z0: -9.0, z1: -8.0, top: GROUND_Y + 1.0, kind: 'bike' });
  // About: a little terrace in front of the café.
  for (const tx of [24, 31]) {
    place(makeCafeSet(0x8bcb3c), tx, GROUND_Y, -9.8, r() * 3);
    addCircle(tx, -9.8, 0.5, GROUND_Y + 0.8, 'table', false, false);
  }
  // Blog: racks of magazines out front.
  place(makeKiosk(0xe5487a), 40, GROUND_Y, -10.6, 0);
  boxes.push({ x0: 38.7, x1: 41.3, z0: -11.5, z1: -9.7, top: GROUND_Y + 2.8, kind: 'kiosk' });
  // Eat Prey Nap: low straw-yellow play cushion outside for booth Tofu.
  const eatPav = pavilions.find((p) => p.id === 'eat-prey-nap')!;
  const tofuPad = cyl(0.62, 0.68, 0.07, M(0xe3d39d, 0.9), 18);
  tofuPad.position.set(eatPav.x - 1.2, GROUND_Y + 0.035, PZ1 + 1.1);
  root.add(tofuPad);
  // dopepod: warm studio monitor speaker & broadcast mic stand out front.
  const podPav = pavilions.find((p) => p.id === 'dopepod')!;
  const podSpk = box(0.58, 0.98, 0.48, M(0x161b29, 0.55));
  podSpk.position.set(podPav.x - 4.2, GROUND_Y + 0.49, PZ1 + 0.72);
  root.add(podSpk);
  const podWoofer = cyl(0.18, 0.18, 0.04, M(0xd94ca6, 0.4), 14);
  podWoofer.rotation.x = Math.PI / 2;
  podWoofer.position.set(podPav.x - 4.2, GROUND_Y + 0.58, PZ1 + 0.98);
  root.add(podWoofer);
  boxes.push({ x0: podPav.x - 4.5, x1: podPav.x - 3.9, z0: PZ1 + 0.45, z1: PZ1 + 1.0, top: GROUND_Y + 0.98, kind: 'speaker' });
  const micStand = cyl(0.03, 0.04, 1.35, ironM, 8);
  micStand.position.set(podPav.x + 2.0, GROUND_Y + 0.68, PZ1 + 0.75);
  root.add(micStand);
  const micHead = cyl(0.07, 0.06, 0.16, M(0xd94ca6, 0.35, 0.6), 10);
  micHead.position.set(podPav.x + 2.0, GROUND_Y + 1.4, PZ1 + 0.75);
  root.add(micHead);
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
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1, 0.08), new THREE.MeshStandardMaterial({ color: barCols[i], emissive: barCols[i], emissiveIntensity: 1 }));
    m.position.set(stem.x - 3.65 + i * 0.42, GROUND_Y + 0.6, PZ1 + 0.12);
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

  yield 'Beach';
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
  // Pier-side fish bucket: draws greedy gulls if Millie barks near it.
  const fishBucketPos = { x: -44.5, z: -21.5 };
  {
    const fbY = sandFloor(fishBucketPos.z);
    const fb = new THREE.Group();
    const bucket = cyl(0.24, 0.18, 0.34, M(0x88929e, 0.35, 0.65), 12);
    bucket.position.y = 0.17;
    fb.add(bucket);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 6, 14), M(0x6e7884, 0.3, 0.7));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.34;
    fb.add(rim);
    const fishM = M(0x7ca2bd, 0.28, 0.55);
    for (let i = 0; i < 3; i++) {
      const fish = cyl(0.015, 0.045, 0.24, fishM, 7);
      fish.position.set((i - 1) * 0.07, 0.36, (i % 2 ? 0.04 : -0.04));
      fish.rotation.set(0.35 * (i % 2 ? 1 : -1), i * 0.7, 0.45 - i * 0.38);
      fb.add(fish);
    }
    place(shadowed(fb), fishBucketPos.x, fbY, fishBucketPos.z);
    addCircle(fishBucketPos.x, fishBucketPos.z, 0.3, fbY + 0.45, 'bucket', false, false);
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

  yield 'Swim zone';
  // ---- Swim zone: an orange buoy line on a floating rope ----------------------------
  {
    const S = SWIM, shoreZ = -60, y = WATER_Y + 0.05;
    const buoyGeo = new THREE.SphereGeometry(0.22, 10, 8);
    const ropeM = M(0xf4f1ea, 0.7);
    const line = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      for (let s = 0, k = 0; s <= len; s += 2.5, k++) {
        const t = s / len;
        inst.add(k % 5 === 0 ? 'buoyY' : 'buoyO', buoyGeo, () => M(k % 5 === 0 ? 0xffc93c : 0xff7a2a, 0.45), mtx(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t), false);
      }
      const rope = box(len, 0.03, 0.03, ropeM);
      rope.position.set((x0 + x1) / 2, y + 0.02, (z0 + z1) / 2);
      rope.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      root.add(rope);
      // Solid for swimmers: Millie can't slip under or over it.
      boxes.push({ x0: Math.min(x0, x1) - 0.2, x1: Math.max(x0, x1) + 0.2, z0: Math.min(z0, z1) - 0.2, z1: Math.max(z0, z1) + 0.2, top: WATER_Y + 1.6, kind: 'buoys' });
    };
    line(S.x0, S.z, S.x1, S.z);
    line(S.x0, shoreZ, S.x0, S.z);
    line(S.x1, shoreZ, S.x1, S.z);
  }

  yield 'Pipicà';
  // ---- Pipicà ---------------------------------------------------------------------------
  const P = PIPICA;
  const pFence = M(0x2f6b4f, 0.55, 0.4);
  const pTop = SAND_Y + 1.3;
  const fenceSeg = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (let s = 0; s <= len; s += 0.25) {
      const t = s / len;
      inst.add('pbar', () => new THREE.BoxGeometry(0.03, 1.2, 0.03), pFence, mtx(x0 + (x1 - x0) * t, SAND_Y + 0.6, z0 + (z1 - z0) * t), false);
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

  yield 'The old oil pier';
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

  yield 'Horizon: the Tres Xemeneies to the southwest, the Serralada inland';
  // ---- Horizon: the Tres Xemeneies to the southwest, the Serralada inland ------------
  const xem = makeXemeneies();
  xem.position.set(-760, WATER_Y, -120);
  xem.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m) m.fog = false; });
  xem.scale.setScalar(0.9);
  xem.userData.always = true;
  root.add(xem);
  // Hills inland (+Z), the city's skyline far down the coast behind the chimneys (-X).
  root.add(makeInlandHills(WATER_Y - 12));
  root.add(makeCitySkyline(WATER_Y - 2));
  const churchLandmark = makeChurchLandmark();
  root.add(churchLandmark);

  const poles: Obstacle[] = circles.filter((c) => c.obstacle).map((c) => c.obstacle!);

  yield 'Stops (doors of the pavilions)';
  // ---- Stops (doors of the pavilions) --------------------------------------------------
  const stops: Stop[] = [
    ...pavilions.map((p) => ({
      id: p.id,
      label: p.title,
      kind: p.sub,
      href: p.href,
      color: p.color,
      x: p.id === 'coriolis' ? p.x + p.w / 2 - 0.6 : p.id === 'blog' ? 40 : p.x + p.w * 0.34,
      z: p.id === 'blog' ? -9.0 : PZ1 + 1.2,
      r: p.id === 'blog' ? 2.6 : 2.4,
    })),
    ...stops0,
  ];

  yield 'Floor, surfaces, bounds';
  // ---- Floor, surfaces, bounds ---------------------------------------------------------
  const onPier = (x: number, z: number) => x >= PIER.x0 && x <= PIER.x1 && z <= PIER.root && z >= PIER.end;
  const seafrontFloor = (x: number, z: number, y: number): number => {
    if (onPier(x, z)) {
      const d = pierDeckY(z);
      if (z > PIER.rise + 2 || y > d - 0.9) return d;
    }
    if (Math.abs(x) <= CUT.x && z < CUT.rambla0 && z > CUT.sea1) return cutY(z);
    if (z >= -20) return GROUND_Y;
    for (const rx of RAMPS) if (Math.abs(x - rx) <= 1.5 && z > -23.2) return GROUND_Y + ((z + 20) / 3.2) * (GROUND_Y - SAND_Y);
    return sandFloor(z);
  };
  const seafrontSurface = (x: number, z: number, y: number): Surface => {
    if (onPier(x, z) && y > pierDeckY(z) - 0.9) return 'deck';
    if (z >= -20 || (Math.abs(x) <= CUT.x && z < CUT.rambla0 && z > CUT.sea1)) return z < -10 && z >= -20 ? 'deck' : 'paving';
    return sandFloor(z) < WATER_Y ? 'water' : 'sand';
  };
  yield 'Districts';
  // ---- Districts ---------------------------------------------------------------------
  const inCut = (x: number, z: number) => Math.abs(x) <= CUT.x && z < CUT.rambla0 && z > CUT.sea1;
  const BIG = 1e5;
  const layoutById = new Map(SEAFRONT_LAYOUT.districts.map((d) => [d.id, d]));
  const districts: District[] = [
    { id: 'seafront', label: layoutById.get('seafront')!.label, bounds: layoutById.get('seafront')!.bounds, root: new THREE.Group(), floor: seafrontFloor, surface: seafrontSurface, built: true, baked: false, state: 'live' },
    {
      id: 'rambla', label: layoutById.get('rambla')!.label, bounds: layoutById.get('rambla')!.bounds, root: new THREE.Group(),
      floor: (x, z) => (inCut(x, z) ? cutY(z) : GROUND_Y), surface: () => 'paving', built: true, baked: false, state: 'live',
    },
    { id: 'town', label: layoutById.get('town')!.label, bounds: layoutById.get('town')!.bounds, root: new THREE.Group(), floor: () => GROUND_Y, surface: () => 'paving', built: true, baked: false, state: 'live' },
  ];
  const districtAt = (x: number, z: number) => districts.find((d) => inBounds(d.bounds, x, z)) ?? districts[0];
  const floor = (x: number, z: number, y: number) => districtAt(x, z).floor(x, z, y);
  const surface = (x: number, z: number, y: number) => districtAt(x, z).surface(x, z, y);

  // Hand every built object to the district it sits in (by its bounding-box center);
  // the sea, foam and horizon stay in an always-on group.
  const tBuilt = performance.now();
  const horizon = new THREE.Group();
  horizon.name = 'horizon';
  const bb = new THREE.Box3(), bc = new THREE.Vector3();
  for (const o of [...root.children]) {
    // Lights stay always-on: hiding one would change the light count and recompile every material.
    if (o.userData.always || (o as THREE.Light).isLight) { horizon.add(o); continue; }
    bb.setFromObject(o);
    if (bb.isEmpty()) bc.copy(o.position); else bb.getCenter(bc);
    districtAt(bc.x, bc.z).root.add(o);
  }
  for (const d of districts) { d.root.name = d.id; root.add(d.root); }
  root.add(horizon);
  const townFlush = townBuilder.flushSteps(districts[2].root);
  while (!townFlush.next().done) yield 'Buildings';
  const tSplit = performance.now();
  yield 'Instancing';
  inst.build((x, z) => districtAt(x, z).root);
  yield 'Horizon';
  // Districts bake later, in steps, nearest first (the Streamer); the horizon is small.
  for (const d of districts) {
    const originZ = Math.abs(d.bounds.z0) < BIG ? d.bounds.z0 : d.bounds.z1;
    d.bake = () => bakeSteps(d.root, originZ);
  }
  bakeStatic(horizon);
  const tBaked = performance.now();

  yield 'Colliders';
  // Colliders into the grid, tagged with their district.
  const grid = new ColliderGrid(8);
  for (const b of boxes) { b.district = b.district ?? districtAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2).id; grid.addBox(b); }
  for (const c of circles) { c.district = districtAt(c.x, c.z).id; grid.addCircle(c); }
  // Plaça del Mercat (plaza.ts): streams in when Millie heads up Carrer del Mar.
  const plazaGlass = makeLanternPost().glass;
  lampGlass.push(plazaGlass);
  for (const [x, z] of PLAZA.lamps) lampSpots.push(new THREE.Vector3(x, GROUND_Y + 4.4, z));
  const plaza = makePlazaDistrict({
    groundY: GROUND_Y, grid, layout: layoutById.get('plaza')!, ground, newInstancer: () => new Instancer(), r,
    mats: {
      flag: flagMat, flagTile: flag.tileMeters, panot: panotMat, panotTile: panot.tileMeters, sand: sandMat,
      wall: wallPlasterMat, litWindow: litWindowMat, darkWindow: darkWindowMat, iron: ironM, lampGlass: plazaGlass,
    },
  });
  districts.push(plaza);
  root.add(plaza.root);
  bowls.push({ ...PLAZA.bowl });
  fountains.push({ ...PLAZA.drink });
  // Dalt de la Vila (hill.ts): streams in beyond Carrer Major.
  const hillGlass = makeLanternPost().glass;
  lampGlass.push(hillGlass);
  for (const [x, z] of HILL.lamps) lampSpots.push(new THREE.Vector3(x, hillFloor(x, z) + 4.4, z));
  const hill = makeHillDistrict({
    groundY: GROUND_Y, grid, layout: layoutById.get('hill')!, ground, newInstancer: () => new Instancer(), r,
    mats: {
      flag: flagMat, flagTile: flag.tileMeters, panot: panotMat, panotTile: panot.tileMeters, sand: sandMat,
      wall: wallPlasterMat, litWindow: litWindowMat, darkWindow: darkWindowMat, iron: ironM, lampGlass: hillGlass,
    },
  });
  districts.push(hill);
  root.add(hill.root);
  bowls.push({ ...HILL.bowl });
  fountains.push({ ...HILL.drink });
  // The Marina & Breakwater (marina.ts): streams in west beyond the seafront promenade.
  const marinaGlass = makeLanternPost().glass;
  lampGlass.push(marinaGlass);
  for (const [x, z] of MARINA.lamps) lampSpots.push(new THREE.Vector3(x, (z < -27 ? BREAKWATER_Y : GROUND_Y) + 4.4, z));
  const marina = makeMarinaDistrict({
    groundY: GROUND_Y, grid, layout: layoutById.get('marina')!, ground, newInstancer: () => new Instancer(), r,
    mats: {
      conc: concMat, concTile: conc.tileMeters, panot: panotMat, panotTile: panot.tileMeters,
      deck: deckMat, sand: sandMat, water: waterMat,
      litWindow: litWindowMat, darkWindow: darkWindowMat, iron: ironM, lampGlass: marinaGlass,
    },
  });
  districts.push(marina);
  root.add(marina.root);
  bowls.push({ ...MARINA.bowl });
  fountains.push({ ...MARINA.drink });
  // Stand-ins: colored blocks, pavilions and landmarks built straight from the layout data.
  const standins = new THREE.Group();
  standins.name = 'standins';
  for (const d of districts) {
    const ld = layoutById.get(d.id);
    const s = ld ? buildDistrictStandin(ld, GROUND_Y) : undefined;
    if (!s) continue;
    d.standin = s;
    standins.add(s);
  }
  root.add(standins);
  /** Add a collider after the build (props placed by the game's systems). */
  const addRuntimeCircle = (c: CircleCollider) => { c.district = districtAt(c.x, c.z).id; circles.push(c); grid.addCircle(c); };

  /** Which pipicà (x, z) is in: 0 beach, 1 Plaça del Mercat, 2 Dalt de la Vila, 3 Marina, -1 neither. */
  const pipicaAt = (x: number, z: number) => (x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1 ? 0 : inPlazaPipica(x, z) ? 1 : inHillPipica(x, z) ? 2 : inMarinaPipica(x, z) ? 3 : -1);
  const inPipica = (x: number, z: number) => pipicaAt(x, z) >= 0;
  /** Where Millie's human waits while she's off the leash in each pipicà. */
  const pipicaBenches: { x: number; z: number; heading?: number }[] = [
    humanBench,
    PLAZA.pipicaBench,
    { ...HILL.pipicaBench, heading: Math.PI },
    { ...MARINA.pipicaBench, heading: Math.PI },
  ];
  const clampBounds = (p: { x: number; z: number; y: number }) => {
    // Carrer del Mar and its side streets; beyond it the plaza, Carrer Major, and Dalt de la Vila.
    if (p.z > 34 && p.z < PLAZA.z0) { p.x = Math.max(-33.6, Math.min(33.6, p.x)); return; }
    if (p.z >= PLAZA.z0 && p.z < HILL.z0) {
      p.x = Math.max(PLAZA.street.x0 + 0.4, Math.min(PLAZA.street.x1 - 0.4, p.x));
      if (p.z > PLAZA.street.z1 - 0.4 && Math.abs(p.x) >= 2.9) p.z = PLAZA.street.z1 - 0.4;
      return;
    }
    if (p.z >= HILL.z0) {
      p.z = Math.min(p.z, HILL.maxZ);
      p.x = Math.max(HILL.minX, Math.min(HILL.maxX, p.x));
      return;
    }
    if (p.z < 4 && p.x < -91.5) {
      p.x = Math.max(-222, p.x);
      p.z = Math.max(-108, Math.min(3.6, p.z));
      return;
    }
    p.x = Math.max(-91.5, Math.min(91.5, p.x));
    // Out to the buoy line inside the swim zone; to the shallows elsewhere.
    if (!onPier(p.x, p.z)) p.z = Math.max(p.z, p.x > SWIM.x0 && p.x < SWIM.x1 ? SWIM.z + 0.3 : -64);
  };

  yield 'Paths for pedestrians';
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
    [[-80, -10.7], [-66, -10.7], [-53, -10.7]],
    [[-80, -54], [0, -55], [80, -54]],
    [[-48, -12], [-48, -60], [-48, -126]],
    ...PLAZA.pedPaths,
    ...HILL.pedPaths,
    ...MARINA.pedPaths,
  ];

  return {
    root, layout: SEAFRONT_LAYOUT, boxes, circles, poles, stops, mounds, lampSpots, lampGlass, litWindowMat, wetMats,
    floor, surface, inPipica, pipicaAt, pipicaBenches, clampBounds, ramps: RAMPS, grid, districts, districtAt, addRuntimeCircle,
    churchLandmark,
    /** Where the build time goes (ms): building props, splitting into districts, instancing + baking. */
    timings: { build: tBuilt - T0, split: tSplit - tBuilt, bake: tBaked - tSplit },
    waterMat, foamMat, sea, sunbathers, fishers, hurdles, bowls, fountains, humanBench, terraceSeats,
    dimoni: { ...dimoni, x: 24, z: -38, glow: dimoniGlow },
    fishBucket: fishBucketPos,
    pierEnd: { x: (PIER.x0 + PIER.x1) / 2, z: PIER.end + 4 },
    beacon: beacon.lamp,
    coriolis: { x: wallX, y: wallY, z: wallZ, screen },
    stemma: { x: stem.x, z: PZ1 + 1.6 },
    catScreen: { ...catScreenPos, mesh: catScreenMesh, viewX: eatPav.x - 1.2, viewZ: PZ1 + 1.6 },
    boothTofuAnchor: { x: eatPav.x - 1.2, z: PZ1 + 1.1 },
    dopepod: { x: podPav.x, z: PZ1 + 1.6 },
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
    // Arriving by metro: up the stairs, heading west along the Rambla.
    metro: { dog: { x: metro.head.x - 1.3, z: metro.head.z }, human: { x: metro.head.x + 0.2, z: metro.head.z + 0.5 }, heading: Math.PI },
  };
}

/** Build the whole level right now. */
export function buildLevel(scene: THREE.Scene, opts: LevelOpts) {
  return drain(buildLevelSteps(scene, opts));
}

/** Count of the build's steps, for a loading bar. */
export const LEVEL_STEPS = 53;

/** Wait for the next frame (or a moment, if the tab is hidden and frames are paused). */
export const nextFrame = () => new Promise<void>((res) => {
  const t = setTimeout(res, 50);
  requestAnimationFrame(() => { clearTimeout(t); res(); });
});

/** Run a generator under a time budget per frame, reporting progress after each slice. */
export async function runSliced<Y, R>(g: Generator<Y, R, void>, onSlice?: (last: Y | undefined) => void, budgetMs = 12): Promise<R> {
  for (;;) {
    const t0 = performance.now();
    let r: IteratorResult<Y, R>;
    let last: Y | undefined;
    do { r = g.next(); if (!r.done) last = r.value; } while (!r.done && performance.now() - t0 < budgetMs);
    if (r.done) return r.value;
    onSlice?.(last);
    await nextFrame();
  }
}

export type Level = ReturnType<typeof buildLevel>;
