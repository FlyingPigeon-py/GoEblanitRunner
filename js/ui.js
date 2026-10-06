/* Интерфейс: HUD, экраны старта/паузы/проигрыша, тосты, звук/музыка, тема. Владелец — агент ui. */
(() => {
  'use strict';
  const G = window.G;
  const doc = document;
  const root = doc.documentElement;
  const $ = (id) => doc.getElementById(id);

  G.colorKeys.add('face-ink');
  G.colorKeys.add('gold');
  G.colorKeys.add('fever');

  const stage = G.stage || $('stage');
  const overlay = $('overlay');
  const views = { start: $('startView'), over: $('overView'), pause: $('pauseView') };

  const hudClockBox = $('hudClockBox');
  const hudClock = $('hudClock');
  const hudAlarm = $('hudAlarm');
  const hourHand = $('alarmH');
  const minHand = $('alarmM');
  const hudScore = $('hudScore');
  const hudCombo = $('hudCombo');
  const hudBest = $('hudBest');
  const hudBestBox = $('hudBestBox');
  const pauseBtn = $('pauseBtn');
  const musicBtn = $('musicBtn');
  const muteBtn = $('mute');
  const toastBox = $('toast');
  const startBest = $('startBest');
  const startBestVal = $('startBestVal');
  const resultCard = $('resultCard');
  const recordStamp = $('recordStamp');
  const copyBtn = $('copyBtn');
  const copyLabel = $('copyLabel');
  const shareEl = $('shareText');
  const themeMeta = $('themeColor');
  const skinPick = $('skinPick');
  const skinName = $('skinName');
  const hudScoreBox = $('hudScoreBox');
  const hudScoreLabel = $('hudScoreLabel');
  const hudMeter = $('hudMeter');
  const diagEl = $('diag');
  const dayStrip = $('dayStrip');
  const mainLine = $('mainLine');
  const hintModes = $('hintModes');
  const SCORE_LABEL = 'ебланство';
  const WORK_LABEL = 'работаю…';

  const SVG = (body, extra) => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra || 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;
  const ICON = {
    soundOn: SVG('<path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
    soundOff: SVG('<path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/>'),
    musicOn: SVG('<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="17.5" cy="16" r="2.5" fill="currentColor"/>'),
    musicOff: SVG('<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="17.5" cy="16" r="2.5" fill="currentColor"/><path d="M3 3l18 18"/>'),
    pause: SVG('<rect x="6.5" y="5" width="3.6" height="14" rx="1.2"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2"/>', 'fill="currentColor"'),
    play: SVG('<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>', 'fill="currentColor"'),
    milestone: SVG('<circle cx="12" cy="13.5" r="7"/><path d="M12 10.2v3.3l2.2 1.6M4.5 5.2 7 3.2M19.5 5.2 17 3.2"/>', 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"'),
    achievement: SVG('<path d="m12 2.8 2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.86 6.5 19.75l1.05-6.12L3.1 9.3l6.15-.9z"/>', 'fill="currentColor"'),
    powerup: SVG('<path d="M13.6 2 4.8 13.4h6.1L9.6 22l9.6-12.2h-6.3z"/>', 'fill="currentColor"'),
    record: SVG('<path d="M3.5 8.2 8 12l4-6.8 4 6.8 4.5-3.8-1.8 10.3H5.3z"/>', 'fill="currentColor"'),
    skin: SVG('<ellipse cx="8.6" cy="7" rx="2.3" ry="5.2" transform="rotate(-12 8.6 7)"/><ellipse cx="15.4" cy="7" rx="2.3" ry="5.2" transform="rotate(12 15.4 7)"/><circle cx="12" cy="15.5" r="6.5"/>', 'fill="currentColor"'),
    info: SVG('<circle cx="12" cy="12" r="3.5"/>', 'fill="currentColor"'),
    expand: SVG('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    shrink: SVG('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
    mission: SVG('<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>', 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"'),
    boss: SVG('<rect x="2.5" y="6.5" width="12.5" height="11" rx="2.5"/><path d="M15 10.5 21 7.5v9l-6-3z"/>', 'fill="currentColor"'),
    grade: SVG('<path d="m12 2.8 2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.86 6.5 19.75l1.05-6.12L3.1 9.3l6.15-.9z"/>', 'fill="currentColor"'),
  };
  const DAY_ICON = {
    coffee: '<path d="M5 9h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v2.5M12 3.5v2.5"/>',
    standup: '<circle cx="6" cy="10" r="2.2"/><circle cx="12" cy="7.5" r="2.2"/><circle cx="18" cy="10" r="2.2"/><path d="M2.5 18.5a3.5 3.5 0 0 1 7 0M8.5 16a3.5 3.5 0 0 1 7 0M14.5 18.5a3.5 3.5 0 0 1 7 0"/>',
    alarm: '<circle cx="12" cy="13" r="7.5"/><path d="M12 13l-.6-4M12 13l-1.3-5.8M4.5 6.5 7 4M19.5 6.5 17 4"/>',
    lunch: '<path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17 21V3c-2.2 1.4-3 4-3 7.5h3"/>',
    lead: '<path d="M10 3h4l-1 3.2 2.4 9.3L12 20l-3.4-4.5L11 6.2z"/>',
    call: '<rect x="2.5" y="6.5" width="12.5" height="11" rx="2.5"/><path d="M15 10.5 21 7.5v9l-6-3z"/>',
    sunset: '<path d="M3 18.5h18M6.5 18.5a5.5 5.5 0 0 1 11 0M12 5.5v3M4.8 10.3l2 2M19.2 10.3l-2 2"/>',
    moon: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.4 6.4 0 0 0 10 10z"/>',
    owl: '<circle cx="8.5" cy="12" r="3.2"/><circle cx="15.5" cy="12" r="3.2"/><path d="M4.5 5.5 8 8M19.5 5.5 16 8M12 15.5v2.5"/>',
    sunrise: '<path d="M3 18.5h18M6.5 18.5a5.5 5.5 0 0 1 11 0M12 3.5v5M9.5 6 12 3.5 14.5 6"/>',
  };

  const calm = () => !!G.calm;
  const RING = [
    { transform: 'rotate(0deg)' }, { transform: 'rotate(-16deg)' }, { transform: 'rotate(14deg)' },
    { transform: 'rotate(-12deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(-6deg)' }, { transform: 'rotate(0deg)' },
  ];
  const RING_OPT = { duration: 760, easing: 'ease-in-out' };
  const BUMP = [{ transform: 'scale(1)' }, { transform: 'scale(1.22)', offset: 0.35 }, { transform: 'scale(1)' }];
  const BUMP_OPT = { duration: 380, easing: 'cubic-bezier(.3,1.6,.5,1)' };
  function play(node, frames, opts) {
    if (!node || typeof node.animate !== 'function' || calm()) return;
    try { node.animate(frames, opts); } catch (e) {}
  }

  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }

  // ---------- вердикт ----------
  // Пороги под экономику очков: морковки и комбо дают примерно втрое больше минут, чем идёт на часах.
  const VERDICTS = [
    [30, 'Даже не начал. Тимлид уже печатает в личку.'],
    [90, 'Слабо. Даже кофе не успел налить.'],
    [180, 'Разминка. Никто ничего не заподозрил.'],
    [360, 'Стендап пропущен, совесть чиста.'],
    [700, 'Нормально поебланил. Таски подождут.'],
    [1200, 'Профессионал. Можно указывать в резюме.'],
    [2000, 'Рабочий день закрыт без единого коммита.'],
    [3200, 'Мастер спорта по ебланству.'],
    [Infinity, 'Легенда. День прошёл, IDE так и не открыта.'],
  ];
  function verdict(m) {
    for (const [limit, text] of VERDICTS) if (m < limit) return text;
    return VERDICTS[VERDICTS.length - 1][1];
  }

  // ---------- оверлей ----------
  function setOverlay(name) {
    const key = name && views[name] ? name : null;
    overlay.hidden = !key;
    for (const k in views) views[k].hidden = k !== key;
    stage.classList.toggle('has-overlay', !!key);
  }

  const CAP_TOP = 'ДАВАЙ ЕБЛАНИТЬ';
  const CAP_BOTTOM = 'ПОЖАЛУЙСТА ДАВАЙ ЕБЛАНИТЬ';
  let measureCtx;
  function capWidthEm(text) {
    if (measureCtx === undefined) {
      const c = doc.createElement('canvas');
      measureCtx = (c.getContext && c.getContext('2d')) || null;
    }
    let em = 0;
    if (measureCtx) {
      measureCtx.font = '700 100px ' + G.FONT_DISPLAY;
      em = measureCtx.measureText(text).width / 100;
    }
    if (!(em > 0)) em = text.length * 0.55;
    return em + text.length * 0.01;
  }
  function layoutCaptions() {
    const s = G.scale, w = G.W * s, h = G.H * s;
    if (!(w > 0 && h > 0)) return;
    const seatH = Math.max(24, (G.H - G.GROUND) * s);
    const top = G.clamp(Math.min((w - 44) / capWidthEm(CAP_TOP), h / 5.2), 26, 64);
    const bottom = G.clamp(Math.min((w - 64) / capWidthEm(CAP_BOTTOM), (seatH - 6) / 1.06), 18, 54);
    const padBottom = Math.max(6, (seatH - bottom * 1.02 - 8) / 2);
    const st = overlay.style;
    st.setProperty('--cap-top', top.toFixed(1) + 'px');
    st.setProperty('--cap-top-over', Math.min(top, h / 8.6).toFixed(1) + 'px');
    st.setProperty('--cap-bottom', bottom.toFixed(1) + 'px');
    st.setProperty('--cap-pause', G.clamp(h / 5, 36, 80).toFixed(1) + 'px');
    st.setProperty('--pad-bottom', padBottom.toFixed(1) + 'px');
  }

  // ---------- HUD ----------
  let shownClock = -1, shownScore = -1, shownBest = -1, beating = false, recordToasted = false;
  function setHands(min) {
    const m = min % 60;
    const h = (min % 720) / 2;
    hourHand.setAttribute('transform', `rotate(${h} 20 22)`);
    minHand.setAttribute('transform', `rotate(${m * 6} 20 22)`);
  }
  function updateHud() {
    const S = G.state;
    const clock = G.clockMin();
    if (clock !== shownClock) {
      shownClock = clock;
      hudClock.textContent = G.fmtClock(clock);
      setHands(clock);
      hudClockBox.classList.toggle('meme-time', clock === 11 * 60 + 56);
    }
    const score = G.score();
    if (score !== shownScore) {
      shownScore = score;
      hudScore.textContent = G.fmtMin(score);
    }
    if (S.mode === 'start' && S.skin !== shownSkin) renderSkinPick();
    const isBeating = S.mode === 'run' && S.best > 0 && score > S.best;
    const best = isBeating ? score : S.best;
    if (best !== shownBest) {
      shownBest = best;
      hudBest.textContent = best > 0 ? G.fmtMin(best) : '—';
    }
    if (isBeating !== beating) {
      beating = isBeating;
      hudBestBox.classList.toggle('beating', beating);
      if (beating && !recordToasted) {
        recordToasted = true;
        toast('Рекорд побит', 'Дальше — только чистое ебланство', { kind: 'record' });
      }
    }
  }
  function ringAlarm() {
    play(hudAlarm, RING, RING_OPT);
  }

  let pauseKey = '';
  function renderPause() {
    const mode = G.state.mode;
    const paused = mode === 'pause';
    const key = mode === 'run' || paused ? (paused ? 'play' : 'pause') : 'off';
    if (key === pauseKey) return;
    pauseKey = key;
    pauseBtn.disabled = key === 'off';
    pauseBtn.innerHTML = paused ? ICON.play : ICON.pause;
    pauseBtn.setAttribute('aria-label', paused ? 'Продолжить' : 'Пауза');
  }

  function renderAudio() {
    const A = G.audio;
    const muted = !!(A && A.muted);
    muteBtn.innerHTML = muted ? ICON.soundOff : ICON.soundOn;
    muteBtn.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
    const canMusic = !!(A && typeof A.setMusic === 'function');
    musicBtn.hidden = !canMusic;
    if (canMusic) {
      const on = !!A.music;
      musicBtn.innerHTML = on ? ICON.musicOn : ICON.musicOff;
      musicBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      musicBtn.setAttribute('aria-label', 'Музыка');
    }
  }

  function setCombo(c) {
    const mult = Number(c && c.mult) || 1;
    const count = Number(c && c.count) || 0;
    const on = mult > 1 && count > 0;
    if (!on) {
      hudCombo.hidden = true;
      return;
    }
    const txt = '×' + String(Math.round(mult * 10) / 10).replace('.', ',');
    if (hudCombo.hidden || hudCombo.textContent !== txt) {
      hudCombo.textContent = txt;
      hudCombo.hidden = false;
      play(hudCombo, BUMP, BUMP_OPT);
    }
  }

  // ---------- Ебланометр ----------
  const METER_SEGS = 10;
  const FEVER_BLINK_SEC = 1.5;
  const meter = { segs: [], shown: -1, fever: false, ending: false };
  const modesMeter = () => !!(G.modes && typeof G.modes.meter === 'function');
  function buildMeter() {
    if (!hudMeter || meter.segs.length) return;
    for (let i = 0; i < METER_SEGS; i++) {
      const seg = doc.createElement('i');
      hudMeter.append(seg);
      meter.segs.push(seg);
    }
  }
  function setMeter(value) {
    if (!hudMeter) return;
    const v = G.clamp(Number(value) || 0, 0, 100);
    const k = Math.floor(v / (100 / METER_SEGS) + 1e-6);
    if (k === meter.shown) return;
    meter.shown = k;
    for (let i = 0; i < meter.segs.length; i++) meter.segs[i].classList.toggle('on', i < k);
    hudMeter.setAttribute('aria-valuenow', String(Math.round(v)));
  }
  function setFever(on) {
    meter.fever = on;
    if (!on) meter.ending = false;
    if (!hudMeter) return;
    hudMeter.classList.toggle('fever', on);
    if (!on) hudMeter.classList.remove('ending');
  }
  function showMeter() {
    if (!hudMeter || !hudMeter.hidden) return;
    buildMeter();
    hudMeter.hidden = false;
  }
  function tickMeter() {
    if (!meter.fever || !hudMeter) return;
    const left = G.modes && typeof G.modes.feverLeft === 'function' ? Number(G.modes.feverLeft()) || 0 : 0;
    const ending = left > 0 && left <= FEVER_BLINK_SEC;
    if (ending !== meter.ending) {
      meter.ending = ending;
      hudMeter.classList.toggle('ending', ending);
    }
  }

  // ---------- «работаю…» ----------
  const WORK_GRACE = 1;
  const work = { on: false, seen: false, wait: 0 };
  function setWorking(on) {
    work.on = on;
    work.seen = false;
    work.wait = 0;
    if (hudScoreBox) hudScoreBox.classList.toggle('working', on);
    if (hudScoreLabel) hudScoreLabel.textContent = on ? WORK_LABEL : SCORE_LABEL;
  }
  function tickWorking(realDt) {
    if (!work.on) return;
    if (G.mod('score') === 0) work.seen = true;
    else if (work.seen || (work.wait += realDt) > WORK_GRACE) setWorking(false);
  }

  function setPlaying(on) {
    stage.classList.toggle('playing', on);
  }

  function renderStartBest() {
    const b = G.state.best;
    startBest.hidden = !(b > 0);
    if (b > 0) startBestVal.textContent = G.fmtMin(b);
  }

  function unlockedSkins() {
    const M = G.meta;
    if (!M || typeof M.selectSkin !== 'function' || !Array.isArray(G.skins)) return [];
    return G.skins.filter((s) => typeof M.isSkinUnlocked !== 'function' || M.isSkinUnlocked(s.id));
  }
  let shownSkin = null;
  function renderSkinPick() {
    shownSkin = G.state.skin;
    skinPick.hidden = unlockedSkins().length < 2;
    const cur = Array.isArray(G.skins) ? G.skins.find((s) => s.id === shownSkin) : null;
    skinName.textContent = cur ? cur.name : '';
  }
  function stepSkin(dir) {
    const list = unlockedSkins();
    if (list.length < 2) return;
    const i = list.findIndex((s) => s.id === G.state.skin);
    const next = list[(i + dir + list.length) % list.length];
    if (G.meta.selectSkin(next.id)) renderSkinPick();
  }

  // ---------- тосты ----------
  const TOAST_SEC = { milestone: 3.4, achievement: 3.6, skin: 3.6, powerup: 2.2, record: 3, info: 2.8, mission: 2.2, boss: 3.2, grade: 3.4 };
  let bossUp = false;
  const maxLive = () => (bossUp || G.W * G.scale < 560 ? 1 : 2);
  const MAX_QUEUE = 6;
  const live = [];
  const queue = [];
  const sameToast = (a, b) => a.kind === b.kind && a.label === b.label && a.text === b.text;

  let frameNo = 0;
  const toastedAtFrame = Object.create(null);

  function makeToast(label, text, opts) {
    const o = opts || {};
    const kind = Object.prototype.hasOwnProperty.call(TOAST_SEC, o.kind) ? o.kind : 'info';
    const dur = Number(o.duration);
    return {
      kind,
      label: label == null ? '' : String(label),
      text: text == null ? '' : String(text),
      dur: dur > 0 ? G.clamp(dur, 0.8, 15) : TOAST_SEC[kind],
      stamp: o.stamp ? String(o.stamp) : '',
      el: null,
      until: 0,
    };
  }
  function iconSpan(kind) {
    const s = doc.createElement('span');
    s.className = 'toast-ico';
    s.innerHTML = ICON[kind] || ICON.info;
    return s;
  }
  function showToast(t) {
    const el = doc.createElement('div');
    el.className = 'toast-item toast-' + t.kind;
    const body = doc.createElement('span');
    body.className = 'toast-body';
    if (t.label) {
      const b = doc.createElement('b');
      b.className = 'toast-label';
      b.textContent = t.label;
      body.append(b);
    }
    if (t.text) {
      const s = doc.createElement('span');
      s.className = 'toast-text';
      s.textContent = t.text;
      body.append(s);
    }
    el.append(iconSpan(t.kind), body);
    if (t.stamp) {
      const st = doc.createElement('span');
      st.className = 'toast-stamp';
      st.textContent = t.stamp;
      el.append(st);
    }
    toastBox.append(el);
    t.el = el;
    t.until = G.state.realT + t.dur;
    live.push(t);
  }
  function pushToast(t) {
    if (!t.label && !t.text) return;
    for (const x of live) {
      if (sameToast(x, t)) {
        x.until = G.state.realT + t.dur;
        return;
      }
    }
    for (const x of queue) if (sameToast(x, t)) return;
    if (live.length < maxLive()) showToast(t);
    else {
      queue.push(t);
      if (queue.length > MAX_QUEUE) queue.shift();
    }
  }
  function dismissToast(t) {
    const i = live.indexOf(t);
    if (i < 0) return;
    live.splice(i, 1);
    const el = t.el;
    el.classList.add('out');
    setTimeout(() => el.remove(), calm() ? 160 : 240);
    while (queue.length && live.length < maxLive()) showToast(queue.shift());
  }
  function tickToasts() {
    const now = G.state.realT;
    for (let i = live.length - 1; i >= 0; i--) {
      if (i < live.length && now >= live[i].until) dismissToast(live[i]);
    }
  }
  function clearToasts() {
    queue.length = 0;
    for (let i = live.length - 1; i >= 0; i--) dismissToast(live[i]);
  }

  function toast(label, text, opts) {
    const t = makeToast(label, text, opts);
    toastedAtFrame[t.kind] = frameNo;
    pushToast(t);
  }

  // источник события может тостить и сам: свой тост показываем, только если за этот кадр такого вида не было
  function autoToast(kind, label, text) {
    const frame = frameNo;
    setTimeout(() => {
      if (toastedAtFrame[kind] === frame || G.state.mode === 'over' || G.state.mode === 'start') return;
      pushToast(makeToast(label, text, { kind }));
    }, 0);
  }

  // ---------- экран проигрыша ----------
  let shareText = '';
  let copyResetTimer = 0;
  const COPY_LABEL = { idle: 'Скопировать результат', done: 'Скопировано', manual: 'Выделил — скопируй вручную' };
  function setCopyState(state) {
    copyBtn.setAttribute('data-state', state);
    copyLabel.textContent = COPY_LABEL[state] || COPY_LABEL.idle;
    clearTimeout(copyResetTimer);
    if (state === 'done') copyResetTimer = setTimeout(() => setCopyState('idle'), 2200);
  }
  const sprintRun = () => (G.sprint && typeof G.sprint.lastRun === 'function' ? G.sprint.lastRun() : null);
  function buildShare(info) {
    const parts = ['Давай ебланить', G.fmtMin(info.score), 'до ' + G.fmtClock(info.clockMin)];
    const g = G.sprint && typeof G.sprint.grade === 'function' ? G.sprint.grade() : null;
    if (g && g.name) parts.push(`${g.name} ★${g.stars}`);
    if (info.isRecord) parts.push('новый рекорд');
    const R = sprintRun();
    if (R && R.closedKeys && R.closedKeys.length) parts.push('закрыл ' + R.closedKeys.join(', '));
    return parts.join(' · ');
  }

  // ---------- полоска дня ----------
  const DAY_MIN = 1440;
  const DAY_ICON_PX = 16;
  const DAY_MARKS = [
    { min: 176, icon: 'alarm', name: '11:56' },
    { min: 240, icon: 'lunch', name: 'обед' },
    { min: 540, icon: 'sunset', name: '18:00' },
    { min: 420, icon: 'call', name: 'all-hands' },
    { min: 900, icon: 'moon', name: 'полночь' },
    { min: 330, icon: 'lead', name: 'тимлид', needs: () => !!(G.modes && typeof G.modes.chase === 'function') },
    { min: 60, icon: 'standup', name: 'стендап' },
    { min: 30, icon: 'coffee', name: 'кофе-брейк' },
    { min: 1080, icon: 'owl', name: '03:00' },
    { min: 1260, icon: 'sunrise', name: 'рассвет' },
  ];
  const LOC_TINT = ['#c9a36b', '#8fae94', '#7f95c9', '#b07fc9', '#5e9fb0', '#c98f6b', '#9c8fd6', '#6b8fc9', '#c9b46b'];
  const dayPos = (m) => G.clamp(m / DAY_MIN, 0, 1) * 100;
  const clockOf = (gm) => G.fmtClock(G.cfg.startClockMin + Math.floor(gm));
  function el(tag, cls, text) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function placeAt(node, pct, edge) {
    node.style.left = pct.toFixed(2) + '%';
    if (pct < edge) node.classList.add('at-start');
    else if (pct > 100 - edge) node.classList.add('at-end');
  }
  function routeSegments(bar, gm) {
    const route = G.scene && Array.isArray(G.scene.route) ? G.scene.route : null;
    if (!route || route.length < 2) return false;
    let n = 0;
    for (let i = 0; i < route.length; i++) {
      const r = route[i];
      const a = Number(r && r.gm), b = i + 1 < route.length ? Number(route[i + 1].gm) : DAY_MIN;
      if (!(Number.isFinite(a) && Number.isFinite(b)) || a >= DAY_MIN || b <= a) continue;
      const seen = gm >= a;
      const seg = el('i', 'day-seg' + (seen ? ' seen' : ''));
      seg.style.left = dayPos(a).toFixed(2) + '%';
      seg.style.width = (dayPos(b) - dayPos(a)).toFixed(2) + '%';
      if (seen) seg.style.background = LOC_TINT[n % LOC_TINT.length];
      seg.title = seen ? String(r.name || r.id || '') : '???';
      bar.append(seg);
      n++;
    }
    return n > 0;
  }
  function renderDay(info, R) {
    if (!dayStrip) return;
    const gm = Math.max(0, Number(info.t) || 0) * G.cfg.minPerSec;
    const nodes = [];
    const bar = el('div', 'day-bar');
    if (!routeSegments(bar, gm)) {
      const fill = el('i', 'day-fill');
      fill.style.width = dayPos(gm).toFixed(2) + '%';
      bar.append(fill);
    }
    nodes.push(bar);
    const r = stage.getBoundingClientRect();
    const width = Math.max(200, Math.min(460, (r && r.width) || 320) - 40);
    const gap = (DAY_ICON_PX + 3) / width * 100;
    const placed = [];
    for (const m of DAY_MARKS) {
      if (m.needs && !m.needs()) continue;
      const pct = dayPos(m.min);
      const icon = placed.every((p) => Math.abs(p - pct) >= gap);
      const mk = el('span', 'day-mark' + (icon ? '' : ' is-dot') + (gm >= m.min ? ' passed' : ''));
      placeAt(mk, pct, icon ? 2.5 : 0);
      mk.title = `${clockOf(m.min)} · ${m.name}`;
      if (icon) {
        mk.innerHTML = SVG(DAY_ICON[m.icon] || '');
        placed.push(pct);
      }
      nodes.push(mk);
    }
    const prevBest = R ? Number(R.prevBestClock) || 0 : 0;
    const deathPct = dayPos(gm);
    const tick = el('span', 'day-tick');
    placeAt(tick, deathPct, 0.5);
    nodes.push(tick);
    const dl = el('span', 'day-label', 'слился ' + G.fmtClock(info.clockMin));
    placeAt(dl, deathPct, 12);
    nodes.push(dl);
    let rows = 1;
    if (prevBest > 0) {
      const bestPct = dayPos(prevBest);
      const bt = el('span', 'day-tick best');
      placeAt(bt, bestPct, 0.5);
      const bl = el('span', 'day-label best', (gm > prevBest ? 'был рекорд ' : 'рекорд ') + clockOf(prevBest));
      placeAt(bl, bestPct, 12);
      if (Math.abs(bestPct - deathPct) < 30) {
        bl.classList.add('row2');
        rows = 2;
      }
      nodes.push(bt, bl);
    }
    dayStrip.classList.toggle('two-rows', rows > 1);
    dayStrip.setAttribute('aria-label', `День: слился в ${G.fmtClock(info.clockMin)}` + (prevBest > 0 ? `, рекорд ${clockOf(prevBest)}` : ''));
    dayStrip.setAttribute('role', 'img');
    if (typeof dayStrip.replaceChildren === 'function') dayStrip.replaceChildren(...nodes);
    else {
      while (dayStrip.firstChild) dayStrip.removeChild(dayStrip.firstChild);
      for (const n of nodes) dayStrip.appendChild(n);
    }
    dayStrip.hidden = false;
  }

  // ---------- главная строка: ближайшая цель ----------
  const URGENT_SEC = 10;
  const MS_GOAL = {
    30: 'кофе-брейка', 60: 'стендапа', 176: '11:56', 240: 'обеда', 300: 'постобеденной комы', 360: 'ретро',
    420: 'all-hands', 540: 'конца рабочего дня', 660: 'сериала', 780: 'созвонов с Калифорнией', 900: 'полуночи',
    1080: 'трёх ночи', 1260: 'рассвета', 1440: 'суток ебланства',
  };
  function minLeft(m) {
    const k = Math.max(1, Math.ceil(m));
    return k < 60 ? `${k} ${plural(k, 'минута', 'минуты', 'минут')}` : G.fmtMin(k);
  }
  function secLeft(s) {
    return s < 1 ? 'меньше секунды!' : `≈ ${Math.round(s)} с`;
  }
  function goalCandidates(info, R) {
    const out = [];
    const mps = G.cfg.minPerSec;
    const gm = Math.max(0, Number(info.t) || 0) * mps;
    const ms = Array.isArray(G.milestones) ? G.milestones : [];
    const next = ms.find((m) => m.min > gm && MS_GOAL[m.min]);
    if (next) {
      const left = next.min - gm;
      out.push({ text: `До ${MS_GOAL[next.min]} оставалось ${minLeft(left)} (${secLeft(left / mps)})`, rel: left / next.min, secs: left / mps });
    }
    if (!info.isRecord && info.best > 0 && info.score < info.best) {
      const diff = info.best - info.score;
      const rate = info.score / Math.max(1, Number(info.t) || 0);
      const secs = rate > 0 ? diff / rate : null;
      const tail = secs != null && secs < 600 ? (secs < 1 ? ' — меньше секунды!' : ` ≈ ${Math.round(secs)} с`) : '';
      out.push({ text: `До рекорда ${G.fmtMin(diff)}${tail}`, rel: diff / info.best, secs });
    }
    const prevBest = R ? Number(R.prevBestClock) || 0 : 0;
    if (prevBest > gm) {
      const left = prevBest - gm;
      out.push({ text: `До рекорда ${clockOf(prevBest)} оставалось ${minLeft(left)} (${secLeft(left / mps)})`, rel: left / prevBest, secs: left / mps });
    }
    if (R && Array.isArray(R.tickets)) {
      for (const t of R.tickets) {
        if (t.closedNow || t.done || t.failed || !t.leftText || !(t.rel < 1)) continue;
        out.push({ text: `${t.key}: ${t.leftText}`, rel: t.rel, secs: t.secs });
      }
    }
    const nx = G.scene && G.scene.next;
    const route = G.scene && Array.isArray(G.scene.route) ? G.scene.route : null;
    if (nx && route && Number.isFinite(Number(nx.gm))) {
      const at = Number(nx.gm);
      const stop = route.find((s) => s && s.id === nx.id && s.gm === at) || route.find((s) => s && s.id === nx.id);
      let from = 0;
      for (const s of route) if (s && Number(s.gm) <= gm) from = Math.max(from, Number(s.gm) || 0);
      const left = at - gm;
      if (stop && stop.name && left > 0 && at > from) out.push({ text: `До локации «${stop.name}» оставалось ${minLeft(left)}`, rel: left / (at - from), secs: left / mps });
    }
    return out;
  }
  function pickMainLine(info, R) {
    const list = goalCandidates(info, R);
    const urgent = (c) => c.secs != null && c.secs <= URGENT_SEC;
    list.sort((a, b) => {
      const ua = urgent(a), ub = urgent(b);
      if (ua !== ub) return ua ? -1 : 1;
      if (ua) return a.secs - b.secs;
      return a.rel - b.rel;
    });
    return list.length ? list[0].text : '';
  }
  function selectShareText(text) {
    shareEl.textContent = text;
    shareEl.hidden = false;
    try {
      const sel = window.getSelection ? window.getSelection() : null;
      if (!sel || !doc.createRange) return false;
      const range = doc.createRange();
      range.selectNodeContents(shareEl);
      sel.removeAllRanges();
      sel.addRange(range);
      const copied = typeof doc.execCommand === 'function' && doc.execCommand('copy') === true;
      if (copied) {
        sel.removeAllRanges();
        shareEl.hidden = true;
      }
      return copied;
    } catch (e) {
      return false;
    }
  }
  function copyResult() {
    const text = shareText;
    if (!text) return;
    const fallback = () => setCopyState(selectShareText(text) ? 'done' : 'manual');
    const clip = navigator.clipboard;
    let pending = null;
    if (clip && typeof clip.writeText === 'function') {
      try { pending = clip.writeText(text); } catch (e) { pending = null; }
    }
    if (pending && typeof pending.then === 'function') pending.then(() => setCopyState('done'), fallback);
    else fallback();
  }

  function fillResult(info) {
    const st = info.stats || {};
    const carrots = st.carrots || 0;
    const bonus = st.bonusMin || 0;
    $('cause').textContent = info.cause || 'Работа победила.';
    const diag = info.diagnosis && typeof info.diagnosis.text === 'string' ? info.diagnosis.text : '';
    diagEl.textContent = diag;
    diagEl.hidden = !diag;
    const R = sprintRun();
    try {
      renderDay(info, R);
    } catch (e) {
      dayStrip.hidden = true;
      G.report('ui: полоска дня', e);
    }
    const line = pickMainLine(info, R);
    mainLine.textContent = line;
    mainLine.hidden = !line;
    $('sScore').textContent = G.fmtMin(info.score);
    $('sClock').textContent = `${G.fmtClock(G.cfg.startClockMin)} → ${G.fmtClock(info.clockMin)}`;
    $('sCarrots').textContent = String(carrots);
    $('sBonus').textContent = bonus > 0 ? `+${G.fmtMin(bonus)}` : carrots ? '' : 'ни одной';
    const sBest = $('sBest');
    const note = $('sBestNote');
    const record = !!info.isRecord;
    recordStamp.hidden = !record;
    resultCard.classList.toggle('is-record', record);
    sBest.classList.toggle('record', record);
    if (record) {
      sBest.textContent = G.fmtMin(info.score);
      note.textContent = info.prevBest > 0 ? `было ${G.fmtMin(info.prevBest)}` : 'первый забег';
    } else {
      sBest.textContent = G.fmtMin(info.best);
      const gap = info.best - info.score;
      note.textContent = gap > 0 ? `−${G.fmtMin(gap)}` : info.best > 0 ? 'ровно рекорд' : '';
    }
    $('verdict').textContent = verdict(info.score);
    shareText = buildShare(info);
    shareEl.hidden = true;
    shareEl.textContent = '';
    setCopyState('idle');
    resultCard.scrollTop = 0;
  }

  // ---------- тема ----------
  const THEME_KEY = 'eblan.ui.theme';
  const themeBtns = { auto: $('themeAuto'), light: $('themeLight'), dark: $('themeDark') };
  const hostTheme = root.getAttribute('data-theme');
  function applyTheme(choice, save) {
    const t = choice === 'light' || choice === 'dark' ? choice : 'auto';
    if (t !== 'auto') root.setAttribute('data-theme', t);
    else if (save) {
      if (hostTheme) root.setAttribute('data-theme', hostTheme);
      else root.removeAttribute('data-theme');
    }
    for (const k in themeBtns) if (themeBtns[k]) themeBtns[k].setAttribute('aria-pressed', k === t ? 'true' : 'false');
    if (save) G.store.set(THEME_KEY, t);
  }
  applyTheme(G.store.get(THEME_KEY, 'auto'), false);
  function syncThemeColor() {
    if (!themeMeta) return;
    try {
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      if (bg) themeMeta.setAttribute('content', bg);
    } catch (e) {}
  }

  // ---------- API ----------
  G.ui = { toast, setOverlay, verdict };

  // ---------- события ----------
  const MEME_MS = 176;
  const BOSS_MS = 420;
  let bossPhase = '';
  let pendingGrade = null;
  G.on('boot', () => {
    setOverlay('start');
    renderAudio();
    renderPause();
    renderStartBest();
    renderSkinPick();
    layoutCaptions();
    updateHud();
    syncThemeColor();
    if (modesMeter()) showMeter();
    if (hintModes) hintModes.hidden = !(G.modes && typeof G.modes.stompable === 'function');
    const fonts = doc.fonts;
    if (fonts) {
      if (fonts.ready && typeof fonts.ready.then === 'function') fonts.ready.then(layoutCaptions, () => {});
      if (typeof fonts.addEventListener === 'function') fonts.addEventListener('loadingdone', layoutCaptions);
    }
  });
  G.on('resize', layoutCaptions);
  G.on('theme', syncThemeColor);
  G.on('start', () => {
    clearToasts();
    setCombo(null);
    setMeter(0);
    setFever(false);
    setWorking(false);
    setPlaying(true);
    bossPhase = '';
    bossUp = false;
    pendingGrade = null;
    recordToasted = false;
    views.over.classList.remove('ready');
    setOverlay(null);
    renderPause();
  });
  G.on('pause', () => {
    setPlaying(false);
    setOverlay('pause');
    renderPause();
  });
  G.on('resume', () => {
    setPlaying(true);
    setOverlay(null);
    renderPause();
  });
  G.on('die', () => {
    bossUp = false;
    setPlaying(false);
    setCombo(null);
    setFever(false);
    setWorking(false);
    renderPause();
    ringAlarm();
  });
  G.on('gameover', (info) => {
    fillResult(info);
    clearToasts();
    if (pendingGrade && maxLive() > 1) toast('Новый грейд', pendingGrade.name, { kind: 'grade' });
    pendingGrade = null;
    views.over.classList.remove('ready');
    setOverlay('over');
    const wait = Math.max(0, G.cfg.restartDelay - G.cfg.overlayDelay) + 0.02;
    G.after(wait, () => {
      if (G.state.mode === 'over' && G.state.lastDeath === info) views.over.classList.add('ready');
    });
  });
  G.on('milestone', (m) => {
    if (!m) return;
    ringAlarm();
    if (m.min === BOSS_MS && (bossPhase === 'warn' || bossPhase === 'start')) return;
    if (m.min === MEME_MS && G.fx && G.fx.memeShot) return;
    autoToast('milestone', m.clock || '', m.text || '');
  });
  G.on('powerup', (p) => {
    if (!p || G.powerups) return;
    const name = p.name || 'Бонус';
    const secs = Math.round(Number(p.duration));
    const text = p.desc || (secs > 0 ? `на ${secs} ${plural(secs, 'секунду', 'секунды', 'секунд')}` : 'включено');
    autoToast('powerup', name, text);
  });
  G.on('meter', (m) => {
    showMeter();
    if (!meter.fever) setMeter(m && m.value);
  });
  G.on('fever', () => {
    showMeter();
    setMeter(100);
    setFever(true);
  });
  G.on('feverEnd', () => {
    setFever(false);
    setMeter(G.modes && typeof G.modes.meter === 'function' ? Number(G.modes.meter()) * 100 : 0);
  });
  G.on('chase', (c) => {
    if (c && c.phase === 'caught' && G.state.mode === 'run') setWorking(true);
  });
  G.on('mission', (m) => {
    if (!m || G.state.mode !== 'run') return;
    const stars = '★'.repeat(G.clamp(Math.round(Number(m.stars)) || 1, 1, 3));
    toast(`${m.key || 'Тикет'} · ${stars}`, m.name || '', { kind: 'mission', stamp: 'Закрыт' });
  });
  G.on('grade', (g) => {
    if (g && g.name) pendingGrade = g;
  });
  G.on('boss', (b) => {
    if (!b) return;
    bossPhase = b.phase || '';
    bossUp = bossPhase === 'warn' || bossPhase === 'start' || bossPhase === 'hit';
    if (G.state.mode !== 'run') return;
    if (b.phase === 'start') toast('All-hands · камеру включи', 'Лови 3 кнопки «Покинуть»', { kind: 'boss', duration: 2.6 });
    else if (b.phase === 'win') toast('Всем спасибо, все свободны', '+1 час ебланства', { kind: 'boss' });
    else if (b.phase === 'fail') toast('Перенесли на завтра', 'All-hands кончился без тебя', { kind: 'boss' });
  });
  G.on('recordFlag', (f) => {
    if (!f || f.phase !== 'pass' || G.state.mode !== 'run') return;
    toast('Дальше ты ещё не ебланил', f.clock ? `рекорд по часам — ${f.clock}` : '', { kind: 'record' });
  });
  G.on('skinUnlock', renderSkinPick);
  G.on('combo', setCombo);
  G.on('bonus', () => play(hudScore, BUMP, BUMP_OPT));
  G.on('mute', renderAudio);
  G.on('music', renderAudio);

  G.onUpdate(() => { frameNo++; }, -1e6);
  G.onUpdate((dt, realDt) => {
    updateHud();
    tickToasts();
    if (G.state.mode === 'run') {
      tickMeter();
      tickWorking(realDt || 0);
    }
  }, 90);

  // ---------- кнопки ----------
  const blurAfterPointer = (e, btn) => {
    if (e && e.detail > 0 && btn.blur) btn.blur();
  };
  $('startBtn').addEventListener('click', () => {
    if (G.state.mode === 'start') G.startGame();
  });
  $('againBtn').addEventListener('click', () => {
    const S = G.state;
    if (S.mode === 'over' && S.overShown && S.realT - S.overAt > G.cfg.restartDelay) G.startGame();
  });
  $('resumeBtn').addEventListener('click', () => {
    if (G.state.mode === 'pause') G.resume();
  });
  pauseBtn.addEventListener('click', (e) => {
    if (G.state.mode === 'run') G.pause();
    else if (G.state.mode === 'pause') G.resume();
    blurAfterPointer(e, pauseBtn);
  });
  muteBtn.addEventListener('click', (e) => {
    if (G.audio) {
      if (typeof G.audio.unlock === 'function') G.audio.unlock();
      if (typeof G.audio.toggle === 'function') G.audio.toggle();
    }
    blurAfterPointer(e, muteBtn);
  });
  musicBtn.addEventListener('click', (e) => {
    const A = G.audio;
    if (A && typeof A.setMusic === 'function') {
      if (typeof A.unlock === 'function') A.unlock();
      A.setMusic(!A.music);
    }
    blurAfterPointer(e, musicBtn);
  });
  $('skinPrev').addEventListener('click', () => stepSkin(-1));
  $('skinNext').addEventListener('click', () => stepSkin(1));
  copyBtn.addEventListener('click', (e) => {
    copyResult();
    blurAfterPointer(e, copyBtn);
  });
  for (const k in themeBtns) {
    const btn = themeBtns[k];
    if (btn) btn.addEventListener('click', () => applyTheme(k, true));
  }

  // ---------- на весь экран ----------
  // Где браузер не даёт настоящий полноэкранный режим (iPhone, встроенные окна), растягиваем блок игры на всю вкладку.
  const shell = $('gameShell');
  const fullBtn = $('fullBtn');
  let pseudoFull = false;
  const nativeFullEl = () => doc.fullscreenElement || doc.webkitFullscreenElement || null;
  const isFull = () => pseudoFull || (!!shell && nativeFullEl() === shell);
  function renderFull() {
    if (!shell || !fullBtn) return;
    const on = isFull();
    shell.classList.toggle('is-full', on);
    shell.classList.toggle('is-pseudo', pseudoFull);
    root.classList.toggle('full-lock', pseudoFull);
    fullBtn.innerHTML = on ? ICON.shrink : ICON.expand;
    fullBtn.setAttribute('aria-label', on ? 'Выйти из полноэкранного режима' : 'На весь экран');
    fullBtn.title = on ? 'Свернуть (F)' : 'На весь экран (F)';
  }
  function setPseudo(on) {
    pseudoFull = !!on;
    renderFull();
  }
  function lockLandscape() {
    const o = window.screen && window.screen.orientation;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (o && typeof o.lock === 'function' && coarse) {
      try { const p = o.lock('landscape'); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    }
  }
  function enterFull() {
    const req = shell && (shell.requestFullscreen || shell.webkitRequestFullscreen);
    if (req) {
      try {
        const p = req.call(shell, { navigationUI: 'hide' });
        if (p && typeof p.then === 'function') {
          let settled = false;
          p.then(() => { settled = true; lockLandscape(); }, () => { settled = true; setPseudo(true); });
          setTimeout(() => { if (!settled && !isFull()) setPseudo(true); }, 600);
        } else {
          setTimeout(() => { if (!isFull()) setPseudo(true); else lockLandscape(); }, 350);
        }
        return;
      } catch (e) {}
    }
    setPseudo(true);
  }
  function exitFull() {
    if (pseudoFull) {
      setPseudo(false);
      return;
    }
    const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
    if (exit && nativeFullEl()) {
      try { const p = exit.call(doc); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    }
  }
  const toggleFull = () => (isFull() ? exitFull() : enterFull());
  if (shell && fullBtn) {
    const onNativeChange = () => {
      if (nativeFullEl() === shell) pseudoFull = false;
      renderFull();
    };
    doc.addEventListener('fullscreenchange', onNativeChange);
    doc.addEventListener('webkitfullscreenchange', onNativeChange);
    fullBtn.addEventListener('click', (e) => {
      toggleFull();
      blurAfterPointer(e, fullBtn);
    });
    G.on('key', (e) => {
      if (e && e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFull();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && pseudoFull) setPseudo(false);
    });
    renderFull();
  }

  // ---------- тап-зона под полем на телефоне ----------
  const tapPad = $('tapPad');
  const tapMain = $('tapMain');
  const TAP_TEXT = { start: 'Тап — начать', run: 'Тап — прыжок', pause: 'Тап — продолжить', over: 'Тап — ещё раз' };
  function renderTap() {
    if (tapMain) tapMain.textContent = TAP_TEXT[G.state.mode] || TAP_TEXT.run;
  }
  if (tapPad) {
    tapPad.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      tapPad.classList.add('down');
      G.press('pointer');
    });
    const up = () => tapPad.classList.remove('down');
    tapPad.addEventListener('pointerup', up);
    tapPad.addEventListener('pointercancel', up);
    tapPad.addEventListener('pointerleave', up);
    tapPad.addEventListener('contextmenu', (e) => e.preventDefault());
    for (const evt of ['boot', 'start', 'pause', 'resume', 'gameover']) G.on(evt, renderTap);
    renderTap();
  }
})();
