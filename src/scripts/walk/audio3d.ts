/*
  4-stem interactive Web Audio engine + 3D street sound effects for /walk.
  Splits the Andalusian cadence loop into Lead, Chords, Bass, and Drums stems
  so Millie can walk up to the stemma studio and mute/solo stems live.
*/

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const CHORDS = [
  { bass: 45, notes: [57, 60, 64, 69] }, // Am
  { bass: 43, notes: [55, 59, 62, 67] }, // G
  { bass: 41, notes: [53, 57, 60, 65] }, // F
  { bass: 40, notes: [52, 56, 59, 64] }, // E
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 1];
const TUNE: (number | null)[][] = [
  [76, null, 74, 72, 74, null, 72, 71],
  [74, null, 71, 69, 71, null, 67, null],
  [72, null, 69, 72, 77, 76, 74, 72],
  [71, null, 68, 71, 76, null, null, null],
];
const EIGHTH = 60 / 106 / 2;

export type StemName = 'lead' | 'chords' | 'bass' | 'drums';

export class WalkSound3D {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private stems: Record<StemName, GainNode> | null = null;
  private noise: AudioBuffer | null = null;
  private timer = 0;
  private next = 0;
  private step = 0;
  on = false;

  muted: Record<StemName, boolean> = {
    lead: false,
    chords: false,
    bass: false,
    drums: false,
  };

  private setup() {
    if (this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.58;
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = 0.36;
    this.music.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.72;
    this.sfx.connect(this.master);

    this.stems = {
      lead: ctx.createGain(),
      chords: ctx.createGain(),
      bass: ctx.createGain(),
      drums: ctx.createGain(),
    };
    (Object.keys(this.stems) as StemName[]).forEach((k) => {
      this.stems![k].gain.value = this.muted[k] ? 0 : 1;
      this.stems![k].connect(this.music!);
    });

    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  enable() {
    this.setup();
    this.on = true;
    void this.ctx!.resume();
    this.next = this.ctx!.currentTime + 0.08;
    this.step = 0;
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), 45);
  }

  disable() {
    this.on = false;
    clearInterval(this.timer);
    void this.ctx?.suspend();
  }

  toggleStem(name: StemName): boolean {
    this.muted[name] = !this.muted[name];
    if (this.stems && this.ctx) {
      this.stems[name].gain.setTargetAtTime(this.muted[name] ? 0 : 1, this.ctx.currentTime, 0.02);
    }
    return this.muted[name];
  }

  soloStem(name: StemName) {
    const onlyThis = (Object.keys(this.muted) as StemName[]).every((k) =>
      k === name ? !this.muted[k] : this.muted[k],
    );
    (Object.keys(this.muted) as StemName[]).forEach((k) => {
      this.muted[k] = onlyThis ? false : k !== name;
      if (this.stems && this.ctx) {
        this.stems[k].gain.setTargetAtTime(this.muted[k] ? 0 : 1, this.ctx.currentTime, 0.02);
      }
    });
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.on || !this.stems || ctx.state !== 'running') return;
    while (this.next < ctx.currentTime + 0.24) {
      const bar = Math.floor(this.step / 8) % 8;
      const chord = CHORDS[bar % 4];
      const e = this.step % 8;
      const t = this.next;

      // Bass stem
      if (e === 0 || e === 4) {
        this.tone(midi(chord.bass - 12 + (e === 4 ? 7 : 0)), t, 0.42, 'triangle', 0.34, this.stems.bass);
      }
      if (e % 2 === 1) {
        this.tone(midi(chord.bass), t, 0.18, 'triangle', 0.14, this.stems.bass);
      }

      // Chords stem
      this.tone(midi(chord.notes[ARP[e]]), t, 0.3, 'triangle', 0.12, this.stems.chords, 2600);

      // Lead stem
      const n = bar >= 4 ? TUNE[bar - 4][e] : e === 0 ? chord.notes[3] + 12 : null;
      if (n !== null) {
        this.tone(midi(n), t, 0.34, 'square', bar >= 4 ? 0.06 : 0.035, this.stems.lead, 1900);
      }

      // Drums stem
      if (e === 0 || e === 4) this.tone(110, t, 0.11, 'sine', 0.24, this.stems.drums, 0, 42);
      if (e === 2 || e === 6) this.hiss(t, 0.07, 0.09, 1800, 'bandpass', this.stems.drums);
      if (e % 2 === 1) this.hiss(t, 0.03, 0.055, 7000, 'highpass', this.stems.drums);

      this.next += EIGHTH;
      this.step = (this.step + 1) % 64;
    }
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, out: AudioNode, cutoff = 0, slideTo = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hiss(t: number, dur: number, vol: number, freq: number, type: BiquadFilterType, out: AudioNode) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  private now() {
    return this.ctx && this.on && this.ctx.state === 'running' ? this.ctx.currentTime : -1;
  }

  bark() {
    const t = this.now(); if (t < 0) return;
    this.tone(620, t, 0.11, 'sawtooth', 0.35, this.sfx!, 1800, 260);
    this.hiss(t, 0.08, 0.12, 1200, 'bandpass', this.sfx!);
    this.tone(560, t + 0.13, 0.09, 'sawtooth', 0.25, this.sfx!, 1600, 280);
  }
  jump() {
    const t = this.now(); if (t < 0) return;
    this.tone(240, t, 0.14, 'triangle', 0.18, this.sfx!, 0, 520);
  }
  dig() {
    const t = this.now(); if (t < 0) return;
    this.hiss(t, 0.12, 0.14, 900, 'bandpass', this.sfx!);
    this.tone(180, t + 0.05, 0.08, 'triangle', 0.14, this.sfx!, 0, 120);
  }
  whirl() {
    const t = this.now(); if (t < 0) return;
    [330, 440, 587, 784, 1046].forEach((f, i) =>
      this.tone(f, t + i * 0.055, 0.18, 'sawtooth', 0.12, this.sfx!, 2400),
    );
  }
  dragon() {
    const t = this.now(); if (t < 0) return;
    this.tone(523, t, 0.14, 'triangle', 0.22, this.sfx!);
    this.tone(659, t + 0.09, 0.14, 'triangle', 0.22, this.sfx!);
    this.tone(784, t + 0.18, 0.16, 'triangle', 0.24, this.sfx!);
    this.tone(1046, t + 0.27, 0.34, 'triangle', 0.28, this.sfx!);
  }
  pee() {
    const t = this.now(); if (t < 0) return;
    this.hiss(t, 0.75, 0.05, 3200, 'bandpass', this.sfx!);
  }
  bell() {
    const t = this.now(); if (t < 0) return;
    for (const dt of [0, 0.16]) {
      this.tone(2350, t + dt, 0.32, 'sine', 0.11, this.sfx!);
      this.tone(3120, t + dt, 0.24, 'sine', 0.05, this.sfx!);
    }
  }
  honk() {
    const t = this.now(); if (t < 0) return;
    this.tone(370, t, 0.3, 'square', 0.08, this.sfx!, 1200);
    this.tone(440, t, 0.3, 'square', 0.06, this.sfx!, 1200);
  }
  pickup() {
    const t = this.now(); if (t < 0) return;
    this.tone(880, t, 0.09, 'square', 0.08, this.sfx!, 3000);
    this.tone(1320, t + 0.07, 0.14, 'square', 0.08, this.sfx!, 3000);
  }
  goal() {
    const t = this.now(); if (t < 0) return;
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone(f, t + i * 0.08, 0.25, 'triangle', 0.16, this.sfx!),
    );
  }
  hey() {
    const t = this.now(); if (t < 0) return;
    this.tone(240, t, 0.18, 'square', 0.09, this.sfx!, 1400, 170);
  }
  slurp() {
    const t = this.now(); if (t < 0) return;
    for (let i = 0; i < 3; i++)
      this.tone(420 + i * 60, t + i * 0.09, 0.07, 'sine', 0.1, this.sfx!, 0, 700 + i * 80);
  }
  flutter() {
    const t = this.now(); if (t < 0) return;
    for (let i = 0; i < 6; i++)
      this.hiss(t + i * 0.045, 0.04, 0.05, 2500, 'bandpass', this.sfx!);
  }
}
