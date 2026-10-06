# «Давай ебланить» — контракт модулей

Браузерный раннер на `<canvas>` по мему «давай ебланить / пожалуйста давай ебланить» (белый кролик на бежевом диване рядом с будильником на 11:56). Кролик бежит по дивану, перепрыгивает будильники, стопки срочных тасок, пинги, ноутбуки и дедлайны, пробегает под созвонами и «Есть минутка?». Очки — «минуты ебланства», часы идут с 09:00 (1 секунда игры = 4 игровые минуты).

Тон: русский офисно-айтишный юмор, мат дозированно и только в духе мема («ебланить», «ебланство»). Никаких внешних ассетов: вся графика процедурная (canvas), весь звук — WebAudio. Из сети грузятся только шрифты Oswald и Golos Text (Google Fonts); без сети работают фолбэки.

## Файлы и зоны

| Файл | Зона |
|---|---|
| `js/core.js`, `js/boot.js`, `test/`, `build.js`, `CONTRACT.md` | ядро, тесты, сборка |
| `js/scene.js` | окружение, свет, смена дня и ночи, погода |
| `js/bunny.js` | кролик, анимации, скины, превью скинов |
| `js/obstacles.js` | препятствия |
| `js/pickups.js` | морковки, пауэр-апы и их индикатор на канвасе |
| `js/fx.js` | частицы, всплывашки, камера, хит-стоп, слоу-мо |
| `js/audio.js` | звуки, процедурная музыка, дождь за окном |
| `js/balance.js` | режиссёр спавна, кривая скорости, комбо, near-miss, вехи времени |
| `js/meta.js`, `css/meta.css` | ачивки, общая статистика, выбор скина |
| `index.html`, `css/base.css`, `js/ui.js` | HUD, экраны, тосты, вёрстка, тема |

Порядок скриптов в `index.html` фиксирован: core, audio, scene, bunny, obstacles, pickups, fx, balance, meta, ui, boot. Модули общаются только через `G` и события; обращения к чужому API — с фича-детектом.

## Проверка и сборка

- `node --check js/<файл>.js`
- `node test/smoke.js --quick` (~2 с) и `node test/smoke.js` (полный прогон, ~15 с). Тест грузит все модули в фейковый DOM/canvas/WebAudio и гоняет сценарии:
  - `play-desktop`, `chaos-desktop`, `phone-chaos` — простой автопилот, хаос-ввод, пауза, звук, ресайзы, смена темы;
  - `invincible-marathon` — бессмертный забег через сутки (все типы препятствий, все вехи, ночь и погода);
  - `planner-desktop`, `planner-phone`, `planner-wide`, `planner-30fps` — бот-планировщик по физике ядра (с буфером прыжка) прыгает только когда нужно. Любая его смерть — провал: значит, связка препятствий нечестна при `G.cfg`.
- Тест падает на исключениях, `G.errors`, `console.error`, NaN в состоянии и на нарушениях контракта: обязательные поля событий `powerup/powerupEnd/combo/milestone/achievement`, сигнатура `G.ui.toast`, чистые модификаторы на `start`, пауэр-ап, не закрытый к `die`, залипший модификатор `time` или флаг `invincible`, ошибки `G.renderBunnyThumb` для каждого скина. Фейковый canvas, как и браузер, бросает на отрицательных радиусах `arc/ellipse/arcTo/roundRect` и неконечных аргументах градиентов; фейковый WebAudio — на `exponentialRampToValueAtTime(0)` и повторном `start()`.
- `node build.js` собирает всё в один файл `../davay-eblanit.html` (`<title>` в первых 8 КБ).

## Мир и координаты

- Мировые единицы. Высота мира ≥ 300, ширина ≥ 520; `G.W`, `G.H` — видимые размеры, `G.GROUND = G.H - 50` — линия сиденья. На телефоне мир выше (до ~475), на десктопе ровно 300.
- Высоты считаются как `alt` (вверх от земли): экранный y = `G.GROUND - alt`.
- Кролик: `G.bunny = { x, size, alt, v, jumps, coyote, airT, phase, dead }`. На старте он крупный (`size` 1.7) в центре (`G.heroX()`), в забеге — `x = 96`, `size = 1`. Хитбокс — круг `G.bunnyHitbox() → { x, y, r }` (y — это alt центра, r ≈ 18), вершина ≈ alt+40.
- Физика (`G.cfg`): gravity 2300, jumpV 760 (пик ≈ 125, время в воздухе ≈ 0.66 с), djumpV 640, двойной прыжок, coyote 0.08 с, буфер прыжка 0.15 с (выставляет balance), быстрое падение на ↓. Полёт кролика интегрируется точно (`alt += v·dt − a·dt²/2`), поэтому высота прыжка одинакова при 30, 60 и 120 кадрах в секунду. `heroClockDx` 92 — будильник-герой справа от большого кролика.
- Скорость мира `G.state.speed` (≈270 → ≈600 ед/с, кривая `G.speedAt` от balance), `G.state.dx` — сдвиг мира за кадр, `G.state.dist` — пройденный путь (для параллакса). Модификаторы скорости меняют её плавно (за 1.5–2 с): резкий скачок сбивает точку приземления в долгом прыжке.

## Состояние и время

- `G.state.mode`: `'start' | 'run' | 'pause' | 'over'`.
- `G.state.t` — секунды текущего забега (масштабируются хит-стопом), `G.state.idleT` — время анимаций (идёт во всех режимах, кроме паузы), `G.state.realT` — реальное время без масштаба.
- `G.clockMin()` — время суток в минутах (0..1439), `G.fmtClock(min)`, `G.fmtMin(min)`.
- `G.score()` = `floor(timeMin) + bonusMin`. `G.state.best`, `G.state.stats` (за забег: jumps, doubleJumps, carrots, pickups{id:n}, nearMisses, passed, passedByType{id:n}, smashed, bonusMin), `G.state.skin` (id скина).
- Экономика: морковки, near-miss и комбо дают примерно втрое больше минут, чем идёт на часах (к 13:00 ≈ 1000 мин, к 18:00 ≈ 2000). Пороги вердиктов и целей meta подобраны под это.
- `G.after(sec, fn)` — таймер в реальном времени (стоит на паузе). Используй его вместо setTimeout для игровой логики.
- `G.calm` — `prefers-reduced-motion` (живое значение, событие `calm(bool)` при смене). Тряску, вспышки, зум и мельтешение при нём уменьшать.

## Цвета, тема, рисование

- `G.C[token]` — цвета из CSS-токенов `--token` (в светлой и тёмной теме разные). Список: wall, couch, couch-hi, couch-lo, seat, seat-lo, ink, muted, panel, line, art, bunny, bunny-lo, pink, rim, rim-lo, face, metal, accent, carrot, leaf, card, а также face-ink и gold (добавляет ui). Новый токен — в `css/base.css` (`:root` и оба тёмных блока) и `G.colorKeys.add('имя')` при загрузке модуля. Фиксированные цвета допустимы для «физических» вещей (стикеры, золото, неон, экраны), но всё должно читаться в обеих темах. `G.isDark()`, событие `'theme'`.
- `G.draw.rr(ctx,x,y,w,h,r)`, `G.draw.ellipse(ctx,x,y,rx,ry,rot)` (сам делает fill, радиусы зажимает в ≥0), `G.draw.font(ctx, weight, size, 'display'|'body')`. Шрифты: Oswald (display), Golos Text (body). После загрузки шрифтов ядро шлёт `fonts` — перемерь кэшированный текст.
- `G.onRender(layer, fn(ctx))` — слои `G.LAYER`: BG 0, WALL 10, COUCH 20, SEAT 30, BACK 35, PICKUPS 40, OBSTACLES 50, BUNNY 60, FX 70, FRONT 80, SCREEN 90. Каждый рендер обёрнут в save/restore. Слои < SCREEN рисуются с камерой (`G.camera = { x, y, zoom, rot, fx, fy }`, ей управляет только fx), SCREEN — без камеры, в мировых единицах 0..G.W × 0..G.H.
- Кто где рисует: scene — BG, WALL, COUCH, SEAT (свет суток и источники света), FRONT (передний план не выше `GROUND + 22`, виньетка); fx — BACK+1 (скоростные линии), BACK+2 (полоса «ЕЛЕ-ЕЛЕ»), BUNNY−1 (пыль), FX, FRONT+5 (всплывашки), SCREEN (виньетка смерти, конфетти, вспышка); bunny — PICKUPS−1 (тень), BUNNY; pickups — PICKUPS−1 (аура «Пятницы»), BUNNY±1 (пар, крылья, щит, магнит), SCREEN (индикатор пауэр-апов в левом верхнем углу, y до ~94, и штамп «ОТМЕНЕНО»). Правый верхний угол сцены занят DOM-тостами.
- Производительность: цель — 60 fps на телефоне. Не создавай градиенты и строки шрифтов сотнями за кадр, кэшируй статичное в offscreen-canvas, перерисовывай кэш на `'resize'`/`'theme'`/`'fonts'`. Частицы — в пулах с лимитом. Без `shadowBlur` в горячих циклах.

## Логика: хуки, события, модификаторы

- `G.onUpdate(fn(dt, realDt), order)` — порядок: scene 4, balance 10, obstacles/pickups 20–30, bunny 60, fx 70, ui 90, meta 95. Вызывается во всех режимах, кроме паузы — проверяй `G.state.mode` сам.
- `G.on(evt, fn)` / `G.emit(evt, ...)`. Ошибки в слушателях ловятся и пишутся в `G.errors`.

События ядра:
- `boot`, `resize`, `theme {dark}`, `fonts`, `calm (bool)`, `input(source)` (любое нажатие, в том числе по кнопкам внутри сцены — source `'control'`; разблокирует звук), `key(e)` (нажатия, кроме прыжка/↓/P/Esc)
- `start {fromStart, run}` — новый забег (все модули сбрасывают своё состояние забега)
- `jump {n, double}`, `release`, `land {impact}` (impact — скорость удара, >300 — заметное приземление)
- `spawn (o, def)`, `spawnPickup (p, def)`, `pickup (p, def)`, `bonus {minutes, x, alt, label, kind}`
- `pass (o, {near})` — препятствие осталось позади; near — прошли впритирку (в пределах `G.cfg.nearMargin`)
- `hit {o, def, cancel}` — столкновение; слушатель может поставить `cancel = true` (щит), тогда ядро вызывает `G.smash(o)`
- `smash (o)` — препятствие сбито и улетает
- `die {o, type, def, score, isRecord, prevBest, best, t, clockMin, stats, cause, hitWord}`; через 0.65 с — `gameover` с тем же объектом (показать экран проигрыша)
- `pause`, `resume`, `mute (bool)`, `music (bool)`

События модулей:
- `milestone {min, clock, text}` — balance, когда часы доходят до вехи (`G.milestones`, 15 штук)
- `combo {count, mult, reason, lost}` — balance; при сбросе `count: 0, mult: 1`, `reason`: `'miss' | 'hit' | 'shield'`
- `powerup {id, name, desc, duration, instant?}` — pickups; `duration` в секундах, `0` — «до срабатывания» (щит) или мгновенный (`instant: true`, сразу за ним `powerupEnd`). Повторный подбор продлевает и шлёт `powerup` ещё раз
- `powerupEnd {id, reason}` — pickups; `reason`: `'timeout' | 'used' | 'die' | 'start' | 'instant'`
- `telegraph (o, def, phase)` — obstacles: `'enter'` — созвон или новый тип въехал в экран, `'lock'` — «Есть минутка?» выбрал полосу
- `clockRing (o)` — obstacles: будильник зазвенел, кролик близко
- `achievement {id, name, desc}`, `skinUnlock {id, name}` — meta

Модификаторы забега (ядро сбрасывает ВСЕ при старте забега и перед `die`):
- `G.setMod(name, owner, value|null)`; `G.mod(name)` — произведение, `G.modSum(name)` — сумма. Ядро читает: `time` (масштаб dt: хит-стоп, слоу-мо), `speed` (скорость мира), `score` (множитель минут за время), `gravity`, `jumpV`, `hitbox` (масштаб радиуса), `jumps` (сумма — доп. прыжки сверх 2).
- `G.setFlag(name, owner, bool)`; `G.flag(name)`. Ядро читает `invincible` (столкновения сбивают препятствия вместо смерти). Свои флаги можно заводить свободно (`magnet`).
- Владелец — строка с id модуля (`'coffee'`, `'fx-hitstop'`, `'balance'`, `'combo'`), чтобы не затирать чужие значения. Кто поставил — тот и снимает.

## Препятствия (obstacles)

`G.registerObstacle(def)`:
```
{ id, kind: 'ground'|'air', minT, weight(t), width,
  make(o, opts),            // o уже содержит { type, x, alt:0, rot:0, drift:1, seed }
  update(o, dt),            // опционально; ядро уже сдвинуло o.x на dx*o.drift
  draw(ctx, o),             // учитывает o.alt (подброс) и o.rot (вращение после сбития)
  hit(o, hb),               // hb = {x, y, r}; хитбокс чуть меньше картинки
  causes: [...], hitWord,
  fx: {debris, colors},     // опционально: обломки для fx
  sound,                    // опционально: 'clock'|'call'|'tasks'|'ping'|'laptop'|'deadline'|'minute'|'other'
  steady }                  // летающее на постоянной высоте, update только для анимации
```
- Типы: `clock` (opts `r`, `hands: 'meme'`), `tasks` (`n`), `call` (`level` 0/1/2: высота 28 — прыгать, 104 — бежать снизу, 210 — не делать двойной), `ping` (скачет, `o.hMax` — верх опасной зоны), `laptop` (широкий, крышка открывается при входе), `deadline` (высокий флаг на тележке), `minute` (летит на высоте кролика и за ~0.75 с фиксирует полосу 26 или 116). Новые типы до первого появления в забеге получают «дебютный» вес и красный «!» при входе.
- Ядро двигает (`o.x -= dx * o.drift`), проверяет столкновения, удаляет за экраном. `o.deco` — без столкновений, `o.ballistic` — летит после сбития (`G.knock`/`G.smash`), `o.remove = true` — убрать.
- На старте ядро ставит декоративный будильник `{hero:true, deco:true, hands:'meme', r:26}` справа от большого кролика; при старте его пинают (`G.knock`).
- Летающим (kind 'air') нужен `o.fly` — высота центра; balance и fx на это смотрят. Наземным — `o.h` (и `o.hMax`, если высота меняется).
- balance ставит препятствия по физике прыжка и меряет форму пробами `def.hit`; честность проверяет бот-планировщик смоука.

## Подбираемое (pickups)

`G.registerPickup({ id, minT, weight(t), radius, make(p, opts), update(p, dt), draw(ctx, p), collect(p) })`. `G.spawnPickup(id|null, x, alt)` — при null тип выбирается по весам (редкие саморегулируются: не чаще раза в ~12 с). Морковки в линиях и дугах balance спавнит явно `'carrot'`. Бонусные минуты — через `G.addBonus(minutes, {x, alt, label, kind})`; всплывашку по `bonus` рисует fx.

Типы: `carrot` (+15 мин), `gold` (+1 ч), пауэр-апы `coffee` (7 с: очки ×2, скорость ×1.15), `sick` (щит до первого удара + 0.6 с неуязвимости), `magnet` (8 с), `feather` (8 с: третий прыжок), `friday` (5 с: неуязвимость, скорость ×1.25), `cancel` (мгновенно сбивает всё на экране).

## Общие API модулей

- `G.fx`: `burst(x, alt, {n, speed, color, life, size, gravity, vx, vy})`, `popup(x, alt, text, {color, size, life, fill, rot})` (белая заливка, `color` — цвет тени), `shake(amount)`, `dust(x, n)`, а также `sparks`, `stars`, `ring`, `confetti`, `feathers`, `paper`, `flash`, `zoom`, `hitstop`, `slowmo`, геттеры `reduced`, `count`.
- `G.audio`: `{ muted, music, volume, toggle(), setMuted(b), setMusic(b), setVolume(group, v), unlock(), context(), isReady(), tone() }`, `G.sfx.<имя>()`. Звук реагирует на события сам — другие модули sfx не зовут. Клавиши `M` (звук) и `N` (музыка).
- `G.ui`: `toast(label, text, {kind, duration})` — `duration` в секундах; виды `milestone | achievement | skin | powerup | record | info`; на экране до 2 тостов (на телефоне один), остальные в очереди; на `start` и `gameover` всё чистится. `setOverlay(name|null)`, `verdict(score)`. Тост на `milestone` показывает сам ui; на `powerup` — нет (pickups рисует свою плашку).
- `G.skins`: `{ id, name, desc }` с фиксированными id `classic, dust, hoodie, headphones, tie, shades, gold`. bunny рисует каждый, `G.renderBunnyThumb(canvas, skinId)` — превью любого размера, не зависит от `G.state`. meta решает, как скины открываются, и пишет выбор в `G.state.skin`.
- `G.meta`: `selectSkin(id)`, `isSkinUnlocked(id)`, `skinCondition(id)`, `isUnlocked(achId)`, `render()`, `profile`.
- `G.powerups`: `{ defs, isActive(id), left(id), give(id) }`.
- `G.scene` (только чтение): `{ night, lamp, sunset, weather: 'clear'|'rain'|'snow', weatherK }`.
- `G.bunnyHead()` — макушка кролика `{x, alt}` с учётом позы (объект переиспользуется); `G.bunnyDizzy` — кролик сам рисует звёздочки после смерти.
- `G.milestones` — массив `{min, clock, text}` (balance).
- Разметка: `#stage` (канвас `#game`, оверлей `#overlay` с `#startView/#overView/#pauseView`, `#toast`), `#metaPanel` (секция под игрой, отдаётся meta), `#metaOver` (внутри карточки результата, отдаётся meta). Всё кликабельное внутри сцены — `button`/`a` или помечено `data-noinput`, иначе клик запустит прыжок.

## Хранилище

`G.store.get/set/getJSON/setJSON` (localStorage в try/catch). Ключи с префиксом `eblan.` — `eblan.best`, `eblan.muted`, `eblan.skin`, `eblan.meta.profile` (миграция из `eblan.life`), `eblan.meta.tab`, `eblan.audio.music`, `eblan.audio.vol`, `eblan.ui.theme`.

## Заход 3: геймплей и локации (действует поверх всего выше)

Два плана — главные документы этого захода: `design/gameplay.md` (геймплейная команда) и `design/visual.md` (графическая команда). Где план расходится с текстом выше, прав план.

Владельцы файлов в этом заходе (правишь только свои, новые файлы — только из этого списка):

| Пакет | Файлы |
|---|---|
| Геймплей A — честность, режиссёр, препятствия | `js/balance.js`, `js/obstacles.js`, `test/fairness.js` |
| Геймплей B — цели, экраны, события дня | `js/meta.js`, `css/meta.css`, `js/ui.js`, `index.html` (кроме списка `<script>`), `css/base.css`, `js/events.js` |
| Геймплей C — фирменные механики и звук | `js/modes.js`, `js/audio.js` |
| Графика A — мир, маршрут, локации дня | `js/scene.js`, `js/loc-day.js` |
| Графика B — свет, кадр, кролик, ночь | `js/look.js`, `js/bunny.js`, `js/loc-night.js` |
| Графика C — эффекты, погода, улица | `js/fx.js`, `js/weather.js`, `js/loc-out.js`, `js/pickups.js` (только функции отрисовки) |
| Интегратор | `js/core.js`, `js/boot.js`, `test/smoke.js`, `build.js`, `CONTRACT.md` |

Порядок скриптов уже выставлен и не меняется: core, audio, scene, loc-day, loc-out, loc-night, bunny, obstacles, modes, pickups, fx, weather, look, balance, meta, ui, events, boot. Заготовки новых файлов созданы.

В ядре уже есть приоритет приземления (A1): `G.cfg.landPriority = 0.07`, в `updateBunny` нажатие незадолго до касания ждёт приземления и становится полным прыжком.

Свои просьбы к ядру и соседям пиши в `notes/<пакет>.md` (например `notes/gameplay-a.md`, `notes/visual-c.md`).
