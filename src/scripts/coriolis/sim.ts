/*
  Coriolis 128x128 LED matrix simulator in TypeScript.
  Ports the core FrameBuffer, palettes, 5x7 & 3x5 fonts, Shell (splash,
  categorized launcher, settings, clock overlay, transitions, toasts), and
  20+ scenes (clocks, ambient art, guided fitness, and playable games).
*/

export const LED_W = 128;
export const LED_H = 128;

export type RGB = [number, number, number];

export type SimKey = 'None' | 'Up' | 'Down' | 'Left' | 'Right' | 'Select' | 'Back';
export type SimCommand = 'None' | 'Menu' | 'Settings' | 'Overlay' | 'Next' | 'Home';

export interface Palette {
  name: string;
  cyclic: boolean;
  entries: RGB[];
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

export function lerpColor(a: RGB, b: RGB, frac255: number): RGB {
  const f = frac255 / 255;
  return [
    (a[0] + (b[0] - a[0]) * f) | 0,
    (a[1] + (b[1] - a[1]) * f) | 0,
    (a[2] + (b[2] - a[2]) * f) | 0,
  ];
}

export function hsv(h255: number, s255: number, v255: number): RGB {
  const h = ((h255 & 255) / 255) * 6;
  const s = (s255 & 255) / 255;
  const v = (v255 & 255) / 255;
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [(r * 255) | 0, (g * 255) | 0, (b * 255) | 0];
}

function dimRGB(c: RGB, keep255: number): RGB {
  return [(c[0] * keep255) >> 8, (c[1] * keep255) >> 8, (c[2] * keep255) >> 8];
}

function gradientPalette(name: string, a: RGB, b: RGB, c: RGB, d: RGB): Palette {
  const anchors = [a, b, c, d];
  const entries: RGB[] = [];
  for (let i = 0; i < 16; i++) {
    const t = (i / 15) * 3;
    const seg = Math.min(2, Math.floor(t));
    entries.push(lerpColor(anchors[seg], anchors[seg + 1], ((t - seg) * 255) | 0));
  }
  return { name, cyclic: false, entries };
}

export const PALETTES: Palette[] = (() => {
  const rainbow: Palette = {
    name: 'Rainbow',
    cyclic: true,
    entries: Array.from({ length: 16 }, (_, i) => hsv((i * 16) & 255, 255, 255)),
  };
  return [
    rainbow,
    gradientPalette('Heat', [0, 0, 0], [0xb0, 0, 0], [0xff, 0xa5, 0], [0xff, 0xff, 0xcc]),
    gradientPalette('Ocean', [0, 0x40, 0xa0], [0, 0x80, 0xe0], [0, 0xc8, 0xa0], [0xaa, 0xff, 0xee]),
    gradientPalette('Forest', [0x0a, 0x50, 0x10], [0x30, 0xa0, 0x30], [0xa0, 0xd0, 0x40], [0xe8, 0xff, 0xc8]),
    gradientPalette('Ice', [0, 0, 0], [0, 0, 0xa0], [0, 0xcc, 0xcc], [0xff, 0xff, 0xff]),
    gradientPalette('Gray', [0, 0, 0], [0x55, 0x55, 0x55], [0xaa, 0xaa, 0xaa], [0xff, 0xff, 0xff]),
    gradientPalette('Matrix', [0, 0x15, 0], [0, 0x80, 0x10], [0, 0xff, 0x33], [0xb6, 0xff, 0xb6]),
  ];
})();

export function lookupPalette(p: Palette, index: number, brightness = 255): RGB {
  const idx = index & 255;
  const slot = idx >> 4;
  const frac = (idx & 0x0f) << 4;
  const next = p.cyclic ? (slot + 1) & 15 : Math.min(15, slot + 1);
  const c = lerpColor(p.entries[slot], p.entries[next], frac);
  return brightness === 255 ? c : dimRGB(c, brightness);
}

export function lookupBright(p: Palette, index: number, minPeak = 180): RGB {
  const c = lookupPalette(p, index);
  const peak = Math.max(c[0], c[1], c[2]);
  if (peak >= minPeak) return c;
  if (peak === 0) return [minPeak, minPeak, minPeak];
  return [
    clamp255((c[0] * minPeak) / peak),
    clamp255((c[1] * minPeak) / peak),
    clamp255((c[2] * minPeak) / peak),
  ];
}

// ---- FrameBuffer -------------------------------------------------------------------

export class FrameBuffer {
  readonly width = LED_W;
  readonly height = LED_H;
  readonly px = new Uint8Array(LED_W * LED_H * 3);

  contains(x: number, y: number) {
    return x >= 0 && y >= 0 && x < LED_W && y < LED_H;
  }

  set(x: number, y: number, c: RGB) {
    const ix = x | 0, iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= LED_W || iy >= LED_H) return;
    const o = (iy * LED_W + ix) * 3;
    this.px[o] = c[0];
    this.px[o + 1] = c[1];
    this.px[o + 2] = c[2];
  }

  add(x: number, y: number, c: RGB) {
    const ix = x | 0, iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= LED_W || iy >= LED_H) return;
    const o = (iy * LED_W + ix) * 3;
    this.px[o] = Math.min(255, this.px[o] + c[0]);
    this.px[o + 1] = Math.min(255, this.px[o + 1] + c[1]);
    this.px[o + 2] = Math.min(255, this.px[o + 2] + c[2]);
  }

  dimPixel(x: number, y: number, keep: number) {
    const ix = x | 0, iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= LED_W || iy >= LED_H) return;
    const o = (iy * LED_W + ix) * 3;
    this.px[o] = (this.px[o] * keep) >> 8;
    this.px[o + 1] = (this.px[o + 1] * keep) >> 8;
    this.px[o + 2] = (this.px[o + 2] * keep) >> 8;
  }

  at(x: number, y: number): RGB {
    const ix = x | 0, iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= LED_W || iy >= LED_H) return [0, 0, 0];
    const o = (iy * LED_W + ix) * 3;
    return [this.px[o], this.px[o + 1], this.px[o + 2]];
  }

  clear() {
    this.px.fill(0);
  }

  dimAll(keep: number) {
    for (let i = 0; i < this.px.length; i++) {
      this.px[i] = (this.px[i] * keep) >> 8;
    }
  }

  copyFrom(src: FrameBuffer) {
    this.px.set(src.px);
  }

  hLine(x0: number, x1: number, y: number, c: RGB) {
    let a = x0 | 0, b = x1 | 0;
    if (b < a) [a, b] = [b, a];
    for (let x = a; x <= b; x++) this.set(x, y, c);
  }

  vLine(x: number, y0: number, y1: number, c: RGB) {
    let a = y0 | 0, b = y1 | 0;
    if (b < a) [a, b] = [b, a];
    for (let y = a; y <= b; y++) this.set(x, y, c);
  }

  rect(x: number, y: number, w: number, h: number, c: RGB) {
    for (let yy = y | 0; yy < ((y + h) | 0); yy++) {
      for (let xx = x | 0; xx < ((x + w) | 0); xx++) this.set(xx, yy, c);
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB) {
    let ax = x0 | 0, ay = y0 | 0;
    const bx = x1 | 0, by = y1 | 0;
    const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let err = dx + dy;
    while (true) {
      this.set(ax, ay, c);
      if (ax === bx && ay === by) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; ax += sx; }
      if (e2 <= dx) { err += dx; ay += sy; }
    }
  }

  thickLine(x0: number, y0: number, x1: number, y1: number, c: RGB) {
    this.line(x0, y0, x1, y1, c);
    this.line(x0 + 1, y0, x1 + 1, y1, c);
    this.line(x0, y0 + 1, x1, y1 + 1, c);
  }

  boldLine(x0: number, y0: number, x1: number, y1: number, c: RGB) {
    this.thickLine(x0, y0, x1, y1, c);
    this.line(x0 - 1, y0, x1 - 1, y1, c);
    this.line(x0, y0 - 1, x1, y1 - 1, c);
  }

  fillCircle(cx: number, cy: number, r: number, c: RGB) {
    const ri = r | 0;
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        if (dx * dx + dy * dy <= ri * ri) this.set((cx | 0) + dx, (cy | 0) + dy, c);
      }
    }
  }

  circle(cx: number, cy: number, r: number, c: RGB) {
    let x = r | 0, y = 0, err = 1 - x;
    const ix = cx | 0, iy = cy | 0;
    while (x >= y) {
      this.set(ix + x, iy + y, c);
      this.set(ix + y, iy + x, c);
      this.set(ix - y, iy + x, c);
      this.set(ix - x, iy + y, c);
      this.set(ix - x, iy - y, c);
      this.set(ix - y, iy - x, c);
      this.set(ix + y, iy - x, c);
      this.set(ix + x, iy - y, c);
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
    }
  }
}

// ---- Font 5x7 (from core/font5x7.h) ------------------------------------------------

const DIGITS_5X7: number[][] = [
  [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e, 0],
  [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e, 0],
  [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f, 0],
  [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e, 0],
  [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02, 0],
  [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e, 0],
  [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e, 0],
  [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08, 0],
  [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e, 0],
  [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c, 0],
];

const UPPER_5X7: number[][] = [
  [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11, 0], // A
  [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e, 0], // B
  [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e, 0], // C
  [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e, 0], // D
  [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f, 0], // E
  [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10, 0], // F
  [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f, 0], // G
  [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11, 0], // H
  [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e, 0], // I
  [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c, 0], // J
  [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11, 0], // K
  [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f, 0], // L
  [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11, 0], // M
  [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0], // N
  [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e, 0], // O
  [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10, 0], // P
  [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d, 0], // Q
  [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11, 0], // R
  [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e, 0], // S
  [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0], // T
  [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e, 0], // U
  [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04, 0], // V
  [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a, 0], // W
  [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11, 0], // X
  [0x11, 0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0], // Y
  [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f, 0], // Z
];

const LOWER_5X7: number[][] = [
  [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0f, 0x00],
  [0x10, 0x10, 0x16, 0x19, 0x11, 0x11, 0x1e, 0x00],
  [0x00, 0x00, 0x0e, 0x10, 0x10, 0x11, 0x0e, 0x00],
  [0x01, 0x01, 0x0d, 0x13, 0x11, 0x11, 0x0f, 0x00],
  [0x00, 0x00, 0x0e, 0x11, 0x1f, 0x10, 0x0e, 0x00],
  [0x06, 0x09, 0x08, 0x1c, 0x08, 0x08, 0x08, 0x00],
  [0x00, 0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  [0x10, 0x10, 0x16, 0x19, 0x11, 0x11, 0x11, 0x00],
  [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e, 0x00],
  [0x02, 0x00, 0x06, 0x02, 0x02, 0x02, 0x12, 0x0c],
  [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12, 0x00],
  [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e, 0x00],
  [0x00, 0x00, 0x1a, 0x15, 0x15, 0x15, 0x11, 0x00],
  [0x00, 0x00, 0x16, 0x19, 0x11, 0x11, 0x11, 0x00],
  [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e, 0x00],
  [0x00, 0x00, 0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10],
  [0x00, 0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x01],
  [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10, 0x00],
  [0x00, 0x00, 0x0f, 0x10, 0x0e, 0x01, 0x1e, 0x00],
  [0x08, 0x08, 0x1c, 0x08, 0x08, 0x09, 0x06, 0x00],
  [0x00, 0x00, 0x11, 0x11, 0x11, 0x13, 0x0d, 0x00],
  [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04, 0x00],
  [0x00, 0x00, 0x11, 0x11, 0x15, 0x15, 0x0a, 0x00],
  [0x00, 0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x00],
  [0x00, 0x00, 0x11, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  [0x00, 0x00, 0x1f, 0x02, 0x04, 0x08, 0x1f, 0x00],
];

const PUNCT_5X7: Record<string, number[]> = {
  ':': [0, 0x04, 0x04, 0, 0x04, 0x04, 0, 0],
  '.': [0, 0, 0, 0, 0, 0x04, 0x04, 0],
  ',': [0, 0, 0, 0, 0, 0x04, 0x04, 0x08],
  '-': [0, 0, 0, 0x0e, 0, 0, 0, 0],
  '+': [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0, 0],
  '/': [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10, 0],
  '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d, 0],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04, 0],
  '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0, 0],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02, 0],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08, 0],
  '*': [0x0c, 0x12, 0x12, 0x0c, 0, 0, 0, 0],
  '%': [0x18, 0x19, 0x02, 0x04, 0x08, 0x13, 0x03, 0],
  '<': [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02, 0],
  '>': [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08, 0],
};

const BLANK_5X7 = [0, 0, 0, 0, 0, 0, 0, 0];

function glyph5x7(c: string): number[] {
  const code = c.charCodeAt(0);
  if (code >= 48 && code <= 57) return DIGITS_5X7[code - 48];
  if (code >= 65 && code <= 90) return UPPER_5X7[code - 65];
  if (code >= 97 && code <= 122) return LOWER_5X7[code - 97];
  return PUNCT_5X7[c] ?? BLANK_5X7;
}

function span5x7(c: string): [number, number] {
  if (c === ' ') return [0, 2];
  if (c >= '0' && c <= '9') return [0, 5];
  const g = glyph5x7(c);
  let bits = 0;
  for (let r = 0; r < 8; r++) bits |= g[r];
  if (!bits) return [0, 2];
  let lo = 4, hi = 0;
  for (let col = 0; col < 5; col++) {
    if (bits & (0x10 >> col)) {
      if (col < lo) lo = col;
      if (col > hi) hi = col;
    }
  }
  return [lo, hi - lo + 1];
}

export function textWidth5x7(s: string, scale = 1): number {
  let w = 0;
  for (let i = 0; i < s.length; i++) w += span5x7(s[i])[1] + 1;
  return w > 0 ? (w - 1) * scale : 0;
}

function glyphOn(g: number[], gx: number, gy: number) {
  if (gx < 0 || gx > 4 || gy < 0 || gy >= 8) return false;
  return (g[gy] & (0x10 >> gx)) !== 0;
}

export function drawText5x7(
  fb: FrameBuffer,
  s: string,
  x: number,
  y: number,
  scale: number,
  top: RGB,
  bottom: RGB = top,
  smooth = true,
) {
  let cx = x | 0;
  const sm = smooth && scale >= 2;
  const totalH = 7 * scale;
  const r = sm ? (scale >> 1) : 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const g = glyph5x7(ch);
    const [first0, width] = span5x7(ch);
    const first = ch >= '0' && ch <= '9' ? 0 : first0;
    for (let gy = 0; gy < 8; gy++) {
      for (let gx = first - (sm ? 1 : 0); gx < first + width + (sm ? 1 : 0); gx++) {
        if (!sm && !glyphOn(g, gx, gy)) continue;
        const self = glyphOn(g, gx, gy);
        const L = glyphOn(g, gx - 1, gy), R = glyphOn(g, gx + 1, gy);
        const U = glyphOn(g, gx, gy - 1), D = glyphOn(g, gx, gy + 1);
        const px0 = cx + (gx - first) * scale;
        const py0 = (y | 0) + gy * scale;
        for (let dy = 0; dy < scale; dy++) {
          const frac = totalH > 1 ? (((gy * scale + dy) * 255) / (totalH - 1)) | 0 : 0;
          const col = top === bottom ? top : lerpColor(top, bottom, Math.min(255, Math.max(0, frac)));
          for (let dx = 0; dx < scale; dx++) {
            const ix = scale - 1 - dx, iy = scale - 1 - dy;
            let lit = self;
            if (r) {
              if (self) {
                if (!L && !U && !glyphOn(g, gx - 1, gy - 1) && dx + dy < r) lit = false;
                if (!R && !U && !glyphOn(g, gx + 1, gy - 1) && ix + dy < r) lit = false;
                if (!L && !D && !glyphOn(g, gx - 1, gy + 1) && dx + iy < r) lit = false;
                if (!R && !D && !glyphOn(g, gx + 1, gy + 1) && ix + iy < r) lit = false;
              } else {
                if (L && U && dx + dy < r) lit = true;
                if (R && U && ix + dy < r) lit = true;
                if (L && D && dx + iy < r) lit = true;
                if (R && D && ix + iy < r) lit = true;
              }
            }
            if (lit) fb.set(px0 + dx, py0 + dy, col);
          }
        }
      }
    }
    cx += (width + 1) * scale;
  }
}

export function drawCentered5x7(
  fb: FrameBuffer,
  s: string,
  cx: number,
  y: number,
  scale: number,
  top: RGB,
  bottom: RGB = top,
) {
  drawText5x7(fb, s, cx - ((textWidth5x7(s, scale) / 2) | 0), y, scale, top, bottom);
}

// Compact 3x5 font for dense overlays and HUDs
const FONT3X5: Record<string, number[]> = {
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b111, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b001, 0b010, 0b010],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],
  A: [0b010, 0b101, 0b111, 0b101, 0b101],
  B: [0b110, 0b101, 0b110, 0b101, 0b110],
  C: [0b111, 0b100, 0b100, 0b100, 0b111],
  D: [0b110, 0b101, 0b101, 0b101, 0b110],
  E: [0b111, 0b100, 0b110, 0b100, 0b111],
  F: [0b111, 0b100, 0b110, 0b100, 0b100],
  G: [0b111, 0b100, 0b101, 0b101, 0b111],
  H: [0b101, 0b101, 0b111, 0b101, 0b101],
  I: [0b111, 0b010, 0b010, 0b010, 0b111],
  J: [0b001, 0b001, 0b001, 0b101, 0b111],
  K: [0b101, 0b101, 0b110, 0b101, 0b101],
  L: [0b100, 0b100, 0b100, 0b100, 0b111],
  M: [0b101, 0b111, 0b111, 0b101, 0b101],
  N: [0b101, 0b111, 0b111, 0b111, 0b101],
  O: [0b111, 0b101, 0b101, 0b101, 0b111],
  P: [0b111, 0b101, 0b111, 0b100, 0b100],
  Q: [0b111, 0b101, 0b101, 0b111, 0b001],
  R: [0b110, 0b101, 0b110, 0b101, 0b101],
  S: [0b111, 0b100, 0b111, 0b001, 0b111],
  T: [0b111, 0b010, 0b010, 0b010, 0b010],
  U: [0b101, 0b101, 0b101, 0b101, 0b111],
  V: [0b101, 0b101, 0b101, 0b101, 0b010],
  W: [0b101, 0b101, 0b111, 0b111, 0b101],
  X: [0b101, 0b101, 0b010, 0b101, 0b101],
  Y: [0b101, 0b101, 0b010, 0b010, 0b010],
  Z: [0b111, 0x01, 0b010, 0b100, 0b111],
  ':': [0, 0b010, 0, 0b010, 0],
  '-': [0, 0, 0b111, 0, 0],
  '/': [0b001, 0b001, 0b010, 0b100, 0b100],
  '!': [0b010, 0b010, 0b010, 0, 0b010],
  '*': [0b010, 0b101, 0b010, 0, 0],
  '.': [0, 0, 0, 0, 0b010],
};

function drawText3x5(fb: FrameBuffer, text: string, x: number, y: number, scale: number, col: RGB) {
  let cx = x | 0;
  const s = text.toUpperCase();
  for (let i = 0; i < s.length; i++) {
    const g = FONT3X5[s[i]];
    if (g) {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
          if (g[r] & (4 >> c)) fb.rect(cx + c * scale, y + r * scale, scale, scale, col);
        }
      }
    }
    cx += (s[i] === ' ' ? 2 : 4) * scale;
  }
}

function width3x5(text: string, scale = 1) {
  if (!text.length) return 0;
  let w = 0;
  for (let i = 0; i < text.length; i++) w += (text[i] === ' ' ? 2 : 4) * scale;
  return w - scale;
}

// ---- Settings, Context & Audio -----------------------------------------------------

export interface SimSettings {
  brightness: number;
  paletteIndex: number;
  rotation: number;
  autoplay: boolean;
  autoplaySeconds: number;
  overlayType: number; // 0 off, 1 digital, 2 analog, 3 word
  overlayPos: number; // 0..8
  nightMode: boolean;
  audioEnabled: boolean;
  snakeHigh: number;
  tetrisHigh: number;
  yogaProgram: number;
}

export interface SimContext {
  fb: FrameBuffer;
  palette: Palette;
  nowMs: number;
  held: Set<SimKey>;
  settings: SimSettings;
  beep: (freq: number, ms: number, descend?: boolean) => void;
}

export interface Scene {
  readonly id: string;
  readonly name: string;
  readonly category: 0 | 1 | 2 | 3; // 0 clocks, 1 fitness, 2 games, 3 art
  readonly autoplayEligible: boolean;
  start?(ctx: SimContext): void;
  stop?(ctx: SimContext): void;
  draw(ctx: SimContext): number;
  input?(ctx: SimContext, k: SimKey): boolean;
}

function drawIntroCard(ctx: SimContext, title: string, lines: string[], accent: RGB) {
  const { fb } = ctx;
  fb.clear();
  fb.rect(10, 14, LED_W - 20, 2, accent);
  drawCentered5x7(fb, title, LED_W / 2, 26, 2, accent);
  fb.rect(24, 46, LED_W - 48, 1, dimRGB(accent, 90));
  for (let i = 0; i < lines.length; i++) {
    drawCentered5x7(fb, lines[i], LED_W / 2, 58 + i * 14, 1, [220, 224, 232]);
  }
  const blink = ((ctx.nowMs / 450) | 0) % 2 === 0;
  drawCentered5x7(fb, 'PRESS OK TO START', LED_W / 2, 102, 1, blink ? accent : dimRGB(accent, 110));
}

// ---- Scenes: Clocks & Info ---------------------------------------------------------

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getNow() {
  const d = new Date();
  return {
    h: d.getHours(),
    m: d.getMinutes(),
    s: d.getSeconds(),
    day: d.getDate(),
    month: d.getMonth(),
    wd: d.getDay(),
    year: d.getFullYear(),
  };
}

class ClockScene implements Scene {
  id = 'clock';
  name = 'Clock';
  category = 0 as const;
  autoplayEligible = true;
  draw(ctx: SimContext) {
    const { fb, palette, nowMs } = ctx;
    fb.clear();
    const t = getNow();
    const hh = String(t.h).padStart(2, '0');
    const mm = String(t.m).padStart(2, '0');
    const scale = 4;
    const wTotal = textWidth5x7('00:00', scale);
    let x = ((LED_W - wTotal) / 2) | 0;
    const y = ((LED_H - 7 * scale) / 2 - 8) | 0;
    const hue = (nowMs / 1000) & 255;
    const top = lookupBright(palette, hue);
    const bot = dimRGB(lookupBright(palette, hue + 40), 170);

    drawText5x7(fb, hh, x, y, scale, top, bot);
    x += textWidth5x7('00', scale) + scale;
    const breath = 0.55 + 0.45 * Math.cos(((nowMs % 2000) / 2000) * Math.PI * 2);
    const k = (70 + 185 * breath) | 0;
    drawText5x7(fb, ':', x, y, scale, dimRGB(top, k), dimRGB(bot, k));
    x += textWidth5x7(':', scale) + scale;
    drawText5x7(fb, mm, x, y, scale, top, bot);

    const dateY = y + 7 * scale + 10;
    const dateStr = `${DAYS[t.wd]} ${t.day} ${MONTHS[t.month]}`;
    drawCentered5x7(fb, dateStr, LED_W / 2, dateY, 1, dimRGB(lookupBright(palette, hue + 20), 150));

    const barW = 64, barX = 32, barY = dateY + 14;
    fb.hLine(barX, barX + barW - 1, barY, dimRGB(top, 28));
    const fill = ((barW * t.s) / 59) | 0;
    if (fill > 0) fb.hLine(barX, barX + fill - 1, barY, dimRGB(top, 150));
    return 50;
  }
}

class AnalogClockScene implements Scene {
  id = 'analog';
  name = 'Analog';
  category = 0 as const;
  autoplayEligible = true;
  draw(ctx: SimContext) {
    const { fb, palette, nowMs } = ctx;
    fb.clear();
    const cx = 64, cy = 64, R = 56;
    const hue = (nowMs / 1200) & 255;
    const ring = lookupBright(palette, hue);
    fb.circle(cx, cy, R, dimRGB(ring, 140));
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const r0 = i % 3 === 0 ? R - 8 : R - 5;
      fb.line(
        cx + Math.round(Math.sin(a) * r0),
        cy - Math.round(Math.cos(a) * r0),
        cx + Math.round(Math.sin(a) * (R - 1)),
        cy - Math.round(Math.cos(a) * (R - 1)),
        i % 3 === 0 ? ring : dimRGB(ring, 100),
      );
    }
    const t = getNow();
    const ah = ((t.h % 12) + t.m / 60) * ((Math.PI * 2) / 12);
    const am = (t.m + t.s / 60) * ((Math.PI * 2) / 60);
    const as = t.s * ((Math.PI * 2) / 60);
    fb.boldLine(cx, cy, cx + Math.round(Math.sin(ah) * 28), cy - Math.round(Math.cos(ah) * 28), [255, 255, 255]);
    fb.thickLine(cx, cy, cx + Math.round(Math.sin(am) * 44), cy - Math.round(Math.cos(am) * 44), lookupBright(palette, hue + 60));
    fb.line(cx, cy, cx + Math.round(Math.sin(as) * 48), cy - Math.round(Math.cos(as) * 48), [255, 110, 90]);
    fb.fillCircle(cx, cy, 3, [255, 255, 255]);
    return 100;
  }
}

class WordClockScene implements Scene {
  id = 'wordclock';
  name = 'Word Clock';
  category = 0 as const;
  autoplayEligible = true;
  draw(ctx: SimContext) {
    const { fb, palette, nowMs } = ctx;
    fb.clear();
    const small = [
      'ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
      'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
    ];
    const tens = ['TWENTY', 'THIRTY', 'FORTY', 'FIFTY'];
    const t = getNow();
    const hr = t.h % 12 || 12;
    const lines: string[] = [small[hr]];
    if (t.m === 0) lines.push("O'CLOCK");
    else if (t.m < 10) lines.push('OH', small[t.m]);
    else if (t.m < 20) lines.push(small[t.m]);
    else {
      lines.push(tens[Math.floor(t.m / 10) - 2]);
      if (t.m % 10) lines.push(small[t.m % 10]);
    }
    const scale = 2;
    const lineH = 7 * scale + 6;
    let y = ((LED_H - lines.length * lineH + 6) / 2) | 0;
    const hue = (nowMs / 1000) & 255;
    lines.forEach((ln, i) => {
      const col = i === 0 ? lookupBright(palette, hue) : dimRGB(lookupBright(palette, hue + 50), 190);
      drawCentered5x7(fb, ln, LED_W / 2, y, scale, col);
      y += lineH;
    });
    return 100;
  }
}

class WeatherScene implements Scene {
  id = 'weather';
  name = 'Weather';
  category = 0 as const;
  autoplayEligible = true;
  draw(ctx: SimContext) {
    const { fb, nowMs } = ctx;
    fb.clear();
    const bob = Math.sin(nowMs * 0.002) * 2;
    // Warm sun & crisp cumulus icon
    fb.fillCircle(64, (40 + bob) | 0, 16, [255, 176, 32]);
    for (let i = 0; i < 8; i++) {
      const a = i * (Math.PI / 4) + nowMs * 0.0005;
      fb.thickLine(
        64 + Math.round(Math.cos(a) * 20),
        Math.round(40 + bob + Math.sin(a) * 20),
        64 + Math.round(Math.cos(a) * 26),
        Math.round(40 + bob + Math.sin(a) * 26),
        [255, 200, 90],
      );
    }
    drawCentered5x7(fb, '21*C', LED_W / 2, 74, 2, [244, 241, 234]);
    drawCentered5x7(fb, 'CLEAR SKY', LED_W / 2, 96, 1, [31, 201, 183]);
    return 40;
  }
}

class CalendarScene implements Scene {
  id = 'calendar';
  name = 'Calendar';
  category = 0 as const;
  autoplayEligible = true;
  draw(ctx: SimContext) {
    const { fb, palette } = ctx;
    fb.clear();
    const t = getNow();
    const acc = lookupBright(palette, 40);
    fb.rect(24, 16, 80, 14, acc);
    drawCentered5x7(fb, MONTHS[t.month], 64, 20, 1, [12, 16, 28]);
    fb.rect(24, 30, 80, 56, [24, 30, 48]);
    drawCentered5x7(fb, String(t.day), 64, 42, 4, [244, 241, 234]);
    drawCentered5x7(fb, DAYS[t.wd], 64, 74, 1, [170, 180, 205]);
    drawCentered5x7(fb, `${t.year}`, 64, 98, 1, dimRGB(acc, 190));
    return 100;
  }
}

// ---- Scenes: Ambient Art -----------------------------------------------------------

interface CoriolisP { x: number; y: number; vx: number; vy: number; age: number; hue: number; }

class CoriolisScene implements Scene {
  id = 'coriolis';
  name = 'Coriolis';
  category = 3 as const;
  autoplayEligible = true;
  private p: CoriolisP[] = [];
  private spoke = 0;
  private readonly OMEGA = 0.02;

  private launch(scatter: boolean): CoriolisP {
    const a = Math.random() * Math.PI * 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    const speed = 0.55 + Math.random() * 0.625;
    const r = scatter ? Math.random() * (LED_W / 3) : 2;
    return {
      x: 64 + dx * r,
      y: 64 + dy * r,
      vx: dx * speed,
      vy: dy * speed,
      age: 0,
      hue: (Math.random() * 255) | 0,
    };
  }

  start(ctx: SimContext) {
    ctx.fb.clear();
    this.p = Array.from({ length: 16 }, () => this.launch(true));
    this.spoke = 0;
  }

  draw(ctx: SimContext) {
    const { fb, palette } = ctx;
    fb.dimAll(238);
    this.spoke += this.OMEGA;
    const spokeCol = lookupPalette(palette, 160, 26);
    for (let s = 0; s < 3; s++) {
      const a = this.spoke + s * ((Math.PI * 2) / 3);
      fb.line(64, 64, 64 + Math.round(Math.cos(a) * 62), 64 + Math.round(Math.sin(a) * 62), spokeCol);
    }
    for (let i = 0; i < this.p.length; i++) {
      const q = this.p[i];
      const ax = 2 * this.OMEGA * q.vy;
      const ay = -2 * this.OMEGA * q.vx;
      q.vx += ax;
      q.vy += ay;
      q.x += q.vx;
      q.y += q.vy;
      q.age++;
      const dx = q.x - 64, dy = q.y - 64;
      if (dx * dx + dy * dy > 64 * 64 || q.age > 400) {
        this.p[i] = this.launch(false);
        continue;
      }
      let c = lookupBright(palette, q.hue + ((q.age / 3) | 0));
      c = dimRGB(c, 160 + (q.age < 48 ? 2 * q.age : 95));
      fb.add(q.x | 0, q.y | 0, c);
    }
    fb.fillCircle(64, 64, 1, lookupBright(palette, 0, 140));
    return 25;
  }
}

class AuroraScene implements Scene {
  id = 'aurora';
  name = 'Aurora';
  category = 3 as const;
  autoplayEligible = true;
  private phase = 0;
  start() { this.phase = 0; }
  draw(ctx: SimContext) {
    const { fb, palette } = ctx;
    fb.clear();
    const t = this.phase * 0.018;
    for (let layer = 0; layer < 2; layer++) {
      const lt = t * (layer === 0 ? 1.0 : 0.6) + layer * 2.1;
      const ridgeBase = LED_H * (layer === 0 ? 0.34 : 0.28);
      const bright = layer === 0 ? 1.0 : 0.55;
      const hueBase = layer === 0 ? 110 : 150;
      for (let x = 0; x < LED_W; x++) {
        const w = Math.sin(x * 0.05 + lt) * 0.5 + Math.sin(x * 0.11 - lt * 0.7) * 0.3 + Math.sin(x * 0.021 + lt * 0.4) * 0.2;
        const ridge = ridgeBase + w * LED_H * 0.13;
        const col = 0.5 + 0.5 * Math.sin(x * 0.08 + lt * 1.2);
        const ray = 0.65 + 0.35 * Math.sin(x * 0.5 + lt * 2.3);
        const inten = col * ray * bright;
        for (let y = 0; y < LED_H; y++) {
          const d = y < ridge ? (ridge - y) / (LED_H * 0.22) : (y - ridge) / (LED_H * 0.62);
          const glow = 1 - d;
          if (glow <= 0) continue;
          const b = glow * glow * inten;
          if (b < 0.06) continue;
          const hue = hueBase + (((y - ridge) * 1.4) | 0) + ((x * 0.2) | 0);
          fb.add(x, y, lookupPalette(palette, hue, Math.min(255, (b * 255) | 0)));
        }
      }
    }
    this.phase++;
    return 33;
  }
}

class LavaScene implements Scene {
  id = 'lava';
  name = 'Lava';
  category = 3 as const;
  autoplayEligible = true;
  private blobs: { x: number; y: number; vx: number; vy: number; r2: number }[] = [];
  start() {
    this.blobs = Array.from({ length: 6 }, () => {
      const r = 10 + Math.random() * 8;
      return {
        x: 20 + Math.random() * 88,
        y: 20 + Math.random() * 88,
        vx: (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.35),
        vy: (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.35),
        r2: r * r,
      };
    });
  }
  draw(ctx: SimContext) {
    const { fb, palette } = ctx;
    for (const b of this.blobs) {
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < 6) { b.x = 6; b.vx = -b.vx; }
      if (b.x > 122) { b.x = 122; b.vx = -b.vx; }
      if (b.y < 6) { b.y = 6; b.vy = -b.vy; }
      if (b.y > 122) { b.y = 122; b.vy = -b.vy; }
    }
    // 2x2 block step keeps JS overhead well under 1 ms while looking soft on LEDs
    for (let y = 0; y < LED_H; y += 2) {
      for (let x = 0; x < LED_W; x += 2) {
        let field = 0;
        for (let i = 0; i < 6; i++) {
          const dx = x - this.blobs[i].x, dy = y - this.blobs[i].y;
          field += this.blobs[i].r2 / (dx * dx + dy * dy + 1);
        }
        const col: RGB = field < 0.45 ? [0, 0, 0] : lookupPalette(palette, field >= 2.6 ? 255 : (((field - 0.45) * 118.6) | 0));
        fb.rect(x, y, 2, 2, col);
      }
    }
    return 40;
  }
}

class FireScene implements Scene {
  id = 'fire';
  name = 'Fireplace';
  category = 3 as const;
  autoplayEligible = true;
  private heat = new Uint8Array(LED_W * LED_H);
  private phase = 0;
  start() { this.heat.fill(0); this.phase = 0; }
  draw(ctx: SimContext) {
    const { fb } = ctx;
    this.phase += 3;
    const t = this.phase * 0.02;
    const ix0 = 28, ix1 = 99, baseY = 108, fireTop = 34;
    for (let x = ix0; x <= ix1; x++) {
      for (let y = fireTop; y <= baseY; y++) {
        const alt = baseY - y;
        const idx = y * LED_W + x;
        const cool = ((Math.random() * 7) | 0) + ((alt * 42 / 100) | 0);
        this.heat[idx] = Math.max(0, this.heat[idx] - cool);
      }
      for (let y = fireTop; y < baseY - 1; y++) {
        this.heat[y * LED_W + x] = ((this.heat[(y + 1) * LED_W + x] * 2 + this.heat[(y + 2) * LED_W + x]) / 3) | 0;
      }
      this.heat[baseY * LED_W + x] = Math.min(255, this.heat[baseY * LED_W + x] + 12 + ((Math.random() * 32) | 0));
      const wave = Math.sin(x * 0.13 + t * 1.3) + Math.sin(x * 0.061 - t * 0.8) * 0.7 + Math.sin(x * 0.27 + t * 2.1) * 0.4;
      const inten = Math.max(0, Math.min(1, (wave + 2.1) / 4.2));
      const spark = inten * inten;
      if (Math.random() < 0.25 + spark * 0.6) {
        const y0 = baseY - ((Math.random() * (4 + spark * 10)) | 0);
        for (let yy = y0; yy <= baseY; yy++) {
          this.heat[yy * LED_W + x] = Math.min(255, this.heat[yy * LED_W + x] + ((120 + spark * 135) | 0));
        }
      }
    }
    fb.clear();
    // Brick surround
    fb.rect(14, 24, 14, 96, [85, 36, 26]);
    fb.rect(100, 24, 14, 96, [85, 36, 26]);
    fb.rect(14, 18, 100, 16, [95, 42, 30]);
    fb.rect(28, 34, 72, 74, [10, 6, 4]);
    for (let y = fireTop; y <= baseY; y++) {
      for (let x = ix0; x <= ix1; x++) {
        const h = this.heat[y * LED_W + x];
        if (h < 12) continue;
        const c = lookupPalette(PALETTES[1], h); // Heat palette
        fb.set(x, y, c);
      }
    }
    // Glowing logs
    fb.rect(34, 108, 60, 7, [48, 26, 14]);
    fb.rect(42, 105, 44, 5, [62, 32, 16]);
    fb.rect(10, 115, 108, 10, [52, 46, 42]);
    return 33;
  }
}

class MandalaScene implements Scene {
  id = 'mandala';
  name = 'Mandala';
  category = 3 as const;
  autoplayEligible = true;
  draw(ctx: SimContext) {
    const { fb, palette, nowMs } = ctx;
    const t = nowMs * 0.0012;
    for (let y = 0; y < LED_H; y += 2) {
      for (let x = 0; x < LED_W; x += 2) {
        const dx = x - 64, dy = y - 64;
        const r = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        const v = Math.sin(r * 0.22 - t * 2) + Math.cos(a * 8 + Math.sin(r * 0.08 + t) * 2.5);
        const idx = (((v + 2) * 0.25) * 255 + t * 25) & 255;
        const b = r < 60 ? 255 : Math.max(0, (255 * (1 - (r - 60) / 8)) | 0);
        fb.rect(x, y, 2, 2, lookupPalette(palette, idx, b));
      }
    }
    return 40;
  }
}

class SpiroScene implements Scene {
  id = 'spiro';
  name = 'Spirograph';
  category = 3 as const;
  autoplayEligible = true;
  private t = 0;
  start(ctx: SimContext) { ctx.fb.clear(); this.t = 0; }
  draw(ctx: SimContext) {
    const { fb, palette } = ctx;
    fb.dimAll(249);
    const R = 42, r = 13, d = 22;
    for (let s = 0; s < 10; s++) {
      this.t += 0.035;
      const x = 64 + ((R - r) * Math.cos(this.t) + d * Math.cos(((R - r) / r) * this.t));
      const y = 64 + ((R - r) * Math.sin(this.t) - d * Math.sin(((R - r) / r) * this.t));
      fb.fillCircle(x | 0, y | 0, 1, lookupBright(palette, (this.t * 18) | 0));
    }
    return 25;
  }
}

class RainScene implements Scene {
  id = 'rain';
  name = 'Digital rain';
  category = 3 as const;
  autoplayEligible = true;
  private drops: number[] = [];
  private speed: number[] = [];
  start(ctx: SimContext) {
    ctx.fb.clear();
    this.drops = Array.from({ length: 32 }, () => -Math.random() * 128);
    this.speed = Array.from({ length: 32 }, () => 1 + Math.random() * 2.2);
  }
  draw(ctx: SimContext) {
    const { fb, palette } = ctx;
    fb.dimAll(224);
    for (let i = 0; i < 32; i++) {
      this.drops[i] += this.speed[i];
      if (this.drops[i] > LED_H + 12) {
        this.drops[i] = -Math.random() * 20;
        this.speed[i] = 1 + Math.random() * 2.2;
      }
      const x = i * 4 + 1, y = this.drops[i] | 0;
      fb.rect(x, y - 3, 2, 3, lookupBright(palette, (i * 17 + y) & 255));
      fb.rect(x, y, 2, 2, [235, 255, 240]);
    }
    return 33;
  }
}

class StarfieldScene implements Scene {
  id = 'starfield';
  name = 'Starfield';
  category = 3 as const;
  autoplayEligible = true;
  private stars: { x: number; y: number; z: number }[] = [];
  start(ctx: SimContext) {
    ctx.fb.clear();
    this.stars = Array.from({ length: 70 }, () => ({
      x: (Math.random() - 0.5) * 120,
      y: (Math.random() - 0.5) * 120,
      z: 10 + Math.random() * 110,
    }));
  }
  draw(ctx: SimContext) {
    const { fb, palette } = ctx;
    fb.dimAll(200);
    for (const s of this.stars) {
      s.z -= 1.8;
      if (s.z <= 2) {
        s.x = (Math.random() - 0.5) * 120;
        s.y = (Math.random() - 0.5) * 120;
        s.z = 115;
      }
      const sx = (64 + (s.x / s.z) * 55) | 0;
      const sy = (64 + (s.y / s.z) * 55) | 0;
      const b = Math.min(255, ((1 - s.z / 120) * 255) | 0);
      fb.set(sx, sy, lookupBright(palette, (s.x + s.y) & 255, Math.max(90, b)));
    }
    return 30;
  }
}

class LifeScene implements Scene {
  id = 'life';
  name = 'Game of life';
  category = 3 as const;
  autoplayEligible = true;
  private readonly G = 64;
  private a = new Uint8Array(64 * 64);
  private b = new Uint8Array(64 * 64);
  private gen = 0;
  start() {
    for (let i = 0; i < this.a.length; i++) this.a[i] = Math.random() < 0.28 ? 1 : 0;
    this.gen = 0;
  }
  draw(ctx: SimContext) {
    const { fb, palette } = ctx;
    this.gen++;
    if (this.gen % 240 === 0) {
      for (let i = 0; i < 40; i++) this.a[(Math.random() * this.a.length) | 0] = 1;
    }
    for (let y = 0; y < this.G; y++) {
      for (let x = 0; x < this.G; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = (x + dx + this.G) % this.G;
            const ny = (y + dy + this.G) % this.G;
            if (this.a[ny * this.G + nx]) n++;
          }
        }
        const cur = this.a[y * this.G + x];
        const next = cur ? (n === 2 || n === 3 ? Math.min(255, cur + 1) : 0) : n === 3 ? 1 : 0;
        this.b[y * this.G + x] = next;
        fb.rect(x * 2, y * 2, 2, 2, next ? lookupBright(palette, (next * 14) & 255) : [0, 0, 0]);
      }
    }
    const tmp = this.a; this.a = this.b; this.b = tmp;
    return 80;
  }
}

class AquariumScene implements Scene {
  id = 'aquarium';
  name = 'Aquarium';
  category = 3 as const;
  autoplayEligible = true;
  private fish: { x: number; y: number; vx: number; col: RGB }[] = [];
  private bubbles: { x: number; y: number; vy: number }[] = [];
  start() {
    this.fish = [
      { x: 24, y: 40, vx: 0.45, col: [255, 160, 40] },
      { x: 94, y: 66, vx: -0.35, col: [229, 72, 122] },
      { x: 52, y: 88, vx: 0.55, col: [31, 201, 183] },
    ];
    this.bubbles = Array.from({ length: 12 }, () => ({ x: 16 + Math.random() * 96, y: 20 + Math.random() * 96, vy: 0.35 + Math.random() * 0.4 }));
  }
  draw(ctx: SimContext) {
    const { fb, nowMs } = ctx;
    for (let y = 0; y < LED_H; y++) {
      const col: RGB = y > 114 ? [160, 140, 95] : [6, 18 + ((y * 22 / 128) | 0), 42 + ((y * 28 / 128) | 0)];
      fb.hLine(0, LED_W - 1, y, col);
    }
    // Swaying kelp
    for (const kx of [18, 28, 86, 102]) {
      for (let y = 114; y > 68; y -= 2) {
        const sway = Math.round(Math.sin(nowMs * 0.003 + y * 0.12 + kx) * 2);
        fb.rect(kx + sway, y, 2, 2, [40, 165, 85]);
      }
    }
    for (const b of this.bubbles) {
      b.y -= b.vy;
      if (b.y < 6) b.y = 112;
      fb.circle(b.x | 0, b.y | 0, 1, [160, 225, 255]);
    }
    for (const f of this.fish) {
      f.x += f.vx;
      if (f.x > 122) f.vx = -Math.abs(f.vx);
      if (f.x < 6) f.vx = Math.abs(f.vx);
      const dir = f.vx >= 0 ? 1 : -1;
      const fx = f.x | 0, fy = (f.y + Math.sin(nowMs * 0.005 + f.x) * 1.5) | 0;
      fb.fillCircle(fx, fy, 4, f.col);
      fb.rect(fx - dir * 5, fy - 2, 2, 5, f.col);
      fb.set(fx + dir * 2, fy - 1, [15, 20, 30]);
    }
    return 40;
  }
}

class BounceScene implements Scene {
  id = 'bounce';
  name = 'Bounce';
  category = 0 as const;
  autoplayEligible = true;
  private x = 40; private y = 50; private vx = 1.6; private vy = 1.25;
  start(ctx: SimContext) { ctx.fb.clear(); }
  draw(ctx: SimContext) {
    const { fb, palette, nowMs } = ctx;
    fb.dimAll(232);
    this.x += this.vx; this.y += this.vy;
    if (this.x < 16 || this.x > LED_W - 16) this.vx = -this.vx;
    if (this.y < 8 || this.y > LED_H - 8) this.vy = -this.vy;
    const t = getNow();
    const s = `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`;
    drawCentered5x7(fb, s, this.x | 0, (this.y - 3) | 0, 1, lookupBright(palette, (nowMs / 20) & 255));
    return 25;
  }
}

// ---- Scenes: Guided Fitness --------------------------------------------------------

type Pose = [number, number][]; // 15 joints normalized 0..1

const POSES: { name: string; bilateral: boolean; j: Pose }[] = [
  {
    name: 'MOUNTAIN', bilateral: false,
    j: [[.5,.185],[.5,.26],[.42,.29],[.58,.29],[.40,.42],[.39,.54],[.60,.42],[.61,.54],[.5,.53],[.46,.70],[.45,.90],[.54,.70],[.55,.90],[.41,.92],[.59,.92]],
  },
  {
    name: 'DOWN DOG', bilateral: false,
    j: [[.32,.575],[.36,.52],[.34,.54],[.36,.55],[.26,.70],[.19,.90],[.28,.71],[.21,.91],[.56,.30],[.66,.57],[.74,.86],[.68,.58],[.75,.87],[.67,.90],[.69,.91]],
  },
  {
    name: 'WARRIOR 1', bilateral: true,
    j: [[.46,.26],[.48,.34],[.48,.36],[.49,.37],[.47,.23],[.45,.11],[.49,.23],[.47,.11],[.50,.56],[.34,.68],[.34,.90],[.64,.73],[.77,.90],[.26,.91],[.74,.91]],
  },
  {
    name: 'WARRIOR 2', bilateral: true,
    j: [[.5,.225],[.5,.30],[.42,.33],[.58,.33],[.28,.33],[.13,.33],[.72,.33],[.87,.33],[.5,.56],[.31,.70],[.28,.90],[.66,.73],[.75,.90],[.21,.91],[.82,.91]],
  },
  {
    name: 'TREE', bilateral: true,
    j: [[.5,.165],[.5,.24],[.43,.27],[.57,.27],[.37,.16],[.48,.05],[.63,.16],[.52,.05],[.5,.52],[.47,.70],[.46,.90],[.63,.62],[.51,.68],[.42,.92],[.50,.73]],
  },
];

const BONES: [number, number][] = [
  [0,1],[2,3],[1,8],[2,4],[4,5],[3,6],[6,7],[8,9],[9,10],[10,13],[8,11],[11,12],[12,14],
];

class YogaScene implements Scene {
  id = 'yoga';
  name = 'Yoga';
  category = 1 as const;
  autoplayEligible = false;
  private started = false;
  private step = 0;
  private stepStartMs = 0;
  private readonly HOLD_MS = 12000;

  start() { this.started = false; }
  private begin(ctx: SimContext) {
    this.started = true;
    this.step = 0;
    this.stepStartMs = ctx.nowMs;
    ctx.beep(660, 150);
  }
  input(ctx: SimContext, k: SimKey) {
    if (!this.started) {
      if (k === 'Select') { this.begin(ctx); return true; }
      return false;
    }
    if (k === 'Right' || k === 'Select') {
      this.step = (this.step + 1) % (POSES.length * 2);
      this.stepStartMs = ctx.nowMs;
      ctx.beep(880, 90);
      return true;
    }
    if (k === 'Left') {
      this.step = (this.step + POSES.length * 2 - 1) % (POSES.length * 2);
      this.stepStartMs = ctx.nowMs;
      return true;
    }
    return false;
  }
  draw(ctx: SimContext) {
    if (!this.started) {
      drawIntroCard(ctx, 'YOGA FLOW', ['SUN SALUTATION', 'ARROWS SKIP POSES'], [255, 120, 105]);
      return 60;
    }
    const { fb, nowMs } = ctx;
    fb.clear();
    const elapsed = nowMs - this.stepStartMs;
    if (elapsed >= this.HOLD_MS) {
      this.step = (this.step + 1) % (POSES.length * 2);
      this.stepStartMs = nowMs;
      ctx.beep(880, 90);
    }
    const remSec = Math.max(0, Math.ceil((this.HOLD_MS - (nowMs - this.stepStartMs)) / 1000));
    const idx = this.step % POSES.length;
    const mirror = this.step >= POSES.length && POSES[idx].bilateral;
    const pose = POSES[idx];
    const nextPose = POSES[(this.step + 1) % POSES.length];

    // Mat line & breathing halo
    fb.hLine(20, 108, 114, [45, 55, 75]);
    const pulse = Math.sin(nowMs * 0.0025) * 4;
    fb.circle(64, 70, (32 + pulse) | 0, [32, 48, 62]);

    // Skeleton figure
    const ox = 24, oy = 24, box = 80;
    const pt = (i: number): [number, number] => {
      const px = mirror ? 1 - pose.j[i][0] : pose.j[i][0];
      return [(ox + px * box) | 0, (oy + pose.j[i][1] * box) | 0];
    };
    const bodyCol: RGB = [255, 184, 110];
    for (const [a, b] of BONES) {
      const [ax, ay] = pt(a), [bx, by] = pt(b);
      fb.thickLine(ax, ay, bx, by, bodyCol);
    }
    const [hx, hy] = pt(0);
    fb.fillCircle(hx, hy, 4, [244, 241, 234]);

    // Top bar: pose name + side tag + big countdown
    const title = pose.bilateral ? `${pose.name} ${mirror ? '(L)' : '(R)'}` : pose.name;
    drawText3x5(fb, title, 4, 4, 1, [255, 176, 32]);
    drawText3x5(fb, `${remSec}S`, 110, 4, 1, [94, 234, 140]);

    if (remSec <= 4) {
      fb.rect(4, 117, 120, 9, [25, 38, 56]);
      drawText3x5(fb, `NEXT: ${nextPose.name}`, 7, 119, 1, [31, 201, 183]);
    }
    return 40;
  }
}

class ExerciseScene implements Scene {
  id = 'exercise';
  name = 'Exercise';
  category = 1 as const;
  autoplayEligible = false;
  private started = false;
  private round = 1;
  private work = true;
  private phaseMs = 0;

  start() { this.started = false; }
  input(ctx: SimContext, k: SimKey) {
    if (!this.started && k === 'Select') {
      this.started = true; this.round = 1; this.work = true; this.phaseMs = ctx.nowMs;
      ctx.beep(880, 140);
      return true;
    }
    if (this.started && (k === 'Right' || k === 'Select')) {
      this.work = !this.work;
      if (this.work) this.round = (this.round % 4) + 1;
      this.phaseMs = ctx.nowMs;
      return true;
    }
    return false;
  }
  draw(ctx: SimContext) {
    if (!this.started) {
      drawIntroCard(ctx, 'HIIT TABATA', ['20S WORK / 10S REST', '4 ROUNDS'], [255, 120, 105]);
      return 60;
    }
    const { fb, nowMs } = ctx;
    const dur = this.work ? 20000 : 10000;
    if (nowMs - this.phaseMs >= dur) {
      this.work = !this.work;
      if (this.work) this.round = (this.round % 4) + 1;
      this.phaseMs = nowMs;
      ctx.beep(this.work ? 980 : 520, 140);
    }
    const rem = Math.ceil((dur - (nowMs - this.phaseMs)) / 1000);
    const col: RGB = this.work ? [46, 210, 115] : [255, 176, 32];
    fb.clear();
    fb.rect(0, 0, LED_W, 4, col);
    fb.rect(0, LED_H - 4, LED_W, 4, col);
    drawCentered5x7(fb, this.work ? 'WORK HARD' : 'REST', 64, 18, 2, col);
    drawCentered5x7(fb, String(rem).padStart(2, '0'), 64, 48, 4, [244, 241, 234]);
    drawCentered5x7(fb, `ROUND ${this.round}/4`, 64, 98, 1, [190, 200, 220]);
    return 50;
  }
}

class BreatheScene implements Scene {
  id = 'breathe';
  name = 'Breathe';
  category = 1 as const;
  autoplayEligible = true;
  draw(ctx: SimContext) {
    const { fb, palette, nowMs } = ctx;
    fb.clear();
    const cycle = (nowMs % 16000) / 4000; // 4-4-4-4 box breathing
    const phase = cycle | 0;
    const frac = cycle - phase;
    const r = phase === 0 ? 12 + frac * 34 : phase === 1 ? 46 : phase === 2 ? 46 - frac * 34 : 12;
    const label = ['INHALE', 'HOLD', 'EXHALE', 'HOLD'][phase];
    const col = lookupBright(palette, (phase * 50 + 100) & 255);
    fb.fillCircle(64, 62, r | 0, dimRGB(col, 90));
    fb.circle(64, 62, r | 0, col);
    drawCentered5x7(fb, label, 64, 108, 1, col);
    return 33;
  }
}

// ---- Scenes: Games -----------------------------------------------------------------

class SnakeScene implements Scene {
  id = 'snake';
  name = 'Snake';
  category = 2 as const;
  autoplayEligible = false;
  private started = false;
  private dead = false;
  private body: [number, number][] = [];
  private dir = 1;
  private nextDir = 1;
  private food: [number, number] = [20, 16];
  private score = 0;
  private lastStep = 0;
  private readonly G = 32;

  start() { this.started = false; }
  private begin(ctx: SimContext) {
    this.started = true;
    this.dead = false;
    this.dir = 1;
    this.nextDir = 1;
    this.score = 0;
    this.body = [[16, 16], [15, 16], [14, 16]];
    this.placeFood();
    this.lastStep = ctx.nowMs;
    ctx.beep(660, 120);
  }
  private placeFood() {
    for (let i = 0; i < 200; i++) {
      const fx = (Math.random() * this.G) | 0, fy = (Math.random() * this.G) | 0;
      if (!this.body.some(([x, y]) => x === fx && y === fy)) { this.food = [fx, fy]; return; }
    }
  }
  input(ctx: SimContext, k: SimKey) {
    if (!this.started || this.dead) {
      if (k === 'Select') { this.begin(ctx); return true; }
      return false;
    }
    const map: Partial<Record<SimKey, number>> = { Up: 0, Right: 1, Down: 2, Left: 3 };
    const nd = map[k];
    if (nd !== undefined) {
      if ((nd + 2) % 4 !== this.dir) this.nextDir = nd;
      return true;
    }
    return false;
  }
  draw(ctx: SimContext) {
    if (!this.started) {
      drawIntroCard(ctx, 'SNAKE', [`BEST ${ctx.settings.snakeHigh}`, 'ARROWS STEER'], [90, 230, 90]);
      return 60;
    }
    const { fb, nowMs } = ctx;
    const stepMs = Math.max(55, 110 - this.body.length);
    if (!this.dead && nowMs - this.lastStep >= stepMs) {
      this.lastStep = nowMs;
      this.dir = this.nextDir;
      const [hx, hy] = this.body[0];
      const dx = [0, 1, 0, -1][this.dir], dy = [-1, 0, 1, 0][this.dir];
      const nx = hx + dx, ny = hy + dy;
      if (nx < 0 || ny < 0 || nx >= this.G || ny >= this.G || this.body.some(([x, y]) => x === nx && y === ny)) {
        this.dead = true;
        ctx.settings.snakeHigh = Math.max(ctx.settings.snakeHigh, this.score);
        ctx.beep(320, 260, true);
      } else {
        this.body.unshift([nx, ny]);
        if (nx === this.food[0] && ny === this.food[1]) {
          this.score++;
          this.placeFood();
          ctx.beep(1046, 55);
        } else {
          this.body.pop();
        }
      }
    }
    fb.clear();
    fb.rect(this.food[0] * 4 + 1, this.food[1] * 4 + 1, 3, 3, [229, 72, 122]);
    this.body.forEach(([x, y], i) => {
      fb.rect(x * 4, y * 4, 4, 4, i === 0 ? [120, 255, 130] : [55, 185, 85]);
    });
    drawText3x5(fb, `${this.score}`, 3, 3, 1, [200, 205, 220]);
    if (this.dead) {
      fb.dimAll(90);
      drawCentered5x7(fb, 'GAME OVER', 64, 48, 1, [255, 110, 90]);
      drawCentered5x7(fb, `SCORE ${this.score}`, 64, 62, 1, [244, 241, 234]);
      drawCentered5x7(fb, 'OK TO RETRY', 64, 80, 1, [94, 234, 140]);
    }
    return 20;
  }
}

class PongScene implements Scene {
  id = 'pong';
  name = 'Pong';
  category = 2 as const;
  autoplayEligible = false;
  private started = false;
  private scoreL = 0; private scoreR = 0;
  private leftY = 64; private rightY = 64;
  private bx = 64; private by = 64; private vx = 72; private vy = 38;
  private playerL = false;
  private lastMs = 0;

  start() { this.started = false; }
  private begin(ctx: SimContext) {
    this.started = true; this.scoreL = this.scoreR = 0; this.leftY = this.rightY = 64;
    this.playerL = false; this.lastMs = ctx.nowMs; this.serve(1);
    ctx.beep(660, 100);
  }
  private serve(dir: number) {
    this.bx = 64; this.by = 64;
    this.vx = 78 * dir;
    this.vy = (Math.random() - 0.5) * 90;
  }
  input(ctx: SimContext, k: SimKey) {
    if (!this.started) {
      if (k === 'Select') { this.begin(ctx); return true; }
      return false;
    }
    if (k === 'Up' || k === 'Down') { this.playerL = true; return true; }
    if (k === 'Left' || k === 'Right') return true;
    if (k === 'Select') { this.scoreL = this.scoreR = 0; this.playerL = false; return true; }
    return false;
  }
  draw(ctx: SimContext) {
    if (!this.started) {
      drawIntroCard(ctx, 'PONG', ['FIRST TO 9', 'UP/DOWN TO PLAY'], [230, 230, 230]);
      return 60;
    }
    const { fb, held, nowMs } = ctx;
    const dt = Math.min(0.05, Math.max(0.001, (nowMs - this.lastMs) / 1000));
    this.lastMs = nowMs;
    const half = 11, px = 8, pSpeed = 105;

    if (this.playerL) {
      if (held.has('Up')) this.leftY -= pSpeed * dt;
      if (held.has('Down')) this.leftY += pSpeed * dt;
    } else {
      const target = this.vx < 0 ? this.by : 64;
      this.leftY += Math.sign(target - this.leftY) * Math.min(Math.abs(target - this.leftY), 68 * dt);
    }
    const rTarget = this.vx > 0 ? this.by : 64;
    this.rightY += Math.sign(rTarget - this.rightY) * Math.min(Math.abs(rTarget - this.rightY), 66 * dt);
    this.leftY = Math.max(half, Math.min(LED_H - half, this.leftY));
    this.rightY = Math.max(half, Math.min(LED_H - half, this.rightY));

    this.bx += this.vx * dt;
    this.by += this.vy * dt;
    if (this.by < 2) { this.by = 2; this.vy = Math.abs(this.vy); ctx.beep(640, 25); }
    if (this.by > LED_H - 3) { this.by = LED_H - 3; this.vy = -Math.abs(this.vy); ctx.beep(640, 25); }
    if (this.vx < 0 && this.bx <= px + 2 && this.bx >= px - 1 && Math.abs(this.by - this.leftY) <= half + 1) {
      this.vx = Math.abs(this.vx) * 1.05;
      this.vy = ((this.by - this.leftY) / half) * 85;
      this.bx = px + 2;
      ctx.beep(720, 25);
    }
    if (this.vx > 0 && this.bx >= LED_W - px - 3 && this.bx <= LED_W - px && Math.abs(this.by - this.rightY) <= half + 1) {
      this.vx = -Math.abs(this.vx) * 1.05;
      this.vy = ((this.by - this.rightY) / half) * 85;
      this.bx = LED_W - px - 3;
      ctx.beep(720, 25);
    }
    if (this.bx < -2) {
      this.scoreR++; ctx.beep(784, 120);
      if (this.scoreR >= 9) { this.scoreL = this.scoreR = 0; }
      this.serve(1);
    } else if (this.bx > LED_W + 2) {
      this.scoreL++; ctx.beep(784, 120);
      if (this.scoreL >= 9) { this.scoreL = this.scoreR = 0; }
      this.serve(-1);
    }

    fb.clear();
    for (let y = 0; y < LED_H; y += 4) fb.vLine(64, y, y + 1, [60, 60, 60]);
    drawCentered5x7(fb, String(this.scoreL), 44, 8, 2, [160, 165, 180]);
    drawCentered5x7(fb, String(this.scoreR), 84, 8, 2, [160, 165, 180]);
    fb.rect(px - 1, (this.leftY - half) | 0, 3, half * 2, [244, 241, 234]);
    fb.rect(LED_W - px - 2, (this.rightY - half) | 0, 3, half * 2, [244, 241, 234]);
    fb.rect((this.bx - 1) | 0, (this.by - 1) | 0, 3, 3, [255, 176, 32]);
    return 16;
  }
}

const TETROMINOES: number[][][][] = [
  [[[0,1],[1,1],[2,1],[3,1]], [[2,0],[2,1],[2,2],[2,3]], [[0,2],[1,2],[2,2],[3,2]], [[1,0],[1,1],[1,2],[1,3]]],
  [[[0,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[1,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[0,2],[1,2]]],
  [[[2,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,1],[0,2]], [[0,0],[1,0],[1,1],[1,2]]],
  [[[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]]],
  [[[1,0],[2,0],[0,1],[1,1]], [[1,0],[1,1],[2,1],[2,2]], [[1,1],[2,1],[0,2],[1,2]], [[0,0],[0,1],[1,1],[1,2]]],
  [[[1,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[2,1],[1,2]], [[1,0],[0,1],[1,1],[1,2]]],
  [[[0,0],[1,0],[1,1],[2,1]], [[2,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[1,2],[2,2]], [[1,0],[0,1],[1,1],[0,2]]],
];
const TET_COLS: RGB[] = [[0,0,0], [31,201,183], [70,120,255], [255,160,40], [255,215,50], [139,203,60], [175,115,245], [229,72,122]];

class TetrisScene implements Scene {
  id = 'tetris';
  name = 'Tetris';
  category = 2 as const;
  autoplayEligible = false;
  private started = false;
  private dead = false;
  private grid = Array.from({ length: 20 }, () => new Uint8Array(10));
  private type = 0; private rot = 0; private px = 3; private py = 0; private next = 1;
  private score = 0; private lines = 0; private lastFall = 0;

  start() { this.started = false; }
  private begin(ctx: SimContext) {
    this.started = true; this.dead = false; this.score = 0; this.lines = 0;
    this.grid.forEach((r) => r.fill(0));
    this.next = (Math.random() * 7) | 0;
    this.spawn(ctx);
    this.lastFall = ctx.nowMs;
    ctx.beep(660, 120);
  }
  private fits(t: number, r: number, x: number, y: number) {
    for (const [cx, cy] of TETROMINOES[t][r]) {
      const gx = x + cx, gy = y + cy;
      if (gx < 0 || gx >= 10 || gy >= 20) return false;
      if (gy >= 0 && this.grid[gy][gx]) return false;
    }
    return true;
  }
  private spawn(ctx: SimContext) {
    this.type = this.next;
    this.next = (Math.random() * 7) | 0;
    this.rot = 0; this.px = 3; this.py = 0;
    if (!this.fits(this.type, 0, 3, 0)) {
      this.dead = true;
      ctx.settings.tetrisHigh = Math.max(ctx.settings.tetrisHigh, this.score);
      ctx.beep(320, 260, true);
    }
  }
  private lock(ctx: SimContext) {
    for (const [cx, cy] of TETROMINOES[this.type][this.rot]) {
      const gx = this.px + cx, gy = this.py + cy;
      if (gy >= 0 && gy < 20) this.grid[gy][gx] = this.type + 1;
    }
    let cleared = 0;
    for (let y = 19; y >= 0; y--) {
      if (this.grid[y].every((v) => v > 0)) {
        this.grid.splice(y, 1);
        this.grid.unshift(new Uint8Array(10));
        cleared++; y++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      this.score += [0, 100, 300, 500, 800][cleared];
      ctx.beep(988, 90);
    }
    this.spawn(ctx);
  }
  input(ctx: SimContext, k: SimKey) {
    if (!this.started || this.dead) {
      if (k === 'Select') { this.begin(ctx); return true; }
      return false;
    }
    if (k === 'Left' && this.fits(this.type, this.rot, this.px - 1, this.py)) { this.px--; return true; }
    if (k === 'Right' && this.fits(this.type, this.rot, this.px + 1, this.py)) { this.px++; return true; }
    if (k === 'Up') {
      const nr = (this.rot + 1) & 3;
      if (this.fits(this.type, nr, this.px, this.py)) this.rot = nr;
      else if (this.fits(this.type, nr, this.px - 1, this.py)) { this.px--; this.rot = nr; }
      else if (this.fits(this.type, nr, this.px + 1, this.py)) { this.px++; this.rot = nr; }
      return true;
    }
    if (k === 'Down') return true;
    if (k === 'Select') {
      while (this.fits(this.type, this.rot, this.px, this.py + 1)) { this.py++; this.score += 2; }
      this.lock(ctx);
      return true;
    }
    return false;
  }
  draw(ctx: SimContext) {
    if (!this.started) {
      drawIntroCard(ctx, 'TETRIS', [`BEST ${ctx.settings.tetrisHigh}`, 'UP ROTATE / OK DROP'], [31, 201, 183]);
      return 60;
    }
    const { fb, held, nowMs } = ctx;
    const fallMs = held.has('Down') ? 55 : Math.max(120, 480 - this.lines * 14);
    if (!this.dead && nowMs - this.lastFall >= fallMs) {
      this.lastFall = nowMs;
      if (this.fits(this.type, this.rot, this.px, this.py + 1)) this.py++;
      else this.lock(ctx);
    }
    fb.clear();
    const ox = 8, oy = 4, cell = 6;
    fb.rect(ox - 1, oy - 1, 10 * cell + 2, 20 * cell + 2, [40, 48, 70]);
    fb.rect(ox, oy, 10 * cell, 20 * cell, [8, 12, 22]);
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 10; x++) {
        const v = this.grid[y][x];
        if (v) fb.rect(ox + x * cell, oy + y * cell, cell - 1, cell - 1, TET_COLS[v]);
      }
    }
    if (!this.dead) {
      for (const [cx, cy] of TETROMINOES[this.type][this.rot]) {
        const gx = this.px + cx, gy = this.py + cy;
        if (gy >= 0) fb.rect(ox + gx * cell, oy + gy * cell, cell - 1, cell - 1, TET_COLS[this.type + 1]);
      }
    }
    drawText3x5(fb, 'NEXT', 78, 12, 1, [160, 170, 195]);
    for (const [cx, cy] of TETROMINOES[this.next][0]) {
      fb.rect(78 + cx * 5, 22 + cy * 5, 4, 4, TET_COLS[this.next + 1]);
    }
    drawText3x5(fb, 'SCORE', 78, 56, 1, [160, 170, 195]);
    drawText3x5(fb, String(this.score), 78, 64, 1, [255, 176, 32]);
    drawText3x5(fb, 'LINES', 78, 80, 1, [160, 170, 195]);
    drawText3x5(fb, String(this.lines), 78, 88, 1, [94, 234, 140]);
    if (this.dead) {
      fb.dimAll(95);
      drawCentered5x7(fb, 'TOP OUT', 64, 52, 1, [255, 110, 90]);
      drawCentered5x7(fb, 'OK TO RETRY', 64, 68, 1, [94, 234, 140]);
    }
    return 25;
  }
}

class LabyrinthScene implements Scene {
  id = 'labyrinth';
  name = 'Labyrinth';
  category = 2 as const;
  autoplayEligible = true;
  private readonly N = 15;
  private map: Uint8Array[] = [];
  private px = 1.5; private py = 1.5; private ang = 0;
  private depth = 1;
  private lastInputMs = -99999;

  start() { this.depth = 1; this.generate(); }
  private wall(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.N || y >= this.N) return 1;
    return this.map[y][x];
  }
  private generate() {
    this.map = Array.from({ length: this.N }, () => new Uint8Array(this.N).fill(1));
    const stack: [number, number][] = [[1, 1]];
    this.map[1][1] = 0;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const dirs = [[0,-2],[2,0],[0,2],[-2,0]].sort(() => Math.random() - 0.5);
      let carved = false;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx > 0 && ny > 0 && nx < this.N - 1 && ny < this.N - 1 && this.map[ny][nx] === 1) {
          this.map[ny][nx] = 0;
          this.map[cy + (dy >> 1)][cx + (dx >> 1)] = 0;
          stack.push([nx, ny]);
          carved = true;
          break;
        }
      }
      if (!carved) stack.pop();
    }
    this.map[this.N - 2][this.N - 2] = 2;
    this.px = 1.5; this.py = 1.5;
    this.ang = this.wall(2, 1) === 0 ? 0 : Math.PI / 2;
  }
  input(ctx: SimContext, k: SimKey) {
    if (k === 'Up' || k === 'Down' || k === 'Left' || k === 'Right' || k === 'Select') {
      this.lastInputMs = ctx.nowMs;
      return true;
    }
    return false;
  }
  draw(ctx: SimContext) {
    const { fb, held, palette, nowMs } = ctx;
    const auto = nowMs - this.lastInputMs > 4000;
    const speed = 0.08, turn = 0.075;
    if (auto) {
      this.ang += 0.015;
      const nx = this.px + Math.cos(this.ang) * speed;
      const ny = this.py + Math.sin(this.ang) * speed;
      if (this.wall(nx | 0, ny | 0) !== 1) { this.px = nx; this.py = ny; }
      else this.ang += 0.55;
    } else {
      if (held.has('Left')) this.ang -= turn;
      if (held.has('Right')) this.ang += turn;
      const step = (held.has('Up') ? 1 : 0) - (held.has('Down') ? 1 : 0);
      if (step) {
        const nx = this.px + Math.cos(this.ang) * speed * step;
        const ny = this.py + Math.sin(this.ang) * speed * step;
        if (this.wall(nx | 0, this.py | 0) !== 1) this.px = nx;
        if (this.wall(this.px | 0, ny | 0) !== 1) this.py = ny;
      }
    }
    if (this.wall(this.px | 0, this.py | 0) === 2) {
      this.depth++;
      ctx.beep(880, 120);
      this.generate();
    }

    fb.clear();
    // Ceiling & floor gradient
    for (let y = 0; y < 64; y++) fb.hLine(0, 127, y, [8, 10, 18]);
    for (let y = 64; y < 128; y++) fb.hLine(0, 127, y, [16, 18, 26]);

    // Raycast columns (step by 2px columns for crisp speed)
    const fov = 1.05;
    for (let x = 0; x < LED_W; x += 2) {
      const ra = this.ang + (x / LED_W - 0.5) * fov;
      const rdx = Math.cos(ra), rdy = Math.sin(ra);
      let d = 0.05;
      let hit = 0;
      while (d < 12) {
        const wx = (this.px + rdx * d) | 0, wy = (this.py + rdy * d) | 0;
        hit = this.wall(wx, wy);
        if (hit > 0) break;
        d += 0.08;
      }
      const perp = d * Math.cos(ra - this.ang);
      const h = Math.min(LED_H, (LED_H / Math.max(0.25, perp)) | 0);
      const y0 = 64 - (h >> 1);
      const shade = Math.max(35, Math.min(255, (255 - perp * 28) | 0));
      const col = hit === 2 ? dimRGB([255, 195, 45], shade) : lookupPalette(palette, (perp * 22) & 255, shade);
      fb.rect(x, y0, 2, h, col);
    }
    // Corner minimap
    for (let y = 0; y < this.N; y++) {
      for (let x = 0; x < this.N; x++) {
        const c: RGB = this.map[y][x] === 1 ? [55, 65, 90] : this.map[y][x] === 2 ? [255, 190, 40] : [12, 16, 26];
        fb.set(4 + x, 4 + y, c);
      }
    }
    fb.set(4 + (this.px | 0), 4 + (this.py | 0), [94, 234, 140]);
    drawText3x5(fb, `LVL ${this.depth}`, 94, 4, 1, [220, 224, 234]);
    return 30;
  }
}

// ---- Overlay, Launcher, Settings, Shell --------------------------------------------

const CAT_NAMES = ['CLOCKS', 'FITNESS', 'GAMES', 'ART'];
const CAT_ACCENTS: RGB[] = [[255, 184, 70], [255, 120, 105], [95, 225, 140], [165, 140, 255]];

export class CoriolisSimulator {
  readonly fb = new FrameBuffer();
  readonly out = new FrameBuffer();
  private scratch = new FrameBuffer();
  private scenes: Scene[];
  private cats: { label: string; sceneIdx: number }[][] = [[], [], [], []];
  private current = 0;
  private splashOn = true;
  private splashStart = -1;
  private launcherOpen = false;
  private lCat = 0;
  private lItem = 0;
  private settingsOpen = false;
  private sRow = 0;
  private toast: { text: string; until: number } | null = null;
  private trans: { from: FrameBuffer; start: number; dir: number } | null = null;
  private nextFrameMs = 0;
  private lastSwitchMs = 0;
  private held = new Set<SimKey>();
  private audioCtx: AudioContext | null = null;

  settings: SimSettings = {
    brightness: 255,
    paletteIndex: 0,
    rotation: 0,
    autoplay: false,
    autoplaySeconds: 20,
    overlayType: 0,
    overlayPos: 2,
    nightMode: false,
    audioEnabled: false,
    snakeHigh: 0,
    tetrisHigh: 0,
    yogaProgram: 0,
  };

  constructor(startSceneId?: string) {
    this.scenes = [
      new ClockScene(),
      new AnalogClockScene(),
      new WordClockScene(),
      new WeatherScene(),
      new CalendarScene(),
      new BounceScene(),
      new YogaScene(),
      new ExerciseScene(),
      new BreatheScene(),
      new TetrisScene(),
      new SnakeScene(),
      new PongScene(),
      new LabyrinthScene(),
      new CoriolisScene(),
      new AuroraScene(),
      new FireplaceProxy(),
      new AquariumScene(),
      new LavaScene(),
      new SpiroScene(),
      new MandalaScene(),
      new StarfieldScene(),
      new RainScene(),
      new LifeScene(),
    ];
    this.scenes.forEach((s, i) => this.cats[s.category].push({ label: s.name, sceneIdx: i }));
    if (startSceneId) {
      const idx = this.scenes.findIndex((s) => s.id === startSceneId);
      if (idx >= 0) {
        this.current = idx;
        this.splashOn = false;
      }
    }
    this.scenes[this.current].start?.(this.ctx(0));
  }

  private beep = (freq: number, ms: number, descend = false) => {
    if (!this.settings.audioEnabled) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx) this.audioCtx = new Ctx();
      if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();
      const t = this.audioCtx.currentTime;
      const o = this.audioCtx.createOscillator();
      const g = this.audioCtx.createGain();
      o.frequency.setValueAtTime(freq, t);
      if (descend) o.frequency.exponentialRampToValueAtTime(freq * 0.4, t + ms / 1000);
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.connect(g); g.connect(this.audioCtx.destination);
      o.start(t); o.stop(t + ms / 1000 + 0.02);
    } catch { /* audio blocked */ }
  };

  private ctx(nowMs: number): SimContext {
    return {
      fb: this.fb,
      palette: PALETTES[this.settings.paletteIndex % PALETTES.length],
      nowMs,
      held: this.held,
      settings: this.settings,
      beep: this.beep,
    };
  }

  setHeld(k: SimKey, down: boolean) {
    if (down) this.held.add(k);
    else this.held.delete(k);
  }

  clearHeld() {
    this.held.clear();
  }

  activeLabel(): string {
    if (this.splashOn) return 'Hello';
    if (this.launcherOpen) return 'Launcher';
    if (this.settingsOpen) return 'Settings';
    return this.scenes[this.current].name;
  }

  paletteName(): string {
    return PALETTES[this.settings.paletteIndex % PALETTES.length].name;
  }

  selectSceneById(id: string, nowMs: number) {
    const idx = this.scenes.findIndex((s) => s.id === id);
    if (idx >= 0) this.switchTo(idx, 0, nowMs);
  }

  key(k: SimKey, nowMs: number) {
    if (k === 'None') return;
    this.nextFrameMs = 0;
    if (this.splashOn) {
      this.endSplash(nowMs);
      return;
    }
    const c = this.ctx(nowMs);
    if (this.launcherOpen) {
      if (k === 'Left') { this.lCat = (this.lCat + 3) % 4; this.lItem = 0; }
      else if (k === 'Right') { this.lCat = (this.lCat + 1) % 4; this.lItem = 0; }
      else if (k === 'Up') { const n = this.cats[this.lCat].length; this.lItem = (this.lItem + n - 1) % n; }
      else if (k === 'Down') { const n = this.cats[this.lCat].length; this.lItem = (this.lItem + 1) % n; }
      else if (k === 'Select') {
        const chosen = this.cats[this.lCat][this.lItem]?.sceneIdx ?? 0;
        this.launcherOpen = false;
        if (chosen !== this.current) this.switchTo(chosen, 0, nowMs);
      } else if (k === 'Back') {
        this.launcherOpen = false;
      }
      return;
    }
    if (this.settingsOpen) {
      if (k === 'Up') this.sRow = (this.sRow + 4) % 5;
      else if (k === 'Down') this.sRow = (this.sRow + 1) % 5;
      else if (k === 'Left' || k === 'Right' || k === 'Select') {
        const d = k === 'Left' ? -1 : 1;
        if (this.sRow === 0) this.settings.paletteIndex = (this.settings.paletteIndex + PALETTES.length + d) % PALETTES.length;
        else if (this.sRow === 1) this.settings.overlayType = (this.settings.overlayType + 4 + d) % 4;
        else if (this.sRow === 2) this.settings.autoplay = !this.settings.autoplay;
        else if (this.sRow === 3) this.settings.nightMode = !this.settings.nightMode;
        else if (this.sRow === 4) this.settings.audioEnabled = !this.settings.audioEnabled;
      } else if (k === 'Back') {
        this.settingsOpen = false;
        this.fb.clear();
      }
      return;
    }

    if (this.scenes[this.current].input?.(c, k)) return;

    if (k === 'Right') this.switchTo((this.current + 1) % this.scenes.length, -1, nowMs);
    else if (k === 'Left') this.switchTo((this.current + this.scenes.length - 1) % this.scenes.length, 1, nowMs);
    else if (k === 'Up' || k === 'Down') {
      const d = k === 'Up' ? 1 : PALETTES.length - 1;
      this.settings.paletteIndex = (this.settings.paletteIndex + d) % PALETTES.length;
      this.toast = { text: this.paletteName(), until: nowMs + 1600 };
    } else if (k === 'Back' && this.current !== 0) {
      this.switchTo(0, 0, nowMs);
    }
  }

  command(cmd: SimCommand, nowMs: number) {
    if (cmd === 'None') return;
    this.nextFrameMs = 0;
    if (this.splashOn) this.endSplash(nowMs);
    switch (cmd) {
      case 'Menu':
        if (this.launcherOpen) this.launcherOpen = false;
        else if (this.settingsOpen) { this.settingsOpen = false; this.fb.clear(); }
        else {
          this.scratch.copyFrom(this.fb);
          this.scratch.dimAll(55);
          const scCat = this.scenes[this.current].category;
          this.lCat = scCat;
          const idx = this.cats[scCat].findIndex((i) => i.sceneIdx === this.current);
          this.lItem = Math.max(0, idx);
          this.launcherOpen = true;
        }
        break;
      case 'Settings':
        if (this.settingsOpen) { this.settingsOpen = false; this.fb.clear(); }
        else { this.launcherOpen = false; this.settingsOpen = true; }
        break;
      case 'Overlay': {
        this.settings.overlayType = (this.settings.overlayType + 1) % 4;
        const names = ['OFF', 'DIGITAL', 'ANALOG', 'WORD'];
        this.toast = { text: `CLOCK: ${names[this.settings.overlayType]}`, until: nowMs + 1600 };
        break;
      }
      case 'Next':
        this.launcherOpen = false;
        this.settingsOpen = false;
        this.switchTo((this.current + 1) % this.scenes.length, -1, nowMs);
        break;
      case 'Home':
        this.launcherOpen = false;
        this.settingsOpen = false;
        if (this.current !== 0) this.switchTo(0, 0, nowMs);
        break;
    }
  }

  rotate(nowMs: number) {
    this.settings.rotation = (this.settings.rotation + 1) % 4;
    this.toast = { text: `ROTATE ${this.settings.rotation * 90}`, until: nowMs + 1400 };
  }

  private endSplash(nowMs: number) {
    if (!this.splashOn) return;
    this.splashOn = false;
    this.fb.clear();
    this.scenes[this.current].start?.(this.ctx(nowMs));
    this.lastSwitchMs = nowMs;
  }

  private switchTo(to: number, dir: number, nowMs: number) {
    const snap = new FrameBuffer();
    snap.copyFrom(this.launcherOpen ? this.out : this.fb);
    this.trans = { from: snap, start: nowMs, dir };
    this.scenes[this.current].stop?.(this.ctx(nowMs));
    this.current = to;
    this.fb.clear();
    this.scenes[this.current].start?.(this.ctx(nowMs));
    this.nextFrameMs = 0;
    this.lastSwitchMs = nowMs;
    this.toast = { text: this.scenes[this.current].name.toUpperCase(), until: nowMs + 1600 };
  }

  tick(nowMs: number): boolean {
    if (this.splashStart < 0) this.splashStart = nowMs;
    if (this.splashOn && nowMs - this.splashStart >= 2500) this.endSplash(nowMs);
    if (!this.splashOn && !this.launcherOpen && !this.settingsOpen && this.settings.autoplay &&
        this.scenes[this.current].autoplayEligible && nowMs - this.lastSwitchMs >= this.settings.autoplaySeconds * 1000) {
      let to = (this.current + 1) % this.scenes.length;
      while (to !== this.current && !this.scenes[to].autoplayEligible) to = (to + 1) % this.scenes.length;
      this.switchTo(to, -1, nowMs);
    }

    if (nowMs < this.nextFrameMs && !this.trans && !this.launcherOpen) return false;

    const c = this.ctx(nowMs);
    if (this.splashOn) {
      this.drawSplash(nowMs);
      this.nextFrameMs = nowMs + 30;
    } else if (!this.launcherOpen && !this.settingsOpen) {
      const delay = this.scenes[this.current].draw(c);
      this.nextFrameMs = nowMs + Math.max(16, delay);
    } else {
      this.nextFrameMs = nowMs + 33;
    }

    if (this.launcherOpen) {
      this.out.copyFrom(this.scratch);
      this.drawLauncher();
    } else if (this.settingsOpen) {
      this.out.clear();
      this.drawSettings();
    } else if (this.trans) {
      const p = Math.min(1, (nowMs - this.trans.start) / 260);
      if (p >= 1) {
        this.out.copyFrom(this.fb);
        this.trans = null;
      } else if (this.trans.dir === 0) {
        for (let i = 0; i < this.out.px.length; i++) {
          this.out.px[i] = (this.trans.from.px[i] * (1 - p) + this.fb.px[i] * p) | 0;
        }
      } else {
        const shift = ((p * LED_W) | 0) * this.trans.dir;
        for (let y = 0; y < LED_H; y++) {
          for (let x = 0; x < LED_W; x++) {
            const ox = x - shift;
            const col = ox >= 0 && ox < LED_W ? this.trans.from.at(ox, y) : this.fb.at((ox + LED_W) % LED_W, y);
            this.out.set(x, y, col);
          }
        }
      }
    } else {
      this.out.copyFrom(this.fb);
    }

    if (!this.splashOn && !this.launcherOpen && !this.settingsOpen) this.drawOverlay();
    if (this.toast) {
      if (nowMs >= this.toast.until) this.toast = null;
      else this.drawToast(this.toast.text);
    }
    return true;
  }

  private drawSplash(nowMs: number) {
    const t = (nowMs - this.splashStart) / 1000;
    this.fb.dimAll(185);
    for (let i = 0; i < 64; i++) {
      const h = (i * 2654435761 + 17) >>> 0;
      const a0 = ((h & 0xffff) / 65536) * Math.PI * 2;
      const arrive = 0.9 + (((h >> 16) & 0xff) / 255) * 0.6;
      const p = t / arrive;
      if (p >= 1) continue;
      const e = p * p * (3 - 2 * p);
      const r = 96 * (1 - e) * (0.55 + (((h >> 24) & 0x3f) / 140));
      const a = a0 + e * e * 5.5;
      this.fb.set(64 + Math.cos(a) * r, 60 + Math.sin(a) * r * 0.92, hsv(120 + ((i * 7) % 80), 190, 255));
    }
    if (t > 1.0 && t < 1.9) {
      const k = (t - 1.0) / 0.9;
      this.fb.circle(64, 60, (6 + k * 56) | 0, dimRGB(hsv(150, 120, 255), ((1 - k) * 200) | 0));
    }
    if (t > 1.0) {
      const k = Math.min(1, (t - 1.0) / 0.6);
      const b = (k * 255) | 0;
      drawCentered5x7(this.fb, 'coriolis', 64, 54, 2, [b, b, b], dimRGB([31, 201, 183], b));
    }
  }

  private drawLauncher() {
    const acc = CAT_ACCENTS[this.lCat];
    this.out.rect(4, 4, 120, 16, [18, 24, 40]);
    for (let c = 0; c < 4; c++) {
      this.out.rect(10 + c * 28, 7, 22, 10, c === this.lCat ? CAT_ACCENTS[c] : [45, 55, 78]);
    }
    drawText3x5(this.out, CAT_NAMES[this.lCat], 8, 25, 1, acc);
    const items = this.cats[this.lCat];
    const start = Math.max(0, this.lItem - 4);
    for (let i = start; i < Math.min(items.length, start + 6); i++) {
      const ry = 36 + (i - start) * 14;
      const sel = i === this.lItem;
      if (sel) this.out.rect(6, ry - 2, 116, 12, acc);
      drawText3x5(this.out, items[i].label, 12, ry + 1, 1, sel ? [12, 16, 28] : [220, 225, 238]);
    }
  }

  private drawSettings() {
    drawCentered5x7(this.out, 'SETTINGS', 64, 8, 1, [255, 176, 32]);
    const rows = [
      ['PALETTE', this.paletteName()],
      ['CLOCK', ['OFF', 'DIGI', 'ANLG', 'WORD'][this.settings.overlayType]],
      ['AUTOPLAY', this.settings.autoplay ? 'ON' : 'OFF'],
      ['NIGHT DIM', this.settings.nightMode ? 'ON' : 'OFF'],
      ['AUDIO', this.settings.audioEnabled ? 'ON' : 'OFF'],
    ];
    rows.forEach(([k, v], i) => {
      const y = 28 + i * 16;
      const sel = i === this.sRow;
      if (sel) this.out.rect(6, y - 2, 116, 12, [31, 201, 183]);
      drawText3x5(this.out, k, 10, y + 1, 1, sel ? [12, 16, 28] : [180, 190, 210]);
      drawText3x5(this.out, v, 118 - width3x5(v), y + 1, 1, sel ? [12, 16, 28] : [255, 176, 32]);
    });
    drawCentered5x7(this.out, 'BACK TO EXIT', 64, 114, 1, [120, 130, 155]);
  }

  private drawOverlay() {
    const type = this.settings.overlayType;
    if (!type) return;
    const t = getNow();
    const txt = `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`;
    if (type === 1) {
      const w = width3x5(txt, 2) + 6;
      this.out.rect(LED_W - w - 3, 3, w, 14, [10, 14, 22]);
      drawText3x5(this.out, txt, LED_W - w, 5, 2, [244, 241, 234]);
    } else if (type === 2) {
      const cx = 112, cy = 16, r = 12;
      this.out.fillCircle(cx, cy, r + 1, [10, 14, 22]);
      this.out.circle(cx, cy, r, [210, 210, 210]);
      const ah = ((t.h % 12) + t.m / 60) * ((Math.PI * 2) / 12);
      const am = t.m * ((Math.PI * 2) / 60);
      this.out.line(cx, cy, cx + Math.round(Math.sin(ah) * 6), cy - Math.round(Math.cos(ah) * 6), [255, 255, 255]);
      this.out.line(cx, cy, cx + Math.round(Math.sin(am) * 10), cy - Math.round(Math.cos(am) * 10), [255, 176, 32]);
    } else {
      const w = width3x5(txt, 1) + 6;
      this.out.rect(3, 3, w, 9, [10, 14, 22]);
      drawText3x5(this.out, txt, 6, 5, 1, [94, 234, 140]);
    }
  }

  private drawToast(text: string) {
    const w = Math.min(120, width3x5(text, 1) + 10);
    const x = ((LED_W - w) / 2) | 0;
    this.out.rect(x, 108, w, 12, [14, 20, 36]);
    this.out.hLine(x, x + w - 1, 108, [94, 234, 140]);
    drawText3x5(this.out, text, ((LED_W - width3x5(text, 1)) / 2) | 0, 111, 1, [244, 241, 234]);
  }

  private imgCache = new WeakMap<CanvasRenderingContext2D, { pitch: number; gap: number; img: ImageData; u32: Uint32Array }>();

  renderToCanvas(ctx2d: CanvasRenderingContext2D, pixelPitch = 5, gap = 1) {
    const dim = this.settings.nightMode ? 120 : 255;
    const rot = this.settings.rotation & 3;
    const pitch = pixelPitch;
    const lit = Math.max(1, pitch - gap);
    const W = LED_W * pitch;
    const H = LED_H * pitch;

    let entry = this.imgCache.get(ctx2d);
    if (!entry || entry.pitch !== pitch || entry.gap !== gap) {
      const img = ctx2d.createImageData(W, H);
      const u32 = new Uint32Array(img.data.buffer);
      entry = { pitch, gap, img, u32 };
      this.imgCache.set(ctx2d, entry);
    }

    const { img, u32 } = entry;
    // Little-endian ABGR dark panel housing color (#07090e -> 0xff0e0907)
    u32.fill(0xff0e0907);

    for (let y = 0; y < LED_H; y++) {
      for (let x = 0; x < LED_W; x++) {
        const o = (y * LED_W + x) * 3;
        const r = (this.out.px[o] * dim) >> 8;
        const g = (this.out.px[o + 1] * dim) >> 8;
        const b = (this.out.px[o + 2] * dim) >> 8;
        if ((r | g | b) === 0) continue;
        let dx = x, dy = y;
        if (rot === 1) { dx = LED_H - 1 - y; dy = x; }
        else if (rot === 2) { dx = LED_W - 1 - x; dy = LED_H - 1 - y; }
        else if (rot === 3) { dx = y; dy = LED_W - 1 - x; }
        const abgr = (0xff << 24) | (b << 16) | (g << 8) | r;
        const px0 = dx * pitch;
        const py0 = dy * pitch;
        for (let py = 0; py < lit; py++) {
          let idx = (py0 + py) * W + px0;
          for (let px = 0; px < lit; px++) u32[idx++] = abgr;
        }
      }
    }
    ctx2d.putImageData(img, 0, 0);
  }
}

class FireplaceProxy extends FireScene {}
