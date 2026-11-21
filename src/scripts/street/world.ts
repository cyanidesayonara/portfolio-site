/*
  The street's layout and everything about it that never moves.

  World units: the street is WH tall and WORLD_W long; the game scales it
  to the canvas height. The static parts (ground, buildings, street
  furniture) are drawn once into an offscreen layer and blitted each
  frame; only things that sit above the characters (tree crowns, lamp
  heads, umbrellas) are drawn live.
*/

export type Stop = { id: string; label: string; kind: string; href: string; color: string; ink: string };

export type Lot =
  | { type: 'shop'; x: number; w: number; stop: Stop }
  | { type: 'park'; x: number; w: number; stop: Stop }
  | { type: 'house'; x: number; w: number; tone: number };
export type StopLot = Extract<Lot, { stop: Stop }>;

export type Circle = {
  shape: 'circle';
  x: number;
  y: number;
  r: number;
  what: 'lamp' | 'tree' | 'hydrant' | 'bin' | 'bollard' | 'table';
  marked?: boolean;
};
export type Box = { shape: 'box'; x: number; y: number; w: number; h: number; what: 'bench' | 'planter' };
export type Solid = Circle | Box;

export type World = {
  lots: Lot[];
  stops: StopLot[];
  solids: Solid[];
  peeSpots: Circle[];
  benches: Box[];
  crossings: number[];
  windows: { x: number; y: number; w: number; h: number }[];
  park: StopLot;
  width: number;
};

export const WH = 340;
export const FACADE = 120;
export const WALK_TOP = 126;
export const CURB = 214;
export const LANE_TOP = 218;
export const LANE_BOT = 262;
export const LANE = 240;
export const ROAD_TOP = 262;
export const CAR_LANES = { east: 320, west: 284 };

const HOUSE_TONES = ['#e3d3b4', '#d8b98f', '#cf8f6c', '#b9c3c9', '#e8dcc6'];
const FONT = "'Bricolage Grotesque Variable', 'Bricolage Grotesque', system-ui, sans-serif";
const BODY = "'Inter Variable', 'Inter', system-ui, sans-serif";

export const doorX = (l: StopLot) => (l.type === 'park' ? l.x + 70 : l.x + l.w / 2);
export const doorY = (l: StopLot) => (l.type === 'park' ? 165 : WALK_TOP + 10);

// A tiny deterministic random, so the street looks the same every visit.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildWorld(stops: Stop[]): World {
  const lots: Lot[] = [];
  let x = 0;
  const house = (w: number) => {
    lots.push({ type: 'house', x, w, tone: lots.length % HOUSE_TONES.length });
    x += w;
  };
  house(160);
  stops.forEach((stop, i) => {
    if (stop.id === 'park') {
      house(130);
      lots.push({ type: 'park', x, w: 320, stop });
      x += 320;
      return;
    }
    lots.push({ type: 'shop', x, w: 190, stop });
    x += 190;
    if (i % 2 === 1) house(130);
  });
  const width = x;
  const stopLots = lots.filter((l): l is StopLot => l.type !== 'house');
  const park = stopLots.find((l) => l.type === 'park')!;
  const shops = stopLots.filter((l) => l.type === 'shop');

  const solids: Solid[] = [];
  const crossings = [600, 1480].filter((c) => c < park.x - 80);
  const nearCrossing = (px: number) => crossings.some((c) => px > c - 40 && px < c + 100);

  // The curb line: lampposts and trees, with bins and hydrants between.
  for (let px = 110, i = 0; px < park.x - 40; px += 170, i++) {
    if (nearCrossing(px)) continue;
    solids.push(i % 3 === 1 ? { shape: 'circle', x: px, y: 194, r: 7, what: 'tree' } : { shape: 'circle', x: px, y: 202, r: 4.5, what: 'lamp' });
    if (i % 4 === 2) solids.push({ shape: 'circle', x: px + 70, y: 200, r: 5, what: 'hydrant' });
    else if (i % 4 === 0) solids.push({ shape: 'circle', x: px + 80, y: 198, r: 6, what: 'bin' });
  }
  for (const c of crossings) {
    for (const bx of [c - 14, c + 70]) solids.push({ shape: 'circle', x: bx, y: 208, r: 3.5, what: 'bollard' });
  }

  // Benches with planters, in front of the houses (never a shop door).
  const benches: Box[] = [];
  lots.forEach((l, i) => {
    if (l.type !== 'house' || i === 0 || l.x + l.w > park.x) return;
    benches.push({ shape: 'box', x: l.x + l.w / 2 - 24, y: 168, w: 48, h: 12, what: 'bench' });
  });
  solids.push(...benches);
  lots.forEach((l) => {
    if (l.type !== 'house' || l.x + l.w > park.x) return;
    solids.push({ shape: 'box', x: l.x + 8, y: 126, w: 26, h: 12, what: 'planter' });
  });

  // A café terrace outside the About café.
  const cafe = shops.find((l) => l.stop.id === 'about');
  if (cafe) {
    for (const tx of [cafe.x + 38, cafe.x + 152]) solids.push({ shape: 'circle', x: tx, y: 178, r: 8, what: 'table' });
  }

  // Trees in the park are solid too.
  for (const [tx, ty] of [[park.x + 180, 150], [park.x + 270, 120], [park.x + 240, 210]]) {
    solids.push({ shape: 'circle', x: tx, y: ty, r: 9, what: 'tree' });
  }

  const peeSpots = solids.filter(
    (s): s is Circle => s.shape === 'circle' && ['lamp', 'tree', 'hydrant', 'bin', 'bollard'].includes(s.what),
  );

  return { lots, stops: stopLots, solids, peeSpots, benches, crossings, windows: [], park, width };
}

// ---- Static layer --------------------------------------------------------------

export function drawStatic(c: CanvasRenderingContext2D, w: World) {
  w.windows.length = 0;
  drawGround(c, w);
  for (const l of w.lots) {
    if (l.type === 'house') drawHouse(c, w, l);
    else if (l.type === 'shop') drawShop(c, w, l);
    else drawPark(c, l);
  }
  for (const s of w.solids) drawSolidBase(c, s);
}

function drawGround(c: CanvasRenderingContext2D, w: World) {
  const rand = rng(7);
  // Sidewalk: Barcelona panot tiles, the four-circle pattern.
  c.fillStyle = '#e4dbca';
  c.fillRect(0, FACADE, w.width, CURB - FACADE);
  c.strokeStyle = '#d3c8b2';
  c.lineWidth = 1;
  c.beginPath();
  for (let tx = 0; tx < w.width; tx += 22) {
    c.moveTo(tx, FACADE);
    c.lineTo(tx, CURB);
  }
  for (let ty = FACADE; ty < CURB; ty += 22) {
    c.moveTo(0, ty);
    c.lineTo(w.width, ty);
  }
  c.stroke();
  c.fillStyle = '#d7ccb5';
  for (let tx = 0; tx < w.width; tx += 22) {
    for (let ty = FACADE; ty < CURB - 11; ty += 22) {
      for (const [ox, oy] of [[6, 6], [16, 6], [6, 16], [16, 16]]) {
        c.beginPath();
        c.arc(tx + ox, ty + oy, 2.6, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  // Curb
  c.fillStyle = '#c4baa6';
  c.fillRect(0, CURB - 4, w.width, 6);
  c.fillStyle = 'rgba(0,0,0,0.12)';
  c.fillRect(0, CURB + 2, w.width, 2);
  // Bike lane
  c.fillStyle = '#3f6e5a';
  c.fillRect(0, LANE_TOP, w.width, LANE_BOT - LANE_TOP);
  c.fillStyle = '#e8e4da';
  c.fillRect(0, LANE_TOP + 1, w.width, 1.5);
  for (let tx = 0; tx < w.width; tx += 30) c.fillRect(tx, LANE - 0.75, 14, 1.5);
  for (let tx = 90; tx < w.width; tx += 260) bikeIcon(c, tx, LANE - 11, 1);
  for (let tx = 220; tx < w.width; tx += 260) bikeIcon(c, tx, LANE + 11, -1);
  // Road, with a little grain
  c.fillStyle = '#4a4f5c';
  c.fillRect(0, ROAD_TOP, w.width, WH - ROAD_TOP);
  c.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < w.width / 3; i++) c.fillRect(rand() * w.width, ROAD_TOP + rand() * (WH - ROAD_TOP), 1.5, 1.5);
  c.fillStyle = '#e8e4da';
  for (let tx = 0; tx < w.width; tx += 60) c.fillRect(tx, (CAR_LANES.east + CAR_LANES.west) / 2 - 1, 30, 2);
  // Manholes
  for (let mx = 340; mx < w.width; mx += 520) {
    c.fillStyle = '#3c404b';
    c.beginPath();
    c.arc(mx, CAR_LANES.west + 6, 9, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#5a5f6b';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(mx, CAR_LANES.west + 6, 6, 0, Math.PI * 2);
    c.stroke();
  }
  // Zebra crossings over the bike lane and the road
  for (const zx of w.crossings) {
    c.fillStyle = 'rgba(244, 241, 234, 0.92)';
    for (let k = 0; k < 8; k++) c.fillRect(zx, LANE_TOP + 4 + k * 15, 56, 8);
  }
}

function bikeIcon(c: CanvasRenderingContext2D, bx: number, by: number, dir: number) {
  c.strokeStyle = 'rgba(255,255,255,0.6)';
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(bx - 7, by, 4.5, 0, Math.PI * 2);
  c.moveTo(bx + 11.5, by);
  c.arc(bx + 7, by, 4.5, 0, Math.PI * 2);
  c.moveTo(bx - 7, by);
  c.lineTo(bx, by - 5);
  c.lineTo(bx + 7, by);
  c.stroke();
  c.beginPath();
  c.moveTo(bx + 18 * dir, by);
  c.lineTo(bx + 26 * dir, by);
  c.lineTo(bx + 23 * dir, by - 3);
  c.moveTo(bx + 26 * dir, by);
  c.lineTo(bx + 23 * dir, by + 3);
  c.stroke();
}

function shade(c: CanvasRenderingContext2D, x: number, w: number) {
  c.fillStyle = 'rgba(0,0,0,0.07)';
  c.fillRect(x, 0, 3, FACADE);
  // The buildings' shadow on the sidewalk.
  c.fillStyle = 'rgba(40, 30, 20, 0.08)';
  c.fillRect(x, FACADE, w, 6);
}

function drawHouse(c: CanvasRenderingContext2D, w: World, l: Extract<Lot, { type: 'house' }>) {
  c.fillStyle = HOUSE_TONES[l.tone];
  c.fillRect(l.x, 0, l.w, FACADE);
  // Cornice
  c.fillStyle = 'rgba(255,255,255,0.25)';
  c.fillRect(l.x, 4, l.w, 3);
  const cols = Math.max(2, Math.round(l.w / 48));
  const gap = l.w / cols;
  for (let f = 0; f < 2; f++) {
    for (let i = 0; i < cols; i++) {
      const wx = l.x + gap * i + gap / 2 - 9, wy = 16 + f * 44;
      c.fillStyle = '#3b4560';
      c.fillRect(wx, wy, 18, 26);
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.fillRect(wx + 2, wy + 2, 6, 22);
      w.windows.push({ x: wx, y: wy, w: 18, h: 26 });
      // Shutters and a wrought-iron balcony
      c.fillStyle = '#6f8a6a';
      c.fillRect(wx - 5, wy, 4, 26);
      c.fillRect(wx + 19, wy, 4, 26);
      c.fillStyle = '#2a2f3d';
      c.fillRect(wx - 6, wy + 24, 30, 3);
      for (let k = 0; k < 6; k++) c.fillRect(wx - 5 + k * 5.6, wy + 17, 1.3, 8);
      c.fillRect(wx - 6, wy + 16, 30, 1.3);
    }
  }
  c.fillStyle = '#6b5a48';
  c.fillRect(l.x + l.w / 2 - 12, FACADE - 28, 24, 28);
  c.fillStyle = '#d8c79c';
  c.fillRect(l.x + l.w / 2 + 6, FACADE - 14, 2, 2);
  shade(c, l.x, l.w);
}

function drawShop(c: CanvasRenderingContext2D, w: World, l: Extract<Lot, { type: 'shop' }>) {
  const s = l.stop;
  const accent = s.color === '#0b0b0b' ? '#5eea8c' : s.color;
  c.fillStyle = '#efe6d3';
  c.fillRect(l.x, 0, l.w, FACADE);
  c.fillStyle = 'rgba(255,255,255,0.25)';
  c.fillRect(l.x, 4, l.w, 3);
  for (let i = 0; i < 3; i++) {
    const wx = l.x + 30 + i * 52;
    c.fillStyle = '#3b4560';
    c.fillRect(wx, 12, 18, 24);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fillRect(wx + 2, 14, 6, 20);
    w.windows.push({ x: wx, y: 12, w: 18, h: 24 });
  }
  // Shop front, sign and awning
  c.fillStyle = s.color;
  c.fillRect(l.x + 8, 46, l.w - 16, FACADE - 46);
  c.fillStyle = '#f4f1ea';
  c.beginPath();
  c.roundRect(l.x + 16, 54, l.w - 32, 30, 5);
  c.fill();
  c.fillStyle = '#0b1430';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `800 ${s.label.length > 14 ? 11 : 14}px ${FONT}`;
  c.fillText(s.label, l.x + l.w / 2, 64, l.w - 40);
  c.fillStyle = '#3a4a75';
  c.font = `600 8px ${BODY}`;
  c.fillText(s.kind.toUpperCase(), l.x + l.w / 2, 77, l.w - 40);
  const aw = l.w - 8;
  for (let i = 0; i < 8; i++) {
    c.fillStyle = i % 2 ? '#f4f1ea' : accent;
    c.fillRect(l.x + 4 + (aw / 8) * i, 38, aw / 8, 9);
  }
  c.fillStyle = 'rgba(0,0,0,0.15)';
  c.fillRect(l.x + 4, 47, aw, 2);
  // Display windows with something in them
  for (const wx of [l.x + 18, l.x + l.w / 2 + 16]) {
    const ww = l.w / 2 - 34;
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.fillRect(wx, 90, ww, 24);
    w.windows.push({ x: wx, y: 90, w: ww, h: 24 });
    c.fillStyle = accent;
    c.globalAlpha = 0.55;
    for (let k = 0; k < 3; k++) c.fillRect(wx + 6 + k * (ww / 3), 102, ww / 3 - 10, 10);
    c.globalAlpha = 1;
  }
  c.fillStyle = '#2a2f3d';
  c.fillRect(l.x + l.w / 2 - 11, 88, 22, FACADE - 88);
  // Doormat
  c.fillStyle = 'rgba(60, 40, 30, 0.35)';
  c.fillRect(l.x + l.w / 2 - 16, FACADE + 1, 32, 7);
  shade(c, l.x, l.w);
}

function drawPark(c: CanvasRenderingContext2D, l: Extract<Lot, { type: 'park' }>) {
  const rand = rng(3);
  c.fillStyle = '#7fb55e';
  c.fillRect(l.x, 0, l.w, CURB);
  c.fillStyle = 'rgba(255,255,255,0.13)';
  for (let i = 0; i < 70; i++) c.fillRect(l.x + rand() * l.w, rand() * CURB, 2.5, 2.5);
  c.fillStyle = 'rgba(40, 90, 40, 0.25)';
  for (let i = 0; i < 40; i++) c.fillRect(l.x + rand() * l.w, rand() * CURB, 2, 4);
  // Gravel path
  c.fillStyle = '#d8c9a8';
  c.beginPath();
  c.roundRect(l.x, 148, l.w - 30, 36, 18);
  c.fill();
  // Railings and a gate
  c.fillStyle = '#2a2f3d';
  for (let ry = 0; ry < 140; ry += 8) c.fillRect(l.x, ry, 3, 5);
  for (let ry = 192; ry < CURB; ry += 8) c.fillRect(l.x, ry, 3, 5);
  c.fillStyle = '#f4f1ea';
  c.beginPath();
  c.roundRect(l.x + 20, 92, 120, 36, 6);
  c.fill();
  c.fillStyle = '#0b1430';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `800 13px ${FONT}`;
  c.fillText('The park', l.x + 80, 104);
  c.font = `600 8px ${BODY}`;
  c.fillText('OFF-LEASH AREA SOON', l.x + 80, 117);
}

function shadow(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  c.fillStyle = 'rgba(30, 20, 10, 0.2)';
  c.beginPath();
  c.ellipse(x + 3, y + 3, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

function drawSolidBase(c: CanvasRenderingContext2D, s: Solid) {
  if (s.shape === 'box') {
    c.fillStyle = 'rgba(30, 20, 10, 0.2)';
    c.fillRect(s.x + 3, s.y + 3, s.w, s.h);
    if (s.what === 'bench') {
      c.fillStyle = '#8a5a3c';
      for (let k = 0; k < 3; k++) c.fillRect(s.x, s.y + k * 4, s.w, 3);
      c.fillStyle = '#2a2f3d';
      c.fillRect(s.x + 3, s.y - 1, 3, s.h + 2);
      c.fillRect(s.x + s.w - 6, s.y - 1, 3, s.h + 2);
    } else {
      c.fillStyle = '#b0674a';
      c.fillRect(s.x, s.y, s.w, s.h);
      c.fillStyle = '#5f9e4a';
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        c.arc(s.x + 4 + k * 6, s.y + 4, 4, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#e5487a';
      c.beginPath();
      c.arc(s.x + 10, s.y + 3, 2, 0, Math.PI * 2);
      c.arc(s.x + 19, s.y + 5, 2, 0, Math.PI * 2);
      c.fill();
    }
    return;
  }
  shadow(c, s.x, s.y, s.r + 1, s.r);
  switch (s.what) {
    case 'lamp':
      c.fillStyle = '#2a2f3d';
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      c.fill();
      break;
    case 'tree':
      c.fillStyle = '#8a7a5e';
      c.fillRect(s.x - 11, s.y - 11, 22, 22);
      c.fillStyle = '#6b4a32';
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      c.fill();
      break;
    case 'hydrant':
      c.fillStyle = '#d9403a';
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffb3a8';
      c.beginPath();
      c.arc(s.x - 1, s.y - 1, 2, 0, Math.PI * 2);
      c.fill();
      break;
    case 'bin':
      c.fillStyle = '#5c6473';
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#2a2f3d';
      c.beginPath();
      c.arc(s.x, s.y, s.r - 2.5, 0, Math.PI * 2);
      c.fill();
      break;
    case 'bollard':
      c.fillStyle = '#3b4560';
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      c.fill();
      break;
    case 'table':
      c.fillStyle = '#c9c2b4';
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#6b5a48';
      for (const [ox, oy] of [[-13, 0], [13, 0]]) c.fillRect(s.x + ox - 4, s.y + oy - 4, 8, 8);
      break;
  }
}

// ---- Things above the characters -------------------------------------------------

export function drawTops(c: CanvasRenderingContext2D, w: World, x0: number, x1: number, night: boolean) {
  for (const s of w.solids) {
    if (s.shape !== 'circle' || s.x < x0 - 40 || s.x > x1 + 40) continue;
    if (s.what === 'tree') {
      c.fillStyle = 'rgba(30, 60, 30, 0.18)';
      c.beginPath();
      c.arc(s.x + 4, s.y - 2, 24, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(78, 140, 64, 0.88)';
      c.beginPath();
      c.arc(s.x - 5, s.y - 8, 21, 0, Math.PI * 2);
      c.arc(s.x + 11, s.y - 3, 16, 0, Math.PI * 2);
      c.arc(s.x - 2, s.y + 6, 14, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(140, 200, 100, 0.35)';
      c.beginPath();
      c.arc(s.x - 9, s.y - 13, 9, 0, Math.PI * 2);
      c.fill();
    } else if (s.what === 'lamp') {
      c.strokeStyle = '#2a2f3d';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(s.x, s.y);
      c.lineTo(s.x, s.y - 16);
      c.stroke();
      c.fillStyle = night ? '#ffe3a0' : '#3b4560';
      c.beginPath();
      c.ellipse(s.x, s.y - 18, 7, 4.5, 0, 0, Math.PI * 2);
      c.fill();
    } else if (s.what === 'table') {
      // A striped parasol
      for (let k = 0; k < 8; k++) {
        c.fillStyle = k % 2 ? '#f4f1ea' : '#8bcb3c';
        c.beginPath();
        c.moveTo(s.x, s.y - 4);
        c.arc(s.x, s.y - 4, 22, (k * Math.PI) / 4, ((k + 1) * Math.PI) / 4);
        c.fill();
      }
    }
  }
}

export function drawNightLights(c: CanvasRenderingContext2D, w: World, x0: number, x1: number) {
  c.fillStyle = 'rgba(255, 214, 130, 0.85)';
  for (const win of w.windows) {
    if (win.x + win.w < x0 || win.x > x1) continue;
    c.fillRect(win.x, win.y, win.w, win.h);
  }
  c.globalCompositeOperation = 'lighter';
  for (const s of w.solids) {
    if (s.shape !== 'circle' || s.what !== 'lamp' || s.x < x0 - 80 || s.x > x1 + 80) continue;
    const g = c.createRadialGradient(s.x, s.y - 18, 2, s.x, s.y - 18, 80);
    g.addColorStop(0, 'rgba(255, 200, 110, 0.38)');
    g.addColorStop(1, 'rgba(255, 200, 110, 0)');
    c.fillStyle = g;
    c.fillRect(s.x - 80, s.y - 98, 160, 160);
  }
  c.globalCompositeOperation = 'source-over';
}
