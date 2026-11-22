/*
  Path of Leash Resistance in 3D: a walk along the Badalona seafront.
  Millie pulls her human around town, through the rail underpass and out
  along the Rambla, the beach and the Pont del Petroli. The leash, the
  human's moods and the pole whirl follow the real game's rules (leash.ts).
*/
import * as THREE from 'three';
import { CoriolisSimulator, type SimKey, type SimCommand } from '../coriolis/sim';
import { WalkAudio, STEM_GROUPS, type StemGroup, type SongMeta } from './audio';
import { Hud, type GoalRow } from './hud';
import { Leash, applyTug, capStretch, WhirlDetector, type Obstacle } from './leash';
import { buildLevel, PIPICA, WATER_Y, RAMBLA_Y, GROUND_Y, TRAIN_Y, TRAIN_Z, type Level } from './level';
import {
  makeDog, makePerson, makeBike, makeSweeper, makeTrain, makeBird, makeBone, makeBall, makeFruitCrate,
  makeFishingRod, blobShadow, MILLIE, HUMAN_LOOK, NPC_TOPS, NPC_HAIRS, NPC_SKINS, M, sphere,
  type DogModel, type PersonModel, type Pose, type BikeStyle,
} from './models';
import { makeTofu, makeDevil } from './props';
import { isNightTheme, onThemeChange, SKY, type SkyMode } from './theme';

type CamMode = 'street' | 'follow' | 'overhead';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const angLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pickOne = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const MOVE: Record<string, [number, number]> = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};
const CORIOLIS_KEYS: Record<string, SimKey> = {
  ArrowUp: 'Up', KeyW: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', KeyA: 'Left', ArrowRight: 'Right', KeyD: 'Right',
  Enter: 'Select', Backspace: 'Back',
};

const DOG_R = 0.3;
const HUMAN_R = 0.3;
const WALK = 3.0, RUN = 5.6, HUMAN_WALK = 1.35;
const STEP_UP = 0.35;

export interface WalkOptions { home?: boolean }

export function startWalk3D(root: HTMLElement, options: WalkOptions = {}) {
  const host = root.querySelector<HTMLElement>('[data-stage]');
  if (!host) return;
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s);

  // ---- Renderer -----------------------------------------------------------------------
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch {
    root.classList.add('no-webgl');
    const msg = document.createElement('p');
    msg.className = 'webgl-fallback';
    msg.textContent = 'This 3D walk needs WebGL, which this browser has turned off or doesn’t support.';
    host.replaceChildren(msg);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.className = 'gl';
  host.prepend(renderer.domElement);
  root.classList.add('live');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.15, 900);

  // Sky dome with a vertical gradient, plus stars and a moon for the night.
  const skyUniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0); }',
    }),
  );
  scene.add(sky);
  const starGeo = new THREE.BufferGeometry();
  const starPos: number[] = [];
  for (let i = 0; i < 500; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.08;
    starPos.push(Math.cos(a) * Math.cos(e) * 500, Math.sin(e) * 500, Math.sin(a) * Math.cos(e) * 500);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf4efe0, fog: false }));
  moon.position.set(-120, 140, -420);
  scene.add(moon);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 34;
  sun.shadow.camera.bottom = -34;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---- Coriolis LED wall texture ------------------------------------------------------
  const cCanvas = document.createElement('canvas');
  cCanvas.width = cCanvas.height = 512;
  const cCtx = cCanvas.getContext('2d')!;
  const coriolis = new CoriolisSimulator('coriolis');
  const coriolisTex = new THREE.CanvasTexture(cCanvas);
  coriolisTex.colorSpace = THREE.SRGBColorSpace;
  coriolisTex.magFilter = THREE.NearestFilter;

  const level: Level = buildLevel(scene, { coriolisTex });
  const audio = new WalkAudio();
  const hud = new Hud(host);

  // ---- Lamp light pool (nearest lamps get real lights at night) --------------------
  const lampPool: THREE.PointLight[] = [];
  for (let i = 0; i < 10; i++) {
    const l = new THREE.PointLight(0xffc98a, 0, 20, 1.3);
    scene.add(l);
    lampPool.push(l);
  }

  // ---- Characters ---------------------------------------------------------------------
  const dogM: DogModel = makeDog(MILLIE);
  scene.add(dogM.group);
  const dogShadow = blobShadow(0.45);
  scene.add(dogShadow);
  const humanM: PersonModel = makePerson(HUMAN_LOOK);
  scene.add(humanM.group);
  const humanShadow = blobShadow(0.4);
  scene.add(humanShadow);

  const dog = {
    x: level.start.dog.x, y: RAMBLA_Y, z: level.start.dog.z, vx: 0, vz: 0, vy: 0, heading: -Math.PI / 2,
    onGround: true, planted: false, digging: false, peeing: 0, wet: 0, carrying: null as null | 'ball' | 'questBall', zoom: 1,
    speed: 0, airStart: 0, stillTime: 0,
  };
  const human = {
    x: level.start.human.x, y: RAMBLA_Y, z: level.start.human.z, vx: 0, vz: 0, heading: -Math.PI / 2,
    state: 'walk' as 'walk' | 'phone' | 'selfie' | 'sit' | 'bench' | 'whirl' | 'stumble' | 'haul',
    stateT: 0, eventT: rand(3.5, 6.5), reelT: rand(4, 8), pendingReel: 0, patience: 1, giveIn: 0, grace: 0,
    ughSaid: false, phones: 3, stuck: 0, heyT: 0, stumbleT: 0, haulT: 0, restBase: 5,
  };
  let whirl: null | { pole: Obstacle; theta: number; omega: number; swept: number; budget: number; dir: number; r: number; t: number; extra: number } = null;
  const whirlDet = new WhirlDetector();

  const leash = new Leash(dog, human);
  const ropeMat = M(0xd9403a, 0.6);
  const ropeSegs: THREE.Mesh[] = [];
  const ropeGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 6);
  for (let i = 0; i < leash.N - 1; i++) {
    const s = new THREE.Mesh(ropeGeo, ropeMat);
    s.castShadow = true;
    scene.add(s);
    ropeSegs.push(s);
  }
  let offLeash = false;

  // ---- Game state ---------------------------------------------------------------------
  let pee = 0.8;
  let bones = 0;
  let marked = 0;
  let streak = 0, streakT = 0;
  let findsGot = 0;
  let hurdlesGot = 0;
  let townDone = 0;
  let combo: null | { links: string[]; pts: number; t: number } = null;
  let coriolisFocus = false;
  let stemmaOpen = false;
  let camMode: CamMode = 'street';
  let skyMode: SkyMode = isNightTheme() ? 'night' : 'day';
  let skyOverride = false;
  let nearStop: Level['stops'][number] | null = null;
  let time = 0;
  let slowmo = 0;
  let shake = 0;
  let fireworksT = 0;
  const markedSpots = new Set<object>();

  const goals: GoalRow[] = [
    { id: 'mark', label: 'Mark 5 spots (Q)', done: false, count: 0, target: 5 },
    { id: 'birds', label: 'Scatter the gulls or pigeons (E)', done: false },
    { id: 'whirl', label: 'Fling your human with a pole whirl', done: false },
    { id: 'finds', label: 'Dig up 3 finds on the beach (Space)', done: false, count: 0, target: 3 },
    { id: 'hurdles', label: 'Clear the 3 hurdles in the pipicà (V)', done: false, count: 0, target: 3 },
    { id: 'town', label: 'Help out in the side streets', done: false, count: 0, target: 5 },
    { id: 'neteja', label: 'Outrun La Neteja down Carrer del Mar', done: false },
    { id: 'correfoc', label: 'Survive the correfoc on the Rambla', done: false },
    { id: 'coriolis', label: 'Play the Coriolis LED wall (X)', done: false },
    { id: 'stemma', label: 'Change the music at stemma (X)', done: false },
    { id: 'pier', label: 'Reach the end of the Pont del Petroli', done: false },
    { id: 'dimoni', label: 'Wake the Dimoni on the beach (E)', done: false },
  ];
  const goal = (id: string) => goals.find((g) => g.id === id)!;
  const completeGoal = (id: string) => {
    const g = goal(id);
    if (g.done) return;
    g.done = true;
    if (g.target) g.count = g.target;
    hud.toast('Goal complete', g.label.replace(/ \([^)]*\)$/, ''), '#8bcb3c');
    audio.goal();
    hud.setGoals(goals);
    if (goals.every((x) => x.done)) setTimeout(() => hud.shout('BEST WALK EVER', 'loud'), 900);
  };
  const bumpGoal = (id: string, n: number) => {
    const g = goal(id);
    if (g.done) return;
    g.count = n;
    if (g.target && n >= g.target) completeGoal(id);
    else hud.setGoals(goals);
  };
  hud.setGoals(goals);

  const addBones = (n: number, why?: string) => {
    bones += n;
    if (why) hud.shout(`${why} +${n}`, 'good');
  };
  const addCombo = (name: string, pts: number) => {
    if (!combo) combo = { links: [], pts: 0, t: 4 };
    combo.links.push(name);
    combo.pts += pts;
    combo.t = 4;
  };

  // ---- Particles ----------------------------------------------------------------------
  const partGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  const partMats = new Map<number, THREE.MeshBasicMaterial>();
  const particles: { m: THREE.Mesh; vx: number; vy: number; vz: number; t: number; g: number }[] = [];
  const burst = (x: number, y: number, z: number, color: number, n = 10, spd = 3, up = 3, life = 0.7, g = 9) => {
    let mat = partMats.get(color);
    if (!mat) { mat = new THREE.MeshBasicMaterial({ color }); partMats.set(color, mat); }
    for (let i = 0; i < n; i++) {
      if (particles.length > 400) break;
      const m = new THREE.Mesh(partGeo, mat);
      m.position.set(x, y, z);
      scene.add(m);
      const a = Math.random() * Math.PI * 2, s = spd * (0.4 + Math.random() * 0.8);
      particles.push({ m, vx: Math.cos(a) * s, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * s, t: life * (0.6 + Math.random() * 0.6), g });
    }
  };

  // Pee marks (shared geometry/material, recycled).
  const stainGeo = new THREE.CircleGeometry(0.3, 14);
  const stainMat = new THREE.MeshBasicMaterial({ color: 0xd6b23c, transparent: true, opacity: 0.4, depthWrite: false });
  const stains: THREE.Mesh[] = [];

  // ---- Collectibles ---------------------------------------------------------------------
  const boneSpots: [number, number][] = [[1.5, 48], [-20, 53], [22, 71], [-14, 89], [30, 88.8], [-40, 24], [40, 29], [60, 20], [-60, -5], [70, -3], [-48, -60], [-48, -100], [70, -27], [0, -40], [-1, 9]];
  const bonesList = boneSpots.map(([x, z]) => {
    const m = makeBone();
    scene.add(m);
    return { x, z, m, got: false };
  });
  const ball = { x: 72, z: -26, vx: 0, vz: 0, m: makeBall(), held: false };
  scene.add(ball.m);

  // ---- Town quests ------------------------------------------------------------------
  const Q = level.quests;
  const quest = { ball: false, tofu: false, crate: false, bakery: false, selfie: false };
  const finishQuest = (k: keyof typeof quest, msg: string, reward: number) => {
    if (quest[k]) return;
    quest[k] = true;
    townDone++;
    addBones(reward, msg);
    bumpGoal('town', townDone);
  };
  // Kid on a balcony who lost a ball; the ball lies in another side street.
  const kid = makePerson({ top: 0xffb020, hair: 0x2a1d14, hairStyle: 'short', height: 0.62, prop: 'none', shorts: true });
  kid.group.position.set(Q.kid.x, Q.kid.y, Q.kid.z);
  kid.group.rotation.y = Q.kid.ry;
  scene.add(kid.group);
  const questBall = { x: Q.ball.x, z: Q.ball.z, m: sphere(0.14, M(0xe5487a, 0.5)), held: false, done: false };
  questBall.m.castShadow = true;
  scene.add(questBall.m);
  // Tofu (from the real game) has got out again: herd her home, spot by spot.
  const tofuM = makeTofu();
  scene.add(tofuM.group);
  const tofu = { i: 0, x: Q.tofu.spots[0][0], z: Q.tofu.spots[0][1], darting: false, heading: 0, alert: 0, home: false };
  // Fruit crate outside the fruiteria.
  const crate = makeFruitCrate();
  crate.group.position.set(Q.crate.x, RAMBLA_Y, Q.crate.z);
  crate.group.rotation.y = Q.crate.ry;
  scene.add(crate.group);
  const rolling: { m: THREE.Mesh; x: number; z: number; y: number; vx: number; vz: number; vy: number }[] = [];
  const grocer = makePerson({ top: 0x667a5c, hair: 0x8a8a8a, hairStyle: 'short', prop: 'none' });
  grocer.group.position.set(Q.grocer.x, RAMBLA_Y, Q.grocer.z);
  grocer.group.rotation.y = Q.grocer.ry;
  scene.add(grocer.group);
  // Baker at the forn door.
  const baker = makePerson({ top: 0xf4f1ea, trousers: 0xf4f1ea, hair: 0x2a1d14, hairStyle: 'bun', prop: 'none' });
  baker.group.position.set(Q.baker.x, RAMBLA_Y, Q.baker.z);
  baker.group.rotation.y = Q.baker.ry;
  scene.add(baker.group);
  let begT = 0;

  // ---- NPCs ---------------------------------------------------------------------------
  interface Walker { m: PersonModel; path: [number, number][]; i: number; x: number; z: number; speed: number; pause: number; dir: number; saidT: number; id: string }
  const walkers: Walker[] = [];
  level.pedPaths.forEach((path, pi) => {
    const n = path.length > 4 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const m = makePerson({
        top: pickOne(NPC_TOPS), hair: pickOne(NPC_HAIRS), skin: pickOne(NPC_SKINS),
        hairStyle: pickOne(['short', 'ponytail', 'bun', 'bald', 'long']), prop: pickOne(['phone', 'coffee', 'bag', 'none']),
        height: rand(0.92, 1.06), trousers: pickOne([0x40455c, 0x2a2f3d, 0x6b5a48, 0x3d73c7]),
      });
      scene.add(m.group);
      const i = Math.floor(Math.random() * path.length);
      walkers.push({ m, path, i, x: path[i][0], z: path[i][1], speed: rand(1.0, 1.5), pause: 0, dir: Math.random() < 0.5 ? 1 : -1, saidT: 0, id: `w${pi}-${k}` });
    }
  });
  // Cyclists on the Rambla bike lane.
  interface Rider { g: THREE.Group; wheels: THREE.Object3D[]; rider: PersonModel; x: number; z: number; dir: number; speed: number; max: number; rang: number; light: THREE.MeshStandardMaterial }
  const riders: Rider[] = [];
  const styles: BikeStyle[] = ['bicing', 'city', 'road', 'scooter', 'courier', 'city'];
  styles.forEach((st, i) => {
    const rider = makePerson({ top: pickOne(NPC_TOPS), hair: pickOne(NPC_HAIRS), skin: pickOne(NPC_SKINS), hairStyle: 'short', prop: 'none' });
    const b = makeBike(st, rider);
    rider.animate(0, { speed: 2, pose: st === 'scooter' ? 'stand' : 'ride' });
    scene.add(b.group);
    const dir = i % 2 ? 1 : -1;
    riders.push({ g: b.group, wheels: b.wheels, rider, x: rand(-70, 70), z: dir > 0 ? 0.65 : 1.45, dir, speed: 0, max: st === 'road' ? 7.5 : st === 'scooter' ? 5 : 5.5, rang: 0, light: b.light });
  });
  // La Neteja, the street sweeper.
  const sweeper = makeSweeper();
  scene.add(sweeper.group);
  const sw = { x: Q.sweeper.x, z: Q.sweeper.z0, dir: 1, speed: 1.6, sprayT: 0 };
  // The train.
  const train = makeTrain(3);
  scene.add(train.group);
  const tr = { x: -400, dir: 1, speed: 0, wait: 6, horned: false, rumbled: false, z: TRAIN_Z, stop: false, stopped: false, dwell: 0 };
  train.group.position.set(-400, TRAIN_Y + 0.35, TRAIN_Z);
  // A correfoc crew waiting on the Rambla: drummers and devils with fire forks.
  const cf = { x: level.correfoc.x0 };
  const devils = Array.from({ length: 6 }, (_, i) => {
    const d = makeDevil();
    scene.add(d.person.group);
    return { ...d, id: `dv${i}`, x: level.correfoc.x0 + (i % 3) * 1.4, z: level.correfoc.z - 2 + Math.floor(i / 3) * 3 + (i % 2) * 0.8, ox: (i % 3) * 1.4, oz: -2 + Math.floor(i / 3) * 3 + (i % 2) * 0.8 };
  });
  const drummers = [0, 1].map((i) => {
    const p = makePerson({ top: 0x8a2f2c, trousers: 0x2a1a1a, hair: 0x1a1010, hairStyle: 'short', prop: 'none' });
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 14), M(0xc9a26b, 0.6));
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0.3, 1.0, 0);
    p.group.add(drum);
    p.group.position.set(level.correfoc.x0 + 4, GROUND_Y, level.correfoc.z - 1 + i * 2.4);
    p.group.rotation.y = Math.PI;
    scene.add(p.group);
    return p;
  });
  // People at the café terraces.
  for (const seat of level.terraceSeats) {
    const p = makePerson({ top: pickOne(NPC_TOPS), hair: pickOne(NPC_HAIRS), skin: pickOne(NPC_SKINS), hairStyle: pickOne(['short', 'ponytail', 'bun', 'long', 'bald']), prop: pickOne(['phone', 'coffee', 'none']) });
    p.animate(0, { speed: 0, pose: 'sit' });
    p.group.position.set(seat.x, GROUND_Y, seat.z);
    p.group.rotation.y = seat.ry;
    scene.add(p.group);
  }

  // Chases (the real game's threat grid): La Neteja is slow and scares only
  // you, so your human dawdles; the correfoc is fast and scares you both.
  type ChaseKind = 'neteja' | 'correfoc';
  let chase: null | { kind: ChaseKind; t: number; speed: number } = null;
  let chaseCooldown = 0;
  const startChase = (kind: ChaseKind) => {
    if (chase || chaseCooldown > 0 || offLeash) return;
    chase = { kind, t: 0, speed: kind === 'neteja' ? 1.6 : 2.5 };
    if (kind === 'neteja') {
      hud.shout('LA NETEJA!', 'bad');
      hud.say('sweeper', 'Fora, gos!', 1.6, 'loud');
      hud.toast('Chase', 'Drag your human to the Rambla or into a side street', '#ff6b5a');
    } else {
      hud.shout('CORREFOC!', 'loud');
      humanSay('Fire! Run!', 1.6, 'loud');
      hud.toast('Chase', 'Run for the underpass, both of you', '#ffb020');
    }
    audio.hey();
  };
  const endChase = (won: boolean) => {
    if (!chase) return;
    const kind = chase.kind;
    chase = null;
    chaseCooldown = 10;
    if (won) {
      hud.shout(kind === 'neteja' ? 'ESCAPED!' : 'SAFE!', 'good');
      addBones(kind === 'neteja' ? 5 : 6);
      completeGoal(kind);
    } else if (kind === 'neteja') {
      hud.shout('SOAKED!', 'bad');
      burst(dog.x, dog.y + 0.6, dog.z, 0xbfe6ff, 30, 3, 3, 0.8, 7);
      dog.wet = 1;
      humanSay('Ugh, my shoes!', 1.8);
    } else {
      hud.shout('SINGED!', 'bad');
      burst(dog.x, dog.y + 0.6, dog.z, 0x3a3a40, 24, 2, 2.5, 0.9, 4);
      humanSay('My hair!', 1.8, 'loud');
    }
  };

  // Birds.
  interface Bird { wingFlap?: (t: number) => void; b: ReturnType<typeof makeBird>; hx: number; hz: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; fly: number; kind: 'gull' | 'pigeon'; baseY: number }
  const birds: Bird[] = [];
  const addBirds = (spots: [number, number][], kind: 'gull' | 'pigeon') => {
    for (const [x, z] of spots) {
      const b = makeBird(kind);
      const y = level.floor(x, z, 3);
      b.group.position.set(x, y, z);
      scene.add(b.group);
      birds.push({ b, hx: x, hz: z, x, y, z, vx: 0, vy: 0, vz: 0, fly: 0, kind, baseY: y });
    }
  };
  addBirds(level.birdSpots.pigeons, 'pigeon');
  addBirds(level.birdSpots.gulls, 'gull');
  // Sunbathers and anglers.
  for (const s of level.sunbathers) {
    const p = makePerson({ top: pickOne([0xe5487a, 0x1fc9b7, 0xffb020, 0x3d73c7]), skin: pickOne(NPC_SKINS), hair: pickOne(NPC_HAIRS), hairStyle: pickOne(['short', 'long', 'bun']), prop: 'none', shorts: true });
    p.animate(0, { speed: 0, pose: 'lie' });
    p.group.position.set(s.x, level.floor(s.x, s.z, 0) + 0.02, s.z);
    p.group.rotation.y = Math.PI / 2 + s.ry;
    scene.add(p.group);
  }
  for (const f of level.fishers) {
    const p = makePerson({ top: pickOne([0x667a5c, 0x4c6185, 0x6b5a48]), hair: 0x8a8a8a, hairStyle: pickOne(['short', 'bald']), prop: 'none' });
    p.animate(0, { speed: 0, pose: 'fish' });
    p.group.position.set(f.x, level.floor(f.x, f.z, 3), f.z);
    p.group.rotation.y = f.ry;
    const rodM = makeFishingRod();
    rodM.position.set(0.3, 1.0, 0);
    p.group.add(rodM);
    scene.add(p.group);
  }
  // Free dogs in the pipicà.
  const freeDogs = [
    { look: { fur: 0xc98b4a, dark: 0x8a5a2a, muzzle: 0xe8c79a, paws: 0xf4efe2, collar: 0x1fc9b7, scale: 0.85, ears: 'prick' as const } },
    { look: { fur: 0xf4f1ea, dark: 0xd8cfc0, muzzle: 0xf4f1ea, paws: 0xf4f1ea, collar: 0xe5487a, scale: 0.7, ears: 'drop' as const } },
  ].map((d, i) => {
    const m = makeDog(d.look);
    scene.add(m.group);
    return { m, x: 66 + i * 6, z: -27, tx: 70, tz: -28, heading: 0, speed: 0, t: rand(0, 3) };
  });

  // ---- Rain ---------------------------------------------------------------------------
  const RAIN = 900;
  const rainGeo = new THREE.BufferGeometry();
  const rainArr = new Float32Array(RAIN * 6);
  for (let i = 0; i < RAIN; i++) {
    const x = rand(-25, 25), y = rand(0, 18), z = rand(-25, 25);
    rainArr.set([x, y, z, x + 0.05, y - 0.7, z], i * 6);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainArr, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xb8c6d6, transparent: true, opacity: 0.55 }));
  rain.visible = false;
  scene.add(rain);

  // Fireworks for the Dimoni.
  const fireworks: { x: number; y: number; z: number; t: number; color: number }[] = [];

  // ---- Sky & theme --------------------------------------------------------------------
  const applySky = (mode: SkyMode) => {
    skyMode = mode;
    const s = SKY[mode];
    skyUniforms.top.value.setHex(s.skyTop);
    skyUniforms.horizon.value.setHex(s.skyHorizon);
    scene.fog = new THREE.Fog(s.fog, s.fogNear, s.fogFar);
    sun.color.setHex(s.sunColor);
    sun.intensity = s.sunIntensity;
    hemi.color.setHex(s.hemiSky);
    hemi.groundColor.setHex(s.hemiGround);
    hemi.intensity = s.hemiIntensity;
    renderer.toneMappingExposure = s.exposure;
    level.waterMat.color.setHex(s.sea);
    level.lampGlass.forEach((m) => { m.emissiveIntensity = s.lampsOn ? 2.6 : 0.05; });
    level.litWindowMat.emissiveIntensity = mode === 'night' ? 1.3 : mode === 'rain' ? 0.5 : 0;
    level.underpassLight.intensity = mode === 'day' ? 6 : 10;
    stars.visible = mode === 'night';
    moon.visible = mode === 'night';
    rain.visible = mode === 'rain';
    if (humanM.phoneScreen) humanM.phoneScreen.emissiveIntensity = mode === 'night' ? 1.6 : 0.6;
    riders.forEach((r) => { r.light.emissiveIntensity = s.lampsOn ? 2 : 0.2; });
    // Wet paving shines in the rain.
    level.wetMats.forEach((m) => { m.roughness = mode === 'rain' ? 0.35 : 0.92; });
    root.querySelectorAll<HTMLButtonElement>('[data-sky]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sky === mode)));
  };
  applySky(skyMode);
  onThemeChange((night) => {
    skyOverride = false;
    applySky(night ? 'night' : skyMode === 'rain' && !night ? 'rain' : 'day');
  });

  // ---- Helpers ------------------------------------------------------------------------
  const activeBox = (b: Level['boxes'][number], y: number) => b.minY === undefined || y >= b.minY;
  const activeCircle = (c: Level['circles'][number], y: number) => (c.minY === undefined || y >= c.minY) && (c.maxY === undefined || y < c.maxY);

  /** Push a body out of colliders. feetY lets jumps clear low things. */
  const collide = (p: { x: number; z: number }, r: number, feetY: number) => {
    for (const c of level.circles) {
      if (!activeCircle(c, feetY) || feetY > c.top - 0.02) continue;
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + r;
      if (d < min) {
        if (d > 1e-4) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
        else p.x += min;
      }
    }
    for (const b of level.boxes) {
      if (!activeBox(b, feetY) || feetY > b.top - 0.02) continue;
      const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 1e-4) { p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; }
        else {
          // Inside: leave by the nearest edge.
          const opts = [[p.x - b.x0, -1, 0], [b.x1 - p.x, 1, 0], [p.z - b.z0, 0, -1], [b.z1 - p.z, 0, 1]];
          opts.sort((a, c) => a[0] - c[0]);
          const [, ox, oz] = opts[0];
          if (ox) p.x = ox < 0 ? b.x0 - r : b.x1 + r;
          else p.z = oz < 0 ? b.z0 - r : b.z1 + r;
        }
      }
    }
  };
  const blockLedge = (p: { x: number; z: number }, x0: number, z0: number, feetY: number) => {
    if (level.floor(p.x, p.z, feetY) <= feetY + STEP_UP) return;
    if (level.floor(p.x, z0, feetY) <= feetY + STEP_UP) { p.z = z0; return; }
    if (level.floor(x0, p.z, feetY) <= feetY + STEP_UP) { p.x = x0; return; }
    p.x = x0; p.z = z0;
  };
  const nearbyPoles = (x: number, z: number, rad: number, y: number) =>
    level.circles.filter((c) => c.obstacle && activeCircle(c, y) && Math.abs(c.x - x) < rad && Math.abs(c.z - z) < rad).map((c) => c.obstacle!);

  const handPos = new THREE.Vector3();
  const collarPos = new THREE.Vector3();
  // The leash hand, computed from the body (the model's matrices lag a frame,
  // which matters after a teleport, a fling or a re-clip).
  const handXZ = () => {
    const c = Math.cos(human.heading), s = Math.sin(human.heading);
    return { x: human.x + 0.3 * c + 0.25 * s, z: human.z + 0.3 * s - 0.25 * c };
  };

  // ---- Input --------------------------------------------------------------------------
  const held = new Set<string>();
  const touchVec = { x: 0, z: 0 };
  let camYaw = 0; // 0 = looking toward the sea (−Z)

  const inputDir = () => {
    let ix = touchVec.x, iz = touchVec.z;
    for (const k of held) { const m = MOVE[k]; if (m) { ix += m[0]; iz += m[1]; } }
    const l = Math.hypot(ix, iz);
    if (l < 0.05) return { x: 0, z: 0, mag: 0 };
    if (l > 1) { ix /= l; iz /= l; }
    // Screen-relative: forward is where the camera looks.
    const fx = Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = -fz, rz = fx;
    return { x: rx * ix + fx * -iz, z: rz * ix + fz * -iz, mag: Math.min(1, l) };
  };

  // ---- Actions ------------------------------------------------------------------------
  const doJump = () => {
    if (!dog.onGround || coriolisFocus) return;
    dog.vy = 6.5;
    dog.onGround = false;
    audio.jump();
  };

  const doMark = () => {
    if (dog.peeing > 0 || !dog.onGround) return;
    if (pee < 0.2) { hud.banner('Out of pee — drink at a fountain', 'news'); return; }
    pee = Math.max(0, pee - 0.25);
    dog.peeing = 0.8;
    audio.pee();
    let best: Level['circles'][number] | null = null, bd = 1.3;
    for (const c of level.circles) {
      if (!c.canPee || !activeCircle(c, dog.y)) continue;
      const d = Math.hypot(c.x - dog.x, c.z - dog.z) - c.r;
      if (d < bd) { bd = d; best = c; }
    }
    const sx = best ? lerp(best.x, dog.x, 0.55) : dog.x - Math.cos(dog.heading) * 0.35;
    const sz = best ? lerp(best.z, dog.z, 0.55) : dog.z - Math.sin(dog.heading) * 0.35;
    const st = stains.length > 40 ? stains.shift()! : new THREE.Mesh(stainGeo, stainMat);
    st.rotation.x = -Math.PI / 2;
    st.position.set(sx, level.floor(sx, sz, dog.y) + 0.02, sz);
    scene.add(st);
    stains.push(st);
    if (best && !markedSpots.has(best)) {
      markedSpots.add(best);
      marked++;
      streak = streakT > 0 ? streak + 1 : 1;
      streakT = 8;
      hud.shout(streak > 1 ? `MARKED x${streak}` : 'MARKED', 'good');
      bones += streak;
      bumpGoal('mark', marked);
    }
  };

  const doBark = () => {
    audio.bark();
    burst(dog.x + Math.cos(dog.heading) * 0.5, dog.y + 0.75, dog.z + Math.sin(dog.heading) * 0.5, 0xffb020, 5, 1.5, 1.2, 0.4, 2);
    let scared = 0;
    for (const b of birds) {
      if (b.fly <= 0 && Math.hypot(b.x - dog.x, b.z - dog.z) < 7) {
        const dx = b.x - dog.x, dz = b.z - dog.z, d = Math.hypot(dx, dz) || 1;
        b.vx = (dx / d) * rand(4, 7); b.vz = (dz / d) * rand(4, 7); b.vy = rand(3, 5);
        b.fly = 6;
        scared++;
      }
    }
    if (scared) {
      audio.flutter();
      if (birds.some((b) => b.kind === 'gull' && b.fly > 5.9)) audio.gull();
      completeGoal('birds');
    }
    if (Math.hypot(dog.x - level.dimoni.x, dog.z - level.dimoni.z) < 7 && fireworksT <= 0) {
      fireworksT = 7;
      hud.shout('CREMADA!', 'loud');
      completeGoal('dimoni');
    }
    if (!chase && Math.hypot(dog.x - sw.x, dog.z - sw.z) < 7) startChase('neteja');
    if (!chase && Math.hypot(dog.x - cf.x, dog.z - level.correfoc.z) < 9) startChase('correfoc');
    for (const w of walkers) {
      if (Math.hypot(w.x - dog.x, w.z - dog.z) < 3.5 && w.saidT <= 0) {
        hud.say(w.id, pickOne(['Ai!', 'Quin ensurt!', 'Hola, bonica!', 'Shh!']), 1.4);
        w.saidT = 4;
      }
    }
  };

  const doPickup = () => {
    if (dog.carrying) {
      // Drop.
      const fx = dog.x + Math.cos(dog.heading) * 0.55, fz = dog.z + Math.sin(dog.heading) * 0.55;
      if (dog.carrying === 'questBall') {
        questBall.held = false;
        questBall.x = fx; questBall.z = fz;
        if (Math.hypot(fx - Q.kid.x, fz - Q.kid.z) < 3.2) {
          questBall.done = true;
          hud.say('kid', 'Gràcies, gossa!', 2.2, 'win');
          finishQuest('ball', 'BALL RETURNED', 5);
          questBall.m.visible = false;
        }
      } else {
        ball.held = false;
        ball.x = fx; ball.z = fz;
        // Bring it to your human on the bench and they'll throw it.
        if (offLeash && Math.hypot(fx - human.x, fz - human.z) < 2.2) {
          const tx = rand(PIPICA.x0 + 3, PIPICA.x1 - 2), tz = rand(PIPICA.z0 + 2, PIPICA.z1 - 2);
          ball.vx = (tx - fx) * 0.9; ball.vz = (tz - fz) * 0.9;
          hud.say('human', 'Fetch!', 1.2);
          addBones(1);
        }
      }
      dog.carrying = null;
      audio.click();
      return;
    }
    if (!ball.held && Math.hypot(ball.x - dog.x, ball.z - dog.z) < 0.9) { ball.held = true; dog.carrying = 'ball'; audio.pickup(); return; }
    if (!questBall.held && !questBall.done && Math.hypot(questBall.x - dog.x, questBall.z - dog.z) < 0.9) {
      questBall.held = true; dog.carrying = 'questBall'; audio.pickup();
      hud.banner('Take the ball back to the kid on the balcony', 'news');
    }
  };

  const toggleCoriolis = () => {
    coriolisFocus = !coriolisFocus;
    coriolis.clearHeld();
    q('[data-coriolis-panel]')?.classList.toggle('open', coriolisFocus);
    if (coriolisFocus) {
      setStemma(false);
      completeGoal('coriolis');
    }
  };

  // ---- stemma panel -------------------------------------------------------------------
  const stemmaPanel = q<HTMLElement>('[data-stemma-panel]');
  const songList = q<HTMLElement>('[data-song-list]');
  const lanesCanvas = q<HTMLCanvasElement>('[data-stem-lanes]');
  const creditEl = q<HTMLElement>('[data-song-credit]');
  const renderSongs = () => {
    if (!songList) return;
    songList.innerHTML = audio.songs
      .map((s) => `<li><button type="button" data-song="${s.id}" aria-pressed="${s.id === audio.songId}"><b>${s.title}</b><span>${s.credit_as ?? s.artist}</span></button></li>`)
      .join('');
    songList.querySelectorAll<HTMLButtonElement>('[data-song]').forEach((b) => {
      b.addEventListener('click', () => {
        if (!audio.on) setSound(true);
        void audio.playSong(b.dataset.song!);
        completeGoal('stemma');
      });
    });
  };
  const renderCredit = (s: SongMeta | undefined) => {
    if (!creditEl || !s) return;
    const who = s.credit_as ?? s.artist;
    creditEl.innerHTML = `“${s.title}” by ${who}. <a href="${s.source}" rel="noopener" target="_blank">Source</a> · <a href="${s.licence_url}" rel="noopener" target="_blank">${s.licence}</a>. Stems separated by stemma.`;
  };
  audio.onSongChange = (s) => { renderSongs(); renderCredit(s); };
  const drawLanes = () => {
    if (!lanesCanvas || !stemmaOpen) return;
    const s = audio.song();
    if (!s) return;
    const g = lanesCanvas.getContext('2d')!;
    const w = lanesCanvas.width, h = lanesCanvas.height, lh = h / 4;
    g.clearRect(0, 0, w, h);
    const cols: Record<StemGroup, string> = { vocals: '#e5487a', drums: '#ffb020', bass: '#1fc9b7', other: '#8bcb3c' };
    const ph = audio.playhead();
    STEM_GROUPS.forEach((grp, li) => {
      const peaks = s.peaks[grp] ?? [];
      const muted = audio.muted[grp];
      g.fillStyle = muted ? 'rgba(255,255,255,0.12)' : cols[grp];
      const n = peaks.length;
      for (let i = 0; i < n; i++) {
        const v = peaks[i] * (lh * 0.42);
        const x = (i / n) * w;
        g.globalAlpha = i / n < ph ? 1 : 0.45;
        g.fillRect(x, li * lh + lh / 2 - v, Math.max(1, w / n - 1), v * 2);
      }
      g.globalAlpha = 1;
    });
    g.fillStyle = '#f4f1ea';
    g.fillRect(ph * w - 1, 0, 2, h);
  };
  root.querySelectorAll<HTMLButtonElement>('[data-stem]').forEach((b) => {
    b.addEventListener('click', () => {
      if (!audio.on) setSound(true);
      const muted = audio.toggleStem(b.dataset.stem as StemGroup);
      b.setAttribute('aria-pressed', String(!muted));
      completeGoal('stemma');
    });
  });
  const setStemma = (open: boolean) => {
    stemmaOpen = open;
    stemmaPanel?.classList.toggle('open', open);
    if (open) {
      if (!audio.on) setSound(true);
      void audio.loadIndex().then(() => { renderSongs(); renderCredit(audio.song()); });
    }
  };
  q('[data-stemma-close]')?.addEventListener('click', () => setStemma(false));

  // ---- Toolbar ------------------------------------------------------------------------
  const soundBtn = q<HTMLButtonElement>('[data-sound]');
  const setSound = (on: boolean) => {
    if (on) audio.enable(); else audio.disable();
    if (soundBtn) {
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.textContent = on ? 'Sound on' : 'Sound off';
    }
  };
  soundBtn?.addEventListener('click', () => setSound(!audio.on));
  const camBtn = q<HTMLButtonElement>('[data-camera]');
  const cycleCam = () => {
    camMode = camMode === 'street' ? 'follow' : camMode === 'follow' ? 'overhead' : 'street';
    if (camBtn) camBtn.textContent = `Camera: ${camMode === 'street' ? 'Street' : camMode === 'follow' ? 'Follow' : 'Overhead'}`;
  };
  camBtn?.addEventListener('click', cycleCam);
  root.querySelectorAll<HTMLButtonElement>('[data-sky]').forEach((b) => b.addEventListener('click', () => { skyOverride = true; applySky(b.dataset.sky as SkyMode); }));

  // Fullscreen: fill the window with a reveal, and ask the browser for real fullscreen too.
  const fullBtn = q<HTMLButtonElement>('[data-fullscreen]');
  let full = false;
  const setFull = (on: boolean) => {
    if (on === full) return;
    const from = root.getBoundingClientRect();
    full = on;
    if (on) {
      root.classList.add('immersive');
      document.documentElement.style.overflow = 'hidden';
      const vw = window.innerWidth, vh = window.innerHeight;
      const inset = `inset(${from.top}px ${vw - from.right}px ${vh - from.bottom}px ${from.left}px round 28px)`;
      root.animate([{ clipPath: inset }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
      camKick = 1;
      document.documentElement.requestFullscreen?.().catch(() => {});
      host.focus({ preventScroll: true });
    } else {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      root.classList.remove('immersive');
      document.documentElement.style.overflow = '';
    }
    if (fullBtn) {
      fullBtn.textContent = on ? 'Exit fullscreen' : 'Fullscreen';
      fullBtn.setAttribute('aria-pressed', String(on));
    }
  };
  let camKick = 0;
  fullBtn?.addEventListener('click', () => setFull(!full));
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && full) setFull(false); });

  q('[data-c-exit]')?.addEventListener('click', () => { if (coriolisFocus) toggleCoriolis(); });
  root.querySelectorAll<HTMLButtonElement>('[data-c-key]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.cKey as SimKey;
    coriolis.setHeld(k, true);
    coriolis.key(k, time * 1000);
    setTimeout(() => coriolis.setHeld(k, false), 120);
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-c-cmd]').forEach((b) => b.addEventListener('click', () => coriolis.command(b.dataset.cCmd as SimCommand, time * 1000)));

  // ---- Keyboard (only while the stage has focus) --------------------------------------
  const resetWalk = () => {
    dog.x = level.start.dog.x; dog.z = level.start.dog.z; dog.y = RAMBLA_Y; dog.vx = dog.vz = dog.vy = 0; dog.onGround = true;
    human.x = level.start.human.x; human.z = level.start.human.z; human.y = RAMBLA_Y; human.vx = human.vz = 0;
    human.state = 'walk'; whirl = null; offLeash = false; dog.carrying = null; ball.held = false; questBall.held = false;
    leash.reset(dog, handXZ());
    hud.banner('Back where we started', 'news');
  };
  const onKey = (code: string, e?: KeyboardEvent) => {
    const repeat = e?.repeat ?? false;
    if (coriolisFocus) {
      if (code === 'Escape' || code === 'KeyX') { e?.preventDefault(); if (!repeat) toggleCoriolis(); return; }
      const cmd: SimCommand | null = code === 'KeyM' ? 'Menu' : code === 'KeyS' ? 'Settings' : code === 'KeyC' ? 'Overlay' : code === 'Space' ? 'Next' : code === 'KeyH' ? 'Home' : null;
      if (cmd) { e?.preventDefault(); if (!repeat) coriolis.command(cmd, time * 1000); return; }
      if (code === 'KeyR') { e?.preventDefault(); if (!repeat) coriolis.rotate(time * 1000); return; }
      const ck = CORIOLIS_KEYS[code];
      if (ck) { e?.preventDefault(); coriolis.setHeld(ck, true); coriolis.key(ck, time * 1000); }
      return;
    }
    if (MOVE[code] || ['Space', 'Tab', 'Enter', 'ShiftLeft', 'ShiftRight'].includes(code)) e?.preventDefault();
    held.add(code);
    if (repeat) return;
    switch (code) {
      case 'KeyV': doJump(); break;
      case 'KeyQ': case 'Delete': doMark(); break;
      case 'KeyE': doBark(); break;
      case 'KeyG': case 'PageDown': doPickup(); break;
      case 'KeyC': cycleCam(); break;
      case 'Tab': hud.toggleGoals(); break;
      case 'Digit1': skyOverride = true; applySky('day'); break;
      case 'Digit2': skyOverride = true; applySky('rain'); break;
      case 'Digit3': skyOverride = true; applySky('night'); break;
      case 'KeyR': resetWalk(); break;
      case 'KeyX':
        if (nearCoriolis()) toggleCoriolis();
        else if (nearStemma() || stemmaOpen) setStemma(!stemmaOpen);
        break;
      case 'Escape':
        if (stemmaOpen) setStemma(false);
        else if (full) setFull(false);
        else host.blur();
        break;
      case 'Enter':
        if (nearStop) location.href = nearStop.href;
        break;
    }
  };
  const onKeyUp = (code: string) => {
    held.delete(code);
    const ck = CORIOLIS_KEYS[code];
    if (ck) coriolis.setHeld(ck, false);
  };
  const releaseAll = () => { held.clear(); coriolis.clearHeld(); touchVec.x = touchVec.z = 0; };
  host.addEventListener('keydown', (e) => {
    if (e.target !== host) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Tab' && e.shiftKey) return;
    onKey(e.code, e);
  });
  host.addEventListener('keyup', (e) => onKeyUp(e.code));
  host.addEventListener('blur', releaseAll);
  window.addEventListener('blur', releaseAll);
  host.addEventListener('pointerdown', (e) => { if (e.target === renderer.domElement) host.focus({ preventScroll: true }); });

  // ---- Touch: virtual stick + action buttons -------------------------------------------
  const stick = q<HTMLElement>('[data-stick]');
  const knob = q<HTMLElement>('[data-knob]');
  if (stick && knob) {
    let id: number | null = null;
    const move = (e: PointerEvent) => {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      touchVec.x = dx; touchVec.z = dy;
      knob.style.transform = `translate(${dx * 28}px, ${dy * 28}px)`;
      if (l > 0.92) held.add('ShiftLeft'); else held.delete('ShiftLeft');
    };
    stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(e.pointerId); move(e); e.preventDefault(); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = () => { id = null; touchVec.x = touchVec.z = 0; knob.style.transform = ''; held.delete('ShiftLeft'); };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
  }
  root.querySelectorAll<HTMLButtonElement>('[data-touch]').forEach((b) => {
    const code = b.dataset.touch!;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); onKey(code); });
    const up = () => onKeyUp(code);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
  });

  // ---- Proximity helpers --------------------------------------------------------------
  const nearCoriolis = () => Math.hypot(dog.x - level.coriolis.x, dog.z - (level.coriolis.z + 2.5)) < 4.2;
  const nearStemma = () => Math.hypot(dog.x - level.stemma.x, dog.z - level.stemma.z) < 3.6;

  // ---- Human AI -----------------------------------------------------------------------
  const humanSay = (t: string, ttl = 2, tone: 'paper' | 'win' | 'loud' = 'paper') => hud.say('human', t, ttl, tone);
  const humanLevelBlocked = () => {
    // Human on the sand while the dog is up on the Rambla (or the reverse): head for a ramp.
    const onPier = (p: { x: number; z: number }) => p.x > -50.5 && p.x < -45.5 && p.z < -10;
    const hb = human.z < -20.3 && !onPier(human), db = dog.z < -20.3 && !onPier(dog);
    return hb !== db;
  };

  const updateHuman = (dt: number, tension: number) => {
    human.stateT += dt;
    if (human.grace > 0) human.grace -= dt;
    let wantX = 0, wantZ = 0, speed = HUMAN_WALK;

    if (whirl) return; // driven by the orbit
    if (offLeash) {
      // Wait on the bench by the pipicà gate.
      const bx = level.humanBench.x, bz = level.humanBench.z;
      const d = Math.hypot(bx - human.x, bz - human.z);
      if (d > 0.4) { wantX = (bx - human.x) / d; wantZ = (bz - human.z) / d; human.state = 'walk'; }
      else { human.state = 'bench'; human.vx *= 0.8; human.vz *= 0.8; human.heading = 0; }
    } else if (human.state === 'stumble') {
      human.stumbleT -= dt;
      human.vx *= 1 - dt * 1.4; human.vz *= 1 - dt * 1.4;
      if (human.stumbleT <= 0) human.state = 'walk';
      return;
    } else if (human.state === 'haul') {
      human.haulT -= dt;
      const dx = human.x - dog.x, dz = human.z - dog.z, d = Math.hypot(dx, dz) || 1;
      human.vx = (dx / d) * 3.5; human.vz = (dz / d) * 3.5;
      if (human.haulT <= 0) human.state = 'walk';
      return;
    } else {
      // Events, always telegraphed first (human.gd).
      human.eventT -= dt;
      if (human.eventT <= 0 && human.state === 'walk') {
        human.eventT = rand(3.5, 6.5);
        const roll = Math.random();
        if (roll < 0.3) { humanSay('Ring ring…'); human.state = 'phone'; human.stateT = -0.8; }
        else if (roll < 0.45) { humanSay('Selfie time!'); human.state = 'selfie'; human.stateT = -0.8; }
        else if (roll < 0.6) {
          const bench = level.boxes.find((b) => b.kind === 'bench' && Math.hypot((b.x0 + b.x1) / 2 - human.x, (b.z0 + b.z1) / 2 - human.z) < 4);
          if (bench) { humanSay('So tired…'); human.state = 'sit'; human.stateT = -0.8; }
        }
      }
      // Reel: "Click!", then a new leash length 0.8 s later.
      human.reelT -= dt;
      if (human.reelT <= 0 && human.grace <= 0) {
        human.reelT = rand(4, 8);
        humanSay('Click!', 1);
        audio.click();
        human.pendingReel = 0.8;
      }
      if (human.pendingReel > 0) {
        human.pendingReel -= dt;
        if (human.pendingReel <= 0) leash.rest = 2.5 + (rand(2.5, 6.3) - 2.5) * (0.55 + 0.45 * human.patience);
      }
      const holdStill = (human.state === 'phone' && human.stateT > 0 && human.stateT < rand(1.5, 2.8)) ||
        (human.state === 'selfie' && human.stateT > 0 && human.stateT < 2.2) ||
        (human.state === 'sit' && human.stateT > 0 && human.stateT < 4);
      if (human.state !== 'walk' && human.stateT > 4.2) human.state = 'walk';
      // Follow the dog loosely; give in to a steady pull.
      const dx = dog.x - human.x, dz = dog.z - human.z, d = Math.hypot(dx, dz);
      const pulling = tension > 3;
      human.giveIn = clamp(human.giveIn + (pulling ? dt * 0.6 : -dt * 0.4), 0, 1);
      if (!holdStill && d > 2.4) { wantX = dx / d; wantZ = dz / d; }
      if (holdStill) speed = 0;
      if (chase?.kind === 'neteja') { wantX = 0; wantZ = 0; speed = 0; human.state = 'phone'; human.stateT = 0.5; }
      if (chase?.kind === 'correfoc') {
        // Scared too: they bolt for the underpass.
        const tx = 0, tz = 19;
        const dd = Math.hypot(tx - human.x, tz - human.z) || 1;
        wantX = (tx - human.x) / dd; wantZ = (tz - human.z) / dd; speed = dd > 1 ? 3.2 : 0;
      }
      if (humanLevelBlocked()) {
        const rampX = level.ramps.reduce((a, b) => (Math.abs(b - human.x) < Math.abs(a - human.x) ? b : a));
        const tx = rampX, tz = human.z < -20 ? -22.4 : -18.4;
        const dd = Math.hypot(tx - human.x, tz - human.z) || 1;
        wantX = (tx - human.x) / dd; wantZ = (tz - human.z) / dd; speed = HUMAN_WALK * 1.2;
      }
      // Patience (no meter: you read it from what they say).
      const tPx = tension * 68;
      if (tPx > 900) {
        const back = (human.vx * (dog.x - human.x) + human.vz * (dog.z - human.z)) < 0 ? 1.5 : 1;
        human.patience -= 0.14 * clamp(tPx / 900, 1, 2) * back * dt;
      } else if (leash.taut < 0.2) human.patience = Math.min(1, human.patience + 0.18 * dt);
      if (human.patience < 0.45 && !human.ughSaid) { humanSay(pickOne(['Ugh.', 'Millie…', 'Seriously?'])); human.ughSaid = true; }
      if (human.patience > 0.6) human.ughSaid = false;
      if (human.patience <= 0 && human.heyT <= 0) { human.heyT = 0.8; humanSay('HEY!', 1.2, 'loud'); audio.hey(); }
      if (human.heyT > 0) {
        human.heyT -= dt;
        if (human.heyT <= 0) {
          if (dog.planted) {
            // Planted: the correction backfires and they lurch forward.
            human.vx += (dog.x - human.x) * 1.5; human.vz += (dog.z - human.z) * 1.5;
            human.state = 'stumble'; human.stumbleT = 0.6; humanSay('Whoa!');
          } else {
            human.state = 'haul'; human.haulT = 0.5;
            leash.rest *= 0.65;
            hud.shout('CORRECTION', 'bad');
          }
          human.patience = 0.7;
          human.grace = 8;
        }
      }
    }
    // Steer toward the wish.
    const tvx = wantX * speed, tvz = wantZ * speed;
    human.vx += (tvx - human.vx) * Math.min(1, dt * 5);
    human.vz += (tvz - human.vz) * Math.min(1, dt * 5);
  };

  // ---- Whirl orbit (main.gd) ------------------------------------------------------------
  const startWhirl = (pole: Obstacle, coil: number) => {
    const r = Math.max(0.56, Math.hypot(human.x - pole.x, human.z - pole.z));
    const sp = Math.hypot(human.vx, human.vz);
    whirl = {
      pole, r, t: 0, swept: 0, extra: 0,
      theta: Math.atan2(human.z - pole.z, human.x - pole.x),
      omega: clamp(sp / r, 5, 9),
      budget: clamp(Math.abs(coil) / (Math.PI * 2), 0.6, 4) * Math.PI * 2,
      dir: coil >= 0 ? 1 : -1,
    };
    human.state = 'whirl';
    leash.whirl = true;
    humanSay('Wheee!', 1.4, 'loud');
    hud.shout('POLE SWING', 'loud');
    addCombo('POLE SWING', 10);
  };
  let whooshAcc = 0;
  const updateWhirl = (dt: number, tension: number) => {
    if (!whirl) return;
    const w = whirl;
    w.t += dt;
    w.omega = Math.min(20, w.omega + (7 + 0.009 * tension * 68) * dt);
    w.r = lerp(w.r, 0.56, Math.min(1, dt * 2.9 / Math.max(0.1, w.r)));
    const dTheta = w.dir * w.omega * dt;
    w.theta += dTheta;
    w.swept += Math.abs(dTheta);
    whooshAcc += Math.abs(dTheta);
    if (whooshAcc > Math.PI) { whooshAcc = 0; audio.whoosh(0.75 + (w.omega / 20) * 0.75); }
    const px = w.pole.x + Math.cos(w.theta) * (w.r + w.pole.r);
    const pz = w.pole.z + Math.sin(w.theta) * (w.r + w.pole.r);
    human.vx = (px - human.x) / dt; human.vz = (pz - human.z) / dt;
    human.x = px; human.z = pz;
    human.heading = w.theta + Math.PI; // hand toward the pole
    const tx = -Math.sin(w.theta) * w.dir, tz = Math.cos(w.theta) * w.dir;
    const toDog = { x: dog.x - human.x, z: dog.z - human.z };
    const dl = Math.hypot(toDog.x, toDog.z) || 1;
    const dot = (tx * toDog.x + tz * toDog.z) / dl;
    const fling = (lx: number, lz: number) => {
      const sp = clamp(0.94 * w.omega, 5.3, 14);
      human.vx = lx * sp; human.vz = lz * sp;
      human.state = 'stumble'; human.stumbleT = 1;
      whirl = null; leash.whirl = false; leash.freeSlip = 1.2;
      humanSay('Aaaah!', 1.4, 'loud');
      audio.fling();
      shake = 0.35; slowmo = 0.35;
      addBones(6);
      addCombo('FLING', 30);
      hud.shout('FLING!', 'loud');
      completeGoal('whirl');
    };
    if (w.swept >= w.budget && dot > 0.5) { fling(tx, tz); return; }
    if (w.swept >= w.budget) {
      w.extra += Math.abs(dTheta);
      if (w.extra > 0.6 * Math.PI * 2) {
        // Launch with a lean toward the dog of at most 60°.
        const a = Math.atan2(tz, tx), b = Math.atan2(toDog.z, toDog.x);
        let d = b - a;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const lean = clamp(d, -Math.PI / 3, Math.PI / 3);
        fling(Math.cos(a + lean), Math.sin(a + lean));
        return;
      }
    }
    if (w.t > 3.5 || Math.hypot(human.x - w.pole.x, human.z - w.pole.z) > 2.2) {
      // Bail: stagger off, dizzy, no score.
      const sp = clamp(w.omega * w.r, 0.9, 3.8);
      human.vx = tx * sp; human.vz = tz * sp;
      human.state = 'stumble'; human.stumbleT = 0.7;
      whirl = null; leash.whirl = false;
      humanSay("Ugh, I'm dizzy");
    }
  };

  // ---- Fixed-step physics -----------------------------------------------------------
  let lastTension = 0;
  let wasInPipica = false;
  const physicsStep = (dt: number) => {
    const inp = coriolisFocus || stemmaOpen ? { x: 0, z: 0, mag: 0 } : inputDir();
    const wantsRun = (held.has('ShiftLeft') || held.has('ShiftRight')) && inp.mag > 0;
    const freeZoom = offLeash;
    const running = wantsRun && (dog.zoom > 0.02 || freeZoom);
    if (running && !freeZoom) dog.zoom = Math.max(0, dog.zoom - 0.16 * dt);
    else if (!running) dog.zoom = Math.min(1, dog.zoom + 0.07 * dt);
    dog.planted = held.has('Space') && inp.mag === 0 && !offLeash;
    dog.digging = held.has('Space');
    const surf = level.surface(dog.x, dog.z, dog.y);
    const depth = Math.max(0, WATER_Y - level.floor(dog.x, dog.z, dog.y));
    const surfMul = surf === 'sand' ? 0.82 : surf === 'water' ? clamp(0.75 - depth, 0.35, 0.75) : 1;
    const target = (dog.digging ? 1.0 : running ? RUN : WALK) * surfMul * inp.mag;
    const tvx = inp.x * target, tvz = inp.z * target;
    const acc = inp.mag > 0 ? 12 : 9;
    if (dog.onGround) {
      dog.vx += (tvx - dog.vx) * Math.min(1, dt * acc);
      dog.vz += (tvz - dog.vz) * Math.min(1, dt * acc);
    }
    if (inp.mag > 0) dog.heading = angLerp(dog.heading, Math.atan2(inp.z, inp.x), Math.min(1, dt * 12));

    // Human desires.
    updateHuman(dt, lastTension);

    // Leash tension.
    let tension = 0;
    if (!offLeash) {
      const dogMass = dog.planted ? (surf === 'water' ? 9 : 14) : inp.mag > 0 ? 2 : 1;
      const humanMass = human.state === 'stumble' ? 8 : 4;
      const pullingAway = inp.mag > 0 && (inp.x * (dog.x - human.x) + inp.z * (dog.z - human.z)) > 0;
      tension = applyTug(leash, dog, human, {
        dogMass, humanMass, dogPulling: pullingAway, planted: dog.planted, dt,
        poles: nearbyPoles(human.x, human.z, 2, human.y),
      });
    }
    lastTension = tension;
    updateWhirl(dt, tension);

    // Integrate the dog.
    const dx0 = dog.x, dz0 = dog.z;
    dog.x += dog.vx * dt;
    dog.z += dog.vz * dt;
    collide(dog, DOG_R, dog.y);
    level.clampBounds(dog);
    blockLedge(dog, dx0, dz0, dog.y);
    const g = level.floor(dog.x, dog.z, dog.y);
    if (!dog.onGround || dog.y > g + 0.02) {
      dog.vy -= 17.5 * dt;
      dog.y += dog.vy * dt;
      if (dog.y <= g) {
        dog.y = g; dog.vy = 0;
        if (!dog.onGround) audio.land();
        dog.onGround = true;
      } else dog.onGround = false;
    } else dog.y = g;

    // Integrate the human (unless whirling, which sets the position directly).
    if (!whirl) {
      const hx0 = human.x, hz0 = human.z;
      human.x += human.vx * dt;
      human.z += human.vz * dt;
      collide(human, HUMAN_R, human.y);
      level.clampBounds(human);
      blockLedge(human, hx0, hz0, human.y);
      human.y = level.floor(human.x, human.z, human.y + 0.3);
      const moved = Math.hypot(human.x - hx0, human.z - hz0);
      const wanted = Math.hypot(human.vx, human.vz) * dt;
      human.stuck = wanted > 0.01 && moved < wanted * 0.2 ? human.stuck + dt : Math.max(0, human.stuck - dt);
      if (human.stuck > 2.5 && !offLeash) {
        // Safety valve: hop to just behind the dog.
        human.x = dog.x - Math.cos(dog.heading) * 1.6;
        human.z = dog.z - Math.sin(dog.heading) * 1.6;
        human.y = level.floor(human.x, human.z, dog.y + 0.3);
        human.stuck = 0;
        leash.reset(dog, handXZ());
      }
      if (Math.hypot(human.vx, human.vz) > 0.2 && human.state !== 'stumble') human.heading = angLerp(human.heading, Math.atan2(human.vz, human.vx), Math.min(1, dt * 8));
    }

    // Rope.
    if (!offLeash) {
      const obs = nearbyPoles((dog.x + human.x) / 2, (dog.z + human.z) / 2, leash.rest + 2, Math.max(dog.y, human.y));
      leash.step({ x: dog.x, z: dog.z }, handXZ(), obs, dt);
      const over = capStretch(leash, dog, human, dog.planted ? 14 : 1, 4);
      if (over > 0 && dog.planted && Math.hypot(human.vx, human.vz) > 1.6 && human.state === 'walk') {
        human.state = 'stumble'; human.stumbleT = 0.8; humanSay('Whoa there!'); audio.stumble();
      }
      const hit = whirlDet.update(leash, human, dt);
      if (hit && !whirl && human.state !== 'stumble') startWhirl(hit.pole, hit.coil);
    }

    // Pipicà gate: off the leash inside, clipped back on the moment she leaves.
    const inP = level.inPipica(dog.x, dog.z);
    if (inP && !wasInPipica && !offLeash) {
      offLeash = true;
      human.state = 'walk';
      hud.shout('OFF LEASH!', 'good');
      audio.pickup();
    } else if (!inP && wasInPipica && offLeash) {
      offLeash = false;
      if (Math.hypot(dog.x - human.x, dog.z - human.z) > leash.rest * 1.1) {
        human.x = dog.x - 1.5; human.z = dog.z; human.y = level.floor(human.x, human.z, dog.y + 0.3);
      }
      leash.reset(dog, handXZ());
      human.state = 'walk';
      humanSay('Leash back on!', 1.4);
      audio.click();
    }
    wasInPipica = inP;
  };

  // ---- Per-frame world update ---------------------------------------------------------
  const wallTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3(0, 12, 50);
  const camLook = new THREE.Vector3(0, 1, 30);
  const tmpV = new THREE.Vector3();
  let lightPoolT = 0;
  let pierReached = false;

  const update = (rawDt: number) => {
    const dt = slowmo > 0 ? rawDt * 0.3 : rawDt;
    if (slowmo > 0) slowmo -= rawDt;
    time += dt;

    // Physics at a fixed 120 Hz for a stable rope.
    let acc = dt;
    while (acc > 1e-5) {
      const h = Math.min(1 / 120, acc);
      physicsStep(h);
      acc -= h;
    }
    const sp = Math.hypot(dog.vx, dog.vz);
    dog.speed = sp;
    dog.stillTime = sp < 0.2 ? dog.stillTime + dt : 0;

    // Coriolis texture, only when nearby or focused.
    if (coriolis.tick(time * 1000) && (coriolisFocus || Math.abs(camPos.z - level.coriolis.z) < 45)) {
      coriolis.renderToCanvas(cCtx, 4, 1);
      coriolisTex.needsUpdate = true;
    }

    // Pee, streaks, drinking.
    if (dog.peeing > 0) dog.peeing -= dt;
    if (streakT > 0) streakT -= dt;
    else streak = 0;
    for (const f of [...level.fountains, ...level.bowls]) {
      if (pee < 0.97 && Math.hypot(f.x - dog.x, f.z - dog.z) < 1.0) { pee = 1; audio.slurp(); hud.shout('SLURP', 'plain'); }
    }
    if (level.surface(dog.x, dog.z, dog.y) === 'water') {
      if (dog.wet < 1 && Math.random() < dt * 8 && sp > 0.5) burst(dog.x, WATER_Y + 0.1, dog.z, 0xcfeeff, 3, 1, 1.5, 0.4, 6);
      if (dog.wet < 0.1) audio.splash();
      dog.wet = 1;
    } else if (dog.wet > 0) {
      dog.wet -= dt * 0.25;
      if (dog.wet > 0.2 && dog.wet < 0.23 && sp < 0.5) {
        // Shake off.
        burst(dog.x, dog.y + 0.5, dog.z, 0xcfeeff, 18, 2.5, 1.5, 0.5, 6);
        hud.say('dog', 'Shake shake', 1);
      }
    }

    // Digging on the beach.
    if (dog.digging && dog.onGround) {
      for (const m of level.mounds) {
        if (!m.dug && Math.hypot(m.x - dog.x, m.z - dog.z) < 1.3) {
          m.dug = true;
          m.loot.visible = true;
          (m.mesh as THREE.Mesh).scale.y = 0.12;
          findsGot++;
          audio.dig(); audio.pickup();
          burst(m.x, level.floor(m.x, m.z, 0) + 0.1, m.z, 0xcdb586, 18, 2.2, 3);
          hud.toast('Dug up', m.name, '#ffb020');
          addBones(3);
          bumpGoal('finds', findsGot);
        }
      }
      if (Math.random() < dt * 10 && level.surface(dog.x, dog.z, dog.y) === 'sand') burst(dog.x - Math.cos(dog.heading) * 0.3, dog.y + 0.1, dog.z - Math.sin(dog.heading) * 0.3, 0xcdb586, 2, 1.2, 1.5, 0.4);
    }
    for (const m of level.mounds) if (m.dug) m.loot.rotation.y += dt * 2;

    // Bones.
    for (const b of bonesList) {
      if (b.got) continue;
      b.m.position.set(b.x, level.floor(b.x, b.z, 3) + 0.25 + Math.sin(time * 3 + b.x) * 0.05, b.z);
      b.m.rotation.y += dt * 1.8;
      if (Math.hypot(b.x - dog.x, b.z - dog.z) < 0.8 && Math.abs(b.m.position.y - dog.y) < 1.5) {
        b.got = true; b.m.visible = false; bones++; audio.pickup();
      }
    }

    // Balls: the pipicà ball and the kid's ball.
    const ballY = (x: number, z: number) => level.floor(x, z, 0) + 0.12;
    if (ball.held) { ball.x = dog.x + Math.cos(dog.heading) * 0.55; ball.z = dog.z + Math.sin(dog.heading) * 0.55; }
    else {
      const bd = Math.hypot(ball.x - dog.x, ball.z - dog.z);
      if (bd < 0.5 && sp > 0.5) { ball.vx = (ball.x - dog.x) / bd * sp * 1.4; ball.vz = (ball.z - dog.z) / bd * sp * 1.4; }
      ball.vx *= 1 - dt * 1.2; ball.vz *= 1 - dt * 1.2;
      ball.x = clamp(ball.x + ball.vx * dt, PIPICA.x0 + 0.3, PIPICA.x1 - 0.3);
      ball.z = clamp(ball.z + ball.vz * dt, PIPICA.z0 + 0.3, PIPICA.z1 - 0.3);
    }
    ball.m.position.set(ball.x, ball.held ? dog.y + 0.55 : ballY(ball.x, ball.z), ball.z);
    if (questBall.held) { questBall.x = dog.x + Math.cos(dog.heading) * 0.55; questBall.z = dog.z + Math.sin(dog.heading) * 0.55; }
    questBall.m.position.set(questBall.x, questBall.held ? dog.y + 0.55 : RAMBLA_Y + 0.14, questBall.z);

    // Hurdles: cleared by jumping over them.
    if (!dog.onGround) {
      for (const h of level.hurdles) {
        if (!h.cleared && Math.abs(dog.x - h.x) < 0.3 && Math.abs(dog.z - h.z) < 0.7 && dog.y > -0.4 + 0.5) {
          h.cleared = true;
          hurdlesGot++;
          hud.shout('HUP!', 'good');
          audio.pickup();
          bumpGoal('hurdles', hurdlesGot);
        }
      }
    }

    // Pier end.
    if (!pierReached && Math.hypot(dog.x - level.pierEnd.x, dog.z - level.pierEnd.z) < 5 && dog.y > 0.9) {
      pierReached = true;
      completeGoal('pier');
      hud.shout('THE END OF THE PIER', 'good');
    }

    // ---- Quests ----
    // Kid on the balcony.
    kid.animate(time, { speed: 0, pose: 'stand' });
    if (!quest.ball && Math.hypot(dog.x - Q.kid.x, dog.z - Q.kid.z) < 5 && !hud.hasBubble('kid')) {
      hud.say('kid', questBall.held ? 'My ball! Drop it here!' : 'I lost my ball… have you seen it?', 2.4);
    }
    // Cat.
    // Tofu: get close and she darts to her next hiding spot, until she's home.
    {
      const spots = Q.tofu.spots;
      const d = Math.hypot(dog.x - tofu.x, dog.z - tofu.z);
      if (!tofu.home && !tofu.darting && d < 2.4 && tofu.i < spots.length - 1) {
        tofu.darting = true;
        tofu.i++;
        audio.meow();
        if (tofu.i === 1) hud.say('tofu', 'Mrrp?', 1.2);
      }
      let tsp = 0;
      if (tofu.darting) {
        const [tx, tz] = spots[tofu.i];
        const dx = tx - tofu.x, dz = tz - tofu.z, dd = Math.hypot(dx, dz);
        if (dd < 0.2) {
          tofu.darting = false;
          if (tofu.i === spots.length - 1) {
            tofu.home = true;
            hud.say('tofu', 'Purrr', 2, 'win');
            finishQuest('tofu', "TOFU'S HOME", 6);
          }
        } else {
          tsp = 4.8;
          tofu.x += (dx / dd) * tsp * dt; tofu.z += (dz / dd) * tsp * dt;
          tofu.heading = Math.atan2(dz, dx);
        }
      } else if (!tofu.home) {
        tofu.heading = angLerp(tofu.heading, Math.atan2(dog.z - tofu.z, dog.x - tofu.x), dt * 3);
        if (d < 6 && !hud.hasBubble('tofu') && Math.random() < dt * 0.4) hud.say('tofu', pickOne(['Mrrp.', '…', 'Mew!']), 1.2);
      }
      tofuM.group.position.set(tofu.x, GROUND_Y, tofu.z);
      tofuM.group.rotation.y = -tofu.heading;
      tofuM.animate(time, tsp, d < 6);
    }
    // The selfie mural: your human can't resist.
    if (!quest.selfie && Math.hypot(human.x - Q.mural.x, human.z - Q.mural.z) < 4 && human.state === 'walk' && !offLeash) {
      humanSay('Selfie with the monkey!', 2.2);
      human.state = 'selfie'; human.stateT = 0;
      finishQuest('selfie', 'MURAL SELFIE', 2);
    }
    // Fruit crate: bump it at speed.
    if (!quest.crate && Math.hypot(dog.x - Q.crate.x, dog.z - Q.crate.z) < 0.95 && sp > 2.2) {
      crate.oranges.forEach((o) => {
        const wp = o.getWorldPosition(new THREE.Vector3());
        o.visible = false;
        const m = sphere(0.075, M(0xf28a1e, 0.6), 10, 8);
        m.castShadow = true;
        scene.add(m);
        rolling.push({ m, x: wp.x, y: wp.y, z: wp.z, vx: rand(-2.5, 2.5) + dog.vx * 0.4, vz: rand(-2.5, 2.5) + dog.vz * 0.4, vy: rand(1, 3) });
      });
      hud.say('grocer', 'Ei! Les taronges!', 2, 'loud');
      finishQuest('crate', 'ORANGES EVERYWHERE', 2);
    }
    for (const o of rolling) {
      o.vy -= 12 * dt;
      o.x += o.vx * dt; o.z += o.vz * dt; o.y += o.vy * dt;
      const fy = RAMBLA_Y + 0.075;
      if (o.y < fy) { o.y = fy; o.vy = Math.abs(o.vy) * 0.35; o.vx *= 0.96; o.vz *= 0.96; }
      const p = { x: o.x, z: o.z };
      collide(p, 0.075, o.y);
      o.x = p.x; o.z = p.z;
      o.m.position.set(o.x, o.y, o.z);
      o.m.rotation.x += o.vz * dt * 8; o.m.rotation.z -= o.vx * dt * 8;
    }
    grocer.animate(time, { speed: 0, pose: 'stand' });
    // Baker: sit nicely (stand still) by the forn and get a biscuit.
    baker.animate(time, { speed: 0, pose: 'stand' });
    if (!quest.bakery && Math.hypot(dog.x - Q.baker.x, dog.z - Q.baker.z) < 2.6) {
      if (dog.stillTime > 0.3) begT += dt; else begT = Math.max(0, begT - dt);
      if (begT > 0.4 && !hud.hasBubble('baker')) hud.say('baker', begT > 1.5 ? 'Ai, quina cara…' : 'Hola, preciosa!', 1.6);
      if (begT > 2.6) {
        hud.say('baker', 'Una galeta per a tu!', 2, 'win');
        finishQuest('bakery', 'FREE BISCUIT', 3);
      }
    } else begT = 0;

    // ---- NPCs ----
    for (const w of walkers) {
      if (w.saidT > 0) w.saidT -= dt;
      const [tx, tz] = w.path[w.i];
      const dx = tx - w.x, dz = tz - w.z, d = Math.hypot(dx, dz);
      let speed = w.speed;
      // Step around Millie.
      const ddx = w.x - dog.x, ddz = w.z - dog.z, dd = Math.hypot(ddx, ddz);
      if (dd < 1.4) {
        w.x += (ddx / (dd || 1)) * dt * 1.5; w.z += (ddz / (dd || 1)) * dt * 1.5;
        if (w.saidT <= 0 && Math.random() < dt * 0.8) { hud.say(w.id, pickOne(['Hola, guapa!', 'Quin gos més maco!', 'Compte!', 'Aww']), 1.6); w.saidT = 6; }
      }
      if (w.pause > 0) { w.pause -= dt; speed = 0; }
      else if (d < 0.3) {
        w.i += w.dir;
        if (w.i >= w.path.length || w.i < 0) { w.dir = -w.dir; w.i += w.dir * 2; w.i = clamp(w.i, 0, w.path.length - 1); }
        if (Math.random() < 0.25) w.pause = rand(1, 3);
      } else {
        w.x += (dx / d) * speed * dt; w.z += (dz / d) * speed * dt;
      }
      const head = Math.atan2(dz, dx);
      w.m.group.position.set(w.x, level.floor(w.x, w.z, 0.5), w.z);
      w.m.group.rotation.y = angLerp(w.m.group.rotation.y, -head, Math.min(1, dt * 6));
      w.m.animate(time + w.x, { speed: speed > 0 && d > 0.3 ? speed : 0, pose: 'walk' });
    }
    for (const r of riders) {
      const blocked = [dog, human].some((p) => Math.abs(p.z - r.z) < 1.0 && (p.x - r.x) * r.dir > 0 && (p.x - r.x) * r.dir < 5);
      r.speed += clamp((blocked ? 0 : r.max) - r.speed, -10 * dt, 3 * dt);
      if (blocked && r.rang <= 0 && Math.abs(r.x - dog.x) < 15) { audio.bell(); r.rang = 3; hud.say(`r${r.x | 0}`, 'Ring ring!', 1); }
      if (r.rang > 0) r.rang -= dt;
      r.x += r.dir * r.speed * dt;
      if (r.x > 80) r.x = -80;
      if (r.x < -80) r.x = 80;
      r.g.position.set(r.x, RAMBLA_Y, r.z);
      r.g.rotation.y = r.dir > 0 ? 0 : Math.PI;
      r.wheels.forEach((wh) => { wh.rotation.z -= r.speed * dt * 3; });
      r.rider.animate(time, { speed: r.speed, pose: r.max === 5 ? 'stand' : 'ride' });
      // A fast rider who hits the human knocks them down.
      if (r.speed > 2 && Math.hypot(r.x - human.x, r.z - human.z) < 0.7 && human.state !== 'stumble' && !whirl) {
        human.state = 'stumble'; human.stumbleT = 1.2;
        human.vx += r.dir * 3;
        human.phones = Math.max(0, human.phones - 1);
        humanSay('Ow! My phone!', 1.8, 'loud');
        hud.shout('PHONE CRACKED', 'bad');
        audio.stumble();
        if (human.phones === 0) setTimeout(() => { human.phones = 3; hud.toast('New phone', 'Your human bought a new phone. Again.', '#1fc9b7'); }, 2500);
      }
    }
    // La Neteja.
    if (chaseCooldown > 0) chaseCooldown -= dt;
    if (chase?.kind === 'neteja') {
      chase.t += dt;
      chase.speed = Math.min(3.4, chase.speed + dt * 0.6);
      sw.dir = -1;
      sw.z -= chase.speed * dt;
      const front = sw.z - 2.3;
      const caught = [dog, human].some((p) => Math.abs(p.x - sw.x) < 2.2 && p.z > front - 0.6 && p.z < sw.z + 1);
      const safe = (p: { x: number; z: number }) => p.z < 33 || Math.abs(p.x) > 5;
      if (caught) endChase(false);
      else if (safe(dog) && safe(human)) endChase(true);
      else if (sw.z < 38) endChase(true);
    } else {
      sw.z += sw.dir * sw.speed * dt;
      if (sw.z > Q.sweeper.z1) sw.dir = -1;
      if (sw.z < Q.sweeper.z0) sw.dir = 1;
      if (Math.hypot(sw.x - dog.x, sw.z + sw.dir * 2.2 - dog.z) < 1.4) sw.z -= sw.dir * sw.speed * dt; // waits for her
    }
    sweeper.group.position.set(sw.x, RAMBLA_Y, sw.z);
    sweeper.group.rotation.y = sw.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    sweeper.brushes.forEach((b, i) => { b.rotation.y += (i ? 1 : -1) * dt * 12; });
    sweeper.beacon.emissiveIntensity = 0.6 + Math.max(0, Math.sin(time * 9)) * 1.6;
    if (Math.random() < dt * 14) burst(sw.x + rand(-0.7, 0.7), RAMBLA_Y + 0.1, sw.z + sw.dir * 2.4, 0xbfe6ff, 1, 0.6, 0.6, 0.35, 4);
    // The train: wait, then cross the whole level.
    // Rodalies trains: each one either runs straight through, whistling, or
    // brakes into the station, chimes, waits with its doors open and pulls out.
    const ST = level.station.x;
    if (tr.wait > 0) {
      tr.wait -= dt;
      if (tr.wait <= 0) {
        tr.dir = Math.random() < 0.5 ? 1 : -1;
        tr.z = tr.dir > 0 ? TRAIN_Z + 1.6 : TRAIN_Z - 1.6;
        tr.x = tr.dir > 0 ? -280 : 280;
        tr.speed = 16;
        tr.stop = Math.random() < 0.55;
        tr.stopped = false;
        tr.dwell = 0;
        tr.horned = false; tr.rumbled = false;
      }
    } else {
      if (tr.stop && !tr.stopped) {
        const dist = (ST - tr.x) * tr.dir;
        if (dist <= 0.3) {
          tr.stopped = true; tr.speed = 0; tr.dwell = 9;
          audio.chime();
          if (Math.abs(ST - dog.x) < 40 && dog.z > -12 && dog.z < 34) hud.banner('Rodalies R1 · Badalona', 'news');
        } else if (dist < 70) tr.speed = Math.max(0.6, Math.min(16, Math.sqrt(4.4 * dist)));
      } else if (tr.stopped && tr.dwell > 0) {
        tr.dwell -= dt;
        if (tr.dwell <= 0) { audio.trainHorn(); tr.stop = false; }
      } else {
        tr.speed = Math.min(16, tr.speed + dt * (tr.stopped ? 1.6 : 4));
      }
      tr.x += tr.dir * tr.speed * dt;
      if (!tr.horned && !tr.stop && Math.abs(tr.x - dog.x) < 110) { audio.trainHorn(); tr.horned = true; }
      if (!tr.rumbled && Math.abs(tr.x - dog.x) < 50 && tr.speed > 4) { audio.rumble(4); tr.rumbled = true; }
      if (Math.abs(tr.x) > 290) tr.wait = rand(22, 38);
    }
    train.group.rotation.y = tr.dir > 0 ? 0 : Math.PI;
    train.group.position.set(tr.x + (tr.dir > 0 ? -1 : 1) * (train.length / 2 - 8.5), TRAIN_Y + 0.35, tr.z);
    train.doors.forEach((d) => { d.position.z = d.userData.z0 + (tr.stopped && tr.dwell > 0.8 ? Math.sign(d.userData.z0) * 0.12 : 0); });
    const T = level.tunnel;
    const inTunnel = dog.x > T.x0 - 0.5 && dog.x < T.x1 + 0.5 && dog.z > T.z0 && dog.z < T.z1;
    if (inTunnel && tr.wait <= 0 && tr.speed > 3 && Math.abs(tr.x - dog.x) < 30) {
      shake = Math.max(shake, 0.12);
      if (Math.random() < dt * 2) hud.shout('RUMBLE', 'plain');
    }
    audio.setEcho(inTunnel ? 1 : 0);
    // The correfoc: devils sweep west along the Rambla in a shower of sparks.
    if (chase?.kind === 'correfoc') {
      chase.t += dt;
      chase.speed = Math.min(4.6, chase.speed + dt * 1.2);
      cf.x -= chase.speed * dt;
      const caught = devils.some((dv) => [dog, human].some((p) => Math.hypot(p.x - dv.x, p.z - dv.z) < 1.1));
      const inCut = (p: { x: number; z: number }) => Math.abs(p.x) < 3 && p.z < 21.5;
      if (caught) endChase(false);
      else if (inCut(dog) && inCut(human)) endChase(true);
      else if (cf.x < level.correfoc.x1 - 4) endChase(true);
    } else if (cf.x < level.correfoc.x0) {
      cf.x = Math.min(level.correfoc.x0, cf.x + dt * 3);
    }
    const running = chase?.kind === 'correfoc';
    for (const dv of devils) {
      const tx = cf.x + dv.ox, tz = level.correfoc.z + dv.oz;
      dv.x += (tx - dv.x) * Math.min(1, dt * 4);
      dv.z += (tz - dv.z) * Math.min(1, dt * 4) + (running ? Math.sin(time * 3 + dv.ox) * dt : 0);
      dv.person.group.position.set(dv.x, GROUND_Y, dv.z);
      dv.person.group.rotation.y = running || cf.x < level.correfoc.x0 - 1 ? Math.PI : Math.sin(time + dv.ox) * 0.6 + Math.PI;
      dv.person.animate(time + dv.ox, { speed: running ? 4 : 0.6, pose: 'walk' });
      if ((running || skyMode === 'night') && Math.random() < dt * (running ? 30 : 8)) {
        const sp = dv.spark.getWorldPosition(tmpV);
        burst(sp.x, sp.y, sp.z, pickOne([0xffe08a, 0xffb020, 0xff7a2a, 0xffffff]), 2, 2.2, 2, 0.5, 6);
      }
    }
    drummers.forEach((d, i) => {
      d.animate(time, { speed: 0, pose: 'stand' });
      d.arms.forEach((a, k) => { a.rotation.z = 1.2 + Math.sin(time * 14 + k * Math.PI + i) * 0.4; });
    });
    // Birds.
    for (const b of birds) {
      if (b.fly > 0) {
        b.fly -= dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        b.vy -= 1.2 * dt;
        b.wingFlap?.(time);
        if (b.fly <= 0) { b.x = b.hx; b.z = b.hz; b.y = b.baseY; }
      } else {
        b.y = b.baseY;
        if (Math.random() < dt * 0.5) b.b.group.rotation.y = rand(0, 6.28);
        b.b.wings.forEach((w) => { w.rotation.x = 0; });
      }
      b.b.group.position.set(b.x, b.y, b.z);
      if (b.fly > 0) b.b.group.rotation.y = -Math.atan2(b.vz, b.vx);
    }
    // Free dogs romp around the pipicà.
    for (const fd of freeDogs) {
      fd.t -= dt;
      if (fd.t <= 0) {
        fd.t = rand(1.5, 4);
        const chaseBall = Math.random() < 0.4 && !ball.held;
        fd.tx = chaseBall ? ball.x : rand(PIPICA.x0 + 1, PIPICA.x1 - 1);
        fd.tz = chaseBall ? ball.z : rand(PIPICA.z0 + 1, PIPICA.z1 - 1);
      }
      const dx = fd.tx - fd.x, dz = fd.tz - fd.z, d = Math.hypot(dx, dz);
      const s = d > 0.4 ? (offLeash && Math.random() < 0.5 ? 4 : 2.5) : 0;
      if (d > 0.4) { fd.x += (dx / d) * s * dt; fd.z += (dz / d) * s * dt; fd.heading = angLerp(fd.heading, Math.atan2(dz, dx), dt * 8); }
      fd.m.group.position.set(fd.x, level.floor(fd.x, fd.z, 0), fd.z);
      fd.m.group.rotation.y = -fd.heading;
      fd.m.animate(time + fd.x, { speed: s, dig: false, peeing: false, wag: 0.7, air: false });
    }
    // Particles.
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t -= dt;
      p.vy -= p.g * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      if (p.t <= 0) { scene.remove(p.m); particles.splice(i, 1); }
    }
    // Fireworks over the Dimoni.
    if (fireworksT > 0) {
      fireworksT -= dt;
      level.dimoni.glow.intensity = 8 + Math.sin(time * 20) * 3;
      level.dimoni.figure.rotation.y = Math.sin(time * 6) * 0.15;
      if (Math.random() < dt * 2.2) {
        fireworks.push({ x: level.dimoni.x + rand(-8, 8), y: 0, z: level.dimoni.z + rand(-6, 2), t: 0, color: pickOne([0xff4a3d, 0xffb020, 0x5eea8c, 0x1fc9b7, 0xe5487a, 0xffffff]) });
        audio.firework();
      }
    } else level.dimoni.glow.intensity = skyMode === 'night' ? 2 : 0;
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const f = fireworks[i];
      f.t += dt;
      if (f.t > 0.6) {
        burst(f.x, 14 + rand(-2, 4), f.z, f.color, 40, 6, 2, 1.4, 2);
        fireworks.splice(i, 1);
      } else if (Math.random() < 0.6) burst(f.x, f.t * 22, f.z, 0xffe3a0, 1, 0.2, 0, 0.3, 0);
    }
    // Combo window.
    if (combo) {
      combo.t -= dt;
      if (combo.t <= 0) {
        const total = combo.pts * combo.links.length;
        if (combo.links.length > 1) hud.shout(`COMBO ${total}`, 'loud');
        bones += Math.round(total / 10);
        combo = null;
      }
    }
    hud.combo(combo && combo.links.length > 1 ? `${combo.links.join(' + ')}   ${combo.pts}   x${combo.links.length}` : null, combo ? combo.t / 4 : 0);

    // Stops and prompts.
    let found: Level['stops'][number] | null = null;
    for (const s of level.stops) if (Math.hypot(dog.x - s.x, dog.z - s.z) < s.r) found = s;
    nearStop = found;
    const prompts: { key: string; label: string }[] = [];
    let banner: string | null = null;
    if (coriolisFocus) { banner = 'Coriolis LED wall — arrows, Enter, [M] menu, [X] step back'; }
    else if (nearCoriolis()) { prompts.push({ key: 'X', label: 'Play the LED wall' }); }
    else if (nearStemma()) { prompts.push({ key: 'X', label: stemmaOpen ? 'Close the mixer' : 'Pick the music' }); }
    if (found && !coriolisFocus) { prompts.push({ key: 'Enter', label: `Visit ${found.label}` }); banner = banner ?? `${found.label} · ${found.kind}`; }
    if (!coriolisFocus && level.mounds.some((m) => !m.dug && Math.hypot(m.x - dog.x, m.z - dog.z) < 1.8)) prompts.push({ key: 'Space', label: 'Dig' });
    if (!dog.carrying && ((!ball.held && Math.hypot(ball.x - dog.x, ball.z - dog.z) < 0.9) || (!questBall.done && Math.hypot(questBall.x - dog.x, questBall.z - dog.z) < 0.9))) prompts.push({ key: 'G', label: 'Pick up' });
    if (dog.carrying) prompts.push({ key: 'G', label: 'Drop' });
    if (Math.hypot(dog.x - level.dimoni.x, dog.z - level.dimoni.z) < 7 && fireworksT <= 0) prompts.push({ key: 'E', label: 'Bark at the Dimoni' });
    if (!chase && chaseCooldown <= 0 && Math.hypot(dog.x - sw.x, dog.z - sw.z) < 7) prompts.push({ key: 'E', label: 'Bark at La Neteja' });
    if (!chase && chaseCooldown <= 0 && Math.hypot(dog.x - cf.x, dog.z - level.correfoc.z) < 9) prompts.push({ key: 'E', label: 'Bark at the devils' });
    if (chase) banner = chase.kind === 'neteja' ? 'La Neteja is coming — get clear!' : 'Correfoc! Run for the underpass!';
    if (inTunnel && !banner) banner = 'Carrer del Mar ↔ the beach';
    if (offLeash && !banner) banner = 'Off the leash — run!';
    hud.banner(banner, 'prompt');
    hud.prompts(prompts);
    hud.setVitals({ phones: human.phones, bones, pee, marked: Math.min(5, marked), streak, zoomies: dog.zoom, zoomMode: offLeash ? 'free' : 'normal', time });
    hud.update(rawDt);

    // ---- Visuals ----
    dogM.group.position.set(dog.x, dog.y, dog.z);
    dogM.group.rotation.y = -dog.heading;
    dogM.animate(time, { speed: sp, dig: dog.digging, peeing: dog.peeing > 0, wag: offLeash ? 1 : clamp(1 - leash.taut, 0.2, 0.8), air: !dog.onGround });
    const dg = level.floor(dog.x, dog.z, dog.y);
    dogShadow.position.set(dog.x, dg + 0.03, dog.z);
    dogShadow.scale.setScalar(0.9 * clamp(1 - (dog.y - dg) * 0.3, 0.5, 1));
    humanM.group.position.set(human.x, human.y, human.z);
    humanM.group.rotation.y = -human.heading;
    const hsp = Math.hypot(human.vx, human.vz);
    const pose: Pose = human.state === 'whirl' ? 'whirl' : human.state === 'stumble' || human.state === 'haul' ? 'stumble'
      : human.state === 'bench' || (human.state === 'sit' && human.stateT > 0) ? 'sit' : human.state === 'phone' && human.stateT > 0 ? 'phone' : 'walk';
    humanM.animate(time, { speed: hsp, pose });
    humanShadow.position.set(human.x, human.y + 0.03, human.z);

    // Rope mesh: hand to collar with a sag that disappears as it goes taut.
    ropeSegs.forEach((s) => { s.visible = !offLeash; });
    if (!offLeash) {
      dogM.collarAnchor.getWorldPosition(collarPos);
      humanM.hand.getWorldPosition(handPos);
      const N = leash.N;
      const slack = clamp(1 - leash.stretch, 0, 1);
      let prev = new THREE.Vector3();
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const p = leash.pts[i];
        const baseY = lerp(collarPos.y, handPos.y, t);
        const sag = Math.sin(Math.PI * t) * (0.15 + slack * leash.rest * 0.32) * (1 - leash.taut);
        const fy = level.floor(p.x, p.z, Math.min(dog.y, human.y) + 0.3) + 0.02;
        const pos = tmpV.set(i === 0 ? collarPos.x : i === N - 1 ? handPos.x : p.x, Math.max(fy, baseY - sag), i === 0 ? collarPos.z : i === N - 1 ? handPos.z : p.z);
        if (i > 0) {
          const s = ropeSegs[i - 1];
          const len = prev.distanceTo(pos) || 0.001;
          s.position.copy(prev).add(pos).multiplyScalar(0.5);
          s.scale.set(1, len, 1);
          s.quaternion.setFromUnitVectors(UPV, segDir.copy(pos).sub(prev).divideScalar(len));
        }
        prev = prev.copy(pos);
      }
    }

    // Stemma window bars and panel.
    level.stemmaBars.forEach((b, i) => {
      const lv = audio.level(STEM_GROUPS[i]);
      b.scale.y = lerp(b.scale.y, 0.15 + lv * 2.4, Math.min(1, dt * 14));
      b.position.y = RAMBLA_Y + 0.25 + b.scale.y * 0.5;
    });
    drawLanes();

    // Night lights near the camera.
    lightPoolT -= dt;
    if (lightPoolT <= 0) {
      lightPoolT = 0.4;
      const lit = SKY[skyMode].lampsOn;
      const sorted = level.lampSpots.map((p) => ({ p, d: p.distanceToSquared(camLook) })).sort((a, b) => a.d - b.d);
      lampPool.forEach((l, i) => {
        const s = sorted[i];
        l.intensity = lit && s ? (skyMode === 'night' ? 46 : 22) : 0;
        if (s) l.position.copy(s.p).add(new THREE.Vector3(0, -0.4, 0));
      });
    }

    // Rain follows the camera.
    if (rain.visible) {
      rain.position.set(camLook.x, 0, camLook.z);
      for (let i = 0; i < RAIN; i++) {
        rainArr[i * 6 + 1] -= 16 * dt; rainArr[i * 6 + 4] -= 16 * dt;
        if (rainArr[i * 6 + 1] < -1) { rainArr[i * 6 + 1] += 18; rainArr[i * 6 + 4] += 18; }
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    // Water ripples.
    level.waterMat.normalMap!.offset.set(time * 0.012, time * 0.02);
    level.foamMat.opacity = 0.35 + Math.sin(time * 1.3) * 0.2;
    (level.foamMat as THREE.MeshBasicMaterial).color.setHex(skyMode === 'night' ? 0x9fb3d6 : 0xffffff);

    // ---- Camera ----
    updateCamera(rawDt, inTunnel);

    // Speech bubbles follow heads.
    const proj = (x: number, y: number, z: number) => {
      tmpV.set(x, y, z).project(camera);
      const w = host.clientWidth, h = host.clientHeight;
      return { x: (tmpV.x * 0.5 + 0.5) * w, y: (-tmpV.y * 0.5 + 0.5) * h, vis: tmpV.z < 1 && tmpV.z > -1 };
    };
    const place = (id: string, x: number, y: number, z: number) => {
      if (!hud.hasBubble(id)) return;
      const p = proj(x, y, z);
      hud.placeBubble(id, p.x, p.y, p.vis);
    };
    place('human', human.x, human.y + 2.1, human.z);
    place('dog', dog.x, dog.y + 1.1, dog.z);
    place('kid', Q.kid.x, Q.kid.y + 1.4, Q.kid.z);
    place('tofu', tofu.x, GROUND_Y + 0.7, tofu.z);
    for (const dv of devils) place(dv.id, dv.x, GROUND_Y + 2.3, dv.z);
    place('grocer', Q.grocer.x, RAMBLA_Y + 2.1, Q.grocer.z);
    place('baker', Q.baker.x, RAMBLA_Y + 2.1, Q.baker.z);
    place('sweeper', sw.x, RAMBLA_Y + 2.8, sw.z);
    for (const w of walkers) place(w.id, w.x, 2.1, w.z);
    for (const r of riders) place(`r${r.x | 0}`, r.x, 2.3, r.z);

    // Sun and shadows follow the action.
    sun.position.set(camLook.x + 30, 48, camLook.z + 22);
    sun.target.position.copy(camLook);
    sun.target.updateMatrixWorld();
  };

  const UPV = new THREE.Vector3(0, 1, 0);
  const segDir = new THREE.Vector3();
  let followYaw = -Math.PI / 2;

  const updateCamera = (dt: number, inTunnel: boolean) => {
    const target = new THREE.Vector3(dog.x, dog.y, dog.z);
    let pos: THREE.Vector3, look: THREE.Vector3;
    let rate = 4;
    if (coriolisFocus) {
      pos = new THREE.Vector3(level.coriolis.x, level.coriolis.y, level.coriolis.z + 6.4);
      look = wallTarget.set(level.coriolis.x, level.coriolis.y, level.coriolis.z);
      camYaw = 0;
      rate = 5;
    } else if (camMode === 'follow') {
      if (sp2() > 0.4) followYaw = angLerp(followYaw, dog.heading, Math.min(1, dt * 2.2));
      camYaw = followYaw + Math.PI / 2;
      const back = 6.5;
      let bx = dog.x - Math.cos(followYaw) * back, bz = dog.z - Math.sin(followYaw) * back;
      // Pull in so walls never come between the camera and Millie.
      const steps = 12;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const px = lerp(dog.x, bx, t), pz = lerp(dog.z, bz, t);
        if (level.boxes.some((b) => b.top > 4 && px > b.x0 - 0.3 && px < b.x1 + 0.3 && pz > b.z0 - 0.3 && pz < b.z1 + 0.3)) {
          const tt = (i - 1) / steps;
          bx = lerp(dog.x, bx, tt); bz = lerp(dog.z, bz, tt);
          break;
        }
      }
      pos = new THREE.Vector3(bx, dog.y + (inTunnel ? 1.6 : 3.2), bz);
      look = new THREE.Vector3(dog.x + Math.cos(followYaw) * 3, dog.y + 0.9, dog.z + Math.sin(followYaw) * 3);
    } else if (camMode === 'overhead') {
      camYaw = 0;
      pos = new THREE.Vector3(dog.x, dog.y + 26, dog.z + 8);
      look = target.clone();
    } else {
      camYaw = 0;
      // Street camera: behind and above, looking out to sea. It drops into the
      // underpass as Millie walks through, so the tunnel frames the sea.
      const T = level.tunnel;
      const tunnelT = Math.abs(dog.x) < 3.2 ? clamp(1 - Math.abs(dog.z - (T.z0 + T.z1) / 2) / 7.5, 0, 1) : 0;
      let height = lerp(8.2, 2.0, tunnelT);
      let back = lerp(10.5, 6.0, tunnelT);
      // Narrow streets: pull in toward Millie and climb so walls never block the view.
      if (tunnelT < 0.2) {
        for (let k = 0.5; k <= back; k += 0.5) {
          const pz = dog.z + k;
          if (level.boxes.some((b) => b.kind === 'building' && b.top > dog.y + 4 && dog.x > b.x0 - 1 && dog.x < b.x1 + 1 && pz > b.z0 - 0.8 && pz < b.z1 + 0.8)) {
            const clear = Math.max(1.5, k - 0.8);
            height += (back - clear) * 1.05;
            back = clear;
            break;
          }
        }
      }
      // In the tunnel, sit a little to the side so the human doesn't fill the frame.
      pos = new THREE.Vector3(dog.x + tunnelT * 1.1, dog.y + height, dog.z + back);
      look = new THREE.Vector3(dog.x, dog.y + lerp(0.6, 1.1, tunnelT), dog.z - lerp(2.6, 9, tunnelT));
      if (dog.y > 1.5) pos.y += 1; // on the pier
      if (camKick > 0) { pos.y += camKick * 4; pos.z += camKick * 5; camKick = Math.max(0, camKick - dt * 1.6); }
    }
    const k = 1 - Math.exp(-dt * rate);
    camPos.lerp(pos, k);
    camLook.lerp(look, k);
    camera.position.copy(camPos);
    if (shake > 0) {
      shake -= dt;
      camera.position.x += (Math.random() - 0.5) * shake * 0.6;
      camera.position.y += (Math.random() - 0.5) * shake * 0.6;
    }
    camera.lookAt(camLook);
    // Fade the embankment a little when the camera dips into the underpass.
    sky.position.copy(camera.position);
  };
  const sp2 = () => Math.hypot(dog.vx, dog.vz);

  // ---- Resize & loop ----------------------------------------------------------------
  const resize = () => {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.fov = r.width < 600 ? 55 : 45;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();

  let prev = performance.now();
  let onScreen = true;
  let rafId = 0;
  let engaged = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loop = (now: number) => {
    const dt = Math.min(0.05, Math.max(0.001, (now - prev) / 1000));
    prev = now;
    update(dt);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(loop);
  };
  const setRunning = () => {
    const run = engaged && onScreen && !document.hidden;
    if (run && !rafId) { prev = performance.now(); rafId = requestAnimationFrame(loop); }
    else if (!run && rafId) { cancelAnimationFrame(rafId); rafId = 0; releaseAll(); }
  };
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting || full; setRunning(); }).observe(host);
  document.addEventListener('visibilitychange', setRunning);
  const engage = () => { if (!engaged) { engaged = true; setRunning(); } };
  host.addEventListener('focus', engage);
  root.addEventListener('pointerdown', engage);

  // Birds need a flap helper.
  birds.forEach((b) => {
    (b as Bird & { wingFlap: (t: number) => void }).wingFlap = (t: number) => {
      b.b.wings.forEach((w, i) => { w.rotation.x = Math.sin(t * 18) * 0.9 * (i ? 1 : -1); });
    };
  });

  update(1 / 60);
  renderer.render(scene, camera);
  setRunning();
  void options;

  if (new URLSearchParams(location.search).has('walktest')) {
    (window as unknown as Record<string, unknown>).__walk = {
      dog, human, leash, level, goals, quest,
      get offLeash() { return offLeash; },
      get whirl() { return whirl; },
      get camMode() { return camMode; },
      get sky() { return skyMode; },
      get bones() { return bones; },
      key: (code: string, down: boolean) => (down ? onKey(code) : onKeyUp(code)),
      tick: (frames = 1) => { for (let i = 0; i < frames; i++) update(1 / 60); renderer.render(scene, camera); },
      teleport: (x: number, z: number) => {
        dog.x = x; dog.z = z; dog.y = level.floor(x, z, 5); dog.vx = dog.vz = 0;
        human.x = x - 1.2; human.z = z + 0.5; human.y = level.floor(human.x, human.z, 5); human.vx = human.vz = 0;
        leash.reset(dog, handXZ());
      },
      render: () => renderer.render(scene, camera),
    };
  }
}
