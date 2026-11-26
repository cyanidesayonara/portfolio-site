import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WalkAudio, type SongMeta } from '../src/scripts/walk/audio.ts';

interface FakeSource {
  buffer: unknown;
  loop: boolean;
  playbackRate: { value: number };
  started: boolean;
  stopped: boolean;
  connect: () => void;
  start: () => void;
  stop: () => void;
}

class FakeAudioContext {
  sampleRate = 44100;
  currentTime = 0;
  destination = {};
  sources: FakeSource[] = [];
  shouldRejectDecode = false;
  shouldRejectResume = false;
  shouldRejectSuspend = false;

  private makeParam() {
    return {
      value: 1,
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      setTargetAtTime() {},
      cancelScheduledValues() {},
    };
  }

  createGain() {
    return { gain: this.makeParam(), connect() {} };
  }

  createDelay() {
    return { delayTime: this.makeParam(), connect() {} };
  }

  createBiquadFilter() {
    return { type: 'lowpass', frequency: this.makeParam(), Q: this.makeParam(), connect() {} };
  }

  createAnalyser() {
    return { fftSize: 256, connect() {}, getByteTimeDomainData() {} };
  }

  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }

  createBufferSource() {
    const src: FakeSource = {
      buffer: null,
      loop: false,
      playbackRate: { value: 1 },
      started: false,
      stopped: false,
      connect() {},
      start: () => {
        src.started = true;
      },
      stop: () => {
        src.stopped = true;
      },
    };
    this.sources.push(src);
    return src;
  }

  async decodeAudioData() {
    if (this.shouldRejectDecode) throw new DOMException('Unable to decode audio data', 'EncodingError');
    return { duration: 120 };
  }

  async resume() {
    if (this.shouldRejectResume) throw new Error('resume blocked');
  }

  async suspend() {
    if (this.shouldRejectSuspend) throw new Error('suspend blocked');
  }
}

const makeSong = (id: string, stems = ['vocals', 'drums']): SongMeta => ({
  id,
  title: `Title ${id}`,
  artist: 'Artist',
  credit_as: null,
  genre: 'Indie',
  licence: 'CC0',
  licence_url: 'https://example.com/cc0',
  source: 'https://example.com/src',
  duration: 120,
  bpm: 120,
  key: 'C',
  stems,
  peaks: {},
});

let origFetch: typeof globalThis.fetch;
let origWindow: unknown;
let hadWindow = false;
let fakeCtx: FakeAudioContext;

function installFakeWindow() {
  fakeCtx = new FakeAudioContext();
  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: function FakeAudioContextCtor() {
      return fakeCtx;
    },
  };
}

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 25));

describe('WalkAudio offline and error handling', () => {
  beforeEach(() => {
    origFetch = globalThis.fetch;
    hadWindow = 'window' in globalThis;
    origWindow = (globalThis as Record<string, unknown>).window;
    installFakeWindow();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    if (hadWindow) {
      (globalThis as Record<string, unknown>).window = origWindow;
    } else {
      delete (globalThis as Record<string, unknown>).window;
    }
  });

  it('loadIndex falls back quietly to [] when fetch rejects or returns !res.ok', async () => {
    const audio = new WalkAudio('/audio/stemma');

    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    assert.deepEqual(await audio.loadIndex(), []);

    globalThis.fetch = async () => new Response('Server error', { status: 500 });
    assert.deepEqual(await audio.loadIndex(), []);
  });

  it('playSong catches offline fetch rejection, does not cache, and leaves active playback intact', async () => {
    const songA = makeSong('song-a');
    const songB = makeSong('song-b');
    const audio = new WalkAudio('/audio/stemma');
    const changes: string[] = [];
    audio.onSongChange = (s) => changes.push(s.id);

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/songs.json')) {
        return new Response(JSON.stringify({ songs: [songA, songB] }), { status: 200 });
      }
      if (url.includes('/song-a/')) {
        return new Response(new Uint8Array(8), { status: 200 });
      }
      throw new TypeError('Failed to fetch');
    };

    audio.musicOn = false;
    audio.enable();
    await audio.loadIndex();
    audio.musicOn = true;

    const okA = await audio.playSong('song-a');
    assert.equal(okA, true);
    assert.equal(audio.songId, 'song-a');
    assert.deepEqual(changes, ['song-a']);
    const sourcesBeforeFail = fakeCtx.sources.length;
    assert.equal(sourcesBeforeFail, 2);

    let songBFetchCount = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('/song-b/')) songBFetchCount++;
      throw new TypeError('Failed to fetch');
    };

    const okB = await audio.playSong('song-b');
    assert.equal(okB, false);
    assert.equal(audio.songId, 'song-a');
    assert.deepEqual(changes, ['song-a']);
    assert.equal(fakeCtx.sources.length, sourcesBeforeFail);
    assert.equal(fakeCtx.sources.some((s) => s.stopped), false);
    assert.ok(songBFetchCount > 0);

    // Failed fetch must not be cached: retrying once back online fetches and plays song-b.
    let retryFetchCount = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('/song-b/')) retryFetchCount++;
      return new Response(new Uint8Array(8), { status: 200 });
    };

    const retryOk = await audio.playSong('song-b');
    assert.equal(retryOk, true);
    assert.equal(audio.songId, 'song-b');
    assert.equal(retryFetchCount, 2);
    assert.deepEqual(changes, ['song-a', 'song-b']);
  });

  it('playSong handles HTTP errors and decodeAudioData failures quietly and recovers later', async () => {
    const song = makeSong('song-err');
    const audio = new WalkAudio('/audio/stemma');

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/songs.json')) {
        return new Response(JSON.stringify({ songs: [song] }), { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    };

    audio.musicOn = false;
    audio.enable();
    await audio.loadIndex();
    audio.musicOn = true;

    assert.equal(await audio.playSong('song-err'), false);

    // HTTP 200 but invalid/corrupt audio decode fails.
    globalThis.fetch = async () => new Response(new Uint8Array(8), { status: 200 });
    fakeCtx.shouldRejectDecode = true;
    assert.equal(await audio.playSong('song-err'), false);

    // Recovery once decode succeeds.
    fakeCtx.shouldRejectDecode = false;
    assert.equal(await audio.playSong('song-err'), true);
  });

  it('playSong aborts quietly if setMusicOn(false) is called while stems are fetching', async () => {
    const song = makeSong('song-abort');
    const audio = new WalkAudio('/audio/stemma');

    let resolveStem!: (res: Response) => void;
    const pendingStem = new Promise<Response>((resolve) => {
      resolveStem = resolve;
    });

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/songs.json')) {
        return new Response(JSON.stringify({ songs: [song] }), { status: 200 });
      }
      return pendingStem;
    };

    audio.musicOn = false;
    audio.enable();
    await audio.loadIndex();
    audio.musicOn = true;

    const playPromise = audio.playSong('song-abort');
    audio.setMusicOn(false);
    resolveStem(new Response(new Uint8Array(8), { status: 200 }));

    const played = await playPromise;
    assert.equal(played, false);
    assert.equal(fakeCtx.sources.length, 0);
  });

  it('enable and disable with offline fetch produce zero unhandledRejection events', async () => {
    const song = makeSong('makes-shift-salvation');
    const audio = new WalkAudio('/audio/stemma');
    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      globalThis.fetch = async (input) => {
        const url = String(input);
        if (url.endsWith('/songs.json')) {
          return new Response(JSON.stringify({ songs: [song] }), { status: 200 });
        }
        throw new TypeError('Failed to fetch');
      };

      audio.enable();
      fakeCtx.shouldRejectResume = true;
      fakeCtx.shouldRejectSuspend = true;
      audio.enable();
      audio.disable();
      await flushMicrotasks();

      assert.deepEqual(rejections, []);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
