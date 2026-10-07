/* KTS-экраны (П5): дайджест вместо итогов, язык KTS в интерфейсе, «Секретное слово», счётчики, вай-фай в HUD, ДР KTS, «Уволиться». */
(() => {
  'use strict';
  const G = window.G;
  const K = G.kts;
  if (!K || !K.enabled || !G.ui || typeof G.ui.textHook !== 'function') return;
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const toast = G.ui.toast;
  const rich = G.ui.rich;
  const slot = G.ui.slot;

  // ---------- данные ----------
  const def = (id) => K.get('lines', id);
  const line = (id, key, ctx) => K.line(`lines.${id}.${key}`, ctx);
  const field = (id, key) => {
    const d = def(id);
    return d ? d[key] : undefined;
  };
  function textOf(v, ctx, bag) {
    if (typeof v === 'string') return K.fmt(v, ctx);
    if (Array.isArray(v)) return K.line(v, ctx, bag);
    return null;
  }
  function plural(n, forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b === 1) return forms[0];
    if (b >= 2 && b <= 4) return forms[1];
    return forms[2];
  }
  const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const plainText = (s) => String(s || '').replace(/~~(.+?)~~/g, '').replace(/\s{2,}/g, ' ').trim();

  function el(tag, cls, text) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(cls, text) {
    const b = el('button', cls, text);
    b.type = 'button';
    return b;
  }
  const svg = (body, attrs) => `<svg viewBox="0 0 24 24" aria-hidden="true" ${attrs || 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;
  const ICON = {
    key: svg('<circle cx="8" cy="15.5" r="4.3"/><path d="m11.1 12.4 8.4-8.4M16.4 7.1l2.6 2.6M13.9 9.6l2 2"/>'),
    wifi: svg('<path d="M2.6 9.2a13.6 13.6 0 0 1 18.8 0M5.9 12.7a8.9 8.9 0 0 1 12.2 0M9.2 16.1a4.3 4.3 0 0 1 5.6 0"/><circle cx="12" cy="19.4" r="1.6" fill="currentColor" stroke="none"/><path class="kts-wifi-x" d="m4 3.6 16 16.8"/>'),
    boom: svg('<path d="M12 1.5 14 7.6l6-3.1-3 6 6.5 1.5-6.5 1.9 3 5.9-6-3.1-2 6.3-2-6.3-6 3.1 3-5.9L.5 12l6.5-1.5-3-6 6 3.1z" fill="var(--accent)"/><path d="m12 7.2 1.1 3.2 3.2-1-1.6 2.6 2.9 1-3.3.6.6 3.3-2.9-1.9-2.9 1.9.6-3.3-3.3-.6 2.9-1-1.6-2.6 3.2 1z" fill="var(--gold)"/>', 'fill="none"'),
    fire: svg('<path d="M12 1.8c1.2 4 6.2 6.3 6.2 12.2a6.2 6.2 0 0 1-12.4 0c0-2.8 1.3-4.8 3.1-6.2-.1 2.1.7 3.5 2.1 4.1-.3-3.9 0-7.2 1-10.1z" fill="#ff6a1a"/><path d="M12 12.6c.8 2 3 3 3 5.3a3 3 0 0 1-6 0c0-1.8 1.2-3.1 3-5.3z" fill="#ffc53d"/>', 'fill="none"'),
    party: svg('<path d="M2.8 21.2 7.6 8.6l7.8 7.8z" fill="#f0b429"/><path d="M5.2 15 9 18.8M6.5 11.6l5.9 5.9" stroke="#c9780c" stroke-width="1.3"/><path d="M13.2 8.6c1.8-1.9 1.6-4 .1-5.6M15.6 10.9c1.9-1.4 4-1.2 5.4.3" fill="none" stroke="#7c5cff" stroke-width="1.6" stroke-linecap="round"/><circle cx="17.6" cy="4.4" r="1.4" fill="#e5484d"/><circle cx="20.4" cy="14.6" r="1.2" fill="#3fa7ff"/><circle cx="10.2" cy="3.6" r="1.1" fill="#2fb36d"/>', 'fill="none"'),
    heart: svg('<path d="M12 20.4s-7.6-4.5-7.6-10.1A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.6 2.6c0 5.6-7.6 10.1-7.6 10.1z" fill="#e5484d"/>', 'fill="none"'),
  };

  // ---------- профиль экранов ----------
  const saved = K.store.get('screens', null) || {};
  const prof = {
    runs: Number(saved.runs) || 0,
    first: Number(saved.first) || Date.now(),
    digestY: Number(saved.digestY) || 0,
    digestN: Number(saved.digestN) || 0,
    gifts: saved.gifts && Array.isArray(saved.gifts.open) ? saved.gifts : null,
  };
  const save = () => K.store.set('screens', prof);

  // ---------- тексты интерфейса ----------
  function uiLine(key, ctx) {
    const pool = field('ui', key);
    if (!Array.isArray(pool)) return undefined;
    const s = K.line(pool, ctx, 'ui:' + key);
    return s == null ? undefined : s;
  }
  function verdictText(score) {
    const v = def('verdict');
    if (!v || !Array.isArray(v.ranks)) return undefined;
    const m = Number(score) || 0;
    if (m <= (v.rareBelow || 0) && Math.random() < (v.rareChance || 0)) {
      const r = textOf(v.rare, null, 'verdict:rare');
      if (r) return r;
    }
    for (const [limit, pool] of v.ranks) if (m < limit) return textOf(pool, null, 'verdict:' + limit) || undefined;
    return undefined;
  }
  G.ui.textHook((key, ctx) => {
    if (key === 'verdict') return verdictText(ctx && ctx.score);
    if (key === 'share') return shareText(ctx && ctx.info);
    if (key === 'toast.grade.label') {
      const g = ctx && ctx.grade;
      if (g && /^Лид/.test(String(g.name || ''))) {
        const lead = uiLine('toast.grade.lead');
        if (lead !== undefined) return lead;
      }
    }
    return uiLine(key, ctx);
  });

  // ---------- забег: что попадёт в дайджест ----------
  const fresh = () => ({
    cake: 0, cakeMissed: false, frog: 0, plovClue: 0, kazan: 0, vivi: 0,
    toxicBlocked: false, toxicKind: false, predict: null, wifi: false,
    stomps: 0, escaped: false, bossWin: false, joined: null, birthday: false,
  });
  let run = fresh();
  let digest = null;
  const live = () => G.state.mode === 'run' || G.state.mode === 'over';
  function join(kind, name) {
    if (!live()) return;
    if (kind === 'skin' || !run.joined || run.joined.kind !== 'skin') run.joined = { kind, name: name || '' };
  }

  G.on('pickup', (p) => {
    const t = p && p.type;
    if (t === 'cake') run.cake++;
    else if (t === 'frog') run.frog++;
    else if (t === 'plovClue') run.plovClue++;
    else if (t === 'kazan') run.kazan++;
  });
  G.on('kts:event', (e) => {
    if (!e) return;
    const on = e.phase !== 'end';
    if (e.id === 'cakeMissed') run.cakeMissed = true;
    else if (e.id === 'vivi' && on) run.vivi++;
    else if (e.id === 'wifi') {
      setWifi(on && G.state.mode === 'run');
      if (on) run.wifi = true;
    }
  });
  G.on('kts:npc', (e) => {
    if (!e || e.id !== 'toxic') return;
    if (e.phase === 'predict' && e.text) run.predict = String(e.text);
    else if (e.phase === 'blocked') run.toxicBlocked = true;
    else if (e.phase === 'kind') run.toxicKind = true;
  });
  G.on('stomp', () => { run.stomps++; });
  G.on('chase', (c) => { if (c && c.phase === 'escape') run.escaped = true; });
  G.on('boss', (b) => { if (b && b.phase === 'win') run.bossWin = true; });
  G.on('skinUnlock', (s) => join('skin', s && s.name));
  G.on('achievement', (a) => join('ach', a && a.name));

  // ---------- находки: тосты и счётчики ----------
  const UNLOCK_KIND = { secret: 'secret', duck: 'duck', ach: 'achievement', skin: 'skin' };
  let drullegi = false;
  G.on('kts:unlock', (e) => {
    if (!e || !UNLOCK_KIND[e.kind]) return;
    const d = e.def || {};
    const ctx = { n: e.n, total: e.total };
    const name = textOf(d.name, null) || '';
    let label;
    if (e.kind === 'secret') label = e.total > 0 ? line('unlock', 'secret', ctx) : line('unlock', 'secretFirst');
    else if (e.kind === 'duck') label = d.legendary ? line('unlock', 'duckLegend') : e.total > 0 ? line('unlock', 'duck', ctx) : null;
    else label = line('unlock', e.kind);
    let text = (e.info && typeof e.info.text === 'string' && e.info.text) || textOf(d.toast, null, 'unlock:' + e.id) || name;
    if (e.kind === 'duck' && d.place && text === name) text = name ? `${name} · ${d.place}` : String(d.place);
    toast(label || '', text || '', { kind: UNLOCK_KIND[e.kind] });
    join(e.kind, name);
    if (e.kind === 'secret' && e.id === 'drullegi') {
      drullegi = true;
      renderGreeting();
    }
    renderCounters();
  });

  function foundOf(kind, section) {
    let n = 0;
    for (const id of K.found(kind)) if (K.get(section, id)) n++;
    return n;
  }
  function counterText(kind, section, key) {
    const total = K.total(kind);
    if (!(total > 0)) return null;
    return line('counters', key, { n: Math.min(foundOf(kind, section), total), total });
  }

  // ---------- поле «Секретное слово» ----------
  let wordWait = null;
  function settleWord() {
    if (wordWait) wordWait.answered = true;
  }
  G.on('toast', settleWord);
  G.on('kts:unlock', settleWord);
  function makeWordForm(where) {
    const form = el('form', 'kts-word kts-word-' + where);
    form.setAttribute('data-noinput', '');
    form.setAttribute('autocomplete', 'off');
    form.noValidate = true;
    const input = el('input', 'kts-word-input');
    input.type = 'text';
    input.maxLength = 40;
    input.placeholder = line('word', 'placeholder') || '';
    input.setAttribute('aria-label', input.placeholder);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('enterkeyhint', 'send');
    const ok = el('button', 'kts-word-ok', line('word', 'submit') || 'Ок');
    ok.type = 'submit';
    const msg = el('span', 'kts-word-msg');
    msg.setAttribute('aria-live', 'polite');
    form.append(input, ok, msg);
    form.addEventListener('submit', (e) => {
      if (e && e.preventDefault) e.preventDefault();
      const text = String(input.value || '').trim();
      if (!text || typeof G.typeWord !== 'function') return;
      input.value = '';
      msg.textContent = '';
      const wait = (wordWait = { answered: false });
      G.typeWord(text, 'field');
      setTimeout(() => {
        if (wordWait === wait) wordWait = null;
        if (!wait.answered) msg.textContent = line('word', 'miss') || '';
      }, 700);
    });
    input.addEventListener('input', () => { msg.textContent = ''; });
    return { form, input, msg };
  }

  // ---------- старт: приветствие, счётчик секреток, поле, пророчество ----------
  const startBox = el('div', 'kts-startbox');
  startBox.setAttribute('data-noinput', '');
  const startRow = el('div', 'kts-start');
  const hello = el('span', 'kts-hello');
  const helloBtn = button('kts-hello kts-hello-btn');
  helloBtn.hidden = true;
  const startCount = el('span', 'kts-count');
  const keyBtn = button('kts-key');
  keyBtn.innerHTML = ICON.key;
  keyBtn.setAttribute('aria-expanded', 'false');
  keyBtn.setAttribute('aria-label', line('word', 'button') || '');
  keyBtn.title = keyBtn.getAttribute('aria-label') || '';
  const startWord = makeWordForm('start');
  startWord.form.hidden = true;
  const startTip = el('p', 'kts-tip');
  startRow.append(hello, helloBtn, startCount, keyBtn);
  startBox.append(startRow, startWord.form, startTip);
  const tapTip = el('span', 'kts-tap-tip');

  keyBtn.addEventListener('click', () => {
    const open = startWord.form.hidden;
    startWord.form.hidden = !open;
    keyBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    keyBtn.classList.toggle('on', open);
    if (open && startWord.input.focus) startWord.input.focus();
  });
  helloBtn.addEventListener('click', () => {
    toast(line('greet', 'oldsReply') || '', '', { kind: 'kts' });
    if (K.raw('secrets', 'olds')) K.secret('olds');
  });

  function greetKey() {
    const g = def('greet');
    if (!g) return null;
    if (drullegi) return 'drullegi';
    const days = (Date.now() - prof.first) / 86400000;
    if ((g.oldsRuns && prof.runs >= g.oldsRuns) || (g.oldsDays && days >= g.oldsDays)) return 'olds';
    let key = null;
    for (const [min, k] of g.tiers || []) if (prof.runs >= min) key = k;
    return key;
  }
  function renderGreeting() {
    const key = greetKey();
    const text = key ? line('greet', key) : null;
    const olds = key === 'olds';
    hello.hidden = olds || !text;
    helloBtn.hidden = !olds || !text;
    (olds ? helloBtn : hello).textContent = text || '';
  }
  function tipText(where) {
    const t = def('tips');
    if (!t) return null;
    let pool;
    if (where === 'pause') pool = Array.isArray(t.pause) ? t.pause.slice() : [];
    else {
      pool = Array.isArray(t.start) ? t.start.slice() : [];
      if (K.get('items', 'cake') && Array.isArray(t.cake)) pool.push(...t.cake);
      if (K.today.wednesday && K.get('items', 'frog') && Array.isArray(t.wednesday)) pool.push(...t.wednesday);
      if (K.get('secrets', 'plov') && !K.has('secret', 'plov') && Array.isArray(t.plov)) pool.push(...t.plov);
    }
    return pool.length ? K.line(pool, null, 'tips:' + where) : null;
  }
  function renderTip(nodes, where) {
    const text = tipText(where);
    const label = text ? line('tips', 'label') : null;
    for (const node of nodes) {
      node.hidden = !text;
      node.textContent = '';
      if (!text) continue;
      if (label) node.append(el('b', null, label + ': '));
      node.append(doc.createTextNode(text));
    }
  }

  // ---------- пауза ----------
  const pauseBox = el('div', 'kts-pause');
  pauseBox.setAttribute('data-noinput', '');
  const pauseScore = el('p', 'kts-pscore');
  const pauseTip = el('p', 'kts-tip');
  const pauseWord = makeWordForm('pause');
  const pauseCount = el('p', 'kts-count kts-pcount');
  pauseBox.append(pauseScore, pauseTip, pauseWord.form, pauseCount);

  function renderCounters() {
    const s = counterText('secret', 'secrets', 'secrets');
    const d = counterText('duck', 'ducks', 'ducks');
    startCount.hidden = !s;
    startCount.textContent = s || '';
    const parts = [s, d].filter(Boolean);
    pauseCount.hidden = !parts.length;
    pauseCount.textContent = parts.join(' · ');
  }

  // ---------- HUD: вай-фай ----------
  const wifi = el('span', 'kts-wifi');
  wifi.innerHTML = ICON.wifi;
  wifi.setAttribute('role', 'img');
  function setWifi(dead) {
    wifi.classList.toggle('dead', !!dead);
    const label = line('wifi', dead ? 'dead' : 'on') || '';
    wifi.setAttribute('aria-label', label);
    wifi.title = label;
  }

  // ---------- дайджест ----------
  const resultCard = $('resultCard');
  const resultHead = $('resultHead');
  const overView = $('overView');
  const againBtn = $('againBtn');
  const kdHead = el('div', 'kd-head');
  const kdBody = el('div', 'kd-body');
  const kdExtra = el('div', 'kd-extra');
  const kdFoot = el('div', 'kd-foot');
  const footRow = el('div', 'kd-foot-row');
  kdHead.hidden = kdBody.hidden = kdFoot.hidden = true;

  function mount() {
    if (resultHead && typeof resultHead.prepend === 'function') resultHead.prepend(kdHead);
    else if (resultCard) resultCard.append(kdHead);
    if (resultCard && typeof resultCard.insertBefore === 'function') {
      const diag = $('diag');
      if (diag && diag.parentNode === resultCard) resultCard.insertBefore(kdBody, diag);
      else resultCard.append(kdBody);
      const share = $('shareText');
      if (share && share.parentNode === resultCard) resultCard.insertBefore(kdFoot, share);
      else resultCard.append(kdFoot);
    }
    slot('over', kdExtra);
  }

  function deathNews(info, d) {
    const news = d.news || {};
    const locId = G.scene && G.scene.loc ? G.scene.loc.id : '';
    const ctx = {
      where: (d.where && (d.where[locId] || d.where.default)) || '',
      whom: (d.whom && (d.whom[info.type] || d.whom.default)) || '',
      clock: G.fmtClock(info.clockMin),
    };
    let pool = news.generic;
    if (info.clockMin === 11 * 60 + 56) pool = news.meme;
    else if (info.causeTag === 'teamlead') pool = news.teamlead;
    else if (news.byType && news.byType[info.type]) pool = news.byType[info.type];
    const text = textOf(pool, ctx, 'digest:death:' + (info.type || '')) || textOf(news.generic, ctx, 'digest:death');
    return text ? { text, sub: info.cause || '' } : null;
  }
  function cakeMissedLine() {
    return K.line('items.cake.missed') || textOf((field('digest', 'news') || {}).cakeMissed, null, 'digest:cakeMissed');
  }
  function compose(info) {
    const d = def('digest');
    if (!d) return null;
    const news = d.news || {};
    const clock = G.fmtClock(info.clockMin);
    const prides = [];
    const addPride = (text, sub) => {
      if (text && prides.length < 3) prides.push({ text, sub: sub || '' });
    };
    if (info.isRecord && info.prevBest > 0) {
      addPride(line('digest', 'record', { clock }), line('digest', 'recordWas', { was: G.fmtMin(info.prevBest), now: G.fmtMin(info.score) }));
    } else addPride(line('digest', 'clock', { clock }));
    if (info.clockMin < 9 * 60 + 20) addPride(line('digest', 'early'));
    if (run.kazan) addPride(line('digest', 'kazan'));
    if (run.bossWin) addPride(line('digest', 'bossWin'));
    if (run.escaped) addPride(line('digest', 'escaped'));
    if (run.stomps >= 3) addPride(line('digest', 'stomps'));
    if (run.cake) addPride(line('digest', 'cake'));
    if (run.frog) addPride(line('digest', 'frog'));

    const items = [];
    const addNews = (text, sub) => {
      if (text && items.length < 3) items.push({ text, sub: sub || '' });
    };
    const death = deathNews(info, d);
    if (death) addNews(death.text, death.sub);
    if (run.cakeMissed) addNews(cakeMissedLine());
    if (run.toxicBlocked) addNews(textOf(news.toxicBlocked, null, 'digest:toxicBlocked'));
    if (run.vivi) {
      const score = K.counter('vivi');
      addNews(score > 0 ? textOf(news.viviScore, { score }, 'digest:viviScore') : textOf(news.vivi, null, 'digest:vivi'));
    }
    if (run.toxicKind) addNews(textOf(news.toxicKind, null, 'digest:toxicKind'));
    if (run.wifi) addNews(textOf(news.wifi, null, 'digest:wifi'));
    if (run.plovClue && !run.kazan) addNews(textOf(news.plovClue, null, 'digest:plovClue'));
    if (run.frog && prides.length >= 3) addNews(textOf(news.frog, null, 'digest:frog'));

    return { n: prof.digestN, info, clock, prides, news: items };
  }
  function shareText(info) {
    if (!digest || !info || digest.info !== info) return undefined;
    const p = digest.prides[0];
    const s = line('digest', 'share', { n: digest.n, pride: p ? lowerFirst(plainText(p.text)) : '', score: G.fmtMin(info.score) });
    return s || undefined;
  }

  function listItem(cls, label, text, sub, icon) {
    const li = el('li', cls);
    if (icon) {
      const i = el('span', 'kd-ico');
      i.innerHTML = icon;
      li.append(i);
    }
    const body = el('span', 'kd-txt');
    if (label) body.append(el('b', 'kd-k', label + ': '));
    const t = el('span');
    rich(t, text);
    body.append(t);
    if (sub) body.append(el('small', 'kd-sub', sub));
    li.append(body);
    return li;
  }
  function renderDigest(dg) {
    if (!dg) {
      kdHead.hidden = kdBody.hidden = true;
      if (resultCard) resultCard.classList.remove('kts-digest');
      return;
    }
    kdHead.textContent = '';
    const dot = el('span', 'kd-dot');
    dot.setAttribute('aria-hidden', 'true');
    const title = el('span', 'kd-title', line('digest', 'title', { n: dg.n }) || '');
    kdHead.append(dot, title);
    kdHead.hidden = false;
    dg.icon = dot;

    kdBody.textContent = '';
    if (dg.prides.length) {
      const ol = el('ul', 'kd-prides');
      dg.prides.forEach((p, i) => ol.append(listItem('kd-pride', line('digest', 'pride', { i: i + 1 }), p.text, p.sub)));
      kdBody.append(ol);
    }
    if (dg.news.length) {
      const ul = el('ul', 'kd-news');
      for (const n of dg.news) ul.append(listItem('kd-item', '', n.text, n.sub, ICON.boom));
      kdBody.append(ul);
    }
    kdBody.hidden = false;
    if (resultCard) resultCard.classList.add('kts-digest');
  }

  // ---------- выбор редакции: бот-токсик ----------
  function prediction() {
    const npc = K.npc;
    let p = npc ? npc.lastPrediction : null;
    if (typeof p === 'function') p = p();
    if (typeof p === 'string' && p) return { text: p };
    if (p && typeof p.text === 'string' && p.text) {
      const came = typeof p.came === 'boolean' ? p.came : typeof p.fulfilled === 'boolean' ? p.fulfilled : undefined;
      return { text: p.text, came };
    }
    return run.predict ? { text: run.predict } : null;
  }
  function botBlock() {
    const b = def('bot');
    if (!b) return null;
    let title = null, text = null, tail = null;
    if (K.today.monday) {
      title = line('bot', 'monday');
      text = textOf(b.affirm, null, 'bot:affirm');
      tail = line('bot', 'mondayTail');
    } else {
      const p = prediction();
      if (p) {
        title = line('bot', 'pick');
        text = p.text;
        if (p.came === true) tail = line('bot', 'came');
        else if (p.came === false) tail = line('bot', 'missed');
      }
    }
    if (!title || !text) return null;
    const box = el('div', 'kd-bot');
    box.append(el('p', 'kd-bot-t', title), el('p', 'kd-bot-q', `«${text}»`));
    if (tail) box.append(el('p', 'kd-bot-tail', tail));
    return box;
  }

  // ---------- ДР KTS: три подарка ----------
  function giftState() {
    const y = K.today.y;
    if (!prof.gifts || prof.gifts.y !== y) prof.gifts = { y, open: [false, false, false] };
    return prof.gifts;
  }
  function giftsBlock() {
    if (!K.event('ktsBirthdayGifts')) return null;
    const b = def('birthday');
    const names = b && Array.isArray(b.gifts) ? b.gifts : null;
    if (!names || names.length < 3) return null;
    const st = giftState();
    const box = el('div', 'kd-gifts');
    box.append(el('p', 'kd-gifts-t', line('birthday', 'giftsTitle') || ''));
    const row = el('div', 'kd-gift-row');
    names.slice(0, 3).forEach((name, i) => {
      const g = button('kd-gift');
      const lid = el('span', 'kd-box');
      lid.setAttribute('aria-hidden', 'true');
      const cap = el('span', 'kd-gift-cap', K.fmt(name) || '');
      g.append(lid, cap);
      const paint = () => {
        const open = !!st.open[i];
        g.classList.toggle('open', open);
        g.setAttribute('aria-pressed', open ? 'true' : 'false');
        g.setAttribute('aria-label', open ? cap.textContent : line('birthday', 'giftLabel', { i: i + 1 }) || '');
      };
      paint();
      g.addEventListener('click', () => {
        if (st.open[i]) return;
        st.open[i] = true;
        save();
        paint();
        if (i === 1 && K.get('skins', 'trusy')) K.skin('trusy');
        if (i === 2) K.secret('gift', { text: line('birthday', 'giftSecret') || cap.textContent });
      });
      row.append(g);
    });
    box.append(row);
    return box;
  }

  // ---------- подвал дайджеста: погода, финал, реакции ----------
  function weatherLine(dg) {
    const d = def('digest');
    if (!d || typeof d.weather !== 'string' || !d.join || !Array.isArray(d.temps)) return null;
    const w = (G.scene && G.scene.weather) || 'clear';
    let t = Number(d.temps[K.today.m - 1]) || 0;
    if (w === 'snow') t = Math.min(t, -1);
    else if (w === 'rain') t = Math.max(t, 2);
    const head = K.fmt(d.weather, {
      icon: (d.weatherIcon && (d.weatherIcon[w] || d.weatherIcon.clear)) || '',
      temp: (t > 0 ? '+' : t < 0 ? '−' : '') + Math.abs(t),
      clock: dg.clock,
      mood: w === 'clear' && t >= (d.warmFrom || 15) ? d.moodWarm : d.moodCold,
    });
    const j = run.joined;
    const tail = K.fmt((j && j.name && d.join[j.kind]) || (j && j.kind === 'secret' && d.join.secret) || d.join.none || '', { name: j ? j.name : '' });
    return head && tail ? `${head} ${tail}` : null;
  }
  function finalLine() {
    const b = def('birthday');
    if (b && b.finalDay && K.today.md === b.finalDay) {
      const s = line('birthday', 'final');
      if (s) return s;
    }
    const dow = K.today.dow;
    if (dow === 5 || dow === 6 || dow === 0) return line('digest', 'weekend');
    return null;
  }
  function reactionCounts(dg) {
    const r = field('digest', 'reactions') || {};
    const range = (run.bossWin && r.boss) || (dg.info.isRecord && dg.info.prevBest > 0 && r.record) || r.normal || [1, 15];
    const rnd = K.rng(`${K.today.y}:${dg.n}:${dg.info.score}`);
    const total = Math.round(range[0] + rnd() * (range[1] - range[0]));
    const fire = Math.max(1, Math.round(total * (0.42 + rnd() * 0.2)));
    const party = Math.round((total - fire) * (0.45 + rnd() * 0.3));
    return [['fire', fire], ['party', party], ['heart', Math.max(0, total - fire - party)]];
  }
  function reactionsBlock(dg) {
    const box = el('div', 'kd-react');
    box.setAttribute('role', 'group');
    for (const [kind, n] of reactionCounts(dg)) {
      if (!(n > 0) && kind !== 'fire') continue;
      const b = button('kd-r');
      const ico = el('span', 'kd-r-ico');
      ico.innerHTML = ICON[kind];
      const num = el('span', 'kd-r-n', String(n));
      b.append(ico, num);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        num.textContent = String(n + (on ? 1 : 0));
      });
      box.append(b);
    }
    return box;
  }
  function renderFoot(dg) {
    kdFoot.textContent = '';
    if (!dg) {
      kdFoot.hidden = true;
      return;
    }
    const w = weatherLine(dg);
    if (w) kdFoot.append(el('p', 'kd-weather', w));
    const f = finalLine();
    if (f) kdFoot.append(el('p', 'kd-final', f));
    footRow.textContent = '';
    footRow.append(reactionsBlock(dg));
    kdFoot.append(footRow);
    kdFoot.hidden = false;
  }
  function renderExtra() {
    kdExtra.textContent = '';
    const bot = botBlock();
    if (bot) kdExtra.append(bot);
    const gifts = giftsBlock();
    if (gifts) kdExtra.append(gifts);
    kdExtra.hidden = !kdExtra.children.length;
  }

  // ---------- «Уволиться»: секретка inevitable ----------
  const quitBtn = button('kd-quit');
  let quitTries = 0, quitGone = false, lastDodge = -1;
  const quitSteps = () => {
    const s = field('quit', 'steps');
    return Array.isArray(s) && s.length ? s : null;
  };
  function resetQuit() {
    const steps = quitSteps();
    quitBtn.hidden = quitGone || !steps;
    if (!steps) return;
    quitBtn.textContent = steps[Math.min(quitTries, steps.length - 1)];
    quitBtn.classList.remove('floating');
    quitBtn.style.left = '';
    quitBtn.style.top = '';
    footRow.append(quitBtn);
  }
  function placeQuit(ev) {
    const layer = slot('over', null, 'float');
    if (!layer || !overView) return;
    if (quitBtn.parentNode !== layer) layer.append(quitBtn);
    quitBtn.classList.add('floating');
    const v = overView.getBoundingClientRect();
    const a = againBtn ? againBtn.getBoundingClientRect() : null;
    const bw = quitBtn.offsetWidth || 96, bh = quitBtn.offsetHeight || 30;
    const pad = 8, gap = 12;
    const px = ev && ev.clientX > 0 ? ev.clientX - v.left : v.width / 2;
    const py = ev && ev.clientY > 0 ? ev.clientY - v.top : v.height / 2;
    let best = null, bestD = -1;
    for (let i = 0; i < 24; i++) {
      const x = pad + Math.random() * Math.max(0, v.width - bw - pad * 2);
      const y = pad + Math.random() * Math.max(0, v.height - bh - pad * 2);
      if (a && a.width > 0) {
        const ax = a.left - v.left, ay = a.top - v.top;
        if (x < ax + a.width + gap && x + bw > ax - gap && y < ay + a.height + gap && y + bh > ay - gap) continue;
      }
      const dist = Math.hypot(x + bw / 2 - px, y + bh / 2 - py);
      if (dist > bestD) {
        bestD = dist;
        best = [x, y];
      }
    }
    if (!best) best = [pad, pad];
    quitBtn.style.left = best[0].toFixed(0) + 'px';
    quitBtn.style.top = best[1].toFixed(0) + 'px';
  }
  function dodge(ev) {
    if (quitGone || G.state.mode !== 'over') return;
    const now = G.state.realT;
    if (now - lastDodge < 0.25) return;
    lastDodge = now;
    quitTries++;
    const q = def('quit');
    if (quitTries >= ((q && q.tries) || 5)) {
      quitGone = true;
      quitBtn.hidden = true;
      if (!K.secret('inevitable', { text: line('quit', 'secretText') || '' })) toast(line('quit', 'label') || '', line('quit', 'text') || '', { kind: 'kts' });
      return;
    }
    const steps = quitSteps();
    if (steps) quitBtn.textContent = steps[Math.min(quitTries, steps.length - 1)];
    placeQuit(ev);
  }
  quitBtn.addEventListener('pointerenter', (e) => {
    if (e && e.pointerType === 'mouse') dodge(e);
  });
  quitBtn.addEventListener('pointerdown', (e) => {
    if (e && e.preventDefault) e.preventDefault();
    dodge(e);
  });
  quitBtn.addEventListener('click', (e) => {
    if (e && e.preventDefault) e.preventDefault();
    dodge(e);
  });

  // ---------- ДР KTS на старте ----------
  let birthdayToasted = false;
  function birthdayToast() {
    const b = def('birthday');
    if (!b) return;
    const c = K.get('calendar', 'ktsBirthday');
    let text = null;
    if (c && K.today.m === c.month && K.today.d === c.day) {
      const age = K.ktsAge();
      if (age > 0 && Array.isArray(b.years)) text = line('birthday', 'day', { age: `${age} ${plural(age, b.years)}` });
    }
    if (!text) text = line('birthday', 'month');
    const label = line('birthday', 'label');
    if (label || text) toast(label || '', text || '', { kind: 'kts' });
  }

  // ---------- API для соседей ----------
  const digestHooks = [];
  function digestApi(dg) {
    return {
      n: dg.n,
      info: dg.info,
      icon: dg.icon,
      addNews: (text) => {
        const ul = kdBody.querySelector ? kdBody.querySelector('.kd-news') : null;
        if (text && ul) ul.append(listItem('kd-item', '', String(text), '', ICON.boom));
      },
      add: (node) => {
        if (node) kdExtra.append(node);
        kdExtra.hidden = false;
      },
    };
  }
  K.screens = {
    onDigest: (fn) => {
      if (typeof fn === 'function') digestHooks.push(fn);
    },
  };

  // ---------- события ----------
  G.on('boot', () => {
    mount();
    slot('start', startBox);
    slot('pause', pauseBox);
    slot('hud', wifi);
    const tapPad = $('tapPad');
    if (tapPad) tapPad.append(tapTip);
    setWifi(false);
    renderGreeting();
    renderCounters();
    renderTip([startTip, tapTip], 'start');
    save();
  });
  G.on('start', () => {
    run = fresh();
    digest = null;
    prof.runs++;
    save();
    setWifi(false);
    tapTip.hidden = true;
    startWord.form.hidden = true;
    keyBtn.setAttribute('aria-expanded', 'false');
    keyBtn.classList.remove('on');
    if (K.event('ktsBirthday')) {
      run.birthday = true;
      G.emit('kts:event', { id: 'birthday', phase: 'start' });
      if (!birthdayToasted) {
        birthdayToasted = true;
        birthdayToast();
      }
    }
  });
  G.on('pause', () => {
    rich(pauseScore, line('pause', 'score', { score: G.fmtMin(G.score()) }) || '');
    renderTip([pauseTip], 'pause');
    pauseWord.msg.textContent = '';
    renderCounters();
  });
  G.on('die', (info) => {
    if (run.birthday) G.emit('kts:event', { id: 'birthday', phase: 'end' });
    setWifi(false);
    if (prof.digestY !== K.today.y) {
      prof.digestY = K.today.y;
      prof.digestN = 0;
    }
    prof.digestN++;
    save();
    try {
      digest = info ? compose(info) : null;
    } catch (e) {
      digest = null;
      G.report('kts: дайджест', e);
    }
  });
  G.on('gameover', (info) => {
    if (!digest || digest.info !== info) digest = null;
    renderDigest(digest);
    renderExtra();
    renderFoot(digest);
    resetQuit();
    renderTip([tapTip], 'start');
    if (!digest) return;
    for (const fn of digestHooks) {
      try {
        fn(digestApi(digest));
      } catch (e) {
        G.report('kts: дайджест, хук', e);
      }
    }
  });

})();
