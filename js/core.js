/* Движок «Давай ебланить». Владелец — интегратор; модули пользуются API из CONTRACT.md и этот файл не правят. */
(() => {
  'use strict';
  const G = (window.G = {});
  const TAU = Math.PI * 2;

  G.TAU = TAU;
  G.BASE_H = 300;
  G.MIN_WORLD_W = 520;
  G.FONT_DISPLAY = 'Oswald, Impact, "Arial Narrow", sans-serif';
  G.FONT_BODY = '"Golos Text", system-ui, -apple-system, "Segoe UI", sans-serif';
  G.LAYER = { BG: 0, WALL: 10, COUCH: 20, SEAT: 30, BACK: 35, PICKUPS: 40, OBSTACLES: 50, BUNNY: 60, FX: 70, FRONT: 80, SCREEN: 90 };

  G.cfg = {
    gravity: 2300,
    jumpV: 760,
    djumpV: 640,
    fastFall: 2600,
    maxJumps: 2,
    coyote: 0.08,
    jumpBuffer: 0.12,
    landPriority: 0.07,
    minPerSec: 4,
    startClockMin: 9 * 60,
    runX: 96,
    heroScale: 1.7,
    heroClockDx: 92,
    baseSpeed: 300,
    speedGain: 270,
    speedTau: 90,
    restartDelay: 0.9,
    overlayDelay: 0.65,
    nearMargin: 14,
    hitbox: { dx: 2, dy: 22, r: 18 },
    dtMax: 0.04,
    maxCanvasPx: 4.2e6,
  };

  G.stage = document.getElementById('stage');
  G.canvas = document.getElementById('game');
  G.ctx = G.canvas.getContext('2d');

  G.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
    getJSON(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    setJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  // ---------- ошибки ----------
  G.errors = [];
  const reported = new Set();
  G.report = (tag, e) => {
    const msg = (e && e.message) || String(e);
    const key = tag + '|' + msg;
    if (reported.has(key)) return;
    reported.add(key);
    G.errors.push({ tag, message: msg, stack: e && e.stack ? String(e.stack) : '' });
    console.error('[G] ' + tag + ': ' + msg, e);
  };

  // ---------- события ----------
  const listeners = Object.create(null);
  G.on = (evt, fn) => {
    (listeners[evt] || (listeners[evt] = [])).push(fn);
    return () => G.off(evt, fn);
  };
  G.off = (evt, fn) => {
    const ls = listeners[evt];
    if (!ls) return;
    const i = ls.indexOf(fn);
    if (i >= 0) ls.splice(i, 1);
  };
  G.emit = (evt, ...args) => {
    const ls = listeners[evt];
    if (!ls) return;
    for (const fn of ls.slice()) {
      try { fn(...args); } catch (e) { G.report('event ' + evt, e); }
    }
  };

  // ---------- модификаторы и флаги (живут один забег) ----------
  const mods = Object.create(null);
  const flags = Object.create(null);
  G.setMod = (name, owner, value) => {
    const m = mods[name] || (mods[name] = Object.create(null));
    if (value === null || value === undefined) delete m[owner];
    else m[owner] = value;
  };
  G.mod = (name) => {
    const m = mods[name];
    let v = 1;
    if (m) for (const k in m) v *= m[k];
    return v;
  };
  G.modSum = (name) => {
    const m = mods[name];
    let v = 0;
    if (m) for (const k in m) v += m[k];
    return v;
  };
  G.setFlag = (name, owner, on) => {
    const f = flags[name] || (flags[name] = Object.create(null));
    if (on) f[owner] = true;
    else delete f[owner];
  };
  G.flag = (name) => {
    const f = flags[name];
    if (f) for (const k in f) return true;
    return false;
  };
  function clearRunMods() {
    for (const n in mods) delete mods[n];
    for (const n in flags) delete flags[n];
  }

  // ---------- цвета из CSS-токенов ----------
  G.C = {};
  G.colorKeys = new Set(['wall', 'couch', 'couch-hi', 'couch-lo', 'seat', 'seat-lo', 'ink', 'muted', 'panel', 'line', 'art', 'bunny', 'bunny-lo', 'pink', 'rim', 'rim-lo', 'face', 'metal', 'accent', 'carrot', 'leaf', 'card']);
  G.isDark = () => {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  };
  G.readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    for (const k of G.colorKeys) G.C[k] = cs.getPropertyValue('--' + k).trim() || G.C[k] || '#888888';
    G.emit('theme', { dark: G.isDark() });
  };

  // ---------- prefers-reduced-motion ----------
  G.calm = false;
  const calmMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function syncCalm() {
    const calm = !!(calmMQ && calmMQ.matches);
    if (calm === G.calm) return;
    G.calm = calm;
    G.emit('calm', calm);
  }
  syncCalm();
  if (calmMQ) {
    if (calmMQ.addEventListener) calmMQ.addEventListener('change', syncCalm);
    else if (calmMQ.addListener) calmMQ.addListener(syncCalm);
  }

  // ---------- рисование ----------
  G.draw = {
    rr(ctx, x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },
    ellipse(ctx, x, y, rx, ry, rot = 0) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
      ctx.fill();
    },
    font(ctx, weight, size, family) {
      ctx.font = `${weight} ${size}px ${family === 'body' ? G.FONT_BODY : G.FONT_DISPLAY}`;
    },
  };

  // ---------- утилиты ----------
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, k) => a + (b - a) * k;
  G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  G.pad = (n) => String(n).padStart(2, '0');
  G.fmtMin = (m) => (m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч ${G.pad(m % 60)} мин`);
  G.fmtClock = (min) => G.pad(Math.floor(min / 60) % 24) + ':' + G.pad(min % 60);

  // ---------- состояние ----------
  const newStats = () => ({ jumps: 0, doubleJumps: 0, carrots: 0, pickups: {}, nearMisses: 0, passed: 0, passedByType: {}, smashed: 0, bonusMin: 0 });
  G.state = {
    mode: 'start',
    t: 0,
    idleT: 0,
    realT: 0,
    dist: 0,
    speed: 0,
    baseSpeed: 0,
    dx: 0,
    dt: 0,
    timeMin: 0,
    bonusMin: 0,
    best: Number(G.store.get('eblan.best', 0)) || 0,
    overAt: 0,
    overShown: false,
    skin: 'classic',
    runs: 0,
    stats: newStats(),
    lastDeath: null,
  };
  G.bunny = { x: 0, size: G.cfg.heroScale, alt: 0, v: 0, jumps: 0, coyote: 0, airT: 0, phase: 0, dead: false };
  G.input = { held: false, bufferT: 0, fastFall: false };
  G.camera = { x: 0, y: 0, zoom: 1, rot: 0, fx: 0, fy: 0 };

  G.heroX = () => G.W / 2 - 40;
  G.speedAt = (t) => G.cfg.baseSpeed + G.cfg.speedGain * (1 - Math.exp(-t / G.cfg.speedTau));
  G.score = () => Math.floor(G.state.timeMin) + G.state.bonusMin;
  G.clockMin = () => (G.cfg.startClockMin + Math.floor(G.state.t * G.cfg.minPerSec)) % 1440;
  G.maxJumps = () => G.cfg.maxJumps + G.modSum('jumps');
  G.bunnyHitbox = () => {
    const hb = G.cfg.hitbox;
    return { x: G.bunny.x + hb.dx, y: G.bunny.alt + hb.dy, r: hb.r * G.mod('hitbox') };
  };

  // ---------- сущности ----------
  G.obstacles = [];
  G.pickups = [];
  G.obstacleTypes = Object.create(null);
  G.pickupTypes = Object.create(null);

  G.registerObstacle = (def) => {
    G.obstacleTypes[def.id] = Object.assign(
      { kind: 'ground', minT: 0, weight: () => 1, width: 40, causes: ['Работа победила.'], hitWord: 'ОЙ!', hit: () => false },
      def
    );
  };
  G.registerPickup = (def) => {
    G.pickupTypes[def.id] = Object.assign({ radius: 12, minT: 0, weight: () => 1 }, def);
  };

  function weightedPick(types, t, filter) {
    let total = 0;
    const pool = [];
    for (const id in types) {
      const def = types[id];
      if ((def.minT || 0) > t) continue;
      if (filter && !filter(def)) continue;
      const w = Math.max(0, Number(def.weight(t)) || 0);
      if (w <= 0) continue;
      pool.push([id, w]);
      total += w;
    }
    if (!total) return null;
    let r = Math.random() * total;
    for (const [id, w] of pool) {
      r -= w;
      if (r <= 0) return id;
    }
    return pool[pool.length - 1][0];
  }
  G.pickObstacleType = (t = G.state.t, filter) => weightedPick(G.obstacleTypes, t, filter);
  G.pickPickupType = (t = G.state.t, filter) => weightedPick(G.pickupTypes, t, filter);

  function createObstacle(id, x, opts) {
    const def = G.obstacleTypes[id];
    if (!def) return null;
    const o = { type: id, x, alt: 0, rot: 0, drift: 1, seed: Math.random() * 100 };
    if (def.make) def.make(o, opts || {});
    return o;
  }
  G.spawnObstacle = (id, x, opts) => {
    const o = createObstacle(id, x, opts);
    if (!o) return null;
    G.obstacles.push(o);
    G.emit('spawn', o, G.obstacleTypes[id]);
    return o;
  };
  G.spawnPickup = (id, x, alt, opts) => {
    const type = id || G.pickPickupType();
    const def = type && G.pickupTypes[type];
    if (!def) return null;
    const p = { type, x, alt, seed: Math.random() * 100 };
    if (def.make) def.make(p, opts || {});
    G.pickups.push(p);
    G.emit('spawnPickup', p, def);
    return p;
  };
  G.collect = (p) => {
    if (p.taken) return;
    p.taken = true;
    const def = G.pickupTypes[p.type];
    const stats = G.state.stats;
    stats.pickups[p.type] = (stats.pickups[p.type] || 0) + 1;
    if (def && def.collect) def.collect(p);
    G.emit('pickup', p, def);
  };
  G.knock = (o, vx, vy, vr) => {
    o.ballistic = true;
    o.deco = true;
    o.vx = vx;
    o.vy = vy;
    o.vr = vr;
    o.alt = o.alt || 0;
    o.rot = o.rot || 0;
  };
  G.smash = (o) => {
    if (o.dead) return;
    o.dead = true;
    G.state.stats.smashed++;
    G.knock(o, 220 + Math.random() * 180, 420 + Math.random() * 260, (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 6));
    G.emit('smash', o);
  };
  G.addBonus = (minutes, info) => {
    if (G.state.mode !== 'run') return;
    const m = Math.round(minutes);
    if (!m) return;
    G.state.bonusMin += m;
    G.state.stats.bonusMin += m;
    G.emit('bonus', Object.assign({ minutes: m }, info || {}));
  };

  // ---------- таймеры (реальное время, стоят на паузе) ----------
  const timers = [];
  G.after = (sec, fn) => {
    timers.push({ at: G.state.realT + sec, fn });
  };
  function runTimers() {
    for (let i = timers.length - 1; i >= 0; i--) {
      if (G.state.realT >= timers[i].at) {
        const tm = timers.splice(i, 1)[0];
        try { tm.fn(); } catch (e) { G.report('timer', e); }
      }
    }
  }

  // ---------- ход игры ----------
  G.startGame = () => {
    const S = G.state;
    if (S.mode === 'run') return;
    const fromStart = S.mode === 'start';
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    clearRunMods();
    S.mode = 'run';
    S.t = 0;
    S.dist = 0;
    S.dx = 0;
    S.timeMin = 0;
    S.bonusMin = 0;
    S.stats = newStats();
    S.overShown = false;
    S.lastDeath = null;
    S.runs++;
    S.baseSpeed = G.speedAt(0);
    S.speed = S.baseSpeed;
    const hero = G.obstacles.find((o) => o.hero);
    G.obstacles = [];
    G.pickups = [];
    if (fromStart && hero) {
      hero.hero = false;
      G.knock(hero, 300, 700, 8);
      G.obstacles.push(hero);
    }
    const B = G.bunny;
    B.alt = 0;
    B.v = 0;
    B.jumps = 0;
    B.airT = 0;
    B.coyote = 0;
    B.dead = false;
    G.input.bufferT = 0;
    G.input.fastFall = false;
    G.emit('start', { fromStart, run: S.runs });
  };

  G.die = (o) => {
    const S = G.state;
    if (S.mode !== 'run') return;
    const B = G.bunny;
    const def = G.obstacleTypes[o.type] || {};
    S.mode = 'over';
    S.overAt = S.realT;
    S.overShown = false;
    B.dead = true;
    B.v = 380;
    G.input.bufferT = 0;
    G.input.fastFall = false;
    const score = G.score();
    const prevBest = S.best;
    const isRecord = score > prevBest;
    if (isRecord) {
      S.best = score;
      G.store.set('eblan.best', score);
    }
    clearRunMods();
    const causes = def.causes && def.causes.length ? def.causes : ['Работа победила.'];
    const info = {
      o,
      type: o.type,
      def,
      score,
      isRecord,
      prevBest,
      best: S.best,
      t: S.t,
      clockMin: G.clockMin(),
      stats: S.stats,
      cause: G.pick(causes),
      hitWord: def.hitWord || 'ОЙ!',
    };
    S.lastDeath = info;
    G.emit('die', info);
    G.after(G.cfg.overlayDelay, () => {
      if (S.mode === 'over' && S.lastDeath === info) {
        S.overShown = true;
        G.emit('gameover', info);
      }
    });
  };

  G.pause = () => {
    if (G.state.mode !== 'run') return;
    G.state.mode = 'pause';
    G.input.fastFall = false;
    G.input.held = false;
    G.emit('pause');
  };
  G.resume = () => {
    if (G.state.mode !== 'pause') return;
    G.state.mode = 'run';
    G.emit('resume');
  };

  G.press = (source) => {
    G.emit('input', source);
    const S = G.state;
    if (S.mode === 'start') return G.startGame();
    if (S.mode === 'pause') return G.resume();
    if (S.mode === 'over') {
      if (S.overShown && S.realT - S.overAt > G.cfg.restartDelay) G.startGame();
      return;
    }
    G.input.held = true;
    G.input.bufferT = G.cfg.jumpBuffer;
  };
  G.release = () => {
    if (!G.input.held) return;
    G.input.held = false;
    G.emit('release');
  };

  // ---------- обновление ----------
  const updaters = [];
  G.onUpdate = (fn, order = 50) => {
    updaters.push({ fn, order, seq: updaters.length });
    updaters.sort((a, b) => a.order - b.order || a.seq - b.seq);
  };

  function doJump(n) {
    const B = G.bunny, S = G.state;
    B.v = (n === 1 ? G.cfg.jumpV : G.cfg.djumpV) * G.mod('jumpV');
    B.jumps = n;
    B.coyote = 0;
    S.stats.jumps++;
    if (n > 1) S.stats.doubleJumps++;
    G.emit('jump', { n, double: n > 1 });
  }

  function updateBunny(dt) {
    const B = G.bunny, cfg = G.cfg;
    if (B.alt > 0 || B.v > 0) {
      const ff = G.input.fastFall && B.v < 200 ? cfg.fastFall : 0;
      const a = cfg.gravity * G.mod('gravity') + ff;
      // точная баллистика: высота прыжка не зависит от частоты кадров (30, 60 и 120 Гц прыгают одинаково)
      B.alt += B.v * dt - 0.5 * a * dt * dt;
      B.v -= a * dt;
      B.airT += dt;
      if (B.alt <= 0) {
        const impact = -B.v;
        B.alt = 0;
        B.v = 0;
        B.jumps = 0;
        B.airT = 0;
        G.emit('land', { impact });
      }
    }
    const grounded = B.alt <= 0;
    B.coyote = grounded ? cfg.coyote : Math.max(0, B.coyote - dt);
    if (G.input.bufferT > 0) {
      const landSoon = B.v < 0 && B.alt > 0 && B.alt < -B.v * (cfg.landPriority || 0);
      let n = 0;
      if (B.jumps === 0 && B.coyote > 0) n = 1;
      else if (landSoon) n = 0;
      else if (B.jumps === 0) n = 2;
      else if (B.jumps < G.maxJumps()) n = B.jumps + 1;
      if (n) {
        doJump(n);
        G.input.bufferT = 0;
      } else {
        G.input.bufferT -= dt;
      }
    }
    B.phase += G.state.dx / 12;
  }

  function moveEntities(dt) {
    const dx = G.state.dx;
    for (const o of G.obstacles) {
      if (o.ballistic) {
        o.x += o.vx * dt;
        o.alt += o.vy * dt;
        o.vy -= G.cfg.gravity * 0.55 * dt;
        o.rot += o.vr * dt;
        continue;
      }
      o.x -= dx * (o.drift == null ? 1 : o.drift);
      const def = G.obstacleTypes[o.type];
      if (def && def.update) def.update(o, dt);
    }
    for (const p of G.pickups) {
      if (p.taken) continue;
      p.x -= dx;
      const def = G.pickupTypes[p.type];
      if (def && def.update) def.update(p, dt);
    }
  }

  function collide() {
    const S = G.state;
    const hb = G.bunnyHitbox();
    const near = { x: hb.x, y: hb.y, r: hb.r + G.cfg.nearMargin };
    for (const o of G.obstacles) {
      if (o.deco || o.dead) continue;
      const def = G.obstacleTypes[o.type];
      if (!def) continue;
      if (def.hit(o, hb)) {
        const hit = { o, def, cancel: G.flag('invincible') };
        G.emit('hit', hit);
        if (hit.cancel) {
          G.smash(o);
          continue;
        }
        G.die(o);
        return;
      }
      if (!o.near && def.hit(o, near)) o.near = true;
      const halfW = (o.w || def.width) / 2;
      if (!o.passed && o.x + halfW < hb.x - hb.r) {
        o.passed = true;
        S.stats.passed++;
        S.stats.passedByType[o.type] = (S.stats.passedByType[o.type] || 0) + 1;
        if (o.near) S.stats.nearMisses++;
        G.emit('pass', o, { near: !!o.near });
      }
    }
    for (const p of G.pickups) {
      if (p.taken) continue;
      const def = G.pickupTypes[p.type];
      if (!def) continue;
      const r = def.radius + hb.r, ddx = p.x - hb.x, ddy = p.alt - hb.y;
      if (ddx * ddx + ddy * ddy < r * r) G.collect(p);
    }
  }

  function cleanup() {
    const W = G.W, obs = G.obstacles, pks = G.pickups;
    let j = 0;
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      if (o.remove || o.x < -160 || (o.alt || 0) < -300 || (o.ballistic && o.x > W + 200) || o.x >= W + 2000) continue;
      obs[j++] = o;
    }
    obs.length = j;
    j = 0;
    for (let i = 0; i < pks.length; i++) {
      const p = pks[i];
      if (!p.taken && !p.remove && p.x > -80) pks[j++] = p;
    }
    pks.length = j;
  }

  function update(dt) {
    const S = G.state, B = G.bunny, cfg = G.cfg;
    const sdt = dt * G.mod('time');
    S.dt = sdt;
    S.idleT += sdt;
    S.dx = 0;
    if (S.mode === 'run') {
      S.t += sdt;
      S.baseSpeed = G.speedAt(S.t);
      S.speed = S.baseSpeed * G.mod('speed');
      S.dx = S.speed * sdt;
      S.dist += S.dx;
      S.timeMin += sdt * cfg.minPerSec * G.mod('score');
      updateBunny(sdt);
      moveEntities(sdt);
    } else if (S.mode === 'over') {
      if (B.alt > 0 || B.v > 0) {
        B.v -= cfg.gravity * sdt;
        B.alt = Math.max(0, B.alt + B.v * sdt);
        if (B.alt === 0) B.v = 0;
      }
    } else if (S.mode === 'start') {
      const hero = G.obstacles.find((o) => o.hero);
      if (hero) hero.x = G.heroX() + cfg.heroClockDx;
    }
    const k = Math.min(1, dt * 7);
    const start = S.mode === 'start';
    B.x += ((start ? G.heroX() : cfg.runX) - B.x) * k;
    B.size += ((start ? cfg.heroScale : 1) - B.size) * k;

    for (const u of updaters) {
      try { u.fn(sdt, dt); } catch (e) { G.report('update', e); }
    }
    if (S.mode === 'run') collide();
    cleanup();
  }

  // ---------- отрисовка ----------
  const renderers = [];
  G.onRender = (layer, fn) => {
    renderers.push({ layer, fn, seq: renderers.length });
    renderers.sort((a, b) => a.layer - b.layer || a.seq - b.seq);
  };

  G.onRender(G.LAYER.PICKUPS, (ctx) => {
    for (const p of G.pickups) {
      const def = G.pickupTypes[p.type];
      if (!def || !def.draw) continue;
      ctx.save();
      def.draw(ctx, p);
      ctx.restore();
    }
  });
  G.onRender(G.LAYER.OBSTACLES, (ctx) => {
    for (const o of G.obstacles) {
      const def = G.obstacleTypes[o.type];
      if (!def || !def.draw) continue;
      ctx.save();
      def.draw(ctx, o);
      ctx.restore();
    }
  });

  function render() {
    const ctx = G.ctx, s = G.scale * G.dpr, cam = G.camera;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, G.canvas.width, G.canvas.height);
    for (const r of renderers) {
      ctx.save();
      ctx.setTransform(s, 0, 0, s, 0, 0);
      if (r.layer < G.LAYER.SCREEN) {
        ctx.translate(cam.x, cam.y);
        if (cam.zoom !== 1 || cam.rot) {
          ctx.translate(cam.fx, cam.fy);
          ctx.rotate(cam.rot);
          ctx.scale(cam.zoom, cam.zoom);
          ctx.translate(-cam.fx, -cam.fy);
        }
      }
      try { r.fn(ctx); } catch (e) { G.report('render', e); }
      ctx.restore();
    }
  }

  // ---------- размеры ----------
  G.dpr = 1;
  G.scale = 1;
  G.W = G.MIN_WORLD_W;
  G.H = G.BASE_H;
  G.GROUND = G.BASE_H - 50;
  G.resize = () => {
    const r = G.stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    G.dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(G.cfg.maxCanvasPx / (r.width * r.height))));
    G.canvas.width = Math.round(r.width * G.dpr);
    G.canvas.height = Math.round(r.height * G.dpr);
    G.scale = Math.min(r.height / G.BASE_H, r.width / G.MIN_WORLD_W);
    G.W = r.width / G.scale;
    G.H = r.height / G.scale;
    G.GROUND = G.H - 50;
    G.camera.fx = G.W / 2;
    G.camera.fy = G.H / 2;
    G.emit('resize');
  };

  // ---------- цикл ----------
  let last = 0;
  function frame(now) {
    const dt = last ? Math.min(G.cfg.dtMax, Math.max(0, (now - last) / 1000)) : 0;
    last = now;
    try {
      if (G.state.mode !== 'pause') {
        G.state.realT += dt;
        runTimers();
        update(dt);
      }
      render();
    } catch (e) {
      G.report('frame', e);
    }
    requestAnimationFrame(frame);
  }

  // ---------- ввод ----------
  const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW', 'Enter']);
  function bindInput() {
    G.stage.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('button, a, input, select, textarea, label, [data-noinput]')) {
        G.emit('input', 'control');
        return;
      }
      e.preventDefault();
      G.press('pointer');
    });
    window.addEventListener('pointerup', () => G.release());
    window.addEventListener('pointercancel', () => G.release());
    G.stage.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      const tgt = e.target;
      if (tgt && tgt.closest && tgt.closest('input, textarea, select, [contenteditable]')) return;
      const onControl = tgt && tgt.closest && tgt.closest('button, a');
      if (JUMP_KEYS.has(e.code)) {
        if (onControl && (e.code === 'Space' || e.code === 'Enter')) return;
        e.preventDefault();
        if (!e.repeat) G.press('key');
        return;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        G.input.fastFall = true;
        return;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (G.state.mode === 'run') G.pause();
        else if (G.state.mode === 'pause') G.resume();
        return;
      }
      G.emit('key', e);
    });
    window.addEventListener('keyup', (e) => {
      if (JUMP_KEYS.has(e.code)) G.release();
      if (e.code === 'ArrowDown' || e.code === 'KeyS') G.input.fastFall = false;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) G.pause();
    });
    window.addEventListener('blur', () => G.pause());
  }

  // ---------- запуск ----------
  G.boot = () => {
    G.readColors();
    G.resize();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => G.resize()).observe(G.stage);
    else window.addEventListener('resize', G.resize);
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', G.readColors);
      else if (mq.addListener) mq.addListener(G.readColors);
    }
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(G.readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    G.bunny.x = G.heroX();
    G.bunny.size = G.cfg.heroScale;
    const hero = createObstacle('clock', G.heroX() + G.cfg.heroClockDx, { r: 26, hands: 'meme', hero: true });
    if (hero) {
      hero.hero = true;
      hero.deco = true;
      hero.hands = 'meme';
      G.obstacles.push(hero);
    }
    bindInput();
    G.emit('boot');
    const fonts = document.fonts;
    if (fonts && fonts.ready && typeof fonts.ready.then === 'function') {
      fonts.ready.then(() => G.emit('fonts'), () => {});
    }
    requestAnimationFrame(frame);
  };
})();
