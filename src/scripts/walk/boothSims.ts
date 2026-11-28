/*
  The booth screens' simulators (Eat Prey Nap, dopepod) and their 2D canvas drawing,
  shared by the 2D street's shop windows (/) and the 3D boardwalk pavilions (/walk).
  Kept free of three.js so the home page does not have to download it.
*/
import { coverUrl, fmtTime } from '../podcast/feed';
import type { PodcastPlayer } from '../podcast/player';
import type { PodLabels } from '../podcast/controls';

export type CatPalette = {
  name: string;
  bg: string;
  border: string;
  mound: string;
  moundEdge: string;
  crumb: string;
  mouse: string;
  ear: string;
  eye: string;
};

export const CAT_PALETTES: CatPalette[] = [
  { name: 'Straw', bg: '#e3d39d', border: '#cbbb81', mound: '#c2ad6d', moundEdge: '#9e894d', crumb: '#a78d48', mouse: '#16224b', ear: '#9397a1', eye: '#e3d39d' },
  { name: 'Night', bg: '#16224b', border: '#253874', mound: '#2c3d72', moundEdge: '#475c9d', crumb: '#475c9d', mouse: '#f3e79b', ear: '#8e96aa', eye: '#16224b' },
  { name: 'Grey', bg: '#8d9096', border: '#75787f', mound: '#6a6d75', moundEdge: '#52555d', crumb: '#585b62', mouse: '#15171c', ear: '#a6aab1', eye: '#8d9096' },
];

export const CAT_SIZES = [
  { label: '28 mm', scale: 0.78 },
  { label: '40 mm', scale: 1.0 },
  { label: '55 mm', scale: 1.32 },
] as const;

type MousePhase = 'hidden' | 'tell' | 'peek' | 'sniff' | 'creep' | 'freeze' | 'dart' | 'pinned' | 'caught';

const MOUNDS: [number, number][] = [
  [0.14, 0.54],
  [0.86, 0.46],
  [0.42, 0.16],
  [0.64, 0.84],
];

const CRUMBS: [number, number][] = [
  [0.36, 0.62],
  [0.52, 0.44],
  [0.66, 0.58],
  [0.44, 0.34],
  [0.58, 0.7],
];

export interface EatPreyNapState {
  u: number;
  v: number;
  heading: number;
  visible: boolean;
  state: MousePhase;
  catches: number;
  tries: number;
  misses: number;
  palette: number;
  size: number;
  watchOnly: boolean;
}

export class EatPreyNapSim {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private pixelMode: boolean;
  private moundIdx = 0;
  private u = MOUNDS[0][0];
  private v = MOUNDS[0][1];
  private tx = 0.5;
  private ty = 0.46;
  private heading = 0;
  private phase: MousePhase = 'tell';
  private phaseT = 0.8;
  private time = 0;
  private catches = 0;
  private tries = 0;
  private misses = 0;
  private palette = 0;
  private size = 1;
  private watchOnly = false;
  private bursts: { u: number; v: number; t: number; maxT: number; caught: boolean }[] = [];

  constructor(opts: { width?: number; height?: number; pixelated?: boolean } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = opts.width ?? 256;
    this.canvas.height = opts.height ?? 160;
    this.ctx = this.canvas.getContext('2d')!;
    this.pixelMode = !!opts.pixelated;
    this.pickTarget();
    this.draw();
  }

  private pickTarget() {
    const c = CRUMBS[(this.moundIdx + this.catches + this.tries) % CRUMBS.length];
    this.tx = c[0] + Math.sin(this.time * 3.1) * 0.08;
    this.ty = c[1] + Math.cos(this.time * 2.7) * 0.07;
  }

  private nextMound(exclude = this.moundIdx) {
    this.moundIdx = (exclude + 1 + Math.floor((this.time * 13) % (MOUNDS.length - 1))) % MOUNDS.length;
    const m = MOUNDS[this.moundIdx];
    this.u = m[0];
    this.v = m[1];
    this.heading = Math.atan2(0.5 - m[1], 0.5 - m[0]);
  }

  cyclePalette() {
    this.palette = (this.palette + 1) % CAT_PALETTES.length;
    this.draw();
    return this.palette;
  }

  cycleSize() {
    this.size = (this.size + 1) % CAT_SIZES.length;
    this.draw();
    return this.size;
  }

  toggleWatchOnly() {
    this.watchOnly = !this.watchOnly;
    this.draw();
    return this.watchOnly;
  }

  getMouseState(): EatPreyNapState {
    return {
      u: this.u,
      v: this.v,
      heading: this.heading,
      visible: this.phase !== 'hidden',
      state: this.phase,
      catches: this.catches,
      tries: this.tries,
      misses: this.misses,
      palette: this.palette,
      size: this.size,
      watchOnly: this.watchOnly,
    };
  }

  pawAt(pu: number, pv: number, fromIdleCat = false): 'catch' | 'pin' | 'fright' | 'miss' {
    if (this.watchOnly && !fromIdleCat) return 'miss';
    const d = Math.hypot(pu - this.u, pv - this.v);
    const sc = CAT_SIZES[this.size].scale;
    const hitR = 0.11 * sc;
    const m = MOUNDS[this.moundIdx];
    const moundHit = Math.hypot(pu - m[0], pv - m[1]) < 0.12;

    if (!fromIdleCat) this.tries++;
    if (this.phase !== 'hidden' && this.phase !== 'tell' && d < hitR) {
      this.misses = fromIdleCat ? this.misses : 0;
      const guaranteeCatch = this.misses >= 5 || this.phase === 'pinned' || (fromIdleCat && Math.random() < 0.45) || (!fromIdleCat && Math.random() < 0.48);
      if (guaranteeCatch) {
        if (!fromIdleCat) this.catches++;
        this.phase = 'caught';
        this.phaseT = 0.55;
        this.bursts.push({ u: this.u, v: this.v, t: 0.55, maxT: 0.55, caught: true });
        this.draw();
        return 'catch';
      }
      this.phase = 'pinned';
      this.phaseT = 0.42;
      this.bursts.push({ u: this.u, v: this.v, t: 0.42, maxT: 0.42, caught: false });
      this.draw();
      return 'pin';
    }

    if (!fromIdleCat) this.misses++;
    if (moundHit && (this.phase === 'hidden' || this.phase === 'tell' || this.phase === 'peek')) {
      this.nextMound(this.moundIdx);
      this.phase = 'dart';
      this.phaseT = 0.65;
      this.pickTarget();
      this.bursts.push({ u: pu, v: pv, t: 0.35, maxT: 0.35, caught: false });
      this.draw();
      return 'fright';
    }
    if (d < 0.25 && this.phase !== 'hidden') {
      this.phase = d < 0.17 ? 'freeze' : 'dart';
      this.phaseT = this.phase === 'freeze' ? 0.55 : 0.45;
      if (this.phase === 'dart') {
        this.tx = MOUNDS[this.moundIdx][0];
        this.ty = MOUNDS[this.moundIdx][1];
      }
      this.bursts.push({ u: pu, v: pv, t: 0.3, maxT: 0.3, caught: false });
      this.draw();
      return 'fright';
    }
    this.bursts.push({ u: pu, v: pv, t: 0.25, maxT: 0.25, caught: false });
    return 'miss';
  }

  update(dt: number) {
    this.time += dt;
    this.phaseT -= dt;
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      this.bursts[i].t -= dt;
      if (this.bursts[i].t <= 0) this.bursts.splice(i, 1);
    }

    const m = MOUNDS[this.moundIdx];
    const dirToCenter = Math.atan2(0.5 - m[1], 0.5 - m[0]);

    if (this.phase === 'hidden') {
      this.u = m[0];
      this.v = m[1];
      if (this.phaseT <= 0) {
        this.nextMound();
        this.phase = 'tell';
        this.phaseT = 0.65;
      }
    } else if (this.phase === 'tell') {
      this.heading = dirToCenter;
      this.u = m[0] + Math.cos(this.heading) * 0.03;
      this.v = m[1] + Math.sin(this.heading) * 0.03;
      if (this.phaseT <= 0) {
        this.phase = 'peek';
        this.phaseT = 0.7;
      }
    } else if (this.phase === 'peek') {
      this.u = m[0] + Math.cos(dirToCenter) * 0.085;
      this.v = m[1] + Math.sin(dirToCenter) * 0.085;
      this.heading = dirToCenter + Math.sin(this.time * 4) * 0.25;
      if (this.phaseT <= 0) {
        this.phase = 'sniff';
        this.phaseT = 0.65;
      }
    } else if (this.phase === 'sniff') {
      this.u = m[0] + Math.cos(dirToCenter) * 0.11;
      this.v = m[1] + Math.sin(dirToCenter) * 0.11;
      this.heading = dirToCenter + Math.sin(this.time * 9) * 0.2;
      if (this.phaseT <= 0) {
        this.pickTarget();
        this.phase = 'creep';
        this.phaseT = 1.65;
      }
    } else if (this.phase === 'creep') {
      const dx = this.tx - this.u;
      const dy = this.ty - this.v;
      const d = Math.hypot(dx, dy);
      if (d > 0.02) {
        const sp = 0.22 * (0.7 + 0.5 * Math.sin(this.time * 8));
        this.u += (dx / d) * sp * dt;
        this.v += (dy / d) * sp * dt;
        this.heading = Math.atan2(dy, dx);
      }
      if (this.phaseT <= 0 || d <= 0.03) {
        this.phase = 'freeze';
        this.phaseT = 0.6;
      }
    } else if (this.phase === 'freeze') {
      if (this.phaseT <= 0) {
        this.tx = m[0];
        this.ty = m[1];
        this.phase = 'dart';
        this.phaseT = 0.85;
      }
    } else if (this.phase === 'dart') {
      const dx = this.tx - this.u;
      const dy = this.ty - this.v;
      const d = Math.hypot(dx, dy);
      if (d > 0.02) {
        const sp = 0.62;
        this.u += (dx / d) * sp * dt;
        this.v += (dy / d) * sp * dt;
        this.heading = Math.atan2(dy, dx);
      }
      if (d <= 0.04 || this.phaseT <= 0) {
        this.phase = 'hidden';
        this.phaseT = 0.7;
      }
    } else if (this.phase === 'pinned') {
      this.heading += Math.sin(this.time * 32) * 0.25;
      if (this.phaseT <= 0) {
        this.tx = m[0];
        this.ty = m[1];
        this.phase = 'dart';
        this.phaseT = 0.55;
      }
    } else if (this.phase === 'caught') {
      if (this.phaseT <= 0) {
        this.nextMound(this.moundIdx);
        this.phase = 'hidden';
        this.phaseT = 0.9;
      }
    }
  }

  draw() {
    const c = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const pal = CAT_PALETTES[this.palette];
    const snap = (v: number) => (this.pixelMode ? Math.round(v / 2) * 2 : v);

    c.fillStyle = pal.bg;
    c.fillRect(0, 0, W, H);

    // Faint looping mouse-tail border + paw prints matching the real game.
    c.strokeStyle = pal.border;
    c.lineWidth = this.pixelMode ? 2 : 1.5;
    c.strokeRect(snap(6), snap(6), snap(W - 12), snap(H - 12));
    c.fillStyle = pal.border;
    for (let x = 22; x < W - 20; x += 36) {
      c.beginPath();
      c.arc(snap(x), 6, 2.5, 0, Math.PI * 2);
      c.arc(snap(x + 16), H - 6, 2.5, 0, Math.PI * 2);
      c.fill();
    }

    // Scattered crumbs.
    c.fillStyle = pal.crumb;
    for (const [cx, cy] of CRUMBS) {
      const px = snap(cx * W);
      const py = snap(cy * H);
      c.beginPath();
      c.arc(px, py, 2.5, 0, Math.PI * 2);
      c.arc(px + 3, py + 1.5, 1.5, 0, Math.PI * 2);
      c.fill();
    }

    // Mouse (drawn before mounds so it peeks cleanly out from beneath one).
    if (this.phase !== 'hidden') {
      const sc = CAT_SIZES[this.size].scale;
      const mx = snap(this.u * W);
      const my = snap(this.v * H);
      const r = (W / 256) * 9.5 * sc;
      c.save();
      c.translate(mx, my);
      c.rotate(this.heading);

      // Tail trailing behind.
      c.strokeStyle = pal.mouse;
      c.lineWidth = Math.max(2, r * 0.24);
      c.lineCap = 'round';
      c.beginPath();
      const wag = Math.sin(this.time * (this.phase === 'tell' ? 14 : 7)) * r * 0.45;
      c.moveTo(-r * 0.9, 0);
      c.quadraticCurveTo(-r * 1.9, wag, -r * 2.7, -wag * 0.6);
      c.stroke();

      // Body & pointy snout.
      c.fillStyle = pal.mouse;
      c.beginPath();
      c.ellipse(0, 0, r * 1.15, r * 0.72, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(r * 0.6, -r * 0.45);
      c.lineTo(r * 1.55, 0);
      c.lineTo(r * 0.6, r * 0.45);
      c.closePath();
      c.fill();

      // Bold round ears.
      for (const s of [-1, 1]) {
        c.fillStyle = pal.mouse;
        c.beginPath();
        c.arc(r * 0.25, s * r * 0.68, r * 0.44, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = pal.ear;
        c.beginPath();
        c.arc(r * 0.27, s * r * 0.68, r * 0.24, 0, Math.PI * 2);
        c.fill();
      }

      // Highlight eye dots.
      c.fillStyle = pal.eye;
      c.beginPath();
      c.arc(r * 0.85, -r * 0.22, r * 0.14, 0, Math.PI * 2);
      c.arc(r * 0.85, r * 0.22, r * 0.14, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    // Edge hiding mounds.
    for (const [mx, my] of MOUNDS) {
      const px = snap(mx * W);
      const py = snap(my * H);
      const mr = (W / 256) * 20;
      c.fillStyle = pal.mound;
      c.strokeStyle = pal.moundEdge;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(px, py, mr, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }

    // Paw tap feedback ripples.
    for (const b of this.bursts) {
      const k = 1 - b.t / b.maxT;
      c.strokeStyle = pal.mouse;
      c.globalAlpha = 1 - k;
      c.lineWidth = b.caught ? 3 : 2;
      c.beginPath();
      c.arc(b.u * W, b.v * H, 8 + k * (b.caught ? 28 : 16), 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
    }

    // Subtle top counter pill (non-distracting).
    c.fillStyle = pal.mouse;
    c.globalAlpha = 0.72;
    c.font = `800 ${Math.max(9, Math.round(W / 24))}px 'Bricolage Grotesque', system-ui, sans-serif`;
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillText(`${pal.name} · ${CAT_SIZES[this.size].label}`, 12, 10);
    if (this.catches > 0) {
      c.textAlign = 'right';
      c.fillText(`${this.catches} caught`, W - 12, 10);
    }
    c.globalAlpha = 1;
  }
}

export function drawGlassSheen(c: CanvasRenderingContext2D, W: number, H: number) {
  c.save();
  c.fillStyle = 'rgba(255, 255, 255, 0.05)';
  c.beginPath();
  c.moveTo(W * 0.08, 0);
  c.lineTo(W * 0.24, 0);
  c.lineTo(W * 0.06, H);
  c.lineTo(0, H);
  c.lineTo(0, H * 0.42);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(255, 255, 255, 0.03)';
  c.beginPath();
  c.moveTo(W * 0.30, 0);
  c.lineTo(W * 0.36, 0);
  c.lineTo(W * 0.14, H);
  c.lineTo(W * 0.09, H);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  c.lineWidth = 1;
  c.strokeRect(0.5, 0.5, W - 1, H - 1);
  c.restore();
}

export interface LeashMirrorState {
  active: boolean;
  dx: number;
  dz: number;
  dogHeading: number;
  dogSpeed: number;
  hx: number;
  hz: number;
  humanState: string;
  taut: number;
  barkT: number;
  offLeash: boolean;
  sky: 'day' | 'rain' | 'night';
}

/** The dopepod booth's screen: draws what the shared podcast player is really doing. */
export class DopepodSim {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private player: PodcastPlayer;
  private labels: PodLabels;
  private pixelMode: boolean;
  private time = 0;
  private covers = new Map<string, HTMLImageElement>();

  constructor(opts: { player: PodcastPlayer; labels: PodLabels; width?: number; height?: number; pixelated?: boolean }) {
    this.player = opts.player;
    this.labels = opts.labels;
    this.canvas = document.createElement('canvas');
    this.canvas.width = opts.width ?? 256;
    this.canvas.height = opts.height ?? 160;
    this.ctx = this.canvas.getContext('2d')!;
    this.pixelMode = !!opts.pixelated;
    this.draw();
  }

  getState() {
    const p = this.player;
    return { accent: p.accent, playing: p.status === 'playing', progress: p.progress, episodeIdx: p.epIdx };
  }

  update(dt: number) {
    this.time += dt;
  }

  /** The current show's cover once it has loaded. CORS-clean, or the WebGL texture would be tainted. */
  private cover(): HTMLImageElement | null {
    const show = this.player.show;
    if (!show) return null;
    let img = this.covers.get(show.id);
    if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = coverUrl(show);
      this.covers.set(show.id, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  private fit(txt: string, w: number) {
    const c = this.ctx;
    if (c.measureText(txt).width <= w) return txt;
    let n = txt.length;
    while (n > 1 && c.measureText(`${txt.slice(0, n)}…`).width > w) n--;
    return `${txt.slice(0, n).trimEnd()}…`;
  }

  draw() {
    const c = this.ctx;
    const { player, labels } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const small = H < 130;
    const accent = player.accent;
    const playing = player.status === 'playing';
    const snap = (v: number) => (this.pixelMode ? Math.round(v / 2) * 2 : v);
    const body = (weight: number, px: number) => {
      c.font = `${weight} ${px}px 'Inter', system-ui, sans-serif`;
    };

    c.fillStyle = '#0f162b';
    c.fillRect(0, 0, W, H);

    // Header bar
    const headH = small ? 18 : 24;
    c.fillStyle = '#182447';
    c.fillRect(0, 0, W, headH);
    c.fillStyle = accent;
    c.fillRect(0, headH - 2, W, 2);
    c.fillStyle = '#f4f1ea';
    c.font = `800 10px 'Bricolage Grotesque', system-ui, sans-serif`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('dopepod', 8, headH / 2 - 1);
    const failed = player.feed === 'failed' || player.status === 'error';
    const busy = player.feed === 'loading' || player.status === 'loading';
    const stat = failed ? labels.error : busy ? labels.loading : playing ? labels.playing : player.status === 'paused' ? labels.paused : labels.idle;
    c.fillStyle = failed ? '#ff8a7a' : playing ? '#5eea8c' : '#96a2c4';
    c.textAlign = 'right';
    body(700, small ? 8 : 9);
    c.fillText(this.fit(stat.toUpperCase(), W - 70), W - 8, headH / 2 - 1);
    if (player.active && !small) {
      const pulse = 0.55 + 0.45 * Math.sin(this.time * 6);
      c.fillStyle = playing ? `rgba(217, 76, 166, ${0.7 + pulse * 0.3})` : 'rgba(217, 76, 166, 0.45)';
      c.fillRect(W - 58, 4, 48, 14);
      c.fillStyle = '#0b1430';
      c.textAlign = 'center';
      body(800, 7.5);
      c.fillText('ON AIR', W - 34, 11);
    }
    c.textAlign = 'left';

    // Artwork, with decorative bars (the audio never goes through Web Audio)
    const artX = small ? 8 : 12, artY = headH + (small ? 6 : 10), artS = small ? 40 : 54;
    const cover = this.cover();
    c.fillStyle = accent;
    c.fillRect(artX, artY, artS, artS);
    if (cover) {
      c.imageSmoothingEnabled = !this.pixelMode;
      c.drawImage(cover, artX, artY, artS, artS);
    }
    if (!cover || playing) {
      c.fillStyle = cover ? accent : 'rgba(11, 20, 48, 0.3)';
      const bw = Math.floor(artS / 7);
      for (let k = 0; k < 5; k++) {
        const h = artS * (0.16 + Math.abs(Math.sin(k * 1.4 + (playing ? this.time * 5 : 0.4))) * (cover ? 0.26 : 0.5));
        c.fillRect(snap(artX + bw + k * bw * 1.1), snap(artY + artS - h - 2), bw - 1, snap(h));
      }
    }

    const tx = artX + artS + (small ? 8 : 12);
    const tw = W - tx - 8;
    const { show, episode } = player;
    if (!show || !episode) {
      c.fillStyle = '#f4f1ea';
      body(700, small ? 9 : 11);
      const words = (failed ? labels.feedFailed : player.feed === 'loading' ? labels.loading : labels.hint).split(' ');
      const lines: string[] = [];
      for (const w of words) {
        const last = lines[lines.length - 1];
        if (last !== undefined && c.measureText(`${last} ${w}`).width <= tw) lines[lines.length - 1] = `${last} ${w}`;
        else lines.push(w);
      }
      const lh = small ? 12 : 15;
      lines.slice(0, small ? 5 : 8).forEach((l, i) => c.fillText(l, tx, artY + 8 + i * lh));
      drawGlassSheen(c, W, H);
      return;
    }

    c.fillStyle = accent;
    body(700, small ? 8 : 9);
    c.fillText(this.fit(show.title.toUpperCase(), tw), tx, artY + 6);
    c.fillStyle = '#f4f1ea';
    c.font = `800 ${small ? 10 : 12}px 'Bricolage Grotesque', system-ui, sans-serif`;
    c.fillText(this.fit(episode.title, tw), tx, artY + (small ? 19 : 22));
    c.fillStyle = '#9aa6c8';
    body(600, small ? 8 : 9);
    const d = player.duration;
    const clock = d ? `${fmtTime(player.time)} / ${fmtTime(d)}` : fmtTime(player.time);
    c.fillText(this.fit(player.status === 'error' ? labels.playFailed : clock, tw), tx, artY + (small ? 31 : 38));

    // Scrubber bar
    const sy = artY + (small ? 38 : 49);
    c.fillStyle = '#243461';
    c.fillRect(tx, sy, tw, small ? 3 : 5);
    c.fillStyle = accent;
    c.fillRect(tx, sy, Math.round(tw * player.progress), small ? 3 : 5);

    // The show's episodes
    const rowH = small ? 11 : 18;
    const rows = Math.max(1, Math.floor((H - artY - artS - 4) / rowH));
    const first = Math.max(0, Math.min(player.epIdx - 1, show.episodes.length - rows));
    show.episodes.slice(first, first + rows).forEach((item, i) => {
      const idx = first + i;
      const y = artY + artS + (small ? 4 : 12) + i * rowH;
      const active = idx === player.epIdx;
      const bh = rowH - (small ? 1 : 3);
      c.fillStyle = active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)';
      c.fillRect(8, y, W - 16, bh);
      if (active) {
        c.fillStyle = accent;
        c.fillRect(8, y, 3, bh);
      }
      c.fillStyle = active ? '#f4f1ea' : '#9aa6c8';
      body(active ? 700 : 500, small ? 7 : 9);
      const len = item.duration ? fmtTime(item.duration) : '';
      c.fillText(this.fit(`${idx + 1}. ${item.title}`, W - 68), 15, y + bh / 2);
      c.textAlign = 'right';
      c.fillText(len, W - 12, y + bh / 2);
      c.textAlign = 'left';
    });
    drawGlassSheen(c, W, H);
  }
}
