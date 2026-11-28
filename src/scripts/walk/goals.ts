/*
  Goal checklist, district bonus rewards, and saved-progress persistence for /walk.
*/
import { WalkAudio } from './audio';
import { Hud, type GoalRow } from './hud';
import { AREAS, AREA_BONUS, loadProgress, saveProgress, clearProgress } from './progress';
import { GOAL_DEFS } from './goalDefs';

export interface GoalSystemOpts {
  hud: Hud;
  audio: WalkAudio;
  saving: boolean;
  getBones: () => number;
  addBones: (n: number) => void;
  setBones: (n: number) => void;
}

/** Owns walk goals, completion fanfare, area switching, and localStorage sync. */
export function createGoalSystem(opts: GoalSystemOpts) {
  const { hud, audio, saving } = opts;

  const goals: GoalRow[] = GOAL_DEFS.map((g) => ({ ...g }));

  const goal = (id: string) => goals.find((g) => g.id === id)!;
  let progressDirty = false;
  let resetting = false;
  const countBase: Record<string, number> = {};
  let area = 'seafront';

  const showGoals = () => hud.setGoals(goals, AREAS, area);

  const completeGoal = (id: string) => {
    const g = goal(id);
    if (g.done) return;
    g.done = true;
    if (g.target) g.count = g.target;
    hud.toast('Goal complete', g.label.replace(/ \([^)]*\)$/, ''), '#8bcb3c');
    audio.goal();
    const a = AREAS.find((x) => x.id === g.area);
    if (a && a.id !== 'any' && goals.filter((x) => x.area === a.id).every((x) => x.done)) {
      setTimeout(() => {
        opts.addBones(AREA_BONUS);
        hud.shout(`${a.label.toUpperCase()} DONE +${AREA_BONUS}`, 'good');
        progressDirty = true;
      }, 1200);
    }
    showGoals();
    progressDirty = true;
    if (goals.every((x) => x.done)) setTimeout(() => hud.shout('BEST WALK EVER', 'loud'), 900);
  };

  const bumpGoal = (id: string, n: number) => {
    const g = goal(id);
    if (g.done) return;
    const c = Math.max(g.count ?? 0, (countBase[id] ?? 0) + n);
    if (c === g.count) return;
    g.count = c;
    progressDirty = true;
    if (g.target && c >= g.target) completeGoal(id);
    else showGoals();
  };

  const saved = saving ? loadProgress() : null;
  const doneKeys = new Set<string>(saved?.done ?? []);
  const markDone = (key: string) => {
    if (doneKeys.has(key)) return;
    doneKeys.add(key);
    progressDirty = true;
  };

  if (saved) {
    for (const g of goals) {
      const sg = saved.goals[g.id];
      if (!sg) continue;
      g.done = !!sg.done;
      if (g.target) g.count = g.done ? g.target : Math.min(g.target, sg.count ?? 0);
      if (g.count && (g.id === 'mark' || saved.done === undefined)) countBase[g.id] = g.count;
    }
    if (saved.done === undefined) {
      if (goal('town').done) ['ball', 'tofu', 'crate', 'bakery', 'selfie'].forEach((k) => doneKeys.add(`town:${k}`));
      if (goal('tabalers').done) doneKeys.add('town:tabalers');
      if (goal('marina_quests').done) ['buoy', 'gulls', 'playmate'].forEach((k) => doneKeys.add(`marina:${k}`));
      if (goal('marina_lighthouse').done) doneKeys.add('marina:lighthouse');
      if (goal('marina_boats').done) ['pontoonA', 'pontoonB'].forEach((k) => doneKeys.add(`marina:${k}`));
      if (goal('marina_wake').done) doneKeys.add('marina:wake');
      if (goal('marina_mico').done) doneKeys.add('marina:mico');
      if (goal('gorg_quests').done) ['bag', 'hoop', 'tram'].forEach((k) => doneKeys.add(`gorg:${k}`));
      if (goal('gorg_bridges').done) ['bridgeS', 'bridgeN'].forEach((k) => doneKeys.add(`gorg:${k}`));
      if (goal('gorg_carts').done) doneKeys.add('gorg:carts');
      if (goal('ronda_quests').done) ['deck', 'bridge', 'fetch'].forEach((k) => doneKeys.add(`ronda:${k}`));
      if (goal('ronda_bridge').done) doneKeys.add('ronda:bridgeCross');
      if (goal('ronda_scooters').done) doneKeys.add('ronda:scooters');
      if (goal('fabrica_quests').done) ['bread', 'ball', 'shutter'].forEach((k) => doneKeys.add(`fabrica:${k}`));
      if (goal('fabrica_chimney').done) doneKeys.add('fabrica:chimney');
      if (goal('fabrica_bins').done) doneKeys.add('fabrica:bins');
      if (goal('santpau_quests').done) ['sheet', 'music', 'esmolet'].forEach((k) => doneKeys.add(`santpau:${k}`));
      if (goal('santpau_pipica').done) doneKeys.add('santpau:pipica');
      if (goal('santpau_bottles').done) doneKeys.add('santpau:bottles');
      if (goal('plaza').done) ['paper', 'terrace', 'fetch'].forEach((k) => doneKeys.add(`plaza:${k}`));
      if (goal('plaza_castellers').done) doneKeys.add('plaza:castellers');
      if (goal('hill_quests').done) ['bell', 'mirador'].forEach((k) => doneKeys.add(`hill:${k}`));
      if (goal('hill_senglars').done) doneKeys.add('hill:senglars');
      if (goal('hill_mosaic').done) doneKeys.add('hill:mosaic');
      if (goal('hill_top').done) doneKeys.add('hill:home');
      if (goal('finds').done) [0, 1, 2].forEach((i) => doneKeys.add(`find:${i}`));
      if (goal('hurdles').done) [0, 1, 2].forEach((i) => doneKeys.add(`hurdle:${i}`));
      if (goal('cats').done) [0, 1, 2, 3].forEach((i) => doneKeys.add(`cat:${i}`));
    }
    opts.setBones(Math.max(0, saved.bones | 0));
  }

  showGoals();

  if (saving) {
    const flush = () => {
      if (progressDirty && !resetting) {
        progressDirty = false;
        saveProgress(goals, opts.getBones(), doneKeys);
      }
    };
    let lastBones = opts.getBones();
    setInterval(() => {
      const cur = opts.getBones();
      if (cur !== lastBones) {
        lastBones = cur;
        progressDirty = true;
      }
      flush();
    }, 3000);
    window.addEventListener('pagehide', () => {
      progressDirty = true;
      flush();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        progressDirty = true;
        flush();
      }
    });
  }

  hud.onResetProgress = () => {
    if (!window.confirm('Reset your saved walk progress? Goals and bones start over.')) return;
    resetting = true;
    clearProgress();
    progressDirty = false;
    location.reload();
  };

  return {
    goals,
    goal,
    doneKeys,
    saved,
    showGoals,
    completeGoal,
    bumpGoal,
    markDone,
    markDirty: () => {
      progressDirty = true;
    },
    getArea: () => area,
    setArea: (next: string) => {
      if (next !== area) {
        area = next;
        showGoals();
      }
    },
  };
}
