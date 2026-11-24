/*
  Sky dome gradient shader, stars, moon, sun + rim directional lights,
  and rain streak particle system for the 3D seafront walk.
*/
import * as THREE from 'three';
import { isNightTheme, onThemeChange, SKY, type SkyMode } from './theme';

export interface SkyTargets {
  waterMat: THREE.MeshStandardMaterial;
  lampGlass: THREE.MeshStandardMaterial[];
  litWindowMat: THREE.MeshStandardMaterial;
  underpassLight: THREE.PointLight;
  wetMats: THREE.MeshStandardMaterial[];
  phoneScreen: THREE.MeshStandardMaterial | null | undefined;
  riderLights: THREE.MeshStandardMaterial[];
}

const RAIN_COUNT = 900;

/** Builds sky dome, lighting rig, rain streaks, and theme/sky mode switching. */
export function createSkySystem(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  root: HTMLElement,
) {
  const skyUniforms = {
    top: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader:
        'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0); }',
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  const starGeo = new THREE.BufferGeometry();
  const starPos: number[] = [];
  for (let i = 0; i < 500; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = Math.random() * 0.9 + 0.08;
    starPos.push(
      Math.cos(a) * Math.cos(e) * 500,
      Math.sin(e) * 500,
      Math.sin(a) * Math.cos(e) * 500,
    );
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.6,
      sizeAttenuation: false,
      fog: false,
      transparent: true,
      opacity: 0.85,
    }),
  );
  scene.add(stars);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(9, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xf4efe0, fog: false }),
  );
  moon.position.set(-120, 140, -420);
  scene.add(moon);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 34;
  sun.shadow.camera.bottom = -34;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const rim = new THREE.DirectionalLight(0xffe1b8, 0.72);
  scene.add(rim, rim.target);

  const rainGeo = new THREE.BufferGeometry();
  const rainArr = new Float32Array(RAIN_COUNT * 6);
  for (let i = 0; i < RAIN_COUNT; i++) {
    const x = -25 + Math.random() * 50;
    const y = Math.random() * 18;
    const z = -25 + Math.random() * 50;
    rainArr.set([x, y, z, x + 0.05, y - 0.7, z], i * 6);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainArr, 3));
  const rain = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({ color: 0xb8c6d6, transparent: true, opacity: 0.55 }),
  );
  rain.visible = false;
  scene.add(rain);

  let skyMode: SkyMode = isNightTheme() ? 'night' : 'day';
  let bound: SkyTargets | null = null;

  const applySky = (mode: SkyMode) => {
    skyMode = mode;
    const s = SKY[mode];
    skyUniforms.top.value.setHex(s.skyTop);
    skyUniforms.horizon.value.setHex(s.skyHorizon);
    scene.fog = new THREE.Fog(s.fog, s.fogNear, s.fogFar);
    sun.color.setHex(s.sunColor);
    sun.intensity = s.sunIntensity;
    rim.color.setHex(mode === 'night' ? 0x8bb6ff : mode === 'rain' ? 0xc2d0de : 0xffe1b8);
    rim.intensity = mode === 'day' ? 0.72 : mode === 'rain' ? 0.35 : 0.45;
    hemi.color.setHex(s.hemiSky);
    hemi.groundColor.setHex(s.hemiGround);
    hemi.intensity = s.hemiIntensity;
    renderer.toneMappingExposure = s.exposure;
    stars.visible = mode === 'night';
    moon.visible = mode === 'night';
    rain.visible = mode === 'rain';

    if (bound) {
      bound.waterMat.color.setHex(s.sea);
      bound.lampGlass.forEach((m) => {
        m.emissiveIntensity = s.lampsOn ? 2.6 : 0.05;
      });
      bound.litWindowMat.emissiveIntensity = mode === 'night' ? 1.3 : mode === 'rain' ? 0.5 : 0;
      bound.underpassLight.intensity = mode === 'day' ? 6 : 10;
      if (bound.phoneScreen) bound.phoneScreen.emissiveIntensity = mode === 'night' ? 1.6 : 0.6;
      bound.riderLights.forEach((l) => {
        l.emissiveIntensity = s.lampsOn ? 2 : 0.2;
      });
      bound.wetMats.forEach((m) => {
        m.roughness = mode === 'rain' ? 0.35 : 0.92;
      });
    }

    root.querySelectorAll<HTMLButtonElement>('[data-sky]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.sky === mode));
    });
  };

  const bindTargets = (targets: SkyTargets) => {
    bound = targets;
    applySky(skyMode);
    onThemeChange((night) => {
      applySky(night ? 'night' : skyMode === 'rain' ? 'rain' : 'day');
    });
    root.querySelectorAll<HTMLButtonElement>('[data-sky]').forEach((b) => {
      b.addEventListener('click', () => applySky(b.dataset.sky as SkyMode));
    });
  };

  const updateRain = (dt: number, camLook: THREE.Vector3) => {
    if (!rain.visible) return;
    rain.position.set(camLook.x, Math.max(0, camLook.y - 2), camLook.z);
    for (let i = 0; i < RAIN_COUNT; i++) {
      rainArr[i * 6 + 1] -= 16 * dt;
      rainArr[i * 6 + 4] -= 16 * dt;
      if (rainArr[i * 6 + 1] < -1) {
        rainArr[i * 6 + 1] += 18;
        rainArr[i * 6 + 4] += 18;
      }
    }
    rainGeo.attributes.position.needsUpdate = true;
  };

  const followTarget = (camLook: THREE.Vector3) => {
    sun.position.set(camLook.x + 30, camLook.y + 48, camLook.z + 22);
    sun.target.position.copy(camLook);
    sun.target.updateMatrixWorld();
    rim.position.set(camLook.x - 24, camLook.y + 18, camLook.z - 28);
    rim.target.position.copy(camLook);
    rim.target.updateMatrixWorld();
  };

  return {
    sky,
    sun,
    rim,
    hemi,
    rain,
    getMode: () => skyMode,
    applySky,
    bindTargets,
    updateRain,
    followTarget,
  };
}
