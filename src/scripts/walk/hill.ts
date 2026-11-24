/*
  Phase 4: Dalt de la Vila, the hilltop old town north of Carrer Major.
  Features a continuous height grid for the Mediterranean hillside, a sloped
  cobble street, two stone stairways, an upper ramp, a museum, a third pipicà,
  the hilltop church with its always-visible bell tower, a scenic mirador
  overlooking the seafront, and a generic wooden home door.

  All geometry is built in small steps when Millie approaches and torn down
  when she is far away; colliders are tagged "hill" for clean unloading.
*/
import * as THREE from 'three';
import { M, box, cyl, shadowed, makeBench, makeWaterBowl, makeFountain, makePlaneTree } from './models';
import { makeLanternPost, makeFingerpost } from './props';
import { DirectBuilder } from './meshbuilder';
import { bakeSteps } from './bake';
import { SEAFRONT_LAYOUT, buildDistrictBlocksSteps, type DistrictData, type InstanceSink } from './layout';
import { signTexture } from './textures';
import { HeightGrid, stairFloor, addStairsToBuilder, type StairDef } from './terrain';
import type { ColliderGrid, District } from './world';
import type { BoxCollider, CircleCollider, Surface } from './level';

const BASE_Y = 0.12;
const MID_Y = 5.2;
const TOP_Y = 10.5;
const PIP = SEAFRONT_LAYOUT.pipica3;

const STAIRS_E: StairDef = {
  x0: 12, x1: 16, z0: 178, z1: 196, y0: BASE_Y, y1: MID_Y, steps: 24,
  stepColor: 0xd8cdb8, wallColor: 0xbfb39d, wallHeight: 0.9,
};
const STAIRS_TOP: StairDef = {
  x0: -4.5, x1: 4.5, z0: 204, z1: 218, y0: MID_Y, y1: TOP_Y, steps: 26,
  stepColor: 0xdcd2be, wallColor: 0xc2b6a0, wallHeight: 0.95,
};

export const HILL = {
  id: 'hill',
  z0: 173,
  minX: -40,
  maxX: 40,
  maxZ: 246,
  baseY: BASE_Y,
  midY: MID_Y,
  topY: TOP_Y,
  center: { x: 0, z: 214 },
  climb: { x0: -4, x1: 4, z0: 178, z1: 196 },
  rampTop: { x0: -12, x1: -6.5, z0: 204, z1: 218 },
  stairsE: STAIRS_E,
  stairsTop: STAIRS_TOP,
  pipica: PIP,
  // Beside the gate (not in front of it), so Millie can walk straight out.
  pipicaBench: { x: -11.0, z: PIP.gateZ0 - 2.2 },
  bowl: { x: -23.8, z: 198.4 },
  drink: { x: -14.5, z: 220.5 },
  museu: { x0: 16, x1: 30, z0: 196, z1: 210 },
  guide: { x: 14.4, z: 201.4 },
  church: { x0: -10, x1: 10, z0: 232, z1: 246 },
  portal: { x: 0, z: 230.2 },
  caretaker: { x: -4.6, z: 230.6 },
  bellPos: { x: 7.75, y: TOP_Y + 21.0, z: 231.95 },
  mirador: { x0: 5.5, x1: 22, z0: 218.2, z1: 221.5 },
  home: { x: -23.3, z: 227.5 },
  lamps: [
    [-4.8, 177.2], [4.8, 177.2], [-3.5, 187], [3.5, 187],
    [-9.0, 196.8], [10.8, 196.8],
    [-22.0, 220.0], [22.0, 220.0], [-12.0, 230.8], [12.0, 230.8],
  ] as [number, number][],
  trees: [
    [-19, 175.5], [8, 175.5], [-21, 224], [21, 224], [-21, 233], [21, 233],
  ] as [number, number][],
  cypresses: [
    [-14, 184], [-10, 190], [8, 185], [18, 186], [-18, 211], [9, 210], [18, 213],
  ] as [number, number][],
  pedPaths: [
    [[-1.6, 174.5], [-1.6, 186], [-1.6, 199.5], [14, 199.5], [14, 187], [14, 175.2], [1.6, 174.8]],
    [[-9.25, 199.5], [-9.25, 221], [0, 224], [18, 224], [18, 228.5], [-16, 228.5], [-9.25, 222]],
    [[2.0, 200], [2.0, 221.5], [14, 221.5], [19, 227], [0, 227], [-2.0, 221], [-2.0, 200], [11.5, 200]],
  ] as [number, number][][],
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smoothVal = (a: number, b: number, t: number) => {
  const k = clamp(t, 0, 1);
  return a + (b - a) * k * k * (3 - 2 * k);
};

// Shared height grids: `physicsGrid` matches walkable slopes, while `meshGrid` dips
// slightly under flat/sloped paving so the grass mesh never z-fights with panots.
const buildHillGrids = () => {
  const phys = new HeightGrid(-48, 48, 172, 254, 2, BASE_Y);
  const vis = new HeightGrid(-48, 48, 172, 254, 2, BASE_Y);
  const profile = (x: number, z: number) => {
    const und = Math.sin(x * 0.16) * 0.3 + Math.cos(x * 0.09 + z * 0.11) * 0.2;
    if (z <= 178) return BASE_Y;
    if (z < 196) {
      const t = (z - 178) / 18;
      return smoothVal(BASE_Y, MID_Y, t) + und * Math.sin(t * Math.PI);
    }
    if (z <= 204) return MID_Y;
    if (z < 218) {
      const t = (z - 204) / 14;
      return smoothVal(MID_Y, TOP_Y, t) + und * Math.sin(t * Math.PI);
    }
    return TOP_Y;
  };
  phys.setRect(-48, 48, 172, 254, profile);
  vis.setRect(-48, 48, 172, 254, profile);

  const lowerSlope = (_x: number, z: number) => BASE_Y + (clamp((z - 178) / 18, 0, 1)) * (MID_Y - BASE_Y);
  const upperSlope = (_x: number, z: number) => MID_Y + (clamp((z - 204) / 14, 0, 1)) * (TOP_Y - MID_Y);

  for (const g of [phys, vis]) {
    g.setRect(-24, 24, 172, 178, () => BASE_Y);
    g.setRect(-4.5, 4.5, 178, 196, lowerSlope);
    g.setRect(11.5, 16.5, 178, 196, lowerSlope);
    g.setRect(-26, 26, 196, 204, () => MID_Y);
    g.setRect(-26, -12.5, 196, 209, () => MID_Y);
    g.setRect(15.5, 31, 196, 211, () => MID_Y);
    g.setRect(-12.5, -6, 204, 218, upperSlope);
    g.setRect(-5, 5, 204, 218, upperSlope);
    g.setRect(-38, 38, 218, 250, () => TOP_Y);
  }
  // Sink interior vertices of paved slabs slightly in `vis` to eliminate z-fighting.
  vis.setRect(-21, 21, 173, 177.5, () => BASE_Y - 0.06);
  vis.setRect(-3.6, 3.6, 178, 196, (x, z) => lowerSlope(x, z) - 0.08);
  vis.setRect(12.2, 15.8, 178, 196, (x, z) => lowerSlope(x, z) - 0.12);
  vis.setRect(-25, 25, 196.5, 203.5, () => MID_Y - 0.06);
  vis.setRect(-24.5, -13.5, 197.5, 207.5, () => MID_Y - 0.06);
  vis.setRect(-11.5, -7, 204, 218, (x, z) => upperSlope(x, z) - 0.08);
  vis.setRect(-4, 4, 204, 218, (x, z) => upperSlope(x, z) - 0.12);
  vis.setRect(-23.5, 23.5, 218.5, 236, () => TOP_Y - 0.06);
  return { phys, vis };
};

const { phys: hillPhysGrid, vis: hillVisGrid } = buildHillGrids();

/** Ground height anywhere on Dalt de la Vila (continuous across roads, stairs and terraces). */
export function hillFloor(x: number, z: number): number {
  const sE = stairFloor(STAIRS_E, x, z);
  if (sE !== null) return sE;
  const sT = stairFloor(STAIRS_TOP, x, z);
  if (sT !== null) return sT;
  if (z >= 178 && z <= 196 && x >= HILL.climb.x0 && x <= HILL.climb.x1) {
    return BASE_Y + ((z - 178) / 18) * (MID_Y - BASE_Y);
  }
  if (z >= 204 && z <= 218 && x >= HILL.rampTop.x0 && x <= HILL.rampTop.x1) {
    return MID_Y + ((z - 204) / 14) * (TOP_Y - MID_Y);
  }
  if (z <= 178 && x >= -24 && x <= 24) return BASE_Y;
  if (
    (z >= 196 && z <= 204 && x >= -26 && x <= 26)
    || (x >= PIP.x0 && x <= PIP.x1 && z >= PIP.z0 && z <= PIP.z1)
    || (x >= HILL.museu.x0 && x <= HILL.museu.x1 && z >= HILL.museu.z0 && z <= HILL.museu.z1)
  ) return MID_Y;
  if (z >= 218 && x >= -38 && x <= 38) return TOP_Y;
  return hillPhysGrid.sample(x, z);
}

export const inHillPipica = (x: number, z: number) =>
  x > PIP.x0 && x < PIP.x1 && z > PIP.z0 && z < PIP.z1;

export interface HillEnv {
  groundY: number;
  grid: ColliderGrid;
  layout: DistrictData;
  ground: (x0: number, x1: number, z0: number, z1: number, y: number, mat: THREE.Material, tile: number, segX?: number, segZ?: number, heightFn?: (x: number, z: number) => number) => THREE.Mesh;
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

/** Dalt de la Vila as a streamable hillside district. */
export function makeHillDistrict(env: HillEnv): District {
  const d: District = {
    id: HILL.id,
    label: env.layout.label,
    bounds: env.layout.bounds,
    root: new THREE.Group(),
    floor: (x, z) => hillFloor(x, z),
    surface: (x, z): Surface => (inHillPipica(x, z) ? 'sand' : 'paving'),
    built: false,
    baked: false,
    state: 'standin',
    build: () => buildHillSteps(env, d),
    bake: () => bakeSteps(d.root, HILL.z0),
    unload: () => {
      d.root.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); });
      d.root.clear();
    },
  };
  d.root.name = HILL.id;
  return d;
}

/** Lightweight cypress tree (cached materials) for Mediterranean hillside slopes. */
function makeCypress(height = 6.2) {
  const g = new THREE.Group();
  const trunk = cyl(0.11, 0.16, 1.4, M(0x5e4a3a, 0.95), 7);
  trunk.position.y = 0.7;
  g.add(trunk);
  const foliage = M(0x365432, 0.9, 0, { flatShading: true });
  for (let i = 0; i < 3; i++) {
    const rBot = 0.65 - i * 0.16;
    const rTop = i === 2 ? 0.04 : 0.48 - i * 0.14;
    const seg = cyl(rTop, rBot, height * 0.34, foliage, 8);
    seg.position.y = 1.6 + i * (height * 0.25);
    g.add(seg);
  }
  shadowed(g);
  return g;
}

function* buildHillSteps(env: HillEnv, d: District): Generator<void, void, void> {
  const { groundY, grid, mats, r } = env;
  const root = d.root;
  const place = (o: THREE.Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    root.add(o);
    return o;
  };
  const addBox = (b: Omit<BoxCollider, 'district'>) => grid.addBox({ ...b, district: HILL.id });
  const addCircle = (x: number, z: number, rr: number, top: number, kind: string, canPee: boolean, canWhirl: boolean, minY?: number) => {
    const c: CircleCollider = { x, z, r: rr, top, kind, canPee, canWhirl, marked: false, district: HILL.id };
    if (minY !== undefined) c.minY = minY;
    if (canWhirl || kind === 'tree') c.obstacle = { x, z, r: rr, kind: 'pole' };
    else if (['bench', 'bin', 'fountain', 'table'].includes(kind)) c.obstacle = { x, z, r: rr, kind: 'furniture' };
    grid.addCircle(c);
  };

  // ---- Hillside terrain mesh + paved terraces & sloped roads ----
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.02 });
  const terrain = hillVisGrid.buildMesh(terrainMat, (x, y, z) => {
    if (z > 178 && z < 218 && Math.abs(x) > 5) {
      return ((Math.floor(x) + Math.floor(z)) & 1) ? 0x738458 : 0x7e8d61;
    }
    return y > 8 ? 0x8a926a : 0x857f68;
  });
  root.add(terrain);

  // Base terrace, lower sloped street, mid terrace, upper ramp, square, pipicà sand.
  root.add(env.ground(-22, 22, 173, 178, BASE_Y + 0.002, mats.panot, mats.panotTile));
  root.add(env.ground(HILL.climb.x0, HILL.climb.x1, HILL.climb.z0, HILL.climb.z1, 0, mats.flag, mats.flagTile, 2, 18, (x, z) => hillFloor(x, z) + 0.01));
  root.add(env.ground(-26, 26, 196, 204, MID_Y + 0.002, mats.panot, mats.panotTile));
  root.add(env.ground(HILL.rampTop.x0, HILL.rampTop.x1, HILL.rampTop.z0, HILL.rampTop.z1, 0, mats.flag, mats.flagTile, 2, 14, (x, z) => hillFloor(x, z) + 0.01));
  root.add(env.ground(-24, 24, 218, 236, TOP_Y + 0.002, mats.flag, mats.flagTile));
  root.add(env.ground(-24, -10, 236, 244, TOP_Y + 0.002, mats.flag, mats.flagTile));
  root.add(env.ground(10, 24, 236, 244, TOP_Y + 0.002, mats.flag, mats.flagTile));
  root.add(env.ground(PIP.x0, PIP.x1, PIP.z0, PIP.z1, MID_Y + 0.008, mats.sand, 4));
  yield;

  // ---- Layout blocks ----
  const builder = new DirectBuilder(HILL.z0);
  const inst = env.newInstancer();
  const boxes: BoxCollider[] = [];
  const blocks = buildDistrictBlocksSteps(env.layout, {
    groundY, builder, wallMat: mats.wall, inst, boxes,
    litWindowMat: mats.litWindow, darkWindowMat: mats.darkWindow, ironMat: mats.iron, r,
  });
  while (!blocks.next().done) yield;
  for (const b of boxes) grid.addBox(b);

  // ---- Retaining walls, sloped cheek curbs, mirador balustrade ----
  const stone = 0xc9beaa, coping = 0xdad0be;
  const retainingWall = (x0: number, x1: number, z0: number, z1: number, yBot: number, yTop: number, balustrade = false) => {
    if (balustrade) {
      builder.addBox(x0, yBot, z0, x1, TOP_Y + 0.42, z1, stone, { skipBottom: true });
      for (let x = x0 + 0.2; x < x1 - 0.15; x += 0.45) {
        builder.addBox(x, TOP_Y + 0.42, z0 + 0.08, x + 0.12, TOP_Y + 0.88, z1 - 0.08, coping, { skipBottom: true });
      }
      builder.addBox(x0 - 0.04, TOP_Y + 0.88, z0 - 0.04, x1 + 0.04, TOP_Y + 0.98, z1 + 0.04, coping);
      // Keep the balustrade visually open while tall enough in physics to prevent jumping onto hillside banks.
      addBox({ x0, x1, z0, z1, top: TOP_Y + 1.8, kind: 'wall' });
      return;
    }
    builder.addBox(x0, yBot, z0, x1, yTop, z1, stone, { skipBottom: true });
    builder.addBox(x0 - 0.03, yTop, z0 - 0.03, x1 + 0.03, yTop + 0.08, z1 + 0.03, coping);
    addBox({ x0, x1, z0, z1, top: yTop + 0.9, kind: 'wall' });
  };
  // Bottom garden curbs flanking the lower climb and east stairs.
  retainingWall(-22, -4.35, 177.8, 178.15, BASE_Y - 0.2, BASE_Y + 0.85);
  retainingWall(4.35, 11.65, 177.8, 178.15, BASE_Y - 0.2, BASE_Y + 0.85);
  retainingWall(16.35, 22, 177.8, 178.15, BASE_Y - 0.2, BASE_Y + 0.85);
  // Mid-terrace south retaining walls (leaving openings at the climb x -4..4 and east stairs x 12..16).
  retainingWall(-26, -4, 195.6, 196.0, BASE_Y - 0.2, MID_Y + 0.85);
  retainingWall(4, 12, 195.6, 196.0, BASE_Y - 0.2, MID_Y + 0.85);
  // Mid-terrace north barriers closing gaps around pipica3, ramp, and stairsTop.
  retainingWall(-26, -25, 203.9, 204.3, MID_Y - 0.2, MID_Y + 0.95);
  retainingWall(-13, -12, 203.9, 204.3, MID_Y - 0.2, MID_Y + 0.95);
  retainingWall(-6.15, -4.85, 203.9, 204.3, MID_Y - 0.2, MID_Y + 0.95);
  retainingWall(4.85, 16, 203.9, 204.3, MID_Y - 0.2, MID_Y + 0.95);
  // Hilltop south retaining walls & the scenic Mirador balustrade.
  retainingWall(-24, -12, 217.6, 218.0, MID_Y - 0.2, TOP_Y + 0.92, true);
  retainingWall(-6.5, -4.5, 217.6, 218.0, MID_Y - 0.2, TOP_Y + 0.92, true);
  retainingWall(4.5, 24, 217.6, 218.0, MID_Y - 0.2, TOP_Y + 0.92, true);
  // Side curbs along the lower sloped street and upper west ramp.
  const curbWall = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number) => {
    const segs = 6;
    for (let i = 0; i < segs; i++) {
      const sz0 = z0 + (i / segs) * (z1 - z0), sz1 = z0 + ((i + 1) / segs) * (z1 - z0);
      const syBot = Math.max(y0 - 0.4, y0 + (i / segs) * (y1 - y0) - 0.5);
      const syTop = y0 + ((i + 1) / segs) * (y1 - y0) + 0.8;
      builder.addBox(x0, syBot, sz0, x1, syTop, sz1, stone, { skipBottom: true });
    }
    addBox({ x0, x1, z0, z1, top: y1 + 1.6, kind: 'wall' });
  };
  curbWall(-4.35, -4.0, 178, 196, BASE_Y, MID_Y);
  curbWall(4.0, 4.35, 178, 196, BASE_Y, MID_Y);
  curbWall(-12.35, -12.0, 204, 218, MID_Y, TOP_Y);
  curbWall(-6.5, -6.15, 204, 218, MID_Y, TOP_Y);
  yield;

  // ---- Stone stairways ----
  addStairsToBuilder(builder, STAIRS_E, addBox);
  yield;
  addStairsToBuilder(builder, STAIRS_TOP, addBox);
  yield;

  // ---- Museu (mid-terrace east, base at MID_Y) ----
  const MU = HILL.museu;
  builder.addBox(MU.x0, MID_Y, MU.z0, MU.x1, MID_Y + 8.8, MU.z1, 0xdfc8a2);
  builder.addBox(MU.x0 - 0.25, MID_Y + 8.8, MU.z0 - 0.25, MU.x1 + 0.25, MID_Y + 9.4, MU.z1 + 0.25, 0xa85c42);
  builder.addBox(MU.x0 - 0.1, MID_Y + 4.3, MU.z0 - 0.1, MU.x1 + 0.1, MID_Y + 4.55, MU.z1 + 0.1, 0xece4d2);
  // Arched wooden door on the -X facade facing the mid-terrace.
  builder.addBox(MU.x0 - 0.08, MID_Y, 199.0, MU.x0 + 0.04, MID_Y + 3.4, 201.4, 0x4d3726);
  builder.addBox(MU.x0 - 0.16, MID_Y + 3.4, 198.7, MU.x0 + 0.02, MID_Y + 3.85, 201.7, 0xece4d2);
  for (const z of [203.8, 207.2]) {
    builder.addBox(MU.x0 - 0.05, MID_Y + 5.2, z - 0.6, MU.x0 + 0.02, MID_Y + 7.4, z + 0.6, 0x2c3850);
  }
  for (const x of [19.2, 23.0, 26.8]) {
    builder.addBox(x - 0.6, MID_Y + 5.2, MU.z0 - 0.05, x + 0.6, MID_Y + 7.4, MU.z0 + 0.02, 0x2c3850);
  }
  addBox({ x0: MU.x0, x1: MU.x1, z0: MU.z0, z1: MU.z1, top: MID_Y + 9.5, kind: 'building' });
  const museuSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.75, 3.6),
    new THREE.MeshStandardMaterial({ map: signTexture('Museu', 'Història local', '#ffb020', { aspect: 3.6 / 0.75 }), roughness: 0.7 }),
  );
  place(museuSign, MU.x0 - 0.12, MID_Y + 4.05, 200.2);
  yield;

  // ---- Església & Campanar (hilltop square, base at TOP_Y) ----
  const CH = HILL.church;
  const wallCol = 0xe6dcc6, trimCol = 0xd6cab4, roofCol = 0xb2563a;
  // Main limestone nave.
  builder.addBox(CH.x0, TOP_Y, CH.z0, CH.x1, TOP_Y + 13.6, CH.z1, wallCol);
  builder.addBox(CH.x0 - 0.25, TOP_Y + 13.6, CH.z0 - 0.25, CH.x1 + 0.25, TOP_Y + 14.2, CH.z1 + 0.25, trimCol);
  builder.addBox(CH.x0 + 0.8, TOP_Y + 14.2, CH.z0 + 0.4, CH.x1 - 0.8, TOP_Y + 15.6, CH.z1 - 0.4, roofCol);
  builder.addBox(CH.x0 + 3.2, TOP_Y + 15.6, CH.z0 + 0.8, CH.x1 - 3.2, TOP_Y + 16.8, CH.z1 - 0.8, roofCol);
  // Corner pilasters & main portal facing -Z across the square.
  for (const px of [CH.x0, -4.2, 3.6, CH.x1 - 0.6]) {
    builder.addBox(px, TOP_Y, CH.z0 - 0.16, px + 0.6, TOP_Y + 13.6, CH.z0 + 0.1, trimCol);
  }
  builder.addBox(-2.2, TOP_Y, CH.z0 - 0.08, 2.2, TOP_Y + 4.4, CH.z0 + 0.04, 0x3f2b1d);
  builder.addBox(-2.6, TOP_Y + 4.4, CH.z0 - 0.18, 2.6, TOP_Y + 5.0, CH.z0 + 0.04, trimCol);
  builder.addBox(-2.8, TOP_Y, CH.z0 - 0.65, 2.8, TOP_Y + 0.18, CH.z0, trimCol); // church stone threshold step
  // Stone cross finial crowning the nave gable.
  builder.addBox(-0.14, TOP_Y + 16.8, CH.z0 + 0.9, 0.14, TOP_Y + 18.4, CH.z0 + 1.18, trimCol);
  builder.addBox(-0.55, TOP_Y + 17.65, CH.z0 + 0.92, 0.55, TOP_Y + 17.92, CH.z0 + 1.16, trimCol);
  // Old-town stone gate piers at the foot of the climb + terracotta planters along the terraces.
  for (const gx of [-4.25, 4.25]) {
    builder.addBox(gx - 0.35, BASE_Y, 177.2, gx + 0.35, BASE_Y + 2.1, 177.9, stone);
    builder.addBox(gx - 0.42, BASE_Y + 2.1, 177.13, gx + 0.42, BASE_Y + 2.3, 177.97, coping);
    addBox({ x0: gx - 0.4, x1: gx + 0.4, z0: 177.15, z1: 177.95, top: BASE_Y + 2.4, kind: 'wall' });
  }
  const potMat = M(0xb2563a, 0.85);
  const bushMat = M(0x4e8c40, 0.85, 0, { flatShading: true });
  const bushGeo = new THREE.IcosahedronGeometry(0.34, 1);
  const pot = (px: number, py: number, pz: number) => {
    place(cyl(0.26, 0.19, 0.38, potMat, 10), px, py + 0.19, pz);
    place(new THREE.Mesh(bushGeo, bushMat), px, py + 0.58, pz);
    addBox({ x0: px - 0.32, x1: px + 0.32, z0: pz - 0.32, z1: pz + 0.32, top: py + 0.95, kind: 'planter' });
  };
  pot(15.5, MID_Y, 198.0);
  pot(15.5, MID_Y, 202.4);
  pot(-4.9, TOP_Y, 218.5);
  pot(4.9, TOP_Y, 218.5);
  pot(-3.2, TOP_Y, 231.4);
  pot(3.2, TOP_Y, 231.4);
  // Rose window above the portal.
  const roseRing = cyl(1.65, 1.65, 0.2, M(trimCol, 0.85), 20);
  roseRing.rotation.x = Math.PI / 2;
  place(roseRing, 0, TOP_Y + 9.4, CH.z0 - 0.1);
  const roseGlass = cyl(1.3, 1.3, 0.24, M(0x3a528a, 0.35), 20);
  roseGlass.rotation.x = Math.PI / 2;
  place(roseGlass, 0, TOP_Y + 9.4, CH.z0 - 0.11);
  addBox({ x0: CH.x0, x1: CH.x1, z0: CH.z0, z1: CH.z1, top: TOP_Y + 17, kind: 'building' });

  // Bell tower (Campanar) rising on the church's front-east corner.
  const tx0 = 5.0, tx1 = 10.5, tz0 = 232.0, tz1 = 237.5, txMid = (tx0 + tx1) / 2, tzMid = (tz0 + tz1) / 2;
  builder.addBox(tx0, TOP_Y, tz0, tx1, TOP_Y + 19.0, tz1, 0xdfd3ba);
  builder.addBox(tx0 - 0.15, TOP_Y + 18.8, tz0 - 0.15, tx1 + 0.15, TOP_Y + 19.3, tz1 + 0.15, trimCol);
  // Belfry corner piers leaving open arches for the bell.
  for (const [px0, px1] of [[tx0, tx0 + 1.2], [tx1 - 1.2, tx1]]) {
    for (const [pz0, pz1] of [[tz0, tz0 + 1.2], [tz1 - 1.2, tz1]]) {
      builder.addBox(px0, TOP_Y + 19.3, pz0, px1, TOP_Y + 23.6, pz1, 0xdfd3ba);
    }
  }
  builder.addBox(tx0 - 0.2, TOP_Y + 23.6, tz0 - 0.2, tx1 + 0.2, TOP_Y + 24.4, tz1 + 0.2, trimCol);
  // Clock face on the south tower face.
  const clockDial = cyl(1.0, 1.0, 0.14, M(0xf4efe4, 0.7), 16);
  clockDial.rotation.x = Math.PI / 2;
  place(clockDial, txMid, TOP_Y + 16.0, tz0 - 0.08);
  // Warm glow inside the belfry at night.
  const belfryLamp = box(2.4, 2.6, 2.4, mats.lampGlass);
  belfryLamp.userData.dynamic = true;
  place(belfryLamp, txMid, TOP_Y + 21.4, tzMid);
  // Pyramidal terracotta spire & iron finial cross.
  const spire = new THREE.Mesh(new THREE.ConeGeometry(4.1, 4.4, 4), M(roofCol, 0.85));
  spire.rotation.y = Math.PI / 4;
  place(spire, txMid, TOP_Y + 26.6, tzMid);
  const ironM = mats.iron;
  place(box(0.1, 2.0, 0.1, ironM), txMid, TOP_Y + 29.6, tzMid);
  place(box(1.1, 0.1, 0.1, ironM), txMid, TOP_Y + 30.1, tzMid);
  addBox({ x0: tx0, x1: tx1, z0: tz0, z1: tz1, top: TOP_Y + 30, kind: 'building' });
  yield;

  // ---- Generic Home Door (west townhouse at x = -24, no street/house identifiers) ----
  const hz = HILL.home.z;
  builder.addBox(-24.02, TOP_Y, hz - 0.82, -23.86, TOP_Y + 2.65, hz + 0.82, trimCol);
  builder.addBox(-23.96, TOP_Y + 0.02, hz - 0.62, -23.82, TOP_Y + 2.45, hz + 0.62, 0x6f4b30);
  builder.addBox(-23.84, TOP_Y + 1.08, hz + 0.42, -23.76, TOP_Y + 1.18, hz + 0.5, 0xd8b04a); // brass knob
  builder.addBox(-23.82, TOP_Y, hz - 0.65, -23.2, TOP_Y + 0.03, hz + 0.65, 0x9b764e); // doormat
  const porchGlow = box(0.24, 0.3, 0.24, mats.lampGlass);
  porchGlow.userData.dynamic = true;
  place(porchGlow, -23.84, TOP_Y + 2.95, hz);
  // Potted shrub by the doorway.
  place(cyl(0.24, 0.18, 0.36, M(0xb2563a, 0.85), 10), -23.62, TOP_Y + 0.18, hz - 1.25);
  place(new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), M(0x4e8c40, 0.85, 0, { flatShading: true })), -23.62, TOP_Y + 0.56, hz - 1.25);
  yield;

  // ---- Third Pipicà (mid-terrace west, base at MID_Y) ----
  const pFence = 0x2f6b4f, pTop = MID_Y + 1.3;
  const fenceSeg = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (let s = 0; s <= len; s += 0.25) {
      const t = s / len, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      builder.addBox(x - 0.015, MID_Y, z - 0.015, x + 0.015, MID_Y + 1.2, z + 0.015, pFence, { cast: false });
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
    builder.addBox(PIP.x1 - 0.08, MID_Y, gz - 0.08, PIP.x1 + 0.08, MID_Y + 1.6, gz + 0.08, pFence);
  }
  const pSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.7, 2.2),
    new THREE.MeshStandardMaterial({ map: signTexture('Pipicà', 'Off-leash area', '#8bcb3c', { aspect: 2.2 / 0.7 }), roughness: 0.7 }),
  );
  place(pSign, PIP.x1 + 0.1, MID_Y + 1.75, PIP.gateZ0 - 1.5);
  place(makeWaterBowl(), HILL.bowl.x, MID_Y, HILL.bowl.z);
  builder.addBox(-22.2, MID_Y, 204.2, -19.2, MID_Y + 0.35, 204.8, 0x7a5a3c);
  addBox({ x0: -22.2, x1: -19.2, z0: 204.2, z1: 204.8, top: MID_Y + 0.35, kind: 'log' });
  // Bench beside the pipicà gate for Millie's human. The seat point (where the
  // human stops, facing the park) stays just clear of the collider's front edge.
  place(makeBench(), HILL.pipicaBench.x + 0.35, MID_Y, HILL.pipicaBench.z, -Math.PI / 2);
  addBox({ x0: HILL.pipicaBench.x + 0.15, x1: HILL.pipicaBench.x + 0.7, z0: HILL.pipicaBench.z - 0.9, z1: HILL.pipicaBench.z + 0.9, top: MID_Y + 0.5, kind: 'bench' });
  yield;

  // ---- Trees, cypresses, lamps, hilltop benches, drinking fountain & fingerpost ----
  for (let i = 0; i < HILL.trees.length; i++) {
    const [x, z] = HILL.trees[i];
    const y = hillFloor(x, z);
    const t = makePlaneTree(500 + i);
    place(t.group, x, y, z, r() * Math.PI);
    addCircle(x, z, t.radius, y + 3.4, 'tree', true, true, y - 0.2);
    if (i % 2 === 1) yield;
  }
  for (let i = 0; i < HILL.cypresses.length; i++) {
    const [x, z] = HILL.cypresses[i];
    const y = hillFloor(x, z);
    place(makeCypress(5.5 + (i % 3) * 0.9), x, y - 0.1, z);
    addCircle(x, z, 0.22, y + 4.0, 'tree', true, false, y - 0.2);
  }
  yield;
  for (const [x, z] of HILL.lamps) {
    const y = hillFloor(x, z);
    const lamp = makeLanternPost();
    lamp.group.traverse((o) => { const m = o as THREE.Mesh; if (m.material === lamp.glass) m.material = mats.lampGlass; });
    place(lamp.group, x, y, z);
    addCircle(x, z, lamp.radius, y + 9, 'lamp', true, true, y - 0.2);
  }
  // Hilltop benches: two along the mirador looking out to sea, two flanking the church square.
  const bench = (x: number, z: number, facing: '+z' | '-z' | '+x' | '-x', y: number) => {
    const ry = facing === '+z' ? 0 : facing === '-z' ? Math.PI : facing === '+x' ? Math.PI / 2 : -Math.PI / 2;
    place(makeBench(), x, y, z, ry);
    const along = facing === '+z' || facing === '-z';
    addBox({ x0: x - (along ? 0.9 : 0.5), x1: x + (along ? 0.9 : 0.5), z0: z - (along ? 0.5 : 0.9), z1: z + (along ? 0.5 : 0.9), top: y + 0.5, kind: 'bench' });
  };
  bench(10.5, 219.7, '-z', TOP_Y);
  bench(17.5, 219.7, '-z', TOP_Y);
  bench(-15.5, 224.0, '+x', TOP_Y);
  bench(15.5, 224.0, '-x', TOP_Y);
  place(makeFountain(), HILL.drink.x, TOP_Y, HILL.drink.z, Math.PI / 2);
  addCircle(HILL.drink.x, HILL.drink.z, 0.25, TOP_Y + 1.1, 'fountain', true, false, TOP_Y - 0.2);
  place(makeFingerpost([
    { title: 'Església · Mirador', sub: 'Dalt', color: '#8bcb3c', angle: Math.PI / 2 },
    { title: 'Museu', sub: 'Terrassa', color: '#ffb020', angle: 0 },
  ]), -5.2, BASE_Y, 175.4);
  addCircle(-5.2, 175.4, 0.12, BASE_Y + 3.5, 'pole', true, true, BASE_Y - 0.2);
  yield;

  yield* builder.flushSteps(root);
  yield;
  inst.build(() => root);
}

/**
 * Always-visible hilltop church silhouette rendered in the horizon group with gentle
 * atmospheric haze. Game loop hides it whenever the live `hill` district is visible.
 */
export function makeChurchLandmark(): THREE.Group {
  const g = new THREE.Group();
  const haze = 0.26;
  const part = (w: number, h: number, d: number, x: number, y: number, z: number, colorHex: number) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, fog: false });
    const base = new THREE.Color(colorHex);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.onBeforeRender = (_r, scene) => {
      const fog = scene.fog as THREE.Fog | null;
      mat.color.copy(base);
      if (fog) mat.color.lerp(fog.color, haze);
    };
    m.userData.always = true;
    m.userData.dynamic = true;
    g.add(m);
  };
  // Hillside green-ochre plinth beneath the hilltop so the church never floats from afar.
  part(72, TOP_Y - 0.12, 30, 0, (TOP_Y - 0.12) / 2, 233, 0x7a8564);
  // Church nave + terracotta roof + tall bell tower + pyramidal spire.
  part(20, 14, 14, 0, TOP_Y + 7, 239, 0xe6dcc6);
  part(18.4, 2.2, 13.2, 0, TOP_Y + 15.1, 239, 0xb2563a);
  part(5.5, 24.4, 5.5, 7.75, TOP_Y + 12.2, 234.75, 0xdfd3ba);

  const spireGeo = new THREE.ConeGeometry(4.1, 4.4, 4);
  spireGeo.rotateY(Math.PI / 4);
  const spireBase = new THREE.Color(0xb2563a);
  const spireMat = new THREE.MeshBasicMaterial({ color: 0xb2563a, fog: false });
  const spire = new THREE.Mesh(spireGeo, spireMat);
  spire.position.set(7.75, TOP_Y + 26.6, 234.75);
  spire.onBeforeRender = (_r, scene) => {
    const fog = scene.fog as THREE.Fog | null;
    spireMat.color.copy(spireBase);
    if (fog) spireMat.color.lerp(fog.color, haze);
  };
  spire.userData.always = true;
  spire.userData.dynamic = true;
  g.add(spire);

  g.userData.always = true;
  g.userData.dynamic = true;
  return g;
}
