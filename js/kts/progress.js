/* KTS-прогресс (П4): ачивки, скины и коллекции «Личного дела», счётчики, путь в Мордор, грейды. Данные — js/kts/data/progress.js. */
(() => {
  'use strict';
  const G = window.G;
  const K = G.kts;
  if (!K || !K.enabled) return;

  const M = G.meta && typeof G.meta.addAchievement === 'function' ? G.meta : null;
  const ACH_PREFIX = 'kts.';
  const fmt = (s, ctx) => (typeof s === 'string' ? K.fmt(s, ctx) : null);
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const isMap = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  function plural(n, forms) {
    if (!Array.isArray(forms) || forms.length < 3) return '';
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b === 1) return forms[0];
    if (b >= 2 && b <= 4) return forms[1];
    return forms[2];
  }
  const decimal = (v) => (v < 10 && v % 1 ? String(Math.floor(v * 10) / 10).replace('.', ',') : String(Math.floor(v)));
  const foundOf = (kind, defs) => defs.filter((d) => K.has(kind, d.id)).length;

  // ---------- Мордор ----------
  const mordor = () => K.get('progress', 'mordor');
  const DAYS_KEY = 'mordorDays';
  const mordorKm = (c) => K.counter('mordor') / Math.max(1, num(c.unitsPerKm));

  function windowIsos(c) {
    const out = [];
    const t = K.today.date;
    const n = Math.max(1, Math.round(num(c.windowDays)));
    for (let i = 0; i < n; i++) {
      const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i);
      out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
    }
    return out;
  }
  function dayLog() {
    const raw = K.store.get(DAYS_KEY, null);
    return isMap(raw) ? raw : {};
  }
  function logSteps(c, units) {
    const log = dayLog();
    const keep = windowIsos(c);
    const out = {};
    for (const iso of keep) if (log[iso]) out[iso] = num(log[iso]);
    out[K.today.iso] = num(out[K.today.iso]) + units;
    K.store.set(DAYS_KEY, out);
  }
  // Темп — средние километры за календарный день последних windowDays дней, считая дни без забегов.
  function forecast(c) {
    const km = mordorKm(c);
    if (km >= num(c.goalKm)) return K.line('progress.mordor.done');
    if (km <= 0) return K.line('progress.mordor.start');
    const log = dayLog();
    let sum = 0;
    for (const iso of windowIsos(c)) sum += num(log[iso]);
    const perDay = sum / Math.max(1, num(c.windowDays)) / Math.max(1, num(c.unitsPerKm));
    if (!(perDay > 0)) return K.line('progress.mordor.stalled');
    const days = (num(c.goalKm) - km) / perDay;
    const units = c.units || {};
    let n, forms;
    if (days >= 365) {
      n = Math.round(days / 365);
      forms = units.year;
    } else if (days >= 45) {
      n = Math.round(days / 30.4);
      forms = units.month;
    } else {
      n = Math.max(1, Math.ceil(days));
      forms = units.day;
    }
    return K.line('progress.mordor.left', { n, unit: plural(n, forms) });
  }

  // ---------- ачивки ----------
  function counterProgress(def) {
    const v = K.counter(def.counter) / (num(def.per) || 1);
    const goal = num(def.goal);
    return { v, goal, text: decimal(Math.min(v, goal)) + ' / ' + decimal(goal) + (def.unit ? ' ' + def.unit : '') };
  }
  function checkCounters(key) {
    for (const def of K.all('achievements')) {
      if (!def.counter || (key && def.counter !== key) || !(num(def.goal) > 0)) continue;
      if (K.counter(def.counter) / (num(def.per) || 1) >= num(def.goal)) K.ach(def.id, { name: fmt(def.name), desc: fmt(def.desc) });
    }
  }
  const registered = new Set();
  function registerAchievements() {
    if (!M) return;
    const defs = K.all('achievements');
    const groups = [];
    for (const d of defs) if (!groups.includes(d.group || '')) groups.push(d.group || '');
    defs.sort((a, b) => groups.indexOf(a.group || '') - groups.indexOf(b.group || ''));
    for (const def of defs) {
      if (registered.has(def.id)) continue;
      registered.add(def.id);
      const name = fmt(def.name);
      if (!name) continue;
      M.addAchievement({
        id: ACH_PREFIX + def.id,
        name,
        desc: fmt(def.desc) || '',
        icon: def.icon,
        glyph: def.glyph,
        secret: !!def.secret,
        hint: fmt(def.hint) || '',
        done: () => K.has('ach', def.id),
        progress: def.counter && num(def.goal) > 0 ? () => counterProgress(def) : null,
      });
    }
  }

  // ---------- скины ----------
  function skinGift(def) {
    const g = def.gift;
    if (!isMap(g) || !g.event || !K.event(g.event)) return;
    K.skin(def.id, { via: 'gift', line: K.line('skins.' + def.id + '.gift.line') });
  }
  function checkAllOf() {
    for (const def of K.all('skins')) {
      if (!def.allOf || K.has('skin', def.id)) continue;
      const total = K.total(def.allOf);
      if (total > 0 && foundOf(def.allOf, K.all(sectionOf(def.allOf))) >= total) K.skin(def.id, { via: 'allOf' });
    }
  }
  const SECTION = { duck: 'ducks', secret: 'secrets', ach: 'achievements', skin: 'skins' };
  const sectionOf = (kind) => SECTION[kind] || kind;
  function registerSkins() {
    if (!M || typeof M.addSkinRule !== 'function') return;
    for (const def of K.all('skins')) {
      const kind = def.allOf;
      M.addSkinRule(def.id, {
        cond: fmt(def.cond) || '',
        isOpen: () => K.has('skin', def.id),
        progress: kind
          ? () => {
              const defs = K.all(sectionOf(kind));
              return defs.length ? { v: foundOf(kind, defs), goal: defs.length } : null;
            }
          : null,
      });
    }
  }

  // ---------- грейды ----------
  function registerGrades() {
    const S = G.sprint;
    if (!S || typeof S.setGradeName !== 'function') return;
    const grades = K.all('grades');
    for (const g of grades) {
      const name = g.idx != null && fmt(g.name);
      if (name) S.setGradeName(g.idx, name);
    }
    if (typeof S.setGradeCheer !== 'function') return;
    S.setGradeCheer((grade) => {
      const exact = grades.find((g) => g.cheer && g.idx === grade.idx);
      const any = grades.find((g) => g.cheer && g.idx == null);
      const pick = exact || any;
      return pick ? K.line('grades.' + pick.id + '.cheer') || '' : '';
    });
  }

  // ---------- коллекции ----------
  function collView(col) {
    const title = fmt(col.title);
    if (!title) return null;
    const v = { title, icon: col.icon, sub: fmt(col.sub) || '' };
    if (col.kind === 'found') {
      const defs = K.all(col.section || sectionOf(col.of));
      if (!defs.length) return null;
      const got = foundOf(col.of, defs);
      v.value = got + '/' + defs.length;
      v.done = got >= defs.length;
      v.chips = defs.map((d) => {
        const on = K.has(col.of, d.id);
        return { on, label: on ? fmt(d.name || d.title || d.label || '') || '★' : '?', title: on ? fmt(d.desc || d.place || '') || '' : '' };
      });
      return v;
    }
    if (col.kind === 'counter') {
      const n = K.counter(col.counter);
      const goal = num(col.goal);
      v.value = goal ? Math.min(n, goal) + '/' + goal : String(n);
      if (goal) v.k = Math.min(1, n / goal);
      v.done = goal > 0 && n >= goal;
      return v;
    }
    if (col.kind === 'score') {
      const n = Math.max(num(col.start), K.counter(col.counter));
      v.value = fmt(col.text, { n }) || String(n);
      return v;
    }
    if (col.kind === 'mordor') {
      const c = mordor();
      if (!c) return null;
      const km = mordorKm(c), goal = num(c.goalKm);
      v.value = decimal(km) + (col.unit ? ' ' + col.unit : '');
      v.k = goal ? Math.min(1, km / goal) : 0;
      v.num = Math.floor(v.k * 100) + '%';
      v.sub = forecast(c) || '';
      v.done = km >= goal;
      return v;
    }
    return null;
  }
  function registerCollections() {
    if (!M || typeof M.addCollection !== 'function') return;
    for (const col of K.all('collections')) M.addCollection({ id: col.id, order: col.order, view: () => collView(col) });
  }
  const collectedCounters = () => K.all('collections').filter((c) => c.kind === 'counter' || c.kind === 'score').map((c) => c.counter);

  // ---------- счётчики на подборах ----------
  // Счётчик могут вести и владельцы пикапов; на подбор досчитываем сами, только если за этот кадр и следующий никто не посчитал.
  const lastCountT = Object.create(null);
  const DAY_KEY = 'countDays';
  const countDays = () => {
    const raw = K.store.get(DAY_KEY, null);
    return isMap(raw) ? raw : {};
  };
  function perDayRule(counter) {
    const c = K.get('progress', 'counts');
    const by = c && isMap(c.byPickup) ? c.byPickup : {};
    for (const type in by) if (by[type] && by[type].counter === counter && by[type].perDay) return true;
    return false;
  }
  function ensureCounted(rule) {
    const key = rule.counter;
    const now = G.state.realT;
    if (lastCountT[key] === now) return;
    G.after(0, () => {
      if (lastCountT[key] != null && lastCountT[key] >= now) return;
      if (rule.perDay && countDays()[key] === K.today.iso) return;
      K.count(key, 1);
    });
  }

  // ---------- инициализация ----------
  for (const col of K.all('collections')) {
    if (col.kind === 'score' && col.counter && num(col.start) > 0 && !K.counter(col.counter)) K.setCounter(col.counter, num(col.start));
  }
  registerSkins();
  registerAchievements();
  registerCollections();
  registerGrades();

  G.on('kts:count', (e) => {
    if (!e || !e.key) return;
    if (e.delta > 0) {
      lastCountT[e.key] = G.state.realT;
      if (perDayRule(e.key)) {
        const days = countDays();
        days[e.key] = K.today.iso;
        K.store.set(DAY_KEY, days);
      }
      if (M && collectedCounters().includes(e.key)) M.touchCollection();
    }
    checkCounters(e.key);
    if (e.key === 'mordor') checkMountain();
  });
  function checkMountain() {
    const c = mordor();
    if (c && c.secret && mordorKm(c) >= num(c.goalKm)) K.secret(c.secret);
  }

  G.on('kts:ach', (e) => {
    if (M && e && e.id) M.notifyUnlock('ach', ACH_PREFIX + e.id);
  });
  G.on('kts:skin', (e) => {
    if (M && e && e.id) M.notifyUnlock('skin', e.id);
  });
  G.on('kts:duck', () => {
    if (M) M.touchCollection();
    checkAllOf();
  });
  G.on('kts:secret', () => {
    if (M) M.touchCollection();
    checkAllOf();
  });

  G.on('pickup', (p) => {
    const c = K.get('progress', 'counts');
    const rule = c && isMap(c.byPickup) && p ? c.byPickup[p.type] : null;
    if (rule && rule.counter) ensureCounted(rule);
  });

  G.on('die', () => {
    const c = mordor();
    const units = Math.max(0, Math.round(num(G.state.dist)));
    if (c && units > 0) {
      logSteps(c, units);
      K.count('mordor', units);
    }
    for (const def of K.all('skins')) skinGift(def);
  });

  G.on('boot', () => {
    registerAchievements();
    checkCounters(null);
    checkMountain();
    checkAllOf();
  });
})();
