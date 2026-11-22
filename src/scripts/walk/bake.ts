/*
  Draw-call reduction. The level and characters are built from many small
  meshes for clarity; these helpers merge them before rendering:

  - bakeStatic: every static, opaque, non-emissive mesh under a root is merged
    into one mesh per material "bucket". Plain-colored materials share one
    vertex-colored material (per side / flat-shading / shadow flags), so
    hundreds of props collapse into a few draw calls.
  - collapseRig: inside an animated model, the rigid meshes directly under each
    joint are merged the same way, keeping the joints themselves animatable.
*/
import * as THREE from 'three';

const vcCache = new Map<string, THREE.MeshStandardMaterial>();
export function vcMaterial(side: THREE.Side, flat: boolean) {
  const key = `${side}|${flat}`;
  let m = vcCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.08, side, flatShading: flat });
    vcCache.set(key, m);
  }
  return m;
}

const mergeable = (o: THREE.Object3D): o is THREE.Mesh => {
  const m = o as THREE.Mesh;
  if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || o.userData.dynamic || o.userData.baked) return false;
  if (Array.isArray(m.material)) return false;
  const mat = m.material as THREE.MeshStandardMaterial;
  if (!mat || mat.transparent || !(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) return false;
  if (mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b > 0 || mat.emissiveIntensity > 0.0001) && mat.emissive.getHex() !== 0) return false;
  return true;
};

interface Bucket { mat: THREE.Material; parts: THREE.BufferGeometry[]; cast: boolean; receive: boolean }

function bucketKey(mesh: THREE.Mesh) {
  const mat = mesh.material as THREE.MeshStandardMaterial;
  const textured = !!(mat.map || mat.normalMap || mat.bumpMap);
  const base = textured ? `tex|${mat.uuid}` : `vc|${mat.side}|${mat.flatShading}`;
  return `${base}|${mesh.castShadow}|${mesh.receiveShadow}`;
}

/** Prepare one geometry: transform it, make it non-indexed, and give it the shared attributes. */
function prepared(mesh: THREE.Mesh, matrix: THREE.Matrix4, vc: boolean) {
  let g = mesh.geometry.clone();
  if (g.index) g = g.toNonIndexed();
  if (!g.attributes.normal) g.computeVertexNormals();
  g.applyMatrix4(matrix);
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  for (const name of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  }
  if (vc) {
    const c = (mesh.material as THREE.MeshStandardMaterial).color;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  g.clearGroups();
  return g;
}

function merge(parts: THREE.BufferGeometry[]) {
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const hasColor = !!parts[0].attributes.color;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const col = hasColor ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array as Float32Array, o * 3);
    nor.set(p.attributes.normal.array as Float32Array, o * 3);
    uv.set(p.attributes.uv.array as Float32Array, o * 2);
    if (col) col.set(p.attributes.color.array as Float32Array, o * 3);
    o += p.attributes.position.count;
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

const CHUNK = 36;
const tmpPos = new THREE.Vector3();

/**
 * Merge every static mesh under `root` (marked-dynamic subtrees are left alone).
 * `originZ` starts the chunk grid at a district's edge, so districts don't leave sliver chunks.
 *
 * A generator, so the work can be spread over frames: it yields every few meshes
 * and every merged bucket. The scene only changes at the very end, in one step
 * (victims out, merged meshes in), so a half-done bake never shows. The return
 * value is the number of meshes merged.
 */
export function* bakeSteps(root: THREE.Object3D, originZ = 0): Generator<void, number, void> {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, Bucket>();
  const victims: THREE.Mesh[] = [];
  const found: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D) => {
    if (o.userData.dynamic) return;
    if (mergeable(o)) found.push(o);
    for (const c of o.children) walk(c);
  };
  walk(root);
  let n = 0;
  for (const o of found) {
    // Chunk by position so off-screen parts of the level still get culled.
    o.getWorldPosition(tmpPos);
    const key = `${bucketKey(o)}|${Math.floor(tmpPos.x / CHUNK)},${Math.floor((tmpPos.z - originZ) / CHUNK)}`;
    const mat = o.material as THREE.MeshStandardMaterial;
    const vc = key.startsWith('vc');
    let b = buckets.get(key);
    if (!b) { b = { mat: vc ? vcMaterial(mat.side, !!mat.flatShading) : mat, parts: [], cast: o.castShadow, receive: o.receiveShadow }; buckets.set(key, b); }
    b.parts.push(prepared(o, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), vc));
    victims.push(o);
    if (++n % 8 === 0) yield;
  }
  const merged: THREE.Mesh[] = [];
  for (const b of buckets.values()) {
    if (!b.parts.length) continue;
    const mesh = new THREE.Mesh(merge(b.parts), b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    merged.push(mesh);
    yield;
  }
  // The swap: one step, no half-baked frames. One filter pass per parent (remove()
  // one by one is quadratic in a big district).
  const gone = new Set<THREE.Object3D>(victims);
  const parents = new Set<THREE.Object3D>();
  for (const v of victims) if (v.parent) parents.add(v.parent);
  for (const p of parents) p.children = p.children.filter((c) => !gone.has(c));
  for (const v of victims) v.parent = null;
  for (const m of merged) root.add(m);
  yield;
  // Empty groups left behind cost a little traversal; drop them.
  const prune = (o: THREE.Object3D) => {
    for (const c of [...o.children]) {
      prune(c);
      if (!(c as THREE.Mesh).isMesh && !(c as THREE.Light).isLight && c.children.length === 0 && c.type === 'Group' && !c.userData.dynamic) o.remove(c);
    }
  };
  prune(root);
  return victims.length;
}

/** Run a generator to the end right now. */
export function drain<R>(g: Generator<unknown, R, void>): R {
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}

/** Bake all at once (small things: statics, horizon). */
export function bakeStatic(root: THREE.Object3D, originZ = 0) {
  return drain(bakeSteps(root, originZ));
}

/** Inside an animated model: merge the leaf meshes directly under each joint. */
export function collapseRig(root: THREE.Object3D) {
  const visit = (node: THREE.Object3D) => {
    const leaves = node.children.filter((c) => c.children.length === 0 && mergeable(c)) as THREE.Mesh[];
    if (leaves.length > 1) {
      const buckets = new Map<string, Bucket>();
      for (const m of leaves) {
        m.updateMatrix();
        const key = bucketKey(m);
        const mat = m.material as THREE.MeshStandardMaterial;
        const vc = key.startsWith('vc');
        let b = buckets.get(key);
        if (!b) { b = { mat: vc ? vcMaterial(mat.side, !!mat.flatShading) : mat, parts: [], cast: m.castShadow, receive: m.receiveShadow }; buckets.set(key, b); }
        b.parts.push(prepared(m, m.matrix, vc));
        node.remove(m);
      }
      buckets.forEach((b) => {
        const mesh = new THREE.Mesh(merge(b.parts), b.mat);
        mesh.castShadow = b.cast;
        mesh.receiveShadow = b.receive;
        node.add(mesh);
      });
    }
    for (const c of node.children) visit(c);
  };
  visit(root);
  return root;
}
