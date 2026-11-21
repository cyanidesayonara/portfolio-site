/*
  3D Eixample neighborhood geometry & layout for /walk (PoLR 1.5).
  Coordinates (world meters):
    X: 0 .. 132 (West -> East)
    Z: -8 .. 0  buildings/plaza back, 0 .. 7.8 sidewalk/park,
       7.8 .. 11.4 green bike lane, 11.4 .. 19.0 road
    Y: up (0 road, 0.14 sidewalk/park, 1.05 Mirador terrace)
*/
import * as THREE from 'three';

export interface StopDef3D {
  id: string;
  label: string;
  kind: string;
  href: string;
  color: string;
  x: number;
  w: number;
  zFront: number;
  doorX: number;
  doorZ: number;
}

export interface CylinderSolid {
  kind: 'lamp' | 'tree' | 'hydrant' | 'bollard' | 'table' | 'fountain' | 'dragon';
  x: number;
  z: number;
  r: number;
  h: number;
  canPee: boolean;
  canWhirl: boolean;
  marked: boolean;
}

export interface BoxSolid {
  kind: 'bench' | 'planter' | 'building' | 'fence' | 'wall';
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  h: number;
}

export interface DirtMound {
  id: string;
  name: string;
  x: number;
  z: number;
  dug: boolean;
  collected: boolean;
  mesh: THREE.Group;
  lootMesh: THREE.Group;
}

export interface World3D {
  stops: StopDef3D[];
  cylinders: CylinderSolid[];
  boxes: BoxSolid[];
  mounds: DirtMound[];
  bowls: { x: number; z: number }[];
  fountain: { x: number; z: number };
  parkX: number;
  coriolisStop: StopDef3D;
  stemmaStop: StopDef3D;
  dragonPos: { x: number; z: number };
  dragonGroup: THREE.Group;
  dragonJet: THREE.Mesh;
  dragonHalo: THREE.PointLight;
  goalPos: { x: number; z: number; halfW: number };
  lampLights: THREE.PointLight[];
  lampBulbs: THREE.Mesh[];
  windowMats: THREE.MeshStandardMaterial[];
  coriolisScreenMesh: THREE.Mesh;
  floorHeight: (x: number, z: number) => number;
  width: number;
}

export const WORLD_W = 132;
export const SIDEWALK_Z0 = 0;
export const CURB_Z = 7.8;
export const BIKE_Z0 = 7.8;
export const BIKE_Z1 = 11.4;
export const ROAD_Z0 = 11.4;
export const ROAD_Z1 = 19.0;
export const PARK_X = 102;

function makeSignTexture(
  title: string,
  subtitle: string,
  bg: string,
  fg = '#0b1430',
  aspect = 4.6,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.height = 160;
  c.width = Math.round(160 * aspect);
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4f1ea';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = bg;
  g.lineWidth = 12;
  g.strokeRect(6, 6, c.width - 12, c.height - 12);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${title.length > 16 ? 40 : 52}px 'Bricolage Grotesque Variable', system-ui, sans-serif`;
  g.fillText(title, c.width / 2, subtitle ? 64 : 80, c.width - 48);
  if (subtitle) {
    g.fillStyle = '#3a4a75';
    g.font = "700 22px 'Inter Variable', system-ui, sans-serif";
    g.fillText(subtitle.toUpperCase(), c.width / 2, 118, c.width - 48);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePanotTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e4dbca';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#d2c7b0';
  g.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  g.fillStyle = '#d5cab3';
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      for (const [ox, oy] of [[18, 18], [46, 18], [18, 46], [46, 46]]) {
        g.beginPath();
        g.arc(x + ox, y + oy, 8, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(34, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld3D(scene: THREE.Scene, coriolisTex: THREE.CanvasTexture): World3D {
  const cylinders: CylinderSolid[] = [];
  const boxes: BoxSolid[] = [];
  const lampLights: THREE.PointLight[] = [];
  const lampBulbs: THREE.Mesh[] = [];
  const windowMats: THREE.MeshStandardMaterial[] = [];

  const mat = (color: number, roughness = 0.85, metalness = 0.05) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  // Ground layers: extend wings -36..WORLD_W+36 so camera never sees world edge drop-off
  const panotTex = makePanotTexture();
  const sidewalk = new THREE.Mesh(
    new THREE.BoxGeometry(PARK_X + 36, 0.14, CURB_Z + 8),
    new THREE.MeshStandardMaterial({ map: panotTex, roughness: 0.9 }),
  );
  sidewalk.position.set((PARK_X - 36) / 2, 0.07, (CURB_Z - 8) / 2);
  sidewalk.receiveShadow = true;
  scene.add(sidewalk);

  // Curb lip
  const curb = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W + 72, 0.14, 0.28), mat(0xc4baa6));
  curb.position.set(WORLD_W / 2, 0.07, CURB_Z - 0.1);
  curb.receiveShadow = true;
  scene.add(curb);

  // Park grass base
  const parkGrass = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W - PARK_X + 36, 0.14, CURB_Z + 8), mat(0x6da650, 0.95));
  parkGrass.position.set(PARK_X + (WORLD_W - PARK_X + 36) / 2, 0.07, (CURB_Z - 8) / 2);
  parkGrass.receiveShadow = true;
  scene.add(parkGrass);

  // Gravel path into park
  const parkPath = new THREE.Mesh(new THREE.BoxGeometry(18, 0.15, 2.8), mat(0xd8c9a8, 0.95));
  parkPath.position.set(PARK_X + 9, 0.075, 4.2);
  parkPath.receiveShadow = true;
  scene.add(parkPath);

  // Bike lane + stripes
  const bikeLane = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W + 72, BIKE_Z1 - BIKE_Z0), mat(0x3f6e5a, 0.9));
  bikeLane.rotation.x = -Math.PI / 2;
  bikeLane.position.set(WORLD_W / 2, 0.01, (BIKE_Z0 + BIKE_Z1) / 2);
  bikeLane.receiveShadow = true;
  scene.add(bikeLane);

  const dashMat = mat(0xe8e4da, 0.8);
  for (let x = -32; x < WORLD_W + 32; x += 4) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.015, 0.12), dashMat);
    d.position.set(x, 0.015, (BIKE_Z0 + BIKE_Z1) / 2);
    scene.add(d);
  }

  // Asphalt road + dashed centerline
  const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W + 72, ROAD_Z1 - ROAD_Z0 + 14), mat(0x454a57, 0.92));
  road.rotation.x = -Math.PI / 2;
  road.position.set(WORLD_W / 2, 0, (ROAD_Z0 + ROAD_Z1) / 2 + 5);
  road.receiveShadow = true;
  scene.add(road);

  for (let x = -30; x < WORLD_W + 30; x += 6) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.015, 0.16), dashMat);
    d.position.set(x, 0.015, (ROAD_Z0 + ROAD_Z1) / 2);
    scene.add(d);
  }

  // Two Zebra crossings (at X=31 and X=79)
  for (const zx of [31, 79]) {
    for (let k = 0; k < 7; k++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.02, 0.7), dashMat);
      s.position.set(zx, 0.02, BIKE_Z0 + 0.8 + k * 1.55);
      scene.add(s);
    }
    for (const bx of [zx - 2.1, zx + 2.1]) {
      const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.85, 10), mat(0x3b4560, 0.5, 0.4));
      bm.position.set(bx, 0.56, CURB_Z - 0.3);
      bm.castShadow = true;
      scene.add(bm);
      cylinders.push({ kind: 'bollard', x: bx, z: CURB_Z - 0.3, r: 0.22, h: 0.85, canPee: true, canWhirl: false, marked: false });
    }
  }

  // ---- Helper: add residential Eixample building --------------------------------
  const addHouse = (x: number, w: number, zBack: number, zFront: number, hex: number, floors = 3) => {
    const d = zFront - zBack;
    const h = 3.2 + floors * 2.5;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex, 0.88));
    b.position.set(x + w / 2, h / 2 + 0.14, (zBack + zFront) / 2);
    b.castShadow = true;
    b.receiveShadow = true;
    scene.add(b);
    boxes.push({ kind: 'building', x0: x, x1: x + w, z0: zBack, z1: zFront, h });

    const cols = Math.max(2, Math.round(w / 3.2));
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const wx = x + (w / cols) * (c + 0.5);
        const wy = 2.8 + f * 2.4;
        const wMat = new THREE.MeshStandardMaterial({ color: 0x2f3b58, emissive: 0xffd27a, emissiveIntensity: 0, roughness: 0.3 });
        windowMats.push(wMat);
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.1), wMat);
        win.position.set(wx, wy, zFront + 0.03);
        scene.add(win);
        const bal = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.55), mat(0x252b38, 0.6, 0.4));
        bal.position.set(wx, wy - 0.72, zFront + 0.25);
        scene.add(bal);
      }
    }
  };

  // ---- Stops / Shops -----------------------------------------------------------
  const stops: StopDef3D[] = [
    { id: 'leash', label: 'Path of Leash Resistance', kind: 'Game', href: '/projects/path-of-leash-resistance', color: '#ffb020', x: 8, w: 12, zFront: 0, doorX: 14, doorZ: 0.8 },
    { id: 'stemma', label: 'stemma', kind: 'Music studio', href: '/projects/stemma', color: '#1fc9b7', x: 20, w: 12, zFront: 0, doorX: 26, doorZ: 0.8 },
    { id: 'coriolis', label: 'Coriolis', kind: 'LED gallery', href: '/projects/coriolis', color: '#0b1430', x: 32, w: 16, zFront: 0, doorX: 40, doorZ: 0.8 },
    { id: 'about', label: 'About', kind: 'Café terrace', href: '/about', color: '#8bcb3c', x: 50, w: 14, zFront: -5.5, doorX: 57, doorZ: -4.6 },
    { id: 'blog', label: 'Blog', kind: 'Newsstand', href: '/blog', color: '#e5487a', x: 66, w: 11, zFront: 0, doorX: 71.5, doorZ: 0.8 },
    { id: 'how', label: 'How I build', kind: 'Studio', href: '/how-i-build', color: '#14203d', x: 77, w: 12, zFront: 0, doorX: 83, doorZ: 0.8 },
    { id: 'park', label: 'The park', kind: 'Off-leash', href: '/walk', color: '#5f9e4a', x: PARK_X, w: 30, zFront: 0, doorX: PARK_X + 6, doorZ: 3.5 },
  ];

  // Left flanking townhouses so X < 0 looks like a real city block
  addHouse(-24, 24, -8, 0, 0xd8b98f, 3);
  addHouse(0, 8, -8, 0, 0xe3d3b4, 3);

  let coriolisScreenMesh!: THREE.Mesh;

  for (const s of stops) {
    if (s.id === 'park') continue;
    const zBack = s.zFront - 8;
    const bodyCol = s.id === 'coriolis' ? 0x101933 : 0xefe6d3;
    const wallH = s.id === 'coriolis' ? 8.2 : 8.5;
    const building = new THREE.Mesh(new THREE.BoxGeometry(s.w, wallH, 8), mat(bodyCol, 0.86));
    building.position.set(s.x + s.w / 2, wallH / 2 + 0.14, (zBack + s.zFront) / 2);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
    boxes.push({ kind: 'building', x0: s.x, x1: s.x + s.w, z0: zBack, z1: s.zFront, h: wallH });

    const accentHex = parseInt(s.color.replace('#', ''), 16);
    if (s.id !== 'coriolis') {
      // Shop lower trim
      const base = new THREE.Mesh(new THREE.BoxGeometry(s.w - 0.6, 3.2, 0.14), mat(accentHex, 0.75));
      base.position.set(s.x + s.w / 2, 1.74, s.zFront + 0.05);
      scene.add(base);

      // Signboard
      const signW = s.w - 2.2;
      const signH = 1.4;
      const signTex = makeSignTexture(s.label, s.kind, s.color, '#0b1430', signW / signH);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.16), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5 }));
      sign.position.set(s.x + s.w / 2, 2.45, s.zFront + 0.14);
      scene.add(sign);

      // Striped awning
      const stripes = 8;
      const sw = (s.w - 0.8) / stripes;
      for (let i = 0; i < stripes; i++) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.16, 1.3), mat(i % 2 ? 0xf4f1ea : accentHex, 0.8));
        st.position.set(s.x + 0.4 + sw * (i + 0.5), 3.92, s.zFront + 0.62);
        st.rotation.x = 0.25;
        st.castShadow = true;
        scene.add(st);
      }

      // Upper apartment windows
      for (let i = 0; i < 3; i++) {
        const wMat = new THREE.MeshStandardMaterial({ color: 0x2f3b58, emissive: 0xffd27a, emissiveIntensity: 0, roughness: 0.3 });
        windowMats.push(wMat);
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.1), wMat);
        win.position.set(s.x + (s.w / 3) * (i + 0.5), 6.1, s.zFront + 0.04);
        scene.add(win);
      }
    } else {
      // Coriolis Gallery: giant framed 128x128 LED Wall right on the building!
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(5.1, 5.1, 0.25), mat(0x07090e, 0.4, 0.5));
      bezel.position.set(s.x + s.w * 0.58, 3.3, s.zFront + 0.08);
      scene.add(bezel);

      const screenMat = new THREE.MeshBasicMaterial({ map: coriolisTex });
      coriolisScreenMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), screenMat);
      coriolisScreenMesh.position.set(s.x + s.w * 0.58, 3.3, s.zFront + 0.22);
      scene.add(coriolisScreenMesh);

      const signTex = makeSignTexture('Coriolis', 'Live 128×128 LED Wall · Press X', '#5eea8c', '#0b1430', 4.8 / 1.25);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.25, 0.16), new THREE.MeshStandardMaterial({ map: signTex }));
      sign.position.set(s.x + s.w * 0.22, 4.6, s.zFront + 0.12);
      scene.add(sign);
    }

    // Shop Door + Doormat
    const doorX = s.id === 'coriolis' ? s.x + s.w * 0.22 : s.doorX;
    s.doorX = doorX;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.14), mat(0x232836, 0.6, 0.3));
    door.position.set(doorX, 1.24, s.zFront + 0.09);
    scene.add(door);
    const matMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 0.8), mat(0x4b382a));
    matMesh.position.set(doorX, 0.16, s.zFront + 0.55);
    scene.add(matMesh);
  }

  // ---- Plaza El Drac Mosaic Salamander Statue (X=57, Z=1.5) ------------------
  const dragonPos = { x: 57, z: 1.5 };
  const dragonGroup = new THREE.Group();
  dragonGroup.position.set(dragonPos.x, 0.14, dragonPos.z);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.85, 0.55, 12), mat(0xd8cbb4));
  plinth.position.y = 0.275;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  dragonGroup.add(plinth);

  const mosaicCols = [0xffb020, 0x1fc9b7, 0xe5487a, 0x8bcb3c];
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(0.42 - i * 0.04, 12, 10),
      mat(mosaicCols[i % mosaicCols.length], 0.35, 0.15),
    );
    seg.position.set((i - 2.2) * 0.36, 0.78 + Math.sin(i * 0.8) * 0.12, Math.sin(i * 1.1) * 0.18);
    seg.castShadow = true;
    dragonGroup.add(seg);
  }
  const dracHead = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.55), mat(0x1fc9b7, 0.3, 0.2));
  dracHead.position.set(-1.1, 1.05, 0);
  dracHead.rotation.z = 0.2;
  dracHead.castShadow = true;
  dragonGroup.add(dracHead);

  const dragonJet = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 1.6, 12),
    new THREE.MeshStandardMaterial({ color: 0x6ec6e8, transparent: true, opacity: 0.78, emissive: 0x1fc9b7, emissiveIntensity: 0.4 }),
  );
  dragonJet.position.set(-1.65, 1.35, 0);
  dragonJet.rotation.z = 0.65;
  dragonJet.visible = false;
  dragonGroup.add(dragonJet);

  const dragonHalo = new THREE.PointLight(0x1fc9b7, 0, 9);
  dragonHalo.position.set(0, 1.8, 0);
  dragonGroup.add(dragonHalo);
  scene.add(dragonGroup);
  cylinders.push({ kind: 'dragon', x: dragonPos.x, z: dragonPos.z, r: 1.9, h: 1.4, canPee: false, canWhirl: false, marked: false });

  // Café tables around Plaça del Sol
  for (const [tx, tz] of [[52.5, -1.6], [61.5, -1.6]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8), mat(0x2a2f3d));
    post.position.set(tx, 1.24, tz);
    scene.add(post);
    const tbl = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.1, 16), mat(0xe4ddd0));
    tbl.position.set(tx, 0.9, tz);
    tbl.castShadow = true;
    scene.add(tbl);
    const umbrella = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.55, 8), mat(0x8bcb3c));
    umbrella.position.set(tx, 2.35, tz);
    umbrella.castShadow = true;
    scene.add(umbrella);
    cylinders.push({ kind: 'table', x: tx, z: tz, r: 0.72, h: 1.2, canPee: false, canWhirl: false, marked: false });
  }

  // ---- Mirador Elevated Terrace & Ramp (X=89..101, Z=0..5.2) -----------------
  // Gentle ramp from X=89..94 rising from sidewalk (0.14) to terrace (1.05)
  const rampGeo = new THREE.BoxGeometry(5.2, 0.22, 4.6);
  const ramp = new THREE.Mesh(rampGeo, mat(0xd8cbb4));
  ramp.position.set(91.5, 0.52, 2.5);
  ramp.rotation.z = Math.atan2(0.91, 5.0);
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  scene.add(ramp);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.05, 4.8), mat(0xd8cbb4));
  deck.position.set(97.6, 0.525, 2.5);
  deck.castShadow = true;
  deck.receiveShadow = true;
  scene.add(deck);

  // Back railing on Mirador terrace
  const rail = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.75, 0.18), mat(0x2a2f3d, 0.5, 0.5));
  rail.position.set(97.6, 1.42, 0.2);
  scene.add(rail);
  boxes.push({ kind: 'wall', x0: 94, x1: 101.2, z0: -0.2, z1: 0.35, h: 2.0 });

  // ---- Curb Furniture: Lampposts (whirlable!), Trees, Hydrants ----------------
  const addLamp = (x: number, z: number) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 4.5, 10), mat(0x232938, 0.45, 0.6));
    pole.position.set(x, 2.39, z);
    pole.castShadow = true;
    scene.add(pole);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffe3a0, emissive: 0xffd07a, emissiveIntensity: 0.15 }),
    );
    bulb.position.set(x, 4.75, z);
    scene.add(bulb);
    lampBulbs.push(bulb);

    const light = new THREE.PointLight(0xffcf87, 0, 15, 1.6);
    light.position.set(x, 4.4, z);
    scene.add(light);
    lampLights.push(light);

    cylinders.push({ kind: 'lamp', x, z, r: 0.28, h: 4.6, canPee: true, canWhirl: true, marked: false });
  };

  const addTree = (x: number, z: number) => {
    const pit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 1.5), mat(0x6b5a45));
    pit.position.set(x, 0.15, z);
    scene.add(pit);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 2.8, 8), mat(0x6b4a32));
    trunk.position.set(x, 1.54, z);
    trunk.castShadow = true;
    scene.add(trunk);
    const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.65, 1), mat(0x529244));
    crown1.position.set(x, 3.7, z);
    crown1.castShadow = true;
    scene.add(crown1);
    const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 1), mat(0x74b55c));
    crown2.position.set(x + 0.6, 3.2, z - 0.5);
    scene.add(crown2);
    cylinders.push({ kind: 'tree', x, z, r: 0.42, h: 4.5, canPee: true, canWhirl: true, marked: false });
  };

  const addHydrant = (x: number, z: number) => {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.72, 10), mat(0xd9403a, 0.4));
    h.position.set(x, 0.5, z);
    h.castShadow = true;
    scene.add(h);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), mat(0xd9403a, 0.4));
    cap.position.set(x, 0.86, z);
    scene.add(cap);
    cylinders.push({ kind: 'hydrant', x, z, r: 0.28, h: 0.9, canPee: true, canWhirl: false, marked: false });
  };

  // Golden Tetherball pole outside Path of Leash Resistance (X=14, Z=6.3) + street lamps
  for (const lx of [14, 42, 68, 92]) addLamp(lx, 6.4);
  for (const tx of [3.5, 24, 52, 85, 112, 124]) addTree(tx, tx > PARK_X ? 1.0 : 6.1);
  for (const hx of [20.5, 47.5, 74.5]) addHydrant(hx, 6.5);

  // Benches
  for (const bx of [36, 62, 106]) {
    const bz = bx > PARK_X ? 6.2 : 4.3;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.8), mat(0x8a5a3c));
    seat.position.set(bx, 0.56, bz);
    seat.castShadow = true;
    scene.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 0.12), mat(0x8a5a3c));
    back.position.set(bx, 0.86, bz - 0.34);
    scene.add(back);
    boxes.push({ kind: 'bench', x0: bx - 1.35, x1: bx + 1.35, z0: bz - 0.45, z1: bz + 0.45, h: 0.9 });
  }

  // Water bowls (outside stemma & Café About)
  const bowls = [{ x: 28.5, z: 1.0 }, { x: 54.0, z: -3.2 }];
  for (const bw of bowls) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.18, 16), mat(0xe5487a));
    rim.position.set(bw.x, 0.23, bw.z);
    scene.add(rim);
    const wat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.19, 16), mat(0x6ec6e8, 0.15));
    wat.position.set(bw.x, 0.24, bw.z);
    scene.add(wat);
  }

  // ---- Off-Leash Dog Park Fence, Fountain, Soccer Goal & Buried Mounds --------
  // Park fence along X = PARK_X with open gate gap at Z = 2.8 .. 5.6
  const addFence = (x0: number, x1: number, z0: number, z1: number) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 1.05, z1 - z0), mat(0x252b38, 0.6, 0.5));
    f.position.set((x0 + x1) / 2, 0.66, (z0 + z1) / 2);
    f.castShadow = true;
    scene.add(f);
    boxes.push({ kind: 'fence', x0, x1, z0, z1, h: 1.1 });
  };
  addFence(PARK_X - 0.15, PARK_X + 0.15, -6, 2.6);
  addFence(PARK_X - 0.15, PARK_X + 0.15, 5.6, CURB_Z);

  const gateSign = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 3.2), new THREE.MeshStandardMaterial({ map: makeSignTexture('The park', 'OFF-LEASH AREA', '#5f9e4a') }));
  gateSign.position.set(PARK_X + 0.1, 2.4, 4.1);
  scene.add(gateSign);

  // Barcelona cast-iron drinking fountain in the park
  const fountain = { x: PARK_X + 7.5, z: 5.5 };
  const fBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.2, 12), mat(0x2f4a3c, 0.45, 0.4));
  fBase.position.set(fountain.x, 0.74, fountain.z);
  fBase.castShadow = true;
  scene.add(fBase);
  const fPuddle = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), mat(0x6ec6e8, 0.2));
  fPuddle.rotation.x = -Math.PI / 2;
  fPuddle.position.set(fountain.x + 0.3, 0.15, fountain.z + 0.6);
  scene.add(fPuddle);
  cylinders.push({ kind: 'fountain', x: fountain.x, z: fountain.z, r: 0.45, h: 1.2, canPee: false, canWhirl: false, marked: false });

  // Soccer Goal in the park (X=128, Z=2.5)
  const goalPos = { x: 128, z: 2.5, halfW: 2.3 };
  const postMat = mat(0xf4f1ea, 0.4);
  for (const gz of [goalPos.z - goalPos.halfW, goalPos.z + goalPos.halfW]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.9, 8), postMat);
    p.position.set(goalPos.x, 1.09, gz);
    p.castShadow = true;
    scene.add(p);
  }
  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, goalPos.halfW * 2, 8), postMat);
  crossbar.rotation.x = Math.PI / 2;
  crossbar.position.set(goalPos.x, 2.04, goalPos.z);
  scene.add(crossbar);

  // 3 Buried Finds (diggable mounds!)
  const moundDefs = [
    { id: 'teensy', name: 'Borealis Teensy 3.2', x: 11.5, z: 5.2, col: 0x5eea8c },
    { id: 'croissant', name: 'Golden Croissant', x: 63.5, z: 4.5, col: 0xffb020 },
    { id: 'dubplate', name: 'Vinyl Dubplate', x: 117.0, z: -2.0, col: 0x1fc9b7 },
  ];
  const mounds: DirtMound[] = moundDefs.map((md) => {
    const group = new THREE.Group();
    group.position.set(md.x, 0.14, md.z);
    const heap = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x7a5638, 0.95));
    heap.scale.set(1.2, 0.42, 1.0);
    group.add(heap);
    const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshStandardMaterial({ color: md.col, emissive: md.col, emissiveIntensity: 0.7 }));
    glint.position.set(0, 0.38, 0);
    group.add(glint);

    const lootMesh = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.18), new THREE.MeshStandardMaterial({ color: md.col, emissive: md.col, emissiveIntensity: 0.4 }));
    lootMesh.add(gem);
    lootMesh.position.set(0, 0.9, 0);
    lootMesh.visible = false;
    group.add(lootMesh);
    scene.add(group);
    return { id: md.id, name: md.name, x: md.x, z: md.z, dug: false, collected: false, mesh: group, lootMesh };
  });

  // Floor height function (supports elevated Mirador ramp & deck!)
  const floorHeight = (x: number, z: number): number => {
    if (x >= 89.0 && x <= 101.2 && z >= 0.0 && z <= 4.9) {
      if (x >= 94.0) return 1.05;
      const t = (x - 89.0) / 5.0;
      return 0.14 + t * (1.05 - 0.14);
    }
    if (z <= CURB_Z) return 0.14;
    return 0.0;
  };

  return {
    stops,
    cylinders,
    boxes,
    mounds,
    bowls,
    fountain,
    parkX: PARK_X,
    coriolisStop: stops.find((s) => s.id === 'coriolis')!,
    stemmaStop: stops.find((s) => s.id === 'stemma')!,
    dragonPos,
    dragonGroup,
    dragonJet,
    dragonHalo,
    goalPos,
    lampLights,
    lampBulbs,
    windowMats,
    coriolisScreenMesh,
    floorHeight,
    width: WORLD_W,
  };
}
