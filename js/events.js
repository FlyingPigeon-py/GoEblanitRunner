/* События дня: флажок рекорда на диване и all-hands в 16:00. Владелец — геймплей B. */
(() => {
  'use strict';
  const G = window.G;
  const doc = document;
  const TAU = G.TAU;
  const PI = Math.PI;
  const clamp = G.clamp;
  const { rr, ellipse } = G.draw;

  const easeOut = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
  const pxK = () => (G.scale || 1) * (G.dpr || 1);
  let fontStamp = 0;
  let themeStamp = 0;

  const ktsAllhands = () => (G.kts && G.kts.enabled ? G.kts.get('npc', 'allhands') : null);
  function ktsText(key, fallback) {
    const ah = ktsAllhands();
    return (ah && typeof ah[key] === 'string' && G.kts.fmt(ah[key])) || fallback;
  }
  function ktsSubs() {
    const ah = ktsAllhands();
    const out = [];
    if (ah && Array.isArray(ah.subs)) for (const s of ah.subs) {
      const t = G.kts.fmt(s);
      if (t) out.push(t);
    }
    return out;
  }

  function makeCanvas(w, h) {
    const c = doc.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  function freeCanvas(c) {
    if (!c) return;
    c.width = 1;
    c.height = 1;
  }

  // ---------- флажок рекорда ----------
  const FLAG_LEAD = 3.5;
  const FLAG_MIN_T = 20;
  const FLAG_DX = 30;
  const FLAG_POLE = 44;
  const FLAG_LAYER = G.LAYER.PICKUPS - 2;
  const FLAG_ALPHA = 0.85;
  const FLAG_INK = '#2b1d0e';
  const flag = { bestT: 0, bestMin: 0, on: false, done: true, x: 0, sprite: null, key: '', w: 0, h: 0 };

  function bestClockMin() {
    const p = G.meta && G.meta.profile;
    const v = Number(p ? p.bestClock : 0);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }
  const flagLabel = () => 'РЕКОРД ' + G.fmtClock(G.cfg.startClockMin + Math.floor(flag.bestMin));

  function flagSprite() {
    const K = pxK();
    const label = flagLabel();
    const key = [K, label, themeStamp, fontStamp].join('|');
    if (flag.sprite && flag.key === key) return flag.sprite;
    const probe = makeCanvas(1, 1).getContext('2d');
    G.draw.font(probe, 700, 7, 'display');
    const tw = Math.max(30, (probe.measureText(label).width || label.length * 4) + 2);
    const pw = tw + 12, ph = 13;
    flag.w = pw + 8;
    flag.h = FLAG_POLE + 4;
    const c = flag.sprite && flag.sprite.width > 1 ? flag.sprite : makeCanvas(1, 1);
    c.width = Math.max(1, Math.ceil(flag.w * K));
    c.height = Math.max(1, Math.ceil(flag.h * K));
    const ctx = c.getContext('2d');
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.clearRect(0, 0, flag.w, flag.h);
    ctx.fillStyle = G.C['seat-lo'] || '#b3966b';
    ctx.globalAlpha = 0.5;
    ellipse(ctx, 3, FLAG_POLE + 1, 4.5, 1.6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = G.C.muted;
    ctx.fillRect(2.2, 4, 1.6, FLAG_POLE - 3);
    ctx.fillStyle = G.C.gold;
    ellipse(ctx, 3, 3.6, 2.2, 2.2);
    const x0 = 3.8, y0 = 5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + pw, y0);
    ctx.lineTo(x0 + pw - 5, y0 + ph / 2);
    ctx.lineTo(x0 + pw, y0 + ph);
    ctx.lineTo(x0, y0 + ph);
    ctx.closePath();
    ctx.fillStyle = G.C.gold;
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,29,14,0.45)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = FLAG_INK;
    G.draw.font(ctx, 700, 7, 'display');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x0 + 4, y0 + ph / 2 + 0.5);
    flag.sprite = c;
    flag.key = key;
    return c;
  }

  function flagStart() {
    flag.bestMin = bestClockMin();
    flag.bestT = flag.bestMin / G.cfg.minPerSec;
    flag.on = false;
    flag.done = flag.bestT < FLAG_MIN_T;
    flag.x = 0;
  }

  function flagPass() {
    flag.done = true;
    G.emit('recordFlag', { phase: 'pass', clock: G.fmtClock(G.cfg.startClockMin + Math.floor(flag.bestMin)) });
    if (G.fx && typeof G.fx.confetti === 'function') G.fx.confetti(G.calm ? 12 : 30);
  }

  function updateFlag() {
    const S = G.state;
    if (flag.done) {
      if (flag.on) {
        flag.x -= S.dx;
        if (flag.x < -80) flag.on = false;
      }
      return;
    }
    if (!flag.on && S.t >= flag.bestT - FLAG_LEAD) flag.on = true;
    if (!flag.on) return;
    flag.x = G.bunny.x + FLAG_DX + (flag.bestT - S.t) * S.speed;
    if (S.t >= flag.bestT) flagPass();
  }

  G.onRender(FLAG_LAYER, (ctx) => {
    if (!flag.on || flag.x > G.W + 80) return;
    const sp = flagSprite();
    const base = G.GROUND + 2;
    ctx.globalAlpha = FLAG_ALPHA;
    if (!G.calm) {
      ctx.translate(flag.x, base);
      ctx.rotate(Math.sin(G.state.idleT * 2.3) * 0.03);
      ctx.drawImage(sp, -3, -flag.h, flag.w, flag.h);
    } else {
      ctx.drawImage(sp, flag.x - 3, base - flag.h, flag.w, flag.h);
    }
  });

  // ---------- all-hands ----------
  const BOSS_ID = 'allhands';
  const BOSS_LEN = 20;
  const BOSS_HP = 3;
  const BOSS_MAX_BUTTONS = 5;
  const BOSS_EXTRA_LEFT = 5;
  const BOSS_EXTRA_GAP = 1.5;
  const BOSS_STALE = 5;
  const BOSS_GRACE = 3;
  const BOSS_WARN_HOLD = 2;
  const BOSS_RESERVE_TAIL = BOSS_LEN + BOSS_GRACE + 1;
  const BOSS_PATTERNS = ['stairsAir', 'corridor', 'combo', 'single'];
  const BOSS_MILESTONE = 420;
  const WIN_BONUS = 60;
  const APPEAR_SEC = 1.2;
  const LEAVE_SEC = 0.8;
  const WIN_TOP = 8;
  const WIN_ALT_FLOOR = 154;
  const WIN_ALPHA = 0.9;
  const TITLE_H = 10;
  const TOOL_H = 10;
  const SPEAK_SEC = 1.4;
  const TILES = 6;
  const DARK_ORDER = [5, 4, 3, 2, 1, 0];
  const TILE_PAL = [
    ['#4f5d7a', '#f2c9a0', '#2e3a55', '#3a2a20'],
    ['#6d4f6e', '#e0a98a', '#a34a5a', '#1f1a17'],
    ['#3f6b5e', '#c98d6a', '#e0b44c', '#5a3a22'],
    ['#7a5a3e', '#f5d3b5', '#3c6aa8', '#c9a15a'],
    ['#53566e', '#bdbab3', '#8a8780', '#8a8780'],
    ['#2f3440', '#c86b4a', '#c86b4a', '#c86b4a'],
  ];
  const LEAVE_RED = '#e5484d';
  const SPEAK_GREEN = '#4cd964';
  const SCREEN_BG = '#151a22';
  const TILE_OFF = '#262b34';
  const OFF_INK = '#8c93a0';

  const debugAt = /[?&]allhands=(\d+(?:\.\d+)?)/.exec((window.location && window.location.search) || '');
  let warnT = debugAt ? Math.max(1, Number(debugAt[1])) : 103;
  const startT = () => warnT + BOSS_WARN_HOLD;

  const boss = {
    phase: 'off', done: false, frozen: false, hp: 0, t0: 0, vis: 0, leaving: false,
    planned: 0, spawned: 0, lastExtraT: 0, lastSpawnT: 0, tileSeq: 0,
    lit: new Array(TILES).fill(true), speaking: 0, speakT: 0,
    sprite: null, key: '', rect: { x: 0, y: 0, w: 0, h: 0 }, tiles: [], screenH: 0,
    leaveSprites: Object.create(null),
    subs: [], subIdx: 0, subT: 0, subSprites: Object.create(null), subKey: { k: 0, w: 0, font: -1 },
  };
  const active = () => boss.phase === 'warn' || boss.phase === 'live';

  const DIR_API = ['inject', 'clear', 'hold', 'enter', 'exit', 'suppress'];
  function director() {
    const d = G.director;
    if (!d) return null;
    for (const k of DIR_API) if (typeof d[k] !== 'function') return null;
    return d;
  }
  const enabled = () => !!director() && !!G.obstacleTypes.call;

  function arm() {
    const d = director();
    if (!d || !G.obstacleTypes.call) return;
    d.suppress(BOSS_MILESTONE);
    if (typeof d.reserve !== 'function') return;
    if (typeof d.busy === 'function' && d.busy(warnT, warnT + 1) === BOSS_ID) return;
    d.reserve(warnT, warnT + BOSS_RESERVE_TAIL + BOSS_WARN_HOLD, BOSS_ID);
  }

  function emitBoss(phase) {
    G.emit('boss', { id: BOSS_ID, phase, hp: boss.hp });
  }

  function nextLitTile() {
    for (let n = 0; n < TILES; n++) {
      const k = boss.tileSeq++ % TILES;
      if (boss.lit[k]) return k;
    }
    return boss.tileSeq % TILES;
  }
  function assignTile(o, k) {
    if (!o) return;
    o.bossTile = k == null ? nextLitTile() : k;
    boss.speaking = o.bossTile;
    boss.speakT = 0;
  }

  function scenario() {
    const call = (level, extra) => Object.assign({ ob: 'call', kind: 'air', opts: { level }, onPlace: (o) => assignTile(o) }, extra);
    const ground = (extra) => Object.assign({ kind: 'ground' }, extra);
    const leaveArc = () => ({ free: true, double: true, apexId: 'leave' });
    boss.planned += 3;
    return [
      call(0), call(1, { under: true, underId: 'leave' }), call(0),
      { rest: 0.6 },
      ground(), call(1, { under: true }), call(1), ground(),
      { rest: 0.4 }, leaveArc(), { rest: 0.5 },
      ground(), call(0, { tight: true }),
      { rest: 0.6 }, leaveArc(),
      ground(), call(1, { under: true }), ground(),
    ];
  }

  function resetBoss() {
    boss.phase = 'off';
    boss.done = false;
    boss.frozen = false;
    boss.hp = 0;
    boss.vis = 0;
    boss.leaving = false;
    boss.planned = 0;
    boss.spawned = 0;
    boss.lastExtraT = 0;
    boss.lastSpawnT = 0;
    boss.tileSeq = 0;
    boss.speaking = 0;
    boss.speakT = 0;
    boss.lit.fill(true);
    boss.key = '';
    freeCanvas(boss.sprite);
    boss.subs = ktsSubs();
    boss.subIdx = boss.subs.length ? Math.floor(Math.random() * boss.subs.length) : 0;
    boss.subT = 0;
  }

  function warn() {
    const d = director();
    if (!d) return;
    resetBoss();
    boss.phase = 'warn';
    boss.hp = BOSS_HP;
    d.clear();
    d.hold(BOSS_WARN_HOLD);
    d.enter('boss', { patterns: BOSS_PATTERNS.slice() });
    emitBoss('warn');
  }

  function begin() {
    const d = director();
    boss.phase = 'live';
    boss.t0 = G.state.t;
    boss.lastSpawnT = boss.t0;
    emitBoss('start');
    if (d) d.inject(scenario());
  }

  function liveButtonsAhead() {
    let n = 0;
    for (const p of G.pickups) if (p.type === 'leave' && !p.taken && !p.remove && p.x > G.bunny.x) n++;
    return n;
  }
  function clearButtons() {
    const fx = G.fx;
    for (const p of G.pickups) {
      if (p.type !== 'leave' || p.taken) continue;
      p.remove = true;
      if (fx && typeof fx.burst === 'function' && p.x > -20 && p.x < G.W + 20) fx.burst(p.x, p.alt, { n: 6, speed: 90, color: LEAVE_RED, life: 0.35 });
    }
  }

  function finish(won) {
    const d = director();
    boss.phase = 'gone';
    boss.done = true;
    boss.leaving = true;
    clearButtons();
    if (!d) return;
    if (won) {
      d.clear();
      d.inject([{ rest: 0.3 }, { free: true }, { free: true }]);
    }
    d.exit('boss');
  }

  function win() {
    const B = G.bunny;
    G.addBonus(WIN_BONUS, { label: ktsText('win', 'ВСЕМ СПАСИБО, ВСЕ СВОБОДНЫ'), kind: 'boss', x: B.x + 40, alt: B.alt + 90 });
    if (G.fx && typeof G.fx.confetti === 'function') G.fx.confetti(G.calm ? 16 : 40);
    emitBoss('win');
    finish(true);
  }

  function fail() {
    emitBoss('fail');
    finish(false);
  }

  function onLeave(p) {
    if (boss.phase !== 'live' || boss.hp <= 0) return;
    boss.hp -= 1;
    const hit = BOSS_HP - boss.hp;
    const per = Math.ceil(TILES / BOSS_HP);
    for (let k = (hit - 1) * per; k < hit * per && k < TILES; k++) boss.lit[DARK_ORDER[k]] = false;
    boss.key = '';
    const fx = G.fx;
    if (fx) {
      if (!G.calm && typeof fx.shake === 'function') fx.shake(3);
      if (typeof fx.popup === 'function') fx.popup(p.x, p.alt + 18, 'ЛИВНУЛ', { color: LEAVE_RED, size: 16 });
    }
    emitBoss('hit');
    if (boss.hp <= 0) win();
  }

  function topUp() {
    const S = G.state;
    const d = director();
    if (!d || boss.planned >= BOSS_MAX_BUTTONS) return;
    const left = boss.t0 + BOSS_LEN - S.t;
    if (left <= BOSS_EXTRA_LEFT || S.t - boss.lastExtraT < BOSS_EXTRA_GAP) return;
    const ahead = liveButtonsAhead();
    const stale = S.t - Math.max(boss.lastSpawnT, boss.lastExtraT) > BOSS_STALE;
    const pending = stale ? 0 : Math.max(0, boss.planned - boss.spawned);
    if (ahead + pending >= boss.hp) return;
    boss.planned++;
    boss.lastExtraT = S.t;
    d.inject([{ rest: 0.3 }, { free: true, double: true, apexId: 'leave' }]);
  }

  function updateBoss(dt) {
    const S = G.state;
    if (boss.phase === 'off') {
      if (!boss.done && S.t >= warnT && S.t < warnT + 3 && enabled()) warn();
    } else if (boss.phase === 'warn') {
      if (S.t >= startT()) begin();
    } else if (boss.phase === 'live') {
      const over = S.t - (boss.t0 + BOSS_LEN);
      if (over >= BOSS_GRACE || (over >= 0 && !liveButtonsAhead())) fail();
      else if (over < 0) topUp();
    }
    if (boss.leaving) {
      boss.vis = Math.max(0, boss.vis - dt / LEAVE_SEC);
      if (boss.vis <= 0) {
        boss.leaving = false;
        freeCanvas(boss.sprite);
        boss.key = '';
      }
    } else if (active()) {
      boss.vis = Math.min(1, boss.vis + dt / APPEAR_SEC);
    }
    if (active() && boss.subs.length) {
      boss.subT += dt;
      const ah = ktsAllhands();
      if (boss.subT >= ((ah && ah.subT) || 2.6)) {
        boss.subT = 0;
        boss.subIdx = (boss.subIdx + 1) % boss.subs.length;
      }
    }
    if (active()) {
      boss.speakT += dt;
      if (boss.speakT > SPEAK_SEC || !boss.lit[boss.speaking]) {
        boss.speakT = 0;
        for (let n = 1; n <= TILES; n++) {
          const k = (boss.speaking + n) % TILES;
          if (boss.lit[k]) {
            boss.speaking = k;
            break;
          }
        }
      }
    }
  }

  // ---------- окно звонка ----------
  function layoutWindow() {
    const h = clamp(G.GROUND - WIN_ALT_FLOOR - WIN_TOP, 60, 130);
    const w = Math.min(G.W * 0.6, h * 1.72);
    const R = boss.rect;
    R.w = w;
    R.h = h;
    R.x = G.W * 0.62 - w / 2;
    R.y = WIN_TOP;
    const pad = 3, gap = 2;
    const cx = pad + 2, cy = TITLE_H + 2;
    const cw = w - 2 * pad - 4, ch = h - TITLE_H - TOOL_H - 4;
    boss.screenH = ch + 4;
    const tw = (cw - 2 * gap) / 3, th = (ch - gap) / 2;
    boss.tiles.length = 0;
    for (let k = 0; k < TILES; k++) {
      boss.tiles.push({ x: cx + (k % 3) * (tw + gap), y: cy + Math.floor(k / 3) * (th + gap), w: tw, h: th });
    }
    return { pad, cw, ch, cx, cy };
  }

  function drawTile(ctx, t, k, lit) {
    if (!lit) {
      ctx.fillStyle = TILE_OFF;
      rr(ctx, t.x, t.y, t.w, t.h, 2);
      ctx.fill();
      const mx = t.x + t.w / 2, my = t.y + t.h / 2 - 2;
      ctx.strokeStyle = OFF_INK;
      ctx.lineWidth = 0.9;
      rr(ctx, mx - 5, my - 3, 7, 6, 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx + 2, my - 1);
      ctx.lineTo(mx + 5, my - 2.6);
      ctx.lineTo(mx + 5, my + 2.6);
      ctx.lineTo(mx + 2, my + 1);
      ctx.moveTo(mx - 6, my - 4.5);
      ctx.lineTo(mx + 6, my + 4.5);
      ctx.stroke();
      ctx.fillStyle = OFF_INK;
      G.draw.font(ctx, 600, 4.6, 'body');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('вышел', mx, t.y + t.h - 4);
      return;
    }
    const pal = TILE_PAL[k % TILE_PAL.length];
    const cx = t.x + t.w / 2;
    const s = Math.min(t.w / 22, t.h / 15);
    ctx.fillStyle = pal[0];
    rr(ctx, t.x, t.y, t.w, t.h, 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(t.x, t.y, t.w, t.h);
    ctx.clip();
    ctx.fillStyle = pal[2];
    ctx.beginPath();
    ctx.ellipse(cx, t.y + t.h, 7.5 * s, 5.2 * s, 0, PI, TAU);
    ctx.fill();
    ctx.fillStyle = pal[1];
    ellipse(ctx, cx, t.y + t.h - 7.6 * s, 3.4 * s, 3.7 * s);
    ctx.fillStyle = pal[3];
    ctx.beginPath();
    ctx.arc(cx, t.y + t.h - 8.4 * s, 3.5 * s, PI, TAU);
    ctx.fill();
    ctx.restore();
  }

  function windowSprite() {
    const K = pxK();
    const lit = boss.lit.map((b) => (b ? 1 : 0)).join('');
    const key = [K, G.W, G.GROUND, lit, boss.hp, themeStamp, fontStamp].join('|');
    if (boss.sprite && boss.sprite.width > 1 && boss.key === key) return boss.sprite;
    const L = layoutWindow();
    const R = boss.rect;
    const dark = G.isDark();
    const c = boss.sprite || makeCanvas(1, 1);
    c.width = Math.max(1, Math.ceil((R.w + 4) * K));
    c.height = Math.max(1, Math.ceil((R.h + 4) * K));
    const ctx = c.getContext('2d');
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.clearRect(0, 0, R.w + 4, R.h + 4);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    rr(ctx, 2, 3, R.w, R.h, 6);
    ctx.fill();
    ctx.fillStyle = dark ? '#3a404c' : '#e9edf2';
    rr(ctx, 0, 0, R.w, R.h, 6);
    ctx.fill();
    ctx.strokeStyle = dark ? 'rgba(255,240,220,0.3)' : 'rgba(40,26,14,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const dots = ['#ff5f57', '#febc2e', '#28c840'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = dots[i];
      ellipse(ctx, 6 + i * 4.4, TITLE_H / 2 + 0.5, 1.5, 1.5);
    }
    ctx.fillStyle = dark ? '#d8dde6' : '#3b4250';
    G.draw.font(ctx, 700, 6, 'display');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(ktsText('title', 'ALL-HANDS · 16:00 · 248 УЧАСТНИКОВ'), 20, TITLE_H / 2 + 0.7, R.w - 26);
    ctx.fillStyle = SCREEN_BG;
    rr(ctx, L.pad, TITLE_H, R.w - 2 * L.pad, L.ch + 4, 3);
    ctx.fill();
    for (let k = 0; k < TILES; k++) drawTile(ctx, boss.tiles[k], k, boss.lit[k]);
    const host = boss.tiles[0];
    if (boss.lit[0]) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      rr(ctx, host.x + 1.5, host.y + 1.5, 15, 6, 2);
      ctx.fill();
      ctx.fillStyle = '#ffd9d4';
      G.draw.font(ctx, 700, 4.6, 'display');
      ctx.fillText('REC', host.x + 7, host.y + 4.8);
    }
    const ty = R.h - TOOL_H / 2 - 0.5;
    ctx.fillStyle = dark ? '#4a5160' : '#cfd5de';
    ellipse(ctx, R.w / 2 - 22, ty, 3, 3);
    ellipse(ctx, R.w / 2 - 14, ty, 3, 3);
    for (let i = 0; i < BOSS_HP; i++) {
      ctx.fillStyle = i < boss.hp ? LEAVE_RED : dark ? '#4a5160' : '#cfd5de';
      rr(ctx, R.w / 2 - 6 + i * 11, ty - 2.6, 9, 5.2, 2.6);
      ctx.fill();
    }
    boss.sprite = c;
    boss.key = key;
    return c;
  }

  const SUB_SIZE = 5.6;
  function subSprite(text) {
    const K = pxK();
    const R = boss.rect;
    const sk = boss.subKey;
    if (sk.k !== K || sk.w !== R.w || sk.font !== fontStamp) {
      boss.subSprites = Object.create(null);
      sk.k = K;
      sk.w = R.w;
      sk.font = fontStamp;
    }
    let s = boss.subSprites[text];
    if (s) return s;
    const probe = makeCanvas(1, 1).getContext('2d');
    G.draw.font(probe, 600, SUB_SIZE, 'body');
    const w = Math.max(16, Math.min(R.w - 14, (probe.measureText(text).width || text.length * 3) + 6));
    const h = SUB_SIZE + 4;
    const c = makeCanvas(w * K, h * K);
    const ctx = c.getContext('2d');
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    rr(ctx, 0, 0, w, h, 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    G.draw.font(ctx, 600, SUB_SIZE, 'body');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 0.3, w - 4);
    s = { c, w, h };
    boss.subSprites[text] = s;
    return s;
  }

  function windowY() {
    const k = easeOut(clamp(boss.vis, 0, 1));
    return G.calm ? WIN_TOP : WIN_TOP - (boss.rect.h + WIN_TOP + 8) * (1 - k);
  }

  G.onRender(G.LAYER.BACK, (ctx) => {
    if (boss.vis <= 0 || !(active() || boss.leaving || boss.frozen)) return;
    const sp = windowSprite();
    const R = boss.rect;
    const x = R.x, y = windowY();
    const a = WIN_ALPHA * (G.calm ? boss.vis : 1);
    ctx.globalAlpha = a;
    ctx.drawImage(sp, x, y, R.w + 4, R.h + 4);
    if (!active()) return;
    const sub = boss.subs.length ? subSprite(boss.subs[boss.subIdx]) : null;
    if (sub) ctx.drawImage(sub.c, x + R.w / 2 - sub.w / 2, y + TITLE_H + boss.screenH - sub.h - 1.5, sub.w, sub.h);
    const t = boss.tiles[boss.speaking];
    if (t && boss.lit[boss.speaking]) {
      ctx.strokeStyle = SPEAK_GREEN;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + t.x + 0.6, y + t.y + 0.6, t.w - 1.2, t.h - 1.2);
    }
    const host = boss.tiles[0];
    if (host && boss.lit[0] && (G.calm || Math.sin(G.state.idleT * TAU * 1.5) > -0.2)) {
      ctx.fillStyle = '#ff3b30';
      ellipse(ctx, x + host.x + 4.2, y + host.y + 4.5, 1.6, 1.6);
    }
    if (boss.phase !== 'live') return;
    ctx.beginPath();
    let lines = 0;
    for (const o of G.obstacles) {
      if (o.bossTile == null || o.dead || o.ballistic || o.passed) continue;
      const hw = (o.w || 88) / 2;
      if (o.x - hw > G.W || o.x + hw < 0) continue;
      const tile = boss.tiles[o.bossTile];
      if (!tile) continue;
      ctx.moveTo(x + tile.x + tile.w / 2, y + tile.y + tile.h);
      ctx.lineTo(o.x, G.GROUND - (o.fly || 0) - (o.alt || 0) - (o.h || 40) / 2);
      lines++;
    }
    if (!lines) return;
    ctx.globalAlpha = a * 0.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = G.C.muted;
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // ---------- кнопка «Покинуть встречу» ----------
  const LEAVE_R = 13;
  const LEAVE_GLOW = '229,72,77';
  // p.leaveColor ставят слушатели spawnPickup (утиная кнопка У13), сама кнопка работает как обычная.
  function leaveSprite(color) {
    const K = pxK();
    const col = color || LEAVE_RED;
    const key = K + '|' + themeStamp;
    const cached = boss.leaveSprites[col];
    if (cached && cached.key === key) return cached.c;
    const S = 36;
    const c = cached ? cached.c : makeCanvas(1, 1);
    c.width = Math.max(1, Math.ceil(S * K));
    c.height = Math.max(1, Math.ceil(S * K));
    const ctx = c.getContext('2d');
    ctx.setTransform(K, 0, 0, K, S / 2 * K, S / 2 * K);
    ctx.clearRect(-S / 2, -S / 2, S, S);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(ctx, -13, -7.5, 26, 17, 8.5);
    ctx.fill();
    ctx.fillStyle = col;
    rr(ctx, -13, -9, 26, 17, 8.5);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 4.2, 8, PI * 1.22, PI * 1.78);
    ctx.stroke();
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-6.3, -0.2);
    ctx.lineTo(-6.8, 2.6);
    ctx.moveTo(6.3, -0.2);
    ctx.lineTo(6.8, 2.6);
    ctx.stroke();
    boss.leaveSprites[col] = { c, key };
    return c;
  }
  function rgbOf(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return LEAVE_GLOW;
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  function drawLeave(ctx, p) {
    const bob = G.calm ? 0 : Math.sin(p.ph) * 2;
    const y = G.GROUND - p.alt + bob;
    const col = typeof p.leaveColor === 'string' ? p.leaveColor : null;
    if (!G.calm) {
      const k = (G.state.idleT * 1.6 + p.seed) % 1;
      ctx.globalAlpha = 0.55 * (1 - k);
      ctx.strokeStyle = col || LEAVE_RED;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, y, LEAVE_R + 2 + k * 9, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(leaveSprite(col), p.x - 18, y - 18, 36, 36);
    if (G.look && typeof G.look.glow === 'function') G.look.glow(p.x, p.alt, 26, col ? (p.leaveGlow || (p.leaveGlow = rgbOf(col))) : LEAVE_GLOW, 0.5);
  }

  G.registerPickup({
    id: 'leave',
    name: 'Покинуть встречу',
    power: false,
    color: LEAVE_RED,
    minT: 0,
    weight: () => 0,
    radius: LEAVE_R,
    make(p) {
      p.ph = Math.random() * TAU;
      if (!active()) p.remove = true;
    },
    update(p, dt) {
      p.ph += dt * 4;
    },
    draw: drawLeave,
    collect: onLeave,
  });

  // ---------- события ----------
  G.on('start', () => {
    flagStart();
    resetBoss();
    arm();
  });
  G.on('spawn', (o) => {
    if (o && o.type === 'call' && active() && o.bossTile == null) assignTile(o);
  });
  G.on('spawnPickup', (p) => {
    if (!p || p.type !== 'leave') return;
    if (!active()) {
      p.remove = true;
      return;
    }
    boss.spawned++;
    boss.lastSpawnT = G.state.t;
  });
  G.on('die', (info) => {
    if (!active()) return;
    if (info && !info.causeTag) {
      info.cause = ktsText('cause', 'Застрял на all-hands. Навсегда.');
      info.causeTag = BOSS_ID;
    }
    boss.phase = 'gone';
    boss.done = true;
    boss.frozen = true;
    const d = director();
    if (d) d.exit('boss');
  });
  G.on('resize', () => {
    boss.key = '';
    flag.key = '';
  });
  G.on('theme', () => {
    themeStamp++;
  });
  G.on('fonts', () => {
    fontStamp++;
  });

  G.onUpdate((dt) => {
    if (G.state.mode !== 'run') return;
    updateFlag();
    updateBoss(dt);
  }, 9);

  G.allhands = {
    enabled,
    active,
    phase: () => boss.phase,
    hp: () => boss.hp,
    left: () => (boss.phase === 'live' ? Math.max(0, boss.t0 + BOSS_LEN - G.state.t) : 0),
    _at(t) {
      warnT = Math.max(1, Number(t) || 1);
    },
  };
})();
