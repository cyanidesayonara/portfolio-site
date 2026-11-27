/*
  Pure floor, surface, and area predicates for Phase 7 (Canal i Galeria / Gorg).
  Kept free of Three.js imports so node --test can exercise geometry math directly.
*/

export const GORG_GROUND_Y = 0.12;
export const GORG_WATER_Y = -1.6;

export const GORG_CANAL = {
  x0: -178,
  x1: -162,
  z0: 14,
  z1: 96,
  bridgeS: { z0: 20, z1: 28 },
  bridgeN: { z0: 62, z1: 70 },
} as const;

export const GORG_PIPICA = {
  x0: -156,
  x1: -142,
  z0: 21,
  z1: 31,
  gateZ0: 24.8,
  gateZ1: 27.2,
} as const;

export const GORG_COURT = {
  x0: -146,
  x1: -124,
  z0: 54,
  z1: 74,
  hoopX: -126.2,
  hoopZ: 64.0,
} as const;

export const GORG_TRAM = {
  z: 37.0,
  x0: -216,
  x1: -110,
  stopX: -148,
  stopZ: 34.0,
} as const;

export const GORG_GALLERY = {
  x0: -218,
  x1: -188,
  z0: 44,
  z1: 86,
} as const;

export const GORG_PAVELLO = {
  x0: -154,
  x1: -120,
  z0: 78,
  z1: 98,
} as const;

export const inGorgPipica = (x: number, z: number): boolean =>
  x > GORG_PIPICA.x0 && x < GORG_PIPICA.x1 && z > GORG_PIPICA.z0 && z < GORG_PIPICA.z1;

export function onGorgBridge(x: number, z: number): 'S' | 'N' | null {
  if (x < GORG_CANAL.x0 || x > GORG_CANAL.x1) return null;
  if (z >= GORG_CANAL.bridgeS.z0 && z <= GORG_CANAL.bridgeS.z1) return 'S';
  if (z >= GORG_CANAL.bridgeN.z0 && z <= GORG_CANAL.bridgeN.z1) return 'N';
  return null;
}

export function inGorgCanalWater(x: number, z: number): boolean {
  return (
    x > GORG_CANAL.x0
    && x < GORG_CANAL.x1
    && z >= GORG_CANAL.z0
    && z <= GORG_CANAL.z1
    && !onGorgBridge(x, z)
  );
}

export const inGorgCourt = (x: number, z: number): boolean =>
  x >= GORG_COURT.x0 && x <= GORG_COURT.x1 && z >= GORG_COURT.z0 && z <= GORG_COURT.z1;

export function gorgFloor(x: number, z: number): number {
  if (inGorgCanalWater(x, z)) return GORG_WATER_Y - 1.2;
  return GORG_GROUND_Y;
}

export function gorgSurface(x: number, z: number): 'paving' | 'sand' | 'deck' | 'water' {
  if (inGorgPipica(x, z)) return 'sand';
  if (onGorgBridge(x, z)) return 'deck';
  if (inGorgCanalWater(x, z)) return 'water';
  return 'paving';
}
