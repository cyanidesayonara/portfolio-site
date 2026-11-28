/*
  Pure positions and predicates for Sant Pau i Prim, the old streets on the Montgat side
  of Carrer del Mar (re-orientation step 5). World coordinates; kept free of Three.js so
  node --test can use them.
*/

export const SANTPAU_GROUND_Y = 0.12;

/** Carrer de Sant Pau: inland from the Rambla, the bottle chase runs down it. */
export const SANTPAU_STREET = { x0: -126, x1: -118, z0: 34, z1: 126, midX: -122 } as const;
/** Carrer de Prim, parallel to it on the -x side. */
export const PRIM_STREET = { x0: -170, x1: -162, z0: 34, z1: 126, midX: -166 } as const;
/** The side street joining them. */
export const SANTPAU_CROSS = { x0: -170, x1: -118, z0: 77, z1: 83 } as const;
/** The Placeta between the two streets, with the eighth pipicà. */
export const SANTPAU_PLACETA = { x0: -162, x1: -126, z0: 60, z1: 77 } as const;

export const SANTPAU_PIPICA = {
  x0: -160,
  x1: -148,
  z0: 62,
  z1: 74,
  gateZ0: 66.8,
  gateZ1: 69.2,
} as const;

export const inSantPauPipica = (x: number, z: number): boolean =>
  x > SANTPAU_PIPICA.x0 && x < SANTPAU_PIPICA.x1 && z > SANTPAU_PIPICA.z0 && z < SANTPAU_PIPICA.z1;

export const onSantPauStreet = (x: number, z: number): boolean =>
  x >= SANTPAU_STREET.x0 && x <= SANTPAU_STREET.x1 && z >= SANTPAU_STREET.z0 && z <= SANTPAU_STREET.z1;

export function santpauSurface(x: number, z: number): 'paving' | 'sand' {
  return inSantPauPipica(x, z) ? 'sand' : 'paving';
}
