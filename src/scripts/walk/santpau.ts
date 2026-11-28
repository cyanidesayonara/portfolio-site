/*
  Sant Pau i Prim: the old streets on the Montgat side of Carrer del Mar (re-orientation
  step 5). Carrer de Sant Pau and Carrer de Prim run inland from the Rambla with a side
  street and the Placeta between them; the eighth pipicà is in the Placeta. Blocks and
  street paving come from the layout data (blocksDistrict.ts); this adds the square,
  the pipicà, street furniture and washing lines. Runtime: santpauLife.ts.
*/
import * as THREE from 'three';
import { M, box, makeBench, makeWaterBowl, makeFountain } from './models';
import { makeLanternPost } from './props';
import { signTexture } from './textures';
import { makeBlocksDistrict, type BlocksEnv } from './blocksDistrict';
import type { District } from './world';
import type { BoxCollider, CircleCollider } from './level';
import { SANTPAU_GROUND_Y, SANTPAU_PIPICA, SANTPAU_PLACETA, santpauSurface } from './santpauGeom';

export { inSantPauPipica } from './santpauGeom';

const PIP = SANTPAU_PIPICA;

/** Shared positions for the district (santpau.ts) and its runtime (santpauLife.ts), in world coordinates. */
export const SANTPAU = {
  id: 'santpau',
  center: { x: -142, z: 80 },
  pipica: PIP,
  pipicaBench: { x: PIP.x1 + 1.6, z: PIP.gateZ0 - 2.4 },
  bowl: { x: PIP.x1 + 1.4, z: PIP.z1 + 1.2 },
  drink: { x: -129.5, z: 62.5 },
  /** The neighbor waiting for her bedsheet, at her door on Carrer de Sant Pau. */
  neighbor: { x: -119.2, z: 98 },
  /** Where the bedsheet came down: the top of Carrer de Prim. */
  sheetPos: { x: -166, z: 117 },
  /** The accordion player in the Placeta. */
  musician: { x: -133, z: 74.6 },
  /** The knife sharpener with his grinding cart on Carrer de Prim. */
  esmolet: { x: -163.6, z: 50 },
  lamps: [
    [-125.4, 52], [-118.6, 112], [-169.4, 104], [-162.6, 44], [-129, 76.4], [-160.6, 76.4],
  ] as [number, number][],
  pedPaths: [
    [[-123, 36], [-123, 120], [-123, 36]],
    [[-167, 36], [-167, 120], [-167, 36]],
    [[-168, 80], [-120, 80], [-168, 80]],
  ] as [number, number][][],
};

export type SantPauEnv = Omit<BlocksEnv, 'surface' | 'extra'> & { lampGlass: THREE.MeshStandardMaterial; sand: THREE.Material };

export function makeSantPauDistrict(env: SantPauEnv): District {
  const { grid } = env;
  const Y = SANTPAU_GROUND_Y;
  const addBox = (b: Omit<BoxCollider, 'district'>) => grid.addBox({ ...b, district: SANTPAU.id });
  const addCircle = (x: number, z: number, r: number, top: number, kind: string, canPee: boolean, canWhirl: boolean) => {
    const c: CircleCollider = { x, z, r, top, kind, canPee, canWhirl, marked: false, district: SANTPAU.id };
    if (canWhirl) c.obstacle = { x, z, r, kind: 'pole' };
    else if (['bench', 'fountain'].includes(kind)) c.obstacle = { x, z, r, kind: 'furniture' };
    grid.addCircle(c);
  };

  return makeBlocksDistrict({
    ...env,
    surface: santpauSurface,
    *extra(root, builder) {
      const place = (o: THREE.Object3D, x: number, y: number, z: number, ry = 0) => {
        o.position.set(x, y, z);
        o.rotation.y = ry;
        root.add(o);
        return o;
      };
      const S = SANTPAU_PLACETA;
      // The Placeta's paving, and sand in the pipicà.
      root.add(env.ground(S.x0, S.x1, S.z0, S.z1, Y + 0.002, env.mats.panot, env.mats.panotTile));
      root.add(env.ground(PIP.x0, PIP.x1, PIP.z0, PIP.z1, Y + 0.008, env.sand, 4));
      yield;

      // Pipicà fence (gate on the square's side, +x), sign, bench and water bowl.
      const fence = 0x2f6b4f;
      const top = Y + 1.3;
      const seg = (x0: number, z0: number, x1: number, z1: number) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        for (let s = 0; s <= len; s += 0.3) {
          const t = s / len;
          const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
          builder.addBox(px - 0.015, Y, pz - 0.015, px + 0.015, Y + 1.2, pz + 0.015, fence, { cast: false });
        }
        const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
        builder.addBox(minX - 0.03, top - 0.08, minZ - 0.03, maxX + 0.03, top - 0.02, maxZ + 0.03, fence);
        addBox({ x0: minX - 0.1, x1: maxX + 0.1, z0: minZ - 0.1, z1: maxZ + 0.1, top, kind: 'fence' });
      };
      seg(PIP.x0, PIP.z0, PIP.x1, PIP.z0);
      seg(PIP.x0, PIP.z1, PIP.x1, PIP.z1);
      seg(PIP.x0, PIP.z0, PIP.x0, PIP.z1);
      seg(PIP.x1, PIP.z0, PIP.x1, PIP.gateZ0);
      seg(PIP.x1, PIP.gateZ1, PIP.x1, PIP.z1);
      for (const gz of [PIP.gateZ0, PIP.gateZ1]) builder.addBox(PIP.x1 - 0.08, Y, gz - 0.08, PIP.x1 + 0.08, Y + 1.6, gz + 0.08, fence);
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.7, 2.2),
        new THREE.MeshStandardMaterial({ map: signTexture('Pipicà', 'Off-leash area', '#8bcb3c', { aspect: 2.2 / 0.7 }), roughness: 0.7 }),
      );
      place(sign, PIP.x1 + 0.1, Y + 1.75, PIP.gateZ0 - 1.4);
      place(makeBench(), SANTPAU.pipicaBench.x, Y, SANTPAU.pipicaBench.z, -Math.PI / 2);
      addBox({ x0: SANTPAU.pipicaBench.x - 0.3, x1: SANTPAU.pipicaBench.x + 0.3, z0: SANTPAU.pipicaBench.z - 0.9, z1: SANTPAU.pipicaBench.z + 0.9, top: Y + 0.5, kind: 'bench' });
      place(makeWaterBowl(), SANTPAU.bowl.x, Y, SANTPAU.bowl.z);
      place(makeFountain(), SANTPAU.drink.x, Y, SANTPAU.drink.z, Math.PI / 2);
      addCircle(SANTPAU.drink.x, SANTPAU.drink.z, 0.25, Y + 1.1, 'fountain', true, false);
      yield;

      // Lamps.
      for (const [x, z] of SANTPAU.lamps) {
        const lamp = makeLanternPost();
        lamp.group.traverse((o) => { const m = o as THREE.Mesh; if (m.material === lamp.glass) m.material = env.lampGlass; });
        place(lamp.group, x, Y, z);
        addCircle(x, z, lamp.radius, Y + 9, 'lamp', true, true);
      }
      yield;

      // Washing lines strung across both streets, with clothes and a few sheets.
      const cloth = [0xf4f1ea, 0x3d73c7, 0xe5487a, 0xffc93c, 0x8bcb3c, 0xd9d6ce];
      let k = 0;
      for (const [x0, x1] of [[-126, -118], [-170, -162]]) {
        for (const z of [44, 58, 92, 108]) {
          const y = Y + 6.6 + (k % 2) * 3;
          builder.addBox(x0, y, z - 0.01, x1, y + 0.02, z + 0.01, 0x8a8f96, { cast: false });
          for (let x = x0 + 0.8; x < x1 - 0.6; x += 1.3) {
            const c = cloth[(k++) % cloth.length];
            const tall = k % 4 === 0 ? 1.4 : 0.7;
            builder.addBox(x, y - tall, z - 0.02, x + 0.9, y, z + 0.02, c);
          }
        }
      }
      // The accordion player's folding stool, and the Placeta's planters.
      builder.addBox(SANTPAU.musician.x - 0.22, Y, SANTPAU.musician.z - 0.22, SANTPAU.musician.x + 0.22, Y + 0.45, SANTPAU.musician.z + 0.22, 0x5a4636);
      for (const [px, pz] of [[-140, 62], [-134, 62]]) {
        root.add(box(1.6, 0.6, 1.6, M(0xb2563a, 0.9)).translateX(px).translateY(Y + 0.3).translateZ(pz));
        root.add(box(1.4, 0.5, 1.4, M(0x5f8a46, 0.9)).translateX(px).translateY(Y + 0.85).translateZ(pz));
        addBox({ x0: px - 0.8, x1: px + 0.8, z0: pz - 0.8, z1: pz + 0.8, top: Y + 1.1, kind: 'planter' });
      }
    },
  });
}
