/*
  Low-poly, rounded models for the 3D walk. Characters face +X at rest
  (heading 0), and their parts are exposed so the game can animate them.
  Colors follow Path of Leash Resistance (entities/dog.gd, human.gd, bike.gd).
*/
import * as THREE from 'three';
import { barkTexture, palmTrunkTexture, herasMeshTexture, rng } from './textures';

// ---- Shared materials & primitives -------------------------------------------------
const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function M(color: number, rough = 0.8, metal = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const key = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
    matCache.set(key, m);
  }
  return m;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
const G = <T extends THREE.BufferGeometry>(key: string, make: () => T): T => {
  let g = geoCache.get(key) as T | undefined;
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
};

export const box = (w: number, h: number, d: number, m: THREE.Material) =>
  new THREE.Mesh(G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), m);
export const sphere = (r: number, m: THREE.Material, ws = 14, hs = 10) =>
  new THREE.Mesh(G(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs)), m);
export const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 12) =>
  new THREE.Mesh(G(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), m);
export const capsule = (r: number, len: number, m: THREE.Material, seg = 10) =>
  new THREE.Mesh(G(`k${r},${len},${seg}`, () => new THREE.CapsuleGeometry(r, len, 4, seg)), m);

const UP = new THREE.Vector3(0, 1, 0);
/** A cylinder from a to b (local coordinates of the parent). */
export function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material, seg = 8) {
  const len = a.distanceTo(b);
  const mesh = cyl(r, r, 1, m, seg);
  mesh.scale.y = len;
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  return mesh;
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function shadowed<T extends THREE.Object3D>(o: T, cast = true, receive = false): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = cast;
      c.receiveShadow = receive;
    }
  });
  return o;
}

/** Soft round blob shadow, cheap and readable under characters. */
const blobTex = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(20,14,8,0.55)');
    grd.addColorStop(1, 'rgba(20,14,8,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();
export function blobShadow(r: number) {
  const m = new THREE.Mesh(
    G('blob', () => new THREE.PlaneGeometry(1, 1)),
    new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.scale.set(r * 2, r * 2, 1);
  m.renderOrder = 1;
  return m;
}

// ---- Dogs ---------------------------------------------------------------------------
export interface DogLook {
  fur: number;
  dark: number;
  muzzle: number;
  paws: number;
  collar: number;
  scale: number;
  ears: 'drop' | 'prick';
  chest?: number;
}
export const MILLIE: DogLook = { fur: 0x242124, dark: 0x141417, muzzle: 0x6e6a66, paws: 0xc7c2ba, collar: 0xb82924, scale: 1, ears: 'drop', chest: 0x3a3638 };

export interface DogModel {
  group: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  legs: THREE.Group[];
  tail: THREE.Group;
  ears: THREE.Object3D[];
  collarAnchor: THREE.Object3D;
  animate: (t: number, s: { speed: number; dig: boolean; peeing: boolean; wag: number; air: boolean; swim?: boolean; turn?: number; barkT?: number; landT?: number; wet?: number }) => void;
}

export function makeDog(look: DogLook = MILLIE): DogModel {
  const fur = M(look.fur, 0.75), dark = M(look.dark, 0.8), muzzle = M(look.muzzle, 0.8), paws = M(look.paws, 0.85);
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const torso = capsule(0.16, 0.36, fur);
  torso.rotation.z = Math.PI / 2;
  torso.position.set(-0.02, 0.44, 0);
  torso.scale.set(1, 1, 0.9);
  body.add(torso);
  const chest = sphere(0.185, look.chest !== undefined ? M(look.chest, 0.8) : fur);
  chest.position.set(0.17, 0.46, 0);
  chest.scale.set(1, 1.05, 0.88);
  body.add(chest);
  const hip = sphere(0.165, fur);
  hip.position.set(-0.22, 0.45, 0);
  hip.scale.set(1, 1, 0.9);
  body.add(hip);

  const neck = capsule(0.085, 0.12, fur);
  neck.position.set(0.28, 0.58, 0);
  neck.rotation.z = -0.9;
  body.add(neck);

  const head = new THREE.Group();
  head.position.set(0.36, 0.68, 0);
  body.add(head);
  const skull = sphere(0.125, fur);
  skull.scale.set(1.1, 0.95, 0.92);
  head.add(skull);
  const snout = capsule(0.062, 0.09, muzzle);
  snout.rotation.z = Math.PI / 2;
  snout.position.set(0.13, -0.035, 0);
  head.add(snout);
  const nose = sphere(0.03, M(0x0c0c0e, 0.4));
  nose.position.set(0.215, -0.02, 0);
  head.add(nose);
  for (const s of [-1, 1]) {
    const eye = sphere(0.018, M(0x0a0a0a, 0.2));
    eye.position.set(0.085, 0.035, s * 0.06);
    head.add(eye);
    const glint = sphere(0.006, M(0xffffff, 0.2));
    glint.position.set(0.1, 0.045, s * 0.062);
    head.add(glint);
  }
  const ears: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(-0.01, 0.08, s * 0.085);
    const ear = sphere(0.07, dark);
    if (look.ears === 'drop') {
      ear.scale.set(0.75, 1.3, 0.35);
      ear.position.set(0, -0.07, s * 0.02);
      pivot.rotation.x = s * 0.35;
    } else {
      ear.scale.set(0.6, 1.2, 0.3);
      ear.position.set(0, 0.07, 0);
      pivot.rotation.x = -s * 0.25;
    }
    pivot.add(ear);
    head.add(pivot);
    ears.push(pivot);
  }

  // Collar with a tag.
  const collar = new THREE.Mesh(G('collar', () => new THREE.TorusGeometry(0.095, 0.022, 6, 16)), M(look.collar, 0.5));
  collar.position.set(0.27, 0.56, 0);
  collar.rotation.y = Math.PI / 2;
  collar.rotation.x = 0.7;
  body.add(collar);
  const tag = sphere(0.025, M(0xd8b04a, 0.3, 0.7));
  tag.position.set(0.33, 0.47, 0);
  body.add(tag);
  const collarAnchor = new THREE.Object3D();
  collarAnchor.position.set(0.3, 0.55, 0);
  body.add(collarAnchor);

  const legs: THREE.Group[] = [];
  for (const [lx, lz] of [[0.18, -0.09], [0.18, 0.09], [-0.22, -0.09], [-0.22, 0.09]]) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.38, lz);
    const leg = capsule(0.05, 0.22, fur);
    leg.position.y = -0.17;
    pivot.add(leg);
    const paw = sphere(0.055, paws);
    paw.scale.set(1.3, 0.7, 1);
    paw.position.set(0.02, -0.34, 0);
    pivot.add(paw);
    body.add(pivot);
    legs.push(pivot);
  }

  const tail = new THREE.Group();
  tail.position.set(-0.36, 0.52, 0);
  const tailSegs: THREE.Group[] = [];
  let parent: THREE.Object3D = tail;
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group();
    seg.position.x = i === 0 ? 0 : -0.09;
    seg.rotation.z = i === 0 ? 0.9 : 0.25;
    const m = capsule(0.035 - i * 0.006, 0.07, fur);
    m.rotation.z = Math.PI / 2;
    m.position.x = -0.045;
    seg.add(m);
    parent.add(seg);
    tailSegs.push(seg);
    parent = seg;
  }
  body.add(tail);

  group.scale.setScalar(look.scale);
  shadowed(group);

  // Gait and wag phases are accumulated, so speed/wag changes never make them jump.
  let lastT = Number.NaN, gait = Math.random() * 6, wagP = 0;
  const animate: DogModel['animate'] = (t, s) => {
    const dtA = Number.isFinite(lastT) ? Math.max(0, Math.min(0.1, t - lastT)) : 0;
    lastT = t;
    const moving = s.speed > 0.15;
    gait += dtA * (s.swim ? Math.max(4.5, 4 + Math.min(s.speed, 6) * 2.4) : 4 + Math.min(s.speed, 6) * 2.4);
    wagP += dtA * (6 + s.wag * 12);
    const amp = Math.min(0.75, s.speed * 0.16);
    const damp = dtA > 0 ? Math.min(1, dtA * 16) : 1;
    // A trot (diagonal pairs) that turns into a gallop (front pair, back pair) at speed.
    const gallop = s.speed > 4.3;
    legs.forEach((leg, i) => {
      let targetZ = 0;
      if (s.swim) {
        // Doggy paddle: quick alternating strokes, chin up, tail out behind.
        targetZ = Math.sin(gait * 1.6 + (i % 2 ? Math.PI : 0) + (i < 2 ? 0 : 0.8)) * (0.45 + Math.min(0.3, s.speed * 0.12));
      } else if (s.air) {
        targetZ = i < 2 ? -0.6 : 0.7;
      } else if (moving) {
        const phase = gallop ? (i < 2 ? i * 0.35 : Math.PI + (i - 2) * 0.35) : i === 0 || i === 3 ? 0 : Math.PI;
        targetZ = Math.sin(gait + phase) * amp * (gallop ? 1.25 : 1);
      }
      leg.rotation.z += (targetZ - leg.rotation.z) * damp;
    });
    if (s.peeing) legs[3].rotation.x = -1.0;
    else legs[3].rotation.x = 0;
    const barkAmt = Math.max(0, Math.min(1, (s.barkT ?? 0) / 0.24));
    const landAmt = Math.max(0, Math.min(1, (s.landT ?? 0) / 0.22));
    const turnAmt = Math.max(-1, Math.min(1, s.turn ?? 0));
    const shiver = (s.wet ?? 0) > 0.7 && !moving && !s.swim ? Math.sin(t * 42) * 0.14 : 0;
    const squashY = 1 - Math.sin(landAmt * Math.PI) * 0.14;
    const squashXZ = 1 + Math.sin(landAmt * Math.PI) * 0.07;
    const idleBreath = !moving && !s.swim && landAmt <= 0.01 ? Math.sin(t * 2.8) * 0.025 : 0;
    body.scale.set(squashXZ, squashY + idleBreath, squashXZ);
    body.position.y = s.swim ? Math.sin(t * 2.6) * 0.025 : moving ? Math.abs(Math.sin(gait)) * 0.03 * Math.min(1, s.speed / 3) : 0;
    body.rotation.z = s.swim ? 0.16 + Math.sin(gait) * 0.03 : s.dig ? -0.22 : moving ? (gallop ? Math.sin(gait) * 0.09 : Math.sin(gait * 2) * 0.02) : 0;
    body.rotation.x = (moving && !s.swim ? -turnAmt * 0.16 : 0) + shiver;
    head.rotation.z = (s.swim ? 0.28 + Math.sin(t * 2.2) * 0.04 : s.dig ? -0.35 : Math.sin(t * 1.3) * 0.05) + barkAmt * 0.28;
    head.rotation.y = Math.sin(t * 0.7) * 0.12;
    tail.rotation.y = Math.sin(wagP) * (0.22 + s.wag * 0.28);
    tail.rotation.z = s.swim ? -0.15 : s.dig ? -0.2 : 0.1 + s.wag * 0.2;
    tailSegs.forEach((seg, i) => {
      seg.rotation.y = Math.sin(wagP - i * 0.65) * (0.2 + s.wag * 0.22);
    });
    ears.forEach((e, i) => {
      const side = i === 0 ? -1 : 1;
      e.rotation.z = (moving ? Math.sin(gait + i) * 0.12 : 0) + barkAmt * 0.28;
      e.rotation.x = (look.ears === 'drop' ? side * 0.35 : -side * 0.25) * (1 - barkAmt * 0.45);
    });
  };

  return { group, body, head, legs, tail, ears, collarAnchor, animate };
}

// ---- People -------------------------------------------------------------------------
export interface PersonLook {
  top: number;
  trousers?: number;
  skin?: number;
  hair?: number;
  hairStyle?: 'ponytail' | 'short' | 'bun' | 'bald' | 'long';
  shoes?: number;
  height?: number;
  prop?: 'phone' | 'coffee' | 'bag' | 'none';
  shorts?: boolean;
}
export const HUMAN_LOOK: PersonLook = { top: 0xb85c70, trousers: 0x40455c, skin: 0xf2c49e, hair: 0x6b4026, hairStyle: 'ponytail', shoes: 0xf2ede0, height: 1, prop: 'phone' };
export const NPC_TOPS = [0x4c6185, 0x9e4c47, 0x667a5c, 0xc7bda8, 0x3d3d45, 0xb28f4c, 0x855c85, 0x1fc9b7, 0xe5487a];
export const NPC_HAIRS = [0x2a1d14, 0x6b4026, 0x1a1a1a, 0xb08850, 0x8a8a8a, 0x5b3a29];
export const NPC_SKINS = [0xf2c49e, 0xe0ac7e, 0xc68a5e, 0x8d5a3b, 0xf5d2b5];

export type Pose = 'walk' | 'phone' | 'selfie' | 'sit' | 'whirl' | 'stumble' | 'ride' | 'fish' | 'lie' | 'stand' | 'scoot' | 'swim';

export interface PersonModel {
  group: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  legs: THREE.Group[];
  arms: THREE.Group[];
  hand: THREE.Object3D; // leash hand (left)
  phone: THREE.Mesh | null;
  phoneScreen: THREE.MeshStandardMaterial | null;
  ponytail: THREE.Object3D | null;
  /** `pull` 0–1: how hard the leash drags them forward (lean back, leash arm out). */
  animate: (t: number, s: { speed: number; pose: Pose; look?: number; pull?: number; scared?: boolean }) => void;
}

export function makePerson(look: PersonLook): PersonModel {
  const skin = M(look.skin ?? 0xf2c49e, 0.7);
  const topM = M(look.top, 0.85);
  const legM = M(look.trousers ?? 0x40455c, 0.85);
  const hairM = M(look.hair ?? 0x6b4026, 0.9);
  const shoeM = M(look.shoes ?? 0xf2ede0, 0.7);
  const group = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  group.add(hips);

  const pelvis = sphere(0.15, legM);
  pelvis.scale.set(0.8, 0.6, 1.1);
  hips.add(pelvis);

  const legs: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, -0.02, s * 0.09);
    const thigh = capsule(0.068, look.shorts ? 0.3 : 0.34, look.shorts ? skin : legM);
    thigh.position.y = look.shorts ? -0.2 : -0.22;
    pivot.add(thigh);
    if (look.shorts) {
      const short = capsule(0.075, 0.18, legM);
      short.position.y = -0.1;
      pivot.add(short);
    }
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    const shin = capsule(0.058, 0.28, look.shorts ? skin : legM);
    shin.position.y = -0.21;
    knee.add(shin);
    const shoe = capsule(0.055, 0.12, shoeM);
    shoe.rotation.z = Math.PI / 2;
    shoe.position.set(0.05, -0.42, 0);
    knee.add(shoe);
    pivot.add(knee);
    hips.add(pivot);
    legs.push(pivot);
    knees.push(knee);
  }

  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);
  const chest = capsule(0.17, 0.34, topM);
  chest.position.y = 0.26;
  chest.scale.set(0.82, 1, 1);
  torso.add(chest);

  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.5, s * 0.21);
    const upper = capsule(0.052, 0.26, topM);
    upper.position.y = -0.17;
    pivot.add(upper);
    const fore = new THREE.Group();
    fore.position.y = -0.33;
    const lower = capsule(0.045, 0.22, skin);
    lower.position.y = -0.13;
    fore.add(lower);
    const handM = sphere(0.05, skin);
    handM.position.y = -0.27;
    fore.add(handM);
    fore.name = 'fore';
    pivot.add(fore);
    torso.add(pivot);
    arms.push(pivot);
  }
  const hand = new THREE.Object3D();
  hand.position.set(0, -0.28, 0);
  (arms[0].getObjectByName('fore') as THREE.Group).add(hand);

  const head = new THREE.Group();
  head.position.y = 0.72;
  torso.add(head);
  const neck = cyl(0.05, 0.055, 0.12, skin);
  neck.position.y = -0.1;
  head.add(neck);
  const skull = sphere(0.12, skin);
  skull.scale.set(1, 1.08, 0.95);
  skull.position.y = 0.06;
  head.add(skull);
  let ponytail: THREE.Object3D | null = null;
  const style = look.hairStyle ?? 'short';
  if (style !== 'bald') {
    const cap = sphere(0.128, hairM);
    cap.scale.set(1.04, style === 'long' ? 1.0 : 0.86, 1.02);
    cap.position.set(-0.018, 0.1, 0);
    head.add(cap);
    if (style === 'long') {
      const back = capsule(0.11, 0.18, hairM);
      back.position.set(-0.07, -0.02, 0);
      head.add(back);
    }
    if (style === 'ponytail' || style === 'bun') {
      const pivot = new THREE.Group();
      pivot.position.set(-0.12, 0.12, 0);
      const tail = style === 'bun' ? sphere(0.06, hairM) : capsule(0.04, 0.16, hairM);
      tail.position.set(-0.03, style === 'bun' ? 0.02 : -0.1, 0);
      if (style !== 'bun') tail.rotation.z = -0.3;
      pivot.add(tail);
      head.add(pivot);
      ponytail = pivot;
    }
  }
  for (const s of [-1, 1]) {
    const eye = sphere(0.014, M(0x1b1b1f, 0.3));
    eye.position.set(0.11, 0.08, s * 0.042);
    head.add(eye);
  }

  let phone: THREE.Mesh | null = null;
  let phoneScreen: THREE.MeshStandardMaterial | null = null;
  const propHand = arms[1].getObjectByName('fore') as THREE.Group;
  if (look.prop === 'phone') {
    phone = box(0.075, 0.14, 0.012, M(0x292933, 0.4));
    phoneScreen = new THREE.MeshStandardMaterial({ color: 0x0c1220, emissive: 0xccedff, emissiveIntensity: 0.6 });
    const screen = new THREE.Mesh(G('phoneScreen', () => new THREE.PlaneGeometry(0.064, 0.125)), phoneScreen);
    screen.position.z = 0.007;
    phone.add(screen);
    phone.position.set(0.04, -0.3, -0.02);
    phone.rotation.set(-0.2, Math.PI / 2, 0.2);
    propHand.add(phone);
  } else if (look.prop === 'coffee') {
    const cup = cyl(0.035, 0.028, 0.1, M(0xf4f1ea, 0.6));
    cup.position.set(0.02, -0.3, 0);
    propHand.add(cup);
  } else if (look.prop === 'bag') {
    const bag = box(0.24, 0.26, 0.08, M(0xd9b46a, 0.8));
    bag.position.set(0, -0.48, 0);
    propHand.add(bag);
  }

  group.scale.setScalar(look.height ?? 1);
  shadowed(group);

  // Gait phase is accumulated, so speed changes never make the legs jump.
  let lastT = Number.NaN, walkF = Math.random() * 6;
  const animate: PersonModel['animate'] = (t, s) => {
    const dtA = Number.isFinite(lastT) ? Math.max(0, Math.min(0.1, t - lastT)) : 0;
    lastT = t;
    walkF += dtA * (s.pose === 'swim' ? Math.max(2.6, 3 + Math.min(s.speed, 4.5) * 2.2) : 3 + Math.min(s.speed, 4.5) * 2.2);
    const run = Math.max(0, Math.min(1, (s.speed - 2.1) / 0.8));
    const amp = Math.min(0.6 + run * 0.2, s.speed * 0.42);
    const moveF = Math.min(1, s.speed / 2.2);
    const moving = s.speed > 0.15;
    const pull = s.pull ?? 0;
    const lf = arms[0].getObjectByName('fore') as THREE.Group;
    const rf = arms[1].getObjectByName('fore') as THREE.Group;
    if (phone) phone.visible = s.pose !== 'swim';
    hips.position.y = 0.92;
    hips.rotation.set(0, 0, 0);
    torso.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    switch (s.pose) {
      case 'swim':
        // Pronated breaststroke / paddle: chest pitched down in the water, head held upright, leash hand forward.
        hips.position.y = 0.28 + Math.sin(t * 2.4) * 0.025;
        hips.rotation.z = -1.15;
        torso.rotation.z = 0.25;
        head.rotation.z = 0.95;
        legs.forEach((l, i) => { l.rotation.z = 0.15 + Math.sin(walkF * 1.5 + i * Math.PI) * 0.38; });
        knees.forEach((k, i) => { k.rotation.z = -0.28 - Math.max(0, Math.cos(walkF * 1.5 + i * Math.PI)) * 0.42; });
        arms[0].rotation.set(0.15, 0, 1.15 + Math.sin(walkF) * 0.28);
        lf.rotation.z = 0.45;
        arms[1].rotation.set(-0.45 - Math.cos(walkF) * 0.35, 0, 1.2 + Math.sin(walkF) * 0.55);
        rf.rotation.set(0, 0, 0.4 + Math.max(0, Math.sin(walkF)) * 0.4);
        break;
      case 'sit':
        hips.position.y = 0.5;
        legs.forEach((l) => { l.rotation.z = 1.45; });
        knees.forEach((k) => { k.rotation.z = -1.45; });
        arms[0].rotation.set(0, 0, 0.3); lf.rotation.z = 0.8;
        arms[1].rotation.set(0, 0, 0.5); rf.rotation.z = 1.2;
        head.rotation.z = -0.35;
        break;
      case 'ride':
        hips.position.y = 0.95;
        legs.forEach((l, i) => { l.rotation.z = 1.05 + Math.sin(walkF + i * Math.PI) * 0.38; });
        knees.forEach((k, i) => { k.rotation.z = -0.95 - Math.cos(walkF + i * Math.PI) * 0.35; });
        torso.rotation.z = -0.35;
        arms.forEach((a) => { a.rotation.set(0, 0, 1.2); });
        lf.rotation.z = 0.2; rf.rotation.z = 0.2;
        break;
      case 'scoot':
        // On a kick scooter: feet staggered on the deck, hands on the bar, a slight lean in.
        legs[0].rotation.z = 0.2; knees[0].rotation.z = -0.15;
        legs[1].rotation.z = -0.25; knees[1].rotation.z = -0.2;
        torso.rotation.z = -0.1;
        arms.forEach((a) => { a.rotation.set(0, 0, 0.6); });
        lf.rotation.z = 0.1; rf.rotation.z = 0.1;
        head.rotation.z = 0.08;
        break;
      case 'lie':
        hips.position.y = 0.12;
        hips.rotation.z = -Math.PI / 2;
        legs.forEach((l) => { l.rotation.z = 0; });
        knees.forEach((k) => { k.rotation.z = 0; });
        arms.forEach((a) => { a.rotation.set(0, 0, 0.2); });
        break;
      case 'fish':
        legs.forEach((l) => { l.rotation.z = 0; });
        knees.forEach((k) => { k.rotation.z = 0; });
        arms.forEach((a) => { a.rotation.set(0, 0, 0.9); });
        lf.rotation.z = 0.5; rf.rotation.z = 0.5;
        break;
      case 'whirl':
        legs.forEach((l, i) => { l.rotation.z = 0.25 + Math.sin(walkF * 1.6 + i * Math.PI) * 0.7; });
        knees.forEach((k, i) => { k.rotation.z = -0.35 - Math.max(0, Math.cos(walkF * 1.6 + i * Math.PI)) * 0.55; });
        torso.rotation.x = 0.25;
        arms[0].rotation.set(0.9, 0, 1.4);
        arms[1].rotation.set(-1.2, 0, 0.6);
        head.rotation.z = 0.2;
        break;
      case 'stumble':
        legs.forEach((l, i) => { l.rotation.z = Math.sin(t * 18 + i * Math.PI) * 0.5; });
        knees.forEach((k, i) => { k.rotation.z = -0.25 - Math.abs(Math.cos(t * 18 + i * Math.PI)) * 0.4; });
        torso.rotation.z = 0.35 + Math.sin(t * 9) * 0.1;
        arms[0].rotation.set(0, 0, -1.6 + Math.sin(t * 14) * 0.5);
        arms[1].rotation.set(0, 0, -1.4 + Math.cos(t * 13) * 0.5);
        break;
      default: {
        // Walking or standing, phone in the right hand, leash in the left.
        const damp = dtA > 0 ? Math.min(1, dtA * 14) : 1;
        legs.forEach((l, i) => {
          const ph = walkF + i * Math.PI;
          const targetL = moving ? Math.sin(ph) * amp * (1 - pull * 0.35) + pull * 0.1 : 0;
          const targetK = moving ? -moveF * (Math.max(0, Math.cos(ph)) * (0.55 + run * 0.65) + 0.08) : 0;
          l.rotation.z += (targetL - l.rotation.z) * damp;
          knees[i].rotation.z += (targetK - knees[i].rotation.z) * damp;
        });
        hips.position.y = 0.92 + Math.abs(Math.cos(walkF)) * (0.025 + run * 0.05) * Math.min(1, s.speed) - run * 0.03 - pull * 0.05;
        hips.rotation.y = moving ? Math.sin(walkF) * 0.08 * moveF : 0;
        hips.rotation.x = moving ? Math.cos(walkF) * 0.025 * moveF : 0;
        torso.position.y = 0.08 + (!moving ? Math.sin(t * 2.1) * 0.01 : 0);
        // Running leans in; being dragged leans back against the leash.
        torso.rotation.y = moving ? -Math.sin(walkF) * 0.12 * moveF : 0;
        torso.rotation.z = -run * 0.18 * (1 - pull) + pull * 0.32 + Math.sin(walkF * 2) * 0.02 * Math.min(1, s.speed) - (s.scared ? 0.14 : 0);
        hips.rotation.z = pull * 0.12;
        head.rotation.z = -pull * 0.12;
        // Leash arm: swings while walking, reaches out toward the dog when pulled.
        arms[0].rotation.set(0, 0, 0.55 + Math.sin(walkF) * amp * 0.25 * (1 - pull) + pull * 0.85 + (s.scared ? 0.28 : 0));
        lf.rotation.z = 0.5 * (1 - pull) + 0.1;
        if (s.pose === 'selfie') {
          arms[1].rotation.set(0.15, 0.2, 1.35);
          rf.rotation.set(0, 0, 0.55);
          head.rotation.set(0.1, 0, 0.08);
        } else if (look.prop === 'phone' && (s.pose === 'phone' || s.pose === 'walk' || s.pose === 'stand') && !s.scared) {
          arms[1].rotation.set(0.25, 0, 0.45);
          rf.rotation.set(0, 0, 1.6);
          head.rotation.z = s.pose === 'phone' ? -0.45 : -0.25;
        } else {
          arms[1].rotation.set(0, 0, -Math.sin(walkF) * amp * (0.6 + run * 0.5) * (1 - pull * 0.6) - pull * 0.5 + (s.scared ? 0.35 : 0));
          rf.rotation.z = 0.25 + run * 1.1 + pull * 0.6 + (s.scared ? 0.3 : 0);
        }
      }
    }
    if (s.look !== undefined) head.rotation.y = s.look;
    if (ponytail) ponytail.rotation.x = Math.sin(walkF) * 0.25 * Math.min(1, s.speed + 0.2);
  };

  return { group, hips, torso, head, legs, arms, hand, phone, phoneScreen, ponytail, animate };
}

// ---- Bikes, scooters, sweeper, train -----------------------------------------------
export type BikeStyle = 'city' | 'bicing' | 'road' | 'scooter' | 'courier';
export function makeBike(style: BikeStyle, rider: PersonModel) {
  const group = new THREE.Group();
  const tyre = M(0x1b1b1f, 0.7);
  const frameCol = style === 'bicing' ? 0xededE8 : style === 'road' ? 0xe5487a : style === 'courier' ? 0x2a2f3d : style === 'scooter' ? 0x2a2f3d : 0x3d73c7;
  const frame = M(frameCol, 0.45, 0.3);
  const wheels: THREE.Object3D[] = [];
  if (style === 'scooter') {
    for (const x of [-0.42, 0.42]) {
      const w = new THREE.Mesh(G('scw', () => new THREE.TorusGeometry(0.11, 0.035, 6, 14)), tyre);
      w.position.set(x, 0.12, 0);
      w.userData.dynamic = true;
      group.add(w);
      wheels.push(w);
    }
    const deck = box(0.75, 0.05, 0.16, frame);
    deck.position.y = 0.14;
    group.add(deck);
    group.add(rod(V(0.42, 0.14, 0), V(0.38, 1.05, 0), 0.025, frame));
    group.add(rod(V(0.38, 1.05, -0.22), V(0.38, 1.05, 0.22), 0.02, frame));
    rider.group.position.set(-0.05, 0.16, 0);
    rider.animate(0, { speed: 0, pose: 'scoot' });
  } else {
    for (const x of [-0.52, 0.52]) {
      const w = new THREE.Mesh(G('bw', () => new THREE.TorusGeometry(0.33, 0.03, 6, 20)), tyre);
      w.position.set(x, 0.34, 0);
      w.userData.dynamic = true;
      group.add(w);
      const hub = cyl(0.04, 0.04, 0.06, M(0x9aa0a8, 0.3, 0.8));
      hub.rotation.x = Math.PI / 2;
      w.add(hub);
      wheels.push(w);
    }
    const bb = V(0, 0.34, 0), seat = V(-0.18, 0.92, 0), head = V(0.42, 0.98, 0);
    group.add(rod(V(-0.52, 0.34, 0), bb, 0.022, frame));
    group.add(rod(bb, seat, 0.025, frame));
    group.add(rod(bb, head, 0.026, frame));
    group.add(rod(seat.clone().setY(0.84), head.clone().setY(0.9), 0.024, frame));
    group.add(rod(V(-0.52, 0.34, 0), seat.clone().setY(0.84), 0.018, frame));
    group.add(rod(head, V(0.52, 0.34, 0), 0.02, frame));
    group.add(rod(V(0.42, 1.05, -0.24), V(0.42, 1.05, 0.24), 0.018, M(0x2a2f3d, 0.5)));
    const saddle = capsule(0.04, 0.12, M(0x1b1b1f, 0.6));
    saddle.rotation.z = Math.PI / 2;
    saddle.position.copy(seat).add(V(0, 0.03, 0));
    group.add(saddle);
    if (style === 'bicing' || style === 'city') {
      const basket = box(0.26, 0.18, 0.3, M(style === 'bicing' ? 0xd62429 : 0x6b5a48, 0.7));
      basket.position.set(0.62, 0.9, 0);
      group.add(basket);
    }
    if (style === 'courier') {
      // A delivery backpack, strapped to the back (it leans with the rider).
      const crate = box(0.36, 0.42, 0.4, M(0x1fc9b7, 0.7));
      crate.position.set(-0.31, 0.3, 0);
      rider.torso.add(crate);
      const lid = box(0.38, 0.03, 0.42, M(0x168f83, 0.7));
      lid.position.set(-0.31, 0.52, 0);
      rider.torso.add(lid);
    }
    rider.group.position.set(-0.22, -0.08, 0);
  }
  // Helmet for most riders.
  const helmetCols = [0xeb4c38, 0xfad642, 0x428fdb];
  if (style !== 'bicing') {
    const helmet = sphere(0.14, M(helmetCols[Math.floor(Math.random() * 3)], 0.5), 12, 8);
    helmet.scale.set(1.15, 0.75, 1);
    helmet.position.y = 0.13;
    rider.head.add(helmet);
  }
  group.add(rider.group);
  const light = sphere(0.04, new THREE.MeshStandardMaterial({ color: 0xfffbe6, emissive: 0xfffbe6, emissiveIntensity: 0.2 }));
  light.position.set(0.6, 0.95, 0);
  group.add(light);
  shadowed(group);
  return { group, wheels, rider, light: light.material as THREE.MeshStandardMaterial };
}

/** La Neteja: a small municipal street sweeper with spinning brushes. */
export function makeSweeper() {
  const group = new THREE.Group();
  const white = M(0xf2f2ee, 0.5), green = M(0x2f8a4f, 0.6), dark = M(0x2a2f3d, 0.6);
  const bodyMesh = box(2.4, 1.3, 1.3, white);
  bodyMesh.position.set(-0.3, 1.05, 0);
  group.add(bodyMesh);
  const cab = box(1.1, 1.2, 1.25, white);
  cab.position.set(1.3, 1.45, 0);
  group.add(cab);
  const glass = box(0.06, 0.7, 1.1, M(0x38475a, 0.15, 0.4));
  glass.position.set(1.86, 1.65, 0);
  group.add(glass);
  const stripe = box(3.5, 0.18, 1.32, green);
  stripe.position.set(0.25, 0.75, 0);
  group.add(stripe);
  const beacon = sphere(0.1, new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xffa000, emissiveIntensity: 1 }));
  beacon.position.set(1.3, 2.12, 0);
  group.add(beacon);
  const wheels: THREE.Mesh[] = [];
  for (const [x, z] of [[-1.1, -0.62], [-1.1, 0.62], [1.2, -0.62], [1.2, 0.62]]) {
    const w = cyl(0.32, 0.32, 0.22, dark, 14);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.32, z);
    group.add(w);
    wheels.push(w);
  }
  const brushes: THREE.Mesh[] = [];
  for (const z of [-0.7, 0.7]) {
    const b = cyl(0.35, 0.35, 0.08, M(0x3a7bd5, 0.9), 16);
    b.position.set(2.0, 0.1, z);
    b.userData.dynamic = true;
    group.add(b);
    brushes.push(b);
  }
  shadowed(group);
  return { group, wheels, brushes, beacon: beacon.material as THREE.MeshStandardMaterial };
}

/** Rodalies commuter train: white cars with a red band. */
export function makeTrain(cars = 3) {
  const group = new THREE.Group();
  // Current Rodalies units: white body, orange front and doors, dark window band.
  const white = M(0xf1f1ee, 0.45, 0.1), red = M(0xf07a1a, 0.5), glass = M(0x1e2533, 0.15, 0.5), dark = M(0x2a2f3d, 0.7);
  const carLen = 17;
  const doors: THREE.Mesh[] = [];
  for (let i = 0; i < cars; i++) {
    const x = i * (carLen + 0.5);
    const shell = box(carLen, 3.3, 2.9, white);
    shell.position.set(x, 2.05, 0);
    group.add(shell);
    for (const dx of [-carLen / 2 + 3.2, carLen / 2 - 3.2]) {
      for (const side of [-1, 1]) {
        const door = box(1.3, 2.3, 0.06, red);
        door.position.set(x + dx, 1.75, side * 1.47);
        door.userData.z0 = side * 1.47;
        door.userData.dynamic = true;
        group.add(door);
        doors.push(door);
      }
    }
    const win = box(carLen - 1.2, 0.9, 2.94, glass);
    win.position.set(x, 2.5, 0);
    group.add(win);
    const roof = box(carLen - 0.4, 0.3, 2.4, M(0xc9ccd0, 0.5, 0.3));
    roof.position.set(x, 3.85, 0);
    group.add(roof);
    for (const bx of [x - carLen / 2 + 2.5, x + carLen / 2 - 2.5]) {
      const bogie = box(2.6, 0.5, 2.4, dark);
      bogie.position.set(bx, 0.3, 0);
      group.add(bogie);
    }
  }
  // Rounded noses.
  for (const [x, s] of [[-carLen / 2, -1], [(cars - 1) * (carLen + 0.5) + carLen / 2, 1]]) {
    const nose = sphere(1.5, red, 16, 10);
    nose.scale.set(0.6, 1.1, 0.97);
    nose.position.set(x, 2.0, 0);
    group.add(nose);
    const lamp = sphere(0.14, new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xfff3c4, emissiveIntensity: 0.6 }));
    lamp.position.set(x + s * 0.85, 1.2, 0);
    group.add(lamp);
    const pantograph = rod(V(x - s * 4, 4.0, 0), V(x - s * 5, 4.9, 0), 0.04, dark);
    group.add(pantograph);
  }
  shadowed(group);
  return { group, length: cars * (carLen + 0.5), doors };
}

// ---- Street furniture -------------------------------------------------------------
const iron = () => M(0x2a2f3d, 0.5, 0.5);

/** Barcelona-style fanal: column with four arms and lanterns (main.gd lamppost). */
export function makeFanal() {
  const g = new THREE.Group();
  const base = cyl(0.22, 0.26, 0.5, M(0x3d3d45, 0.6, 0.4), 10);
  base.position.y = 0.25;
  g.add(base);
  const col = cyl(0.09, 0.12, 4.2, M(0x4c4c54, 0.5, 0.5), 10);
  col.position.y = 2.6;
  g.add(col);
  const bulbs: THREE.Mesh[] = [];
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xdbe0e6, emissive: 0xffd88a, emissiveIntensity: 0.05, roughness: 0.2 });
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const arm = rod(V(0, 4.55, 0), V(Math.cos(a) * 0.55, 4.75, Math.sin(a) * 0.55), 0.03, M(0x4c4c54, 0.5, 0.5));
    g.add(arm);
    const lantern = cyl(0.13, 0.09, 0.32, glassMat, 8);
    lantern.position.set(Math.cos(a) * 0.62, 4.62, Math.sin(a) * 0.62);
    g.add(lantern);
    bulbs.push(lantern);
    const cap = cyl(0.02, 0.16, 0.1, M(0x4c4c54, 0.5, 0.5), 8);
    cap.position.set(Math.cos(a) * 0.62, 4.83, Math.sin(a) * 0.62);
    g.add(cap);
  }
  const finial = sphere(0.08, M(0x4c4c54, 0.5, 0.5));
  finial.position.y = 4.9;
  g.add(finial);
  shadowed(g);
  return { group: g, glass: glassMat, lightY: 4.6, radius: 0.12 };
}

/** Seafront lamp: tall slim pole with a single curved head. */
export function makeSeaLamp() {
  const g = new THREE.Group();
  const pole = cyl(0.07, 0.11, 6.5, M(0xd9dde2, 0.4, 0.6), 10);
  pole.position.y = 3.25;
  g.add(pole);
  const arm = rod(V(0, 6.4, 0), V(0.9, 6.7, 0), 0.05, M(0xd9dde2, 0.4, 0.6));
  g.add(arm);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xeef2f6, emissive: 0xfff0c8, emissiveIntensity: 0.05, roughness: 0.2 });
  const head = cyl(0.32, 0.18, 0.18, glassMat, 12);
  head.position.set(1.0, 6.62, 0);
  g.add(head);
  shadowed(g);
  return { group: g, glass: glassMat, lightY: 6.5, radius: 0.1 };
}

export function makePalm(seed: number, height = 9) {
  const r = rng(seed);
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ map: palmTrunkTexture(), roughness: 0.95 });
  trunkMat.map!.repeat.set(1, height * 1.4);
  const segs = 7;
  const lean = (r() - 0.5) * 0.18;
  let prev = V(0, 0, 0);
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const p = V(Math.sin(t * 1.4) * lean * height, t * height, Math.cos(t * 1.1) * lean * height * 0.4);
    const s = rod(prev, p, 0.24 - t * 0.07, trunkMat, 9);
    g.add(s);
    prev = p;
  }
  const crown = new THREE.Group();
  crown.position.copy(prev);
  g.add(crown);
  const frondGeo = G('frond', () => {
    const geo = new THREE.PlaneGeometry(3.2, 0.7, 8, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + 1.6;
      const y = pos.getY(i);
      const taper = 1 - x / 3.4;
      pos.setY(i, y * taper);
      pos.setZ(i, -Math.pow(x / 3.2, 2) * 1.3);
      pos.setX(i, x);
    }
    geo.computeVertexNormals();
    return geo;
  });
  const frondMat = M(0x4f7d3a, 0.8, 0, { side: THREE.DoubleSide });
  const frondDark = M(0x3d6630, 0.8, 0, { side: THREE.DoubleSide });
  const n = 12;
  for (let i = 0; i < n; i++) {
    const f = new THREE.Mesh(frondGeo, i % 2 ? frondMat : frondDark);
    f.rotation.order = 'YXZ';
    f.rotation.y = (i / n) * Math.PI * 2 + r() * 0.3;
    f.rotation.x = -Math.PI / 2 + 0.25 + r() * 0.3;
    crown.add(f);
  }
  const dates = sphere(0.3, M(0xb5700a, 0.8));
  dates.position.y = -0.3;
  crown.add(dates);
  shadowed(g);
  return { group: g, crown, radius: 0.26 };
}

let planeBark: THREE.MeshStandardMaterial | null = null;
export function makePlaneTree(seed: number) {
  const r = rng(seed);
  const g = new THREE.Group();
  // One bark material for every plane tree: painting the texture is the slow part.
  const bark = planeBark ??= new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.9 });
  const trunk = cyl(0.17, 0.24, 3.4, bark, 10);
  trunk.position.y = 1.7;
  g.add(trunk);
  for (let k = 0; k < 3; k++) {
    const a = r() * Math.PI * 2;
    g.add(rod(V(0, 3.0, 0), V(Math.cos(a) * 1.0, 4.4, Math.sin(a) * 1.0), 0.1, bark, 7));
  }
  const greens = [0x5f9e4a, 0x4e8c40, 0x6aa84f, 0x55913f];
  const crownGeo = G('crown', () => new THREE.IcosahedronGeometry(1, 1));
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(crownGeo, M(greens[i % greens.length], 0.85, 0, { flatShading: true }));
    const a = (i / 6) * Math.PI * 2;
    const s = 1.4 + r() * 0.8;
    c.scale.set(s, s * 0.8, s);
    c.position.set(Math.cos(a) * 1.2, 5.0 + r() * 0.8, Math.sin(a) * 1.2);
    g.add(c);
  }
  const top = new THREE.Mesh(crownGeo, M(0x6aa84f, 0.85, 0, { flatShading: true }));
  top.scale.set(1.8, 1.4, 1.8);
  top.position.y = 6.0;
  g.add(top);
  // Square tree pit (escocell).
  const pit = box(1.3, 0.02, 1.3, M(0x7a6a50, 0.95));
  pit.position.y = 0.005;
  g.add(pit);
  shadowed(g);
  pit.castShadow = false;
  pit.receiveShadow = true;
  return { group: g, radius: 0.24 };
}

/** Banc romàntic: wooden slats on cast-iron legs. */
export function makeBench() {
  const g = new THREE.Group();
  const wood = M(0x946b42, 0.8), ir = iron();
  for (let i = 0; i < 3; i++) {
    const slat = box(1.8, 0.05, 0.11, wood);
    slat.position.set(0, 0.45, -0.15 + i * 0.13);
    g.add(slat);
  }
  for (let i = 0; i < 2; i++) {
    const back = box(1.8, 0.1, 0.04, wood);
    back.position.set(0, 0.62 + i * 0.16, -0.24);
    back.rotation.x = -0.2;
    g.add(back);
  }
  for (const x of [-0.75, 0.75]) {
    const leg = box(0.06, 0.45, 0.45, ir);
    leg.position.set(x, 0.22, -0.05);
    g.add(leg);
    g.add(rod(V(x, 0.45, -0.22), V(x, 0.9, -0.3), 0.025, ir));
  }
  shadowed(g);
  return g;
}

export function makeBollard() {
  const g = new THREE.Group();
  const b = cyl(0.09, 0.11, 0.85, M(0x3b4560, 0.5, 0.4), 10);
  b.position.y = 0.42;
  g.add(b);
  const cap = sphere(0.1, M(0x3b4560, 0.5, 0.4), 10, 6);
  cap.position.y = 0.85;
  g.add(cap);
  shadowed(g);
  return g;
}

export function makeBin() {
  const g = new THREE.Group();
  const b = cyl(0.24, 0.2, 0.85, M(0x5c6473, 0.6, 0.3), 12);
  b.position.y = 0.48;
  g.add(b);
  const post = cyl(0.04, 0.04, 1.0, iron(), 6);
  post.position.set(0, 0.5, -0.28);
  g.add(post);
  shadowed(g);
  return g;
}

/** Row of recycling containers in the game's colors. */
export function makeContainers() {
  const g = new THREE.Group();
  const cols = [0x336b3d, 0xebc72e, 0x335ca8, 0x7a5238, 0x666b70];
  cols.forEach((c, i) => {
    const body = box(1.5, 1.45, 1.6, M(c, 0.6));
    body.position.set(i * 1.62, 0.78, 0);
    g.add(body);
    const lid = box(1.52, 0.08, 1.62, M(new THREE.Color(c).multiplyScalar(0.75).getHex(), 0.6));
    lid.position.set(i * 1.62, 1.54, 0);
    g.add(lid);
  });
  shadowed(g);
  return g;
}

/** Quiosc: a green newspaper kiosk. */
export function makeKiosk(accent = 0xe5487a) {
  const g = new THREE.Group();
  const green = M(0x2f5a46, 0.6, 0.2);
  const body = box(2.6, 2.3, 1.8, green);
  body.position.y = 1.15;
  g.add(body);
  const roof = box(3.2, 0.18, 2.4, green);
  roof.position.y = 2.42;
  g.add(roof);
  const top = box(2.4, 0.5, 1.4, M(accent, 0.6));
  top.position.y = 2.75;
  g.add(top);
  // Magazine racks on the front.
  const cols = [0xffb020, 0x1fc9b7, 0xe5487a, 0x8bcb3c, 0xf4f1ea, 0x3d73c7];
  for (let i = 0; i < 12; i++) {
    const mag = box(0.3, 0.4, 0.03, M(cols[i % cols.length], 0.7));
    mag.position.set(-1.05 + (i % 6) * 0.42, 0.9 + Math.floor(i / 6) * 0.5, 0.92);
    g.add(mag);
  }
  shadowed(g);
  return g;
}

export function makeCafeSet(accent: number) {
  const g = new THREE.Group();
  const top = cyl(0.38, 0.38, 0.04, M(0xc9c2b4, 0.5, 0.3), 16);
  top.position.y = 0.74;
  g.add(top);
  const leg = cyl(0.03, 0.03, 0.72, iron(), 6);
  leg.position.y = 0.36;
  g.add(leg);
  for (const a of [0, Math.PI]) {
    const chair = new THREE.Group();
    const seat = box(0.4, 0.04, 0.4, M(0x8a8f99, 0.4, 0.6));
    seat.position.y = 0.45;
    chair.add(seat);
    const back = box(0.04, 0.4, 0.4, M(0x8a8f99, 0.4, 0.6));
    back.position.set(-0.2, 0.67, 0);
    chair.add(back);
    for (const [x, z] of [[-0.17, -0.17], [-0.17, 0.17], [0.17, -0.17], [0.17, 0.17]]) {
      const l = cyl(0.015, 0.015, 0.45, iron(), 5);
      l.position.set(x, 0.22, z);
      chair.add(l);
    }
    chair.position.set(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6);
    chair.rotation.y = -a;
    g.add(chair);
  }
  const pole = cyl(0.025, 0.025, 2.3, M(0xe8e4da, 0.5), 6);
  pole.position.y = 1.15;
  g.add(pole);
  const parasol = new THREE.Mesh(G('parasol', () => new THREE.ConeGeometry(1.35, 0.45, 8, 1, true)), M(accent, 0.8, 0, { side: THREE.DoubleSide }));
  parasol.position.y = 2.3;
  g.add(parasol);
  shadowed(g);
  return g;
}

export function makeBeachUmbrella(a: number, b: number) {
  const g = new THREE.Group();
  const pole = cyl(0.025, 0.025, 2.1, M(0xe8e4da, 0.5), 6);
  pole.position.y = 1.05;
  pole.rotation.z = 0.12;
  g.add(pole);
  const seg = 8;
  for (let i = 0; i < seg; i++) {
    const wedge = new THREE.Mesh(
      G('umbw', () => new THREE.ConeGeometry(1.2, 0.4, 2, 1, true, 0, (Math.PI * 2) / seg)),
      M(i % 2 ? a : b, 0.8, 0, { side: THREE.DoubleSide }),
    );
    wedge.rotation.y = (i * Math.PI * 2) / seg;
    wedge.position.set(0.12, 2.1, 0);
    g.add(wedge);
  }
  shadowed(g);
  return g;
}

export function makeTowel(color: number) {
  const t = box(0.8, 0.02, 1.8, M(color, 0.95));
  t.position.y = 0.01;
  t.receiveShadow = true;
  return t;
}

export function makeLifeguardTower() {
  const g = new THREE.Group();
  const wood = M(0xe8e4da, 0.7), red = M(0xd62429, 0.6);
  for (const [x, z] of [[-0.6, -0.6], [-0.6, 0.6], [0.6, -0.6], [0.6, 0.6]]) {
    g.add(rod(V(x, 0, z), V(x * 0.6, 2.2, z * 0.6), 0.06, wood));
  }
  const deck = box(1.2, 0.1, 1.2, wood);
  deck.position.y = 2.2;
  g.add(deck);
  const seat = box(0.8, 0.6, 0.8, red);
  seat.position.y = 2.55;
  g.add(seat);
  const umbrella = new THREE.Mesh(G('lgu', () => new THREE.ConeGeometry(0.9, 0.3, 8, 1, true)), M(0xffb020, 0.8, 0, { side: THREE.DoubleSide }));
  umbrella.position.y = 3.5;
  g.add(umbrella);
  g.add(rod(V(0, 2.2, 0), V(0, 3.5, 0), 0.03, wood));
  shadowed(g);
  return g;
}

/** Heras fence panel, 3.5 m long (world/obres.gd: galvanized, concrete feet). */
export function makeHeras(len = 3.5) {
  const g = new THREE.Group();
  const galv = M(0xbdc2c2, 0.4, 0.7);
  const meshTex = herasMeshTexture();
  meshTex.repeat.set(len / 0.6, 2 / 0.6);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(len, 1.9),
    new THREE.MeshStandardMaterial({ map: meshTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.5 }),
  );
  mesh.position.y = 1.15;
  g.add(mesh);
  g.add(rod(V(-len / 2, 0.2, 0), V(-len / 2, 2.1, 0), 0.025, galv));
  g.add(rod(V(len / 2, 0.2, 0), V(len / 2, 2.1, 0), 0.025, galv));
  g.add(rod(V(-len / 2, 2.1, 0), V(len / 2, 2.1, 0), 0.02, galv));
  g.add(rod(V(-len / 2, 0.2, 0), V(len / 2, 0.2, 0), 0.02, galv));
  for (const x of [-len / 2, len / 2]) {
    const foot = box(0.6, 0.14, 0.22, M(0x94918a, 0.9));
    foot.position.set(x, 0.07, 0);
    g.add(foot);
  }
  // Hazard tape along the top.
  const tape = box(len, 0.08, 0.01, M(0xf0751f, 0.7));
  tape.position.y = 1.6;
  g.add(tape);
  shadowed(g);
  return g;
}

export function makeCone() {
  const g = new THREE.Group();
  const c = cyl(0.03, 0.17, 0.6, M(0xf0751f, 0.6), 12);
  c.position.y = 0.33;
  g.add(c);
  const band = cyl(0.075, 0.11, 0.1, M(0xf4f1ea, 0.5), 12);
  band.position.y = 0.4;
  g.add(band);
  const base = box(0.4, 0.04, 0.4, M(0x1b1b1f, 0.8));
  base.position.y = 0.02;
  g.add(base);
  shadowed(g);
  return g;
}

/** Red and white plastic road barrier. */
export function makeBarrier() {
  const g = new THREE.Group();
  const red = M(0xd62429, 0.6), white = M(0xf4f1ea, 0.6);
  for (let i = 0; i < 4; i++) {
    const s = box(0.5, 0.8, 0.4, i % 2 ? white : red);
    s.position.set(-0.75 + i * 0.5, 0.45, 0);
    g.add(s);
  }
  shadowed(g);
  return g;
}

export function makeSkip(color = 0xeba81f) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-1.6, 0); shape.lineTo(1.6, 0); shape.lineTo(2.0, 1.2); shape.lineTo(-2.0, 1.2); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.7, bevelEnabled: false });
  geo.translate(0, 0, -0.85);
  const m = new THREE.Mesh(geo, M(color, 0.7, 0.2));
  g.add(m);
  const rubble = sphere(0.9, M(0x8a7e6a, 0.95), 8, 6);
  rubble.scale.set(1.9, 0.5, 0.85);
  rubble.position.y = 1.15;
  g.add(rubble);
  shadowed(g);
  return g;
}

export function makeExcavator() {
  const g = new THREE.Group();
  const yel = M(0xf2b51d, 0.55, 0.2), dark = M(0x2a2f3d, 0.7);
  const tracks = box(3.4, 0.7, 2.6, dark);
  tracks.position.y = 0.35;
  g.add(tracks);
  const house = new THREE.Group();
  house.position.y = 0.8;
  g.add(house);
  const cabBody = box(2.6, 1.2, 2.2, yel);
  cabBody.position.set(-0.3, 0.6, 0);
  house.add(cabBody);
  const cab = box(1.1, 1.3, 1.0, yel);
  cab.position.set(0.4, 1.8, 0.55);
  house.add(cab);
  const glass = box(1.0, 0.9, 0.9, M(0x38475a, 0.15, 0.4));
  glass.position.set(0.45, 1.9, 0.55);
  house.add(glass);
  const boom = rod(V(0.9, 1.0, -0.4), V(3.0, 3.2, -0.4), 0.18, yel);
  house.add(boom);
  const stick = rod(V(3.0, 3.2, -0.4), V(4.0, 1.0, -0.4), 0.14, yel);
  house.add(stick);
  const bucket = box(0.7, 0.6, 0.9, dark);
  bucket.position.set(4.1, 0.75, -0.4);
  house.add(bucket);
  house.rotation.y = 0.5;
  shadowed(g);
  return g;
}

/** Drinking fountain (font) with a little basin. */
export function makeFountain() {
  const g = new THREE.Group();
  const body = cyl(0.16, 0.22, 1.0, M(0x2f4a3c, 0.5, 0.5), 10);
  body.position.y = 0.5;
  g.add(body);
  const cap = sphere(0.18, M(0xd8b04a, 0.35, 0.8), 10, 6);
  cap.position.y = 1.05;
  g.add(cap);
  const basin = cyl(0.36, 0.3, 0.12, M(0x8a8f99, 0.4, 0.5), 14);
  basin.position.set(0.3, 0.18, 0);
  g.add(basin);
  const water = cyl(0.31, 0.31, 0.02, new THREE.MeshStandardMaterial({ color: 0x6ec6e8, roughness: 0.1, transparent: true, opacity: 0.8 }), 14);
  water.position.set(0.3, 0.24, 0);
  g.add(water);
  shadowed(g);
  return g;
}

export function makeWaterBowl() {
  const g = new THREE.Group();
  const bowl = cyl(0.2, 0.16, 0.09, M(0xe5487a, 0.5), 14);
  bowl.position.y = 0.045;
  g.add(bowl);
  const water = cyl(0.17, 0.17, 0.01, new THREE.MeshStandardMaterial({ color: 0x6ec6e8, roughness: 0.1 }), 14);
  water.position.y = 0.09;
  g.add(water);
  return g;
}

export function makeHurdle() {
  const g = new THREE.Group();
  const white = M(0xf4f1ea, 0.6), red = M(0xd62429, 0.6);
  for (const z of [-0.6, 0.6]) {
    const post = cyl(0.04, 0.04, 0.7, white, 8);
    post.position.set(0, 0.35, z);
    g.add(post);
  }
  const bar = cyl(0.03, 0.03, 1.2, red, 8);
  bar.rotation.x = Math.PI / 2;
  bar.position.y = 0.45;
  g.add(bar);
  shadowed(g);
  return g;
}

export function makeBall() {
  const ball = sphere(0.12, M(0xd4e157, 0.6), 14, 10);
  ball.castShadow = true;
  return ball;
}

export function makeBone() {
  const g = new THREE.Group();
  const m = M(0xf4efe2, 0.6);
  const shaft = capsule(0.035, 0.22, m);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  for (const x of [-0.15, 0.15]) {
    for (const z of [-0.04, 0.04]) {
      const k = sphere(0.045, m, 8, 6);
      k.position.set(x, 0, z);
      g.add(k);
    }
  }
  shadowed(g);
  return g;
}

export function makeSandMound() {
  const m = new THREE.Mesh(
    G('mound', () => new THREE.SphereGeometry(0.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)),
    M(0xcdb586, 0.95),
  );
  m.scale.set(1.2, 0.35, 1);
  m.receiveShadow = true;
  return m;
}

// ---- Birds -------------------------------------------------------------------------
export function makeBird(kind: 'gull' | 'pigeon') {
  const g = new THREE.Group();
  const bodyM = M(kind === 'gull' ? 0xf4f4f0 : 0x8a92a3, 0.7);
  const wingM = M(kind === 'gull' ? 0x9aa3ad : 0x6f7787, 0.7);
  const body = sphere(kind === 'gull' ? 0.16 : 0.12, bodyM, 10, 8);
  body.scale.set(1.5, 0.9, 0.9);
  body.position.y = 0.2;
  g.add(body);
  const head = sphere(kind === 'gull' ? 0.08 : 0.065, kind === 'gull' ? bodyM : M(0x5c6473, 0.6), 8, 6);
  head.position.set(0.2, 0.32, 0);
  g.add(head);
  const beak = cyl(0.0, 0.025, 0.09, M(kind === 'gull' ? 0xf2c230 : 0x3a3a3a, 0.5), 6);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.3, 0.31, 0);
  g.add(beak);
  const wings: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.25, s * 0.08);
    const w = box(0.22, 0.02, kind === 'gull' ? 0.42 : 0.26, wingM);
    w.position.z = s * (kind === 'gull' ? 0.2 : 0.13);
    pivot.add(w);
    g.add(pivot);
    wings.push(pivot);
  }
  shadowed(g);
  return { group: g, wings };
}

// ---- Landmarks ---------------------------------------------------------------------
/** A bronze monkey on a plinth, for the end of the pier. */
export function makeMonkeyStatue() {
  const g = new THREE.Group();
  const bronze = M(0x7a5a32, 0.35, 0.75);
  const plinth = box(1.4, 1.0, 1.4, M(0xb9b1a0, 0.8));
  plinth.position.y = 0.5;
  g.add(plinth);
  const body = sphere(0.45, bronze);
  body.scale.set(0.9, 1.2, 0.85);
  body.position.y = 1.55;
  g.add(body);
  const head = sphere(0.3, bronze);
  head.position.set(0.1, 2.25, 0);
  g.add(head);
  const face = sphere(0.18, M(0x9a7a48, 0.35, 0.7));
  face.scale.set(0.6, 0.9, 1);
  face.position.set(0.32, 2.2, 0);
  g.add(face);
  for (const s of [-1, 1]) {
    const ear = sphere(0.09, bronze);
    ear.position.set(0.05, 2.32, s * 0.3);
    g.add(ear);
    g.add(rod(V(0.1, 1.85, s * 0.35), V(0.45, 1.3, s * 0.25), 0.07, bronze));
    g.add(rod(V(-0.05, 1.15, s * 0.22), V(0.45, 1.05, s * 0.3), 0.09, bronze));
  }
  g.add(rod(V(-0.35, 1.2, 0), V(-0.8, 1.6, 0.2), 0.05, bronze));
  shadowed(g);
  return g;
}

/** El Dimoni: a big papier-mâché devil on a woodpile, ready for the Cremada. */
export function makeDimoni() {
  const g = new THREE.Group();
  const red = M(0xc8322a, 0.6), dark = M(0x2a1a1a, 0.7), wood = M(0x8a6a4a, 0.9), gold = M(0xffb020, 0.4, 0.4);
  // Woodpile.
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const log = rod(V(Math.cos(a) * 1.8, 0, Math.sin(a) * 1.8), V(Math.cos(a) * 0.4, 1.4, Math.sin(a) * 0.4), 0.12, wood, 6);
    g.add(log);
  }
  const figure = new THREE.Group();
  figure.position.y = 1.3;
  g.add(figure);
  const body = capsule(0.7, 1.4, red);
  body.position.y = 1.4;
  figure.add(body);
  const belly = sphere(0.55, M(0xe8a23a, 0.6));
  belly.position.set(0.35, 1.2, 0);
  belly.scale.set(0.6, 1, 1);
  figure.add(belly);
  const head = sphere(0.6, red);
  head.position.y = 3.0;
  figure.add(head);
  for (const s of [-1, 1]) {
    const horn = cyl(0.0, 0.16, 0.7, gold, 8);
    horn.position.set(0, 3.6, s * 0.35);
    horn.rotation.x = s * -0.5;
    figure.add(horn);
    const eye = sphere(0.1, M(0xffffff, 0.3));
    eye.position.set(0.5, 3.15, s * 0.2);
    figure.add(eye);
    const pupil = sphere(0.05, dark);
    pupil.position.set(0.58, 3.15, s * 0.2);
    figure.add(pupil);
    const arm = rod(V(0, 2.1, s * 0.7), V(0.5, 2.9, s * 1.4), 0.17, red);
    figure.add(arm);
  }
  const grin = box(0.1, 0.12, 0.5, dark);
  grin.position.set(0.55, 2.8, 0);
  figure.add(grin);
  // A pitchfork.
  figure.add(rod(V(0.6, 0.4, 1.4), V(0.6, 4.2, 1.4), 0.05, dark));
  for (const dz of [-0.2, 0, 0.2]) {
    figure.add(rod(V(0.6, 4.0, 1.4 + dz), V(0.6, 4.5, 1.4 + dz), 0.03, dark));
  }
  shadowed(g);
  return { group: g, figure };
}

// ---- Quest props -------------------------------------------------------------------
export function makeCat(color = 0xd98a3a) {
  const g = new THREE.Group();
  const fur = M(color, 0.8), dark = M(new THREE.Color(color).multiplyScalar(0.7).getHex(), 0.8);
  const body = capsule(0.09, 0.22, fur);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.17;
  g.add(body);
  const head = sphere(0.09, fur);
  head.position.set(0.2, 0.28, 0);
  g.add(head);
  for (const s of [-1, 1]) {
    const ear = cyl(0, 0.04, 0.07, dark, 4);
    ear.position.set(0.2, 0.38, s * 0.05);
    g.add(ear);
    const eye = sphere(0.014, M(0x8bcb3c, 0.3));
    eye.position.set(0.28, 0.3, s * 0.035);
    g.add(eye);
  }
  for (const [x, z] of [[0.12, -0.05], [0.12, 0.05], [-0.12, -0.05], [-0.12, 0.05]]) {
    const l = capsule(0.025, 0.1, fur);
    l.position.set(x, 0.07, z);
    g.add(l);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.2, 0.2, 0);
  const t = capsule(0.022, 0.24, dark);
  t.position.y = 0.12;
  t.rotation.z = 0.3;
  tail.add(t);
  g.add(tail);
  shadowed(g);
  return { group: g, tail };
}

export function makeFruitCrate() {
  const g = new THREE.Group();
  const wood = M(0xb08a5a, 0.85);
  const crate = box(0.8, 0.35, 0.55, wood);
  crate.position.y = 0.6;
  g.add(crate);
  const stand = box(0.9, 0.42, 0.65, M(0x6b5a48, 0.85));
  stand.position.y = 0.21;
  g.add(stand);
  const oranges: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const o = sphere(0.075, M(0xf28a1e, 0.6), 10, 8);
    o.position.set(-0.26 + (i % 3) * 0.26, 0.84, -0.15 + Math.floor(i / 3) * 0.15);
    o.userData.dynamic = true;
    g.add(o);
    oranges.push(o);
  }
  shadowed(g);
  return { group: g, oranges };
}

export function makeFishingRod() {
  const g = new THREE.Group();
  g.add(rod(V(0, 0, 0), V(2.6, 1.6, 0), 0.015, M(0x2a2f3d, 0.5)));
  const line = rod(V(2.6, 1.6, 0), V(2.9, -2.6, 0), 0.003, M(0xf4f1ea, 0.5), 3);
  g.add(line);
  return g;
}
