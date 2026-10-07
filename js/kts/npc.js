/* Бот-токсик (шайтан-машина): раз за забег облачко-предсказание, честное сбывание через режиссёра, блокировка касанием в двойном прыжке. Владелец — П2. */
(() => {
  'use strict';
  const G = window.G;
  const K = G.kts;
  if (!K || !K.enabled) return;

  const TAU = Math.PI * 2;
  const clamp = G.clamp;
  const ID = 'toxic';
  const OFF_KEY = 'npc.toxicOff';
  const LAYER_BOT = G.LAYER.FX + 3;
  const TOAST_KIND = 'info';

  const ENTER_T = 1.2, TEL_T = 1, SWOOP_T = 0.45, OUT_T = 1.1, AWAY_T = 0.9, BLOCKED_T = 1.1;
  const PLACE_WAIT = 4, MAX_LEAD = 5, RESERVE_T = 10, PLAN_STEP = 0.25, POSTPONE_T = 2, MAX_POSTPONE = 4;
  const HOLD_TAIL = 0.9, CLEAR_PAD = 0.3, CATCH_TAIL = 0.15;
  const BODY_R = 15, TOUCH_SLACK = 4, HOVER_DX = 6, HOVER_K = 0.6;
  const SPR_W = 46, SPR_H = 46, SPR_OX = 23, SPR_OY = 25;
  const BUBBLE_MAX_W = 168;
  const INK = { angry: '#8dff5a', kind: '#ff6fa8', blocked: '#ff4d4d' };
  const ALERT = '#e5484d';

  const conf = () => K.get('npc', ID);
  const isOff = () => !!K.store.get(OFF_KEY, false);
  const running = () => G.state.mode === 'run';

  // ---------- одна KTS-NPC на экране ----------
  let holder = null;
  const others = Object.create(null);
  function otherBusy() {
    if (holder && holder !== ID) return true;
    for (const k in others) if (others[k]) return true;
    return false;
  }
  G.on('kts:event', (e) => {
    if (!e || e.id !== 'vivi') return;
    others.vivi = e.phase === 'start';
  });

  // ---------- состояние забега ----------
  const bot = {
    phase: 'off', t: 0, enterAt: Infinity, postponed: 0,
    x: 0, alt: 0, fromX: 0, fromAlt: 0, spin: 0,
    mood: 'angry', said: null, placed: true, waitT: 0, telAt: -1, blocked: false,
    bubble: null, force: null,
  };
  const said = { group: '', text: '', t: 0, kind: false, fulfilled: false };

  function emit(phase, text) {
    G.emit('kts:npc', { id: ID, phase, text: text || '' });
  }
  function setPhase(p) {
    bot.phase = p;
    bot.t = 0;
  }
  function resetBot() {
    bot.phase = 'off';
    bot.t = 0;
    bot.enterAt = Infinity;
    bot.postponed = 0;
    bot.mood = 'angry';
    bot.said = null;
    bot.placed = true;
    bot.waitT = 0;
    bot.telAt = -1;
    bot.blocked = false;
    bot.bubble = null;
    bot.force = null;
    if (holder === ID) holder = null;
  }

  // ---------- режиссёр ----------
  function director(name) {
    const d = G.director;
    return d && typeof d[name] === 'function' ? d : null;
  }
  function busy(a, b) {
    const d = director('busy');
    if (!d) return null;
    try {
      return d.busy(a, b);
    } catch (e) {
      G.report('kts npc busy', e);
      return null;
    }
  }
  function modeOn(name) {
    const d = director('modes');
    const m = d ? d.modes() : null;
    return !!(m && m.indexOf(name) >= 0);
  }
  function blockedNow() {
    if (otherBusy()) return true;
    const chase = G.modes && typeof G.modes.chase === 'function' ? !!G.modes.chase() : modeOn('chase');
    const boss = G.allhands && typeof G.allhands.active === 'function' ? G.allhands.active() : modeOn('boss');
    return chase || !!boss;
  }
  function feverOn() {
    if (G.modes && typeof G.modes.feverLeft === 'function') return G.modes.feverLeft() > 0;
    return modeOn('fever');
  }

  const has = (id, t) => {
    const d = G.obstacleTypes[id];
    return !!d && (d.minT || 0) <= t;
  };
  const ground = (ob, opts) => ({ ob, kind: 'ground', opts, strict: true });
  const call = (level, extra) => Object.assign({ ob: 'call', kind: 'air', opts: { level } }, extra);
  const RECIPES = {
    clocks: { needs: ['clock'], steps: () => [ground('clock', { r: 18 }), ground('clock', { r: 18 }), ground('clock', { r: 18 })] },
    tasks: { needs: ['tasks'], steps: () => [ground('tasks', { n: 2 }), ground('tasks', { n: 3 }), ground('tasks', { n: 4 })] },
    calls: { needs: ['call'], steps: () => [{ kind: 'ground' }, call(1, { under: true }), call(1), { kind: 'ground' }] },
    pings: { needs: ['ping'], steps: () => [ground('ping'), ground('ping')] },
    deadline: { needs: ['deadline'], steps: () => [{ ob: 'deadline', kind: 'ground', loose: true }] },
    carrots: { needs: [], steps: () => [{ free: true }, { rest: 0.15 }, { free: true }] },
    gold: { needs: [], steps: () => [{ free: true, apexId: G.pickupTypes.gold ? 'gold' : 'carrot' }] },
  };
  function recipeReady(name) {
    const r = RECIPES[name];
    if (!r || !director('inject')) return false;
    const t = G.state.t + 3;
    for (const id of r.needs) if (!has(id, t)) return false;
    return true;
  }
  function order(name) {
    const d = director('inject');
    if (!d) return false;
    bot.placed = false;
    try {
      d.inject([{ rest: 0.3 }, ...RECIPES[name].steps(), { rest: 0.3 }, { fn: () => { bot.placed = true; } }]);
    } catch (e) {
      bot.placed = true;
      G.report('kts npc inject', e);
      return false;
    }
    return true;
  }

  // Когда все уже поставленные препятствия пройдут кролика, с запасом на разгон мира.
  function lastPass() {
    const S = G.state, hb = G.bunnyHitbox();
    let last = 0;
    for (const o of G.obstacles) {
      if (o.deco || o.dead || o.ballistic || o.passed) continue;
      const def = G.obstacleTypes[o.type];
      const v = S.speed * (o.drift == null ? 1 : o.drift) * 0.9;
      if (!(v > 1)) return Infinity;
      const half = (o.w || (def && def.width) || 40) / 2 + hb.r + 10;
      last = Math.max(last, (o.x + half - hb.x) / v);
    }
    return last;
  }

  // ---------- предсказание ----------
  function groupsOf(def) {
    const out = [];
    for (const g in def.lines || {}) if (def.lines[g] && Array.isArray(def.lines[g].text)) out.push(g);
    return out;
  }
  function choose(def) {
    const force = bot.force || {};
    if (force.kind || (!force.group && Math.random() < (def.kindChance || 0))) {
      const text = K.line('npc.toxic.kind');
      if (text) return { group: 'kind', text, kind: true, recipe: 'gold' };
    }
    const groups = groupsOf(def);
    const ready = groups.filter((g) => def.lines[g].recipe && recipeReady(def.lines[g].recipe));
    let group = force.group && groups.indexOf(force.group) >= 0 ? force.group : null;
    let fulfil = false;
    if (group) fulfil = !!def.lines[group].recipe && ready.indexOf(group) >= 0 && force.fulfil !== false;
    else if (ready.length && Math.random() < (def.fulfilChance || 0)) {
      group = G.pick(ready);
      fulfil = true;
    } else group = G.pick(groups);
    const text = group ? K.line(`npc.toxic.lines.${group}.text`) : null;
    if (!text) return null;
    return { group, text, kind: false, recipe: fulfil ? def.lines[group].recipe : null };
  }

  function predict() {
    const def = conf();
    const pick = def ? choose(def) : null;
    if (!pick) return false;
    said.group = pick.group;
    said.text = pick.text;
    said.t = G.state.t;
    said.kind = pick.kind;
    said.fulfilled = !!(pick.recipe && order(pick.recipe));
    bot.said = said;
    bot.mood = pick.kind ? 'kind' : 'angry';
    bot.bubble = null;
    if (pick.kind) {
      emit('kind', pick.text);
      const tt = def.kindToast;
      if (tt && G.ui && typeof G.ui.toast === 'function') G.ui.toast(tt.label, tt.text, { kind: TOAST_KIND, duration: 3 });
      K.ach('toxicBug');
    } else {
      G.emit('kts:npc', { id: ID, phase: 'predict', text: pick.text, fulfilled: said.fulfilled });
    }
    return true;
  }

  // ---------- появление и уход ----------
  function plan() {
    const def = conf();
    if (!def || isOff()) return;
    const from = Math.max(10, Number(def.from) || 22.5), until = Math.max(from, Number(def.until) || from);
    const free = [];
    for (let t = from; t <= until; t += PLAN_STEP) if (!busy(t - 1, t + RESERVE_T)) free.push(t);
    if (free.length) bot.enterAt = G.pick(free);
  }

  const hoverX = () => G.W * HOVER_K;
  const cruiseAlt = () => {
    const def = conf();
    return Math.max(140, Math.min((def && def.cruiseAlt) || 230, G.GROUND - 26));
  };
  const diveAlt = () => {
    const def = conf();
    return Math.min((def && def.diveAlt) || 185, cruiseAlt() - 20);
  };

  function enter() {
    holder = ID;
    bot.x = G.W + 40;
    bot.alt = cruiseAlt();
    bot.mood = 'angry';
    setPhase('enter');
    emit('enter');
  }
  function goAway(phase) {
    const leaving = bot.phase === 'out';
    bot.fromX = bot.x;
    bot.fromAlt = bot.alt;
    setPhase(phase);
    if (!leaving) emit('leave');
  }
  function gone() {
    bot.phase = 'gone';
    bot.bubble = null;
    if (holder === ID) holder = null;
  }

  function planDive() {
    const d = director('hold');
    const lead = Math.max(TEL_T, lastPass() + CLEAR_PAD);
    if (!d || !(lead <= MAX_LEAD)) return false;
    const def = conf();
    const span = lead + SWOOP_T + ((def && def.diveT) || 0.8) + HOLD_TAIL;
    d.hold(span);
    const r = director('reserve');
    if (r) r.reserve(G.state.t, G.state.t + span, ID);
    bot.telAt = G.state.t + lead - TEL_T;
    return true;
  }

  function touching() {
    const B = G.bunny;
    if ((B.jumps || 0) < 2 || B.alt <= 0) return false;
    const hb = G.bunnyHitbox();
    const dx = bot.x - hb.x, dy = bot.alt - hb.y, r = BODY_R + hb.r + TOUCH_SLACK;
    return dx * dx + dy * dy < r * r;
  }

  function block() {
    const def = conf() || {};
    bot.blocked = true;
    bot.mood = 'blocked';
    bot.bubble = null;
    const tt = def.blockToast || {};
    G.emit('kts:npc', { id: ID, phase: 'blocked', text: tt.text || '' });
    if (tt.label && G.ui && typeof G.ui.toast === 'function') G.ui.toast(tt.label, tt.text || null, { kind: TOAST_KIND, duration: 3.2 });
    const fx = G.fx;
    if (fx) {
      if (typeof fx.stamp === 'function') fx.stamp(def.blockStamp || 'ЗАБЛОКИРОВАН', { x: bot.x, alt: bot.alt + 26, color: ALERT, rot: -0.12 });
      else if (typeof fx.popup === 'function') fx.popup(bot.x, bot.alt + 26, def.blockStamp || 'ЗАБЛОКИРОВАН', { color: ALERT, size: 15, life: 1 });
      if (typeof fx.burst === 'function') fx.burst(bot.x, bot.alt, { n: G.calm ? 6 : 14, speed: 160, color: INK.angry, life: 0.45 });
    }
    const pu = G.powerups;
    if (pu && typeof pu.give === 'function' && pu.defs) {
      const pool = (def.rewards || []).filter((id) => pu.defs[id]);
      if (pool.length) pu.give(G.pick(pool));
    }
    K.secret('filter');
    goAway('blocked');
  }

  // ---------- кадр ----------
  const ease = (k) => k * k * (3 - 2 * k);
  const easeOut = (k) => 1 - (1 - k) * (1 - k);

  function update(dt) {
    const S = G.state;
    if (S.mode !== 'run') return;
    if (bot.phase === 'off') {
      if (S.t < bot.enterAt) return;
      if (blockedNow() || feverOn() || busy(S.t, S.t + RESERVE_T)) {
        if (++bot.postponed > MAX_POSTPONE) bot.phase = 'gone';
        else bot.enterAt = S.t + POSTPONE_T;
        return;
      }
      enter();
      return;
    }
    if (bot.phase === 'gone') return;
    bot.t += dt;
    const def = conf() || {};
    const early = bot.phase === 'enter' || bot.phase === 'say' || bot.phase === 'wait' || bot.phase === 'tel';
    if (early && blockedNow()) {
      goAway('away');
      return;
    }
    const hx = hoverX(), ca = cruiseAlt();
    switch (bot.phase) {
      case 'enter': {
        const k = easeOut(clamp(bot.t / ENTER_T, 0, 1));
        bot.x = G.W + 40 + (hx - G.W - 40) * k;
        bot.alt = ca;
        if (bot.t >= ENTER_T) {
          if (predict()) setPhase('say');
          else goAway('away');
        }
        break;
      }
      case 'say':
        bot.x = hx;
        bot.alt = ca;
        if (bot.t >= (def.sayT || 2.5)) {
          bot.bubble = null;
          bot.waitT = 0;
          bot.telAt = -1;
          setPhase('wait');
        }
        break;
      case 'wait':
        bot.x = hx;
        bot.alt = ca;
        bot.waitT += dt;
        if (bot.telAt < 0) {
          if (!bot.placed && bot.waitT < PLACE_WAIT) break;
          if (!planDive()) goAway('away');
        } else if (S.t >= bot.telAt) setPhase('tel');
        break;
      case 'tel':
        bot.x = hx;
        bot.alt = ca;
        if (bot.t >= TEL_T) {
          bot.fromX = bot.x;
          bot.fromAlt = bot.alt;
          setPhase('swoop');
          emit('dive');
        }
        break;
      case 'swoop': {
        const k = ease(clamp(bot.t / SWOOP_T, 0, 1));
        const tx = G.bunny.x + HOVER_DX, ta = diveAlt();
        bot.x = bot.fromX + (tx - bot.fromX) * k;
        bot.alt = bot.fromAlt + (ta - bot.fromAlt) * k;
        if (touching()) return block();
        if (bot.t >= SWOOP_T) setPhase('hover');
        break;
      }
      case 'hover':
        bot.x = G.bunny.x + HOVER_DX;
        bot.alt = diveAlt();
        if (touching()) return block();
        if (bot.t >= (def.diveT || 0.8)) goAway('out');
        break;
      case 'out': {
        if (bot.t < CATCH_TAIL && touching()) return block();
        const k = clamp(bot.t / OUT_T, 0, 1);
        bot.x = bot.fromX + (-70 - bot.fromX) * ease(k);
        bot.alt = bot.fromAlt + (ca + 30 - bot.fromAlt) * k * k;
        if (bot.t >= OUT_T) gone();
        break;
      }
      case 'away': {
        const k = clamp(bot.t / AWAY_T, 0, 1);
        bot.x = bot.fromX + (G.W + 60 - bot.fromX) * k * k;
        bot.alt = bot.fromAlt + 40 * k;
        if (bot.t >= AWAY_T) gone();
        break;
      }
      case 'blocked': {
        const k = clamp(bot.t / BLOCKED_T, 0, 1);
        bot.spin += dt * (G.calm ? 4 : 14);
        bot.x = bot.fromX + 140 * k;
        bot.alt = bot.fromAlt + 220 * k * k + 40 * Math.sin(k * Math.PI);
        if (bot.t >= BLOCKED_T) gone();
        break;
      }
    }
  }

  // ---------- экран проигрыша ----------
  function cameTrue(info) {
    const def = conf();
    if (!def || !bot.said || said.kind || bot.blocked || !info) return false;
    const g = def.lines && def.lines[said.group];
    if (!g) return false;
    if (Array.isArray(g.dieOn) && info.t > said.t && g.dieOn.indexOf(info.type) >= 0) return true;
    return g.diesBefore > 0 && info.t * G.cfg.minPerSec < g.diesBefore;
  }
  function prediction(kind, title, text) {
    if (!text) return null;
    return { kind, title: K.fmt(title || '') || '', text, toString() { return this.text; } };
  }
  function overLine(info) {
    const def = conf();
    if (!def || isOff()) return null;
    const o = def.over || {};
    if (bot.blocked && o.blocked) return prediction('blocked', o.blocked.title, K.line('npc.toxic.over.blocked.text'));
    if (bot.said && said.kind && o.kind) return prediction('kind', o.kind.title, said.text);
    if (o.right && cameTrue(info)) {
      K.ach('toxicRight');
      return prediction('right', o.right.title, said.text);
    }
    if (K.today && K.today.monday && o.monday) return prediction('monday', o.monday.title, K.line('npc.toxic.over.monday.text'));
    return o.next ? prediction('next', o.next.title, K.line('npc.toxic.over.next.text')) : null;
  }

  // ---------- события ----------
  G.on('start', () => {
    resetBot();
    others.vivi = false;
    api.lastPrediction = null;
    plan();
  });
  G.on('die', (info) => {
    try {
      api.lastPrediction = overLine(info);
    } catch (e) {
      api.lastPrediction = null;
      G.report('kts npc over', e);
    }
    gone();
  });
  G.onUpdate(update, 62);

  // ---------- рисунки ----------
  let cacheK = 0, cacheDirty = true;
  const sprites = { bot: Object.create(null), alert: null };
  const markDirty = () => { cacheDirty = true; };
  G.on('resize', markDirty);
  G.on('theme', markDirty);
  G.on('fonts', markDirty);

  function canvasOf(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  function sprite(w, h, ox, oy, paint) {
    const k = cacheK;
    const c = canvasOf(w * k, h * k);
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(k, 0, 0, k, ox * k, oy * k);
    paint(ctx);
    return { c, w, h, ox, oy };
  }
  function blit(ctx, sp, x, y) {
    if (sp) ctx.drawImage(sp.c, x - sp.ox, y - sp.oy, sp.w, sp.h);
  }
  function ensureCache() {
    const k = Math.max(0.5, (G.scale || 1) * (G.dpr || 1));
    if (!cacheDirty && k === cacheK) return;
    cacheDirty = false;
    cacheK = k;
    sprites.bot = Object.create(null);
    sprites.alert = sprite(18, 18, 9, 9, paintAlert);
    bot.bubble = null;
  }
  function botSprite(mood, frame) {
    const frames = sprites.bot[mood] || (sprites.bot[mood] = [null, null]);
    return frames[frame] || (frames[frame] = sprite(SPR_W, SPR_H, SPR_OX, SPR_OY, (c) => paintBot(c, mood, frame)));
  }

  function paintAlert(c) {
    c.fillStyle = ALERT;
    G.draw.ellipse(c, 0, 0, 7.5, 7.5, 0);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(0, 0, 7.5, 0, TAU);
    c.stroke();
    c.fillStyle = '#ffffff';
    G.draw.font(c, 700, 11, 'display');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('!', 0, 0.8);
  }

  function paintBot(c, mood, frame) {
    const dark = G.isDark();
    const edge = dark ? 'rgba(255,240,220,0.6)' : 'rgba(30,22,14,0.85)';
    const ink = INK[mood] || INK.angry;
    const body = mood === 'kind' ? '#f2c4d6' : dark ? '#3a404d' : '#2e333f';
    const bodyHi = mood === 'kind' ? '#fbe0ea' : dark ? '#4a5160' : '#3f4552';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = edge;
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(0, -12);
    c.lineTo(0, -17.5);
    c.stroke();
    c.fillStyle = dark ? 'rgba(210,218,230,0.55)' : 'rgba(58,64,78,0.5)';
    G.draw.ellipse(c, 0, -18.5, frame ? 7 : 17, 1.9, 0);
    c.fillStyle = edge;
    G.draw.ellipse(c, 0, -18.5, 2, 2, 0);
    c.fillStyle = body;
    c.strokeStyle = edge;
    c.lineWidth = 1.2;
    for (const s of [-1, 1]) {
      G.draw.rr(c, s > 0 ? 13 : -19, -4, 6, 10, 2.5);
      c.fill();
      c.stroke();
    }
    c.fillStyle = frame ? (mood === 'kind' ? '#ffd1e3' : '#ffb347') : 'rgba(255,179,71,0.35)';
    G.draw.ellipse(c, -16, 8.5, 1.6, 2.4, 0);
    G.draw.ellipse(c, 16, 8.5, 1.6, 2.4, 0);
    c.fillStyle = body;
    c.lineWidth = 1.4;
    G.draw.rr(c, -15, -12, 30, 24, 7);
    c.fill();
    c.stroke();
    c.fillStyle = bodyHi;
    G.draw.rr(c, -12, -10.5, 24, 3, 1.5);
    c.fill();
    c.fillStyle = '#10151c';
    G.draw.rr(c, -11, -6.5, 22, 14, 4);
    c.fill();
    c.strokeStyle = ink;
    c.fillStyle = ink;
    c.lineWidth = 2;
    if (mood === 'blocked') {
      for (const ex of [-5, 5]) {
        c.beginPath();
        c.moveTo(ex - 2.5, -2.5);
        c.lineTo(ex + 2.5, 2);
        c.moveTo(ex + 2.5, -2.5);
        c.lineTo(ex - 2.5, 2);
        c.stroke();
      }
    } else if (mood === 'kind') {
      c.lineWidth = 1.6;
      for (const ex of [-5, 5]) {
        c.beginPath();
        c.arc(ex, 0.5, 2.6, Math.PI * 1.1, Math.PI * 1.9);
        c.stroke();
      }
      c.beginPath();
      c.arc(0, 2.5, 3, Math.PI * 0.15, Math.PI * 0.85);
      c.stroke();
    } else {
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(s * 2, -0.5);
        c.lineTo(s * 8, -3.5);
        c.lineTo(s * 8, -0.5);
        c.lineTo(s * 3, 1.5);
        c.closePath();
        c.fill();
      }
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(-5, 5);
      for (let i = 1; i <= 5; i++) c.lineTo(-5 + i * 2, i & 1 ? 3.6 : 5.4);
      c.stroke();
    }
    c.fillStyle = frame ? ALERT : '#7a2a2a';
    G.draw.ellipse(c, 10.5, 8.6, 1.3, 1.3, 0);
  }

  function wrap(meas, text, maxW) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (cur && meas.measureText(next).width > maxW) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function makeBubble() {
    const def = conf() || {};
    const meas = canvasOf(1, 1).getContext('2d');
    if (!meas || !bot.said) return null;
    const head = String((said.kind ? def.kindName : def.name) || '').toUpperCase();
    G.draw.font(meas, 600, 9.5, 'body');
    const lines = wrap(meas, said.text, BUBBLE_MAX_W);
    let tw = 0;
    for (const l of lines) tw = Math.max(tw, meas.measureText(l).width);
    G.draw.font(meas, 700, 6.5, 'display');
    tw = Math.max(tw, meas.measureText(head).width);
    const w = Math.ceil(tw) + 14, h = 6 + 7 + 2 + lines.length * 11 + 4, tail = 7;
    const kind = said.kind;
    return sprite(w + tail + 2, h + 2, w + tail + 1, h / 2 + 1, (c) => {
      const x0 = -w - tail, y0 = -h / 2, x1 = -tail, y1 = h / 2, r = 6;
      c.fillStyle = kind ? '#fff3f8' : '#fffdf8';
      c.strokeStyle = kind ? 'rgba(200,60,120,0.75)' : 'rgba(43,34,25,0.85)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x0 + r, y0);
      c.arcTo(x1, y0, x1, y1, r);
      c.lineTo(x1, -4);
      c.lineTo(0, 0);
      c.lineTo(x1, 4);
      c.arcTo(x1, y1, x0, y1, r);
      c.arcTo(x0, y1, x0, y0, r);
      c.arcTo(x0, y0, x1, y0, r);
      c.closePath();
      c.fill();
      c.stroke();
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillStyle = kind ? '#c2185b' : '#3e8a1e';
      G.draw.font(c, 700, 6.5, 'display');
      c.fillText(head, x0 + 7, y0 + 6 + 3.5);
      c.fillStyle = '#2b2219';
      G.draw.font(c, 600, 9.5, 'body');
      for (let i = 0; i < lines.length; i++) c.fillText(lines[i], x0 + 7, y0 + 6 + 7 + 2 + i * 11 + 5.5);
    });
  }

  G.onRender(LAYER_BOT, (ctx) => {
    const p = bot.phase;
    if (p === 'off' || p === 'gone') return;
    const S = G.state;
    if (S.mode !== 'run' && S.mode !== 'pause') return;
    ensureCache();
    const t = S.idleT, calm = G.calm;
    const bob = calm || p === 'blocked' ? 0 : Math.sin(t * 4.2) * 2.4;
    const jit = !calm && (p === 'say' || p === 'tel') && ((t * 9) | 0) % 6 === 0 ? 1.2 : 0;
    const x = bot.x + jit, y = G.GROUND - bot.alt + bob;
    const frame = calm ? 0 : ((t * 14) | 0) & 1;
    const sp = botSprite(bot.mood, frame);
    if (p === 'blocked') {
      ctx.translate(x, y);
      ctx.rotate(bot.spin);
      ctx.globalAlpha = 1 - clamp(bot.t / BLOCKED_T, 0, 1) * 0.6;
      blit(ctx, sp, 0, 0);
      return;
    }
    blit(ctx, sp, x, y);
    if (p === 'say') {
      if (!bot.bubble) bot.bubble = makeBubble();
      blit(ctx, bot.bubble, x - BODY_R - 6, y);
    } else if (p === 'tel' && (calm || Math.sin(t * TAU * 4) > -0.3)) {
      blit(ctx, sprites.alert, x - BODY_R - 10, y + 12);
    }
  });

  // ---------- API ----------
  const api = {
    lastPrediction: null,
    active: () => holder || (others.vivi ? 'vivi' : null),
    claim(id) {
      if (!id || (holder && holder !== id)) return false;
      holder = String(id);
      return true;
    },
    release(id) {
      if (holder === id) holder = null;
    },
    toxicOff: isOff,
    setToxicOff(on) {
      const v = !!on;
      if (v === isOff()) return v;
      K.store.set(OFF_KEY, v);
      const tt = (conf() || {}).blockToast;
      if (v && tt && G.ui && typeof G.ui.toast === 'function') G.ui.toast(tt.label, tt.text || null, { kind: TOAST_KIND, duration: 3 });
      if (v && running() && bot.phase !== 'off' && bot.phase !== 'gone') goAway('away');
      if (v) bot.enterAt = Infinity;
      return v;
    },
    toxic: () => ({ phase: bot.phase, x: bot.x, alt: bot.alt, text: bot.said ? said.text : '', blocked: bot.blocked }),
    _toxic(opts) {
      if (!running() || (bot.phase !== 'off' && bot.phase !== 'gone')) return false;
      bot.force = opts || {};
      bot.phase = 'off';
      bot.postponed = 0;
      bot.enterAt = G.state.t;
      return true;
    },
  };
  K.npc = api;
})();
