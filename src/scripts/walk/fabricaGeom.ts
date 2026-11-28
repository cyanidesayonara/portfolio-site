/*
  Pure floor, surface, and area predicates for Phase 9 (La Fàbrica, on the Rambla's +x side).
  Kept free of Three.js imports so node --test can exercise geometry math directly.
*/

export const FABRICA_GROUND_Y = 0.12;

/** The whole district (inland from the Rambla's +x end). */
export const FABRICA_BOUNDS = { x0: 96, x1: 176, z0: 33.5, z1: 104 } as const;

/** Avinguda de la Fàbrica: a pedestrianized avenue running inland from the Rambla. */
export const FABRICA_AVENUE = { x0: 110, x1: 126, z0: 33.5, z1: 103.5, midX: 118 } as const;

/** The square at the foot of the old factory chimney, on the avenue's +x side. */
export const FABRICA_SQUARE = { x0: 126, x1: 172, z0: 58, z1: 96 } as const;

/** Old brick factory chimney (square base, round shaft). */
export const FABRICA_CHIMNEY = { x: 162, z: 88, base: 3.2, height: 32 } as const;

export const FABRICA_PIPICA = {
  x0: 150,
  x1: 164,
  z0: 62,
  z1: 74,
  gateZ0: 66.5,
  gateZ1: 69.5,
} as const;

/** The Rambla strip past the old x = 92 rail, now walkable up to the new end rail. */
export const RAMBLA_EAST = { x0: 91.5, x1: 139.4, z0: 14.3, z1: 33.6 } as const;

export const inFabricaPipica = (x: number, z: number): boolean =>
  x > FABRICA_PIPICA.x0 && x < FABRICA_PIPICA.x1 && z > FABRICA_PIPICA.z0 && z < FABRICA_PIPICA.z1;

export const onFabricaAvenue = (x: number, z: number): boolean =>
  x >= FABRICA_AVENUE.x0 && x <= FABRICA_AVENUE.x1 && z >= FABRICA_AVENUE.z0 && z <= FABRICA_AVENUE.z1;

export const inFabricaSquare = (x: number, z: number): boolean =>
  x >= FABRICA_SQUARE.x0 && x <= FABRICA_SQUARE.x1 && z >= FABRICA_SQUARE.z0 && z <= FABRICA_SQUARE.z1;

/** Walkable ground: the avenue or the square (blocks elsewhere are solid). */
export const inFabricaOpen = (x: number, z: number): boolean => onFabricaAvenue(x, z) || inFabricaSquare(x, z);

export function fabricaFloor(_x: number, _z: number): number {
  return FABRICA_GROUND_Y;
}

export function fabricaSurface(x: number, z: number): 'paving' | 'sand' {
  return inFabricaPipica(x, z) ? 'sand' : 'paving';
}

/**
  Keep a point inside the walkable avenue + square. Returns the clamped point;
  a point in neither is pulled to the nearest one of them.
*/
export function clampFabrica(x: number, z: number): { x: number; z: number } {
  const A = FABRICA_AVENUE, S = FABRICA_SQUARE;
  const inset = 0.4;
  const a = {
    x: Math.max(A.x0 + inset, Math.min(A.x1 - inset, x)),
    z: Math.max(A.z0, Math.min(A.z1 - inset, z)),
  };
  // The square opens off the avenue's +x side, so it shares the avenue's +x edge.
  const s = {
    x: Math.max(A.x1 - inset, Math.min(S.x1 - inset, x)),
    z: Math.max(S.z0 + inset, Math.min(S.z1 - inset, z)),
  };
  const da = Math.hypot(a.x - x, a.z - z);
  const ds = Math.hypot(s.x - x, s.z - z);
  return da <= ds ? a : s;
}
