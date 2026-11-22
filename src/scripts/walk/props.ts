/*
  Badalona-specific street furniture, landmarks and characters, built from
  the photo reference: cast-iron lanterns on the Rambla, spotlight masts on
  the seafront, square café umbrellas, tamarisks, the pier's legs and
  railings, the distillery chimney, the Tres Xemeneies on the horizon,
  Tofu the cat (from Path of Leash Resistance), and correfoc devils.
*/
import * as THREE from 'three';
import { M, box, cyl, capsule, rod, sphere, shadowed, makeCafeSet, makePerson, type PersonModel } from './models';
import { rng } from './textures';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Classic dark cast-iron lantern post (the Rambla), ~4.6 m. */
export function makeLanternPost() {
  const g = new THREE.Group();
  const ironG = M(0x1f2a24, 0.45, 0.55);
  const base = cyl(0.2, 0.26, 0.6, ironG, 10);
  base.position.y = 0.3;
  g.add(base);
  const col = cyl(0.07, 0.1, 3.6, ironG, 10);
  col.position.y = 2.4;
  g.add(col);
  for (const y of [0.9, 2.0]) {
    const ring = cyl(0.12, 0.12, 0.08, ironG, 10);
    ring.position.y = y;
    g.add(ring);
  }
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xe8ecef, emissive: 0xffd88a, emissiveIntensity: 0.05, roughness: 0.2 });
  const lantern = cyl(0.22, 0.14, 0.55, glassMat, 6);
  lantern.position.y = 4.5;
  g.add(lantern);
  const cap = cyl(0.04, 0.3, 0.22, ironG, 6);
  cap.position.y = 4.88;
  g.add(cap);
  const fin = sphere(0.05, ironG);
  fin.position.y = 5.02;
  g.add(fin);
  shadowed(g);
  return { group: g, glass: glassMat, lightY: 4.4, radius: 0.1 };
}

/** Tall grey mast with a cluster of spotlights (the seafront promenade). */
export function makeSpotMast() {
  const g = new THREE.Group();
  const grey = M(0x9a9a9a, 0.4, 0.6);
  const pole = cyl(0.09, 0.16, 11, grey, 10);
  pole.position.y = 5.5;
  g.add(pole);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xdfe4e8, emissive: 0xfff0d0, emissiveIntensity: 0.05, roughness: 0.3 });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const spot = cyl(0.14, 0.1, 0.32, glassMat, 8);
    spot.position.set(Math.cos(a) * 0.28, 10.9, Math.sin(a) * 0.28);
    spot.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    g.add(spot);
  }
  shadowed(g);
  return { group: g, glass: glassMat, lightY: 10.6, radius: 0.14 };
}

/** Square cream café umbrella over two tables (Rambla terraces). */
export function makeTerrace() {
  const g = new THREE.Group();
  const cream = M(0xefe8da, 0.85, 0, { side: THREE.DoubleSide });
  const pole = cyl(0.04, 0.04, 2.5, M(0x8a8f99, 0.4, 0.6), 6);
  pole.position.y = 1.25;
  g.add(pole);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.5, 4, 1, true), cream);
  canopy.rotation.y = Math.PI / 4;
  canopy.position.y = 2.55;
  g.add(canopy);
  for (const [tx, tz] of [[-0.8, -0.8], [0.8, 0.8]]) {
    const t = makeCafeSet(0xefe8da);
    t.children.slice(-2).forEach((c) => t.remove(c)); // drop its round parasol
    t.position.set(tx, 0, tz);
    g.add(t);
  }
  shadowed(g);
  return g;
}

/** Tamarisk: a shaggy, feathery beach tree. */
export function makeTamarisk(seed: number) {
  const r = rng(seed);
  const g = new THREE.Group();
  const bark = M(0x5e4a3a, 0.95);
  const lean = (r() - 0.5) * 0.6;
  g.add(rod(V(0, 0, 0), V(lean, 1.6, 0.2), 0.14, bark, 7));
  for (let k = 0; k < 3; k++) {
    const a = r() * Math.PI * 2;
    g.add(rod(V(lean, 1.5, 0.2), V(lean + Math.cos(a) * 1.2, 2.6, 0.2 + Math.sin(a) * 1.2), 0.07, bark, 6));
  }
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(crownGeo, M(i % 2 ? 0x7f9a6a : 0x6d8a5c, 0.95, 0, { flatShading: true }));
    const a = (i / 7) * Math.PI * 2;
    c.scale.set(1.1, 0.7, 1.1);
    c.position.set(lean + Math.cos(a) * 1.1, 2.7 + r() * 0.5, 0.2 + Math.sin(a) * 1.1);
    g.add(c);
  }
  shadowed(g);
  return { group: g, radius: 0.16 };
}

/** Date palm (Phoenix): slim shaggy trunk, dense arching crown. */
export function makeDatePalm(seed: number, height = 11) {
  const r = rng(seed);
  const g = new THREE.Group();
  const trunkM = M(0x8a6f50, 0.95, 0, { flatShading: true });
  const segs = 8;
  const lean = (r() - 0.5) * 0.12;
  let prev = V(0, 0, 0);
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const p = V(Math.sin(t * 1.3) * lean * height, t * height, Math.cos(t * 0.9) * lean * height * 0.5);
    g.add(rod(prev, p, 0.3 - t * 0.06, trunkM, 7));
    // Shaggy leaf bases.
    if (i % 2 === 0) {
      const knob = sphere(0.36 - t * 0.06, M(0x7a5f42, 1, 0, { flatShading: true }), 7, 5);
      knob.scale.y = 0.5;
      knob.position.copy(p);
      g.add(knob);
    }
    prev = p;
  }
  const crown = new THREE.Group();
  crown.position.copy(prev);
  g.add(crown);
  const frondGeo = (() => {
    const geo = new THREE.PlaneGeometry(3.8, 0.55, 10, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + 1.9;
      const y = pos.getY(i);
      pos.setY(i, y * (1 - x / 4.2));
      pos.setZ(i, -Math.pow(x / 3.8, 2) * 1.8);
      pos.setX(i, x);
    }
    geo.computeVertexNormals();
    return geo;
  })();
  const greens = [M(0x4a6e34, 0.85, 0, { side: THREE.DoubleSide }), M(0x5b7f3e, 0.85, 0, { side: THREE.DoubleSide }), M(0x3f5f2e, 0.85, 0, { side: THREE.DoubleSide })];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const f = new THREE.Mesh(frondGeo, greens[i % 3]);
    f.rotation.order = 'YXZ';
    f.rotation.y = (i / n) * Math.PI * 2 + r() * 0.25;
    f.rotation.x = -Math.PI / 2 + (i % 2 ? 0.15 : 0.55) + r() * 0.2;
    crown.add(f);
  }
  shadowed(g);
  return { group: g, crown, radius: 0.3 };
}

/** Round brick chimney (the old distillery's). */
export function makeChimney(h = 36) {
  const g = new THREE.Group();
  const brick = M(0x8a5a44, 0.9);
  const base = box(4, 4, 4, brick);
  base.position.y = 2;
  g.add(base);
  const shaft = cyl(1.0, 1.7, h, brick, 16);
  shaft.position.y = 4 + h / 2;
  g.add(shaft);
  const crown = cyl(1.25, 1.05, 1.0, M(0x6e4636, 0.9), 16);
  crown.position.y = 4 + h + 0.3;
  g.add(crown);
  shadowed(g);
  return g;
}

/** The three white chimneys of the Sant Adrià power station, for the horizon. */
export function makeXemeneies() {
  const g = new THREE.Group();
  const white = M(0xeceae4, 0.8);
  const band = M(0xd8473a, 0.8);
  [-28, 0, 28].forEach((x) => {
    const c = cyl(3.4, 6, 200, white, 14);
    c.position.set(x, 100, 0);
    g.add(c);
    const b = cyl(3.45, 3.45, 6, band, 14);
    b.position.set(x, 196, 0);
    g.add(b);
  });
  const hall = box(110, 34, 40, white);
  hall.position.set(0, 17, 30);
  g.add(hall);
  return g;
}

/** Steel arch over Carrer del Mar with a round blue street sign. */
export function makeArch(width: number, signTex: THREE.Texture) {
  const g = new THREE.Group();
  const steel = M(0x5a6070, 0.4, 0.7);
  for (const s of [-1, 1]) g.add(rod(V((s * width) / 2, 0, 0), V((s * width) / 2, 5.6, 0), 0.06, steel, 8));
  const curve = new THREE.QuadraticBezierCurve3(V(-width / 2, 5.6, 0), V(0, 7.2, 0), V(width / 2, 5.6, 0));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.06, 6), steel));
  const face = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 24), [M(0x2a5aa8, 0.5), face, face]);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, 6.0, 0);
  g.add(disc);
  shadowed(g);
  return g;
}

/** A line of triangular bunting between two points. */
export function makeBunting(a: THREE.Vector3, b: THREE.Vector3, colors = [0xe5487a, 0xffb020, 0x1fc9b7, 0x8bcb3c, 0xf4f1ea]) {
  const g = new THREE.Group();
  const len = a.distanceTo(b);
  const n = Math.max(2, Math.floor(len / 0.55));
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.16, 0, 0, 0.16, 0, 0, 0, -0.32, 0], 3));
  flagGeo.computeVertexNormals();
  const ang = Math.atan2(b.z - a.z, b.x - a.x);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * 0.6;
    const f = new THREE.Mesh(flagGeo, M(colors[i % colors.length], 0.8, 0, { side: THREE.DoubleSide }));
    f.position.copy(p);
    f.rotation.y = -ang;
    g.add(f);
  }
  g.add(rod(a, b, 0.008, M(0x2a2f3d, 0.5), 3));
  return g;
}

/** Pier support: a pair of splayed concrete legs under a flared cap. */
export function makePierLeg(h: number, w = 4) {
  const g = new THREE.Group();
  const conc = M(0xc8c8c2, 0.85);
  for (const s of [-1, 1]) g.add(rod(V(s * w * 0.12, -h, 0), V(s * w * 0.38, -0.6, 0), 0.3, conc, 10));
  const cap = cyl(0.9, 0.35, 0.6, conc, 12);
  cap.scale.set(w / 1.8, 1, 0.9);
  cap.position.y = -0.3;
  g.add(cap);
  shadowed(g);
  return g;
}

/** Yellow-and-black beacon mast for the end of the pier. */
export function makeBeaconMast() {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const s = cyl(0.16, 0.16, 0.6, M(i % 2 ? 0x1b1b1f : 0xf2c230, 0.5), 10);
    s.position.y = 0.3 + i * 0.6;
    g.add(s);
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffb020, emissiveIntensity: 1.2 });
  const lamp = sphere(0.22, mat);
  lamp.position.y = 5.1;
  g.add(lamp);
  shadowed(g);
  return { group: g, lamp: mat };
}

/** Low concrete curb topped with a dark vertical-bar fence (the railway edge). */
export function railFenceGeometry(len: number) {
  const parts: THREE.BufferGeometry[] = [];
  const curb = new THREE.BoxGeometry(len, 0.3, 0.3);
  curb.translate(0, 0.15, 0);
  parts.push(curb);
  for (const y of [0.42, 1.45]) {
    const rail = new THREE.BoxGeometry(len, 0.04, 0.04);
    rail.translate(0, y, 0);
    parts.push(rail);
  }
  for (let x = -len / 2; x <= len / 2; x += 0.14) {
    const bar = new THREE.BoxGeometry(0.02, 1.15, 0.02);
    bar.translate(x, 0.88, 0);
    parts.push(bar);
  }
  return parts;
}

// ---- Tofu ---------------------------------------------------------------------------
/** Tofu (entities/tofu.gd): white, brown tabby cap and saddle, ringed tail, pink harness. */
export function makeTofu() {
  const g = new THREE.Group();
  const base = M(0xf2ede3, 0.8), patch = M(0xa37547, 0.8), stripe = M(0x6b4a2b, 0.8);
  const body = new THREE.Group();
  g.add(body);
  const torso = capsule(0.1, 0.24, base);
  torso.rotation.z = Math.PI / 2;
  torso.position.y = 0.2;
  body.add(torso);
  const saddle = sphere(0.105, patch);
  saddle.scale.set(1.5, 0.6, 0.95);
  saddle.position.set(-0.02, 0.27, 0);
  body.add(saddle);
  for (let i = 0; i < 3; i++) {
    const s = box(0.03, 0.02, 0.2, stripe);
    s.position.set(-0.08 + i * 0.07, 0.31, 0);
    body.add(s);
  }
  const harness = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.016, 6, 16), M(0xed6b9e, 0.5));
  harness.rotation.y = Math.PI / 2;
  harness.position.set(0.08, 0.21, 0);
  body.add(harness);
  const head = new THREE.Group();
  head.position.set(0.22, 0.31, 0);
  body.add(head);
  const skull = sphere(0.095, base);
  head.add(skull);
  const cap = sphere(0.097, patch);
  cap.scale.set(0.9, 0.55, 1);
  cap.position.set(-0.01, 0.04, 0);
  head.add(cap);
  const muzzle = sphere(0.045, M(0xfcfaf3, 0.8));
  muzzle.position.set(0.08, -0.025, 0);
  head.add(muzzle);
  const nose = sphere(0.012, M(0xe58a9a, 0.5));
  nose.position.set(0.12, -0.005, 0);
  head.add(nose);
  for (const s of [-1, 1]) {
    const ear = cyl(0, 0.045, 0.08, patch, 4);
    ear.position.set(0, 0.1, s * 0.055);
    head.add(ear);
    const eye = sphere(0.016, M(0xb8e04c, 0.25));
    eye.position.set(0.075, 0.025, s * 0.04);
    head.add(eye);
  }
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[0.12, -0.05], [0.12, 0.05], [-0.12, -0.05], [-0.12, 0.05]]) {
    const p = new THREE.Group();
    p.position.set(x, 0.17, z);
    const l = capsule(0.026, 0.1, base);
    l.position.y = -0.09;
    p.add(l);
    body.add(p);
    legs.push(p);
  }
  // Ringed tail, curling up.
  const tail = new THREE.Group();
  tail.position.set(-0.2, 0.24, 0);
  let parent: THREE.Object3D = tail;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Group();
    seg.position.x = i === 0 ? 0 : -0.06;
    seg.rotation.z = i === 0 ? 0.9 : 0.22;
    const m = capsule(0.022, 0.04, i % 2 ? stripe : patch);
    m.rotation.z = Math.PI / 2;
    m.position.x = -0.03;
    seg.add(m);
    parent.add(seg);
    parent = seg;
  }
  body.add(tail);
  shadowed(g);
  const animate = (t: number, speed: number, alert: boolean) => {
    const gait = t * (6 + speed * 3);
    legs.forEach((l, i) => { l.rotation.z = speed > 0.1 ? Math.sin(gait + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.7 : 0; });
    tail.rotation.y = Math.sin(t * (speed > 0.1 ? 10 : 3)) * 0.4;
    tail.rotation.z = alert ? 0.5 : 0;
    body.position.y = alert && speed < 0.1 ? 0.02 + Math.abs(Math.sin(t * 2)) * 0.01 : 0;
    head.rotation.y = Math.sin(t * 0.8) * 0.3;
  };
  return { group: g, animate };
}

// ---- Correfoc -------------------------------------------------------------------------
/** A correfoc devil: dark costume, horns, and a sparkling fire fork. */
export function makeDevil(): { person: PersonModel; spark: THREE.Object3D } {
  const person = makePerson({ top: 0x2a1a1a, trousers: 0x2a1a1a, hair: 0x1a1010, hairStyle: 'short', prop: 'none' });
  for (const s of [-1, 1]) {
    const horn = cyl(0, 0.045, 0.18, M(0xd8473a, 0.5), 6);
    horn.position.set(0.02, 0.22, s * 0.07);
    horn.rotation.x = s * -0.4;
    person.head.add(horn);
  }
  const fork = new THREE.Group();
  fork.add(rod(V(0, 0, 0), V(0, 1.4, 0), 0.02, M(0x2a2f3d, 0.5)));
  const spark = new THREE.Object3D();
  spark.position.y = 1.45;
  fork.add(spark);
  fork.position.set(0, -0.25, 0);
  fork.rotation.z = -0.4;
  (person.arms[1].getObjectByName('fore') as THREE.Group).add(fork);
  return { person, spark };
}
