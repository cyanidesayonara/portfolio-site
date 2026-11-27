/*
  Phase 7: Canal i Galeria / Gorg (west of the Rambla and north of El Port's railway).
  Features a navigable turquoise canal with twin pedestrian bridges, a grass-verge
  Mediterranean tramway and Parada Canal stop, the sunlit Galeria del Canal arcade,
  the Pista streetball court + Pavelló arena, and a fifth off-leash pipicà.

  Streamable district: builds in small slices when Millie heads west along the
  Rambla and tears down geometry and colliders on unload.
*/
import * as THREE from 'three';
import {
  M,
  makeBench, makeWaterBowl, makeFountain, makePlaneTree, makeCafeSet, makeHeras,
} from './models';
import { makeLanternPost, makeFingerpost, makeDatePalm } from './props';
import { DirectBuilder } from './meshbuilder';
import { bakeSteps } from './bake';
import { SEAFRONT_LAYOUT, type DistrictData, type InstanceSink } from './layout';
import { signTexture } from './textures';
import type { ColliderGrid, District } from './world';
import type { BoxCollider, CircleCollider } from './level';
import {
  GORG_CANAL, GORG_COURT, GORG_GALLERY, GORG_PAVELLO,
  GORG_PIPICA, GORG_TRAM, GORG_WATER_Y, gorgFloor, gorgSurface, inGorgPipica, onGorgBridge,
} from './gorgGeom';

export { gorgFloor, gorgSurface, inGorgPipica, onGorgBridge, GORG_CANAL, GORG_COURT, GORG_PIPICA, GORG_TRAM };

const PIP = SEAFRONT_LAYOUT.pipica5 ?? GORG_PIPICA;

/** Anchors shared between Gorg geometry (gorg.ts) and runtime events (gorgLife.ts). */
export const GORG = {
  id: 'gorg',
  x1: -104,
  minX: -220,
  minZ: 14,
  maxZ: 102,
  center: { x: -164, z: 56 },
  pipica: PIP,
  pipicaBench: { x: -139.6, z: (PIP.gateZ0 + PIP.gateZ1) / 2 },
  bowl: { x: -154.5, z: 22.5 },
  drink: { x: -160.2, z: 42.5 },
  shopper: { x: -185.5, z: 58.0 },
  bagPos: { x: -169.0, z: 24.0 },
  baller: { x: -135.0, z: 52.8 },
  ballPos: { x: -135.0, z: 64.0 },
  hoopPos: { x: GORG_COURT.hoopX, z: GORG_COURT.hoopZ },
  commuter: { x: -146.5, z: 33.8 },
  lamps: [
    [-112, 16.0], [-134, 16.0], [-158, 16.0], [-182, 16.0], [-206, 16.0],
    [-160, 42.0], [-178.8, 42.0], [-187.0, 42.0],
    [-160, 74.0], [-178.8, 74.0], [-187.0, 86.0], [-135, 76.0],
  ] as [number, number][],
  trees: [
    [-118, 22], [-130, 22], [-192, 22], [-208, 22],
    [-156, 48], [-156, 76], [-206, 94], [-184, 94],
  ] as [number, number][],
  pedPaths: [
    [[-108, 24], [-142, 24], [-176, 24], [-194, 24], [-176, 24], [-108, 24]],
    [[-148, 32], [-148, 44], [-160, 66], [-183, 66], [-183, 46], [-148, 44]],
    [[-156, 48], [-135, 50], [-122, 58], [-122, 74], [-156, 74]],
  ] as [number, number][][],
};

export interface GorgEnv {
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

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const mtx = (x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1) =>
  tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromEuler(tmpE.set(0, ry, 0)), tmpS.set(sx, sy, sz));

/** Canal i Galeria as a streamable western boulevard district. */
export function makeGorgDistrict(env: GorgEnv): District {
  const d: District = {
    id: GORG.id,
    label: env.layout.label,
    bounds: env.layout.bounds,
    root: new THREE.Group(),
    floor: (x, z) => gorgFloor(x, z),
    surface: (x, z) => gorgSurface(x, z),
    built: false,
    baked: false,
    state: 'standin',
    build: () => buildGorgSteps(env, d),
    bake: () => bakeSteps(d.root, -160),
    unload: () => {
      d.root.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); });
      d.root.clear();
    },
  };
  d.root.name = GORG.id;
  return d;
}

function* buildGorgSteps(env: GorgEnv, d: District): Generator<void, void, void> {
  const { groundY: Y, grid, mats, r } = env;
  const root = d.root;
  const place = (o: THREE.Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    root.add(o);
    return o;
  };
  const addBox = (b: Omit<BoxCollider, 'district'>) => grid.addBox({ ...b, district: GORG.id });
  const addCircle = (x: number, z: number, rr: number, top: number, kind: string, canPee: boolean, canWhirl: boolean) => {
    const c: CircleCollider = { x, z, r: rr, top, kind, canPee, canWhirl, marked: false, district: GORG.id };
    if (canWhirl || kind === 'tree' || kind === 'palm') c.obstacle = { x, z, r: rr, kind: 'pole' };
    else if (['bench', 'bin', 'fountain', 'table', 'hoop'].includes(kind)) c.obstacle = { x, z, r: rr, kind: 'furniture' };
    grid.addCircle(c);
  };

  const builder = new DirectBuilder(-160);
  const inst = env.newInstancer();
  const botY = GORG_WATER_Y - 1.1;

  // ---- Paving, turquoise canal basin, masonry walls & twin timber bridges ----
  // East bank (-162..-104) & West bank (-220..-178), plus north canal cap (96..102).
  root.add(env.ground(-162, -104, 14, 102, Y + 0.002, mats.panot, mats.panotTile));
  root.add(env.ground(-220, -178, 14, 102, Y + 0.002, mats.panot, mats.panotTile));
  root.add(env.ground(-178, -162, 96, 102, Y + 0.002, mats.panot, mats.panotTile));
  // Lighter concrete canal promenades flanking the basin.
  root.add(env.ground(-162, -158, 14, 96, Y + 0.004, mats.conc, mats.concTile));
  root.add(env.ground(-182, -178, 14, 96, Y + 0.004, mats.conc, mats.concTile));
  // Pipica 5 sand floor.
  root.add(env.ground(PIP.x0, PIP.x1, PIP.z0, PIP.z1, Y + 0.008, mats.sand, 4));

  // Canal water surface & sunken masonry retaining walls.
  const canalWater = env.ground(GORG_CANAL.x0, GORG_CANAL.x1, GORG_CANAL.z0, GORG_CANAL.z1, GORG_WATER_Y, mats.water, 12);
  canalWater.userData.dynamic = true;
  root.add(canalWater);

  const wallCol = 0xb9b2a4;
  builder.addBox(GORG_CANAL.x0 - 0.5, botY, 14, GORG_CANAL.x0 + 0.1, Y + 0.01, 96.2, wallCol, { skipBottom: true });
  builder.addBox(GORG_CANAL.x1 - 0.1, botY, 14, GORG_CANAL.x1 + 0.5, Y + 0.01, 96.2, wallCol, { skipBottom: true });
  builder.addBox(GORG_CANAL.x0, botY, 95.8, GORG_CANAL.x1, Y + 0.01, 96.4, wallCol, { skipBottom: true });

  // Steel guardrails flanking the canal water, open at the two timber bridges.
  const railDark = 0x383e4a;
  const canalRail = (x0: number, z0: number, x1: number, z1: number) => {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
    builder.addBox(minX - 0.04, Y + 0.88, minZ - 0.04, maxX + 0.04, Y + 0.96, maxZ + 0.04, railDark);
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.round(len / 2.2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
      builder.addBox(px - 0.035, Y, pz - 0.035, px + 0.035, Y + 0.9, pz + 0.035, railDark);
    }
    addBox({ x0: minX - 0.12, x1: maxX + 0.12, z0: minZ - 0.12, z1: maxZ + 0.12, top: Y + 1.8, kind: 'rail' });
  };
  for (const cx of [GORG_CANAL.x0 + 0.05, GORG_CANAL.x1 - 0.05]) {
    canalRail(cx, 14.3, cx, GORG_CANAL.bridgeS.z0 - 0.1);
    canalRail(cx, GORG_CANAL.bridgeS.z1 + 0.1, cx, GORG_CANAL.bridgeN.z0 - 0.1);
    canalRail(cx, GORG_CANAL.bridgeN.z1 + 0.1, cx, GORG_CANAL.z1);
  }
  canalRail(GORG_CANAL.x0, GORG_CANAL.z1 + 0.05, GORG_CANAL.x1, GORG_CANAL.z1 + 0.05);

  // Twin pedestrian timber bridges spanning the canal.
  for (const br of [GORG_CANAL.bridgeS, GORG_CANAL.bridgeN]) {
    root.add(env.ground(GORG_CANAL.x0 - 0.1, GORG_CANAL.x1 + 0.1, br.z0, br.z1, Y + 0.016, mats.deck, 3));
    builder.addBox(GORG_CANAL.x0, Y - 0.25, br.z0, GORG_CANAL.x1, Y + 0.012, br.z1, 0x5f4a36);
    for (const rz of [br.z0 + 0.08, br.z1 - 0.08]) {
      builder.addBox(GORG_CANAL.x0, Y + 0.02, rz - 0.06, GORG_CANAL.x1, Y + 0.96, rz + 0.06, 0x7c5a3a);
      addBox({ x0: GORG_CANAL.x0, x1: GORG_CANAL.x1, z0: rz - 0.12, z1: rz + 0.12, top: Y + 1.5, kind: 'rail' });
    }
  }
  yield;

  // ---- Grass-verge Tramway corridor & Parada Canal stop ----
  builder.addBox(-220, Y - 0.02, 35.4, -104, Y + 0.01, 38.6, 0x5c8549, { skipBottom: true });
  for (const cx of [-148, -182]) {
    builder.addBox(cx - 2.6, Y, 35.3, cx + 2.6, Y + 0.02, 38.7, 0xd8d0c0, { skipBottom: true });
  }
  const railMetal = 0x8f96a0;
  for (const rz of [36.3, 37.7]) {
    builder.addBox(-218, Y + 0.01, rz - 0.05, -106, Y + 0.05, rz + 0.05, railMetal);
  }
  const sleeperGeo = new THREE.BoxGeometry(0.22, 0.04, 2.2);
  const sleeperMat = M(0x6e675d, 0.9);
  for (let x = -218; x <= -106; x += 0.9) {
    inst.add('gsleep', sleeperGeo, sleeperMat, mtx(x, Y + 0.012, GORG_TRAM.z), false);
  }

  // Modern Parada Canal shelter facing +Z toward the tram tracks.
  {
    const sx0 = -152.6, sx1 = -143.4, sz0 = 32.8, sz1 = 34.8;
    builder.addBox(sx0, Y, sz0, sx1, Y + 0.08, sz1, 0xd8d2c4);
    for (const px of [sx0 + 0.25, -148, sx1 - 0.25]) {
      builder.addBox(px - 0.08, Y + 0.08, sz0 + 0.12, px + 0.08, Y + 3.05, sz0 + 0.28, railDark);
    }
    builder.addBox(sx0 + 0.2, Y + 0.15, sz0 + 0.1, sx1 - 0.2, Y + 2.95, sz0 + 0.18, 0x3b5870);
    builder.addBox(sx0 - 0.2, Y + 3.05, sz0 - 0.2, sx1 + 0.2, Y + 3.28, sz1 + 0.6, 0x1fc9b7);
    addBox({ x0: sx0, x1: sx1, z0: sz0, z1: sz0 + 0.4, top: Y + 3.4, kind: 'wall' });
    place(makeBench(), -148, Y + 0.08, 33.4, 0);
    const tramSign = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.55, 0.08),
      new THREE.MeshStandardMaterial({ map: signTexture('Tramvia', 'Parada Canal', '#1fc9b7', { aspect: 4.4 / 0.55 }), roughness: 0.65 }),
    );
    place(tramSign, -148, Y + 3.55, sz1 + 0.6);
  }
  yield;

  // ---- Galeria del Canal Shopping Center (west esplanade) ----
  {
    const G = GORG_GALLERY;
    builder.addBox(G.x0, Y, G.z0, G.x1, Y + 9.4, G.z1, 0xefe6d5);
    builder.addBox(G.x0 - 0.3, Y + 9.4, G.z0 - 0.3, G.x1 + 0.3, Y + 10.1, G.z1 + 0.3, 0x2b6e78);
    // Raised atrium skylight lantern along rooftop.
    builder.addBox(G.x0 + 6, Y + 10.1, G.z0 + 8, G.x1 - 4, Y + 11.4, G.z1 - 8, 0x3b5870);
    builder.addBox(G.x0 + 5.6, Y + 11.4, G.z0 + 7.6, G.x1 - 3.6, Y + 11.7, G.z1 - 7.6, 0x1fc9b7);
    // Sunlit glazed arcade & shade canopy facing east toward the canal esplanade.
    builder.addBox(G.x1, Y + 3.6, G.z0, G.x1 + 2.2, Y + 3.92, G.z1, 0xd8d0c0);
    builder.addBox(G.x1 + 2.05, Y + 3.55, G.z0, G.x1 + 2.25, Y + 3.98, G.z1, 0xffb020);
    for (let z = G.z0 + 2; z <= G.z1 - 2; z += 7) {
      builder.addBox(G.x1 + 1.9, Y, z - 0.12, G.x1 + 2.1, Y + 3.6, z + 0.12, 0x2b6e78);
      if (z < G.z1 - 5) {
        builder.addBox(G.x1 - 0.04, Y + 0.4, z + 0.8, G.x1 + 0.08, Y + 3.2, z + 6.2, 0x2c3850);
        builder.addBox(G.x1 - 0.04, Y + 4.8, z + 0.8, G.x1 + 0.08, Y + 7.6, z + 6.2, 0x2c3850);
      }
    }
    addBox({ x0: G.x0, x1: G.x1 + 0.1, z0: G.z0, z1: G.z1, top: Y + 11.8, kind: 'building' });
    const galSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.1, 8.0),
      new THREE.MeshStandardMaterial({ map: signTexture('Galeria del Canal', 'Comerç · Cafès', '#ffb020', { aspect: 8.0 / 1.1 }), roughness: 0.65 }),
    );
    place(galSign, G.x1 + 2.3, Y + 4.4, (G.z0 + G.z1) / 2);
  }
  for (const [tx, tz] of [[-184.5, 48.0], [-184.5, 76.0]] as [number, number][]) {
    place(makeCafeSet(0x1fc9b7), tx, Y, tz, r() * 3);
    addCircle(tx, tz, 0.5, Y + 0.8, 'table', false, false);
  }
  yield;

  // ---- Streetball Court (Pista) & Pavelló Arena ----
  {
    const C = GORG_COURT;
    builder.addBox(C.x0, Y, C.z0, C.x1, Y + 0.015, C.z1, 0x3a6494, { skipBottom: true });
    builder.addBox(C.x0 + 0.4, Y + 0.01, C.z0 + 0.4, C.x1 - 0.4, Y + 0.02, C.z1 - 0.4, 0xc86442, { skipBottom: true });
    builder.addBox(C.x0 + 1.8, Y + 0.012, C.z0 + 1.8, C.x1 - 1.8, Y + 0.024, C.z1 - 1.8, 0x3a6494, { skipBottom: true });
    // White painted court centerline & key stripes.
    builder.addBox(-135.08, Y + 0.016, C.z0 + 1.8, -134.92, Y + 0.028, C.z1 - 1.8, 0xf4f1ea);
    builder.addBox(-135.8, Y + 0.016, 63.2, -134.2, Y + 0.028, 64.8, 0xf4f1ea);

    // Two hoops facing across the court along z = 64.
    for (const [hx, dir] of [[C.x0 + 1.2, 1], [C.x1 - 1.2, -1]] as const) {
      builder.addBox(hx - 0.1, Y, 63.9, hx + 0.1, Y + 3.4, 64.1, 0x2a2f3d);
      builder.addBox(Math.min(hx, hx + dir * 0.7), Y + 3.1, 63.92, Math.max(hx, hx + dir * 0.7), Y + 3.24, 64.08, 0x2a2f3d);
      const bx = hx + dir * 0.72;
      builder.addBox(bx - 0.04, Y + 2.75, 63.15, bx + 0.04, Y + 3.8, 64.85, 0xf4f1ea);
      // Orange square hoop rim slightly inside court.
      const rx = bx + dir * 0.35;
      builder.addBox(rx - 0.25, Y + 3.0, 63.75, rx + 0.25, Y + 3.08, 64.25, 0xff6a1a);
      addCircle(hx, 64, 0.25, Y + 3.5, 'hoop', true, true);
    }

    const P = GORG_PAVELLO;
    builder.addBox(P.x0, Y, P.z0, P.x1, Y + 10.2, P.z1, 0xdce2e8);
    builder.addBox(P.x0 - 0.4, Y + 10.2, P.z0 - 0.4, P.x1 + 0.4, Y + 11.4, P.z1 + 0.4, 0x3d73c7);
    builder.addBox(P.x0 + 3, Y + 11.4, P.z0 + 2, P.x1 - 3, Y + 12.6, P.z1 - 2, 0x295090);
    builder.addBox(-142, Y, P.z0 - 1.8, -132, Y + 0.2, P.z0, 0xc9c2b2);
    builder.addBox(-143, Y + 3.6, P.z0 - 2.0, -131, Y + 3.9, P.z0, 0x1fc9b7);
    builder.addBox(-141, Y, P.z0 - 0.05, -133, Y + 3.5, P.z0 + 0.06, 0x2c3850);
    addBox({ x0: P.x0, x1: P.x1, z0: P.z0, z1: P.z1, top: Y + 12.8, kind: 'building' });
    const pavSign = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 0.95, 0.1),
      new THREE.MeshStandardMaterial({ map: signTexture('Pavelló', 'Esports · Pista', '#3d73c7', { aspect: 6.4 / 0.95 }), roughness: 0.65 }),
    );
    place(pavSign, -137, Y + 4.5, P.z0 - 2.08, Math.PI);
  }
  yield;

  // ---- Fifth Pipicà (east of canal, south of tram) ----
  {
    const pFence = 0x2f6b4f;
    const pTop = Y + 1.3;
    const fenceSeg = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      for (let s = 0; s <= len; s += 0.28) {
        const t = s / len;
        builder.addBox(x0 + (x1 - x0) * t - 0.015, Y, z0 + (z1 - z0) * t - 0.015, x0 + (x1 - x0) * t + 0.015, Y + 1.2, z0 + (z1 - z0) * t + 0.015, pFence, { cast: false });
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
      new THREE.MeshStandardMaterial({ map: signTexture('Pipicà', 'Off-leash area', '#8bcb3c', { aspect: 2.2 / 0.7 }), roughness: 0.7 }),
    );
    place(pSign, PIP.x1 + 0.1, Y + 1.75, PIP.gateZ0 - 1.5);
    place(makeWaterBowl(), GORG.bowl.x, Y, GORG.bowl.z);
    place(makeBench(), GORG.pipicaBench.x + 0.35, Y, GORG.pipicaBench.z, -Math.PI / 2);
    addBox({ x0: GORG.pipicaBench.x + 0.15, x1: GORG.pipicaBench.x + 0.7, z0: GORG.pipicaBench.z - 0.9, z1: GORG.pipicaBench.z + 0.9, top: Y + 0.5, kind: 'bench' });
  }

  // ---- Trees, lamps, benches, fountains, and outer perimeter fences ----
  for (let i = 0; i < GORG.trees.length; i++) {
    const [tx, tz] = GORG.trees[i];
    const t = i % 2 === 0 ? makePlaneTree(700 + i) : makeDatePalm(700 + i, 9.5 + (i % 3));
    place(t.group, tx, Y, tz, r() * Math.PI);
    addCircle(tx, tz, t.radius, Y + 6, 'tree', true, true);
    if (i % 2 === 1) yield;
  }
  for (const [x, z] of GORG.lamps) {
    const lamp = makeLanternPost();
    lamp.group.traverse((o) => { const m = o as THREE.Mesh; if (m.material === lamp.glass) m.material = mats.lampGlass; });
    place(lamp.group, x, Y, z);
    addCircle(x, z, lamp.radius, Y + 9, 'lamp', true, true);
  }
  for (const [bx, bz, ry] of [[-134, 48, Math.PI], [-160, 54, Math.PI / 2], [-180, 54, -Math.PI / 2], [-134, 24, 0]] as const) {
    place(makeBench(), bx, Y, bz, ry);
    const along = Math.abs(Math.sin(ry)) < 0.5;
    addBox({ x0: bx - (along ? 0.9 : 0.45), x1: bx + (along ? 0.9 : 0.45), z0: bz - (along ? 0.45 : 0.9), z1: bz + (along ? 0.45 : 0.9), top: Y + 0.5, kind: 'bench' });
  }
  place(makeFountain(), GORG.drink.x, Y, GORG.drink.z, Math.PI / 2);
  addCircle(GORG.drink.x, GORG.drink.z, 0.25, Y + 1.1, 'fountain', true, false);
  place(makeFingerpost([
    { title: 'Rambla', sub: 'Centre · Estació', color: '#ffb020', angle: 0 },
    { title: 'Galeria · Pavelló', sub: 'Nord del canal', color: '#1fc9b7', angle: Math.PI / 2 },
  ]), -156, Y, 30.8);
  addCircle(-156, 30.8, 0.14, Y + 3.4, 'pole', true, true);

  // Outer borders: west wall (-220), north fence (100.5) with a gap toward Ronda, east town edge.
  for (let z = 16; z <= 98; z += 4) place(makeHeras(4.0), -220, Y, z, Math.PI / 2);
  addBox({ x0: -220.2, x1: -219.8, z0: 14, z1: 100.5, top: 9, kind: 'fence' });
  // Leave an open approach corridor around x = -165 for Phase 8 Ronda.
  for (let x = -218; x <= -178; x += 4) place(makeHeras(4.0), x, Y, 100.5, 0);
  for (let x = -150; x <= -106; x += 4) place(makeHeras(4.0), x, Y, 100.5, 0);
  addBox({ x0: -220, x1: -178, z0: 100.3, z1: 100.7, top: 9, kind: 'fence' });
  addBox({ x0: -152, x1: -104, z0: 100.3, z1: 100.7, top: 9, kind: 'fence' });
  for (let z = 62; z <= 98; z += 4) place(makeHeras(4.0), -104, Y, z, Math.PI / 2);
  addBox({ x0: -104.2, x1: -103.8, z0: 38.8, z1: 100.5, top: 9, kind: 'fence' });

  const flush = builder.flushSteps(root);
  while (!flush.next().done) yield;
  inst.build(() => root);
}
