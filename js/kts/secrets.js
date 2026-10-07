/* Секретки KTS, квест плова, кнопка «Сделать хорошо», Котзилла и общий набор П6 (G.kts.eggs). Владелец — П6. */
(() => {
  'use strict';
  const G = window.G;
  const K = G.kts;
  if (!K || !K.enabled) return;
  const TAU = Math.PI * 2;
  const doc = document;
  const { rr, ellipse } = G.draw;
  const clamp = G.clamp;

  const eggs = (id) => K.get('eggs', id) || {};
  const sec = (id) => K.get('secrets', id);
  const running = () => G.state.mode === 'run';

  // ---------- тосты и тексты ----------
  function say(label, text, dur) {
    if (!label || !G.ui || typeof G.ui.toast !== 'function') return;
    const ui = eggs('ui');
    G.ui.toast(String(label), text == null ? null : String(text), { kind: ui.toastKind || 'info', duration: dur || ui.toastSec || 4 });
  }
  function firstLine(pool, ctx) {
    const list = Array.isArray(pool) ? pool : [pool];
    for (const s of list) {
      const v = K.fmt(s, ctx);
      if (v) return v;
    }
    return null;
  }
  const whereOf = (loc) => (eggs('where') || {})[loc] || '';

  // ---------- где мы ----------
  const fallbackLoc = { id: 'living', variant: 'morning', since: 0 };
  function routeAt(gm) {
    const r = eggs('route');
    if (!r.gm || !r.id) return { idx: 0, key: 'living:morning', next: Infinity };
    const day = Math.floor(gm / 1440), m = gm - day * 1440;
    let idx = 0;
    for (let i = 0; i < r.gm.length; i++) if (m >= r.gm[i]) idx = i;
    const next = idx + 1 < r.gm.length ? r.gm[idx + 1] : 1440 + r.gm[1];
    return { idx, key: r.id[idx], start: day * 1440 + r.gm[idx], next: day * 1440 + next };
  }
  const gmNow = () => G.state.t * (G.cfg.minPerSec || 4);
  function loc() {
    const L = G.scene && G.scene.loc;
    if (L && typeof L.id === 'string') return L;
    const r = routeAt(gmNow());
    const c = r.key.indexOf(':');
    fallbackLoc.id = c < 0 ? r.key : r.key.slice(0, c);
    fallbackLoc.variant = c < 0 ? '' : r.key.slice(c + 1);
    fallbackLoc.since = r.start / (G.cfg.minPerSec || 4);
    return fallbackLoc;
  }
  function inLoc(list) {
    if (!list || !list.length) return true;
    const L = loc();
    for (const k of list) {
      const c = k.indexOf(':');
      if (c < 0 ? k === L.id : k.slice(0, c) === L.id && k.slice(c + 1) === L.variant) return true;
    }
    return false;
  }
  function locAge() {
    const since = Number(loc().since);
    return Number.isFinite(since) ? G.state.t - since : Infinity;
  }
  function locLeft() {
    const n = G.scene && G.scene.next;
    if (n && Number.isFinite(n.inSec)) return n.inSec;
    if (G.scene && G.scene.loc) return Infinity;
    return (routeAt(gmNow()).next - gmNow()) / (G.cfg.minPerSec || 4);
  }

  // ---------- что сейчас происходит в забеге ----------
  const live = { chase: false, boss: false, fever: false };
  G.on('chase', (e) => {
    const ph = e && e.phase;
    live.chase = ph === 'warn' || ph === 'start' || ph === 'caught';
  });
  G.on('boss', (e) => {
    const ph = e && e.phase;
    live.boss = ph === 'warn' || ph === 'start';
  });
  G.on('fever', () => { live.fever = true; });
  G.on('feverEnd', () => { live.fever = false; });

  // ---------- постановка через режиссёра ----------
  const director = () => (G.director && typeof G.director.inject === 'function' ? G.director : null);
  function quiet(ahead) {
    const S = G.state, d = director();
    if (!d || S.mode !== 'run' || live.chase || live.boss || live.fever) return false;
    if (typeof d.modes === 'function') {
      const m = d.modes();
      if (m && m.length) return false;
    }
    return !(typeof d.busy === 'function' && d.busy(S.t, S.t + (ahead || 5)));
  }
  const pend = Object.create(null);
  let lastPlaceT = -99;
  // Подбираемое ставит режиссёр: на вершину честной дуги морковок или под высокий созвон. Тип пикапа узнаёт своё место из pend.
  function place(type, spot, opts) {
    const d = director();
    if (!d) return false;
    const o = opts || {};
    const step = o.under
      ? { ob: 'call', kind: 'air', opts: { level: 1 }, under: true, underId: type }
      : { free: true, double: !!o.double, apexId: type };
    d.inject([step]);
    pend[type] = { spot, until: G.state.t + 8 };
    lastPlaceT = G.state.t;
    return true;
  }
  const pending = (type) => !!(pend[type] && G.state.t <= pend[type].until);
  function takePending(type) {
    const q = pend[type];
    pend[type] = null;
    return q && G.state.t <= q.until ? q.spot : null;
  }
  // От вершины одиночной дуги до точки приземления: туда встают кнопка и казан.
  function landDx() {
    const d = G.director;
    const v = d && typeof d.speed === 'function' ? d.speed() : G.state.speed;
    const P = d && typeof d.phys === 'function' ? d.phys() : null;
    const T = P && P.T > 0 ? P.T : (2 * G.cfg.jumpV) / G.cfg.gravity;
    return (Number.isFinite(v) && v > 0 ? v : G.state.speed) * T / 2;
  }
  G.on('start', () => {
    for (const k in pend) pend[k] = null;
    lastPlaceT = -99;
    live.chase = live.boss = live.fever = false;
  });

  // ---------- спрайты ----------
  const sprites = new Map();
  const pxK = () => clamp((G.scale || 1) * (G.dpr || 1), 0.5, 4);
  function sprite(key, w, h, ox, oy, paint) {
    let s = sprites.get(key);
    if (s) return s;
    const k = pxK();
    const c = doc.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * k));
    c.height = Math.max(1, Math.ceil(h * k));
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.translate(ox, oy);
      paint(ctx);
    }
    s = { c, w, h, ox, oy };
    sprites.set(key, s);
    return s;
  }
  function blit(ctx, s, x, y, sc) {
    const k = sc || 1;
    ctx.drawImage(s.c, x - s.ox * k, y - s.oy * k, s.w * k, s.h * k);
  }
  function flushSprites() {
    for (const s of sprites.values()) {
      s.c.width = 1;
      s.c.height = 1;
    }
    sprites.clear();
  }
  G.on('resize', flushSprites);
  G.on('theme', flushSprites);
  G.on('fonts', flushSprites);

  function text(ctx, str, x, y, size, color, weight) {
    G.draw.font(ctx, weight || 700, size, 'display');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }
  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, TAU);
    ctx.fill();
  }

  // ---------- реквизит у подбираемого ----------
  // Реквизит приглушён и висит на заднем плане; «передняя» часть (край кастрюли, монитор) рисуется поверх уточки.
  const props = [];
  const PROP_PAINT = Object.create(null);
  function addProp(kind, p) {
    if (!PROP_PAINT[kind]) return null;
    const pr = { kind, p, x: p ? p.x : 0, alt: p ? p.alt : 0 };
    props.push(pr);
    return pr;
  }
  function addDecor(kind, x, alt) {
    const pr = addProp(kind, null);
    if (pr) {
      pr.x = x;
      pr.alt = alt;
    }
    return pr;
  }
  G.onUpdate(() => {
    if (!props.length) return;
    const dx = G.state.dx;
    for (let i = props.length - 1; i >= 0; i--) {
      const pr = props[i];
      if (pr.p && !pr.p.taken && !pr.p.remove && G.pickups.indexOf(pr.p) >= 0) {
        pr.x = pr.p.x;
        pr.alt = pr.p.alt;
      } else {
        pr.p = null;
        pr.x -= dx;
      }
      if (pr.x < -160) props.splice(i, 1);
    }
  }, 31);
  G.on('start', () => { props.length = 0; });
  function drawProps(ctx, front) {
    if (!props.length) return;
    const W = G.W;
    for (const pr of props) {
      if (pr.x < -120 || pr.x > W + 120) continue;
      const P = PROP_PAINT[pr.kind];
      const part = front ? P.front : P.back;
      if (!part) continue;
      const y = G.GROUND - pr.alt;
      if (!front && P.cord) cord(ctx, pr.x, y + P.cord);
      if (!front && P.poles) for (const px of P.poles) cord(ctx, pr.x + px, y + P.polesY);
      ctx.globalAlpha = P.alpha || 0.9;
      blit(ctx, sprite('prop:' + pr.kind + (front ? ':f' : ':b'), P.w, P.h, P.ox, P.oy, part), pr.x, y);
      ctx.globalAlpha = 1;
    }
  }
  function cord(ctx, x, yEnd) {
    ctx.strokeStyle = G.C.muted;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, -30);
    ctx.lineTo(x, yEnd);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  G.onRender(G.LAYER.BACK + 0.6, (ctx) => drawProps(ctx, false));
  G.onRender(G.LAYER.PICKUPS + 0.6, (ctx) => drawProps(ctx, true));

  // ---------- DOM-хотспоты поверх сцены ----------
  let layerEl = null;
  function layer() {
    if (layerEl) return layerEl;
    if (!G.stage || typeof doc.createElement !== 'function') return null;
    const el = doc.createElement('div');
    el.className = 'kts-eggs';
    Object.assign(el.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '3', overflow: 'hidden' });
    G.stage.appendChild(el);
    layerEl = el;
    return el;
  }
  function hotspot(label, onTap) {
    const host = layer();
    if (!host) return null;
    const b = doc.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.setAttribute('data-noinput', '');
    Object.assign(b.style, {
      position: 'absolute', left: '0', top: '0', width: '40px', height: '40px', margin: '0', padding: '0',
      border: '0', borderRadius: '45%', background: 'transparent', cursor: 'pointer', pointerEvents: 'auto',
      transform: 'translate(-50%, -50%)', display: 'none', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
    });
    b.addEventListener('click', (e) => {
      if (e && e.preventDefault) e.preventDefault();
      onTap();
    });
    host.appendChild(b);
    return { el: b, x: NaN, y: NaN, w: 0, h: 0, shown: false };
  }
  // Раскрытая доска спринта лежит под слоем хотспотов: пока она открыта, хотспоты не перехватывают её тапы.
  function startUiOpen() {
    const sb = doc.getElementById && doc.getElementById('sprintBoard');
    return !!(sb && !sb.hidden);
  }
  function showHotspot(h, show, x, alt, w, hh) {
    if (!h) return;
    if (!show || startUiOpen()) {
      if (h.shown) {
        h.el.style.display = 'none';
        h.shown = false;
      }
      return;
    }
    const s = G.scale || 1;
    const p = typeof G.worldToDom === 'function' ? G.worldToDom(x, alt) : { x: x * s, y: (G.GROUND - alt) * s };
    const px = Math.round(p.x), py = Math.round(p.y);
    const pw = Math.max(36, Math.round(w * s)), ph = Math.max(36, Math.round(hh * s));
    if (!h.shown) {
      h.el.style.display = 'block';
      h.shown = true;
    }
    if (px !== h.x || py !== h.y) {
      h.el.style.left = px + 'px';
      h.el.style.top = py + 'px';
      h.x = px;
      h.y = py;
    }
    if (pw !== h.w || ph !== h.h) {
      h.el.style.width = pw + 'px';
      h.el.style.height = ph + 'px';
      h.w = pw;
      h.h = ph;
    }
  }

  const E = (K.eggs = {
    say, firstLine, whereOf, loc, inLoc, locAge, locLeft, live, quiet, place, pending, takePending, landDx,
    sprite, blit, text, circle, addProp, addDecor, PROP_PAINT, hotspot, showHotspot, lastPlaceT: () => lastPlaceT,
  });

  // ---------- плов ----------
  function plovLoc() {
    const d = sec('plov');
    if (!d || !Array.isArray(d.loc) || !d.loc.length) return null;
    const r = K.dayRng('plov');
    return d.loc[Math.floor(r() * d.loc.length) % d.loc.length];
  }
  E.plovLoc = plovLoc;
  const plov = { clue: false, kazan: false, ready: false };
  function plovHint() {
    const d = sec('plov');
    if (!d) return;
    const where = whereOf(plovLoc());
    let t;
    if (K.has('secret', 'plov')) t = d.hintDone;
    else if (K.counter('plov') >= (d.clues || 5)) t = K.fmt(d.hintKazan, { where });
    else t = K.fmt(d.hint, { where });
    say(d.hintLabel || 'Плов', t);
  }
  function plovTick() {
    const d = sec('plov');
    if (!d || K.has('secret', 'plov')) return;
    const where = plovLoc();
    if (!where || loc().id !== where) return;
    const done = K.counter('plov') >= (d.clues || 5);
    if (done && (plov.kazan || !plov.ready)) return;
    if (!done && (plov.clue || K.store.get('plovDay', '') === K.today.iso)) return;
    const type = done ? 'kazan' : 'plovClue';
    if (pending(type)) return;
    place(type, type);
  }

  // ---------- кнопка «Сделать хорошо» ----------
  const gb = { armed: false, spawned: false, p: null, major: 0 };
  function majorEnd() {
    if (!gb.major) return;
    gb.major = 0;
    G.emit('kts:event', { id: 'goodButton', phase: 'end' });
  }
  function buttonTick() {
    const d = sec('goodButton');
    if (!d || !gb.armed || gb.spawned || pending('goodButton') || !inLoc(d.loc)) return;
    place('goodButton', 'goodButton');
  }
  function obstacleAlt(o) {
    const def = G.obstacleTypes[o.type];
    if (def && def.kind === 'air') return (o.fly || 60) + (o.alt || 0);
    return (o.alt || 0) + Math.min(40, (o.h || o.r * 2 || 30) / 2 + 8);
  }
  function pressButton(p) {
    const d = sec('goodButton') || {};
    gb.p = null;
    addDecor('buttonPressed', p.x, 0);
    const fx = G.fx;
    for (const o of G.obstacles) {
      if (o.deco || o.dead || o.ballistic || o.remove || o.hero || o.x < -30 || o.x > G.W + 30) continue;
      const alt = clamp(obstacleAlt(o), 24, 170);
      o.remove = true;
      G.spawnPickup('carrot', o.x, alt);
      if (fx && fx.burst) fx.burst(o.x, alt, { n: 8, speed: 110, color: '#3ddc84', life: 0.4, size: 2.6 });
    }
    if (fx && typeof fx.stamp === 'function') fx.stamp(d.stamp || 'СДЕЛАНО ХОРОШО', { x: p.x, alt: 70, color: '#1f8f4e', rot: -0.06 });
    else if (fx && fx.popup) fx.popup(p.x, 70, d.stamp || 'СДЕЛАНО ХОРОШО', { size: 16, life: 1.2, color: '#1f8f4e' });
    if (fx && fx.ring) fx.ring(p.x, 4, { from: 6, r: 46, width: 3, life: 0.4, color: '#3ddc84', squash: 0.3 });
    say(d.spoilerLabel || 'Спойлер', d.spoiler, 6);
    const run = G.state.runs;
    G.after(1.4, () => {
      if (G.state.runs !== run) return;
      if (!K.secret('goodButton')) say(d.name, d.toast);
    });
    majorEnd();
    gb.major = run;
    G.emit('kts:event', { id: 'goodButton', phase: 'start' });
    G.after(d.majorSec || 10, () => {
      if (gb.major === run) majorEnd();
    });
  }
  G.on('land', () => {
    const p = gb.p;
    if (!p || p.taken || !running()) return;
    const hb = G.bunnyHitbox();
    if (Math.abs(p.x - hb.x) > p.w / 2 + 8) return;
    p.alt = 2;
    G.collect(p);
  });

  // ---------- подбираемое П6 ----------
  const GREEN = '#3ddc84', GREEN_D = '#1f8f4e';
  function paintButton(ctx, pressed) {
    ctx.fillStyle = GREEN_D;
    ellipse(ctx, 0, 1.6, 22, 4.6);
    ctx.fillStyle = pressed ? '#9af2c0' : GREEN;
    ellipse(ctx, 0, pressed ? 0.6 : -1.4, 18, 3.4);
    if (!pressed) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ellipse(ctx, -6, -2.4, 6, 1.1);
    }
    const d = sec('goodButton') || {};
    text(ctx, d.label || 'СДЕЛАТЬ ХОРОШО', 0, 9.5, 4.4, GREEN_D);
  }
  function paintGlow(ctx) {
    for (let i = 5; i >= 1; i--) {
      ctx.fillStyle = 'rgba(61,220,132,' + (0.07 * (6 - i)).toFixed(3) + ')';
      ellipse(ctx, 0, 0, 10 + i * 5, 3 + i * 1.6);
    }
  }
  PROP_PAINT.buttonPressed = { w: 60, h: 22, ox: 30, oy: 8, alpha: 1, back: (ctx) => paintButton(ctx, true) };

  G.registerPickup({
    id: 'goodButton',
    radius: 0,
    weight: () => 0,
    power: false,
    color: GREEN,
    make(p) {
      takePending('goodButton');
      p.x += landDx();
      p.alt = -80;
      p.w = 44;
      gb.p = p;
      gb.spawned = true;
    },
    draw(ctx, p) {
      const y = G.GROUND;
      const pulse = G.calm ? 0.6 : 0.45 + 0.3 * Math.sin(G.state.idleT * 4 + p.seed);
      ctx.globalAlpha = pulse;
      blit(ctx, sprite('goodButton:glow', 72, 24, 36, 12, paintGlow), p.x, y);
      ctx.globalAlpha = 1;
      blit(ctx, sprite('goodButton', 60, 22, 30, 8, (c) => paintButton(c, false)), p.x, y);
    },
    collect(p) {
      pressButton(p);
    },
  });

  function paintBag(ctx) {
    ctx.strokeStyle = '#7a5530';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(-3.5, -8, 3, Math.PI, 0);
    ctx.moveTo(6.5, -8);
    ctx.arc(3.5, -8, 3, 0, Math.PI, true);
    ctx.stroke();
    ctx.fillStyle = '#c9a06a';
    rr(ctx, -8, -8, 16, 18, 2);
    ctx.fill();
    ctx.fillStyle = '#b08450';
    ctx.fillRect(-8, -8, 16, 3);
    ctx.fillStyle = GREEN;
    ctx.fillRect(-8, 6, 16, 2);
    ctx.fillStyle = '#ffffff';
    rr(ctx, -5, -2, 10, 7, 1.2);
    ctx.fill();
    text(ctx, '?', 0, 1.6, 6.5, '#7a5530');
  }
  function paintKazan(ctx) {
    ctx.fillStyle = '#2b2622';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#3d3631';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-17, 1, 3, 0, TAU);
    ctx.moveTo(20, 1);
    ctx.arc(17, 1, 3, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#3d3631';
    ellipse(ctx, 0, 0, 17, 4);
    ctx.fillStyle = '#e8b04a';
    ellipse(ctx, 0, -2.5, 13.5, 5.5);
    ctx.fillStyle = '#ff8a1f';
    for (const [x, y] of [[-6, -3], [3, -5], [8, -2], [-2, -1]]) ellipse(ctx, x, y, 1.6, 0.9, 0.6);
    ctx.fillStyle = '#7a4a2a';
    for (const [x, y] of [[-3, -5], [5, -1.5], [-9, -1.5]]) ellipse(ctx, x, y, 1.5, 1.1);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ellipse(ctx, -7, 6, 4, 2, -0.3);
  }
  function paintGold(ctx) {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
    g.addColorStop(0, 'rgba(255,214,90,0.75)');
    g.addColorStop(1, 'rgba(255,214,90,0)');
    ctx.fillStyle = g;
    circle(ctx, 0, 0, 30);
  }

  G.registerPickup({
    id: 'plovClue',
    radius: 15,
    weight: () => 0,
    power: false,
    color: '#c9a06a',
    make(p) {
      takePending('plovClue');
      plov.clue = true;
    },
    draw(ctx, p) {
      const t = G.state.idleT + p.seed;
      const y = G.GROUND - p.alt + Math.sin(t * 3.2) * (G.calm ? 0.6 : 2.2);
      ctx.translate(p.x, y);
      ctx.rotate(Math.sin(t * 2.4) * (G.calm ? 0.02 : 0.08));
      blit(ctx, sprite('plovClue', 26, 30, 13, 14, paintBag), 0, 0, 1.4);
    },
    collect(p) {
      const d = sec('plov');
      if (!d) return;
      const total = d.clues || 5;
      const n = K.count('plov', 1);
      K.store.set('plovDay', K.today.iso);
      G.addBonus(10, { x: p.x, alt: p.alt + 18, label: 'ЗАЦЕПКА +10', kind: 'plov' });
      const where = whereOf(plovLoc());
      const body = n >= total ? K.fmt(d.lastClue, { where }) : K.line('secrets.plov.clueText');
      say(K.fmt(d.clueLabel, { n: Math.min(n, total), total }), body);
      G.emit('kts:egg', { id: 'plov', phase: 'clue', n, total });
    },
  });

  G.registerPickup({
    id: 'kazan',
    radius: 17,
    weight: () => 0,
    power: false,
    color: '#ffd65a',
    make(p) {
      takePending('kazan');
      p.x += landDx();
      p.alt = 18;
      plov.kazan = true;
    },
    draw(ctx, p) {
      const y = G.GROUND - p.alt + 6;
      ctx.globalAlpha = G.calm ? 0.7 : 0.55 + 0.25 * Math.sin(G.state.idleT * 3 + p.seed);
      blit(ctx, sprite('kazan:glow', 64, 64, 32, 32, paintGold), p.x, y - 4, 1.2);
      ctx.globalAlpha = 1;
      blit(ctx, sprite('kazan', 46, 32, 23, 12, paintKazan), p.x, y, 1.2);
      if (!G.calm) {
        const t = G.state.idleT + p.seed;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (const ox of [-5, 4]) {
          const ph = t * 2 + ox;
          ctx.moveTo(p.x + ox, y - 10);
          ctx.quadraticCurveTo(p.x + ox + 4 * Math.sin(ph), y - 17, p.x + ox, y - 24);
        }
        ctx.stroke();
      }
    },
    collect(p) {
      const d = sec('plov') || {};
      G.addBonus(d.kazanMin || 60, { x: p.x, alt: p.alt + 30, label: d.kazanLabel || 'ПЛОВ НАЙДЕН', kind: 'gold' });
      if (G.fx && G.fx.confetti) G.fx.confetti(G.calm ? 12 : 30);
      if (!K.secret('plov')) say(d.name, d.toast);
      K.ach('plovFound');
      G.emit('kts:egg', { id: 'plov', phase: 'kazan' });
    },
  });

  // ---------- слова ----------
  const LAYOUT_EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
  const LAYOUT_RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';
  function toRu(s) {
    let out = '';
    for (const ch of s) {
      const i = LAYOUT_EN.indexOf(ch);
      out += i < 0 ? ch : LAYOUT_RU[i];
    }
    return out;
  }
  const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  const squash = (s) => s.replace(/ /g, '');
  const isCaps = (s) => /[А-ЯЁ]/.test(s) && s === s.toUpperCase();

  function drullegi() {
    const d = sec('drullegi');
    if (!d) return;
    const fx = G.fx;
    if (fx && typeof fx.ktsConfetti === 'function') fx.ktsConfetti(G.calm ? 12 : 36);
    else if (fx && fx.confetti) fx.confetti(G.calm ? 10 : 24);
    if (!K.secret('drullegi')) say(d.name, d.toast);
  }
  function trusy() {
    const d = sec('trusy');
    if (!d) return;
    const first = K.secret('trusy');
    K.skin('trusy');
    if (!first) say(d.name, d.toast);
  }
  function trusyLower() {
    const d = sec('trusy');
    if (d) say(d.name, firstLine(d.lower));
  }
  function stopVoices() {
    const d = sec('stopword');
    if (!d || (G.state.mode !== 'run' && G.state.mode !== 'pause')) return false;
    let n = 0;
    for (const o of G.obstacles) {
      if (o.type !== 'voice' || o.dead || o.deco || o.ballistic || o.x < -40 || o.x > G.W + 60) continue;
      G.smash(o);
      n++;
    }
    if (n && !K.secret('stopword')) say(d.name, d.toast);
    return n > 0;
  }
  const hasWord = (list, w) => Array.isArray(list) && list.some((x) => norm(x) === w);
  const endsWith = (list, a, b) => Array.isArray(list) && list.some((x) => {
    const v = norm(x);
    return a.endsWith(v) || b.endsWith(v);
  });

  G.on('word', (e) => {
    if (!e) return;
    const raw = String(e.text || '').trim().replace(/\s+/g, ' ');
    const w = norm(raw);
    if (!w) return;
    const dr = sec('drullegi'), tr = sec('trusy'), pl = sec('plov'), st = sec('stopword');
    if (dr && hasWord(dr.words, w)) return drullegi();
    if (tr && squash(w) === squash(norm(tr.phrase))) return isCaps(raw) ? trusy() : trusyLower();
    if (pl && w === norm(pl.word)) return plovHint();
    if (st && hasWord(st.words, w)) stopVoices();
  });

  // Свободный набор на десктопе: слова ловим по концу буфера ядра, в том числе набранные в английской раскладке.
  G.on('type', (e) => {
    if (!e) return;
    const raw = String(e.raw || '');
    const lower = String(e.buffer || '').replace(/ё/g, 'е');
    const ru = toRu(lower);
    const tr = sec('trusy');
    const phrase = tr && tr.phrase ? String(tr.phrase) : '';
    if (phrase && (raw.endsWith(phrase) || raw.endsWith(squash(phrase)))) return trusy();
    if (running()) {
      const st = sec('stopword');
      if (st && endsWith(st.words, lower, ru)) stopVoices();
      return;
    }
    const dr = sec('drullegi'), pl = sec('plov');
    if (dr && endsWith(dr.words, lower, ru)) return drullegi();
    if (pl && endsWith([pl.word], lower, ru)) return plovHint();
    const p = norm(phrase);
    if (p && (lower.endsWith(p) || lower.endsWith(squash(p)))) trusyLower();
  });

  // ---------- секретки по событиям ----------
  const run = { cakes: 0, escaped: false, bossWon: false };
  G.on('start', () => {
    run.cakes = 0;
    run.escaped = false;
    run.bossWon = false;
    plov.clue = false;
    plov.kazan = false;
    const pd = sec('plov');
    plov.ready = !!pd && K.counter('plov') >= (pd.clues || 5);
    const d = sec('goodButton');
    gb.armed = !!d && Math.random() < (Number(d.chance) || 0);
    gb.spawned = false;
    gb.p = null;
    majorEnd();
  });
  G.on('die', (info) => {
    majorEnd();
    const d = sec('meme1156');
    if (d && info && info.clockMin === (d.clockMin || 716)) K.secret('meme1156');
  });
  G.on('stomp', (e) => {
    if (!e) return;
    if (e.type === 'voice') K.secret('stopword');
    if (e.meme) K.secret('snoozeMeme');
  });
  G.on('pickup', (p) => {
    if (!p) return;
    if ((p.type === 'frog' || p.type === 'toad') && K.today.wednesday) K.secret('wednesday');
    if (p.type === 'cake') {
      run.cakes++;
      const d = sec('twoDenis');
      if (d && run.cakes >= (d.cakes || 2)) K.secret('twoDenis');
    }
  });
  G.on('kts:npc', (e) => {
    if (!e || e.id !== 'toxic') return;
    if (e.phase === 'blocked') K.secret('filter');
    else if (e.phase === 'kind') K.secret('botBug');
  });
  function mordorGoal() {
    const pm = K.get('progress', 'mordor');
    if (pm && Number(pm.goalUnits) > 0) return Number(pm.goalUnits);
    if (pm && Number(pm.goalKm) > 0 && Number(pm.unitsPerKm) > 0) return pm.goalKm * pm.unitsPerKm;
    const d = sec('mordor');
    return d && d.goal > 0 ? d.goal : Infinity;
  }
  function checkCounter(key, value) {
    if (key === 'mordor' && value >= mordorGoal()) K.secret('mordor');
    if (key === 'vivi') {
      const d = sec('vivi');
      if (d && value >= (d.goal || 10)) K.secret('vivi');
    }
  }
  G.on('kts:count', (e) => {
    if (e) checkCounter(e.key, Number(e.value) || 0);
  });
  function vyvezli() {
    if (run.escaped && run.bossWon) K.secret('vyvezli');
  }
  G.on('chase', (e) => {
    if (e && e.phase === 'escape' && running()) {
      run.escaped = true;
      vyvezli();
    }
  });
  G.on('boss', (e) => {
    if (e && e.phase === 'win' && running()) {
      run.bossWon = true;
      vyvezli();
    }
  });
  G.on('boot', () => {
    checkCounter('mordor', K.counter('mordor'));
    checkCounter('vivi', K.counter('vivi'));
  });

  // ---------- Котзилла на стартовом экране ----------
  const KZ_PAL = [
    { body: '#2e3b33', spike: '#58d68d', eye: '#8dff9e', belly: '#46574b' },
    { body: '#d2588c', spike: '#ffd0e2', eye: '#fff36b', belly: '#e88db3' },
    { body: '#3a5fd0', spike: '#a9c6ff', eye: '#ffe066', belly: '#5d7fe0' },
    { body: '#b8862a', spike: '#ffe28a', eye: '#ffffff', belly: '#d3a54a' },
    { body: '#2fbf71', spike: '#eafff1', eye: '#ffffff', belly: '#5fd394' },
    { body: '#efe9df', spike: '#2e3b33', eye: '#2fbf71', belly: '#ffffff' },
  ];
  function tri(ctx, ax, ay, bx, by, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
  }
  function paintKotzilla(ctx, pal, wink, hat, meow) {
    ctx.rotate(-0.06);
    ctx.fillStyle = '#fffaf0';
    rr(ctx, -17, -20, 34, 40, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,20,0.25)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.strokeStyle = pal.body;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(7, 13);
    ctx.quadraticCurveTo(17, 11, 13, 1);
    ctx.stroke();
    ctx.fillStyle = pal.spike;
    tri(ctx, 7, -9, 14, -6, 9, -3);
    tri(ctx, 9, -3, 15, 1, 10, 3);
    tri(ctx, 10, 3, 15, 8, 9, 9);
    ctx.fillStyle = pal.body;
    ellipse(ctx, 1, 8, 10, 9);
    ellipse(ctx, 0, -5, 10, 8.5);
    tri(ctx, -9.5, -8, -7, -17, -2, -11);
    tri(ctx, 2, -11, 7, -17, 9.5, -8);
    ctx.fillStyle = pal.belly;
    ellipse(ctx, 0, 10, 6, 6);
    ellipse(ctx, -5, 16.5, 3.4, 1.8);
    ellipse(ctx, 6, 16.5, 3.4, 1.8);
    ctx.fillStyle = pal.eye;
    ellipse(ctx, -4.2, -5, 2.7, 2.2);
    ctx.fillStyle = '#111111';
    ellipse(ctx, -4.2, -5, 0.8, 1.9);
    if (wink) {
      ctx.strokeStyle = pal.eye;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(4.2, -4.2, 2.3, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      ctx.fillStyle = pal.eye;
      ellipse(ctx, 4.2, -5, 2.7, 2.2);
      ctx.fillStyle = '#111111';
      ellipse(ctx, 4.2, -5, 0.8, 1.9);
    }
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-2, -0.5);
    ctx.quadraticCurveTo(-1, 0.8, 0, -0.5);
    ctx.quadraticCurveTo(1, 0.8, 2, -0.5);
    ctx.stroke();
    if (hat) {
      ctx.fillStyle = '#d9342b';
      tri(ctx, -8, -12, 7, -13, 3, -24);
      ctx.fillStyle = '#ffffff';
      rr(ctx, -9, -14, 17, 3, 1.5);
      ctx.fill();
      circle(ctx, 3, -24, 2);
    }
    if (meow) {
      ctx.fillStyle = '#ffffff';
      rr(ctx, -16, -30, 20, 9, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,40,20,0.35)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      tri(ctx, -8, -21.5, -4, -21.5, -7, -18);
      text(ctx, meow, -6, -25.5, 5.5, '#2e3b33');
    }
  }
  const kz = { n: 0, variant: 0, wink: 0, pop: 0, hot: null, a: { x: 0, alt: 0, w: 34, h: 40, own: true } };
  function kzAnchor() {
    const sc = G.scene, a = kz.a;
    let src = null;
    try {
      if (sc && typeof sc.anchor === 'function') src = sc.anchor('kotzilla');
      else if (sc && typeof sc.anchors === 'function') {
        const all = sc.anchors('living');
        src = all && all.kotzilla;
      }
    } catch (e) {
      src = null;
    }
    const alt = src && (Number.isFinite(src.alt) ? src.alt : Number.isFinite(src.y) ? G.GROUND - src.y : NaN);
    if (src && Number.isFinite(src.x) && Number.isFinite(alt)) {
      a.x = src.x;
      a.alt = alt;
      a.w = src.w > 0 ? src.w : 34;
      a.h = src.h > 0 ? src.h : 40;
      a.own = false;
    } else {
      a.x = Math.max(30, G.W * 0.075);
      a.alt = G.GROUND - G.H * 0.42;
      a.w = 34;
      a.h = 40;
      a.own = true;
    }
    return a;
  }
  function kzTap() {
    const d = sec('kotzilla');
    if (!d || G.state.mode !== 'start') return;
    kz.n++;
    kz.pop = 0.22;
    kz.variant = kz.n % KZ_PAL.length;
    G.emit('kts:egg', { id: 'kotzilla', phase: 'click', n: kz.n });
    if (kz.n < (d.clicks || 7)) return;
    kz.n = 0;
    kz.variant = 0;
    kz.wink = 1.8;
    G.emit('kts:egg', { id: 'kotzilla', phase: 'meow' });
    K.secret('kotzilla');
  }
  const kzOn = () => G.state.mode === 'start' && !!sec('kotzilla');
  G.onUpdate((dt, realDt) => {
    const on = kzOn();
    if (on && !kz.hot) kz.hot = hotspot('Котзилла', kzTap);
    if (!kz.hot) return;
    if (!on) return showHotspot(kz.hot, false);
    const a = kzAnchor();
    showHotspot(kz.hot, true, a.x, a.alt, a.w, a.h);
    const rdt = realDt || dt;
    if (kz.pop > 0) kz.pop = Math.max(0, kz.pop - rdt);
    if (kz.wink > 0) kz.wink = Math.max(0, kz.wink - rdt);
  }, 93);
  G.onRender(G.LAYER.BACK + 0.6, (ctx) => {
    if (!kzOn()) return;
    const a = kz.a;
    if (!a.own && !kz.n && !kz.wink) return;
    const d = sec('kotzilla');
    const hat = !!(d && d.newYearHat && K.event('newYear'));
    const wink = kz.wink > 0;
    const pal = KZ_PAL[kz.variant] || KZ_PAL[0];
    const s = sprite('kotzilla:' + kz.variant + (wink ? 'w' : '') + (hat ? 'h' : ''), 40, 60, 20, 34, (c) => paintKotzilla(c, pal, wink, hat, wink ? d.meow || 'МЯУ' : ''));
    const k = Math.min(a.w / 34, a.h / 40) * (1 + (G.calm ? 0 : 0.5 * kz.pop));
    blit(ctx, s, a.x, G.GROUND - a.alt, k);
  });

  // ---------- такт ----------
  let acc = 0;
  G.onUpdate((dt) => {
    if (!running()) return;
    acc += dt;
    if (acc < 0.2) return;
    acc = 0;
    const S = G.state;
    if (S.t < 10 || S.t - lastPlaceT < 4 || locAge() < 2 || locLeft() < 5 || !quiet(5)) return;
    buttonTick();
    if (S.t - lastPlaceT < 4) return;
    plovTick();
  }, 33);

  if (K.debug) {
    G.on('kts:unlock', (e) => console.log('[kts] ' + e.kind + ' ' + e.id + ' ' + e.n + '/' + e.total));
    E.force = (type) => (running() && (type === 'goodButton' || type === 'plovClue' || type === 'kazan') ? place(type, type) : false);
  }
})();
