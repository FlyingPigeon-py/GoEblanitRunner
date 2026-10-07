/* Уточки KTS: пикап duck, места и реквизит, утки верхом, легендарная, стартовый экран. Владелец — П6. */
(() => {
  'use strict';
  const G = window.G;
  const K = G.kts;
  if (!K || !K.enabled || !K.eggs) return;
  const E = K.eggs;
  const TAU = Math.PI * 2;
  const { rr, ellipse } = G.draw;
  const { sprite, blit, circle, text } = E;

  const cfg = () => K.get('eggs', 'ducks') || {};
  const duckDef = (id) => K.get('ducks', id);
  const running = () => G.state.mode === 'run';

  // ---------- рисунок уточки ----------
  const Y = '#ffd23f', Y2 = '#f4bb12', OUT = '#cf9400', BEAK = '#ff8a1f', BEAK2 = '#e0680a', KTS = '#2fbf71';
  function tail(c) {
    c.beginPath();
    c.moveTo(7, -1);
    c.quadraticCurveTo(13.5, -9.5, 14, -2);
    c.quadraticCurveTo(13.5, 3, 9, 4.5);
    c.closePath();
  }
  function paintDuck(c, look) {
    c.fillStyle = OUT;
    c.strokeStyle = OUT;
    c.lineWidth = 2.2;
    tail(c);
    c.stroke();
    ellipse(c, 1.5, 3.5, 12.1, 8.7);
    circle(c, -5.5, -5.5, 7.4);
    c.fillStyle = Y;
    tail(c);
    c.fill();
    ellipse(c, 1.5, 3.5, 11, 7.6);
    circle(c, -5.5, -5.5, 6.3);
    c.fillStyle = Y2;
    ellipse(c, 4, 3, 5.4, 3.3, -0.3);
    c.fillStyle = BEAK;
    ellipse(c, -12, -4.2, 4.2, 2.3, 0.08);
    c.fillStyle = BEAK2;
    ellipse(c, -12, -3, 3.4, 1.1, 0.08);
    c.fillStyle = KTS;
    c.beginPath();
    c.moveTo(-10.5, -0.5);
    c.quadraticCurveTo(-5, 2.6, 0.5, 0);
    c.lineTo(-3.5, 5.5);
    c.closePath();
    c.fill();
    if (look === 'legend') {
      c.fillStyle = '#111111';
      rr(c, -12.5, -9.6, 9.5, 3.6, 1.5);
      c.fill();
      c.fillRect(-3.4, -8.6, 3.6, 1);
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.fillRect(-11, -8.8, 3, 0.8);
    } else {
      c.fillStyle = '#2a1d0c';
      circle(c, -7, -7, 1.35);
      c.fillStyle = '#ffffff';
      circle(c, -7.4, -7.5, 0.45);
    }
    c.fillStyle = 'rgba(255,255,255,0.55)';
    ellipse(c, -2.5, 0.5, 3, 1.4, -0.5);
    ellipse(c, -4, -9.5, 1.8, 0.9, -0.6);
    if (look === 'badge') {
      c.strokeStyle = '#d9482f';
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(-7, 1);
      c.lineTo(-1, 9);
      c.lineTo(3, 1.5);
      c.stroke();
      c.fillStyle = '#ffffff';
      rr(c, -7, 9, 13, 7, 1.2);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.25)';
      c.lineWidth = 0.5;
      c.stroke();
      text(c, 'ТИМЛИД', -0.5, 12.6, 3, '#2a1d0c');
    }
  }
  const duckSprite = (look) => sprite('duck:' + (look || ''), 36, 32, 18, 14, (c) => paintDuck(c, look));
  function paintFlame(c) {
    const tongue = (len, h, color) => {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(0, -h);
      c.quadraticCurveTo(len * 0.55, -h * 1.6, len, -h * 0.2);
      c.quadraticCurveTo(len * 0.6, h * 0.3, len * 0.85, h * 1.2);
      c.quadraticCurveTo(len * 0.4, h * 0.9, 0, h);
      c.closePath();
      c.fill();
    };
    tongue(25, 7, '#ff3d00');
    tongue(19, 5, '#ff8a00');
    tongue(12, 3, '#ffd23f');
  }
  function paintGlow(c) {
    const g = c.createRadialGradient(0, 0, 2, 0, 0, 26);
    g.addColorStop(0, 'rgba(255,170,40,0.55)');
    g.addColorStop(1, 'rgba(255,170,40,0)');
    c.fillStyle = g;
    circle(c, 0, 0, 26);
  }
  function drawDuckAt(ctx, x, y, look, rot) {
    if (rot) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      blit(ctx, duckSprite(look), 0, 0);
      ctx.restore();
    } else blit(ctx, duckSprite(look), x, y);
  }

  // ---------- реквизит ----------
  const P = E.PROP_PAINT;
  const C = () => G.C;
  function shelf(c, y) {
    c.fillStyle = C().muted;
    rr(c, -24, y, 48, 3.4, 1);
    c.fill();
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 18, y + 3.4);
      c.lineTo(s * 13, y + 3.4);
      c.lineTo(s * 18, y + 9);
      c.closePath();
      c.fill();
    }
  }
  function puffs(c, list, color) {
    c.fillStyle = 'rgba(0,0,0,0.08)';
    for (const [x, y, r] of list) circle(c, x, y + 0.8, r + 0.6);
    c.fillStyle = color;
    for (const [x, y, r] of list) circle(c, x, y, r);
  }
  function windowFrame(c, top, bottom, glass) {
    c.fillStyle = C().card;
    rr(c, -27, top, 54, bottom - top, 2.5);
    c.fill();
    c.strokeStyle = C().line;
    c.lineWidth = 0.8;
    c.stroke();
    c.fillStyle = glass;
    rr(c, -24, top + 3, 48, bottom - top - 6, 1.5);
    c.fill();
  }
  function sill(c, y) {
    c.fillStyle = C().muted;
    rr(c, -31, y, 62, 4, 1);
    c.fill();
  }

  P.pot = {
    w: 52, h: 42, ox: 26, oy: 20,
    back(c) {
      shelf(c, 13);
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(-6, -4);
      c.quadraticCurveTo(-10, -10, -6, -17);
      c.moveTo(6, -5);
      c.quadraticCurveTo(10, -11, 6, -18);
      c.stroke();
      c.fillStyle = '#8f969e';
      rr(c, -14, -1, 28, 14, 3);
      c.fill();
      rr(c, -18.5, 2, 5, 2.6, 1);
      c.fill();
      rr(c, 13.5, 2, 5, 2.6, 1);
      c.fill();
      c.fillStyle = '#5d636a';
      ellipse(c, 0, -0.5, 13, 3);
      c.fillStyle = '#fbf6ea';
      ellipse(c, -9, -1.4, 3, 1.6, -0.3);
      ellipse(c, 9, -1.6, 3, 1.6, 0.3);
    },
    front(c) {
      c.fillStyle = '#7d848c';
      c.fillRect(-14.5, 2.4, 29, 1.6);
      c.fillStyle = '#9aa1a9';
      rr(c, -14, 3.6, 28, 9.4, 3);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(-10, 5.5, 1.6, 5);
    },
  };
  P.mug = {
    w: 52, h: 26, ox: 26, oy: 4,
    back(c) {
      shelf(c, 13);
      c.strokeStyle = '#f2ede2';
      c.lineWidth = 2.6;
      c.beginPath();
      c.arc(11, 6, 4.4, -Math.PI / 2, Math.PI / 2);
      c.stroke();
      c.fillStyle = '#f2ede2';
      rr(c, -10, -1, 21, 14, 3.5);
      c.fill();
      c.fillStyle = '#6b4a2f';
      ellipse(c, 0.5, -0.4, 9, 2.1);
    },
    front(c) {
      c.fillStyle = '#f7f3ea';
      rr(c, -10, 3, 21, 10, 3.5);
      c.fill();
      c.fillStyle = KTS;
      c.fillRect(-10, 7, 21, 2);
    },
  };
  P.box = {
    w: 52, h: 36, ox: 26, oy: 12,
    back(c) {
      shelf(c, 13);
      c.fillStyle = '#c39257';
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(s * 14, -2);
        c.lineTo(s * 21, -10);
        c.lineTo(s * 8, -9);
        c.lineTo(s * 2, -2);
        c.closePath();
        c.fill();
      }
      c.fillStyle = '#a97c45';
      rr(c, -14, -2, 28, 15, 1.2);
      c.fill();
    },
    front(c) {
      c.fillStyle = '#c99a5f';
      rr(c, -14, 2.5, 28, 10.5, 1.2);
      c.fill();
      c.fillStyle = '#e2c48f';
      c.fillRect(-2, 2.5, 4, 10.5);
    },
  };
  function paintShade(c) {
    const g = c.createRadialGradient(0, 21, 1, 0, 21, 15);
    g.addColorStop(0, 'rgba(255,226,140,0.5)');
    g.addColorStop(1, 'rgba(255,226,140,0)');
    c.fillStyle = g;
    circle(c, 0, 21, 15);
    c.fillStyle = C().card;
    c.beginPath();
    c.moveTo(-6, 9);
    c.lineTo(6, 9);
    c.lineTo(15, 19);
    c.lineTo(-15, 19);
    c.closePath();
    c.fill();
    c.strokeStyle = C().muted;
    c.lineWidth = 0.9;
    c.stroke();
    c.fillStyle = '#fff1b8';
    circle(c, 0, 21, 3);
  }
  P.chandelier = { w: 40, h: 46, ox: 20, oy: 4, cord: 9, back: paintShade };
  P.lamp = P.chandelier;
  P.disco = {
    w: 30, h: 34, ox: 15, oy: 4, cord: 11, alpha: 1,
    back(c) {
      c.fillStyle = '#b9bdc6';
      circle(c, 0, 20, 9);
      c.save();
      c.beginPath();
      c.arc(0, 20, 9, 0, TAU);
      c.clip();
      c.fillStyle = 'rgba(255,255,255,0.75)';
      for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) if ((a + b) % 2 === 0) c.fillRect(-9.5 + a * 3, 10.5 + b * 3, 2.4, 2.4);
      c.restore();
      c.fillStyle = '#ffffff';
      circle(c, -3, 16, 1.4);
    },
  };
  P.handrail = {
    w: 100, h: 36, ox: 50, oy: 4, poles: [-44, 44], polesY: 10,
    back(c) {
      c.fillStyle = C().metal;
      rr(c, -46, 10, 92, 3.2, 1.6);
      c.fill();
      c.strokeStyle = C().muted;
      c.lineWidth = 1.2;
      for (const x of [-24, 26]) {
        c.beginPath();
        c.moveTo(x, 13);
        c.lineTo(x, 22);
        c.moveTo(x + 4, 26);
        c.arc(x, 26, 4, 0, TAU);
        c.stroke();
      }
    },
  };
  P.monitor = {
    w: 62, h: 34, ox: 22, oy: 4,
    back(c) {
      c.fillStyle = C().metal;
      c.fillRect(18, 7, 18, 2.6);
      rr(c, 34, 2, 4, 13, 1);
      c.fill();
    },
    front(c) {
      c.fillStyle = '#24272d';
      rr(c, -20, -2, 40, 25, 2.5);
      c.fill();
      c.fillStyle = '#2d4f7c';
      rr(c, -17.5, 0.5, 35, 19.5, 1);
      c.fill();
      const lines = [[-15, 3, 14, '#9be3b4'], [-12, 6, 20, '#ffffff'], [-12, 9, 11, '#ffd23f'], [-15, 12, 17, '#9be3b4'], [-12, 15, 8, '#ffffff']];
      c.globalAlpha = 0.6;
      for (const [x, y, w, col] of lines) {
        c.fillStyle = col;
        c.fillRect(x, y, w, 1.3);
      }
      c.globalAlpha = 1;
    },
  };
  P.windowCloud = {
    w: 66, h: 54, ox: 33, oy: 28,
    back(c) {
      windowFrame(c, -26, 20, '#bcdcf5');
      sill(c, 20);
      puffs(c, [[-12, 7, 6.5], [-2, 5, 8], [10, 6.5, 6.5]], '#ffffff');
    },
    front(c) {
      puffs(c, [[-13, 10.5, 6], [-1, 11.2, 6.5], [11, 10.5, 6]], '#ffffff');
    },
  };
  P.windowMoon = {
    w: 66, h: 54, ox: 33, oy: 28,
    back(c) {
      windowFrame(c, -26, 22, '#1d2a48');
      c.fillStyle = '#fff7d6';
      for (const [x, y] of [[-17, -18], [12, -15], [-9, -6], [17, 2], [-19, 6]]) circle(c, x, y, 0.8);
      c.fillStyle = '#f5e6a8';
      circle(c, -1, 9, 10);
      c.fillStyle = '#1d2a48';
      circle(c, 5, 4, 8.6);
      sill(c, 22);
    },
  };
  P.windowSun = {
    w: 66, h: 52, ox: 33, oy: 38,
    back(c) {
      const g = c.createLinearGradient(0, -34, 0, 10);
      g.addColorStop(0, '#ffb38a');
      g.addColorStop(1, '#ffe2b8');
      windowFrame(c, -36, 12, g);
      c.fillStyle = '#ffd166';
      circle(c, 2, 10, 12);
      c.fillStyle = 'rgba(255,209,102,0.35)';
      circle(c, 2, 10, 17);
      sill(c, 10);
    },
  };
  P.cloud = {
    w: 62, h: 36, ox: 31, oy: 12,
    back(c) {
      puffs(c, [[-18, 8, 8], [-6, 3, 11], [8, 4, 10], [20, 9, 7]], '#f6f3ee');
      c.fillStyle = '#f6f3ee';
      ellipse(c, 0, 11, 24, 6);
    },
    front(c) {
      puffs(c, [[-14, 12.5, 7], [0, 13.5, 8], [13, 12.5, 7]], '#f6f3ee');
    },
  };
  P.portrait = {
    w: 40, h: 50, ox: 20, oy: 25,
    back(c) {
      c.fillStyle = '#c49a4c';
      rr(c, -18, -23, 36, 38, 2);
      c.fill();
      c.fillStyle = C().card;
      rr(c, -15, -20, 30, 32, 1);
      c.fill();
      c.fillStyle = '#c49a4c';
      rr(c, -16, 17, 32, 7, 1.5);
      c.fill();
      text(c, 'СОТРУДНИК МЕСЯЦА', 0, 20.6, 3.4, '#3a2a10');
    },
  };
  P.frogPoster = {
    w: 40, h: 48, ox: 20, oy: 2,
    back(c) {
      c.fillStyle = '#dff1cf';
      rr(c, -17, 9, 34, 33, 1.5);
      c.fill();
      c.strokeStyle = '#4c9a3c';
      c.lineWidth = 0.9;
      c.stroke();
      c.fillStyle = '#d9482f';
      circle(c, -13, 12, 1.3);
      circle(c, 13, 12, 1.3);
      c.fillStyle = '#5cb85c';
      ellipse(c, 0, 28, 10, 6.5);
      circle(c, -5.5, 22.5, 3.6);
      circle(c, 5.5, 22.5, 3.6);
      c.fillStyle = '#ffffff';
      circle(c, -5.5, 22.5, 2.4);
      circle(c, 5.5, 22.5, 2.4);
      c.fillStyle = '#1d1d1d';
      circle(c, -5.2, 22.8, 1.1);
      circle(c, 5.8, 22.8, 1.1);
      c.strokeStyle = '#2f6b2f';
      c.lineWidth = 0.9;
      c.beginPath();
      c.arc(0, 27, 5, 0.2 * Math.PI, 0.8 * Math.PI);
      c.stroke();
      text(c, 'IT IS WEDNESDAY', 0, 38, 3.4, '#2f6b2f');
    },
  };
  P.balloon = {
    w: 30, h: 52, ox: 8, oy: 48,
    back(c) {
      c.strokeStyle = C().muted;
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(4, -4);
      c.quadraticCurveTo(12, -12, 9, -21);
      c.stroke();
      c.fillStyle = '#24985a';
      c.beginPath();
      c.moveTo(9, -22);
      c.lineTo(6.6, -19);
      c.lineTo(11.4, -19);
      c.closePath();
      c.fill();
      c.fillStyle = KTS;
      ellipse(c, 9, -34, 10, 12.5);
      c.fillStyle = 'rgba(255,255,255,0.45)';
      ellipse(c, 5, -38, 2.6, 4, 0.3);
    },
  };
  P.sheep = {
    w: 60, h: 44, ox: 32, oy: 2,
    back(c) {
      c.lineCap = 'round';
      for (const [col, lw] of [['#d8d2c6', 3.8], ['#3b3530', 2.2]]) {
        c.strokeStyle = col;
        c.lineWidth = lw;
        c.beginPath();
        for (const x of [-11, -4, 5, 12]) {
          c.moveTo(x, 26);
          c.lineTo(x + 2, 35);
        }
        c.stroke();
      }
      puffs(c, [[-12, 16, 8], [0, 13, 9], [12, 16, 8], [-6, 22, 8], [7, 22, 8], [17, 21, 6]], '#f6f3ee');
      c.fillStyle = '#d8d2c6';
      ellipse(c, -23, 16, 7, 6);
      c.fillStyle = '#3b3530';
      ellipse(c, -23, 16, 6, 5);
      ellipse(c, -20, 11.5, 3, 1.5, -0.5);
      c.fillStyle = '#ffffff';
      circle(c, -25, 15, 1);
    },
  };
  P.umbrella = {
    w: 52, h: 60, ox: 26, oy: 44,
    back(c) {
      c.strokeStyle = '#3b3530';
      c.lineWidth = 1.6;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(0, -38);
      c.lineTo(0, 12);
      c.arc(3.5, 12, 3.5, Math.PI, 0, true);
      c.stroke();
      c.fillStyle = KTS;
      c.beginPath();
      c.arc(0, -14, 22, Math.PI, 0);
      for (let i = 0; i < 4; i++) {
        const x1 = 22 - i * 11;
        c.quadraticCurveTo(x1 - 5.5, -18, x1 - 11, -14);
      }
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.18)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(0, -36);
      c.lineTo(-11, -15);
      c.moveTo(0, -36);
      c.lineTo(11, -15);
      c.stroke();
    },
  };

  // ---------- пикап ----------
  const run = { armed: Object.create(null), order: [], spawned: Object.create(null), tries: Object.create(null), count: 0, lastT: -99, pocket: 0 };
  G.registerPickup({
    id: 'duck',
    radius: 15,
    weight: () => 0,
    power: false,
    color: Y,
    make(p, opts) {
      const o = opts || {};
      const spot = o.spot || E.takePending('duck') || 'stray';
      const def = K.raw('ducks', spot);
      p.spot = spot;
      p.look = (def && def.look) || '';
      p.legend = !!(def && def.legendary);
      p.life = 0;
      p.trail = 0;
      if (o.grab) return;
      run.spawned[spot] = true;
      run.count++;
      run.lastT = G.state.t;
      if (def && def.prop) E.addProp(def.prop, p);
    },
    update(p, dt) {
      if (p.legend) legendFly(p, dt);
    },
    draw(ctx, p) {
      const t = G.state.idleT + p.seed;
      if (p.legend) return drawLegend(ctx, p, t);
      const y = G.GROUND - p.alt + Math.sin(t * 3) * (G.calm ? 0.6 : 2);
      drawDuckAt(ctx, p.x, y, p.look, G.calm ? 0 : Math.sin(t * 2.2) * 0.08);
    },
    collect(p) {
      foundDuck(p.spot, p);
    },
  });

  function foundDuck(spot, p) {
    const c = cfg();
    const def = duckDef(spot);
    const first = def ? K.duck(spot, { source: 'run' }) : false;
    const min = first ? c.newMin || 10 : c.repeatMin || 5;
    G.addBonus(min, { x: p.x, alt: p.alt + 18, label: (c.popup || 'УТОЧКА!') + ' +' + min, kind: 'duck' });
    if (first && def && def.legendary && G.fx && G.fx.popup) G.fx.popup(p.x, p.alt + 44, 'ЖДЁМ МЕРЧ!', { size: 18, life: 1.2, color: '#ff6a00' });
  }
  function grabDuck(spot, x, alt) {
    const p = G.spawnPickup('duck', x, alt, { spot, grab: true });
    if (p) G.collect(p);
  }

  // ---------- легендарная ----------
  const FIRE = ['#ff3d00', '#ff8a00', '#ffb000'];
  function legendFly(p, dt) {
    const S = G.state, B = G.bunny;
    const hover = cfg().legendSec || 4;
    p.life += dt;
    if (p.life > 0.7 && p.life < 0.7 + hover) {
      p.x += S.dx;
      const tx = B.x + 66 + 46 * Math.sin(p.life * 1.5);
      p.x += (tx - p.x) * Math.min(1, dt * 2.4);
      p.alt += (82 + 30 * Math.sin(p.life * 3.2) - p.alt) * Math.min(1, dt * 6);
    } else if (p.life >= 0.7 + hover) {
      p.x += S.dx + 280 * dt;
      p.alt += 150 * dt;
      if (p.x > G.W + 60 || p.alt > G.H + 60) p.remove = true;
    }
    if (G.calm || !G.fx || typeof G.fx.burst !== 'function') return;
    p.trail += dt;
    while (p.trail > 0.035) {
      p.trail -= 0.035;
      G.fx.burst(p.x + 12, p.alt + 1, { n: 1, speed: 30, color: FIRE[(Math.random() * 3) | 0], life: 0.32, size: 2.6, vx: 90, vy: 25, gravity: -80 });
    }
  }
  function drawLegend(ctx, p, t) {
    const y = G.GROUND - p.alt;
    ctx.globalAlpha = 0.8;
    blit(ctx, sprite('duck:glow', 56, 56, 28, 28, paintGlow), p.x, y);
    ctx.globalAlpha = 1;
    const fl = sprite('duck:flame', 28, 24, 1, 12, paintFlame);
    const k = G.calm ? 1 : 0.85 + 0.25 * Math.abs(Math.sin(t * 17));
    ctx.save();
    ctx.translate(p.x + 11, y - 1);
    ctx.rotate(-0.25);
    ctx.scale(k, 1 / Math.sqrt(k));
    blit(ctx, fl, 0, 0);
    ctx.restore();
    drawDuckAt(ctx, p.x, y, 'legend', G.calm ? 0 : Math.sin(t * 6) * 0.15);
  }

  // ---------- когда и где ----------
  const ARM = { arc: true, double: true, under: true, ride: true };
  function whenOk(w) {
    if (!w) return true;
    const sc = G.scene || {};
    if (w.night && !(sc.night > 0.35)) return false;
    if (w.rain && !(sc.weather === 'rain' && sc.weatherK > 0.3)) return false;
    if (w.wednesday && !K.today.wednesday) return false;
    if (w.realNight && !(K.today.hh >= 21 || K.today.hh < 6)) return false;
    return true;
  }
  function rollChance(def) {
    const c = cfg();
    const base = Number(def.chance) || 0;
    return K.has('duck', def.id) ? Math.min(base, c.repeatChance == null ? 0.1 : c.repeatChance) : base;
  }
  const rideType = (def) => (def.ride || []).find((id) => G.obstacleTypes[id]) || null;
  function arm() {
    run.armed = Object.create(null);
    run.spawned = Object.create(null);
    run.tries = Object.create(null);
    run.order = [];
    run.count = 0;
    run.lastT = -99;
    run.pocket = 0;
    for (const def of K.all('ducks')) {
      let how = def.how;
      if (!ARM[how]) continue;
      if (how === 'ride' && (def.rideItem ? !G.pickupTypes[def.rideItem] : !rideType(def))) how = 'arc';
      if (def.when && def.when.wednesday && !K.today.wednesday) continue;
      if (Math.random() >= rollChance(def)) continue;
      run.armed[def.id] = how;
      if (how !== 'ride') run.order.push(def.id);
    }
    for (let i = run.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = run.order[i];
      run.order[i] = run.order[j];
      run.order[j] = t;
    }
  }
  G.on('start', arm);

  function full() {
    return run.count >= (cfg().maxPerRun || 3);
  }
  function tick() {
    const S = G.state, c = cfg();
    if (full() || S.t < (c.earliest || 6) || S.t - run.lastT < (c.gap || 8) || S.t - E.lastPlaceT() < 4) return;
    if (E.pending('duck') || E.locAge() < (c.settle || 2) || E.locLeft() < (c.minLeft || 5) || !E.quiet(5)) return;
    if (run.pocket) {
      const fresh = S.t < run.pocket;
      run.pocket = 0;
      if (fresh) return void E.place('duck', 'pocket');
    }
    for (const id of run.order) {
      if (run.spawned[id] || (run.tries[id] || 0) >= 2) continue;
      const def = duckDef(id);
      if (!def || S.t < (def.minT || c.minT || 10) || !E.inLoc(def.loc) || !whenOk(def.when)) continue;
      const how = run.armed[id];
      run.tries[id] = (run.tries[id] || 0) + 1;
      E.place('duck', id, { double: how === 'double', under: how === 'under' });
      return;
    }
  }
  let acc = 0;
  G.onUpdate((dt) => {
    if (!running()) return;
    acc += dt;
    if (acc < 0.2) return;
    acc = 0;
    tick();
  }, 34);

  // ---------- верхом на препятствии и на торте ----------
  function topAlt(o) {
    if (o.type === 'clock' && o.r) return (o.alt || 0) + 2 * o.r + 12;
    const def = G.obstacleTypes[o.type];
    const top = def && typeof def.stompTop === 'function' ? Number(def.stompTop(o)) : NaN;
    return (Number.isFinite(top) ? top : (o.alt || 0) + (o.h || 30)) + 9;
  }
  function rideFor(kindCheck) {
    if (full() || E.live.chase || E.live.boss || E.live.fever || G.state.t < (cfg().minT || 10)) return null;
    for (const id in run.armed) {
      if (run.armed[id] !== 'ride' || run.spawned[id]) continue;
      const def = duckDef(id);
      if (def && E.inLoc(def.loc) && kindCheck(def)) return id;
    }
    return null;
  }
  function mount(id) {
    run.spawned[id] = true;
    run.count++;
    run.lastT = G.state.t;
  }
  G.on('spawn', (o) => {
    if (!running() || !o || o.hero || o.deco) return;
    const id = rideFor((def) => !def.rideItem && rideType(def) === o.type);
    if (!id) return;
    o.ktsDuck = id;
    mount(id);
  });
  G.on('spawnPickup', (p) => {
    if (!running() || !p || p.type === 'duck') return;
    const id = rideFor((def) => def.rideItem === p.type);
    if (!id) return;
    p.ktsDuck = id;
    mount(id);
  });
  G.on('stomp', (e) => {
    const o = e && e.o;
    if (!o || !o.ktsDuck) return;
    const id = o.ktsDuck;
    o.ktsDuck = null;
    grabDuck(id, o.x, topAlt(o));
  });
  G.on('pickup', (p) => {
    if (!p || !p.ktsDuck) return;
    const id = p.ktsDuck;
    p.ktsDuck = null;
    grabDuck(id, p.x, p.alt + 16);
  });
  G.onRender(G.LAYER.OBSTACLES + 0.5, (ctx) => {
    const S = G.state;
    if (S.mode === 'start') return drawHeroDuck(ctx);
    const t = S.idleT;
    for (const o of G.obstacles) {
      if (!o.ktsDuck || o.dead || o.ballistic || o.stomped || o.remove) continue;
      drawDuckAt(ctx, o.x, G.GROUND - topAlt(o), '', G.calm ? 0 : Math.sin(t * 9 + o.seed) * 0.12);
    }
    for (const p of G.pickups) {
      if (!p.ktsDuck || p.taken) continue;
      drawDuckAt(ctx, p.x, G.GROUND - p.alt - 16, '', 0);
    }
  });

  // ---------- ЕБЛАН-РЕЖИМ и тимлид ----------
  G.on('fever', () => {
    if (!running()) return;
    const lg = duckDef('legend');
    if (lg && !run.spawned.legend && foundOn() >= (lg.need || 8)) {
      const k = K.today.dow === 6 ? lg.saturdayK || 1 : 1;
      if (Math.random() < rollChance(lg) * k) {
        G.spawnPickup('duck', G.W + 30, 80, { spot: 'legend' });
        G.emit('kts:egg', { id: 'duck', phase: 'legend' });
        return;
      }
    }
    const disco = duckDef('disco');
    if (disco && !run.spawned.disco && !full() && Math.random() < rollChance(disco)) G.spawnPickup('duck', G.W + 30, 62, { spot: 'disco' });
  });
  G.on('chase', (e) => {
    if (!e || e.phase !== 'escape' || !running()) return;
    const def = duckDef('pocket');
    if (!def || run.spawned.pocket || full() || Math.random() >= rollChance(def)) return;
    run.pocket = G.state.t + 12;
  });

  // ---------- стартовый экран ----------
  const start = { clock: null, lamp: null, gone: Object.create(null) };
  const startOn = (id) => G.state.mode === 'start' && !start.gone[id] && !K.has('duck', id) && !!duckDef(id) && whenOk(duckDef(id).when);
  function heroClock() {
    for (const o of G.obstacles) if (o.hero) return o;
    return null;
  }
  function lampPos() {
    return { x: G.W - 64, alt: G.GROUND - G.H * 0.36 };
  }
  function tapStart(id, x, alt) {
    if (G.state.mode !== 'start' || start.gone[id]) return;
    start.gone[id] = true;
    if (G.fx && G.fx.burst) G.fx.burst(x, alt, { n: 12, speed: 140, color: Y, life: 0.5, size: 2.6 });
    G.emit('kts:egg', { id: 'duck', phase: 'tap', spot: id });
    K.duck(id, { source: 'tap' });
  }
  function drawHeroDuck(ctx) {
    if (!startOn('startClock')) return;
    const o = heroClock();
    if (!o) return;
    const t = G.state.idleT;
    drawDuckAt(ctx, o.x + 2, G.GROUND - topAlt(o) + 1, '', G.calm ? 0 : Math.sin(t * 1.3) * 0.06);
    if (G.calm) return;
    const zt = (t * 0.6) % 1;
    ctx.globalAlpha = 1 - zt;
    blit(ctx, sprite('duck:z', 10, 12, 5, 6, (c) => text(c, 'z', 0, 0, 9, G.C.muted)), o.x - 14 - zt * 6, G.GROUND - topAlt(o) - 12 - zt * 12, 0.65 + zt * 0.35);
    ctx.globalAlpha = 1;
  }
  G.onRender(G.LAYER.BACK + 0.6, (ctx) => {
    if (!startOn('startLamp')) return;
    const L = lampPos(), y = G.GROUND - L.alt;
    const pr = P.lamp;
    ctx.strokeStyle = G.C.muted;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(L.x, -30);
    ctx.lineTo(L.x, y + pr.cord);
    ctx.stroke();
    blit(ctx, sprite('prop:lamp:b', pr.w, pr.h, pr.ox, pr.oy, pr.back), L.x, y);
    drawDuckAt(ctx, L.x, y, '', G.calm ? 0 : Math.sin(G.state.idleT * 1.1) * 0.05);
  });
  G.onUpdate(() => {
    const isStart = G.state.mode === 'start';
    if (isStart && !start.clock) {
      start.clock = E.hotspot('Уточка на будильнике', () => {
        const o = heroClock();
        if (o) tapStart('startClock', o.x, topAlt(o));
      });
      start.lamp = E.hotspot('Уточка на люстре', () => {
        const L = lampPos();
        tapStart('startLamp', L.x, L.alt);
      });
    }
    if (!start.clock) return;
    const o = isStart && startOn('startClock') ? heroClock() : null;
    E.showHotspot(start.clock, !!o, o ? o.x : 0, o ? topAlt(o) : 0, 30, 28);
    const lampOn = isStart && startOn('startLamp');
    const L = lampPos();
    E.showHotspot(start.lamp, lampOn, L.x, L.alt, 30, 30);
  }, 94);

  // ---------- коллекция и награды ----------
  function foundOn() {
    let n = 0;
    for (const d of K.all('ducks')) if (K.has('duck', d.id)) n++;
    return n;
  }
  function rewards() {
    const c = cfg();
    const n = foundOn(), total = K.total('duck');
    for (const [k, id] of c.achs || []) if (n >= k) K.ach(id);
    if (K.has('duck', 'legend')) K.ach('duckLegend');
    if (total > 0 && n >= total) {
      K.ach('ducksAll');
      K.secret('ducks');
      K.skin('duck');
    }
  }
  G.on('kts:duck', rewards);
  G.on('boot', rewards);
  E.ducksFound = foundOn;

  if (K.debug) {
    E.forceDuck = (id) => {
      const def = duckDef(id);
      if (!def || !running()) return false;
      if (def.how === 'fever' || def.how === 'legend') return !!G.spawnPickup('duck', G.W + 30, 70, { spot: id });
      return E.place('duck', id, { double: def.how === 'double', under: def.how === 'under' });
    };
  }
})();
