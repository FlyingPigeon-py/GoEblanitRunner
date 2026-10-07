/* Звук и процедурная музыка. Владелец — агент audio. */
(() => {
  'use strict';
  const G = window.G;

  const KEY_MUTED = 'eblan.muted';
  const KEY_MUSIC = 'eblan.audio.music';
  const KEY_VOL = 'eblan.audio.vol';
  const MUSIC_TRIM = 0.55;
  const CRACKLE = 0.12;
  const FLOOR = 0.0005;
  const LOOKAHEAD = 0.18;
  const TICK_MS = 30;
  const SWING = 0.1;
  const NOISE_SEC = 2;
  const OVER_TICK_GAIN = 0.3;
  const noop = () => {};
  const ktsOn = () => !!(G.kts && G.kts.enabled);

  const vol01 = (v, d) => {
    v = Number(v);
    return Number.isFinite(v) ? G.clamp(v, 0, 1) : d;
  };
  const savedVol = G.store.getJSON(KEY_VOL, null) || {};
  const volume = { music: vol01(savedVol.music, 0.8), sfx: vol01(savedVol.sfx, 0.9) };

  const A = (G.audio = {
    muted: G.store.get(KEY_MUTED, '0') === '1',
    music: G.store.get(KEY_MUSIC, '1') !== '0',
    volume,
  });

  let ac = null, N = null, WAVE = null, noiseBuf = null, crackleBuf = null, crackleSrc = null, rainSrc = null, rainLevel = 0;
  let broken = false, unlocked = false, schedTimer = 0, suspendTimer = 0;

  const musicLevel = () => (A.music ? volume.music * MUSIC_TRIM : 0);
  const settle = (p) => { if (p && p.catch) p.catch(noop); };

  // ---------- теория ----------
  const SCALE = [0, 2, 4, 5, 7, 9, 11];
  const deg2midi = (d, base) => {
    const o = Math.floor(d / 7);
    return base + o * 12 + SCALE[d - o * 7];
  };
  const fold = (m, lo) => {
    while (m < lo) m += 12;
    while (m >= lo + 12) m -= 12;
    return m;
  };
  const foldLead = (m) => {
    while (m > 86) m -= 12;
    while (m < 60) m += 12;
    return m;
  };
  const HZ = new Float32Array(128);
  for (let i = 0; i < 128; i++) HZ[i] = 440 * Math.pow(2, (i - 69) / 12);
  const hz = (m) => HZ[m < 0 ? 0 : m > 127 ? 127 : m | 0];

  // ---------- паттерны ----------
  const REST = -100;
  const DIGIT = { x: -1, y: -2, a: 10, b: 11, c: 12 };
  function lens(p) {
    let last = -1;
    for (let i = 0; i < 16; i++) {
      if (p.o[i] === REST) continue;
      if (last >= 0) p.n[last] = i - last;
      last = i;
    }
    if (last >= 0) p.n[last] = 16 - last;
    return p;
  }
  function parse(str) {
    const p = { o: new Int8Array(16).fill(REST), n: new Uint8Array(16) };
    for (let i = 0; i < 16; i++) {
      const ch = str[i];
      if (ch >= '0' && ch <= '9') p.o[i] = ch.charCodeAt(0) - 48;
      else if (ch in DIGIT) p.o[i] = DIGIT[ch];
    }
    return lens(p);
  }
  function parseAll(src) {
    const out = {};
    for (const k in src) out[k] = parse(src[k]);
    return out;
  }

  // Мелодия: ступени фа мажора от корня текущего аккорда. hook — «да-вай еб-ла-нить».
  const LEAD = parseAll({
    a1: '4...2.4.6...4...',
    a2: '..7.6.4...2.4...',
    a3: '0.2.4..7..6.4.2.',
    a4: '....4...2..4....',
    b1: '9.7...4.6...7...',
    b2: '4.4.2..0..2.....',
    b3: '7...6...4...2...',
    b4: '2.4.7.4.9...7...',
    hook: '4.7...5.8...7...',
    hook2: '4.7...5.8.9.7...',
    ans: '4.3.2...0...2...',
    lull: '7.......4.......',
    tans: '6.4.2.1.0.......',
    tans2: '6.4.2...1.......',
    tlull: '4.......2.......',
    rest: '................',
  });
  const PHRASES = {
    A: [['a1', 'a2', 'a1', 'b3'], ['a3', 'a4', 'a3', 'b2'], ['a1', 'a4', 'b4', 'b3']],
    B: [['hook', 'ans', 'hook2', 'b2'], ['hook', 'a2', 'b4', 'lull']],
    C: [['b4', 'a4', 'b1', 'b3'], ['a3', 'a2', 'b4', 'lull'], ['b1', 'b2', 'a1', 'b3']],
    N: [['lull', 'a4', 'lull', 'b3'], ['a4', 'rest', 'b2', 'lull'], ['b3', 'lull', 'a4', 'rest']],
  };
  const BASS = parseAll({
    day: '0.....0...4.0...',
    day2: '0.........0...4.',
    busy: '0..0..7...4...0.',
    walk: '0...2...4...2...',
    long: '0...............',
  });
  const KEYS = { day: 'X.........x.....', day2: 'x.....X.....x...', stab: '..x...X...x...x.', hold: 'X...............' };
  const DRUMS = {
    intro: ['K.......K.......', '....s.......s...', 'h.h.h.h.h.h.h.h.'],
    day: ['K......k..K.....', '....S.......S...', 'h.h.h.h.h.h.h.h.'],
    day2: ['K.....k...K..k..', '....S.......S..s', 'h.h.h.h.h.h.h.hO'],
    night: ['K.........K.....', '....r.......r...', 'h...h...h...h...'],
    break: ['K...............', '................', 'h.......h.......'],
  };
  const FILL = 'S.sS';
  const PROGS = [[0, 5, 1, 4], [3, 2, 1, 0], [5, 1, 4, 0], [3, 4, 2, 5]];
  const SECTIONS = {
    intro: { bars: 2, progs: [0, 1], lead: null, drums: 'intro', bass: ['long', 'day'], keys: ['hold', 'day'] },
    A: { bars: 8, progs: [0, 2], lead: 'A', drums: 'day', bass: ['day', 'day2'], keys: ['day', 'day2'] },
    B: { bars: 8, progs: [0], lead: 'B', drums: 'day', bass: ['day', 'walk'], keys: ['day2', 'day'] },
    C: { bars: 8, progs: [3, 1], lead: 'C', drums: 'day', bass: ['busy', 'day'], keys: ['stab', 'day2'] },
    break: { bars: 4, progs: [1, 3], lead: 'N', drums: 'break', bass: ['long', 'long'], keys: ['hold', 'hold'] },
  };
  const FORM = ['intro', 'B', 'A', 'C', 'break', 'A', 'B', 'C', 'A', 'break'];
  const FEVER_ARP = [0, 2, 4, 7, 4, 2, 4, 9];
  const RESTART_FORM = [0, 1, 2, 3];
  const TITLE_PROG = [0, 5, 3, 4];
  const TITLE_LEAD = ['hook', null, 'tans', 'tlull', 'hook2', null, 'tans2', null];
  const GOOD_PROG = [0, 3, 4, 0];
  const GOOD_LEAD = ['hook', 'b4', 'hook2', 'a3'].map((k) => LEAD[k]);
  const GOOD_ARP = [0, 4, 7, 9, 12, 9, 7, 4];
  const GOOD_SEC = 10;

  function vary(src, amt) {
    const p = { o: new Int8Array(src.o), n: new Uint8Array(16) };
    let first = true;
    for (let i = 0; i < 16; i++) {
      if (p.o[i] === REST) continue;
      if (first) { first = false; continue; }
      const r = Math.random();
      if (r < 0.1 * amt) p.o[i] = REST;
      else if ((i & 1) && r < 0.22 * amt) p.o[i] += Math.random() < 0.5 ? 1 : -1;
      else if ((i & 3) === 2 && i < 15 && p.o[i + 1] === REST && r < 0.3 * amt) p.o[i + 1] = p.o[i] + (Math.random() < 0.5 ? 1 : -1);
    }
    return lens(p);
  }
  function phrase(kind, bars) {
    const ph = G.pick(PHRASES[kind]), out = [];
    for (let b = 0; b < bars; b++) out.push(vary(LEAD[ph[b & 3]], b < 4 ? 0.4 : 1));
    return out;
  }
  function makeSection(type) {
    const d = SECTIONS[type];
    return {
      type,
      bars: d.bars,
      prog: PROGS[G.pick(d.progs)],
      drums: d.drums,
      bass: d.bass,
      keys: d.keys,
      lead: d.lead ? phrase(d.lead, d.bars) : null,
      nlead: phrase('N', d.bars),
    };
  }

  // ---------- граф ----------
  A.context = () => {
    if (ac || broken) return ac;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) { broken = true; return null; }
    try { ac = new Ctor({ latencyHint: 'interactive' }); } catch (e) {
      try { ac = new Ctor(); } catch (e2) { ac = null; }
    }
    if (!ac) { broken = true; return null; }
    try { build(); } catch (e) {
      G.report('audio build', e);
      ac = null;
      N = null;
      broken = true;
    }
    return ac;
  };

  function build() {
    const t0 = ac.currentTime;
    const gain = (v, to) => {
      const g = ac.createGain();
      g.gain.value = v;
      if (to) g.connect(to);
      return g;
    };
    const filter = (type, f, q, to) => {
      const b = ac.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q;
      if (to) b.connect(to);
      return b;
    };
    const comp = (th, knee, ratio, att, rel, to) => {
      const c = ac.createDynamicsCompressor();
      c.threshold.value = th;
      c.knee.value = knee;
      c.ratio.value = ratio;
      c.attack.value = att;
      c.release.value = rel;
      c.connect(to);
      return c;
    };
    const delay = (sec, to) => {
      const d = ac.createDelay(2);
      d.delayTime.value = sec;
      if (to) d.connect(to);
      return d;
    };

    const out = gain(0.9, ac.destination);
    const limiter = comp(-2, 0, 20, 0.002, 0.12, out);
    const glue = comp(-12, 12, 2.5, 0.006, 0.25, limiter);
    const master = gain(A.muted ? 0 : 1, glue);
    const musicVol = gain(musicLevel(), master);
    const sfxVol = gain(volume.sfx, master);
    const sfxIn = gain(1, sfxVol);
    const stinger = gain(1, sfxIn);
    const sfxEcho = delay(0.17, null);
    sfxEcho.connect(filter('lowpass', 2600, 0.5, gain(0.3, sfxEcho)));
    sfxEcho.connect(gain(0.38, sfxIn));
    const bell = gain(1, sfxIn);
    bell.connect(sfxEcho);

    const musicDuck = gain(1, musicVol);
    const modeGain = gain(0, musicDuck);
    const tone = filter('lowpass', 3200, 0.5, modeGain);
    const wow = delay(0.014, tone);
    const wowSlow = ac.createOscillator(), wowFast = ac.createOscillator();
    wowSlow.frequency.value = 0.47;
    wowFast.frequency.value = 5.3;
    wowSlow.connect(gain(0.0016, wow.delayTime));
    wowFast.connect(gain(0.00006, wow.delayTime));
    wowSlow.start(t0);
    wowFast.start(t0);
    const musicIn = gain(1, wow);
    const reverb = ac.createConvolver();
    reverb.buffer = makeIR(1.5);
    reverb.connect(gain(0.8, musicIn));
    const drums = gain(1, musicIn);
    const hatHP = filter('highpass', 7200, 0.7, drums);
    const snareBP = filter('bandpass', 1900, 0.9, drums);
    const bassLP = filter('lowpass', 750, 0.7, musicIn);
    const keysLP = filter('lowpass', 2300, 0.5, musicIn);
    keysLP.connect(gain(0.3, reverb));
    const leadLP = filter('lowpass', 3400, 0.6, musicIn);
    const leadRev = gain(0.25, reverb);
    leadLP.connect(leadRev);
    const leadEcho = delay(0.45, null);
    leadLP.connect(gain(0.3, leadEcho));
    leadEcho.connect(filter('lowpass', 2000, 0.5, gain(0.33, leadEcho)));
    leadEcho.connect(gain(0.5, musicIn));
    const crackleGain = gain(0, musicDuck);
    const crackleHP = filter('highpass', 1400, 0.5, crackleGain);
    const rainGain = gain(0, sfxVol);
    const ambIn = gain(0, sfxVol);
    const rainHP = filter('highpass', 500, 0.5, filter('lowpass', 2600, 0.4, rainGain));

    const wave = (h) => ac.createPeriodicWave(new Float32Array(h.length), new Float32Array(h));
    WAVE = {
      keys: wave([0, 1, 0.32, 0.07, 0.11, 0.02, 0.035, 0.01]),
      lead: wave([0, 1, 0.45, 0.3, 0.2, 0.14, 0.09, 0.07, 0.04, 0.03]),
      box: wave([0, 1, 0, 0, 0.3, 0, 0, 0, 0.06]),
      bass: wave([0, 1, 0.3, 0.08]),
      brass: wave([0, 1, 0.72, 0.52, 0.4, 0.3, 0.22, 0.15, 0.1, 0.07, 0.05]),
    };
    noiseBuf = makeNoise();
    crackleBuf = makeCrackle(3);
    N = { master, musicVol, sfxVol, sfxIn, stinger, bell, musicDuck, modeGain, tone, drums, hatHP, snareBP, bassLP, keysLP, leadLP, leadRev, leadEcho, crackleGain, crackleHP, rainGain, rainHP, ambIn, ambVerb: null };
  }

  function makeIR(sec) {
    const sr = ac.sampleRate, len = Math.max(64, Math.floor(sr * sec));
    const buf = ac.createBuffer(2, len, sr);
    const decay = Math.pow(0.001, 1 / len), fade = Math.floor(sr * 0.01);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let env = 1, lp = 0;
      for (let i = 0; i < len; i++) {
        lp += (Math.random() * 2 - 1 - lp) * (0.6 - 0.45 * i / len);
        d[i] = lp * env * (i < fade ? i / fade : 1);
        env *= decay;
      }
    }
    return buf;
  }
  function makeNoise() {
    const sr = ac.sampleRate, len = Math.floor(sr * NOISE_SEC);
    const buf = ac.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function makeCrackle(sec) {
    const sr = ac.sampleRate, len = Math.floor(sr * sec);
    const buf = ac.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.02;
    const pops = Math.round(sec * 9);
    for (let k = 0; k < pops; k++) {
      const at = Math.floor(Math.random() * (len - 40));
      const amp = (0.25 + Math.random() * 0.75) * (Math.random() < 0.5 ? -1 : 1);
      const w = 2 + Math.floor(Math.random() * 6);
      for (let j = 0; j < w * 4; j++) d[at + j] += amp * Math.exp(-j / w) * (j & 1 ? -0.6 : 1);
    }
    return buf;
  }

  // ---------- голоса ----------
  function endVoice() {
    this.disconnect();
    if (this.__a) this.__a.disconnect();
    if (this.__b) this.__b.disconnect();
    if (this.__c) this.__c.disconnect();
    this.__a = this.__b = this.__c = null;
  }
  function own(src, end, a, b, c) {
    src.stop(end);
    src.onended = endVoice;
    src.__a = a || null;
    src.__b = b || null;
    src.__c = c || null;
    src.__end = end;
    return src;
  }
  function osc(wave, f, t) {
    const o = ac.createOscillator();
    if (typeof wave === 'string') o.type = wave;
    else o.setPeriodicWave(wave);
    o.frequency.setValueAtTime(f, t);
    return o;
  }
  function env(p, t, a, peak, d) {
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(Math.max(1e-4, peak), t + a);
    p.exponentialRampToValueAtTime(FLOOR, t + a + d);
  }
  function blip(dest, wave, f0, f1, t, a, d, peak, glide) {
    const o = osc(wave, f0, t), g = ac.createGain();
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + (glide || a + d));
    env(g.gain, t, a, peak, d);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    return own(o, t + a + d + 0.03, g);
  }
  function noise(dest, t, a, d, peak, type, f0, f1, q, rate) {
    const s = ac.createBufferSource(), g = ac.createGain();
    const r = rate || 1;
    s.buffer = noiseBuf;
    if (r !== 1) s.playbackRate.setValueAtTime(r, t);
    let f = null;
    if (type) {
      f = ac.createBiquadFilter();
      f.type = type;
      f.Q.value = q || 0.7;
      f.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + a + d);
      s.connect(f);
      f.connect(g);
    } else {
      s.connect(g);
    }
    env(g.gain, t, a, peak, d);
    g.connect(dest);
    const len = a + d + 0.03;
    s.start(t, Math.random() * Math.max(0, NOISE_SEC - len * r - 0.02));
    return own(s, t + len, g, f);
  }
  function panner(dest, p0, p1, t, d) {
    if (!ac.createStereoPanner) return null;
    const p = ac.createStereoPanner();
    p.pan.setValueAtTime(p0, t);
    p.pan.linearRampToValueAtTime(p1, t + d);
    p.connect(dest);
    return p;
  }

  // ---------- инструменты ----------
  const RING = 40;
  const ring = new Array(RING).fill(null);
  let ringI = 0;
  function track(o) {
    ring[ringI] = o;
    ringI = (ringI + 1) % RING;
    return o;
  }

  function kick(t, v) { blip(N.drums, 'sine', 160, 46, t, 0.003, 0.3, 0.8 * v, 0.11); }
  function snare(t, v) {
    noise(N.snareBP, t, 0.002, 0.13 + 0.05 * v, 0.34 * v);
    blip(N.drums, 'triangle', 210, 165, t, 0.002, 0.07, 0.12 * v);
  }
  function rim(t, v) {
    blip(N.drums, 'triangle', 830, 790, t, 0.001, 0.035, 0.1 * v);
    noise(N.snareBP, t, 0.001, 0.025, 0.1 * v);
  }
  function hat(t, v, open) { noise(N.hatHP, t, 0.001, open ? 0.2 : 0.035, (open ? 0.07 : 0.09) * v); }
  function crash(t) { noise(N.hatHP, t, 0.005, 1.1, 0.045, null, 0, 0, 0, 0.8); }
  function clockTick(t, hi, v) {
    blip(N.drums, 'sine', hi ? 2500 : 1650, hi ? 1900 : 1250, t, 0.001, 0.03, 0.1 * v);
    noise(N.hatHP, t, 0.0005, 0.012, 0.05 * v);
  }
  function bassNote(t, m, dur, v) {
    const o = osc(WAVE.bass, hz(m), t), g = ac.createGain(), p = g.gain, peak = 0.3 * v;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + 0.012);
    p.exponentialRampToValueAtTime(peak * 0.5, t + Math.max(0.06, dur * 0.7));
    p.linearRampToValueAtTime(0, t + dur + 0.06);
    o.connect(g);
    g.connect(N.bassLP);
    o.start(t);
    track(own(o, t + dur + 0.09, g));
  }
  function keyNote(dest, t, m, dur, v, pad) {
    const o = osc(WAVE.keys, hz(m), t), g = ac.createGain(), p = g.gain;
    const peak = 0.055 * v, a = pad ? 0.08 : 0.004, rel = pad ? 0.6 : 0.3;
    o.detune.setValueAtTime((Math.random() - 0.5) * 10, t);
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.exponentialRampToValueAtTime(peak * (pad ? 0.6 : 0.28), t + a + Math.max(0.05, dur * 0.85));
    p.setTargetAtTime(0, t + a + dur, rel / 4);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    return own(o, t + a + dur + rel, g);
  }
  function chord(dest, t, deg, dur, v, pad, music) {
    for (let i = 0; i < 4; i++) {
      const o = keyNote(dest, t + (pad ? 0 : i * 0.012 + Math.random() * 0.004), fold(deg2midi(deg + i * 2, 53), 57), dur, v, pad);
      if (music) track(o);
    }
    if (!pad && Math.random() < 0.35) {
      const o = keyNote(dest, t + 0.05, fold(deg2midi(deg + 8, 53), 69), dur, v * 0.5, false);
      if (music) track(o);
    }
  }
  function leadNote(dest, t, m, dur, v) {
    return blip(dest, WAVE.lead, hz(m), 0, t, 0.006, Math.min(0.55, Math.max(0.12, dur * 1.1)), 0.1 * v);
  }
  function boxNote(dest, t, m, v, d) {
    return blip(dest, WAVE.box, hz(m), 0, t, 0.003, d || 0.9, 0.075 * v);
  }
  function brass(dest, t, f, len, v, lo, hi, vib) {
    const o = osc(WAVE.brass, f, t), fl = ac.createBiquadFilter(), g = ac.createGain();
    fl.type = 'lowpass';
    fl.Q.value = 1.2;
    const fq = fl.frequency, p = g.gain, peak = 0.1 * v;
    fq.setValueAtTime(lo, t);
    fq.exponentialRampToValueAtTime(hi, t + 0.06);
    fq.exponentialRampToValueAtTime(lo * 1.2, t + len + 0.06);
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + 0.025);
    p.linearRampToValueAtTime(peak * 0.75, t + len);
    p.setTargetAtTime(0, t + len, 0.05);
    o.connect(fl);
    fl.connect(g);
    g.connect(dest);
    if (vib) {
      const lfo = osc('sine', vib, t), depth = ac.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(f * 0.025, t + len * 0.5);
      lfo.connect(depth);
      depth.connect(o.frequency);
      lfo.start(t);
      own(lfo, t + len + 0.3, depth);
    }
    o.start(t);
    return own(o, t + len + 0.3, fl, g);
  }
  function bellStrike(dest, t, f, v, d) {
    blip(dest, 'sine', f, 0, t, 0.002, d, 0.1 * v);
    blip(dest, 'sine', f * 2.76, 0, t, 0.002, d * 0.45, 0.035 * v);
    if (f < 1700) blip(dest, 'sine', f * 5.4, 0, t, 0.001, d * 0.2, 0.018 * v);
  }

  // ---------- микс ----------
  function glide(p, v, tau) {
    const t = ac.currentTime;
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
    else {
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
    }
    p.setTargetAtTime(v, t, tau);
  }
  function duck(depth, hold) {
    if (!N) return;
    glide(N.musicDuck.gain, depth, 0.04);
    N.musicDuck.gain.setTargetAtTime(1, ac.currentTime + hold, 0.3);
  }
  const runCutoff = () => (M.mood === 2 ? 6800 : M.mood === 1 ? 1500 : G.lerp(5200, 1900, M.nightK));
  function applyMode() {
    if (!N) return;
    const mode = G.state.mode;
    let g = 1, cut = runCutoff(), crk = 0.45, rev = G.lerp(0.22, 0.5, M.nightK), ticksAt = 0;
    if (mode === 'start') { g = 0.6; cut = 3200; crk = 0.8; rev = 0.55; }
    else if (mode === 'pause') { g = 0.36; cut = 600; crk = 0.9; }
    else if (mode === 'over') {
      crk = 0.8;
      ticksAt = M.overTicksAt - 0.1;
      const ticking = ac.currentTime >= ticksAt;
      g = ticking ? OVER_TICK_GAIN : 0;
      cut = ticking ? 2400 : 360;
    }
    const slow = mode === 'over';
    glide(N.modeGain.gain, g, slow ? 0.28 : 0.12);
    glide(N.tone.frequency, cut, slow ? 0.22 : 0.15);
    glide(N.crackleGain.gain, A.music ? crk * CRACKLE : 0, 0.4);
    glide(N.leadRev.gain, rev, 0.5);
    glide(N.ambIn.gain, mode === 'run' ? AMB_GAIN : mode === 'pause' ? AMB_GAIN * 0.5 : mode === 'over' ? AMB_GAIN * 0.4 : 0, 0.5);
    if (Number.isFinite(ticksAt) && ticksAt > ac.currentTime) {
      N.modeGain.gain.setTargetAtTime(OVER_TICK_GAIN, ticksAt, 0.4);
      N.tone.frequency.setTargetAtTime(2400, ticksAt, 0.2);
    }
  }
  function setCrackle() {
    if (!N) return;
    const on = A.music && !A.muted;
    if (on && !crackleSrc) {
      const s = ac.createBufferSource();
      s.buffer = crackleBuf;
      s.loop = true;
      s.connect(N.crackleHP);
      s.start(ac.currentTime + 0.05);
      crackleSrc = s;
    } else if (!on && crackleSrc) {
      own(crackleSrc, ac.currentTime + 0.5);
      crackleSrc = null;
    }
  }
  // Дождь за окном: тихий шум, пока сцена показывает дождливую ночь.
  const RAIN_GAIN = 0.05;
  function updateRain() {
    const sc = G.scene, mode = G.state.mode;
    let k = sc && sc.weather === 'rain' ? Number(sc.weatherK) || 0 : 0;
    if (mode === 'pause') k *= 0.5;
    else if (mode === 'over') k *= 0.7;
    const target = A.muted ? 0 : Math.round(k * 40) / 40;
    if (target === rainLevel) return;
    rainLevel = target;
    if (target > 0 && !rainSrc) {
      const src = ac.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      src.connect(N.rainHP);
      src.start(ac.currentTime + 0.02);
      rainSrc = src;
    }
    glide(N.rainGain.gain, target * RAIN_GAIN, 0.8);
    if (target === 0 && rainSrc) {
      own(rainSrc, ac.currentTime + 4);
      rainSrc = null;
    }
  }
  function tapeStop(t) {
    for (let i = 0; i < RING; i++) {
      const o = ring[i];
      if (!o || !(o.__end > t)) continue;
      o.detune.cancelScheduledValues(t);
      o.detune.setValueAtTime(0, t);
      o.detune.linearRampToValueAtTime(-1900, t + 0.8);
    }
  }

  const stingers = [];
  let stingerFree = 0, achFree = 0;
  function stg(o) {
    if (stingers.length > 48) {
      const t = ac.currentTime;
      let j = 0;
      for (let i = 0; i < stingers.length; i++) if (stingers[i].__end > t) stingers[j++] = stingers[i];
      stingers.length = j;
    }
    stingers.push(o);
    return o;
  }
  function stopStingers() {
    const t = ac.currentTime;
    for (let i = 0; i < stingers.length; i++) {
      if (stingers[i].__end > t) {
        try { stingers[i].stop(t + 0.06); } catch (e) {}
      }
    }
    stingers.length = 0;
    glide(N.stinger.gain, 0, 0.015);
    N.stinger.gain.setTargetAtTime(1, t + 0.08, 0.01);
    stingerFree = 0;
    achFree = 0;
  }

  // ---------- музыка ----------
  const M = {
    t: 0, step: 0, bar: 0, sec: null, form: 0, nightK: 0, lastAc: 0, titleBar: 0, overTicksAt: Infinity, forceNext: false, crashNext: false,
    goodFrom: 0, goodUntil: 0, softUntil: 0, unplugged: false, mood: 0, drumsLvl: 1,
  };

  function isNight() {
    const m = G.clockMin();
    return m < 420 || m >= 1260;
  }
  function intensity() {
    const S = G.state, cfg = G.cfg;
    return G.clamp((S.speed - cfg.baseSpeed) / cfg.speedGain, 0, 1.3) || 0;
  }
  function bpm() {
    const mode = G.state.mode;
    if (mode === 'start') return 70;
    if (mode === 'over') return 60;
    return (84 + 30 * intensity()) * (1 - 0.14 * M.nightK);
  }
  const stepDur = () => 15 / G.clamp(bpm() || 90, 40, 200);

  function runStep(t, sd) {
    if (!M.sec) M.sec = makeSection('A');
    const sec = M.sec, s = M.step, bar = M.bar;
    const good = t >= M.goodFrom && t < M.goodUntil;
    const fever = G.flag('fever');
    const party = fever || good || G.flag('party') || !!(G.powerups && G.powerups.isActive && G.powerups.isActive('friday'));
    const night = M.nightK > 0.5 && !party, inten = party ? 1 : intensity();
    const deg = (good ? GOOD_PROG : sec.prog)[bar & 3];
    const groove = (sec.drums === 'day' && !night) || party;
    if (!M.unplugged) {
      const dp = DRUMS[night ? 'night' : groove && (bar & 1) ? 'day2' : sec.drums];
      const kc = dp[0][s], hc = dp[2][s];
      let sc = dp[1][s];
      if (groove && bar === sec.bars - 1 && s >= 12) sc = FILL[s - 12];
      if (party && (s & 3) === 0) kick(t, 1);
      else if (kc !== '.') kick(t, kc === 'K' ? 1 : 0.6);
      else if (groove && inten > 0.7 && s === 14 && Math.random() < 0.4) kick(t, 0.45);
      if (sc === 'r') rim(t, 1);
      else if (sc !== '.') snare(t, sc === 'S' ? 1 : 0.45);
      if (party && (s & 3) === 2) hat(t, 0.9, true);
      else if (hc !== '.') hat(t, hc === 'O' ? 0.9 : (s & 3) ? 0.6 : 0.85, hc === 'O');
      else if (groove && (s & 1) && inten > 0.4 && Math.random() < 0.3 + inten * 0.5) hat(t, 0.35, false);
      if (s === 0 && ((bar === 0 && groove && sec.type !== 'intro') || M.crashNext)) {
        crash(t);
        M.crashNext = false;
      }
      if (fever && (s & 3) === 3) rim(t, 0.7);
    }
    if (fever) {
      if ((s & 1) === 0) {
        const m = foldLead(deg2midi(deg + FEVER_ARP[(s >> 1) & 7], 65) + 12);
        track(blip(N.leadLP, WAVE.box, hz(m), 0, t, 0.003, 0.14, 0.045 * (s & 2 ? 0.7 : 1)));
      }
    } else if (good && (s & 1) === 0) {
      const m = foldLead(deg2midi(deg, 65) + GOOD_ARP[(s >> 1) & 7] + 12);
      track(blip(N.leadLP, 'triangle', hz(m), 0, t, 0.003, 0.16, 0.04 * (s & 2 ? 0.7 : 1)));
    }

    const bp = BASS[groove && inten > 0.65 && (bar & 1) ? 'busy' : sec.bass[bar & 1]];
    const bo = bp.o[s];
    if (bo !== REST) {
      const root = deg2midi(deg, 41);
      bassNote(t, fold(root, 38) + deg2midi(deg + bo, 41) - root, bp.n[s] * sd * 0.92, night ? 0.75 : 1);
    }

    const kp = KEYS[night ? 'hold' : sec.keys[bar & 1]];
    const kch = kp[s];
    if (kch !== '.') {
      let n = 1;
      while (s + n < 16 && kp[s + n] === '.') n++;
      chord(N.keysLP, t, deg, n * sd, kch === 'X' ? 1 : 0.65, kp === KEYS.hold, true);
    }

    const lead = night ? sec.nlead : sec.lead;
    const lp = good ? GOOD_LEAD[bar & 3] : lead ? lead[bar % lead.length] : null;
    if (lp) {
      const lo = lp.o[s];
      if (lo !== REST) {
        const m = foldLead(deg2midi(deg + lo, 65));
        if (!good && (night || sec.type === 'break')) track(boxNote(N.leadLP, t, m, 0.9, 1.1));
        else track(leadNote(N.leadLP, t, m, lp.n[s] * sd, 0.85 + Math.random() * 0.2));
      }
    }
  }

  function titleStep(t, sd) {
    const s = M.step, tb = M.titleBar & 7, deg = TITLE_PROG[tb & 3];
    if ((s & 3) === 0) clockTick(t, (s & 7) === 0, 1);
    if (s === 0) {
      chord(N.keysLP, t, deg, 16 * sd, 0.5, true, true);
      bassNote(t, fold(deg2midi(deg, 41), 38), 12 * sd, 0.35);
    }
    const name = TITLE_LEAD[tb];
    if (name) {
      const lo = LEAD[name].o[s];
      if (lo !== REST) track(boxNote(N.leadLP, t, foldLead(deg2midi(deg + lo, 65)), 0.8, 1.2));
    }
  }

  function overStep(t) {
    if (t >= M.overTicksAt && (M.step & 3) === 0) clockTick(t, (M.step & 7) === 0, 0.8);
  }

  function nextSection() {
    M.form = M.form + 1 >= FORM.length ? 1 : M.form + 1;
    M.sec = makeSection(FORM[M.form]);
    M.bar = 0;
    M.forceNext = false;
  }
  function barDone() {
    if (!M.sec) return;
    M.bar++;
    if (M.bar >= M.sec.bars || (M.forceNext && M.bar % 4 === 0)) nextSection();
    if (G.state.mode === 'run') {
      glide(N.tone.frequency, runCutoff(), 0.8);
      glide(N.leadRev.gain, G.lerp(0.22, 0.5, M.nightK), 1);
      glide(N.leadEcho.delayTime, 0.75 * 4 * stepDur(), 0.5);
    }
  }

  function tick() {
    if (!N || ac.state !== 'running') return;
    const now = ac.currentTime, mode = G.state.mode;
    const dt = G.clamp(now - M.lastAc, 0, 0.5);
    M.lastAc = now;
    updateRain();
    ambTick(now);
    moodTick(now);
    if (mode === 'run' || mode === 'pause') M.nightK += ((isNight() ? 1 : 0) - M.nightK) * Math.min(1, dt * 0.35);
    if (A.muted || !A.music) {
      M.t = now + 0.05;
      return;
    }
    if (!(M.t > now - 0.25)) M.t = now + 0.03;
    for (let guard = 0; guard < 48 && M.t < now + LOOKAHEAD; guard++) {
      const st = mode === 'start' ? 'title' : mode === 'over' ? 'over' : 'run';
      const sd = stepDur();
      if (st === 'run') runStep(M.t, sd);
      else if (st === 'title') titleStep(M.t, sd);
      else overStep(M.t);
      const sw = st === 'run' ? SWING : 0;
      M.t += sd * (M.step & 1 ? 1 - sw : 1 + sw);
      if (++M.step === 16) {
        M.step = 0;
        if (st === 'run') barDone();
        else M.titleBar++;
      }
    }
  }
  function tickSafe() {
    try { tick(); } catch (e) { G.report('audio tick', e); }
  }
  function moodTick(now) {
    const good = now >= M.goodFrom && now < M.goodUntil;
    const mood = good ? 2 : now < M.softUntil ? 1 : 0;
    const drums = mood === 1 ? 0.4 : 1;
    if (drums !== M.drumsLvl) {
      M.drumsLvl = drums;
      glide(N.drums.gain, drums, 0.3);
    }
    if (mood !== M.mood) {
      M.mood = mood;
      if (G.state.mode === 'run') glide(N.tone.frequency, runCutoff(), 0.35);
    }
  }
  function calmMusic() {
    M.goodFrom = M.goodUntil = M.softUntil = 0;
    M.unplugged = false;
  }


  // ---------- эмбиент локаций ----------
  const AMB_GAIN = 1;
  const AMB_BY_ID = { kitchen: 'fridge', metro: 'metro', office: 'office', baikal: 'meeting', roof: 'roof', bedroom: 'bedroom', dream: 'dream' };
  const AMB = { kind: null, bed: null, srcs: [], next: 0, next2: 0, railAt: -9 };
  function ambKind(id, name) {
    const k = AMB_BY_ID[String(id || '')];
    if (k) return k;
    const s = String(name || '');
    if (/кухн/i.test(s)) return 'fridge';
    if (/метро/i.test(s)) return 'metro';
    if (/офис|опенспейс/i.test(s)) return 'office';
    if (/перегов|байкал/i.test(s)) return 'meeting';
    if (/крыш/i.test(s)) return 'roof';
    if (/спальн|^дома$/i.test(s)) return 'bedroom';
    if (/^сон$|нора/i.test(s)) return 'dream';
    return null;
  }
  function loopNoise(dest, rate) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    if (rate) src.playbackRate.value = rate;
    src.connect(dest);
    src.start(ac.currentTime + 0.02);
    return src;
  }
  function lfo(f, depth, target) {
    const o = osc('sine', f, ac.currentTime), g = ac.createGain();
    g.gain.value = depth;
    o.connect(g);
    g.connect(target);
    o.start(ac.currentTime);
    o.__a = g;
    return o;
  }
  function ambVerb() {
    if (!N.ambVerb) {
      const v = ac.createConvolver();
      v.buffer = makeIR(2.6);
      v.connect(N.ambIn);
      N.ambVerb = v;
    }
    return N.ambVerb;
  }
  function startBed(kind) {
    const t = ac.currentTime, bed = ac.createGain(), srcs = [];
    bed.gain.setValueAtTime(0, t);
    bed.gain.setTargetAtTime(1, t, 0.4);
    bed.connect(N.ambIn);
    const g = (v, to) => {
      const n = ac.createGain();
      n.gain.value = v;
      n.connect(to || bed);
      return n;
    };
    const f = (type, fr, q, to) => {
      const b = ac.createBiquadFilter();
      b.type = type;
      b.frequency.value = fr;
      b.Q.value = q;
      b.connect(to);
      return b;
    };
    if (kind === 'fridge') {
      const hum = g(0.016);
      const a = osc('sine', 60, t), b = osc('triangle', 120, t);
      a.connect(hum);
      b.connect(g(0.25, hum));
      a.start(t);
      b.start(t);
      srcs.push(a, b, lfo(0.23, 0.004, hum.gain));
      srcs.push(loopNoise(f('lowpass', 180, 0.5, g(0.012)), 0.7));
    } else if (kind === 'metro') {
      const lp = f('lowpass', 300, 0.5, f('lowpass', 220, 0.4, g(0.06)));
      srcs.push(loopNoise(lp, 0.6));
    } else if (kind === 'office' || kind === 'meeting') {
      srcs.push(loopNoise(f('lowpass', 520, 0.4, g(kind === 'office' ? 0.008 : 0.006)), 0.8));
    } else if (kind === 'roof') {
      const wind = g(0.03);
      const bp = f('bandpass', 650, 1.1, wind);
      srcs.push(loopNoise(bp, 1), lfo(0.2, 260, bp.frequency), lfo(0.13, 0.012, wind.gain));
    } else if (kind === 'dream') {
      const pad = g(0.011), lp = f('lowpass', 900, 0.5, pad);
      pad.connect(ambVerb());
      for (const m of [53, 60, 64, 69]) {
        const o = osc('triangle', hz(m), t);
        o.detune.setValueAtTime((Math.random() - 0.5) * 12, t);
        o.connect(lp);
        o.start(t);
        srcs.push(o, lfo(0.07 + Math.random() * 0.05, 7, o.detune));
      }
    }
    return { bed, srcs };
  }
  function stopBed(b) {
    if (!b) return;
    const t = ac.currentTime;
    glide(b.bed.gain, 0, 0.4);
    for (let i = 0; i < b.srcs.length; i++) own(b.srcs[i], t + 2.2, b.srcs[i].__a, i === 0 ? b.bed : null);
    if (!b.srcs.length) b.bed.disconnect();
  }
  function setAmbient(kind) {
    if (!N || kind === AMB.kind) return;
    stopBed(AMB.bed);
    AMB.bed = null;
    AMB.kind = kind;
    AMB.next = ac.currentTime + 0.6 + Math.random();
    AMB.next2 = AMB.next + 1.5;
    if (kind) AMB.bed = startBed(kind);
  }
  function key(t, v) {
    noise(N.ambIn, t, 0.0008, 0.012, 0.012 * v, 'highpass', 1800 + Math.random() * 1800, 0, 0.8);
  }
  function syllable(t, len) {
    const f0 = 110 + Math.random() * 60;
    const o = osc('sawtooth', f0, t), lp = ac.createBiquadFilter(), g = ac.createGain();
    o.frequency.linearRampToValueAtTime(f0 * (0.85 + Math.random() * 0.3), t + len);
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    lp.Q.value = 0.7;
    const p = g.gain;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(0.02, t + 0.025);
    p.setValueAtTime(0.02, t + len * 0.7);
    p.linearRampToValueAtTime(0, t + len);
    o.connect(lp);
    lp.connect(g);
    g.connect(N.ambIn);
    o.start(t);
    own(o, t + len + 0.02, lp, g);
  }
  function coo(t) {
    for (let i = 0; i < 2; i++) {
      const s = t + i * 0.42, d = i ? 0.22 : 0.34;
      const o = osc('sine', 400, s), vib = osc('sine', 9, s), dg = ac.createGain(), g = ac.createGain();
      o.frequency.exponentialRampToValueAtTime(330, s + d);
      dg.gain.value = 14;
      vib.connect(dg);
      dg.connect(o.frequency);
      env(g.gain, s, 0.05, 0.022, d);
      o.connect(g);
      g.connect(N.ambIn);
      o.start(s);
      vib.start(s);
      own(o, s + d + 0.1, g);
      own(vib, s + d + 0.1, dg);
    }
  }
  function cricket(t) {
    for (let i = 0; i < 3; i++) blip(N.ambIn, 'sine', 4400 + Math.random() * 200, 0, t + i * 0.05, 0.004, 0.025, 0.006);
  }
  function laugh(t) {
    const n = 5 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) noise(N.ambIn, t + i * 0.13, 0.015, 0.08, 0.026 * (1 - i / (n + 2)), 'bandpass', 800 + Math.random() * 300, 0, 1.3);
  }
  function rail(t) {
    for (let i = 0; i < 2; i++) {
      noise(N.ambIn, t + i * 0.11, 0.002, 0.06, 0.07, 'lowpass', 300, 120, 0.7);
      blip(N.ambIn, 'sine', 75, 48, t + i * 0.11, 0.002, 0.07, 0.06, 0.06);
    }
  }
  function ambTick(now) {
    const kind = AMB.kind, mode = G.state.mode;
    if (!kind || A.muted || mode !== 'run') return;
    const end = now + LOOKAHEAD;
    if (kind === 'office') {
      while (AMB.next < end) {
        const n = 6 + ((Math.random() * 9) | 0), rate = 8 + Math.random() * 6;
        let tt = Math.max(AMB.next, now);
        for (let i = 0; i < n; i++) {
          key(tt, 0.6 + Math.random() * 0.6);
          tt += (0.6 + Math.random() * 0.8) / rate;
        }
        AMB.next = tt + 0.4 + Math.random() * 1.6;
      }
    } else if (kind === 'meeting') {
      while (AMB.next < end) {
        let tt = Math.max(AMB.next, now);
        const n = 3 + ((Math.random() * 4) | 0);
        for (let i = 0; i < n; i++) {
          const len = 0.1 + Math.random() * 0.09;
          syllable(tt, len);
          tt += len + 0.03 + Math.random() * 0.06;
        }
        AMB.next = tt + 0.5 + Math.random();
      }
    } else if (kind === 'roof') {
      if (AMB.next < end) {
        coo(Math.max(AMB.next, now));
        AMB.next = Math.max(AMB.next, now) + 4 + Math.random() * 5;
      }
    } else if (kind === 'bedroom') {
      if (AMB.next < end) {
        cricket(Math.max(AMB.next, now));
        AMB.next = Math.max(AMB.next, now) + 0.7 + Math.random() * 0.7;
      }
      if (AMB.next2 < end) {
        laugh(Math.max(AMB.next2, now));
        AMB.next2 = Math.max(AMB.next2, now) + 7 + Math.random() * 6;
      }
    } else if (kind === 'metro') {
      if (now - AMB.railAt > 2 && AMB.next < end) {
        rail(Math.max(AMB.next, now));
        AMB.next = Math.max(AMB.next, now) + 0.55 * 400 / Math.max(200, G.state.speed || 300);
      }
    } else if (kind === 'dream') {
      if (AMB.next < end) {
        bellStrike(N.ambIn, Math.max(AMB.next, now), hz(77 + PENTA[(Math.random() * 5) | 0]), 0.22, 1.6);
        AMB.next = Math.max(AMB.next, now) + 2 + Math.random() * 2.5;
      }
    }
  }
  function thunder(t, power) {
    const p = G.clamp(Number(power) || 0.5, 0, 1);
    const len = 1.6 + p * 1.2;
    noise(N.sfxIn, t, 0.03, len, 0.07 + 0.09 * p, 'lowpass', 700 + p * 600, 90, 0.6, 0.6);
    blip(N.sfxIn, 'sine', 70, 38, t + 0.05, 0.05, len * 0.8, 0.06 + 0.08 * p, len * 0.7);
    if (p > 0.6) noise(N.sfxIn, t, 0.001, 0.09, 0.08, 'highpass', 2500, 900, 0.7);
  }

  // ---------- SFX ----------
  const lastAt = Object.create(null);
  function at(name, gap) {
    if (!N || !unlocked || A.muted) return -1;
    const t = ac.currentTime, prev = lastAt[name];
    if (prev !== undefined && t - prev < gap) return -1;
    lastAt[name] = t;
    return t + 0.008;
  }

  const kinds = Object.create(null);
  function kindOf(type) {
    const id = String(type || '');
    let k = kinds[id];
    if (!k) {
      const def = G.obstacleTypes[id];
      k = def && typeof def.sound === 'string' ? def.sound
        : /clock|alarm|будил/i.test(id) ? 'clock'
        : /call|zoom|phone|meet|созвон/i.test(id) ? 'call'
        : /task|paper|doc|jira|ticket|stack|таск/i.test(id) ? 'tasks'
        : /ping|slack|chat|msg|message|notif/i.test(id) ? 'ping'
        : /laptop|notebook|ноут|computer/i.test(id) ? 'laptop'
        : /deadline|дедлайн/i.test(id) ? 'deadline'
        : /minute|boss|manager|минут/i.test(id) ? 'minute'
        : 'other';
      kinds[id] = k;
    }
    return k;
  }
  const isShield = (id) => /shield|щит|bubble|sick/i.test(id);

  function alarm(dest, t, dur, v, extra) {
    const ga = ac.createGain(), gb = ac.createGain();
    const oa = osc('triangle', 1870, t), ob = osc('triangle', 2230, t);
    const pa = ga.gain, pb = gb.gain;
    pa.setValueAtTime(0, t);
    pb.setValueAtTime(0, t);
    const n = Math.max(2, Math.round(dur / 0.045));
    for (let i = 0; i < n; i++) {
      const ti = t + i * 0.045, amp = 0.13 * v * (1 - 0.55 * i / n), p = i & 1 ? pb : pa;
      p.setValueAtTime(amp, ti);
      p.exponentialRampToValueAtTime(amp * 0.2, ti + 0.042);
    }
    const end = t + n * 0.045;
    pa.setTargetAtTime(0, end, 0.04);
    pb.setTargetAtTime(0, end, 0.04);
    oa.connect(ga);
    ob.connect(gb);
    ga.connect(dest);
    gb.connect(dest);
    oa.start(t);
    ob.start(t);
    own(oa, end + 0.25, ga, extra);
    own(ob, end + 0.25, gb);
    return end - t;
  }
  function hangup(t, beeps) {
    noise(N.sfxIn, t, 0.001, 0.035, 0.14, 'lowpass', 2200, 700, 0.7);
    const t0 = t + 0.12, end = t0 + beeps * 0.3;
    const o = osc('sine', 425, t0), q = osc('square', 425, t0);
    const g = ac.createGain(), gs = ac.createGain(), p = g.gain;
    gs.gain.value = 0.12;
    p.setValueAtTime(0, t0);
    for (let i = 0; i < beeps; i++) {
      const s = t0 + i * 0.3;
      p.setValueAtTime(0, s);
      p.linearRampToValueAtTime(0.13, s + 0.008);
      p.setValueAtTime(0.13, s + 0.17);
      p.linearRampToValueAtTime(0, s + 0.178);
    }
    o.connect(g);
    q.connect(gs);
    gs.connect(g);
    g.connect(N.sfxIn);
    o.start(t0);
    q.start(t0);
    own(o, end, g);
    own(q, end, gs, g);
    return end - t;
  }
  function paper(t, dur, n, v) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = 'bandpass';
    f.Q.value = 1.3;
    const p = g.gain, fq = f.frequency;
    p.setValueAtTime(0, t);
    let tt = t;
    for (let i = 0; i < n; i++) {
      const len = 0.02 + Math.random() * 0.05;
      fq.setValueAtTime(1500 + Math.random() * 4000, tt);
      p.setValueAtTime(0, tt);
      p.linearRampToValueAtTime((0.06 + Math.random() * 0.12) * v, tt + 0.004);
      p.exponentialRampToValueAtTime(FLOOR, tt + len);
      tt += len + Math.random() * (dur / n) * 0.7;
    }
    s.connect(f);
    f.connect(g);
    g.connect(N.sfxIn);
    s.start(t, Math.random() * 0.5);
    own(s, tt + 0.02, f, g);
    return tt - t;
  }
  function boom(t) {
    blip(N.sfxIn, 'sine', 170, 36, t, 0.003, 0.5, 0.42, 0.35);
    noise(N.sfxIn, t, 0.003, 0.45, 0.3, 'lowpass', 4200, 160, 0.9);
    blip(N.sfxIn, 'square', 320, 70, t, 0.002, 0.16, 0.06, 0.14);
    return 0.5;
  }

  const SAD_TROMBONE = [67, 66, 65, 64];
  const SAD_BOX = [77, 73, 70];
  const SAD_IV = [58, 61, 65, 67];
  const SAD_I = [57, 60, 65];
  const RECORD_UP = [72, 76, 79, 84];
  const FANFARE = [67, 72, 76, 79];
  const RECORD_RUN = [72, 76, 79, 84, 88, 91];
  const POWER_UP = [60, 64, 67, 72, 76];
  const COFFEE_UP = [77, 81, 84, 89];
  const CARROT_NOTES = [72, 74, 77, 79, 81, 84, 86, 89, 91, 93];
  const GOLD_ARP = [0, 4, 7, 11, 12, 16, 19];
  const PENTA = [0, 2, 4, 7, 9];
  const PENTA_UP = [0, 2, 4, 7, 9, 12, 14, 16];
  const BOOT = [53, 60, 65, 69, 72];
  const FEVER_UP = [65, 69, 72, 77, 81, 84, 89];
  const FEVER_DOWN = [84, 79, 76, 72];
  const RELIEF = [72, 76, 79, 84];
  const GRADE = [72, 76, 79];
  const BOSS_WIN = [65, 69, 72, 77];

  function notify(dest, t, v) {
    blip(dest, 'triangle', hz(88), 0, t, 0.002, 0.16, 0.07 * v);
    return blip(dest, 'triangle', hz(93), 0, t + 0.08, 0.002, 0.28, 0.07 * v);
  }

  function jingleSad(t) {
    if (Math.random() < 0.4) {
      for (let i = 0; i < 4; i++) {
        const last = i === 3;
        stg(brass(N.stinger, t + i * 0.26, hz(SAD_TROMBONE[i]), last ? 0.8 : 0.2, 0.8, 380, 1200, last ? 5.5 : 0));
      }
      return 1.9;
    }
    for (let i = 0; i < 3; i++) stg(boxNote(N.stinger, t + i * 0.2, SAD_BOX[i], 0.9, 0.9));
    for (let i = 0; i < SAD_IV.length; i++) stg(keyNote(N.stinger, t + 0.45, SAD_IV[i], 0.9, 0.5, true));
    for (let i = 0; i < SAD_I.length; i++) stg(keyNote(N.stinger, t + 1.25, SAD_I[i], 1.2, 0.45, true));
    stg(boxNote(N.stinger, t + 1.25, 69, 0.8, 1.4));
    return 2.4;
  }
  function jingleRecord(t) {
    for (let i = 0; i < 4; i++) {
      const last = i === 3;
      stg(brass(N.stinger, t + i * 0.11, hz(RECORD_UP[i]), last ? 0.7 : 0.09, 0.85, 700, 2800, last ? 5 : 0));
    }
    stg(brass(N.stinger, t + 0.33, hz(76), 0.7, 0.5, 700, 2400, 0));
    stg(brass(N.stinger, t + 0.33, hz(79), 0.7, 0.45, 700, 2400, 0));
    bellStrike(N.bell, t + 0.33, hz(96), 0.8, 1.2);
    return 1.4;
  }

  function jumpNote(n) {
    if (!A.music || !M.sec || G.state.mode !== 'run') return 0;
    const deg = M.sec.prog[M.bar & 3] + (n <= 1 ? 0 : n === 2 ? 2 : 4);
    const lo = n <= 1 ? 70 : 81;
    return fold(deg2midi(deg, 53), lo) + (n <= 1 && G.bunny.alt > 90 ? 12 : 0);
  }

  let chain = 0, chainT = -9, recordArmed = false, powerupT = -1, smashT = -9;
  let pendingHit = null, pendingInv = false, meterTenth = 0, stepAcc = 0, pulseAcc = 0;

  const sfx = (G.sfx = {
    jump(n = 1) {
      const t = at(n > 1 ? 'djump' : 'jump', 0.03);
      if (t < 0) return;
      const key = jumpNote(n);
      const k = key ? 1 : 1 + (Math.random() - 0.5) * 0.06;
      if (n <= 1) {
        const top = key ? hz(key) : 640 * k;
        blip(N.sfxIn, 'sine', top * 0.47, top, t, 0.006, 0.13, 0.22, 0.1);
        blip(N.sfxIn, 'triangle', top * 0.94, top * 2, t, 0.004, 0.06, 0.05, 0.06);
        noise(N.sfxIn, t, 0.004, 0.05, 0.04, 'bandpass', 1200, 2600, 0.8);
        return;
      }
      const top = key ? hz(key) : 1180 * k * (1 + 0.12 * Math.min(4, n - 2));
      blip(N.sfxIn, 'triangle', top * 0.475, top, t, 0.004, 0.12, 0.13, 0.09);
      blip(N.bell, 'sine', top * 0.95, top * 1.9, t + 0.03, 0.004, 0.1, 0.05, 0.07);
      noise(N.sfxIn, t, 0.01, 0.12, 0.06, 'bandpass', 1800, 5000, 1.2);
    },
    djump() { sfx.jump(2); },
    land(impact = 600) {
      if (!(impact > 300)) return;
      const t = at('land', 0.08);
      if (t < 0) return;
      const v = G.clamp((impact - 300) / 900, 0, 1);
      blip(N.sfxIn, 'sine', 120, 52, t, 0.003, 0.11 + 0.05 * v, 0.16 + 0.24 * v, 0.08);
      noise(N.sfxIn, t, 0.003, 0.08, 0.05 + 0.08 * v, 'lowpass', 900, 300, 0.7);
    },
    carrot() {
      const t = at('carrot', 0.03);
      if (t < 0) return;
      chain = t - chainT < 1.8 ? Math.min(chain + 1, CARROT_NOTES.length - 1) : 0;
      chainT = t;
      const m = CARROT_NOTES[chain];
      blip(N.sfxIn, 'triangle', hz(m), 0, t, 0.003, 0.16, 0.1);
      blip(N.sfxIn, 'square', hz(m), 0, t, 0.003, 0.05, 0.022);
      blip(N.bell, 'triangle', hz(m + 7), 0, t + 0.06, 0.003, 0.22, 0.08);
      blip(N.sfxIn, 'square', hz(m + 7), 0, t + 0.06, 0.003, 0.06, 0.018);
    },
    golden() {
      const t = at('golden', 0.05);
      if (t < 0) return;
      chain = Math.min(chain + 2, CARROT_NOTES.length - 1);
      chainT = t;
      for (let i = 0; i < GOLD_ARP.length; i++) blip(N.bell, 'triangle', hz(77 + GOLD_ARP[i]), 0, t + i * 0.04, 0.003, 0.25, 0.07);
      blip(N.bell, 'sine', hz(101), 0, t + 0.3, 0.004, 0.8, 0.05);
      noise(N.bell, t + 0.05, 0.05, 0.5, 0.03, 'highpass', 6000, 9000, 0.7);
      duck(0.7, 0.4);
    },
    pick() {
      const t = at('pick', 0.05);
      if (t < 0) return;
      blip(N.sfxIn, 'sine', 420, 900, t, 0.004, 0.09, 0.14, 0.06);
    },
    coffee() {
      const t = at('coffee', 0.2);
      if (t < 0) return;
      for (let i = 0; i < 2; i++) {
        const s = t + i * 0.16;
        blip(N.sfxIn, 'sine', 170, 430, s, 0.01, 0.09, 0.22, 0.07);
        noise(N.sfxIn, s, 0.01, 0.06, 0.05, 'lowpass', 700, 300, 1.5);
      }
      noise(N.sfxIn, t + 0.32, 0.08, 0.35, 0.04, 'bandpass', 900, 2600, 1.2);
      for (let i = 0; i < COFFEE_UP.length; i++) blip(N.bell, WAVE.lead, hz(COFFEE_UP[i]), 0, t + 0.36 + i * 0.05, 0.004, 0.14, 0.06);
    },
    shield() {
      const t = at('shield', 0.2);
      if (t < 0) return;
      noise(N.sfxIn, t, 0.12, 0.3, 0.13, 'bandpass', 400, 3800, 2.2);
      blip(N.sfxIn, 'sine', 110, 220, t, 0.05, 0.4, 0.1, 0.3);
      blip(N.bell, 'sine', 523, 1046, t + 0.05, 0.08, 0.5, 0.06, 0.3);
      blip(N.bell, 'triangle', 784, 1568, t + 0.08, 0.08, 0.5, 0.035, 0.3);
    },
    shieldPop() {
      const t = at('shieldPop', 0.25);
      if (t < 0) return;
      noise(N.sfxIn, t, 0.001, 0.07, 0.22, 'highpass', 2500, 1500, 0.7);
      blip(N.sfxIn, 'sine', 1100, 180, t, 0.002, 0.12, 0.2, 0.1);
      for (let i = 0; i < 4; i++) blip(N.bell, 'sine', 2800 + Math.random() * 2400, 0, t + 0.02 + i * 0.035, 0.002, 0.12, 0.035);
    },
    slow() {
      const t = at('slow', 0.2);
      if (t < 0) return;
      blip(N.sfxIn, 'sine', 1200, 240, t, 0.01, 0.5, 0.12, 0.45);
      noise(N.sfxIn, t, 0.02, 0.5, 0.08, 'lowpass', 3000, 300, 1);
      bellStrike(N.bell, t + 0.1, hz(60), 0.8, 1.2);
    },
    magnet() {
      const t = at('magnet', 0.2);
      if (t < 0) return;
      for (let i = 0; i < 3; i++) blip(N.sfxIn, 'triangle', 300 + i * 120, 900 + i * 240, t + i * 0.08, 0.01, 0.12, 0.08, 0.1);
      blip(N.bell, 'sine', hz(84), 0, t + 0.26, 0.004, 0.4, 0.05);
    },
    power() {
      const t = at('power', 0.15);
      if (t < 0) return;
      for (let i = 0; i < POWER_UP.length; i++) blip(N.sfxIn, WAVE.lead, hz(POWER_UP[i] + 12), 0, t + i * 0.045, 0.004, 0.14, 0.07);
    },
    powerDown() {
      const t = at('powerDown', 0.2);
      if (t < 0) return;
      blip(N.sfxIn, WAVE.lead, hz(79), hz(77), t, 0.005, 0.12, 0.05, 0.1);
      blip(N.sfxIn, WAVE.lead, hz(72), hz(70), t + 0.1, 0.005, 0.2, 0.05, 0.18);
    },
    near() {
      const t = at('near', 0.08);
      if (t < 0) return;
      const pan = panner(N.sfxIn, 0.55, -0.55, t, 0.14);
      const dest = pan || N.sfxIn;
      const v = noise(dest, t, 0.015, 0.11, 0.2, 'bandpass', 1400, 5200, 1.6);
      blip(dest, 'sine', 1500, 2600, t, 0.01, 0.08, 0.035, 0.09);
      if (pan) v.__c = pan;
    },
    smash(type) {
      const t = at('smash', 0.05);
      if (t < 0) return;
      noise(N.sfxIn, t, 0.002, 0.2, 0.26, 'lowpass', 3500, 300, 0.8);
      blip(N.sfxIn, 'square', 240, 70, t, 0.002, 0.12, 0.06, 0.1);
      blip(N.sfxIn, 'sine', 140, 50, t, 0.002, 0.14, 0.25, 0.1);
      const k = kindOf(type);
      if (k === 'clock') blip(N.bell, 'triangle', 2093, 2080, t + 0.02, 0.002, 0.3, 0.05);
      else if (k === 'tasks') paper(t + 0.03, 0.18, 4, 0.5);
      else if (k === 'call') blip(N.sfxIn, 'sine', 950, 900, t + 0.04, 0.005, 0.12, 0.06);
    },
    die(type) {
      const t = at('die', 0.3);
      if (t < 0) return 0.6;
      blip(N.sfxIn, 'sine', 150, 45, t, 0.003, 0.22, 0.32, 0.18);
      if (ktsOn() && type === 'vacuum') return vacuumCrash(t);
      if (ktsOn() && type === 'voice') return voiceCrash(t);
      const k = kindOf(type);
      if (k !== 'clock' && k !== 'call' && k !== 'tasks' && k !== 'other') noise(N.sfxIn, t, 0.003, 0.25, 0.2, 'lowpass', 3500, 200, 0.9);
      if (k === 'clock') return alarm(N.sfxIn, t + 0.03, 0.95, 1) + 0.15;
      if (k === 'call') return hangup(t + 0.02, 3);
      if (k === 'tasks') {
        blip(N.sfxIn, 'sine', 95, 45, t + 0.04, 0.004, 0.2, 0.3, 0.15);
        return paper(t, 0.5, 9, 1);
      }
      if (k === 'ping') {
        notify(N.sfxIn, t + 0.02, 1.4);
        notify(N.sfxIn, t + 0.3, 1);
        return 0.7;
      }
      if (k === 'laptop') {
        for (let i = 0; i < BOOT.length; i++) keyNote(N.sfxIn, t + 0.06 + i * 0.006, BOOT[i], 1.1, 1.5, false);
        return 1.3;
      }
      if (k === 'deadline') {
        brass(N.sfxIn, t + 0.02, hz(55), 0.13, 0.9, 400, 1500, 0);
        brass(N.sfxIn, t + 0.22, hz(56), 0.13, 0.9, 400, 1500, 0);
        brass(N.sfxIn, t + 0.44, hz(52), 0.85, 1, 400, 1700, 5);
        blip(N.sfxIn, 'sine', 82, 41, t + 0.44, 0.01, 0.9, 0.3, 0.8);
        return 1.35;
      }
      if (k === 'minute') {
        for (let i = 0; i < 5; i++) brass(N.sfxIn, t + 0.04 + i * 0.15, hz(57 + ((Math.random() * 6) | 0)), 0.1, 0.8, 280, 1300, 0);
        return 0.85;
      }
      return boom(t);
    },
    ring() { return sfx.die('clock'); },
    clockRing() {
      const t = at('clockRing', 0.5);
      if (t < 0) return;
      const pan = panner(N.sfxIn, 0.45, 0.2, t, 0.25);
      alarm(pan || N.sfxIn, t, 0.22, 0.3, pan);
    },
    telegraph(type, phase) {
      const t = at('telegraph', 0.12);
      if (t < 0) return;
      if (phase === 'lock') {
        noise(N.sfxIn, t, 0.001, 0.012, 0.08, 'highpass', 3000, 3000, 0.7);
        blip(N.sfxIn, 'sine', 1300, 900, t, 0.001, 0.03, 0.05, 0.03);
        return;
      }
      const k = kindOf(type);
      if (k === 'ping') {
        const pan = panner(N.sfxIn, 0.55, 0.4, t, 0.3);
        notify(pan || N.sfxIn, t, 0.6).__c = pan;
      } else if (k === 'laptop') {
        blip(N.sfxIn, 'sine', 520, 780, t, 0.004, 0.12, 0.06, 0.08);
        noise(N.sfxIn, t, 0.08, 0.25, 0.025, 'bandpass', 600, 1400, 0.8);
      } else if (k === 'deadline') {
        brass(N.sfxIn, t, hz(43), 0.35, 0.55, 250, 700, 0);
        blip(N.sfxIn, 'sine', 70, 55, t, 0.01, 0.45, 0.14, 0.4);
      } else if (k === 'minute') {
        blip(N.sfxIn, 'triangle', 200, 200, t, 0.01, 0.07, 0.06);
        blip(N.sfxIn, 'triangle', 210, 330, t + 0.11, 0.01, 0.15, 0.06, 0.13);
      } else {
        blip(N.sfxIn, 'triangle', 1320, 1320, t, 0.002, 0.05, 0.04);
      }
    },
    cancel() {
      const t = at('cancel', 0.3);
      if (t < 0) return;
      blip(N.sfxIn, 'sine', 180, 60, t, 0.002, 0.16, 0.35, 0.1);
      noise(N.sfxIn, t, 0.001, 0.08, 0.2, 'lowpass', 3000, 500, 0.8);
      hangup(t + 0.12, 2);
    },
    friday() {
      const t = at('friday', 0.3);
      if (t < 0) return;
      noise(N.sfxIn, t, 0.005, 0.9, 0.07, 'highpass', 5000, 7000, 0.7);
      for (let i = 0; i < PENTA_UP.length; i++) blip(N.bell, WAVE.lead, hz(65 + PENTA_UP[i]), 0, t + i * 0.03, 0.003, 0.15, 0.055);
      blip(N.sfxIn, 'sine', 500, 1100, t + 0.25, 0.08, 0.4, 0.05, 0.4);
      duck(0.7, 0.5);
    },
    feather() {
      const t = at('feather', 0.2);
      if (t < 0) return;
      noise(N.sfxIn, t, 0.08, 0.35, 0.07, 'bandpass', 800, 4000, 1.5);
      for (let i = 0; i < 6; i++) blip(N.bell, 'triangle', hz(72 + PENTA_UP[i]), 0, t + 0.05 + i * 0.04, 0.003, 0.3, 0.05);
    },
    milestone() {
      const t = at('milestone', 0.5);
      if (t < 0) return;
      bellStrike(N.bell, t, hz(79), 1, 1.4);
      bellStrike(N.bell, t + 0.17, hz(84), 0.9, 1.7);
      duck(0.65, 1);
    },
    achievement(kind) {
      if (!N || !unlocked || A.muted) return;
      const over = G.state.mode === 'over', now = ac.currentTime + 0.01;
      const t = over ? Math.max(now, stingerFree + 0.15) : Math.max(now, achFree);
      const dest = over ? N.stinger : N.sfxIn;
      const keep = over ? stg : noop;
      if (kind === 'skin') {
        for (let i = 0; i < 5; i++) keep(blip(over ? dest : N.bell, 'triangle', hz(79 + PENTA_UP[i]), 0, t + i * 0.05, 0.003, 0.35, 0.06));
        if (over) stingerFree = t + 0.5;
        else achFree = t + 0.5;
        return;
      }
      for (let i = 0; i < 4; i++) {
        const last = i === 3;
        keep(brass(dest, t + i * 0.09, hz(FANFARE[i]), last ? 0.5 : 0.08, 0.8, 600, 2600, last ? 5 : 0));
      }
      keep(brass(dest, t + 0.27, hz(72), 0.5, 0.45, 600, 2200, 0));
      keep(brass(dest, t + 0.27, hz(76), 0.5, 0.4, 600, 2200, 0));
      noise(N.bell, t + 0.27, 0.03, 0.5, 0.03, 'highpass', 6500, 9000, 0.7);
      if (over) stingerFree = t + 0.9;
      else {
        achFree = t + 0.9;
        duck(0.5, t - ac.currentTime + 0.8);
      }
    },
    record() {
      const t = at('record', 1);
      if (t < 0) return;
      for (let i = 0; i < RECORD_RUN.length; i++) blip(N.bell, WAVE.lead, hz(RECORD_RUN[i]), 0, t + i * 0.045, 0.004, 0.2, 0.06);
      bellStrike(N.bell, t + 0.28, hz(96), 1, 1.2);
      noise(N.bell, t + 0.25, 0.05, 0.6, 0.035, 'highpass', 7000, 9000, 0.7);
      duck(0.55, 0.9);
    },
    combo(c) {
      const count = (c && c.count) | 0;
      if (count < 2) return;
      const t = at('combo', 0.06);
      if (t < 0) return;
      const n = Math.min(9, count - 2);
      blip(N.sfxIn, 'triangle', hz(76 + PENTA[n % 5] + 12 * Math.floor(n / 5)), 0, t, 0.003, 0.1, 0.05);
    },
    buzz() {
      const t = at('buzz', 2.5);
      if (t < 0) return;
      const pan = panner(N.sfxIn, 0.7, 0.45, t, 0.6);
      const o = osc('sawtooth', 145, t), f = ac.createBiquadFilter(), g = ac.createGain(), p = g.gain;
      f.type = 'lowpass';
      f.frequency.value = 420;
      p.setValueAtTime(0, t);
      for (let i = 0; i < 2; i++) {
        const s = t + i * 0.33;
        p.setValueAtTime(0, s);
        p.linearRampToValueAtTime(0.07, s + 0.01);
        p.setValueAtTime(0.07, s + 0.22);
        p.linearRampToValueAtTime(0, s + 0.23);
      }
      o.connect(f);
      f.connect(g);
      g.connect(pan || N.sfxIn);
      o.start(t);
      own(o, t + 0.6, f, g, pan);
    },
    ding() {
      const t = at('ding', 0.2);
      if (t < 0) return;
      bellStrike(N.bell, t, hz(91), 0.9, 0.9);
    },
    kickoff() {
      const t = at('kickoff', 0.3);
      if (t < 0) return;
      blip(N.sfxIn, 'sine', 210, 60, t, 0.002, 0.14, 0.3, 0.1);
      noise(N.sfxIn, t, 0.002, 0.06, 0.1, 'lowpass', 2500, 600, 0.7);
      alarm(N.sfxIn, t + 0.04, 0.32, 0.6);
      blip(N.sfxIn, 'triangle', 300, 900, t + 0.05, 0.02, 0.25, 0.05, 0.25);
    },
    restart() {
      const t = at('restart', 0.3);
      if (t < 0) return;
      noise(N.sfxIn, t, 0.04, 0.18, 0.08, 'bandpass', 500, 3200, 1.2);
      blip(N.sfxIn, 'triangle', hz(65), hz(77), t, 0.01, 0.16, 0.08, 0.1);
    },
    pause() {
      const t = at('pause', 0.1);
      if (t < 0) return;
      blip(N.sfxIn, 'triangle', 660, 440, t, 0.004, 0.12, 0.07, 0.1);
    },
    resume() {
      const t = at('resume', 0.1);
      if (t < 0) return;
      blip(N.sfxIn, 'triangle', 440, 660, t, 0.004, 0.12, 0.07, 0.1);
    },
    unmute() {
      const t = at('unmute', 0.1);
      if (t < 0) return;
      blip(N.sfxIn, 'sine', 880, 0, t, 0.004, 0.1, 0.06);
    },
    stomp(n = 1, meme = false) {
      const t = at('stomp', 0.03);
      if (t < 0) return;
      const up = Math.min(12, Math.max(0, (n | 0) - 1));
      noise(N.sfxIn, t, 0.0008, 0.02, 0.2, 'highpass', 2600, 2600, 0.8);
      blip(N.sfxIn, 'square', 1700, 1150, t, 0.001, 0.025, 0.045, 0.02);
      blip(N.sfxIn, 'sine', 190, 70, t, 0.002, 0.09, 0.2, 0.07);
      const m = 81 + up;
      blip(N.sfxIn, 'triangle', hz(m), 0, t + 0.018, 0.002, 0.2, 0.05);
      blip(N.sfxIn, 'sine', hz(m) * 2.76, 0, t + 0.018, 0.002, 0.08, 0.016);
      if (meme) alarm(N.bell, t + 0.07, 0.34, 0.35);
    },
    snooze(n = 1) {
      const t = at('snooze', 0.2);
      if (t < 0) return;
      yawn(N.sfxIn, t, n >= 3 ? 1 : 0.8);
      if (n < 4) return;
      for (let i = 0; i < 4; i++) {
        const last = i === 3;
        brass(N.sfxIn, t + 0.5 + i * 0.12, hz(FANFARE[i] - 12), last ? 0.6 : 0.1, 0.7, 500, 2000, last ? 5 : 0);
      }
      duck(0.6, 1.2);
    },
    meterTick(level) {
      const t = at('meterTick', 0.25);
      if (t < 0) return;
      const i = G.clamp(level | 0, 1, 9);
      blip(N.sfxIn, 'triangle', hz(79 + PENTA[i % 5] + 12 * Math.floor(i / 5)), 0, t, 0.002, 0.05, 0.028);
    },
    fever() {
      const t = at('fever', 0.5);
      if (t < 0) return;
      noise(N.sfxIn, t, 0.25, 0.15, 0.07, 'bandpass', 500, 5200, 1.4);
      for (let i = 0; i < FEVER_UP.length; i++) blip(N.bell, WAVE.lead, hz(FEVER_UP[i]), 0, t + 0.12 + i * 0.035, 0.004, 0.2, 0.06);
      for (let i = 0; i < 3; i++) keyNote(N.sfxIn, t + 0.33, FEVER_UP[i + 1] - 12, 0.5, 1.4, true);
      blip(N.sfxIn, 'sine', 90, 45, t + 0.33, 0.004, 0.35, 0.22, 0.3);
      duck(0.55, 0.7);
      M.crashNext = true;
    },
    feverEnd() {
      const t = at('feverEnd', 0.5);
      if (t < 0) return;
      for (let i = 0; i < FEVER_DOWN.length; i++) blip(N.sfxIn, WAVE.lead, hz(FEVER_DOWN[i]), hz(FEVER_DOWN[i] - 1), t + i * 0.07, 0.004, 0.16, 0.05, 0.14);
      noise(N.sfxIn, t, 0.05, 0.4, 0.04, 'lowpass', 4000, 400, 0.9);
    },
    boing() {
      const t = at('boing', 0.06);
      if (t < 0) return;
      const o = osc('sine', 150, t), lfo = osc('sine', 26, t), depth = ac.createGain(), g = ac.createGain();
      o.frequency.exponentialRampToValueAtTime(520, t + 0.09);
      o.frequency.exponentialRampToValueAtTime(380, t + 0.3);
      depth.gain.setValueAtTime(70, t);
      depth.gain.exponentialRampToValueAtTime(4, t + 0.3);
      env(g.gain, t, 0.004, 0.2, 0.3);
      lfo.connect(depth);
      depth.connect(o.frequency);
      o.connect(g);
      g.connect(N.sfxIn);
      o.start(t);
      lfo.start(t);
      own(o, t + 0.34, g);
      own(lfo, t + 0.34, depth);
      blip(N.bell, 'triangle', 640, 1280, t + 0.02, 0.003, 0.12, 0.04, 0.1);
    },
    stumble() {
      const t = at('stumble', 0.3);
      if (t < 0) return;
      blip(N.sfxIn, 'sine', 620, 240, t, 0.004, 0.14, 0.12, 0.12);
      blip(N.sfxIn, 'sine', 140, 50, t + 0.1, 0.003, 0.16, 0.24, 0.12);
      noise(N.sfxIn, t + 0.1, 0.003, 0.1, 0.1, 'lowpass', 1600, 300, 0.7);
    },
    step(v = 1, near = false) {
      if (!N || !unlocked || A.muted) return;
      const t = ac.currentTime + 0.01;
      blip(N.sfxIn, 'sine', near ? 105 : 95, 52, t, 0.002, 0.07, 0.11 * v, 0.06);
      noise(N.sfxIn, t, 0.001, 0.03, 0.045 * v, 'lowpass', 900, 400, 0.7);
    },
    pulse(v = 1) {
      if (!N || !unlocked || A.muted) return;
      const t = ac.currentTime + 0.01;
      blip(N.sfxIn, 'sine', 62, 48, t, 0.004, 0.12, 0.16 * v, 0.1);
      blip(N.sfxIn, 'sine', 58, 46, t + 0.17, 0.004, 0.1, 0.1 * v, 0.08);
    },
    hmm() {
      const t = at('hmm', 0.5);
      if (t < 0) return;
      voice(N.sfxIn, t, 220, 210, 0.2, 0.9);
      voice(N.sfxIn, t + 0.26, 196, 277, 0.34, 1);
    },
    relief() {
      const t = at('relief', 0.5);
      if (t < 0) return;
      for (let i = 0; i < RELIEF.length; i++) blip(N.bell, WAVE.lead, hz(RELIEF[i]), 0, t + i * 0.08, 0.004, i === RELIEF.length - 1 ? 0.45 : 0.14, 0.06);
      noise(N.sfxIn, t, 0.02, 0.3, 0.04, 'bandpass', 1500, 600, 1);
    },
    mission() {
      const t = at('mission', 0.3);
      if (t < 0) return;
      blip(N.sfxIn, 'sine', 130, 48, t, 0.002, 0.12, 0.3, 0.09);
      noise(N.sfxIn, t, 0.001, 0.06, 0.16, 'lowpass', 1800, 400, 0.8);
      bellStrike(N.bell, t + 0.09, hz(96), 1, 1.1);
      bellStrike(N.bell, t + 0.16, hz(103), 0.6, 0.9);
      duck(0.65, 0.6);
    },
    grade() {
      if (!N || !unlocked || A.muted) return;
      const over = G.state.mode === 'over', now = ac.currentTime + 0.01;
      const t = over ? Math.max(now, stingerFree + 0.15) : Math.max(now, achFree);
      const dest = over ? N.stinger : N.sfxIn, keep = over ? stg : noop;
      for (let i = 0; i < GRADE.length; i++) {
        const last = i === GRADE.length - 1;
        keep(brass(dest, t + i * 0.15, hz(GRADE[i]), last ? 0.55 : 0.12, 0.8, 600, 2600, last ? 5 : 0));
      }
      keep(blip(dest, 'sine', hz(GRADE[2] + 12), 0, t + 0.3, 0.004, 0.9, 0.04));
      if (over) stingerFree = t + 0.95;
      else achFree = t + 0.95;
    },
    callRing() {
      const t = at('callRing', 1);
      if (t < 0) return;
      for (let i = 0; i < 6; i++) {
        const f = i & 1 ? 988 : 784, s = t + i * 0.13;
        blip(N.sfxIn, 'sine', f, 0, s, 0.006, 0.11, 0.05);
        blip(N.sfxIn, 'triangle', f * 2, 0, s, 0.004, 0.05, 0.012);
      }
    },
    leave() {
      const t = at('leave', 0.15);
      if (t < 0) return;
      blip(N.sfxIn, 'sine', 900, 300, t, 0.003, 0.12, 0.12, 0.1);
      blip(N.sfxIn, 'sine', 600, 200, t + 0.1, 0.003, 0.14, 0.1, 0.12);
    },
    bossWin() {
      const t = at('bossWin', 1);
      if (t < 0) return;
      for (let i = 0; i < 4; i++) brass(N.sfxIn, t + i * 0.03, hz(BOSS_WIN[i]), 0.8, 0.55, 600, 2600, i === 3 ? 5 : 0);
      bellStrike(N.bell, t + 0.05, hz(96), 0.9, 1.4);
      crash(t);
      duck(0.45, 1.2);
    },
    bossFail() {
      const t = at('bossFail', 1);
      if (t < 0) return;
      for (let i = 0; i < 4; i++) {
        const last = i === 3;
        brass(N.sfxIn, t + i * 0.24, hz(SAD_TROMBONE[i]), last ? 0.7 : 0.18, 0.6, 380, 1200, last ? 5.5 : 0);
      }
      duck(0.6, 1.4);
    },
    splice() {
      const t = at('splice', 0.3);
      if (t < 0) return;
      noise(N.sfxIn, t, 0.0006, 0.008, 0.12, 'highpass', 2500, 2500, 0.8);
      noise(N.sfxIn, t + 0.035, 0.0006, 0.008, 0.08, 'highpass', 3200, 3200, 0.8);
      noise(N.sfxIn, t + 0.04, 0.05, 0.25, 0.025, 'bandpass', 1100, 700, 2);
    },
    blink() {
      const t = at('blink', 1);
      if (t < 0) return;
      yawn(N.sfxIn, t, 0.45);
    },
    shutter() {
      const t = at('shutter', 1);
      if (t < 0) return;
      noise(N.sfxIn, t, 0.0005, 0.012, 0.14, 'highpass', 3000, 3000, 0.7);
      blip(N.sfxIn, 'square', 1400, 900, t, 0.001, 0.015, 0.03, 0.012);
      noise(N.sfxIn, t + 0.07, 0.0005, 0.02, 0.1, 'bandpass', 1800, 1200, 1.2);
    },
    thunder(power = 0.5, delay = 0) {
      if (!N || !unlocked || A.muted) return;
      const d = G.clamp(Number(delay) || 0, 0, 3);
      const t = ac.currentTime + 0.01 + d, prev = lastAt.thunder;
      if (prev !== undefined && t - prev < 0.6) return;
      lastAt.thunder = t;
      thunder(t, power);
      duck(0.75, d + 0.8);
    },
    recordFlag() {
      const t = at('recordFlag', 1);
      if (t < 0) return;
      for (let i = 0; i < RECORD_RUN.length; i++) blip(N.bell, WAVE.lead, hz(RECORD_RUN[i] + 5), 0, t + i * 0.035, 0.003, 0.2, 0.065);
      bellStrike(N.bell, t + 0.22, hz(101), 1, 1.3);
      bellStrike(N.bell, t + 0.3, hz(108), 0.6, 1);
      noise(N.bell, t + 0.2, 0.04, 0.7, 0.045, 'highpass', 7500, 9500, 0.7);
      duck(0.5, 1);
    },
  });

  function yawn(dest, t, v) {
    const o = osc('sawtooth', 380, t), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = osc('sine', 5.5, t), depth = ac.createGain();
    o.frequency.exponentialRampToValueAtTime(520, t + 0.2);
    o.frequency.exponentialRampToValueAtTime(165, t + 0.85);
    f.type = 'bandpass';
    f.Q.value = 2.4;
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(1350, t + 0.22);
    f.frequency.exponentialRampToValueAtTime(420, t + 0.85);
    const p = g.gain;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(0.075 * v, t + 0.12);
    p.setValueAtTime(0.075 * v, t + 0.55);
    p.exponentialRampToValueAtTime(FLOOR, t + 0.9);
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(9, t + 0.5);
    lfo.connect(depth);
    depth.connect(o.frequency);
    o.connect(f);
    f.connect(g);
    g.connect(dest);
    o.start(t);
    lfo.start(t);
    own(o, t + 0.95, f, g);
    own(lfo, t + 0.95, depth);
  }
  function voice(dest, t, f0, f1, dur, v) {
    const o = osc('sawtooth', f0, t), f = ac.createBiquadFilter(), lp = ac.createBiquadFilter(), g = ac.createGain();
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.type = 'bandpass';
    f.Q.value = 1.6;
    f.frequency.setValueAtTime(520, t);
    lp.type = 'lowpass';
    lp.Q.value = 0.5;
    lp.frequency.setValueAtTime(1100, t);
    const p = g.gain;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(0.11 * v, t + 0.03);
    p.setValueAtTime(0.11 * v, t + dur * 0.75);
    p.exponentialRampToValueAtTime(FLOOR, t + dur + 0.06);
    o.connect(f);
    f.connect(lp);
    lp.connect(g);
    g.connect(dest);
    o.start(t);
    own(o, t + dur + 0.1, f, lp, g);
  }

  // ---------- KTS ----------
  const BDAY = [77, 81, 84, 81, 86, 84];
  const BDAY_AT = [0, 0.13, 0.26, 0.45, 0.58, 0.78];
  const KTS_FANFARE = [72, 72, 72, 77, 76, 81];
  const KTS_FANFARE_AT = [0, 0.1, 0.2, 0.32, 0.62, 0.76];
  const KTS_FANFARE_LOW = [0, 0, 0, 72, 0, 77];
  const FOUND = [89, 93, 96, 100];
  const BOT_HZ = [392, 466, 523, 622, 698, 784];
  const BOT_KIND = [84, 88, 91];
  const WIFI = [83, 79, 74];
  const VIVI_WIN = [65, 69, 72, 77];
  const DOOM = [50, 50, 46];

  function contour(param, t, pts) {
    param.setValueAtTime(pts[1], t);
    for (let i = 2; i < pts.length; i += 2) param.linearRampToValueAtTime(pts[i + 1], t + pts[i]);
  }
  function sing(dest, t, wave, pitch, formant, len, peak, q) {
    const o = osc(wave, pitch[1], t), bp = ac.createBiquadFilter(), g = ac.createGain(), p = g.gain;
    contour(o.frequency, t, pitch);
    bp.type = 'bandpass';
    bp.Q.value = q;
    contour(bp.frequency, t, formant);
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + Math.min(0.03, len * 0.25));
    p.setValueAtTime(peak, t + len * 0.65);
    p.linearRampToValueAtTime(0, t + len);
    o.connect(bp);
    bp.connect(g);
    g.connect(dest);
    o.start(t);
    return own(o, t + len + 0.03, bp, g);
  }
  function catVoice(dest, t, k, len, v) {
    return sing(dest, t, 'sawtooth', [0, 430 * k, len * 0.3, 720 * k, len * 0.75, 600 * k, len, 380 * k],
      [0, 700, len * 0.25, 2300, len * 0.6, 1500, len, 650], len, 0.26 * v, 1.8);
  }
  function kva(dest, t, k, v) {
    noise(dest, t, 0.001, 0.018, 0.09 * v, 'highpass', 2600, 2600, 0.8);
    sing(dest, t + 0.012, 'square', [0, 240 * k, 0.05, 210 * k, 0.15, 150 * k], [0, 450, 0.04, 1250, 0.15, 650], 0.16, 0.32 * v, 2.6);
  }
  function nyam(dest, t, v) {
    for (let i = 0; i < 2; i++) {
      const f = i ? 235 : 205;
      sing(dest, t + i * 0.2, 'sawtooth', [0, f, 0.16, f * 0.9], [0, 320, 0.04, 1150, 0.11, 950, 0.16, 300], 0.16, 0.22 * v, 1.4);
    }
  }
  function rubberSqueak(dest, t, v) {
    sing(dest, t, 'sawtooth', [0, 1050, 0.04, 1600, 0.15, 1300], [0, 2400, 0.15, 2900], 0.15, 0.3 * v, 2.5);
    sing(dest, t + 0.19, 'sawtooth', [0, 1250, 0.03, 1450, 0.1, 1100], [0, 2600, 0.1, 2300], 0.1, 0.18 * v, 2.5);
    noise(dest, t + 0.17, 0.01, 0.07, 0.025 * v, 'bandpass', 4200, 3600, 1.5);
  }
  function mumble(dest, t, n) {
    let tt = t, last = null;
    for (let i = 0; i < n; i++) {
      const len = 0.07 + Math.random() * 0.06, f = 230 + Math.random() * 90;
      last = sing(dest, tt, 'sawtooth', [0, f, len, f * (0.85 + Math.random() * 0.3)], [0, 500, len * 0.5, 1000 + Math.random() * 500, len, 600], len, 0.17, 1.4);
      tt += len + 0.02 + Math.random() * 0.03;
    }
    return last;
  }
  function horn(dest, t, len, f0, f1, r0, r1, v) {
    const o = osc('sawtooth', f0, t), am = osc('square', r0, t), depth = ac.createGain(), reed = ac.createGain();
    const lp = ac.createBiquadFilter(), g = ac.createGain(), p = g.gain, peak = 0.08 * v;
    o.frequency.linearRampToValueAtTime(f1, t + len);
    if (r1 !== r0) am.frequency.linearRampToValueAtTime(r1, t + len);
    reed.gain.value = 0.65;
    depth.gain.value = 0.35;
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    lp.Q.value = 2.5;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + 0.03);
    p.setValueAtTime(peak, t + len * 0.8);
    p.linearRampToValueAtTime(0, t + len);
    am.connect(depth);
    depth.connect(reed.gain);
    o.connect(reed);
    reed.connect(lp);
    lp.connect(g);
    g.connect(dest);
    o.start(t);
    am.start(t);
    own(o, t + len + 0.03, reed, lp, g);
    own(am, t + len + 0.03, depth);
    noise(dest, t, 0.02, len, 0.02 * v, 'bandpass', 3200, 2600, 1.2);
  }
  function popper(dest, t, v) {
    noise(dest, t, 0.001, 0.05, 0.16 * v, 'highpass', 1800, 1200, 0.7);
    blip(dest, 'sine', 320, 90, t, 0.002, 0.06, 0.12 * v, 0.05);
  }
  function stutter(dest, t, len, rate, v, f) {
    const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain(), p = g.gain;
    const n = Math.max(2, Math.round(len * rate)), end = t + n / rate;
    src.buffer = noiseBuf;
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = 0.9;
    p.setValueAtTime(0, t);
    for (let i = 0; i < n; i++) p.setValueAtTime(i & 1 ? 0.01 * v : (0.06 + Math.random() * 0.08) * v, t + i / rate);
    p.setTargetAtTime(0, end, 0.01);
    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5);
    return own(src, end + 0.08, bp, g);
  }
  function robot(dest, t, n, broken) {
    const step = broken ? 0.052 : 0.075, end = t + n * step;
    const o = osc('square', BOT_HZ[0], t), bp = ac.createBiquadFilter(), ring = ac.createGain();
    const am = osc('sine', broken ? 37 : 61, t), depth = ac.createGain(), g = ac.createGain(), p = g.gain;
    bp.type = 'bandpass';
    bp.frequency.value = 1150;
    bp.Q.value = 1.6;
    ring.gain.value = 0;
    depth.gain.value = 1;
    p.setValueAtTime(0, t);
    let f = BOT_HZ[BOT_HZ.length - 1];
    for (let i = 0; i < n; i++) {
      const s = t + i * step;
      if (!broken) f = BOT_HZ[(Math.random() * BOT_HZ.length) | 0];
      else if (!(i & 1)) f = Math.max(140, f * (0.8 + Math.random() * 0.12));
      o.frequency.setValueAtTime(f, s);
      const peak = broken && Math.random() < 0.2 ? 0 : 0.26;
      p.setValueAtTime(0, s);
      p.linearRampToValueAtTime(peak, s + 0.006);
      p.setValueAtTime(peak, s + step * 0.6);
      p.linearRampToValueAtTime(0, s + step * 0.85);
    }
    am.connect(depth);
    depth.connect(ring.gain);
    o.connect(bp);
    bp.connect(ring);
    ring.connect(g);
    g.connect(dest);
    o.start(t);
    am.start(t);
    own(o, end + 0.03, bp, ring, g);
    own(am, end + 0.03, depth);
    return n * step;
  }
  function fire(t) {
    noise(N.sfxIn, t, 0.25, 0.55, 0.12, 'lowpass', 350, 4500, 0.9);
    paper(t + 0.15, 0.55, 9, 0.5);
    brass(N.sfxIn, t + 0.3, hz(53), 0.55, 0.6, 400, 2200, 0);
    brass(N.sfxIn, t + 0.3, hz(60), 0.55, 0.5, 400, 2200, 0);
    brass(N.sfxIn, t + 0.3, hz(65), 0.55, 0.45, 400, 2400, 5);
  }
  function vacuumCrash(t) {
    boom(t);
    blip(N.sfxIn, 'sawtooth', 115, 32, t + 0.05, 0.004, 0.8, 0.06, 0.75);
    noise(N.sfxIn, t + 0.05, 0.01, 0.8, 0.05, 'bandpass', 1500, 220, 4);
    return 0.95;
  }
  function voiceCrash(t) {
    blip(N.sfxIn, 'sine', 420, 1250, t, 0.002, 0.07, 0.15, 0.05);
    let tt = t + 0.12;
    for (let i = 0; i < 4; i++) {
      const len = 0.09 + i * 0.03, f = 260 - i * 45;
      sing(N.sfxIn, tt, 'sawtooth', [0, f, len, f * 0.8], [0, 500, len * 0.5, 1200, len, 500], len, 0.2, 1.4);
      tt += len + 0.02;
    }
    blip(N.sfxIn, 'sine', 1320, 1320, tt + 0.04, 0.003, 0.06, 0.06);
    return tt + 0.12 - t;
  }
  function drumroll(t) {
    const len = 0.9;
    const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain(), p = g.gain;
    src.buffer = noiseBuf;
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    p.setValueAtTime(0, t);
    let tt = t, gap = 0.075, i = 0;
    while (tt < t + len - 0.03) {
      const k = (tt - t) / len, amp = 0.08 + 0.22 * k * k;
      p.setValueAtTime(i & 1 ? amp * 0.75 : amp, tt);
      p.exponentialRampToValueAtTime(amp * 0.12, tt + gap * 0.9);
      tt += gap;
      gap = Math.max(0.03, gap * 0.92);
      i++;
    }
    p.setTargetAtTime(0, tt, 0.02);
    src.connect(bp);
    bp.connect(g);
    g.connect(N.stinger);
    src.start(t, Math.random() * 0.4);
    stg(own(src, tt + 0.15, bp, g));
    stg(noise(N.stinger, t + len, 0.004, 1.1, 0.06, 'highpass', 5000, 7000, 0.7, 0.8));
    stg(blip(N.stinger, 'sine', 120, 45, t + len, 0.003, 0.3, 0.3, 0.2));
    return len;
  }
  function ktsPeakDay() {
    const K = G.kts, c = K && typeof K.get === 'function' ? K.get('calendar', 'ktsBirthday') : null;
    return !!(c && K.today && K.today.m === c.month && K.today.d === c.day);
  }

  Object.assign(sfx, {
    cake(n = 1) {
      const t = at('cake', 0.4);
      if (t < 0) return;
      popper(N.sfxIn, t, 1);
      popper(N.sfxIn, t + 0.07, 0.7);
      horn(N.sfxIn, t + 0.05, 0.42, 470, 540, 38, 44, 1);
      const t1 = t + 0.5, odd = n === 2, last = BDAY.length - 1, tl = t1 + BDAY_AT[last];
      for (let i = 0; i <= last; i++) {
        const m = i === last && odd ? 83 : BDAY[i];
        blip(N.bell, WAVE.box, hz(m), 0, t1 + BDAY_AT[i], 0.003, i === last ? 1 : 0.3, 0.08);
      }
      if (odd) blip(N.sfxIn, 'triangle', hz(71), hz(68), tl + 0.15, 0.01, 0.4, 0.05, 0.4);
      else blip(N.bell, WAVE.box, hz(81), 0, tl, 0.003, 1, 0.05);
      duck(0.55, 1.6);
    },
    cakeMissed() {
      const t = at('cakeMissed', 2);
      if (t < 0) return;
      horn(N.sfxIn, t, 0.75, 520, 210, 40, 14, 0.8);
    },
    squeak(legendary) {
      const t = at('squeak', 0.25);
      if (t < 0) return;
      rubberSqueak(N.sfxIn, t, 1);
      if (legendary) sfx.squeakFire();
    },
    squeakFire() {
      const t = at('squeakFire', 1);
      if (t < 0) return;
      fire(t + 0.12);
      duck(0.5, 1);
    },
    duckFound() {
      const t = at('duckFound', 0.3);
      if (t < 0) return;
      blip(N.bell, 'triangle', hz(88), 0, t + 0.3, 0.003, 0.2, 0.055);
      blip(N.bell, 'triangle', hz(93), 0, t + 0.38, 0.003, 0.4, 0.055);
    },
    frog() {
      const t = at('frog', 0.3);
      if (t < 0) return;
      kva(N.sfxIn, t, 1, 1);
      kva(N.sfxIn, t + 0.24, 0.92, 0.85);
    },
    nom(kind) {
      const t = at('nom', 0.15);
      if (t < 0) return;
      if (kind === 'khryuchevo') {
        sing(N.sfxIn, t, 'sawtooth', [0, 140, 0.08, 165, 0.2, 115], [0, 380, 0.07, 900, 0.2, 420], 0.2, 0.3, 1.6);
        noise(N.sfxIn, t, 0.01, 0.12, 0.07, 'bandpass', 700, 400, 1.5);
        nyam(N.sfxIn, t + 0.3, 1);
        return;
      }
      const crunchy = kind === 'chakchak' || kind === 'cookie';
      if (crunchy) paper(t, 0.16, 4, 0.7);
      nyam(N.sfxIn, t + (crunchy ? 0.12 : 0), 1);
    },
    vacuum(k = 1) {
      const t = at('vacuum', 0.6);
      if (t < 0) return;
      const len = 1.15, pan = panner(N.sfxIn, 0.65, 0.15, t, len), dest = pan || N.sfxIn;
      const o = osc('sawtooth', 88 * k, t), lp = ac.createBiquadFilter(), g = ac.createGain(), p = g.gain;
      o.frequency.linearRampToValueAtTime(104 * k, t + 0.3);
      o.frequency.linearRampToValueAtTime(96 * k, t + len);
      lp.type = 'lowpass';
      lp.frequency.value = 520;
      lp.Q.value = 1.2;
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(0.07, t + 0.18);
      p.setValueAtTime(0.07, t + len - 0.35);
      p.linearRampToValueAtTime(0, t + len);
      o.connect(lp);
      lp.connect(g);
      g.connect(dest);
      o.start(t);
      noise(dest, t, 0.2, len - 0.2, 0.035, 'bandpass', 1350 * k, 1550 * k, 5);
      own(o, t + len + 0.06, lp, g, pan);
    },
    vacuumDown() {
      const t = at('vacuumDown', 0.3);
      if (t < 0) return;
      blip(N.sfxIn, 'triangle', 130, 40, t, 0.004, 0.45, 0.12, 0.4);
      noise(N.sfxIn, t, 0.005, 0.45, 0.04, 'bandpass', 1400, 260, 4);
    },
    voiceMsg() {
      const t = at('voiceMsg', 0.8);
      if (t < 0) return;
      const pan = panner(N.sfxIn, 0.6, 0.35, t, 0.9), dest = pan || N.sfxIn;
      blip(dest, 'sine', 1320, 1320, t, 0.003, 0.07, 0.07);
      const last = mumble(dest, t + 0.16, 5);
      if (pan) last.__c = pan;
    },
    voicePop() {
      const t = at('voicePop', 0.15);
      if (t < 0) return;
      blip(N.sfxIn, 'sine', 420, 1250, t, 0.002, 0.07, 0.16, 0.05);
      noise(N.sfxIn, t, 0.001, 0.03, 0.06, 'highpass', 3000, 3000, 0.7);
      blip(N.sfxIn, 'sine', 1320, 1320, t + 0.12, 0.003, 0.05, 0.05);
    },
    vpn() {
      const t = at('vpn', 0.2);
      if (t < 0) return;
      noise(N.sfxIn, t, 0.0006, 0.012, 0.16, 'highpass', 3500, 3500, 0.8);
      blip(N.sfxIn, 'square', 2100, 1500, t, 0.001, 0.018, 0.04, 0.015);
      noise(N.sfxIn, t + 0.075, 0.0006, 0.02, 0.18, 'bandpass', 2400, 1800, 1.4);
      blip(N.sfxIn, 'triangle', 900, 620, t + 0.075, 0.001, 0.05, 0.08, 0.04);
      blip(N.sfxIn, 'sine', 140, 70, t + 0.08, 0.002, 0.1, 0.22, 0.08);
      blip(N.bell, 'triangle', hz(84), 0, t + 0.2, 0.003, 0.2, 0.06);
      blip(N.bell, 'triangle', hz(91), 0, t + 0.28, 0.003, 0.35, 0.06);
    },
    jam() {
      const t = at('jam', 0.12);
      if (t < 0) return;
      stutter(N.sfxIn, t, 0.24, 36, 1, 1700);
      blip(N.sfxIn, 'sine', 1400, 300, t, 0.004, 0.26, 0.06, 0.26);
    },
    timesheet() {
      const t = at('timesheet', 0.3);
      if (t < 0) return;
      blip(N.sfxIn, 'sine', 2500, 1900, t, 0.001, 0.03, 0.09);
      noise(N.sfxIn, t, 0.0005, 0.012, 0.05, 'highpass', 4000, 4000, 0.7);
      blip(N.sfxIn, 'sine', 1650, 1250, t + 0.17, 0.001, 0.03, 0.09);
      noise(N.sfxIn, t + 0.17, 0.0005, 0.012, 0.05, 'highpass', 3000, 3000, 0.7);
      blip(N.sfxIn, 'sine', 150, 60, t + 0.36, 0.002, 0.09, 0.2, 0.07);
      noise(N.sfxIn, t + 0.36, 0.001, 0.05, 0.08, 'lowpass', 1500, 400, 0.7);
      blip(N.bell, 'triangle', hz(84), 0, t + 0.44, 0.003, 0.18, 0.07);
      blip(N.bell, 'triangle', hz(89), 0, t + 0.52, 0.003, 0.35, 0.07);
    },
    clue() {
      const t = at('clue', 0.3);
      if (t < 0) return;
      paper(t, 0.22, 5, 0.6);
      blip(N.bell, 'triangle', hz(69), 0, t + 0.12, 0.004, 0.35, 0.06);
      blip(N.bell, 'triangle', hz(72), 0, t + 0.27, 0.004, 0.5, 0.06);
      blip(N.bell, 'triangle', hz(68), 0, t + 0.42, 0.004, 0.6, 0.045);
    },
    kazan() {
      const t = at('kazan', 1);
      if (t < 0) return;
      blip(N.sfxIn, 'sine', 120, 50, t, 0.002, 0.15, 0.3, 0.1);
      noise(N.sfxIn, t, 0.001, 0.06, 0.12, 'bandpass', 900, 600, 1);
      bellStrike(N.bell, t + 0.01, 196, 1.3, 2.2);
      blip(N.bell, 'sine', 196 * 1.48, 0, t + 0.01, 0.003, 1.6, 0.04);
      duck(0.6, 1.5);
    },
    goodButton() {
      const t = at('goodButton', 1);
      if (t < 0) return;
      noise(N.sfxIn, t, 0.0005, 0.008, 0.2, 'highpass', 3000, 3000, 0.8);
      blip(N.sfxIn, 'square', 2300, 1700, t, 0.001, 0.014, 0.05, 0.012);
      blip(N.sfxIn, 'sine', 170, 60, t + 0.005, 0.002, 0.1, 0.26, 0.08);
      noise(N.sfxIn, t + 0.08, 0.42, 0.05, 0.06, 'bandpass', 400, 5000, 1.2);
      for (let i = 0; i < PENTA_UP.length; i++) blip(N.bell, 'triangle', hz(77 + PENTA_UP[i]), 0, t + 0.15 + i * 0.04, 0.003, 0.25, 0.05);
      duck(0.5, 0.5);
    },
    meow() {
      const t = at('meow', 0.4);
      if (t < 0) return;
      catVoice(N.sfxIn, t, 1.1, 0.5, 1);
    },
    vivi() {
      const t = at('vivi', 1.5);
      if (t < 0) return;
      catVoice(N.sfxIn, t, 1.25, 0.42, 1);
      for (let i = 0; i < VIVI_WIN.length; i++) brass(N.sfxIn, t + 0.45 + i * 0.02, hz(VIVI_WIN[i]), 0.55, 0.45, 700, 2600, i === VIVI_WIN.length - 1 ? 5 : 0);
      bellStrike(N.bell, t + 0.47, hz(96), 0.7, 1.1);
      duck(0.6, 1);
    },
    kotzilla() {
      const t = at('kotzilla', 1);
      if (t < 0) return 0;
      sing(N.sfxIn, t, 'sawtooth', [0, 70, 0.5, 58], [0, 300, 0.25, 700, 0.5, 400], 0.5, 0.35, 0.9);
      noise(N.sfxIn, t, 0.05, 0.45, 0.07, 'lowpass', 600, 250, 0.8, 0.5);
      catVoice(N.sfxIn, t + 0.32, 0.5, 1.1, 1.4);
      catVoice(N.sfxIn, t + 0.33, 1, 1.05, 0.5);
      duck(0.5, 1.4);
      return 1.45;
    },
    bot(phase, text) {
      const t = at('bot-' + phase, 0.4);
      if (t < 0) return;
      if (phase === 'enter') {
        blip(N.sfxIn, 'sawtooth', 180, 520, t, 0.02, 0.25, 0.035, 0.25);
        blip(N.sfxIn, 'square', 880, 880, t + 0.28, 0.002, 0.05, 0.035);
        blip(N.sfxIn, 'square', 1320, 1320, t + 0.36, 0.002, 0.07, 0.035);
      } else if (phase === 'predict') {
        const len = robot(N.sfxIn, t, G.clamp(Math.round(String(text || '').length / 4), 5, 12), false);
        blip(N.sfxIn, 'square', 1250, 1250, t + len + 0.06, 0.002, 0.05, 0.04);
        blip(N.sfxIn, 'square', 930, 880, t + len + 0.15, 0.002, 0.09, 0.04, 0.08);
      } else if (phase === 'kind') {
        const len = robot(N.sfxIn, t, 10, true);
        stutter(N.sfxIn, t + len * 0.4, 0.12, 50, 0.7, 3000);
        for (let i = 0; i < BOT_KIND.length; i++) blip(N.bell, 'sine', hz(BOT_KIND[i]), 0, t + len + 0.08 + i * 0.07, 0.003, i === 2 ? 0.35 : 0.12, 0.06);
      } else if (phase === 'dive') {
        blip(N.sfxIn, 'sine', 1700, 500, t, 0.01, 0.4, 0.06, 0.4);
        noise(N.sfxIn, t, 0.05, 0.3, 0.03, 'bandpass', 3000, 800, 1.5);
      } else if (phase === 'blocked') {
        blip(N.sfxIn, 'sine', 140, 45, t, 0.002, 0.14, 0.28, 0.1);
        noise(N.sfxIn, t, 0.001, 0.06, 0.14, 'lowpass', 2400, 500, 0.8);
        blip(N.sfxIn, 'sawtooth', 520, 55, t + 0.06, 0.01, 0.6, 0.05, 0.6);
        stutter(N.sfxIn, t + 0.1, 0.3, 24, 0.8, 1200);
      } else if (phase === 'leave') {
        noise(N.sfxIn, t, 0.15, 0.2, 0.04, 'bandpass', 600, 3000, 1.2);
        blip(N.sfxIn, 'square', 900, 1400, t + 0.1, 0.002, 0.06, 0.03, 0.05);
      }
    },
    secret() {
      if (!N || !unlocked || A.muted) return;
      const over = G.state.mode === 'over', now = ac.currentTime + 0.01;
      const t = over ? Math.max(now + 0.1, stingerFree + 0.15) : Math.max(now + 0.3, achFree);
      const dest = over ? N.stinger : N.sfxIn, shine = over ? N.stinger : N.bell, keep = over ? stg : noop;
      for (let i = 0; i < FOUND.length; i++) keep(blip(shine, 'triangle', hz(FOUND[i]), 0, t + i * 0.055, 0.003, 0.28, 0.05));
      keep(noise(shine, t, 0.15, 0.4, 0.03, 'highpass', 6000, 9000, 0.7));
      keep(brass(dest, t + 0.28, hz(77), 0.09, 0.6, 700, 2600, 0));
      keep(brass(dest, t + 0.28, hz(81), 0.09, 0.45, 700, 2600, 0));
      keep(brass(dest, t + 0.42, hz(84), 0.5, 0.7, 700, 2800, 5));
      keep(brass(dest, t + 0.42, hz(89), 0.5, 0.5, 700, 2800, 0));
      keep(blip(shine, 'sine', hz(101), 0, t + 0.42, 0.004, 0.9, 0.035));
      if (over) stingerFree = t + 1;
      else {
        achFree = t + 1;
        duck(0.55, t - ac.currentTime + 0.9);
      }
    },
    inevitable() {
      if (!N || !unlocked || A.muted) return;
      const over = G.state.mode === 'over', now = ac.currentTime + 0.01;
      const t = over ? Math.max(now, stingerFree + 0.1) : Math.max(now, achFree);
      const dest = over ? N.stinger : N.sfxIn, keep = over ? stg : noop;
      for (let i = 0; i < DOOM.length; i++) {
        const last = i === DOOM.length - 1, s = t + i * 0.24;
        keep(brass(dest, s, hz(DOOM[i]), last ? 0.85 : 0.12, 0.9, 300, 1300, last ? 4.5 : 0));
        keep(blip(dest, 'sine', hz(DOOM[i] - 12), hz(DOOM[i] - 13), s, 0.004, last ? 0.9 : 0.22, 0.28, last ? 0.9 : 0.2));
      }
      keep(blip(dest, 'sine', 500, 1900, t + 1.05, 0.02, 0.2, 0.06, 0.2));
      keep(blip(dest, 'triangle', hz(77), 0, t + 1.3, 0.003, 0.12, 0.08));
      keep(blip(dest, 'triangle', hz(84), 0, t + 1.42, 0.003, 0.45, 0.08));
      if (over) stingerFree = t + 1.9;
      else achFree = t + 1.9;
    },
    birthday(full) {
      const t = at('birthday', 3);
      if (t < 0) return;
      const t0 = t + 0.35;
      horn(N.sfxIn, t0, 0.32, 500, 560, 40, 40, 0.9);
      if (!full) return;
      const peak = ktsPeakDay(), f0 = t0 + 0.3, last = KTS_FANFARE.length - 1, end = f0 + KTS_FANFARE_AT[last];
      for (let i = 0; i <= last; i++) {
        const s = f0 + KTS_FANFARE_AT[i], low = KTS_FANFARE_LOW[i];
        const len = i === last ? (peak ? 1 : 0.7) : low ? 0.22 : 0.06;
        brass(N.sfxIn, s, hz(KTS_FANFARE[i]), len, 0.8, 600, 2700, i === last ? 5 : 0);
        if (low) brass(N.sfxIn, s, hz(low), len, 0.5, 600, 2400, 0);
      }
      popper(N.sfxIn, end, 1);
      popper(N.sfxIn, end + 0.06, 0.8);
      noise(N.sfxIn, end, 0.005, 1, 0.05, 'highpass', 5500, 7500, 0.7, 0.8);
      bellStrike(N.bell, end, hz(96), 0.8, 1.3);
      if (peak) for (let i = 0; i < 4; i++) popper(N.sfxIn, end + 0.3 + i * 0.13, 0.6);
      duck(0.45, end - ac.currentTime + 0.8);
    },
    wifi(up) {
      const t = at('wifi', 0.5);
      if (t < 0) return;
      const n = WIFI.length;
      for (let i = 0; i < n; i++) blip(N.sfxIn, 'sine', hz(WIFI[up ? n - 1 - i : i]), 0, t + i * 0.11, 0.004, i === n - 1 ? 0.3 : 0.12, 0.07);
      if (!up) noise(N.sfxIn, t, 0.005, 0.3, 0.03, 'bandpass', 2500, 900, 0.8);
    },
    salute() {
      const t = at('salute', 1.5);
      if (t < 0) return;
      for (let i = 0; i < 4; i++) {
        const s = t + i * 0.35 + Math.random() * 0.15;
        blip(N.sfxIn, 'sine', 500, 1400, s, 0.02, 0.25, 0.025, 0.25);
        popper(N.sfxIn, s + 0.3, 0.7);
        paper(s + 0.35, 0.4, 6, 0.4);
      }
    },
  });

  // ---------- API ----------
  function syncRunning() {
    if (!ac) return;
    clearTimeout(suspendTimer);
    const hidden = !!document.hidden;
    if (unlocked && !A.muted && !hidden) {
      if (ac.state !== 'running' && ac.state !== 'closed' && ac.resume) settle(ac.resume());
    } else if (ac.state === 'running' && ac.suspend) {
      suspendTimer = setTimeout(() => {
        if ((A.muted || document.hidden) && ac.state === 'running') settle(ac.suspend());
      }, hidden ? 0 : 250);
    }
  }

  A.unlock = () => {
    const a = A.context();
    if (!a || !N) return;
    if (!unlocked) {
      unlocked = true;
      try {
        const s = a.createBufferSource();
        s.buffer = a.createBuffer(1, 1, a.sampleRate || 44100);
        s.connect(a.destination);
        s.onended = endVoice;
        s.start(0);
      } catch (e) {}
      M.lastAc = a.currentTime;
      M.t = a.currentTime + 0.1;
      if (!schedTimer) schedTimer = setInterval(tickSafe, TICK_MS);
      applyMode();
      setCrackle();
    }
    syncRunning();
  };
  A.isReady = () => !!N && unlocked;
  A.setMuted = (m) => {
    A.muted = !!m;
    G.store.set(KEY_MUTED, A.muted ? '1' : '0');
    if (N) {
      glide(N.master.gain, A.muted ? 0 : 1, 0.03);
      setCrackle();
    }
    syncRunning();
    if (!A.muted) sfx.unmute();
    G.emit('mute', A.muted);
  };
  A.toggle = () => A.setMuted(!A.muted);
  A.setMusic = (on) => {
    A.music = !!on;
    G.store.set(KEY_MUSIC, A.music ? '1' : '0');
    if (N) {
      glide(N.musicVol.gain, musicLevel(), 0.15);
      applyMode();
      setCrackle();
    }
    G.emit('music', A.music);
  };
  A.setVolume = (group, v) => {
    if (group !== 'music' && group !== 'sfx') return;
    volume[group] = vol01(v, volume[group]);
    G.store.setJSON(KEY_VOL, volume);
    if (!N) return;
    if (group === 'music') glide(N.musicVol.gain, musicLevel(), 0.08);
    else glide(N.sfxVol.gain, volume.sfx, 0.08);
  };
  A.tone = (f0, f1, dur, type = 'sine', vol = 0.06, delay = 0) => {
    if (!N || !unlocked || A.muted) return;
    const a = Math.max(1, f0 || 440);
    blip(N.sfxIn, type, a, Math.max(1, f1 || a), ac.currentTime + 0.005 + Math.max(0, delay), 0.008, Math.max(0.01, dur || 0.1), vol);
  };

  // ---------- события ----------
  function onStart(s) {
    recordArmed = G.state.best >= 30;
    chain = 0;
    pendingHit = null;
    cakeN = 0;
    bdayRun = false;
    calmMusic();
    if (!N) return;
    setAmbient(null);
    stopStingers();
    M.nightK = 0;
    M.form = s && s.fromStart ? 0 : G.pick(RESTART_FORM);
    M.sec = makeSection(FORM[M.form]);
    M.bar = 0;
    M.step = 0;
    M.t = ac.currentTime + 0.12;
    M.overTicksAt = Infinity;
    M.forceNext = false;
    M.crashNext = false;
    meterTenth = 0;
    stepAcc = 0;
    pulseAcc = 0;
    applyMode();
    if (s && s.fromStart) sfx.kickoff();
    else sfx.restart();
    if (ktsOn() && typeof G.kts.event === 'function' && G.kts.event('ktsBirthday')) playBirthday(!!(s && s.fromStart));
  }

  function onDie(info) {
    pendingHit = null;
    recordArmed = false;
    calmMusic();
    if (!N) return;
    const now = ac.currentTime;
    tapeStop(now);
    const len = sfx.die(info && info.type);
    if (unlocked && !A.muted) {
      const jAt = now + Math.max(G.cfg.overlayDelay + 0.05, len - 0.1);
      const record = !!(info && info.isRecord);
      const roll = record && ktsOn() ? drumroll(jAt) : 0;
      const jLen = record ? jingleRecord(jAt + roll) + roll : jingleSad(jAt);
      stingerFree = jAt + jLen;
      M.overTicksAt = jAt + jLen + 1.2;
    }
    applyMode();
  }

  function onPickup(p, def) {
    const id = String((p && p.type) || '');
    if (ktsOn() && ktsPickup(id, p, def)) return;
    if ((p && (p.gold || p.golden)) || (def && (def.gold || def.golden)) || /gold|золот/i.test(id)) sfx.golden();
    else if (/carrot|морк/i.test(id)) sfx.carrot();
    else if (powerupT !== G.state.realT) sfx.pick();
  }
  function onPowerup(pu) {
    powerupT = G.state.realT;
    const id = String((pu && pu.id) || '');
    if (id === 'vpn' && ktsOn()) sfx.vpn();
    else if (/coffee|кофе/i.test(id)) sfx.coffee();
    else if (isShield(id)) sfx.shield();
    else if (/cancel|отмен/i.test(id)) sfx.cancel();
    else if (/friday|party|пятниц/i.test(id)) sfx.friday();
    else if (/feather|wing|перо/i.test(id)) sfx.feather();
    else if (/slow|time|matrix|zen/i.test(id)) sfx.slow();
    else if (/magnet|магнит/i.test(id)) sfx.magnet();
    else sfx.power();
  }
  function onPowerupEnd(pu) {
    const id = String((pu && pu.id) || ''), reason = pu && pu.reason;
    if (reason === 'instant' || reason === 'die' || reason === 'start') return;
    const popped = reason === 'used' || reason === 'hit' || reason === 'pop' || (pu && pu.popped);
    if (popped || (isShield(id) && !reason && G.state.realT - smashT < 0.15)) sfx.shieldPop();
    else if (G.state.mode === 'run') sfx.powerDown();
  }
  function onSmash(o) {
    smashT = G.state.realT;
    const h = pendingHit && pendingHit.o === o ? pendingHit : null;
    pendingHit = null;
    const type = o && o.type;
    if (ktsOn()) {
      if (h && vpnOn() && isComm(type)) {
        sfx.jam();
        return;
      }
      if (type === 'voice') sfx.voicePop();
      else if (type === 'vacuum') sfx.vacuumDown();
    }
    if (h && h.stomp) return;
    if (h && h.fever) sfx.boing();
    else if (h && h.stumble) sfx.stumble();
    else if (h && h.cancel && !pendingInv) sfx.shieldPop();
    sfx.smash(type);
  }

  let cakeN = 0, bdayRun = false, ktsAchT = -1, ktsSkinT = -1, achSeenT = -1, skinSeenT = -1;
  const heard = typeof WeakSet === 'function' ? new WeakSet() : null;
  const vpnOn = () => !!(G.powerups && typeof G.powerups.isActive === 'function' && G.powerups.isActive('vpn'));
  const isLegendary = (p, def) => !!((p && (p.legendary || /legend/i.test(String(p.spot || '')))) || (def && def.legendary));
  function isComm(type) {
    if (type === 'voice') return true;
    const k = kindOf(type);
    return k === 'call' || k === 'ping' || k === 'minute';
  }
  function holdQueue(sec) {
    if (!(sec > 0)) return;
    const end = ac.currentTime + sec;
    if (G.state.mode === 'over') stingerFree = Math.max(stingerFree, end);
    else achFree = Math.max(achFree, end);
  }
  function startGood() {
    if (!N || G.state.mode !== 'run' || M.goodUntil > ac.currentTime) return;
    sfx.goodButton();
    const now = ac.currentTime;
    M.goodFrom = now + 0.5;
    M.goodUntil = now + 0.5 + GOOD_SEC;
    M.crashNext = true;
  }
  function playBirthday(full) {
    bdayRun = true;
    sfx.birthday(full);
  }
  function ktsPickup(id, p, def) {
    switch (id) {
      case 'cake':
        sfx.cake(++cakeN);
        return true;
      case 'duck':
        sfx.squeak(isLegendary(p, def));
        return true;
      case 'frog':
      case 'toad':
        sfx.frog();
        if (N && G.state.mode === 'run') M.softUntil = ac.currentTime + 4;
        return true;
      case 'echpochmak':
        sfx.golden();
        sfx.nom(id);
        return true;
      case 'chakchak':
      case 'khryuchevo':
      case 'cookie':
        sfx.nom(id);
        return true;
      case 'vpn':
        return true;
      case 'timesheet':
        sfx.timesheet();
        return true;
      case 'plovClue':
        sfx.clue();
        return true;
      case 'kazan':
        sfx.kazan();
        return true;
      case 'goodButton':
        startGood();
        return true;
      case 'cat':
        sfx.meow();
        return true;
    }
    return false;
  }
  function ktsEnter(o) {
    if (o.type !== 'vacuum' && o.type !== 'voice') return false;
    if (heard) {
      if (heard.has(o)) return true;
      heard.add(o);
    }
    if (o.type === 'vacuum') sfx.vacuum(G.clamp(Number(o.drift) || 1, 0.7, 1.3));
    else sfx.voiceMsg();
    return true;
  }
  function ktsScan() {
    const list = G.obstacles;
    if (!heard || !list || G.state.mode !== 'run' || !ktsOn()) return;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o && (o.type === 'vacuum' || o.type === 'voice') && !o.dead && !o.deco && o.x - 30 < G.W) ktsEnter(o);
    }
  }

  const gesture = () => {
    if (!unlocked || (ac && ac.state !== 'running' && !A.muted)) A.unlock();
  };
  for (const type of ['pointerdown', 'keydown', 'touchend', 'click']) window.addEventListener(type, gesture, true);
  document.addEventListener('visibilitychange', syncRunning);

  G.on('input', A.unlock);
  G.on('start', (s) => {
    A.unlock();
    onStart(s);
  });
  G.on('jump', (j) => sfx.jump(j && j.n));
  G.on('land', (l) => sfx.land(l ? l.impact : 0));
  G.on('pickup', onPickup);
  G.on('powerup', onPowerup);
  G.on('powerupEnd', onPowerupEnd);
  G.on('hit', (h) => {
    pendingHit = h;
    pendingInv = !!(h && h.cancel);
  });
  G.on('smash', onSmash);
  G.on('pass', (o, info) => { if (info && info.near) sfx.near(); });
  G.on('die', onDie);
  G.on('milestone', () => {
    sfx.milestone();
    M.forceNext = true;
  });
  G.on('achievement', () => {
    achSeenT = G.state.realT;
    if (ktsAchT !== achSeenT) sfx.achievement();
  });
  G.on('skinUnlock', () => {
    skinSeenT = G.state.realT;
    if (ktsSkinT !== skinSeenT) sfx.achievement('skin');
  });
  G.on('clockRing', () => { if (G.state.mode === 'run') sfx.clockRing(); });
  G.on('telegraph', (o, def, phase) => {
    if (!o || G.state.mode !== 'run') return;
    if (phase === 'enter' && ktsOn() && ktsEnter(o)) return;
    if (phase === 'enter' && kindOf(o.type) === 'call') sfx.buzz();
    else sfx.telegraph(o.type, phase);
  });
  G.on('combo', (c) => sfx.combo(c));
  G.on('stomp', (e) => { if (G.state.mode === 'run') sfx.stomp(e && e.chain, e && e.meme); });
  G.on('snooze', (e) => sfx.snooze(e && e.chain));
  G.on('meter', (m) => {
    const tenth = Math.floor(((m && Number(m.value)) || 0) / 10 + 1e-6);
    if (tenth > meterTenth && tenth < 10 && m.delta > 0 && G.state.mode === 'run') sfx.meterTick(tenth);
    meterTenth = tenth;
  });
  G.on('fever', () => sfx.fever());
  G.on('feverEnd', (e) => { if (e && e.reason === 'timeout') sfx.feverEnd(); });
  G.on('chase', (c) => {
    if (!c || G.state.mode !== 'run') return;
    if (c.phase === 'caught') sfx.hmm();
    else if (c.phase === 'escape') sfx.relief();
    else if (c.phase === 'warn' || c.phase === 'start') stepAcc = Math.max(stepAcc, 0.9);
  });
  G.on('mission', () => sfx.mission());
  G.on('grade', () => sfx.grade());
  G.on('boss', (b) => {
    const ph = b && b.phase;
    if (ph === 'warn' || ph === 'start') sfx.callRing();
    else if (ph === 'hit') sfx.leave();
    else if (ph === 'win') sfx.bossWin();
    else if (ph === 'fail') sfx.bossFail();
  });
  G.on('recordFlag', () => sfx.recordFlag());
  G.on('location', (l) => {
    if (!l) return;
    setAmbient(ambKind(l.id, l.name));
    if (G.state.mode !== 'run') return;
    if (l.kind === 'splice') sfx.splice();
    else if (l.kind === 'blink') sfx.blink();
  });
  G.on('railTick', () => {
    if (!N || AMB.kind !== 'metro' || G.state.mode !== 'run') return;
    const t = at('rail', 0.2);
    if (t < 0) return;
    AMB.railAt = ac.currentTime;
    rail(t);
  });
  G.on('lightning', (l) => { if (G.state.mode === 'run' || G.state.mode === 'start') sfx.thunder(l && l.power, l && l.delay); });
  G.on('memeShot', () => sfx.shutter());
  G.on('pause', () => {
    applyMode();
    sfx.pause();
  });
  G.on('resume', () => {
    applyMode();
    sfx.resume();
  });
  G.on('key', (e) => {
    if (!e || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyM') A.toggle();
    else if (e.code === 'KeyN') A.setMusic(!A.music);
  });
  G.onUpdate((dt, rdt) => {
    const m = G.modes;
    const c = G.state.mode === 'run' && m && typeof m.chase === 'function' ? m.chase() : null;
    if (!c || (c.phase !== 'warn' && c.phase !== 'start')) {
      stepAcc = 0;
      pulseAcc = 0;
      return;
    }
    const gap = Number(c.gap);
    const g = Number.isFinite(gap) ? gap : 90;
    stepAcc += rdt * G.clamp(2 + (90 - g) / 30, 1.5, 4.5);
    if (stepAcc >= 1) {
      stepAcc = Math.min(0.5, stepAcc - 1);
      sfx.step(G.clamp(1.3 - g / 150, 0.4, 1), g < 50);
    }
    if (g < 50) {
      pulseAcc += rdt * 1.4;
      if (pulseAcc >= 1) {
        pulseAcc = 0;
        sfx.pulse(G.clamp((60 - g) / 36, 0.4, 1));
      }
    } else {
      pulseAcc = 0.8;
    }
  }, 96);
  G.onUpdate(() => {
    if (!recordArmed || G.state.mode !== 'run') return;
    if (G.score() > G.state.best) {
      recordArmed = false;
      sfx.record();
    }
  }, 95);

  G.onUpdate(ktsScan, 97);
  G.on('kts:npc', (e) => {
    if (!e || !ktsOn()) return;
    if (e.id === 'toxic') sfx.bot(e.phase, e.text);
    else if (e.id === 'vivi' && e.phase === 'enter') sfx.vivi();
    else if (e.id === 'cat' && e.phase === 'enter') sfx.meow();
  });
  G.on('kts:event', (e) => {
    if (!e || !ktsOn()) return;
    const on = e.phase !== 'end';
    if (e.id === 'wifi') {
      const unplugged = on && G.state.mode === 'run';
      if (unplugged === M.unplugged) return;
      M.unplugged = unplugged;
      sfx.wifi(!unplugged);
      if (!unplugged) M.crashNext = true;
      return;
    }
    if (!on) return;
    if (e.id === 'vivi') sfx.vivi();
    else if (e.id === 'cakeMissed') sfx.cakeMissed();
    else if (e.id === 'birthday' && !bdayRun) playBirthday(true);
    else if (e.id === 'salute') sfx.salute();
  });
  G.on('kts:secret', (e) => {
    if (!e || !ktsOn() || !N) return;
    if (e.id === 'kotzilla') holdQueue(sfx.kotzilla());
    else if (e.id === 'inevitable') sfx.inevitable();
    else if (e.id === 'goodButton') startGood();
    sfx.secret();
  });
  G.on('kts:duck', (e) => {
    if (!e || !ktsOn() || !N) return;
    const legendary = !!(e.def && e.def.legendary) || /legend/i.test(String(e.id || ''));
    const prev = lastAt.squeak;
    if (!(prev !== undefined && ac.currentTime - prev < 0.5)) sfx.squeak(legendary);
    else if (legendary) sfx.squeakFire();
    sfx.duckFound();
  });
  G.on('kts:ach', () => {
    if (!ktsOn() || achSeenT === G.state.realT) return;
    ktsAchT = G.state.realT;
    sfx.achievement();
  });
  G.on('kts:skin', () => {
    if (!ktsOn() || skinSeenT === G.state.realT) return;
    ktsSkinT = G.state.realT;
    sfx.achievement('skin');
  });
})();
