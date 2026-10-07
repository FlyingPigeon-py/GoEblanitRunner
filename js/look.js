/* Свет и кадр: уровни качества G.gfx, свет на актёрах, грейд суток, виньетка, зерно, передний свет и свечения (G.look). Владелец — графика B. */
(() => {
  'use strict';
  const G = window.G;
  const M = 60;
  const L_A2 = 65, L_FRONT = 66, L_GLOW = 67, L_FLARE = 81, L_POST = 82, L_PERF = 90.9;

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const mod = (a, n) => ((a % n) + n) % n;
  const lerp = (a, b, k) => a + (b - a) * k;
  const fin = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const hexRGB = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum3 = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const rgbKey = (r, g, b) => `${(r & 248) | 4},${(g & 248) | 4},${(b & 248) | 4}`;

  function parseColor(v, out) {
    if (Array.isArray(v) || ArrayBuffer.isView(v)) {
      out[0] = clamp(fin(v[0], 0), 0, 255);
      out[1] = clamp(fin(v[1], 0), 0, 255);
      out[2] = clamp(fin(v[2], 0), 0, 255);
      return true;
    }
    if (typeof v === 'number') {
      out[0] = (v >> 16) & 255; out[1] = (v >> 8) & 255; out[2] = v & 255;
      return true;
    }
    if (typeof v !== 'string') return false;
    const s = v.trim();
    let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      const n = parseInt(h, 16);
      out[0] = (n >> 16) & 255; out[1] = (n >> 8) & 255; out[2] = n & 255;
      return true;
    }
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s) || /^([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)$/.exec(s);
    if (!m) return false;
    out[0] = clamp(+m[1], 0, 255); out[1] = clamp(+m[2], 0, 255); out[2] = clamp(+m[3], 0, 255);
    return true;
  }

  const query = {};
  try {
    const qs = String((window.location && window.location.search) || '').replace(/^\?/, '');
    for (const part of qs.split('&')) {
      if (!part) continue;
      const i = part.indexOf('=');
      query[decodeURIComponent(i < 0 ? part : part.slice(0, i))] = i < 0 ? '' : decodeURIComponent(part.slice(i + 1));
    }
  } catch (e) {}

  function newCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Кэш спрайтов с вытеснением самого старого: ключ — строка цвета.
  function spriteCache(cap, build) {
    const map = new Map();
    return (key) => {
      let sp = map.get(key);
      if (sp) {
        map.delete(key);
        map.set(key, sp);
        return sp;
      }
      sp = build(key);
      map.set(key, sp);
      if (map.size > cap) {
        const old = map.keys().next().value;
        const c = map.get(old);
        map.delete(old);
        if (c && c.width) c.width = c.height = 1;
      }
      return sp;
    };
  }

  let dark = false;
  G.on('theme', (t) => { dark = t && typeof t.dark === 'boolean' ? t.dark : G.isDark(); });

  const visClock = () => {
    const sc = G.scene;
    if (sc && typeof sc.clock === 'number' && Number.isFinite(sc.clock)) return mod(sc.clock, 1440);
    const S = G.state, base = Number(G.clockMin()) || 0;
    const frac = S.mode === 'start' ? 0 : mod(S.t * ((G.cfg && G.cfg.minPerSec) || 4), 1);
    return mod(base + frac, 1440);
  };

  // ---------- B1. уровни качества ----------
  const TIER_K = [0, 0.3, 0.4], GLOW_CAP = [6, 12, 32], BEAM_A = [0, 0.2, 0.3];
  const forced = /^[012]$/.test(query.gfx || '') ? Number(query.gfx) : -1;
  const storedTier = Number(G.store.get('eblan.gfx.tier', 2));
  const tierLog = [];
  const gfx = {
    tier: forced >= 0 ? forced : storedTier === 0 || storedTier === 1 ? storedTier : 2,
    auto: forced < 0,
    set(t, reason) { setTier(t, reason || 'set'); },
  };
  G.gfx = gfx;

  const WIN = 120;
  const ringSlow = new Uint8Array(WIN), ringMs = new Float32Array(WIN);
  const perf = { n: 0, i: 0, mi: 0, slow: 0, sinceCheck: 0, hold: 1.5, lastChange: -1e9, runFrames: 0, runSlow: 0, prevRunT: 0, prevRunSlow: 1 };

  function logTier(from, to, reason) {
    tierLog.push({ t: +G.state.realT.toFixed(2), from, to, reason });
    if (tierLog.length > 20) tierLog.shift();
  }
  function resetWindow(hold) {
    perf.n = 0;
    perf.i = 0;
    perf.slow = 0;
    perf.sinceCheck = 0;
    perf.hold = Math.max(perf.hold, hold);
  }
  function setTier(t, reason) {
    t = Math.round(Number(t));
    if (!Number.isFinite(t)) return;
    t = clamp(t, 0, 2);
    if (t === gfx.tier) return;
    logTier(gfx.tier, t, reason);
    gfx.tier = t;
    if (forced < 0) G.store.set('eblan.gfx.tier', t);
    perf.lastChange = G.state.realT;
    resetWindow(1.5);
    G.emit('gfx', { tier: t });
  }
  function sampleFrame(realDt) {
    if (!(realDt > 0)) return;
    ringMs[perf.mi] = realDt * 1000;
    perf.mi = (perf.mi + 1) % WIN;
    if (perf.hold > 0) {
      perf.hold -= realDt;
      return;
    }
    if (G.scene && G.scene.building) return;
    const slow = realDt > 0.02 ? 1 : 0;
    if (G.state.mode === 'run') {
      perf.runFrames++;
      perf.runSlow += slow;
    }
    if (perf.n === WIN) perf.slow -= ringSlow[perf.i];
    else perf.n++;
    ringSlow[perf.i] = slow;
    perf.slow += slow;
    perf.i = (perf.i + 1) % WIN;
    if (++perf.sinceCheck >= 30) {
      perf.sinceCheck = 0;
      if (!gfx.auto || gfx.tier === 0 || perf.n < 30) return;
      const frac = perf.slow / perf.n, since = G.state.realT - perf.lastChange;
      if ((frac >= 0.25 && since >= 5) || (frac >= 0.6 && since >= 2)) setTier(gfx.tier - 1, `медленных кадров ${Math.round(frac * 100)}%`);
    }
  }
  const hold = () => resetWindow(1.5);
  G.on('resize', hold);
  G.on('theme', hold);
  G.on('resume', hold);
  try { document.addEventListener('visibilitychange', hold); } catch (e) {}
  G.on('die', (info) => {
    perf.prevRunT = fin(info && info.t, G.state.t);
    perf.prevRunSlow = perf.runFrames ? perf.runSlow / perf.runFrames : 1;
  });
  G.on('start', () => {
    if (gfx.auto && gfx.tier < 2 && perf.prevRunT >= 20 && perf.prevRunSlow < 0.05) {
      setTier(gfx.tier + 1, `прошлый забег ${Math.round(perf.prevRunT)} с, медленных ${Math.round(perf.prevRunSlow * 100)}%`);
    }
    perf.prevRunT = 0;
    perf.prevRunSlow = 1;
    perf.runFrames = 0;
    perf.runSlow = 0;
    hold();
  });

  // ---------- B2. свет на актёрах ----------
  const a2 = new Float32Array([1, 1, 1]);
  const amb = new Float32Array([1, 1, 1]);
  let kCur = TIER_K[gfx.tier], a2css = 'rgb(255,255,255)', ambLum = 1, hasAmb = false;

  function updateA2(rdt, snap) {
    const kT = TIER_K[gfx.tier];
    kCur = snap ? kT : kCur + (kT - kCur) * Math.min(1, rdt * 2);
    if (Math.abs(kCur - kT) < 0.002) kCur = kT;
    look.k = kCur;
    const src = G.scene && G.scene.amb;
    hasAmb = !!src && src.length >= 3 && Number.isFinite(src[0]) && Number.isFinite(src[1]) && Number.isFinite(src[2]);
    for (let c = 0; c < 3; c++) amb[c] = hasAmb ? clamp01(src[c]) : 1;
    ambLum = lum3(amb[0], amb[1], amb[2]);
    let mn = 1;
    for (let c = 0; c < 3; c++) {
      const v = 1 - kCur * (1 - amb[c]);
      a2[c] = v;
      if (v < mn) mn = v;
    }
    look.a2on = hasAmb && kCur > 0 && mn < 0.985;
    if (!look.a2on) a2[0] = a2[1] = a2[2] = 1;
    else a2css = `rgb(${Math.round(a2[0] * 255)},${Math.round(a2[1] * 255)},${Math.round(a2[2] * 255)})`;
  }

  // ---------- B3. грейд, виньетка, зерно ----------
  // [часы, грейд, α грейда, цвет виньетки, множитель виньетки, зерно]
  const DAY = [
    [0, 0x3a4cff, 0.1, [8, 10, 30], 1.2, 0.06],
    [300, 0x3a4cff, 0.1, [8, 10, 30], 1.2, 0.06],
    [360, 0xff9fb0, 0.1, [70, 40, 40], 1, 0.05],
    [540, 0xffe2b8, 0.08, [70, 40, 15], 1, 0.045],
    [660, 0xffe6c0, 0, [70, 40, 15], 0.8, 0.045],
    [780, 0xffe6c0, 0, [70, 40, 15], 0.8, 0.045],
    [900, 0xffe6c0, 0.06, [70, 40, 15], 1, 0.045],
    [990, 0xffd08a, 0.1, [80, 40, 12], 1, 0.045],
    [1110, 0xff9a4a, 0.18, [90, 40, 10], 1.15, 0.05],
    [1170, 0x6b78ff, 0.12, [40, 30, 70], 1, 0.055],
    [1260, 0x3a4cff, 0.1, [8, 10, 30], 1.2, 0.06],
    [1440, 0x3a4cff, 0.1, [8, 10, 30], 1.2, 0.06],
  ].map((k) => ({ m: k[0], grade: hexRGB(k[1]), gradeA: k[2], vig: k[3], vigKey: k[3].join(','), vigMult: k[4], grain: k[5] }));
  const START = { grade: hexRGB(0xffcf9a), gradeA: 0.14, grain: 0.07 };
  const FALLBACK_LOOKS = {
    office: { grade: '#e8f4ff', gradeA: 0.05 },
    metro: { grade: '#9fd0ff', gradeA: 0.06 },
  };

  const day = { grade: [0, 0, 0], gradeA: 0, vigA: '', vigB: '', vigT: 0, vigMult: 1, grain: 0.045 };
  function sampleDay(m, out) {
    let i = 0;
    while (i < DAY.length - 2 && DAY[i + 1].m <= m) i++;
    const a = DAY[i], b = DAY[i + 1];
    const t = smooth((m - a.m) / (b.m - a.m));
    for (let c = 0; c < 3; c++) out.grade[c] = lerp(a.grade[c], b.grade[c], t);
    out.gradeA = lerp(a.gradeA, b.gradeA, t);
    out.vigA = a.vigKey;
    out.vigB = b.vigKey;
    out.vigT = t;
    out.vigMult = lerp(a.vigMult, b.vigMult, t);
    out.grain = lerp(a.grain, b.grain, t);
    return out;
  }

  function locLook() {
    const sc = G.scene, loc = sc && sc.loc;
    const id = loc && loc.id;
    if (!id) return null;
    if (loc.look && typeof loc.look === 'object') return loc.look;
    const own = G.locLooks && G.locLooks[id];
    if (own && typeof own === 'object') return own;
    const def = G.locations && G.locations[id];
    if (def && def.look && typeof def.look === 'object') return def.look;
    return FALLBACK_LOOKS[id] || null;
  }

  const post = {
    startK: 1,
    grade: [255, 226, 184], gradeA: 0,
    vigMult: 1, grain: 0.045, vigA: 0.3,
    tGrade: [0, 0, 0], tGradeA: 0, tVigMult: 1, tGrain: 0.045,
    gradeCss: 'rgb(255,226,184)',
  };
  const vmix = [];
  function vigTarget(key, w) {
    if (!(w > 0.0005)) return;
    for (const e of vmix) if (e.key === key) { e.tw += w; return; }
    vmix.push({ key, w: 0, tw: w });
  }
  const tmpRGB = [0, 0, 0];

  function updatePost(rdt, snap) {
    const S = G.state, sc = G.scene || {};
    post.startK += ((S.mode === 'start' ? 1 : 0) - post.startK) * (snap ? 1 : Math.min(1, rdt * 3));
    const sk = post.startK;
    const d = sampleDay(visClock(), day);
    const tg = post.tGrade;
    for (let c = 0; c < 3; c++) tg[c] = lerp(d.grade[c], START.grade[c], sk);
    post.tGradeA = lerp(d.gradeA, START.gradeA, sk);
    post.tGrain = lerp(d.grain, START.grain, sk);
    post.tVigMult = d.vigMult;
    for (const e of vmix) e.tw = 0;
    const lk = locLook();
    let ownVig = false;
    if (lk) {
      if (lk.grade != null && parseColor(lk.grade, tmpRGB)) for (let c = 0; c < 3; c++) tg[c] = tmpRGB[c];
      if (typeof lk.gradeA === 'number' && Number.isFinite(lk.gradeA)) post.tGradeA = lk.gradeA;
      if (lk.vig != null && parseColor(lk.vig, tmpRGB)) {
        ownVig = true;
        vigTarget(`${Math.round(tmpRGB[0])},${Math.round(tmpRGB[1])},${Math.round(tmpRGB[2])}`, 1);
        if (typeof lk.vigA === 'number' && Number.isFinite(lk.vigA)) post.tVigMult = lk.vigA;
      }
    }
    if (!ownVig) {
      vigTarget(d.vigA, 1 - d.vigT);
      vigTarget(d.vigB, d.vigT);
    }
    post.tGradeA = clamp(post.tGradeA, 0, 0.2) * (dark ? 0.8 : 1);

    const k = snap ? 1 : 1 - Math.exp(-rdt / 0.35);
    for (let c = 0; c < 3; c++) post.grade[c] += (tg[c] - post.grade[c]) * k;
    post.gradeA += (post.tGradeA - post.gradeA) * k;
    post.vigMult += (post.tVigMult - post.vigMult) * k;
    post.grain += (post.tGrain - post.grain) * k;
    for (let i = vmix.length - 1; i >= 0; i--) {
      const e = vmix[i];
      e.w = snap ? e.tw : e.w + (e.tw - e.w) * k;
      if (e.tw === 0 && e.w < 0.003) vmix.splice(i, 1);
    }
    post.gradeCss = `rgb(${Math.round(post.grade[0])},${Math.round(post.grade[1])},${Math.round(post.grade[2])})`;
    const tk = snap ? 1 : 1 - Math.exp(-rdt / 0.25);
    for (const [owner, e] of tints) {
      e.cur += (e.a - e.cur) * tk;
      if (e.a === 0 && e.cur < 0.003) tints.delete(owner);
    }
    const night = clamp01(fin(sc.night, 0));
    post.vigA = Math.min(0.8, (dark ? 0.34 : 0.22) + night * 0.18 + sk * 0.2) * post.vigMult;
  }

  const tintSprite = spriteCache(4, (key) => {
    const c = newCanvas(128, 128);
    const x = c.getContext('2d');
    if (x) {
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 91);
      g.addColorStop(0, `rgba(${key},0)`);
      g.addColorStop(0.5, `rgba(${key},0)`);
      g.addColorStop(0.72, `rgba(${key},0.32)`);
      g.addColorStop(0.88, `rgba(${key},0.62)`);
      g.addColorStop(1, `rgba(${key},0.9)`);
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
    }
    return c;
  });
  const vigSprite = spriteCache(4, (key) => {
    const c = newCanvas(128, 128);
    const x = c.getContext('2d');
    if (x) {
      const rgb = key.split(',').map(Number);
      const deep = rgb.map((v) => Math.round(v * 0.75)).join(',');
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 91);
      g.addColorStop(0, `rgba(${key},0)`);
      g.addColorStop(0.55, `rgba(${key},0)`);
      g.addColorStop(0.8, `rgba(${key},0.28)`);
      g.addColorStop(1, `rgba(${deep},0.7)`);
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
    }
    return c;
  });

  const grain = { tile: null, pat: null, ox: 0, oy: 0, frame: 0 };
  function grainPattern(ctx) {
    if (grain.pat) return grain.pat;
    if (!grain.tile) {
      const c = newCanvas(128, 128), x = c.getContext('2d');
      if (!x || !x.createImageData) return null;
      const img = x.createImageData(128, 128), data = img.data;
      for (let i = 0; i < data.length; i += 4) {
        const v = 128 + Math.round((Math.random() * 2 - 1) * 48);
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      grain.tile = c;
    }
    grain.pat = ctx.createPattern(grain.tile, 'repeat') || null;
    return grain.pat;
  }

  // ---------- B4. передний свет, at(), свечения ----------
  function buildBeamSprite(key) {
    const c = newCanvas(32, 128), x = c.getContext('2d');
    if (x) {
      const g = x.createLinearGradient(0, 0, 32, 0);
      g.addColorStop(0, `rgba(${key},0)`);
      g.addColorStop(0.28, `rgba(${key},0.55)`);
      g.addColorStop(0.5, `rgba(${key},1)`);
      g.addColorStop(0.72, `rgba(${key},0.55)`);
      g.addColorStop(1, `rgba(${key},0)`);
      x.fillStyle = g;
      x.fillRect(0, 0, 32, 128);
      x.globalCompositeOperation = 'destination-in';
      const v = x.createLinearGradient(0, 0, 0, 128);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(0.12, 'rgba(0,0,0,1)');
      v.addColorStop(0.55, 'rgba(0,0,0,0.55)');
      v.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = v;
      x.fillRect(0, 0, 32, 128);
    }
    return c;
  }
  function buildGlowSprite(key) {
    const c = newCanvas(64, 64), x = c.getContext('2d');
    if (x) {
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, `rgba(${key},1)`);
      g.addColorStop(0.3, `rgba(${key},0.45)`);
      g.addColorStop(1, `rgba(${key},0)`);
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
    }
    return c;
  }
  function buildStripSprite(key) {
    const c = newCanvas(64, 64), x = c.getContext('2d');
    if (x) {
      const g = x.createLinearGradient(0, 0, 64, 0);
      g.addColorStop(0, `rgba(${key},0)`);
      g.addColorStop(0.2, `rgba(${key},1)`);
      g.addColorStop(0.8, `rgba(${key},1)`);
      g.addColorStop(1, `rgba(${key},0)`);
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      x.globalCompositeOperation = 'destination-in';
      const v = x.createLinearGradient(0, 0, 0, 64);
      v.addColorStop(0, 'rgba(0,0,0,1)');
      v.addColorStop(0.35, 'rgba(0,0,0,0.45)');
      v.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = v;
      x.fillRect(0, 0, 64, 64);
    }
    return c;
  }
  const beamSprite = spriteCache(4, buildBeamSprite);
  const lightSprite = spriteCache(16, buildGlowSprite);
  const stripSprite = spriteCache(4, buildStripSprite);

  const okLight = (l) => l && typeof l.x === 'number' && Number.isFinite(l.x) && Number.isFinite(l.y) && l.w > 0 && l.h > 0 && l.a > 0 && Number.isFinite(l.w + l.h + l.a);

  function at(x, alt) {
    const L = G.scene && G.scene.lights;
    if (!L || !(L.n > 0) || !L.list || !Number.isFinite(x) || !Number.isFinite(alt)) return 0;
    const y = G.GROUND - alt, n = Math.min(L.n, L.list.length);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const l = L.list[i];
      if (!okLight(l)) continue;
      const dx = x - l.x, dy = y - l.y;
      if (l.kind === 'beam') {
        const ang = fin(l.ang, 0), s = Math.sin(ang), c = Math.cos(ang);
        const along = dx * s + dy * c;
        if (along < 0 || along > l.h) continue;
        const u = (dx * c - dy * s) / (l.w / 2);
        if (u > -1 && u < 1) sum += (1 - u * u) * l.a;
      } else if (l.kind === 'glow') {
        const u = dx / (l.w / 2), v = dy / (l.h / 2);
        const d = Math.sqrt(u * u + v * v);
        if (d < 1) sum += (1 - d) * l.a;
      } else if (l.kind === 'strip') {
        const u = dx / (l.w / 2);
        if (dy < 0 || dy > l.h || u <= -1 || u >= 1) continue;
        sum += (1 - dy / l.h) * (1 - u * u) * l.a;
      }
      if (sum >= 1) return 1;
    }
    return sum;
  }

  const GLOW_MAX = 32;
  const gl = { n: 0, x: new Float32Array(GLOW_MAX), alt: new Float32Array(GLOW_MAX), r: new Float32Array(GLOW_MAX), a: new Float32Array(GLOW_MAX), key: new Array(GLOW_MAX).fill('') };
  function glow(x, alt, r, rgb, a) {
    if (gl.n >= GLOW_CAP[gfx.tier]) return false;
    if (!Number.isFinite(x) || !Number.isFinite(alt) || !(r > 0) || !(a > 0) || !Number.isFinite(r + a)) return false;
    if (!parseColor(rgb, tmpRGB)) return false;
    const i = gl.n++;
    gl.x[i] = x;
    gl.alt[i] = alt;
    gl.r[i] = Math.min(r, 400);
    gl.a[i] = Math.min(1, a);
    gl.key[i] = rgbKey(tmpRGB[0] | 0, tmpRGB[1] | 0, tmpRGB[2] | 0);
    return true;
  }
  const GLOW_K = [[0, 1], [300, 1], [360, 0.35], [1020, 0.35], [1170, 0.7], [1260, 1], [1440, 1]];
  function glowK(m) {
    let i = 0;
    while (i < GLOW_K.length - 2 && GLOW_K[i + 1][0] <= m) i++;
    const a = GLOW_K[i], b = GLOW_K[i + 1];
    return lerp(a[1], b[1], smooth((m - a[0]) / (b[0] - a[0])));
  }

  // ---------- B6. контурный свет для кролика ----------
  const RIM_DAY = hexRGB(0xfff1d6), RIM_GOLD = hexRGB(0xffb070), RIM_MOON = hexRGB(0xa8c4ff);
  const rim = { rgb: [255, 241, 214], a: 0, dir: -1, css: 'rgb(255,241,214)' };
  let bunnyLit = 0;
  function updateRim(rdt, snap) {
    const sc = G.scene || {}, B = G.bunny;
    const night = clamp01(fin(sc.night, 0)), gold = clamp01(fin(sc.sunset, 0));
    const m = visClock();
    const df = (m - 390) / 780;
    const sunUp = df > 0 && df < 1 ? clamp01(Math.sin(Math.PI * df) * 4) : 0;
    const beamAng = clamp((0.5 - clamp01(df)) * 1.25, -0.75, 0.75);
    const litNow = at(B.x, B.alt + 22 * (B.size || 1));
    bunnyLit += (litNow - bunnyLit) * (snap ? 1 : 1 - Math.exp(-rdt / 0.08));
    const wet = sc.weather === 'rain' ? clamp01(fin(sc.weatherK, 0)) * 0.6 : 0;

    const sunMax = lerp(0.55, 0.85, gold);
    const wS = (sc.outdoor ? sunMax : 0.1 + (sunMax - 0.1) * clamp01(bunnyLit * 2)) * sunUp * (1 - night) * (1 - wet);
    const dS = -clamp(beamAng / 0.25, -1, 1);
    let wL = 0, dL = 0, lr = 255, lg = 194, lb = 122;
    const L = sc.lights;
    if (L && L.n > 0 && L.list) {
      const n = Math.min(L.n, L.list.length);
      for (let i = 0; i < n; i++) {
        const l = L.list[i];
        if (!okLight(l) || l.kind !== 'glow') continue;
        const reach = Math.max(l.w, l.h) * 0.6 + 40;
        const w = clamp01(1 - Math.abs(l.x - B.x) / reach) * Math.min(1, l.a) * 0.75;
        if (w > wL) {
          wL = w;
          dL = l.x >= B.x ? 1 : -1;
          lr = fin(l.r, 255); lg = fin(l.g, 194); lb = fin(l.b, 122);
        }
      }
    }
    const wM = 0.5 * night * (1 - wet);
    const tot = wS + wL + wM;
    let tr = rim.rgb[0], tgc = rim.rgb[1], tb = rim.rgb[2], ta = 0, td = rim.dir;
    if (tot > 0.001) {
      const sr = lerp(RIM_DAY[0], RIM_GOLD[0], gold), sg = lerp(RIM_DAY[1], RIM_GOLD[1], gold), sb = lerp(RIM_DAY[2], RIM_GOLD[2], gold);
      tr = (sr * wS + lr * wL + RIM_MOON[0] * wM) / tot;
      tgc = (sg * wS + lg * wL + RIM_MOON[1] * wM) / tot;
      tb = (sb * wS + lb * wL + RIM_MOON[2] * wM) / tot;
      const mx = Math.max(wS, wL, wM);
      ta = Math.min(0.9, mx + 0.3 * (tot - mx));
      td = (dS * wS + dL * wL) / tot;
    }
    const k = snap ? 1 : 1 - Math.exp(-rdt * 5);
    rim.rgb[0] += (tr - rim.rgb[0]) * k;
    rim.rgb[1] += (tgc - rim.rgb[1]) * k;
    rim.rgb[2] += (tb - rim.rgb[2]) * k;
    rim.a += (ta - rim.a) * k;
    rim.dir += (td - rim.dir) * k;
    rim.css = `rgb(${Math.round(rim.rgb[0])},${Math.round(rim.rgb[1])},${Math.round(rim.rgb[2])})`;
    look.lit = bunnyLit;
  }

  // ---------- B5. рампа в OKLCH и толщина линий ----------
  const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const toSrgb = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  function toOklch(rgb) {
    const r = toLin(rgb[0]), g = toLin(rgb[1]), b = toLin(rgb[2]);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.sqrt(A * A + B * B), Math.atan2(B, A) * 180 / Math.PI];
  }
  function oklchLinear(L, C, h) {
    const hr = h * Math.PI / 180, A = C * Math.cos(hr), B = C * Math.sin(hr);
    const l = L + 0.3963377774 * A + 0.2158037573 * B;
    const m = L - 0.1055613458 * A - 0.0638541728 * B;
    const s = L - 0.0894841775 * A - 1.291485548 * B;
    const l3 = l * l * l, m3 = m * m * m, s3 = s * s * s;
    return [
      4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
      -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
      -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
    ];
  }
  const inGamut = (c) => c[0] >= -1e-4 && c[0] <= 1.0001 && c[1] >= -1e-4 && c[1] <= 1.0001 && c[2] >= -1e-4 && c[2] <= 1.0001;
  function oklchHex(L, C, h) {
    L = clamp(L, 0, 1);
    let c = oklchLinear(L, C, h);
    if (!inGamut(c)) {
      let lo = 0, hi = C;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (inGamut(oklchLinear(L, mid, h))) lo = mid;
        else hi = mid;
      }
      c = oklchLinear(L, lo, h);
    }
    let out = '#';
    for (let i = 0; i < 3; i++) out += Math.round(clamp(toSrgb(clamp(c[i], 0, 1)), 0, 255)).toString(16).padStart(2, '0');
    return out;
  }
  function towards(h, target, maxDeg) {
    const d = mod(target - h + 180, 360) - 180;
    return h + clamp(d, -maxDeg, maxDeg);
  }
  const rampCache = new Map();
  function ramp(hex) {
    const key = String(hex);
    let r = rampCache.get(key);
    if (r) return r;
    const rgb = [0, 0, 0];
    if (!parseColor(hex, rgb)) rgb[0] = rgb[1] = rgb[2] = 136;
    const [L, C, h] = toOklch(rgb);
    const grey = C < 0.01;
    const hh = (t, d) => (grey ? h : towards(h, t, d));
    r = {
      hi: oklchHex(L + 0.06, C * 0.85, hh(95, 8)),
      base: oklchHex(L, C, h),
      shade: oklchHex(L - 0.09, C * 1.05, hh(275, 12)),
      deep: oklchHex(L - 0.2, C, hh(275, 20)),
      line: oklchHex(Math.max(0.12, L - 0.4), C * 0.8, hh(285, 25)),
    };
    if (rampCache.size > 256) rampCache.clear();
    rampCache.set(key, r);
    return r;
  }
  const lw = (wu, px) => Math.max(wu, px / (G.scale || 1));

  // ---------- цветные края кадра от модулей: владелец → цвет и сила ----------
  const tints = new Map();
  function tint(owner, color, a) {
    if (!owner) return false;
    const e = tints.get(owner);
    if (color == null || !(a > 0)) {
      if (e) e.a = 0;
      return true;
    }
    if (!e || e.color !== color) {
      if (!parseColor(color, tmpRGB)) return false;
      const key = rgbKey(tmpRGB[0] | 0, tmpRGB[1] | 0, tmpRGB[2] | 0);
      if (e) {
        e.color = color;
        e.key = key;
      } else {
        tints.set(owner, { color, key, a: 0, cur: 0 });
      }
    }
    tints.get(owner).a = Math.min(1, a);
    return true;
  }

  // ---------- G.look ----------
  const look = {
    post: true,
    a2, a2on: false, k: kCur, amb,
    lit: 0,
    glow, at, rim, ramp, lw, tint,
    tier: () => gfx.tier,
    debug: { fse: 0, glows: 0, tierLog, perf },
    debugAt(clock) {
      const d = sampleDay(mod(fin(Number(clock), 540), 1440), { grade: [0, 0, 0] });
      return {
        clock: mod(fin(Number(clock), 540), 1440),
        grade: d.grade.map(Math.round), gradeA: d.gradeA, vigA: d.vigA, vigB: d.vigB, vigT: d.vigT, vigMult: d.vigMult, grain: d.grain,
        glowK: glowK(mod(fin(Number(clock), 540), 1440)),
        a2: Array.from(a2), k: kCur, tier: gfx.tier, rim: { rgb: rim.rgb.map(Math.round), a: rim.a, dir: rim.dir },
      };
    },
  };
  G.look = look;

  const flare = { t: -1, sp: null };
  let snapNext = true;
  G.onUpdate((dt, realDt) => {
    const rdt = fin(realDt, 0);
    sampleFrame(rdt);
    const snap = snapNext;
    snapNext = false;
    updateA2(rdt, snap);
    updatePost(rdt, snap);
    updateRim(rdt, snap);
    if (flare.t >= 0) {
      flare.t += rdt;
      if (flare.t > 1) flare.t = -1;
    }
  }, 5);

  // ---------- рендер ----------
  let fse = 0;
  G.onRender(-1, () => { look.debug.fse = fse; fse = 0; });

  G.onRender(L_A2, (ctx) => {
    if (!look.a2on) return;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = a2css;
    ctx.fillRect(-M, -M, G.W + M * 2, G.H + M * 2);
    fse++;
  });

  G.onRender(L_FRONT, (ctx) => {
    const tier = gfx.tier;
    if (!tier) return;
    const L = G.scene && G.scene.lights;
    if (!L || !(L.n > 0) || !L.list) return;
    const n = Math.min(L.n, L.list.length);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < n; i++) {
      const l = L.list[i];
      if (!okLight(l)) continue;
      const key = rgbKey(fin(l.r, 255) | 0, fin(l.g, 240) | 0, fin(l.b, 210) | 0);
      if (l.kind === 'beam') {
        ctx.globalAlpha = Math.min(1, l.a * BEAM_A[tier]);
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(-fin(l.ang, 0));
        ctx.drawImage(beamSprite(key), -l.w / 2, 0, l.w, l.h);
        ctx.restore();
      } else if (l.kind === 'glow') {
        ctx.globalAlpha = Math.min(1, l.a * 0.22);
        ctx.drawImage(lightSprite(key), l.x - l.w / 2, l.y - l.h / 2, l.w, l.h);
      } else if (l.kind === 'strip') {
        ctx.globalAlpha = Math.min(1, l.a * 0.2);
        ctx.drawImage(stripSprite(key), l.x - l.w / 2, l.y, l.w, l.h);
      }
    }
  });

  G.onRender(L_GLOW, (ctx) => {
    const n = gl.n;
    look.debug.glows = n;
    if (!n) return;
    gl.n = 0;
    const gk = (0.35 + 0.65 * (1 - ambLum)) * glowK(visClock());
    const GR = G.GROUND;
    ctx.globalCompositeOperation = ambLum < 0.55 ? 'lighter' : 'screen';
    for (let i = 0; i < n; i++) {
      const sp = lightSprite(gl.key[i]), r = gl.r[i], alt = gl.alt[i], a = gl.a[i] * gk;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(sp, gl.x[i] - r, GR - alt - r, r * 2, r * 2);
      if (alt < 80) {
        ctx.globalAlpha = Math.min(1, a * 0.5 * (1 - Math.max(0, alt) / 80));
        ctx.drawImage(sp, gl.x[i] - r * 0.8, GR - 4, r * 1.6, 8);
      }
    }
  });

  // ---------- B10. анаморфный блик в 17:59 ----------
  G.on('milestone', (m) => {
    if (!m || m.min !== 539 || G.calm || G.state.mode !== 'run') return;
    flare.t = 0;
  });
  G.on('start', () => { flare.t = -1; });
  function flareSprite() {
    if (flare.sp) return flare.sp;
    const c = newCanvas(64, 16), x = c.getContext('2d');
    if (x) {
      const g = x.createLinearGradient(0, 0, 64, 0);
      g.addColorStop(0, 'rgba(255,170,90,0)');
      g.addColorStop(0.35, 'rgba(255,190,120,0.55)');
      g.addColorStop(0.5, 'rgba(255,236,200,1)');
      g.addColorStop(0.65, 'rgba(255,190,120,0.55)');
      g.addColorStop(1, 'rgba(255,170,90,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 16);
      x.globalCompositeOperation = 'destination-in';
      const v = x.createLinearGradient(0, 0, 0, 16);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(0.5, 'rgba(0,0,0,1)');
      v.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = v;
      x.fillRect(0, 0, 64, 16);
    }
    flare.sp = c;
    return c;
  }
  G.onRender(L_FLARE, (ctx) => {
    if (flare.t < 0 || G.calm) return;
    const sun = G.scene && G.scene.sun;
    const y = sun && sun.vis && Number.isFinite(sun.y) ? clamp(sun.y, 10, G.GROUND - 120) : G.GROUND - 180;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 * (1 - flare.t);
    ctx.drawImage(flareSprite(), -M, y - 9, G.W + M * 2, 18);
  });

  // ---------- B3. общий проход кадра ----------
  G.onRender(L_POST, (ctx) => {
    const s = (G.scale || 1) * (G.dpr || 1), W = G.W, H = G.H, tier = gfx.tier;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    if (tier >= 1 && post.gradeA > 0.003) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = post.gradeA;
      ctx.fillStyle = post.gradeCss;
      ctx.fillRect(0, 0, W, H);
      fse++;
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const e of vmix) {
      const a = post.vigA * e.w;
      if (a < 0.004) continue;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(vigSprite(e.key), -2, -2, W + 4, H + 4);
      fse++;
    }
    for (const e of tints.values()) {
      if (e.cur < 0.004) continue;
      ctx.globalAlpha = Math.min(1, e.cur);
      ctx.drawImage(tintSprite(e.key), -2, -2, W + 4, H + 4);
      fse++;
    }
    if (tier === 2 && post.grain > 0.002) {
      const pat = grainPattern(ctx);
      if (pat) {
        const gs = G.dpr >= 2 ? 2 : 1;
        if (!G.calm && G.state.mode !== 'pause' && (++grain.frame & 1) === 0) {
          grain.ox = Math.floor(Math.random() * 128);
          grain.oy = Math.floor(Math.random() * 128);
        }
        ctx.setTransform(gs, 0, 0, gs, 0, 0);
        ctx.translate(grain.ox, grain.oy);
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = post.grain;
        ctx.fillStyle = pat;
        ctx.fillRect(-grain.ox, -grain.oy, G.canvas.width / gs, G.canvas.height / gs);
        fse++;
      }
    }
  });

  // ---------- отладка: ?perf, ?gray, ?cvd ----------
  if ('perf' in query) {
    const sorted = new Float32Array(WIN);
    G.onRender(L_PERF, (ctx) => {
      sorted.set(ringMs);
      sorted.sort();
      const p50 = sorted[WIN >> 1], p95 = sorted[Math.floor(WIN * 0.95)];
      const dbg = G.scene && G.scene.debug;
      const lines = [
        `кадр p50 ${p50.toFixed(1)} мс · p95 ${p95.toFixed(1)} мс`,
        `gfx ${gfx.tier}${gfx.auto ? ' авто' : ''} · FSE ${look.debug.fse} · свечений ${look.debug.glows}`,
        `a2 ${look.a2on ? Array.from(a2, (v) => v.toFixed(2)).join(' ') : 'выкл'}`,
      ];
      if (dbg) lines.push(`спрайты ${fin(dbg.spriteMB, 0).toFixed(1)} МБ · сборка ${fin(dbg.buildMs, 0).toFixed(0)} мс`);
      const last = tierLog[tierLog.length - 1];
      if (last) lines.push(`уровень ${last.from}→${last.to}: ${last.reason}`);
      const y0 = G.H - 14 - lines.length * 12;
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = '#000';
      ctx.fillRect(4, y0 - 11, 230, lines.length * 12 + 6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      G.draw.font(ctx, 500, 10, 'body');
      for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], 8, y0 + i * 12);
    });
  }
  G.on('boot', () => {
    try {
      if ('gray' in query) G.canvas.style.filter = 'grayscale(1) blur(1.5px)';
      else if ('cvd' in query) {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.position = 'absolute';
        const f = document.createElementNS(NS, 'filter');
        f.setAttribute('id', 'eblanCvd');
        const cm = document.createElementNS(NS, 'feColorMatrix');
        cm.setAttribute('type', 'matrix');
        cm.setAttribute('values', '0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0');
        f.appendChild(cm);
        svg.appendChild(f);
        document.body.appendChild(svg);
        G.canvas.style.filter = 'url(#eblanCvd)';
      }
    } catch (e) {}
  });
})();
