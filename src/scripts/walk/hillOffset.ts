/*
  Where Dalt de la Vila sits along the coast. The hill district, its runtime and its
  boss and chase logic are written in the hill's own local frame (the church on x 0);
  the world position is that frame shifted by HILL_DX along x. Moving the old town
  toward its real place northeast of Carrer del Mar (the map re-orientation, step 2)
  only changes this number.

  Kept free of Three.js imports so node --test can use it.
*/

/** World x = hill-local x + HILL_DX. */
export const HILL_DX = -48;

const X_KEYS = new Set(['x', 'x0', 'x1', 'minX', 'maxX']);

/**
 * A deep copy of `v` with every x shifted by `dx`: numeric fields named x, x0, x1, minX
 * or maxX, and two-number arrays, which are read as [x, z] points.
 */
export function shiftX<T>(v: T, dx: number): T {
  if (Array.isArray(v)) {
    if (v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') return [v[0] + dx, v[1]] as T;
    return v.map((e) => shiftX(e, dx)) as T;
  }
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, e] of Object.entries(v as Record<string, unknown>)) {
      out[k] = typeof e === 'number' ? (X_KEYS.has(k) ? e + dx : e) : shiftX(e, dx);
    }
    return out as T;
  }
  return v;
}
