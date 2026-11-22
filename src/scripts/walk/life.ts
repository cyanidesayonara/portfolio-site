/*
  Ambient life: the people (and dogs) who make the town feel lived in.

  - Dog walkers whose dogs come over to sniff Millie and bark back at her.
  - Joggers on the promenade, a coconut seller working the beach, a pair
    playing palas, swimmers and a paddle boarder.
  - Neighbors sitting out on chairs in the side streets, kids playing tag on
    the Rambla.

  Everyone beyond VIEW meters of Millie is hidden and skipped, so the crowd
  only costs draw calls where you can actually see it.
*/
import * as THREE from 'three';
import type { Level } from './level';
import type { Hud } from './hud';
import type { WalkAudio } from './audio';
import { makeDog, makePerson, NPC_HAIRS, NPC_SKINS, NPC_TOPS, M, type DogLook } from './models';
import { collapseRig } from './bake';

const VIEW = 48;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pickOne = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const angLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

type P = { x: number; z: number };
export interface LifeCtx {
  scene: THREE.Scene;
  level: Level;
  hud: Hud;
  audio: WalkAudio;
  dog: { x: number; y: number; z: number };
  human: { x: number; z: number };
  collide: (p: P, r: number, feetY: number) => void;
  /** Millie made a new friend (first sniff with each dog). */
  onFriend: (name: string) => void;
}

interface Pather { x: number; z: number; heading: number; path: [number, number][]; i: number; dir: number; speed: number; pause: number }

/** Walk a path back and forth; returns the speed actually moved. */
function walkPath(w: Pather, dt: number, speed: number) {
  const [tx, tz] = w.path[w.i];
  const dx = tx - w.x, dz = tz - w.z, d = Math.hypot(dx, dz);
  if (w.pause > 0) { w.pause -= dt; return 0; }
  if (d < 0.3) {
    w.i += w.dir;
    if (w.i >= w.path.length || w.i < 0) { w.dir = -w.dir; w.i = clamp(w.i + w.dir * 2, 0, w.path.length - 1); }
    return 0;
  }
  if (speed <= 0) return 0;
  const step = Math.min(d, speed * dt);
  w.x += (dx / d) * step; w.z += (dz / d) * step;
  w.heading = angLerp(w.heading, Math.atan2(dz, dx), Math.min(1, dt * 6));
  return speed;
}

/** Sidestep around Millie and her human. */
function giveWay(w: P, ctx: LifeCtx, dt: number, r = 1.0) {
  for (const p of [ctx.dog, ctx.human]) {
    const ox = w.x - p.x, oz = w.z - p.z, od = Math.hypot(ox, oz);
    if (od < r && od > 1e-3) { w.x += (ox / od) * dt * 1.8; w.z += (oz / od) * dt * 1.8; }
  }
}

const handOf = (x: number, z: number, h: number) => ({ x: x + 0.3 * Math.cos(h) + 0.25 * Math.sin(h), z: z + 0.3 * Math.sin(h) - 0.25 * Math.cos(h) });

export function createLife(ctx: LifeCtx) {
  const { scene, level, hud, audio, dog } = ctx;
  const floorAt = (x: number, z: number, y = 0.5) => level.floor(x, z, y);
  const bubbles: { id: string; x: number; y: number; z: number }[] = [];
  const person = (look: Parameters<typeof makePerson>[0]) => {
    const m = makePerson(look);
    scene.add(collapseRig(m.group));
    return m;
  };
  const anyone = (extra: Partial<Parameters<typeof makePerson>[0]> = {}) => person({
    top: pickOne(NPC_TOPS), hair: pickOne(NPC_HAIRS), skin: pickOne(NPC_SKINS),
    hairStyle: pickOne(['short', 'ponytail', 'bun', 'bald', 'long']), prop: 'none',
    height: rand(0.94, 1.05), trousers: pickOne([0x40455c, 0x2a2f3d, 0x6b5a48, 0x3d73c7]), ...extra,
  });
  const near = (x: number, z: number) => Math.hypot(x - dog.x, z - dog.z) < VIEW;
  let barkPending = false; // Millie barked since the last update
  let clock = 0;

  // ---- Dog walkers ------------------------------------------------------------------------
  const DOGS: { name: string; look: DogLook; path: [number, number][] }[] = [
    { name: 'Coco', look: { fur: 0xc98b4a, dark: 0x8a5a2a, muzzle: 0xe8c79a, paws: 0xf4efe2, collar: 0x1fc9b7, scale: 0.8, ears: 'prick' }, path: [[-86, 1.6], [-50, 1.2], [-6, 1.6]] },
    { name: 'Lola', look: { fur: 0xf4f1ea, dark: 0xd8cfc0, muzzle: 0xf4f1ea, paws: 0xf4f1ea, collar: 0xe5487a, scale: 0.62, ears: 'drop' }, path: [[6, 1.4], [40, 1.8], [86, 1.4]] },
    { name: 'Rocky', look: { fur: 0x5b4636, dark: 0x2a1f18, muzzle: 0x8a6e58, paws: 0x2a1f18, collar: 0xffb020, scale: 1.1, ears: 'drop' }, path: [[-86, 23.8], [-62, 23.6], [-36, 24.2]] },
    { name: 'Bimba', look: { fur: 0x9a9a9a, dark: 0x5a5a5a, muzzle: 0xd8d8d8, paws: 0xf0f0f0, collar: 0x3d73c7, scale: 0.72, ears: 'prick' }, path: [[0.6, 38], [0.4, 62], [0.6, 84]] },
  ];
  const walkers = DOGS.map((def, k) => {
    const p = anyone({ prop: Math.random() < 0.4 ? 'phone' : 'none' });
    const d = makeDog(def.look);
    scene.add(collapseRig(d.group));
    const line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3)), new THREE.LineBasicMaterial({ color: def.look.collar }));
    line.frustumCulled = false;
    scene.add(line);
    const i = Math.floor(Math.random() * def.path.length);
    const [x, z] = def.path[i];
    return {
      ...def, p, d, line, id: `dw${k}`, seed: rand(0, 10),
      w: { x, z, heading: 0, path: def.path, i, dir: 1, speed: 1.05, pause: 0 } as Pather,
      dx: x + 1, dz: z, dh: 0, dsp: 0, met: false, saidT: 0, barkT: -1, sniffT: 0,
    };
  });

  // ---- Joggers ----------------------------------------------------------------------------
  const joggers = [0, 1, 2].map((k) => {
    const p = anyone({ shorts: true, top: pickOne([0xe5487a, 0x1fc9b7, 0xffb020, 0xf4f1ea, 0x3d73c7]), shoes: 0xf4f1ea, hairStyle: pickOne(['ponytail', 'short', 'bun']) });
    const path: [number, number][] = k === 2 ? [[-86, -0.4], [-6, -0.6]] : [[6, -0.2 + k * 0.9], [86, -0.2 + k * 0.9]];
    const i = k % 2;
    return { p, id: `jg${k}`, saidT: 0, w: { x: path[i][0], z: path[i][1], heading: 0, path, i: 1 - i, dir: 1, speed: rand(2.6, 3.1), pause: 0 } as Pather };
  });

  // ---- The coconut seller -----------------------------------------------------------------
  const seller = (() => {
    const p = anyone({ top: 0xf4f1ea, trousers: 0xc7bda8, hair: 0x1a1a1a, hairStyle: 'short' });
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.32, 12), M(0x1fc9b7, 0.6));
    bucket.position.set(0.05, 0.55, -0.34);
    p.group.add(bucket);
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M(0x6b4a2a, 0.9));
      c.position.set(-0.06 + k * 0.06, 0.74, -0.34 + (k - 1) * 0.04);
      p.group.add(c);
    }
    const path: [number, number][] = [[-44, -45.5], [-34, -45.6], [-26, -44.2], [58, -44.2], [62, -42.4], [66, -44.2], [86, -44.2]];
    return { p, id: 'coco', callT: rand(2, 6), w: { x: 0, z: -44.2, heading: 0, path, i: 3, dir: 1, speed: 0.75, pause: 0 } as Pather };
  })();

  // ---- Palas on the beach -----------------------------------------------------------------
  const palas = (() => {
    const a = { x: -15, z: -48.5 }, b = { x: -8.5, z: -48.5 };
    const players = [a, b].map((pos, k) => {
      const p = anyone({ shorts: true, top: k ? 0x1fc9b7 : 0xffb020 });
      const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 14), M(k ? 0xe5487a : 0x3d73c7, 0.5));
      bat.rotation.x = Math.PI / 2;
      bat.position.set(0.12, -0.38, 0);
      (p.arms[1].getObjectByName('fore') as THREE.Group).add(bat);
      p.group.position.set(pos.x, floorAt(pos.x, pos.z), pos.z);
      p.group.rotation.y = k ? Math.PI : 0;
      return p;
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M(0xffe08a, 0.4));
    scene.add(ball);
    level.addRuntimeCircle({ x: a.x, z: a.z, r: 0.3, top: 2, kind: 'person', canPee: false, canWhirl: false, marked: false });
    level.addRuntimeCircle({ x: b.x, z: b.z, r: 0.3, top: 2, kind: 'person', canPee: false, canWhirl: false, marked: false });
    return { a, b, players, ball, t: 0, from: 0, hits: 0, paused: 0, saidT: 0 };
  })();

  // ---- Swimmers and a paddle boarder ------------------------------------------------------
  const WATER_Y = -1.6;
  const capCols = [0xe5487a, 0xffb020, 0xf4f1ea, 0x3d73c7, 0x1fc9b7];
  const swimmers = Array.from({ length: 6 }, (_, k) => {
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), M(pickOne(NPC_SKINS), 0.7));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(capCols[k % capCols.length], 0.5));
    cap.position.y = 0.02;
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.4, 3, 6), M(pickOne(NPC_SKINS), 0.7));
    arm.position.set(0, 0, 0.18);
    g.add(head, cap, arm);
    scene.add(g);
    return { g, arm, x: rand(-70, 70), z: rand(-64, -80), dir: Math.random() < 0.5 ? 1 : -1, speed: rand(0.3, 0.6), seed: rand(0, 6) };
  });
  const sup = (() => {
    const p = anyone({ shorts: true, top: 0x3d3d45 });
    p.animate(0, { speed: 0, pose: 'stand' });
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 0.7), M(0xf4f1ea, 0.4));
    board.position.y = -0.05;
    p.group.add(board);
    const paddle = new THREE.Group();
    paddle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 6), M(0x2a2f3d, 0.5)));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.2), M(0xffb020, 0.5));
    blade.position.y = -0.95;
    paddle.add(blade);
    paddle.position.set(0.2, 1.0, 0.35);
    p.group.add(paddle);
    return { p, paddle, x: -20, z: -98, dir: 1 }; // out beyond the buoy line
  })();

  // ---- Neighbors sitting out in the side streets -----------------------------------------
  const SEATS: { x: number; z: number; face: number }[] = [
    { x: -24, z: 50.6, face: 1 }, { x: 24, z: 55.4, face: -1 }, { x: -8, z: 73.4, face: -1 }, { x: 8, z: 86.6, face: 1 }, { x: -22, z: 91.4, face: -1 },
  ];
  const chairM = M(0x8a5a3a, 0.8);
  const seniors = SEATS.map((s, k) => {
    const p = anyone({ hair: pickOne([0x8a8a8a, 0xd8d8d8, 0xb0b0b0]), hairStyle: pickOne(['short', 'bun', 'bald']), top: pickOne([0x667a5c, 0x855c85, 0x4c6185, 0xc7bda8, 0x9e4c47]), height: 0.95 });
    const ry = s.face > 0 ? -Math.PI / 2 : Math.PI / 2; // facing +Z or −Z (heading → rotation.y = −heading)
    p.group.position.set(s.x, floorAt(s.x, s.z), s.z);
    p.group.rotation.y = ry;
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.46), chairM);
    seat.position.set(-0.1, 0.46, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.46), chairM);
    back.position.set(-0.32, 0.72, 0);
    chair.add(seat, back);
    for (const [lx, lz] of [[-0.3, -0.2], [-0.3, 0.2], [0.1, -0.2], [0.1, 0.2]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.46, 0.04), chairM);
      leg.position.set(lx, 0.23, lz);
      chair.add(leg);
    }
    p.group.add(chair);
    level.addRuntimeCircle({ x: s.x, z: s.z, r: 0.4, top: 1.6, kind: 'chair', canPee: false, canWhirl: false, marked: false });
    return { p, s, id: `sn${k}`, saidT: rand(0, 4), look: 0 };
  });

  // ---- Kids playing tag on the Rambla -----------------------------------------------------
  const tag = (() => {
    const c = { x: -44, z: 26.5 };
    const kids = [0, 1].map((k) => anyone({ height: 0.6, shorts: true, top: k ? 0xe5487a : 0x8bcb3c, hairStyle: k ? 'ponytail' : 'short' }));
    return { c, kids, a: 0, w: 1.4, flipT: 5, stop: 0, saidT: 0, pos: [{ x: c.x, z: c.z, h: 0 }, { x: c.x, z: c.z, h: 0 }] };
  })();

  const say = (id: string, text: string, ttl = 1.6, tone: 'paper' | 'win' | 'loud' = 'paper') => hud.say(id, text, ttl, tone);

  function update(dt: number, time: number, sky: 'day' | 'rain' | 'night' = 'day') {
    clock = time;
    bubbles.length = 0;
    // Who's out depends on the weather: the beach crowd goes home in rain and at night,
    // neighbors and joggers stay out on a warm night, dog walkers go out whatever happens.
    const beachOut = sky === 'day', streetOut = sky !== 'rain';

    // Dog walkers.
    for (const dw of walkers) {
      const vis = near(dw.w.x, dw.w.z);
      dw.p.group.visible = dw.d.group.visible = dw.line.visible = vis;
      if (dw.saidT > 0) dw.saidT -= dt;
      const md = Math.hypot(dog.x - dw.dx, dog.z - dw.dz);
      const curious = md < 5.5;
      if (curious) dw.sniffT += dt; else dw.sniffT = Math.max(0, dw.sniffT - dt);
      // The owner stops for a chat while the dogs say hello, then moves on.
      const chatting = curious && dw.sniffT < 7 && md < 4;
      const sp = walkPath(dw.w, dt, chatting ? 0 : dw.w.speed);
      giveWay(dw.w, ctx, dt);
      if (chatting && dw.saidT <= 0 && md < 3.5) {
        say(dw.id, pickOne([`${dw.name}, quieta!`, `Hola! Es diu ${dw.name}.`, `Tranquil, ${dw.name}…`, 'Ui, quina energia!']), 1.8);
        dw.saidT = 7;
      }
      // Their dog: sniffs toward Millie, otherwise noses about ahead of the owner.
      const hand = handOf(dw.w.x, dw.w.z, dw.w.heading);
      let tx: number, tz: number;
      if (curious && dw.sniffT < 8) {
        const ax = dw.dx - dog.x, az = dw.dz - dog.z, ad = Math.hypot(ax, az) || 1;
        tx = dog.x + (ax / ad) * 0.75; tz = dog.z + (az / ad) * 0.75;
      } else {
        const lat = Math.sin(time * 0.6 + dw.seed) * 1.0;
        tx = dw.w.x + Math.cos(dw.w.heading) * 1.4 - Math.sin(dw.w.heading) * lat;
        tz = dw.w.z + Math.sin(dw.w.heading) * 1.4 + Math.cos(dw.w.heading) * lat;
      }
      const ddx = tx - dw.dx, ddz = tz - dw.dz, dd = Math.hypot(ddx, ddz);
      const want = dd > 0.25 ? Math.min(3, dd * 1.6) : 0;
      dw.dsp += (want - dw.dsp) * Math.min(1, dt * 5);
      if (dd > 1e-3) { dw.dx += (ddx / dd) * dw.dsp * dt; dw.dz += (ddz / dd) * dw.dsp * dt; }
      // The leash holds her to 2.4 m from the hand.
      const lx = dw.dx - hand.x, lz = dw.dz - hand.z, ld = Math.hypot(lx, lz);
      if (ld > 2.4) { dw.dx = hand.x + (lx / ld) * 2.4; dw.dz = hand.z + (lz / ld) * 2.4; }
      const dp = { x: dw.dx, z: dw.dz };
      ctx.collide(dp, 0.22, floorAt(dw.dx, dw.dz));
      // Don't stand inside Millie.
      const mx = dp.x - dog.x, mz = dp.z - dog.z, mdd = Math.hypot(mx, mz);
      if (mdd < 0.55 && mdd > 1e-3) { dp.x = dog.x + (mx / mdd) * 0.55; dp.z = dog.z + (mz / mdd) * 0.55; }
      dw.dx = dp.x; dw.dz = dp.z;
      if (dw.dsp > 0.2) dw.dh = angLerp(dw.dh, Math.atan2(ddz, ddx), Math.min(1, dt * 8));
      else if (curious) dw.dh = angLerp(dw.dh, Math.atan2(dog.z - dw.dz, dog.x - dw.dx), Math.min(1, dt * 4));
      if (!dw.met && md < 1.3) {
        dw.met = true;
        ctx.onFriend(dw.name);
      }
      // Barks back when Millie barks nearby.
      if (barkPending && md < 10 && dw.barkT < 0) dw.barkT = 0.35;
      if (dw.barkT >= 0) {
        dw.barkT -= dt;
        if (dw.barkT < 0) {
          if (vis) audio.smallBark(dw.look.scale, { x: dw.dx, z: dw.dz });
          say(`${dw.id}d`, pickOne(['Guau!', 'Bup bup!', 'Arf!']), 1, 'loud');
        }
      }
      if (vis) {
        const fy = floorAt(dw.w.x, dw.w.z);
        dw.p.group.position.set(dw.w.x, fy, dw.w.z);
        dw.p.group.rotation.y = -dw.w.heading;
        dw.p.animate(time + dw.seed, { speed: sp, pose: 'walk' });
        const dfy = floorAt(dw.dx, dw.dz);
        dw.d.group.position.set(dw.dx, dfy, dw.dz);
        dw.d.group.rotation.y = -dw.dh;
        dw.d.animate(time * 1.1 + dw.seed, { speed: dw.dsp, dig: false, peeing: false, wag: curious ? 1 : 0.5, air: false });
        // Leash: hand to collar with a little sag.
        const arr = (dw.line.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
        const cx = dw.dx + Math.cos(dw.dh) * 0.28 * dw.look.scale, cz = dw.dz + Math.sin(dw.dh) * 0.28 * dw.look.scale;
        const hy = fy + 0.95, cy = dfy + 0.5 * dw.look.scale;
        const slack = clamp(1 - Math.hypot(cx - hand.x, cz - hand.z) / 2.4, 0, 1) * 0.45;
        for (let s = 0; s < 8; s++) {
          const t = s / 7;
          arr[s * 3] = hand.x + (cx - hand.x) * t;
          arr[s * 3 + 1] = hy + (cy - hy) * t - Math.sin(t * Math.PI) * slack;
          arr[s * 3 + 2] = hand.z + (cz - hand.z) * t;
        }
        dw.line.geometry.attributes.position.needsUpdate = true;
        bubbles.push({ id: dw.id, x: dw.w.x, y: fy + 2.1, z: dw.w.z }, { id: `${dw.id}d`, x: dw.dx, y: dfy + 1.0, z: dw.dz });
      }
    }

    barkPending = false;

    // Joggers.
    for (const j of joggers) {
      const vis = streetOut && near(j.w.x, j.w.z);
      j.p.group.visible = vis;
      if (j.saidT > 0) j.saidT -= dt;
      const sp = walkPath(j.w, dt, j.w.speed);
      giveWay(j.w, ctx, dt * 1.5, 1.2);
      if (vis && j.saidT <= 0 && Math.hypot(j.w.x - dog.x, j.w.z - dog.z) < 2) { say(j.id, pickOne(['Perdó!', 'Bon dia!', 'Compte, guapa!']), 1.2); j.saidT = 8; }
      if (!vis) continue;
      const fy = floorAt(j.w.x, j.w.z);
      j.p.group.position.set(j.w.x, fy, j.w.z);
      j.p.group.rotation.y = -j.w.heading;
      j.p.animate(time * 1.25 + j.w.speed, { speed: sp * 1.2, pose: 'walk' });
      bubbles.push({ id: j.id, x: j.w.x, y: fy + 2.1, z: j.w.z });
    }

    // The coconut seller.
    {
      const s = seller;
      const vis = beachOut && near(s.w.x, s.w.z);
      s.p.group.visible = vis;
      const sp = walkPath(s.w, dt, s.w.speed);
      giveWay(s.w, ctx, dt);
      if (sp === 0 && s.w.pause <= 0 && Math.random() < dt * 0.3) s.w.pause = rand(2, 4);
      s.callT -= dt;
      if (s.callT <= 0) {
        s.callT = rand(7, 11);
        if (vis && Math.hypot(s.w.x - dog.x, s.w.z - dog.z) < 30) say(s.id, pickOne(['Coco! Coco fresco!', 'Cocoooo!', 'Coco, aigua, cervesa!']), 2.2, 'loud');
      }
      if (vis) {
        const fy = floorAt(s.w.x, s.w.z);
        s.p.group.position.set(s.w.x, fy, s.w.z);
        s.p.group.rotation.y = -s.w.heading;
        s.p.animate(time, { speed: sp, pose: 'walk' });
        bubbles.push({ id: s.id, x: s.w.x, y: fy + 2.1, z: s.w.z });
      }
    }

    // Palas.
    {
      const pl = palas;
      const mid = { x: (pl.a.x + pl.b.x) / 2, z: pl.a.z };
      const vis = beachOut && near(mid.x, mid.z);
      pl.players.forEach((p) => { p.group.visible = vis; });
      pl.ball.visible = vis;
      if (pl.saidT > 0) pl.saidT -= dt;
      const millieClose = vis && Math.hypot(dog.x - mid.x, dog.z - mid.z) < 4;
      if (millieClose && pl.paused <= 0) {
        pl.paused = 3;
        if (pl.saidT <= 0) { say('pal0', pickOne(['Ei, gosseta!', 'Atenta, que va la pilota!']), 1.6); pl.saidT = 8; }
      }
      if (pl.paused > 0) pl.paused -= dt;
      const FLIGHT = 1.1;
      if (pl.paused <= 0) {
        pl.t += dt;
        if (pl.t >= FLIGHT) {
          pl.t -= FLIGHT; pl.from = 1 - pl.from; pl.hits++;
          if (vis && Math.hypot(dog.x - mid.x, dog.z - mid.z) < 24) audio.pock();
        }
      }
      const src = pl.from ? pl.b : pl.a, dst = pl.from ? pl.a : pl.b;
      const t = pl.paused > 0 ? 0 : pl.t / FLIGHT;
      const y0 = floorAt(src.x, src.z) + 1.1;
      if (vis) {
        pl.ball.position.set(src.x + (dst.x - src.x) * t, y0 + Math.sin(t * Math.PI) * 1.6, src.z + (dst.z - src.z) * t);
        pl.players.forEach((p, k) => {
          p.animate(time + k, { speed: 0, pose: 'stand' });
          // Swing as the ball arrives (or just left).
          const mine = (pl.from === k ? 1 - t : t);
          const swing = pl.paused > 0 ? 0 : Math.max(0, mine - 0.82) * 5.5;
          p.arms[1].rotation.set(0, 0, 0.9 + swing * 1.1);
        });
        bubbles.push({ id: 'pal0', x: pl.a.x, y: floorAt(pl.a.x, pl.a.z) + 2.1, z: pl.a.z });
      }
    }

    // Swimmers.
    for (const s of swimmers) {
      s.x += s.dir * s.speed * dt;
      if (s.x > 75) s.dir = -1;
      if (s.x < -75) s.dir = 1;
      const vis = beachOut && (near(s.x, s.z) || Math.abs(dog.z - s.z) < 60);
      s.g.visible = vis;
      if (!vis) continue;
      s.g.position.set(s.x, WATER_Y + 0.04 + Math.sin(time * 1.6 + s.seed) * 0.04, s.z);
      s.g.rotation.y = s.dir > 0 ? 0 : Math.PI;
      const stroke = time * 2.2 + s.seed;
      s.arm.position.set(Math.cos(stroke) * 0.2, Math.max(-0.1, Math.sin(stroke) * 0.22), 0.18 * Math.sign(Math.sin(stroke * 0.5) || 1));
      s.arm.rotation.z = stroke;
    }
    {
      sup.x += sup.dir * 0.6 * dt;
      if (sup.x > 60) sup.dir = -1;
      if (sup.x < -60) sup.dir = 1;
      sup.p.group.visible = beachOut && Math.abs(dog.z - sup.z) < 70;
      if (sup.p.group.visible) {
        sup.p.group.position.set(sup.x, WATER_Y + 0.1 + Math.sin(time * 1.1) * 0.05, sup.z);
        sup.p.group.rotation.y = sup.dir > 0 ? 0 : Math.PI;
        sup.p.group.rotation.x = Math.sin(time * 0.9) * 0.03;
        const stroke = time * 1.3;
        sup.paddle.rotation.z = Math.sin(stroke) * 0.6;
        sup.paddle.position.z = Math.sin(stroke * 0.5) > 0 ? 0.35 : -0.35;
      }
    }

    // Neighbors.
    for (const sn of seniors) {
      const vis = streetOut && near(sn.s.x, sn.s.z);
      sn.p.group.visible = vis;
      if (!vis) continue;
      if (sn.saidT > 0) sn.saidT -= dt;
      const d = Math.hypot(dog.x - sn.s.x, dog.z - sn.s.z);
      sn.p.animate(0, { speed: 0, pose: 'sit' });
      // Watch Millie go by.
      const want = d < 9 ? clamp(angLerp(0, Math.atan2(dog.z - sn.s.z, dog.x - sn.s.x) - (sn.s.face > 0 ? Math.PI / 2 : -Math.PI / 2), 1), -1.1, 1.1) : 0;
      sn.look = angLerp(sn.look, -want, Math.min(1, dt * 3));
      sn.p.head.rotation.y = sn.look;
      if (d < 4 && sn.saidT <= 0) {
        say(sn.id, pickOne(['Ai, que maca!', 'Quina gossa més bonica!', 'Bon dia, maca!', 'On vas tan de pressa?', 'En el meu temps…']), 1.8);
        sn.saidT = 14;
      }
      bubbles.push({ id: sn.id, x: sn.s.x, y: floorAt(sn.s.x, sn.s.z) + 1.7, z: sn.s.z });
    }

    // Tag.
    {
      const tg = tag;
      const vis = beachOut && near(tg.c.x, tg.c.z);
      tg.kids.forEach((k) => { k.group.visible = vis; });
      if (tg.saidT > 0) tg.saidT -= dt;
      const md = Math.hypot(dog.x - tg.c.x, dog.z - tg.c.z);
      if (vis && md < 4.5) {
        if (tg.stop <= 0 && tg.saidT <= 0) { say('kid0', pickOne(['Un gos! Un gos!', 'Mira, un gosset!']), 1.6, 'loud'); tg.saidT = 10; }
        tg.stop = 1.5;
      }
      if (tg.stop > 0) tg.stop -= dt;
      else {
        tg.a += tg.w * dt;
        tg.flipT -= dt;
        if (tg.flipT <= 0) {
          tg.flipT = rand(4, 8); tg.w = -tg.w;
          if (vis && md < 25) say(Math.random() < 0.5 ? 'kid0' : 'kid1', pickOne(["T'he pillat!", 'Para, para!', 'Tu pagues!']), 1.2);
        }
      }
      if (vis) {
        tg.kids.forEach((k, i) => {
          const a = tg.a - i * 1.1 * Math.sign(tg.w);
          const r = 2.2 + Math.sin(clock * 0.7 + i) * 0.3;
          let x = tg.c.x + Math.cos(a) * r, z = tg.c.z + Math.sin(a) * r;
          if (tg.stop > 0) { x = tg.pos[i].x; z = tg.pos[i].z; }
          const h = tg.stop > 0 ? Math.atan2(dog.z - z, dog.x - x) : a + Math.PI / 2 * Math.sign(tg.w);
          tg.pos[i] = { x, z, h };
          k.group.position.set(x, floorAt(x, z), z);
          k.group.rotation.y = -angLerp(-k.group.rotation.y, h, Math.min(1, dt * 10));
          k.animate(clock * 1.4 + i, { speed: tg.stop > 0 ? 0 : 3, pose: 'walk' });
          bubbles.push({ id: `kid${i}`, x, y: floorAt(x, z) + 1.4, z });
        });
      }
    }
  }

  return {
    update,
    bubbles: () => bubbles,
    bark: () => { barkPending = true; },
    /** Dogs on the map, for the minimap. */
    dogs: () => walkers.map((w) => ({ x: w.dx, z: w.dz, name: w.name, met: w.met })),
  };
}
