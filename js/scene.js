/* Окружение: комната с окнами, постерами, торшером и диваном; смена суток, погода и свет. Владелец — агент scene. */
(() => {
  'use strict';
  const G = window.G;
  const { TAU, LAYER } = G;
  const { rr, ellipse, font } = G.draw;

  const M = 60;
  const PAR_WALL = 0.14, PAR_BACK = 0.42, PAR_FRONT = 1.45, PAR_CITY = 0.02, PAR_STARS = 0.008;
  const WIN_SLOT = 330, ART_SLOT = 245, MACRO = WIN_SLOT + ART_SLOT * 2, PROP_DX = 138, SIGN_RIGHT = 98;
  const CUSHION = 240, SEAT_TILE = 480, WALL_TILE = 240, FG_SLOT = 1300;
  const CITY_SPAN = 420, STAR_SPAN = 320, STAR_H = 220, GARLAND_SPAN = 115;

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
      if (h.length === 3 || h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
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
  const WHITE = [255, 255, 255];

  let reduceMotion = !!G.calm;
  G.on('calm', (v) => { reduceMotion = !!v; });

  // ---------- раскладка по высоте мира ----------
  const geo = { bt: 100, lowC: 45, upC: 0, upSpace: 0, garland: false, garY: 10 };
  function layout() {
    const bt = G.GROUND - 150;
    geo.bt = bt;
    const lift = G.clamp((bt - 110) * 0.18, 0, 24);
    geo.lowC = bt - 22 - lift - 33;
    geo.garland = bt >= 215;
    geo.garY = 10 + G.clamp((bt - 215) * 0.15, 0, 16);
    const top = geo.garland ? geo.garY + 34 : 8;
    const bottom = geo.lowC - 45;
    geo.upSpace = bottom - top;
    geo.upC = (top + bottom) / 2;
  }

  // ---------- палитра ----------
  let P = null, dark = false;
  function buildPalette() {
    dark = G.isDark();
    const C = G.C;
    const wallRGB = parse(C.wall);
    const toRGB = (n, k) => (dark ? mix(hexRGB(n), wallRGB, k === undefined ? 0.45 : k) : hexRGB(n));
    const ph = (n, k) => css(toRGB(n, k));
    P = {
      toRGB, ph,
      wall: C.wall || '#eadcc4', wallRGB,
      ink: C.ink,
      couch: C.couch, couchRGB: parse(C.couch),
      couchHi: C['couch-hi'], couchHiRGB: parse(C['couch-hi']),
      couchLo: C['couch-lo'], couchLoRGB: parse(C['couch-lo']),
      seat: C.seat, seatLo: C['seat-lo'], seatLoRGB: parse(C['seat-lo']),
      bunny: C.bunny || '#fdfcf9', pink: C.pink || '#f0a3ad',
      backFrame: css(mix(parse(C['couch-lo']), [0, 0, 0], dark ? 0.25 : 0.12)),
      posterInk: dark ? '#17110c' : '#2b2219',
      paper: ph(0xfbf6ec, 0.5), cream: ph(0xf5ecd6, 0.5),
      paint: ph(0xf4efe6, 0.6),
      frameBlack: dark ? '#0d0a08' : '#2b241d', frameWhite: ph(0xf7f3ea, 0.55),
      wood: ph(0xc9a27a), woodDk: ph(0x8e6845), woodLt: ph(0xe2c59f), woodInk: dark ? '#1d130c' : '#4a3222',
      gold: ph(0xd8b25c), goldDk: ph(0x9c7026), goldLt: ph(0xf3dc96),
      red: ph(0xb8432c), red2: ph(0xbf4a3c), posterRed: ph(0xff7a52, 0.4), navy: ph(0x243553, 0.35),
      cork: ph(0xc79a62), noteY: ph(0xefd77a), noteB: ph(0xbcd6e6),
      leafA: ph(0x3e7b3a), leafB: ph(0x4a8b42), leafHi: ph(0x86c070), stem: ph(0x5b8a3f),
      snake: ph(0x3f6e3b), snakeEdge: ph(0xd4cf6a), pot: ph(0xc47a55),
      carrotC: ph(0xef8a2c), carrotDk: ph(0xc8641c), leafC: ph(0x5aa04a),
      brass: ph(0xc49a52), shade: ph(0xf0e3c8, 0.55), metal: ph(0x8f8a82), metalDk: ph(0x4f4a44),
      rope: ph(0x9c7b55), wire: dark ? 'rgba(0,0,0,0.6)' : 'rgba(43,34,25,0.55)',
      laptop: ph(0x2e3138, 0.2), screenDim: ph(0x3e4c5e, 0.3), mug: ph(0xefe9df, 0.5),
      duck: ph(0xf2c94c), duckBeak: ph(0xf08a24),
      blue: ph(0x3d6fb6, 0.35), green: ph(0x3a8a4a, 0.35),
    };
  }

  // ---------- спрайты ----------
  let K = 2;
  const S = { ready: false, items: {}, win: [], cush: [], pillows: [], fg: [], fgDark: [], clouds: [] };
  let buildOwner = null;

  function mk(w, h, ox, oy, draw, k) {
    k = k || K;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * k));
    c.height = Math.max(1, Math.ceil(h * k));
    const sp = { c, w: c.width / k, h: c.height / k, ox, oy, k };
    if (buildOwner) buildOwner.sprites.push(sp);
    const x = c.getContext('2d');
    if (x) {
      x.setTransform(k, 0, 0, k, ox * k, oy * k);
      x.lineCap = 'round';
      x.lineJoin = 'round';
      draw(x, sp);
    }
    return sp;
  }
  function freeSprite(sp) {
    if (!sp || !sp.c || sp.c.width <= 1) return 0;
    const bytes = sp.c.width * sp.c.height * 4;
    sp.c.width = 1;
    sp.c.height = 1;
    return bytes;
  }
  const blit = (ctx, sp, x, y) => ctx.drawImage(sp.c, x - sp.ox, y - sp.oy, sp.w, sp.h);
  const glow = (ctx, sp, x, y, rx, ry) => ctx.drawImage(sp.c, x - rx, y - ry, rx * 2, ry * 2);

  function softShadow(c, sp, blur, dy, a) {
    c.shadowColor = `rgba(28,16,6,${dark ? Math.min(0.6, a * 1.6) : a})`;
    c.shadowBlur = blur * sp.k;
    c.shadowOffsetX = 0;
    c.shadowOffsetY = dy * sp.k;
  }
  function haze(c, sp, a) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    c.globalAlpha = a;
    c.fillStyle = P.wall;
    c.fillRect(0, 0, sp.c.width, sp.c.height);
    c.restore();
  }
  function text(c, s, x, y, weight, size, family, color, maxW) {
    font(c, weight, size, family);
    if (maxW) {
      const w = c.measureText(s).width;
      if (w > maxW) font(c, weight, Math.max(1, (size * maxW) / w), family);
    }
    c.fillStyle = color;
    c.fillText(s, x, y);
  }
  function circle(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, Math.max(0, r), 0, TAU);
    c.fill();
  }
  function heartPath(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y + s * 0.9);
    c.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.7, y - s * 1.3, x, y - s * 0.45);
    c.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
    c.closePath();
  }
  function nail(c, x, y) {
    c.fillStyle = P.metalDk;
    circle(c, x, y, 1.5);
    c.fillStyle = 'rgba(255,255,255,0.45)';
    circle(c, x - 0.5, y - 0.5, 0.55);
  }
  function grain(c, x, y, w, h, r, col) {
    c.strokeStyle = col;
    c.lineWidth = 0.6;
    const n = Math.ceil(h / 3.5);
    for (let i = 0; i < n; i++) {
      const yy = y + 1 + r() * (h - 2);
      c.globalAlpha = 0.1 + r() * 0.14;
      c.beginPath();
      c.moveTo(x, yy);
      c.bezierCurveTo(x + w * 0.3, yy + (r() - 0.5) * 3, x + w * 0.7, yy + (r() - 0.5) * 3, x + w, yy + (r() - 0.5) * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
  }
  function carrotIcon(c, x, y, s, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(s, s);
    c.fillStyle = P.leafC;
    ellipse(c, -3, -13, 2.4, 6.5, -0.45);
    ellipse(c, 0, -14, 2.4, 7, 0);
    ellipse(c, 3, -13, 2.4, 6.5, 0.45);
    c.fillStyle = P.carrotC;
    c.beginPath();
    c.moveTo(-7, -8);
    c.quadraticCurveTo(0, -12, 7, -8);
    c.lineTo(1.2, 14);
    c.quadraticCurveTo(0, 16, -1.2, 14);
    c.closePath();
    c.fill();
    c.strokeStyle = P.carrotDk;
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(-4, -3);
    c.lineTo(-1, -3.5);
    c.moveTo(1.5, 2);
    c.lineTo(4, 1.5);
    c.moveTo(-2.5, 7);
    c.lineTo(0, 6.6);
    c.stroke();
    c.restore();
  }

  const FRAME_B = { black: 3, white: 3.4, wood: 4.5, gold: 6 };
  function framed(c, sp, w, h, style, bg, inner) {
    const b = FRAME_B[style], x = -w / 2, y = -h / 2;
    const ix = x + b, iy = y + b, iw = w - 2 * b, ih = h - 2 * b;
    c.save();
    softShadow(c, sp, 7, 3, 0.3);
    c.fillStyle = style === 'black' ? P.frameBlack : style === 'white' ? P.frameWhite : style === 'wood' ? P.wood : P.gold;
    c.fillRect(x, y, w, h);
    c.restore();
    if (style === 'gold' || style === 'wood') {
      c.save();
      c.beginPath();
      c.rect(x, y, w, h);
      c.rect(ix, iy, iw, ih);
      c.clip('evenodd');
      if (style === 'gold') {
        const g = c.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, P.goldLt);
        g.addColorStop(0.45, P.gold);
        g.addColorStop(1, P.goldDk);
        c.fillStyle = g;
        c.fillRect(x, y, w, h);
        c.strokeStyle = 'rgba(255,240,190,0.5)';
        c.lineWidth = 0.7;
        c.strokeRect(x + b * 0.5, y + b * 0.5, w - b, h - b);
        c.fillStyle = 'rgba(80,50,10,0.35)';
        for (let t = x + 3; t < x + w - 2; t += 4.5) {
          circle(c, t, y + b * 0.5, 0.55);
          circle(c, t, y + h - b * 0.5, 0.55);
        }
        for (let t = y + 3; t < y + h - 2; t += 4.5) {
          circle(c, x + b * 0.5, t, 0.55);
          circle(c, x + w - b * 0.5, t, 0.55);
        }
      } else {
        grain(c, x, y, w, h, rng(w * 13 + h), P.woodDk);
      }
      c.restore();
    } else if (style === 'white') {
      c.strokeStyle = 'rgba(0,0,0,0.18)';
      c.lineWidth = 0.6;
      c.strokeRect(x + 0.3, y + 0.3, w - 0.6, h - 0.6);
    }
    c.fillStyle = 'rgba(255,255,255,0.16)';
    c.fillRect(x, y, w, 0.8);
    c.fillRect(x, y, 0.8, h);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(x, y + h - 0.8, w, 0.8);
    c.fillRect(x + w - 0.8, y, 0.8, h);
    c.fillStyle = bg;
    c.fillRect(ix, iy, iw, ih);
    c.save();
    c.beginPath();
    c.rect(ix, iy, iw, ih);
    c.clip();
    c.translate(ix + iw / 2, iy + ih / 2);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    inner(c, iw, ih);
    c.restore();
    c.fillStyle = 'rgba(0,0,0,0.16)';
    c.fillRect(ix, iy, iw, 1.2);
    c.fillRect(ix, iy, 1, ih);
    c.save();
    c.beginPath();
    c.rect(ix, iy, iw, ih);
    c.clip();
    c.fillStyle = 'rgba(255,255,255,0.07)';
    c.beginPath();
    c.moveTo(ix + iw * 0.18, iy);
    c.lineTo(ix + iw * 0.46, iy);
    c.lineTo(ix + iw * 0.06, iy + ih);
    c.lineTo(ix - iw * 0.22, iy + ih);
    c.closePath();
    c.fill();
    c.restore();
  }
  function framedAt(c, sp, x, y, w, h, style, bg, inner) {
    c.save();
    c.translate(x, y);
    framed(c, sp, w, h, style, bg, inner);
    c.restore();
  }

  // ---------- стена ----------
  function buildWallTile() {
    const bt = geo.bt, top = -M, bottom = bt + 34, h = bottom - top;
    return mk(WALL_TILE, h, 0, M, (c) => {
      const r = rng(11);
      c.fillStyle = P.wall;
      c.fillRect(0, top, WALL_TILE, h);
      c.fillStyle = P.ink;
      c.globalAlpha = dark ? 0.014 : 0.02;
      for (let x = 0; x < WALL_TILE; x += 24) c.fillRect(x, top, 12, h);
      c.globalAlpha = dark ? 0.022 : 0.034;
      for (let x = 0; x < WALL_TILE; x += 24) {
        c.fillRect(x + 0.2, top, 0.5, h);
        c.fillRect(x + 11.3, top, 0.5, h);
      }
      c.globalAlpha = dark ? 0.03 : 0.045;
      for (let x = 18, n = 0; x < WALL_TILE; x += 24, n++) {
        for (let y = top + (n % 2) * 16; y < bottom; y += 32) {
          c.beginPath();
          c.moveTo(x, y - 2.2);
          c.lineTo(x + 1.5, y);
          c.lineTo(x, y + 2.2);
          c.lineTo(x - 1.5, y);
          c.closePath();
          c.fill();
        }
      }
      for (let i = 0; i < 520; i++) {
        c.globalAlpha = 0.02 + r() * 0.035;
        c.fillStyle = r() < 0.5 ? P.ink : '#ffffff';
        c.fillRect(1 + r() * (WALL_TILE - 2), top + r() * h, 0.7, 0.7);
      }
      c.globalAlpha = 1;
      const ao = dark ? '0,0,0' : '60,36,14';
      const f = (y) => clamp01((y - top) / h);
      const g = c.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, `rgba(${ao},${dark ? 0.3 : 0.14})`);
      g.addColorStop(f(Math.min(bt * 0.45, bt - 60)), `rgba(${ao},0)`);
      g.addColorStop(f(bt - 46), `rgba(${ao},0)`);
      g.addColorStop(f(bt), `rgba(${ao},${dark ? 0.32 : 0.15})`);
      g.addColorStop(1, `rgba(${ao},${dark ? 0.45 : 0.24})`);
      c.fillStyle = g;
      c.fillRect(0, top, WALL_TILE, h);
    });
  }

  // ---------- окна ----------
  const WIN_DEFS = [
    { gw: 118, cols: 2, transom: 0.3, curtain: 0xc98f6e, blind: 0 },
    { gw: 136, cols: 2, transom: 0.5, curtain: 0x93a487, blind: 0 },
    { gw: 104, cols: 1, transom: 0, curtain: 0, blind: 0.3 },
  ];
  function buildWindow(v) {
    const bt = geo.bt;
    return windowSprite(Object.assign({ top: Math.max(-26, bt - 230), sill: bt - 13, seed: 31 + v }, WIN_DEFS[v]));
  }
  function windowSprite(o) {
    const d = { gw: o.gw || 110, cols: o.cols === 1 ? 1 : 2, transom: o.transom || 0, curtain: o.curtain || 0, blind: o.blind || 0 };
    const bt = geo.bt, ft = 6, mul = 3.6;
    const yT = o.top != null ? o.top : Math.max(-26, bt - 230), sillTop = o.sill != null ? o.sill : bt - 13;
    const frameCol = o.frame || P.paint;
    const v = (o.seed || 31) - 31;
    const gx = -d.gw / 2, gy = yT + ft, gw = d.gw, gh = Math.max(4, sillTop - ft - gy);
    const half = gw / 2 + ft, side = 50;
    const top = yT - 22, bottom = o.bottom != null ? o.bottom : bt + 34;
    const blindH = d.blind ? Math.round(gh * d.blind) : 0;
    const panes = [];
    if (d.cols === 2) {
      const pw = (gw - mul) / 2, ty = gy + Math.round(gh * d.transom);
      for (const px of [gx, gx + pw + mul]) {
        panes.push([px, gy, pw, ty - mul / 2 - gy]);
        panes.push([px, ty + mul / 2, pw, gy + gh - ty - mul / 2]);
      }
    } else {
      panes.push([gx, gy + blindH, gw, gh - blindH]);
    }
    const sp = mk(half * 2 + side * 2, bottom - top, half + side, -top, (c, sp) => {
      const r = rng(31 + v);
      c.save();
      softShadow(c, sp, 9, 2, 0.22);
      c.fillStyle = frameCol;
      c.fillRect(-half, yT, half * 2, sillTop - yT);
      c.restore();
      for (const p of panes) c.clearRect(p[0], p[1], p[2], p[3]);
      c.fillStyle = 'rgba(0,0,0,0.16)';
      for (const p of panes) {
        c.fillRect(p[0] - 0.9, p[1] - 0.9, p[2] + 1.8, 0.9);
        c.fillRect(p[0] - 0.9, p[1], 0.9, p[3]);
      }
      c.fillStyle = 'rgba(255,255,255,0.35)';
      for (const p of panes) c.fillRect(p[0], p[1] + p[3], p[2], 0.8);
      c.strokeStyle = 'rgba(0,0,0,0.12)';
      c.lineWidth = 0.8;
      c.strokeRect(-half + 0.4, yT + 0.4, half * 2 - 0.8, sillTop - yT - 0.8);
      for (const p of panes) {
        c.save();
        c.beginPath();
        c.rect(p[0], p[1], p[2], p[3]);
        c.clip();
        const sx = p[0] + p[2] * (0.2 + r() * 0.3);
        c.fillStyle = 'rgba(255,255,255,0.09)';
        c.beginPath();
        c.moveTo(sx, p[1]);
        c.lineTo(sx + 14, p[1]);
        c.lineTo(sx + 14 - p[3] * 0.5, p[1] + p[3]);
        c.lineTo(sx - p[3] * 0.5, p[1] + p[3]);
        c.closePath();
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.05)';
        c.beginPath();
        c.moveTo(sx + 20, p[1]);
        c.lineTo(sx + 25, p[1]);
        c.lineTo(sx + 25 - p[3] * 0.5, p[1] + p[3]);
        c.lineTo(sx + 20 - p[3] * 0.5, p[1] + p[3]);
        c.closePath();
        c.fill();
        c.restore();
      }
      if (o.tulle) {
        c.save();
        c.beginPath();
        for (const p of panes) c.rect(p[0], p[1], p[2], p[3]);
        c.clip();
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.fillRect(gx, gy, gw, gh);
        c.strokeStyle = 'rgba(255,255,255,0.4)';
        c.lineWidth = 0.7;
        c.beginPath();
        for (let y = gy + 8; y < gy + gh; y += 12) {
          for (let x = gx - 6 + ((y - gy) % 24 ? 6 : 0); x < gx + gw + 6; x += 12) {
            c.moveTo(x + 5, y);
            c.arc(x, y, 5, 0, Math.PI, true);
          }
        }
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.18)';
        for (let x = gx + 4; x < gx + gw; x += 9) c.fillRect(x, gy, 2.2, gh);
        c.restore();
      }
      c.save();
      softShadow(c, sp, 4, 2.5, 0.28);
      c.fillStyle = frameCol;
      rr(c, -half - 10, sillTop, half * 2 + 20, 6, 1.6);
      c.fill();
      c.restore();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(-half - 9, sillTop + 0.5, half * 2 + 18, 0.8);
      c.fillStyle = 'rgba(0,0,0,0.14)';
      c.fillRect(-half - 9, sillTop + 4.6, half * 2 + 18, 1.2);

      if (d.blind) {
        const by = gy + blindH;
        c.fillStyle = P.ph(0xe9dcc4, 0.5);
        c.fillRect(gx - 1, gy, gw + 2, blindH);
        c.fillStyle = 'rgba(0,0,0,0.05)';
        for (let y = gy + 3; y < by; y += 4) c.fillRect(gx - 1, y, gw + 2, 0.6);
        const g = c.createLinearGradient(0, by - 10, 0, by);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.12)');
        c.fillStyle = g;
        c.fillRect(gx - 1, by - 10, gw + 2, 10);
        c.fillStyle = P.woodDk;
        rr(c, gx - 2, by - 1, gw + 4, 3.2, 1.4);
        c.fill();
        c.strokeStyle = P.rope;
        c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(gx + gw - 10, by + 2);
        c.lineTo(gx + gw - 10, by + 16);
        c.stroke();
        c.fillStyle = P.woodDk;
        circle(c, gx + gw - 10, by + 17, 1.3);
      }

      if (d.curtain) {
        const rodY = yT - 12;
        const base = P.toRGB(d.curtain, 0.5);
        const panel = (x0, x1, inner) => {
          const yA = yT - 10, yB = bottom;
          c.save();
          softShadow(c, sp, 6, 2, 0.2);
          c.fillStyle = css(base);
          c.beginPath();
          c.moveTo(x0, yA);
          c.lineTo(x1, yA);
          if (inner > 0) {
            c.bezierCurveTo(x1 + 1.5, yA + 60, x1 - 2, yA + 120, x1 + 1, yB);
            c.lineTo(x0 - 4, yB);
            c.bezierCurveTo(x0 - 2, yA + 120, x0 + 1, yA + 50, x0, yA);
          } else {
            c.lineTo(x1 + 4, yB);
            c.lineTo(x0 - 1, yB);
            c.bezierCurveTo(x0 + 2, yA + 120, x0 - 1.5, yA + 60, x0, yA);
          }
          c.closePath();
          c.fill();
          c.restore();
          c.save();
          c.clip();
          const n = 5, fw = (x1 - x0 + 4) / n;
          for (let i = 0; i < n; i++) {
            const fx = x0 - 2 + i * fw;
            const g = c.createLinearGradient(fx, 0, fx + fw, 0);
            g.addColorStop(0, 'rgba(0,0,0,0.13)');
            g.addColorStop(0.45, 'rgba(255,255,255,0.12)');
            g.addColorStop(1, 'rgba(0,0,0,0.1)');
            c.fillStyle = g;
            c.fillRect(fx, yA, fw, yB - yA);
          }
          c.fillStyle = 'rgba(255,255,255,0.05)';
          for (let y = yA + 2; y < yB; y += 2.6) c.fillRect(x0 - 4, y, x1 - x0 + 8, 0.5);
          const g = c.createLinearGradient(0, yA, 0, yA + 14);
          g.addColorStop(0, 'rgba(0,0,0,0.18)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g;
          c.fillRect(x0 - 4, yA, x1 - x0 + 8, 14);
          c.restore();
          c.strokeStyle = P.brass;
          c.lineWidth = 0.9;
          for (let x = x0 + 3; x < x1; x += 7) {
            c.beginPath();
            c.arc(x, rodY + 0.5, 2.1, 0, TAU);
            c.stroke();
          }
        };
        panel(-half - 34, -gw / 2 - 1, 1);
        panel(gw / 2 + 1, half + 34, -1);
        c.save();
        softShadow(c, sp, 3, 2, 0.25);
        c.strokeStyle = P.woodDk;
        c.lineWidth = 2.4;
        c.beginPath();
        c.moveTo(-half - 44, rodY);
        c.lineTo(half + 44, rodY);
        c.stroke();
        c.fillStyle = P.woodDk;
        circle(c, -half - 46, rodY, 3.2);
        circle(c, half + 46, rodY, 3.2);
        c.restore();
      }
      haze(c, sp, o.haze != null ? o.haze : dark ? 0.14 : 0.08);
    });
    sp.panes = panes;
    sp.glass = { x: gx, y: gy + blindH, w: gw, h: gh - blindH };
    sp.skyTop = gy;
    sp.base = gy + gh;
    return sp;
  }

  // ---------- торшер и растения ----------
  function shadePath(c) {
    c.beginPath();
    c.moveTo(-15, -92);
    c.lineTo(15, -92);
    c.lineTo(25, -58);
    c.lineTo(-25, -58);
    c.closePath();
  }
  function buildLamp() {
    return mk(64, 124, 32, 102, (c, sp) => {
      c.fillStyle = P.brass;
      c.fillRect(-1.4, -60, 2.8, 82);
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.fillRect(-0.9, -60, 0.7, 82);
      c.fillStyle = P.brass;
      circle(c, 0, -95, 2.2);
      c.save();
      softShadow(c, sp, 7, 3, 0.25);
      shadePath(c);
      c.fillStyle = P.shade;
      c.fill();
      c.restore();
      c.save();
      shadePath(c);
      c.clip();
      const g = c.createLinearGradient(-25, 0, 25, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.18)');
      g.addColorStop(0.35, 'rgba(0,0,0,0)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.08)');
      g.addColorStop(1, 'rgba(0,0,0,0.14)');
      c.fillStyle = g;
      c.fillRect(-26, -93, 52, 36);
      c.strokeStyle = 'rgba(0,0,0,0.07)';
      c.lineWidth = 0.6;
      for (let i = -6; i <= 6; i++) {
        c.beginPath();
        c.moveTo(i * 2.4, -92);
        c.lineTo(i * 4, -58);
        c.stroke();
      }
      c.restore();
      c.fillStyle = P.brass;
      c.fillRect(-15, -92.5, 30, 1.4);
      c.fillRect(-25, -59.2, 50, 1.4);
      haze(c, sp, dark ? 0.12 : 0.06);
    });
  }
  function buildLampLit() {
    return mk(64, 124, 32, 102, (c) => {
      shadePath(c);
      const g = c.createLinearGradient(0, -92, 0, -58);
      g.addColorStop(0, '#ffdca0');
      g.addColorStop(1, '#fff3d4');
      c.fillStyle = g;
      c.fill();
      c.save();
      c.clip();
      c.strokeStyle = 'rgba(200,130,50,0.18)';
      c.lineWidth = 0.6;
      for (let i = -6; i <= 6; i++) {
        c.beginPath();
        c.moveTo(i * 2.4, -92);
        c.lineTo(i * 4, -58);
        c.stroke();
      }
      c.restore();
      c.fillStyle = '#fffaf0';
      c.fillRect(-25, -59.6, 50, 1.6);
    });
  }

  function buildMonstera() {
    const W0 = 176, H0 = 164, OX = 88, OY = 138;
    return mk(W0, H0, OX, OY, (c, sp) => {
      const r = rng(41);
      const tmp = document.createElement('canvas');
      tmp.width = sp.c.width;
      tmp.height = sp.c.height;
      const t = tmp.getContext('2d');
      const leaves = [[-1.05, 50, 40], [0.95, 52, 42], [-0.6, 62, 48], [0.55, 60, 46], [-0.2, 72, 50], [0.2, 66, 52], [0.02, 40, 34]];
      for (const [a, sl, ll] of leaves) {
        const bx = Math.sin(a) * sl * 0.85, by = 16 - Math.cos(a) * sl;
        c.strokeStyle = P.stem;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(a * 5, 22);
        c.quadraticCurveTo(bx * 0.25, by * 0.45 + 8, bx, by);
        c.stroke();
        if (!t) continue;
        t.setTransform(1, 0, 0, 1, 0, 0);
        t.globalCompositeOperation = 'source-over';
        t.clearRect(0, 0, tmp.width, tmp.height);
        t.setTransform(sp.k, 0, 0, sp.k, OX * sp.k, OY * sp.k);
        t.translate(bx, by);
        t.rotate(a * 1.08);
        const w = ll * 0.48;
        t.beginPath();
        t.moveTo(0, 2);
        t.bezierCurveTo(-w * 1.25, -ll * 0.05, -w * 1.05, -ll * 0.95, 0, -ll);
        t.bezierCurveTo(w * 1.05, -ll * 0.95, w * 1.25, -ll * 0.05, 0, 2);
        t.fillStyle = r() < 0.5 ? P.leafA : P.leafB;
        t.fill();
        t.save();
        t.clip();
        t.fillStyle = 'rgba(255,255,255,0.09)';
        t.fillRect(0, -ll, w * 1.4, ll + 3);
        t.restore();
        t.globalCompositeOperation = 'destination-out';
        t.lineWidth = ll * 0.045;
        t.lineCap = 'round';
        for (let i = 1; i <= 4; i++) {
          const yy = -ll * (0.16 + i * 0.16);
          for (const s of [-1, 1]) {
            t.beginPath();
            t.moveTo(s * w * 1.3, yy - ll * 0.06);
            t.lineTo(s * w * 0.32, yy + ll * 0.03);
            t.stroke();
            if (i === 2 || i === 3) {
              t.beginPath();
              t.ellipse(s * w * 0.2, yy - ll * 0.07, ll * 0.025, ll * 0.04, 0, 0, TAU);
              t.fill();
            }
          }
        }
        t.globalCompositeOperation = 'source-over';
        t.strokeStyle = P.leafHi;
        t.globalAlpha = 0.55;
        t.lineWidth = 0.9;
        t.beginPath();
        t.moveTo(0, 0);
        t.quadraticCurveTo(-1, -ll * 0.5, 0, -ll * 0.9);
        t.stroke();
        t.globalAlpha = 1;
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(tmp, 0, 0);
        c.restore();
      }
      haze(c, sp, dark ? 0.12 : 0.06);
    });
  }

  function buildSnake() {
    return mk(104, 136, 52, 114, (c, sp) => {
      const blades = [[-20, -0.34, 70, 7], [18, 0.3, 74, 7], [-13, -0.18, 92, 8], [11, 0.15, 88, 8], [-5, -0.07, 104, 9], [4, 0.05, 98, 9.5]];
      for (const [x0, lean, h, w] of blades) {
        const tx = x0 + lean * h;
        c.beginPath();
        c.moveTo(x0 - w / 2, 20);
        c.quadraticCurveTo(x0 + lean * h * 0.45 - w * 0.55, -h * 0.55, tx, -h);
        c.quadraticCurveTo(x0 + lean * h * 0.45 + w * 0.55, -h * 0.55, x0 + w / 2, 20);
        c.closePath();
        c.fillStyle = P.snake;
        c.fill();
        c.save();
        c.clip();
        c.strokeStyle = P.leafHi;
        c.globalAlpha = 0.25;
        c.lineWidth = 1.1;
        for (let y = 14; y > -h; y -= 7) {
          const cx = x0 + lean * (-y);
          c.beginPath();
          c.moveTo(cx - w, y);
          c.lineTo(cx - w * 0.3, y - 2);
          c.lineTo(cx + w * 0.3, y + 0.5);
          c.lineTo(cx + w, y - 2);
          c.stroke();
        }
        c.globalAlpha = 1;
        c.fillStyle = 'rgba(0,0,0,0.12)';
        c.fillRect(x0 + lean * h * 0.5, -h, w, h + 22);
        c.restore();
        c.strokeStyle = P.snakeEdge;
        c.lineWidth = 1.1;
        c.stroke();
      }
      haze(c, sp, dark ? 0.12 : 0.06);
    });
  }

  // ---------- картины и полки ----------
  const ITEMS = {
    live: [176, 60, (c, sp) => {
      c.strokeStyle = P.rope;
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(-70, -13);
      c.lineTo(0, -30);
      c.lineTo(70, -13);
      c.stroke();
      nail(c, 0, -30);
      c.save();
      softShadow(c, sp, 7, 3, 0.3);
      c.fillStyle = P.wood;
      rr(c, -88, -18, 176, 44, 6);
      c.fill();
      c.restore();
      c.save();
      rr(c, -88, -18, 176, 44, 6);
      c.clip();
      grain(c, -88, -18, 176, 44, rng(3), P.woodDk);
      const g = c.createLinearGradient(0, -18, 0, 26);
      g.addColorStop(0, 'rgba(255,255,255,0.14)');
      g.addColorStop(1, 'rgba(0,0,0,0.1)');
      c.fillStyle = g;
      c.fillRect(-88, -18, 176, 44);
      c.restore();
      c.strokeStyle = P.woodDk;
      c.lineWidth = 1;
      rr(c, -87.5, -17.5, 175, 43, 5.5);
      c.stroke();
      c.fillStyle = P.woodDk;
      circle(c, -70, -13, 1.5);
      circle(c, 70, -13, 1.5);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      text(c, 'ЖИВИ', -59, 5, 600, 12, 'display', P.woodInk);
      text(c, 'ЕБЛАНЬ', 0, 4, 700, 20, 'display', P.red, 74);
      text(c, 'ЛЮБИ', 59, 5, 600, 12, 'display', P.woodInk);
      c.fillStyle = P.red;
      heartPath(c, -37, 5, 2.3);
      c.fill();
      heartPath(c, 37, 5, 2.3);
      c.fill();
    }],
    deploy: [110, 66, (c, sp) => {
      framed(c, sp, 110, 66, 'black', P.navy, (c, iw) => {
        c.fillStyle = 'rgba(255,255,255,0.5)';
        const r = rng(9);
        for (let i = 0; i < 14; i++) circle(c, (r() - 0.5) * iw, (r() - 0.5) * 56, 0.35 + r() * 0.35);
        const g = c.createLinearGradient(0, -27, 0, -12);
        g.addColorStop(0, '#ffd36b');
        g.addColorStop(1, '#ff6a3a');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(0, -27);
        c.bezierCurveTo(4, -22, 6.5, -18, 4.5, -14.5);
        c.quadraticCurveTo(0, -11, -4.5, -14.5);
        c.bezierCurveTo(-6, -18, -3, -20, -1, -23);
        c.closePath();
        c.fill();
        c.fillStyle = '#fff1b8';
        ellipse(c, 0, -15.5, 1.6, 2.6);
        text(c, 'НЕ ДЕПЛОЙ', 0, -2, 700, 14, 'display', '#f4efe6', iw - 10);
        text(c, 'В ПЯТНИЦУ', 0, 13, 700, 14, 'display', P.posterRed, iw - 10);
        text(c, 'и в четверг после обеда', 0, 24.5, 500, 5.4, 'body', '#9fb0cc', iw - 8);
      });
    }],
    works: [80, 66, (c, sp) => {
      framed(c, sp, 80, 66, 'white', P.red2, (c, iw) => {
        c.fillStyle = '#fbf3e6';
        c.beginPath();
        c.moveTo(-8, -15);
        c.lineTo(-8, -22);
        c.lineTo(-4, -18.5);
        c.lineTo(0, -24);
        c.lineTo(4, -18.5);
        c.lineTo(8, -22);
        c.lineTo(8, -15);
        c.closePath();
        c.fill();
        c.fillRect(-8, -14, 16, 1.6);
        text(c, 'РАБОТАЕТ', 0, -2, 700, 12.5, 'display', '#fbf3e6', iw - 10);
        c.fillStyle = '#fbf3e6';
        c.fillRect(-6, 6.5, 12, 1.2);
        text(c, 'НЕ ТРОГАЙ', 0, 16, 700, 12.5, 'display', '#fbf3e6', iw - 10);
      });
    }, true],
    todo: [124, 62, (c, sp) => {
      framed(c, sp, 124, 62, 'wood', P.cork, (c, iw, ih) => {
        const r = rng(17);
        c.fillStyle = 'rgba(70,40,10,0.25)';
        for (let i = 0; i < 160; i++) circle(c, (r() - 0.5) * iw, (r() - 0.5) * ih, 0.3 + r() * 0.4);
        const note = (x, y, w, h, rot, col, l1, l2, big) => {
          c.save();
          c.translate(x, y);
          c.rotate(rot);
          c.save();
          softShadow(c, sp, 3, 1.5, 0.3);
          c.fillStyle = col;
          c.fillRect(-w / 2, -h / 2, w, h);
          c.restore();
          if (big) {
            text(c, l1, 0, -5, 600, 8, 'display', P.posterInk);
            text(c, l2, 0, 6, 700, 10.5, 'display', P.red, w - 4);
          } else {
            text(c, l1, 0, -3, 500, 6, 'body', P.posterInk, w - 4);
            text(c, l2, 0, 5, 500, 6, 'body', P.posterInk, w - 4);
          }
          c.fillStyle = big ? '#d9482f' : '#3d6fb6';
          circle(c, 0, -h / 2 + 3, 1.9);
          c.fillStyle = 'rgba(255,255,255,0.6)';
          circle(c, -0.6, -h / 2 + 2.4, 0.6);
          c.restore();
        };
        note(-33, 0, 40, 34, -0.07, P.noteY, 'TODO:', 'ПОТОМ', true);
        note(9, -6, 36, 28, 0.06, P.paper, 'фикс', 'в пятницу');
        note(39, 9, 32, 26, -0.05, P.noteB, 'купить', 'морковь');
      });
    }],
    chart: [134, 64, (c, sp) => {
      framed(c, sp, 134, 64, 'black', P.paper, (c, iw) => {
        text(c, 'ПРОДУКТИВНОСТЬ vs ЕБЛАНСТВО', 0, -21.5, 600, 7, 'display', P.posterInk, iw - 10);
        c.strokeStyle = 'rgba(0,0,0,0.1)';
        c.lineWidth = 0.5;
        c.beginPath();
        for (const y of [-6, 3, 12]) {
          c.moveTo(-54, y);
          c.lineTo(56, y);
        }
        c.stroke();
        c.strokeStyle = P.posterInk;
        c.globalAlpha = 0.75;
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(-56, -15);
        c.lineTo(-56, 20);
        c.lineTo(58, 20);
        c.stroke();
        c.globalAlpha = 1;
        const line = (pts, col) => {
          c.strokeStyle = col;
          c.lineWidth = 1.6;
          c.beginPath();
          c.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
          c.stroke();
        };
        line([-54, -10, -34, -9, -14, -3, 6, 9, 26, 15, 54, 18], P.blue);
        line([-54, 18, -34, 16, -14, 11, 6, 2, 26, -6, 54, -13], P.red);
        c.strokeStyle = P.posterInk;
        c.lineWidth = 0.8;
        c.beginPath();
        c.arc(-1, 5, 2.2, 0, TAU);
        c.stroke();
        c.beginPath();
        c.moveTo(0.6, 3.4);
        c.lineTo(12, -7);
        c.stroke();
        text(c, '11:56', 19, -9, 600, 6, 'body', P.posterInk);
        c.fillStyle = P.blue;
        c.fillRect(-48, 24, 4, 2.4);
        c.fillStyle = P.red;
        c.fillRect(2, 24, 4, 2.4);
        c.textAlign = 'left';
        text(c, 'работа', -42, 25.3, 500, 5.2, 'body', P.posterInk);
        text(c, 'ебланство', 8, 25.3, 500, 5.2, 'body', P.posterInk);
      });
    }],
    portrait: [60, 66, (c, sp) => {
      framed(c, sp, 60, 66, 'gold', P.ph(0x2e4b3c, 0.35), (c, iw, ih) => {
        const g = c.createRadialGradient(0, -4, 2, 0, 0, 34);
        g.addColorStop(0, 'rgba(255,255,255,0.12)');
        g.addColorStop(1, 'rgba(0,0,0,0.3)');
        c.fillStyle = g;
        c.fillRect(-iw / 2, -ih / 2, iw, ih);
        c.fillStyle = P.ph(0x5a2a2a, 0.35);
        ellipse(c, 0, 26, 19, 12);
        c.fillStyle = P.bunny;
        c.globalAlpha = 0.92;
        ellipse(c, -5.5, -16, 3.2, 9.5, -0.18);
        ellipse(c, 5.5, -16, 3.2, 9.5, 0.18);
        c.globalAlpha = 0.6;
        c.fillStyle = P.pink;
        ellipse(c, -5.3, -16, 1.4, 6.5, -0.18);
        ellipse(c, 5.3, -16, 1.4, 6.5, 0.18);
        c.globalAlpha = 1;
        c.fillStyle = P.bunny;
        circle(c, 0, -2, 9.5);
        c.fillStyle = '#f7f2ea';
        c.strokeStyle = 'rgba(0,0,0,0.25)';
        c.lineWidth = 0.5;
        c.beginPath();
        for (let i = 0; i <= 16; i++) {
          const a = (i / 16) * TAU, rad = i % 2 ? 11 : 14;
          const x = Math.cos(a) * rad, y = 11 + Math.sin(a) * rad * 0.32;
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        }
        c.closePath();
        c.fill();
        c.stroke();
        c.fillStyle = '#2a2118';
        circle(c, -3.6, -3, 1.1);
        circle(c, 3.6, -3, 1.1);
        c.fillStyle = P.pink;
        ellipse(c, 0, 1, 1.4, 1);
        c.strokeStyle = P.goldLt;
        c.lineWidth = 0.7;
        c.beginPath();
        c.arc(3.6, -3, 2.6, 0, TAU);
        c.stroke();
        c.beginPath();
        c.moveTo(6, -2);
        c.quadraticCurveTo(9, 6, 6, 12);
        c.stroke();
      });
      c.fillStyle = P.goldDk;
      rr(c, -12, 27.5, 24, 4.5, 1);
      c.fill();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      text(c, 'СЭР КРОЛЬ', 0, 29.8, 600, 3.4, 'body', P.goldLt, 22);
    }, true],
    carrot: [58, 66, (c, sp) => {
      framed(c, sp, 58, 66, 'black', P.paper, (c, iw, ih) => {
        c.fillStyle = P.ph(0xf6d9c4, 0.5);
        c.fillRect(-iw / 2 + 6, -ih / 2 + 6, iw - 12, ih - 17);
        carrotIcon(c, 0, -3, 1.15, -0.45);
        text(c, 'МОРКОВЬ, 2026', 0, ih / 2 - 5.5, 500, 3.6, 'body', 'rgba(60,45,30,0.75)', iw - 8);
      });
    }, true],
    shelf: [160, 66, (c, sp) => {
      const by = 4;
      const books = [[-74, 6, 26, 0xa8493c], [-67.5, 7, 22, 0x3c5372], [-60, 5.5, 28, 0xc99a3c], [-54, 6.5, 24, 0x5e7d55]];
      for (const [x, w, h, col] of books) {
        c.fillStyle = P.ph(col);
        c.fillRect(x, by - h, w, h);
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillRect(x, by - h + 4, w, 1);
        c.fillRect(x, by - 6, w, 1);
        c.fillStyle = 'rgba(0,0,0,0.15)';
        c.fillRect(x + w - 1, by - h, 1, h);
      }
      c.save();
      c.translate(-44, by);
      c.rotate(0.28);
      c.fillStyle = P.ph(0x7f6a9a);
      c.fillRect(-6.5, -25, 6.5, 25);
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.fillRect(-6.5, -21, 6.5, 1);
      c.restore();
      c.fillStyle = P.duck;
      ellipse(c, -20, by - 5, 7.5, 5);
      circle(c, -16.5, by - 12, 4.2);
      c.fillStyle = P.duckBeak;
      ellipse(c, -11.8, by - 11.3, 2.4, 1.3);
      c.fillStyle = '#2a2118';
      circle(c, -15.3, by - 13, 0.75);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      ellipse(c, -22, by - 7, 3, 1.6, -0.3);
      c.fillStyle = P.pot;
      rr(c, 4, by - 9, 11, 9, 1.5);
      c.fill();
      c.fillStyle = P.leafB;
      ellipse(c, 9.5, by - 16, 3.6, 7.5);
      ellipse(c, 5.5, by - 15, 1.6, 3.2, -0.6);
      ellipse(c, 13.5, by - 17, 1.6, 3.2, 0.6);
      c.fillStyle = P.pot;
      rr(c, 40, by - 14, 16, 14, 2);
      c.fill();
      c.fillStyle = 'rgba(0,0,0,0.15)';
      c.fillRect(40, by - 14, 16, 2.4);
      const leaf = (x, y, s, rot) => {
        c.fillStyle = P.leafA;
        c.save();
        c.translate(x, y);
        c.rotate(rot);
        heartPath(c, 0, 0, s);
        c.fill();
        c.restore();
      };
      c.strokeStyle = P.stem;
      c.lineWidth = 0.9;
      const vines = [[44, 22, 0], [52, 30, 1.3], [57, 16, 2.4]];
      for (const [vx, len, ph] of vines) {
        c.beginPath();
        c.moveTo(vx, by - 12);
        for (let y = 0; y <= len; y += 3) c.lineTo(vx + Math.sin(y * 0.25 + ph) * 2.5, by + y);
        c.stroke();
        for (let y = 4; y <= len; y += 6) leaf(vx + Math.sin(y * 0.25 + ph) * 2.5 + 1.5, by + y, 2.3, 0.4 + ph);
      }
      leaf(44, by - 17, 3, -0.4);
      leaf(50, by - 20, 3.4, 0.1);
      leaf(55, by - 16, 3, 0.6);
      c.save();
      softShadow(c, sp, 5, 3, 0.3);
      c.fillStyle = P.wood;
      c.fillRect(-80, by, 160, 5);
      c.restore();
      c.fillStyle = P.woodLt;
      c.fillRect(-80, by, 160, 1);
      c.fillStyle = P.metalDk;
      for (const x of [-56, 56]) {
        c.fillRect(x - 1, by + 5, 2, 9);
        c.fillRect(x - 1, by + 5, 7, 1.8);
      }
      for (const [vx, len, ph] of vines) {
        if (len < 20) continue;
        c.strokeStyle = P.stem;
        c.beginPath();
        c.moveTo(vx + Math.sin(5 * 0.25 + ph) * 2.5, by + 5);
        for (let y = 6; y <= len; y += 3) c.lineTo(vx + Math.sin(y * 0.25 + ph) * 2.5, by + y);
        c.stroke();
        for (let y = 10; y <= len; y += 6) leaf(vx + Math.sin(y * 0.25 + ph) * 2.5 + 1.5, by + y, 2.3, 0.4 + ph);
      }
    }],
    neon: [152, 52, (c, sp) => {
      c.save();
      softShadow(c, sp, 6, 3, 0.18);
      c.fillStyle = dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.3)';
      rr(c, -76, -25, 152, 50, 7);
      c.fill();
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 0.8;
      rr(c, -75.5, -24.5, 151, 49, 6.5);
      c.stroke();
      c.fillStyle = P.metal;
      for (const [x, y] of [[-70, -19], [70, -19], [-70, 19], [70, 19]]) circle(c, x, y, 1.6);
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.25)';
      c.shadowBlur = 2 * sp.k;
      c.shadowOffsetY = 2 * sp.k;
      neonStroke(c, P.ph(0xf2c3d3, 0.55), 2.6);
      c.restore();
      neonStroke(c, 'rgba(255,255,255,0.35)', 0.8);
    }],
    desk: [160, 56, (c, sp) => {
      const py = 18;
      c.fillStyle = P.laptop;
      rr(c, -62, -16, 48, 32, 2);
      c.fill();
      c.fillStyle = P.screenDim;
      c.fillRect(-59.5, -13.5, 43, 26);
      c.globalAlpha = 0.35;
      const r = rng(23);
      for (let y = -11; y < 11; y += 3) {
        c.fillStyle = r() < 0.5 ? '#8fb3d9' : '#b9c7d6';
        c.fillRect(-57 + r() * 6, y, 8 + r() * 22, 1.2);
      }
      c.globalAlpha = 1;
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.beginPath();
      c.moveTo(-50, -13.5);
      c.lineTo(-40, -13.5);
      c.lineTo(-52, 12.5);
      c.lineTo(-59.5, 12.5);
      c.closePath();
      c.fill();
      c.fillStyle = P.metal;
      rr(c, -67, py - 4, 58, 4, 1.4);
      c.fill();
      c.fillStyle = P.mug;
      rr(c, 2, 2, 12, py - 2, 2);
      c.fill();
      c.strokeStyle = P.mug;
      c.lineWidth = 1.8;
      c.beginPath();
      c.arc(15, py - 9, 3.6, -1.2, 1.2);
      c.stroke();
      c.fillStyle = P.red;
      heartPath(c, 8, 9, 2.2);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(6, -1);
      c.bezierCurveTo(4, -5, 8, -7, 6, -11);
      c.moveTo(10, -2);
      c.bezierCurveTo(8, -6, 12, -8, 10, -12);
      c.stroke();
      c.fillStyle = P.pot;
      rr(c, 30, py - 9, 12, 9, 1.5);
      c.fill();
      c.fillStyle = P.leafB;
      for (let i = 0; i < 5; i++) ellipse(c, 36 + (i - 2) * 2.2, py - 11 - (2 - Math.abs(i - 2)) * 1.5, 1.8, 3.4, (i - 2) * 0.45);
      c.fillStyle = P.ph(0x3c5372);
      c.fillRect(52, py - 4, 22, 4);
      c.fillStyle = P.ph(0xc99a3c);
      c.fillRect(54, py - 7.5, 19, 3.5);
      c.save();
      softShadow(c, sp, 5, 3, 0.3);
      c.fillStyle = P.wood;
      c.fillRect(-78, py, 156, 6);
      c.restore();
      c.fillStyle = P.woodLt;
      c.fillRect(-78, py, 156, 1);
      c.fillStyle = P.metalDk;
      for (const x of [-60, 60]) {
        c.beginPath();
        c.moveTo(x, py + 6);
        c.lineTo(x + 6, py + 6);
        c.lineTo(x, py + 13);
        c.closePath();
        c.fill();
      }
    }],
    diploma: [98, 64, (c, sp) => {
      framed(c, sp, 98, 64, 'black', P.cream, (c, iw, ih) => {
        c.strokeStyle = P.gold;
        c.lineWidth = 0.6;
        c.strokeRect(-iw / 2 + 3, -ih / 2 + 3, iw - 6, ih - 6);
        c.strokeRect(-iw / 2 + 4.6, -ih / 2 + 4.6, iw - 9.2, ih - 9.2);
        text(c, 'ДИПЛОМ', 0, -16, 700, 11, 'display', P.ph(0x6b4a2a, 0.3));
        text(c, 'мастера ебланства', 0, -4.5, 600, 6.4, 'body', P.ph(0x5b4630, 0.3), iw - 14);
        text(c, 'первой степени', 0, 4, 500, 5, 'body', P.ph(0x7a6750, 0.3), iw - 14);
        c.strokeStyle = P.ph(0x2b3a5a, 0.3);
        c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(-34, 17);
        c.bezierCurveTo(-30, 10, -26, 20, -22, 13);
        c.bezierCurveTo(-19, 9, -17, 19, -12, 15);
        c.lineTo(-6, 16);
        c.stroke();
        c.fillStyle = P.gold;
        c.beginPath();
        c.moveTo(25, 18);
        c.lineTo(22, 26);
        c.lineTo(25, 24);
        c.lineTo(27, 27);
        c.closePath();
        c.fill();
        c.fillStyle = P.red;
        c.beginPath();
        c.moveTo(29, 18);
        c.lineTo(32, 27);
        c.lineTo(30, 25);
        c.lineTo(28, 27);
        c.closePath();
        c.fill();
        c.fillStyle = P.gold;
        circle(c, 27, 14, 6.5);
        c.strokeStyle = P.goldLt;
        c.lineWidth = 0.6;
        c.beginPath();
        c.arc(27, 14, 4.8, 0, TAU);
        c.stroke();
      });
    }, true],
    trio: [150, 66, (c, sp) => {
      framedAt(c, sp, -52, -4, 36, 46, 'black', P.ph(0x1c2620, 0.3), (c) => {
        text(c, 'LGTM', 0, -3, 700, 10, 'display', '#7fe08a');
        c.strokeStyle = '#7fe08a';
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(-4, 9);
        c.lineTo(-1, 12);
        c.lineTo(5, 5);
        c.stroke();
      });
      framedAt(c, sp, -6, 10, 34, 30, 'white', P.paper, (c) => {
        text(c, '200', 0, -3, 700, 11, 'display', P.green);
        text(c, 'OK', 0, 7, 700, 7, 'display', P.green);
      });
      framedAt(c, sp, 46, -8, 44, 32, 'wood', P.paper, (c) => {
        text(c, 'Ctrl+Z', 0, -1, 700, 9.5, 'display', P.red2);
        c.strokeStyle = P.red2;
        c.lineWidth = 0.8;
        c.beginPath();
        c.arc(0, 9, 4, Math.PI * 1.1, Math.PI * 1.95);
        c.stroke();
      });
    }],
    frames2: [112, 46, (c, sp) => {
      framedAt(c, sp, -29, 0, 50, 42, 'black', P.paper, (c) => {
        text(c, 'ЭТО', 0, -7, 600, 8, 'display', P.posterInk);
        text(c, 'НЕ БАГ', 0, 5, 700, 11, 'display', P.posterInk, 40);
      });
      framedAt(c, sp, 29, 0, 50, 42, 'black', P.navy, (c) => {
        text(c, 'ЭТО', 0, -7, 600, 8, 'display', '#cfd8e6');
        text(c, 'ФИЧА', 0, 5, 700, 11, 'display', '#ffcf5a', 40);
      });
    }],
    macrame: [46, 64, (c, sp) => {
      c.strokeStyle = P.ph(0xe8dcc4, 0.5);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(0, -29, 2.4, 0, TAU);
      c.stroke();
      c.lineWidth = 0.9;
      c.beginPath();
      for (const s of [-1, -0.35, 0.35, 1]) {
        c.moveTo(0, -27);
        c.quadraticCurveTo(s * 6, -14, s * 11, 2);
      }
      c.moveTo(-8, -10);
      c.lineTo(-3, -4);
      c.lineTo(3, -10);
      c.moveTo(3, -4);
      c.lineTo(8, -10);
      c.stroke();
      c.save();
      softShadow(c, sp, 4, 2, 0.25);
      c.fillStyle = P.pot;
      rr(c, -10, 0, 20, 14, 2.5);
      c.fill();
      c.restore();
      c.fillStyle = 'rgba(0,0,0,0.15)';
      c.fillRect(-10, 0, 20, 2.4);
      c.strokeStyle = P.ph(0xe8dcc4, 0.5);
      c.beginPath();
      for (const s of [-1, -0.35, 0.35, 1]) {
        c.moveTo(s * 10.5, 2);
        c.lineTo(s * 9, 14);
        c.lineTo(0, 22);
      }
      for (let i = -2; i <= 2; i++) {
        c.moveTo(0, 22);
        c.lineTo(i * 1.2, 31);
      }
      c.stroke();
      c.fillStyle = P.leafA;
      for (let i = 0; i < 7; i++) ellipse(c, -8 + i * 2.7, -3 - Math.sin(i * 0.9) * 2, 2.6, 3.6, (i - 3) * 0.3);
      c.strokeStyle = P.stem;
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(9, 1);
      c.bezierCurveTo(16, 8, 12, 18, 16, 28);
      c.moveTo(-9, 1);
      c.bezierCurveTo(-15, 6, -13, 12, -16, 18);
      c.stroke();
      c.fillStyle = P.leafB;
      for (const [x, y] of [[13, 8], [14, 15], [14.5, 22], [16, 28], [-13, 6], [-14, 12], [-16, 18]]) ellipse(c, x, y, 2, 2.8, 0.5);
    }],
    shelf2: [112, 42, (c, sp) => {
      const by = 10;
      const cols = [0x8f4a3c, 0x46607e, 0xd0a54c];
      for (let i = 0; i < 3; i++) {
        c.fillStyle = P.ph(cols[i]);
        c.fillRect(-46 + i * 1.5, by - 5 - i * 5, 30 - i * 3, 5);
        c.fillStyle = 'rgba(255,255,255,0.3)';
        c.fillRect(-46 + i * 1.5, by - 5 - i * 5 + 1.6, 30 - i * 3, 0.7);
      }
      c.fillStyle = P.duck;
      ellipse(c, -34, by - 19, 5, 3.4);
      circle(c, -31.5, by - 23.5, 2.8);
      c.fillStyle = P.duckBeak;
      ellipse(c, -28.4, by - 23, 1.6, 0.9);
      framedAt(c, sp, 4, by - 12, 20, 24, 'black', P.ph(0xf6d9c4, 0.5), (c) => {
        c.fillStyle = '#f2a05a';
        circle(c, 0, 0, 4);
        c.fillStyle = P.ph(0x6b8db5, 0.4);
        c.fillRect(-10, 3, 20, 10);
      });
      c.fillStyle = P.pot;
      rr(c, 30, by - 8, 10, 8, 1.5);
      c.fill();
      c.fillStyle = P.leafB;
      ellipse(c, 35, by - 14, 3.2, 6);
      c.save();
      softShadow(c, sp, 5, 3, 0.3);
      c.fillStyle = P.wood;
      c.fillRect(-54, by, 108, 4.5);
      c.restore();
      c.fillStyle = P.woodLt;
      c.fillRect(-54, by, 108, 1);
    }],
    pennant: [134, 36, (c, sp) => {
      const cols = [0xd98b5f, 0x8fa98a, 0xd9b25a, 0x7f98b5];
      const word = 'ПЯТНИЦА';
      const bez = (t, a, b, m) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * m + t * t * b;
      nail(c, -64, -14);
      nail(c, 64, -14);
      c.strokeStyle = P.rope;
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(-64, -14);
      c.quadraticCurveTo(0, 6, 64, -14);
      c.stroke();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (let i = 0; i < word.length; i++) {
        const t = (i + 0.5) / word.length;
        const x = bez(t, -64, 64, 0), y = bez(t, -14, -14, 6);
        const ang = (t - 0.5) * 0.5;
        c.save();
        c.translate(x, y);
        c.rotate(ang);
        c.save();
        softShadow(c, sp, 3, 2, 0.25);
        c.fillStyle = P.ph(cols[i % 4]);
        c.beginPath();
        c.moveTo(-7.5, 0);
        c.lineTo(7.5, 0);
        c.lineTo(0, 17);
        c.closePath();
        c.fill();
        c.restore();
        text(c, word[i], 0, 5.5, 700, 7, 'display', '#fbf6ec');
        c.restore();
      }
    }],
    calendar: [48, 62, (c, sp) => {
      c.strokeStyle = P.rope;
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(-10, -24);
      c.lineTo(0, -30);
      c.lineTo(10, -24);
      c.stroke();
      nail(c, 0, -30);
      c.save();
      softShadow(c, sp, 6, 3, 0.3);
      c.fillStyle = P.paper;
      c.fillRect(-22, -24, 44, 52);
      c.restore();
      c.fillStyle = P.red2;
      c.fillRect(-22, -24, 44, 12);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      text(c, 'ДЕДЛАЙН', 0, -17.6, 700, 7, 'display', '#fbf6ec', 40);
      c.fillStyle = P.metalDk;
      for (let x = -18; x <= 18; x += 4) c.fillRect(x - 0.5, -26, 1, 3.5);
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const x = -18 + col * 9, y = -8 + row * 7;
          c.fillStyle = 'rgba(0,0,0,0.08)';
          c.fillRect(x - 0.5, y - 0.5, 7, 5.5);
          const n = row * 5 + col;
          if (n === 17) {
            c.strokeStyle = P.red;
            c.lineWidth = 0.9;
            c.beginPath();
            c.ellipse(x + 3, y + 2.2, 4.6, 3.6, 0, 0, TAU);
            c.stroke();
          } else if (n < 17) {
            c.strokeStyle = P.red;
            c.lineWidth = 0.7;
            c.beginPath();
            c.moveTo(x + 0.6, y + 0.2);
            c.lineTo(x + 5.6, y + 4.3);
            c.moveTo(x + 5.6, y + 0.2);
            c.lineTo(x + 0.6, y + 4.3);
            c.stroke();
          }
        }
      }
    }],
  };
  const LOWER = ['live', 'deploy', 'works', 'todo', 'chart', 'portrait', 'carrot', 'shelf', 'neon', 'desk', 'diploma', 'trio'];
  const UPPER = ['frames2', 'macrame', 'shelf2', 'pennant', 'calendar', null];

  function neonStroke(c, color, lw) {
    font(c, 500, 29, 'display');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.strokeText('ЕБЛАНЬ', -10, 1);
    heartPath(c, 54, 1, 6.5);
    c.stroke();
  }
  function buildItem(id) {
    const [w, h, draw, narrow] = ITEMS[id];
    const pad = 16;
    const sp = mk(w + pad * 2, h + pad * 2, w / 2 + pad, h / 2 + pad, (c, sp) => {
      draw(c, sp);
      haze(c, sp, dark ? 0.16 : 0.09);
    });
    sp.hw = w / 2;
    sp.hh = h / 2;
    sp.narrow = !!narrow;
    return sp;
  }
  function buildNeonLit() {
    S.neonOn = mk(184, 84, 92, 42, (c) => {
      neonStroke(c, '#ff4f9e', 3.2);
      neonStroke(c, '#ffe9f3', 1.1);
    });
    S.neonGlow = mk(200, 100, 100, 50, (c, sp) => {
      c.shadowColor = '#ff2d8a';
      c.shadowBlur = 12 * sp.k;
      neonStroke(c, 'rgba(255,70,150,0.85)', 4);
      neonStroke(c, 'rgba(255,70,150,0.6)', 4);
    }, Math.min(K, 1.5));
  }
  function buildScreenOn() {
    S.screenOn = mk(64, 40, 70, 20, (c) => {
      c.fillStyle = '#121a26';
      c.fillRect(-59.5, -13.5, 43, 26);
      const r = rng(23);
      const cols = ['#7fd88f', '#7fb6ff', '#ffb46b', '#ff7fb0', '#e8eef6'];
      for (let y = -11; y < 11; y += 3) {
        const indent = r() < 0.5 ? 0 : 4;
        let x = -57 + indent;
        const parts = 1 + Math.floor(r() * 3);
        for (let p = 0; p < parts && x < -20; p++) {
          const w = 4 + r() * 10;
          c.fillStyle = cols[Math.floor(r() * cols.length)];
          c.fillRect(x, y, Math.min(w, -19 - x), 1.2);
          x += w + 2;
        }
      }
      c.fillStyle = '#e8eef6';
      c.fillRect(-40, 8.5, 2, 2.6);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(-59.5, -13.5, 43, 6);
    });
  }

  // ---------- диван ----------
  function cushionShape(c, x, w, h, bulge) {
    c.beginPath();
    c.moveTo(x, h);
    c.lineTo(x, 24);
    c.quadraticCurveTo(x, 0, x + 26, -1);
    c.quadraticCurveTo(x + w / 2, -2 - bulge, x + w - 26, -1);
    c.quadraticCurveTo(x + w, 0, x + w, 24);
    c.lineTo(x + w, h);
    c.closePath();
  }
  function tuft(c, x, y) {
    const g = c.createRadialGradient(x, y, 0, x, y, 15);
    g.addColorStop(0, css(P.couchLoRGB, 0.6));
    g.addColorStop(1, css(P.couchLoRGB, 0));
    c.fillStyle = g;
    c.fillRect(x - 15, y - 15, 30, 30);
    c.lineWidth = 1;
    for (const [dx, dy] of [[-12, -9], [12, -9], [-12, 9], [12, 9]]) {
      c.strokeStyle = css(P.couchLoRGB, 0.45);
      c.beginPath();
      c.moveTo(x + dx * 0.25, y + dy * 0.25);
      c.quadraticCurveTo(x + dx * 0.6, y + dy * 0.4, x + dx, y + dy);
      c.stroke();
      c.strokeStyle = css(P.couchHiRGB, 0.35);
      c.beginPath();
      c.moveTo(x + dx * 0.25, y + dy * 0.25 + 1.2);
      c.quadraticCurveTo(x + dx * 0.6, y + dy * 0.4 + 1.2, x + dx, y + dy + 1.2);
      c.stroke();
    }
    c.fillStyle = P.couchLo;
    circle(c, x, y, 3.3);
    c.fillStyle = css(P.couchHiRGB, 0.8);
    circle(c, x - 0.9, y - 1, 1.1);
  }
  function buildCushion(v) {
    return mk(CUSHION, 188, 0, 10, (c, sp) => {
      const r = rng(101 + v * 17);
      const x = 4, w = CUSHION - 8, h = 176, bulge = 2 + v * 1.5;
      c.save();
      softShadow(c, sp, 6, 2, 0.28);
      cushionShape(c, x, w, h, bulge);
      c.fillStyle = P.couch;
      c.fill();
      c.restore();
      c.save();
      cushionShape(c, x, w, h, bulge);
      c.clip();
      let g = c.createLinearGradient(0, -4, 0, h);
      g.addColorStop(0, P.couchHi);
      g.addColorStop(0.2, P.couch);
      g.addColorStop(0.7, P.couch);
      g.addColorStop(1, P.couchLo);
      c.fillStyle = g;
      c.fillRect(0, -6, CUSHION, h + 6);
      g = c.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, css(P.couchLoRGB, 0.6));
      g.addColorStop(0.12, css(P.couchLoRGB, 0));
      g.addColorStop(0.88, css(P.couchLoRGB, 0));
      g.addColorStop(1, css(P.couchLoRGB, 0.65));
      c.fillStyle = g;
      c.fillRect(x, -6, w, h + 6);
      c.globalAlpha = 0.5;
      c.fillStyle = P.couchHi;
      rr(c, x + 16, 5, w - 32, 26, 13);
      c.fill();
      c.globalAlpha = dark ? 0.028 : 0.035;
      c.fillStyle = P.ink;
      for (let yy = 0; yy < h; yy += 2.2) c.fillRect(x, yy, w, 0.5);
      c.globalAlpha = dark ? 0.018 : 0.025;
      for (let xx = x; xx < x + w; xx += 2.2) c.fillRect(xx, -4, 0.5, h);
      for (let i = 0; i < 280; i++) {
        c.globalAlpha = 0.04 + r() * 0.05;
        c.fillStyle = r() < 0.5 ? P.couchHi : P.couchLo;
        c.fillRect(x + r() * w, r() * h, 1.6 + r() * 2.4, 0.6);
      }
      c.globalAlpha = 1;
      const by = 80 - (v === 2 ? 6 : 0);
      const buttons = v === 1 ? [0.22, 0.5, 0.78] : [0.3, 0.7];
      for (const f of buttons) tuft(c, x + w * f, by + (v === 1 && f === 0.5 ? 12 : 0));
      for (let i = 0; i < 5; i++) {
        const cx = x + 20 + r() * (w - 40), cy = 40 + r() * 90, len = 12 + r() * 18, dir = r() < 0.5 ? -1 : 1;
        c.lineWidth = 1.1;
        c.strokeStyle = css(P.couchLoRGB, 0.3);
        c.beginPath();
        c.moveTo(cx, cy);
        c.quadraticCurveTo(cx + len * 0.5, cy + dir * 4, cx + len, cy + dir * 2);
        c.stroke();
        c.strokeStyle = css(P.couchHiRGB, 0.25);
        c.beginPath();
        c.moveTo(cx, cy + 1.3);
        c.quadraticCurveTo(cx + len * 0.5, cy + dir * 4 + 1.3, cx + len, cy + dir * 2 + 1.3);
        c.stroke();
      }
      g = c.createLinearGradient(0, h - 56, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${dark ? 0.35 : 0.22})`);
      c.fillStyle = g;
      c.fillRect(x, h - 56, w, 56);
      c.restore();
      c.strokeStyle = css(P.couchLoRGB, 0.55);
      c.lineWidth = 1.1;
      cushionShape(c, x + 2.5, w - 5, h, bulge);
      c.stroke();
    });
  }

  const PILLOWS = [[0x9aae8c, 'stripes'], [0xc77a5c, 'carrot'], [0xd4a64a, 'knit'], [0x8aa0b8, 'dots'], [0xeee3d0, 'text']];
  function pillowPath(c) {
    c.beginPath();
    c.moveTo(-33, -28);
    c.quadraticCurveTo(0, -34, 33, -28);
    c.quadraticCurveTo(39, 0, 33, 28);
    c.quadraticCurveTo(0, 33, -33, 28);
    c.quadraticCurveTo(-39, 0, -33, -28);
    c.closePath();
  }
  function buildPillow(i) {
    return mk(96, 90, 48, 45, (c, sp) => {
      const [col, pat] = PILLOWS[i];
      const base = dark ? mix(hexRGB(col), P.couchRGB, 0.5) : hexRGB(col);
      const lite = css(mix(base, WHITE, 0.32)), deep = css(mix(base, [0, 0, 0], 0.25));
      c.save();
      softShadow(c, sp, 6, 3, 0.32);
      pillowPath(c);
      c.fillStyle = css(base);
      c.fill();
      c.restore();
      c.save();
      pillowPath(c);
      c.clip();
      if (pat === 'stripes') {
        c.fillStyle = lite;
        for (let y = -32; y < 34; y += 10) c.fillRect(-40, y, 80, 3.4);
      } else if (pat === 'carrot') {
        c.strokeStyle = lite;
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(0, 0, 15, 0, TAU);
        c.stroke();
        carrotIcon(c, 0, 1, 0.75, 0.5);
      } else if (pat === 'knit') {
        c.strokeStyle = deep;
        c.globalAlpha = 0.4;
        c.lineWidth = 0.8;
        c.beginPath();
        for (let y = -32; y < 34; y += 4) {
          for (let x = -38; x < 40; x += 4) {
            c.moveTo(x, y);
            c.lineTo(x + 2, y + 2.5);
            c.lineTo(x + 4, y);
          }
        }
        c.stroke();
        c.globalAlpha = 1;
      } else if (pat === 'dots') {
        c.fillStyle = lite;
        for (let y = -30, n = 0; y < 34; y += 8, n++) for (let x = -38 + (n % 2) * 4; x < 40; x += 8) circle(c, x, y, 1.5);
      } else {
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        text(c, 'НЕ БУДИТЬ', 0, -2, 600, 9.5, 'display', P.ph(0x8a6a4a, 0.3), 54);
        text(c, 'z z z', 9, 10, 600, 6, 'display', P.ph(0x8a6a4a, 0.3));
      }
      const g = c.createRadialGradient(-8, -10, 4, 0, 0, 46);
      g.addColorStop(0, 'rgba(255,255,255,0.2)');
      g.addColorStop(0.55, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.3)');
      c.fillStyle = g;
      c.fillRect(-44, -40, 88, 80);
      c.strokeStyle = 'rgba(0,0,0,0.12)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-30, -22);
      c.quadraticCurveTo(-24, -20, -20, -24);
      c.moveTo(30, 22);
      c.quadraticCurveTo(24, 20, 20, 24);
      c.stroke();
      c.restore();
      c.strokeStyle = deep;
      c.globalAlpha = 0.55;
      c.lineWidth = 1;
      pillowPath(c);
      c.stroke();
      c.globalAlpha = 1;
    });
  }

  function buildPlaid() {
    return mk(136, 100, 68, 12, (c, sp) => {
      const base = dark ? mix(hexRGB(0xb5574a), P.couchRGB, 0.5) : hexRGB(0xb5574a);
      const cream = css(dark ? mix(hexRGB(0xeadfcb), P.couchRGB, 0.5) : hexRGB(0xeadfcb), 0.55);
      const path = () => {
        c.beginPath();
        c.moveTo(-58, 4);
        c.quadraticCurveTo(0, -10, 58, 4);
        c.quadraticCurveTo(61, 40, 56, 72);
        c.quadraticCurveTo(40, 78, 26, 70);
        c.quadraticCurveTo(8, 80, -12, 72);
        c.quadraticCurveTo(-34, 80, -55, 70);
        c.quadraticCurveTo(-61, 40, -58, 4);
        c.closePath();
      };
      c.save();
      softShadow(c, sp, 6, 3, 0.3);
      path();
      c.fillStyle = css(base);
      c.fill();
      c.restore();
      c.save();
      path();
      c.clip();
      c.fillStyle = cream;
      for (let x = -60; x < 62; x += 16) c.fillRect(x, -12, 4, 96);
      for (let y = -4; y < 84; y += 16) c.fillRect(-62, y, 124, 4);
      c.fillStyle = 'rgba(40,20,10,0.25)';
      for (let x = -54; x < 62; x += 16) c.fillRect(x, -12, 0.8, 96);
      for (let y = 4; y < 84; y += 16) c.fillRect(-62, y, 124, 0.8);
      for (let i = 0; i < 6; i++) {
        const fx = -58 + i * 20;
        const g = c.createLinearGradient(fx, 0, fx + 20, 0);
        g.addColorStop(0, 'rgba(0,0,0,0.16)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.08)');
        g.addColorStop(1, 'rgba(0,0,0,0.12)');
        c.fillStyle = g;
        c.fillRect(fx, -12, 20, 96);
      }
      const g = c.createLinearGradient(0, -8, 0, 10);
      g.addColorStop(0, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(-62, -10, 124, 20);
      c.restore();
      c.strokeStyle = css(base);
      c.lineWidth = 1;
      c.beginPath();
      for (let x = -52; x <= 52; x += 3.5) {
        const y = 72 + Math.sin(x * 0.12) * 3.5;
        c.moveTo(x, y);
        c.lineTo(x + 0.6, y + 5);
      }
      c.stroke();
    });
  }

  function buildSeat() {
    const h = 74;
    return mk(SEAT_TILE, h, 0, 0, (c) => {
      const r = rng(55);
      c.fillStyle = P.seat;
      c.fillRect(0, 0, SEAT_TILE, h);
      let g = c.createLinearGradient(0, 0, 0, 42);
      g.addColorStop(0, `rgba(0,0,0,${dark ? 0.45 : 0.3})`);
      g.addColorStop(0.2, 'rgba(0,0,0,0.05)');
      g.addColorStop(0.75, css(P.couchHiRGB, 0));
      g.addColorStop(1, css(P.couchHiRGB, 0.35));
      c.fillStyle = g;
      c.fillRect(0, 0, SEAT_TILE, 42);
      c.fillStyle = P.ink;
      c.globalAlpha = dark ? 0.025 : 0.03;
      for (let y = 4; y < h; y += 2.2) c.fillRect(0, y, SEAT_TILE, 0.5);
      for (let i = 0; i < 520; i++) {
        c.globalAlpha = 0.04 + r() * 0.06;
        c.fillStyle = r() < 0.5 ? P.couchHi : P.seatLo;
        c.fillRect(2 + r() * (SEAT_TILE - 8), 4 + r() * (h - 6), 1.4 + r() * 2.6, 0.6);
      }
      c.globalAlpha = 1;
      c.lineWidth = 1.4;
      c.strokeStyle = css(P.couchHiRGB, 0.3);
      c.beginPath();
      for (let x = 0; x < SEAT_TILE; x += 24) {
        c.moveTo(x + 2, 18.2);
        c.lineTo(x + 10, 18.2);
        c.moveTo(x + 14, 30.2);
        c.lineTo(x + 22, 30.2);
      }
      c.stroke();
      c.strokeStyle = css(P.seatLoRGB, 0.6);
      c.beginPath();
      for (let x = 0; x < SEAT_TILE; x += 24) {
        c.moveTo(x + 2, 17);
        c.lineTo(x + 10, 17);
        c.moveTo(x + 14, 29);
        c.lineTo(x + 22, 29);
      }
      c.stroke();
      c.fillStyle = css(P.couchHiRGB, 0.6);
      c.fillRect(0, 39.4, SEAT_TILE, 1.6);
      c.fillStyle = P.seatLo;
      c.fillRect(0, 41.4, SEAT_TILE, h - 41.4);
      c.fillStyle = css(P.couchHiRGB, 0.18);
      c.fillRect(0, 41.6, SEAT_TILE, 1);
      c.fillStyle = 'rgba(0,0,0,0.2)';
      c.fillRect(0, 44.4, SEAT_TILE, 0.8);
      c.globalAlpha = 0.06;
      for (let x = 0; x < SEAT_TILE; x += 16) {
        c.fillStyle = '#ffffff';
        c.fillRect(x + 3, 45, 5, h - 45);
        c.fillStyle = '#000000';
        c.fillRect(x + 10, 45, 4, h - 45);
      }
      c.globalAlpha = 1;
      g = c.createLinearGradient(0, 45, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${dark ? 0.4 : 0.26})`);
      c.fillStyle = g;
      c.fillRect(0, 45, SEAT_TILE, h - 45);
      c.strokeStyle = css(P.couchHiRGB, 0.3);
      c.lineWidth = 1;
      c.beginPath();
      for (let x = 0; x < SEAT_TILE; x += 12) {
        c.moveTo(x + 3, 49);
        c.lineTo(x + 9, 49);
      }
      c.stroke();
      for (const sx of [0, SEAT_TILE]) {
        g = c.createLinearGradient(sx - 14, 0, sx + 14, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.42, `rgba(0,0,0,${dark ? 0.3 : 0.18})`);
        g.addColorStop(0.5, `rgba(0,0,0,${dark ? 0.5 : 0.32})`);
        g.addColorStop(0.58, css(P.couchHiRGB, 0.2));
        g.addColorStop(1, css(P.couchHiRGB, 0));
        c.fillStyle = g;
        c.fillRect(sx - 14, 2, 28, h - 2);
      }
    });
  }

  // ---------- небо ----------
  function buildSun(core, edge, halo) {
    return mk(110, 110, 55, 55, (c) => {
      let g = c.createRadialGradient(0, 0, 8, 0, 0, 55);
      g.addColorStop(0, `rgba(${halo},0.55)`);
      g.addColorStop(0.35, `rgba(${halo},0.18)`);
      g.addColorStop(1, `rgba(${halo},0)`);
      c.fillStyle = g;
      c.fillRect(-55, -55, 110, 110);
      g = c.createRadialGradient(-2, -3, 1, 0, 0, 12);
      g.addColorStop(0, core);
      g.addColorStop(1, edge);
      c.fillStyle = g;
      circle(c, 0, 0, 12);
    }, Math.min(K, 2));
  }
  function buildMoon() {
    return mk(80, 80, 40, 40, (c) => {
      c.fillStyle = '#f3efe2';
      circle(c, 0, 0, 9.5);
      c.fillStyle = 'rgba(170,160,135,0.35)';
      circle(c, -3, 2, 2.2);
      circle(c, -5, -3, 1.3);
      circle(c, 0.5, 5, 1.1);
      c.globalCompositeOperation = 'destination-out';
      circle(c, 5, -3.4, 8.4);
      c.globalCompositeOperation = 'destination-over';
      const g = c.createRadialGradient(0, 0, 6, 0, 0, 40);
      g.addColorStop(0, 'rgba(220,230,255,0.32)');
      g.addColorStop(1, 'rgba(220,230,255,0)');
      c.fillStyle = g;
      c.fillRect(-40, -40, 80, 80);
      c.globalCompositeOperation = 'source-over';
    }, Math.min(K, 2));
  }
  function buildStars() {
    return mk(STAR_SPAN, STAR_H, 0, 0, (c) => {
      const r = rng(77);
      for (let i = 0; i < 95; i++) {
        const x = 2 + r() * (STAR_SPAN - 4), y = 2 + r() * (STAR_H - 4), s = 0.35 + r() * r() * 1.1;
        c.globalAlpha = 0.35 + r() * 0.65;
        const t = r();
        c.fillStyle = t < 0.15 ? '#ffe9c4' : t < 0.3 ? '#cfe0ff' : '#ffffff';
        circle(c, x, y, s);
        if (s > 1.15) {
          c.fillRect(x - 3, y - 0.2, 6, 0.4);
          c.fillRect(x - 0.2, y - 3, 0.4, 6);
        }
      }
      c.globalAlpha = 1;
    }, Math.min(K, 2));
  }
  function buildCloud(top, bottom) {
    return mk(96, 40, 48, 26, (c) => {
      const g = c.createLinearGradient(0, -22, 0, 8);
      g.addColorStop(0, top);
      g.addColorStop(1, bottom);
      c.fillStyle = g;
      c.beginPath();
      for (const [x, y, rad] of [[-26, 0, 8], [-12, -6, 12], [5, -9, 14], [21, -3, 10], [32, 1, 7]]) {
        c.moveTo(x + rad, y);
        c.arc(x, y, rad, 0, TAU);
      }
      c.rect(-28, -2, 62, 8);
      c.save();
      c.clip();
      c.fillRect(-48, -26, 96, 32);
      c.restore();
    }, Math.min(K, 2));
  }

  const city = (() => {
    const r = rng(5);
    const back = [], front = [];
    for (let x = 0; x < CITY_SPAN - 8; ) {
      const w = Math.min(16 + r() * 26, CITY_SPAN - x);
      back.push(x, w, 22 + r() * 40);
      x += w + 1 + r() * 3;
    }
    for (let x = 2; x < CITY_SPAN - 8; ) {
      const w = Math.min(12 + r() * 20, CITY_SPAN - x);
      front.push(x, w, 8 + r() * 28, r() < 0.25 ? 1 : 0);
      x += w + r() * 6;
    }
    return { back, front };
  })();
  function buildCityLit() {
    return mk(CITY_SPAN, 66, 0, 64, (c) => {
      const r = rng(8);
      const warm = ['#ffd27a', '#ffe7a8', '#ffc768', '#cfe4ff'];
      const wins = (x, w, h, p) => {
        for (let yy = -h + 3; yy < -2; yy += 4.5) {
          for (let xx = x + 2; xx < x + w - 2; xx += 3.6) {
            if (r() > p) continue;
            c.fillStyle = warm[Math.floor(r() * warm.length)];
            c.fillRect(xx, yy, 1.4, 1.9);
          }
        }
      };
      const B = city.back, F2 = city.front;
      for (let i = 0; i < B.length; i += 3) wins(B[i], B[i + 1], B[i + 2], 0.22);
      c.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < F2.length; i += 4) c.fillRect(F2[i], -F2[i + 2], F2[i + 1], F2[i + 2] + 2);
      c.globalCompositeOperation = 'source-over';
      for (let i = 0; i < F2.length; i += 4) wins(F2[i], F2[i + 1], F2[i + 2], 0.32);
      c.fillStyle = '#ff5a4a';
      for (let i = 0; i < F2.length; i += 4) if (F2[i + 3]) circle(c, F2[i] + F2[i + 1] / 2, -F2[i + 2] - 7, 0.9);
    }, Math.min(K, 2));
  }

  // ---------- свет ----------
  function glowSprite(rgb, inner) {
    return mk(96, 96, 48, 48, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 48);
      g.addColorStop(0, `rgba(${rgb},1)`);
      g.addColorStop(inner, `rgba(${rgb},0.4)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      c.fillStyle = g;
      c.fillRect(-48, -48, 96, 96);
    }, 1);
  }
  function buildBeam(rgb) {
    return mk(32, 128, 16, 0, (c) => {
      const g = c.createLinearGradient(-16, 0, 16, 0);
      g.addColorStop(0, `rgba(${rgb},0)`);
      g.addColorStop(0.28, `rgba(${rgb},0.55)`);
      g.addColorStop(0.5, `rgba(${rgb},1)`);
      g.addColorStop(0.72, `rgba(${rgb},0.55)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      c.fillStyle = g;
      c.fillRect(-16, 0, 32, 128);
      c.globalCompositeOperation = 'destination-in';
      const v = c.createLinearGradient(0, 0, 0, 128);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(0.12, 'rgba(0,0,0,1)');
      v.addColorStop(0.55, 'rgba(0,0,0,0.55)');
      v.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = v;
      c.fillRect(-16, 0, 32, 128);
      c.globalCompositeOperation = 'source-over';
    }, 1);
  }
  function buildCone() {
    return mk(270, 200, 135, 0, (c) => {
      for (let i = 0; i < 14; i++) {
        const s = 1.1 - (i / 14) * 0.85;
        c.globalAlpha = 0.075;
        c.beginPath();
        c.moveTo(-24 * s, 0);
        c.lineTo(24 * s, 0);
        c.lineTo(115 * s, 200);
        c.lineTo(-115 * s, 200);
        c.closePath();
        const g = c.createLinearGradient(0, 0, 0, 200);
        g.addColorStop(0, 'rgba(255,214,150,1)');
        g.addColorStop(0.55, 'rgba(255,190,120,0.45)');
        g.addColorStop(1, 'rgba(255,170,100,0)');
        c.fillStyle = g;
        c.fill();
      }
      c.globalAlpha = 1;
    }, 0.6);
  }
  function buildVignette() {
    return mk(128, 128, 0, 0, (c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 91);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, 'rgba(0,0,0,0)');
      g.addColorStop(0.8, 'rgba(24,14,6,0.28)');
      g.addColorStop(1, 'rgba(18,10,4,0.7)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    }, 1);
  }

  // ---------- передний план ----------
  function buildFg(i) {
    if (i === 0) {
      return mk(240, 64, 120, 44, (c) => {
        const base = dark ? mix(hexRGB(0xc9a24a), P.seatLoRGB, 0.55) : hexRGB(0xc9a24a);
        const path = () => {
          c.beginPath();
          c.moveTo(-118, 20);
          c.bezierCurveTo(-100, -6, -60, -30, -10, -28);
          c.bezierCurveTo(40, -27, 80, -14, 118, 20);
          c.closePath();
        };
        path();
        c.fillStyle = css(base);
        c.fill();
        c.save();
        c.clip();
        c.strokeStyle = css(mix(base, [0, 0, 0], 0.3), 0.5);
        c.lineWidth = 1.1;
        c.beginPath();
        for (let x = -116; x < 118; x += 9) {
          for (let y = -30; y < 22; y += 4.5) {
            c.moveTo(x, y);
            c.lineTo(x + 3, y + 3);
            c.lineTo(x + 6, y);
          }
        }
        c.stroke();
        c.strokeStyle = css(mix(base, WHITE, 0.3), 0.35);
        c.lineWidth = 2.2;
        c.beginPath();
        for (let x = -112; x < 118; x += 27) {
          c.moveTo(x, -34);
          c.bezierCurveTo(x + 4, -20, x - 4, -8, x + 2, 22);
        }
        c.stroke();
        const g = c.createLinearGradient(0, -30, 0, 20);
        g.addColorStop(0, 'rgba(255,255,255,0.18)');
        g.addColorStop(1, 'rgba(0,0,0,0.35)');
        c.fillStyle = g;
        c.fillRect(-120, -32, 240, 54);
        c.restore();
      });
    }
    if (i === 1) {
      return mk(200, 60, 100, 40, (c) => {
        const base = dark ? mix(hexRGB(0xc98f8f), P.seatLoRGB, 0.55) : hexRGB(0xc98f8f);
        const path = () => {
          c.beginPath();
          c.moveTo(-96, 20);
          c.quadraticCurveTo(-92, -22, -80, -26);
          c.quadraticCurveTo(0, -34, 80, -26);
          c.quadraticCurveTo(92, -22, 96, 20);
          c.closePath();
        };
        path();
        c.fillStyle = css(base);
        c.fill();
        c.save();
        c.clip();
        c.fillStyle = css(mix(base, WHITE, 0.3), 0.5);
        for (let x = -96; x < 100; x += 14) c.fillRect(x, -36, 5, 60);
        const g = c.createLinearGradient(0, -30, 0, 20);
        g.addColorStop(0, 'rgba(255,255,255,0.2)');
        g.addColorStop(1, 'rgba(0,0,0,0.35)');
        c.fillStyle = g;
        c.fillRect(-100, -36, 200, 58);
        c.restore();
        c.strokeStyle = css(mix(base, [0, 0, 0], 0.3), 0.6);
        c.lineWidth = 1.2;
        path();
        c.stroke();
      });
    }
    return mk(110, 56, 55, 36, (c) => {
      c.save();
      c.rotate(-0.08);
      const body = P.ph(0x30333b, 0.25);
      c.fillStyle = body;
      c.beginPath();
      c.moveTo(-40, 16);
      c.bezierCurveTo(-46, -6, -36, -22, -18, -20);
      c.lineTo(18, -20);
      c.bezierCurveTo(36, -22, 46, -6, 40, 16);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(-20, -19, 40, 2);
      c.fillStyle = P.ph(0x15171c, 0.25);
      c.fillRect(-27, -9, 12, 3.6);
      c.fillRect(-22.8, -13.2, 3.6, 12);
      const cols = [0xe0645a, 0x5aa0e0, 0x66c27a, 0xe8c450];
      const pos = [[24, -12], [29, -7], [24, -2], [19, -7]];
      for (let k = 0; k < 4; k++) {
        c.fillStyle = P.ph(cols[k], 0.3);
        circle(c, pos[k][0], pos[k][1], 2.2);
      }
      c.fillStyle = P.ph(0x15171c, 0.25);
      circle(c, -8, 4, 4.5);
      circle(c, 8, 4, 4.5);
      c.restore();
    });
  }
  function silhouette(sp, color) {
    return mk(sp.w, sp.h, sp.ox, sp.oy, (c) => {
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(sp.c, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = color;
      c.fillRect(0, 0, sp.c.width, sp.c.height);
      c.restore();
    }, sp.k);
  }

  // ---------- мелочи гостиной для вариантов ----------
  function buildLaptopClosed() {
    return mk(56, 40, 28, 34, (c, sp) => {
      c.save();
      softShadow(c, sp, 4, 2, 0.25);
      c.translate(0, 0);
      c.rotate(-0.12);
      c.fillStyle = P.ph(0xc9ccd1, 0.45);
      rr(c, -22, -30, 44, 30, 3);
      c.fill();
      c.restore();
      c.save();
      c.rotate(-0.12);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(-21, -29, 42, 1.2);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(-22, -2, 44, 2);
      c.fillStyle = P.ph(0xf0c94c, 0.4);
      rr(c, 4, -22, 12, 8, 1.5);
      c.fill();
      c.fillStyle = P.ph(0x8fae94, 0.4);
      circle(c, -8, -12, 4);
      c.restore();
      haze(c, sp, dark ? 0.12 : 0.06);
    });
  }
  function buildMugs() {
    return mk(40, 30, 20, 26, (c, sp) => {
      const mug = (x, col, rim) => {
        c.save();
        softShadow(c, sp, 3, 1.5, 0.25);
        c.fillStyle = col;
        rr(c, x - 5, -14, 10, 14, 1.8);
        c.fill();
        c.restore();
        c.strokeStyle = col;
        c.lineWidth = 1.6;
        c.beginPath();
        c.arc(x + 6, -8, 3, -1.3, 1.3);
        c.stroke();
        c.fillStyle = rim;
        c.fillRect(x - 5, -14, 10, 1.4);
      };
      mug(-7, P.mug, 'rgba(0,0,0,0.12)');
      mug(8, P.ph(0x5b7fa6, 0.4), 'rgba(255,255,255,0.3)');
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(-8, -17);
      c.bezierCurveTo(-10, -20, -6, -22, -8, -25);
      c.stroke();
      haze(c, sp, dark ? 0.12 : 0.06);
    });
  }
  function buildPizza() {
    return mk(120, 50, 60, 30, (c) => {
      const base = dark ? mix(hexRGB(0xc7a37a), P.seatLoRGB, 0.55) : hexRGB(0xc7a37a);
      c.fillStyle = css(base);
      c.beginPath();
      c.moveTo(-54, 14);
      c.lineTo(-44, -2);
      c.lineTo(48, -2);
      c.lineTo(56, 14);
      c.closePath();
      c.fill();
      c.fillStyle = css(mix(base, [0, 0, 0], 0.2));
      c.beginPath();
      c.moveTo(-44, -2);
      c.lineTo(-30, -26);
      c.lineTo(58, -24);
      c.lineTo(48, -2);
      c.closePath();
      c.fill();
      c.fillStyle = css(mix(base, WHITE, 0.25), 0.6);
      c.fillRect(-40, -1, 86, 2);
    });
  }
  function buildLeak() {
    return mk(64, 4, 0, 0, (c) => {
      const g = c.createLinearGradient(0, 0, 64, 0);
      g.addColorStop(0, 'rgba(255,186,110,1)');
      g.addColorStop(0.35, 'rgba(255,150,90,0.55)');
      g.addColorStop(1, 'rgba(255,140,80,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 4);
    }, 1);
  }

  // ---------- сборка кэша ----------
  const livingOwner = { sprites: [] };
  let builtK = 0, builtBt = -1, dirty = true, kCap = 3;
  const KCAP = [1.5, 2, 3];
  function buildAll() {
    S.ready = false;
    for (const sp of livingOwner.sprites) freeSprite(sp);
    livingOwner.sprites.length = 0;
    const prevOwner = buildOwner;
    buildOwner = livingOwner;
    try {
      S.wall = buildWallTile();
      S.win = [0, 1, 2].map(buildWindow);
      S.lamp = buildLamp();
      S.lampLit = buildLampLit();
      S.monstera = buildMonstera();
      S.snake = buildSnake();
      S.items = {};
      for (const id in ITEMS) S.items[id] = buildItem(id);
      buildNeonLit();
      buildScreenOn();
      S.cush = [0, 1, 2].map(buildCushion);
      S.pillows = PILLOWS.map((_, i) => buildPillow(i));
      S.plaid = buildPlaid();
      S.seat = buildSeat();
      S.sun = buildSun('#fffdf0', '#ffe9a6', '255,236,180');
      S.sunWarm = buildSun('#ffd08a', '#ff7a3c', '255,140,70');
      S.moon = buildMoon();
      S.stars = buildStars();
      S.clouds = [buildCloud('#ffffff', '#dde7f2'), buildCloud('#ffd9bd', '#e48a86'), buildCloud('#3c4470', '#20263f')];
      S.cityLit = buildCityLit();
      S.beam = buildBeam('255,242,214');
      S.beamWarm = buildBeam('255,160,90');
      S.cone = buildCone();
      S.glowWarm = glowSprite('255,196,120', 0.35);
      S.glowCool = glowSprite('150,200,255', 0.3);
      S.glowPink = glowSprite('255,80,160', 0.3);
      S.garland = buildGarland(false);
      S.garlandLit = buildGarland(true);
      S.vignette = buildVignette();
      S.fg = [0, 1, 2].map(buildFg);
      S.fgDark = S.fg.map((sp) => silhouette(sp, '#0b0c12'));
      S.laptopClosed = buildLaptopClosed();
      S.mugs = buildMugs();
      S.pizza = buildPizza();
      S.pizzaDark = silhouette(S.pizza, '#0b0c12');
      S.leak = buildLeak();
      S.ready = true;
    } finally {
      buildOwner = prevOwner;
    }
  }
  function ensure() {
    layout();
    const k = G.clamp((G.scale || 1) * (G.dpr || 1), 0.75, kCap);
    if (!dirty && builtK === k && builtBt === geo.bt) return;
    dirty = false;
    builtK = k;
    builtBt = geo.bt;
    K = k;
    try {
      buildPalette();
      buildAll();
    } catch (e) {
      S.ready = false;
      G.report('scene build', e);
    }
    updateMB();
  }
  let buildGen = 0;
  const markDirty = () => { dirty = true; };
  G.on('theme', () => {
    dirty = true;
    buildGen++;
  });
  G.on('fonts', () => {
    dirty = true;
    buildGen++;
    sub.sp = null;
  });
  if (document.fonts) {
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', markDirty);
    if (document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(markDirty, () => {});
    if (document.fonts.load) {
      Promise.all(['500 20px Oswald', '600 20px Oswald', '700 20px Oswald', '500 12px "Golos Text"', '600 12px "Golos Text"'].map((f) => document.fonts.load(f)))
        .then(markDirty, () => {});
    }
  }

  // ---------- dev-параметры ----------
  const QS = (() => {
    const out = {};
    try {
      const s = (window.location && window.location.search) || '';
      for (const part of s.replace(/^\?/, '').split('&')) {
        if (!part) continue;
        const i = part.indexOf('=');
        out[decodeURIComponent(i < 0 ? part : part.slice(0, i))] = i < 0 ? '' : decodeURIComponent(part.slice(i + 1));
      }
    } catch (e) {}
    return out;
  })();
  const CLOCK_SHIFT = (() => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(QS.clock || '');
    return m ? mod(+m[1] * 60 + +m[2] - 540, 1440) : 0;
  })();
  const FAST = QS.route === 'fast';

  // ---------- смена суток ----------
  const CH = 16;
  const NIGHT = [0x0b1029, 0x18224a, 0x33365e, 0x5c679c, 0, 1, 1, 0];
  const KEY_RAW = [
    [0, ...NIGHT],
    [300, ...NIGHT],
    [360, 0x2a3470, 0x8a6aa0, 0xf2a07a, 0xb0a4c4, 0.15, 0.45, 0.75, 0.45],
    [420, 0x6b93cc, 0xf0c2a0, 0xffd28a, 0xf2dcc6, 0.6, 0.06, 0.3, 0.3],
    [540, 0x79b4e6, 0xb9dcf2, 0xfbe8c8, 0xfff6ea, 0.75, 0, 0, 0],
    [780, 0x5aa6e8, 0xa8d4f4, 0xe3f2fb, 0xffffff, 0.4, 0, 0, 0],
    [990, 0x6aa4dc, 0xb8d4ea, 0xfde3b4, 0xfff3e2, 0.65, 0, 0, 0.15],
    [1110, 0x3d4f96, 0xe8786a, 0xffb75c, 0xffd6b4, 0.95, 0.1, 0.35, 1],
    [1200, 0x1a2256, 0x5a3f7c, 0xd26a6a, 0x9488ae, 0.2, 0.6, 0.85, 0.6],
    [1260, ...NIGHT],
    [1440, ...NIGHT],
  ];
  const KEYS = KEY_RAW.map((k) => {
    const a = new Float32Array(CH + 1);
    a[0] = k[0];
    let j = 1;
    for (let i = 1; i <= 4; i++) {
      const c = hexRGB(k[i]);
      a[j++] = c[0];
      a[j++] = c[1];
      a[j++] = c[2];
    }
    for (let i = 5; i <= 8; i++) a[j++] = k[i];
    return a;
  });
  const I_BEAM = 12, I_NIGHT = 13, I_LAMP = 14, I_SUNSET = 15;
  const tgt = new Float32Array(CH), cur = new Float32Array(CH);
  let lightInit = false;
  function sampleLight(m, out) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= m) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = smooth(clamp01((m - a[0]) / (b[0] - a[0])));
    for (let j = 0; j < CH; j++) out[j] = a[j + 1] + (b[j + 1] - a[j + 1]) * t;
  }
  function clockNow() {
    const S0 = G.state, per = (G.cfg && G.cfg.minPerSec) || 4;
    const base = Number(G.clockMin()) || 0;
    const frac = S0.mode === 'start' ? 0 : mod(S0.t * per, 1);
    return mod(base + frac + CLOCK_SHIFT, 1440);
  }

  const weather = { kind: 0, k: 0, wasNight: false, storm: false, src: 'night' };
  const FORCED_WEATHER = QS.weather === 'rain' || QS.weather === 'storm' || QS.weather === 'snow';
  function applyForcedWeather() {
    if (!FORCED_WEATHER) return;
    weather.kind = QS.weather === 'snow' ? 2 : 1;
    weather.storm = QS.weather === 'storm';
    weather.k = 1;
  }
  applyForcedWeather();
  function rollWeather(src) {
    if (FORCED_WEATHER || weather.kind) return;
    const r = Math.random();
    if (src === 'outdoor') {
      if (r < 0.28) {
        weather.kind = 1;
        weather.storm = r < 0.28 / 3;
      } else if (r < 0.38) weather.kind = 2;
    } else if (r < 0.37) {
      weather.kind = 1;
      weather.storm = r >= 0.25;
    } else if (r < 0.55) weather.kind = 2;
    if (weather.kind) weather.src = src;
  }
  const MOTES = 22, RAIN = 26, SNOW = 36;
  const mote = new Float32Array(MOTES * 4);
  const rain = new Float32Array(RAIN * 4);
  const snow = new Float32Array(SNOW * 4);
  for (let i = 0; i < MOTES; i++) {
    mote[i * 4] = Math.random() - 0.5;
    mote[i * 4 + 1] = Math.random();
    mote[i * 4 + 2] = Math.random() * TAU;
    mote[i * 4 + 3] = Math.random();
  }
  for (let i = 0; i < RAIN; i++) {
    rain[i * 4] = Math.random();
    rain[i * 4 + 1] = Math.random() * 1.3 - 0.2;
    rain[i * 4 + 2] = 0.25 + Math.random() * 0.45;
    rain[i * 4 + 3] = 0.3 + Math.random() * 0.7;
  }
  for (let i = 0; i < SNOW; i++) {
    snow[i * 4] = Math.random();
    snow[i * 4 + 1] = Math.random();
    snow[i * 4 + 2] = 0.06 + Math.random() * 0.08;
    snow[i * 4 + 3] = Math.random() * TAU;
  }
  let startK = 1, feverK = 0, bossOn = false;

  // ---------- что сцена публикует ----------
  const PANE_MAX = 48, LIGHT_MAX = 16, EMIT_MAX = 12;
  const panes = { n: 0, x: new Float32Array(PANE_MAX), y: new Float32Array(PANE_MAX), w: new Float32Array(PANE_MAX), h: new Float32Array(PANE_MAX), key: new Int32Array(PANE_MAX) };
  const paneReg = new Int8Array(PANE_MAX);
  const lights = { n: 0, list: Array.from({ length: LIGHT_MAX }, () => ({ kind: '', x: 0, y: 0, w: 0, h: 0, ang: 0, a: 0, r: 255, g: 255, b: 255 })) };
  const emitters = { n: 0, list: Array.from({ length: EMIT_MAX }, () => ({ kind: '', x: 0, alt: 0, k: 0 })) };
  const debug = { log: [], spriteMB: 0, buildMs: 0, freed: 0 };
  const locInfo = { id: 'living', name: 'ДИВАН', title: '', idx: 0, k: 0, variant: 'morning', outdoor: false, surface: 'fabric', since: 0 };
  const nextInfo = { id: '', kind: '', gm: 0, inSec: 0 };
  const transInfo = { kind: '', p: 0, from: '', to: '' };
  const sunInfo = { x: 0, y: 0, vis: false };
  const sceneInfo = {
    night: 0, lamp: 0, sunset: 0, weather: 'clear', weatherK: 0,
    clock: 540, storm: false, amb: new Float32Array([1, 1, 1]), loc: locInfo, surface: 'fabric', outdoor: false,
    route: [], next: null, transition: null, panes, lights, emitters, sun: sunInfo, building: false, debug,
    goto: (id, variant) => gotoLoc(id, variant),
    anchor: (id) => getAnchor(id),
  };
  G.scene = sceneInfo;

  // ---------- кадр: что видно и каким светом ----------
  const F = {
    skyTop: '', skyMid: '', skyBot: '', amb: '', ambOn: false, cityBack: '', cityFront: '',
    night: 0, lamp: 0, sunset: 0, beamA: 0, beamAng: 0, starA: 0,
    sunA: 0, sunElev: 0, dayFrac: 0, moonA: 0, moonElev: 0, nightFrac: 0, rain: 0, snow: 0,
    wallSc: 0, skyGrad: null, skyKey: '', skyGrad2: null, skyKey2: '',
  };
  const VIS_MAX = 8;
  const vis = { n: 0, m: new Int32Array(VIS_MAX), x: new Float32Array(VIS_MAX) };
  const tmp3 = [0, 0, 0];
  const ONE3 = new Float32Array([1, 1, 1]);
  const A2 = new Float32Array([1, 1, 1]);
  let emiK = 1;
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  function readA2() {
    const L = G.look;
    const src = L && L.a2on && L.a2 && L.a2.length >= 3 ? L.a2 : ONE3;
    for (let i = 0; i < 3; i++) {
      const v = +src[i];
      A2[i] = Number.isFinite(v) ? G.clamp(v, 0.05, 1) : 1;
    }
    emiK = Math.min(1.6, 1 / Math.max(0.05, lum(A2[0], A2[1], A2[2])));
  }
  function preComp(c, a) {
    tmp3[0] = Math.min(255, c[0] / A2[0]);
    tmp3[1] = Math.min(255, c[1] / A2[1]);
    tmp3[2] = Math.min(255, c[2] / A2[2]);
    return css(tmp3, a);
  }
  const ea = (a) => (a * emiK > 1 ? 1 : a * emiK);

  function skyColor(i, rainMix) {
    let c = [cur[i], cur[i + 1], cur[i + 2]];
    if (dark) c = mix(c, [21, 17, 13], 0.3);
    if (rainMix > 0) c = mix(c, [26, 30, 42], rainMix);
    return preComp(c);
  }
  function prepFrame() {
    readA2();
    const m = clockNow();
    F.night = cur[I_NIGHT];
    F.lamp = cur[I_LAMP];
    F.sunset = cur[I_SUNSET];
    F.rain = weather.kind === 1 ? weather.k : 0;
    F.snow = weather.kind === 2 ? weather.k : 0;
    F.skyTop = skyColor(0, F.rain * 0.35);
    F.skyMid = skyColor(3, F.rain * 0.35);
    F.skyBot = skyColor(6, F.rain * 0.3);
    let amb = [cur[9], cur[10], cur[11]];
    if (dark) amb = mix(amb, WHITE, 0.45);
    F.ambOn = Math.min(amb[0], amb[1], amb[2]) < 252;
    F.amb = css(amb);
    const bot = [cur[6], cur[7], cur[8]];
    let back = mix(bot, [154, 167, 184], 0.5), front = mix(bot, [111, 125, 146], 0.62);
    back = mix(back, [96, 78, 116], F.sunset * 0.55);
    front = mix(front, [62, 50, 84], F.sunset * 0.6);
    back = mix(back, [27, 34, 66], F.night);
    front = mix(front, [14, 19, 40], F.night);
    if (dark) {
      back = mix(back, [21, 17, 13], 0.25);
      front = mix(front, [21, 17, 13], 0.25);
    }
    F.cityBack = preComp(back);
    F.cityFront = preComp(front);

    const dayFrac = (m - 390) / 780;
    F.dayFrac = clamp01(dayFrac);
    F.sunElev = dayFrac > 0 && dayFrac < 1 ? Math.sin(Math.PI * dayFrac) : 0;
    const sunUp = clamp01(F.sunElev * 4);
    F.sunA = sunUp * (1 - F.night) * (1 - F.rain * 0.9);
    F.beamAng = G.clamp((0.5 - F.dayFrac) * 1.25, -0.75, 0.75);
    F.beamA = cur[I_BEAM] * sunUp * (1 - F.night) * (dark ? 0.68 : 0.58);
    const nf = mod(m - 1230, 1440) / 660;
    F.nightFrac = clamp01(nf);
    F.moonElev = nf > 0 && nf < 1 ? Math.sin(Math.PI * nf) : 0;
    F.moonA = F.night * clamp01(F.moonElev * 4) * (1 - F.rain * 0.75);
    F.starA = F.night * (1 - F.rain * 0.8) * (1 - F.snow * 0.4);

    // на старте табличка «ЖИВИ ЕБЛАНЬ ЛЮБИ» стоит справа от мем-подписи, а не под ней
    F.wallSc = G.state.dist * PAR_WALL - (G.W - SIGN_RIGHT - WIN_SLOT - ART_SLOT / 2);
    F.skyGrad = null;
    F.skyGrad2 = null;
    vis.n = 0;
    const m0 = Math.floor((F.wallSc - M - 260) / MACRO), m1 = Math.floor((F.wallSc + G.W + M + 260) / MACRO);
    for (let mm = m0; mm <= m1 && vis.n < VIS_MAX; mm++) {
      vis.m[vis.n] = mm;
      vis.x[vis.n] = mm * MACRO - F.wallSc;
      vis.n++;
    }
  }

  // ---------- раскладка гостиной: у каждого варианта своя соль ----------
  const LV_SALT = [0, 1000, 2000];
  const LV_OF = { morning: 0, noon: 1, dawn: 2 };
  let LV = 0;
  const salt = (n) => n + LV_SALT[LV];
  const winVariant = (m) => (m === 0 && LV === 0 ? 0 : Math.floor(hash(m, salt(3)) * 3) % 3);
  const lampSide = (m) => (m === 0 && LV === 0 ? 1 : hash(m, salt(4)) < 0.5 ? -1 : 1);
  function windowPlant(m) {
    if (m === 0 && LV === 0) return 1;
    const h = hash(m, salt(5));
    return h < 0.45 ? 1 : h < 0.8 ? 2 : 0;
  }

  const perms = new Map();
  function perm(cycle) {
    const key = cycle * 4 + LV;
    let p = perms.get(key);
    if (p) return p;
    if (perms.size > 96) perms.clear();
    const r = rng(cycle * 7919 + 17 + LV_SALT[LV] * 13);
    p = LOWER.map((_, i) => i);
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    if (cycle <= 0) {
      const i = p.indexOf(0);
      p[i] = p[0];
      p[0] = 0;
    } else {
      const prev = perm(cycle - 1), tail = prev.slice(-4);
      for (let i = 0; i < 4; i++) {
        if (!tail.includes(p[i])) continue;
        for (let j = 4; j < p.length; j++) {
          if (tail.includes(p[j])) continue;
          const t = p[i];
          p[i] = p[j];
          p[j] = t;
          break;
        }
      }
    }
    perms.set(key, p);
    return p;
  }
  function lowerAt(k) {
    const n = LOWER.length, cycle = Math.floor(k / n);
    return LOWER[perm(cycle)[k - cycle * n]];
  }
  function upperAt(k, lowerId) {
    if (k === 0 && LV === 0) return 'frames2';
    const n = UPPER.length;
    let i = Math.floor(hash(k, salt(9)) * n) % n;
    if (i === Math.floor(hash(k - 1, salt(9)) * n) % n) i = (i + 1) % n;
    const id = UPPER[i];
    if (id === 'shelf2' && (lowerId === 'shelf' || lowerId === 'desk')) return 'pennant';
    return id;
  }

  // ---------- небо в стекле ----------
  function skyGradient(ctx, skyTop, base) {
    const key = skyTop + '|' + base;
    if (F.skyGrad && F.skyKey === key) return F.skyGrad;
    if (F.skyGrad2 && F.skyKey2 === key) return F.skyGrad2;
    if (F.skyGrad && F.skyGrad2) return F.skyGrad;
    const gr = ctx.createLinearGradient(0, skyTop, 0, Math.max(skyTop + 1, base));
    gr.addColorStop(0, F.skyTop);
    gr.addColorStop(0.55, F.skyMid);
    gr.addColorStop(1, F.skyBot);
    if (!F.skyGrad) {
      F.skyGrad = gr;
      F.skyKey = key;
    } else {
      F.skyGrad2 = gr;
      F.skyKey2 = key;
    }
    return gr;
  }
  function drawSky(ctx, cx, sp, m) {
    const g = sp.glass;
    drawSkyRect(ctx, cx + g.x, g.y, g.w, g.h, sp.base, sp.skyTop, m);
  }
  function drawSkyRect(ctx, x0, y0, w, h, base, skyTop, m) {
    if (x0 > G.W + M || x0 + w < -M || h <= 0 || w <= 0) return sunInfo;
    const visTop = Math.max(y0, -10), visH = Math.max(1, base - visTop);
    const S0 = G.state, t = S0.realT;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.clip();
    ctx.fillStyle = skyGradient(ctx, skyTop, base);
    ctx.fillRect(x0, y0, w, h);

    if (F.starA > 0.01) {
      ctx.globalAlpha = F.starA;
      const off = mod(S0.dist * PAR_STARS, STAR_SPAN);
      for (let sy = skyTop; sy < y0 + h; sy += STAR_H) {
        for (let x = x0 - mod(x0 + off, STAR_SPAN); x < x0 + w; x += STAR_SPAN) blit(ctx, S.stars, x, sy);
        if (sy + STAR_H >= base) break;
      }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        const tw = reduceMotion ? 0.7 : 0.4 + 0.6 * Math.abs(Math.sin(t * (1.3 + i * 0.4) + i * 2.1 + m));
        ctx.globalAlpha = F.starA * tw;
        const sx = x0 + 6 + hash(m * 4 + i, 20) * (w - 12), sy = visTop + 6 + hash(m * 4 + i, 21) * visH * 0.6;
        ctx.fillRect(sx - 1.8, sy - 0.25, 3.6, 0.5);
        ctx.fillRect(sx - 0.25, sy - 1.8, 0.5, 3.6);
      }
      ctx.globalAlpha = 1;
    }
    const drift = (G.W * 0.5 - (x0 + w / 2)) * 0.1;
    if (F.moonA > 0.01) {
      ctx.globalAlpha = F.moonA;
      blit(ctx, S.moon, x0 + w * (0.22 + 0.56 * F.nightFrac) + drift, base - 16 - F.moonElev * Math.max(8, visH - 40));
      ctx.globalAlpha = 1;
    }
    if (F.sunA > 0.01) {
      const sx = x0 + w * (0.2 + 0.6 * F.dayFrac) + drift, sy = base - 10 - F.sunElev * Math.max(8, visH - 34);
      const warm = clamp01(F.sunset * 1.2);
      if (warm < 0.99) {
        ctx.globalAlpha = F.sunA * (1 - warm);
        blit(ctx, S.sun, sx, sy);
      }
      if (warm > 0.01) {
        ctx.globalAlpha = F.sunA * warm;
        blit(ctx, S.sunWarm, sx, sy);
      }
      ctx.globalAlpha = 1;
      sunInfo.x = sx;
      sunInfo.y = sy;
      sunInfo.vis = sx > -M && sx < G.W + M && sy > -M;
    }
    const wDay = (1 - F.night) * (1 - F.sunset), wSet = F.sunset * (1 - F.night), wNight = F.night * 0.8;
    const span = G.W + 260;
    for (let i = 0; i < 4; i++) {
      const sx = mod(hash(i, 50) * span + t * (2 + i * 0.7) - S0.dist * 0.03, span) - 130;
      if (sx + 60 < x0 || sx - 60 > x0 + w) continue;
      const sy = visTop + (0.1 + hash(i, 51) * 0.32) * visH;
      const sc = 0.7 + hash(i, 52) * 0.6;
      const cl = S.clouds;
      for (let k = 0; k < 3; k++) {
        const wk = k === 0 ? wDay : k === 1 ? wSet : wNight;
        if (wk < 0.02) continue;
        ctx.globalAlpha = wk * 0.92;
        ctx.drawImage(cl[k].c, sx - cl[k].ox * sc, sy - cl[k].oy * sc, cl[k].w * sc, cl[k].h * sc);
      }
    }
    ctx.globalAlpha = 1;

    drawCity(ctx, x0, w, base + 3);

    if (F.snow > 0.01) {
      ctx.globalAlpha = F.snow * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      const sh = hash(m, 60);
      for (let i = 0; i < SNOW; i++) {
        const j = i * 4;
        const fx = x0 + mod(snow[j] + sh, 1) * w + Math.sin(t * 1.3 + snow[j + 3]) * 3;
        const fy = visTop + snow[j + 1] * visH;
        const r = 0.6 + (i % 3) * 0.45;
        ctx.moveTo(fx + r, fy);
        ctx.arc(fx, fy, r, 0, TAU);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (F.rain > 0.01) {
      ctx.globalAlpha = F.rain;
      ctx.strokeStyle = 'rgba(205,220,245,0.45)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      const sh = hash(m, 61);
      for (let i = 0; i < RAIN; i++) {
        const j = i * 4;
        const rx = x0 + mod(rain[j] + sh, 1) * w, ry = visTop + rain[j + 1] * visH;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 0.5, ry + 3 + rain[j + 3] * 7);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(215,228,250,0.4)';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const bx = x0 + 3 + hash(m * 16 + i, 70) * (w - 6), by = visTop + 4 + hash(m * 16 + i, 71) * (visH - 8);
        const r = 0.7 + hash(i, 72) * 0.9;
        ctx.moveTo(bx + r, by);
        ctx.arc(bx, by, r, 0, TAU);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return sunInfo;
  }
  function drawCity(ctx, x0, w, base) {
    const off = G.state.dist * PAR_CITY;
    const n0 = Math.floor((x0 + off) / CITY_SPAN), n1 = Math.floor((x0 + w + off) / CITY_SPAN);
    const B = city.back, Fr = city.front;
    ctx.fillStyle = F.cityBack;
    ctx.beginPath();
    for (let n = n0; n <= n1; n++) {
      const tx = n * CITY_SPAN - off;
      for (let i = 0; i < B.length; i += 3) {
        const bx = tx + B[i];
        if (bx > x0 + w || bx + B[i + 1] < x0) continue;
        ctx.rect(bx, base - B[i + 2], B[i + 1], B[i + 2] + 4);
      }
    }
    ctx.fill();
    ctx.fillStyle = F.cityFront;
    ctx.beginPath();
    for (let n = n0; n <= n1; n++) {
      const tx = n * CITY_SPAN - off;
      for (let i = 0; i < Fr.length; i += 4) {
        const bx = tx + Fr[i];
        if (bx > x0 + w || bx + Fr[i + 1] < x0) continue;
        ctx.rect(bx, base - Fr[i + 2], Fr[i + 1], Fr[i + 2] + 4);
        if (Fr[i + 3]) ctx.rect(bx + Fr[i + 1] / 2 - 0.4, base - Fr[i + 2] - 7, 0.8, 7);
      }
    }
    ctx.fill();
    const litA = F.night * 0.95;
    if (litA > 0.01) {
      ctx.globalAlpha = litA;
      for (let n = n0; n <= n1; n++) blit(ctx, S.cityLit, n * CITY_SPAN - off, base);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- гирлянда ----------
  const BULBS = [['#ffcf6b', '255,190,90', '#fff0c2'], ['#fff1c9', '255,230,170', '#fffaf0'], ['#ff9fb8', '255,120,160', '#ffe3ec'], ['#9fe3c9', '120,230,190', '#e6fff6'], ['#a8c8ff', '130,170,255', '#eaf2ff']];
  const GARLAND_REPEAT = 5, GARLAND_SAG = 12;
  function buildGarland(lit) {
    const span = GARLAND_SPAN * GARLAND_REPEAT, sag = GARLAND_SAG;
    return mk(span, sag * 2 + 30, 0, 12, (c) => {
      if (!lit) {
        c.strokeStyle = P.wire;
        c.lineWidth = 0.9;
        c.beginPath();
        for (let p = 0; p < GARLAND_REPEAT; p++) {
          const x = p * GARLAND_SPAN;
          c.moveTo(x, 0);
          c.quadraticCurveTo(x + GARLAND_SPAN / 2, sag * 2, x + GARLAND_SPAN, 0);
        }
        c.stroke();
        c.fillStyle = P.metalDk;
        for (let p = 0; p <= GARLAND_REPEAT; p++) circle(c, p * GARLAND_SPAN, 0, 1.4);
      }
      for (let p = 0; p < GARLAND_REPEAT; p++) {
        const x = p * GARLAND_SPAN;
        for (let b = 0; b < 4; b++) {
          const t = (b + 0.5) / 4, u = 1 - t;
          const bx = u * u * x + 2 * u * t * (x + GARLAND_SPAN / 2) + t * t * (x + GARLAND_SPAN);
          const by = 2 * u * t * sag * 2 + 4.4;
          const bulb = BULBS[Math.floor(hash(p * 4 + b, 3) * BULBS.length) % BULBS.length];
          if (lit) {
            const g = c.createRadialGradient(bx, by, 0, bx, by, 10);
            g.addColorStop(0, `rgba(${bulb[1]},0.9)`);
            g.addColorStop(0.3, `rgba(${bulb[1]},0.35)`);
            g.addColorStop(1, `rgba(${bulb[1]},0)`);
            c.fillStyle = g;
            c.fillRect(bx - 10, by - 10, 20, 20);
            c.fillStyle = bulb[2];
            ellipse(c, bx, by, 1.7, 2.4);
          } else {
            c.fillStyle = P.metalDk;
            c.fillRect(bx - 0.9, by - 4.4, 1.8, 2);
            c.globalAlpha = dark ? 0.45 : 0.6;
            c.fillStyle = bulb[0];
            ellipse(c, bx, by, 1.9, 2.7);
            c.globalAlpha = 0.5;
            c.fillStyle = '#ffffff';
            circle(c, bx - 0.6, by - 0.9, 0.5);
            c.globalAlpha = 1;
          }
        }
      }
    }, Math.min(K, 2));
  }
  function drawGarland(ctx, sp) {
    const span = GARLAND_SPAN * GARLAND_REPEAT, sc = F.wallSc;
    for (let x = -mod(sc, span); x < G.W + M; x += span) blit(ctx, sp, x, geo.garY);
    if (-mod(sc, span) > -M) blit(ctx, sp, -mod(sc, span) - span, geo.garY);
  }

  // ---------- гостиная: слои ----------
  function livingVariant(L) {
    LV = (L && LV_OF[L.variant]) || 0;
  }
  function livingBg(ctx, L) {
    livingVariant(L);
    const W = G.W;
    const off = mod(F.wallSc, WALL_TILE);
    for (let x = -off - WALL_TILE; x < W + M; x += WALL_TILE) {
      if (x + WALL_TILE > -M && x + WALL_TILE > L.x0 && x < L.x1) blit(ctx, S.wall, x, 0);
    }
    for (let i = 0; i < vis.n; i++) {
      const m = vis.m[i], sp = S.win[winVariant(m)], cx = vis.x[i] + WIN_SLOT / 2;
      const gx = cx + sp.glass.x;
      if (gx > L.x1 || gx + sp.glass.w < L.x0) continue;
      drawSky(ctx, cx, sp, m);
      for (let p = 0; p < sp.panes.length; p++) {
        const q = sp.panes[p];
        if (q[3] > 0) pushPane(cx + q[0], q[1], q[2], q[3], m * 8 + p);
      }
    }
  }
  const artOverride = (k) => (hasPoint('living.art') ? point('living.art', k, LV) : undefined);
  function drawArt(ctx, k, cx, L) {
    if (cx < -110 - M || cx > G.W + 110 + M) return null;
    const ov = artOverride(k);
    const id = ov ? 'ext' : lowerAt(k), sp = ov || S.items[id];
    if (cx < L.x0 - 140 || cx > L.x1 + 140) return id;
    if (sp) blit(ctx, sp, cx, geo.lowC);
    if (geo.upSpace > 20) {
      const uid = upperAt(k, id), us = uid && S.items[uid];
      if (us && us.hh * 2 + 4 <= geo.upSpace) {
        const ux = cx + (hash(k, salt(15)) - 0.5) * 36;
        if (uid === 'macrame') {
          ctx.strokeStyle = P.rope;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(ux, -M);
          ctx.lineTo(ux, geo.upC - 31);
          ctx.stroke();
        }
        blit(ctx, us, ux, geo.upC);
      }
    }
    return id;
  }
  const macro = { m: 0, LV: 0, left: 0, wcx: 0, lampX: 0, plantX: 0, ax: 0, bx: 0, bt: 0, sill: 0, gw: 0, lowC: 0, upC: 0, upSpace: 0, garY: 0, garland: false };
  function fillMacro(m, left) {
    const wcx = left + WIN_SLOT / 2, ls = lampSide(m);
    macro.m = m;
    macro.LV = LV;
    macro.left = left;
    macro.wcx = wcx;
    macro.lampX = wcx + ls * PROP_DX;
    macro.plantX = wcx - ls * PROP_DX;
    macro.ax = left + WIN_SLOT + ART_SLOT / 2;
    macro.bx = macro.ax + ART_SLOT;
    macro.bt = geo.bt;
    macro.sill = geo.bt - 13;
    macro.gw = WIN_DEFS[winVariant(m)].gw;
    macro.lowC = geo.lowC;
    macro.upC = geo.upC;
    macro.upSpace = geo.upSpace;
    macro.garY = geo.garY;
    macro.garland = geo.garland;
    return macro;
  }
  // Место под внешний постер на стартовом кадре: слева от окна вместо растения, на высокой стене — над табличкой, иначе под ней.
  const spot = { x: 0, y: 0, w: 0, h: 0, hidePlant: false };
  function startSpot(wcx) {
    const shift = G.state.dist * PAR_WALL, wcx0 = wcx + shift;
    const room = wcx0 - (WIN_DEFS[0].gw / 2 + 6) - 38;
    if (room >= 68) {
      spot.w = 60;
      spot.h = 76;
      spot.x = Math.max(36, Math.min(wcx0 - PROP_DX, room - 30));
      spot.y = geo.lowC + 4;
      spot.hidePlant = true;
    } else if (geo.upSpace >= 120) {
      spot.w = 58;
      spot.h = 70;
      spot.x = wcx0 + WIN_SLOT / 2 + ART_SLOT / 2;
      spot.y = geo.lowC - 36 - spot.h / 2;
      spot.hidePlant = false;
    } else if (room >= 40) {
      spot.w = room - 6;
      spot.h = (spot.w * 76) / 60;
      spot.x = room - spot.w / 2;
      spot.y = geo.lowC + 4;
      spot.hidePlant = true;
    } else if (geo.bt - 2 - (geo.lowC + 26) >= 44) {
      const gap = geo.bt - 2 - (geo.lowC + 26);
      spot.h = Math.min(60, gap + 4);
      spot.w = (spot.h * 60) / 76;
      spot.x = wcx0 + WIN_SLOT / 2 + ART_SLOT / 2 + 50;
      spot.y = geo.lowC + 29 + spot.h / 2;
      spot.hidePlant = false;
    } else return null;
    spot.x -= shift;
    return spot;
  }
  function livingWall(ctx, L) {
    if (!S.ready) return;
    livingVariant(L);
    const bt = geo.bt, W = G.W;
    const ext = hasPoint('living.macro'), extSpot = LV === 0 && hasPoint('living.spot');
    for (let i = 0; i < vis.n; i++) {
      const m = vis.m[i], left = vis.x[i], wcx = left + WIN_SLOT / 2;
      const winIn = wcx > -200 && wcx < W + 200 && wcx > L.x0 - 300 && wcx < L.x1 + 300;
      if (winIn) blit(ctx, S.win[winVariant(m)], wcx, 0);
      const ax = left + WIN_SLOT + ART_SLOT / 2, bx = ax + ART_SLOT;
      const idA = drawArt(ctx, 2 * m, ax, L);
      const idB = drawArt(ctx, 2 * m + 1, bx, L);
      let hidePlant = false;
      if (extSpot && m === 0) {
        const sp = startSpot(wcx);
        if (sp && point('living.spot', ctx, sp.x, sp.y, sp.w, sp.h)) hidePlant = sp.hidePlant;
      }
      if (winIn) {
        const ls = lampSide(m), pl = windowPlant(m);
        blit(ctx, S.lamp, wcx + ls * PROP_DX, bt);
        const px = wcx - ls * PROP_DX;
        if (!hidePlant && pl && !point('living.plant', ctx, px, bt, m, LV)) blit(ctx, pl === 1 ? S.monstera : S.snake, px, bt);
      }
      const hp = hash(m, salt(13));
      const spA = idA && S.items[idA], spB = idB && S.items[idB];
      if (spA && spA.narrow && hp < 0.4) blit(ctx, S.snake, ax + 96, bt);
      else if (spB && spB.narrow && hp > 0.6) blit(ctx, S.snake, bx - 96, bt);
      if (ext) point('living.macro', ctx, fillMacro(m, left), L);
    }
    if (!point('living.garland', ctx, fillMacro(0, 0), F.wallSc) && geo.garland) drawGarland(ctx, S.garland);
  }
  function livingBack(ctx, L) {
    if (!S.ready) return;
    livingVariant(L);
    const W = G.W, bt = geo.bt, GR = G.GROUND;
    ctx.fillStyle = P.backFrame;
    ctx.fillRect(Math.max(-M, L.x0), bt + 16, Math.min(W + M, L.x1) - Math.max(-M, L.x0), GR + 14 - bt - 16);
    const sc = G.state.dist * PAR_BACK - (G.heroX() - CUSHION / 2);
    const i0 = Math.floor((sc - M) / CUSHION), i1 = Math.floor((sc + W + M) / CUSHION);
    const pulse = !reduceMotion && feverK > 0.01 ? 0.03 * Math.sin(TAU * 2 * G.state.realT) * feverK : 0;
    for (let i = i0; i <= i1; i++) {
      const x = i * CUSHION - sc;
      if (x > L.x1 || x + CUSHION < L.x0) continue;
      const sp = S.cush[Math.floor(hash(i, salt(10)) * 3) % 3];
      if (pulse) {
        const cx = x + CUSHION / 2, by = GR + 14;
        ctx.save();
        ctx.translate(cx, by);
        ctx.scale(1 + pulse, 1 + pulse);
        ctx.translate(-cx, -by);
        blit(ctx, sp, x, bt);
        ctx.restore();
      } else blit(ctx, sp, x, bt);
    }
    for (let i = i0 - 1; i <= i1 + 1; i++) {
      if (i === 0 && LV === 0) continue;
      const cx = i * CUSHION - sc + CUSHION / 2;
      if (cx < L.x0 - 140 || cx > L.x1 + 140) continue;
      const hp = hash(i, salt(11));
      if ((i === -1 && LV === 0) || hp < 0.3) {
        const first = i === -1 && LV === 0;
        const side = first ? 1 : hash(i, salt(13)) < 0.5 ? -1 : 1;
        const v = first ? 1 : Math.floor(hash(i, salt(12)) * PILLOWS.length) % PILLOWS.length;
        const px = cx + side * 64;
        if (px < -60 - M || px > W + 60 + M) continue;
        ctx.save();
        ctx.translate(px, GR - 34);
        ctx.rotate(side * -0.11 + (hash(i, salt(14)) - 0.5) * 0.08);
        blit(ctx, S.pillows[v], 0, 0);
        ctx.restore();
      } else if (hp > (LV === 1 ? 0.78 : 0.9) && cx > -80 - M && cx < W + 80 + M) {
        if (LV === 1) {
          ctx.save();
          ctx.translate(cx, bt + 30);
          ctx.rotate((hash(i, salt(16)) - 0.5) * 0.3);
          ctx.scale(1, 0.86);
          blit(ctx, S.plaid, (hash(i, salt(16)) - 0.5) * 60, -30);
          ctx.restore();
        } else blit(ctx, S.plaid, cx + (hash(i, salt(16)) - 0.5) * 60, bt);
      }
      if (LV === 1) {
        const hx = hash(i, salt(17));
        if (hx < 0.27 && cx > -80 - M && cx < W + 80 + M) blit(ctx, S.laptopClosed, cx + 70, GR - 2);
        else if (hx > 0.82) blit(ctx, S.mugs, cx - 40, bt - 1);
      }
    }
  }
  function livingGround(ctx, L) {
    const W = G.W, GR = G.GROUND;
    if (!S.ready) {
      ctx.fillStyle = G.C.seat;
      ctx.fillRect(Math.max(-M, L.x0), GR - 8, Math.min(W + M, L.x1) - Math.max(-M, L.x0), G.H - GR + M);
      return;
    }
    const sc = G.state.dist - (G.heroX() - SEAT_TILE / 2);
    const off = mod(sc, SEAT_TILE);
    for (let x = -off - SEAT_TILE; x < W + M; x += SEAT_TILE) {
      if (x + SEAT_TILE > -M && x + SEAT_TILE > L.x0 && x < L.x1) blit(ctx, S.seat, x, GR - 12);
    }
    drawDent(ctx);
  }

  const BEAM_X = [0.24, 0.56, 0.84], BEAM_W = [0.34, 0.2, 0.28], BEAM_A = [1, 0.7, 0.85];
  function beamsRect(ctx, x0, top0, w, base, m) {
    const top = Math.max(top0, -10);
    const a = F.beamAng, cos = Math.cos(a);
    const y0 = top + (base - top) * 0.18;
    const len = (G.GROUND + 60 - y0) / Math.max(0.3, cos);
    const warm = clamp01(F.sunset * 1.2);
    const spread = 1 + Math.abs(Math.sin(a)) * 0.6 + F.sunset * 0.35;
    const lr = 255, lg = 242 - 82 * warm, lb = 214 - 124 * warm;
    for (let i = 0; i < 3; i++) {
      const bw = w * BEAM_W[i] * spread;
      const bx = x0 + w * BEAM_X[i];
      ctx.save();
      ctx.translate(bx, y0);
      ctx.rotate(-a);
      const al = F.beamA * BEAM_A[i];
      if (warm < 0.99) {
        ctx.globalAlpha = ea(al * (1 - warm));
        ctx.drawImage(S.beam.c, -bw / 2, 0, bw, len);
      }
      if (warm > 0.01) {
        ctx.globalAlpha = ea(al * warm);
        ctx.drawImage(S.beamWarm.c, -bw / 2, 0, bw, len);
      }
      if (i === 0) drawMotes(ctx, bw, len, m);
      ctx.restore();
      pushLight('beam', bx, y0, bw, len, a, al, lr, lg, lb);
    }
    ctx.globalAlpha = 1;
  }
  function drawMotes(ctx, bw, len, m) {
    const t = G.state.realT * (reduceMotion ? 0.3 : 1), a0 = F.beamA * 2.2;
    if (a0 < 0.02) return;
    ctx.fillStyle = '#fff6dc';
    const sh = hash(m, 90);
    for (let i = 0; i < MOTES; i++) {
      const j = i * 4;
      const v = mod(mote[j + 1] + sh, 1);
      const u = mote[j] * 0.9 + Math.sin(t * 0.7 + mote[j + 2]) * 0.05;
      const al = a0 * Math.sin(Math.PI * v) * (0.45 + 0.55 * Math.abs(Math.sin(t * 1.9 + mote[j + 2] * 3)));
      if (al < 0.02) continue;
      ctx.globalAlpha = ea(Math.min(1, al));
      const s = 0.7 + mote[j + 3] * 1.3;
      ctx.fillRect(u * bw - s / 2, v * len * 0.7 - s / 2, s, s);
    }
  }
  function drawLampLight(ctx, lx, bt) {
    const k = F.lamp, sy = bt - 75;
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = ea(k * (dark ? 0.75 : 0.72));
    glow(ctx, S.glowWarm, lx, sy + 30, 250, 215);
    ctx.globalAlpha = ea(k * (dark ? 0.5 : 0.42));
    ctx.drawImage(S.cone.c, lx - 135, bt - 58, 270, G.GROUND + 30 - (bt - 58));
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = k;
    blit(ctx, S.lampLit, lx, bt);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = ea(k * 0.55);
    glow(ctx, S.glowWarm, lx, sy, 40, 30);
    ctx.globalCompositeOperation = 'source-over';
    pushLight('glow', lx, sy + 30, 500, 430, 0, k, 255, 196, 120);
  }
  function livingEmissive(ctx, L) {
    if (!S.ready) return;
    livingVariant(L);
    const W = G.W;
    for (let i = 0; i < vis.n; i++) {
      const m = vis.m[i], left = vis.x[i], wcx = left + WIN_SLOT / 2;
      const onScreen = wcx > -260 && wcx < W + 260 && wcx > L.x0 - 300 && wcx < L.x1 + 300;
      if (onScreen && F.beamA > 0.01) {
        const sp = S.win[winVariant(m)], g = sp.glass;
        ctx.globalCompositeOperation = 'screen';
        beamsRect(ctx, wcx + g.x, g.y, g.w, sp.base, m);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (onScreen && F.lamp > 0.01) {
        const lx = wcx + lampSide(m) * PROP_DX;
        if (lx > -200 && lx < W + 200) drawLampLight(ctx, lx, geo.bt);
      }
      for (let s = 0; s < 2; s++) {
        const k = 2 * m + s, cx = left + WIN_SLOT + ART_SLOT / 2 + s * ART_SLOT;
        if (cx < -160 || cx > W + 160 || cx < L.x0 - 160 || cx > L.x1 + 160) continue;
        const id = artOverride(k) ? 'ext' : lowerAt(k);
        if (id === 'neon' && F.lamp > 0.01) {
          let flick = 1;
          if (!reduceMotion) {
            const h = hash(Math.floor(G.state.realT * 14), 77 + k);
            flick = h < 0.04 ? 0.25 : h < 0.07 ? 0.7 : 1;
          }
          const nk = smooth(clamp01(F.lamp * 1.3)) * flick;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = ea(nk * 0.85);
          blit(ctx, S.neonGlow, cx, geo.lowC);
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = ea(nk * 0.35);
          glow(ctx, S.glowPink, cx, geo.lowC + 8, 120, 80);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = nk;
          blit(ctx, S.neonOn, cx, geo.lowC);
          pushLight('glow', cx, geo.lowC + 8, 240, 160, 0, nk * 0.35, 255, 80, 160);
        } else if (id === 'desk' && F.night > 0.01) {
          const sk = clamp01(F.night * 1.3);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = sk;
          blit(ctx, S.screenOn, cx, geo.lowC);
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = ea(sk * 0.5);
          glow(ctx, S.glowCool, cx - 38, geo.lowC + 6, 80, 60);
          pushLight('glow', cx - 38, geo.lowC + 6, 160, 120, 0, sk * 0.5, 150, 200, 255);
        }
      }
      if (onScreen && hasPoint('living.glow')) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        point('living.glow', ctx, fillMacro(m, left), L);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const dawnLit = LV === 2 ? clamp01((420 - L.clock) / 30) * (L.clock > 240 ? 1 : 0) : 0;
    const gl = Math.max(F.lamp, dawnLit);
    if (point('living.garlandGlow', ctx, fillMacro(0, 0), F.wallSc, gl)) return;
    if (geo.garland && gl > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = ea(gl);
      drawGarland(ctx, S.garlandLit);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  }
  function livingFront(ctx, L) {
    if (!S.ready) return;
    livingVariant(L);
    const W = G.W, H = G.H;
    const sc = G.state.dist * PAR_FRONT - W * 0.06;
    const j0 = Math.floor((sc - 140) / FG_SLOT), j1 = Math.floor((sc + W + 140) / FG_SLOT);
    const shadeA = Math.min(0.85, (dark ? 0.35 : 0.18) + F.night * 0.45);
    for (let j = j0; j <= j1; j++) {
      let type;
      if (j === 0 && LV === 0) type = 0;
      else if (hash(j, salt(81)) < 0.5) continue;
      else type = Math.floor(hash(j, salt(82)) * 3) % 3;
      const x = j * FG_SLOT - sc;
      let sp = S.fg[type], spD = S.fgDark[type];
      if (LV === 2 && hash(j, salt(83)) < 0.45) {
        sp = S.pizza;
        spD = S.pizzaDark;
      }
      if (x + sp.ox < -M || x - sp.ox > W + M || x + sp.ox < L.x0 || x - sp.ox > L.x1) continue;
      ctx.globalAlpha = 0.94;
      blit(ctx, sp, x, H + 8);
      ctx.globalAlpha = shadeA;
      blit(ctx, spD, x, H + 8);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- вмятина от приземления (только диван) ----------
  const dent = { on: false, wx: 0, p: 0, d: 0, v: 0 };
  G.on('land', (e) => {
    if (!e || !(e.impact > 500) || G.state.mode !== 'run' || !curInst.living) return;
    dent.on = true;
    dent.wx = G.bunny.x + G.state.dist;
    dent.p = clamp01((e.impact - 500) / 800);
    dent.d = 1;
    dent.v = 0;
  });
  function dentUpdate(rdt) {
    if (!dent.on) return;
    const n = Math.max(1, Math.ceil(rdt / 0.008)), h = rdt / n;
    for (let i = 0; i < n; i++) {
      dent.v += (-300 * dent.d - 18 * dent.v) * h;
      dent.d += dent.v * h;
    }
    if (Math.abs(dent.d) < 0.01 && Math.abs(dent.v) < 0.2) dent.on = false;
  }
  function drawDent(ctx) {
    if (!dent.on || dent.d <= 0.01) return;
    const x = dent.wx - G.state.dist, GR = G.GROUND, p = dent.p, d = dent.d;
    if (x < -M - 40 || x > G.W + M + 40) return;
    const depth = (3 + 5 * p) * d;
    ctx.fillStyle = P.seatLo;
    ctx.globalAlpha = 0.25 * p * d;
    ellipse(ctx, x, GR - 1, 23, Math.max(0.5, depth * 0.6));
    ctx.globalAlpha = 0.22 * p * d;
    ctx.strokeStyle = P.seatLo;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 34, GR - 2);
    ctx.quadraticCurveTo(x - 27, GR + depth * 0.5, x - 20, GR + 1);
    ctx.moveTo(x + 34, GR - 2);
    ctx.quadraticCurveTo(x + 27, GR + depth * 0.5, x + 20, GR + 1);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const livingDef = {
    id: 'living', name: 'ГОСТИНАЯ', sign: 'ГОСТИНАЯ', title: 'давай ебланить', surface: 'fabric', outdoor: false,
    bg: livingBg, wall: livingWall, back: livingBack, ground: livingGround, emissive: livingEmissive, front: livingFront,
  };

  // ---------- точки расширения: внешний декор и опорные точки ----------
  const decorFns = Object.create(null);
  const pointFns = Object.create(null);
  function dropFn(list, fn, tag, e) {
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
    G.report(tag, e);
  }
  function runDecor(ctx, inst, name) {
    const byLoc = decorFns[name], list = byLoc && byLoc[inst.id];
    if (!list || !list.length) return;
    for (let i = 0; i < list.length; i++) {
      const fn = list[i];
      ctx.save();
      try {
        fn(ctx, inst.L, kit);
      } catch (e) {
        dropFn(list, fn, 'decor ' + inst.id + '.' + name, e);
        i--;
      }
      ctx.restore();
    }
  }
  const hasPoint = (name) => !!(pointFns[name] && pointFns[name].length);
  function point(name, a, b, c, d, e, f, g) {
    const list = pointFns[name];
    if (!list || !list.length) return undefined;
    const isCtx = a && typeof a.save === 'function';
    for (let i = 0; i < list.length; i++) {
      const fn = list[i];
      let r;
      if (isCtx) a.save();
      try {
        r = fn(a, b, c, d, e, f, g);
      } catch (err) {
        dropFn(list, fn, 'scene point ' + name, err);
        i--;
      }
      if (isCtx) a.restore();
      if (r !== undefined && r !== null && r !== false) return r;
    }
    return undefined;
  }
  const anchors = Object.create(null);
  let anchorTick = 0;
  function setAnchor(id, x, y, w, h) {
    if (typeof id !== 'string' || !Number.isFinite(x) || !Number.isFinite(y) || !(w > 0) || !(h > 0)) return;
    const a = anchors[id] || (anchors[id] = { id, x: 0, alt: 0, w: 0, h: 0, tick: -1 });
    a.x = x;
    a.alt = G.GROUND - y;
    a.w = w;
    a.h = h;
    a.tick = anchorTick;
  }
  function getAnchor(id) {
    const a = anchors[id];
    if (!a || a.tick !== anchorTick || a.x + a.w / 2 < 0 || a.x - a.w / 2 > G.W) return null;
    return a;
  }

  // ---------- каркас локаций ----------
  const locDefs = Object.create(null);
  const ALIASES = { metro: ['subway'], roof: ['rooftop'], bedroom: ['home', 'spalnya', 'bed'], dream: ['sleep', 'hole', 'burrow', 'nora'] };
  const brokenIds = new Set();
  function findDef(id) {
    if (id === 'living') return livingDef;
    if (locDefs[id]) return locDefs[id];
    const al = ALIASES[id];
    if (al) for (const a of al) if (locDefs[a]) return locDefs[a];
    return null;
  }
  const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const insts = new Set();
  function newInst(def, variant) {
    const inst = {
      def, id: def.id, variant: variant || null, R: {}, sprites: [], gen: null, ready: false, broken: false, freed: false,
      stamp: -1, builtK: 0, builtH: 0, d0: 0, k: 0, idx: 0, living: def === livingDef,
      amb: [255, 255, 255],
      L: {
        id: def.id, R: null, x0: -M, x1: 0, d0: 0, u: 0, dist: 0, t: 0, clock: 0, F, W: 0, H: 0, GR: 0, M, K: 1,
        dark: false, P: null, tier: 2, fever: 0, boss: false, variant: null, idx: 0, inst: null,
      },
    };
    inst.L.inst = inst;
    inst.L.R = inst.R;
    if (!inst.living) insts.add(inst);
    return inst;
  }
  const livingInst = newInst(livingDef, 'morning');
  livingInst.ready = true;
  let curInst = livingInst;

  function updateMB() {
    let b = 0;
    const add = (sp) => { if (sp && sp.c) b += sp.c.width * sp.c.height * 4; };
    for (const sp of livingOwner.sprites) add(sp);
    for (const inst of insts) for (const sp of inst.sprites) add(sp);
    if (seam) for (const sp of seam.sprites) add(sp);
    if (sub.sp) add(sub.sp);
    debug.spriteMB = +(b / 1048576).toFixed(2);
  }
  function breakInst(inst, e) {
    G.report('loc ' + inst.id, e);
    inst.broken = true;
    inst.gen = null;
    if (!inst.living) brokenIds.add(inst.id);
  }
  function freeInst(inst) {
    if (!inst || inst.living || inst.freed) return;
    for (const sp of inst.sprites) freeSprite(sp);
    inst.sprites.length = 0;
    inst.R = {};
    inst.L.R = inst.R;
    inst.gen = null;
    inst.ready = false;
    inst.freed = true;
    insts.delete(inst);
    debug.freed++;
    updateMB();
  }
  function startBuild(inst) {
    for (const sp of inst.sprites) freeSprite(sp);
    inst.sprites.length = 0;
    inst.R = {};
    inst.L.R = inst.R;
    inst.ready = false;
    inst.gen = null;
    inst.stamp = buildGen;
    inst.builtK = K;
    inst.builtH = G.H;
    if (inst.broken) return;
    const def = inst.def;
    if (typeof def.build !== 'function') {
      inst.ready = true;
      return;
    }
    fillL(inst, -M, G.W + M);
    const prevOwner = buildOwner;
    buildOwner = inst;
    try {
      const g = def.build(kit, inst.R, inst.L);
      if (g && typeof g.next === 'function') inst.gen = g;
      else inst.ready = true;
    } catch (e) {
      breakInst(inst, e);
    }
    buildOwner = prevOwner;
  }
  function stepBuild(inst, budget) {
    if (!inst.gen) return;
    const t0 = nowMs();
    const prevOwner = buildOwner;
    buildOwner = inst;
    try {
      for (;;) {
        const r = inst.gen.next();
        if (r.done) {
          inst.gen = null;
          inst.ready = true;
          break;
        }
        if (nowMs() - t0 >= budget) break;
      }
    } catch (e) {
      breakInst(inst, e);
    }
    buildOwner = prevOwner;
    if (inst.ready) updateMB();
  }
  function buildNow(inst) {
    if (inst.living || inst.ready || inst.broken) return;
    const t0 = nowMs();
    if (!inst.gen) startBuild(inst);
    stepBuild(inst, Infinity);
    debug.buildMs = +(nowMs() - t0).toFixed(2);
  }
  const visibleInst = (inst) => inst === curInst || (seam && (inst === seam.from || inst === seam.to));
  function refreshStale() {
    for (const inst of insts) {
      if (inst.broken || inst.freed) continue;
      if (inst.stamp === buildGen && inst.builtK === K && inst.builtH === G.H) continue;
      startBuild(inst);
      if (visibleInst(inst)) stepBuild(inst, Infinity);
    }
  }

  // ---------- регионы кадра ----------
  const REG = [{ inst: null, x0: 0, x1: 0 }, { inst: null, x0: 0, x1: 0 }];
  let nReg = 1, regI = -1;
  const tierNow = () => {
    const t = G.gfx && Number(G.gfx.tier);
    return t === 0 || t === 1 || t === 2 ? t : 2;
  };
  function fillL(inst, x0, x1) {
    const L = inst.L, S0 = G.state;
    L.R = inst.R;
    L.x0 = x0;
    L.x1 = x1;
    L.d0 = inst.d0;
    L.dist = S0.dist;
    L.u = S0.dist - inst.d0;
    L.t = S0.realT;
    L.clock = sceneInfo.clock;
    L.W = G.W;
    L.H = G.H;
    L.GR = G.GROUND;
    L.K = K;
    L.dark = dark;
    L.P = P;
    L.tier = tierNow();
    L.fever = feverK;
    L.boss = bossOn;
    L.variant = inst.variant;
    L.idx = inst.idx;
    return L;
  }
  function instAmb(inst) {
    const out = inst.amb;
    out[0] = cur[9];
    out[1] = cur[10];
    out[2] = cur[11];
    if (dark) for (let i = 0; i < 3; i++) out[i] += (255 - out[i]) * 0.45;
    const fn = inst.def.amb;
    if (typeof fn === 'function' && !inst.broken) {
      try {
        fn.call(inst.def, inst.L, out);
      } catch (e) {
        breakInst(inst, e);
      }
    }
    for (let i = 0; i < 3; i++) {
      const v = +out[i];
      out[i] = Number.isFinite(v) ? G.clamp(v, 0, 255) : 255;
    }
    return out;
  }
  function computeRegions() {
    const W = G.W;
    nReg = 0;
    if (seam && seam.split) {
      const xb = seamX();
      if (xb > -M) {
        REG[nReg].inst = seam.from;
        REG[nReg].x0 = -M;
        REG[nReg].x1 = Math.min(xb, W + M);
        nReg++;
      }
      if (xb < W + M) {
        REG[nReg].inst = seam.to;
        REG[nReg].x0 = Math.max(-M, xb);
        REG[nReg].x1 = W + M;
        nReg++;
      }
    }
    if (!nReg) {
      REG[0].inst = curInst;
      REG[0].x0 = -M;
      REG[0].x1 = W + M;
      nReg = 1;
    }
    for (let i = 0; i < nReg; i++) {
      const r = REG[i];
      fillL(r.inst, r.x0, r.x1);
      instAmb(r.inst);
    }
  }
  function fallbackLayer(ctx, name, L) {
    const x0 = Math.max(-M, L.x0), w = Math.min(G.W + M, L.x1) - x0;
    if (w <= 0) return;
    if (name === 'bg') {
      ctx.fillStyle = P ? P.wall : G.C.wall;
      ctx.fillRect(x0, -M, w, G.H + M * 2);
    } else if (name === 'ground') {
      ctx.fillStyle = G.C.seat || '#cbb089';
      ctx.fillRect(x0, G.GROUND - 8, w, G.H - G.GROUND + M + 8);
      ctx.fillStyle = G.C['seat-lo'] || '#a88e6a';
      ctx.fillRect(x0, G.GROUND + 4, w, G.H - G.GROUND + M);
    }
  }
  function callHook(ctx, inst, name) {
    const L = inst.L;
    if (inst.broken || (!inst.living && !inst.ready)) {
      fallbackLayer(ctx, name, L);
      return;
    }
    const fn = inst.def[name];
    if (typeof fn !== 'function') {
      if (name === 'ground') fallbackLayer(ctx, name, L);
    } else {
      const prevOwner = buildOwner;
      buildOwner = inst.living ? null : inst;
      try {
        fn.call(inst.def, ctx, L);
      } catch (e) {
        breakInst(inst, e);
      }
      buildOwner = prevOwner;
    }
    if (decorFns[name] && !inst.broken) runDecor(ctx, inst, name);
  }
  function runHook(ctx, name) {
    for (let i = 0; i < nReg; i++) {
      const r = REG[i];
      regI = i;
      ctx.save();
      if (nReg > 1) {
        ctx.beginPath();
        ctx.rect(r.x0, -M - 40, r.x1 - r.x0, G.H + M * 2 + 80);
        ctx.clip();
      }
      callHook(ctx, r.inst, name);
      ctx.restore();
    }
    regI = -1;
  }
  function pushPane(x, y, w, h, key) {
    if (panes.n >= PANE_MAX || !(w > 0) || !(h > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    let x0 = x, x1 = x + w;
    if (regI >= 0) {
      const r = REG[regI];
      if (x0 < r.x0) x0 = r.x0;
      if (x1 > r.x1) x1 = r.x1;
    }
    if (x1 <= x0) return;
    const i = panes.n++;
    panes.x[i] = x0;
    panes.y[i] = y;
    panes.w[i] = x1 - x0;
    panes.h[i] = h;
    panes.key[i] = key | 0;
    paneReg[i] = regI < 0 ? 0 : regI;
  }
  function inRegion(x) {
    if (regI < 0) return true;
    const r = REG[regI];
    return x >= r.x0 && x <= r.x1;
  }
  function pushLight(kind, x, y, w, h, ang, a, r, g, b) {
    if (lights.n >= LIGHT_MAX || !(a > 0.005) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return;
    if (!inRegion(x)) return;
    const o = lights.list[lights.n++];
    o.kind = kind;
    o.x = x;
    o.y = y;
    o.w = w;
    o.h = h;
    o.ang = Number.isFinite(ang) ? ang : 0;
    o.a = Math.min(1, a);
    o.r = r;
    o.g = g;
    o.b = b;
  }
  function pushEmitter(kind, x, alt, k) {
    if (emitters.n >= EMIT_MAX || !Number.isFinite(x) || !Number.isFinite(alt)) return;
    if (!inRegion(x) || x < -M || x > G.W + M) return;
    const o = emitters.list[emitters.n++];
    o.kind = kind;
    o.x = x;
    o.alt = alt;
    o.k = Number.isFinite(k) ? k : 1;
  }
  function tintRegion(ctx, i) {
    const r = REG[i], amb = r.inst.amb;
    const a0 = Math.min(1, amb[0] / 255 / A2[0]), a1 = Math.min(1, amb[1] / 255 / A2[1]), a2 = Math.min(1, amb[2] / 255 / A2[2]);
    if (Math.min(a0, a1, a2) * 255 >= 252) return;
    tmp3[0] = a0 * 255;
    tmp3[1] = a1 * 255;
    tmp3[2] = a2 * 255;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = css(tmp3);
    ctx.beginPath();
    ctx.rect(r.x0, -M, r.x1 - r.x0, G.H + M * 2);
    for (let p = 0; p < panes.n; p++) if (paneReg[p] === i) ctx.rect(panes.x[p], panes.y[p], panes.w[p], panes.h[p]);
    ctx.fill('evenodd');
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- маршрут дня ----------
  const ROUTE = [
    { gm: 0, id: 'living', variant: 'morning', kind: null, name: 'ДИВАН', title: '' },
    { gm: 60, id: 'kitchen', kind: 'door', name: 'КУХНЯ', title: 'стендап с кухни, камера выключена' },
    { gm: 144, id: 'living', variant: 'noon', kind: 'door', name: 'ДИВАН', title: 'до 11:56 рукой подать' },
    { gm: 192, id: 'metro', kind: 'splice', name: 'МЕТРО', title: 'в офис к обеду. Опаздываю' },
    { gm: 240, id: 'office', kind: 'elevator', name: 'ОФИС', title: 'работаю (нет)' },
    { gm: 360, id: 'baikal', kind: 'glass', name: 'ПЕРЕГОВОРКА «БАЙКАЛ»', title: '6 мест, 11 человек' },
    { gm: 480, id: 'roof', kind: 'metal', name: 'КРЫША', title: 'закат по расписанию' },
    { gm: 660, id: 'bedroom', kind: 'splice', name: 'ДОМА', title: 'сериал сам себя не посмотрит' },
    { gm: 900, id: 'dream', kind: 'blink', name: 'СОН', title: 'кроличья нора' },
    { gm: 1260, id: 'living', variant: 'dawn', kind: 'blink', name: 'ДИВАН', title: 'будильник? какой будильник' },
  ];
  const CYCLE = ROUTE.length - 1;
  const PREP_SEC = 6;
  const SEAM_EXT = { door: [30, 134], elevator: [30, 134], glass: [30, 134], metal: [30, 134], splice: [22, 22] };
  const perSec = () => (G.cfg && G.cfg.minPerSec) || 4;
  const entryAt = (k) => (k <= 0 ? ROUTE[0] : ROUTE[1 + ((k - 1) % CYCLE)]);
  const entryIdx = (k) => (k <= 0 ? 0 : 1 + ((k - 1) % CYCLE));
  function gmAt(k) {
    if (k <= 0) return 0;
    if (FAST) return 32 * k;
    return ROUTE[1 + ((k - 1) % CYCLE)].gm + Math.floor((k - 1) / CYCLE) * 1440;
  }
  const clockOf = (gm) => G.fmtClock(Math.floor(mod(((G.cfg && G.cfg.startClockMin) || 540) + gm, 1440)));
  function livingVariantAt(gm) {
    const c = mod(540 + gm + CLOCK_SHIFT, 1440);
    return c >= 300 && c < 540 ? 'dawn' : c >= 540 && c < 660 ? 'morning' : 'noon';
  }
  sceneInfo.route = ROUTE.map((e, i) => ({ gm: FAST ? 32 * i : e.gm, id: e.id, kind: e.kind || 'start', name: e.name, title: e.title, clock: clockOf(FAST ? 32 * i : e.gm) }));

  let routeK = 0, plan = null, seam = null, since = 0;
  function makePlan(k) {
    const e = entryAt(k), gm = gmAt(k);
    let def = findDef(e.id), variant = e.variant || null;
    if (!def || brokenIds.has(def.id)) {
      def = livingDef;
      variant = livingVariantAt(gm);
    }
    const p = { k, e, gm, tT: gm / perSec(), def, variant, kind: e.kind || 'door', same: def === curInst.def, inst: null };
    if (!p.same) {
      if (def === livingDef) p.inst = livingInst;
      else {
        p.inst = newInst(def, variant);
        startBuild(p.inst);
      }
    }
    return p;
  }
  function dropPlan() {
    if (plan && plan.inst && plan.inst !== curInst && !(seam && plan.inst === seam.to)) freeInst(plan.inst);
    plan = null;
  }
  const seamX = () => G.cfg.runX + (seam.D - G.state.dist);
  function logEntry(from, to, kind) {
    debug.log.push({ t: +G.state.t.toFixed(3), from, to, kind, clock: G.fmtClock(Math.floor(G.clockMin())), gm: +(G.state.t * perSec()).toFixed(1) });
    if (debug.log.length > 64) debug.log.shift();
  }
  function switchTo(p, d0, kind) {
    const prevId = curInst.id;
    const inst = p.inst;
    if (inst.living) inst.variant = p.variant || 'noon';
    inst.d0 = d0;
    inst.k = p.k;
    inst.idx = entryIdx(p.k);
    curInst = inst;
    routeK = p.k;
    since = G.state.t;
    if (plan === p) plan = null;
    if (inst.def.outdoor) rollWeather('outdoor');
    const e = p.e && p.e.id && findDef(p.e.id) === inst.def ? p.e : null;
    const name = (e && e.name) || inst.def.name || inst.id.toUpperCase();
    const title = (e && e.title) || inst.def.title || '';
    const clock = clockOf(p.gm != null ? p.gm : G.state.t * perSec());
    locInfo.name = name;
    locInfo.title = title;
    logEntry(prevId, inst.id, kind);
    exportLoc();
    G.emit('location', { id: inst.id, prev: prevId, idx: inst.idx, k: p.k, kind, name, title, clock, variant: inst.variant });
    if (!(G.ui && G.ui.locationToasts) && G.state.mode !== 'start') showSubtitle(clock + ' · ' + name, title);
  }
  function spawnSeam(p) {
    const S0 = G.state, inst = p.inst;
    if (!inst.living) buildNow(inst);
    if (inst.broken) {
      dropPlan();
      return;
    }
    if (inst.living) inst.variant = p.variant || 'noon';
    const ext = SEAM_EXT[p.kind] || SEAM_EXT.door;
    const span = G.W + M + ext[0] - G.cfg.runX;
    seam = { kind: p.kind, split: true, D: S0.dist + span, span, extL: ext[0], extR: ext[1], from: curInst, to: inst, plan: p, switched: false, sprites: [], t0: S0.t, tT: p.tT, sign: null, strip: null, text: null };
    buildSeamArt(seam);
    G.emit('locationSoon', { id: inst.id, kind: p.kind, inSec: +(span / Math.max(60, S0.speed)).toFixed(3) });
  }
  function spawnBlink(p) {
    seam = { kind: 'blink', split: false, from: curInst, to: p.inst, plan: p, switched: false, sprites: [], t0: p.tT - 0.8, tT: p.tT, text: null };
    buildSeamArt(seam);
    G.emit('locationSoon', { id: p.inst.id, kind: 'blink', inSec: +(p.tT - G.state.t).toFixed(3) });
  }
  function endSeam() {
    if (!seam) return;
    for (const sp of seam.sprites) freeSprite(sp);
    const from = seam.from;
    seam = null;
    if (from !== curInst) freeInst(from);
    updateMB();
  }
  function seamUpdate() {
    const S0 = G.state;
    if (seam.kind === 'blink') {
      const p = seam.plan;
      if (!seam.switched) {
        if (!p.inst.living && !p.inst.ready) stepBuild(p.inst, 4);
        if (S0.t >= seam.tT) {
          buildNow(p.inst);
          if (p.inst.broken) {
            seam.switched = true;
            freeInst(p.inst);
            plan = null;
          } else {
            seam.switched = true;
            switchTo(p, S0.dist, 'blink');
            if (p.inst.living && G.fx && typeof G.fx.popup === 'function') {
              try {
                G.fx.popup(G.bunny.x + 30, G.bunny.alt + 70, 'ДЗЫНЬ!');
              } catch (e) {
                G.report('scene popup', e);
              }
            }
            if (seam.from !== curInst) {
              freeInst(seam.from);
              seam.from = curInst;
            }
          }
        }
      }
      if (S0.t - seam.t0 >= 1.2) endSeam();
      return;
    }
    if (!seam.switched && S0.dist >= seam.D) {
      seam.switched = true;
      switchTo(seam.plan, seam.D, seam.kind);
    }
    if (seam.switched && seamX() + seam.extR < -M - 20) endSeam();
  }
  function routeUpdate() {
    const S0 = G.state;
    if (S0.mode !== 'run') return;
    if (seam) seamUpdate();
    if (seam) return;
    const k = routeK + 1, tT = gmAt(k) / perSec();
    if (!plan || plan.k !== k) {
      if (S0.t < tT - PREP_SEC) return;
      dropPlan();
      plan = makePlan(k);
    }
    const p = plan;
    if (p.same) {
      if (S0.t >= tT) {
        routeK = k;
        logEntry(curInst.id, curInst.id, 'skip');
        plan = null;
      }
      return;
    }
    if (p.inst.broken) {
      freeInst(p.inst);
      plan = makePlan(k);
      return;
    }
    if (!p.inst.living && !p.inst.ready) {
      if (!p.inst.gen) startBuild(p.inst);
      stepBuild(p.inst, 4);
    }
    if (p.kind === 'blink') {
      if (S0.t >= tT - 0.8) spawnBlink(p);
    } else {
      const ext = SEAM_EXT[p.kind] || SEAM_EXT.door;
      const lead = (G.W + M + ext[0] - G.cfg.runX) / Math.max(60, S0.speed);
      if (S0.t >= tT - lead) spawnSeam(p);
    }
  }
  function gotoLoc(id, variant) {
    const def = findDef(id);
    if (!def) return false;
    if (seam) {
      for (const sp of seam.sprites) freeSprite(sp);
      const from = seam.from, to = seam.to;
      seam = null;
      if (from !== curInst) freeInst(from);
      if (to !== curInst) freeInst(to);
    }
    dropPlan();
    const S0 = G.state, gmNow = S0.t * perSec();
    let k = 0;
    while (gmAt(k + 1) <= gmNow && k < 10000) k++;
    let inst;
    if (def === curInst.def) inst = curInst;
    else if (def === livingDef) inst = livingInst;
    else {
      inst = newInst(def, variant || null);
      buildNow(inst);
    }
    if (inst.broken) return false;
    const old = curInst;
    const e = ROUTE.find((r) => findDef(r.id) === def) || { id: def.id, name: def.name, title: def.title };
    switchTo({ k, e, gm: gmNow, inst, variant: variant || (inst.living ? livingVariantAt(gmNow) : null) }, S0.dist, 'goto');
    if (old !== curInst) freeInst(old);
    return true;
  }

  // ---------- арт переходов ----------
  const DOOR_STYLE = {
    door: { wall: 0xe9e2d6, jamb: 0xf4efe6, jw: 16, leaf: 0xf7f3ea, sill: 0xc8955a },
    elevator: { wall: 0xdcdfe2, jamb: 0xb9c0c8, jw: 16, leaf: 0, sill: 0x9aa2ab },
    glass: { wall: 0xdfe6ea, jamb: 0x4a4f57, jw: 8, leaf: 0xcfe3ea, sill: 0xb9c0c8 },
    metal: { wall: 0xd8d2c8, jamb: 0x7d877f, jw: 16, leaf: 0x6d7a6f, sill: 0x8f8a80 },
  };
  function signSprite(kind, def) {
    const l1 = kind === 'elevator' ? 'ОФИС · 7 ЭТАЖ' : kind === 'glass' ? 'Переговорка «Байкал» · 6 мест' : kind === 'metal' ? 'ВЫХОД НА КРОВЛЮ' : def.sign || def.name || '';
    const l2 = kind === 'metal' ? 'посторонним вход воспрещён' : '';
    const w = kind === 'glass' ? 128 : kind === 'metal' ? 104 : 76, h = l2 ? 24 : 15;
    const bg = kind === 'metal' ? P.ph(0x2f6b4a, 0.3) : kind === 'elevator' ? P.ph(0x2b3038, 0.25) : kind === 'glass' ? P.ph(0x2c5d7c, 0.3) : P.ph(0xfbf6ec, 0.4);
    const ink = kind === 'door' ? (dark ? '#e9dfcf' : '#2b2219') : '#f4f1ea';
    return mk(w + 8, h + 8, (w + 8) / 2, (h + 8) / 2, (c, sp) => {
      c.save();
      softShadow(c, sp, 3, 1.5, 0.25);
      c.fillStyle = bg;
      rr(c, -w / 2, -h / 2, w, h, 2.5);
      c.fill();
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.lineWidth = 0.6;
      rr(c, -w / 2 + 1.2, -h / 2 + 1.2, w - 2.4, h - 2.4, 1.8);
      c.stroke();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      if (l2) {
        text(c, l1, 0, -4.6, 700, 8.5, 'display', ink, w - 8);
        text(c, l2, 0, 5.6, 500, 5.6, 'body', ink, w - 8);
      } else text(c, l1, 0, 0.6, kind === 'door' ? 700 : 600, kind === 'glass' ? 7.2 : 8.5, kind === 'glass' ? 'body' : 'display', ink, w - 8);
    });
  }
  function buildSeamArt(sm) {
    const prevOwner = buildOwner;
    buildOwner = sm;
    try {
      const def = sm.to.def, p = sm.plan;
      if (sm.kind === 'splice') {
        const H = G.H, GR = G.GROUND;
        const label = clockOf(p.gm) + ' · ' + ((p.e && findDef(p.e.id) === def && p.e.name) || def.name || def.id.toUpperCase());
        sm.strip = mk(44, H + M * 2, 22, M, (c) => {
          c.fillStyle = dark ? '#0d0a08' : '#17120e';
          c.fillRect(-22, -M, 44, H + M * 2);
          c.fillStyle = 'rgba(239,227,204,0.12)';
          c.fillRect(-21, -M, 0.8, H + M * 2);
          c.fillRect(20.2, -M, 0.8, H + M * 2);
          c.fillStyle = 'rgba(239,227,204,0.9)';
          for (let y = -M + 3; y < H + M; y += 14) {
            rr(c, -18, y, 6, 8, 1.4);
            c.fill();
            rr(c, 12, y, 6, 8, 1.4);
            c.fill();
          }
          const r = rng(97 + p.k);
          c.strokeStyle = 'rgba(239,227,204,0.2)';
          c.lineWidth = 0.6;
          c.beginPath();
          for (let i = 0; i < 3; i++) {
            const x = -8 + r() * 16, y0 = -M + r() * (H + M), len = 40 + r() * 140;
            c.moveTo(x, y0);
            c.lineTo(x + (r() - 0.5) * 2, y0 + len);
          }
          c.stroke();
          c.save();
          c.translate(1, GR - 115);
          c.rotate(-Math.PI / 2);
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          text(c, label, 0, 0, 600, 12, 'display', '#efe3cc', 210);
          c.restore();
        });
      } else if (sm.kind === 'blink') {
        const toDream = !def.outdoor && sm.to !== livingInst;
        const word = sm.to.living ? 'ДЗЫНЬ!' : 'zzz';
        sm.text = mk(90, 30, 45, 15, (c) => {
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          text(c, word, 0, 1, 700, toDream ? 18 : 16, 'display', dark ? 'rgba(255,236,226,0.75)' : 'rgba(110,62,52,0.7)');
        });
      } else {
        sm.sign = signSprite(sm.kind, def);
      }
    } catch (e) {
      G.report('scene seam', e);
    }
    buildOwner = prevOwner;
    updateMB();
  }
  function hatch(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = P.ink;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = -h; i < w; i += 5) {
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
    }
    ctx.stroke();
    ctx.restore();
  }
  function drawDoor(ctx, xb, kind) {
    const st = DOOR_STYLE[kind] || DOOR_STYLE.door;
    const GR = G.GROUND, H = G.H, lb = GR - 215, jw = st.jw;
    const wallC = P.ph(st.wall, 0.4), jambC = P.ph(st.jamb, 0.35);
    const jl = xb + 6 - jw, jr = xb + 114;
    ctx.fillStyle = wallC;
    ctx.fillRect(xb - 10, -M, 140, lb + M);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(xb - 10, -M, 1, lb + M);
    ctx.fillRect(xb + 129, -M, 1, lb + M);
    hatch(ctx, xb - 10, lb - 16, 140, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(xb - 10, lb - 1, 140, 1.2);
    const off = G.clamp((xb + 60 - G.W / 2) * 0.06, -10, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    if (off > 0.3) ctx.fillRect(jr - off, lb, off, GR - lb);
    else if (off < -0.3) ctx.fillRect(xb + 6, lb, -off, GR - lb);
    ctx.fillStyle = 'rgba(20,14,8,0.1)';
    ctx.fillRect(xb + 6, lb, 108, 7);
    ctx.fillStyle = jambC;
    ctx.fillRect(jl, lb, jw, GR - lb);
    ctx.fillRect(jr, lb, jw, GR - lb);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(jl, lb, 1, GR - lb);
    ctx.fillRect(jr, lb, 1, GR - lb);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(jl + jw - 1, lb, 1, GR - lb);
    ctx.fillRect(jr + jw - 1, lb, 1, GR - lb);
    if (kind === 'door' || kind === 'metal') {
      ctx.fillStyle = jambC;
      ctx.fillRect(jl - 4, lb - 6, jr + jw + 4 - (jl - 4), 6);
    }
    if (kind === 'elevator') {
      ctx.fillStyle = P.ph(0xa9b1ba, 0.35);
      ctx.fillRect(xb + 6, lb, 10, GR - lb);
      ctx.fillRect(xb + 104, lb, 10, GR - lb);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(xb + 8, lb, 1.2, GR - lb);
      ctx.fillRect(xb + 106, lb, 1.2, GR - lb);
      const p = clamp01(1 - (xb - G.cfg.runX) / Math.max(1, seam.span));
      const floor = 1 + Math.min(6, Math.floor(p * 7));
      const dx = xb + 60, dy = lb - 27;
      ctx.fillStyle = '#1b1f26';
      rr(ctx, dx - 12, dy - 8, 24, 16, 2);
      ctx.fill();
      seg7(ctx, dx - 4, dy - 5.5, 11, String(floor), '#7fe08a');
      ctx.fillStyle = '#7fe08a';
      ctx.beginPath();
      ctx.moveTo(dx + 6, dy - 2);
      ctx.lineTo(dx + 9, dy + 2);
      ctx.lineTo(dx + 3, dy + 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = P.ph(st.sill, 0.35);
    ctx.fillRect(xb - 14, GR - 4, 148, H + M - GR + 4);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(xb - 14, GR - 4, 148, 1.2);
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(xb - 14, GR + 3, 148, 1);
    if (kind === 'elevator') {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let x = xb - 10; x < xb + 132; x += 6) ctx.fillRect(x, GR + 6, 3, 2);
    }
    if (st.leaf) {
      const x0 = xb - 30, x1 = xb - 10, yt = GR - 210;
      ctx.beginPath();
      ctx.moveTo(x0, yt - 6);
      ctx.lineTo(x1, yt);
      ctx.lineTo(x1, GR);
      ctx.lineTo(x0, GR - 6);
      ctx.closePath();
      if (kind === 'glass') {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = P.ph(st.leaf, 0.3);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = dark ? '#c8d0d6' : '#ffffff';
        const fa = GR - 110, fb = GR - 90;
        ctx.beginPath();
        ctx.moveTo(x0, fa - 6 * ((GR - fa) / 210));
        ctx.lineTo(x1, fa);
        ctx.lineTo(x1, fb);
        ctx.lineTo(x0, fb - 6 * ((GR - fb) / 210));
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = P.ph(0x4a4f57, 0.35);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x0, yt - 6);
        ctx.lineTo(x1, yt);
        ctx.lineTo(x1, GR);
        ctx.lineTo(x0, GR - 6);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.fillStyle = P.ph(st.leaf, 0.4);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        const panel = (ya, yb) => {
          const s = (y) => 6 * ((GR - y) / 210);
          ctx.beginPath();
          ctx.moveTo(x0 + 4, ya - s(ya) * 0.8);
          ctx.lineTo(x1 - 3, ya - s(ya) * 0.15);
          ctx.lineTo(x1 - 3, yb - s(yb) * 0.15);
          ctx.lineTo(x0 + 4, yb - s(yb) * 0.8);
          ctx.closePath();
          ctx.fill();
        };
        if (kind === 'door') {
          panel(GR - 200, GR - 120);
          panel(GR - 108, GR - 14);
          ctx.fillStyle = P.ph(0xc9a24a, 0.35);
          circle(ctx, x0 + 4, GR - 96, 2);
        } else {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          for (let y = GR - 200; y < GR - 6; y += 22) {
            circle(ctx, x0 + 3, y - 5, 0.9);
            circle(ctx, x1 - 2.5, y, 0.9);
          }
          ctx.fillStyle = P.ph(0xb9c0c8, 0.3);
          ctx.fillRect(x0 + 2, GR - 100, x1 - x0 - 4, 3);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x1 - 1.2, yt, 1.2, GR - yt);
      }
    }
    if (seam.sign) {
      const sy = kind === 'elevator' ? lb - 52 : GR - 240;
      blit(ctx, seam.sign, xb + 60, Math.max(-M + 14, sy));
    }
  }
  function drawSplice(ctx, xb) {
    const sp = seam.strip;
    if (!sp) return;
    const GR = G.GROUND, top = -M, bot = G.H + M, yA = Math.max(top + 1, GR - 230);
    const band = (y0, y1, a) => {
      const sy = (y0 - top) * sp.k, sh = Math.min(sp.c.height - sy, (y1 - y0) * sp.k);
      if (sh < 1) return;
      ctx.globalAlpha = a;
      ctx.drawImage(sp.c, 0, sy, sp.c.width, sh, xb - 22, y0, 44, sh / sp.k);
    };
    band(top, yA, 1);
    band(yA, GR, 0.65);
    band(GR, bot, 1);
    ctx.globalAlpha = 1;
  }
  function drawSeamArt(ctx) {
    if (!seam || !seam.split) return;
    const xb = seamX();
    if (xb - 40 > G.W + M || xb + 140 < -M) return;
    if (seam.kind === 'splice') drawSplice(ctx, xb);
    else drawDoor(ctx, xb, seam.kind);
  }
  function seamLight() {
    if (!seam || !seam.split || seam.kind === 'splice') return;
    const xb = seamX();
    if (xb + 130 < -M || xb - 10 > G.W + M) return;
    const a = seam.from.amb, b = seam.to.amb;
    if ((lum(b[0], b[1], b[2]) - lum(a[0], a[1], a[2])) / 255 <= 0.12) return;
    const rim = G.look && G.look.rim && G.look.rim.rgb;
    const ok = rim && rim.length >= 3 && Number.isFinite(rim[0] + rim[1] + rim[2]);
    const save = regI;
    regI = -1;
    pushLight('glow', xb + 60, G.GROUND - 100, 280, 280, 0, 0.45, ok ? rim[0] : 255, ok ? rim[1] : 176, ok ? rim[2] : 112);
    regI = save;
  }
  function drawLeak(ctx) {
    if (!seam || seam.kind !== 'splice' || reduceMotion || !S.leak) return;
    const xb = seamX();
    if (xb + 22 > G.W + M || xb + 92 < -M) return;
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.22;
    ctx.drawImage(S.leak.c, xb + 22, -M, 70, G.H + M * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
  function seg7(ctx, x, y, h, str, color) {
    const w = h * 0.55, t = Math.max(0.6, h * 0.13), hh = h / 2;
    ctx.fillStyle = color;
    let cx = x;
    for (const ch of String(str)) {
      if (ch === ':') {
        ctx.fillRect(cx + t * 0.2, y + hh * 0.55, t, t);
        ctx.fillRect(cx + t * 0.2, y + hh * 1.3, t, t);
        cx += t * 2;
        continue;
      }
      const d = ch.charCodeAt(0) - 48;
      if (d >= 0 && d <= 9) {
        const s = SEG[d];
        if (s & 1) ctx.fillRect(cx + t, y, w - 2 * t, t);
        if (s & 2) ctx.fillRect(cx + w - t, y + t * 0.5, t, hh - t * 0.5);
        if (s & 4) ctx.fillRect(cx + w - t, y + hh + t * 0.5, t, hh - t);
        if (s & 8) ctx.fillRect(cx + t, y + h - t, w - 2 * t, t);
        if (s & 16) ctx.fillRect(cx, y + hh + t * 0.5, t, hh - t);
        if (s & 32) ctx.fillRect(cx, y + t * 0.5, t, hh - t * 0.5);
        if (s & 64) ctx.fillRect(cx + t, y + hh - t / 2, w - 2 * t, t);
      }
      cx += w + t * 1.4;
    }
    return cx - x;
  }

  // ---------- моргание ----------
  const easeIO = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  function lidClose(t) {
    if (t < 0) return 0;
    if (t < 0.25) return 0.35 * easeIO(t / 0.25);
    if (t < 0.45) return 0.35 * (1 - easeIO((t - 0.25) / 0.2));
    if (t < 0.8) return easeIO((t - 0.45) / 0.35);
    if (t < 1.2) return 1 - easeIO((t - 0.8) / 0.4);
    return 0;
  }
  function calmLid(t) {
    if (t < 0.45) return 0;
    if (t < 0.7) return (t - 0.45) / 0.25;
    if (t < 0.8) return 1;
    if (t < 1.15) return 1 - (t - 0.8) / 0.35;
    return 0;
  }
  let lidCss = '', lidRim = '', lidDark = null;
  function lidColors() {
    if (lidDark === dark && lidCss) return;
    lidDark = dark;
    const base = hexRGB(0xe9c9bd), rim = hexRGB(0xc99a8e), d = hexRGB(0x2a2025);
    lidCss = css(dark ? mix(base, d, 0.6) : base);
    lidRim = css(dark ? mix(rim, d, 0.6) : rim);
  }
  function drawLids(ctx) {
    if (!seam || seam.kind !== 'blink') return;
    const t = G.state.t - seam.t0, W = G.W, H = G.H, mid = H / 2;
    lidColors();
    if (reduceMotion) {
      const a = calmLid(t);
      if (a <= 0.001) return;
      ctx.globalAlpha = a;
      ctx.fillStyle = lidCss;
      ctx.fillRect(-M, -M, W + M * 2, H + M * 2);
      if (seam.text && a > 0.8) {
        ctx.globalAlpha = (a - 0.8) / 0.2;
        blit(ctx, seam.text, W / 2, mid);
      }
      ctx.globalAlpha = 1;
      return;
    }
    const c = lidClose(t);
    if (c <= 0.002) return;
    const b = H * 0.22 * (1 - c);
    const yT = -M + (mid + M) * c, yB = H + M - (H + M - mid) * c;
    ctx.fillStyle = lidCss;
    ctx.beginPath();
    ctx.moveTo(-M, -M);
    ctx.lineTo(W + M, -M);
    ctx.lineTo(W + M, yT - b);
    ctx.quadraticCurveTo(W / 2, yT + b, -M, yT - b);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-M, H + M);
    ctx.lineTo(W + M, H + M);
    ctx.lineTo(W + M, yB + b);
    ctx.quadraticCurveTo(W / 2, yB - b, -M, yB + b);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = lidRim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W + M, yT - b);
    ctx.quadraticCurveTo(W / 2, yT + b, -M, yT - b);
    ctx.moveTo(W + M, yB + b);
    ctx.quadraticCurveTo(W / 2, yB - b, -M, yB + b);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const x0 = W + M, x2 = -M, y0 = yT - b, y1 = yT + b;
    for (let i = 0; i < 7; i++) {
      const s = 0.2 + (i / 6) * 0.6, u = 1 - s;
      const px = u * u * x0 + 2 * u * s * (W / 2) + s * s * x2;
      const py = u * u * y0 + 2 * u * s * y1 + s * s * y0;
      const out = (px - W / 2) / (W / 2 + M);
      ctx.moveTo(px, py + 1);
      ctx.lineTo(px + out * 3, py + 6);
    }
    ctx.stroke();
    if (seam.text && c > 0.85) {
      ctx.globalAlpha = (c - 0.85) / 0.15;
      blit(ctx, seam.text, W / 2, mid);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- субтитр локации ----------
  const sub = { sp: null, on: false, t0: 0, l1: '', l2: '', k: 0, w: 0 };
  let measCtx = null;
  function showSubtitle(l1, l2) {
    sub.l1 = l1;
    sub.l2 = l2;
    sub.on = true;
    sub.t0 = G.state.realT;
    if (sub.sp) freeSprite(sub.sp);
    sub.sp = null;
  }
  function buildSubtitle() {
    const k = (G.scale || 1) * (G.dpr || 1);
    const maxW = G.W * 0.8;
    if (!measCtx) measCtx = document.createElement('canvas').getContext('2d');
    const meas = measCtx;
    let s1 = 15, s2 = 12;
    if (meas) {
      font(meas, 600, 15, 'display');
      const w1 = meas.measureText(sub.l1).width;
      font(meas, 500, 12, 'body');
      const w2 = sub.l2 ? meas.measureText(sub.l2).width : 0;
      const f = Math.min(1, maxW / Math.max(1, w1 + 8, w2 + 8));
      s1 = Math.max(11, 15 * f);
      s2 = Math.max(9, 12 * f);
    }
    const w = Math.ceil(maxW + 12), h = sub.l2 ? 36 : 22;
    const prevOwner = buildOwner;
    buildOwner = null;
    sub.sp = mk(w, h, w / 2, 0, (c) => {
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.strokeStyle = 'rgba(22,16,10,0.85)';
      c.lineWidth = 3;
      c.fillStyle = '#ffffff';
      font(c, 600, s1, 'display');
      c.strokeText(sub.l1, 0, 10, maxW);
      c.fillText(sub.l1, 0, 10, maxW);
      if (sub.l2) {
        font(c, 500, s2, 'body');
        c.strokeText(sub.l2, 0, 26, maxW);
        c.fillText(sub.l2, 0, 26, maxW);
      }
    }, k);
    buildOwner = prevOwner;
    sub.k = k;
    sub.w = G.W;
  }
  function drawSubtitle(ctx) {
    if (!sub.on) return;
    const e = G.state.realT - sub.t0;
    if (e >= 2.6 || e < 0 || (G.ui && G.ui.locationToasts)) {
      sub.on = false;
      if (sub.sp) freeSprite(sub.sp);
      sub.sp = null;
      return;
    }
    const k = (G.scale || 1) * (G.dpr || 1);
    if (!sub.sp || Math.abs(sub.k - k) > 0.01 || sub.w !== G.W) {
      if (sub.sp) freeSprite(sub.sp);
      buildSubtitle();
    }
    const a = e < 0.2 ? e / 0.2 : e < 2.2 ? 1 : (2.6 - e) / 0.4;
    ctx.globalAlpha = clamp01(a);
    const y = G.GROUND + 28 - sub.sp.h / 2;
    blit(ctx, sub.sp, G.W / 2, Math.min(y, G.H - sub.sp.h - 2));
    ctx.globalAlpha = 1;
  }

  // ---------- обновление ----------
  G.on('start', () => {
    if (!FORCED_WEATHER) {
      weather.kind = 0;
      weather.k = 0;
      weather.storm = false;
    }
    weather.wasNight = false;
    if (seam) {
      for (const sp of seam.sprites) freeSprite(sp);
      seam = null;
    }
    plan = null;
    for (const inst of [...insts]) freeInst(inst);
    curInst = livingInst;
    livingInst.variant = 'morning';
    livingInst.d0 = 0;
    livingInst.k = 0;
    livingInst.idx = 0;
    routeK = 0;
    since = 0;
    locInfo.name = ROUTE[0].name;
    locInfo.title = ROUTE[0].title;
    sub.on = false;
    bossOn = false;
    dent.on = false;
    kCap = KCAP[tierNow()];
    if (QS.loc && QS.loc !== 'living') gotoLoc(QS.loc);
    updateMB();
  });
  G.on('boot', () => {
    kCap = KCAP[tierNow()];
  });
  G.on('boss', (b) => {
    if (!b) return;
    if (b.phase === 'start') bossOn = true;
    else if (b.phase === 'win' || b.phase === 'fail') bossOn = false;
  });

  function exportLoc() {
    const inst = curInst, def = inst.def;
    locInfo.id = inst.id;
    locInfo.idx = inst.idx;
    locInfo.k = inst.k;
    locInfo.variant = inst.variant;
    locInfo.outdoor = !!def.outdoor;
    locInfo.surface = def.surface || 'fabric';
    locInfo.since = since;
  }
  function exportFrame() {
    const S0 = G.state;
    exportLoc();
    sceneInfo.outdoor = locInfo.outdoor;
    let surf = locInfo.surface;
    if (locInfo.outdoor && weather.k > 0.3) {
      if (weather.kind === 1) surf = 'wet';
      else if (weather.kind === 2) surf = 'snow';
    }
    sceneInfo.surface = surf;
    fillL(curInst, curInst.L.x0, curInst.L.x1 || G.W + M);
    const amb = instAmb(curInst);
    sceneInfo.amb[0] = amb[0] / 255;
    sceneInfo.amb[1] = amb[1] / 255;
    sceneInfo.amb[2] = amb[2] / 255;
    if (S0.mode === 'start') sceneInfo.next = null;
    else {
      const k = plan ? plan.k : seam && !seam.switched ? seam.plan.k : routeK + 1;
      const gm = gmAt(k);
      nextInfo.id = plan ? (plan.inst ? plan.inst.id : plan.def.id) : seam && !seam.switched ? seam.to.id : entryAt(k).id;
      nextInfo.kind = entryAt(k).kind || 'door';
      nextInfo.gm = gm;
      nextInfo.inSec = Math.max(0, gm / perSec() - S0.t);
      sceneInfo.next = nextInfo;
    }
    if (seam) {
      transInfo.kind = seam.kind;
      transInfo.from = seam.from.id;
      transInfo.to = seam.to.id;
      if (seam.split) {
        const total = seam.span + G.cfg.runX + M + 20 + seam.extR;
        transInfo.p = clamp01(1 - (seamX() + seam.extR + M + 20) / total);
      } else transInfo.p = clamp01((S0.t - seam.t0) / 1.2);
      sceneInfo.transition = transInfo;
    } else sceneInfo.transition = null;
    let building = false;
    for (const inst of insts) if (inst.gen) building = true;
    sceneInfo.building = building;
  }

  G.onUpdate((dt, realDt) => {
    const rdt = realDt || 0;
    ensure();
    const clock = clockNow();
    sceneInfo.clock = clock;
    sampleLight(clock, tgt);
    if (!lightInit) {
      cur.set(tgt);
      lightInit = true;
    } else {
      const a = 1 - Math.exp(-rdt * 2.2);
      for (let j = 0; j < CH; j++) cur[j] += (tgt[j] - cur[j]) * a;
    }
    const night = tgt[I_NIGHT] > 0.5;
    if (night && !weather.wasNight) rollWeather('night');
    weather.wasNight = night;
    if (!FORCED_WEATHER) {
      const outdoor = !!curInst.def.outdoor;
      const want = weather.kind && (night || outdoor) ? 1 : 0;
      const rate = weather.src === 'outdoor' && outdoor ? 1.6 : 0.6;
      weather.k += (want - weather.k) * Math.min(1, rdt * rate);
      if (!want && weather.k < 0.01) {
        weather.kind = 0;
        weather.storm = false;
      }
    }
    startK += ((G.state.mode === 'start' ? 1 : 0) - startK) * Math.min(1, rdt * 3);
    feverK += ((G.flag('fever') ? 1 : 0) - feverK) * Math.min(1, rdt * 4);
    dentUpdate(rdt);

    const md = reduceMotion ? 0.3 : 1;
    for (let i = 0; i < MOTES; i++) {
      const j = i * 4;
      mote[j + 1] += (mote[j + 2] > Math.PI ? 1 : -1) * (0.01 + (1 - mote[j + 3]) * 0.015) * dt * md;
      if (mote[j + 1] > 1) mote[j + 1] -= 1;
      else if (mote[j + 1] < 0) mote[j + 1] += 1;
    }
    if (weather.kind === 1 && weather.k > 0.01) {
      for (let i = 0; i < RAIN; i++) {
        const j = i * 4;
        rain[j + 1] += rain[j + 2] * dt * md;
        if (rain[j + 1] > 1.15) {
          rain[j + 1] = -0.2 - Math.random() * 0.3;
          rain[j] = Math.random();
        }
      }
    } else if (weather.kind === 2 && weather.k > 0.01) {
      for (let i = 0; i < SNOW; i++) {
        const j = i * 4;
        snow[j + 1] += snow[j + 2] * dt * md;
        if (snow[j + 1] > 1.04) {
          snow[j + 1] = -0.04;
          snow[j] = Math.random();
        }
      }
    }
    sceneInfo.night = cur[I_NIGHT];
    sceneInfo.lamp = cur[I_LAMP];
    sceneInfo.sunset = cur[I_SUNSET];
    sceneInfo.weather = weather.kind === 1 ? 'rain' : weather.kind === 2 ? 'snow' : 'clear';
    sceneInfo.weatherK = weather.k;
    sceneInfo.storm = weather.kind === 1 && weather.storm;

    refreshStale();
    routeUpdate();
    exportFrame();
  }, 4);

  // ---------- слои ----------
  G.onRender(LAYER.BG, (ctx) => {
    ensure();
    prepFrame();
    anchorTick++;
    panes.n = 0;
    lights.n = 0;
    emitters.n = 0;
    computeRegions();
    if (!S.ready) {
      ctx.fillStyle = G.C.wall;
      ctx.fillRect(-M, -M, G.W + M * 2, G.H + M * 2);
      return;
    }
    runHook(ctx, 'bg');
  });
  G.onRender(LAYER.WALL, (ctx) => {
    if (S.ready) runHook(ctx, 'wall');
  });
  G.onRender(LAYER.COUCH, (ctx) => {
    if (S.ready) runHook(ctx, 'back');
  });
  G.onRender(LAYER.SEAT, (ctx) => {
    runHook(ctx, 'ground');
    if (!S.ready) return;
    drawSeamArt(ctx);
    for (let i = 0; i < nReg; i++) tintRegion(ctx, i);
    runHook(ctx, 'emissive');
    drawLeak(ctx);
    seamLight();
  });
  G.onRender(LAYER.BACK - 0.2, drawLids);
  G.onRender(LAYER.FRONT, (ctx) => {
    if (!S.ready) return;
    runHook(ctx, 'front');
    if (G.look && G.look.post) return;
    const W = G.W, H = G.H;
    const s = (G.scale || 1) * (G.dpr || 1);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    const va = Math.min(0.8, (dark ? 0.34 : 0.22) + F.night * 0.18 + startK * 0.2);
    ctx.globalAlpha = va;
    ctx.drawImage(S.vignette.c, -2, -2, W + 4, H + 4);
    if (F.night > 0.01) {
      ctx.globalAlpha = F.night * 0.07;
      ctx.fillStyle = '#121a40';
      ctx.fillRect(0, 0, W, H);
    }
    if (startK > 0.01) {
      ctx.globalAlpha = startK * 0.05;
      ctx.fillStyle = '#ffbe78';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
  });
  G.onRender(LAYER.SCREEN, drawSubtitle);

  // ---------- реестр локаций и набор инструментов ----------
  G.locations = locDefs;
  G.registerLocation = (def) => {
    if (!def || typeof def.id !== 'string' || !def.id || def.id === 'living') {
      G.report('registerLocation', new Error('location def needs a unique id'));
      return;
    }
    locDefs[def.id] = def;
  };
  function lampLightKit(ctx, x, y) {
    ctx.save();
    drawLampLight(ctx, x, y != null ? y : geo.bt);
    ctx.restore();
  }
  function redraw(sp, draw) {
    const x = sp && sp.c && sp.c.getContext('2d');
    if (!x) return sp;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, sp.c.width, sp.c.height);
    x.setTransform(sp.k, 0, 0, sp.k, sp.ox * sp.k, sp.oy * sp.k);
    draw(x, sp);
    return sp;
  }
  const kit = {
    M,
    get K() { return K; },
    get dark() { return dark; },
    get P() { return P; },
    get F() { return F; },
    get a2() { return A2; },
    get emiK() { return emiK; },
    get calm() { return reduceMotion; },
    get clock() { return sceneInfo.clock; },
    get tier() { return tierNow(); },
    S,
    mk, blit, glow, hash, rng, mix, css, parse, hexRGB, smooth, clamp01, mod,
    ph: (hex, k) => P.ph(hex, k),
    haze, softShadow, grain, text, silhouette, circle, rr, ellipse, seg7, redraw,
    ea,
    windowSprite: (o) => windowSprite(o || {}),
    drawSky(ctx, rect, seed) {
      const base = rect.base != null ? rect.base : rect.y + rect.h;
      return drawSkyRect(ctx, rect.x, rect.y, rect.w, rect.h, base, rect.skyTop != null ? rect.skyTop : rect.y, seed | 0);
    },
    drawCity,
    beams(ctx, g, seed) {
      if (F.beamA <= 0.01) return;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      beamsRect(ctx, g.x, g.y, g.w, g.base != null ? g.base : g.y + g.h, seed | 0);
      ctx.restore();
    },
    lampLight: lampLightKit,
    preComp: (rgb, a) => preComp(rgb, a),
    pushPane, pushLight, pushEmitter,
    // Декор поверх слоя локации: fn(ctx, L, kit) после её хука layer ('bg'|'wall'|'back'|'ground'|'emissive'|'front').
    decor(locId, layer, fn) {
      if (typeof locId !== 'string' || typeof layer !== 'string' || typeof fn !== 'function') return;
      const byLoc = decorFns[layer] || (decorFns[layer] = Object.create(null));
      (byLoc[locId] || (byLoc[locId] = [])).push(fn);
    },
    // Именованные точки внутри локаций: первый непустой ответ подписчика заменяет поведение по умолчанию.
    hook(name, fn) {
      if (typeof name !== 'string' || typeof fn !== 'function') return;
      (pointFns[name] || (pointFns[name] = [])).push(fn);
    },
    call: point,
    has: hasPoint,
    anchor: setAnchor,
    free(sp) {
      if (!sp) return;
      freeSprite(sp);
      const own = buildOwner;
      if (own && own.sprites) {
        const i = own.sprites.indexOf(sp);
        if (i >= 0) own.sprites.splice(i, 1);
      }
    },
  };
  G.sceneKit = kit;
})();
