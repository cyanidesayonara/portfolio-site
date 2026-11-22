/*
  Commuter train loading cutscene and sliding door reveals between the 2D street
  and the 3D seafront walk. Driven by actual build/streaming progress, with a
  minimum scenic ride when arriving via Estació and an immediate Skip button once
  the 3D world is ready.

  The metro (`?via=metro`) gets its own: a ride through the tunnel in an L2-style
  car into an underground platform on the way in, and a walk down the stairs
  before the doors close on the way out (`playDepartureDoors(..., 'metro')`).
*/

export type Ride = 'train' | 'metro';

export interface TransitOpts {
  viaTrain: boolean;
  viaMetro?: boolean;
  night: boolean;
  reduced: boolean;
  walktest: boolean;
}

export interface TransitOverlay {
  setProgress: (pct: number, label?: string) => void;
  finish: () => Promise<void>;
}

const LOGICAL_W = 560;
const LOGICAL_H = 290;
const DWELL_MS = 1450;
const DOOR_MS = 380;

export function createTransitOverlay(host: HTMLElement, opts: TransitOpts): TransitOverlay {
  const el = document.createElement('div');
  const metro = !!opts.viaMetro && !opts.viaTrain;
  // Either ride plays the scenic version and opens doors at the end.
  const riding = opts.viaTrain || metro;
  const scene = metro ? drawMetroCutscene : drawCutscene;
  el.className = riding ? `loading via-train${metro ? ' metro' : ''}` : 'loading';

  const cv = document.createElement('canvas');
  cv.className = 'transit-cv';
  cv.setAttribute('aria-hidden', 'true');

  const labelEl = document.createElement('span');
  labelEl.className = 'transit-msg';
  labelEl.textContent = metro ? 'Metro L2 · Heading to the seafront…' : opts.viaTrain ? 'R1 · Heading to the seafront…' : 'Building the seafront…';

  const track = document.createElement('i');
  const bar = document.createElement('b');
  track.appendChild(bar);

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'skip';
  skipBtn.textContent = 'Skip';
  skipBtn.hidden = true;

  const doorL = document.createElement('div');
  doorL.className = 'door l';
  const doorR = document.createElement('div');
  doorR.className = 'door r';

  el.append(cv, labelEl, track, skipBtn, doorL, doorR);
  host.appendChild(el);

  const ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(LOGICAL_W * dpr);
  cv.height = Math.round(LOGICAL_H * dpr);

  const t0 = performance.now();
  let loadPct = 0;
  let customLabel: string | null = null;
  let worldReady = false;
  let skipped = false;
  let visP = 0;
  let raf = 0;
  let resolveSkip: (() => void) | null = null;

  skipBtn.addEventListener('click', () => {
    skipped = true;
    resolveSkip?.();
  });

  const drawFrame = (now: number) => {
    if (!ctx) return;
    const elapsed = now - t0;
    if (riding && !opts.reduced && !opts.walktest) {
      const targetP = worldReady ? Math.min(1, Math.max(loadPct / 100, elapsed / DWELL_MS)) : (loadPct / 100) * 0.86;
      visP += (targetP - visP) * 0.16;
      if (elapsed > DWELL_MS * 0.56 && visP > 0.55) {
        labelEl.textContent = metro ? 'Arriving at the metro…' : 'Approaching Estació…';
      }
    } else {
      visP = Math.max(visP, loadPct / 100);
      if (customLabel) labelEl.textContent = customLabel;
    }

    scene(ctx, dpr, visP, elapsed / 1000, opts.night, opts.reduced);
    if (!worldReady || (riding && !skipped && elapsed < DWELL_MS + 40 && visP < 0.99)) {
      raf = requestAnimationFrame(drawFrame);
    }
  };

  if (ctx) {
    scene(ctx, dpr, 0, 0, opts.night, opts.reduced);
    if (!opts.reduced && !opts.walktest) {
      raf = requestAnimationFrame(drawFrame);
    }
  }

  return {
    setProgress(pct: number, label?: string) {
      loadPct = Math.max(0, Math.min(100, pct));
      bar.style.width = `${loadPct}%`;
      if (label) customLabel = label;
    },
    async finish() {
      worldReady = true;
      loadPct = 100;
      bar.style.width = '100%';

      if (riding && !opts.reduced && !opts.walktest) {
        const remain = DWELL_MS - (performance.now() - t0);
        if (remain > 80) {
          skipBtn.hidden = false;
          await new Promise<void>((resolve) => {
            resolveSkip = resolve;
            window.setTimeout(resolve, remain);
          });
          resolveSkip = null;
        }
        skipBtn.hidden = true;
        cancelAnimationFrame(raf);
        visP = 1;
        if (ctx) scene(ctx, dpr, 1, (performance.now() - t0) / 1000, opts.night, false);
        el.classList.add('doors-open');
        await new Promise<void>((resolve) => window.setTimeout(resolve, DOOR_MS));
      } else {
        cancelAnimationFrame(raf);
      }

      el.remove();
    },
  };
}

/** How long the metro's walk down the stairs takes before its doors close (matches the CSS). */
const STAIRS_MS = 640;

export function playDepartureDoors(host: HTMLElement, label: string, reduced: boolean, ride: Ride = 'train'): Promise<void> {
  const el = document.createElement('div');
  el.className = ride === 'metro' ? 'loading depart metro' : 'loading depart';
  // The metro: steps rise over the view from the bottom (walking down), then the doors close.
  el.innerHTML = `${ride === 'metro' ? '<div class="stairs"></div>' : ''}<div class="door l"></div><div class="door r"></div><span class="transit-msg"></span>`;
  el.querySelector('.transit-msg')!.textContent = label;
  host.appendChild(el);
  if (reduced) return Promise.resolve();
  void el.offsetWidth;
  el.classList.add('closing');
  return new Promise<void>((resolve) => window.setTimeout(resolve, DOOR_MS + 40 + (ride === 'metro' ? STAIRS_MS : 0)));
}

function drawCutscene(
  c: CanvasRenderingContext2D,
  dpr: number,
  p: number,
  t: number,
  night: boolean,
  reduced: boolean,
) {
  c.save();
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

  // Train speed tapers to a halt as we pull into Estacio.
  const speed = p < 0.72 ? 1 : Math.max(0, 1 - (p - 0.72) / 0.28);
  const bump = reduced ? 0 : Math.sin(t * 28) * 1.1 * speed;

  // Window viewport coordinates.
  const wx = 26;
  const wy = 22;
  const ww = LOGICAL_W - 52;
  const wh = 172;

  // 1. Exterior world clipped inside the train window.
  c.save();
  c.beginPath();
  c.roundRect(wx, wy, ww, wh, 18);
  c.clip();

  const tunnelMid = 0.46;
  const tunnelSpan = 0.1;
  const inTunnel = Math.max(0, 1 - Math.abs(p - tunnelMid) / tunnelSpan);

  // Sky / backdrop
  if (inTunnel > 0.7) {
    c.fillStyle = '#121724';
    c.fillRect(wx, wy, ww, wh);
  } else {
    const skyG = c.createLinearGradient(0, wy, 0, wy + wh);
    if (night) {
      skyG.addColorStop(0, '#0b1430');
      skyG.addColorStop(1, '#263a66');
    } else {
      skyG.addColorStop(0, '#6bb8e8');
      skyG.addColorStop(1, '#dcebf2');
    }
    c.fillStyle = skyG;
    c.fillRect(wx, wy, ww, wh);

    if (night) {
      c.fillStyle = '#f4efe0';
      c.beginPath();
      c.arc(wx + ww - 68, wy + 34, 11, 0, Math.PI * 2);
      c.fill();
    }
  }

  const scroll = (p < 0.85 ? p * 980 : 0.85 * 980 + (p - 0.85) * 320);

  if (p < 0.48) {
    // City rush: shops, warm facades, striped awnings (leaving the 2D street).
    const baseY = wy + wh - 24;
    const cols = ['#efe6d3', '#e3b45c', '#d9705a', '#eadcc0', '#b9c3c9'];
    const awnings = ['#ffb020', '#1fc9b7', '#e5487a', '#8bcb3c'];
    const step = 92;
    const startIdx = Math.floor((scroll - 120) / step);
    for (let i = startIdx; i < startIdx + 9; i++) {
      const bx = wx + i * step - scroll;
      const h = 68 + ((Math.abs(i * 37) % 4) * 14);
      c.fillStyle = cols[Math.abs(i) % cols.length];
      c.fillRect(bx, baseY - h, 84, h);
      // Windows
      c.fillStyle = night ? 'rgba(255, 214, 130, 0.85)' : '#3b4560';
      for (let r = 0; r < 2; r++) {
        for (let k = 0; k < 3; k++) {
          c.fillRect(bx + 10 + k * 24, baseY - h + 12 + r * 20, 12, 12);
        }
      }
      // Shop awning strip
      c.fillStyle = awnings[Math.abs(i) % awnings.length];
      c.fillRect(bx + 4, baseY - 22, 76, 8);
    }
    c.fillStyle = '#9b9182';
    c.fillRect(wx, baseY, ww, 26);
  }

  if (p >= 0.42) {
    // Seafront reveal: horizon water, beach, palm silhouettes, chimney landmark.
    const coastAlpha = p < 0.56 ? Math.max(0, (p - 0.42) / 0.14) : 1;
    c.save();
    c.globalAlpha = coastAlpha;

    const horY = wy + 88;
    // Sea band
    c.fillStyle = night ? '#163854' : '#2d6a92';
    c.fillRect(wx, horY, ww, 30);
    c.fillStyle = night ? 'rgba(180, 210, 240, 0.2)' : 'rgba(255, 255, 255, 0.25)';
    for (let sx = 0; sx < ww; sx += 36) {
      const rx = wx + ((sx - scroll * 0.25) % ww + ww) % ww;
      c.fillRect(rx, horY + 8 + ((sx * 7) % 14), 16, 2);
    }
    // Beach sand + promenade curb
    c.fillStyle = night ? '#6f6653' : '#dcc58f';
    c.fillRect(wx, horY + 30, ww, 28);
    c.fillStyle = night ? '#484a54' : '#cfc9bb';
    c.fillRect(wx, horY + 56, ww, 30);

    // Distant pier & brick chimney landmark scrolling slowly
    const landX = wx + 360 - scroll * 0.22;
    c.fillStyle = '#8d7356';
    c.fillRect(landX - 24, horY + 12, 48, 5);
    c.fillStyle = '#b5694e';
    c.fillRect(landX + 115, horY - 28, 7, 56);

    // Date palms along the Rambla
    const pStep = 110;
    const pStart = Math.floor((scroll - 160) / pStep);
    for (let i = pStart; i < pStart + 8; i++) {
      const px = wx + i * pStep - scroll * 0.85;
      c.fillStyle = night ? '#2e2a25' : '#785a3a';
      c.fillRect(px - 2.5, horY + 8, 5, 52);
      c.fillStyle = night ? '#264430' : '#4a8844';
      for (let a = -2; a <= 2; a++) {
        c.beginPath();
        c.ellipse(px + a * 8, horY + 8 + Math.abs(a) * 2.5, 11, 3.2, a * 0.35, 0, Math.PI * 2);
        c.fill();
      }
    }

    // Estacio platform canopy & R1 sign easing in near p >= 0.74
    if (p > 0.72) {
      const arrive = Math.min(1, (p - 0.72) / 0.28);
      const sx = wx + ww - arrive * (ww - 84);
      c.fillStyle = '#9aa0a8';
      c.fillRect(sx - 20, wy + 26, 260, 7);
      c.fillStyle = '#7b828c';
      for (let kx = 18; kx < 230; kx += 68) c.fillRect(sx + kx, wy + 33, 5, 112);
      c.fillStyle = '#e5302a';
      c.beginPath();
      c.roundRect(sx + 54, wy + 52, 84, 22, 4);
      c.fill();
      c.fillStyle = '#f4f1ea';
      c.font = '800 12px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('Estació · R1', sx + 96, wy + 63.5);
    }

    c.restore();
  }

  // Tunnel overlay flash with strobing ceiling lights
  if (inTunnel > 0) {
    c.save();
    c.globalAlpha = inTunnel * 0.92;
    c.fillStyle = '#141926';
    c.fillRect(wx, wy, ww, wh);
    c.fillStyle = '#ffb020';
    for (let i = -1; i < 6; i++) {
      const lx = wx + (((i * 110 - scroll * 1.9) % (ww + 110)) + ww + 110) % (ww + 110) - 55;
      c.fillRect(lx, wy + 12, 34, 4);
    }
    c.restore();
  }

  // Overhead rail catenary wire + passing masts
  c.strokeStyle = 'rgba(20, 32, 61, 0.45)';
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(wx, wy + 18);
  c.lineTo(wx + ww, wy + 18);
  c.stroke();

  c.restore(); // end window clip

  // 2. Commuter train interior framing, hanging straps, human & Millie.
  c.save();
  c.translate(0, bump);

  const wallCol = night ? '#222b42' : '#dde1e8';
  const trimCol = night ? '#394666' : '#aeb6c4';
  c.fillStyle = wallCol;
  c.beginPath();
  c.rect(0, -4, LOGICAL_W, LOGICAL_H + 8);
  c.roundRect(wx, wy, ww, wh, 18);
  c.fill('evenodd');

  // Metallic window bezel
  c.strokeStyle = trimCol;
  c.lineWidth = 4;
  c.beginPath();
  c.roundRect(wx, wy, ww, wh, 18);
  c.stroke();

  // Window reflection sheen
  c.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(wx + 24, wy + wh - 12);
  c.lineTo(wx + 86, wy + 14);
  c.moveTo(wx + 54, wy + wh - 12);
  c.lineTo(wx + 116, wy + 14);
  c.stroke();

  // Overhead grab pole and swaying straps
  c.fillStyle = '#9aa3b2';
  c.fillRect(0, 10, LOGICAL_W, 4);
  const sway = reduced ? 0 : Math.sin(t * 5.2) * 0.14 * (0.25 + 0.75 * speed);
  for (const sx of [136, 424]) {
    c.save();
    c.translate(sx, 14);
    c.rotate(sway);
    c.strokeStyle = '#5c6473';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, 18);
    c.stroke();
    c.strokeStyle = '#ffb020';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 24, 6, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  // Seat bench along bottom cabin
  c.fillStyle = '#3a4a75';
  c.beginPath();
  c.roundRect(14, 198, LOGICAL_W - 28, 84, [12, 12, 0, 0]);
  c.fill();
  c.fillStyle = '#273457';
  c.fillRect(14, 232, LOGICAL_W - 28, 56);

  drawRiders(c, t, speed, reduced);

  c.restore();
  c.restore();
}

/** Millie and her human on the seat: shared by the train and the metro rides. */
function drawRiders(c: CanvasRenderingContext2D, t: number, speed: number, reduced: boolean) {
  // Human sitting on the bench, looking at their phone
  const hx = 192;
  const hy = 208;
  c.fillStyle = '#1fc9b7';
  c.beginPath();
  c.roundRect(hx - 18, hy - 36, 36, 44, 10);
  c.fill();
  c.fillStyle = '#f2c8a2';
  c.beginPath();
  c.arc(hx, hy - 50, 13, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#5b3a29';
  c.beginPath();
  c.arc(hx - 1, hy - 53, 13.5, Math.PI, Math.PI * 2);
  c.fill();
  // Phone glow
  c.fillStyle = '#d6fff9';
  c.fillRect(hx + 12, hy - 34, 6, 11);

  // Millie perched next to her human looking eagerly toward the coast window
  const mx = 294;
  const my = 194;
  const earBob = reduced ? 0 : Math.sin(t * 14) * 1.4 * speed;
  const wag = reduced ? 0 : Math.sin(t * 16) * 0.45;
  // Wagging tail
  c.save();
  c.translate(mx - 20, my - 4);
  c.rotate(-0.6 + wag);
  c.strokeStyle = '#1b1b1f';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(-12, -10);
  c.stroke();
  c.restore();

  // Sausage body + paws on the sill
  c.fillStyle = '#1b1b1f';
  c.beginPath();
  c.ellipse(mx, my, 22, 11, -0.18, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.roundRect(mx + 10, my - 22, 18, 17, 7);
  c.fill();
  c.beginPath();
  c.roundRect(mx + 22, my - 19, 13, 9, 4);
  c.fill();
  // Perked ear
  c.fillStyle = '#2d2d34';
  c.beginPath();
  c.ellipse(mx + 14, my - 13 + earBob, 4.5, 8, 0.25, 0, Math.PI * 2);
  c.fill();
  // Bright eye glinting
  c.fillStyle = '#f4f1ea';
  c.beginPath();
  c.arc(mx + 25, my - 16, 1.5, 0, Math.PI * 2);
  c.fill();
  // Collar & slack red leash to owner's hand
  c.strokeStyle = '#ffb020';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(mx + 12, my - 8);
  c.lineTo(mx + 21, my - 4);
  c.stroke();
  c.strokeStyle = '#d9403a';
  c.lineWidth = 2.6;
  c.beginPath();
  c.moveTo(mx + 14, my - 6);
  c.quadraticCurveTo((hx + mx) / 2, my + 24, hx + 11, hy - 22);
  c.stroke();
}

/**
 * The metro ride: an L2-style car (stainless, a purple stripe, a vertical grab
 * pole) running through the tunnel, its lights streaking past the window, and
 * pulling into an underground platform as `p` nears 1. The platform's sign
 * just says Metro: the real station stays unnamed.
 */
function drawMetroCutscene(
  c: CanvasRenderingContext2D,
  dpr: number,
  p: number,
  t: number,
  night: boolean,
  reduced: boolean,
) {
  c.save();
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

  const speed = p < 0.7 ? 1 : Math.max(0, 1 - (p - 0.7) / 0.3);
  const bump = reduced ? 0 : Math.sin(t * 34) * 0.9 * speed;
  const wx = 26;
  const wy = 22;
  const ww = LOGICAL_W - 52;
  const wh = 172;
  const scroll = p < 0.85 ? p * 1400 : 0.85 * 1400 + (p - 0.85) * 260;

  // 1. Through the window: the tunnel, then the platform sliding in.
  c.save();
  c.beginPath();
  c.roundRect(wx, wy, ww, wh, 18);
  c.clip();
  c.fillStyle = '#101219';
  c.fillRect(wx, wy, ww, wh);
  // Tunnel wall: ribs and cable runs, scrolling fast.
  c.fillStyle = '#1b1e28';
  for (let i = -1; i < 12; i++) {
    const rx = wx + ((((i * 60 - scroll * 1.6) % (ww + 60)) + ww + 60) % (ww + 60)) - 30;
    c.fillRect(rx, wy, 10, wh);
  }
  c.strokeStyle = '#2c3140';
  c.lineWidth = 3;
  for (const cy of [wy + 46, wy + 58, wy + 130]) {
    c.beginPath();
    c.moveTo(wx, cy);
    c.lineTo(wx + ww, cy);
    c.stroke();
  }
  // Tunnel lights streaking past (longer the faster she goes).
  c.fillStyle = '#ffe6a8';
  const streak = 8 + 70 * speed;
  for (let i = -1; i < 4; i++) {
    const lx = wx + ((((i * 170 - scroll * 2.2) % (ww + 170)) + ww + 170) % (ww + 170)) - 85;
    c.globalAlpha = 0.85;
    c.fillRect(lx, wy + 30, streak, 5);
    c.globalAlpha = 0.18;
    c.fillRect(lx - 10, wy + 22, streak + 20, 22);
  }
  c.globalAlpha = 1;

  // The platform: white tiles with a band of the line's color, lights, a sign.
  if (p > 0.62) {
    const arrive = Math.min(1, (p - 0.62) / 0.38);
    const px = wx + ww - arrive * ww * 1.05;
    c.fillStyle = night ? '#d8dbe2' : '#eceef1';
    c.fillRect(px, wy, ww * 1.4, wh);
    c.strokeStyle = 'rgba(120, 130, 145, 0.25)';
    c.lineWidth = 1;
    c.beginPath();
    for (let gx = 0; gx < ww * 1.4; gx += 14) {
      c.moveTo(px + gx, wy);
      c.lineTo(px + gx, wy + wh);
    }
    for (let gy = wy; gy < wy + wh; gy += 10) {
      c.moveTo(px, gy);
      c.lineTo(px + ww * 1.4, gy);
    }
    c.stroke();
    c.fillStyle = '#9b2d8f';
    c.fillRect(px, wy + 96, ww * 1.4, 14);
    c.fillStyle = '#fff6dc';
    for (let lx = 30; lx < ww * 1.4; lx += 120) c.fillRect(px + lx, wy + 8, 70, 6);
    // Sign: the red diamond, "Metro" and the line badge.
    const sx = px + 140;
    c.fillStyle = '#14203d';
    c.beginPath();
    c.roundRect(sx, wy + 52, 180, 32, 5);
    c.fill();
    c.save();
    c.translate(sx + 22, wy + 68);
    c.rotate(Math.PI / 4);
    c.fillStyle = '#d52b1e';
    c.fillRect(-9, -9, 18, 18);
    c.restore();
    c.fillStyle = '#f4f1ea';
    c.font = '900 13px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('M', sx + 22, wy + 68.5);
    c.textAlign = 'left';
    c.font = '800 15px system-ui, sans-serif';
    c.fillText('Metro', sx + 42, wy + 68.5);
    c.fillStyle = '#9b2d8f';
    c.beginPath();
    c.roundRect(sx + 100, wy + 58, 30, 20, 4);
    c.fill();
    c.fillStyle = '#f4f1ea';
    c.textAlign = 'center';
    c.font = '800 12px system-ui, sans-serif';
    c.fillText('L2', sx + 115, wy + 68.5);
    c.textAlign = 'left';
    c.font = '700 9px system-ui, sans-serif';
    c.fillText('SORTIDA', sx + 138, wy + 68.5);
    // The platform edge
    c.fillStyle = '#f2c230';
    c.fillRect(px, wy + wh - 18, ww * 1.4, 5);
    c.fillStyle = '#8a8c90';
    c.fillRect(px, wy + wh - 13, ww * 1.4, 13);
  }
  c.restore();

  // 2. The car: stainless walls, a purple stripe, a vertical pole, the seat.
  c.save();
  c.translate(0, bump);
  c.fillStyle = night ? '#3a4152' : '#c9ced6';
  c.beginPath();
  c.rect(0, -4, LOGICAL_W, LOGICAL_H + 8);
  c.roundRect(wx, wy, ww, wh, 18);
  c.fill('evenodd');
  c.strokeStyle = night ? '#596173' : '#9aa1ab';
  c.lineWidth = 4;
  c.beginPath();
  c.roundRect(wx, wy, ww, wh, 18);
  c.stroke();
  c.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(wx + 30, wy + wh - 12);
  c.lineTo(wx + 92, wy + 14);
  c.stroke();
  c.fillStyle = '#9b2d8f';
  c.fillRect(0, wy + wh + 2, LOGICAL_W, 8);
  // Line map strip above the window: dots along a purple line.
  c.fillStyle = '#9b2d8f';
  c.fillRect(150, 7, 260, 3);
  c.fillStyle = '#f4f1ea';
  for (let k = 0; k < 9; k++) {
    c.beginPath();
    c.arc(150 + k * 32.5, 8.5, 3, 0, Math.PI * 2);
    c.fill();
  }
  // Vertical grab pole by the door.
  c.fillStyle = '#e2e6ea';
  c.fillRect(LOGICAL_W - 92, 0, 6, LOGICAL_H);
  c.fillStyle = 'rgba(0, 0, 0, 0.15)';
  c.fillRect(LOGICAL_W - 87, 0, 1.5, LOGICAL_H);
  // Seat (the metro's moulded seats, in the line's color).
  c.fillStyle = '#7a2370';
  c.beginPath();
  c.roundRect(14, 198, LOGICAL_W - 120, 84, [12, 12, 0, 0]);
  c.fill();
  c.fillStyle = '#5e1b57';
  c.fillRect(14, 232, LOGICAL_W - 120, 56);

  drawRiders(c, t, speed, reduced);

  c.restore();
  c.restore();
}
