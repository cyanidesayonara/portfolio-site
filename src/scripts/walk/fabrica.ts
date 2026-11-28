/*
  Phase 9: La Fàbrica, past the Rambla's +x end.
  Avinguda de la Fàbrica runs inland from the Rambla's +x end: a pedestrianized
  avenue with a tree line down the middle and shops on the ground floors (Forn,
  Farmàcia, Ferreteria). Off its +x side opens a square at the foot of an old
  brick factory chimney, with the seventh off-leash pipicà.

  Streamable district: builds in small slices when Millie heads +x along the
  Rambla and tears down geometry and colliders on unload.
*/
import * as THREE from 'three';
import { M, cyl, makeBench, makeWaterBowl, makeFountain, makePlaneTree, makeHeras } from './models';
import { makeLanternPost, makeFingerpost } from './props';
import { DirectBuilder } from './meshbuilder';
import { bakeSteps } from './bake';
import { SEAFRONT_LAYOUT, buildDistrictBlocksSteps, type DistrictData, type InstanceSink } from './layout';
import { signTexture } from './textures';
import type { ColliderGrid, District } from './world';
import type { BoxCollider, CircleCollider } from './level';
import {
  FABRICA_AVENUE, FABRICA_BOUNDS, FABRICA_CHIMNEY, FABRICA_PIPICA, FABRICA_SQUARE,
  inFabricaPipica, fabricaFloor, fabricaSurface,
} from './fabricaGeom';

export { inFabricaPipica, fabricaFloor, fabricaSurface, FABRICA_AVENUE, FABRICA_SQUARE, FABRICA_CHIMNEY };

const PIP = SEAFRONT_LAYOUT.pipica7 ?? FABRICA_PIPICA;
const A = FABRICA_AVENUE;
const SQ = FABRICA_SQUARE;

/** Anchors shared between La Fàbrica geometry (fabrica.ts) and runtime events (fabricaLife.ts). */
export const FABRICA = {
  id: 'fabrica',
  center: { x: 136, z: 70 },
  pipica: PIP,
  pipicaBench: { x: PIP.x0 - 1.4, z: (PIP.gateZ0 + PIP.gateZ1) / 2 },
  bowl: { x: PIP.x0 + 2.0, z: PIP.z1 - 1.5 },
  drink: { x: 129.0, z: 86.0 },
  /** Forn: shop door on the avenue's +x side. */
  bakery: { x: A.x1, z: 46 },
  baker: { x: 125.3, z: 46.0 },
  breadPos: { x: 113.6, z: 97.5 },
  /** Kid waiting in the square for the ball that rolled across the avenue. */
  kid: { x: 132.0, z: 70.0 },
  ballPos: { x: 112.4, z: 80.0 },
  /** Ferreteria: roller shutter on the square's north side. */
  shop: { x: 140.0, z: SQ.z1 },
  shopkeeper: { x: 143.6, z: 94.6 },
  chimney: { x: FABRICA_CHIMNEY.x, z: FABRICA_CHIMNEY.z },
  lamps: [
    [A.x0 + 0.8, 42], [A.x0 + 0.8, 58], [A.x0 + 0.8, 74], [A.x0 + 0.8, 90],
    [A.x1 - 0.8, 40], [A.x1 - 0.8, 52], [A.x1 - 0.8, 100],
    [138, 64], [138, 90], [168, 80], [168, 94],
  ] as [number, number][],
  trees: [
    [A.midX, 40], [A.midX, 49], [A.midX, 58], [A.midX, 67], [A.midX, 76], [A.midX, 85], [A.midX, 94], [A.midX, 101.5],
    [131, 79], [146, 84], [168, 66],
  ] as [number, number][],
  pedPaths: [
    [[112.2, 36], [112.2, 100], [124.2, 100], [124.2, 36]],
    [[129, 62], [146, 61], [146, 92], [129, 92]],
    [[96, 23.8], [136, 24], [136, 28.6], [96, 28.6]],
  ] as [number, number][][],
};

export interface FabricaEnv {
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
    lampGlass: THREE.MeshStandardMaterial;
  };
  r: () => number;
}

/** La Fàbrica as a streamable district past the Rambla's +x end. */
export function makeFabricaDistrict(env: FabricaEnv): District {
  const d: District = {
    id: FABRICA.id,
    label: env.layout.label,
    bounds: env.layout.bounds ?? FABRICA_BOUNDS,
    root: new THREE.Group(),
    floor: (x, z) => fabricaFloor(x, z),
    surface: (x, z) => fabricaSurface(x, z),
    built: false,
    baked: false,
    state: 'standin',
    build: () => buildFabricaSteps(env, d),
    bake: () => bakeSteps(d.root, FABRICA_BOUNDS.z0),
    unload: () => {
      d.root.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); });
      d.root.clear();
    },
  };
  d.root.name = FABRICA.id;
  return d;
}

const sign = (title: string, sub: string, color: string, w: number, h: number) =>
  new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.08),
    new THREE.MeshStandardMaterial({ map: signTexture(title, sub, color, { aspect: w / h }), roughness: 0.65 }),
  );

function* buildFabricaSteps(env: FabricaEnv, d: District): Generator<void, void, void> {
  const { groundY: Y, grid, mats, r } = env;
  const root = d.root;
  const place = (o: THREE.Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    root.add(o);
    return o;
  };
  const addBox = (b: Omit<BoxCollider, 'district'>) => grid.addBox({ ...b, district: FABRICA.id });
  const addCircle = (x: number, z: number, rr: number, top: number, kind: string, canPee: boolean, canWhirl: boolean) => {
    const c: CircleCollider = { x, z, r: rr, top, kind, canPee, canWhirl, marked: false, district: FABRICA.id };
    if (canWhirl || kind === 'tree') c.obstacle = { x, z, r: rr, kind: 'pole' };
    else if (['bench', 'bin', 'fountain', 'table'].includes(kind)) c.obstacle = { x, z, r: rr, kind: 'furniture' };
    grid.addCircle(c);
  };

  // ---- Ground: panots on the avenue, flagstones on the square, sand in the pipicà ----
  root.add(env.ground(A.x0, A.x1, A.z0, A.z1 + 0.5, Y + 0.002, mats.panot, mats.panotTile));
  root.add(env.ground(SQ.x0, SQ.x1, SQ.z0, SQ.z1, Y + 0.003, mats.flag, mats.flagTile));
  root.add(env.ground(PIP.x0, PIP.x1, PIP.z0, PIP.z1, Y + 0.008, mats.sand, 4));
  yield;

  // ---- Buildings from the layout data ----
  const builder = new DirectBuilder(FABRICA_BOUNDS.z0);
  const inst = env.newInstancer();
  const boxes: BoxCollider[] = [];
  const blocks = buildDistrictBlocksSteps(env.layout, {
    groundY: Y, builder, wallMat: mats.wall, inst, boxes,
    litWindowMat: mats.litWindow, darkWindowMat: mats.darkWindow, ironMat: mats.iron, r,
  });
  while (!blocks.next().done) yield;
  for (const b of boxes) grid.addBox(b);

  // ---- Central tree line: granite kerbs and tree grates down the avenue ----
  const kerb = 0xb9b2a4;
  builder.addBox(A.midX - 1.2, Y, 37, A.midX + 1.2, Y + 0.05, 103, 0xcfc8b8, { cast: false });
  for (const sx of [A.midX - 1.25, A.midX + 1.15]) builder.addBox(sx, Y, 37, sx + 0.1, Y + 0.12, 103, kerb, { cast: false });
  yield;

  // ---- Shop fronts: Forn (bread quest), Farmàcia, Ferreteria (shutter quest) ----
  {
    const shopDark = 0x2a2f3d;
    // Forn on the avenue's +x side, facing -x.
    builder.addBox(A.x1 - 0.06, Y, 43.6, A.x1 + 0.02, Y + 3.0, 48.4, shopDark);
    builder.addBox(A.x1 - 0.1, Y + 0.8, 44.0, A.x1 - 0.04, Y + 2.7, 48.0, 0xf2c47a); // warm shop light
    place(sign('Forn', 'Pa · Coques', '#d98c2b', 4.4, 0.7), A.x1 - 0.5, Y + 3.6, 46, Math.PI / 2);
    // Farmàcia on the -x side, facing +x, with a green cross.
    builder.addBox(A.x0 - 0.02, Y, 78, A.x0 + 0.06, Y + 3.0, 82.5, shopDark);
    place(sign('Farmàcia', '', '#2f9b4a', 4.0, 0.7), A.x0 + 0.5, Y + 3.6, 80.25, -Math.PI / 2);
    builder.addBox(A.x0 + 0.06, Y + 4.2, 83.4, A.x0 + 0.3, Y + 5.2, 83.7, 0x3bd16a);
    builder.addBox(A.x0 + 0.06, Y + 4.55, 83.05, A.x0 + 0.3, Y + 4.85, 84.05, 0x3bd16a);
    // Ferreteria on the square's north side, facing south. The shutter itself lives in fabricaLife.ts.
    builder.addBox(137.4, Y, SQ.z1 - 0.06, 142.6, Y + 3.0, SQ.z1 + 0.02, shopDark);
    builder.addBox(137.6, Y + 0.05, SQ.z1 - 0.03, 142.4, Y + 1.2, SQ.z1 - 0.01, 0x7a6a52); // shelves glimpse
    // Hung proud of the facade so the block's own shop boards never cover it.
    place(sign('Ferreteria', 'Eines · Claus', '#c2412d', 5.2, 0.7), 140, Y + 3.6, SQ.z1 - 0.5);
  }
  yield;

  // ---- The old factory chimney: square brick plinth, tapered round shaft ----
  {
    const C = FABRICA_CHIMNEY;
    const brick = 0x9e4d36, brickDark = 0x7c3a28, stone = 0xcfc8b8;
    const h0 = C.base / 2;
    builder.addBox(C.x - h0, Y, C.z - h0, C.x + h0, Y + 4.2, C.z + h0, brick);
    builder.addBox(C.x - h0 - 0.15, Y + 4.2, C.z - h0 - 0.15, C.x + h0 + 0.15, Y + 4.6, C.z + h0 + 0.15, stone);
    builder.addBox(C.x - h0 - 0.1, Y, C.z - h0 - 0.1, C.x + h0 + 0.1, Y + 0.5, C.z + h0 + 0.1, stone);
    const shaftH = C.height - 4.6;
    const shaft = cyl(0.85, 1.35, shaftH, M(brick, 0.92), 14);
    place(shaft, C.x, Y + 4.6 + shaftH / 2, C.z);
    // Darker brick bands and a corbelled crown, as on the region's old factory stacks.
    for (const f of [0.25, 0.5, 0.75]) {
      const rr = 1.35 - (1.35 - 0.85) * f + 0.04;
      place(cyl(rr, rr, 0.45, M(brickDark, 0.9), 14), C.x, Y + 4.6 + shaftH * f, C.z);
    }
    place(cyl(1.15, 0.9, 1.1, M(brickDark, 0.9), 14), C.x, Y + C.height - 0.2, C.z);
    place(cyl(1.0, 1.0, 0.12, M(0x1d1a18, 0.95), 14), C.x, Y + C.height + 0.36, C.z);
    addCircle(C.x, C.z, h0 + 0.2, Y + 4.6, 'chimney', true, false);
    const plaque = sign('Xemeneia', 'Antiga fàbrica', '#9e4d36', 2.6, 0.55);
    place(plaque, C.x, Y + 2.4, C.z - h0 - 0.06);
  }
  yield;

  // ---- Seventh pipicà ----
  {
    const pFence = 0x2f6b4f;
    const pTop = Y + 1.3;
    const fenceSeg = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      for (let s = 0; s <= len; s += 0.28) {
        const t = s / Math.max(len, 0.01);
        builder.addBox(
          x0 + (x1 - x0) * t - 0.015, Y, z0 + (z1 - z0) * t - 0.015,
          x0 + (x1 - x0) * t + 0.015, Y + 1.2, z0 + (z1 - z0) * t + 0.015,
          pFence, { cast: false },
        );
      }
      const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
      builder.addBox(minX - 0.03, pTop - 0.08, minZ - 0.03, maxX + 0.03, pTop - 0.02, maxZ + 0.03, pFence);
      addBox({ x0: minX - 0.1, x1: maxX + 0.1, z0: minZ - 0.1, z1: maxZ + 0.1, top: pTop, kind: 'fence' });
    };
    fenceSeg(PIP.x0, PIP.z0, PIP.x1, PIP.z0);
    fenceSeg(PIP.x0, PIP.z1, PIP.x1, PIP.z1);
    fenceSeg(PIP.x1, PIP.z0, PIP.x1, PIP.z1);
    // Gate on the -x side, toward the avenue.
    fenceSeg(PIP.x0, PIP.z0, PIP.x0, PIP.gateZ0);
    fenceSeg(PIP.x0, PIP.gateZ1, PIP.x0, PIP.z1);
    for (const gz of [PIP.gateZ0, PIP.gateZ1]) {
      builder.addBox(PIP.x0 - 0.08, Y, gz - 0.08, PIP.x0 + 0.08, Y + 1.6, gz + 0.08, pFence);
    }
    const pSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.7, 2.2),
      new THREE.MeshStandardMaterial({ map: signTexture('Pipicà', 'Off-leash area', '#8bcb3c', { aspect: 2.2 / 0.7 }), roughness: 0.7 }),
    );
    place(pSign, PIP.x0 - 0.1, Y + 1.75, PIP.gateZ0 - 1.5);
    place(makeWaterBowl(), FABRICA.bowl.x, Y, FABRICA.bowl.z);
    place(makeBench(), FABRICA.pipicaBench.x - 0.35, Y, FABRICA.pipicaBench.z, Math.PI / 2);
    addBox({
      x0: FABRICA.pipicaBench.x - 0.7, x1: FABRICA.pipicaBench.x - 0.15,
      z0: FABRICA.pipicaBench.z - 0.9, z1: FABRICA.pipicaBench.z + 0.9,
      top: Y + 0.5, kind: 'bench',
    });
  }
  yield;

  // ---- Trees, lamps, benches, fountain, fingerpost, north fence ----
  for (let i = 0; i < FABRICA.trees.length; i++) {
    const [tx, tz] = FABRICA.trees[i];
    const t = makePlaneTree(900 + i);
    place(t.group, tx, Y, tz, r() * Math.PI);
    addCircle(tx, tz, t.radius, Y + 6, 'tree', true, true);
    if (i % 2 === 1) yield;
  }
  for (const [x, z] of FABRICA.lamps) {
    const lamp = makeLanternPost();
    lamp.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.material === lamp.glass) m.material = mats.lampGlass;
    });
    place(lamp.group, x, Y, z);
    addCircle(x, z, lamp.radius, Y + 9, 'lamp', true, true);
  }
  for (const [bx, bz, ry] of [
    [A.midX, 44.5, 0], [A.midX, 98, Math.PI], [136, 76, Math.PI / 2], [150, 92, Math.PI],
  ] as const) {
    place(makeBench(), bx, Y, bz, ry);
    const along = Math.abs(Math.sin(ry)) < 0.5;
    addBox({
      x0: bx - (along ? 0.9 : 0.45), x1: bx + (along ? 0.9 : 0.45),
      z0: bz - (along ? 0.45 : 0.9), z1: bz + (along ? 0.45 : 0.9),
      top: Y + 0.5, kind: 'bench',
    });
  }
  place(makeFountain(), FABRICA.drink.x, Y, FABRICA.drink.z, -Math.PI / 2);
  addCircle(FABRICA.drink.x, FABRICA.drink.z, 0.25, Y + 1.1, 'fountain', true, false);
  place(makeFingerpost([
    { title: 'Avinguda de la Fàbrica', sub: 'Forn · Xemeneia', color: '#d98c2b', angle: -Math.PI / 2 },
    { title: 'Rambla · Estació', sub: 'Platja', color: '#ffb020', angle: Math.PI / 2 },
  ]), A.x0 + 1.4, Y, 36.5);
  addCircle(A.x0 + 1.4, 36.5, 0.14, Y + 3.4, 'pole', true, true);
  // Street name board on two posts at the avenue's mouth, read from the Rambla.
  place(sign('Avinguda de la Fàbrica', 'Zona de vianants', '#d98c2b', 5.6, 0.7), A.midX, Y + 3.2, 35.2, Math.PI);
  for (const px of [A.midX - 2.75, A.midX + 2.75]) {
    builder.addBox(px - 0.06, Y, 35.14, px + 0.06, Y + 3.55, 35.26, 0x383e4a);
    addCircle(px, 35.2, 0.12, Y + 3.6, 'pole', true, true);
  }
  // The avenue's far end is closed off for works for now (the town goes on beyond).
  for (let x = A.x0 + 2; x <= A.x1 - 2; x += 4) place(makeHeras(4.0), x, Y, A.z1 + 0.2, 0);
  addBox({ x0: A.x0, x1: A.x1, z0: A.z1, z1: A.z1 + 0.4, top: 9, kind: 'fence' });

  const flush = builder.flushSteps(root);
  while (!flush.next().done) yield;
  inst.build(() => root);
}
