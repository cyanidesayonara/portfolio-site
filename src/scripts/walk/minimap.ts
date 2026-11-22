/*
  The minimap: a top-down plan of the level drawn once from the level data,
  with live markers on top. Small in the corner (centered on Millie, sea up,
  like the street camera), or the whole town when enlarged with [M].
*/
import type { Level } from './level';

export interface MapMarker {
  x: number;
  z: number;
  color: string;
  label?: string;
  /** Shorter name for the small map. */
  short?: string;
  kind: 'stop' | 'quest' | 'threat' | 'place' | 'train';
}

const PPM = 4; // plan pixels per meter

const C = {
  track: '#3d3a35', building: '#7d6e60', pavilion: '#5b4a3c', wall: '#4d463e', fence: '#2f6b4f',
};

export class Minimap {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private plan: HTMLCanvasElement;
  private bounds: Level['layout']['mapBounds'];
  private big = false;
  onToggle?: (big: boolean) => void;

  constructor(stage: HTMLElement, level: Level) {
    this.el = document.createElement('div');
    this.el.className = 'minimap';
    this.el.innerHTML = '<canvas role="img" aria-label="Map of the seafront and town"></canvas><span class="mm-key"><kbd>M</kbd> Map</span>';
    stage.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.el.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(); });
    this.bounds = level.layout.mapBounds;
    this.plan = this.drawPlan(level);
  }

  get enlarged() { return this.big; }

  toggle(force?: boolean) {
    this.big = force ?? !this.big;
    this.el.classList.toggle('big', this.big);
    this.onToggle?.(this.big);
  }

  private drawPlan(level: Level) {
    const { x0: X0, x1: X1, z0: Z0, z1: Z1 } = level.layout.mapBounds;
    const cv = document.createElement('canvas');
    cv.width = (X1 - X0) * PPM;
    cv.height = (Z1 - Z0) * PPM;
    const g = cv.getContext('2d')!;
    const R = (x0: number, z0: number, x1: number, z1: number, col: string) => {
      g.fillStyle = col;
      g.fillRect((Math.min(x0, x1) - X0) * PPM, (Math.min(z0, z1) - Z0) * PPM, Math.abs(x1 - x0) * PPM, Math.abs(z1 - z0) * PPM);
    };
    // Zones from the layout data (sea, beach, boardwalk, promenade, rail, Rambla, town, pipicà, underpass, pier).
    for (const z of level.layout.zones) {
      R(z.x0, z.z0, z.x1, z.z1, z.mapColor);
      if (z.id === 'rail') for (const tz of level.layout.tracks) R(X0, tz - 0.4, X1, tz + 0.4, C.track);
    }
    // The swim zone's buoy line.
    const S = level.layout.swim;
    g.fillStyle = '#ff7a2a';
    for (const [x0, z0, x1, z1] of [[S.x0, S.z, S.x1, S.z], [S.x0, S.shoreZ, S.x0, S.z], [S.x1, S.shoreZ, S.x1, S.z]]) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      for (let d = 0; d <= len; d += 2.5) {
        const t = d / len;
        g.beginPath();
        g.arc((x0 + (x1 - x0) * t - X0) * PPM, (z0 + (z1 - z0) * t - Z0) * PPM, 0.5 * PPM, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Buildings, pavilions and landmarks from the layout data.
    for (const d of level.layout.districts) {
      for (const b of d.blocks) R(b.x0, b.z0, b.x1, b.z1, C.building);
      for (const p of d.pavilions) R(p.x - p.w / 2, p.z0, p.x + p.w / 2, p.z1, C.pavilion);
      for (const lm of d.landmarks) R(lm.x0, lm.z0, lm.x1, lm.z1, C.building);
    }
    // Non-building colliders: walls, fences, kiosks and containers.
    for (const b of level.boxes) {
      const col = b.kind === 'wall' ? C.wall
        : b.kind === 'fence' || b.kind === 'rail' ? C.fence
        : b.kind === 'kiosk' || b.kind === 'containers' ? C.wall
        : null;
      if (col) R(b.x0, b.z0, b.x1, b.z1, col);
    }
    // A soft edge so the plan reads as a plan.
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, cv.width - 2, cv.height - 2);
    return cv;
  }

  /** Redraw. `heading` is Millie's heading (radians, world XZ). */
  draw(dog: { x: number; z: number; heading: number }, human: { x: number; z: number }, markers: MapMarker[], camYaw = 0) {
    const { x0: X0, x1: X1, z0: Z0, z1: Z1 } = this.bounds;
    const cv = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (!w || !h) return;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#16233f';
    g.fillRect(0, 0, w, h);

    // World → canvas.
    // The small map turns with the follow camera (what's ahead is up); the big one stays sea-up.
    const yaw = this.big ? 0 : camYaw;
    const cosY = Math.cos(-yaw), sinY = Math.sin(-yaw);
    let scale: number, cx: number, cz: number, sx: number, sy: number;
    if (this.big) {
      scale = Math.min(w / (X1 - X0), h / (Z1 - Z0));
      cx = (X0 + X1) / 2; cz = (Z0 + Z1) / 2; sx = w / 2; sy = h / 2;
    } else {
      scale = w / 64; // 64 m across
      cx = dog.x; cz = dog.z; sx = w / 2; sy = h / 2 + 4 * scale; // a little more of what's ahead
    }
    const tf = (x: number, z: number) => {
      const dx = (x - cx) * scale, dz = (z - cz) * scale;
      return { x: sx + dx * cosY - dz * sinY, y: sy + dx * sinY + dz * cosY };
    };
    g.imageSmoothingEnabled = true;
    g.save();
    g.translate(sx, sy);
    g.rotate(-yaw);
    g.drawImage(this.plan, (X0 - cx) * scale, (Z0 - cz) * scale, (X1 - X0) * scale, (Z1 - Z0) * scale);
    g.restore();
    // Small map: only the nearest couple of pavilions get a name, so labels never pile up.
    const named = new Set<MapMarker>();
    if (!this.big) {
      markers.filter((m) => m.kind === 'stop' && Math.hypot(m.x - dog.x, m.z - dog.z) < 22)
        .sort((a, b) => Math.hypot(a.x - dog.x, a.z - dog.z) - Math.hypot(b.x - dog.x, b.z - dog.z))
        .slice(0, 2).forEach((m) => named.add(m));
    }

    const r = (this.big ? 5 : 4.5) * dpr;
    const font = (size: number) => `800 ${Math.round(size * dpr)}px "Bricolage Grotesque", system-ui, sans-serif`;
    const labels: { x: number; y: number; text: string; color: string }[] = [];

    for (const m of markers) {
      const { x, y } = tf(m.x, m.z);
      if (!this.big && (x < -10 || y < -10 || x > w + 10 || y > h + 10)) {
        // Off the small map: an edge pip for threats and stops so you can head there.
        if (m.kind === 'threat' || m.kind === 'quest') {
          const cx = Math.max(6 * dpr, Math.min(w - 6 * dpr, x)), cy = Math.max(6 * dpr, Math.min(h - 6 * dpr, y));
          g.fillStyle = m.color;
          g.beginPath(); g.arc(cx, cy, 3 * dpr, 0, Math.PI * 2); g.fill();
        }
        continue;
      }
      g.lineWidth = 1.5 * dpr;
      g.strokeStyle = '#0b1430';
      g.fillStyle = m.color;
      if (m.kind === 'train') {
        g.save(); g.translate(x, y); g.rotate(-yaw);
        g.fillRect(-30 * scale, -1.6 * scale, 60 * scale, 3.2 * scale);
        g.strokeRect(-30 * scale, -1.6 * scale, 60 * scale, 3.2 * scale);
        g.restore();
      } else if (m.kind === 'quest') {
        // A "!" lozenge.
        g.beginPath();
        g.moveTo(x, y - r * 1.4); g.lineTo(x + r, y); g.lineTo(x, y + r * 1.4); g.lineTo(x - r, y); g.closePath();
        g.fill(); g.stroke();
        g.fillStyle = '#0b1430';
        g.font = font(this.big ? 10 : 9);
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('!', x, y + 0.5 * dpr);
      } else if (m.kind === 'threat') {
        g.beginPath(); g.arc(x, y, r * 1.1, 0, Math.PI * 2); g.fill(); g.stroke();
        g.strokeStyle = m.color; g.globalAlpha = 0.45;
        g.beginPath(); g.arc(x, y, r * 2, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 1;
      } else {
        g.beginPath(); g.arc(x, y, m.kind === 'stop' ? r : r * 0.8, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      if (m.label && (this.big || named.has(m))) labels.push({ x, y, text: this.big ? m.label : m.short ?? m.label, color: m.color });
    }

    // Millie and her human.
    const hp = tf(human.x, human.z), hx = hp.x, hz = hp.y;
    g.fillStyle = '#f4f1ea'; g.strokeStyle = '#0b1430'; g.lineWidth = 1.5 * dpr;
    g.beginPath(); g.arc(hx, hz, r * 0.7, 0, Math.PI * 2); g.fill(); g.stroke();
    const dp = tf(dog.x, dog.z);
    g.save();
    g.translate(dp.x, dp.y);
    g.rotate(dog.heading - yaw);
    const s = r * 1.5;
    g.beginPath();
    g.moveTo(s * 1.2, 0); g.lineTo(-s * 0.8, s * 0.75); g.lineTo(-s * 0.35, 0); g.lineTo(-s * 0.8, -s * 0.75); g.closePath();
    g.fillStyle = '#ffb020'; g.fill(); g.stroke();
    g.restore();

    // Labels last, on top, nudged apart.
    if (labels.length) {
      g.font = font(this.big ? 12 : 9.5);
      g.textAlign = 'left'; g.textBaseline = 'middle';
      const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
      // Each label tries right, left, above and below its marker; if all collide it's skipped.
      const hit = (b: { x0: number; y0: number; x1: number; y1: number }) => placed.some((p) => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0);
      for (const l of labels) {
        const tw = g.measureText(l.text).width, th = (this.big ? 15 : 12) * dpr, gap = r + 3 * dpr;
        const spots = [
          { x: l.x + gap, y: l.y }, { x: l.x - gap - tw, y: l.y },
          { x: l.x - tw / 2, y: l.y - th }, { x: l.x - tw / 2, y: l.y + th },
        ].map((p) => ({ x: Math.max(2 * dpr, Math.min(w - tw - 2 * dpr, p.x)), y: Math.max(th / 2, Math.min(h - th / 2, p.y)) }));
        const spot = spots.find((p) => !hit({ x0: p.x - 2, y0: p.y - th / 2, x1: p.x + tw + 2, y1: p.y + th / 2 }));
        if (!spot) continue;
        const x = spot.x, y = spot.y;
        placed.push({ x0: x - 2, y0: y - th / 2, x1: x + tw + 2, y1: y + th / 2 });
        g.lineWidth = 3.5 * dpr; g.strokeStyle = 'rgba(11,20,48,0.9)';
        g.strokeText(l.text, x, y);
        g.fillStyle = '#f4f1ea';
        g.fillText(l.text, x, y);
      }
    }
  }
}
