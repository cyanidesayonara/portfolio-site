/*
  Run a district's runtime in its own local frame, shifted by `dx` along x from the
  world (see hillOffset.ts and marinaOffset.ts). The runtime sees Millie, her human and
  the scene through these views: positions it reads come in shifted, and everything it
  places, rings, beacons, particles and sounds goes back out into the world.
*/
import * as THREE from 'three';
import type { WalkAudio } from './audio';
import type { TelegraphPool } from './telegraph';

type Burst = (x: number, y: number, z: number, color: number, n?: number, spd?: number, up?: number, life?: number, g?: number) => void;

export function localFrame(scene: THREE.Object3D, dx: number) {
  const space = new THREE.Group();
  space.position.x = dx;
  scene.add(space);
  const toWorldArg = (a: unknown) =>
    (a && typeof a === 'object' && 'x' in a && 'z' in a ? { ...(a as { x: number; z: number }), x: (a as { x: number }).x + dx } : a);
  return {
    /** Holds everything the runtime adds to its scene. */
    space,
    /** A scene stand-in whose `add` places objects in the local frame. */
    scene: { add: (...o: THREE.Object3D[]) => space.add(...o) } as unknown as THREE.Scene,
    /** A live view of a world object (Millie, her human) with x in the local frame; writes go through. */
    view: <T extends { x: number }>(o: T): T => new Proxy(o, {
      get: (t, k) => (k === 'x' ? t.x - dx : Reflect.get(t, k)),
      set: (t, k, v) => Reflect.set(t, k, k === 'x' ? (v as number) + dx : v),
    }),
    audio: (audio: WalkAudio): WalkAudio => new Proxy(audio, {
      get(t, k) {
        const v = Reflect.get(t, k);
        return typeof v === 'function' ? (...args: unknown[]) => (v as (...a: unknown[]) => unknown).apply(t, args.map(toWorldArg)) : v;
      },
    }),
    telegraphs: (tp: TelegraphPool): TelegraphPool => ({
      ring: (x: number, y: number, z: number, r: number, fill01: number, color: number) => tp.ring(x + dx, y, z, r, fill01, color),
      lane: (x0: number, z0: number, x1: number, z1: number, y: number, width: number, fill01: number, color: number) => tp.lane(x0 + dx, z0, x1 + dx, z1, y, width, fill01, color),
      beacon: (x: number, y: number, z: number, r: number, time: number, color: number) => tp.beacon(x + dx, y, z, r, time, color),
    }) as unknown as TelegraphPool,
    burst: (b: Burst): Burst => (x, ...rest) => b(x + dx, ...rest),
  };
}
