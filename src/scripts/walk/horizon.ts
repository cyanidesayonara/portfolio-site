/*
  Distant scenery: flat silhouettes far beyond the playable town, faded into the
  current fog color every frame so they sit in the haze by day, go gray in the
  rain and dark at night. Two layers of hills inland (+Z), and the big city's
  skyline down the coast to the southwest (+X), behind the three chimneys.
  The hills run down to a headland on the coast to the northeast (-X).
  Nothing here is named on screen.
*/
import * as THREE from 'three';

type Pt2 = [number, number];

/** Non-indexed triangles with per-vertex shade, filled in world space. */
class Silhouettes {
  pos: number[] = [];
  col: number[] = [];

  private push(x: number, y: number, z: number, shade: number) {
    this.pos.push(x, y, z);
    this.col.push(shade, shade, shade);
  }

  /**
    A flat card at (cx, cz), turned to face the origin (where the town is), with a
    profile in local (u across, v up) meters. Profiles are simple polygons.
  */
  card(cx: number, cz: number, baseY: number, profile: Pt2[], shade: number, scale = 1) {
    const d = Math.hypot(cx, cz) || 1;
    // Unit vector along the card: perpendicular to the line of sight.
    const ux = -cz / d, uz = cx / d;
    const contour = profile.map(([u, v]) => new THREE.Vector2(u, v));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const t of tris) {
      for (const idx of t) {
        const [u, v] = profile[idx];
        this.push(cx + ux * u * scale, baseY + v * scale, cz + uz * u * scale, shade);
      }
    }
  }

  /** A ridge along an arc around the origin: angle phi from +Z toward +X. */
  ridge(radius: number, phi0: number, phi1: number, steps: number, baseY: number, height: (phi: number) => number, topShade: number, footShade: number) {
    for (let i = 0; i < steps; i++) {
      const a = phi0 + ((phi1 - phi0) * i) / steps;
      const b = phi0 + ((phi1 - phi0) * (i + 1)) / steps;
      const ax = Math.sin(a) * radius, az = Math.cos(a) * radius;
      const bx = Math.sin(b) * radius, bz = Math.cos(b) * radius;
      const ha = baseY + height(a), hb = baseY + height(b);
      // The foot runs well below the horizon so no sky shows between the town and the hills.
      const foot = baseY - 160;
      this.push(ax, foot, az, footShade); this.push(bx, foot, bz, footShade); this.push(bx, hb, bz, topShade);
      this.push(ax, foot, az, footShade); this.push(bx, hb, bz, topShade); this.push(ax, ha, az, topShade);
    }
  }

  mesh(base: number, haze: number) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
    const baseColor = new THREE.Color(base);
    const m = new THREE.Mesh(g, mat);
    // Atmospheric perspective: lean toward whatever the fog (horizon) color is now.
    m.onBeforeRender = (_r, scene) => {
      const fog = scene.fog as THREE.Fog | null;
      mat.color.copy(baseColor);
      if (fog) mat.color.lerp(fog.color, haze);
    };
    m.frustumCulled = false;
    m.userData.always = true;
    m.userData.dynamic = true; // never merged by the baker: it has its own material logic
    return m;
  }
}

const wave = (phi: number, terms: [number, number, number][]) => terms.reduce((h, [amp, freq, ph]) => h + amp * Math.sin(phi * freq + ph), 0);
const DEG = Math.PI / 180;

/** The coastal range inland: a near, darker ridge in front of a taller, hazier one. */
export function makeInlandHills(baseY: number): THREE.Object3D {
  const g = new THREE.Group();
  const far = new Silhouettes();
  far.ridge(1320, -84 * DEG, 58 * DEG, 96, baseY, (p) => 150 + wave(-p, [[38, 3.1, 0.6], [22, 7.3, 1.9], [9, 15.7, 0.3]]), 0.92, 1.08);
  g.add(far.mesh(0x6c8a74, 0.5));
  const near = new Silhouettes();
  near.ridge(1120, -78 * DEG, 50 * DEG, 96, baseY, (p) => 78 + wave(-p, [[26, 4.3, 2.2], [14, 9.1, 0.4], [6, 21.0, 1.1]]), 0.88, 1.06);
  // A wooded headland where the coast bends seaward to the northeast.
  near.card(-1150, -330, baseY, [[-190, 0], [190, 0], [150, 16], [90, 46], [40, 66], [0, 72], [-50, 64], [-110, 40], [-160, 14]], 0.86);
  g.add(near.mesh(0x557a4e, 0.3));
  g.userData.always = true;
  return g;
}

/** The city down the coast: low hill with a castle, the sail hotel, twin towers, the bullet tower, basilica spires, and the ridge with its TV mast. */
export function makeCitySkyline(baseY: number): THREE.Object3D {
  const sil = new Silhouettes();
  // Placed down the coast to the southwest (+X); profiles are drawn as if seen from town, so
  // flip their across axis to keep the sea on the left and the ridge on the right.
  const s = { card: (cx: number, cz: number, y: number, profile: Pt2[], shade: number, scale = 1) => sil.card(cx, cz, y, profile.map(([u, v]) => [-u, v] as Pt2), shade, scale) };
  const K = 1.6; // landmark scale: big enough to read at 1.2-1.4 km
  // Seaward end: a long hill with a squat castle on top.
  s.card(1400, -230, baseY, [[-140, 0], [140, 0], [110, 18], [60, 42], [20, 55], [8, 55], [8, 62], [-8, 62], [-8, 55], [-30, 52], [-80, 34], [-120, 14]], 1.04);
  // The sail-shaped hotel at the harbor mouth.
  s.card(1340, -330, baseY, [[-11, 0], [12, 0], [10, 20], [6, 36], [-2, 48], [-8, 52], [-9, 30]], 0.95, K);
  // A low, ragged band of city blocks along the shore, so the towers rise out of something.
  const band: Pt2[] = [[-300, 0], [300, 0]];
  for (let u = 300, i = 0; u > -300; u -= 14, i++) {
    const h = 9 + ((i * 37) % 11) + ((i * 13) % 5);
    band.push([u, h], [u - 14, h]);
  }
  s.card(1260, -70, baseY, band, 1.0);
  // Twin towers by the beach.
  s.card(1150, -165, baseY, [[-30, 0], [-14, 0], [-14, 72], [-30, 72]], 0.88, K);
  s.card(1150, -165, baseY, [[14, 0], [30, 0], [30, 70], [14, 70]], 0.88, K);
  // The bullet-shaped tower.
  const bullet: Pt2[] = [[-9, 0], [9, 0], [9, 44]];
  for (let i = 1; i < 10; i++) { const a = (i / 10) * Math.PI; bullet.push([Math.cos(a) * 9, 44 + Math.sin(a) * 18]); }
  bullet.push([-9, 44]);
  s.card(1230, -45, baseY, bullet, 0.92, K);
  // The basilica: a long body and a cluster of tapering spires.
  s.card(1270, 45, baseY, [[-30, 0], [30, 0], [30, 26], [-30, 26]], 0.94, K);
  for (const [u, h, w] of [[-20, 58, 4], [-11, 66, 4.5], [-2, 84, 5.5], [8, 70, 4.5], [17, 62, 4], [25, 52, 3.5]] as [number, number, number][]) {
    s.card(1270, 45, baseY, [[u - w, 20], [u + w, 20], [u + w * 0.55, h * 0.8], [u, h], [u - w * 0.55, h * 0.8]], 0.94, K);
  }
  // Inland: the long ridge behind the city, with a needle-thin TV mast and a temple bump.
  const R = 0.62;
  s.card(1440, 320, baseY, [[-360, 0], [360, 0], [300, 40], [220, 70], [150, 96], [90, 112], [40, 124], [10, 128], [-30, 122], [-90, 104], [-170, 84], [-260, 56], [-320, 28]], 1.08, R);
  s.card(1440, 320, baseY, [[-3, 120], [3, 120], [1.5, 185], [-1.5, 185]], 1.02, R);
  s.card(1440, 320, baseY, [[-62, 100], [-44, 100], [-46, 116], [-53, 126], [-60, 116]], 1.08, R);
  return sil.mesh(0x4c5768, 0.42);
}
