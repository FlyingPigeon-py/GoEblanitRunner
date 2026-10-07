/* Препятствия: будильник, стопка тасок, созвон, пинг в личку, рабочий ноут, дедлайн, «есть минутка?». Владелец — агент obstacles. */
(() => {
  'use strict';
  const G = window.G;
  const { TAU } = G;
  const { rr, ellipse } = G.draw;
  const clamp = G.clamp;
  const PI = Math.PI;
  const FD = G.FONT_DISPLAY;

  const FACE_INK = '#2a2118';
  const NOTE_COLORS = ['#ffd84d', '#ff9eb5', '#8fd3ff', '#b8f28a'];
  const TAB_COLORS = ['#ff6b4f', '#5b8cff', '#2fbf71'];
  const STAMP_RED = '#d42a1c';
  const PEN_BLUE = 'rgba(36,52,150,0.8)';
  const ALERT_RED = '#ff3b30';
  const PING_BLUE = '#3d8bfd';
  const FLAG_RED = '#e3342f';
  const RIBBON = '#ffcc33';
  const BUBBLE = '#fffdf8';
  const BUBBLE_INK = '#2b2219';
  const BEZEL = '#1c1e24';
  const SCREEN_BG = '#101b26';
  const CART = '#3b3f48';
  const GLOW_FLAT = 'rgb(150,210,255)';
  const HILITE = 'rgba(255,244,220,0.65)';
  const LIGHTS = ['#ff5f57', '#febc2e', '#28c840'];
  const SYNTAX = ['#ff7ab6', '#7fd1ff', '#ffd27a', '#9be37b', '#c3cad6'];
  const CODE = [
    [0, 10, 0, 14, 1],
    [1, 8, 2, 6, 3, 10, 4],
    [1, 12, 1, 8, 4],
    [2, 6, 0, 16, 3],
    [2, 9, 2, 5, 4, 7, 1],
    [1, 4, 4],
    [0, 3, 4],
    [0, 12, 0, 9, 2],
    [1, 7, 3, 12, 1],
    [2, 14, 4, 6, 3],
    [1, 10, 2],
    [0, 5, 4],
  ];
  const CALL_TILES = [
    ['#4f5d7a', '#f2c9a0', '#2e3a55', '#3a2a20'],
    ['#6d4f6e', '#e0a98a', '#a34a5a', '#1f1a17'],
    ['#3f6b5e', '#c98d6a', '#e0b44c', '#5a3a22'],
    ['#7a5a3e', '#f5d3b5', '#3c6aa8', '#c9a15a'],
    ['#53566e', '#bdbab3', '#8a8780', '#8a8780'],
    ['#2f3440', '#c86b4a', '#c86b4a', '#c86b4a'],
  ];

  const FONT = {
    stamp: `700 9px ${FD}`,
    rec: `700 6px ${FD}`,
    ping: `600 11px ${FD}`,
    badge: `700 8px ${FD}`,
    flag: `700 9px ${FD}`,
    askA: `500 9px ${FD}`,
    askB: `700 10.5px ${FD}`,
    chip: `700 12px ${FD}`,
    zzz: `700 10px ${FD}`,
    tag: `700 9px ${FD}`,
  };

  let reduceMotion = !!G.calm;
  let MOTION = reduceMotion ? 0.3 : 1;
  G.on('calm', (v) => {
    reduceMotion = !!v;
    MOTION = reduceMotion ? 0.3 : 1;
  });
  const DASH = [5, 5];
  const NO_DASH = [];

  // ---------- палитра темы ----------
  const EDGE_LIGHT = 'rgba(255,240,220,0.34)';
  const P = {
    dark: false, edge: '', edgeOnDark: '', shadow: '', shadowMul: '', shade: '', winBg: '', winBar: '', glowA: 0.3, glow: null,
    rimDeep: '', rimLine: '', notes: [], lwOb: 1.6, lwNote: 1.3,
  };

  function hexRGB(c) {
    if (typeof c !== 'string') return null;
    const s = c.trim();
    let m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) {
      const n = parseInt(m[1], 16);
      return [n >> 16, (n >> 8) & 255, n & 255];
    }
    m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) return [0, 1, 2].map((i) => parseInt(m[1][i] + m[1][i], 16));
    return null;
  }
  const mixRGBA = (a, b, k, al) => `rgba(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')},${al})`;
  function withAlpha(c, a) {
    const rgb = hexRGB(c);
    return rgb ? `rgba(${rgb.join(',')},${a})` : c;
  }
  const DEEP_TO = [90, 42, 16], LINE_TO = [42, 10, 0], FALLBACK_RGB = [138, 122, 102];
  function rampOf(c) {
    const L = G.look;
    if (L && typeof L.ramp === 'function') {
      try {
        const r = L.ramp(c);
        if (r && typeof r.deep === 'string' && typeof r.line === 'string') return { deep: r.deep, line: withAlpha(r.line, 0.8) };
      } catch (e) {
        G.report('look.ramp', e);
      }
    }
    const rgb = hexRGB(c) || FALLBACK_RGB;
    return { deep: mixRGBA(rgb, DEEP_TO, 0.45, 1), line: mixRGBA(rgb, LINE_TO, 0.75, 0.8) };
  }
  function lw(wu, px) {
    const L = G.look;
    if (L && typeof L.lw === 'function') {
      const v = L.lw(wu, px);
      if (Number.isFinite(v) && v > 0) return v;
    }
    return Math.max(wu, px / (G.scale || 1));
  }
  function refreshWidths() {
    P.lwOb = lw(1.6, 1.5);
    P.lwNote = lw(1.3, 1.2);
  }

  function refreshPalette(e) {
    const dark = e && typeof e.dark === 'boolean' ? e.dark : G.isDark();
    P.dark = dark;
    P.edge = dark ? 'rgba(6,4,2,0.72)' : 'rgba(70,45,22,0.72)';
    P.edgeOnDark = dark ? EDGE_LIGHT : 'rgba(40,26,14,0.82)';
    P.shadow = dark ? 'rgba(0,0,0,0.42)' : 'rgba(70,45,20,0.2)';
    P.shadowMul = dark ? 'rgb(84,86,112)' : 'rgb(150,152,182)';
    P.shade = dark ? 'rgba(0,0,0,0.26)' : 'rgba(90,55,20,0.17)';
    P.winBg = dark ? '#363b47' : '#262a33';
    P.winBar = dark ? '#474d5c' : '#353a47';
    P.glowA = dark ? 0.6 : 0.32;
    const rim = rampOf(G.C.rim);
    P.rimDeep = rim.deep;
    P.rimLine = rim.line;
    P.notes = NOTE_COLORS.map(rampOf);
    refreshWidths();
    const c = G.ctx;
    if (c && c.createRadialGradient) {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, 'rgba(150,215,255,0.9)');
      g.addColorStop(0.45, 'rgba(120,195,255,0.35)');
      g.addColorStop(1, 'rgba(120,195,255,0)');
      P.glow = g;
    }
  }
  refreshPalette();
  G.on('theme', refreshPalette);
  G.on('resize', refreshWidths);

  const isNight = () => !!(G.scene && G.scene.night > 0.5);
  const darkTypeEdge = () => (P.dark || isNight() ? EDGE_LIGHT : P.edgeOnDark);

  function glow(x, alt, r, rgb, a) {
    const L = G.look;
    if (!L || typeof L.glow !== 'function' || a <= 0.01) return;
    try {
      L.glow(x, alt, r, rgb, a);
    } catch (e) {
      G.report('look.glow', e);
    }
  }

  // ---------- общее ----------
  const ramp = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  function backOut(k) {
    const x = k - 1;
    return 1 + 3.2 * x * x * x + 2.2 * x * x;
  }

  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < cr * cr;
  }

  // Тени всех препятствий — одним проходом multiply под актёрами, а не по смене режима на каждый объект.
  const SHADOW = Object.create(null);
  const SH = { x: 0, w: 0, lift: 0 };
  G.onRender(G.LAYER.PICKUPS - 0.5, (ctx) => {
    let first = true;
    for (const o of G.obstacles) {
      const fn = SHADOW[o.type];
      if (!fn || !fn(o, SH)) continue;
      if (SH.x < -60 || SH.x > G.W + 60) continue;
      if (first) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = P.shadowMul;
        first = false;
      }
      const k = 1 / (1 + Math.max(0, SH.lift) / 60);
      ctx.globalAlpha = 0.55 * k;
      ellipse(ctx, SH.x, G.GROUND + 1.5, SH.w * (0.55 + 0.45 * k), 4.2 * k);
    }
  });

  // ---------- призрак и штамп поверх препятствия ----------
  // Отрисовщики сами ставят globalAlpha, поэтому у призрака (o.ghost) они умножают её на GA.
  const GHOST_A = 0.38;
  let GA = 1;
  function ghosted(draw) {
    return (ctx, o) => {
      GA = o.ghost ? GHOST_A : 1;
      if (GA < 1) ctx.globalAlpha = GA;
      draw(ctx, o);
      GA = 1;
    };
  }

  const STAMP_INK = '#d42a1c';
  const stampSprites = new Map();
  const spriteK = () => Math.min(4, Math.max(1, (G.scale || 1) * (G.dpr || 1) * 1.25));
  function stampSprite(text) {
    const k = spriteK();
    let s = stampSprites.get(text);
    if (s && s.k === k) return s;
    if (typeof document === 'undefined' || !document.createElement) return null;
    const meas = G.ctx;
    meas.save();
    meas.font = FONT.tag;
    const tw = meas.measureText(text).width;
    meas.restore();
    const w = Math.ceil(tw + 12), h = 15;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * k));
    c.height = Math.max(1, Math.ceil(h * k));
    const g = c.getContext('2d');
    if (g) {
      g.setTransform(k, 0, 0, k, 0, 0);
      g.fillStyle = 'rgba(255,253,248,0.82)';
      rr(g, 1, 1, w - 2, h - 2, 2.5);
      g.fill();
      g.strokeStyle = STAMP_INK;
      g.lineWidth = 1.6;
      g.stroke();
      g.fillStyle = STAMP_INK;
      g.font = FONT.tag;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 0.6);
    }
    s = { c, w, h, k };
    stampSprites.set(text, s);
    return s;
  }
  const dropStamps = () => stampSprites.clear();
  G.on('fonts', dropStamps);
  G.on('resize', dropStamps);

  function centerAltOf(o, def) {
    if (def.kind === 'air') return (o.fly || 0) + (o.alt || 0);
    if (typeof def.stompTop === 'function') return def.stompTop(o) - 9;
    return (o.alt || 0) + (o.h || 30) / 2;
  }
  G.onRender(G.LAYER.OBSTACLES + 0.5, (ctx) => {
    for (const o of G.obstacles) {
      if (!o.stamp || o.ballistic || o.x < -80 || o.x > G.W + 80) continue;
      const def = G.obstacleTypes[o.type];
      const s = def && stampSprite(String(o.stamp));
      if (!s) continue;
      ctx.save();
      ctx.translate(o.x, G.GROUND - centerAltOf(o, def));
      ctx.rotate(-0.16);
      ctx.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h);
      ctx.restore();
    }
  });

  // ---------- «Отложить»: сплющивание после прыжка сверху ----------
  const SQUASH_T = 0.12;
  function floorOf(o) {
    const def = G.obstacleTypes[o.type];
    if (def && typeof def.floorOf === 'function') return Number(def.floorOf(o)) || 0;
    return o.type === 'call' || o.type === 'minute' ? (o.h || 0) / 2 - (o.fly || 0) : o.type === 'ping' ? -(o.hop || 0) : 0;
  }
  G.on('smash', (o) => {
    if (!o || !o.stomped) return;
    G.knock(o, -G.state.speed, 140, 0);
    o.rot = 0;
    o.squashT = 0;
    o.floor = floorOf(o);
  });

  function squashed(draw, baseAlt) {
    return (ctx, o) => {
      if (!o.stomped) {
        draw(ctx, o);
        return;
      }
      const k = clamp((o.squashT || 0) / SQUASH_T, 0, 1);
      const by = G.GROUND - baseAlt(o);
      ctx.save();
      ctx.translate(o.x, by);
      ctx.scale(1 + 0.3 * k, 1 - 0.65 * k);
      ctx.translate(-o.x, -by);
      draw(ctx, o);
      ctx.restore();
      if (o.type === 'clock') drawZzz(ctx, o.x + o.r * 0.6, by - (o.r * 2 + 6) * 0.35 - 6, o.squashT || 0);
    };
  }

  function drawZzz(ctx, x, y, t) {
    ctx.fillStyle = G.C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = FONT.zzz;
    for (let i = 0; i < 3; i++) {
      const p = reduceMotion ? i / 3 : (t * 0.9 + i / 3) % 1;
      ctx.globalAlpha = Math.min(1, t * 4) * (reduceMotion ? 0.75 : Math.sin(p * PI));
      ctx.fillText('z', x + p * 10 + i * 2, y - p * 18 - i * 3);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- шеврон у правого края: летающее скоро въедет ----------
  const CHEV_T = 0.45;
  const CHEV_DUCK = '#3d8bfd';
  const CHEV_ASK = '#8a909c';
  function chevronAlpha(o) {
    if (o.ballistic || G.state.mode !== 'run') return 0;
    const v = G.state.speed * (o.drift == null ? 1 : o.drift);
    if (!(v > 0)) return 0;
    const tte = (o.x - (o.w || 0) / 2 - G.W) / v;
    if (tte > CHEV_T) return 0;
    return tte > 0 ? clamp((CHEV_T - tte) / 0.15, 0, 1) : clamp(1 + tte / 0.12, 0, 1);
  }
  // dir: 1 — прыгай, −1 — беги под, 0 — ещё не ясно
  function drawChevron(ctx, alt, dir, color, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(G.W - 12, G.GROUND - alt);
    if (!reduceMotion) {
      const s = 1 + 0.07 * Math.sin(G.state.idleT * 11);
      ctx.scale(s, s);
    }
    ctx.fillStyle = color;
    ellipse(ctx, 0, 0, 9, 9);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, TAU);
    ctx.stroke();
    if (dir) {
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-4.2, 2.2 * dir);
      ctx.lineTo(0, -2.4 * dir);
      ctx.lineTo(4.2, 2.2 * dir);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = FONT.chip;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 0.8);
    }
    ctx.restore();
  }

  function bubblePath(ctx, x, y, w, h, r, tx, tw, px, py) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.lineTo(tx + tw, y + h);
    ctx.lineTo(px, py);
    ctx.lineTo(tx, y + h);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const seen = Object.create(null);
  const DEBUT_WEIGHT = 0.5;
  G.on('start', () => {
    for (const k in seen) delete seen[k];
  });
  G.on('spawn', (o) => {
    if (o) seen[o.type] = true;
  });
  function weightFor(id, minT, base, full, rampT) {
    return (t) => (seen[id] ? base + (full - base) * ramp(t, minT, minT + rampT) : DEBUT_WEIGHT);
  }

  G.onUpdate((dt) => {
    if (G.state.mode !== 'run') return;
    for (const o of G.obstacles) {
      if (!o.ballistic) continue;
      o.kt = (o.kt || 0) + dt;
      if (!o.stomped) continue;
      o.squashT = (o.squashT || 0) + dt;
      o.vx = -G.state.speed;
      if (o.alt < o.floor) {
        o.alt = o.floor;
        o.vy = 0;
      }
    }
  }, 25);

  // ---------- телеграф: значок «!» при входе в экран ----------
  const WARN_TIME = 1.1;
  function tickWarn(o, dt) {
    if (!o.warned && o.x - o.w / 2 > G.W + 30) return;
    o.warnT = (o.warnT || 0) + dt;
    if (!o.warned && o.x - o.w / 2 < G.W) {
      o.warned = true;
      G.emit('telegraph', o, G.obstacleTypes[o.type], 'enter');
    }
  }

  function warnChip(ctx, o, topAlt) {
    const t = o.warnT;
    if (o.ballistic || o.ghost || t == null || t >= WARN_TIME) return;
    const a = Math.min(1, (WARN_TIME - t) / 0.3) * clamp((o.x - G.bunny.x - 150) / 80, 0, 1);
    if (a <= 0.01) return;
    const k = t < 0.22 ? Math.max(0.05, backOut(t / 0.22)) : 1;
    const C = G.C;
    ctx.save();
    ctx.translate(Math.min(o.x, G.W - 14), G.GROUND - topAlt - 16);
    if (t < 0.5) {
      const p = t / 0.5;
      ctx.globalAlpha = a * (1 - p);
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 2.2 * (1 - p);
      ctx.beginPath();
      ctx.arc(0, 0, 9 + 16 * p, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = a;
    ctx.scale(k, k);
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.moveTo(-4.5, 6);
    ctx.lineTo(0, 12.5);
    ctx.lineTo(4.5, 6);
    ctx.closePath();
    ctx.fill();
    ellipse(ctx, 0, 0, 8.5, 8.5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 8.5, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = FONT.chip;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 0.8);
    ctx.restore();
  }

  // ---------- будильник ----------
  const MEME_H = ((11 + 56 / 60) / 12) * TAU;
  const MEME_M = (56 / 60) * TAU;

  function clockHand(ctx, angle, len, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-Math.sin(angle) * len * 0.15, Math.cos(angle) * len * 0.15);
    ctx.lineTo(Math.sin(angle) * len, -Math.cos(angle) * len);
    ctx.stroke();
  }

  function ringLines(ctx, r, t, ring) {
    ctx.strokeStyle = G.C.ink;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.3 + r * 0.03;
    for (let k = 0; k < 3; k++) {
      const p = (t * 2.8 + k / 3) % 1;
      const rad = r * (1.05 + 0.7 * p);
      ctx.globalAlpha = ring * (1 - p) * 0.85;
      ctx.beginPath();
      for (let s = -1; s <= 1; s += 2) {
        const a0 = -PI / 2 + s * 0.95 - 0.3;
        ctx.moveTo(Math.cos(a0) * rad, -0.8 * r + Math.sin(a0) * rad);
        ctx.arc(0, -0.8 * r, rad, a0, a0 + 0.6);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function clockLegs(ctx, r) {
    const lo = G.C['rim-lo'];
    ctx.strokeStyle = lo;
    ctx.lineCap = 'round';
    ctx.lineWidth = r * 0.14;
    ctx.beginPath();
    ctx.moveTo(-0.45 * r, 0.75 * r);
    ctx.lineTo(-0.68 * r, r + 4.5);
    ctx.moveTo(0.45 * r, 0.75 * r);
    ctx.lineTo(0.68 * r, r + 4.5);
    ctx.stroke();
    ctx.fillStyle = lo;
    ellipse(ctx, -0.7 * r, r + 5, r * 0.2, r * 0.1);
    ellipse(ctx, 0.7 * r, r + 5, r * 0.2, r * 0.1);
  }

  function clockHammer(ctx, r, swing) {
    const len = 0.55 * r;
    const ex = Math.sin(swing) * len, ey = -0.8 * r - Math.cos(swing) * len;
    ctx.strokeStyle = G.C.metal;
    ctx.lineWidth = r * 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -0.8 * r);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = G.C['rim-lo'];
    ellipse(ctx, ex, ey, r * 0.13, r * 0.1, swing);
  }

  function clockBell(ctx, r, side, jig) {
    const C = G.C, a = side * 0.62 + jig, br = r * 0.44;
    ctx.save();
    ctx.translate(Math.sin(a) * 0.98 * r, -Math.cos(a) * 0.98 * r);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.arc(0, 0, br, PI, TAU);
    ctx.lineTo(br * 1.12, br * 0.22);
    ctx.lineTo(-br * 1.12, br * 0.22);
    ctx.closePath();
    ctx.fillStyle = C.rim;
    ctx.fill();
    ctx.strokeStyle = P.rimLine;
    ctx.lineWidth = P.lwOb * 0.75;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, br, -PI / 2, 0);
    ctx.lineTo(br * 1.12, br * 0.22);
    ctx.lineTo(0, br * 0.22);
    ctx.closePath();
    ctx.fillStyle = P.shade;
    ctx.fill();
    ctx.strokeStyle = HILITE;
    ctx.lineWidth = br * 0.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, br * 0.62, PI * 1.18, PI * 1.42);
    ctx.stroke();
    ctx.fillStyle = C.metal;
    ellipse(ctx, 0, -br - 0.5, br * 0.2, br * 0.2);
    ctx.restore();
  }

  function clockBody(ctx, r) {
    const C = G.C;
    ctx.fillStyle = C.rim;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = P.rimLine;
    ctx.lineWidth = P.lwOb;
    ctx.stroke();
    ctx.fillStyle = P.dark ? P.shade : P.rimDeep;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0.05 * PI, 0.95 * PI);
    ctx.arc(0, -0.18 * r, r * 0.95, 0.9 * PI, 0.1 * PI, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = HILITE;
    ctx.lineWidth = r * 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.93, PI * 1.08, PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = C['rim-lo'];
    ellipse(ctx, 0, 0.04 * r, r * 0.84, r * 0.84);
    ctx.fillStyle = C.face;
    ellipse(ctx, 0, 0, r * 0.76, r * 0.76);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.71, PI * 1.1, PI * 1.9);
    ctx.stroke();
  }

  function clockFace(ctx, r, hA, mA, sA) {
    ctx.strokeStyle = FACE_INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    for (let i = 0; i < 12; i += 3) {
      const a = (i / 12) * TAU, sx = Math.sin(a), cy = -Math.cos(a);
      ctx.moveTo(sx * r * 0.52, cy * r * 0.52);
      ctx.lineTo(sx * r * 0.66, cy * r * 0.66);
    }
    ctx.stroke();
    ctx.lineWidth = r * 0.035;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      if (i % 3 === 0) continue;
      const a = (i / 12) * TAU, sx = Math.sin(a), cy = -Math.cos(a);
      ctx.moveTo(sx * r * 0.59, cy * r * 0.59);
      ctx.lineTo(sx * r * 0.66, cy * r * 0.66);
    }
    ctx.stroke();
    clockHand(ctx, hA, r * 0.4, r * 0.1, FACE_INK);
    clockHand(ctx, mA, r * 0.58, r * 0.065, FACE_INK);
    clockHand(ctx, sA, r * 0.62, r * 0.03, G.C.accent);
    ctx.fillStyle = FACE_INK;
    ellipse(ctx, 0, 0, r * 0.08, r * 0.08);
    ctx.fillStyle = G.C.accent;
    ellipse(ctx, 0, 0, r * 0.035, r * 0.035);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.6, PI * 1.12, PI * 1.36);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ellipse(ctx, Math.cos(PI * 1.46) * r * 0.6, Math.sin(PI * 1.46) * r * 0.6, r * 0.035, r * 0.035);
  }

  SHADOW.clock = (o, sh) => {
    sh.x = o.x;
    sh.w = o.r;
    sh.lift = o.alt || 0;
    return true;
  };

  function drawClock(ctx, o) {
    const r = o.r, t = G.state.idleT, lift = o.alt || 0;
    const ring = o.stomped ? 0 : o.ballistic ? 1 : o.ring || 0;
    let jx = 0, jy = 0, tilt = 0, hA, mA, sA;
    if (ring > 0) {
      const a = ring * MOTION;
      jx = Math.sin(t * 63 + o.seed) * 1.2 * a;
      jy = -Math.abs(Math.sin(t * 29 + o.seed)) * 2 * a;
      tilt = Math.sin(t * 41 + o.seed) * 0.05 * a;
    }
    if (o.hands === 'meme') {
      const ms = Date.now();
      const sec = Math.floor(ms / 1000) % 60, f = (ms % 1000) / 1000;
      hA = MEME_H;
      mA = MEME_M;
      sA = ((sec - 1 + backOut(Math.min(1, f / 0.16))) / 60) * TAU;
      tilt += (sec % 2 ? 0.022 : -0.022) * Math.exp(-f * 9) * MOTION;
    } else {
      hA = o.seed * 0.7 + t * 0.9;
      mA = o.seed + t * (9 + ring * 14);
      sA = o.seed * 2 + t * 20;
    }
    ctx.translate(o.x + jx, G.GROUND - lift - (r + 6) + jy);
    const rot = (o.rot || 0) + tilt;
    if (rot) ctx.rotate(rot);
    if (ring > 0.02) ringLines(ctx, r, t, ring);
    clockLegs(ctx, r);
    const swing = ring > 0 ? Math.sin(t * 38 + o.seed) * 0.75 * Math.min(1, ring * 1.4) : 0;
    clockHammer(ctx, r, swing);
    const buzz = Math.sin(t * 57 + o.seed) * 0.04 * ring * MOTION;
    clockBell(ctx, r, -1, buzz - Math.max(0, -swing - 0.4) * 0.35 * MOTION);
    clockBell(ctx, r, 1, -buzz + Math.max(0, swing - 0.4) * 0.35 * MOTION);
    clockBody(ctx, r);
    clockFace(ctx, r, hA, mA, sA);
  }

  G.registerObstacle({
    id: 'clock',
    kind: 'ground',
    width: 46,
    weight: () => 0.34,
    causes: ['Будильник победил.', 'Время вышло. Как всегда.', 'Тик-так, пора работать.'],
    hitWord: 'ДЗЫНЬ!',
    make(o, opts) {
      o.r = opts.r || (Math.random() < 0.35 ? 23 : 18);
      o.w = o.r * 2;
      o.ring = 0;
      if (opts.hands) o.hands = opts.hands;
    },
    update(o, dt) {
      const d = o.x - G.bunny.x;
      const near = d > -60 && d < 130 + G.state.speed * 0.3;
      if (near && !o.rang) {
        o.rang = true;
        G.emit('clockRing', o);
      }
      o.ring = clamp(o.ring + (near ? dt * 7 : -dt * 2.5), 0, 1);
    },
    hit(o, hb) {
      const dx = o.x - hb.x, dy = (o.alt || 0) + o.r + 6 - hb.y, rr2 = o.r * 0.86 + hb.r;
      return dx * dx + dy * dy < rr2 * rr2;
    },
    stompTop: (o) => (o.alt || 0) + o.r + 6 + 0.86 * o.r,
    draw: squashed(drawClock, (o) => o.alt || 0),
  });

  // ---------- стопка тасок ----------
  const NOTE_STEP = 14;

  function scribble(ctx, x0, y, len, ph) {
    ctx.moveTo(x0, y);
    let x = x0, k = 0;
    const end = x0 + len;
    while (x < end) {
      const nx = Math.min(end, x + 3.2);
      k++;
      ctx.quadraticCurveTo((x + nx) / 2, y + (k & 1 ? 1.6 : -1.6) + Math.sin(ph + k) * 0.4, nx, y);
      x = nx;
    }
  }

  function drawNote(ctx, note, top, ph) {
    ctx.fillStyle = P.shadow;
    ctx.fillRect(-17, -5.5, 38, 15);
    if (note.tab) {
      ctx.fillStyle = note.tab;
      ctx.fillRect(17, -6.5, 6, 5);
    }
    const rp = P.notes[note.ci] || P.notes[0];
    if (rp) {
      ctx.fillStyle = rp.deep;
      ctx.fillRect(-18.5, 8, 33, 1.2);
    }
    ctx.beginPath();
    ctx.moveTo(-19, -8);
    ctx.lineTo(19, -8);
    ctx.lineTo(19, 3);
    ctx.lineTo(14, 8);
    ctx.lineTo(-19, 8);
    ctx.closePath();
    ctx.fillStyle = note.color;
    ctx.fill();
    ctx.strokeStyle = rp ? rp.line : P.edge;
    ctx.lineWidth = P.lwNote;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.fillRect(-18.5, -7.5, 37, 3.2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.moveTo(19, 3);
    ctx.lineTo(14, 3.6);
    ctx.lineTo(14, 8);
    ctx.closePath();
    ctx.fill();
    if (top) {
      ctx.save();
      ctx.rotate(-0.12);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = STAMP_RED;
      ctx.fillStyle = STAMP_RED;
      ctx.lineWidth = 1.3;
      rr(ctx, -16, -6, 32, 12, 1.5);
      ctx.stroke();
      ctx.font = FONT.stamp;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('СРОЧНО', 0, 0.7);
      ctx.restore();
      return;
    }
    ctx.strokeStyle = PEN_BLUE;
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (note.check) ctx.rect(-16.5, -3.2, 3.4, 3.4);
    scribble(ctx, -11, -1.5, note.l1, ph);
    scribble(ctx, -11, 3.6, note.l2, ph + 2);
    ctx.stroke();
  }

  SHADOW.tasks = (o, sh) => {
    sh.x = o.x;
    sh.w = 23;
    sh.lift = o.alt || 0;
    return true;
  };

  function drawTasks(ctx, o) {
    const n = o.n, t = G.state.idleT, lift = o.alt || 0, hh = n * NOTE_STEP + 2;
    const kt = o.ballistic && !o.stomped ? o.kt || 0 : 0;
    ctx.translate(o.x, G.GROUND - lift - hh / 2);
    if (o.rot) ctx.rotate(o.rot);
    const sway = o.ballistic ? 0 : Math.sin(t * 2.3 + o.seed) * MOTION;
    for (let i = 0; i < n; i++) {
      const note = o.notes[i];
      const k = i / Math.max(1, n - 1);
      const spread = kt * (i - (n - 1) / 2);
      ctx.save();
      ctx.translate(note.dx + sway * k * 2.6 + spread * 80, hh / 2 - (i * NOTE_STEP + 8) - kt * i * 25);
      ctx.rotate(note.tilt + sway * k * 0.06 + spread * 5);
      drawNote(ctx, note, i === n - 1, o.seed + i);
      ctx.restore();
    }
  }

  G.registerObstacle({
    id: 'tasks',
    kind: 'ground',
    width: 38,
    weight: () => 0.38,
    causes: ['Тебя завалило тасками.', 'Бэклог настиг.', 'Срочно. Очень срочно. Ещё вчера.'],
    hitWord: 'СРОЧНО!',
    make(o, opts) {
      o.n = Math.max(1, Math.round(opts.n || 3 + Math.floor(Math.random() * (G.state.t > 25 ? 3 : 2))));
      o.w = 34;
      o.h = o.n * NOTE_STEP;
      o.notes = [];
      const base = Math.floor(o.seed);
      for (let i = 0; i < o.n; i++) {
        const ci = (i + base) % NOTE_COLORS.length;
        o.notes.push({
          ci,
          color: NOTE_COLORS[ci],
          tilt: (Math.random() - 0.5) * 0.16,
          dx: (Math.random() - 0.5) * 5,
          l1: 12 + Math.random() * 12,
          l2: 6 + Math.random() * 14,
          tab: Math.random() < 0.35 ? TAB_COLORS[(i + base) % TAB_COLORS.length] : null,
          check: Math.random() < 0.5,
        });
      }
    },
    hit(o, hb) {
      return circleRect(hb.x, hb.y, hb.r, o.x - 16, o.alt || 0, 32, o.n * NOTE_STEP);
    },
    stompTop: (o) => (o.alt || 0) + o.n * NOTE_STEP,
    draw: squashed(drawTasks, (o) => o.alt || 0),
  });

  // ---------- созвон ----------
  const CALL_LEVELS = [28, 104, 210];

  function feather(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  function callWing(ctx, x, y, dir, flap) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.rotate(-(0.3 + 0.45 * (flap * 2 - 1) * MOTION));
    ctx.fillStyle = G.C.bunny;
    ctx.strokeStyle = P.edge;
    ctx.lineWidth = 1;
    feather(ctx, 8, 5.5, 9, 3.4, 0.35);
    feather(ctx, 10.5, 2, 12, 4.2, 0.12);
    feather(ctx, 12, -2, 14.5, 5.2, -0.12);
    ctx.restore();
  }

  function callTile(ctx, x, y, w, h, k, speaking) {
    const tile = CALL_TILES[k], cx = x + w / 2;
    ctx.fillStyle = tile[0];
    rr(ctx, x, y, w, h, 2);
    ctx.fill();
    if (k === 5) {
      ctx.fillStyle = tile[1];
      ellipse(ctx, cx, y + h / 2, 3.6, 3.6);
    } else {
      ctx.fillStyle = tile[2];
      ctx.beginPath();
      ctx.ellipse(cx, y + h, 6, 4.2, 0, PI, TAU);
      ctx.fill();
      ctx.fillStyle = tile[1];
      ellipse(ctx, cx, y + 5, 2.9, 3.1);
      ctx.fillStyle = tile[3];
      if (k === 4) {
        ctx.beginPath();
        ctx.moveTo(cx - 2.9, y + 3.6);
        ctx.lineTo(cx - 2.2, y + 0.6);
        ctx.lineTo(cx - 0.6, y + 2.5);
        ctx.moveTo(cx + 2.9, y + 3.6);
        ctx.lineTo(cx + 2.2, y + 0.6);
        ctx.lineTo(cx + 0.6, y + 2.5);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(cx, y + 4.4, 3, PI, TAU);
        ctx.fill();
      }
    }
    if (speaking) {
      ctx.strokeStyle = '#4cd964';
      ctx.lineWidth = 1.2;
      rr(ctx, x + 0.6, y + 0.6, w - 1.2, h - 1.2, 1.6);
      ctx.stroke();
    }
  }

  SHADOW.call = (o, sh) => {
    if (o.ballistic && !o.stomped) return false;
    sh.x = o.x;
    const standing = o.level === 0 && !o.ballistic;
    sh.w = standing ? 12 : o.w * 0.3;
    sh.lift = standing ? 0 : Math.max(0, o.fly + (o.alt || 0) - (o.stomped ? o.h / 2 : 0));
    return true;
  };

  const ARCH_DASH = [4, 4];
  function callArch(ctx, o) {
    const x0 = o.x - o.w / 2, x1 = o.x + o.w / 2, y = G.GROUND;
    ctx.save();
    ctx.setLineDash(ARCH_DASH);
    ctx.strokeStyle = G.C.muted;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo(o.x, y - 20, x1, y);
    ctx.stroke();
    ctx.restore();
  }

  function callTripod(ctx, o, top, edge) {
    const x = o.x, base = G.GROUND;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, base - 5);
    ctx.moveTo(x - 9, base);
    ctx.lineTo(x, base - 5);
    ctx.lineTo(x + 9, base);
    ctx.moveTo(x, base - 5);
    ctx.lineTo(x + 1.5, base);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 3.6;
    ctx.stroke();
    ctx.strokeStyle = G.C.metal;
    ctx.lineWidth = 1.9;
    ctx.stroke();
  }

  function drawCall(ctx, o) {
    const t = G.state.idleT, lift = o.alt || 0, w = o.w, h = o.h, hw = w / 2, hh = h / 2;
    const live = !o.ballistic, standing = o.level === 0, edge = darkTypeEdge();
    const warn = live && !o.ghost;
    if (warn && o.level !== 2) {
      const a = chevronAlpha(o);
      if (a > 0) drawChevron(ctx, o.fly, standing ? 1 : -1, standing ? G.C.accent : CHEV_DUCK, a);
    }
    if (warn && o.level === 1 && !o.passed) callArch(ctx, o);
    if (live && standing) callTripod(ctx, o, G.GROUND - o.fly - lift + hh - 1, edge);
    const bob = live && !standing ? Math.sin(o.bob + t * 3.2) * 2.5 * MOTION : 0;
    ctx.translate(o.x, G.GROUND - o.fly - lift + bob);
    if (o.rot) ctx.rotate(o.rot);
    if (!standing) {
      const flap = 0.5 + 0.5 * Math.sin(t * 15 + o.bob);
      callWing(ctx, -hw + 9, -hh + 7, -1, flap);
      callWing(ctx, hw - 9, -hh + 7, 1, flap);
    }
    ctx.fillStyle = P.shadow;
    rr(ctx, -hw + 2, -hh + 3, w, h, 7);
    ctx.fill();
    ctx.fillStyle = P.winBg;
    rr(ctx, -hw, -hh, w, h, 7);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = P.lwOb;
    ctx.stroke();
    ctx.fillStyle = P.winBar;
    rr(ctx, -hw + 1.5, -hh + 1.5, w - 3, 8, 5);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = LIGHTS[i];
      ellipse(ctx, -hw + 6.5 + i * 4.6, -hh + 5.5, 1.6, 1.6);
    }
    ctx.globalAlpha = (0.35 + 0.65 * Math.max(0, Math.sin(t * 6 + o.bob))) * GA;
    ctx.fillStyle = ALERT_RED;
    ellipse(ctx, hw - 17, -hh + 5.5, 2.3, 2.3);
    ctx.globalAlpha = GA;
    ctx.fillStyle = '#ffd9d4';
    ctx.font = FONT.rec;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('REC', hw - 13.2, -hh + 5.9);
    const gx = -hw + 3, gy = -hh + 11;
    if (o.face && typeof o.face.draw === 'function') {
      o.face.draw(ctx, gx, gy, w - 6, h - 14, t, o);
    } else {
      const tw = (w - 10) / 3, th = (h - 16) / 2;
      const speaking = Math.floor(t * 1.4 + o.bob) % 6;
      for (let k = 0; k < 6; k++) {
        callTile(ctx, gx + (k % 3) * (tw + 2), gy + Math.floor(k / 3) * (th + 2), tw, th, k, k === speaking);
      }
    }
    if (warn && o.x - hw < G.W) glow(o.x, o.fly + lift, 50, '176,200,255', 0.7);
  }

  G.registerObstacle({
    id: 'call',
    kind: 'air',
    width: 88,
    minT: 10,
    steady: true,
    weight: () => 0.28,
    causes: ['Тебя затащили на созвон.', '«Меня слышно?» К сожалению, да.', 'Созвон на 5 минут. Прошёл час.'],
    hitWord: 'ВЫ НАС СЛЫШИТЕ?',
    make(o, opts) {
      const roll = Math.random();
      const level = opts.level != null ? clamp(Math.round(opts.level) || 0, 0, 2) : roll < 0.45 ? 0 : roll < 0.85 ? 1 : 2;
      o.level = level;
      o.fly = CALL_LEVELS[level];
      o.w = 88;
      o.h = 40;
      o.drift = 1.12;
      o.bob = Math.random() * TAU;
    },
    update(o, dt) {
      tickWarn(o, dt);
    },
    hit(o, hb) {
      const cy = o.fly + (o.alt || 0), bottom = cy - o.h / 2 + 4;
      if (circleRect(hb.x, hb.y, hb.r, o.x - o.w / 2 + 5, bottom, o.w - 10, o.h - 8)) return true;
      return o.level === 0 && circleRect(hb.x, hb.y, hb.r, o.x - 3, o.alt || 0, 6, bottom - (o.alt || 0));
    },
    stompTop: (o) => o.fly + (o.alt || 0) + o.h / 2 - 4,
    draw: ghosted(squashed(drawCall, (o) => o.fly + (o.alt || 0) - o.h / 2)),
  });

  // ---------- пинг в личку ----------
  const PING_BASE = 13, PING_HOP = 50, PING_W = 6.4;

  SHADOW.ping = (o, sh) => {
    sh.x = o.x;
    sh.w = 14;
    sh.lift = Math.max(0, (o.hop || 0) + (o.alt || 0));
    return true;
  };

  function drawPing(ctx, o) {
    const S = G.state, t = S.idleT, lift = o.alt || 0, hop = o.hop || 0;
    if (!o.ballistic && !o.ghost && o.x - 20 < G.W) glow(o.x + 13, lift + hop + PING_BASE + 10, 20, '61,139,253', 0.8);
    warnChip(ctx, o, PING_BASE + PING_HOP + 13);
    if (!o.ballistic && S.mode === 'run') {
      const rel = S.speed * o.drift;
      ctx.fillStyle = PING_BLUE;
      for (let k = 1; k <= 3; k++) {
        const back = k * 0.035;
        const y = PING_BASE + PING_HOP * Math.abs(Math.sin(o.ph - back * PING_W));
        const rad = 4.2 - k * 0.9;
        ctx.globalAlpha = (0.5 - k * 0.13) * MOTION * GA;
        ellipse(ctx, o.x + 6 + rel * back, G.GROUND - lift - y, rad, rad);
      }
      ctx.globalAlpha = GA;
    }
    const s = Math.sin(o.ph), g = Math.abs(s);
    const squash = o.ballistic ? 0 : Math.max(0, 1 - g / 0.22) * MOTION;
    const lean = o.ballistic ? 0 : -Math.cos(o.ph) * (s < 0 ? -1 : 1) * 0.12 * MOTION;
    ctx.translate(o.x, G.GROUND - lift - hop - PING_BASE);
    const rot = (o.rot || 0) + lean;
    if (rot) ctx.rotate(rot);
    if (squash > 0) {
      ctx.translate(0, 11);
      ctx.scale(1 + 0.2 * squash, 1 - 0.22 * squash);
      ctx.translate(0, -11);
    }
    bubblePath(ctx, -15, -11, 30, 22, 7, -7, 6, -12, 16);
    ctx.fillStyle = PING_BLUE;
    ctx.fill();
    ctx.strokeStyle = P.edge;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    rr(ctx, -11, -8.5, 18, 4.5, 2.25);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = FONT.ping;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ау?', 0, 1);
    const wt = o.warnT || 0;
    const pop = !o.ballistic && wt < 0.4 ? 1 + 0.45 * Math.sin((wt / 0.4) * PI) : 1;
    ctx.translate(13, -10);
    ctx.scale(pop, pop);
    ctx.fillStyle = ALERT_RED;
    ellipse(ctx, 0, 0, 5.6, 5.6);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 5.6, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = FONT.badge;
    ctx.fillText('1', 0, 0.6);
  }

  G.registerObstacle({
    id: 'ping',
    kind: 'ground',
    width: 30,
    minT: 15,
    weight: weightFor('ping', 15, 0.1, 0.22, 25),
    causes: ['Ответил на «ау?». Теперь ты в треде.', 'Пинганули. Пришлось сделать вид, что работаешь.', 'Прочитано. Отвертеться не вышло.'],
    hitWord: 'ПИНГ!',
    fx: { debris: 'shards', colors: [PING_BLUE, '#ffffff', ALERT_RED] },
    make(o) {
      o.w = 30;
      o.h = PING_BASE * 2;
      o.hMax = PING_BASE + PING_HOP + 8.5;
      o.drift = 1.15;
      o.ph = Math.random() * PI;
      o.hop = PING_HOP * Math.abs(Math.sin(o.ph));
      o.warnT = 0;
    },
    update(o, dt) {
      tickWarn(o, dt);
      o.ph += dt * PING_W;
      o.hop = PING_HOP * Math.abs(Math.sin(o.ph));
    },
    // Через sec игровых секунд пинг окажется в нижней точке скачка.
    alignTo(o, sec) {
      if (!(sec >= 0) || !Number.isFinite(sec)) return;
      const base = -PING_W * sec;
      o.ph = Math.ceil(-base / PI) * PI + base;
      o.hop = PING_HOP * Math.abs(Math.sin(o.ph));
    },
    hit(o, hb) {
      const cy = (o.alt || 0) + PING_BASE + (o.hop || 0);
      return circleRect(hb.x, hb.y, hb.r, o.x - 12, cy - 8.5, 24, 17);
    },
    stompTop: (o) => (o.alt || 0) + PING_BASE + (o.hop || 0) + 8.5,
    draw: ghosted(squashed(drawPing, (o) => (o.alt || 0) + (o.hop || 0) + 2)),
  });

  // ---------- ноутбук с работой ----------
  const LAP_W = 72, LAP_SCREEN_W = 58, LAP_SCREEN_H = 36, LAP_DECK = 6, LAP_LINE = 4.2;

  function laptopScreen(ctx, o, t, sx, sy, sh) {
    const dx = sx + 3, dy = sy + 3, dw = LAP_SCREEN_W - 6, dh = sh - 5;
    ctx.fillStyle = SCREEN_BG;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, dy, dw, dh);
    ctx.clip();
    const scroll = t * 7 + o.seed * 10;
    const first = Math.floor(scroll / LAP_LINE), off = scroll - first * LAP_LINE;
    const rows = Math.ceil(dh / LAP_LINE) + 1;
    for (let j = 0; j < rows; j++) {
      const line = CODE[(first + j) % CODE.length];
      const y = dy + 1.5 + j * LAP_LINE - off;
      let x = dx + 2 + line[0] * 3.5;
      for (let s = 1; s < line.length; s += 2) {
        ctx.fillStyle = SYNTAX[line[s + 1]];
        ctx.fillRect(x, y, line[s], 1.8);
        x += line[s] + 1.8;
      }
    }
    if ((t * 2.2) % 1 < 0.55) {
      ctx.fillStyle = '#e6edf3';
      ctx.fillRect(dx + 30, dy + dh - 6, 1.4, 3.6);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(dx + dw * 0.55, dy);
    ctx.lineTo(dx + dw, dy);
    ctx.lineTo(dx + dw, dy + dh * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 8);
    ctx.fillStyle = ALERT_RED;
    rr(ctx, dx + dw - 12, dy + 1.5, 10, 4.5, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  SHADOW.laptop = (o, sh) => {
    sh.x = o.x;
    sh.w = 40;
    sh.lift = o.alt || 0;
    return true;
  };

  const lapTop = (o) => LAP_DECK + (LAP_SCREEN_H - 4) * clamp(o.open || 0, 0.08, 1);

  function drawLaptop(ctx, o) {
    const t = G.state.idleT, lift = o.alt || 0;
    const open = o.open || 0, lid = Math.max(0.08, open);
    const sh = LAP_SCREEN_H * lid, lit = Math.min(1, open);
    if (!o.ballistic && o.x - LAP_W / 2 < G.W) glow(o.x, lift + LAP_DECK + sh * 0.5, 44, '159,211,255', 0.8 * lit);
    warnChip(ctx, o, LAP_DECK + LAP_SCREEN_H + 6);
    if (!o.ballistic && lit > 0.05) {
      ctx.globalAlpha = P.glowA * 0.45 * lit;
      ctx.fillStyle = GLOW_FLAT;
      ellipse(ctx, o.x, G.GROUND + 3, 50, 7);
      ctx.globalAlpha = 1;
    }
    ctx.translate(o.x, G.GROUND - lift - 21);
    if (o.rot) ctx.rotate(o.rot);
    ctx.translate(0, 21);
    if (P.glow && lit > 0.05) {
      ctx.save();
      ctx.translate(0, -LAP_DECK - sh * 0.5);
      ctx.scale(50, 32 * lid + 6);
      ctx.globalAlpha = P.glowA * lit;
      ctx.fillStyle = P.glow;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    const sx = -LAP_SCREEN_W / 2, sy = -LAP_DECK - sh;
    ctx.fillStyle = BEZEL;
    rr(ctx, sx, sy, LAP_SCREEN_W, sh + 1, 3.5);
    ctx.fill();
    ctx.strokeStyle = darkTypeEdge();
    ctx.lineWidth = P.lwOb * 0.85;
    ctx.stroke();
    if (sh > 9) {
      laptopScreen(ctx, o, t, sx, sy, sh);
      ctx.fillStyle = '#4a4f5a';
      ellipse(ctx, 0, sy + 1.6, 0.8, 0.8);
    }
    ctx.beginPath();
    ctx.moveTo(-LAP_W / 2, 0);
    ctx.lineTo(LAP_W / 2, 0);
    ctx.lineTo(LAP_W / 2 - 5, -LAP_DECK);
    ctx.lineTo(-LAP_W / 2 + 5, -LAP_DECK);
    ctx.closePath();
    ctx.fillStyle = G.C.metal;
    ctx.fill();
    ctx.strokeStyle = P.edge;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(-LAP_W / 2 + 1, -1.8, LAP_W - 2, 1.8);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-LAP_W / 2 + 6, -LAP_DECK + 0.6, LAP_W - 12, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-6, -1.6, 12, 1.2);
  }

  G.registerObstacle({
    id: 'laptop',
    kind: 'ground',
    width: LAP_W,
    minT: 22,
    weight: weightFor('laptop', 22, 0.08, 0.2, 25),
    causes: ['Открыл ноут «на минутку». Очнулся в Jira.', 'Споткнулся о работу. Классика.', 'Ноут проснулся, а с ним и тимлид.'],
    hitWord: 'РАБОТАЙ!',
    fx: { debris: 'shards', colors: [BEZEL, '#c3bdb2', '#7fd1ff'] },
    make(o) {
      o.w = LAP_W;
      o.h = LAP_DECK + LAP_SCREEN_H;
      o.open = 0;
      o.openT = 0;
      o.warnT = 0;
    },
    update(o, dt) {
      tickWarn(o, dt);
      if (o.warned && o.openT < 1) {
        o.openT += dt;
        o.open = backOut(Math.min(1, o.openT / 0.26));
      }
    },
    hit(o, hb) {
      return circleRect(hb.x, hb.y, hb.r, o.x - 31, o.alt || 0, 62, lapTop(o));
    },
    stompTop: (o) => (o.alt || 0) + lapTop(o),
    draw: squashed(drawLaptop, (o) => o.alt || 0),
  });

  // ---------- дедлайн ----------
  const DL_POLE = 94, FLAG_W = 38, FLAG_H = 22, FLAG_SOLID = 18;
  const FLAG_X0 = 1.8;
  const SOLID_U = [0, 6, 12, FLAG_SOLID];
  const TAIL_U = [FLAG_SOLID - 0.5, 23, 28, 33, FLAG_W];
  const TAIL_JAG = [[0, 0], [-3.2, 0.2], [0.4, 0.42], [-3.4, 0.64], [0.2, 0.84], [-1.6, 1]];

  function flagWave(u, t, seed) {
    const loose = 1 + 0.4 * clamp((u - FLAG_SOLID) / (FLAG_W - FLAG_SOLID), 0, 1);
    return Math.sin(t * 7 + seed - u * 0.17) * 2.4 * (u / FLAG_W) * loose * MOTION;
  }
  const flagTop = (u, t, seed) => -DL_POLE + flagWave(u, t, seed);
  const flagBot = (u, t, seed) => -DL_POLE + FLAG_H + flagWave(u, t, seed) * 0.9 + (u / FLAG_W) * 1.5;

  // Хвост флага — ткань: в хитбокс входят только первые FLAG_SOLID единиц от шеста.
  function deadlineFlag(ctx, t, seed) {
    const x0 = FLAG_X0;
    ctx.beginPath();
    ctx.moveTo(x0 + TAIL_U[0], flagTop(TAIL_U[0], t, seed));
    for (let i = 1; i < TAIL_U.length; i++) ctx.lineTo(x0 + TAIL_U[i], flagTop(TAIL_U[i], t, seed));
    const top = flagTop(FLAG_W, t, seed), bot = flagBot(FLAG_W, t, seed);
    for (const [dx, k] of TAIL_JAG) ctx.lineTo(x0 + FLAG_W + dx, top + (bot - top) * k);
    for (let i = TAIL_U.length - 2; i >= 0; i--) ctx.lineTo(x0 + TAIL_U[i], flagBot(TAIL_U[i], t, seed));
    ctx.closePath();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = FLAG_RED;
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = P.edge;
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.moveTo(x0, flagTop(0, t, seed));
    for (let i = 1; i < SOLID_U.length; i++) ctx.lineTo(x0 + SOLID_U[i], flagTop(SOLID_U[i], t, seed));
    for (let i = SOLID_U.length - 1; i >= 0; i--) ctx.lineTo(x0 + SOLID_U[i], flagBot(SOLID_U[i], t, seed));
    ctx.closePath();
    ctx.fillStyle = FLAG_RED;
    ctx.fill();
    ctx.strokeStyle = P.edge;
    ctx.lineWidth = P.lwOb * 0.75;
    ctx.stroke();

    const mid = FLAG_W / 2;
    ctx.fillStyle = '#ffffff';
    ctx.font = FONT.flag;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ДЕДЛАЙН', x0 + mid, (flagTop(mid, t, seed) + flagBot(mid, t, seed)) / 2 + 0.5);
  }

  function deadlineWheel(ctx, x, angle) {
    const y = -4.5, ca = Math.cos(angle) * 3.4, sa = Math.sin(angle) * 3.4;
    ctx.fillStyle = '#1f2228';
    ellipse(ctx, x, y, 4.5, 4.5);
    ctx.strokeStyle = '#9aa0aa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + ca, y + sa);
    ctx.lineTo(x - ca, y - sa);
    ctx.moveTo(x - sa, y + ca);
    ctx.lineTo(x + sa, y - ca);
    ctx.stroke();
    ctx.fillStyle = G.C.metal;
    ellipse(ctx, x, y, 1.3, 1.3);
  }

  SHADOW.deadline = (o, sh) => {
    sh.x = o.x + 6;
    sh.w = 24;
    sh.lift = o.alt || 0;
    return true;
  };

  function drawDeadline(ctx, o) {
    const C = G.C, t = G.state.idleT, lift = o.alt || 0;
    const flash = reduceMotion ? 0.75 : Math.sin(t * 9 + o.seed) > 0 ? 1 : 0.3;
    if (!o.ballistic && o.x - 20 < G.W) glow(o.x, lift + DL_POLE + 5.5, 30, '255,59,48', flash * 0.6);
    warnChip(ctx, o, DL_POLE + 18);
    ctx.translate(o.x, G.GROUND - lift - 50);
    if (o.rot) ctx.rotate(o.rot);
    ctx.translate(0, 50);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let k = 0; k <= 6; k++) {
      const u = k * 7.5;
      const y = -DL_POLE + 4 + u * 0.18 + Math.sin(t * 9 + o.seed * 2 - u * 0.22) * (0.5 + u * 0.05) * MOTION;
      if (k === 0) ctx.moveTo(1, y);
      else ctx.lineTo(1 + u, y);
    }
    ctx.strokeStyle = P.edge;
    ctx.lineWidth = 4.2;
    ctx.stroke();
    ctx.strokeStyle = RIBBON;
    ctx.lineWidth = 2.6;
    ctx.stroke();

    ctx.fillStyle = C.metal;
    ctx.fillRect(-1.8, -DL_POLE, 3.6, DL_POLE - 9);
    ctx.strokeStyle = P.edge;
    ctx.lineWidth = 1;
    ctx.strokeRect(-1.8, -DL_POLE, 3.6, DL_POLE - 9);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(-1.1, -DL_POLE + 2, 0.9, DL_POLE - 13);

    deadlineFlag(ctx, t, o.seed);

    ctx.fillStyle = CART;
    rr(ctx, -3.2, -DL_POLE - 3, 6.4, 3.4, 1);
    ctx.fill();
    ctx.globalAlpha = flash * 0.35;
    ctx.fillStyle = ALERT_RED;
    ellipse(ctx, 0, -DL_POLE - 5.5, 8, 8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = flash > 0.5 ? '#ff5a4f' : '#b3261e';
    ellipse(ctx, 0, -DL_POLE - 5.5, 3.2, 3.2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ellipse(ctx, -1, -DL_POLE - 6.6, 1, 1);

    ctx.fillStyle = CART;
    rr(ctx, -15, -12, 30, 7.5, 2.5);
    ctx.fill();
    ctx.strokeStyle = darkTypeEdge();
    ctx.lineWidth = 1.1;
    ctx.stroke();
    const wheel = o.x / 4.5;
    deadlineWheel(ctx, -9, wheel);
    deadlineWheel(ctx, 9, wheel);
    if (!o.ballistic && G.state.mode === 'run') {
      const k = (t * 3 + o.seed) % 1;
      ctx.strokeStyle = C.ink;
      ctx.globalAlpha = 0.32 * MOTION;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(19 + k * 3, -10);
      ctx.lineTo(28 + k * 3, -10);
      ctx.moveTo(18 + k * 4, -4);
      ctx.lineTo(33 + k * 4, -4);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  G.registerObstacle({
    id: 'deadline',
    kind: 'ground',
    width: 66,
    minT: 40,
    weight: weightFor('deadline', 40, 0.05, 0.15, 30),
    causes: ['Дедлайн подкрался незаметно.', 'Сдал дедлайн. Себя.', 'Дедлайн был вчера. Ты — сегодня.'],
    hitWord: 'ВЧЕРА!',
    fx: { debris: 'shards', colors: [FLAG_RED, RIBBON, '#c3bdb2'] },
    make(o) {
      o.w = 66;
      o.h = DL_POLE;
      o.drift = 1.1;
      o.warnT = 0;
    },
    update(o, dt) {
      tickWarn(o, dt);
    },
    hit(o, hb) {
      const a = o.alt || 0, top = DL_POLE - 3;
      return (
        circleRect(hb.x, hb.y, hb.r, o.x - 3, a, 6, top) ||
        circleRect(hb.x, hb.y, hb.r, o.x, a + top - FLAG_H + 3, FLAG_SOLID, FLAG_H - 3) ||
        circleRect(hb.x, hb.y, hb.r, o.x - 13, a, 26, 11)
      );
    },
    draw: drawDeadline,
  });

  // ---------- «есть минутка?» ----------
  const ASK_LOW = 26, ASK_HIGH = 116, ASK_MAX = 150, ASK_SPLIT = 70;

  function askGuide(ctx, o, t, lift) {
    const B = G.bunny;
    const x0 = o.x - 40, x1 = Math.max(B.x + 24, x0 - 170);
    if (x0 <= x1) return;
    const y = G.GROUND - (o.locked ? o.lane : o.fly) - lift;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.setLineDash(DASH);
    ctx.lineDashOffset = -t * 40;
    ctx.strokeStyle = o.locked ? G.C.accent : G.C.ink;
    ctx.globalAlpha = o.locked ? 0.7 : 0.28;
    ctx.lineWidth = o.locked ? 2 : 1.4;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    if (o.locked) {
      ctx.setLineDash(NO_DASH);
      ctx.beginPath();
      ctx.moveTo(x1 + 6, y - 5);
      ctx.lineTo(x1, y);
      ctx.lineTo(x1 + 6, y + 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function askAvatar(ctx, o, ax, ay) {
    const B = G.bunny;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, 10.5, 0, TAU);
    ctx.fillStyle = '#d8e3f0';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = '#3c4a66';
    ctx.beginPath();
    ctx.ellipse(ax, ay + 10.5, 8, 6.5, 0, PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(ax - 2.4, ay + 4.2);
    ctx.lineTo(ax + 2.4, ay + 4.2);
    ctx.lineTo(ax, ay + 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = ALERT_RED;
    ctx.beginPath();
    ctx.moveTo(ax - 1, ay + 5);
    ctx.lineTo(ax + 1, ay + 5);
    ctx.lineTo(ax + 1.6, ay + 10.5);
    ctx.lineTo(ax - 1.6, ay + 10.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f2c6a0';
    ellipse(ctx, ax, ay - 1.5, 6, 6.6);
    ctx.fillStyle = '#5a3d2b';
    ctx.beginPath();
    ctx.ellipse(ax, ay - 4.6, 6.4, 4, 0, PI, TAU);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = P.edge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ax, ay, 10.5, 0, TAU);
    ctx.stroke();

    const look = o.ballistic ? 0 : clamp((o.fly - (B.alt + 22)) / 60, -1, 1) * 0.9;
    const px = o.locked ? -1 : -0.6;
    ctx.fillStyle = BUBBLE_INK;
    ellipse(ctx, ax - 2.6 + px, ay - 1.5 + look, 0.95, 0.95);
    ellipse(ctx, ax + 2.6 + px, ay - 1.5 + look, 0.95, 0.95);
    ctx.strokeStyle = BUBBLE_INK;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(ax - 2.6, ay - 1.5, 2.1, 0, TAU);
    ctx.moveTo(ax + 4.7, ay - 1.5);
    ctx.arc(ax + 2.6, ay - 1.5, 2.1, 0, TAU);
    ctx.moveTo(ax - 0.5, ay - 1.7);
    ctx.lineTo(ax + 0.5, ay - 1.7);
    if (o.locked) {
      ctx.moveTo(ax - 4.6, ay - 5.2);
      ctx.lineTo(ax - 1, ay - 4.1);
      ctx.moveTo(ax + 1, ay - 4.1);
      ctx.lineTo(ax + 4.6, ay - 5.2);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ax, ay + 1.4, 2.3, 0.2 * PI, 0.8 * PI);
    ctx.stroke();
  }

  SHADOW.minute = (o, sh) => {
    if (o.ballistic && !o.stomped) return false;
    sh.x = o.x;
    sh.w = 22;
    sh.lift = Math.max(0, o.fly + (o.alt || 0));
    return true;
  };

  function drawAsk(ctx, o) {
    const t = G.state.idleT, lift = o.alt || 0;
    if (!o.ballistic && !o.ghost) {
      const a = chevronAlpha(o);
      if (a > 0) {
        if (o.locked) drawChevron(ctx, o.lane, o.lane < ASK_SPLIT ? 1 : -1, o.lane < ASK_SPLIT ? G.C.accent : CHEV_DUCK, a);
        else drawChevron(ctx, o.fly, 0, CHEV_ASK, a);
      }
      askGuide(ctx, o, t, lift);
    }
    warnChip(ctx, o, o.fly + 24);
    const bob = o.ballistic ? 0 : Math.sin(o.bob + t * 3) * 2 * MOTION;
    ctx.translate(o.x, G.GROUND - o.fly - lift + bob);
    if (o.rot) ctx.rotate(o.rot);
    if (o.locked && !o.ballistic && o.lockT < 0.35) {
      const k = 1 + 0.16 * Math.sin((o.lockT / 0.35) * PI);
      ctx.scale(k, k);
    }
    ctx.fillStyle = P.shadow;
    ctx.save();
    ctx.translate(2, 3);
    bubblePath(ctx, -38, -15, 76, 30, 11, -27, 8, -36, 22);
    ctx.fill();
    ctx.restore();
    bubblePath(ctx, -38, -15, 76, 30, 11, -27, 8, -36, 22);
    ctx.fillStyle = BUBBLE;
    ctx.fill();
    ctx.strokeStyle = P.edge;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    askAvatar(ctx, o, -23, -1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = BUBBLE_INK;
    ctx.font = FONT.askA;
    ctx.fillText('ЕСТЬ', 12, -6);
    ctx.fillStyle = o.locked ? G.C.accent : BUBBLE_INK;
    ctx.font = FONT.askB;
    ctx.fillText('МИНУТКА?', 12, 5.5);
  }

  G.registerObstacle({
    id: 'minute',
    kind: 'air',
    width: 76,
    minT: 30,
    weight: weightFor('minute', 30, 0.07, 0.17, 30),
    causes: ['«Есть минутка?» Минутка длилась три часа.', 'Менеджер поймал тебя в коридоре.', 'Не успел сказать «я на созвоне».'],
    hitWord: 'ЕСТЬ МИНУТКА?',
    fx: { debris: 'paper', colors: [BUBBLE, '#d8e3f0', ALERT_RED] },
    make(o) {
      o.w = 76;
      o.h = 30;
      o.drift = 0.9;
      o.bob = Math.random() * TAU;
      o.fly = clamp(G.bunny.alt + 22, ASK_LOW, ASK_MAX);
      o.lane = o.fly;
      o.locked = false;
      o.lockT = 0;
      o.warnT = 0;
    },
    update(o, dt) {
      tickWarn(o, dt);
      const B = G.bunny;
      if (!o.locked) {
        o.fly += (clamp(B.alt + 22, ASK_LOW, ASK_MAX) - o.fly) * Math.min(1, dt * 3);
        if (o.x - B.x < G.state.speed * o.drift * 0.75 + 50) {
          o.locked = true;
          // Высота фиксируется на одной из двух полос: низкая — перепрыгнуть, высокая — пробежать снизу.
          o.lane = o.fly < ASK_SPLIT ? ASK_LOW : ASK_HIGH;
          G.emit('telegraph', o, G.obstacleTypes[o.type], 'lock');
        }
      } else {
        o.lockT += dt;
        o.fly += (o.lane - o.fly) * Math.min(1, dt * 9);
      }
    },
    hit(o, hb) {
      const cy = o.fly + (o.alt || 0);
      return circleRect(hb.x, hb.y, hb.r, o.x - 32, cy - 11, 64, 22);
    },
    draw: ghosted(drawAsk),
  });

  G.obstacleKit = {
    palette: P,
    motion: () => MOTION,
    calm: () => reduceMotion,
    ghostAlpha: () => GA,
    ghosted,
    squashed,
    tickWarn,
    warnChip,
    circleRect,
    bubblePath,
    glow,
    backOut,
    weightFor,
    darkEdge: darkTypeEdge,
    shadow(id, fn) {
      SHADOW[id] = fn;
    },
  };
})();
