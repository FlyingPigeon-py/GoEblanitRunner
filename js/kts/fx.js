/* KTS-эффекты: реакции канала 🔥🎉❤👍, зелёное конфетти, отклики на KTS-события, глитч вай-фая, огонь ЕБЛАН-РЕЖИМА, салют. Владелец — П8. */
(() => {
  'use strict';
  const G = window.G;
  const K = G.kts;
  if (!K || !K.enabled || !G.fx || typeof G.fx.sprite !== 'function') return;

  K.add('fx', {
    palette: {
      why: '💚 и 🟢 — фирменный зелёный KTS (01, 02)',
      green: '#2fc46b',
      confetti: ['#2fc46b', '#1f9e55', '#7fe0a3', '#c8f5d8', '#ffffff', '#43d17f'],
      salute: ['#2fc46b', '#7fe0a3', '#ffffff', '#c8f5d8'],
      party: ['#2fc46b', '#7fe0a3'],
      glitch: ['#00e5ff', '#ff2bd6', '#2fc46b'],
      fire: ['#ffe14d', '#ff6a1f'],
    },
    reactions: { why: 'топ реакций канала: 🔥 10636, 🎉 7399, ❤ 6493, 👍 1176 (01)', perSec: 10, size: 20 },
    cake: { why: 'торт в каждом забеге: конфетти и 🎉', ref: ['#517'], confetti: 30, party: 2 },
    secret: { flash: 0.22, flashColor: '#eafff0', fire: 3 },
    duck: { glint: 0.45 },
    legendDuck: { why: 'легендарная уточка с огненным хвостом', ref: ['#1732'], rate: 38, fire: 4 },
    frog: { why: 'вдохните-выдохните: зелёные кольца и мягкие края кадра на 4 с', ref: ['#1925'], rings: 3, breath: 4, tint: 0.75 },
    vivi: { why: 'королева Виви сбила пылесос', ref: ['#3192', '#2914'], crown: 28 },
    toxic: { why: 'блокируем бота-токсика', ref: ['#3005'], stamp: ['ЗАБЛОКИРОВАН'], color: '#d8342c' },
    birthday: { why: 'ДР KTS весь ноябрь: конфетти на вехах 13:00 и 18:00', ref: ['#2835', '#2905'], milestones: [240, 540], confetti: 40, salute: 2, start: 22 },
    wifi: { why: 'пророчество сбылось: в офисе умер вай-фай', ref: ['#241'], maxSec: 14, tint: '#7d8aa3', tintA: 0.45 },
    fever: { why: 'в ЕБЛАН-РЕЖИМЕ горит хвост', ref: ['#2213'], rate: 46 },
    nearMiss: { chance: 0.75 },
    record: { party: 3, over: 4 },
    feverCarrot: { chance: 0.5 },
    like: { chance: 0.03 },
    may9: { why: 'традиционная туса на крыше 9 мая: салют в зелёной гамме, без символики', ref: ['#3567'], md: '05-09', loc: 'roof', from: '19:30', to: '20:00', every: [1.4, 2.4] },
  });

  const fx = G.fx;
  const { TAU, LAYER } = G;
  const clamp = G.clamp;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const cfg = (id) => K.get('fx', id);
  const PAL = K.raw('fx', 'palette');
  const GREEN = PAL.green;
  const WHITE = '#ffffff';
  const calm = () => !!G.calm;
  const tier = () => (G.gfx && typeof G.gfx.tier === 'number' ? clamp(Math.round(G.gfx.tier), 0, 2) : 2);
  const TIER_RATE = [0.35, 0.6, 1];
  const tint = (owner, color, a) => {
    if (G.look && typeof G.look.tint === 'function') G.look.tint(owner, color, a);
  };
  const clockOf = (s) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
    return m ? +m[1] * 60 + +m[2] : -1;
  };

  // ---------- иконки: рисуются один раз в offscreen-canvas под текущий масштаб ----------
  const BOX = 32;
  function flamePath(x) {
    x.beginPath();
    x.moveTo(16, 31);
    x.bezierCurveTo(8.5, 31, 4, 25.5, 4.5, 19.5);
    x.bezierCurveTo(5, 14, 9, 11.5, 9.5, 7);
    x.bezierCurveTo(12, 9, 12.5, 12, 12.5, 13.5);
    x.bezierCurveTo(14, 9, 15, 4.5, 18.5, 1.5);
    x.bezierCurveTo(18.5, 6, 22, 9, 24, 12.5);
    x.bezierCurveTo(25, 11, 25.5, 9.5, 25.5, 8.5);
    x.bezierCurveTo(28.5, 12, 28, 18, 27.5, 21);
    x.bezierCurveTo(26.5, 27, 22, 31, 16, 31);
    x.closePath();
  }
  function heartPath(x) {
    x.beginPath();
    x.moveTo(16, 28.5);
    x.bezierCurveTo(9, 23.5, 3, 18.5, 3, 11.5);
    x.bezierCurveTo(3, 7, 6.5, 4, 10, 4);
    x.bezierCurveTo(12.8, 4, 14.8, 5.6, 16, 7.8);
    x.bezierCurveTo(17.2, 5.6, 19.2, 4, 22, 4);
    x.bezierCurveTo(25.5, 4, 29, 7, 29, 11.5);
    x.bezierCurveTo(29, 18.5, 23, 23.5, 16, 28.5);
    x.closePath();
  }
  function drawHeart(x, fill, line) {
    heartPath(x);
    x.fillStyle = fill;
    x.fill();
    x.lineWidth = 1.3;
    x.strokeStyle = line;
    x.stroke();
    x.globalAlpha = 0.55;
    x.fillStyle = WHITE;
    x.beginPath();
    x.ellipse(10.5, 10, 3, 1.8, -0.6, 0, TAU);
    x.fill();
    x.globalAlpha = 1;
  }
  const DRAW = {
    fire(x) {
      flamePath(x);
      const g = x.createLinearGradient(0, 2, 0, 31);
      g.addColorStop(0, '#ff4a1c');
      g.addColorStop(0.55, '#ff7a1a');
      g.addColorStop(1, '#ffa31a');
      x.fillStyle = g;
      x.fill();
      x.lineWidth = 1.3;
      x.strokeStyle = 'rgba(110,28,8,0.75)';
      x.stroke();
      x.beginPath();
      x.moveTo(16, 30.5);
      x.bezierCurveTo(11.5, 30.5, 9.5, 27, 10.5, 23.5);
      x.bezierCurveTo(11.5, 20.5, 14, 19.5, 14.5, 16.5);
      x.bezierCurveTo(17, 18.5, 18, 20.5, 18, 22);
      x.bezierCurveTo(19, 21, 19.5, 20, 19.5, 19);
      x.bezierCurveTo(22, 21.5, 22.5, 25, 21.5, 27.5);
      x.bezierCurveTo(20.5, 29.5, 18.5, 30.5, 16, 30.5);
      x.closePath();
      const gi = x.createLinearGradient(0, 16, 0, 31);
      gi.addColorStop(0, '#ffd23f');
      gi.addColorStop(1, '#fff3b0');
      x.fillStyle = gi;
      x.fill();
    },
    party(x) {
      x.lineWidth = 1.6;
      x.strokeStyle = '#ff5aa5';
      x.beginPath();
      x.moveTo(19.5, 12.5);
      x.bezierCurveTo(19, 7, 24, 9, 24.5, 3.5);
      x.stroke();
      x.strokeStyle = '#3fa9f5';
      x.beginPath();
      x.moveTo(21.5, 15);
      x.bezierCurveTo(25, 12, 27, 16, 30, 11.5);
      x.stroke();
      const bits = [[13.5, 5, '#3fa9f5', 0.5], [28, 4.5, '#ffd23f', -0.4], [29, 21, '#ff5aa5', 0.8], [21.5, 2.5, '#2fc46b', 0.2], [25, 23, '#ffd23f', 0.3], [17, 8.5, '#2fc46b', -0.7]];
      for (const b of bits) {
        x.save();
        x.translate(b[0], b[1]);
        x.rotate(b[3]);
        x.fillStyle = b[2];
        x.fillRect(-1.6, -1, 3.2, 2);
        x.restore();
      }
      const cone = () => {
        x.beginPath();
        x.moveTo(3, 29.5);
        x.lineTo(11, 10.5);
        x.lineTo(22, 21.5);
        x.closePath();
      };
      cone();
      x.fillStyle = '#ffc533';
      x.fill();
      x.save();
      x.clip();
      x.strokeStyle = '#ff5a5f';
      x.lineWidth = 2.6;
      x.beginPath();
      x.moveTo(1.7, 18.8);
      x.lineTo(13.7, 30.8);
      x.moveTo(6.4, 14);
      x.lineTo(18.4, 26);
      x.stroke();
      x.restore();
      cone();
      x.lineWidth = 1.2;
      x.strokeStyle = 'rgba(110,60,0,0.8)';
      x.stroke();
      x.beginPath();
      x.ellipse(16.5, 16, 7.8, 2.4, Math.PI / 4, 0, TAU);
      x.fillStyle = '#e8892a';
      x.fill();
      x.stroke();
    },
    heart(x) { drawHeart(x, '#ff3b4e', 'rgba(120,10,30,0.8)'); },
    green(x) { drawHeart(x, GREEN, 'rgba(10,80,40,0.85)'); },
    like(x) {
      x.lineWidth = 1.3;
      x.strokeStyle = 'rgba(130,80,0,0.85)';
      G.draw.rr(x, 3, 14, 6, 15, 1.5);
      x.fillStyle = '#3f86e0';
      x.fill();
      x.stroke();
      x.fillStyle = '#ffc93c';
      G.draw.rr(x, 9.5, 13, 12, 16, 3);
      x.fill();
      x.stroke();
      x.beginPath();
      x.moveTo(10.5, 14.5);
      x.lineTo(13.5, 4.8);
      x.quadraticCurveTo(15.3, 1.8, 17.6, 3.6);
      x.quadraticCurveTo(18.9, 5, 18.1, 9);
      x.lineTo(17.2, 14.5);
      x.closePath();
      x.fill();
      x.stroke();
      const fw = [11, 10.5, 9.8, 8.6];
      for (let i = 0; i < 4; i++) {
        G.draw.rr(x, 17, 13 + i * 4, fw[i], 4.2, 2);
        x.fill();
        x.stroke();
      }
    },
    crown(x) {
      x.beginPath();
      x.moveTo(4, 26);
      x.lineTo(3.5, 11);
      x.lineTo(10.5, 18);
      x.lineTo(16, 6);
      x.lineTo(21.5, 18);
      x.lineTo(28.5, 11);
      x.lineTo(28, 26);
      x.closePath();
      x.fillStyle = '#ffd23f';
      x.fill();
      x.lineWidth = 1.4;
      x.strokeStyle = 'rgba(130,85,0,0.9)';
      x.stroke();
      x.fillStyle = '#f0a91a';
      x.fillRect(4.6, 21.8, 22.8, 3.6);
      const gem = (cx, cy, r, c) => {
        x.beginPath();
        x.arc(cx, cy, r, 0, TAU);
        x.fillStyle = c;
        x.fill();
        x.lineWidth = 0.9;
        x.stroke();
      };
      gem(3.6, 10, 2.2, '#fff6c9');
      gem(16, 5, 2.4, '#fff6c9');
      gem(28.4, 10, 2.2, '#fff6c9');
      gem(16, 18.2, 2.3, '#ff4d6d');
      gem(9.5, 23.6, 1.3, '#7fd3ff');
      gem(22.5, 23.6, 1.3, '#7fd3ff');
    },
    squeak(x) {
      for (let pass = 0; pass < 2; pass++) {
        x.lineWidth = pass ? 2.4 : 4.4;
        x.strokeStyle = pass ? '#ffe14d' : 'rgba(90,60,0,0.6)';
        for (const r of [7, 12]) {
          x.beginPath();
          x.arc(16, 16, r, Math.PI * 0.78, Math.PI * 1.22);
          x.stroke();
          x.beginPath();
          x.arc(16, 16, r, -Math.PI * 0.22, Math.PI * 0.22);
          x.stroke();
        }
      }
    },
    glint(x) {
      x.beginPath();
      x.moveTo(16, 1.5);
      x.quadraticCurveTo(17.5, 14.5, 30.5, 16);
      x.quadraticCurveTo(17.5, 17.5, 16, 30.5);
      x.quadraticCurveTo(14.5, 17.5, 1.5, 16);
      x.quadraticCurveTo(14.5, 14.5, 16, 1.5);
      x.closePath();
      x.fillStyle = '#fffbe0';
      x.fill();
      x.lineWidth = 1.2;
      x.strokeStyle = '#ffcf33';
      x.stroke();
    },
  };

  const icons = { k: 0, map: Object.create(null) };
  function icon(kind) {
    const k = clamp((G.scale || 1) * (G.dpr || 1), 1, 3);
    if (icons.k !== k) {
      icons.k = k;
      icons.map = Object.create(null);
    }
    let c = icons.map[kind];
    if (c) return c;
    const draw = DRAW[kind];
    if (!draw) return null;
    const px = Math.max(8, Math.ceil(28 * k));
    c = document.createElement('canvas');
    c.width = c.height = px;
    const x = c.getContext('2d');
    if (x) {
      x.scale(px / BOX, px / BOX);
      x.lineJoin = 'round';
      x.lineCap = 'round';
      draw(x);
    }
    icons.map[kind] = c;
    return c;
  }

  // ---------- реакции канала ----------
  const headPt = { x: 0, alt: 0 };
  function head() {
    const h = typeof G.bunnyHead === 'function' ? G.bunnyHead() : null;
    if (h && Number.isFinite(h.x) && Number.isFinite(h.alt)) {
      headPt.x = h.x;
      headPt.alt = h.alt;
    } else {
      headPt.x = G.bunny.x;
      headPt.alt = G.bunny.alt + 40;
    }
    return headPt;
  }
  const tailX = () => G.bunny.x - 26 * G.bunny.size;
  const tailAlt = () => G.bunny.alt + 18 * G.bunny.size;

  const REACTIONS = { fire: 'fire', party: 'party', heart: 'heart', like: 'like', green: 'green' };
  const reactLog = [];
  function react(kind, x, alt, o) {
    const img = REACTIONS[kind] ? icon(REACTIONS[kind]) : null;
    if (!img) return false;
    o = o || {};
    const rc = K.raw('fx', 'reactions');
    if (!Number.isFinite(x) || !Number.isFinite(alt)) {
      const h = head();
      x = h.x + 8;
      alt = h.alt + 14;
    }
    alt = Math.min(alt, G.GROUND - 90);
    const now = G.state.realT;
    while (reactLog.length && now - reactLog[0] > 1) reactLog.shift();
    const n = clamp(Math.round(o.n || 1), 1, 6);
    const size = o.size > 0 ? o.size : rc.size;
    let made = 0;
    for (let i = 0; i < n && reactLog.length < rc.perSec; i++) {
      reactLog.push(now);
      const side = i === 0 ? 0 : i & 1 ? 1 : -1;
      const p = fx.sprite(img, x + side * (6 + i * 4) + rnd(-3, 3), alt + rnd(-3, 5), {
        w: size * rnd(0.88, 1.08),
        vx: side * rnd(6, 16) + rnd(-6, 6),
        vy: calm() ? 36 : rnd(58, 82) - i * 6,
        drag: 0.8,
        life: rnd(1.1, 1.4) + i * 0.08,
        pop: 0.24,
        sway: 16,
        rot: rnd(-0.15, 0.15),
        anchor: o.anchor == null ? 0.25 : o.anchor,
        layer: o.layer || 'front',
      });
      if (p) made++;
    }
    return made > 0;
  }

  function ktsConfetti(n) {
    n = clamp(Math.round(Number(n) || 30), 1, 120);
    const k = calm() ? 0.4 : 1;
    fx.confetti(Math.max(1, Math.round(n * k)), PAL.confetti);
    const img = icon('green');
    const hearts = Math.round((n / 7) * k);
    for (let i = 0; i < hearts; i++) {
      fx.sprite(img, rnd(10, G.W - 10), G.GROUND + 14 + rnd(0, 50), {
        layer: 'screen', w: rnd(9, 13), vx: rnd(-30, 30), vy: rnd(-50, -10), g: 120, drag: 1.6,
        life: rnd(2.8, 3.6), pop: 0, sway: 30, rot: rnd(-0.3, 0.3), vr: rnd(-1.2, 1.2),
      });
    }
    return true;
  }

  // ---------- состояние забега ----------
  let gen = 0;
  const later = (sec, fn) => {
    const g = gen;
    G.after(sec, () => { if (g === gen) fn(); });
  };
  let recordDone = false;
  let fireAcc = 0;
  let legendAcc = 0;
  let glintT = 0;
  let saluteT = 0;
  const breath = { t: -1, dur: 4 };

  const GLITCH_N = 8;
  const wifi = { on: false, k: 0, t: 0, max: 14, next: 0, n: 0 };
  const bSide = new Uint8Array(GLITCH_N), bCol = new Uint8Array(GLITCH_N);
  const bY = new Float32Array(GLITCH_N), bH = new Float32Array(GLITCH_N), bW = new Float32Array(GLITCH_N), bO = new Float32Array(GLITCH_N);
  let noiseTile = null;
  function noise() {
    if (noiseTile) return noiseTile;
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const x = c.getContext('2d');
    if (x && x.createImageData) {
      const img = x.createImageData(24, 24), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() < 0.5 ? 30 : 230;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    }
    noiseTile = c;
    return c;
  }
  function rollBars() {
    const n = calm() ? 4 : 3 + ((Math.random() * 4) | 0);
    wifi.n = n;
    const H = G.H;
    for (let i = 0; i < n; i++) {
      bSide[i] = Math.random() < 0.5 ? 0 : 1;
      bY[i] = rnd(8, Math.max(12, H - 20));
      bH[i] = rnd(2, 7);
      bW[i] = rnd(8, 46);
      bCol[i] = (Math.random() * PAL.glitch.length) | 0;
      bO[i] = rnd(-4, 4);
    }
  }
  function wifiStart() {
    const c = cfg('wifi');
    if (!c) return;
    wifi.on = true;
    wifi.t = 0;
    wifi.max = c.maxSec > 0 ? c.maxSec : 14;
    wifi.next = 0;
    rollBars();
    tint('kts-wifi', c.tint, c.tintA);
  }
  function wifiStop() {
    wifi.on = false;
    tint('kts-wifi', null);
  }

  // ---------- отклики на события ----------
  function onCake(p) {
    const c = cfg('cake');
    if (!c) return;
    ktsConfetti(c.confetti);
    react('party', p.x, p.alt + 10, { n: c.party });
    fx.ring(p.x, p.alt, { r: 46, width: 3, life: 0.45, color: GREEN });
  }

  const isLegend = (p) => {
    if (p.legendary) return true;
    const id = p.spot || p.duck || p.id;
    const d = typeof id === 'string' ? K.raw('ducks', id) : null;
    return !!(d && d.legendary);
  };
  function onDuck(p) {
    if (!cfg('duck')) return;
    fx.sprite(icon('squeak'), p.x, p.alt + 4, { w: 30, life: 0.45, pop: 0.18, anchor: 0.3 });
    fx.sparks(p.x, p.alt, { n: 10, speed: 200, color: '#ffe14d', color2: WHITE });
    fx.ring(p.x, p.alt, { r: 34, width: 2.5, life: 0.3, color: '#ffe14d' });
    const c = cfg('legendDuck');
    if (c && isLegend(p)) {
      react('fire', p.x, p.alt + 8, { n: c.fire });
      fx.flame(p.x, p.alt, { n: calm() ? 4 : 14, vy: 80, spread: 8, size: 6, life: 0.5, color: PAL.fire[0], color2: PAL.fire[1] });
      fx.ring(p.x, p.alt, { r: 60, width: 4, life: 0.45, color: PAL.fire[1] });
      fx.flash(0.18, '#fff1d6');
    }
  }

  function onFrog() {
    const c = cfg('frog');
    if (!c) return;
    const rings = calm() ? 1 : clamp(c.rings | 0, 1, 5);
    for (let i = 0; i < rings; i++) {
      later(i * 0.4, () => {
        const B = G.bunny;
        fx.ring(B.x + 4, B.alt + 22, { from: 10, r: 80 + i * 16, width: 3, life: 1.4, color: GREEN });
      });
    }
    breath.dur = c.breath > 0 ? c.breath : 4;
    breath.t = 0;
  }

  function onCarrot(p) {
    if (G.flag('fever')) {
      const c = cfg('feverCarrot');
      if (c && Math.random() < c.chance) react('heart', p.x, p.alt + 6);
      return;
    }
    const c = cfg('like');
    if (c && Math.random() < c.chance) react('like', p.x, p.alt + 6);
  }

  function vacuumPos(e) {
    if (e && Number.isFinite(e.x)) return { x: e.x, alt: Number.isFinite(e.alt) ? e.alt : 16 };
    const B = G.bunny;
    let best = null;
    for (const o of G.obstacles) {
      if (o.type !== 'vacuum' || o.x < B.x - 60) continue;
      if (!best || o.x < best.x) best = o;
    }
    if (best) return { x: best.x, alt: (best.alt || 0) + (best.h || 16) };
    return { x: B.x + 120, alt: 16 };
  }
  function onVivi(e) {
    const c = cfg('vivi');
    if (!c) return;
    const at = vacuumPos(e);
    fx.sprite(icon('crown'), at.x, at.alt + 30, { w: c.crown, vy: 34, drag: 1.2, life: 1.3, pop: 0.25, anchor: 0.6 });
    fx.sparks(at.x, at.alt + 18, { n: 14, speed: 240, color: '#ffd23f', color2: WHITE });
    fx.stars(at.x, at.alt + 26, calm() ? 2 : 5, { speed: 150, size: 3.6 });
  }

  function onToxicBlocked(e) {
    const c = cfg('toxic');
    if (!c) return;
    let x, alt;
    if (e && Number.isFinite(e.x) && Number.isFinite(e.alt)) {
      x = e.x;
      alt = e.alt;
    } else {
      const h = head();
      x = h.x + 70;
      alt = h.alt + 40;
    }
    const text = K.line('fx.toxic.stamp');
    if (text) fx.stamp(text, { x, alt, color: c.color, rot: -0.12 });
    fx.sparks(x, alt, { n: 12, speed: 220, color: c.color, color2: WHITE });
  }

  function birthdayBurst(c) {
    ktsConfetti(c.confetti);
    react('party', null, null, { n: 3 });
    const shells = calm() ? Math.min(1, c.salute | 0) : c.salute | 0;
    for (let i = 0; i < shells; i++) later(0.2 + i * 0.5, () => fx.salute(null, null, { colors: PAL.salute }));
  }

  G.on('pickup', (p) => {
    if (!p) return;
    const t = p.type;
    if (t === 'cake') onCake(p);
    else if (t === 'duck') onDuck(p);
    else if (t === 'frog' || t === 'toad') onFrog(p);
    else if (t === 'carrot' || t === 'gold') onCarrot(p);
  });

  G.on('kts:secret', () => {
    const c = cfg('secret');
    if (!c) return;
    fx.flash(c.flash, c.flashColor);
    const h = head();
    react('fire', h.x + 8, h.alt + 14, { n: c.fire });
    fx.ring(h.x, h.alt, { r: 56, width: 3, life: 0.5, color: GREEN });
  });

  G.on('kts:event', (e) => {
    if (!e || typeof e.id !== 'string') return;
    if (e.id === 'wifi') {
      if (e.phase === 'start') wifiStart();
      else if (e.phase === 'end') wifiStop();
    } else if (e.id === 'vivi' && e.phase !== 'end') {
      onVivi(e);
    } else if (e.id === 'birthday' && e.phase === 'start') {
      const c = cfg('birthday');
      if (c && c.start > 0) ktsConfetti(c.start);
    }
  });

  G.on('kts:npc', (e) => {
    if (e && e.id === 'toxic' && e.phase === 'blocked') onToxicBlocked(e);
  });

  G.on('milestone', (m) => {
    const c = cfg('birthday');
    if (!c || !m || !Array.isArray(c.milestones) || c.milestones.indexOf(m.min) < 0) return;
    if (!K.event('ktsBirthday')) return;
    birthdayBurst(c);
  });

  G.on('pass', (o, info) => {
    if (!info || !info.near || G.state.mode !== 'run') return;
    const c = cfg('nearMiss');
    if (c && Math.random() < c.chance) react('fire', G.bunny.x - 4, G.bunny.alt + 46, { size: 15 });
  });

  G.on('fever', () => {
    if (cfg('fever')) react('fire', tailX(), tailAlt() + 6, { n: 2 });
  });

  G.on('gameover', (info) => {
    const c = cfg('record');
    if (c && info && info.isRecord) react('party', null, null, { n: c.over, anchor: 0 });
  });

  G.on('die', () => {
    wifiStop();
    breath.t = -1;
    tint('kts-frog', null);
  });

  G.on('start', () => {
    gen++;
    recordDone = false;
    fireAcc = 0;
    legendAcc = 0;
    glintT = 0;
    saluteT = 0;
    breath.t = -1;
    wifi.k = 0;
    wifiStop();
    tint('kts-frog', null);
  });

  G.on('resize', () => {
    icons.k = 0;
    if (wifi.on) rollBars();
  });

  // ---------- кадр ----------
  function updateRecord() {
    const S = G.state;
    if (recordDone || S.mode !== 'run' || !(S.best > 0)) return;
    let score = 0;
    try { score = G.score(); } catch (e) { return; }
    if (!(score > S.best)) return;
    recordDone = true;
    const c = cfg('record');
    if (c) react('party', null, null, { n: c.party });
  }

  function updateFeverTail(rdt) {
    const S = G.state, B = G.bunny;
    const c = cfg('fever');
    if (!c || calm() || S.mode !== 'run' || B.dead || !G.flag('fever')) {
      fireAcc = 0;
      return;
    }
    fireAcc += rdt * c.rate * TIER_RATE[tier()];
    const n = Math.min(4, Math.floor(fireAcc));
    if (n <= 0) return;
    fireAcc -= n;
    const s = B.size;
    fx.flame(tailX(), tailAlt(), { n, vx: -40, vy: 75, life: 0.3, size: 6.5 * s, spread: 3, layer: 'back', anchor: 0.25, color: PAL.fire[0], color2: PAL.fire[1] });
  }

  function updateDucks(rdt) {
    const W = G.W;
    const legend = cfg('legendDuck');
    const glint = cfg('duck');
    glintT -= rdt;
    const doGlint = glint && !calm() && glintT <= 0;
    if (doGlint) glintT = glint.glint;
    let legendLive = null;
    for (const p of G.pickups) {
      if (p.type !== 'duck' || p.taken || p.x < -30 || p.x > W + 30) continue;
      if (doGlint) fx.sprite(icon('glint'), p.x + rnd(-11, 11), p.alt + rnd(-6, 14), { w: rnd(6, 9), life: 0.4, pop: 0.12 });
      if (!legendLive && legend && isLegend(p)) legendLive = p;
    }
    if (!legendLive || calm()) {
      legendAcc = 0;
      return;
    }
    legendAcc += rdt * legend.rate * TIER_RATE[tier()];
    const n = Math.min(4, Math.floor(legendAcc));
    if (n <= 0) return;
    legendAcc -= n;
    fx.flame(legendLive.x - 10, legendLive.alt - 2, { n, vx: -60, vy: 30, life: 0.34, size: 5, spread: 3, anchor: 0.5, color: PAL.fire[0], color2: PAL.fire[1] });
  }

  function updateSalute(rdt) {
    const c = cfg('may9');
    if (!c || G.state.mode !== 'run' || K.today.md !== c.md) return;
    const loc = G.scene && G.scene.loc;
    if (!loc || loc.id !== c.loc) return;
    const m = G.clockMin();
    if (m < clockOf(c.from) || m >= clockOf(c.to)) return;
    saluteT -= rdt;
    if (saluteT > 0) return;
    saluteT = rnd(c.every[0], c.every[1]) * (calm() ? 2 : 1);
    fx.salute(null, null, { colors: PAL.salute });
  }

  function updateBreath(rdt) {
    if (breath.t < 0) return;
    breath.t += rdt;
    const c = cfg('frog');
    if (!c || breath.t >= breath.dur) {
      breath.t = -1;
      tint('kts-frog', null);
      return;
    }
    tint('kts-frog', GREEN, c.tint * Math.sin((Math.PI * breath.t) / breath.dur));
  }

  function updateWifi(rdt) {
    wifi.k += ((wifi.on ? 1 : 0) - wifi.k) * Math.min(1, rdt / 0.3);
    if (!wifi.on && wifi.k < 0.01) {
      wifi.k = 0;
      return;
    }
    if (!wifi.on) return;
    wifi.t += rdt;
    if (wifi.t >= wifi.max) {
      wifiStop();
      return;
    }
    if (!calm() && wifi.t >= wifi.next) {
      wifi.next = wifi.t + rnd(0.08, 0.16);
      rollBars();
    }
  }

  G.onUpdate((dt, realDt) => {
    const rdt = realDt >= 0 ? realDt : dt;
    updateWifi(rdt);
    updateBreath(rdt);
    if (G.state.mode === 'pause') return;
    updateRecord();
    updateFeverTail(rdt);
    updateDucks(rdt);
    updateSalute(rdt);
  }, 71);

  function drawGlitch(ctx) {
    if (wifi.k < 0.01 || !wifi.n) return;
    const W = G.W, a = wifi.k * (calm() ? 0.6 : 1), cols = PAL.glitch;
    for (let i = 0; i < wifi.n; i++) {
      const w = bW[i], h = bH[i], x = bSide[i] ? W - w : 0, y = bY[i];
      ctx.globalAlpha = 0.42 * a;
      ctx.fillStyle = cols[bCol[i]];
      ctx.fillRect(x + bO[i], y, w, h);
      ctx.globalAlpha = 0.34 * a;
      ctx.fillStyle = cols[(bCol[i] + 1) % cols.length];
      ctx.fillRect(x - bO[i], y + h * 0.55, w * 0.8, h * 0.6);
    }
    const tile = noise();
    ctx.globalAlpha = 0.22 * a;
    for (let i = 0; i < Math.min(2, wifi.n); i++) {
      const w = Math.min(bW[i], 24), x = bSide[i] ? W - w : 0;
      ctx.drawImage(tile, 0, 0, 24, 24, x, bY[i] - 6, w, 12);
    }
    ctx.globalAlpha = 1;
  }

  function drawCalmTail(ctx) {
    const S = G.state, B = G.bunny;
    if (!calm() || S.mode !== 'run' || B.dead || !G.flag('fever') || !cfg('fever')) return;
    const img = icon('fire');
    if (!img) return;
    const s = 15 * B.size;
    ctx.translate(tailX(), G.GROUND - tailAlt());
    ctx.rotate(-1.05);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(img, -s / 2, -s * 0.85, s, s);
  }

  G.onRender(LAYER.BUNNY - 0.5, drawCalmTail);
  G.onRender(LAYER.SCREEN + 0.2, drawGlitch);

  const partyBase = fx.palette('party');
  if (partyBase) fx.palette('party', partyBase.concat(PAL.party));

  fx.react = react;
  fx.ktsConfetti = ktsConfetti;
  fx.ktsIcon = icon;
})();
