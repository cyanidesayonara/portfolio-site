/*
  See-through occluders: anything between the camera and Millie (and anything
  brushing the camera itself) dissolves with an ordered dither, so lampposts,
  palms, awnings and walls never hide her. Shadows are unaffected (the depth
  pass is untouched). Update `fadeUniforms` every frame.
*/
import * as THREE from 'three';

export const fadeUniforms = {
  uFadeA: { value: new THREE.Vector3() }, // camera
  uFadeB: { value: new THREE.Vector3() }, // the thing to keep visible
  uFadeC: { value: new THREE.Vector3(0, -999, 0) }, // feet of someone who never fades (the human)
};

const patched = new WeakSet<THREE.Material>();

export function applyNearFade(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || o.userData.noFade) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m || patched.has(m) || !(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
      patched.add(m);
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (shader, renderer) => {
        prev?.call(m, shader, renderer);
        shader.uniforms.uFadeA = fadeUniforms.uFadeA;
        shader.uniforms.uFadeB = fadeUniforms.uFadeB;
        shader.uniforms.uFadeC = fadeUniforms.uFadeC;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vFadeW;')
          .replace(
            '#include <project_vertex>',
            `#include <project_vertex>
            #ifdef USE_INSTANCING
              vFadeW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
            #else
              vFadeW = (modelMatrix * vec4(transformed, 1.0)).xyz;
            #endif`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vFadeW;\nuniform vec3 uFadeA;\nuniform vec3 uFadeB;\nuniform vec3 uFadeC;')
          .replace(
            '#include <clipping_planes_fragment>',
            `#include <clipping_planes_fragment>
            {
              float keep = 1.0;
              // Close to the camera (but never Millie or her human themselves).
              vec3 hc = vFadeW - uFadeC;
              bool isHuman = length(hc.xz) < 0.55 && hc.y > -0.05 && hc.y < 2.0;
              bool isDog = distance(vFadeW, uFadeB) < 0.95;
              float dc = distance(vFadeW, uFadeA);
              if (!isHuman && !isDog) keep = min(keep, clamp((dc - 2.0) / 2.6, 0.0, 1.0));
              // Between the camera and Millie (but not right around her).
              vec3 ab = uFadeB - uFadeA;
              float len2 = max(dot(ab, ab), 0.0001);
              float t = clamp(dot(vFadeW - uFadeA, ab) / len2, 0.0, 1.0);
              float tMax = 1.0 - 1.6 / sqrt(len2);
              if (t < tMax && !isHuman) {
                float ds = distance(vFadeW, uFadeA + ab * t);
                float radius = 0.7 + t * 0.7;
                keep = min(keep, clamp((ds - radius * 0.55) / (radius * 0.45), 0.0, 1.0));
              }
              if (keep < 1.0) {
                vec2 p = mod(floor(gl_FragCoord.xy), 4.0);
                float bayer = (mod(p.x + p.y * 2.0, 4.0) * 4.0 + mod(p.x * 2.0 + p.y, 4.0)) / 16.0;
                if (keep * 0.85 < bayer + 0.02) discard;
              }
            }`,
          );
      };
      m.customProgramCacheKey = () => 'seethrough4';
      m.needsUpdate = true;
    }
  });
}
