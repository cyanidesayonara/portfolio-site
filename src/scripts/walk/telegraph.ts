/*
  Reusable 3D ground telegraphs (rings, lanes, safe-zone beacons), math hit
  tests, and camera trauma / hitstop helpers for chases and boss fights.
*/
import * as THREE from 'three';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** True when (px, pz) lies inside the circle centered at (cx, cz) with radius r. */
export function inRing(px: number, pz: number, cx: number, cz: number, r: number): boolean {
  const dx = px - cx, dz = pz - cz;
  return dx * dx + dz * dz <= r * r;
}

/** True when (px, pz) lies inside the rectangle from (x0, z0) to (x1, z1) with half-width halfW. */
export function inLane(px: number, pz: number, x0: number, z0: number, x1: number, z1: number, halfW: number): boolean {
  const dx = x1 - x0, dz = z1 - z0;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-9) return inRing(px, pz, x0, z0, halfW);
  const len = Math.sqrt(len2);
  const ux = dx / len, uz = dz / len;
  const rx = px - x0, rz = pz - z0;
  const along = rx * ux + rz * uz;
  const perp = Math.abs(-rx * uz + rz * ux);
  return along >= 0 && along <= len && perp <= halfW;
}

/** True when (px, pz) lies inside the wedge centered at (cx, cz) facing dirAngle (atan2(dz, dx)). */
export function inSector(px: number, pz: number, cx: number, cz: number, dirAngle: number, halfAngle: number, r: number): boolean {
  const dx = px - cx, dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 > r * r) return false;
  if (d2 < 1e-9) return true;
  const ang = Math.atan2(dz, dx);
  const diff = Math.atan2(Math.sin(ang - dirAngle), Math.cos(ang - dirAngle));
  return Math.abs(diff) <= halfAngle;
}

/** Camera trauma shake and brief hitstop time dilation for threat and boss impacts. */
export class FeelState {
  trauma = 0;
  hitstopT = 0;
  private t = 0;

  kick(amount: number) {
    this.trauma = Math.min(1, this.trauma + Math.max(0, amount));
  }

  hitstop(sec: number) {
    this.hitstopT = Math.max(this.hitstopT, Math.max(0, sec));
  }

  step(dt: number): { simScale: number; shakeX: number; shakeY: number } {
    this.t += dt;
    const simScale = this.hitstopT > 0 ? 0.18 : 1;
    if (this.hitstopT > 0) this.hitstopT = Math.max(0, this.hitstopT - dt);
    const s = this.trauma * this.trauma;
    const shakeX = s ? s * 0.42 * (Math.sin(this.t * 47) + Math.cos(this.t * 31) * 0.5) : 0;
    const shakeY = s ? s * 0.34 * (Math.cos(this.t * 53) + Math.sin(this.t * 29) * 0.5) : 0;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    return { simScale, shakeX, shakeY };
  }
}

interface RingEntry {
  group: THREE.Group;
  border: THREE.Mesh;
  fill: THREE.Mesh;
  borderMat: THREE.MeshBasicMaterial;
  fillMat: THREE.MeshBasicMaterial;
}

interface LaneEntry {
  group: THREE.Group;
  border: THREE.LineSegments;
  fill: THREE.Mesh;
  borderMat: THREE.LineBasicMaterial;
  fillMat: THREE.MeshBasicMaterial;
}

interface BeaconEntry {
  group: THREE.Group;
  outer: THREE.Mesh;
  inner: THREE.Mesh;
  outerMat: THREE.MeshBasicMaterial;
  innerMat: THREE.MeshBasicMaterial;
}

/** Pre-allocated pool of ground warning rings, lanes, and escape-zone beacons. */
export class TelegraphPool {
  private rings: RingEntry[] = [];
  private lanes: LaneEntry[] = [];
  private beacons: BeaconEntry[] = [];
  private ringUsed = 0;
  private laneUsed = 0;
  private beaconUsed = 0;
  private sharedGeos: THREE.BufferGeometry[];

  constructor(scene: THREE.Scene) {
    const ringBorderGeo = new THREE.RingGeometry(0.88, 1, 32);
    ringBorderGeo.rotateX(-Math.PI / 2);
    const ringFillGeo = new THREE.CircleGeometry(1, 32);
    ringFillGeo.rotateX(-Math.PI / 2);
    const laneSquare = new THREE.PlaneGeometry(1, 1);
    laneSquare.rotateX(-Math.PI / 2);
    laneSquare.translate(0.5, 0, 0);
    const laneEdgeGeo = new THREE.EdgesGeometry(laneSquare);
    const beaconInnerGeo = new THREE.RingGeometry(0.45, 0.58, 32);
    beaconInnerGeo.rotateX(-Math.PI / 2);

    this.sharedGeos = [ringBorderGeo, ringFillGeo, laneSquare, laneEdgeGeo, beaconInnerGeo];

    for (let i = 0; i < 8; i++) {
      const group = new THREE.Group();
      const borderMat = new THREE.MeshBasicMaterial({ color: 0xff5a36, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
      const fillMat = new THREE.MeshBasicMaterial({ color: 0xff5a36, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
      const border = new THREE.Mesh(ringBorderGeo, borderMat);
      const fill = new THREE.Mesh(ringFillGeo, fillMat);
      fill.position.y = -0.002;
      group.renderOrder = 4;
      group.add(border, fill);
      group.visible = false;
      scene.add(group);
      this.rings.push({ group, border, fill, borderMat, fillMat });
    }

    for (let i = 0; i < 4; i++) {
      const group = new THREE.Group();
      const borderMat = new THREE.LineBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.88, depthWrite: false });
      const fillMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide });
      const border = new THREE.LineSegments(laneEdgeGeo, borderMat);
      const fill = new THREE.Mesh(laneSquare, fillMat);
      fill.position.y = -0.002;
      group.renderOrder = 4;
      group.add(border, fill);
      group.visible = false;
      scene.add(group);
      this.lanes.push({ group, border, fill, borderMat, fillMat });
    }

    for (let i = 0; i < 4; i++) {
      const group = new THREE.Group();
      const outerMat = new THREE.MeshBasicMaterial({ color: 0x5eea8c, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
      const innerMat = new THREE.MeshBasicMaterial({ color: 0x5eea8c, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
      const outer = new THREE.Mesh(ringBorderGeo, outerMat);
      const inner = new THREE.Mesh(beaconInnerGeo, innerMat);
      group.renderOrder = 4;
      group.add(outer, inner);
      group.visible = false;
      scene.add(group);
      this.beacons.push({ group, outer, inner, outerMat, innerMat });
    }
  }

  beginFrame() {
    this.ringUsed = 0;
    this.laneUsed = 0;
    this.beaconUsed = 0;
    for (const r of this.rings) r.group.visible = false;
    for (const l of this.lanes) l.group.visible = false;
    for (const b of this.beacons) b.group.visible = false;
  }

  ring(x: number, y: number, z: number, r: number, fill01: number, color: number) {
    const e = this.rings[this.ringUsed++];
    if (!e) return;
    const f = clamp01(fill01);
    const urgent = f > 0.85;
    e.group.visible = true;
    e.group.position.set(x, y, z);
    e.border.scale.set(r, 1, r);
    const s = Math.max(0.05, f) * r;
    e.fill.scale.set(s, 1, s);
    e.borderMat.color.setHex(urgent ? 0xffffff : color);
    e.borderMat.opacity = urgent ? 0.96 : 0.82;
    e.fillMat.color.setHex(color);
    e.fillMat.opacity = urgent ? 0.42 : 0.24;
  }

  lane(x0: number, z0: number, x1: number, z1: number, y: number, width: number, fill01: number, color: number) {
    const e = this.lanes[this.laneUsed++];
    if (!e) return;
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) return;
    const f = clamp01(fill01);
    const urgent = f > 0.85;
    e.group.visible = true;
    e.group.position.set(x0, y, z0);
    e.group.rotation.y = -Math.atan2(dz, dx);
    e.border.scale.set(len, 1, width);
    e.fill.scale.set(Math.max(0.05, f) * len, 1, width * 0.92);
    e.borderMat.color.setHex(urgent ? 0xffffff : color);
    e.borderMat.opacity = urgent ? 0.95 : 0.82;
    e.fillMat.color.setHex(color);
    e.fillMat.opacity = urgent ? 0.36 : 0.22;
  }

  beacon(x: number, y: number, z: number, r: number, time: number, color: number) {
    const e = this.beacons[this.beaconUsed++];
    if (!e) return;
    const pulse = 0.5 + 0.5 * Math.sin(time * 5);
    e.group.visible = true;
    e.group.position.set(x, y, z);
    e.outer.scale.setScalar(r * (0.94 + pulse * 0.1));
    e.inner.scale.setScalar(r * (0.68 + (1 - pulse) * 0.25));
    e.outerMat.color.setHex(color);
    e.outerMat.opacity = 0.55 + pulse * 0.3;
    e.innerMat.color.setHex(color);
    e.innerMat.opacity = 0.3 + pulse * 0.25;
  }

  dispose() {
    for (const g of this.sharedGeos) g.dispose();
    for (const r of this.rings) { r.borderMat.dispose(); r.fillMat.dispose(); }
    for (const l of this.lanes) { l.borderMat.dispose(); l.fillMat.dispose(); }
    for (const b of this.beacons) { b.outerMat.dispose(); b.innerMat.dispose(); }
  }
}
