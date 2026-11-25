/*
  The booth feed published by dopepod (rebuilt daily). Feed text is written by
  podcast publishers, so nothing here is trusted: every field is checked, only
  https URLs are kept, and the UI only ever shows it as plain text.
*/
export const DOPEPOD_URL = 'https://cyanidesayonara.github.io/dop3pod/';
const FEED_URL = `${DOPEPOD_URL}data/booth.json`;
const MAX_SHOWS = 8;
const MAX_EPISODES = 12;

export interface PodEpisode {
  id: string;
  title: string;
  /** Seconds, or null when the publisher doesn't say. */
  duration: number | null;
  audio: string;
}
export interface PodShow {
  id: string;
  title: string;
  author: string;
  episodes: PodEpisode[];
}

// Control characters and bidirectional overrides have no place in a title.
const JUNK = /[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g;
const text = (v: unknown, max = 200) =>
  typeof v === 'string' ? v.replace(JUNK, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const cleanId = (v: unknown) =>
  typeof v === 'string' && /^[\w.~-]{1,120}$/.test(v) && !/^\.+$/.test(v) ? v : '';
const httpsUrl = (v: unknown) => {
  if (typeof v !== 'string') return '';
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
  } catch {
    return '';
  }
};
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Keep the usable shows and episodes of a parsed feed and drop the rest. */
export function parseFeed(json: unknown): PodShow[] {
  return list(rec(json).shows)
    .map((raw): PodShow => {
      const s = rec(raw);
      const episodes = list(s.episodes)
        .map((rawEp): PodEpisode => {
          const e = rec(rawEp);
          const d = e.duration;
          return {
            id: cleanId(e.id),
            title: text(e.title),
            duration: typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : null,
            audio: httpsUrl(e.audio),
          };
        })
        .filter((e) => e.id && e.title && e.audio)
        .slice(0, MAX_EPISODES);
      return { id: cleanId(s.id), title: text(s.title), author: text(s.author), episodes };
    })
    .filter((s) => s.id && s.title && s.episodes.length > 0)
    .slice(0, MAX_SHOWS);
}

export async function fetchFeed(timeoutMs = 10000): Promise<PodShow[]> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(FEED_URL, { signal: ctl.signal, credentials: 'omit' });
    if (!res.ok) throw new Error(`booth.json ${res.status}`);
    const shows = parseFeed(await res.json());
    if (!shows.length) throw new Error('booth.json has no playable shows');
    return shows;
  } finally {
    clearTimeout(timer);
  }
}

export const coverUrl = (show: PodShow) => `${DOPEPOD_URL}data/covers/${encodeURIComponent(show.id)}.webp`;
export const deepLink = (show?: PodShow, ep?: PodEpisode) =>
  show && ep
    ? `${DOPEPOD_URL}#/show/${encodeURIComponent(show.id)}/${encodeURIComponent(ep.id)}`
    : DOPEPOD_URL;

export const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};
