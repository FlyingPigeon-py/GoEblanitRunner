/* Кролик: внешний вид, анимации, скины. Физика — в core.js. Владелец — агент bunny. */
(() => {
  'use strict';
  const G = window.G;
  const { TAU, LAYER } = G;
  const PI = Math.PI;
  const { sin, cos, min, max, sqrt, exp, atan2, round } = Math;
  const { ellipse } = G.draw;

  G.skins = [
    { id: 'classic', name: 'Классика', desc: 'Тот самый кролик из мема' },
    { id: 'dust', name: 'Пыльный', desc: 'Серый, как понедельник' },
    { id: 'hoodie', name: 'Худи', desc: 'Униформа разработчика' },
    { id: 'headphones', name: 'Наушники', desc: 'Не беспокоить: фокус-мод' },
    { id: 'tie', name: 'Офисный', desc: 'Галстук и очки для созвона с заказчиком' },
    { id: 'shades', name: 'Кибер', desc: 'Пиксельные очки, deal with it' },
    { id: 'gold', name: 'Золотой', desc: 'Для тех, кто ебланил больше всех' },
  ];
  const KTS = G.kts && G.kts.enabled ? G.kts : null;
  const looks = Object.create(null);
  if (KTS) {
    for (const s of G.skins) {
      const look = KTS.get('skinLook', s.id);
      if (!look) continue;
      looks[s.id] = look;
      s.name = KTS.fmt(look.name) || s.name;
      s.desc = KTS.fmt(look.desc) || s.desc;
    }
    for (const def of KTS.all('skins')) {
      const name = KTS.fmt(def.name);
      if (!name || G.skins.some((s) => s.id === def.id)) continue;
      G.skins.push({ id: def.id, name, desc: KTS.fmt(def.desc) || '', legendary: !!def.legendary, tag: KTS.fmt(def.tag) || '' });
      looks[def.id] = def;
    }
  }
  const SKIN_IDS = new Set(G.skins.map((s) => s.id));

  const sat = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (v) => { v = sat(v); return v * v * (3 - 2 * v); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const approach = (v, target, k) => v + (target - v) * min(1, k);
  const easeOut3 = (x) => 1 - (1 - x) * (1 - x) * (1 - x);
  function bounceOut(x) {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  }

  let calm = !!G.calm;
  G.on('calm', (v) => { calm = !!v; });

  // ---------- цвет ----------
  function parseColor(str) {
    if (typeof str !== 'string') return null;
    const s = str.trim().toLowerCase();
    let m = /^#([0-9a-f]{3,8})$/.exec(s);
    if (m) {
      let h = m[1];
      if (h.length === 3 || h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      if (h.length !== 6 && h.length !== 8) return null;
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }
  const col = (str, fallback) => parseColor(str) || fallback;
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const rgba = (c, a = 1) => `rgba(${round(c[0])},${round(c[1])},${round(c[2])},${a})`;
  const WHITE = [255, 255, 255];

  const TIE_RED = '#cc3a2c', TIE_DARK = '#94231a', TIE_KNOT = '#b02f22';
  const FRAME = '#2a221c', LENS = 'rgba(205,232,255,0.24)';
  const PIXEL_BLACK = '#121212';
  const HP_DARK = '#2a2a31', HP_HI = '#62626f', HP_CUSH = '#3e3e48';
  const STRING = '#f3eee4', AGLET = '#b5ada0';
  const STAR = '#ffd23f', STAR_EDGE = '#a86c00';
  const SPARK = '#fffbe8';
  const FEVER_PINK = '#ff7ad9', SPIRAL_WHITE = '#fffdf7';
  const KTS_GREEN = [47, 174, 95];
  const DUCK_YELLOW = '#ffd23f', DUCK_HI = '#fff0a6', DUCK_LO = '#e3a414', DUCK_BEAK = '#ff9a1f', DUCK_EYE = '#1d1510';

  // ---------- геометрия: строится один раз, в локальных единицах (ступни в 0,0, морда вправо) ----------
  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const angDiff = (a, b) => atan2(sin(a - b), cos(a - b));
  const bump = (a, at, w) => { const d = angDiff(a, at) / w; return exp(-d * d); };
  const ellR = (rx, ry, a) => { const c = cos(a) / rx, s = sin(a) / ry; return 1 / sqrt(c * c + s * s); };

  // Пушистый контур: пучки шерсти, загнутые к хвосту (против движения).
  function fuzzBlob(p, cx, cy, rf, af, n, rand, sweep) {
    const step = TAU / n;
    const jit = [];
    for (let i = 0; i < n; i++) jit.push(0.55 + rand() * 0.45);
    const vr = (a) => rf(a) - af(a) * 0.35;
    p.moveTo(cx + vr(0), cy);
    for (let i = 0; i < n; i++) {
      const av = i * step, an = (i + 1) * step, am = av + step * 0.5;
      const at = am + sweep * step * sin(am);
      const amp = af(am) * jit[i];
      const rt = rf(at) + amp * 1.12;
      const a1 = av + step * 0.28, r1 = rf(a1) + amp * 0.2;
      const b0 = at - step * 0.09, rb0 = rf(b0) + amp * 0.78;
      const b1 = at + step * 0.1, rb1 = rf(b1) + amp * 0.72;
      const a2 = at + step * 0.26, r2 = rf(a2) - amp * 0.05;
      p.quadraticCurveTo(cx + cos(a1) * r1, cy + sin(a1) * r1, cx + cos(b0) * rb0, cy + sin(b0) * rb0);
      p.quadraticCurveTo(cx + cos(at) * rt, cy + sin(at) * rt, cx + cos(b1) * rb1, cy + sin(b1) * rb1);
      p.quadraticCurveTo(cx + cos(a2) * r2, cy + sin(a2) * r2, cx + cos(an) * vr(an), cy + sin(an) * vr(an));
    }
    p.closePath();
  }

  function strands(hi, lo, cx, cy, rf, n, rand, skipFace) {
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU;
      if (skipFace && cos(a) > 0.1) continue;
      const r = rf(a), r0 = r * (0.7 + rand() * 0.16), r1 = r * (0.92 + rand() * 0.06);
      const sw = 0.14 * sin(a);
      const am = a + sw * 0.35, a1 = a + sw, rm = (r0 + r1) * 0.5 + 0.5;
      const p = sin(a) < -0.3 ? hi : lo;
      p.moveTo(cx + cos(a) * r0, cy + sin(a) * r0);
      p.quadraticCurveTo(cx + cos(am) * rm, cy + sin(am) * rm, cx + cos(a1) * r1, cy + sin(a1) * r1);
    }
  }

  function arcAlong(p, cx, cy, rf, inset, a0, a1, n) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n, r = rf(a) - inset;
      if (i) p.lineTo(cx + cos(a) * r, cy + sin(a) * r);
      else p.moveTo(cx + cos(a) * r, cy + sin(a) * r);
    }
  }

  function earPath(p, L, w) {
    p.moveTo(-w * 0.8, 1.5);
    p.bezierCurveTo(-w * 1.15, -L * 0.4, -w * 0.75, -L * 0.92, 0, -L);
    p.bezierCurveTo(w * 0.8, -L * 0.92, w * 1.1, -L * 0.4, w * 0.75, 1.5);
    p.quadraticCurveTo(0, 3.5, -w * 0.8, 1.5);
    p.closePath();
  }
  function earInnerPath(p, L, w) {
    p.moveTo(-w * 0.2, -0.5);
    p.bezierCurveTo(-w * 0.55, -L * 0.4, -w * 0.3, -L * 0.8, w * 0.1, -L * 0.85);
    p.bezierCurveTo(w * 0.5, -L * 0.74, w * 0.58, -L * 0.36, w * 0.36, -0.5);
    p.closePath();
  }

  function pixelPath(rows, x0, y0, u, chars) {
    const p = new Path2D();
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (!chars.includes(row[c])) continue;
        let e = c;
        while (e + 1 < row.length && chars.includes(row[e + 1])) e++;
        p.rect(x0 + c * u, y0 + r * u, (e - c + 1) * u, u);
        c = e;
      }
    });
    return p;
  }

  const BODY_X = -3, BODY_Y = -20, HEAD_X = 15.5, HEAD_Y = -30;
  const PIVOT_X = 2, PIVOT_Y = -22;
  const NECK_X = 12, NECK_Y = -21;
  const EYE_X = 21, EYE_Y = -32.5, EYE_RX = 3.55, EYE_RY = 4.05;
  const HEAD_SCALE = 1.08;

  function buildGeo() {
    const R = seeded(1156);
    const g = {};
    const NP = () => new Path2D();

    const bodyRF = (a) => ellR(24.5, 20, a) * (1 - 0.05 * cos(a)) * (1 - 0.06 * max(0, sin(a)));
    const bodyAF = (a) => 0.5 + 0.8 * smooth((0.55 - sin(a)) / 0.6);
    g.body = NP();
    fuzzBlob(g.body, BODY_X, BODY_Y, bodyRF, bodyAF, 30, R, 0.35);
    g.bodyHi = NP();
    g.bodyLo = NP();
    strands(g.bodyHi, g.bodyLo, BODY_X, BODY_Y, bodyRF, 46, R, false);
    g.bodyRim = NP();
    arcAlong(g.bodyRim, BODY_X, BODY_Y, bodyRF, 2.4, -2.75, -1.3, 14);
    g.haunch = NP();
    g.haunch.ellipse(-13, -11, 10, 9, 0, -2.3, -0.35);
    g.bodySmooth = NP();
    g.bodySmooth.ellipse(-3, -19.8, 25.6, 20.4, 0, 0, TAU);

    const headRF = (a) => ellR(14.5, 13.5, a) + 3.2 * bump(a, 0.4, 0.5) + 2 * bump(a, 2.0, 0.45) - 0.8 * bump(a, -1.3, 0.5);
    const headAF = (a) => 0.18 + 1.25 * smooth((0.3 - cos(a)) / 0.8) + 0.8 * bump(a, 2.15, 0.4);
    g.head = NP();
    fuzzBlob(g.head, HEAD_X, HEAD_Y, headRF, headAF, 26, R, 0.3);
    g.headHi = NP();
    g.headLo = NP();
    strands(g.headHi, g.headLo, HEAD_X, HEAD_Y, headRF, 26, R, true);
    g.chin = NP();
    arcAlong(g.chin, HEAD_X, HEAD_Y, headRF, 1.7, 1.15, 2.35, 10);

    const tailRF = () => 6.6;
    g.tail = NP();
    fuzzBlob(g.tail, -27.5, -19, tailRF, () => 1.7, 13, R, 0.15);
    g.tailHi = NP();
    g.tailLo = NP();
    strands(g.tailHi, g.tailLo, -27.5, -19, tailRF, 9, R, false);

    g.foot = NP();
    fuzzBlob(g.foot, 9.6, -1.9, (a) => ellR(10.4, 3.9, a), (a) => 0.7 * max(0, -sin(a)), 12, R, 0.5);
    g.toes = NP();
    g.toes.moveTo(16.6, -4.7);
    g.toes.quadraticCurveTo(17.5, -3, 17.1, -1.1);
    g.toes.moveTo(13.8, -5.2);
    g.toes.quadraticCurveTo(14.7, -3.3, 14.3, -1.2);
    g.paw = NP();
    fuzzBlob(g.paw, 2, 0.6, (a) => ellR(5.3, 3.3, a), (a) => 0.4 * max(0, -sin(a)), 9, R, 0.4);

    g.ear = NP();
    earPath(g.ear, 17, 6.2);
    g.earIn = NP();
    earInnerPath(g.earIn, 17, 6.2);

    g.nose = NP();
    g.nose.moveTo(30.3, -28.6);
    g.nose.quadraticCurveTo(31.6, -29.6, 32.8, -28.4);
    g.nose.quadraticCurveTo(32.5, -26.9, 31.3, -26.7);
    g.nose.quadraticCurveTo(30.2, -27.1, 30.3, -28.6);
    g.nose.closePath();
    g.mouth = NP();
    g.mouth.moveTo(31.3, -26.6);
    g.mouth.quadraticCurveTo(31.5, -24.8, 30.1, -24.2);
    g.mouth.quadraticCurveTo(29.2, -23.9, 28.7, -24.6);
    g.whiskers = NP();
    g.whiskers.moveTo(29.6, -25.6);
    g.whiskers.quadraticCurveTo(34, -27.6, 38.6, -28.4);
    g.whiskers.moveTo(29.9, -24.9);
    g.whiskers.quadraticCurveTo(34.5, -25.4, 39.2, -25.1);
    g.whiskers.moveTo(29.5, -24.2);
    g.whiskers.quadraticCurveTo(34, -23.2, 38.2, -21.6);

    g.hood = NP();
    g.hood.moveTo(19.5, -44.5);
    g.hood.bezierCurveTo(10, -49.5, -1, -45, -1.5, -33);
    g.hood.bezierCurveTo(-2, -22, 4, -15.5, 12, -15);
    g.hood.lineTo(16.5, -15.5);
    g.hood.bezierCurveTo(11.5, -21, 11, -36, 19.5, -44.5);
    g.hood.closePath();
    g.hoodRim = NP();
    g.hoodRim.moveTo(16.5, -15.5);
    g.hoodRim.bezierCurveTo(11.5, -21, 11, -36, 19.5, -44.5);
    g.hoodRimIn = NP();
    g.hoodRimIn.moveTo(14.6, -16.2);
    g.hoodRimIn.bezierCurveTo(9.9, -21.5, 9.5, -35.5, 17.4, -44.4);
    g.earHoles = NP();
    g.earHoles.ellipse(11.4, -40.6, 3.4, 1.7, -0.5, 0, TAU);
    g.pocket = NP();
    g.pocket.moveTo(3, -15.5);
    g.pocket.quadraticCurveTo(8.5, -13.5, 10.5, -6.5);
    g.logo = NP();
    g.logo.moveTo(-9, -25.5); g.logo.lineTo(-11.2, -22.2); g.logo.lineTo(-9, -18.9);
    g.logo.moveTo(-5.4, -25.5); g.logo.lineTo(-7.6, -18.9);
    g.logo.moveTo(-4, -25.5); g.logo.lineTo(-1.8, -22.2); g.logo.lineTo(-4, -18.9);

    g.band = NP();
    g.band.moveTo(7.6, -37.3);
    g.band.quadraticCurveTo(9.5, -52.5, 23, -42);
    g.cup = NP();
    g.cup.ellipse(8.4, -30.8, 5.7, 7.3, -0.1, 0, TAU);
    g.cupRing = NP();
    g.cupRing.ellipse(8.4, -30.8, 4.3, 5.8, -0.1, 0, TAU);
    g.cupHi = NP();
    g.cupHi.ellipse(7.2, -33, 1.8, 2.6, -0.3, 0, TAU);
    g.cushion = NP();
    g.cushion.ellipse(12.6, -30.6, 2.1, 6.4, 0, 0, TAU);

    g.collar = NP();
    g.collar.moveTo(14.2, -18.2);
    g.collar.lineTo(19.8, -16.6);
    g.collar.lineTo(16.4, -13.4);
    g.collar.closePath();
    g.knot = NP();
    g.knot.moveTo(-2.1, -1.7);
    g.knot.lineTo(2.1, -1.7);
    g.knot.lineTo(1.4, 1.5);
    g.knot.lineTo(-1.4, 1.5);
    g.knot.closePath();
    g.tie = NP();
    g.tie.moveTo(-1.3, 1.1);
    g.tie.lineTo(-2.3, 7.6);
    g.tie.lineTo(0, 10.2);
    g.tie.lineTo(2.3, 7.6);
    g.tie.lineTo(1.3, 1.1);
    g.tie.closePath();
    g.tieStripes = NP();
    g.tieStripes.moveTo(-1.6, 4); g.tieStripes.lineTo(1.5, 2.9);
    g.tieStripes.moveTo(-2, 6.9); g.tieStripes.lineTo(2, 5.6);
    g.glasses = NP();
    const gx = 15.6, gy = -36.9, gw = 10.6, gh = 8.8, gr = 2.6;
    g.glasses.moveTo(gx + gr, gy);
    g.glasses.arcTo(gx + gw, gy, gx + gw, gy + gh, gr);
    g.glasses.arcTo(gx + gw, gy + gh, gx, gy + gh, gr);
    g.glasses.arcTo(gx, gy + gh, gx, gy, gr);
    g.glasses.arcTo(gx, gy, gx + gw, gy, gr);
    g.glasses.closePath();
    g.glassArms = NP();
    g.glassArms.moveTo(15.6, -34);
    g.glassArms.lineTo(9.2, -35.3);
    g.glassArms.moveTo(26.2, -33.6);
    g.glassArms.lineTo(28.4, -34.6);
    g.glare = NP();
    g.glare.moveTo(17.7, -29.6);
    g.glare.lineTo(20.3, -35.3);

    const SHADES = ['########', '#W####..', '##W###..', '######..', '.####...'];
    g.shadesBlack = pixelPath(SHADES, 14.6, -37.4, 1.6, '#W');
    g.shadesWhite = pixelPath(SHADES, 14.6, -37.4, 1.6, 'W');

    g.unit = NP();
    g.unit.arc(0, 0, 1, 0, TAU);
    g.star = NP();
    for (let i = 0; i < 10; i++) {
      const a = -PI / 2 + (i * PI) / 5, r = i % 2 ? 0.45 : 1;
      if (i) g.star.lineTo(cos(a) * r, sin(a) * r);
      else g.star.moveTo(cos(a) * r, sin(a) * r);
    }
    g.star.closePath();
    g.spark = NP();
    g.spark.moveTo(0, -1);
    g.spark.quadraticCurveTo(0.14, -0.14, 1, 0);
    g.spark.quadraticCurveTo(0.14, 0.14, 0, 1);
    g.spark.quadraticCurveTo(-0.14, 0.14, -1, 0);
    g.spark.quadraticCurveTo(-0.14, -0.14, 0, -1);
    g.spark.closePath();

    // Верх-перед тела закрыт головой, поэтому передний контур — на груди под подбородком.
    g.bodyRimFront = NP();
    arcAlong(g.bodyRimFront, BODY_X, BODY_Y, bodyRF, 2.4, 0.3, 0.85, 8);
    g.headRimBack = NP();
    arcAlong(g.headRimBack, HEAD_X, HEAD_Y, headRF, 1.6, -2.95, -2.4, 6);
    g.headRimFront = NP();
    arcAlong(g.headRimFront, HEAD_X, HEAD_Y, headRF, 1.6, -1.45, -0.4, 10);
    g.spiral = NP();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * 4 * PI, r = (i / 28) * 3.2;
      if (i) g.spiral.lineTo(cos(a) * r, sin(a) * r);
      else g.spiral.moveTo(0, 0);
    }
    if (KTS) buildKtsGeo(g);
    return g;
  }

  const RING_X = -1.5, RING_Y = -13, RING_RX = 28.5, RING_RY = 6.5, RING_W = 6.5;
  function buildKtsGeo(g) {
    const NP = () => new Path2D();
    g.ktsLogo = NP();
    g.ktsLogo.moveTo(-13.4, -25); g.ktsLogo.lineTo(-13.4, -19.4);
    g.ktsLogo.moveTo(-10.7, -25); g.ktsLogo.lineTo(-13.2, -22.2); g.ktsLogo.lineTo(-10.7, -19.4);
    g.ktsLogo.moveTo(-9.6, -25); g.ktsLogo.lineTo(-6, -25);
    g.ktsLogo.moveTo(-7.8, -25); g.ktsLogo.lineTo(-7.8, -19.4);
    g.ktsLogo.moveTo(-2.3, -24.5);
    g.ktsLogo.bezierCurveTo(-3, -25.4, -5, -25.3, -5, -23.8);
    g.ktsLogo.bezierCurveTo(-5, -22.3, -2.3, -22.6, -2.3, -21);
    g.ktsLogo.bezierCurveTo(-2.3, -19.3, -4.6, -19.1, -5.3, -20.1);

    g.briefs = NP();
    g.briefs.moveTo(-36, -25.5);
    g.briefs.quadraticCurveTo(-8, -21, 23, -6.5);
    g.briefs.lineTo(23, 4);
    g.briefs.lineTo(-36, 4);
    g.briefs.closePath();
    g.briefs.ellipse(-9, -3.5, 12.5, 8.5, 0, 0, TAU);
    g.waist = NP();
    g.waist.moveTo(-36, -25.5);
    g.waist.quadraticCurveTo(-8, -21, 23, -6.5);
    g.legHem = NP();
    g.legHem.ellipse(-9, -3.5, 12.5, 8.5, 0, PI, TAU);

    g.ring = NP();
    g.ring.ellipse(RING_X, RING_Y, RING_RX, RING_RY, 0, 0, TAU);
    g.ringFront = NP();
    g.ringFront.ellipse(RING_X, RING_Y, RING_RX, RING_RY, 0, 0, PI);
    g.duckTail = NP();
    g.duckTail.moveTo(-30.5, -15.5);
    g.duckTail.lineTo(-35.5, -20);
    g.duckTail.lineTo(-28.5, -18);
    g.duckTail.closePath();
    g.duckHead = NP();
    g.duckHead.arc(29.5, -18.2, 4.6, 0, TAU);
    g.beak = NP();
    g.beak.ellipse(34.4, -17.6, 2.8, 1.6, 0.1, 0, TAU);
  }
  const geo = buildGeo();

  // ---------- палитры и градиенты: по одной на скин, сбрасываются при смене темы ----------
  let gradCtx = null;
  function getGradCtx() {
    if (!gradCtx) {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 1;
        gradCtx = c.getContext('2d');
      } catch (e) {}
      if (!gradCtx) gradCtx = G.ctx;
    }
    return gradCtx;
  }
  function radial(gc, x0, y0, r0, x1, y1, r1, stops) {
    const g = gc.createRadialGradient(x0, y0, r0, x1, y1, r1);
    for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    return g;
  }
  function linear(gc, x0, y0, x1, y1, stops) {
    const g = gc.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    return g;
  }

  const palCache = new Map();
  G.on('theme', () => palCache.clear());

  function palette(id) {
    const key = SKIN_IDS.has(id) ? id : 'classic';
    let pal = palCache.get(key);
    if (!pal) {
      pal = buildPalette(key);
      palCache.set(key, pal);
    }
    return pal;
  }

  function buildPalette(id) {
    const C = G.C, dark = G.isDark(), gc = getGradCtx();
    let fur = col(C.bunny, [253, 252, 249]);
    let lo = col(C['bunny-lo'], [217, 212, 202]);
    let patch = mix(lo, [88, 80, 72], 0.5);
    let pink = col(C.pink, [240, 163, 173]);
    let eye = [29, 21, 16];
    let hiK = 0.85;
    let line = dark ? [8, 6, 4] : [94, 72, 52];
    let rim = dark ? [214, 226, 255] : WHITE;
    if (id === 'dust') {
      fur = dark ? [170, 163, 152] : [196, 189, 178];
      lo = dark ? [116, 109, 99] : [146, 138, 127];
      patch = dark ? [76, 70, 63] : [96, 89, 81];
      pink = mix(pink, fur, 0.25);
      hiK = 0.45;
    } else if (id === 'gold') {
      fur = [246, 198, 78];
      lo = [194, 132, 32];
      patch = [168, 108, 28];
      pink = [242, 146, 112];
      eye = [50, 28, 6];
      hiK = 0.62;
      line = dark ? [24, 13, 2] : [116, 72, 10];
      rim = [255, 243, 192];
    }
    const hi = mix(fur, WHITE, hiK);
    const shade = mix(fur, lo, 0.5);
    const bottom = mix(lo, col(C.seat, [203, 176, 137]), 0.28);
    const sh = dark ? [0, 0, 0] : [74, 50, 24], shA = dark ? 0.5 : 0.3;
    const pal = {
      id,
      outline: rgba(line, dark ? 0.82 : 0.62),
      body: radial(gc, 5, -37, 2, 3, -30, 38, [0, rgba(hi), 0.32, rgba(fur), 0.72, rgba(mix(fur, lo, 0.55)), 1, rgba(bottom)]),
      head: radial(gc, 21, -39, 1, 17, -32, 21, [0, rgba(hi), 0.38, rgba(fur), 1, rgba(mix(fur, lo, 0.62))]),
      tail: radial(gc, -29, -23, 0.5, -27.5, -19, 9.5, [0, rgba(hi), 0.5, rgba(fur), 1, rgba(lo)]),
      foot: linear(gc, 0, -6.5, 0, 2, [0, rgba(fur), 0.55, rgba(fur), 1, rgba(shade)]),
      paw: linear(gc, 0, -3, 0, 4.2, [0, rgba(fur), 0.5, rgba(fur), 1, rgba(shade)]),
      ear: linear(gc, 0, 0, 0, -17, [0, rgba(fur), 0.55, rgba(mix(fur, lo, 0.25)), 1, rgba(mix(fur, patch, 0.4))]),
      earIn: linear(gc, 0, 0, 0, -15, [0, rgba(mix(pink, [196, 86, 104], 0.3)), 1, rgba(pink)]),
      earFar: rgba(mix(fur, lo, 0.7)),
      far: rgba(mix(fur, lo, 0.65)),
      eyePatch: radial(gc, 21.6, -32.2, 1.5, 21.6, -32.2, 7.6, [0, rgba(patch, 0.95), 0.5, rgba(patch, 0.72), 1, rgba(patch, 0)]),
      nosePatch: radial(gc, 29.6, -26.6, 0.8, 29.6, -26.6, 6, [0, rgba(patch, 0.78), 0.55, rgba(patch, 0.4), 1, rgba(patch, 0)]),
      lid: rgba(mix(fur, patch, 0.85)),
      shadow: radial(gc, 0, 0, 0, 0, 0, 1, [0, rgba(sh, shA), 0.6, rgba(sh, shA * 0.55), 1, rgba(sh, 0)]),
      strandHi: rgba(hi),
      strandLo: rgba(lo),
      crease: rgba(lo),
      rim: rgba(rim),
      rimA: dark ? 0.42 : 0.75,
      eye: rgba(eye),
      eyeLo: rgba(mix(eye, [150, 98, 62], 0.5)),
      nose: rgba(mix(pink, [196, 86, 104], 0.4)),
      pink: rgba(pink),
      mouth: rgba(line, 0.85),
      whisker: dark ? 'rgba(255,250,240,0.32)' : rgba(line, 0.38),
      accent: C.accent || '#d9482f',
    };
    if (id === 'hoodie') {
      const look = looks.hoodie;
      const black = !!look && look.fabric === 'black';
      const fab = black ? (dark ? [64, 66, 73] : [40, 42, 47]) : dark ? [86, 101, 138] : [74, 88, 122];
      const fabHi = mix(fab, WHITE, black ? 0.2 : 0.24), fabLo = mix(fab, [0, 0, 0], 0.3);
      pal.fabric = radial(gc, 5, -37, 2, 3, -30, 38, [0, rgba(fabHi), 0.4, rgba(fab), 1, rgba(fabLo)]);
      pal.hoodFill = radial(gc, 12, -42, 1, 9, -32, 18, [0, rgba(fabHi), 0.45, rgba(fab), 1, rgba(fabLo)]);
      pal.fabricHi = rgba(fabHi);
      pal.fabricLo = rgba(fabLo);
      pal.logo = black && look.logo === 'kts' && geo.ktsLogo ? rgba(col(look.logoColor, KTS_GREEN)) : null;
    }
    if (id === 'trusy') {
      const g = col(looks.trusy && looks.trusy.color, KTS_GREEN);
      pal.briefs = linear(gc, 0, -26, 0, 2, [0, rgba(mix(g, WHITE, 0.2)), 0.55, rgba(g), 1, rgba(mix(g, [0, 0, 0], 0.22))]);
      pal.briefsLo = rgba(mix(g, [0, 0, 0], 0.42));
      pal.briefsHi = rgba(mix(g, WHITE, 0.6));
    }
    if (id === 'duck') {
      pal.ring = linear(gc, 0, RING_Y - RING_RY - RING_W, 0, RING_Y + RING_RY + RING_W, [0, DUCK_HI, 0.45, DUCK_YELLOW, 1, DUCK_LO]);
      pal.duckHead = radial(gc, 28, -20.5, 0.5, 29.5, -18.2, 5.2, [0, DUCK_HI, 0.5, DUCK_YELLOW, 1, DUCK_LO]);
    }
    if (id === 'gold') {
      pal.glint = linear(gc, -7, 0, 7, 0, [0, 'rgba(255,255,240,0)', 0.5, 'rgba(255,253,235,0.85)', 1, 'rgba(255,255,240,0)']);
    }
    return pal;
  }

  // ---------- состояние анимации ----------
  const EYE_OPEN = 0, EYE_BLINK = 1, EYE_HAPPY = 2, EYE_SQUEEZE = 3, EYE_DEAD = 4, EYE_SPIRAL = 5;
  const MOUTH_IDLE = 0, MOUTH_OPEN = 1, MOUTH_TONGUE = 2;
  const EMO_HAPPY = 1, EMO_WOW = 2;
  const ACT_TAP = 1, ACT_GLANCE = 2, ACT_HOP = 3, ACT_PLEAD = 4, ACT_TWITCH = 5;
  const ACT_DUR = [0, 1.2, 1.8, 0.62, 1.7, 0.4];
  const ACT_WEIGHT = [0, 3, 3, 2, 2, 2];
  const FLIP_DUR = 0.42, ROLL_DUR = 0.6;
  const SPARKS = [-12, -31, 0, 6, -11, 2.1, 21, -41, 4.2];

  const A = {
    sq: { a: 0, w: 0 },
    earF: { a: -1.08, w: 0 },
    earB: { a: -0.82, w: 0 },
    dang: { a: 0.3, w: 0 },
    blink: 0,
    blinkIn: 2,
    run: 0,
    airK: 0,
    ffK: 0,
    flip: 0,
    flipFrom: 0,
    flipTo: 0,
    flipT: -1,
    deadT: -1,
    prevAlt: 0,
    emo: 0,
    emoT: 0,
    noseT: 0,
    noseIn: 1.5,
    shades: 1,
    glintT: 0,
    scaleMod: 1,
    tilt: 0,
    heroShift: 0,
    idle: { act: 0, t: 0, gap: 1.1, last: 0, first: true, side: false },
    stompT: -1,
    stumbleT: -1,
    work: false,
    workSeen: false,
    workT: 0,
    workK: 0,
    feverK: 0,
    meterK: 0,
  };

  function makePose() {
    return {
      skin: 'classic', t: 0, dead: false, out: 2.2,
      lift: 0, rot: 0, sx: 1, sy: 1,
      headRot: 0, headDx: 0, headDy: 0,
      earF: -1.08, earB: -0.82,
      hindDx: 0, hindDy: 0, hindRot: 0, hind2Dx: 0, hind2Dy: 0, hind2Rot: 0,
      pawDx: 0, pawDy: 0, paw2Dx: 0, paw2Dy: 0, tailDy: 0,
      eye: EYE_OPEN, lookX: 0, lookY: 0, lid: 0, eyeScale: 1, nose: 0, mouth: MOUTH_IDLE,
      stars: 0, dangle: 0.3, glint: -99, shades: 1, spin: 0, blush: 0,
    };
  }
  const P = makePose();
  const TP = makePose();

  function spring(s, target, k, d, dt) {
    const n = Math.ceil(dt * 120);
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      s.w += (k * (target - s.a) - d * s.w) * h;
      s.a += s.w * h;
    }
  }

  function startFlip() {
    const cur = A.flipT >= 0 ? A.flip % TAU : 0;
    A.flipFrom = cur;
    A.flipTo = cur < 1 ? TAU : TAU * 2;
    A.flipT = 0;
  }

  function resetMoves() {
    A.stompT = -1;
    A.stumbleT = -1;
    A.work = false;
    A.workSeen = false;
    A.workK = 0;
  }

  G.on('boot', () => { A.shades = 0; });
  G.on('start', () => {
    A.sq.a = 0;
    A.sq.w = -6;
    A.flipT = -1;
    A.flip = 0;
    A.deadT = -1;
    A.emo = 0;
    A.run = 0;
    A.shades = 0;
    A.idle.act = 0;
    resetMoves();
    livePose();
  });
  G.on('stomp', () => {
    if (G.bunny.dead) return;
    A.stompT = 0;
    A.flipT = -1;
    A.flip = 0;
    A.earF.w -= 6;
    A.earB.w -= 5;
    A.dang.w += 5;
  });
  G.on('chase', (c) => {
    if (!c) return;
    if (c.phase === 'caught') {
      A.work = true;
      A.workSeen = false;
      A.workT = 0;
    } else if (c.phase === 'start' && c.cause === 'stumble' && !G.bunny.dead) {
      A.stumbleT = 0;
      A.earF.w += 7;
      A.earB.w += 6;
    } else if (c.phase === 'escape' || c.phase === 'end') {
      A.work = false;
    }
  });
  G.on('jump', (j) => {
    if (j.n > 1) {
      startFlip();
      A.sq.a = 0.2;
      A.sq.w = -10;
      A.earF.w -= 5;
      A.earB.w -= 5;
      A.dang.w += 7;
    } else {
      A.sq.a = 0.5;
      A.sq.w = -24;
      A.earF.w -= 8;
      A.earB.w -= 7;
      A.dang.w -= 4;
    }
  });
  G.on('land', (l) => {
    if (G.bunny.dead) return;
    const impact = Math.max(0, l.impact || 0);
    A.sq.w += impact > 300 ? impact * 0.012 : impact * 0.006;
    A.earF.w -= impact * 0.008;
    A.earB.w -= impact * 0.009;
    A.dang.w += impact * 0.004;
    A.flipT = -1;
    A.flip = 0;
    A.run = 0.55;
  });
  G.on('die', () => {
    resetMoves();
    A.deadT = 0;
    A.flipT = -1;
    A.flip = 0;
    A.sq.a = 0.3;
    A.sq.w = -8;
    A.earF.w += 6;
    A.earB.w += 5;
    A.blink = 0;
    livePose();
  });
  G.on('pickup', () => { A.emo = EMO_HAPPY; A.emoT = 0.5; A.earF.w += 4; A.earB.w += 3; });
  G.on('powerup', () => { A.emo = EMO_HAPPY; A.emoT = 0.8; A.earF.w += 6; A.earB.w += 5; });
  G.on('pass', (o, info) => {
    if (info && info.near) { A.emo = EMO_WOW; A.emoT = 0.45; A.earF.w += 7; A.earB.w += 6; }
  });

  function pickAct(last) {
    let total = 0;
    for (let i = 1; i < ACT_WEIGHT.length; i++) if (i !== last) total += ACT_WEIGHT[i];
    let r = Math.random() * total;
    for (let i = 1; i < ACT_WEIGHT.length; i++) {
      if (i === last) continue;
      r -= ACT_WEIGHT[i];
      if (r <= 0) return i;
    }
    return ACT_GLANCE;
  }

  function updateIdle(dt) {
    const I = A.idle;
    if (I.act) {
      const prev = I.t;
      I.t += dt;
      if (I.act === ACT_HOP) {
        if (prev < 0.14 && I.t >= 0.14) { A.earF.w -= 7; A.earB.w -= 6; }
        if (prev < 0.52 && I.t >= 0.52) { A.sq.w += 7.5; A.earF.w -= 5; A.earB.w -= 5; }
      } else if (I.act === ACT_TWITCH && prev === 0) {
        (I.side ? A.earF : A.earB).w += 11;
        A.noseT = 0.5;
      }
      if (I.t >= ACT_DUR[I.act]) {
        I.last = I.act;
        I.act = 0;
        I.gap = 0.5 + Math.random() * 1.5;
      }
    } else if ((I.gap -= dt) <= 0) {
      I.act = I.first ? ACT_GLANCE : pickAct(I.last);
      if (calm && I.act === ACT_HOP) I.act = ACT_PLEAD;
      I.first = false;
      I.t = 0;
      I.side = Math.random() < 0.5;
    }
  }

  G.onUpdate((dt) => {
    const S = G.state, B = G.bunny, mode = S.mode;
    if (dt > 0) {
      const air = B.alt > 0.5, dead = B.dead;
      A.scaleMod = approach(A.scaleMod, G.mod('hitbox'), dt * 8);

      A.blinkIn -= dt;
      if (A.blinkIn <= 0) {
        A.blink = 0.13;
        A.blinkIn = Math.random() < 0.2 ? 0.25 : 2 + Math.random() * 3;
      }
      A.blink = max(0, A.blink - dt);

      if (mode === 'run' && !air && !dead) {
        const f = 3 + 1.6 * sat((S.speed - 300) / 270);
        A.run = (A.run + dt * f) % 1;
      }
      A.airK = approach(A.airK, air && !dead ? 1 : 0, dt * 14);
      A.ffK = approach(A.ffK, mode === 'run' && air && !dead && G.input.fastFall ? 1 : 0, dt * 16);

      if (A.flipT >= 0) {
        A.flipT += dt;
        const p = min(1, A.flipT / FLIP_DUR);
        A.flip = lerp(A.flipFrom, A.flipTo, easeOut3(p));
        if (p >= 1) { A.flipT = -1; A.flip = 0; }
      }

      if (dead) {
        A.deadT = max(0, A.deadT) + dt;
        if (A.prevAlt > 0 && B.alt <= 0 && A.deadT > 0.1) {
          A.sq.w += 7;
          A.earF.w -= 6;
          A.earB.w -= 5;
        }
      }
      A.prevAlt = B.alt;

      if (A.emoT > 0 && (A.emoT -= dt) <= 0) A.emo = 0;

      if (A.stompT >= 0 && (A.stompT += dt) > 0.3) A.stompT = -1;
      if (A.stumbleT >= 0 && (A.stumbleT += dt) > 0.5) A.stumbleT = -1;
      let working = false;
      if (A.work) {
        A.workT += dt;
        const muted = G.mod('score') === 0;
        if (muted) A.workSeen = true;
        if ((A.workSeen && !muted) || A.workT > 8 || mode !== 'run') A.work = false;
        else working = muted || A.workT < 0.25;
      }
      A.workK = approach(A.workK, working && !air && !dead ? 1 : 0, dt * 9);
      A.feverK = approach(A.feverK, mode === 'run' && !dead && G.flag('fever') ? 1 : 0, dt * 10);
      let meter = 0;
      if (mode === 'run' && G.modes && typeof G.modes.meter === 'function') {
        try { meter = sat(Number(G.modes.meter()) || 0); } catch (e) { meter = 0; }
      }
      A.meterK = approach(A.meterK, max(meter, A.feverK), dt * 4);

      if (mode === 'start' && !dead) updateIdle(dt);
      else A.idle.act = 0;

      A.noseIn -= dt;
      if (A.noseIn <= 0) { A.noseT = 0.45 + Math.random() * 0.4; A.noseIn = 1.2 + Math.random() * 2.5; }
      A.noseT = max(0, A.noseT - dt);
      A.shades = min(1, A.shades + dt / 0.55);
      A.glintT += dt;
      A.heroShift = approach(A.heroShift, mode === 'start' ? heroClearance() : 0, dt * 8);

      let tF = -1.08, tB = -0.82;
      if (mode === 'run') {
        const k = (1 - A.airK) * cos(TAU * A.run);
        tF += 0.16 * k - 0.12;
        tB += 0.2 * k - 0.14;
      }
      if (A.airK > 0) {
        const rising = Math.max(-1, Math.min(1, B.v / 760));
        const lift = rising > 0 ? -0.32 * rising : -0.45 * rising;
        tF += A.airK * lift;
        tB += A.airK * lift * 1.1;
      }
      if (A.flipT >= 0) { tF -= 0.35; tB -= 0.35; }
      tF = lerp(tF, -1.72, A.ffK);
      tB = lerp(tB, -1.6, A.ffK);
      const I = A.idle;
      if (I.act === ACT_PLEAD || A.emo) { tF += 0.32; tB += 0.28; }
      else if (I.act === ACT_GLANCE) { tF -= 0.12; tB -= 0.1; }
      tF += 0.42 * A.workK;
      tB += 0.36 * A.workK;
      if (dead) {
        tF = -2.25 + 0.1 * sin(S.idleT * 2.3);
        tB = -0.35 + 0.22 * sin(S.idleT * 3.1 + 1);
      }
      spring(A.earF, tF, 170, 9, dt);
      spring(A.earB, tB, 140, 8, dt);

      const wind = mode === 'run' ? 0.55 * sat(S.speed / 570) : 0;
      const fall = A.airK * -Math.max(-1, Math.min(1, B.v / 760)) * 0.6;
      spring(A.dang, 0.3 + wind + fall - A.tilt, 60, 4, dt);

      spring(A.sq, 0, 380, 15, dt);
      if (A.sq.a > 0.9) { A.sq.a = 0.9; A.sq.w = min(0, A.sq.w); }
      if (A.sq.a < -0.8) { A.sq.a = -0.8; A.sq.w = max(0, A.sq.w); }
    }
    livePose();
  }, 60);

  function heroClearance() {
    const B = G.bunny;
    for (const o of G.obstacles) {
      if (!o.hero || !(o.r > 0)) continue;
      const front = B.x + 34 * B.size, clockLeft = o.x - o.r - 3;
      return front > clockLeft ? clockLeft - front : 0;
    }
    return 0;
  }

  function idleEnv(t, dur) {
    return smooth(min(t / 0.22, (dur - t) / 0.22));
  }

  function livePose() {
    const S = G.state, B = G.bunny, mode = S.mode, t = S.idleT;
    const air = B.alt > 0.5, dead = B.dead;
    const p = P;
    p.skin = S.skin;
    p.t = t;
    p.dead = dead;

    let lift = 0, rot = 0, sx = 1, sy = 1, headRot = 0, headDx = 0, headDy = 0;
    let hindDx = 0, hindDy = 0, hindRot = 0, hind2Dx = 0, hind2Dy = 0, hind2Rot = 0;
    let pawDx = 0, pawDy = 0, paw2Dx = 0, paw2Dy = 0, tailDy = 0;
    let lookX = 0, lookY = 0, lid = 0, eyeScale = 1, mouth = MOUTH_IDLE, stars = 0;

    const running = (mode === 'run' || mode === 'pause') && !dead;
    const breathe = sin(t * 2.6) * (running ? 0.3 : 1);
    sy += 0.016 * breathe;
    sx -= 0.007 * breathe;
    headDy -= 0.45 * breathe;

    if (running) {
      const k = (1 - A.airK) * (1 - A.workK);
      const u = A.run, ext = sin(TAU * u), ext2 = sin(TAU * (u + 0.08));
      const contact = exp(-((u - 0.56) / 0.07) * ((u - 0.56) / 0.07));
      lift -= k * 7 * max(0, ext);
      rot -= k * 0.12 * cos(TAU * u);
      headRot += k * 0.06 * cos(TAU * u);
      headDy += k * 1.2 * cos(TAU * u);
      sx += k * (0.08 * ext + 0.07 * contact);
      sy -= k * (0.06 * ext + 0.1 * contact);
      hindDx -= k * 8 * ext;
      hindDy -= k * 1.5 * max(0, ext);
      hindRot += k * 0.3 * max(0, ext);
      hind2Dx -= k * 8 * ext2;
      hind2Dy -= k * 1.5 * max(0, ext2);
      hind2Rot += k * 0.3 * max(0, ext2);
      pawDx += k * 6.5 * ext;
      pawDy -= k * 2 * max(0, ext);
      paw2Dx += k * 6.5 * ext2;
      paw2Dy -= k * 2 * max(0, ext2);
      tailDy += k * 1.6 * cos(TAU * u);
    }

    if (A.airK > 0.001) {
      const k = A.airK, rising = Math.max(-1, Math.min(1, B.v / 760));
      const up = max(0, rising), down = max(0, -rising);
      sy += k * (0.09 * up - 0.02 * down);
      sx += k * (-0.06 * up + 0.02 * down);
      rot -= k * Math.max(-0.25, Math.min(0.25, B.v / 2600));
      hindDx += k * (-6 * up + 3 * down);
      hindRot += k * (0.35 * up - 0.1 * down);
      hind2Dx += k * (-5 * up + 3.5 * down);
      hind2Rot += k * (0.3 * up - 0.1 * down);
      pawDx += k * (2 + 3 * down);
      pawDy += k * (-2.5 * up + 1 * down);
      paw2Dx += k * (2.5 + 3 * down);
      paw2Dy += k * (-2 * up + 1 * down);
      lookY += k * 0.7 * down;
      tailDy += k * 1.5 * down;
    }

    const wk = A.workK;
    if (wk > 0.001) {
      const type = calm ? 0 : sin(t * 26);
      rot -= 0.12 * wk;
      sy += 0.03 * wk;
      hindDx += 3 * wk;
      hind2Dx += 3.5 * wk;
      pawDx += 5 * wk;
      pawDy -= (5 - 1.1 * type) * wk;
      paw2Dx += 5.5 * wk;
      paw2Dy -= (5 + 1.1 * type) * wk;
      headRot += 0.1 * wk;
      lookX += 0.45 * wk;
      lookY += 0.7 * wk;
      lid += 0.45 * wk;
    }

    if (A.stompT >= 0) {
      const st = A.stompT;
      const strike = st < 0.12 ? sin(PI * min(1, st / 0.12)) : 0;
      pawDy += 4 * strike;
      paw2Dy += 4 * strike;
      pawDx += 3 * strike;
      paw2Dx += 2.5 * strike;
      headDy += 1.5 * strike;
      hindRot -= 0.25 * strike;
      if (st < 0.15) {
        const q = easeOut3(st / 0.15), depth = calm ? 0.1 : 0.2;
        sy *= 1 - depth * (1 - q);
        sx *= 1 + depth * 0.6 * (1 - q);
      }
    }
    if (A.stumbleT >= 0 && !dead) {
      const st = A.stumbleT;
      const lean = st < 0.06 ? st / 0.06 : 1 - smooth((st - 0.06) / 0.4);
      rot += (calm ? 0.2 : 0.35) * lean;
      headDx += 1.5 * lean;
      pawDx += 3 * lean;
      pawDy += 2 * lean;
      eyeScale += 0.2 * lean;
    }
    A.tilt = rot;

    const tuck = max(A.ffK, A.flipT >= 0 ? 0.8 : 0);
    if (tuck > 0.001) {
      sx = lerp(sx, 0.95, tuck);
      sy = lerp(sy, 0.93, tuck);
      hindDx = lerp(hindDx, 6, tuck);
      hindDy = lerp(hindDy, -3, tuck);
      hindRot = lerp(hindRot, -0.2, tuck);
      hind2Dx = lerp(hind2Dx, 5, tuck);
      hind2Dy = lerp(hind2Dy, -3, tuck);
      pawDx = lerp(pawDx, -1, tuck);
      pawDy = lerp(pawDy, -3.5, tuck);
      paw2Dx = lerp(paw2Dx, -0.5, tuck);
      paw2Dy = lerp(paw2Dy, -3.5, tuck);
      rot += 0.18 * A.ffK;
    }
    if (A.flipT >= 0) rot += A.flip;

    if (mode === 'start' && !dead) {
      const I = A.idle, it = I.t;
      if (I.act) {
        const env = idleEnv(it, ACT_DUR[I.act]);
        if (I.act === ACT_TAP) {
          const tap = max(0, sin(it * 21)) * env;
          hindRot -= 0.34 * tap;
          headDy += 0.3 * tap;
          lid += 0.32 * env;
          lookX += 0.6 * env;
        } else if (I.act === ACT_GLANCE) {
          lookX += env;
          lookY += 0.45 * env;
          lid += 0.5 * env;
          headRot += 0.07 * env;
          const sigh = (it - 1.25) / 0.5;
          if (sigh > 0 && sigh < 1) {
            sy -= 0.03 * sin(PI * sigh);
            sx += 0.015 * sin(PI * sigh);
          }
        } else if (I.act === ACT_HOP) {
          if (it < 0.14) {
            const k = it / 0.14;
            sy -= 0.13 * k;
            sx += 0.09 * k;
          } else if (it < 0.52) {
            const q = (it - 0.14) / 0.38, arc = sin(PI * q);
            lift -= 13 * arc;
            sy += 0.08 * (1 - q) * (1 - arc * 0.5);
            sx -= 0.05 * (1 - q);
            pawDy -= 3 * arc;
            pawDx += 3 * arc;
            paw2Dy -= 3 * arc;
            paw2Dx += 3 * arc;
            hindDx -= 3 * arc;
            hindRot += 0.3 * arc;
            mouth = MOUTH_OPEN;
            eyeScale += 0.1 * arc;
          }
        } else if (I.act === ACT_PLEAD) {
          eyeScale += 0.2 * env;
          headRot -= 0.12 * env;
          pawDy -= 3 * env;
          pawDx += 1.5 * env;
          paw2Dy -= 3 * env;
          paw2Dx += 1.2 * env;
          lookX -= 0.2 * env;
        }
      } else if (S.skin === 'headphones') {
        const beat = max(0, sin(t * TAU * 1.7));
        headRot += 0.04 * beat;
        headDy += 0.5 * beat;
        hindRot -= 0.18 * beat;
      }
    }

    if (dead) {
      const d = max(0, A.deadT);
      const roll = min(1, d / ROLL_DUR);
      rot = -TAU * easeOut3(roll);
      const ball = 1 - roll;
      sx = lerp(sx, 0.95, ball);
      sy = lerp(sy, 0.93, ball);
      hindDx = lerp(0, 6, ball);
      pawDy = lerp(0, -3.5, ball);
      const dazed = smooth((d - 0.55) / 0.35);
      sy -= 0.05 * dazed;
      sx += 0.02 * dazed;
      headRot = dazed * (0.12 + 0.07 * sin(t * 3));
      headDx = dazed * 0.8 * sin(t * 1.5);
      pawDx += 2.5 * dazed;
      stars = smooth((d - 0.5) / 0.3);
      mouth = MOUTH_TONGUE;
      lift = 0;
    }

    if (A.emo === EMO_WOW) { eyeScale += 0.25; mouth = MOUTH_OPEN; }
    if (running && G.powerups && typeof G.powerups.isActive === 'function' && G.powerups.isActive('coffee')) {
      eyeScale += 0.22;
      headDx += sin(t * 97) * 0.35;
      sx += sin(t * 83) * 0.012;
    }

    let eye = EYE_OPEN;
    if (dead) eye = EYE_DEAD;
    else if (A.feverK > 0.5) eye = EYE_SPIRAL;
    else if (A.stompT >= 0 && A.stompT < 0.12) eye = EYE_SQUEEZE;
    else if (tuck > 0.5) eye = EYE_SQUEEZE;
    else if (A.blink > 0) eye = EYE_BLINK;
    else if (A.emo === EMO_HAPPY) eye = EYE_HAPPY;

    sx *= 1 + A.sq.a * 0.2;
    sy *= 1 - A.sq.a * 0.2;

    p.lift = calm ? lift * 0.6 : lift;
    p.rot = rot;
    p.sx = sx;
    p.sy = sy;
    p.headRot = headRot;
    p.headDx = headDx;
    p.headDy = headDy;
    p.earF = A.earF.a;
    p.earB = A.earB.a;
    p.hindDx = hindDx; p.hindDy = hindDy; p.hindRot = hindRot;
    p.hind2Dx = hind2Dx; p.hind2Dy = hind2Dy; p.hind2Rot = hind2Rot;
    p.pawDx = pawDx; p.pawDy = pawDy;
    p.paw2Dx = paw2Dx; p.paw2Dy = paw2Dy;
    p.tailDy = tailDy;
    p.eye = eye;
    p.lookX = lookX;
    p.lookY = lookY;
    p.lid = sat(lid);
    p.eyeScale = eyeScale;
    p.nose = A.noseT > 0 && !dead ? sin(t * 38) * 0.45 : 0;
    p.mouth = mouth;
    p.stars = stars;
    p.dangle = A.dang.a;
    p.shades = A.shades;
    p.spin = calm ? 0.6 : t * 4;
    p.blush = A.meterK;
    const cyc = A.glintT % (calm ? 5 : 2.8);
    p.glint = cyc < 0.85 ? -42 + 84 * (cyc / 0.85) : -99;
  }

  // ---------- рисование ----------
  function headXf(ctx, p) {
    ctx.translate(NECK_X + p.headDx, NECK_Y + p.headDy);
    if (p.headRot) ctx.rotate(p.headRot);
    ctx.translate(HEAD_X - NECK_X, HEAD_Y - NECK_Y);
    ctx.scale(HEAD_SCALE, HEAD_SCALE);
    ctx.translate(-HEAD_X, -HEAD_Y);
  }

  function shape(ctx, path, fill, pal, out) {
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = out;
    ctx.stroke(path);
    ctx.fillStyle = fill;
    ctx.fill(path);
  }

  function limb(ctx, path, x, y, rot, fill, pal, out) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    shape(ctx, path, fill, pal, out);
    if (path === geo.foot && fill === pal.foot) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = pal.strandLo;
      ctx.lineWidth = 0.6;
      ctx.stroke(geo.toes);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function ear(ctx, x, y, ang, near, pal, out, blush) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    if (!near) ctx.scale(0.92, 0.92);
    shape(ctx, geo.ear, near ? pal.ear : pal.earFar, pal, out);
    if (blush > 0.01) {
      ctx.globalAlpha = 0.3 * blush;
      ctx.fillStyle = FEVER_PINK;
      ctx.fill(geo.ear);
    }
    ctx.globalAlpha = near ? 0.95 : 0.5;
    ctx.fillStyle = pal.earIn;
    ctx.fill(geo.earIn);
    if (blush > 0.01) {
      ctx.globalAlpha = 0.6 * blush;
      ctx.fillStyle = FEVER_PINK;
      ctx.fill(geo.earIn);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function fur(ctx, hiPath, loPath, pal, a) {
    ctx.lineWidth = 0.6;
    ctx.globalAlpha = a;
    ctx.strokeStyle = pal.strandLo;
    ctx.stroke(loPath);
    ctx.strokeStyle = pal.strandHi;
    ctx.stroke(hiPath);
    ctx.globalAlpha = 1;
  }

  function glint(ctx, path, p, pal) {
    if (p.glint < -60) return;
    ctx.save();
    ctx.clip(path);
    ctx.translate(p.glint, -24);
    ctx.rotate(0.45);
    ctx.fillStyle = pal.glint;
    ctx.fillRect(-7, -40, 14, 80);
    ctx.restore();
  }

  function drawEye(ctx, p, pal) {
    ctx.strokeStyle = pal.eye;
    ctx.fillStyle = pal.eye;
    ctx.lineWidth = 1.3;
    if (p.eye === EYE_DEAD) {
      ctx.beginPath();
      ctx.moveTo(EYE_X - 2.6, EYE_Y - 2.6); ctx.lineTo(EYE_X + 2.6, EYE_Y + 2.6);
      ctx.moveTo(EYE_X + 2.6, EYE_Y - 2.6); ctx.lineTo(EYE_X - 2.6, EYE_Y + 2.6);
      ctx.stroke();
      return;
    }
    if (p.eye === EYE_SPIRAL) {
      ctx.fillStyle = SPIRAL_WHITE;
      ellipse(ctx, EYE_X, EYE_Y, EYE_RX * 1.12, EYE_RY * 1.06);
      ctx.save();
      ctx.translate(EYE_X, EYE_Y);
      ctx.rotate(p.spin);
      ctx.lineWidth = 0.9;
      ctx.stroke(geo.spiral);
      ctx.restore();
      return;
    }
    if (p.eye === EYE_SQUEEZE) {
      ctx.beginPath();
      ctx.moveTo(EYE_X - 2.4, EYE_Y - 2.8); ctx.lineTo(EYE_X + 2, EYE_Y); ctx.lineTo(EYE_X - 2.4, EYE_Y + 2.8);
      ctx.stroke();
      return;
    }
    if (p.eye === EYE_BLINK) {
      ctx.beginPath();
      ctx.arc(EYE_X, EYE_Y - 1.6, 3.2, 0.18 * PI, 0.82 * PI);
      ctx.stroke();
      return;
    }
    if (p.eye === EYE_HAPPY) {
      ctx.beginPath();
      ctx.arc(EYE_X, EYE_Y + 1.6, 3.1, 1.15 * PI, 1.85 * PI);
      ctx.stroke();
      return;
    }
    const es = p.eyeScale, rx = EYE_RX * es, ry = EYE_RY * es;
    const ex = EYE_X + p.lookX * 0.7, ey = EYE_Y + p.lookY * 0.6;
    ellipse(ctx, ex, ey, rx, ry);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = pal.eyeLo;
    ellipse(ctx, ex - 0.2, ey + ry * 0.45, rx * 0.62, ry * 0.36);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, ex + 1 + p.lookX * 0.2, ey - ry * 0.38, 1.25 * es, 1.15 * es);
    ellipse(ctx, ex - rx * 0.38, ey + ry * 0.36, 0.55 * es, 0.5 * es);
    if (p.lid > 0.02) {
      const lidRy = ry * 1.15, cy = ey - ry - lidRy + 2 * ry * p.lid;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ex, ey, rx + 0.5, ry + 0.5, 0, 0, TAU);
      ctx.clip();
      ctx.fillStyle = pal.lid;
      ellipse(ctx, ex, cy, rx * 1.6, lidRy);
      ctx.strokeStyle = pal.eye;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(ex, cy, rx * 1.6, lidRy, 0, 0.1 * PI, 0.9 * PI);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawHood(ctx, pal, out) {
    shape(ctx, geo.hood, pal.hoodFill, pal, out);
    ctx.strokeStyle = pal.fabricHi;
    ctx.lineWidth = 2.6;
    ctx.stroke(geo.hoodRim);
    ctx.strokeStyle = pal.fabricLo;
    ctx.lineWidth = 0.8;
    ctx.stroke(geo.hoodRimIn);
  }

  function drawFace(ctx, p, pal, out) {
    ctx.save();
    ctx.clip(geo.head);
    ctx.fillStyle = pal.eyePatch;
    ctx.fillRect(13.8, -40, 15.6, 15.6);
    ctx.fillStyle = pal.nosePatch;
    ctx.fillRect(23.6, -32.6, 12, 12);
    ctx.restore();
    if (pal.id === 'hoodie') drawHood(ctx, pal, out);

    ctx.globalAlpha = 0.32;
    ctx.fillStyle = pal.pink;
    ellipse(ctx, 25.2, -24.4, 3.1, 1.7, -0.1);
    ctx.globalAlpha = 1;

    if (!(pal.id === 'shades' && p.shades >= 1 && !p.dead)) drawEye(ctx, p, pal);

    ctx.save();
    if (p.nose) ctx.translate(0, p.nose);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = pal.whisker;
    ctx.lineWidth = 0.45;
    ctx.stroke(geo.whiskers);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.nose;
    ctx.fill(geo.nose);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ellipse(ctx, 31.2, -28.5, 0.7, 0.4, -0.2);
    ctx.restore();

    if (p.mouth === MOUTH_OPEN) {
      ctx.fillStyle = pal.mouth;
      ellipse(ctx, 29.8, -23.6, 1.4, 1.25);
    } else if (p.mouth === MOUTH_TONGUE) {
      ctx.fillStyle = pal.nose;
      ellipse(ctx, 30.1, -22.2, 1.6, 2.4, 0.25);
    }
    ctx.strokeStyle = pal.mouth;
    ctx.lineWidth = 0.75;
    ctx.stroke(geo.mouth);
  }

  function drawDrawstrings(ctx, p, pal) {
    const a = (p.dangle - 0.3) * 1.1 - p.headRot;
    for (let i = 0; i < 2; i++) {
      const x = i ? 12.8 : 15.3, y = i ? -16.3 : -16.8, L = i ? 7.4 : 8.6, aa = a + (i ? 0.12 : 0);
      const ex = x - sin(aa) * L, ey = y + cos(aa) * L;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = pal.outline;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = STRING;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.fillStyle = AGLET;
      ellipse(ctx, ex - sin(aa) * 0.6, ey + cos(aa) * 0.6, 0.6, 1.1, aa);
    }
  }

  function drawCuff(ctx, p, pal, out) {
    ctx.save();
    ctx.translate(14 + p.pawDx, -6.9 + p.pawDy);
    ctx.rotate(0.12);
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = out;
    ctx.fillStyle = pal.fabricLo;
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.4, 2.1, 0, 0, TAU);
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  function drawTie(ctx, p, pal, out) {
    ctx.lineWidth = out * 0.6;
    ctx.strokeStyle = pal.outline;
    ctx.fillStyle = '#ffffff';
    ctx.fill(geo.collar);
    ctx.stroke(geo.collar);
    ctx.save();
    ctx.translate(19.6, -15.6);
    ctx.rotate(p.dangle);
    shape(ctx, geo.tie, TIE_RED, pal, out * 0.8);
    ctx.strokeStyle = TIE_DARK;
    ctx.lineWidth = 0.9;
    ctx.stroke(geo.tieStripes);
    ctx.lineWidth = out * 0.6;
    ctx.strokeStyle = pal.outline;
    ctx.stroke(geo.knot);
    ctx.fillStyle = TIE_KNOT;
    ctx.fill(geo.knot);
    ctx.restore();
  }

  function drawGlasses(ctx) {
    ctx.fillStyle = LENS;
    ctx.fill(geo.glasses);
    ctx.strokeStyle = FRAME;
    ctx.lineWidth = 1.25;
    ctx.stroke(geo.glasses);
    ctx.stroke(geo.glassArms);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.8;
    ctx.stroke(geo.glare);
  }

  function drawShades(ctx, p) {
    const pr = p.shades;
    if (pr <= 0) return;
    ctx.save();
    if (p.dead) {
      ctx.translate(23.2, -24.2);
      ctx.rotate(0.26);
      ctx.translate(-20, 33);
    } else if (pr < 1) {
      ctx.translate(0, -(1 - bounceOut(pr)) * 26);
      ctx.globalAlpha = min(1, pr * 4);
    }
    ctx.strokeStyle = PIXEL_BLACK;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(15, -36.4);
    ctx.lineTo(8.6, -37.8);
    ctx.stroke();
    ctx.fillStyle = PIXEL_BLACK;
    ctx.fill(geo.shadesBlack);
    ctx.fillStyle = '#ffffff';
    ctx.fill(geo.shadesWhite);
    ctx.restore();
  }

  function drawHeadphones(ctx, pal, out) {
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = 3.4 + out;
    ctx.stroke(geo.band);
    ctx.strokeStyle = HP_DARK;
    ctx.lineWidth = 3.4;
    ctx.stroke(geo.band);
    ctx.strokeStyle = HP_HI;
    ctx.lineWidth = 0.9;
    ctx.stroke(geo.band);
    ctx.fillStyle = HP_CUSH;
    ctx.fill(geo.cushion);
    shape(ctx, geo.cup, HP_DARK, pal, out);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.3;
    ctx.stroke(geo.cupRing);
    ctx.fillStyle = HP_HI;
    ctx.fill(geo.cupHi);
  }

  function drawBriefs(ctx, pal) {
    ctx.save();
    ctx.clip(geo.body);
    ctx.fillStyle = pal.briefs;
    ctx.fill(geo.briefs, 'evenodd');
    ctx.strokeStyle = pal.briefsLo;
    ctx.lineWidth = 1.3;
    ctx.stroke(geo.legHem);
    ctx.lineWidth = 3.2;
    ctx.stroke(geo.waist);
    ctx.translate(0, -0.5);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = pal.briefsHi;
    ctx.lineWidth = 0.8;
    ctx.stroke(geo.waist);
    ctx.restore();
  }

  // Круг сначала целиком за телом, потом передняя половина поверх: стык попадает за силуэт и не виден.
  function drawRing(ctx, path, pal, out, front) {
    ctx.save();
    if (front) ctx.lineCap = 'butt';
    else {
      ctx.lineWidth = out * 0.8;
      ctx.strokeStyle = pal.outline;
      ctx.fillStyle = DUCK_YELLOW;
      ctx.fill(geo.duckTail);
      ctx.stroke(geo.duckTail);
    }
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = RING_W + out * 2;
    ctx.stroke(path);
    ctx.strokeStyle = pal.ring;
    ctx.lineWidth = RING_W;
    ctx.stroke(path);
    ctx.translate(0, -1.9);
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = DUCK_HI;
    ctx.lineWidth = 1.3;
    ctx.stroke(path);
    ctx.restore();
  }

  function drawDuckHead(ctx, pal, out) {
    shape(ctx, geo.duckHead, pal.duckHead, pal, out);
    ctx.lineWidth = out * 0.8;
    ctx.strokeStyle = pal.outline;
    ctx.stroke(geo.beak);
    ctx.fillStyle = DUCK_BEAK;
    ctx.fill(geo.beak);
    ctx.fillStyle = DUCK_EYE;
    ellipse(ctx, 30.7, -19.6, 0.95, 1.05);
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, 31, -20, 0.35, 0.35);
  }

  function drawStars(ctx, p) {
    for (let i = 0; i < 3; i++) {
      const a = p.t * 3.4 + (i * TAU) / 3;
      const depth = 0.5 + 0.5 * sin(a);
      const r = (1.8 + 1.1 * depth) * p.stars;
      ctx.save();
      ctx.translate(14 + cos(a) * 12.5, -51 + sin(a) * 3.6);
      ctx.rotate(a * 0.7);
      ctx.scale(r, r);
      ctx.globalAlpha = 0.55 + 0.45 * depth;
      ctx.fillStyle = STAR;
      ctx.fill(geo.star);
      ctx.lineWidth = 0.35;
      ctx.strokeStyle = STAR_EDGE;
      ctx.stroke(geo.star);
      ctx.restore();
    }
  }

  function drawSparks(ctx, p) {
    ctx.fillStyle = SPARK;
    for (let i = 0; i < SPARKS.length; i += 3) {
      const a = sin(p.t * 2.3 + SPARKS[i + 2]);
      if (a <= 0.55) continue;
      const k = (a - 0.55) / 0.45;
      ctx.save();
      ctx.translate(SPARKS[i], SPARKS[i + 1]);
      ctx.rotate(p.t * 0.8);
      ctx.scale(2.8 * k, 2.8 * k);
      ctx.fill(geo.spark);
      ctx.restore();
    }
  }

  function drawBunny(ctx, p) {
    const pal = palette(p.skin), id = pal.id, out = p.out;
    const hoodie = id === 'hoodie';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (p.lift) ctx.translate(0, p.lift);
    if (p.rot) {
      ctx.translate(PIVOT_X, PIVOT_Y);
      ctx.rotate(p.rot);
      ctx.translate(-PIVOT_X, -PIVOT_Y);
    }
    ctx.scale(p.sx, p.sy);

    ctx.save();
    headXf(ctx, p);
    ear(ctx, 7.5, -41.2, p.earB, false, pal, out, p.blush);
    ctx.restore();

    ctx.save();
    if (p.tailDy) ctx.translate(0, p.tailDy);
    shape(ctx, geo.tail, pal.tail, pal, out);
    fur(ctx, geo.tailHi, geo.tailLo, pal, 0.5);
    ctx.restore();

    limb(ctx, geo.foot, -15.5 + p.hind2Dx, -2.6 + p.hind2Dy, p.hind2Rot, pal.far, pal, out);
    limb(ctx, geo.paw, 16 + p.paw2Dx, -4.8 + p.paw2Dy, 0, pal.far, pal, out);
    if (pal.ring) drawRing(ctx, geo.ring, pal, out, false);

    const body = hoodie ? geo.bodySmooth : geo.body;
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = out;
    ctx.stroke(body);
    ctx.save();
    headXf(ctx, p);
    ctx.stroke(geo.head);
    ctx.restore();

    ctx.fillStyle = hoodie ? pal.fabric : pal.body;
    ctx.fill(body);
    if (hoodie) {
      ctx.strokeStyle = pal.fabricLo;
      ctx.lineWidth = 1.2;
      ctx.stroke(geo.pocket);
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = pal.logo || pal.fabricHi;
      ctx.lineWidth = pal.logo ? 1.2 : 1.1;
      ctx.stroke(pal.logo ? geo.ktsLogo : geo.logo);
      ctx.strokeStyle = pal.fabricHi;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.4;
      ctx.stroke(geo.bodyRim);
      ctx.globalAlpha = 1;
    } else {
      fur(ctx, geo.bodyHi, geo.bodyLo, pal, 0.55);
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = pal.crease;
      ctx.lineWidth = 1.2;
      ctx.stroke(geo.haunch);
      ctx.globalAlpha = pal.rimA;
      ctx.strokeStyle = pal.rim;
      ctx.lineWidth = 1.3;
      ctx.stroke(geo.bodyRim);
      ctx.globalAlpha = 1;
      if (id === 'gold') glint(ctx, geo.body, p, pal);
      else if (pal.briefs) drawBriefs(ctx, pal);
    }

    ctx.save();
    headXf(ctx, p);
    ctx.fillStyle = pal.head;
    ctx.fill(geo.head);
    fur(ctx, geo.headHi, geo.headLo, pal, 0.5);
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = pal.crease;
    ctx.lineWidth = 1.4;
    ctx.stroke(geo.chin);
    ctx.globalAlpha = 1;
    if (id === 'gold') glint(ctx, geo.head, p, pal);
    drawFace(ctx, p, pal, out);
    if (hoodie) drawDrawstrings(ctx, p, pal);
    ctx.restore();

    limb(ctx, geo.foot, -19 + p.hindDx, -2.2 + p.hindDy, p.hindRot, pal.foot, pal, out);
    limb(ctx, geo.paw, 12.5 + p.pawDx, -4.4 + p.pawDy, 0, pal.paw, pal, out);
    if (hoodie) drawCuff(ctx, p, pal, out);
    if (id === 'tie') drawTie(ctx, p, pal, out);
    if (pal.ring) {
      drawRing(ctx, geo.ringFront, pal, out, true);
      drawDuckHead(ctx, pal, out);
    }

    ctx.save();
    headXf(ctx, p);
    if (id === 'tie') drawGlasses(ctx);
    else if (id === 'shades') drawShades(ctx, p);
    if (hoodie) {
      ctx.fillStyle = pal.fabricLo;
      ctx.fill(geo.earHoles);
    }
    ear(ctx, 11.5, -40.2, p.earF, true, pal, out, p.blush);
    if (id === 'headphones') drawHeadphones(ctx, pal, out);
    if (p.stars > 0) drawStars(ctx, p);
    ctx.restore();

    if (id === 'gold') drawSparks(ctx, p);
  }

  const head = { x: 0, alt: 0 };
  G.bunnyDizzy = true;
  G.bunnyHead = () => {
    const B = G.bunny, s = B.size * A.scaleMod;
    const lx = (HEAD_X + P.headDx) * P.sx - PIVOT_X, ly = (HEAD_Y - 15 + P.headDy) * P.sy - PIVOT_Y;
    const c = cos(P.rot), sn = sin(P.rot);
    head.x = B.x + A.heroShift + (PIVOT_X + lx * c - ly * sn) * s;
    head.alt = B.alt - (PIVOT_Y + lx * sn + ly * c + P.lift) * s;
    return head;
  };

  const SHADOW_DAY = [70, 60, 110], SHADOW_NIGHT = [20, 22, 50];
  const shadowSprites = [];
  function shadowSprite(q) {
    let c = shadowSprites[q];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d');
    if (x) {
      const tone = mix(SHADOW_DAY, SHADOW_NIGHT, q / 8);
      x.fillStyle = radial(x, 16, 16, 0, 16, 16, 16, [0, rgba(tone, 1), 0.55, rgba(tone, 0.6), 1, rgba(tone, 0)]);
      x.fillRect(0, 0, 32, 32);
    }
    shadowSprites[q] = c;
    return c;
  }
  const finite = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

  G.onRender(LAYER.PICKUPS - 1, (ctx) => {
    const B = G.bunny, s = B.size * A.scaleMod;
    const h = max(0, B.alt + max(0, -P.lift) * s);
    const k = 1 / (1 + h / 60);
    const sc = G.scene, rim = G.look && G.look.rim;
    const night = sat(finite(sc && sc.night, 0));
    const dir = max(-1, min(1, finite(rim && rim.dir, 0)));
    const w = 46 * s, y = G.GROUND + 0.5;
    const cx = B.x + A.heroShift + 1.5 * s - dir * 6 * k * s * (1 - night);
    const sp = shadowSprite(round(night * 8));
    ctx.globalCompositeOperation = 'multiply';
    const pw = w * 0.625 * (0.8 + 0.2 * k), ph = max(0.6, 3.5 * k * s);
    ctx.globalAlpha = 0.28 * k + 0.04;
    ctx.drawImage(sp, cx - pw, y - ph, pw * 2, ph * 2);
    const uw = w * 0.31 * (0.55 + 0.45 * k), uh = max(0.4, 1.6 * k * s);
    ctx.globalAlpha = 0.55 * k;
    ctx.drawImage(sp, cx - uw, y - uh, uw * 2, uh * 2);
  });

  G.onRender(LAYER.BUNNY, (ctx) => {
    const B = G.bunny, s = B.size * A.scaleMod;
    P.out = max(2, 2.3 / max(0.05, s * G.scale));
    ctx.translate(B.x + A.heroShift, G.GROUND - B.alt);
    ctx.scale(s, s);
    drawBunny(ctx, P);
  });

  // Контурный свет рисуется после общего света на актёрах (слой 65): это свет, его не тонирует ambient.
  G.onRender(LAYER.BUNNY + 5.5, (ctx) => {
    const look = G.look, rim = look && look.rim;
    if (!rim) return;
    const ra = sat(finite(rim.a, 0)), dir = max(-1, min(1, finite(rim.dir, 0)));
    const lit = sat(finite(look.lit, 0));
    const back = min(1, ra * (0.3 + 0.7 * max(0, -dir)) + 0.45 * lit);
    const front = min(1, ra * max(0, dir) + 0.45 * lit);
    if (back < 0.02 && front < 0.02) return;
    const B = G.bunny, s = B.size * A.scaleMod, p = P;
    ctx.translate(B.x + A.heroShift, G.GROUND - B.alt);
    ctx.scale(s, s);
    if (p.lift) ctx.translate(0, p.lift);
    if (p.rot) {
      ctx.translate(PIVOT_X, PIVOT_Y);
      ctx.rotate(p.rot);
      ctx.translate(-PIVOT_X, -PIVOT_Y);
    }
    ctx.scale(p.sx, p.sy);
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = typeof rim.css === 'string' ? rim.css : rgba(rim.rgb || WHITE);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = finite(typeof look.lw === 'function' ? look.lw(1.2, 1.4) : 1.2, 1.2) / max(0.2, s);
    if (back >= 0.02) {
      ctx.globalAlpha = back;
      ctx.stroke(geo.bodyRim);
    }
    if (front >= 0.02) {
      ctx.globalAlpha = front;
      ctx.stroke(geo.bodyRimFront);
    }
    headXf(ctx, p);
    if (back >= 0.02) {
      ctx.globalAlpha = back;
      ctx.stroke(geo.headRimBack);
    }
    if (front >= 0.02) {
      ctx.globalAlpha = front;
      ctx.stroke(geo.headRimFront);
    }
  });

  function thumbPose(id) {
    const p = TP;
    p.skin = id;
    p.t = 1.35;
    p.out = 2.2;
    p.headRot = -0.04;
    p.earF = -1.0;
    p.earB = -0.78;
    p.eyeScale = 1.08;
    p.dangle = 0.35;
    p.glint = -6;
    p.shades = 1;
    return p;
  }

  G.renderBunnyThumb = (canvas, skinId) => {
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    if (!ctx || !(w > 0) || !(h > 0)) return;
    const id = SKIN_IDS.has(skinId) ? skinId : 'classic';
    const pal = palette(id);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = min(w / 78, h / 66);
    ctx.translate(w / 2 - 1.5 * s, h / 2 + 25 * s);
    ctx.scale(s, s);
    ctx.save();
    ctx.translate(1.5, 0.6);
    ctx.scale(27, 5);
    ctx.fillStyle = pal.shadow;
    ctx.fill(geo.unit);
    ctx.restore();
    drawBunny(ctx, thumbPose(id));
    ctx.restore();
  };

  livePose();
})();
