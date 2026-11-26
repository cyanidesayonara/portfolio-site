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
    sunDir: { value: new THREE.Vector3(30, 48, 22).normalize() },
    sunCol: { value: new THREE.Color(0xfff0c4) },
    cloudCol: { value: new THREE.Color(0xf8fbff) },
    cloudAmt: { value: 0.36 },
    sunGlow: { value: 1.0 },
    uTime: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 24, 14),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader:
        'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol;
        uniform vec3 cloudCol; uniform float cloudAmt; uniform float sunGlow; uniform float uTime;
        varying vec3 vP;
        void main(){
          vec3 d = normalize(vP);
          float h = clamp(d.y * 1.6, 0.0, 1.0);
          vec3 col = mix(horizon, top, pow(h, 0.7));
          if (sunGlow > 0.01) {
            float sc = max(dot(d, normalize(sunDir)), 0.0);
            col += sunCol * (pow(sc, 16.0) * 0.26 + smoothstep(0.9965, 0.9992, sc) * 1.25) * sunGlow;
          }
          if (d.y > 0.03) {
            vec2 uv = d.xz / (max(d.y, 0.06) + 0.14);
            float c1 = sin(uv.x * 1.3 + uTime * 0.018) * cos(uv.y * 1.1 - uTime * 0.012);
            float c2 = sin(uv.x * 2.7 - uv.y * 2.1 + uTime * 0.025) * 0.5;
            float cl = smoothstep(0.22, 0.95, (c1 + c2) * 0.5 + 0.35) * smoothstep(0.03, 0.24, d.y);
            col = mix(col, cloudCol, cl * cloudAmt);
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
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
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envCache = new Map<SkyMode, THREE.WebGLRenderTarget>();
  const getEnv = (mode: SkyMode) => {
    const cached = envCache.get(mode);
    if (cached) return cached;
    const s = SKY[mode];
    const es = new THREE.Scene();
    const eGeo = new THREE.SphereGeometry(20, 16, 10);
    const eMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        top: { value: new THREE.Color(s.skyTop) },
        horizon: { value: new THREE.Color(s.skyHorizon) },
        ground: { value: new THREE.Color(s.hemiGround) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; varying vec3 vP; void main(){ vec3 c = vP.y >= 0.0 ? mix(horizon, top, pow(vP.y, 0.65)) : mix(horizon, ground, pow(-vP.y, 0.7)); gl_FragColor = vec4(c, 1.0); }',
    });
    es.add(new THREE.Mesh(eGeo, eMat));
    const discGeo = new THREE.SphereGeometry(2.2, 8, 6);
    const discMat = new THREE.MeshBasicMaterial({ color: mode === 'night' ? 0xcad6ff : mode === 'rain' ? 0xd0d8e0 : 0xfff3cf });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.set(mode === 'night' ? -6 : 9, 12, mode === 'night' ? -14 : 6);
    es.add(disc);
    const rt = pmrem.fromScene(es, 0.04);
    eGeo.dispose(); eMat.dispose(); discGeo.dispose(); discMat.dispose();
    envCache.set(mode, rt);
    return rt;
  };

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
    skyUniforms.sunCol.value.setHex(mode === 'day' ? 0xfff0c4 : mode === 'night' ? 0xdbe6ff : 0xc9d4e0);
    skyUniforms.sunGlow.value = mode === 'day' ? 1.0 : mode === 'night' ? 0.2 : 0.0;
    skyUniforms.sunDir.value.set(mode === 'night' ? -120 : 30, mode === 'night' ? 140 : 48, mode === 'night' ? -420 : 22).normalize();
    skyUniforms.cloudCol.value.setHex(mode === 'day' ? 0xf8fbff : mode === 'rain' ? 0x7f8a96 : 0x2c3c68);
    skyUniforms.cloudAmt.value = mode === 'day' ? 0.36 : mode === 'rain' ? 0.55 : 0.16;
    scene.environment = getEnv(mode).texture;
    scene.environmentIntensity = mode === 'day' ? 0.72 : mode === 'rain' ? 0.52 : 0.46;
    scene.fog = new THREE.Fog(s.fog, s.fogNear, s.fogFar);
    sun.color.setHex(s.sunColor);
    sun.intensity = s.sunIntensity;
    rim.color.setHex(mode === 'night' ? 0x8bb6ff : mode === 'rain' ? 0xc2d0de : 0xffe7c2);
    rim.intensity = mode === 'day' ? 0.85 : mode === 'rain' ? 0.42 : 0.55;
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
    skyUniforms.uTime.value += dt;
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

  const dispose = () => {
    envCache.forEach((rt) => rt.dispose());
    envCache.clear();
    pmrem.dispose();
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
    dispose,
  };
}
