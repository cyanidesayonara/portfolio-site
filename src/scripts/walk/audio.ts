/*
  Sound for the 3D walk: real songs separated into stems by stemma (from
  stemma's own demo set, public/audio/stemma), looped in sync with per-stem
  mutes and level meters, plus effects (recorded samples, see below). Nothing loads or
  plays until the visitor turns sound on.
*/

// Effects: recorded samples in public/audio/sfx (CC0 / public domain, see CREDITS.md
// there), placed around the listener (pan, distance, air absorption) with a little
// random variation; the synthesized versions below play until they load.

/** Sample groups: one of the takes is picked at random (never the same twice running). */
const SAMPLES = {
  bark: ['bark-1', 'bark-2', 'bark-3', 'bark-4', 'bark-5'],
  otherDog: ['dog-other-1', 'dog-other-2', 'dog-other-3', 'dog-other-4'],
  yap: ['yap-1', 'yap-2'],
  sniff: ['sniff'],
  lap: ['lap-1', 'lap-2', 'lap-3', 'lap-4'],
  pant: ['pant'],
  howl: ['howl'],
  whine: ['whine'],
  splash: ['splash-1', 'splash-2', 'splash-3', 'splash-4'],
  gull: ['gull-1', 'gull-2', 'gull-3', 'gull-4'],
  gullCall: ['gull-call'],
  coo: ['coo-1', 'coo-2'],
  honk: ['honk-1', 'honk-2'],
  trainHorn: ['train-horn'],
  bell: ['bell-1', 'bell-2'],
  meow: ['meow'],
  dig: ['dig-1', 'dig-2', 'dig-3'],
  pee: ['pee'],
  flutter: ['flutter-1', 'flutter-2'],
  firework: ['firework-1', 'firework-2', 'firework-3'],
} satisfies Record<string, string[]>;
export type SampleGroup = keyof typeof SAMPLES;

export interface SampleOpts {
  /** World position; omit for sounds at the player (Millie). */
  at?: { x: number; z: number };
  vol?: number;
  /** Playback rate (pitch and speed together); a random +-4 % is added. */
  rate?: number;
  delay?: number;
  /** Distance (m) at which it has dropped to about half volume; loud things carry further. */
  ref?: number;
}

export type StemGroup = 'vocals' | 'drums' | 'bass' | 'other';
export const STEM_GROUPS: StemGroup[] = ['vocals', 'drums', 'bass', 'other'];

export interface SongMeta {
  id: string;
  title: string;
  artist: string;
  credit_as: string | null;
  genre: string;
  licence: string;
  licence_url: string;
  source: string;
  duration: number;
  bpm: number;
  key: string;
  stems: string[];
  peaks: Record<string, number[]>;
}

const groupOf = (stem: string): StemGroup => (stem === 'guitar' || stem === 'piano' ? 'other' : (stem as StemGroup));

interface Playing {
  id: string;
  sources: AudioBufferSourceNode[];
  fades: GainNode[];
  startedAt: number;
  duration: number;
}

export class WalkAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private echoSend!: GainNode;
  private stemGains = new Map<StemGroup, GainNode>();
  private analysers = new Map<StemGroup, AnalyserNode>();
  private buffers = new Map<string, Map<string, AudioBuffer>>();
  private playing: Playing | null = null;
  private loadToken = 0;
  private noise: AudioBuffer | null = null;
  private levelData = new Uint8Array(256);
  songs: SongMeta[] = [];
  songId = 'myxtery';
  muted: Record<StemGroup, boolean> = { vocals: false, drums: false, bass: false, other: false };
  on = false;
  musicOn = true;
  onSongChange: ((s: SongMeta) => void) | null = null;
  private samples = new Map<string, AudioBuffer>();
  private samplesLoading = false;
  private lastTake = new Map<SampleGroup, string>();
  private listener = { x: 0, z: 0, fx: 0, fz: -1 };

  private base: string;

  constructor(base = '/audio/stemma') {
    this.base = base;
  }

  async loadIndex() {
    if (this.songs.length) return this.songs;
    try {
      const res = await fetch(`${this.base}/songs.json`);
      if (!res.ok) return this.songs;
      const data = (await res.json()) as { songs?: unknown } | null;
      this.songs = Array.isArray(data?.songs) ? (data.songs as SongMeta[]) : [];
    } catch {
      this.songs = [];
    }
    return this.songs;
  }

  song() {
    return this.songs.find((s) => s.id === this.songId) ?? this.songs[0];
  }

  enable() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(c.destination);
      this.musicBus = c.createGain();
      this.musicBus.gain.value = 0.55;
      this.musicBus.connect(this.master);
      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = 0.7;
      this.sfxBus.connect(this.master);
      // Echo for the underpass: a feedback delay into a lowpass.
      this.echoSend = c.createGain();
      this.echoSend.gain.value = 0;
      const delay = c.createDelay(1);
      delay.delayTime.value = 0.13;
      const fb = c.createGain();
      fb.gain.value = 0.42;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      this.echoSend.connect(delay);
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      lp.connect(this.master);
      this.sfxBus.connect(this.echoSend);
      for (const g of STEM_GROUPS) {
        const gain = c.createGain();
        gain.gain.value = this.muted[g] ? 0 : 1;
        const an = c.createAnalyser();
        an.fftSize = 256;
        gain.connect(an);
        gain.connect(this.musicBus);
        this.stemGains.set(g, gain);
        this.analysers.set(g, an);
      }
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = n;
    }
    void this.ctx.resume().catch(() => {});
    this.on = true;
    void this.loadSamples();
    void this.loadIndex().then(() => { if (this.musicOn) void this.playSong(this.songId); });
  }

  disable() {
    this.on = false;
    void this.ctx?.suspend().catch(() => {});
  }

  /** Fetch and decode every effect sample once (small mono MP3s, ~200 KB in all). */
  private async loadSamples(sfxBase = '/audio/sfx') {
    if (this.samplesLoading || !this.ctx) return;
    this.samplesLoading = true;
    const c = this.ctx;
    const names = new Set<string>(Object.values(SAMPLES).flat());
    await Promise.all([...names].map(async (n) => {
      try {
        const res = await fetch(`${sfxBase}/${n}.mp3`);
        if (!res.ok) return;
        this.samples.set(n, await c.decodeAudioData(await res.arrayBuffer()));
      } catch { /* keep the synthesized fallback */ }
    }));
  }

  /** Where the ears are: the camera's position and the direction it looks (XZ). */
  setListener(x: number, z: number, fx: number, fz: number) {
    const l = Math.hypot(fx, fz) || 1;
    this.listener.x = x; this.listener.z = z; this.listener.fx = fx / l; this.listener.fz = fz / l;
  }

  /**
    Play a recorded take from a group. Returns false if nothing is loaded yet (the
    caller then synthesizes). Sounds with a position are panned by their bearing
    from the camera, get quieter with distance and lose their highs far away.
  */
  sample(group: SampleGroup, o: SampleOpts = {}): boolean {
    if (!this.ctx || !this.on) return false;
    const takes = SAMPLES[group].filter((n) => this.samples.has(n));
    if (!takes.length) return false;
    const last = this.lastTake.get(group);
    const pool = takes.length > 1 ? takes.filter((n) => n !== last) : takes;
    const name = pool[Math.floor(Math.random() * pool.length)];
    this.lastTake.set(group, name);
    const c = this.ctx, t = c.currentTime + (o.delay ?? 0);
    const src = c.createBufferSource();
    src.buffer = this.samples.get(name)!;
    src.playbackRate.value = (o.rate ?? 1) * (0.96 + Math.random() * 0.08);
    const g = c.createGain();
    let vol = o.vol ?? 1;
    let node: AudioNode = src;
    if (o.at) {
      const dx = o.at.x - this.listener.x, dz = o.at.z - this.listener.z;
      const d = Math.hypot(dx, dz);
      const ref = o.ref ?? 7;
      if (d > ref * 9) return true; // out of earshot: count it as played
      vol *= 1 / (1 + Math.pow(d / ref, 1.4));
      // Bearing relative to where the camera looks: right of it pans right.
      const right = (this.listener.fx * dz - this.listener.fz * dx) / (d || 1);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 16000 / (1 + d / (ref * 1.3));
      node.connect(lp);
      node = lp;
      if (c.createStereoPanner) {
        const pan = c.createStereoPanner();
        pan.pan.value = Math.max(-0.85, Math.min(0.85, right * Math.min(1, d / 4)));
        node.connect(pan);
        node = pan;
      }
    }
    g.gain.value = vol;
    node.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    return true;
  }

  /** Underpass echo amount, 0..1. */
  setEcho(v: number) {
    if (this.echoSend) this.echoSend.gain.value = v * 0.55;
  }

  /** Music muffled (e.g. far inside town) 0..1, 1 = full. */
  setMusicLevel(v: number) {
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(0.55 * v, this.ctx.currentTime, 0.3);
  }

  private async fetchSong(s: SongMeta): Promise<Map<string, AudioBuffer> | null> {
    const cached = this.buffers.get(s.id);
    if (cached) return cached;
    const c = this.ctx;
    if (!c) return null;
    try {
      const entries = await Promise.all(
        s.stems.map(async (st) => {
          const res = await fetch(`${this.base}/${s.id}/${st}.mp3`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = await c.decodeAudioData(await res.arrayBuffer());
          return [st, buf] as const;
        }),
      );
      const map = new Map(entries);
      this.buffers.set(s.id, map);
      return map;
    } catch {
      return null;
    }
  }

  async playSong(id: string): Promise<boolean> {
    if (!this.ctx) return false;
    const s = this.songs.find((x) => x.id === id);
    if (!s || !s.stems.length) return false;
    const token = ++this.loadToken;
    const bufs = await this.fetchSong(s);
    if (!bufs || token !== this.loadToken || !this.ctx || !this.on || !this.musicOn) return false;
    const first = bufs.get(s.stems[0]);
    if (!first) return false;
    this.songId = id;
    const c = this.ctx;
    const now = c.currentTime + 0.05;
    // Each stem fades in and feeds its group's shared gain (guitar and piano
    // count as "other"), so mutes and level meters work per stem group.
    const fades: GainNode[] = [];
    const sources = s.stems.map((st) => {
      const src = c.createBufferSource();
      src.buffer = bufs.get(st)!;
      src.loop = true;
      const fade = c.createGain();
      fade.gain.setValueAtTime(0, now);
      fade.gain.linearRampToValueAtTime(1, now + 1.2);
      src.connect(fade);
      fade.connect(this.stemGains.get(groupOf(st))!);
      fades.push(fade);
      return src;
    });
    sources.forEach((src) => src.start(now));
    this.stopCurrent(now);
    this.playing = { id, sources, fades, startedAt: now, duration: first.duration };
    this.onSongChange?.(s);
    return true;
  }

  private stopCurrent(at: number) {
    const p = this.playing;
    if (!p || !this.ctx) return;
    for (const f of p.fades) {
      f.gain.cancelScheduledValues(at);
      f.gain.setValueAtTime(f.gain.value, at);
      f.gain.linearRampToValueAtTime(0, at + 1.1);
    }
    for (const src of p.sources) {
      try { src.stop(at + 1.2); } catch { /* already stopped */ }
    }
    this.playing = null;
  }

  setMusicOn(on: boolean) {
    this.musicOn = on;
    if (!this.ctx) return;
    if (on) void this.playSong(this.songId);
    else { this.stopCurrent(this.ctx.currentTime); }
  }

  toggleStem(g: StemGroup) {
    this.muted[g] = !this.muted[g];
    const gain = this.stemGains.get(g);
    if (gain && this.ctx) gain.gain.setTargetAtTime(this.muted[g] ? 0 : 1, this.ctx.currentTime, 0.05);
    return this.muted[g];
  }

  /** Playhead 0..1 through the current loop. */
  playhead() {
    if (!this.ctx || !this.playing) return 0;
    const t = this.ctx.currentTime - this.playing.startedAt;
    return t < 0 ? 0 : (t % this.playing.duration) / this.playing.duration;
  }

  /** RMS-ish level 0..1 for a stem group. */
  level(g: StemGroup) {
    const an = this.analysers.get(g);
    if (!an || !this.on || this.muted[g] || !this.playing) return 0;
    an.getByteTimeDomainData(this.levelData);
    let sum = 0;
    for (let i = 0; i < an.fftSize; i++) {
      const v = (this.levelData[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / an.fftSize) * 3.2);
  }

  // ---- Synthesized effects ---------------------------------------------------------
  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.25, glideTo?: number, delay = 0) {
    if (!this.ctx || !this.on) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private hiss(dur: number, freq: number, q: number, vol = 0.2, type: BiquadFilterType = 'bandpass', sweepTo?: number, delay = 0) {
    if (!this.ctx || !this.on || !this.noise) return;
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  bark() {
    if (this.sample('bark', { vol: 0.95 })) return;
    this.tone(420, 0.09, 'sawtooth', 0.22, 260);
    this.hiss(0.1, 900, 2.5, 0.16);
    this.tone(380, 0.08, 'sawtooth', 0.18, 240, 0.13);
    this.hiss(0.09, 850, 2.5, 0.12, 'bandpass', undefined, 0.13);
  }
  /** Another dog's bark: higher for small dogs, placed where that dog is. */
  smallBark(scale = 0.8, at?: { x: number; z: number }) {
    const small = scale < 0.75;
    if (this.sample(small ? 'yap' : 'otherDog', { at, vol: 0.9, rate: small ? 1.05 / Math.max(0.6, scale) : 0.85 / Math.max(0.6, scale) })) return;
    const f = 520 / Math.max(0.5, scale);
    this.tone(f, 0.07, 'sawtooth', 0.12, f * 0.62);
    this.hiss(0.07, f * 2, 2.5, 0.08);
  }
  sniff(at?: { x: number; z: number }) { this.sample('sniff', { at, vol: 0.6 }); }
  /** A few quick breaths after a run. */
  pant() { for (let i = 0; i < 3; i++) this.sample('pant', { vol: 0.42 - i * 0.06, delay: i * 0.36, rate: 1.1 }); }
  whine() { this.sample('whine', { vol: 0.55 }); }
  howl(at?: { x: number; z: number }, delay?: number) { this.sample('howl', { at, vol: 0.8, delay }); }
  /** A palas ball off a wooden bat. */
  pock() { this.tone(900, 0.05, 'triangle', 0.08, 600); this.hiss(0.03, 2500, 2, 0.05, 'bandpass'); }
  jump() { this.tone(300, 0.16, 'square', 0.08, 620); }
  land() { this.hiss(0.08, 300, 1, 0.12, 'lowpass'); }
  pee() {
    if (this.sample('pee', { vol: 0.55 })) return;
    this.hiss(0.7, 2600, 1.2, 0.06, 'bandpass', 1800);
  }
  dig() {
    if (this.sample('dig', { vol: 0.8 })) return;
    for (let i = 0; i < 3; i++) this.hiss(0.08, 500, 1, 0.14, 'lowpass', undefined, i * 0.12);
  }
  pickup() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.14, undefined, i * 0.06)); }
  goal() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.13, undefined, i * 0.07)); }
  click() { this.tone(1800, 0.03, 'square', 0.05); }
  /** Drinking: a few laps from the bowl. */
  slurp() {
    if (this.sample('lap', { vol: 0.8 })) {
      this.sample('lap', { vol: 0.7, delay: 0.32 });
      this.sample('lap', { vol: 0.75, delay: 0.62 });
      return;
    }
    this.tone(500, 0.25, 'sine', 0.1, 260);
  }
  flutter(at?: { x: number; z: number }) {
    if (this.sample('flutter', { at, vol: 0.7, ref: 8 })) return;
    for (let i = 0; i < 6; i++) this.hiss(0.06, 1400 + Math.random() * 600, 3, 0.08, 'bandpass', undefined, i * 0.05);
  }
  gull(at?: { x: number; z: number }) {
    if (this.sample('gull', { at, vol: 0.6, ref: 12 })) { this.sample('gull', { at, vol: 0.5, ref: 12, delay: 0.3 }); return; }
    this.tone(1500, 0.28, 'sawtooth', 0.05, 900); this.tone(1600, 0.22, 'sawtooth', 0.04, 1000, 0.32);
  }
  /** Ambience: a gull's long laughing call somewhere along the shore. */
  gullCall(at: { x: number; z: number }) { this.sample('gullCall', { at, vol: 0.5, ref: 18 }); }
  /** Ambience: pigeons cooing where they're resting. */
  coo(at: { x: number; z: number }) { this.sample('coo', { at, vol: 0.45, ref: 4 }); }
  bell(at?: { x: number; z: number }) {
    if (this.sample('bell', { at, vol: 0.6, ref: 9 })) return;
    this.tone(2300, 0.5, 'sine', 0.1); this.tone(2300, 0.5, 'sine', 0.08, undefined, 0.16);
  }
  hey() { this.tone(330, 0.25, 'sawtooth', 0.06, 280); }
  splash(at?: { x: number; z: number }) {
    if (this.sample('splash', { at, vol: 0.9 })) return;
    this.hiss(0.35, 1200, 0.8, 0.18, 'bandpass', 500);
  }
  stumble() { this.tone(220, 0.3, 'sine', 0.12, 110); this.hiss(0.2, 400, 1, 0.12, 'lowpass'); }
  whoosh(pitch = 1) { this.hiss(0.28, 600 * pitch, 2, 0.12, 'bandpass', 1500 * pitch); }
  fling() { this.whoosh(1.4); this.tone(200, 0.5, 'triangle', 0.12, 700); }
  honk(at?: { x: number; z: number }) {
    if (this.sample('honk', { at, vol: 0.6, ref: 14 })) return;
    this.tone(370, 0.3, 'square', 0.06); this.tone(466, 0.3, 'square', 0.05);
  }
  /** Festive street drumline hit (bass thump + crisp snare rattle), distance-attenuated. */
  drum(at?: { x: number; z: number }) {
    if (!this.ctx || !this.on) return;
    let att = 1;
    if (at) {
      const d = Math.hypot(at.x - this.listener.x, at.z - this.listener.z);
      if (d > 34) return;
      att = 1 / (1 + Math.pow(d / 9, 1.5));
    }
    this.tone(118, 0.14, 'triangle', 0.24 * att, 54);
    this.hiss(0.08, 1600, 1.8, 0.14 * att, 'bandpass');
  }
  /** The commuter train's horn: carries a long way. */
  trainHorn(at?: { x: number; z: number }) {
    if (this.sample('trainHorn', { at, vol: 0.75, ref: 30 })) return;
    this.tone(622, 0.55, 'triangle', 0.09);
    this.tone(784, 0.55, 'triangle', 0.07);
    this.tone(622, 0.9, 'triangle', 0.09, undefined, 0.65);
    this.tone(784, 0.9, 'triangle', 0.07, undefined, 0.65);
  }
  chime() { this.tone(659, 0.5, 'sine', 0.12); this.tone(523, 0.7, 'sine', 0.12, undefined, 0.45); }
  rumble(dur = 3) { this.hiss(dur, 120, 0.7, 0.22, 'lowpass', 80); }
  firework(at?: { x: number; z: number }) {
    if (this.sample('firework', { at, vol: 0.85, ref: 24 })) return;
    this.tone(900, 0.6, 'sine', 0.05, 2400);
    this.hiss(0.7, 300, 0.5, 0.3, 'lowpass', 90, 0.6);
    for (let i = 0; i < 8; i++) this.hiss(0.05, 3000, 2, 0.06, 'highpass', undefined, 0.7 + i * 0.06 + Math.random() * 0.05);
  }
  meow(at?: { x: number; z: number }) {
    if (this.sample('meow', { at, vol: 0.6, ref: 5 })) return;
    this.tone(700, 0.35, 'sawtooth', 0.05, 500);
  }
}
