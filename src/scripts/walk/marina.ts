/*
  Phase 6: The Marina & Breakwater (west beyond the promenade breakwater rocks).
  Connects seamlessly along x = -104 via stone quays, leads across a timber
  canal footbridge to West Quay (Moll de Ponent), drops down floating timber
  pontoons beside moored boats, hosts a fourth pipicà, and runs out along an
  armored breakwater to a green-beacon harbor lighthouse (Far del Port).

  Streamable district: builds in small slices when Millie approaches the west
  end of the promenade and tears down geometry and colliders on unload.
*/
import * as THREE from 'three';
import {
  M, box, cyl, rod, shadowed,
  makeBench, makeWaterBowl, makeFountain, makeBollard, makeCafeSet, makeHeras,
} from './models';
import { makeLanternPost, makeFingerpost, railFenceGeometry } from './props';
import { DirectBuilder } from './meshbuilder';
import { bakeSteps } from './bake';
import { SEAFRONT_LAYOUT, type DistrictData, type InstanceSink } from './layout';
import { signTexture } from './textures';
import type { ColliderGrid, District } from './world';
import type { BoxCollider, CircleCollider } from './level';
import {
  BREAKWATER, BREAKWATER_Y, CANAL, MARINA_GROUND_Y, MARINA_PIPICA,
  MARINA_WATER_Y, PONTOON_A, PONTOON_B, PONTOON_Y,
  inMarinaPipica, marinaFloor, marinaSurface,
} from './marinaGeom';

export { inMarinaPipica, marinaFloor, marinaSurface, PONTOON_Y, BREAKWATER_Y };

const PIP = SEAFRONT_LAYOUT.pipica4 ?? MARINA_PIPICA;

/** Anchors shared between marina geometry (marina.ts) and runtime quests (marinaLife.ts). */
export const MARINA = {
  id: 'marina',
  x1: -104,
  minX: -214,
  maxZ: 3.6,
  minZ: -104,
  center: { x: -162, z: -40 },
  pipica: PIP,
  pipicaBench: { x: -142.2, z: (PIP.gateZ0 + PIP.gateZ1) / 2 },
  bowl: { x: -156.5, z: -5.5 },
  drink: { x: -112, z: -2.0 },
  sailor: { x: -124, z: -46 },
  buoyPos: { x: -169, z: -6.0 },
  fisherman: { x: -204, z: -12 },
  cratePos: { x: -209, z: -14 },
  terraceLocal: { x: -114.6, z: -7.2 },
  lighthouse: { x: -162, z: -100 },
  pontoonA: PONTOON_A,
  pontoonB: PONTOON_B,
  arenaBollards: [
    [-204, -18], [-190, -18], [-204, -6], [-190, -6],
  ] as [number, number][],
  lamps: [
    [-110, -2.5], [-136, -2.5], [-156, -2.5], [-184, -2.5], [-204, -2.5],
    [-204, -20], [-206.8, -46], [-206.8, -72], [-206.8, -96.5], [-178, -96.5],
  ] as [number, number][],
  boats: [
    [-118.6, -30, Math.PI / 2, 0x2a5aa8, 'sail'],
    [-118.6, -47, Math.PI / 2, 0xc8322a, 'sail'],
    [-129.4, -33, -Math.PI / 2, 0x1fc9b7, 'fisher'],
    [-129.4, -50, -Math.PI / 2, 0xe8b42c, 'sail'],
    [-144.6, -32, Math.PI / 2, 0x3d73c7, 'sail'],
    [-144.6, -49, Math.PI / 2, 0xe5487a, 'fisher'],
    [-155.4, -34, -Math.PI / 2, 0x5f7a5a, 'sail'],
    [-155.4, -48, -Math.PI / 2, 0xd9705a, 'fisher'],
  ] as readonly [number, number, number, number, 'sail' | 'fisher'][],
  pedPaths: [
    [[-106, -9.5], [-140, -11], [-169, -6], [-196, -10], [-186, -15], [-169, -6], [-114, -9.5]],
    [[-210, -32], [-210, -64], [-210, -100], [-166, -100], [-210, -100], [-210, -32]],
    [[-124, -24], [-124, -52], [-124, -24]],
  ] as [number, number][][],
};

export interface MarinaEnv {
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
const mtx = (x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) =>
  tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromEuler(tmpE.set(rx, ry, rz)), tmpS.set(sx, sy, sz));

function mergeGeos(parts: THREE.BufferGeometry[]) {
  const ps = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  let n = 0;
  for (const p of ps) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
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

/** The Marina & Breakwater as a streamable waterfront district. */
export function makeMarinaDistrict(env: MarinaEnv): District {
  const d: District = {
    id: MARINA.id,
    label: env.layout.label,
    bounds: env.layout.bounds,
    root: new THREE.Group(),
    floor: (x, z) => marinaFloor(x, z),
    surface: (x, z) => marinaSurface(x, z),
    built: false,
    baked: false,
    state: 'standin',
    build: () => buildMarinaSteps(env, d),
    bake: () => bakeSteps(d.root, -160),
    unload: () => {
      d.root.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); });
      d.root.clear();
    },
  };
  d.root.name = MARINA.id;
  return d;
}

function* buildMarinaSteps(env: MarinaEnv, d: District): Generator<void, void, void> {
  const { groundY: Y, grid, mats, r } = env;
  const root = d.root;
  const place = (o: THREE.Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    root.add(o);
    return o;
  };
  const addBox = (b: Omit<BoxCollider, 'district'>) => grid.addBox({ ...b, district: MARINA.id });
  const addCircle = (x: number, z: number, rr: number, top: number, kind: string, canPee: boolean, canWhirl: boolean, minY?: number) => {
    const c: CircleCollider = { x, z, r: rr, top, kind, canPee, canWhirl, marked: false, district: MARINA.id };
    if (minY !== undefined) c.minY = minY;
    if (canWhirl || kind === 'tree') c.obstacle = { x, z, r: rr, kind: 'pole' };
    else if (['bench', 'bollard', 'bin', 'fountain', 'table'].includes(kind)) c.obstacle = { x, z, r: rr, kind: 'furniture' };
    grid.addCircle(c);
  };

  const builder = new DirectBuilder(-160);
  const inst = env.newInstancer();
  const botY = MARINA_WATER_Y - 1.1;

  // ---- Quays, canal bridge water, and pipicà ground ----
  // East side of canal: inland promenade + seaward concrete apron.
  root.add(env.ground(-162, -104, -14, 4, Y + 0.002, mats.panot, mats.panotTile));
  root.add(env.ground(-162, -104, -18, -14, Y + 0.003, mats.conc, mats.concTile));
  // West side of canal + Moll de Ponent boss quay.
  root.add(env.ground(-214, -178, -14, 4, Y + 0.002, mats.panot, mats.panotTile));
  root.add(env.ground(-214, -178, -18, -14, Y + 0.003, mats.conc, mats.concTile));
  root.add(env.ground(-214, -180, -26, -18, Y + 0.003, mats.conc, mats.concTile));
  // Sandy pipicà.
  root.add(env.ground(PIP.x0, PIP.x1, PIP.z0, PIP.z1, Y + 0.008, mats.sand, 4));
  // Canal water surface + timber footbridge across it.
  const canalWater = env.ground(CANAL.x0, CANAL.x1, -18, 4, MARINA_WATER_Y, mats.water, 12);
  canalWater.userData.dynamic = true;
  root.add(canalWater);
  root.add(env.ground(CANAL.x0 - 0.1, CANAL.x1 + 0.1, CANAL.bridgeZ0, CANAL.bridgeZ1, Y + 0.015, mats.deck, 3));

  // Underwater quay masonry walls down to basin bottom.
  const quayCol = 0xb9b2a4;
  const copingCol = 0xd8d0c0;
  // North quay seaward drop wall (east & west of canal).
  builder.addBox(-162, botY, -18.1, -104, Y + 0.01, -17.4, quayCol, { skipBottom: true });
  builder.addBox(-180, botY, -18.1, -178, Y + 0.01, -17.4, quayCol, { skipBottom: true });
  // Canal vertical retaining walls.
  builder.addBox(-178.4, botY, -18.1, -177.8, Y + 0.01, 4.0, quayCol, { skipBottom: true });
  builder.addBox(-162.2, botY, -18.1, -161.6, Y + 0.01, 4.0, quayCol, { skipBottom: true });
  // West quay east & south & west sea walls.
  builder.addBox(-180.4, botY, -26.0, -179.8, Y + 0.01, -18.0, quayCol, { skipBottom: true });
  builder.addBox(-206.0, botY, -26.2, -180.0, Y + 0.01, -25.6, quayCol, { skipBottom: true });
  builder.addBox(-214.4, botY, -26.2, -213.8, Y + 0.01, 4.0, quayCol, { skipBottom: true });
  // Bridge steel deck trim + north/south wooden railings.
  for (const rz of [CANAL.bridgeZ0 + 0.08, CANAL.bridgeZ1 - 0.08]) {
    builder.addBox(CANAL.x0, Y + 0.02, rz - 0.06, CANAL.x1, Y + 0.96, rz + 0.06, 0x7c5a3a);
    addBox({ x0: CANAL.x0, x1: CANAL.x1, z0: rz - 0.12, z1: rz + 0.12, top: Y + 1.5, kind: 'rail' });
  }
  // Future Gorg canal north border sealed with Heras works.
  for (let i = 0; i < 4; i++) place(makeHeras(4.0), CANAL.x0 + 2 + i * 4, Y, 3.6, 0);
  addBox({ x0: CANAL.x0 - 0.2, x1: CANAL.x1 + 0.2, z0: 3.3, z1: 3.9, top: 9, kind: 'fence' });
  const canalSign = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.55, 0.08),
    new THREE.MeshStandardMaterial({ map: signTexture('Canal', 'Future path', '#ffb020', { aspect: 3.2 / 0.55 }), roughness: 0.7 }),
  );
  place(canalSign, -170, Y + 1.4, 3.4);
  yield;

  // ---- Capitania (yacht club), terrace, benches, fountains ----
  const CX0 = -140, CX1 = -118, CZ0 = -6, CZ1 = 3.5;
  builder.addBox(CX0, Y, CZ0, CX1, Y + 5.8, CZ1, 0xf2eee4);
  builder.addBox(CX0 - 0.3, Y + 5.8, CZ0 - 0.3, CX1 + 0.3, Y + 6.4, CZ1 + 0.3, 0x284c75);
  // Waterfront shaded colonnade over the Capitania facade.
  builder.addBox(CX0, Y + 3.05, CZ0 - 1.6, CX1, Y + 3.35, CZ0, 0xf2eee4);
  builder.addBox(CX0, Y + 3.35, CZ0 - 1.62, CX1, Y + 3.52, CZ0 - 1.45, 0x284c75);
  for (const px of [-139.2, -133, -125, -118.8]) builder.addBox(px - 0.14, Y, CZ0 - 1.45, px + 0.14, Y + 3.05, CZ0 - 1.15, 0xe0dad0);
  for (let x = CX0 + 2.2; x < CX1 - 1.5; x += 3.6) {
    builder.addBox(x, Y + 3.6, CZ0 - 0.06, x + 2.2, Y + 5.2, CZ0 + 0.02, 0x2c3850);
    builder.addBox(x + 0.15, Y + 0.8, CZ0 - 0.06, x + 1.9, Y + 2.6, CZ0 + 0.02, 0x2c3850);
  }
  addBox({ x0: CX0, x1: CX1, z0: CZ0, z1: CZ1, top: Y + 6.6, kind: 'building' });
  const capSign = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 0.8, 0.1),
    new THREE.MeshStandardMaterial({ map: signTexture('PORT · CAPITANIA', 'Nàutic', '#3d73c7', { aspect: 5.6 / 0.8 }), roughness: 0.6 }),
  );
  place(capSign, (CX0 + CX1) / 2, Y + 3.85, CZ0 - 1.65);

  for (const [tx, tz] of [[-114.6, -7.2], [-109.2, -7.2]] as [number, number][]) {
    place(makeCafeSet(0x284c75), tx, Y, tz, r() * 3);
    addCircle(tx, tz, 0.5, Y + 0.8, 'table', false, false);
  }
  for (const [bx, bz] of [[-112, -15.6], [-136, -15.6], [-186, -16.2]]) {
    place(makeBench(), bx, Y, bz, 0);
    addBox({ x0: bx - 0.9, x1: bx + 0.9, z0: bz - 0.45, z1: bz + 0.45, top: Y + 0.5, kind: 'bench', face: [0, 1] });
  }
  place(makeFountain(), MARINA.drink.x, Y, MARINA.drink.z, Math.PI / 2);
  addCircle(MARINA.drink.x, MARINA.drink.z, 0.25, Y + 1.1, 'fountain', true, false);
  for (const [x, z] of MARINA.lamps) {
    const lamp = makeLanternPost();
    lamp.group.traverse((o) => { const m = o as THREE.Mesh; if (m.material === lamp.glass) m.material = mats.lampGlass; });
    const ly = z < -27 ? BREAKWATER_Y : Y;
    place(lamp.group, x, ly, z);
    addCircle(x, z, lamp.radius, ly + 9, 'lamp', true, true);
  }
  yield;

  // ---- Fourth Pipicà (by North Quay) ----
  const pFence = 0x2f6b4f;
  const pTop = Y + 1.3;
  const fenceSeg = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (let s = 0; s <= len; s += 0.28) {
      const t = s / len;
      builder.addBox(
        x0 + (x1 - x0) * t - 0.015, Y, z0 + (z1 - z0) * t - 0.015,
        x0 + (x1 - x0) * t + 0.015, Y + 1.2, z0 + (z1 - z0) * t + 0.015, pFence, { cast: false },
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
  for (const gz of [PIP.gateZ0, PIP.gateZ1]) builder.addBox(PIP.x1 - 0.08, Y, gz - 0.08, PIP.x1 + 0.08, Y + 1.6, gz + 0.08, pFence);
  const pipSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.7, 2.2),
    new THREE.MeshStandardMaterial({ map: signTexture('Pipicà', 'Off-leash area', '#8bcb3c', { aspect: 2.2 / 0.7 }), roughness: 0.7 }),
  );
  place(pipSign, PIP.x1 + 0.1, Y + 1.75, PIP.gateZ0 - 1.4);
  place(makeWaterBowl(), MARINA.bowl.x, Y, MARINA.bowl.z);
  place(makeBench(), MARINA.pipicaBench.x + 0.35, Y, MARINA.pipicaBench.z, -Math.PI / 2);
  addBox({ x0: MARINA.pipicaBench.x - 0.15, x1: MARINA.pipicaBench.x + 0.85, z0: MARINA.pipicaBench.z - 0.9, z1: MARINA.pipicaBench.z + 0.9, top: Y + 0.5, kind: 'bench' });
  builder.addBox(-154.5, Y, -11.4, -151.5, Y + 0.32, -10.8, 0x7a5a3c);
  builder.addBox(-149.2, Y, -6.5, -146.8, Y + 0.28, -5.9, 0x7a5a3c);
  addBox({ x0: -154.5, x1: -151.5, z0: -11.4, z1: -10.8, top: Y + 0.32, kind: 'log' });
  addBox({ x0: -149.2, x1: -146.8, z0: -6.5, z1: -5.9, top: Y + 0.28, kind: 'log' });
  yield;

  // ---- West Quay (Moll de Ponent): open boss plaza, crane, mooring bollards, safety rails ----
  for (const [bx, bz] of MARINA.arenaBollards) {
    const b = makeBollard();
    b.scale.setScalar(1.25);
    place(b, bx, Y, bz);
    addCircle(bx, bz, 0.18, Y + 1.1, 'bollard', true, true);
    builder.addBox(bx + 0.32, Y, bz - 0.24, bx + 0.76, Y + 0.22, bz + 0.2, 0xc99c62);
  }
  for (const px of [-139.2, -125]) {
    builder.addBox(px + 0.14, Y + 1.25, -5.85, px + 0.22, Y + 1.75, -5.35, 0xf26c22);
  }
  // Boat-lift crane (Grua) matching the stand-in landmark at x -212..-208, z -25..-21.
  const craneYel = 0xe8b42c, craneBlue = 0x2a5aa8, steelDark = 0x383e4a;
  for (const [lx, lz] of [[-211.8, -24.8], [-208.2, -24.8], [-211.8, -21.2], [-208.2, -21.2]]) {
    builder.addBox(lx - 0.25, Y, lz - 0.25, lx + 0.25, Y + 7.4, lz + 0.25, craneYel);
  }
  builder.addBox(-212.1, Y + 7.4, -25.1, -205.5, Y + 8.3, -20.9, craneYel);
  builder.addBox(-211.6, Y + 8.3, -24.4, -208.4, Y + 9.2, -21.6, craneBlue);
  addBox({ x0: -212.1, x1: -207.9, z0: -25.1, z1: -20.9, top: Y + 9.2, kind: 'crane' });
  // Fish & rope crates on West Quay (where the marina gulls perch).
  builder.addBox(-210.4, Y, -15.0, -207.8, Y + 0.95, -13.0, 0x8c6442);
  builder.addBox(-210.2, Y + 0.95, -14.6, -208.6, Y + 1.45, -13.4, 0x284c75);
  addBox({ x0: -210.5, x1: -207.7, z0: -15.1, z1: -12.9, top: Y + 1.45, kind: 'crates' });
  place(makeFingerpost([
    { title: 'Far del Port', sub: 'Espigó', color: '#5eea8c', angle: -Math.PI / 2 },
    { title: 'Capitania', sub: 'Passeig', color: '#3d73c7', angle: 0 },
  ]), -199, Y, -19.5);
  addCircle(-199, -19.5, 0.14, Y + 3.2, 'pole', true, true);

  // Quay edge guard rails (steel posts + rail), leaving openings at both pontoons and the breakwater ramp.
  const quayRail = (x0: number, z0: number, x1: number, z1: number, yBase = Y) => {
    const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
    const len = alongX ? maxX - minX : maxZ - minZ;
    builder.addBox(minX - 0.04, yBase + 0.88, minZ - 0.04, maxX + 0.04, yBase + 0.96, maxZ + 0.04, 0xd8d4cc);
    builder.addBox(minX - 0.02, yBase + 0.45, minZ - 0.02, maxX + 0.02, yBase + 0.5, maxZ + 0.02, 0x8a929e);
    const steps = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = minX + (maxX - minX) * t, pz = minZ + (maxZ - minZ) * t;
      builder.addBox(px - 0.04, yBase, pz - 0.04, px + 0.04, yBase + 0.9, pz + 0.04, steelDark);
    }
    addBox({ x0: minX - 0.12, x1: maxX + 0.12, z0: minZ - 0.12, z1: maxZ + 0.12, top: yBase + 1.8, kind: 'rail' });
  };
  // East of canal: quay edge minus Pontoon A (-126..-122) & Pontoon B (-152..-148).
  quayRail(-162, -17.95, -152.2, -17.95);
  quayRail(-147.8, -17.95, -126.2, -17.95);
  quayRail(-121.8, -17.95, -104, -17.95);
  // Canal sides north and south of the footbridge.
  for (const cx of [CANAL.x1 + 0.05, CANAL.x0 - 0.05]) {
    quayRail(cx, -17.95, cx, CANAL.bridgeZ0 - 0.15);
    quayRail(cx, CANAL.bridgeZ1 + 0.15, cx, 3.6);
  }
  // West quay east/south/west borders.
  quayRail(-179.95, -17.95, -178.05, -17.95);
  quayRail(-180.05, -25.95, -180.05, -18.05);
  quayRail(-205.8, -25.95, -180.05, -25.95);
  quayRail(-213.95, -25.95, -213.95, 3.6);
  yield;

  // ---- Floating wooden pontoons & sloped gangways ----
  const buildPontoon = (P: typeof PONTOON_A) => {
    const cx = (P.x0 + P.x1) / 2;
    const w = P.x1 - P.x0;
    // Sloped gangway bridging quay level (GROUND_Y) to pontoon level (PONTOON_Y).
    const rLen = Math.hypot(P.rampZ1 - P.z1, Y - PONTOON_Y);
    const gangway = box(w - 0.3, 0.1, rLen, mats.deck);
    gangway.position.set(cx, (Y + PONTOON_Y) / 2 - 0.02, (P.z1 + P.rampZ1) / 2);
    gangway.rotation.x = Math.atan2(Y - PONTOON_Y, P.rampZ1 - P.z1);
    gangway.receiveShadow = true;
    root.add(gangway);
    // Floating deck over dark buoyancy blocks.
    root.add(env.ground(P.x0, P.x1, P.z0, P.z1, PONTOON_Y + 0.01, mats.deck, 3));
    builder.addBox(P.x0, MARINA_WATER_Y - 0.1, P.z0, P.x1, PONTOON_Y - 0.01, P.z1, 0x3b4048, { skipBottom: true });
    // Gangway side rails + outer safety guard rails on pontoon (so Millie stays on deck).
    addBox({ x0: P.x0 - 0.18, x1: P.x0 + 0.05, z0: P.z0, z1: P.rampZ1, top: Y + 1.8, minY: MARINA_WATER_Y - 1, kind: 'rail' });
    addBox({ x0: P.x1 - 0.05, x1: P.x1 + 0.18, z0: P.z0, z1: P.rampZ1, top: Y + 1.8, minY: MARINA_WATER_Y - 1, kind: 'rail' });
    addBox({ x0: P.x0 - 0.15, x1: P.x1 + 0.15, z0: P.z0 - 0.18, z1: P.z0 + 0.05, top: Y + 1.8, minY: MARINA_WATER_Y - 1, kind: 'rail' });
    // Mooring cleats & low timber curbing.
    for (let z = P.z0 + 3; z < P.z1 - 2; z += 7) {
      for (const sx of [P.x0 + 0.18, P.x1 - 0.18]) builder.addBox(sx - 0.06, PONTOON_Y, z - 0.14, sx + 0.06, PONTOON_Y + 0.14, z + 0.14, 0xf2c230);
    }
  };
  buildPontoon(PONTOON_A);
  buildPontoon(PONTOON_B);
  yield;

  // ---- Stone breakwater (Espigó), armor boulders & Harbor Lighthouse ----
  // Sloped entry ramp connecting West Quay (GROUND_Y) to elevated breakwater (BREAKWATER_Y).
  {
    const rLen = Math.hypot(BREAKWATER.rampZ1 - BREAKWATER.z1, BREAKWATER_Y - Y);
    const ramp = box(8.0, 0.14, rLen, mats.conc);
    ramp.position.set(-210, (Y + BREAKWATER_Y) / 2 - 0.04, (BREAKWATER.z1 + BREAKWATER.rampZ1) / 2);
    ramp.rotation.x = -Math.atan2(BREAKWATER_Y - Y, BREAKWATER.rampZ1 - BREAKWATER.z1);
    ramp.receiveShadow = true;
    root.add(ramp);
    builder.addBox(BREAKWATER.x0, botY, BREAKWATER.z1, BREAKWATER.x1, BREAKWATER_Y, BREAKWATER.rampZ1, quayCol, { skipBottom: true });
  }
  root.add(env.ground(BREAKWATER.x0, BREAKWATER.x1, BREAKWATER.z0, BREAKWATER.z1, BREAKWATER_Y + 0.004, mats.conc, mats.concTile));
  root.add(env.ground(BREAKWATER.x1, BREAKWATER.armX1, BREAKWATER.armZ0, BREAKWATER.armZ1, BREAKWATER_Y + 0.004, mats.conc, mats.concTile));
  builder.addBox(BREAKWATER.x0, botY, BREAKWATER.z0, BREAKWATER.x1, BREAKWATER_Y - 0.01, BREAKWATER.z1, quayCol, { skipBottom: true });
  builder.addBox(BREAKWATER.x1, botY, BREAKWATER.armZ0, BREAKWATER.armX1, BREAKWATER_Y - 0.01, BREAKWATER.armZ1, quayCol, { skipBottom: true });
  // Stone parapet along outer seaward wall + inner rail along basin side.
  builder.addBox(BREAKWATER.x0, BREAKWATER_Y, BREAKWATER.z0, BREAKWATER.x0 + 0.65, BREAKWATER_Y + 1.05, BREAKWATER.z1, copingCol);
  builder.addBox(BREAKWATER.x0, BREAKWATER_Y, BREAKWATER.armZ0, BREAKWATER.armX1, BREAKWATER_Y + 1.05, BREAKWATER.armZ0 + 0.65, copingCol);
  addBox({ x0: BREAKWATER.x0 - 0.1, x1: BREAKWATER.x0 + 0.7, z0: BREAKWATER.z0 - 0.1, z1: BREAKWATER.rampZ1, top: BREAKWATER_Y + 2.0, kind: 'wall' });
  addBox({ x0: BREAKWATER.x0 - 0.1, x1: BREAKWATER.armX1 + 0.1, z0: BREAKWATER.armZ0 - 0.1, z1: BREAKWATER.armZ0 + 0.7, top: BREAKWATER_Y + 2.0, kind: 'wall' });
  quayRail(BREAKWATER.x1 - 0.05, BREAKWATER.armZ1, BREAKWATER.x1 - 0.05, BREAKWATER.rampZ1, BREAKWATER_Y);
  quayRail(BREAKWATER.x1, BREAKWATER.armZ1 - 0.05, BREAKWATER.armX1, BREAKWATER.armZ1 - 0.05, BREAKWATER_Y);
  quayRail(BREAKWATER.armX1 - 0.05, BREAKWATER.armZ0, BREAKWATER.armX1 - 0.05, BREAKWATER.armZ1, BREAKWATER_Y);

  // Armor rocks lining the seaward outside flanks of the breakwater.
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = M(0xb4afa4, 0.95, 0, { flatShading: true });
  for (let z = -30; z >= -104; z -= 2.3) {
    const s = 1.05 + (Math.abs(z * 13) % 7) * 0.14;
    inst.add('mrock', rockGeo, rockMat, mtx(-215.7 - (Math.abs(z * 5) % 3) * 0.4, MARINA_WATER_Y + s * 0.45, z, z * 0.4, s * 1.25, s * 0.95, s));
  }
  for (let x = -214; x <= -158; x += 2.3) {
    const s = 1.05 + (Math.abs(x * 11) % 7) * 0.14;
    inst.add('mrock', rockGeo, rockMat, mtx(x, MARINA_WATER_Y + s * 0.45, -105.7 - (Math.abs(x * 3) % 3) * 0.4, x * 0.4, s, s * 0.95, s * 1.25));
  }

  // Harbor lighthouse (Far del Port) at the breakwater head.
  {
    const lh = new THREE.Group();
    const white = M(0xf0ece2, 0.75);
    const red = M(0xc93b32, 0.7);
    const plinth = cyl(2.1, 2.5, 1.4, M(0xd6d0c2, 0.85), 14);
    plinth.position.y = 0.7;
    lh.add(plinth);
    for (let i = 0; i < 6; i++) {
      const rb = 1.65 - i * 0.08;
      const rt = 1.57 - i * 0.08;
      const seg = cyl(rt, rb, 1.35, i % 2 === 1 ? red : white, 16);
      seg.position.y = 2.05 + i * 1.35;
      lh.add(seg);
    }
    const deckY = 1.4 + 6 * 1.35;
    const gallery = cyl(1.65, 1.35, 0.35, M(0x2a2f3d, 0.45, 0.5), 16);
    gallery.position.y = deckY + 0.15;
    lh.add(gallery);
    const lanternGlass = cyl(0.95, 0.95, 1.1, new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.15, transparent: true, opacity: 0.65 }), 12);
    lanternGlass.position.y = deckY + 0.85;
    lh.add(lanternGlass);
    const cap = cyl(0.05, 1.15, 0.9, red, 12);
    cap.position.y = deckY + 1.85;
    lh.add(cap);
    shadowed(lh);
    place(lh, MARINA.lighthouse.x, BREAKWATER_Y, MARINA.lighthouse.z);
    addCircle(MARINA.lighthouse.x, MARINA.lighthouse.z, 2.3, BREAKWATER_Y + 11.5, 'lighthouse', true, true, BREAKWATER_Y - 0.5);
  }
  yield;

  // ---- Railway continuation behind North & West Quays (x -226..-148) ----
  const ballast = box(78, 0.18, 9.4, M(0x8e877b, 1));
  ballast.position.set(-187, Y + 0.05, 9);
  ballast.receiveShadow = true;
  root.add(ballast);
  const sleeperGeo = new THREE.BoxGeometry(0.24, 0.1, 2.5);
  const sleeperMat = M(0x7a7368, 0.9);
  for (const tz of [7.4, 10.6]) {
    for (let x = -225.5; x < -148; x += 0.85) inst.add('msleep', sleeperGeo, sleeperMat, mtx(x, Y + 0.18, tz), false);
    for (const dz of [-0.72, 0.72]) {
      const rail = box(78, 0.12, 0.08, M(0x9aa0a8, 0.3, 0.9));
      rail.position.set(-187, Y + 0.28, tz + dz);
      root.add(rail);
    }
    const wire = box(78, 0.025, 0.025, M(0x3a3a40, 0.5, 0.6));
    wire.position.set(-187, Y + 5.8, tz);
    root.add(wire);
  }
  const mastM = M(0x3a3f48, 0.5, 0.6);
  for (const mx of [-170, -200]) {
    root.add(rod(new THREE.Vector3(mx, Y, 13.2), new THREE.Vector3(mx, Y + 7, 13.2), 0.14, mastM, 6));
    root.add(rod(new THREE.Vector3(mx, Y + 6.4, 13.2), new THREE.Vector3(mx, Y + 6.4, 6.8), 0.06, mastM, 4));
  }
  const fenceMat = M(0x1f2a24, 0.5, 0.5);
  const fenceGeo = mergeGeos(railFenceGeometry(8));
  for (const fz of [4, 14]) {
    for (let x = -226; x < -148; x += 8) {
      const segLen = Math.min(8, -148 - x);
      const m = new THREE.Mesh(segLen === 8 ? fenceGeo : mergeGeos(railFenceGeometry(segLen)), fenceMat);
      m.position.set(x + segLen / 2, Y, fz);
      root.add(m);
    }
  }
  addBox({ x0: -226, x1: -148, z0: 3.8, z1: 14.0, top: 9, kind: 'tracks' });

  const flush = builder.flushSteps(root);
  while (!flush.next().done) yield;
  inst.build(() => root);
  void MARINA_GROUND_Y;
}
