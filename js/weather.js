/* Погода: уличный дождь и снег слоями с кажущимся ветром, порывы, гроза с ветвистой молнией, капли на стекле. Владелец — графика C. */
(() => {
  'use strict';
  const G = window.G;
  const { TAU, LAYER } = G;
  const clamp = G.clamp;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const M = 60;

  let calm = !!G.calm;
  G.on('calm', (v) => { calm = !!v; });
  let dark = false;
  const tier = () => (G.gfx && typeof G.gfx.tier === 'number' ? clamp(Math.round(G.gfx.tier), 0, 2) : 2);
  const sceneOf = () => G.scene || {};
  const fxDuck = () => (G.fx && Number.isFinite(G.fx.duck) ? G.fx.duck : 0);
  const px = (n) => n / (G.scale || 1);

  function hash(n, salt) {
    let h = Math.imul((n | 0) ^ Math.imul((salt | 0) + 0x632be5ab, 0x27d4eb2d), 0x9e3779b1);
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }

  // ---------- ветер: база и порывы (на улице) ----------
  const wind = { base: 0, gust: 0, gT: -1, gLen: 1.2, gPow: 0.8, next: 9 };
  function updateWind(dt, outdoor) {
    if (outdoor) {
      wind.next -= dt;
      if (wind.next <= 0 && wind.gT < 0) {
        wind.gT = 0;
        wind.gPow = rnd(0.6, 1);
        wind.next = rnd(8, 14);
      }
    }
    if (wind.gT >= 0) {
      wind.gT += dt;
      const k = wind.gT / wind.gLen;
      if (k >= 1) {
        wind.gT = -1;
        wind.gust = 0;
      } else {
        const s = Math.sin(Math.PI * k);
        wind.gust = s * s * wind.gPow;
      }
    }
  }

  // ---------- уличные осадки: три слоя глубины ----------
  const RAIN = [
    { par: 0.3, len: 6, w: 0.6, a: 0.18, n: 40, vy: 900 },
    { par: 0.7, len: 10, w: 0.9, a: 0.28, n: 36, vy: 1100 },
    { par: 1.2, len: 16, w: 1.3, a: 0.38, n: 24, vy: 1300 },
  ];
  const SNOW = [
    { par: 0.3, r: 0.8, a: 0.5, n: 50, vy: 26 },
    { par: 0.7, r: 1.3, a: 0.55, n: 40, vy: 40 },
    { par: 1.2, r: 2.6, a: 0.6, n: 30, vy: 62 },
  ];
  for (const L of RAIN.concat(SNOW)) {
    L.x = new Float32Array(L.n);
    L.y = new Float32Array(L.n);
    L.ph = new Float32Array(L.n);
    L.vx = 0;
    L.seeded = false;
  }
  function seedLayer(L, bottom) {
    const W = G.W;
    for (let i = 0; i < L.n; i++) {
      L.x[i] = rnd(-M, W + M);
      L.y[i] = rnd(-M, bottom);
      L.ph[i] = rnd(0, TAU);
    }
    L.seeded = true;
  }
  const precip = { outK: 0, kind: 0, k: 0 };

  const SPLASH_N = 16;
  const spX = new Float32Array(SPLASH_N);
  const spT = new Float32Array(SPLASH_N).fill(9);
  const dropX = new Float32Array(SPLASH_N * 2);
  const dropA = new Float32Array(SPLASH_N * 2);
  const dropVx = new Float32Array(SPLASH_N * 2);
  const dropVy = new Float32Array(SPLASH_N * 2);
  let spI = 0;
  let spTokens = 0;
  function splash(x) {
    if (spTokens < 1) return;
    spTokens -= 1;
    const i = spI;
    spI = (spI + 1) % SPLASH_N;
    spX[i] = x;
    spT[i] = 0;
    for (let k = 0; k < 2; k++) {
      const j = i * 2 + k;
      dropX[j] = x;
      dropA[j] = 0.5;
      dropVx[j] = (k ? 1 : -1) * rnd(20, 60);
      dropVy[j] = rnd(90, 160);
    }
  }

  function updatePrecip(dt) {
    const sc = sceneOf(), S = G.state;
    const outdoor = !!sc.outdoor;
    precip.outK += ((outdoor ? 1 : 0) - precip.outK) * Math.min(1, dt * 2.5);
    if (precip.outK < 0.01 && !outdoor) precip.outK = 0;
    precip.kind = sc.weather === 'rain' ? 1 : sc.weather === 'snow' ? 2 : 0;
    precip.k = precip.kind ? clamp(Number(sc.weatherK) || 0, 0, 1) * precip.outK : 0;
    spTokens = Math.min(4, spTokens + dt * 20);
    const dx = S.dx || 0;
    for (let i = 0; i < SPLASH_N; i++) {
      if (spT[i] >= 0.5) continue;
      spT[i] += dt;
      spX[i] -= dx;
      for (let k = 0; k < 2; k++) {
        const j = i * 2 + k;
        dropX[j] += dropVx[j] * dt - dx;
        dropA[j] += dropVy[j] * dt;
        dropVy[j] -= 900 * dt;
      }
    }
    if (precip.k < 0.005) return;
    const layers = precip.kind === 1 ? RAIN : SNOW;
    const W = G.W, GR = G.GROUND, H = G.H;
    const spd = S.mode === 'run' ? S.speed || 0 : 0;
    const sk = calm ? 0.5 : 1;
    const w = wind.base + wind.gust;
    for (let l = 0; l < 3; l++) {
      const L = layers[l];
      const bottom = l === 2 ? H + M : GR;
      if (!L.seeded) seedLayer(L, bottom);
      const snowK = precip.kind === 2 ? 0.5 : 1;
      L.vx = (-spd * L.par * 0.6 * snowK - w * 120) * sk;
      const vy = L.vy * sk;
      const span = bottom + M;
      const near = l === 2 && precip.kind === 1;
      const live = Math.ceil(precip.k * L.n);
      for (let i = 0; i < L.n; i++) {
        const y0 = L.y[i];
        L.x[i] += L.vx * dt;
        L.y[i] += vy * dt;
        if (near && i < live && y0 < GR && L.y[i] >= GR) splash(L.x[i]);
        if (L.y[i] > bottom) {
          L.y[i] -= span;
          L.x[i] = rnd(-M, W + M);
        }
        if (L.x[i] < -M - 20) L.x[i] += W + 2 * M + 40;
        else if (L.x[i] > W + M + 20) L.x[i] -= W + 2 * M + 40;
      }
    }
  }

  function rainColors() {
    const sc = sceneOf();
    const nk = dark ? 1 : clamp(Number(sc.night) || 0, 0, 1);
    return nk;
  }
  function drawRainLayer(ctx, L, alpha) {
    const n = Math.ceil(precip.k * L.n);
    if (n <= 0 || alpha <= 0.003) return;
    const vy = L.vy, vx = L.vx, sp = Math.sqrt(vx * vx + vy * vy) || 1;
    const ex = (-vx / sp) * L.len, ey = (-vy / sp) * L.len;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      ctx.moveTo(L.x[i], L.y[i]);
      ctx.lineTo(L.x[i] + ex, L.y[i] + ey);
    }
    ctx.lineWidth = Math.max(L.w, px(0.8));
    const nk = rainColors();
    if (nk < 0.99) {
      ctx.globalAlpha = alpha * 0.65 * (1 - nk);
      ctx.strokeStyle = G.C.ink;
      ctx.stroke();
    }
    if (nk > 0.01) {
      ctx.globalAlpha = alpha * nk;
      ctx.strokeStyle = 'rgb(205,220,245)';
      ctx.stroke();
    }
  }

  let flake = null;
  function flakeSprite() {
    if (flake) return flake;
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const x = c.getContext('2d');
    if (x) {
      const g = x.createRadialGradient(8, 8, 0, 8, 8, 8);
      g.addColorStop(0, 'rgba(250,252,255,1)');
      g.addColorStop(0.5, 'rgba(244,248,255,0.7)');
      g.addColorStop(1, 'rgba(244,248,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 16, 16);
    }
    flake = c;
    return c;
  }
  function drawSnowLayer(ctx, L, alpha, l) {
    const n = Math.ceil(precip.k * L.n);
    if (n <= 0 || alpha <= 0.003) return;
    const t = G.state.realT, amp = calm ? 4 : 12;
    if (l === 2) {
      const sp = flakeSprite(), r = L.r;
      ctx.globalAlpha = alpha;
      for (let i = 0; i < n; i++) {
        const x = L.x[i] + Math.sin(t * 1.3 + L.ph[i]) * amp;
        ctx.drawImage(sp, x - r, L.y[i] - r, r * 2, r * 2);
      }
      return;
    }
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = L.x[i] + Math.sin(t * 1.3 + L.ph[i]) * amp;
      ctx.moveTo(x + L.r, L.y[i]);
      ctx.arc(x, L.y[i], L.r, 0, TAU);
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = dark ? '#dfe6f0' : '#f6f9ff';
    ctx.fill();
  }

  function drawBack(ctx) {
    if (precip.k < 0.005) return;
    const lowTier = tier() === 0;
    ctx.lineCap = 'round';
    for (let l = lowTier ? 1 : 0; l < 2; l++) {
      if (precip.kind === 1) drawRainLayer(ctx, RAIN[l], RAIN[l].a);
      else drawSnowLayer(ctx, SNOW[l], SNOW[l].a, l);
    }
    if (precip.kind === 1) drawSplashes(ctx);
    ctx.globalAlpha = 1;
  }
  function drawSplashes(ctx) {
    const GR = G.GROUND;
    const nk = rainColors();
    const col = nk > 0.5 ? 'rgb(205,220,245)' : G.C.ink;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = Math.max(0.7, px(0.9));
    for (let i = 0; i < SPLASH_N; i++) {
      const t = spT[i];
      if (t >= 0.5) continue;
      if (t < 0.12) {
        const k = t / 0.12, r = 3 + 4 * k;
        ctx.globalAlpha = (1 - k) * (nk > 0.5 ? 0.5 : 0.3);
        ctx.beginPath();
        ctx.ellipse(spX[i], GR, r, r * 0.45, 0, Math.PI * 1.05, Math.PI * 1.45);
        ctx.moveTo(spX[i] + r * Math.cos(Math.PI * 1.55), GR + r * 0.45 * Math.sin(Math.PI * 1.55));
        ctx.ellipse(spX[i], GR, r, r * 0.45, 0, Math.PI * 1.55, Math.PI * 1.95);
        ctx.stroke();
      }
      ctx.globalAlpha = (nk > 0.5 ? 0.55 : 0.32) * Math.max(0, 1 - t / 0.5);
      ctx.beginPath();
      for (let k = 0; k < 2; k++) {
        const j = i * 2 + k;
        if (dropA[j] < -2) continue;
        ctx.moveTo(dropX[j] + 0.9, GR - dropA[j]);
        ctx.arc(dropX[j], GR - dropA[j], 0.9, 0, TAU);
      }
      ctx.fill();
    }
  }
  function drawFront(ctx) {
    if (precip.k < 0.005 || calm) return;
    const a = 1 - 0.5 * fxDuck();
    ctx.lineCap = 'round';
    if (precip.kind === 1) drawRainLayer(ctx, RAIN[2], Math.min(0.35, RAIN[2].a) * a);
    else drawSnowLayer(ctx, SNOW[2], Math.min(0.35, SNOW[2].a) * a, 2);
    ctx.globalAlpha = 1;
  }

  // ---------- гроза: ветвистая молния ----------
  const MAIN_N = 33, BR_N = 9;
  const bolt = {
    on: false, t: 0, wait: rnd(4, 8), power: 1, out: false, key: 0, bw: 1, bh: 1, x: 0, y: 0, flashed: 0,
    main: new Float32Array(MAIN_N * 2),
    br: [new Float32Array(BR_N * 2), new Float32Array(BR_N * 2)],
    nBr: 0,
  };
  const ENV_T = 0.2;
  function envelope(t) {
    if (t < 0.06) return 1 - 0.7 * (t / 0.06);
    if (t < 0.1) return 0.3 + 0.55 * ((t - 0.06) / 0.04);
    return Math.max(0, 0.85 * (1 - (t - 0.1) / 0.1));
  }
  function displace(arr, n, x0, y0, x1, y1, d0) {
    arr[0] = x0;
    arr[1] = y0;
    arr[(n - 1) * 2] = x1;
    arr[(n - 1) * 2 + 1] = y1;
    let step = n - 1, d = d0;
    while (step > 1) {
      const half = step >> 1;
      for (let i = 0; i + step < n; i += step) {
        const ax = arr[i * 2], ay = arr[i * 2 + 1], bx = arr[(i + step) * 2], by = arr[(i + step) * 2 + 1];
        let nx = -(by - ay), ny = bx - ax;
        const l = Math.sqrt(nx * nx + ny * ny) || 1;
        nx /= l;
        ny /= l;
        const o = rnd(-d, d);
        arr[(i + half) * 2] = (ax + bx) / 2 + nx * o;
        arr[(i + half) * 2 + 1] = (ay + by) / 2 + ny * o;
      }
      step = half;
      d *= 0.55;
    }
  }
  function shapeBolt(w, h) {
    const x0 = rnd(0.25, 0.75) * w, x1 = x0 + rnd(-0.3, 0.3) * w, y1 = h * rnd(0.7, 1);
    const len = Math.sqrt((x1 - x0) * (x1 - x0) + y1 * y1);
    displace(bolt.main, MAIN_N, x0, 0, x1, y1, 0.22 * len);
    bolt.nBr = Math.random() < 0.5 ? 1 : 2;
    for (let b = 0; b < bolt.nBr; b++) {
      const i = Math.floor(rnd(0.3, 0.6) * (MAIN_N - 1));
      const sx = bolt.main[i * 2], sy = bolt.main[i * 2 + 1];
      const dirA = Math.atan2(y1, x1 - x0) + (Math.random() < 0.5 ? -1 : 1) * rnd(0.44, 0.61);
      const bl = len * rnd(0.3, 0.5);
      displace(bolt.br[b], BR_N, sx, sy, sx + Math.cos(dirA) * bl, sy + Math.sin(dirA) * bl, 0.22 * bl);
    }
    bolt.bw = w;
    bolt.bh = h;
  }
  function pickPane() {
    const P = sceneOf().panes;
    if (!P || !(P.n > 0) || !P.x) return -1;
    const W = G.W;
    let best = -1, seen = 0;
    for (let i = 0; i < P.n; i++) {
      if (!(P.w[i] > 20 && P.h[i] > 20) || P.x[i] + P.w[i] < 0 || P.x[i] > W) continue;
      seen++;
      if (Math.random() * seen < 1) best = i;
    }
    return best;
  }
  function blocked() {
    const B = G.bunny, S = G.state;
    const x1 = B.x + (S.speed || 0) * 0.4;
    for (const o of G.obstacles) {
      if (o.deco || o.dead) continue;
      if (o.x >= B.x && o.x <= x1) return true;
    }
    return false;
  }
  function strike() {
    const sc = sceneOf(), W = G.W, GR = G.GROUND;
    bolt.out = !!sc.outdoor;
    bolt.power = rnd(0.55, 1);
    if (bolt.out) {
      const h = Math.max(60, GR - 110 + M - rnd(0, 30));
      shapeBolt(Math.min(260, W * 0.5), h);
      bolt.x = rnd(0.25, 0.85) * W - bolt.bw / 2;
      bolt.y = -M;
      bolt.key = -1;
    } else {
      const i = pickPane();
      const P = sc.panes;
      if (i >= 0) {
        bolt.key = P.key ? P.key[i] : i;
        shapeBolt(1, 1);
        bolt.x = P.x[i] + P.w[i] / 2;
      } else {
        bolt.key = -2;
        bolt.x = W / 2;
      }
    }
    bolt.on = true;
    bolt.t = 0;
    bolt.flashed = 0;
    G.emit('lightning', { x: bolt.x, power: bolt.power, delay: 1.2 - bolt.power * 0.95 });
  }
  function flashBolt() {
    if (calm || tier() < 1 || !G.fx || typeof G.fx.flash !== 'function') return;
    G.fx.flash(dark ? 0.22 : 0.16, '#dfe6ff');
  }
  function updateStorm(dt) {
    const sc = sceneOf();
    if (bolt.on) {
      bolt.t += dt;
      if (bolt.flashed === 0) {
        bolt.flashed = 1;
        flashBolt();
      } else if (bolt.flashed === 1 && bolt.t >= 0.09) {
        bolt.flashed = 2;
        flashBolt();
      }
      if (bolt.t >= ENV_T) bolt.on = false;
    }
    const active = !!sc.storm && (Number(sc.weatherK) || 0) > 0.5 && G.state.mode !== 'start';
    if (!active) {
      bolt.wait = Math.max(bolt.wait, rnd(2, 4));
      return;
    }
    if (bolt.on) return;
    bolt.wait -= dt;
    if (bolt.wait > 0) return;
    if (G.state.mode === 'run' && blocked()) {
      bolt.wait = 0.5;
      return;
    }
    strike();
    bolt.wait = rnd(6, 14);
  }
  function boltPath(ctx, ox, oy, sx, sy) {
    const m = bolt.main;
    ctx.beginPath();
    ctx.moveTo(ox + m[0] * sx, oy + m[1] * sy);
    for (let i = 1; i < MAIN_N; i++) ctx.lineTo(ox + m[i * 2] * sx, oy + m[i * 2 + 1] * sy);
    for (let b = 0; b < bolt.nBr; b++) {
      const a = bolt.br[b];
      ctx.moveTo(ox + a[0] * sx, oy + a[1] * sy);
      for (let i = 1; i < BR_N; i++) ctx.lineTo(ox + a[i * 2] * sx, oy + a[i * 2 + 1] * sy);
    }
  }
  function strokeBolt(ctx, k) {
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.22 * k;
    ctx.strokeStyle = '#9fb4ff';
    ctx.lineWidth = px(6);
    ctx.stroke();
    ctx.globalAlpha = 0.6 * k;
    ctx.strokeStyle = '#dfe6ff';
    ctx.lineWidth = px(2.6);
    ctx.stroke();
    ctx.globalAlpha = k;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = px(1.1);
    ctx.stroke();
    ctx.globalCompositeOperation = prev;
    ctx.globalAlpha = 1;
  }
  function boltK() {
    return envelope(bolt.t) * bolt.power * (calm ? 0.5 : 1);
  }
  function drawBoltInPane(ctx) {
    if (!bolt.on || bolt.out || bolt.key < 0) return;
    const P = sceneOf().panes;
    if (!P || !(P.n > 0) || !P.x) return;
    let i = -1;
    for (let j = 0; j < P.n; j++) if ((P.key ? P.key[j] : j) === bolt.key) { i = j; break; }
    if (i < 0) return;
    const x = P.x[i], y = P.y[i], w = P.w[i], h = P.h[i];
    if (!(w > 2 && h > 2)) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    boltPath(ctx, x, y, w, h);
    strokeBolt(ctx, boltK());
    ctx.restore();
  }
  function drawSkyFx(ctx) {
    if (!bolt.on || !bolt.out) return;
    boltPath(ctx, bolt.x, bolt.y, 1, 1);
    strokeBolt(ctx, boltK());
  }

  // ---------- капли на стекле (только уровень 2, помещения, дождь) ----------
  const SLOTS = 3, BIG = 14, TRAIL = 16, MICRO = 20;
  function makeSlot() {
    return {
      key: -999, seen: 0, w: 0, h: 0, acc: 0,
      u: new Float32Array(BIG), v: new Float32Array(BIG), r: new Float32Array(BIG), mom: new Float32Array(BIG), path: new Float32Array(BIG), jit: new Float32Array(BIG),
      tu: new Float32Array(TRAIL), tv: new Float32Array(TRAIL), tr: new Float32Array(TRAIL), tl: new Float32Array(TRAIL), ti: 0,
    };
  }
  const slots = [makeSlot(), makeSlot(), makeSlot()];
  let glassFrame = 0;
  function initSlot(s, key, w, h) {
    s.key = key;
    s.w = w;
    s.h = h;
    s.acc = 0;
    s.ti = 0;
    s.tl.fill(0);
    for (let i = 0; i < BIG; i++) {
      if (i < 10 + (key & 3)) {
        s.u[i] = hash(key * 31 + i, 1) * w;
        s.v[i] = hash(key * 31 + i, 2) * h;
        s.r[i] = 1.5 + hash(key * 31 + i, 3) * 3;
      } else {
        s.r[i] = 0;
      }
      s.mom[i] = 0;
      s.path[i] = 0;
      s.jit[i] = 0;
    }
  }
  function slotFor(key, w, h) {
    let free = null;
    for (const s of slots) {
      if (s.key === key) {
        s.w = w;
        s.h = h;
        s.seen = glassFrame;
        return s;
      }
      if (!free || s.seen < free.seen) free = s;
    }
    initSlot(free, key, w, h);
    free.seen = glassFrame;
    return free;
  }
  function stepSlot(s, dt, k) {
    const w = s.w, h = s.h;
    s.acc += dt * 3 * k;
    while (s.acc >= 1) {
      s.acc -= 1;
      for (let i = 0; i < BIG; i++) {
        if (s.r[i] > 0) continue;
        s.u[i] = Math.random() * w;
        s.v[i] = Math.random() * h * 0.8;
        s.r[i] = rnd(1.5, 3.4);
        s.mom[i] = 0;
        s.path[i] = 0;
        break;
      }
    }
    for (let i = 0; i < BIG; i++) {
      const r = s.r[i];
      if (r <= 0) continue;
      if (r > 3.2) s.mom[i] += Math.random() * r * dt;
      if (s.mom[i] > 1) {
        const vy = 20 + 40 * Math.min(1, (r - 3.2) / 1.3);
        const dv = vy * dt;
        s.v[i] += dv;
        s.path[i] += dv;
        s.jit[i] += dt;
        if (s.jit[i] > 0.1) {
          s.jit[i] = 0;
          s.u[i] += rnd(-0.4, 0.4);
        }
        if (s.path[i] > 6 + hash(i, s.ti) * 4) {
          s.path[i] = 0;
          const j = s.ti;
          s.ti = (s.ti + 1) % TRAIL;
          s.tu[j] = s.u[i];
          s.tv[j] = s.v[i] - r;
          s.tr[j] = r * rnd(0.2, 0.5);
          s.tl[j] = rnd(2, 4);
          s.r[i] = Math.max(1.5, Math.sqrt(Math.max(0, r * r - s.tr[j] * s.tr[j])));
        }
        if (s.v[i] - r > h) s.r[i] = 0;
      }
    }
    for (let i = 0; i < BIG; i++) {
      if (s.r[i] <= 0) continue;
      for (let j = i + 1; j < BIG; j++) {
        if (s.r[j] <= 0) continue;
        const du = s.u[i] - s.u[j], dv = s.v[i] - s.v[j], lim = (s.r[i] + s.r[j]) * 0.65;
        if (du * du + dv * dv >= lim * lim) continue;
        const a = s.r[i] >= s.r[j] ? i : j, b = a === i ? j : i;
        s.r[a] = Math.min(6, Math.sqrt(s.r[a] * s.r[a] + 0.8 * s.r[b] * s.r[b]));
        s.r[b] = 0;
      }
    }
    for (let j = 0; j < TRAIL; j++) if (s.tl[j] > 0) s.tl[j] -= dt;
  }
  function glassColors() {
    const kit = G.sceneKit;
    const F = kit && kit.F;
    const night = Number(sceneOf().night) || 0;
    const top = F && typeof F.skyTop === 'string' && F.skyTop ? F.skyTop : night > 0.5 ? '#1a2550' : '#8fbde6';
    const bot = F && typeof F.skyBot === 'string' && F.skyBot ? F.skyBot : night > 0.5 ? '#3a4470' : '#e3eef7';
    return [top, bot];
  }
  function dropsPath(ctx, s, x, y, dx, dy, rk, micro, key) {
    ctx.beginPath();
    for (let i = 0; i < BIG; i++) {
      const r = s.r[i] * rk;
      if (r <= 0.2) continue;
      const cx = x + s.u[i] + dx * s.r[i], cy = y + s.v[i] + dy * s.r[i];
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, TAU);
    }
    for (let j = 0; j < TRAIL; j++) {
      if (s.tl[j] <= 0) continue;
      const r = s.tr[j] * rk;
      if (r <= 0.2) continue;
      const cx = x + s.tu[j] + dx * s.tr[j], cy = y + s.tv[j] + dy * s.tr[j];
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, TAU);
    }
    if (micro) {
      for (let i = 0; i < MICRO; i++) {
        const r = (0.6 + hash(key * 53 + i, 7) * 0.6) * rk;
        const cx = x + hash(key * 53 + i, 5) * s.w, cy = y + hash(key * 53 + i, 6) * s.h;
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, TAU);
      }
    }
  }
  function drawGlassDrops(ctx, dt) {
    const sc = sceneOf();
    const k = sc.weather === 'rain' ? clamp(Number(sc.weatherK) || 0, 0, 1) : 0;
    if (k <= 0.2 || tier() < 2 || sc.outdoor) return;
    const P = sc.panes;
    if (!P || !(P.n > 0) || !P.x) return;
    glassFrame++;
    const W = G.W;
    const [top, bot] = glassColors();
    let used = 0;
    for (let i = 0; i < P.n && used < SLOTS; i++) {
      const x = P.x[i], y = P.y[i], w = P.w[i], h = P.h[i];
      if (!(w > 12 && h > 12) || x + w < -10 || x > W + 10) continue;
      const key = P.key ? P.key[i] : i;
      const s = slotFor(key, w, h);
      used++;
      if (dt > 0) stepSlot(s, dt, k);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.globalAlpha = 0.15 * k;
      ctx.fillStyle = '#000000';
      dropsPath(ctx, s, x, y, 0, 0.25, 1, false, key);
      ctx.fill();
      ctx.globalAlpha = 0.5 * k;
      ctx.fillStyle = top;
      dropsPath(ctx, s, x, y, 0, 0, 1, true, key);
      ctx.fill();
      ctx.globalAlpha = 0.6 * k;
      ctx.fillStyle = bot;
      ctx.beginPath();
      for (let d = 0; d < BIG; d++) {
        const r = s.r[d];
        if (r <= 1.4) continue;
        const cx = x + s.u[d], cy = y + s.v[d];
        ctx.moveTo(cx + r * 0.8, cy - r * 0.1);
        ctx.ellipse(cx, cy - r * 0.1, r * 0.8, r * 0.55, 0, 0, Math.PI, true);
      }
      ctx.fill();
      ctx.globalAlpha = 0.7 * k;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let d = 0; d < BIG; d++) {
        const r = s.r[d];
        if (r <= 1.4) continue;
        const cx = x + s.u[d] - 0.35 * r, cy = y + s.v[d] - 0.35 * r, rr = 0.3 * r;
        ctx.moveTo(cx + rr, cy);
        ctx.arc(cx, cy, rr, 0, TAU);
      }
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- кадр ----------
  let glassDt = 0;
  G.on('theme', (e) => {
    dark = e && e.dark != null ? !!e.dark : G.isDark();
  });
  G.on('resize', () => {
    for (const L of RAIN.concat(SNOW)) L.seeded = false;
  });
  G.on('start', () => {
    wind.base = rnd(-0.2, 0.2);
    wind.gust = 0;
    wind.gT = -1;
    bolt.on = false;
    bolt.wait = rnd(3, 6);
    spT.fill(9);
    for (const s of slots) s.key = -999;
  });

  G.onUpdate((dt, realDt) => {
    const sc = sceneOf();
    const rdt = realDt >= 0 ? realDt : dt;
    updateWind(rdt, !!sc.outdoor);
    updatePrecip(dt);
    updateStorm(rdt);
    glassDt += dt;
  }, 72);

  G.onRender(5, (ctx) => {
    drawBoltInPane(ctx);
    const d = glassDt;
    glassDt = 0;
    drawGlassDrops(ctx, Math.min(0.05, d));
  });
  G.onRender(LAYER.SEAT + 3, drawBack);
  G.onRender(LAYER.FX + 2, drawFront);

  G.weather = {
    get wind() { return wind.base + wind.gust; },
    get gust() { return wind.gust; },
    get precip() { return precip.k; },
    get lightning() { return bolt.on ? envelope(bolt.t) * bolt.power : 0; },
    drawSkyFx(ctx) {
      try { drawSkyFx(ctx); } catch (e) { G.report('weather sky', e); }
    },
    strike() {
      if (!bolt.on) strike();
    },
  };
})();
