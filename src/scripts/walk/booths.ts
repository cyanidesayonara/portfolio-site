/*
  Idling booth screens for the 3D boardwalk pavilions (/walk): canvas textures fed by
  the simulators in boothSims.ts (which the 2D street uses without three.js).
*/
import * as THREE from 'three';
import { EatPreyNapSim, DopepodSim, drawGlassSheen, type LeashMirrorState } from './boothSims';

export * from './boothSims';

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
