/*
  Interactive boardwalk pavilion UI panels: Coriolis LED wall,
  Eat Prey Nap pouncer, dopepod podcast player, and stemma 4-stem jukebox.
*/
import { CoriolisSimulator, type SimKey, type SimCommand } from '../coriolis/sim';
import { WalkAudio, STEM_GROUPS, type StemGroup, type SongMeta } from './audio';
import { Hud } from './hud';
import { EatPreyNapSim, DopepodSim, CAT_PALETTES, CAT_SIZES } from './booths';

export type BoothKind = 'coriolis' | 'stemma' | 'cat' | 'pod';

export interface BoothPanelsOpts {
  root: HTMLElement;
  host: HTMLElement;
  hud: Hud;
  audio: WalkAudio;
  coriolis: CoriolisSimulator;
  catSim: EatPreyNapSim;
  podSim: DopepodSim;
  completeGoal: (id: string) => void;
  setSound: (on: boolean) => void;
  onCatPounce: () => void;
  getTimeMs: () => number;
}

/** Wires DOM controls and panel open/focus state for all four boardwalk booths. */
export function createBoothPanels(opts: BoothPanelsOpts) {
  const { root, host, hud, audio, coriolis, catSim, podSim, completeGoal, setSound } = opts;
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s);

  let coriolisFocus = false;
  let stemmaOpen = false;
  let catFocus = false;
  let podOpen = false;

  const catPanel = q<HTMLElement>('[data-cat-panel]');
  const podPanel = q<HTMLElement>('[data-pod-panel]');
  const stemmaPanel = q<HTMLElement>('[data-stemma-panel]');
  const songList = q<HTMLElement>('[data-song-list]');
  const lanesCanvas = q<HTMLCanvasElement>('[data-stem-lanes]');
  const creditEl = q<HTMLElement>('[data-song-credit]');

  const anyOpen = () => coriolisFocus || stemmaOpen || catFocus || podOpen;
  const syncPanels = () => {
    root.classList.toggle('panel-open', anyOpen());
    q('[data-coriolis-panel]')?.classList.toggle('open', coriolisFocus);
    stemmaPanel?.classList.toggle('open', stemmaOpen);
    catPanel?.classList.toggle('open', catFocus);
    podPanel?.classList.toggle('open', podOpen);
  };

  const closeOtherBooths = (keep?: BoothKind) => {
    if (keep !== 'coriolis' && coriolisFocus) {
      coriolisFocus = false;
      coriolis.clearHeld();
    }
    if (keep !== 'stemma') stemmaOpen = false;
    if (keep !== 'cat') catFocus = false;
    if (keep !== 'pod') podOpen = false;
  };

  const toggleCoriolis = () => {
    coriolisFocus = !coriolisFocus;
    coriolis.clearHeld();
    if (coriolisFocus) {
      closeOtherBooths('coriolis');
      completeGoal('coriolis');
    }
    syncPanels();
  };

  q('[data-c-exit]')?.addEventListener('click', () => {
    if (coriolisFocus) toggleCoriolis();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-c-key]').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.cKey as SimKey;
      coriolis.setHeld(k, true);
      coriolis.key(k, opts.getTimeMs());
      setTimeout(() => coriolis.setHeld(k, false), 120);
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-c-cmd]').forEach((b) =>
    b.addEventListener('click', () => {
      coriolis.command(b.dataset.cCmd as SimCommand, opts.getTimeMs());
    }),
  );

  // Eat Prey Nap panel
  const catScoreEl = q<HTMLElement>('[data-cat-score]');
  const catPalLabel = q<HTMLElement>('[data-cat-pal-label]');
  const catSizeLabel = q<HTMLElement>('[data-cat-size-label]');
  const catWatchBtn = q<HTMLButtonElement>('[data-cat-watch]');
  let catToastDone = false;

  const syncCatUi = () => {
    const st = catSim.getMouseState();
    if (catPalLabel) catPalLabel.textContent = CAT_PALETTES[st.palette].name;
    if (catSizeLabel) catSizeLabel.textContent = CAT_SIZES[st.size].label;
    if (catScoreEl) catScoreEl.textContent = `${st.catches}`;
    catWatchBtn?.setAttribute('aria-pressed', String(st.watchOnly));
  };

  const setCat = (open: boolean) => {
    catFocus = open;
    if (open) {
      closeOtherBooths('cat');
      syncCatUi();
      if (!catToastDone) {
        catToastDone = true;
        hud.toast('Eat Prey Nap', 'Tap or click the booth screen to pounce at the mouse.', '#f0c44d');
      }
    }
    syncPanels();
  };

  const triggerCatPounce = (u: number, v: number) => {
    const res = catSim.pawAt(u, v, false);
    if (res === 'catch') {
      audio.chime();
      hud.shout('CAUGHT!', 'good');
      opts.onCatPounce();
    } else if (res === 'pin') {
      audio.click();
      hud.shout('PINNED!', 'plain');
    } else {
      audio.click();
    }
    syncCatUi();
    return res;
  };

  q('[data-cat-close]')?.addEventListener('click', () => setCat(false));
  q('[data-cat-palette]')?.addEventListener('click', () => {
    catSim.cyclePalette();
    audio.click();
    syncCatUi();
  });
  q('[data-cat-size]')?.addEventListener('click', () => {
    catSim.cycleSize();
    audio.click();
    syncCatUi();
  });
  q('[data-cat-watch]')?.addEventListener('click', () => {
    catSim.toggleWatchOnly();
    audio.click();
    syncCatUi();
  });
  q('[data-cat-pounce]')?.addEventListener('click', () => {
    const ms = catSim.getMouseState();
    triggerCatPounce(ms.u, ms.v);
  });

  // dopepod panel
  const podNowEl = q<HTMLElement>('[data-pod-now]');
  const podPlayBtn = q<HTMLButtonElement>('[data-pod-play]');
  let podToastDone = false;

  const syncPodUi = () => {
    const st = podSim.getState();
    if (podNowEl) podNowEl.textContent = `${st.showName} · ${st.episodeTitle}`;
    if (podPlayBtn) {
      podPlayBtn.setAttribute('aria-pressed', String(st.playing));
      podPlayBtn.textContent = st.playing ? 'Pause' : 'Play';
    }
    root.querySelectorAll<HTMLButtonElement>('[data-pod-show]').forEach((b) => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.podShow) === st.showIdx));
    });
  };

  const setPod = (open: boolean) => {
    podOpen = open;
    if (open) {
      closeOtherBooths('pod');
      syncPodUi();
      if (!podToastDone) {
        podToastDone = true;
        hud.toast('dopepod', 'Switch podcasts or scrub episodes from the booth.', '#d94ca6');
      }
    }
    syncPanels();
  };

  q('[data-pod-close]')?.addEventListener('click', () => setPod(false));
  podPlayBtn?.addEventListener('click', () => {
    podSim.togglePlay();
    audio.click();
    syncPodUi();
  });
  q('[data-pod-prev]')?.addEventListener('click', () => {
    podSim.prevEpisode();
    audio.click();
    syncPodUi();
  });
  q('[data-pod-next]')?.addEventListener('click', () => {
    podSim.nextEpisode();
    audio.click();
    syncPodUi();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-pod-show]').forEach((b) =>
    b.addEventListener('click', () => {
      podSim.selectShow(Number(b.dataset.podShow ?? 0));
      audio.click();
      syncPodUi();
    }),
  );

  // stemma jukebox panel
  const renderSongs = () => {
    if (!songList) return;
    songList.innerHTML = audio.songs
      .map(
        (s) =>
          `<li><button type="button" data-song="${s.id}" aria-pressed="${s.id === audio.songId}"><b>${s.title}</b><span>${s.credit_as ?? s.artist}</span></button></li>`,
      )
      .join('');
    songList.querySelectorAll<HTMLButtonElement>('[data-song]').forEach((b) => {
      b.addEventListener('click', () => {
        if (!audio.on) setSound(true);
        void audio.playSong(b.dataset.song!);
        completeGoal('stemma');
      });
    });
  };

  const renderCredit = (s: SongMeta | undefined) => {
    if (!creditEl || !s) return;
    const who = s.credit_as ?? s.artist;
    creditEl.innerHTML = `“${s.title}” by ${who}. <a href="${s.source}" rel="noopener" target="_blank">Source</a> · <a href="${s.licence_url}" rel="noopener" target="_blank">${s.licence}</a>. Stems separated by stemma.`;
  };

  audio.onSongChange = (s) => {
    renderSongs();
    renderCredit(s);
  };

  const nextSong = async () => {
    const list = await audio.loadIndex();
    if (!list.length) return;
    const i = list.findIndex((x) => x.id === audio.songId);
    const nx = list[(i + 1) % list.length];
    audio.songId = nx.id;
    if (!audio.on) {
      audio.musicOn = true;
      setSound(true);
    } else if (!audio.musicOn) audio.setMusicOn(true);
    else void audio.playSong(nx.id);
    hud.toast('Now playing', `${nx.title} by ${nx.credit_as ?? nx.artist}`);
  };

  q('[data-next-song]')?.addEventListener('click', () => {
    void nextSong();
    host.focus({ preventScroll: true });
  });

  const drawLanes = () => {
    if (!lanesCanvas || !stemmaOpen) return;
    const s = audio.song();
    if (!s) return;
    const g = lanesCanvas.getContext('2d')!;
    const w = lanesCanvas.width;
    const h = lanesCanvas.height;
    const lh = h / 4;
    g.clearRect(0, 0, w, h);
    const cols: Record<StemGroup, string> = {
      vocals: '#e5487a',
      drums: '#ffb020',
      bass: '#1fc9b7',
      other: '#8bcb3c',
    };
    const ph = audio.playhead();
    STEM_GROUPS.forEach((grp, li) => {
      const src =
        grp === 'other'
          ? ['other', 'guitar', 'piano'].map((k) => s.peaks[k]).filter(Boolean)
          : [s.peaks[grp] ?? []];
      const peaks = (src[0] ?? []).map(
        (_, i) => Math.min(1, Math.max(...src.map((p) => p[i] ?? 0)) / 100),
      );
      const muted = audio.muted[grp];
      g.fillStyle = muted ? 'rgba(255,255,255,0.12)' : cols[grp];
      const n = peaks.length;
      for (let i = 0; i < n; i++) {
        const v = peaks[i] * (lh * 0.42);
        const x = (i / n) * w;
        g.globalAlpha = i / n < ph ? 1 : 0.45;
        g.fillRect(x, li * lh + lh / 2 - v, Math.max(1, w / n - 1), v * 2);
      }
      g.globalAlpha = 1;
    });
    g.fillStyle = '#f4f1ea';
    g.fillRect(ph * w - 1, 0, 2, h);
  };

  root.querySelectorAll<HTMLButtonElement>('[data-stem]').forEach((b) => {
    b.addEventListener('click', () => {
      if (!audio.on) setSound(true);
      const muted = audio.toggleStem(b.dataset.stem as StemGroup);
      b.setAttribute('aria-pressed', String(!muted));
      completeGoal('stemma');
    });
  });

  const setStemma = (open: boolean) => {
    stemmaOpen = open;
    if (open) {
      closeOtherBooths('stemma');
      if (!audio.on) setSound(true);
      void audio.loadIndex().then(() => {
        renderSongs();
        renderCredit(audio.song());
      });
    }
    syncPanels();
  };

  q('[data-stemma-close]')?.addEventListener('click', () => setStemma(false));

  return {
    get coriolisFocus() { return coriolisFocus; },
    get stemmaOpen() { return stemmaOpen; },
    get catFocus() { return catFocus; },
    get podOpen() { return podOpen; },
    anyOpen,
    syncPanels,
    closeOtherBooths,
    toggleCoriolis,
    setCat,
    syncCatUi,
    triggerCatPounce,
    setPod,
    syncPodUi,
    setStemma,
    nextSong,
    drawLanes,
  };
}
