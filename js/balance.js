/* Геймплей: режиссёр спавна, кривая сложности, комбо и near-miss, вехи времени. Владелец — агент balance. */
(() => {
  'use strict';
  const G = window.G;
  const cfg = G.cfg;
  const clamp = G.clamp, lerp = G.lerp;
  const HB = cfg.hitbox;
  const OWN = 'balance';

  cfg.jumpBuffer = 0.15;

  const TUTORIAL_T = 10, TUTORIAL_HELP_T = 16;
  const HELP_SHORT_T = 25, HELP_RESET_T = 60, HELP_RUNS = 3, HELP_MARGIN_T = 30;
  const NEAR_MIN = 5;
  const COMBO_TIERS = [5, 15, 30, 50];
  const CARROT_ALT = 24;
  const ARC_MAX_H = 72;
  const SOLO_GROUND_H = 95;
  const NULL_GAP = 2.6;
  const RAIN_EVERY = 0.25;
  const CLASSIC = { clock: 1, tasks: 1, call: 1 };
  const SCORE_CAP = 4;
  const CHEVRON_LEAD = 0.45;
  const AIM_T = 0.7;
  const FRESH_SHOWS = 3;
  const VETERAN_SHOWS = 10;
  const STAIRS_EVERY = 25;
  const CHASE_BAN = { minute: 1, deadline: 1, ping: 1 };
  const SEEN_KEY = 'eblan.balance.seen';

  const smooth = (k) => k * k * (3 - 2 * k);
  const rnd = (a, b) => a + Math.random() * (b - a);

  // Тихая помощь живёт только в памяти сессии: после перезагрузки игра снова обычная.
  const help = { short: 0, on: false };
  let tutT = TUTORIAL_T;

  // ---------- кривая скорости ----------
  G.speedAt = (t) => {
    const warm = t < tutT ? 0.9 + 0.1 * smooth(t / tutT) : 1;
    const narrow = 0.9 + 0.1 * clamp(((G.W || 520) - 520) / 200, 0, 1);
    const late = clamp((t - 240) / 300, 0, 1) * 0.07;
    return (cfg.baseSpeed + cfg.speedGain * ((1 - Math.exp(-t / cfg.speedTau)) * narrow + late)) * warm;
  };

  // ---------- физика прыжка ----------
  const P = { V: 760, g: 2300, T: 0.66, peak: 125 };
  function readPhys() {
    P.V = cfg.jumpV * G.mod('jumpV');
    P.g = cfg.gravity * G.mod('gravity');
    P.T = (2 * P.V) / P.g;
    P.peak = (P.V * P.V) / (2 * P.g);
  }
  // Первый момент, когда кролик в прыжке достигает высоты h: alt(t) = V·t − g·t²/2. Спуск через h — симметрично, в T − tUp(h).
  function tUp(h) {
    const d = P.V * P.V - 2 * P.g * Math.max(0, h);
    return d <= 0 ? P.T / 2 : (P.V - Math.sqrt(d)) / P.g;
  }
  const tDown = (h) => P.T - tUp(h);
  const altAt = (t) => P.V * t - (P.g * t * t) / 2;
  P.tUp = tUp;
  P.tDown = tDown;
  P.altAt = altAt;

  // ---------- состояние режиссёра ----------
  const dir = {
    queue: [],
    cursorD: 0,
    rest: 0,
    lastHaz: null,
    lastAir: null,
    phase: 'tutorial',
    waveStart: 0,
    waveLen: 10,
    lastPattern: '',
    lastNullT: 0,
    tp: 0,
    retroUntil: 0,
    eveningUntil: 0,
    holdUntil: 0,
    v: 0,
    lastStairsT: -1e9,
    snoozeDone: false,
    pulseWave: -1,
    pulseUntil: 0,
  };
  const modes = { chase: false, fever: false, boss: false };
  let bossPatterns = null;
  const reserves = [];
  const suppressed = Object.create(null);
  const BUILTIN = [
    { min: 176, from: 40, to: 46, tag: 'meme' },
    { min: 240, from: 58, to: 66, tag: 'lunch' },
    { min: 539, from: 134, to: 139, tag: 'evening' },
    { min: 1080, from: 269, to: 275, tag: 'night3' },
  ];
  const shown = Object.create(null);
  const hurt = Object.create(null);
  const storedSeen = G.store.getJSON(SEEN_KEY, null);
  const lifetime = storedSeen && typeof storedSeen === 'object' && !Array.isArray(storedSeen) ? storedSeen : {};
  let teachNow = false;
  const pending = [];
  const seen = Object.create(null);
  const speedWins = [];
  let speedK = 1;
  let msIdx = 0;
  const preDone = Object.create(null);
  const rain = { left: 0, acc: 0 };
  const combo = { count: 0, mult: 1 };

  const bx = () => cfg.runX + HB.dx;
  const has = (id, t) => {
    const d = G.obstacleTypes[id];
    return !!d && (d.minT || 0) <= (t == null ? G.state.t : t);
  };
  const isNight = () => {
    const m = G.clockMin();
    return m >= 22 * 60 || m < 6 * 60;
  };
  const difficulty = (t) => 1 - Math.exp(-Math.max(0, t - tutT) / 110);

  const keyOf = (o) => (o.type === 'call' && o.level != null ? 'call:' + o.level : o.type);
  const veteran = (key) => (Number(lifetime[key]) || 0) >= VETERAN_SHOWS;
  // Сколько раз тип показан в этом забеге до текущего объекта (spawn уже посчитал его самого).
  const isFresh = (key, counted) => !veteran(key) && (shown[key] || 0) - (counted ? 1 : 0) < FRESH_SHOWS;
  const stompOK = () => !!(G.modes && typeof G.modes.stompable === 'function');
  function canStomp(o) {
    if (!o || !stompOK()) return false;
    try {
      return !!G.modes.stompable(o);
    } catch (e) {
      return false;
    }
  }
  function holdD() {
    const S = G.state;
    if (!(dir.holdUntil > S.t)) return -Infinity;
    return S.dist + (dir.holdUntil - S.t) * Math.max(dir.v || 0, speedUntil(dir.holdUntil));
  }

  function planSpeed() {
    const S = G.state;
    const target = speedTarget(S.t);
    const k = Math.max(speedK, target) / (speedK || 1);
    const ahead = G.speedAt(S.t + 1.5) / Math.max(1, S.baseSpeed);
    return Math.max(200, S.speed * k * Math.max(1, ahead)) * 1.03;
  }
  const planT = (D, v) => G.state.t + (D - G.state.dist) / v;
  function speedUntil(t) {
    const S = G.state;
    return (S.speed + G.speedAt(t) * (S.speed / Math.max(1, S.baseSpeed))) / 2;
  }

  function intensity(tp) {
    if (dir.phase !== 'tension') return 0;
    const w = clamp((tp - dir.waveStart) / dir.waveLen, 0, 1);
    return modes.chase ? Math.min(0.6, w) : w;
  }

  // Запас в секундах сверх минимально проходимого: с ростом сложности и к пику волны сжимается.
  function margin(d, w) {
    const narrow = G.W < 600 ? 0.04 : 0;
    const assist = help.on && G.state.t < HELP_MARGIN_T ? 0.08 : 0;
    return lerp(0.38, 0.07, d) * lerp(1.3, 0.75, w) + narrow + assist + (modes.chase ? 0.08 : 0) + (modes.boss ? 0.05 : 0);
  }
  function restGap(d, w) {
    return (lerp(0.7, 0.2, d) * lerp(1.3, 0.6, w) + Math.random() * 0.3 * (1 - d)) * (modes.fever ? 0.6 : 1);
  }

  // ---------- классы событий на дорожке ----------
  // jump — надо быть выше h, пока препятствие проходит под хитбоксом; duck — ниже потолка c;
  // free — недосягаемо одиночным прыжком; solo — высота непредсказуема (самонаводящиеся).
  // Форму меряем точечными пробами самого def.hit, поэтому новые типы obstacles учитываются без знания о них.
  const PROBE = { x: 0, y: 0, r: 3 };
  const STEP = 8;
  const shape = { bottom: 0, top: 0, half: 0 };
  const hitAt = (o, def, x, y) => {
    PROBE.x = o.x + x;
    PROBE.y = y;
    return !!def.hit(o, PROBE);
  };
  // Край между точкой с попаданием (inside) и точкой без него (outside); возвращаем внешнюю границу.
  function edge(o, def, fixed, inside, outside, vertical) {
    for (let i = 0; i < 4; i++) {
      const mid = (inside + outside) / 2;
      if (vertical ? hitAt(o, def, fixed, mid) : hitAt(o, def, mid, fixed)) inside = mid;
      else outside = mid;
    }
    return outside;
  }
  // Проба радиуса r на сетке STEP не пропустит деталь толще STEP − 2r (2 ед.); форма выходит раздутой на r — это запас.
  function measure(o, def) {
    const reach = Math.ceil((Math.max(def.width || 0, o.w || 0) / 2 + 16) / STEP) * STEP;
    const yMax = def.kind === 'air' ? 264 : 200;
    let bottom = Infinity, top = -Infinity, half = -1, topX = 0, botX = 0;
    for (let x = -reach; x <= reach; x += STEP) {
      for (let y = 0; y <= yMax; y += STEP) {
        if (!hitAt(o, def, x, y)) continue;
        if (y < bottom) { bottom = y; botX = x; }
        if (y > top) { top = y; topX = x; }
        if (Math.abs(x) > half) half = Math.abs(x);
      }
    }
    if (top < bottom) return false;
    shape.top = edge(o, def, topX, top, top + STEP, true);
    shape.bottom = bottom > 0 ? edge(o, def, botX, bottom, bottom - STEP, true) : 0;
    let wide = half;
    for (let y = bottom; y <= top; y += STEP) {
      for (let sgn = -1; sgn <= 1; sgn += 2) {
        if (hitAt(o, def, sgn * half, y)) wide = Math.max(wide, Math.abs(edge(o, def, y, sgn * half, sgn * (half + STEP), false)));
      }
    }
    shape.half = wide;
    return true;
  }

  // exact — форма в текущей фазе, без запаса на анимацию (o.hMax): для разбора полёта.
  function classify(o, def, v, exact) {
    const vw = o.w || def.width || 40;
    const ev = { D: 0, cls: 'jump', w: vw, vw, drift: o.drift == null ? 1 : o.drift, h: 0, c: 0, a: 0, o };
    const air = def.kind === 'air';
    let ok = false;
    try {
      ok = measure(o, def);
    } catch (e) {
      ok = false;
    }
    let bottom, top;
    if (ok) {
      ev.w = Math.max(2 * shape.half, 8);
      bottom = air ? shape.bottom : 0;
      top = shape.top;
    } else if (air && typeof o.fly === 'number') {
      bottom = o.fly - (o.h || 30) / 2;
      top = o.fly + (o.h || 30) / 2;
    } else {
      bottom = 0;
      top = o.h || (o.r ? 1.86 * o.r + 6 : SOLO_GROUND_H);
    }
    if (!air && !exact) top = Math.max(top, o.h || 0, o.hMax || 0, def.height || 0);
    const c = bottom - (HB.dy + HB.r);
    const hJump = top - (HB.dy - HB.r);
    if (air && typeof def.update === 'function' && o.type !== 'call' && !def.steady) ev.cls = 'solo';
    else if (air && c >= P.peak + 6) ev.cls = 'free';
    else if (air && c >= 8) {
      ev.cls = 'duck';
      ev.c = c;
    } else if (hJump <= P.peak - 25) ev.h = Math.max(0, hJump);
    else ev.cls = 'solo';
    ev.a = (ev.w / 2 + HB.r) / (v * ev.drift);
    return ev;
  }

  // Минимальный интервал (с) между прибытиями центров A и B к кролику. a — полуокно, пока препятствие
  // перекрывает хитбокс: (w/2 + r) / (v·drift). Нижние оценки берут худший тайминг игрока (самый поздний
  // прыжок через A, самый ранний через B), основная — «центральный» прыжок плюс запас m.
  function minGap(A, B, m) {
    const T = P.T;
    if (A.cls === 'jump' && B.cls === 'jump') return Math.max(T + m, tUp(A.h) + A.a + tUp(B.h) + B.a + 0.12);
    if (A.cls === 'jump' && B.cls === 'duck') {
      const gap = Math.max(tDown(B.c) - T / 2 + B.a + m, tDown(B.c) - A.a + B.a + 0.04);
      // После «Отложить» кролика подкидывает: хоп держит его выше созвона ещё ~0.3 с после касания.
      return canStomp(A.o) ? Math.max(gap, 0.36 + B.a + 0.04) : gap;
    }
    if (A.cls === 'duck' && B.cls === 'jump') return Math.max(T / 2 - tUp(A.c) + A.a + m, T - B.a - tUp(A.c) + A.a + 0.04);
    if (A.cls === 'duck' && B.cls === 'duck') return A.a + B.a + 0.04;
    return T + A.a + B.a + m + 0.1;
  }

  function airSep(A, B) {
    return (A.w + B.w) / 2 / Math.min(0.85, A.drift, B.drift) + 16;
  }

  // ---------- подбираемое ----------
  function queuePickup(id, D, alt) {
    pending.push({ id, D, alt, teach: teachNow });
  }

  function flushPickups() {
    const S = G.state, b = bx(), spawnAt = G.W + 50 - b, vis = G.W - b;
    for (let i = pending.length - 1; i >= 0; i--) {
      const q = pending[i];
      const rel = q.D - S.dist;
      if (rel > spawnAt) continue;
      pending.splice(i, 1);
      if (rel < vis) continue;
      const id = q.id === 'carrot' && !G.pickupTypes.carrot ? null : q.id;
      if (id && !G.pickupTypes[id]) continue;
      const p = G.spawnPickup(id, b + rel, q.alt);
      if (p && q.teach) p.balTeach = true;
    }
  }

  function carrotArc(D0, n, midId) {
    const T = P.T, mid = n % 2 ? (n - 1) / 2 : -1;
    for (let k = 0; k < n; k++) {
      const t = (T * (k + 1)) / (n + 1);
      queuePickup(k === mid && midId ? midId : 'carrot', D0 + dir.v * t, CARROT_ALT - 2 + altAt(t));
    }
  }

  // Дуга двойного прыжка: второй прыжок в момент t2, вершина не выше cap.
  function doubleArc(D0, n, apexId) {
    const cap = G.GROUND - 56;
    const dV = cfg.djumpV * G.mod('jumpV');
    const dPeak = (dV * dV) / (2 * P.g);
    const alt1 = Math.min(P.peak, cap - CARROT_ALT - dPeak);
    if (alt1 < 50) return 0;
    const t2 = alt1 >= P.peak - 0.5 ? P.T / 2 : tUp(alt1);
    const tFall = (dV + Math.sqrt(dV * dV + 2 * P.g * alt1)) / P.g;
    const total = t2 + tFall;
    let skip = -1;
    if (apexId) {
      const tA = t2 + dV / P.g;
      queuePickup(apexId, D0 + dir.v * tA, CARROT_ALT - 2 + alt1 + dPeak);
      let best = Infinity;
      for (let k = 0; k < n; k++) {
        const e = Math.abs((total * (k + 1)) / (n + 1) - tA);
        if (e < best) {
          best = e;
          skip = k;
        }
      }
    }
    for (let k = 0; k < n; k++) {
      if (k === skip) continue;
      const t = (total * (k + 1)) / (n + 1);
      const tt = t - t2;
      const y = t < t2 ? altAt(t) : alt1 + dV * tt - (P.g * tt * tt) / 2;
      queuePickup('carrot', D0 + dir.v * t, CARROT_ALT - 2 + y);
    }
    return total;
  }

  // Морковки по дуге прыжка, нажатого так, чтобы кролик упал на верх препятствия: дебют «Отложить».
  function snoozeArc(ev) {
    const def = G.obstacleTypes[ev.o.type];
    const top = def && typeof def.stompTop === 'function' ? def.stompTop(ev.o) : NaN;
    if (!(top > 0)) return false;
    const fall = tDown(Math.max(0, top - (HB.dy - HB.r)));
    const D0 = ev.D - dir.v * fall;
    for (const f of [0.25, 0.45, 0.65, 0.85]) queuePickup('carrot', D0 + dir.v * fall * f, CARROT_ALT - 2 + altAt(fall * f));
    return true;
  }

  function decorate(ev, step, tp) {
    const v = dir.v, T = P.T;
    if (step.snoozeArc && ev.cls === 'jump' && snoozeArc(ev)) return;
    if (step.arc && ev.cls === 'jump' && ev.h <= ARC_MAX_H) {
      carrotArc(ev.D - (v * T) / 2, 5, step.apexId);
      return;
    }
    if (step.apexId && ev.cls === 'jump') {
      queuePickup(step.apexId, ev.D, P.peak * 0.85 + CARROT_ALT);
      return;
    }
    if ((step.under || step.underId) && ev.cls === 'duck') {
      queuePickup(step.underId || 'carrot', ev.D, CARROT_ALT);
      return;
    }
    const def = ev.o && G.obstacleTypes[ev.o.type];
    const chaseFuel = modes.chase && ev.cls === 'jump' && !!def && def.kind !== 'air';
    if (!chaseFuel && tp - dir.lastNullT >= NULL_GAP && Math.random() < 0.55 && tp > 8) {
      if (ev.cls === 'jump' && ev.h <= 80) {
        queuePickup(null, ev.D, P.peak * 0.85 + CARROT_ALT);
        dir.lastNullT = tp;
      } else if (ev.cls === 'duck') {
        queuePickup(null, ev.D, CARROT_ALT);
        dir.lastNullT = tp;
      }
      return;
    }
    const evening = G.state.t < dir.eveningUntil;
    if (step.land || chaseFuel || Math.random() < (evening ? 0.3 : 0.06)) {
      if (ev.cls === 'jump') queuePickup('carrot', ev.D + v * (T / 2 + 0.1), CARROT_ALT);
      else if (ev.cls === 'duck') queuePickup('carrot', ev.D, CARROT_ALT);
    }
  }

  // ---------- выбор типа ----------
  function pickId(step, tArr) {
    const t = G.state.t;
    if (step.ob && has(step.ob, tArr) && !(modes.chase && CHASE_BAN[step.ob])) return step.ob;
    const retro = t < dir.retroUntil;
    const strict = step.tight || step.strict;
    let kind = step.kind || (step.ob && G.obstacleTypes[step.ob] ? G.obstacleTypes[step.ob].kind : 'any');
    if (kind === 'any' && isNight() && Math.random() < 0.4) kind = 'air';
    const allowed = (def) => {
      if (retro && !CLASSIC[def.id]) return false;
      if (modes.chase && CHASE_BAN[def.id]) return false;
      if (kind === 'ground' && def.kind === 'air') return false;
      if (kind === 'air' && def.kind !== 'air') return false;
      return true;
    };
    let id = strict ? G.pickObstacleType(t, (def) => allowed(def) && !isFresh(def.id)) : null;
    if (!id) id = G.pickObstacleType(t, allowed);
    if (!id && kind !== 'any') id = G.pickObstacleType(t, (def) => !(modes.chase && CHASE_BAN[def.id]));
    return id;
  }

  // ---------- размещение ----------
  function estimateD() {
    const v = dir.v;
    let D = dir.cursorD + dir.rest * v;
    if (dir.lastHaz) D = Math.max(D, dir.lastHaz.D + (P.T * 0.8 + dir.rest) * v);
    return D;
  }
  const LEAD = { lead: true };
  // Летающим нужен запас, чтобы шеврон у края успел гореть CHEVRON_LEAD секунд до въезда.
  const airLead = () => (dir.v || 0) * 1.12 * CHEVRON_LEAD;
  function stepIsAir(step) {
    if (step.kind === 'air') return true;
    const def = step.ob && G.obstacleTypes[step.ob];
    return !!def && def.kind === 'air';
  }
  function minAhead(step) {
    const b = bx(), base = (G.W + 40 - b) / 0.85 + (stepIsAir(step) ? airLead() : 0);
    return step.lead ? Math.max(base, G.W + 30 - b + (dir.v * P.T) / 2 + 10) : base;
  }

  function finishPlace(o, ev, step, tight) {
    o.balCls = ev.cls;
    o.balTight = !!tight;
    if (typeof step.onPlace !== 'function') return;
    try {
      step.onPlace(o, ev);
    } catch (e) {
      G.report('director onPlace', e);
    }
  }

  function arrivalIn(D) {
    const S = G.state, rel = D - S.dist;
    return rel / Math.max(1, speedUntil(S.t + rel / Math.max(1, S.speed)));
  }

  function placeHazard(step) {
    const S = G.state, v = dir.v;
    let D = Math.max(dir.cursorD + dir.rest * v, S.dist + minAhead(step), holdD());
    const id = pickId(step, planT(D, v));
    if (!id) return;
    const def = G.obstacleTypes[id];
    if (def.kind === 'air' && !stepIsAir(step)) D = Math.max(D, S.dist + minAhead(step) + airLead());
    if (step.at) D = Math.max(D, S.dist + (step.at - S.t) * speedUntil(step.at));
    const o = G.spawnObstacle(id, bx() + (D - S.dist), step.opts);
    if (!o) return;
    const key = keyOf(o);
    const ev = classify(o, def, v);
    const tp = planT(D, v);
    const d = difficulty(tp);
    const tight = step.tight && !isFresh(key, true);
    let loose = !!step.loose;
    if (hurt[key]) {
      loose = true;
      delete hurt[key];
    }
    let m = margin(d, intensity(tp));
    if (tight) m = Math.max(0.05, m * 0.65);
    if (loose) m = m * 1.5 + 0.15;
    else if (dir.phase === 'tutorial') m += 0.1;
    const A = dir.lastHaz;

    const Dn = A ? A.D + A.vw / 2 + (step.edge || 8) + ev.vw / 2 : 0;
    if (step.merge && A && A.o && A.cls === 'jump' && ev.cls === 'jump' && A.drift === 1 && ev.drift === 1 && Dn - S.dist > G.W + 20 - bx()) {
      const left = Math.min(A.D - A.w / 2, Dn - ev.w / 2);
      const wTot = Math.max(A.D + A.w / 2, Dn + ev.w / 2) - left;
      const h = Math.max(A.h, ev.h);
      // Связку берём одним прыжком, только если время над h покрывает всю ширину с запасом 0.12 с.
      if (h < P.peak - 10 && tDown(h) - tUp(h) - (wTot + 2 * HB.r) / v >= 0.12) {
        o.x = bx() + (Dn - S.dist);
        A.w = wTot;
        A.vw = wTot;
        A.h = h;
        A.D = left + wTot / 2;
        A.a = (wTot / 2 + HB.r) / v;
        dir.cursorD = A.D;
        dir.rest = 0;
        finishPlace(o, A, step, tight);
        decorate(A, step, tp);
        return;
      }
    }

    if (step.with && A && ev.cls === 'free') D = Math.max(A.D, S.dist + minAhead(step));
    else if (A && ev.cls !== 'free') D = Math.max(D, A.D + (minGap(A, ev, m) + dir.rest) * v);
    if (step.pulse) {
      const grp = step.pulse;
      if (A && A.pulse === grp) {
        if (!grp.I) grp.I = Math.max(minGap(A, ev, m), grp.k * 0.6);
        D = Math.max(D, A.D + Math.max(grp.I, minGap(A, ev, m)) * v);
      }
      ev.pulse = grp;
      dir.pulseUntil = Math.max(dir.pulseUntil, planT(D, v) + 0.2);
    }
    if (ev.cls !== 'jump' || def.kind === 'air') {
      if (dir.lastAir) D = Math.max(D, dir.lastAir.D + airSep(dir.lastAir, ev));
      dir.lastAir = ev;
    }
    ev.D = D;
    o.x = bx() + (D - S.dist) * ev.drift;
    if (typeof def.alignTo === 'function') def.alignTo(o, arrivalIn(D));
    if (ev.cls !== 'free') dir.lastHaz = ev;
    if (!step.with) dir.cursorD = D;
    dir.rest = 0;
    finishPlace(o, ev, step, tight);
    decorate(ev, step, tp);
  }

  function placeFree(step) {
    const S = G.state, v = dir.v;
    const pseudo = { D: 0, cls: 'jump', w: 0, vw: 0, drift: 1, h: 0, c: 0, a: 0, o: null };
    let D = Math.max(dir.cursorD + dir.rest * v, S.dist + minAhead(LEAD), holdD());
    if (step.at) D = Math.max(D, S.dist + (step.at - S.t) * speedUntil(step.at));
    const tp = planT(D, v);
    const m = margin(difficulty(tp), 0) + 0.1;
    if (dir.lastHaz) D = Math.max(D, dir.lastHaz.D + (minGap(dir.lastHaz, pseudo, m) + dir.rest) * v);
    if (step.line) {
      const n = step.line;
      for (let k = 0; k < n; k++) queuePickup('carrot', D + k * 34, CARROT_ALT);
      dir.cursorD = D + n * 34 + 30;
      dir.rest = P.T / 2 + 0.1;
      return;
    }
    const D0 = D - (v * P.T) / 2;
    let air = step.double ? doubleArc(D0, 6, step.apexId) : 0;
    if (!air) {
      carrotArc(D0, 5, step.apexId);
      air = P.T;
    }
    pseudo.D = D0 + (v * P.T) / 2;
    dir.lastHaz = pseudo;
    dir.cursorD = pseudo.D;
    dir.rest = Math.max(0, air - P.T);
    if (step.thenNull && tp - dir.lastNullT >= NULL_GAP * 0.6) {
      queuePickup(null, D0 + v * (air + 0.35), CARROT_ALT + 2);
      dir.lastNullT = tp;
    }
  }

  function runStep(step) {
    if (step.rest) {
      dir.rest += step.rest;
      return;
    }
    if (step.fn) {
      step.fn();
      return;
    }
    teachNow = !!step.teach;
    try {
      if (step.free || step.line) placeFree(step);
      else placeHazard(step);
    } finally {
      teachNow = false;
    }
  }

  // ---------- паттерны ----------
  const groundStep = (extra) => Object.assign({ kind: 'ground' }, extra);
  const callStep = (level, extra) => Object.assign({ ob: 'call', kind: 'air', opts: { level } }, extra);
  const canCall = () => has('call', dir.tp);

  const PATTERNS = {
    single: {
      w: (d) => 3 - 1.5 * d,
      build: () => [{ kind: 'any' }],
    },
    arcOver: {
      w: (d, w) => (1 - w) * 0.35 * (1 - d),
      build: () => [groundStep({ arc: true, lead: true })],
    },
    twin: {
      w: (d) => (d > 0.03 && has('clock') ? 1 : 0),
      build: (d) => {
        const r1 = d < 0.25 ? 18 : G.pick([18, 23]), r2 = d < 0.25 ? 18 : G.pick([18, 23]);
        return [{ ob: 'clock', opts: { r: r1 } }, { ob: 'clock', opts: { r: r2 }, merge: true }];
      },
    },
    triple: {
      w: (d) => (d > 0.45 && has('clock') ? 0.45 : 0),
      build: () => [{ ob: 'clock', opts: { r: 18 } }, { ob: 'clock', opts: { r: 18 }, merge: true }, { ob: 'clock', opts: { r: 18 }, merge: true, apexId: 'carrot' }],
    },
    ladder: {
      w: (d) => (d > 0.12 ? 0.8 : 0),
      build: (d) => {
        const b = d > 0.5 ? 3 : 2;
        return [0, 1, 2].map((k) => groundStep({ ob: 'tasks', opts: { n: b + k }, tight: k > 0, strict: true }));
      },
    },
    rhythm: {
      w: (d, w) => (d > 0.25 ? 0.6 + w : 0),
      build: () => [groundStep({ strict: true }), groundStep({ tight: true }), groundStep({ tight: true })],
    },
    pulse: {
      w: (d, w) => (d > 0.2 && w > 0.6 && dir.pulseWave !== dir.waveStart ? 0.6 + 0.6 * w : 0),
      build: (d) => {
        dir.pulseWave = dir.waveStart;
        const grp = { k: Math.random() < 0.5 ? 1 : 1.5, I: 0 };
        const n = 3 + Math.floor(Math.random() * 3);
        const duck = canCall() && Math.random() < 0.35;
        const ob = duck ? 'call' : Math.random() < 0.5 && has('tasks') ? 'tasks' : 'clock';
        const opts = duck ? { level: 1 } : ob === 'tasks' ? { n: d > 0.5 ? 3 : 2 } : { r: 18 };
        const steps = [];
        for (let i = 0; i < n; i++) steps.push(duck ? callStep(1, { pulse: grp, strict: true }) : groundStep({ ob, opts, pulse: grp, strict: true }));
        return steps;
      },
    },
    snoozeStairs: {
      w: (d) => (d > 0.2 && stompOK() && G.state.t - dir.lastStairsT >= STAIRS_EVERY ? 0.5 : 0),
      build: () => {
        dir.lastStairsT = G.state.t;
        return [0, 1, 2].map(() => groundStep({ ob: 'clock', opts: { r: 18 }, strict: true }));
      },
    },
    corridor: {
      air: true,
      w: (d) => (canCall() ? 1 : 0),
      build: (d) => {
        const n = d > 0.4 ? G.pick([1, 2, 3]) : G.pick([1, 2]);
        const steps = [groundStep({})];
        for (let k = 0; k < n; k++) steps.push(callStep(1, { under: k === 0 }));
        steps.push(groundStep({}));
        return steps;
      },
    },
    combo: {
      air: true,
      w: (d) => (canCall() && d > 0.18 ? 1 : 0),
      build: () => (Math.random() < 0.5 ? [groundStep({}), callStep(0, { tight: true })] : [callStep(0, {}), groundStep({ tight: true })]),
    },
    hurdleHigh: {
      air: true,
      w: (d) => (canCall() && d > 0.35 ? 0.5 : 0),
      build: () => [groundStep({ ob: 'tasks', opts: { n: 3 } }), callStep(2, { with: true })],
    },
    stairsAir: {
      air: true,
      w: (d, w) => (canCall() && d > 0.4 ? 0.6 + 0.4 * w : 0),
      build: () => [callStep(0, {}), callStep(1, { under: true }), callStep(0, {})],
    },
    gauntlet: {
      w: (d, w) => (d > 0.55 && w > 0.6 ? 0.8 : 0),
      build: () => {
        const n = 4 + (Math.random() < 0.4 ? 1 : 0), steps = [];
        for (let k = 0; k < n; k++) steps.push({ kind: 'any', tight: k > 0, strict: true });
        return steps;
      },
    },
  };
  const RETRO_OK = { single: 1, twin: 1, ladder: 1, rhythm: 1, arcOver: 1 };

  function choosePattern(d, w) {
    const night = isNight(), retro = G.state.t < dir.retroUntil;
    let total = 0;
    const pool = [];
    for (const name in PATTERNS) {
      const p = PATTERNS[name];
      if (bossPatterns && bossPatterns.indexOf(name) < 0) continue;
      if (retro && !RETRO_OK[name] && !bossPatterns) continue;
      let wt = p.w(d, w);
      if (wt <= 0) continue;
      if (night && p.air) wt *= 1.8;
      if (modes.fever && p.air) wt *= 0.5;
      if (modes.chase && name === 'arcOver') wt *= 3;
      if (name === dir.lastPattern) wt *= 0.3;
      pool.push(name, wt);
      total += wt;
    }
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i += 2) {
      r -= pool[i + 1];
      if (r <= 0) return pool[i];
    }
    return 'single';
  }

  function breather(kind) {
    const d = difficulty(G.state.t);
    const steps = [{ rest: 0.25 + 0.2 * (1 - d) }];
    if (kind === 'binge') {
      steps.push({ free: true }, { rest: 0.15 }, { line: 5 }, { free: true, thenNull: true });
    } else if (kind === 'midnight') {
      steps.push({ free: true, double: true }, { rest: 0.2 }, { free: true, double: true, thenNull: true });
    } else {
      const dbl = d > 0.3 && Math.random() < 0.3;
      steps.push({ free: true, double: dbl, thenNull: true });
      if (Math.random() < 0.2) steps.push({ rest: 0.1 }, { line: 3 });
    }
    steps.push({ rest: 0.35 });
    return steps;
  }

  function debutStep(id, def) {
    if (id === 'call') {
      if (!seen['call:1']) return { ob: id, kind: 'air', loose: true, opts: { level: 1 }, under: true };
      if (!seen['call:0']) return { ob: id, kind: 'air', loose: true, opts: { level: 0 }, arc: true };
      return null;
    }
    if (seen[id]) return null;
    return def.kind === 'air' ? { ob: id, kind: 'air', loose: true, opts: { level: 1 }, under: true } : { ob: id, loose: true, apexId: 'carrot' };
  }

  function debutFor(tp) {
    if (bossPatterns) return null;
    for (const id in G.obstacleTypes) {
      const def = G.obstacleTypes[id];
      if ((def.minT || 0) > tp) continue;
      if (Number(def.weight(tp)) <= 0) continue;
      if (dir.retroUntil > G.state.t && !CLASSIC[id]) continue;
      if (modes.chase && CHASE_BAN[id]) continue;
      const step = debutStep(id, def);
      if (step) return [{ rest: 0.35 }, step, { rest: 0.45 }];
    }
    return null;
  }

  function snoozeDebut(tp) {
    if (dir.snoozeDone || tp < 24 || tp > 38 || bossPatterns || dir.phase === 'breather' || !has('clock')) return null;
    if (!canStomp({ type: 'clock', r: 23, alt: 0, x: 0 }) || busyAt(tp, tp + 3)) return null;
    dir.snoozeDone = true;
    return [{ rest: 0.4 }, { ob: 'clock', kind: 'ground', opts: { r: 23 }, loose: true, snoozeArc: true, teach: true }, { rest: 0.6 }];
  }

  function startWave(tp, peak) {
    const d = difficulty(tp);
    dir.phase = 'tension';
    dir.waveLen = lerp(10, 15, d) + Math.random() * 3;
    dir.waveStart = peak ? tp - dir.waveLen * 0.8 : tp;
  }

  function tutorial() {
    const apex = G.pickupTypes.gold ? 'gold' : 'carrot';
    const extra = help.on
      ? [{ rest: 0.45 }, { ob: 'clock', kind: 'ground', opts: { r: 18 }, arc: true, lead: true }, { rest: 0.45 }, { ob: 'tasks', kind: 'ground', opts: { n: 2 }, arc: true, lead: true }]
      : [];
    return [
      { rest: 0.6 },
      { ob: 'clock', kind: 'ground', opts: { r: 18 }, arc: true, lead: true },
      { rest: 0.45 },
      { ob: 'tasks', kind: 'ground', opts: { n: 2 }, land: true },
      { rest: 0.4 },
      { ob: 'clock', kind: 'ground', opts: { r: 23 }, apexId: 'carrot' },
      { rest: 0.4 },
      { ob: 'tasks', kind: 'ground', opts: { n: 3 }, arc: true, lead: true },
      { rest: 0.45 },
      { ob: 'clock', kind: 'ground', opts: { r: 18 } },
      { ob: 'clock', kind: 'ground', opts: { r: 18 }, merge: true, land: true },
      ...extra,
      { rest: 0.4 },
      { free: true, double: true, apexId: apex, teach: true },
      { rest: 0.5 },
    ];
  }

  function refill() {
    const S = G.state, v = dir.v;
    const tp = planT(estimateD(), v);
    if (tp < dir.holdUntil) {
      dir.cursorD = Math.max(dir.cursorD, S.dist + (dir.holdUntil - S.t) * v);
      dir.rest = 0;
    }
    if (dir.phase === 'tutorial') {
      startWave(tp, false);
    } else if (dir.phase === 'tension' && tp - dir.waveStart >= dir.waveLen) {
      dir.phase = 'breather';
      dir.queue.push(...breather(isNight() ? 'night' : ''));
      dir.queue.push({ fn: () => startWave(planT(estimateD(), dir.v), false) });
      return;
    } else if (dir.phase === 'breather') {
      startWave(tp, false);
    }
    const debut = debutFor(tp) || snoozeDebut(tp);
    if (debut) {
      dir.queue.push(...debut);
      return;
    }
    const d = difficulty(tp), w = intensity(tp);
    dir.tp = tp;
    const name = choosePattern(d, w);
    dir.lastPattern = name;
    dir.queue.push(...PATTERNS[name].build(d, w));
    dir.rest += restGap(d, w);
  }

  function inject(steps) {
    if (!Array.isArray(steps)) steps = [steps];
    dir.queue.unshift(...steps.filter((st) => st && typeof st === 'object'));
  }

  function direct() {
    const S = G.state;
    readPhys();
    dir.v = planSpeed();
    for (let guard = 0; guard < 16; guard++) {
      if (!dir.queue.length) refill();
      if (!dir.queue.length) break;
      const step = dir.queue[0];
      if (!step.rest && !step.fn && !step.merge && !step.with) {
        const est = Math.max(step.at ? S.dist + (step.at - S.t) * speedUntil(step.at) : estimateD(), holdD());
        if (est - S.dist > minAhead(step.free ? LEAD : step)) break;
      }
      dir.queue.shift();
      runStep(step);
    }
    flushPickups();
  }

  // ---------- скорость: волны и события ----------
  function speedTarget(t) {
    let k = 1;
    for (const w of speedWins) {
      if (t < w.from || t > w.to) continue;
      const ramp = smooth(clamp(Math.min((t - w.from) / 2, (w.to - t) / 2), 0, 1));
      k *= 1 + (w.k - 1) * ramp;
    }
    return k;
  }
  function speedWindow(sec, k) {
    speedWins.push({ from: G.state.t, to: G.state.t + sec, k });
  }

  // ---------- комбо ----------
  function setCombo(count, reason) {
    const lost = combo.count;
    combo.count = count;
    let tier = 0;
    while (tier < COMBO_TIERS.length && count >= COMBO_TIERS[tier]) tier++;
    const mult = 1 + 0.5 * tier;
    combo.mult = mult;
    G.setMod('score', 'combo', mult > 1 ? mult : null);
    capScore();
    G.emit('combo', { count, mult, reason, lost: reason ? lost : 0 });
  }

  // Комбо ×3, кофе ×2 и фивер ×2 вместе дали бы ×12: компенсирующий множитель держит итог не выше SCORE_CAP.
  function capScore() {
    G.setMod('score', 'balance-cap', null);
    const p = G.mod('score');
    if (p > SCORE_CAP) G.setMod('score', 'balance-cap', SCORE_CAP / p);
  }
  function bump() {
    if (G.state.mode !== 'run') return;
    setCombo(combo.count + 1, null);
  }
  function breakCombo(reason, quiet) {
    if (!combo.count) return;
    const lost = combo.count;
    setCombo(0, reason);
    if (!quiet && lost >= 3 && G.fx && G.fx.popup && G.state.mode === 'run') {
      const B = G.bunny;
      G.fx.popup(B.x + 30, B.alt + 70, 'КОМБО СГОРЕЛО', { color: G.C.muted, size: 13, life: 0.9 });
    }
  }

  function checkMisses() {
    const hb = G.bunnyHitbox();
    const behind = hb.x - (G.flag('magnet') ? 70 : HB.r + 18);
    for (const p of G.pickups) {
      if (p.taken || p.balMiss || p.balRain || p.balTeach || p.x >= behind) continue;
      const def = G.pickupTypes[p.type];
      if (!def || !(def.magnetic || p.type === 'carrot')) continue;
      p.balMiss = true;
      breakCombo('miss');
      return;
    }
  }

  // ---------- морковный дождь ----------
  function dropCarrot() {
    const b = bx();
    const x = b + rnd(190, Math.max(220, G.W + 20 - b));
    const p = G.spawnPickup(G.pickupTypes.carrot ? 'carrot' : null, x, G.GROUND + 30);
    if (!p) return;
    p.balRain = true;
    p.balFall = CARROT_ALT + rnd(0, 118);
    p.balVy = -rnd(160, 280);
  }
  function updateRain(dt) {
    if (rain.left > 0) {
      rain.left -= dt;
      rain.acc -= dt;
      while (rain.acc <= 0 && rain.left > 0) {
        rain.acc += RAIN_EVERY;
        dropCarrot();
      }
    }
    for (const p of G.pickups) {
      if (p.balFall == null || p.taken) continue;
      if (p.pulled) {
        p.balFall = null;
        continue;
      }
      p.balVy -= 520 * dt;
      p.alt += p.balVy * dt;
      if (p.alt <= p.balFall) {
        p.alt = p.balFall;
        p.balFall = null;
      }
    }
  }

  // ---------- вехи времени ----------
  G.milestones = [
    [30, 'Кофе-брейк. Заслужил'],
    [60, 'Стендап. Просто стой и кивай'],
    [176, 'Пожалуйста, давай ебланить'],
    [240, 'Обед. С неба падают морковки'],
    [300, 'Постобеденная кома. Лапы ватные'],
    [360, 'Ретро? Какое ретро'],
    [420, 'Созвон, который мог быть письмом'],
    [539, 'Ещё минутку…'],
    [540, 'Рабочий день всё. Ебланство легально'],
    [660, 'Ещё одна серия — и спать'],
    [780, 'Калифорния проснулась. Созвоны'],
    [900, 'Полночь. Ты больше не человек, ты кролик'],
    [1080, 'Три ночи. Остановись (не останавливайся)'],
    [1260, 'Рассвет. Ты ебланил всю ночь'],
    [1440, 'Сутки ебланства. Стендап через минуту'],
  ].map(([min, text]) => ({ min, clock: G.fmtClock(cfg.startClockMin + min), text }));

  function milestoneBonus(min, label) {
    const B = G.bunny;
    G.addBonus(min, { label, kind: 'milestone', x: B.x + 40, alt: B.alt + 80 });
  }
  function releaseMinute() {
    G.setMod('time', 'balance-minute', null);
  }

  const atClock = (min) => min / cfg.minPerSec;
  const PRE = [
    { min: 30, lead: 3.6, fn: () => inject([{ line: 3, at: atClock(30.6) }]) },
    // Мем-будильник доезжает до кролика в 11:56 + 0.68 мин: удар, если случится, придётся ровно на 11:56.
    {
      min: 176,
      lead: 3.4,
      fn: () => {
        dir.queue.length = 0;
        inject([{ ob: 'clock', kind: 'ground', opts: { r: 26, hands: 'meme' }, at: atClock(176.68), arc: true, lead: true, apexId: G.pickupTypes.gold ? 'gold' : 'carrot' }, { rest: 0.5 }]);
      },
    },
    {
      min: 240,
      lead: 1.8,
      fn: () => {
        dir.queue.length = 0;
        dir.holdUntil = atClock(240) + 5.4;
      },
    },
  ];

  const EVENTS = {
    60: () => {
      if (!canCall()) return;
      inject([{ rest: 0.3 }, callStep(1, { under: true, loose: true }), callStep(1, { under: true }), callStep(1, { under: true }), { rest: 0.4 }]);
    },
    240: () => {
      rain.left = 5;
      rain.acc = 0.05;
    },
    300: () => speedWindow(8, 0.86),
    360: () => {
      dir.retroUntil = G.state.t + 14;
    },
    420: () => {
      if (canCall()) inject([...PATTERNS.corridor.build(0.5), { rest: 0.3 }, ...PATTERNS.combo.build()]);
    },
    539: () => {
      G.setMod('time', 'balance-minute', 0.3);
      G.after(1.6, releaseMinute);
    },
    540: () => {
      releaseMinute();
      speedWindow(15, 1.12);
      dir.eveningUntil = G.state.t + 15;
    },
    660: () => {
      dir.queue.length = 0;
      inject(breather('binge'));
    },
    900: () => {
      dir.queue.length = 0;
      inject(breather('midnight'));
    },
    1080: () => {
      dir.queue.length = 0;
      startWave(G.state.t, true);
      inject([...PATTERNS.gauntlet.build(), { rest: 0.4 }]);
    },
    1260: () => {
      milestoneBonus(60, '+1 ЧАС ЗА НОЧНУЮ СМЕНУ');
      dir.queue.length = 0;
      inject(breather(''));
    },
    1440: () => milestoneBonus(120, '+2 ЧАСА: СУТКИ!'),
  };

  function runEvent(fn) {
    try {
      fn();
    } catch (e) {
      G.report('balance event', e);
    }
  }

  function milestones() {
    const gm = G.state.t * cfg.minPerSec;
    for (const pre of PRE) {
      if (!preDone[pre.min] && !suppressed[pre.min] && gm >= pre.min - pre.lead * cfg.minPerSec && gm < pre.min) {
        preDone[pre.min] = true;
        runEvent(pre.fn);
      }
    }
    while (msIdx < G.milestones.length && gm >= G.milestones[msIdx].min) {
      const m = G.milestones[msIdx++];
      G.emit('milestone', m);
      if (EVENTS[m.min] && !suppressed[m.min]) runEvent(EVENTS[m.min]);
    }
  }

  // ---------- режиссёр как сервис ----------
  const overlaps = (a0, a1, b0, b1) => a0 <= b1 && b0 <= a1;
  function busyAt(fromT, toT) {
    for (const r of reserves) if (overlaps(fromT, toT, r.from, r.to)) return r.tag;
    for (const b of BUILTIN) if (!suppressed[b.min] && overlaps(fromT, toT, b.from, b.to)) return b.tag;
    return null;
  }

  function nextArrival() {
    const S = G.state, hb = G.bunnyHitbox();
    let best = Infinity;
    for (const o of G.obstacles) {
      if (o.deco || o.dead || o.passed || o.balCls === 'free') continue;
      const v = S.speed * (o.drift == null ? 1 : o.drift);
      if (!(v > 0)) continue;
      const t = Math.max(0, (o.x - hb.x) / v);
      if (t < best) best = t;
    }
    return best;
  }

  function enterMode(mode, opts) {
    if (!(mode in modes)) return false;
    modes[mode] = true;
    if (mode === 'boss') {
      const list = opts && Array.isArray(opts.patterns) ? opts.patterns.filter((n) => PATTERNS[n]) : [];
      bossPatterns = list.length ? list : null;
    }
    return true;
  }
  function exitMode(mode) {
    if (!(mode in modes)) return;
    modes[mode] = false;
    if (mode === 'boss') bossPatterns = null;
  }
  function resetModes() {
    for (const k in modes) modes[k] = false;
    bossPatterns = null;
    for (let i = reserves.length - 1; i >= 0; i--) if (reserves[i].run) reserves.splice(i, 1);
  }

  G.director = {
    version: 1,
    phys() {
      readPhys();
      return P;
    },
    speed: () => dir.v || G.state.speed || cfg.baseSpeed,
    inject,
    clear() {
      dir.queue.length = 0;
    },
    hold(sec) {
      if (!(sec > 0)) return;
      dir.holdUntil = Math.max(dir.holdUntil, G.state.t + sec);
    },
    enter: enterMode,
    exit: exitMode,
    modes: () => Object.keys(modes).filter((k) => modes[k]),
    reserve(fromT, toT, tag) {
      if (!(toT >= fromT)) return;
      reserves.push({ from: fromT, to: toT, tag: tag == null ? 'reserved' : String(tag), run: G.state.mode === 'run' });
    },
    busy: (fromT, toT) => busyAt(fromT, toT == null ? fromT : toT),
    suppress(min) {
      suppressed[min] = true;
    },
    nextArrival,
    assisted: () => help.on,
  };

  // ---------- разбор полёта ----------
  const jumpLog = [];
  const snap = { o: null, v: 0, alt: 0, hbY: 0, hbX: 0 };
  const fmtSec = (x) => x.toFixed(2).replace('.', ',');
  const DIAG = {
    noJump: 'Не прыгнул',
    duck: 'Под этим созвоном надо было пробежать',
    double: 'Двойной унёс прямо в созвон',
    minute: 'Минутка повторяет твою высоту — дождись, пока выберет полосу',
    deadline: 'Дедлайн нельзя отложить',
    almost: 'Чуть выше — и отложил бы',
  };
  const diag = (kind, err, text) => ({ kind, text: text || DIAG[kind], err: err || 0 });

  // Окно нажатия одиночного прыжка с дивана, перебором по настоящему def.hit (форма в текущей фазе).
  const WIN_STEP = 0.002, WIN_DT = 1 / 180;
  function jumpWindow(o, def, v) {
    const S = G.state, vx = v * (o.drift == null ? 1 : o.drift), hbX = snap.hbX;
    if (!(vx > 1) || !Number.isFinite(o.x)) return null;
    const ghost = Object.create(o);
    const hb = { x: hbX, y: 0, r: HB.r };
    const reach = (o.w || def.width || 40) / 2 + HB.r + 4;
    const tArr = S.t + (o.x - hbX) / vx, tPass = tArr + reach / vx;
    const blocked = (p) => {
      for (let t = Math.min(p, tArr - reach / vx) - WIN_DT; t <= tPass; t += WIN_DT) {
        ghost.x = o.x + vx * (S.t - t);
        if (Math.abs(ghost.x - hbX) > reach + 8) continue;
        const tau = t - p;
        hb.y = (tau > 0 && tau < P.T ? altAt(tau) : 0) + HB.dy;
        if (def.hit(ghost, hb)) return true;
      }
      return false;
    };
    let lo = Infinity, hi = -Infinity;
    for (let p = tArr - P.T - 0.05; p <= tArr + 0.05; p += WIN_STEP) {
      if (blocked(p)) continue;
      if (p < lo) lo = p;
      if (p > hi) hi = p;
    }
    return lo <= hi ? { lo, hi } : null;
  }

  function diagnose(o) {
    const S = G.state, def = o && G.obstacleTypes[o.type];
    if (!def || snap.o !== o) return null;
    if (stompOK() && o.type === 'deadline' && snap.v < 0 && snap.hbY > 70) return diag('deadline');
    if (stompOK() && typeof def.stompTop === 'function' && snap.v < 0) {
      const top = def.stompTop(o);
      if (snap.hbY >= top - 14 && snap.hbY < top - 1) return diag('almost');
    }
    readPhys();
    const v = Math.max(1, S.speed);
    const ev = classify(o, def, v, true);
    const last = jumpLog[jumpLog.length - 1];
    if (ev.cls === 'solo') return o.type === 'minute' ? diag('minute') : null;
    if (ev.cls === 'duck' || ev.cls === 'free') {
      if (snap.alt <= 0) return null;
      return last && last.n > 1 && S.t - last.t < 1.2 ? diag('double') : diag('duck');
    }
    let p = null;
    for (let i = jumpLog.length - 1; i >= 0; i--) {
      if (S.t - jumpLog[i].t > 1.2) break;
      if (jumpLog[i].n === 1) {
        p = jumpLog[i];
        break;
      }
    }
    if (!p) return snap.alt <= 0 ? diag('noJump') : null;
    const win = jumpWindow(o, def, v);
    if (!win) return null;
    const err = p.t < win.lo ? p.t - win.lo : p.t > win.hi ? p.t - win.hi : 0;
    if (Math.abs(err) < 0.02) return null;
    if (Math.abs(err) > 0.35) return snap.alt <= 0 ? diag('noJump') : null;
    return err < 0 ? diag('early', err, `Рано на ${fmtSec(-err)} с`) : diag('late', err, `Поздно на ${fmtSec(err)} с`);
  }

  // ---------- события ядра ----------
  G.on('start', () => {
    dir.queue.length = 0;
    dir.queue.push(...tutorial());
    dir.cursorD = 0;
    dir.rest = 0;
    dir.lastHaz = null;
    dir.lastAir = null;
    dir.phase = 'tutorial';
    dir.lastPattern = '';
    dir.lastNullT = 0;
    dir.retroUntil = 0;
    dir.eveningUntil = 0;
    dir.holdUntil = 0;
    dir.lastStairsT = -1e9;
    dir.snoozeDone = false;
    dir.pulseWave = -1;
    dir.pulseUntil = 0;
    pending.length = 0;
    speedWins.length = 0;
    speedK = 1;
    msIdx = 0;
    for (const k in preDone) delete preDone[k];
    for (const k in seen) delete seen[k];
    for (const k in shown) delete shown[k];
    for (const k in hurt) delete hurt[k];
    resetModes();
    jumpLog.length = 0;
    snap.o = null;
    rain.left = 0;
    combo.count = 0;
    combo.mult = 1;
  });

  G.on('spawn', (o) => {
    if (!o || o.deco || G.state.mode !== 'run') return;
    const key = keyOf(o);
    seen[o.type] = true;
    seen[key] = true;
    shown[key] = (shown[key] || 0) + 1;
    lifetime[key] = (Number(lifetime[key]) || 0) + 1;
    if (key !== o.type) {
      shown[o.type] = (shown[o.type] || 0) + 1;
      lifetime[o.type] = (Number(lifetime[o.type]) || 0) + 1;
    }
  });

  G.on('jump', (j) => {
    if (G.state.mode !== 'run') return;
    jumpLog.push({ t: G.state.t, n: (j && j.n) || 1, alt: G.bunny.alt });
    if (jumpLog.length > 6) jumpLog.shift();
  });

  G.on('pass', (o, info) => {
    if (!info || !info.near || G.state.mode !== 'run') return;
    const B = G.bunny;
    G.addBonus(NEAR_MIN, { label: 'ЕЛЕ-ЕЛЕ! +5 мин', kind: 'near', x: B.x + 14, alt: B.alt + 48 });
    bump();
  });

  G.on('pickup', () => bump());

  G.on('hit', (h) => {
    if (G.state.mode !== 'run' || !h) return;
    const B = G.bunny, hb = G.bunnyHitbox();
    snap.o = h.o;
    snap.v = B.v;
    snap.alt = B.alt;
    snap.hbX = hb.x;
    snap.hbY = hb.y;
    if (h.stomp) return;
    if (h.stumble) {
      if (h.o) hurt[keyOf(h.o)] = true;
      breakCombo('stumble');
      return;
    }
    if (G.flag('invincible')) return;
    const saved = !!h.cancel;
    if (saved && h.o) hurt[keyOf(h.o)] = true;
    breakCombo(saved ? 'shield' : 'hit', !saved);
  });

  G.on('stomp', () => bump());

  G.on('chase', (c) => {
    if (c && c.phase === 'caught' && G.state.mode === 'run') breakCombo('teamlead');
  });

  G.on('powerup', capScore);
  G.on('fever', capScore);

  G.on('smash', (o) => {
    if (G.state.mode !== 'run' || !o) return;
    const pu = G.powerups;
    if (!pu || typeof pu.isActive !== 'function' || !pu.isActive('friday')) return;
    G.addBonus(3, { kind: 'smash', x: o.x, alt: (o.fly || 0) + 30 });
    bump();
  });

  function noteRunLength(t) {
    if (t < HELP_SHORT_T) help.short++;
    else if (t > HELP_RESET_T) help.short = 0;
    help.on = help.short >= HELP_RUNS;
    tutT = help.on ? TUTORIAL_HELP_T : TUTORIAL_T;
  }

  G.on('die', (info) => {
    noteRunLength(G.state.t);
    combo.count = 0;
    combo.mult = 1;
    rain.left = 0;
    resetModes();
    if (info && typeof info === 'object') {
      try {
        info.diagnosis = diagnose(info.o);
      } catch (e) {
        info.diagnosis = null;
        G.report('balance diagnosis', e);
      }
    }
    G.store.setJSON(SEEN_KEY, lifetime);
  });

  G.onUpdate((dt) => {
    const S = G.state;
    if (S.mode !== 'run') return;
    const target = speedTarget(S.t);
    speedK += (target - speedK) * Math.min(1, dt * 2.5);
    G.setMod('speed', OWN, Math.abs(speedK - 1) < 1e-4 ? null : speedK);
    for (let i = speedWins.length - 1; i >= 0; i--) if (S.t > speedWins[i].to) speedWins.splice(i, 1);
    milestones();
    direct();
    updateRain(dt);
    checkMisses();
    capScore();
    G.setFlag('aiming', OWN, S.t < dir.pulseUntil || nextArrival() < AIM_T);
  }, 10);
})();
