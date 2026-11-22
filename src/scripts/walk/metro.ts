/*
  The metro entrance on the Rambla: an open stairwell in the pavement, going
  down toward +x to a lit landing, with stainless railings and glass on three
  sides and a totem by its head (a red diamond with an M, and the line badge).
  Modeled on an underground L2-style station entrance. Like the rest of the
  level it never names the real station: the signs just say Metro.

  The stairs are scenery: a railing collider keeps Millie at the head, and
  the ride down is a cutscene (`playMetroDeparture()` in transit.ts) that
  links to the 2D street's own metro entrance (`/?via=metro`).
*/
import * as THREE from 'three';
import type { MetroDef } from './layout';
import { M, box, cyl, rod, shadowed } from './models';

export interface MetroBuild {
  group: THREE.Group;
  /** Railings around the well (the open head included: the stairs are not walkable). */
  rail: { x0: number; x1: number; z0: number; z1: number; top: number };
  totem: { x: number; z: number; r: number; top: number };
  /** Where the stop trigger sits, at the head of the stairs. */
  head: { x: number; z: number };
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const paint = () => {
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, w, h);
    draw(g);
    t.needsUpdate = true;
  };
  paint();
  document.fonts?.ready.then(paint).catch(() => {});
  return t;
}

const FONT = "'Bricolage Grotesque Variable', 'Bricolage Grotesque', system-ui, sans-serif";

/** The totem's sign: a red diamond with a white M, the line badge under it. */
function totemTexture(line: string, lineColor: string) {
  return canvasTex(256, 384, (g) => {
    g.fillStyle = '#2a2f3d';
    g.fillRect(0, 0, 256, 384);
    g.save();
    g.translate(128, 120);
    g.rotate(Math.PI / 4);
    g.fillStyle = '#d52b1e';
    g.fillRect(-72, -72, 144, 144);
    g.restore();
    g.fillStyle = '#f4f1ea';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 120px ${FONT}`;
    g.fillText('M', 128, 126);
    g.fillStyle = lineColor;
    g.beginPath();
    g.roundRect(68, 252, 120, 80, 14);
    g.fill();
    g.fillStyle = '#f4f1ea';
    g.font = `800 60px ${FONT}`;
    g.fillText(line, 128, 294);
  });
}

/** The lintel sign across the head of the stairs. */
function lintelTexture(line: string, lineColor: string) {
  return canvasTex(640, 96, (g) => {
    g.fillStyle = '#14203d';
    g.fillRect(0, 0, 640, 96);
    g.fillStyle = '#d52b1e';
    g.save();
    g.translate(56, 48);
    g.rotate(Math.PI / 4);
    g.fillRect(-26, -26, 52, 52);
    g.restore();
    g.fillStyle = '#f4f1ea';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 44px ${FONT}`;
    g.fillText('M', 56, 50);
    g.textAlign = 'left';
    g.font = `800 46px ${FONT}`;
    g.fillText('Metro', 110, 50);
    g.fillStyle = lineColor;
    g.beginPath();
    g.roundRect(262, 22, 84, 52, 10);
    g.fill();
    g.fillStyle = '#f4f1ea';
    g.textAlign = 'center';
    g.font = `800 36px ${FONT}`;
    g.fillText(line, 304, 49);
    g.textAlign = 'left';
    g.font = `700 24px ${FONT}`;
    g.fillStyle = '#c9cfdf';
    g.fillText('TO 2D STREET', 370, 50);
  });
}

/** Ground pieces around the stairwell's hole: the caller lays its slabs over these rectangles. */
export function groundAroundMetro(x0: number, x1: number, z0: number, z1: number, m: MetroDef): [number, number, number, number][] {
  return [
    [x0, x1, z0, m.z0],
    [x0, x1, m.z1, z1],
    [x0, m.x0, m.z0, m.z1],
    [m.x1, x1, m.z0, m.z1],
  ];
}

export function makeMetroEntrance(m: MetroDef, groundY: number): MetroBuild {
  const group = new THREE.Group();
  const len = m.x1 - m.x0;
  const wid = m.z1 - m.z0;
  const zc = (m.z0 + m.z1) / 2;
  const bottom = groundY - m.depth;
  const landing = 1.3;
  const steps = 16;
  const run = (len - landing) / steps;
  const rise = m.depth / steps;

  const stepM = M(0xb9b4aa, 0.85);
  const noseM = M(0xe6c23a, 0.6);
  const wallM = M(0xdfe2e6, 0.55);
  const tileM = M(0x9b2d8f, 0.5);
  const steelM = M(0xb9c0c8, 0.3, 0.8);
  const graniteM = M(0x8d8a84, 0.8);
  const darkM = M(0x1d1f26, 0.9);

  // Steps: each tread a slab, its riser the slab's front face, darker the deeper they go.
  const deep = new THREE.Color(0x5f5c57);
  for (let i = 0; i < steps; i++) {
    const top = groundY - (i + 1) * rise;
    const shade = stepM.color.clone().lerp(deep, i / (steps - 1));
    const s = box(run, rise + 0.02, wid, M(shade.getHex(), 0.85));
    s.position.set(m.x0 + (i + 0.5) * run, top - rise / 2 + 0.01, zc);
    s.receiveShadow = true;
    group.add(s);
    const nose = box(0.05, 0.012, wid - 0.1, noseM);
    nose.position.set(m.x0 + i * run + 0.03, top + 0.007, zc);
    group.add(nose);
  }
  // The landing, the end wall with the station hall's lit doorway, the side walls.
  const land = box(landing, 0.2, wid, M(0x8a8c90, 0.8));
  land.position.set(m.x1 - landing / 2, bottom - 0.1, zc);
  group.add(land);
  const endWall = box(0.2, m.depth + 0.4, wid + 0.4, wallM);
  endWall.position.set(m.x1 + 0.1, bottom + (m.depth + 0.4) / 2 - 0.2, zc);
  group.add(endWall);
  const door = box(0.04, 2.1, wid * 0.62, M(0xfff1cc, 0.4, 0, { emissive: 0xffe6a8, emissiveIntensity: 0.9 }));
  door.position.set(m.x1 - 0.01, bottom + 1.05, zc);
  group.add(door);
  for (const z of [m.z0 - 0.1, m.z1 + 0.1]) {
    const wall = box(len + 0.2, m.depth + 0.4, 0.2, wallM);
    wall.position.set(m.x0 + len / 2, bottom + (m.depth + 0.4) / 2 - 0.2, z);
    group.add(wall);
    // A band of the line's color along the wall, stepping down with the stairs.
    const band = box(len - landing, 0.18, 0.02, tileM);
    band.position.set(m.x0 + (len - landing) / 2, groundY - m.depth / 2 + 0.9, z + (z < zc ? 0.11 : -0.11));
    band.rotation.z = -Math.atan2(m.depth, len - landing);
    group.add(band);
    // Handrails down both walls.
    const hz = z + (z < zc ? 0.16 : -0.16);
    group.add(rod(new THREE.Vector3(m.x0 + 0.1, groundY + 0.9, hz), new THREE.Vector3(m.x1 - landing, bottom + 0.9, hz), 0.025, steelM, 6));
  }
  // Fill under the stairs so nothing shows through from below.
  const fill = box(len, 0.1, wid + 0.4, darkM);
  fill.position.set(m.x0 + len / 2, bottom - 0.25, zc);
  group.add(fill);

  // Granite coping around the well, then stainless posts, rails and glass.
  const cope = 0.32;
  for (const [cx, cz, w, d] of [
    [m.x0 + len / 2, m.z0 - cope / 2, len + cope * 2, cope],
    [m.x0 + len / 2, m.z1 + cope / 2, len + cope * 2, cope],
    [m.x1 + cope / 2, zc, cope, wid],
  ] as const) {
    const cp = box(w, 0.22, d, graniteM);
    cp.position.set(cx, groundY + 0.11, cz);
    cp.receiveShadow = true;
    group.add(cp);
  }
  const railTop = groundY + 1.08;
  const glassM = new THREE.MeshStandardMaterial({ color: 0xbfe3f2, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false });
  const sides: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(m.x0 - 0.05, 0, m.z0 - cope / 2), new THREE.Vector3(m.x1 + cope / 2, 0, m.z0 - cope / 2)],
    [new THREE.Vector3(m.x0 - 0.05, 0, m.z1 + cope / 2), new THREE.Vector3(m.x1 + cope / 2, 0, m.z1 + cope / 2)],
    [new THREE.Vector3(m.x1 + cope / 2, 0, m.z0 - cope / 2), new THREE.Vector3(m.x1 + cope / 2, 0, m.z1 + cope / 2)],
  ];
  for (const [a, b] of sides) {
    const at = (y: number, v: THREE.Vector3) => new THREE.Vector3(v.x, y, v.z);
    group.add(rod(at(railTop, a), at(railTop, b), 0.035, steelM, 6));
    const span = a.distanceTo(b);
    const n = Math.max(1, Math.round(span / 1.4));
    for (let k = 0; k <= n; k++) {
      const p = a.clone().lerp(b, k / n);
      group.add(rod(at(groundY + 0.22, p), at(railTop, p), 0.025, steelM, 6));
    }
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(span, railTop - groundY - 0.36), glassM);
    glass.position.set((a.x + b.x) / 2, (groundY + 0.26 + railTop - 0.04) / 2, (a.z + b.z) / 2);
    glass.rotation.y = Math.abs(a.x - b.x) > Math.abs(a.z - b.z) ? 0 : Math.PI / 2;
    group.add(glass);
  }
  // A lintel over the head on two slim posts: "Metro" and the line badge.
  for (const z of [m.z0 - cope / 2, m.z1 + cope / 2]) {
    const post = cyl(0.05, 0.05, 2.6, steelM, 8);
    post.position.set(m.x0 - 0.05, groundY + 1.3, z);
    group.add(post);
  }
  const lintelMat = new THREE.MeshStandardMaterial({ map: lintelTexture(m.line, m.lineColor), roughness: 0.6 });
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(wid + cope, 0.42, 0.1), [darkM, darkM, darkM, darkM, lintelMat, lintelMat]);
  // Turned a quarter so its faces look along x: toward the Rambla and down the stairs.
  lintel.rotation.y = Math.PI / 2;
  lintel.position.set(m.x0 - 0.05, groundY + 2.55, zc);
  group.add(lintel);

  // The totem by the head of the stairs.
  const tx = m.x0 - 0.7, tz = m.z1 + 0.75;
  const pole = cyl(0.07, 0.09, 2.2, M(0x5c6473, 0.5, 0.5), 10);
  pole.position.set(tx, groundY + 1.1, tz);
  group.add(pole);
  const signMat = new THREE.MeshStandardMaterial({ map: totemTexture(m.line, m.lineColor), roughness: 0.5 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.99, 0.08), [darkM, darkM, darkM, darkM, signMat, signMat]);
  sign.position.set(tx, groundY + 2.65, tz);
  sign.rotation.y = -Math.PI / 2 + 0.35;
  group.add(sign);

  shadowed(group, true, true);
  return {
    group,
    rail: { x0: m.x0 + 0.15, x1: m.x1 + cope, z0: m.z0 - cope, z1: m.z1 + cope, top: groundY + 1.1 },
    totem: { x: tx, z: tz, r: 0.09, top: groundY + 3.2 },
    head: { x: m.x0 - 1.1, z: zc },
  };
}
