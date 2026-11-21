/*
  Music and sound for the street, synthesized with Web Audio like Path of
  Leash Resistance's own soundtrack: no audio files to download.

  Sound is off until the visitor turns it on (and browsers only allow an
  AudioContext after a gesture anyway). The music is a light loop over the
  Andalusian cadence (Am, G, F, E): plucked arpeggios, a walking bass and
  soft hats.
*/

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const CHORDS = [
  { bass: 45, notes: [57, 60, 64, 69] }, // Am
  { bass: 43, notes: [55, 59, 62, 67] }, // G
  { bass: 41, notes: [53, 57, 60, 65] }, // F
  { bass: 40, notes: [52, 56, 59, 64] }, // E
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 1];
// A short melody over the second time round, in eighths (null = rest).
const TUNE: (number | null)[][] = [
  [76, null, 74, 72, 74, null, 72, 71],
  [74, null, 71, 69, 71, null, 67, null],
  [72, null, 69, 72, 77, 76, 74, 72],
  [71, null, 68, 71, 76, null, null, null],
];
const BPM = 104;
const EIGHTH = 60 / BPM / 2;

export class StreetSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer = 0;
  private next = 0;
  private step = 0;
  on = false;

  private setup() {
    if (this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = 0.32;
    this.music.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.7;
    this.sfx.connect(this.master);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  enable() {
    this.setup();
    this.on = true;
    void this.ctx!.resume();
    this.next = this.ctx!.currentTime + 0.1;
    this.step = 0;
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  disable() {
    this.on = false;
    clearInterval(this.timer);
    void this.ctx?.suspend();
  }

  pause() {
    if (this.on) void this.ctx?.suspend();
  }

  resume() {
    if (this.on && this.ctx) {
      void this.ctx.resume();
      this.next = Math.max(this.next, this.ctx.currentTime + 0.05);
    }
  }

  // ---- Music ---------------------------------------------------------------------
  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.on || ctx.state !== 'running') return;
    while (this.next < ctx.currentTime + 0.25) {
      const bar = Math.floor(this.step / 8) % 8;
      const chord = CHORDS[bar % 4];
      const e = this.step % 8;
      const t = this.next;
      if (e === 0 || e === 4) this.tone(midi(chord.bass - 12 + (e === 4 ? 7 : 0)), t, 0.42, 'triangle', 0.32, this.music!);
      if (e % 2 === 1) this.tone(midi(chord.bass), t, 0.18, 'triangle', 0.12, this.music!);
      this.tone(midi(chord.notes[ARP[e]]), t, 0.3, 'triangle', 0.1, this.music!, 2600);
      if (bar >= 4) {
        const n = TUNE[bar - 4][e];
        if (n !== null) this.tone(midi(n), t, 0.34, 'square', 0.05, this.music!, 1800);
      }
      if (e % 2 === 1) this.hiss(t, 0.03, 0.05, 7000, 'highpass', this.music!);
      this.next += EIGHTH;
      this.step = (this.step + 1) % 64;
    }
  }

  // ---- Building blocks -----------------------------------------------------------------
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

  // ---- Effects --------------------------------------------------------------------------
  bark() {
    const t = this.now();
    if (t < 0) return;
    this.tone(620, t, 0.11, 'sawtooth', 0.35, this.sfx!, 1800, 260);
    this.hiss(t, 0.08, 0.12, 1200, 'bandpass', this.sfx!);
    this.tone(560, t + 0.13, 0.09, 'sawtooth', 0.25, this.sfx!, 1600, 280);
  }
  pee() {
    const t = this.now();
    if (t < 0) return;
    this.hiss(t, 0.8, 0.05, 3200, 'bandpass', this.sfx!);
  }
  bell() {
    const t = this.now();
    if (t < 0) return;
    for (const dt of [0, 0.17]) {
      this.tone(2350, t + dt, 0.35, 'sine', 0.12, this.sfx!);
      this.tone(3120, t + dt, 0.25, 'sine', 0.05, this.sfx!);
    }
  }
  honk() {
    const t = this.now();
    if (t < 0) return;
    this.tone(370, t, 0.32, 'square', 0.09, this.sfx!, 1200);
    this.tone(440, t, 0.32, 'square', 0.07, this.sfx!, 1200);
  }
  pickup() {
    const t = this.now();
    if (t < 0) return;
    this.tone(880, t, 0.09, 'square', 0.08, this.sfx!, 3000);
    this.tone(1320, t + 0.07, 0.14, 'square', 0.08, this.sfx!, 3000);
  }
  goal() {
    const t = this.now();
    if (t < 0) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.08, 0.25, 'triangle', 0.16, this.sfx!));
  }
  hey() {
    const t = this.now();
    if (t < 0) return;
    this.tone(240, t, 0.18, 'square', 0.1, this.sfx!, 1400, 170);
  }
  slurp() {
    const t = this.now();
    if (t < 0) return;
    for (let i = 0; i < 3; i++) this.tone(420 + i * 60, t + i * 0.09, 0.07, 'sine', 0.1, this.sfx!, 0, 700 + i * 80);
  }
  flutter() {
    const t = this.now();
    if (t < 0) return;
    for (let i = 0; i < 6; i++) this.hiss(t + i * 0.045, 0.04, 0.05, 2500, 'bandpass', this.sfx!);
  }
}
