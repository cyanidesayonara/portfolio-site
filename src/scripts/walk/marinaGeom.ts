/*
  Pure floor, surface, and area predicates for Phase 6 (The Marina & Breakwater).
  Kept free of Three.js imports so node --test can exercise geometry math directly.
*/

export const MARINA_GROUND_Y = 0.12;
export const MARINA_WATER_Y = -1.6;
export const PONTOON_Y = -0.95;
export const BREAKWATER_Y = MARINA_GROUND_Y + 0.35;

export const MARINA_PIPICA = {
  x0: -158,
  x1: -144,
  z0: -14,
  z1: -4,
  gateZ0: -10.2,
  gateZ1: -7.8,
};

export const PONTOON_A = { x0: -126, x1: -122, z0: -58, z1: -22, rampZ1: -18 };
export const PONTOON_B = { x0: -152, x1: -148, z0: -58, z1: -22, rampZ1: -18 };
export const BREAKWATER = {
  x0: -214,
  x1: -206,
  z0: -104,
  z1: -30,
  rampZ1: -26,
  armX1: -158,
  armZ0: -104,
  armZ1: -96,
};
/** Where the safety clamp keeps Millie in the marina (beyond the promenade's seam). */
export const MARINA_CLAMP = { x0: -222, z0: -108, z1: 3.6 } as const;

export const CANAL = { x0: -178, x1: -162, bridgeZ0: -10, bridgeZ1: -2 };

export const inMarinaPipica = (x: number, z: number) =>
  x > MARINA_PIPICA.x0 && x < MARINA_PIPICA.x1 && z > MARINA_PIPICA.z0 && z < MARINA_PIPICA.z1;

export const onCanalBridge = (x: number, z: number) =>
  x >= CANAL.x0 && x <= CANAL.x1 && z >= CANAL.bridgeZ0 && z <= CANAL.bridgeZ1;

export function onPontoon(x: number, z: number): 'A' | 'B' | null {
  if (x >= PONTOON_A.x0 && x <= PONTOON_A.x1 && z >= PONTOON_A.z0 && z <= PONTOON_A.rampZ1) return 'A';
  if (x >= PONTOON_B.x0 && x <= PONTOON_B.x1 && z >= PONTOON_B.z0 && z <= PONTOON_B.rampZ1) return 'B';
  return null;
}

export function onBreakwater(x: number, z: number): boolean {
  const onStem = x >= BREAKWATER.x0 && x <= BREAKWATER.x1 && z >= BREAKWATER.z0 && z <= BREAKWATER.rampZ1;
  const onArm = x >= BREAKWATER.x0 && x <= BREAKWATER.armX1 && z >= BREAKWATER.armZ0 && z <= BREAKWATER.armZ1;
  return onStem || onArm;
}

export function onMarinaQuay(x: number, z: number): boolean {
  if (x >= -214 && x <= -180 && z >= -26 && z <= -18) return true;
  if (x >= -214 && x <= -104 && z >= -18 && z <= 4) {
    // Canal inlet slices north-south across x [-178, -162], crossed only by the footbridge.
    if (x > CANAL.x0 && x < CANAL.x1) return onCanalBridge(x, z);
    return true;
  }
  return false;
}

export function marinaFloor(x: number, z: number): number {
  const pont = onPontoon(x, z);
  if (pont) {
    const p = pont === 'A' ? PONTOON_A : PONTOON_B;
    if (z > p.z1) {
      const t = (p.rampZ1 - z) / (p.rampZ1 - p.z1);
      return MARINA_GROUND_Y + t * (PONTOON_Y - MARINA_GROUND_Y);
    }
    return PONTOON_Y;
  }
  if (onBreakwater(x, z)) {
    if (x >= BREAKWATER.x0 && x <= BREAKWATER.x1 && z > BREAKWATER.z1 && z <= BREAKWATER.rampZ1) {
      const t = (BREAKWATER.rampZ1 - z) / (BREAKWATER.rampZ1 - BREAKWATER.z1);
      return MARINA_GROUND_Y + t * (BREAKWATER_Y - MARINA_GROUND_Y);
    }
    return BREAKWATER_Y;
  }
  if (onMarinaQuay(x, z)) return MARINA_GROUND_Y;
  return MARINA_WATER_Y - 1.2;
}

export function marinaSurface(x: number, z: number): 'paving' | 'sand' | 'deck' | 'water' {
  if (inMarinaPipica(x, z)) return 'sand';
  if (onPontoon(x, z) || onCanalBridge(x, z)) return 'deck';
  if (onBreakwater(x, z) || onMarinaQuay(x, z)) return 'paving';
  return 'water';
}
