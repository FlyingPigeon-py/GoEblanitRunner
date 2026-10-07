/* KTS-слой: реестр контента, люди, тексты, дата, счётчики и находки. Владелец — интегратор. Весь KTS-контент живёт в js/kts/data/*.js. */
(() => {
  'use strict';
  const G = window.G;

  function query() {
    const out = Object.create(null);
    const s = String((window.location && window.location.search) || '').replace(/^\?/, '');
    for (const part of s.split('&')) {
      if (!part) continue;
      const i = part.indexOf('=');
      const k = decodeURIComponent(i < 0 ? part : part.slice(0, i));
      out[k] = i < 0 ? '' : decodeURIComponent(part.slice(i + 1));
    }
    return out;
  }
  const Q = query();

  const K = (G.kts = {
    enabled: Q.kts !== 'off',
    debug: Q['kts-debug'] === '1',
    query: Q,
    data: Object.create(null),
  });

  // ---------- реестр ----------
  K.add = (section, obj) => {
    const s = K.data[section] || (K.data[section] = Object.create(null));
    for (const id in obj) s[id] = Object.assign({ id }, obj[id]);
  };
  const peopleOn = (ids) => {
    if (!ids) return true;
    for (const id of ids) if (!K.person(id)) return false;
    return true;
  };
  K.isOn = (def) => !!def && K.enabled && def.on !== false && peopleOn(def.people);
  K.raw = (section, id) => (K.data[section] && K.data[section][id]) || null;
  K.get = (section, id) => {
    const def = K.raw(section, id);
    return K.isOn(def) ? def : null;
  };
  K.all = (section) => {
    const s = K.data[section];
    const out = [];
    if (s) for (const id in s) if (K.isOn(s[id])) out.push(s[id]);
    return out;
  };

  // ---------- люди ----------
  K.person = (id) => {
    const p = K.data.people && K.data.people[id];
    return p && p.on !== false && K.enabled ? p : null;
  };

  // ---------- тексты ----------
  // {denis.gen} — форма имени человека; {n} — поле контекста. Строка с выключенным человеком выпадает.
  K.fmt = (str, ctx) => {
    if (typeof str !== 'string') return null;
    let dead = false;
    const out = str.replace(/\{([a-zA-Z0-9_]+)(?:\.([a-zA-Z0-9_]+))?\}/g, (m, a, b) => {
      if (b != null) {
        const p = K.person(a);
        if (!p) {
          if (ctx && ctx[a] != null && typeof ctx[a] === 'object' && ctx[a][b] != null) return String(ctx[a][b]);
          if (K.data.people && K.data.people[a]) dead = true;
          return m;
        }
        const forms = p.forms || {};
        return String(forms[b] != null ? forms[b] : p.name);
      }
      if (ctx && ctx[a] != null) return String(ctx[a]);
      const p = K.person(a);
      if (p) return String(p.name);
      if (K.data.people && K.data.people[a]) dead = true;
      return m;
    });
    return dead ? null : out;
  };
  function resolve(path) {
    if (Array.isArray(path)) return path;
    if (typeof path !== 'string') return null;
    const parts = path.split('.');
    const def = K.get(parts[0], parts[1]);
    if (!def) return null;
    let v = def;
    for (let i = 2; i < parts.length; i++) v = v == null ? null : v[parts[i]];
    if (typeof v === 'string') return [v];
    return Array.isArray(v) ? v : null;
  }
  const bags = Object.create(null);
  // Случайная строка пула без повторов, пока пул не исчерпан; null, если все строки выпали.
  K.line = (path, ctx, bagKey) => {
    const pool = resolve(path);
    if (!pool || !pool.length) return null;
    const key = bagKey || (typeof path === 'string' ? path : null);
    const okIdx = [];
    for (let i = 0; i < pool.length; i++) if (K.fmt(pool[i], ctx) != null) okIdx.push(i);
    if (!okIdx.length) return null;
    let pick;
    if (key) {
      let bag = bags[key];
      if (!bag || !bag.length) {
        bag = okIdx.slice();
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const t = bag[i]; bag[i] = bag[j]; bag[j] = t;
        }
        bags[key] = bag;
      }
      pick = bag.pop();
      if (okIdx.indexOf(pick) < 0) pick = okIdx[0];
    } else {
      pick = okIdx[Math.floor(Math.random() * okIdx.length)];
    }
    return K.fmt(pool[pick], ctx);
  };

  // ---------- хранилище, счётчики, находки ----------
  const PREFIX = 'eblan.kts.';
  K.store = {
    get: (k, d) => G.store.getJSON(PREFIX + k, d),
    set: (k, v) => G.store.setJSON(PREFIX + k, v),
  };
  const counters = K.store.get('counters', {}) || {};
  K.counter = (key) => Number(counters[key]) || 0;
  K.count = (key, delta = 1) => {
    const value = K.counter(key) + delta;
    counters[key] = value;
    K.store.set('counters', counters);
    G.emit('kts:count', { key, value, delta });
    return value;
  };
  K.setCounter = (key, value) => {
    counters[key] = value;
    K.store.set('counters', counters);
    G.emit('kts:count', { key, value, delta: 0 });
    return value;
  };

  const SECTION_OF = { secret: 'secrets', duck: 'ducks', ach: 'achievements', skin: 'skins' };
  const found = K.store.get('found', {}) || {};
  K.has = (kind, id) => !!(found[kind] && found[kind][id]);
  K.found = (kind) => Object.keys(found[kind] || {});
  K.total = (kind) => K.all(SECTION_OF[kind] || kind).length;
  K.unlock = (kind, id, info) => {
    if (!K.enabled || K.has(kind, id)) return false;
    const set = found[kind] || (found[kind] = {});
    set[id] = Date.now();
    K.store.set('found', found);
    const section = SECTION_OF[kind];
    const def = section ? K.raw(section, id) : null;
    const ev = { kind, id, def, n: K.found(kind).length, total: K.total(kind), info: info || null };
    G.emit('kts:unlock', ev);
    G.emit('kts:' + kind, ev);
    return true;
  };
  K.secret = (id, info) => K.unlock('secret', id, info);
  K.duck = (id, info) => K.unlock('duck', id, info);
  K.ach = (id, info) => K.unlock('ach', id, info);
  K.skin = (id, info) => K.unlock('skin', id, info);

  // ---------- дата ----------
  const pad = (n) => String(n).padStart(2, '0');
  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }
  function makeToday() {
    let d = new Date(Date.now());
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(Q.date || '');
    if (dm) d = new Date(+dm[1], +dm[2] - 1, +dm[3], d.getHours(), d.getMinutes());
    const tm = /^(\d{1,2}):(\d{2})$/.exec(Q.time || '');
    if (tm) d = new Date(d.getFullYear(), d.getMonth(), d.getDate(), +tm[1], +tm[2]);
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate(), dow = d.getDay();
    return {
      date: d,
      y, m, d: day, dow,
      hh: d.getHours(),
      mm: d.getMinutes(),
      iso: `${y}-${pad(m)}-${pad(day)}`,
      md: `${pad(m)}-${pad(day)}`,
      week: isoWeek(d),
      monday: dow === 1,
      tuesday: dow === 2,
      wednesday: dow === 3,
      friday: dow === 5,
      friday13: dow === 5 && day === 13,
    };
  }
  K.today = makeToday();
  // Окно 'MM-DD'..'MM-DD', через Новый год тоже работает.
  K.inWindow = (from, to, today) => {
    const md = (today || K.today).md;
    return from <= to ? md >= from && md <= to : md >= from || md <= to;
  };
  K.event = (id) => {
    const c = K.get('calendar', id);
    return !!(c && c.from && c.to && K.inWindow(c.from, c.to));
  };
  K.ktsAge = () => {
    const c = K.get('calendar', 'ktsBirthday');
    if (!c) return 0;
    const t = K.today;
    return t.y - c.founded - (t.m < c.month || (t.m === c.month && t.d < c.day) ? 1 : 0);
  };

  // ---------- случайность ----------
  K.hash = (str) => {
    let h = 2166136261;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  K.rng = (seed) => {
    let a = (typeof seed === 'number' ? seed : K.hash(seed)) >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  K.dayRng = (salt) => K.rng(K.today.iso + ':' + (salt || ''));

  const emitDay = () => G.emit('kts:day', K.today);
  G.on('boot', emitDay);
  G.on('start', () => {
    K.today = makeToday();
    emitDay();
  });
})();
