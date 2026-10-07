/* KTS-пикапы П1: торт Дениса, жабонька среды, таймшит, Гастрокайфарики (эчпочмак, чак-чак, элитное хрючево), VPN Марата, «вечная память» созвонам.
   Сценарные пикапы ставит режиссёр (G.director.queuePickup) под одиночный прыжок. Тексты и числа — в js/kts/data/items.js. */
(() => {
  'use strict';
  const G = window.G;
  const K = G.kts;
  const I = G.ktsItems;
  if (!K || !K.enabled || !I) return;
  const { rr, ellipse } = G.draw;
  const TAU = G.TAU, PI = Math.PI;
  const { item, say, toast, popup, tOf, sprite, blit } = I;

  const dir = () => G.director || null;
  const calm = () => !!G.calm;
  const edgeInk = () => (G.isDark() ? 'rgba(10,8,6,0.85)' : 'rgba(40,26,14,0.85)');
  const bob = (p, speed, amp) => Math.sin((G.state.idleT + p.seed) * speed) * (calm() ? 1 : amp);
  function glow(p, r, rgb, a) {
    const L = G.look;
    if (!L || typeof L.glow !== 'function') return;
    try {
      L.glow(p.x, p.alt, r, rgb, a);
    } catch (e) {
      G.report('look.glow', e);
    }
  }
  function queue(id, fromT, toT, opts) {
    const D = dir();
    if (!D || typeof D.queuePickup !== 'function' || !G.pickupTypes[id]) return null;
    return D.queuePickup(id, Object.assign({ fromT, toT }, opts || {}));
  }
  function confetti(n) {
    const fx = G.fx;
    if (fx && typeof fx.confetti === 'function') fx.confetti(calm() ? Math.ceil(n / 3) : n);
  }
  function bonus(p, minutes, label, kind) {
    G.addBonus(minutes, { x: p.x, alt: p.alt + 22, label, kind });
  }
  const missedBy = (p) => {
    const hb = G.bunnyHitbox();
    return !p.taken && p.x < hb.x - hb.r - 18;
  };

  const run = { cakes: 0, twin: false, cakeReq: null, cakeEnd: 0, sheets: 0, sheetsChecked: false, toasted: Object.create(null), lastKhrT: -1e9 };
  const once = (key) => (run.toasted[key] ? false : (run.toasted[key] = true));
  const session = Object.create(null);
  const onceEver = (key) => (session[key] ? false : (session[key] = true));
  const day = { candles: 1, finalFrog: false };
  let goldN = 0, carrotN = 0;

  // ---------- торт Дениса ----------
  const CAKE = K.raw('items', 'cake') && K.raw('items', 'cake').on !== false ? K.raw('items', 'cake') : null;
  const cakeSprite = (candles) =>
    sprite('cake' + candles, 34, 36, (g) => {
      const ink = edgeInk();
      g.fillStyle = '#f2ebe0';
      ellipse(g, 0, 13, 16, 3.6);
      g.strokeStyle = ink;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(0, 13, 16, 3.6, 0, 0, TAU);
      g.stroke();
      g.fillStyle = '#8a5a3c';
      rr(g, -12, -2, 24, 14, 3);
      g.fill();
      g.strokeStyle = ink;
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = '#ff8fb1';
      g.beginPath();
      g.moveTo(-12.5, -2);
      g.lineTo(12.5, -2);
      g.lineTo(12.5, 2);
      for (let i = 0; i <= 5; i++) {
        const x = 12.5 - i * 5;
        g.quadraticCurveTo(x - 1.2, 6 + (i % 2) * 1.5, x - 2.5, 2.4);
      }
      g.lineTo(-12.5, 2);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      rr(g, -10, -1.4, 12, 1.4, 0.7);
      g.fill();
      g.fillStyle = '#fff4c2';
      ellipse(g, -6, 7, 1.2, 1.2);
      ellipse(g, 2, 8.5, 1.2, 1.2);
      ellipse(g, 8, 6.5, 1.2, 1.2);
      const xs = candles > 1 ? [-4, 4] : [0];
      for (const x of xs) {
        g.fillStyle = '#7fc4ff';
        rr(g, x - 1.3, -11, 2.6, 9, 1);
        g.fill();
        g.strokeStyle = '#ffffff';
        g.lineWidth = 0.7;
        g.beginPath();
        g.moveTo(x - 1.3, -8);
        g.lineTo(x + 1.3, -9.6);
        g.moveTo(x - 1.3, -5);
        g.lineTo(x + 1.3, -6.6);
        g.stroke();
      }
    });

  function drawCake(ctx, p) {
    const y = G.GROUND - p.alt + bob(p, 4.5, 3);
    glow(p, 26, '255,170,190', 0.55);
    ctx.translate(p.x, y);
    ctx.rotate(Math.sin((G.state.idleT + p.seed) * 2.6) * (calm() ? 0.02 : 0.08));
    const candles = day.candles;
    blit(ctx, cakeSprite(candles), 0, 0);
    const xs = candles > 1 ? [-4, 4] : [0];
    const t = G.state.idleT * 14 + p.seed;
    for (let i = 0; i < xs.length; i++) {
      const f = calm() ? 1 : 1 + 0.18 * Math.sin(t + i * 2.1);
      ctx.fillStyle = '#ffb03a';
      ellipse(ctx, xs[i], -14.5, 2.2 * f, 3.6 * f);
      ctx.fillStyle = '#fff2a8';
      ellipse(ctx, xs[i], -13.8, 1.1, 1.9);
    }
  }

  function cakeToast(twin) {
    const pre = twin ? 'twin.' : '';
    const label = say('cake', pre + 'label') || say('cake', 'label');
    const text = say('cake', pre + 'toast') || say('cake', 'toast');
    toast(label, text);
  }

  if (CAKE) {
    G.registerPickup({
      id: 'cake',
      radius: 15,
      weight: () => 0,
      shadowW: 13,
      color: '#ff8fb1',
      draw: drawCake,
      collect(p) {
        run.cakes++;
        bonus(p, Number(CAKE.minutes) || 0, CAKE.popup, 'cake');
        K.count('denis');
        if (!(G.fx && typeof G.fx.ktsConfetti === 'function')) confetti(36);
        if (G.fx && G.fx.burst) G.fx.burst(p.x, p.alt, { n: 16, speed: 190, color: '#ff8fb1', life: 0.6, size: 3 });
        cakeToast(run.cakes > 1);
        if (run.cakes === 1 && run.twin) {
          const d = Array.isArray(CAKE.twinDelay) ? CAKE.twinDelay : [5, 10];
          const t = G.state.t;
          queue('cake', t + d[0], t + d[1] + 4);
        }
      },
    });
  }

  function planCake() {
    run.cakeReq = null;
    if (!CAKE) return;
    const w = Array.isArray(CAKE.window) ? CAKE.window : [];
    const a = tOf(w[0]), b = tOf(w[1]);
    const span = Number(CAKE.retry) || 20;
    const at = a + Math.max(0, b - span - a) * Math.pow(Math.random(), Number(CAKE.skew) || 1);
    run.cakeEnd = b;
    run.cakeReq = queue('cake', at, at + span);
    run.twin = Math.random() < (Number(CAKE.twinChance) || 0);
  }
  function retryCake() {
    const req = run.cakeReq;
    const t = G.state.t;
    if (!req || !req.dropped || t >= run.cakeEnd) return;
    run.cakeReq = queue('cake', t, Math.min(run.cakeEnd, t + (Number(CAKE.retry) || 20)));
  }

  // ---------- жабонька среды ----------
  const FROG = item('frog');
  const frogSprite = (gold) =>
    sprite(gold ? 'frogGold' : 'frog', 32, 28, (g) => {
      const ink = edgeInk();
      const skin = gold ? '#f2c14a' : '#6cc04a', belly = gold ? '#fff0b0' : '#d8f0a8', dark = gold ? '#b9861c' : '#3f8f2c';
      g.strokeStyle = ink;
      g.lineWidth = 1.2;
      g.fillStyle = skin;
      g.beginPath();
      g.ellipse(0, 4, 13, 9, 0, 0, TAU);
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(-6.5, -5, 5, 0, TAU);
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(6.5, -5, 5, 0, TAU);
      g.fill();
      g.stroke();
      g.fillStyle = '#ffffff';
      ellipse(g, -6.5, -5, 3.2, 3.2);
      ellipse(g, 6.5, -5, 3.2, 3.2);
      g.fillStyle = '#1a1a1a';
      ellipse(g, -6, -4.6, 1.6, 1.8);
      ellipse(g, 7, -4.6, 1.6, 1.8);
      g.fillStyle = belly;
      ellipse(g, 0, 7, 8, 4.5);
      g.strokeStyle = dark;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-6, 1.5);
      g.quadraticCurveTo(0, 5.5, 6, 1.5);
      g.stroke();
      g.fillStyle = '#ff8fa8';
      ellipse(g, -9, 2, 2, 1.2);
      ellipse(g, 9, 2, 2, 1.2);
      g.fillStyle = dark;
      ellipse(g, -10, 12, 4, 1.8);
      ellipse(g, 10, 12, 4, 1.8);
    });
  const isFinalFrog = () => day.finalFrog;

  if (FROG) {
    G.registerPickup({
      id: 'frog',
      radius: 15,
      weight: () => 0,
      shadowW: 12,
      color: '#6cc04a',
      draw(ctx, p) {
        const gold = isFinalFrog();
        const y = G.GROUND - p.alt + bob(p, 3.6, 2.5);
        glow(p, 26, gold ? '255,210,63' : '140,220,110', 0.5);
        ctx.translate(p.x, y);
        const s = calm() ? 1 : 1 + 0.05 * Math.sin((G.state.idleT + p.seed) * 5);
        blit(ctx, frogSprite(gold), 0, 0, s);
      },
      collect(p) {
        const M = G.modes;
        const meter = Number(FROG.meter) || 0;
        if (M && meter) {
          if (typeof M.addMeter === 'function') M.addMeter(meter, 'frog');
          else if (typeof M._fill === 'function') M._fill(meter);
        }
        if (M && typeof M.pushChase === 'function' && FROG.chase) M.pushChase(Number(FROG.chase) || 0);
        if (K.store.get('frogDay', '') !== K.today.iso) {
          K.store.set('frogDay', K.today.iso);
          K.count('frogs');
        }
        K.secret('wednesday');
        popup(p.x, p.alt + 26, FROG.popup, '#3f8f2c', 16);
        if (isFinalFrog()) toast(say('frog', 'final.label'), say('frog', 'final.toast'));
        else toast(say('frog', 'label'), say('frog', 'toast'));
      },
    });
  }

  function planFrog() {
    if (!FROG || !K.today.wednesday) return;
    const w = Array.isArray(FROG.window) ? FROG.window : [];
    const a = tOf(w[0]), b = tOf(w[1]);
    const at = a + Math.random() * Math.max(0, b - a);
    queue('frog', at, at + (Number(FROG.retry) || 20));
  }

  // ---------- таймшит ----------
  const SHEET = item('timesheet');
  const sheetSprite = () =>
    sprite('timesheet', 28, 32, (g) => {
      const ink = edgeInk();
      g.fillStyle = 'rgba(0,0,0,0.16)';
      rr(g, -9, -12, 21, 27, 2);
      g.fill();
      g.fillStyle = '#fffdf8';
      g.beginPath();
      g.moveTo(-11, -14);
      g.lineTo(5, -14);
      g.lineTo(10, -9);
      g.lineTo(10, 13);
      g.lineTo(-11, 13);
      g.closePath();
      g.fill();
      g.strokeStyle = ink;
      g.lineWidth = 1.1;
      g.stroke();
      g.fillStyle = '#d8d2c6';
      g.beginPath();
      g.moveTo(5, -14);
      g.lineTo(5, -9);
      g.lineTo(10, -9);
      g.closePath();
      g.fill();
      g.strokeStyle = '#b8c2cc';
      g.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.moveTo(-8, -9 + i * 3.2);
        g.lineTo(i % 2 ? 0 : 2, -9 + i * 3.2);
        g.stroke();
      }
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#2f6fd6';
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(0, 6, 5.6, 0, TAU);
      g.fill();
      g.stroke();
      g.strokeStyle = '#2b2219';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(0, 6);
      g.lineTo(0, 2.6);
      g.moveTo(0, 6);
      g.lineTo(2.6, 7.2);
      g.stroke();
    });

  if (SHEET) {
    G.registerPickup({
      id: 'timesheet',
      radius: 14,
      weight: () => 0,
      shadowW: 11,
      color: '#2f6fd6',
      draw(ctx, p) {
        const y = G.GROUND - p.alt + bob(p, 4, 3);
        glow(p, 22, '120,170,255', 0.45);
        ctx.translate(p.x, y);
        ctx.rotate(-0.12 + Math.sin((G.state.idleT + p.seed) * 2.2) * (calm() ? 0.02 : 0.1));
        blit(ctx, sheetSprite(), 0, 0);
      },
      collect(p) {
        run.sheets++;
        if (run.sheets === 1) {
          bonus(p, Number(SHEET.minutes) || 0, SHEET.popup, 'timesheet');
          toast(say('timesheet', 'label'), say('timesheet', 'toast'));
        } else {
          bonus(p, Number(SHEET.extra) || 0, SHEET.popupExtra, 'timesheet');
        }
      },
    });
  }

  function planSheets() {
    if (!SHEET || !Array.isArray(SHEET.windows)) return;
    for (const w of SHEET.windows) queue('timesheet', tOf(w[0]), tOf(w[1]));
  }
  function checkSheets() {
    if (!SHEET || run.sheetsChecked) return;
    const w = SHEET.windows;
    const last = Array.isArray(w) && w.length ? tOf(w[w.length - 1][1]) : 0;
    if (G.state.t < Math.max(last, tOf('18:00'))) return;
    run.sheetsChecked = true;
    if (run.sheets) return;
    toast(say('timesheet', 'missed.label'), say('timesheet', 'missed.toast'));
    I.event('timesheetMissed', 'start');
  }

  // ---------- Гастрокайфарики: эчпочмак ----------
  const ECH = item('echpochmak');
  const echSprite = () =>
    sprite('echpochmak', 34, 30, (g) => {
      const ink = edgeInk();
      g.fillStyle = '#d58a2c';
      g.strokeStyle = ink;
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(0, -12);
      g.quadraticCurveTo(4, -10, 14, 9);
      g.quadraticCurveTo(0, 13, -14, 9);
      g.quadraticCurveTo(-4, -10, 0, -12);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#f2b456';
      g.beginPath();
      g.moveTo(0, -9);
      g.quadraticCurveTo(3, -7, 10, 7);
      g.quadraticCurveTo(0, 9.5, -10, 7);
      g.quadraticCurveTo(-3, -7, 0, -9);
      g.closePath();
      g.fill();
      g.strokeStyle = '#a8621a';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, -9);
      g.lineTo(0, 9);
      g.moveTo(0, 2);
      g.lineTo(-7, 6.5);
      g.moveTo(0, 2);
      g.lineTo(7, 6.5);
      g.stroke();
      g.fillStyle = '#7a4a10';
      ellipse(g, 0, 0.5, 1.6, 1.6);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      ellipse(g, -4, -2, 1.4, 2.6, 0.5);
    });

  if (ECH) {
    G.registerPickup({
      id: 'echpochmak',
      radius: 14,
      weight: () => 0,
      magnetic: true,
      golden: true,
      carrotLike: true,
      shadowW: 11,
      color: '#f2b456',
      draw(ctx, p) {
        const y = G.GROUND - p.alt + bob(p, 4.5, 3.5);
        glow(p, 28, '255,200,90', 0.6);
        ctx.translate(p.x, y);
        ctx.rotate(Math.sin((G.state.idleT + p.seed) * 3) * (calm() ? 0.04 : 0.14));
        blit(ctx, echSprite(), 0, 0);
      },
      collect(p) {
        G.state.stats.carrots++;
        bonus(p, Number(ECH.minutes) || 0, ECH.popup, 'gold');
        if (G.fx && G.fx.burst) G.fx.burst(p.x, p.alt, { n: 14, speed: 170, color: '#f2b456', life: 0.6, size: 3 });
        if (once('ech')) toast(say('echpochmak', 'label'), say('echpochmak', 'toast'));
      },
    });
  }

  // ---------- Гастрокайфарики: чак-чак ----------
  const CHAK = item('chakchak');
  const chakSprite = () =>
    sprite('chakchak', 30, 24, (g) => {
      const ink = edgeInk();
      g.fillStyle = '#c47a1e';
      g.strokeStyle = ink;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-12, 8);
      g.quadraticCurveTo(-10, -8, 0, -9);
      g.quadraticCurveTo(10, -8, 12, 8);
      g.closePath();
      g.fill();
      g.stroke();
      const dots = [[-7, 4], [-3, 5.5], [2, 5], [7, 4.5], [-5, 0], [0, 0.5], [5, 0], [-2, -4.5], [3, -4]];
      for (const [x, y] of dots) {
        g.fillStyle = '#f2b13c';
        ellipse(g, x, y, 2.6, 1.8);
        g.fillStyle = 'rgba(255,255,255,0.45)';
        ellipse(g, x - 0.8, y - 0.6, 0.9, 0.6);
      }
      g.fillStyle = '#6b8fd6';
      rr(g, -14, 7, 28, 3.2, 1.6);
      g.fill();
    });

  if (CHAK) {
    G.registerPickup({
      id: 'chakchak',
      radius: 12,
      weight: () => 0,
      magnetic: true,
      carrotLike: true,
      shadowW: 10,
      color: '#f2b13c',
      draw(ctx, p) {
        const y = G.GROUND - p.alt + bob(p, 5, 3);
        glow(p, 20, '255,190,80', 0.45);
        ctx.translate(p.x, y);
        blit(ctx, chakSprite(), 0, 0);
      },
      collect(p) {
        G.state.stats.carrots++;
        bonus(p, Number(CHAK.minutes) || 0, CHAK.popup, 'carrot');
      },
    });
  }

  // ---------- Гастрокайфарики: элитное хрючево ----------
  const KHR = item('khryuchevo');
  const khrSprite = () =>
    sprite('khryuchevo', 34, 24, (g) => {
      const ink = edgeInk();
      g.fillStyle = '#8c8a84';
      g.beginPath();
      g.ellipse(0, -3, 14, 4, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#7d7462';
      ellipse(g, 0, -3.4, 12, 3);
      g.fillStyle = '#958a72';
      ellipse(g, -4, -4.6, 3, 1.4);
      ellipse(g, 4.5, -4, 2.4, 1.1);
      g.fillStyle = '#9a9891';
      g.strokeStyle = ink;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-14, -3);
      g.quadraticCurveTo(-13, 9, 0, 9.5);
      g.quadraticCurveTo(13, 9, 14, -3);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      g.ellipse(0, -3, 14, 4, 0, 0, TAU);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.25)';
      rr(g, -10, 0, 6, 1.5, 0.75);
      g.fill();
      g.strokeStyle = '#c3cad6';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(6, -4);
      g.lineTo(12, -11);
      g.stroke();
    });

  if (KHR) {
    const minT = tOf(KHR.minT);
    const cooldown = Number(KHR.cooldown) || 40;
    G.registerPickup({
      id: 'khryuchevo',
      radius: 14,
      minT,
      rare: true,
      shadowW: 12,
      color: '#9a9891',
      weight: (t) => (G.state.mode === 'run' && t >= minT && G.state.t - run.lastKhrT >= cooldown ? Number(KHR.weight) || 0 : 0),
      draw(ctx, p) {
        const y = G.GROUND - p.alt + bob(p, 3, 1.5);
        ctx.translate(p.x, y);
        blit(ctx, khrSprite(), 0, 0);
        const t = G.state.idleT + p.seed;
        ctx.fillStyle = '#26221c';
        for (let i = 0; i < 3; i++) {
          const a = t * (3.2 + i * 0.7) + i * 2.1;
          const fx = Math.cos(a) * (11 + i * 2), fy = -12 + Math.sin(a * 1.3) * 5 - i * 2;
          ellipse(ctx, fx, fy, 1.3, 1.1);
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = '#ffffff';
          const w = calm() ? 0.6 : 0.6 + 0.6 * Math.abs(Math.sin(t * 40 + i));
          ellipse(ctx, fx - 0.8, fy - 1.3, 1.1, w);
          ellipse(ctx, fx + 0.8, fy - 1.3, 1.1, w);
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#26221c';
        }
      },
      collect(p) {
        bonus(p, Number(KHR.minutes) || 0, KHR.popup, 'gastro');
        if (!onceEver('khr')) return;
        const n = KHR.night || {};
        const m = G.clockMin(), from = clockMinOf(n.from), to = clockMinOf(n.to);
        const night = from != null && to != null && (from <= to ? m >= from && m < to : m >= from || m < to);
        toast((night && say('khryuchevo', 'night.label')) || say('khryuchevo', 'label'), say('khryuchevo', 'toast'));
      },
    });
  }
  function clockMinOf(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
    return m ? +m[1] * 60 + +m[2] : null;
  }

  // ---------- подмена: каждая N-я золотая — эчпочмак, каждая M-я морковка — чак-чак ----------
  G.on('spawnPickup', (p) => {
    if (!p || G.state.mode !== 'run') return;
    if (p.type === 'khryuchevo') run.lastKhrT = G.state.t;
    else if (p.type === 'gold' && ECH && G.pickupTypes.echpochmak) {
      goldN++;
      if (goldN % Math.max(1, Number(ECH.every) || 3) === 0) p.type = 'echpochmak';
    } else if (p.type === 'carrot' && CHAK && G.pickupTypes.chakchak) {
      carrotN++;
      if (carrotN % Math.max(2, Number(CHAK.every) || 18) === 0) p.type = 'chakchak';
    }
  });

  // ---------- VPN от Марата ----------
  const VPN = K.raw('items', 'vpn') && K.raw('items', 'vpn').on !== false ? K.raw('items', 'vpn') : null;
  const vpnName = () => (VPN ? (K.isOn(VPN) && K.fmt(VPN.name)) || (VPN.fallback && VPN.fallback.name) || 'VPN' : 'VPN');
  const blocks = Object.create(null);
  if (VPN && Array.isArray(VPN.blocks)) for (const id of VPN.blocks) blocks[id] = true;
  const lockSprite = () =>
    sprite('vpnLock', 26, 30, (g) => {
      g.strokeStyle = '#1f7a4c';
      g.lineWidth = 3.4;
      g.beginPath();
      g.arc(0, -4, 6.5, PI, TAU);
      g.lineTo(6.5, 1);
      g.moveTo(-6.5, 1);
      g.lineTo(-6.5, -4);
      g.stroke();
      g.fillStyle = '#2fbf71';
      rr(g, -10, 0, 20, 15, 3);
      g.fill();
      g.strokeStyle = '#155c38';
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      rr(g, -8, 1.6, 16, 2.4, 1.2);
      g.fill();
      g.fillStyle = '#0f3d26';
      ellipse(g, 0, 6.6, 2.2, 2.2);
      rr(g, -1, 7, 2, 4.5, 1);
      g.fill();
    });

  if (VPN && G.powerups && typeof G.powerups.register === 'function') {
    G.powerups.register({
      id: 'vpn',
      name: vpnName(),
      desc: String(VPN.desc || ''),
      color: '#2fbf71',
      glow: '#7be3a6',
      duration: Number(VPN.duration) || 8,
      minT: tOf(VPN.minT),
      share: Number(VPN.share) || 0.15,
      icon(ctx) {
        blit(ctx, lockSprite(), 0, 0);
      },
    });
  }
  const vpnOn = () => !!(G.powerups && typeof G.powerups.isActive === 'function' && G.powerups.isActive('vpn'));

  function updateVpn() {
    if (!VPN || !vpnOn()) return;
    const right = G.W + 30;
    for (const o of G.obstacles) {
      if (!blocks[o.type] || o.deco || o.dead || o.ballistic) continue;
      if (o.x - (o.w || 40) / 2 > right) continue;
      o.deco = true;
      o.ghost = true;
      o.stamp = VPN.stamp || null;
    }
  }

  // ---------- «Созвон отменили»: вечная память ----------
  const CANCEL = item('cancel');

  G.on('powerup', (pu) => {
    if (!pu || G.state.mode !== 'run') return;
    if (pu.id === 'vpn' && VPN && once('vpn')) {
      toast(say('vpn', 'label'), say('vpn', 'toast'));
    } else if (pu.id === 'cancel' && CANCEL && Math.random() < (Number(CANCEL.chance) || 0)) {
      if (G.powerups && typeof G.powerups.stamp === 'function') G.powerups.stamp(CANCEL.stamp);
      if (onceEver('cancel')) toast(say('cancel', 'label'), say('cancel', 'toast'));
    }
  });

  // ---------- забег ----------
  G.on('start', () => {
    run.cakes = 0;
    run.twin = false;
    run.sheets = 0;
    run.sheetsChecked = false;
    run.lastKhrT = -1e9;
    for (const k in run.toasted) delete run.toasted[k];
    day.candles = K.event('ktsBirthday') ? 2 : 1;
    day.finalFrog = K.today.wednesday && K.event('lastWednesdayOfYear');
    planCake();
    planFrog();
    planSheets();
  });

  function checkMissed() {
    for (const p of G.pickups) {
      if (p.ktsMissed || p.taken) continue;
      if (p.type === 'cake') {
        if (!missedBy(p)) continue;
        p.ktsMissed = true;
        I.event('cakeMissed', 'start', { text: say('cake', 'missed') });
      } else if (p.type === 'echpochmak') {
        if (!missedBy(p)) continue;
        p.ktsMissed = true;
        if (once('echMissed')) toast(say('echpochmak', 'missed.label'), say('echpochmak', 'missed.toast'));
      }
    }
  }

  G.onUpdate(() => {
    if (G.state.mode !== 'run') return;
    updateVpn();
    retryCake();
    checkMissed();
    checkSheets();
  }, 28);
})();
