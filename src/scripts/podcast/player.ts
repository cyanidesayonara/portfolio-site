/*
  The dopepod booths' player: one plain <audio> element, shared by the 2D street
  and the 3D walk. Plain on purpose: many publishers send no CORS headers, so
  crossOrigin or Web Audio routing would make episodes fail or go silent.

  The element only has a source between play() and stop(), so nothing (a media
  key, the back/forward cache) can start it again once a booth has let go of it.
*/
import { deepLink, fetchFeed, type PodEpisode, type PodShow } from './feed';

export type FeedStatus = 'idle' | 'loading' | 'ready' | 'failed';
export type PlayStatus = 'stopped' | 'loading' | 'playing' | 'paused' | 'error';

// By position: the feed has no colors.
const ACCENTS = ['#e5487a', '#5eea8c', '#1fc9b7', '#f0c44d', '#ff8a5c', '#8fb4ff', '#c79bff', '#8bcb3c'];
const LOAD_TIMEOUT_MS = 20000;

export class PodcastPlayer {
  feed: FeedStatus = 'idle';
  status: PlayStatus = 'stopped';
  shows: PodShow[] = [];
  showIdx = 0;
  epIdx = 0;
  onChange: () => void = () => {};
  private el: HTMLAudioElement | null = null;
  private at = 0;
  private volume = 1;
  private watchdog = 0;

  constructor() {
    window.addEventListener('pagehide', () => this.stop());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.stop();
    });
  }

  get show(): PodShow | undefined {
    return this.shows[this.showIdx];
  }
  get episode(): PodEpisode | undefined {
    return this.show?.episodes[this.epIdx];
  }
  get accent() {
    return ACCENTS[this.showIdx % ACCENTS.length];
  }
  get link() {
    return deepLink(this.show, this.episode);
  }
  /** Playing, or about to. */
  get active() {
    return this.status === 'playing' || this.status === 'loading';
  }
  get time() {
    return this.el && this.el.readyState > 0 ? this.el.currentTime : this.at;
  }
  get duration(): number | null {
    const d = this.el?.duration;
    return d && Number.isFinite(d) ? d : (this.episode?.duration ?? null);
  }
  get progress() {
    const d = this.duration;
    return d ? Math.min(1, this.time / d) : 0;
  }

  /** Load the list, the first time a booth opens (or again after a failure). */
  async open() {
    if (this.feed === 'loading' || this.feed === 'ready') return;
    this.feed = 'loading';
    this.onChange();
    try {
      this.shows = await fetchFeed();
      this.showIdx = this.epIdx = 0;
      this.feed = 'ready';
    } catch {
      this.feed = 'failed';
    }
    this.onChange();
  }

  play() {
    const ep = this.episode;
    if (!ep || this.active) return;
    if (!this.el) this.load(ep);
    const el = this.el!;
    this.set('loading');
    el.play().catch((err: unknown) => {
      const name = err instanceof DOMException ? err.name : '';
      // Superseded by a stop, a pause or another episode: not ours to report.
      if (this.el !== el || name === 'AbortError') return;
      if (name === 'NotAllowedError') this.set('paused');
      else this.fail();
    });
  }

  pause() {
    if (!this.active) return;
    this.el?.pause();
    this.set('paused');
  }

  toggle() {
    if (this.active) this.pause();
    else this.play();
  }

  /** Silence for good: lets go of the stream but remembers the place. */
  stop() {
    if (this.status === 'stopped') return;
    this.at = this.time;
    this.unload();
    this.set('stopped');
  }

  seek(sec: number) {
    const d = this.duration;
    this.at = Math.max(0, d ? Math.min(sec, Math.max(0, d - 1)) : sec);
    if (this.el && this.el.readyState > 0) this.el.currentTime = this.at;
    this.onChange();
  }

  selectShow(i: number) {
    if (this.shows[i] && i !== this.showIdx) this.go(i, 0);
  }

  next() {
    if (!this.show) return;
    if (this.epIdx + 1 < this.show.episodes.length) this.go(this.showIdx, this.epIdx + 1);
    else this.go((this.showIdx + 1) % this.shows.length, 0);
  }

  prev() {
    if (!this.show) return;
    if (this.epIdx > 0) {
      this.go(this.showIdx, this.epIdx - 1);
      return;
    }
    const s = (this.showIdx - 1 + this.shows.length) % this.shows.length;
    this.go(s, this.shows[s].episodes.length - 1);
  }

  /** 0..1. iOS ignores it (its volume is hardware only), so callers also stop at a distance. */
  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.el) this.el.volume = this.volume;
  }

  private go(showIdx: number, epIdx: number) {
    const keepPlaying = this.active;
    this.unload();
    this.showIdx = showIdx;
    this.epIdx = epIdx;
    this.at = 0;
    this.set('stopped');
    if (keepPlaying) this.play();
  }

  private load(ep: PodEpisode) {
    const el = new Audio();
    this.el = el;
    el.preload = 'none';
    el.volume = this.volume;
    const on = (type: string, fn: () => void) =>
      el.addEventListener(type, () => {
        if (this.el === el) fn();
      });
    on('loadedmetadata', () => {
      if (this.at > 0) el.currentTime = this.at;
      this.onChange();
    });
    on('playing', () => this.set('playing'));
    on('waiting', () => {
      if (!el.paused) this.set('loading');
    });
    on('pause', () => {
      if (this.active && !el.ended) this.set('paused');
    });
    on('timeupdate', () => this.onChange());
    on('error', () => this.fail());
    on('ended', () => {
      // Carry on with the same show, then rest.
      const more = !!this.show && this.epIdx + 1 < this.show.episodes.length;
      this.unload();
      this.at = 0;
      if (more) this.epIdx++;
      this.set('stopped');
      if (more) this.play();
    });
    el.src = ep.audio;
  }

  private unload() {
    const el = this.el;
    this.el = null;
    clearTimeout(this.watchdog);
    if (!el) return;
    el.pause();
    el.removeAttribute('src');
    el.load();
  }

  private fail() {
    this.at = this.time;
    this.unload();
    this.set('error');
  }

  private set(s: PlayStatus) {
    this.status = s;
    clearTimeout(this.watchdog);
    if (s === 'loading') this.watchdog = window.setTimeout(() => this.fail(), LOAD_TIMEOUT_MS);
    this.onChange();
  }
}
