/* Фирменные механики: «Отложить», Ебланометр и ЕБЛАН-РЕЖИМ, тимлид. Владелец — пакет gameplay-c. */
(() => {
  'use strict';
  const G = window.G;
  const TAU = Math.PI * 2;
  const LAYER = G.LAYER;
  const clamp = G.clamp;
  const OWN = 'modes';

  // ---------- «Отложить» ----------
  const STOMP_V = 420;
  const STOMP_MIN_FALL = -60;
  const NO_STOMP = { deadline: true, minute: true };
  const TOP_FALLBACK = {
    clock: (o) => (o.alt || 0) + o.r + 6 + 0.86 * o.r,
    tasks: (o) => (o.alt || 0) + o.n * 14,
    laptop: (o) => (o.alt || 0) + 6 + 32 * clamp(o.open || 0, 0.08, 1),
    call: (o) => (o.alt || 0) + o.fly + o.h / 2 - 4,
    ping: (o) => (o.alt || 0) + 13 + (o.hop || 0) + 8.5,
  };
  const STOMP_WORD = { clock: 'ОТЛОЖИЛ', tasks: 'ЗАКРЫЛ ТАСКУ', laptop: 'ЗАХЛОПНУЛ', call: 'ЗАМЬЮТИЛ', ping: 'ПРОЧИТАНО' };
  const SNOOZE_PAY = [[5, 'ЕЩЁ 5 МИНУТОЧЕК'], [15, 'ЕЩЁ 15 МИНУТОЧЕК'], [30, 'ПОЛЧАСИКА ЕЩЁ'], [60, 'ПРОСПАЛ СТЕНДАП']];
  const MEME_MIN = 56;
  const SNOOZE_INK = '#4a7bd8';

  // ---------- Ебланометр и режим ----------
  const DELTA = { near: 12, stomp: 15, chainStep: 5, chain4: 40, gold: 10, carrot: 1.5, tier: 8, powerup: 5, escape: 20, boss: 10, shield: -40, stumble: -30, caught: -40 };
  const DECAY_WAIT = 4, DECAY_RATE = 4;
  const FEVER_T = 6, FEVER_MAX = 10, FEVER_LOCK = 1.5, GRACE_T = 1;
  const FEVER_NEAR = 0.5, FEVER_BOUNCE = 0.5, FEVER_CARROT = 0.15;
  const FEVER_MIN = 2;

  // ---------- тимлид ----------
  const SCHEDULE = [82.5, 157.5, 240];
  const REPEAT = 70, REPEAT_JITTER = 15, POSTPONE = 5, SCHED_REST = 10;
  const WARN_T = 2, CHASE_T = 12, WORK_T = 5, BUBBLE_T = 1.5, ESCAPE_T = 1;
  const GAP_SCHED = 140, GAP_WARN = 90, GAP_STUMBLE = 80, GAP_CAUGHT = 24, GAP_FREE = 150, GAP_DRAIN = 8;
  const GAP = { carrot: 8, gold: 16, near: 18, pass: 4, stomp: 14, miss: -10 };
  const STUMBLE_R = 0.55, STUMBLE_COOLDOWN = 15, STUMBLE_SPEED = 0.65;
  const LEAD_CAUSE = 'Тимлид догнал. Минутка длилась до вечера.';
  const FALLBACK_RESERVED = [[40, 46, 'event'], [58, 66, 'event'], [103, 126, 'allhands'], [134, 139, 'event'], [269, 275, 'event']];
  const LEAD_W = 56, LEAD_H = 84, LEAD_OX = 26;

  const KEY_TIPS = 'eblan.modes.tips';
  const tips = G.store.getJSON(KEY_TIPS, null) || {};

  // ---------- состояние забега ----------
  const run = { chain: 0, meme: 0, lastMult: 1, boss: false, stumbleT: -1 };
  const meter = { v: 0, upT: -99, dirty: false, delta: 0, reason: '', sentFloor: 0 };
  const fever = { on: false, left: 0, total: 0, held: false, grace: 0, vis: 0, transient: false };
  const chase = { on: false, phase: null, cause: '', gap: 0, t: 0, endT: -99, nextAt: SCHEDULE[0], idx: 0, ph: 0, show: false, over: false };
  const view = { phase: null, gap: 0, cause: '' };
  const probe = { x: 0, y: 0, r: 0 };

  let nativeTops = false;

  function dir(name, a, b) {
    const d = G.director;
    if (!d || typeof d[name] !== 'function') return undefined;
    try { return d[name](a, b); } catch (e) { G.report('modes director.' + name, e); }
    return undefined;
  }
  const fridayOn = () => !!(G.powerups && typeof G.powerups.isActive === 'function' && G.powerups.isActive('friday'));
  const sickOn = () => !!(G.powerups && typeof G.powerups.isActive === 'function' && G.powerups.isActive('sick'));
  const running = () => G.state.mode === 'run';

  function saveTip(id) {
    if (tips[id]) return false;
    tips[id] = 1;
    G.store.setJSON(KEY_TIPS, tips);
    return true;
  }
  function tip(id, label, text) {
    if (!saveTip(id) || !G.ui || typeof G.ui.toast !== 'function') return;
    G.ui.toast(label, text, { kind: 'info', duration: 3 });
  }

  // ---------- геометрия «Отложить» ----------
  function topOf(o) {
    const def = G.obstacleTypes[o.type];
    if (nativeTops) return def && typeof def.stompTop === 'function' ? Number(def.stompTop(o)) : NaN;
    const f = TOP_FALLBACK[o.type];
    return f ? Number(f(o)) : NaN;
  }
  function stompable(o) {
    if (!o || o.deco || o.dead || o.ballistic || NO_STOMP[o.type]) return false;
    return Number.isFinite(topOf(o));
  }

  // ---------- Ебланометр ----------
  function addMeter(d, reason) {
    if (!running() || !d) return;
    if (d > 0 && (fever.on || fridayOn())) return;
    const nv = clamp(meter.v + d, 0, 100);
    if (d > 0) meter.upT = G.state.t;
    if (nv === meter.v) return;
    meter.delta += nv - meter.v;
    meter.v = nv;
    meter.reason = reason;
    meter.dirty = true;
  }
  function setMeter(v, reason) {
    if (v === meter.v) return;
    meter.delta += v - meter.v;
    meter.v = v;
    meter.reason = reason;
    meter.dirty = true;
  }
  function flushMeter() {
    if (!meter.dirty) return;
    const fl = Math.floor(meter.v);
    if (meter.reason === 'decay' && fl === meter.sentFloor && meter.v > 0) return;
    meter.dirty = false;
    meter.sentFloor = fl;
    const delta = Math.round(meter.delta * 10) / 10;
    meter.delta = 0;
    G.emit('meter', { value: Math.round(meter.v * 10) / 10, delta, reason: meter.reason });
  }

  // ---------- ЕБЛАН-РЕЖИМ ----------
  function startFever() {
    const S = G.state, B = G.bunny;
    fever.on = true;
    fever.left = FEVER_T;
    fever.total = FEVER_T;
    fever.held = false;
    fever.grace = 0;
    G.setFlag('invincible', 'fever-grace', false);
    setMeter(100, 'fever');
    G.setFlag('fever', OWN, true);
    G.setFlag('party', OWN, true);
    G.setMod('score', 'fever', 2);
    S.stats.fevers = (S.stats.fevers || 0) + 1;
    dir('enter', 'fever');
    if (chase.on) {
      if (chase.phase === 'warn' || chase.phase === 'start') escape('fever');
      else if (chase.phase === 'caught') endChase();
    }
    const fx = G.fx;
    if (fx) {
      if (fx.flash) fx.flash(0.25, feverColor());
      if (fx.zoom) fx.zoom(0.04);
      if (fx.popup) fx.popup(B.x + 24, B.alt + 86, 'ЕБЛАН-РЕЖИМ!', { size: 22, life: 1.2, color: feverColor() });
    }
    G.emit('fever', { duration: FEVER_T });
    tip('fever', 'ЕБЛАН-РЕЖИМ', 'всё мягкое, врезайся смело');
  }
  function extendFever(sec) {
    if (!fever.on || fever.left <= FEVER_LOCK) return;
    const add = Math.min(sec, FEVER_MAX - fever.total);
    if (add <= 0) return;
    fever.left += add;
    fever.total += add;
  }
  function endFever(reason) {
    if (!fever.on) return;
    fever.on = false;
    fever.left = 0;
    G.setFlag('fever', OWN, false);
    G.setFlag('party', OWN, false);
    G.setFlag('invincible', 'fever', false);
    G.setMod('score', 'fever', null);
    fever.transient = false;
    if (reason === 'timeout') {
      fever.grace = GRACE_T;
      G.setFlag('invincible', 'fever-grace', true);
    }
    dir('exit', 'fever');
    setMeter(0, 'feverEnd');
    G.emit('feverEnd', { reason });
  }
  function feverHit(h, o) {
    const B = G.bunny;
    h.cancel = true;
    h.fever = true;
    // Неуязвимость режима живёт только до 'smash' этого удара: balance и щит «Больничный» должны увидеть её в той же цепочке 'hit'.
    fever.transient = true;
    G.setFlag('invincible', 'fever', true);
    if (B.v < STOMP_V) B.v = STOMP_V;
    B.jumps = 0;
    B.coyote = G.cfg.coyote;
    extendFever(FEVER_BOUNCE);
    const alt = centerAlt(o);
    G.addBonus(FEVER_MIN, { kind: 'fever', label: 'БОЙНЬ! +' + FEVER_MIN, x: o.x, alt: alt + 34 });
    if (G.fx && G.fx.ring) G.fx.ring(B.x + 2, B.alt + 22, { from: 10, r: 46, width: 3, life: 0.3, color: feverColor() });
  }
  function centerAlt(o) {
    const def = G.obstacleTypes[o.type];
    if (def && def.kind === 'air') return (o.fly || 0) + (o.alt || 0);
    return (o.alt || 0) + (o.h || 30) / 2;
  }

  // ---------- «Отложить» ----------
  function stomp(h, o, top) {
    const S = G.state, B = G.bunny;
    h.cancel = true;
    h.stomp = true;
    o.stomped = true;
    B.v = STOMP_V;
    B.jumps = 0;
    B.coyote = G.cfg.coyote;
    run.chain++;
    const meme = o.hands === 'meme';
    if (meme) run.meme++;
    const st = S.stats;
    st.stomps = (st.stomps || 0) + 1;
    if (run.chain > (st.maxChain || 0)) st.maxChain = run.chain;
    addMeter(DELTA.stomp + DELTA.chainStep * (run.chain - 1), 'stomp');
    if (chase.phase === 'start') chase.gap += GAP.stomp;
    const fx = G.fx;
    if (fx) {
      if (fx.hitstop) fx.hitstop(0.1, 0.035);
      if (fx.ring) fx.ring(o.x, top, { from: 6, r: 30, width: 3, life: 0.3, color: '#ffffff', squash: 0.35 });
      if (fx.popup) fx.popup(o.x, top + 20, STOMP_WORD[o.type] || 'ОТЛОЖИЛ', { size: 14, life: 0.75, color: SNOOZE_INK });
    }
    G.emit('stomp', { o, type: o.type, chain: run.chain, meme });
  }
  function payout() {
    const B = G.bunny;
    const n = run.chain, memes = run.meme;
    run.chain = 0;
    run.meme = 0;
    const row = SNOOZE_PAY[Math.min(n, SNOOZE_PAY.length) - 1];
    const x = B.x + 18, alt = B.alt + 62;
    let total = row[0];
    G.addBonus(row[0], { kind: 'snooze', label: row[1] + ' +' + row[0], x, alt });
    if (memes) {
      const m = MEME_MIN * memes;
      total += m;
      G.addBonus(m, { kind: 'snooze', label: 'ОТЛОЖИЛ ТОТ САМЫЙ +' + m, x, alt: alt + 24 });
    }
    if (n >= 4) addMeter(DELTA.chain4, 'chain');
    G.emit('snooze', { chain: n, minutes: total });
  }

  // ---------- спотыкание ----------
  function bossOn() {
    if (run.boss) return true;
    const m = dir('modes');
    return !!(m && typeof m.indexOf === 'function' && m.indexOf('boss') >= 0);
  }
  function canStumble(o, def, hb) {
    if (!def || def.kind !== 'ground' || o.type === 'deadline' || chase.on) return false;
    if (G.state.t - chase.endT < STUMBLE_COOLDOWN || sickOn() || bossOn()) return false;
    return !deepHit(o, def, hb);
  }
  // Первый кадр касания почти всегда неглубокий, поэтому «краем» проверяется по пути на 0.2 с вперёд: суженный хитбокс не должен задеть препятствие.
  function deepHit(o, def, hb) {
    const S = G.state, B = G.bunny;
    const vx = S.speed * (o.drift == null ? 1 : o.drift);
    const g = G.cfg.gravity * G.mod('gravity');
    const dy = hb.y - B.alt, x0 = o.x;
    probe.x = hb.x;
    probe.r = hb.r * STUMBLE_R;
    try {
      for (let i = 0; i <= 24; i++) {
        const tau = i / 120;
        o.x = x0 - vx * tau;
        probe.y = Math.max(0, B.alt + B.v * tau - 0.5 * g * tau * tau) + dy;
        if (def.hit(o, probe)) return true;
      }
    } finally {
      o.x = x0;
    }
    return false;
  }
  function stumble(h, o) {
    const B = G.bunny;
    h.cancel = true;
    h.stumble = true;
    run.stumbleT = 0;
    dir('hold', 1.2);
    addMeter(DELTA.stumble, 'stumble');
    if (G.fx && G.fx.popup) G.fx.popup(B.x + 20, B.alt + 70, 'СПОТКНУЛСЯ', { size: 15, life: 0.8, color: G.C.muted });
    startChase('stumble');
    tip('stumble', 'ТИМЛИД ЗАМЕТИЛ', 'отрывайся: морковки и впритирку');
  }
  function stumbleSpeed(dt) {
    if (run.stumbleT < 0) return;
    run.stumbleT += dt;
    const t = run.stumbleT;
    let k;
    if (t < 0.1) k = 1 - (1 - STUMBLE_SPEED) * (t / 0.1);
    else if (t < 0.6) k = STUMBLE_SPEED;
    else if (t < 1.1) {
      const u = (t - 0.6) / 0.5;
      k = STUMBLE_SPEED + (1 - STUMBLE_SPEED) * u * u * (3 - 2 * u);
    } else {
      run.stumbleT = -1;
      G.setMod('speed', 'stumble', null);
      return;
    }
    G.setMod('speed', 'stumble', k);
  }

  // ---------- тимлид ----------
  function busy(a, b) {
    const d = G.director;
    if (d && typeof d.busy === 'function') return dir('busy', a, b);
    for (const w of FALLBACK_RESERVED) if (a < w[1] && b > w[0]) return w[2];
    return null;
  }
  function emitChase() {
    G.emit('chase', { phase: chase.phase, gap: Math.round(chase.gap), cause: chase.cause });
  }
  function setPhase(p) {
    chase.phase = p;
    chase.t = 0;
    emitChase();
  }
  function startChase(cause) {
    chase.on = true;
    chase.show = true;
    chase.over = false;
    chase.cause = cause;
    chase.ph = 0;
    dir('enter', 'chase');
    if (cause === 'stumble') {
      chase.gap = GAP_STUMBLE;
      setPhase('start');
    } else {
      chase.gap = GAP_SCHED;
      setPhase('warn');
    }
  }
  function trySchedule() {
    const S = G.state, at = chase.nextAt;
    if (fever.on || chase.on || S.t - chase.endT < SCHED_REST || busy(at - WARN_T, at + CHASE_T + WARN_T)) {
      chase.nextAt += POSTPONE;
      return;
    }
    chase.idx++;
    chase.nextAt = chase.idx < SCHEDULE.length ? Math.max(SCHEDULE[chase.idx], at + REPEAT * 0.5) : at + REPEAT + (Math.random() * 2 - 1) * REPEAT_JITTER;
    startChase('schedule');
  }
  function caught() {
    const B = G.bunny;
    chase.gap = GAP_CAUGHT;
    G.setMod('score', 'teamlead', 0);
    addMeter(DELTA.caught, 'caught');
    setPhase('caught');
    if (G.fx && G.fx.shake) G.fx.shake(3);
    if (G.fx && G.fx.popup) G.fx.popup(B.x + 20, B.alt + 74, 'РАБОТАЮ…', { size: 15, life: 1.1, color: G.C.muted });
  }
  function escape(kind) {
    const S = G.state, B = G.bunny;
    const min = kind === 'early' ? 45 : Math.min(40, 20 + Math.floor(Math.max(0, chase.gap) / 4));
    S.stats.chasesEscaped = (S.stats.chasesEscaped || 0) + 1;
    addMeter(DELTA.escape, 'escape');
    const label = kind === 'fever' ? 'ТИМЛИД ИСПУГАЛСЯ' : 'ТИМЛИДА УТАЩИЛИ НА СОЗВОН';
    G.addBonus(min, { kind: 'chase', label: label + ' +' + min, x: B.x + 16, alt: B.alt + 72 });
    if (kind === 'fever') chase.cause = 'fever';
    setPhase('escape');
  }
  function endChase() {
    if (!chase.on) return;
    G.setMod('score', 'teamlead', null);
    setPhase('end');
    chase.on = false;
    chase.phase = null;
    chase.endT = G.state.t;
    dir('exit', 'chase');
  }
  function missedCarrots() {
    const hb = G.bunnyHitbox();
    const behind = hb.x - (G.flag('magnet') ? 70 : hb.r + 18);
    for (const p of G.pickups) {
      if (p.taken || p.mdMiss || p.balRain || p.balTeach || p.x >= behind) continue;
      if (p.type !== 'carrot' && p.type !== 'gold') continue;
      p.mdMiss = true;
      chase.gap += GAP.miss;
    }
  }
  function updateChase(dt) {
    const S = G.state;
    if (!chase.on) {
      if (S.t >= chase.nextAt - WARN_T) trySchedule();
      return;
    }
    chase.t += dt;
    chase.ph += (S.speed * dt) / 70;
    if (chase.phase === 'warn') {
      chase.gap = GAP_SCHED + (GAP_WARN - GAP_SCHED) * clamp(chase.t / WARN_T, 0, 1);
      if (chase.t >= WARN_T) setPhase('start');
    } else if (chase.phase === 'start') {
      chase.gap -= GAP_DRAIN * dt;
      missedCarrots();
      if (chase.gap <= GAP_CAUGHT) caught();
      else if (chase.gap >= GAP_FREE) escape('early');
      else if (chase.t >= CHASE_T) escape('time');
    } else if (chase.phase === 'caught') {
      if (chase.t >= WORK_T) endChase();
    } else if (chase.phase === 'escape') {
      chase.gap += 170 * dt;
      if (chase.t >= ESCAPE_T) endChase();
    }
  }
  function leadX() {
    const B = G.bunny;
    if (chase.phase === 'caught') return B.x - 44 - Math.max(0, chase.t - BUBBLE_T) * 90;
    return Math.min(B.x - chase.gap - 20, B.x - 30);
  }

  // ---------- события ----------
  function resetRun() {
    run.chain = 0;
    run.meme = 0;
    run.lastMult = 1;
    run.boss = false;
    run.stumbleT = -1;
    meter.v = 0;
    meter.upT = -99;
    meter.dirty = false;
    meter.delta = 0;
    meter.sentFloor = 0;
    fever.on = false;
    fever.left = 0;
    fever.total = 0;
    fever.held = false;
    fever.grace = 0;
    fever.vis = 0;
    fever.transient = false;
    chase.on = false;
    chase.phase = null;
    chase.show = false;
    chase.over = false;
    chase.gap = 0;
    chase.endT = -99;
    chase.idx = 0;
    chase.nextAt = SCHEDULE[0];
  }

  G.on('boot', () => {
    for (const id in G.obstacleTypes) {
      if (typeof G.obstacleTypes[id].stompTop === 'function') nativeTops = true;
    }
  });

  G.on('start', () => {
    const st = G.state.stats;
    st.stomps = 0;
    st.maxChain = 0;
    st.fevers = 0;
    st.chasesEscaped = 0;
    if (fever.on) endFever('start');
    resetRun();
    G.emit('meter', { value: 0, delta: 0, reason: 'start' });
  });

  G.on('hit', (h) => {
    if (!h || !h.o || !running()) return;
    const o = h.o, B = G.bunny;
    if (fever.on) return feverHit(h, o);
    if (h.cancel) return;
    const hb = G.bunnyHitbox();
    if (B.v < STOMP_MIN_FALL && stompable(o)) {
      const top = topOf(o);
      if (hb.y >= top - 1) return stomp(h, o, top);
    }
    if (canStumble(o, h.def || G.obstacleTypes[o.type], hb)) stumble(h, o);
  });

  G.on('smash', () => {
    if (!fever.transient) return;
    fever.transient = false;
    G.setFlag('invincible', 'fever', false);
  });

  G.on('land', () => {
    if (running() && run.chain) payout();
  });

  G.on('pass', (o, info) => {
    if (!running()) return;
    const near = !!(info && info.near);
    if (near) {
      addMeter(DELTA.near, 'near');
      extendFever(FEVER_NEAR);
    }
    if (chase.phase === 'start') chase.gap += near ? GAP.near : GAP.pass;
  });

  G.on('pickup', (p) => {
    if (!running() || !p) return;
    if (p.type === 'gold') {
      addMeter(DELTA.gold, 'gold');
      extendFever(FEVER_CARROT);
      if (chase.phase === 'start') chase.gap += GAP.gold;
    } else if (p.type === 'carrot') {
      addMeter(DELTA.carrot, 'carrot');
      extendFever(FEVER_CARROT);
      if (chase.phase === 'start') chase.gap += GAP.carrot;
    }
  });

  G.on('combo', (c) => {
    if (!c) return;
    const mult = Number(c.mult) || 1;
    if (mult > run.lastMult) addMeter(DELTA.tier, 'combo');
    run.lastMult = mult;
  });

  G.on('powerup', () => addMeter(DELTA.powerup, 'powerup'));
  G.on('powerupEnd', (pu) => {
    if (pu && pu.id === 'sick' && pu.reason === 'used') addMeter(DELTA.shield, 'shield');
  });

  G.on('boss', (b) => {
    if (!b) return;
    if (b.phase === 'warn' || b.phase === 'start') run.boss = true;
    else if (b.phase === 'win' || b.phase === 'fail') run.boss = false;
    if (b.phase === 'hit') addMeter(DELTA.boss, 'boss');
  });

  G.on('die', (info) => {
    const live = chase.on && (chase.phase === 'warn' || chase.phase === 'start' || chase.phase === 'caught');
    if (live && info) {
      info.cause = LEAD_CAUSE;
      info.causeTag = 'teamlead';
    }
    if (fever.on) endFever('die');
    fever.grace = 0;
    if (chase.on) {
      dir('exit', 'chase');
      chase.phase = 'end';
      emitChase();
      chase.on = false;
      chase.phase = null;
    }
    chase.over = live;
    chase.show = live;
    run.chain = 0;
    run.meme = 0;
    run.stumbleT = -1;
    meter.v = 0;
    meter.dirty = false;
  });

  G.onUpdate((dt) => {
    if (fever.transient) {
      fever.transient = false;
      G.setFlag('invincible', 'fever', false);
    }
    const S = G.state;
    if (S.mode !== 'run') return;
    G.setFlag('party', 'modes-friday', fridayOn());
    stumbleSpeed(dt);
    if (fever.on) {
      fever.left -= dt;
      if (!fever.held && fever.left <= FEVER_LOCK) {
        fever.held = true;
        dir('hold', Math.max(0, fever.left) + GRACE_T);
      }
      if (fever.left <= 0) endFever('timeout');
    } else if (meter.v > 0 && S.t - meter.upT > DECAY_WAIT) {
      const nv = Math.max(0, meter.v - DECAY_RATE * dt);
      meter.delta += nv - meter.v;
      meter.v = nv;
      meter.reason = 'decay';
      meter.dirty = true;
    }
    if (fever.grace > 0) {
      fever.grace -= dt;
      if (fever.grace <= 0) {
        fever.grace = 0;
        G.setFlag('invincible', 'fever-grace', false);
      }
    }
    updateChase(dt);
    if (!fever.on && meter.v >= 100) startFever();
    flushMeter();
  }, 32);

  // ---------- кэши рисунков ----------
  let cacheK = 0, cacheDirty = true;
  const sprites = { lead: [null, null, null], bubbleSync: null, bubbleTasks: null, label: null, laptop: null, edge: null, vig: null, vigW: 0, vigH: 0, edgeH: 0, chain: [] };
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
  function feverColor() {
    const c = G.C.fever;
    return c && c !== '#888888' ? c : G.isDark() ? '#ff8cc0' : '#ff5fa2';
  }
  function edgeColor() {
    return G.isDark() ? 'rgba(255,240,220,0.42)' : 'rgba(40,26,14,0.8)';
  }

  function ensureCache() {
    const k = Math.max(0.5, (G.scale || 1) * (G.dpr || 1));
    if (!cacheDirty && k === cacheK) return;
    cacheDirty = false;
    cacheK = k;
    for (let i = 0; i < 3; i++) sprites.lead[i] = sprite(LEAD_W, LEAD_H, LEAD_OX, LEAD_H - 1, (c) => paintLead(c, i));
    sprites.bubbleSync = bubble('Синкнемся?');
    sprites.bubbleTasks = bubble('А что по задачам?');
    sprites.label = textSprite('ТИМЛИД', 600, 10, G.C.ink, null);
    sprites.laptop = sprite(30, 22, 15, 21, paintLaptop);
    sprites.edge = null;
    sprites.vig = null;
    sprites.chain.length = 0;
  }

  function limb(c, x0, y0, x1, y1, x2, y2, w, color, edge) {
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.lineTo(x2, y2);
    c.lineWidth = w + 2;
    c.strokeStyle = edge;
    c.stroke();
    c.lineWidth = w;
    c.strokeStyle = color;
    c.stroke();
  }
  function paintLead(c, frame) {
    const edge = edgeColor();
    const dark = G.isDark();
    const shirt = dark ? '#8fb3dc' : '#a8c9ee', shirtLo = dark ? '#6f93bd' : '#86abd6';
    const pants = '#3d4352', shoe = '#1d2027', skin = '#e5bf9a', hair = '#3a2a1f';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const legs = frame === 2
      ? [[-3, -38, -4, -20, -5, -2], [3, -38, 4, -20, 5, -2]]
      : frame === 0
        ? [[-1, -38, -9, -21, -16, -7], [1, -38, 9, -20, 15, -2]]
        : [[-1, -38, -3, -20, -1, -2], [1, -38, 7, -22, 3, -9]];
    for (let i = 0; i < 2; i++) {
      const l = legs[i];
      limb(c, l[0], l[1], l[2], l[3], l[4], l[5], 6, i === 0 ? '#323744' : pants, edge);
      c.fillStyle = shoe;
      G.draw.ellipse(c, l[4] + 2.5, l[5] + 0.5, 4.6, 2.4, 0);
    }
    const lean = frame === 2 ? 0 : 2;
    const backArm = frame === 2 ? [-7, -63, -11, -50, -10, -40] : frame === 0 ? [-7, -63, -12, -52, -17, -44] : [-7, -63, -3, -50, 4, -45];
    limb(c, backArm[0] + lean, backArm[1], backArm[2] + lean, backArm[3], backArm[4] + lean, backArm[5], 4.5, shirtLo, edge);
    c.fillStyle = shirt;
    c.strokeStyle = edge;
    c.lineWidth = 1.2;
    G.draw.rr(c, -9 + lean, -68, 18, 31, 5);
    c.fill();
    c.stroke();
    c.fillStyle = pants;
    c.fillRect(-9 + lean, -39.5, 18, 3);
    c.strokeStyle = '#2f6fe0';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-4 + lean, -67);
    c.lineTo(0 + lean, -55);
    c.lineTo(4 + lean, -67);
    c.stroke();
    c.fillStyle = '#ffffff';
    c.fillRect(-3 + lean, -55, 6, 7.5);
    c.fillStyle = '#2f6fe0';
    c.fillRect(-3 + lean, -55, 6, 2);
    c.strokeStyle = edge;
    c.lineWidth = 0.6;
    c.strokeRect(-3 + lean, -55, 6, 7.5);
    limb(c, 6 + lean, -63, 13 + lean, -53, 17 + lean, -58, 4.5, shirt, edge);
    c.fillStyle = '#fbf7ef';
    c.strokeStyle = edge;
    c.lineWidth = 1;
    G.draw.rr(c, 15 + lean, -69, 9, 11, 1.5);
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(15 + lean, -63.5, 2.6, Math.PI * 0.5, Math.PI * 1.5);
    c.stroke();
    c.fillStyle = '#2a2118';
    G.draw.font(c, 700, 3.1, 'display');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('BEST', 19.5 + lean, -66);
    c.fillText('LEAD', 19.5 + lean, -62);
    c.fillStyle = skin;
    G.draw.ellipse(c, 17 + lean, -58, 2.4, 2.4, 0);
    c.fillStyle = skin;
    c.strokeStyle = edge;
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(1 + lean, -75, 8, 0, TAU);
    c.fill();
    c.stroke();
    c.fillStyle = hair;
    c.beginPath();
    c.arc(1 + lean, -75, 8, Math.PI * 1.02, Math.PI * 1.98);
    c.lineTo(9 + lean, -76);
    c.quadraticCurveTo(2 + lean, -79, -6 + lean, -74);
    c.closePath();
    c.fill();
  }
  function paintLaptop(c) {
    const edge = edgeColor();
    c.lineJoin = 'round';
    c.fillStyle = '#1c1e24';
    c.strokeStyle = edge;
    c.lineWidth = 1;
    G.draw.rr(c, -11, -20, 20, 14, 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#123049';
    c.fillRect(-9.5, -18.5, 17, 11);
    const lines = ['#ff7ab6', '#7fd1ff', '#ffd27a', '#9be37b'];
    for (let i = 0; i < 4; i++) {
      c.fillStyle = lines[i];
      c.fillRect(-8 + (i & 1) * 2, -17 + i * 2.5, 6 + ((i * 5) % 7), 1.2);
    }
    c.fillStyle = '#c3bdb2';
    c.strokeStyle = edge;
    G.draw.rr(c, -14, -6, 28, 4.5, 1.5);
    c.fill();
    c.stroke();
  }
  function textSprite(text, weight, size, fill, stroke) {
    const meas = canvasOf(1, 1).getContext('2d');
    if (!meas) return null;
    G.draw.font(meas, weight, size, 'display');
    const w = Math.ceil(meas.measureText(text).width) + 6, h = size + 6;
    return sprite(w, h, 0, h / 2, (c) => {
      G.draw.font(c, weight, size, 'display');
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = 3;
        c.strokeText(text, 3, 0.5);
      }
      c.fillStyle = fill;
      c.fillText(text, 3, 0.5);
    });
  }
  function bubble(text) {
    const meas = canvasOf(1, 1).getContext('2d');
    if (!meas) return null;
    G.draw.font(meas, 600, 10.5, 'body');
    const w = Math.ceil(meas.measureText(text).width) + 14, h = 19;
    const x0 = -6, x1 = w - 6, y0 = -h - 6, y1 = -6, r = 6;
    return sprite(w + 2, h + 8, 7, h + 7, (c) => {
      c.fillStyle = '#fffdf8';
      c.strokeStyle = 'rgba(43,34,25,0.85)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x0 + r, y0);
      c.arcTo(x1, y0, x1, y1, r);
      c.arcTo(x1, y1, x0, y1, r);
      c.lineTo(8, y1);
      c.lineTo(0, 0);
      c.lineTo(2, y1);
      c.arcTo(x0, y1, x0, y0, r);
      c.arcTo(x0, y0, x1, y0, r);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#2b2219';
      G.draw.font(c, 600, 10.5, 'body');
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(text, x0 + 7, (y0 + y1) / 2 + 0.5);
    });
  }
  function chainSprite(n) {
    let sp = sprites.chain[n];
    if (!sp) sp = sprites.chain[n] = textSprite('×' + n, 700, 17, '#ffffff', SNOOZE_INK);
    return sp;
  }
  function edgeSprite() {
    const k = cacheK, h = G.H;
    if (sprites.edge && sprites.edgeH === h) return sprites.edge;
    const c = canvasOf(40 * k, h * k);
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const g = ctx.createLinearGradient(0, 0, c.width, 0);
    g.addColorStop(0, 'rgba(226,44,40,0.62)');
    g.addColorStop(0.45, 'rgba(226,44,40,0.22)');
    g.addColorStop(1, 'rgba(226,44,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    sprites.edge = c;
    sprites.edgeH = h;
    return c;
  }
  function vigSprite() {
    const k = cacheK * 0.5, w = G.W, h = G.H;
    if (sprites.vig && sprites.vigW === w && sprites.vigH === h) return sprites.vig;
    const c = canvasOf(w * k, h * k);
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.translate(c.width / 2, c.height / 2);
    ctx.scale(c.width / 2, c.height / 2);
    const g = ctx.createRadialGradient(0, 0, 0.5, 0, 0, 1.42);
    const col = feverColor();
    g.addColorStop(0, hexA(col, 0));
    g.addColorStop(0.45, hexA(col, 0.35));
    g.addColorStop(1, hexA(col, 1));
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    sprites.vig = c;
    sprites.vigW = w;
    sprites.vigH = h;
    return c;
  }
  function hexA(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    const n = m ? parseInt(m[1], 16) : 0xff5fa2;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // ---------- рисование ----------
  G.onRender(LAYER.BUNNY - 2, (ctx) => {
    if (!chase.show) return;
    const S = G.state;
    if (!chase.on && !chase.over) {
      chase.show = false;
      return;
    }
    const x = chase.over ? G.bunny.x - 44 : leadX();
    if (x < -LEAD_W) return;
    ensureCache();
    const standing = chase.over || (chase.phase === 'caught' && chase.t < BUBBLE_T);
    const frame = standing ? 2 : (Math.floor(chase.ph * (G.calm ? 0.5 : 1)) & 1);
    ctx.globalAlpha = !standing && chase.gap > 80 ? 0.6 : 1;
    const bob = standing || G.calm ? 0 : Math.abs(Math.sin(chase.ph * Math.PI)) * 1.5;
    blit(ctx, sprites.lead[frame], x, G.GROUND - bob);
    ctx.globalAlpha = 1;
    let b = null;
    if (standing && (chase.over || chase.t < BUBBLE_T)) b = sprites.bubbleTasks;
    else if (chase.phase === 'warn' || chase.phase === 'start') b = sprites.bubbleSync;
    if (b && S.mode !== 'start') blit(ctx, b, x + 8, G.GROUND - LEAD_H - 2 - bob);
  });

  G.onRender(LAYER.BUNNY - 1, (ctx) => {
    if (!fever.on && fever.grace <= 0) return;
    const B = G.bunny, s = B.size || 1, t = G.state.idleT;
    const cx = B.x + 2 * s, cy = G.GROUND - B.alt - 22 * s;
    let a = 1;
    if (fever.grace > 0) a = G.calm ? 0.5 : (Math.sin(t * TAU * 4) > 0 ? 0.8 : 0.2);
    else if (fever.left < FEVER_LOCK && !G.calm) a = 0.55 + 0.45 * Math.sin(t * TAU * 3);
    const wob = G.calm ? 0 : Math.sin(t * TAU * 2) * 2.5;
    ctx.strokeStyle = feverColor();
    ctx.globalAlpha = 0.55 * a;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, (30 + wob) * s), 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.3 * a;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, (39 - wob) * s), 0, TAU);
    ctx.stroke();
  });

  G.onRender(LAYER.BUNNY + 1, (ctx) => {
    if (chase.phase !== 'caught' || G.state.mode !== 'run') return;
    ensureCache();
    const B = G.bunny;
    blit(ctx, sprites.laptop, B.x + 26, G.GROUND - B.alt + 0.5);
  });

  G.onRender(LAYER.FX + 1, (ctx) => {
    if (run.chain < 2 || G.state.mode !== 'run') return;
    ensureCache();
    const B = G.bunny;
    const head = typeof G.bunnyHead === 'function' ? G.bunnyHead() : null;
    const hx = head ? head.x : B.x;
    const ha = head ? head.alt : B.alt + 46;
    blit(ctx, chainSprite(Math.min(run.chain, 99)), hx + 6, G.GROUND - ha - 12);
  });

  G.onRender(LAYER.SCREEN, (ctx) => {
    const S = G.state;
    const target = fever.on && S.mode === 'run' ? 1 : 0;
    fever.vis += (target - fever.vis) * Math.min(1, (S.mode === 'pause' ? 0 : 1) * 0.12);
    if (fever.vis < 0.01 && !chase.on) return;
    ensureCache();
    if (fever.vis >= 0.01) {
      const vig = vigSprite();
      let a = 0.22;
      if (!G.calm) a = fever.left < FEVER_LOCK && fever.on ? 0.17 + 0.09 * Math.sin(S.idleT * TAU * 3) : 0.22 + 0.06 * Math.sin(S.idleT * TAU * 2);
      ctx.globalAlpha = a * fever.vis;
      if (vig) ctx.drawImage(vig, 0, 0, G.W, G.H);
      ctx.globalAlpha = 1;
    }
    if (!chase.on || S.mode !== 'run') return;
    const ph = chase.phase;
    if (ph === 'warn' || ph === 'start') {
      const edge = edgeSprite();
      const danger = ph === 'warn' || chase.gap < 50;
      let a = clamp((130 - chase.gap) / 80, 0.25, 0.8);
      if (danger) a = G.calm ? 0.75 : 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(S.idleT * TAU * 1.5));
      ctx.globalAlpha = a;
      if (edge) ctx.drawImage(edge, 0, 0, 40, G.H);
      ctx.globalAlpha = 1;
      gapBar(ctx);
    }
  });

  function gapBar(ctx) {
    const lab = sprites.label;
    const lw = lab ? lab.w : 0;
    const bw = 120, total = lw + 4 + bw;
    const x0 = G.W / 2 - total / 2, bx = x0 + lw + 4, y = 11, h = 7;
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = G.C.panel;
    G.draw.rr(ctx, x0 - 6, y - 5, total + 12, h + 10, 8.5);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (lab) blit(ctx, lab, x0, y + h / 2);
    const k = clamp((chase.gap - GAP_CAUGHT) / (GAP_FREE - GAP_CAUGHT), 0, 1);
    ctx.fillStyle = G.isDark() ? 'rgba(255,255,255,0.16)' : 'rgba(40,26,14,0.16)';
    G.draw.rr(ctx, bx, y, bw, h, h / 2);
    ctx.fill();
    ctx.fillStyle = k < 0.3 ? G.C.accent : G.C.leaf;
    G.draw.rr(ctx, bx, y, Math.max(h, bw * k), h, h / 2);
    ctx.fill();
  }

  // ---------- API ----------
  G.modes = {
    version: 1,
    stompable,
    stompTop: (o) => (o ? topOf(o) : NaN),
    meter: () => meter.v / 100,
    feverLeft: () => (fever.on ? Math.max(0, fever.left) : 0),
    chain: () => run.chain,
    chase() {
      if (!chase.on) return null;
      view.phase = chase.phase;
      view.gap = chase.gap;
      view.cause = chase.cause;
      return view;
    },
    _fill(v) {
      addMeter(Number(v) || 0, 'debug');
      if (!fever.on && meter.v >= 100 && running()) startFever();
      flushMeter();
    },
    _chase(cause, gap) {
      if (!running() || chase.on) return;
      startChase(cause === 'stumble' ? 'stumble' : 'schedule');
      if (Number.isFinite(gap)) chase.gap = gap;
    },
  };
})();
