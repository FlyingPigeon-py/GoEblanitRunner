#!/usr/bin/env node
/*
 * Честность препятствий по настоящим def.hit и физике ядра.
 * Запуск: node game/test/fairness.js [--verbose]
 * Грузит core.js, obstacles.js и balance.js в минимальное окружение (без чужих модулей) и проверяет:
 *  - окно одиночного прыжка ≥ 220 мс для каждого наземного типа и низкого созвона на 300/430/570/620 ед/с (шаг 1/240 и 1/60);
 *  - пинг с выравниванием фазы: без прыжка — всегда удар, прыжок в центр окна — всегда чисто;
 *  - геометрию «Отложить»: падение сверху по центру всегда касается не ниже def.stompTop − 1;
 *  - приоритет приземления в ядре;
 *  - G.director: hold, chase, потолок очков, резервы, nextArrival;
 *  - разбор полёта (info.diagnosis);
 *  - ровную очередь pulse и тихую помощь после трёх коротких забегов.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');
const MIN_WINDOW = 0.22;
const SPEEDS = [300, 430, 570, 620];

const problems = [];
const check = (cond, msg) => {
  if (!cond) problems.push(msg);
};

// ---------- окружение ----------
function makeEnv() {
  let raf = null;
  let seed = 12345;
  const consoleErrors = [];
  const ctx = new Proxy(
    {},
    {
      get(o, k) {
        if (k in o) return o[k];
        if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (k === 'measureText') return (t) => ({ width: String(t).length * 7 });
        if (k === 'getLineDash') return () => [];
        return () => {};
      },
      set(o, k, v) {
        o[k] = v;
        return true;
      },
    }
  );
  const el = (id) => ({
    id,
    width: 900,
    height: 450,
    style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, width: 900, height: 450, right: 900, bottom: 450 }),
    addEventListener() {},
  });
  const els = { stage: el('stage'), game: el('game') };
  const store = new Map();
  const sandbox = {
    console: { log() {}, info() {}, debug() {}, warn() {}, error: (...a) => consoleErrors.push(a.map(String).join(' ')) },
    document: {
      getElementById: (id) => els[id] || null,
      documentElement: { getAttribute: () => 'light', setAttribute() {} },
      addEventListener() {},
      activeElement: null,
      hidden: false,
      fonts: null,
    },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    getComputedStyle: () => ({ getPropertyValue: () => '#8a7a66' }),
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    requestAnimationFrame: (fn) => {
      raf = fn;
      return 1;
    },
    devicePixelRatio: 1,
    addEventListener() {},
    __rand: () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext('Math.random = __rand;', sandbox);
  for (const f of ['js/core.js', 'js/obstacles.js', 'js/balance.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  }
  const G = sandbox.G;
  G.boot();
  let now = 1000;
  const frame = (dt) => {
    now += dt * 1000;
    raf(now);
  };
  frame(0);
  return { G, frame, consoleErrors };
}

const env = makeEnv();
const { G } = env;
const cfg = G.cfg;
const HB = cfg.hitbox;
const HBX = cfg.runX + HB.dx;
G.bunny.x = cfg.runX;

// ---------- 1. окна одиночного прыжка ----------
function makeOb(id, opts, prep) {
  const def = G.obstacleTypes[id];
  const o = { type: id, x: 0, alt: 0, rot: 0, drift: 1, seed: 3 };
  def.make(o, opts || {});
  if (prep) prep(o);
  return o;
}

// Прыжок с дивана в момент p (первая граница кадра не раньше p), препятствие прибывает к хитбоксу в T0.
function survives(id, opts, prep, v, dt, p, T0) {
  const def = G.obstacleTypes[id];
  const o = makeOb(id, opts, prep);
  const vx = v * (o.drift == null ? 1 : o.drift);
  if (def.alignTo) def.alignTo(o, T0);
  o.x = HBX + vx * T0;
  const hb = { x: HBX, y: HB.dy, r: HB.r };
  const g = cfg.gravity, V = cfg.jumpV;
  let alt = 0, vy = 0, jumped = p == null;
  const end = T0 + 0.6;
  for (let t = 0; t < end; t += dt) {
    if (!jumped && t + 1e-9 >= p) {
      jumped = true;
      vy = V;
    }
    if (alt > 0 || vy > 0) {
      alt += vy * dt - 0.5 * g * dt * dt;
      vy -= g * dt;
      if (alt <= 0) {
        alt = 0;
        vy = 0;
      }
    }
    o.x -= vx * dt;
    if (def.update) def.update(o, dt);
    hb.y = alt + HB.dy;
    if (def.hit(o, hb)) return false;
  }
  return true;
}

function windowOf(id, opts, prep, v, dt) {
  const T0 = 1.2, step = 0.002;
  let ok = 0, first = null, last = null;
  for (let p = 0; p <= T0 + 0.1; p += step) {
    if (!survives(id, opts, prep, v, dt, p, T0)) continue;
    ok++;
    if (first == null) first = p - T0;
    last = p - T0;
  }
  return { ms: ok * step * 1000, first, last };
}

const openLaptop = (o) => {
  o.open = 1;
  o.openT = 1;
  o.warned = true;
};
const askLow = (o) => {
  o.locked = true;
  o.lane = 26;
  o.fly = 26;
};
const VARIANTS = [
  ['clock r18', 'clock', { r: 18 }],
  ['clock r23', 'clock', { r: 23 }],
  ['clock r26', 'clock', { r: 26 }],
  ['tasks n2', 'tasks', { n: 2 }],
  ['tasks n3', 'tasks', { n: 3 }],
  ['tasks n4', 'tasks', { n: 4 }],
  ['tasks n5', 'tasks', { n: 5 }],
  ['laptop', 'laptop', {}, openLaptop],
  ['call L0', 'call', { level: 0 }],
  ['ping', 'ping', {}],
  ['deadline', 'deadline', {}],
  ['minute 26', 'minute', {}, askLow],
];

const table = [];
const centers = {};
for (const [name, id, opts, prep] of VARIANTS) {
  if (!G.obstacleTypes[id]) {
    problems.push(`window: type ${id} not registered`);
    continue;
  }
  const row = [name.padEnd(10)];
  for (const v of SPEEDS) {
    for (const dt of [1 / 240, 1 / 60]) {
      const w = windowOf(id, opts, prep, v, dt);
      if (dt < 0.01) row.push(String(Math.round(w.ms)).padStart(4));
      check(w.ms >= MIN_WINDOW * 1000 - 1, `window ${name} @${v} dt=1/${Math.round(1 / dt)}: ${Math.round(w.ms)} ms < ${MIN_WINDOW * 1000}`);
      if (id === 'ping' && dt < 0.01) centers[v] = (w.first + w.last) / 2;
    }
    check(!survives(id, opts, prep, v, 1 / 240, null, 1.2), `window ${name} @${v}: no jump should hit`);
  }
  table.push(row.join(' '));
}
console.log('окна одиночного прыжка, мс (шаг 1/240):');
console.log('           ' + SPEEDS.map((v) => String(v).padStart(4)).join(' '));
for (const r of table) console.log(r);

// ---------- 2. пинг с выравниванием ----------
{
  const def = G.obstacleTypes.ping;
  check(typeof def.alignTo === 'function', 'ping.alignTo missing');
  let hitNoJump = 0, hitCenter = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) {
    const v = SPEEDS[i % SPEEDS.length];
    const T0 = 0.6 + ((i * 7919) % 1800) / 1000;
    const ph0 = ((i * 104729) % 1000) / 1000 * Math.PI;
    const prep = (o) => {
      o.ph = ph0;
    };
    if (!survives('ping', {}, prep, v, 1 / 240, null, T0)) hitNoJump++;
    if (!survives('ping', {}, prep, v, 1 / 240, T0 + centers[v], T0)) hitCenter++;
  }
  check(hitNoJump === N, `ping: no-jump bot hit ${hitNoJump}/${N} (want all)`);
  check(hitCenter === 0, `ping: center-jump bot hit ${hitCenter}/${N} (want none)`);
  console.log(`пинг: без прыжка ${hitNoJump}/${N} ударов, прыжок в центр окна ${hitCenter}/${N}`);
}

// ---------- 3. геометрия «Отложить» ----------
{
  const STOMP = [
    ['clock r18', 'clock', { r: 18 }],
    ['clock r23', 'clock', { r: 23 }],
    ['clock r26', 'clock', { r: 26 }],
    ['tasks n3', 'tasks', { n: 3 }],
    ['tasks n5', 'tasks', { n: 5 }],
    ['laptop', 'laptop', {}, openLaptop],
    ['call L0', 'call', { level: 0 }],
    ['ping', 'ping', {}, (o) => {
      o.ph = 0;
      o.hop = 0;
    }],
  ];
  for (const id of ['deadline', 'minute']) check(typeof G.obstacleTypes[id].stompTop !== 'function', `${id} must not have stompTop`);
  let cases = 0;
  for (const [name, id, opts, prep] of STOMP) {
    const def = G.obstacleTypes[id];
    if (typeof def.stompTop !== 'function') {
      problems.push(`stomp: ${id}.stompTop missing`);
      continue;
    }
    const o = makeOb(id, opts, prep);
    o.x = 0;
    const top = def.stompTop(o);
    const probe = { x: 0, y: 0, r: 0.5 };
    let half = 0;
    for (let x = 0; x <= 80; x += 0.5) {
      let any = false;
      for (let y = 0; y <= top + 2; y += 1) {
        probe.x = x;
        probe.y = y;
        if (def.hit(o, probe)) any = true;
      }
      if (any) half = x;
    }
    check(half > 0, `stomp ${name}: hitbox not found`);
    for (const vy0 of [-200, -400, -600, -900]) {
      for (let k = -4; k <= 4; k++) {
        const dx = (k / 4) * 0.4 * (2 * half);
        const hb = { x: dx, y: top + HB.r + 40, r: HB.r };
        let vy = vy0;
        const dt = 1 / 60;
        let contact = null;
        for (let i = 0; i < 200 && hb.y > 0; i++) {
          hb.y += vy * dt - 0.5 * cfg.gravity * dt * dt;
          vy -= cfg.gravity * dt;
          if (def.hit(o, hb)) {
            contact = hb.y;
            break;
          }
        }
        cases++;
        check(contact != null && contact >= top - 1, `stomp ${name} v=${vy0} dx=${dx.toFixed(1)}: contact at hb.y=${contact == null ? 'none' : contact.toFixed(1)}, stompTop ${top.toFixed(1)}`);
      }
    }
  }
  // Дебют «Отложить»: прыжок по дуге морковок (нажатие в t_arr − tDown(stompTop − 4)) приходит на верх будильника r23.
  const def = G.obstacleTypes.clock;
  const ph = G.director.phys();
  for (const v of SPEEDS) {
    for (const dt of [1 / 240, 1 / 60]) {
      const o = makeOb('clock', { r: 23 });
      const top = def.stompTop(o);
      const T0 = 1.2, p = T0 - ph.tDown(top - (HB.dy - HB.r));
      o.x = HBX + v * T0;
      const hb = { x: HBX, y: HB.dy, r: HB.r };
      let alt = 0, vy = 0, jumped = false, res = 'miss';
      for (let t = 0; t < T0 + 0.5; t += dt) {
        if (!jumped && t + 1e-9 >= p) {
          jumped = true;
          vy = cfg.jumpV;
        }
        if (alt > 0 || vy > 0) {
          alt += vy * dt - 0.5 * cfg.gravity * dt * dt;
          vy -= cfg.gravity * dt;
          if (alt <= 0) alt = vy = 0;
        }
        o.x -= v * dt;
        hb.y = alt + HB.dy;
        if (def.hit(o, hb)) {
          res = vy < -60 && hb.y >= top - 1 ? 'stomp' : 'die';
          break;
        }
      }
      check(res === 'stomp', `snooze debut arc @${v} dt=1/${Math.round(1 / dt)}: ${res}`);
    }
  }
  console.log(`«Отложить»: ${cases} падений сверху проверено, дуга дебюта ведёт на верх будильника`);
}

// ---------- 4. приоритет приземления ----------
const jumps = [];
G.on('jump', (j) => jumps.push(j.n));
const lands = [];
G.on('land', () => lands.push(jumps.length));

function freshRun() {
  if (G.state.mode === 'run') G.die({ type: 'clock' });
  G.startGame();
  G.director.clear();
  G.director.hold(1e6);
  G.obstacles.length = 0;
  G.pickups.length = 0;
  env.frame(1 / 60);
}

{
  freshRun();
  const B = G.bunny;
  for (const [alt, wantDouble] of [[30, false], [60, true]]) {
    B.alt = alt;
    B.v = -600;
    B.jumps = 1;
    B.coyote = 0;
    jumps.length = 0;
    lands.length = 0;
    G.press('key');
    for (let i = 0; i < 30 && !lands.length; i++) env.frame(1 / 60);
    if (wantDouble) {
      check(jumps[0] === 2, `land priority: alt ${alt} v -600 should double-jump, got ${JSON.stringify(jumps)}`);
    } else {
      check(lands.length === 1 && lands[0] === 0, `land priority: alt ${alt}: jump before landing ${JSON.stringify(jumps)}`);
      env.frame(1 / 60);
      check(jumps[0] === 1, `land priority: alt ${alt}: want full jump on landing, got ${JSON.stringify(jumps)}`);
    }
    for (let i = 0; i < 90 && (B.alt > 0 || B.v > 0); i++) env.frame(1 / 60);
  }
}

// ---------- 5. режиссёр ----------
{
  const D = G.director;
  check(D && D.version >= 1, 'G.director missing');
  for (const k of ['phys', 'speed', 'inject', 'clear', 'hold', 'enter', 'exit', 'modes', 'reserve', 'busy', 'suppress', 'nextArrival']) check(D && typeof D[k] === 'function', `G.director.${k} missing`);
  const ph = D.phys();
  check(Math.abs(ph.peak - (cfg.jumpV * cfg.jumpV) / (2 * cfg.gravity)) < 0.5 && typeof ph.tUp === 'function', 'director.phys()');
  check(D.busy(41, 42) === 'meme' && D.busy(20, 21) === null, 'director.busy built-ins');

  const invincibleRun = (seconds, onFrame) => {
    if (G.state.mode === 'run') G.die({ type: 'clock' });
    G.startGame();
    for (let i = 0; i < seconds * 60; i++) {
      G.setFlag('invincible', 'test', true);
      if (onFrame) onFrame();
      env.frame(1 / 60);
    }
  };

  // hold: ни одно препятствие, поставленное после вызова, не прибывает раньше t + 2
  let holdAt = -1;
  const late = [];
  const offHold = G.on('spawn', (o) => {
    if (holdAt < 0 || G.state.mode !== 'run') return;
    late.push(o);
  });
  invincibleRun(16, () => {
    if (holdAt < 0 && G.state.t >= 10) {
      holdAt = G.state.t;
      D.hold(2);
    }
    for (const o of late) {
      if (o.balArr != null) continue;
      o.balArr = G.state.t + (o.x - HBX) / (G.state.speed * (o.drift == null ? 1 : o.drift));
    }
  });
  offHold();
  const early = late.filter((o) => o.balArr < holdAt + 2 - 0.05);
  check(holdAt > 0 && early.length === 0, `hold(2): ${early.length} obstacles arrive before t+2 (${early.map((o) => o.type + '@' + o.balArr.toFixed(2)).join(', ')})`);

  // chase: без минутки, дедлайна и пинга
  const banned = [];
  const offChase = G.on('spawn', (o) => {
    if (D.modes().indexOf('chase') >= 0 && (o.type === 'minute' || o.type === 'deadline' || o.type === 'ping')) banned.push(o.type);
  });
  invincibleRun(100, () => {
    if (G.state.t >= 5 && D.modes().indexOf('chase') < 0) D.enter('chase');
  });
  offChase();
  check(banned.length === 0, `chase: banned types spawned: ${banned.join(',')}`);
  check(D.modes().indexOf('chase') >= 0, 'chase mode lost during run');

  // потолок очков
  G.setMod('score', 'combo', 3);
  G.setMod('score', 'coffee', 2);
  G.setMod('score', 'fever', 2);
  env.frame(1 / 60);
  check(G.mod('score') <= 4.0001, `score cap: ${G.mod('score')}`);
  G.setMod('score', 'teamlead', 0);
  env.frame(1 / 60);
  check(G.mod('score') === 0, 'score cap must keep 0 from teamlead');
  G.setMod('score', 'teamlead', null);

  // nextArrival / aiming
  freshRun();
  const o = G.spawnObstacle('clock', HBX + G.state.speed * 0.5, { r: 18 });
  env.frame(1 / 60);
  const na = D.nextArrival();
  check(na > 0.4 && na < 0.55, `nextArrival ~0.5 s, got ${na}`);
  check(G.flag('aiming'), 'aiming flag should be on with an obstacle 0.5 s away');
  o.remove = true;
  env.frame(1 / 60);
  env.frame(1 / 60);
  check(!G.flag('aiming'), 'aiming flag should drop without obstacles');

  D.reserve(103, 126, 'allhands');
  check(D.busy(120, 121) === 'allhands', 'reserve/busy');
  D.suppress(176);
  check(D.busy(41, 42) !== 'meme', 'suppress drops built-in reserve');
}

// ---------- 6. разбор полёта ----------
{
  const realSpeedAt = G.speedAt;
  G.speedAt = () => 430;
  let lastInfo = null;
  G.on('die', (info) => {
    lastInfo = info;
  });
  const T0 = 1.2;
  function trial(id, opts, prep, pressAt) {
    freshRun();
    lastInfo = null;
    const o = G.spawnObstacle(id, 0, opts);
    o.x = HBX + 430 * T0 * (o.drift == null ? 1 : o.drift);
    if (prep) prep(o);
    const t0 = G.state.t;
    let pressed = pressAt == null;
    for (let i = 0; i < 160 && G.state.mode === 'run'; i++) {
      if (!pressed && G.state.t - t0 + 1 / 60 >= pressAt - 1e-6) {
        pressed = true;
        G.press('key');
        G.release();
      }
      env.frame(1 / 60);
    }
    return lastInfo;
  }
  // Первый удар по кролику, который не прыгал (относительно прибытия).
  function groundHit(id, opts, prep, v) {
    const def = G.obstacleTypes[id];
    const o = makeOb(id, opts, prep);
    const vx = v * (o.drift == null ? 1 : o.drift), dt = 1 / 240;
    o.x = HBX + vx * T0;
    const hb = { x: HBX, y: HB.dy, r: HB.r };
    for (let t = 0; t < T0 + 0.5; t += dt) {
      o.x -= vx * dt;
      if (def.hit(o, hb)) return t + dt - T0;
    }
    return 0;
  }
  // Низкое препятствие сбивает кролика на диване раньше, чем через 0.1 с после окна: «поздно» у него берём в пределах досягаемого.
  const cases = [
    ['clock r18', 'clock', { r: 18 }],
    ['tasks n4', 'tasks', { n: 4 }],
    ['laptop', 'laptop', {}, openLaptop],
    ['deadline', 'deadline', {}],
  ];
  for (const [name, id, opts, prep] of cases) {
    const w = windowOf(id, opts, prep, 430, 1 / 60);
    const lateBy = Math.min(0.1, (groundHit(id, opts, prep, 430) - w.last) * 0.6);
    for (const [dir, by, sign] of [['early', 0.1, -1], ['late', lateBy, 1]]) {
      if (by < 0.03) continue;
      const at = sign < 0 ? T0 + w.first - by : T0 + w.last + by;
      const info = trial(id, opts, prep, at);
      const dg = info && info.diagnosis;
      const ok = !!dg && dg.kind === dir && Math.sign(dg.err) === sign && Math.abs(Math.abs(dg.err) - by) <= 0.02;
      check(ok, `diagnosis ${name} ${dir}: ${info ? JSON.stringify(dg) : 'no death'}`);
      if (VERBOSE && dg) console.log(`  ${name} ${dir} by ${by.toFixed(3)}: ${dg.text}`);
    }
    const none = trial(id, opts, prep, null);
    check(none && none.diagnosis && none.diagnosis.kind === 'noJump', `diagnosis ${name} no jump: ${none ? JSON.stringify(none.diagnosis) : 'no death'}`);
  }
  // падение сверху на дедлайн (подсказка имеет смысл, только когда есть «Отложить»)
  const realModes = G.modes;
  G.modes = { stompable: (ob) => ob.type !== 'deadline' && ob.type !== 'minute' };
  freshRun();
  lastInfo = null;
  const dl = G.spawnObstacle('deadline', HBX + 2, {});
  G.bunny.alt = 95;
  G.bunny.v = -300;
  G.bunny.jumps = 1;
  for (let i = 0; i < 40 && G.state.mode === 'run'; i++) env.frame(1 / 60);
  check(lastInfo && lastInfo.o === dl && lastInfo.diagnosis && lastInfo.diagnosis.kind === 'deadline', `diagnosis deadline from above: ${lastInfo ? JSON.stringify(lastInfo.diagnosis) : 'no death'}`);
  G.modes = realModes;
  G.speedAt = realSpeedAt;
  console.log('разбор полёта: рано / поздно / не прыгнул / дедлайн сверху проверены');
}

// ---------- 7. ровная очередь pulse ----------
{
  const D = G.director;
  for (const [kind, mk] of [
    ['clock', () => ({ ob: 'clock', kind: 'ground', opts: { r: 18 } })],
    ['call L1', () => ({ ob: 'call', kind: 'air', opts: { level: 1 } })],
  ]) {
    if (G.state.mode === 'run') G.die({ type: 'clock' });
    G.startGame();
    for (let i = 0; i < 9 * 60; i++) {
      G.bunny.alt = 400;
      G.bunny.v = 0;
      env.frame(1 / 60);
    }
    const grp = { k: 1.5, I: 0 };
    const mine = [];
    const off = G.on('spawn', (o) => {
      if (mine.length < 4) mine.push(o);
    });
    D.clear();
    D.inject([{ rest: 0.4 }, ...[0, 1, 2, 3].map(() => Object.assign(mk(), { pulse: grp }))]);
    const arr = new Map();
    let aimingOk = true;
    for (let i = 0; i < 14 * 60; i++) {
      G.bunny.alt = 400;
      G.bunny.v = 0;
      const before = mine.map((o) => o.x);
      env.frame(1 / 60);
      mine.forEach((o, k) => {
        if (!arr.has(o) && before[k] != null && before[k] >= HBX && o.x < HBX) {
          arr.set(o, G.state.t - ((HBX - o.x) / (before[k] - o.x)) * G.state.dt);
        }
      });
      if (mine.length === 4 && arr.size > 0 && arr.size < 4 && !G.flag('aiming')) aimingOk = false;
    }
    off();
    const t = mine.map((o) => arr.get(o)).filter((x) => x != null);
    const gaps = t.slice(1).map((x, i) => x - t[i]);
    const spread = gaps.length ? Math.max(...gaps) - Math.min(...gaps) : 1;
    check(t.length === 4 && spread <= 1 / 60, `pulse ${kind}: arrivals ${t.map((x) => x.toFixed(3)).join(' ')}, gap spread ${(spread * 1000).toFixed(1)} ms`);
    check(gaps.every((g) => g >= 0.6 * grp.k - 0.02), `pulse ${kind}: gaps ${gaps.map((g) => g.toFixed(3)).join(' ')} shorter than k·0.6`);
    check(aimingOk, `pulse ${kind}: aiming dropped inside the queue`);
    if (VERBOSE) console.log(`  pulse ${kind}: gaps ${gaps.map((g) => g.toFixed(3)).join(' ')}`);
  }
  console.log('pulse: интервалы внутри очереди равны с точностью до кадра');
}

// ---------- 8. тихая помощь ----------
{
  const D = G.director;
  const runFor = (sec) => {
    if (G.state.mode === 'run') G.die({ type: 'clock' });
    G.startGame();
    for (let i = 0; i < sec * 60; i++) {
      G.setFlag('invincible', 'test', true);
      env.frame(1 / 60);
    }
    G.die({ type: 'clock' });
  };
  runFor(61);
  check(!D.assisted(), 'assist: off after a long run');
  runFor(5);
  runFor(5);
  check(!D.assisted(), 'assist: off after two short runs');
  const plain = G.speedAt(12);
  runFor(5);
  check(D.assisted(), 'assist: on after three short runs');
  check(G.speedAt(12) < plain - 1, 'assist: warm-up speed lasts longer');
  runFor(30);
  check(D.assisted(), 'assist: a 30 s run keeps it on');
  runFor(61);
  check(!D.assisted(), 'assist: a run over 60 s turns it off');
  console.log('тихая помощь: включается после трёх коротких забегов, выключается после длинного');
}

for (const e of G.errors) problems.push(`G.errors [${e.tag}] ${e.message}`);
for (const e of env.consoleErrors) if (!/^\[G\]/.test(e)) problems.push('console.error: ' + e);

if (problems.length) {
  console.log('\nFAIRNESS: FAIL');
  for (const p of problems) console.log('  ✗ ' + p);
  process.exit(1);
}
console.log('\nFAIRNESS: OK');
