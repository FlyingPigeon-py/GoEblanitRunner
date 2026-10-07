/* KTS-декор локаций: жаба среды, Котзилла, крыша, ДР KTS, Хэллоуин, Новый год, язык KTS на стенах, вай-фай и курьер в офисе. Владелец — П3. */
(() => {
  'use strict';
  const G = window.G;
  const K = G.kts;
  if (!K || !K.enabled) return;
  const kit = G.sceneKit;
  if (!kit || typeof kit.decor !== 'function' || typeof kit.hook !== 'function') return;

  const TAU = Math.PI * 2;
  const { rr, ellipse } = G.draw;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const mod = (a, n) => ((a % n) + n) % n;
  const data = (id) => K.get('world', id);
  const runX = () => (G.cfg && G.cfg.runX) || 96;
  const ph = (hex, k) => kit.ph(hex, k);
  const realT = () => G.state.realT || 0;

  function circle(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, Math.max(0, r), 0, TAU);
    c.fill();
  }
  function label(c, s, x, y, weight, size, family, color, maxW) {
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    kit.text(c, s, x, y, weight, size, family, color, maxW);
  }
  function tri(c, ax, ay, bx, by, cx, cy) {
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(bx, by);
    c.lineTo(cx, cy);
    c.closePath();
    c.fill();
  }
  function slots(L, par, span, pad, fn) {
    const off = L.u * par - runX();
    const i0 = Math.floor((L.x0 - pad + off) / span), i1 = Math.floor((L.x1 + pad + off) / span);
    for (let i = i0; i <= i1; i++) fn(i, i * span - off);
  }

  // ---------- день: что сегодня висит на стенах ----------
  const day = { iso: '', week: 1, season: 0, wed: false, final: false, halloween: false, newYear: false, hat: false, november: false, may9: false, pool: false, garden: false };
  const inData = (id) => {
    const d = data(id);
    return !!(d && d.from && d.to && K.inWindow(d.from, d.to));
  };
  function readDay() {
    const t = K.today;
    const iso = t.iso;
    day.week = t.week;
    day.season = t.m === 12 || t.m <= 2 ? 0 : t.m <= 5 ? 1 : t.m <= 8 ? 2 : 3;
    day.wed = !!(t.wednesday && data('frog'));
    day.final = day.wed && !!data('frogFinal') && K.event('lastWednesdayOfYear');
    day.halloween = !!data('halloween') && K.event('halloween');
    day.newYear = !!data('newYear') && K.event('newYear');
    day.hat = !!data('kotzillaHat') && K.event('newYear');
    day.november = !!data('birthday') && K.event('ktsBirthday');
    day.may9 = inData('may9');
    day.pool = inData('roofPool');
    day.garden = inData('roofGarden');
    if (iso !== day.iso) {
      day.iso = iso;
      freeAll();
    }
  }

  // ---------- кэш спрайтов ----------
  const cache = new Map();
  let cK = 0, cDark = null, cH = 0, gen = 0, cGen = -1;
  function freeAll() {
    for (const sp of cache.values()) {
      if (sp && sp.c) {
        sp.c.width = 1;
        sp.c.height = 1;
      }
    }
    cache.clear();
  }
  function fresh() {
    const k = kit.K, d = kit.dark;
    if (k === cK && d === cDark && G.H === cH && gen === cGen) return;
    freeAll();
    cK = k;
    cDark = d;
    cH = G.H;
    cGen = gen;
  }
  G.on('fonts', () => { gen++; });
  G.on('theme', () => { gen++; });
  function mk(key, w, h, ox, oy, draw, kMax) {
    const k = Math.min(kit.K || 2, kMax || 2);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * k));
    c.height = Math.max(1, Math.ceil(h * k));
    const sp = { c, w: c.width / k, h: c.height / k, ox, oy, k, hw: w / 2, hh: h / 2 };
    const x = c.getContext('2d');
    if (x) {
      x.setTransform(k, 0, 0, k, ox * k, oy * k);
      x.lineCap = 'round';
      x.lineJoin = 'round';
      draw(x, sp);
    }
    cache.set(key, sp);
    return sp;
  }
  function dropKey(key) {
    const sp = cache.get(key);
    if (sp && sp.c) {
      sp.c.width = 1;
      sp.c.height = 1;
    }
    cache.delete(key);
  }
  function silhouetteOf(key, src, color) {
    return mk(key, src.w, src.h, src.ox, src.oy, (c) => {
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(src.c, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = color;
      c.fillRect(0, 0, src.c.width, src.c.height);
      c.restore();
    }, src.k);
  }
  const blit = (ctx, sp, x, y) => ctx.drawImage(sp.c, x - sp.ox, y - sp.oy, sp.w, sp.h);
  function glowDisc(key, rgb, r) {
    return cache.get(key) || mk(key, r * 2, r * 2, r, r, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(${rgb},0.85)`);
      g.addColorStop(0.35, `rgba(${rgb},0.32)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      c.fillStyle = g;
      c.fillRect(-r, -r, r * 2, r * 2);
    }, 1);
  }
  const green = () => {
    const g = data('green');
    return g && Number.isFinite(g.main) ? g.main : 0x2bb673;
  };
  const greenDeep = () => {
    const g = data('green');
    return g && Number.isFinite(g.deep) ? g.deep : 0x1d8a52;
  };

  // ---------- жаба среды ----------
  function drawGear(c, gear, pass) {
    if (pass === 1) {
      if (gear !== 'scarf') return;
      c.fillStyle = '#d6453c';
      c.beginPath();
      c.arc(0, -16, 7, Math.PI, TAU);
      c.closePath();
      c.fill();
      c.fillStyle = '#ffffff';
      rr(c, -8, -17.5, 16, 3.2, 1.6);
      c.fill();
      circle(c, 0, -24, 2.6);
      return;
    }
    if (gear === 'bike' && pass === 0) {
      c.strokeStyle = '#3b3f47';
      c.lineWidth = 1.8;
      for (const wx of [-15, 15]) {
        c.beginPath();
        c.arc(wx, 15, 8, 0, TAU);
        c.stroke();
      }
      c.lineWidth = 1.4;
      c.strokeStyle = ph(green(), 0.25);
      c.beginPath();
      c.moveTo(-15, 15);
      c.lineTo(-3, 4);
      c.lineTo(10, 4);
      c.lineTo(15, 15);
      c.moveTo(-3, 4);
      c.lineTo(2, 15);
      c.lineTo(10, 4);
      c.stroke();
      return;
    }
    if (pass !== 2) return;
    if (gear === 'headband') {
      c.strokeStyle = '#e8577a';
      c.lineWidth = 2.4;
      c.beginPath();
      c.arc(0, -10, 15.5, Math.PI * 1.12, Math.PI * 1.88);
      c.stroke();
      c.fillStyle = '#e8577a';
      tri(c, 9, -22, 16, -27, 16, -18);
      tri(c, 9, -22, 3, -28, 3, -18);
      circle(c, 9, -22, 2);
    } else if (gear === 'scarf') {
      c.fillStyle = '#d6453c';
      rr(c, -13, -2, 26, 5, 2.4);
      c.fill();
      rr(c, 5, 0, 6, 12, 2);
      c.fill();
      c.fillStyle = '#ffffff';
      for (let x = -10; x < 12; x += 5) c.fillRect(x, -2, 1.6, 5);
    } else if (gear === 'slippers') {
      for (const sx of [-7, 7]) {
        c.fillStyle = '#f2a7c3';
        ellipse(c, sx, 15, 6.2, 3.2);
        c.fillStyle = '#ffffff';
        for (let j = -2; j <= 2; j++) circle(c, sx + j * 2, 12.6, 1.4);
      }
    } else if (gear === 'shades') {
      c.fillStyle = '#1b1d22';
      rr(c, -14, -18, 10, 6.4, 2.4);
      c.fill();
      rr(c, 4, -18, 10, 6.4, 2.4);
      c.fill();
      c.fillRect(-4, -16.6, 8, 1.4);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(-12, -17, 3, 1.2);
      c.fillRect(6, -17, 3, 1.2);
    } else if (gear === 'headphones') {
      c.strokeStyle = '#2f3440';
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(0, -12, 17, Math.PI * 1.08, Math.PI * 1.92);
      c.stroke();
      c.fillStyle = ph(green(), 0.25);
      rr(c, -19, -15, 5, 9, 2);
      c.fill();
      rr(c, 14, -15, 5, 9, 2);
      c.fill();
    } else if (gear === 'coffee') {
      c.fillStyle = '#f4efe6';
      rr(c, 6, 4, 9, 10, 1.6);
      c.fill();
      c.strokeStyle = '#f4efe6';
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(15.5, 9, 2.6, -1.3, 1.3);
      c.stroke();
      c.fillStyle = ph(green(), 0.25);
      c.fillRect(6, 7, 9, 2.4);
      c.strokeStyle = 'rgba(120,120,120,0.6)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(9, 2);
      c.quadraticCurveTo(7, -1, 9.5, -4);
      c.moveTo(12, 2);
      c.quadraticCurveTo(10, -1, 12.5, -4);
      c.stroke();
    } else if (gear === 'laptop') {
      c.fillStyle = '#4a4f59';
      c.beginPath();
      c.moveTo(-12, 15);
      c.lineTo(12, 15);
      c.lineTo(9, 3);
      c.lineTo(-9, 3);
      c.closePath();
      c.fill();
      c.fillStyle = '#9fe3c9';
      c.fillRect(-7, 5, 14, 7);
      c.fillStyle = '#2f3440';
      c.fillRect(-14, 15, 28, 2);
    } else if (gear === 'crown') {
      c.fillStyle = '#f6c945';
      c.beginPath();
      c.moveTo(-10, -20);
      c.lineTo(-11, -30);
      c.lineTo(-5, -25);
      c.lineTo(0, -32);
      c.lineTo(5, -25);
      c.lineTo(11, -30);
      c.lineTo(10, -20);
      c.closePath();
      c.fill();
      c.fillStyle = '#d6453c';
      circle(c, 0, -24, 1.6);
    }
  }
  function drawFrog(c, x, y, s, gear, gold) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    const skin = gold ? '#e2b23e' : '#62b84a', skinDk = gold ? '#a77b22' : '#3c8a33', belly = gold ? '#f8e39a' : '#c9ec9f';
    drawGear(c, gear, 0);
    c.fillStyle = skinDk;
    ellipse(c, -14, 9, 8, 5, -0.3);
    ellipse(c, 14, 9, 8, 5, 0.3);
    c.fillStyle = skin;
    ellipse(c, 0, 4, 15, 11);
    c.fillStyle = belly;
    ellipse(c, 0, 7, 9, 7);
    c.fillStyle = skin;
    ellipse(c, 0, -7, 17, 10);
    drawGear(c, gear, 1);
    for (const ex of [-9, 9]) {
      c.fillStyle = skin;
      circle(c, ex, -15, 6);
      c.fillStyle = '#ffffff';
      circle(c, ex, -15, 4.2);
      c.fillStyle = '#1d1a14';
      circle(c, ex + 0.6, -14.6, 2.2);
      c.fillStyle = '#ffffff';
      circle(c, ex + 1.3, -15.7, 0.8);
    }
    c.strokeStyle = skinDk;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-8, -5);
    c.quadraticCurveTo(0, 0.5, 8, -5);
    c.stroke();
    c.fillStyle = 'rgba(255,120,140,0.45)';
    ellipse(c, -11, -5, 2.6, 1.6);
    ellipse(c, 11, -5, 2.6, 1.6);
    c.fillStyle = skinDk;
    ellipse(c, -6, 14, 4, 2.2);
    ellipse(c, 6, 14, 4, 2.2);
    drawGear(c, gear, 2);
    c.restore();
  }
  const SEASON_BG = [0xd8ecf8, 0xe4f4d4, 0xfff0b8, 0xf8dfc2];
  function seasonDeco(c, w, h, season, final) {
    const r = kit.rng(day.week * 31 + 7);
    if (final) {
      c.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 9; i++) {
        const x = (r() - 0.5) * w, y = (r() - 0.5) * h, s = 1 + r() * 1.6;
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
      return;
    }
    if (season === 0) {
      c.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 22; i++) circle(c, (r() - 0.5) * w, (r() - 0.5) * h, 0.6 + r() * 0.9);
    } else if (season === 1) {
      for (let i = 0; i < 7; i++) {
        const x = (r() - 0.5) * w, y = (r() - 0.5) * h;
        c.fillStyle = r() < 0.5 ? '#f5a3c0' : '#ffffff';
        for (let p = 0; p < 5; p++) circle(c, x + Math.cos((p * TAU) / 5) * 1.6, y + Math.sin((p * TAU) / 5) * 1.6, 1.1);
        c.fillStyle = '#f6c945';
        circle(c, x, y, 0.9);
      }
    } else if (season === 2) {
      c.fillStyle = 'rgba(255,190,60,0.55)';
      circle(c, w * 0.36, -h * 0.3, 7);
      c.strokeStyle = 'rgba(255,190,60,0.55)';
      c.lineWidth = 1.2;
      for (let a = 0; a < 8; a++) {
        const ca = Math.cos((a * TAU) / 8), sa = Math.sin((a * TAU) / 8);
        c.beginPath();
        c.moveTo(w * 0.36 + ca * 9, -h * 0.3 + sa * 9);
        c.lineTo(w * 0.36 + ca * 12, -h * 0.3 + sa * 12);
        c.stroke();
      }
    } else {
      const cols = ['#e07b39', '#c9502f', '#e9b44c'];
      for (let i = 0; i < 9; i++) {
        c.fillStyle = cols[i % 3];
        ellipse(c, (r() - 0.5) * w, (r() - 0.5) * h, 2.4, 1.2, r() * TAU);
      }
    }
  }
  function frogPoster(office) {
    const key = office ? 'frogO' : 'frogL';
    const have = cache.get(key);
    if (have) return have;
    const f = data('frog');
    if (!f) return null;
    const fin = day.final, fd = fin ? data('frogFinal') : null;
    const w = office ? 52 : 74, h = office ? 72 : 68, pad = 6, b = 3;
    const top = (fin ? fd && fd.top : f.top) || '';
    const sub = K.fmt((fin ? fd && fd.sub : f.sub) || '', { week: day.week }) || '';
    const list = Array.isArray(f.gear) && f.gear.length ? f.gear : ['headband'];
    const gear = fin ? 'crown' : list[day.week % list.length];
    return mk(key, w + pad * 2, h + pad * 2, w / 2 + pad, h / 2 + pad, (c, sp) => {
      c.save();
      kit.softShadow(c, sp, 4, 2, 0.25);
      c.fillStyle = fin ? '#c9962e' : ph(green(), 0.3);
      c.fillRect(-w / 2, -h / 2, w, h);
      c.restore();
      const iw = w - b * 2, ih = h - b * 2;
      c.fillStyle = fin ? ph(0xf3d27a, 0.25) : ph(SEASON_BG[day.season], 0.3);
      c.fillRect(-iw / 2, -ih / 2, iw, ih);
      c.save();
      c.beginPath();
      c.rect(-iw / 2, -ih / 2, iw, ih);
      c.clip();
      seasonDeco(c, iw, ih, day.season, fin);
      c.restore();
      const ink = '#2b2219';
      const words = top.split(' ');
      if (office && words.length >= 2) {
        const half = Math.ceil(words.length / 2);
        label(c, words.slice(0, half).join(' '), 0, -ih / 2 + 5.5, 700, 6.2, 'display', ink, iw - 4);
        label(c, words.slice(half).join(' '), 0, -ih / 2 + 12.5, 700, 6.2, 'display', fin ? '#8a5a12' : ph(greenDeep(), 0.2), iw - 4);
      } else {
        label(c, top, 0, -ih / 2 + 6, 700, 7.4, 'display', ink, iw - 4);
      }
      drawFrog(c, 0, office ? 10 : 5, office ? 0.76 : 0.8, gear, fin);
      label(c, sub, 0, ih / 2 - (office ? 3.5 : 4.5), 600, office ? 4.2 : 4.8, 'body', fin ? '#6b4510' : '#4a3a2c', iw - 4);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.beginPath();
      c.moveTo(-iw / 2 + iw * 0.15, -ih / 2);
      c.lineTo(-iw / 2 + iw * 0.4, -ih / 2);
      c.lineTo(-iw / 2, ih / 2 - ih * 0.2);
      c.lineTo(-iw / 2, -ih / 2 + ih * 0.3);
      c.closePath();
      c.fill();
    }, 3);
  }

  // ---------- Котзилла ----------
  const KZ_SKIN = [
    [0x2e3440, 0x3f5a4c, 0x55606f],
    [0xc9773a, 0x7a4a24, 0xe6a36a],
    [0x7f8796, 0x4b5160, 0xb4bac6],
    [0x17181c, 0x2bb673, 0x34363d],
    [0xe9e1d2, 0x9a8f7c, 0xfffaf0],
    [0x3b6e5a, 0x1d8a52, 0x5d9b80],
    [0x5b4a86, 0x2bb673, 0x8a78b8],
  ];
  const KZ_ACC = [null, 'crown', 'shades', 'scarf', 'bow', 'headphones', null];
  const EYE_L = [-5, -68], EYE_R = [17, -68];
  function kzBody(c, col, spikeCol) {
    c.fillStyle = spikeCol;
    tri(c, -44, -28, -34, -46, -60, -52);
    tri(c, -34, -46, -24, -58, -46, -74);
    tri(c, 42, -28, 34, -46, 58, -52);
    tri(c, 34, -46, 26, -58, 48, -74);
    tri(c, -50, -10, -46, -28, -66, -26);
    c.fillStyle = col;
    ellipse(c, -2, -16, 46, 34);
    ellipse(c, 2, -44, 30, 18);
    ellipse(c, 6, -66, 30, 23);
    tri(c, -21, -76, -14, -100, -1, -84);
    tri(c, 13, -84, 27, -100, 33, -76);
    ellipse(c, 36, -8, 12, 8);
  }
  function kzFace(c, skin, eyes) {
    const [body, , light] = skin;
    c.fillStyle = ph(light, 0.15);
    ellipse(c, 0, -10, 26, 20);
    c.fillStyle = '#e8899a';
    tri(c, -16, -82, -13, -94, -6, -85);
    tri(c, 20, -85, 26, -94, 28, -82);
    for (const [ex, ey] of [EYE_L, EYE_R]) {
      if (eyes === 'wink' && ex === EYE_L[0]) {
        c.strokeStyle = '#111317';
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(ex - 6, ey + 0.5);
        c.quadraticCurveTo(ex, ey - 3.5, ex + 6, ey + 0.5);
        c.stroke();
        continue;
      }
      c.fillStyle = '#7dff9a';
      ellipse(c, ex, ey, 6.4, 4.6);
      c.fillStyle = '#0d1410';
      ellipse(c, ex, ey, 1.4, 4.2);
      c.fillStyle = 'rgba(255,255,255,0.85)';
      circle(c, ex + 2, ey - 1.6, 1);
    }
    c.fillStyle = '#e8899a';
    tri(c, 3, -60, 9, -60, 6, -56.5);
    c.strokeStyle = body === 0x17181c ? '#7f8796' : '#1b1d22';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(6, -56.5);
    c.quadraticCurveTo(3, -53, 0, -55);
    c.moveTo(6, -56.5);
    c.quadraticCurveTo(9, -53, 12, -55);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 0.6;
    c.beginPath();
    for (const s of [-1, 1]) {
      const bx = s < 0 ? -6 : 18;
      for (let j = -1; j <= 1; j++) {
        c.moveTo(bx, -58 + j * 2);
        c.lineTo(bx + s * 16, -60 + j * 4);
      }
    }
    c.stroke();
  }
  function kzAcc(c, acc) {
    if (acc === 'crown') {
      c.fillStyle = '#f6c945';
      c.beginPath();
      c.moveTo(-6, -86);
      c.lineTo(-7, -98);
      c.lineTo(0, -92);
      c.lineTo(6, -100);
      c.lineTo(12, -92);
      c.lineTo(19, -98);
      c.lineTo(18, -86);
      c.closePath();
      c.fill();
    } else if (acc === 'shades') {
      c.fillStyle = '#0d0e11';
      rr(c, -13, -72, 15, 9, 3);
      c.fill();
      rr(c, 10, -72, 15, 9, 3);
      c.fill();
      c.fillRect(2, -70, 8, 1.6);
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.fillRect(-10, -70.5, 4, 1.2);
      c.fillRect(13, -70.5, 4, 1.2);
    } else if (acc === 'scarf') {
      c.fillStyle = ph(green(), 0.2);
      rr(c, -24, -48, 56, 9, 4);
      c.fill();
      rr(c, 16, -44, 10, 22, 3);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      for (let x = -20; x < 30; x += 8) c.fillRect(x, -48, 2, 9);
    } else if (acc === 'bow') {
      c.fillStyle = '#ff6f9c';
      tri(c, 26, -84, 18, -92, 18, -78);
      tri(c, 26, -84, 34, -92, 34, -78);
      circle(c, 26, -84, 2.6);
    } else if (acc === 'headphones') {
      c.strokeStyle = '#1b1d22';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(6, -66, 28, Math.PI * 1.08, Math.PI * 1.92);
      c.stroke();
      c.fillStyle = ph(green(), 0.2);
      rr(c, -28, -72, 8, 16, 3);
      c.fill();
      rr(c, 32, -72, 8, 16, 3);
      c.fill();
    }
  }
  function kzHat(c, dim) {
    c.fillStyle = dim ? '#5e1a24' : '#d63a3a';
    c.beginPath();
    c.moveTo(-16, -84);
    c.quadraticCurveTo(4, -112, 30, -114);
    c.quadraticCurveTo(44, -112, 46, -98);
    c.quadraticCurveTo(38, -100, 30, -84);
    c.closePath();
    c.fill();
    c.fillStyle = dim ? '#8d8a94' : '#ffffff';
    rr(c, -20, -88, 54, 8, 4);
    c.fill();
    circle(c, 46, -97, 5);
  }
  const kzKeys = [];
  for (let v = 0; v < KZ_SKIN.length; v++) kzKeys.push(['kzP' + v, 'kzP' + v + 'w', 'kzP' + v + 'h', 'kzP' + v + 'wh']);
  function kzPoster(v, wink) {
    const key = kzKeys[v][(wink ? 1 : 0) + (day.hat ? 2 : 0)];
    const have = cache.get(key);
    if (have) return have;
    const w = 60, h = 76, pad = 6, b = 2.6;
    const d = data('kotzilla');
    const title = (d && d.title) || '';
    const skin = KZ_SKIN[v % KZ_SKIN.length], acc = KZ_ACC[v % KZ_ACC.length];
    return mk(key, w + pad * 2, h + pad * 2, w / 2 + pad, h / 2 + pad, (c, sp) => {
      c.save();
      kit.softShadow(c, sp, 5, 2.5, 0.3);
      c.fillStyle = kit.dark ? '#0b0b0e' : '#1d1f26';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.restore();
      const iw = w - b * 2, ih = h - b * 2, x0 = -iw / 2, y0 = -ih / 2;
      const g = c.createLinearGradient(0, y0, 0, y0 + ih);
      g.addColorStop(0, '#141a38');
      g.addColorStop(0.7, '#2f3a72');
      g.addColorStop(1, '#4b3f78');
      c.fillStyle = g;
      c.fillRect(x0, y0, iw, ih);
      c.save();
      c.beginPath();
      c.rect(x0, y0, iw, ih);
      c.clip();
      const r = kit.rng(77 + v);
      c.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 16; i++) circle(c, x0 + r() * iw, y0 + r() * ih * 0.5, 0.35 + r() * 0.4);
      c.fillStyle = '#f4f1e2';
      circle(c, x0 + iw * 0.8, y0 + 9, 4.2);
      const band = 11, cityTop = ih / 2 - band - 12;
      c.save();
      c.translate(2, ih / 2 - band - 2);
      c.scale(0.43, 0.43);
      kzBody(c, ph(skin[0], 0.1), ph(skin[1], 0.1));
      kzFace(c, skin, wink ? 'wink' : 'open');
      kzAcc(c, acc);
      if (day.hat) kzHat(c, false);
      c.restore();
      c.fillStyle = '#0e1226';
      for (let x = x0, i = 0; x < x0 + iw; i++) {
        const bw = 5 + r() * 7, bh = 6 + r() * 12;
        c.fillRect(x, cityTop + 12 - bh, bw, bh + 20);
        c.fillStyle = '#ffd27a';
        for (let yy = cityTop + 14 - bh; yy < cityTop + 10; yy += 3) if (r() < 0.4) c.fillRect(x + 1 + r() * (bw - 2), yy, 1, 1.2);
        c.fillStyle = '#0e1226';
        x += bw + 0.6;
      }
      c.fillStyle = '#0b0d14';
      c.fillRect(x0, ih / 2 - band, iw, band);
      c.restore();
      label(c, title, 0, ih / 2 - band / 2 + 0.3, 700, 8.6, 'display', ph(green(), 0.1), iw - 6);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.beginPath();
      c.moveTo(x0 + iw * 0.2, y0);
      c.lineTo(x0 + iw * 0.45, y0);
      c.lineTo(x0, y0 + ih * 0.7);
      c.lineTo(x0, y0 + ih * 0.3);
      c.closePath();
      c.fill();
    }, 3);
  }
  function kzShadow(dream) {
    const key = dream ? (day.hat ? 'kzDh' : 'kzD') : day.hat ? 'kzNh' : 'kzN';
    const have = cache.get(key);
    if (have) return have;
    const col = dream ? '#2a1f4a' : '#080a18';
    return mk(key, 140, 132, 70, 122, (c) => {
      kzBody(c, col, col);
      if (day.hat) kzHat(c, true);
    }, 1.5);
  }
  function kzEyes() {
    return cache.get('kzE') || mk('kzE', 64, 30, 26, 83, (c) => {
      for (const [ex, ey] of [EYE_L, EYE_R]) {
        const g = c.createRadialGradient(ex, ey, 0, ex, ey, 13);
        g.addColorStop(0, 'rgba(110,255,150,0.6)');
        g.addColorStop(1, 'rgba(110,255,150,0)');
        c.fillStyle = g;
        c.fillRect(ex - 13, ey - 13, 26, 26);
        c.fillStyle = '#86ffa2';
        ellipse(c, ex, ey, 6.2, 4.4);
        c.fillStyle = '#06110a';
        ellipse(c, ex, ey, 1.3, 4);
      }
    }, 1.5);
  }
  const kz = { v: 0, wink: -10 };
  function blinkK(t, seed) {
    const d = data('kotzilla');
    const every = (d && d.blinkEvery) || 6.5;
    const p = mod(t + seed * 1.7, every);
    return p < 0.9 ? Math.sin((p / 0.9) * Math.PI) : 0;
  }
  function drawGiant(ctx, x, base, s, a, dream, seed) {
    if (a < 0.02 || !(s > 0)) return;
    const body = kzShadow(dream), eyes = kzEyes();
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(s, s);
    ctx.globalAlpha = a;
    blit(ctx, body, 0, 0);
    const lid = blinkK(realT(), seed);
    ctx.globalAlpha = a * (dream ? 0.9 : 1);
    blit(ctx, eyes, 0, 0);
    if (lid > 0.02) {
      ctx.globalAlpha = a;
      ctx.fillStyle = dream ? '#2a1f4a' : '#080a18';
      ctx.fillRect(EYE_L[0] - 7, EYE_L[1] - 5, 14, 10 * lid);
      ctx.fillRect(EYE_R[0] - 7, EYE_R[1] - 5, 14, 10 * lid);
    }
    ctx.restore();
  }

  // ---------- сезонный декор ----------
  function pumpkin() {
    return cache.get('pump') || mk('pump', 26, 22, 13, 20, (c) => {
      c.fillStyle = '#4f7a2c';
      rr(c, -1.6, -19, 3.2, 5, 1.2);
      c.fill();
      c.fillStyle = ph(0xe8792a, 0.2);
      ellipse(c, -5, -8, 6.5, 7.5);
      ellipse(c, 5, -8, 6.5, 7.5);
      c.fillStyle = ph(0xf08d36, 0.2);
      ellipse(c, 0, -8, 7, 8);
      c.strokeStyle = 'rgba(120,50,10,0.35)';
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(-3.5, -15);
      c.quadraticCurveTo(-5.5, -8, -3.5, -1);
      c.moveTo(3.5, -15);
      c.quadraticCurveTo(5.5, -8, 3.5, -1);
      c.stroke();
      c.fillStyle = '#3a1a06';
      tri(c, -6, -11, -2.5, -11, -4.2, -8);
      tri(c, 6, -11, 2.5, -11, 4.2, -8);
      c.beginPath();
      c.moveTo(-6, -5.5);
      c.lineTo(-3, -4);
      c.lineTo(-1, -5.5);
      c.lineTo(1, -4);
      c.lineTo(3, -5.5);
      c.lineTo(6, -5.5);
      c.quadraticCurveTo(0, 0.5, -6, -5.5);
      c.closePath();
      c.fill();
    });
  }
  function balloons() {
    return cache.get('ball') || mk('ball', 44, 100, 22, 96, (c) => {
      const cols = [green(), 0xf4f1e6, greenDeep()];
      const pos = [[-9, -78], [9, -82], [0, -66]];
      c.strokeStyle = 'rgba(80,70,60,0.55)';
      c.lineWidth = 0.6;
      c.beginPath();
      for (const [bx, by] of pos) {
        c.moveTo(bx, by + 11);
        c.quadraticCurveTo(bx * 0.4 + 2, by + 40, 0, 0);
      }
      c.stroke();
      for (let i = 0; i < 3; i++) {
        const [bx, by] = pos[i];
        c.fillStyle = ph(cols[i], 0.2);
        ellipse(c, bx, by, 8.5, 10.5);
        tri(c, bx - 1.6, by + 11.5, bx + 1.6, by + 11.5, bx, by + 9);
        c.fillStyle = 'rgba(255,255,255,0.45)';
        ellipse(c, bx - 3, by - 4, 2, 3.4, 0.4);
      }
    });
  }
  function bunting() {
    const have = cache.get('bunt');
    if (have) return have;
    const d = data('birthday');
    const text = String((d && d.banner) || '');
    const chars = Array.from(text.replace(/[,.;:]/g, ''));
    const fw = 12, n = chars.length, w = Math.max(24, n * fw + 10);
    return mk('bunt', w, 26, w / 2, 4, (c) => {
      const x0 = -w / 2 + 5;
      c.strokeStyle = 'rgba(70,60,50,0.7)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(-w / 2, 0);
      c.quadraticCurveTo(0, 10, w / 2, 0);
      c.stroke();
      for (let i = 0; i < n; i++) {
        const ch = chars[i];
        if (ch === ' ') continue;
        const cx = x0 + i * fw + fw / 2, t = (cx + w / 2) / w, sag = 4 * t * (1 - t) * 10 * 0.5;
        c.fillStyle = ph(i % 2 ? 0xf4f1e6 : green(), 0.2);
        c.beginPath();
        c.moveTo(cx - fw / 2 + 0.6, sag);
        c.lineTo(cx + fw / 2 - 0.6, sag);
        c.lineTo(cx, sag + 14);
        c.closePath();
        c.fill();
        label(c, ch, cx, sag + 4.6, 700, 7, 'display', i % 2 ? ph(greenDeep(), 0.2) : '#ffffff', fw - 2);
      }
    });
  }
  const NY_BULBS = [0xe5484d, 0x2bb673, 0xf6c945, 0x4c8df0, 0xffffff];
  const NY_SPAN = 120;
  function nyGarland() {
    return cache.get('nyG') || mk('nyG', NY_SPAN, 24, 0, 3, (c) => {
      c.strokeStyle = kit.dark ? 'rgba(0,0,0,0.6)' : 'rgba(43,34,25,0.55)';
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(NY_SPAN / 2, 16, NY_SPAN, 0);
      c.stroke();
      for (let b = 0; b < 6; b++) {
        const t = (b + 0.5) / 6, u = 1 - t, bx = t * NY_SPAN, by = 2 * u * t * 16 + 3.6;
        c.fillStyle = '#3a3a3a';
        c.fillRect(bx - 0.8, by - 3.6, 1.6, 1.8);
        c.fillStyle = '#' + NY_BULBS[b % NY_BULBS.length].toString(16).padStart(6, '0');
        ellipse(c, bx, by, 1.9, 2.7);
        c.fillStyle = 'rgba(255,255,255,0.6)';
        circle(c, bx - 0.6, by - 0.9, 0.5);
      }
    });
  }
  function nyGlow(phase) {
    const key = phase ? 'nyGB' : 'nyGA';
    return cache.get(key) || mk(key, NY_SPAN, 40, 0, 12, (c) => {
      for (let b = phase; b < 6; b += 2) {
        const t = (b + 0.5) / 6, u = 1 - t, bx = t * NY_SPAN, by = 2 * u * t * 16 + 3.6;
        const n = NY_BULBS[b % NY_BULBS.length];
        const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
        const g = c.createRadialGradient(bx, by, 0, bx, by, 10);
        g.addColorStop(0, `rgba(${rgb},0.9)`);
        g.addColorStop(0.35, `rgba(${rgb},0.3)`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        c.fillStyle = g;
        c.fillRect(bx - 10, by - 10, 20, 20);
      }
    }, 1);
  }
  function drawNyGarland(ctx, sc, y, x0, x1) {
    const sp = nyGarland();
    for (let x = x0 - mod(sc + x0, NY_SPAN) - NY_SPAN; x < x1 + NY_SPAN; x += NY_SPAN) blit(ctx, sp, x, y);
  }
  function drawNyGlow(ctx, sc, y, x0, x1, a) {
    if (a < 0.01) return;
    const tw = G.calm ? 0.5 : 0.5 + 0.5 * Math.sin(realT() * 2.2);
    ctx.globalCompositeOperation = 'lighter';
    for (let ph2 = 0; ph2 < 2; ph2++) {
      const sp = nyGlow(ph2);
      ctx.globalAlpha = Math.min(1, a * (ph2 ? 1 - tw * 0.7 : 0.3 + tw * 0.7));
      for (let x = x0 - mod(sc + x0, NY_SPAN) - NY_SPAN; x < x1 + NY_SPAN; x += NY_SPAN) blit(ctx, sp, x, y);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  function tree() {
    return cache.get('tree') || mk('tree', 70, 132, 35, 110, (c, sp) => {
      c.fillStyle = ph(0xb5654a, 0.3);
      c.beginPath();
      c.moveTo(-11, 2);
      c.lineTo(11, 2);
      c.lineTo(8, 20);
      c.lineTo(-8, 20);
      c.closePath();
      c.fill();
      c.fillStyle = ph(0x6b4a33, 0.3);
      c.fillRect(-2.5, -8, 5, 10);
      const tiers = [[-6, 28, 30], [-30, 22, 30], [-52, 16, 26], [-72, 10, 22]];
      c.save();
      kit.softShadow(c, sp, 5, 2, 0.2);
      for (const [y, hw, hh] of tiers) {
        c.fillStyle = ph(0x2f7d4a, 0.3);
        c.beginPath();
        c.moveTo(-hw, y);
        c.quadraticCurveTo(0, y + 5, hw, y);
        c.lineTo(0, y - hh);
        c.closePath();
        c.fill();
      }
      c.restore();
      c.fillStyle = ph(0x3f9a5c, 0.3);
      for (const [y, hw, hh] of tiers) tri(c, 0, y - hh, hw * 0.55, y - 2, 0, y);
      const r = kit.rng(91);
      const cols = [0xe5484d, 0xf6c945, 0x4c8df0, 0xffffff, 0xe5484d];
      for (let i = 0; i < 12; i++) {
        const tier = tiers[i % 4], t = r();
        const by = tier[0] - t * tier[2] * 0.75, bw = tier[1] * (1 - t * 0.8);
        c.fillStyle = ph(cols[i % cols.length], 0.2);
        circle(c, (r() - 0.5) * bw * 1.6, by - 1, 1.9);
      }
      c.fillStyle = '#f6c945';
      c.beginPath();
      for (let p = 0; p < 10; p++) {
        const a = -Math.PI / 2 + (p * Math.PI) / 5, rr2 = p % 2 ? 2.6 : 6;
        c.lineTo(Math.cos(a) * rr2, -84 + Math.sin(a) * rr2);
      }
      c.closePath();
      c.fill();
    });
  }

  // ---------- офис: роутер, курьер, плакаты ----------
  function router(on) {
    const key = on ? 'rtOn' : 'rtOff';
    return cache.get(key) || mk(key, 34, 46, 17, 44, (c) => {
      c.strokeStyle = ph(0x3b3f47, 0.3);
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-9, -8);
      c.lineTo(-12, -20);
      c.moveTo(9, -8);
      c.lineTo(12, -20);
      c.stroke();
      c.fillStyle = ph(0xf4f5f3, 0.35);
      rr(c, -13, -9, 26, 9, 2.4);
      c.fill();
      c.fillStyle = 'rgba(0,0,0,0.15)';
      c.fillRect(-13, -1.4, 26, 1.4);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = on ? '#3ddc84' : i === 0 ? '#ff4d4d' : '#9aa0a6';
        circle(c, -8 + i * 4, -4.6, 0.9);
      }
      const col = on ? ph(green(), 0.15) : '#9aa0a6';
      c.strokeStyle = col;
      c.lineWidth = 1.6;
      for (let a = 0; a < 3; a++) {
        c.beginPath();
        c.arc(0, -24, 3 + a * 3.6, Math.PI * 1.25, Math.PI * 1.75);
        c.stroke();
      }
      c.fillStyle = col;
      circle(c, 0, -24, 1.4);
      if (!on) {
        c.strokeStyle = '#ff4d4d';
        c.lineWidth = 1.8;
        c.beginPath();
        c.moveTo(-8, -38);
        c.lineTo(8, -22);
        c.stroke();
      }
    });
  }
  const COUR_KEYS = ['cour0', 'cour1', 'cour2', 'cour3'];
  function courierFrame(f) {
    const key = COUR_KEYS[f & 3];
    return cache.get(key) || mk(key, 34, 46, 17, 42, (c) => {
      const sw = Math.sin((f / 4) * TAU);
      const jacket = '#3a4a5c', pants = '#2a2f38', skin = '#e9b892';
      c.strokeStyle = pants;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, -14);
      c.lineTo(6 * sw, -6);
      c.lineTo(8 * sw - 1, 0);
      c.moveTo(0, -14);
      c.lineTo(-6 * sw, -6);
      c.lineTo(-8 * sw - 1, 0);
      c.stroke();
      c.fillStyle = jacket;
      rr(c, -4.5, -27, 9, 14, 3);
      c.fill();
      c.fillStyle = ph(0xe8a33d, 0.2);
      rr(c, -15, -30, 11, 12, 1.5);
      c.fill();
      c.fillStyle = 'rgba(0,0,0,0.2)';
      c.fillRect(-15, -25, 11, 1.2);
      c.strokeStyle = jacket;
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(1, -24);
      c.lineTo(5 + 3 * sw, -18);
      c.lineTo(9 + 2 * sw, -17);
      c.stroke();
      c.fillStyle = '#f2ead9';
      rr(c, 6 + 2 * sw, -19, 7, 8, 1);
      c.fill();
      c.strokeStyle = 'rgba(200,200,200,0.8)';
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(-11, -32);
      c.quadraticCurveTo(-13, -35, -10.5, -38);
      c.moveTo(-7, -32);
      c.quadraticCurveTo(-9, -35, -6.5, -38);
      c.stroke();
      c.fillStyle = skin;
      circle(c, 1, -31, 4);
      c.fillStyle = ph(green(), 0.2);
      c.beginPath();
      c.arc(1, -32, 4.4, Math.PI, TAU);
      c.closePath();
      c.fill();
      c.fillRect(1, -33, 6, 1.6);
    });
  }
  function halloweenPoster() {
    return cache.get('hwP') || mk('hwP', 64, 84, 32, 42, (c, sp) => {
      const d = data('halloween');
      const lines = (d && d.poster) || [];
      c.save();
      kit.softShadow(c, sp, 3, 1.5, 0.22);
      c.fillStyle = '#1c1426';
      c.fillRect(-26, -36, 52, 72);
      c.restore();
      c.fillStyle = '#f08d36';
      c.fillRect(-26, -36, 52, 3);
      label(c, lines[0] || '', 0, -27, 700, 6.6, 'display', '#f08d36', 46);
      blit(c, pumpkin(), 0, 6);
      label(c, lines[1] || '', 0, 17, 700, 8.6, 'display', '#ffffff', 46);
      label(c, lines[2] || '', 0, 27, 700, 8.6, 'display', '#ffffff', 46);
    });
  }

  // ---------- крыша ----------
  function mangal() {
    return cache.get('mang') || mk('mang', 64, 52, 32, 48, (c) => {
      const iron = ph(0x26282d, 0.25);
      c.strokeStyle = iron;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-20, -20);
      c.lineTo(-23, 0);
      c.moveTo(20, -20);
      c.lineTo(23, 0);
      c.moveTo(-10, -20);
      c.lineTo(-11, 0);
      c.moveTo(10, -20);
      c.lineTo(11, 0);
      c.stroke();
      c.fillStyle = iron;
      c.beginPath();
      c.moveTo(-26, -32);
      c.lineTo(26, -32);
      c.lineTo(22, -18);
      c.lineTo(-22, -18);
      c.closePath();
      c.fill();
      c.fillStyle = '#ff7a2c';
      for (let i = 0; i < 9; i++) circle(c, -20 + i * 5, -32.5, 1.6);
      c.fillStyle = '#ffd36b';
      for (let i = 0; i < 5; i++) circle(c, -16 + i * 8, -33, 0.9);
      for (let s = 0; s < 3; s++) {
        const y = -36 - s * 0.6, x = -14 + s * 14;
        c.strokeStyle = '#b9bec4';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x - 3, y + 4);
        c.lineTo(x + 3, y - 10);
        c.stroke();
        for (let m = 0; m < 3; m++) {
          c.fillStyle = m === 1 ? '#f1e3c4' : '#8a4a2a';
          rr(c, x - 3 + m * 1.6, y - 1 - m * 4, 4.4, 3.6, 1.2);
          c.fill();
        }
      }
    });
  }
  function garden() {
    return cache.get('gard') || mk('gard', 84, 40, 42, 36, (c) => {
      const wood = ph(0x9a6a42, 0.3);
      c.fillStyle = wood;
      c.fillRect(-38, -12, 76, 12);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(-38, -6.5, 76, 1);
      c.fillStyle = ph(0x5a3c25, 0.3);
      c.fillRect(-38, -13.5, 76, 2.4);
      const r = kit.rng(55);
      for (let i = 0; i < 7; i++) {
        const x = -32 + i * 10.6;
        for (let l = 0; l < 4; l++) {
          c.fillStyle = l % 2 ? ph(0x4fa84a, 0.25) : ph(0x3a8a3c, 0.25);
          ellipse(c, x + (l - 1.5) * 2.4, -18 - r() * 6, 2.2, 6, (l - 1.5) * 0.45);
        }
      }
    });
  }
  function pool() {
    return cache.get('pool') || mk('pool', 120, 44, 50, 40, (c) => {
      c.fillStyle = ph(0x3f86c8, 0.25);
      c.fillRect(-46, -26, 92, 26);
      c.fillStyle = ph(0x6fb3e8, 0.25);
      for (let x = -46; x < 46; x += 11.5) c.fillRect(x, -26, 1.2, 26);
      c.fillStyle = ph(0xf4f5f3, 0.3);
      c.fillRect(-48, -29, 96, 4);
      c.fillStyle = ph(0x9fd8f5, 0.2);
      c.beginPath();
      for (let x = -44; x <= 44; x += 8) c.arc(x, -29, 4, Math.PI, TAU);
      c.fill();
      c.strokeStyle = '#c3c9cf';
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(48, 0);
      c.lineTo(48, -36);
      c.quadraticCurveTo(48, -40, 44, -40);
      c.moveTo(55, 0);
      c.lineTo(55, -36);
      c.quadraticCurveTo(55, -40, 51, -40);
      for (let y = -6; y > -34; y -= 7) {
        c.moveTo(48, y);
        c.lineTo(55, y);
      }
      c.stroke();
    });
  }
  function lounge() {
    return cache.get('lnge') || mk('lnge', 96, 44, 44, 40, (c) => {
      const legs = ph(0x4f5359, 0.25), cloth = ph(green(), 0.25);
      for (const dx of [-34, 4]) {
        c.strokeStyle = legs;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(dx - 4, 0);
        c.lineTo(dx + 4, -11);
        c.moveTo(dx + 14, 0);
        c.lineTo(dx + 8, -11);
        c.moveTo(dx + 26, 0);
        c.lineTo(dx + 22, -14);
        c.stroke();
        c.fillStyle = cloth;
        c.beginPath();
        c.moveTo(dx - 6, -11);
        c.lineTo(dx + 16, -11);
        c.lineTo(dx + 30, -32);
        c.lineTo(dx + 25, -34);
        c.lineTo(dx + 13, -16);
        c.lineTo(dx - 6, -16);
        c.closePath();
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.55)';
        for (let x = dx - 3; x < dx + 13; x += 5) c.fillRect(x, -16, 2.2, 5);
      }
    });
  }
  function roofBanner() {
    return cache.get('rbn') || mk('rbn', 250, 24, 125, 12, (c) => {
      const d = data('roofBanner');
      const text = (d && d.text) || '';
      c.strokeStyle = 'rgba(40,30,20,0.6)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(-124, -9);
      c.lineTo(-114, -7);
      c.moveTo(124, -9);
      c.lineTo(114, -7);
      c.stroke();
      c.fillStyle = ph(0xf7f5ef, 0.35);
      c.fillRect(-115, -8, 230, 16);
      c.fillStyle = ph(green(), 0.25);
      c.fillRect(-115, -8, 230, 2);
      c.fillRect(-115, 6, 230, 2);
      label(c, text, 0, 0.4, 700, 8.6, 'display', ph(greenDeep(), 0.2), 222);
    });
  }
  const BURST_KEYS = ['brst0', 'brst1', 'brst2'];
  function burst(n) {
    const i = mod(n, 3), key = BURST_KEYS[i];
    return cache.get(key) || mk(key, 80, 80, 40, 40, (c) => {
      const cols = [['#5dff9a', '#c9ffdc'], ['#ffd36b', '#fff2c4'], ['#ffffff', '#a6e8c2']][i];
      const rays = 18;
      for (let r = 0; r < rays; r++) {
        const a = (r / rays) * TAU + i * 0.3;
        for (let k = 0; k < 4; k++) {
          const d = 14 + k * 7.5;
          c.fillStyle = k === 3 ? cols[1] : cols[0];
          circle(c, Math.cos(a) * d, Math.sin(a) * d, 2.1 - k * 0.35);
        }
      }
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 14);
      g.addColorStop(0, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(-14, -14, 28, 28);
    }, 1);
  }
  function drawSalute(ctx, x0, x1, top, bottom, size) {
    const t = realT(), period = G.calm ? 3.4 : 2.2;
    const n = G.calm ? 2 : 3;
    ctx.globalCompositeOperation = 'lighter';
    for (let j = 0; j < n; j++) {
      const phase = t + j * (period / n);
      const cyc = Math.floor(phase / period), p = (phase - cyc * period) / period;
      if (p > 0.8) continue;
      const hx = x0 + (0.12 + 0.76 * kit.hash(cyc * 3 + j, 701)) * (x1 - x0);
      const hy = top + (0.1 + 0.45 * kit.hash(cyc * 3 + j, 702)) * (bottom - top);
      const e = 1 - Math.pow(1 - Math.min(1, p / 0.35), 3);
      const a = p < 0.35 ? 1 : 1 - (p - 0.35) / 0.45;
      const r = size * (0.25 + 0.75 * e);
      ctx.globalAlpha = clamp01(a);
      ctx.drawImage(burst(cyc + j).c, hx - r, hy - r + p * 10, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  const salute = { on: false, toasted: false };
  const saluteVisible = () => {
    if (!day.may9 || G.state.mode === 'start') return false;
    const d = data('may9');
    const clock = G.scene ? G.scene.clock : G.clockMin();
    return !!d && clock >= d.saluteFrom && clock < d.saluteTo;
  };

  // ---------- состояние офиса ----------
  let wifiDead = false;
  const courier = { inst: null, show: false, t0: 0, dur: 3.8, force: -1 };

  // ---------- точки расширения сцены ----------
  kit.hook('living.spot', (ctx, x, y, w, h) => {
    if (!kit.S.ready || !data('kotzilla')) return undefined;
    fresh();
    const wink = realT() < kz.wink;
    const sp = kzPoster(kz.v, wink);
    const s = w / 60;
    ctx.drawImage(sp.c, x - sp.ox * s, y - sp.oy * s, sp.w * s, sp.h * s);
    if (G.state.mode === 'start') kit.anchor('kotzilla', x, y, w, h);
    return true;
  });
  kit.hook('living.art', (k) => {
    if (!day.wed || k < 1) return undefined;
    const f = data('frog'), every = (f && f.livingEvery) || 6;
    if (k % every !== 1) return undefined;
    fresh();
    return frogPoster(false) || undefined;
  });
  kit.hook('living.plant', (ctx, x, bt) => {
    if (!day.newYear) return undefined;
    fresh();
    blit(ctx, tree(), x, bt);
    return true;
  });
  kit.hook('living.macro', (ctx, m) => {
    if (!(day.halloween || day.november)) return undefined;
    fresh();
    if (day.halloween) {
      const p = pumpkin(), half = m.gw / 2;
      blit(ctx, p, m.wcx - half + 12, m.sill);
      ctx.save();
      ctx.translate(m.wcx + half - 14, m.sill);
      ctx.scale(0.75, 0.75);
      blit(ctx, p, 0, 0);
      ctx.restore();
    }
    if (day.november) {
      const side = m.lampX >= m.wcx ? 1 : -1;
      blit(ctx, balloons(), m.lampX + side * 30, m.bt + 6);
      const winTop = Math.max(-26, m.bt - 230);
      blit(ctx, bunting(), m.wcx, Math.max(3, winTop + 4));
    }
    return undefined;
  });
  kit.hook('living.glow', (ctx, m) => {
    if (!day.halloween) return undefined;
    const lamp = kit.F.lamp || 0;
    if (lamp < 0.02) return undefined;
    fresh();
    const g = glowDisc('pumpG', '255,150,50', 22), half = m.gw / 2;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, lamp * 0.8);
    ctx.drawImage(g.c, m.wcx - half + 12 - 18, m.sill - 8 - 18, 36, 36);
    ctx.drawImage(g.c, m.wcx + half - 14 - 14, m.sill - 6 - 14, 28, 28);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    return undefined;
  });
  kit.hook('living.garland', (ctx, m, wallSc) => {
    if (!day.newYear) return undefined;
    fresh();
    drawNyGarland(ctx, wallSc, m.garland ? m.garY : 2, -kit.M, G.W + kit.M);
    return true;
  });
  kit.hook('living.garlandGlow', (ctx, m, wallSc, lit) => {
    if (!day.newYear) return undefined;
    fresh();
    drawNyGlow(ctx, wallSc, m.garland ? m.garY : 2, -kit.M, G.W + kit.M, 0.25 + 0.75 * lit);
    return true;
  });

  kit.hook('office.posters', () => {
    const d = data('officePosters');
    return d && Array.isArray(d.posters) && d.posters.length ? d.posters : undefined;
  });
  kit.hook('office.kanban', () => {
    const d = data('kanban');
    return d && Array.isArray(d.heads) && d.heads.length === 3 ? d.heads : undefined;
  });
  kit.hook('office.poster', (ctx, x, y, i, p) => {
    if (day.wed && p === 0) {
      fresh();
      const sp = frogPoster(true);
      if (!sp) return undefined;
      blit(ctx, sp, x, y + 38);
      return true;
    }
    if (day.halloween && p === 3 && data('halloween')) {
      fresh();
      blit(ctx, halloweenPoster(), x, y + 38);
      return true;
    }
    return undefined;
  });
  kit.hook('office.desk', (ctx, x, y, i) => {
    const j = mod(i, 4);
    if (j === 1) {
      fresh();
      const sp = router(!wifiDead);
      blit(ctx, sp, x, y);
      if (wifiDead && !G.calm && Math.sin(realT() * 5) > 0) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ff4d4d';
        circle(ctx, x - 8, y - 4.6, 2);
        ctx.globalAlpha = 1;
      }
      return true;
    }
    if (j === 3 && (day.november || day.halloween || day.newYear)) {
      fresh();
      if (day.november) blit(ctx, balloons(), x, y);
      else if (day.halloween) blit(ctx, pumpkin(), x, y);
      else {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(0.42, 0.42);
        blit(ctx, tree(), 0, -18);
        ctx.restore();
      }
      return true;
    }
    return undefined;
  });
  kit.hook('office.window', (ctx, L, base) => {
    const d = data('courier');
    if (!d) return undefined;
    if (L.inst !== courier.inst || courier.force >= 0) {
      courier.inst = L.inst;
      courier.show = courier.force >= 0 || Math.random() < (Number.isFinite(d.chance) ? d.chance : 0.5);
      courier.t0 = L.t + (courier.force >= 0 ? courier.force : 1.5 + Math.random() * 4);
      courier.force = -1;
    }
    if (!courier.show) return undefined;
    const p = (L.t - courier.t0) / courier.dur;
    if (p < 0 || p > 1) return undefined;
    fresh();
    const f = G.calm ? 0 : Math.floor(L.t * 9) & 3;
    blit(ctx, courierFrame(f), -30 + (L.W + 60) * p, base - 5);
    return undefined;
  });
  kit.decor('office', 'wall', (ctx, L) => {
    if (!(day.november || day.newYear)) return;
    fresh();
    const GR = L.GR;
    if (day.november) {
      const sp = bunting();
      slots(L, 0.45, 320, sp.w, (i, x) => blit(ctx, sp, x + 160, GR - 228));
    }
    if (day.newYear) drawNyGarland(ctx, L.u * 0.7 - runX(), 12, L.x0, L.x1);
  });
  kit.decor('office', 'emissive', (ctx, L) => {
    if (!day.newYear) return;
    fresh();
    drawNyGlow(ctx, L.u * 0.7 - runX(), 12, L.x0, L.x1, 0.5);
  });

  kit.hook('kitchen.note', () => {
    const d = data('kitchenNote');
    return d && d.l1 ? d : undefined;
  });
  kit.hook('metro.ads', (ads) => {
    const d = data('metroAd');
    if (!d || !Array.isArray(ads) || !Array.isArray(d.lines)) return undefined;
    const out = ads.slice();
    const i = Math.min(out.length - 1, Math.max(0, d.replace | 0));
    out[i] = { band: d.band, head: d.head, lines: d.lines, foot: d.foot, icon: d.icon };
    return out;
  });

  kit.hook('roof.slot', (ctx, x, y, i, silA) => {
    if (!data('roof')) return undefined;
    const j = mod(i, 10);
    let sp = null, key = '';
    if (j === 0 || (j === 8 && day.may9)) {
      sp = mangal();
      key = 'mangS';
    } else if (j === 4 && day.garden) {
      sp = garden();
      key = 'gardS';
    } else if (j === 5 && day.pool) {
      sp = pool();
      key = 'poolS';
    } else if (j === 6) {
      sp = lounge();
      key = 'lngeS';
    }
    if (!sp) return undefined;
    fresh();
    blit(ctx, sp, x, y);
    if (silA > 0.01) {
      ctx.globalAlpha = silA;
      blit(ctx, cache.get(key) || silhouetteOf(key, sp, kit.dark ? '#14121c' : '#2a2436'), x, y);
      ctx.globalAlpha = 1;
    }
    if (sp === mangal()) kit.pushEmitter('steam', x, G.GROUND - (y - 40), 1.4);
    return true;
  });
  kit.decor('roof', 'ground', (ctx, L) => {
    if (!data('roofBanner')) return;
    fresh();
    const sp = roofBanner();
    slots(L, 1, 1700, sp.w, (i, x) => blit(ctx, sp, x + 500, L.GR + 20));
  });
  kit.decor('roof', 'bg', (ctx, L) => {
    if (!saluteVisible()) return;
    fresh();
    drawSalute(ctx, L.x0, L.x1, 10, L.GR - 130, 36);
  });

  kit.hook('bedroom.window', (ctx, gx, gy, gw, gh, i) => {
    const F = kit.F || {};
    const d = data('kotzilla');
    const salut = saluteVisible();
    const night = smooth(clamp01(((F.night || 0) - 0.2) / 0.5));
    const giant = !!d && night > 0.02 && kit.hash(i, 911) < (Number.isFinite(d.windowChance) ? d.windowChance : 0.65);
    if (!giant && !salut) return undefined;
    fresh();
    ctx.beginPath();
    ctx.rect(gx, gy, gw, gh);
    ctx.clip();
    if (salut) drawSalute(ctx, gx, gx + gw, Math.max(gy, 6), gy + gh * 0.72, 18);
    if (giant) {
      const s = Math.min(gh * 0.8, gw * 0.95) / 112;
      drawGiant(ctx, gx + gw * 0.58, gy + gh + 2, s, night * 0.97, false, i);
    }
    return undefined;
  });
  kit.hook('bedroom.sill', (ctx, x, sill) => {
    if (!day.halloween) return undefined;
    fresh();
    blit(ctx, pumpkin(), x - 40, sill);
    return undefined;
  });
  kit.hook('bedroom.garland', (ctx, sc, y, x0, x1) => {
    if (!day.newYear) return undefined;
    fresh();
    drawNyGarland(ctx, sc, y, x0, x1);
    return true;
  });
  kit.hook('bedroom.garlandGlow', (ctx, sc, y, x0, x1, a) => {
    if (!day.newYear) return undefined;
    fresh();
    drawNyGlow(ctx, sc, y, x0, x1, Math.max(0.3, a));
    return true;
  });
  kit.decor('dream', 'bg', (ctx, L) => {
    const d = data('kotzilla');
    if (!d) return;
    fresh();
    const span = L.W + 760;
    const x = mod(L.W * 0.62 - L.u * 0.02 + 380, span) - 380;
    if (x < L.x0 - 380 || x > L.x1 + 380) return;
    const s = Math.max(2.3, Math.min(2.8, (L.GR - 40) / 95));
    drawGiant(ctx, x, L.GR + 8, s, 0.4, true, 3);
  });

  // ---------- события ----------
  G.on('kts:day', readDay);
  readDay();
  G.on('kts:event', (e) => {
    if (e && e.id === 'wifi') wifiDead = e.phase === 'start';
  });
  G.on('kts:poke', (e) => {
    if (e && e.id === 'kotzilla') pokeKotzilla(e.n);
  });
  G.on('kts:secret', (e) => {
    if (e && e.id === 'kotzilla') kz.wink = realT() + 1.4;
  });
  function pokeKotzilla(n) {
    const d = data('kotzilla');
    const total = (d && d.variants) || KZ_SKIN.length;
    const v = mod(Number.isFinite(n) ? Math.floor(n) : kz.v + 1, Math.min(total, KZ_SKIN.length));
    if (v !== kz.v) for (const key of kzKeys[kz.v]) dropKey(key);
    kz.v = v;
    return v;
  }
  G.ktsWorld = {
    kotzilla: (n) => pokeKotzilla(n),
    wink: (sec) => { kz.wink = realT() + (Number.isFinite(sec) ? sec : 1.4); },
    courier: (delay) => { courier.force = Number.isFinite(delay) ? Math.max(0, delay) : 0; },
    get wifiDead() { return wifiDead; },
    day,
  };

  function setSalute(on) {
    if (on === salute.on) return;
    salute.on = on;
    G.emit('kts:event', { id: 'may9', phase: on ? 'start' : 'end' });
  }
  G.on('start', () => {
    wifiDead = false;
    salute.toasted = false;
    setSalute(false);
    courier.inst = null;
  });
  G.on('die', () => setSalute(false));
  G.onUpdate(() => {
    if (!day.may9 || G.state.mode !== 'run') return;
    const d = data('may9');
    if (!d) return;
    const loc = G.scene && G.scene.loc && G.scene.loc.id;
    setSalute(saluteVisible() && (loc === 'roof' || loc === 'bedroom'));
    const clock = G.clockMin();
    if (!salute.toasted && clock >= d.toastAt && clock < d.toastAt + 60) {
      salute.toasted = true;
      const text = K.line('world.may9.toast');
      if (text && G.ui && typeof G.ui.toast === 'function') G.ui.toast(d.label || '', text, { kind: 'kts' });
    }
  }, 92);
})();
