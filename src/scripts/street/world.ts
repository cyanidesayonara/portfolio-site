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
  | { type: 'station'; x: number; w: number; stop: Stop }
  | { type: 'park'; x: number; w: number; stop: Stop }
  | { type: 'metro'; x: number; w: number; y: number; h: number; stop: Stop }
  | { type: 'house'; x: number; w: number; tone: number };
export type StopLot = Extract<Lot, { stop: Stop }>;

export type Circle = {
  shape: 'circle';
  x: number;
  y: number;
  r: number;
  what: 'lamp' | 'tree' | 'hydrant' | 'bin' | 'bollard' | 'table' | 'fountain';
  marked?: boolean;
  color?: string;
};
export type Box = { shape: 'box'; x: number; y: number; w: number; h: number; what: 'bench' | 'planter' | 'railing' };
export type Solid = Circle | Box;

export type World = {
  lots: Lot[];
  stops: StopLot[];
  solids: Solid[];
  peeSpots: Circle[];
  benches: Box[];
  farBenches: Box[];
  crossings: number[];
  windows: { x: number; y: number; w: number; h: number; shop?: boolean }[];
  bones: { x: number; y: number }[];
  drinks: { x: number; y: number; kind: 'bowl' | 'fountain' }[];
  croissant: { x: number; y: number };
  alleyCat: { x: number; y: number };
  park: StopLot;
  metro: Extract<Lot, { type: 'metro' }> | null;
  width: number;
};

export const WH = 440;
export const FACADE = 120;
export const WALK_TOP = 126;
export const CURB = 214;
export const LANE_TOP = 218;
export const LANE_BOT = 262;
export const LANE = 240;
export const ROAD_TOP = 262;
export const CAR_LANES = { east: 320, west: 284 };
// The far side of the road: a curb, a second sidewalk with the metro
// entrance, and the edge of the next block (seen from above) along the bottom.
export const ROAD_BOT = 342;
export const FAR_CURB = 348;
export const FAR_EDGE = 418;

const HOUSE_TONES = ['#e3d3b4', '#d8b98f', '#cf8f6c', '#b9c3c9', '#e8dcc6'];
const FONT = "'Bricolage Grotesque Variable', 'Bricolage Grotesque', system-ui, sans-serif";
const BODY = "'Inter Variable', 'Inter', system-ui, sans-serif";

export const doorX = (l: StopLot) => (l.type === 'park' ? l.x + 70 : l.type === 'metro' ? l.x - 14 : l.x + l.w / 2);
export const doorY = (l: StopLot) => (l.type === 'park' ? 138 : l.type === 'metro' ? l.y + l.h / 2 : WALK_TOP + 10);

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
  const metroStop = stops.find((s) => s.id === 'metro');
  stops.forEach((stop, i) => {
    if (stop.id === 'metro') return;
    if (stop.id === 'park') {
      house(130);
      lots.push({ type: 'park', x, w: 320, stop });
      x += 320;
      return;
    }
    if (stop.id === 'station') {
      lots.push({ type: 'station', x, w: 220, stop });
      x += 220;
      return;
    }
    lots.push({ type: 'shop', x, w: 190, stop });
    x += 190;
    if (i % 2 === 1) house(130);
  });
  const width = x;
  // The metro entrance: across the road from the train station, stairs going
  // down toward +x from a head at its west end.
  const stationLot = lots.find((l) => l.type === 'station');
  let metro: Extract<Lot, { type: 'metro' }> | null = null;
  if (metroStop && stationLot) {
    metro = { type: 'metro', x: stationLot.x + stationLot.w / 2 - 36, w: 92, y: 360, h: 30, stop: metroStop };
    lots.push(metro);
  }
  const stopLots = lots.filter((l): l is StopLot => l.type !== 'house');
  const park = stopLots.find((l) => l.type === 'park')!;
  const shops = stopLots.filter((l) => l.type === 'shop');

  const solids: Solid[] = [];
  const crossings = [600, 1480, 2120].filter((c) => c < park.x - 80);
  const nearCrossing = (px: number) => crossings.some((c) => px > c - 40 && px < c + 100);

  // The curb line: lampposts and trees, with bins and hydrants between.
  for (let px = 110, i = 0; px < park.x - 40; px += 170, i++) {
    if (nearCrossing(px)) continue;
    solids.push(i % 3 === 1 ? { shape: 'circle', x: px, y: 194, r: 7, what: 'tree' } : { shape: 'circle', x: px, y: 202, r: 4.5, what: 'lamp' });
    if (i % 4 === 2) solids.push({ shape: 'circle', x: px + 70, y: 200, r: 5, what: 'hydrant' });
    else if (i % 4 === 0) solids.push({ shape: 'circle', x: px + 80, y: 198, r: 6, what: 'bin' });
  }
  for (const c of crossings) {
    for (const bx of [c - 14, c + 70]) {
      solids.push({ shape: 'circle', x: bx, y: 208, r: 3.5, what: 'bollard' });
      solids.push({ shape: 'circle', x: bx, y: 352, r: 3.5, what: 'bollard' });
    }
  }
  const nearSouthObs = (px: number, pad = 42) =>
    crossings.some((c) => px > c - pad && px < c + 56 + pad) ||
    (metro !== null && px > metro.x - 56 && px < metro.x + metro.w + 40);
  // The far curb: lamps, trees, hydrants, and bins kept clear of crossings and metro.
  for (let px = 195, i = 0; px < width - 40; px += 170, i++) {
    if (!nearCrossing(px) && !(metro && px > metro.x - 50 && px < metro.x + metro.w + 30)) {
      solids.push(i % 2 === 0 ? { shape: 'circle', x: px, y: 362, r: 4.5, what: 'lamp' } : { shape: 'circle', x: px, y: 366, r: 7, what: 'tree' });
    }
    const sx = px + 82;
    if (sx < width - 50 && !nearSouthObs(sx, 36) && i % 3 !== 1) {
      solids.push({ shape: 'circle', x: sx, y: 359, r: i % 3 === 0 ? 5 : 6, what: i % 3 === 0 ? 'hydrant' : 'bin' });
    }
  }
  if (metro) {
    // Railings around three sides of the stairwell; the west end is open.
    solids.push(
      { shape: 'box', x: metro.x, y: metro.y - 4, w: metro.w + 4, h: 4, what: 'railing' },
      { shape: 'box', x: metro.x, y: metro.y + metro.h, w: metro.w + 4, h: 4, what: 'railing' },
      { shape: 'box', x: metro.x + metro.w, y: metro.y, w: 4, h: metro.h, what: 'railing' },
      // The stairs themselves: she waits at the top while the cutscene takes her down.
      { shape: 'box', x: metro.x + 4, y: metro.y, w: metro.w - 4, h: metro.h, what: 'railing' },
    );
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

  // South sidewalk benches, planters, terrace parasols, croissant & alley cat spot.
  const farBenches: Box[] = [];
  for (const bx of [315, 735, 1135, 1745]) {
    if (bx + 60 < width && !nearSouthObs(bx + 24, 48)) {
      farBenches.push({ shape: 'box', x: bx, y: 398, w: 48, h: 12, what: 'bench' });
    }
  }
  solids.push(...farBenches);
  for (const px of [275, 920, 1345, 1815]) {
    if (px + 30 < width && !nearSouthObs(px + 13, 36)) {
      solids.push({ shape: 'box', x: px, y: 403, w: 26, h: 12, what: 'planter' });
    }
  }
  const southTerraces: [number, string][] = [
    [420, '#e5487a'],
    [466, '#ffb020'],
    [1232, '#1fc9b7'],
    [1278, '#ffb020'],
  ];
  for (const [tx, color] of southTerraces) {
    if (!nearSouthObs(tx, 34)) solids.push({ shape: 'circle', x: tx, y: 386, r: 8, what: 'table', color });
  }
  const croissant = { x: 820, y: 398 };
  const alleyCat = { x: 1085, y: 404 };

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

  // Bones to find: along the shopfronts, one in the road, two on the south side, one in the park.
  const bones: { x: number; y: number }[] = [];
  for (let bx = 250; bx < park.x - 60; bx += 340) bones.push({ x: bx, y: 141 });
  bones.push({ x: crossings[0] + 160, y: 300 }, { x: 505, y: 392 }, { x: 1350, y: 392 }, { x: park.x + 120, y: 70 });

  // Somewhere to drink: bowls outside About, Blog, and the south-side bakery, plus the park fountain.
  const drinks: { x: number; y: number; kind: 'bowl' | 'fountain' }[] = [];
  for (const id of ['about', 'blog']) {
    const l = shops.find((x) => x.stop.id === id);
    if (l) drinks.push({ x: l.x + l.w / 2 + 30, y: 133, kind: 'bowl' });
  }
  drinks.push({ x: 872, y: 407, kind: 'bowl' });
  drinks.push({ x: park.x + 70, y: 196, kind: 'fountain' });
  solids.push({ shape: 'circle', x: park.x + 70, y: 196, r: 6, what: 'fountain' });

  return {
    lots, stops: stopLots, solids, peeSpots, benches, farBenches, crossings,
    windows: [], bones, drinks, croissant, alleyCat, park, metro, width,
  };
}

// ---- Static layer --------------------------------------------------------------

export function drawStatic(c: CanvasRenderingContext2D, w: World) {
  w.windows.length = 0;
  drawGround(c, w);
  for (const l of w.lots) {
    if (l.type === 'house') drawHouse(c, w, l);
    else if (l.type === 'shop') drawShop(c, w, l);
    else if (l.type === 'station') drawStation(c, w, l);
    else if (l.type === 'metro') drawMetro(c, l);
    else drawPark(c, l);
  }
  for (const s of w.solids) drawSolidBase(c, s);
  for (const d of w.drinks) {
    if (d.kind !== 'bowl') continue;
    c.fillStyle = 'rgba(30, 20, 10, 0.2)';
    c.beginPath();
    c.ellipse(d.x + 2, d.y + 2, 7, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e5487a';
    c.beginPath();
    c.ellipse(d.x, d.y, 7, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#6ec6e8';
    c.beginPath();
    c.ellipse(d.x, d.y, 4.6, 3, 0, 0, Math.PI * 2);
    c.fill();
  }
}

function drawGround(c: CanvasRenderingContext2D, w: World) {
  const rand = rng(7);
  // Sidewalk: Barcelona panots, the four-tablet pattern.
  fillPanots(c, 0, FACADE, w.width, CURB, rand);
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
  // Lane symbols, nudged clear of the zebra crossings painted over the lane.
  const clearOfCrossings = (tx: number) => {
    for (const zx of w.crossings) if (tx + 30 > zx - 8 && tx - 14 < zx + 64) return zx + 64 + 18;
    return tx;
  };
  for (let tx = 90; tx < w.width; tx += 260) bikeIcon(c, clearOfCrossings(tx), LANE - 11, 1);
  for (let tx = 220; tx < w.width; tx += 260) bikeIcon(c, clearOfCrossings(tx), LANE + 11, -1);
  // Road, with a little grain
  c.fillStyle = '#4a4f5c';
  c.fillRect(0, ROAD_TOP, w.width, ROAD_BOT - ROAD_TOP);
  c.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < w.width / 3; i++) c.fillRect(rand() * w.width, ROAD_TOP + rand() * (ROAD_BOT - ROAD_TOP), 1.5, 1.5);
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
  drawFarSide(c, w);
}

// The other side of the road: curb, a second panot sidewalk, and the next
// block's rooftops along the bottom edge.
function drawFarSide(c: CanvasRenderingContext2D, w: World) {
  c.fillStyle = 'rgba(0,0,0,0.12)';
  c.fillRect(0, ROAD_BOT - 2, w.width, 2);
  c.fillStyle = '#c4baa6';
  c.fillRect(0, ROAD_BOT, w.width, FAR_CURB - ROAD_BOT);
  fillPanots(c, 0, FAR_CURB, w.width, FAR_EDGE, rng(11));
  // Peeking storefront awnings & floral crates along the south sidewalk edge.
  const awnings: { x: number; w: number; c: string; label: string }[] = [
    { x: 392, w: 112, c: '#e5487a', label: 'GELATERIA' },
    { x: 785, w: 108, c: '#ffb020', label: 'FORN' },
    { x: 1045, w: 86, c: '#8bcb3c', label: 'FLORS' },
    { x: 1205, w: 110, c: '#1fc9b7', label: 'BAR' },
  ];
  for (const aw of awnings) {
    if (aw.x + aw.w >= w.width) continue;
    for (let k = 0; k < 8; k++) {
      c.fillStyle = k % 2 ? '#f4f1ea' : aw.c;
      c.fillRect(aw.x + (aw.w / 8) * k, FAR_EDGE - 7, aw.w / 8, 7);
    }
    c.fillStyle = '#0b1430';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `800 6.5px ${FONT}`;
    c.fillText(aw.label, aw.x + aw.w / 2, FAR_EDGE - 3.5);
  }
  // Floral crates outside Flors
  for (const fx of [1052, 1098]) {
    c.fillStyle = '#8a5a3c';
    c.fillRect(fx, FAR_EDGE - 12, 18, 5);
    c.fillStyle = '#e5487a';
    c.fillRect(fx + 2, FAR_EDGE - 11, 4, 3);
    c.fillStyle = '#ffb020';
    c.fillRect(fx + 8, FAR_EDGE - 11, 4, 3);
    c.fillStyle = '#8bcb3c';
    c.fillRect(fx + 13, FAR_EDGE - 11, 3, 3);
  }
  // The next block, seen from above: terracotta roofs with skylights, chimneys & greenery.
  const rand = rng(11);
  const roofs = ['#b2563a', '#a87561', '#c2997a', '#9a8a78', '#b88566'];
  const laundryCols = ['#f4f1ea', '#ffb020', '#1fc9b7', '#e5487a'];
  for (let x = 0, i = 0; x < w.width; i++) {
    const bw = 110 + Math.floor(rand() * 90);
    c.fillStyle = roofs[i % roofs.length];
    c.fillRect(x, FAR_EDGE, bw, WH - FAR_EDGE);
    c.fillStyle = 'rgba(0,0,0,0.08)';
    for (let ty = FAR_EDGE + 8; ty < WH; ty += 6) c.fillRect(x, ty, bw, 1.5);
    c.fillStyle = '#e9ddc2';
    c.fillRect(x, FAR_EDGE, bw, 3);
    // Rooftop details: skylight, chimney pot, AC unit, or potted plant + washing line.
    if (i % 3 === 0 && bw > 120) {
      c.fillStyle = '#6ec6e8';
      c.fillRect(x + 24, FAR_EDGE + 7, 20, 10);
      c.strokeStyle = '#e9ddc2';
      c.lineWidth = 1;
      c.strokeRect(x + 24, FAR_EDGE + 7, 20, 10);
    } else if (i % 3 === 1) {
      c.fillStyle = '#b0674a';
      c.fillRect(x + bw - 34, FAR_EDGE + 6, 10, 9);
      c.fillStyle = '#5f9e4a';
      c.beginPath();
      c.arc(x + 20, FAR_EDGE + 11, 5, 0, Math.PI * 2);
      c.fill();
    } else {
      c.fillStyle = '#d4d8df';
      c.fillRect(x + 18, FAR_EDGE + 8, 12, 8);
      c.fillStyle = '#6d7484';
      c.beginPath();
      c.arc(x + 24, FAR_EDGE + 12, 3, 0, Math.PI * 2);
      c.fill();
    }
    if (i % 2 === 1 && bw > 125) {
      c.strokeStyle = 'rgba(244, 241, 234, 0.7)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(x + 52, FAR_EDGE + 7);
      c.quadraticCurveTo(x + 76, FAR_EDGE + 14, x + 100, FAR_EDGE + 7);
      c.stroke();
      for (let l = 0; l < 4; l++) {
        c.fillStyle = laundryCols[(i + l) % laundryCols.length];
        c.fillRect(x + 58 + l * 10, FAR_EDGE + 8 + (l === 1 || l === 2 ? 2 : 0), 6, 6);
      }
    }
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.fillRect(x + bw - 2, FAR_EDGE, 2, WH - FAR_EDGE);
    x += bw;
  }
  c.fillStyle = 'rgba(40, 30, 20, 0.1)';
  c.fillRect(0, FAR_EDGE - 5, w.width, 5);
}

// The metro entrance, seen from above: an open stairwell going down toward
// +x, railings on three sides, and a sign plate. Like the 3D walk, it never
// names the real station; it just says Metro.
function drawMetro(c: CanvasRenderingContext2D, l: Extract<Lot, { type: 'metro' }>) {
  const { x, y, w, h } = l;
  // Granite surround
  c.fillStyle = '#b9b4aa';
  c.fillRect(x - 6, y - 8, w + 14, h + 16);
  // The steps get darker as they go down, to a lit landing at the bottom.
  const steps = 14;
  const run = (w - 18) / steps;
  for (let i = 0; i < steps; i++) {
    const v = Math.round(206 - (i / (steps - 1)) * 150);
    c.fillStyle = `rgb(${v}, ${v - 2}, ${v - 8})`;
    c.fillRect(x + i * run, y, run + 0.5, h);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(x + (i + 1) * run - 1.2, y, 1.2, h);
  }
  const land = c.createLinearGradient(x + w - 18, 0, x + w, 0);
  land.addColorStop(0, '#2b2a30');
  land.addColorStop(1, '#5d5866');
  c.fillStyle = land;
  c.fillRect(x + w - 18, y, 18, h);
  c.fillStyle = 'rgba(255, 236, 190, 0.55)';
  c.fillRect(x + w - 5, y + 6, 4, h - 12);
  // Handrails down both walls
  c.fillStyle = '#d9dde3';
  c.fillRect(x, y + 2, w - 18, 1.6);
  c.fillRect(x, y + h - 3.6, w - 18, 1.6);
  // Stainless railings with glass panels
  c.fillStyle = 'rgba(170, 210, 230, 0.35)';
  c.fillRect(x, y - 5, w + 4, 4);
  c.fillRect(x, y + h + 1, w + 4, 4);
  c.fillRect(x + w, y - 5, 4, h + 10);
  c.fillStyle = '#8d949e';
  c.fillRect(x, y - 5, w + 4, 1.3);
  c.fillRect(x, y + h + 3.7, w + 4, 1.3);
  c.fillRect(x + w + 2.7, y - 5, 1.3, h + 10);
  for (let px = x; px <= x + w + 2; px += 18) {
    c.fillRect(px, y - 5.5, 2.4, 2.4);
    c.fillRect(px, y + h + 3, 2.4, 2.4);
  }
  // A tactile strip at the head of the stairs
  c.fillStyle = '#e6c23a';
  c.fillRect(x - 6, y, 4, h);
  // The totem's base beside the head (its sign is drawn above the characters).
  const tx = x - 26, ty = y - 4;
  c.fillStyle = 'rgba(30, 20, 10, 0.2)';
  c.beginPath();
  c.ellipse(tx + 3, ty + 3, 6, 4, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#5c6473';
  c.beginPath();
  c.arc(tx, ty, 3.5, 0, Math.PI * 2);
  c.fill();
  // A sign plate on the sidewalk side, like the station's nameplate.
  const sx = x + 6, sy = y + h + 9, sw = w - 12;
  c.fillStyle = '#14203d';
  c.beginPath();
  c.roundRect(sx, sy, sw, 14, 3);
  c.fill();
  c.fillStyle = '#9b2d8f';
  c.beginPath();
  c.roundRect(sx + 3, sy + 2.5, 15, 9, 2);
  c.fill();
  c.fillStyle = '#f4f1ea';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `800 6.5px ${FONT}`;
  c.fillText('L2', sx + 10.5, sy + 7.3);
  c.textAlign = 'left';
  c.font = `700 6.5px ${BODY}`;
  c.fillText('METRO TO 3D SEAFRONT', sx + 22, sy + 7.5, sw - 26);
}

/** The metro totem's sign, drawn above the characters like the lamp heads. */
export function drawMetroTop(c: CanvasRenderingContext2D, l: Extract<Lot, { type: 'metro' }>) {
  const tx = l.x - 26, ty = l.y - 4;
  c.strokeStyle = '#5c6473';
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(tx, ty);
  c.lineTo(tx, ty - 22);
  c.stroke();
  c.save();
  c.translate(tx, ty - 30);
  c.rotate(Math.PI / 4);
  c.fillStyle = '#d52b1e';
  c.fillRect(-8, -8, 16, 16);
  c.restore();
  c.fillStyle = '#f4f1ea';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `900 11px ${FONT}`;
  c.fillText('M', tx, ty - 29.5);
  c.fillStyle = '#9b2d8f';
  c.beginPath();
  c.roundRect(tx + 9, ty - 35, 16, 10, 2);
  c.fill();
  c.fillStyle = '#f4f1ea';
  c.font = `800 7px ${FONT}`;
  c.fillText('L2', tx + 17, ty - 29.6);
}

// ---- Panots ------------------------------------------------------------------------------
// The classic Barcelona sidewalk tile: a square with four raised round tablets.
// One tile is drawn once at 4x and repeated as a pattern, so the sidewalk costs a
// single fill, then a few worn tiles are toned by hand.
const PANOT = 16;
const PANOT_RES = 4;
let panotTile: HTMLCanvasElement | null = null;
function panotCanvas() {
  if (panotTile) return panotTile;
  const t = document.createElement('canvas');
  t.width = t.height = PANOT * PANOT_RES;
  const g = t.getContext('2d')!;
  g.scale(PANOT_RES, PANOT_RES);
  g.fillStyle = '#e3d9c6';
  g.fillRect(0, 0, PANOT, PANOT);
  // Grout along two edges (the neighbours supply the other two).
  g.fillStyle = '#cbbfa7';
  g.fillRect(0, PANOT - 0.6, PANOT, 0.6);
  g.fillRect(PANOT - 0.6, 0, 0.6, PANOT);
  // A faint bevel on the tile itself.
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(0, 0, PANOT - 0.6, 0.5);
  g.fillRect(0, 0, 0.5, PANOT - 0.6);
  for (const [ox, oy] of [[4, 4], [11.4, 4], [4, 11.4], [11.4, 11.4]]) {
    const r = 2.75;
    g.fillStyle = '#c9bca3'; // shadow under the raised tablet
    g.beginPath(); g.arc(ox + 0.55, oy + 0.6, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f1ebde'; // lit rim
    g.beginPath(); g.arc(ox - 0.35, oy - 0.4, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#dcd1bc'; // the tablet's face
    g.beginPath(); g.arc(ox, oy, r - 0.35, 0, Math.PI * 2); g.fill();
  }
  panotTile = t;
  return t;
}

function fillPanots(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, rand: () => number) {
  const pat = c.createPattern(panotCanvas(), 'repeat');
  c.save();
  if (pat) {
    pat.setTransform(new DOMMatrix().translate(0, y0).scale(1 / PANOT_RES));
    c.fillStyle = pat;
  } else c.fillStyle = '#e3d9c6';
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Wear: the odd tile a shade darker or lighter, like a street patched over the years.
  for (let tx = x0; tx < x1; tx += PANOT) {
    for (let ty = y0; ty < y1 - PANOT / 2; ty += PANOT) {
      const k = rand();
      if (k < 0.06) { c.fillStyle = 'rgba(90, 70, 40, 0.07)'; c.fillRect(tx, ty, PANOT - 0.6, PANOT - 0.6); }
      else if (k > 0.965) { c.fillStyle = 'rgba(255, 255, 255, 0.16)'; c.fillRect(tx, ty, PANOT - 0.6, PANOT - 0.6); }
    }
  }
  c.restore();
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
  c.font = `800 ${s.label.length > 14 ? 11 : s.kind ? 14 : 16}px ${FONT}`;
  c.fillText(s.label, l.x + l.w / 2, s.kind ? 64 : 69, l.w - 40);
  if (s.kind) {
    c.fillStyle = '#3a4a75';
    c.font = `600 8px ${BODY}`;
    c.fillText(s.kind.toUpperCase(), l.x + l.w / 2, 77, l.w - 40);
  }
  const aw = l.w - 8;
  for (let i = 0; i < 8; i++) {
    c.fillStyle = i % 2 ? '#f4f1ea' : accent;
    c.fillRect(l.x + 4 + (aw / 8) * i, 38, aw / 8, 9);
  }
  c.fillStyle = 'rgba(0,0,0,0.15)';
  c.fillRect(l.x + 4, 47, aw, 2);
  // Retro dark glass bezels: live 8/16-bit animations draw inside each frame in game.ts.
  for (const wx of [l.x + 18, l.x + l.w / 2 + 16]) {
    const ww = l.w / 2 - 34;
    c.fillStyle = '#14203d';
    c.fillRect(wx - 2, 88, ww + 4, 28);
    c.fillStyle = '#0b1430';
    c.fillRect(wx, 90, ww, 24);
    w.windows.push({ x: wx, y: 90, w: ww, h: 24, shop: true });
  }
  c.fillStyle = '#2a2f3d';
  c.fillRect(l.x + l.w / 2 - 11, 88, 22, FACADE - 88);
  // Doormat
  c.fillStyle = 'rgba(60, 40, 30, 0.35)';
  c.fillRect(l.x + l.w / 2 - 16, FACADE + 1, 32, 7);
  shade(c, l.x, l.w);
}

function drawStation(c: CanvasRenderingContext2D, w: World, l: Extract<Lot, { type: 'station' }>) {
  const cx = l.x + l.w / 2;
  // Commuter train roof & carriage strip visible above the station parapet
  c.fillStyle = '#d7dadf';
  c.fillRect(l.x + 8, 2, l.w - 16, 13);
  c.fillStyle = '#e5302a';
  c.fillRect(l.x + 8, 10, l.w - 16, 4);
  c.fillStyle = '#2a2f3d';
  for (let wx = l.x + 18; wx < l.x + l.w - 26; wx += 22) c.fillRect(wx, 4, 14, 5);

  // Oxblood coastal station body + cream pilasters and cornice
  c.fillStyle = '#8e2f2c';
  c.fillRect(l.x, 14, l.w, FACADE - 14);
  c.fillStyle = '#e9ddc2';
  c.fillRect(l.x, 14, l.w, 4);
  c.beginPath();
  c.moveTo(cx - 48, 14);
  c.lineTo(cx, 1);
  c.lineTo(cx + 48, 14);
  c.closePath();
  c.fill();
  for (let i = 0; i <= 4; i++) {
    const px = l.x + 4 + i * ((l.w - 14) / 4);
    c.fillRect(px, 14, 6, FACADE - 14);
  }
  // Upper arched windows + lower flanking windows (glow in dark mode)
  for (let i = 0; i < 4; i++) {
    const wx = l.x + 18 + i * 50;
    for (const [wy, wh] of [[24, 22], [86, 26]] as const) {
      if (wy > 60 && (i === 1 || i === 2)) continue;
      c.fillStyle = '#e9ddc2';
      c.beginPath();
      c.roundRect(wx - 2, wy - 3, 20, wh + 3, [8, 8, 0, 0]);
      c.fill();
      c.fillStyle = '#3b4560';
      c.beginPath();
      c.roundRect(wx, wy, 16, wh, [6, 6, 0, 0]);
      c.fill();
      w.windows.push({ x: wx, y: wy, w: 16, h: wh });
    }
  }
  // Station nameplate and R1 roundel
  // The roundel gets its own column so the text never runs under it.
  const plateL = cx - 64, plateW = 128;
  const ringX = plateL + 14;
  const textL = ringX + 8.5 + 5, textR = plateL + plateW - 5;
  const textX = (textL + textR) / 2, textW = textR - textL;
  c.fillStyle = '#e5302a';
  c.beginPath();
  c.roundRect(plateL, 52, plateW, 26, 4);
  c.fill();
  c.fillStyle = '#f4f1ea';
  c.beginPath();
  c.arc(ringX, 65, 8.5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#e5302a';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `800 8px ${FONT}`;
  c.fillText('R1', ringX, 65.5);
  c.fillStyle = '#f4f1ea';
  c.font = `800 13px ${FONT}`;
  c.fillText('Estació', textX, 61.5, textW);
  c.font = `700 7px ${BODY}`;
  c.fillText('TRAIN TO 3D SEAFRONT', textX, 71.5, textW);
  // Central arched entrance
  c.fillStyle = '#e9ddc2';
  c.beginPath();
  c.roundRect(cx - 15, 83, 30, FACADE - 83, [12, 12, 0, 0]);
  c.fill();
  c.fillStyle = '#2a2f3d';
  c.beginPath();
  c.roundRect(cx - 11, 86, 22, FACADE - 86, [9, 9, 0, 0]);
  c.fill();
  c.fillStyle = '#d8c79c';
  c.fillRect(cx - 3, 94, 6, 12);
  w.windows.push({ x: cx - 3, y: 94, w: 6, h: 12 });
  // Platform welcome mat
  c.fillStyle = 'rgba(229, 48, 42, 0.32)';
  c.fillRect(cx - 16, FACADE + 1, 32, 7);
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
  c.fillText('OFF-LEASH AREA', l.x + 80, 117);
}

function shadow(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  c.fillStyle = 'rgba(30, 20, 10, 0.2)';
  c.beginPath();
  c.ellipse(x + 3, y + 3, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

function drawSolidBase(c: CanvasRenderingContext2D, s: Solid) {
  if (s.shape === 'box') {
    if (s.what === 'railing') return; // drawn with the metro entrance
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
    case 'fountain':
      // A Barcelona cast-iron drinking fountain, with its puddle.
      c.fillStyle = 'rgba(110, 198, 232, 0.55)';
      c.beginPath();
      c.ellipse(s.x + 4, s.y + 10, 11, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#2f4a3c';
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#c9a74a';
      c.beginPath();
      c.arc(s.x, s.y, 2, 0, Math.PI * 2);
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
        c.fillStyle = k % 2 ? '#f4f1ea' : s.color ?? '#8bcb3c';
        c.beginPath();
        c.moveTo(s.x, s.y - 4);
        c.arc(s.x, s.y - 4, 22, (k * Math.PI) / 4, ((k + 1) * Math.PI) / 4);
        c.fill();
      }
    }
  }
}

export function drawNightLights(c: CanvasRenderingContext2D, w: World, x0: number, x1: number) {
  for (const win of w.windows) {
    if (win.x + win.w < x0 || win.x > x1) continue;
    c.fillStyle = win.shop ? 'rgba(255, 214, 130, 0.16)' : 'rgba(255, 214, 130, 0.85)';
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
