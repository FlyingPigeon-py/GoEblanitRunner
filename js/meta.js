/* Прогресс между забегами: ачивки, скины, общая статистика. Владелец — агент meta. */
(() => {
  'use strict';
  const G = window.G;
  const doc = document;

  const PROFILE_KEY = 'eblan.meta.profile';
  const LEGACY_KEY = 'eblan.life';
  const SKIN_KEY = 'eblan.skin';
  const TAB_KEY = 'eblan.meta.tab';
  const FALSTART_SEC = 3;
  const MEME_CLOCK = 11 * 60 + 56;
  const TOAST_GAP = 2.1;
  const FOREIGN_TOAST_HOLD = 1.4;
  const THUMB_CSS = 72;
  const CHIP_THUMB_CSS = 20;
  const OVER_CHIPS = 2;
  const MISSING_LIST_MAX = 3;
  const SILHOUETTE_ALPHA = 0.3;
  const LONG_SKIN_NAME = 14;

  const COUNTERS = ['runs', 'totalMin', 'playSec', 'carrots', 'best', 'bestClock', 'bestCarrots', 'bestNear', 'bestBonus', 'bestNoDouble', 'jumps', 'doubleJumps', 'nearMisses', 'smashed', 'passed', 'bonusMin', 'stomps', 'escapes', 'bestFevers', 'bossWins'];
  const MAPS = ['passedByType', 'pickups', 'powerups', 'deaths', 'puMap', 'plain', 'ach', 'skins', 'notes'];

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const isMap = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  function loadProfile() {
    let raw = G.store.getJSON(PROFILE_KEY, null);
    if (!isMap(raw)) raw = G.store.getJSON(LEGACY_KEY, null);
    if (!isMap(raw)) raw = {};
    const p = { v: 1 };
    for (const k of COUNTERS) p[k] = num(raw[k]);
    for (const k of MAPS) p[k] = isMap(raw[k]) ? raw[k] : {};
    p.best = Math.max(p.best, num(G.state.best));
    return p;
  }
  const profile = loadProfile();
  const save = () => G.store.setJSON(PROFILE_KEY, profile);

  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }

  // Соседи из других пакетов: тикеты и ачивки на их механиках показываем, только если механика есть.
  const NEEDS = {
    stomp: () => !!(G.modes && typeof G.modes.stompable === 'function'),
    fever: () => !!(G.modes && typeof G.modes.meter === 'function'),
    chase: () => !!(G.modes && typeof G.modes.chase === 'function'),
    boss: () => !!(G.allhands && typeof G.allhands.enabled === 'function' && G.allhands.enabled()),
    coffee: () => !!(G.powerups && G.powerups.defs && G.powerups.defs.coffee),
  };
  const hasNeed = (n) => !n || !NEEDS[n] || NEEDS[n]();

  // ---------- текущий забег ----------
  const run = { live: false, no: 0, clock: 0, noDouble: 0, carrots: 0, near: 0, bonus: 0, score: 0, smashed: 0, call: 0, tasks: 0, stomps: 0, escapes: 0, fevers: 0, bossWin: 0, caughtT: -99 };
  function sampleRun() {
    const S = G.state, st = S.stats;
    run.clock = Math.floor(num(S.t) * G.cfg.minPerSec);
    if (!st.doubleJumps) run.noDouble = run.clock;
    run.carrots = num(st.carrots);
    run.near = num(st.nearMisses);
    run.bonus = num(st.bonusMin);
    run.score = num(G.score());
    run.smashed = num(st.smashed);
    run.call = num(st.passedByType && st.passedByType.call);
    run.tasks = num(st.passedByType && st.passedByType.tasks);
  }

  const bestOf = (key, field) => (R) => Math.max(profile[key], R ? R[field] : 0);
  const sumOf = (key, field) => (R) => profile[key] + (R ? R[field] : 0);
  const passedOf = (type) => (R) => num(profile.passedByType[type]) + (R ? R[type] : 0);
  const reachedClock = bestOf('bestClock', 'clock');

  // ---------- ачивки ----------
  const ACH = [
    { id: 'standup', name: 'Стендап без меня', desc: 'Доебланить до 10:00', glyph: '10:00', goal: 60, unit: 'clock', get: reachedClock },
    { id: 'lunch', name: 'Обед по расписанию', desc: 'Дотянуть до 13:00 за один забег', glyph: '13:00', goal: 240, unit: 'clock', get: reachedClock },
    { id: 'evening', name: 'Рабочий день всё', desc: 'Доебланить до 18:00 и так и не открыть IDE', glyph: '18:00', goal: 540, unit: 'clock', get: reachedClock },
    { id: 'midnight', name: 'Кролик-полуночник', desc: 'Встретить 00:00 на диване', glyph: '00:00', goal: 900, unit: 'clock', get: reachedClock },
    { id: 'owl', name: 'Три ночи, полёт нормальный', desc: 'Дожить до 03:00. Зачем? Потому что можем', glyph: '03:00', goal: 1080, unit: 'clock', get: reachedClock },
    { id: 'minimal', name: 'Минималист', desc: 'Дожить до 10:00 без единого двойного прыжка', icon: 'arrow', goal: 60, unit: 'clock', get: bestOf('bestNoDouble', 'noDouble') },
    { id: 'snack', name: 'Перекус', desc: 'Схрумкать 30 морковок за один забег', icon: 'carrot', goal: 30, get: bestOf('bestCarrots', 'carrots') },
    { id: 'farm', name: 'Морковный олигарх', desc: '150 морковок за всё время', icon: 'carrot', goal: 150, get: sumOf('carrots', 'carrots') },
    { id: 'overtime', name: 'Сверхурочные', desc: 'Набрать 10 часов бонусного ебланства за забег', glyph: '+10ч', goal: 600, unit: 'min', get: bestOf('bestBonus', 'bonus') },
    { id: 'mute', name: 'Без меня начинайте', desc: 'Пробежать под 30 созвонами', icon: 'call', goal: 30, get: passedOf('call') },
    { id: 'backlog', name: 'Бэклог подождёт', desc: 'Перепрыгнуть 100 стопок срочных тасок', icon: 'tasks', goal: 100, get: passedOf('tasks') },
    { id: 'close', name: 'Впритирку', desc: '5 раз проскочить на волоске за один забег', icon: 'wind', goal: 5, get: bestOf('bestNear', 'near') },
    { id: 'smash', name: 'Каток', desc: 'Снести 10 препятствий', icon: 'burst', goal: 10, get: sumOf('smashed', 'smashed') },
    { id: 'falstart', name: 'Фальстарт', desc: 'Доебланиться за первые 3 секунды', icon: 'stopwatch', goal: 1, event: true },
    { id: 'email', name: 'Это могло быть письмом', desc: 'Проиграть созвону', icon: 'mail', goal: 1, event: true },
    { id: 'meme', name: 'Тот самый момент', desc: 'Доебланиться ровно в 11:56', hint: 'Секретная. Посмотри на будильник из мема', icon: 'alarm', goal: 1, event: true, secret: true },
    { id: 'snoozeMeme', name: 'Отложил тот самый', desc: 'Прыгнуть сверху на будильник 11:56', hint: 'Секретная. Тот самый будильник можно не только перепрыгнуть', icon: 'alarm', goal: 1, event: true, secret: true, needs: 'stomp' },
    { id: 'snooze50', name: 'Ещё 5 минуточек', desc: 'Отложить 50 дел за всё время', icon: 'zzz', goal: 50, get: sumOf('stomps', 'stomps'), needs: 'stomp' },
    { id: 'fever3', name: 'Доебланился до ручки', desc: 'Три раза войти в ЕБЛАН-РЕЖИМ за один забег', icon: 'bolt', goal: 3, get: bestOf('bestFevers', 'fevers'), needs: 'fever' },
    { id: 'ghost', name: 'Невидимка', desc: '5 раз сбежать от тимлида', icon: 'wind', goal: 5, get: sumOf('escapes', 'escapes'), needs: 'chase' },
    { id: 'thanks', name: 'Всем спасибо', desc: 'Закрыть all-hands кнопками «Покинуть встречу»', icon: 'leave', goal: 1, event: true, needs: 'boss' },
    { id: 'regular', name: 'Постоянный клиент', desc: 'Сыграть 25 забегов', icon: 'repeat', goal: 25, get: () => profile.runs },
    { id: 'fulltime', name: 'Полная ставка', desc: 'Наебланить суммарно 40 часов — целую рабочую неделю', icon: 'couch', goal: 2400, unit: 'min', get: sumOf('totalMin', 'score') },
    { id: 'collector', name: 'Попробовал всё', desc: 'Поймать каждый пауэр-ап хотя бы раз', icon: 'bolt', special: 'powerups' },
    { id: 'fashion', name: 'Модный приговор', desc: 'Открыть все скины', icon: 'hanger', special: 'skins' },
  ];
  const ACH_BY_ID = Object.create(null);
  for (const a of ACH) ACH_BY_ID[a.id] = a;
  // Внешние ачивки других модулей: состояние хранят они сами (done), meta только показывает и празднует.
  const EXT_ACH = [];
  const baseAch = () => ACH.filter((a) => hasNeed(a.needs)).concat(EXT_ACH);
  let achOn = ACH.filter((a) => !a.needs).concat(EXT_ACH);
  const isExtAch = (a) => typeof a.done === 'function';

  // ---------- скины ----------
  // grade — альтернативный путь: номер грейда спринта, с которого скин открывается сам
  const SKIN_RULES = Object.assign(Object.create(null), {
    dust: { cond: 'Сыграть 3 забега', goal: 3, get: () => profile.runs },
    hoodie: { cond: 'Дожить до 13:00', goal: 240, unit: 'clock', get: reachedClock },
    headphones: { cond: '50 морковок за всё время или грейд «Лид»', goal: 50, get: sumOf('carrots', 'carrots'), grade: 4 },
    tie: { cond: 'Дожить до 18:00 или грейд «Мидл»', goal: 540, unit: 'clock', get: reachedClock, grade: 2 },
    shades: { cond: '10 раз впритирку за один забег', goal: 10, get: bestOf('bestNear', 'near') },
    gold: { cond: 'Рекорд от 40 часов ебланства', goal: 2400, unit: 'min', get: (R) => Math.max(profile.best, num(G.state.best), R ? R.score : 0) },
  });
  const FALLBACK_SKINS = [
    { id: 'classic', name: 'Классика', desc: 'Тот самый кролик из мема' },
    { id: 'dust', name: 'Пыльный', desc: 'Серый, как понедельник' },
    { id: 'hoodie', name: 'Худи', desc: 'Униформа разработчика' },
    { id: 'headphones', name: 'Наушники', desc: 'Не беспокоить: фокус-мод' },
    { id: 'tie', name: 'Офисный', desc: 'Галстук для созвона с заказчиком' },
    { id: 'shades', name: 'Кибер', desc: 'Пиксельные очки, deal with it' },
    { id: 'gold', name: 'Золотой', desc: 'Для тех, кто ебланил больше всех' },
  ];
  const skinList = () => (Array.isArray(G.skins) && G.skins.length ? G.skins : FALLBACK_SKINS);
  const skinRule = (id) => SKIN_RULES[id] || null;
  function isSkinOpen(id) {
    const rule = skinRule(id);
    if (!rule || profile.skins[id] != null) return true;
    return typeof rule.isOpen === 'function' && !!rule.isOpen();
  }
  const findSkin = (id) => skinList().find((s) => s.id === id) || null;
  const achDone = (a) => profile.ach[a.id] != null || (isExtAch(a) && !!a.done());
  const isAchDone = (id) => (ACH_BY_ID[id] ? achDone(ACH_BY_ID[id]) : profile.ach[id] != null);
  // Легендарные скины — бонус сверх «Модного приговора».
  const fashionSkins = () => skinList().filter((s) => !s.legendary);

  function openSkinCount(list) {
    let n = 0;
    for (const s of list || skinList()) if (isSkinOpen(s.id)) n++;
    return n;
  }

  let pendingPowerup = null;
  let pendingAt = -1;
  function powerupPool() {
    const reg = G.powerups && G.powerups.defs;
    if (isMap(reg) && Object.keys(reg).length) return Object.keys(reg);
    const types = G.pickupTypes || {};
    const flagged = new Set();
    // Без реестра угадываем: подбираемое, после которого в том же кадре не пришёл 'powerup', считаем обычным бонусом.
    const guessed = new Set(Object.keys(profile.powerups));
    for (const id in types) {
      const def = types[id] || {};
      const key = profile.puMap[id] || id;
      if (def.power || def.powerup) flagged.add(key);
      else if (id !== 'carrot' && def.power !== false && def.powerup !== false && !profile.plain[id]) guessed.add(key);
    }
    return [...(flagged.size ? flagged : guessed)];
  }
  function powerupName(id) {
    const reg = G.powerups && G.powerups.defs;
    const def = (reg && reg[id]) || (G.pickupTypes && G.pickupTypes[id]);
    return def && typeof def.name === 'string' ? def.name : '';
  }
  function powerupProgress() {
    const pool = powerupPool();
    const missing = [];
    for (const id of pool) if (!profile.powerups[id]) missing.push(id);
    return { have: pool.length - missing.length, total: pool.length, missing };
  }

  // ---------- открытие ----------
  const fresh = [];
  const freshIds = new Set();
  let dirty = false;

  function markFresh(kind, item) {
    fresh.push({ kind, item });
    freshIds.add(kind + ':' + item.id);
  }

  function unlockAch(a, quiet) {
    if (isAchDone(a.id)) return;
    profile.ach[a.id] = quiet ? 0 : run.no;
    dirty = true;
    if (quiet) return;
    markFresh('ach', a);
    G.emit('achievement', { id: a.id, name: a.name, desc: a.desc });
    if (G.state.mode === 'run') queueToast('АЧИВКА', a.name, 'achievement');
    save();
  }

  function unlockSkin(s, quiet) {
    if (isSkinOpen(s.id)) return;
    profile.skins[s.id] = quiet ? 0 : run.no;
    dirty = true;
    if (!quiet) {
      markFresh('skin', s);
      G.emit('skinUnlock', { id: s.id, name: s.name });
      if (G.state.mode === 'run') queueToast('НОВЫЙ СКИН', s.name, 'skin');
      save();
    }
    checkFashion(quiet);
  }

  function checkFashion(quiet) {
    const list = fashionSkins();
    if (!isAchDone('fashion') && openSkinCount(list) >= list.length) unlockAch(ACH_BY_ID.fashion, quiet);
  }

  // Внешний модуль сообщил, что открыл свою ачивку или скин: тост он показывает сам, meta отмечает новинку и шлёт событие.
  function refreshAfterUnlock() {
    if (G.state.mode === 'run') return;
    renderPanel();
    if (G.state.mode === 'over') renderOver();
  }
  function notifyUnlock(kind, id) {
    if (kind === 'ach') {
      const a = ACH_BY_ID[id];
      if (!a || !isExtAch(a) || profile.ach[id] != null) return false;
      profile.ach[id] = run.no;
      dirty = true;
      markFresh('ach', a);
      G.emit('achievement', { id: a.id, name: a.name, desc: a.desc });
    } else if (kind === 'skin') {
      const s = findSkin(id);
      if (!s || profile.skins[id] != null) return false;
      profile.skins[id] = run.no;
      dirty = true;
      markFresh('skin', s);
      G.emit('skinUnlock', { id: s.id, name: s.name });
      checkFashion(false);
    } else return false;
    save();
    refreshAfterUnlock();
    return true;
  }
  function checkCollector(quiet) {
    if (isAchDone('collector')) return;
    const p = powerupProgress();
    if (p.total > 0 && p.have >= p.total) unlockAch(ACH_BY_ID.collector, quiet);
  }

  function skinRuleMet(rule, R) {
    return rule.get(R) >= rule.goal || (rule.grade != null && gradeOf(sprint.stars).idx >= rule.grade);
  }

  function checkGoals(R, quiet) {
    const skins = skinList();
    for (let i = 0; i < skins.length; i++) {
      const s = skins[i], rule = SKIN_RULES[s.id];
      if (rule && rule.get && profile.skins[s.id] == null && skinRuleMet(rule, R)) unlockSkin(s, quiet);
    }
    for (let i = 0; i < achOn.length; i++) {
      const a = achOn[i];
      if (a.get && profile.ach[a.id] == null && a.get(R) >= a.goal) unlockAch(a, quiet);
    }
  }

  // ---------- тосты ----------
  const toastQ = [];
  let toastFreeAt = 0;
  let pumpScheduled = false;

  function queueToast(label, text, kind) {
    toastQ.push({ label, text, kind });
    pumpToasts();
  }
  function pumpToasts() {
    if (G.state.mode !== 'run') {
      toastQ.length = 0;
      return;
    }
    if (!toastQ.length || !G.ui || typeof G.ui.toast !== 'function') return;
    const now = G.state.realT;
    if (now < toastFreeAt) {
      if (!pumpScheduled) {
        pumpScheduled = true;
        G.after(toastFreeAt - now, () => {
          pumpScheduled = false;
          pumpToasts();
        });
      }
      return;
    }
    const t = toastQ.shift();
    G.ui.toast(t.label, t.text, { kind: t.kind });
    toastFreeAt = now + TOAST_GAP;
    if (toastQ.length) pumpToasts();
  }
  function holdToasts() {
    toastFreeAt = Math.max(toastFreeAt, G.state.realT + FOREIGN_TOAST_HOLD);
  }

  // ---------- выбор скина ----------
  function restoreSkin() {
    const saved = G.store.get(SKIN_KEY, 'classic');
    G.state.skin = findSkin(saved) && isSkinOpen(saved) ? saved : 'classic';
  }
  function selectSkin(id) {
    if (!findSkin(id) || !isSkinOpen(id)) return false;
    G.state.skin = id;
    G.store.set(SKIN_KEY, id);
    if (view.built) renderSkins();
    return true;
  }

  // ---------- форматирование ----------
  function fmtHours(m) {
    if (m < 60) return Math.floor(m) + ' мин';
    return String(Math.floor(m / 6) / 10).replace('.', ',') + ' ч';
  }
  function fmtValue(unit, v) {
    if (unit === 'clock') return G.fmtClock(G.cfg.startClockMin + Math.floor(v));
    if (unit === 'min') return fmtHours(v);
    return String(Math.floor(v));
  }
  const progressText = (unit, v, goal) => fmtValue(unit, Math.min(v, goal)) + ' / ' + fmtValue(unit, goal);

  function achProgress(a) {
    if (a.special === 'powerups') {
      const p = powerupProgress();
      return { v: p.have, goal: p.total, unit: '', missing: p.missing };
    }
    if (a.special === 'skins') {
      const list = fashionSkins();
      return { v: openSkinCount(list), goal: list.length, unit: '' };
    }
    if (a.get) return { v: a.get(null), goal: a.goal, unit: a.unit || '' };
    if (typeof a.progress === 'function') return extProgress(a.progress());
    return null;
  }
  // Прогресс внешней ачивки или скина: {v, goal, text?}; text заменяет «v / goal».
  function extProgress(p) {
    if (!p || !(num(p.goal) > 0)) return null;
    return { v: num(p.v), goal: num(p.goal), unit: '', text: typeof p.text === 'string' ? p.text : '' };
  }
  const progressLine = (p) => p.text || progressText(p.unit, p.v, p.goal);

  // ---------- DOM ----------
  const ICONS = {
    carrot: '<path d="M10 8.5 15.5 14 5.2 20.3c-.9.5-2-.6-1.5-1.5z"/><path d="M13 11l1.6-5.6M13 11l5.6-1.6M13 11l4.5-4.5"/><path d="M8.6 13.4l1.5 1.5M6.6 16.6l1.2 1.2"/>',
    call: '<path d="M15 10.5 20.5 7.5v9L15 13.5"/><rect x="3" y="6.5" width="12" height="11" rx="2.5"/><path d="M2.5 3.5l19 17"/>',
    tasks: '<rect x="4" y="15" width="16" height="5" rx="1.2"/><rect x="5.5" y="9.5" width="13" height="5" rx="1.2"/><rect x="4.5" y="4" width="15" height="5" rx="1.2"/>',
    wind: '<path d="M3 8h10.5A2.5 2.5 0 1 0 11 5.5"/><path d="M3 12h15.5a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 16h6"/>',
    burst: '<path d="M12 3l1.8 4.6 4.7-1.6-2 4.5 4.5 2-4.6 1.7 1.6 4.8-4.6-2.2L12 21l-1.4-4.2-4.6 2.2 1.6-4.8L3 12.5l4.5-2-2-4.5 4.7 1.6z"/>',
    stopwatch: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.5M9.5 2.5h5M12 2.5v4M18.5 6.5 20 5"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    alarm: '<circle cx="12" cy="13" r="7.5"/><path d="M12 13l-.6-4M12 13l-1.3-5.8"/><path d="M4.5 6.5 7 4M19.5 6.5 17 4M7 19.5 5.5 21M17 19.5l1.5 1.5"/>',
    repeat: '<path d="M17 3l3 3-3 3"/><path d="M4 11.5V10a4 4 0 0 1 4-4h12"/><path d="M7 21l-3-3 3-3"/><path d="M20 12.5V14a4 4 0 0 1-4 4H4"/>',
    couch: '<path d="M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11"/><path d="M3 12.5a2 2 0 0 1 4 0V15h10v-2.5a2 2 0 0 1 4 0V18H3z"/><path d="M5 18v2M19 18v2"/>',
    bolt: '<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z"/>',
    hanger: '<path d="M10 6.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2V10"/><path d="M12 10 3.2 16.2A1 1 0 0 0 3.8 18h16.4a1 1 0 0 0 .6-1.8z"/>',
    arrow: '<path d="M12 20V5M6 11l6-6 6 6"/>',
    zzz: '<path d="M4 6h6l-6 7h6M13 11h4.5L13 16h4.5M17.5 3.5h3l-3 3.5h3"/>',
    note: '<path d="M6.5 3.5h8l3.5 3.5v13.5h-11.5z"/><path d="M14.5 3.5V7H18M9 11.5h6M9 15h6M9 18h3.5"/>',
    leave: '<path d="M3.5 13.2c4.9-4.3 12.1-4.3 17 0l-1.6 3.1-3.6-1.2V12c-2.8-.9-5.8-.9-8.6 0v3.1l-3.6 1.2z" fill="currentColor"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    question: '<path d="M9 9a3 3 0 1 1 4.5 2.6c-.9.5-1.5 1.2-1.5 2.2V15"/><path d="M12 19h.01"/>',
    star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
    cake: '<path d="M4 20.5h16M5 20.5v-7a1.5 1.5 0 0 1 1.5-1.5h11a1.5 1.5 0 0 1 1.5 1.5v7"/><path d="M5 15.5c1.2 1.2 2.3 1.2 3.5 0s2.3-1.2 3.5 0 2.3 1.2 3.5 0 2.3-1.2 3.5 0"/><path d="M9 12V9M15 12V9"/><path d="M9 5.5v.5M15 5.5v.5"/>',
    duck: '<path d="M4 13.5h9.5a3.5 3.5 0 0 0 1.2-6.8A3.3 3.3 0 0 0 9 8.5v2"/><path d="M4 13.5c0 4 3 6 7.5 6 5.2 0 8.5-2.6 8.5-7.5l-3.5 1.5"/><path d="M14.5 7.5 18 6.8"/><path d="M12.2 7.6h.01"/>',
    frog: '<path d="M4 15c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5c0 2.6-3.6 4.5-8 4.5s-8-1.9-8-4.5z"/><circle cx="8.5" cy="7.5" r="2.2"/><circle cx="15.5" cy="7.5" r="2.2"/><path d="M9 15.5c1.8 1.2 4.2 1.2 6 0"/>',
    mountain: '<path d="M2.5 20 9.5 7l4 7 2-3.5 6 9.5z"/><path d="m7.6 10.5 1.9 1.6 1.7-1.6"/>',
    crown: '<path d="M4 17.5 3 7.5l5 4 4-6.5 4 6.5 5-4-1 10z"/><path d="M4.5 20.5h15"/>',
  };
  const svg = (name) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || ICONS.star) + '</svg>';

  function h(tag, cls, text) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function setText(e, text) {
    if (e.textContent !== text) e.textContent = text;
  }
  function replaceKids(box, nodes) {
    if (typeof box.replaceChildren === 'function') box.replaceChildren(...nodes);
    else {
      while (box.firstChild) box.removeChild(box.firstChild);
      for (const n of nodes) box.appendChild(n);
    }
  }
  function setBar(fill, k) {
    fill.style.width = Math.round(G.clamp(k, 0, 1) * 100) + '%';
  }
  function fillBadge(el, a, done) {
    const key = done || !a.secret ? a.id : '?';
    if (el.dataset.glyph === key) return;
    el.dataset.glyph = key;
    if (!done && a.secret) el.innerHTML = svg('question');
    else if (a.glyph) el.textContent = a.glyph;
    else el.innerHTML = svg(a.icon);
  }
  const reducedMotion = () => !!G.calm;
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

  // ---------- превью кролика ----------
  const FALLBACK_FUR = { dust: '#bdb8ae', gold: '#f5cf5a' };
  function fallbackThumb(ctx, w, h0, id) {
    const s = Math.min(w, h0) / 80;
    const e = G.draw.ellipse;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h0);
    ctx.translate(w / 2 - 2 * s, h0 * 0.86);
    ctx.scale(s, s);
    ctx.fillStyle = FALLBACK_FUR[id] || G.C.bunny;
    e(ctx, -27, -22, 7.5, 7.5);
    e(ctx, -2, -22, 27, 22);
    e(ctx, 15, -29, 16, 15);
    e(ctx, 6, -50, 5.5, 13, -0.75);
    e(ctx, 13, -51, 5.5, 13, -0.42);
    ctx.fillStyle = '#2a2118';
    e(ctx, 21, -32, 2.8, 3);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function paintThumb(cv, skinId, locked) {
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return;
    let painted = false;
    if (typeof G.renderBunnyThumb === 'function') {
      try {
        G.renderBunnyThumb(cv, skinId);
        painted = true;
      } catch (e) {
        G.report('bunny: renderBunnyThumb (из meta)', e);
      }
    }
    ctx.save();
    if (!painted) fallbackThumb(ctx, cv.width, cv.height, skinId);
    if (locked) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.globalAlpha = SILHOUETTE_ALPHA;
      ctx.fillStyle = G.C.ink;
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
    ctx.restore();
  }
  function makeThumbCanvas(cssPx) {
    const cv = doc.createElement('canvas');
    const px = Math.round(cssPx * dpr());
    cv.width = px;
    cv.height = px;
    cv.setAttribute('aria-hidden', 'true');
    return cv;
  }

  // ---------- панель ----------
  const view = { built: false, themeStamp: 0, tab: 'skins', stats: {}, tabs: {}, panes: {}, skinGrid: null, revealed: false, skinCards: [], achCards: [], achGrid: null, achBar: null, achLabel: null, noteCards: [], noteBar: null, noteLabel: null, collCards: [], collGrid: null };
  let TAB_ORDER = ['skins', 'ach', 'notes'];

  // Коллекции внешних модулей: view() → {title, value, sub, k, num, icon, chips: [{label, on, title}]} или null (скрыть).
  const COLLECTIONS = [];
  let collFresh = 0;

  function statTile(parent, key, label) {
    const box = h('div', 'mp-stat');
    const dd = h('dd', 'mp-stat-val', '—');
    box.append(h('dt', 'mp-stat-key', label), dd);
    parent.append(box);
    view.stats[key] = dd;
    return box;
  }

  function buildSkinCard(s) {
    const btn = h('button', 'mp-skin');
    btn.type = 'button';
    btn.dataset.skin = s.id;
    if (s.legendary) btn.classList.add('is-legendary');
    const thumb = h('span', 'mp-thumb');
    const cv = makeThumbCanvas(THUMB_CSS);
    const lock = h('span', 'mp-lock');
    lock.innerHTML = svg('lock');
    const tag = h('span', 'mp-tag', 'на диване');
    const newTag = h('span', 'mp-new', 'новый');
    thumb.append(cv, lock, tag, newTag);
    if (s.tag) thumb.append(h('span', 'mp-legend', s.tag));
    const name = h('span', 'mp-skin-name' + (s.name.length > LONG_SKIN_NAME ? ' is-long' : ''), s.name);
    const note = h('span', 'mp-skin-note');
    const meter = h('span', 'mp-meter');
    const bar = h('span', 'mp-bar');
    const fill = h('i');
    bar.append(fill);
    const numEl = h('span', 'mp-num');
    meter.append(bar, numEl);
    btn.append(thumb, name, note, meter);
    btn.addEventListener('click', (e) => {
      if (e && e.detail > 0 && btn.blur) btn.blur();
      if (!selectSkin(s.id) && !reducedMotion() && btn.animate) {
        btn.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }],
          { duration: 320, easing: 'ease-out' }
        );
      }
    });
    const card = { s, btn, cv, lock, tag, newTag, note, meter, fill, numEl, paintKey: '' };
    view.skinCards.push(card);
    return btn;
  }

  function buildAchCard(a) {
    const box = h('div', 'mp-ach');
    box.setAttribute('role', 'listitem');
    const badge = h('span', 'mp-badge');
    badge.setAttribute('aria-hidden', 'true');
    const body = h('div', 'mp-ach-body');
    const head = h('div', 'mp-ach-head');
    const name = h('span', 'mp-ach-name');
    const newTag = h('span', 'mp-new', 'новое');
    head.append(name, newTag);
    const desc = h('div', 'mp-ach-desc');
    const meter = h('div', 'mp-meter');
    const bar = h('span', 'mp-bar');
    const fill = h('i');
    bar.append(fill);
    const numEl = h('span', 'mp-num');
    meter.append(bar, numEl);
    const when = h('div', 'mp-ach-when');
    body.append(head, desc, meter, when);
    box.append(badge, body);
    view.achCards.push({ a, box, badge, name, newTag, desc, meter, fill, numEl, when });
    return box;
  }

  function buildTab(id, label) {
    const btn = h('button', 'mp-tab');
    btn.type = 'button';
    btn.id = 'metaTab-' + id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', 'metaPane-' + id);
    const count = h('span', 'mp-count');
    btn.append(h('span', 'mp-tab-label', label), count);
    btn.addEventListener('click', (e) => {
      if (e && e.detail > 0 && btn.blur) btn.blur();
      setTab(id);
    });
    view.tabs[id] = { btn, count };
    return btn;
  }

  function buildPane(id) {
    const pane = h('div', 'mp-pane');
    pane.id = 'metaPane-' + id;
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', 'metaTab-' + id);
    view.panes[id] = pane;
    return pane;
  }

  function setTab(id, focus) {
    if (!view.panes[id]) return;
    view.tab = id;
    G.store.set(TAB_KEY, id);
    for (const k in view.tabs) {
      const on = k === id;
      view.tabs[k].btn.setAttribute('aria-selected', on ? 'true' : 'false');
      view.tabs[k].btn.tabIndex = on ? 0 : -1;
      view.panes[k].hidden = !on;
    }
    if (focus && view.tabs[id].btn.focus) view.tabs[id].btn.focus();
    revealTab(view.tabs[id].btn);
    if (id === 'skins' && !view.revealed) revealChosenSkin();
  }

  function revealTab(btn) {
    const bar = btn.parentNode;
    if (!bar || !(bar.scrollWidth > bar.clientWidth)) return;
    const left = btn.offsetLeft - (bar.clientWidth - btn.offsetWidth) / 2;
    if (Number.isFinite(left)) bar.scrollLeft = Math.max(0, left);
  }

  function build() {
    const panel = doc.getElementById('metaPanel');
    if (!panel || view.built) return;

    const top = h('div', 'mp-top');
    const heading = h('div', 'mp-heading');
    heading.append(h('h2', 'mp-title', 'Личное дело'), h('p', 'mp-sub', 'кролика, который ебланит профессионально'));
    const stats = h('dl', 'mp-stats');
    statTile(stats, 'runs', 'забегов');
    statTile(stats, 'total', 'наебланено');
    statTile(stats, 'carrots', 'морковок');
    const bestTile = statTile(stats, 'best', 'рекорд');
    view.stats.bestSub = h('span', 'mp-stat-sub');
    bestTile.append(view.stats.bestSub);
    top.append(heading, stats);

    const tabs = h('div', 'mp-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Разделы прогресса');
    TAB_ORDER = COLLECTIONS.length ? ['skins', 'ach', 'coll', 'notes'] : ['skins', 'ach', 'notes'];
    tabs.append(buildTab('skins', 'Скины'), buildTab('ach', 'Ачивки'));
    if (COLLECTIONS.length) tabs.append(buildTab('coll', 'Коллекции'));
    tabs.append(buildTab('notes', 'Объяснительные'));
    tabs.addEventListener('keydown', (e) => {
      if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
      e.preventDefault();
      const i = TAB_ORDER.indexOf(view.tab), n = TAB_ORDER.length;
      setTab(TAB_ORDER[(i + (e.code === 'ArrowRight' ? 1 : n - 1)) % n], true);
    });

    const skinsPane = buildPane('skins');
    const skinGrid = h('div', 'mp-skins');
    for (const s of skinList()) skinGrid.append(buildSkinCard(s));
    skinsPane.append(skinGrid);
    view.skinGrid = skinGrid;

    const achPane = buildPane('ach');
    const prog = h('div', 'mp-total');
    view.achLabel = h('span', 'mp-total-label');
    const bar = h('span', 'mp-bar');
    view.achBar = h('i');
    bar.append(view.achBar);
    prog.append(view.achLabel, bar);
    const achGrid = h('div', 'mp-achs');
    achGrid.setAttribute('role', 'list');
    for (const a of achOn) achGrid.append(buildAchCard(a));
    achPane.append(prog, achGrid);
    view.achGrid = achGrid;

    let collPane = null;
    if (COLLECTIONS.length) {
      collPane = buildPane('coll');
      const collGrid = h('div', 'mp-colls');
      collGrid.setAttribute('role', 'list');
      for (const c of COLLECTIONS) collGrid.append(buildCollCard(c));
      collPane.append(collGrid);
      view.collGrid = collGrid;
    }

    const notesPane = buildPane('notes');
    const nprog = h('div', 'mp-total');
    view.noteLabel = h('span', 'mp-total-label');
    const nbar = h('span', 'mp-bar');
    view.noteBar = h('i');
    nbar.append(view.noteBar);
    nprog.append(view.noteLabel, nbar);
    const noteGrid = h('div', 'mp-notes');
    noteGrid.setAttribute('role', 'list');
    noteCatalog().forEach((n, i) => noteGrid.append(buildNoteCard(n, i)));
    notesPane.append(nprog, noteGrid);

    panel.append(top, tabs, skinsPane, achPane);
    if (collPane) panel.append(collPane);
    panel.append(notesPane);
    view.built = true;
    const savedTab = G.store.get(TAB_KEY, 'skins');
    setTab(view.panes[savedTab] ? savedTab : 'skins');
    renderPanel();
    panel.hidden = false;
    revealChosenSkin();
  }

  function revealChosenSkin() {
    const grid = view.skinGrid;
    const card = view.skinCards.find((c) => c.s.id === G.state.skin);
    if (!grid || !card || !(grid.scrollWidth > grid.clientWidth)) return;
    const left = card.btn.offsetLeft - (grid.clientWidth - card.btn.offsetWidth) / 2;
    if (!Number.isFinite(left)) return;
    grid.scrollLeft = Math.max(0, left);
    view.revealed = true;
  }

  function renderStats() {
    const best = Math.max(profile.best, num(G.state.best));
    setText(view.stats.runs, String(profile.runs));
    setText(view.stats.total, profile.totalMin ? G.fmtMin(Math.round(profile.totalMin)) : '0 мин');
    setText(view.stats.carrots, String(profile.carrots));
    setText(view.stats.best, best ? G.fmtMin(best) : '—');
    setText(view.stats.bestSub, profile.bestClock ? 'дотянул до ' + fmtValue('clock', profile.bestClock) : 'пока ни разу');
  }

  function renderSkins() {
    let open = 0, freshCount = 0;
    for (const c of view.skinCards) {
      const id = c.s.id, rule = skinRule(id), unlocked = isSkinOpen(id), chosen = G.state.skin === id;
      const isFresh = freshIds.has('skin:' + id);
      if (unlocked) open++;
      if (isFresh) freshCount++;
      c.btn.classList.toggle('is-locked', !unlocked);
      c.btn.classList.toggle('is-chosen', chosen);
      c.btn.classList.toggle('is-new', isFresh);
      c.btn.setAttribute('aria-pressed', chosen ? 'true' : 'false');
      c.btn.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
      c.lock.hidden = unlocked;
      c.tag.hidden = !chosen;
      c.newTag.hidden = !isFresh || chosen;
      const p = unlocked || !rule ? null : rule.get ? { v: rule.get(null), goal: rule.goal, unit: rule.unit } : typeof rule.progress === 'function' ? extProgress(rule.progress()) : null;
      c.meter.hidden = !p;
      if (unlocked || !rule) {
        setText(c.note, c.s.desc || '');
        c.btn.setAttribute('aria-label', c.s.name + (chosen ? ' — на диване' : ' — надеть'));
      } else {
        setText(c.note, rule.cond);
        if (p) {
          setText(c.numEl, progressLine(p));
          setBar(c.fill, p.v / p.goal);
        }
        c.btn.setAttribute('aria-label', c.s.name + ' — закрыт: ' + rule.cond);
      }
      const key = view.themeStamp + ':' + unlocked;
      if (c.paintKey !== key) {
        c.paintKey = key;
        paintThumb(c.cv, id, !unlocked);
      }
    }
    const t = view.tabs.skins;
    setText(t.count, open + '/' + view.skinCards.length);
    t.btn.classList.toggle('has-new', freshCount > 0);
  }

  function missingNote(p) {
    if (!p || !p.missing || !p.missing.length || p.missing.length > MISSING_LIST_MAX || p.v < 1) return '';
    const names = p.missing.map(powerupName).filter(Boolean);
    return names.length === p.missing.length ? '. Не хватает: ' + names.join(', ') : '';
  }

  function renderAch() {
    let done = 0, freshCount = 0;
    for (const c of view.achCards) {
      const a = c.a, ok = isAchDone(a.id), isFresh = freshIds.has('ach:' + a.id);
      const hiddenSecret = !!a.secret && !ok;
      if (ok) done++;
      if (isFresh) freshCount++;
      c.box.classList.toggle('is-done', ok);
      c.box.classList.toggle('is-locked', !ok);
      c.box.classList.toggle('is-secret', hiddenSecret);
      c.box.classList.toggle('is-new', isFresh);
      c.newTag.hidden = !isFresh;
      fillBadge(c.badge, a, ok);
      const at = num(profile.ach[a.id]);
      c.when.hidden = !ok;
      if (ok) setText(c.when, at ? 'получена в забеге №' + at : 'получена');
      const p = ok || a.event ? null : achProgress(a);
      setText(c.name, hiddenSecret ? '???' : a.name);
      setText(c.desc, hiddenSecret ? a.hint || '' : a.desc + missingNote(p));
      c.meter.hidden = !p;
      if (p) {
        if (p.goal > 0) {
          setText(c.numEl, progressLine(p));
          setBar(c.fill, p.v / p.goal);
        } else {
          setText(c.numEl, 'пауэр-апов пока не завезли');
          setBar(c.fill, 0);
        }
      }
    }
    const total = view.achCards.length;
    const t = view.tabs.ach;
    setText(t.count, done + '/' + total);
    t.btn.classList.toggle('has-new', freshCount > 0);
    setText(view.achLabel, 'Собрано ' + done + ' из ' + total);
    setBar(view.achBar, total ? done / total : 0);
  }

  function renderPanel() {
    if (!view.built) return;
    dirty = false;
    renderStats();
    renderSkins();
    renderAch();
    renderColls();
    renderNotes();
  }

  // ---------- коллекции ----------
  function buildCollCard(col) {
    const box = h('div', 'mp-coll');
    box.setAttribute('role', 'listitem');
    const badge = h('span', 'mp-badge');
    badge.setAttribute('aria-hidden', 'true');
    const body = h('div', 'mp-coll-body');
    const head = h('div', 'mp-coll-head');
    const title = h('span', 'mp-coll-title');
    const value = h('b', 'mp-coll-val');
    head.append(title, value);
    const meter = h('div', 'mp-meter');
    const bar = h('span', 'mp-bar');
    const fill = h('i');
    bar.append(fill);
    const numEl = h('span', 'mp-num');
    meter.append(bar, numEl);
    const sub = h('div', 'mp-coll-sub');
    const chips = h('div', 'mp-chips');
    body.append(head, meter, sub, chips);
    box.append(badge, body);
    view.collCards.push({ col, box, badge, title, value, meter, fill, numEl, sub, chips, icon: '', chipKey: '' });
    return box;
  }

  function collView(col) {
    try {
      return col.view() || null;
    } catch (e) {
      G.report('meta: коллекция ' + col.id, e);
      return null;
    }
  }

  function renderChips(c, list) {
    const key = list.map((x) => (x.on ? '1' : '0') + x.label).join('|');
    if (c.chipKey === key) return;
    c.chipKey = key;
    replaceKids(c.chips, list.map((x) => {
      const chip = h('span', 'mp-chip' + (x.on ? ' is-on' : ''), x.on ? x.label : '?');
      if (x.on && x.title) chip.title = x.title;
      return chip;
    }));
  }

  function renderColls() {
    if (!view.collGrid) return;
    let shown = 0;
    for (const c of view.collCards) {
      const v = collView(c.col);
      c.box.hidden = !v;
      if (!v) continue;
      shown++;
      const icon = v.icon || 'star';
      if (c.icon !== icon) {
        c.icon = icon;
        c.badge.innerHTML = svg(icon);
      }
      c.box.classList.toggle('is-done', !!v.done);
      setText(c.title, v.title || '');
      setText(c.value, v.value == null ? '' : String(v.value));
      const hasBar = typeof v.k === 'number' && Number.isFinite(v.k);
      c.meter.hidden = !hasBar;
      if (hasBar) {
        setBar(c.fill, v.k);
        setText(c.numEl, v.num || '');
      }
      setText(c.sub, v.sub || '');
      c.sub.hidden = !v.sub;
      const list = Array.isArray(v.chips) ? v.chips : [];
      c.chips.hidden = !list.length;
      if (list.length) renderChips(c, list);
    }
    const t = view.tabs.coll;
    if (t) {
      t.count.hidden = !collFresh;
      if (collFresh) setText(t.count, '+' + collFresh);
      t.btn.classList.toggle('has-new', collFresh > 0);
      t.btn.hidden = !shown;
    }
  }
  function touchCollection() {
    collFresh++;
    if (G.state.mode !== 'run') renderPanel();
  }

  // ---------- папка объяснительных ----------
  const NOTE_WHO = { clock: 'будильник', tasks: 'таски', call: 'созвон', ping: 'пинг', laptop: 'ноутбук', deadline: 'дедлайн', minute: '«есть минутка?»' };
  const NOTE_SECRETS = [
    { key: 'meme', text: 'Доебланился ровно в 11:56. Мем исполнен.', hint: 'Время на будильнике из мема', who: 'секретная' },
    { key: 'working', text: 'Пал, делая вид, что работаешь.', hint: 'Тимлид рядом, ноут открыт', who: 'секретная', needs: 'chase' },
    { key: 'teamlead', text: 'Тимлид догнал. Минутка длилась до вечера.', hint: 'Кто-то идёт сзади', who: 'тимлид', needs: 'chase' },
    { key: 'allhands', text: 'Застрял на all-hands. Навсегда.', hint: '16:00, камера включена', who: 'all-hands', needs: 'boss' },
  ];
  const WORKING_SEC = 5.2;
  let notesCache = null;
  function noteCatalog() {
    if (notesCache) return notesCache;
    const list = [];
    const types = G.obstacleTypes || {};
    for (const id in types) {
      const causes = types[id] && Array.isArray(types[id].causes) ? types[id].causes : [];
      causes.forEach((text, i) => list.push({ key: id + ':' + i, text, who: NOTE_WHO[id] || id, secret: false }));
    }
    for (const s of NOTE_SECRETS) if (hasNeed(s.needs)) list.push({ key: s.key, text: s.text, hint: s.hint, who: s.who, secret: true });
    notesCache = list;
    return list;
  }
  const noteOpen = (key) => profile.notes[key] != null;
  function notesDone() {
    let n = 0;
    for (const c of noteCatalog()) if (noteOpen(c.key)) n++;
    return n;
  }
  function deathNoteKeys(info) {
    const keys = [];
    if (info.causeTag) keys.push(String(info.causeTag));
    else {
      const def = info.def || G.obstacleTypes[info.type];
      const i = def && Array.isArray(def.causes) ? def.causes.indexOf(info.cause) : -1;
      if (i >= 0) keys.push(info.type + ':' + i);
    }
    if (info.clockMin === MEME_CLOCK) keys.push('meme');
    if (num(info.t) - run.caughtT < WORKING_SEC) keys.push('working');
    return keys;
  }
  let freshNote = null;
  function recordNotes(info) {
    freshNote = null;
    if (!info) return;
    const known = new Set(noteCatalog().map((c) => c.key));
    for (const key of deathNoteKeys(info)) {
      if (!known.has(key) || noteOpen(key)) continue;
      profile.notes[key] = run.no;
      freshNote = { key, n: notesDone(), total: known.size };
      dirty = true;
    }
    if (freshNote) save();
  }

  function buildNoteCard(n, i) {
    const box = h('div', 'mp-note' + (n.secret ? ' is-secret' : ''));
    box.setAttribute('role', 'listitem');
    const head = h('div', 'mp-note-head');
    head.append(h('span', 'mp-note-no', '№ ' + (i + 1)), h('span', 'mp-note-who', n.who));
    const text = h('p', 'mp-note-text');
    const when = h('span', 'mp-note-when');
    box.append(head, text, when);
    view.noteCards.push({ n, box, text, when });
    return box;
  }
  function renderNotes() {
    if (!view.noteLabel) return;
    let done = 0;
    for (const c of view.noteCards) {
      const open = noteOpen(c.n.key);
      if (open) done++;
      c.box.classList.toggle('is-open', open);
      c.box.classList.toggle('is-new', !!freshNote && freshNote.key === c.n.key);
      if (open) setText(c.text, '«' + c.n.text + '»');
      else setText(c.text, c.n.secret ? c.n.hint : '');
      const at = num(profile.notes[c.n.key]);
      setText(c.when, open ? (at ? 'забег №' + at : 'подписано') : '');
    }
    const total = view.noteCards.length;
    setText(view.noteLabel, 'Подписано ' + done + ' из ' + total);
    setBar(view.noteBar, total ? done / total : 0);
    const t = view.tabs.notes;
    if (t) {
      setText(t.count, done + '/' + total);
      t.btn.classList.toggle('has-new', !!freshNote);
    }
  }


  // ---------- спринт: три тикета и грейды ----------
  const SPRINT_KEY = 'eblan.meta.sprint';
  const SKIP_EVERY = 3;
  const IDLE_HOT = 5;
  const RECENT_MAX = 6;
  const GRADE_STEP = 30;
  const GRADES = [
    [0, 'Стажёр'], [3, 'Джун'], [9, 'Мидл'], [18, 'Сеньор'], [30, 'Лид'],
    [45, 'Архитектор дивана'], [65, 'CTO ебланства'], [90, 'Ебланист-евангелист'],
  ];
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const gradeNames = Object.create(null);
  let gradeCheer = null;
  const gradeName = (i) => gradeNames[i] || GRADES[i][1];

  function gradeOf(stars) {
    const s = num(stars);
    let i = 0;
    while (i + 1 < GRADES.length && s >= GRADES[i + 1][0]) i++;
    if (i + 1 < GRADES.length) return { idx: i, name: gradeName(i), stars: s, from: GRADES[i][0], next: GRADES[i + 1][0], nextName: gradeName(i + 1) };
    const top = GRADES[i][0], base = gradeName(i);
    const extra = Math.floor((s - top) / GRADE_STEP);
    const roman = (n) => ROMAN[n] || String(n);
    return {
      idx: i + extra,
      name: extra ? base + ' ' + roman(extra + 1) : base,
      stars: s,
      from: top + extra * GRADE_STEP,
      next: top + (extra + 1) * GRADE_STEP,
      nextName: base + ' ' + roman(extra + 2),
    };
  }

  const isCarrot = (p) => !!p && (p.type === 'carrot' || p.type === 'gold' || !!(G.pickupTypes[p.type] && G.pickupTypes[p.type].carrotLike));
  const clockTxt = (m) => G.fmtClock(G.cfg.startClockMin + Math.floor(m));
  const gameMin = () => num(G.state.t) * G.cfg.minPerSec;
  const coffeeOn = () => !!(G.powerups && typeof G.powerups.isActive === 'function' && G.powerups.isActive('coffee'));

  // kind: count — за забег; cum — накопительно между забегами; max — лучшее значение за забег;
  // flag — одно событие; clock — дожить до goal; anti — дожить до goal без провала; streak — подряд в окне пауэр-апа
  const TPL = [
    {
      id: 'tasks', slot: 1, cat: 'tasks', kind: 'count', base: 5, max: 15, grow: true,
      name: (n) => `Перепрыгни ${n} ${plural(n, 'стопку', 'стопки', 'стопок')} тасок`,
      left: (k) => `ещё ${k} ${plural(k, 'стопка', 'стопки', 'стопок')}`,
      on: { pass: (o) => (o && o.type === 'tasks' ? 1 : 0), stomp: (e) => (e && e.type === 'tasks' ? 1 : 0) },
    },
    {
      id: 'carrots', slot: 1, cat: 'carrot', kind: 'count', base: 12, max: 40, grow: true,
      name: (n) => `Схрумкай ${n} ${plural(n, 'морковку', 'морковки', 'морковок')} за забег`,
      left: (k) => `ещё ${k} ${plural(k, 'морковка', 'морковки', 'морковок')}`,
      on: { pickup: (p) => (isCarrot(p) ? 1 : 0) },
    },
    {
      id: 'near', slot: 1, cat: 'near', kind: 'count', base: 2, max: 6, grow: true,
      name: (n) => `Проскочи впритирку ${n} ${plural(n, 'раз', 'раза', 'раз')}`,
      left: (k) => `ещё ${k} ${plural(k, 'раз', 'раза', 'раз')} впритирку`,
      on: { pass: (o, info) => (info && info.near ? 1 : 0) },
    },
    { id: 'reach10', slot: 1, cat: 'clock', kind: 'clock', goal: 60, name: () => 'Доебланить до 10:00' },
    {
      id: 'snoozeClock', slot: 1, cat: 'stomp', kind: 'count', base: 1, max: 3, grow: true, needs: 'stomp',
      name: (n) => (n === 1 ? 'Отложи будильник: прыгни на него сверху' : `Отложи ${n} ${plural(n, 'будильник', 'будильника', 'будильников')}`),
      left: (k) => `ещё ${k} ${plural(k, 'будильник', 'будильника', 'будильников')}`,
      on: { stomp: (e) => (e && e.type === 'clock' ? 1 : 0) },
    },
    {
      id: 'earlyClock', slot: 1, cat: 'joke', kind: 'flag', weight: 0.25,
      name: () => 'Доебланься об будильник до 09:20',
      on: { die: (info) => !!info && info.type === 'clock' && num(info.t) * G.cfg.minPerSec < 20 },
    },
    {
      id: 'underCalls', slot: 2, cat: 'call', kind: 'count', base: 3, max: 9, grow: true,
      name: (n) => `Пробеги под ${n} ${plural(n, 'созвоном', 'созвонами', 'созвонами')}`,
      left: (k) => `ещё ${k} ${plural(k, 'созвон', 'созвона', 'созвонов')}`,
      on: { pass: (o) => (o && o.type === 'call' && o.level === 1 ? 1 : 0) },
    },
    { id: 'combo2', slot: 2, cat: 'combo', kind: 'flag', name: () => 'Набери комбо ×2', on: { combo: (c) => !!c && Number(c.mult) >= 2 } },
    {
      id: 'chain3', slot: 2, cat: 'stomp', kind: 'max', base: 3, needs: 'stomp',
      name: (n) => `Цепочка из ${n} отложенных в воздухе`,
      left: (k) => `ещё ${k} в цепочку`,
      on: { stomp: (e) => (e ? num(e.chain) : 0) },
    },
    {
      id: 'meme', slot: 2, cat: 'meme', kind: 'flag', name: () => 'Перепрыгни Тот Самый будильник 11:56',
      on: { pass: (o) => !!o && o.hands === 'meme', stomp: (e) => !!e && (!!e.meme || !!(e.o && e.o.hands === 'meme')) },
    },
    { id: 'fever', slot: 2, cat: 'fever', kind: 'flag', needs: 'fever', name: () => 'Войди в ЕБЛАН-РЕЖИМ', on: { fever: () => true } },
    { id: 'escape', slot: 2, cat: 'teamlead', kind: 'flag', needs: 'chase', name: () => 'Сбеги от тимлида', on: { chase: (c) => !!c && c.phase === 'escape' } },
    {
      id: 'coffee8', slot: 2, cat: 'carrot', kind: 'streak', base: 8, needs: 'coffee',
      name: (n) => `${n} морковок за один кофе`,
      left: (k) => `ещё ${k} ${plural(k, 'морковка', 'морковки', 'морковок')} под кофе`,
      on: {
        pickup: (p) => (isCarrot(p) && coffeeOn() ? 1 : 0),
        powerupEnd: (e) => (e && e.id === 'coffee' ? 'reset' : 0),
      },
    },
    { id: 'reach18', slot: 3, cat: 'clock', kind: 'clock', goal: 540, name: () => 'Доебланить до 18:00' },
    { id: 'allhands', slot: 3, cat: 'boss', kind: 'flag', needs: 'boss', name: () => 'Закрой all-hands в 16:00', on: { boss: (b) => !!b && b.phase === 'win' } },
    {
      id: 'noCarrot', slot: 3, cat: 'carrot', kind: 'anti', goal: 240, name: () => 'Ни одной морковки до 13:00',
      on: { pickup: (p) => (isCarrot(p) && gameMin() < 240 ? 'fail' : 0) },
    },
    {
      id: 'carrots100', slot: 3, cat: 'carrot', kind: 'cum', base: 100, max: 300, grow: true,
      name: (n) => `${n} морковок за спринт`,
      left: (k) => `ещё ${k} ${plural(k, 'морковка', 'морковки', 'морковок')}`,
      on: { pickup: (p) => (isCarrot(p) ? 1 : 0) },
    },
    {
      id: 'fevers3', slot: 3, cat: 'fever', kind: 'count', base: 3, needs: 'fever',
      name: (n) => `${n} ${plural(n, 'раз', 'раза', 'раз')} в ЕБЛАН-РЕЖИМ за забег`,
      left: (k) => `ещё ${k} ${plural(k, 'раз', 'раза', 'раз')} в режим`,
      on: { fever: () => 1 },
    },
    {
      id: 'snooze25', slot: 3, cat: 'stomp', kind: 'cum', base: 25, max: 75, grow: true, needs: 'stomp',
      name: (n) => `Отложи ${n} ${plural(n, 'дело', 'дела', 'дел')} за спринт`,
      left: (k) => `ещё ${k} ${plural(k, 'дело', 'дела', 'дел')}`,
      on: { stomp: () => 1 },
    },
  ];
  const TPL_BY_ID = Object.create(null);
  for (const T of TPL) TPL_BY_ID[T.id] = T;
  const INITIAL = ['reach10', 'underCalls', 'reach18'];
  const usesClock = (T) => T.kind === 'clock' || T.kind === 'anti';

  let sprintFresh = false;
  function loadSprint() {
    const raw = G.store.getJSON(SPRINT_KEY, null);
    const sp = { v: 1, slots: [null, null, null], stars: 0, grade: 0, issued: 0, skipRun: -99, recent: [] };
    if (!isMap(raw) || !Array.isArray(raw.slots)) {
      sprintFresh = true;
      return sp;
    }
    sp.stars = num(raw.stars);
    sp.grade = num(raw.grade);
    sp.issued = num(raw.issued);
    const skipRun = Number(raw.skipRun);
    sp.skipRun = Number.isFinite(skipRun) ? skipRun : -99;
    sp.recent = Array.isArray(raw.recent) ? raw.recent.filter((id) => typeof id === 'string').slice(-RECENT_MAX) : [];
    for (let i = 0; i < 3; i++) {
      const s = raw.slots[i];
      const T = isMap(s) && TPL_BY_ID[s.tpl];
      if (!T || T.slot !== i + 1) continue;
      sp.slots[i] = { tpl: T.id, n: Math.max(1, Math.round(num(s.n))), prog: num(s.prog), done: !!s.done, no: num(s.no), idle: num(s.idle), best: num(s.best) };
    }
    return sp;
  }
  const sprint = loadSprint();
  const saveSprint = () => G.store.setJSON(SPRINT_KEY, sprint);

  const tk = { live: false, prog: [0, 0, 0], failed: [false, false, false], streak: [0, 0, 0], closed: [], starsBefore: 0, prevBestClock: 0 };
  let report = null;

  function goalFor(T) {
    if (T.goal) return T.goal;
    if (T.kind === 'flag') return 1;
    if (!T.grow) return T.base;
    const g = Math.min(gradeOf(sprint.stars).idx, 5);
    return Math.min(T.max || Infinity, Math.max(1, Math.round(T.base * (1 + 0.35 * g))));
  }
  function issue(i, T) {
    sprint.issued += 1;
    sprint.slots[i] = { tpl: T.id, n: goalFor(T), prog: 0, done: false, no: 100 + sprint.issued, idle: 0, best: 0 };
  }
  function remember(id) {
    sprint.recent.push(id);
    if (sprint.recent.length > RECENT_MAX) sprint.recent.splice(0, sprint.recent.length - RECENT_MAX);
  }
  function pickTpl(i, avoid) {
    const cats = new Set();
    for (let k = 0; k < 3; k++) {
      const s = sprint.slots[k];
      if (k !== i && s && TPL_BY_ID[s.tpl]) cats.add(TPL_BY_ID[s.tpl].cat);
    }
    const base = TPL.filter((T) => T.slot === i + 1 && T.id !== avoid && hasNeed(T.needs));
    const fresh = base.filter((T) => !cats.has(T.cat) && !sprint.recent.includes(T.id));
    const other = base.filter((T) => !cats.has(T.cat));
    const list = fresh.length ? fresh : other.length ? other : base;
    if (!list.length) return null;
    let total = 0;
    for (const T of list) total += T.weight || 1;
    let r = Math.random() * total;
    for (const T of list) {
      r -= T.weight || 1;
      if (r <= 0) return T;
    }
    return list[list.length - 1];
  }
  const canSkip = () => num(profile.runs) - sprint.skipRun >= SKIP_EVERY;

  function ticketView(i) {
    const s = sprint.slots[i];
    const T = s && TPL_BY_ID[s.tpl];
    if (!T) return null;
    const prog = T.kind === 'cum' ? s.prog : tk.live ? tk.prog[i] : 0;
    const failed = tk.live && !!tk.failed[i];
    const left = Math.max(0, s.n - prog);
    const v = {
      slot: i, stars: i + 1, id: T.id, key: 'ЕБЛ-' + s.no, name: T.name(s.n), n: s.n, prog: Math.min(prog, s.n),
      done: s.done, failed, cumulative: T.kind === 'cum', kind: T.kind, progText: '', leftText: '', rel: 1, secs: null, idle: s.idle,
    };
    if (s.done) {
      v.rel = 0;
    } else if (usesClock(T)) {
      v.progText = failed ? 'сорвался' : clockTxt(Math.min(prog, s.n)) + ' / ' + clockTxt(s.n);
      v.leftText = failed || !prog ? '' : 'до ' + clockTxt(s.n) + ' ещё ' + G.fmtMin(Math.ceil(left));
      v.rel = failed ? 1 : left / s.n;
      v.secs = failed ? null : left / G.cfg.minPerSec;
    } else if (T.kind !== 'flag') {
      v.progText = Math.floor(Math.min(prog, s.n)) + '/' + s.n;
      v.leftText = left > 0 && T.left ? T.left(Math.ceil(left)) : '';
      v.rel = left / s.n;
    }
    return v;
  }
  const allTickets = () => [0, 1, 2].map(ticketView).filter(Boolean);

  function complete(i) {
    const s = sprint.slots[i];
    const T = s && TPL_BY_ID[s.tpl];
    if (!T || s.done) return;
    s.done = true;
    if (T.kind === 'cum') s.prog = Math.max(s.prog, s.n);
    else tk.prog[i] = Math.max(tk.prog[i], s.n);
    sprint.stars += i + 1;
    tk.closed.push(i);
    saveSprint();
    G.emit('mission', { id: T.id, key: 'ЕБЛ-' + s.no, slot: i, stars: i + 1, name: T.name(s.n) });
  }

  function track(evt, a, b) {
    if (!tk.live) return;
    for (let i = 0; i < 3; i++) {
      const s = sprint.slots[i];
      const T = s && !s.done && TPL_BY_ID[s.tpl];
      const fn = T && T.on && T.on[evt];
      if (!fn) continue;
      const r = fn(a, b);
      if (!r) continue;
      if (T.kind === 'flag') complete(i);
      else if (T.kind === 'anti') {
        if (r === 'fail') tk.failed[i] = true;
      } else if (T.kind === 'max') {
        const v = num(r);
        if (v > tk.prog[i]) {
          tk.prog[i] = v;
          if (v >= s.n) complete(i);
        }
      } else if (T.kind === 'streak') {
        if (r === 'reset') tk.streak[i] = 0;
        else {
          tk.streak[i] += num(r);
          tk.prog[i] = Math.max(tk.prog[i], tk.streak[i]);
          if (tk.prog[i] >= s.n) complete(i);
        }
      } else if (T.kind === 'cum') {
        s.prog += num(r);
        if (s.prog >= s.n) complete(i);
      } else {
        tk.prog[i] += num(r);
        if (tk.prog[i] >= s.n) complete(i);
      }
    }
  }

  function tickSprintClock() {
    if (!tk.live) return;
    const m = gameMin();
    for (let i = 0; i < 3; i++) {
      const s = sprint.slots[i];
      const T = s && !s.done && TPL_BY_ID[s.tpl];
      if (!T || !usesClock(T) || tk.failed[i]) continue;
      tk.prog[i] = m;
      if (m >= s.n) complete(i);
    }
  }

  function sprintStart() {
    tk.live = true;
    for (let i = 0; i < 3; i++) {
      tk.prog[i] = 0;
      tk.failed[i] = false;
      tk.streak[i] = 0;
    }
    tk.closed.length = 0;
    tk.starsBefore = sprint.stars;
    tk.prevBestClock = num(profile.bestClock);
    report = null;
    sprintUI.open = false;
  }

  function sprintDie(info) {
    if (!tk.live) return;
    track('die', info);
    const tickets = allTickets();
    for (const t of tickets) t.closedNow = tk.closed.includes(t.slot);
    for (const t of tickets) {
      const s = sprint.slots[t.slot];
      if (s.done) continue;
      const frac = 1 - t.rel;
      if (frac > s.best + 1e-6) {
        s.best = frac;
        s.idle = 0;
      } else s.idle += 1;
    }
    tk.live = false;
    const next = [null, null, null];
    for (const i of tk.closed) {
      const s = sprint.slots[i];
      if (!s || !s.done) continue;
      remember(s.tpl);
      const T = pickTpl(i, s.tpl);
      if (!T) continue;
      issue(i, T);
      next[i] = ticketView(i);
    }
    report = {
      tickets,
      next,
      closedKeys: tickets.filter((t) => t.closedNow).map((t) => t.key),
      starsBefore: tk.starsBefore,
      starsAfter: sprint.stars,
      gradeBefore: gradeOf(tk.starsBefore),
      gradeAfter: gradeOf(sprint.stars),
      prevBestClock: tk.prevBestClock,
      newGrade: null,
    };
    saveSprint();
  }

  function announceGrade() {
    const g = gradeOf(sprint.stars);
    if (g.idx <= sprint.grade) return;
    sprint.grade = g.idx;
    saveSprint();
    if (report) report.newGrade = g;
    let cheer = '';
    if (gradeCheer) {
      try {
        cheer = String(gradeCheer(g) || '');
      } catch (e) {
        G.report('meta: gradeCheer', e);
      }
    }
    G.emit('grade', { grade: g.idx, name: g.name, stars: g.stars, cheer });
  }

  function skipTicket(i) {
    const s = sprint.slots[i];
    if (!s || s.done || tk.live || !canSkip()) return false;
    const T = pickTpl(i, s.tpl);
    if (!T) return false;
    remember(s.tpl);
    issue(i, T);
    sprint.skipRun = num(profile.runs);
    saveSprint();
    if (report) {
      report.next[i] = ticketView(i);
      const old = report.tickets.find((t) => t.slot === i);
      if (old) old.skipped = true;
    }
    renderSprintStart();
    if (G.state.mode === 'over') renderOver();
    return true;
  }

  function sprintBoot() {
    if (sprintFresh) {
      INITIAL.forEach((id, i) => issue(i, TPL_BY_ID[id]));
      sprintFresh = false;
    }
    for (let i = 0; i < 3; i++) {
      const s = sprint.slots[i];
      const T = s && TPL_BY_ID[s.tpl];
      if (T && !s.done && hasNeed(T.needs)) continue;
      if (s && s.done) remember(s.tpl);
      const N = pickTpl(i, s ? s.tpl : '');
      if (N) issue(i, N);
    }
    saveSprint();
  }

  // ---------- спринт на стартовом экране ----------
  const sprintUI = { open: false, bound: false };

  function skipButton(t, small) {
    const b = h('button', 'st-skip' + (t.idle >= IDLE_HOT ? ' is-hot' : '') + (small ? ' is-small' : ''), 'перенести');
    b.type = 'button';
    b.title = 'Перенести в следующий спринт. Бесплатно раз в ' + SKIP_EVERY + ' забега';
    b.setAttribute('aria-label', 'Перенести ' + t.key + ' в следующий спринт');
    b.addEventListener('click', (e) => {
      if (e && e.detail > 0 && b.blur) b.blur();
      skipTicket(t.slot);
    });
    return b;
  }

  function sticker(t) {
    const el = h('div', 'sticker s' + t.stars);
    el.setAttribute('role', 'listitem');
    const head = h('div', 'st-head');
    head.append(h('span', 'st-key', t.key), h('span', 'st-stars', '★'.repeat(t.stars)));
    el.append(head, h('p', 'st-name', t.name));
    const foot = h('div', 'st-foot');
    if (t.cumulative) foot.append(h('span', 'st-prog', t.progText));
    if (!t.done && canSkip()) foot.append(skipButton(t, false));
    if (foot.children.length) el.append(foot);
    return el;
  }

  function renderSprintStart() {
    const btn = doc.getElementById('sprintBtn');
    const board = doc.getElementById('sprintBoard');
    if (!btn || !board) return;
    if (!sprintUI.bound) {
      sprintUI.bound = true;
      btn.addEventListener('click', (e) => {
        if (e && e.detail > 0 && btn.blur) btn.blur();
        sprintUI.open = !sprintUI.open;
        renderSprintStart();
      });
    }
    const tickets = allTickets();
    const g = gradeOf(sprint.stars);
    const open = tickets.filter((t) => !t.done).length;
    const chev = h('span', 'sp-chev');
    chev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9.5 6 6 6-6"/></svg>';
    replaceKids(btn, [
      h('span', 'sp-k', 'Спринт'),
      h('span', 'sp-n', open + ' ' + plural(open, 'тикет', 'тикета', 'тикетов')),
      h('b', 'sp-g', g.name + ' ★' + g.stars),
      chev,
    ]);
    btn.hidden = !tickets.length;
    btn.setAttribute('aria-expanded', sprintUI.open ? 'true' : 'false');
    btn.classList.toggle('is-open', sprintUI.open);
    board.hidden = !sprintUI.open || !tickets.length;
    if (!board.hidden) replaceKids(board, tickets.map(sticker));
  }

  // ---------- блок на экране проигрыша ----------
  function overChip(entry, i) {
    const chip = h('span', 'mo-chip');
    chip.style.animationDelay = (0.2 + i * 0.12).toFixed(2) + 's';
    chip.title = entry.kind === 'skin' ? 'Новый скин: ' + (entry.item.desc || entry.item.name) : 'Ачивка: ' + entry.item.desc;
    const ico = h('span', entry.kind === 'skin' ? 'mo-ico is-skin' : 'mo-ico');
    if (entry.kind === 'skin') {
      const cv = makeThumbCanvas(CHIP_THUMB_CSS);
      paintThumb(cv, entry.item.id, false);
      ico.append(cv);
    } else {
      fillBadge(ico, entry.item, true);
    }
    chip.append(ico, h('span', 'mo-name', entry.item.name));
    return chip;
  }

  function nearestGoal() {
    let bestK = -1, out = null;
    const consider = (name, unit, v, goal, text) => {
      if (!(goal > 0)) return;
      const k = v / goal;
      if (k < 1 && k > bestK) {
        bestK = k;
        out = { name, text: text || progressText(unit, v, goal) };
      }
    };
    for (const s of skinList()) {
      const rule = skinRule(s.id);
      if (rule && rule.get && !isSkinOpen(s.id)) consider('Скин «' + s.name + '»', rule.unit, rule.get(null), rule.goal);
    }
    for (const a of achOn) {
      if (achDone(a)) continue;
      if (a.get) consider(a.name, a.unit, a.get(null), a.goal);
      else if (isExtAch(a) && !a.secret) {
        const p = achProgress(a);
        if (p) consider(a.name, '', p.v, p.goal, p.text);
      }
    }
    return out;
  }

  function ticketRow(t) {
    const row = h('div', 'mo-tk' + (t.closedNow ? ' is-done' : '') + (t.failed ? ' is-failed' : '') + (t.skipped ? ' is-skipped' : ''));
    row.setAttribute('role', 'listitem');
    const name = h('span', 'mo-tk-name');
    name.append(h('b', 'mo-tk-key', t.key), doc.createTextNode(' ' + t.name));
    const right = h('span', 'mo-tk-prog');
    if (t.closedNow) {
      right.append(h('span', 'mo-stamp', 'закрыт'), h('span', 'mo-stars', '★'.repeat(t.stars)));
    } else if (t.skipped) {
      right.textContent = 'перенесён';
    } else {
      right.textContent = t.failed ? 'сорвался' : [t.progText, t.leftText].filter(Boolean).join(' — ') || '—';
    }
    row.append(name, right);
    return row;
  }

  function nextRow(t) {
    const row = h('div', 'mo-tk is-next');
    row.setAttribute('role', 'listitem');
    const name = h('span', 'mo-tk-name');
    name.append(h('b', 'mo-tk-key', 'новый ' + t.key), doc.createTextNode(' ' + t.name));
    row.append(name, h('span', 'mo-stars', '★'.repeat(t.stars)));
    return row;
  }

  function overSprint(R) {
    const list = h('div', 'mo-sprint');
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', 'Тикеты спринта');
    const skippable = canSkip();
    for (const t of R.tickets) {
      const row = ticketRow(t);
      if (!t.closedNow && !t.skipped && skippable && !R.next[t.slot]) row.append(skipButton(t, true));
      list.append(row);
      const nx = R.next[t.slot];
      if (nx) list.append(nextRow(nx));
    }
    return list;
  }

  function overGrade(R) {
    const g = R.gradeAfter;
    const box = h('div', 'mo-grade' + (R.newGrade ? ' is-up' : ''));
    const span = Math.max(1, g.next - g.from);
    const was = R.gradeBefore.idx === g.idx ? G.clamp((R.starsBefore - g.from) / span, 0, 1) : 0;
    const now = G.clamp((R.starsAfter - g.from) / span, 0, 1);
    const bar = h('span', 'mo-gbar');
    const base = h('i', 'mo-gbar-was');
    base.style.width = (was * 100).toFixed(1) + '%';
    const gain = h('i', 'mo-gbar-gain');
    gain.style.left = (was * 100).toFixed(1) + '%';
    gain.style.width = (Math.max(0, now - was) * 100).toFixed(1) + '%';
    bar.append(base, gain);
    const gained = R.starsAfter - R.starsBefore;
    const nameEl = h('span', 'mo-gname');
    if (R.newGrade) nameEl.append(h('span', 'mo-gup', 'новый грейд'));
    nameEl.append(doc.createTextNode(g.name));
    const nums = h('span', 'mo-gnum', '★' + R.starsAfter);
    if (gained > 0) nums.append(h('b', 'mo-gplus', '+' + gained));
    box.append(nameEl, bar, nums);
    box.title = 'До грейда «' + g.nextName + '» ещё ' + Math.max(0, g.next - R.starsAfter) + '★';
    return box;
  }

  function renderOver() {
    const box = doc.getElementById('metaOver');
    if (!box) return;
    if (!box.hasAttribute || !box.hasAttribute('data-noinput')) box.setAttribute('data-noinput', '');
    const nodes = [];
    if (freshNote) {
      const stamp = h('div', 'mo-note-stamp', 'Новая объяснительная ' + freshNote.n + '/' + freshNote.total);
      stamp.title = 'Папка объяснительных — в «Личном деле» под игрой';
      nodes.push(stamp);
    }
    if (report && report.tickets.length) nodes.push(overSprint(report), overGrade(report));
    const row = h('div', 'mo-row');
    if (fresh.length) {
      const ordered = fresh.filter((f) => f.kind === 'skin').concat(fresh.filter((f) => f.kind === 'ach'));
      row.append(h('span', 'mo-label', 'открыто'));
      const shown = Math.min(OVER_CHIPS, ordered.length);
      for (let i = 0; i < shown; i++) row.append(overChip(ordered[i], i));
      if (ordered.length > shown) {
        const more = h('span', 'mo-more', '+' + (ordered.length - shown));
        more.title = ordered.slice(shown).map((f) => f.item.name).join(', ');
        row.append(more);
      }
    } else {
      const next = nearestGoal();
      if (next) {
        row.append(h('span', 'mo-label', 'дальше'));
        const line = h('span', 'mo-next');
        line.append(h('b', null, next.name), h('span', 'mo-prog', next.text));
        row.append(line);
      }
    }
    if (row.children.length) nodes.push(row);
    box.classList.toggle('has-fresh', fresh.length > 0);
    replaceKids(box, nodes);
  }

  // ---------- итоги забега ----------
  function addInto(dst, src) {
    if (!isMap(src)) return;
    for (const k in src) dst[k] = num(dst[k]) + num(src[k]);
  }

  function commit(info) {
    const L = profile, st = info.stats || {};
    L.runs += 1;
    L.totalMin += num(info.score);
    L.playSec += num(info.t);
    L.best = Math.max(L.best, num(info.score), num(info.best));
    L.bestClock = Math.max(L.bestClock, run.clock);
    L.bestNoDouble = Math.max(L.bestNoDouble, run.noDouble);
    L.bestCarrots = Math.max(L.bestCarrots, run.carrots);
    L.bestNear = Math.max(L.bestNear, run.near);
    L.bestBonus = Math.max(L.bestBonus, run.bonus);
    L.bestFevers = Math.max(L.bestFevers, run.fevers);
    L.carrots += run.carrots;
    L.smashed += run.smashed;
    L.nearMisses += run.near;
    L.bonusMin += run.bonus;
    L.stomps += run.stomps;
    L.escapes += run.escapes;
    L.bossWins += run.bossWin;
    L.jumps += num(st.jumps);
    L.doubleJumps += num(st.doubleJumps);
    L.passed += num(st.passed);
    addInto(L.passedByType, st.passedByType);
    addInto(L.pickups, st.pickups);
    if (info.type) L.deaths[info.type] = num(L.deaths[info.type]) + 1;
  }

  // ---------- события ----------
  G.on('start', () => {
    run.live = true;
    run.no = profile.runs + 1;
    run.noDouble = 0;
    run.stomps = 0;
    run.escapes = 0;
    run.fevers = 0;
    run.bossWin = 0;
    run.caughtT = -99;
    freshNote = null;
    collFresh = 0;
    sampleRun();
    sprintStart();
    fresh.length = 0;
    freshIds.clear();
    toastQ.length = 0;
    toastFreeAt = 0;
    pendingPowerup = null;
    renderPanel();
  });

  G.onUpdate(() => {
    if (!run.live || G.state.mode !== 'run') return;
    sampleRun();
    tickSprintClock();
    checkGoals(run, false);
  }, 95);

  G.on('die', (info) => {
    if (!run.live) return;
    sampleRun();
    sprintDie(info);
    run.live = false;
    if (num(info.t) < FALSTART_SEC) unlockAch(ACH_BY_ID.falstart, false);
    if (info.clockMin === MEME_CLOCK) unlockAch(ACH_BY_ID.meme, false);
    if (info.type === 'call') unlockAch(ACH_BY_ID.email, false);
    commit(info);
    checkGoals(null, false);
    checkCollector(false);
    checkFashion(false);
    save();
    renderPanel();
  });

  G.on('gameover', (info) => {
    recordNotes(info);
    announceGrade();
    if (dirty) renderPanel();
    renderOver();
    renderSprintStart();
  });

  G.on('powerup', (pu) => {
    const id = typeof pu === 'string' ? pu : pu && pu.id;
    if (id == null) return;
    const key = String(id);
    pendingPowerup = key;
    pendingAt = G.state.realT;
    profile.powerups[key] = num(profile.powerups[key]) + 1;
    holdToasts();
    checkCollector(false);
    save();
  });

  G.on('pickup', (p) => {
    track('pickup', p);
    const type = p && p.type;
    if (!type || type === 'carrot') return;
    if (pendingPowerup && pendingAt === G.state.realT) {
      profile.puMap[type] = pendingPowerup;
      delete profile.plain[type];
    } else if (!profile.puMap[type]) {
      profile.plain[type] = true;
    }
    pendingPowerup = null;
    checkCollector(false);
  });

  G.on('pass', (o, info) => track('pass', o, info));
  G.on('combo', (c) => track('combo', c));
  G.on('powerupEnd', (e) => track('powerupEnd', e));

  G.on('stomp', (e) => {
    if (!run.live) return;
    run.stomps++;
    if (e && (e.meme || (e.o && e.o.hands === 'meme'))) unlockAch(ACH_BY_ID.snoozeMeme, false);
    track('stomp', e);
  });
  G.on('fever', (e) => {
    if (!run.live) return;
    run.fevers++;
    track('fever', e);
  });
  G.on('chase', (c) => {
    if (!run.live) return;
    if (c && c.phase === 'escape') run.escapes++;
    if (c && c.phase === 'caught') run.caughtT = num(G.state.t);
    track('chase', c);
  });
  G.on('boss', (b) => {
    if (!run.live) return;
    if (b && b.phase === 'win') {
      run.bossWin = 1;
      unlockAch(ACH_BY_ID.thanks, false);
    }
    track('boss', b);
  });

  G.on('milestone', holdToasts);

  G.on('theme', () => {
    view.themeStamp++;
    if (view.built) renderSkins();
  });

  const achSummary = () => achOn.map((a) => ({ id: a.id, name: a.name, desc: a.desc, secret: !!a.secret }));

  let booted = false;
  G.on('boot', () => {
    booted = true;
    achOn = baseAch();
    G.meta.achievements = achSummary();
    sprintBoot();
    checkGoals(null, true);
    checkCollector(true);
    checkFashion(true);
    restoreSkin();
    save();
    build();
    renderSprintStart();
  });

  restoreSkin();

  // ---------- точки расширения для других модулей ----------
  const str = (v) => (typeof v === 'string' ? v : '');
  // def: {id, name, desc, icon?, glyph?, secret?, hint?, done(): bool, progress?(): {v, goal, text?}}
  function addAchievement(def) {
    if (!isMap(def) || typeof def.id !== 'string' || !def.id || ACH_BY_ID[def.id] || typeof def.done !== 'function') return false;
    if (typeof def.name !== 'string' || !def.name) return false;
    const a = {
      id: def.id, name: def.name, desc: str(def.desc), icon: str(def.icon) || 'star', glyph: str(def.glyph),
      secret: !!def.secret, hint: str(def.hint), done: def.done, progress: typeof def.progress === 'function' ? def.progress : null,
    };
    EXT_ACH.push(a);
    ACH_BY_ID[a.id] = a;
    if (booted) {
      achOn.push(a);
      G.meta.achievements = achSummary();
      if (view.achGrid) {
        view.achGrid.append(buildAchCard(a));
        renderAch();
      }
    }
    return true;
  }
  // rule: {cond, isOpen(): bool, progress?(): {v, goal, text?}}; встроенные правила не переопределяются.
  function addSkinRule(id, rule) {
    if (typeof id !== 'string' || SKIN_RULES[id] || !isMap(rule) || typeof rule.isOpen !== 'function') return false;
    SKIN_RULES[id] = { cond: str(rule.cond), isOpen: rule.isOpen, progress: typeof rule.progress === 'function' ? rule.progress : null };
    return true;
  }
  // col: {id, order?, view()}; регистрировать до boot, вкладка строится один раз.
  function addCollection(col) {
    if (booted || !isMap(col) || typeof col.view !== 'function' || COLLECTIONS.some((c) => c.id === col.id)) return false;
    COLLECTIONS.push({ id: String(col.id), order: Number(col.order) || 0, view: col.view });
    COLLECTIONS.sort((a, b) => a.order - b.order);
    return true;
  }

  G.meta = {
    life: profile,
    profile,
    achievements: achSummary(),
    isUnlocked: isAchDone,
    isSkinUnlocked: isSkinOpen,
    skinCondition: (id) => (skinRule(id) ? skinRule(id).cond : ''),
    selectSkin,
    render: renderPanel,
    addAchievement,
    addSkinRule,
    addCollection,
    notifyUnlock,
    touchCollection,
  };

  G.sprint = {
    tickets: allTickets,
    stars: () => sprint.stars,
    grade: () => gradeOf(sprint.stars),
    gradeOf,
    lastRun: () => report,
    canSkip,
    skip: skipTicket,
    setGradeName: (idx, name) => {
      if (!(idx >= 0 && idx < GRADES.length) || typeof name !== 'string' || !name) return false;
      gradeNames[idx] = name;
      return true;
    },
    setGradeCheer: (fn) => {
      gradeCheer = typeof fn === 'function' ? fn : null;
    },
  };
})();
