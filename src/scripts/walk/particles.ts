/*
  Particle bursts and pee mark decals for the 3D seafront walk.
*/
import * as THREE from 'three';

interface Particle {
  m: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  g: number;
}

/** Manages reusable particle burst geometry/materials and the 40-stain ground ring pool. */
export function createParticles(scene: THREE.Scene) {
  const partGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  const partMats = new Map<number, THREE.MeshBasicMaterial>();
  const particles: Particle[] = [];

  const stainGeo = new THREE.CircleGeometry(0.3, 14);
  const stainMat = new THREE.MeshBasicMaterial({
    color: 0xd6b23c,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const stains: THREE.Mesh[] = [];

  const burst = (
    x: number,
    y: number,
    z: number,
    color: number,
    n = 10,
    spd = 3,
    up = 3,
    life = 0.7,
    g = 9,
  ) => {
    let mat = partMats.get(color);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color });
      partMats.set(color, mat);
    }
    for (let i = 0; i < n; i++) {
      if (particles.length > 400) break;
      const m = new THREE.Mesh(partGeo, mat);
      m.position.set(x, y, z);
      scene.add(m);
      const a = Math.random() * Math.PI * 2;
      const s = spd * (0.4 + Math.random() * 0.8);
      particles.push({
        m,
        vx: Math.cos(a) * s,
        vy: up * (0.5 + Math.random()),
        vz: Math.sin(a) * s,
        t: life * (0.6 + Math.random() * 0.6),
        g,
      });
    }
  };

  const addStain = (x: number, y: number, z: number) => {
    const st = stains.length > 40 ? stains.shift()! : new THREE.Mesh(stainGeo, stainMat);
    st.rotation.x = -Math.PI / 2;
    st.position.set(x, y, z);
    scene.add(st);
    stains.push(st);
  };

  const update = (dt: number) => {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t -= dt;
      p.vy -= p.g * dt;
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.position.z += p.vz * dt;
      if (p.t <= 0) {
        scene.remove(p.m);
        particles.splice(i, 1);
      }
    }
  };

  return { burst, addStain, update };
}
