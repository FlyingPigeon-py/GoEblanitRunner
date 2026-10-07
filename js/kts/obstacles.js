/* KTS-препятствия и события П1: робот-пылесос и королева Виви, голосовое «залогай время» и стоп-слово, Снежок на созвоне, «умер вай-фай».
   Тексты и числа — в js/kts/data/items.js. Здесь же общие помощники П1 (G.ktsItems) для js/kts/pickups.js. */
(() => {
  'use strict';
  const G = window.G;
  const K = G.kts;
  if (!K || !K.enabled || !G.obstacleKit) return;
  const kit = G.obstacleKit;
  const { rr, ellipse } = G.draw;
  const TAU = G.TAU, PI = Math.PI;
  const clamp = G.clamp;
  const cfg = G.cfg;
  const HB = cfg.hitbox;

  // ---------- помощники П1 ----------
  const TOAST_KIND = 'kts';
  const item = (id) => K.get('items', id);
  function tOf(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
    return m ? (+m[1] * 60 + +m[2] - cfg.startClockMin) / cfg.minPerSec : 0;
  }
  function dig(obj, path) {
    let v = obj;
    for (const k of String(path).split('.')) v = v == null ? null : v[k];
    return v;
  }
  function say(id, key, ctx) {
    const def = K.raw('items', id);
    if (!def || def.on === false) return null;
    if (K.isOn(def)) {
      const s = K.line('items.' + id + '.' + key, ctx);
      if (s != null) return s;
    }
    const fb = dig(def.fallback, key);
    if (!fb) return null;
    return K.line(Array.isArray(fb) ? fb : [fb], ctx, 'items.' + id + '.fallback.' + key);
  }
  function toast(label, text) {
    if ((!label && !text) || !G.ui || typeof G.ui.toast !== 'function') return;
    G.ui.toast(label || '', text || '', { kind: TOAST_KIND });
  }
  function popup(x, alt, text, color, size) {
    if (text && G.fx && typeof G.fx.popup === 'function') G.fx.popup(x, alt, String(text), { color, size: size || 15, life: 1 });
  }
  const kevent = (id, phase, extra) => G.emit('kts:event', Object.assign({ id, phase }, extra || {}));

  const sprites = Object.create(null);
  const spriteK = () => Math.min(4, Math.max(1, (G.scale || 1) * (G.dpr || 1) * 1.25));
  function sprite(key, w, h, paint) {
    const k = spriteK();
    const old = sprites[key];
    if (old && old.k === k) return old;
    if (typeof document === 'undefined' || !document.createElement) return null;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * k));
    c.height = Math.max(1, Math.ceil(h * k));
    const g = c.getContext('2d');
    if (g) {
      g.setTransform(k, 0, 0, k, (w / 2) * k, (h / 2) * k);
      g.lineJoin = 'round';
      g.lineCap = 'round';
      try {
        paint(g);
      } catch (e) {
        G.report('kts sprite ' + key, e);
      }
    }
    return (sprites[key] = { c, w, h, k });
  }
  function blit(ctx, s, x, y, sc) {
    if (!s) return;
    const k = sc || 1;
    ctx.drawImage(s.c, x - (s.w / 2) * k, y - (s.h / 2) * k, s.w * k, s.h * k);
  }
  const dropSprites = () => {
    for (const k in sprites) delete sprites[k];
  };
  G.on('theme', dropSprites);
  G.on('resize', dropSprites);
  G.on('fonts', dropSprites);

  G.ktsItems = { item, say, toast, popup, tOf, sprite, blit, event: kevent };

  const npcs = new Set();
  function npcBusy() {
    if (npcs.size) return true;
    const N = K.npc;
    const who = N && typeof N.active === 'function' ? N.active() : null;
    return !!who && who !== 'vivi';
  }
  G.on('kts:npc', (e) => {
    if (!e || !e.id) return;
    if (e.phase === 'leave') npcs.delete(e.id);
    else npcs.add(e.id);
  });

  const run = { stopToast: false, lastVoiceT: -1e9 };
  const near = (o) => o.x > -40 && o.x < G.W + 40;
  const live = (o) => !o.deco && !o.dead && !o.ballistic;
  const edgeInk = () => (G.isDark() ? 'rgba(10,8,6,0.85)' : 'rgba(40,26,14,0.85)');

  // ---------- робот-пылесос ----------
  const VAC = item('vacuum');
  const VAC_HALF = 20, VAC_BODY = 13, VAC_TOP = 17;
  if (VAC) {
    const places = Array.isArray(VAC.places) ? VAC.places : null;
    const placeOK = () => {
      const loc = G.scene && G.scene.loc && G.scene.loc.id;
      return !places || !loc || places.indexOf(loc) >= 0;
    };
    const minT = tOf(VAC.minT);
    const vw = Array.isArray(VAC.weight) ? VAC.weight : [0.09, 0.17];
    const baseW = kit.weightFor('vacuum', minT, vw[0], vw[1], 30);

    const vacSprite = () =>
      sprite('vacuum', 50, 26, (g) => {
        const ink = '#2a2d33';
        g.fillStyle = '#5c626d';
        rr(g, -22, 5, 44, 6.5, 3);
        g.fill();
        g.fillStyle = '#eceef1';
        rr(g, -22, -2, 44, 10, 5);
        g.fill();
        g.strokeStyle = ink;
        g.lineWidth = 1.4;
        rr(g, -22, -2, 44, 13.5, 5.5);
        g.stroke();
        g.fillStyle = '#c9ced6';
        rr(g, -20, 4.4, 40, 2, 1);
        g.fill();
        g.fillStyle = '#ffffff';
        rr(g, -15, -0.6, 24, 1.8, 0.9);
        g.fill();
        g.fillStyle = '#3b8fd6';
        rr(g, -22.6, 0, 5, 9, 2.5);
        g.fill();
        g.fillStyle = '#2a2d33';
        rr(g, -7, -7.5, 14, 5.8, 2.9);
        g.fill();
        g.fillStyle = '#4cd964';
        ellipse(g, 3.2, -4.6, 1.3, 1.3);
        g.fillStyle = '#16181d';
        ellipse(g, 10, 11.4, 3, 2.2);
        ellipse(g, -6, 11.4, 3, 2.2);
      });

    function drawVacuum(ctx, o) {
      const lift = o.alt || 0;
      kit.warnChip(ctx, o, VAC_TOP + 12);
      ctx.translate(o.x, G.GROUND - lift - 11);
      if (o.rot) ctx.rotate(o.rot);
      if (o.heading < 0) ctx.scale(-1, 1);
      const hum = o.ballistic || kit.calm() ? 0 : Math.sin(G.state.idleT * 40 + o.seed) * 0.35;
      blit(ctx, vacSprite(), 0, hum);
      if (o.ballistic) return;
      ctx.strokeStyle = '#3b8fd6';
      ctx.lineWidth = 1.1;
      const a = o.brush || 0;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const b = a + (i * TAU) / 3;
        ctx.moveTo(-20, 8);
        ctx.lineTo(-20 + Math.cos(b) * 5, 8 + Math.sin(b) * 1.6);
      }
      ctx.stroke();
    }

    kit.shadow('vacuum', (o, sh) => {
      sh.x = o.x;
      sh.w = 23;
      sh.lift = o.alt || 0;
      return true;
    });

    G.registerObstacle({
      id: 'vacuum',
      kind: 'ground',
      width: VAC_HALF * 2 + 4,
      minT,
      weight: (t) => (placeOK() ? baseW(t) : 0),
      causes: VAC.causes.slice(),
      hitWord: VAC.hitWord,
      stompWord: VAC.stompWord,
      sound: 'other',
      fx: { debris: 'shards', colors: ['#eceef1', '#5c626d', '#3b8fd6'] },
      make(o, opts) {
        o.w = VAC_HALF * 2;
        o.h = VAC_TOP;
        o.drift = Number.isFinite(opts.drift) ? clamp(opts.drift, 0.8, 1.2) : 0.8 + Math.random() * 0.4;
        o.heading = o.drift >= 1 ? 1 : -1;
        o.brush = Math.random() * TAU;
        o.warnT = 0;
      },
      update(o, dt) {
        kit.tickWarn(o, dt);
        o.brush = (o.brush || 0) + dt * 22 * o.heading;
      },
      hit(o, hb) {
        const a = o.alt || 0;
        return kit.circleRect(hb.x, hb.y, hb.r, o.x - VAC_HALF, a, VAC_HALF * 2, VAC_BODY) || kit.circleRect(hb.x, hb.y, hb.r, o.x - 6, a + VAC_BODY, 12, VAC_TOP - VAC_BODY);
      },
      stompTop: (o) => (o.alt || 0) + VAC_TOP,
      draw: kit.squashed(drawVacuum, (o) => o.alt || 0),
    });
  }

  // ---------- королева Виви ----------
  const VIVI = item('vivi');
  const LEAP_T = 0.34, OUT_T = 0.55, VIVI_MARGIN = 110;
  const vivi = { on: false, o: null, t: 0, phase: '', x: 0, alt: 0, x0: 0, alt0: 0, hitX: 0, hitAlt: 0 };

  function catPath(g) {
    g.beginPath();
    g.ellipse(2, 6, 10, 7, 0, 0, TAU);
    g.moveTo(0, -3);
    g.arc(-7, -3, 7, 0, TAU);
    g.moveTo(-13, -6);
    g.lineTo(-12, -13);
    g.lineTo(-8, -9);
    g.closePath();
    g.moveTo(-6, -9.5);
    g.lineTo(-2, -13);
    g.lineTo(-1.2, -6);
    g.closePath();
  }
  const viviSprite = () =>
    sprite('vivi', 36, 36, (g) => {
      const fur = '#9c8574', ink = '#2a1d14', halo = 'rgba(255,248,236,0.7)';
      g.lineCap = 'round';
      g.strokeStyle = halo;
      g.lineWidth = 5.5;
      g.beginPath();
      g.moveTo(9, 6);
      g.quadraticCurveTo(17, 2, 15, -8);
      g.stroke();
      g.lineWidth = 3.2;
      catPath(g);
      g.stroke();
      g.strokeStyle = fur;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(9, 6);
      g.quadraticCurveTo(17, 2, 15, -8);
      g.stroke();
      g.fillStyle = fur;
      g.strokeStyle = ink;
      g.lineWidth = 1.2;
      catPath(g);
      g.fill();
      g.stroke();
      g.strokeStyle = '#6e5a4b';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-1, 1);
      g.lineTo(1, 4);
      g.moveTo(4, 0);
      g.lineTo(5.5, 3.5);
      g.moveTo(8.5, 1.5);
      g.lineTo(9.5, 4.5);
      g.stroke();
      g.fillStyle = '#f2e6d8';
      ellipse(g, -7, 0, 3.6, 2.6);
      g.fillStyle = '#c7e65a';
      ellipse(g, -9.5, -3.6, 1.5, 1.3);
      ellipse(g, -4.5, -3.6, 1.5, 1.3);
      g.fillStyle = '#1a1a1a';
      ellipse(g, -9.3, -3.6, 0.6, 1.1);
      ellipse(g, -4.3, -3.6, 0.6, 1.1);
      g.fillStyle = '#e88aa0';
      ellipse(g, -7, -1.2, 0.9, 0.6);
      g.fillStyle = '#ffd23f';
      g.strokeStyle = '#8a5f06';
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(-12.5, -10.5);
      g.lineTo(-12, -16);
      g.lineTo(-9.5, -13);
      g.lineTo(-7, -17.5);
      g.lineTo(-4.5, -13);
      g.lineTo(-2, -16);
      g.lineTo(-1.5, -10.5);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#ff5a8a';
      ellipse(g, -7, -14.2, 1, 1);
    });

  function viviCount(by) {
    const start = Number(VIVI.start) || 0;
    if (K.counter('vivi') < start) K.setCounter('vivi', start);
    const n = K.count('vivi');
    if (n >= (Number(VIVI.win) || 10) && K.secret('vivi')) {
      toast(say('vivi', 'crown.label', { n }), say('vivi', 'crown.toast', { n }));
    } else if (by === 'vivi') {
      toast(K.fmt(VIVI.label, { n }), say('vivi', 'toast', { n }));
    }
    return n;
  }

  function viviStart(o) {
    vivi.on = true;
    vivi.o = o;
    vivi.t = 0;
    vivi.phase = 'in';
    vivi.x0 = Math.min(G.W - 8, o.x + 70);
    vivi.alt0 = 128;
    vivi.x = vivi.x0;
    vivi.alt = vivi.alt0;
    kevent('vivi', 'start', { x: o.x, alt: (o.alt || 0) + VAC_TOP });
  }
  function viviEnd() {
    if (!vivi.on) return;
    vivi.on = false;
    vivi.o = null;
    kevent('vivi', 'end');
  }

  function updateVivi(dt) {
    const S = G.state;
    if (!VIVI || !G.obstacleTypes.vacuum) return;
    if (!vivi.on) {
      for (const o of G.obstacles) {
        if (o.type !== 'vacuum' || !o.viviPlan || !live(o) || o.x - VAC_HALF > G.W - 6) continue;
        o.viviPlan = false;
        const reach = o.x - S.speed * (o.drift || 1) * LEAP_T;
        if (npcBusy() || reach < G.bunny.x + VIVI_MARGIN) continue;
        viviStart(o);
        break;
      }
      return;
    }
    vivi.t += dt;
    vivi.x0 -= S.dx;
    const o = vivi.o;
    if (vivi.phase === 'in') {
      const k = clamp(vivi.t / LEAP_T, 0, 1);
      const tx = o ? o.x : vivi.x0 - 60, ta = o ? (o.alt || 0) + VAC_TOP + 4 : 0;
      vivi.x = vivi.x0 + (tx - vivi.x0) * k;
      vivi.alt = vivi.alt0 + (ta - vivi.alt0) * k + 46 * Math.sin(k * PI);
      if (k >= 1) {
        if (o && live(o)) {
          o.viviHit = true;
          G.smash(o);
          viviCount('vivi');
        }
        vivi.phase = 'out';
        vivi.t = 0;
        vivi.hitX = vivi.x;
        vivi.hitAlt = vivi.alt;
      }
    } else {
      vivi.hitX -= S.dx;
      const k = clamp(vivi.t / OUT_T, 0, 1);
      vivi.x = vivi.hitX + 80 * k;
      vivi.alt = vivi.hitAlt + 150 * k - 90 * k * k + 30 * Math.sin(k * PI);
      if (k >= 1) viviEnd();
    }
  }

  G.onRender(G.LAYER.OBSTACLES + 1, (ctx) => {
    if (!vivi.on) return;
    const k = vivi.phase === 'in' ? clamp(vivi.t / 0.12, 0, 1) : 1 - clamp((vivi.t - OUT_T * 0.6) / (OUT_T * 0.4), 0, 1);
    if (k <= 0.01) return;
    ctx.globalAlpha = k;
    ctx.translate(vivi.x, G.GROUND - vivi.alt - 6);
    const tilt = kit.calm() ? 0 : vivi.phase === 'in' ? -0.35 : 0.25;
    ctx.rotate(tilt);
    if (vivi.phase === 'out') ctx.scale(-1, 1);
    blit(ctx, viviSprite(), 0, 0);
  });

  // ---------- голосовое «залогай время» ----------
  const VOICE = item('voice');
  const V_BASE = 12, V_HOP = 48, V_STRIDE = 240, V_HALF = 22, V_HH = 8;
  // Скачок привязан к расстоянию до кролика: в точке кролика пузырь всегда внизу, как пинг после alignTo. Поэтому призрак с другим o.x скачет верно.
  const V_X0 = cfg.runX + HB.dx;
  const hopAt = (x) => V_HOP * Math.abs(Math.sin((PI * (x - V_X0)) / V_STRIDE));
  const hopOf = (o) => (o.ballistic ? o.hop || 0 : hopAt(o.x));
  if (VOICE) {
    const minT = tOf(VOICE.minT);
    const baseW = kit.weightFor('voice', minT, 0.08, 0.16, 30);
    const cooldown = Number(VOICE.cooldown) || 40;

    const voiceSprite = () =>
      sprite('voice', 62, 52, (g) => {
        const ink = edgeInk();
        const cap = String(VOICE.caption || '');
        g.font = `600 8px ${G.FONT_BODY}`;
        const fit = Math.min(1, 52 / Math.max(1, g.measureText(cap).width));
        g.fillStyle = '#fffdf8';
        rr(g, -29, -25, 58, 13, 4);
        g.fill();
        g.strokeStyle = ink;
        g.lineWidth = 1;
        g.stroke();
        g.fillStyle = '#2b2219';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.save();
        g.translate(0, -18.2);
        g.scale(fit, 1);
        g.fillText(cap, 0, 0);
        g.restore();
        g.fillStyle = '#1f9d63';
        g.beginPath();
        g.moveTo(-16, 8);
        g.lineTo(-23, 14);
        g.lineTo(-9, 8);
        g.closePath();
        g.fill();
        rr(g, -24, -9, 48, 18, 9);
        g.fill();
        g.strokeStyle = ink;
        g.lineWidth = 1.3;
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.18)';
        rr(g, -19, -7, 30, 3.5, 1.75);
        g.fill();
        g.fillStyle = '#ffffff';
        ellipse(g, -15, 0, 6, 6);
        g.fillStyle = '#1f9d63';
        g.beginPath();
        g.moveTo(-16.6, -3);
        g.lineTo(-12, 0);
        g.lineTo(-16.6, 3);
        g.closePath();
        g.fill();
        g.fillStyle = '#ffffff';
        const bars = [2, 4.5, 3, 6, 3.5, 5, 2.5];
        for (let i = 0; i < bars.length; i++) rr(g, -6.5 + i * 2.3, -bars[i] / 2, 1.3, bars[i], 0.6);
        g.font = `700 7px ${G.FONT_DISPLAY}`;
        g.fillText(String(VOICE.duration || ''), 15.5, 0.5);
      });

    function drawVoice(ctx, o) {
      const lift = o.alt || 0, hop = hopOf(o), M = kit.motion();
      kit.warnChip(ctx, o, V_BASE + V_HOP + 30);
      const g = hop / V_HOP;
      const squash = o.ballistic ? 0 : Math.max(0, 1 - g / 0.22) * M;
      ctx.translate(o.x, G.GROUND - lift - hop - V_BASE);
      if (o.rot) ctx.rotate(o.rot);
      if (squash > 0) {
        ctx.translate(0, 9);
        ctx.scale(1 + 0.18 * squash, 1 - 0.2 * squash);
        ctx.translate(0, -9);
      }
      blit(ctx, voiceSprite(), 0, 0);
    }

    kit.shadow('voice', (o, sh) => {
      sh.x = o.x;
      sh.w = 20;
      sh.lift = Math.max(0, hopOf(o) + (o.alt || 0));
      return true;
    });

    G.registerObstacle({
      id: 'voice',
      kind: 'ground',
      width: V_HALF * 2 + 4,
      minT,
      chaseBan: true,
      weight: (t) => (G.state.t - run.lastVoiceT >= cooldown ? baseW(t) : 0),
      causes: VOICE.causes.slice(),
      hitWord: VOICE.hitWord,
      stompWord: VOICE.stompWord,
      sound: 'ping',
      fx: { debris: 'shards', colors: ['#1f9d63', '#ffffff', '#fffdf8'] },
      make(o) {
        o.w = V_HALF * 2;
        o.h = V_BASE * 2;
        o.hMax = V_BASE + V_HOP + V_HH;
        o.drift = 1.15;
        o.hop = hopAt(o.x);
        o.warnT = 0;
      },
      update(o, dt) {
        kit.tickWarn(o, dt);
        o.hop = hopAt(o.x);
      },
      hit(o, hb) {
        const cy = (o.alt || 0) + V_BASE + hopOf(o);
        return kit.circleRect(hb.x, hb.y, hb.r, o.x - V_HALF, cy - V_HH, V_HALF * 2, V_HH * 2);
      },
      stompTop: (o) => (o.alt || 0) + V_BASE + hopOf(o) + V_HH,
      floorOf: (o) => -(o.hop || 0),
      draw: kit.ghosted(kit.squashed(drawVoice, (o) => (o.alt || 0) + (o.hop || 0) + 2)),
    });
  }

  function stopWord() {
    K.secret('stopword');
    if (run.stopToast) return;
    run.stopToast = true;
    toast(say('voice', 'stop.label'), say('voice', 'stop.toast'));
  }

  G.on('type', (e) => {
    if (!VOICE || G.state.mode !== 'run' || !e) return;
    const buf = String(e.buffer || '');
    const words = Array.isArray(VOICE.stopWords) ? VOICE.stopWords : [];
    if (!words.some((w) => w && buf.endsWith(w))) return;
    let n = 0;
    for (const o of G.obstacles) {
      if (o.type !== 'voice' || !live(o) || !near(o)) continue;
      G.smash(o);
      n++;
    }
    if (n) stopWord();
  });

  // ---------- Снежок в окне созвона ----------
  const SNEZHOK = item('snezhok');
  const snezhokSprite = () =>
    sprite('snezhok', 82, 26, (g) => {
      g.fillStyle = '#4f5d7a';
      rr(g, -41, -13, 82, 26, 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.06)';
      rr(g, -41, -13, 82, 9, 2);
      g.fill();
      const fur = '#f7f5f0', ink = '#3a3f4a';
      g.fillStyle = fur;
      g.strokeStyle = ink;
      g.lineWidth = 0.9;
      g.beginPath();
      g.ellipse(0, 14, 15, 8, 0, PI, TAU);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(-10, -4);
      g.lineTo(-9, -13);
      g.lineTo(-3, -8);
      g.moveTo(3, -8);
      g.lineTo(9, -13);
      g.lineTo(10, -4);
      g.fill();
      g.stroke();
      g.beginPath();
      g.ellipse(0, -1, 11, 9, 0, 0, TAU);
      g.fill();
      g.stroke();
      g.fillStyle = '#f4a8b8';
      g.beginPath();
      g.moveTo(-8.4, -6.5);
      g.lineTo(-8, -10.5);
      g.lineTo(-5.2, -8.2);
      g.moveTo(5.2, -8.2);
      g.lineTo(8, -10.5);
      g.lineTo(8.4, -6.5);
      g.fill();
      g.strokeStyle = '#2f3440';
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(-6.5, -1.5);
      g.quadraticCurveTo(-4.5, -0.2, -2.5, -1.5);
      g.moveTo(2.5, -1.5);
      g.quadraticCurveTo(4.5, -0.2, 6.5, -1.5);
      g.stroke();
      g.fillStyle = '#e88aa0';
      ellipse(g, 0, 1.6, 1.3, 0.9);
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(-3, 2.8);
      g.lineTo(-10, 2);
      g.moveTo(-3, 3.4);
      g.lineTo(-10, 4.2);
      g.moveTo(3, 2.8);
      g.lineTo(10, 2);
      g.moveTo(3, 3.4);
      g.lineTo(10, 4.2);
      g.stroke();
      g.strokeStyle = '#4cd964';
      g.lineWidth = 1.2;
      rr(g, -40.4, -12.4, 80.8, 24.8, 1.6);
      g.stroke();
    });
  const SNEZHOK_FACE = {
    draw(ctx, x, y, w, h) {
      const s = snezhokSprite();
      if (s) ctx.drawImage(s.c, x, y, w, h);
    },
  };

  // ---------- «умер вай-фай» ----------
  const WIFI = item('wifi');
  const wifi = { at: -1, end: -1, on: false };
  function wifiPlan() {
    wifi.on = false;
    wifi.at = -1;
    const D = G.director;
    if (!WIFI || !D || Math.random() >= (Number(WIFI.chance) || 0)) return;
    const w = Array.isArray(WIFI.window) ? WIFI.window : [];
    const a = tOf(w[0]), b = tOf(w[1]), len = Number(WIFI.duration) || 5;
    wifi.at = a + Math.random() * Math.max(0, b - a - len);
    wifi.end = wifi.at + len;
    if (typeof D.ban === 'function') D.ban(WIFI.blocks, wifi.end, wifi.at);
    if (typeof D.reserve === 'function') D.reserve(wifi.at, wifi.end, 'wifi');
  }
  function updateWifi() {
    const t = G.state.t;
    if (!wifi.on && wifi.at >= 0 && t >= wifi.at && t < wifi.end) {
      wifi.on = true;
      kevent('wifi', 'start', { until: wifi.end });
      toast(say('wifi', 'label'), say('wifi', 'toast'));
    } else if (wifi.on && t >= wifi.end) {
      wifi.on = false;
      wifi.at = -1;
      kevent('wifi', 'end');
      const B = G.bunny;
      popup(B.x + 30, B.alt + 80, WIFI.back, '#3d8bfd', 14);
    }
  }

  // ---------- события ----------
  G.on('start', () => {
    run.stopToast = false;
    run.lastVoiceT = -1e9;
    vivi.on = false;
    vivi.o = null;
    npcs.clear();
    wifiPlan();
  });

  G.on('die', () => {
    viviEnd();
    if (wifi.on) {
      wifi.on = false;
      kevent('wifi', 'end');
    }
    wifi.at = -1;
  });

  G.on('spawn', (o) => {
    if (!o || o.deco || G.state.mode !== 'run') return;
    if (o.type === 'voice') run.lastVoiceT = G.state.t;
    else if (o.type === 'vacuum' && VIVI && Math.random() < (Number(VIVI.chance) || 0)) o.viviPlan = true;
    else if (o.type === 'call' && SNEZHOK && !o.face && Math.random() < (Number(SNEZHOK.chance) || 0)) o.face = SNEZHOK_FACE;
  });

  G.on('pass', (o) => {
    if (!o || o.face !== SNEZHOK_FACE || G.state.mode !== 'run') return;
    const B = G.bunny;
    popup(B.x + 26, B.alt + 76, SNEZHOK.popup, '#8fb4ff', 14);
  });

  G.on('smash', (o) => {
    if (!o || G.state.mode !== 'run') return;
    if (o.type === 'voice' && o.stomped) stopWord();
    if (o.type !== 'vacuum' || o.viviHit || !VIVI) return;
    const B = G.bunny;
    if (!o.stomped && Math.abs(o.x - B.x) > 90) return;
    popup(o.x, (o.alt || 0) + 66, VIVI.counted, '#ffd23f', 14);
    viviCount('bunny');
  });

  G.onUpdate((dt) => {
    if (G.state.mode !== 'run') return;
    updateVivi(dt);
    updateWifi();
  }, 26);
})();
