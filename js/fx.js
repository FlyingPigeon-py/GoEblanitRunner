/* Эффекты: частицы, всплывашки, камера, хит-стоп, слоу-мо, директор эффектов, поверхности, мем-кадр 11:56, шлейф. Владелец — графика C. */
(() => {
  'use strict';
  const G = window.G;
  const { TAU, LAYER } = G;
  const clamp = G.clamp;
  const rnd = (a, b) => a + Math.random() * (b - a);

  const MAX_PARTICLES = 400;
  const EVENT_MAX = 280;
  const AMBIENT_MAX = 120;
  const AMBIENT_TIER = [0.25, 0.5, 1];
  const MAX_POPUPS = 10;
  const SPEED_LINES = 18;
  const SPEED_LINES_LOW = 10;
  const SHAKE_PX = 14;
  const SHAKE_ROT = 0.02;
  const PUSH_MAX = 6;
  const FLASH_WINDOW_MS = 1000;
  const FLASH_MAX = 3;

  const OUTLINE = '#1d1611';
  const WHITE = '#ffffff';
  const GOLD = '#ffd84d';
  const GOLD_LO = '#a8700e';
  const FLASH_WARM = '#fff4e2';
  const FLASH_GOLD = '#ffe3a0';
  const PARTY = ['#ffd84d', '#ff9eb5', '#8fd3ff', '#b8f28a', '#ff7a59', '#c9a7ff'];
  const FEVER = ['#ff7ad9', '#ff9eb5', '#ffd1ea'];
  const NOTES = ['#ffd84d', '#ff9eb5', '#8fd3ff', '#b8f28a'];
  const LEAVES = ['#c98a4a', '#b0583a', '#cfae58', '#8a9a5b'];
  const LEAVES_DARK = ['#8a6034', '#7a412c', '#8e7a40', '#5e6a3e'];
  const CLOUD_PASTEL = ['#d9cff7', '#c9bdf0', '#fff6c9'];
  const PAPER_LINE = 'rgba(0,0,0,0.22)';
  const WET_DROP = 'rgba(190,210,235,0.7)';
  const MEME_TOP = 'ДАВАЙ ЕБЛАНИТЬ';
  const MEME_BOTTOM = 'ПОЖАЛУЙСТА ДАВАЙ ЕБЛАНИТЬ';
  const MEME_T = 0.8;
  const MEME_HOLD = 0.55;

  const DOT = 0, DUST = 1, SPARK = 2, CONFETTI = 3, FEATHER = 4, FLUFF = 5, STAR = 6, PAPER = 7, SHARD = 8, RING = 9, LEAF = 10, STEAM = 11, SPRITE = 12, FLAME = 13;
  const KINDS = 14;
  const L_BACK = 0, L_FRONT = 1, L_SCREEN = 2, L_AMB = 3, L_AMBF = 4;
  const layerOf = (name) => (name === 'back' ? L_BACK : name === 'screen' ? L_SCREEN : L_FRONT);
  const FIRE_IN = '#ffe14d';
  const FIRE_OUT = '#ff6a1f';
  const STAMP_INK = '#d8342c';
  const MAX_STAMPS = 3;

  const STAR_PTS = new Float32Array(20);
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.45 : 1;
    STAR_PTS[i * 2] = Math.cos(a) * r;
    STAR_PTS[i * 2 + 1] = Math.sin(a) * r;
  }
  const SHARDS = [
    [-1, -0.7, 1, -0.4, 0.1, 0.9],
    [-0.8, 0.6, 0.2, -1, 0.9, 0.5],
    [-1, 0, 0.6, -0.8, 0.7, 0.7],
    [-0.5, -0.9, 0.9, 0.1, -0.6, 0.8],
  ];

  let reduced = !!G.calm;
  G.on('calm', (v) => { reduced = !!v; });
  let dark = false;
  const tier = () => (G.gfx && typeof G.gfx.tier === 'number' ? clamp(Math.round(G.gfx.tier), 0, 2) : 2);

  // ---------- пул частиц: события ≤ 280, амбиент ≤ 120 × уровень ----------
  function Particle() {
    this.kind = DOT; this.layer = L_FRONT; this.amb = false; this.wind = 0;
    this.x = 0; this.alt = 0; this.vx = 0; this.vy = 0;
    this.g = 0; this.drag = 0; this.anchor = 1; this.bounce = 0;
    this.life = 0; this.max = 1; this.size = 1; this.a = 1; this.grow = 0;
    this.rot = 0; this.vr = 0; this.wob = 0; this.wf = 0; this.sway = 0;
    this.r0 = 0; this.w = 0; this.sq = 1; this.v = 0;
    this.color = WHITE; this.color2 = WHITE;
    this.img = null; this.pop = 0;
  }
  const pool = new Array(MAX_PARTICLES);
  for (let i = 0; i < MAX_PARTICLES; i++) pool[i] = new Particle();
  let count = 0;
  let ambCount = 0;
  const ambKind = new Int16Array(KINDS);
  let recycle = 0;

  function reset(p, kind, x, alt, vx, vy, life, size, color) {
    p.kind = kind; p.layer = L_FRONT; p.wind = 0;
    p.x = x; p.alt = alt; p.vx = vx; p.vy = vy;
    p.g = 0; p.drag = 0; p.anchor = 1; p.bounce = 0;
    p.life = Math.max(0.02, life); p.max = p.life; p.size = Math.max(0, size); p.a = 1; p.grow = 0;
    p.rot = 0; p.vr = 0; p.wob = 0; p.wf = 0; p.sway = 0;
    p.r0 = 0; p.w = 0; p.sq = 1; p.v = 0;
    p.color = color; p.color2 = color;
    p.img = null; p.pop = 0;
    return p;
  }

  function spawn(kind, x, alt, vx, vy, life, size, color) {
    let p = null;
    if (count < MAX_PARTICLES && count - ambCount < EVENT_MAX) {
      p = pool[count++];
    } else {
      for (let n = 0; n < count; n++) {
        const q = pool[(recycle + n) % count];
        if (!q.amb) {
          p = q;
          recycle = (recycle + n + 1) % count;
          break;
        }
      }
      if (!p) p = pool[0];
    }
    p.amb = false;
    return reset(p, kind, x, alt, vx, vy, life, size, color);
  }

  function ambientLimit() {
    return Math.floor(AMBIENT_MAX * AMBIENT_TIER[tier()]);
  }
  function spawnAmb(kind, x, alt, vx, vy, life, size, color) {
    if (ambCount >= ambientLimit() || count >= MAX_PARTICLES) return null;
    const p = pool[count++];
    ambCount++;
    ambKind[kind]++;
    p.amb = true;
    reset(p, kind, x, alt, vx, vy, life, size, color);
    p.layer = L_AMB;
    return p;
  }

  let windNow = 0;
  function updateParticles(dt) {
    const S = G.state;
    const dx = S.dx;
    const wk = -260 * windNow * dt;
    for (let i = 0; i < count; i++) {
      const p = pool[i];
      p.life -= dt;
      if (p.life <= 0) {
        if (p.amb) {
          ambCount--;
          ambKind[p.kind]--;
        }
        count--;
        pool[i] = pool[count];
        pool[count] = p;
        i--;
        continue;
      }
      if (p.drag) {
        const k = 1 / (1 + p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.vy -= p.g * dt;
      if (p.wind) p.vx += wk * p.wind;
      if (p.wf) {
        p.wob += p.wf * dt;
        p.vx += Math.sin(p.wob) * p.sway * dt;
      }
      p.x += p.vx * dt;
      if (p.layer !== L_SCREEN) p.x -= dx * p.anchor;
      p.alt += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.bounce && p.alt < 0) {
        p.alt = 0;
        if (p.vy < 0) {
          p.vy = p.vy < -60 ? -p.vy * p.bounce : 0;
          p.vx *= 0.7;
          p.vr *= 0.6;
        }
      }
    }
  }

  let curFill = '';
  let curStroke = '';
  function setFill(ctx, c) {
    if (c !== curFill) { ctx.fillStyle = c; curFill = c; }
  }
  function setStroke(ctx, c) {
    if (c !== curStroke) { ctx.strokeStyle = c; curStroke = c; }
  }
  function disc(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r > 0 ? r : 0, 0, TAU);
    ctx.fill();
  }
  function quad(ctx, x, y, c, s, hw, hh) {
    const ax = c * hw, ay = s * hw, bx = -s * hh, by = c * hh;
    ctx.beginPath();
    ctx.moveTo(x - ax - bx, y - ay - by);
    ctx.lineTo(x + ax - bx, y + ay - by);
    ctx.lineTo(x + ax + bx, y + ay + by);
    ctx.lineTo(x - ax + bx, y - ay + by);
    ctx.closePath();
    ctx.fill();
  }
  function starPath(ctx, x, y, r, rot) {
    const c = Math.cos(rot) * r, s = Math.sin(rot) * r;
    ctx.beginPath();
    for (let i = 0; i < 20; i += 2) {
      const px = STAR_PTS[i], py = STAR_PTS[i + 1];
      const X = x + c * px - s * py, Y = y + s * px + c * py;
      if (i) ctx.lineTo(X, Y);
      else ctx.moveTo(X, Y);
    }
    ctx.closePath();
  }

  // мягкий диск пара: один спрайт на тему, без градиентов в кадре
  let steamDisc = null;
  let steamDark = null;
  function steamSprite() {
    if (steamDisc && steamDark === dark) return steamDisc;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d');
    if (x) {
      const rgb = dark ? '196,188,176' : '246,243,236';
      const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, `rgba(${rgb},1)`);
      g.addColorStop(0.55, `rgba(${rgb},0.55)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g;
      x.fillRect(0, 0, 32, 32);
    }
    steamDisc = c;
    steamDark = dark;
    return c;
  }

  function drawParticles(ctx, layer, aMul, aCap) {
    if (!count) return;
    const GROUND = G.GROUND;
    curFill = '';
    curStroke = '';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const cap = aCap || 1;
    for (let i = 0; i < count; i++) {
      const p = pool[i];
      if (p.layer !== layer) continue;
      const l = p.life / p.max;
      const x = p.x, y = GROUND - p.alt;
      switch (p.kind) {
        case DUST: {
          const age = 1 - l;
          ctx.globalAlpha = Math.min(cap, p.a * l * Math.min(1, age * 8)) * aMul;
          setFill(ctx, p.color);
          disc(ctx, x, y, p.size * (0.6 + age));
          break;
        }
        case SPARK:
          ctx.globalAlpha = Math.min(cap, l * p.a) * aMul;
          setStroke(ctx, p.color);
          ctx.lineWidth = p.size * (0.35 + 0.65 * l);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - p.vx * 0.04, y + p.vy * 0.04);
          ctx.stroke();
          break;
        case CONFETTI:
        case PAPER: {
          const flip = Math.cos(p.wob);
          const c = Math.cos(p.rot), s = Math.sin(p.rot);
          const hw = p.size * (0.12 + 0.88 * Math.abs(flip));
          const hh = p.kind === PAPER ? p.size * 1.25 : p.size * 0.5;
          ctx.globalAlpha = Math.min(cap, (l < 0.2 ? l * 5 : 1) * (flip < 0 ? 0.78 : 1) * p.a) * aMul;
          setFill(ctx, p.color);
          quad(ctx, x, y, c, s, hw, hh);
          if (p.kind === PAPER && hw > 2.4) {
            setStroke(ctx, PAPER_LINE);
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            for (let k = 0; k < 2; k++) {
              const py = hh * (k ? 0.2 : -0.35), w0 = -hw * 0.6, w1 = hw * (k ? 0.25 : 0.6);
              ctx.moveTo(x + c * w0 - s * py, y + s * w0 + c * py);
              ctx.lineTo(x + c * w1 - s * py, y + s * w1 + c * py);
            }
            ctx.stroke();
          }
          break;
        }
        case LEAF: {
          const flip = Math.abs(Math.cos(p.wob));
          const rx = p.size, ry = p.size * 0.45 * (0.35 + 0.65 * flip);
          ctx.globalAlpha = Math.min(cap, (l < 0.25 ? l * 4 : 1) * p.a) * aMul;
          setFill(ctx, p.color);
          ctx.beginPath();
          ctx.ellipse(x, y, rx, ry, p.rot, 0, TAU);
          ctx.fill();
          if (ry > 0.9) {
            const c = Math.cos(p.rot) * rx * 0.85, s = Math.sin(p.rot) * rx * 0.85;
            setStroke(ctx, p.color2);
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(x - c, y - s);
            ctx.lineTo(x + c, y + s);
            ctx.stroke();
          }
          break;
        }
        case STEAM: {
          const age = 1 - l;
          const r = p.size * (1 + 1.4 * age);
          ctx.globalAlpha = Math.min(cap, p.a * Math.min(1, age * 5) * l) * aMul;
          ctx.drawImage(steamSprite(), x - r, y - r, r * 2, r * 2);
          break;
        }
        case FEATHER: {
          const r = p.rot + Math.sin(p.wob) * 0.6;
          ctx.globalAlpha = Math.min(cap, l * 4) * aMul;
          setFill(ctx, p.color);
          setStroke(ctx, p.color2);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.ellipse(x, y, p.size, p.size * 0.32, r, 0, TAU);
          ctx.fill();
          ctx.stroke();
          const c = Math.cos(r) * p.size, s = Math.sin(r) * p.size;
          ctx.beginPath();
          ctx.moveTo(x - c * 1.3, y - s * 1.3);
          ctx.lineTo(x + c * 0.85, y + s * 0.85);
          ctx.stroke();
          break;
        }
        case FLUFF:
          ctx.globalAlpha = Math.min(cap, Math.min(1, l * 3) * p.a) * aMul;
          setFill(ctx, p.color2);
          disc(ctx, x, y, p.size + 0.9);
          setFill(ctx, p.color);
          disc(ctx, x, y, p.size);
          break;
        case STAR:
          ctx.globalAlpha = Math.min(cap, l * 3) * aMul;
          starPath(ctx, x, y, p.size * (0.55 + 0.45 * l), p.rot);
          setFill(ctx, p.color);
          ctx.fill();
          setStroke(ctx, p.color2);
          ctx.lineWidth = 1;
          ctx.stroke();
          break;
        case SHARD: {
          const sh = SHARDS[p.v];
          const c = Math.cos(p.rot) * p.size, s = Math.sin(p.rot) * p.size;
          ctx.globalAlpha = Math.min(cap, l * 4) * aMul;
          setFill(ctx, p.color);
          ctx.beginPath();
          ctx.moveTo(x + c * sh[0] - s * sh[1], y + s * sh[0] + c * sh[1]);
          ctx.lineTo(x + c * sh[2] - s * sh[3], y + s * sh[2] + c * sh[3]);
          ctx.lineTo(x + c * sh[4] - s * sh[5], y + s * sh[4] + c * sh[5]);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case RING: {
          const k = 1 - l, e = 1 - (1 - k) * (1 - k) * (1 - k);
          const r = Math.max(0, p.r0 + (p.size - p.r0) * e);
          ctx.globalAlpha = Math.min(cap, p.a * l) * aMul;
          setStroke(ctx, p.color);
          ctx.lineWidth = Math.max(0.5, p.w * (0.3 + 0.7 * l));
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * p.sq, 0, 0, TAU);
          ctx.stroke();
          break;
        }
        case FLAME: {
          const r = p.size * (0.3 + 0.7 * l);
          ctx.globalAlpha = Math.min(cap, Math.min(1, l * 2.2) * p.a) * aMul;
          setFill(ctx, p.color2);
          disc(ctx, x, y, r);
          if (l > 0.35) {
            setFill(ctx, p.color);
            disc(ctx, x, y + r * 0.15, r * 0.55);
          }
          break;
        }
        case SPRITE: {
          const img = p.img;
          if (!img || !img.width) break;
          const age = p.max - p.life;
          let s = 1;
          if (p.pop > 0 && age < p.pop) {
            const k = age / p.pop - 1;
            s = Math.max(0.05, 1 + 2.7 * k * k * k + 1.7 * k * k);
          }
          ctx.globalAlpha = Math.min(cap, (l < 0.35 ? l / 0.35 : 1) * p.a) * aMul;
          const w = p.size * s, h = w * p.sq;
          const r = p.rot + (p.sway ? Math.sin(p.wob) * 0.14 : 0);
          if (r) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(r);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.restore();
          } else {
            ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
          }
          break;
        }
        default:
          ctx.globalAlpha = Math.min(cap, l * p.a) * aMul;
          setFill(ctx, p.color);
          disc(ctx, x, y, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- палитра событий: в ЕБЛАН-РЕЖИМЕ всё розовое ----------
  let feverOn = false;
  const pc = (c, i) => (feverOn ? FEVER[(i || 0) % FEVER.length] : c);
  let party = PARTY;
  const validPalette = (a) => Array.isArray(a) && a.length > 0 && a.every((c) => typeof c === 'string' && c);

  function dustColor() {
    const C = G.C;
    if (dark) return Math.random() < 0.5 ? C['couch-hi'] : C.muted;
    return Math.random() < 0.5 ? C['seat-lo'] : C['couch-lo'];
  }

  function emitDust(x, alt, n, power, dir, color, alpha) {
    for (let i = 0; i < n; i++) {
      const side = dir || (Math.random() < 0.5 ? -1 : 1);
      const p = spawn(DUST, x + rnd(-6, 6), alt + rnd(0, 4), side * rnd(25, 120) * power, rnd(15, 70) * power, rnd(0.35, 0.65), rnd(2.6, 4.6) * (0.85 + power * 0.25), color || dustColor());
      p.drag = 3.5;
      p.g = -15;
      p.layer = L_BACK;
      p.a = alpha || (dark ? 0.55 : 0.7);
    }
  }

  function emitSparks(x, alt, n, speed, c1, c2, layer) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = speed * rnd(0.45, 1.1);
      const p = spawn(SPARK, x, alt, Math.cos(a) * s, Math.sin(a) * s, rnd(0.25, 0.45), rnd(1.6, 2.6), pc(i & 1 ? c2 : c1, i));
      p.drag = 2.5;
      p.g = 300;
      p.layer = layer || L_FRONT;
    }
  }

  function emitStars(x, alt, n, speed, size, layer) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd(-0.3, 0.3), s = speed * rnd(0.5, 1);
      const p = spawn(STAR, x, alt, Math.cos(a) * s, Math.sin(a) * s + speed * 0.25, rnd(0.55, 0.9), size * rnd(0.75, 1.15), pc(GOLD, i));
      p.color2 = feverOn ? '#b03a7a' : GOLD_LO;
      p.drag = 2.6;
      p.g = 380;
      p.vr = rnd(-7, 7);
      p.rot = rnd(0, TAU);
      p.bounce = 0.4;
      p.layer = layer || L_FRONT;
    }
  }

  function emitRing(x, alt, r0, r1, width, life, color, squash, layer) {
    const p = spawn(RING, x, alt, 0, 0, life, r1, layer === L_BACK ? color : pc(color));
    p.r0 = r0;
    p.w = width;
    p.sq = squash;
    p.a = 0.9;
    p.layer = layer;
    return p;
  }

  function emitFluff(x, alt, n, color, color2) {
    const C = G.C;
    for (let i = 0; i < n; i++) {
      const p = spawn(FLUFF, x + rnd(-8, 8), alt + rnd(-6, 10), rnd(-90, 30), rnd(-10, 70), rnd(0.6, 1.0), rnd(1.6, 2.8), color || C.bunny);
      p.color2 = color2 || C.muted;
      p.drag = 3;
      p.g = 70;
      p.wf = rnd(5, 9);
      p.wob = rnd(0, TAU);
      p.sway = rnd(40, 80);
      p.a = 0.95;
      p.wind = 0.6;
    }
  }

  function emitFeathers(x, alt, n) {
    const C = G.C;
    for (let i = 0; i < n; i++) {
      const p = spawn(FEATHER, x + rnd(-14, 14), alt + rnd(-6, 8), rnd(-120, 120), rnd(40, 200), rnd(1.1, 1.7), rnd(5, 7.5), C.bunny);
      p.color2 = C.muted;
      p.drag = 2.8;
      p.g = 150;
      p.wf = rnd(4, 7);
      p.wob = rnd(0, TAU);
      p.sway = rnd(60, 110);
      p.rot = rnd(-0.5, 0.5);
      p.wind = 1;
    }
  }

  function emitPaper(x, alt, n, power, colors) {
    for (let i = 0; i < n; i++) {
      const p = spawn(PAPER, x + rnd(-12, 12), alt + rnd(-10, 10), rnd(-160, 220) * power, rnd(140, 380) * power, rnd(1.0, 1.6), rnd(3.6, 5.2), colors[i % colors.length]);
      p.drag = 3.4;
      p.g = 420;
      p.wf = rnd(6, 12);
      p.wob = rnd(0, TAU);
      p.sway = rnd(30, 70);
      p.vr = rnd(-6, 6);
      p.rot = rnd(0, TAU);
      p.bounce = 0.25;
      p.wind = 1;
    }
  }

  function emitShards(x, alt, n, power, c1, c2, c3, size) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0.15, Math.PI - 0.15), s = rnd(160, 380) * power;
      const color = i % 3 === 0 ? c1 : i % 3 === 1 ? c2 : c3;
      const p = spawn(SHARD, x + rnd(-8, 8), alt + rnd(-8, 8), Math.cos(a) * s + 60 * power, Math.sin(a) * s, rnd(0.8, 1.3), size || rnd(2.5, 5), color);
      p.drag = 0.8;
      p.g = 1300;
      p.vr = rnd(-14, 14);
      p.rot = rnd(0, TAU);
      p.v = (Math.random() * SHARDS.length) | 0;
      p.bounce = 0.38;
    }
  }

  function emitDrops(x, alt, n, vyMin, vyMax, spread, layer) {
    for (let i = 0; i < n; i++) {
      const p = spawn(DOT, x + rnd(-4, 4), alt + rnd(0, 2), rnd(-spread, spread), rnd(vyMin, vyMax), rnd(0.3, 0.5), rnd(0.9, 1.5), WET_DROP);
      p.g = 900;
      p.layer = layer || L_BACK;
    }
  }

  function emitConfetti(x, alt, n, angMin, angMax, vMin, vMax, layer, palette) {
    const pal = palette || (feverOn ? FEVER : party);
    for (let i = 0; i < n; i++) {
      const a = rnd(angMin, angMax), v = rnd(vMin, vMax);
      const p = spawn(CONFETTI, x + rnd(-6, 6), alt + rnd(-6, 6), Math.cos(a) * v, Math.sin(a) * v, rnd(2.4, 3.6), rnd(3.2, 5.2), pal[(Math.random() * pal.length) | 0]);
      p.drag = 3.2;
      p.g = 260;
      p.wf = rnd(7, 14);
      p.wob = rnd(0, TAU);
      p.sway = rnd(20, 50);
      p.vr = rnd(-6, 6);
      p.rot = rnd(0, TAU);
      p.layer = layer;
      p.wind = 1;
    }
  }

  function sprinkle(n, palette) {
    const top = G.GROUND + 12;
    const pal = palette || (feverOn ? FEVER : party);
    for (let i = 0; i < n; i++) {
      const p = spawn(CONFETTI, rnd(0, G.W), top + rnd(0, 40), rnd(-40, 40), rnd(-60, 0), rnd(2.8, 4.2), rnd(3, 5), pal[(Math.random() * pal.length) | 0]);
      p.drag = 3.2;
      p.g = 260;
      p.wf = rnd(7, 14);
      p.wob = rnd(0, TAU);
      p.sway = rnd(20, 50);
      p.vr = rnd(-6, 6);
      p.rot = rnd(0, TAU);
      p.layer = L_SCREEN;
    }
  }

  function cannons(n, palette) {
    const k = G.H / G.BASE_H, alt = G.GROUND - G.H - 10;
    emitConfetti(-8, alt, n, 0.8, 1.45, 900 * k, 1250 * k, L_SCREEN, palette);
    emitConfetti(G.W + 8, alt, n, Math.PI - 1.45, Math.PI - 0.8, 900 * k, 1250 * k, L_SCREEN, palette);
  }

  function emitFlame(x, alt, n, o) {
    const spread = o.spread == null ? 3 : o.spread;
    const vy = o.vy == null ? 40 : o.vy;
    const layer = layerOf(o.layer);
    for (let i = 0; i < n; i++) {
      const p = spawn(FLAME, x + rnd(-spread, spread), alt + rnd(-spread, spread), (o.vx || 0) + rnd(-18, 18), vy + rnd(-14, 14), (o.life || 0.35) * rnd(0.8, 1.2), (o.size || 5) * rnd(0.8, 1.2), o.color || FIRE_IN);
      p.color2 = o.color2 || FIRE_OUT;
      p.g = o.g == null ? -60 : o.g;
      p.drag = o.drag == null ? 1.5 : o.drag;
      p.anchor = o.anchor == null ? 1 : o.anchor;
      p.a = o.a == null ? 1 : o.a;
      p.layer = layer;
    }
  }

  function emitSprite(img, x, alt, o) {
    if (!img || !img.width || !img.height || !Number.isFinite(x) || !Number.isFinite(alt)) return null;
    const w = o.w > 0 ? o.w : 18;
    const p = spawn(SPRITE, x, alt, o.vx || 0, o.vy || 0, o.life || 1.2, w, WHITE);
    p.img = img;
    p.sq = img.height / img.width;
    p.g = o.g || 0;
    p.drag = o.drag || 0;
    p.rot = o.rot || 0;
    p.vr = o.vr || 0;
    p.pop = reduced ? 0 : o.pop == null ? 0.22 : o.pop;
    p.anchor = o.anchor == null ? 1 : o.anchor;
    p.a = o.a == null ? 1 : o.a;
    if (o.sway && !reduced) {
      p.sway = o.sway;
      p.wf = o.wf || rnd(3, 5);
      p.wob = rnd(0, TAU);
    }
    p.layer = layerOf(o.layer);
    return p;
  }

  // anchor < 1: салют далеко в небе, мир под ним уезжает быстрее.
  let saluteAt = -1e9;
  function salute(x, alt, o) {
    const now = G.state.realT;
    if (now - saluteAt < 0.35) return false;
    saluteAt = now;
    const pal = validPalette(o.colors) ? o.colors : party;
    const anchor = o.anchor == null ? 0.15 : o.anchor;
    const rise = reduced ? 0.01 : 0.55, lift = 110, g = gen;
    if (!reduced) {
      const p = spawn(FLAME, x, alt - lift, 0, lift / rise, rise, 2.4, WHITE);
      p.color2 = pal[0];
      p.anchor = anchor;
      p.layer = L_BACK;
    }
    G.after(rise, () => {
      if (g !== gen) return;
      const bx = x - anchor * (G.state.speed || 0) * rise;
      const n = reduced ? 10 : o.n || 28;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rnd(-0.12, 0.12), s = rnd(150, 230);
        const p = spawn(SPARK, bx, alt, Math.cos(a) * s, Math.sin(a) * s, rnd(0.7, 1.1), rnd(1.8, 2.6), pal[i % pal.length]);
        p.drag = 1.6;
        p.g = 120;
        p.anchor = anchor;
        p.layer = L_BACK;
      }
      const r = emitRing(bx, alt, 6, reduced ? 40 : 70, 2.5, 0.5, pal[0], 1, L_BACK);
      r.anchor = anchor;
    });
    return true;
  }

  function centerAlt(o) {
    const a = o.alt || 0;
    if (o.fly != null) return o.fly + a;
    if (o.h) return a + o.h / 2;
    if (o.r) return a + o.r + 6;
    if (o.n) return a + o.n * 7;
    return a + 22;
  }

  const DEBRIS_BY_TYPE = { tasks: 'paper', call: 'feathers', clock: 'shards' };
  function debris(o, power) {
    const C = G.C;
    const def = G.obstacleTypes[o.type] || {};
    const spec = def.fx && typeof def.fx === 'object' ? def.fx : null;
    const style = (spec && spec.debris) || DEBRIS_BY_TYPE[o.type] || (def.kind === 'air' ? 'feathers' : 'shards');
    const colors = spec && Array.isArray(spec.colors) && spec.colors.length ? spec.colors : null;
    const x = o.x, alt = centerAlt(o);
    if (style === 'paper') {
      emitPaper(x, alt, Math.min(24, Math.round((o.n ? o.n * 3 : 10) * power) + 2), power, colors || NOTES);
    } else if (style === 'feathers') {
      emitFeathers(x, alt, Math.round(8 * power) + 1);
      const c = colors || [C.card, C.accent];
      emitShards(x, alt, Math.round(6 * power), power, c[0], c[1 % c.length], c[0]);
    } else {
      const c = colors || (o.type === 'clock' ? [C.rim, C['rim-lo'], C.metal] : [C.accent, C.ink, C.muted]);
      emitShards(x, alt, Math.round(11 * power) + 1, power, c[0], c[1 % c.length], c[2 % c.length]);
      emitSparks(x, alt, Math.round(6 * power), 260, GOLD, c[0]);
    }
  }

  // ---------- всплывашки ----------
  function Popup() {
    this.on = false; this.text = ''; this.font = ''; this.tag = '';
    this.x = 0; this.alt = 0; this.vy = 0; this.life = 0; this.max = 1; this.age = 0;
    this.size = 16; this.w = 0; this.s = 0; this.sv = 0; this.rot = 0;
    this.fill = WHITE; this.shadow = '';
  }
  const popups = [];
  for (let i = 0; i < MAX_POPUPS; i++) popups.push(new Popup());

  const fontCache = Object.create(null);
  function fontFor(size) {
    return fontCache[size] || (fontCache[size] = '700 ' + size + 'px ' + G.FONT_DISPLAY);
  }
  let measureCtx = null;
  try { measureCtx = document.createElement('canvas').getContext('2d'); } catch (e) { measureCtx = null; }
  function textWidth(text, font, size) {
    let w = 0;
    if (measureCtx) {
      measureCtx.font = font;
      w = measureCtx.measureText(text).width;
    }
    return w > 0 ? w : text.length * size * 0.5;
  }
  function setPopupText(p, text, size) {
    let s = Math.round(size);
    let font = fontFor(s);
    let w = textWidth(text, font, s);
    const maxW = G.W - 24;
    if (w > maxW) {
      s = Math.max(10, Math.floor((s * maxW) / w));
      font = fontFor(s);
      w = textWidth(text, font, s);
    }
    p.text = text;
    p.size = s;
    p.font = font;
    p.w = w;
  }
  function separate(p) {
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (let i = 0; i < MAX_POPUPS; i++) {
        const q = popups[i];
        if (q === p || !q.on) continue;
        if (Math.abs(q.x - p.x) < (q.w + p.w) * 0.4 && Math.abs(q.alt - p.alt) < (q.size + p.size) * 0.55) {
          p.alt = q.alt + (q.size + p.size) * 0.6;
          moved = true;
        }
      }
      if (!moved) break;
    }
  }
  function spawnPopup(x, alt, text, size, life, fill, shadow, tag, rot) {
    let p = null;
    for (let i = 0; i < MAX_POPUPS; i++) {
      if (!popups[i].on) { p = popups[i]; break; }
    }
    if (!p) {
      p = popups[0];
      for (let i = 1; i < MAX_POPUPS; i++) if (popups[i].life < p.life) p = popups[i];
    }
    p.on = true;
    setPopupText(p, String(text).toUpperCase(), size);
    p.x = x;
    p.alt = alt;
    p.vy = tag === 'hit' ? 16 : 46;
    p.life = p.max = Math.max(0.1, life);
    p.age = 0;
    p.s = reduced ? 1 : 0.15;
    p.sv = 0;
    p.rot = rot || 0;
    p.fill = fill || WHITE;
    p.shadow = shadow || '';
    p.tag = tag || '';
    separate(p);
    return p;
  }
  function findPopup(tag) {
    for (let i = 0; i < MAX_POPUPS; i++) if (popups[i].on && popups[i].tag === tag) return popups[i];
    return null;
  }

  function updatePopups(rdt) {
    for (let i = 0; i < MAX_POPUPS; i++) {
      const p = popups[i];
      if (!p.on) continue;
      p.life -= rdt;
      if (p.life <= 0) {
        p.on = false;
        continue;
      }
      p.age += rdt;
      p.sv += (320 * (1 - p.s) - 13 * p.sv) * rdt;
      p.s += p.sv * rdt;
      p.alt += p.vy * rdt;
      p.vy *= 1 / (1 + 2.5 * rdt);
    }
  }

  function drawPopups(ctx) {
    const GROUND = G.GROUND, W = G.W;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (let i = 0; i < MAX_POPUPS; i++) {
      const p = popups[i];
      if (!p.on) continue;
      const l = p.life / p.max;
      const fade = l < 0.25 ? l / 0.25 : 1;
      const sc = Math.max(0.05, p.s) * (0.9 + 0.1 * fade);
      const half = p.w * sc * 0.5 + 8;
      const x = half * 2 >= W ? W / 2 : clamp(p.x, half, W - half);
      const y = Math.max(p.size * sc * 0.6 + 6, GROUND - p.alt);
      let rot = p.rot;
      if (p.tag === 'hit' && !reduced) rot += Math.sin(p.age * 34) * 0.06 * Math.max(0, 1 - p.age * 2.5);
      ctx.save();
      ctx.translate(x, y);
      if (rot) ctx.rotate(rot);
      ctx.scale(sc, sc);
      ctx.globalAlpha = fade;
      ctx.font = p.font;
      ctx.lineWidth = Math.max(3, p.size * 0.2);
      if (p.shadow) {
        const d = Math.max(1.5, p.size * 0.08);
        ctx.fillStyle = p.shadow;
        ctx.strokeStyle = p.shadow;
        ctx.strokeText(p.text, d, d * 1.3);
        ctx.fillText(p.text, d, d * 1.3);
      }
      ctx.strokeStyle = OUTLINE;
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.fill;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
  }

  // ---------- штампы: печать с рамкой, спрайт на текст и цвет ----------
  const STAMP_SLAM = 0.11;
  const stamps = [];
  for (let i = 0; i < MAX_STAMPS; i++) stamps.push({ on: false, text: '', color: '', sp: null, x: 0, alt: 0, rot: 0, t: 0, born: 0, life: 1, hit: false });
  const stampCache = new Map();
  const stampK = () => clamp((G.scale || 1) * (G.dpr || 1), 1, 3);

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function buildStamp(text, color, k) {
    let size = 22;
    let font = fontFor(size);
    let w = textWidth(text, font, size);
    const maxW = Math.max(110, G.W * 0.8) - 30;
    if (w > maxW) {
      size = Math.max(11, Math.floor((size * maxW) / w));
      font = fontFor(size);
      w = textWidth(text, font, size);
    }
    const cw = w + 30, ch = size * 1.2 + 22;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(cw * k));
    c.height = Math.max(1, Math.ceil(ch * k));
    const x = c.getContext('2d');
    if (x) {
      x.setTransform(k, 0, 0, k, 0, 0);
      x.lineJoin = 'round';
      x.font = font;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      for (let pass = 0; pass < 2; pass++) {
        const halo = pass === 0;
        x.globalAlpha = halo ? 0.55 : 1;
        x.strokeStyle = halo ? WHITE : color;
        x.fillStyle = halo ? WHITE : color;
        x.lineWidth = halo ? 5.5 : 3;
        G.draw.rr(x, 4, 4, cw - 8, ch - 8, 6);
        x.stroke();
        x.lineWidth = halo ? 3.4 : 1.3;
        G.draw.rr(x, 8.5, 8.5, cw - 17, ch - 17, 3.5);
        x.stroke();
        if (halo) {
          x.lineWidth = 3;
          x.strokeText(text, cw / 2, ch / 2 + 1);
        } else {
          x.fillText(text, cw / 2, ch / 2 + 1);
        }
      }
      x.globalCompositeOperation = 'destination-out';
      let seed = hashStr(text) || 1;
      const r = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const holes = Math.round((cw * ch) / 90);
      for (let i = 0; i < holes; i++) {
        x.globalAlpha = 0.3 + r() * 0.55;
        disc(x, 4 + r() * (cw - 8), 4 + r() * (ch - 8), 0.35 + r() * 1.1);
      }
      x.globalAlpha = 0.5;
      x.lineWidth = 0.8;
      x.strokeStyle = '#000';
      x.beginPath();
      const sy = ch * (0.3 + r() * 0.4);
      x.moveTo(cw * (0.1 + r() * 0.2), sy);
      x.lineTo(cw * (0.6 + r() * 0.3), sy + (r() - 0.5) * 4);
      x.stroke();
    }
    return { c, w: cw, h: ch };
  }
  function stampSprite(st) {
    if (st.sp) return st.sp;
    const k = stampK();
    const key = st.text + '|' + st.color + '|' + k + '|' + Math.round(G.W);
    let sp = stampCache.get(key);
    if (!sp) {
      sp = buildStamp(st.text, st.color, k);
      stampCache.set(key, sp);
      if (stampCache.size > 8) stampCache.delete(stampCache.keys().next().value);
    }
    st.sp = sp;
    return sp;
  }
  function dropStampSprites() {
    stampCache.clear();
    for (const st of stamps) st.sp = null;
  }

  function spawnStamp(text, o) {
    text = String(text == null ? '' : text).trim();
    if (!text) return null;
    const color = typeof o.color === 'string' && o.color ? o.color : STAMP_INK;
    const now = G.state.realT;
    let st = null;
    for (const s of stamps) {
      if (s.on && (s.text === text || now - s.born < 0.3)) { st = s; break; }
    }
    if (st && st.text === text && st.color === color && st.t < 0.5) return st;
    if (!st) st = stamps.find((s) => !s.on) || stamps.reduce((a, b) => (a.life - a.t < b.life - b.t ? a : b));
    st.on = true;
    st.text = text;
    st.color = color;
    st.sp = null;
    st.x = Number.isFinite(o.x) ? o.x : G.W / 2;
    st.alt = Number.isFinite(o.alt) ? o.alt : G.GROUND - G.H * 0.42;
    st.rot = Number.isFinite(o.rot) ? o.rot : rnd(-0.16, -0.06);
    st.t = 0;
    st.born = now;
    st.life = o.life > 0 ? Math.min(4, o.life) : 1.4;
    st.hit = false;
    return st;
  }
  function updateStamps(rdt) {
    for (const st of stamps) {
      if (!st.on) continue;
      st.t += rdt;
      if (st.t >= st.life) {
        st.on = false;
        continue;
      }
      if (!st.hit && st.t >= STAMP_SLAM) {
        st.hit = true;
        if (!reduced) {
          const sp = stampSprite(st);
          for (let i = 0; i < 7; i++) {
            const side = i & 1 ? 1 : -1;
            const p = spawn(DOT, st.x + side * sp.w * rnd(0.3, 0.55), st.alt + rnd(-sp.h, sp.h) * 0.5, side * rnd(40, 120), rnd(-20, 60), rnd(0.25, 0.4), rnd(1, 1.8), st.color);
            p.drag = 4;
            p.anchor = 0;
          }
          if (G.state.mode === 'run') kick(0, 22);
        }
      }
    }
  }
  function drawStamps(ctx) {
    const W = G.W, H = G.H, GR = G.GROUND;
    for (const st of stamps) {
      if (!st.on) continue;
      const sp = stampSprite(st);
      const t = st.t;
      let sc = 1, a;
      if (reduced) {
        a = Math.min(1, t / 0.15);
      } else if (t < STAMP_SLAM) {
        const e = t / STAMP_SLAM;
        sc = 1.8 - 0.86 * e * e;
        a = Math.min(1, t / 0.05);
      } else {
        sc = 0.94 + 0.06 * Math.min(1, (t - STAMP_SLAM) / 0.12);
        a = 1;
      }
      const left = st.life - t;
      if (left < 0.3) a *= left / 0.3;
      if (a <= 0.004) continue;
      const hw = sp.w * 0.5, hh = sp.h * 0.5;
      const x = sp.w >= W ? W / 2 : clamp(st.x, hw + 4, W - hw - 4);
      const y = clamp(GR - st.alt, hh + 4, H - hh - 4);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(st.rot);
      ctx.scale(sc, sc);
      ctx.globalAlpha = 0.92 * a;
      ctx.drawImage(sp.c, -hw, -hh, sp.w, sp.h);
      ctx.restore();
    }
  }

  // ---------- время: хит-стоп и слоу-мо ----------
  let gen = 0;
  let hitTok = 0;
  let smashTok = 0;
  let nearTok = 0;
  let slowTok = 0;
  const slow = { on: false, t: 0, dur: 0.6, from: 0.3 };

  function hitstop(scale, sec, then) {
    const g = gen, tok = ++hitTok;
    G.setMod('time', 'fx-hitstop', scale);
    G.after(sec, () => {
      if (tok === hitTok) G.setMod('time', 'fx-hitstop', null);
      if (then && g === gen) then();
    });
  }
  function slowmo(from, dur) {
    const tok = ++slowTok;
    slow.on = true;
    slow.t = 0;
    slow.dur = Math.max(0.05, dur);
    slow.from = clamp(from, 0.05, 1);
    G.setMod('time', 'fx-slowmo', slow.from);
    G.after(slow.dur + 0.05, () => {
      if (tok !== slowTok) return;
      slow.on = false;
      G.setMod('time', 'fx-slowmo', null);
    });
  }
  function updateSlowmo(rdt) {
    if (!slow.on) return;
    slow.t += rdt;
    const k = Math.min(1, slow.t / slow.dur);
    if (k >= 1) {
      slow.on = false;
      G.setMod('time', 'fx-slowmo', null);
    } else {
      G.setMod('time', 'fx-slowmo', slow.from + (1 - slow.from) * k * k);
    }
  }
  function clearTimeMods() {
    G.setMod('time', 'fx-hitstop', null);
    G.setMod('time', 'fx-smash', null);
    G.setMod('time', 'fx-near', null);
    G.setMod('time', 'fx-slowmo', null);
  }
  const aiming = () => G.flag('aiming');

  // ---------- камера: тряска, зум-удар, толчок пружиной, «дыхание» ----------
  let trauma = 0;
  let shakeT = 0;
  let zKick = 0;
  let zHold = 0;
  let zCur = 0;
  let breath = 1;
  const push = { x: 0, y: 0, vx: 0, vy: 0 };
  const flash = { a: 0, decay: 2, color: FLASH_WARM };
  const flashLog = [];
  let vig = 0;
  let vigCanvas = null;

  function addTrauma(t) {
    if (reduced || !(t > 0)) return;
    trauma = Math.min(1, Math.max(trauma, t) + t * 0.25);
  }
  function zoomKick(z) {
    if (reduced || !(z > 0)) return;
    zKick = Math.max(zKick, Math.min(0.15, z));
  }
  function kick(vx, vy) {
    if (reduced) return;
    push.vx += vx;
    push.vy += vy;
  }
  function recentFlashes(now) {
    let n = 0;
    for (let i = flashLog.length - 1; i >= 0 && now - flashLog[i] < FLASH_WINDOW_MS; i--) n++;
    return n;
  }
  function flashOn(alpha, color, decay, slots) {
    if (reduced || !(alpha > 0)) return false;
    const now = G.state.realT * 1000, n = slots > 1 ? slots : 1;
    if (recentFlashes(now) + n > FLASH_MAX) return false;
    for (let i = 0; i < n; i++) flashLog.push(now);
    if (flashLog.length > 240) flashLog.splice(0, flashLog.length - 120);
    flash.a = Math.max(flash.a, Math.min(1, alpha));
    flash.color = color || FLASH_WARM;
    flash.decay = decay > 0 ? decay : 2;
    return true;
  }
  function noise(t, s) {
    return Math.sin(t + s) * 0.5 + Math.sin(t * 2.13 + s * 1.7) * 0.3 + Math.sin(t * 4.37 + s * 2.9) * 0.2;
  }

  function updatePush(rdt) {
    if (reduced) {
      push.x = push.y = push.vx = push.vy = 0;
      return;
    }
    const steps = rdt > 0.02 ? 2 : 1, h = rdt / steps;
    for (let i = 0; i < steps; i++) {
      push.vx += (-420 * push.x - 26 * push.vx) * h;
      push.vy += (-420 * push.y - 26 * push.vy) * h;
      push.x += push.vx * h;
      push.y += push.vy * h;
    }
    if (push.x > PUSH_MAX || push.x < -PUSH_MAX) { push.x = clamp(push.x, -PUSH_MAX, PUSH_MAX); push.vx = 0; }
    if (push.y > PUSH_MAX || push.y < -PUSH_MAX) { push.y = clamp(push.y, -PUSH_MAX, PUSH_MAX); push.vy = 0; }
    if (Math.abs(push.x) + Math.abs(push.y) + Math.abs(push.vx) + Math.abs(push.vy) < 0.002) push.x = push.y = push.vx = push.vy = 0;
  }

  function updateCamera(rdt) {
    const cam = G.camera, B = G.bunny, S = G.state;
    if (reduced) trauma = 0;
    trauma = Math.max(0, trauma - rdt * 1.5);
    shakeT += rdt;
    updatePush(rdt);
    const amp = trauma * trauma;
    if (amp > 0.0001) {
      const t = shakeT * 22;
      cam.x = SHAKE_PX * amp * noise(t, 0.3) + push.x;
      cam.y = SHAKE_PX * amp * noise(t, 4.1) + push.y;
      cam.rot = SHAKE_ROT * amp * noise(t * 0.8, 8.7);
    } else {
      cam.x = push.x;
      cam.y = push.y;
      cam.rot = 0;
    }
    zKick *= Math.exp(-rdt * 5.5);
    const target = reduced ? 0 : Math.max(zKick, S.mode === 'over' ? zHold : 0);
    zCur += (target - zCur) * Math.min(1, rdt * (target > zCur ? 20 : 5));
    if (zCur < 0.0004) zCur = 0;
    const bt = !reduced && S.mode === 'run' ? 1 - 0.025 * clamp((S.speed - 300) / 270, 0, 1) : 1;
    breath += (bt - breath) * (1 - Math.exp(-rdt / 1.5));
    if (Math.abs(breath - 1) < 0.0004 && bt === 1) breath = 1;
    cam.zoom = (1 + zCur) * breath;
    cam.fx = B.x + 8 * B.size;
    cam.fy = G.GROUND - B.alt - 24 * B.size;
  }

  function buildVignette() {
    const w = Math.max(16, Math.round(G.W / 4)), h = Math.max(16, Math.round(G.H / 4));
    if (!vigCanvas) vigCanvas = document.createElement('canvas');
    vigCanvas.width = w;
    vigCanvas.height = h;
    const c = vigCanvas.getContext('2d');
    if (!c) {
      vigCanvas = null;
      return;
    }
    const r1 = Math.sqrt(w * w + h * h) / 2;
    const g = c.createRadialGradient(w / 2, h / 2, r1 * 0.35, w / 2, h / 2, r1);
    g.addColorStop(0, 'rgba(30,12,6,0)');
    g.addColorStop(1, 'rgba(30,12,6,0.85)');
    c.clearRect(0, 0, w, h);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }

  // ---------- скоростные линии ----------
  const lx = new Float32Array(SPEED_LINES);
  const ly = new Float32Array(SPEED_LINES);
  const ll = new Float32Array(SPEED_LINES);
  const lk = new Float32Array(SPEED_LINES);
  let lineI = 0;
  function seedLine(i, anywhere) {
    lx[i] = anywhere ? Math.random() * G.W : G.W + Math.random() * G.W * 0.6;
    ly[i] = 12 + Math.random() * Math.max(10, G.GROUND - 40);
    ll[i] = rnd(40, 150);
    lk[i] = rnd(1.4, 2.4);
  }
  function seedLines() {
    for (let i = 0; i < SPEED_LINES; i++) seedLine(i, true);
  }
  function updateLines(dt, rdt) {
    const S = G.state;
    let target = 0;
    if (S.mode === 'run' && !reduced) {
      target = clamp((S.speed - 420) / 140, 0, 1);
      if (G.mod('speed') > 1.05) target = Math.max(target, 0.7);
    }
    lineI += (target - lineI) * Math.min(1, rdt * 3);
    if (lineI < 0.01) return;
    const move = S.speed * dt;
    for (let i = 0; i < SPEED_LINES; i++) {
      lx[i] -= move * lk[i];
      if (lx[i] + ll[i] < -10) seedLine(i, false);
    }
  }
  function drawSpeedLines(ctx) {
    if (lineI < 0.02) return;
    const n = tier() === 0 ? SPEED_LINES_LOW : SPEED_LINES;
    ctx.strokeStyle = dark ? G.C.muted : G.C.face;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.lineWidth = pass ? 2.2 : 1;
      ctx.globalAlpha = lineI * (dark ? 0.32 : 0.55) * (pass ? 0.7 : 1);
      ctx.beginPath();
      for (let i = pass; i < n; i += 2) {
        ctx.moveTo(lx[i], ly[i]);
        ctx.lineTo(lx[i] + ll[i], ly[i]);
      }
      ctx.stroke();
    }
  }

  // ---------- полосы «ЕЛЕ-ЕЛЕ!» и «РЕКОРД!» ----------
  const band = { on: false, t: 0, dur: 0.55, alt: 0, text: '', color: '' };
  const dizzy = { on: false, t: 0 };
  const NEAR_TEXT = 'ЕЛЕ-ЕЛЕ!';
  const RECORD_TEXT = 'РЕКОРД!';

  function startBand(text, color, dur, alt) {
    band.on = true;
    band.t = 0;
    band.text = text;
    band.color = color;
    band.dur = dur;
    band.alt = alt;
  }

  function drawBand(ctx) {
    if (!band.on) return;
    const B = G.bunny, W = G.W;
    const k = band.t / band.dur;
    const wipe = 1 - Math.pow(1 - Math.min(1, band.t / 0.1), 3);
    const out = k > 0.55 ? (k - 0.55) / 0.45 : 0;
    const h = 30 * (1 - out * 0.7);
    const x0 = -60, span = (W + 120) * wipe;
    ctx.translate(B.x, G.GROUND - band.alt);
    ctx.rotate(-0.07);
    ctx.translate(-B.x, 0);
    ctx.globalAlpha = 0.88 * (1 - out);
    ctx.fillStyle = band.color || G.C.accent;
    ctx.fillRect(x0, -h / 2, span, h);
    ctx.globalAlpha = 0.75 * (1 - out);
    ctx.fillStyle = WHITE;
    ctx.fillRect(x0, -h / 2 - 4, span, 1.6);
    ctx.fillRect(x0, h / 2 + 2.4, span, 1.6);
    ctx.globalAlpha = 0.35 * (1 - out);
    const shift = (band.t * 1400) % 220;
    for (let i = 0; i < 6; i++) {
      const sx = x0 + span - 60 - ((i * 97 + shift) % (W + 120));
      if (sx > x0) ctx.fillRect(sx, -h * 0.3 + (i % 3) * h * 0.25, 60, 1.4);
    }
    if (wipe > 0.6 && out < 0.9) {
      ctx.globalAlpha = 1 - out;
      ctx.font = fontFor(20);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = OUTLINE;
      const tx = Math.min(B.x + 150, W - 60);
      ctx.strokeText(band.text, tx, 1);
      ctx.fillStyle = WHITE;
      ctx.fillText(band.text, tx, 1);
    }
  }

  function drawDizzy(ctx) {
    if (!dizzy.on || G.state.mode !== 'over' || G.bunnyDizzy) return;
    const B = G.bunny, t = G.state.realT;
    const appear = Math.min(1, Math.max(0, (dizzy.t - 0.15) / 0.3));
    if (appear <= 0) return;
    const cx = B.x + 12 * B.size, cy = G.GROUND - B.alt - 50 * B.size;
    ctx.fillStyle = GOLD;
    ctx.strokeStyle = GOLD_LO;
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const a = t * (reduced ? 1.5 : 4.2) + (i * TAU) / 3;
      const depth = 0.75 + 0.25 * Math.sin(a);
      ctx.globalAlpha = appear * (0.55 + 0.45 * depth);
      starPath(ctx, cx + Math.cos(a) * 20, cy + Math.sin(a) * 6, 5.5 * depth * appear, a * 0.7);
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- мем-кадр 11:56 ----------
  const meme = { on: false, t: 0, done: false, top: null, bottom: null, key: '' };

  function memeCaption(text, maxW) {
    let size = Math.round(clamp(G.W * 0.05, 20, 30));
    let font = fontFor(size);
    let w = textWidth(text, font, size);
    if (w > maxW) {
      size = Math.max(12, Math.floor((size * maxW) / w));
      font = fontFor(size);
      w = textWidth(text, font, size);
    }
    const pad = 4, k = clamp((G.scale || 1) * (G.dpr || 1), 1, 3);
    const cw = w + pad * 2 + 4, ch = size * 1.4 + pad * 2;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(cw * k));
    c.height = Math.max(1, Math.ceil(ch * k));
    const x = c.getContext('2d');
    if (x) {
      x.setTransform(k, 0, 0, k, 0, 0);
      x.font = font;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.lineJoin = 'round';
      x.lineWidth = 4;
      x.strokeStyle = '#000000';
      x.strokeText(text, cw / 2, ch / 2);
      x.fillStyle = WHITE;
      x.fillText(text, cw / 2, ch / 2);
    }
    return { c, w: cw, h: ch };
  }
  function ensureMemeCaptions() {
    const key = Math.round(G.W) + '|' + (G.scale || 1) + '|' + (G.dpr || 1);
    if (meme.top && meme.key === key) return;
    meme.key = key;
    const maxW = G.W * 0.9;
    meme.top = memeCaption(MEME_TOP, maxW);
    meme.bottom = memeCaption(MEME_BOTTOM, maxW);
  }

  function memeTrigger() {
    if (meme.done || G.state.mode !== 'run') return;
    meme.done = true;
    meme.on = true;
    meme.t = 0;
    const dir = G.director;
    const soon = dir && typeof dir.nextArrival === 'function' ? Number(dir.nextArrival()) < 0.9 : false;
    if (!reduced && !aiming() && !soon) slowmo(0.25, 0.7);
    flashOn(0.35, WHITE, 2.4);
    G.emit('memeShot', { clockMin: G.clockMin() });
  }

  function drawMeme(ctx) {
    if (!meme.on) return;
    const W = G.W, H = G.H, t = meme.t;
    ensureMemeCaptions();
    let a, sepia, lift = 0, sc = 1;
    if (reduced) {
      a = Math.min(1, t / 0.15, (MEME_T - t) / 0.25);
      sepia = 0;
    } else {
      const out = t > MEME_HOLD ? clamp((t - MEME_HOLD) / (MEME_T - MEME_HOLD), 0, 1) : 0;
      const e = out * out * (3 - 2 * out);
      a = Math.min(1, t / 0.06) * (1 - e);
      sepia = 0.3 * (1 - e);
      lift = 30 * e;
      sc = 1 - 0.08 * e;
    }
    if (a <= 0.004) return;
    if (sepia > 0.004) {
      ctx.globalCompositeOperation = 'color';
      ctx.globalAlpha = sepia;
      ctx.fillStyle = '#b08a5a';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    if (lift || sc !== 1) {
      ctx.translate(W / 2, H / 2 - lift);
      ctx.scale(sc, sc);
      ctx.translate(-W / 2, -H / 2);
    }
    ctx.globalAlpha = a * 0.22;
    ctx.fillStyle = '#000000';
    ctx.fillRect(6, 6, W - 12, 3);
    ctx.fillRect(6, 9, 3, H - 15);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(-2, -2, W + 4, 8);
    ctx.fillRect(-2, H - 6, W + 4, 8);
    ctx.fillRect(-2, 6, 8, H - 12);
    ctx.fillRect(W - 6, 6, 8, H - 12);
    ctx.globalAlpha = a * 0.5;
    ctx.strokeStyle = '#2b2219';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(6.4, 6.4, W - 12.8, H - 12.8);
    ctx.globalAlpha = a;
    const top = meme.top, bot = meme.bottom;
    if (top) ctx.drawImage(top.c, W / 2 - top.w / 2, 26 - top.h / 2, top.w, top.h);
    if (bot) ctx.drawImage(bot.c, W / 2 - bot.w / 2, H - 22 - bot.h / 2, bot.w, bot.h);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------- шлейф за кроликом ----------
  const TRAIL_N = 12;
  const trX = new Float32Array(TRAIL_N);
  const trA = new Float32Array(TRAIL_N);
  let trLen = 0;
  let trAcc = 0;
  let trK = 0;
  let trDouble = 0;
  let trPrevX = 0;
  let trPrevA = 0;
  let trHas = false;
  let trStyle = 0;

  function trailWanted() {
    const B = G.bunny, S = G.state;
    if (S.mode !== 'run') return 0;
    if (trDouble > 0 || B.v < -900) return 1;
    const pw = G.powerups;
    if (pw && typeof pw.isActive === 'function' && S.baseSpeed > 0 && S.speed >= S.baseSpeed * 1.1) {
      if (pw.isActive('friday')) return 3;
      if (pw.isActive('coffee')) return 2;
    }
    return 0;
  }
  function updateTrail(rdt) {
    const B = G.bunny, S = G.state;
    const dx = S.dx;
    for (let i = 0; i < trLen; i++) trX[i] -= dx;
    trPrevX -= dx;
    if (trDouble > 0) trDouble -= rdt;
    const want = trailWanted();
    if (want) trStyle = want;
    trK += ((want ? 1 : 0) - trK) * Math.min(1, rdt * (want ? 14 : 6));
    if (trK < 0.01 && !want) {
      trK = 0;
      trLen = 0;
      trHas = false;
      return;
    }
    const cx = B.x, ca = B.alt + 22 * B.size;
    if (!trHas) {
      trPrevX = cx;
      trPrevA = ca;
      trHas = true;
    }
    const n = reduced ? TRAIL_N / 2 : TRAIL_N;
    trAcc += rdt;
    const ticks = Math.min(n, Math.floor(trAcc * 60));
    for (let k = 1; k <= ticks; k++) {
      const f = k / ticks;
      if (trLen >= n) {
        trX.copyWithin(0, 1, trLen);
        trA.copyWithin(0, 1, trLen);
        trLen = n - 1;
      }
      trX[trLen] = trPrevX + (cx - trPrevX) * f;
      trA[trLen] = trPrevA + (ca - trPrevA) * f;
      trLen++;
    }
    trAcc -= ticks / 60;
    if (trAcc > 1 / 60) trAcc = 0;
    trPrevX = cx;
    trPrevA = ca;
  }
  function trailPath(ctx, from, to, hw) {
    const GR = G.GROUND, n = trLen;
    ctx.beginPath();
    for (let i = from; i <= to; i++) {
      const j = Math.min(i + 1, n - 1), h = Math.max(i - 1, 0);
      let nx = -(trA[j] - trA[h]), ny = -(trX[j] - trX[h]);
      const d = Math.sqrt(nx * nx + ny * ny) || 1;
      nx /= d;
      ny /= d;
      const w = hw * (i / Math.max(1, n - 1));
      const x = trX[i] + nx * w, y = GR - trA[i] + ny * w;
      if (i === from) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = to; i >= from; i--) {
      const j = Math.min(i + 1, n - 1), h = Math.max(i - 1, 0);
      let nx = -(trA[j] - trA[h]), ny = -(trX[j] - trX[h]);
      const d = Math.sqrt(nx * nx + ny * ny) || 1;
      nx /= d;
      ny /= d;
      const w = hw * (i / Math.max(1, n - 1));
      ctx.lineTo(trX[i] - nx * w, GR - trA[i] - ny * w);
    }
    ctx.closePath();
  }
  function drawTrail(ctx) {
    if (trK < 0.02 || trLen < 3) return;
    const B = G.bunny, base = 7 * B.size * trK;
    if (trStyle === 3) {
      const seg = Math.max(1, Math.ceil((trLen - 1) / 6));
      for (let pass = 0; pass < 2; pass++) {
        ctx.globalAlpha = (pass ? 0.3 : 0.15) * trK;
        for (let s = 0, c = 0; s < trLen - 1; s += seg, c++) {
          ctx.fillStyle = PARTY[c % PARTY.length];
          trailPath(ctx, s, Math.min(trLen - 1, s + seg), base * (pass ? 0.5 : 1));
          ctx.fill();
        }
      }
    } else {
      const fur = trStyle !== 2;
      ctx.fillStyle = fur ? G.C.bunny : '#c8814a';
      const k = fur && dark ? 0.72 : 1;
      ctx.globalAlpha = 0.15 * trK * k;
      trailPath(ctx, 0, trLen - 1, base);
      ctx.fill();
      ctx.globalAlpha = 0.3 * trK * k;
      trailPath(ctx, 0, trLen - 1, base * 0.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- следы на снегу ----------
  const FOOT_N = 24;
  const footX = new Float32Array(FOOT_N);
  const footAge = new Float32Array(FOOT_N).fill(99);
  let footI = 0;
  let footSide = 1;
  function addFoot(x) {
    footX[footI] = x + footSide * 2;
    footAge[footI] = 0;
    footI = (footI + 1) % FOOT_N;
    footSide = -footSide;
  }
  function updateFeet(dt, dx) {
    for (let i = 0; i < FOOT_N; i++) {
      if (footAge[i] >= 3) continue;
      footAge[i] += dt;
      footX[i] -= dx;
    }
  }
  function drawFeet(ctx) {
    const GR = G.GROUND + 0.6;
    ctx.fillStyle = G.C.ink;
    for (let b = 0; b < 3; b++) {
      let any = false;
      ctx.beginPath();
      for (let i = 0; i < FOOT_N; i++) {
        const age = footAge[i];
        if (age >= 3 || Math.floor(age) !== b || footX[i] < -20 || footX[i] > G.W + 20) continue;
        ctx.moveTo(footX[i] + 5, GR);
        ctx.ellipse(footX[i], GR, 5, 1.6, 0, 0, TAU);
        any = true;
      }
      if (!any) continue;
      ctx.globalAlpha = 0.18 * (1 - b / 3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- поверхности: шаги и приземления ----------
  const surfaceNow = () => {
    const s = G.scene && G.scene.surface;
    return typeof s === 'string' && s ? s : 'fabric';
  };
  const stoneColor = () => (dark ? '#6d675e' : '#a39d92');
  const woodColor = () => (dark ? '#6f5a44' : '#cfae86');
  const snowColor = () => (dark ? '#dfe6ee' : '#f4f7fb');

  let stepUp = false;
  let stepN = 0;

  function footDust(B, color, alpha, size) {
    const p = spawn(DUST, B.x - 8 * B.size, rnd(0, 3), rnd(-70, -15), rnd(8, 30), rnd(0.25, 0.4), rnd(2, 3.2) * (size || 1), color || dustColor());
    p.drag = 3;
    p.layer = L_BACK;
    p.a = alpha || (dark ? 0.35 : 0.45);
  }
  function footSpark(B, color, alpha, life) {
    const p = spawn(SPARK, B.x - 6 * B.size, rnd(0.5, 2), rnd(-160, -60), rnd(10, 50), life, rnd(1.1, 1.6), color);
    p.drag = 4;
    p.a = alpha;
    p.layer = L_BACK;
  }

  function footStep(B) {
    stepN++;
    switch (surfaceNow()) {
      case 'wood':
        footDust(B, woodColor(), 0.3, 0.7);
        break;
      case 'laminate':
        if (stepN % 4 === 0) footSpark(B, dark ? '#c9d2dc' : '#ffffff', 0.5, 0.12);
        break;
      case 'stone':
        footDust(B, stoneColor(), 0.35, 1);
        break;
      case 'wet':
        emitDrops(B.x - 6 * B.size, 1, 2, 120, 200, 50);
        break;
      case 'snow':
        footDust(B, snowColor(), 0.6, 1);
        footDust(B, snowColor(), 0.6, 0.8);
        addFoot(B.x - 4 * B.size);
        break;
      case 'cloud':
        if (stepN % 2 === 0) footSpark(B, CLOUD_PASTEL[stepN % 3], 0.7, 0.3);
        break;
      default:
        footDust(B);
    }
  }

  function landFx(power) {
    const B = G.bunny, C = G.C, x = B.x + 4;
    switch (surfaceNow()) {
      case 'wood':
        emitDust(x, 0, 2 + Math.round(power * 4), 0.6 + power, 0, woodColor(), 0.4);
        emitRing(x, 1, 6, 26 + power * 12, 2, 0.26, dark ? C.muted : C['seat-lo'], 0.2, L_BACK);
        break;
      case 'laminate': {
        emitRing(x, 1, 6, 18, 2, 0.2, dark ? '#c9d2dc' : '#ffffff', 0.2, L_BACK);
        for (let i = 0; i < 2; i++) footSpark(B, dark ? '#c9d2dc' : '#ffffff', 0.6, 0.18);
        break;
      }
      case 'stone':
        emitDust(x, 0, 3 + Math.round(power * 6), 0.6 + power, 0, stoneColor(), 0.5);
        emitShards(x, 2, 2, 0.4, stoneColor(), dark ? '#4e4943' : '#8f8a80', stoneColor(), 1.2);
        break;
      case 'wet': {
        const crown = 'rgba(205,220,245,0.75)';
        emitRing(x, 1, 6, 22, 1.6, 0.22, crown, 0.25, L_BACK);
        emitRing(x, 1, 4, 16, 1.2, 0.18, crown, 0.25, L_BACK);
        emitDrops(x, 1, 6, 140, 260, 90);
        const r = emitRing(x, 0, 8, 30, 1.2, 0.5, crown, 0.18, L_BACK);
        r.a = 0.4;
        break;
      }
      case 'snow':
        emitDust(x, 0, 8, 0.7 + power, 0, snowColor(), 0.75);
        emitRing(x, 1, 6, 24, 2, 0.26, snowColor(), 0.25, L_BACK);
        addFoot(x - 6);
        addFoot(x + 6);
        break;
      case 'cloud':
        emitFluff(x, 4, 6, '#d9cff7', '#b3a5e6');
        for (let i = 0; i < 3; i++) {
          const p = spawn(STAR, x + rnd(-10, 10), rnd(2, 10), rnd(-60, 60), rnd(30, 90), rnd(0.5, 0.8), 2, CLOUD_PASTEL[i % 3]);
          p.color2 = '#b3a5e6';
          p.drag = 2.5;
          p.g = 160;
          p.vr = rnd(-5, 5);
          p.layer = L_BACK;
        }
        break;
      default:
        emitDust(x, 0, 3 + Math.round(power * 8), 0.6 + power, 0);
        emitFluff(x - 4, 4, 2);
    }
  }

  // ---------- директор: дакинг, опасность, амбиент ----------
  let duck = 0;
  let danger = 0;
  function duckNow() {
    duck = 1;
  }
  function updateDirector(rdt) {
    duck = Math.max(0, duck - rdt / 0.35);
    let n = 0;
    const W = G.W;
    for (const o of G.obstacles) {
      if (o.deco || o.dead || o.x < -40 || o.x > W + 40) continue;
      n++;
    }
    danger = Math.min(1, n / 4);
  }

  const AMB_KIND = { dust: DUST, spark: SPARK, dot: DOT, fluff: FLUFF, paper: PAPER, leaf: LEAF, steam: STEAM, confetti: CONFETTI };
  function ambient(kind, x, alt, o) {
    const k = typeof kind === 'number' ? kind : AMB_KIND[kind];
    if (k == null || !Number.isFinite(x) || !Number.isFinite(alt)) return false;
    if (danger > 0 && Math.random() < 0.6 * danger) return false;
    o = o || {};
    const p = spawnAmb(k, x, alt, o.vx || 0, o.vy || 0, o.life || 1.2, o.size || 2, o.color || G.C.muted);
    if (!p) return false;
    p.color2 = o.color2 || p.color;
    p.anchor = o.anchor == null ? 1 : o.anchor;
    p.g = o.g || 0;
    p.drag = o.drag || 0;
    p.a = o.a == null ? 0.35 : o.a;
    p.wind = o.wind || 0;
    p.rot = o.rot || 0;
    p.vr = o.vr || 0;
    if (o.wf) {
      p.wf = o.wf;
      p.wob = rnd(0, TAU);
      p.sway = o.sway || 20;
    }
    if (o.front) {
      p.layer = L_AMBF;
      p.a = Math.min(0.35, p.a);
    }
    return true;
  }

  // атмосфера локаций: пар, бумажки из кондиционера, пушинки в лучах, листья на порывах
  let ventT = 6;
  function emittersOf(name) {
    const e = G.scene && G.scene[name];
    return e && e.list && e.n > 0 ? e : null;
  }
  function updateAtmosphere(dt) {
    const S = G.state;
    if (S.mode === 'pause' || dt <= 0) return;
    const W = G.W, GR = G.GROUND, ak = AMBIENT_TIER[tier()];
    const em = emittersOf('emitters');
    if (em) {
      for (let i = 0; i < em.n && i < em.list.length; i++) {
        const e = em.list[i];
        if (!e || e.x < -40 || e.x > W + 40) continue;
        const k = Number.isFinite(e.k) ? e.k : 1;
        if (e.kind === 'steam' && ambKind[STEAM] < 12 && Math.random() < dt * 3 * k * ak) {
          ambient(STEAM, e.x + rnd(-2, 2), e.alt, { vx: rnd(-8, 4), vy: 30, life: rnd(1.1, 1.6), size: rnd(3.2, 4.2), anchor: Number.isFinite(e.par) ? e.par : 0.6, a: 0.35, wind: 0.3 });
        }
      }
    }
    ventT -= dt;
    if (ventT <= 0) {
      ventT = rnd(10, 15);
      let vent = null;
      if (em) {
        for (let i = 0; i < em.n && i < em.list.length; i++) {
          const e = em.list[i];
          if (e && e.kind === 'vent' && e.x > 20 && e.x < W - 20) { vent = e; break; }
        }
      }
      if (vent) {
        const n = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          ambient(PAPER, vent.x + rnd(-6, 6), vent.alt - 4, { vx: rnd(-90, -20), vy: rnd(-30, 20), life: rnd(1.8, 2.6), size: rnd(2, 2.8), color: NOTES[i % NOTES.length], anchor: 0.6, g: 60, drag: 1.4, a: 0.7, wf: rnd(5, 9), sway: 30, vr: rnd(-4, 4), rot: rnd(0, TAU), wind: 1 });
        }
      } else {
        ventT = 1.5;
      }
    }
    const lights = emittersOf('lights');
    const loc = G.scene && G.scene.loc;
    if (lights && (!loc || loc.id === 'living') && ambKind[FLUFF] < 8) {
      for (let i = 0; i < lights.n && i < lights.list.length; i++) {
        const l = lights.list[i];
        if (!l || l.kind !== 'beam' || !(l.a > 0.1) || l.x < -40 || l.x > W + 40) continue;
        if (Math.random() > dt * 0.7 * ak) continue;
        const h = Number.isFinite(l.h) ? l.h : 160, w = Number.isFinite(l.w) ? l.w : 40;
        const v = rnd(0.25, 0.75), ang = Number.isFinite(l.ang) ? l.ang : 0;
        const px = l.x + Math.sin(ang) * h * v + rnd(-w * 0.3, w * 0.3), py = (Number.isFinite(l.y) ? l.y : 0) + Math.cos(ang) * h * v;
        ambient(FLUFF, px, GR - py, { vx: rnd(-6, 6), vy: rnd(-12, -5), life: rnd(2.5, 4), size: rnd(0.8, 1.3), color: dark ? '#8a7a66' : '#efe3cf', color2: dark ? '#6f604f' : '#e3d3ba', anchor: 0.3, a: 0.3, wf: rnd(1, 2), sway: 6 });
      }
    }
    const gust = G.weather && Number.isFinite(G.weather.gust) ? G.weather.gust : 0;
    if (G.scene && G.scene.outdoor && gust > 0.25 && Math.random() < dt * 7 * gust * ak) {
      const pal = dark ? LEAVES_DARK : LEAVES, c = (Math.random() * pal.length) | 0;
      const front = Math.random() < 0.3;
      ambient(LEAF, W + 20, rnd(20, Math.max(40, Math.min(220, GR - 20))), { vx: rnd(-200, -110), vy: rnd(-20, 40), life: rnd(2.2, 3.4), size: front ? rnd(4, 6) : rnd(2.4, 4), color: pal[c], color2: pal[(c + 1) % pal.length], anchor: front ? 1.2 : 0.5, g: 35, drag: 0.4, a: front ? 0.35 : 0.6, wf: rnd(3, 6), sway: 40, vr: rnd(-5, 5), rot: rnd(0, TAU), wind: 1, front });
    }
  }

  function drawScreen(ctx) {
    const W = G.W, H = G.H;
    drawMeme(ctx);
    if (vig > 0.005) {
      if (!vigCanvas) buildVignette();
      if (vigCanvas) {
        ctx.globalAlpha = Math.min(1, vig);
        ctx.drawImage(vigCanvas, 0, 0, W, H);
      }
    }
    drawParticles(ctx, L_SCREEN, 1);
    if (flash.a > 0.004) {
      ctx.globalAlpha = flash.a;
      ctx.fillStyle = flash.color;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    ctx.globalAlpha = 1;
  }

  function nearMiss() {
    const B = G.bunny, C = G.C;
    duckNow();
    if (!aiming()) {
      const tok = ++nearTok;
      G.setMod('time', 'fx-near', 0.5);
      G.after(0.08, () => {
        if (tok === nearTok && G.state.mode === 'run' && !aiming()) G.setMod('time', 'fx-near', 0.75);
        else if (tok === nearTok) G.setMod('time', 'fx-near', null);
      });
      G.after(0.13, () => {
        if (tok === nearTok) G.setMod('time', 'fx-near', null);
      });
    }
    if (reduced) {
      spawnPopup(B.x + 70, B.alt + 64, NEAR_TEXT, 18, 0.8, WHITE, C.accent, 'near');
      return;
    }
    if (!recordBandHold()) startBand(NEAR_TEXT, C.accent, 0.55, B.alt + 22);
    zoomKick(0.035);
    for (let i = 0; i < 6; i++) {
      const p = spawn(SPARK, B.x - 10, B.alt + rnd(8, 40), rnd(-520, -340), 0, rnd(0.18, 0.28), rnd(1.2, 2), C.face);
      p.anchor = 0;
      p.layer = L_BACK;
    }
  }

  // ---------- лента рекорда ----------
  const rec = { done: false, until: 0 };
  const recordBandHold = () => rec.until > G.state.realT;
  function checkRecord() {
    const S = G.state;
    if (rec.done || S.mode !== 'run' || !(S.best > 0)) return;
    let score = 0;
    try { score = G.score(); } catch (e) { return; }
    if (!(score > S.best)) return;
    rec.done = true;
    cannons(reduced ? 6 : 12);
    if (G.obstacleTypes.recordFlag) return;
    zoomKick(0.03);
    if (!reduced) {
      rec.until = S.realT + 0.7;
      startBand(RECORD_TEXT, '#c9930f', 0.7, G.bunny.alt + 30);
    } else {
      spawnPopup(G.bunny.x + 60, G.bunny.alt + 70, RECORD_TEXT, 20, 1, GOLD, GOLD_LO, 'record');
    }
  }

  function pickupColor(def, type) {
    if (def && typeof def.color === 'string' && def.color) return def.color;
    return type === 'carrot' ? G.C.carrot : GOLD;
  }
  function isNearKind(kind) {
    return typeof kind === 'string' && /near/i.test(kind);
  }
  const BONUS_SHADOW = { snooze: '#7b68c8', fever: '#e0479a', boss: '#2f8f5a' };

  G.on('theme', (e) => {
    dark = e && e.dark != null ? !!e.dark : G.isDark();
    steamDisc = null;
  });
  G.on('resize', () => {
    seedLines();
    buildVignette();
    meme.key = '';
    dropStampSprites();
  });
  G.on('fonts', () => {
    meme.key = '';
    dropStampSprites();
  });

  G.on('start', (e) => {
    gen++;
    slowTok++;
    hitTok++;
    smashTok++;
    nearTok++;
    clearTimeMods();
    count = 0;
    ambCount = 0;
    ambKind.fill(0);
    recycle = 0;
    for (let i = 0; i < MAX_POPUPS; i++) popups[i].on = false;
    for (const st of stamps) st.on = false;
    slow.on = false;
    band.on = false;
    dizzy.on = false;
    trauma = 0;
    zKick = 0;
    zHold = 0;
    push.x = push.y = push.vx = push.vy = 0;
    flash.a = 0;
    vig = 0;
    lineI = 0;
    duck = 0;
    feverOn = false;
    meme.on = false;
    meme.done = false;
    rec.done = false;
    rec.until = 0;
    trLen = 0;
    trK = 0;
    trDouble = 0;
    trHas = false;
    footAge.fill(99);
    stepN = 0;
    seedLines();
    const B = G.bunny;
    if (e && e.fromStart) {
      for (let i = 0; i < G.obstacles.length; i++) {
        const o = G.obstacles[i];
        if (o.type === 'clock' && o.ballistic) {
          const alt = centerAlt(o);
          emitStars(o.x, alt, 5, 220, 4.5);
          emitRing(o.x, alt, 6, 52, 4, 0.35, GOLD, 1, L_FRONT);
          emitDust(o.x, 0, 8, 1.2, 0);
          addTrauma(0.3);
          zoomKick(0.03);
          break;
        }
      }
    } else {
      emitDust(B.x, 0, 8, 1, 0);
      emitFluff(B.x, 20, 5);
    }
  });

  G.on('jump', (j) => {
    const B = G.bunny, C = G.C;
    const n = (j && j.n) || 1;
    if (n <= 1) {
      emitDust(B.x - 4, 0, 6, 0.8, -1);
      return;
    }
    trDouble = 0.35;
    const alt = B.alt + 2, extra = Math.min(3, n - 2);
    emitRing(B.x + 2, alt, 6, 32 + extra * 6, 3.2, 0.34, C.face, 0.32, L_BACK);
    emitRing(B.x + 2, alt, 4, 24 + extra * 5, 1.4, 0.3, C.muted, 0.32, L_BACK);
    emitFluff(B.x - 4, alt + 8, 6 + extra * 2);
  });

  G.on('land', (l) => {
    const impact = (l && l.impact) || 0;
    if (impact < 300) return;
    const B = G.bunny;
    const power = clamp((impact - 500) / 800, 0, 1);
    landFx(power);
    if (power > 0.7) {
      emitRing(B.x + 4, 1, 8, 36 + power * 18, 3, 0.32, dark ? G.C.muted : G.C['seat-lo'], 0.28, L_BACK);
      addTrauma(0.28 * power);
      zoomKick(0.015 * power);
    }
    const pw = clamp((impact - 600) / 900, 0, 1);
    if (pw > 0.3) kick(0, 70 * pw);
  });

  G.on('pickup', (p, def) => {
    if (!p) return;
    const color = pickupColor(def, p.type);
    emitSparks(p.x, p.alt, 10, 230, color, GOLD);
    emitRing(p.x, p.alt, 4, 30, 3, 0.3, color, 1, L_FRONT);
    emitStars(p.x, p.alt, 3, 120, 3.2);
  });

  G.on('bonus', (b) => {
    if (!b) return;
    const B = G.bunny, C = G.C;
    const m = Math.round(Number(b.minutes) || 0);
    const near = isNearKind(b.kind);
    const label = !near && b.label ? String(b.label) : (m >= 0 ? '+' : '−') + Math.abs(m) + ' мин';
    const x = b.x != null ? b.x : B.x + 20;
    const alt = b.alt != null ? b.alt : B.alt + 70;
    const shadow = near ? C.accent : b.kind === 'carrot' ? C.carrot : BONUS_SHADOW[b.kind] || (m < 0 ? C.muted : C.leaf);
    spawnPopup(x, alt, label, m >= 30 ? 20 : 17, 1.0, WHITE, shadow, 'bonus');
  });

  G.on('pass', (o, info) => {
    if (G.state.mode !== 'run') return;
    if (info && info.near) nearMiss();
    if (o && o.hands === 'meme' && !o.hero) memeTrigger();
  });

  G.on('smash', (o) => {
    if (!o) return;
    duckNow();
    const alt = centerAlt(o);
    if (o.stomped) {
      emitRing(o.x, alt, 5, 30, 3, 0.26, WHITE, 1, L_FRONT);
      emitDust(o.x, 0, 3, 0.8, 0);
      addTrauma(0.18);
      kick(-45, 0);
      return;
    }
    debris(o, 1);
    emitRing(o.x, alt, 6, 46, 4, 0.32, WHITE, 1, L_FRONT);
    addTrauma(0.35);
    zoomKick(0.025);
    kick(-90, 0);
    if (G.state.mode === 'run' && !aiming()) {
      const tok = ++smashTok;
      G.setMod('time', 'fx-smash', 0.15);
      G.after(0.045, () => {
        if (tok === smashTok) G.setMod('time', 'fx-smash', null);
      });
    }
  });

  G.on('die', (info) => {
    if (!info) return;
    const B = G.bunny, C = G.C, o = info.o || null;
    nearTok++;
    smashTok++;
    band.on = false;
    meme.on = false;
    const hb = G.bunnyHitbox();
    const oAlt = o ? centerAlt(o) : hb.y;
    const ix = o ? Math.min(o.x, hb.x + hb.r) : hb.x + hb.r;
    const ia = (hb.y + oAlt) / 2;

    hitstop(0.02, 0.09, () => slowmo(0.3, 0.65));
    addTrauma(1);
    flashOn(dark ? 0.38 : 0.55, FLASH_WARM, 2);
    zoomKick(0.07);
    kick(160, 0);
    zHold = 0.05;
    vig = 0.65;

    emitRing(ix, ia, 8, 72, 6, 0.42, C.accent, 1, L_FRONT);
    emitRing(ix, ia, 4, 44, 3, 0.3, WHITE, 1, L_FRONT);
    emitStars(ix, ia, 7, 260, 5);
    emitSparks(ix, ia, 14, 340, C.accent, GOLD);
    if (o) debris(o, 0.55);

    const word = info.hitWord || 'ОЙ!';
    const pa = clamp(Math.max(oAlt, hb.y) + 62, 40, G.GROUND - 34);
    spawnPopup(ix + 40, pa, word, 34, 1.4, WHITE, C.accent, 'hit', -0.08);
    dizzy.on = true;
    dizzy.t = 0;
    if (B.dead) emitFluff(B.x, B.alt + 20, 6);
  });

  G.on('gameover', (info) => {
    for (let i = 0; i < MAX_POPUPS; i++) {
      const p = popups[i];
      if (p.on && p.life > 0.25) p.life = 0.25;
    }
    if (info && info.isRecord) {
      cannons(reduced ? 30 : 70);
      sprinkle(reduced ? 14 : 36);
    }
  });

  G.on('milestone', () => {
    const B = G.bunny;
    flashOn(dark ? 0.12 : 0.2, FLASH_GOLD, 0.5);
    sprinkle(reduced ? 8 : 22);
    emitRing(B.x + 4, B.alt + 22, 10, 64, 3, 0.5, GOLD, 1, L_FRONT);
  });

  G.on('powerup', (pu) => {
    const B = G.bunny;
    duckNow();
    const def = pu && pu.id ? G.pickupTypes[pu.id] : null;
    const color = pickupColor(def, '');
    const alt = B.alt + 22;
    emitRing(B.x + 4, alt, 10, 72, 5, 0.5, color, 1, L_FRONT);
    emitRing(B.x + 4, alt, 6, 46, 2.5, 0.4, WHITE, 1, L_FRONT);
    emitStars(B.x + 4, alt, 6, 170, 4.5);
    zoomKick(0.04);
  });

  G.on('powerupEnd', (e) => {
    if (e && e.reason === 'instant') return;
    const B = G.bunny;
    emitRing(B.x + 4, B.alt + 22, 60, 12, 3, 0.35, G.C.muted, 1, L_FRONT);
    emitFluff(B.x, B.alt + 22, 5);
  });

  G.on('combo', (c) => {
    const n = c ? Math.floor(Number(c.count) || 0) : 0;
    if (n < 2) return;
    const B = G.bunny, C = G.C;
    const size = Math.min(30, 15 + n * 1.4);
    const fill = n >= 10 ? '#ffb347' : n >= 5 ? GOLD : WHITE;
    const text = 'КОМБО ×' + n;
    let p = findPopup('combo');
    if (p) {
      setPopupText(p, text, size);
      p.x = B.x + 46;
      p.alt = B.alt + 92;
      p.life = p.max = 1.1;
      p.age = 0;
      p.s = reduced ? 1 : 0.6;
      p.sv = 0;
      p.vy = 30;
      p.fill = fill;
    } else {
      p = spawnPopup(B.x + 46, B.alt + 92, text, size, 1.1, fill, C.accent, 'combo');
    }
    emitStars(p.x, p.alt, Math.min(6, 2 + (n >> 2)), 140, 3.4);
    if (n % 5 === 0) {
      emitRing(p.x, p.alt, 6, 40 + n, 3, 0.35, GOLD, 1, L_FRONT);
      zoomKick(0.025);
    }
  });

  G.on('achievement', () => {
    emitStars(G.W - 70, G.GROUND - 20, 8, 180, 4, L_SCREEN);
  });

  // ---------- реакции на механики геймплея ----------
  G.on('stomp', (s) => {
    if (!s) return;
    const B = G.bunny, chain = Math.max(1, Number(s.chain) || 1);
    duckNow();
    emitRing(B.x + 2, B.alt, 6, 30 + Math.min(4, chain) * 4, 3, 0.3, WHITE, 0.3, L_BACK);
    emitDust(B.x + 2, Math.max(0, B.alt - 4), 4, 0.9, 0);
    if (chain >= 3) emitStars(B.x + 2, B.alt + 10, Math.min(5, chain), 140, 3.2);
    zoomKick(0.012 + Math.min(4, chain) * 0.004);
    if (s.meme) memeTrigger();
  });

  G.on('snooze', (s) => {
    const B = G.bunny, chain = s ? Math.max(1, Number(s.chain) || 1) : 1;
    emitStars(B.x + 4, B.alt + 30, Math.min(8, 2 + chain), 130, 3.4);
    if (chain >= 4) {
      emitRing(B.x + 4, B.alt + 22, 8, 60, 3, 0.45, GOLD, 1, L_FRONT);
      zoomKick(0.03);
    }
  });

  G.on('fever', () => {
    const B = G.bunny;
    feverOn = true;
    duckNow();
    emitRing(B.x + 4, B.alt + 22, 10, 80, 5, 0.55, '#ff7ad9', 1, L_FRONT);
    emitConfetti(B.x, B.alt + 30, reduced ? 8 : 18, 0.4, Math.PI - 0.4, 240, 420, L_FRONT);
  });
  G.on('feverEnd', () => {
    const B = G.bunny;
    feverOn = false;
    if (G.state.mode === 'run') emitFluff(B.x, B.alt + 22, 4, '#ffd1ea', '#ff9eb5');
  });

  G.on('chase', (c) => {
    if (!c) return;
    const B = G.bunny;
    if (c.phase === 'start' && c.cause === 'stumble') {
      emitDust(B.x + 6, 0, 6, 1, 1);
      addTrauma(0.2);
    } else if (c.phase === 'caught') {
      emitPaper(B.x + 10, B.alt + 30, 6, 0.6, NOTES);
      kick(40, 0);
    } else if (c.phase === 'escape') {
      emitStars(B.x + 4, B.alt + 40, 5, 150, 3.6);
    }
  });

  G.on('boss', (b) => {
    if (!b) return;
    const B = G.bunny;
    if (b.phase === 'start') duckNow();
    else if (b.phase === 'hit') emitRing(B.x + 4, B.alt + 22, 8, 46, 3, 0.35, '#ff6b6b', 1, L_FRONT);
    else if (b.phase === 'win') {
      emitStars(B.x + 4, B.alt + 40, 8, 190, 4.4);
      zoomKick(0.03);
    }
  });

  G.onUpdate((dt, realDt) => {
    const S = G.state, B = G.bunny;
    const rdt = realDt >= 0 ? realDt : dt;
    windNow = G.weather && Number.isFinite(G.weather.wind) ? G.weather.wind : 0;
    feverOn = G.flag('fever');
    updateDirector(rdt);
    updateParticles(dt);
    updatePopups(rdt);
    updateStamps(rdt);
    updateSlowmo(rdt);
    updateFeet(dt, S.dx);
    if (S.mode === 'run' && B.alt <= 0 && S.dx > 0) {
      const up = Math.sin(B.phase) > 0;
      if (up !== stepUp) {
        stepUp = up;
        if (up) footStep(B);
      }
    }
    if (band.on) {
      band.t += rdt;
      if (band.t >= band.dur) band.on = false;
    }
    if (meme.on) {
      meme.t += rdt;
      if (meme.t >= MEME_T) meme.on = false;
    }
    if (dizzy.on) dizzy.t += rdt;
    flash.a = Math.max(0, flash.a - flash.decay * rdt);
    const vt = S.mode === 'over' ? 0.28 : 0;
    vig += (vt - vig) * Math.min(1, rdt * 2.5);
    if (vig < 0.003) vig = 0;
    checkRecord();
    updateAtmosphere(dt);
    updateTrail(rdt);
    updateLines(dt, rdt);
    updateCamera(rdt);
  }, 70);

  G.onRender(LAYER.SEAT + 3.5, (ctx) => drawParticles(ctx, L_AMB, 1 - 0.5 * duck));
  G.onRender(LAYER.BACK + 1, drawSpeedLines);
  G.onRender(LAYER.BACK + 2, drawBand);
  G.onRender(LAYER.PICKUPS - 1.4, drawFeet);
  G.onRender(LAYER.BUNNY - 1, (ctx) => {
    drawTrail(ctx);
    drawParticles(ctx, L_BACK, 1);
  });
  G.onRender(LAYER.FX, (ctx) => {
    drawParticles(ctx, L_FRONT, 1);
    drawDizzy(ctx);
  });
  G.onRender(LAYER.FX + 2.5, (ctx) => drawParticles(ctx, L_AMBF, 1 - 0.5 * duck, 0.35));
  G.onRender(LAYER.FRONT + 5, drawPopups);
  G.onRender(LAYER.FRONT + 5.5, drawStamps);
  G.onRender(LAYER.SCREEN, drawScreen);

  const debug = { flashLog };
  G.fx = {
    burst(x, alt, o = {}) {
      const n = o.n || 10, speed = o.speed || 120, life = o.life || 0.45, size = o.size || 2.5;
      const color = o.color || G.C.carrot;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, s = speed * (0.5 + Math.random());
        const p = spawn(DOT, x, alt, Math.cos(a) * s + (o.vx || 0), Math.sin(a) * s + (o.vy || 0), life, size * (0.7 + Math.random() * 0.6), color);
        p.g = o.gravity || 0;
      }
    },
    popup(x, alt, text, o = {}) {
      return spawnPopup(x, alt, text, o.size || 16, o.life || 0.9, o.fill || WHITE, o.color || G.C.accent, o.tag || 'custom', o.rot || 0);
    },
    shake(n) { addTrauma(Math.sqrt(Math.max(0, Number(n) || 0) / 16)); },
    dust(x, n) { emitDust(x, 0, n || 6, 1, 0); },
    sparks(x, alt, o = {}) { emitSparks(x, alt, o.n || 10, o.speed || 220, o.color || GOLD, o.color2 || o.color || GOLD); },
    stars(x, alt, n, o = {}) { emitStars(x, alt, n || 5, o.speed || 180, o.size || 4); },
    ring(x, alt, o = {}) { emitRing(x, alt, o.from || 4, o.r || 40, o.width || 3, o.life || 0.35, o.color || WHITE, o.squash || 1, o.back ? L_BACK : L_FRONT); },
    confetti(n, palette) { sprinkle(n || 30, validPalette(palette) ? palette : null); },
    cannons(n, palette) { cannons(n || 20, validPalette(palette) ? palette : null); },
    palette(name, colors) {
      if (name !== 'party') return null;
      if (colors === null) party = PARTY;
      else if (validPalette(colors)) party = colors.slice();
      return party.slice();
    },
    stamp(text, o = {}) { return spawnStamp(text, o || {}); },
    sprite(img, x, alt, o = {}) { return emitSprite(img, x, alt, o || {}); },
    flame(x, alt, o = {}) {
      o = o || {};
      if (Number.isFinite(x) && Number.isFinite(alt)) emitFlame(x, alt, Math.max(1, Math.min(24, Math.round(o.n || 1))), o);
    },
    salute(x, alt, o = {}) {
      o = o || {};
      const sx = Number.isFinite(x) ? x : rnd(0.2, 0.8) * G.W;
      const sa = Number.isFinite(alt) ? alt : rnd(0.55, 0.8) * G.GROUND;
      return salute(sx, sa, o);
    },
    feathers(x, alt, n) { emitFeathers(x, alt, n || 6); },
    paper(x, alt, n) { emitPaper(x, alt, n || 8, 1, NOTES); },
    flash(alpha, color) { return flashOn(alpha == null ? 0.3 : alpha, color, 2); },
    zoom(amount) { zoomKick(amount == null ? 0.03 : amount); },
    hitstop(scale, sec) { if (G.state.mode === 'run') hitstop(scale == null ? 0.05 : scale, sec || 0.06); },
    slowmo(scale, sec) { if (G.state.mode === 'run' || G.state.mode === 'over') slowmo(scale == null ? 0.5 : scale, sec || 0.4); },
    push(vx, vy) { kick(Number(vx) || 0, Number(vy) || 0); },
    ambient,
    memeShot: { get on() { return meme.on; }, get done() { return meme.done; } },
    debug,
    get reduced() { return reduced; },
    get stamps() { let n = 0; for (const st of stamps) if (st.on) n++; return n; },
    get count() { return count; },
    get ambientCount() { return ambCount; },
    get duck() { return duck; },
    get danger() { return danger; },
  };
})();
