/* Дневные локации: кухня, опенспейс, переговорка «Байкал». Владелец — графика A. */
(() => {
  'use strict';
  const G = window.G;
  if (typeof G.registerLocation !== 'function') return;
  const TAU = Math.PI * 2;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const kitOf = () => G.sceneKit;
  const runX = () => (G.cfg && G.cfg.runX) || 96;

  function each(L, par, span, pad, fn) {
    const off = L.u * par - runX();
    const i0 = Math.floor((L.x0 - pad + off) / span), i1 = Math.floor((L.x1 + pad + off) / span);
    for (let i = i0; i <= i1; i++) fn(i, i * span - off);
  }
  const snap = (x, K) => Math.round(x * K) / K;
  function tile(ctx, sp, x, y) {
    ctx.drawImage(sp.c, x - sp.ox, y - sp.oy, sp.w + 0.75, sp.h);
  }
  function hazeTo(c, sp, col, a) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    c.globalAlpha = a;
    c.fillStyle = col;
    c.fillRect(0, 0, sp.c.width, sp.c.height);
    c.restore();
  }
  function cell(ctx, sp, i, cw, x, y) {
    const k = sp.k;
    ctx.drawImage(sp.c, i * cw * k, 0, cw * k, sp.c.height, x - cw / 2, y - sp.oy, cw, sp.h);
  }
  function label(k, c, s, x, y, weight, size, family, color, maxW) {
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    k.text(c, s, x, y, weight, size, family, color, maxW);
  }
  function fgAlpha(k) {
    return Math.min(0.85, (k.dark ? 0.35 : 0.18) + k.F.night * 0.45);
  }
  function rect(c, x, y, w, h, col) {
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  }
  function rrFill(k, c, x, y, w, h, r, col) {
    c.fillStyle = col;
    k.rr(c, x, y, w, h, r);
    c.fill();
  }

  // ================= КУХНЯ «Кофе-брейк затянулся» =================
  const KT = { wallPar: 0.3, slot: 240, backPar: 0.6, backSlot: 170, tile: 480, fgPar: 1.45, fgSlot: 1100 };
  const KC = {
    wall: 0xe9efe4, tile: 0xf3f0e8, grout: 0xd6cfc2, sage: 0x8fae94, sageDk: 0x6f8f78, oak: 0xd4a067, lip: 0xe6b97f, edge: 0xc8955a,
    brass: 0xc9a24a, fridge: 0xf4f4f0, kettle: 0x3f8fb0, steel: 0xc9ced3, steelDk: 0x8e959c,
  };
  const MAGNETS = [0xb5654a, 0xc9a24a, 0x8fae94, 0x5b7fa6, 0x8a77b5, 0x3f9a8c];

  function kitchenWall(k, c, GR, M) {
    const r = k.rng(71);
    rect(c, 0, -M, 240, GR + M + 4, k.ph(KC.wall));
    c.globalAlpha = k.dark ? 0.025 : 0.035;
    for (let i = 0; i < 260; i++) rect(c, r() * 240, -M + r() * (GR + M), 0.8, 0.8, r() < 0.5 ? '#ffffff' : '#000000');
    c.globalAlpha = 1;
    const bTop = GR - 140;
    rect(c, 0, bTop, 240, 144, k.ph(KC.tile));
    c.save();
    c.beginPath();
    c.rect(0, bTop, 240, 144);
    c.clip();
    for (let row = 0; row < 15; row++) {
      const y = bTop + row * 10, sh = row % 2 ? 10 : 0;
      for (let x = -sh; x < 240; x += 20) {
        c.fillStyle = `rgba(255,255,255,${(0.1 + r() * 0.12).toFixed(3)})`;
        c.fillRect(x + 0.8, y + 0.8, 18.4, 1.1);
        c.fillStyle = 'rgba(255,255,255,0.08)';
        c.fillRect(x + 0.8, y + 0.8, 1, 8.4);
        c.fillStyle = 'rgba(0,0,0,0.045)';
        c.fillRect(x + 0.8, y + 8, 18.4, 1.2);
      }
    }
    c.fillStyle = k.ph(KC.grout);
    for (let row = 0; row <= 15; row++) c.fillRect(0, bTop + row * 10 - 0.3, 240, 0.6);
    for (let row = 0; row < 15; row++) {
      const y = bTop + row * 10, sh = row % 2 ? 10 : 0;
      for (let x = -sh; x <= 240; x += 20) c.fillRect(x - 0.3, y, 0.6, 10);
    }
    c.restore();
    rect(c, 0, bTop - 3, 240, 3, k.ph(0xe4ddd0));
    rect(c, 0, bTop - 3, 240, 0.8, 'rgba(255,255,255,0.5)');
    const g = c.createLinearGradient(0, GR - 22, 0, GR + 4);
    g.addColorStop(0, 'rgba(60,40,20,0)');
    g.addColorStop(1, `rgba(60,40,20,${k.dark ? 0.3 : 0.16})`);
    c.fillStyle = g;
    c.fillRect(0, GR - 22, 240, 26);
    const top = c.createLinearGradient(0, -M, 0, Math.min(GR - 160, 40));
    top.addColorStop(0, `rgba(40,50,40,${k.dark ? 0.3 : 0.12})`);
    top.addColorStop(1, 'rgba(40,50,40,0)');
    c.fillStyle = top;
    c.fillRect(0, -M, 240, Math.min(GR - 160, 40) + M);
  }
  function kitchenCabinet(k, c) {
    const sage = k.ph(KC.sage), dk = k.ph(KC.sageDk);
    rect(c, -112, -88, 224, 5, k.ph(0xf1ece2));
    rect(c, -112, -88, 224, 1, 'rgba(255,255,255,0.5)');
    rect(c, -108, -83, 216, 83, sage);
    for (const x0 of [-107, 1]) {
      rect(c, x0, -82, 106, 81, sage);
      rect(c, x0 + 8, -74, 90, 65, dk);
      rect(c, x0 + 9, -73, 88, 63, sage);
      rect(c, x0 + 8, -74, 90, 1.2, 'rgba(0,0,0,0.16)');
      rect(c, x0 + 8, -74, 1.2, 65, 'rgba(0,0,0,0.12)');
      rect(c, x0 + 8, -10.4, 90, 1, 'rgba(255,255,255,0.28)');
      rect(c, x0 + 96.8, -74, 1, 65, 'rgba(255,255,255,0.2)');
    }
    rect(c, -1, -82, 2, 81, dk);
    c.fillStyle = k.ph(KC.brass);
    k.rr(c, -9, -26, 2.4, 16, 1.2);
    c.fill();
    k.rr(c, 6.6, -26, 2.4, 16, 1.2);
    c.fill();
    rect(c, -108, 0, 216, 3, k.ph(0xe7e1d4));
    rect(c, -108, 2.4, 216, 0.8, 'rgba(0,0,0,0.25)');
    const g = c.createLinearGradient(0, 3, 0, 16);
    g.addColorStop(0, 'rgba(30,40,30,0.2)');
    g.addColorStop(1, 'rgba(30,40,30,0)');
    c.fillStyle = g;
    c.fillRect(-108, 3, 216, 13);
    c.save();
    c.translate(-58, -50);
    c.rotate(-0.06);
    rect(c, -10, -7, 20, 14, k.ph(0xfbf8f0, 0.4));
    rect(c, -4, -8.5, 8, 2.4, 'rgba(255,255,255,0.55)');
    label(k, c, 'Кто взял', 0, -2.4, 600, 3.1, 'body', k.dark ? '#d8cfbf' : '#3a3026', 18);
    label(k, c, 'мою кружку?', 0, 2.4, 600, 3.1, 'body', k.dark ? '#d8cfbf' : '#3a3026', 18);
    c.restore();
  }
  function kitchenShelf(k, c) {
    const ink = k.dark ? '#d8cfbf' : '#3a3026';
    const jar = (x, w, h, fillCol, dots, l1, l2) => {
      c.fillStyle = 'rgba(255,255,255,0.35)';
      k.rr(c, x - w / 2, -h, w, h, 2.5);
      c.fill();
      c.fillStyle = k.ph(fillCol);
      k.rr(c, x - w / 2 + 1.2, -h * 0.72, w - 2.4, h * 0.72 - 1.2, 1.6);
      c.fill();
      const r = k.rng(x * 7 + 3);
      c.fillStyle = 'rgba(0,0,0,0.22)';
      for (let i = 0; i < dots; i++) k.circle(c, x - w / 2 + 2 + r() * (w - 4), -2 - r() * (h * 0.68 - 3), 0.5 + r() * 0.5);
      c.strokeStyle = 'rgba(80,90,90,0.45)';
      c.lineWidth = 0.6;
      k.rr(c, x - w / 2, -h, w, h, 2.5);
      c.stroke();
      rect(c, x - w / 2 - 0.5, -h - 3, w + 1, 3.4, k.ph(KC.oak));
      rect(c, x - w / 2 + 1.5, -h + 2, 1.2, h - 5, 'rgba(255,255,255,0.4)');
      rect(c, x - w / 2 + 2, -h * 0.5 - 4, w - 4, l2 ? 9 : 6.5, k.ph(0xfbf6ec, 0.4));
      label(k, c, l1, x, -h * 0.5 - (l2 ? 1.2 : -0.6), 600, 3.2, 'body', ink, w - 5);
      if (l2) label(k, c, l2, x, -h * 0.5 + 2.8, 700, 2.9, 'display', k.ph(0x7a3b2a, 0.3), w - 5);
    };
    jar(-46, 17, 22, 0x8a5a3a, 30, 'гречка');
    jar(-14, 17, 25, 0xe2c071, 16, 'макароны');
    jar(26, 30, 24, 0xd9a86a, 10, 'печеньки', 'НЕ ТРОГАТЬ');
    rect(c, -76, 0, 152, 5, k.ph(KC.oak));
    rect(c, -76, 0, 152, 1, 'rgba(255,255,255,0.4)');
    rect(c, -76, 4.2, 152, 0.8, 'rgba(0,0,0,0.2)');
    c.fillStyle = k.ph(KC.brass);
    for (const x of [-56, 56]) {
      c.beginPath();
      c.moveTo(x - 1.2, 5);
      c.lineTo(x + 1.2, 5);
      c.lineTo(x + 1.2, 14);
      c.lineTo(x - 7, 6.5);
      c.closePath();
      c.fill();
    }
  }
  function kitchenClockFace(k, c, sp) {
    c.save();
    k.softShadow(c, sp, 3, 1.5, 0.25);
    c.fillStyle = k.ph(0x5b6e62);
    k.circle(c, 0, 0, 14);
    c.restore();
    c.fillStyle = k.ph(0xfbf8f0, 0.35);
    k.circle(c, 0, 0, 12);
    c.fillStyle = k.dark ? '#cfc6b6' : '#4a4038';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, r1 = i % 3 ? 10.4 : 9.4;
      c.save();
      c.rotate(a);
      c.fillRect(-0.35, -11.2, 0.7, 11.2 - r1);
      c.restore();
    }
    hazeTo(c, sp, k.ph(KC.wall), 0.25);
  }
  function kitchenHands(k, c, clock) {
    const h = ((clock / 60) % 12) / 12, m = (clock % 60) / 60;
    c.strokeStyle = k.dark ? '#d8cfbf' : '#3d342c';
    c.lineCap = 'round';
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.sin(h * TAU) * 6, -Math.cos(h * TAU) * 6);
    c.stroke();
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.sin(m * TAU) * 9, -Math.cos(m * TAU) * 9);
    c.stroke();
    c.fillStyle = k.ph(KC.brass);
    k.circle(c, 0, 0, 1);
  }
  function kitchenFridge(k, c, sp) {
    const body = k.ph(KC.fridge, 0.5), ink = '#2b2219';
    c.save();
    k.softShadow(c, sp, 6, 2, 0.22);
    rrFill(k, c, -36, -214, 72, 214, 4, body);
    c.restore();
    rect(c, 28, -214, 8, 214, 'rgba(0,0,0,0.05)');
    rect(c, -34, -210, 1.2, 206, 'rgba(255,255,255,0.22)');
    rect(c, -36, -150, 72, 1.2, 'rgba(0,0,0,0.18)');
    c.fillStyle = k.ph(0xb9c0c8, 0.4);
    k.rr(c, 26, -142, 3, 34, 1.5);
    c.fill();
    k.rr(c, 26, -204, 3, 24, 1.5);
    c.fill();
    const mag = [[-24, -196, 0], [-6, -188, 1], [14, -200, 2], [-20, -132, 3], [8, -126, 4], [18, -92, 5]];
    for (const [x, y, i] of mag) {
      c.fillStyle = k.ph(MAGNETS[i], 0.3);
      if (i % 2) k.circle(c, x, y, 2.8);
      else {
        k.rr(c, x - 3, y - 2.4, 6, 4.8, 1.2);
        c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,0.4)';
      k.circle(c, x - 0.8, y - 0.9, 0.7);
    }
    c.save();
    c.translate(-6, -110);
    c.rotate(-0.05);
    c.save();
    k.softShadow(c, sp, 2, 1, 0.2);
    rect(c, -16, -12, 32, 24, k.ph(0xfff6d8, 0.3));
    c.restore();
    label(k, c, 'ЕБЛАНИТЬ', 0, -4, 700, 6.4, 'display', ink, 28);
    label(k, c, 'В 11:56', 0, 4.5, 700, 7.2, 'display', k.ph(0x7a3b2a, 0.2), 28);
    c.fillStyle = k.ph(MAGNETS[3], 0.3);
    k.circle(c, 0, -12, 2.6);
    c.restore();
    c.save();
    c.translate(8, -168);
    c.rotate(0.04);
    rect(c, -14, -9, 28, 18, k.ph(0xfbfaf6, 0.35));
    label(k, c, 'Помой за собой.', 0, -3, 600, 3.4, 'body', ink, 25);
    label(k, c, 'Это и тебя касается', 0, 2.6, 500, 2.9, 'body', ink, 25);
    c.fillStyle = k.ph(MAGNETS[0], 0.3);
    k.circle(c, -11, -9, 2.2);
    c.restore();
    hazeTo(c, sp, k.ph(KC.wall), 0.12);
  }
  function kitchenMicro(k, c, sp) {
    c.save();
    k.softShadow(c, sp, 3, 1.5, 0.2);
    rrFill(k, c, -30, -32, 60, 32, 2.5, k.ph(0xe5e5e1, 0.45));
    c.restore();
    rrFill(k, c, -27, -29, 37, 25, 1.6, '#2b3036');
    c.fillStyle = 'rgba(255,255,255,0.1)';
    c.beginPath();
    c.moveTo(-20, -29);
    c.lineTo(-12, -29);
    c.lineTo(-22, -4);
    c.lineTo(-27, -4);
    c.lineTo(-27, -12);
    c.closePath();
    c.fill();
    rrFill(k, c, 12.5, -29, 16, 8, 1, '#10161a');
    c.fillStyle = k.ph(0xb0b4b8, 0.4);
    for (let i = 0; i < 6; i++) k.circle(c, 16 + (i % 3) * 4.5, -15 + Math.floor(i / 3) * 5, 1.2);
    rect(c, -30, -1, 60, 1, 'rgba(0,0,0,0.2)');
    hazeTo(c, sp, k.ph(KC.wall), 0.1);
  }
  function kitchenKettle(k, c, sp) {
    const blue = k.ph(KC.kettle, 0.35);
    rect(c, -12, -3, 24, 3, k.ph(0x3a3f45, 0.3));
    c.fillStyle = blue;
    c.beginPath();
    c.moveTo(-11, -3);
    c.lineTo(-8, -25);
    c.lineTo(8, -25);
    c.lineTo(11, -3);
    c.closePath();
    c.fill();
    c.strokeStyle = k.ph(0x2a3036, 0.3);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(8, -21);
    c.quadraticCurveTo(17, -20, 11, -6);
    c.stroke();
    c.fillStyle = blue;
    c.beginPath();
    c.moveTo(-9, -17);
    c.lineTo(-17, -24);
    c.lineTo(-16, -21);
    c.lineTo(-9.5, -11);
    c.closePath();
    c.fill();
    rect(c, -8.5, -27, 17, 2.4, k.ph(0x2a3036, 0.3));
    k.circle(c, 0, -28.5, 1.8);
    rect(c, -6, -23, 2, 18, 'rgba(255,255,255,0.3)');
    hazeTo(c, sp, k.ph(KC.wall), 0.12);
  }
  function kitchenToastBread(k, c, sp) {
    c.save();
    k.softShadow(c, sp, 3, 1.5, 0.2);
    rrFill(k, c, -40, -18, 28, 18, 4, k.ph(KC.steel, 0.4));
    c.restore();
    rect(c, -36, -18, 8, 1.4, 'rgba(0,0,0,0.35)');
    rect(c, -24, -18, 8, 1.4, 'rgba(0,0,0,0.35)');
    rect(c, -38, -14, 2, 12, 'rgba(255,255,255,0.4)');
    rect(c, -12.5, -10, 3, 2, k.ph(0x3a3f45, 0.3));
    c.fillStyle = k.ph(0xb07a4a);
    c.beginPath();
    c.moveTo(-4, 0);
    c.lineTo(-4, -16);
    c.quadraticCurveTo(-4, -27, 18, -27);
    c.quadraticCurveTo(40, -27, 40, -16);
    c.lineTo(40, 0);
    c.closePath();
    c.fill();
    rect(c, -4, -9, 44, 1, 'rgba(0,0,0,0.18)');
    c.fillStyle = k.ph(KC.brass);
    k.circle(c, 18, -12, 1.6);
    label(k, c, 'ХЛЕБ', 18, -18.5, 700, 4.2, 'display', k.ph(0xf3e2c4, 0.3));
    hazeTo(c, sp, k.ph(KC.wall), 0.12);
  }
  function kitchenRail(k, c, sp) {
    const steel = k.ph(0x7d858d, 0.3);
    rect(c, -60, -107, 120, 2.2, k.ph(KC.brass));
    k.circle(c, -61, -106, 2);
    k.circle(c, 61, -106, 2);
    c.strokeStyle = steel;
    c.fillStyle = steel;
    c.lineWidth = 1.4;
    const hook = (x) => {
      c.beginPath();
      c.moveTo(x, -105);
      c.quadraticCurveTo(x + 3, -101, x, -98);
      c.stroke();
    };
    hook(-36);
    c.beginPath();
    c.moveTo(-36, -98);
    c.lineTo(-36, -70);
    c.stroke();
    c.beginPath();
    c.ellipse(-36, -66, 6, 4.5, 0, 0, Math.PI);
    c.fill();
    hook(-6);
    c.beginPath();
    c.moveTo(-6, -98);
    c.lineTo(-6, -76);
    c.stroke();
    k.rr(c, -10, -76, 8, 12, 1.5);
    c.fill();
    hook(24);
    c.beginPath();
    c.moveTo(24, -98);
    c.lineTo(24, -84);
    c.stroke();
    c.lineWidth = 0.7;
    for (const s of [-1, -0.4, 0.4, 1]) {
      c.beginPath();
      c.moveTo(24, -84);
      c.quadraticCurveTo(24 + s * 6, -74, 24, -66);
      c.stroke();
    }
    hazeTo(c, sp, k.ph(KC.wall), 0.08);
  }
  function kitchenHerbs(k, c, sp) {
    rrFill(k, c, -7, -12, 14, 12, 2, k.ph(0xb9785a));
    rect(c, -8, -13, 16, 2.5, k.ph(0xa86a4e));
    const r = k.rng(19);
    for (let i = 0; i < 11; i++) {
      c.fillStyle = k.ph(i % 2 ? 0x5e8f4a : 0x76a85a);
      const a = -Math.PI / 2 + (r() - 0.5) * 1.8;
      const d = 6 + r() * 10;
      k.ellipse(c, Math.cos(a) * d * 0.7, -14 + Math.sin(a) * d, 2.6, 4, a + Math.PI / 2);
    }
    hazeTo(c, sp, k.ph(KC.wall), 0.12);
  }
  function kitchenGround(k, c, v, M) {
    const W = KT.tile, r = k.rng(201 + v);
    rect(c, 0, -10, W, 10, k.ph(KC.oak));
    c.globalAlpha = 0.18;
    c.strokeStyle = k.ph(0x9a6a3c);
    c.lineWidth = 0.5;
    c.beginPath();
    for (let i = 0; i < 14; i++) {
      const y = -9 + r() * 6, x = r() * W;
      c.moveTo(x, y);
      c.lineTo(x + 30 + r() * 80, y + (r() - 0.5) * 0.8);
    }
    c.stroke();
    c.globalAlpha = 1;
    rect(c, 0, -10, W, 1.6, 'rgba(60,35,15,0.18)');
    if (v === 1) {
      rrFill(k, c, 200, -9, 84, 6.6, 3, k.ph(KC.steel, 0.4));
      rrFill(k, c, 204, -8, 76, 4.6, 2.3, k.ph(KC.steelDk, 0.35));
      rect(c, 204, -8, 76, 1, 'rgba(0,0,0,0.25)');
      c.fillStyle = k.ph(0x5c636a, 0.3);
      k.ellipse(c, 242, -5.4, 2.4, 0.9);
    } else if (v === 2) {
      rrFill(k, c, 150, -9.6, 104, 8.2, 2, '#1d1f22');
      c.strokeStyle = '#4a4e55';
      c.lineWidth = 0.9;
      for (const [x, y, rx] of [[172, -7.2, 10], [200, -7.2, 7], [226, -4.6, 9], [178, -3.4, 7]]) {
        c.beginPath();
        c.ellipse(x, y, rx, rx * 0.17, 0, 0, TAU);
        c.stroke();
      }
      rect(c, 150, -9.6, 104, 0.8, 'rgba(255,255,255,0.12)');
    } else {
      rrFill(k, c, 300, -8.4, 64, 5.6, 1.6, k.ph(0xe2c08a));
      rect(c, 300, -8.4, 64, 0.8, 'rgba(255,255,255,0.4)');
      c.fillStyle = k.ph(0xc79c62);
      k.circle(c, 360, -5.6, 1.2);
    }
    rect(c, 0, -3, W, 3, k.ph(KC.lip));
    rect(c, 0, -3, W, 0.7, 'rgba(255,255,255,0.45)');
    rect(c, 0, 0, W, 9, k.ph(KC.edge));
    k.grain(c, 0, 0, W, 9, r, k.ph(0x8a5a2c));
    rect(c, 0, 8.4, W, 0.8, 'rgba(0,0,0,0.25)');
    const sage = k.ph(KC.sage), dk = k.ph(KC.sageDk);
    rect(c, 0, 9, W, 35, sage);
    for (let x = 0; x < W; x += 60) {
      rect(c, x + 5, 13, 50, 27, dk);
      rect(c, x + 6, 14, 48, 25, sage);
      rect(c, x + 5, 13, 50, 1, 'rgba(0,0,0,0.12)');
      rect(c, x + 5, 39.2, 50, 0.8, 'rgba(255,255,255,0.22)');
      rect(c, x - 0.6, 9, 1.2, 35, dk);
      c.fillStyle = k.ph(KC.brass);
      k.rr(c, x + 24, 16.5, 12, 2, 1);
      c.fill();
    }
    const g = c.createLinearGradient(0, 9, 0, 15);
    g.addColorStop(0, 'rgba(30,25,15,0.28)');
    g.addColorStop(1, 'rgba(30,25,15,0)');
    c.fillStyle = g;
    c.fillRect(0, 9, W, 6);
    rect(c, 0, 44, W, 6 + M, k.ph(0x46564a, 0.3));
    rect(c, 0, 44, W, 1, 'rgba(0,0,0,0.3)');
  }
  function kitchenStool(k, c) {
    const wood = k.ph(0xb58b5a), dk = k.ph(0x7a5a38);
    c.strokeStyle = dk;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-14, 4);
    c.lineTo(-21, 84);
    c.moveTo(14, 4);
    c.lineTo(21, 84);
    c.moveTo(-17, 46);
    c.lineTo(17, 46);
    c.stroke();
    c.fillStyle = wood;
    k.ellipse(c, 0, 0, 24, 6);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    k.ellipse(c, -4, -2, 14, 2.4);
  }
  function kitchenTowel(k, c) {
    rect(c, -19, 0, 38, 2.6, k.ph(KC.brass));
    c.save();
    c.beginPath();
    c.moveTo(-11, 2);
    c.lineTo(11, 2);
    c.lineTo(12, 44);
    c.lineTo(-12, 44);
    c.closePath();
    c.fillStyle = k.ph(0xeef1f3, 0.4);
    c.fill();
    c.clip();
    c.fillStyle = k.ph(0x5b7fa6, 0.3);
    for (let y = 4; y < 44; y += 8) c.fillRect(-12, y, 24, 3);
    for (let x = -10; x < 12; x += 8) c.fillRect(x, 2, 3, 42);
    c.restore();
  }
  function kitchenUnderGlow(k, c) {
    const g = c.createLinearGradient(0, 0, 0, 40);
    g.addColorStop(0, 'rgba(255,214,160,1)');
    g.addColorStop(1, 'rgba(255,214,160,0)');
    c.fillStyle = g;
    c.fillRect(-100, 0, 200, 40);
  }

  const kitchen = {
    id: 'kitchen', name: 'КУХНЯ', sign: 'КУХНЯ', title: 'стендап с кухни, камера выключена', surface: 'wood', outdoor: false,
    *build(k, R) {
      const GR = G.GROUND, M = k.M;
      R.wall = k.mk(KT.slot, GR + M + 4, 0, M, (c) => kitchenWall(k, c, GR, M));
      yield;
      R.win = k.windowSprite({ gw: 96, cols: 2, transom: 0.4, curtain: 0, tulle: true, top: GR - 252, sill: GR - 146, bottom: GR - 128, seed: 61, frame: k.ph(0xf7f5ef, 0.55) });
      yield;
      R.cab = k.mk(226, 108, 113, 90, (c) => kitchenCabinet(k, c));
      R.shelf = k.mk(170, 50, 85, 36, (c) => kitchenShelf(k, c));
      R.clockFace = k.mk(34, 34, 17, 17, (c, sp) => kitchenClockFace(k, c, sp));
      R.hands = k.mk(24, 24, 12, 12, () => {});
      R.handsMin = -1;
      yield;
      R.fridge = k.mk(84, 230, 42, 222, (c, sp) => kitchenFridge(k, c, sp));
      yield;
      R.micro = k.mk(70, 40, 35, 36, (c, sp) => kitchenMicro(k, c, sp));
      R.mwD = k.mk(16, 7, 0, 0, () => {});
      R.mwMin = -1;
      R.kettle = k.mk(44, 36, 22, 32, (c, sp) => kitchenKettle(k, c, sp));
      R.toast = k.mk(90, 34, 45, 30, (c, sp) => kitchenToastBread(k, c, sp));
      R.rail = k.mk(130, 52, 65, 112, (c, sp) => kitchenRail(k, c, sp));
      R.herbs = k.mk(40, 46, 20, 40, (c, sp) => kitchenHerbs(k, c, sp));
      yield;
      R.ground = [];
      for (let v = 0; v < 3; v++) {
        R.ground.push(k.mk(KT.tile, 60 + M, 0, 10, (c) => kitchenGround(k, c, v, M)));
        yield;
      }
      R.stool = k.mk(60, 92, 30, 6, (c) => kitchenStool(k, c));
      R.stoolD = k.silhouette(R.stool, '#0b0c12');
      R.towel = k.mk(42, 48, 21, 4, (c) => kitchenTowel(k, c));
      R.towelD = k.silhouette(R.towel, '#0b0c12');
      R.glow = k.mk(200, 40, 100, 0, (c) => kitchenUnderGlow(k, c), 1);
    },
    bg(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR;
      each(L, KT.wallPar, KT.slot, 2, (i, x) => tile(ctx, R.wall, snap(x, k.K), 0));
      each(L, KT.wallPar, KT.slot * 3, 140, (i, x) => {
        const cx = x + KT.slot / 2, sp = R.win, g = sp.glass;
        k.drawSky(ctx, { x: cx + g.x, y: g.y, w: g.w, h: g.h, base: sp.base, skyTop: sp.skyTop }, i);
        for (let p = 0; p < sp.panes.length; p++) {
          const q = sp.panes[p];
          if (q[3] > 0) k.pushPane(cx + q[0], q[1], q[2], q[3], i * 8 + p);
        }
      });
      void GR;
    },
    wall(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR;
      const clock = Math.floor(L.clock);
      if (clock !== R.handsMin) {
        R.handsMin = clock;
        k.redraw(R.hands, (c) => kitchenHands(k, c, clock));
      }
      each(L, KT.wallPar, KT.slot * 3, 140, (i, x) => {
        k.blit(ctx, R.win, x + KT.slot / 2, 0);
        k.blit(ctx, R.cab, x + KT.slot * 1.5, GR - 150);
        const sx = x + KT.slot * 2.5;
        k.blit(ctx, R.shelf, sx, GR - 165);
        k.blit(ctx, R.clockFace, sx + 8, GR - 214);
        k.blit(ctx, R.hands, sx + 8, GR - 214);
      });
    },
    back(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR;
      const clock = Math.floor(L.clock);
      if (clock !== R.mwMin) {
        R.mwMin = clock;
        k.redraw(R.mwD, (c) => k.seg7(c, 0.6, 1, 4.8, G.fmtClock(clock), '#7fe08a'));
      }
      each(L, KT.backPar, KT.backSlot, 60, (i, x) => {
        const j = ((i % 5) + 5) % 5;
        const cx = x + KT.backSlot / 2;
        if (j === 2) {
          k.blit(ctx, R.fridge, cx, GR);
          return;
        }
        const h = k.hash(i, 31);
        if (h < 0.22) {
          k.blit(ctx, R.micro, cx, GR - 8);
          k.blit(ctx, R.mwD, cx + 12.7, GR - 37);
        } else if (h < 0.44) {
          k.blit(ctx, R.kettle, cx, GR - 8);
          if (k.hash(i, 32) < 0.35) k.pushEmitter('steam', cx - 14, 34, 1);
        } else if (h < 0.62) k.blit(ctx, R.toast, cx, GR - 8);
        else if (h < 0.8) k.blit(ctx, R.rail, cx, GR);
        else if (h < 0.92) k.blit(ctx, R.herbs, cx, GR - 8);
      });
    },
    ground(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR;
      each(L, 1, KT.tile, 2, (i, x) => {
        const h = k.hash(i, 37);
        tile(ctx, R.ground[h < 0.34 ? 0 : h < 0.67 ? 1 : 2], snap(x, k.K), GR);
      });
    },
    emissive(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR;
      each(L, KT.wallPar, KT.slot * 3, 260, (i, x) => {
        const cx = x + KT.slot / 2, sp = R.win, g = sp.glass;
        k.beams(ctx, { x: cx + g.x, y: g.y, w: g.w, base: sp.base }, i);
        const gx = x + KT.slot * 1.5;
        if (gx > L.x0 - 120 && gx < L.x1 + 120) {
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = k.ea(0.18);
          k.blit(ctx, R.glow, gx, GR - 147);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
          k.pushLight('strip', gx, GR - 147, 200, 40, 0, 0.18, 255, 214, 160);
        }
      });
    },
    front(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR, shade = fgAlpha(k);
      each(L, KT.fgPar, KT.fgSlot, 80, (i, x) => {
        const h = k.hash(i, 39);
        if (h < 0.35) return;
        const towel = h > 0.75;
        const sp = towel ? R.towel : R.stool, spD = towel ? R.towelD : R.stoolD;
        const y = towel ? GR + 26 : GR + 28;
        ctx.globalAlpha = 0.94;
        k.blit(ctx, sp, x, y);
        ctx.globalAlpha = shade;
        k.blit(ctx, spD, x, y);
        ctx.globalAlpha = 1;
      });
    },
  };

  // ================= ОПЕНСПЕЙС «Работаю (нет)» =================
  const OT = { bgPar: 0.2, bay: 224, partPar: 0.45, part: 320, ceilPar: 0.7, ceil: 120, acSlot: 1500, backPar: 0.65, mon: 160, tile: 480, fgPar: 1.45, fgSlot: 1000 };
  const OC = { wall: 0xf3f4f2, glass: 0xcfe3ea, desk: 0xeceae4, deskEdge: 0xc8c4bb, panel: 0xdcd9d2, metal: 0x8b9096, violet: 0x6b5bd6, teal: 0x19a38c };
  const POSTERS = [['МЫ —', 'СЕМЬЯ', 0x6b5bd6], ['ЕБЛАНСТВО —', 'ТОЖЕ KPI', 0x19a38c], ['ДЕДЛАЙН', 'БЫЛ ВЧЕРА', 0x3d4a5c], ['ТИШЕ!', 'ИДЁТ СОЗВОН', 0x8a6a3c]];
  const HAIR = [0x3b2a20, 0x8a5a2b, 0x1d1d22, 0xc9a26a];
  const SKIN = [0xf1c9a5, 0xd9a47e, 0xb67b55, 0xf6d6bd];
  const isComa = (clock) => clock >= 840 && clock < 870;

  function officeColumn(k, c, h) {
    rect(c, -12, 0, 24, h, k.ph(0xe8eae9, 0.45));
    rect(c, -12, 0, 3, h, 'rgba(255,255,255,0.45)');
    rect(c, 8, 0, 4, h, 'rgba(0,0,0,0.08)');
  }
  function officeLowWall(k, c) {
    rect(c, 0, 0, OT.bay, 124, k.ph(OC.wall));
    rect(c, 0, -5, OT.bay, 6, k.ph(0xe2e4e3, 0.45));
    rect(c, 0, -5, OT.bay, 1, 'rgba(255,255,255,0.6)');
    rect(c, 0, 0.6, OT.bay, 1.2, 'rgba(0,0,0,0.12)');
    const g = c.createLinearGradient(0, 96, 0, 124);
    g.addColorStop(0, 'rgba(40,50,60,0)');
    g.addColorStop(1, `rgba(40,50,60,${k.dark ? 0.3 : 0.14})`);
    c.fillStyle = g;
    c.fillRect(0, 96, OT.bay, 28);
  }
  function officePartition(k, c, GR) {
    const h = 232;
    c.fillStyle = k.ph(OC.glass, 0.35);
    c.globalAlpha = 0.35;
    c.fillRect(0, -h, OT.part, h);
    c.globalAlpha = 0.6;
    c.fillStyle = k.dark ? '#cfd6dc' : '#ffffff';
    c.fillRect(0, -110, OT.part, 20);
    c.globalAlpha = 0.18;
    c.fillRect(0, -h, OT.part, 1.2);
    c.globalAlpha = 1;
    rect(c, 0, -h - 4, OT.part, 4, k.ph(OC.metal, 0.4));
    rect(c, 0, -h, 5, h, k.ph(OC.metal, 0.4));
    rect(c, 0.8, -h, 1, h, 'rgba(255,255,255,0.35)');
    rect(c, 0, -2, OT.part, 2, k.ph(OC.metal, 0.4));
    c.globalAlpha = 0.12;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(60, -h);
    c.lineTo(84, -h);
    c.lineTo(24, 0);
    c.lineTo(0, 0);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
    void GR;
  }
  function officeKanban(k, c, sp) {
    rrFill(k, c, -56, -34, 112, 68, 2, k.ph(0xfbfbf8, 0.4));
    c.strokeStyle = k.ph(0xb9bec4, 0.4);
    c.lineWidth = 1.4;
    k.rr(c, -56, -34, 112, 68, 2);
    c.stroke();
    const ink = k.dark ? '#cfd3d8' : '#3b4048';
    const heads = ['TODO', 'В РАБОТЕ', 'ГОТОВО'];
    const cols = [0xffe28a, 0xb8e3ff, 0xc9f2b0, 0xffc2d6];
    const r = k.rng(77);
    for (let i = 0; i < 3; i++) {
      const x = -37 + i * 37;
      label(k, c, heads[i], x, -27, 700, 5, 'display', ink, 34);
      if (i) rect(c, x - 18.5, -30, 0.7, 60, 'rgba(0,0,0,0.15)');
      const n = i === 0 ? 5 : i === 1 ? 2 : 4;
      for (let j = 0; j < n; j++) {
        c.save();
        c.translate(x - 8 + (j % 2) * 15, -16 + Math.floor(j / 2) * 15);
        c.rotate((r() - 0.5) * 0.2);
        rect(c, -6, -6, 12, 12, k.ph(cols[(i + j) % 4], 0.3));
        rect(c, -4, -2, 8, 0.7, 'rgba(0,0,0,0.25)');
        rect(c, -4, 1, 6, 0.7, 'rgba(0,0,0,0.25)');
        c.restore();
      }
    }
    hazeTo(c, sp, k.ph(OC.wall), 0.35);
  }
  function officePosters(k, c, sp) {
    for (let i = 0; i < 4; i++) {
      const [l1, l2, col] = POSTERS[i];
      const x = 30 + i * 60;
      c.save();
      k.softShadow(c, sp, 3, 1.5, 0.22);
      rect(c, x - 26, 2, 52, 72, k.ph(col, 0.35));
      c.restore();
      rect(c, x - 22, 6, 44, 64, 'rgba(255,255,255,0.08)');
      label(k, c, l1, x, 30, 700, 8.2, 'display', '#f6f4ee', 44);
      label(k, c, l2, x, 42, 700, 8.8, 'display', '#ffffff', 44);
      rect(c, x - 10, 54, 20, 1.2, 'rgba(255,255,255,0.6)');
    }
    hazeTo(c, sp, k.ph(OC.wall), 0.2);
  }
  function officePanel(k, c) {
    rrFill(k, c, -32, -4, 64, 7, 2, k.ph(0xdfe3e7, 0.4));
    rect(c, -29, 1, 58, 2.4, '#f4fbff');
  }
  function officePanelGlow(k, c) {
    const g = c.createLinearGradient(0, 0, 0, 70);
    g.addColorStop(0, 'rgba(225,240,255,0.9)');
    g.addColorStop(1, 'rgba(225,240,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-30, 0);
    c.lineTo(30, 0);
    c.lineTo(48, 70);
    c.lineTo(-48, 70);
    c.closePath();
    c.fill();
  }
  function officeAC(k, c, sp) {
    c.save();
    k.softShadow(c, sp, 3, 2, 0.2);
    rrFill(k, c, -36, -12, 72, 24, 5, k.ph(0xf4f5f3, 0.4));
    c.restore();
    rect(c, -32, 4, 64, 1, 'rgba(0,0,0,0.2)');
    rect(c, -32, 7, 64, 1, 'rgba(0,0,0,0.12)');
    c.fillStyle = '#7fe08a';
    k.circle(c, 28, -6, 1);
    hazeTo(c, sp, k.ph(OC.wall), 0.15);
  }
  function officeDeskRow(k, c) {
    rect(c, 0, -42, OT.tile, 4, k.ph(OC.desk, 0.4));
    rect(c, 0, -42, OT.tile, 0.8, 'rgba(255,255,255,0.5)');
    rect(c, 0, -38, OT.tile, 38, k.ph(OC.panel, 0.4));
    rect(c, 0, -38, OT.tile, 1.4, 'rgba(0,0,0,0.12)');
    for (let x = 0; x < OT.tile; x += 240) rect(c, x, -42, 1.2, 42, 'rgba(0,0,0,0.12)');
  }
  function officeMonitor(k, c, sp, v) {
    rect(c, -2, -12, 4, 12, k.ph(OC.metal, 0.35));
    rrFill(k, c, -10, -2, 20, 3, 1.2, k.ph(OC.metal, 0.35));
    rrFill(k, c, -25, -44, 50, 33, 2, '#1d2026');
    rect(c, -22.5, -41.5, 45, 28, k.dark ? '#c9d3da' : '#e9f1f6');
    const r = k.rng(500 + v);
    const cols = ['#8fb3d9', '#9ccfa6', '#d8b98a', '#c2a6d9', '#9aa4b0'];
    for (let i = 0; i < 6; i++) {
      let x = -20 + (r() < 0.4 ? 4 : 0);
      const parts = 1 + Math.floor(r() * 3);
      for (let p = 0; p < parts && x < 16; p++) {
        const w = 4 + r() * 10;
        rect(c, x, -38 + i * 4, Math.min(w, 19 - x), 1.6, cols[Math.floor(r() * cols.length)]);
        x += w + 2;
      }
    }
    hazeTo(c, sp, k.ph(OC.wall), 0.35);
  }
  function officeHeads(k, c, sp) {
    for (let i = 0; i < 4; i++) {
      const x = 14 + i * 28;
      const skin = k.ph(SKIN[i], 0.35), hair = k.ph(HAIR[i], 0.35);
      rect(c, x - 9, 4, 18, 14, k.ph([0x6b5bd6, 0x19a38c, 0x8a6a3c, 0x5b7fa6][i], 0.35));
      c.fillStyle = skin;
      k.circle(c, x, -6, 10);
      c.fillStyle = hair;
      if (i === 0) {
        c.beginPath();
        c.arc(x, -6, 10.4, Math.PI * 1.05, Math.PI * 1.95);
        c.closePath();
        c.fill();
      } else if (i === 1) {
        c.beginPath();
        c.arc(x, -6, 10.4, Math.PI, TAU);
        c.closePath();
        c.fill();
        k.circle(c, x, -18, 4.6);
      } else if (i === 2) {
        for (let j = 0; j < 7; j++) k.circle(c, x - 9 + j * 3, -13 - Math.sin(j) * 1.5, 3.4);
      } else {
        c.beginPath();
        c.arc(x, -7, 10.6, Math.PI * 0.95, Math.PI * 2.05);
        c.closePath();
        c.fill();
        rect(c, x - 2, -18, 13, 3, hair);
      }
      c.fillStyle = '#ffffff';
      k.ellipse(c, x - 3.6, -4, 2.3, 2);
      k.ellipse(c, x + 3.6, -4, 2.3, 2);
    }
    hazeTo(c, sp, k.ph(OC.wall), 0.2);
  }
  function officeProps(k, c, sp) {
    rrFill(k, c, -16, -11, 9, 11, 1.6, k.ph(0xf2efe8, 0.4));
    c.strokeStyle = k.ph(0xf2efe8, 0.4);
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(-6.5, -6, 2.4, -1.2, 1.2);
    c.stroke();
    rect(c, -15, -8, 7, 2, k.ph(OC.violet, 0.35));
    rrFill(k, c, 6, -7, 10, 7, 1.4, k.ph(0xb9785a));
    c.fillStyle = k.ph(0x5e8f4a);
    k.rr(c, 8.5, -19, 5, 13, 2.5);
    c.fill();
    k.rr(c, 4.5, -15, 3.4, 6, 1.7);
    c.fill();
    k.rr(c, 12.5, -16, 3.4, 6, 1.7);
    c.fill();
    hazeTo(c, sp, k.ph(OC.wall), 0.25);
  }
  function officeZ(k, c) {
    label(k, c, 'z', -3, 3, 700, 7, 'display', k.dark ? '#cfd6dc' : '#5b6470');
    label(k, c, 'z', 4, -4, 700, 5, 'display', k.dark ? '#cfd6dc' : '#5b6470');
  }
  function officeGround(k, c, v, M) {
    const W = OT.tile, r = k.rng(301 + v);
    rect(c, 0, -10, W, 10, k.ph(OC.desk, 0.4));
    rect(c, 0, -10, W, 1.4, 'rgba(0,0,0,0.08)');
    for (let d = 0; d < 2; d++) {
      const x0 = d * 240;
      rect(c, x0, -10, 1.2, 10, 'rgba(0,0,0,0.12)');
      const kb = x0 + 70 + r() * 60;
      rrFill(k, c, kb, -6.2, 44, 3, 1, k.ph(0x50555c, 0.3));
      rect(c, kb + 2, -5.8, 40, 0.7, 'rgba(255,255,255,0.25)');
      rrFill(k, c, kb + 52, -6.8, 18, 4, 1.4, k.ph(v ? OC.teal : OC.violet, 0.35));
      c.fillStyle = k.ph(0x50555c, 0.3);
      k.ellipse(c, kb + 60, -5, 2.4, 1);
      c.save();
      c.translate(x0 + 30 + r() * 20, -5);
      c.rotate(-0.04 + r() * 0.08);
      rect(c, -14, -3, 28, 5.4, k.ph(0xffffff, 0.4));
      rect(c, -12, -2, 18, 0.6, 'rgba(0,0,0,0.25)');
      c.restore();
    }
    rect(c, 0, -2.4, W, 2.4, k.ph(OC.deskEdge, 0.35));
    rect(c, 0, -2.4, W, 0.6, 'rgba(255,255,255,0.4)');
    rect(c, 0, 0, W, 28, k.ph(OC.panel, 0.35));
    rect(c, 0, 6, W, 3, k.ph(0xc4c1ba, 0.35));
    rect(c, 0, 9, W, 0.8, 'rgba(255,255,255,0.35)');
    for (let x = 0; x < W; x += 240) rect(c, x - 0.6, 0, 1.2, 28, 'rgba(0,0,0,0.12)');
    const g = c.createLinearGradient(0, 0, 0, 6);
    g.addColorStop(0, 'rgba(20,25,30,0.2)');
    g.addColorStop(1, 'rgba(20,25,30,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, 6);
    rect(c, 0, 28, W, 22 + M, k.ph(0x6f7378, 0.25));
    for (let x = 0; x < W; x += 240) {
      rect(c, x + 8, 28, 4, 22, k.ph(OC.metal, 0.3));
      rect(c, x + 228, 28, 4, 22, k.ph(OC.metal, 0.3));
    }
    rect(c, 0, 46, W, 4 + M, k.ph(0x585c63, 0.25));
  }
  function officeFront(k, c) {
    const dk = k.ph(0x2c3036, 0.25);
    c.fillStyle = dk;
    k.rr(c, 6, 0, 46, 40, 10);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 0.6;
    c.beginPath();
    for (let x = 10; x < 50; x += 3.5) {
      c.moveTo(x, 3);
      c.lineTo(x, 38);
    }
    c.stroke();
    rect(c, 26, 38, 6, 40, dk);
    c.fillStyle = k.ph(0xa9cbe3, 0.3);
    k.rr(c, 80, 4, 30, 40, 8);
    c.fill();
    rect(c, 86, 0, 18, 6, k.ph(0x7fa9c8, 0.3));
    rect(c, 78, 40, 34, 40, k.ph(0xe9ecee, 0.35));
    c.strokeStyle = k.ph(0x2c3036, 0.25);
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(130, 30);
    c.bezierCurveTo(150, 0, 170, 40, 160, 12);
    c.bezierCurveTo(152, -4, 186, 10, 176, 30);
    c.bezierCurveTo(170, 46, 196, 24, 200, 36);
    c.stroke();
  }

  const office = {
    id: 'office', name: 'ОФИС', sign: 'ОФИС · 7 ЭТАЖ', title: 'работаю (нет)', surface: 'laminate', outdoor: false,
    look: { grade: '#e8f4ff', gradeA: 0.05 },
    *build(k, R) {
      const GR = G.GROUND, M = k.M;
      R.col = k.mk(24, GR - 120 + M, 12, M, (c) => officeColumn(k, c, GR - 120 + M));
      R.low = k.mk(OT.bay, 132, 0, 6, (c) => officeLowWall(k, c));
      yield;
      R.part = k.mk(OT.part, 240, 0, 238, (c) => officePartition(k, c, GR));
      R.kanban = k.mk(116, 72, 58, 36, (c, sp) => officeKanban(k, c, sp));
      R.posters = k.mk(240, 78, 0, 0, (c, sp) => officePosters(k, c, sp));
      yield;
      R.panel = k.mk(68, 10, 34, 5, (c) => officePanel(k, c));
      R.panelGlow = k.mk(96, 70, 48, 0, (c) => officePanelGlow(k, c), 1);
      R.ac = k.mk(80, 30, 40, 14, (c, sp) => officeAC(k, c, sp));
      yield;
      R.deskRow = k.mk(OT.tile, 46, 0, 44, (c) => officeDeskRow(k, c));
      R.mon = [0, 1].map((v) => k.mk(54, 48, 27, 46, (c, sp) => officeMonitor(k, c, sp, v)));
      R.heads = k.mk(112, 46, 0, 24, (c, sp) => officeHeads(k, c, sp));
      R.props = k.mk(36, 24, 18, 22, (c, sp) => officeProps(k, c, sp));
      R.z = k.mk(16, 16, 8, 8, (c) => officeZ(k, c));
      yield;
      R.ground = [];
      for (let v = 0; v < 2; v++) {
        R.ground.push(k.mk(OT.tile, 60 + M, 0, 10, (c) => officeGround(k, c, v, M)));
        yield;
      }
      R.fg = k.mk(210, 84, 0, 2, (c) => officeFront(k, c));
      R.fgD = k.silhouette(R.fg, '#0b0c12');
    },
    amb(L, rgb) {
      for (let i = 0; i < 3; i++) rgb[i] = rgb[i] + ([242, 247, 255][i] - rgb[i]) * 0.5 * (1 - (L.F ? L.F.night : 0));
      if (isComa(L.clock)) for (let i = 0; i < 3; i++) rgb[i] *= 0.92;
    },
    bg(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR, M = k.M, W = L.W;
      const base = GR - 120;
      k.drawSky(ctx, { x: -M, y: -M, w: W + M * 2, h: base + M, base, skyTop: -M }, 7);
      each(L, OT.bgPar, OT.bay, 30, (i, x) => {
        k.pushPane(x + 12, -M, OT.bay - 24, base + M, i);
        tile(ctx, R.low, snap(x, k.K), base);
      });
      ctx.fillStyle = k.ph(0xd9dde0, 0.45);
      ctx.fillRect(L.x0, base - 82, L.x1 - L.x0, 2);
      each(L, OT.bgPar, OT.bay, 30, (i, x) => k.blit(ctx, R.col, x, 0));
    },
    wall(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR;
      each(L, OT.partPar, OT.part, 10, (i, x) => {
        k.blit(ctx, R.part, snap(x, k.K), GR);
        const h = k.hash(i, 51);
        if (h < 0.42) k.blit(ctx, R.kanban, x + 170, GR - 158);
        else if (h < 0.84) {
          const p = Math.floor(k.hash(i, 52) * 4) % 4;
          cell(ctx, R.posters, p, 60, x + 160, GR - 196);
        }
      });
      each(L, OT.ceilPar, OT.ceil, 40, (i, x) => k.blit(ctx, R.panel, x, 4));
      each(L, OT.ceilPar, OT.acSlot, 60, (i, x) => {
        const ax = x + 600;
        k.blit(ctx, R.ac, ax, GR - 200);
        k.pushEmitter('vent', ax, 186, 1);
      });
    },
    back(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR;
      const coma = isComa(L.clock);
      each(L, OT.backPar, OT.tile, 10, (i, x) => tile(ctx, R.deskRow, snap(x, k.K), GR));
      const B = G.bunny;
      let zLeft = 2;
      ctx.fillStyle = '#2a2420';
      each(L, OT.backPar, OT.mon, 60, (i, x) => {
        const cx = x + OT.mon / 2;
        const head = k.hash(i, 41) < 0.4;
        if (head) {
          const hx = cx + (k.hash(i, 42) - 0.5) * 12, hy = GR - 86;
          const v = Math.floor(k.hash(i, 44) * 4) % 4;
          if (coma) {
            ctx.save();
            ctx.translate(hx, hy + 14);
            ctx.rotate(k.hash(i, 45) < 0.5 ? -0.2 : 0.2);
            cell(ctx, R.heads, v, 28, 0, -14);
            ctx.strokeStyle = '#2a2420';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(-5.4, -18);
            ctx.lineTo(-1.8, -18);
            ctx.moveTo(1.8, -18);
            ctx.lineTo(5.4, -18);
            ctx.stroke();
            ctx.restore();
            if (zLeft > 0 && k.hash(i, 43) < 0.6) {
              zLeft--;
              const bob = k.calm ? 0 : Math.sin(L.t * 1.6 + i) * 2;
              k.blit(ctx, R.z, hx + 10, hy - 20 + bob);
            }
          } else {
            cell(ctx, R.heads, v, 28, hx, hy);
            const off = G.clamp((B.x - hx) / 200, -1, 1) * 1.5;
            ctx.beginPath();
            ctx.arc(hx - 3.6 + off, hy - 4, 1.1, 0, TAU);
            ctx.moveTo(hx + 3.6 + off + 1.1, hy - 4);
            ctx.arc(hx + 3.6 + off, hy - 4, 1.1, 0, TAU);
            ctx.fill();
          }
        }
        k.blit(ctx, R.mon[i & 1], cx, GR - 42);
        if (k.hash(i, 46) < 0.5) k.blit(ctx, R.props, cx + 44, GR - 42);
      });
    },
    ground(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR;
      each(L, 1, OT.tile, 2, (i, x) => tile(ctx, R.ground[k.hash(i, 47) < 0.5 ? 0 : 1], snap(x, k.K), GR));
    },
    emissive(ctx, L) {
      const k = kitOf(), R = L.R;
      let n = 0;
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = k.ea(0.25);
      each(L, OT.ceilPar, OT.ceil, 40, (i, x) => {
        k.blit(ctx, R.panelGlow, x, 7);
        if (n++ < 6) k.pushLight('strip', x, 7, 60, 70, 0, 0.25, 225, 240, 255);
      });
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
    front(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR, shade = fgAlpha(k);
      each(L, OT.fgPar, OT.fgSlot, 220, (i, x) => {
        if (k.hash(i, 49) < 0.3) return;
        const part = Math.floor(k.hash(i, 48) * 3) % 3;
        const cx = [0, 76, 128][part], cw = [58, 40, 76][part];
        const sp = R.fg, spD = R.fgD, kk = sp.k;
        const y = GR + 24;
        ctx.globalAlpha = 0.94;
        ctx.drawImage(sp.c, cx * kk, 0, cw * kk, sp.c.height, x, y - sp.oy, cw, sp.h);
        ctx.globalAlpha = shade;
        ctx.drawImage(spD.c, cx * kk, 0, cw * kk, spD.c.height, x, y - spD.oy, cw, spD.h);
        ctx.globalAlpha = 1;
      });
    },
  };

  // ================= ПЕРЕГОВОРКА «БАЙКАЛ» =================
  const BT = { wallPar: 0.35, tile: 300, mod: 900, backPar: 0.6, chair: 150, tableTile: 480, fgPar: 1.45, fgSlot: 900 };
  const BC = { panel: 0xdfe6ea, accent: 0x2c5d7c, walnut: 0x6b4a33, edge: 0x8a6345, green: 0x2fbf71 };
  const baikalState = { off: [], tile: 0 };
  G.on('start', () => {
    baikalState.off.length = 0;
  });
  G.on('spawn', (o, def) => {
    const loc = G.scene && G.scene.loc;
    if (!def || def.id !== 'call' || !loc || loc.id !== 'baikal' || baikalState.off.length >= 4) return;
    baikalState.tile = (baikalState.tile + 4) % 9;
    if (baikalState.off.indexOf(baikalState.tile) < 0) baikalState.off.push(baikalState.tile);
  });

  function baikalWall(k, c, GR, M) {
    rect(c, 0, -M, BT.tile, GR - 120 + M, k.ph(BC.accent, 0.3));
    const r = k.rng(91);
    c.globalAlpha = 0.05;
    for (let i = 0; i < 200; i++) rect(c, r() * BT.tile, -M + r() * (GR - 120 + M), 1, 1, '#ffffff');
    c.globalAlpha = 1;
    rect(c, 0, GR - 120, BT.tile, 124, k.ph(BC.panel, 0.4));
    rect(c, 0, GR - 124, BT.tile, 5, k.ph(0xeef2f4, 0.4));
    rect(c, 0, GR - 124, BT.tile, 1, 'rgba(255,255,255,0.6)');
    rect(c, 0, GR - 119, BT.tile, 1, 'rgba(0,0,0,0.2)');
    for (let x = 0; x < BT.tile; x += 100) rect(c, x, GR - 118, 1, 118, 'rgba(0,0,0,0.06)');
    const g = c.createLinearGradient(0, GR - 20, 0, GR + 4);
    g.addColorStop(0, 'rgba(20,30,40,0)');
    g.addColorStop(1, `rgba(20,30,40,${k.dark ? 0.3 : 0.15})`);
    c.fillStyle = g;
    c.fillRect(0, GR - 20, BT.tile, 24);
  }
  function baikalPhoto(k, c, sp) {
    const w = 236, h = 106;
    c.save();
    k.softShadow(c, sp, 6, 3, 0.35);
    rect(c, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, k.ph(0xf4f1ea, 0.3));
    c.restore();
    c.save();
    c.beginPath();
    c.rect(-w / 2, -h / 2, w, h);
    c.clip();
    const g = c.createLinearGradient(0, -h / 2, 0, h * 0.1);
    g.addColorStop(0, k.ph(0x9cc4e0, 0.2));
    g.addColorStop(1, k.ph(0xe9f2f7, 0.2));
    c.fillStyle = g;
    c.fillRect(-w / 2, -h / 2, w, h);
    const ridge = (pts, col) => {
      c.fillStyle = k.ph(col, 0.2);
      c.beginPath();
      c.moveTo(-w / 2, h / 2);
      for (let i = 0; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.lineTo(w / 2, h / 2);
      c.closePath();
      c.fill();
    };
    ridge([-118, -2, -92, -22, -70, -12, -40, -34, -12, -16, 18, -28, 50, -8, 80, -24, 118, -6], 0x5d86a6);
    ridge([-118, 6, -80, -6, -50, 2, -20, -10, 14, 0, 46, -12, 84, 2, 118, -4], 0x3f6a8c);
    ridge([-118, 12, -64, 6, -30, 10, 10, 4, 60, 10, 118, 8], 0x2e5574);
    rect(c, -w / 2, 14, w, h / 2 - 14, k.ph(0x4f86a8, 0.2));
    c.fillStyle = 'rgba(255,255,255,0.75)';
    for (const [x, y, l] of [[-80, 22, 14], [-30, 28, 20], [10, 20, 10], [40, 34, 18], [76, 24, 12], [-60, 40, 16]]) c.fillRect(x, y, l, 1.2);
    c.restore();
    c.strokeStyle = 'rgba(0,0,0,0.2)';
    c.lineWidth = 0.6;
    c.strokeRect(-w / 2, -h / 2, w, h);
  }
  function baikalTV(k, c, sp) {
    c.save();
    k.softShadow(c, sp, 5, 3, 0.35);
    rrFill(k, c, -82, -47, 164, 94, 4, '#15171b');
    c.restore();
    rect(c, -77, -42, 154, 84, '#20242b');
    const cols = [0x7f98b5, 0xb58b6a, 0x8fae94, 0xb5a07f, 0x9a8fb5, 0x6fa3a0, 0xc9a26a, 0x8f8a82, 0xa87f9a];
    for (let i = 0; i < 9; i++) {
      const x = -76 + (i % 3) * 51.3, y = -41 + Math.floor(i / 3) * 27.7;
      rect(c, x + 0.6, y + 0.6, 50, 26.4, '#2c313a');
      const col = cols[i];
      c.fillStyle = `rgb(${(col >> 16) & 255},${(col >> 8) & 255},${col & 255})`;
      k.circle(c, x + 25.6, y + 11, 6.2);
      rect(c, x + 17, y + 18.5, 17.2, 8.4, c.fillStyle);
      rect(c, x + 2, y + 22.5, 14, 2.4, 'rgba(255,255,255,0.25)');
    }
    rect(c, -77, -42, 154, 10, 'rgba(255,255,255,0.03)');
    rect(c, -6, 47, 12, 4, '#15171b');
  }
  function baikalBoard(k, c, sp) {
    c.save();
    k.softShadow(c, sp, 4, 2, 0.3);
    rrFill(k, c, -75, -41, 150, 82, 2, k.ph(0xfbfbf8, 0.35));
    c.restore();
    c.strokeStyle = k.ph(0xb9bec4, 0.35);
    c.lineWidth = 1.6;
    k.rr(c, -75, -41, 150, 82, 2);
    c.stroke();
    const ink = k.dark ? '#d3d7dc' : '#2f3540';
    const heads = ['Хорошо', 'Плохо', 'Экшн-айтемы'];
    for (let i = 0; i < 3; i++) {
      const x = -50 + i * 50;
      label(k, c, heads[i], x, -32, 700, 6.2, 'body', ink, 46);
      if (i) rect(c, x - 25, -36, 0.8, 72, 'rgba(0,0,0,0.18)');
    }
    rect(c, -71, -26, 142, 0.8, 'rgba(0,0,0,0.18)');
    rect(c, -72, 40, 144, 3, k.ph(0xb9bec4, 0.35));
  }
  function baikalBlinds(k, c) {
    const w = 100, h = 104;
    rect(c, -w / 2 - 6, -h - 6, w + 12, h + 12, k.ph(0xeef2f4, 0.35));
    c.clearRect(-w / 2, -h, w, h);
    c.fillStyle = k.ph(0xe4e1d8, 0.35);
    for (let i = 0; i < 6; i++) c.fillRect(-w / 2, -h + i * (h / 6), w, h / 12);
    c.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 6; i++) c.fillRect(-w / 2, -h + i * (h / 6) + h / 12 - 1, w, 1);
    rect(c, -w / 2 - 8, 6, w + 16, 4, k.ph(0xeef2f4, 0.35));
    rect(c, w / 2 - 6, -h, 0.8, h + 4, k.ph(0x9aa2ab, 0.3));
  }
  function baikalChair(k, c, sp) {
    c.fillStyle = k.ph(0x3d4a5c, 0.3);
    k.rr(c, -22, -40, 44, 40, 9);
    c.fill();
    rect(c, -18, -36, 36, 2, 'rgba(255,255,255,0.12)');
    rect(c, -22, -6, 44, 6, 'rgba(0,0,0,0.2)');
    hazeTo(c, sp, k.ph(BC.panel, 0.4), 0.2);
  }
  function baikalGround(k, c, v, M) {
    const W = BT.tableTile, r = k.rng(401 + v);
    rect(c, 0, -10, W, 10, k.ph(BC.walnut, 0.3));
    c.globalAlpha = 0.2;
    c.strokeStyle = k.ph(0x9a7050, 0.3);
    c.lineWidth = 0.5;
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const y = -9 + r() * 6, x = r() * W;
      c.moveTo(x, y);
      c.lineTo(x + 40 + r() * 90, y + (r() - 0.5));
    }
    c.stroke();
    c.globalAlpha = 1;
    rect(c, 0, -10, W, 1.4, 'rgba(0,0,0,0.25)');
    const lap = (x) => {
      rrFill(k, c, x, -6.6, 34, 3, 1, k.ph(0xc9ccd1, 0.35));
      rect(c, x + 1, -6.4, 32, 0.6, 'rgba(255,255,255,0.45)');
    };
    lap(40 + r() * 30);
    lap(300 + r() * 40);
    if (v) {
      c.fillStyle = k.ph(0x2b2f36, 0.3);
      c.beginPath();
      c.moveTo(196, -2.6);
      c.lineTo(204, -7.2);
      c.lineTo(212, -2.6);
      c.closePath();
      c.fill();
      c.fillStyle = '#7fe08a';
      k.circle(c, 204, -4, 0.7);
    } else {
      rect(c, 180, -6, 20, 4, k.ph(0xf7f3ea, 0.35));
      rect(c, 182, -5, 14, 0.5, 'rgba(0,0,0,0.3)');
    }
    rect(c, 0, -3, W, 3, k.ph(BC.edge, 0.3));
    rect(c, 0, -3, W, 0.8, 'rgba(255,220,180,0.35)');
    rect(c, 0, 0, W, 10, k.ph(0x5a3e2b, 0.3));
    k.grain(c, 0, 0, W, 10, r, k.ph(0x3a2618, 0.3));
    rect(c, 0, 9.4, W, 0.8, 'rgba(0,0,0,0.3)');
    rect(c, 0, 10, W, 40 + M, k.ph(0x46505c, 0.25));
    const g = c.createLinearGradient(0, 10, 0, 26);
    g.addColorStop(0, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 10, W, 16);
    for (const x of [60, 420]) rect(c, x, 10, 8, 40, k.ph(0x4a3324, 0.3));
  }
  function baikalFront(k, c) {
    c.fillStyle = k.ph(0x2c323c, 0.25);
    k.rr(c, 0, 0, 52, 48, 12);
    c.fill();
    k.rr(c, 70, 6, 46, 44, 11);
    c.fill();
  }

  const baikal = {
    id: 'baikal', name: 'ПЕРЕГОВОРКА «БАЙКАЛ»', sign: 'Переговорка «Байкал» · 6 мест', title: '6 мест, 11 человек', surface: 'wood', outdoor: false,
    *build(k, R) {
      const GR = G.GROUND, M = k.M;
      baikalState.off.length = 0;
      R.wall = k.mk(BT.tile, GR + M + 4, 0, M, (c) => baikalWall(k, c, GR, M));
      yield;
      R.photo = k.mk(260, 130, 130, 65, (c, sp) => baikalPhoto(k, c, sp));
      R.tv = k.mk(176, 110, 88, 52, (c, sp) => baikalTV(k, c, sp));
      yield;
      const tl = (s, size, w, col) => k.mk(w, 16, w / 2, 8, (c) => label(k, c, s, 0, 0.6, 700, size, 'display', col, w - 4));
      R.camOff = tl('камера выкл.', 6, 48, '#9aa4b0');
      R.notHeard = tl('Вас не слышно', 9, 120, '#ffffff');
      R.allHands = tl('ALL-HANDS', 20, 150, '#ffffff');
      R.board = k.mk(160, 92, 80, 46, (c, sp) => baikalBoard(k, c, sp));
      R.blinds = k.mk(124, 128, 62, 116, (c) => baikalBlinds(k, c));
      R.plaque = k.mk(110, 18, 55, 9, (c, sp) => {
        c.save();
        k.softShadow(c, sp, 2, 1, 0.3);
        rrFill(k, c, -50, -7, 100, 14, 2, 'rgba(255,255,255,0.16)');
        c.restore();
        label(k, c, 'Переговорка «Байкал» · 6 мест', 0, 0.6, 600, 6, 'body', '#eef4f8', 94);
      });
      yield;
      R.chair = k.mk(50, 46, 25, 42, (c, sp) => baikalChair(k, c, sp));
      R.ground = [];
      for (let v = 0; v < 2; v++) {
        R.ground.push(k.mk(BT.tableTile, 60 + M, 0, 10, (c) => baikalGround(k, c, v, M)));
        yield;
      }
      R.fg = k.mk(120, 52, 0, 2, (c) => baikalFront(k, c));
      R.fgD = k.silhouette(R.fg, '#0b0c12');
    },
    bg(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR;
      each(L, BT.wallPar, BT.tile, 2, (i, x) => tile(ctx, R.wall, snap(x, k.K), 0));
      each(L, BT.wallPar, BT.mod, 80, (i, x) => {
        const wx = x + 810, gx = wx - 50, gy = GR - 236, gw = 100, gh = 104;
        k.drawSky(ctx, { x: gx, y: gy, w: gw, h: gh, base: gy + gh, skyTop: gy }, 300 + i);
        k.pushPane(gx, gy, gw, gh, 900 + i);
      });
    },
    wall(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR;
      const fade = L.boss ? 0.5 : 1;
      const speaker = Math.floor(L.t / 1.4) % 9;
      const notHeard = L.clock >= 960 && L.clock < 1110;
      each(L, BT.wallPar, BT.mod, 160, (i, x) => {
        ctx.globalAlpha = fade;
        k.blit(ctx, R.photo, x + 160, GR - 192);
        k.blit(ctx, R.plaque, x + 560, GR - 246);
        k.blit(ctx, R.board, x + 640, GR - 176);
        const n = Math.max(0, Math.min(12, Math.floor((L.u * BT.wallPar + 260 - i * 0) / 30)));
        if (n > 0) {
          const cols = ['#ffe28a', '#b8e3ff', '#c9f2b0', '#ffc2d6'];
          for (let s = 0; s < n; s++) {
            const col = s % 3, row = Math.floor(s / 3);
            ctx.fillStyle = cols[(s * 7 + i) % 4];
            ctx.fillRect(x + 640 - 66 + col * 50 + (row % 2) * 9, GR - 176 - 22 + row * 14, 8, 8);
          }
        }
        ctx.globalAlpha = 1;
        k.blit(ctx, R.blinds, x + 810, GR - 128);
        const tx = x + 400, ty = GR - 188;
        k.blit(ctx, R.tv, tx, ty);
        if (L.boss) {
          ctx.fillStyle = '#2b3550';
          ctx.fillRect(tx - 77, ty - 42, 154, 84);
          k.blit(ctx, R.allHands, tx, ty);
        } else {
          for (const t of baikalState.off) {
            const ox = tx - 76 + (t % 3) * 51.3, oy = ty - 41 + Math.floor(t / 3) * 27.7;
            ctx.fillStyle = '#16191e';
            ctx.fillRect(ox + 0.6, oy + 0.6, 50, 26.4);
            k.blit(ctx, R.camOff, ox + 25.6, oy + 14);
          }
          if (baikalState.off.indexOf(speaker) < 0) {
            ctx.strokeStyle = '#2fbf71';
            ctx.lineWidth = 1.6;
            ctx.strokeRect(tx - 76 + (speaker % 3) * 51.3 + 1.4, ty - 41 + Math.floor(speaker / 3) * 27.7 + 1.4, 48.4, 24.8);
          }
          if (notHeard) {
            ctx.fillStyle = 'rgba(10,12,16,0.72)';
            ctx.fillRect(tx - 60, ty + 22, 120, 16);
            k.blit(ctx, R.notHeard, tx, ty + 30);
          }
        }
      });
    },
    back(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR;
      each(L, BT.backPar, BT.chair, 30, (i, x) => {
        if (k.hash(i, 61) < 0.25) return;
        k.blit(ctx, R.chair, x + BT.chair / 2, GR - 4);
      });
    },
    ground(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR;
      each(L, 1, BT.tableTile, 2, (i, x) => tile(ctx, R.ground[k.hash(i, 63) < 0.5 ? 0 : 1], snap(x, k.K), GR));
    },
    emissive(ctx, L) {
      const k = kitOf(), GR = L.GR;
      each(L, BT.wallPar, BT.mod, 260, (i, x) => {
        const wx = x + 810, gx = wx - 50, gy = GR - 236;
        const g = { x: gx, y: gy, w: 100, base: gy + 104 };
        if (k.F.beamA > 0.01) {
          ctx.save();
          ctx.beginPath();
          const top = Math.max(gy, -10), len = GR + 60 - top;
          for (let s = 0; s < 6; s++) ctx.rect(L.x0, top + s * (len / 6), L.x1 - L.x0, len / 12);
          ctx.clip();
          k.beams(ctx, g, i);
          ctx.restore();
        }
        const tx = x + 400, ty = GR - 188;
        k.pushLight('glow', tx, ty, 220, 150, 0, L.boss ? 0.35 : 0.22, 150, 200, 255);
      });
    },
    front(ctx, L) {
      const k = kitOf(), R = L.R, GR = L.GR, shade = fgAlpha(k);
      each(L, BT.fgPar, BT.fgSlot, 140, (i, x) => {
        if (k.hash(i, 65) < 0.3) return;
        ctx.globalAlpha = 0.94;
        k.blit(ctx, R.fg, x, GR + 24);
        ctx.globalAlpha = shade;
        k.blit(ctx, R.fgD, x, GR + 24);
        ctx.globalAlpha = 1;
      });
    },
  };

  G.registerLocation(kitchen);
  G.registerLocation(office);
  G.registerLocation(baikal);
})();
