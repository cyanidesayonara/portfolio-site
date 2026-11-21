/*
  /walk 3D game ("Path of Leash Resistance 1.5"):
  Three.js open-block Barcelona street with 3D Verlet leash physics,
  tetherball pole whirls, jumping, buried finds, El Drac statue easter egg,
  park soccer goal, stemma 4-stem mixer, and a live playable 128x128
  Coriolis LED wall built into the gallery facade.
*/
import * as THREE from 'three';
import { CoriolisSimulator, type SimKey, type SimCommand } from '../coriolis/sim';
import { WalkSound3D, type StemName } from './audio3d';
import {
  buildWorld3D,
  WORLD_W,
  CURB_Z,
  BIKE_Z0,
  BIKE_Z1,
  ROAD_Z0,
  ROAD_Z1,
  PARK_X,
  type StopDef3D,
  type CylinderSolid,
} from './world3d';

export type WeatherMode = 'day' | 'calima' | 'rain' | 'night';
export type CameraMode = 'classic' | 'follow' | 'plaza';

const ROPE_N = 18;
const ROPE_LEN = 6.2;
const DOG_R = 0.42;
const HUMAN_R = 0.56;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const MOVE_MAP: Record<string, { x: number; z: number }> = {
  ArrowUp: { x: 0, z: -1 }, KeyW: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: 1 }, KeyS: { x: 0, z: 1 },
  ArrowLeft: { x: -1, z: 0 }, KeyA: { x: -1, z: 0 },
  ArrowRight: { x: 1, z: 0 }, KeyD: { x: 1, z: 0 },
};

const CORIOLIS_KEYMAP: Record<string, SimKey> = {
  ArrowUp: 'Up', KeyW: 'Up',
  ArrowDown: 'Down', KeyS: 'Down',
  ArrowLeft: 'Left', KeyA: 'Left',
  ArrowRight: 'Right', KeyD: 'Right',
  Enter: 'Select',
  Backspace: 'Back',
};

export function startWalk3D(root: HTMLElement) {
  const host = root.querySelector<HTMLElement>('[data-stage]');
  const captionEl = root.querySelector<HTMLElement>('[data-caption]');
  const promptEl = root.querySelector<HTMLElement>('[data-prompt]');
  const toastEl = root.querySelector<HTMLElement>('[data-toast]');
  const hudPeeFill = root.querySelector<HTMLElement>('[data-pee-fill]');
  const hudPatFill = root.querySelector<HTMLElement>('[data-pat-fill]');
  const hudLeashEl = root.querySelector<HTMLElement>('[data-leash-badge]');
  const hudStatsEl = root.querySelector<HTMLElement>('[data-stats]');
  const goalsEl = root.querySelector<HTMLElement>('[data-goals]');
  const goalsListEl = root.querySelector<HTMLElement>('[data-goals-list]');
  const stemmaPanel = root.querySelector<HTMLElement>('[data-stemma-panel]');
  const coriolisPanel = root.querySelector<HTMLElement>('[data-coriolis-panel]');
  const soundBtn = root.querySelector<HTMLButtonElement>('[data-sound]');
  const fullBtn = root.querySelector<HTMLButtonElement>('[data-fullscreen]');
  const camBtn = root.querySelector<HTMLButtonElement>('[data-camera]');
  const weatherBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-weather]')];
  const links = new Map([...root.querySelectorAll<HTMLAnchorElement>('[data-stop]')].map((a) => [a.dataset.stop ?? '', a]));

  if (!host) return;

  // ---- Three.js Renderer, Scene & Lighting -----------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd0ee);
  scene.fog = new THREE.Fog(0x9fd0ee, 42, 108);

  const camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.2, 160);
  camera.position.set(12, 12, 20);

  const hemi = new THREE.HemisphereLight(0xfff5e4, 0x3b4860, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2dc, 1.5);
  sun.position.set(18, 28, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  scene.add(sun);
  scene.add(sun.target);

  // ---- Embedded Live Coriolis Simulator Texture ------------------------------------
  const coriolisCanvas = document.createElement('canvas');
  coriolisCanvas.width = 512;
  coriolisCanvas.height = 512;
  const coriolisCtx = coriolisCanvas.getContext('2d')!;
  const coriolisSim = new CoriolisSimulator('coriolis');
  const coriolisTex = new THREE.CanvasTexture(coriolisCanvas);
  coriolisTex.colorSpace = THREE.SRGBColorSpace;
  coriolisTex.magFilter = THREE.NearestFilter;
  coriolisTex.minFilter = THREE.LinearFilter;

  const world = buildWorld3D(scene, coriolisTex);
  const sound = new WalkSound3D();

  // ---- 3D Characters: Millie, Human, Verlet Rope -----------------------------------
  const dogGroup = new THREE.Group();
  const dogBody = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.6 }));
  dogBody.position.y = 0.34;
  dogBody.castShadow = true;
  dogGroup.add(dogBody);
  const dogHead = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.34), new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.6 }));
  dogHead.position.set(0.45, 0.5, 0);
  dogHead.castShadow = true;
  dogGroup.add(dogHead);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.18), new THREE.MeshStandardMaterial({ color: 0x2a2a32 }));
  snout.position.set(0.66, 0.44, 0);
  dogGroup.add(snout);
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.38), new THREE.MeshStandardMaterial({ color: 0xe5487a }));
  collar.position.set(0.28, 0.44, 0);
  dogGroup.add(collar);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x1b1b1f }));
  tail.position.set(-0.5, 0.48, 0);
  tail.rotation.z = 0.5;
  dogGroup.add(tail);
  const dogLegs = [[-0.25, -0.13], [-0.25, 0.13], [0.25, -0.13], [0.25, 0.13]].map(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.12), new THREE.MeshStandardMaterial({ color: 0x1b1b1f }));
    leg.position.set(lx, 0.12, lz);
    dogGroup.add(leg);
    return leg;
  });
  scene.add(dogGroup);

  const dogShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.48, 16),
    new THREE.MeshBasicMaterial({ color: 0x0b1430, transparent: true, opacity: 0.25 }),
  );
  dogShadow.rotation.x = -Math.PI / 2;
  scene.add(dogShadow);

  const humanGroup = new THREE.Group();
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x3a4a75, roughness: 0.75 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.42), coatMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  humanGroup.add(torso);
  const hHead = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe3b996 }));
  hHead.position.y = 1.62;
  hHead.castShadow = true;
  humanGroup.add(hHead);
  const hHair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), new THREE.MeshStandardMaterial({ color: 0x4a3122 }));
  hHair.position.set(-0.02, 1.66, 0);
  humanGroup.add(hHair);
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.2), new THREE.MeshStandardMaterial({ color: 0xe9f6ff, emissive: 0x7fd4ff, emissiveIntensity: 0.9 }));
  phone.position.set(0.36, 1.15, 0.08);
  humanGroup.add(phone);
  const phoneGlow = new THREE.PointLight(0x8fd6ff, 0, 4);
  phoneGlow.position.set(0.45, 1.25, 0.08);
  humanGroup.add(phoneGlow);
  const hLegs = [[-0.08, -0.11], [-0.08, 0.11]].map(([lx, lz]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.16), new THREE.MeshStandardMaterial({ color: 0x252b38 }));
    l.position.set(lx, 0.34, lz);
    l.castShadow = true;
    humanGroup.add(l);
    return l;
  });
  scene.add(humanGroup);

  // 3D Rope segments
  const ropeSegGeo = new THREE.CylinderGeometry(0.036, 0.036, 1, 6);
  const ropeSegMat = new THREE.MeshStandardMaterial({ color: 0xd9403a, roughness: 0.5 });
  const ropeSegs = Array.from({ length: ROPE_N }, () => {
    const m = new THREE.Mesh(ropeSegGeo, ropeSegMat);
    m.castShadow = true;
    scene.add(m);
    return m;
  });

  // ---- Dynamic props: Bones, Soccer ball, Pigeons, Vehicles, NPC dog, Rain, Marks ----
  const bonePositions = [
    [17, 2.2], [38, 3.0], [67, 2.0], [97.5, 2.5], [114, -2.5],
  ];
  const bones = bonePositions.map(([bx, bz]) => {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.14), new THREE.MeshStandardMaterial({ color: 0xf4f1ea, emissive: 0xffb020, emissiveIntensity: 0.2 }));
    g.add(shaft);
    for (const [ox, oz] of [[-0.22, -0.09], [-0.22, 0.09], [0.22, -0.09], [0.22, 0.09]]) {
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), shaft.material);
      k.position.set(ox, 0, oz);
      g.add(k);
    }
    g.position.set(bx, world.floorHeight(bx, bz) + 0.35, bz);
    scene.add(g);
    return { x: bx, z: bz, got: false, mesh: g };
  });

  // Soccer ball in the park
  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.4 }),
  );
  ballMesh.castShadow = true;
  scene.add(ballMesh);
  const ball = { x: 115, z: 2.5, vx: 0, vz: 0 };

  // Pigeons on Plaça del Sol
  const pigeons = Array.from({ length: 8 }, (_, i) => {
    const hx = 51 + (i % 4) * 3.5 + (i > 3 ? 1.2 : 0);
    const hz = 2.6 + Math.floor(i / 4) * 2.2;
    const m = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: 0x8a92a3 }));
    b.scale.set(1.3, 0.9, 0.9);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshStandardMaterial({ color: 0x4d5669 }));
    h.position.set(0.16, 0.1, 0);
    m.add(b, h);
    m.position.set(hx, 0.26, hz);
    scene.add(m);
    return { x: hx, y: 0.26, z: hz, hx, hz, flying: false, vx: 0, vy: 0, vz: 0, t: 0, mesh: m };
  });

  // Vehicles (bikes & cars)
  const vehicles: { kind: 'bike' | 'car'; x: number; z: number; dir: 1 | -1; speed: number; max: number; alerted: number; mesh: THREE.Group }[] = [];
  const makeVehicle = (kind: 'bike' | 'car', dir: 1 | -1, startX: number) => {
    const g = new THREE.Group();
    const col = [0xe5487a, 0x1fc9b7, 0xffb020, 0xf4f1ea, 0x3a4a75][(Math.random() * 5) | 0];
    if (kind === 'bike') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.2), new THREE.MeshStandardMaterial({ color: col }));
      frame.position.y = 0.55;
      const rider = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.85, 0.38), new THREE.MeshStandardMaterial({ color: 0x14203d }));
      rider.position.y = 1.15;
      g.add(frame, rider);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.85, 1.85), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.2 }));
      body.position.y = 0.55;
      body.castShadow = true;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 1.55), new THREE.MeshStandardMaterial({ color: 0x1a2645, roughness: 0.2 }));
      cabin.position.set(-0.2, 1.25, 0);
      g.add(body, cabin);
    }
    const z = kind === 'bike' ? (dir === 1 ? BIKE_Z0 + 0.9 : BIKE_Z1 - 0.9) : (dir === 1 ? ROAD_Z1 - 1.9 : ROAD_Z0 + 1.9);
    g.position.set(startX, 0, z);
    g.rotation.y = dir === 1 ? 0 : Math.PI;
    scene.add(g);
    const max = kind === 'bike' ? 7.5 : 10.5;
    vehicles.push({ kind, x: startX, z, dir, speed: max, max, alerted: 0, mesh: g });
  };
  makeVehicle('bike', 1, 18);
  makeVehicle('bike', -1, 78);
  makeVehicle('car', 1, 12);
  makeVehicle('car', -1, 95);

  // NPC dog walker
  const npcWalker = {
    x: 34, z: 3.6, dir: 1 as 1 | -1, greeted: false,
    mesh: new THREE.Group(),
    petMesh: new THREE.Group(),
  };
  {
    const nb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.36), new THREE.MeshStandardMaterial({ color: 0xe5487a }));
    nb.position.y = 0.84;
    nb.castShadow = true;
    npcWalker.mesh.add(nb);
    scene.add(npcWalker.mesh);

    const pb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.32), new THREE.MeshStandardMaterial({ color: 0xc98b4a }));
    pb.position.y = 0.32;
    pb.castShadow = true;
    npcWalker.petMesh.add(pb);
    scene.add(npcWalker.petMesh);
  }

  // Rain streaks (shown when weather === 'rain')
  const RAIN_COUNT = 260;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_COUNT * 6);
  for (let i = 0; i < RAIN_COUNT; i++) {
    const rx = Math.random() * 44 - 22;
    const ry = Math.random() * 14;
    const rz = Math.random() * 30 - 14;
    rainPos[i * 6] = rx; rainPos[i * 6 + 1] = ry; rainPos[i * 6 + 2] = rz;
    rainPos[i * 6 + 3] = rx - 0.12; rainPos[i * 6 + 4] = ry - 0.8; rainPos[i * 6 + 5] = rz;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainLines = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({ color: 0xc6e2ff, transparent: true, opacity: 0.55 }),
  );
  rainLines.visible = false;
  scene.add(rainLines);

  // Urine marks / dig puffs container
  const marks: THREE.Mesh[] = [];
  const particles: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; t: number }[] = [];

  // ---- Simulation State ------------------------------------------------------------
  const dog = {
    x: 11.4, y: 0.14, z: 3.8,
    vy: 0, onGround: true,
    heading: 0, moving: false, sprint: false, dig: false, peeing: 0, step: 0,
  };
  const human = {
    x: 8.4, y: 0.14, z: 3.1,
    heading: 0, walking: false, patience: 1.0, step: 0,
    whirl: null as null | { pole: CylinderSolid; angle: number; dir: 1 | -1; t: number; radius: number },
    ghost: 0, stuck: 0,
  };
  const rope = Array.from({ length: ROPE_N + 1 }, (_, i) => {
    const t = i / ROPE_N;
    return {
      x: human.x + (dog.x - human.x) * t,
      y: human.y + 0.8 * (1 - t) + 0.4 * t,
      z: human.z + (dog.z - human.z) * t,
      px: 0, py: 0, pz: 0,
    };
  });
  rope.forEach((n) => { n.px = n.x; n.py = n.y; n.pz = n.z; });

  let weather: WeatherMode = 'day';
  let camMode: CameraMode = 'classic';
  let coriolisFocused = false;
  let stemmaOpen = false;
  let offLeash = false;
  let clippedInPark = false;
  let pee = 0.75;
  let bonesGot = 0;
  let findsGot = 0;
  let marked = 0;
  let whirls = 0;
  let dragonAwake = false;
  let goalsOpen = false;
  let nearStop: StopDef3D | null = null;
  let toastTimer = 0;
  let simTimeMs = 0;
  let windAccum = 0;
  let lastPole: CylinderSolid | null = null;

  const goals = {
    mark: false,
    pigeons: false,
    whirl: false,
    finds: false,
    soccer: false,
    coriolis: false,
  };

  const held = new Set<string>();
  const camTargetPos = new THREE.Vector3(10.5, 11.5, 17.5);
  const camTargetLook = new THREE.Vector3(11.4, 0.8, 3.0);
  const currentLook = new THREE.Vector3(11.4, 0.8, 3.0);

  const showToast = (msg: string, sec = 2.4) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    toastTimer = sec;
  };

  const completeGoal = (k: keyof typeof goals, label: string) => {
    if (goals[k]) return;
    goals[k] = true;
    showToast(`Goal complete: ${label}`, 2.6);
    sound.goal();
    renderGoalsList();
  };

  const renderGoalsList = () => {
    if (!goalsListEl) return;
    const rows: [keyof typeof goals, string][] = [
      ['mark', 'Mark 5 lampposts, trees or hydrants (Q)'],
      ['pigeons', 'Scatter the pigeons in Plaça del Sol (E)'],
      ['whirl', 'Wind the leash around a lamppost for a Pole Whirl'],
      ['finds', 'Dig up all 3 buried finds from dirt mounds (Space)'],
      ['soccer', 'Score a goal in the off-leash park'],
      ['coriolis', 'Play a scene or game on the Coriolis LED wall (X)'],
    ];
    goalsListEl.innerHTML = rows
      .map(([k, txt]) => `<li class="${goals[k] ? 'done' : ''}"><span>${goals[k] ? '✓' : '○'}</span> ${txt}</li>`)
      .join('');
  };
  renderGoalsList();

  // ---- Weather / Sky Switcher ------------------------------------------------------
  const applyWeather = (mode: WeatherMode) => {
    weather = mode;
    weatherBtns.forEach((b) => b.classList.toggle('active', b.dataset.weather === mode));
    const isNight = mode === 'night';
    const isRain = mode === 'rain';
    const isCalima = mode === 'calima';

    const skyCol = isNight ? 0x0b1430 : isCalima ? 0xd9a86c : isRain ? 0x6f7e91 : 0x9fd0ee;
    scene.background = new THREE.Color(skyCol);
    scene.fog = new THREE.Fog(skyCol, isCalima ? 24 : 40, isCalima ? 76 : 112);

    sun.color.setHex(isNight ? 0x7a96d4 : isCalima ? 0xffcb8c : isRain ? 0xc2d0e0 : 0xfff2dc);
    sun.intensity = isNight ? 0.42 : isRain ? 0.85 : 1.5;
    hemi.intensity = isNight ? 0.35 : isRain ? 0.7 : 0.9;

    world.lampLights.forEach((l) => { l.intensity = isNight ? 5.5 : 0; });
    world.lampBulbs.forEach((b) => {
      (b.material as THREE.MeshStandardMaterial).emissiveIntensity = isNight ? 2.4 : 0.15;
    });
    world.windowMats.forEach((m) => { m.emissiveIntensity = isNight ? 1.15 : 0; });
    phoneGlow.intensity = isNight ? 1.8 : 0;
    rainLines.visible = isRain;
    coriolisSim.settings.nightMode = isNight;
  };
  applyWeather('day');

  // ---- Physics & Collision ---------------------------------------------------------
  const pushOut = (p: { x: number; y: number; z: number }, r: number, jumpClear = 0) => {
    const fy = world.floorHeight(p.x, p.z);
    for (const c of world.cylinders) {
      if (jumpClear > c.h + 0.1) continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz), min = c.r + r;
      if (d < min && d > 1e-4) {
        p.x = c.x + (dx / d) * min;
        p.z = c.z + (dz / d) * min;
      }
    }
    for (const b of world.boxes) {
      if (b.kind !== 'building' && b.kind !== 'wall' && jumpClear > b.h + 0.1) continue;
      const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
      const dx = p.x - cx, dz = p.z - cz;
      const d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 1e-4) {
          p.x = cx + (dx / d) * r;
          p.z = cz + (dz / d) * r;
        } else {
          p.z = b.z1 + r;
        }
      }
    }
    p.x = clamp(p.x, r, WORLD_W - r);
    const minZ = p.x > 48 && p.x < 65 ? -4.8 : p.x > PARK_X + 0.5 ? -5.8 : 0.3;
    p.z = clamp(p.z, minZ, ROAD_Z1 - r);
    return fy;
  };

  const solveRope = () => {
    const handX = human.x + Math.cos(human.heading) * 0.25;
    const handY = human.y + 1.02;
    const handZ = human.z + Math.sin(human.heading) * 0.25;
    const colX = dog.x + Math.cos(dog.heading) * 0.28;
    const colY = dog.y + 0.45;
    const colZ = dog.z + Math.sin(dog.heading) * 0.28;

    rope[0].x = handX; rope[0].y = handY; rope[0].z = handZ;
    rope[ROPE_N].x = colX; rope[ROPE_N].y = colY; rope[ROPE_N].z = colZ;

    for (let i = 1; i < ROPE_N; i++) {
      const n = rope[i];
      const vx = (n.x - n.px) * 0.72;
      const vy = (n.y - n.py) * 0.65 - 0.008;
      const vz = (n.z - n.pz) * 0.72;
      n.px = n.x; n.py = n.y; n.pz = n.z;
      n.x += vx; n.y += vy; n.z += vz;
      const fy = world.floorHeight(n.x, n.z) + 0.06;
      if (n.y < fy) n.y = fy;
    }

    const seg = ROPE_LEN / ROPE_N;
    for (let iter = 0; iter < 6; iter++) {
      rope[0].x = handX; rope[0].y = handY; rope[0].z = handZ;
      rope[ROPE_N].x = colX; rope[ROPE_N].y = colY; rope[ROPE_N].z = colZ;
      for (let i = 0; i < ROPE_N; i++) {
        const a = rope[i], b = rope[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const d = Math.hypot(dx, dy, dz) || 1e-4;
        const diff = (d - seg) / d;
        const wa = i === 0 ? 0 : 0.5;
        const wb = i + 1 === ROPE_N ? 0 : 0.5;
        const ws = wa + wb || 1;
        if (wa) { a.x += dx * diff * (wa / ws); a.y += dy * diff * (wa / ws); a.z += dz * diff * (wa / ws); }
        if (wb) { b.x -= dx * diff * (wb / ws); b.y -= dy * diff * (wb / ws); b.z -= dz * diff * (wb / ws); }
      }
      // Segment-vs-cylinder pole wrapping
      for (let i = 1; i < ROPE_N; i++) {
        const n = rope[i];
        for (const c of world.cylinders) {
          if (!c.canWhirl) continue;
          const dx = n.x - c.x, dz = n.z - c.z;
          const d = Math.hypot(dx, dz);
          const min = c.r + 0.05;
          if (d < min && d > 1e-4) {
            n.x = c.x + (dx / d) * min;
            n.z = c.z + (dz / d) * min;
          }
        }
      }
    }
  };

  // ---- Actions (Jump, Mark, Dig, Bark, Whirl, Interact) -------------------------
  const spawnBurst = (x: number, y: number, z: number, colorHex: number, count = 10) => {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.14, 0.14),
        new THREE.MeshBasicMaterial({ color: colorHex }),
      );
      m.position.set(x, y, z);
      scene.add(m);
      const a = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 3.0;
      particles.push({ mesh: m, vx: Math.cos(a) * spd, vy: 2.2 + Math.random() * 2.5, vz: Math.sin(a) * spd, t: 0.65 });
    }
  };

  const doJump = () => {
    if (!dog.onGround) return;
    dog.vy = 5.6;
    dog.onGround = false;
    sound.jump();
  };

  const doMark = () => {
    if (dog.peeing > 0) return;
    if (pee < 0.2) { showToast('Out of pee! Drink from a bowl or the park fountain', 2.2); return; }
    let best: CylinderSolid | null = null, bd = Infinity;
    for (const c of world.cylinders) {
      if (!c.canPee) continue;
      const d = Math.hypot(c.x - dog.x, c.z - dog.z) - c.r - DOG_R;
      if (d < 1.3 && d < bd) { best = c; bd = d; }
    }
    dog.peeing = 0.7;
    pee = Math.max(0, pee - 0.25);
    sound.pee();
    const mx = best ? best.x + (dog.x - best.x) * 0.6 : dog.x;
    const mz = best ? best.z + (dog.z - best.z) * 0.6 : dog.z;
    const stain = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd14a, transparent: true, opacity: 0.85 }),
    );
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(mx, world.floorHeight(mx, mz) + 0.025, mz);
    scene.add(stain);
    marks.push(stain);
    if (marks.length > 30) scene.remove(marks.shift()!);
    if (best && !best.marked) {
      best.marked = true;
      marked++;
      showToast(`Marked! (${marked}/5)`, 1.4);
      if (marked >= 5) completeGoal('mark', 'Mark 5 spots');
    }
  };

  const doDigAction = () => {
    for (const m of world.mounds) {
      if (!m.dug && Math.hypot(m.x - dog.x, m.z - dog.z) < 1.8) {
        m.dug = true;
        m.collected = true;
        m.lootMesh.visible = true;
        findsGot++;
        sound.dig();
        sound.pickup();
        spawnBurst(m.x, 0.35, m.z, 0x7a5638, 14);
        showToast(`Dug up: ${m.name}! (${findsGot}/3)`, 2.6);
        if (findsGot >= 3) completeGoal('finds', 'Dig up 3 buried finds');
        return;
      }
    }
  };

  const doBark = () => {
    sound.bark();
    spawnBurst(dog.x, dog.y + 0.6, dog.z, 0xffb020, 6);
    let scared = 0;
    for (const p of pigeons) {
      if (!p.flying && Math.hypot(p.x - dog.x, p.z - dog.z) < 7.0) {
        p.flying = true;
        p.t = 0;
        const dx = p.x - dog.x, dz = p.z - dog.z;
        const d = Math.hypot(dx, dz) || 1;
        p.vx = (dx / d) * 6.5 + (Math.random() - 0.5) * 2;
        p.vy = 3.8 + Math.random() * 1.6;
        p.vz = (dz / d) * 6.5 + (Math.random() - 0.5) * 2;
        scared++;
      }
    }
    if (scared > 0) {
      sound.flutter();
      completeGoal('pigeons', 'Scatter the pigeons');
    }
    if (!dragonAwake && Math.hypot(dog.x - world.dragonPos.x, dog.z - world.dragonPos.z) < 5.0) {
      dragonAwake = true;
      world.dragonJet.visible = true;
      world.dragonHalo.intensity = 5.5;
      sound.dragon();
      spawnBurst(world.dragonPos.x - 1.5, 1.4, world.dragonPos.z, 0x1fc9b7, 16);
      showToast('EL DRAC AWAKENS! +5', 2.8);
    }
  };

  const doPickup = () => {
    for (const b of bones) {
      if (!b.got && Math.hypot(b.x - dog.x, b.z - dog.z) < 1.5) {
        b.got = true;
        b.mesh.visible = false;
        bonesGot++;
        sound.pickup();
        showToast(`Bone picked up! (${bonesGot}/${bones.length})`, 1.6);
        return;
      }
    }
  };

  const toggleCoriolisFocus = () => {
    coriolisFocused = !coriolisFocused;
    coriolisSim.clearHeld();
    coriolisPanel?.classList.toggle('open', coriolisFocused);
    if (coriolisFocused) {
      stemmaOpen = false;
      stemmaPanel?.classList.remove('open');
      completeGoal('coriolis', 'Play the Coriolis LED wall');
      showToast('Coriolis LED Wall active (X or Esc to step back)', 2.4);
    }
  };

  const toggleStemmaMixer = () => {
    stemmaOpen = !stemmaOpen;
    stemmaPanel?.classList.toggle('open', stemmaOpen);
    if (stemmaOpen && !sound.on) {
      sound.enable();
      if (soundBtn) {
        soundBtn.setAttribute('aria-pressed', 'true');
        soundBtn.textContent = 'Sound on';
      }
    }
  };

  const doInteract = () => {
    if (coriolisFocused) { toggleCoriolisFocus(); return; }
    if (Math.hypot(dog.x - (world.coriolisStop.x + world.coriolisStop.w * 0.58), dog.z - 2.0) < 5.8) {
      toggleCoriolisFocus();
      return;
    }
    if (Math.hypot(dog.x - world.stemmaStop.doorX, dog.z - 2.0) < 5.2) {
      toggleStemmaMixer();
      return;
    }
    if (stemmaOpen) toggleStemmaMixer();
  };

  // ---- Per-frame Simulation Step --------------------------------------------------
  const update = (dt: number) => {
    simTimeMs += dt * 1000;
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEl?.classList.remove('show');
    }

    // Update embedded Coriolis simulator texture
    if (coriolisSim.tick(simTimeMs)) {
      coriolisSim.renderToCanvas(coriolisCtx, 4, 1);
      coriolisTex.needsUpdate = true;
    }

    // Dog movement (paused while controlling the Coriolis wall)
    let ix = 0, iz = 0;
    if (!coriolisFocused) {
      for (const k of held) {
        const m = MOVE_MAP[k];
        if (m) { ix += m.x; iz += m.z; }
      }
    }
    const il = Math.hypot(ix, iz);
    if (il > 0) { ix /= il; iz /= il; }

    dog.sprint = held.has('ShiftLeft') || held.has('ShiftRight');
    dog.dig = held.has('Space');
    dog.moving = il > 0;
    if (dog.peeing > 0) dog.peeing = Math.max(0, dog.peeing - dt);

    const speed = dog.dig ? 1.8 : dog.sprint ? 8.2 : 5.1;
    dog.x += ix * speed * dt;
    dog.z += iz * speed * dt;
    if (dog.moving) {
      const targetAngle = Math.atan2(iz, ix);
      let dAng = targetAngle - dog.heading;
      while (dAng > Math.PI) dAng -= Math.PI * 2;
      while (dAng < -Math.PI) dAng += Math.PI * 2;
      dog.heading += dAng * Math.min(1, dt * 14);
      dog.step += dt * (dog.sprint ? 22 : 14);
    }

    // Gravity + Jump height vs ground elevation
    const groundY = pushOut(dog, DOG_R, dog.y - world.floorHeight(dog.x, dog.z));
    if (!dog.onGround || dog.y > groundY + 0.01) {
      dog.vy -= 17.5 * dt;
      dog.y += dog.vy * dt;
      if (dog.y <= groundY) {
        dog.y = groundY;
        dog.vy = 0;
        dog.onGround = true;
      }
    } else {
      dog.y = groundY;
    }

    // Off-leash park gate logic
    const inPark = dog.x > PARK_X + 1.0 && dog.z < CURB_Z;
    if (!offLeash && inPark && !clippedInPark) {
      offLeash = true;
      showToast('OFF LEASH! Run free in the park!', 2.4);
      sound.pickup();
    } else if (offLeash && !inPark && Math.hypot(dog.x - human.x, dog.z - human.z) < 2.2) {
      offLeash = false;
      clippedInPark = false;
      showToast('Leash clipped back on', 1.6);
    } else if (!inPark) {
      clippedInPark = false;
    }

    // Human & Whirl logic
    if (human.whirl) {
      const w = human.whirl;
      w.t += dt;
      const omega = w.dir * 8.5;
      w.angle += omega * dt;
      human.x = w.pole.x + Math.cos(w.angle) * w.radius;
      human.z = w.pole.z + Math.sin(w.angle) * w.radius;
      human.heading = w.angle + w.dir * (Math.PI / 2);
      human.step += dt * 18;
      if (w.t > 1.25) {
        human.whirl = null;
        whirls++;
        showToast('POLE WHIRL! +5', 2.4);
        sound.whirl();
        completeGoal('whirl', 'Pull off a Pole Whirl');
      }
    } else {
      const hx0 = human.x, hz0 = human.z;
      if (!offLeash) {
        const dx = dog.x - human.x, dz = dog.z - human.z;
        const dist = Math.hypot(dx, dz) || 1;
        // Follow dog leisurely along sidewalk unless tugged hard
        const walkSpeed = dist > ROPE_LEN * 0.72 ? 3.9 : dist > 2.6 ? 2.4 : 0;
        human.walking = walkSpeed > 0;
        if (walkSpeed > 0) {
          human.x += (dx / dist) * walkSpeed * dt;
          human.z += (dz / dist) * walkSpeed * dt;
          human.heading = Math.atan2(dz, dx);
          human.step += dt * 9;
        }
        // Elastic leash constraint between dog and human
        const ndx = dog.x - human.x, ndz = dog.z - human.z;
        const nd = Math.hypot(ndx, ndz) || 1;
        if (nd > ROPE_LEN) {
          const excess = nd - ROPE_LEN;
          const mDog = dog.dig ? 0.05 : 0.75;
          const mHum = dog.dig ? 0.95 : 0.25;
          dog.x -= (ndx / nd) * excess * mDog;
          dog.z -= (ndz / nd) * excess * mDog;
          human.x += (ndx / nd) * excess * mHum;
          human.z += (ndz / nd) * excess * mHum;
          human.patience = Math.max(0, human.patience - dt * 0.14);
        } else {
          human.patience = Math.min(1, human.patience + dt * 0.12);
        }
      } else {
        // Human waits by the park bench while Millie is off-leash
        const tx = PARK_X + 3.2, tz = 5.2;
        const dx = tx - human.x, dz = tz - human.z, d = Math.hypot(dx, dz);
        if (d > 0.3) {
          human.walking = true;
          human.x += (dx / d) * 2.5 * dt;
          human.z += (dz / d) * 2.5 * dt;
          human.heading = Math.atan2(dz, dx);
          human.step += dt * 7;
        } else {
          human.walking = false;
        }
      }
      human.y = pushOut(human, HUMAN_R);
      const moved = Math.hypot(human.x - hx0, human.z - hz0);
      if (human.walking && moved < 0.01) human.stuck += dt;
      else human.stuck = 0;
      if (human.stuck > 0.6) { human.x = clamp(dog.x - 1.8, 1, WORLD_W - 2); human.stuck = 0; }
    }

    // Winding angle detection around whirlable poles for Pole Whirl!
    if (!offLeash && !human.whirl) {
      let bestPole: CylinderSolid | null = null, bd = 4.2;
      for (const c of world.cylinders) {
        if (!c.canWhirl) continue;
        const d = Math.hypot(human.x - c.x, human.z - c.z);
        if (d < bd) { bd = d; bestPole = c; }
      }
      if (bestPole && bestPole === lastPole) {
        const curA = Math.atan2(dog.z - bestPole.z, dog.x - bestPole.x);
        const hA = Math.atan2(human.z - bestPole.z, human.x - bestPole.x);
        const rel = curA - hA;
        if (dog.moving && dog.sprint && Math.hypot(dog.x - human.x, dog.z - human.z) > ROPE_LEN * 0.88) {
          windAccum += dt * (Math.sin(rel) >= 0 ? 1 : -1) * 2.2;
          if (Math.abs(windAccum) > 1.75) {
            human.whirl = {
              pole: bestPole,
              angle: hA,
              dir: windAccum >= 0 ? 1 : -1,
              t: 0,
              radius: clamp(bd, 1.35, 2.2),
            };
            windAccum = 0;
          }
        }
      } else {
        lastPole = bestPole;
        windAccum = 0;
      }
    }

    // Rope update & mesh positioning
    if (!offLeash) {
      solveRope();
      for (let i = 0; i < ROPE_N; i++) {
        const a = rope[i], b = rope[i + 1];
        const seg = ropeSegs[i];
        seg.visible = true;
        const vx = b.x - a.x, vy = b.y - a.y, vz = b.z - a.z;
        const len = Math.hypot(vx, vy, vz) || 0.001;
        seg.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        seg.scale.set(1, len, 1);
        seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(vx / len, vy / len, vz / len));
      }
    } else {
      ropeSegs.forEach((s) => { s.visible = false; });
    }

    // Auto-collect bones / drink water
    for (const b of bones) {
      if (!b.got) {
        b.mesh.rotation.y += dt * 2.2;
        if (Math.hypot(b.x - dog.x, b.z - dog.z) < 0.95) doPickup();
      }
    }
    for (const bw of [...world.bowls, world.fountain]) {
      if (Math.hypot(bw.x - dog.x, bw.z - dog.z) < 1.15 && pee < 0.98) {
        pee = 1.0;
        sound.slurp();
        showToast('Refreshed! Mark tank full', 1.6);
      }
    }

    // Loot rotation on dug mounds
    for (const m of world.mounds) {
      if (m.dug) m.lootMesh.rotation.y += dt * 2.4;
    }

    // Soccer ball physics & goal check
    const bDist = Math.hypot(ball.x - dog.x, ball.z - dog.z);
    if (bDist < 0.78 && bDist > 1e-4) {
      const kick = dog.sprint ? 9.8 : 6.4;
      ball.vx = ((ball.x - dog.x) / bDist) * kick;
      ball.vz = ((ball.z - dog.z) / bDist) * kick;
    }
    ball.vx *= Math.max(0, 1 - dt * 1.8);
    ball.vz *= Math.max(0, 1 - dt * 1.8);
    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;
    if (ball.x < PARK_X + 1.2) { ball.x = PARK_X + 1.2; ball.vx = Math.abs(ball.vx) * 0.7; }
    if (ball.x > WORLD_W - 1.0) { ball.x = WORLD_W - 1.0; ball.vx = -Math.abs(ball.vx) * 0.7; }
    if (ball.z < -4.8) { ball.z = -4.8; ball.vz = Math.abs(ball.vz) * 0.7; }
    if (ball.z > CURB_Z - 0.6) { ball.z = CURB_Z - 0.6; ball.vz = -Math.abs(ball.vz) * 0.7; }
    ballMesh.position.set(ball.x, 0.46, ball.z);

    if (ball.x >= world.goalPos.x - 0.6 && Math.abs(ball.z - world.goalPos.z) < world.goalPos.halfW) {
      sound.goal();
      spawnBurst(ball.x, 1.0, ball.z, 0x5eea8c, 18);
      showToast('GOOOOL! +5', 2.6);
      completeGoal('soccer', 'Score a goal in the park');
      ball.x = 115; ball.z = 2.5; ball.vx = 0; ball.vz = 0;
    }

    // Pigeons update
    for (const p of pigeons) {
      if (p.flying) {
        p.t += dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vy -= 1.8 * dt;
        if (p.y < 0.26) p.y = 0.26;
        if (p.t > 5.5 && Math.hypot(p.hx - dog.x, p.hz - dog.z) > 8) {
          p.flying = false; p.x = p.hx; p.y = 0.26; p.z = p.hz;
        }
      } else {
        p.x = p.hx + Math.sin(simTimeMs * 0.004 + p.hx) * 0.35;
      }
      p.mesh.position.set(p.x, p.y, p.z);
    }

    // Traffic update
    for (const v of vehicles) {
      const aheadDog = (dog.x - v.x) * v.dir;
      const aheadHum = (human.x - v.x) * v.dir;
      const closeDog = Math.abs(dog.z - v.z) < 1.5 && aheadDog > 0 && aheadDog < 6.5;
      const closeHum = Math.abs(human.z - v.z) < 1.5 && aheadHum > 0 && aheadHum < 6.5;
      v.alerted -= dt;
      if ((closeDog || closeHum) && v.alerted <= 0) {
        v.alerted = 2.8;
        if (Math.abs(v.x - dog.x) < 22) {
          if (v.kind === 'car') sound.honk(); else sound.bell();
        }
      }
      const target = closeDog || closeHum ? 0 : v.max;
      v.speed += clamp(target - v.speed, -14 * dt, 7 * dt);
      v.x += v.dir * v.speed * dt;
      if (v.x > WORLD_W + 8) v.x = -8;
      if (v.x < -8) v.x = WORLD_W + 8;
      v.mesh.position.set(v.x, 0, v.z);
    }

    // NPC Dog Walker
    npcWalker.x += npcWalker.dir * 1.4 * dt;
    if (npcWalker.x > 64) npcWalker.dir = -1;
    if (npcWalker.x < 12) npcWalker.dir = 1;
    npcWalker.mesh.position.set(npcWalker.x, 0.14, npcWalker.z);
    npcWalker.petMesh.position.set(npcWalker.x + npcWalker.dir * 1.2, 0.14, npcWalker.z + 0.65);
    npcWalker.petMesh.rotation.y = npcWalker.dir === 1 ? 0 : Math.PI;
    if (!npcWalker.greeted && Math.hypot(npcWalker.x - dog.x, npcWalker.z - dog.z) < 2.2) {
      npcWalker.greeted = true;
      showToast('Other dog: Woof!', 1.8);
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.t -= dt;
      pt.vy -= 9 * dt;
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      if (pt.t <= 0) { scene.remove(pt.mesh); particles.splice(i, 1); }
    }

    // Rain follow & animate
    if (weather === 'rain') {
      rainLines.position.set(dog.x, 0, dog.z);
      const arr = rainGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < RAIN_COUNT; i++) {
        arr[i * 6 + 1] -= 18 * dt;
        arr[i * 6 + 4] -= 18 * dt;
        if (arr[i * 6 + 1] < 0) {
          const ny = 12 + Math.random() * 4;
          arr[i * 6 + 1] = ny;
          arr[i * 6 + 4] = ny - 0.8;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // El Drac water jet spin
    if (dragonAwake) {
      world.dragonJet.scale.y = 0.85 + Math.sin(simTimeMs * 0.015) * 0.25;
    }

    // Update 3D character poses
    dogGroup.position.set(dog.x, dog.y, dog.z);
    dogGroup.rotation.y = -dog.heading;
    dogBody.position.y = dog.dig ? 0.26 : 0.34;
    tail.rotation.y = Math.sin(simTimeMs * (dog.moving ? 0.022 : 0.008)) * 0.45;
    dogLegs.forEach((leg, i) => {
      leg.rotation.z = dog.moving ? Math.sin(dog.step + (i % 2 ? Math.PI : 0)) * 0.55 : 0;
    });
    dogShadow.position.set(dog.x, groundY + 0.02, dog.z);
    const shScale = clamp(1 - (dog.y - groundY) * 0.25, 0.45, 1);
    dogShadow.scale.set(shScale, shScale, 1);

    humanGroup.position.set(human.x, human.y, human.z);
    humanGroup.rotation.y = -human.heading;
    hLegs.forEach((leg, i) => {
      leg.rotation.z = human.walking || human.whirl ? Math.sin(human.step + (i ? Math.PI : 0)) * 0.45 : 0;
    });

    // Near Stop & Contextual Prompt
    let found: StopDef3D | null = null;
    for (const s of world.stops) {
      const dist = Math.hypot(dog.x - s.doorX, dog.z - s.doorZ);
      if (dist < (s.id === 'park' ? 4.2 : 2.6)) found = s;
    }
    if (found !== nearStop) {
      if (nearStop) links.get(nearStop.id)?.classList.remove('near');
      if (found) links.get(found.id)?.classList.add('near');
      nearStop = found;
    }

    // HUD & contextual prompt updates
    if (hudPeeFill) hudPeeFill.style.width = `${Math.round(pee * 100)}%`;
    if (hudPatFill) hudPatFill.style.width = `${Math.round(human.patience * 100)}%`;
    if (hudLeashEl) hudLeashEl.textContent = offLeash ? 'OFF LEASH' : human.whirl ? 'WHIRL!' : 'LEASHED';
    if (hudStatsEl) {
      const doneCount = Object.values(goals).filter(Boolean).length;
      hudStatsEl.textContent = `Bones ${bonesGot}/${bones.length} · Finds ${findsGot}/3 · Goals ${doneCount}/6`;
    }

    if (promptEl) {
      let pText = '';
      if (coriolisFocused) pText = 'Controlling Coriolis 128×128 LED Wall — Arrows / Enter / M Menu / X Exit';
      else if (Math.hypot(dog.x - (world.coriolisStop.x + world.coriolisStop.w * 0.58), dog.z - 2.0) < 5.5)
        pText = 'Press X to play the Coriolis 128×128 LED Wall · Enter to open Coriolis project';
      else if (Math.hypot(dog.x - world.stemmaStop.doorX, dog.z - 2.0) < 4.5)
        pText = 'Press X to toggle the stemma 4-Stem Music Mixer · Enter to open stemma project';
      else if (world.mounds.some((m) => !m.dug && Math.hypot(m.x - dog.x, m.z - dog.z) < 1.8))
        pText = 'Smells like treasure! Press Space to dig';
      else if (!dragonAwake && Math.hypot(dog.x - world.dragonPos.x, dog.z - world.dragonPos.z) < 4.5)
        pText = 'El Drac mosaic statue — Press E to bark!';
      else if (nearStop)
        pText = `At ${nearStop.label} — Press Enter to visit page`;
      promptEl.textContent = pText;
      promptEl.classList.toggle('show', pText.length > 0);
    }

    if (captionEl) {
      captionEl.textContent = coriolisFocused
        ? 'Live Coriolis Wall active — M opens the categorized launcher, Arrows steer Snake/Pong/Labyrinth.'
        : 'Walk the 3D Eixample street, wind lampposts for a Pole Whirl, dig buried finds, or play the Coriolis wall.';
    }

    // Camera Rig
    if (coriolisFocused) {
      const sx = world.coriolisStop.x + world.coriolisStop.w * 0.58;
      camTargetPos.set(sx, 3.3, 6.2);
      camTargetLook.set(sx, 3.3, 0.2);
    } else if (camMode === 'classic') {
      camTargetPos.set(dog.x - 1.5, dog.y + 11.5, dog.z + 13.5);
      camTargetLook.set(dog.x, dog.y + 0.6, dog.z - 0.8);
    } else if (camMode === 'follow') {
      camTargetPos.set(dog.x - Math.cos(dog.heading) * 6.5, dog.y + 3.6, dog.z - Math.sin(dog.heading) * 6.5 + 1.5);
      camTargetLook.set(dog.x + Math.cos(dog.heading) * 4.5, dog.y + 0.8, dog.z + Math.sin(dog.heading) * 4.5);
    } else {
      camTargetPos.set(dog.x + 2, 16.5, 23.0);
      camTargetLook.set(dog.x, 1.0, 2.5);
    }
    camera.position.lerp(camTargetPos, Math.min(1, dt * 6.5));
    currentLook.lerp(camTargetLook, Math.min(1, dt * 6.5));
    camera.lookAt(currentLook);

    // Move directional shadow frustum near Millie so shadows stay razor sharp across the whole street
    sun.position.set(dog.x + 14, 26, dog.z + 12);
    sun.target.position.set(dog.x, 0, dog.z);
    sun.target.updateMatrixWorld();
  };

  // ---- Input Handling --------------------------------------------------------------
  const handleKeyDown = (code: string, e?: KeyboardEvent) => {
    held.add(code);
    if (coriolisFocused) {
      if (code === 'Escape' || code === 'KeyX') { e?.preventDefault(); toggleCoriolisFocus(); return; }
      const ck = CORIOLIS_KEYMAP[code];
      if (ck) {
        e?.preventDefault();
        coriolisSim.setHeld(ck, true);
        coriolisSim.key(ck, simTimeMs);
        return;
      }
      if (code === 'KeyM') { e?.preventDefault(); coriolisSim.command('Menu', simTimeMs); return; }
      if (code === 'KeyS') { e?.preventDefault(); coriolisSim.command('Settings', simTimeMs); return; }
      if (code === 'KeyC') { e?.preventDefault(); coriolisSim.command('Overlay', simTimeMs); return; }
      if (code === 'Space') { e?.preventDefault(); coriolisSim.command('Next', simTimeMs); return; }
      if (code === 'KeyH') { e?.preventDefault(); coriolisSim.command('Home', simTimeMs); return; }
      if (code === 'KeyR') { e?.preventDefault(); coriolisSim.rotate(simTimeMs); return; }
      return;
    }

    if (MOVE_MAP[code] || code === 'Space' || code === 'Tab') e?.preventDefault();

    if (code === 'KeyV') doJump();
    else if (code === 'KeyQ' || code === 'Delete') doMark();
    else if (code === 'Space') doDigAction();
    else if (code === 'KeyE' || code === 'ControlLeft') doBark();
    else if (code === 'KeyG' || code === 'PageDown') doPickup();
    else if (code === 'KeyF' || code === 'End') {
      showToast('Good dog.', 1.4);
    }
    else if (code === 'KeyX') doInteract();
    else if (code === 'KeyC') cycleCamera();
    else if (code === 'Digit1') applyWeather('day');
    else if (code === 'Digit2') applyWeather('calima');
    else if (code === 'Digit3') applyWeather('rain');
    else if (code === 'Digit4') applyWeather('night');
    else if (code === 'Tab') {
      goalsOpen = !goalsOpen;
      goalsEl?.classList.toggle('open', goalsOpen);
    }
    else if (code === 'Enter' && nearStop) {
      location.href = nearStop.href;
    }
    else if (code === 'KeyR') {
      dog.x = 11.4; dog.y = 0.14; dog.z = 3.8; dog.vy = 0; dog.onGround = true;
      human.x = 8.4; human.y = 0.14; human.z = 3.1; human.whirl = null;
      offLeash = false;
      showToast('Back to the start of the block', 1.5);
    }
  };

  const handleKeyUp = (code: string) => {
    held.delete(code);
    const ck = CORIOLIS_KEYMAP[code];
    if (ck) coriolisSim.setHeld(ck, false);
  };

  const cycleCamera = () => {
    camMode = camMode === 'classic' ? 'follow' : camMode === 'follow' ? 'plaza' : 'classic';
    if (camBtn) camBtn.textContent = `Cam: ${camMode === 'classic' ? '3/4' : camMode === 'follow' ? 'Follow' : 'Plaza'}`;
  };

  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
    handleKeyDown(e.code, e);
  });
  window.addEventListener('keyup', (e) => handleKeyUp(e.code));
  window.addEventListener('blur', () => { held.clear(); coriolisSim.clearHeld(); });

  // Toolbar & Overlay Button Wiring
  soundBtn?.addEventListener('click', () => {
    if (sound.on) sound.disable();
    else sound.enable();
    soundBtn.setAttribute('aria-pressed', String(sound.on));
    soundBtn.textContent = sound.on ? 'Sound on' : 'Sound off';
  });

  fullBtn?.addEventListener('click', () => {
    if (document.fullscreenElement === root) void document.exitFullscreen();
    else if (root.requestFullscreen) void root.requestFullscreen();
  });

  camBtn?.addEventListener('click', cycleCamera);
  weatherBtns.forEach((b) => b.addEventListener('click', () => applyWeather(b.dataset.weather as WeatherMode)));

  root.querySelectorAll<HTMLButtonElement>('[data-stem]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.stem as StemName;
      const muted = sound.toggleStem(name);
      btn.classList.toggle('muted', muted);
      btn.setAttribute('aria-pressed', String(!muted));
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-c-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.cKey as SimKey;
      coriolisSim.setHeld(k, true);
      coriolisSim.key(k, simTimeMs);
      setTimeout(() => coriolisSim.setHeld(k, false), 120);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-c-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => {
      coriolisSim.command(btn.dataset.cCmd as SimCommand, simTimeMs);
    });
  });
  root.querySelector<HTMLButtonElement>('[data-c-exit]')?.addEventListener('click', () => {
    if (coriolisFocused) toggleCoriolisFocus();
  });
  root.querySelector<HTMLButtonElement>('[data-stemma-close]')?.addEventListener('click', () => {
    if (stemmaOpen) toggleStemmaMixer();
  });
  root.querySelector<HTMLButtonElement>('[data-goals-toggle]')?.addEventListener('click', () => {
    goalsOpen = !goalsOpen;
    goalsEl?.classList.toggle('open', goalsOpen);
  });

  // Touch / Mobile Action Buttons
  root.querySelectorAll<HTMLButtonElement>('[data-touch-key]').forEach((btn) => {
    const code = btn.dataset.touchKey!;
    const down = (e: Event) => { e.preventDefault(); handleKeyDown(code); };
    const up = () => handleKeyUp(code);
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  });

  // ---- Resize & Main Render Loop ---------------------------------------------------
  const resize = () => {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();

  let prev = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, Math.max(0.001, (now - prev) / 1000));
    prev = now;
    update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  update(1 / 60);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);

  // Deterministic test hook for headless checks (?walktest)
  if (location.search.includes('walktest')) {
    (window as unknown as Record<string, unknown>).__walk = {
      dog,
      human,
      world,
      coriolis: coriolisSim,
      get weather() { return weather; },
      get cameraMode() { return camMode; },
      get coriolisFocused() { return coriolisFocused; },
      get stemmaOpen() { return stemmaOpen; },
      get goals() { return { ...goals }; },
      get finds() { return findsGot; },
      get whirls() { return whirls; },
      get bones() { return bonesGot; },
      get pee() { return pee; },
      get offLeash() { return offLeash; },
      get near() { return nearStop?.id ?? null; },
      setWeather: applyWeather,
      teleportDog: (x: number, y: number, z: number) => { dog.x = x; dog.y = y; dog.z = z; },
      key: (code: string, down: boolean) => { if (down) handleKeyDown(code); else handleKeyUp(code); },
      tick: (frames = 1) => {
        for (let i = 0; i < frames; i++) update(1 / 60);
        renderer.render(scene, camera);
      },
    };
  }
}
