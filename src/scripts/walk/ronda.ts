/*
  Phase 8: Ronda i Parc (north of Canal i Galeria / Gorg).
  Features a sunken highway trench with ambient traffic below, a wide pedestrian
  footbridge (Pont de vianants), a green urban park with a concrete skate ramp,
  and a sixth off-leash pipicà.

  Streamable district: builds in small slices when Millie heads north from Gorg
  and tears down geometry and colliders on unload.
*/
import * as THREE from 'three';
import {
  M,
  makeBench, makeWaterBowl, makeFountain, makePlaneTree, makeHeras,
} from './models';
import { makeLanternPost, makeFingerpost } from './props';
import { DirectBuilder } from './meshbuilder';
import { bakeSteps } from './bake';
import { SEAFRONT_LAYOUT, type DistrictData, type InstanceSink } from './layout';
import { signTexture } from './textures';
import type { ColliderGrid, District } from './world';
import type { BoxCollider, CircleCollider } from './level';
import {
  RONDA_BRIDGE, RONDA_PIPICA, RONDA_SKATE, RONDA_TRENCH, RONDA_TRENCH_Y,
  inRondaPipica as inRondaPipicaLocal, onRondaBridge as onRondaBridgeLocal, rondaFloor as rondaFloorLocal, rondaSurface as rondaSurfaceLocal,
} from './rondaGeom';
import { RONDA_DX, shiftX } from './marinaOffset';

export { RONDA_BRIDGE, RONDA_PIPICA, RONDA_SKATE, RONDA_TRENCH };

/** Ronda i Parc's predicates in world coordinates (rondaGeom.ts works in the local frame). */
export const rondaFloor = (x: number, z: number) => rondaFloorLocal(x - RONDA_DX, z);
export const rondaSurface = (x: number, z: number) => rondaSurfaceLocal(x - RONDA_DX, z);
export const inRondaPipica = (x: number, z: number) => inRondaPipicaLocal(x - RONDA_DX, z);
export const onRondaBridge = (x: number, z: number) => onRondaBridgeLocal(x - RONDA_DX, z);

/** This district's pipicà in its local frame (the layout data holds world positions). */
const PIP = SEAFRONT_LAYOUT.pipica6 ? shiftX(SEAFRONT_LAYOUT.pipica6, -RONDA_DX) : RONDA_PIPICA;

/** Anchors shared between Ronda geometry (ronda.ts) and runtime events (rondaLife.ts). */
/** Shared anchors in the district's local frame (it shares the port's frame; marinaOffset.ts). */
export const RONDA_LOCAL = {
  id: 'ronda',
  x1: -104,
  minX: -220,
  minZ: 108,
  maxZ: 196,
  center: { x: -165, z: 150 },
  pipica: PIP,
  pipicaBench: { x: -184.6, z: (PIP.gateZ0 + PIP.gateZ1) / 2 },
  bowl: { x: -193.0, z: 170.5 },
  drink: { x: -172.0, z: 156.0 },
  skater: { x: -158.0, z: 160.5 },
  deckPos: { x: -152.0, z: 124.0 },
  timid: { x: -165.0, z: 134.5 },
  fetcher: { x: -175.0, z: 178.0 },
  ballPos: { x: -160.0, z: 182.0 },
  lamps: [
    [-120, 116], [-148, 116], [-165, 116], [-190, 116], [-210, 116],
    [-165, 128], [-165, 152],
    [-140, 160], [-180, 160], [-200, 160],
    [-140, 186], [-180, 186], [-210, 186],
  ] as [number, number][],
  trees: [
    [-128, 118], [-190, 118], [-210, 122],
    [-130, 160], [-145, 178], [-210, 178], [-175, 188], [-128, 188],
  ] as [number, number][],
  pedPaths: [
    [[-165, 110], [-165, 132], [-165, 148], [-165, 180], [-165, 148], [-165, 110]],
    [[-190, 156], [-190, 175], [-175, 175], [-175, 156]],
    [[-158, 156], [-158, 174], [-150, 174], [-150, 156]],
  ] as [number, number][][],
};

/** The same anchors in world coordinates (the district is built locally and shifted by RONDA_DX). */
export const RONDA = shiftX(RONDA_LOCAL, RONDA_DX);

export interface RondaEnv {
  groundY: number;
  grid: ColliderGrid;
  layout: DistrictData;
  ground: (x0: number, x1: number, z0: number, z1: number, y: number, mat: THREE.Material, tile: number) => THREE.Mesh;
  newInstancer: () => InstanceSink & { build(assign: (x: number, z: number) => THREE.Object3D): void };
  mats: {
    conc: THREE.Material; concTile: number;
    panot: THREE.Material; panotTile: number;
    deck: THREE.Material;
    sand: THREE.Material;
    water: THREE.Material;
    litWindow: THREE.Material;
    darkWindow: THREE.Material;
    iron: THREE.Material;
    lampGlass: THREE.MeshStandardMaterial;
  };
  r: () => number;
}

/** Ronda i Parc as a streamable inland overpass district. */
export function makeRondaDistrict(env: RondaEnv): District {
  const d: District = {
    id: RONDA_LOCAL.id,
    label: env.layout.label,
    bounds: env.layout.bounds,
    root: new THREE.Group(),
    floor: (x, z) => rondaFloor(x, z),
    surface: (x, z) => rondaSurface(x, z),
    built: false,
    baked: false,
    state: 'standin',
    build: () => buildRondaSteps(env, d),
    bake: () => bakeSteps(d.root, -160),
    unload: () => {
      d.root.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); });
      d.root.clear();
    },
  };
  d.root.name = RONDA_LOCAL.id;
  // Everything below is built in the local frame; the root carries it into place.
  d.root.position.x = RONDA_DX;
  return d;
}

function* buildRondaSteps(env: RondaEnv, d: District): Generator<void, void, void> {
  const { groundY: Y, grid, mats, r } = env;
  const root = d.root;
  const place = (o: THREE.Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    root.add(o);
    return o;
  };
  const addBox = (b: Omit<BoxCollider, 'district'>) => grid.addBox({ ...b, x0: b.x0 + RONDA_DX, x1: b.x1 + RONDA_DX, district: RONDA_LOCAL.id });
  const addCircle = (x: number, z: number, rr: number, top: number, kind: string, canPee: boolean, canWhirl: boolean) => {
    const c: CircleCollider = { x: x + RONDA_DX, z, r: rr, top, kind, canPee, canWhirl, marked: false, district: RONDA_LOCAL.id };
    if (canWhirl || kind === 'tree' || kind === 'palm') c.obstacle = { x: x + RONDA_DX, z, r: rr, kind: 'pole' };
    else if (['bench', 'bin', 'fountain', 'table'].includes(kind)) c.obstacle = { x: x + RONDA_DX, z, r: rr, kind: 'furniture' };
    grid.addCircle(c);
  };

  const builder = new DirectBuilder(-160);
  const inst = env.newInstancer();
  const trenchY = RONDA_TRENCH_Y;
  const T = RONDA_TRENCH;
  const B = RONDA_BRIDGE;
  const railDark = 0x383e4a;
  const wallCol = 0x8a8478;

  // ---- Approach paving (south of trench) & park paving/grass pads ----
  root.add(env.ground(-220, -104, 108, T.z0, Y + 0.002, mats.panot, mats.panotTile));
  root.add(env.ground(-220, -104, T.z1, 196, Y + 0.002, mats.panot, mats.panotTile));
  // Green park lawn north of the trench (visual mesh; friction stays paving).
  {
    const grassMat = M(0x6a8f52, 0.95);
    const lawn = env.ground(-218, -112, T.z1 + 0.2, 192, Y + 0.006, grassMat, 8);
    root.add(lawn);
  }
  // Pipica 6 sand + skate pad concrete.
  root.add(env.ground(PIP.x0, PIP.x1, PIP.z0, PIP.z1, Y + 0.008, mats.sand, 4));
  root.add(env.ground(RONDA_SKATE.x0, RONDA_SKATE.x1, RONDA_SKATE.z0, RONDA_SKATE.z1, Y + 0.01, mats.conc, mats.concTile));
  yield;

  // ---- Sunken highway trench (cheek walls block Millie from falling in) ----
  builder.addBox(T.x0, trenchY - 0.2, T.z0, T.x1, trenchY + 0.02, T.z1, 0x4a4640, { skipBottom: true });
  // Lane markings on the trench floor.
  for (const lz of [137.2, 140.0, 142.8]) {
    builder.addBox(T.x0 + 2, trenchY + 0.03, lz - 0.04, T.x1 - 2, trenchY + 0.05, lz + 0.04, 0xd8d0c0);
  }
  // Retaining cheek walls (full height to ground) — solid colliders.
  builder.addBox(T.x0, trenchY, T.z0 - 0.45, T.x1, Y + 0.05, T.z0 + 0.15, wallCol, { skipBottom: true });
  builder.addBox(T.x0, trenchY, T.z1 - 0.15, T.x1, Y + 0.05, T.z1 + 0.45, wallCol, { skipBottom: true });
  addBox({ x0: T.x0, x1: T.x1, z0: T.z0 - 0.5, z1: T.z0 + 0.2, top: Y + 1.2, kind: 'wall' });
  addBox({ x0: T.x0, x1: T.x1, z0: T.z1 - 0.2, z1: T.z1 + 0.5, top: Y + 1.2, kind: 'wall' });
  // End caps of the trench.
  builder.addBox(T.x0 - 0.4, trenchY, T.z0, T.x0 + 0.2, Y + 0.05, T.z1, wallCol, { skipBottom: true });
  builder.addBox(T.x1 - 0.2, trenchY, T.z0, T.x1 + 0.4, Y + 0.05, T.z1, wallCol, { skipBottom: true });
  addBox({ x0: T.x0 - 0.5, x1: T.x0 + 0.25, z0: T.z0, z1: T.z1, top: Y + 1.2, kind: 'wall' });
  addBox({ x0: T.x1 - 0.25, x1: T.x1 + 0.5, z0: T.z0, z1: T.z1, top: Y + 1.2, kind: 'wall' });

  // Safety railings along the trench lip (open under the bridge).
  const trenchRail = (x0: number, z: number, x1: number) => {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    builder.addBox(minX - 0.04, Y + 0.88, z - 0.04, maxX + 0.04, Y + 0.96, z + 0.04, railDark);
    const len = Math.abs(x1 - x0);
    const steps = Math.max(1, Math.round(len / 2.2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x0 + (x1 - x0) * t;
      builder.addBox(px - 0.035, Y, z - 0.035, px + 0.035, Y + 0.9, z + 0.035, railDark);
    }
    addBox({ x0: minX - 0.12, x1: maxX + 0.12, z0: z - 0.12, z1: z + 0.12, top: Y + 1.8, kind: 'rail' });
  };
  trenchRail(T.x0, T.z0 + 0.05, B.x0 - 0.2);
  trenchRail(B.x1 + 0.2, T.z0 + 0.05, T.x1);
  trenchRail(T.x0, T.z1 - 0.05, B.x0 - 0.2);
  trenchRail(B.x1 + 0.2, T.z1 - 0.05, T.x1);
  yield;

  // ---- Pont de vianants (wide pedestrian overpass) ----
  root.add(env.ground(B.x0, B.x1, B.z0, B.z1, Y + 0.016, mats.deck, 3));
  builder.addBox(B.x0, trenchY + 0.5, B.z0, B.x1, Y + 0.01, B.z1, 0x9a9384);
  // Bridge pillars down into the trench (outside traffic lanes).
  for (const px of [B.x0 + 1.2, B.x1 - 1.2]) {
    for (const pz of [B.z0 + 1.5, B.z1 - 1.5]) {
      builder.addBox(px - 0.35, trenchY, pz - 0.35, px + 0.35, Y + 0.02, pz + 0.35, 0x6d665a);
    }
  }
  // Side parapets along the overpass.
  for (const rx of [B.x0 + 0.1, B.x1 - 0.1]) {
    builder.addBox(rx - 0.08, Y + 0.02, B.z0, rx + 0.08, Y + 1.05, B.z1, 0xcfc9bb);
    addBox({ x0: rx - 0.15, x1: rx + 0.15, z0: B.z0, z1: B.z1, top: Y + 1.6, kind: 'rail' });
  }
  {
    const bridgeSign = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.7, 0.1),
      new THREE.MeshStandardMaterial({
        map: signTexture('Pont de vianants', 'Ronda · Parc', '#1fc9b7', { aspect: 5.6 / 0.7 }),
        roughness: 0.65,
      }),
    );
    place(bridgeSign, -165, Y + 3.4, B.z0 - 0.4, Math.PI);
  }
  yield;

  // ---- Skate ramp (quarter-pipe silhouette via DirectBuilder) ----
  {
    const S = RONDA_SKATE;
    const rampCol = 0x7a7e86;
    // Flat pad already grounded; build a quarter-pipe against the north edge.
    const qx0 = S.x0 + 2, qx1 = S.x1 - 2, qz1 = S.z1 - 0.4;
    builder.addBox(qx0, Y, qz1 - 1.2, qx1, Y + 0.08, qz1, rampCol);
    builder.addBox(qx0, Y, qz1 - 0.55, qx1, Y + 1.1, qz1, rampCol);
    builder.addBox(qx0, Y + 1.0, qz1 - 0.35, qx1, Y + 2.2, qz1, rampCol);
    builder.addBox(qx0, Y + 2.0, qz1 - 0.2, qx1, Y + 3.0, qz1, rampCol);
    // Coping rail on top.
    builder.addBox(qx0 - 0.05, Y + 3.0, qz1 - 0.12, qx1 + 0.05, Y + 3.12, qz1 + 0.05, 0xd8d0c0);
    addBox({ x0: qx0, x1: qx1, z0: qz1 - 0.4, z1: qz1 + 0.15, top: Y + 3.3, kind: 'wall' });
    const skateSign = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.55, 0.08),
      new THREE.MeshStandardMaterial({
        map: signTexture('Pista', 'Patinatge', '#3d73c7', { aspect: 4.2 / 0.55 }),
        roughness: 0.65,
      }),
    );
    place(skateSign, S.rampX, Y + 2.4, S.z0 + 0.3);
  }
  yield;

  // ---- Sixth Pipicà ----
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
    fenceSeg(PIP.x0, PIP.z0, PIP.x0, PIP.z1);
    fenceSeg(PIP.x1, PIP.z0, PIP.x1, PIP.gateZ0);
    fenceSeg(PIP.x1, PIP.gateZ1, PIP.x1, PIP.z1);
    for (const gz of [PIP.gateZ0, PIP.gateZ1]) {
      builder.addBox(PIP.x1 - 0.08, Y, gz - 0.08, PIP.x1 + 0.08, Y + 1.6, gz + 0.08, pFence);
    }
    const pSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.7, 2.2),
      new THREE.MeshStandardMaterial({
        map: signTexture('Pipicà', 'Off-leash area', '#8bcb3c', { aspect: 2.2 / 0.7 }),
        roughness: 0.7,
      }),
    );
    place(pSign, PIP.x1 + 0.1, Y + 1.75, PIP.gateZ0 - 1.5);
    place(makeWaterBowl(), RONDA_LOCAL.bowl.x, Y, RONDA_LOCAL.bowl.z);
    place(makeBench(), RONDA_LOCAL.pipicaBench.x + 0.35, Y, RONDA_LOCAL.pipicaBench.z, -Math.PI / 2);
    addBox({
      x0: RONDA_LOCAL.pipicaBench.x + 0.15, x1: RONDA_LOCAL.pipicaBench.x + 0.7,
      z0: RONDA_LOCAL.pipicaBench.z - 0.9, z1: RONDA_LOCAL.pipicaBench.z + 0.9,
      top: Y + 0.5, kind: 'bench',
    });
  }
  yield;

  // ---- Trees, lamps, benches, fountain, fingerpost, perimeter ----
  for (let i = 0; i < RONDA_LOCAL.trees.length; i++) {
    const [tx, tz] = RONDA_LOCAL.trees[i];
    const t = makePlaneTree(800 + i);
    place(t.group, tx, Y, tz, r() * Math.PI);
    addCircle(tx, tz, t.radius, Y + 6, 'tree', true, true);
    if (i % 2 === 1) yield;
  }
  for (const [x, z] of RONDA_LOCAL.lamps) {
    const lamp = makeLanternPost();
    lamp.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.material === lamp.glass) m.material = mats.lampGlass;
    });
    place(lamp.group, x, Y, z);
    addCircle(x, z, lamp.radius, Y + 9, 'lamp', true, true);
  }
  for (const [bx, bz, ry] of [
    [-150, 118, 0], [-180, 118, Math.PI], [-140, 170, Math.PI / 2], [-180, 186, Math.PI],
  ] as const) {
    place(makeBench(), bx, Y, bz, ry);
    const along = Math.abs(Math.sin(ry)) < 0.5;
    addBox({
      x0: bx - (along ? 0.9 : 0.45), x1: bx + (along ? 0.9 : 0.45),
      z0: bz - (along ? 0.45 : 0.9), z1: bz + (along ? 0.45 : 0.9),
      top: Y + 0.5, kind: 'bench',
    });
  }
  place(makeFountain(), RONDA_LOCAL.drink.x, Y, RONDA_LOCAL.drink.z, Math.PI / 2);
  addCircle(RONDA_LOCAL.drink.x, RONDA_LOCAL.drink.z, 0.25, Y + 1.1, 'fountain', true, false);
  place(makeFingerpost([
    { title: 'Ronda', sub: 'Pont · Parc', color: '#ffb020', angle: Math.PI / 2 },
    { title: 'Canal i Galeria', sub: 'Sud', color: '#1fc9b7', angle: Math.PI },
  ]), -165, Y, 112.5);
  addCircle(-165, 112.5, 0.14, Y + 3.4, 'pole', true, true);

  // Outer borders: west, north, east (leave south open toward Gorg).
  for (let z = 112; z <= 192; z += 4) place(makeHeras(4.0), -220, Y, z, Math.PI / 2);
  addBox({ x0: -220.2, x1: -219.8, z0: 108, z1: 196, top: 9, kind: 'fence' });
  for (let x = -218; x <= -106; x += 4) place(makeHeras(4.0), x, Y, 194.5, 0);
  addBox({ x0: -220, x1: -104, z0: 194.3, z1: 194.7, top: 9, kind: 'fence' });
  for (let z = 112; z <= 192; z += 4) place(makeHeras(4.0), -104, Y, z, Math.PI / 2);
  addBox({ x0: -104.2, x1: -103.8, z0: 108, z1: 196, top: 9, kind: 'fence' });

  const flush = builder.flushSteps(root);
  while (!flush.next().done) yield;
  inst.build(() => root);
}
