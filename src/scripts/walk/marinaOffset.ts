/*
  Where the port sits along the coast. The marina district, its runtime, El Mico de
  Bronze and the boat wake chase are written in the marina's own local frame; the world
  position is that frame shifted by MARINA_DX along x. Like the real port southwest of
  the old pier, the breakwater's root meets the end of the beach (local x -214, world
  x 258), the canal runs inland right beside it, and the boatyard end is the far +x side.

  Kept free of Three.js imports so node --test can use it.
*/
export { shiftX } from './hillOffset.ts';

/** World x = marina-local x + MARINA_DX. */
export const MARINA_DX = 472;

/**
 * Canal i Galeria and Ronda i Parc share the port's frame: Gorg's canal runs straight inland
 * from the port's canal, as the real one does, and Ronda sits north of Gorg.
 */
export const GORG_DX = MARINA_DX;
export const RONDA_DX = MARINA_DX;
