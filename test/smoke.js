#!/usr/bin/env node
/*
 * Безголовый смоук-тест: грузит скрипты из index.html в фейковый DOM/canvas/WebAudio и гоняет игру.
 * Запуск: node game/test/smoke.js [--quick] [--verbose]
 * Код выхода 1, если были исключения, ошибки в G.errors или числа ушли в NaN.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ARGS = new Set(process.argv.slice(2));
const QUICK = ARGS.has('--quick');
const VERBOSE = ARGS.has('--verbose');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCRIPTS = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const HTML_IDS = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

const CTX_PROPS = new Set([
  'canvas', 'fillStyle', 'strokeStyle', 'lineWidth', 'font', 'globalAlpha', 'textAlign', 'textBaseline', 'lineCap', 'lineJoin',
  'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'globalCompositeOperation', 'filter', 'imageSmoothingEnabled',
  'imageSmoothingQuality', 'miterLimit', 'lineDashOffset', 'direction', 'letterSpacing', 'wordSpacing', 'fontKerning', 'fontStretch', 'fontVariantCaps', 'textRendering',
]);
const AUDIO_PARAMS = new Set(['frequency', 'gain', 'detune', 'Q', 'pan', 'delayTime', 'playbackRate', 'threshold', 'knee', 'ratio', 'attack', 'release', 'offset', 'positionX', 'positionY', 'positionZ']);

// Бот-планировщик: каждый кадр перебирает «ничего не делать / прыгнуть сейчас (+ второй прыжок через δ)»
// по физике ядра и прыгает в самый ранний момент, когда прыжок проходит с запасом SAFE и после приземления
// остаётся выход: можно бежать дальше или сразу прыгнуть снова. Без такого плана прыгает в последний кадр,
// когда план есть хотя бы впритирку. Нажать можно только на границе кадра, поэтому шаг плана — кадр игры.
// Без оставшихся прыжков нажатие в воздухе уходит в буфер и срабатывает при приземлении, как в ядре.
// Смерть планировщика — повод проверить связку на честность.
function makePlanner(G, fps) {
  const STEP = 1 / fps, HORIZON = 1.6, SAFE = 6, TIGHT = 1, REACT = 0.12;
  const DELAYS = [null, 0.1, 0.14, 0.18, 0.22, 0.26, 0.3, 0.34, 0.38, 0.42, 0.46, 0.5, 0.56];
  const NEXT_AT = [0, 0.05, 0.1, 0.16, 0.24, 0.34];
  const NEXT_D = [null, 0.18, 0.3, 0.42, 0.54];
  const PING_HOP = 50, PING_W = 6.4, ASK_LOW = 26, ASK_HIGH = 116, ASK_SPLIT = 70;
  const hb = { x: 0, y: 0, r: 0 };
  const plan = [0, 0];
  let obs = [], speed = 0, acc = 0, slack = 0, g = 0, jv = 0, dv = 0, maxJ = 2, baseR = 18, bufT = 0.15;
  let lastSpeed = 0, lastT = -1;

  function ghost(o, t) {
    const q = Object.create(o);
    q.x = o.x - (speed * t + 0.5 * acc * t * t) * (o.drift == null ? 1 : o.drift);
    if (o.type === 'ping' && typeof o.ph === 'number') q.hop = PING_HOP * Math.abs(Math.sin(o.ph + PING_W * t));
    else if (o.type === 'laptop') q.open = 1;
    else if (o.type === 'minute') {
      const lane = o.locked ? o.lane : o.fly < ASK_SPLIT ? ASK_LOW : ASK_HIGH;
      q.fly = lane + (o.fly - lane) * Math.exp(-9 * t);
    }
    return q;
  }
  function hits(t, alt) {
    hb.y = alt + G.cfg.hitbox.dy;
    hb.r = baseR + slack;
    for (const o of obs) {
      const def = G.obstacleTypes[o.type];
      if (def && def.hit(ghost(o, t), hb)) return true;
    }
    return false;
  }
  // Время столкновения (Infinity — дожили до конца горизонта). p1, p2 — абсолютные моменты нажатий или -1.
  function run(alt, v, jumps, t0, p1, p2, deep) {
    const presses = p1 < 0 ? 0 : p2 < 0 ? 1 : 2;
    let used = 0, buffered = -1;
    for (let t = t0 + STEP; t <= HORIZON + 1e-9; t += STEP) {
      if (alt > 0 || v > 0) {
        alt += v * STEP - 0.5 * g * STEP * STEP;
        v -= g * STEP;
        if (alt <= 0) {
          alt = 0; v = 0; jumps = 0;
          if (buffered >= 0 && t - buffered <= bufT) {
            v = jv;
            jumps = 1;
            buffered = -1;
          } else if (used >= presses) return deep ? next(t) : t + REACT < HORIZON && hitsUntil(t, t + REACT) ? t : Infinity;
        }
      }
      if (used < presses) {
        const at = used === 0 ? p1 : p2;
        if (at <= t - STEP + 1e-9) {
          used++;
          if (jumps === 0) { v = alt > 0 ? dv : jv; jumps = alt > 0 ? 2 : 1; }
          else if (jumps < maxJ) { v = dv; jumps++; }
          else buffered = at;
        }
      }
      if (hits(t, alt)) return t;
    }
    return Infinity;
  }
  function hitsUntil(t0, t1) {
    for (let t = t0; t <= t1; t += STEP) if (hits(t, 0)) return true;
    return false;
  }
  // Кролик только что приземлился в момент t0: есть ли выход — бежать или прыгнуть снова.
  function next(t0) {
    let best = run(0, 0, 0, t0, -1, -1, false);
    if (best === Infinity) return Infinity;
    for (const k of NEXT_AT) {
      for (const d of NEXT_D) {
        const r = run(0, 0, 0, t0, t0 + k, d == null ? -1 : t0 + k + d, false);
        if (r === Infinity) return Infinity;
        if (r > best) best = r;
      }
    }
    return best;
  }
  function viable(at, grounded, sl, singleOnly) {
    slack = sl;
    const B = G.bunny;
    if (!grounded) return run(B.alt, B.v, B.jumps, 0, at, -1, true) === Infinity;
    for (const d of DELAYS) {
      if (singleOnly && d != null) break;
      if (run(B.alt, B.v, B.jumps, 0, at, d == null ? -1 : at + d, true) === Infinity) return true;
    }
    return false;
  }
  return function decide() {
    const S = G.state, B = G.bunny, cfg = G.cfg;
    // скорость мира плавно меняется (кофе, вехи) — учитываем текущее ускорение
    acc = lastT >= 0 && S.t > lastT && S.t - lastT < 0.1 ? Math.max(-400, Math.min(400, (S.speed - lastSpeed) / (S.t - lastT))) : 0;
    lastSpeed = S.speed;
    lastT = S.t;
    obs = G.obstacles.filter((o) => !o.deco && !o.dead && !o.ballistic && o.x > B.x - 120 && o.x < B.x + S.speed * 1.8 + 200);
    if (!obs.length) return false;
    speed = S.speed;
    g = cfg.gravity * G.mod('gravity');
    jv = cfg.jumpV * G.mod('jumpV');
    dv = cfg.djumpV * G.mod('jumpV');
    maxJ = G.maxJumps();
    bufT = cfg.jumpBuffer;
    const box = G.bunnyHitbox();
    hb.x = box.x;
    baseR = box.r;
    slack = TIGHT;
    const none = run(B.alt, B.v, B.jumps, 0, -1, -1, true);
    if (none === Infinity) return false;
    const grounded = B.alt <= 0 && B.v <= 0;
    // одиночный прыжок — сразу, как только проходит; двойной и впритирку — в последний подходящий кадр
    if (grounded && viable(0, true, SAFE, true)) return true;
    if (viable(0, grounded, SAFE)) return !viable(STEP, grounded, SAFE);
    if (viable(0, grounded, TIGHT)) return !viable(STEP, grounded, TIGHT);
    return none <= STEP * 2;
  };
}

function runScenario(opts) {
  const { name, seed = 1, width = 900, height = 450, seconds = 120, fps = 30, invincible = false, autopilot = true, chaos = false, bot = 'simple' } = opts;
  const problems = [];
  const warnings = new Map();
  const warn = (k) => warnings.set(k, (warnings.get(k) || 0) + 1);
  let rng = seed >>> 0 || 1;
  const rand = () => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng / 4294967296;
  };

  // ---------- время ----------
  let now = 1000;
  let rafQueue = [];
  let timerSeq = 1;
  const timers = new Map();
  function setTimeoutFake(fn, ms = 0, ...a) {
    const id = timerSeq++;
    timers.set(id, { at: now + Math.max(0, ms), fn, a, every: 0 });
    return id;
  }
  function setIntervalFake(fn, ms = 0, ...a) {
    const id = timerSeq++;
    timers.set(id, { at: now + Math.max(1, ms), fn, a, every: Math.max(1, ms) });
    return id;
  }
  function clearTimerFake(id) { timers.delete(id); }
  function runDueTimers() {
    for (const [id, t] of [...timers]) {
      if (t.at > now) continue;
      if (t.every) t.at = now + t.every;
      else timers.delete(id);
      guard('timer', () => t.fn(...t.a));
    }
  }
  function guard(tag, fn) {
    try { fn(); } catch (e) { problems.push(`${tag}: ${e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e}`); }
  }

  // ---------- события ----------
  function makeTarget() {
    const ls = {};
    return {
      addEventListener(type, fn) { (ls[type] || (ls[type] = [])).push(fn); },
      removeEventListener(type, fn) { const a = ls[type]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
      dispatchEvent(ev) { for (const fn of (ls[ev.type] || []).slice()) guard('listener ' + ev.type, () => (typeof fn === 'function' ? fn(ev) : fn.handleEvent(ev))); return true; },
      _ls: ls,
    };
  }
  function makeEvent(type, props = {}) {
    return Object.assign({ type, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() {}, target: null, currentTarget: null, code: '', key: '', button: 0, repeat: false, clientX: 100, clientY: 100, pointerId: 1, pointerType: 'mouse', isPrimary: true }, props);
  }

  // ---------- canvas ----------
  const gradient = { addColorStop(o) { if (!(o >= 0 && o <= 1)) warn('addColorStop offset out of [0,1]'); } };
  function makeCtx(canvas) {
    const st = { canvas, globalAlpha: 1, lineWidth: 1, font: '10px sans-serif', fillStyle: '#000', strokeStyle: '#000', textAlign: 'start', textBaseline: 'alphabetic', globalCompositeOperation: 'source-over' };
    const fns = {
      createLinearGradient: (...a) => { a.forEach((v) => !Number.isFinite(v) && warn('createLinearGradient non-finite (throws in browsers)')); if (a.some((v) => !Number.isFinite(v))) throw new TypeError('createLinearGradient: non-finite'); return gradient; },
      createRadialGradient: (...a) => { if (a.some((v) => !Number.isFinite(v))) throw new TypeError('createRadialGradient: non-finite'); if (a[2] < 0 || a[5] < 0) throw new RangeError('createRadialGradient: negative radius'); return gradient; },
      createConicGradient: () => gradient,
      createPattern: () => ({ setTransform() {} }),
      measureText: (t) => ({ width: String(t).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: String(t).length * 7 }),
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, Math.abs(w * h) * 4)), width: w, height: h }),
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, Math.abs(w * h) * 4)), width: w, height: h }),
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse() { return this; } }),
      isPointInPath: () => false,
      isPointInStroke: () => false,
      getLineDash: () => [],
      getContextAttributes: () => ({ alpha: true }),
    };
    return new Proxy(st, {
      get(o, k) {
        if (k in fns) return fns[k];
        if (k in o) return o[k];
        if (typeof k !== 'string' || CTX_PROPS.has(k)) return undefined;
        return (...args) => {
          if ((k === 'ellipse' && (args[2] < 0 || args[3] < 0)) || (k === 'arc' && args[2] < 0) || (k === 'arcTo' && args[4] < 0)) {
            throw new RangeError(`IndexSizeError: ${k} negative radius`);
          }
          if (k === 'roundRect') {
            const r = args[4];
            const rs = Array.isArray(r) ? r : [r];
            if (rs.some((v) => typeof v === 'number' && v < 0)) throw new RangeError('IndexSizeError: roundRect negative radius');
          }
          if (k === 'drawImage' && args[0] && args[0].width === 0) throw new Error('InvalidStateError: drawImage of 0-size canvas');
          for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) { warn(`ctx.${k} got non-finite number`); break; }
          return undefined;
        };
      },
      set(o, k, v) {
        if (k === 'globalAlpha' && typeof v === 'number' && !Number.isFinite(v)) warn('globalAlpha non-finite');
        o[k] = v;
        return true;
      },
    });
  }

  // ---------- DOM ----------
  const byId = new Map();
  function makeClassList(el) {
    const set = new Set();
    return {
      add: (...c) => c.forEach((x) => set.add(x)),
      remove: (...c) => c.forEach((x) => set.delete(x)),
      toggle: (c, force) => { const on = force === undefined ? !set.has(c) : !!force; if (on) set.add(c); else set.delete(c); return on; },
      contains: (c) => set.has(c),
      replace: (a, b) => { if (set.has(a)) { set.delete(a); set.add(b); return true; } return false; },
      get length() { return set.size; },
      get value() { return [...set].join(' '); },
      toString() { return [...set].join(' '); },
      [Symbol.iterator]: () => set.values(),
    };
  }
  function makeStyle() {
    const o = {};
    return new Proxy(o, {
      get(t, k) {
        if (k === 'setProperty') return (a, b) => { t[a] = b; };
        if (k === 'removeProperty') return (a) => { delete t[a]; };
        if (k === 'getPropertyValue') return (a) => t[a] || '';
        return k in t ? t[k] : '';
      },
      set(t, k, v) { t[k] = v; return true; },
    });
  }
  function makeElement(tag = 'div', id = '') {
    const tgt = makeTarget();
    let _id = '';
    const el = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      nodeName: String(tag).toUpperCase(),
      hidden: false,
      textContent: '',
      innerHTML: '',
      innerText: '',
      value: '',
      disabled: false,
      checked: false,
      title: '',
      className: '',
      style: makeStyle(),
      classList: makeClassList(),
      dataset: {},
      children: [],
      childNodes: [],
      parentNode: null,
      parentElement: null,
      attributes: {},
      width: 300,
      height: 150,
      offsetWidth: width,
      offsetHeight: height,
      clientWidth: width,
      clientHeight: height,
      scrollTop: 0,
      scrollLeft: 0,
      tabIndex: 0,
      get firstChild() { return this.children[0] || null; },
      get lastChild() { return this.children[this.children.length - 1] || null; },
      get firstElementChild() { return this.children[0] || null; },
      get childElementCount() { return this.children.length; },
      get isConnected() { return true; },
      setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'id') this.id = String(v); if (k === 'hidden') this.hidden = true; if (k === 'class') this.className = String(v); },
      getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
      removeAttribute(k) { delete this.attributes[k]; if (k === 'hidden') this.hidden = false; },
      hasAttribute(k) { return k in this.attributes; },
      toggleAttribute(k, force) { const on = force === undefined ? !(k in this.attributes) : !!force; if (on) this.setAttribute(k, ''); else this.removeAttribute(k); return on; },
      appendChild(c) { if (c && typeof c === 'object') { this.children.push(c); this.childNodes.push(c); c.parentNode = this; c.parentElement = this; } return c; },
      append(...cs) { for (const c of cs) if (c && typeof c === 'object') this.appendChild(c); },
      prepend(...cs) { for (const c of cs) if (c && typeof c === 'object') { this.children.unshift(c); this.childNodes.unshift(c); c.parentNode = this; } },
      insertBefore(c) { return this.appendChild(c); },
      insertAdjacentHTML() {},
      insertAdjacentElement(p, c) { return this.appendChild(c); },
      insertAdjacentText() {},
      removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
      replaceChild(n, o) { this.removeChild(o); return this.appendChild(n); },
      replaceChildren(...cs) { this.children = []; this.childNodes = []; this.append(...cs); },
      replaceWith() {},
      remove() { if (this.parentNode) this.parentNode.removeChild(this); },
      cloneNode() { return makeElement(tag); },
      querySelector() { return makeElement('div'); },
      querySelectorAll() { return []; },
      getElementsByTagName() { return []; },
      getElementsByClassName() { return []; },
      closest() { return null; },
      contains(o) { return o === this; },
      matches() { return false; },
      getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, width, height, right: width, bottom: height }; },
      getClientRects() { return [this.getBoundingClientRect()]; },
      focus() { doc.activeElement = this; },
      blur() { if (doc.activeElement === this) doc.activeElement = null; },
      click() { this.dispatchEvent(makeEvent('click', { target: this, currentTarget: this })); },
      animate() { return { finished: Promise.resolve(), cancel() {}, finish() {}, play() {}, pause() {}, reverse() {}, onfinish: null, addEventListener() {} }; },
      getAnimations() { return []; },
      scrollIntoView() {},
      scrollTo() {},
      setPointerCapture() {},
      releasePointerCapture() {},
      requestFullscreen() { return Promise.resolve(); },
      getContext(kind) { if (kind !== '2d') return null; if (!this._ctx) this._ctx = makeCtx(this); return this._ctx; },
      toDataURL() { return 'data:,'; },
      toBlob(cb) { cb && cb(null); },
      addEventListener: tgt.addEventListener,
      removeEventListener: tgt.removeEventListener,
      dispatchEvent: tgt.dispatchEvent,
      _ls: tgt._ls,
    };
    Object.defineProperty(el, 'id', {
      get() { return _id; },
      set(v) { _id = String(v); if (_id) byId.set(_id, el); },
      enumerable: true,
    });
    if (id) el.id = id;
    return el;
  }

  const docTarget = makeTarget();
  const documentElement = makeElement('html');
  const doc = {
    nodeType: 9,
    hidden: false,
    visibilityState: 'visible',
    readyState: 'complete',
    activeElement: null,
    documentElement,
    head: makeElement('head'),
    body: makeElement('body'),
    fonts: { ready: Promise.resolve(), load: () => Promise.resolve([]), check: () => true, addEventListener() {}, status: 'loaded' },
    getElementById(id) {
      if (byId.has(id)) return byId.get(id);
      if (HTML_IDS.has(id)) {
        const el = makeElement(id === 'game' ? 'canvas' : 'div', id);
        if (id === 'game') { el.width = width; el.height = height; }
        return el;
      }
      return null;
    },
    createElement: (tag) => makeElement(tag),
    createElementNS: (ns, tag) => makeElement(tag),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
    createDocumentFragment: () => makeElement('fragment'),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    addEventListener: docTarget.addEventListener,
    removeEventListener: docTarget.removeEventListener,
    dispatchEvent: docTarget.dispatchEvent,
    hasFocus: () => true,
    execCommand: () => true,
  };
  doc.documentElement.parentNode = doc;
  // элементы из разметки создаются заранее, как в браузере
  for (const id of HTML_IDS) doc.getElementById(id);
  // скрытые в разметке элементы
  for (const m of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*\bhidden\b[^>]*>/g)) { const el = byId.get(m[1]); if (el) el.hidden = true; }

  // ---------- WebAudio ----------
  function makeParam(name) {
    return {
      value: 0, defaultValue: 0, minValue: -3.4e38, maxValue: 3.4e38,
      setValueAtTime(v, t) { if (!Number.isFinite(v) || !Number.isFinite(t)) throw new TypeError(`${name}.setValueAtTime non-finite`); return this; },
      linearRampToValueAtTime(v, t) { if (!Number.isFinite(v) || !Number.isFinite(t)) throw new TypeError(`${name}.linearRamp non-finite`); return this; },
      exponentialRampToValueAtTime(v, t) {
        if (!Number.isFinite(v) || !Number.isFinite(t)) throw new TypeError(`${name}.exponentialRamp non-finite`);
        if (v === 0) throw new RangeError(`${name}.exponentialRampToValueAtTime value must be non-zero (got ${v})`);
        return this;
      },
      setTargetAtTime(v, t, c) { if (!Number.isFinite(v) || !Number.isFinite(t) || !Number.isFinite(c)) throw new TypeError(`${name}.setTargetAtTime non-finite`); return this; },
      setValueCurveAtTime() { return this; },
      cancelScheduledValues() { return this; },
      cancelAndHoldAtTime() { return this; },
    };
  }
  function makeNode(kind) {
    const base = {
      kind, numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, type: 'sine', buffer: null, loop: false, loopStart: 0, loopEnd: 0, onended: null, curve: null, oversample: 'none', fftSize: 2048, frequencyBinCount: 1024, normalize: true,
      connect(n) { return n; }, disconnect() {},
      start(t = 0) { if (!Number.isFinite(t)) throw new TypeError(kind + '.start non-finite'); if (this._started) throw new Error('InvalidStateError: ' + kind + ' start called twice'); this._started = true; },
      stop(t = 0) { if (!Number.isFinite(t)) throw new TypeError(kind + '.stop non-finite'); if (!this._started) throw new Error('InvalidStateError: ' + kind + ' stop before start'); },
      setPeriodicWave() {}, getByteFrequencyData() {}, getFloatFrequencyData() {}, getByteTimeDomainData() {}, getFloatTimeDomainData() {},
      addEventListener() {}, removeEventListener() {},
    };
    return new Proxy(base, {
      get(o, k) {
        if (k in o) return o[k];
        if (AUDIO_PARAMS.has(k)) { o[k] = makeParam(kind + '.' + k); return o[k]; }
        return undefined;
      },
      set(o, k, v) { o[k] = v; return true; },
    });
  }
  class FakeAudioContext {
    constructor() { this.state = 'running'; this.sampleRate = 44100; this.destination = makeNode('destination'); this.listener = {}; this.baseLatency = 0.01; }
    get currentTime() { return now / 1000; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createBuffer(ch, len, sr) { if (!(len > 0)) throw new RangeError('createBuffer length must be > 0'); const data = Array.from({ length: ch }, () => new Float32Array(len)); return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: (i) => data[i] }; }
    createPeriodicWave() { return {}; }
    decodeAudioData() { return Promise.resolve(this.createBuffer(1, 1, 44100)); }
    addEventListener() {}
    removeEventListener() {}
  }
  for (const k of ['Oscillator', 'Gain', 'BiquadFilter', 'BufferSource', 'DynamicsCompressor', 'StereoPanner', 'Delay', 'WaveShaper', 'Convolver', 'Analyser', 'ChannelMerger', 'ChannelSplitter', 'ConstantSource', 'Panner', 'IIRFilter', 'MediaElementSource']) {
    FakeAudioContext.prototype['create' + k] = function () { return makeNode(k); };
  }

  // ---------- window ----------
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] || null,
    get length() { return store.size; },
  };
  const winTarget = makeTarget();
  const consoleErrors = [];
  const sandbox = {
    console: {
      log: (...a) => VERBOSE && console.log('[page]', ...a),
      info: (...a) => VERBOSE && console.log('[page]', ...a),
      debug: () => {},
      warn: (...a) => warn('console.warn: ' + String(a[0]).slice(0, 120)),
      error: (...a) => consoleErrors.push(a.map((x) => (x && x.stack ? x.stack.split('\n').slice(0, 3).join(' | ') : String(x))).join(' ')),
    },
    document: doc,
    navigator: { userAgent: 'smoke', language: 'ru', maxTouchPoints: 0, vibrate: () => true, clipboard: { writeText: () => Promise.resolve(), readText: () => Promise.reject(new Error('no')) }, share: undefined, hardwareConcurrency: 4 },
    location: { href: 'https://example.test/', hash: '', search: '', pathname: '/', origin: 'https://example.test' },
    history: { replaceState() {}, pushState() {} },
    localStorage: storage,
    sessionStorage: storage,
    devicePixelRatio: 2,
    innerWidth: width,
    innerHeight: height + 200,
    screen: { width, height },
    performance: { now: () => now, mark() {}, measure() {} },
    requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
    cancelAnimationFrame: () => {},
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimerFake,
    setInterval: setIntervalFake,
    clearInterval: clearTimerFake,
    queueMicrotask,
    structuredClone,
    getComputedStyle: () => ({ getPropertyValue: (n) => (n.startsWith('--') ? '#8a7a66' : ''), }),
    matchMedia: (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    AudioContext: FakeAudioContext,
    webkitAudioContext: FakeAudioContext,
    ResizeObserver: class { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { constructor() {} observe() {} disconnect() {} takeRecords() { return []; } },
    IntersectionObserver: class { constructor() {} observe() {} unobserve() {} disconnect() {} },
    Image: class { constructor() { this.complete = true; this.width = 1; this.height = 1; } addEventListener() {} decode() { return Promise.resolve(); } },
    Path2D: class { constructor() {} moveTo() {} lineTo() {} arc() {} ellipse() {} rect() {} closePath() {} bezierCurveTo() {} quadraticCurveTo() {} arcTo() {} roundRect() {} addPath() {} },
    OffscreenCanvas: class { constructor(w, h) { this.width = w; this.height = h; } getContext(k) { return k === '2d' ? makeCtx(this) : null; } transferToImageBitmap() { return {}; } },
    DOMMatrix: class { constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; } },
    Event: class { constructor(type, init) { Object.assign(this, makeEvent(type), init); } },
    CustomEvent: class { constructor(type, init) { Object.assign(this, makeEvent(type), init); this.detail = init && init.detail; } },
    KeyboardEvent: class { constructor(type, init) { Object.assign(this, makeEvent(type), init); } },
    PointerEvent: class { constructor(type, init) { Object.assign(this, makeEvent(type), init); } },
    HTMLElement: class {},
    HTMLCanvasElement: class {},
    Element: class {},
    Node: class {},
    Blob: class { constructor(parts) { this.size = 0; this.parts = parts; } },
    URL: Object.assign(function () {}, { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} }),
    fetch: () => Promise.reject(new Error('fetch is not available in smoke test')),
    alert: () => {}, confirm: () => false, prompt: () => null,
    print: () => {},
    open: () => null,
    scrollTo: () => {},
    addEventListener: winTarget.addEventListener,
    removeEventListener: winTarget.removeEventListener,
    dispatchEvent: winTarget.dispatchEvent,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.top = sandbox;
  sandbox.parent = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  sandbox.__rand = rand;
  vm.runInContext('Math.random = __rand; Date.now = () => 1767225600000 + performance.now();', sandbox);

  // ---------- загрузка ----------
  const loadT0 = process.hrtime.bigint();
  for (const src of SCRIPTS) {
    const file = path.join(ROOT, src);
    if (!fs.existsSync(file)) { problems.push(`missing script ${src}`); continue; }
    const code = fs.readFileSync(file, 'utf8');
    try {
      vm.runInContext(code, sandbox, { filename: src });
    } catch (e) {
      problems.push(`load ${src}: ${e && e.stack ? e.stack.split('\n').slice(0, 5).join(' | ') : e}`);
    }
  }
  const G = sandbox.G;
  if (!G) return { name, problems: problems.concat('window.G is missing after load'), warnings, summary: {} };

  const spawned = {};
  const picked = {};
  const events = {};
  const count = (o, k) => { o[k] = (o[k] || 0) + 1; };
  for (const evt of ['start', 'die', 'gameover', 'jump', 'land', 'pickup', 'bonus', 'milestone', 'pass', 'smash', 'pause', 'resume', 'powerup', 'powerupEnd', 'achievement', 'hit']) {
    G.on(evt, () => count(events, evt));
  }
  G.on('spawn', (o) => count(spawned, o.type));
  G.on('pickup', (p) => count(picked, p.type));

  // ---------- контракт между модулями ----------
  const contract = (cond, msg) => { if (!cond) problems.push('contract: ' + msg); };
  const SKIN_IDS = ['classic', 'dust', 'hoodie', 'headphones', 'tie', 'shades', 'gold'];
  contract(Array.isArray(G.skins) && SKIN_IDS.every((id) => G.skins.some((s) => s.id === id)), 'G.skins must contain ' + SKIN_IDS.join(','));
  contract(typeof G.renderBunnyThumb === 'function', 'G.renderBunnyThumb missing');
  for (const id in G.obstacleTypes) {
    const d = G.obstacleTypes[id];
    contract(typeof d.draw === 'function' && typeof d.hit === 'function', `obstacle ${id}: draw/hit`);
    contract(Array.isArray(d.causes) && d.causes.length > 0 && typeof d.hitWord === 'string', `obstacle ${id}: causes/hitWord`);
  }
  for (const id in G.pickupTypes) contract(typeof G.pickupTypes[id].draw === 'function', `pickup ${id}: draw`);
  contract(Array.isArray(G.milestones) && G.milestones.every((m, i, a) => typeof m.text === 'string' && typeof m.clock === 'string' && (!i || a[i - 1].min < m.min)), 'G.milestones sorted {min, clock, text}');
  for (const k of ['burst', 'popup', 'shake', 'dust']) contract(G.fx && typeof G.fx[k] === 'function', 'G.fx.' + k);
  for (const k of ['toggle', 'setMuted', 'setMusic', 'unlock', 'context']) contract(G.audio && typeof G.audio[k] === 'function', 'G.audio.' + k);
  for (const k of ['toast', 'setOverlay', 'verdict']) contract(G.ui && typeof G.ui[k] === 'function', 'G.ui.' + k);
  const TOAST_KINDS = new Set(['milestone', 'achievement', 'skin', 'powerup', 'record', 'info']);
  if (G.ui && G.ui.toast) {
    const toast = G.ui.toast;
    G.ui.toast = (label, text, o) => {
      contract(typeof label === 'string' && (text == null || typeof text === 'string'), `toast(label, text): got ${typeof label}, ${typeof text}`);
      contract(!o || ((o.kind == null || TOAST_KINDS.has(o.kind)) && (o.duration == null || (o.duration > 0 && o.duration <= 15))), `toast opts ${JSON.stringify(o)}`);
      return toast(label, text, o);
    };
  }
  const livePowers = new Set();
  G.on('powerup', (p) => {
    contract(p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.duration === 'number', 'powerup {id, name, duration}');
    if (p && p.duration > 0) livePowers.add(p.id);
  });
  G.on('powerupEnd', (p) => {
    contract(p && typeof p.id === 'string' && typeof p.reason === 'string', 'powerupEnd {id, reason}');
    if (p) livePowers.delete(p.id);
  });
  G.on('combo', (c) => contract(c && Number.isFinite(c.count) && Number.isFinite(c.mult) && c.mult >= 1, 'combo {count, mult}'));
  G.on('milestone', (m) => contract(m && typeof m.text === 'string' && typeof m.clock === 'string', 'milestone {min, clock, text}'));
  G.on('achievement', (a) => contract(a && typeof a.id === 'string' && typeof a.name === 'string', 'achievement {id, name, desc}'));
  G.on('start', () => {
    contract(G.mod('time') === 1 && G.mod('speed') === 1 && G.mod('score') === 1 && !G.flag('invincible'), 'mods/flags must be clean on start');
    livePowers.clear();
  });
  G.on('die', () => {
    for (const id of livePowers) problems.push(`powerup ${id} still live after die`);
  });

  const planner = bot === 'planner' ? makePlanner(G, fps) : null;
  const deathLog = [];
  G.on('die', (info) => {
    const B = G.bunny, o = info.o || {};
    deathLog.push(`${o.type}${o.level != null ? ' L' + o.level : ''}${o.lane != null ? ' lane ' + Math.round(o.lane) : ''} at ${G.fmtClock(info.clockMin)}, t=${info.t.toFixed(1)}, v=${Math.round(G.state.speed)}, alt=${Math.round(B.alt)}, jumps=${B.jumps}`);
  });

  const stage = doc.getElementById('stage');
  const press = (code = 'Space') => {
    winTarget.dispatchEvent(makeEvent('keydown', { code, key: code === 'Space' ? ' ' : code, target: doc.body }));
    winTarget.dispatchEvent(makeEvent('keyup', { code, key: code === 'Space' ? ' ' : code, target: doc.body }));
  };
  const tap = () => {
    stage.dispatchEvent(makeEvent('pointerdown', { target: stage, currentTarget: stage }));
    winTarget.dispatchEvent(makeEvent('pointerup', { target: stage }));
  };

  // ---------- игра ----------
  const frameMs = 1000 / fps;
  const totalFrames = Math.round(seconds * fps);
  let maxT = 0, maxScore = 0, maxObstacles = 0, maxPickups = 0, deadSince = -1, frames = 0;
  let nonFinite = '';
  const t0 = process.hrtime.bigint();

  function step() {
    now += frameMs;
    runDueTimers();
    const q = rafQueue;
    rafQueue = [];
    for (const fn of q) guard('raf', () => fn(now));
    frames++;
  }

  // кнопки разметки, клики по которым безопасны
  const clickable = ['startBtn', 'againBtn', 'mute'].map((id) => byId.get(id)).filter(Boolean);

  if (typeof G.renderBunnyThumb === 'function') {
    for (const id of SKIN_IDS) {
      for (const px of [144, 40]) {
        const cv = doc.createElement('canvas');
        cv.width = px;
        cv.height = px;
        guard('renderBunnyThumb ' + id, () => G.renderBunnyThumb(cv, id));
      }
    }
  }

  // инварианты по ходу игры (секунды реального времени)
  let slowFor = 0, invFor = 0, overFor = 0;
  function invariants() {
    const S = G.state, rdt = 1 / fps;
    slowFor = S.mode === 'run' && G.mod('time') < 0.999 ? slowFor + rdt : 0;
    if (slowFor > 2.5) { problems.push(`time mod stuck at ${G.mod('time').toFixed(2)} in run`); slowFor = -1e9; }
    invFor = !invincible && S.mode === 'run' && G.flag('invincible') ? invFor + rdt : 0;
    if (invFor > 7) { problems.push('invincible flag stuck in run'); invFor = -1e9; }
    overFor = S.mode === 'over' ? overFor + rdt : 0;
    if (overFor > 1.5 && overFor < 1.5 + rdt * 1.5 && G.mod('time') !== 1) problems.push(`time mod ${G.mod('time')} still set on game over`);
    const sp = G.mod('speed');
    if (S.mode === 'run' && !(sp >= 0.5 && sp <= 2)) problems.push(`speed mod out of range: ${sp}`);
  }

  step();
  tap();
  for (let i = 0; i < totalFrames; i++) {
    const S = G.state;
    if (invincible && S.mode === 'run') G.setFlag('invincible', 'smoke', true);

    if (S.mode === 'run') {
      if (planner) {
        if (planner()) press();
      } else if (autopilot) {
        const B = G.bunny;
        const threat = G.obstacles.some((o) => {
          if (o.deco || o.dead) return false;
          const d = o.x - B.x;
          const lead = 70 + S.speed * 0.12;
          if (d < 25 || d > lead) return false;
          const def = G.obstacleTypes[o.type];
          if (def && def.kind === 'air') return (o.fly || 0) < 60;
          return true;
        });
        if (threat && B.alt <= 0) press();
        else if (threat && B.v < -100 && B.jumps === 1 && rand() < 0.3) press();
      }
      if (chaos) {
        const r = rand();
        if (r < 0.03) press();
        else if (r < 0.035) tap();
        else if (r < 0.037) { winTarget.dispatchEvent(makeEvent('keydown', { code: 'ArrowDown', target: doc.body })); }
        else if (r < 0.04) { winTarget.dispatchEvent(makeEvent('keyup', { code: 'ArrowDown', target: doc.body })); }
        else if (r < 0.0405) { press('KeyP'); for (let k = 0; k < 5; k++) step(); press('KeyP'); }
        else if (r < 0.041) { press('KeyM'); }
        else if (r < 0.0412) {
          const el = clickable[Math.floor(rand() * clickable.length)];
          if (el) el.click();
        } else if (r < 0.0414) {
          const w2 = 300 + Math.floor(rand() * 900), h2 = 300 + Math.floor(rand() * 200);
          stage.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: w2, height: h2, right: w2, bottom: h2 });
          guard('resize', () => G.resize());
        } else if (r < 0.0416) {
          documentElement.setAttribute('data-theme', rand() < 0.5 ? 'dark' : 'light');
          guard('readColors', () => G.readColors());
        }
      }
      deadSince = -1;
    } else if (S.mode === 'over') {
      if (deadSince < 0) deadSince = frames;
      if (frames - deadSince > fps * 1.6) {
        if (rand() < 0.5) press(); else tap();
      }
    } else if (S.mode === 'pause') {
      press();
    } else if (S.mode === 'start') {
      tap();
    }

    step();
    invariants();

    const B = G.bunny;
    maxT = Math.max(maxT, S.t);
    guard('score', () => { maxScore = Math.max(maxScore, G.score()); });
    maxObstacles = Math.max(maxObstacles, G.obstacles.length);
    maxPickups = Math.max(maxPickups, G.pickups.length);
    if (!nonFinite) {
      const nums = { t: S.t, dist: S.dist, speed: S.speed, timeMin: S.timeMin, bonusMin: S.bonusMin, 'bunny.x': B.x, 'bunny.alt': B.alt, 'bunny.v': B.v, 'bunny.size': B.size, 'camera.x': G.camera.x, 'camera.y': G.camera.y, 'camera.zoom': G.camera.zoom };
      for (const k in nums) if (!Number.isFinite(nums[k])) { nonFinite = `${k}=${nums[k]} at frame ${frames}`; break; }
      for (const o of G.obstacles) if (!Number.isFinite(o.x) || !Number.isFinite(o.alt || 0)) { nonFinite = `obstacle ${o.type} x/alt non-finite at frame ${frames}`; break; }
      for (const p of G.pickups) if (!Number.isFinite(p.x) || !Number.isFinite(p.alt)) { nonFinite = `pickup ${p.type} x/alt non-finite at frame ${frames}`; break; }
    }
  }

  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
  if (nonFinite) problems.push('non-finite state: ' + nonFinite);
  for (const e of G.errors || []) problems.push(`G.errors [${e.tag}] ${e.message} :: ${String(e.stack).split('\n').slice(1, 4).join(' | ')}`);
  for (const e of consoleErrors) if (!/^\[G\]/.test(e)) problems.push('console.error: ' + e);
  if (maxObstacles > 120) problems.push(`too many live obstacles: ${maxObstacles}`);
  if (maxPickups > 120) problems.push(`too many live pickups: ${maxPickups}`);
  if (planner) for (const d of deathLog) problems.push('planner died (unfair spot?): ' + d);

  return {
    name,
    problems: [...new Set(problems)],
    warnings,
    summary: {
      frames,
      simSeconds: seconds,
      msPerFrame: +(elapsedMs / Math.max(1, frames)).toFixed(3),
      runs: events.start || 0,
      deaths: events.die || 0,
      maxRunSeconds: +maxT.toFixed(1),
      maxScore,
      events,
      spawned,
      picked,
      maxObstacles,
      maxPickups,
      loadMs: +(Number(t0 - loadT0) / 1e6).toFixed(1),
    },
    G,
  };
}

const scenarios = QUICK
  ? [
      { name: 'quick-play', seconds: 40, chaos: true },
      { name: 'quick-invincible', seconds: 60, invincible: true },
    ]
  : [
      { name: 'play-desktop', seed: 1, seconds: 240, chaos: false },
      { name: 'chaos-desktop', seed: 2, seconds: 180, chaos: true },
      { name: 'phone-chaos', seed: 7, width: 343, height: 300, seconds: 120, chaos: true },
      { name: 'invincible-marathon', seed: 3, seconds: 480, invincible: true, fps: 25 },
      { name: 'planner-desktop', seed: 11, seconds: 300, fps: 60, bot: 'planner' },
      { name: 'planner-phone', seed: 12, width: 343, height: 300, seconds: 300, fps: 60, bot: 'planner' },
      { name: 'planner-wide', seed: 13, width: 1400, height: 420, seconds: 240, fps: 60, bot: 'planner' },
      { name: 'planner-30fps', seed: 14, width: 700, height: 500, seconds: 240, fps: 30, bot: 'planner' },
    ];

if (require.main !== module) {
  module.exports = { runScenario };
  return;
}

let failed = false;
for (const sc of scenarios) {
  const r = runScenario(sc);
  const ok = r.problems.length === 0;
  if (!ok) failed = true;
  console.log(`\n=== ${r.name}: ${ok ? 'OK' : 'FAIL'} ===`);
  console.log(JSON.stringify(r.summary));
  for (const p of r.problems.slice(0, 25)) console.log('  ✗ ' + p);
  if (r.problems.length > 25) console.log(`  … ещё ${r.problems.length - 25}`);
  for (const [k, n] of r.warnings) console.log(`  ⚠ ${k} ×${n}`);
}
console.log(failed ? '\nSMOKE: FAIL' : '\nSMOKE: OK');
process.exit(failed ? 1 : 0);
