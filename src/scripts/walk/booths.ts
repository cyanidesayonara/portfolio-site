/*
  Shared embeddable simulators & idling booth screens for both the 3D boardwalk
  pavilions (/walk) and the 2D retro street stores (/).
*/
import * as THREE from 'three';
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

function drawGlassSheen(c: CanvasRenderingContext2D, W: number, H: number) {
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

export interface BoardwalkScreenBundle {
  textures: Record<string, THREE.CanvasTexture>;
  update: (
    dt: number,
    stemPlayhead: number,
    muted: Record<'vocals' | 'drums' | 'bass' | 'other', boolean>,
    musicOn: boolean,
    focusId?: 'eat-prey-nap' | 'dopepod' | null,
    mirror?: LeashMirrorState,
    barkPulse?: number,
  ) => void;
}

export function createBoardwalkBoothScreens(opts: {
  catSim: EatPreyNapSim;
  podSim: DopepodSim;
  commits: number;
  mainWalks: number;
  blogTitles?: string[];
}): BoardwalkScreenBundle {
  const makeScreen = (id: string, canvas?: HTMLCanvasElement) => {
    const c = canvas ?? document.createElement('canvas');
    if (!canvas) {
      c.width = 256;
      c.height = 160;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    return { id, canvas: c, ctx: c.getContext('2d')!, tex };
  };

  const leashS = makeScreen('leash');
  const stemmaS = makeScreen('stemma');
  const catS = makeScreen('eat-prey-nap', opts.catSim.canvas);
  const podS = makeScreen('dopepod', opts.podSim.canvas);
  const aboutS = makeScreen('about');
  const blogS = makeScreen('blog');
  const howS = makeScreen('how');

  let t = 0;
  let slot = 0;
  let accum = 0;

  const drawLeash = (mirror?: LeashMirrorState) => {
    const c = leashS.ctx;
    const W = 256, H = 160;
    const active = !!mirror?.active;
    const sky = mirror?.sky ?? 'day';
    c.fillStyle = active && sky === 'night' ? '#172342' : active && sky === 'rain' ? '#8b96a6' : '#d6ccb8';
    c.fillRect(0, 0, W, H);
    // Panot tile grid
    c.strokeStyle = active && sky === 'night' ? 'rgba(130, 160, 220, 0.22)' : 'rgba(120, 108, 88, 0.25)';
    c.lineWidth = 1;
    for (let x = 0; x < W; x += 16) { c.beginPath(); c.moveTo(x, 22); c.lineTo(x, H); c.stroke(); }
    for (let y = 24; y < H; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

    c.fillStyle = '#ffb020';
    c.fillRect(0, 0, W, 22);
    c.fillStyle = '#0b1430';
    c.font = `800 10px 'Bricolage Grotesque', system-ui, sans-serif`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('PATH OF LEASH RESISTANCE', 10, 11);

    if (active && mirror) {
      c.fillStyle = '#0b1430';
      c.fillRect(W - 68, 4, 60, 14);
      c.fillStyle = '#5eea8c';
      c.font = `800 7.5px 'Inter', system-ui, sans-serif`;
      c.textAlign = 'center';
      c.fillText('2D MIRROR', W - 38, 11);
      c.textAlign = 'left';

      const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
      const mapX = (rx: number) => clamp(W * 0.5 + rx * 12, 16, W - 16);
      const mapY = (rz: number) => clamp(88 + (rz - 2.2) * 7.5, 34, H - 14);
      const dogX = mapX(mirror.dx), dogY = mapY(mirror.dz);
      const humanX = mapX(mirror.hx), humanY = mapY(mirror.hz);

      if (!mirror.offLeash) {
        const sag = (1 - clamp(mirror.taut, 0, 1)) * 10;
        c.strokeStyle = '#d9403a';
        c.lineWidth = mirror.taut > 0.65 ? 3.2 : 2.5;
        c.beginPath();
        c.moveTo(humanX, humanY);
        c.quadraticCurveTo((humanX + dogX) / 2, (humanY + dogY) / 2 + sag, dogX, dogY);
        c.stroke();
      }

      // Human (top-down 2D retro style)
      c.fillStyle = 'rgba(20, 15, 10, 0.25)';
      c.beginPath(); c.ellipse(humanX + 2, humanY + 2, 10, 8, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#b85c70';
      c.beginPath(); c.arc(humanX, humanY, 9.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#6b4026';
      c.beginPath(); c.arc(humanX - 1, humanY, 4.8, 0, Math.PI * 2); c.fill();
      if (mirror.humanState === 'phone' || mirror.humanState === 'selfie') {
        c.fillStyle = '#dff5ff';
        c.fillRect(humanX + 5, humanY - 3, 4.5, 6);
      } else if (mirror.humanState === 'whirl' || mirror.humanState === 'stumble') {
        c.fillStyle = '#ffb020';
        for (let k = 0; k < 3; k++) {
          const a = t * 8 + (k * Math.PI * 2) / 3;
          c.fillRect(humanX + Math.cos(a) * 12 - 1.5, humanY + Math.sin(a) * 12 - 1.5, 3, 3);
        }
      }

      // Millie (top-down 2D rotated by heading)
      if (mirror.barkT > 0) {
        const r = 10 + (0.24 - mirror.barkT) * 45;
        c.strokeStyle = 'rgba(255, 176, 32, 0.85)';
        c.lineWidth = 2;
        c.beginPath(); c.arc(dogX, dogY, r, 0, Math.PI * 2); c.stroke();
      }
      c.save();
      c.translate(dogX, dogY);
      c.rotate(mirror.dogHeading);
      const wag = Math.sin(t * (mirror.dogSpeed > 0.3 ? 18 : 7)) * 4;
      c.strokeStyle = '#242124';
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(-8, 0); c.lineTo(-14, wag); c.stroke();
      c.fillStyle = '#242124';
      c.beginPath(); c.ellipse(-1, 0, 8.5, 5, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(7.5, 0, 4.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#6e6a66';
      c.beginPath(); c.ellipse(11, 0, 2.5, 2, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#b82924';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(4, -4); c.lineTo(4, 4); c.stroke();
      c.restore();

      if (mirror.barkT > 0) {
        c.fillStyle = '#ffb020';
        c.fillRect(clamp(dogX - 18, 6, W - 44), clamp(dogY - 22, 24, H - 18), 38, 13);
        c.fillStyle = '#0b1430';
        c.font = `800 8px 'Bricolage Grotesque', system-ui, sans-serif`;
        c.textAlign = 'center';
        c.fillText('WOOF!', clamp(dogX + 1, 25, W - 25), clamp(dogY - 15.5, 30.5, H - 11.5));
        c.textAlign = 'left';
      }
      drawGlassSheen(c, W, H);
      return;
    }

    const cycle = (t * 48) % (W + 120);
    const dogX = cycle - 30;
    const humanX = dogX - 46 + Math.sin(t * 2.5) * 6;
    const dy = 96 + Math.sin(t * 4) * 14;
    const hy = 94;

    // Lamppost
    c.fillStyle = '#2c3850';
    c.fillRect(142, 34, 6, 86);
    c.fillStyle = '#ffe29a';
    c.beginPath();
    c.arc(145, 34, 7, 0, Math.PI * 2);
    c.fill();

    // Taut red leash
    c.strokeStyle = '#d9403a';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(humanX + 8, hy);
    c.quadraticCurveTo((humanX + dogX) / 2, (hy + dy) / 2 + 8, dogX, dy);
    c.stroke();

    // Phone human & Millie
    c.fillStyle = '#1fc9b7';
    c.beginPath();
    c.arc(humanX, hy, 10, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#9be8ff';
    c.fillRect(humanX + 6, hy - 3, 5, 7);

    c.fillStyle = '#0f1014';
    c.beginPath();
    c.arc(dogX, dy, 7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e5487a';
    c.fillRect(dogX - 3, dy - 7, 4, 14);

    c.fillStyle = 'rgba(11, 20, 48, 0.78)';
    c.fillRect(54, H - 18, W - 108, 13);
    c.fillStyle = '#f4f1ea';
    c.font = `700 7.5px 'Inter', system-ui, sans-serif`;
    c.textAlign = 'center';
    c.fillText('WALK PAST TO REFLECT IN 2D', W / 2, H - 11.5);
    c.textAlign = 'left';
    drawGlassSheen(c, W, H);
  };

  const drawStemma = (playhead: number, muted: Record<'vocals' | 'drums' | 'bass' | 'other', boolean>, musicOn: boolean, barkPulse = 0) => {
    const c = stemmaS.ctx;
    const W = 256, H = 160;
    c.fillStyle = '#0e1730';
    c.fillRect(0, 0, W, H);
    if (barkPulse > 0.02) {
      c.fillStyle = `rgba(31, 201, 183, ${0.14 * barkPulse})`;
      c.fillRect(0, 22, W, H - 22);
    }
    c.fillStyle = '#18264c';
    c.fillRect(0, 0, W, 22);
    c.fillStyle = '#1fc9b7';
    c.font = `800 10px 'Bricolage Grotesque', system-ui, sans-serif`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('stemma · 4-stem practice', 10, 11);
    if (barkPulse > 0.02) {
      c.fillStyle = '#5eea8c';
      c.textAlign = 'right';
      c.font = `800 8px 'Inter', system-ui, sans-serif`;
      c.fillText('WOOF MIX!', W - 10, 11);
      c.textAlign = 'left';
    }

    const rows: [keyof typeof muted, string, string][] = [
      ['vocals', 'VOCALS', '#e5487a'],
      ['drums', 'DRUMS', '#ffb020'],
      ['bass', 'BASS', '#1fc9b7'],
      ['other', 'OTHER', '#8bcb3c'],
    ];
    const ph = musicOn ? playhead : (t * 0.08) % 1;
    rows.forEach(([k, lbl, col], ri) => {
      const y = 30 + ri * 31;
      c.fillStyle = muted[k] ? '#6f7996' : col;
      c.font = `700 8px 'Inter', system-ui, sans-serif`;
      c.fillText(lbl, 8, y + 12);
      for (let i = 0; i < 36; i++) {
        const bx = 54 + i * 5.3;
        const amp = muted[k] ? 2 : (3 + Math.abs(Math.sin(i * 0.55 + ri * 1.9 + t * 2.4)) * 10) * (1 + barkPulse * 0.4);
        c.globalAlpha = i / 36 < ph ? 1 : 0.4;
        c.fillRect(bx, y + 12 - amp, 3.5, Math.min(26, amp * 2));
      }
      c.globalAlpha = 1;
    });
    const px = 54 + ph * 190;
    c.fillStyle = '#f4f1ea';
    c.fillRect(px, 26, 2, H - 34);
    drawGlassSheen(c, W, H);
  };

  const drawAbout = () => {
    const c = aboutS.ctx;
    const W = 256, H = 160;
    c.fillStyle = '#20332b';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = '#8bcb3c';
    c.lineWidth = 2;
    c.strokeRect(6, 6, W - 12, H - 12);
    c.fillStyle = '#f4f1ea';
    c.font = `800 13px 'Bricolage Grotesque', system-ui, sans-serif`;
    c.textAlign = 'left';
    c.fillText('Santtu Nykänen', 18, 30);
    c.fillStyle = '#b9dec8';
    c.font = `600 9.5px 'Inter', system-ui, sans-serif`;
    c.fillText('Full-stack developer · Gofore', 18, 50);
    c.fillText('Python · TypeScript · Java · Godot · C++', 18, 68);
    // Coffee mug + animated steam
    c.fillStyle = '#f4f1ea';
    c.fillRect(194, 100, 28, 28);
    c.strokeStyle = '#f4f1ea';
    c.lineWidth = 3;
    c.strokeRect(222, 106, 8, 14);
    c.strokeStyle = 'rgba(244, 241, 234, 0.7)';
    c.lineWidth = 2;
    for (let s = 0; s < 3; s++) {
      const sy = 94 - ((t * 16 + s * 10) % 24);
      c.beginPath();
      c.arc(200 + s * 8 + Math.sin(t * 3 + s) * 2, sy, 2, 0, Math.PI * 2);
      c.stroke();
    }
    drawGlassSheen(c, W, H);
  };

  const drawBlog = () => {
    const c = blogS.ctx;
    const W = 256, H = 160;
    c.fillStyle = '#faf5ea';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#e5487a';
    c.fillRect(0, 0, W, 24);
    c.fillStyle = '#0b1430';
    c.font = `800 10px 'Bricolage Grotesque', system-ui, sans-serif`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('THE ENGINEERING BLOG', 10, 12);
    const headlines = opts.blogTitles?.length
      ? opts.blogTitles.slice(0, 5)
      : [
          'Software before hardware: 128x128 sim',
          'Four months, 42 walks with agents',
          'Python desktop app -> Microsoft Store',
          'No sprites: Godot _draw() batching',
          'ONNX Runtime + DirectML without PyTorch',
        ];
    const hi = Math.floor(t / 2.2) % headlines.length;
    headlines.forEach((h, idx) => {
      const y = 38 + idx * 23;
      const active = idx === hi;
      c.fillStyle = active ? '#e5487a' : '#d5ccb8';
      c.fillRect(10, y - 4, 4, 13);
      c.fillStyle = active ? '#0b1430' : '#4f5770';
      c.font = `${active ? '700' : '500'} 9.5px 'Inter', system-ui, sans-serif`;
      c.fillText(h, 20, y + 2, W - (idx === 0 ? 54 : 28));
      if (idx === 0) {
        c.fillStyle = '#e5487a';
        c.fillRect(W - 36, y - 5, 26, 13);
        c.fillStyle = '#faf5ea';
        c.font = `800 7px 'Inter', system-ui, sans-serif`;
        c.textAlign = 'center';
        c.fillText('NEW', W - 23, y + 1.5);
        c.textAlign = 'left';
      }
    });
    drawGlassSheen(c, W, H);
  };

  const drawHow = () => {
    const c = howS.ctx;
    const W = 256, H = 160;
    c.fillStyle = '#0c152e';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#3d73c7';
    c.fillRect(0, 0, W, 22);
    c.fillStyle = '#f4f1ea';
    c.font = `800 10px 'Bricolage Grotesque', system-ui, sans-serif`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('HOW I BUILD · WORKTREES', 10, 11);

    c.fillStyle = '#ffb020';
    c.font = `800 20px 'Bricolage Grotesque', system-ui, sans-serif`;
    c.fillText(opts.commits.toLocaleString('en-US'), 12, 48);
    c.fillText(String(opts.mainWalks), 140, 48);
    c.fillStyle = '#9db0df';
    c.font = `600 9px 'Inter', system-ui, sans-serif`;
    c.fillText('COMMITS', 12, 66);
    c.fillText('WALKS', 140, 66);

    const pulse = (t * 0.7) % 1;
    c.fillStyle = '#5eea8c';
    c.font = `600 9px ui-monospace, monospace`;
    c.fillText('> git worktree list', 12, 96);
    c.fillText(`  [01] astro check ..... OK`, 12, 114);
    c.fillText(`  [02] shot_diff.py .... ${pulse > 0.5 ? '0 px' : 'RUN '}`, 12, 132);
    drawGlassSheen(c, W, H);
  };

  // Initial paint for static/idling textures.
  drawLeash();
  drawStemma(0.25, { vocals: false, drums: false, bass: false, other: false }, false);
  drawAbout();
  drawBlog();
  drawHow();
  opts.catSim.draw();
  opts.podSim.draw();
  [leashS, stemmaS, catS, podS, aboutS, blogS, howS].forEach((s) => { s.tex.needsUpdate = true; });

  return {
    textures: {
      leash: leashS.tex,
      stemma: stemmaS.tex,
      'eat-prey-nap': catS.tex,
      dopepod: podS.tex,
      about: aboutS.tex,
      blog: blogS.tex,
      how: howS.tex,
    },
    update(dt, stemPlayhead, muted, musicOn, focusId, mirror, barkPulse = 0) {
      t += dt;
      opts.catSim.update(dt);
      opts.podSim.update(dt);
      if (focusId === 'eat-prey-nap') {
        opts.catSim.draw();
        catS.tex.needsUpdate = true;
      } else if (focusId === 'dopepod') {
        opts.podSim.draw();
        podS.tex.needsUpdate = true;
      }
      accum += dt;
      if (mirror?.active && accum >= 0.033) {
        drawLeash(mirror);
        leashS.tex.needsUpdate = true;
      }
      if (barkPulse > 0.02 && accum >= 0.033) {
        drawStemma(stemPlayhead, muted, musicOn, barkPulse);
        stemmaS.tex.needsUpdate = true;
      }
      if (accum < 0.05) return;
      accum = 0;
      slot = (slot + 1) % 7;
      if (slot === 0) {
        if (focusId !== 'eat-prey-nap') {
          opts.catSim.draw();
          catS.tex.needsUpdate = true;
        }
      } else if (slot === 1) {
        if (focusId !== 'dopepod') {
          opts.podSim.draw();
          podS.tex.needsUpdate = true;
        }
      } else if (slot === 2) {
        if (!mirror?.active) {
          drawLeash(mirror);
          leashS.tex.needsUpdate = true;
        }
      } else if (slot === 3) {
        if (barkPulse <= 0.02) {
          drawStemma(stemPlayhead, muted, musicOn, 0);
          stemmaS.tex.needsUpdate = true;
        }
      } else if (slot === 4) {
        drawAbout();
        aboutS.tex.needsUpdate = true;
      } else if (slot === 5) {
        drawBlog();
        blogS.tex.needsUpdate = true;
      } else {
        drawHow();
        howS.tex.needsUpdate = true;
      }
    },
  };
}
