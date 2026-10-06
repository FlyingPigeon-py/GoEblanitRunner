/* Улица и транспорт: метро «Опаздываю» и крыша «Закат по расписанию». Владелец — графика C. */
(() => {
  'use strict';
  const G = window.G;
  const { TAU } = G;
  const { rr } = G.draw;

  // ---------- утилиты ----------
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (t) => t * t * (3 - 2 * t);
  const mod = (a, n) => ((a % n) + n) % n;
  function hash(n, salt) {
    let h = Math.imul((n | 0) ^ Math.imul((salt | 0) + 0x632be5ab, 0x27d4eb2d), 0x9e3779b1);
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function parse(str) {
    const out = [136, 136, 136];
    if (typeof str !== 'string') return out;
    const s = str.trim();
    if (s[0] === '#') {
      let h = s.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      const v = parseInt(h.slice(0, 6), 16);
      if (Number.isFinite(v)) {
        out[0] = (v >> 16) & 255;
        out[1] = (v >> 8) & 255;
        out[2] = v & 255;
      }
      return out;
    }
    const m = s.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
    if (m) {
      out[0] = +m[1];
      out[1] = +m[2];
      out[2] = +m[3];
    }
    return out;
  }
  const hexRGB = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function css(c, a) {
    const r = Math.round(c[0]), g = Math.round(c[1]), b = Math.round(c[2]);
    return a === undefined || a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${Math.max(0, a).toFixed(3)})`;
  }
  function rrSub(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function circle(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, Math.max(0, r), 0, TAU);
    c.fill();
  }

  let calm = !!G.calm;
  G.on('calm', (v) => { calm = !!v; });
  const tierOf = (L) => (L && Number.isFinite(L.tier) ? L.tier : G.gfx && Number.isFinite(G.gfx.tier) ? G.gfx.tier : 2);
  const isDark = (kit) => (kit && typeof kit.dark === 'boolean' ? kit.dark : G.isDark());
  const marginOf = (kit) => (kit && Number.isFinite(kit.M) ? kit.M : 60);

  // Цвет под тему, как P.ph у сцены: в тёмной теме смесь со стеной.
  function phOf(dark) {
    const wall = parse(G.C.wall || '#eadcc4');
    return (n, k) => css(dark ? mix(hexRGB(n), wall, k === undefined ? 0.45 : k) : hexRGB(n));
  }
  function mkOwn(w, h, ox, oy, draw, k) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * k));
    c.height = Math.max(1, Math.ceil(h * k));
    const sp = { c, w: c.width / k, h: c.height / k, ox, oy, k };
    const x = c.getContext('2d');
    if (x) {
      x.setTransform(k, 0, 0, k, ox * k, oy * k);
      x.lineCap = 'round';
      x.lineJoin = 'round';
      draw(x, sp);
    }
    return sp;
  }
  function kOf(kit) {
    const k = kit && Number.isFinite(kit.K) ? kit.K : (G.scale || 1) * (G.dpr || 1);
    return Math.min(3, Math.max(0.75, k));
  }
  function mk(kit, w, h, ox, oy, draw, k) {
    const kk = k || kOf(kit);
    if (kit && typeof kit.mk === 'function') return kit.mk(w, h, ox, oy, draw, kk);
    return mkOwn(w, h, ox, oy, draw, kk);
  }
  const blit = (ctx, sp, x, y) => ctx.drawImage(sp.c, x - sp.ox, y - sp.oy, sp.w, sp.h);
  function silhouetteOf(kit, sp, color) {
    return mk(kit, sp.w, sp.h, sp.ox, sp.oy, (c) => {
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(sp.c, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = color;
      c.fillRect(0, 0, sp.c.width, sp.c.height);
      c.restore();
    }, sp.k);
  }
  function txt(c, s, x, y, weight, size, family, color, maxW, align) {
    G.draw.font(c, weight, size, family);
    if (maxW) {
      const w = c.measureText(s).width;
      if (w > maxW) G.draw.font(c, weight, Math.max(1, (size * maxW) / w), family);
    }
    c.textAlign = align || 'center';
    c.textBaseline = 'middle';
    c.fillStyle = color;
    c.fillText(s, x, y);
  }
  function softDisc(kit, rgb, size, k) {
    return mk(kit, size, size, size / 2, size / 2, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, size / 2);
      g.addColorStop(0, `rgba(${rgb},1)`);
      g.addColorStop(0.35, `rgba(${rgb},0.45)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      c.fillStyle = g;
      c.fillRect(-size / 2, -size / 2, size, size);
    }, k || 1);
  }
  function pushPane(x, y, w, h, key) {
    const kit = G.sceneKit;
    if (kit && typeof kit.pushPane === 'function') kit.pushPane(x, y, w, h, key);
  }
  function pushLight(kind, x, y, w, h, ang, a, r, g, b) {
    const kit = G.sceneKit;
    if (kit && typeof kit.pushLight === 'function') kit.pushLight(kind, x, y, w, h, ang, a, r, g, b);
  }
  function preComp(rgb) {
    const kit = G.sceneKit;
    if (kit && typeof kit.preComp === 'function') {
      const v = kit.preComp(rgb);
      if (typeof v === 'string' && v) return v;
    }
    return css(rgb);
  }
  // Общая геометрия кадра для хуков: L может прийти неполным.
  function frame(L) {
    const S = G.state;
    const f = FR;
    f.W = Number.isFinite(L.W) ? L.W : G.W;
    f.H = Number.isFinite(L.H) ? L.H : G.H;
    f.GR = Number.isFinite(L.GR) ? L.GR : G.GROUND;
    f.M = Number.isFinite(L.M) ? L.M : 60;
    f.dist = Number.isFinite(L.dist) ? L.dist : S.dist;
    f.u = f.dist - (Number.isFinite(L.d0) ? L.d0 : 0);
    f.t = Number.isFinite(L.t) ? L.t : S.realT;
    f.clock = Number.isFinite(L.clock) ? L.clock : G.clockMin();
    f.dark = typeof L.dark === 'boolean' ? L.dark : G.isDark();
    f.F = L.F || EMPTY_F;
    f.R = L.R || {};
    f.runX = (G.cfg && G.cfg.runX) || 96;
    return f;
  }
  const FR = { W: 0, H: 0, GR: 0, M: 60, dist: 0, u: 0, t: 0, clock: 0, dark: false, F: null, R: null, runX: 96 };
  const EMPTY_F = { night: 0, sunset: 0, lamp: 0, sunA: 0, moonA: 0, starA: 0, rain: 0, snow: 0 };
  const scroll = (f, par) => f.u * par - f.runX;

  function register(def) {
    if (typeof G.registerLocation !== 'function') return false;
    G.registerLocation(def);
    return true;
  }

  // ============================================================
  // МЕТРО «Опаздываю»
  // ============================================================
  const MT = {
    PAR_WALL: 0.88, PAR_RAIL: 0.8, PAR_BACK: 0.95, PAR_FRONT: 1.45,
    STEP: 200, WIN_X: 40, WIN_W: 120, WIN_H: 72, WIN_LO: 120, WIN_HI: 192,
    RAIL: 300, BACK: 240, SEAT: 480, FG: 520, LAMP: 700, CABLE: 300,
    TOP: 560, BOTTOM: 38,
  };
  const ROUTE_NAMES = { living: 'ДИВАННАЯ', kitchen: 'КУХОННАЯ', office: 'ОФИСНАЯ', baikal: 'ПЕРЕГОВОРНАЯ', roof: 'КРЫШНАЯ', bedroom: 'СПАЛЬНАЯ', dream: 'КРОЛИЧЬЯ НОРА' };
  const DEFAULT_LINE = ['ДИВАННАЯ', 'КУХОННАЯ', 'ОФИСНАЯ', 'ПЕРЕГОВОРНАЯ', 'КРЫШНАЯ', 'СПАЛЬНАЯ', 'КРОЛИЧЬЯ НОРА'];
  const ADS = [
    { band: 0x5f9ea0, head: 'КАРЬЕРА', lines: ['ВОЙТИ В IT', 'ЗА 3 ДНЯ'], foot: 'гарантия: нет', icon: 'braces' },
    { band: 0x8a7fc0, head: 'БАНК «ЗАЯЦ»', lines: ['ИПОТЕКА 0,1 %', 'ДЛЯ ЗАЙЦЕВ'], foot: 'не оферта', icon: 'house' },
    { band: 0x6f9a7c, head: 'ОБРАЗОВАНИЕ', lines: ['КУРСЫ', 'ЕБЛАНСТВА'], foot: 'бесплатно. навсегда', icon: 'zzz' },
    { band: 0x6b7f9e, head: 'ПАМЯТКА', lines: ['УСТУПАЙТЕ', 'МЕСТА КРОЛИКАМ'], foot: 'и диваны', icon: 'ears' },
  ];

  function lineStations() {
    const route = G.scene && Array.isArray(G.scene.route) ? G.scene.route : null;
    const names = [];
    let before = -1, after = -1;
    if (route && route.length) {
      let metroSeen = false;
      for (const r of route) {
        if (!r) continue;
        if (r.id === 'metro') {
          metroSeen = true;
          continue;
        }
        const n = ROUTE_NAMES[r.id];
        if (!n) continue;
        let i = names.indexOf(n);
        if (i < 0) {
          names.push(n);
          i = names.length - 1;
        }
        if (!metroSeen) before = i;
        else if (after < 0) after = i;
      }
    }
    if (names.length < 3) return { names: DEFAULT_LINE.slice(), before: 0, after: 2 };
    if (before < 0) before = 0;
    if (after < 0) after = Math.min(names.length - 1, before + 1);
    return { names, before, after };
  }

  function drawWallTile(c, ph, dark) {
    const T = MT.STEP;
    const top = -MT.TOP;
    c.fillStyle = ph(0xeceff1);
    c.fillRect(0, top, T, -244 - top);
    c.fillStyle = ph(0xf6f8fa);
    c.fillRect(0, -262, T, 6);
    c.fillStyle = ph(0xc9d0d6);
    c.fillRect(0, -244, T, 14);
    c.fillStyle = ph(0xe9ecee);
    c.fillRect(0, -230, T, 26);
    c.fillStyle = ph(0xb7bfc6);
    c.fillRect(0, -231, T, 1);
    c.fillRect(0, -204.5, T, 1);
    c.fillStyle = ph(0xdfe3e6);
    c.fillRect(0, -204, T, 94);
    c.fillStyle = ph(0xc9d0d6);
    c.fillRect(0, -110, T, 110 - MT.BOTTOM);
    c.fillStyle = ph(0xb3bbc2);
    c.fillRect(0, -110, T, 1.2);
    c.fillRect(0, -78, T, 0.9);
    c.fillStyle = dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.45)';
    c.fillRect(0, -77, T, 0.8);
    c.fillStyle = ph(0xa9b1b8);
    c.beginPath();
    for (let i = 0; i < 6; i++) rrSub(c, 16 + i * 6, -60, 3, 12, 1.5);
    c.fill();
    const x = MT.WIN_X, y = -MT.WIN_HI, w = MT.WIN_W, h = MT.WIN_H;
    c.globalCompositeOperation = 'destination-out';
    rr(c, x, y, w, h, 10);
    c.fill();
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = ph(0x3a4048, 0.3);
    c.lineWidth = 3;
    rr(c, x - 1.5, y - 1.5, w + 3, h + 3, 11.5);
    c.stroke();
    c.strokeStyle = ph(0xb9c0c8);
    c.lineWidth = 1.2;
    rr(c, x - 3.6, y - 3.6, w + 7.2, h + 7.2, 13.6);
    c.stroke();
    c.fillStyle = ph(0xaab2ba);
    rr(c, x + 6, y + h + 3.5, w - 12, 3, 1.5);
    c.fill();
  }

  function drawPoster(c, ph, ad, dark) {
    const w = 56, h = 66;
    c.fillStyle = ph(0xaab2ba);
    rr(c, -w / 2 - 1.6, -h / 2 - 1.6, w + 3.2, h + 3.2, 2.5);
    c.fill();
    c.fillStyle = ph(0xf7f5ef, 0.55);
    c.fillRect(-w / 2, -h / 2, w, h);
    c.fillStyle = ph(ad.band, 0.35);
    c.fillRect(-w / 2, -h / 2, w, 14);
    txt(c, ad.head, 0, -h / 2 + 7.4, 600, 7, 'display', dark ? '#e8edf2' : '#ffffff', w - 8);
    const ink = dark ? '#d9dee4' : '#2b2f36';
    txt(c, ad.lines[0], 0, -6, 700, 9.5, 'display', ink, w - 6);
    txt(c, ad.lines[1], 0, 5.5, 700, 9.5, 'display', ink, w - 6);
    c.strokeStyle = ph(ad.band, 0.35);
    c.fillStyle = ph(ad.band, 0.35);
    c.lineWidth = 1.4;
    const iy = 18;
    if (ad.icon === 'braces') {
      txt(c, '{ ; }', 0, iy, 600, 9, 'display', ph(ad.band, 0.35), w);
    } else if (ad.icon === 'house') {
      c.beginPath();
      c.moveTo(-7, iy + 5);
      c.lineTo(-7, iy - 1);
      c.lineTo(0, iy - 6);
      c.lineTo(7, iy - 1);
      c.lineTo(7, iy + 5);
      c.closePath();
      c.stroke();
    } else if (ad.icon === 'zzz') {
      txt(c, 'z z Z', 0, iy, 600, 9, 'display', ph(ad.band, 0.35), w);
    } else {
      c.beginPath();
      c.ellipse(-3.5, iy - 1, 2.2, 6, -0.2, 0, TAU);
      c.ellipse(3.5, iy - 1, 2.2, 6, 0.2, 0, TAU);
      c.stroke();
    }
    txt(c, ad.foot, 0, h / 2 - 4.5, 500, 5, 'body', dark ? '#9aa3ad' : '#7b838c', w - 6);
  }

  function drawLineMap(c, ph, dark, line) {
    const w = 236, n = line.names.length;
    c.fillStyle = ph(0xf4f5f7, 0.6);
    rr(c, -w / 2, -12, w, 24, 3);
    c.fill();
    c.strokeStyle = ph(0xb7bfc6);
    c.lineWidth = 0.8;
    c.stroke();
    const x0 = -w / 2 + 16, x1 = w / 2 - 16;
    c.strokeStyle = ph(0x8a5cc7, 0.35);
    c.lineWidth = 2.6;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x0, 0);
    c.lineTo(x1, 0);
    c.stroke();
    const ink = dark ? '#cfd3e0' : '#3a3346';
    for (let i = 0; i < n; i++) {
      const x = n > 1 ? x0 + ((x1 - x0) * i) / (n - 1) : 0;
      c.fillStyle = dark ? '#d9dde6' : '#ffffff';
      circle(c, x, 0, 3);
      c.strokeStyle = ph(0x8a5cc7, 0.35);
      c.lineWidth = 1.3;
      c.beginPath();
      c.arc(x, 0, 3, 0, TAU);
      c.stroke();
      txt(c, line.names[i], x, i % 2 ? 7.6 : -7.6, 500, 5.2, 'display', ink, ((x1 - x0) / Math.max(1, n - 1)) * 1.8);
    }
  }

  function drawBackTile(c, ph, dark) {
    const T = MT.BACK, seat = 60;
    const base = ph(0xa9bbdf, 0.4), hi = ph(0xc3d0ea, 0.4), lo = ph(0x8fa3cc, 0.4);
    c.fillStyle = base;
    c.beginPath();
    c.moveTo(0, 4);
    c.lineTo(0, -44);
    for (let i = 0; i < T / seat; i++) {
      const x = i * seat;
      c.quadraticCurveTo(x + seat / 2, -50, x + seat, -44);
    }
    c.lineTo(T, 4);
    c.closePath();
    c.fill();
    c.strokeStyle = hi;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(0, -42.5);
    for (let i = 0; i < T / seat; i++) {
      const x = i * seat;
      c.quadraticCurveTo(x + seat / 2, -48.4, x + seat, -42.5);
    }
    c.stroke();
    c.strokeStyle = lo;
    c.lineWidth = 1;
    c.setLineDash([2.2, 1.8]);
    c.beginPath();
    for (let i = 0; i <= T / seat; i++) {
      c.moveTo(i * seat, -42);
      c.lineTo(i * seat, 2);
    }
    c.moveTo(0, -36);
    c.lineTo(T, -36);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = dark ? 'rgba(0,0,0,0.18)' : 'rgba(40,60,110,0.12)';
    c.fillRect(0, -10, T, 14);
  }

  function drawSeatTile(c, ph, dark) {
    const T = MT.SEAT;
    c.fillStyle = ph(0x8fa6d6, 0.4);
    c.fillRect(0, -10, T, 10.5);
    c.fillStyle = ph(0xa9bde6, 0.4);
    c.fillRect(0, -10, T, 2);
    c.strokeStyle = ph(0x7b93c6, 0.4);
    c.lineWidth = 0.8;
    c.beginPath();
    for (let x = 60; x < T; x += 60) {
      c.moveTo(x, -9);
      c.lineTo(x - 1.5, 0);
    }
    c.stroke();
    c.fillStyle = ph(0xb9c0c8);
    c.fillRect(0, 0, T, 3.6);
    c.fillStyle = dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.7)';
    c.fillRect(0, 0.6, T, 0.9);
    c.fillStyle = ph(0x2c477f, 0.3);
    c.fillRect(0, 3.6, T, 120);
    c.fillStyle = dark ? 'rgba(0,0,0,0.25)' : 'rgba(10,20,50,0.25)';
    c.fillRect(0, 3.6, T, 3);
    c.fillStyle = ph(0x233a68, 0.3);
    for (let g = 0; g < 2; g++) {
      const gx = 40 + g * 240;
      rr(c, gx, 18, 160, 22, 3);
      c.fill();
    }
    c.fillStyle = ph(0x3a5690, 0.3);
    for (let g = 0; g < 2; g++) {
      const gx = 40 + g * 240;
      for (let s = 0; s < 16; s++) c.fillRect(gx + 6 + s * 9.6, 21, 3, 16);
    }
    for (let d = 0; d < 2; d++) {
      const dx = d * 240;
      c.fillStyle = ph(0xb9c0c8);
      rr(c, dx - 3.5, -6, 7, 9.6, 3);
      c.fill();
      c.fillStyle = dark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)';
      c.fillRect(dx - 2, -5, 1.2, 6);
    }
  }

  function drawPassenger(c, kind) {
    c.fillStyle = '#1a1e26';
    if (kind === 0) {
      for (const s of [-1, 1]) {
        c.beginPath();
        c.ellipse(s * 13, 0, 13, 15, s * 0.1, Math.PI, TAU);
        c.lineTo(s * 13 + 13, 30);
        c.lineTo(s * 13 - 13, 30);
        c.closePath();
        c.fill();
      }
    } else if (kind === 1) {
      rr(c, -24, -8, 48, 40, 7);
      c.fill();
      c.lineWidth = 3;
      c.strokeStyle = '#1a1e26';
      c.beginPath();
      c.arc(0, -8, 14, Math.PI, TAU);
      c.stroke();
    } else if (kind === 2) {
      for (const s of [-1, 1]) {
        rr(c, s * 15 - 8, -12, 16, 40, 5);
        c.fill();
        c.beginPath();
        c.ellipse(s * 15 + 6, 22, 14, 9, 0, 0, TAU);
        c.fill();
      }
    } else {
      rr(c, -22, -2, 44, 34, 8);
      c.fill();
      c.beginPath();
      c.ellipse(4, -8, 11, 9, 0, 0, TAU);
      c.fill();
      c.beginPath();
      c.ellipse(-4, -18, 3.4, 8, -0.35, 0, TAU);
      c.ellipse(10, -18, 3.4, 8, 0.35, 0, TAU);
      c.fill();
      c.fillStyle = '#3a404c';
      circle(c, 8, -9, 1.3);
    }
  }

  // Состояние вагона: «скорость за окном», станция, стыки.
  const MS = { d0: NaN, out: 0, lt: 0, lastT: 0, lastDist: 0, vOut: 900, st0: Infinity, st1: Infinity, tick: 0.3, dipT: 0 };
  function tickMetro(f, live) {
    if (MS.d0 !== f.dist - f.u) {
      MS.d0 = f.dist - f.u;
      MS.out = 0;
      MS.lt = 0;
      MS.lastT = f.t;
      MS.lastDist = f.dist;
      MS.st0 = Infinity;
      MS.st1 = Infinity;
      MS.tick = 0.3;
      MS.dipT = 0;
    }
    const rdt = Math.max(0, Math.min(0.1, f.t - MS.lastT));
    const dd = Math.max(0, f.dist - MS.lastDist);
    if (rdt === 0 && dd === 0) return;
    MS.lastT = f.t;
    MS.lastDist = f.dist;
    if (f.u >= 0) MS.lt += rdt;
    const base = calm ? 300 : 900, lt = MS.lt;
    let v = base;
    if (lt > 5 && lt < 7.5) {
      if (lt < 6) v = base + (250 - base) * smooth(lt - 5);
      else if (lt < 6.5) v = 250;
      else v = 250 + (base - 250) * smooth((lt - 6.5) / 1);
    }
    MS.vOut = v;
    MS.out += dd + v * rdt;
    if (MS.st0 === Infinity && lt >= 4.3) MS.st0 = MS.out + f.W + f.M;
    if (MS.st1 === Infinity && lt >= 7.3) MS.st1 = MS.out + f.W + f.M;
    MS.dipT = Math.max(0, MS.dipT - rdt);
    if (live && G.state.mode === 'run' && f.u >= 0) {
      MS.tick -= rdt;
      if (MS.tick <= 0) {
        MS.tick = (0.55 * 400) / Math.max(200, G.state.speed || 300);
        MS.dipT = 0.08;
        G.emit('railTick', {});
      }
    }
  }
  function metroSway(f) {
    const k = calm ? 0.2 : 1;
    return (1.2 * Math.sin(2.3 * f.t) + 0.6 * Math.sin(5.1 * f.t) - (MS.dipT > 0 ? 1.5 : 0)) * k;
  }

  const METRO = {
    id: 'metro',
    name: 'МЕТРО',
    title: 'в офис к обеду. Опаздываю',
    surface: 'fabric',
    outdoor: false,
    look: { grade: '#9fd0ff', gradeA: 0.06 },
    *build(kit, R) {
      const dark = isDark(kit), ph = phOf(dark), K = kOf(kit);
      R.dark = dark;
      R.refl = ph(0xdfe3e6);
      R.wall = mk(kit, MT.STEP, MT.TOP - MT.BOTTOM, 0, MT.TOP, (c) => drawWallTile(c, ph, dark));
      yield;
      R.posters = ADS.map((ad) => mk(kit, 60, 70, 30, 35, (c) => drawPoster(c, ph, ad, dark)));
      yield;
      R.sticker = mk(kit, 48, 12, 24, 6, (c) => {
        c.fillStyle = ph(0xf7f5ef, 0.55);
        rr(c, -22, -4.5, 44, 9, 1.5);
        c.fill();
        txt(c, 'НЕ ПРИСЛОНЯТЬСЯ', 0, 0.3, 600, 5.6, 'display', dark ? '#cfd3da' : '#3d434b', 40);
      });
      R.line = lineStations();
      R.map = mk(kit, 240, 28, 120, 14, (c) => drawLineMap(c, ph, dark, R.line));
      yield;
      R.back = mk(kit, MT.BACK, 56, 0, 52, (c) => drawBackTile(c, ph, dark));
      yield;
      R.seat = mk(kit, MT.SEAT, 132, 0, 10, (c) => drawSeatTile(c, ph, dark));
      yield;
      R.fg = [0, 1, 2, 3].map((k) => mk(kit, 60, 64, 30, 30, (c) => drawPassenger(c, k), Math.min(K, 2)));
      yield;
      R.station = mk(kit, 170, 22, 85, 11, (c) => {
        c.fillStyle = dark ? '#3a3f4a' : '#2f3a4a';
        rr(c, -82, -9, 164, 18, 2);
        c.fill();
        txt(c, 'ПЛОЩАДЬ ДЕДЛАЙНОВ', 0, 0.5, 600, 11, 'display', '#f0e6c8', 156);
      });
      R.lamp = softDisc(kit, '255,236,190', 40, 1);
      R.strip = mk(kit, 120, 4, 60, 2, (c) => {
        const g = c.createLinearGradient(-60, 0, 60, 0);
        g.addColorStop(0, 'rgba(255,244,214,0)');
        g.addColorStop(0.5, 'rgba(255,244,214,1)');
        g.addColorStop(1, 'rgba(255,244,214,0)');
        c.fillStyle = g;
        c.fillRect(-60, -2, 120, 4);
      }, 1);
    },
    update(dt, L) {
      const cur = G.scene && G.scene.loc;
      tickMetro(frame(L), !cur || !cur.id || cur.id === 'metro');
    },
    amb(L, rgb) {
      rgb[0] = 236;
      rgb[1] = 242;
      rgb[2] = 252;
    },
    bg(ctx, L) {
      const f = frame(L), R = f.R;
      tickMetro(f, false);
      const { W, GR, M } = f;
      const sw = metroSway(f), wsc = scroll(f, MT.PAR_WALL);
      const y0 = GR - MT.WIN_HI + sw, h = MT.WIN_H;
      const i0 = Math.floor((wsc - M - MT.STEP) / MT.STEP), i1 = Math.floor((wsc + W + M) / MT.STEP);
      ctx.save();
      ctx.beginPath();
      let any = false;
      for (let i = i0; i <= i1; i++) {
        const x = i * MT.STEP + MT.WIN_X - wsc;
        if (x > W + M || x + MT.WIN_W < -M) continue;
        rrSub(ctx, x, y0, MT.WIN_W, h, 10);
        any = true;
      }
      if (!any) {
        ctx.restore();
        return;
      }
      ctx.clip();
      ctx.fillStyle = preComp([11, 14, 18]);
      ctx.fillRect(-M, y0, W + 2 * M, h);
      const out = MS.out, x0 = -M, x1 = W + M;
      ctx.fillStyle = preComp([22, 27, 33]);
      ctx.fillRect(-M, y0 + h * 0.62, W + 2 * M, 1.2);
      ctx.fillRect(-M, y0 + h * 0.8, W + 2 * M, 0.8);
      const cables = [[0.16, 2.2, 7], [0.27, 1.6, 9], [0.38, 1.2, 6]];
      ctx.strokeStyle = preComp([44, 50, 58]);
      for (const [ky, lw, sag] of cables) {
        ctx.lineWidth = lw;
        ctx.beginPath();
        const cy = y0 + h * ky;
        for (let s = Math.floor((x0 + out) / MT.CABLE) * MT.CABLE; s - out < x1; s += MT.CABLE) {
          const x = s - out;
          ctx.moveTo(x, cy);
          ctx.quadraticCurveTo(x + MT.CABLE / 2, cy + sag * 2, x + MT.CABLE, cy);
        }
        ctx.stroke();
      }
      const ly = y0 + h * 0.12;
      for (let s = Math.floor((x0 - 40 + out) / MT.LAMP) * MT.LAMP; s - out < x1 + 40; s += MT.LAMP) {
        const x = s - out;
        ctx.globalAlpha = 0.65;
        ctx.drawImage(R.lamp.c, x - 26, ly - 10, 52, 20);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath();
        ctx.ellipse(x, ly, calm ? 4 : 16, 1.6, 0, 0, TAU);
        ctx.fill();
      }
      const a = MS.st0 - out, b = MS.st1 - out;
      if (a < x1 && b > x0) {
        const sx0 = Math.max(x0, a), sx1 = Math.min(x1, b);
        ctx.fillStyle = preComp([232, 225, 214]);
        ctx.fillRect(sx0, y0, sx1 - sx0, h);
        ctx.fillStyle = preComp([207, 198, 184]);
        ctx.fillRect(sx0, y0, sx1 - sx0, 5);
        ctx.fillRect(sx0, y0 + h - 7, sx1 - sx0, 7);
        for (let s = Math.ceil((sx0 + out - MS.st0) / 120) * 120 + MS.st0; s - out < sx1; s += 120) {
          const x = s - out;
          ctx.fillRect(x - 8, y0, 16, h);
        }
        for (let s = Math.ceil((sx0 + out - MS.st0) / 480) * 480 + MS.st0 + 240; s - out < sx1 + 90; s += 480) {
          const x = s - out;
          if (x - 85 >= a && x + 85 <= b) blit(ctx, R.station, x, y0 + h * 0.42);
        }
      }
      ctx.globalAlpha = f.dark ? 0.25 : 0.45;
      ctx.fillStyle = R.refl;
      ctx.fillRect(-M, y0, W + 2 * M, h);
      ctx.globalAlpha = f.dark ? 0.05 : 0.12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let i = i0; i <= i1; i++) {
        const x = i * MT.STEP + MT.WIN_X - wsc;
        ctx.moveTo(x + 18, y0);
        ctx.lineTo(x + 40, y0);
        ctx.lineTo(x + 10, y0 + h);
        ctx.lineTo(x - 12, y0 + h);
        ctx.closePath();
      }
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      for (let i = i0; i <= i1; i++) {
        const x = i * MT.STEP + MT.WIN_X - wsc;
        if (x > W + M || x + MT.WIN_W < -M) continue;
        pushPane(x, y0, MT.WIN_W, h, 400 + mod(i, 64));
      }
    },
    wall(ctx, L) {
      const f = frame(L), R = f.R;
      const { W, GR, M } = f;
      const sw = metroSway(f), wsc = scroll(f, MT.PAR_WALL);
      const top = GR - MT.TOP + sw;
      if (top > -M) {
        ctx.fillStyle = R.dark ? '#2b3036' : '#eceff1';
        ctx.fillRect(-M, -M, W + 2 * M, top + M + 1);
      }
      const i0 = Math.floor((wsc - M - MT.STEP) / MT.STEP), i1 = Math.floor((wsc + W + M) / MT.STEP);
      for (let i = i0; i <= i1; i++) blit(ctx, R.wall, i * MT.STEP - wsc, GR + sw);
      for (let i = i0; i <= i1 + 1; i++) {
        const x = i * MT.STEP - wsc;
        if (x < -M - 40 || x > W + M + 40) continue;
        blit(ctx, R.posters[Math.floor(hash(i, 21) * R.posters.length) % R.posters.length], x, GR - 156 + sw);
        const cx = x + MT.WIN_X + MT.WIN_W / 2;
        if (hash(i, 22) < 0.3) blit(ctx, R.sticker, cx, GR - 64 + sw);
        if (mod(i, 3) === 1) {
          blit(ctx, R.map, cx, GR - 217 + sw);
          const ln = R.line, n = ln.names.length;
          const p = clamp01(MS.lt / 12);
          const k = ln.before + (ln.after - ln.before) * p;
          const mx = cx - 118 + 16 + ((236 - 32) * k) / Math.max(1, n - 1);
          const pulse = calm ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(f.t * 3.2));
          ctx.globalAlpha = pulse;
          ctx.fillStyle = '#e8c547';
          circle(ctx, mx, GR - 217 + sw, 2.4);
          ctx.globalAlpha = 1;
        }
      }
      const rsc = scroll(f, MT.PAR_RAIL);
      const j0 = Math.floor((rsc - M) / MT.RAIL), j1 = Math.floor((rsc + W + M) / MT.RAIL);
      const railTop = -M, railBot = GR - 46;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = R.dark ? '#7d848c' : '#b9c0c8';
      for (let j = j0; j <= j1; j++) ctx.fillRect(j * MT.RAIL + 150 - rsc - 1.5, railTop + sw, 3, railBot - railTop);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = R.dark ? '#a9b0b8' : '#eef1f4';
      for (let j = j0; j <= j1; j++) ctx.fillRect(j * MT.RAIL + 150 - rsc - 0.9, railTop + sw, 0.8, railBot - railTop);
      ctx.globalAlpha = 1;
    },
    back(ctx, L) {
      const f = frame(L), R = f.R;
      const sc = scroll(f, MT.PAR_BACK);
      const i0 = Math.floor((sc - f.M - MT.BACK) / MT.BACK), i1 = Math.floor((sc + f.W + f.M) / MT.BACK);
      for (let i = i0; i <= i1; i++) blit(ctx, R.back, i * MT.BACK - sc, f.GR);
    },
    ground(ctx, L) {
      const f = frame(L), R = f.R;
      const sc = scroll(f, 1);
      const i0 = Math.floor((sc - f.M - MT.SEAT) / MT.SEAT), i1 = Math.floor((sc + f.W + f.M) / MT.SEAT);
      const K = R.seat.k || 1;
      for (let i = i0; i <= i1; i++) blit(ctx, R.seat, Math.round((i * MT.SEAT - sc) * K) / K, f.GR);
    },
    emissive(ctx, L) {
      const f = frame(L), R = f.R;
      const { W, GR, M } = f;
      const wsc = scroll(f, MT.PAR_WALL);
      for (let s = Math.floor((wsc - M) / MT.RAIL); s * MT.RAIL - wsc < W + M; s++) {
        pushLight('strip', s * MT.RAIL + 100 - wsc, GR - 250, 80, 150, 0, 0.25, 235, 242, 255);
      }
      if (calm || tierOf(L) === 0) return;
      const out = MS.out;
      ctx.globalCompositeOperation = 'screen';
      for (let s = Math.floor((-M - 60 + out) / MT.LAMP) * MT.LAMP; s - out < W + M + 60; s += MT.LAMP) {
        if (s >= MS.st0 && s <= MS.st1) continue;
        ctx.globalAlpha = 0.08;
        ctx.drawImage(R.strip.c, s - out - 60, -M, 120, GR + M);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
    front(ctx, L) {
      const f = frame(L), R = f.R;
      const sc = scroll(f, MT.PAR_FRONT);
      const j0 = Math.floor((sc - 160) / MT.FG), j1 = Math.floor((sc + f.W + 160) / MT.FG);
      ctx.globalAlpha = 0.85;
      for (let j = j0; j <= j1; j++) {
        const h = hash(j, 31);
        if (h > 0.55) continue;
        const kind = h < 0.07 ? 3 : Math.floor(hash(j, 32) * 3);
        const x = j * MT.FG - sc + (hash(j, 33) - 0.5) * 120;
        blit(ctx, R.fg[kind], x, f.H - 6);
      }
      ctx.globalAlpha = 1;
    },
  };

  // ============================================================
  // КРЫША «Закат по расписанию»
  // ============================================================
  const RF = {
    HORIZON: 110, PAR_HAZE: 0.03, PAR_BACK: 0.08, PAR_FRONT: 0.2, PAR_BIRDS: 0.05, PAR_PROPS: 0.45, PAR_FG: 1.45,
    HAZE: 520, BACK: 640, CITY: 900, SLOT: 230, BRICK: 240, FG: 380, LIT_GROUPS: 3,
  };
  const CITY = (() => {
    const r = rng(91);
    const haze = [], back = [], front = [];
    for (let x = 0; x < RF.HAZE - 6; ) {
      const w = Math.min(14 + r() * 22, RF.HAZE - x);
      haze.push(x, w, 14 + r() * 34);
      x += w + r() * 3;
    }
    for (let x = 0; x < RF.BACK - 8; ) {
      const w = Math.min(18 + r() * 24, RF.BACK - x);
      back.push(x, w, 50 + r() * 80, r() < 0.2 ? 1 : 0);
      x += w + 1 + r() * 4;
    }
    for (let x = 4; x < RF.CITY - 10; ) {
      const w = Math.min(28 + r() * 34, RF.CITY - x);
      const t = r();
      front.push(x, w, 26 + r() * 56, t < 0.22 ? 1 : t < 0.42 ? 2 : 0);
      x += w + 2 + r() * 10;
    }
    return { haze, back, front };
  })();

  function drawCityLit(c, layer, group, groups) {
    const r = rng(300 + layer * 17 + group);
    const warm = ['#ffd27a', '#ffe7a8', '#ffc768', '#cfe4ff'];
    const arr = layer ? CITY.front : CITY.back, stride = 4;
    for (let i = 0; i < arr.length; i += stride) {
      const x = arr[i], w = arr[i + 1], h = arr[i + 2];
      for (let yy = -h + 5; yy < -3; yy += layer ? 6 : 5) {
        for (let xx = x + 3; xx < x + w - 3; xx += layer ? 5 : 3.8) {
          const pick = r();
          if (pick > (layer ? 0.42 : 0.24)) continue;
          if (groups > 1 && Math.floor(hash(Math.floor(xx * 7 + yy * 13), 5 + layer) * groups) !== group) continue;
          c.fillStyle = warm[Math.floor(r() * warm.length)];
          c.fillRect(xx, yy, layer ? 2 : 1.4, layer ? 2.6 : 1.9);
        }
      }
    }
  }

  function prop(kit, kind, ph) {
    const draws = {
      vent(c) {
        c.fillStyle = ph(0x9aa0a6);
        c.fillRect(-4, -26, 8, 30);
        c.fillStyle = ph(0x7d838a);
        c.fillRect(-4, -26, 2.2, 30);
        c.fillStyle = ph(0xa7acb2);
        c.beginPath();
        c.moveTo(-13, -26);
        c.quadraticCurveTo(0, -40, 13, -26);
        c.closePath();
        c.fill();
        c.fillStyle = ph(0x6f757c);
        c.fillRect(-13, -27, 26, 2);
      },
      ac(c) {
        c.fillStyle = ph(0xd9dcdf);
        rr(c, -19, -26, 38, 24, 2);
        c.fill();
        c.strokeStyle = ph(0xa9aeb3);
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(-5, -14, 8, 0, TAU);
        c.stroke();
        c.beginPath();
        for (let i = 0; i < 4; i++) {
          c.moveTo(-5, -14);
          c.lineTo(-5 + Math.cos(i * 1.57 + 0.4) * 7, -14 + Math.sin(i * 1.57 + 0.4) * 7);
        }
        for (let y = -22; y < -6; y += 3) {
          c.moveTo(6, y);
          c.lineTo(15, y);
        }
        c.stroke();
        c.fillStyle = ph(0x8f949a);
        c.fillRect(-16, -2, 3, 6);
        c.fillRect(13, -2, 3, 6);
      },
      booth(c) {
        c.fillStyle = ph(0xc9c2b4);
        c.fillRect(-32, -52, 64, 56);
        c.fillStyle = ph(0xb3ab9c);
        c.beginPath();
        c.moveTo(-36, -52);
        c.lineTo(36, -58);
        c.lineTo(36, -53);
        c.lineTo(-36, -47);
        c.closePath();
        c.fill();
        c.fillStyle = ph(0x6d7a6f);
        c.fillRect(-12, -38, 24, 42);
        c.fillStyle = ph(0x56625a);
        c.fillRect(-12, -38, 24, 2);
        c.fillStyle = ph(0xc9a24a);
        circle(c, 8, -16, 1.6);
        c.fillStyle = ph(0xf2efe6);
        c.fillRect(-25, -40, 10, 6);
        c.fillStyle = ph(0x8a8f86);
        c.fillRect(17, -44, 10, 8);
      },
      antenna(c) {
        c.strokeStyle = ph(0x7d838a);
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(0, 4);
        c.lineTo(0, -60);
        for (let i = 0; i < 5; i++) {
          const y = -56 + i * 9, w = 8 + i * 3;
          c.moveTo(-w, y);
          c.lineTo(w, y);
        }
        c.moveTo(0, -20);
        c.lineTo(-12, 4);
        c.moveTo(0, -20);
        c.lineTo(12, 4);
        c.stroke();
      },
      dish(c) {
        c.strokeStyle = ph(0x7d838a);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, 4);
        c.lineTo(0, -28);
        c.stroke();
        c.fillStyle = ph(0xe3e5e8);
        c.beginPath();
        c.ellipse(2, -36, 6, 13, -0.5, 0, TAU);
        c.fill();
        c.strokeStyle = ph(0xa9aeb3);
        c.lineWidth = 1;
        c.stroke();
        c.beginPath();
        c.moveTo(4, -36);
        c.lineTo(13, -40);
        c.stroke();
      },
      tank(c) {
        c.strokeStyle = ph(0x6f757c);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-18, 4);
        c.lineTo(-14, -14);
        c.moveTo(18, 4);
        c.lineTo(14, -14);
        c.moveTo(-16, -4);
        c.lineTo(16, -4);
        c.stroke();
        c.fillStyle = ph(0x8c9aa3);
        rr(c, -23, -52, 46, 38, 5);
        c.fill();
        c.fillStyle = ph(0x7a8790);
        c.fillRect(-23, -42, 46, 2);
        c.fillRect(-23, -27, 46, 2);
        txt(c, 'ТУТ БЫЛ', 0, -36, 700, 7.5, 'display', ph(0xe58fc0, 0.3), 40);
        txt(c, 'КРОЛИК', 0, -21.5, 700, 8.5, 'display', ph(0x7fd1c8, 0.3), 40);
      },
      line(c) {
        c.strokeStyle = ph(0x7d838a);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-50, 4);
        c.lineTo(-50, -46);
        c.moveTo(-56, -44);
        c.lineTo(-44, -44);
        c.moveTo(50, 4);
        c.lineTo(50, -46);
        c.moveTo(44, -44);
        c.lineTo(56, -44);
        c.stroke();
        c.strokeStyle = ph(0x9c8f7a);
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(-50, -44);
        c.quadraticCurveTo(0, -34, 50, -44);
        c.stroke();
        const socks = [0xc7b8e0, 0x9fc6d8, 0xd8d2c8, 0xb8d6b0, 0xe6d9a8];
        for (let i = 0; i < 5; i++) {
          const t = (i + 0.5) / 5, x = -50 + 100 * t, y = -44 + 20 * t * (1 - t) + 0.5;
          c.fillStyle = ph(socks[i]);
          c.beginPath();
          c.moveTo(x - 2.6, y);
          c.lineTo(x + 2.6, y);
          c.lineTo(x + 2.6, y + 9);
          c.quadraticCurveTo(x + 2.6, y + 13, x - 1.5, y + 12.4);
          c.lineTo(x - 5.5, y + 12.4);
          c.quadraticCurveTo(x - 6.5, y + 10, x - 2.6, y + 9);
          c.closePath();
          c.fill();
          if (i === 2) {
            c.fillStyle = ph(0xd98a3a, 0.35);
            for (let d = 0; d < 3; d++) c.fillRect(x - 1.6, y + 2 + d * 3, 2.4, 1);
          }
        }
      },
    };
    const box = { vent: [30, 46, 15, 41], ac: [42, 34, 21, 30], booth: [76, 66, 38, 62], antenna: [30, 68, 15, 64], dish: [34, 56, 15, 52], tank: [52, 60, 26, 56], line: [116, 54, 58, 50] }[kind];
    return mk(kit, box[0], box[1], box[2], box[3], draws[kind]);
  }
  const PROP_KINDS = ['vent', 'ac', 'antenna', 'dish', 'tank', 'line', 'vent', 'ac'];

  function drawBrickTile(c, ph, dark) {
    const T = RF.BRICK;
    c.fillStyle = ph(0xb5b0a6, 0.4);
    c.fillRect(0, -4, T, 4.6);
    c.fillStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.35)';
    c.fillRect(0, -4, T, 0.9);
    const r = rng(17);
    c.fillStyle = ph(0x9a958b, 0.4);
    for (let i = 0; i < 40; i++) c.fillRect(r() * T, -3.6 + r() * 3.4, 1.1, 0.7);
    c.fillStyle = ph(0x8f8a80, 0.4);
    c.fillRect(0, 0.6, T, 6.4);
    c.fillStyle = dark ? 'rgba(0,0,0,0.3)' : 'rgba(40,30,20,0.22)';
    c.fillRect(0, 7, T, 2.2);
    c.fillStyle = ph(0xa0583c, 0.4);
    c.fillRect(0, 7, T, 120);
    c.fillStyle = ph(0x84452e, 0.4);
    for (let row = 0, y = 9.2; y < 127; row++, y += 7) {
      c.fillRect(0, y + 5.6, T, 1.4);
      const off = row % 2 ? 11 : 0;
      for (let x = off; x < T; x += 22) c.fillRect(x, y, 1.4, 5.6);
    }
    c.fillStyle = dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,220,190,0.18)';
    for (let i = 0; i < 26; i++) c.fillRect(r() * T, 10 + r() * 100, 9 + r() * 8, 1.2);
  }
  function drawRailing(c) {
    c.fillStyle = '#1a1e26';
    c.fillRect(-90, -24, 180, 4);
    for (const x of [-80, -27, 27, 80]) c.fillRect(x - 2.5, -24, 5, 40);
    c.fillRect(-90, -6, 180, 2.4);
  }
  function drawDrain(c) {
    c.fillStyle = '#1a1e26';
    c.beginPath();
    c.moveTo(-14, -26);
    c.lineTo(14, -26);
    c.lineTo(6, -14);
    c.lineTo(6, 20);
    c.lineTo(-6, 20);
    c.lineTo(-6, -14);
    c.closePath();
    c.fill();
    c.fillRect(-9, -2, 18, 3);
  }

  // Голуби на будке и клин птиц.
  const pigeons = { d0: NaN, fly: new Map() };
  function drawBird(ctx, x, y, s, flap) {
    const wy = flap * 3 * s;
    ctx.moveTo(x - 4 * s, y - wy);
    ctx.quadraticCurveTo(x - 1.5 * s, y - 1.2 * s, x, y);
    ctx.quadraticCurveTo(x + 1.5 * s, y - 1.2 * s, x + 4 * s, y - wy);
  }
  function drawPigeons(ctx, f, slot, bx, by, silA) {
    if (pigeons.d0 !== f.dist - f.u) {
      pigeons.d0 = f.dist - f.u;
      pigeons.fly.clear();
    }
    const B = G.bunny;
    let t0 = pigeons.fly.get(slot);
    if (t0 === undefined && bx < B.x + 120 && G.state.mode === 'run') {
      t0 = f.t;
      pigeons.fly.set(slot, t0);
      if (pigeons.fly.size > 24) pigeons.fly.delete(pigeons.fly.keys().next().value);
    }
    const n = 3 + Math.floor(hash(slot, 61) * 3);
    const col = silA > 0.4 ? '#24262e' : '#4a4d58';
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.1;
    if (t0 === undefined) {
      for (let k = 0; k < n; k++) {
        const x = bx - 24 + k * 11 + hash(slot * 7 + k, 62) * 4, y = by - 1 - (k * 0.6);
        ctx.beginPath();
        ctx.ellipse(x, y - 2.4, 3.2, 2.2, 0, 0, TAU);
        ctx.ellipse(x + 2.6, y - 4.6, 1.5, 1.5, 0, 0, TAU);
        ctx.fill();
      }
      return;
    }
    const e = (f.t - t0) / 1.2;
    if (e >= 1) return;
    ctx.globalAlpha = Math.min(1, (1 - e) * 3);
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const h = hash(slot * 7 + k, 63);
      const x = bx - 24 + k * 11 - (40 + 60 * h) * e;
      const y = by - 3 - (50 + 50 * h) * e * e - 10 * e;
      const flap = calm ? 0.4 : Math.sin(f.t * 26 + k * 1.7);
      drawBird(ctx, x, y, 1.1, flap);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function drawWedge(ctx, f) {
    const period = 8, ph = mod(f.t + 2.5, period) / period;
    const W = f.W;
    const x = W + 80 - ph * (W + 260) - f.u * RF.PAR_BIRDS * 0.2;
    const y = Math.max(16, f.GR - 230) + Math.sin(ph * 6) * 3;
    ctx.strokeStyle = f.F.night > 0.5 ? 'rgba(20,22,40,0.5)' : 'rgba(40,36,52,0.45)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let k = -3; k <= 3; k++) {
      const flap = calm ? 0.3 : Math.sin(f.t * 9 + k);
      drawBird(ctx, x + Math.abs(k) * 9, y + k * 5.4, 0.8, flap);
    }
    ctx.stroke();
  }

  const roofSun = { x: 0, y: 0, vis: 0, t: -1 };
  const skyGrad = { g: null, key: '' };
  function ownSky(ctx, f, x, y, w, h, base) {
    const F = f.F;
    const top = F.skyTop || (f.dark ? '#1a2030' : '#79b4e6'), midc = F.skyMid || (f.dark ? '#2a2c40' : '#b9dcf2'), bot = F.skyBot || (f.dark ? '#3a3448' : '#fbe8c8');
    const key = top + midc + bot + y + base;
    if (skyGrad.key !== key || !skyGrad.g) {
      const g = ctx.createLinearGradient(0, y, 0, base);
      g.addColorStop(0, top);
      g.addColorStop(0.55, midc);
      g.addColorStop(1, bot);
      skyGrad.g = g;
      skyGrad.key = key;
    }
    ctx.fillStyle = skyGrad.g;
    ctx.fillRect(x, y, w, h);
    const kit = G.sceneKit, S = kit && kit.S;
    const sunA = Number(F.sunA) || 0;
    let sunX = 0, sunY = 0;
    if (sunA > 0.01) {
      const df = Number.isFinite(F.dayFrac) ? F.dayFrac : 0.6, el = Number.isFinite(F.sunElev) ? F.sunElev : 0.4;
      sunX = x + w * (0.2 + 0.6 * df);
      sunY = base - 10 - el * Math.max(8, base - y - 34);
      const sp = S && (F.sunset > 0.5 ? S.sunWarm : S.sun);
      ctx.globalAlpha = sunA;
      if (sp && sp.c) blit(ctx, sp, sunX, sunY);
      else {
        ctx.fillStyle = F.sunset > 0.5 ? '#ffb070' : '#fff3c8';
        circle(ctx, sunX, sunY, 12);
      }
      ctx.globalAlpha = 1;
    }
    if ((Number(F.starA) || 0) > 0.01 && S && S.stars && S.stars.c) {
      ctx.globalAlpha = F.starA;
      for (let sx = x - mod(x, S.stars.w); sx < x + w; sx += S.stars.w) blit(ctx, S.stars, sx, y + 60);
      ctx.globalAlpha = 1;
    }
    return { sunX, sunY, sunVis: sunA };
  }

  const colCache = { key: '', haze: '', front: '', back: '' };
  function cityColors(F) {
    const back = F.cityBack || '#9aa7b8', front = F.cityFront || '#6f7d92', bot = F.skyBot || '#e3eef7';
    const key = back + front + bot;
    if (colCache.key !== key) {
      colCache.key = key;
      colCache.haze = css(mix(parse(bot), parse(back), 0.35));
      colCache.front = css(mix(parse(front), parse(bot), 0.18));
      colCache.back = back;
    }
    return colCache;
  }
  function cityPath(ctx, arr, stride, span, sc, base, x0, x1, extra) {
    const n0 = Math.floor((x0 + sc) / span) - 1, n1 = Math.floor((x1 + sc) / span);
    ctx.beginPath();
    for (let n = n0; n <= n1; n++) {
      const tx = n * span - sc;
      for (let i = 0; i < arr.length; i += stride) {
        const bx = tx + arr[i], w = arr[i + 1], h = arr[i + 2];
        if (bx > x1 || bx + w < x0) continue;
        ctx.rect(bx, base - h, w, h + 60);
        if (!extra) continue;
        const f = arr[i + 3];
        if (f === 1) {
          const cx = bx + w * 0.6;
          ctx.rect(cx - 7, base - h - 16, 14, 11);
          ctx.rect(cx - 6, base - h - 5, 1.6, 5);
          ctx.rect(cx + 4.4, base - h - 5, 1.6, 5);
          ctx.moveTo(cx - 8, base - h - 16);
          ctx.lineTo(cx, base - h - 21);
          ctx.lineTo(cx + 8, base - h - 16);
          ctx.closePath();
        } else if (f === 2) {
          const cx = bx + w * 0.3;
          ctx.rect(cx - 0.6, base - h - 18, 1.2, 18);
          ctx.rect(cx - 5, base - h - 14, 10, 1);
          ctx.rect(cx - 3.5, base - h - 9, 7, 1);
        }
      }
    }
    ctx.fill();
  }
  function litK(clock, group) {
    const m = mod(clock, 1440);
    if (m < 360) return 1;
    if (m < 1080) return 0;
    return clamp01((m - (1140 + group * 20)) / 12);
  }

  const ROOF = {
    id: 'roof',
    name: 'КРЫША',
    title: 'закат по расписанию',
    surface: 'stone',
    outdoor: true,
    look: null,
    *build(kit, R) {
      const dark = isDark(kit), ph = phOf(dark);
      R.dark = dark;
      R.props = {};
      R.sil = {};
      for (const k of ['vent', 'ac', 'booth', 'antenna', 'dish', 'tank', 'line']) {
        R.props[k] = prop(kit, k, ph);
        R.sil[k] = silhouetteOf(kit, R.props[k], dark ? '#14121c' : '#2a2436');
        yield;
      }
      R.brick = mk(kit, RF.BRICK, 132, 0, 4, (c) => drawBrickTile(c, ph, dark));
      yield;
      R.railing = mk(kit, 184, 46, 92, 26, drawRailing);
      R.drain = mk(kit, 32, 50, 16, 28, drawDrain);
      yield;
      const maxFront = 110, maxBack = 160;
      R.lit = [];
      for (let g = 0; g < RF.LIT_GROUPS; g++) {
        R.lit.push(mk(kit, RF.CITY, maxFront, 0, maxFront, (c) => drawCityLit(c, 1, g, RF.LIT_GROUPS), 1.5));
        yield;
      }
      R.litBack = mk(kit, RF.BACK, maxBack, 0, maxBack, (c) => drawCityLit(c, 0, 0, 1), 1);
      R.glow = softDisc(kit, '255,206,150', 64, 1);
    },
    bg(ctx, L) {
      const f = frame(L), R = f.R, F = f.F;
      const { W, GR, M } = f;
      const horizon = GR - RF.HORIZON;
      const kit = G.sceneKit;
      let sun = null;
      const rect = { x: -M, y: -M, w: W + 2 * M, h: GR + 6 + M, base: horizon, skyTop: -M, city: false, precip: false };
      if (kit && typeof kit.drawSky === 'function') {
        try { sun = kit.drawSky(ctx, rect, 7); } catch (e) { G.report('roof sky', e); }
      } else {
        sun = ownSky(ctx, f, rect.x, rect.y, rect.w, rect.h, horizon);
      }
      if (sun && Number.isFinite(sun.sunX)) {
        roofSun.x = sun.sunX;
        roofSun.y = sun.sunY;
        roofSun.vis = Number(sun.sunVis) || 0;
      } else {
        const s = G.scene && G.scene.sun;
        roofSun.vis = s && Number.isFinite(s.x) ? Number(s.vis) || 0 : 0;
        if (roofSun.vis) {
          roofSun.x = s.x;
          roofSun.y = s.y;
        }
      }
      roofSun.t = f.t;
      if (G.weather && typeof G.weather.drawSkyFx === 'function') G.weather.drawSkyFx(ctx, L);
      drawWedge(ctx, f);
      const rise = 40 * Math.pow(1 - clamp01((f.u + W) / (W + 400)), 3);
      const cc = cityColors(F);
      const x0 = -M, x1 = W + M;
      ctx.fillStyle = cc.haze;
      cityPath(ctx, CITY.haze, 3, RF.HAZE, scroll(f, RF.PAR_HAZE) + 140, horizon + 4 + rise, x0, x1, false);
      const bsc = scroll(f, RF.PAR_BACK) + 60, bbase = GR - 34 + rise;
      ctx.fillStyle = cc.back;
      cityPath(ctx, CITY.back, 4, RF.BACK, bsc, bbase, x0, x1, false);
      const nightA = clamp01(Number(F.night) || 0) * 0.7;
      if (nightA > 0.01 && R.litBack) {
        ctx.globalAlpha = nightA;
        for (let n = Math.floor((x0 + bsc) / RF.BACK) - 1; n * RF.BACK - bsc < x1; n++) blit(ctx, R.litBack, n * RF.BACK - bsc, bbase);
        ctx.globalAlpha = 1;
      }
      const fsc = scroll(f, RF.PAR_FRONT) + 200, fbase = GR + 6 + rise;
      ctx.fillStyle = cc.front;
      cityPath(ctx, CITY.front, 4, RF.CITY, fsc, fbase, x0, x1, true);
      if (R.lit) {
        for (let g = 0; g < R.lit.length; g++) {
          const a = litK(f.clock, g);
          if (a < 0.01) continue;
          ctx.globalAlpha = a * 0.95;
          for (let n = Math.floor((x0 + fsc) / RF.CITY) - 1; n * RF.CITY - fsc < x1; n++) blit(ctx, R.lit[g], n * RF.CITY - fsc, fbase);
        }
        ctx.globalAlpha = 1;
      }
      pushPane(-M, -M, W + 2 * M, GR - 6 + M, 900);
    },
    wall(ctx, L) {
      const f = frame(L), R = f.R, F = f.F;
      const { W, GR, M } = f;
      const sc = scroll(f, RF.PAR_PROPS);
      const silA = Math.min(0.85, clamp01((Number(F.sunset) || 0) * 0.7 + (Number(F.night) || 0) * 0.85));
      const i0 = Math.floor((sc - M - 120) / RF.SLOT), i1 = Math.floor((sc + W + M + 120) / RF.SLOT);
      for (let i = i0; i <= i1; i++) {
        const booth = mod(i, 5) === 2;
        const h = hash(i, 41);
        if (!booth && h < 0.18) continue;
        const kind = booth ? 'booth' : PROP_KINDS[Math.floor(hash(i, 42) * PROP_KINDS.length) % PROP_KINDS.length];
        const x = i * RF.SLOT - sc + (hash(i, 43) - 0.5) * 60, y = GR + 3;
        const sp = R.props[kind];
        if (x + sp.w < -M || x - sp.w > W + M) continue;
        blit(ctx, sp, x, y);
        if (silA > 0.01) {
          ctx.globalAlpha = silA;
          blit(ctx, R.sil[kind], x, y);
          ctx.globalAlpha = 1;
        }
        if (booth) drawPigeons(ctx, f, i, x + 2, y - 55, silA);
      }
    },
    ground(ctx, L) {
      const f = frame(L), R = f.R;
      const sc = scroll(f, 1);
      const K = R.brick.k || 1;
      const i0 = Math.floor((sc - f.M - RF.BRICK) / RF.BRICK), i1 = Math.floor((sc + f.W + f.M) / RF.BRICK);
      for (let i = i0; i <= i1; i++) blit(ctx, R.brick, Math.round((i * RF.BRICK - sc) * K) / K, f.GR);
    },
    front(ctx, L) {
      const f = frame(L), R = f.R;
      const sc = scroll(f, RF.PAR_FG);
      const j0 = Math.floor((sc - 200) / RF.FG), j1 = Math.floor((sc + f.W + 200) / RF.FG);
      ctx.globalAlpha = 0.85;
      for (let j = j0; j <= j1; j++) {
        const h = hash(j, 71);
        if (h > 0.6) continue;
        const x = j * RF.FG - sc + (hash(j, 72) - 0.5) * 100;
        if (h < 0.15) blit(ctx, R.drain, x, f.H - 6);
        else blit(ctx, R.railing, x, f.H - 8);
      }
      ctx.globalAlpha = 1;
    },
  };

  // Блики солнца на крыше: слой 81, под HUD и над светом сцены.
  G.onRender(81, (ctx) => {
    if (roofSun.t !== G.state.realT || calm || roofSun.vis < 0.05) return;
    if (tierOf(null) === 0) return;
    const sp = glintSprite();
    if (!sp) return;
    const W = G.W, H = G.H, GR = G.GROUND;
    if (roofSun.x < -60 || roofSun.x > W + 60) return;
    const cx = W / 2, cy = H / 2;
    const T = [0.35, 0.6, 0.85, 1.2], RAD = [18, 8, 26, 12], A = [0.16, 0.2, 0.12, 0.15];
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x = roofSun.x + (cx - roofSun.x) * T[i], y = roofSun.y + (cy - roofSun.y) * T[i];
      if (y > GR - 120) continue;
      ctx.globalAlpha = A[i] * Math.min(1, roofSun.vis);
      ctx.drawImage(sp, x - RAD[i], y - RAD[i], RAD[i] * 2, RAD[i] * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  });
  let glintCanvas = null;
  function glintSprite() {
    if (glintCanvas) return glintCanvas;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    if (!x) return null;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,214,160,0.9)');
    g.addColorStop(0.45, 'rgba(255,190,130,0.35)');
    g.addColorStop(1, 'rgba(255,170,110,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    glintCanvas = c;
    return c;
  }

  const pending = [METRO, ROOF].filter((d) => !register(d));
  if (pending.length) G.on('boot', () => { for (const d of pending) register(d); });
})();
