/*
  Day/night follows the site theme, exactly like the 2D street: an explicit
  data-theme on <html> wins, otherwise the OS preference.
*/

export const isNightTheme = (): boolean => {
  const t = document.documentElement.dataset.theme;
  if (t) return t === 'dark';
  return matchMedia('(prefers-color-scheme: dark)').matches;
};

export function onThemeChange(cb: (night: boolean) => void): void {
  const fire = () => cb(isNightTheme());
  new MutationObserver(fire).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fire);
}

export type SkyMode = 'day' | 'rain' | 'night';

export interface SkyLook {
  skyTop: number;
  skyHorizon: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sea: number;
  seaDeep: number;
  lampsOn: boolean;
  windowsLit: number; // share of windows lit, 0..1
  exposure: number;
}

export const SKY: Record<SkyMode, SkyLook> = {
  day: {
    skyTop: 0x5fa8e0,
    skyHorizon: 0xcfe6f2,
    fog: 0xcfe2ea,
    fogNear: 70,
    fogFar: 260,
    sunColor: 0xffe8bf,
    sunIntensity: 2.65,
    hemiSky: 0xd6ecff,
    hemiGround: 0xb6956e,
    hemiIntensity: 1.18,
    sea: 0x2f8fb0,
    seaDeep: 0x14506e,
    lampsOn: false,
    windowsLit: 0,
    exposure: 1.06,
  },
  rain: {
    skyTop: 0x6b7686,
    skyHorizon: 0xa9b2bc,
    fog: 0x9aa4ae,
    fogNear: 30,
    fogFar: 150,
    sunColor: 0xc9d4e0,
    sunIntensity: 0.9,
    hemiSky: 0xb7c2cf,
    hemiGround: 0x4f5156,
    hemiIntensity: 1.05,
    sea: 0x4d6a78,
    seaDeep: 0x2a3e4a,
    lampsOn: true,
    windowsLit: 0.35,
    exposure: 0.95,
  },
  night: {
    skyTop: 0x060c22,
    skyHorizon: 0x1b2a55,
    fog: 0x111c3d,
    fogNear: 40,
    fogFar: 190,
    sunColor: 0x9fb4ea, // moonlight
    sunIntensity: 0.8,
    hemiSky: 0x5a72b8,
    hemiGround: 0x2a2a38,
    hemiIntensity: 1.25,
    sea: 0x0e2340,
    seaDeep: 0x050d1f,
    lampsOn: true,
    windowsLit: 0.55,
    exposure: 1.2,
  },
};
