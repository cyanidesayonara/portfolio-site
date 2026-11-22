/*
  Phase 5: goals grouped by district, and walk progress saved in this browser.

  Each goal belongs to an area (one or more streamed districts, or "anywhere").
  The goals card shows the area Millie is in, with the others summed up, and
  finishing every goal in an area pays a bonus.

  Progress (finished goals, partial counts, bones) lives in localStorage under
  one versioned key. Storage can be blocked or empty (private windows, cleared
  site data), so every read and write is guarded and the game runs without it.
*/
import type { GoalRow } from './hud';

export interface Area {
  id: string;
  label: string;
  /** Level district ids this area covers (none for "anywhere"). */
  districts: string[];
}

export const AREAS: Area[] = [
  { id: 'seafront', label: 'Seafront and beach', districts: ['seafront'] },
  { id: 'town', label: 'Rambla and Carrer del Mar', districts: ['rambla', 'town'] },
  { id: 'plaza', label: 'Plaça del Mercat', districts: ['plaza'] },
  { id: 'hill', label: 'Dalt de la Vila', districts: ['hill'] },
  { id: 'any', label: 'Anywhere', districts: [] },
];

export const areaOfDistrict = (districtId: string) =>
  AREAS.find((a) => a.districts.includes(districtId))?.id ?? 'seafront';

/** Bones for finishing every goal in an area. */
export const AREA_BONUS = 5;

const KEY = 'walk3d-progress-v1';

interface Saved {
  v: 1;
  goals: Record<string, { done: boolean; count?: number }>;
  bones: number;
}

export function loadProgress(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    if (s?.v !== 1 || typeof s.goals !== 'object') return null;
    return s;
  } catch {
    return null;
  }
}

export function saveProgress(goals: GoalRow[], bones: number) {
  const s: Saved = { v: 1, goals: {}, bones };
  for (const g of goals) {
    if (g.done || g.count) s.goals[g.id] = g.target ? { done: g.done, count: g.count ?? 0 } : { done: g.done };
  }
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
}

export function clearProgress() {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}
