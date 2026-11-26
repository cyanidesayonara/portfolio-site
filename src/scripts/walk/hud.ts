/*
  HUD for the 3D walk, modeled on Path of Leash Resistance's own HUD
  (hud/ui_kit.gd, hud_panel.gd, goals_card.gd, event_feed.gd): a vitals card
  top-left, a goals card top-right, a banner pill top-center, big outlined
  shouts, slide-in goal toasts, a combo meter, speech bubbles and keycaps.
  Plain DOM so text stays crisp and accessible; styles live in Walk3D.astro.
*/

export type Tone = 'plain' | 'good' | 'bad' | 'loud';

export interface GoalRow {
  id: string;
  label: string;
  done: boolean;
  count?: number;
  target?: number;
  /** Which area (progress.ts AREAS) the goal belongs to. */
  area?: string;
}

/** Areas for grouping goals on the card (see progress.ts). */
export interface GoalArea { id: string; label: string }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const keycap = (k: string) => `<kbd class="kc${k.length > 2 ? ' wide' : ''}">${esc(k)}</kbd>`;

const ICONS = {
  phone: '<svg viewBox="0 0 10 16" aria-hidden="true"><rect x="1" y="1" width="8" height="14" rx="2"/><rect x="2.6" y="3" width="4.8" height="8" rx="0.6" class="scr"/></svg>',
  drop: '<svg viewBox="0 0 12 16" aria-hidden="true"><path d="M6 1C6 1 1 7.5 1 10.5a5 5 0 0 0 10 0C11 7.5 6 1 6 1z"/></svg>',
  bolt: '<svg viewBox="0 0 12 16" aria-hidden="true"><path d="M7 1L1 9h4l-1 6 7-9H7l1-5z"/></svg>',
  bone: '<svg viewBox="0 0 20 10" aria-hidden="true"><path d="M4 1.5a2.3 2.3 0 0 0-1.6 3.9A2.3 2.3 0 1 0 5.6 8.6h8.8a2.3 2.3 0 1 0 3.2-3.2 2.3 2.3 0 1 0-3.2-3.2H5.6A2.3 2.3 0 0 0 4 1.5z"/></svg>',
};

interface Bubble {
  el: HTMLElement;
  ttl: number;
  life: number;
}

export class Hud {
  root: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  private shouts: { el: HTMLElement; t: number }[] = [];
  private toasts: { el: HTMLElement; t: number; ttl: number }[] = [];
  private bubbles = new Map<string, Bubble>();
  goalsOpen = false;
  onPrompt?: (key: string) => void;
  onResetProgress?: () => void;
  private lastBanner = '';
  private lastPrompt = '';
  private lastBoss = '';

  constructor(stage: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'hud';
    root.innerHTML = `
      <div class="hud-card vitals" data-h="vitals">
        <div class="row top">
          <span class="phones" data-h="phones">${ICONS.phone}${ICONS.phone}${ICONS.phone}</span>
          <span class="bones"><span data-h="bones">0</span>${ICONS.bone}</span>
        </div>
        <div class="row"><span class="ic pee">${ICONS.drop}</span><span class="lbl">PEE</span><span class="bar"><i data-h="pee"></i></span></div>
        <div class="row"><span class="ic mk">${ICONS.drop}</span><span class="lbl">MARKED</span><span class="drops" data-h="marks">${ICONS.drop.repeat(5)}</span><span class="chip" data-h="streak" hidden></span></div>
        <div class="row"><span class="ic zm">${ICONS.bolt}</span><span class="lbl">ZOOMIES</span><span class="bar"><i class="zoom" data-h="zoom"></i></span></div>
      </div>
      <div class="bossbar" data-h="boss" hidden>
        <div class="bh"><span class="bname" data-h="bname"></span><span class="bphase" data-h="bphase"></span></div>
        <div class="btrack"><i data-h="bfill"></i></div>
        <div class="bsub" data-h="bsub"></div>
      </div>
      <button type="button" class="hud-card goals" data-h="goals" aria-expanded="false">
        <span class="gh"><span data-h="gtitle">GOALS 0/0</span><kbd class="kc pill">TAB</kbd></span>
        <span class="gprog"><i data-h="gprog"></i></span>
        <span class="garea" data-h="garea"></span>
        <ul data-h="glist"></ul>
      </button>
      <button type="button" class="greset" data-h="greset" hidden>Reset saved progress</button>
      <div class="toasts" data-h="toasts" aria-live="polite"></div>
      <div class="banner" data-h="banner" aria-live="polite"><i class="dot"></i><span data-h="btext"></span></div>
      <div class="shouts" data-h="shouts" aria-hidden="true"></div>
      <div class="combo" data-h="combo" hidden><span data-h="ctext"></span><span class="cbar"><i data-h="cfill"></i></span></div>
      <div class="bubbles" data-h="bubbles" aria-hidden="true"></div>
      <div class="prompts" data-h="prompts"></div>
      <div class="flash" data-h="flash"></div>
    `;
    stage.appendChild(root);
    this.root = root;
    root.querySelectorAll<HTMLElement>('[data-h]').forEach((e) => { this.els[e.dataset.h!] = e; });
    this.els.goals.addEventListener('click', () => this.toggleGoals());
    this.els.greset.addEventListener('click', (e) => { e.stopPropagation(); this.onResetProgress?.(); });
    this.els.prompts.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('[data-prompt-key]')) e.stopPropagation();
    });
    this.els.prompts.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-prompt-key]');
      if (!btn) return;
      e.stopPropagation();
      this.onPrompt?.(btn.dataset.promptKey!);
    });
  }

  toggleGoals(open = !this.goalsOpen) {
    this.goalsOpen = open;
    this.els.goals.classList.toggle('open', open);
    this.els.goals.setAttribute('aria-expanded', String(open));
    this.placeReset();
  }

  /** The reset button sits just under the open goals card (a button can't hold another). */
  placeReset() {
    const r = this.els.greset, g = this.els.goals;
    r.hidden = !this.goalsOpen;
    if (!this.goalsOpen) return;
    // Beside the card's lower-left corner, clear of the minimap below it; on
    // narrow screens, where the card spans the width, just under it.
    const w = (g.offsetParent as HTMLElement | null)?.clientWidth ?? 0;
    if (g.offsetLeft > r.offsetWidth + 16) {
      r.style.top = `${g.offsetTop + g.offsetHeight - r.offsetHeight}px`;
      r.style.right = `${w - g.offsetLeft + 8}px`;
    } else {
      r.style.top = `${g.offsetTop + g.offsetHeight + 6}px`;
      r.style.right = `${w - g.offsetLeft - g.offsetWidth}px`;
    }
  }

  setVitals(v: { phones: number; bones: number; pee: number; marked: number; streak: number; zoomies: number; zoomMode: 'normal' | 'free' | 'golden'; time: number }) {
    const phones = this.els.phones.children;
    for (let i = 0; i < phones.length; i++) phones[i].classList.toggle('lost', i >= v.phones);
    this.els.phones.classList.toggle('low', v.phones <= 1);
    this.els.bones.textContent = String(v.bones);
    this.els.pee.style.width = `${Math.round(v.pee * 100)}%`;
    this.els.pee.classList.toggle('full', v.pee > 0.99 && Math.floor(v.time / 0.35) % 2 === 0);
    const drops = this.els.marks.children;
    for (let i = 0; i < drops.length; i++) drops[i].classList.toggle('on', i < v.marked);
    this.els.streak.hidden = v.streak < 2;
    this.els.streak.textContent = `x${v.streak}`;
    this.els.zoom.style.width = `${Math.round(v.zoomies * 100)}%`;
    this.els.zoom.dataset.mode = v.zoomMode;
  }

  setGoals(rows: GoalRow[], areas: GoalArea[] = [], current = '') {
    const done = rows.filter((r) => r.done).length;
    this.els.gtitle.textContent = `GOALS ${done}/${rows.length}`;
    this.els.goals.classList.toggle('all', done === rows.length);
    this.els.gprog.style.width = `${(done / Math.max(1, rows.length)) * 100}%`;
    const row = (r: GoalRow) => {
      const meter = r.target && !r.done
        ? `<span class="gm"><i style="width:${Math.min(100, ((r.count ?? 0) / r.target) * 100)}%"></i></span><span class="gn">${r.count ?? 0}/${r.target}</span>`
        : '';
      return `<li class="${r.done ? 'done' : ''}"><span class="tick">${r.done ? '✓' : ''}</span><span class="gl">${esc(r.label)}</span>${meter}</li>`;
    };
    if (!areas.length) {
      this.els.garea.textContent = '';
      this.els.glist.innerHTML = rows.map(row).join('');
      this.placeReset();
      return;
    }
    const of = (id: string) => rows.filter((r) => r.area === id);
    const tally = (rs: GoalRow[]) => `${rs.filter((r) => r.done).length}/${rs.length}`;
    const here = areas.find((a) => a.id === current);
    this.els.garea.textContent = here ? `${here.label} ${tally(of(here.id))}` : '';
    // The area Millie is in, in full; goals that work anywhere; then the rest summed up.
    const parts: string[] = [];
    if (here) parts.push(`<li class="ah">${esc(here.label)}<span>${tally(of(here.id))}</span></li>`, ...of(here.id).map(row));
    const anywhere = of('any');
    if (anywhere.length && current !== 'any') parts.push(`<li class="ah">Anywhere<span>${tally(anywhere)}</span></li>`, ...anywhere.map(row));
    const others = areas.filter((a) => a.id !== current && a.id !== 'any' && of(a.id).length);
    if (others.length) {
      parts.push('<li class="ah">Elsewhere</li>');
      for (const a of others) {
        const rs = of(a.id);
        const all = rs.every((r) => r.done);
        parts.push(`<li class="asum${all ? ' done' : ''}"><span class="tick">${all ? '✓' : ''}</span><span class="gl">${esc(a.label)}</span><span class="gn">${tally(rs)}</span></li>`);
      }
    }
    this.els.glist.innerHTML = parts.join('');
    this.placeReset();
  }

  /** Banner pill: prompts (saffron dot) and short news (leaf dot). Keys in [brackets] become keycaps. */
  banner(text: string | null, tone: 'prompt' | 'news' = 'prompt') {
    const key = `${tone}|${text ?? ''}`;
    if (key === this.lastBanner) return;
    this.lastBanner = key;
    const b = this.els.banner;
    if (!text) { b.classList.remove('show'); return; }
    this.els.btext.innerHTML = esc(text).replace(/\[([^\]]+)\]/g, (_m, k) => keycap(k));
    b.dataset.tone = tone;
    b.classList.add('show');
  }

  shout(text: string, tone: Tone = 'plain') {
    const el = document.createElement('div');
    el.className = `shout ${tone}`;
    el.textContent = text;
    this.els.shouts.appendChild(el);
    this.shouts.push({ el, t: 0 });
    while (this.shouts.length > 2) this.shouts.shift()!.el.remove();
  }

  toast(title: string, body: string, accent = '#8bcb3c', ttl = 3) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.setProperty('--ac', accent);
    el.innerHTML = `<b>${esc(title)}</b><span>${esc(body)}</span>`;
    this.els.toasts.appendChild(el);
    this.toasts.push({ el, t: 0, ttl });
    while (this.toasts.length > 2) this.toasts.shift()!.el.remove();
  }

  combo(text: string | null, frac = 0) {
    const c = this.els.combo;
    if (!text) { c.hidden = true; return; }
    c.hidden = false;
    this.els.ctext.textContent = text;
    this.els.cfill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    this.els.cfill.classList.toggle('low', frac < 0.35);
  }

  /** Bottom keycap prompts, e.g. [{key:'X', label:'Play the wall'}]. */
  prompts(items: { key: string; label: string }[]) {
    const html = items.map((i) => `<button type="button" class="pi" data-prompt-key="${esc(i.key)}">${keycap(i.key)}<span>${esc(i.label)}</span></button>`).join('');
    if (html === this.lastPrompt) return;
    this.lastPrompt = html;
    this.els.prompts.innerHTML = html;
    this.els.prompts.classList.toggle('show', items.length > 0);
  }

  /** Show or hide the shared top-center boss health bar during boss encounters. */
  setBoss(state: null | { name: string; hp: number; maxHp: number; phase?: string; hint?: string; accent?: string }) {
    const key = state
      ? `${state.name}|${state.hp}|${state.maxHp}|${state.phase ?? ''}|${state.hint ?? ''}|${state.accent ?? ''}`
      : 'off';
    if (key === this.lastBoss) return;
    this.lastBoss = key;
    const el = this.els.boss;
    if (!state) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.style.setProperty('--bac', state.accent ?? '#ffb020');
    this.els.bname.textContent = state.name;
    this.els.bphase.textContent = state.phase ?? '';
    this.els.bphase.hidden = !state.phase;
    this.els.bsub.textContent = state.hint ?? '';
    const pct = Math.max(0, Math.min(1, state.hp / Math.max(1, state.maxHp))) * 100;
    this.els.bfill.style.width = `${pct.toFixed(1)}%`;
  }

  say(id: string, text: string, ttl = 2, tone: 'paper' | 'win' | 'loud' = 'paper') {
    let b = this.bubbles.get(id);
    if (!b) {
      const el = document.createElement('div');
      el.className = 'bubble';
      this.els.bubbles.appendChild(el);
      b = { el, ttl, life: 0 };
      this.bubbles.set(id, b);
    }
    b.el.textContent = text;
    b.el.dataset.tone = tone;
    b.ttl = ttl;
    b.life = 0;
    b.el.classList.remove('pop');
    void b.el.offsetWidth;
    b.el.classList.add('pop');
  }

  hasBubble(id: string) {
    return this.bubbles.has(id);
  }

  /** Place a bubble at screen coordinates (CSS px inside the stage). */
  placeBubble(id: string, x: number, y: number, visible: boolean) {
    const b = this.bubbles.get(id);
    if (!b) return;
    b.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    b.el.style.visibility = visible ? 'visible' : 'hidden';
  }

  flash(color = 'rgba(255,255,255,0.6)') {
    const f = this.els.flash;
    f.style.background = color;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  update(dt: number) {
    if (this.goalsOpen) this.placeReset(); // the card eases open, so follow its size
    for (let i = this.shouts.length - 1; i >= 0; i--) {
      const s = this.shouts[i];
      s.t += dt;
      const fade = s.t > 1.85 ? 1 - (s.t - 1.85) / 0.55 : 1;
      const punch = s.t < 0.13 ? 1.28 - (s.t / 0.13) * 0.28 : 1;
      s.el.style.opacity = String(Math.max(0, fade));
      s.el.style.transform = `translateY(${(-s.t * 7 - i * 0).toFixed(1)}px) scale(${punch.toFixed(3)})`;
      if (s.t > 2.4) { s.el.remove(); this.shouts.splice(i, 1); }
    }
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.t += dt;
      const slide = Math.min(1, t.t / 0.18);
      const fade = t.t > t.ttl - 0.5 ? 1 - (t.t - t.ttl + 0.5) / 0.5 : 1;
      t.el.style.opacity = String(Math.max(0, fade));
      t.el.style.transform = `translateX(${((1 - slide) * 60).toFixed(1)}px)`;
      if (t.t > t.ttl) { t.el.remove(); this.toasts.splice(i, 1); }
    }
    this.bubbles.forEach((b, id) => {
      b.life += dt;
      if (b.life > b.ttl) { b.el.remove(); this.bubbles.delete(id); }
      else if (b.life > b.ttl - 0.3) b.el.style.opacity = String((b.ttl - b.life) / 0.3);
      else b.el.style.opacity = '1';
    });
  }
}
