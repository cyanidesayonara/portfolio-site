/*
  Pure floor, surface, and area predicates for Phase 8 (Ronda / Parc).
  Kept free of Three.js imports so node --test can exercise geometry math directly.
*/

export const RONDA_GROUND_Y = 0.12;
export const RONDA_TRENCH_Y = -4.0;

/** Sunken highway trench running east-west through the district. */
export const RONDA_TRENCH = {
  x0: -220,
  x1: -110,
  z0: 132,
  z1: 148,
} as const;

/** Pedestrian footbridge spanning the trench (Pont de vianants). */
export const RONDA_BRIDGE = {
  x0: -178,
  x1: -152,
  z0: 132,
  z1: 148,
} as const;

export const RONDA_PIPICA = {
  x0: -200,
  x1: -186,
  z0: 168,
  z1: 182,
  gateZ0: 172.5,
  gateZ1: 175.5,
} as const;

/** Concrete skate ramp pad in the park (north of the trench). */
export const RONDA_SKATE = {
  x0: -168,
  x1: -148,
  z0: 158,
  z1: 174,
  rampX: -158,
  rampZ: 166,
} as const;

/** Ambient traffic corridor along the trench floor. */
export const RONDA_TRAFFIC = {
  z: 140.0,
  x0: -216,
  x1: -114,
  laneZ: [137.2, 140.0, 142.8] as const,
} as const;

export const inRondaPipica = (x: number, z: number): boolean =>
  x > RONDA_PIPICA.x0 && x < RONDA_PIPICA.x1 && z > RONDA_PIPICA.z0 && z < RONDA_PIPICA.z1;

export const inRondaSkate = (x: number, z: number): boolean =>
  x >= RONDA_SKATE.x0 && x <= RONDA_SKATE.x1 && z >= RONDA_SKATE.z0 && z <= RONDA_SKATE.z1;

export function onRondaBridge(x: number, z: number): boolean {
  return (
    x >= RONDA_BRIDGE.x0
    && x <= RONDA_BRIDGE.x1
    && z >= RONDA_BRIDGE.z0
    && z <= RONDA_BRIDGE.z1
  );
}

/** Open trench (not covered by the overpass). Millie never walks here — cheek walls block it. */
export function inRondaTrenchOpen(x: number, z: number): boolean {
  return (
    x > RONDA_TRENCH.x0
    && x < RONDA_TRENCH.x1
    && z >= RONDA_TRENCH.z0
    && z <= RONDA_TRENCH.z1
    && !onRondaBridge(x, z)
  );
}

/** Park lawn north of the trench (excludes pipicà sand and skate pad). */
export function inRondaPark(x: number, z: number): boolean {
  if (z < RONDA_TRENCH.z1 || z > 192) return false;
  if (x < -220 || x > -110) return false;
  if (inRondaPipica(x, z) || inRondaSkate(x, z)) return false;
  return true;
}

export function rondaFloor(x: number, z: number): number {
  if (onRondaBridge(x, z)) return RONDA_GROUND_Y;
  if (inRondaTrenchOpen(x, z)) return RONDA_TRENCH_Y;
  return RONDA_GROUND_Y;
}

export function rondaSurface(x: number, z: number): 'paving' | 'sand' | 'deck' {
  if (inRondaPipica(x, z)) return 'sand';
  if (onRondaBridge(x, z)) return 'deck';
  if (inRondaSkate(x, z)) return 'paving';
  if (inRondaTrenchOpen(x, z)) return 'paving';
  // Park lawn uses paving friction (same as hillside grass pads).
  return 'paving';
}
