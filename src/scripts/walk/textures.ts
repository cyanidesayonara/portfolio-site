/*
  Procedural canvas textures for the seafront level. Nothing is loaded from
  disk: panots, sand, asphalt, deck planks, masonry and the sea's ripples are
  all drawn here, the way Path of Leash Resistance draws everything in code.
*/
import * as THREE from 'three';

const canvas = (w: number, h = w) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// Small deterministic PRNG so textures look the same on every load.
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tex = (c: HTMLCanvasElement, repeat = 1, srgb = true) => {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const speckle = (g: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], rMax: number, r: () => number) => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = 0.5 + r() * rMax;
    g.fillRect(r() * w, r() * h, s, s);
  }
};

/*
  Panot de flor: 20 cm tiles, four petal grooves on the diagonals around a
  ringed button (geometry from world/panot.gd). One canvas holds 2×2 tiles,
  so the texture repeats every 0.4 m. Returns a color map and a bump map.
*/
export function panotTextures(base = '#d8d0c0') {
  const S = 512, T = 256;
  const col = canvas(S), bump = canvas(S);
  const g = col.getContext('2d')!, b = bump.getContext('2d')!;
  const r = rng(7);
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const x0 = tx * T, y0 = ty * T, cx = x0 + T / 2, cy = y0 + T / 2;
      // Each tile weathers a little differently.
      const v = (r() - 0.5) * 14;
      g.fillStyle = base;
      g.fillRect(x0, y0, T, T);
      g.fillStyle = v > 0 ? `rgba(255,252,244,${v / 90})` : `rgba(60,48,36,${-v / 90})`;
      g.fillRect(x0, y0, T, T);
      b.fillStyle = '#808080';
      b.fillRect(x0, y0, T, T);
      speckle(g, T, T, 900, ['rgba(80,70,58,0.10)', 'rgba(255,255,255,0.10)', 'rgba(40,34,28,0.07)'], 2.2, r);
      g.save();
      g.translate(x0, y0);
      g.restore();

      const R = 0.37 * T;
      const groove = (draw: (ctx: CanvasRenderingContext2D) => void, w: number) => {
        // Color: dark groove with a light lip offset toward the light.
        g.lineWidth = w;
        g.strokeStyle = 'rgba(40,30,22,0.20)';
        g.beginPath(); draw(g); g.stroke();
        g.save(); g.translate(-1.5, -1.5);
        g.strokeStyle = 'rgba(255,250,240,0.22)';
        g.lineWidth = w * 0.45;
        g.beginPath(); draw(g); g.stroke();
        g.restore();
        b.lineWidth = w;
        b.strokeStyle = '#3c3c3c';
        b.beginPath(); draw(b); b.stroke();
      };
      const ringW = 0.115 * R * 0.8;
      // Four petals on the diagonals.
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + (k * Math.PI) / 2;
        const px = cx + Math.cos(a) * 0.59 * R * 1.25;
        const py = cy + Math.sin(a) * 0.59 * R * 1.25;
        groove((ctx) => {
          ctx.moveTo(px + 0.415 * R, py);
          ctx.arc(px, py, 0.415 * R, 0, Math.PI * 2);
        }, ringW);
      }
      // Ringed button in the middle.
      groove((ctx) => {
        ctx.moveTo(cx + 0.34 * R, cy);
        ctx.arc(cx, cy, 0.34 * R, 0, Math.PI * 2);
      }, ringW);
      g.fillStyle = 'rgba(255,250,240,0.16)';
      g.beginPath(); g.arc(cx - 2, cy - 2, 0.14 * R, 0, Math.PI * 2); g.fill();
      b.fillStyle = '#a8a8a8';
      b.beginPath(); b.arc(cx, cy, 0.14 * R, 0, Math.PI * 2); b.fill();
      // Joints between tiles.
      g.strokeStyle = 'rgba(70,58,46,0.38)';
      g.lineWidth = 3;
      g.strokeRect(x0 + 1.5, y0 + 1.5, T - 3, T - 3);
      b.strokeStyle = '#202020';
      b.lineWidth = 4;
      b.strokeRect(x0 + 2, y0 + 2, T - 4, T - 4);
    }
  }
  // Grime and gum spots.
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(50,42,34,${0.04 + r() * 0.06})`;
    g.beginPath(); g.arc(r() * S, r() * S, 4 + r() * 18, 0, Math.PI * 2); g.fill();
  }
  const map = tex(col, 1);
  const bumpMap = tex(bump, 1, false);
  return { map, bumpMap, tileMeters: 0.4 };
}

export function sandTexture() {
  const S = 512, c = canvas(S), g = c.getContext('2d')!, r = rng(11);
  g.fillStyle = '#e3cf9f';
  g.fillRect(0, 0, S, S);
  // Soft dunes of tone.
  for (let i = 0; i < 40; i++) {
    const x = r() * S, y = r() * S, rad = 40 + r() * 120;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const warm = r() > 0.5;
    grd.addColorStop(0, warm ? 'rgba(240,214,160,0.35)' : 'rgba(196,170,120,0.22)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
  }
  speckle(g, S, S, 9000, ['rgba(120,96,60,0.25)', 'rgba(255,248,230,0.4)', 'rgba(90,80,70,0.18)'], 1.6, r);
  // Wind ripples.
  g.strokeStyle = 'rgba(150,120,76,0.10)';
  g.lineWidth = 2;
  for (let y = 0; y < S; y += 14) {
    g.beginPath();
    for (let x = 0; x <= S; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 3);
    g.stroke();
  }
  return tex(c, 1);
}

export function asphaltTexture() {
  const S = 256, c = canvas(S), g = c.getContext('2d')!, r = rng(5);
  g.fillStyle = '#4a4d55';
  g.fillRect(0, 0, S, S);
  speckle(g, S, S, 6000, ['rgba(20,20,24,0.35)', 'rgba(140,140,150,0.25)', 'rgba(90,90,96,0.3)'], 1.4, r);
  return tex(c, 1);
}

export function deckTexture() {
  const S = 512, c = canvas(S), g = c.getContext('2d')!, r = rng(13);
  const planks = 8, pw = S / planks;
  for (let i = 0; i < planks; i++) {
    const tone = 0.85 + r() * 0.3;
    g.fillStyle = `rgb(${Math.round(150 * tone)},${Math.round(118 * tone)},${Math.round(86 * tone)})`;
    g.fillRect(i * pw, 0, pw, S);
    g.strokeStyle = 'rgba(70,48,30,0.25)';
    g.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      const x = i * pw + 4 + r() * (pw - 8);
      g.beginPath();
      g.moveTo(x, 0);
      for (let y = 0; y <= S; y += 32) g.lineTo(x + Math.sin(y * 0.03 + k) * 2, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(30,22,16,0.7)';
    g.fillRect(i * pw, 0, 3, S);
    // Plank ends and screws.
    const cut = r() * S;
    g.fillRect(i * pw, cut, pw, 2);
    g.fillStyle = 'rgba(60,60,64,0.8)';
    for (const y of [cut - 10, cut + 12]) {
      g.beginPath(); g.arc(i * pw + 12, (y + S) % S, 2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(i * pw + pw - 12, (y + S) % S, 2, 0, Math.PI * 2); g.fill();
    }
  }
  return tex(c, 1);
}

export function masonryTexture(base = '#b9ab92') {
  const S = 512, c = canvas(S), g = c.getContext('2d')!, r = rng(17);
  g.fillStyle = '#8a7e6a';
  g.fillRect(0, 0, S, S);
  const rows = 8, rh = S / rows;
  for (let y = 0; y < rows; y++) {
    let x = y % 2 ? -rh : 0;
    while (x < S) {
      const w = rh * (1.4 + r() * 0.9);
      const t = 0.85 + r() * 0.25;
      const bc = new THREE.Color(base).multiplyScalar(t);
      g.fillStyle = `#${bc.getHexString()}`;
      g.fillRect(x + 2, y * rh + 2, w - 4, rh - 4);
      x += w;
    }
  }
  speckle(g, S, S, 3000, ['rgba(40,34,28,0.12)', 'rgba(255,255,255,0.08)'], 2, r);
  return tex(c, 1);
}

export function plasterTexture() {
  const S = 256, c = canvas(S), g = c.getContext('2d')!, r = rng(23);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 30; i++) {
    const x = r() * S, y = r() * S, rad = 20 + r() * 60;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(120,100,80,${0.04 + r() * 0.05})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
  }
  speckle(g, S, S, 2500, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.3)'], 1.5, r);
  return tex(c, 1);
}

export function barkTexture() {
  // Plane-tree bark: olive and cream camouflage patches.
  const S = 256, c = canvas(S), g = c.getContext('2d')!, r = rng(29);
  g.fillStyle = '#9b9474';
  g.fillRect(0, 0, S, S);
  const cols = ['#c9c1a0', '#6f6a52', '#b3ad8c', '#857e60', '#d8d2b8'];
  for (let i = 0; i < 70; i++) {
    g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.beginPath();
    const x = r() * S, y = r() * S;
    g.ellipse(x, y, 8 + r() * 22, 6 + r() * 16, r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c, 1);
}

export function palmTrunkTexture() {
  const S = 128, c = canvas(32, S), g = c.getContext('2d')!;
  for (let y = 0; y < S; y += 8) {
    g.fillStyle = '#8f7350';
    g.fillRect(0, y, 32, 8);
    g.fillStyle = '#6e5538';
    g.fillRect(0, y + 6, 32, 2);
  }
  return tex(c, 1);
}

/* Tileable ripple normal map for the sea (sum of periodic sines). */
export function waterNormalTexture() {
  const S = 256, c = canvas(S), g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  const h = (x: number, y: number) => {
    const u = (x / S) * Math.PI * 2, v = (y / S) * Math.PI * 2;
    return (
      Math.sin(u * 3 + v * 2) * 0.5 +
      Math.sin(u * 7 - v * 5 + 1.3) * 0.25 +
      Math.sin(-u * 11 + v * 13 + 0.4) * 0.12 +
      Math.sin(u * 17 + v * 19 + 2.1) * 0.07
    );
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const n = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize();
      const i = (y * S + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c, 1, false);
}

export function herasMeshTexture() {
  const S = 128, c = canvas(S), g = c.getContext('2d')!;
  g.clearRect(0, 0, S, S);
  g.strokeStyle = 'rgba(205,210,210,0.95)';
  g.lineWidth = 2;
  for (let i = 0; i <= S; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke();
  }
  for (let i = 0; i <= S; i += 32) {
    g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke();
  }
  return tex(c, 1);
}

export function hazardTexture() {
  const c = canvas(128, 16), g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 16);
  g.fillStyle = '#f0751f';
  for (let x = -16; x < 128; x += 32) {
    g.beginPath();
    g.moveTo(x, 16); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 16);
    g.fill();
  }
  return tex(c, 1);
}

/* Shop sign. Redrawn once webfonts are ready so it never sticks in a fallback face. */
export function signTexture(title: string, subtitle: string, accent: string, opts: { bg?: string; fg?: string; aspect?: number } = {}) {
  const { bg = '#f4f1ea', fg = '#0b1430', aspect = 4 } = opts;
  const c = canvas(Math.round(160 * aspect), 160);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const draw = () => {
    const g = c.getContext('2d')!;
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = accent;
    g.lineWidth = 12;
    g.strokeRect(6, 6, c.width - 12, c.height - 12);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const size = title.length > 16 ? 40 : title.length > 10 ? 50 : 60;
    g.font = `800 ${size}px 'Bricolage Grotesque Variable', 'Bricolage Grotesque', system-ui, sans-serif`;
    g.fillText(title, c.width / 2, subtitle ? 66 : 82, c.width - 40);
    if (subtitle) {
      g.fillStyle = fg === '#0b1430' ? '#3a4a75' : fg;
      g.globalAlpha = fg === '#0b1430' ? 1 : 0.8;
      g.font = "700 22px 'Inter Variable', 'Inter', system-ui, sans-serif";
      g.fillText(subtitle.toUpperCase(), c.width / 2, 120, c.width - 40);
      g.globalAlpha = 1;
    }
    t.needsUpdate = true;
  };
  draw();
  document.fonts?.ready.then(draw).catch(() => {});
  return t;
}

/* Large saw-cut stone slabs (the Rambla): ~1.2 × 0.6 m, light grey. Canvas covers 2.4 m. */
export function slabTexture(base = '#bdbab2', joint = 'rgba(70,66,60,0.45)') {
  const S = 512, c = canvas(S), g = c.getContext('2d')!, r = rng(31);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  const rows = 4, rh = S / rows, cw = S / 2;
  for (let y = 0; y < rows; y++) {
    const off = y % 2 ? cw / 2 : 0;
    for (let x = -1; x < 3; x++) {
      const t = (r() - 0.5) * 16;
      g.fillStyle = t > 0 ? `rgba(255,255,250,${t / 120})` : `rgba(40,36,30,${-t / 120})`;
      g.fillRect(x * cw + off, y * rh, cw, rh);
    }
  }
  speckle(g, S, S, 7000, ['rgba(60,56,50,0.12)', 'rgba(255,255,255,0.12)'], 1.6, r);
  g.strokeStyle = joint;
  g.lineWidth = 3;
  for (let y = 0; y <= rows; y++) { g.beginPath(); g.moveTo(0, y * rh); g.lineTo(S, y * rh); g.stroke(); }
  for (let y = 0; y < rows; y++) {
    const off = y % 2 ? cw / 2 : 0;
    for (let x = 0; x <= 2; x++) { g.beginPath(); g.moveTo(x * cw + off, y * rh); g.lineTo(x * cw + off, (y + 1) * rh); g.stroke(); }
  }
  return { map: tex(c, 1), tileMeters: 2.4 };
}

/* Dark grey flagstones (Carrer del Mar): random-length courses. Canvas covers 2 m. */
export function flagstoneTexture() {
  const S = 512, c = canvas(S), g = c.getContext('2d')!, r = rng(37);
  g.fillStyle = '#3e3f43';
  g.fillRect(0, 0, S, S);
  const rows = 6, rh = S / rows;
  for (let y = 0; y < rows; y++) {
    let x = -r() * 80;
    while (x < S) {
      const w = 60 + r() * 120;
      const v = 82 + Math.floor((r() - 0.5) * 22);
      g.fillStyle = `rgb(${v},${v + 1},${v + 4})`;
      g.fillRect(x + 2, y * rh + 2, w - 4, rh - 4);
      x += w;
    }
  }
  speckle(g, S, S, 6000, ['rgba(20,20,24,0.25)', 'rgba(200,200,205,0.12)'], 1.5, r);
  return { map: tex(c, 1), tileMeters: 2 };
}

export function concreteTexture(base = '#d8d2c4') {
  const S = 256, c = canvas(S), g = c.getContext('2d')!, r = rng(41);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  speckle(g, S, S, 5000, ['rgba(90,84,74,0.12)', 'rgba(255,255,255,0.2)'], 1.3, r);
  g.strokeStyle = 'rgba(90,84,74,0.3)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, S - 2, S - 2);
  return { map: tex(c, 1), tileMeters: 3 };
}

/* Beige stone-look wall panels for the underpass (~0.6 × 0.4 m). Canvas covers 2.4 × 1.6 m. */
export function wallPanelTexture() {
  const S = 512, c = canvas(S), g = c.getContext('2d')!, r = rng(43);
  g.fillStyle = '#8f8573';
  g.fillRect(0, 0, S, S);
  const cols = 4, rows = 4, cw = S / cols, rh = S / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = (r() - 0.5) * 18;
      const bc = new THREE.Color('#cfc3a8').offsetHSL(0, 0, v / 255);
      g.fillStyle = `#${bc.getHexString()}`;
      g.fillRect(x * cw + 2, y * rh + 2, cw - 4, rh - 4);
    }
  }
  speckle(g, S, S, 4000, ['rgba(80,70,56,0.15)', 'rgba(255,255,255,0.12)'], 1.6, r);
  return tex(c, 1);
}

/* Beige running-bond floor tiles for the underpass. Canvas covers 1.2 m. */
export function tileFloorTexture() {
  const S = 256, c = canvas(S), g = c.getContext('2d')!, r = rng(47);
  g.fillStyle = '#8a7c66';
  g.fillRect(0, 0, S, S);
  const rows = 4, rh = S / rows, cw = S / 2;
  for (let y = 0; y < rows; y++) {
    const off = y % 2 ? cw / 2 : 0;
    for (let x = -1; x < 3; x++) {
      const v = (r() - 0.5) * 14;
      const bc = new THREE.Color('#c9b9a0').offsetHSL(0, 0, v / 255);
      g.fillStyle = `#${bc.getHexString()}`;
      g.fillRect(x * cw + off + 1.5, y * rh + 1.5, cw - 3, rh - 3);
    }
  }
  return tex(c, 1);
}

/* A sea-and-pier mural for the underpass wall. */
export function muralTexture() {
  const c = canvas(1024, 256), g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, 150);
  sky.addColorStop(0, '#1fc9b7');
  sky.addColorStop(1, '#bfeee6');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#ffb020';
  g.beginPath(); g.arc(820, 70, 40, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2f6fb0';
  g.fillRect(0, 150, 1024, 106);
  g.strokeStyle = '#e8f6ff';
  g.lineWidth = 6;
  for (let y = 165; y < 256; y += 22) {
    g.beginPath();
    for (let x = 0; x <= 1024; x += 20) g.lineTo(x, y + Math.sin(x * 0.03 + y) * 5);
    g.stroke();
  }
  // The pier striding out to sea.
  g.fillStyle = '#f4f1ea';
  g.fillRect(80, 132, 640, 12);
  for (let x = 110; x < 720; x += 60) {
    g.beginPath(); g.moveTo(x - 14, 256); g.lineTo(x, 144); g.lineTo(x + 14, 256); g.closePath(); g.fill();
  }
  // A black dog pulling a human along it.
  g.fillStyle = '#141417';
  g.beginPath(); g.ellipse(560, 118, 26, 12, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(590, 104, 10, 0, Math.PI * 2); g.fill();
  g.fillRect(540, 124, 6, 10); g.fillRect(575, 124, 6, 10);
  g.strokeStyle = '#e5487a';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(582, 112); g.quadraticCurveTo(520, 70, 470, 92); g.stroke();
  g.fillStyle = '#b85c70';
  g.fillRect(455, 88, 18, 34);
  g.fillStyle = '#f2c49e';
  g.beginPath(); g.arc(464, 80, 9, 0, Math.PI * 2); g.fill();
  g.font = "800 46px 'Bricolage Grotesque Variable', system-ui, sans-serif";
  g.fillStyle = '#0b1430';
  g.fillText('MAR', 40, 70);
  return tex(c, 1);
}

/* A flat painted marking (bike glyph, arrows, text) as an alpha texture. */
export function paintTexture(drawFn: (g: CanvasRenderingContext2D, w: number, h: number) => void, w = 256, h = 256) {
  const c = canvas(w, h);
  const g = c.getContext('2d')!;
  drawFn(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
