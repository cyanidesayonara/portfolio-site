/*
  The booth controls both levels share: show buttons, previous/play/next, a seek
  bar and a link to the full app. Built with DOM calls only, since show and
  episode names come from publishers' feeds.
*/
import { fmtTime } from './feed';
import type { PodcastPlayer } from './player';

export interface PodLabels {
  play: string;
  pause: string;
  prev: string;
  next: string;
  seek: string;
  shows: string;
  openApp: string;
  loading: string;
  buffering: string;
  feedFailed: string;
  playFailed: string;
  retry: string;
  idle: string;
  playing: string;
  paused: string;
  error: string;
  hint: string;
  banner: string;
  prompt: string;
  toast: string;
}

export function readPodLabels(el: Element | null): PodLabels {
  return JSON.parse(el?.getAttribute('data-pod-labels') ?? '{}') as PodLabels;
}

export interface PodControlsOpts {
  player: PodcastPlayer;
  labels: PodLabels;
  /** Play or pause; the level turns its sound on first if it is off. */
  onToggle: () => void;
  onClick?: () => void;
  onClose: () => void;
}

/** Fill `box` with the controls; returns the function that keeps them in step with the player. */
export function mountPodControls(box: HTMLElement, o: PodControlsOpts): () => void {
  const { player, labels } = o;
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, txt = '') => {
    const e = document.createElement(tag);
    e.className = cls;
    e.textContent = txt;
    return e;
  };
  const button = (txt: string, cls: string, fn: () => void) => {
    const b = make('button', cls, txt);
    b.type = 'button';
    b.addEventListener('click', () => {
      fn();
      o.onClick?.();
    });
    return b;
  };

  // Announces the episode and errors, never the ticking clock.
  const now = make('p', 'pod-now');
  now.setAttribute('role', 'status');

  const play = button(labels.play, 'play', () => o.onToggle());
  const prev = button(labels.prev, 'prev', () => player.prev());
  const next = button(labels.next, 'next', () => player.next());
  const transport = make('div', 'pod-transport');
  transport.append(prev, play, next);

  const seek = make('input', 'pod-range');
  seek.type = 'range';
  seek.min = '0';
  seek.step = '1';
  seek.setAttribute('aria-label', labels.seek);
  const clock = make('span', 'pod-clock');
  const seekRow = make('div', 'pod-seek');
  seekRow.append(seek, clock);
  let dragging = false;
  const clockText = (t: number) => {
    const d = player.duration;
    return d ? `${fmtTime(t)} / ${fmtTime(d)}` : fmtTime(t);
  };
  seek.addEventListener('input', () => {
    dragging = true;
    clock.textContent = clockText(Number(seek.value));
  });
  seek.addEventListener('change', () => {
    dragging = false;
    player.seek(Number(seek.value));
  });
  seek.addEventListener('blur', () => { dragging = false; });
  seek.addEventListener('keydown', (e) => {
    e.stopPropagation(); // the arrows move the slider, not Millie
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) o.onToggle();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      o.onClose();
    }
  });

  const shows = make('div', 'pod-shows');
  shows.setAttribute('role', 'group');
  shows.setAttribute('aria-label', labels.shows);
  const link = make('a', 'pod-open', labels.openApp);
  link.target = '_blank';
  link.rel = 'noopener';

  box.replaceChildren(now, transport, seekRow, shows, link);

  const setText = (e: HTMLElement, t: string) => {
    if (e.textContent !== t) e.textContent = t;
  };
  let builtFor: unknown = null;
  const sync = () => {
    if (builtFor !== player.shows) {
      builtFor = player.shows;
      shows.replaceChildren(
        ...player.shows.map((s, i) => {
          const b = button(s.title, 'pod-show', () => player.selectShow(i));
          b.title = s.title;
          return b;
        }),
      );
    }
    const ready = player.feed === 'ready';
    const failed = player.feed === 'failed';
    const { show, episode, status } = player;
    let line = labels.loading;
    if (failed) line = labels.feedFailed;
    else if (status === 'error') line = labels.playFailed;
    else if (ready && show && episode) line = `${show.title} · ${episode.title}`;
    setText(now, line);
    now.classList.toggle('bad', failed || status === 'error');
    setText(
      play,
      failed || status === 'error' ? labels.retry
        : status === 'loading' ? labels.buffering
          : status === 'playing' ? labels.pause
            : labels.play,
    );
    play.setAttribute('aria-pressed', String(player.active));
    play.disabled = !ready && !failed;
    prev.disabled = next.disabled = !ready;
    const d = player.duration;
    seek.disabled = !ready || !d;
    if (!dragging) {
      seek.max = String(Math.max(1, Math.round(d ?? 1)));
      seek.value = String(Math.round(player.time));
      setText(clock, ready ? clockText(player.time) : '');
    }
    seek.setAttribute('aria-valuetext', clockText(Number(seek.value)));
    Array.from(shows.children).forEach((b, i) => b.setAttribute('aria-pressed', String(i === player.showIdx)));
    box.style.setProperty('--pod', player.accent);
    if (link.href !== player.link) link.href = player.link;
  };
  sync();
  return sync;
}
