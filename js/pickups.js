/* Подбираемое: морковки, пауэр-апы, их эффекты и индикатор активных бонусов. Владелец — агент pickups. */
(() => {
  'use strict';
  const G = window.G;
  const { TAU, LAYER } = G;
  const { rr, ellipse } = G.draw;
  const PI = Math.PI;

  const CARROT_MIN = 15;
  const GOLD_MIN = 60;
  const RARE_GAP = 12;
  const RARE_RAMP = 14;
  const RARE_MAX = 0.9;
  const MAGNET_RANGE = 280;
  const GRACE_T = 0.6;
  const FLY_T = 0.5;
  const LABEL_T = 2.6;
  const STAMP_T = 1.3;
  const POP_T = 0.4;
  const ORB_R = 19;
  const SLOT_R = 17;
  const SLOT_STEP = 42;
  const HUD_X = 14;
  const HUD_Y = 12;

  const RED = '#e5383b';
  const PAPER = '#fffdf8';
  const GOLD = { body: '#f7c948', shade: 'rgba(150,92,8,0.3)', edge: '#b9861c', leaf: '#b8c94c', leaf2: '#93ab2c', glow: '#ffd23f' };
  const CARROT_SHADE = 'rgba(110,40,0,0.2)';
  const RAINBOW = [];
  for (let i = 0; i < 24; i++) RAINBOW.push(`hsl(${i * 15},90%,60%)`);
  const FONT_PT = `700 13px ${G.FONT_DISPLAY}`;
  const FONT_NAME = `600 15px ${G.FONT_DISPLAY}`;
  const FONT_DESC = `500 11px ${G.FONT_BODY}`;
  const FONT_STAMP = `700 40px ${G.FONT_DISPLAY}`;

  let dark = false;
  let calm = !!G.calm;
  G.on('calm', (v) => { calm = !!v; });

  function rgba(color, a) {
    const s = String(color).trim();
    let r, g, b;
    if (/^#[0-9a-f]{6}$/i.test(s)) {
      r = parseInt(s.slice(1, 3), 16); g = parseInt(s.slice(3, 5), 16); b = parseInt(s.slice(5, 7), 16);
    } else if (/^#[0-9a-f]{3}$/i.test(s)) {
      r = parseInt(s[1] + s[1], 16); g = parseInt(s[2] + s[2], 16); b = parseInt(s[3] + s[3], 16);
    } else {
      const m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
      if (!m) return a > 0.5 ? s : 'rgba(0,0,0,0)';
      r = +m[1]; g = +m[2]; b = +m[3];
    }
    return `rgba(${r},${g},${b},${a})`;
  }

  function rgbOf(color) {
    const m = rgba(color, 1).match(/^rgba\((\d+),(\d+),(\d+)/);
    return m ? m[1] + ',' + m[2] + ',' + m[3] : '255,200,120';
  }

  function makeCanvas(size) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    return c;
  }

  const glowCache = new Map();
  function glowSprite(color) {
    let c = glowCache.get(color);
    if (c) return c;
    c = makeCanvas(64);
    const g = c.getContext('2d');
    if (g) {
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, rgba(color, 0.85));
      grd.addColorStop(0.4, rgba(color, 0.35));
      grd.addColorStop(1, rgba(color, 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
    }
    glowCache.set(color, c);
    return c;
  }

  function raysSprite(colors, n, size) {
    const c = makeCanvas(size);
    const g = c.getContext('2d');
    if (!g) return c;
    const h = size / 2;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU;
      g.fillStyle = colors[i % colors.length];
      g.beginPath();
      g.moveTo(h, h);
      g.arc(h, h, h, a0, a0 + (TAU / n) * 0.55);
      g.closePath();
      g.fill();
    }
    g.globalCompositeOperation = 'destination-in';
    const grd = g.createRadialGradient(h, h, h * 0.1, h, h, h);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(0.45, 'rgba(0,0,0,0.6)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = 'source-over';
    return c;
  }
  let partyRays = null;
  let goldRays = null;
  const party = () => partyRays || (partyRays = raysSprite(RAINBOW.filter((_, i) => i % 2 === 0), 12, 192));
  const golden = () => goldRays || (goldRays = raysSprite(['#ffd84a', '#ffeaa0'], 10, 128));

  function sparkle(ctx, x, y, r) {
    if (r <= 0.3) return;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  }

  const SHADOW_W = { carrot: 9, gold: 11 };
  const SHADOW_POWER_W = 15;

  const CARROT_PAL = {
    light: { shade: '#db6315', line: '#680800', hi: '#f5a74f' },
    dark: { shade: '#e2711c', line: '#5a1500', hi: '#ffbe73' },
  };
  const GOLD_PAL = { base: '#f7c948', shade: '#e0a52a', line: '#7a4a00', hi: '#fff0b0', leaf: '#b8c94c', leaf2: '#93ab2c', leafLine: '#5d6b14' };
  const lineW = () => Math.max(1.3, 1.4 / (G.scale || 1));
  const sprites = { key: '', carrot: null, gold: null };

  function carrotPalette() {
    const C = G.C, look = G.look;
    const base = C.carrot || '#f08a24';
    const fb = dark ? CARROT_PAL.dark : CARROT_PAL.light;
    let r = null;
    if (look && typeof look.ramp === 'function') {
      try { r = look.ramp(base); } catch (e) { r = null; }
    }
    return {
      base,
      shade: (r && r.shade) || fb.shade,
      line: (r && r.line) || fb.line,
      hi: (r && r.hi) || fb.hi,
      leaf: C.leaf || '#4c9a3c',
      leaf2: C.leaf || '#4c9a3c',
      leafLine: '#24521b',
    };
  }
  function carrotBodyPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.quadraticCurveTo(0, -12, 7, -8);
    ctx.lineTo(1.2, 14);
    ctx.quadraticCurveTo(0, 16, -1.2, 14);
    ctx.closePath();
  }
  function carrotLeavesPath(ctx) {
    ctx.beginPath();
    ctx.ellipse(-3.3, -13, 2.5, 6.8, -0.5, 0, TAU);
    ctx.moveTo(3.3 + 2.5, -13);
    ctx.ellipse(3.3, -13, 2.5, 6.8, 0.5, 0, TAU);
    ctx.moveTo(2.6, -14.6);
    ctx.ellipse(0, -14.6, 2.6, 7.6, 0, 0, TAU);
  }
  function bakeCarrot(pal, k) {
    const w = 24, h = 46, ox = 12, oy = 26;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * k));
    c.height = Math.max(1, Math.ceil(h * k));
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.setTransform(k, 0, 0, k, ox * k, oy * k);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const lw = lineW();
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = lw * 2;
      ctx.strokeStyle = pal.leafLine;
      carrotLeavesPath(ctx);
      ctx.stroke();
      ctx.strokeStyle = pal.line;
      carrotBodyPath(ctx);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.leaf;
      ellipse(ctx, -3.3, -13, 2.5, 6.8, -0.5);
      ellipse(ctx, 3.3, -13, 2.5, 6.8, 0.5);
      ctx.fillStyle = pal.leaf2;
      ellipse(ctx, 0, -14.6, 2.6, 7.6, 0);
      const g = ctx.createLinearGradient(-7, 0, 7, 0);
      g.addColorStop(0, pal.base);
      g.addColorStop(0.55, pal.base);
      g.addColorStop(1, pal.shade);
      ctx.fillStyle = g;
      carrotBodyPath(ctx);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-5, -3); ctx.lineTo(-1.5, -2.4);
      ctx.moveTo(1, 3.6); ctx.lineTo(3.4, 3.2);
      ctx.moveTo(-2.4, 8.6); ctx.lineTo(-0.4, 8.4);
      ctx.stroke();
      ctx.strokeStyle = pal.hi;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4.6, -6.4);
      ctx.quadraticCurveTo(-3.6, 0, -1.3, 8.6);
      ctx.stroke();
    }
    return { c, w, h, ox, oy };
  }
  function carrotSprites() {
    const k = Math.min(4, Math.max(1, (G.scale || 1) * (G.dpr || 1) * 1.25));
    const key = (dark ? 'd' : 'l') + k.toFixed(2) + (G.C.carrot || '') + (G.look ? 'L' : '');
    if (sprites.key !== key || !sprites.carrot) {
      sprites.key = key;
      sprites.carrot = bakeCarrot(carrotPalette(), k);
      sprites.gold = bakeCarrot(GOLD_PAL, k);
    }
    return sprites;
  }
  function blitCarrot(ctx, sp, scale) {
    ctx.drawImage(sp.c, -sp.ox * scale, -sp.oy * scale, sp.w * scale, sp.h * scale);
  }
  // Свечение: заявка в общий проход света, без него — ореол только там, где он светится, а не туманит.
  function glowAt(ctx, p, y, r, rgb, a, color, size, dayA) {
    const look = G.look;
    if (look && typeof look.glow === 'function') {
      look.glow(p.x, p.alt, r, rgb, a);
      return;
    }
    const night = G.scene ? Number(G.scene.night) || 0 : 0;
    const k = dark ? 1 : Math.max(dayA || 0, G.clamp((night - 0.3) / 0.3, 0, 1));
    if (k <= 0.01) return;
    ctx.globalAlpha = k * a;
    ctx.drawImage(glowSprite(color), p.x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }
  function outlineColor(def) {
    if (def.lineColor) return def.lineColor;
    const look = G.look;
    let c = null;
    if (look && typeof look.ramp === 'function') {
      try { c = look.ramp(def.color).line; } catch (e) { c = null; }
    }
    def.lineColor = c || rgba(def.color, 1).replace(/rgba\((\d+),(\d+),(\d+),1\)/, (m, r, g, b) => `rgb(${Math.round(r * 0.35)},${Math.round(g * 0.3)},${Math.round(b * 0.35)})`);
    return def.lineColor;
  }

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, TAU);
  }

  function carrot(ctx, body, shade, leaf, leaf2, edge) {
    ctx.fillStyle = leaf;
    ellipse(ctx, -3.3, -13, 2.5, 6.8, -0.5);
    ellipse(ctx, 3.3, -13, 2.5, 6.8, 0.5);
    ctx.fillStyle = leaf2;
    ellipse(ctx, 0, -14.6, 2.6, 7.6, 0);

    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.quadraticCurveTo(0, -12, 7, -8);
    ctx.lineTo(1.2, 14);
    ctx.quadraticCurveTo(0, 16, -1.2, 14);
    ctx.closePath();
    ctx.fill();
    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(3.6, -10);
    ctx.quadraticCurveTo(5.8, -9.4, 7, -8);
    ctx.lineTo(1.2, 14);
    ctx.quadraticCurveTo(0.5, 15, 0, 14.6);
    ctx.closePath();
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-5, -3); ctx.lineTo(-1.5, -2.4);
    ctx.moveTo(1, 3.6); ctx.lineTo(3.4, 3.2);
    ctx.moveTo(-2.4, 8.6); ctx.lineTo(-0.4, 8.4);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-4.6, -6.4);
    ctx.quadraticCurveTo(-3.6, 0, -1.3, 8.6);
    ctx.stroke();
  }

  function iconCoffee(ctx, t, hud) {
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.moveTo(-9.5, -8);
    ctx.lineTo(9.5, -8);
    ctx.lineTo(6.8, 13);
    ctx.quadraticCurveTo(0, 14.5, -6.8, 13);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6b4a33';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = '#b06a3b';
    ctx.beginPath();
    ctx.moveTo(-8.8, -2.5);
    ctx.lineTo(8.8, -2.5);
    ctx.lineTo(7.8, 5);
    ctx.lineTo(-7.8, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAPER;
    ellipse(ctx, -1.1, 0.4, 1.4, 1.4);
    ellipse(ctx, 1.1, 0.4, 1.4, 1.4);
    ctx.beginPath();
    ctx.moveTo(-2.4, 1);
    ctx.lineTo(2.4, 1);
    ctx.lineTo(0, 3.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a3024';
    rr(ctx, -11, -12.5, 22, 4.6, 2.2);
    ctx.fill();
    rr(ctx, -7, -15, 14, 3.4, 1.6);
    ctx.fill();
    if (hud) return;
    ctx.strokeStyle = G.C.muted;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      const x0 = i ? 3 : -3, ph = t * 6 + i * 2;
      ctx.moveTo(x0, -17);
      ctx.quadraticCurveTo(x0 + Math.sin(ph) * 3, -21, x0, -25 - Math.sin(ph * 0.7));
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function redCross(ctx, x, y, s) {
    ctx.fillStyle = RED;
    ctx.fillRect(x - 0.9 * s, y - 2.6 * s, 1.8 * s, 5.2 * s);
    ctx.fillRect(x - 2.6 * s, y - 0.9 * s, 5.2 * s, 1.8 * s);
  }

  function iconSick(ctx) {
    ctx.rotate(-0.1);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    rr(ctx, -9.5, -12, 22, 27, 2.5);
    ctx.fill();
    ctx.fillStyle = PAPER;
    rr(ctx, -11, -13.5, 22, 27, 2.5);
    ctx.fill();
    ctx.strokeStyle = '#aab4bf';
    ctx.lineWidth = 1;
    ctx.stroke();
    redCross(ctx, 0, -6, 1.7);
    ctx.fillStyle = '#b8c2cc';
    ctx.fillRect(-7, 1.5, 14, 1.6);
    ctx.fillRect(-7, 5, 9, 1.6);
    ctx.strokeStyle = 'rgba(47,111,214,0.85)';
    ctx.lineWidth = 1.3;
    circle(ctx, 4.8, 8.8, 3.1);
    ctx.stroke();
  }

  function iconMagnet(ctx, t, hud) {
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#e0352b';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-8.5, 6);
    ctx.lineTo(-8.5, -2);
    ctx.arc(0, -2, 8.5, PI, TAU);
    ctx.lineTo(8.5, 6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -2, 10.6, PI * 1.12, PI * 1.5);
    ctx.stroke();
    ctx.fillStyle = '#e3e7ec';
    ctx.fillRect(-12, 6, 7, 5.5);
    ctx.fillRect(5, 6, 7, 5.5);
    ctx.fillStyle = '#8b95a1';
    ctx.fillRect(-12, 6, 7, 1.2);
    ctx.fillRect(5, 6, 7, 1.2);
    if (hud) return;
    ctx.strokeStyle = G.C.ink;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 9));
    ctx.beginPath();
    ctx.moveTo(-10, 14); ctx.lineTo(-12, 17.5);
    ctx.moveTo(-6.5, 14); ctx.lineTo(-6, 18);
    ctx.moveTo(10, 14); ctx.lineTo(12, 17.5);
    ctx.moveTo(6.5, 14); ctx.lineTo(6, 18);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function featherPath(ctx, len, wid) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-wid, -len * 0.25, -wid * 0.8, -len * 0.75, 0, -len);
    ctx.bezierCurveTo(wid * 0.9, -len * 0.7, wid, -len * 0.25, 0, 0);
  }

  function iconFeather(ctx) {
    ctx.rotate(0.55);
    ctx.translate(0, 14);
    featherPath(ctx, 30, 8);
    ctx.fillStyle = '#d8f1fa';
    ctx.fill();
    ctx.strokeStyle = '#3b8fb0';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(59,143,176,0.45)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let y = -8; y > -26; y -= 5) {
      ctx.moveTo(0.3, y); ctx.lineTo(5, y - 4);
      ctx.moveTo(-0.3, y + 1.5); ctx.lineTo(-5, y - 2.5);
    }
    ctx.stroke();
    ctx.strokeStyle = '#2f7a98';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.4, 4);
    ctx.quadraticCurveTo(1.2, -12, 0, -27);
    ctx.stroke();
  }

  function iconFriday(ctx, t, hud) {
    ctx.rotate(0.08);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    rr(ctx, -10.5, -10.5, 24, 26, 4);
    ctx.fill();
    ctx.fillStyle = PAPER;
    rr(ctx, -12, -12, 24, 26, 4);
    ctx.fill();
    ctx.fillStyle = RED;
    rr(ctx, -12, -12, 24, 10, 4);
    ctx.fill();
    ctx.fillRect(-12, -6, 24, 4);
    ctx.fillStyle = '#4a3a2c';
    ellipse(ctx, -6, -12, 1.7, 2.7);
    ellipse(ctx, 6, -12, 1.7, 2.7);
    ctx.font = FONT_PT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = RED;
    ctx.fillText('ПТ', 0, 6.5);
    if (hud) return;
    for (let i = 0; i < 4; i++) {
      const a = t * 2 + i * 1.57;
      ctx.fillStyle = RAINBOW[(i * 6 + 3) % 24];
      sparkle(ctx, Math.cos(a) * 17, Math.sin(a) * 17, 2.2 + Math.sin(t * 8 + i) * 0.8);
    }
  }

  function iconCancel(ctx) {
    const C = G.C;
    ctx.fillStyle = C.card;
    rr(ctx, -15, -9, 30, 18, 6);
    ctx.fill();
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = C.accent;
    ellipse(ctx, -9.5, 0, 2.6, 2.6);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = C.ink;
    ctx.fillRect(-5, -3.6, 14, 2.4);
    ctx.fillRect(-5, 1.2, 9, 2.4);
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-11, -11); ctx.lineTo(11, 11);
    ctx.moveTo(11, -11); ctx.lineTo(-11, 11);
    ctx.strokeStyle = C.card;
    ctx.lineWidth = 6.5;
    ctx.stroke();
    ctx.strokeStyle = RED;
    ctx.lineWidth = 3.6;
    ctx.stroke();
  }

  function orb(ctx, color, r) {
    circle(ctx, 0, 0, r);
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = G.C.panel;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0, r - 4.5), PI * 1.1, PI * 1.42);
    ctx.stroke();
  }

  const sparkleColor = () => (dark ? '#fff4c2' : '#ffffff');

  const POWER = Object.create(null);
  const RARE = [];
  const active = [];
  const live = Object.create(null);
  let lastRareT = 0;
  let graceT = 0;
  let clock = 0;
  let label = null;
  let labelT = 0;
  let stampT = 0;
  let stampW = 0;
  const STAMP_DEFAULT = 'ОТМЕНЕНО';
  let stampText = STAMP_DEFAULT;
  const pop = { t: 0, x: 0, y: 0, s: 1 };

  function makePool(n) {
    const a = [];
    for (let i = 0; i < n; i++) a.push({ on: false, x: 0, alt: 0, vx: 0, vy: 0, g: 0, k: 0, life: 0, max: 1, r: 0, rot: 0, vr: 0, c: 0 });
    return a;
  }
  const steam = makePool(20);
  const confetti = makePool(36);
  const fluff = makePool(12);
  let steamAcc = 0;
  let confettiAcc = 0;

  function take(pool) {
    for (const q of pool) if (!q.on) { q.on = true; return q; }
    return null;
  }
  function stepPool(pool, dt, dx) {
    for (const q of pool) {
      if (!q.on) continue;
      q.life -= dt;
      if (q.life <= 0) { q.on = false; continue; }
      q.x += q.vx * dt - dx * q.k;
      q.alt += q.vy * dt;
      q.vy -= q.g * dt;
      q.rot += q.vr * dt;
    }
  }
  function clearPool(pool) {
    for (const q of pool) q.on = false;
  }

  const isOn = (id) => !!live[id];

  // Скорость мира меняется плавно, за SPEED_RAMP_T: мгновенный скачок сбивает точку приземления в долгом прыжке.
  const SPEED_RAMP_T = 1.5;
  const speedMods = { coffee: { cur: 1, target: 1, rate: 0 }, friday: { cur: 1, target: 1, rate: 0 } };
  function speedTo(id, target) {
    const m = speedMods[id];
    m.target = target;
    m.rate = Math.abs(target - m.cur) / SPEED_RAMP_T;
  }
  function rampSpeed(dt) {
    for (const id in speedMods) {
      const m = speedMods[id];
      if (m.cur === m.target) continue;
      const step = m.rate * dt;
      m.cur = Math.abs(m.target - m.cur) <= step ? m.target : m.cur + Math.sign(m.target - m.cur) * step;
      G.setMod('speed', id, m.cur === 1 ? null : m.cur);
    }
  }
  function snapSpeed() {
    for (const id in speedMods) {
      const m = speedMods[id];
      m.cur = m.target = 1;
      m.rate = 0;
      G.setMod('speed', id, null);
    }
  }

  function rareWeight(r, t) {
    if (t < r.minT || isOn(r.id)) return 0;
    const k = G.clamp((t - lastRareT - RARE_GAP) / RARE_RAMP, 0, 1);
    if (k <= 0) return 0;
    let total = 0;
    for (const q of RARE) if (t >= q.minT && !isOn(q.id)) total += q.share;
    return total > 0 ? (RARE_MAX * k * r.share) / total : 0;
  }

  function showLabel(def) {
    label = def;
    labelT = 0;
  }

  function activate(id, p) {
    const def = POWER[id];
    if (!def) return;
    if (def.instant) {
      def.start();
      showLabel(def);
      G.emit('powerup', { id, name: def.name, desc: def.desc, duration: 0, instant: true });
      G.emit('powerupEnd', { id, reason: 'instant' });
      return;
    }
    let e = live[id];
    if (e) {
      e.left = def.duration;
      e.bump = 1;
    } else {
      const cam = G.camera || {};
      const fx = p ? p.x + (cam.x || 0) : HUD_X + SLOT_R;
      const fy = p ? G.GROUND - p.alt + (cam.y || 0) : HUD_Y + SLOT_R;
      e = { id, def, left: def.duration, dur: def.duration, born: 0, landed: !p, sx: HUD_X + SLOT_R + active.length * SLOT_STEP, fx, fy, fade: 1, ending: false, bump: p ? 0 : 1 };
      active.push(e);
      live[id] = e;
      def.start();
    }
    showLabel(def);
    G.emit('powerup', { id, name: def.name, desc: def.desc, duration: def.duration });
  }

  function end(e, reason) {
    if (e.ending) return;
    e.ending = true;
    if (live[e.id] === e) delete live[e.id];
    e.def.stop();
    G.emit('powerupEnd', { id: e.id, reason });
  }

  function reset(reason) {
    for (const e of active) end(e, reason);
    if (graceT > 0) G.setFlag('invincible', 'sick-grace', false);
    graceT = 0;
    steamAcc = 0;
    confettiAcc = 0;
  }

  G.registerPickup({
    id: 'carrot',
    radius: 12,
    weight: () => 1,
    magnetic: true,
    draw(ctx, p) {
      const C = G.C, t = G.state.idleT + p.seed;
      const y = G.GROUND - p.alt + Math.sin(t * 5) * (calm ? 1 : 3);
      if (p.pulled) streak(ctx, p, y, C.carrot);
      glowAt(ctx, p, y, 22, '255,160,70', 0.5 * (0.85 + 0.15 * Math.sin(t * 4)), C.carrot, 46, 0);
      ctx.translate(p.x, y);
      ctx.rotate(0.5 + Math.sin(t * 3) * (calm ? 0.05 : 0.15));
      blitCarrot(ctx, carrotSprites().carrot, 1);
      const tw = Math.pow(Math.max(0, Math.sin(t * 2.1)), 6);
      ctx.fillStyle = sparkleColor();
      sparkle(ctx, 6.5, -9, 4.5 * tw);
    },
    collect(p) {
      G.state.stats.carrots++;
      G.addBonus(CARROT_MIN, { x: p.x, alt: p.alt + 18, kind: 'carrot' });
    },
  });

  function rare(id, share, minT) {
    const r = { id, share, minT };
    RARE.push(r);
    return (t) => rareWeight(r, t);
  }

  G.registerPickup({
    id: 'gold',
    radius: 14,
    minT: 8,
    rare: true,
    magnetic: true,
    weight: rare('gold', 0.18, 8),
    draw(ctx, p) {
      const t = G.state.idleT + p.seed;
      const y = G.GROUND - p.alt + Math.sin(t * 4.5) * (calm ? 1 : 3.5);
      if (p.pulled) streak(ctx, p, y, GOLD.body);
      glowAt(ctx, p, y, 28, '255,210,63', 0.6 + 0.1 * Math.sin(t * 5), GOLD.glow, 56, 0.35);
      ctx.translate(p.x, y);
      ctx.save();
      ctx.rotate(calm ? 0 : t * 0.9);
      ctx.globalAlpha = 0.55;
      ctx.drawImage(golden(), -40, -40, 80, 80);
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.rotate(0.5 + Math.sin(t * 3) * (calm ? 0.05 : 0.15));
      blitCarrot(ctx, carrotSprites().gold, 1.15);
      ctx.restore();
      ctx.fillStyle = sparkleColor();
      sparkle(ctx, 10, -14, 5 * Math.pow(Math.max(0, Math.sin(t * 2.6)), 4));
      sparkle(ctx, -11, 6, 4 * Math.pow(Math.max(0, Math.sin(t * 2.6 + 2.1)), 4));
      sparkle(ctx, 4, 16, 3 * Math.pow(Math.max(0, Math.sin(t * 2.6 + 4.2)), 4));
    },
    collect(p) {
      G.state.stats.carrots++;
      G.addBonus(GOLD_MIN, { x: p.x, alt: p.alt + 22, label: '+1 ЧАС', kind: 'gold' });
      if (G.fx && G.fx.burst) G.fx.burst(p.x, p.alt, { n: 14, speed: 170, color: GOLD.body, life: 0.6, size: 3 });
    },
  });

  function power(def) {
    POWER[def.id] = def;
    G.registerPickup({
      id: def.id,
      radius: 16,
      minT: def.minT,
      rare: true,
      power: true,
      name: def.name,
      weight: rare(def.id, def.share, def.minT),
      draw(ctx, p) { drawPowerPickup(ctx, p, def); },
      collect(p) { activate(def.id, p); },
    });
  }

  const ringColor = (def) => (def.id === 'friday' ? RAINBOW[Math.floor(clock * 18) % 24] : def.color);

  function drawPowerPickup(ctx, p, def) {
    const t = G.state.idleT + p.seed;
    const y = G.GROUND - p.alt + Math.sin(t * 4) * (calm ? 1 : 3.5);
    glowAt(ctx, p, y, 26, rgbOf(def.glow || def.color), 0.55 + 0.15 * Math.sin(t * 3), def.glow || def.color, 68, 0.3);
    ctx.translate(p.x, y);
    if (def.id === 'friday') {
      ctx.save();
      ctx.rotate(calm ? 0 : t * 1.2);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(party(), -42, -42, 84, 84);
      ctx.restore();
    }
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = outlineColor(def);
    ctx.lineWidth = lineW();
    circle(ctx, 0, 0, ORB_R + 1.1 + lineW() / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    orb(ctx, ringColor(def), ORB_R);
    ctx.save();
    ctx.rotate(Math.sin(t * 2.5) * (calm ? 0.03 : 0.12));
    ctx.scale(0.82, 0.82);
    def.icon(ctx, t, false);
    ctx.restore();
    const a = t * 2.2;
    ctx.fillStyle = sparkleColor();
    sparkle(ctx, Math.cos(a) * (ORB_R + 3), Math.sin(a) * (ORB_R + 3), 2.6 + Math.sin(t * 7) * 1.2);
  }

  function streak(ctx, p, y, color) {
    const tx = p.x + p.tailX, ty = y + p.tailY;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.restore();
  }

  power({
    id: 'coffee',
    name: 'Третий кофе',
    desc: 'ебланство ×2, лапы бодрее',
    color: '#c8814a',
    glow: '#e0a060',
    duration: 7,
    minT: 10,
    share: 0.2,
    icon: iconCoffee,
    start() {
      G.setMod('score', 'coffee', 2);
      speedTo('coffee', 1.15);
    },
    stop() {
      G.setMod('score', 'coffee', null);
      speedTo('coffee', 1);
    },
  });

  power({
    id: 'sick',
    name: 'Больничный',
    desc: 'первый косяк не считается',
    color: '#3fa7e0',
    duration: 0,
    minT: 14,
    share: 0.17,
    icon: iconSick,
    start() {},
    stop() {},
  });

  power({
    id: 'magnet',
    name: 'Магнитик из Сочи',
    desc: 'морковки липнут сами',
    color: '#e0352b',
    glow: '#ff6b5a',
    duration: 8,
    minT: 12,
    share: 0.15,
    icon: iconMagnet,
    start() { G.setFlag('magnet', 'magnet', true); },
    stop() { G.setFlag('magnet', 'magnet', false); },
  });

  power({
    id: 'feather',
    name: 'Лёгкость бытия',
    desc: 'тройной прыжок',
    color: '#3bb0d0',
    duration: 8,
    minT: 12,
    share: 0.14,
    icon: iconFeather,
    start() {
      G.setMod('jumps', 'feather', 1);
      puffFeathers(4);
    },
    stop() { G.setMod('jumps', 'feather', null); },
  });

  power({
    id: 'friday',
    name: 'Пятница, 18:00',
    desc: 'неуязвим, сносишь всё',
    color: '#ff5fa2',
    glow: '#ffd23f',
    duration: 5,
    minT: 45,
    share: 0.06,
    icon: iconFriday,
    start() {
      G.setFlag('invincible', 'friday', true);
      speedTo('friday', 1.25);
    },
    stop() {
      G.setFlag('invincible', 'friday', false);
      speedTo('friday', 1);
    },
  });

  power({
    id: 'cancel',
    name: 'Созвон отменили',
    desc: 'он мог быть письмом',
    color: RED,
    instant: true,
    minT: 25,
    share: 0.1,
    icon: iconCancel,
    start() {
      const B = G.bunny;
      let n = 0;
      for (const o of G.obstacles) {
        if (o.deco || o.dead || o.x < B.x - 30 || o.x > G.W + 120) continue;
        G.smash(o);
        n++;
      }
      stampT = STAMP_T;
      if (stampText !== STAMP_DEFAULT) {
        stampText = STAMP_DEFAULT;
        stampW = 0;
      }
      if (G.fx && G.fx.shake) G.fx.shake(calm ? 2 : n ? 8 : 3);
    },
    stop() {},
  });

  function shieldCenter() {
    const B = G.bunny, s = B.size;
    pop.x = B.x + 3 * s;
    pop.y = G.GROUND - B.alt - 30 * s;
    pop.s = s;
  }

  function popShield() {
    const e = live.sick;
    if (!e) return;
    end(e, 'used');
    shieldCenter();
    pop.t = POP_T;
    graceT = GRACE_T;
    G.setFlag('invincible', 'sick-grace', true);
    if (G.fx) {
      if (G.fx.shake) G.fx.shake(calm ? 2 : 6);
      if (G.fx.burst) G.fx.burst(G.bunny.x + 3, G.bunny.alt + 30, { n: 14, speed: 200, color: '#8fd3ff', life: 0.45, size: 2.6 });
      if (G.fx.popup) G.fx.popup(G.bunny.x + 30, G.bunny.alt + 78, 'СПРАВКА ЕСТЬ!', { color: '#3fa7e0', size: 16, life: 1 });
    }
  }

  function puffFeathers(n) {
    const B = G.bunny;
    for (let i = 0; i < n; i++) {
      const q = take(fluff);
      if (!q) return;
      q.x = B.x - 8 + Math.random() * 20;
      q.alt = B.alt + 18 + Math.random() * 24;
      q.vx = (Math.random() - 0.5) * 70;
      q.vy = 30 + Math.random() * 50;
      q.g = 90;
      q.k = 0.7;
      q.life = q.max = 0.9 + Math.random() * 0.4;
      q.rot = Math.random() * TAU;
      q.vr = (Math.random() - 0.5) * 5;
    }
  }

  function pull(dt) {
    const hb = G.bunnyHitbox(), dxw = G.state.dx, tail = dt > 0 ? 0.035 / dt : 0;
    for (const p of G.pickups) {
      const def = G.pickupTypes[p.type];
      if (p.taken || !def || !def.magnetic) continue;
      const dx = hb.x - p.x, dy = hb.y - p.alt;
      if (dx > 60 || dx < -MAGNET_RANGE) continue;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > MAGNET_RANGE) continue;
      const k = 1 - d / MAGNET_RANGE;
      const stepLen = Math.min(d, (380 + 1100 * k) * dt);
      const mx = (dx / d) * stepLen, my = (dy / d) * stepLen;
      p.x += mx;
      p.alt = Math.max(6, p.alt + my);
      p.tailX = (dxw - mx) * tail;
      p.tailY = my * tail;
      p.pulled = true;
    }
  }

  function emitters(dt) {
    const B = G.bunny, s = B.size, S = G.state;
    if (live.coffee) {
      steamAcc += dt;
      while (steamAcc > 0.05) {
        steamAcc -= 0.05;
        const q = take(steam);
        if (!q) break;
        q.x = B.x + (4 + Math.random() * 14) * s;
        q.alt = B.alt + (42 + Math.random() * 8) * s;
        q.vx = -30 - Math.random() * 40;
        q.vy = 45 + Math.random() * 45;
        q.g = -20;
        q.k = 0.45;
        q.life = q.max = 0.55 + Math.random() * 0.3;
        q.r = 2.5 + Math.random() * 2.2;
      }
    }
    if (live.friday && S.mode === 'run') {
      confettiAcc += dt;
      const every = calm ? 0.12 : 0.035;
      while (confettiAcc > every) {
        confettiAcc -= every;
        const q = take(confetti);
        if (!q) break;
        q.x = B.x + (Math.random() - 0.5) * 40 * s;
        q.alt = B.alt + (10 + Math.random() * 50) * s;
        q.vx = (Math.random() - 0.5) * 140;
        q.vy = 80 + Math.random() * 200;
        q.g = 560;
        q.k = 0.8;
        q.life = q.max = 0.7 + Math.random() * 0.45;
        q.rot = Math.random() * TAU;
        q.vr = (Math.random() - 0.5) * 16;
        q.c = Math.floor(Math.random() * 8) * 3;
      }
    }
  }

  G.on('spawnPickup', (p, def) => {
    if (def && def.rare) lastRareT = G.state.t;
  });

  G.on('hit', (h) => {
    if (h.cancel || !live.sick) return;
    h.cancel = true;
    popShield();
  });

  G.on('jump', (j) => {
    if (j.n >= 3) puffFeathers(5);
  });

  G.on('smash', () => {
    if (live.friday && G.fx && G.fx.shake && !calm) G.fx.shake(4);
  });

  G.on('die', () => {
    reset('die');
    snapSpeed();
    label = null;
    stampT = 0;
  });

  G.on('start', () => {
    reset('start');
    snapSpeed();
    active.length = 0;
    lastRareT = 0;
    label = null;
    for (const id in POWER) POWER[id].labelW = 0;
    stampT = 0;
    pop.t = 0;
    clearPool(steam);
    clearPool(confetti);
    clearPool(fluff);
  });

  G.on('theme', (e) => {
    dark = !!(e && e.dark);
    glowCache.clear();
    sprites.key = '';
    for (const id in POWER) POWER[id].lineColor = '';
  });

  const remeasure = () => {
    for (const id in POWER) POWER[id].labelW = 0;
    stampW = 0;
    sprites.key = '';
  };
  G.on('resize', remeasure);
  G.on('fonts', remeasure);

  G.onUpdate((dt) => {
    const S = G.state;
    clock += dt;
    for (const p of G.pickups) p.pulled = false;
    if (S.mode === 'run') {
      for (const e of active) {
        if (e.ending || e.dur <= 0) continue;
        e.left -= dt;
        if (e.left <= 0) {
          e.left = 0;
          end(e, 'timeout');
        }
      }
      if (graceT > 0) {
        graceT -= dt;
        if (graceT <= 0) G.setFlag('invincible', 'sick-grace', false);
      }
      rampSpeed(dt);
      if (live.magnet) pull(dt);
      emitters(dt);
    }
    for (let i = active.length - 1; i >= 0; i--) {
      const e = active[i];
      e.born += dt;
      if (!e.landed && e.born >= FLY_T) {
        e.landed = true;
        e.bump = 1;
      }
      e.bump = Math.max(0, e.bump - dt * 4);
      if (e.ending) {
        e.fade -= dt * 5;
        if (e.fade <= 0) active.splice(i, 1);
      }
    }
    const k = Math.min(1, dt * 12);
    for (let i = 0; i < active.length; i++) {
      const e = active[i];
      e.sx += (HUD_X + SLOT_R + i * SLOT_STEP - e.sx) * k;
    }
    if (label) {
      labelT += dt;
      if (labelT > LABEL_T + (label.instant ? 0 : FLY_T)) label = null;
    }
    if (stampT > 0) stampT = Math.max(0, stampT - dt);
    if (pop.t > 0) pop.t = Math.max(0, pop.t - dt);
    const dxw = S.dx;
    stepPool(steam, dt, dxw);
    stepPool(confetti, dt, dxw);
    stepPool(fluff, dt, dxw);
  }, 25);

  function wing(ctx, rot, back) {
    ctx.save();
    ctx.rotate(rot);
    featherPath(ctx, 26, 7);
    ctx.fillStyle = back ? '#b7dfee' : '#e8f7fc';
    ctx.fill();
    ctx.strokeStyle = '#3b8fb0';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(0, -22);
    ctx.stroke();
    ctx.restore();
  }

  G.onRender(LAYER.PICKUPS - 0.4, (ctx) => {
    const GR = G.GROUND, W = G.W;
    let first = true;
    for (const p of G.pickups) {
      if (p.taken || p.x < -40 || p.x > W + 40) continue;
      const def = G.pickupTypes[p.type];
      const w = SHADOW_W[p.type] || (POWER[p.type] ? SHADOW_POWER_W : (def && def.shadowW) || 0);
      if (!w) continue;
      if (first) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgb(70,60,110)';
        first = false;
      }
      const k = 1 / (1 + Math.max(0, p.alt) / 60);
      ctx.globalAlpha = 0.16 * k;
      ellipse(ctx, p.x, GR + 1, w * 1.25, 4.6 * k);
      ctx.globalAlpha = 0.35 * k;
      ellipse(ctx, p.x, GR + 1, w * 0.7 * (0.6 + 0.4 * k), 2.6 * k);
    }
  });

  G.onRender(LAYER.PICKUPS - 1, (ctx) => {
    const e = live.friday;
    if (!e) return;
    const B = G.bunny, s = B.size;
    const flick = e.left < 1.2 && !calm ? (Math.sin(clock * 30) > 0 ? 1 : 0.35) : 1;
    const R = 80 * s * (1 + (calm ? 0 : 0.06 * Math.sin(clock * 8)));
    ctx.translate(B.x + 2 * s, G.GROUND - B.alt - 26 * s);
    ctx.rotate(calm ? 0 : clock * 1.6);
    ctx.globalAlpha = 0.6 * flick;
    ctx.drawImage(party(), -R, -R, R * 2, R * 2);
  });

  G.onRender(LAYER.BUNNY - 1, (ctx) => {
    const B = G.bunny, s = B.size, GROUND = G.GROUND;
    const by = GROUND - B.alt;
    let any = false;
    for (const q of steam) if (q.on) { any = true; break; }
    if (any) {
      ctx.fillStyle = G.C.face;
      for (const q of steam) {
        if (!q.on) continue;
        const f = q.life / q.max;
        ctx.globalAlpha = 0.6 * f;
        ellipse(ctx, q.x, GROUND - q.alt, q.r * (1 + (1 - f) * 1.8), q.r * (1 + (1 - f) * 1.5));
      }
      ctx.globalAlpha = 1;
    }
    if (live.feather) {
      const e = live.feather;
      const air = B.alt > 0.5;
      const flap = calm ? 0 : air ? Math.sin(clock * 22) * 0.45 : Math.sin(clock * 4) * 0.12;
      ctx.save();
      if (e.left < 1.5 && !calm) ctx.globalAlpha = Math.sin(clock * 24) > 0 ? 1 : 0.4;
      ctx.translate(B.x - 8 * s, by - 36 * s);
      ctx.scale(s, s);
      wing(ctx, -1.25 - flap * 0.8, true);
      wing(ctx, -0.85 - flap, false);
      ctx.restore();
    }
  });

  G.onRender(LAYER.BUNNY + 1, (ctx) => {
    const B = G.bunny, GROUND = G.GROUND;
    if (live.magnet) {
      const s = B.size, cx = B.x + 20 * s, cy = GROUND - B.alt - 24 * s;
      const fading = live.magnet.left < 1.5 && !calm && Math.sin(clock * 24) < 0;
      ctx.strokeStyle = '#e0352b';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const ph = calm ? (i + 1) / 4 : (clock * 1.3 + i / 3) % 1;
        ctx.globalAlpha = (1 - ph) * (fading ? 0.12 : 0.42);
        ctx.beginPath();
        ctx.arc(cx, cy, 22 + ph * 70, -0.55, 0.55);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (live.sick) {
      shieldCenter();
      const w = calm ? 0 : Math.sin(clock * 5) * 0.035;
      const rx = 44 * pop.s * (1 + w), ry = 39 * pop.s * (1 - w);
      ctx.beginPath();
      ctx.ellipse(pop.x, pop.y, rx, ry, 0, 0, TAU);
      ctx.fillStyle = dark ? 'rgba(120,200,255,0.12)' : 'rgba(110,190,245,0.16)';
      ctx.fill();
      ctx.strokeStyle = dark ? 'rgba(150,220,255,0.85)' : 'rgba(40,140,210,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(pop.x, pop.y, Math.max(0, rx - 6), Math.max(0, ry - 6), 0, PI * 1.12, PI * 1.38);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ellipse(ctx, pop.x - rx * 0.36, pop.y - ry * 0.7, 2.6, 1.7, -0.5);
      const bx = pop.x + rx * 0.68, by = pop.y - ry * 0.7;
      ctx.fillStyle = PAPER;
      circle(ctx, bx, by, 6);
      ctx.fill();
      ctx.strokeStyle = dark ? 'rgba(150,220,255,0.85)' : 'rgba(40,140,210,0.8)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      redCross(ctx, bx, by, 1.15);
    }
    if (pop.t > 0) {
      const k = 1 - pop.t / POP_T, s = pop.s;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = dark ? 'rgba(150,220,255,1)' : 'rgba(40,140,210,1)';
      ctx.lineWidth = 0.5 + 2.5 * (1 - k);
      ctx.beginPath();
      ctx.ellipse(pop.x, pop.y, 44 * s * (1 + k * 0.6), 39 * s * (1 + k * 0.6), 0, 0, TAU);
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + 0.3, r0 = (48 + k * 40) * s, r1 = r0 + 9 * (1 - k) * s;
        ctx.moveTo(pop.x + Math.cos(a) * r0, pop.y + Math.sin(a) * r0 * 0.9);
        ctx.lineTo(pop.x + Math.cos(a) * r1, pop.y + Math.sin(a) * r1 * 0.9);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const q of confetti) {
      if (!q.on) continue;
      const c = Math.cos(q.rot), sn = Math.sin(q.rot), x = q.x, y = GROUND - q.alt;
      const ax = c * 3.6, ay = sn * 3.6, bx = -sn * 2, by = c * 2;
      ctx.globalAlpha = Math.min(1, (q.life / q.max) * 2.5);
      ctx.fillStyle = RAINBOW[q.c];
      ctx.beginPath();
      ctx.moveTo(x - ax - bx, y - ay - by);
      ctx.lineTo(x + ax - bx, y + ay - by);
      ctx.lineTo(x + ax + bx, y + ay + by);
      ctx.lineTo(x - ax + bx, y - ay + by);
      ctx.closePath();
      ctx.fill();
    }
    for (const q of fluff) {
      if (!q.on) continue;
      ctx.globalAlpha = Math.min(1, (q.life / q.max) * 2);
      ctx.save();
      ctx.translate(q.x + Math.sin(q.rot * 2) * 4, GROUND - q.alt);
      ctx.rotate(1.2 + Math.sin(q.rot) * 0.6);
      featherPath(ctx, 12, 3.5);
      ctx.fillStyle = '#e8f7fc';
      ctx.fill();
      ctx.strokeStyle = '#3b8fb0';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  });

  const easeOut = (k) => 1 - Math.pow(1 - k, 3);

  function drawSlot(ctx, e, x, y) {
    const C = G.C, def = e.def;
    const sc = (e.ending ? Math.max(0, e.fade) : 1) * (1 + 0.25 * e.bump);
    if (sc <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    if (e.ending) ctx.globalAlpha = Math.max(0, e.fade);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    circle(ctx, 0, 1.5, SLOT_R);
    ctx.fill();
    circle(ctx, 0, 0, SLOT_R);
    ctx.fillStyle = C.panel;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    const R = SLOT_R - 2.6;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.line;
    circle(ctx, 0, 0, R);
    ctx.stroke();
    let frac = 1, ringA = 1;
    if (e.dur > 0) frac = G.clamp(e.left / e.dur, 0, 1);
    else if (!calm) ringA = 0.65 + 0.35 * Math.sin(clock * 3);
    const warn = e.dur > 0 && e.left < 1.6 && !e.ending;
    if (warn && !calm && Math.sin(clock * 20) < 0) ringA = 0.35;
    if (frac > 0) {
      ctx.globalAlpha *= ringA;
      ctx.strokeStyle = warn ? C.accent : ringColor(def);
      ctx.beginPath();
      ctx.arc(0, 0, R, -PI / 2, -PI / 2 + TAU * frac);
      ctx.stroke();
      ctx.globalAlpha = e.ending ? Math.max(0, e.fade) : 1;
    }
    ctx.scale(0.6, 0.6);
    def.icon(ctx, clock, true);
    ctx.restore();
  }

  function drawFlying(ctx, e) {
    const k = easeOut(G.clamp(e.born / FLY_T, 0, 1));
    const tx = e.sx, ty = HUD_Y + SLOT_R;
    const x = G.lerp(e.fx, tx, k);
    const y = G.lerp(e.fy, ty, k) - Math.sin(k * PI) * (calm ? 0 : 50);
    const sc = G.lerp(1.15, SLOT_R / ORB_R, k);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    ctx.globalAlpha = 0.5 * (1 - k);
    ctx.drawImage(glowSprite(e.def.glow || e.def.color), -34, -34, 68, 68);
    ctx.globalAlpha = 1;
    orb(ctx, ringColor(e.def), ORB_R);
    ctx.scale(0.82, 0.82);
    e.def.icon(ctx, clock, true);
    ctx.restore();
  }

  function drawLabel(ctx) {
    const C = G.C, def = label;
    const t = labelT - (def.instant ? 0 : FLY_T * 0.6);
    if (t <= 0) return;
    const a = Math.min(1, t / 0.2, (LABEL_T - t) / 0.4);
    if (a <= 0) return;
    if (!def.labelW) {
      ctx.font = FONT_NAME;
      const w1 = ctx.measureText(def.name).width;
      ctx.font = FONT_DESC;
      const w2 = ctx.measureText(def.desc).width;
      def.labelW = Math.max(w1, w2) + 28;
    }
    const x = HUD_X - 2 - (calm ? 0 : (1 - a) * 12);
    const y = active.length ? HUD_Y + SLOT_R * 2 + 8 : HUD_Y;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    rr(ctx, x, y + 2, def.labelW, 40, 12);
    ctx.fill();
    ctx.fillStyle = C.panel;
    rr(ctx, x, y, def.labelW, 40, 12);
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = ringColor(def);
    rr(ctx, x + 8, y + 9, 3.5, 22, 1.75);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = FONT_NAME;
    ctx.fillStyle = C.ink;
    ctx.fillText(def.name, x + 18, y + 18);
    ctx.font = FONT_DESC;
    ctx.fillStyle = C.muted;
    ctx.fillText(def.desc, x + 18, y + 32);
    ctx.globalAlpha = 1;
  }

  function drawStamp(ctx) {
    const k = 1 - stampT / STAMP_T;
    const a = Math.min(1, stampT / 0.4);
    const sc = calm ? 1 : 1 + Math.max(0, 0.18 - k) * 3.5;
    ctx.save();
    ctx.translate(G.W / 2, G.H * 0.4);
    ctx.rotate(-0.12);
    ctx.scale(sc, sc);
    ctx.globalAlpha = 0.9 * a;
    ctx.font = FONT_STAMP;
    if (!stampW) stampW = ctx.measureText(stampText).width;
    const w = stampW + 32;
    const fit = Math.min(1, (G.W - 24) / w);
    if (fit < 1) ctx.scale(fit, fit);
    ctx.strokeStyle = RED;
    ctx.lineWidth = 4;
    rr(ctx, -w / 2, -31, w, 60, 8);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    rr(ctx, -w / 2 + 6, -25, w - 12, 48, 5);
    ctx.stroke();
    ctx.fillStyle = RED;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stampText, 0, 1);
    ctx.restore();
  }

  G.onRender(LAYER.SCREEN, (ctx) => {
    if (!active.length && !label && stampT <= 0) return;
    if (stampT > 0) drawStamp(ctx);
    const y = HUD_Y + SLOT_R;
    for (const e of active) if (e.landed) drawSlot(ctx, e, e.sx, y);
    for (const e of active) if (!e.landed && !e.ending) drawFlying(ctx, e);
    if (label) drawLabel(ctx);
  });

  G.powerups = {
    defs: POWER,
    isActive: isOn,
    left: (id) => (live[id] ? live[id].left : 0),
    give: (id) => activate(id, null),
    register(def) {
      if (!def || !def.id || POWER[def.id] || typeof def.icon !== 'function') return false;
      power(Object.assign({ start() {}, stop() {}, duration: 0, minT: 0, share: 0.1 }, def));
      return true;
    },
    stamp(text) {
      if (!text) return;
      stampText = String(text);
      stampW = 0;
      stampT = STAMP_T;
    },
  };
})();
