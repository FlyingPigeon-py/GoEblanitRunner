/* Ночные локации: спальня «Сериал сам себя не посмотрит» и сон «Кроличья нора». Владелец — графика B. */
(() => {
  'use strict';
  const G = window.G;
  if (typeof G.registerLocation !== 'function') return;
  const TAU = Math.PI * 2;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const mod = (a, n) => ((a % n) + n) % n;
  const lerp = (a, b, k) => a + (b - a) * k;
  const fin = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const hashN = (n, salt) => {
    let h = Math.imul((n | 0) ^ Math.imul((salt | 0) + 0x632be5ab, 0x27d4eb2d), 0x9e3779b1);
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  };
  const kitNow = () => G.sceneKit || {};
  const toHex = (n) => '#' + n.toString(16).padStart(6, '0');
  function tone(k, hex, mixK) {
    if (k && typeof k.ph === 'function') {
      try { const c = k.ph(hex, mixK); if (typeof c === 'string') return c; } catch (e) {}
    }
    return toHex(hex);
  }
  function blit(ctx, sp, x, y) {
    if (sp && sp.c && sp.c.width > 1) ctx.drawImage(sp.c, x - sp.ox, y - sp.oy, sp.w, sp.h);
  }
  function stretch(ctx, sp, x, y, w, h) {
    if (sp && sp.c && sp.c.width > 1 && w > 0 && h > 0) ctx.drawImage(sp.c, x, y, w, h);
  }
  const pixel = (x, K) => Math.round(x * K) / K;
  function rrect(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function dot(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, Math.max(0, r), 0, TAU);
    c.fill();
  }
  function label(k, c, s, x, y, weight, size, family, color, maxW) {
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    if (typeof k.text === 'function') k.text(c, s, x, y, weight, size, family, color, maxW);
    else {
      G.draw.font(c, weight, size, family);
      c.fillStyle = color;
      c.fillText(s, x, y);
    }
  }
  function softGlow(k, rgb) {
    const S = k.S || {};
    if (rgb === 'warm' && S.glowWarm) return S.glowWarm;
    if (rgb === 'cool' && S.glowCool) return S.glowCool;
    return null;
  }
  function region(L) {
    const M = fin(L.M, 60), W = fin(L.W, G.W);
    return { x0: fin(L.x0, -M), x1: fin(L.x1, W + M), GR: fin(L.GR, G.GROUND), H: fin(L.H, G.H), M, u: fin(L.dist, 0) - fin(L.d0, 0) };
  }
  // Слоты параллакса: x = base + i·slot − u·par; зовёт fn(i, x) для видимых.
  function slots(rg, par, slot, base, pad, fn) {
    const sc = rg.u * par - base;
    const i0 = Math.floor((rg.x0 - pad + sc) / slot), i1 = Math.floor((rg.x1 + pad + sc) / slot);
    for (let i = i0; i <= i1; i++) fn(i, i * slot - sc);
  }

  // ---------- спальня ----------
  const BED = {
    wallPar: 0.2, backPar: 0.45, pilPar: 0.7, frontPar: 1.45,
    winSlot: 760, backSlot: 980, pilSlot: 900, fgSlot: 1100, tile: 240, groundTile: 480,
  };
  const bedLook = { grade: '#4a5cff', gradeA: 0.1 };
  const tv = { r: 140, g: 160, b: 210, fr: 140, fg: 160, fb: 210, tr: 140, tg: 160, tb: 210, k: 0.35, fk: 0.35, tk: 0.35, at: 0, t0: 0, frame: 0 };

  function tvColor(t, out) {
    out[0] = 255 * clamp01(0.55 + 0.2 * Math.cos(TAU * t));
    out[1] = 255 * clamp01(0.6 + 0.2 * Math.cos(TAU * (t + 0.1)));
    out[2] = 255 * clamp01(0.75 + 0.25 * Math.cos(TAU * (t + 0.2)));
    return out;
  }
  const tvTmp = [0, 0, 0];
  function updateTv(L) {
    const t = fin(L.t, G.state.realT);
    if (G.calm) {
      tv.r = 140; tv.g = 153; tv.b = 191; tv.k = 0.35;
      return;
    }
    if (t >= tv.at || t < tv.t0 - 5) {
      tv.frame++;
      tv.fr = tv.r; tv.fg = tv.g; tv.fb = tv.b; tv.fk = tv.k;
      tvColor(hashN(tv.frame, 11), tvTmp);
      tv.tr = tvTmp[0]; tv.tg = tvTmp[1]; tv.tb = tvTmp[2];
      tv.tk = Math.max(0.25, Math.min(0.45, tv.k + (hashN(tv.frame, 12) - 0.5) * 0.4));
      tv.t0 = t;
      tv.at = t + 0.5 + hashN(tv.frame, 13) * 0.5;
    }
    const q = smooth((t - tv.t0) / 0.15);
    tv.r = lerp(tv.fr, tv.tr, q);
    tv.g = lerp(tv.fg, tv.tg, q);
    tv.b = lerp(tv.fb, tv.tb, q);
    tv.k = lerp(tv.fk, tv.tk, q);
  }

  function* buildBedroom(k, R) {
    const GR = G.GROUND, H = G.H, M = 60;
    const mk = k.mk;
    const wall = tone(k, 0xdfe3ee), stripe = tone(k, 0xd3d8e6);
    const wood = tone(k, 0xb58b66), woodDk = tone(k, 0x8d6748), woodLt = tone(k, 0xcfa883);
    R.GR = GR;
    R.wall = mk(BED.tile, GR + M + 4, 0, M, (c) => {
      c.fillStyle = wall;
      c.fillRect(0, -M, BED.tile, GR + M + 4);
      c.fillStyle = stripe;
      for (let x = 6; x < BED.tile; x += 20) c.fillRect(x, -M, 1.6, GR + M + 4);
      c.globalAlpha = 0.5;
      for (let x = 16; x < BED.tile; x += 20) c.fillRect(x, -M, 0.7, GR + M + 4);
      c.globalAlpha = 1;
      c.fillStyle = 'rgba(40,30,60,0.06)';
      c.fillRect(0, GR - 60, BED.tile, 64);
    });
    yield;

    const winTop = Math.max(-26, GR - 290), winSill = Math.max(winTop + 70, GR - 165);
    R.winSill = winSill;
    if (typeof k.windowSprite === 'function') {
      R.win = k.windowSprite({ gw: 112, cols: 2, transom: 0.34, curtain: 0x7f8bb6, top: winTop, sill: winSill, bottom: GR - 20, seed: 57 });
    }
    if (!R.win || !R.win.glass) {
      R.win = mk(160, winSill - winTop + 30, 80, -winTop + 10, (c) => {
        c.fillStyle = tone(k, 0xf4efe6, 0.55);
        c.fillRect(-62, winTop, 124, winSill - winTop);
        c.clearRect(-56, winTop + 6, 112, winSill - winTop - 12);
        c.fillRect(-2, winTop, 4, winSill - winTop);
        c.fillRect(-68, winSill, 136, 6);
      });
      R.win.glass = { x: -56, y: winTop + 6, w: 112, h: winSill - winTop - 12 };
      R.win.skyTop = winTop + 6;
      R.win.base = winSill - 6;
      R.ownWin = true;
    }
    yield;

    const posterW = 74, posterH = 100, posterY = Math.max(posterH / 2 + 4, GR - 250);
    R.posterY = posterY;
    R.poster = mk(posterW + 10, posterH + 14, posterW / 2 + 5, posterH / 2 + 6, (c) => {
      c.fillStyle = 'rgba(30,24,40,0.18)';
      rrect(c, -posterW / 2 + 1.5, -posterH / 2 + 3, posterW, posterH, 2);
      c.fill();
      c.fillStyle = tone(k, 0x2c2a44, 0.3);
      rrect(c, -posterW / 2, -posterH / 2, posterW, posterH, 2);
      c.fill();
      c.fillStyle = tone(k, 0x3d3b63, 0.3);
      c.fillRect(-posterW / 2 + 5, -posterH / 2 + 5, posterW - 10, 46);
      c.fillStyle = tone(k, 0xb7b2e8, 0.3);
      c.beginPath();
      c.moveTo(-7, -posterH / 2 + 18);
      c.lineTo(10, -posterH / 2 + 28);
      c.lineTo(-7, -posterH / 2 + 38);
      c.closePath();
      c.fill();
      c.fillStyle = tone(k, 0xe9e4f0, 0.2);
      c.fillRect(-posterW / 2 + 5, -posterH / 2 + 48, (posterW - 10) * 0.72, 2);
      label(k, c, 'СЕРИАЛ САМ', 0, posterH / 2 - 34, 700, 10, 'display', tone(k, 0xf2eefb, 0.15), posterW - 8);
      label(k, c, 'СЕБЯ НЕ', 0, posterH / 2 - 23, 700, 10, 'display', tone(k, 0xf2eefb, 0.15), posterW - 8);
      label(k, c, 'ПОСМОТРИТ', 0, posterH / 2 - 12, 700, 10, 'display', tone(k, 0xd9b8ff, 0.15), posterW - 8);
      label(k, c, '8 сезонов · 1 вечер', 0, posterH / 2 - 3, 500, 5.5, 'body', tone(k, 0xb7b2e8, 0.2), posterW - 8);
    });
    yield;

    const wardH = Math.min(260, GR + 20), wardW = 104;
    R.wardrobe = mk(wardW + 8, wardH + 4, wardW / 2 + 4, wardH, (c) => {
      c.fillStyle = woodDk;
      rrect(c, -wardW / 2, -wardH, wardW, wardH, 3);
      c.fill();
      c.fillStyle = wood;
      c.fillRect(-wardW / 2 + 4, -wardH + 6, wardW / 2 - 6, wardH - 14);
      c.fillRect(2, -wardH + 6, wardW / 2 - 6, wardH - 14);
      c.fillStyle = woodLt;
      c.fillRect(-wardW / 2 + 4, -wardH + 6, wardW / 2 - 6, 2);
      c.fillRect(2, -wardH + 6, wardW / 2 - 6, 2);
      c.fillStyle = tone(k, 0xc9a24a);
      c.fillRect(-6, -wardH * 0.52, 2, 16);
      c.fillRect(4, -wardH * 0.52, 2, 16);
      c.fillStyle = tone(k, 0x9fa6c2);
      rrect(c, -wardW / 2 + 10, -wardH - 22, 34, 22, 2);
      c.fill();
      c.fillStyle = tone(k, 0xc7b39a);
      rrect(c, -wardW / 2 + 48, -wardH - 15, 40, 15, 2);
      c.fill();
    });
    yield;

    R.chair = mk(84, 150, 42, 140, (c) => {
      c.fillStyle = woodDk;
      c.fillRect(-26, -128, 5, 128);
      c.fillRect(-26, -62, 54, 6);
      c.fillRect(22, -62, 5, 62);
      c.fillRect(-24, -60, 4, 60);
      const pile = [[0x5d6f8f, -30, -70, 62, 14], [0xb07a6a, -28, -82, 52, 14], [0xd8cfa8, -22, -92, 44, 12], [0x8a9a7a, -12, -101, 26, 10], [0x7d6f9a, -34, -124, 14, 56]];
      for (const p of pile) {
        c.fillStyle = tone(k, p[0]);
        rrect(c, p[1], p[2], p[3], p[4], 5);
        c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.fillRect(-26, -82, 46, 1.4);
      c.fillRect(-20, -92, 38, 1.2);
      c.strokeStyle = tone(k, 0x8a9a7a);
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(18, -72);
      c.quadraticCurveTo(28, -60, 24, -44);
      c.stroke();
    });
    yield;

    R.stand = mk(64, 150, 32, 140, (c) => {
      c.fillStyle = woodDk;
      c.fillRect(-24, -64, 48, 64);
      c.fillStyle = wood;
      c.fillRect(-22, -60, 44, 26);
      c.fillRect(-22, -31, 44, 26);
      c.fillStyle = woodLt;
      c.fillRect(-26, -66, 52, 4);
      c.fillStyle = tone(k, 0xc9a24a);
      c.fillRect(-4, -48, 8, 2);
      c.fillRect(-4, -19, 8, 2);
      c.fillStyle = tone(k, 0xb89a5e);
      c.fillRect(-1.5, -100, 3, 36);
      c.fillRect(-9, -68, 18, 3);
      c.fillStyle = tone(k, 0xefe2c8, 0.55);
      c.beginPath();
      c.moveTo(-11, -126);
      c.lineTo(11, -126);
      c.lineTo(18, -100);
      c.lineTo(-18, -100);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(0,0,0,0.08)';
      c.fillRect(-18, -102, 36, 2);
    });
    R.shadeLit = mk(40, 30, 20, 28, (c) => {
      c.fillStyle = '#ffe2a8';
      c.beginPath();
      c.moveTo(-11, -26);
      c.lineTo(11, -26);
      c.lineTo(18, 0);
      c.lineTo(-18, 0);
      c.closePath();
      c.fill();
      c.fillStyle = '#fff6dc';
      c.fillRect(-14, -3, 28, 3);
    });
    yield;

    R.laptop = mk(74, 112, 37, 104, (c) => {
      c.fillStyle = woodDk;
      c.fillRect(-20, -52, 4, 52);
      c.fillRect(16, -52, 4, 52);
      c.fillRect(-2, -52, 4, 52);
      c.fillStyle = wood;
      rrect(c, -26, -58, 52, 7, 2);
      c.fill();
      c.fillStyle = tone(k, 0xc9ccd2);
      rrect(c, -24, -62, 48, 4, 1.5);
      c.fill();
      c.fillStyle = tone(k, 0xb4b8c0);
      c.beginPath();
      c.moveTo(-21, -62);
      c.lineTo(-18, -96);
      c.lineTo(18, -96);
      c.lineTo(21, -62);
      c.closePath();
      c.fill();
      c.fillStyle = tone(k, 0x39465a, 0.3);
      c.beginPath();
      c.moveTo(-18, -65);
      c.lineTo(-15.5, -93);
      c.lineTo(15.5, -93);
      c.lineTo(18, -65);
      c.closePath();
      c.fill();
      c.fillStyle = tone(k, 0xe6e0d0);
      rrect(c, 12, -72, 9, 10, 2);
      c.fill();
    });
    if (typeof k.haze === 'function') k.haze(R.laptop.c.getContext('2d'), R.laptop, 0.25);
    yield;

    const pillow = (c, w, h, col, stripeCol) => {
      c.fillStyle = col;
      rrect(c, -w / 2, -h, w, h, h * 0.45);
      c.fill();
      c.fillStyle = stripeCol;
      for (let x = -w / 2 + 8; x < w / 2 - 4; x += 9) c.fillRect(x, -h + 3, 2, h - 6);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      rrect(c, -w / 2 + 5, -h + 2, w - 10, 3, 1.5);
      c.fill();
    };
    R.pillows = mk(170, 46, 85, 40, (c) => {
      pillow(c, 78, 30, tone(k, 0xf3f0f7, 0.55), tone(k, 0xe2dcec, 0.55));
      c.save();
      c.translate(56, 0);
      pillow(c, 62, 24, tone(k, 0xdcd7ee, 0.55), tone(k, 0xccc5e2, 0.55));
      c.restore();
    });
    R.plush = mk(40, 40, 20, 34, (c) => {
      const fur = tone(k, 0xd8cfc4, 0.5), furDk = tone(k, 0xb9ad9f, 0.5);
      c.fillStyle = furDk;
      c.beginPath();
      c.ellipse(-3, -27, 2.4, 7, -0.25, 0, TAU);
      c.fill();
      c.fillStyle = fur;
      c.beginPath();
      c.ellipse(2, -27, 2.4, 7.5, 0.2, 0, TAU);
      c.fill();
      c.beginPath();
      c.ellipse(0, -9, 9, 8, 0, 0, TAU);
      c.fill();
      c.beginPath();
      c.ellipse(1, -19, 6.5, 5.6, 0, 0, TAU);
      c.fill();
      c.fillStyle = tone(k, 0x4a3f3a, 0.3);
      dot(c, 3.2, -20, 0.9);
      c.fillStyle = tone(k, 0xd9a0a8, 0.4);
      dot(c, 6.6, -18.4, 0.8);
      c.strokeStyle = furDk;
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(-4, -4);
      c.lineTo(-2, -12);
      c.moveTo(5, -12);
      c.lineTo(7, -5);
      c.stroke();
    });
    if (typeof k.haze === 'function') k.haze(R.plush.c.getContext('2d'), R.plush, 0.2);
    yield;

    const blanket = tone(k, 0xe9e4f0), check = tone(k, 0xd9d2e6), top = tone(k, 0xf3f0f8), piping = tone(k, 0xb9b0d2);
    const T = BED.groundTile, depth = H + M - (GR - 12), hem = 36;
    const hemY = (x) => hem + 1.6 * Math.sin((x / T) * TAU * 10) + 0.8 * Math.sin((x / T) * TAU * 23);
    R.ground = mk(T, depth, 0, 12, (c) => {
      c.fillStyle = top;
      c.fillRect(0, -12, T, 13);
      c.strokeStyle = check;
      c.lineWidth = 1;
      c.globalAlpha = 0.55;
      c.beginPath();
      for (let x = 0; x <= T; x += 24) {
        c.moveTo(x + 2, -12);
        c.lineTo(x - 1.5, 0);
      }
      c.stroke();
      c.globalAlpha = 0.45;
      c.setLineDash([2.2, 2.6]);
      c.beginPath();
      c.moveTo(0, -6.5);
      c.lineTo(T, -6.5);
      c.stroke();
      c.setLineDash([]);
      c.globalAlpha = 1;
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(0, -1.6, T, 1.6);

      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(T, 0);
      for (let x = T; x >= 0; x -= 6) c.lineTo(x, hemY(x));
      c.closePath();
      const drape = c.createLinearGradient(0, 0, 0, hem);
      drape.addColorStop(0, blanket);
      drape.addColorStop(1, check);
      c.fillStyle = drape;
      c.fill();
      c.save();
      c.clip();
      c.strokeStyle = piping;
      c.lineWidth = 1;
      c.globalAlpha = 0.4;
      c.beginPath();
      for (let x = 0; x <= T; x += 24) {
        c.moveTo(x - 1.5, 0);
        c.quadraticCurveTo(x + 1, hem * 0.5, x - 0.5, hem + 4);
      }
      for (let y = 12; y < hem; y += 12) {
        c.moveTo(0, y);
        c.lineTo(T, y);
      }
      c.stroke();
      c.globalAlpha = 1;
      for (let i = 0; i < 8; i++) {
        const fx = (i + 0.3 + hashN(i, 5) * 0.4) * (T / 8), fw = 4 + hashN(i, 6) * 5;
        const sh = c.createLinearGradient(fx - fw, 0, fx + fw, 0);
        sh.addColorStop(0, 'rgba(60,40,90,0)');
        sh.addColorStop(0.5, 'rgba(60,40,90,0.13)');
        sh.addColorStop(1, 'rgba(255,255,255,0.12)');
        c.fillStyle = sh;
        c.fillRect(fx - fw, 0, fw * 2, hem + 4);
      }
      c.fillStyle = 'rgba(40,30,60,0.16)';
      c.fillRect(0, 0, T, 2.4);
      c.restore();
      c.strokeStyle = piping;
      c.lineWidth = 2.2;
      c.beginPath();
      for (let x = 0; x <= T; x += 6) {
        if (x) c.lineTo(x, hemY(x) - 0.6);
        else c.moveTo(x, hemY(x) - 0.6);
      }
      c.stroke();

      const baseY = hem + 2;
      c.save();
      c.globalCompositeOperation = 'destination-over';
      c.fillStyle = woodDk;
      c.fillRect(0, baseY, T, depth - baseY - 12);
      c.restore();
      c.fillStyle = 'rgba(0,0,0,0.22)';
      for (let x = 0; x < T; x += 6) c.fillRect(x, hemY(x) + 1, 6, 4);
      c.fillStyle = wood;
      c.fillRect(0, baseY + 10, T, 7);
      c.fillStyle = woodLt;
      c.fillRect(0, baseY + 10, T, 1.2);
    });
    yield;

    R.carpet = mk(236, 156, 118, 78, (c) => {
      const base = tone(k, 0x8f4f45), deep = tone(k, 0x5e3436), ochre = tone(k, 0xd2ae7c), navy = tone(k, 0x3f4a6a), cream = tone(k, 0xeadcc0);
      c.fillStyle = 'rgba(30,20,40,0.2)';
      c.fillRect(-112, -72, 228, 148);
      c.fillStyle = deep;
      c.fillRect(-114, -74, 228, 148);
      c.fillStyle = base;
      c.fillRect(-104, -64, 208, 128);
      c.strokeStyle = ochre;
      c.lineWidth = 2;
      c.strokeRect(-108, -68, 216, 136);
      c.lineWidth = 1;
      c.strokeRect(-98, -58, 196, 116);
      const rhomb = (x, y, rx, ry) => {
        c.beginPath();
        c.moveTo(x, y - ry);
        c.lineTo(x + rx, y);
        c.lineTo(x, y + ry);
        c.lineTo(x - rx, y);
        c.closePath();
      };
      c.fillStyle = navy;
      rhomb(0, 0, 62, 44);
      c.fill();
      c.fillStyle = ochre;
      rhomb(0, 0, 40, 28);
      c.fill();
      c.fillStyle = base;
      rhomb(0, 0, 24, 17);
      c.fill();
      c.fillStyle = cream;
      rhomb(0, 0, 9, 7);
      c.fill();
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          c.fillStyle = navy;
          rhomb(sx * 76, sy * 40, 14, 11);
          c.fill();
          c.fillStyle = ochre;
          rhomb(sx * 76, sy * 40, 6, 5);
          c.fill();
        }
        c.fillStyle = ochre;
        rhomb(sx * 82, 0, 8, 14);
        c.fill();
      }
      c.fillStyle = cream;
      for (let x = -96; x <= 96; x += 12) {
        dot(c, x, -61, 1.3);
        dot(c, x, 61, 1.3);
      }
      c.strokeStyle = cream;
      c.lineWidth = 0.8;
      c.beginPath();
      for (let x = -112; x <= 112; x += 4) {
        c.moveTo(x, 74);
        c.lineTo(x + 0.5, 78);
      }
      c.stroke();
    });
    if (typeof k.haze === 'function') k.haze(R.carpet.c.getContext('2d'), R.carpet, 0.25);
    R.carpetY = Math.max(84, GR - 205);
    yield;

    const sil = '#0b0c12';
    R.fgStand = mk(140, 80, 70, 0, (c) => {
      c.fillStyle = sil;
      rrect(c, -64, 0, 128, 90, 6);
      c.fill();
      c.fillRect(-70, 0, 140, 6);
    });
    R.fgSlippers = mk(110, 40, 55, 0, (c) => {
      c.fillStyle = sil;
      c.beginPath();
      c.ellipse(-24, 14, 26, 10, -0.08, 0, TAU);
      c.fill();
      c.beginPath();
      c.ellipse(26, 17, 25, 9.5, 0.06, 0, TAU);
      c.fill();
      c.beginPath();
      c.ellipse(-30, 6, 9, 6, 0.4, 0, TAU);
      c.fill();
      c.beginPath();
      c.ellipse(34, 10, 7, 5, -0.3, 0, TAU);
      c.fill();
    });
  }

  G.registerLocation({
    id: 'bedroom',
    name: 'ДОМА',
    title: 'сериал сам себя не посмотрит',
    surface: 'fabric',
    outdoor: false,
    look: bedLook,
    build: buildBedroom,
    bg(ctx, L) {
      const R = L.R || {}, k = kitNow(), rg = region(L);
      if (R.wall) {
        const T = BED.tile, K = fin(k.K, 2), sc = rg.u * BED.wallPar;
        for (let x = rg.x0 - mod(sc + rg.x0, T); x < rg.x1; x += T) blit(ctx, R.wall, pixel(x, K), 0);
      } else {
        ctx.fillStyle = tone(k, 0xdfe3ee);
        ctx.fillRect(rg.x0, -rg.M, rg.x1 - rg.x0, rg.GR + rg.M);
      }
      const win = R.win;
      if (!win || !win.glass) return;
      slots(rg, BED.wallPar, BED.winSlot, 330, 140, (i, x) => {
        const g = win.glass, gx = x + g.x;
        if (typeof k.drawSky === 'function') {
          k.drawSky(ctx, { x: gx, y: g.y, w: g.w, h: g.h, base: win.base, skyTop: win.skyTop }, 700 + i);
        } else {
          ctx.fillStyle = typeof k.preComp === 'function' ? k.preComp([26, 34, 72]) : '#1a2248';
          ctx.fillRect(gx, g.y, g.w, g.h);
          ctx.fillStyle = '#f4f1e2';
          dot(ctx, gx + g.w * 0.68, g.y + g.h * 0.3, 7);
        }
        if (k.call) k.call('bedroom.window', ctx, gx, g.y, g.w, g.h, i);
        if (typeof k.pushPane === 'function') {
          const panes = win.panes;
          if (panes && panes.length) for (let p = 0; p < panes.length; p++) k.pushPane(x + panes[p][0], panes[p][1], panes[p][2], panes[p][3], 4096 + i * 8 + p);
          else k.pushPane(gx, g.y, g.w, g.h, 4096 + i * 8);
        }
      });
    },
    wall(ctx, L) {
      const R = L.R || {}, k = kitNow(), rg = region(L);
      if (R.win) {
        slots(rg, BED.wallPar, BED.winSlot, 330, 140, (i, x) => {
          blit(ctx, R.win, x, 0);
          if (k.call && R.winSill) k.call('bedroom.sill', ctx, x, R.winSill, i);
        });
      }
      slots(rg, BED.wallPar, BED.winSlot, 330 + BED.winSlot / 2, 130, (i, x) => {
        if (R.carpet && (i & 1) === 0) blit(ctx, R.carpet, x, R.carpetY);
        else if (R.poster) blit(ctx, R.poster, x, R.posterY);
      });
      const S = k.S || {}, gar = S.garland;
      if (k.call && k.call('bedroom.garland', ctx, rg.u * BED.wallPar, Math.max(10, rg.GR - 300), rg.x0, rg.x1)) return;
      if (gar && gar.c && gar.w > 0) {
        const span = gar.w, sc = rg.u * BED.wallPar, gy = Math.max(10, rg.GR - 300);
        for (let x = rg.x0 - mod(sc + rg.x0, span) - span; x < rg.x1; x += span) blit(ctx, gar, x, gy);
      }
    },
    back(ctx, L) {
      const R = L.R || {}, rg = region(L), GR = rg.GR;
      slots(rg, BED.backPar, BED.backSlot, 520, 120, (i, x) => {
        const h = hashN(i, 41);
        if (R.wardrobe && h < 0.6) blit(ctx, R.wardrobe, x - 300, GR - 6);
        if (R.chair) blit(ctx, R.chair, x - 120, GR - 4);
        if (R.stand) blit(ctx, R.stand, x + 60, GR - 4);
        if (R.laptop) blit(ctx, R.laptop, x + 230, GR - 4);
      });
      slots(rg, BED.pilPar, BED.pilSlot, 760, 120, (i, x) => {
        if (R.pillows) blit(ctx, R.pillows, x, GR - 8);
        if (R.plush && hashN(i, 42) < 0.5) blit(ctx, R.plush, x + 6, GR - 30);
      });
    },
    ground(ctx, L) {
      const R = L.R || {}, k = kitNow(), rg = region(L), K = fin(k.K, 2);
      if (!R.ground) {
        ctx.fillStyle = tone(k, 0xe9e4f0);
        ctx.fillRect(rg.x0, rg.GR - 10, rg.x1 - rg.x0, rg.H - rg.GR + rg.M + 10);
        return;
      }
      const T = BED.groundTile;
      for (let x = rg.x0 - mod(rg.u + rg.x0, T); x < rg.x1; x += T) blit(ctx, R.ground, pixel(x, K), rg.GR);
    },
    emissive(ctx, L) {
      const R = L.R || {}, k = kitNow(), rg = region(L), GR = rg.GR, F = L.F || k.F || {};
      const lamp = clamp01(Math.max(fin(F.lamp, 0), 0.6)), emiK = Math.min(1.6, fin(L.emiK, fin(k.emiK, 1)));
      const warm = softGlow(k, 'warm');
      const push = typeof k.pushLight === 'function';
      slots(rg, BED.backPar, BED.backSlot, 520, 200, (i, x) => {
        const lx = x + 60, ly = GR - 4 - 113;
        if (lx > rg.x0 - 160 && lx < rg.x1 + 160) {
          ctx.globalCompositeOperation = 'screen';
          if (warm) {
            ctx.globalAlpha = Math.min(1, lamp * emiK);
            stretch(ctx, warm, lx - 150, ly - 110, 300, 260);
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.min(1, 0.45 * lamp * emiK);
            stretch(ctx, warm, lx - 60, ly - 40, 120, 100);
            ctx.globalCompositeOperation = 'screen';
          }
          const cone = (k.S || {}).cone;
          if (cone && cone.c) {
            ctx.globalAlpha = Math.min(1, 0.55 * lamp * emiK);
            stretch(ctx, cone, lx - 42, GR - 105, 84, 40);
            ctx.save();
            ctx.translate(lx, GR - 129);
            ctx.scale(1, -1);
            ctx.globalAlpha = Math.min(1, 0.4 * lamp * emiK);
            stretch(ctx, cone, -48, 0, 96, 80);
            ctx.restore();
          }
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = lamp;
          if (R.shadeLit) blit(ctx, R.shadeLit, lx, ly + 13);
          if (push) k.pushLight('glow', lx, ly + 20, 260, 220, 0, 0.7 * lamp, 255, 194, 122);
        }
        const tx = x + 230, ty = GR - 4 - 79;
        if (tx > rg.x0 - 200 && tx < rg.x1 + 200) {
          const col = `rgb(${tv.r | 0},${tv.g | 0},${tv.b | 0})`;
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(tx - 18, ty + 14);
          ctx.lineTo(tx - 15.5, ty - 14);
          ctx.lineTo(tx + 15.5, ty - 14);
          ctx.lineTo(tx + 18, ty + 14);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#f3f1ff';
          ctx.fillRect(tx - 11, ty - 3, 22, 1.2);
          ctx.fillRect(tx - 9, ty + 3, 7, 3);
          ctx.fillRect(tx + 2, ty + 3, 7, 3);
          const cool = softGlow(k, 'cool');
          if (cool) {
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = Math.min(1, tv.k * 0.9 * emiK);
            stretch(ctx, cool, tx - 150, ty - 110, 300, 220);
          }
          if (push) k.pushLight('glow', tx, ty, 300, 220, 0, tv.k, tv.r | 0, tv.g | 0, tv.b | 0);
        }
      });
      const S = k.S || {}, gl = S.garlandLit;
      if (k.call && k.call('bedroom.garlandGlow', ctx, rg.u * BED.wallPar, Math.max(10, GR - 300), rg.x0, rg.x1, Math.min(1, lamp * emiK))) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        return;
      }
      if (gl && gl.c && gl.w > 0) {
        const span = gl.w, sc = rg.u * BED.wallPar, gy = Math.max(10, GR - 300);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, lamp * emiK);
        for (let x = rg.x0 - mod(sc + rg.x0, span) - span; x < rg.x1; x += span) blit(ctx, gl, x, gy);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
    front(ctx, L) {
      const R = L.R || {}, rg = region(L), H = rg.H;
      slots(rg, BED.frontPar, BED.fgSlot, 640, 160, (i, x) => {
        const h = hashN(i, 61);
        if (h < 0.35) return;
        const sp = h < 0.7 ? R.fgStand : R.fgSlippers;
        if (!sp) return;
        ctx.globalAlpha = 0.9;
        blit(ctx, sp, x, Math.max(rg.GR + 22, H - (h < 0.7 ? 18 : 26)));
        ctx.globalAlpha = 1;
      });
    },
    update(dt, L) { updateTv(L); },
  });
  // ---------- сон «Кроличья нора» ----------
  const DREAM = { tile: 480, spiralPar: 0.02, clockPar: 0.3, clockSlot: 640, floatPar: 0.22, floatSlot: 300, starPar: 0.008 };
  const dreamLook = { grade: 'rgb(110,80,170)', gradeA: 0.12 };
  const dreamSky = { grad: null, bucket: -1, top: 0, bot: 0, cols: ['', '', ''] };
  const palTmp = [0, 0, 0], NIGHT_INK = [21, 17, 13];
  function dreamPal(t, out) {
    out[0] = 255 * clamp01(0.35 + 0.25 * Math.cos(TAU * t));
    out[1] = 255 * clamp01(0.25 + 0.2 * Math.cos(TAU * (t + 0.15)));
    out[2] = 255 * clamp01(0.55 + 0.3 * Math.cos(TAU * (t + 0.3)));
    return out;
  }
  const glitchK = (clock) => {
    const m = mod(fin(clock, 0), 1440);
    return m >= 180 && m < 220 ? 1 : 0;
  };
  const dreamPhase = (L) => fin(L.clock, 0) / 360 + (glitchK(L.clock) ? 0.3 : 0);

  function* buildDream(k, R) {
    const GR = G.GROUND, H = G.H, M = 60;
    const mk = k.mk;
    R.spiral = mk(260, 260, 130, 130, (c) => {
      const hole = c.createRadialGradient(0, 0, 0, 0, 0, 120);
      hole.addColorStop(0, 'rgba(18,8,40,0.95)');
      hole.addColorStop(0.25, 'rgba(40,20,80,0.55)');
      hole.addColorStop(1, 'rgba(60,30,110,0)');
      c.fillStyle = hole;
      c.fillRect(-130, -130, 260, 260);
      c.lineCap = 'round';
      for (let arm = 0; arm < 5; arm++) {
        const a0 = (arm / 5) * TAU;
        c.beginPath();
        for (let i = 0; i <= 40; i++) {
          const q = i / 40, r = 10 + q * 112, a = a0 + q * 4.2;
          if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          else c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        c.strokeStyle = arm & 1 ? 'rgba(230,214,255,0.32)' : 'rgba(255,214,246,0.24)';
        c.lineWidth = 2 + arm * 0.5;
        c.stroke();
      }
    });
    yield;

    R.melt = mk(96, 84, 48, 40, (c) => {
      const face = '#efe7ff', rim = '#9b86d6', ink = '#4b3a7a';
      c.beginPath();
      c.moveTo(-34, -6);
      c.bezierCurveTo(-36, -34, 34, -38, 36, -8);
      c.bezierCurveTo(37, 6, 22, 8, 16, 14);
      c.bezierCurveTo(10, 22, 12, 34, 6, 38);
      c.bezierCurveTo(1, 42, -2, 34, -2, 24);
      c.bezierCurveTo(-3, 14, -14, 12, -24, 10);
      c.bezierCurveTo(-32, 8, -33, 2, -34, -6);
      c.closePath();
      c.fillStyle = rim;
      c.fill();
      c.save();
      c.translate(0, -1);
      c.scale(0.86, 0.84);
      c.fillStyle = face;
      c.fill();
      c.restore();
      c.strokeStyle = ink;
      c.lineWidth = 1.2;
      c.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU - Math.PI / 2, sq = Math.sin(a) > 0 ? 1.25 : 1;
        c.moveTo(Math.cos(a) * 21, Math.sin(a) * 15 * sq - 8);
        c.lineTo(Math.cos(a) * 24, Math.sin(a) * 17.5 * sq - 8);
      }
      c.stroke();
      const hand = (ang, len, w) => {
        c.lineWidth = w;
        c.beginPath();
        c.moveTo(0, -8);
        c.lineTo(Math.sin(ang) * len, -8 - Math.cos(ang) * len * 0.75);
        c.stroke();
      };
      hand(((11 + 56 / 60) / 12) * TAU, 11, 2);
      hand((56 / 60) * TAU, 17, 1.4);
      c.fillStyle = ink;
      dot(c, 0, -8, 1.8);
    });
    yield;

    R.sheep = mk(54, 40, 27, 30, (c) => {
      c.fillStyle = '#e9e2ff';
      for (const [x, y, r] of [[-12, -14, 8], [-3, -18, 9], [7, -16, 8.5], [13, -10, 7], [-14, -6, 7], [-2, -8, 9], [8, -6, 8]]) dot(c, x, y, r);
      c.fillStyle = '#5a4a8a';
      c.beginPath();
      c.ellipse(19, -14, 5.5, 4.5, 0.3, 0, TAU);
      c.fill();
      c.fillRect(-10, -2, 2.6, 9);
      c.fillRect(-3, -1, 2.6, 9);
      c.fillRect(5, -1, 2.6, 9);
      c.fillRect(11, -2, 2.6, 9);
    });
    R.moon = mk(34, 34, 17, 17, (c) => {
      c.fillStyle = '#fff3c9';
      dot(c, 0, 0, 12);
      c.globalCompositeOperation = 'destination-out';
      dot(c, 6, -4, 10.5);
    });
    R.zzz = mk(46, 40, 23, 20, (c) => {
      label(k, c, 'z', -12, 12, 700, 12, 'display', '#f2e9ff');
      label(k, c, 'z', 0, 4, 700, 16, 'display', '#f2e9ff');
      label(k, c, 'Z', 14, -6, 700, 21, 'display', '#f2e9ff');
    });
    yield;

    const T = DREAM.tile, depth = H + M - (GR - 6);
    R.ground = mk(T, depth, 0, 6, (c) => {
      const body = c.createLinearGradient(0, -4, 0, Math.min(depth - 6, 70));
      body.addColorStop(0, tone(k, 0xd6ccf6, 0.5));
      body.addColorStop(0.35, tone(k, 0xc9bdf0, 0.5));
      body.addColorStop(1, tone(k, 0x9f8fe0, 0.5));
      c.fillStyle = body;
      const r = (seed) => hashN(seed, 77);
      c.beginPath();
      for (let i = 0; i < 34; i++) {
        const x = (i + r(i) * 0.6) * (T / 34), rad = 12 + r(i + 50) * 6, y = rad - 4 + r(i + 90) * 2;
        for (const dx of [-T, 0, T]) {
          c.moveTo(x + dx + rad, y);
          c.arc(x + dx, y, rad, 0, TAU);
        }
      }
      c.rect(0, 10, T, depth);
      c.fill();
      c.fillStyle = k.dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.35)';
      c.beginPath();
      for (let i = 0; i < 34; i++) {
        const x = (i + r(i) * 0.6) * (T / 34), rad = 12 + r(i + 50) * 6, y = rad - 4 + r(i + 90) * 2;
        for (const dx of [-T, 0, T]) {
          c.moveTo(x + dx + rad * 0.55, y - rad * 0.45);
          c.ellipse(x + dx - rad * 0.1, y - rad * 0.45, rad * 0.62, rad * 0.32, 0, 0, TAU);
        }
      }
      c.fill();
      c.fillStyle = 'rgba(90,70,170,0.16)';
      c.beginPath();
      for (let i = 0; i < 22; i++) {
        const x = (i + r(i + 200) * 0.7) * (T / 22), rad = 14 + r(i + 230) * 8, y = 26 + rad * 0.4 + r(i + 260) * 10;
        for (const dx of [-T, 0, T]) {
          c.moveTo(x + dx + rad, y);
          c.arc(x + dx, y, rad, Math.PI, TAU);
        }
      }
      c.fill();
      c.fillStyle = '#fff6c9';
      for (let i = 0; i < 18; i++) {
        const x = r(i + 300) * T, y = 6 + r(i + 330) * 34, s = 1 + r(i + 360) * 1.6;
        c.globalAlpha = 0.5 + r(i + 390) * 0.5;
        c.beginPath();
        c.moveTo(x, y - s * 2);
        c.lineTo(x + s * 0.5, y - s * 0.5);
        c.lineTo(x + s * 2, y);
        c.lineTo(x + s * 0.5, y + s * 0.5);
        c.lineTo(x, y + s * 2);
        c.lineTo(x - s * 0.5, y + s * 0.5);
        c.lineTo(x - s * 2, y);
        c.lineTo(x - s * 0.5, y - s * 0.5);
        c.closePath();
        c.fill();
      }
      c.globalAlpha = 1;
    });
    if (typeof k.silhouette === 'function') {
      R.groundC = k.silhouette(R.ground, '#40e0ff');
      R.groundM = k.silhouette(R.ground, '#ff40d0');
    }
  }

  function dreamSkyGrad(ctx, L, top, bot) {
    const bucket = Math.floor(fin(L.t, 0) * 4);
    const ph = dreamPhase(L);
    const dk = !!kitNow().dark;
    if (dreamSky.grad && dreamSky.bucket === bucket && dreamSky.top === top && dreamSky.bot === bot && dreamSky.dark === dk) return dreamSky.grad;
    const k = kitNow();
    const pc = (c) => {
      if (dk) for (let i = 0; i < 3; i++) c[i] = c[i] * 0.7 + NIGHT_INK[i] * 0.3;
      return typeof k.preComp === 'function' ? k.preComp(c) : `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    };
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, pc(dreamPal(ph, palTmp)));
    g.addColorStop(0.55, pc(dreamPal(ph + 0.12, palTmp)));
    g.addColorStop(1, pc(dreamPal(ph + 0.25, palTmp)));
    dreamSky.grad = g;
    dreamSky.bucket = bucket;
    dreamSky.top = top;
    dreamSky.bot = bot;
    dreamSky.dark = dk;
    return g;
  }

  G.registerLocation({
    id: 'dream',
    name: 'СОН',
    title: 'кроличья нора',
    surface: 'cloud',
    outdoor: false,
    look: dreamLook,
    build: buildDream,
    amb(L, rgb) {
      const base = [216, 204, 245];
      for (let i = 0; i < 3; i++) rgb[i] = L && L.dark ? base[i] + (255 - base[i]) * 0.45 : base[i];
    },
    bg(ctx, L) {
      const R = L.R || {}, k = kitNow(), rg = region(L), t = fin(L.t, 0);
      const top = -rg.M, bot = rg.GR + 4;
      ctx.fillStyle = dreamSkyGrad(ctx, L, top, bot);
      ctx.fillRect(rg.x0, top, rg.x1 - rg.x0, bot - top);
      if (typeof k.pushPane === 'function') k.pushPane(rg.x0, top, rg.x1 - rg.x0, rg.GR - 6 - top, 9001);
      const stars = (k.S || {}).stars;
      if (stars && stars.c && stars.w > 0) {
        const off = mod(rg.u * DREAM.starPar, stars.w);
        ctx.globalAlpha = 0.8;
        for (let y = top; y < rg.GR - 20; y += stars.h) {
          for (let x = rg.x0 - mod(rg.x0 + off, stars.w); x < rg.x1; x += stars.w) blit(ctx, stars, x, y);
        }
        ctx.globalAlpha = 1;
      }
      if (R.spiral) {
        const cx = fin(L.W, G.W) * 0.68 - rg.u * DREAM.spiralPar, cy = Math.max(110, rg.GR - 190);
        if (cx > rg.x0 - 140 && cx < rg.x1 + 140) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(G.calm ? 0.4 : t * 0.05);
          ctx.globalAlpha = 0.85;
          blit(ctx, R.spiral, 0, 0);
          ctx.restore();
        }
      }
    },
    wall(ctx, L) {
      const R = L.R || {}, rg = region(L), t = fin(L.t, 0), GR = rg.GR;
      if (R.melt) {
        slots(rg, DREAM.clockPar, DREAM.clockSlot, 380, 60, (i, x) => {
          if (hashN(i, 71) < 0.3) return;
          const y = Math.min(GR - 150 - 48, 60 + hashN(i, 72) * 50) + (G.calm ? 0 : Math.sin(t * 0.6 + i) * 3);
          ctx.save();
          ctx.globalAlpha = 0.45;
          ctx.translate(x, y);
          ctx.rotate((hashN(i, 73) - 0.5) * 0.5);
          blit(ctx, R.melt, 0, 0);
          ctx.restore();
        });
      }
      const items = [R.sheep, R.moon, R.zzz];
      const span = Math.max(200, GR - 20), speed = G.calm ? 4 : 12;
      slots(rg, DREAM.floatPar, DREAM.floatSlot, 140, 40, (i, x) => {
        const sp = items[Math.floor(hashN(i, 81) * 3) % 3];
        if (!sp) return;
        const y = GR - 30 - mod(t * speed + hashN(i, 82) * span, span);
        const fade = Math.min(1, (GR - 30 - y) / 40, (y + 10) / 60);
        if (fade <= 0) return;
        ctx.globalAlpha = 0.35 * fade;
        blit(ctx, sp, x + Math.sin(t * 0.7 + i * 1.7) * 6, y);
      });
      ctx.globalAlpha = 1;
    },
    ground(ctx, L) {
      const R = L.R || {}, k = kitNow(), rg = region(L), K = fin(k.K, 2), T = DREAM.tile;
      if (!R.ground) {
        ctx.fillStyle = tone(k, 0xc9bdf0, 0.5);
        ctx.fillRect(rg.x0, rg.GR - 4, rg.x1 - rg.x0, rg.H - rg.GR + rg.M + 4);
        return;
      }
      const x0 = rg.x0 - mod(rg.u + rg.x0, T);
      for (let x = x0; x < rg.x1; x += T) blit(ctx, R.ground, pixel(x, K), rg.GR);
      if (glitchK(L.clock) && !G.calm && R.groundC && R.groundM) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25;
        const j = Math.sin(fin(L.t, 0) * 23) > 0 ? 1.5 : -1.5;
        for (let x = x0; x < rg.x1; x += T) {
          blit(ctx, R.groundC, x + j, rg.GR);
          blit(ctx, R.groundM, x - j, rg.GR);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
    },
    update(dt, L) {
      dreamPal(dreamPhase(L) + 0.12, palTmp);
      dreamLook.grade = `rgb(${palTmp[0] | 0},${palTmp[1] | 0},${palTmp[2] | 0})`;
    },
  });
})();
