/*
  Goal checklist, district bonus rewards, and saved-progress persistence for /walk.
*/
import { WalkAudio } from './audio';
import { Hud, type GoalRow } from './hud';
import { AREAS, AREA_BONUS, loadProgress, saveProgress, clearProgress } from './progress';

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

  const goals: GoalRow[] = [
    { id: 'whirl', label: 'Fling your human with a pole whirl', done: false, area: 'any' },
    { id: 'mark', label: 'Mark 5 spots (Q)', done: false, count: 0, target: 5, area: 'any' },
    { id: 'birds', label: 'Scatter the gulls or pigeons (E)', done: false, area: 'any' },
    { id: 'finds', label: 'Dig up 3 finds on the beach (Space)', done: false, count: 0, target: 3, area: 'seafront' },
    { id: 'hurdles', label: 'Clear the 3 hurdles in the pipicà (V)', done: false, count: 0, target: 3, area: 'seafront' },
    { id: 'coriolis', label: 'Play the Coriolis LED wall (X)', done: false, area: 'seafront' },
    { id: 'stemma', label: 'Change the music at stemma (X)', done: false, area: 'seafront' },
    { id: 'pier', label: 'Walk to the end of the pier', done: false, area: 'seafront' },
    { id: 'dimoni', label: 'Light the Dimoni, then outrun its devils', done: false, area: 'seafront' },
    { id: 'gulls', label: 'Outsmart the swooping pier gulls', done: false, area: 'seafront' },
    { id: 'marina_quests', label: 'Help out at the marina', done: false, count: 0, target: 3, area: 'marina' },
    { id: 'marina_lighthouse', label: 'Reach the breakwater lighthouse', done: false, area: 'marina' },
    { id: 'marina_boats', label: 'Stroll both marina pontoons', done: false, count: 0, target: 2, area: 'marina' },
    { id: 'marina_wake', label: 'Outrun the harbor boat wake on a pontoon', done: false, area: 'marina' },
    { id: 'marina_mico', label: 'Outsmart El Mico de Bronze at Moll de Ponent', done: false, area: 'marina' },
    { id: 'town', label: 'Help out in the side streets', done: false, count: 0, target: 5, area: 'town' },
    { id: 'neteja', label: 'Outrun La Neteja down Carrer del Mar', done: false, area: 'town' },
    { id: 'correfoc', label: 'Survive the correfoc on the Rambla', done: false, area: 'town' },
    { id: 'plaza', label: 'Help out on Plaça del Mercat', done: false, count: 0, target: 3, area: 'plaza' },
    { id: 'butcher', label: 'Get away with the butcher’s botifarra', done: false, area: 'plaza' },
    { id: 'hill_quests', label: 'Explore Dalt de la Vila', done: false, count: 0, target: 2, area: 'hill' },
    { id: 'cats', label: 'Send 3 old-town cats running', done: false, count: 0, target: 3, area: 'hill' },
    { id: 'hill_top', label: 'Climb to the hilltop church and head home', done: false, area: 'hill' },
  ];

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
      if (goal('marina_quests').done) ['buoy', 'gulls', 'playmate'].forEach((k) => doneKeys.add(`marina:${k}`));
      if (goal('marina_lighthouse').done) doneKeys.add('marina:lighthouse');
      if (goal('marina_boats').done) ['pontoonA', 'pontoonB'].forEach((k) => doneKeys.add(`marina:${k}`));
      if (goal('marina_wake').done) doneKeys.add('marina:wake');
      if (goal('marina_mico').done) doneKeys.add('marina:mico');
      if (goal('plaza').done) ['paper', 'terrace', 'fetch'].forEach((k) => doneKeys.add(`plaza:${k}`));
      if (goal('hill_quests').done) ['bell', 'mirador'].forEach((k) => doneKeys.add(`hill:${k}`));
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
