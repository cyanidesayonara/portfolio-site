/*
  Phase 3: the first district beyond Carrer del Mar. The street opens into a town
  square (Plaça del Mercat) with a fountain, plane trees, a newsstand, a café
  terrace and a second pipicà, with the market hall on its far side and a
  pedestrian shopping street (Carrer Major) behind it.

  The district streams: its buildings come from the layout data (data/seafront.json,
  district "plaza"); everything here is built in small steps when Millie gets close
  and torn down when she's far away. Colliders go straight into the collider grid,
  tagged "plaza", so the Streamer can drop them on unload. The runtime side (NPCs,
  quests, the butcher's chase) lives in plazaLife.ts and uses the positions below.
*/
import * as THREE from 'three';
import { M, box, cyl, shadowed, makeBench, makeWaterBowl, makeFountain, makePlaneTree, makeKiosk, makeCafeSet, makeFruitCrate } from './models';
import { makeLanternPost, makeBunting, makeFingerpost } from './props';
import { DirectBuilder } from './meshbuilder';
import { bakeSteps } from './bake';
import { SEAFRONT_LAYOUT, buildDistrictBlocksSteps, type DistrictData, type InstanceSink } from './layout';
import { signTexture } from './textures';
import type { ColliderGrid, District } from './world';
import type { BoxCollider, CircleCollider } from './level';

const PIP = SEAFRONT_LAYOUT.pipica2;

/** Where things are, shared with the runtime systems (plazaLife.ts) and the level. */
export const PLAZA = {
  id: 'plaza',
  z0: 101,
  /** The middle of the square: NPCs are hidden and paused when Millie is far from it. */
  center: { x: 0, z: 128 },
  square: { x0: -20, x1: 20, z0: 101, z1: 139 },
  street: { x0: -62, x1: 62, z0: 155, z1: 161 },
  fountain: { x: 0, z: 114, r: 2.7 },
  /** A small drinking fountain by the square's entrance. */
  drink: { x: -18.6, z: 103.4 },
  kiosk: { x: -13, z: 106 },
  paper: { x: -11.5, z: 106.2 },
  grandpa: { x: -6, z: 121.7 },
  terrace: { x0: -19.5, x1: -10, z0: 123, z1: 134.5 },
  tables: [[-17, 125], [-13.5, 127.6], [-17, 130.2], [-13.5, 132.8]] as [number, number][],
  waiter: { x: -9.2, z: 128.6 },
  market: { x0: -14, x1: 14, z0: 139, z1: 151 },
  stall: { x0: -10, x1: -4, z0: 136.2, z1: 137.6 },
  flowerStall: { x0: 4, x1: 10, z0: 136.2, z1: 137.6 },
  butcher: { x: -7, z: 138.4 },
  florist: { x: 7, z: 138.4 },
  /** Where Millie stands to snatch the botifarra off the counter. */
  grab: { x: -7, z: 135.5 },
  pipica: PIP,
  pipicaBench: { x: PIP.x0 - 2.6, z: (PIP.gateZ0 + PIP.gateZ1) / 2 },
  regular: { x: 12.5, z: 131.5 },
  bowl: { x: PIP.x1 - 1.1, z: PIP.z0 + 1.4 },
  lamps: [[-6, 104.2], [6, 104.2], [-5.5, 133.5], [4, 134.5], [-50, 160.4], [-25, 155.6], [0, 160.4], [25, 155.6], [50, 160.4]] as [number, number][],
  trees: [[-17, 104], [-17, 110], [-17, 116], [17, 104], [17, 110], [17, 116], [17, 122], [-17, 121]] as [number, number][],
  /** Pedestrian paths for the town's walkers. */
  pedPaths: [
    [[-1.4, 99], [-8, 108], [-9, 120], [-2, 135], [-17, 141], [-17, 157.6], [-50, 157.8]],
    [[50, 158.4], [17, 158.2], [17, 141], [3, 136], [9, 120], [8, 108], [1.4, 99]],
    [[-58, 157.2], [-20, 157.4], [20, 157.2], [58, 157.4]],
    [[-8, 133], [0, 135], [5.5, 134], [5.5, 124], [-7, 124]],
  ] as [number, number][][],
};

export const inPlazaPipica = (x: number, z: number) => x > PIP.x0 && x < PIP.x1 && z > PIP.z0 && z < PIP.z1;

export interface PlazaEnv {
  groundY: number;
  grid: ColliderGrid;
  layout: DistrictData;
  ground: (x0: number, x1: number, z0: number, z1: number, y: number, mat: THREE.Material, tile: number) => THREE.Mesh;
  newInstancer: () => InstanceSink & { build(assign: (x: number, z: number) => THREE.Object3D): void };
  mats: {
    flag: THREE.Material; flagTile: number;
    panot: THREE.Material; panotTile: number;
    sand: THREE.Material;
    wall: THREE.MeshStandardMaterial;
    litWindow: THREE.Material;
    darkWindow: THREE.Material;
    iron: THREE.Material;
    /** Shared by every lamp so day/night changes reach lamps built later. */
    lampGlass: THREE.MeshStandardMaterial;
  };
  r: () => number;
}

/** The plaza as a streamable district. */
export function makePlazaDistrict(env: PlazaEnv): District {
  const { groundY: Y } = env;
  const d: District = {
    id: PLAZA.id, label: env.layout.label, bounds: env.layout.bounds, root: new THREE.Group(),
    floor: () => Y,
    surface: (x, z) => (inPlazaPipica(x, z) ? 'sand' : 'paving'),
    built: false, baked: false, state: 'standin',
    build: () => buildPlazaSteps(env, d),
    bake: () => bakeSteps(d.root, PLAZA.z0),
    unload: () => {
      d.root.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); });
      d.root.clear();
    },
  };
  d.root.name = PLAZA.id;
  return d;
}

function* buildPlazaSteps(env: PlazaEnv, d: District): Generator<void, void, void> {
  const { groundY: Y, grid, mats, r } = env;
  const root = d.root;
  const place = (o: THREE.Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    root.add(o);
    return o;
  };
  const addBox = (b: Omit<BoxCollider, 'district'>) => grid.addBox({ ...b, district: PLAZA.id });
  const addCircle = (x: number, z: number, rr: number, top: number, kind: string, canPee: boolean, canWhirl: boolean) => {
    const c: CircleCollider = { x, z, r: rr, top, kind, canPee, canWhirl, marked: false, district: PLAZA.id };
    if (canWhirl || kind === 'tree') c.obstacle = { x, z, r: rr, kind: 'pole' };
    else if (['bench', 'bin', 'fountain', 'table'].includes(kind)) c.obstacle = { x, z, r: rr, kind: 'furniture' };
    grid.addCircle(c);
  };

  // ---- Ground: flagstones on the square, panots elsewhere, sand in the pipicà ----
  root.add(env.ground(-20, 20, 101, 139, Y + 0.002, mats.flag, mats.flagTile));
  root.add(env.ground(-62, 62, 139, 161, Y, mats.panot, mats.panotTile));
  root.add(env.ground(-3.2, 3.2, 161, 173.2, Y + 0.001, mats.panot, mats.panotTile));
  root.add(env.ground(-41, -20, 101, 139, Y - 0.001, mats.panot, mats.panotTile));
  root.add(env.ground(20, 41, 101, 139, Y - 0.001, mats.panot, mats.panotTile));
  root.add(env.ground(PIP.x0, PIP.x1, PIP.z0, PIP.z1, Y + 0.006, mats.sand, 4));
  yield;

  // ---- Buildings from the layout data ----
  const builder = new DirectBuilder(PLAZA.z0);
  const inst = env.newInstancer();
  const boxes: BoxCollider[] = [];
  const blocks = buildDistrictBlocksSteps(env.layout, {
    groundY: Y, builder, wallMat: mats.wall, inst, boxes,
    litWindowMat: mats.litWindow, darkWindowMat: mats.darkWindow, ironMat: mats.iron, r,
  });
  while (!blocks.next().done) yield;
  for (const b of boxes) grid.addBox(b);

  // ---- The market hall: brick, tall arched windows, a zinc roof and a big door ----
  const MK = PLAZA.market;
  const brick = 0xc98f6a, stone = 0xe6dcc6, zinc = 0x6f7d84, dark = 0x2c3850;
  builder.addBox(MK.x0, Y, MK.z0, MK.x1, Y + 8.4, MK.z1, brick);
  builder.addBox(MK.x0 - 0.3, Y + 8.4, MK.z0 - 0.3, MK.x1 + 0.3, Y + 8.9, MK.z1 + 0.3, stone);
  builder.addBox(MK.x0 + 1, Y + 8.9, MK.z0 + 1, MK.x1 - 1, Y + 10.4, MK.z1 - 1, zinc); // clerestory
  builder.addBox(MK.x0 + 3, Y + 10.4, MK.z0 + 2.5, MK.x1 - 3, Y + 11.2, MK.z1 - 2.5, zinc);
  for (let x = MK.x0 + 2.2; x < MK.x1 - 1; x += 3.4) {
    if (Math.abs(x + 0.6) < 2.6) continue; // the doorway
    builder.addBox(x, Y + 1.2, MK.z0 - 0.06, x + 1.4, Y + 6.6, MK.z0 + 0.02, dark);
    builder.addBox(x - 0.2, Y + 6.6, MK.z0 - 0.1, x + 1.6, Y + 7.0, MK.z0, stone);
  }
  builder.addBox(-2.4, Y, MK.z0 - 0.06, 2.4, Y + 4.2, MK.z0 + 0.02, 0x1d2433); // doorway
  builder.addBox(-2.8, Y + 4.2, MK.z0 - 0.14, 2.8, Y + 4.6, MK.z0, stone);
  // Market entrance clock gable and warm lantern sconces flanking the portal.
  builder.addBox(-1.6, Y + 8.9, MK.z0 - 0.25, 1.6, Y + 10.6, MK.z0 + 0.1, stone);
  builder.addBox(-0.85, Y + 9.15, MK.z0 - 0.3, 0.85, Y + 10.35, MK.z0 - 0.22, 0xf4efe4);
  builder.addBox(-1.8, Y + 10.6, MK.z0 - 0.32, 1.8, Y + 10.85, MK.z0 + 0.15, zinc);
  // Square planters flanking the market door and the square entrance.
  const potMat = M(0xb2563a, 0.85);
  const bushMat = M(0x4e8c40, 0.85, 0, { flatShading: true });
  const bushGeo = new THREE.IcosahedronGeometry(0.36, 1);
  for (const [px, pz] of [[-3.3, MK.z0 - 0.5], [3.3, MK.z0 - 0.5], [-5.2, 102.2], [5.2, 102.2]]) {
    place(cyl(0.28, 0.21, 0.42, potMat, 10), px, Y + 0.21, pz);
    place(new THREE.Mesh(bushGeo, bushMat), px, Y + 0.62, pz);
    addBox({ x0: px - 0.35, x1: px + 0.35, z0: pz - 0.35, z1: pz + 0.35, top: Y + 1.0, kind: 'planter' });
  }
  for (const x of [MK.x0, MK.x1 - 0.5]) builder.addBox(x, Y, MK.z0 - 0.15, x + 0.5, Y + 8.4, MK.z0 + 0.2, stone); // corner pilasters
  addBox({ x0: MK.x0, x1: MK.x1, z0: MK.z0, z1: MK.z1, top: Y + 11, kind: 'building' });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.2, 0.1), new THREE.MeshStandardMaterial({ map: signTexture('MERCAT', 'Market hall', '#e5487a', { aspect: 6 }), roughness: 0.7 }));
  place(sign, 0, Y + 7.6, MK.z0 - 0.12);
  yield;

  // ---- The butcher's stall (west) and produce/flower stall (east) out front ----
  const S = PLAZA.stall;
  builder.addBox(S.x0, Y, S.z0, S.x1, Y + 0.95, S.z1, 0xf4f1ea);
  for (let x = S.x0; x < S.x1 - 0.1; x += 0.6) builder.addBox(x, Y + 0.1, S.z0 - 0.01, x + 0.3, Y + 0.85, S.z0, 0xc23b32);
  builder.addBox(S.x0 - 0.1, Y + 0.95, S.z0 - 0.1, S.x1 + 0.1, Y + 1.02, S.z1 + 0.1, 0x9a8a78); // counter top
  for (const x of [S.x0 + 0.05, S.x1 - 0.12]) builder.addBox(x, Y, S.z1 + 0.6, x + 0.07, Y + 2.6, S.z1 + 0.67, 0x3d3d45);
  for (let i = 0; i < 10; i++) {
    const x0 = S.x0 - 0.3 + i * 0.66;
    builder.addBox(x0, Y + 2.55, S.z0 - 0.5, x0 + 0.66, Y + 2.62, S.z1 + 0.7, i % 2 ? 0xf4f1ea : 0xc23b32);
  }
  // Strings of sausages hanging under the awning (the one on the counter is a prop in plazaLife).
  const saus = M(0x7a2a22, 0.6);
  for (let i = 0; i < 5; i++) {
    const s = cyl(0.05, 0.05, 0.42, saus, 6);
    place(s, S.x0 + 0.8 + i * 1.1, Y + 2.2, S.z0 + 0.2);
  }
  const stallSign = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.55, 0.06), new THREE.MeshStandardMaterial({ map: signTexture('Carnisseria', 'Butcher', '#c23b32', { aspect: 3.2 / 0.55 }), roughness: 0.7 }));
  place(stallSign, (S.x0 + S.x1) / 2, Y + 2.95, S.z0 - 0.5);
  addBox({ x0: S.x0, x1: S.x1, z0: S.z0, z1: S.z1, top: Y + 1.0, kind: 'stall' });
  yield;

  // East stall: flowers and market produce under a green-and-cream awning.
  const FST = PLAZA.flowerStall;
  builder.addBox(FST.x0, Y, FST.z0, FST.x1, Y + 0.9, FST.z1, 0x8c7362);
  builder.addBox(FST.x0 - 0.1, Y + 0.9, FST.z0 - 0.1, FST.x1 + 0.1, Y + 0.98, FST.z1 + 0.1, 0xd8cdb8);
  for (const x of [FST.x0 + 0.05, FST.x1 - 0.12]) builder.addBox(x, Y, FST.z1 + 0.6, x + 0.07, Y + 2.6, FST.z1 + 0.67, 0x3d3d45);
  for (let i = 0; i < 10; i++) {
    const x0 = FST.x0 - 0.3 + i * 0.66;
    builder.addBox(x0, Y + 2.55, FST.z0 - 0.5, x0 + 0.66, Y + 2.62, FST.z1 + 0.7, i % 2 ? 0xf4f1ea : 0x2f6b4f);
  }
  const bloomCols = [0xe5487a, 0xffb020, 0x8bcb3c, 0xf28a1e, 0xe8d45c];
  for (let i = 0; i < 5; i++) {
    const cx = FST.x0 + 0.6 + i * 1.2;
    builder.addBox(cx - 0.38, Y + 0.98, FST.z0 + 0.15, cx + 0.38, Y + 1.24, FST.z1 - 0.15, 0x7a5a3c);
    builder.addBox(cx - 0.32, Y + 1.24, FST.z0 + 0.2, cx + 0.32, Y + 1.44, FST.z1 - 0.2, bloomCols[i]);
  }
  addBox({ x0: FST.x0, x1: FST.x1, z0: FST.z0, z1: FST.z1, top: Y + 1.0, kind: 'stall' });
  yield;

  // ---- The fountain: a stone basin, a column and a spouting bowl ----
  const F = PLAZA.fountain;
  const stoneM = M(0xd9cfbd, 0.85);
  const basin = cyl(F.r - 0.1, F.r, 0.55, stoneM, 28);
  place(basin, F.x, Y + 0.275, F.z);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(F.r - 0.35, F.r - 0.35, 0.05, 28), M(0x5aa6c8, 0.15, 0.1, { transparent: true, opacity: 0.85 }));
  place(water, F.x, Y + 0.5, F.z);
  place(cyl(0.35, 0.5, 1.6, stoneM, 12), F.x, Y + 1.0, F.z);
  place(cyl(1.0, 0.25, 0.3, stoneM, 16), F.x, Y + 1.9, F.z);
  place(cyl(0.12, 0.18, 0.7, stoneM, 8), F.x, Y + 2.35, F.z);
  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.0, 14, 1, true), M(0xbfe6ff, 0.1, 0, { transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  spout.rotation.x = Math.PI;
  place(spout, F.x, Y + 2.2, F.z);
  spout.userData.dynamic = true; // see-through: keep it out of the bake
  addCircle(F.x, F.z, F.r, Y + 0.6, 'fountain', true, false);
  place(makeFountain(), PLAZA.drink.x, Y, PLAZA.drink.z, Math.PI / 2);
  addCircle(PLAZA.drink.x, PLAZA.drink.z, 0.25, Y + 1.1, 'fountain', true, false);
  yield;

  // ---- Plane trees, lamps, benches ----
  for (let i = 0; i < PLAZA.trees.length; i++) {
    const [x, z] = PLAZA.trees[i];
    const t = makePlaneTree(300 + i);
    place(t.group, x, Y, z, r() * Math.PI);
    addCircle(x, z, t.radius, Y + 3.4, 'tree', true, true);
    if (i % 2 === 1) yield;
  }
  for (const [x, z] of PLAZA.lamps) {
    const lamp = makeLanternPost();
    lamp.group.traverse((o) => { const m = o as THREE.Mesh; if (m.material === lamp.glass) m.material = mats.lampGlass; });
    place(lamp.group, x, Y, z);
    addCircle(x, z, lamp.radius, Y + 9, 'lamp', true, true);
  }
  yield;
  // Benches: the grandpa's facing the fountain, two more on its sides, one by the pipicà gate.
  const bench = (x: number, z: number, facing: '+z' | '-z' | '+x' | '-x') => {
    const ry = facing === '+z' ? 0 : facing === '-z' ? Math.PI : facing === '+x' ? Math.PI / 2 : -Math.PI / 2;
    place(makeBench(), x, Y, z, ry);
    const along = facing === '+z' || facing === '-z';
    addBox({ x0: x - (along ? 0.9 : 0.5), x1: x + (along ? 0.9 : 0.5), z0: z - (along ? 0.5 : 0.9), z1: z + (along ? 0.5 : 0.9), top: Y + 0.5, kind: 'bench' });
  };
  bench(PLAZA.grandpa.x, PLAZA.grandpa.z + 0.1, '-z');
  bench(6, 121.8, '-z');
  bench(-9.5, 112, '+x');
  bench(9.5, 112, '-x');
  bench(PLAZA.pipicaBench.x - 0.35, PLAZA.pipicaBench.z, '+x');
  yield;

  // ---- The newsstand and the café terrace ----
  const K = PLAZA.kiosk;
  place(makeKiosk(0x2a5aa8), K.x, Y, K.z, Math.PI / 2);
  addBox({ x0: K.x - 0.9, x1: K.x + 0.9, z0: K.z - 1.3, z1: K.z + 1.3, top: Y + 2.8, kind: 'kiosk' });
  for (const [x, z] of PLAZA.tables) {
    place(makeCafeSet(0xf4f1ea), x, Y, z, r() * 3);
    addCircle(x, z, 0.5, Y + 0.8, 'table', false, false);
  }
  const cafeSign = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 2.6), new THREE.MeshStandardMaterial({ map: signTexture('Cafè', 'Terrace', '#8bcb3c', { aspect: 2.6 / 0.7 }), roughness: 0.7 }));
  place(cafeSign, -19.9, Y + 3.4, 128.8);
  yield;

  // ---- The second pipicà: a fenced sandy dog park in the square's corner ----
  const pFence = 0x2f6b4f, top = Y + 1.3;
  const fenceSeg = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (let s = 0; s <= len; s += 0.25) {
      const t = s / len, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      builder.addBox(x - 0.015, Y, z - 0.015, x + 0.015, Y + 1.2, z + 0.015, pFence, { cast: false });
    }
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
    builder.addBox(minX - 0.03, top - 0.08, minZ - 0.03, maxX + 0.03, top - 0.02, maxZ + 0.03, pFence);
    addBox({ x0: minX - 0.1, x1: maxX + 0.1, z0: minZ - 0.1, z1: maxZ + 0.1, top, kind: 'fence' });
  };
  fenceSeg(PIP.x0, PIP.z0, PIP.x1, PIP.z0);
  fenceSeg(PIP.x0, PIP.z1, PIP.x1, PIP.z1);
  fenceSeg(PIP.x1, PIP.z0, PIP.x1, PIP.z1);
  fenceSeg(PIP.x0, PIP.z0, PIP.x0, PIP.gateZ0);
  fenceSeg(PIP.x0, PIP.gateZ1, PIP.x0, PIP.z1);
  for (const gz of [PIP.gateZ0, PIP.gateZ1]) builder.addBox(PIP.x0 - 0.08, Y, gz - 0.08, PIP.x0 + 0.08, Y + 1.6, gz + 0.08, pFence);
  const pSign = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 2.2), new THREE.MeshStandardMaterial({ map: signTexture('Pipicà', 'Off-leash area', '#8bcb3c', { aspect: 2.2 / 0.7 }), roughness: 0.7 }));
  place(pSign, PIP.x0 - 0.1, Y + 1.75, PIP.gateZ0 - 1.5);
  place(makeWaterBowl(), PLAZA.bowl.x, Y, PLAZA.bowl.z);
  // A couple of logs and a low ramp to play on.
  builder.addBox(14.5, Y, 127.2, 17.5, Y + 0.35, 127.8, 0x7a5a3c);
  builder.addBox(9.2, Y, 135.4, 11.8, Y + 0.3, 136.0, 0x7a5a3c);
  addBox({ x0: 14.5, x1: 17.5, z0: 127.2, z1: 127.8, top: Y + 0.35, kind: 'log' });
  addBox({ x0: 9.2, x1: 11.8, z0: 135.4, z1: 136.0, top: Y + 0.3, kind: 'log' });
  yield;

  // ---- Carrer Major: shop signs, fruit crates, bunting ----
  const shopSign = (title: string, sub: string, color: string, x: number, z: number, face: 1 | -1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 0.08), new THREE.MeshStandardMaterial({ map: signTexture(title, sub, color, { aspect: 3.4 / 0.7 }), roughness: 0.7 }));
    place(m, x, Y + 3.7, z, face > 0 ? 0 : Math.PI);
  };
  const shops: [string, string, string, number, number, 1 | -1][] = [
    ['Ferreteria', 'Hardware', '#b5700a', -46, 160.9, -1],
    ['Forn', 'Bakery', '#e3b45c', -18, 160.9, -1],
    ['Llibreria', 'Books', '#2a5aa8', 12, 160.9, -1],
    ['Fruiteria', 'Fruit and veg', '#5f9e4a', 23, 160.9, -1],
    ['Farmàcia', 'Pharmacy', '#2f9e4f', 46, 160.9, -1],
    ['Bar', 'Tapes i vermut', '#c23b32', -52, 155.1, 1],
    ['Merceria', 'Haberdashery', '#e5487a', 52, 155.1, 1],
  ];
  for (let i = 0; i < shops.length; i++) {
    shopSign(...shops[i]);
    if (i % 2 === 1) yield; // painting sign textures is the slow part
  }
  // The pharmacy's green cross, sticking out over the street.
  const crossM = M(0x2fd06a, 0.4, 0, { emissive: 0x1fa050, emissiveIntensity: 0.9 });
  const cross = new THREE.Group();
  cross.add(box(0.08, 0.9, 0.3, crossM), box(0.08, 0.3, 0.9, crossM));
  place(cross, 49.5, Y + 4.4, 160.2);
  cross.userData.dynamic = true;
  for (const x of [20.6, 25.4]) {
    const crate = makeFruitCrate();
    place(crate.group, x, Y, 160.3, Math.PI);
    addBox({ x0: x - 0.6, x1: x + 0.6, z0: 159.8, z1: 160.9, top: Y + 0.8, kind: 'crate' });
  }
  for (const [ax, bx] of [[-40, -10], [10, 40]]) {
    place(makeBunting(new THREE.Vector3(ax, Y + 5.4, 155.2), new THREE.Vector3(bx, Y + 5.4, 160.8)), 0, 0, 0);
  }
  // Diagonal festival bunting over the main market square + stacked wooden produce crates by the portal.
  place(makeBunting(new THREE.Vector3(-18, Y + 6.4, 108), new THREE.Vector3(-5, Y + 6.2, 134)), 0, 0, 0);
  place(makeBunting(new THREE.Vector3(18, Y + 6.4, 108), new THREE.Vector3(5, Y + 6.2, 134)), 0, 0, 0);
  for (const cx of [-4.4, 4.4]) {
    builder.addBox(cx - 0.35, Y, MK.z0 - 1.35, cx + 0.35, Y + 0.45, MK.z0 - 0.75, 0x8c6442);
    builder.addBox(cx - 0.28, Y + 0.45, MK.z0 - 1.28, cx + 0.28, Y + 0.82, MK.z0 - 0.82, 0xb08a5a);
  }
  place(makeFingerpost([
    { title: 'Dalt de la Vila', sub: 'Església · Museu', color: '#8bcb3c', angle: Math.PI / 2 },
    { title: 'Plaça del Mercat', sub: 'Carrer Major', color: '#ffb020', angle: -Math.PI / 2 },
  ]), 3.6, Y, 160.4);
  addCircle(3.6, 160.4, 0.12, Y + 3.5, 'pole', true, true);
  shadowed(sign);
  yield;

  yield* builder.flushSteps(root);
  yield;
  inst.build(() => root);
}
